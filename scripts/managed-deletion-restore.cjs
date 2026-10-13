// One approved disposable managed restore run; secrets stay in memory/private files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'output/deletion-completion-20260930/managed-restore-lifecycle.json');
const privateDir = path.join(root, '.family-qa/deletion-completion-20260930/managed-restore');
const ORG = 'xqbmotyjxjdeqoisbgow';
const protectedRefs = new Set(['kwniiyayhzgjfqjsjcfu', 'ggyonianphloycmqrwvj']);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest.userApproved || manifest.organizationId !== ORG || manifest.maxExtraUsd !== 5) throw Error('Approved run manifest required');
let token = execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
if (token.startsWith('go-keyring-base64:')) token = Buffer.from(token.slice(18), 'base64').toString('utf8');
if (!/^sbp_/.test(token)) throw Error('Existing CLI token unavailable');
function save() { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n'); }
async function api(endpoint, method = 'GET', body) {
  const res = await fetch('https://api.supabase.com' + endpoint, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) { const err = Error(`Management API ${method} ${endpoint}: HTTP ${res.status}${(endpoint.endsWith('/database/query') || endpoint.endsWith('/database/backups/restore')) && typeof data?.message === 'string' ? ': ' + data.message.slice(0, 240) : ''}`); err.status = res.status; throw err; }
  return data;
}
function owned(entry, project) {
  if (!entry || !entry.ref || protectedRefs.has(entry.ref) || project.id !== entry.ref || project.name !== entry.name || project.organization_id !== ORG || project.region !== 'eu-central-1') throw Error('Disposable ownership check failed');
}
async function sql(entry, query, parameters = [], read_only = false) {
  return api(`/v1/projects/${entry.ref}/database/query`, 'POST', { query, parameters, read_only });
}
async function service(entry) {
  const keys = await api(`/v1/projects/${entry.ref}/api-keys`);
  const key = keys.find(k => k.name === 'service_role')?.api_key;
  if (!key) throw Error('Disposable service role key unavailable');
  return async (endpoint, method = 'GET', body, bearer = key, binary = false) => {
    const res = await fetch(`https://${entry.ref}.supabase.co${endpoint}`, { method, headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': binary ? 'text/plain' : 'application/json' }, body: body === undefined ? undefined : binary ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) { const err = Error(`Disposable service ${method} ${endpoint.split('?')[0]}: HTTP ${res.status}`); err.status = res.status; throw err; }
    return data;
  };
}
async function prepareSource(entry) {
  if (manifest.seededAt) throw Error('Source already prepared; no duplicate fixtures');
  const migrations = ['20260911065615_account_deletion_jobs.sql', '20260930055640_account_deletion_readiness.sql', '20260930163849_account_deletion_alarm.sql', '20260930170233_account_deletion_cdn_proof.sql', '20261001051435_account_deletion_worker_aliases.sql'];
  entry.appliedFiles ??= [];
  for (const file of ['supabase/tests/account_deletion_managed_fixture.sql', ...migrations.map(m => `supabase/migrations/${m}`)]) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const previous = entry.appliedFiles.find(p => p.file === file);
    if (previous) { if (previous.sha256 !== hash) throw Error('Prepared source changed'); continue; }
    await sql(entry, content); entry.appliedFiles.push({ file, sha256: hash, appliedAt: new Date().toISOString() }); save();
  }
  await sql(entry, "ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access'");
  await sql(entry, "UPDATE deletion_private.settings SET storage_origin=$1,approved_by='synthetic managed restore test only',approved_at=now(),receipt_retention_days=30,backup_window_days=7", [`https://${entry.ref}.supabase.co`]);
  await sql(entry, "UPDATE deletion_private.settings SET approved_fingerprint=deletion_private.fingerprint(); NOTIFY pgrst,'reload config';");
  const call = await service(entry);
  const fixtureFile = path.join(privateDir, 'fixtures.private.json');
  let fixtures = fs.existsSync(fixtureFile) ? JSON.parse(fs.readFileSync(fixtureFile, 'utf8')) : [];
  for (const label of ['deleted-owner', 'control-owner']) {
    let f = fixtures.find(f => f.label === label);
    if (!f) {
      const suffix = crypto.randomUUID(); const password = crypto.randomBytes(24).toString('base64url');
      const email = `managed-restore-${suffix}@example.invalid`;
      const u = await call('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true, user_metadata: { qa_disposable: manifest.workflow, fixture_label: label } });
      if (!u.id || u.user_metadata?.qa_disposable !== manifest.workflow) throw Error('Unmarked auth fixture');
      f = { label, id: u.id, email, password, path: `avatars/avatar_${u.id}_managed-restore.txt` }; fixtures.push(f);
      fs.writeFileSync(fixtureFile, JSON.stringify(fixtures), { mode: 0o600 });
    }
  }
  const buckets = await call('/storage/v1/bucket');
  if (!buckets.some(b => b.id === 'community-images')) await call('/storage/v1/bucket', 'POST', { id: 'community-images', name: 'community-images', public: true, file_size_limit: 1024 });
  for (const f of fixtures) {
    await sql(entry, 'INSERT INTO public.profiles(id) VALUES($1) ON CONFLICT DO NOTHING', [f.id]);
    const objects = await call('/storage/v1/object/list/community-images', 'POST', { prefix: 'avatars', search: path.basename(f.path), limit: 10 });
    if (!objects.some(o => o.name === path.basename(f.path))) await call(`/storage/v1/object/community-images/${f.path}`, 'POST', `Synthetic managed restore fixture: ${f.label}`, undefined, true);
    const session = await call('/auth/v1/token?grant_type=password', 'POST', { email: f.email, password: f.password });
    if (!session.access_token || session.user?.id !== f.id) throw Error('Fixture sign-in failed');
    f.accessToken = session.access_token;
  }
  const [a, b] = fixtures;
  await sql(entry, 'INSERT INTO public.direct_messages(id,sender_id,receiver_id,content) SELECT $1,$2,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM public.direct_messages WHERE sender_id=$2 AND receiver_id=$3)', [crypto.randomUUID(), b.id, a.id, 'Synthetic control-owner message']);
  fs.writeFileSync(fixtureFile, JSON.stringify(fixtures), { mode: 0o600 });
  const baseline = await sql(entry, `SELECT now() database_time,(SELECT count(*) FROM auth.users) auth_users,(SELECT count(*) FROM public.profiles) profiles,(SELECT count(*) FROM storage.objects) storage_objects,(SELECT count(*) FROM deletion_private.requests) deletion_requests`, [], true);
  const readiness = await call('/rest/v1/rpc/account_deletion_readiness', 'POST', {});
  if (Number(baseline[0]?.auth_users) !== 2 || Number(baseline[0]?.storage_objects) !== 2 || !readiness) throw Error('Source baseline rejected');
  manifest.seededAt = new Date().toISOString(); manifest.seededDatabaseAt = baseline[0].database_time; manifest.status = 'waiting_for_managed_backup'; manifest.sourceBaseline = { ...baseline[0], readiness }; save();
  console.log(JSON.stringify({ status: manifest.status, projectRef: entry.ref, seededAt: manifest.seededAt, sourceBaseline: manifest.sourceBaseline }));
}
async function reconcile() {
  const projects = await api('/v1/projects');
  if (!projects.some(p => p.id === 'kwniiyayhzgjfqjsjcfu' && p.organization_id === ORG)) throw Error('Wrong management account');
  for (const entry of manifest.projects) {
    if (!entry.ref && entry.status === 'creation_requested') {
      const matches = projects.filter(p => p.organization_id === ORG && p.name === entry.name && !protectedRefs.has(p.id) && !entry.preexistingProjectRefs?.includes(p.id));
      if (matches.length > 1) throw Error('Ambiguous disposable project');
      if (matches.length === 1) { entry.ref = matches[0].id; entry.createdAt = matches[0].created_at; entry.status = matches[0].status; save(); }
    }
  }
  return projects;
}
async function main() {
  let [command, role = 'source'] = process.argv.slice(2);
  const projects = await reconcile();
  if (Date.now() >= Date.parse(manifest.cleanupAfter) && manifest.status !== 'cleaned_up') command = 'cleanup';
  if (command === 'create-source') {
    if (Date.now() >= Date.parse(manifest.cleanupAfter)) throw Error('Cleanup window reached');
    if (manifest.projects.length) throw Error('Source already requested; resume it');
    const name = 'lotti-delete-restore-source-20260930';
    if (projects.some(p => p.name === name)) throw Error('Name already exists');
    fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
    const dbPassword = crypto.randomBytes(36).toString('base64url');
    fs.writeFileSync(path.join(privateDir, 'source.private.json'), JSON.stringify({ dbPassword }), { mode: 0o600 });
    const entry = { role: 'source', name, ref: null, preexistingProjectRefs: projects.map(p => p.id), instanceSize: 'micro', hourlyComputeUsd: 0.01344, creationRequestedAt: new Date().toISOString(), status: 'creation_requested' };
    manifest.projects.push(entry); manifest.status = 'source_creation_requested'; save();
    const created = await api('/v1/projects', 'POST', { organization_slug: ORG, name, db_pass: dbPassword, region_selection: { type: 'specific', code: 'eu-central-1' }, desired_instance_size: 'micro', high_availability: false });
    entry.ref = created.id; entry.createdAt = created.created_at; entry.status = created.status; owned(entry, created); manifest.status = 'source_provisioning'; save();
    console.log(JSON.stringify({ ref: entry.ref, name, status: entry.status, cleanupAfter: manifest.cleanupAfter }));
  } else if (command === 'plan-clone') {
    const source = manifest.projects.find(p => p.role === 'source'); owned(source, projects.find(p => p.id === source.ref));
    const registryFile = path.join(privateDir, 'independent-registry.private.json');
    if (fs.existsSync(registryFile) && JSON.parse(fs.readFileSync(registryFile, 'utf8')).entries?.some(r => r.projectRef === source.ref)) throw Error('Source deletion accepted; keep the already selected pre-deletion backup');
    const data = await api(`/v1/projects/${source.ref}/database/backups`);
    const backup = data.backups?.find(b => b.status === 'COMPLETED' && b.is_physical_backup && Date.parse(b.inserted_at) > Date.parse(manifest.seededDatabaseAt));
    if (!backup) throw Error('No completed physical backup after fixture');
    manifest.backupSelection = { ...manifest.backupSelection, selectedBackup: backup, suitableBackupAvailable: true, selectedAt: new Date().toISOString(), status: 'selected_for_restore' };
    if (!manifest.projects.some(p => p.role === 'restore')) {
      const name = 'lotti-delete-restore-target-20261001';
      if (projects.some(p => p.name === name)) throw Error('Restore target name already exists');
      manifest.projects.push({ role: 'restore', name, ref: null, preexistingProjectRefs: projects.map(p => p.id), instanceSize: 'micro', hourlyComputeUsd: 0.01344, creationRequestedAt: new Date().toISOString(), status: 'creation_requested', dashboardSubmitted: false });
    }
    manifest.status = 'backup_selected_preparing_source_deletion'; save();
    console.log(JSON.stringify({ selectedBackup: backup, targetName: manifest.projects.find(p => p.role === 'restore').name, targetCreated: false }));
  } else if (command === 'restore-source') {
    const entry = manifest.projects.find(p => p.role === 'source'); owned(entry, projects.find(p => p.id === entry.ref));
    if (!manifest.sourceDeletionVerified || manifest.inPlaceRestore?.submittedAt || manifest.inPlaceRestore?.submissionRequestedAt) throw Error('Verified source required; never repeat a restore submission');
    if (manifest.projects.some(p => p.role === 'restore' && p.ref)) throw Error('Separate restore target already exists');
    const fixtures = JSON.parse(fs.readFileSync(path.join(privateDir, 'fixtures.private.json'), 'utf8'));
    const registry = JSON.parse(fs.readFileSync(path.join(privateDir, 'independent-registry.private.json'), 'utf8'));
    const a = fixtures.find(f => f.label === 'deleted-owner'); const b = fixtures.find(f => f.label === 'control-owner');
    const original = registry.entries.find(r => r.projectRef === entry.ref && (r.stage ?? 'source') === 'source');
    if (fixtures.length !== 2 || !a || !b || registry.workflow !== manifest.workflow || original?.userId !== a.id) throw Error('Independent synthetic registry required');
    const data = await api(`/v1/projects/${entry.ref}/database/backups`);
    const backup = data.backups?.find(b => b.id === manifest.backupSelection?.selectedBackup?.id);
    if (!backup?.is_physical_backup || backup.status !== 'COMPLETED' || Date.parse(backup.inserted_at) <= Date.parse(manifest.seededDatabaseAt) || Date.parse(backup.inserted_at) >= Date.parse(original.acceptedAt)) throw Error('Selected pre-deletion physical backup required');
    const checks = (await sql(entry, `SELECT
      (SELECT count(*) FROM auth.users WHERE id=$1) deleted_auth,
      (SELECT count(*) FROM auth.users WHERE id=$2) control_auth,
      (SELECT count(*) FROM auth.users) total_auth,
      (SELECT count(*) FROM public.profiles WHERE id=$1) deleted_profiles,
      (SELECT count(*) FROM storage.objects WHERE bucket_id='community-images' AND name=$4) deleted_storage,
      (SELECT status FROM deletion_private.requests WHERE id=$3) source_receipt_status,
      (SELECT count(*) FROM information_schema.table_privileges WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')) app_table_grants,
      (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) public_tables_without_rls,
      (SELECT count(*) FROM vault.secrets) vault_secrets,
      to_regclass('cron.job') IS NOT NULL cron_table_exists`, [a.id, b.id, original.requestId, a.path], true))[0];
    if (Number(checks.deleted_auth) !== 0 || Number(checks.deleted_profiles) !== 0 || Number(checks.deleted_storage) !== 0 || Number(checks.control_auth) !== 1 || Number(checks.total_auth) !== 1 || checks.source_receipt_status !== 'retention_pending' || Number(checks.app_table_grants) !== 0 || Number(checks.public_tables_without_rls) !== 0 || Number(checks.vault_secrets) !== 0 || checks.cron_table_exists) throw Error('Disposable source isolation/deletion proof failed');
    manifest.previousCleanupAfter = manifest.cleanupAfter;
    manifest.cleanupAfter = new Date(Math.min(Date.parse(manifest.cleanupAfter), Date.now()+3600000)).toISOString();
    manifest.inPlaceRestore = { projectRef: entry.ref, backupId: backup.id, mode: 'physical_backup_in_existing_disposable_project', submissionRequestedAt: new Date().toISOString(), sourceChecks: checks, independentRegistryVerified: true, noNewProject: true, maxFurtherComputeUsd: 0.15, userReconfirmedFastCompletion: true };
    for (const target of manifest.projects.filter(p => p.role === 'restore' && !p.ref)) target.status = 'not_required_in_place_restore';
    manifest.cloneMethod.userActionNeededNow = false; manifest.cloneMethod.supersededByInPlaceRestore = true;
    manifest.status = 'physical_restore_submission_requested'; save();
    await api(`/v1/projects/${entry.ref}/database/backups/restore`, 'POST', { id: backup.id });
    manifest.inPlaceRestore.submittedAt = new Date().toISOString(); manifest.status = 'physical_restore_in_progress'; save();
    console.log(JSON.stringify({ status: manifest.status, projectRef: entry.ref, backupId: backup.id, newProjectCreated: false, cleanupAfter: manifest.cleanupAfter }));
  } else if (command === 'prepare-source') {
    if (Date.now() >= Date.parse(manifest.cleanupAfter)) throw Error('Cleanup window reached');
    const entry = manifest.projects.find(p => p.role === 'source'); owned(entry, projects.find(p => p.id === entry.ref));
    await prepareSource(entry);
  } else if (command === 'verify-source') {
    const entry = manifest.projects.find(p => p.role === 'source'); owned(entry, projects.find(p => p.id === entry.ref));
    const checks = await sql(entry, `SELECT
      (SELECT count(*) FROM public.profiles) profiles,
      (SELECT count(*) FROM auth.users WHERE raw_user_meta_data->>'qa_disposable'=$1) marked_test_users,
      (SELECT count(*) FROM auth.users) total_users,
      (SELECT count(*) FROM storage.objects) storage_objects,
      (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) public_tables_without_rls,
      (SELECT count(*) FROM information_schema.table_privileges WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')) app_table_grants,
      (SELECT count(*) FROM vault.secrets) vault_secrets,
      to_regclass('cron.job') IS NOT NULL cron_table_exists,
      (SELECT count(*) FROM deletion_private.requests) deletion_requests`, [manifest.workflow]);
    const c = checks[0];
    if (Number(c.profiles) !== 2 || Number(c.marked_test_users) !== 2 || Number(c.total_users) !== 2 || Number(c.storage_objects) !== 2 || Number(c.public_tables_without_rls) !== 0 || Number(c.app_table_grants) !== 0 || Number(c.vault_secrets) !== 0 || c.cron_table_exists || Number(c.deletion_requests) !== 0) throw Error('Isolated source verification failed');
    const call = await service(entry); const readiness = await call('/rest/v1/rpc/account_deletion_readiness', 'POST', {});
    if (!readiness) throw Error('Disposable source readiness is false');
    const report = { checkedAt: new Date().toISOString(), projectRef: entry.ref, passed: true, checks: c, readiness, productionChanged: false, existingFamilyQaChanged: false };
    fs.writeFileSync(path.join(root, 'output/deletion-completion-20260930/managed-source-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } else if (command === 'cleanup-preview') {
    const refs = [];
    for (const entry of manifest.projects) { const p = projects.find(p => p.id === entry.ref); if (p) { owned(entry, p); refs.push(entry.ref); } }
    console.log(JSON.stringify({ wouldDelete: refs, protectedRefs: [...protectedRefs], changed: false }));
  } else if (command === 'status') {
    for (const entry of manifest.projects) {
      const p = projects.find(p => p.id === entry.ref);
      if (p) { owned(entry, p); entry.status = p.status; } else if (entry.ref) entry.status = 'absent';
    }
    manifest.computeEstimate = { checkedAt: new Date().toISOString(), billedHoursRoundedUp: true, estimatedAccruedUsd: Number(manifest.projects.filter(p => p.ref).reduce((sum, p) => sum + Math.max(0, Math.ceil((Date.parse(p.deletionRequestedAt ?? new Date().toISOString()) - Date.parse(p.createdAt ?? p.creationRequestedAt)) / 3600000)) * p.hourlyComputeUsd, 0).toFixed(5)), invoiceConfirmed: false, otherUsageExcluded: true };
    manifest.lastCheckedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: manifest.status, projects: manifest.projects, cleanupAfter: manifest.cleanupAfter }));
  } else if (command === 'clone-options') {
    const entry = manifest.projects.find(p => p.role === 'source'); owned(entry, projects.find(p => p.id === entry.ref));
    const data = await api(`/platform/database/${entry.ref}/clone`);
    fs.writeFileSync(path.join(root, 'output/deletion-completion-20260930/managed-clone-options.json'), JSON.stringify({ checkedAt: new Date().toISOString(), projectRef: entry.ref, data }, null, 2) + '\n');
    console.log(JSON.stringify(data));
  } else if (command === 'backups') {
    const entry = manifest.projects.find(p => p.role === role); owned(entry, projects.find(p => p.id === entry.ref));
    const data = await api(`/v1/projects/${entry.ref}/database/backups`);
    fs.writeFileSync(path.join(root, `output/deletion-completion-20260930/managed-${role}-backups.json`), JSON.stringify({ checkedAt: new Date().toISOString(), projectRef: entry.ref, data }, null, 2) + '\n');
    console.log(JSON.stringify(data));
  } else if (command === 'cleanup') {
    // This command is authorized only for the recorded disposable projects.
    for (const entry of manifest.projects) {
      const p = projects.find(p => p.id === entry.ref);
      if (p) { owned(entry, p); await api(`/v1/projects/${entry.ref}`, 'DELETE'); entry.deletionRequestedAt = new Date().toISOString(); save(); }
    }
    const remaining = await api('/v1/projects');
    for (const entry of manifest.projects) {
      if (remaining.some(p => p.id === entry.ref)) throw Error('Project still exists after cleanup');
      entry.status = entry.ref ? 'deleted' : 'not_created'; entry.absenceVerifiedAt = new Date().toISOString();
      // Passwords are disposable with the project; do not retain them afterwards.
      fs.rmSync(path.join(privateDir, `${entry.role}.private.json`), { force: true });
    }
    fs.rmSync(path.join(privateDir, 'fixtures.private.json'), { force: true });
    fs.rmSync(path.join(privateDir, 'independent-registry.private.json'), { force: true });
    manifest.status = 'cleaned_up'; manifest.cleanedUpAt = new Date().toISOString(); save();
    fs.writeFileSync(path.join(root, 'output/deletion-completion-20260930/managed-restore-cleanup.json'), JSON.stringify({ checkedAt: manifest.cleanedUpAt, verificationMethod: 'Management API list projects after DELETE', ownProjectRefs: manifest.projects.filter(p => p.ref).map(p => p.ref), allOwnProjectsAbsent: true, secondProjectCreated: manifest.projects.some(p => p.role === 'restore' && p.ref), disposableCredentialsRemoved: true, protectedProjectsUntouched: true }, null, 2) + '\n');
    console.log(JSON.stringify({ status: manifest.status, allOwnProjectsAbsent: true, protectedProjectsUntouched: true }));
  } else throw Error('Use create-source, prepare-source, status, backups, or cleanup');
}
module.exports = { manifest, manifestPath, privateDir, root, owned, reconcile, sql, api, service, save };
if (require.main === module) main().catch(err => { console.error(err.message); process.exitCode = 1; });
