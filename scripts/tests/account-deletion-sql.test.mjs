import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_PACKAGE || '@electric-sql/pglite');
const migration = 'supabase/migrations/20260911065615_account_deletion_jobs.sql';
const a='10000000-0000-4000-8000-000000000001';const b='10000000-0000-4000-8000-000000000002';
async function setup(){
 const db=new PGlite();
 await db.exec(fs.readFileSync('supabase/tests/account_deletion_fixture.sql','utf8'));
 await db.exec(fs.readFileSync(migration,'utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260930055640_account_deletion_readiness.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260930163849_account_deletion_alarm.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260930170233_account_deletion_cdn_proof.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261001051435_account_deletion_worker_aliases.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261001094535_account_deletion_nullable_actor_rules.sql','utf8'));
 await db.query('INSERT INTO auth.users(id,last_sign_in_at,email) VALUES ($1,now(),$3),($2,now(),$4)',[a,b,'a@example.invalid','b@example.invalid']);
 await db.exec(`ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'; UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint(),approved_by='synthetic test',approved_at=now(),receipt_retention_days=90,backup_window_days=30`);
 return db;
}
test('readiness requires a current named approval, retention and the access hook; only service role can call',async()=>{
 const db=await setup();try{
  assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,true);
  await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT public.account_deletion_readiness()'),/permission denied/);await db.exec('RESET ROLE');
  await db.exec('SET ROLE service_role');assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,true);await db.exec('RESET ROLE');
  for(const change of ["approved_by=NULL","approved_at=NULL","approved_fingerprint='unapproved'","receipt_retention_days=NULL","backup_window_days=NULL"]){
   await db.exec('BEGIN');await db.exec(`UPDATE deletion_private.settings SET ${change}`);
   assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,false);await db.exec('ROLLBACK');
  }
  await db.exec('UPDATE deletion_private.settings SET approved_by=NULL');
  await assert.rejects(rpc(db,'accept',{userId:a,scope:'account',source:'app'}),/deletion_inventory_not_approved/);
  assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n,0);
  await db.exec("UPDATE deletion_private.settings SET approved_by='synthetic test'");
  await db.exec('CREATE TABLE public.new_unreviewed_table(id uuid)');assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,false);
 }finally{await db.close();}
});
async function rpc(db,action,payload={}){return (await db.query('SELECT public.account_deletion_worker($1,$2::jsonb) AS result',[action,JSON.stringify(payload)])).rows[0].result;}
for(const scope of ['account','data'])test(`${scope} clears all seven nullable actor references and preserves foreign contents`,async()=>{
 const db=await setup();try{
  await db.query('INSERT INTO public.sleep_entries(id,user_id,partner_id,shared_with_user_id,updated_by) VALUES($1,$2,$2,$2,$3)',[b,b,a]);
  await db.query('INSERT INTO public.shopping_items VALUES($1,$2,$3,$4)',[b,b,a,'foreign shopping entry']);
  await db.query('INSERT INTO public.paywall_content_config VALUES($1,$2::jsonb,$3),($4,$2::jsonb,$5)',['shared',JSON.stringify({title:'shared app config'}),a,'control',b]);
  await db.query('INSERT INTO public.startup_messages VALUES($1,$2,$3,$4),($3,$2,$4,$3)',[b,'shared message',a,b]);
  await db.query('INSERT INTO public.subscription_plan_features VALUES($1,$2)',[b,a]);
  await db.query('INSERT INTO public.subscription_policy_state VALUES($1,$2)',['current',a]);
  const accepted=await rpc(db,'accept',{userId:a,scope,source:'app'});
  const job=await rpc(db,'claim');assert.equal(job.id,accepted.requestId);
  const payload={requestId:job.id,lease:job.lease};
  await rpc(db,'inventory',payload);await rpc(db,'storage_done',payload);await rpc(db,'database',payload);
  assert.deepEqual((await db.query('SELECT user_id,partner_id,shared_with_user_id,updated_by FROM public.sleep_entries')).rows,[{user_id:b,partner_id:b,shared_with_user_id:b,updated_by:null}]);
  assert.deepEqual((await db.query('SELECT user_id,partner_id,name FROM public.shopping_items')).rows,[{user_id:b,partner_id:null,name:'foreign shopping entry'}]);
  assert.deepEqual((await db.query("SELECT content,updated_by FROM public.paywall_content_config WHERE id='shared'")).rows,[{content:{title:'shared app config'},updated_by:null}]);
  assert.equal((await db.query("SELECT updated_by FROM public.paywall_content_config WHERE id='control'")).rows[0].updated_by,b);
  assert.deepEqual((await db.query('SELECT content,created_by,updated_by FROM public.startup_messages ORDER BY id')).rows,[{content:'shared message',created_by:b,updated_by:null},{content:'shared message',created_by:null,updated_by:b}]);
  assert.equal((await db.query('SELECT updated_by FROM public.subscription_plan_features')).rows[0].updated_by,null);
  assert.equal((await db.query('SELECT updated_by FROM public.subscription_policy_state')).rows[0].updated_by,null);
  assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,2);
 }finally{await db.close();}
});
test('actor rules invalidate the approval and refuse a non-nullable identity column',async()=>{
 const db=await setup();const sql=fs.readFileSync('supabase/migrations/20261001094535_account_deletion_nullable_actor_rules.sql','utf8');try{
  await db.exec("DELETE FROM deletion_private.rules WHERE table_name='sleep_entries' AND column_name='updated_by'; UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint()");
  assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,true);
  await db.exec(sql);assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready,false);
  await db.exec('ALTER TABLE public.sleep_entries ALTER COLUMN updated_by SET NOT NULL');
  await assert.rejects(db.exec(sql),/deletion_actor_column_requires_review/);await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('worker startup purge retains recent and pending receipts, and list includes provider state',async()=>{
 const db=await setup();try{
  await db.exec(`INSERT INTO deletion_private.requests(user_id,scope,source,status,completed_at)
   VALUES(gen_random_uuid(),'account','support','completed',now()-interval '91 days'),
   (gen_random_uuid(),'account','support','completed',now()-interval '89 days'),
   (gen_random_uuid(),'account','support','queued',now()-interval '100 days')`);
  await db.exec('SET ROLE service_role');
  assert.deepEqual(await rpc(db,'purge_receipts'),{});
  const list=await rpc(db,'list');assert.equal(list.length,1);assert.equal(list[0].status,'queued');
  assert(list[0].providers.some(p=>p.provider==='storage_cdn'&&p.status==='pending'));
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n,2);
  await db.exec('UPDATE deletion_private.settings SET backup_window_days=120');
  await db.exec("UPDATE deletion_private.requests SET completed_at=now()-interval '100 days' WHERE status='completed'");
  await rpc(db,'purge_receipts');
  assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n,2);
  await db.exec('UPDATE deletion_private.settings SET receipt_retention_days=NULL');
  await db.exec("UPDATE deletion_private.requests SET completed_at=now()-interval '200 days' WHERE status='completed'");
  await rpc(db,'purge_receipts');
  assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n,2);
 }finally{await db.close();}
});
test('alarm state is service-only, aggregate, leased and deduplicated only after successful send',async()=>{
 const db=await setup();const alert=async(action,payload={})=>(await db.query('SELECT public.account_deletion_alarm($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
 try{
  for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(alert('health'),/permission denied/);await assert.rejects(db.query('SELECT * FROM deletion_private.alarm_state'),/permission denied/);await db.exec('RESET ROLE');}
  await db.exec('SET ROLE service_role');assert.deepEqual(await alert('health'),{needs_attention:0,queued_over_15m:0,expired_lease_over_7m:0,lease_exceeds_contract:0,overdue_retention:0});await db.exec('RESET ROLE');
  await assert.rejects(alert('claim',{signature:'bad'}),/invalid_alarm_signature/);
  const signature='a'.repeat(64);const first=await alert('claim',{signature});assert.equal(first.send,true);
  assert.deepEqual(await alert('claim',{signature:'b'.repeat(64)}),{send:false});
  await assert.rejects(alert('finish',{lease:b,sent:true}),/alarm_lease_lost/);
  await alert('finish',{lease:first.lease,sent:false});const retry=await alert('claim',{signature});assert.equal(retry.send,true);
  await alert('finish',{lease:retry.lease,sent:true});assert.deepEqual(await alert('claim',{signature}),{send:false});
  await alert('reset');assert.equal((await alert('claim',{signature})).send,true);
 }finally{await db.close();}
});
test('roles, recent authentication, idempotency and durable lock',async()=>{
 const db=await setup();try{
  await db.exec('SET ROLE authenticated');
  await assert.rejects(rpc(db,'accept',{userId:b,scope:'account',source:'app'}),/permission denied/);
  await db.exec('RESET ROLE');
  await db.query("UPDATE auth.users SET last_sign_in_at=now()-interval '1 hour' WHERE id=$1",[a]);
  await assert.rejects(rpc(db,'accept',{userId:a,scope:'account',source:'app'}),/recent_authentication_required/);
  await db.query('UPDATE auth.users SET last_sign_in_at=now() WHERE id=$1',[a]);
  await db.query('INSERT INTO auth.sessions VALUES (gen_random_uuid(),$1)',[a]);
  const first=await rpc(db,'accept',{userId:a,scope:'account',source:'app'});
  assert.equal((await db.query("SELECT status FROM deletion_private.provider_tasks WHERE request_id=$1 AND provider='storage_cdn'",[first.requestId])).rows[0].status,'pending');
  assert.equal((await rpc(db,'accept',{userId:a,scope:'account',source:'web'})).requestId,first.requestId);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM auth.sessions')).rows[0].n,0);
  assert.equal(await rpc(db,'blocked',{userId:a}),true);assert.equal(await rpc(db,'blocked',{userId:b}),false);
  await assert.rejects(db.query('INSERT INTO public.user_settings VALUES (gen_random_uuid(),$1)',[a]),/account_deletion_pending/);
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false)`);
  await assert.rejects(db.query('SELECT public.check_account_deletion_access()'),/account_deletion_pending/);
 }finally{await db.close();}
});
test('shared family blocks before media deletion; unapproved schema fails closed',async()=>{
 const db=await setup();try{
  await db.query('INSERT INTO public.baby_info VALUES ($1,$2)',[a,a]);
  await db.query("INSERT INTO public.baby_members VALUES ($1,$2,'parent')",[a,b]);
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});const job=await rpc(db,'claim');
  await assert.rejects(rpc(db,'inventory',{requestId:job.id,lease:job.lease}),/shared_baby_review_required/);
  await assert.rejects(rpc(db,'database',{requestId:job.id,lease:job.lease}),/wrong_phase/);
  await db.exec('CREATE TABLE public.uninventoried(id uuid,user_id uuid)');
  await assert.rejects(rpc(db,'inventory',{requestId:job.id,lease:job.lease}),/deletion_inventory_not_approved/);
 }finally{await db.close();}
});
test('global recipes, copied link audits, moderation snapshots and admin audits stop before deletion',async()=>{
 const db=await setup();try{
  await db.query('INSERT INTO public.baby_recipes(user_id,is_global,image_url) VALUES($1,true,$2)',[a,'synthetic.jpg']);
  await db.query('INSERT INTO public.account_links_audit_log(changed_by,old_data) VALUES($1,$2::jsonb)',[b,JSON.stringify({creator_id:a})]);
  await db.query('INSERT INTO public.content_reports(reporter_id,target_id,target_snapshot) VALUES($1,$2,$3)',[b,b,`synthetic reference ${a}`]);
  await db.query('INSERT INTO public.subscription_policy_audit(changed_by) VALUES($1)',[a]);
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});const job=await rpc(db,'claim');
  const inventory=()=>rpc(db,'inventory',{requestId:job.id,lease:job.lease});
  await assert.rejects(inventory(),/global_recipe_review_required/);
  await db.exec('DELETE FROM public.baby_recipes');
  await assert.rejects(inventory(),/account_link_audit_review_required/);
  await db.exec('DELETE FROM public.account_links_audit_log');
  await assert.rejects(inventory(),/moderation_report_review_required/);
  await db.exec('DELETE FROM public.content_reports');
  await assert.rejects(inventory(),/subscription_audit_review_required/);
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,0);
 }finally{await db.close();}
});
test('resume each phase, remove own rows and orphan media, preserve another sender, require provider evidence',async()=>{
 const db=await setup();try{
  await db.query('INSERT INTO public.profiles VALUES($1),($2)',[a,b]);
  await db.query('INSERT INTO public.direct_messages VALUES(gen_random_uuid(),$1,$2,$3)',[b,a,'from other sender']);
  await db.query('INSERT INTO public.sleep_entries VALUES(gen_random_uuid(),$1,$1,$1)',[a]);
  await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES($1,$2,$3),($1,$4,$5)', ['community-images',`avatars/avatar_${a}_old.jpg`,null,`avatars/avatar_${b}_old.jpg`,b]);
  const receipt=await rpc(db,'accept',{userId:a,scope:'account',source:'app'});
  let job=await rpc(db,'claim');let payload={requestId:job.id,lease:job.lease};
  await rpc(db,'inventory',payload);await rpc(db,'release',payload);
  await db.exec("UPDATE deletion_private.requests SET next_attempt_at=now()");job=await rpc(db,'claim');payload={requestId:job.id,lease:job.lease};
  const objects=await rpc(db,'objects',payload);assert.equal(objects.length,1);assert.match(objects[0].path,new RegExp(a));
  await assert.rejects(rpc(db,'storage_done',payload),/storage_pending/);
  // Test double for successful binary removal by the Storage API.
  await db.query('DELETE FROM storage.objects WHERE name=$1',[objects[0].path]);
  await rpc(db,'objects_removed',{...payload,objects});await rpc(db,'storage_done',payload);
  await rpc(db,'database',payload);
  assert.equal((await db.query('SELECT receiver_id FROM public.direct_messages')).rows[0].receiver_id,null);
  assert.equal((await db.query('SELECT id FROM public.profiles')).rows[0].id,b);
  await assert.rejects(rpc(db,'auth_done',payload),/auth_still_exists/);
  await db.query('DELETE FROM auth.users WHERE id=$1',[a]);await rpc(db,'auth_done',payload);
  await rpc(db,'verify',payload);
  assert.equal((await db.query('SELECT status FROM deletion_private.requests')).rows[0].status,'needs_attention');
  await assert.rejects(rpc(db,'resolve_provider',{requestId:receipt.requestId,provider:'sentry',status:'completed',evidence:'',operator:'test'}),/evidence_required/);
  for(const {provider} of (await db.query('SELECT provider FROM deletion_private.provider_tasks')).rows){
   await rpc(db,'resolve_provider',{requestId:receipt.requestId,provider,status:'not_applicable',evidence:'Synthetic fixture has no external provider',operator:'test'});
  }
  job=await rpc(db,'claim');payload={requestId:job.id,lease:job.lease};await rpc(db,'verify',payload);
  assert.equal((await db.query('SELECT status FROM deletion_private.requests')).rows[0].status,'completed');
  assert.equal(await rpc(db,'blocked',{userId:a}),true);
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,1);
 }finally{await db.close();}
});
test('a file referenced by another account is held for review',async()=>{
 const db=await setup();try{
  const path=`avatars/avatar_${a}_old.jpg`;
  await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES($1,$2,$3)', ['community-images',path,a]);
  await db.query('INSERT INTO public.community_posts VALUES(gen_random_uuid(),$1,$2)',[b,`https://example.invalid/storage/v1/object/public/community-images/${path}`]);
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});const job=await rpc(db,'claim');
  await assert.rejects(rpc(db,'inventory',{requestId:job.id,lease:job.lease}),/shared_media_review_required/);
 }finally{await db.close();}
});
test('support requests require audited identity verification without an app login',async()=>{
 const db=await setup();try{
  await db.query("UPDATE auth.users SET last_sign_in_at=NULL WHERE id=$1",[a]);
  await assert.rejects(rpc(db,'accept',{userId:a,scope:'account',source:'support'}),/identity_verification_evidence_required/);
  const receipt=await rpc(db,'accept',{userId:a,scope:'account',source:'support',operator:'test-support',evidence:'Synthetic identity verified in ticket TEST-123'});
  assert.equal(receipt.status,'queued');
  const events=(await db.query('SELECT action,operator FROM deletion_private.events')).rows;
  assert.deepEqual(events,[{action:'support_identity_verified',operator:'test-support'}]);
  const job=await rpc(db,'claim');
  await assert.rejects(rpc(db,'resume',{requestId:job.id,operator:'test-support',evidence:'Synthetic resolution'}),/lease_active/);
  await rpc(db,'fail',{requestId:job.id,lease:job.lease,manual:true,code:'test'});
  await rpc(db,'resume',{requestId:job.id,operator:'test-support',evidence:'Synthetic resolution'});
  assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.events')).rows[0].n,2);
 }finally{await db.close();}
});
test('leaving a shared baby holds authored content before any deletion',async()=>{
 const db=await setup();try{
  await db.query('INSERT INTO public.baby_info VALUES ($1,$2)',[b,b]);
  await db.query('INSERT INTO public.baby_milestone_entries VALUES (gen_random_uuid(),$1,$2)',[b,a]);
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});const job=await rpc(db,'claim');
  await assert.rejects(rpc(db,'inventory',{requestId:job.id,lease:job.lease}),/shared_baby_content_review_required/);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.baby_milestone_entries')).rows[0].n,1);
 }finally{await db.close();}
});
test('historical cover/event/milestone paths and explicit sender/author columns are covered',async()=>{
 const db=await setup();try{
  const paths=[['community-images',`blog-covers/blog_${a}_1.jpg`],['community-images',`wiki-covers/wiki_${a}_1.jpg`],['community-images',`milestones/${b}/${a}_1.jpg`],['group-event-images',`${b}/${a}/1.jpg`]];
  for(const [bucket,path] of paths)await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,path]);
  await db.query('INSERT INTO public.community_group_messages VALUES(gen_random_uuid(),$1,$3),(gen_random_uuid(),$2,$3)',[a,b,'synthetic']);
  await db.query('INSERT INTO public.blog_posts VALUES(gen_random_uuid(),$1,NULL)',[a]);
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});const job=await rpc(db,'claim');const identity={requestId:job.id,lease:job.lease};
  await rpc(db,'inventory',identity);const objects=await rpc(db,'objects',identity);assert.equal(objects.length,4);
  await db.exec('DELETE FROM storage.objects');await rpc(db,'objects_removed',{...identity,objects});await rpc(db,'storage_done',identity);await rpc(db,'database',identity);
  assert.deepEqual((await db.query('SELECT sender_id FROM public.community_group_messages')).rows,[{sender_id:b}]);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.blog_posts')).rows[0].n,0);
 }finally{await db.close();}
});
test('a user-authored URL cannot authorize removal of another storage owner’s file',async()=>{
 const db=await setup();try{
  const path='posts/foreign-owner.jpg';
  await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES($1,$2,$3)', ['community-images',path,b]);
  await db.query('INSERT INTO public.community_posts VALUES(gen_random_uuid(),$1,$2)',[a,`https://kwniiyayhzgjfqjsjcfu.supabase.co/storage/v1/object/public/community-images/${path}`]);
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});const job=await rpc(db,'claim');
  await assert.rejects(rpc(db,'inventory',{requestId:job.id,lease:job.lease}),/shared_media_review_required/);
 }finally{await db.close();}
});
test('foreign URLs do not select unrelated unowned storage objects',async()=>{
 const db=await setup();try{
  const path='posts/unowned.jpg';
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)', ['community-images',path]);
  await db.query('INSERT INTO public.community_posts VALUES(gen_random_uuid(),$1,$2)',[a,`https://foreign.invalid/storage/v1/object/public/community-images/${path}`]);
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});const job=await rpc(db,'claim');const identity={requestId:job.id,lease:job.lease};
  await rpc(db,'inventory',identity);assert.deepEqual(await rpc(db,'objects',identity),[]);
 }finally{await db.close();}
});

test('moderator identities and nested subscription audit copies require review',async()=>{
 const db=await setup();try{
  await db.exec('ALTER TABLE public.content_reports ADD COLUMN resolved_by uuid, ADD COLUMN follow_up_by uuid; ALTER TABLE public.subscription_policy_audit ADD COLUMN matrix jsonb');
  for(const column of ['resolved_by','follow_up_by']){
   await db.query(`INSERT INTO public.content_reports(${column}) VALUES($1)`,[a]);
   await assert.rejects(db.query('SELECT deletion_private.preflight($1)',[a]),/moderation_report_review_required/);
   await db.exec('DELETE FROM public.content_reports');
  }
  await db.query('INSERT INTO public.subscription_policy_audit(changed_by,matrix) VALUES($1,$2)',[b,JSON.stringify({nested:{actor:a}})]);
  await assert.rejects(db.query('SELECT deletion_private.preflight($1)',[a]),/subscription_audit_review_required/);
  // An unrelated actor/copy must not hold this user's request.
  await db.query('UPDATE public.subscription_policy_audit SET matrix=$1',[JSON.stringify({nested:{actor:b}})]);
  await db.query('SELECT deletion_private.preflight($1)',[a]);
 }finally{await db.close();}
});
test('blocked RPC remains usable without retention or fingerprint approval',async()=>{
 const db=await setup();try{
  await rpc(db,'accept',{userId:a,scope:'account',source:'app'});
  await db.exec('UPDATE deletion_private.settings SET approved_fingerprint=NULL,approved_by=NULL,approved_at=NULL,receipt_retention_days=NULL,backup_window_days=NULL');
  await db.exec('SET ROLE service_role');
  assert.equal(await rpc(db,'blocked',{userId:b}),false);
  assert.equal(await rpc(db,'blocked',{userId:a}),true);
  await db.exec('RESET ROLE; SET ROLE authenticated');
  await assert.rejects(rpc(db,'blocked',{userId:a}),/permission denied/);
 }finally{await db.close();}
});
test('operational health has positive signals for attention, retention and long leases',async()=>{
 const db=await setup();try{
  const report=()=>db.query(fs.readFileSync('supabase/tests/account_deletion_operational_health.sql','utf8'));
  const clean=(await report()).rows[0];assert.equal(Number(clean.needs_attention),0);
  const r=await db.query("INSERT INTO deletion_private.requests(user_id,scope,source,status) VALUES($1,'account','support','needs_attention') RETURNING id",[a]);
  await db.query("INSERT INTO deletion_private.provider_tasks(request_id,provider,status,evidence,resolved_by,due_at) VALUES($1,'backups','retention_pending','synthetic positive test','fixture',now()-interval '1 day')",[r.rows[0].id]);
  await db.query("INSERT INTO deletion_private.requests(user_id,scope,source,status,updated_at,lease_until) VALUES($1,'account','support','processing',now(),now()+interval '1 hour')",[b]);
  const positive=(await report()).rows[0];assert.equal(Number(positive.needs_attention),1);assert.equal(Number(positive.overdue_retention),1);assert.equal(Number(positive.lease_exceeds_contract),1);
  await db.exec("UPDATE deletion_private.requests SET lease_until=now()-interval '8 minutes' WHERE status='processing'");
  assert.equal(Number((await report()).rows[0].expired_lease_over_7m),1);
 }finally{await db.close();}
});
