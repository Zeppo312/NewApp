ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS paywall_access_role TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_paywall_access_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_paywall_access_role_check
      CHECK (
        paywall_access_role IN ('tester', 'cooperation_partner')
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.profiles.paywall_access_role IS
  'Sonderzugang zur Umgehung der Paywall ohne Admin-Rechte';

CREATE INDEX IF NOT EXISTS profiles_paywall_access_role_idx
  ON public.profiles (paywall_access_role);

DROP FUNCTION IF EXISTS public.admin_search_paywall_access_users(TEXT);

CREATE OR REPLACE FUNCTION public.admin_search_paywall_access_users(search_text TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  is_admin BOOLEAN,
  paywall_access_role TEXT,
  has_profile BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_search TEXT := NULLIF(BTRIM(search_text), '');
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

  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.email::TEXT AS email,
    p.first_name,
    p.last_name,
    p.username,
    COALESCE(p.is_admin, FALSE) AS is_admin,
    p.paywall_access_role,
    (p.id IS NOT NULL) AS has_profile
  FROM auth.users au
  LEFT JOIN public.profiles p
    ON p.id = au.id
  WHERE (
    normalized_search IS NULL
    OR au.email ILIKE '%' || normalized_search || '%'
    OR COALESCE(p.first_name, '') ILIKE '%' || normalized_search || '%'
    OR COALESCE(p.last_name, '') ILIKE '%' || normalized_search || '%'
    OR COALESCE(p.username, '') ILIKE '%' || normalized_search || '%'
  )
  ORDER BY
    CASE
      WHEN normalized_search IS NOT NULL
        AND au.email ILIKE normalized_search || '%'
      THEN 0
      ELSE 1
    END,
    COALESCE(p.updated_at, au.created_at) DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_paywall_access_users(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_paywall_access_users(TEXT) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.admin_set_paywall_access_role(UUID, TEXT);

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
     AND normalized_role NOT IN ('tester', 'cooperation_partner') THEN
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
