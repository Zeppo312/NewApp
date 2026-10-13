// Actual process handler + managed Auth/Storage, restricted to the approved fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { createProcessHandler } from '../supabase/functions/process-account-deletion/handler.ts';
const require = createRequire(import.meta.url);
const { manifest, privateDir, root, owned, reconcile, sql, api, save } = require('./managed-deletion-restore.cjs');
const role = process.argv[2];
assert(['source', 'restore', 'restored-source'].includes(role), 'Use source, restore or restored-source');
const inPlace = role === 'restored-source';
const isRestore = role !== 'source';
if (inPlace) assert(manifest.inPlaceRestore?.submittedAt && manifest.inPlaceRestore?.backupId === manifest.backupSelection?.selectedBackup?.id, 'Approved in-place restore must be submitted first');
assert(Date.now() < Date.parse(manifest.cleanupAfter), 'Cleanup deadline reached');
const projects = await reconcile();
const entry = manifest.projects.find(p => p.role === (inPlace ? 'source' : role));
owned(entry, projects.find(p => p.id === entry?.ref));
const fixturesPath = path.join(privateDir, 'fixtures.private.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const a = fixtures.find(f => f.label === 'deleted-owner');
const b = fixtures.find(f => f.label === 'control-owner');
assert(a && b && a.id !== b.id && fixtures.length === 2);
for (const f of fixtures) {
  assert(/^[a-f0-9-]{36}$/.test(f.id));
  assert.equal(f.path, `avatars/avatar_${f.id}_managed-restore.txt`);
}
const keys = await api(`/v1/projects/${entry.ref}/api-keys`);
const key = keys.find(k => k.name === 'service_role')?.api_key;
assert(key, 'Service role key unavailable');
const origin = `https://${entry.ref}.supabase.co`;
const admin = createClient(origin, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rpc = async (action, payload = {}) => {
  const result = await admin.rpc('account_deletion_worker', { action, payload });
  if (result.error) throw Error(`Worker RPC ${action}: ${result.error.code}`);
  return result.data;
};
const registryPath = path.join(privateDir, 'independent-registry.private.json');
let registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : { workflow: manifest.workflow, entries: [] };
assert.equal(registry.workflow, manifest.workflow);
let registration = registry.entries.find(r => r.projectRef === entry.ref && (r.stage ?? 'source') === (isRestore ? 'restore' : 'source'));
const publicPath = path.join(root, `output/deletion-completion-20260930/managed-${role}-deletion.json`);
const previousReport = fs.existsSync(publicPath) ? JSON.parse(fs.readFileSync(publicPath, 'utf8')) : null;
if (previousReport) assert.equal(previousReport.projectRef, entry.ref, 'Cannot resume a report from a different project');
const report = previousReport ?? { role, projectRef: entry.ref, restoreMode: inPlace ? 'in_place_disposable_project' : isRestore ? 'separate_disposable_project' : null, separateRestoreProject: isRestore && !inPlace, startedAt: new Date().toISOString(), passed: false, managedPhysicalRestoreVerified: false, fullDeletionCompleted: false, limitations: ['Minimal synthetic application schema; no native app/OTP acceptance.', 'Provider retention remains visible; no general CDN or external log retention guarantee.'] };
if (report.failure) {
  report.previousFailures ??= [];
  report.previousFailures.push({ failure: report.failure, failedAt: report.failedAt });
  delete report.failure; delete report.failedAt;
}
report.resumedAt = previousReport ? new Date().toISOString() : null;
report.passed = false;
function writeReport() { fs.writeFileSync(publicPath, JSON.stringify(report, null, 2) + '\n'); }
function writePrivate() { fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), { mode: 0o600 }); }
async function readPublic(projectRef, fixture) {
  const response = await fetch(`https://${projectRef}.supabase.co/storage/v1/object/public/community-images/${fixture.path}`, { signal: AbortSignal.timeout(10000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), cacheControl: response.headers.get('cache-control'), cacheStatus: response.headers.get('cf-cache-status'), checkedAt: new Date().toISOString() };
}
try {
  // This backup predates the alias repair. Reapply the tested function before
  // replaying the independent register; only the already verified own project.
  const repairFile = 'supabase/migrations/20261001051435_account_deletion_worker_aliases.sql';
  const repair = fs.readFileSync(path.join(root, repairFile), 'utf8');
  const repairHash = crypto.createHash('sha256').update(repair).digest('hex');
  const applied = entry.appliedFiles?.find(f => f.file === repairFile);
  if (applied) assert.equal(applied.sha256, repairHash, 'Applied repair changed');
  if (!applied || (inPlace && !registration)) {
    await sql(entry, repair);
    entry.appliedFiles ??= [];
    if (applied) applied.reappliedAfterRestoreAt = new Date().toISOString();
    else entry.appliedFiles.push({ file: repairFile, sha256: repairHash, appliedAt: new Date().toISOString() });
    save();
  }
  report.workerRepairSha256 = repairHash;
  if (!registration) {
    const user = await admin.auth.admin.getUserById(a.id);
    assert(!user.error && user.data.user?.user_metadata?.qa_disposable === manifest.workflow, 'Unmarked deletion identity');
    assert.equal(user.data.user.user_metadata.fixture_label, 'deleted-owner');
    const control = await admin.auth.admin.getUserById(b.id);
    assert(!control.error && control.data.user?.user_metadata?.qa_disposable === manifest.workflow, 'Unmarked control identity');
    const counts = (await sql(entry, 'SELECT (SELECT count(*) FROM auth.users) auth_users,(SELECT count(*) FROM public.profiles) profiles,(SELECT count(*) FROM deletion_private.requests) requests', [], true))[0];
    assert.equal(Number(counts.auth_users), 2); assert.equal(Number(counts.profiles), 2); assert.equal(Number(counts.requests), 0);
    if (role === 'source') {
      const data = await api(`/v1/projects/${entry.ref}/database/backups`);
      const backup = data.backups.find(p => p.id === manifest.backupSelection?.selectedBackup?.id);
      assert(backup?.is_physical_backup && backup.status === 'COMPLETED' && Date.parse(backup.inserted_at) > Date.parse(manifest.seededDatabaseAt), 'Approved physical backup unavailable');
      report.selectedBackupId = backup.id;
      report.beforeDeletedMedia = await readPublic(entry.ref, a);
      report.beforeControlMedia = await readPublic(entry.ref, b);
      assert.equal(report.beforeDeletedMedia.status, 200); assert.equal(report.beforeControlMedia.status, 200);
    } else {
      assert(manifest.sourceDeletionVerified, 'Source deletion must precede restored replay');
      const original = registry.entries.find(r => r.projectRef === manifest.projects.find(p => p.role === 'source').ref && (r.stage ?? 'source') === 'source');
      assert(original && original.userId === a.id && original.scope === 'account', 'Independent register missing');
      assert.equal(Number((await sql(entry, 'SELECT count(*) old_receipts FROM deletion_private.requests WHERE id=$1', [original.requestId], true))[0].old_receipts), 0, 'Restored database must predate the independent receipt');
      const isolation = (await sql(entry, `SELECT
        (SELECT count(*) FROM information_schema.table_privileges WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')) app_table_grants,
        (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) public_tables_without_rls,
        (SELECT count(*) FROM vault.secrets) vault_secrets,
        to_regclass('cron.job') IS NOT NULL cron_table_exists`, [], true))[0];
      assert.equal(Number(isolation.app_table_grants), 0); assert.equal(Number(isolation.public_tables_without_rls), 0);
      assert.equal(Number(isolation.vault_secrets), 0); assert.equal(isolation.cron_table_exists, false);
      report.restoredIsolation = isolation; report.selectedBackupId = manifest.backupSelection.selectedBackup.id;
      report.restoredDeletedIdentityDetected = true; report.restoredProfiles = Number(counts.profiles); report.restoreHasNoCurrentDeletionReceipt = Number(counts.requests) === 0;
      // Role settings / API configuration must be checked before the isolated replay.
      await sql(entry, "ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'");
      await sql(entry, "UPDATE deletion_private.settings SET storage_origin=$1,approved_by='synthetic managed restore replay only',approved_at=now()", [origin]);
      await sql(entry, "UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint(); NOTIFY pgrst,'reload config';");
      report.independentRegistryMatched = true;
    }
    const session = await admin.auth.signInWithPassword({ email: a.email, password: a.password });
    assert(!session.error && session.data.user?.id === a.id && session.data.session?.access_token, 'Fresh fixture session required');
    // Do not let signIn replace the worker's service role Authorization header.
    await admin.auth.signOut({ scope: 'local' });
    const oldToken = session.data.session.access_token;
    const oldClient = createClient(origin, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${oldToken}` } } });
    const beforeGuard = await oldClient.rpc('check_account_deletion_access');
    assert(!beforeGuard.error, 'Fresh identity must work before acceptance');
    const receipt = await rpc('accept', { userId: a.id, scope: 'account', source: 'support', operator: 'synthetic-managed-restore', evidence: role === 'source' ? 'Own marked disposable Auth identity and physical backup after fixture verified; approved managed restore test.' : 'Own restored synthetic identity matched to independent deletion register before application exposure.' });
    registration = { projectRef: entry.ref, stage: isRestore ? 'restore' : 'source', userId: a.id, scope: 'account', requestId: receipt.requestId, selectedBackupId: manifest.backupSelection.selectedBackup.id, acceptedAt: new Date().toISOString(), oldToken };
    registry.entries.push(registration); writePrivate();
    manifest.status = role === 'source' ? 'source_deletion_processing' : 'restored_replay_processing'; save();
  }
  assert.equal(registration.userId, a.id); assert.equal(registration.scope, 'account');
  const secret = crypto.randomBytes(32).toString('hex');
  const values = { SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key, ACCOUNT_DELETION_ENABLED: 'true', ACCOUNT_DELETION_CRON_SECRET: secret };
  const handler = createProcessHandler({ env: name => values[name], createAdmin: (url, serviceKey) => createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) });
  report.processHandlerPhases ??= [];
  for (let n = 0; n < 14; n++) {
    const state = (await sql(entry, 'SELECT status,phase,error_code FROM deletion_private.requests WHERE id=$1', [registration.requestId], true))[0];
    if (state.phase === 'providers' && ['needs_attention', 'retention_pending', 'completed'].includes(state.status)) break;
    const response = await handler(new Request(origin + '/functions/v1/process-account-deletion', { method: 'POST', headers: { authorization: `Bearer ${secret}` } }));
    const result = await response.json();
    report.processHandlerPhases.push({ phase: state.phase, httpStatus: response.status, processed: result.processed === true, error: result.error ?? null }); writeReport();
    assert.equal(response.status, 200, `Process handler stopped: ${result.error}`);
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  const remaining = (await sql(entry, `SELECT
    (SELECT count(*) FROM auth.users WHERE id=$1) deleted_auth,
    (SELECT count(*) FROM public.profiles WHERE id=$1) deleted_profiles,
    (SELECT count(*) FROM storage.objects WHERE bucket_id='community-images' AND name=$3) deleted_storage,
    (SELECT count(*) FROM auth.users WHERE id=$2) control_auth,
    (SELECT count(*) FROM public.profiles WHERE id=$2) control_profiles,
    (SELECT count(*) FROM public.direct_messages WHERE sender_id=$2 AND receiver_id IS NULL AND content='Synthetic control-owner message') preserved_messages,
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) public_tables_without_rls`, [a.id, b.id, a.path], true))[0];
  assert.equal(Number(remaining.deleted_auth), 0); assert.equal(Number(remaining.deleted_profiles), 0); assert.equal(Number(remaining.deleted_storage), 0);
  assert.equal(Number(remaining.control_auth), 1); assert.equal(Number(remaining.control_profiles), 1); assert.equal(Number(remaining.preserved_messages), 1); assert.equal(Number(remaining.public_tables_without_rls), 0);
  const oldClient = createClient(origin, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${registration.oldToken}` } } });
  const denied = await oldClient.rpc('check_account_deletion_access');
  assert.equal(denied.error?.code, '42501'); assert(denied.error?.message.includes('account_deletion_pending'));
  report.oldFreshTokenBlocked = true; report.remaining = remaining;
  report.deletedMediaAfter = await readPublic(entry.ref, a);
  report.originalDeletedMediaAfter = await readPublic(manifest.projects.find(p => p.role === 'source').ref, a);
  report.originalControlMediaAfter = await readPublic(manifest.projects.find(p => p.role === 'source').ref, b);
  assert.equal(report.originalControlMediaAfter.status, 200);
  const sourceReport = role === 'source' ? report : JSON.parse(fs.readFileSync(path.join(root, 'output/deletion-completion-20260930/managed-source-deletion.json'), 'utf8'));
  assert.equal(report.originalControlMediaAfter.sha256, sourceReport.beforeControlMedia.sha256);
  const tasks = (await sql(entry, 'SELECT provider,status FROM deletion_private.provider_tasks WHERE request_id=$1', [registration.requestId], true));
  for (const task of tasks.filter(t => t.status === 'pending')) {
    const pending = ['backups', 'storage_cdn', 'external_logs'].includes(task.provider);
    const evidence = task.provider === 'backups' ? 'Selected physical backup still contains synthetic identity; source and restore projects will be removed after this test. Independent register retained outside backup.'
      : task.provider === 'storage_cdn' ? 'Storage remove and exact cache purge executed by actual handler; observed URL status recorded. Browser/global cache lifetime is not certified by this controlled test.'
      : task.provider === 'external_logs' ? 'Supabase request paths can contain synthetic fixture identifiers. Vendor operational-log retention is outside this rehearsal and must remain visible for review.'
      : task.provider === 'shared_content' ? 'Control-owner message retained with deleted receiver detached; independent Auth/profile and original Storage control remain.'
      : 'Isolated synthetic project has only marked password Auth fixtures and Storage. No app/provider identities, SMTP messages, push tokens or external integrations were created or connected.';
    await rpc('resolve_provider', { requestId: registration.requestId, provider: task.provider, status: pending ? 'retention_pending' : task.provider === 'shared_content' ? 'completed' : 'not_applicable', operator: 'synthetic-managed-restore', evidence, ...(pending ? { dueAt: manifest.cleanupAfter } : {}) });
  }
  const job = await rpc('claim');
  if (job) { assert.equal(job.user_id, a.id); await rpc('verify', { requestId: job.id, lease: job.lease }); }
  const final = (await sql(entry, 'SELECT status,phase FROM deletion_private.requests WHERE id=$1', [registration.requestId], true))[0];
  assert.equal(final.status, 'retention_pending');
  report.finalRequestStatus = final.status; report.fullDeletionCompleted = false;
  report.passed = true; report.completedAt = new Date().toISOString();
  report.actualProcessHandlerUsed = true; report.realAuthAndStorageUsed = true; report.controlOwnerPreserved = true;
  if (role === 'source') { manifest.sourceDeletionVerified = true; manifest.status = 'awaiting_restore_password_and_submission'; }
  else { report.managedPhysicalRestoreVerified = true; report.replayedBeforeApplicationExposure = true; manifest.supabaseRestoreVerified = true; manifest.status = 'managed_restore_verified_cleanup_due'; }
  save(); writeReport();
  console.log(JSON.stringify({ role, passed: true, actualProcessHandlerUsed: true, oldFreshTokenBlocked: true, controlOwnerPreserved: true, finalRequestStatus: final.status, managedPhysicalRestoreVerified: report.managedPhysicalRestoreVerified }));
} catch (error) {
  report.failure = error.message; report.failedAt = new Date().toISOString(); writeReport();
  console.error(error.message); process.exitCode = 1;
}
