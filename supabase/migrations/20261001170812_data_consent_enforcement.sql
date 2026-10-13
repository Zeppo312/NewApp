-- Install in QA first. Never globally enable as part of migration/deployment.
BEGIN;
CREATE TABLE consent_private.protected_tables(table_name text PRIMARY KEY);
INSERT INTO consent_private.protected_tables VALUES
 ('user_settings'),('baby_info'),('baby_members'),('baby_care_entries'),('sleep_entries'),
 ('sleep_entry_shares'),('sleep_personalization'),('feeding_events'),('feeding_preferences'),
 ('weight_entries'),('size_entries'),('tooth_entries'),('contractions'),('cycle_daily_logs'),
 ('cycle_periods'),('cycle_settings'),('selfcare_entries'),('geburtsplan'),('hospital_checklist'),
 ('doctor_questions'),('custom_activity_types'),('baby_daily'),('baby_daily_habit_checks'),
 ('baby_diary'),('baby_current_phase'),('baby_milestone_entries'),('baby_milestone_progress'),
 ('advisor_mama_checkins'),('advisor_messages'),('advisor_relief_events'),('advisor_settings'),
 ('baby_reminder_notifications'),('partner_activity_notifications'),('planner_days'),
 ('planner_blocks'),('planner_items'),('planner_recurring_items'),('planner_recurring_exceptions'),
 ('planner_calendar_sync_links'),('planner_calendar_sync_settings'),('planner_notifications'),
 ('lotti_ai_requests'),('lotti_ai_usage_buckets'),('voice_log_requests');
ALTER TABLE consent_private.protected_tables ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON consent_private.protected_tables FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION consent_private.is_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT enabled OR activated_at IS NOT NULL FROM consent_private.settings WHERE singleton
$$;

-- Shared data is not made available through a consented partner after its
-- source withdraws. Existing membership/RLS authorization remains required.
CREATE FUNCTION consent_private.family_allowed(p_user_id uuid,p_scope text DEFAULT 'health')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT consent_private.is_enabled() THEN RETURN true; END IF;
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
CREATE OR REPLACE FUNCTION consent_private.processing_allowed(p_user_id uuid,p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN NOT (enabled OR activated_at IS NOT NULL) THEN true ELSE
    p_user_id IS NOT NULL AND p_scope IN ('health','ai') AND consent_private.has_consent(p_user_id,'health')
    AND (p_scope='health' OR consent_private.has_consent(p_user_id,'ai')) END
  FROM consent_private.settings WHERE singleton
$$;
CREATE FUNCTION consent_private.service_check(p_user_id uuid,p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT consent_private.family_allowed(p_user_id,p_scope)
$$;
CREATE OR REPLACE FUNCTION public.check_data_processing_consent(p_user_id uuid,p_scope text DEFAULT 'health')
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT consent_private.service_check(p_user_id,p_scope)
$$;
CREATE FUNCTION consent_private.row_allowed(p_row jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE key text; subject uuid;
BEGIN
  IF NOT consent_private.is_enabled() THEN RETURN true; END IF;
  FOREACH key IN ARRAY ARRAY['user_id','owner_id','created_by','partner_id','shared_with_user_id'] LOOP
    IF p_row->>key IS NOT NULL THEN
      subject := (p_row->>key)::uuid;
      IF NOT consent_private.processing_allowed(subject,'health') THEN RETURN false; END IF;
    END IF;
  END LOOP;
  IF p_row->>'baby_id' IS NOT NULL THEN
    SELECT user_id INTO subject FROM public.baby_info WHERE id=(p_row->>'baby_id')::uuid;
    IF subject IS NULL OR NOT consent_private.processing_allowed(subject,'health') THEN RETURN false; END IF;
  END IF;
  RETURN true;
END $$;
CREATE FUNCTION consent_private.guard_health_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Required account deletion keeps its separate legal purpose and guards.
  IF current_setting('request.path',true)='/rpc/account_deletion_worker'
    AND COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role'='service_role' THEN RETURN NEW; END IF;
  IF NOT consent_private.row_allowed(to_jsonb(NEW)) THEN RAISE EXCEPTION 'health_consent_required' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT table_name FROM consent_private.protected_tables LOOP
    IF to_regclass('public.'||item.table_name) IS NULL THEN RAISE EXCEPTION 'consent_table_missing: %',item.table_name; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||item.table_name)) THEN RAISE EXCEPTION 'consent_table_requires_rls: %',item.table_name; END IF;
    EXECUTE format('CREATE POLICY data_consent_health ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (consent_private.family_allowed((SELECT auth.uid())) AND consent_private.row_allowed(to_jsonb(%I))) WITH CHECK (consent_private.family_allowed((SELECT auth.uid())) AND consent_private.row_allowed(to_jsonb(%I)))',item.table_name,item.table_name,item.table_name);
    EXECUTE format('CREATE POLICY data_consent_no_guest ON public.%I AS RESTRICTIVE FOR ALL TO anon USING (NOT (SELECT consent_private.is_enabled())) WITH CHECK (NOT (SELECT consent_private.is_enabled()))',item.table_name);
    EXECUTE format('CREATE TRIGGER data_consent_health_write BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION consent_private.guard_health_write()',item.table_name);
  END LOOP;
END $$;
-- PostgREST also protects existing SECURITY DEFINER RPCs, which can bypass RLS.
CREATE FUNCTION consent_private.pre_request()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE path text := COALESCE(current_setting('request.path',true),''); uid uuid := auth.uid();
BEGIN
  IF to_regprocedure('consent_private.check_account_deletion_access()') IS NOT NULL THEN
    EXECUTE 'SELECT consent_private.check_account_deletion_access()';
  END IF;
  IF NOT consent_private.is_enabled() THEN RETURN; END IF;
  IF COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role'='service_role' THEN RETURN; END IF;
  IF path IN ('/rpc/get_data_consents','/rpc/record_data_consent','/rpc/record_terms_consent',
      '/terms_consents','/profiles','/subscription_plans','/subscription_plan_features','/subscription_features',
      '/rpc/get_family_subscription_access','/rpc/get_subscription_feature_policy',
      '/rpc/delete_user_data','/rpc/account_deletion_availability') THEN RETURN; END IF;
  IF NOT consent_private.family_allowed(uid,'health') THEN RAISE EXCEPTION 'health_consent_required' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.check_data_consent_access()
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT consent_private.pre_request() $$;
DO $$ DECLARE hook text; BEGIN
  SELECT setting INTO hook FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig) setting
    WHERE rolname='authenticator' AND setting LIKE 'pgrst.db_pre_request=%';
  IF hook IS NOT NULL AND hook<>'pgrst.db_pre_request=public.check_account_deletion_access' THEN RAISE EXCEPTION 'consent_hook_requires_composition'; END IF;
  IF hook='pgrst.db_pre_request=public.check_account_deletion_access' THEN
    -- Keep the canonical hook name required by deletion readiness and workers.
    -- Move the exact previous body, then compose it ahead of the consent check.
    ALTER FUNCTION public.check_account_deletion_access() SET SCHEMA consent_private;
    EXECUTE 'CREATE FUNCTION public.check_account_deletion_access() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $hook$ SELECT consent_private.pre_request() $hook$';
    REVOKE ALL ON FUNCTION public.check_account_deletion_access() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.check_account_deletion_access() TO anon,authenticated,service_role;
  ELSE
    ALTER ROLE authenticator SET pgrst.db_pre_request='public.check_data_consent_access';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION consent_private.guard_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.activated_at IS NOT NULL AND NEW.activated_at IS DISTINCT FROM OLD.activated_at THEN RAISE EXCEPTION 'consent_activation_is_permanent'; END IF;
  IF NEW.enabled THEN
    IF NULLIF(NEW.client_release,'') IS NULL OR NULLIF(NEW.edge_release,'') IS NULL OR NEW.approved_at IS NULL
      OR NOT EXISTS(SELECT 1 FROM consent_private.documents WHERE version=NEW.document_version)
      OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator' AND
        ('pgrst.db_pre_request=public.check_data_consent_access'=ANY(rolconfig) OR
          ('pgrst.db_pre_request=public.check_account_deletion_access'=ANY(rolconfig)
           AND to_regprocedure('consent_private.check_account_deletion_access()') IS NOT NULL
           AND position('consent_private.pre_request()' in pg_get_functiondef(to_regprocedure('public.check_account_deletion_access()')))>0)))
      OR EXISTS(SELECT 1 FROM consent_private.protected_tables t WHERE
        NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('public.'||t.table_name) AND polname='data_consent_health' AND NOT polpermissive)
        OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||t.table_name) AND tgname='data_consent_health_write' AND tgenabled='O')) THEN
      RAISE EXCEPTION 'consent_activation_requires_verified_release' USING ERRCODE='55000';
    END IF;
  END IF;
  IF NEW.enabled AND NEW.activated_at IS NULL THEN NEW.activated_at := clock_timestamp(); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA consent_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION consent_private.own_snapshot(),consent_private.record_decision(text,text,text,text,uuid,bigint),
  consent_private.pre_request(),consent_private.family_allowed(uuid,text),consent_private.row_allowed(jsonb),consent_private.is_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION consent_private.pre_request(),consent_private.is_enabled() TO anon;
GRANT USAGE ON SCHEMA consent_private TO anon;
GRANT EXECUTE ON FUNCTION consent_private.service_check(uuid,text),consent_private.pre_request() TO service_role;
REVOKE ALL ON FUNCTION public.check_data_consent_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_data_consent_access() TO anon,authenticated,service_role;
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';
COMMIT;
