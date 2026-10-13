-- Aggregate-only alarm relay. Independent of deletion enablement and policy approval.
CREATE TABLE deletion_private.alarm_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 last_signature text, last_sent_at timestamptz,
 lease uuid, lease_until timestamptz, pending_signature text
);
INSERT INTO deletion_private.alarm_state(singleton) VALUES(true);
ALTER TABLE deletion_private.alarm_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deletion_private.alarm_state FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.account_deletion_alarm(action text,payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s deletion_private.alarm_state; token uuid; signature text;
BEGIN
 IF action='health' THEN
  RETURN jsonb_build_object(
   'needs_attention',(SELECT count(*) FROM deletion_private.requests WHERE status='needs_attention'),
   'queued_over_15m',(SELECT count(*) FROM deletion_private.requests WHERE status='queued' AND created_at<now()-interval '15 minutes'),
   'expired_lease_over_7m',(SELECT count(*) FROM deletion_private.requests WHERE status='processing' AND lease_until<now()-interval '7 minutes'),
   'lease_exceeds_contract',(SELECT count(*) FROM deletion_private.requests WHERE status='processing' AND lease_until>updated_at+interval '3 minutes'),
   'overdue_retention',(SELECT count(*) FROM deletion_private.provider_tasks WHERE status='retention_pending' AND due_at<now())
  );
 END IF;
 SELECT * INTO s FROM deletion_private.alarm_state WHERE singleton FOR UPDATE;
 IF action='reset' THEN
  IF s.lease_until IS NULL OR s.lease_until<now() THEN
   UPDATE deletion_private.alarm_state SET last_signature=NULL,last_sent_at=NULL,lease=NULL,lease_until=NULL,pending_signature=NULL WHERE singleton;
  END IF;
  RETURN '{}'::jsonb;
 ELSIF action='claim' THEN
  signature:=payload->>'signature';
  IF signature IS NULL OR signature !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_alarm_signature'; END IF;
  IF s.lease_until>now() OR (s.last_signature=signature AND s.last_sent_at>now()-interval '1 hour') THEN RETURN jsonb_build_object('send',false); END IF;
  token:=gen_random_uuid();
  UPDATE deletion_private.alarm_state SET lease=token,lease_until=now()+interval '2 minutes',pending_signature=signature WHERE singleton;
  RETURN jsonb_build_object('send',true,'lease',token);
 ELSIF action='finish' THEN
  IF s.lease IS NULL OR s.lease IS DISTINCT FROM (payload->>'lease')::uuid OR s.lease_until<now() THEN RAISE EXCEPTION 'alarm_lease_lost'; END IF;
  UPDATE deletion_private.alarm_state SET
   last_signature=CASE WHEN payload->>'sent'='true' THEN pending_signature ELSE last_signature END,
   last_sent_at=CASE WHEN payload->>'sent'='true' THEN now() ELSE last_sent_at END,
   lease=NULL,lease_until=NULL,pending_signature=NULL WHERE singleton;
  RETURN '{}'::jsonb;
 END IF;
 RAISE EXCEPTION 'invalid_alarm_action';
END $$;
REVOKE ALL ON FUNCTION public.account_deletion_alarm(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_alarm(text,jsonb) TO service_role;
