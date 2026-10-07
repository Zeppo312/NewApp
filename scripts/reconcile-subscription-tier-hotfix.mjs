// Usage: node scripts/reconcile-subscription-tier-hotfix.mjs KEYS_JSON PRIVATE_DIRECTORY
// KEYS_JSON is `supabase projects api-keys --project-ref ... -o json`, redirected
// to a mode-0600 file. Never print credentials, customer IDs or customer lists.
import { mkdir, readFile, writeFile, appendFile, chmod } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
const project = 'kwniiyayhzgjfqjsjcfu';
const keys = JSON.parse(await readFile(process.argv[2], 'utf8'));
const key = keys.find(k => k.name === 'service_role')?.api_key;
if (!key) throw new Error('service_role_key_missing');
const directory = resolve(process.argv[3]);
await mkdir(directory,{recursive:true,mode:0o700}); await chmod(directory,0o700);
const operatorSecret=(await readFile(join(dirname(resolve(process.argv[2])),'repair-secret.txt'),'utf8')).trim();
const url = `https://${project}.supabase.co`;
const admin = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const snapshotPath=join(directory,'snapshot.private.json');
const resultsPath=join(directory,'results.private.json');
async function load(path,fallback) {try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
let snapshot=await load(snapshotPath,null);
if (!snapshot) {
  const rows=[];
  for (let offset=0;;offset+=500) {
    const {data,error}=await admin.from('lotti_subscription_entitlements').select('*')
      .in('product_id',['entl7a7b4e9838','LottiBabyAbo']).order('user_id').range(offset,offset+499);
    if(error)throw new Error('snapshot_read_failed');
    rows.push(...data); if(data.length<500)break;
  }
  snapshot={project,createdAt:new Date().toISOString(),rows};
  await writeFile(snapshotPath,JSON.stringify(snapshot,null,2),{mode:0o600});
}
if(snapshot.project!==project)throw new Error('snapshot_project_mismatch');
const results=await load(resultsPath,{});
let processed=0;
for(const row of snapshot.rows) {
  if(results[row.user_id]?.ok)continue;
  const reference=createHash('sha256').update(row.user_id).digest('hex').slice(0,12);
  let result;
  try {
    const response=await fetch(`${url}/functions/v1/subscription-tier-repair`,{
      method:'POST',headers:{Authorization:`Bearer ${operatorSecret}`,apikey:key,'content-type':'application/json'},
      body:JSON.stringify({userId:row.user_id,mode:'sync'}),signal:AbortSignal.timeout(45000),
    });
    const data=await response.json();
    result={ok:response.ok&&data.ok===true,status:response.status,...data,attempts:(results[row.user_id]?.attempts??0)+1,checkedAt:new Date().toISOString()};
  }catch{result={ok:false,error:'transport_failure',attempts:(results[row.user_id]?.attempts??0)+1,checkedAt:new Date().toISOString()};}
  results[row.user_id]=result;
  await writeFile(resultsPath,JSON.stringify(results,null,2),{mode:0o600});
  await appendFile(join(directory,'attempts.jsonl'),JSON.stringify({reference,...result})+'\n',{mode:0o600});
  processed++;
  if(processed%10===0)console.log(JSON.stringify({processed,ok:Object.values(results).filter(r=>r.ok).length,open:Object.values(results).filter(r=>!r.ok).length}));
  // Bound project load; transient failures remain open and are retried on rerun.
  await delay(result.error==='revenuecat_429'?30000:3000);
}
const counts={};
for(const result of Object.values(results)) {const category=result.ok?(result.tier??'none'):(result.error??'unverified');counts[category]=(counts[category]??0)+1;}
const {count,error}=await admin.from('lotti_subscription_entitlements').select('user_id',{count:'exact',head:true}).in('product_id',['entl7a7b4e9838','LottiBabyAbo']);
if(error)throw new Error('final_audit_failed');
const summary={project,total:snapshot.rows.length,processedThisRun:processed,successful:Object.values(results).filter(r=>r.ok).length,open:snapshot.rows.filter(r=>!results[r.user_id]?.ok).length,legacyRowsRemaining:count,counts,finishedAt:new Date().toISOString()};
await writeFile(join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(summary));
if(summary.open||count)process.exitCode=2;
