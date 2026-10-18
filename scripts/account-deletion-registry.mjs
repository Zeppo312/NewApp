/** Minimal deletion register on the operator's own filesystem, outside the repo
 * and Supabase backups. No production path is configured by this source file.
 * Run only after the service-only export/Ack migration has been reviewed:
 * node scripts/account-deletion-registry.mjs --project <ref> --directory <absolute-private-dir> --writer <operator> --once
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are read from the environment only.
 */
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const registryFilename = 'deletion-registry-v1.json';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const digest = /^[a-f0-9]{64}$/;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const originPattern = /^https:\/\/[a-z]{20}\.supabase\.co$/;
const fail = message => { throw new Error(message); };

export function canonicalEntry(origin, entry) {
  if (!originPattern.test(origin) || !uuid.test(entry?.requestId) || !uuid.test(entry?.userId) ||
      !['account', 'data'].includes(entry.scope) || !timestamp.test(entry.acceptedAt) || !Number.isFinite(Date.parse(entry.acceptedAt))) fail('Invalid minimal registry entry');
  return `lotti-deletion-registry-v1|${origin}|${entry.requestId}|${entry.userId}|${entry.scope}|${entry.acceptedAt}`;
}

export function entryDigest(origin, entry) {
  return crypto.createHash('sha256').update(canonicalEntry(origin, entry), 'utf8').digest('hex');
}

function validateEntry(origin, entry) {
  if (!entry || Object.keys(entry).sort().join(',') !== 'acceptedAt,digest,requestId,scope,userId' || !digest.test(entry.digest) || entry.digest !== entryDigest(origin, entry)) fail('Registry digest does not match its exact payload');
  return { requestId: entry.requestId, userId: entry.userId, scope: entry.scope, acceptedAt: entry.acceptedAt, digest: entry.digest };
}

export function mergeRegistry(previous, exported, expectedOrigin) {
  if (!originPattern.test(expectedOrigin) || exported?.version !== 1 || exported.origin !== expectedOrigin || !Array.isArray(exported.entries) || exported.entries.length > 100_000) fail('Wrong registry version or project origin');
  const entries = new Map();
  if (previous) {
    if (previous.version !== 1 || previous.origin !== expectedOrigin || !Array.isArray(previous.entries) || previous.entries.length > 100_000) fail('Existing registry belongs to another project or version');
    for (const raw of previous.entries) {
      const entry = validateEntry(expectedOrigin, raw);
      if (entries.has(entry.requestId)) fail('Duplicate request in existing independent registry');
      entries.set(entry.requestId, entry);
    }
  }
  const acknowledge = new Map();
  for (const raw of exported.entries) {
    const entry = validateEntry(expectedOrigin, raw);
    const old = entries.get(entry.requestId);
    if (old && old.digest !== entry.digest) fail('Request identity differs from the independent register');
    entries.set(entry.requestId, entry);
    acknowledge.set(entry.requestId, entry);
  }
  // In particular an empty/older restored database cannot erase known entries.
  return {
    document: { version: 1, origin: expectedOrigin, updatedAt: new Date().toISOString(), entries: [...entries.values()].sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt) || a.requestId.localeCompare(b.requestId)) },
    acknowledge: [...acknowledge.values()],
  };
}

async function noSymlinkComponents(directory) {
  const root = path.parse(directory).root;
  let current = root;
  for (const part of directory.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail('Register directory has a symlink or non-directory component');
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
}

async function checkDirectory(directory, repoRoot) {
  if (!path.isAbsolute(directory) || directory !== path.resolve(directory)) fail('Register directory must be an explicit absolute canonical path');
  const relative = path.relative(await fs.realpath(repoRoot), directory);
  if (!relative || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) fail('Independent register must be outside the repository');
  await noSymlinkComponents(directory);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await noSymlinkComponents(directory);
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) fail('Register directory must be owned by the operator with mode 0700');
}

async function readProtectedFile(filename) {
  let stat;
  try { stat = await fs.lstat(filename); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.size > 32 * 1024 * 1024) fail('Register file must be a single operator-owned regular file with mode 0600');
  const file = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await file.stat();
    if (opened.ino !== stat.ino || opened.dev !== stat.dev) fail('Register file changed during protected open');
    return await file.readFile('utf8');
  } finally { await file.close(); }
}

async function acquireWriterLock(directory) {
  const lock = path.join(directory, '.deletion-registry-writer.lock');
  try { await fs.mkdir(lock, { mode: 0o700 }); }
  catch (error) {
    if (error.code === 'EEXIST') fail('Register writer lock exists; verify the previous process ended before recovering its protected lock');
    throw error;
  }
  const identity = { pid: process.pid, nonce: crypto.randomUUID() };
  const ownerFile = path.join(lock, 'owner.json');
  try {
    await fs.writeFile(ownerFile, JSON.stringify(identity) + '\n', { flag: 'wx', mode: 0o600 });
  } catch (error) { await fs.rmdir(lock); throw error; }
  return async () => {
    const actual = JSON.parse(await readProtectedFile(ownerFile));
    if (actual.pid !== identity.pid || actual.nonce !== identity.nonce) fail('Writer lock owner changed; automatic removal forbidden');
    await fs.unlink(ownerFile);
    await fs.rmdir(lock);
  };
}

export async function syncDeletionRegistry({ directory, origin, exportRegistry, acknowledge, writer, repoRoot = repositoryRoot, afterRename }) {
  if (!originPattern.test(origin) || typeof writer !== 'string' || writer.trim().length < 3 || writer.trim().length > 100) fail('Explicit project origin and named writer are required');
  await checkDirectory(directory, repoRoot);
  const releaseLock = await acquireWriterLock(directory);
  try {
  const filename = path.join(directory, registryFilename);
  const previousBytes = await readProtectedFile(filename);
  const previous = previousBytes === null ? null : JSON.parse(previousBytes);
  const exported = await exportRegistry();
  const merged = mergeRegistry(previous, exported, origin);
  const bytes = JSON.stringify(merged.document, null, 2) + '\n';
  const temporary = path.join(directory, `.deletion-registry-${crypto.randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    // Re-check the existing target before atomic replacement; never follow it.
    await checkDirectory(directory, repoRoot);
    await readProtectedFile(filename);
    await fs.rename(temporary, filename);
    if (afterRename) await afterRename(filename); // Offline fault injection; no CLI option.
    const directoryHandle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    const actual = await readProtectedFile(filename);
    if (actual !== bytes) fail('Durable register readback did not match the written bytes');
    // Digest/request identity are verified again from the actual disk document.
    const onDisk = mergeRegistry(JSON.parse(actual), { version: 1, origin, entries: [] }, origin).document;
    for (const entry of merged.acknowledge) {
      if (!onDisk.entries.some(saved => saved.requestId === entry.requestId && saved.digest === entry.digest)) fail('Readback is missing the exact acknowledgement payload');
      const result = await acknowledge({ p_request_id: entry.requestId, p_digest: entry.digest, p_writer: writer.trim() });
      if (result?.acknowledged !== true || result.requestId !== entry.requestId || result.digest !== entry.digest) fail('Registry acknowledgement response did not match its exact payload');
    }
    return { entries: onDisk.entries.length, acknowledged: merged.acknowledge.length, filename, durableReadback: true };
  } finally {
    if (handle) await handle.close();
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  } finally { await releaseLock(); }
}

async function main() {
  const args = process.argv.slice(2); const values = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--once') values.once = true;
    else if (['--project', '--directory', '--writer'].includes(args[i]) && args[i + 1]) values[args[i].slice(2)] = args[++i];
    else fail('Use --project, --directory, --writer and --once');
  }
  if (!values.once || !['kwniiyayhzgjfqjsjcfu', 'ggyonianphloycmqrwvj'].includes(values.project) || !values.directory) fail('A declared existing target, external directory and --once are required');
  const origin = `https://${values.project}.supabase.co`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || process.env.SUPABASE_URL !== origin) fail('Matching SUPABASE_URL and service credential must be supplied through the environment');
  const rpc = async (name, payload = {}) => {
    const response = await fetch(`${origin}/rest/v1/rpc/${name}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!response.ok) fail(`Register RPC ${name} failed with HTTP ${response.status}`);
    return response.json();
  };
  const result = await syncDeletionRegistry({ directory: values.directory, origin, writer: values.writer,
    exportRegistry: () => rpc('account_deletion_registry_export'), acknowledge: payload => rpc('account_deletion_registry_ack', payload) });
  console.log(JSON.stringify({ entries: result.entries, acknowledged: result.acknowledged, durableReadback: result.durableReadback }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
