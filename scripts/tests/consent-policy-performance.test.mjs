import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setup, asUser, enable, decision } from './helpers/data-consent-fixture.mjs';

const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const baby = '30000000-0000-4000-8000-000000000001';
const otherBaby = '30000000-0000-4000-8000-000000000002';
const rowId = '40000000-0000-4000-8000-000000000001';
const migration = fs.readFileSync('supabase/migrations/20261005191027_optimize_consent_policy_evaluation.sql', 'utf8');
const readMigration = name => fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8');

async function makeDb(optimized = true) {
  const db = await setup();
  await db.exec(`CREATE FUNCTION consent_private.require_live_user(uid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
      IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN
        RAISE EXCEPTION 'account_not_found';
      END IF;
    END $$;`);
  await db.exec(readMigration('20261003160141_data_consent_release_cohort'));
  await db.exec(readMigration('20261003164934_data_consent_self_service'));
  await db.exec(`UPDATE consent_private.settings SET self_service_enabled=true;
    INSERT INTO public.baby_info VALUES('${baby}','${a}'),('${otherBaby}','${b}');
    INSERT INTO public.baby_members VALUES('${baby}','${a}'),('${otherBaby}','${b}');
    INSERT INTO public.weight_entries(id,user_id,baby_id,notes) VALUES
      ('${rowId}','${a}','${baby}','synthetic');
    DROP POLICY fixture ON public.weight_entries;
    CREATE POLICY fixture_owner_or_member ON public.weight_entries TO authenticated
      USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.baby_members m
        WHERE m.baby_id=weight_entries.baby_id AND m.user_id=auth.uid()))
      WITH CHECK(user_id=auth.uid());
    GRANT SELECT ON public.weight_entries TO anon;
    CREATE POLICY fixture_guest ON public.weight_entries TO anon USING(true);`);
  if (optimized) await db.exec(migration);
  return db;
}
async function count(db) {
  return (await db.query('SELECT count(*)::int n FROM public.weight_entries')).rows[0].n;
}
async function catalog(db) {
  await db.exec('RESET ROLE');
  return (await db.query(`SELECT jsonb_build_object(
    'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('public','consent_private') AND p.prokind='f'),
    'grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY table_schema,table_name,grantee,privilege_type)
      FROM information_schema.role_table_grants g WHERE table_schema IN ('public','consent_private')),
    'settings',(SELECT to_jsonb(s) FROM consent_private.settings s),
    'triggers',(SELECT jsonb_agg(pg_get_triggerdef(oid) ORDER BY oid) FROM pg_trigger WHERE NOT tgisinternal),
    'other_policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polname<>'data_consent_health')
  ) AS state`)).rows[0].state;
}

test('changes only the 44 restrictive policy expressions, preserving all other access controls', async () => {
  const db = await makeDb(false);
  try {
    const before = await catalog(db);
    await db.exec(migration);
    assert.deepEqual(await catalog(db), before);
    const policies = (await db.query(`SELECT polpermissive,polcmd,polroles,
      pg_get_expr(polqual,polrelid) AS expression,pg_get_expr(polwithcheck,polrelid) AS write_expression
      FROM pg_policy WHERE polname='data_consent_health'`)).rows;
    assert.equal(policies.length, 44);
    for (const p of policies) {
      assert.equal(p.polpermissive, false);
      assert.equal(p.polcmd, '*');
      assert.match(p.expression, /SELECT consent_private\.family_allowed/);
      assert.match(p.expression, /consent_private\.row_allowed/);
      assert.equal(p.write_expression, p.expression);
    }
  } finally { await db.close(); }
});

test('family lookup runs once per statement rather than once per row; the next statement sees withdrawal', async () => {
  const db = await makeDb(false);
  try {
    await db.exec(`INSERT INTO public.weight_entries(id,user_id,baby_id)
      SELECT md5('row'||n)::uuid,'${a}','${baby}' FROM generate_series(1,39)n;
      CREATE SEQUENCE public.test_family_calls;`);
    const definition = (await db.query(`SELECT pg_get_functiondef('consent_private.family_allowed(uuid,text)'::regprocedure) AS body`)).rows[0].body;
    await db.exec(definition.replace('BEGIN', "BEGIN PERFORM nextval('public.test_family_calls');"));
    await asUser(db, a);
    assert.equal(await count(db), 40);
    await db.exec('RESET ROLE');
    const before = Number((await db.query('SELECT last_value FROM public.test_family_calls')).rows[0].last_value);
    assert.ok(before >= 40);
    await db.exec(migration);
    await asUser(db, a);
    assert.equal(await count(db), 40);
    await db.exec('RESET ROLE');
    const after = Number((await db.query('SELECT last_value FROM public.test_family_calls')).rows[0].last_value);
    assert.equal(after - before, 1);
    await asUser(db, a);
    await decision(db, 'health', 'granted', 0, 1);
    assert.equal(await count(db), 40);
    await decision(db, 'health', 'revoked', 1, 2);
    assert.equal(await count(db), 0);
  } finally { await db.close(); }
});

for (const mode of ['empty', 'cohort', 'global']) {
  test(`preserves owner, member, unrelated and anonymous read results (${mode})`, async () => {
    const results = [];
    for (const optimized of [false, true]) {
      const db = await makeDb(optimized);
      try {
        if (mode === 'global') await enable(db);
        if (mode !== 'empty') {
          await asUser(db, a); await decision(db, 'health', 'granted', 0, 1);
          if (mode === 'global') { await asUser(db, b); await decision(db, 'health', 'granted', 0, 2); }
        }
        const values = [];
        await asUser(db, a); values.push(await count(db));
        await asUser(db, b); values.push(await count(db));
        await db.exec(`RESET ROLE; INSERT INTO public.baby_members VALUES('${baby}','${b}')`);
        await asUser(db, b); values.push(await count(db));
        await asUser(db, null, 'anon'); values.push(await count(db));
        if (mode !== 'empty') {
          await asUser(db, a); await decision(db, 'health', 'revoked', 1, 3);
          await asUser(db, a); values.push(await count(db));
          await asUser(db, b); values.push(await count(db));
          await asUser(db, null, 'anon'); values.push(await count(db));
        }
        results.push(values);
        assert.deepEqual(values.slice(0, 3), [1, 0, 1]);
        if (mode !== 'empty') assert.deepEqual(values.slice(-3), [0, 0, 0]);
      } finally { await db.close(); }
    }
    assert.deepEqual(results[1], results[0]);
  });
}

test('a consented caller cannot read a row whose unrelated author withdrew', async () => {
  const db = await makeDb();
  try {
    // Isolate the row check: this synthetic permissive rule allows viewing a
    // second author's record without a family connection.
    await db.exec(`CREATE POLICY fixture_read ON public.weight_entries FOR SELECT TO authenticated USING(true)`);
    await asUser(db, a); await decision(db, 'health', 'granted', 0, 1);
    await asUser(db, b); await decision(db, 'health', 'granted', 0, 2);
    assert.equal(await count(db), 1);
    await asUser(db, a); await decision(db, 'health', 'revoked', 1, 3);
    await asUser(db, b); assert.equal(await count(db), 0);
  } finally { await db.close(); }
});

test('writes still enforce owner, row consent, WITH CHECK and service-trigger guards', async () => {
  const db = await makeDb();
  try {
    await asUser(db, a); await decision(db, 'health', 'granted', 0, 1);
    await db.query(`UPDATE public.weight_entries SET notes='allowed' WHERE id=$1`, [rowId]);
    await assert.rejects(db.query(`UPDATE public.weight_entries SET user_id=$1 WHERE id=$2`, [b,rowId]), /row-level security/);
    await decision(db, 'health', 'revoked', 1, 2);
    await assert.rejects(db.query(`INSERT INTO public.weight_entries(id,user_id,baby_id) VALUES(md5('new')::uuid,$1,$2)`, [a,baby]), /health_consent_required|row-level security/);
    assert.equal((await db.query(`UPDATE public.weight_entries SET notes='blocked' WHERE id=$1 RETURNING id`, [rowId])).rows.length, 0);
    await asUser(db, null, 'service_role');
    await assert.rejects(db.query(`UPDATE public.weight_entries SET notes='late' WHERE id=$1`, [rowId]), /health_consent_required/);
  } finally { await db.close(); }
});

test('an independent deletion barrier and the composed pre-request hook remain effective', async () => {
  const db = await makeDb(false);
  try {
    await db.exec(`CREATE POLICY account_deletion_deny ON public.weight_entries AS RESTRICTIVE
      FOR ALL TO authenticated USING(false) WITH CHECK(false);
      CREATE FUNCTION consent_private.check_account_deletion_access() RETURNS void LANGUAGE plpgsql
      AS $$ BEGIN RAISE EXCEPTION 'synthetic_deletion_block'; END $$;`);
    await db.exec(migration);
    await asUser(db, a);
    assert.equal(await count(db), 0);
    await assert.rejects(db.query('SELECT public.check_data_consent_access()'), /synthetic_deletion_block/);
  } finally { await db.close(); }
});

test('drift or a missing guard aborts before any policy is replaced', async () => {
  for (const change of [
    'DROP POLICY data_consent_health ON public.weight_entries',
    'ALTER POLICY data_consent_health ON public.weight_entries USING(false)',
  ]) {
    const db = await makeDb(false);
    try {
      await db.exec(change);
      const before = (await db.query(`SELECT oid,pg_get_expr(polqual,polrelid) AS expr FROM pg_policy ORDER BY oid`)).rows;
      await assert.rejects(db.exec(migration), /consent_performance_policy_drift/);
      await db.exec('ROLLBACK');
      assert.deepEqual((await db.query(`SELECT oid,pg_get_expr(polqual,polrelid) AS expr FROM pg_policy ORDER BY oid`)).rows, before);
    } finally { await db.close(); }
  }
});
