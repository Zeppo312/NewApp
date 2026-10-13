// New consent rules only; temporary local PostgreSQL, no Supabase or providers.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {createRequire} from 'node:module';
import EmbeddedPostgres from '../../.family-qa/postgres-tools/node_modules/embedded-postgres/dist/index.js';
const require=createRequire(import.meta.url);
const {buildSql,migration,fullCatalogExpression}=require('../prepare-deletion-consent-rollout.cjs');
const {consentCatalogQuery}=require('../deletion-consent-catalog.cjs');
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const version='2026-10-01.1',op=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let pg,tmp,index=0;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lottibaby-consent-sql-'));
 const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 pg=new EmbeddedPostgres({databaseDir:path.join(tmp,'db'),user:'postgres',password:'local-synthetic-only',port,persistent:true,onLog:()=>{},onError:()=>{}});
 await pg.initialise();await pg.start();
 const db=pg.getPgClient();await db.connect();await db.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator');await db.end();
});
after(async()=>{if(pg)await pg.stop();if(tmp)fs.rmSync(tmp,{recursive:true,force:true});});
async function setup(stage=true){
 const name=`consent_${++index}`;await pg.createDatabase(name);const db=pg.getPgClient(name);await db.connect();
 await db.query('ALTER ROLE authenticator RESET pgrst.db_pre_request');
 await db.query(fs.readFileSync('supabase/tests/account_deletion_fixture.sql','utf8').replace(/CREATE ROLE[^\n]*\n/,''));
 await db.query(fs.readFileSync('supabase/migrations/20261001170732_data_consent_records.sql','utf8'));
 await db.query('CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[])');
 const baseline=JSON.parse(fs.readFileSync('.family-qa/deletion-production-preparation-20261001/fresh-baseline.local.json','utf8'));
 await db.query(baseline.baseline.legacy_function.definition);
 await db.query('REVOKE ALL ON FUNCTION public.delete_user_data(boolean) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.delete_user_data(boolean) TO anon,authenticated,service_role');
 baseline.baseline.legacy_function.definition=(await db.query("SELECT pg_get_functiondef('public.delete_user_data(boolean)'::regprocedure) definition")).rows[0].definition;
 baseline.baseline.guard_target_tables=(await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND(n.nspname IN('public','caretaker_private') OR n.nspname='storage' AND c.relname='objects')")).rows[0].n;
 baseline.fullCatalogDigest=(await db.query(`SELECT md5((${fullCatalogExpression})::text) digest`)).rows[0].digest;
 const consent=(await db.query(consentCatalogQuery)).rows[0];const candidate=buildSql(baseline,consent);
 if(stage)await db.query(candidate.sql);
 await db.query('INSERT INTO auth.users(id,last_sign_in_at,email) VALUES($1,now(),$3),($2,now(),$4)',[a,b,'a@example.invalid','b@example.invalid']);
 const second=async()=>{const c=pg.getPgClient(name);await c.connect();return c;};
 return {db,baseline,consent,candidate,second};
}
async function activate(db){
 // Synthetic policy approval; never an operator decision or production proof.
 await db.query("UPDATE deletion_private.settings SET provider_handling_mode='supervised',receipt_retention_days=90,consent_handling_policy='reset_reconsent_erase_evidence',consent_policy_approved_by='synthetic test',consent_policy_approved_at=now(); UPDATE deletion_private.settings SET approved_by='synthetic test',approved_at=now(),approved_fingerprint=deletion_private.fingerprint()");
 // Staged core forbids enabling. Bypass only its rollout trigger locally so the
 // new record_decision path can be tested without repeating consent rollout QA.
 await db.query('ALTER TABLE consent_private.settings DISABLE TRIGGER consent_activation_guard; UPDATE consent_private.settings SET enabled=true; ALTER TABLE consent_private.settings ENABLE TRIGGER consent_activation_guard');
}
async function user(db,uid=a){await db.query('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.query('SET ROLE authenticated');}
async function owner(db){await db.query("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)");}
const record=async(db,scope,decision,id,revision)=>(await db.query('SELECT public.record_data_consent($1,$2,$3,$4,$5,$6) result',[scope,decision,version,'de',op(id),revision])).rows[0].result;
const accept=async(db,scope)=>(await db.query('SELECT deletion_private.accept($1,$2,$3) result',[a,scope,'app'])).rows[0].result;
async function seed(db){await activate(db);await user(db);await record(db,'health','granted',1,0);await record(db,'ai','granted',2,1);await owner(db);await user(db,b);await record(db,'health','granted',3,0);await owner(db);}
const globalDigest=async(db)=>(await db.query("SELECT md5((SELECT jsonb_agg(to_jsonb(s))::text FROM consent_private.settings s)||(SELECT jsonb_agg(to_jsonb(d))::text FROM consent_private.documents d)) digest")).rows[0].digest;
const foreignDigest=async(db)=>(await db.query("SELECT md5((SELECT jsonb_agg(to_jsonb(s))::text FROM consent_private.user_state s WHERE user_id=$1)||(SELECT jsonb_agg(to_jsonb(d))::text FROM consent_private.decisions d WHERE user_id=$1)||(SELECT jsonb_agg(to_jsonb(e))::text FROM consent_private.events e WHERE user_id=$1)) digest",[b])).rows[0].digest;

test('nine-source atomic staging preserves global/user data, exact history and disabled approvals',async()=>{
 const {db,candidate}=await setup(false);try{
  await db.query('INSERT INTO consent_private.user_state VALUES($1,7)',[a]);
  await db.query("INSERT INTO consent_private.decisions VALUES($1,'health','granted',$2,now())",[a,version]);
  const globals=await globalDigest(db),choices=(await db.query('SELECT * FROM consent_private.decisions')).rows;
  await db.query(candidate.sql);
  assert.equal(await globalDigest(db),globals);assert.deepEqual((await db.query('SELECT * FROM consent_private.decisions')).rows,choices);
  assert.equal((await db.query('SELECT revision FROM consent_private.user_state WHERE user_id=$1',[a])).rows[0].revision,'7');
  assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,false);
  const s=(await db.query('SELECT * FROM deletion_private.settings')).rows[0];
  assert.equal(s.consent_handling_policy,'unapproved');assert.equal(s.consent_policy_approved_at,null);assert.equal(s.consent_policy_approved_by,null);
  assert.equal(s.approved_fingerprint,null);assert.equal(s.receipt_retention_days,null);assert.equal(s.backup_window_days,null);
  const history=(await db.query('SELECT version,statements FROM supabase_migrations.schema_migrations ORDER BY version')).rows;
  assert.equal(history.length,9);
  for(let i=0;i<history.length;i++)assert.deepEqual(history[i].statements,[fs.readFileSync(candidate.manifests[i].file,'utf8')]);
  assert.equal((await db.query("SELECT count(*)::int n FROM deletion_private.rules WHERE schema_name='consent_private'")).rows[0].n,4);
  assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,2);
  await assert.rejects(accept(db,'data'),/deletion_retention_not_configured|deletion_inventory_not_approved/);
 }finally{await db.end();}
});
test('consent catalog drift aborts before any deletion DDL/history',async()=>{
 const {db,candidate}=await setup(false);try{
  await db.query('ALTER TABLE consent_private.events ADD COLUMN unreviewed text');
  await assert.rejects(db.query(candidate.sql),/consent_catalog_changed|production_catalog_changed/);await db.query('ROLLBACK');
  assert.equal((await db.query("SELECT to_regnamespace('deletion_private') ns")).rows[0].ns,null);
  assert.equal((await db.query('SELECT count(*)::int n FROM supabase_migrations.schema_migrations')).rows[0].n,0);
 }finally{await db.end();}
});
test('same-count non-consent catalog drift aborts the refreshed candidate before any DDL',async()=>{
 const {db,candidate}=await setup(false);try{
  await db.query('ALTER TABLE public.sleep_entries ADD COLUMN unknown_copy jsonb');
  await assert.rejects(db.query(candidate.sql),/production_catalog_changed/);await db.query('ROLLBACK');
  assert.equal((await db.query("SELECT to_regnamespace('deletion_private') ns")).rows[0].ns,null);
  assert.equal((await db.query('SELECT count(*)::int n FROM supabase_migrations.schema_migrations')).rows[0].n,0);
 }finally{await db.end();}
});
test('new consent policy needs separate named dated approval before deletion readiness',async()=>{
 const {db}=await setup();try{
  await db.query("UPDATE deletion_private.settings SET provider_handling_mode='supervised',receipt_retention_days=90,approved_by='synthetic test',approved_at=now(); UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint()");
  assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,false);
  await activate(db);assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,true);
  await db.query("UPDATE deletion_private.settings SET consent_policy_approved_at=now()+interval '1 day'");
  assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,false);
 }finally{await db.end();}
});
test('the revision-preserving rule cannot be reused to omit a different deletion target',async()=>{
 const {db}=await setup();try{
  await assert.rejects(db.query("UPDATE deletion_private.rules SET action='consent_revision' WHERE table_name='decisions' AND schema_name='consent_private'"),/rules_action_check/);
 }finally{await db.end();}
});
test('data reset erases choices/history/operations, keeps an idempotent increasing revision, preserves foreign/global data',async()=>{
 const {db}=await setup();try{
  await seed(db);const gd=await globalDigest(db),fd=await foreignDigest(db);const r=await accept(db,'data');
  await db.query('SELECT deletion_private.erase_rows($1)',[a]);await db.query('SELECT deletion_private.verify_rows($1)',[a]);
  assert.equal((await db.query('SELECT revision FROM consent_private.user_state WHERE user_id=$1',[a])).rows[0].revision,'3');
  await db.query('SELECT deletion_private.erase_rows($1)',[a]);
  assert.equal((await db.query('SELECT revision FROM consent_private.user_state WHERE user_id=$1',[a])).rows[0].revision,'3');
  for(const t of ['decisions','operations','events'])assert.equal((await db.query(`SELECT count(*)::int n FROM consent_private.${t} WHERE user_id=$1`,[a])).rows[0].n,0);
  assert.equal(await globalDigest(db),gd);assert.equal(await foreignDigest(db),fd);
  // Synthetic completion only unblocks this local identity; no provider replay.
  await db.query("UPDATE deletion_private.requests SET status='completed',phase='done',completed_at=now() WHERE id=$1",[r.requestId]);
  await user(db);await assert.rejects(record(db,'health','granted',1,0),/consent_revision_changed/);
  const next=await record(db,'health','granted',10,3);assert.equal(next.revision,4);
  await owner(db);const r2=await accept(db,'data');await db.query('SELECT deletion_private.erase_rows($1)',[a]);
  assert.equal((await db.query('SELECT consent_reset_revision FROM deletion_private.requests WHERE id=$1',[r2.requestId])).rows[0].consent_reset_revision,'5');
 }finally{await db.end();}
});
test('account scope erases all four consent user relations before Auth cascade and preserves other/global content',async()=>{
 const {db}=await setup();try{
  await seed(db);const gd=await globalDigest(db),fd=await foreignDigest(db);await accept(db,'account');
  await db.query('SELECT deletion_private.erase_rows($1)',[a]);await db.query('SELECT deletion_private.verify_rows($1)',[a]);
  for(const t of ['user_state','decisions','operations','events'])assert.equal((await db.query(`SELECT count(*)::int n FROM consent_private.${t} WHERE user_id=$1`,[a])).rows[0].n,0);
  assert.equal(await globalDigest(db),gd);assert.equal(await foreignDigest(db),fd);
 }finally{await db.end();}
});
test('reset floor exceeds all recorded revisions and bigint overflow rolls back without losing evidence',async()=>{
 const {db}=await setup();try{
  await seed(db);await db.query('UPDATE consent_private.operations SET revision=12 WHERE user_id=$1',[a]);
  const r=await accept(db,'data');await db.query('SELECT deletion_private.erase_rows($1)',[a]);
  assert.equal((await db.query('SELECT revision FROM consent_private.user_state WHERE user_id=$1',[a])).rows[0].revision,'13');
  await db.query("UPDATE deletion_private.requests SET status='completed',phase='done' WHERE id=$1",[r.requestId]);
  await db.query('UPDATE consent_private.user_state SET revision=9223372036854775807 WHERE user_id=$1',[a]);
  const r2=await accept(db,'data');await assert.rejects(db.query('SELECT deletion_private.erase_rows($1)',[a]),/bigint out of range/);
  assert.equal((await db.query('SELECT consent_reset_revision FROM deletion_private.requests WHERE id=$1',[r2.requestId])).rows[0].consent_reset_revision,null);
  assert.equal((await db.query('SELECT revision FROM consent_private.user_state WHERE user_id=$1',[a])).rows[0].revision,'9223372036854775807');
 }finally{await db.end();}
});
test('accepted deletion rejects every consent decision including withdrawal and idempotent returns; service processing/read are blocked',async()=>{
 const {db}=await setup();try{
  await seed(db);await accept(db,'data');await user(db);
  for(const decision of ['granted','declined','revoked'])await assert.rejects(record(db,'health',decision,20,2),/account_deletion_pending/);
  await assert.rejects(record(db,'health','granted',1,0),/account_deletion_pending/);
  await assert.rejects(db.query('SELECT public.get_data_consents()'),/account_deletion_pending/);
  await owner(db);await db.query('SET ROLE service_role');
  assert.equal((await db.query('SELECT public.check_data_processing_consent($1) allowed',[a])).rows[0].allowed,false);
 }finally{await db.end();}
});
test('table triggers reject direct owner/late service writes to all four tables; private helpers and RPC ACL remain narrow',async()=>{
 const {db}=await setup();try{
  await seed(db);await accept(db,'account');
  for(const q of ['UPDATE consent_private.user_state SET revision=revision+1 WHERE user_id=$1','UPDATE consent_private.decisions SET decision=decision WHERE user_id=$1','UPDATE consent_private.operations SET revision=revision WHERE user_id=$1','UPDATE consent_private.events SET revision=revision WHERE user_id=$1'])await assert.rejects(db.query(q,[a]),/account_deletion_pending/);
  for(const role of ['anon','authenticated','service_role']){
   await db.query(`SET ROLE ${role}`);
   await assert.rejects(db.query('SELECT deletion_private.erase_consent_state($1)',[a]),/permission denied/);
   await assert.rejects(db.query('INSERT INTO consent_private.user_state VALUES($1,20)',[a]),/permission denied/);
   if(role!=='authenticated')await assert.rejects(record(db,'health','granted',20,2),/permission denied/);
   await db.query('RESET ROLE');
  }
 }finally{await db.end();}
});
test('operation identity conflicts and retry after withdrawal never regrant; stale new operations fail',async()=>{
 const {db}=await setup();try{
  await seed(db);await user(db);await record(db,'health','revoked',21,2);
  const retry=await record(db,'health','granted',1,0);assert.equal(retry.health.decision,'revoked');assert.equal(retry.ai.decision,'revoked');assert.equal(retry.revision,3);
  await assert.rejects(record(db,'health','declined',1,0),/consent_operation_conflict/);
  await assert.rejects(record(db,'health','granted',22,1),/consent_revision_changed/);
 }finally{await db.end();}
});
test('deleted auth identity cannot return an idempotent snapshot or consent processing allow',async()=>{
 const {db}=await setup();try{
  await seed(db);await db.query('DELETE FROM auth.users WHERE id=$1',[a]);await user(db);
  await assert.rejects(record(db,'health','granted',1,0),/account_not_found/);await owner(db);
  assert.equal((await db.query('SELECT consent_private.processing_allowed($1,$2) allowed',[a,'health'])).rows[0].allowed,false);
 }finally{await db.end();}
});
test('fingerprint invalidates on consent body, ACL, trigger, column and shared-document drift',async()=>{
 const {db}=await setup();try{
  await activate(db);const fp=(await db.query('SELECT deletion_private.fingerprint() fp')).rows[0].fp;
  for(const change of ["ALTER TABLE consent_private.events ADD COLUMN future_field text","ALTER TABLE consent_private.events DISABLE TRIGGER account_deletion_guard","GRANT EXECUTE ON FUNCTION consent_private.require_live_user(uuid) TO service_role","UPDATE consent_private.documents SET copy=copy||'{\"syntheticChange\":true}'::jsonb","CREATE OR REPLACE FUNCTION public.record_data_consent(p_scope text,p_decision text,p_document_version text,p_locale text,p_operation_id uuid,p_expected_revision bigint) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$"]){
   await db.query('BEGIN');await db.query(change);assert.notEqual((await db.query('SELECT deletion_private.fingerprint() fp')).rows[0].fp,fp);assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,false);await db.query('ROLLBACK');
  }
 }finally{await db.end();}
});
test('repeatable-read and serializable consent writes fail closed',async()=>{
 const {db}=await setup();try{
  await seed(db);await user(db);
  for(const isolation of ['REPEATABLE READ','SERIALIZABLE']){
   await db.query(`BEGIN ISOLATION LEVEL ${isolation}`);await assert.rejects(record(db,'health','revoked',30,2),/consent_requires_read_committed/);await db.query('ROLLBACK');
  }
 }finally{await db.end();}
});
test('two connections: deletion accepted first blocks a consent call already waiting on the identity lock',async()=>{
 const {db,second}=await setup();const writer=await second();try{
  await seed(db);await db.query('BEGIN');await accept(db,'account');await user(writer);
  const waiting=record(writer,'health','granted',40,2).then(()=>({success:true}),e=>({error:e.message}));
  // A fresh lock-catalog observation proves blocking; no timing-only success.
  for(let i=0;i<100;i++){
   const waits=(await db.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows[0].n;
   if(waits){await db.query('COMMIT');const result=await waiting;assert.match(result.error,/account_deletion_pending/);return;}
   await new Promise(r=>setTimeout(r,10));
  }
  throw Error('Concurrent writer did not wait on identity lock');
 }finally{await db.query('ROLLBACK');await writer.end();await db.end();}
});
test('two connections: in-flight consent commits before deletion acceptance and subsequent calls are blocked',async()=>{
 const {db,second}=await setup();const requester=await second();try{
  await seed(db);await user(db);await db.query('BEGIN');await record(db,'health','revoked',50,2);
  const waiting=accept(requester,'data');
  // Observe via a separate connection: acceptance must wait, not interleave.
  await owner(db);
  for(let i=0;i<100;i++){
   const waits=(await db.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows[0].n;
   if(waits){await db.query('COMMIT');await waiting;await user(db);await assert.rejects(record(db,'health','granted',51,3),/account_deletion_pending/);return;}
   await new Promise(r=>setTimeout(r,10));
  }
  throw Error('Concurrent acceptance did not wait on consent lock');
 }finally{await db.query('ROLLBACK');await requester.end();await db.end();}
});
