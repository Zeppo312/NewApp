import fs from 'node:fs';
import {makeBabyDb,asUser,a,b,c,baby,partnerBaby,ownerOnlyBaby} from './baby-membership-fixture.mjs';
export {asUser,a,b,c,baby,partnerBaby,ownerOnlyBaby};
export const d='10000000-0000-4000-8000-000000000004';
export const e='10000000-0000-4000-8000-000000000005';
export const foreignBaby='30000000-0000-4000-8000-000000000004';
export const sid=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const sleepCatalog=JSON.parse(fs.readFileSync('output/sleep-performance-readonly-20261006-0704Z/catalog.json')).data[0].catalog;
export const liveCatalog=JSON.parse(fs.readFileSync('output/sleep-access-performance-20261006/production-catalog.json')).data[0].catalog;
const columns=JSON.parse(fs.readFileSync('output/profile-performance-20261005/performance-catalog.json')).data[0].catalog.columns;
export const candidatePath='supabase/migrations/20261006082734_optimize_sleep_select_access.sql';
export const candidate=()=>fs.readFileSync(candidatePath,'utf8');
export async function makeSleepDb(size=40) {
 const db=await makeBabyDb(30);
 await db.exec(fs.readFileSync('supabase/migrations/20261006043754_optimize_baby_membership_private_read_policy.sql','utf8'));
 for(const table of ['sleep_entries','sleep_entry_shares','account_links']) {
  const existing=(await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,[table])).rows.map(r=>r.column_name);
  for(const col of columns.filter(x=>x.table_name===table&&!existing.includes(x.column_name))) await db.exec(`ALTER TABLE public.${table} ADD COLUMN ${col.column_name} ${col.udt_name}`);
  await db.exec(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; GRANT ALL ON public.${table} TO authenticated,service_role; GRANT SELECT ON public.${table} TO anon;`);
  for(const p of (await db.query("SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=$1",[table])).rows) await db.exec(`DROP POLICY "${p.policyname}" ON public.${table}`);
  for(const p of sleepCatalog.policies.filter(p=>p.tablename===table)) await db.exec(`CREATE POLICY "${p.policyname}" ON public.${table} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.join(',')} ${p.qual?'USING ('+p.qual+')':''} ${p.with_check?'WITH CHECK ('+p.with_check+')':''}`);
  for(const i of sleepCatalog.indexes.filter(i=>i.table===table)) if(!(await db.query('SELECT to_regclass($1) r',['public.'+i.name])).rows[0].r) await db.exec(i.definition);
 }
 await db.exec(`INSERT INTO auth.users VALUES('${d}'),('${e}');
 INSERT INTO public.baby_info(id,user_id) VALUES('${foreignBaby}','${c}');
 INSERT INTO public.account_links(id,creator_id,invited_id,status,relationship_type) VALUES
 (md5('link-d')::uuid,'${d}','${a}','accepted','partner'),
 (md5('link-e')::uuid,'${a}','${e}','accepted','friend');`);
 const seeds=[
  [1,a,baby,null,null],[2,c,foreignBaby,a,null],[3,c,foreignBaby,null,a],
  [4,c,partnerBaby,null,null],[5,c,foreignBaby,null,null],[6,a,null,null,null],
  [7,c,null,null,null],[8,d,foreignBaby,null,null],[9,c,foreignBaby,null,null],
  [10,c,ownerOnlyBaby,null,null],[11,a,baby,a,null],[12,e,null,null,null],
 ];
 for(const [n,owner,bid,partner,legacy] of seeds) await db.query(`INSERT INTO public.sleep_entries(id,user_id,baby_id,partner_id,shared_with_user_id,start_time,end_time,duration_minutes,quality,notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'2026-01-01'::timestamptz+$6::int*interval '1 hour',NULL,NULL,NULL,'synthetic','2026-01-01','2026-01-01')`,[sid(n),owner,bid,partner,legacy,n]);
 if(size>12) await db.exec(`INSERT INTO public.sleep_entries(id,user_id,baby_id,start_time,end_time,duration_minutes,quality,notes,created_at,updated_at)
 SELECT md5('sleep'||i)::uuid,CASE WHEN i%100=0 THEN '${a}'::uuid ELSE '${c}'::uuid END,
 CASE WHEN i%100=0 THEN '${baby}'::uuid ELSE '${foreignBaby}'::uuid END,
 '2026-01-02'::timestamptz+i*interval '1 second',NULL,NULL,NULL,'synthetic','2026-01-01','2026-01-01' FROM generate_series(13,${size})i;`);
 for(const f of sleepCatalog.functions.filter(f=>f.signature==='get_all_visible_sleep_entries(uuid)')) await db.exec(f.definition);
 for(const f of liveCatalog.functions.filter(f=>['auth.uid()','get_all_visible_sleep_entries()','consent_private.check_account_deletion_access()'].includes(f.signature))) await db.exec(f.definition);
 await db.exec(JSON.parse(fs.readFileSync('output/sleep-performance-readonly-20261006-0704Z/additional-catalog.json')).data[0].pre_request_definition);
 // Include real write authorization triggers; a SELECT-only fixture otherwise
 // overstates which existing member/link updates are actually allowed.
 const metadata=JSON.parse(fs.readFileSync('output/sleep-access-performance-20261006/qa-write-metadata.json'))[0].metadata;
 for(const t of metadata.triggers.filter(t=>['sleep_entry_permissions_trigger','trg_set_sleep_partner_id','update_sleep_entries_updated_at','account_deletion_guard'].some(n=>t.trigger.includes('TRIGGER '+n+' ')))) {
  await db.exec(t.function);
  if(!(await db.query('SELECT 1 FROM pg_trigger WHERE tgrelid=$1::regclass AND pg_get_triggerdef(oid)=$2',['public.'+t.table,t.trigger])).rows.length) await db.exec(t.trigger);
 }
 await db.exec("ALTER TABLE sleep_entry_shares ADD CONSTRAINT fixture_share_not_self CHECK(owner_id<>shared_with_id)");
 await db.exec('ANALYZE');
 return db;
}
export async function addShares(db) {
 await db.exec(`RESET ROLE; INSERT INTO public.sleep_entry_shares(id,entry_id,owner_id,shared_with_id) VALUES
 (md5('share2')::uuid,'${sid(2)}','${c}','${a}'),
 (md5('share4')::uuid,'${sid(4)}','${c}','${a}'),
 (md5('share9')::uuid,'${sid(9)}','${c}','${a}'),
 (md5('share5b')::uuid,'${sid(5)}','${c}','${b}'); ANALYZE public.sleep_entry_shares;`);
}
export const directQuery=`SELECT se.* FROM public.sleep_entries se WHERE (se.user_id=$1::uuid OR se.partner_id=$1::uuid OR se.shared_with_user_id=$1::uuid) AND ($2::uuid IS NULL OR se.baby_id=$2::uuid) ORDER BY se.start_time DESC LIMIT $3 OFFSET $4`;
export const shareQuery=`SELECT se.*,coalesce(s.shares,'[]'::jsonb) AS sleep_entry_shares FROM public.sleep_entries se
 INNER JOIN LATERAL (SELECT json_agg(x)::jsonb AS shares FROM (SELECT shared_with_id FROM public.sleep_entry_shares WHERE entry_id=se.id AND shared_with_id=$1::uuid LIMIT $5 OFFSET $6) x) s ON s.shares IS NOT NULL
 WHERE ($2::uuid IS NULL OR se.baby_id=$2::uuid) ORDER BY se.start_time DESC LIMIT $3 OFFSET $4`;
// Independent, deliberately unoptimized authorization reference: correct the
// baby correlation and retain an explicit recipient's legitimate entry access.
export const correctedPolicies=sleepCatalog.policies.filter(p=>p.tablename==='sleep_entries'&&p.cmd==='SELECT').map(p=>`ALTER POLICY "${p.policyname}" ON public.sleep_entries USING (${p.qual.replaceAll('bm.baby_id = bm.baby_id','bm.baby_id = sleep_entries.baby_id')}${p.policyname==='Sleep entries: select by member'?` OR EXISTS(SELECT 1 FROM public.sleep_entry_shares ss WHERE ss.entry_id=sleep_entries.id AND ss.shared_with_id=auth.uid())`:''});`).join('\n');
export const rollbackPolicies=sleepCatalog.policies.filter(p=>p.tablename==='sleep_entries'&&p.cmd==='SELECT').map(p=>`ALTER POLICY "${p.policyname}" ON public.sleep_entries USING (${p.qual});`).join('\n');
