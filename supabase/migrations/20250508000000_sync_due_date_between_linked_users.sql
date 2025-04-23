-- Skript zur Synchronisierung des Entbindungstermins zwischen verknüpften Benutzern
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Funktion zum Akzeptieren einer Einladung mit Synchronisierung des Entbindungstermins
CREATE OR REPLACE FUNCTION public.accept_invitation_and_sync_due_date(invitation_id UUID, user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_link_data jsonb;
  v_creator_id UUID;
  v_creator_info jsonb;
  v_creator_due_date TIMESTAMPTZ;
  v_creator_is_baby_born BOOLEAN;
  v_user_settings_exist BOOLEAN;
BEGIN
  -- Akzeptieren der Einladung mit der bestehenden Funktion
  SELECT * FROM public.accept_invitation(invitation_id, user_id) INTO v_link_data;
  
  -- Wenn die Einladung nicht akzeptiert werden konnte, Fehler zurückgeben
  IF NOT (v_link_data->>'success')::boolean THEN
    RETURN v_link_data;
  END IF;
  
  -- Abrufen der Creator-ID aus den zurückgegebenen Daten
  v_creator_id := (v_link_data->'data'->>'creator_id')::UUID;
  
  -- Abrufen der Profilinformationen des Erstellers
  SELECT 
    jsonb_build_object(
      'userId', p.id,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'userRole', p.user_role
    ) INTO v_creator_info
  FROM 
    public.profiles p
  WHERE 
    p.id = v_creator_id;
  
  -- Abrufen des Entbindungstermins und des Baby-Status vom Ersteller
  SELECT 
    due_date, is_baby_born INTO v_creator_due_date, v_creator_is_baby_born
  FROM 
    public.user_settings
  WHERE 
    user_id = v_creator_id;
  
  -- Prüfen, ob der eingeladene Benutzer bereits Einstellungen hat
  SELECT 
    EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = user_id) INTO v_user_settings_exist;
  
  -- Wenn der Ersteller einen Entbindungstermin hat, diesen mit dem eingeladenen Benutzer synchronisieren
  IF v_creator_due_date IS NOT NULL THEN
    IF v_user_settings_exist THEN
      -- Aktualisieren der bestehenden Einstellungen
      UPDATE public.user_settings
      SET 
        due_date = v_creator_due_date,
        is_baby_born = v_creator_is_baby_born,
        updated_at = NOW()
      WHERE 
        user_id = user_id;
    ELSE
      -- Erstellen neuer Einstellungen
      INSERT INTO public.user_settings (
        user_id, 
        due_date, 
        is_baby_born, 
        created_at, 
        updated_at
      ) VALUES (
        user_id, 
        v_creator_due_date, 
        v_creator_is_baby_born, 
        NOW(), 
        NOW()
      );
    END IF;
    
    -- Protokollieren der Synchronisierung
    RAISE NOTICE 'Synchronized due date % and baby status % from user % to user %', 
      v_creator_due_date, v_creator_is_baby_born, v_creator_id, user_id;
  END IF;
  
  -- Erfolg mit Benutzerinformationen und synchronisierten Daten zurückgeben
  RETURN jsonb_build_object(
    'success', true, 
    'linkData', v_link_data->'data',
    'creatorInfo', v_creator_info,
    'syncedData', jsonb_build_object(
      'dueDate', v_creator_due_date,
      'isBabyBorn', v_creator_is_baby_born
    )
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.accept_invitation_and_sync_due_date IS 'Akzeptiert eine Einladung, synchronisiert den Entbindungstermin und gibt Informationen über den Ersteller zurück';

-- 2. Funktion zum Einlösen eines Einladungscodes mit Synchronisierung des Entbindungstermins
CREATE OR REPLACE FUNCTION public.redeem_invitation_code_and_sync_due_date(p_invitation_code TEXT, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_invitation_id UUID;
  v_result jsonb;
BEGIN
  -- Zuerst die Einladungs-ID aus dem Code abrufen
  SELECT id INTO v_invitation_id
  FROM public.account_links
  WHERE LOWER(invitation_code) = LOWER(p_invitation_code);
  
  IF v_invitation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Einladungscode nicht gefunden');
  END IF;
  
  -- Die Funktion zum Akzeptieren der Einladung mit Synchronisierung aufrufen
  SELECT * FROM public.accept_invitation_and_sync_due_date(v_invitation_id, p_user_id) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.redeem_invitation_code_and_sync_due_date IS 'Löst einen Einladungscode ein, synchronisiert den Entbindungstermin und gibt Informationen zurück';

-- 3. Funktion zum Abrufen des synchronisierten Entbindungstermins
CREATE OR REPLACE FUNCTION public.get_synced_due_date(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_due_date TIMESTAMPTZ;
  v_is_baby_born BOOLEAN;
  v_synced_from jsonb;
BEGIN
  -- Abrufen der Einstellungen des Benutzers
  SELECT 
    due_date, is_baby_born INTO v_due_date, v_is_baby_born
  FROM 
    public.user_settings
  WHERE 
    user_id = p_user_id;
  
  -- Abrufen des Benutzers, von dem die Daten synchronisiert wurden (falls vorhanden)
  WITH linked_users AS (
    SELECT
      al.creator_id,
      al.invited_id
    FROM
      public.account_links al
    WHERE
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted'
  )
  SELECT
    jsonb_build_object(
      'userId', p.id,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'userRole', p.user_role
    ) INTO v_synced_from
  FROM
    linked_users lu
  JOIN
    public.profiles p ON (
      CASE
        WHEN lu.creator_id = p_user_id THEN lu.invited_id
        ELSE lu.creator_id
      END = p.id
    )
  LIMIT 1;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object(
    'success', true,
    'dueDate', v_due_date,
    'isBabyBorn', v_is_baby_born,
    'syncedFrom', v_synced_from
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_synced_due_date IS 'Gibt den synchronisierten Entbindungstermin und Informationen über den Synchronisierungspartner zurück';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Funktionen für die Synchronisierung des Entbindungstermins wurden erstellt.';
END
$$;
