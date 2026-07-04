-- ============================================================
-- Paywall-Sonderzugänge: neue Rolle 'premium_tester'.
--
-- Premiumtester sehen zusätzlich zu den normalen Paywall-Inhalten
-- auch Premium-Features in Erprobung (aktuell: Lottis Fürsorge).
-- Einspielen: Supabase Dashboard → SQL Editor → Run (idempotent).
-- ============================================================

-- 1) Check-Constraint um die neue Rolle erweitern.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_paywall_access_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_paywall_access_role_check
  CHECK (
    paywall_access_role IN ('tester', 'cooperation_partner', 'premium_tester')
  );

-- 2) Admin-RPC neu anlegen — nur die Rollen-Validierung ändert sich.
CREATE OR REPLACE FUNCTION public.admin_set_paywall_access_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS TABLE (
  user_id UUID,
  paywall_access_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_role TEXT := NULLIF(BTRIM(new_role), '');
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_role IS NOT NULL
     AND normalized_role NOT IN ('tester', 'cooperation_partner', 'premium_tester') THEN
    RAISE EXCEPTION 'Invalid paywall access role: %', normalized_role
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Profile not found for user %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  UPDATE public.profiles p
  SET
    paywall_access_role = normalized_role,
    updated_at = NOW()
  WHERE p.id = target_user_id
  RETURNING p.id, p.paywall_access_role;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_paywall_access_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_paywall_access_role(UUID, TEXT) TO authenticated, service_role;
