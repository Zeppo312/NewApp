-- An operator may acknowledge a known provider-evidence reminder without
-- completing the deletion, changing provider evidence, or disabling monitoring.
BEGIN;
CREATE TABLE deletion_private.alarm_acknowledgements (
 request_id uuid PRIMARY KEY REFERENCES deletion_private.requests(id) ON DELETE CASCADE,
 request_updated_at timestamptz NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_by text NOT NULL CHECK(length(trim(acknowledged_by)) BETWEEN 3 AND 100),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 1000)
);
ALTER TABLE deletion_private.alarm_acknowledgements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deletion_private.alarm_acknowledgements FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE deletion_private.alarm_acknowledgements IS
 'Operator-only reminder acknowledgements, bound to the unchanged provider-evidence state. Not deletion completion evidence.';

DO $upgrade$
DECLARE
 definition text;
 needle text := $key$'needs_attention',(SELECT count(*) FROM deletion_private.requests WHERE status='needs_attention')$key$;
 replacement text := $replacement$'needs_attention',(SELECT count(*) FROM deletion_private.requests r
  WHERE r.status='needs_attention' AND NOT EXISTS (
   SELECT 1 FROM deletion_private.alarm_acknowledgements a
   WHERE a.request_id=r.id AND a.request_updated_at=r.updated_at
    AND r.phase='providers' AND r.error_code='provider_evidence_required'
  ))$replacement$;
BEGIN
 definition := pg_get_functiondef('public.account_deletion_alarm(text,jsonb)'::regprocedure);
 IF position('alarm_acknowledgements' IN definition)>0
  OR (length(definition)-length(replace(definition,needle,'')))<>length(needle)
 THEN RAISE EXCEPTION 'unreviewed_alarm_body'; END IF;
 -- Keep every technical counter, the SMTP lease/deduplication behavior, and ACLs.
 EXECUTE replace(definition,needle,replacement);
END $upgrade$;
COMMIT;
