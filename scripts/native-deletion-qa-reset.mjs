// Explicit teardown of the sole untouched native QA trial; no worker/Auth/media deletion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {guardTarget,guardSchedules,guardUnprocessedReset,writeIndependentRegister,QA,PROD,ORG} from './native-deletion-qa.mjs';
const require=createRequire(import.meta.url);const {api}=require('./managed-deletion-restore.cjs');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const dir=path.join(root,'.family-qa/deletion-native-20261001');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
const save=(n,x)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(x,null,2)+'\n',{mode:0o600});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const lit=v=>`'${String(v).replaceAll("'","''")}'`;
const expected='a95b3989-e395-45c7-8286-366fdf1c2eed';
assert(process.argv.includes('--reset-unprocessed-approved'),'Explicit Root reset authorization required');
async function main(){
 const f=read('native-fixture-credentials.local.json'),s=read('native-storage-fixture.local.json'),b=read('native-qa-settings-before.local.json');
 assert.equal(f.projectRef,QA);assert.equal(f.email,'support@lottibaby.de');assert(/^[a-f0-9-]{36}$/.test(f.userId));
 const [projects,branches,secrets]=await Promise.all([api('/v1/projects'),api(`/v1/projects/${PROD}/branches`),api(`/v1/projects/${QA}/secrets`)]);
 guardTarget({projectRef:QA},projects.find(p=>p.id===PROD),branches.find(p=>p.project_ref===QA));
 assert.equal(secrets.find(s=>s.name==='ACCOUNT_DELETION_ENABLED')?.value,sha('false'));assert(!secrets.some(s=>s.name==='ACCOUNT_DELETION_QA_TEST_USER_ID'));
 const query=q=>api(`/v1/projects/${QA}/database/query`,'POST',{query:q,parameters:[],read_only:false});
 const snapshotQuery=`SELECT
  (SELECT to_jsonb(r) FROM deletion_private.requests r WHERE id=${lit(expected)}::uuid) request,
  (SELECT count(*) FROM deletion_private.requests)::integer requests,
  (SELECT count(*) FROM auth.users)::integer "authUsers",
  (SELECT count(*) FROM storage.objects)::integer "storageObjects",
  (SELECT exists(SELECT 1 FROM auth.users WHERE id=${lit(f.userId)}::uuid AND email='support@lottibaby.de' AND raw_user_meta_data->>'qa_disposable'='deletion-completion-20260930')) "fixtureMarked",
  (SELECT avatar_url FROM public.profiles WHERE id=${lit(f.userId)}::uuid) "fixtureProfileUrl",
  (SELECT jsonb_agg(jsonb_build_object('bucket_id',bucket_id,'name',name,'owner_id',owner_id,'owner',owner)) FROM storage.objects) objects,
  (SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM deletion_private.objects o WHERE request_id=${lit(expected)}::uuid) "caseObjects",
  (SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]') FROM deletion_private.events e WHERE request_id=${lit(expected)}::uuid) events,
  (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY provider),'[]') FROM deletion_private.provider_tasks p WHERE request_id=${lit(expected)}::uuid) providers,
  (SELECT to_jsonb(s) FROM deletion_private.settings s WHERE singleton) settings,
  deletion_private.fingerprint() fingerprint,
  (SELECT jsonb_agg(to_jsonb(j) ORDER BY jobname) FROM (SELECT jobname,schedule,active FROM cron.job WHERE jobname IN ('account-deletion-worker-qa','account-deletion-alert-qa')) j) schedules,
  (SELECT jsonb_agg(jsonb_build_object('id',id,'hash',md5(to_jsonb(u)::text)) ORDER BY id) FROM auth.users u WHERE id<>${lit(f.userId)}::uuid) "controlAuthHashes",
  (SELECT jsonb_agg(jsonb_build_object('id',id,'hash',md5(to_jsonb(p)::text)) ORDER BY id) FROM public.profiles p WHERE id<>${lit(f.userId)}::uuid) "controlProfileHashes"`;
 const snap=(await query(`BEGIN READ ONLY; ${snapshotQuery}; ROLLBACK;`))[0];guardUnprocessedReset(snap,f,expected,s);guardSchedules(snap.schedules,b.schedules);assert.equal(snap.fingerprint,b.fingerprint);
 save('native-initial-request-reset-before.local.json',snap);
 const register={projectRef:QA,requestId:expected,userId:f.userId,scope:'account',created_at:snap.request.created_at,purpose:'Disposable native QA only; not a production deletion registry'};
 const durable=writeIndependentRegister(`/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/native-20261001-${expected}-register.json`,register);
 const authClauses=snap.controlAuthHashes.map(x=>`NOT EXISTS(SELECT 1 FROM auth.users u WHERE id=${lit(x.id)}::uuid AND md5(to_jsonb(u)::text)=${lit(x.hash)})`).join(' OR ');
 const profileClauses=snap.controlProfileHashes.map(x=>`NOT EXISTS(SELECT 1 FROM public.profiles p WHERE id=${lit(x.id)}::uuid AND md5(to_jsonb(p)::text)=${lit(x.hash)})`).join(' OR ');
 const sql=`BEGIN;
 LOCK TABLE deletion_private.requests IN SHARE ROW EXCLUSIVE MODE;
 DO $guard$ BEGIN
  IF (SELECT count(*) FROM deletion_private.requests)<>1 OR NOT EXISTS(SELECT 1 FROM deletion_private.requests WHERE id=${lit(expected)}::uuid AND user_id=${lit(f.userId)}::uuid AND scope='account' AND source='app' AND status='queued' AND phase='inventory' AND attempts=0 AND lease IS NULL AND lease_until IS NULL AND completed_at IS NULL AND error_code IS NULL) THEN RAISE EXCEPTION 'unprocessed_own_trial_required';END IF;
  IF (SELECT count(*) FROM auth.users)<>7 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${lit(f.userId)}::uuid AND email='support@lottibaby.de' AND raw_user_meta_data->>'qa_disposable'='deletion-completion-20260930') THEN RAISE EXCEPTION 'auth_fixture_drift';END IF;
  IF (SELECT count(*) FROM storage.objects)<>1 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=${lit(s.bucket)} AND name=${lit(s.path)} AND coalesce(owner_id,owner::text,'')='') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=${lit(f.userId)}::uuid AND avatar_url=${lit(s.publicUrl)}) THEN RAISE EXCEPTION 'file_fixture_drift';END IF;
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='account-deletion-worker-qa' AND active) OR NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='account-deletion-alert-qa' AND active) THEN RAISE EXCEPTION 'scheduler_drift';END IF;
  IF EXISTS(SELECT 1 FROM deletion_private.objects WHERE request_id=${lit(expected)}::uuid) OR EXISTS(SELECT 1 FROM deletion_private.events WHERE request_id=${lit(expected)}::uuid) OR (SELECT count(*) FROM deletion_private.provider_tasks WHERE request_id=${lit(expected)}::uuid)<>12 OR EXISTS(SELECT 1 FROM deletion_private.provider_tasks WHERE request_id=${lit(expected)}::uuid AND (status<>'pending' OR resolved_by IS NOT NULL OR evidence IS NOT NULL OR due_at IS NOT NULL)) THEN RAISE EXCEPTION 'worker_or_provider_already_ran';END IF;
  IF deletion_private.fingerprint()<>${lit(b.fingerprint)} OR EXISTS(SELECT 1 FROM deletion_private.settings WHERE approved_fingerprint IS NOT NULL OR approved_by IS NOT NULL OR approved_at IS NOT NULL OR receipt_retention_days IS NOT NULL OR backup_window_days IS NOT NULL) THEN RAISE EXCEPTION 'readiness_drift';END IF;
  IF ${authClauses||'false'} OR ${profileClauses||'false'} THEN RAISE EXCEPTION 'control_data_drift';END IF;
 END $guard$;
 DELETE FROM deletion_private.requests WHERE id=${lit(expected)}::uuid RETURNING id;
 COMMIT;`;
 const removed=await query(sql);assert.equal(removed.length,1);assert.equal(removed[0].id,expected);
 const after=(await query(`BEGIN READ ONLY; ${snapshotQuery}; ROLLBACK;`))[0];assert.equal(after.requests,0);assert.equal(after.authUsers,7);assert.equal(after.storageObjects,1);assert.equal(after.fixtureMarked,true);assert.equal(after.fixtureProfileUrl,s.publicUrl);assert.deepEqual(after.controlAuthHashes,snap.controlAuthHashes);assert.deepEqual(after.controlProfileHashes,snap.controlProfileHashes);guardSchedules(after.schedules,b.schedules);save('native-initial-request-reset-after.local.json',after);
 const report={checkedAt:new Date().toISOString(),projectRef:QA,fixtureUserId:f.userId,deletedRequestId:expected,scope:'account',originalSource:'app',originalStatus:'queued',originalPhase:'inventory',originalAttempts:0,noWorkerOrDestructivePhaseRun:true,ownUnprocessedQaTrialOnly:true,requestRemoved:true,notMarkedCompleted:true,requestArchiveSha256:sha(fs.readFileSync(path.join(dir,'native-initial-request-reset-before.local.json'))),independentRegister:durable,originalLegacyRegisterPreserved:true,authUsers:7,controlAuthCount:6,controlAuthUnchanged:true,controlProfilesUnchanged:true,profileAndFilePreserved:true,storageObjects:1,requestsAfter:0,readinessRestoredDisabled:true,workerCronInactive:true,alarmCronActive:true,productionChanged:false};
 fs.writeFileSync(path.join(root,'output/deletion-completion-20260930/native-initial-request-reset-20261001.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(JSON.stringify({failed:true,error:e.message,noCredentialsLogged:true}));process.exitCode=1;});
