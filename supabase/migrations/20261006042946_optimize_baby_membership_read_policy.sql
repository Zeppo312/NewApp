BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- Keep the legacy baby_info REST endpoint, projections and relationships intact.
-- Replace only the permissive SELECT predicate; restrictive consent/deletion
-- policies still apply to every returned baby and embedded membership row.
DO $guard$
BEGIN
  IF to_regprocedure('consent_private.current_accessible_baby_ids()') IS NOT NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polrelid='public.baby_info'::regclass
        AND polname='Baby info: select by member' AND polcmd='r'
        AND polpermissive AND polroles='{0}'::oid[] AND polwithcheck IS NULL
        AND pg_get_expr(polqual,polrelid)='((user_id = auth.uid()) OR is_baby_member(id))'
    ) OR md5(pg_get_functiondef('public.is_baby_member(uuid)'::regprocedure))
      IS DISTINCT FROM '2a1a88b2cb315d038af13851f43d6baa'
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.baby_info'::regclass
      AND relrowsecurity AND relowner='postgres'::regrole)
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.baby_members'::regclass
      AND relrowsecurity AND relowner='postgres'::regrole)
  THEN RAISE EXCEPTION 'baby_membership_read_policy_drift'; END IF;
END $guard$;

-- Enumerates the same owner OR raw-membership predicate as the old SELECT
-- policy/is_baby_member helper. No caller-supplied UID and no persistent cache.
-- Private schema: not a new Data API endpoint. RLS bypass is intentional only
-- for this membership lookup, just like the existing is_baby_member helper.
CREATE FUNCTION consent_private.current_accessible_baby_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce(array_agg(allowed.id), '{}'::uuid[])
  FROM (
    SELECT b.id FROM public.baby_info b WHERE b.user_id=(SELECT auth.uid())
    UNION
    SELECT bm.baby_id FROM public.baby_members bm WHERE bm.user_id=(SELECT auth.uid())
  ) allowed;
$function$;
ALTER FUNCTION consent_private.current_accessible_baby_ids() OWNER TO postgres;
REVOKE ALL ON FUNCTION consent_private.current_accessible_baby_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consent_private.current_accessible_baby_ids() TO anon,authenticated,service_role;

ALTER POLICY "Baby info: select by member" ON public.baby_info
  USING (id=ANY ((SELECT consent_private.current_accessible_baby_ids())::uuid[]));

NOTIFY pgrst, 'reload schema';
COMMIT;
