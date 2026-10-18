// Read-only live inspection. No apply, deployment, activation, worker, or send.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { consentCatalogQuery } = require('./deletion-consent-catalog.cjs');
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD='kwniiyayhzgjfqjsjcfu', QA='ggyonianphloycmqrwvj', ORG='xqbmotyjxjdeqoisbgow';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:[]);
async function main() {
 assert.equal(process.argv.length,2,'Read-only inspector takes no arguments');
 process.umask(0o077);
 const run=new Date().toISOString().replace(/[:.]/g,'-');
 const privateDir=path.join(root,'.family-qa/deletion-consent-inventory-20261002',run);
 const publicDir=path.join(root,'output/deletion-consent-inventory-20261002',run);
 fs.mkdirSync(privateDir,{recursive:true,mode:0o700}); fs.mkdirSync(publicDir,{recursive:true});
 const save=(name,data)=>fs.writeFileSync(path.join(privateDir,name),JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
 const evidence=walk(path.join(root,'output/deletion-completion-20260930')).map(file=>({file:path.relative(root,file),sha256:sha(fs.readFileSync(file))}));
 const registers=[
 '/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/native-20261001-6434ecdb-7d04-482d-a709-fd991932c142-register.json',
 '/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/durable-writer-20261001/deletion-registry-v1.json',
 '/Users/janzeppenfeld/.local/share/lottibaby-deletion-production/kwniiyayhzgjfqjsjcfu/registry/deletion-registry-v1.json'];
 const protectedFiles=[...evidence,...registers.map(file=>({file,sha256:sha(fs.readFileSync(file))}))];
 save('protected-files-before.local.json',protectedFiles);
 const inputs=['deletion-next-steps-20261001.md','deletion-provider-closure-20261001.md','deletion-production-rollout-20261001.md','deletion-supervised-provider-mode-20261001.md','deletion-provider-actions-20261001.md','deletion-production-preflight-20261002.md','deletion-production-registry-runtime-20261002.md','deletion-inventory.md'];
 fs.mkdirSync(path.join(publicDir,'input-snapshots'));
 for (const file of inputs) fs.copyFileSync(path.join(root,'docs/privacy',file),path.join(publicDir,'input-snapshots',file),fs.constants.COPYFILE_EXCL);
 let token=execFileSync('/usr/bin/security',['find-generic-password','-s','Supabase CLI','-a','supabase','-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 if(token.startsWith('go-keyring-base64:')) token=Buffer.from(token.slice(18),'base64').toString('utf8');
 assert(token.startsWith('sbp_'),'Existing Management credential unavailable');
 async function api(endpoint,body) {
  assert(!body || endpoint.endsWith('/database/query')&&body.read_only===true,'Read-only operations only');
  const res=await fetch('https://api.supabase.com'+endpoint,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  assert(res.ok,`Read-only API HTTP ${res.status}`); return res.json();
 }
 const sql=(ref,query)=>api(`/v1/projects/${ref}/database/query`,{query:`BEGIN READ ONLY; SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='15s'; ${query}; ROLLBACK;`,read_only:true});
 const project=await api(`/v1/projects/${PROD}`);
 assert.equal(project.id,PROD); assert.equal(project.organization_id,ORG); assert.equal(project.status,'ACTIVE_HEALTHY');
 const before=(await sql(PROD,consentCatalogQuery))[0]; save('consent-catalog-before.local.json',before);
 // Reuse the reviewed DDL-only catalog query, not the old snapshot or its main().
 const priorSource=fs.readFileSync(path.join(root,'scripts/inspect-deletion-production-rollout.mjs'),'utf8');
 const fullCatalogQuery=priorSource.match(/const catalogSql = `([\s\S]*?)`;/)[1];
 const full=(await sql(PROD,fullCatalogQuery))[0].catalog; save('production-catalog-before.local.json',full);
 const fullExpression=fullCatalogQuery.slice('SELECT '.length).replace(/ AS catalog$/,'');
 const fullCatalogDigest=(await sql(PROD,`SELECT md5((${fullExpression})::text) digest`))[0].digest;
 const actualWriters=(await sql(PROD,`SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS identity,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND p.prosrc ~* '(INSERT[[:space:]]+INTO|UPDATE|DELETE[[:space:]]+FROM)[[:space:]]+consent_private[.](user_state|decisions|operations|events)' ORDER BY n.nspname,p.proname`));
 save('actual-writers-before.local.json',actualWriters);
 const runtimeQuery=`SELECT jsonb_build_object('deletionSchema',to_regnamespace('deletion_private') IS NOT NULL,'hook',(SELECT rolconfig FROM pg_roles WHERE rolname='authenticator'),'schedulers',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',jobid,'name',jobname,'active',active,'schedule',schedule) ORDER BY jobid),'[]'::jsonb) FROM cron.job),'consentSettings',(SELECT to_jsonb(s) FROM consent_private.settings s WHERE singleton),'globalDocumentsDigest',(SELECT md5(coalesce(string_agg(to_jsonb(d)::text,'|' ORDER BY version),'')) FROM consent_private.documents d),'counts',jsonb_build_object('user_state',(SELECT count(*) FROM consent_private.user_state),'decisions',(SELECT count(*) FROM consent_private.decisions),'operations',(SELECT count(*) FROM consent_private.operations),'events',(SELECT count(*) FROM consent_private.events))) AS state`;
 const state=(await sql(PROD,runtimeQuery))[0].state;
 const metadata=await api(`/v1/projects/${PROD}/functions`); save('functions-before.local.json',metadata);
 const qaQuery=`SELECT jsonb_build_object('consentSchema',to_regnamespace('consent_private') IS NOT NULL,'settings',(SELECT to_jsonb(s) FROM deletion_private.settings s WHERE singleton),'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'phase',phase,'lease',lease IS NOT NULL) ORDER BY id),'[]'::jsonb) FROM deletion_private.requests),'providerCounts',(SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM deletion_private.provider_tasks GROUP BY status) q),'requestProviderDigest',md5((SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb)::text FROM deletion_private.requests r)||(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY request_id,provider),'[]'::jsonb)::text FROM deletion_private.provider_tasks t))) AS state`;
 const qa=(await sql(QA,qaQuery))[0].state; save('qa-state-before.local.json',qa);
 const after=(await sql(PROD,consentCatalogQuery))[0];
 const stateAfter=(await sql(PROD,runtimeQuery))[0].state;
 const qaAfter=(await sql(QA,qaQuery))[0].state;
 const fullAfter=(await sql(PROD,fullCatalogQuery))[0].catalog;
 const afterMeta=await api(`/v1/projects/${PROD}/functions`);
 const writers=actualWriters;
 const report={checkedAt:new Date().toISOString(),projectRef:PROD,organizationId:ORG,projectStatus:project.status,productionChanged:false,qaChanged:false,executionAllowed:false,fullCatalogDigest,consentCatalogDigest:before.digest,consentTables:before.catalog.tables,actualConsentWriters:writers.map(f=>({schema:f.schema,name:f.name,identity:f.identity,sha256:sha(f.definition)})),publicWrappers:before.catalog.functions.filter(f=>f.schema==='public').map(f=>({name:f.name,identity:f.identity,sha256:sha(f.definition)})),state,qa:{consentSchema:qa.consentSchema,providerCounts:qa.providerCounts,requests:qa.requests,mode:qa.settings.provider_handling_mode,approvedFingerprint:qa.settings.approved_fingerprint},preservation:{consentCatalog:before.digest===after.digest,productionCatalog:sha(JSON.stringify(full))===sha(JSON.stringify(fullAfter)),productionRuntime:sha(JSON.stringify(state))===sha(JSON.stringify(stateAfter)),functionMetadata:sha(JSON.stringify(metadata))===sha(JSON.stringify(afterMeta)),qaRequestProviderState:qa.requestProviderDigest===qaAfter.requestProviderDigest,originalEvidenceAndRegisters:protectedFiles.every(f=>sha(fs.readFileSync(path.isAbsolute(f.file)?f.file:path.join(root,f.file)))===f.sha256)},originalEvidenceCount:evidence.length,privateBackup:path.relative(root,privateDir),repeatQaTests:false};
 assert(Object.values(report.preservation).every(Boolean),'Read-only preservation mismatch');
 save('consent-catalog-after.local.json',after); save('production-catalog-after.local.json',fullAfter); save('qa-state-after.local.json',qaAfter);
 fs.writeFileSync(path.join(publicDir,'live-read.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({publicDir:path.relative(root,publicDir),privateDir:path.relative(root,privateDir),consentTables:before.catalog.tables.map(t=>t.name),writers:report.actualConsentWriters,state,qa:report.qa,preservation:report.preservation}));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1;});
