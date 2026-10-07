// One existing, marked family-QA identity; no account/project creation or cron enablement.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
export const QA = 'ggyonianphloycmqrwvj';
export const PROD = 'kwniiyayhzgjfqjsjcfu';
export const ORG = 'xqbmotyjxjdeqoisbgow';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const privateDir = path.join(root, '.family-qa/deletion-native-20261001');
const outputDir = path.join(root, 'output/deletion-completion-20260930');
const origin = `https://${QA}.supabase.co`;
const independentRegisterPath='/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/native-20261001-register.json';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(privateDir, name), 'utf8'));
const savePrivate = (name, value) => fs.writeFileSync(path.join(privateDir, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const saveReport = (name, value) => fs.writeFileSync(path.join(outputDir, name), JSON.stringify(value, null, 2) + '\n');
const literal = value => value === null || value === undefined ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const same = isDeepStrictEqual;
export function guardTarget(target, project, branch) {
  assert.equal(target.projectRef, QA, 'Exact family QA required');
  assert.equal(project.id, PROD, 'Verified parent project required');
  assert.equal(project.organization_id, ORG, 'Wrong management account');
  assert.equal(branch.project_ref, QA, 'Wrong branch');
  assert.equal(branch.parent_project_ref, PROD, 'Wrong parent');
  assert.equal(branch.name, 'family-subscription-qa', 'Existing named family QA required');
  assert.equal(branch.is_default, false, 'Default/production branch refused');
}
export function guardJobs(jobs, userId, allowEmpty = true) {
  assert(Array.isArray(jobs) && jobs.length <= 1, 'Only one fixture request allowed');
  if (!allowEmpty) assert.equal(jobs.length, 1, 'Native request missing');
  for (const job of jobs) {
    assert.equal(job.user_id, userId, 'Nonfixture deletion request refused');
    assert.equal(job.scope, 'account', 'Only account deletion test allowed');
    assert.equal(job.source, 'app', 'Actual native acceptance required');
  }
}
export function guardSchedules(schedules, baseline) {
  assert(same([...schedules].sort((a,b)=>a.jobname.localeCompare(b.jobname)), [...baseline].sort((a,b)=>a.jobname.localeCompare(b.jobname))), 'Scheduler baseline changed');
  assert(schedules.some(s => s.jobname === 'account-deletion-worker-qa' && s.active === false), 'Worker cron must remain inactive');
  assert(schedules.some(s => s.jobname === 'account-deletion-alert-qa' && s.active === true), 'Existing alarm must remain active');
}
export function guardAcceptances(evidence, fixture, job, resetProof = null) {
  assert.equal(evidence.projectRef, QA); assert.equal(evidence.userId, fixture.userId);
  assert.equal(evidence.requestId, job.id, 'Both devices must report the same request');
  assert.equal(evidence.scope, 'account');
  assert.equal(evidence.devices?.length, 2, 'Two physical acceptances required');
  assert.deepEqual(evidence.devices.map(d => d.platform).sort(), ['android', 'ios']);
  for (const device of evidence.devices) {
    assert.equal(device.accepted, true);
    if(evidence.testMode!=='sequential_same_fixture_native_trials')assert.equal(device.requestId, job.id);
    assert.equal(device.nativeMailCodeVerified, true, 'Real native mail verification required');
    const deviceProof=device.evidence;
    assert(typeof deviceProof === 'string' && deviceProof.length > 8, 'Device proof missing');
  }
  if(evidence.testMode==='sequential_same_fixture_native_trials') {
    const android=evidence.devices.find(d=>d.platform==='android'),ios=evidence.devices.find(d=>d.platform==='ios');
    assert.equal(ios.requestId,job.id);assert.notEqual(android.requestId,ios.requestId,'Separate actual trials required');
    assert.equal(resetProof?.projectRef,QA);assert.equal(resetProof?.fixtureUserId,fixture.userId);assert.equal(resetProof?.deletedRequestId,android.requestId);
    for(const field of ['noWorkerOrDestructivePhaseRun','ownUnprocessedQaTrialOnly','requestRemoved','notMarkedCompleted','controlAuthUnchanged','controlProfilesUnchanged','profileAndFilePreserved','readinessRestoredDisabled','workerCronInactive'])assert.equal(resetProof?.[field],true,`Reset proof missing: ${field}`);
    assert.equal(resetProof.scope,'account');assert.equal(resetProof.originalSource,'app');
    assert.equal(resetProof.originalStatus,'queued');assert.equal(resetProof.originalPhase,'inventory');assert.equal(resetProof.originalAttempts,0);assert.equal(resetProof.authUsers,7);assert.equal(resetProof.storageObjects,1);assert.equal(resetProof.requestsAfter,0);
  }
}
function verifyNativeReceiptFiles(evidence) {
  for(const device of evidence.devices) {
    const candidates=[path.resolve(root,device.evidence),path.resolve(privateDir,device.evidence)];
    const file=candidates.find(candidate=>candidate.startsWith(privateDir+path.sep) && fs.existsSync(candidate));
    assert(file,'Actual private native receipt file missing');
    assert(fs.readFileSync(file,'utf8').includes(device.requestId),'Native receipt file lacks its actual request ID');
  }
}
export function guardStorage(manifest, fixture, objects, profileUrl = null) {
  assert.equal(manifest.projectRef, QA); assert.equal(manifest.userId, fixture.userId);
  assert.equal(manifest.bucket, 'community-images');
  assert([`avatars/avatar_${fixture.userId}_native-deletion-20261001.txt`, `avatars/avatar_${fixture.userId}_native-deletion-20261001.png`].includes(manifest.path), 'Exact marked own fixture path required');
  assert.equal(objects.length, 1, 'Exactly one own file fixture required');
  assert.equal(objects[0].bucket_id, manifest.bucket); assert.equal(objects[0].name, manifest.path);
  const owner=objects[0].owner_id ?? objects[0].owner;
  if(owner!==fixture.userId) {
    assert(owner===null || owner===undefined, 'Foreign storage owner refused');
    assert.equal(manifest.ownership, 'verified-profile-avatar-url');
    const expected=`https://${QA}.supabase.co/storage/v1/object/public/${manifest.bucket}/${manifest.path}`;
    assert.equal(manifest.publicUrl,expected);assert.equal(profileUrl,expected,'Exact fixture profile association required');
  }
}
export function writeIndependentRegister(file, job) {
  assert.equal(job.projectRef,QA,'QA-only register required');assert.equal(job.scope,'account');
  const bytes=Buffer.from(JSON.stringify(job,null,2)+'\n');
  const directory=path.dirname(file);fs.mkdirSync(directory,{recursive:true,mode:0o700});
  assert(!fs.lstatSync(directory).isSymbolicLink(),'Registry directory symlink refused');
  if(fs.existsSync(file)) {
    assert(!fs.lstatSync(file).isSymbolicLink(),'Registry file symlink refused');
    assert(same(JSON.parse(fs.readFileSync(file,'utf8')),job),'Independent register must not be overwritten');
    assert.equal(fs.statSync(file).mode & 0o777,0o600,'Existing private register permissions changed');
  } else {
    const temporary=path.join(directory,`.native-deletion-register-${crypto.randomUUID()}.tmp`);
    const fd=fs.openSync(temporary,'wx',0o600);
    try {fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    try {fs.linkSync(temporary,file);}finally{fs.rmSync(temporary,{force:true});}
    const directoryFd=fs.openSync(directory,'r');try{fs.fsyncSync(directoryFd);}finally{fs.closeSync(directoryFd);}
  }
  const persisted=fs.readFileSync(file);assert(persisted.equals(bytes),'Independent register readback mismatch');
  assert.equal(fs.statSync(file).mode & 0o777,0o600);
  return {path:file,sha256:digest(persisted),bytes:persisted.length,mode:'0600',readbackVerified:true};
}
async function revalidateLiveSources(api, source) {
  const metadata=await api(`/v1/projects/${QA}/functions`);
  const current=Object.fromEntries(Object.keys(source.functions).map(slug=>[slug,metadata.find(f=>f.slug===slug)?.version]));
  if(same(current,source.functions))return source;
  const previous={...source.functions};
  for(const [slug,tree] of [['request-account-deletion','native-intake-live'],['process-account-deletion','native-worker-live']]) {
    execFileSync('supabase',['--workdir',path.join(privateDir,tree),'functions','download',slug,'--project-ref',QA,'--use-api','--yes'],{stdio:'ignore',timeout:45000});
  }
  for(const f of source.files){const live=fs.readFileSync(path.join(privateDir,f.tree,f.file));assert.equal(digest(live),f.sha256,'Live source changed');assert(live.equals(fs.readFileSync(path.join(root,f.file))),'Live source/root differ');}
  const after=await api(`/v1/projects/${QA}/functions`);
  const stable=Object.fromEntries(Object.keys(source.functions).map(slug=>[slug,after.find(f=>f.slug===slug)?.version]));assert(same(stable,current),'Version changed during source verification');
  source.functions=current;source.refreshedAt=new Date().toISOString();savePrivate('native-backend-source-manifest.local.json',source);
  const name='native-backend-source-refresh-20261001.json',file=path.join(outputDir,name);const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
  saveReport(name,{checkedAt:source.refreshedAt,projectRef:QA,previousVersions:previous,currentVersions:current,filesChecked:source.files.length,allDownloadedFilesMatchPreviousAndRoot:true,sourceChanges:false,possibleCause:'Secret updates may have changed revision metadata; inference only, not independently established',productionChanged:false,history:old?[...(old.history??[]),{checkedAt:old.checkedAt,previousVersions:old.previousVersions,currentVersions:old.currentVersions}]:[]});return source;
}
export async function main(mode, flags = []) {
  assert(['status', 'register', 'prepare-file', 'prepare-enable', 'rearm-worker', 'worker', 'restore-baseline'].includes(mode), 'Use status, register, prepare-file, prepare-enable, worker or restore-baseline');
  const { api } = require('./managed-deletion-restore.cjs'); // API helper only; never run its restore main.
  const target = JSON.parse(fs.readFileSync(path.join(root, '.family-qa/target.local.json')));
  const fixture = read('native-fixture-credentials.local.json');
  const marker = JSON.parse(fs.readFileSync(path.join(root, '.family-qa/deletion-completion-20260930/otp-account.json')));
  assert.equal(fixture.projectRef, QA); assert.equal(fixture.userId, marker.userId);
  assert.equal(fixture.email, 'support@lottibaby.de'); assert.equal(marker.email, fixture.email);
  const before = read('native-qa-settings-before.local.json');
  assert.equal(before.projectRef, QA); assert.equal(before.requests, 0);
  const query = async sql => api(`/v1/projects/${QA}/database/query`, 'POST', { query: sql, parameters: [], read_only: false });
  const readonly = sql => query(`BEGIN READ ONLY; ${sql}; ROLLBACK;`);
  const [projects, branches] = await Promise.all([api('/v1/projects'), api(`/v1/projects/${PROD}/branches`)]);
  guardTarget(target, projects.find(p => p.id === PROD), branches.find(b => b.project_ref === QA));
  const admin = createClient(origin, target.serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})} });
  const state = async () => (await readonly(`SELECT
    (SELECT to_jsonb(s) FROM deletion_private.settings s WHERE singleton) settings,
    deletion_private.fingerprint() fingerprint,
    (SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY jobname),'[]') FROM (SELECT jobname,schedule,active FROM cron.job WHERE jobname IN ('account-deletion-worker-qa','account-deletion-alert-qa')) j) schedules,
    (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY created_at),'[]') FROM (SELECT id,user_id,scope,source,status,phase,error_code,lease_until,created_at,next_attempt_at,attempts FROM deletion_private.requests) r) jobs,
    (SELECT count(*) FROM auth.users) auth_users,
    (SELECT count(*) FROM storage.objects) objects,
    (SELECT count(*) FROM pg_roles WHERE rolname='authenticator' AND 'pgrst.db_pre_request=public.check_account_deletion_access'=ANY(rolconfig)) hook_installed`))[0];
  let report={mode,checkedAt:new Date().toISOString(),projectRef:QA,productionChanged:false,newAuthAccountsCreated:false,newProjectsCreated:false};
  let lifecycle = fs.existsSync(path.join(privateDir,'native-backend-lifecycle.local.json')) ? read('native-backend-lifecycle.local.json') : null;
  const cleanup = async () => {
    report.cleanupAttempted=true;
    // Disable endpoint first, then restore SQL settings, finally remove only our restriction.
    await api(`/v1/projects/${QA}/secrets`, 'POST', [{name:'ACCOUNT_DELETION_ENABLED',value:'false'}]);
    const s=before.settings;
    await query(`BEGIN;
      UPDATE deletion_private.settings SET approved_fingerprint=${literal(s.approved_fingerprint)},approved_by=${literal(s.approved_by)},approved_at=${literal(s.approved_at)}::timestamptz,storage_origin=${literal(s.storage_origin)},receipt_retention_days=${literal(s.receipt_retention_days)},backup_window_days=${literal(s.backup_window_days)} WHERE singleton; COMMIT;`);
    const scopedSecrets=await api(`/v1/projects/${QA}/secrets`);
    const scope=scopedSecrets.find(s=>s.name==='ACCOUNT_DELETION_QA_TEST_USER_ID');
    if(scope){assert.equal(scope.value,digest(fixture.userId),'Unknown restriction must not be removed');await api(`/v1/projects/${QA}/secrets`, 'DELETE', ['ACCOUNT_DELETION_QA_TEST_USER_ID']);}
    const restored = await state(); const afterSecrets = await api(`/v1/projects/${QA}/secrets`);
    assert(same(restored.settings,before.settings), 'Settings restoration mismatch'); guardSchedules(restored.schedules,before.schedules);
    report.authUsersAfterCleanup=Number(restored.auth_users);report.requestsAfterCleanup=restored.jobs.length;report.objectsAfterCleanup=Number(restored.objects);
    assert.equal(afterSecrets.find(s=>s.name==='ACCOUNT_DELETION_ENABLED')?.value,digest('false'));
    assert(!afterSecrets.some(s=>s.name==='ACCOUNT_DELETION_QA_TEST_USER_ID'));
    lifecycle ??= {projectRef:QA}; lifecycle.restoredAt=new Date().toISOString(); lifecycle.enabled=false;
    savePrivate('native-backend-lifecycle.local.json',lifecycle);
    report.baselineRestored=true;report.deletionEnabled=false;report.approvalAndRetentionRestored=true;report.temporaryFixtureRestrictionRemoved=true;
    saveReport('native-backend-cleanup-20261001.json',report);
  };
  if (mode === 'restore-baseline') { await cleanup(); return report; }
  try {
  const nowState = await state();
  guardSchedules(nowState.schedules, before.schedules); guardJobs(nowState.jobs, fixture.userId);
  assert.equal(Number(nowState.hook_installed), 1, 'Access guard missing');
  const source = read('native-backend-source-manifest.local.json');
  assert.equal(source.projectRef, QA);
  for (const file of source.files) assert.equal(digest(fs.readFileSync(path.join(root, file.file))), file.sha256, 'Checked function source changed');
  await revalidateLiveSources(api,source);
  const stableUser = u => ({ id:u.id,email:u.email,phone:u.phone,created_at:u.created_at,app_metadata:u.app_metadata,user_metadata:u.user_metadata,identities:(u.identities ?? []).map(i=>({id:i.id,provider:i.provider,provider_id:i.provider_id,user_id:i.user_id})).sort((a,b)=>a.id.localeCompare(b.id)) });
  const originalUsers = read('native-control-users-before.local.json');
  assert.equal(originalUsers.length, 7);
  const originals = originalUsers.filter(u => u.id !== fixture.userId).map(stableUser).sort((a,b)=>a.id.localeCompare(b.id));
  assert.equal(originals.length, 6);
  const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  assert(!usersResult.error, 'Auth lookup failed');
  const users = usersResult.data.users;
  const controls = users.filter(u=>u.id!==fixture.userId).map(stableUser).sort((a,b)=>a.id.localeCompare(b.id));
  assert(same(controls, originals), 'Six control identities changed');
  const secrets = await api(`/v1/projects/${QA}/secrets`);
  const secretIs = (name, value) => secrets.find(s => s.name === name)?.value === digest(value);
  report = { mode, checkedAt: new Date().toISOString(), projectRef:QA, productionChanged:false, newAuthAccountsCreated:false, newProjectsCreated:false, controlAuthIdentitiesUnchanged:true, controlAuthCount:6, workerCronInactive:true, alarmCronActive:true, requests:nowState.jobs.length, authUsers:Number(nowState.auth_users), objects:Number(nowState.objects), deployedFunctions:source.functions };
  const fixtureUser = users.find(u=>u.id===fixture.userId);
  if (mode === 'status') {
    if (!nowState.jobs.length) {
      assert(fixtureUser?.user_metadata?.qa_disposable === 'deletion-completion-20260930', 'Marked fixture missing');
      assert.equal(fixtureUser.email, fixture.email); assert.equal(users.length, 7);
    }
    report.availableFlag = secretIs('ACCOUNT_DELETION_ENABLED','true');
    report.fixtureRestrictionPresent = secretIs('ACCOUNT_DELETION_QA_TEST_USER_ID',fixture.userId);
    report.settingsApproved = nowState.settings.approved_fingerprint === nowState.fingerprint;
    report.jobStatus = nowState.jobs[0]?.status ?? null; report.jobPhase = nowState.jobs[0]?.phase ?? null;
    saveReport('native-backend-status-20261001.json',report); return report;
  }
  const registerActualJob = () => {
    guardJobs(nowState.jobs,fixture.userId,false);const job=nowState.jobs[0];
    const entry={projectRef:QA,requestId:job.id,userId:fixture.userId,scope:job.scope,created_at:job.created_at,purpose:'Disposable native QA only; not a production deletion registry'};
    assert(Date.parse(entry.created_at)<=Date.now(),'Actual request creation timestamp required');
    report.independentRegister=writeIndependentRegister(`/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/native-20261001-${job.id}-register.json`,entry);report.productionRegistry=false;
    saveReport('native-independent-register-20261001.json',{checkedAt:new Date().toISOString(),projectRef:QA,requestId:job.id,entryCount:1,...report.independentRegister,productionRegistry:false,noControlUserDataExported:true});
  };
  if(mode==='register'){registerActualJob();return report;}
  if(mode==='prepare-file') {
    assert(flags.includes('--fixture-file-approved'),'Root must approve the sole marked file');
    assert.equal(nowState.jobs.length,0);assert.equal(Number(nowState.objects),0);assert(secretIs('ACCOUNT_DELETION_ENABLED','false'));
    assert.equal(fixtureUser?.user_metadata?.qa_disposable,'deletion-completion-20260930');assert.equal(fixtureUser.email,fixture.email);
    assert(!fs.existsSync(path.join(privateDir,'native-storage-fixture.local.json')),'Fixture file already registered; never duplicate');
    const profiles=await readonly(`SELECT id,avatar_url FROM public.profiles WHERE id=${literal(fixture.userId)}::uuid`);
    assert.equal(profiles.length,1);assert(!profiles[0].avatar_url,'Existing avatar must not be replaced');
    savePrivate('native-storage-profile-before.local.json',profiles[0]);
    const storage={projectRef:QA,userId:fixture.userId,bucket:'community-images',path:`avatars/avatar_${fixture.userId}_native-deletion-20261001.png`,ownership:'verified-profile-avatar-url'};
    storage.publicUrl=`${origin}/storage/v1/object/public/${storage.bucket}/${storage.path}`;
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
    let uploaded=false,profileSet=false;
    try {
      const created=await admin.storage.from(storage.bucket).upload(storage.path,bytes,{contentType:'image/png',cacheControl:'3600',upsert:false});if(created.error){savePrivate('native-storage-upload-error.local.json',{name:created.error.name,statusCode:created.error.statusCode,message:created.error.message});throw Error('Marked fixture upload failed');}uploaded=true;
      const updated=await query(`UPDATE public.profiles SET avatar_url=${literal(storage.publicUrl)} WHERE id=${literal(fixture.userId)}::uuid AND coalesce(avatar_url,'')='' RETURNING id,avatar_url`);
      assert.equal(updated.length,1);profileSet=true;
      const objects=await readonly('SELECT bucket_id,name,owner_id,owner FROM storage.objects');guardStorage(storage,fixture,objects,updated[0].avatar_url);
      const publicFile=await fetch(storage.publicUrl,{signal:AbortSignal.timeout(15000)});assert.equal(publicFile.status,200);assert.equal(digest(Buffer.from(await publicFile.arrayBuffer())),digest(bytes));
      storage.sha256=digest(bytes);storage.bytes=bytes.length;storage.publicStatus=200;storage.preparedAt=new Date().toISOString();savePrivate('native-storage-fixture.local.json',storage);
      report.ownMarkedStorageFixturePrepared=true;report.publicFileStatus=200;report.fileSha256=storage.sha256;report.fileBytes=bytes.length;report.verifiedProfileAssociation=true;report.objectsAfter=1;report.storageRlsChanged=false;report.storageOwnerMetadataChanged=false;
      saveReport('native-storage-fixture-20261001.json',report);return report;
    } catch(error) {
      if(profileSet) await query(`UPDATE public.profiles SET avatar_url=${literal(profiles[0].avatar_url)} WHERE id=${literal(fixture.userId)}::uuid AND avatar_url=${literal(storage.publicUrl)}`);
      if(uploaded)await admin.storage.from(storage.bucket).remove([storage.path]);throw error;
    }
  }
  if (mode === 'prepare-enable' || mode === 'rearm-worker') {
    const rearm=mode==='rearm-worker';
    if(rearm){
      assert(flags.includes('--final-worker-rearm-approved'),'Root must explicitly approve rearm after verified zero-phase failure');
      guardJobs(nowState.jobs,fixture.userId,false);assert.equal(nowState.jobs[0].status,'queued');assert.equal(nowState.jobs[0].phase,'inventory');assert.equal(nowState.jobs[0].attempts,0);assert.equal(nowState.jobs[0].lease_until,null);
      const evidence=read('native-acceptances.local.json');const reset=JSON.parse(fs.readFileSync(path.join(outputDir,'native-initial-request-reset-20261001.json')));guardAcceptances(evidence,fixture,nowState.jobs[0],reset);
      verifyNativeReceiptFiles(evidence);
      assert.equal(digest(fs.readFileSync(path.join(privateDir,'native-initial-request-reset-before.local.json'))),reset.requestArchiveSha256);
      report.rearmWithoutNewAcceptance=true;report.existingFinalRequestId=nowState.jobs[0].id;
    }else{
      assert(flags.includes('--native-clients-ready'), 'Root must confirm both native clients ready');assert.equal(nowState.jobs.length,0,'Never reset an existing native job');
    }
    assert.equal(users.length,7); assert.equal(fixtureUser?.user_metadata?.qa_disposable,'deletion-completion-20260930');
    assert.equal(fixtureUser.email,fixture.email);
    assert(same(nowState.settings,before.settings),'Settings baseline drift');
    assert.equal(nowState.fingerprint,before.fingerprint,'Schema/rules baseline drift');
    assert(secretIs('ACCOUNT_DELETION_ENABLED','false'),'Disabled baseline required');
    assert(!secrets.some(s=>s.name==='ACCOUNT_DELETION_QA_TEST_USER_ID'),'Existing restriction must not be overwritten');
    const storage = read('native-storage-fixture.local.json');
    const objects=await readonly('SELECT bucket_id,name,owner_id,owner FROM storage.objects');
    const fixtureProfile=(await readonly(`SELECT avatar_url FROM public.profiles WHERE id=${literal(fixture.userId)}::uuid`))[0]; guardStorage(storage,fixture,objects,fixtureProfile?.avatar_url);
    await readonly(`SELECT deletion_private.preflight(${literal(fixture.userId)}::uuid)`);
    const profileRows = await readonly(`SELECT id,md5(to_jsonb(p)::text) row_hash FROM public.profiles p WHERE id<>${literal(fixture.userId)}::uuid ORDER BY id`);
    const controlAuthIdentityRows=await readonly(`SELECT id,user_id,provider,provider_id,md5(to_jsonb(i)::text) row_hash FROM auth.identities i WHERE user_id<>${literal(fixture.userId)}::uuid ORDER BY id`);
    const identityProviders=(await readonly(`SELECT provider FROM auth.identities WHERE user_id=${literal(fixture.userId)}::uuid ORDER BY provider`)).map(i=>i.provider); assert.deepEqual(identityProviders,['email']);
    if(rearm) {
      assert(same(profileRows,lifecycle.controlProfiles),'Control profiles changed before rearm');
      assert(same(controlAuthIdentityRows,lifecycle.controlAuthIdentityRows),'Control identity rows changed before rearm');
      const caseState=(await readonly(`SELECT (SELECT to_jsonb(r) FROM deletion_private.requests r WHERE id=${literal(nowState.jobs[0].id)}::uuid) request,
        (SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM deletion_private.objects o WHERE request_id=${literal(nowState.jobs[0].id)}::uuid) case_objects,
        (SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]') FROM deletion_private.events e WHERE request_id=${literal(nowState.jobs[0].id)}::uuid) events,
        (SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM deletion_private.provider_tasks p WHERE request_id=${literal(nowState.jobs[0].id)}::uuid) providers`))[0];
      guardUnprocessedReset({requests:nowState.jobs.length,authUsers:Number(nowState.auth_users),storageObjects:Number(nowState.objects),request:caseState.request,fixtureMarked:true,fixtureProfileUrl:fixtureProfile.avatar_url,objects,caseObjects:caseState.case_objects,events:caseState.events,providers:caseState.providers,settings:nowState.settings},fixture,nowState.jobs[0].id,storage);
      report.noWorkerOrDestructivePhaseBeforeRearm=true;
    }
    lifecycle={projectRef:QA,fixtureUserId:fixture.userId,preparedAt:new Date().toISOString(),enabled:false,controlProfiles:profileRows,controlAuthIdentityRows,storage,fixtureAuthProviders:identityProviders,source};
    savePrivate('native-backend-lifecycle.local.json',lifecycle);
    try {
      await api(`/v1/projects/${QA}/secrets`,'POST',[{name:'ACCOUNT_DELETION_QA_TEST_USER_ID',value:fixture.userId}]);
      await query(`BEGIN; DO $guard$ BEGIN
        IF (SELECT count(*) FROM deletion_private.requests)<>${rearm?1:0} OR (SELECT count(*) FROM auth.users)<>7 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${literal(fixture.userId)}::uuid AND email='support@lottibaby.de' AND raw_user_meta_data->>'qa_disposable'='deletion-completion-20260930') THEN RAISE EXCEPTION 'native_fixture_guard'; END IF;
        IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='account-deletion-worker-qa' AND active) THEN RAISE EXCEPTION 'worker_cron_active'; END IF;
        ${rearm?`IF NOT EXISTS(SELECT 1 FROM deletion_private.requests WHERE id=${literal(nowState.jobs[0].id)}::uuid AND user_id=${literal(fixture.userId)}::uuid AND scope='account' AND source='app' AND status='queued' AND phase='inventory' AND attempts=0 AND lease IS NULL AND lease_until IS NULL AND completed_at IS NULL AND error_code IS NULL) OR EXISTS(SELECT 1 FROM deletion_private.objects) OR EXISTS(SELECT 1 FROM deletion_private.events) OR (SELECT count(*) FROM deletion_private.provider_tasks)<>12 OR EXISTS(SELECT 1 FROM deletion_private.provider_tasks WHERE request_id<>${literal(nowState.jobs[0].id)}::uuid OR status<>'pending' OR resolved_by IS NOT NULL OR evidence IS NOT NULL OR due_at IS NOT NULL) THEN RAISE EXCEPTION 'native_rearm_zero_phase_guard'; END IF;`:''}
      END $guard$;
      UPDATE deletion_private.settings SET approved_by='native QA fixture only; no production approval',approved_at=now(),receipt_retention_days=90,backup_window_days=7 WHERE singleton;
      UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint() WHERE singleton; COMMIT;`);
      await api(`/v1/projects/${QA}/secrets`,'POST',[{name:'ACCOUNT_DELETION_ENABLED',value:'true'}]);
      await revalidateLiveSources(api,source);lifecycle.source=source;
      lifecycle.enabled=true; lifecycle.enabledAt=new Date().toISOString();savePrivate('native-backend-lifecycle.local.json',lifecycle);
      if(!rearm){
      const old=read('native-fixture-old-session.local.json');
      let response, result;
      for(let attempt=0;attempt<6;attempt++) {
      response=await fetch(`${origin}/functions/v1/request-account-deletion`,{headers:{apikey:target.publicKey,Authorization:`Bearer ${old.access_token}`},signal:AbortSignal.timeout(20000)});
      result=await response.json(); if(response.status===200 && result.available===true) break;
      if(attempt<5) await new Promise(resolve=>setTimeout(resolve,2000));
      }
      assert.equal(response.status,200);assert.equal(result.available,true,'Fixture readiness not yet available');
      }
      const anonymous=await fetch(`${origin}/functions/v1/request-account-deletion`,{headers:{apikey:target.publicKey,Authorization:`Bearer ${target.publicKey}`},signal:AbortSignal.timeout(20000)});
      assert.equal((await anonymous.json()).available,false,'Unscoped readiness must stay false');
      report.deployedFunctions={...source.functions};report.sourceRevalidatedAfterSecrets=true;report.enabledVerifiedAt=new Date().toISOString();
      report.fixtureOnlyAvailable=!rearm;report.unscopedUnavailable=true;report.testReceiptRetentionDays=90;report.testBackupWindowDays=7;report.globalProductionApproval=false;report.fixtureAuthProviders=identityProviders;report.baselineRestored=false;
      saveReport('native-backend-enabled-20261001.json',report); return report;
    } catch(error) { await cleanup(); throw error; }
  }
  assert(flags.includes('--both-native-acceptances-verified'),'Root must confirm both native acceptances before any destructive phase');
  report.phases=[];report.fullDeletionCompleted=false;
  try {
  assert(lifecycle?.enabled && lifecycle.projectRef===QA && lifecycle.fixtureUserId===fixture.userId,'Temporary fixture scope missing');
  guardJobs(nowState.jobs,fixture.userId,false);
  const acceptanceEvidence=read('native-acceptances.local.json');
  const resetFile=path.join(outputDir,'native-initial-request-reset-20261001.json');
  const resetProof=acceptanceEvidence.testMode==='sequential_same_fixture_native_trials'?JSON.parse(fs.readFileSync(resetFile)):null;
  guardAcceptances(acceptanceEvidence,fixture,nowState.jobs[0],resetProof);
  verifyNativeReceiptFiles(acceptanceEvidence);
  if(resetProof){assert.equal(digest(fs.readFileSync(path.join(privateDir,'native-initial-request-reset-before.local.json'))),resetProof.requestArchiveSha256);report.nativeAcceptanceTrials='sequential_same_fixture';report.androidRequestId=resetProof.deletedRequestId;report.iosRequestId=nowState.jobs[0].id;report.originalAndroidRequestProcessed=false;report.oldSessionStage='before_final_ios_trial_b';}
  assert(secretIs('ACCOUNT_DELETION_QA_TEST_USER_ID',fixture.userId) && secretIs('ACCOUNT_DELETION_ENABLED','true'),'Exact enabled fixture scope required');
  const cronSecret=fs.readFileSync(path.join(root,'.family-qa/account-deletion-functions.env.local'),'utf8').match(/^ACCOUNT_DELETION_CRON_SECRET=(.+)$/m)?.[1]?.trim();
  assert(cronSecret?.length>=32 && secretIs('ACCOUNT_DELETION_CRON_SECRET',cronSecret),'Verified existing worker secret required');
  assert.equal(users.length,7);assert.equal(fixtureUser?.user_metadata?.qa_disposable,'deletion-completion-20260930');assert.equal(fixtureUser.email,fixture.email);
  assert.equal(nowState.jobs[0].status,'queued');assert.equal(nowState.jobs[0].phase,'inventory');assert.equal(nowState.jobs[0].attempts,0);assert.equal(nowState.jobs[0].lease_until,null);
  const currentObjects=await readonly('SELECT bucket_id,name,owner_id,owner FROM storage.objects');
  const currentAvatar=(await readonly(`SELECT avatar_url FROM public.profiles WHERE id=${literal(fixture.userId)}::uuid`))[0]?.avatar_url;
  guardStorage(lifecycle.storage,fixture,currentObjects,currentAvatar);
  const rawBefore=(await readonly(`SELECT (SELECT to_jsonb(r) FROM deletion_private.requests r WHERE id=${literal(nowState.jobs[0].id)}::uuid) request,(SELECT count(*) FROM deletion_private.events WHERE request_id=${literal(nowState.jobs[0].id)}::uuid) events,(SELECT count(*) FROM deletion_private.objects WHERE request_id=${literal(nowState.jobs[0].id)}::uuid) case_objects,(SELECT count(*) FROM deletion_private.provider_tasks WHERE request_id=${literal(nowState.jobs[0].id)}::uuid AND status<>'pending') resolved_providers`))[0];
  assert.equal(rawBefore.request.lease,null);assert.equal(Number(rawBefore.events),0);assert.equal(Number(rawBefore.case_objects),0);assert.equal(Number(rawBefore.resolved_providers),0);
  savePrivate('native-final-request-before-worker.local.json',rawBefore);report.noWorkerOrDestructivePhaseBeforeFinalGate=true;
  registerActualJob();
  const jobId=nowState.jobs[0].id; report.requestId=jobId;
  const preDeletionSession=read('native-fixture-old-session.local.json');
  const claims=JSON.parse(Buffer.from(preDeletionSession.access_token.split('.')[1],'base64url').toString());
  assert.equal(claims.sub,fixture.userId);assert(claims.exp>Date.now()/1000+120,'Pre-acceptance token expires too soon for the proof');
  const preDeletionClient=createClient(origin,target.publicKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${preDeletionSession.access_token}`},fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
  const beforeWorkerDenied=await preDeletionClient.rpc('check_account_deletion_access');
  assert.equal(beforeWorkerDenied.error?.code,'42501');assert(beforeWorkerDenied.error?.message.includes('account_deletion_pending'));
  const lateWrite=await preDeletionClient.from('profiles').update({avatar_url:lifecycle.storage.publicUrl}).eq('id',fixture.userId).select('id');
  assert.equal(lateWrite.error?.code,'42501');assert(lateWrite.error?.message.includes('account_deletion_pending'),'A late fixture write must be rejected');
  report.oldTokenBlockedBeforeWorker=true;report.lateWriteRejectedBeforeWorker=true;
    for(let n=0;n<10;n++) {
      const current=await state();guardJobs(current.jobs,fixture.userId,false);guardSchedules(current.schedules,before.schedules);
      const job=current.jobs[0];assert.equal(job.id,jobId);
      if(job.phase==='providers' && ['needs_attention','retention_pending','completed'].includes(job.status))break;
      assert(!job.lease_until || Date.parse(job.lease_until)<Date.now(),'Another worker lease active');
      const response=await fetch(`${origin}/functions/v1/process-account-deletion`,{method:'POST',headers:{apikey:target.publicKey,Authorization:`Bearer ${cronSecret}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(45000)});
      const body=await response.json();report.phases.push({phase:job.phase,httpStatus:response.status,processed:body.processed===true,error:body.error??null});saveReport('native-backend-worker-20261001.json',report);
      assert.equal(response.status,200,'Actual deployed worker failed');assert.equal(body.processed,true,'Fixture phase was not processed');
      await new Promise(resolve=>setTimeout(resolve,1200));
    }
    const final=await state();guardJobs(final.jobs,fixture.userId,false);
    assert.equal(final.jobs[0].phase,'providers','Provider/manual checkpoint required');
    assert(['needs_attention','retention_pending'].includes(final.jobs[0].status),'Pending provider cases must stay visible');
    const checks=(await readonly(`SELECT
      (SELECT count(*) FROM auth.users WHERE id=${literal(fixture.userId)}::uuid) fixture_auth,
      (SELECT count(*) FROM public.profiles WHERE id=${literal(fixture.userId)}::uuid) fixture_profile,
      (SELECT count(*) FROM storage.objects WHERE bucket_id=${literal(lifecycle.storage.bucket)} AND name=${literal(lifecycle.storage.path)}) fixture_file,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('provider',provider,'status',status,'due_at',due_at) ORDER BY provider),'[]') FROM deletion_private.provider_tasks WHERE request_id=${literal(jobId)}::uuid) providers`))[0];
    assert.equal(Number(checks.fixture_auth),0);assert.equal(Number(checks.fixture_profile),0);assert.equal(Number(checks.fixture_file),0);
    const finalUsers=await admin.auth.admin.listUsers({page:1,perPage:100});assert(!finalUsers.error);assert.equal(finalUsers.data.users.length,6);
    assert(same(finalUsers.data.users.map(stableUser).sort((a,b)=>a.id.localeCompare(b.id)),originals),'Control Auth identities changed');
    const identityRows=await readonly(`SELECT id,user_id,provider,provider_id,md5(to_jsonb(i)::text) row_hash FROM auth.identities i WHERE user_id<>${literal(fixture.userId)}::uuid ORDER BY id`);
    assert(same(identityRows,lifecycle.controlAuthIdentityRows),'Control Auth identity rows changed');
    const profiles=await readonly(`SELECT id,md5(to_jsonb(p)::text) row_hash FROM public.profiles p WHERE id<>${literal(fixture.userId)}::uuid ORDER BY id`);
    assert(same(profiles,lifecycle.controlProfiles),'Control profiles changed');
    const old=read('native-fixture-old-session.local.json');
    const oldClient=createClient(origin,target.publicKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${old.access_token}`}}});
    const denied=await oldClient.rpc('check_account_deletion_access');assert.equal(denied.error?.code,'42501');assert(denied.error?.message.includes('account_deletion_pending'),'Old-token reason must be the deletion guard');
    const publicFile=await fetch(`${origin}/storage/v1/object/public/${lifecycle.storage.bucket}/${lifecycle.storage.path}`,{signal:AbortSignal.timeout(15000)});
    assert([400,404].includes(publicFile.status),'Original file URL remains available');
    report.actualDeployedWorkerUsed=true;report.authAndProfileDeleted=true;report.ownFileDeleted=true;report.oldFreshTokenBlocked=true;report.controlAuthIdentitiesUnchanged=true;report.controlProfilesUnchanged=true;report.controlAuthProviderIdentitiesUnchanged=true;report.remainingAuthUsers=6;report.originalFileUrlStatus=publicFile.status;report.providers=checks.providers;report.finalRequestStatus=final.jobs[0].status;report.passed=true;report.completedAt=new Date().toISOString();
    saveReport('native-backend-worker-20261001.json',report);
  } catch(error) {report.passed=false;report.failure=error.message;saveReport('native-backend-worker-20261001.json',report);throw error;}
  finally {await cleanup();}
  return report;
  } catch(error) {
    if(mode==='worker' && lifecycle?.enabled && !report.cleanupAttempted) {
      try{await cleanup();}catch(cleanupError){report.cleanupFailed=true;saveReport('native-backend-cleanup-20261001.json',report);}
    }
    throw error;
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv[2],process.argv.slice(3)).then(report=>console.log(JSON.stringify(report))).catch(()=>{console.error('Guarded native QA operation failed; inspect private state and sanitized evidence. No credentials logged.');process.exitCode=1;});
}

export function guardUnprocessedReset(snapshot, fixture, expectedRequestId, storage) {
  const r=snapshot.request;
  assert.equal(snapshot.requests,1);assert.equal(snapshot.authUsers,7);assert.equal(snapshot.storageObjects,1);
  assert.equal(r?.id,expectedRequestId);assert.equal(r.user_id,fixture.userId);
  assert.equal(r.scope,'account');assert.equal(r.source,'app');assert.equal(r.status,'queued');assert.equal(r.phase,'inventory');
  assert.equal(r.attempts,0);assert.equal(r.lease,null);assert.equal(r.lease_until,null);assert.equal(r.completed_at,null);assert.equal(r.error_code,null);
  assert.equal(snapshot.fixtureMarked,true);assert.equal(snapshot.fixtureProfileUrl,storage.publicUrl);
  guardStorage(storage,fixture,snapshot.objects,snapshot.fixtureProfileUrl);
  assert.equal(snapshot.caseObjects.length,0);assert.equal(snapshot.events.length,0,'No worker/provider action may have run');
  assert.equal(snapshot.providers.length,12);
  for(const p of snapshot.providers){assert.equal(p.status,'pending');assert.equal(p.resolved_by,null);assert.equal(p.evidence,null);assert.equal(p.due_at,null);}
  assert.equal(snapshot.settings.approved_fingerprint,null);assert.equal(snapshot.settings.approved_by,null);assert.equal(snapshot.settings.approved_at,null);
  assert.equal(snapshot.settings.receipt_retention_days,null);assert.equal(snapshot.settings.backup_window_days,null);
}
