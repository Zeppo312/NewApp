// Read-only, aggregate operator check. Uses the CLI's existing login; no keys in argv/output.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const projects = { qa: { ref: 'ggyonianphloycmqrwvj', workdir: '.family-qa/workspace' }, production: { ref: 'kwniiyayhzgjfqjsjcfu', workdir: '.' } };
const digest = value => createHash('sha256').update(value).digest('hex');
export function assessDeletionStatus({ metadata, settings, functions = [], secrets = [], scheduler = [], health = null }) {
  const blockers = [];
  const require = (condition, code) => { if (!condition) blockers.push(code); };
  require(metadata.schema_present && metadata.worker_present, 'deletion_backend_missing');
  require(metadata.readiness_present, 'acceptance_check_missing');
  require(metadata.access_guard_present && metadata.access_guard_installed, 'access_guard_missing');
  require(metadata.registry_guard_present === true, 'independent_registry_guard_missing');
  for (const slug of ['request-account-deletion', 'process-account-deletion']) require(functions.some(f => f.slug === slug && f.status === 'ACTIVE'), `${slug}_missing`);
  const flag = secrets.find(s => s.name === 'ACCOUNT_DELETION_ENABLED');
  require(flag?.value === digest('true'), 'deletion_disabled');
  for (const name of ['REVENUECAT_DELETION_API_KEY', 'REVENUECAT_PROJECT_ID', 'ACCOUNT_DELETION_CRON_SECRET']) require(secrets.some(s => s.name === name), `${name.toLowerCase()}_missing`);
  require(settings?.inventory_current && settings?.approval_named && settings?.approval_dated, 'inventory_not_approved');
  const providerMode = settings?.provider_handling_mode ?? 'unapproved';
  require(settings?.receipt_retention_days > 0 && (providerMode === 'supervised' ||
    (providerMode === 'verified_retention' && settings?.backup_window_days > 0)), 'retention_not_configured');
  require(scheduler.some(s => s.active === true), 'worker_schedule_inactive');
  const alertKeys = ['needs_attention', 'queued_over_15m', 'expired_lease_over_7m', 'lease_exceeds_contract', 'overdue_retention'];
  const counter = value => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const validHealth = health && alertKeys.every(key => counter(health[key]) !== null);
  const unacknowledged = counter(settings?.registry_unacknowledged_requests);
  if (metadata.registry_guard_present) {
    require(unacknowledged !== null, 'registry_acknowledgements_unverified');
    if (unacknowledged !== null) require(unacknowledged === 0, 'registry_acknowledgements_pending');
  }
  const alerts = validHealth ? Object.fromEntries(alertKeys.map(key => [key, counter(health[key])])) : null;
  if (metadata.schema_present && metadata.worker_present) require(validHealth, 'operational_health_unverified');
  const alarm = alerts !== null && Object.values(alerts).some(value => value > 0);
  // A working backend does not prove mail delivery, provider erasure or a safe restore.
  return { configured: blockers.length === 0, releaseApproved: false, blockers, alarm,
    alerts, pendingProviderEvidence: health ? counter(health.pending_provider_evidence) : null,
    completedRequests: settings ? counter(settings.completed_requests) : null,
    providerHandlingMode: providerMode,
    independentRegistry: { barrierInstalled: metadata.registry_guard_present === true, unacknowledgedRequests: unacknowledged,
      durableOperatorPathVerified: false, writerRuntimeVerified: false },
    remainingEvidence: ['smtp_and_otp_delivery', 'alert_delivery_and_response', 'provider_end_to_end', 'isolated_supabase_restore', 'native_deletion_end_to_end', 'policy_approval', 'independent_registry_runtime_and_restore_replay'] };
}
export async function collectDeletionStatus(environment) {
  const target = projects[environment]; if (!target) throw new Error('Choose qa or production.');
  const linked = (await readFile(resolve(target.workdir, 'supabase/.temp/project-ref'), 'utf8')).trim();
  if (linked !== target.ref) throw new Error('Linked project does not match the requested environment.');
  const cli = async args => JSON.parse((await exec('supabase', args, { timeout: 60000, maxBuffer: 2 * 1024 * 1024 })).stdout);
  const query = async sql => (await cli(['db', 'query', '--linked', '--workdir', target.workdir, sql, '-o', 'json'])).rows;
  const results = await Promise.allSettled([
    query(`SELECT to_regnamespace('deletion_private') IS NOT NULL schema_present,
      to_regnamespace('cron') IS NOT NULL cron_present,
      to_regprocedure('public.account_deletion_worker(text,jsonb)') IS NOT NULL worker_present,
      to_regprocedure('public.account_deletion_readiness()') IS NOT NULL readiness_present,
      (to_regprocedure('public.account_deletion_registry_export()') IS NOT NULL
        AND to_regprocedure('public.account_deletion_registry_ack(uuid,text,text)') IS NOT NULL
        AND to_regprocedure('deletion_private.registry_entry_digest(uuid)') IS NOT NULL
        AND coalesce(pg_get_functiondef(to_regprocedure('deletion_private.worker(text,jsonb)')) LIKE '%registry_entry_sha256=deletion_private.registry_entry_digest(id)%', false)) registry_guard_present,
      to_regprocedure('public.check_account_deletion_access()') IS NOT NULL access_guard_present,
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator' AND 'pgrst.db_pre_request=public.check_account_deletion_access'=ANY(rolconfig)) access_guard_installed`),
    cli(['functions', 'list', '--project-ref', target.ref, '-o', 'json']),
    cli(['secrets', 'list', '--project-ref', target.ref, '-o', 'json']),
  ]);
  if (results.some(result => result.status === 'rejected')) throw new Error('An authenticated status query failed; no readiness claim can be made.');
  const [metadata] = results[0].value;
  const functions = results[1].value; const secrets = results[2].value;
  let settings = null; let health = null; let scheduler = [];
  if (metadata.schema_present && metadata.worker_present) {
    [settings] = await query(`SELECT approved_fingerprint=deletion_private.fingerprint() inventory_current,
      length(trim(approved_by))>=3 approval_named, approved_at IS NOT NULL AND approved_at<=now() approval_dated,
      receipt_retention_days, backup_window_days,
      to_jsonb(settings)->>'provider_handling_mode' provider_handling_mode,
      (SELECT count(*) FROM deletion_private.requests WHERE status='completed') completed_requests
      FROM deletion_private.settings WHERE singleton`);
    if (metadata.registry_guard_present) {
      const [registry] = await query(`SELECT count(*) registry_unacknowledged_requests FROM deletion_private.requests
        WHERE status<>'completed' AND (registry_acknowledged_at IS NULL
          OR registry_entry_sha256 IS DISTINCT FROM deletion_private.registry_entry_digest(id))`);
      settings.registry_unacknowledged_requests = registry.registry_unacknowledged_requests;
    }
    [health] = (await cli(['db', 'query', '--linked', '--workdir', target.workdir, '--file', resolve('supabase/tests/account_deletion_operational_health.sql'), '-o', 'json'])).rows;
  }
  if (metadata.cron_present) scheduler = await query("SELECT active FROM cron.job WHERE jobname LIKE 'account-deletion-worker%'");
  return { checkedAt: new Date().toISOString(), environment, projectRef: target.ref, owner: 'Jan Zeppenfeld', substitute: 'Ehefrau nach Übergabe', contact: 'support@lottibaby.de',
    ...assessDeletionStatus({ metadata, settings, functions, secrets, scheduler, health }) };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { console.log('node scripts/account-deletion-check.mjs --environment qa|production [--out report.json]\nRead-only; exit 2 for missing configuration or actionable alarms. No release approval implied.'); return; }
  let environment; let output;
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--environment' && projects[args[i + 1]]) environment = args[i + 1];
    else if (args[i] === '--out' && args[i + 1]) output = args[i + 1];
    else throw new Error('Invalid arguments; use --help.');
  }
  if (!environment) throw new Error('Explicit --environment is required.');
  const report = await collectDeletionStatus(environment);
  if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify(report, null, 2));
  if (!report.configured || report.alarm) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Deletion status could not be verified. Check CLI access, project link and arguments; no credentials were logged.'); process.exitCode = 1; });
