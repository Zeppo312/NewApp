-- Prevent privilege escalation through a direct profiles insert/update.
-- Existing profile RLS lets users maintain their own profile, which must not
-- also allow them to grant themselves admin or paywall-bypass privileges.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.is_admin, FALSE) OR NEW.paywall_access_role IS NOT NULL THEN
        RAISE EXCEPTION 'profile privilege fields are server-managed'
          USING ERRCODE = '42501';
      END IF;
    ELSIF OLD.is_admin IS DISTINCT FROM NEW.is_admin
       OR OLD.paywall_access_role IS DISTINCT FROM NEW.paywall_access_role THEN
      RAISE EXCEPTION 'profile privilege fields are server-managed'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_privilege_fields ON public.profiles;

CREATE TRIGGER protect_profile_privilege_fields
BEFORE INSERT OR UPDATE OF is_admin, paywall_access_role
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

COMMENT ON FUNCTION public.prevent_profile_privilege_escalation() IS
  'Blocks anon/authenticated clients from changing is_admin or paywall_access_role; trusted SECURITY DEFINER admin RPCs and service_role remain allowed.';
