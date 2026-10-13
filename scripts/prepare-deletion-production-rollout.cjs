// Preparation only: writes reviewed SQL locally; never executes production DDL,
// changes a secret, deploys a function, enables a job, or creates a project.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, '.family-qa/deletion-production-preparation-20261001');
const projectRef = 'kwniiyayhzgjfqjsjcfu';
const organizationId = 'xqbmotyjxjdeqoisbgow';
const files = [
 ['20260911065615_account_deletion_jobs.sql', '677784efb0c99b4d5f578404e33d71d51db55c391357e47ef2e95c1350654d66'],
 ['20260930055640_account_deletion_readiness.sql', '373e3c6a565439244b7340da4e9b3125e18a4236393f955cce6a240eaad44ac4'],
 ['20260930163849_account_deletion_alarm.sql', '19441848d85a564329c90778c8877c605618964fec7fe86dcbc64d44e8f2bcc9'],
 ['20260930170233_account_deletion_cdn_proof.sql', '2b7b03853bb37ae6ed571d6452c015a434a9a7ebaa33fe19e57db3c80d70c0e4'],
 ['20261001051435_account_deletion_worker_aliases.sql', '374b8c642117f4c9ca8142d48a046f86d0c40acc2f3ee88fea7b95319efbd501'],
 ['20261001094535_account_deletion_nullable_actor_rules.sql', '26b035fc81e182457cbbcb5a316071694089b418c2bfe029649e5d93a9a1b391'],
 ['20261001122517_account_deletion_supervised_provider_mode.sql', '26868e222b952ce47d26bea058ae778f918e1b44869ced140336f6d8df30954b'],
 ['20261001124926_account_deletion_durable_registry.sql', 'ee428886e818ae98b159c82f4ed6ec072d9758f08489bf27c2c17fd895db5cbf'],
];
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function stripTransaction(sql) {
 const lines = sql.split('\n');
 const begins = lines.flatMap((line, i) => /^BEGIN;\s*$/.test(line) ? [i] : []);
 const commits = lines.flatMap((line, i) => /^COMMIT;\s*$/.test(line) ? [i] : []);
 if (!begins.length && !commits.length) return sql;
 if (begins.length !== 1 || commits.length !== 1 || commits[0] < begins[0] || lines.slice(commits[0] + 1).some(line => line.trim())) throw Error('Unreviewed transaction structure');
 return lines.filter((_, i) => i !== begins[0] && i !== commits[0]).join('\n');
}

function validateBaseline(snapshot) {
 const p = snapshot.project; const b = snapshot.baseline;
 if (p?.id !== projectRef || p.organization_id !== organizationId || p.region !== 'eu-central-1' || p.status !== 'ACTIVE_HEALTHY') throw Error('Wrong production owner/target/status');
 if (b.deletion_schema_present || b.deletion_history.length || b.deletion_policy_name_collisions || b.deletion_trigger_name_collisions) throw Error('Partially applied deletion system; do not replay initial schema');
 if (b.authenticator_config?.some(v => v.startsWith('pgrst.db_pre_request='))) throw Error('Existing security hook requires composition and separate review');
 if (b.actor_columns.length !== 7 || b.actor_columns.some(c => c.udt !== 'uuid' || c.nullable !== 'YES') || b.receiver_nullable !== 'NO') throw Error('Unreviewed actor or message-column drift');
 if (b.legacy_function?.identity !== 'delete_auth boolean' || b.legacy_function.owner !== 'postgres') throw Error('Legacy RPC signature/ownership drift');
}

function buildSql(snapshot) {
 validateBaseline(snapshot);
 const originalRpcMd5 = crypto.createHash('md5').update(snapshot.baseline.legacy_function.definition).digest('hex');
 const versions = files.map(([name]) => name.slice(0, 14));
 let sql = `-- Reviewed staging only: no live request, retention duration, policy approval, or cron activation.\nBEGIN;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='30s';\nSELECT pg_advisory_xact_lock(hashtextextended('lottibaby-deletion-production-20261001',0));\nDO $guard$ BEGIN\n IF to_regnamespace('deletion_private') IS NOT NULL THEN RAISE EXCEPTION 'deletion_schema_already_present'; END IF;\n IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN (${versions.map(quote).join(',')})) THEN RAISE EXCEPTION 'deletion_history_already_present'; END IF;\n IF EXISTS(SELECT 1 FROM pg_policy WHERE polname='account_deletion_deny') OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname IN ('account_deletion_guard','account_deletion_acceptance_guard','account_deletion_cdn_evidence')) THEN RAISE EXCEPTION 'deletion_object_name_collision'; END IF;\n IF EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig) c WHERE r.rolname='authenticator' AND c LIKE 'pgrst.db_pre_request=%') THEN RAISE EXCEPTION 'existing_security_hook_requires_review'; END IF;\n IF md5(pg_get_functiondef(to_regprocedure('public.delete_user_data(boolean)'))) IS DISTINCT FROM ${quote(originalRpcMd5)} THEN RAISE EXCEPTION 'legacy_rpc_changed'; END IF;\n IF (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='direct_messages' AND column_name='receiver_id') IS DISTINCT FROM 'NO' THEN RAISE EXCEPTION 'message_schema_changed'; END IF;\n IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND udt_name='uuid' AND is_nullable='YES' AND (table_name,column_name) IN (('sleep_entries','updated_by'),('shopping_items','partner_id'),('paywall_content_config','updated_by'),('startup_messages','created_by'),('startup_messages','updated_by'),('subscription_plan_features','updated_by'),('subscription_policy_state','updated_by')))<>7 THEN RAISE EXCEPTION 'actor_schema_changed'; END IF;\nEND $guard$;\n`;
 const manifests = [];
 for (const [name, expectedHash] of files) {
  const source = fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
  if (sha(source) !== expectedHash) throw Error('Migration source changed: ' + name);
  const version = name.slice(0, 14); const migrationName = name.slice(15, -4);
  sql += `\n-- Exact migration ${name}; sha256 ${expectedHash}\n${stripTransaction(source)}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(version)},${quote(migrationName)},ARRAY[${quote(source)}]::text[]);\n`;
  manifests.push({ file: 'supabase/migrations/' + name, version, sha256: expectedHash });
 }
 sql += `\nALTER ROLE authenticator SET pgrst.db_pre_request='public.check_account_deletion_access';\nNOTIFY pgrst,'reload config';\nDO $verify$ BEGIN\n IF public.account_deletion_readiness() THEN RAISE EXCEPTION 'unexpected_readiness'; END IF;\n IF EXISTS(SELECT 1 FROM deletion_private.settings WHERE approved_fingerprint IS NOT NULL OR approved_by IS NOT NULL OR approved_at IS NOT NULL OR receipt_retention_days IS NOT NULL OR backup_window_days IS NOT NULL OR provider_handling_mode<>'unapproved') THEN RAISE EXCEPTION 'unexpected_activation_or_duration'; END IF;\n IF EXISTS(SELECT 1 FROM deletion_private.requests) THEN RAISE EXCEPTION 'unexpected_deletion_request'; END IF;\n IF (SELECT count(*) FROM pg_policy WHERE polname='account_deletion_deny')<>${snapshot.baseline.guard_target_tables} OR (SELECT count(*) FROM pg_trigger WHERE tgname='account_deletion_guard')<>${snapshot.baseline.guard_target_tables} THEN RAISE EXCEPTION 'guard_count_changed'; END IF;\n IF (SELECT count(*) FROM deletion_private.rules)<>136 THEN RAISE EXCEPTION 'manifest_count_changed'; END IF;\n IF has_function_privilege('anon','public.account_deletion_worker(text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.account_deletion_worker(text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.account_deletion_readiness()','EXECUTE') OR has_function_privilege('authenticated','public.account_deletion_readiness()','EXECUTE') OR has_function_privilege('anon','public.account_deletion_alarm(text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.account_deletion_alarm(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'private_rpc_exposed'; END IF;\n IF NOT has_function_privilege('service_role','public.account_deletion_worker(text,jsonb)','EXECUTE') OR NOT has_function_privilege('service_role','public.account_deletion_readiness()','EXECUTE') OR NOT has_function_privilege('service_role','public.account_deletion_alarm(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'service_rpc_permission_missing'; END IF;\n IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='deletion_private' AND c.relkind='r' AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'private_table_rls_missing'; END IF;\n IF has_function_privilege('anon','public.account_deletion_registry_export()','EXECUTE') OR has_function_privilege('authenticated','public.account_deletion_registry_export()','EXECUTE') OR has_function_privilege('anon','public.account_deletion_registry_ack(uuid,text,text)','EXECUTE') OR has_function_privilege('authenticated','public.account_deletion_registry_ack(uuid,text,text)','EXECUTE') OR NOT has_function_privilege('service_role','public.account_deletion_registry_export()','EXECUTE') OR NOT has_function_privilege('service_role','public.account_deletion_registry_ack(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'registry_rpc_privileges_invalid'; END IF;\n IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.delete_user_data(boolean)') AND prosecdef) OR pg_get_functiondef(to_regprocedure('public.delete_user_data(boolean)')) NOT LIKE '%https://lottibaby.de/datenschutz#konto-loeschen%' THEN RAISE EXCEPTION 'legacy_rpc_not_safe'; END IF;\nEND $verify$;\nCOMMIT;\n`;
 return { sql, manifests };
}

function functionManifest() {
 const functions = [];
 for (const slug of ['request-account-deletion', 'process-account-deletion', 'account-deletion-alert']) {
  const dir = path.join(privateDir, 'new-functions', slug);
  const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]);
  const sources = walk(path.join(dir, 'supabase/functions')).map(file => {
   const relative = path.relative(dir, file);
   if (!fs.existsSync(path.join(root, relative)) || sha(fs.readFileSync(file)) !== sha(fs.readFileSync(path.join(root, relative)))) throw Error('QA source does not match reviewed root: ' + relative);
   return { file: relative, sha256: sha(fs.readFileSync(file)) };
  });
  functions.push({ slug, verifyJwt: false, isolatedWorkdir: path.relative(root, dir), sources });
 }
 return functions;
}

async function main() {
 if (process.argv.slice(2).length) throw Error('This preparer takes no arguments and has no deploy/apply/enable command');
 const baseline = JSON.parse(fs.readFileSync(path.join(privateDir, 'fresh-baseline.local.json'), 'utf8'));
 const { sql, manifests } = buildSql(baseline);
 fs.writeFileSync(path.join(privateDir, 'stage-eight-migrations.local.sql'), sql, { mode: 0o600 });
 const report = {
  preparedAt: new Date().toISOString(), baselineReadAt: baseline.checkedAt,
  projectRef, organizationId, stageOnly: true, executionAllowed: false,
  productionChanged: false, customerDeletionPerformed: false,
  sqlSha256: sha(sql), sqlFile: '.family-qa/deletion-production-preparation-20261001/stage-eight-migrations.local.sql',
  migrations: manifests, newFunctions: functionManifest(),
  legacyRpcWillBecomeSupportOnly: true, explicitLegacyAnonGrantSurvivesButHasNoDestructiveImplementation: true,
  guardTargetTables: baseline.baseline.guard_target_tables,
  requiresFreshTargetAndCatalogBeforeExecution: true,
  disabledDeploymentPrerequisites: ['root explicitly clears reviewed staging', 'native fixture acceptance and cleanup proved', 'all eight migration hashes and function sources reviewed', 'current production DDL/functions privately saved', 'production disable flag and inactive schedulers verified'],
  activationPrerequisites: ['named dated policy/schema approval with selected provider mode', 'independent out-of-backup deletion registry and replay procedure demonstrated', 'supervised provider owner and daily case handling', 'required service-role guard integrations verified', 'production SMTP and separate RevenueCat deletion permission configured', 'real alarm receipt verified', 'per-case completion remains evidence-gated'],
  unknownBackupMaximum: null, receiptPurgeWithUnknownMaximum: 'forbidden',
  noNewProjectsOrAccounts: true, noTariffChange: true,
 };
 fs.writeFileSync(path.join(root, 'output/deletion-completion-20260930/production-rollout-prepared-20261001.json'), JSON.stringify(report, null, 2) + '\n');
 console.log(JSON.stringify({ prepared: true, productionChanged: false, executionAllowed: false, migrations: manifests.length, newFunctions: report.newFunctions.length, sqlSha256: report.sqlSha256 }));
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildSql, validateBaseline, stripTransaction };
