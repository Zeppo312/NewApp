/** Recurring operator backend, with explicit target, pinned local code and no worker path. */
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { syncDeletionRegistry, mergeRegistry, registryFilename } from './account-deletion-registry.mjs';

export const productionRef = 'kwniiyayhzgjfqjsjcfu';
export const productionOrigin = `https://${productionRef}.supabase.co`;
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };

export async function protectedRead(filename) {
  const st = await fs.lstat(filename);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o600 || st.size > 32 * 1024 * 1024) fail('protected_file_invalid');
  const fd = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await fd.stat();
    if (opened.ino !== st.ino || opened.dev !== st.dev) fail('protected_file_changed');
    return await fd.readFile('utf8');
  } finally { await fd.close(); }
}

export async function atomicPrivateWrite(filename, bytes) {
  const directory = path.dirname(filename), st = await fs.lstat(directory);
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o700) fail('protected_directory_invalid');
  try { await protectedRead(filename); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const temp = path.join(directory, `.runtime-${crypto.randomUUID()}.tmp`);
  let fd;
  try {
    fd = await fs.open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await fd.writeFile(bytes); await fd.sync(); await fd.close(); fd = null;
    await fs.rename(temp, filename);
    const dir = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await dir.sync(); } finally { await dir.close(); }
    if (await protectedRead(filename) !== bytes) fail('private_readback_mismatch');
  } finally {
    if (fd) await fd.close();
    await fs.unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; });
  }
}

export async function loadConfig(filename) {
  const config = JSON.parse(await protectedRead(filename));
  if (config.projectRef !== productionRef || config.origin !== productionOrigin || !path.isAbsolute(config.directory) || !path.isAbsolute(config.stateDirectory) || !path.isAbsolute(config.repositoryRoot) || !path.isAbsolute(config.python) || !path.isAbsolute(config.keychainHelper) || typeof config.writer !== 'string') fail('runtime_configuration_invalid');
  return config;
}

export async function initializeLocalRegistry(config) {
  const filename = path.join(config.directory, registryFilename);
  try {
    const existing = await protectedRead(filename);
    const document = mergeRegistry(JSON.parse(existing), { version: 1, origin: productionOrigin, entries: [] }, productionOrigin).document;
    return { kind: 'existing_register_preserved', entries: document.entries.length, registrySha256: sha256(existing), durableReadback: true, backendExportVerified: false, acknowledged: 0 };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await syncDeletionRegistry({ directory: config.directory, origin: productionOrigin, repoRoot: config.repositoryRoot, writer: config.writer,
    exportRegistry: async () => ({ version: 1, origin: productionOrigin, entries: [] }),
    acknowledge: async () => fail('bootstrap_ack_forbidden') });
  return { kind: 'local_empty_bootstrap_only', entries: result.entries, acknowledged: 0, durableReadback: result.durableReadback, backendExportVerified: false, registrySha256: sha256(await protectedRead(filename)) };
}

export function keychainCredential(config) {
  let key;
  try { key = execFileSync(config.python, [config.keychainHelper, 'get'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 7000, maxBuffer: 16384 }).toString('utf8'); }
  catch { fail('credential_unavailable'); }
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    if (claims.role !== 'service_role' || claims.ref !== productionRef) fail('credential_wrong_target');
  } catch { fail('credential_wrong_target'); }
  return key;
}

export function rpcClient(key) {
  return async (name, payload = {}) => {
    if (!['account_deletion_registry_export', 'account_deletion_registry_ack', 'account_deletion_registry_heartbeat'].includes(name)) fail('rpc_not_allowed');
    let response;
    try { response = await fetch(`${productionOrigin}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
    catch { fail('registry_transport_unavailable'); }
    if (!response.ok) fail(response.status === 404 ? 'registry_rpc_missing' : `registry_rpc_http_${response.status}`);
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32 * 1024 * 1024) { await reader.cancel(); fail('registry_export_too_large'); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('registry_rpc_invalid_json'); }
  };
}

async function event(config, value) {
  const filename = path.join(config.stateDirectory, `events-${new Date().toISOString().slice(0,10)}.jsonl`);
  try { await protectedRead(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const fd = await fs.open(filename, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try { await fd.writeFile(JSON.stringify(value) + '\n'); await fd.sync(); } finally { await fd.close(); }
}

export async function runOnce(config, dependencies = {}) {
  const startedAt = new Date().toISOString();
  let previous = {};
  try { previous = JSON.parse(await protectedRead(path.join(config.stateDirectory, 'status.json'))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const result = { projectRef: productionRef, pid: process.pid, startedAt, checkedAt: null, status: 'error', errorCode: null, entries: null, acknowledged: 0,
    consecutiveFailures: (previous.consecutiveFailures ?? 0) + 1, lastSuccessfulSyncAt: previous.lastSuccessfulSyncAt ?? null, workerInvoked: false };
  try {
    const rpc = dependencies.rpc ?? rpcClient((dependencies.credential ?? keychainCredential)(config));
    const synced = await syncDeletionRegistry({ directory: config.directory, origin: productionOrigin, repoRoot: config.repositoryRoot, writer: config.writer,
      exportRegistry: () => rpc('account_deletion_registry_export'), acknowledge: payload => rpc('account_deletion_registry_ack', payload) });
    const absentFromBackend = synced.entries - synced.acknowledged;
    Object.assign(result, { status: absentFromBackend ? 'needs_reconciliation' : 'healthy',
      errorCode: absentFromBackend ? 'independent_registry_entries_missing_from_backend' : null,
      entries: synced.entries, acknowledged: synced.acknowledged, durableReadback: true, independentEntriesAbsentFromBackend: absentFromBackend,
      confirmedEntryEvidence: synced.acknowledged > 0 });
    if (!absentFromBackend && config.cloudHeartbeat === true) {
      const bytes = await protectedRead(path.join(config.directory, registryFilename));
      const heartbeat = await rpc('account_deletion_registry_heartbeat', { p_writer: config.writer, p_registry_sha256: sha256(bytes), p_entry_count: synced.entries });
      if (heartbeat?.received !== true || heartbeat?.confirmedEntryEvidence !== (synced.entries > 0)) fail('registry_heartbeat_invalid');
      result.cloudHeartbeatVerified = true;
    }
    if (!absentFromBackend) {
      result.consecutiveFailures = 0;
      result.lastSuccessfulSyncAt = new Date().toISOString();
    }
  } catch (error) {
    const code = error.safeCode ?? (error.message.includes('writer lock exists') ? 'writer_lock_requires_verified_recovery' : 'registry_validation_or_storage_failed');
    Object.assign(result, { status: code === 'registry_rpc_missing' ? 'blocked_missing_backend' : 'error', errorCode: code });
  }
  result.checkedAt = new Date().toISOString();
  await atomicPrivateWrite(path.join(config.stateDirectory, 'status.json'), JSON.stringify(result, null, 2) + '\n');
  await event(config, result);
  return result;
}

export async function recoverDeadLock(config) {
  const lock = path.join(config.directory, '.deletion-registry-writer.lock');
  const st = await fs.lstat(lock);
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== process.getuid() || (st.mode & 0o777) !== 0o700) fail('lock_directory_invalid');
  const ownerFilename = path.join(lock, 'owner.json'), bytes = await protectedRead(ownerFilename), owner = JSON.parse(bytes);
  if (!Number.isSafeInteger(owner.pid) || owner.pid < 1 || !/^[a-f0-9-]{36}$/.test(owner.nonce)) fail('lock_identity_invalid');
  try { process.kill(owner.pid, 0); fail('previous_writer_may_still_be_alive'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  if ((await fs.readdir(lock)).join(',') !== 'owner.json' || await protectedRead(ownerFilename) !== bytes) fail('lock_identity_changed');
  const registry = await protectedRead(path.join(config.directory, registryFilename));
  mergeRegistry(JSON.parse(registry), { version: 1, origin: productionOrigin, entries: [] }, productionOrigin);
  await fs.unlink(ownerFilename); await fs.rmdir(lock);
  if (await protectedRead(path.join(config.directory, registryFilename)) !== registry) fail('registry_changed_during_recovery');
  return { recovered: true, registrySha256: sha256(registry), registryPreserved: true, previousPid: owner.pid };
}

export async function healthStatus(config) {
  const result = JSON.parse(await protectedRead(path.join(config.stateDirectory, 'status.json')));
  const elapsed = Date.now() - Date.parse(result.checkedAt);
  const stale = !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 180_000;
  return { ...result, stale, healthy: !stale && result.status === 'healthy' };
}

export async function monitorOnce(config) {
  let health;
  try { health = await healthStatus(config); }
  catch { health = { healthy: false, stale: true, errorCode: 'writer_status_unavailable' }; }
  const result = { kind: 'monitor', checkedAt: new Date().toISOString(), projectRef: productionRef, healthy: health.healthy,
    requiresOperator: !health.healthy, errorCode: health.stale ? 'writer_status_stale_or_unavailable' : health.errorCode,
    writerCheckAt: health.checkedAt ?? null, consecutiveFailures: health.consecutiveFailures ?? null,
    lastSuccessfulSyncAt: health.lastSuccessfulSyncAt ?? null, externalNotificationSent: false };
  await atomicPrivateWrite(path.join(config.stateDirectory, 'monitor.json'), JSON.stringify(result, null, 2) + '\n');
  await event(config, result);
  return result;
}

export async function restoreCheck(config) {
  // A DB Ack and a successful writer run cannot authorize restore application
  // access. This runtime deliberately has no release command or replay action.
  const bytes = await protectedRead(path.join(config.directory, registryFilename));
  const document = mergeRegistry(JSON.parse(bytes), { version: 1, origin: productionOrigin, entries: [] }, productionOrigin).document;
  return { applicationAccessAllowed: false, reason: 'fresh_external_replay_and_isolation_proof_required', registryEntries: document.entries.length,
    registrySha256: sha256(bytes), restoredDatabaseAckIsSufficient: false, restorePerformed: false };
}

async function main() {
  process.umask(0o077);
  const [command, filename, extra] = process.argv.slice(2);
  if (extra || !['run','initialize','status','monitor','recover-lock','restore-check'].includes(command) || !filename) fail('runtime_usage_invalid');
  const config = await loadConfig(filename);
  let result;
  if (command === 'run') result = await runOnce(config);
  if (command === 'initialize') result = await initializeLocalRegistry(config);
  if (command === 'status') result = await healthStatus(config);
  if (command === 'monitor') result = await monitorOnce(config);
  if (command === 'recover-lock') result = await recoverDeadLock(config);
  if (command === 'restore-check') result = await restoreCheck(config);
  console.log(JSON.stringify(result));
  if ((command === 'run' && result.status !== 'healthy') || (['status','monitor'].includes(command) && !result.healthy) || command === 'restore-check') process.exitCode = 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.safeCode ?? 'registry_runtime_failed'); process.exitCode = 1; });
