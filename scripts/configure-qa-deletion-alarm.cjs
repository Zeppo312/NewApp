// Prepare one inactive QA alarm schedule; activate only after a received SMTP test.
// Existing deletion worker schedules and policy settings are never modified.
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
function main(){
 const mode=process.argv.slice(2).join(' ');
 if(!['--prepare-inactive','--activate-after-delivery'].includes(mode)) throw new Error('Explicit preparation or verified activation required.');
 const target=JSON.parse(fs.readFileSync('.family-qa/target.local.json','utf8'));
 if(target.projectRef!=='ggyonianphloycmqrwvj' || fs.readFileSync('.family-qa/workspace/supabase/.temp/project-ref','utf8').trim()!==target.projectRef) throw new Error('Wrong QA target.');
 const sqlFile=path.resolve('.family-qa/deletion-completion-20260930/alarm-schedule.local.sql');
 let sql;
 if(mode==='--activate-after-delivery'){
  const test=JSON.parse(fs.readFileSync('output/deletion-completion-20260930/alarm-smtp-test.json','utf8'));
  if(test.qaProject!==target.projectRef || !test.anonymousRejected || test.serviceStatus!==200 || test.serviceResult?.sent!==true || test.actualDeliveryVerified!==true) throw new Error('Actual SMTP inbox receipt is required.');
  sql="SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='account-deletion-alert-qa'),active=>true);";
 }else{
  sql=`BEGIN;
DO $guard$ BEGIN
 IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='supabase_url') IS DISTINCT FROM 'https://ggyonianphloycmqrwvj.supabase.co' THEN RAISE EXCEPTION 'wrong_alarm_target'; END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='account_deletion_cron_secret' AND length(decrypted_secret)>=32) THEN RAISE EXCEPTION 'alarm_scheduler_secret_missing'; END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='account-deletion-alert-qa' AND active) THEN RAISE EXCEPTION 'active_alarm_schedule_must_not_be_replaced'; END IF;
END $guard$;
SELECT cron.schedule('account-deletion-alert-qa','*/5 * * * *',$job$
 SELECT net.http_post(url:='https://ggyonianphloycmqrwvj.supabase.co/functions/v1/account-deletion-alert',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='account_deletion_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=45000);
$job$);
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='account-deletion-alert-qa'),active=>false);
COMMIT;`;
 }
 fs.writeFileSync(sqlFile,sql,{mode:0o600});
 try{execFileSync('supabase',['db','query','--linked','--workdir','.family-qa/workspace','--file',sqlFile,'-o','json'],{stdio:['ignore','ignore','ignore'],timeout:60000});}finally{fs.rmSync(sqlFile,{force:true});}
 const raw=execFileSync('supabase',['db','query','--linked','--workdir','.family-qa/workspace',"SELECT jobname,schedule,active FROM cron.job WHERE jobname IN ('account-deletion-alert-qa','account-deletion-worker-qa')",'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:60000});
 const report={checkedAt:new Date().toISOString(),qaProject:target.projectRef,mode,jobs:JSON.parse(raw).rows,deletionWorkerChanged:false};
 fs.writeFileSync('output/deletion-completion-20260930/alarm-scheduler.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
try{main();}catch{console.error('QA alarm scheduling failed; no credentials logged.');process.exitCode=1;}
