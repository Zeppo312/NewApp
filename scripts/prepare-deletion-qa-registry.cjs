// Local preparation only. No apply/deploy/secret/worker/Ack command exists.
// A fresh native-worker + cleanup proof is mandatory before the read-only API run.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { stripTransaction } = require('./prepare-deletion-production-rollout.cjs');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.family-qa/deletion-production-preparation-20261001');
const nativeDirectory = path.join(root, '.family-qa/deletion-native-20261001');
const outputDirectory = path.join(root, 'output/deletion-completion-20260930');
const QA = 'ggyonianphloycmqrwvj';
const PROD = 'kwniiyayhzgjfqjsjcfu';
const ORG = 'xqbmotyjxjdeqoisbgow';
const BRANCH = '917136d3-49fb-463b-9026-30e62b9533a5';
const origin = `https://${QA}.supabase.co`;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const oldSources = [
 ['20260911065615_account_deletion_jobs.sql', '677784efb0c99b4d5f578404e33d71d51db55c391357e47ef2e95c1350654d66'],
 ['20260930055640_account_deletion_readiness.sql', '373e3c6a565439244b7340da4e9b3125e18a4236393f955cce6a240eaad44ac4'],
 ['20260930163849_account_deletion_alarm.sql', '19441848d85a564329c90778c8877c605618964fec7fe86dcbc64d44e8f2bcc9'],
 ['20260930170233_account_deletion_cdn_proof.sql', '2b7b03853bb37ae6ed571d6452c015a434a9a7ebaa33fe19e57db3c80d70c0e4'],
 ['20261001051435_account_deletion_worker_aliases.sql', '374b8c642117f4c9ca8142d48a046f86d0c40acc2f3ee88fea7b95319efbd501'],
 ['20261001094535_account_deletion_nullable_actor_rules.sql', '26b035fc81e182457cbbcb5a316071694089b418c2bfe029649e5d93a9a1b391'],
];
const newSources = [
 ['20261001122517_account_deletion_supervised_provider_mode.sql', '26868e222b952ce47d26bea058ae778f918e1b44869ced140336f6d8df30954b'],
 ['20261001124926_account_deletion_durable_registry.sql', 'ee428886e818ae98b159c82f4ed6ec072d9758f08489bf27c2c17fd895db5cbf'],
];
const functions = ['deletion_private.fingerprint()', 'deletion_private.accept(uuid,text,text,text,text)',
 'deletion_private.worker(text,jsonb)', 'public.account_deletion_worker(text,jsonb)', 'public.account_deletion_readiness()'];
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function validateIdentity(target, parent, branch) {
 assert.equal(target.projectRef, QA, 'Only the existing QA target is allowed');
 assert.equal(parent?.id, PROD); assert.equal(parent.organization_id, ORG, 'Wrong parent organization');
 assert.equal(branch?.id, BRANCH); assert.equal(branch.project_ref, QA);
 assert.equal(branch.parent_project_ref, PROD); assert.equal(branch.name, 'family-subscription-qa');
 assert.equal(branch.is_default, false); assert.equal(branch.preview_project_status, 'ACTIVE_HEALTHY');
}

function validateNativeGate(worker, cleanup, fixture) {
 assert.equal(worker?.projectRef, QA); assert.equal(worker.mode, 'worker'); assert.equal(worker.passed, true, 'Native worker proof missing');
 assert.equal(worker.actualDeployedWorkerUsed, true); assert.equal(worker.authAndProfileDeleted, true);
 assert.equal(worker.ownFileDeleted, true); assert.equal(worker.oldFreshTokenBlocked, true);
 for (const key of ['controlAuthIdentitiesUnchanged', 'controlProfilesUnchanged', 'controlAuthProviderIdentitiesUnchanged']) assert.equal(worker[key], true);
 assert.equal(worker.remainingAuthUsers, 6); assert.equal(worker.fullDeletionCompleted, false);
 assert(['needs_attention', 'retention_pending'].includes(worker.finalRequestStatus));
 assert(uuid.test(worker.requestId)); assert(uuid.test(fixture?.userId)); assert.equal(fixture.projectRef, QA);
 assert(Number.isFinite(Date.parse(worker.completedAt)), 'Completed worker timestamp required');
 assert.equal(cleanup?.projectRef, QA); assert.equal(cleanup.mode, 'worker'); assert.equal(cleanup.passed, true);
 assert.equal(cleanup.requestId, worker.requestId); assert.equal(cleanup.completedAt, worker.completedAt);
 for (const key of ['baselineRestored', 'approvalAndRetentionRestored', 'temporaryFixtureRestrictionRemoved']) assert.equal(cleanup[key], true);
 assert.equal(cleanup.deletionEnabled, false); assert.equal(cleanup.authUsersAfterCleanup, 6);
 assert.equal(cleanup.objectsAfterCleanup, 0); assert.equal(cleanup.requestsAfterCleanup, 1);
 return { requestId: worker.requestId, userId: fixture.userId };
}

function validateSourceBaseline(baseline) {
 validateIdentity({ projectRef: QA }, baseline.parent, baseline.branch);
 // Initial jobs SQL was historically applied without a migration-history row.
 // Bind the five later registrations and exact effective source instead of lying
 // about six version rows or retroactively registering the old bootstrap.
 const versions = oldSources.slice(1).map(([name]) => name.slice(0, 14)).sort();
 assert.deepEqual(baseline.migration_history.map(row => row.version).sort(), versions, 'Existing deletion history changed');
 assert.equal(baseline.localSixMigrationBodiesMatch, true, 'Effective SQL source must match the reviewed six migrations');
 for (const name of functions) {
  assert(/^[a-f0-9]{32}$/.test(baseline.functions_md5[name]), 'Missing effective function source');
  assert(/^[a-f0-9]{32}$/.test(baseline.prosrc_md5?.[name]), 'Missing source body comparison');
 }
 assert.equal(Number(baseline.guard_policies), 118); assert.equal(Number(baseline.guard_triggers), 118);
 assert.equal(Number(baseline.rules), 136);
}

function stateSql(gate) {
 assert(uuid.test(gate.requestId) && uuid.test(gate.userId), 'Exact fixture identities required');
 const uid = quote(gate.userId); const rid = quote(gate.requestId);
 return `SELECT
  (SELECT to_jsonb(s) FROM deletion_private.settings s WHERE singleton) settings,
  (SELECT count(*) FROM auth.users) auth_users,
  (SELECT count(*) FROM auth.users WHERE id=${uid}::uuid) fixture_auth,
  (SELECT count(*) FROM public.profiles WHERE id=${uid}::uuid) fixture_profile,
  (SELECT count(*) FROM storage.objects) storage_objects,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'scope',r.scope,'source',r.source,'status',r.status,'phase',r.phase,'lease',r.lease,'lease_until',r.lease_until) ORDER BY r.id),'[]') FROM deletion_private.requests r) jobs,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(r)-ARRAY['registry_acknowledged_at','registry_entry_sha256','registry_ack_writer'] ORDER BY r.id)::text,'[]')) FROM deletion_private.requests r) requests_md5,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.request_id,t.provider)::text,'[]')) FROM deletion_private.provider_tasks t) providers_md5,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text,'[]')) FROM deletion_private.events e) events_md5,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.request_id,o.bucket,o.path)::text,'[]')) FROM deletion_private.objects o) objects_md5,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,'[]')) FROM auth.users u) auth_md5,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id)::text,'[]')) FROM auth.identities i) identities_md5,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id)::text,'[]')) FROM public.profiles p) profiles_md5,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('jobname',jobname,'schedule',schedule,'active',active) ORDER BY jobname),'[]') FROM cron.job WHERE jobname IN ('account-deletion-worker-qa','account-deletion-alert-qa')) schedules,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(j) ORDER BY jobid)::text,'[]')) FROM cron.job j) schedules_md5,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(h) ORDER BY version)::text,'[]')) FROM supabase_migrations.schema_migrations h WHERE version NOT IN ('20261001122517','20261001124926')) old_history_md5,
  (SELECT count(*) FROM deletion_private.provider_tasks WHERE request_id=${rid}::uuid) provider_count,
  public.account_deletion_readiness() readiness`;
}

function validateReadyState(state, gate, before, secrets) {
 assert.equal(Number(state.auth_users), 6); assert.equal(Number(state.fixture_auth), 0); assert.equal(Number(state.fixture_profile), 0);
 assert.equal(Number(state.storage_objects), 0); assert.equal(Number(state.provider_count), 12); assert.equal(state.readiness, false);
 assert.equal(state.jobs.length, 1); const job = state.jobs[0];
 assert.equal(job.id, gate.requestId); assert.equal(job.user_id, gate.userId); assert.equal(job.scope, 'account'); assert.equal(job.source, 'app');
 assert.equal(job.phase, 'providers'); assert(['needs_attention', 'retention_pending'].includes(job.status));
 assert.equal(job.lease, null); assert.equal(job.lease_until, null);
 assert.deepEqual(state.settings, before.settings, 'Native cleanup settings must be restored exactly');
 assert.deepEqual(state.schedules, [...before.schedules].sort((a, b) => a.jobname.localeCompare(b.jobname)), 'Existing schedules changed');
 assert.equal(state.settings.storage_origin, origin);
 for (const key of ['approved_fingerprint', 'approved_by', 'approved_at', 'receipt_retention_days', 'backup_window_days']) assert.equal(state.settings[key], null);
 assert.equal(secrets.find(item => item.name === 'ACCOUNT_DELETION_ENABLED')?.value, sha('false'), 'QA endpoints must be disabled');
 assert(!secrets.some(item => item.name === 'ACCOUNT_DELETION_QA_TEST_USER_ID'), 'Temporary native scope still exists');
}

function buildQaSql(sourceBaseline, state, gate) {
 validateSourceBaseline(sourceBaseline);
 for (const [name, expected] of [...oldSources, ...newSources]) assert.equal(sha(fs.readFileSync(path.join(root, 'supabase/migrations', name))), expected, 'Reviewed source changed: ' + name);
 const stateQuery = stateSql(gate);
 const hashes = ['requests_md5','providers_md5','events_md5','objects_md5','auth_md5','identities_md5','profiles_md5','schedules_md5','old_history_md5'];
 for (const field of hashes) assert(/^[a-f0-9]{32}$/.test(state[field]), 'Missing preserved-state hash');
 let sql = `-- QA7/8 preparation only. Root gate required; never execute against production.\nBEGIN;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='30s';\nSELECT pg_advisory_xact_lock(hashtextextended('lottibaby-qa-registry-20261001',0));\nDO $precheck$ DECLARE qa_state_document jsonb; BEGIN\n IF to_regnamespace('deletion_private') IS NULL THEN RAISE EXCEPTION 'qa_existing_deletion_schema_required'; END IF;\n IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ('20261001122517','20261001124926')) OR to_regprocedure('public.account_deletion_registry_export()') IS NOT NULL OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='deletion_private' AND table_name='settings' AND column_name='provider_handling_mode') THEN RAISE EXCEPTION 'qa_new_migration_already_present'; END IF;\n`;
 for (const name of functions) sql += ` IF md5(pg_get_functiondef(to_regprocedure(${quote(name)}))) IS DISTINCT FROM ${quote(sourceBaseline.functions_md5[name])} THEN RAISE EXCEPTION 'qa_existing_function_changed'; END IF;\n`;
 for (const history of sourceBaseline.migration_history) sql += ` IF (SELECT md5(statements::text) FROM supabase_migrations.schema_migrations WHERE version=${quote(history.version)}) IS DISTINCT FROM ${quote(history.statementsMd5)} THEN RAISE EXCEPTION 'qa_existing_history_changed'; END IF;\n`;
 sql += ` SELECT to_jsonb(snapshot) INTO qa_state_document FROM (${stateQuery}) snapshot;\n IF qa_state_document->'settings' IS DISTINCT FROM ${quote(JSON.stringify(state.settings))}::jsonb OR (qa_state_document->>'auth_users')::int<>6 OR (qa_state_document->>'fixture_auth')::int<>0 OR (qa_state_document->>'fixture_profile')::int<>0 OR (qa_state_document->>'storage_objects')::int<>0 OR (qa_state_document->>'provider_count')::int<>12 OR qa_state_document->'jobs' IS DISTINCT FROM ${quote(JSON.stringify(state.jobs))}::jsonb OR (qa_state_document->>'readiness')::boolean THEN RAISE EXCEPTION 'qa_native_cleanup_state_changed'; END IF;\n`;
 for (const field of hashes) sql += ` IF qa_state_document->>${quote(field)} IS DISTINCT FROM ${quote(state[field])} THEN RAISE EXCEPTION 'qa_preserved_state_changed:${field}'; END IF;\n`;
 sql += `END $precheck$;\n`;
 const manifest = [];
 for (const [name, expected] of newSources) {
  const source = fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'); const version = name.slice(0, 14);
  sql += `\n-- Exact reviewed source ${name}, sha256 ${expected}\n${stripTransaction(source)}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(version)},${quote(name.slice(15,-4))},ARRAY[${quote(source)}]::text[]);\n`;
  manifest.push({file:'supabase/migrations/'+name,version,sha256:expected});
 }
 sql += `DO $verify$ DECLARE qa_state_document jsonb; qa_registry_export jsonb; BEGIN\n SELECT to_jsonb(snapshot) INTO qa_state_document FROM (${stateQuery}) snapshot;\n IF (qa_state_document->'settings')-'provider_handling_mode' IS DISTINCT FROM ${quote(JSON.stringify(state.settings))}::jsonb OR qa_state_document->'settings'->>'provider_handling_mode'<>'unapproved' OR (qa_state_document->>'readiness')::boolean THEN RAISE EXCEPTION 'qa_unexpected_mode_or_approval'; END IF;\n`;
 for (const field of hashes) sql += ` IF qa_state_document->>${quote(field)} IS DISTINCT FROM ${quote(state[field])} THEN RAISE EXCEPTION 'qa_preserved_state_changed:${field}'; END IF;\n`;
 sql += ` IF EXISTS(SELECT 1 FROM deletion_private.requests WHERE registry_acknowledged_at IS NOT NULL OR registry_entry_sha256 IS NOT NULL OR registry_ack_writer IS NOT NULL) THEN RAISE EXCEPTION 'qa_ack_must_remain_absent'; END IF;\n IF (SELECT count(*) FROM pg_policy WHERE polname='account_deletion_deny')<>118 OR (SELECT count(*) FROM pg_trigger WHERE tgname='account_deletion_guard')<>118 OR (SELECT count(*) FROM deletion_private.rules)<>136 THEN RAISE EXCEPTION 'qa_guard_inventory_changed'; END IF;\n IF has_function_privilege('anon','public.account_deletion_registry_export()','EXECUTE') OR has_function_privilege('authenticated','public.account_deletion_registry_export()','EXECUTE') OR has_function_privilege('anon','public.account_deletion_registry_ack(uuid,text,text)','EXECUTE') OR has_function_privilege('authenticated','public.account_deletion_registry_ack(uuid,text,text)','EXECUTE') OR NOT has_function_privilege('service_role','public.account_deletion_registry_export()','EXECUTE') OR NOT has_function_privilege('service_role','public.account_deletion_registry_ack(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'qa_registry_rpc_privileges'; END IF;\n SELECT public.account_deletion_registry_export() INTO qa_registry_export;\n IF qa_registry_export->>'origin'<>${quote(origin)} OR jsonb_array_length(qa_registry_export->'entries')<>1 OR qa_registry_export->'entries'->0->>'requestId'<>${quote(gate.requestId)} OR qa_registry_export->'entries'->0->>'userId'<>${quote(gate.userId)} OR qa_registry_export->'entries'->0->>'scope'<>'account' OR qa_registry_export->'entries'->0->>'digest' IS DISTINCT FROM deletion_private.registry_entry_digest(${quote(gate.requestId)}::uuid) THEN RAISE EXCEPTION 'qa_exact_existing_fixture_export_mismatch'; END IF;\nEND $verify$;\nCOMMIT;\n`;
 return {sql,manifest};
}

async function main() {
 assert.deepEqual(process.argv.slice(2), ['--prepare-after-native-cleanup'], 'Preparation needs an explicit completed-native gate; there is no apply command');
 const worker=readJson(path.join(outputDirectory,'native-backend-worker-20261001.json'));
 const cleanup=readJson(path.join(outputDirectory,'native-backend-cleanup-20261001.json'));
 const fixture=readJson(path.join(nativeDirectory,'native-fixture-credentials.local.json'));
 const gate=validateNativeGate(worker,cleanup,fixture); // Before loading credentials/API.
 const baseline=readJson(path.join(directory,'qa-six-source-baseline.local.json'));validateSourceBaseline(baseline);
 const {api}=require('./managed-deletion-restore.cjs'); // API helper only; no lifecycle functions.
 const [projects,branches,secrets]=await Promise.all([api('/v1/projects'),api(`/v1/projects/${PROD}/branches`),api(`/v1/projects/${QA}/secrets`)]);
 validateIdentity(readJson(path.join(root,'.family-qa/target.local.json')),projects.find(p=>p.id===PROD),branches.find(b=>b.project_ref===QA));
 const names=functions.map(quote).join(',');
 const currentSource=(await api(`/v1/projects/${QA}/database/query`,'POST',{query:`BEGIN READ ONLY; SELECT
  (SELECT jsonb_object_agg(name,md5(pg_get_functiondef(to_regprocedure(name)))) FROM unnest(ARRAY[${names}]) names(name)) functions_md5,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statementCount',cardinality(statements),'statementsMd5',md5(statements::text)) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations WHERE name ILIKE '%deletion%') migration_history; ROLLBACK;`,read_only:false}))[0];
 assert.deepEqual(currentSource.functions_md5,baseline.functions_md5,'Effective six-migration SQL changed');
 assert.deepEqual(currentSource.migration_history,baseline.migration_history,'Existing migration history changed');
 const state=(await api(`/v1/projects/${QA}/database/query`,'POST',{query:`BEGIN READ ONLY; ${stateSql(gate)}; ROLLBACK;`,read_only:false}))[0];
 validateReadyState(state,gate,readJson(path.join(nativeDirectory,'native-qa-settings-before.local.json')),secrets);
 const advisors=await api(`/v1/projects/${QA}/advisors/security`);
 const snapshot={checkedAt:new Date().toISOString(),projectRef:QA,gate,state,sourceBaseline:baseline,securityAdvisors:advisors};
 fs.writeFileSync(path.join(directory,'qa-seven-eight-preflight.local.json'),JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});
 const prepared=buildQaSql(baseline,state,gate);
 fs.writeFileSync(path.join(directory,'qa-stage-seven-eight.local.sql'),prepared.sql,{mode:0o600});
 const report={preparedAt:snapshot.checkedAt,projectRef:QA,parentProjectRef:PROD,organizationId:ORG,branchId:BRANCH,executionAllowed:false,qaChanged:false,productionChanged:false,customerDataExported:false,
  nativeWorkerAndCleanupVerified:true,migrations:prepared.manifest,sqlSha256:sha(prepared.sql),sqlFile:'.family-qa/deletion-production-preparation-20261001/qa-stage-seven-eight.local.sql',
  initialJobsHistoryRowAbsent:true,existingFiveHistoryRowsPreserved:true,providerCheckpointPreserved:true,controlsPreserved:true,defaultMode:'unapproved',approvalsAndRetentionRemainNull:true,
  registryAckCreated:false,workerClaimPerformed:false,requiresRootApplyGate:true,requiresFreshPostApplySecurityComparison:true};
 fs.writeFileSync(path.join(outputDirectory,'qa-seven-eight-preparation-20261001.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({prepared:true,qaChanged:false,productionChanged:false,migrations:2,executionAllowed:false,sqlSha256:report.sqlSha256}));
}
if(require.main===module)main().catch(()=>{console.error('QA7/8 preparation refused: inspect native gate/target/source state; no changes or credentials logged');process.exitCode=1});
module.exports={QA,PROD,ORG,BRANCH,origin,oldSources,newSources,functions,validateIdentity,validateNativeGate,validateSourceBaseline,stateSql,validateReadyState,buildQaSql};
