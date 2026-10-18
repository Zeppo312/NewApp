import fs from 'node:fs';
import {setup, asUser} from './data-consent-fixture.mjs';
export {asUser};
export const a='10000000-0000-4000-8000-000000000001';
export const b='10000000-0000-4000-8000-000000000002';
export const c='10000000-0000-4000-8000-000000000003';
export const baby='30000000-0000-4000-8000-000000000001';
export const partnerBaby='30000000-0000-4000-8000-000000000002';
export const ownerOnlyBaby='30000000-0000-4000-8000-000000000003';
export const catalog=JSON.parse(fs.readFileSync('output/baby-membership-performance-20261006/catalog-before.json')).data[0].catalog;
const columns=JSON.parse(fs.readFileSync('output/profile-performance-20261005/performance-catalog.json')).data[0].catalog.columns;
export async function makeBabyDb(size=3839) {
 const db=await setup();
 await db.exec(`CREATE FUNCTION consent_private.require_live_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'account_not_found'; END IF; END $$;`);
 for(const name of ['20261003160141_data_consent_release_cohort','20261003164934_data_consent_self_service','20261005191027_optimize_consent_policy_evaluation']) await db.exec(fs.readFileSync('supabase/migrations/'+name+'.sql','utf8'));
 for(const table of ['baby_info','baby_members','account_links','sleep_entry_shares']) {
  const existing=(await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}'`)).rows.map(r=>r.column_name);
  for(const col of columns.filter(x=>x.table_name===table&&!existing.includes(x.column_name))) await db.exec(`ALTER TABLE public.${table} ADD COLUMN ${col.column_name} ${col.udt_name}`);
 }
 await db.exec(`CREATE SCHEMA deletion_private; CREATE TABLE deletion_private.requests(user_id uuid,scope text,status text);
 GRANT USAGE ON SCHEMA deletion_private TO anon,authenticated,service_role;
 INSERT INTO auth.users VALUES('${c}');
 INSERT INTO public.baby_info(id,user_id,created_at) VALUES('${baby}','${a}','2026-01-01'),('${partnerBaby}','${b}','2026-01-02'),('${ownerOnlyBaby}','${a}','2026-01-03');
 INSERT INTO public.baby_info(id,user_id,created_at) SELECT md5('baby'||i)::uuid,md5('owner'||i)::uuid,'2026-01-04'::timestamptz+i*interval '1 second' FROM generate_series(4,${size})i;
 INSERT INTO auth.users SELECT DISTINCT user_id FROM public.baby_info ON CONFLICT DO NOTHING;
 INSERT INTO public.baby_members(baby_id,user_id,role) SELECT id,user_id,'parent' FROM public.baby_info WHERE id<>'${ownerOnlyBaby}';
 INSERT INTO public.baby_members(baby_id,user_id,role) VALUES('${partnerBaby}','${a}','partner');
 UPDATE consent_private.settings SET self_service_enabled=true;
 INSERT INTO consent_private.user_state(user_id,enforcement_started_at,client_release,installation_evidence) VALUES('${b}',now(),'synthetic','synthetic-compatibility');
 INSERT INTO consent_private.decisions(user_id,scope,decision,document_version,decided_at) VALUES('${b}','health','granted','2026-10-01.1',now());`);
 for(const f of catalog.functions.filter(x=>['is_baby_member(uuid)','deletion_private.blocked(uuid)'].includes(x.signature))) await db.exec(f.definition);
 for(const i of catalog.indexes.filter(x=>['baby_info','baby_members','account_links','sleep_entry_shares'].includes(x.tablename))) {
  if(!(await db.query('SELECT to_regclass($1) AS id',['public.'+i.indexname])).rows[0].id) await db.exec(i.indexdef);
 }
 for(const table of ['baby_info','baby_members']) {
  for(const p of (await db.query('SELECT policyname FROM pg_policies WHERE schemaname=\'public\' AND tablename=$1',[table])).rows) await db.exec(`DROP POLICY "${p.policyname}" ON public.${table}`);
  for(const p of catalog.policies.filter(x=>x.tablename===table)) await db.exec(`CREATE POLICY "${p.policyname}" ON public.${table} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.join(',')} ${p.qual?'USING ('+p.qual+')':''} ${p.with_check?'WITH CHECK ('+p.with_check+')':''}`);
  await db.exec(`GRANT SELECT ON public.${table} TO anon`);
 }
 // Use the real production fingerprint implementation, not a stand-in: adding
 // functions to consent_private must not silently invalidate deletion approval.
 await db.exec(`CREATE TABLE deletion_private.rules(schema_name text,table_name text,column_name text,action text);
 CREATE TABLE deletion_private.settings(storage_origin text,provider_handling_mode text,consent_handling_policy text);
 INSERT INTO deletion_private.settings VALUES('synthetic','supervised','synthetic');`);
 await db.exec(catalog.functions.find(f=>f.signature==='deletion_private.fingerprint()').definition);
 await db.exec('GRANT SELECT ON public.account_links TO authenticated; ANALYZE;');
 return db;
}
// Same nested role response, member filter, order and limit as the legacy Data API call.
export const memberQuery=`SELECT b.*,coalesce(m.members,'[]'::jsonb) AS baby_members FROM public.baby_info b INNER JOIN LATERAL (SELECT json_agg(m)::jsonb AS members FROM (SELECT role FROM public.baby_members WHERE baby_id=b.id AND user_id=$1::uuid LIMIT 1000 OFFSET 0) m) m ON m.members IS NOT NULL ORDER BY b.created_at ASC LIMIT 1000 OFFSET 0`;
export const ownerQuery=`SELECT * FROM public.baby_info WHERE user_id=$1::uuid ORDER BY created_at ASC LIMIT 1000`;
