import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { entryDigest, mergeRegistry, registryFilename, syncDeletionRegistry } from '../account-deletion-registry.mjs';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_PACKAGE || '@electric-sql/pglite');
const typescript = require('typescript');
const origin = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
const owner = '10000000-0000-4000-8000-000000000001';
const control = '10000000-0000-4000-8000-000000000002';
const migrations = [
  '20260911065615_account_deletion_jobs.sql', '20260930055640_account_deletion_readiness.sql',
  '20260930163849_account_deletion_alarm.sql', '20260930170233_account_deletion_cdn_proof.sql',
  '20261001051435_account_deletion_worker_aliases.sql', '20261001094535_account_deletion_nullable_actor_rules.sql',
  '20261001122517_account_deletion_supervised_provider_mode.sql', '20261001124926_account_deletion_durable_registry.sql',
];

async function setup() {
  const db = new PGlite();
  await db.exec(await fs.readFile('supabase/tests/account_deletion_fixture.sql', 'utf8'));
  for (const file of migrations) await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
  await db.query('INSERT INTO auth.users(id,last_sign_in_at,email) VALUES($1,now(),$3),($2,now(),$4)', [owner, control, 'owner@example.invalid', 'control@example.invalid']);
  await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'; UPDATE deletion_private.settings SET provider_handling_mode='supervised',receipt_retention_days=90,approved_by='synthetic operator',approved_at=now(); UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint()");
  return db;
}

async function rpc(db, action, payload = {}) {
  return (await db.query('SELECT public.account_deletion_worker($1,$2::jsonb) result', [action, JSON.stringify(payload)])).rows[0].result;
}
const exported = async db => (await db.query('SELECT public.account_deletion_registry_export() result')).rows[0].result;
const acknowledge = async (db, payload) => (await db.query('SELECT public.account_deletion_registry_ack($1,$2,$3) result', [payload.p_request_id, payload.p_digest, payload.p_writer])).rows[0].result;
const accept = (db, userId = owner) => rpc(db, 'accept', { userId, scope: 'account', source: 'app' });

async function temporary() {
  // Resolve the macOS /var alias before testing the no-symlink policy.
  return fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'lotti-registry-synthetic-'));
}
const options = (db, directory) => ({ directory, origin, writer: 'synthetic operator', exportRegistry: () => exported(db), acknowledge: payload => acknowledge(db, payload) });

test('minimal export and acknowledgement are service-only and bind origin, identity, scope and stored UTC time', async () => {
  const db = await setup();
  try {
    const receipt = await accept(db); await accept(db, control);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(exported(db), /permission denied/);
      await assert.rejects(acknowledge(db, { p_request_id: receipt.requestId, p_digest: 'a'.repeat(64), p_writer: 'test operator' }), /permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE service_role');
    const snapshot = await exported(db);
    assert.equal(snapshot.version, 1); assert.equal(snapshot.origin, origin);
    const entry = snapshot.entries.find(e => e.requestId === receipt.requestId);
    assert.deepEqual(Object.keys(entry).sort(), ['acceptedAt', 'digest', 'requestId', 'scope', 'userId']);
    assert.match(entry.acceptedAt, /\.\d{6}Z$/);
    assert.equal(entry.digest, entryDigest(origin, entry));
    assert.equal((await exported(db)).entries.find(e => e.requestId === entry.requestId).acceptedAt, entry.acceptedAt);
    await assert.rejects(acknowledge(db, { p_request_id: receipt.requestId, p_digest: snapshot.entries.find(e => e.userId === control).digest, p_writer: 'test operator' }), /deletion_registry_payload_mismatch/);
    await assert.rejects(acknowledge(db, { p_request_id: receipt.requestId, p_digest: entry.digest, p_writer: '' }), /deletion_registry_invalid_ack/);
    await assert.rejects(db.query('UPDATE deletion_private.requests SET registry_acknowledged_at=now()'), /permission denied/);
  } finally { await db.close(); }
});

test('missing or mismatched acknowledgement cannot claim a job or trigger the actual Edge worker Auth ban', async () => {
  const db = await setup();
  try {
    const receipt = await accept(db);
    assert.equal(await rpc(db, 'claim'), null);
    await db.query("UPDATE deletion_private.requests SET registry_acknowledged_at=now(),registry_entry_sha256=$2,registry_ack_writer='synthetic' WHERE id=$1", [receipt.requestId, 'a'.repeat(64)]);
    assert.equal(await rpc(db, 'claim'), null);
    let authCalls = 0; let privateWrites = 0;
    const admin = { rpc: async (name, args) => {
      assert.equal(name, 'account_deletion_worker');
      return { data: await rpc(db, args.action, args.payload), error: null };
    }, auth: { admin: { updateUserById: () => { authCalls++; throw new Error('Auth ban forbidden before durable acknowledgement'); } } }, from: () => { privateWrites++; throw new Error('Private writes forbidden before acknowledgement'); } };
    const load = async filename => typescript.transpileModule(await fs.readFile(filename, 'utf8'), { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 } }).outputText;
    const contracts = { exports: {}, TextEncoder, Response }; vm.runInNewContext(await load('supabase/functions/_shared/accountDeletion/contracts.ts'), contracts);
    const context = { exports: {}, require: name => name.includes('contracts') ? contracts.exports : {}, Response, Request };
    vm.runInNewContext(await load('supabase/functions/process-account-deletion/handler.ts'), context);
    const env = { SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key', ACCOUNT_DELETION_ENABLED: 'true', ACCOUNT_DELETION_CRON_SECRET: 'a'.repeat(64) };
    const handler = context.exports.createProcessHandler({ env: key => env[key], createAdmin: () => admin });
    const response = await handler(new Request(origin + '/functions/v1/process-account-deletion', { method: 'POST', headers: { Authorization: `Bearer ${env.ACCOUNT_DELETION_CRON_SECRET}` } }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { processed: false });
    assert.equal(authCalls, 0); assert.equal(privateWrites, 0);
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, 2);
  } finally { await db.close(); }
});

test('acknowledgement happens only after a real external 0600 atomic write, fsync and exact readback', async () => {
  const db = await setup(); const directory = await temporary();
  try {
    const receipt = await accept(db); let checked = false;
    const result = await syncDeletionRegistry({ ...options(db, directory), acknowledge: async payload => {
      const filename = path.join(directory, registryFilename); const stat = await fs.lstat(filename);
      assert.equal(stat.mode & 0o777, 0o600); assert.equal(stat.uid, process.getuid());
      const stored = JSON.parse(await fs.readFile(filename, 'utf8'));
      assert(stored.entries.some(e => e.requestId === payload.p_request_id && e.digest === payload.p_digest));
      checked = true; return acknowledge(db, payload);
    } });
    assert.equal(result.durableReadback, true); assert.equal(result.entries, 1); assert.equal(checked, true);
    const job = await rpc(db, 'claim'); assert.equal(job.id, receipt.requestId);
    await rpc(db, 'inventory', { requestId: job.id, lease: job.lease });
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('restart after an Ack transport failure reconciles existing durable data and duplicate acceptance idempotently', async () => {
  const db = await setup(); const directory = await temporary();
  try {
    const first = await accept(db); const duplicate = await accept(db);
    assert.equal(first.requestId, duplicate.requestId);
    await assert.rejects(syncDeletionRegistry({ ...options(db, directory), acknowledge: async () => { throw new Error('Synthetic connection lost before Ack'); } }), /connection lost/);
    assert.equal(await rpc(db, 'claim'), null);
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, registryFilename), 'utf8')).entries.length, 1);
    const retry = await syncDeletionRegistry(options(db, directory));
    assert.equal(retry.entries, 1); assert.equal(retry.acknowledged, 1);
    const before = (await db.query('SELECT registry_acknowledged_at FROM deletion_private.requests')).rows[0].registry_acknowledged_at;
    await syncDeletionRegistry(options(db, directory));
    assert.equal((await db.query('SELECT registry_acknowledged_at FROM deletion_private.requests')).rows[0].registry_acknowledged_at.getTime(), before.getTime());
    assert.equal((await rpc(db, 'claim')).id, first.requestId);
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('even a real durable acknowledgement cannot run a destructive phase without a present current lease and deadline', async () => {
  const db = await setup(); const directory = await temporary();
  try {
    const receipt = await accept(db);
    await syncDeletionRegistry(options(db, directory));
    // Both missing leases previously made the SQL condition false/NULL.
    await assert.rejects(rpc(db, 'inventory', { requestId: receipt.requestId }), /lease_lost/);
    assert.equal((await db.query('SELECT phase FROM deletion_private.requests')).rows[0].phase, 'inventory');
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, 2);
    const job = await rpc(db, 'claim');
    const payload = { requestId: job.id, lease: job.lease };
    await db.query('UPDATE deletion_private.requests SET lease_until=NULL WHERE id=$1', [job.id]);
    await assert.rejects(rpc(db, 'inventory', payload), /lease_lost/);
    await db.query("UPDATE deletion_private.requests SET lease_until=now()-interval '1 second' WHERE id=$1", [job.id]);
    await assert.rejects(rpc(db, 'inventory', payload), /lease_lost/);
    await db.query("UPDATE deletion_private.requests SET lease_until=now()+interval '3 minutes' WHERE id=$1", [job.id]);
    await assert.rejects(rpc(db, 'inventory', { requestId: job.id }), /lease_lost/);
    await rpc(db, 'inventory', payload);
    assert.equal((await db.query('SELECT phase FROM deletion_private.requests')).rows[0].phase, 'storage');
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('an empty/older restored database cannot overwrite independent entries or acknowledge absent jobs', async () => {
  const db = await setup(); const directory = await temporary();
  try {
    await accept(db); await syncDeletionRegistry(options(db, directory));
    const oldEntries = JSON.parse(await fs.readFile(path.join(directory, registryFilename), 'utf8')).entries;
    await db.exec('DELETE FROM deletion_private.requests');
    let acknowledgements = 0;
    const result = await syncDeletionRegistry({ ...options(db, directory), acknowledge: async () => { acknowledgements++; throw new Error('No absent job should be acknowledged'); } });
    assert.equal(result.entries, 1); assert.equal(acknowledgements, 0);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, registryFilename), 'utf8')).entries, oldEntries);
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('unknown backup maximum prevents purging an old completed receipt even after a durable register Ack', async () => {
  const db = await setup(); const directory = await temporary();
  try {
    await db.exec("INSERT INTO deletion_private.requests(user_id,scope,source,status,completed_at) VALUES(gen_random_uuid(),'account','support','completed',now()-interval '500 days')");
    await syncDeletionRegistry(options(db, directory));
    await rpc(db, 'purge_receipts');
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 1);
    await db.exec("UPDATE deletion_private.settings SET provider_handling_mode='verified_retention',backup_window_days=600");
    await rpc(db, 'purge_receipts');
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 1);
    await db.exec('UPDATE deletion_private.settings SET backup_window_days=30');
    await rpc(db, 'purge_receipts');
    assert.equal((await db.query('SELECT count(*)::int n FROM deletion_private.requests')).rows[0].n, 0);
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, registryFilename), 'utf8')).entries.length, 1, 'DB pruning alone never removes the independent entry');
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('changed origin or identity after Ack invalidates the claim barrier and is refused by reconciliation', async () => {
  const db = await setup(); const directory = await temporary();
  try {
    const receipt = await accept(db); await syncDeletionRegistry(options(db, directory));
    await db.query('UPDATE deletion_private.requests SET user_id=$2 WHERE id=$1', [receipt.requestId, control]);
    assert.equal(await rpc(db, 'claim'), null);
    await assert.rejects(syncDeletionRegistry(options(db, directory)), /identity differs/);
    await db.query('UPDATE deletion_private.requests SET user_id=$2 WHERE id=$1', [receipt.requestId, owner]);
    await db.exec("UPDATE deletion_private.settings SET storage_origin='https://ggyonianphloycmqrwvj.supabase.co'");
    assert.equal(await rpc(db, 'claim'), null);
    await assert.rejects(syncDeletionRegistry(options(db, directory)), /origin/);
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('unsafe existing file modes, hard links, symlinks and a repo destination never get an acknowledgement', async () => {
  const db = await setup(); const directory = await temporary(); const alias = directory + '-alias';
  try {
    await accept(db); await syncDeletionRegistry(options(db, directory));
    const filename = path.join(directory, registryFilename); let acknowledgements = 0;
    const guarded = { ...options(db, directory), acknowledge: async () => { acknowledgements++; throw new Error('Ack forbidden'); } };
    await fs.chmod(filename, 0o644); await assert.rejects(syncDeletionRegistry(guarded), /0600/); await fs.chmod(filename, 0o600);
    const hardlink = path.join(directory, 'hard-link'); await fs.link(filename, hardlink); await assert.rejects(syncDeletionRegistry(guarded), /single operator-owned/); await fs.unlink(hardlink);
    await fs.symlink(directory, alias); await assert.rejects(syncDeletionRegistry({ ...guarded, directory: alias }), /symlink/); await fs.unlink(alias);
    await fs.rename(filename, filename + '.protected'); await fs.symlink(filename + '.protected', filename); await assert.rejects(syncDeletionRegistry(guarded), /single operator-owned/); await fs.unlink(filename);
    await assert.rejects(syncDeletionRegistry({ ...guarded, directory: path.resolve('.family-qa/forbidden-registry-test') }), /outside the repository/);
    assert.equal(acknowledgements, 0);
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); await fs.unlink(alias).catch(() => {}); }
});

test('a corrupted readback cannot acknowledge a job', async () => {
  const db = await setup(); const directory = await temporary(); let acknowledgements = 0;
  try {
    await accept(db);
    await assert.rejects(syncDeletionRegistry({ ...options(db, directory), afterRename: filename => fs.writeFile(filename, '{"corrupted":true}\n', { mode: 0o600 }), acknowledge: async () => { acknowledgements++; throw new Error('Ack forbidden'); } }), /readback/);
    assert.equal(acknowledgements, 0); assert.equal(await rpc(db, 'claim'), null);
  } finally { await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('concurrent writers cannot lose an earlier acknowledged entry; retries merge it', async () => {
  const db = await setup(); const directory = await temporary(); let release; let entered;
  const paused = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  try {
    await accept(db);
    const first = syncDeletionRegistry({ ...options(db, directory), exportRegistry: async () => { const snapshot = await exported(db); entered(); await paused; return snapshot; } });
    await reached;
    await assert.rejects(syncDeletionRegistry(options(db, directory)), /writer lock exists/);
    release(); await first;
    await accept(db, control);
    const merged = await syncDeletionRegistry(options(db, directory));
    assert.equal(merged.entries, 2); assert.equal(merged.acknowledged, 2);
  } finally { release(); await db.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('canonical digest refuses changed scope, request identity, acceptance time or project', () => {
  const entry = { requestId: owner, userId: control, scope: 'account', acceptedAt: '2026-10-01T12:00:00.123456Z' };
  entry.digest = entryDigest(origin, entry);
  for (const change of [{ scope: 'data' }, { requestId: control }, { userId: owner }, { acceptedAt: '2026-10-01T12:00:00.123457Z' }]) {
    assert.throws(() => mergeRegistry(null, { version: 1, origin, entries: [{ ...entry, ...change }] }, origin), /digest/);
  }
  assert.throws(() => mergeRegistry(null, { version: 1, origin: 'https://ggyonianphloycmqrwvj.supabase.co', entries: [entry] }, origin), /origin/);
});
