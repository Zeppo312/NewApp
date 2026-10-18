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
export async function setup(full=true, deletionHook=false) {
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
export async function asUser(db,uid=a,role='authenticated') {
 await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid??''}',false),set_config('request.jwt.claims','{"role":"${role}"}',false); SET ROLE ${role};`);
}
export async function enable(db) { await db.exec(`RESET ROLE; UPDATE consent_private.settings SET client_release='synthetic-client-test',edge_release='synthetic-edge-test',approved_at=now(),enabled=true;`); }
export async function decision(db,scope,choice,revision,n,locale='de') {
 return (await db.query('SELECT public.record_data_consent($1,$2,$3,$4,$5::uuid,$6::bigint) s',[scope,choice,version,locale,op(n),revision])).rows[0].s;
}
export async function snapshot(db) { return (await db.query('SELECT public.get_data_consents() s')).rows[0].s; }
export async function allowed(db,uid,scope='health') {
 await asUser(db,null,'service_role');
 return (await db.query('SELECT public.check_data_processing_consent($1::uuid,$2) ok',[uid,scope])).rows[0].ok;
}
