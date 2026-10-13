-- Targeted safety correction for the freshly staged production guard policies.
-- No intake, processing, consent rollout, request or provider-state changes.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $gate$ BEGIN
 IF (SELECT count(*) FROM pg_policy WHERE polname='account_deletion_deny')<>122
  OR EXISTS(SELECT 1 FROM pg_policy p WHERE polname='account_deletion_deny' AND
   (p.polpermissive OR p.polcmd<>'*' OR p.polroles<>ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
    OR pg_get_expr(p.polqual,p.polrelid) IS DISTINCT FROM '(NOT deletion_private.blocked(auth.uid()))'
    OR pg_get_expr(p.polwithcheck,p.polrelid) IS DISTINCT FROM '(NOT deletion_private.blocked(auth.uid()))'))
 THEN RAISE EXCEPTION 'deletion_guard_policy_changed'; END IF;
 IF (SELECT relrowsecurity OR relforcerowsecurity FROM pg_class WHERE oid='public.account_links_audit_log'::regclass)
 THEN RAISE EXCEPTION 'audit_rls_baseline_changed'; END IF;
END $gate$;
-- All actual audit writers are postgres-owned SECURITY DEFINER triggers.
-- Keep owner/service bypass; deny direct client use of these audit copies.
ALTER TABLE public.account_links_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_links_audit_log FROM PUBLIC,anon,authenticated;
DO $policies$ DECLARE policy_row record; BEGIN
 FOR policy_row IN SELECT n.nspname schema_name,c.relname table_name FROM pg_policy p
  JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE p.polname='account_deletion_deny' ORDER BY n.nspname,c.relname
 LOOP
  EXECUTE format('ALTER POLICY account_deletion_deny ON %I.%I USING ((SELECT NOT deletion_private.blocked(auth.uid()))) WITH CHECK ((SELECT NOT deletion_private.blocked(auth.uid())))',policy_row.schema_name,policy_row.table_name);
 END LOOP;
END $policies$;
-- Modified senders already use fully qualified relations and private helpers.
ALTER FUNCTION public.send_partner_notification_webhook() SET search_path='';
ALTER FUNCTION public.send_planner_notification_webhook() SET search_path='';
ALTER FUNCTION public.send_baby_reminder_notification_webhook() SET search_path='';
ALTER FUNCTION public.send_direct_message_notification_webhook() SET search_path='';
ALTER FUNCTION public.send_group_message_notification_webhook() SET search_path='';
NOTIFY pgrst,'reload schema';
COMMIT;
