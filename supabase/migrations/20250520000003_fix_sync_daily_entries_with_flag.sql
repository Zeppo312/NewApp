-- 1. Füge eine Spalte hinzu, um zu markieren, ob ein Eintrag gerade synchronisiert wird
ALTER TABLE public.baby_daily ADD COLUMN IF NOT EXISTS is_syncing BOOLEAN DEFAULT FALSE;

-- 2. Aktualisierte Trigger-Funktion zum automatischen Synchronisieren neuer Alltag-Einträge mit Flag
CREATE OR REPLACE FUNCTION public.sync_daily_entry_to_linked_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
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
  -- Wenn der Eintrag bereits synchronisiert wird, nichts tun
  IF NEW.is_syncing THEN
    -- Setze das Flag zurück
    NEW.is_syncing = FALSE;
    RETURN NEW;
  END IF;

  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Löschen eines möglicherweise vorhandenen Eintrags mit dem gleichen Zeitstempel
    DELETE FROM public.baby_daily
    WHERE user_id = v_linked_user_id
      AND entry_date = NEW.entry_date
      AND entry_type = NEW.entry_type;
    
    -- Hinzufügen des Eintrags für den verknüpften Benutzer mit Sync-Flag
    INSERT INTO public.baby_daily (
      user_id,
      entry_date,
      entry_type,
      start_time,
      end_time,
      notes,
      created_at,
      updated_at,
      is_syncing
    ) VALUES (
      v_linked_user_id,
      NEW.entry_date,
      NEW.entry_type,
      NEW.start_time,
      NEW.end_time,
      NEW.notes,
      NOW(),
      NOW(),
      TRUE -- Markiere als synchronisiert, um Rekursion zu verhindern
    );
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN NEW;
END;
$$;

-- 3. Aktualisierte Trigger-Funktion zum automatischen Synchronisieren aktualisierter Alltag-Einträge mit Flag
CREATE OR REPLACE FUNCTION public.sync_updated_daily_entry_to_linked_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
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
  v_linked_entry_id UUID;
BEGIN
  -- Wenn der Eintrag bereits synchronisiert wird, nichts tun
  IF NEW.is_syncing THEN
    -- Setze das Flag zurück
    NEW.is_syncing = FALSE;
    RETURN NEW;
  END IF;

  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Suchen nach einem entsprechenden Eintrag beim verknüpften Benutzer
    SELECT id INTO v_linked_entry_id
    FROM public.baby_daily
    WHERE user_id = v_linked_user_id
      AND entry_date = NEW.entry_date
      AND entry_type = NEW.entry_type
    LIMIT 1;
    
    IF v_linked_entry_id IS NOT NULL THEN
      -- Aktualisieren des vorhandenen Eintrags mit Sync-Flag
      UPDATE public.baby_daily
      SET
        start_time = NEW.start_time,
        end_time = NEW.end_time,
        notes = NEW.notes,
        updated_at = NOW(),
        is_syncing = TRUE -- Markiere als synchronisiert, um Rekursion zu verhindern
      WHERE id = v_linked_entry_id;
    ELSE
      -- Hinzufügen eines neuen Eintrags mit Sync-Flag
      INSERT INTO public.baby_daily (
        user_id,
        entry_date,
        entry_type,
        start_time,
        end_time,
        notes,
        created_at,
        updated_at,
        is_syncing
      ) VALUES (
        v_linked_user_id,
        NEW.entry_date,
        NEW.entry_type,
        NEW.start_time,
        NEW.end_time,
        NEW.notes,
        NOW(),
        NOW(),
        TRUE -- Markiere als synchronisiert, um Rekursion zu verhindern
      );
    END IF;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN NEW;
END;
$$;

-- 4. Aktualisierte Trigger-Funktion zum automatischen Synchronisieren gelöschter Alltag-Einträge
CREATE OR REPLACE FUNCTION public.sync_deleted_daily_entry_to_linked_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT 
      CASE
        WHEN al.creator_id = OLD.user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = OLD.user_id OR al.invited_id = OLD.user_id)
      AND al.status = 'accepted';
BEGIN
  -- Wenn der Eintrag bereits synchronisiert wird, nichts tun
  IF OLD.is_syncing THEN
    RETURN OLD;
  END IF;

  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Löschen des entsprechenden Eintrags beim verknüpften Benutzer
    DELETE FROM public.baby_daily
    WHERE user_id = v_linked_user_id
      AND entry_date = OLD.entry_date
      AND entry_type = OLD.entry_type;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN OLD;
END;
$$;

-- 5. Aktualisierte Funktion zum Synchronisieren aller bestehenden Alltag-Einträge mit Flag
CREATE OR REPLACE FUNCTION public.sync_all_existing_daily_entries(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT 
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id,
      CASE
        WHEN al.creator_id = p_user_id THEN true
        ELSE false
      END AS is_inviter
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
  v_is_inviter BOOLEAN;
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Starting sync_all_existing_daily_entries for user %', p_user_id;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id, v_is_inviter;
    EXIT WHEN NOT FOUND;
    
    RAISE NOTICE 'Processing linked user %, current user is inviter: %', v_linked_user_id, v_is_inviter;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role,
        'isInviter', v_is_inviter
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Wenn der aktuelle Benutzer der Einladende ist, haben seine Einträge Priorität
    IF v_is_inviter THEN
      -- Löschen aller bestehenden Einträge des Eingeladenen
      DELETE FROM public.baby_daily
      WHERE user_id = v_linked_user_id;
      
      -- Kopieren aller Einträge vom Einladenden zum Eingeladenen mit Sync-Flag
      INSERT INTO public.baby_daily (
        user_id,
        entry_date,
        entry_type,
        start_time,
        end_time,
        notes,
        created_at,
        updated_at,
        is_syncing
      )
      SELECT
        v_linked_user_id,
        bd.entry_date,
        bd.entry_type,
        bd.start_time,
        bd.end_time,
        bd.notes,
        v_now,
        v_now,
        TRUE -- Markiere als synchronisiert, um Rekursion zu verhindern
      FROM
        public.baby_daily bd
      WHERE
        bd.user_id = p_user_id;
      
      GET DIAGNOSTICS v_synced_count = ROW_COUNT;
      RAISE NOTICE 'Synced % entries from inviter to invitee %', v_synced_count, v_linked_user_id;
    ELSE
      -- Der aktuelle Benutzer ist der Eingeladene
      -- Die Einträge des Einladenden haben Priorität
      
      -- Löschen aller bestehenden Einträge des Eingeladenen (aktueller Benutzer)
      DELETE FROM public.baby_daily
      WHERE user_id = p_user_id;
      
      -- Kopieren aller Einträge vom Einladenden zum Eingeladenen mit Sync-Flag
      INSERT INTO public.baby_daily (
        user_id,
        entry_date,
        entry_type,
        start_time,
        end_time,
        notes,
        created_at,
        updated_at,
        is_syncing
      )
      SELECT
        p_user_id,
        bd.entry_date,
        bd.entry_type,
        bd.start_time,
        bd.end_time,
        bd.notes,
        v_now,
        v_now,
        TRUE -- Markiere als synchronisiert, um Rekursion zu verhindern
      FROM
        public.baby_daily bd
      WHERE
        bd.user_id = v_linked_user_id;
      
      GET DIAGNOSTICS v_synced_count = ROW_COUNT;
      RAISE NOTICE 'Synced % entries from inviter % to current user (invitee)', v_synced_count, v_linked_user_id;
    END IF;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Alltag-Einträge wurden bidirektional synchronisiert',
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- 6. Trigger für neue Alltag-Einträge
DROP TRIGGER IF EXISTS trigger_sync_daily_entry ON public.baby_daily;
CREATE TRIGGER trigger_sync_daily_entry
AFTER INSERT ON public.baby_daily
FOR EACH ROW
EXECUTE FUNCTION public.sync_daily_entry_to_linked_users();

-- 7. Trigger für aktualisierte Alltag-Einträge
DROP TRIGGER IF EXISTS trigger_sync_updated_daily_entry ON public.baby_daily;
CREATE TRIGGER trigger_sync_updated_daily_entry
AFTER UPDATE ON public.baby_daily
FOR EACH ROW
EXECUTE FUNCTION public.sync_updated_daily_entry_to_linked_users();

-- 8. Trigger für gelöschte Alltag-Einträge
DROP TRIGGER IF EXISTS trigger_sync_deleted_daily_entry ON public.baby_daily;
CREATE TRIGGER trigger_sync_deleted_daily_entry
AFTER DELETE ON public.baby_daily
FOR EACH ROW
EXECUTE FUNCTION public.sync_deleted_daily_entry_to_linked_users();
