-- Service-only heartbeat after independent durable registry reconciliation.
-- No approval, intake, deletion processing, provider status or cron activation.
BEGIN;
CREATE TABLE deletion_private.registry_runtime (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 monitor_required boolean NOT NULL DEFAULT false,
 last_sync_at timestamptz,
 writer text,
 registry_sha256 text CHECK(registry_sha256 ~ '^[a-f0-9]{64}$'),
 entry_count bigint CHECK(entry_count>=0),
 confirmed_entry_evidence boolean NOT NULL DEFAULT false
);
INSERT INTO deletion_private.registry_runtime(singleton) VALUES(true);
ALTER TABLE deletion_private.registry_runtime ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deletion_private.registry_runtime FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.account_deletion_registry_heartbeat(p_writer text,p_registry_sha256 text,p_entry_count bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF length(trim(coalesce(p_writer,''))) NOT BETWEEN 3 AND 100 OR coalesce(p_registry_sha256,'') !~ '^[a-f0-9]{64}$' OR p_entry_count IS NULL OR p_entry_count<0
 THEN RAISE EXCEPTION 'invalid_registry_heartbeat'; END IF;
 IF p_entry_count IS DISTINCT FROM (SELECT count(*) FROM deletion_private.requests)
  OR EXISTS(SELECT 1 FROM deletion_private.requests WHERE registry_acknowledged_at IS NULL OR registry_entry_sha256 IS DISTINCT FROM deletion_private.registry_entry_digest(id))
 THEN RAISE EXCEPTION 'registry_reconciliation_incomplete'; END IF;
 UPDATE deletion_private.registry_runtime SET last_sync_at=clock_timestamp(),writer=p_writer,
  registry_sha256=p_registry_sha256,entry_count=p_entry_count,confirmed_entry_evidence=p_entry_count>0 WHERE singleton;
 IF NOT FOUND THEN RAISE EXCEPTION 'registry_runtime_missing'; END IF;
 RETURN jsonb_build_object('received',true,'confirmedEntryEvidence',p_entry_count>0);
END $$;
REVOKE ALL ON FUNCTION public.account_deletion_registry_heartbeat(text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_registry_heartbeat(text,text,bigint) TO service_role;
-- Preserve the existing alarm relay and add a count checked by the cloud cron.
DO $upgrade$ DECLARE definition text;
 needle text:=$key$'needs_attention',(SELECT count(*) FROM deletion_private.requests WHERE status='needs_attention')$key$;
BEGIN
 definition:=pg_get_functiondef('public.account_deletion_alarm(text,jsonb)'::regprocedure);
 IF position('registry_stale_over_3m' IN definition)>0
  OR (length(definition)-length(replace(definition,needle,'')))<>length(needle)
 THEN RAISE EXCEPTION 'unreviewed_alarm_body'; END IF;
 definition:=replace(definition,needle,$replacement$'registry_stale_over_3m',(SELECT CASE
  WHEN NOT EXISTS(SELECT 1 FROM deletion_private.registry_runtime WHERE singleton) THEN 1
  WHEN EXISTS(SELECT 1 FROM deletion_private.registry_runtime WHERE singleton AND monitor_required
   AND (last_sync_at IS NULL OR last_sync_at<now()-interval '3 minutes')) THEN 1
  ELSE 0 END), $replacement$||needle);
 EXECUTE definition;
END $upgrade$;
COMMIT;
