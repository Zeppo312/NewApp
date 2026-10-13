import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { QA, PROD, ORG, guardTarget, guardJobs, guardSchedules, guardAcceptances, guardStorage, writeIndependentRegister, guardUnprocessedReset } from '../native-deletion-qa.mjs';
const uid='11111111-1111-4111-8111-111111111111', foreign='22222222-2222-4222-8222-222222222222';
const schedules=[{jobname:'account-deletion-worker-qa',schedule:'* * * * *',active:false},{jobname:'account-deletion-alert-qa',schedule:'*/5 * * * *',active:true}];
const job={id:'33333333-3333-4333-8333-333333333333',user_id:uid,scope:'account',source:'app'};
const acceptances={projectRef:QA,userId:uid,requestId:job.id,scope:'account',devices:['android','ios'].map(platform=>({platform,accepted:true,requestId:job.id,nativeMailCodeVerified:true,evidence:'physical-device-proof.png'}))};
test('parent/org/branch all must match; production as target refused',()=>{
  guardTarget({projectRef:QA},{id:PROD,organization_id:ORG},{project_ref:QA,parent_project_ref:PROD,name:'family-subscription-qa',is_default:false});
  for(const [target,project,branch] of [
    [{projectRef:PROD},{id:PROD,organization_id:ORG},{project_ref:QA,parent_project_ref:PROD,name:'family-subscription-qa',is_default:false}],
    [{projectRef:QA},{id:PROD,organization_id:'foreign-org'},{project_ref:QA,parent_project_ref:PROD,name:'family-subscription-qa',is_default:false}],
    [{projectRef:QA},{id:PROD,organization_id:ORG},{project_ref:QA,parent_project_ref:'other-parent',name:'family-subscription-qa',is_default:false}],
  ])assert.throws(()=>guardTarget(target,project,branch));
});
test('one actual native fixture request only; foreign/control, support and duplicate rejected',()=>{
  guardJobs([job],uid,false);assert.throws(()=>guardJobs([],uid,false));
  for(const jobs of [[{...job,user_id:foreign}],[{...job,source:'support'}],[job,job],[{...job,scope:'data'}]])assert.throws(()=>guardJobs(jobs,uid));
});
test('worker cannot run with cron active or alarm stopped',()=>{
  guardSchedules(schedules,schedules);
  assert.throws(()=>guardSchedules([{...schedules[0],active:true},schedules[1]],schedules));
  assert.throws(()=>guardSchedules([schedules[0],{...schedules[1],active:false}],schedules));
});
test('both separate physical devices must accept same request after real mail verification',()=>{
  guardAcceptances(acceptances,{userId:uid},job);
  assert.throws(()=>guardAcceptances({...acceptances,devices:acceptances.devices.map(({evidence,...d})=>({...d,rawScreenshotPrivate:evidence}))},{userId:uid},job));
  for(const devices of [[acceptances.devices[0]],acceptances.devices.map(d=>({...d,platform:'android'})),acceptances.devices.map(d=>({...d,requestId:'different'})),acceptances.devices.map(d=>({...d,nativeMailCodeVerified:false}))])assert.throws(()=>guardAcceptances({...acceptances,devices},{userId:uid},job));
});
test('file requires exact known bucket/path and fixture Auth owner',()=>{
  const manifest={projectRef:QA,userId:uid,bucket:'community-images',path:`avatars/avatar_${uid}_native-deletion-20261001.png`};
  const obj={bucket_id:manifest.bucket,name:manifest.path,owner_id:uid};
  guardStorage(manifest,{userId:uid},[obj]);
  for(const objects of [[{...obj,owner_id:foreign}],[{...obj,owner_id:null}],[obj,obj],[{...obj,name:`avatar_${uid}-substring.png`}]])assert.throws(()=>guardStorage(manifest,{userId:uid},objects));
});
test('service-uploaded orphan file needs exact fixture profile association; foreign owner always refused',()=>{
  const manifest={projectRef:QA,userId:uid,bucket:'community-images',path:`avatars/avatar_${uid}_native-deletion-20261001.png`,ownership:'verified-profile-avatar-url'};
  manifest.publicUrl=`https://${QA}.supabase.co/storage/v1/object/public/${manifest.bucket}/${manifest.path}`;
  const obj={bucket_id:manifest.bucket,name:manifest.path,owner_id:null,owner:null};
  guardStorage(manifest,{userId:uid},[obj],manifest.publicUrl);
  assert.throws(()=>guardStorage(manifest,{userId:uid},[obj],null));
  assert.throws(()=>guardStorage(manifest,{userId:uid},[obj],manifest.publicUrl.replace(QA,PROD)));
  assert.throws(()=>guardStorage(manifest,{userId:uid},[{...obj,owner_id:foreign}],manifest.publicUrl));
});

test('independent register persists exact minimal QA entry privately and rejects overwrite',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lotti-native-register-test-'));
  try {
    const file=path.join(dir,'register.json'),entry={projectRef:QA,requestId:job.id,userId:uid,scope:'account',created_at:'2026-10-01T12:00:00Z',purpose:'Synthetic QA'};
    const first=writeIndependentRegister(file,entry),again=writeIndependentRegister(file,entry);
    assert.equal(first.sha256,again.sha256);assert.equal(first.readbackVerified,true);assert.equal(fs.statSync(file).mode & 0o777,0o600);
    assert.throws(()=>writeIndependentRegister(file,{...entry,userId:foreign}));
    assert.deepEqual(JSON.parse(fs.readFileSync(file)),entry);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('independent register refuses production and symlink destinations',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lotti-native-register-test-'));
  try {
    const file=path.join(dir,'register.json'),entry={projectRef:QA,requestId:job.id,userId:uid,scope:'account',created_at:'2026-10-01T12:00:00Z'};
    assert.throws(()=>writeIndependentRegister(file,{...entry,projectRef:PROD}));
    const target=path.join(dir,'other.json');fs.writeFileSync(target,'{}');fs.symlinkSync(target,file);
    assert.throws(()=>writeIndependentRegister(file,entry));assert.equal(fs.readFileSync(target,'utf8'),'{}');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('unprocessed test reset refuses any worker phase, foreign request, lease, missing file or provider resolution',()=>{
 const storage={projectRef:QA,userId:uid,bucket:'community-images',path:`avatars/avatar_${uid}_native-deletion-20261001.png`,ownership:'verified-profile-avatar-url'};storage.publicUrl=`https://${QA}.supabase.co/storage/v1/object/public/${storage.bucket}/${storage.path}`;
 const snapshot={requests:1,authUsers:7,storageObjects:1,request:{...job,status:'queued',phase:'inventory',attempts:0,lease:null,lease_until:null,completed_at:null,error_code:null},fixtureMarked:true,fixtureProfileUrl:storage.publicUrl,objects:[{bucket_id:storage.bucket,name:storage.path,owner_id:null,owner:null}],caseObjects:[],events:[],providers:Array.from({length:12},()=>({status:'pending',resolved_by:null,evidence:null,due_at:null})),settings:{approved_fingerprint:null,approved_by:null,approved_at:null,receipt_retention_days:null,backup_window_days:null}};
 guardUnprocessedReset(snapshot,{userId:uid},job.id,storage);
 for(const changed of [{...snapshot,request:{...snapshot.request,attempts:1}},{...snapshot,request:{...snapshot.request,phase:'storage'}},{...snapshot,request:{...snapshot.request,user_id:foreign}},{...snapshot,request:{...snapshot.request,lease:job.id}},{...snapshot,storageObjects:0},{...snapshot,providers:snapshot.providers.map(p=>({...p,status:'completed'}))},{...snapshot,events:[{action:'provider:apple:not_applicable'}]}])assert.throws(()=>guardUnprocessedReset(changed,{userId:uid},job.id,storage));
});
test('sequential native trials need genuine distinct receipts for same fixture plus zero-worker reset proof',()=>{
 const a='44444444-4444-4444-8444-444444444444';
 const evidence={...acceptances,testMode:'sequential_same_fixture_native_trials',devices:acceptances.devices.map(d=>({...d,requestId:d.platform==='android'?a:job.id}))};
 const reset={projectRef:QA,fixtureUserId:uid,deletedRequestId:a,noWorkerOrDestructivePhaseRun:true,ownUnprocessedQaTrialOnly:true,requestRemoved:true,notMarkedCompleted:true,controlAuthUnchanged:true,controlProfilesUnchanged:true,profileAndFilePreserved:true,readinessRestoredDisabled:true,workerCronInactive:true,scope:'account',originalSource:'app',originalStatus:'queued',originalPhase:'inventory',originalAttempts:0,authUsers:7,storageObjects:1,requestsAfter:0};
 guardAcceptances(evidence,{userId:uid},job,reset);
 assert.throws(()=>guardAcceptances(evidence,{userId:uid},job,null));
 for(const proof of [{...reset,fixtureUserId:foreign},{...reset,noWorkerOrDestructivePhaseRun:false},{...reset,originalAttempts:1},{...reset,deletedRequestId:job.id},{...reset,requestsAfter:1}])assert.throws(()=>guardAcceptances(evidence,{userId:uid},job,proof));
 assert.throws(()=>guardAcceptances({...evidence,devices:evidence.devices.map(d=>({...d,requestId:job.id}))},{userId:uid},job,reset));
});
