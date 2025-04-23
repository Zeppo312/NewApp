-- Skript zur Behebung von Problemen mit der kontinuierlichen Synchronisierung des Entbindungstermins
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Trigger deaktivieren, um Endlosschleifen zu vermeiden
DROP TRIGGER IF EXISTS sync_due_date_trigger ON public.user_settings;

-- 2. Verbesserte Trigger-Funktion mit Schutz vor Endlosschleifen
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
  -- Prüfen, ob die Änderung bereits Teil einer Synchronisierung ist
  -- Wenn ja, brechen wir ab, um Endlosschleifen zu vermeiden
  IF TG_ARGV[0]::boolean THEN
    RETURN NEW;
  END IF;
  
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
        updated_at = NOW(),
        -- Markieren, dass diese Änderung Teil einer Synchronisierung ist
        sync_in_progress = true
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
        updated_at,
        sync_in_progress
      ) VALUES (
        v_linked_user_id, 
        NEW.due_date, 
        NEW.is_baby_born, 
        NOW(), 
        NOW(),
        true
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

-- 3. Sicherstellen, dass die user_settings-Tabelle eine sync_in_progress-Spalte hat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_settings' 
    AND column_name = 'sync_in_progress'
  ) THEN
    ALTER TABLE public.user_settings ADD COLUMN sync_in_progress BOOLEAN DEFAULT false;
  END IF;
END
$$;

-- 4. Neuer Trigger mit Schutz vor Endlosschleifen
CREATE TRIGGER sync_due_date_trigger
AFTER UPDATE OF due_date, is_baby_born ON public.user_settings
FOR EACH ROW
WHEN (
  (OLD.due_date IS DISTINCT FROM NEW.due_date OR OLD.is_baby_born IS DISTINCT FROM NEW.is_baby_born)
  AND NOT NEW.sync_in_progress
)
EXECUTE FUNCTION public.sync_due_date_on_update(false);

-- 5. Trigger zum Zurücksetzen des sync_in_progress-Flags
CREATE OR REPLACE FUNCTION public.reset_sync_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.sync_in_progress THEN
    NEW.sync_in_progress = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.reset_sync_flag IS 'Setzt das sync_in_progress-Flag zurück, um weitere Aktualisierungen zu ermöglichen';

-- 6. Trigger zum Zurücksetzen des sync_in_progress-Flags
DROP TRIGGER IF EXISTS reset_sync_flag_trigger ON public.user_settings;
CREATE TRIGGER reset_sync_flag_trigger
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
WHEN (OLD.sync_in_progress IS DISTINCT FROM NEW.sync_in_progress AND NEW.sync_in_progress)
EXECUTE FUNCTION public.reset_sync_flag();

-- 7. Verbesserte Funktion zum Abrufen des synchronisierten Entbindungstermins
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
  v_user_settings_exist BOOLEAN;
BEGIN
  -- Prüfen, ob der Benutzer bereits Einstellungen hat
  SELECT 
    EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) INTO v_user_settings_exist;
  
  -- Wenn der Benutzer Einstellungen hat, diese abrufen
  IF v_user_settings_exist THEN
    SELECT 
      due_date, is_baby_born INTO v_due_date, v_is_baby_born
    FROM 
      public.user_settings
    WHERE 
      user_id = p_user_id;
  END IF;
  
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
  END IF;
  
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
COMMENT ON FUNCTION public.get_synced_due_date IS 'Gibt den synchronisierten Entbindungstermin zurück';

-- 8. Zurücksetzen aller sync_in_progress-Flags
UPDATE public.user_settings SET sync_in_progress = false;

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Probleme mit der kontinuierlichen Synchronisierung des Entbindungstermins wurden behoben.';
END
$$;
