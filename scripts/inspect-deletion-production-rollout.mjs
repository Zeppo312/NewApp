// Read-only production preflight. No deploy, DDL, secret mutation, worker or send path.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD = 'kwniiyayhzgjfqjsjcfu', QA = 'ggyonianphloycmqrwvj', ORG = 'xqbmotyjxjdeqoisbgow';
assert.equal(process.argv.length, 2, 'This read-only preflight accepts no arguments');
process.umask(0o077);
const run = new Date().toISOString().replace(/[:.]/g, '-');
const privateDir = path.join(root, '.family-qa/deletion-production-rollout-20261002', run);
const publicDir = path.join(root, 'output/deletion-production-rollout-20261002', run);
fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(publicDir, { recursive: true });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name)] : []);
const save = (name, data) => fs.writeFileSync(path.join(privateDir, name), JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
const publicSave = (name, data) => fs.writeFileSync(path.join(publicDir, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const relative = file => path.relative(root, file);
const originalFiles = walk(path.join(root, 'output/deletion-completion-20260930')).map(file => ({ file: relative(file), sha256: sha(fs.readFileSync(file)) }));
const registry = '/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/durable-writer-20261001/deletion-registry-v1.json';
const registryBefore = sha(fs.readFileSync(registry));
save('original-evidence-hashes.local.json', { files: originalFiles, registry, registrySha256: registryBefore });
let token = execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
if (token.startsWith('go-keyring-base64:')) token = Buffer.from(token.slice(18), 'base64').toString('utf8');
assert(token.startsWith('sbp_'), 'Existing CLI credential unavailable');
async function api(endpoint, method = 'GET', body) {
  assert(method === 'GET' || (method === 'POST' && endpoint.endsWith('/database/query') && body.read_only === true), 'Read-only operation required');
  const res = await fetch('https://api.supabase.com' + endpoint, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw Error(`Read-only Management API ${endpoint}: HTTP ${res.status}`);
  return res.json();
}
const sql = (ref, query) => api(`/v1/projects/${ref}/database/query`, 'POST', { query: `BEGIN READ ONLY; SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='15s'; ${query}; ROLLBACK;`, read_only: true });
const project = await api(`/v1/projects/${PROD}`);
assert.equal(project.id, PROD); assert.equal(project.organization_id, ORG); assert.equal(project.region, 'eu-central-1'); assert.equal(project.status, 'ACTIVE_HEALTHY');
save('project-before.local.json', project);
console.log(JSON.stringify({ phase: 'target_verified', projectRef: PROD, organizationId: ORG, status: project.status, privateBackup: relative(privateDir) }));

const catalogSql = `SELECT jsonb_build_object(
 'database',current_database(),'server_version',current_setting('server_version'),
 'schemas',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl) ORDER BY n.nspname) FROM pg_namespace n WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage')),
 'relations',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'options',c.reloptions,'persistence',c.relpersistence,'partition',CASE WHEN c.relispartition THEN pg_get_expr(c.relpartbound,c.oid) END) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage') AND c.relkind IN ('r','p','v','m','S')),
 'columns',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'ordinal',a.attnum,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,'collation',a.attcollation,'acl',a.attacl,'storage',a.attstorage) ORDER BY n.nspname,c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage') AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,false),'type',k.contype,'validated',k.convalidated,'delete_action',k.confdeltype,'referenced_schema',rn.nspname,'referenced_table',rc.relname) ORDER BY n.nspname,c.relname,k.conname) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace LEFT JOIN pg_class c ON c.oid=k.conrelid LEFT JOIN pg_class rc ON rc.oid=k.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rc.relnamespace WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage')),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready) ORDER BY n.nspname,c.relname,i.indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage')),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig,'security_definer',p.prosecdef) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage') AND p.prokind IN ('f','p')),
 'policies',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',p.polname,'permissive',p.polpermissive,'command',p.polcmd,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY n.nspname,c.relname,p.polname) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled,'internal',t.tgisinternal) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage')),
 'views',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'definition',pg_get_viewdef(c.oid,false)) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','caretaker_private','consent_private','deletion_private','auth','storage') AND c.relkind IN ('v','m')),
 'role_config',(SELECT jsonb_agg(jsonb_build_object('role',rolname,'config',rolconfig) ORDER BY rolname) FROM pg_roles WHERE rolname IN ('authenticator','anon','authenticated','service_role','postgres')),
 'database_role_config',(SELECT jsonb_agg(to_jsonb(s) ORDER BY setdatabase,setrole) FROM pg_db_role_setting s),
 'default_acl',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d),
 'extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion) ORDER BY extname) FROM pg_extension),
 'migration_history',(SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM supabase_migrations.schema_migrations m)
) AS catalog`;
const baseline = (await sql(PROD, catalogSql))[0].catalog;
save('catalog-ddl-acl-before.local.json', baseline);
const functionsBefore = await api(`/v1/projects/${PROD}/functions`);
save('functions-config-before.local.json', functionsBefore);
const secretsBefore = await api(`/v1/projects/${PROD}/secrets`);
save('secret-metadata-before.local.json', secretsBefore);
const authConfig = await api(`/v1/projects/${PROD}/config/auth`);
save('auth-hook-config-before.local.json', authConfig);
const cron = await sql(PROD, 'SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY jobid),\'[]\'::jsonb) AS jobs FROM cron.job j');
save('scheduler-before.local.json', cron);
for (const type of ['security','performance']) {
  save(`advisors-${type}-before.local.json`, await api(`/v1/projects/${PROD}/advisors/${type}`));
}
const prep = path.join(root, '.family-qa/deletion-production-preparation-20261001');
const old = JSON.parse(fs.readFileSync(path.join(prep,'fresh-baseline.local.json')));
const oldManifest = JSON.parse(fs.readFileSync(path.join(prep,'guard-candidate-manifest.local.json')));
const prepared = JSON.parse(fs.readFileSync(path.join(root,'output/deletion-completion-20260930/production-rollout-prepared-20261001.json')));
const sourceHashes = prepared.migrations.map(m => ({...m,currentSha256:sha(fs.readFileSync(path.join(root,m.file)))}));
// Resolve optional historical labels against the fresh inventory; only actual
// deployed slugs may be downloaded. The eleven affected slugs are mandatory.
const slugs = [...oldManifest.map(m=>m.slug),'advisor-daily','moderation-report-notify','revoke-apple-sign-in'].filter(slug=>functionsBefore.some(f=>f.slug===slug));
const downloads = [];
for (const [ref,slug,kind] of [...slugs.map(slug=>[PROD,slug,'production']), ...['request-account-deletion','process-account-deletion','account-deletion-alert'].map(slug=>[QA,slug,'qa-source-reference'])]) {
  const dir = path.join(privateDir,kind,slug); fs.mkdirSync(dir,{recursive:true,mode:0o700});
  let status = 'saved';
  try {
    execFileSync('supabase',['functions','download',slug,'--project-ref',ref,'--use-api','--workdir',dir],{cwd:root,env:{...process.env,SUPABASE_ACCESS_TOKEN:token},stdio:['ignore','pipe','pipe'],timeout:60000});
  } catch (error) { status = 'download_failed'; save(`${kind}-${slug}-download-error.local.json`, {status: error.status,stderrSha256:sha(error.stderr??Buffer.from(''))}); }
  const src = path.join(dir,'supabase/functions');
  const files = fs.existsSync(src) ? walk(src).map(file=>({file:path.relative(dir,file),sha256:sha(fs.readFileSync(file))})) : [];
  downloads.push({ref,slug,kind,status,files});
  console.log(JSON.stringify({phase:'isolated_source_backup',kind,slug,status,files:files.length}));
}
save('download-source-manifest.local.json', downloads);
const functionComparison = oldManifest.map(m=>{
  const live=downloads.find(d=>d.ref===PROD&&d.slug===m.slug);
  const before=m.files.filter(f=>f.file.startsWith('supabase/functions/')&&f.beforeSha256!==null);
  const drift=before.flatMap(f=>{const now=live.files.find(x=>x.file===f.file);return now?.sha256===f.beforeSha256?[]:[{file:f.file,preparedBaseSha256:f.beforeSha256,currentSha256:now?.sha256??null}];});
  const added=live.files.filter(f=>!before.some(x=>x.file===f.file));
  const prior=old.functions.find(x=>x.slug===m.slug),current=functionsBefore.find(x=>x.slug===m.slug);
  return {slug:m.slug,sourceDrift:drift,additionalCurrentFiles:added,oldVersion:prior?.version,currentVersion:current?.version,verifyJwtBefore:prior?.verify_jwt,verifyJwtCurrent:current?.verify_jwt};
});
const newFunctionComparison=prepared.newFunctions.map(m=>{
  const live=downloads.find(d=>d.ref===QA&&d.slug===m.slug);
  return {slug:m.slug,status:live.status,sourceDrift:m.sources.flatMap(f=>{const qa=live.files.find(x=>x.file===f.file);const local=sha(fs.readFileSync(path.join(root,f.file)));return qa?.sha256===f.sha256&&local===f.sha256?[]:[{file:f.file,preparedSha256:f.sha256,currentQaSha256:qa?.sha256??null,currentRootSha256:local}];}),additionalCurrentFiles:live.files.filter(f=>!m.sources.some(x=>x.file===f.file))};
});
const consentTables=baseline.relations.filter(x=>x.schema==='consent_private'&&['r','p'].includes(x.kind)).map(t=>({table:t.table,userColumns:baseline.columns.filter(c=>c.schema===t.schema&&c.table===t.table&&c.column==='user_id').map(c=>({column:c.column,type:c.type,notNull:c.not_null})),constraints:baseline.constraints.filter(c=>c.schema===t.schema&&c.table===t.table),rls:t.rls,accountDeletionGuard:baseline.triggers.some(g=>g.schema===t.schema&&g.table===t.table&&g.name==='account_deletion_guard'),accountDeletionPolicy:baseline.policies.some(p=>p.schema===t.schema&&p.table===t.table&&p.name==='account_deletion_deny')}));
const legacy=baseline.functions.find(f=>f.schema==='public'&&f.name==='delete_user_data'&&f.identity==='delete_auth boolean');
const guardTargets=baseline.relations.filter(c=>c.kind==='r'&&(['public','caretaker_private'].includes(c.schema)||(c.schema==='storage'&&c.table==='objects'))).length;
const secretNames=secretsBefore.map(x=>x.name);
const enabled=secretsBefore.find(x=>x.name==='ACCOUNT_DELETION_ENABLED');
const advisorLive=downloads.find(d=>d.ref===PROD&&d.slug==='advisor-generate');
const advisorAiFile=path.join(privateDir,'production/advisor-generate/supabase/functions/advisor-generate/advisorAi.ts');
const advisorAi=fs.existsSync(advisorAiFile)?fs.readFileSync(advisorAiFile,'utf8'):'';
const blockers=[];
if(consentTables.some(t=>t.userColumns.length)) blockers.push({code:'unmapped_consent_private_schema',tables:consentTables.filter(t=>t.userColumns.length).map(t=>t.table),reason:'Four user relations are omitted from the eight-source rule inventory, write/policy guard loop and fingerprint. Account CASCADE does not establish data-reset coverage or consent evidence retention.'});
if(functionComparison.some(x=>x.sourceDrift.length||x.additionalCurrentFiles.length)) blockers.push({code:'current_production_function_source_drift',slugs:functionComparison.filter(x=>x.sourceDrift.length||x.additionalCurrentFiles.length).map(x=>x.slug)});
if(newFunctionComparison.some(x=>x.status!=='saved'||x.sourceDrift.length||x.additionalCurrentFiles.length)) blockers.push({code:'qa_reference_source_drift'});
if(sourceHashes.some(x=>x.currentSha256!==x.sha256)) blockers.push({code:'migration_source_drift'});
if(legacy?.definition!==old.baseline.legacy_function.definition) blockers.push({code:'legacy_rpc_drift'});
if(guardTargets!==old.baseline.guard_target_tables) blockers.push({code:'guard_target_count_drift'});
if(oldManifest.some(m=>!downloads.some(x=>x.ref===PROD&&x.slug===m.slug&&x.status==='saved'))) blockers.push({code:'incomplete_required_function_source_backup'});
const currentHook=baseline.role_config.find(x=>x.role==='authenticator')?.config?.filter(x=>x.startsWith('pgrst.db_pre_request='))??[];
if(currentHook.length) blockers.push({code:'existing_pre_request_hook_requires_composition'});
const versions=prepared.migrations.map(x=>x.version);
const deletionHistory=baseline.migration_history.filter(x=>versions.includes(x.version));
if(baseline.schemas.some(x=>x.schema==='deletion_private')||deletionHistory.length) blockers.push({code:'partial_or_existing_deletion_deployment'});

const afterCatalog=(await sql(PROD,catalogSql))[0].catalog; save('catalog-ddl-acl-after.local.json',afterCatalog);
const afterFunctions=await api(`/v1/projects/${PROD}/functions`);save('functions-config-after.local.json',afterFunctions);
const afterSecrets=await api(`/v1/projects/${PROD}/secrets`);save('secret-metadata-after.local.json',afterSecrets);
const afterCron=await sql(PROD,'SELECT coalesce(jsonb_agg(to_jsonb(j) ORDER BY jobid),\'[]\'::jsonb) AS jobs FROM cron.job j');save('scheduler-after.local.json',afterCron);
const projectAfter=await api(`/v1/projects/${PROD}`);save('project-after.local.json',projectAfter);
const preservation={originalEvidenceFiles:originalFiles.length,originalEvidenceUnchanged:originalFiles.every(x=>sha(fs.readFileSync(path.join(root,x.file)))===x.sha256),independentRegistryUnchanged:sha(fs.readFileSync(registry))===registryBefore,catalogUnchanged:sha(JSON.stringify(baseline))===sha(JSON.stringify(afterCatalog)),functionMetadataUnchanged:sha(JSON.stringify(functionsBefore))===sha(JSON.stringify(afterFunctions)),secretMetadataUnchanged:sha(JSON.stringify(secretsBefore))===sha(JSON.stringify(afterSecrets)),schedulersUnchanged:sha(JSON.stringify(cron))===sha(JSON.stringify(afterCron))};
save('preservation-after.local.json',preservation);
const report={checkedAt:new Date().toISOString(),runId:run,projectRef:PROD,organizationId:ORG,region:project.region,projectStatusBefore:project.status,projectStatusAfter:projectAfter.status,
 status:blockers.length?'aborted_before_any_production_mutation':'read_only_preflight_complete',productionChanged:false,ddlApplied:0,functionsDeployed:0,secretsChanged:0,customerDeletionPerformed:false,workerClaimPerformed:false,messagesSent:0,noCompletedQaTestsRepeated:true,
 privateBackup:relative(privateDir),blockers,guardTargets,preparedGuardTargets:old.baseline.guard_target_tables,consentTables,sourceHashes,functionComparison,newFunctionComparison,
 deletionSchemaPresent:baseline.schemas.some(x=>x.schema==='deletion_private'),deletionMigrationRows:deletionHistory.length,deletionFunctionsPresent:functionsBefore.filter(x=>['request-account-deletion','process-account-deletion','account-deletion-alert'].includes(x.slug)).map(x=>x.slug),
 enabledSecretPresent:!!enabled,enabledSecretDigestEqualsFalse:enabled?.value===sha('false')||enabled?.digest===sha('false'),effectiveNewDeletionDeploymentActive:false,productionReadinessRpcPresent:baseline.functions.some(x=>x.schema==='public'&&x.name==='account_deletion_readiness'),providerModeAndApproval:'unset_schema_absent',preRequestHook:currentHook,
 deletionSchedulers:cron[0].jobs.filter(x=>/account.?deletion|process-account-deletion|deletion-alarm/i.test(x.jobname+' '+x.command)).map(x=>({jobId:x.jobid,name:x.jobname,active:x.active})),
 secretNamesForDeletion:secretNames.filter(x=>/^ACCOUNT_DELETION|^REVENUECAT.*DELETION|^SMTP/.test(x)),advisorGenerateStoreFalsePresent:/store\s*:\s*false/.test(advisorAi),advisorGenerateFiles:advisorLive.files.length,preservation,
 activationPrerequisites:['current consent table reset/block/retention mapping and complete inventory fingerprint','fresh isolated service-role function candidate endpoint verification','protected independent production registry writer and credential supply','production SMTP and separate RevenueCat deletion permission','actual production alarm receipt and recovery evidence','named dated inventory and operating-mode approval','separate explicit activation instruction'],
 qaProviderCase:'unchanged_by_this_read_only_production_preflight; existing ten pending cases and unknown copies remain separate',documentsRead:['docs/privacy/deletion-next-steps-20261001.md','docs/privacy/deletion-provider-closure-20261001.md','docs/privacy/deletion-production-rollout-20261001.md','docs/privacy/deletion-supervised-provider-mode-20261001.md','docs/privacy/deletion-provider-actions-20261001.md','output/deletion-completion-20260930/implementation.json']};
publicSave('preflight.json',report);
save('private-backup-file-manifest.local.json',walk(privateDir).map(file=>({file:path.relative(privateDir,file),sha256:sha(fs.readFileSync(file)),mode:(fs.statSync(file).mode&0o777).toString(8)})));
console.log(JSON.stringify({phase:'preflight_complete',status:report.status,blockers,projectStatus:projectAfter.status,productionChanged:false,preservation,report:relative(path.join(publicDir,'preflight.json'))}));
