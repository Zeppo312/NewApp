-- Targeted old-production-schema hotfix. Apply this file alone; do not push
-- pending family/account-deletion migrations as part of the tariff repair.
-- Preserve the function's owner, ACL and private security-definer boundary.
CREATE OR REPLACE FUNCTION caretaker_private.has_premium(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE profile record;
BEGIN
  SELECT is_admin, paywall_access_role INTO profile FROM public.profiles WHERE id = p_user_id;
  IF profile.is_admin IS TRUE OR profile.paywall_access_role = 'premium_tester' THEN RETURN true; END IF;
  IF profile.paywall_access_role IN ('lite_tester', 'tester', 'cooperation_partner') THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.lotti_subscription_entitlements
    WHERE user_id = p_user_id AND COALESCE(tier, CASE WHEN is_premium THEN 'premium' END) = 'premium'
      AND COALESCE(product_id, '') NOT IN ('entl7a7b4e9838', 'LottiBabyAbo')
      AND (expires_at IS NULL OR expires_at > now()));
END;
$function$;
REVOKE ALL ON FUNCTION caretaker_private.has_premium(uuid) FROM PUBLIC, anon, authenticated;
