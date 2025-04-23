-- Skript zur Vereinfachung der Synchronisierung des Entbindungstermins
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Alle bestehenden Trigger und Funktionen entfernen
DROP TRIGGER IF EXISTS sync_due_date_trigger ON public.user_settings;
DROP TRIGGER IF EXISTS reset_sync_flag_trigger ON public.user_settings;
DROP FUNCTION IF EXISTS public.sync_due_date_on_update();
DROP FUNCTION IF EXISTS public.reset_sync_flag();

-- 2. Einfache Funktion zum manuellen Synchronisieren des Entbindungstermins
CREATE OR REPLACE FUNCTION public.sync_due_date_to_linked_users(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_due_date TIMESTAMPTZ;
  v_is_baby_born BOOLEAN;
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT 
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
BEGIN
  -- Abrufen der Einstellungen des Benutzers
  SELECT 
    due_date, is_baby_born INTO v_due_date, v_is_baby_born
  FROM 
    public.user_settings
  WHERE 
    user_id = p_user_id;
  
  -- Wenn keine Einstellungen gefunden wurden, Fehler zurückgeben
  IF v_due_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Keine Einstellungen für den Benutzer gefunden'
    );
  END IF;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Prüfen, ob der verknüpfte Benutzer bereits Einstellungen hat
    IF EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = v_linked_user_id) THEN
      -- Aktualisieren der bestehenden Einstellungen
      UPDATE public.user_settings
      SET 
        due_date = v_due_date,
        is_baby_born = v_is_baby_born,
        updated_at = NOW()
      WHERE 
        user_id = v_linked_user_id;
    ELSE
      -- Erstellen neuer Einstellungen
      INSERT INTO public.user_settings (
        user_id, 
        due_date, 
        is_baby_born, 
        created_at, 
        updated_at
      ) VALUES (
        v_linked_user_id, 
        v_due_date, 
        v_is_baby_born, 
        NOW(), 
        NOW()
      );
    END IF;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object(
    'success', true,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_due_date_to_linked_users IS 'Synchronisiert den Entbindungstermin manuell mit allen verknüpften Benutzern';

-- 3. Funktion zum Abrufen des Entbindungstermins mit Informationen über verknüpfte Benutzer
CREATE OR REPLACE FUNCTION public.get_due_date_with_linked_users(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_due_date TIMESTAMPTZ;
  v_is_baby_born BOOLEAN;
  v_linked_users jsonb := '[]'::jsonb;
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT 
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
BEGIN
  -- Abrufen der Einstellungen des Benutzers
  SELECT 
    due_date, is_baby_born INTO v_due_date, v_is_baby_born
  FROM 
    public.user_settings
  WHERE 
    user_id = p_user_id;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object(
    'success', true,
    'dueDate', v_due_date,
    'isBabyBorn', v_is_baby_born,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_due_date_with_linked_users IS 'Gibt den Entbindungstermin und Informationen über verknüpfte Benutzer zurück';

-- 4. Funktion zum Aktualisieren des Entbindungstermins und Synchronisieren mit verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.update_due_date_and_sync(p_user_id UUID, p_due_date TIMESTAMPTZ)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_user_settings_exist BOOLEAN;
  v_sync_result jsonb;
BEGIN
  -- Prüfen, ob der Benutzer bereits Einstellungen hat
  SELECT 
    EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) INTO v_user_settings_exist;
  
  -- Aktualisieren oder Erstellen der Einstellungen
  IF v_user_settings_exist THEN
    -- Aktualisieren der bestehenden Einstellungen
    UPDATE public.user_settings
    SET 
      due_date = p_due_date,
      updated_at = NOW()
    WHERE 
      user_id = p_user_id;
  ELSE
    -- Erstellen neuer Einstellungen
    INSERT INTO public.user_settings (
      user_id, 
      due_date, 
      is_baby_born, 
      created_at, 
      updated_at
    ) VALUES (
      p_user_id, 
      p_due_date, 
      false, -- Standardwert
      NOW(), 
      NOW()
    );
  END IF;
  
  -- Synchronisieren mit verknüpften Benutzern
  SELECT * FROM public.sync_due_date_to_linked_users(p_user_id) INTO v_sync_result;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object(
    'success', true,
    'dueDate', p_due_date,
    'syncResult', v_sync_result
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.update_due_date_and_sync IS 'Aktualisiert den Entbindungstermin und synchronisiert ihn mit verknüpften Benutzern';

-- 5. Funktion zum Aktualisieren des Baby-Status und Synchronisieren mit verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.update_baby_born_status_and_sync(p_user_id UUID, p_is_baby_born BOOLEAN)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_user_settings_exist BOOLEAN;
  v_sync_result jsonb;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- Prüfen, ob der Benutzer bereits Einstellungen hat
  SELECT 
    EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) INTO v_user_settings_exist;
  
  -- Wenn der Benutzer Einstellungen hat, den Entbindungstermin abrufen
  IF v_user_settings_exist THEN
    SELECT 
      due_date INTO v_due_date
    FROM 
      public.user_settings
    WHERE 
      user_id = p_user_id;
  ELSE
    -- Standardwert für den Entbindungstermin
    v_due_date := NOW() + INTERVAL '280 days';
  END IF;
  
  -- Aktualisieren oder Erstellen der Einstellungen
  IF v_user_settings_exist THEN
    -- Aktualisieren der bestehenden Einstellungen
    UPDATE public.user_settings
    SET 
      is_baby_born = p_is_baby_born,
      updated_at = NOW()
    WHERE 
      user_id = p_user_id;
  ELSE
    -- Erstellen neuer Einstellungen
    INSERT INTO public.user_settings (
      user_id, 
      due_date, 
      is_baby_born, 
      created_at, 
      updated_at
    ) VALUES (
      p_user_id, 
      v_due_date, 
      p_is_baby_born, 
      NOW(), 
      NOW()
    );
  END IF;
  
  -- Synchronisieren mit verknüpften Benutzern
  SELECT * FROM public.sync_due_date_to_linked_users(p_user_id) INTO v_sync_result;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object(
    'success', true,
    'isBabyBorn', p_is_baby_born,
    'syncResult', v_sync_result
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.update_baby_born_status_and_sync IS 'Aktualisiert den Baby-Status und synchronisiert ihn mit verknüpften Benutzern';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Synchronisierung des Entbindungstermins wurde vereinfacht.';
END
$$;
