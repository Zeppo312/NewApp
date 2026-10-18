// Direct standalone deletion; temporary local PostgreSQL, synthetic data only.
// Live definitions of blocked()/guard_write come from the 2026-10-16 catalog;
// the candidate migration replaces both. Second connections model other devices.
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import EmbeddedPostgres from '../../.family-qa/postgres-tools/node_modules/embedded-postgres/dist/index.js';

const root = new URL('../../', import.meta.url).pathname;
const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002';
const files = ['supabase/migrations/20260911065615_account_deletion_jobs.sql',
  'supabase/migrations/20260930055640_account_deletion_readiness.sql', 'supabase/migrations/20260930163849_account_deletion_alarm.sql',
  'supabase/migrations/20260930170233_account_deletion_cdn_proof.sql', 'supabase/migrations/20261001051435_account_deletion_worker_aliases.sql',
  'supabase/migrations/20261001094535_account_deletion_nullable_actor_rules.sql'];
const catalog = JSON.parse(fs.readFileSync(root + 'output/account-deletion-deployment-preflight-20261016/catalog.json', 'utf8')).rows[0].catalog;
const url = path => `https://x.supabase.co/storage/v1/object/public/${path}`;
let pg, tmp, index = 0, db, name, extra = [];

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lottibaby-direct-deletion-'));
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  pg = new EmbeddedPostgres({ databaseDir: path.join(tmp, 'db'), user: 'postgres', password: 'local-synthetic-only', port, persistent: true, onLog: () => {}, onError: () => {} });
  await pg.initialise(); await pg.start();
  const c = pg.getPgClient(); await c.connect();
  await c.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator'); await c.end();
});
after(async () => { if (pg) await pg.stop(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

beforeEach(async () => {
  name = `direct_${++index}`; await pg.createDatabase(name);
  db = pg.getPgClient(name); await db.connect();
  await db.query(fs.readFileSync(root + 'supabase/tests/account_deletion_fixture.sql', 'utf8').replace(/CREATE ROLE[^\n]*\n/, ''));
  for (const file of files) await db.query(fs.readFileSync(root + file, 'utf8'));
  await db.query(catalog.functions.find(x => x.name === 'guard_write').definition);
  await db.query(catalog.functions.find(x => x.name === 'blocked').definition);
  await db.query(`CREATE TABLE public.account_links(id uuid DEFAULT gen_random_uuid(),creator_id uuid,invited_id uuid,status text);
    CREATE TABLE public.terms_consents(id uuid DEFAULT gen_random_uuid(),user_id uuid);`);
  await db.query(fs.readFileSync(root + 'supabase/migrations/20270902000000_account_deletion_direct_standalone.sql', 'utf8'));
  await db.query(`INSERT INTO auth.users(id,email) VALUES('${a}','a@example.invalid'),('${b}','b@example.invalid');
    INSERT INTO public.profiles VALUES('${a}'),('${b}');
    INSERT INTO public.user_settings VALUES(gen_random_uuid(),'${a}'),(gen_random_uuid(),'${b}');
    INSERT INTO public.terms_consents(user_id) VALUES('${a}');
    INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('baby-profile-images','${a}/baby.jpg','${a}');`);
});
afterEach(async () => { for (const c of extra) await c.end().catch(() => {}); extra = []; await db.end(); });

const device = async () => { const c = pg.getPgClient(name); await c.connect(); extra.push(c); return c; };
const rpc = async (action, payload, client = db) => (await client.query('SELECT public.account_deletion_direct($1,$2::jsonb) r', [action, JSON.stringify(payload)])).rows[0].r;
const one = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const asUser = (uid, sql, client = db) => client.query(`SELECT set_config('request.jwt.claim.sub','${uid}',true); ${sql}`);
const runAs = async (uid, sql) => { await db.query('BEGIN'); try { await asUser(uid, sql); await db.query('COMMIT'); } catch (e) { await db.query('ROLLBACK'); throw e; } };
const settled = async (promise, ms = 400) => Promise.race([promise.then(() => true, () => true), new Promise(r => setTimeout(() => r(false), ms))]);
const removeFiles = uid => db.query(`DELETE FROM storage.objects WHERE owner_id='${uid}'`); // Storage API removal
const startAccount = async (scope = 'account') => { await rpc('begin', { userId: a, scope }); return rpc('verify', { userId: a, scope }); };

test('a file referenced by another account blocks the direct path before any binary is listed', async () => {
  await db.query(`INSERT INTO public.community_posts VALUES(gen_random_uuid(),'${b}','${url(`baby-profile-images/${a}/baby.jpg`)}')`);
  assert.deepEqual(await rpc('check', { userId: a }), { available: false, reason: 'shared_media', pending: null });
  await assert.rejects(rpc('begin', { userId: a, scope: 'account' }), /standalone_check_failed:shared_media/);
  assert.equal(await one('SELECT count(*)::int FROM deletion_private.direct_requests'), 0);
});

test('own references do not count as shared media', async () => {
  await db.query(`INSERT INTO public.community_posts VALUES(gen_random_uuid(),'${a}','${url(`baby-profile-images/${a}/baby.jpg`)}')`);
  assert.equal((await rpc('check', { userId: a })).available, true);
});

test('an accepted partner link keeps the reviewed path', async () => {
  await db.query(`INSERT INTO public.account_links(creator_id,invited_id,status) VALUES('${b}','${a}','accepted')`);
  assert.equal((await rpc('check', { userId: a })).reason, 'linked_account');
});

test('after begin the user can neither write nor upload, and nobody can reference the files', async () => {
  const verified = await startAccount();
  assert.deepEqual(verified, { cancelled: false, objects: [{ bucket: 'baby-profile-images', path: `${a}/baby.jpg` }] });
  await assert.rejects(runAs(a, `INSERT INTO public.user_settings VALUES(gen_random_uuid(),'${a}')`), /account_deletion_pending/);
  await assert.rejects(runAs(a, `INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('baby-profile-images','${a}/late.jpg','${a}')`), /account_deletion_pending/);
  await assert.rejects(runAs(b, `INSERT INTO public.community_posts VALUES(gen_random_uuid(),'${b}','${url(`baby-profile-images/${a}/baby.jpg`)}')`), /account_deletion_pending/);
  await runAs(b, `INSERT INTO public.community_posts VALUES(gen_random_uuid(),'${b}','unrelated')`);
  assert.deepEqual(await rpc('check', { userId: a }), { available: true, reason: null, pending: 'account' });
});

test('an upload already in flight is waited for and inventoried, never left behind', async () => {
  const other = await device();
  await other.query('BEGIN');
  await asUser(a, `INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('baby-profile-images','${a}/inflight.jpg','${a}')`, other);
  const begin = rpc('begin', { userId: a, scope: 'account' }, await device());
  assert.equal(await settled(begin), false, 'begin must wait for the open upload');
  await other.query('COMMIT'); await begin;
  const verified = await rpc('verify', { userId: a, scope: 'account' });
  assert.deepEqual(verified.objects.map(o => o.path).sort(), [`${a}/baby.jpg`, `${a}/inflight.jpg`]);
  await assert.rejects(rpc('erase', { userId: a, scope: 'account' }), /residual_storage_objects/);
  await removeFiles(a);
  await rpc('erase', { userId: a, scope: 'account' });
  assert.equal(await one(`SELECT count(*)::int FROM storage.objects WHERE owner_id='${a}'`), 0);
});

test('a foreign reference already in flight cancels the request before any removal', async () => {
  const other = await device();
  await other.query('BEGIN');
  await asUser(b, `INSERT INTO public.community_posts VALUES(gen_random_uuid(),'${b}','${url(`baby-profile-images/${a}/baby.jpg`)}')`, other);
  const begin = rpc('begin', { userId: a, scope: 'account' }, await device());
  assert.equal(await settled(begin), false);
  await other.query('COMMIT'); await begin;
  assert.deepEqual(await rpc('verify', { userId: a, scope: 'account' }), { cancelled: true, reason: 'shared_media' });
  assert.equal(await one('SELECT count(*)::int FROM deletion_private.direct_requests'), 0);
  assert.equal(await one('SELECT deletion_private.blocked($1)', [a]), false);
  await assert.rejects(rpc('erase', { userId: a, scope: 'account' }), /direct_request_missing/);
});

test('a snapshot older than begin is refused so it cannot slip past the marker', async () => {
  const other = await device();
  await other.query('BEGIN ISOLATION LEVEL REPEATABLE READ'); await other.query('SELECT 1');
  await rpc('begin', { userId: a, scope: 'account' });
  await assert.rejects(asUser(a, `INSERT INTO public.user_settings VALUES(gen_random_uuid(),'${a}')`, other), e => e.code === '40001');
  await other.query('ROLLBACK');
  // A retry with a fresh snapshot of an unrelated user proceeds normally.
  await runAs(b, `INSERT INTO public.user_settings VALUES(gen_random_uuid(),'${b}')`);
});

test('begin gives up instead of stalling all writes behind a long transaction', async () => {
  const other = await device();
  await other.query('BEGIN');
  await asUser(b, `INSERT INTO public.user_settings VALUES(gen_random_uuid(),'${b}')`, other);
  await assert.rejects(rpc('begin', { userId: a, scope: 'account' }), /lock timeout/);
  await other.query('COMMIT');
  assert.equal(await one('SELECT count(*)::int FROM deletion_private.direct_requests'), 0);
});

test('erase refuses without verify and while a binary remains', async () => {
  await rpc('begin', { userId: a, scope: 'account' });
  await assert.rejects(rpc('erase', { userId: a, scope: 'account' }), /direct_not_verified/);
  await rpc('verify', { userId: a, scope: 'account' });
  await assert.rejects(rpc('erase', { userId: a, scope: 'account' }), /residual_storage_objects/);
  assert.equal(await one('SELECT count(*)::int FROM public.user_settings WHERE user_id=$1', [a]), 1);
  assert.equal(await one('SELECT count(*)::int FROM auth.users WHERE id=$1', [a]), 1);
  assert.equal(await one('SELECT deletion_private.blocked($1)', [a]), true);
});

test('account deletion removes rows and the auth user in one step and stays blocked', async () => {
  await startAccount(); await removeFiles(a);
  assert.equal((await rpc('erase', { userId: a, scope: 'account' })).status, 'completed');
  assert.equal(await one('SELECT count(*)::int FROM auth.users WHERE id=$1', [a]), 0);
  assert.equal(await one('SELECT count(*)::int FROM public.user_settings WHERE user_id=$1', [a]), 0);
  assert.equal(await one('SELECT count(*)::int FROM public.terms_consents WHERE user_id=$1', [a]), 0);
  assert.equal(await one('SELECT count(*)::int FROM public.user_settings WHERE user_id=$1', [b]), 1);
  assert.equal(await one('SELECT count(*)::int FROM deletion_private.direct_inventory'), 0);
  assert.equal(await one('SELECT deletion_private.blocked($1)', [a]), true);
});

test('a failing auth deletion rolls back every row; fail keeps the barrier and resume completes', async () => {
  await db.query(`CREATE TABLE public.unlisted_link(owner uuid REFERENCES auth.users(id)); INSERT INTO public.unlisted_link VALUES('${a}');`);
  await startAccount(); await removeFiles(a);
  await assert.rejects(rpc('erase', { userId: a, scope: 'account' }));
  assert.equal(await one('SELECT count(*)::int FROM public.user_settings WHERE user_id=$1', [a]), 1);
  assert.equal(await one('SELECT count(*)::int FROM public.profiles WHERE id=$1', [a]), 1);
  assert.equal(await one('SELECT count(*)::int FROM auth.users WHERE id=$1', [a]), 1);
  await rpc('fail', { userId: a, code: 'deletion_database_failed' });
  assert.equal(await one("SELECT status||':'||failure_code FROM deletion_private.direct_requests"), 'failed:deletion_database_failed');
  assert.equal(await one('SELECT deletion_private.blocked($1)', [a]), true);
  await assert.rejects(rpc('begin', { userId: a, scope: 'data' }), /direct_scope_conflict/);
  await db.query('DELETE FROM public.unlisted_link');
  assert.equal((await rpc('begin', { userId: a, scope: 'account' })).attempts, 2);
  assert.equal((await rpc('verify', { userId: a, scope: 'account' })).cancelled, false);
  assert.equal((await rpc('erase', { userId: a, scope: 'account' })).status, 'completed');
});

test('a data reset keeps login and terms and unblocks afterwards', async () => {
  await startAccount('data'); await removeFiles(a);
  await rpc('erase', { userId: a, scope: 'data' });
  assert.equal(await one('SELECT count(*)::int FROM auth.users WHERE id=$1', [a]), 1);
  assert.equal(await one('SELECT count(*)::int FROM public.user_settings WHERE user_id=$1', [a]), 0);
  assert.equal(await one('SELECT count(*)::int FROM public.profiles WHERE id=$1', [a]), 0);
  assert.equal(await one('SELECT count(*)::int FROM public.terms_consents WHERE user_id=$1', [a]), 1);
  assert.equal(await one('SELECT deletion_private.blocked($1)', [a]), false);
  await runAs(a, `INSERT INTO public.user_settings VALUES(gen_random_uuid(),'${a}')`);
});

test('only the service role can call the bridge', async () => {
  const r = (await db.query(`SELECT has_function_privilege('anon','public.account_deletion_direct(text,jsonb)','execute') anon,
    has_function_privilege('authenticated','public.account_deletion_direct(text,jsonb)','execute') auth,
    has_function_privilege('service_role','public.account_deletion_direct(text,jsonb)','execute') service`)).rows[0];
  assert.deepEqual(r, { anon: false, auth: false, service: true });
});
