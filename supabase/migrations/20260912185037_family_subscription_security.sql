-- Apply after the existing subscription cache, moderation and account-deletion
-- migrations (this repository contains historical migrations dated in 2027).
BEGIN;
CREATE SCHEMA IF NOT EXISTS subscription_private;
REVOKE ALL ON SCHEMA subscription_private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.lotti_subscription_entitlements
  ADD COLUMN paid_tier text CHECK (paid_tier IN ('lite','standard','premium')),
  ADD COLUMN paid_expires_at timestamptz,
  ADD COLUMN paid_subscription_id text,
  ADD COLUMN paid_verified_at timestamptz,
  ADD COLUMN paid_reconcile_attempted_at timestamptz,
  ADD CONSTRAINT paid_evidence_complete CHECK (
    (paid_tier IS NULL AND paid_expires_at IS NULL AND paid_subscription_id IS NULL) OR
    (paid_tier IS NOT NULL AND paid_expires_at IS NOT NULL AND paid_subscription_id IS NOT NULL AND paid_verified_at IS NOT NULL));
CREATE UNIQUE INDEX subscription_paid_owner ON public.lotti_subscription_entitlements(paid_subscription_id)
  WHERE paid_subscription_id IS NOT NULL;
REVOKE ALL ON public.lotti_subscription_entitlements FROM PUBLIC, anon, authenticated;

-- A user can occupy exactly one partner slot, regardless of invitation direction.
-- Old links were writable via insecure legacy RPCs, so they are NOT backfilled.
CREATE TABLE subscription_private.members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.account_links(id) ON DELETE CASCADE
);
ALTER TABLE subscription_private.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_private.members FROM PUBLIC, anon, authenticated;
CREATE INDEX subscription_members_link ON subscription_private.members(link_id);

-- This trigger also checks writes made by legacy SECURITY DEFINER functions.
CREATE FUNCTION subscription_private.guard_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  PERFORM pg_advisory_xact_lock(72481023001);
  IF TG_OP='DELETE' THEN
    DELETE FROM subscription_private.members WHERE link_id=OLD.id;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'pending' OR NEW.invited_id IS NOT NULL OR NEW.accepted_at IS NOT NULL OR
       actor IS NULL OR NEW.creator_id IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'invitation must be created by its sender in pending state' USING ERRCODE='42501';
    END IF;
    NEW.invitation_code := replace(gen_random_uuid()::text,'-','');
    NEW.expires_at := now()+interval '7 days';
  ELSE
    IF actor IS NULL OR actor NOT IN (OLD.creator_id, COALESCE(OLD.invited_id,actor)) OR
       NEW.id IS DISTINCT FROM OLD.id OR NEW.creator_id IS DISTINCT FROM OLD.creator_id OR
       NEW.relationship_type IS DISTINCT FROM OLD.relationship_type OR
       NEW.invitation_code IS DISTINCT FROM OLD.invitation_code OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'family fields are server-managed' USING ERRCODE='42501';
    END IF;
    IF NEW.status='accepted' AND OLD.status='pending' THEN
      IF NEW.relationship_type IS DISTINCT FROM 'partner' OR NEW.invited_id IS DISTINCT FROM actor OR
         actor=OLD.creator_id OR OLD.expires_at<=now() OR
         (OLD.invited_id IS NOT NULL AND OLD.invited_id<>actor) OR
         deletion_private.blocked(actor) OR deletion_private.blocked(OLD.creator_id) THEN
        RAISE EXCEPTION 'invalid partner acceptance' USING ERRCODE='42501';
      END IF;
      NEW.accepted_at := now();
      -- Primary key prevents concurrent and reversed A-B/B-C/A-C chains.
      INSERT INTO subscription_private.members(user_id,link_id)
        VALUES (OLD.creator_id,OLD.id),(actor,OLD.id);
    ELSIF NEW.status='rejected' AND OLD.status IN ('pending','accepted') AND
          actor IN (OLD.creator_id,OLD.invited_id) AND
          NEW.invited_id IS NOT DISTINCT FROM OLD.invited_id AND
          NEW.accepted_at IS NOT DISTINCT FROM OLD.accepted_at THEN
      DELETE FROM subscription_private.members WHERE link_id=OLD.id;
    ELSE
      RAISE EXCEPTION 'invalid partner transition' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subscription_link_guard BEFORE INSERT OR UPDATE OR DELETE ON public.account_links
  FOR EACH ROW EXECUTE FUNCTION subscription_private.guard_link();
REVOKE ALL ON FUNCTION subscription_private.guard_link() FROM PUBLIC,anon,authenticated;

-- Replace permissive policies, including global pending-invitation visibility.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='account_links'
    AND permissive='PERMISSIVE' LOOP
    EXECUTE format('DROP POLICY %I ON public.account_links',p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.account_links TO authenticated;
GRANT INSERT(creator_id,invitation_code,relationship_type) ON public.account_links TO authenticated;
GRANT UPDATE(status) ON public.account_links TO authenticated;
CREATE POLICY subscription_link_read ON public.account_links FOR SELECT TO authenticated
  USING (auth.uid() IN (creator_id,invited_id));
CREATE POLICY subscription_link_insert ON public.account_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=creator_id AND status='pending' AND invited_id IS NULL);
CREATE POLICY subscription_link_end ON public.account_links FOR UPDATE TO authenticated
  USING (auth.uid() IN (creator_id,invited_id))
  WITH CHECK (auth.uid() IN (creator_id,invited_id) AND status='rejected');
CREATE POLICY subscription_link_delete ON public.account_links FOR DELETE TO authenticated
  USING (auth.uid() IN (creator_id,invited_id));

CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_id uuid,user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'caller mismatch' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(72481023001);
  UPDATE public.account_links a SET invited_id=auth.uid(),status='accepted',accepted_at=now()
    WHERE a.id=invitation_id AND a.status='pending' AND a.expires_at>now()
      AND a.creator_id<>auth.uid() AND (a.invited_id IS NULL OR a.invited_id=auth.uid())
    RETURNING to_jsonb(a.*) INTO result;
  IF result IS NULL THEN RETURN jsonb_build_object('success',false,'error','Invalid invitation'); END IF;
  RETURN jsonb_build_object('success',true,'data',result);
END $$;
REVOKE ALL ON FUNCTION public.accept_invitation(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid,uuid) TO authenticated;

-- Legacy/debug entry points may expose secret codes or bypass caller checks.
-- Keep only the app's public acceptance wrappers; they delegate to the guard above.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure signature,p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND
    (p.proname LIKE '%invitation%' OR p.proname IN ('get_linked_users_with_info')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
    IF f.proname IN ('accept_invitation','accept_invitation_and_sync_due_date',
        'redeem_invitation_code_and_sync_due_date','redeem_invitation_by_code_and_sync_due_date') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
    END IF;
  END LOOP;
END $$;
-- Preserve read APIs, but enforce caller identity even inside definer wrappers.
DO $$ DECLARE f record; definition text; BEGIN
  FOR f IN SELECT p.oid::regprocedure signature,p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('get_user_invitations_with_info','get_linked_users_with_info') LOOP
    definition := pg_get_functiondef(f.oid);
    definition := regexp_replace(definition,'\mBEGIN\M',
      E'BEGIN\n IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ''caller mismatch'' USING ERRCODE=''42501''; END IF;', 'i');
    EXECUTE definition;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END LOOP;
END $$;
ALTER TABLE public.account_links_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_links_audit_log FROM PUBLIC,anon,authenticated;

-- Resolve one hop only, from purchased evidence; never from an effective tier.
CREATE FUNCTION subscription_private.family_state(uid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sponsor uuid; e public.lotti_subscription_entitlements; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(72481023001);
  IF uid IS NULL OR deletion_private.blocked(uid) THEN
    RAISE EXCEPTION 'account unavailable' USING ERRCODE='42501';
  END IF;
  result := jsonb_build_object('schemaVersion',1,'userId',uid,'status','none');
  SELECT b.user_id INTO sponsor FROM subscription_private.members a
    JOIN subscription_private.members b ON b.link_id=a.link_id AND b.user_id<>a.user_id
    JOIN public.account_links l ON l.id=a.link_id AND l.status='accepted' AND l.relationship_type='partner'
    WHERE a.user_id=uid;
  IF sponsor IS NULL OR deletion_private.blocked(sponsor) THEN RETURN result; END IF;
  SELECT * INTO e FROM public.lotti_subscription_entitlements WHERE user_id=sponsor;
  IF e.paid_verified_at IS NULL OR e.paid_verified_at>clock_timestamp() OR
     e.paid_verified_at<=clock_timestamp()-interval '5 minutes' OR
     (e.paid_tier IS NOT NULL AND e.paid_expires_at<=clock_timestamp()) THEN
    RETURN result || jsonb_build_object('status','stale','sponsorId',sponsor);
  END IF;
  IF e.paid_tier IS NULL OR e.paid_expires_at<=clock_timestamp() THEN RETURN result; END IF;
  RETURN result || jsonb_build_object('status','active','sponsorId',sponsor,'tier',e.paid_tier,
    'expiresAt',e.paid_expires_at,'validUntil',least(e.paid_expires_at,e.paid_verified_at+interval '5 minutes'));
END $$;
REVOKE ALL ON FUNCTION subscription_private.family_state(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.family_subscription_state(p_user_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT subscription_private.family_state(p_user_id) $$;
REVOKE ALL ON FUNCTION public.family_subscription_state(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.family_subscription_state(uuid) TO service_role;
CREATE FUNCTION public.get_family_subscription_access() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  result := subscription_private.family_state(auth.uid());
  IF result->>'status'='stale' THEN RAISE EXCEPTION 'family_verification_required' USING ERRCODE='P0001'; END IF;
  RETURN result-'sponsorId';
END $$;
REVOKE ALL ON FUNCTION public.get_family_subscription_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_family_subscription_access() TO authenticated;

-- Recheck entitlement and family membership in the SAME transaction as quota
-- reservation; both partners consume the paying account's fixed budget.
CREATE FUNCTION subscription_private.quota_owner(uid uuid, p_feature_key text DEFAULT 'fragLotti') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE own_tier text; family jsonb; owner_id uuid:=uid; special text;
BEGIN
  PERFORM pg_advisory_xact_lock(72481023001);
  IF deletion_private.blocked(uid) THEN RETURN NULL; END IF;
  SELECT CASE WHEN is_admin OR paywall_access_role='premium_tester' THEN 'premium'
    WHEN paywall_access_role='lite_tester' THEN 'lite'
    WHEN paywall_access_role IN ('tester','cooperation_partner') THEN 'standard' END
    INTO special FROM public.profiles WHERE id=uid;
  own_tier:=special;
  IF special IS NULL THEN
    SELECT tier INTO own_tier FROM public.lotti_subscription_entitlements
      WHERE user_id=uid AND (expires_at IS NULL OR expires_at>clock_timestamp())
      AND checked_at BETWEEN clock_timestamp()-interval '24 hours' AND clock_timestamp();
    family:=subscription_private.family_state(uid);
    IF family->>'status'='active' AND
      array_position(ARRAY['lite','standard','premium'],family->>'tier')>
      COALESCE(array_position(ARRAY['lite','standard','premium'],own_tier),0) THEN
      own_tier:=family->>'tier'; owner_id:=(family->>'sponsorId')::uuid;
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.subscription_plan_features
    WHERE plan_key=own_tier AND feature_key=p_feature_key AND enabled) THEN RETURN owner_id; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION subscription_private.quota_owner(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.consume_lotti_ai_quota(
  p_user_id UUID,
  p_baby_id UUID,
  p_request_id UUID,
  p_feature TEXT DEFAULT 'ask_lotti'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_minute_start TIMESTAMPTZ := date_trunc('minute', v_now);
  v_day_start TIMESTAMPTZ := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_start TIMESTAMPTZ := date_trunc('month', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used INTEGER;
  v_owner UUID;
  v_existing_status TEXT;
BEGIN
  IF p_feature <> 'ask_lotti' THEN
    RAISE EXCEPTION 'unsupported feature';
  END IF;

  v_owner := subscription_private.quota_owner(p_user_id);
  IF v_owner IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','not_entitled'); END IF;

  -- Serialize quota consumption per user and feature. This prevents parallel
  -- requests from passing a count-then-insert race.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::TEXT || ':' || p_feature, 0));

  SELECT status INTO v_existing_status
  FROM public.lotti_ai_requests
  WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'duplicate_request',
      'requestStatus', v_existing_status
    );
  END IF;

  SELECT used INTO v_used
  FROM public.lotti_ai_usage_buckets
  WHERE user_id = v_owner AND feature = p_feature
    AND window_kind = 'minute' AND window_start = v_minute_start;
  IF COALESCE(v_used, 0) >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'rate_limit', 'window', 'minute', 'retryAt', v_minute_start + INTERVAL '1 minute');
  END IF;

  SELECT used INTO v_used
  FROM public.lotti_ai_usage_buckets
  WHERE user_id = v_owner AND feature = p_feature
    AND window_kind = 'day' AND window_start = v_day_start;
  IF COALESCE(v_used, 0) >= 20 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'rate_limit', 'window', 'day', 'retryAt', v_day_start + INTERVAL '1 day');
  END IF;

  SELECT used INTO v_used
  FROM public.lotti_ai_usage_buckets
  WHERE user_id = v_owner AND feature = p_feature
    AND window_kind = 'month' AND window_start = v_month_start;
  IF COALESCE(v_used, 0) >= 300 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'rate_limit', 'window', 'month', 'retryAt', v_month_start + INTERVAL '1 month');
  END IF;

  INSERT INTO public.lotti_ai_usage_buckets (user_id, feature, window_kind, window_start, used, expires_at)
  VALUES
    (v_owner, p_feature, 'minute', v_minute_start, 1, v_minute_start + INTERVAL '2 minutes'),
    (v_owner, p_feature, 'day', v_day_start, 1, v_day_start + INTERVAL '2 days'),
    (v_owner, p_feature, 'month', v_month_start, 1, v_month_start + INTERVAL '2 months')
  ON CONFLICT (user_id, feature, window_kind, window_start)
  DO UPDATE SET used = public.lotti_ai_usage_buckets.used + 1;

  INSERT INTO public.lotti_ai_requests (
    user_id, baby_id, request_id, feature, status
  ) VALUES (
    p_user_id, p_baby_id, p_request_id, p_feature, 'accepted'
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', jsonb_build_object(
      'minute', 2 - COALESCE((SELECT used FROM public.lotti_ai_usage_buckets WHERE user_id = v_owner AND feature = p_feature AND window_kind = 'minute' AND window_start = v_minute_start), 1) + 1,
      'day', 19 - COALESCE((SELECT used FROM public.lotti_ai_usage_buckets WHERE user_id = v_owner AND feature = p_feature AND window_kind = 'day' AND window_start = v_day_start), 1) + 1,
      'month', 299 - COALESCE((SELECT used FROM public.lotti_ai_usage_buckets WHERE user_id = v_owner AND feature = p_feature AND window_kind = 'month' AND window_start = v_month_start), 1) + 1
    ),
    'resetsAt', jsonb_build_object(
      'minute', v_minute_start + INTERVAL '1 minute',
      'day', v_day_start + INTERVAL '1 day',
      'month', v_month_start + INTERVAL '1 month'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_lotti_ai_quota(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_lotti_ai_quota(UUID, UUID, UUID, TEXT) TO service_role;



-- A bounded repair queue for missed webhooks. Attempts never extend access.
CREATE FUNCTION public.claim_family_subscription_rechecks() RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.lotti_subscription_entitlements(user_id,source)
    SELECT user_id,'revenuecat_api' FROM subscription_private.members
    WHERE NOT deletion_private.blocked(user_id) ON CONFLICT(user_id) DO NOTHING;
  RETURN QUERY WITH candidates AS (
    SELECT e.user_id FROM public.lotti_subscription_entitlements e
    WHERE EXISTS(SELECT 1 FROM subscription_private.members m WHERE m.user_id=e.user_id)
      AND NOT deletion_private.blocked(e.user_id)
      AND (e.paid_verified_at IS NULL OR e.paid_verified_at<now()-interval '4 minutes')
      AND (e.paid_reconcile_attempted_at IS NULL OR e.paid_reconcile_attempted_at<now()-interval '1 minute')
    ORDER BY e.paid_reconcile_attempted_at NULLS FIRST,e.user_id LIMIT 20 FOR UPDATE SKIP LOCKED
  ) UPDATE public.lotti_subscription_entitlements e SET paid_reconcile_attempted_at=now()
    FROM candidates c WHERE e.user_id=c.user_id RETURNING e.user_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_family_subscription_rechecks() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_family_subscription_rechecks() TO service_role;

ALTER TABLE public.lotti_ai_usage_buckets DROP CONSTRAINT lotti_ai_usage_buckets_feature_check;
ALTER TABLE public.lotti_ai_usage_buckets ADD CONSTRAINT lotti_ai_usage_buckets_feature_check
  CHECK(feature IN ('ask_lotti','advisor'));
CREATE FUNCTION public.consume_advisor_ai_quota(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid; used_count integer; day_start timestamptz;
BEGIN
  owner_id:=subscription_private.quota_owner(p_user_id,'fuersorge');
  IF owner_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','not_entitled'); END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id AND is_admin) THEN
    RETURN jsonb_build_object('allowed',true,'used',0);
  END IF;
  day_start:=date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  INSERT INTO public.lotti_ai_usage_buckets(user_id,feature,window_kind,window_start,used,expires_at)
    VALUES(owner_id,'advisor','day',day_start,1,day_start+interval '2 days')
    ON CONFLICT(user_id,feature,window_kind,window_start) DO UPDATE
    SET used=public.lotti_ai_usage_buckets.used+1 WHERE public.lotti_ai_usage_buckets.used<3
    RETURNING used INTO used_count;
  RETURN jsonb_build_object('allowed',used_count IS NOT NULL,'used',COALESCE(used_count,3));
END $$;
REVOKE ALL ON FUNCTION public.consume_advisor_ai_quota(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_advisor_ai_quota(uuid) TO service_role;
COMMIT;
