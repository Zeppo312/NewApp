-- Let effective clients display and save separate real choices without a global legacy rollout.
-- Reading the screen never enrolls an account or grants processing permission.
BEGIN;
ALTER TABLE consent_private.settings ADD COLUMN self_service_enabled boolean NOT NULL DEFAULT false;
CREATE FUNCTION consent_private.guard_self_service()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.self_service_enabled AND (
   to_regprocedure('consent_private.enforced_for(uuid)') IS NULL OR
   (SELECT count(*) FROM consent_private.protected_tables)<>44 OR
   (SELECT count(*) FROM pg_policy WHERE polname='data_consent_health' AND NOT polpermissive)<>44 OR
   (SELECT count(*) FROM pg_trigger WHERE tgname='data_consent_health_write' AND tgenabled='O')<>44
 ) THEN RAISE EXCEPTION 'consent_enforcement_not_ready' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consent_self_service_guard BEFORE UPDATE ON consent_private.settings
 FOR EACH ROW EXECUTE FUNCTION consent_private.guard_self_service();
CREATE OR REPLACE FUNCTION consent_private.snapshot(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('enabled',s.self_service_enabled OR consent_private.enforced_for(p_user_id),'userId',p_user_id,
    'revision',COALESCE((SELECT revision FROM consent_private.user_state WHERE user_id=p_user_id),0),
    'documentVersion',s.document_version,
    'health',(SELECT jsonb_build_object('decision',decision,'documentVersion',document_version,'decidedAt',decided_at) FROM consent_private.decisions WHERE user_id=p_user_id AND scope='health'),
    'ai',(SELECT jsonb_build_object('decision',decision,'documentVersion',document_version,'decidedAt',decided_at) FROM consent_private.decisions WHERE user_id=p_user_id AND scope='ai'))
  FROM consent_private.settings s WHERE singleton
$$;

CREATE OR REPLACE FUNCTION consent_private.record_decision(p_scope text, p_decision text,
  p_document_version text, p_locale text, p_operation_id uuid, p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); s consent_private.settings; current_revision bigint;
  previous consent_private.operations; at_time timestamptz;
BEGIN
  PERFORM consent_private.require_live_user(uid);
  IF p_scope IS NULL OR p_scope NOT IN ('health','ai') OR p_decision IS NULL OR p_decision NOT IN ('granted','declined','revoked')
    OR p_locale IS NULL OR p_locale NOT IN ('de','en','es') OR p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
    RAISE EXCEPTION 'invalid_consent_decision' USING ERRCODE='22023';
  END IF;
  SELECT * INTO s FROM consent_private.settings WHERE singleton;
  IF p_document_version IS DISTINCT FROM s.document_version THEN RAISE EXCEPTION 'consent_document_changed' USING ERRCODE='40001'; END IF;
  -- Withdrawal is always accepted, including during a paused rollout.
  IF NOT s.enabled AND NOT s.self_service_enabled AND NOT EXISTS(SELECT 1 FROM consent_private.user_state
    WHERE user_id=uid AND enforcement_started_at IS NOT NULL)
    AND p_decision <> 'revoked' THEN RAISE EXCEPTION 'consents_not_enabled' USING ERRCODE='55000'; END IF;
  INSERT INTO consent_private.user_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM consent_private.user_state WHERE user_id=uid FOR UPDATE;
  SELECT * INTO previous FROM consent_private.operations WHERE user_id=uid AND operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.scope IS DISTINCT FROM p_scope OR previous.decision IS DISTINCT FROM p_decision OR previous.locale IS DISTINCT FROM p_locale OR previous.document_version IS DISTINCT FROM p_document_version THEN
      RAISE EXCEPTION 'consent_operation_conflict' USING ERRCODE='22023';
    END IF;
    -- A retry never restores an old grant after a later withdrawal.
    RETURN consent_private.own_snapshot();
  END IF;
  IF current_revision <> p_expected_revision THEN RAISE EXCEPTION 'consent_revision_changed' USING ERRCODE='40001'; END IF;
  IF p_scope='ai' AND p_decision='granted' AND NOT consent_private.has_consent(uid,'health') THEN
    RAISE EXCEPTION 'health_consent_required' USING ERRCODE='42501';
  END IF;
  at_time := clock_timestamp();
  current_revision := current_revision+1;
  -- Enrollment follows a validated explicit choice, never a read, header or grant inferred by the server.
  -- The historical installation_evidence column records this authenticated operation,
  -- not an attested native installation; its explicit-choice prefix distinguishes it.
  UPDATE consent_private.user_state SET revision=current_revision,
    enforcement_started_at=COALESCE(enforcement_started_at,at_time),
    client_release=COALESCE(client_release,'consent-document:'||p_document_version),
    installation_evidence=COALESCE(installation_evidence,'explicit-choice-operation:'||p_operation_id::text)
  WHERE user_id=uid;
  INSERT INTO consent_private.operations(user_id,operation_id,scope,decision,document_version,locale,revision,created_at) VALUES(uid,p_operation_id,p_scope,p_decision,p_document_version,p_locale,current_revision,at_time);
  INSERT INTO consent_private.decisions(user_id,scope,decision,document_version,decided_at) VALUES(uid,p_scope,p_decision,p_document_version,at_time)
    ON CONFLICT(user_id,scope) DO UPDATE SET decision=excluded.decision,document_version=excluded.document_version,decided_at=excluded.decided_at;
  INSERT INTO consent_private.events(user_id,operation_id,scope,decision,document_version,locale,revision,decided_at,source) VALUES(uid,p_operation_id,p_scope,p_decision,p_document_version,p_locale,current_revision,at_time,'explicit_app_choice');
  IF p_scope='health' AND p_decision<>'granted' AND EXISTS(SELECT 1 FROM consent_private.decisions WHERE user_id=uid AND scope='ai' AND decision='granted') THEN
    UPDATE consent_private.decisions SET decision='revoked',document_version=p_document_version,decided_at=at_time WHERE user_id=uid AND scope='ai';
    INSERT INTO consent_private.events(user_id,operation_id,scope,decision,document_version,locale,revision,decided_at,source) VALUES(uid,p_operation_id,'ai','revoked',p_document_version,p_locale,current_revision,at_time,'health_withdrawal');
  END IF;
  RETURN consent_private.own_snapshot();
END $$;
REVOKE ALL ON FUNCTION consent_private.guard_self_service() FROM PUBLIC,anon,authenticated,service_role;
-- Enabled separately by the operator only after testing the exact server deployment.
NOTIFY pgrst,'reload schema';
COMMIT;
