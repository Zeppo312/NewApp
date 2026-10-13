import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_PACKAGE || '@electric-sql/pglite');
const migrations = [
  '20260911065615_account_deletion_jobs.sql',
  '20260930055640_account_deletion_readiness.sql',
  '20260930163849_account_deletion_alarm.sql',
  '20260930170233_account_deletion_cdn_proof.sql',
  '20261001051435_account_deletion_worker_aliases.sql',
  '20261001094535_account_deletion_nullable_actor_rules.sql',
  '20261001122517_account_deletion_supervised_provider_mode.sql',
];
const owner = '10000000-0000-4000-8000-000000000001';
const control = '10000000-0000-4000-8000-000000000002';
const requiredProviders = [
  'revenuecat', 'apple', 'openai', 'sentry', 'push', 'support_mail',
  'shop', 'external_logs', 'convex_legacy', 'backups', 'shared_content', 'storage_cdn',
];

async function setup({ mode = 'supervised', backupDays = null } = {}) {
  const db = new PGlite();
  await db.exec(fs.readFileSync('supabase/tests/account_deletion_fixture.sql', 'utf8'));
  for (const file of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.query('INSERT INTO auth.users(id,last_sign_in_at,email) VALUES($1,now(),$3),($2,now(),$4)',
    [owner, control, 'owner@example.invalid', 'control@example.invalid']);
  await db.query('INSERT INTO public.profiles VALUES($1),($2)', [owner, control]);
  await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'");
  if (mode !== null) await db.query('UPDATE deletion_private.settings SET provider_handling_mode=$1', [mode]);
  await db.query('UPDATE deletion_private.settings SET receipt_retention_days=90,backup_window_days=$1,approved_by=$2,approved_at=now()',
    [backupDays, 'synthetic test operator']);
  await db.exec('UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint()');
  return db;
}

async function rpc(db, action, payload = {}) {
  return (await db.query('SELECT public.account_deletion_worker($1,$2::jsonb) result',
    [action, JSON.stringify(payload)])).rows[0].result;
}

async function ready(db) {
  return (await db.query('SELECT public.account_deletion_readiness() ready')).rows[0].ready;
}

async function reachProviderPhase(db, scope = 'account') {
  const receipt = await rpc(db, 'accept', { userId: owner, scope, source: 'app' });
  const job = await rpc(db, 'claim');
  const identity = { requestId: job.id, lease: job.lease };
  await rpc(db, 'inventory', identity);
  await rpc(db, 'storage_done', identity);
  await rpc(db, 'database', identity);
  if (scope === 'account') await db.query('DELETE FROM auth.users WHERE id=$1', [owner]);
  await rpc(db, 'auth_done', identity);
  return { receipt, identity };
}

async function resolve(db, requestId, provider, status = 'not_applicable', extra = {}) {
  await rpc(db, 'resolve_provider', {
    requestId, provider, status, operator: 'synthetic test operator',
    evidence: 'Synthetic isolated fixture: this exact provider case has no external copy.', ...extra,
  });
}

test('new mode defaults off; a retention number alone cannot authorize intake', async () => {
  const db = await setup({ mode: null, backupDays: 7 });
  try {
    assert.equal((await db.query('SELECT provider_handling_mode FROM deletion_private.settings')).rows[0].provider_handling_mode, 'unapproved');
    assert.equal(await ready(db), false);
    await assert.rejects(rpc(db, 'accept', { userId: owner, scope: 'account', source: 'app' }), /deletion_retention_not_configured/);
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 0);
  } finally { await db.close(); }
});

for (const scope of ['account', 'data']) test(`supervised ${scope} intake preserves NULL maximum and all provider gates`, async () => {
  const db = await setup();
  try {
    assert.equal(await ready(db), true);
    await db.query('INSERT INTO auth.sessions VALUES(gen_random_uuid(),$1)', [owner]);
    const receipt = await rpc(db, 'accept', { userId: owner, scope, source: 'app' });
    const rows = (await db.query('SELECT provider,status FROM deletion_private.provider_tasks WHERE request_id=$1', [receipt.requestId])).rows;
    assert.deepEqual(rows.map(r => r.provider).sort(), [...requiredProviders].sort());
    assert.equal(rows.find(r => r.provider === 'backups').status, 'pending');
    assert.equal(rows.find(r => r.provider === 'shared_content').status, 'pending');
    assert.equal(rows.find(r => r.provider === 'external_logs').status, 'pending');
    assert.equal(rows.find(r => r.provider === 'apple').status, scope === 'data' ? 'not_applicable' : 'pending');
    assert.equal((await db.query('SELECT backup_window_days FROM deletion_private.settings')).rows[0].backup_window_days, null);
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.sessions')).rows[0].n, 0);
    assert.equal(await rpc(db, 'blocked', { userId: owner }), true);
    assert.equal(await rpc(db, 'blocked', { userId: control }), false);
    await assert.rejects(db.query('INSERT INTO public.user_settings VALUES(gen_random_uuid(),$1)', [owner]), /account_deletion_pending/);
  } finally { await db.close(); }
});

test('supervised mode does not bypass named/date/fingerprint/receipt/access guards or RPC privileges', async () => {
  const db = await setup();
  try {
    for (const change of ["approved_by=NULL", "approved_at=NULL", "approved_at=now()+interval '1 day'", "approved_fingerprint='wrong'", 'receipt_retention_days=NULL']) {
      await db.exec('BEGIN');
      await db.exec(`UPDATE deletion_private.settings SET ${change}`);
      assert.equal(await ready(db), false, change);
      await assert.rejects(rpc(db, 'accept', { userId: owner, scope: 'account', source: 'app' }), /deletion_inventory_not_approved|deletion_retention_not_configured/);
      await db.exec('ROLLBACK');
    }
    await db.exec('BEGIN; ALTER ROLE authenticator RESET pgrst.db_pre_request');
    assert.equal(await ready(db), false);
    await assert.rejects(rpc(db, 'accept', { userId: owner, scope: 'account', source: 'app' }), /deletion_access_guard_not_installed/);
    await db.exec('ROLLBACK');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(ready(db), /permission denied/);
      await assert.rejects(rpc(db, 'accept', { userId: owner, scope: 'account', source: 'app' }), /permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec("UPDATE deletion_private.settings SET provider_handling_mode='verified_retention',backup_window_days=7");
    assert.equal(await ready(db), false, 'Mode changes invalidate the reviewed fingerprint');
    await db.exec('UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint()');
    assert.equal(await ready(db), true);
    await db.exec('UPDATE deletion_private.settings SET backup_window_days=NULL');
    assert.equal(await ready(db), false);
    await assert.rejects(rpc(db, 'accept', { userId: owner, scope: 'account', source: 'app' }), /deletion_retention_not_configured/);
  } finally { await db.close(); }
});

test('unknown maximum never purges even a very old completed receipt; a verified maximum uses both bounds', async () => {
  const db = await setup();
  try {
    await db.exec("INSERT INTO deletion_private.requests(user_id,scope,source,status,completed_at) VALUES(gen_random_uuid(),'account','support','completed',now()-interval '500 days')");
    await rpc(db, 'purge_receipts');
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 1);
    await db.exec("UPDATE deletion_private.settings SET provider_handling_mode='verified_retention',backup_window_days=600,approved_fingerprint=deletion_private.fingerprint()");
    await rpc(db, 'purge_receipts');
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 1);
    await db.exec('UPDATE deletion_private.settings SET backup_window_days=30');
    await rpc(db, 'purge_receipts');
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('direct support acceptance independently requires a named dated policy approval', async () => {
  const db = await setup();
  try {
    // Exercise the private entry directly, independently of its insert trigger.
    await db.exec('ALTER TABLE deletion_private.requests DISABLE TRIGGER account_deletion_acceptance_guard');
    for (const change of ["approved_by=NULL", "approved_by='  '", 'approved_at=NULL', "approved_at=now()+interval '1 day'"]) {
      await db.exec('BEGIN');
      await db.exec(`UPDATE deletion_private.settings SET ${change}`);
      await assert.rejects(db.query('SELECT deletion_private.accept($1,$2,$3,$4,$5)',
        [owner, 'account', 'support', 'Synthetic verified identity in a controlled fixture.', 'test support operator']), /deletion_inventory_not_approved/);
      await db.exec('ROLLBACK');
      assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 0);
    }
  } finally { await db.close(); }
});

test('pending backups block completion; an overdue retention date never auto-closes; evidence resolves only its own case', async () => {
  const db = await setup();
  try {
    const { receipt, identity } = await reachProviderPhase(db);
    for (const provider of requiredProviders.filter(p => p !== 'backups')) await resolve(db, receipt.requestId, provider);
    await rpc(db, 'verify', identity);
    assert.equal((await db.query('SELECT status,error_code FROM deletion_private.requests')).rows[0].status, 'needs_attention');
    await resolve(db, receipt.requestId, 'backups', 'retention_pending', { dueAt: new Date(Date.now() - 86400000).toISOString() });
    let job = await rpc(db, 'claim');
    await rpc(db, 'verify', { requestId: job.id, lease: job.lease });
    assert.equal((await db.query('SELECT status FROM deletion_private.requests')).rows[0].status, 'retention_pending');
    await resolve(db, receipt.requestId, 'backups', 'completed', { evidence: 'Synthetic fixture: every actual test backup copy was independently removed and absence verified.' });
    job = await rpc(db, 'claim');
    await rpc(db, 'verify', { requestId: job.id, lease: job.lease });
    assert.equal((await db.query('SELECT status FROM deletion_private.requests')).rows[0].status, 'completed');
    assert.equal((await db.query('SELECT id FROM auth.users')).rows[0].id, control);
    assert.equal((await db.query('SELECT id FROM public.profiles')).rows[0].id, control);
    assert.equal((await db.query('SELECT backup_window_days FROM deletion_private.settings')).rows[0].backup_window_days, null);
  } finally { await db.close(); }
});

for (const missing of ['backups', 'shared_content', 'external_logs', 'storage_cdn']) test(`missing mandatory ${missing} evidence cannot be treated as non-applicability`, async () => {
  const db = await setup();
  try {
    const { receipt, identity } = await reachProviderPhase(db);
    for (const provider of requiredProviders) await resolve(db, receipt.requestId, provider);
    await db.query('DELETE FROM deletion_private.provider_tasks WHERE request_id=$1 AND provider=$2', [receipt.requestId, missing]);
    await rpc(db, 'verify', identity);
    assert.deepEqual((await db.query('SELECT status,error_code FROM deletion_private.requests')).rows,
      [{ status: 'needs_attention', error_code: 'provider_inventory_incomplete' }]);
  } finally { await db.close(); }
});
