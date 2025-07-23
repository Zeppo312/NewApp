-- Skript zur kontinuierlichen Synchronisierung des Entbindungstermins zwischen verknüpften Benutzern
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Verbesserte Funktion zum Abrufen des synchronisierten Entbindungstermins
-- Diese Funktion synchronisiert den Entbindungstermin bei jedem Aufruf
CREATE OR REPLACE FUNCTION public.get_synced_due_date(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_due_date TIMESTAMPTZ;
  v_is_baby_born BOOLEAN;
  v_synced_from jsonb;
  v_creator_id UUID;
  v_creator_due_date TIMESTAMPTZ;
  v_creator_is_baby_born BOOLEAN;
  v_user_settings_exist BOOLEAN;
  v_user_settings_updated BOOLEAN := FALSE;
BEGIN
  -- Prüfen, ob der Benutzer bereits Einstellungen hat
  SELECT 
    EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) INTO v_user_settings_exist;
  
  -- Abrufen des verknüpften Benutzers (Ersteller der Einladung)
  SELECT 
    CASE
      WHEN al.creator_id = p_user_id THEN al.invited_id
      ELSE al.creator_id
    END INTO v_creator_id
  FROM 
    public.account_links al
  WHERE 
    (al.creator_id = p_user_id OR al.invited_id = p_user_id)
    AND al.status = 'accepted'
  LIMIT 1;
  
  -- Wenn ein verknüpfter Benutzer gefunden wurde
  IF v_creator_id IS NOT NULL THEN
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_synced_from
    FROM 
      public.profiles p
    WHERE 
      p.id = v_creator_id;
    
    -- Abrufen des Entbindungstermins und des Baby-Status vom verknüpften Benutzer
    SELECT 
      due_date, is_baby_born INTO v_creator_due_date, v_creator_is_baby_born
    FROM 
      public.user_settings
    WHERE 
      user_id = v_creator_id;
    
    -- Wenn der verknüpfte Benutzer einen Entbindungstermin hat
    IF v_creator_due_date IS NOT NULL THEN
      -- Abrufen der aktuellen Einstellungen des Benutzers
      IF v_user_settings_exist THEN
        SELECT 
          due_date, is_baby_born INTO v_due_date, v_is_baby_born
        FROM 
          public.user_settings
        WHERE 
          user_id = p_user_id;
        
        -- Prüfen, ob eine Aktualisierung erforderlich ist
        IF v_due_date IS DISTINCT FROM v_creator_due_date OR v_is_baby_born IS DISTINCT FROM v_creator_is_baby_born THEN
          -- Aktualisieren der bestehenden Einstellungen
          UPDATE public.user_settings
          SET 
            due_date = v_creator_due_date,
            is_baby_born = v_creator_is_baby_born,
            updated_at = NOW()
          WHERE 
            user_id = p_user_id;
          
          v_user_settings_updated := TRUE;
          
          -- Aktualisierte Werte verwenden
          v_due_date := v_creator_due_date;
          v_is_baby_born := v_creator_is_baby_born;
        END IF;
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
          v_creator_due_date, 
          v_creator_is_baby_born, 
          NOW(), 
          NOW()
        );
        
        v_user_settings_updated := TRUE;
        
        -- Eingefügte Werte verwenden
        v_due_date := v_creator_due_date;
        v_is_baby_born := v_creator_is_baby_born;
      END IF;
      
      -- Protokollieren der Synchronisierung, wenn Änderungen vorgenommen wurden
      IF v_user_settings_updated THEN
        RAISE NOTICE 'Synchronized due date % and baby status % from user % to user %', 
          v_creator_due_date, v_creator_is_baby_born, v_creator_id, p_user_id;
      END IF;
    ELSE
      -- Wenn der verknüpfte Benutzer keinen Entbindungstermin hat, verwenden wir die lokalen Einstellungen
      IF v_user_settings_exist THEN
        SELECT 
          due_date, is_baby_born INTO v_due_date, v_is_baby_born
        FROM 
          public.user_settings
        WHERE 
          user_id = p_user_id;
      END IF;
    END IF;
  ELSE
    -- Wenn kein verknüpfter Benutzer gefunden wurde, verwenden wir die lokalen Einstellungen
    IF v_user_settings_exist THEN
      SELECT 
        due_date, is_baby_born INTO v_due_date, v_is_baby_born
      FROM 
        public.user_settings
      WHERE 
        user_id = p_user_id;
    END IF;
  END IF;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object(
    'success', true,
    'dueDate', v_due_date,
    'isBabyBorn', v_is_baby_born,
    'syncedFrom', v_synced_from,
    'updated', v_user_settings_updated
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_synced_due_date IS 'Gibt den synchronisierten Entbindungstermin zurück und synchronisiert ihn bei jedem Aufruf';

-- 2. Trigger-Funktion für die Synchronisierung bei Änderungen an user_settings
CREATE OR REPLACE FUNCTION public.sync_due_date_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT 
      CASE
        WHEN al.creator_id = NEW.user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = NEW.user_id OR al.invited_id = NEW.user_id)
      AND al.status = 'accepted';
BEGIN
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Prüfen, ob der verknüpfte Benutzer bereits Einstellungen hat
    IF EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = v_linked_user_id) THEN
      -- Aktualisieren der bestehenden Einstellungen
      UPDATE public.user_settings
      SET 
        due_date = NEW.due_date,
        is_baby_born = NEW.is_baby_born,
        updated_at = NOW()
      WHERE 
        user_id = v_linked_user_id;
      
      RAISE NOTICE 'Synchronized due date % and baby status % from user % to user %', 
        NEW.due_date, NEW.is_baby_born, NEW.user_id, v_linked_user_id;
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
        NEW.due_date, 
        NEW.is_baby_born, 
        NOW(), 
        NOW()
      );
      
      RAISE NOTICE 'Created new settings with due date % and baby status % for user % from user %', 
        NEW.due_date, NEW.is_baby_born, v_linked_user_id, NEW.user_id;
    END IF;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN NEW;
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_due_date_on_update IS 'Synchronisiert den Entbindungstermin mit allen verknüpften Benutzern bei Änderungen';

-- 3. Trigger für die Synchronisierung bei Änderungen an user_settings
DROP TRIGGER IF EXISTS sync_due_date_trigger ON public.user_settings;
CREATE TRIGGER sync_due_date_trigger
AFTER UPDATE OF due_date, is_baby_born ON public.user_settings
FOR EACH ROW
WHEN (OLD.due_date IS DISTINCT FROM NEW.due_date OR OLD.is_baby_born IS DISTINCT FROM NEW.is_baby_born)
EXECUTE FUNCTION public.sync_due_date_on_update();

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Funktionen für die kontinuierliche Synchronisierung des Entbindungstermins wurden erstellt.';
END
$$;
