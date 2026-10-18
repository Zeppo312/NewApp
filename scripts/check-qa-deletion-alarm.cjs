// Exact QA target and fixed support recipient. No deletion or enablement.
const fs=require('node:fs');
async function main(){
 const mode=process.argv.slice(2).join(' ');
 if(!['--configuration-only','--send-approved'].includes(mode)) throw new Error('Choose configuration-only or an approved transport test.');
 const target=JSON.parse(fs.readFileSync('.family-qa/target.local.json','utf8'));
 if(target.projectRef!=='ggyonianphloycmqrwvj') throw new Error('Wrong QA target.');
 const secret=fs.readFileSync('.family-qa/account-deletion-functions.env.local','utf8').match(/^ACCOUNT_DELETION_CRON_SECRET=(.+)$/m)?.[1]?.trim();
 if(!secret || secret.length<32) throw new Error('Missing protected QA scheduler credential.');
 const endpoint=`https://${target.projectRef}.supabase.co/functions/v1/account-deletion-alert`;
 const request=async(key,body)=>{const response=await fetch(endpoint,{method:'POST',headers:{apikey:target.publicKey,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});return {status:response.status,body:await response.json()};};
 const anonymous=await request(target.publicKey,{test:true});
 const service=await request(secret,mode==='--send-approved'?{test:true}:{});
 const report={checkedAt:new Date().toISOString(),qaProject:target.projectRef,recipient:'support@lottibaby.de',mode,
  anonymousRejected:anonymous.status===401,serviceStatus:service.status,serviceResult:service.body,
  actualDeliveryVerified:false,deletionEnabledChanged:false};
 fs.writeFileSync(`output/deletion-completion-20260930/alarm-${mode==='--send-approved'?'smtp-test':'configuration'}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(!report.anonymousRejected || (mode==='--send-approved' && !(service.status===200 && service.body.sent===true))) process.exitCode=2;
}
main().catch(()=>{console.error('QA alarm check failed. No credentials logged.');process.exitCode=1;});
