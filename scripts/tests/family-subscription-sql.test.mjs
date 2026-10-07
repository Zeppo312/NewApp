// Runs real PostgreSQL permissions, triggers, RPCs and quotas in an isolated PGlite DB.
// Usage: node scripts/tests/family-subscription-sql.test.mjs /path/to/pglite/dist/index.js
// Or: node scripts/tests/family-subscription-sql.test.mjs /path/to/embedded-postgres/dist/index.js --postgres
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createFamilyTestDb } from './helpers/family-test-db.mjs';
const native = process.argv.includes('--postgres');
const db = await createFamilyTestDb(process.argv[2], native);
const sql = path => readFile(new URL('../../'+path, import.meta.url),'utf8');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', C='33333333-3333-4333-8333-333333333333';
let checks=0;
async function check(query,value) { assert.deepEqual((await db.query(query)).rows[0].result,value,query); checks++; }
async function denied(query) { await assert.rejects(db.exec(query)); checks++; }
async function actor(uid) { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE authenticated`); }
async function server() { await db.exec('RESET ROLE'); }
async function invite(uid) {
  await actor(uid);
  return (await db.query(`INSERT INTO account_links(creator_id,invitation_code,relationship_type) VALUES('${uid}','client-code','partner') RETURNING id,invitation_code`)).rows[0];
}
async function paid(uid,tier='premium') {
  await server();
  await db.exec(`INSERT INTO lotti_subscription_entitlements(user_id,tier,is_premium,source,checked_at,expires_at,paid_tier,paid_expires_at,paid_subscription_id,paid_verified_at)
    VALUES('${uid}','${tier}',${tier==='premium'},'revenuecat_api',now(),now()+interval '1 month','${tier}',now()+interval '1 month','sub-${uid}',now())
    ON CONFLICT(user_id) DO UPDATE SET tier=EXCLUDED.tier,is_premium=EXCLUDED.is_premium,paid_tier=EXCLUDED.paid_tier,paid_expires_at=EXCLUDED.paid_expires_at,paid_subscription_id=EXCLUDED.paid_subscription_id,paid_verified_at=now()`);
}
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator;
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA caretaker_private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,last_sign_in_at timestamptz,email text);
    CREATE TABLE auth.identities(user_id uuid,provider text,provider_id text);
    CREATE TABLE auth.sessions(id uuid,user_id uuid);
    CREATE TABLE storage.objects(id uuid,bucket_id text,name text,owner_id text);
    INSERT INTO auth.users(id) VALUES('${A}'),('${B}'),('${C}');
    CREATE TABLE profiles(id uuid PRIMARY KEY,is_admin boolean DEFAULT false,paywall_access_role text,suspended_at timestamptz,suspension_reason text,first_name text,last_name text,user_role text);
    INSERT INTO profiles(id) SELECT id FROM auth.users;
    GRANT SELECT,INSERT,UPDATE ON profiles TO authenticated;
    CREATE TABLE baby_info(id uuid PRIMARY KEY);
    CREATE TABLE baby_members(baby_id uuid,user_id uuid,role text,PRIMARY KEY(baby_id,user_id));
    CREATE TABLE user_settings(user_id uuid PRIMARY KEY,due_date timestamptz,is_baby_born boolean,created_at timestamptz,updated_at timestamptz);
    INSERT INTO baby_info VALUES('${A}');
    INSERT INTO baby_members VALUES('${A}','${A}','owner');
    INSERT INTO user_settings(user_id,is_baby_born) VALUES('${A}',true);
    CREATE TABLE account_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),creator_id uuid NOT NULL,invited_id uuid,
      invitation_code text NOT NULL,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),expires_at timestamptz DEFAULT now()+interval '7 days',accepted_at timestamptz,relationship_type text DEFAULT 'partner');
    CREATE TABLE account_links_audit_log(id uuid);
    CREATE TABLE subscription_plan_features(plan_key text,feature_key text,enabled boolean);
    INSERT INTO subscription_plan_features VALUES('premium','fragLotti',true),('standard','fragLotti',false),('lite','fragLotti',false),('premium','fuersorge',true),('standard','fuersorge',true);
    CREATE FUNCTION public.debug_reset_invitation(p_invitation_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE account_links SET status='pending' WHERE id=p_invitation_id $$;
  `);
  await db.exec(await sql('supabase/migrations/20250507000001_add_user_info_to_account_links_fixed.sql'));
  // Exercise the actual public code-redemption/settings/baby-sync path used by the app.
  await db.exec(await sql('supabase/migrations/20270406100000_complete_invitation_baby_sync_fix.sql'));
  const security=await sql('supabase/migrations/20270723000000_ask_lotti_security.sql');
  await db.exec(security);
  await db.exec(await sql('supabase/migrations/20270822000000_subscription_tier_cache.sql'));
  const moderation=await sql('supabase/migrations/20270817000000_ugc_moderation.sql');
  await db.exec(moderation.slice(moderation.indexOf('CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation'),moderation.indexOf('-- 1. Blockierte Nutzer')));
  // An accepted legacy link cannot be trusted as evidence of two-sided consent.
  await db.exec(`INSERT INTO account_links(creator_id,invited_id,invitation_code,status) VALUES('${A}','${C}','legacy','accepted')`);
  await db.exec(await sql('supabase/migrations/20260911065615_account_deletion_jobs.sql'));
  await db.exec(await sql('supabase/migrations/20260924064154_subscription_tier_cache_guard.sql'));
  await db.exec(await sql('supabase/migrations/20260912185037_family_subscription_security.sql'));
  await db.exec(await sql('supabase/migrations/20260924074150_family_rollout_guards.sql'));
  await db.exec(await sql('supabase/migrations/20260929074500_family_negative_recheck.sql'));
  await check("SELECT count(*)::int result FROM account_links WHERE invitation_code='legacy' AND status='accepted'",1);
  await paid(A);
  await actor(C);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  await denied(`SELECT family_subscription_state('${A}')`);
  await denied('SELECT debug_reset_invitation(gen_random_uuid())');
  await denied('UPDATE profiles SET is_admin=true');
  await denied("UPDATE profiles SET paywall_access_role='premium_tester'");
  await denied("INSERT INTO profiles(id,is_admin) VALUES(gen_random_uuid(),true)");
  await denied("UPDATE lotti_subscription_entitlements SET paid_tier='premium'");
  await denied('SELECT * FROM account_links_audit_log');
  await denied(`SELECT get_user_invitations_with_info('${A}')`);
  await denied(`SELECT get_linked_users_with_info('${A}')`);
  await check(`SELECT get_user_invitations_with_info('${C}')->>'success' result`,'true');
  await denied('UPDATE lotti_ai_usage_buckets SET used=0');
  await denied(`SELECT consume_lotti_ai_quota('${C}',null,gen_random_uuid())`);
  const ab=await invite(A);
  assert.notEqual(ab.invitation_code,'client-code'); checks++;
  await actor(C);
  await check(`SELECT count(*)::int result FROM account_links WHERE id='${ab.id}'`,0);
  await denied(`SELECT accept_invitation('${ab.id}','${B}')`);
  await actor(B);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  await check(`SELECT redeem_invitation_code_and_sync_due_date(upper('${ab.invitation_code}'),'${B}')->>'success' result`,'true');
  await server();
  await check(`SELECT role result FROM baby_members WHERE baby_id='${A}' AND user_id='${B}'`,'partner');
  await check(`SELECT is_baby_born result FROM user_settings WHERE user_id='${B}'`,true);
  await actor(B);
  await check("SELECT get_family_subscription_access()->>'tier' result",'premium');
  await denied(`SELECT caretaker_private.has_premium('${B}')`);
  await server();
  await check(`SELECT caretaker_private.has_premium('${B}') result`,true);
  await actor(B);
  await check("SELECT (get_family_subscription_access() ? 'sponsorId') result",false);
  await check("SELECT (get_family_subscription_access()->>'validUntil')::timestamptz <= now()+interval '5 minutes' result",true);
  await check(`SELECT accept_invitation('${ab.id}','${B}')->>'success' result`,'false');
  await denied(`UPDATE account_links SET invited_id='${C}' WHERE id='${ab.id}'`);
  const bc=await invite(B);
  await actor(C);
  await denied(`SELECT accept_invitation('${bc.id}','${C}')`);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  const ca=await invite(C);
  await actor(A);
  await denied(`SELECT accept_invitation('${ca.id}','${A}')`);
  // One purchased subscription cannot be cached under two owners.
  await paid(B);
  await denied(`UPDATE lotti_subscription_entitlements SET paid_subscription_id='sub-${A}' WHERE user_id='${B}'`);
  await db.exec(`DELETE FROM lotti_subscription_entitlements WHERE user_id='${B}'`);
  // Shared requests spend the same budget; duplicate request IDs do not spend twice.
  const request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await check(`SELECT consume_lotti_ai_quota('${B}',null,'${request}')->>'allowed' result`,'true');
  await check(`SELECT consume_lotti_ai_quota('${B}',null,'${request}')->>'code' result`,'duplicate_request');
  await check(`SELECT consume_lotti_ai_quota('${A}',null,gen_random_uuid())->>'allowed' result`,'true');
  await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'allowed' result`,'true');
  await check(`SELECT consume_lotti_ai_quota('${A}',null,gen_random_uuid())->>'code' result`,'rate_limit');
  await check(`SELECT used result FROM lotti_ai_usage_buckets WHERE user_id='${A}' AND window_kind='minute'`,3);
  await check(`SELECT count(*)::int result FROM lotti_ai_usage_buckets WHERE user_id='${B}'`,0);
  // Native mode uses independent PostgreSQL connections; PGlite serializes calls.
  await db.exec('DELETE FROM lotti_ai_usage_buckets');
  const burst=await db.parallelQueries(Array.from({length:20},(_,i)=>`SELECT consume_lotti_ai_quota('${i%2?A:B}',null,gen_random_uuid())->>'allowed' result`));
  assert.equal(burst.filter(r=>r.rows[0].result==='true').length,3); checks++;
  const advisorBurst=await db.parallelQueries(Array.from({length:12},(_,i)=>`SELECT consume_advisor_ai_quota('${i%2?A:B}')->>'allowed' result`));
  assert.equal(advisorBurst.filter(r=>r.rows[0].result==='true').length,3); checks++;
  await check(`SELECT used result FROM lotti_ai_usage_buckets WHERE user_id='${A}' AND feature='advisor'`,3);
  await db.exec("DELETE FROM lotti_ai_usage_buckets WHERE window_kind='minute'; UPDATE lotti_ai_usage_buckets SET used=20 WHERE feature='ask_lotti' AND window_kind='day'");
  await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'window' result`,'day');
  await db.exec("UPDATE lotti_ai_usage_buckets SET used=0 WHERE feature='ask_lotti' AND window_kind='day'; UPDATE lotti_ai_usage_buckets SET used=300 WHERE feature='ask_lotti' AND window_kind='month'");
  await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'window' result`,'month');
  await actor(B);
  await denied(`SELECT consume_advisor_ai_quota('${B}')`);
  await denied('SELECT claim_family_subscription_rechecks()');
  await server();
  await db.exec(`UPDATE lotti_subscription_entitlements SET paid_verified_at=now()-interval '6 minutes' WHERE user_id='${A}'`);
  await check('SELECT count(*)::int result FROM claim_family_subscription_rechecks()',2);
  await check('SELECT count(*)::int result FROM claim_family_subscription_rechecks()',0);
  await actor(B);
  await denied('SELECT get_family_subscription_access()');
  await server();
  await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'code' result`,'not_entitled');
  await check(`SELECT caretaker_private.has_premium('${B}') result`,false);
  await paid(A,'lite');
  await actor(B);
  await check("SELECT get_family_subscription_access()->>'tier' result",'lite');
  await paid(A);
  await db.exec(`UPDATE lotti_subscription_entitlements SET paid_tier=null,paid_expires_at=null,paid_subscription_id=null WHERE user_id='${A}'`);
  await actor(B);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  await server();
  // A just-confirmed revocation is immediately negative. After fifteen seconds
  // it requires another provider check, never restoring the old paid grant.
  await db.exec(`UPDATE lotti_subscription_entitlements SET paid_verified_at=clock_timestamp()-interval '16 seconds' WHERE user_id='${A}'`);
  await check(`SELECT family_subscription_state('${B}')->>'status' result`,'stale');
  await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'code' result`,'not_entitled');
  await actor(B);
  await denied('SELECT get_family_subscription_access()');
  await server();
  // A renewed payment becomes usable without waiting for the old negative TTL.
  await paid(A);
  await actor(B);
  await check("SELECT get_family_subscription_access()->>'status' result",'active');
  await server();
  await db.exec(`UPDATE lotti_subscription_entitlements SET paid_tier=null,paid_expires_at=null,paid_subscription_id=null,paid_verified_at=clock_timestamp() WHERE user_id='${A}'`);
  await db.exec(`UPDATE profiles SET is_admin=true WHERE id='${A}'`);
  await actor(B);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  await paid(A);
  await db.exec(`INSERT INTO deletion_private.requests(user_id,scope,source) VALUES('${A}','account','app')`);
  await actor(B);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  await server(); await db.exec('DELETE FROM deletion_private.requests');
  await actor(B);
  await db.exec(`UPDATE account_links SET status='rejected' WHERE id='${ab.id}'`);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  await server();
  await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'code' result`,'not_entitled');
  await check(`SELECT caretaker_private.has_premium('${B}') result`,false);
  await check('SELECT count(*)::int result FROM subscription_private.members',0);
  await actor(C);
  await check(`SELECT accept_invitation('${bc.id}','${C}')->>'success' result`,'true');
  // B's former shared Premium access was never written as a purchased tier.
  await server();
  await db.exec(`INSERT INTO lotti_subscription_entitlements(user_id,source,paid_verified_at) VALUES('${B}','revenuecat_api',now()) ON CONFLICT(user_id) DO UPDATE SET paid_verified_at=now()`);
  await actor(C);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');
  // The new SQL consumers must reject a still-fresh legacy cache without
  // relying on an HTTP verifier to repair it first.
  await server();
  for (const product of ['entl7a7b4e9838','LottiBabyAbo']) {
    await db.exec(`UPDATE lotti_subscription_entitlements SET tier='premium',is_premium=true,product_id='${product}',checked_at=now(),expires_at=now()+interval '1 day' WHERE user_id='${B}'`);
    await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'code' result`,'not_entitled');
    await check(`SELECT consume_advisor_ai_quota('${B}')->>'code' result`,'not_entitled');
    await check(`SELECT caretaker_private.has_premium('${B}') result`,false);
  }
  await db.exec(`UPDATE lotti_subscription_entitlements SET product_id='lottibaby_premium_monthly' WHERE user_id='${B}'`);
  // Apple-family recipients have a personal tier but no paid sponsor evidence.
  await server();
  await db.exec(`UPDATE lotti_subscription_entitlements SET tier='premium',is_premium=true,expires_at=now()+interval '1 day',checked_at=now(),paid_tier=null,paid_expires_at=null,paid_subscription_id=null WHERE user_id='${B}'; DELETE FROM lotti_ai_usage_buckets`);
  await check(`SELECT consume_lotti_ai_quota('${B}',null,gen_random_uuid())->>'allowed' result`,'true');
  await actor(C);
  await check("SELECT get_family_subscription_access()->>'status' result",'none');

  if (native) {
    // Compete for one invitation through the same wrapper that the app invokes.
    await server();
    await db.exec('DELETE FROM account_links');
    const race = await invite(A);
    const queries = Array.from({length:12}, (_,i) => `SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','${i%2?B:C}',false);
      SELECT redeem_invitation_code_and_sync_due_date('${race.invitation_code}','${i%2?B:C}')->>'success' result`);
    const attempts = await db.parallelQueries(queries);
    assert.equal(attempts.filter(results => results.at(-1).rows[0].result==='true').length,1); checks++;
    await server();
    await check('SELECT count(*)::int result FROM subscription_private.members',2);
  }
  console.log(`${checks} family security PostgreSQL assertions passed (${native ? 'native, independent connections' : 'PGlite, serial execution'}).`);
} finally { await db.close(); }
