// New supervisor proof with local synthetic files only. No QA, account or restore API.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { entryDigest } from '../account-deletion-registry.mjs';
import { initializeLocalRegistry, runOnce, productionOrigin, protectedRead, healthStatus, monitorOnce, restoreCheck, recoverDeadLock } from '../account-deletion-registry-runtime.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runtime=path.join(repo,'scripts/account-deletion-registry-runtime.mjs');
const configFor=async()=>{
  const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'lotti-production-registry-runtime-proof-'));
  const directory=path.join(root,'registry'),stateDirectory=path.join(root,'state');
  await fs.mkdir(directory,{mode:0o700});await fs.mkdir(stateDirectory,{mode:0o700});
  return {root,config:{projectRef:'kwniiyayhzgjfqjsjcfu',origin:productionOrigin,directory,stateDirectory,repositoryRoot:repo,writer:'offline runtime proof',python:'/usr/bin/false',keychainHelper:'/unavailable'}};
};
const entry={requestId:'10000000-0000-4000-8000-000000000001',userId:'10000000-0000-4000-8000-000000000002',scope:'account',acceptedAt:'2026-10-02T00:00:00.000000Z'};
entry.digest=entryDigest(productionOrigin,entry);
const snapshot={version:1,origin:productionOrigin,entries:[entry]};
const missing=()=>{throw Object.assign(new Error('registry_rpc_missing'),{safeCode:'registry_rpc_missing'});};

test('empty first write is durable and private but is explicitly not a backend export or entry acknowledgement',async()=>{
 const {root,config}=await configFor();try{
  const first=await initializeLocalRegistry(config);assert.equal(first.entries,0);assert.equal(first.acknowledged,0);assert.equal(first.backendExportVerified,false);assert.equal(first.durableReadback,true);
  const filename=path.join(config.directory,'deletion-registry-v1.json'),before=await protectedRead(filename);
  const second=await initializeLocalRegistry(config);assert.equal(second.kind,'existing_register_preserved');assert.equal(await protectedRead(filename),before);
  assert.equal((await fs.stat(config.directory)).mode&0o777,0o700);assert.equal((await fs.stat(filename)).mode&0o777,0o600);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('real separate supervisor processes reconcile durable data after a simulated Ack outage and preserve existing entries after an empty export',async()=>{
 const {root,config}=await configFor();try{
  await initializeLocalRegistry(config);
  const driver=path.join(root,'child.mjs');
  await fs.writeFile(driver,`import fs from 'node:fs/promises';import {runOnce} from ${JSON.stringify(runtime)};const config=${JSON.stringify(config)};const snapshot=${JSON.stringify(snapshot)};let calls=0;const result=await runOnce(config,{rpc:async(name,payload)=>{if(name.endsWith('_export'))return process.argv[2]==='empty'?{...snapshot,entries:[]}:snapshot;calls++;const onDisk=JSON.parse(await fs.readFile(config.directory+'/deletion-registry-v1.json'));if(!onDisk.entries.some(e=>e.requestId===payload.p_request_id&&e.digest===payload.p_digest))throw Error('Ack before readback');if(process.argv[2]==='fail')throw Object.assign(Error('transport'),{safeCode:'registry_transport_unavailable'});return {acknowledged:true,requestId:payload.p_request_id,digest:payload.p_digest};}});console.log(JSON.stringify({...result,mockAckCalls:calls}));`);
  const run=mode=>JSON.parse(execFileSync(process.execPath,[driver,mode],{encoding:'utf8'}));
  const first=run('fail');assert.equal(first.status,'error');assert.equal(first.mockAckCalls,1);
  const saved=JSON.parse(await protectedRead(path.join(config.directory,'deletion-registry-v1.json'))).entries;
  const second=run('success');assert.notEqual(first.pid,second.pid);assert.equal(second.status,'healthy');assert.equal(second.acknowledged,1);assert.equal(second.confirmedEntryEvidence,true);
  const third=run('empty');assert.notEqual(second.pid,third.pid);assert.equal(third.acknowledged,0);assert.equal(third.confirmedEntryEvidence,false);
  assert.equal(third.status,'needs_reconciliation');assert.equal(third.independentEntriesAbsentFromBackend,1);
  assert.deepEqual(JSON.parse(await protectedRead(path.join(config.directory,'deletion-registry-v1.json'))).entries,saved);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('missing backend and unavailable credentials preserve the register byte for byte, emit an observable failure, and retry without a residual lock',async()=>{
 const {root,config}=await configFor();try{
  await initializeLocalRegistry(config);const filename=path.join(config.directory,'deletion-registry-v1.json'),bytes=await protectedRead(filename);
  const first=await runOnce(config,{rpc:missing});assert.equal(first.status,'blocked_missing_backend');assert.equal(first.acknowledged,0);assert.equal(await protectedRead(filename),bytes);
  const second=await runOnce(config,{credential:()=>{throw Object.assign(Error('credential_unavailable'),{safeCode:'credential_unavailable'});}});assert.equal(second.errorCode,'credential_unavailable');assert.equal(second.consecutiveFailures,2);assert.equal(await protectedRead(filename),bytes);
  await assert.rejects(fs.lstat(path.join(config.directory,'.deletion-registry-writer.lock')),/ENOENT/);
  const health=await healthStatus(config);assert.equal(health.healthy,false);assert.equal(health.stale,false);
  const monitor=await monitorOnce(config);assert.equal(monitor.requiresOperator,true);assert.equal(monitor.errorCode,'credential_unavailable');assert.equal(monitor.externalNotificationSent,false);
  assert((await fs.readdir(config.stateDirectory)).some(x=>x.startsWith('events-')));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('SIGKILL before Ack leaves a protected lock, rejects further writes, and permits verified recovery only after the exact previous process ended',async()=>{
 const {root,config}=await configFor();try{
  await initializeLocalRegistry(config);const driver=path.join(root,'crash.mjs');
  await fs.writeFile(driver,`import {runOnce} from ${JSON.stringify(runtime)};await runOnce(${JSON.stringify(config)},{rpc:async(name)=>{if(name.endsWith('_export'))return ${JSON.stringify(snapshot)};process.kill(process.pid,'SIGKILL');}});`);
  const killed=spawnSync(process.execPath,[driver]);assert.equal(killed.signal,'SIGKILL');
  const filename=path.join(config.directory,'deletion-registry-v1.json'),bytes=await protectedRead(filename);
  const blocked=await runOnce(config,{rpc:async()=>snapshot});assert.equal(blocked.errorCode,'writer_lock_requires_verified_recovery');assert.equal(await protectedRead(filename),bytes);
  const recovered=await recoverDeadLock(config);assert.equal(recovered.registryPreserved,true);assert.equal(await protectedRead(filename),bytes);
  const lock=path.join(config.directory,'.deletion-registry-writer.lock');await fs.mkdir(lock,{mode:0o700});await fs.writeFile(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,nonce:'10000000-0000-4000-8000-000000000003'}),{mode:0o600});
  await assert.rejects(recoverDeadLock(config),/previous_writer_may_still_be_alive/);assert.equal(await protectedRead(filename),bytes);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('a restored database Ack or empty register cannot release restore application access; stale health is also refused',async()=>{
 const {root,config}=await configFor();try{
  await initializeLocalRegistry(config);
  const gate=await restoreCheck(config);assert.equal(gate.applicationAccessAllowed,false);assert.equal(gate.restoredDatabaseAckIsSufficient,false);assert.equal(gate.restorePerformed,false);
  await fs.writeFile(path.join(config.stateDirectory,'status.json'),JSON.stringify({status:'healthy',checkedAt:'2020-01-01T00:00:00Z'}),{mode:0o600});
  const stale=await healthStatus(config);assert.equal(stale.healthy,false);assert.equal(stale.stale,true);
  const monitor=await monitorOnce(config);assert.equal(monitor.requiresOperator,true);assert.equal(monitor.errorCode,'writer_status_stale_or_unavailable');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
