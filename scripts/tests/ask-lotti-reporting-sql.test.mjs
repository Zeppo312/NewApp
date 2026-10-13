// Run the real report migration and assertions against an isolated PostgreSQL.
// Optional schema JSON comes from a read-only production metadata query.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_PACKAGE + '/dist/index.js');
const db = new PGlite();
try {
 const snapshot=JSON.parse(await readFile(process.argv[2], 'utf8')).rows[0].schema;
 const quote = value => '"'+value.replaceAll('"','""')+'"';
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon;
 CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
 CREATE FUNCTION public.is_moderator() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;`);
 await db.exec('CREATE TABLE public.content_reports ('+snapshot.columns.map(c=>`${quote(c.column_name)} ${c.data_type}${c.column_default?' DEFAULT '+c.column_default:''}${c.is_nullable==='NO'?' NOT NULL':''}`).join(',')+')');
 for(const constraint of snapshot.constraints)await db.exec(`ALTER TABLE public.content_reports ADD CONSTRAINT ${quote(constraint.name)} ${constraint.definition}`);
 for(const index of snapshot.indexes.filter(s=>!s.includes('content_reports_pkey')))await db.exec(index);
 await db.exec('ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY');
 for(const p of snapshot.policies)await db.exec(`CREATE POLICY ${quote(p.policyname)} ON public.content_reports FOR ${p.cmd} TO ${p.roles.map(r=>r==='public'?'PUBLIC':quote(r)).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''}`);
 const migration=await readFile(new URL('../../supabase/migrations/20270901000003_ask_lotti_answer_reports.sql',import.meta.url),'utf8');
 await db.exec(migration);
 await db.exec(await readFile(new URL('../../supabase/tests/ask_lotti_answer_reports.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('SELECT count(*)::int AS count FROM public.content_reports')).rows[0].count,0);
 console.log('Report SQL assertions passed against the production table/constraint/policy snapshot; writes rolled back.');
} finally { await db.close(); }
