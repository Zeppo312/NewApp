// Isolated additive records deployment. Never deploys current app/Edge sources,
// installs production enforcement, enables processing or runs a blanket push.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PROD='kwniiyayhzgjfqjsjcfu',QA='ggyonianphloycmqrwvj',ORG='xqbmotyjxjdeqoisbgow';
const corePath='supabase/migrations/20261001170732_data_consent_records.sql';
const enforcementPath='supabase/migrations/20261001170812_data_consent_enforcement.sql';
const output=path.join(root,'output/consent-implementation-20261001');
const mode=process.argv[2];
assert(['inspect','qa-schema-test','stage-records','verify-records'].includes(mode),'Use inspect, qa-schema-test, stage-records or verify-records');
let token=execFileSync('/usr/bin/security',['find-generic-password','-s','Supabase CLI','-a','supabase','-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
if(token.startsWith('go-keyring-base64:'))token=Buffer.from(token.slice(18),'base64').toString('utf8');
assert(token.startsWith('sbp_'),'Existing management credential required');
async function api(endpoint,method='GET',body) {
 const response=await fetch('https://api.supabase.com'+endpoint,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`Management request failed: HTTP ${response.status}`);
 return response.json();
}
const sql=(ref,query,read_only=false)=>api(`/v1/projects/${ref}/database/query`,'POST',{query,read_only});
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function body(source){assert(/^BEGIN;$/m.test(source)&&/COMMIT;\s*$/.test(source));return source.replace(/^BEGIN;$/m,'').replace(/COMMIT;\s*$/,'');}
const fingerprint=`SELECT md5(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl,p.proowner) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname NOT IN('get_data_consents','record_data_consent','check_data_processing_consent')),
 'tables',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relrowsecurity,c.relacl,c.relowner) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'hook',(SELECT rolconfig FROM pg_roles WHERE rolname='authenticator'))::text) AS hash`;
const baseline=ref=>sql(ref,`SELECT to_regnamespace('consent_private') IS NOT NULL schema_present,
 (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('get_data_consents','record_data_consent','check_data_processing_consent')) collisions,
 (SELECT rolconfig FROM pg_roles WHERE rolname='authenticator') hook,
 (SELECT count(*)::int FROM supabase_migrations.schema_migrations WHERE version='20261001170732') migration_present`,true);
function save(name,data){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+'\n');}
const project=await api(`/v1/projects/${PROD}`);
assert.equal(project.id,PROD);assert.equal(project.organization_id,ORG);assert.equal(project.region,'eu-central-1');assert.equal(project.status,'ACTIVE_HEALTHY');
const core=fs.readFileSync(path.join(root,corePath),'utf8');const enforcement=fs.readFileSync(path.join(root,enforcementPath),'utf8');
if(mode==='inspect') {
 const state=(await baseline(PROD))[0];const hash=(await sql(PROD,fingerprint,true))[0].hash;
 const report={checkedAt:new Date().toISOString(),projectRef:PROD,organizationId:ORG,...state,existingPublicObjectsHash:hash,coreSha256:sha(core),changesApplied:false};save('production-baseline.json',report);console.log(JSON.stringify(report));
}
if(mode==='qa-schema-test') {
 const branches=await api(`/v1/projects/${PROD}/branches`);const branch=branches.find(b=>b.project_ref===QA);
 assert(branch&&branch.parent_project_ref===PROD&&branch.name==='family-subscription-qa'&&!branch.is_default,'Existing isolated QA required');
 assert.equal((await baseline(QA))[0].schema_present,false,'Clean consent QA baseline required');
 const before=(await sql(QA,fingerprint,true))[0].hash;
 const user=crypto.randomUUID();const operation=crypto.randomUUID();
 const query=`BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';
 ${body(core)} ${body(enforcement)}
 INSERT INTO auth.users(id) VALUES(${quote(user)});
 UPDATE consent_private.settings SET client_release='transactional-schema-test',edge_release='transactional-schema-test',approved_at=now(),enabled=true;
 SELECT set_config('request.jwt.claim.sub',${quote(user)},true),set_config('request.jwt.claims','{"role":"authenticated"}',true),set_config('request.path','/rpc/get_data_consents',true);
 SET LOCAL ROLE authenticated;
 SELECT public.check_account_deletion_access();
 DO $test$ DECLARE s jsonb; BEGIN
  s := public.get_data_consents();
  IF s->'health'<>'null'::jsonb OR (s->>'healthAllowed')::boolean THEN RAISE EXCEPTION 'initial_consent_was_assumed'; END IF;
  s := public.record_data_consent('health','granted','2026-10-01.1','de',${quote(operation)},0);
  IF NOT (s->>'healthAllowed')::boolean OR (s->>'aiAllowed')::boolean OR s->>'revision'<>'1' THEN RAISE EXCEPTION 'explicit_consent_failed'; END IF;
  s := public.record_data_consent('health','revoked','2026-10-01.1','de',${quote(crypto.randomUUID())},1);
  IF (s->>'healthAllowed')::boolean OR s->'health'->>'decision'<>'revoked' THEN RAISE EXCEPTION 'withdrawal_failed'; END IF;
 END $test$;
 RESET ROLE;
 SELECT set_config('request.jwt.claims','{"role":"service_role"}',true),set_config('request.path','/rpc/check_data_processing_consent',true);
 SET LOCAL ROLE service_role;
 SELECT public.check_account_deletion_access();
 RESET ROLE;
 SELECT true AS verified, (SELECT count(*)::int FROM consent_private.events) synthetic_events;
 ROLLBACK;`;
 // The result is restricted to synthetic consent status, never existing records.
 const result=await sql(QA,query);
 const after=(await sql(QA,fingerprint,true))[0].hash;assert.equal(after,before);
 assert.equal((await baseline(QA))[0].schema_present,false);
 const report={checkedAt:new Date().toISOString(),projectRef:QA,coreSha256:sha(core),enforcementSha256:sha(enforcement),
  exactLiveSchemaAccepted:true,canonicalDeletionHookComposed:true,rolledBack:true,existingPublicObjectsUnchanged:true,productionChanged:false,result};
 save('qa-schema-test.json',report);console.log(JSON.stringify({...report,result:undefined}));
}
if(mode==='stage-records') {
 const proof=JSON.parse(fs.readFileSync(path.join(output,'verification.json'),'utf8'));
 assert.equal(proof.passed,true,'Bound local verification required');assert.equal(proof.coreSha256,sha(core));
 const before=(await baseline(PROD))[0];assert.equal(before.schema_present,false);assert.equal(before.collisions,0);assert.equal(before.migration_present,0);
 const hash=(await sql(PROD,fingerprint,true))[0].hash;
 const query=`BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'; SELECT pg_advisory_xact_lock(hashtextextended('lottibaby-consent-records-staging',0));
 DO $guard$ BEGIN
  IF to_regnamespace('consent_private') IS NOT NULL OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261001170732') THEN RAISE EXCEPTION 'consent_stage_already_present'; END IF;
  IF (${fingerprint}) IS DISTINCT FROM ${quote(hash)} THEN RAISE EXCEPTION 'existing_public_objects_changed'; END IF;
 END $guard$;
 ${body(core)}
 INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261001170732','data_consent_records',ARRAY[${quote(core)}]);
 DO $verify$ BEGIN
  IF EXISTS(SELECT 1 FROM consent_private.settings WHERE enabled OR activated_at IS NOT NULL)
    OR EXISTS(SELECT 1 FROM consent_private.decisions) OR EXISTS(SELECT 1 FROM consent_private.events)
    OR (${fingerprint}) IS DISTINCT FROM ${quote(hash)} THEN RAISE EXCEPTION 'consent_stage_invariant_failed'; END IF;
 END $verify$;
 NOTIFY pgrst,'reload schema'; COMMIT;`;
 await sql(PROD,query);
 const after=(await sql(PROD,fingerprint,true))[0].hash;assert.equal(after,hash);
 const report={checkedAt:new Date().toISOString(),projectRef:PROD,organizationId:ORG,coreSha256:sha(core),migrationVersion:'20261001170732',
  recordsOnly:true,enforcementInstalled:false,processingEnabled:false,existingPublicObjectsUnchanged:true,beforeHash:hash,afterHash:after,appPublished:false,edgeFunctionsDeployed:false};
 save('production-records-staged.json',report);console.log(JSON.stringify(report));
}
if(mode==='verify-records') {
 const staged=JSON.parse(fs.readFileSync(path.join(output,'production-records-staged.json'),'utf8'));
 const rows=await sql(PROD,`SELECT (SELECT enabled FROM consent_private.settings WHERE singleton) enabled,
   (SELECT activated_at FROM consent_private.settings WHERE singleton) activated_at,
   (SELECT count(*)::int FROM consent_private.decisions) decisions,(SELECT count(*)::int FROM consent_private.events) events,
   (SELECT count(*)::int FROM pg_tables WHERE schemaname='consent_private' AND NOT rowsecurity) tables_without_rls,
   (SELECT count(*)::int FROM information_schema.role_table_grants WHERE table_schema='consent_private' AND grantee IN('anon','authenticated','service_role')) client_table_grants,
   (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('get_data_consents','record_data_consent','check_data_processing_consent') AND p.prosecdef) public_definers,
   (SELECT count(*)::int FROM supabase_migrations.schema_migrations WHERE version='20261001170732') history_rows,
   to_regprocedure('public.check_data_consent_access()') IS NOT NULL enforcement_hook_present`,true);
 const state=rows[0];assert.equal(state.enabled,false);assert.equal(state.activated_at,null);assert.equal(state.decisions,0);assert.equal(state.events,0);assert.equal(state.tables_without_rls,0);assert.equal(state.client_table_grants,0);assert.equal(state.public_definers,0);assert.equal(state.history_rows,1);assert.equal(state.enforcement_hook_present,false);
 const hash=(await sql(PROD,fingerprint,true))[0].hash;assert.equal(hash,staged.beforeHash);
 const report={checkedAt:new Date().toISOString(),projectRef:PROD,...state,existingPublicObjectsUnchanged:true,existingPublicObjectsHash:hash};save('production-records-verified.json',report);console.log(JSON.stringify(report));
}
