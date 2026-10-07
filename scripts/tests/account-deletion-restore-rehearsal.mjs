// Native physical cold-backup rehearsal; disposable localhost clusters only.
// Storage bytes are a filesystem test double, not Supabase Storage/CDN.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, cp, rm, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
const [modulePath, output] = process.argv.slice(2);
if (!modulePath || !output) throw new Error('Usage: node scripts/tests/account-deletion-restore-rehearsal.mjs /path/to/embedded-postgres/dist/index.js output.json');
const { default: Postgres } = await import(pathToFileURL(resolve(modulePath)).href);
const directory = await mkdtemp(join(tmpdir(), 'lotti-deletion-restore-'));
const password = randomUUID(); const a = '10000000-0000-4000-8000-000000000001'; const b = '10000000-0000-4000-8000-000000000002';
const da = `avatars/avatar_${a}_old.jpg`; const db = `avatars/avatar_${b}_old.jpg`;
let current; let client;
async function start(dataDir, initialise = false) {
  const socket = createServer(); await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', ok); });
  const port = socket.address().port; await new Promise(ok => socket.close(ok));
  current = new Postgres({ databaseDir: dataDir, user: 'postgres', password, port, persistent: true,
    postgresFlags: ['-h', '127.0.0.1', '-k', directory, '-c', 'statement_timeout=15000'], onLog: () => {}, onError: () => {} });
  if (initialise) await current.initialise(); await current.start();
  client = current.getPgClient('postgres', '127.0.0.1'); await client.connect();
}
async function stop() { await client?.end(); client = undefined; await current?.stop(); current = undefined; }
async function rpc(action, payload = {}) { return (await client.query('SELECT public.account_deletion_worker($1,$2::jsonb) result', [action, JSON.stringify(payload)])).rows[0].result; }
async function count(table, column, uid) { return Number((await client.query(`SELECT count(*) n FROM ${table} WHERE ${column}=$1`, [uid])).rows[0].n); }
async function erase(receipt) {
  const job = await rpc('claim'); assert.equal(job.user_id, a); const identity = { requestId: job.id, lease: job.lease };
  await rpc('inventory', identity); const objects = await rpc('objects', identity);
  assert.deepEqual(objects.map(o => o.path), [da]);
  for (const object of objects) {
    assert.equal(object.bucket, 'community-images'); assert.equal(object.path, da);
    await rm(join(directory, 'objects', object.path), { force: true });
    await client.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2', [object.bucket, object.path]);
  }
  await rpc('objects_removed', { ...identity, objects }); await rpc('storage_done', identity); await rpc('database', identity);
  await client.query('DELETE FROM auth.users WHERE id=$1', [a]); await rpc('auth_done', identity); await rpc('verify', identity);
  const providers = (await client.query('SELECT provider FROM deletion_private.provider_tasks WHERE request_id=$1', [receipt.requestId])).rows;
  for (const { provider } of providers) await rpc('resolve_provider', { requestId: receipt.requestId, provider, status: 'not_applicable', operator: 'local-rehearsal', evidence: 'Isolated synthetic fixture: no actual external provider connected.' });
  const finalJob = await rpc('claim'); await rpc('verify', { requestId: finalJob.id, lease: finalJob.lease });
  assert.equal((await client.query('SELECT status FROM deletion_private.requests WHERE id=$1', [receipt.requestId])).rows[0].status, 'completed');
  assert.equal(await count('auth.users', 'id', a), 0); assert.equal(await count('public.profiles', 'id', a), 0);
  assert.equal(await count('auth.users', 'id', b), 1); assert.equal(await count('public.profiles', 'id', b), 1);
  assert.equal((await client.query('SELECT sender_id,receiver_id FROM public.direct_messages')).rows[0].sender_id, b);
  assert.equal((await client.query('SELECT receiver_id FROM public.direct_messages')).rows[0].receiver_id, null);
  await assert.rejects(access(join(directory, 'objects', da))); assert.equal(await readFile(join(directory, 'objects', db), 'utf8'), 'synthetic other owner bytes');
  await client.query('SET ROLE authenticated'); await client.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [a]);
  await assert.rejects(client.query('SELECT public.check_account_deletion_access()'), /account_deletion_pending/);
  await client.query('RESET ROLE');
}
try {
  const liveDir = join(directory, 'initial'); const backupDir = join(directory, 'cold-backup'); const restoreDir = join(directory, 'separate-restored-target');
  await start(liveDir, true);
  const postgresVersion = (await client.query('SELECT version() version')).rows[0].version;
  const migrationFiles = ['supabase/migrations/20260911065615_account_deletion_jobs.sql', 'supabase/migrations/20260930055640_account_deletion_readiness.sql', 'supabase/migrations/20260930163849_account_deletion_alarm.sql', 'supabase/migrations/20260930170233_account_deletion_cdn_proof.sql', 'supabase/migrations/20261001051435_account_deletion_worker_aliases.sql'];
  await client.query(await readFile('supabase/tests/account_deletion_fixture.sql', 'utf8'));
  for (const file of migrationFiles) await client.query(await readFile(file, 'utf8'));
  await client.query("ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'; UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint(),approved_by='local synthetic rehearsal',approved_at=now(),receipt_retention_days=30,backup_window_days=10");
  await client.query('INSERT INTO auth.users(id,last_sign_in_at,email) VALUES($1,now(),$3),($2,now(),$4)', [a,b,'a@example.invalid','b@example.invalid']);
  await client.query('INSERT INTO public.profiles VALUES($1),($2)',[a,b]);
  await client.query('INSERT INTO public.direct_messages VALUES(gen_random_uuid(),$1,$2,$3)',[b,a,'synthetic message from remaining owner']);
  await client.query('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES($1,$2,$3),($1,$4,$5)', ['community-images', da, a, db, b]);
  await mkdir(join(directory, 'objects/avatars'), {recursive:true});
  await writeFile(join(directory, 'objects', da), 'synthetic deleted owner bytes'); await writeFile(join(directory, 'objects', db), 'synthetic other owner bytes');
  // Consistent native physical backup made while PostgreSQL is fully stopped.
  await stop(); await cp(liveDir, backupDir, {recursive:true}); await start(liveDir);
  const receipt = await rpc('accept',{userId:a,scope:'account',source:'app'});
  const registryFile = join(directory, 'independent-registry.json');
  await writeFile(registryFile, JSON.stringify([{userId:a,scope:'account',requestId:receipt.requestId}]), {mode:0o600});
  await erase(receipt); await stop();
  // The restore is a distinct cluster; no application or external connections are opened.
  await cp(backupDir, restoreDir, {recursive:true}); await start(restoreDir);
  assert.equal(await count('auth.users','id',a),1); assert.equal(await count('public.profiles','id',a),1);
  assert.equal(Number((await client.query('SELECT count(*) n FROM deletion_private.requests')).rows[0].n),0);
  const registry = JSON.parse(await readFile(registryFile,'utf8')); assert.equal(registry.length,1);
  for(const entry of registry) {
    assert.equal(entry.userId,a); assert.equal(entry.scope,'account');
    const replay = await rpc('accept',{userId:entry.userId,scope:entry.scope,source:'support',operator:'local-restore-replay',evidence:'Independent synthetic deletion register checked before restored target exposure.'});
    await erase(replay);
  }
  const report = {checkedAt:new Date().toISOString(),passed:true,postgresVersion,migrationFiles,physicalColdBackup:true,separateRestoreTarget:true,externalRegistrySurvived:true,
    restoredDeletedRowsDetected:true,replayedBeforeApplicationExposure:true,oldIdentityBlocked:true,otherOwnerPreserved:true,syntheticBytesAbsent:true,
    supabaseRestoreVerified:false,supabaseStorageVerified:false,externalProvidersVerified:false,
    limitations:['Local native PostgreSQL physical cold backup only; not a Supabase managed backup restore.','Filesystem byte store is a test double; no Supabase Storage API or CDN tested here.','Synthetic fixture and replay register only; independent production registry and policy still required.']};
  await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
} finally { await stop(); await rm(directory,{recursive:true,force:true}); }
