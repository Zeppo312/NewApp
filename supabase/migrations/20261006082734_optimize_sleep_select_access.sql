-- Preserve the existing REST contract and lookup-table RLS. No RPC or write-policy changes.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $migration$
DECLARE before_fingerprint text;
BEGIN
 SELECT deletion_private.fingerprint() INTO before_fingerprint;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.sleep_entries'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'sleep_rls_disabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.sleep_entries'::regclass AND polname='Sleep entries: select by member' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND polwithcheck IS NULL AND md5(pg_get_expr(polqual,polrelid))='7c8d6df82e3f5013c13c90ad7777a927') THEN RAISE EXCEPTION 'sleep_policy_drift: %','Sleep entries: select by member'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.sleep_entries'::regclass AND polname='sleep_select_owner_and_partner' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND polwithcheck IS NULL AND md5(pg_get_expr(polqual,polrelid))='a7d9e6ce09df718e12940c06a21f651e') THEN RAISE EXCEPTION 'sleep_policy_drift: %','sleep_select_owner_and_partner'; END IF;
 EXECUTE 'ALTER POLICY "Sleep entries: select by member" ON public.sleep_entries USING (((SELECT auth.uid()) = user_id) OR ((SELECT auth.uid()) = partner_id) OR ((SELECT auth.uid()) = shared_with_user_id) OR baby_id = ANY ((SELECT coalesce(array_agg(bm.baby_id),ARRAY[]::uuid[]) FROM public.baby_members bm WHERE bm.user_id=(SELECT auth.uid()))::uuid[]) OR id = ANY ((SELECT coalesce(array_agg(ss.entry_id),ARRAY[]::uuid[]) FROM public.sleep_entry_shares ss WHERE ss.shared_with_id=(SELECT auth.uid()))::uuid[]))';
 EXECUTE 'ALTER POLICY "sleep_select_owner_and_partner" ON public.sleep_entries USING (((SELECT auth.uid()) = user_id) OR user_id = ANY ((SELECT coalesce(array_agg(CASE WHEN al.creator_id=(SELECT auth.uid()) THEN al.invited_id ELSE al.creator_id END),ARRAY[]::uuid[]) FROM public.account_links al WHERE al.status=''accepted'' AND ((al.creator_id=(SELECT auth.uid())) OR (al.invited_id=(SELECT auth.uid()))))::uuid[]))';
 CREATE INDEX sleep_entries_partner_read_idx ON public.sleep_entries(partner_id) WHERE partner_id IS NOT NULL;
 CREATE INDEX sleep_entries_legacy_share_read_idx ON public.sleep_entries(shared_with_user_id) WHERE shared_with_user_id IS NOT NULL;
 IF deletion_private.fingerprint() IS DISTINCT FROM before_fingerprint THEN RAISE EXCEPTION 'deletion_fingerprint_changed'; END IF;
END
$migration$;
COMMIT;
