import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeBabyDb,asUser,a,b,c,baby,partnerBaby,ownerOnlyBaby,memberQuery,ownerQuery} from './helpers/baby-membership-fixture.mjs';
import {decision,enable} from './helpers/data-consent-fixture.mjs';
const migrationPath='supabase/migrations/20261006043754_optimize_baby_membership_private_read_policy.sql';
const migration=fs.readFileSync(migrationPath,'utf8');
const rollback=fs.readFileSync('output/baby-membership-performance-20261006/v2/rollback.sql','utf8');
const apply=async db=>{await db.exec('RESET ROLE');await db.exec(migration);};
const ids=rows=>rows.map(r=>r.id).sort();
async function read(db,uid=a) {await asUser(db,uid);return (await db.query(memberQuery,[uid])).rows;}
async function all(db,uid=a){await asUser(db,uid);return (await db.query('SELECT id FROM public.baby_info ORDER BY id')).rows;}
async function invariant(db) {
 await db.exec('RESET ROLE');
 return (await db.query(`SELECT jsonb_build_object(
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE NOT (polrelid='public.baby_info'::regclass AND polname='Baby info: select by member')),
 'policy_identity',(SELECT jsonb_build_array(oid,polcmd,polroles,polpermissive,polwithcheck) FROM pg_policy WHERE polrelid='public.baby_info'::regclass AND polname='Baby info: select by member'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl,p.proowner) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','consent_private','deletion_private') AND p.prokind='f' AND p.proname<>'current_accessible_baby_ids'),
 'tables',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','consent_private','deletion_private')),
 'settings',(SELECT to_jsonb(s) FROM consent_private.settings s),
 'deletion_fingerprint',deletion_private.fingerprint(),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,pg_get_triggerdef(oid),tgenabled) ORDER BY oid) FROM pg_trigger WHERE NOT tgisinternal)
 ) AS state`)).rows[0].state;
}

test('five archived legacy listBabies implementations match the current endpoint, projection and filters',()=>{
 const roots=['.family-qa/build-native-before-20260924','.family-qa/build-archive','.family-qa/deletion-native-20261001/archive-inspected-final','.family-qa/app-tester-20261002/archive-ios-corrected','.family-qa/release-candidate-20261003/archive-ios','.'];
 const hashes=roots.map(root=>{const s=fs.readFileSync(root+'/lib/baby.ts','utf8');const start=s.indexOf('export const listBabies');const end=s.indexOf('export const ',start+20);const body=s.slice(start,end);assert.match(body,/baby_members!inner\s*\(\s*role/);assert.match(body,/\.eq\('baby_members.user_id', userId\)/);return crypto.createHash('sha256').update(body).digest('hex');});
 assert.equal(new Set(hashes).size,1);
});

test('only one SELECT predicate and one private caller-bound helper change; rollback restores the predicate',async()=>{
 const db=await makeBabyDb(30);
 try {
  const before=await invariant(db);await apply(db);assert.deepEqual(await invariant(db),before);
  const f=(await db.query(`SELECT p.pronargs,p.prosecdef,p.provolatile,p.proconfig,pg_get_userbyid(p.proowner) AS owner FROM pg_proc p WHERE oid='baby_access_private.current_accessible_baby_ids()'::regprocedure`)).rows[0];
  assert.equal(f.pronargs,0);assert.equal(f.prosecdef,true);assert.equal(f.provolatile,'s');assert.equal(f.owner,'postgres');assert.deepEqual(f.proconfig,['search_path=""']);
  assert.equal((await db.query(`SELECT count(*)::int n FROM pg_proc p,aclexplode(p.proacl) a WHERE p.oid='baby_access_private.current_accessible_baby_ids()'::regprocedure AND a.grantee=0`)).rows[0].n,0);
  await db.exec(rollback);assert.deepEqual(await invariant(db),before);
  assert.equal((await db.query("SELECT to_regprocedure('baby_access_private.current_accessible_baby_ids()') AS f")).rows[0].f,null);
  assert.equal((await db.query("SELECT pg_get_expr(polqual,polrelid) AS q FROM pg_policy WHERE polrelid='public.baby_info'::regclass AND polname='Baby info: select by member'")).rows[0].q,'((user_id = auth.uid()) OR is_baby_member(id))');
 } finally {await db.close();}
});

for(const mode of ['legacy','cohort','global']) test(`old member/owner queries return identical full JSON, roles and ordering (${mode})`,async()=>{
 const db=await makeBabyDb(30);
 try {
  if(mode==='legacy')await db.exec('DELETE FROM consent_private.decisions; DELETE FROM consent_private.user_state;');
  if(mode==='global'){await enable(db);await asUser(db,a);await decision(db,'health','granted',0,1);}
  const outcomes=[];
  for(const optimized of [false,true]) {
   if(optimized)await apply(db);
   const out=[];
   for(const uid of [a,b,c]) {
    const member=await read(db,uid),owner=(await db.query(ownerQuery,[uid])).rows;
    if(uid===a){assert.deepEqual(ids(member),[baby,partnerBaby]);assert.deepEqual(ids(owner),[baby,ownerOnlyBaby]);assert.equal(member[1].baby_members[0].role,'partner');}
    if(uid===c){assert.equal(member.length,0);assert.equal(owner.length,0);}
    // A forged filter for a different UID still does not reveal an unrelated baby.
    const forged=(await db.query(memberQuery,[c])).rows;assert.equal(forged.length,0);
    out.push({member,owner,forged});
   }
   outcomes.push(out);
  }
  assert.deepEqual(outcomes[0],outcomes[1]);
 } finally {await db.close();}
});

test('prepared legacy query sees membership removal and account switching on the next execution',async()=>{
 const db=await makeBabyDb(30);
 try {
  await apply(db);await asUser(db,a);await db.exec('SET plan_cache_mode=force_generic_plan; PREPARE legacy_babies(uuid) AS '+memberQuery);
  assert.deepEqual(ids((await db.query(`EXECUTE legacy_babies('${a}')`)).rows),[baby,partnerBaby]);
  await db.exec(`RESET ROLE; DELETE FROM public.baby_members WHERE baby_id='${partnerBaby}' AND user_id='${a}'`);
  await asUser(db,a);assert.deepEqual(ids((await db.query(`EXECUTE legacy_babies('${a}')`)).rows),[baby]);
  await asUser(db,c);assert.equal((await db.query(`EXECUTE legacy_babies('${a}')`)).rows.length,0);
  await asUser(db,b);assert.deepEqual(ids((await db.query(`EXECUTE legacy_babies('${b}')`)).rows),[partnerBaby]);
 } finally {await db.close();}
});

test('owner and partner withdrawals still block reads; grants restore access on the next statement',async()=>{
 for(const optimized of [false,true]) {
  const db=await makeBabyDb(30);
  try {
   if(optimized)await apply(db);
   assert.equal((await read(db)).length,2);
   await asUser(db,b);await decision(db,'health','revoked',0,2);
   assert.equal((await read(db,a)).length,0);
   await asUser(db,b);await decision(db,'health','granted',1,3);
   assert.equal((await read(db,a)).length,2);
   await asUser(db,a);await decision(db,'health','revoked',0,4);
   assert.equal((await read(db,a)).length,0);
  } finally {await db.close();}
 }
});

test('deletion barrier and anonymous behavior remain unchanged',async()=>{
 const outcomes=[];
 for(const optimized of [false,true]) {
  const db=await makeBabyDb(30);
  try {
   if(optimized)await apply(db);
   await db.exec(`INSERT INTO deletion_private.requests VALUES('${a}','account','pending')`);
   assert.equal((await read(db,a)).length,0);
   await asUser(db,null,'anon');
   try {outcomes.push({rows:(await db.query(memberQuery,[a])).rows});}
   catch(e){outcomes.push({error:e.code});}
   if(optimized){const r=await db.query('SELECT baby_access_private.current_accessible_baby_ids() AS ids');assert.deepEqual(r.rows[0].ids,[]);}
  } finally {await db.close();}
 }
 assert.deepEqual(outcomes[1],outcomes[0]);
});

test('UPDATE and DELETE permission outcomes remain identical for owner, partner and unrelated callers',async()=>{
 const outcomes=[];
 for(const optimized of [false,true]) {
  const db=await makeBabyDb(30);
  try {
   if(optimized)await apply(db);
   const out=[];
   for(const uid of [a,b,c]){
    await asUser(db,uid);
    for(const command of [`UPDATE public.baby_info SET created_at=created_at WHERE id='${partnerBaby}' RETURNING id`,`DELETE FROM public.baby_info WHERE id='${partnerBaby}' RETURNING id`]){
     await db.exec('BEGIN');
     try{out.push({uid,command,ids:ids((await db.query(command)).rows)});}catch(e){out.push({uid,command,error:e.code});}
     await db.exec('ROLLBACK');
    }
   }
   outcomes.push(out);
  } finally {await db.close();}
 }
 assert.deepEqual(outcomes[1],outcomes[0]);
 assert(outcomes[1].filter(x=>x.uid===c).every(x=>x.ids?.length===0));
});

test('new baby INSERT RETURNING fails with 42501; a minimal INSERT remains readable and shares memberships',async()=>{
 const db=await makeBabyDb(10);
 const id='30000000-0000-4000-8000-000000000010';
 try {
  await db.exec(fs.readFileSync('supabase/migrations/20270107000004_share_new_babies_with_links.sql','utf8'));
  await db.exec(`INSERT INTO public.account_links(creator_id,invited_id,status) VALUES('${a}','${b}','accepted')`);
  await apply(db);await asUser(db,a);
  await assert.rejects(db.query('INSERT INTO public.baby_info(id,user_id) VALUES($1,$2) RETURNING *',[id,a]),e=>e.code==='42501'&&/new row violates row-level security policy for table "baby_info"/.test(e.message));
  assert.equal((await db.query('SELECT id FROM public.baby_info WHERE id=$1',[id])).rows.length,0);
  await db.query('INSERT INTO public.baby_info(id,user_id) VALUES($1,$2)',[id,a]);
  assert.deepEqual((await db.query('SELECT id,user_id FROM public.baby_info WHERE id=$1',[id])).rows,[{id,user_id:a}]);
  assert.equal((await db.query('SELECT role FROM public.baby_members WHERE baby_id=$1 AND user_id=$2',[id,a])).rows[0].role,'owner');
  await asUser(db,b);
  assert.equal((await db.query('SELECT id FROM public.baby_info WHERE id=$1',[id])).rows[0].id,id);
  assert.equal((await db.query('SELECT role FROM public.baby_members WHERE baby_id=$1 AND user_id=$2',[id,b])).rows[0].role,'partner');
  await asUser(db,c);
  assert.equal((await db.query('SELECT id FROM public.baby_info WHERE id=$1',[id])).rows.length,0);
  await assert.rejects(db.query('INSERT INTO public.baby_info(id,user_id) VALUES($1,$2)',[id,a]),e=>e.code==='42501');
 } finally {await db.close();}
});

test('minimal baby INSERT still enforces health consent and account deletion barriers',async()=>{
 const db=await makeBabyDb(10);
 const id='30000000-0000-4000-8000-000000000010';
 try {
  await apply(db);await asUser(db,a);
  await decision(db,'health','revoked',0,10);
  await assert.rejects(db.query('INSERT INTO public.baby_info(id,user_id) VALUES($1,$2)',[id,a]),e=>e.code==='42501');
  await decision(db,'health','granted',1,11);
  await db.exec(`RESET ROLE; INSERT INTO deletion_private.requests VALUES('${a}','account','pending')`);
  await asUser(db,a);
  await assert.rejects(db.query('INSERT INTO public.baby_info(id,user_id) VALUES($1,$2)',[id,a]),e=>e.code==='42501');
  await db.exec(`RESET ROLE; DELETE FROM deletion_private.requests WHERE user_id='${a}'`);
  await asUser(db,a);
  await db.query('INSERT INTO public.baby_info(id,user_id) VALUES($1,$2)',[id,a]);
  assert.equal((await db.query('SELECT id FROM public.baby_info WHERE id=$1',[id])).rows[0].id,id);
 } finally {await db.close();}
});

test('policy drift aborts atomically without installing the helper',async()=>{
 const db=await makeBabyDb(30);
 try {
  await db.exec('ALTER POLICY "Baby info: select by member" ON public.baby_info USING(false)');
  await assert.rejects(db.exec(migration),/baby_membership_read_policy_drift/);await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT to_regprocedure('baby_access_private.current_accessible_baby_ids()') AS f")).rows[0].f,null);
 } finally {await db.close();}
});

test('more than 1000 memberships keep the legacy limit and unbounded visibility unchanged',async()=>{
 const db=await makeBabyDb(1105);
 try {
  await db.exec(`INSERT INTO public.baby_members(baby_id,user_id,role) SELECT id,'${a}','partner' FROM public.baby_info WHERE user_id<>'${a}' ON CONFLICT DO NOTHING`);
  const before=await read(db,a),visible=await all(db,a);
  assert.equal(before.length,1000);assert.equal(visible.length,1105);
  await apply(db);assert.deepEqual(await read(db,a),before);assert.deepEqual(await all(db,a),visible);
 } finally {await db.close();}
});

test('ownership transfer is re-evaluated and never leaves a cached owner-only baby visible',async()=>{
 const db=await makeBabyDb(30);
 try {
  await apply(db);assert(ids(await all(db,a)).includes(ownerOnlyBaby));
  await db.exec(`RESET ROLE; UPDATE public.baby_info SET user_id='${c}' WHERE id='${ownerOnlyBaby}'`);
  assert(!ids(await all(db,a)).includes(ownerOnlyBaby));
  assert.deepEqual(ids(await all(db,c)),[ownerOnlyBaby]);
 } finally {await db.close();}
});

test('the actual deletion fingerprint detects the rejected consent-schema helper',async()=>{
 const db=await makeBabyDb(30);
 try {
  const fingerprint=async()=> (await db.query('SELECT deletion_private.fingerprint() AS f')).rows[0].f;
  const before=await fingerprint();
  await db.exec(fs.readFileSync('supabase/migrations/20261006042946_optimize_baby_membership_read_policy.sql','utf8'));
  assert.notEqual(await fingerprint(),before);
  await db.exec(fs.readFileSync('supabase/migrations/20261006043717_rollback_baby_membership_consent_schema_helper.sql','utf8'));
  assert.equal(await fingerprint(),before);
  await apply(db);assert.equal(await fingerprint(),before);
 } finally {await db.close();}
});
