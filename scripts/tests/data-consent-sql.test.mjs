import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_PACKAGE || '@electric-sql/pglite');
const core = fs.readFileSync('supabase/migrations/20261001170732_data_consent_records.sql','utf8');
const enforcement = fs.readFileSync('supabase/migrations/20261001170812_data_consent_enforcement.sql','utf8');
const version='2026-10-01.1', a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002';
const op = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(full=true, deletionHook=false) {
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 INSERT INTO auth.users VALUES('${a}'),('${b}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
 CREATE TABLE public.baby_info(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE public.baby_members(baby_id uuid,user_id uuid);
 CREATE TABLE public.account_links(creator_id uuid,invited_id uuid,status text);
 CREATE TABLE public.sleep_entry_shares(owner_id uuid,shared_with_id uuid);
 CREATE TABLE public.profiles(id uuid); CREATE TABLE public.terms_consents(user_id uuid);`);
 const names = [...enforcement.matchAll(/\('([a-z_]+)'\)/g)].map(m=>m[1]);
 for(const name of new Set(names)) {
  if(!['baby_info','baby_members','sleep_entry_shares'].includes(name)) await db.exec(`CREATE TABLE public.${name}(id uuid PRIMARY KEY,user_id uuid,baby_id uuid,notes text)`);
  await db.exec(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY; GRANT ALL ON public.${name} TO authenticated,service_role; CREATE POLICY fixture ON public.${name} TO authenticated USING(true) WITH CHECK(true);`);
 }
 await db.exec(core);
 if(deletionHook) await db.exec("CREATE FUNCTION public.check_account_deletion_access() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_deletion_block'; END $$; ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access';");
 if(full) await db.exec(enforcement);
 return db;
}
async function asUser(db,uid=a,role='authenticated') {
 await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid??''}',false),set_config('request.jwt.claims','{"role":"${role}"}',false); SET ROLE ${role};`);
}
async function enable(db) { await db.exec(`RESET ROLE; UPDATE consent_private.settings SET client_release='synthetic-client-test',edge_release='synthetic-edge-test',approved_at=now(),enabled=true;`); }
async function decision(db,scope,choice,revision,n,locale='de') {
 return (await db.query('SELECT public.record_data_consent($1,$2,$3,$4,$5::uuid,$6::bigint) s',[scope,choice,version,locale,op(n),revision])).rows[0].s;
}
async function snapshot(db) { return (await db.query('SELECT public.get_data_consents() s')).rows[0].s; }
async function allowed(db,uid,scope='health') {
 await asUser(db,null,'service_role');
 return (await db.query('SELECT public.check_data_processing_consent($1::uuid,$2) ok',[uid,scope])).rows[0].ok;
}
test('core is inert, records no presumed consent, and cannot activate without enforcement',async()=>{
 const db=await setup(false);try {
  await asUser(db);const s=await snapshot(db);assert.equal(s.enabled,false);assert.equal(s.health,null);assert.equal(s.ai,null);
  await assert.rejects(decision(db,'health','granted',0,1),/consents_not_enabled/);
  assert.equal(await allowed(db,a,'ai'),true);
  await db.exec('RESET ROLE');await assert.rejects(db.exec('UPDATE consent_private.settings SET enabled=true'),/consent_enforcement_not_installed/);
  assert.equal((await db.query("SELECT rolconfig FROM pg_roles WHERE rolname='authenticator'")).rows[0].rolconfig,null);
 }finally {await db.close();}
});
test('authenticated and anonymous clients cannot enumerate records, forge a subject or change rollout',async()=>{
 const db=await setup();try {
  await enable(db);await asUser(db);await decision(db,'health','granted',0,1);
  for(const table of ['settings','documents','user_state','decisions','operations','events','protected_tables']) await assert.rejects(db.query(`SELECT * FROM consent_private.${table}`),/permission denied/);
  await assert.rejects(db.query("SELECT public.check_data_processing_consent($1,'health')",[b]),/permission denied/);
  await asUser(db,b);assert.equal((await snapshot(db)).health,null);
  await asUser(db,null,'anon');await assert.rejects(snapshot(db),/permission denied/);
  await assert.rejects(decision(db,'health','granted',0,2),/permission denied/);
 }finally {await db.close();}
});
test('health and AI choices persist separately with server time and exact text version',async()=>{
 const db=await setup();try {
  await enable(db);await asUser(db);
  await assert.rejects(decision(db,'ai','granted',0,1),/health_consent_required/);
  let s=await decision(db,'health','granted',0,2,'es');assert.equal(s.revision,1);assert.equal(s.ai,null);
  assert.equal(s.health.documentVersion,version);assert.ok(Date.parse(s.health.decidedAt));
  s=await decision(db,'ai','declined',1,3);assert.equal(s.health.decision,'granted');assert.equal(s.ai.decision,'declined');
  assert.equal(await allowed(db,a),true);assert.equal(await allowed(db,a,'ai'),false);
  await asUser(db);s=await snapshot(db);assert.equal(s.ai.decision,'declined');
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT locale FROM consent_private.events ORDER BY revision LIMIT 1')).rows[0].locale,'es');
 }finally {await db.close();}
});
test('AI withdrawal preserves manual health features, health withdrawal also revokes AI',async()=>{
 const db=await setup();try {
  await enable(db);await asUser(db);await decision(db,'health','granted',0,1);await decision(db,'ai','granted',1,2);
  await decision(db,'ai','revoked',2,3);assert.equal(await allowed(db,a),true);assert.equal(await allowed(db,a,'ai'),false);
  await asUser(db);await decision(db,'ai','granted',3,4);const s=await decision(db,'health','revoked',4,5);
  assert.equal(s.health.decision,'revoked');assert.equal(s.ai.decision,'revoked');
  assert.equal(await allowed(db,a),false);
  await asUser(db);const again=await decision(db,'health','granted',5,6);assert.equal(again.ai.decision,'revoked');assert.equal(await allowed(db,a,'ai'),false);
 }finally {await db.close();}
});
test('retries are idempotent and stale grants cannot overwrite withdrawal',async()=>{
 const db=await setup();try {
  await enable(db);await asUser(db);await decision(db,'health','granted',0,1);await decision(db,'health','revoked',1,2);
  const retried=await decision(db,'health','granted',0,1);assert.equal(retried.health.decision,'revoked');assert.equal(retried.revision,2);
  await assert.rejects(decision(db,'health','granted',1,3),/consent_revision_changed/);
  await assert.rejects(decision(db,'health','declined',2,1),/consent_operation_conflict/);
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM consent_private.events')).rows[0].n,2);
 }finally {await db.close();}
});
test('withdrawal remains possible when rollout pauses and obsolete documents never grant access',async()=>{
 const db=await setup();try {
  await enable(db);await asUser(db);await decision(db,'health','granted',0,1);
  await db.exec("RESET ROLE; UPDATE consent_private.settings SET enabled=false");
  await asUser(db);assert.equal((await decision(db,'health','revoked',1,2)).health.decision,'revoked');
  assert.equal(await allowed(db,a),false,'Pausing must not reactivate withdrawn processing');
  await db.exec("RESET ROLE; INSERT INTO consent_private.documents(version,copy) VALUES('new','{}'); UPDATE consent_private.settings SET document_version='new',enabled=true");
  assert.equal(await allowed(db,a),false);
  await asUser(db);await assert.rejects(decision(db,'health','granted',2,3),/consent_document_changed/);
 }finally {await db.close();}
});
test('account deletion cascades the new consent records and cannot leave an identifiable audit behind',async()=>{
 const db=await setup();try {
  await enable(db);await asUser(db);await decision(db,'health','granted',0,1);await decision(db,'ai','declined',1,2);
  await db.exec(`RESET ROLE; DELETE FROM auth.users WHERE id='${a}'`);
  for(const table of ['user_state','decisions','operations','events'])assert.equal((await db.query(`SELECT count(*)::int n FROM consent_private.${table}`)).rows[0].n,0);
 }finally {await db.close();}
});
test('RLS and service writes deny health records after refusal; public health RPCs fail before running',async()=>{
 const db=await setup();try {
  await db.exec(`INSERT INTO public.weight_entries(id,user_id,notes) VALUES('${op(90)}','${a}','synthetic');`);
  await enable(db);await asUser(db);
  assert.equal((await db.query('SELECT * FROM public.weight_entries')).rows.length,0);
  await assert.rejects(db.query(`INSERT INTO public.weight_entries(id,user_id) VALUES('${op(91)}','${a}')`),/health_consent_required|row-level security/);
  await db.exec("SELECT set_config('request.path','/rpc/get_due_date_with_linked_users',false)");
  await assert.rejects(db.query('SELECT public.check_data_consent_access()'),/health_consent_required/);
  await db.exec("SELECT set_config('request.path','/rpc/get_data_consents',false)");await db.query('SELECT public.check_data_consent_access()');
  await decision(db,'health','granted',0,1);assert.equal((await db.query('SELECT * FROM public.weight_entries')).rows.length,1);
  await decision(db,'health','revoked',1,2);
  await asUser(db,null,'service_role');await assert.rejects(db.query(`UPDATE public.weight_entries SET notes='late response' WHERE user_id='${a}'`),/health_consent_required/);
 }finally {await db.close();}
});
test('shared subjects cannot bypass withdrawal via a partner or a consented baby member',async()=>{
 const db=await setup();try {
  await db.exec(`INSERT INTO public.baby_info VALUES('${op(90)}','${a}'); INSERT INTO public.baby_members VALUES('${op(90)}','${b}');`);
  await enable(db);await asUser(db,a);await decision(db,'health','granted',0,1);await decision(db,'ai','granted',1,2);
  await asUser(db,b);await decision(db,'health','granted',0,3);await decision(db,'ai','granted',1,4);
  assert.equal(await allowed(db,b,'ai'),true);
  await asUser(db,a);await decision(db,'ai','revoked',2,5);assert.equal(await allowed(db,b,'ai'),false);assert.equal(await allowed(db,b,'health'),true);
  await asUser(db,a);await decision(db,'health','revoked',3,6);assert.equal(await allowed(db,b,'health'),false);
  await asUser(db,b);assert.equal((await db.query('SELECT * FROM public.baby_info')).rows.length,0);
 }finally {await db.close();}
});
test('anonymous health access is denied and the existing deletion hook is composed',async()=>{
 const db=await setup(true,true);try {
  await asUser(db);await assert.rejects(db.query('SELECT public.check_data_consent_access()'),/synthetic_deletion_block/);
  await db.exec('RESET ROLE; DROP FUNCTION consent_private.check_account_deletion_access()');
  await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_data_consent_access'"); await enable(db);
  await asUser(db,null,'anon');await db.exec('RESET ROLE; GRANT SELECT ON public.weight_entries TO anon');await asUser(db,null,'anon');
  assert.equal((await db.query('SELECT * FROM public.weight_entries')).rows.length,0);
 }finally {await db.close();}
});
test('activation rejects missing rollout evidence or a removed health guard',async()=>{
 const db=await setup();try {
  await assert.rejects(db.exec('UPDATE consent_private.settings SET enabled=true'),/consent_activation_requires_verified_release/);
  await db.exec('DROP POLICY data_consent_health ON public.weight_entries');
  await assert.rejects(enable(db),/consent_activation_requires_verified_release/);
 }finally {await db.close();}
});
test('the invoker hook stays executable for service requests before and after activation',async()=>{
 const db=await setup();try {
  await asUser(db,null,'service_role');await db.query('SELECT public.check_data_consent_access()');
  await enable(db);await asUser(db,null,'service_role');
  await db.exec("SELECT set_config('request.path','/rpc/check_data_processing_consent',false)");
  await db.query('SELECT public.check_data_consent_access()');
  assert.equal(await allowed(db,a),false);
  await assert.rejects(db.query(`INSERT INTO public.weight_entries(id,user_id) VALUES('${op(91)}','${a}')`),/health_consent_required/);
 }finally {await db.close();}
});
test('the real deletion readiness and acceptance still work after consent withdrawal',async()=>{
 const db=new PGlite();try {
  await db.exec(fs.readFileSync('supabase/tests/account_deletion_fixture.sql','utf8'));
  await db.exec('CREATE TABLE public.account_links(creator_id uuid,invited_id uuid,status text); CREATE TABLE public.sleep_entry_shares(owner_id uuid,shared_with_id uuid)');
  for(const name of new Set([...enforcement.matchAll(/\('([a-z_]+)'\)/g)].map(m=>m[1]))) {
   await db.exec(`CREATE TABLE IF NOT EXISTS public.${name}(id uuid,user_id uuid,baby_id uuid); ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;`);
  }
  for(const file of ['20260911065615_account_deletion_jobs.sql','20260930055640_account_deletion_readiness.sql','20260930163849_account_deletion_alarm.sql','20260930170233_account_deletion_cdn_proof.sql','20261001051435_account_deletion_worker_aliases.sql','20261001094535_account_deletion_nullable_actor_rules.sql','20261001122517_account_deletion_supervised_provider_mode.sql','20261001124926_account_deletion_durable_registry.sql']) await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  await db.exec(`ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'; INSERT INTO auth.users(id,last_sign_in_at) VALUES('${a}',now());`);
  await db.exec(core);await db.exec(enforcement);
  await db.exec("UPDATE deletion_private.settings SET approved_by='synthetic-consent-composition',approved_at=now(),receipt_retention_days=90,backup_window_days=30,provider_handling_mode='verified_retention'; UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint();");
  assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,true);
  await enable(db);await asUser(db);await decision(db,'health','granted',0,1);await decision(db,'health','revoked',1,2);
  await asUser(db,null,'service_role');await db.exec("SELECT set_config('request.path','/rpc/account_deletion_worker',false)");
  await db.query('SELECT public.check_account_deletion_access()');
  assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,true);
  const result=(await db.query("SELECT public.account_deletion_worker('accept',$1::jsonb) result",[JSON.stringify({userId:a,scope:'account',source:'app'})])).rows[0].result;
  assert.ok(result.requestId);
 }finally {await db.close();}
});
