// Local candidate builder only. Preserves the original eight sources/artifacts.
// No network access, SQL execution, deployment, approval, or activation command.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {buildSql:buildEight,stripTransaction}=require('./prepare-deletion-production-rollout.cjs');
const {consentCatalogExpression}=require('./deletion-consent-catalog.cjs');
const root=path.resolve(__dirname,'..');
const migration='supabase/migrations/20261002084629_account_deletion_consent_inventory.sql';
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const fullCatalogQuery=fs.readFileSync(path.join(root,'scripts/inspect-deletion-production-rollout.mjs'),'utf8').match(/const catalogSql = `([\s\S]*?)`;/)[1];
const fullCatalogExpression=fullCatalogQuery.slice('SELECT '.length).replace(/ AS catalog$/,'');
function validateConsent(consent) {
 assert.match(consent.digest,/^[a-f0-9]{32}$/);
 assert.deepEqual(consent.catalog.tables.map(t=>t.name).sort(),['decisions','documents','events','operations','settings','user_state']);
 assert(consent.catalog.tables.every(t=>t.rls&&t.kind==='r'&&t.owner==='postgres'),'Consent table/owner/RLS drift');
 const writers=consent.catalog.functions.filter(f=>/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+consent_private\.(user_state|decisions|operations|events)\b/i.test(f.definition));
 assert.equal(writers.length,1,'Additional consent writer requires review');
 assert.equal(writers[0].name,'record_decision');
 // A fresh body is not automatically an approved overwrite source. Require the
 // exact originally implemented bodies for every function replaced here.
 const core=fs.readFileSync(path.join(root,'supabase/migrations/20261001170732_data_consent_records.sql'),'utf8');
 for(const name of ['record_decision','own_snapshot','processing_allowed']){
  const start=core.indexOf('CREATE FUNCTION consent_private.'+name+'(');
  const body=core.slice(start).match(/AS \$\$([\s\S]*?)\$\$/)[1].trim();
  const actual=consent.catalog.functions.find(f=>f.schema==='consent_private'&&f.name===name);
  assert(actual&&actual.owner==='postgres'&&actual.security_definer,'Consent writer/reader ownership drift');
  assert.equal(actual.definition.match(/AS \$([a-z]*)\$([\s\S]*?)\$\1\$/)[2].trim(),body,'Unreviewed consent body drift: '+name);
 }
 for(const name of ['user_state','decisions','operations','events']) {
  assert(consent.catalog.constraints.some(c=>c.table===name&&/FOREIGN KEY \(user_id\) REFERENCES auth.users\(id\) ON DELETE CASCADE/.test(c.definition)),'Missing consent Auth cascade: '+name);
 }
}
function buildSql(snapshot,consent) {
 validateConsent(consent);
 assert.match(snapshot.fullCatalogDigest,/^[a-f0-9]{32}$/,'Fresh full-catalog binding required');
 const {sql:original,manifests}=buildEight(snapshot);
 const source=fs.readFileSync(path.join(root,migration),'utf8');
 const version=path.basename(migration).slice(0,14),name=path.basename(migration).slice(15,-4);
 const gate=`DO $consent_preflight$ BEGIN
 IF md5((${fullCatalogExpression})::text) IS DISTINCT FROM ${quote(snapshot.fullCatalogDigest)} THEN RAISE EXCEPTION 'production_catalog_changed'; END IF;
 IF md5((${consentCatalogExpression})::text) IS DISTINCT FROM ${quote(consent.digest)} THEN RAISE EXCEPTION 'consent_catalog_changed'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)}) THEN RAISE EXCEPTION 'consent_deletion_history_already_present'; END IF;
END $consent_preflight$;\n`;
 const extension=`\n-- Additive consent migration; original eight remain exact. sha256 ${sha(source)}\n${stripTransaction(source)}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(version)},${quote(name)},ARRAY[${quote(source)}]::text[]);\n`;
 let sql=original.replace('DO $guard$ BEGIN',gate+'DO $guard$ BEGIN');
 sql=sql.replace("ALTER ROLE authenticator SET pgrst.db_pre_request=",()=>extension+"ALTER ROLE authenticator SET pgrst.db_pre_request=");
 sql=sql.replaceAll(`<>${snapshot.baseline.guard_target_tables} THEN`,`<>${snapshot.baseline.guard_target_tables+4} THEN`);
 // The old verification line has two counts joined by OR.
 sql=sql.replaceAll(`<>${snapshot.baseline.guard_target_tables} OR`,`<>${snapshot.baseline.guard_target_tables+4} OR`);
 sql=sql.replace('<>136 THEN','<>140 THEN');
 sql=sql.replace(/COMMIT;\s*$/,`DO $consent_verify$ BEGIN
 IF EXISTS(SELECT 1 FROM deletion_private.settings WHERE consent_handling_policy<>'unapproved' OR consent_policy_approved_by IS NOT NULL OR consent_policy_approved_at IS NOT NULL) THEN RAISE EXCEPTION 'consent_policy_unexpected_approval'; END IF;
 IF (SELECT count(*) FROM deletion_private.rules WHERE schema_name='consent_private')<>4 THEN RAISE EXCEPTION 'consent_rule_count'; END IF;
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='consent_private' AND t.tgname='account_deletion_guard' AND t.tgenabled='O')<>4 THEN RAISE EXCEPTION 'consent_guard_count'; END IF;
 IF position('require_live_user(uid)' in pg_get_functiondef('consent_private.record_decision(text,text,text,text,uuid,bigint)'::regprocedure))=0 THEN RAISE EXCEPTION 'consent_writer_guard_missing'; END IF;
 IF has_function_privilege('anon','public.record_data_consent(text,text,text,text,uuid,bigint)','EXECUTE') OR has_function_privilege('service_role','public.record_data_consent(text,text,text,text,uuid,bigint)','EXECUTE') OR NOT has_function_privilege('authenticated','public.record_data_consent(text,text,text,text,uuid,bigint)','EXECUTE') THEN RAISE EXCEPTION 'consent_rpc_acl_changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated'),('service_role')) roles(name) WHERE n.nspname='consent_private' AND c.relkind='r' AND has_table_privilege(roles.name,c.oid,'INSERT,UPDATE,DELETE')) THEN RAISE EXCEPTION 'consent_table_write_exposed'; END IF;
END $consent_verify$;
COMMIT;`);
 return {sql,manifests:[...manifests,{file:migration,version,sha256:sha(source)}],guardTargetTables:snapshot.baseline.guard_target_tables+4};
}
function main() {
 const args=process.argv.slice(2);
 assert.equal(args.length,1,'Pass only the fresh read-only inspection directory; no apply/enable command');
 const privateInput=path.resolve(args[0]);
 assert(privateInput.startsWith(path.join(root,'.family-qa/deletion-consent-inventory-20261002')+path.sep));
 const consent=JSON.parse(fs.readFileSync(path.join(privateInput,'consent-catalog-before.local.json'),'utf8'));
 const full=JSON.parse(fs.readFileSync(path.join(privateInput,'production-catalog-before.local.json'),'utf8'));
 const run=path.basename(privateInput);
 const live=JSON.parse(fs.readFileSync(path.join(root,'output/deletion-consent-inventory-20261002',run,'live-read.json'),'utf8'));
 assert(Object.values(live.preservation).every(Boolean));
 const old=JSON.parse(fs.readFileSync(path.join(root,'.family-qa/deletion-production-preparation-20261001/fresh-baseline.local.json'),'utf8'));
 const legacy=full.functions.find(f=>f.schema==='public'&&f.name==='delete_user_data'&&f.identity==='delete_auth boolean');
 assert.equal(legacy.definition,old.baseline.legacy_function.definition,'Unreviewed legacy drift');
 const snapshot=structuredClone(old);
 snapshot.checkedAt=live.checkedAt;
 snapshot.fullCatalogDigest=live.fullCatalogDigest;
 snapshot.baseline.legacy_function=legacy;
 snapshot.baseline.guard_target_tables=full.relations.filter(c=>c.kind==='r'&&(['public','caretaker_private'].includes(c.schema)||c.schema==='storage'&&c.table==='objects')).length;
 assert.equal(snapshot.baseline.guard_target_tables,old.baseline.guard_target_tables,'Unreviewed non-consent target drift');
 const candidate=buildSql(snapshot,consent);
 const out=path.join(privateInput,'candidate');fs.mkdirSync(out,{mode:0o700});
 fs.writeFileSync(path.join(out,'stage-nine-migrations.local.sql'),candidate.sql,{mode:0o600,flag:'wx'});
 const prep=path.join(root,'.family-qa/deletion-production-preparation-20261001');
 const bundles=JSON.parse(fs.readFileSync(path.join(prep,'guard-candidate-manifest.local.json'),'utf8'));
 fs.copyFileSync(path.join(prep,'guard-candidate-manifest.local.json'),path.join(out,'prior-function-manifest.local.json'),fs.constants.COPYFILE_EXCL);
 const report={preparedAt:new Date().toISOString(),baselineReadAt:live.checkedAt,projectRef:live.projectRef,stageOnly:true,executionAllowed:false,productionChanged:false,activationAllowed:false,sqlFile:path.relative(root,path.join(out,'stage-nine-migrations.local.sql')),sqlSha256:sha(candidate.sql),migrations:candidate.manifests,guardTargetTables:candidate.guardTargetTables,rules:140,consentCatalogDigest:consent.digest,consentHandlingPolicy:'unapproved',proposedPolicy:'reset_reconsent_erase_evidence',globalConsentSettingsAndDocumentsPreserved:true,consentRetentionDays:null,additionalFunctionUploadRequiredForConsent:false,priorFunctionManifestSha256:sha(JSON.stringify(bundles)),requiresFreshTargetCatalogAndAllFunctionBundlesBeforeDeployment:true,requiresExplicitNewDeploymentOrder:true};
 fs.writeFileSync(path.join(root,'output/deletion-consent-inventory-20261002',run,'candidate.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(report));
}
if(require.main===module)main();
module.exports={buildSql,validateConsent,migration,fullCatalogExpression};
