import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const user='10000000-0000-4000-8000-000000000001';
function loadEndpoint(slug,allowed,unavailable=false) {
 let handler;const calls=[];const reads=[];const providers=[];
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='check_data_processing_consent'?allowed[args.p_scope]:false,error:unavailable&&name==='check_data_processing_consent'?{code:'unavailable'}:null};},from:table=>{reads.push(table);throw Error('Private read before consent');}};
 const authClient={auth:{getUser:async()=>({data:{user:{id:user,app_metadata:{is_admin:true}}},error:null})}};
 const modules=new Map();
 const env={SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',OPENAI_API_KEY:'synthetic'};
 function load(file) {
  if(modules.has(file))return modules.get(file).exports;
  const module={exports:{}};modules.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const localRequire=name=>{
   if(name.includes('/http/server.ts'))return {serve:fn=>{handler=fn;}};
   if(name.includes('@supabase/supabase-js'))return {createClient:(_url,key)=>key==='anon'?authClient:admin};
   if(name.endsWith('/premiumAccess.ts'))return {verifySubscriptionFeatureAccess:async()=>({allowed:true})};
   if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name));
   throw Error('Unreviewed import '+name);
  };
  vm.runInNewContext(code,{exports:module.exports,require:localRequire,module,Deno:{env:{get:k=>env[k]}},
   Response,Request,Headers,TextEncoder,TextDecoder,URL,AbortController,Error,setTimeout,clearTimeout,
   fetch:async(...args)=>{providers.push(args);throw Error('Unexpected provider request');},console:{log(){},warn(){},error(){}}},{filename:file});
  return module.exports;
 }
 load(path.resolve(process.env.DATA_CONSENT_FUNCTIONS_DIR ?? 'supabase/functions',slug,'index.ts'));assert.equal(typeof handler,'function');
 return {handler,calls,reads,providers};
}
const payloads={
 'ask-lotti':{mode:'pregnancy',requestId:'20000000-0000-4000-8000-000000000001',question:'Wie kann ich meinen Alltag organisieren?',locale:'de'},
 'voice-log-parse':{text:'Frage für meinen Arzt',deviceNow:'2026-10-01T14:00',mode:'pregnancy'},
 'advisor-generate':{mode:'pregnancy',localDate:'2026-10-01',signals:{}},
};
for(const slug of Object.keys(payloads)) {
 test(`${slug}: lack of consent stops privileged reads and external calls even for an admin`,async()=>{
  const test=loadEndpoint(slug,{health:false,ai:false});const res=await test.handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic'},body:JSON.stringify(payloads[slug])}));
  assert.equal(res.status,403);assert.match((await res.json()).error,/consent_required/);assert.equal(test.reads.length,0);assert.equal(test.providers.length,0);
  assert(test.calls.some(c=>c.name==='check_data_processing_consent'&&c.args.p_user_id===user));
 });
 test(`${slug}: a failed consent lookup fails closed`,async()=>{
  const test=loadEndpoint(slug,{health:true,ai:true},true);const res=await test.handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payloads[slug])}));
  assert.equal(res.status,503);assert.equal(test.reads.length,0);assert.equal(test.providers.length,0);
 });
}
test('current app and immutable backend document contain the same three locale disclosures',()=>{
 const source=fs.readFileSync('lib/dataConsentCopy.ts','utf8'),module={exports:{}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:module.exports});
 const sql=fs.readFileSync('supabase/migrations/20261001170732_data_consent_records.sql','utf8');const stored=JSON.parse(sql.match(/\$copy\$([\s\S]*?)\$copy\$/)[1]);
 assert.deepEqual(Object.keys(stored),['de','en','es']);
 for(const locale of Object.keys(stored))for(const [key,value] of Object.entries(stored[locale]))assert.equal(module.exports.activeDataConsentCopy[locale][key],value);
});
test('every root route is explicit in the reduced consent navigator',()=>{
 const source=fs.readFileSync('components/privacy/DataConsentBoundary.tsx','utf8');
 const protectedText=source.match(/protectedConsentRoutes = \[([\s\S]*?)\];/)[1];
 const declared=new Set([...protectedText.matchAll(/'([^']+)'/g)].map(m=>m[1]));
 for(const m of source.matchAll(/<Stack.Screen name="([^"]+)"/g))declared.add(m[1]);
 function visit(dir,prefix='') {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
   if(entry.name.startsWith('(')){assert(declared.has(entry.name));continue;}
   if(entry.isDirectory()){visit(path.join(dir,entry.name),prefix+entry.name+'/');continue;}
   if(!entry.name.endsWith('.tsx')||entry.name==='_layout.tsx')continue;
   const name=prefix+entry.name.slice(0,-4);assert(declared.has(name),'Unprotected auto-added root route: '+name);
  }
 }
 visit('app');
});
