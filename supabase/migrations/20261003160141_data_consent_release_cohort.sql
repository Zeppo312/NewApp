-- Server-selected release cohort. Empty by default: no legacy access changes.
-- Only an operator may enroll an account after the effective client is installed.
-- Enrollment is permanent while the account exists; never infer a consent grant.
BEGIN;
ALTER TABLE consent_private.user_state ADD COLUMN enforcement_started_at timestamptz;
ALTER TABLE consent_private.user_state ADD COLUMN client_release text;
ALTER TABLE consent_private.user_state ADD COLUMN installation_evidence text;
ALTER TABLE consent_private.user_state ADD CONSTRAINT consent_release_evidence CHECK
 ((enforcement_started_at IS NULL AND client_release IS NULL AND installation_evidence IS NULL) OR
  (enforcement_started_at IS NOT NULL AND length(trim(client_release))>=3 AND length(trim(installation_evidence))>=3));
CREATE FUNCTION consent_private.enforced_for(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT consent_private.is_enabled() OR EXISTS(SELECT 1 FROM consent_private.user_state
  WHERE user_id=p_user_id AND enforcement_started_at IS NOT NULL)
$$;
CREATE FUNCTION consent_private.rollout_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT consent_private.is_enabled() OR EXISTS(SELECT 1 FROM consent_private.user_state WHERE enforcement_started_at IS NOT NULL)
$$;
CREATE FUNCTION consent_private.guard_release_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.enforcement_started_at IS NOT NULL AND
  (NEW.enforcement_started_at,NEW.client_release,NEW.installation_evidence) IS DISTINCT FROM
  (OLD.enforcement_started_at,OLD.client_release,OLD.installation_evidence) THEN
  RAISE EXCEPTION 'consent_enrollment_is_permanent' USING ERRCODE='55000';
 END IF;
 IF NEW.enforcement_started_at IS NOT NULL AND NEW.enforcement_started_at>clock_timestamp() THEN
  RAISE EXCEPTION 'consent_enrollment_cannot_be_future' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consent_release_enrollment BEFORE INSERT OR UPDATE ON consent_private.user_state
 FOR EACH ROW EXECUTE FUNCTION consent_private.guard_release_enrollment();
CREATE OR REPLACE FUNCTION consent_private.processing_allowed(p_user_id uuid,p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN NOT consent_private.enforced_for(p_user_id) THEN true ELSE
  p_user_id IS NOT NULL AND p_scope IN ('health','ai') AND consent_private.has_consent(p_user_id,'health')
  AND (p_scope='health' OR consent_private.has_consent(p_user_id,'ai')) END
$$;
CREATE OR REPLACE FUNCTION consent_private.snapshot(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('enabled',consent_private.enforced_for(p_user_id),'userId',p_user_id,
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
  IF NOT s.enabled AND NOT EXISTS(SELECT 1 FROM consent_private.user_state
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
  UPDATE consent_private.user_state SET revision=current_revision WHERE user_id=uid;
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

CREATE OR REPLACE FUNCTION consent_private.family_allowed(p_user_id uuid,p_scope text DEFAULT 'health')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT consent_private.rollout_active() THEN RETURN true; END IF;
  IF NOT consent_private.processing_allowed(p_user_id,p_scope) THEN RETURN false; END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM (
      SELECT b.user_id AS subject FROM public.baby_info b
        JOIN public.baby_members m ON m.baby_id=b.id WHERE m.user_id=p_user_id
      UNION SELECT CASE WHEN l.creator_id=p_user_id THEN l.invited_id ELSE l.creator_id END
        FROM public.account_links l WHERE l.status='accepted' AND p_user_id IN(l.creator_id,l.invited_id)
      UNION SELECT owner_id FROM public.sleep_entry_shares WHERE shared_with_id=p_user_id
    ) sources WHERE subject IS NOT NULL AND NOT consent_private.processing_allowed(subject,p_scope)
  );
END $$;

CREATE OR REPLACE FUNCTION consent_private.row_allowed(p_row jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE key text; subject uuid;
BEGIN
  IF NOT consent_private.rollout_active() THEN RETURN true; END IF;
  FOREACH key IN ARRAY ARRAY['user_id','owner_id','created_by','partner_id','shared_with_user_id'] LOOP
    IF p_row->>key IS NOT NULL THEN
      subject := (p_row->>key)::uuid;
      IF NOT consent_private.processing_allowed(subject,'health') THEN RETURN false; END IF;
    END IF;
  END LOOP;
  IF p_row->>'baby_id' IS NOT NULL THEN
    SELECT user_id INTO subject FROM public.baby_info WHERE id=(p_row->>'baby_id')::uuid;
    IF (subject IS NULL AND consent_private.is_enabled()) OR (subject IS NOT NULL AND NOT consent_private.processing_allowed(subject,'health')) THEN RETURN false; END IF;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION consent_private.pre_request()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE path text := COALESCE(current_setting('request.path',true),''); uid uuid := auth.uid();
BEGIN
  IF to_regprocedure('consent_private.check_account_deletion_access()') IS NOT NULL THEN
    EXECUTE 'SELECT consent_private.check_account_deletion_access()';
  END IF;
  IF NOT consent_private.rollout_active() THEN RETURN; END IF;
  IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role'='service_role' THEN RETURN; END IF;
  IF path IN ('/rpc/get_data_consents','/rpc/record_data_consent','/rpc/record_terms_consent',
      '/terms_consents','/profiles','/subscription_plans','/subscription_plan_features','/subscription_features',
      '/rpc/get_family_subscription_access','/rpc/get_subscription_feature_policy',
      '/rpc/delete_user_data','/rpc/account_deletion_availability') THEN RETURN; END IF;
  IF NOT consent_private.family_allowed(uid,'health') THEN RAISE EXCEPTION 'health_consent_required' USING ERRCODE='42501'; END IF;
END $$;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT table_name FROM consent_private.protected_tables LOOP
  EXECUTE format('ALTER POLICY data_consent_no_guest ON public.%I USING (NOT (SELECT consent_private.is_enabled()) AND consent_private.row_allowed(to_jsonb(%I))) WITH CHECK (NOT (SELECT consent_private.is_enabled()) AND consent_private.row_allowed(to_jsonb(%I)))',t.table_name,t.table_name,t.table_name);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION consent_private.enforced_for(uuid),consent_private.rollout_active(),consent_private.guard_release_enrollment() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION consent_private.row_allowed(jsonb) TO anon;
-- Existing user_state deletion rule covers these columns. Data-reset retains the
-- enrollment and revision floor, erases grants/events and requires fresh consent.
-- Account deletion removes the entire row. No additional identifiable table.
NOTIFY pgrst,'reload schema';
COMMIT;
