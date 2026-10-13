import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_PACKAGE || '@electric-sql/pglite');
const known = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const migration = '20261004062928_account_deletion_alarm_acknowledgements.sql';
const migrations = [
 '20260911065615_account_deletion_jobs.sql',
 '20260930055640_account_deletion_readiness.sql',
 '20260930163849_account_deletion_alarm.sql',
 '20260930170233_account_deletion_cdn_proof.sql',
 '20261001051435_account_deletion_worker_aliases.sql',
 '20261001094535_account_deletion_nullable_actor_rules.sql',
 '20261001122517_account_deletion_supervised_provider_mode.sql',
 '20261001124926_account_deletion_durable_registry.sql',
];
async function setup(production = false) {
 const db = new PGlite();
 await db.exec(await fs.readFile('supabase/tests/account_deletion_fixture.sql', 'utf8'));
 for (const file of migrations) await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
 if (production) await db.exec(await fs.readFile('supabase/migrations/20261002095359_account_deletion_runtime_monitor.sql', 'utf8'));
 await db.exec(await fs.readFile(`supabase/migrations/${migration}`, 'utf8'));
 await db.exec("ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'; UPDATE deletion_private.settings SET provider_handling_mode='supervised',receipt_retention_days=90,approved_by='synthetic operator',approved_at=now(); UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint()");
 await db.query(`INSERT INTO deletion_private.requests(id,user_id,scope,source,status,phase,error_code)
  VALUES($1,$1,'account','support','needs_attention','providers','provider_evidence_required')`, [known]);
 await db.query("INSERT INTO deletion_private.provider_tasks(request_id,provider) VALUES($1,'openai')", [known]);
 return db;
}
const health = async db => (await db.query("SELECT public.account_deletion_alarm('health') result")).rows[0].result;
const acknowledge = db => db.query(`INSERT INTO deletion_private.alarm_acknowledgements(request_id,request_updated_at,acknowledged_by,reason)
 SELECT id,updated_at,'synthetic operator','Known provider follow-up reminder acknowledged' FROM deletion_private.requests WHERE id=$1`, [known]);

for (const production of [false, true]) test(`${production ? 'production' : 'QA'} suppresses only the acknowledged unchanged case and preserves its deletion evidence`, async () => {
 const db = await setup(production);
 try {
  const snapshot = async () => (await db.query(`SELECT to_jsonb(r) request,
   (SELECT jsonb_agg(to_jsonb(t)) FROM deletion_private.provider_tasks t WHERE t.request_id=r.id) providers
   FROM deletion_private.requests r WHERE r.id=$1`, [known])).rows;
  const before = await snapshot();
  assert.equal((await health(db)).needs_attention, 1);
  await acknowledge(db);
  assert.equal((await health(db)).needs_attention, 0);
  assert.deepEqual(await snapshot(), before);
  await db.query(`INSERT INTO deletion_private.requests(id,user_id,scope,source,status,phase,error_code)
   VALUES($1,$1,'account','support','needs_attention','providers','provider_evidence_required')`, [other]);
  assert.equal((await health(db)).needs_attention, 1);
 } finally { await db.close(); }
});

test('a changed case timestamp, phase or error invalidates the reminder acknowledgement', async () => {
 const db = await setup();
 try {
  await acknowledge(db);
  for (const change of ["updated_at=updated_at+interval '1 second'", "phase='verify'", "error_code='unexpected_failure'", 'error_code=NULL']) {
   await db.exec('BEGIN');
   await db.query(`UPDATE deletion_private.requests SET ${change} WHERE id=$1`, [known]);
   assert.equal((await health(db)).needs_attention, 1, change);
   await db.exec('ROLLBACK');
  }
 } finally { await db.close(); }
});

test('registry, queue, lease and retention alarms stay active after acknowledging provider reminders', async () => {
 const db = await setup(true);
 try {
  await acknowledge(db);
  await db.exec("UPDATE deletion_private.registry_runtime SET monitor_required=true,last_sync_at=now()-interval '4 minutes'");
  await db.exec(`INSERT INTO deletion_private.requests(user_id,scope,source,status,created_at,updated_at,lease_until) VALUES
   ('20000000-0000-4000-8000-000000000001','account','support','queued',now()-interval '16 minutes',now(),NULL),
   ('20000000-0000-4000-8000-000000000002','account','support','processing',now(),now()-interval '10 minutes',now()-interval '8 minutes'),
   ('20000000-0000-4000-8000-000000000003','account','support','processing',now(),now()-interval '5 minutes',now()+interval '1 minute')`);
  await db.query(`INSERT INTO deletion_private.provider_tasks(request_id,provider,status,evidence,resolved_by,due_at)
   VALUES($1,'retention_test','retention_pending','synthetic retention evidence','synthetic operator',now()-interval '1 minute')`, [known]);
  assert.deepEqual(await health(db), {
   registry_stale_over_3m: 1, needs_attention: 0, queued_over_15m: 1,
   expired_lease_over_7m: 1, lease_exceeds_contract: 1, overdue_retention: 1,
  });
 } finally { await db.close(); }
});

test('users and the service client cannot acknowledge reminders; existing health RPC remains service-only', async () => {
 const db = await setup();
 try {
  for (const role of ['anon', 'authenticated', 'service_role']) {
   await db.exec(`SET ROLE ${role}`);
   await assert.rejects(acknowledge(db), /permission denied/);
   if (role === 'service_role') assert.equal((await health(db)).needs_attention, 1);
   else await assert.rejects(health(db), /permission denied/);
   await db.exec('RESET ROLE');
  }
  assert.equal((await db.query("SELECT relrowsecurity enabled FROM pg_class WHERE oid='deletion_private.alarm_acknowledgements'::regclass")).rows[0].enabled, true);
 } finally { await db.close(); }
});
