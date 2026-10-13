import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setup,asUser,decision,snapshot,allowed} from './helpers/data-consent-fixture.mjs';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const cohort=fs.readFileSync('supabase/migrations/20261003160141_data_consent_release_cohort.sql','utf8');
const selfService=fs.readFileSync('supabase/migrations/20261003164934_data_consent_self_service.sql','utf8');
async function makeDb(){
 const db=await setup();await db.exec(`CREATE FUNCTION consent_private.require_live_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'account_not_found'; END IF; END $$;`);
 await db.exec(cohort);await db.exec(selfService);await db.exec('UPDATE consent_private.settings SET self_service_enabled=true');return db;
}
test('ready consent screen never enrolls or grants on read; existing users keep legacy access',async()=>{
 const db=await makeDb();try{
 await asUser(db);const s=await snapshot(db);assert.equal(s.enabled,true);assert.equal(s.health,null);assert.equal(s.ai,null);
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM consent_private.user_state')).rows[0].n,0);
 assert.equal(await allowed(db,b),true);assert.equal(await allowed(db,b,'ai'),true);
 }finally{await db.close();}
});
test('first explicit health grant enables health, requires separate AI choice and enrolls only this user',async()=>{
 const db=await makeDb();try{
 await asUser(db);let s=await decision(db,'health','granted',0,1);assert.equal(s.enabled,true);assert.equal(s.healthAllowed,true);assert.equal(s.aiAllowed,false);
 s=await decision(db,'ai','granted',1,2);assert.equal(s.aiAllowed,true);
 await db.exec('RESET ROLE');const rows=(await db.query('SELECT user_id,enforcement_started_at,installation_evidence FROM consent_private.user_state')).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,a);assert.match(rows[0].installation_evidence,/^explicit-choice-operation:/);
 assert.equal(await allowed(db,b,'ai'),true);
 }finally{await db.close();}
});
test('first decline enforces refusal without granting anything and a later explicit grant works',async()=>{
 const db=await makeDb();try{
 await asUser(db);let s=await decision(db,'health','declined',0,1);assert.equal(s.healthAllowed,false);assert.equal(s.aiAllowed,false);assert.equal(await allowed(db,a),false);
 await asUser(db);s=await decision(db,'health','granted',1,2);assert.equal(s.healthAllowed,true);assert.equal(s.aiAllowed,false);
 }finally{await db.close();}
});
test('withdrawal revokes health and AI and blocks service and shared reads while unrelated accounts still work',async()=>{
 const db=await makeDb();try{
 await asUser(db);await decision(db,'health','granted',0,1);await decision(db,'ai','granted',1,2);const s=await decision(db,'health','revoked',2,3);assert.equal(s.healthAllowed,false);assert.equal(s.aiAllowed,false);assert.equal(s.ai.decision,'revoked');
 assert.equal(await allowed(db,a),false);assert.equal(await allowed(db,b),true);
 await db.exec(`RESET ROLE; INSERT INTO public.account_links VALUES('${a}','${b}','accepted');`);assert.equal(await allowed(db,b),false);
 }finally{await db.close();}
});
test('stale revision or missing health cannot enroll an account or create a decision',async()=>{
 const db=await makeDb();try{
 await asUser(db);await assert.rejects(decision(db,'ai','granted',0,1),/health_consent_required/);await assert.rejects(decision(db,'health','granted',5,2),/consent_revision_changed/);
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM consent_private.user_state WHERE enforcement_started_at IS NOT NULL')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM consent_private.decisions')).rows[0].n,0);
 }finally{await db.close();}
});
test('retry of old grant never restores it after withdrawal',async()=>{
 const db=await makeDb();try{
 await asUser(db);await decision(db,'health','granted',0,1);await decision(db,'health','revoked',1,2);const s=await decision(db,'health','granted',0,1);assert.equal(s.health.decision,'revoked');assert.equal(s.healthAllowed,false);assert.equal(s.revision,2);
 }finally{await db.close();}
});
test('pausing new choices keeps enrolled accounts usable and withdrawal enforced',async()=>{
 const db=await makeDb();try{
 await asUser(db);await decision(db,'health','granted',0,1);await db.exec('RESET ROLE; UPDATE consent_private.settings SET self_service_enabled=false');
 await asUser(db);const s=await decision(db,'health','revoked',1,2);assert.equal(s.enabled,true);assert.equal(s.healthAllowed,false);
 await asUser(db,b);assert.equal((await snapshot(db)).enabled,false);await assert.rejects(decision(db,'health','granted',0,3),/consents_not_enabled/);
 }finally{await db.close();}
});
test('clients cannot change rollout settings or enroll another user directly',async()=>{
 const db=await makeDb();try{
 await asUser(db);await assert.rejects(db.exec('UPDATE consent_private.settings SET self_service_enabled=false'),/permission denied/);await assert.rejects(db.exec(`INSERT INTO consent_private.user_state(user_id,enforcement_started_at,client_release,installation_evidence) VALUES('${b}',now(),'forged','forged')`),/permission denied/);
 await asUser(db,null,'anon');await assert.rejects(db.query('SELECT public.get_data_consents()'),/permission denied/);
 }finally{await db.close();}
});
