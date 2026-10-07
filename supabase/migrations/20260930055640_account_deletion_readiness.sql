-- Read-only acceptance readiness. Return no account data or internal policy.
-- Deploy after account_deletion_jobs; never run a blanket migration push.
BEGIN;
CREATE OR REPLACE FUNCTION public.account_deletion_readiness() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM deletion_private.settings s
  WHERE s.singleton AND s.approved_fingerprint = deletion_private.fingerprint()
    AND length(trim(s.approved_by)) >= 3
    AND s.approved_at IS NOT NULL AND s.approved_at <= now()
    AND s.receipt_retention_days > 0 AND s.backup_window_days > 0
 ) AND EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles
  WHERE rolname = 'authenticator'
    AND 'pgrst.db_pre_request=public.check_account_deletion_access'=ANY(rolconfig)
 );
$$;
REVOKE ALL ON FUNCTION public.account_deletion_readiness() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_readiness() TO service_role;

-- Enforce the same acceptance gate for app and audited support requests.
-- Existing durable jobs remain available for recovery and idempotent receipts.
CREATE OR REPLACE FUNCTION deletion_private.guard_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.account_deletion_readiness() THEN
  RAISE EXCEPTION 'deletion_inventory_not_approved';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION deletion_private.guard_acceptance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS account_deletion_acceptance_guard ON deletion_private.requests;
CREATE TRIGGER account_deletion_acceptance_guard BEFORE INSERT ON deletion_private.requests
FOR EACH ROW EXECUTE FUNCTION deletion_private.guard_acceptance();
COMMIT;
