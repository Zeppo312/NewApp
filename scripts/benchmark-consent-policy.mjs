process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
import fs from 'node:fs';
import {setup,asUser} from './tests/helpers/data-consent-fixture.mjs';
const db=await setup();
const rows=Number(process.env.BENCHMARK_ROWS || 5000);
if(!Number.isInteger(rows)||rows<110||rows>65000)throw Error('BENCHMARK_ROWS must be 110..65000');
await db.exec(`CREATE FUNCTION consent_private.require_live_user(uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'account_not_found'; END IF; END $$;`);
await db.exec(fs.readFileSync('supabase/migrations/20261003160141_data_consent_release_cohort.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261003164934_data_consent_self_service.sql','utf8'));
const live=JSON.parse(fs.readFileSync('output/profile-performance-20261005/performance-catalog.json')).data[0].catalog;
for(const table of ['baby_info','baby_members','sleep_entries','sleep_entry_shares','account_links']){
 const existing=(await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}'`)).rows.map(r=>r.column_name);
 for(const c of live.columns.filter(c=>c.table_name===table&&!existing.includes(c.column_name)))await db.exec(`ALTER TABLE public.${table} ADD COLUMN ${c.column_name} ${c.udt_name}`);
}
await db.exec(`INSERT INTO public.baby_info(id,user_id,created_at) SELECT md5('baby'||i)::uuid, CASE WHEN i=1 THEN '10000000-0000-4000-8000-000000000001'::uuid ELSE '10000000-0000-4000-8000-000000000002'::uuid END,now() FROM generate_series(1,68)i;
INSERT INTO public.baby_members(baby_id,user_id,role) SELECT id,user_id,'parent' FROM public.baby_info;
INSERT INTO public.sleep_entries(id,user_id,baby_id,start_time,end_time) SELECT md5('sleep'||i)::uuid, b.user_id,b.id,now()-i*interval '1 hour',now()-i*interval '1 hour'+interval '30 minutes' FROM generate_series(1,${rows})i JOIN public.baby_info b ON b.id=md5('baby'||(1+i%68))::uuid;
INSERT INTO public.sleep_entry_shares(id,entry_id,owner_id,shared_with_id) SELECT md5('share'||i)::uuid,md5('sleep'||i)::uuid,'10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001' FROM generate_series(100,110)i;`);
for(const i of live.indexes){try{await db.exec(i.indexdef);}catch(e){if(!e.message.includes('already exists'))throw e;}}
await db.exec(live.functions.join(';'));
const policies=JSON.parse(fs.readFileSync('output/profile-performance-20261005/policies.json')).data;
for(const table of ['baby_info','baby_members','sleep_entries','sleep_entry_shares']){
 await db.exec(`DROP POLICY fixture ON public.${table}`);
 for(const p of policies.filter(p=>p.tablename===table&&p.cmd==='SELECT'&&!p.policyname.startsWith('data_consent')&&!p.policyname.startsWith('account_deletion'))){await db.exec(`CREATE POLICY "${p.policyname}" ON public.${table} FOR SELECT TO ${p.roles.replace(/[{}]/g,'')} USING(${p.qual})`);}
}
await db.exec(`GRANT SELECT ON public.account_links TO authenticated; ANALYZE;`);
const qs={baby:`SELECT b.*,m.members FROM public.baby_info b INNER JOIN LATERAL (SELECT json_agg(m) AS members FROM (SELECT role FROM public.baby_members WHERE baby_id=b.id AND user_id='10000000-0000-4000-8000-000000000001' LIMIT 1000) m) m ON m.members IS NOT NULL ORDER BY b.created_at LIMIT 1000`,share:`SELECT se.*,ss.shares FROM public.sleep_entries se INNER JOIN LATERAL (SELECT json_agg(ss) AS shares FROM (SELECT shared_with_id FROM public.sleep_entry_shares WHERE entry_id=se.id AND shared_with_id='10000000-0000-4000-8000-000000000001' LIMIT 1000) ss) ss ON ss.shares IS NOT NULL ORDER BY se.start_time DESC LIMIT 1000`};
const results=[];
async function measure(label){await asUser(db);for(const [name,q]of Object.entries(qs)){const d=(await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+q)).rows;const plan=d[0]['QUERY PLAN'][0];fs.writeFileSync('output/profile-performance-20261005/final-bench-'+label+'-'+name+'.json',JSON.stringify(d,null,2));const r={stage:label,query:name,ms:plan['Execution Time'],returnedRows:plan.Plan['Actual Rows']};results.push(r);console.log(JSON.stringify(r));}await db.exec('RESET ROLE');}
await db.exec(`INSERT INTO consent_private.user_state(user_id,enforcement_started_at,client_release,installation_evidence) VALUES('10000000-0000-4000-8000-000000000002',now(),'synthetic','synthetic-benchmark'); INSERT INTO consent_private.decisions(user_id,scope,decision,document_version,decided_at) SELECT '10000000-0000-4000-8000-000000000002','health','granted','2026-10-01.1',now();`);
await measure('before');
const migrationPath='supabase/migrations/20261005191027_optimize_consent_policy_evaluation.sql';
const migration=fs.readFileSync(migrationPath,'utf8');
await db.exec(migration);
await measure('after');
for(const name of Object.keys(qs)){
 const before=results.find(r=>r.stage==='before'&&r.query===name),after=results.find(r=>r.stage==='after'&&r.query===name);
 if(before.returnedRows!==after.returnedRows)throw Error('Results changed for '+name);
}
const crypto=await import('node:crypto');
fs.writeFileSync('output/profile-performance-20261005/final-benchmark.json',JSON.stringify({capturedAt:new Date().toISOString(),engine:'PGlite 0.3.14; synthetic data; not production latency',rows,babies:68,migrationPath,migrationSha256:crypto.createHash('sha256').update(migration).digest('hex'),results},null,2));
await db.close();
