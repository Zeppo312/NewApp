-- Historical QA permission DDL, no account or health rows. Live catalog equivalence must be checked separately.
CREATE OR REPLACE FUNCTION public.check_sleep_entry_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_uid uuid;
  v_user_id uuid;
  v_partner_id uuid;
BEGIN
  -- Versuche, den aktuellen User zu ermitteln
  -- 1. auth.uid() (Supabase-Shortcut)
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN others THEN
    v_uid := NULL;
  END;

  -- 2. Fallback: JWT-Claims, falls gesetzt
  IF v_uid IS NULL THEN
    BEGIN
      v_uid := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    EXCEPTION WHEN others THEN
      v_uid := NULL;
    END;
  END IF;

  -- Wenn KEIN User kontext vorhanden ist (SQL Editor, Migration, service_role):
  -- -> nicht blockieren, einfach durchlassen
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- user_id / partner_id aus NEW oder (für DELETE) aus OLD ziehen
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_partner_id := COALESCE(NEW.partner_id, OLD.partner_id);

  -- Nur erlauben, wenn der User entweder owner oder partner ist
  IF v_uid = v_user_id OR v_uid = v_partner_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Keine Berechtigung zum Ändern dieses Schlafeintrags';
END;
$function$
;
CREATE TRIGGER sleep_entry_permissions_trigger BEFORE UPDATE ON public.sleep_entries FOR EACH ROW EXECUTE FUNCTION check_sleep_entry_permissions();
