import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeSleepDb,asUser,a,b,c,d,e,baby,partnerBaby,ownerOnlyBaby,foreignBaby,sid,shareQuery,directQuery,candidate,correctedPolicies,rollbackPolicies,addShares,sleepCatalog} from './helpers/sleep-access-fixture.mjs';
import {decision,enable} from './helpers/data-consent-fixture.mjs';
const ids=rows=>rows.map(r=>r.id).sort();
const expected=[1,2,3,4,6,8,11,12].map(sid).sort();
const apply=async db=>{await db.exec('RESET ROLE');await db.exec(candidate());};
const all=async(db,uid=a)=>{await asUser(db,uid);return (await db.query('SELECT * FROM public.sleep_entries ORDER BY start_time DESC')).rows;};
async function invariant(db) {
 await db.exec('RESET ROLE');
 return (await db.query(`SELECT jsonb_build_object(
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE NOT (polrelid='public.sleep_entries'::regclass AND polname IN ('Sleep entries: select by member','sleep_select_owner_and_partner'))),
 'identities',(SELECT jsonb_agg(jsonb_build_array(oid,polrelid,polname,polcmd,polroles,polpermissive,polwithcheck) ORDER BY oid) FROM pg_policy WHERE polrelid='public.sleep_entries'::regclass AND polcmd='r'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl,p.proowner,p.provolatile,p.proconfig) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','consent_private','deletion_private','baby_access_private') AND p.prokind='f'),
 'tables',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','consent_private','deletion_private') AND c.relname NOT IN ('sleep_entries_partner_read_idx','sleep_entries_legacy_share_read_idx')),
 'settings',(SELECT to_jsonb(s) FROM consent_private.settings s),'fingerprint',deletion_private.fingerprint(),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(oid,pg_get_triggerdef(oid),tgenabled) ORDER BY oid) FROM pg_trigger WHERE NOT tgisinternal)
 ) state`)).rows[0].state;
}

test('fixture contains the actual lookup and sleep policies, with no permissive fixture escape',async()=>{
 const db=await makeSleepDb(12);try{
  for(const table of ['sleep_entries','sleep_entry_shares','account_links']) {
   const got=(await db.query('SELECT policyname,qual,with_check FROM pg_policies WHERE tablename=$1 ORDER BY policyname',[table])).rows;
   const want=sleepCatalog.policies.filter(p=>p.tablename===table).map(({policyname,qual,with_check})=>({policyname,qual,with_check})).sort((a,b)=>a.policyname.localeCompare(b.policyname));
   assert.deepEqual(got.sort((a,b)=>a.policyname.localeCompare(b.policyname)),want);
  }
 }finally{await db.close();}
});

test('two SELECT expressions and two expected indexes change; other protections and actual fingerprint stay identical',async()=>{
 const db=await makeSleepDb(12);try{
  const before=await invariant(db);await apply(db);assert.deepEqual(await invariant(db),before);
  const indexes=(await db.query("SELECT indexdef FROM pg_indexes WHERE indexname IN ('sleep_entries_partner_read_idx','sleep_entries_legacy_share_read_idx') ORDER BY indexname")).rows.map(x=>x.indexdef);
  assert.deepEqual(indexes,['CREATE INDEX sleep_entries_legacy_share_read_idx ON public.sleep_entries USING btree (shared_with_user_id) WHERE (shared_with_user_id IS NOT NULL)','CREATE INDEX sleep_entries_partner_read_idx ON public.sleep_entries USING btree (partner_id) WHERE (partner_id IS NOT NULL)']);
  // Operational fallback retains corrected access instead of restoring the old leak.
  await db.exec(correctedPolicies+' DROP INDEX sleep_entries_partner_read_idx; DROP INDEX sleep_entries_legacy_share_read_idx;');
  assert.deepEqual(await invariant(db),before);assert.deepEqual(ids(await all(db)),expected);
 }finally{await db.close();}
});

test('drift aborts before either policy is changed',async()=>{
 const db=await makeSleepDb(12);try{
  await db.exec('ALTER POLICY sleep_select_owner_and_partner ON public.sleep_entries USING(false)');
  const before=(await db.query("SELECT policyname,qual FROM pg_policies WHERE tablename='sleep_entries' ORDER BY policyname")).rows;
  await assert.rejects(()=>db.exec(candidate()),/sleep_policy_drift/);await db.exec('ROLLBACK');
  assert.deepEqual((await db.query("SELECT policyname,qual FROM pg_policies WHERE tablename='sleep_entries' ORDER BY policyname")).rows,before);
 }finally{await db.close();}
});

for(const mode of ['legacy','cohort','global']) test(`correct owner, partner, legacy, matching membership and all accepted link types (${mode})`,async()=>{
 const db=await makeSleepDb(12);try{
  if(mode==='legacy')await db.exec('DELETE FROM consent_private.decisions; DELETE FROM consent_private.user_state');
  if(mode==='global') {
   await enable(db);
   await db.exec(`INSERT INTO consent_private.decisions(user_id,scope,decision,document_version,decided_at) SELECT id,'health','granted','2026-10-01.1',now() FROM auth.users ON CONFLICT(user_id,scope) DO UPDATE SET decision='granted'`);
  }
  await apply(db);assert.deepEqual(ids(await all(db)),expected);
  assert(!(await all(db)).some(r=>[sid(5),sid(7),sid(9),sid(10)].includes(r.id)));
 }finally{await db.close();}
});

for(const populated of [false,true]) test(`full JSON, embedding, inner join, paging, NULL baby and direct OR preserve corrected contract (shares=${populated})`,async()=>{
 const db=await makeSleepDb(12);try{
  if(populated)await addShares(db);
  await db.exec(correctedPolicies);const before=[];
  for(const bid of [null,baby,partnerBaby,foreignBaby])for(const [limit,offset] of [[1000,0],[1,0],[1,1],[1,2]]) {
   await asUser(db,a);before.push((await db.query(directQuery,[a,bid,limit,offset])).rows,(await db.query(shareQuery,[a,bid,limit,offset,1000,0])).rows);
  }
  await db.exec('RESET ROLE');await db.exec(rollbackPolicies);await apply(db);const after=[];
  for(const bid of [null,baby,partnerBaby,foreignBaby])for(const [limit,offset] of [[1000,0],[1,0],[1,1],[1,2]]) {
   await asUser(db,a);after.push((await db.query(directQuery,[a,bid,limit,offset])).rows,(await db.query(shareQuery,[a,bid,limit,offset,1000,0])).rows);
  }
  assert.deepEqual(after,before);
  const shared=(await db.query(shareQuery,[a,null,1000,0,1000,0])).rows;
  assert.deepEqual(ids(shared),populated?[sid(2),sid(4),sid(9)]:[]);
  for(const row of shared)assert.deepEqual(row.sleep_entry_shares,[{shared_with_id:a}]);
  assert.equal((await db.query(shareQuery,[a,null,1000,0,0,0])).rows.length,0);
  assert.equal((await db.query(shareQuery,[a,null,1000,0,1000,1])).rows.length,0);
 }finally{await db.close();}
});

test('explicit individual share survives REST and unchanged UUID RPC, even without any membership',async()=>{
 const db=await makeSleepDb(12);try{
  await addShares(db);await asUser(db,a);
  const before=(await db.query('SELECT * FROM public.get_all_visible_sleep_entries($1::uuid)',[null])).rows;
  assert(before.some(r=>r.id===sid(9)));
  await apply(db);await asUser(db,a);
  assert.deepEqual((await db.query('SELECT * FROM public.get_all_visible_sleep_entries($1::uuid)',[null])).rows,before);
  assert.equal((await db.query('SELECT * FROM public.get_all_visible_sleep_entries($1::uuid)',[foreignBaby])).rows.some(r=>r.id===sid(9)),true);
  assert((await db.query(shareQuery,[a,null,1000,0,1000,0])).rows.some(r=>r.id===sid(9)));
  await db.exec(`RESET ROLE; DELETE FROM baby_members WHERE user_id='${a}'; DELETE FROM account_links WHERE creator_id='${a}' OR invited_id='${a}'`);
  await asUser(db,a);assert((await db.query(shareQuery,[a,null,1000,0,1000,0])).rows.some(r=>r.id===sid(9)));
 }finally{await db.close();}
});

test('prepared generic plan refreshes membership/link access and user identity each statement',async()=>{
 const db=await makeSleepDb(12);try{
  await apply(db);await asUser(db,a);await db.exec('SET plan_cache_mode=force_generic_plan; PREPARE sleep_all AS SELECT id FROM public.sleep_entries');
  assert.deepEqual(ids((await db.query('EXECUTE sleep_all')).rows),expected);
  await db.exec(`RESET ROLE; DELETE FROM baby_members WHERE user_id='${a}' AND baby_id='${partnerBaby}'; UPDATE account_links SET status='pending' WHERE creator_id='${d}'; DELETE FROM account_links WHERE invited_id='${e}'`);
  await asUser(db,a);assert.deepEqual(ids((await db.query('EXECUTE sleep_all')).rows),expected.filter(x=>![sid(4),sid(8),sid(12)].includes(x)));
  await asUser(db,e);assert.equal((await db.query('EXECUTE sleep_all')).rows.length,1);
  await asUser(db,null,'anon');assert.equal((await db.query('EXECUTE sleep_all')).rows.length,0);
 }finally{await db.close();}
});

for(const subject of [a,b,d,c]) test(`health withdrawal still denies rows/family and regrant restores (subject ${subject.slice(-1)})`,async()=>{
 const db=await makeSleepDb(12);try{
  await apply(db);assert.deepEqual(ids(await all(db)),expected);
  await asUser(db,subject);await decision(db,'health','revoked',0,1);
  const revoked=await all(db);
  if(subject!==c)assert.equal(revoked.length,0);else assert(revoked.every(r=>r.user_id!==c));
  await asUser(db,subject);await decision(db,'health','granted',1,2);
  assert.deepEqual(ids(await all(db)),expected);
 }finally{await db.close();}
});

test('AI revocation does not revoke manual health access',async()=>{
 const db=await makeSleepDb(12);try{await apply(db);await asUser(db,a);await decision(db,'health','granted',0,1);await decision(db,'ai','revoked',1,2);assert.deepEqual(ids(await all(db)),expected);}finally{await db.close();}
});

for(const [scope,status,blocked] of [['account','pending',true],['account','failed',true],['account','completed',true],['data','pending',true],['data','completed',false]]) test(`deletion guard ${scope}/${status}`,async()=>{
 const db=await makeSleepDb(12);try{await apply(db);await db.exec(`INSERT INTO deletion_private.requests VALUES('${a}','${scope}','${status}')`);assert.equal((await all(db)).length,blocked?0:8);}finally{await db.close();}
});

test('existing create/update/stop/delete outcomes, including write-trigger denials, are preserved',async()=>{
 const results=[];
 for(const optimized of [false,true]){
  const db=await makeSleepDb(12);try{
   if(optimized)await apply(db);await asUser(db,a);const out=[];
   out.push((await db.query(`INSERT INTO sleep_entries(id,user_id,baby_id,start_time) VALUES($1,$2,$3,'2026-02-01') RETURNING *`,[sid(100),a,baby])).rows);
   for(const n of [1,2,3,4,8,12]) {
    try{const rows=(await db.query('UPDATE sleep_entries SET notes=$1,end_time=start_time+interval \'1 hour\',duration_minutes=60 WHERE id=$2 RETURNING *',['updated',sid(n)])).rows.map(({updated_at,...r})=>r);out.push(rows);assert.equal(rows.length,1);}
    catch(error){assert([3,4,8,12].includes(n));assert.match(error.message,/Keine Berechtigung/);out.push({error:error.code});}
   }
   for(const n of [1,2,3,4,8,12])out.push((await db.query('DELETE FROM sleep_entries WHERE id=$1 RETURNING *',[sid(n)])).rows);
   results.push(out.map(rows=>Array.isArray(rows)?rows.map(({updated_at,...r})=>r):rows));
  }finally{await db.close();}
 }
 assert.deepEqual(results[1],results[0]);
});

test('no implicit 1000-row cap in membership lookup or allowed history',async()=>{
 const db=await makeSleepDb(12);try{
  await db.exec(`INSERT INTO baby_info(id,user_id) SELECT md5('many-baby'||i)::uuid,'${c}'::uuid FROM generate_series(1,1105)i;
  INSERT INTO baby_members(baby_id,user_id) SELECT md5('many-baby'||i)::uuid,'${a}'::uuid FROM generate_series(1,1105)i;
  INSERT INTO sleep_entries(id,user_id,baby_id,start_time) SELECT md5('many-entry'||i)::uuid,'${c}'::uuid,md5('many-baby'||i)::uuid,'2026-03-01'::timestamptz+i*interval '1 second' FROM generate_series(1,1105)i; ANALYZE;`);
  await apply(db);const rows=await all(db);assert.equal(rows.length,1113);
  assert(rows.some(r=>r.start_time.toISOString?.()==='2026-03-01T00:18:25.000Z'||String(r.start_time).startsWith('2026-03-01 00:18:25')));
 }finally{await db.close();}
});

test('generic plan refreshes explicit shares, consent, deletion and authenticated NULL identity',async()=>{
 const db=await makeSleepDb(12);try{
  await addShares(db);await apply(db);await asUser(db,a);
  await db.exec('SET plan_cache_mode=force_generic_plan; PREPARE shared_sleep AS SELECT id FROM sleep_entries ORDER BY id');
  const run=async()=>ids((await db.query('EXECUTE shared_sleep')).rows);
  const initial=await run();assert(initial.includes(sid(9)));
  await db.exec(`RESET ROLE; DELETE FROM sleep_entry_shares WHERE entry_id='${sid(9)}';`);await asUser(db,a);assert(!(await run()).includes(sid(9)));
  await db.exec(`RESET ROLE; INSERT INTO sleep_entry_shares(id,entry_id,owner_id,shared_with_id) VALUES(md5('share9')::uuid,'${sid(9)}','${c}','${a}')`);await asUser(db,a);assert.deepEqual(await run(),initial);
  await asUser(db,c);await decision(db,'health','revoked',0,1);await asUser(db,a);assert.deepEqual(await run(),[]);
  await asUser(db,c);await decision(db,'health','granted',1,2);await asUser(db,a);assert.deepEqual(await run(),initial);
  await db.exec(`RESET ROLE; INSERT INTO deletion_private.requests VALUES('${a}','data','pending')`);await asUser(db,a);assert.deepEqual(await run(),[]);
  await db.exec('RESET ROLE; DELETE FROM deletion_private.requests');await asUser(db,a);assert.deepEqual(await run(),initial);
  await asUser(db,null);assert.deepEqual(await run(),[]);
 }finally{await db.close();}
});

test('real pre-request composition retains deletion-first and health checks; both RPC overloads unchanged',async()=>{
 const db=await makeSleepDb(12);try{
  await addShares(db);await asUser(db,a);
  // The existing zero-argument overload collides with the UUID default.
  // Preserve and report that existing behavior rather than claiming it succeeds.
  await assert.rejects(()=>db.query('SELECT * FROM get_all_visible_sleep_entries()'),{code:'42725'});
  await apply(db);await asUser(db,a);await db.exec("SELECT set_config('request.path','/sleep_entries',false); SELECT public.check_account_deletion_access()");
  await assert.rejects(()=>db.query('SELECT * FROM get_all_visible_sleep_entries()'),{code:'42725'});
  await decision(db,'health','revoked',0,1);await assert.rejects(()=>db.query('SELECT public.check_account_deletion_access()'),/health_consent_required/);
  await db.exec(`RESET ROLE; INSERT INTO deletion_private.requests VALUES('${a}','account','pending')`);await asUser(db,a);
  await assert.rejects(()=>db.query('SELECT public.check_account_deletion_access()'),/account_deletion_pending/);
 }finally{await db.close();}
});

test('second-index name collision atomically restores policies and removes first new index',async()=>{
 const db=await makeSleepDb(12);try{
  await db.exec('CREATE INDEX sleep_entries_legacy_share_read_idx ON sleep_entries(notes)');
  const before=(await db.query("SELECT policyname,qual FROM pg_policies WHERE tablename='sleep_entries' ORDER BY policyname")).rows;
  await assert.rejects(()=>db.exec(candidate()));await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT to_regclass('public.sleep_entries_partner_read_idx') r")).rows[0].r,null);
  assert.deepEqual((await db.query("SELECT policyname,qual FROM pg_policies WHERE tablename='sleep_entries' ORDER BY policyname")).rows,before);
 }finally{await db.close();}
});

test('exact guarded fallback preserves corrected access including shares and removes only the new indexes',async()=>{
 const db=await makeSleepDb(12);try{
  await addShares(db);await apply(db);const before=await all(db);
  await db.exec('RESET ROLE');await db.exec(fs.readFileSync('output/sleep-access-performance-20261006/safe-fallback.sql','utf8'));
  assert.deepEqual(await all(db),before);assert(!(await all(db)).some(x=>x.id===sid(5)));
  await db.exec('RESET ROLE');assert.equal((await db.query("SELECT count(*)::int n FROM pg_indexes WHERE indexname IN ('sleep_entries_partner_read_idx','sleep_entries_legacy_share_read_idx')")).rows[0].n,0);
 }finally{await db.close();}
});

test('guarded fallback rejects intervening policy changes',async()=>{
 const db=await makeSleepDb(12);try{
  await apply(db);await db.exec('ALTER POLICY sleep_select_owner_and_partner ON sleep_entries USING(false)');
  await assert.rejects(()=>db.exec(fs.readFileSync('output/sleep-access-performance-20261006/safe-fallback.sql','utf8')),/sleep_fallback_policy_drift/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query("SELECT qual FROM pg_policies WHERE policyname='sleep_select_owner_and_partner'")).rows[0].qual,'false');
 }finally{await db.close();}
});
