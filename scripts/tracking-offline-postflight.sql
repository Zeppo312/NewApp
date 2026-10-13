-- Read-only checks after a separately authorized tracking migration.
-- A catalog check does not replace authenticated family/device acceptance.
BEGIN TRANSACTION READ ONLY;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '15s';
WITH rpc AS (
  SELECT to_regprocedure('public.tracking_sync_operation(uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz,text)')::oid AS oid
)
SELECT jsonb_build_object(
  'rpcExists',(SELECT oid IS NOT NULL FROM rpc),
  'rpcSecurityInvoker',(SELECT NOT p.prosecdef FROM pg_catalog.pg_proc p JOIN rpc ON rpc.oid=p.oid),
  'rpcAuthenticatedExecute',(SELECT has_function_privilege('authenticated',oid,'EXECUTE') FROM rpc),
  'rpcAnonExecute',(SELECT has_function_privilege('anon',oid,'EXECUTE') FROM rpc),
  'receiptRls',(SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=to_regclass('public.tracking_sync_receipts')),
  'receiptPolicies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND tablename='tracking_sync_receipts'),
  'withdrawalTrigger',(SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_catalog.pg_get_triggerdef(t.oid,true)))
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid=to_regclass('consent_private.decisions') AND t.tgname='tracking_receipt_withdrawal'),
  'realtime',(SELECT jsonb_agg(p.tablename ORDER BY p.tablename) FROM pg_catalog.pg_publication_tables p
    WHERE p.pubname='supabase_realtime' AND p.schemaname='public'
    AND p.tablename IN ('sleep_entries','baby_care_entries','baby_daily_habit_checks','custom_activity_types','inventory_items','inventory_transactions')),
  'receiptDeletionRule',(SELECT count(*) FROM deletion_private.rules WHERE schema_name='public' AND table_name='tracking_sync_receipts' AND column_name='user_id' AND action='delete'),
  'deletionReadiness',public.account_deletion_readiness(),
  'approvedDeletionFingerprintMatches',(SELECT approved_fingerprint IS NOT DISTINCT FROM deletion_private.fingerprint() FROM deletion_private.settings WHERE singleton)
) AS evidence;
ROLLBACK;
