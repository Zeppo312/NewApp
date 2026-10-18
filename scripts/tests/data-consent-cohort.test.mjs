import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setup,asUser,enable,decision,snapshot,allowed} from './helpers/data-consent-fixture.mjs';
const a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002';
const migration=fs.readFileSync('supabase/migrations/20261003160141_data_consent_release_cohort.sql','utf8');
async function dbForTest(){
 const db=await setup();
 await db.exec(`CREATE FUNCTION consent_private.require_live_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'account_not_found'; END IF; END $$;`);
 await db.exec(migration);
 await db.exec('CREATE POLICY fixture_guest ON public.weight_entries TO anon USING(true);');
 return db;
}
async function enroll(db){await db.exec(`RESET ROLE; INSERT INTO consent_private.user_state(user_id,enforcement_started_at,client_release,installation_evidence) VALUES('${a}',now(),'synthetic-client','synthetic-install');`);}
test('empty cohort preserves legacy authenticated, guest and service access without creating consent',async()=>{
 const db=await dbForTest();try{
 await db.exec(`INSERT INTO public.weight_entries(id,user_id,notes) VALUES('${a}','${a}','legacy'); GRANT SELECT ON public.weight_entries TO anon;`);
 await asUser(db); assert.equal((await snapshot(db)).enabled,false);assert.equal((await db.query('SELECT * FROM public.weight_entries')).rows.length,1);
 await assert.rejects(decision(db,'health','granted',0,1),/consents_not_enabled/);
 await asUser(db,null,'anon');assert.equal((await db.query('SELECT * FROM public.weight_entries')).rows.length,1);
 assert.equal(await allowed(db,a,'ai'),true);
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM consent_private.decisions')).rows[0].n,0);
 }finally{await db.close();}
});
test('selected account requires explicit separate choices; unrelated legacy user still works',async()=>{
 const db=await dbForTest();try{
 await enroll(db);await asUser(db);let s=await snapshot(db);assert.equal(s.enabled,true);assert.equal(s.healthAllowed,false);assert.equal(s.aiAllowed,false);
 await assert.rejects(decision(db,'ai','granted',0,1),/health_consent_required/);
 s=await decision(db,'health','granted',0,2);assert.equal(s.healthAllowed,true);assert.equal(s.aiAllowed,false);
 await decision(db,'ai','declined',1,3);assert.equal(await allowed(db,a),true);assert.equal(await allowed(db,a,'ai'),false);assert.equal(await allowed(db,b,'ai'),true);
 await asUser(db,b);assert.equal((await snapshot(db)).enabled,false);
 await assert.rejects(db.query(`UPDATE consent_private.user_state SET enforcement_started_at=now() WHERE user_id='${b}'`),/permission denied/);
 }finally{await db.close();}
});
test('withdrawal blocks RLS, service writes and shared/guest access to cohort data',async()=>{
 const db=await dbForTest();try{
 await db.exec(`INSERT INTO public.weight_entries(id,user_id,notes) VALUES('${a}','${a}','cohort'),('${b}','${b}','legacy'); INSERT INTO public.account_links VALUES('${a}','${b}','accepted'); GRANT SELECT ON public.weight_entries TO anon;`);
 await enroll(db);await asUser(db);await decision(db,'health','granted',0,1);await decision(db,'ai','granted',1,2);await decision(db,'health','revoked',2,3);
 assert.equal(await allowed(db,a),false);assert.equal(await allowed(db,b),false);
 await assert.rejects(db.exec(`UPDATE public.weight_entries SET notes='late' WHERE user_id='${a}'`),/health_consent_required/);
 await asUser(db,b);await db.exec("SELECT set_config('request.path','/rpc/get_due_date_with_linked_users',false)");await assert.rejects(db.query('SELECT public.check_data_consent_access()'),/health_consent_required/);
 await asUser(db,null,'anon');const rows=(await db.query('SELECT * FROM public.weight_entries')).rows;assert.deepEqual(rows.map(r=>r.user_id),[b]);
 }finally{await db.close();}
});
test('enrollment cannot be removed by an update; revision updates and auth deletion stay possible',async()=>{
 const db=await dbForTest();try{
 await enroll(db);await assert.rejects(db.exec(`UPDATE consent_private.user_state SET enforcement_started_at=NULL,client_release=NULL,installation_evidence=NULL WHERE user_id='${a}'`),/consent_enrollment_is_permanent/);
 await db.exec(`UPDATE consent_private.user_state SET revision=revision+1 WHERE user_id='${a}'`);
 await db.exec(`DELETE FROM auth.users WHERE id='${a}'`);assert.equal((await db.query('SELECT count(*)::int n FROM consent_private.user_state')).rows[0].n,0);
 }finally{await db.close();}
});
test('global activation remains available and pause cannot restore a withdrawn legacy grant',async()=>{
 const db=await dbForTest();try{
 await enable(db);await asUser(db,b);await decision(db,'health','granted',0,1);await decision(db,'health','revoked',1,2);
 await db.exec('RESET ROLE; UPDATE consent_private.settings SET enabled=false');assert.equal(await allowed(db,b),false);
 await asUser(db,b);await assert.rejects(decision(db,'health','granted',2,3),/consents_not_enabled/);
 }finally{await db.close();}
});
