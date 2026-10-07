import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.PGLITE_PACKAGE || '@electric-sql/pglite');
const {QA,PROD,ORG,BRANCH,origin,oldSources,functions,stateSql,validateIdentity,validateNativeGate,validateSourceBaseline,validateReadyState,buildQaSql}=require('../prepare-deletion-qa-registry.cjs');
const sha=value=>createHash('sha256').update(value).digest('hex');
const owner='10000000-0000-4000-8000-000000000007';
const fixture={projectRef:QA,userId:owner};
const schedules=[{active:true,jobname:'account-deletion-alert-qa',schedule:'*/5 * * * *'},{active:false,jobname:'account-deletion-worker-qa',schedule:'* * * * *'}];
const secrets=[{name:'ACCOUNT_DELETION_ENABLED',value:sha('false')}];
const parent={id:PROD,organization_id:ORG};
const branch={id:BRANCH,project_ref:QA,parent_project_ref:PROD,name:'family-subscription-qa',is_default:false,preview_project_status:'ACTIVE_HEALTHY'};
async function setup(){
 const db=new PGlite();
 await db.exec(fs.readFileSync('supabase/tests/account_deletion_fixture.sql','utf8'));
 await db.exec('ALTER TABLE auth.identities ADD COLUMN id uuid DEFAULT gen_random_uuid(); CREATE SCHEMA cron; CREATE TABLE cron.job(jobid integer PRIMARY KEY,jobname text,schedule text,active boolean); CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);');
 const count=Number((await db.query("SELECT count(*) n FROM pg_tables WHERE schemaname='public' OR (schemaname='storage' AND tablename='objects')")).rows[0].n);
 for(let i=count;i<118;i++)await db.exec(`CREATE TABLE public.synthetic_guard_padding_${i}(id text)`);
 for(const [name] of oldSources){
  const sql=fs.readFileSync('supabase/migrations/'+name,'utf8');await db.exec(sql);
  if(name!==oldSources[0][0])await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,ARRAY[$3]::text[])',[name.slice(0,14),name.slice(15,-4),sql]);
 }
 await db.query('UPDATE deletion_private.settings SET storage_origin=$1',[origin]);
 await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'; UPDATE deletion_private.settings SET approved_by='synthetic native fixture',approved_at=now(),receipt_retention_days=90,backup_window_days=7; UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint()");
 for(let n=1;n<=7;n++){
  const uid='10000000-0000-4000-8000-'+String(n).padStart(12,'0');
  await db.query('INSERT INTO auth.users VALUES($1,now(),$2)',[uid,`synthetic${n}@example.invalid`]);
  await db.query('INSERT INTO public.profiles VALUES($1)',[uid]);
  await db.query("INSERT INTO auth.identities(user_id,provider,provider_id) VALUES($1::uuid,'email',($1::uuid)::text)",[uid]);
 }
 await db.query('INSERT INTO cron.job VALUES(1,$1,$2,$3),(2,$4,$5,$6)',[schedules[0].jobname,schedules[0].schedule,schedules[0].active,schedules[1].jobname,schedules[1].schedule,schedules[1].active]);
 const request=(await db.query("SELECT public.account_deletion_worker('accept',$1::jsonb) result",[JSON.stringify({userId:owner,scope:'account',source:'app'})])).rows[0].result;
 // Synthetic post-native shape only. No real identity or provider call.
 await db.query("UPDATE deletion_private.requests SET status='needs_attention',phase='providers',lease=NULL,lease_until=NULL WHERE id=$1",[request.requestId]);
 await db.query('DELETE FROM auth.identities WHERE user_id=$1',[owner]);await db.query('DELETE FROM auth.users WHERE id=$1',[owner]);
 await db.exec('UPDATE deletion_private.settings SET approved_fingerprint=NULL,approved_by=NULL,approved_at=NULL,receipt_retention_days=NULL,backup_window_days=NULL');
 const gate={requestId:request.requestId,userId:owner};
 const settings=(await db.query('SELECT to_jsonb(s) settings FROM deletion_private.settings s WHERE singleton')).rows[0].settings;
 const before={settings,schedules};
 const state=(await db.query(stateSql(gate))).rows[0];
 const functions_md5={}; const prosrc_md5={};
 for(const name of functions){
  functions_md5[name]=(await db.query('SELECT md5(pg_get_functiondef(to_regprocedure($1))) digest',[name])).rows[0].digest;
  prosrc_md5[name]=(await db.query('SELECT md5(prosrc) digest FROM pg_proc WHERE oid=to_regprocedure($1)',[name])).rows[0].digest;
 }
 const migration_history=(await db.query('SELECT version,name,md5(statements::text) "statementsMd5" FROM supabase_migrations.schema_migrations ORDER BY version')).rows;
 const baseline={parent,branch,migration_history,functions_md5,prosrc_md5,localSixMigrationBodiesMatch:true,guard_policies:118,guard_triggers:118,rules:136};
 const completedAt=new Date().toISOString();
 const worker={projectRef:QA,mode:'worker',passed:true,actualDeployedWorkerUsed:true,authAndProfileDeleted:true,ownFileDeleted:true,oldFreshTokenBlocked:true,controlAuthIdentitiesUnchanged:true,controlProfilesUnchanged:true,controlAuthProviderIdentitiesUnchanged:true,remainingAuthUsers:6,fullDeletionCompleted:false,finalRequestStatus:'needs_attention',requestId:gate.requestId,completedAt};
 const cleanup={...worker,baselineRestored:true,approvalAndRetentionRestored:true,temporaryFixtureRestrictionRemoved:true,deletionEnabled:false,authUsersAfterCleanup:6,objectsAfterCleanup:0,requestsAfterCleanup:1};
 return {db,gate,state,before,baseline,worker,cleanup};
}

test('only QA7/8 is registered atomically after native cleanup; pending case, controls, schedules and old history remain unchanged',async()=>{
 const {db,gate,state,before,baseline,worker,cleanup}=await setup();
 try{
  validateIdentity({projectRef:QA},parent,branch);validateNativeGate(worker,cleanup,fixture);validateSourceBaseline(baseline);validateReadyState(state,gate,before,secrets);
  const {sql}=buildQaSql(baseline,state,gate);await db.exec(sql);
  const after=(await db.query(stateSql(gate))).rows[0];
  for(const key of ['requests_md5','providers_md5','events_md5','objects_md5','auth_md5','identities_md5','profiles_md5','schedules_md5','old_history_md5'])assert.equal(after[key],state[key]);
  assert.equal(after.settings.provider_handling_mode,'unapproved');assert.equal(after.readiness,false);assert.equal(after.jobs[0].id,gate.requestId);assert.equal(after.jobs[0].status,'needs_attention');
  assert.deepEqual((await db.query("SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ('20261001122517','20261001124926') ORDER BY version")).rows.map(r=>r.version),['20261001122517','20261001124926']);
  assert.equal((await db.query("SELECT count(*)::int n FROM supabase_migrations.schema_migrations WHERE version='20260911065615'")).rows[0].n,0);
  assert.equal((await db.query('SELECT registry_acknowledged_at FROM deletion_private.requests')).rows[0].registry_acknowledged_at,null);
  await db.exec('SET ROLE service_role');const exported=(await db.query('SELECT public.account_deletion_registry_export() e')).rows[0].e;
  assert.equal(exported.entries.length,1);assert.equal(exported.entries[0].requestId,gate.requestId);assert.equal(exported.entries[0].userId,owner);
  await db.exec('RESET ROLE');
 }finally{await db.close();}
});

test('wrong parent/default branch and missing actual native worker/cleanup never pass the preparation gate',async()=>{
 const {db,worker,cleanup}=await setup();
 try{
  assert.throws(()=>validateIdentity({projectRef:PROD},parent,branch));
  assert.throws(()=>validateIdentity({projectRef:QA},{...parent,organization_id:'wrong'},branch));
  assert.throws(()=>validateIdentity({projectRef:QA},parent,{...branch,is_default:true}));
  assert.throws(()=>validateIdentity({projectRef:QA},parent,{...branch,id:'other'}));
  for(const bad of [{...worker,passed:false},{...worker,actualDeployedWorkerUsed:false},{...worker,fullDeletionCompleted:true}])assert.throws(()=>validateNativeGate(bad,cleanup,fixture));
  assert.throws(()=>validateNativeGate(worker,{...cleanup,authUsersAfterCleanup:7},fixture));
  assert.throws(()=>validateNativeGate(worker,{...cleanup,requestId:'10000000-0000-4000-8000-000000000999'},fixture));
 }finally{await db.close();}
});

test('source drift refuses QA7/8 before any new columns or history registration',async()=>{
 const {db,baseline,state,gate}=await setup();
 try{
  const {sql}=buildQaSql(baseline,state,gate);
  await db.exec("CREATE OR REPLACE FUNCTION public.account_deletion_readiness() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$");
  await assert.rejects(db.exec(sql),/qa_existing_function_changed/);await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='deletion_private' AND table_name='settings' AND column_name='provider_handling_mode'")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM supabase_migrations.schema_migrations WHERE version IN ('20261001122517','20261001124926')")).rows[0].n,0);
 }finally{await db.close();}
});

test('a changed native request/approval/control/scheduler state aborts without partial apply',async()=>{
 const {db,baseline,state,gate,before}=await setup();
 try{
  const {sql}=buildQaSql(baseline,state,gate);
  for(const change of ["UPDATE deletion_private.requests SET lease=gen_random_uuid(),lease_until=now()+interval '1 minute'","UPDATE deletion_private.settings SET approved_by='synthetic drift'","UPDATE cron.job SET active=true WHERE jobname='account-deletion-worker-qa'","UPDATE auth.users SET email='changed@example.invalid'"]){
   await db.exec('BEGIN');await db.exec(change);await db.exec('COMMIT');
   await assert.rejects(db.exec(sql),/qa_native_cleanup_state_changed|qa_preserved_state_changed/);await db.exec('ROLLBACK');
   assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='deletion_private' AND table_name='settings' AND column_name='provider_handling_mode'")).rows[0].n,0);
   // Restore this offline fixture only for the next independent guard case.
   await db.exec('UPDATE deletion_private.requests SET lease=NULL,lease_until=NULL; UPDATE deletion_private.settings SET approved_by=NULL; UPDATE cron.job SET active=false WHERE jobname=\'account-deletion-worker-qa\'');
   for(let n=1;n<=6;n++)await db.query('UPDATE auth.users SET email=$2 WHERE id=$1',['10000000-0000-4000-8000-'+String(n).padStart(12,'0'),`synthetic${n}@example.invalid`]);
  }
  assert.throws(()=>validateReadyState(state,gate,before,[{name:'ACCOUNT_DELETION_ENABLED',value:sha('true')}]),/disabled/);
 }finally{await db.close();}
});
