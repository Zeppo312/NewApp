-- Apply only after account deletion, family security and the 24 September tier guard.
-- Keep the product-based legacy rejection in every SQL subscription consumer.
BEGIN;
CREATE OR REPLACE FUNCTION subscription_private.quota_owner(uid uuid, p_feature_key text DEFAULT 'fragLotti') RETURNS uuid
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
      AND COALESCE(product_id, '') NOT IN ('entl7a7b4e9838', 'LottiBabyAbo')
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

CREATE OR REPLACE FUNCTION caretaker_private.has_premium(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE profile record; family jsonb;
BEGIN
  IF p_user_id IS NULL OR deletion_private.blocked(p_user_id) THEN RETURN false; END IF;
  SELECT is_admin, paywall_access_role INTO profile FROM public.profiles WHERE id = p_user_id;
  IF profile.is_admin IS TRUE OR profile.paywall_access_role = 'premium_tester' THEN RETURN true; END IF;
  IF profile.paywall_access_role IN ('lite_tester', 'tester', 'cooperation_partner') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.lotti_subscription_entitlements
    WHERE user_id = p_user_id AND COALESCE(tier, CASE WHEN is_premium THEN 'premium' END) = 'premium'
      AND COALESCE(product_id, '') NOT IN ('entl7a7b4e9838', 'LottiBabyAbo')
      AND (expires_at IS NULL OR expires_at > now())) THEN RETURN true; END IF;
  family := subscription_private.family_state(p_user_id);
  RETURN family->>'status' = 'active' AND family->>'tier' = 'premium';
END;
$function$;
REVOKE ALL ON FUNCTION caretaker_private.has_premium(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
