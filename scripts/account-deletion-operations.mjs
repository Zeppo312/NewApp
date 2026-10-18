/** Server-side operator utility. Secrets are read from environment, never args.
 * node scripts/account-deletion-operations.mjs list
 * node scripts/account-deletion-operations.mjs resolve <request-id> <provider> <completed|not_applicable|retention_pending> <evidence-file> <operator> [due-at]
 * node scripts/account-deletion-operations.mjs resume <request-id> <evidence-file> <operator>
 * node scripts/account-deletion-operations.mjs support <user-id> <account|data> <identity-evidence-file> <operator>
 */
import fs from 'node:fs';
const [command,id,provider,status,file,operator,dueAt] = process.argv.slice(2);
const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be supplied through the environment.');process.exit(1);}
const uuid=/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let action;let payload;
if(command==='list'){action='list';payload={};}
else if(command==='resolve'&&uuid.test(id)&&['completed','not_applicable','retention_pending'].includes(status)&&file&&operator){
 const evidence=fs.readFileSync(file,'utf8').trim();if(evidence.length<8||evidence.length>2000)throw new Error('Evidence must contain 8–2000 characters, without personal content or credentials.');
 if(status==='retention_pending'&&(!dueAt||!Number.isFinite(Date.parse(dueAt))))throw new Error('An explicit retention deadline is required.');
 action='resolve_provider';payload={requestId:id,provider,status,evidence,operator,dueAt:dueAt??null};
}else if(command==='resume'&&uuid.test(id)&&provider&&status){action='resume';payload={requestId:id,evidence:fs.readFileSync(provider,'utf8').trim(),operator:status};}
else if(command==='support'&&uuid.test(id)&&['account','data'].includes(provider)&&status&&file){
 action='accept';payload={userId:id,scope:provider,source:'support',evidence:fs.readFileSync(status,'utf8').trim(),operator:file};
}
else{console.error('See usage at the top of this file.');process.exit(1);}
const response=await fetch(`${url}/rest/v1/rpc/account_deletion_worker`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
if(!response.ok){console.error(`Operation failed (${response.status}); inspect the restricted backend logs.`);process.exit(1);}
console.log(JSON.stringify(await response.json(),null,2));
