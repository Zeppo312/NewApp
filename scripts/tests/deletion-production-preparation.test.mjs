import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_PACKAGE || '@electric-sql/pglite');
const { buildSql } = require('../prepare-deletion-production-rollout.cjs');
const owner = '10000000-0000-4000-8000-000000000001';
const control = '10000000-0000-4000-8000-000000000002';

async function setup() {
  const db = new PGlite();
  await db.exec(fs.readFileSync('supabase/tests/account_deletion_fixture.sql', 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync('.family-qa/deletion-production-preparation-20261001/fresh-baseline.local.json', 'utf8'));
  await db.exec(snapshot.baseline.legacy_function.definition);
  await db.exec('REVOKE ALL ON FUNCTION public.delete_user_data(boolean) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.delete_user_data(boolean) TO anon,authenticated,service_role; CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[])');
  await db.query('INSERT INTO auth.users(id,last_sign_in_at,email) VALUES($1,now(),$3),($2,now(),$4)', [owner, control, 'owner@example.invalid', 'control@example.invalid']);
  await db.query('INSERT INTO public.profiles VALUES($1),($2)', [owner, control]);
  await db.query('INSERT INTO public.direct_messages VALUES(gen_random_uuid(),$1,$2,$3)', [control, owner, 'Synthetic foreign sender remains unchanged while staging']);
  snapshot.baseline.legacy_function.definition = (await db.query("SELECT pg_get_functiondef('public.delete_user_data(boolean)'::regprocedure) definition")).rows[0].definition;
  snapshot.baseline.guard_target_tables = (await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND (n.nspname IN ('public','caretaker_private') OR n.nspname='storage' AND c.relname='objects')")).rows[0].n;
  return { db, snapshot };
}

test('the generated atomic eight-migration transaction registers only reviewed sources and remains disabled with customer fixtures intact', async () => {
  const { db, snapshot } = await setup();
  try {
    const { sql, manifests } = buildSql(snapshot); await db.exec(sql);
    assert.equal((await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready, false);
    const settings = (await db.query('SELECT * FROM deletion_private.settings')).rows[0];
    assert.equal(settings.provider_handling_mode, 'unapproved'); assert.equal(settings.backup_window_days, null);
    assert.equal(settings.receipt_retention_days, null); assert.equal(settings.approved_fingerprint, null);
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, 2);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.profiles')).rows[0].n, 2);
    assert.equal((await db.query('SELECT receiver_id FROM public.direct_messages')).rows[0].receiver_id, owner);
    const history = (await db.query('SELECT version,name,statements FROM supabase_migrations.schema_migrations ORDER BY version')).rows;
    assert.equal(history.length, 8);
    for (let i = 0; i < manifests.length; i++) {
      assert.equal(history[i].version, manifests[i].version);
      assert.deepEqual(history[i].statements, [fs.readFileSync(manifests[i].file, 'utf8')]);
    }
    await db.exec('SET ROLE anon');
    const legacy = (await db.query('SELECT public.delete_user_data(true) result')).rows[0].result;
    assert.equal(legacy.success, false); assert.match(legacy.error, /datenschutz#konto-loeschen/);
    await assert.rejects(db.query('SELECT public.account_deletion_registry_export()'), /permission denied/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, 2);
  } finally { await db.close(); }
});

for (const drift of ['legacy RPC', 'existing security hook', 'message nullability']) test(`staging refuses ${drift} drift without partial DDL or migration history`, async () => {
  const { db, snapshot } = await setup();
  try {
    const { sql } = buildSql(snapshot);
    if (drift === 'legacy RPC') await db.exec("CREATE OR REPLACE FUNCTION public.delete_user_data(delete_auth boolean DEFAULT false) RETURNS json LANGUAGE sql AS $$ SELECT '{\"changed\":true}'::json $$");
    if (drift === 'existing security hook') await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='public.existing_security_hook'");
    if (drift === 'message nullability') await db.exec('ALTER TABLE public.direct_messages ALTER COLUMN receiver_id DROP NOT NULL');
    await assert.rejects(db.exec(sql), /legacy_rpc_changed|existing_security_hook_requires_review|message_schema_changed/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT to_regnamespace('deletion_private') IS NOT NULL present")).rows[0].present, false);
    assert.equal((await db.query('SELECT count(*)::int n FROM supabase_migrations.schema_migrations')).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, 2);
  } finally { await db.close(); }
});
