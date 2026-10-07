-- Statement-local evaluation of the existing, row-independent family guard.
-- Keep the row-dependent guard, write checks, roles, and restrictive policy.
-- No client cache, no consent activation, no change to grants or decisions.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $migration$
DECLARE target record; policy record; expected text;
BEGIN
  IF to_regprocedure('consent_private.family_allowed(uuid,text)') IS NULL
    OR to_regprocedure('consent_private.row_allowed(jsonb)') IS NULL
    OR (SELECT count(*) FROM consent_private.protected_tables) <> 44 THEN
    RAISE EXCEPTION 'consent_performance_baseline_missing';
  END IF;

  -- Validate every target before taking any policy-changing action. Abort on
  -- drift rather than replacing an unreviewed access rule.
  FOR target IN SELECT table_name FROM consent_private.protected_tables ORDER BY table_name LOOP
    SELECT p.polpermissive, p.polcmd, p.polroles,
      pg_get_expr(p.polqual,p.polrelid) AS using_expression,
      pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
    INTO policy FROM pg_policy p
    WHERE p.polrelid=to_regclass(format('public.%I',target.table_name))
      AND p.polname='data_consent_health';
    expected := format('(consent_private.family_allowed(( SELECT auth.uid() AS uid)) AND consent_private.row_allowed(to_jsonb(%I.*)))',target.table_name);
    IF NOT FOUND OR policy.polpermissive OR policy.polcmd <> '*'
      OR policy.polroles <> ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]
      OR policy.using_expression IS DISTINCT FROM expected
      OR policy.check_expression IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'consent_performance_policy_drift: %',target.table_name;
    END IF;
  END LOOP;

  FOR target IN SELECT table_name FROM consent_private.protected_tables ORDER BY table_name LOOP
    EXECUTE format(
      'ALTER POLICY data_consent_health ON public.%I
       USING ((SELECT consent_private.family_allowed((SELECT auth.uid()))) AND consent_private.row_allowed(to_jsonb(%I.*)))
       WITH CHECK ((SELECT consent_private.family_allowed((SELECT auth.uid()))) AND consent_private.row_allowed(to_jsonb(%I.*)))',
      target.table_name,target.table_name,target.table_name);
  END LOOP;
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
