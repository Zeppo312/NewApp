// Isolated PostgreSQL smoke test. Pass a locally installed @electric-sql/pglite
// dist/index.js path; no production connection, credentials or app dependencies.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const sql = async path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const user = '11111111-1111-4111-8111-111111111111';
let checks = 0;
async function check(query, expected) {
  const { rows } = await db.query(query);
  assert.equal(rows[0].result, expected, query);
  checks++;
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA caretaker_private;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${user}');
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, is_admin boolean, paywall_access_role text);
    INSERT INTO profiles VALUES ('${user}', false, null);
  `);
  const security = await sql('supabase/migrations/20270723000000_ask_lotti_security.sql');
  await db.exec(security.slice(0, security.indexOf('CREATE TABLE IF NOT EXISTS public.lotti_ai_usage_buckets')));
  await db.exec(await sql('supabase/migrations/20270822000000_subscription_tier_cache.sql'));
  // Apply the existing private-table security statements verbatim.
  await db.exec(security.split('\n').filter(line => /^(ALTER TABLE|REVOKE ALL ON) public\.lotti_(subscription_entitlements|revenuecat_webhook_events)/.test(line)).join('\n'));
  const caretaker = await sql('supabase/migrations/20260910045915_caretaker_premium_custom_activities.sql');
  await db.exec(caretaker.slice(caretaker.indexOf('CREATE FUNCTION caretaker_private.has_premium'),
    caretaker.indexOf('CREATE OR REPLACE FUNCTION caretaker_private.access')));
  await db.exec(`INSERT INTO lotti_subscription_entitlements
    (user_id,tier,is_premium,expires_at,checked_at,source) VALUES
    ('${user}','premium',true,now()+interval '1 month',now()-interval '1 hour','revenuecat_webhook')`);
  const allowed = `SELECT caretaker_private.has_premium('${user}') AS result`;
  await check(allowed, true);
  // SQL cannot refresh RevenueCat. Preserve paid access until the known expiry;
  // freshness here relies on webhook delivery, unlike the HTTP feature gate.
  await db.exec("UPDATE lotti_subscription_entitlements SET checked_at=now()-interval '25 hours'");
  await check(allowed, true);
  await db.exec("UPDATE lotti_subscription_entitlements SET checked_at=now(), expires_at=now()-interval '1 second'");
  await check(allowed, false);
  await db.exec("UPDATE lotti_subscription_entitlements SET expires_at=null");
  await check(allowed, true);
  await db.exec("UPDATE lotti_subscription_entitlements SET tier=null,is_premium=false");
  await check(allowed, false);
  await db.exec("UPDATE lotti_subscription_entitlements SET checked_at=now(),tier='lite',is_premium=false");
  await check(allowed, false);
  await db.exec("UPDATE profiles SET paywall_access_role='premium_tester'");
  await check(allowed, true);
  await db.exec("UPDATE profiles SET paywall_access_role='lite_tester'; UPDATE lotti_subscription_entitlements SET tier='premium',is_premium=true");
  await check(allowed, false);
  await check("SELECT has_function_privilege('anon','caretaker_private.has_premium(uuid)','EXECUTE') AS result", false);
  await check("SELECT has_function_privilege('authenticated','caretaker_private.has_premium(uuid)','EXECUTE') AS result", false);
  await check("SELECT has_table_privilege('authenticated','lotti_subscription_entitlements','SELECT') AS result", false);
  await check("SELECT has_table_privilege('anon','lotti_revenuecat_webhook_events','INSERT') AS result", false);
  await check("SELECT relrowsecurity AS result FROM pg_class WHERE oid='lotti_subscription_entitlements'::regclass", true);
  await check("SELECT proconfig @> ARRAY['search_path=\"\"'] AS result FROM pg_proc WHERE oid='caretaker_private.has_premium(uuid)'::regprocedure", true);
  const previous = (await db.query('SELECT checked_at::text FROM lotti_subscription_entitlements')).rows[0].checked_at;
  await db.exec("UPDATE lotti_subscription_entitlements SET checked_at=checked_at+interval '1 millisecond', tier=null,is_premium=false");
  const staleWrite = await db.query('UPDATE lotti_subscription_entitlements SET tier=\'premium\' WHERE user_id=$1 AND checked_at=$2 RETURNING user_id', [user, previous]);
  assert.equal(staleWrite.rows.length, 0); checks++;
  await check('SELECT tier IS NULL AS result FROM lotti_subscription_entitlements', true);
  await db.exec("INSERT INTO lotti_revenuecat_webhook_events (event_id,status) VALUES ('e','completed')");
  await db.exec("INSERT INTO lotti_revenuecat_webhook_events (event_id,status) VALUES ('e','processing') ON CONFLICT (event_id) DO NOTHING");
  await check("SELECT status='completed' AS result FROM lotti_revenuecat_webhook_events WHERE event_id='e'", true);
  console.log(`${checks} PostgreSQL assertions passed (PGlite, isolated fixture schema).`);
} finally { await db.close(); }
