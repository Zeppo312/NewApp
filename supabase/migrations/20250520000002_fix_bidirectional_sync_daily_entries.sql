-- 1. Aktualisierte Trigger-Funktion zum automatischen Synchronisieren neuer Alltag-Einträge (bidirektional mit Rekursionsschutz)
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
  v_is_inviter BOOLEAN;
  v_is_sync BOOLEAN;
BEGIN
  -- Prüfen, ob dieser Eintrag bereits Teil einer Synchronisation ist
  -- Wir verwenden die Notiz, um zu prüfen, ob dieser Eintrag bereits synchronisiert wird
  IF NEW.notes LIKE '%[SYNC_IN_PROGRESS]%' THEN
    -- Entfernen des Sync-Markers aus der Notiz
    NEW.notes := REPLACE(NEW.notes, '[SYNC_IN_PROGRESS]', '');
    RETURN NEW;
  END IF;

  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Bestimmen, ob der aktuelle Benutzer der Einladende ist
    SELECT EXISTS (
      SELECT 1 
      FROM public.account_links al 
      WHERE al.creator_id = NEW.user_id AND al.invited_id = v_linked_user_id
    ) INTO v_is_inviter;
    
    -- Löschen eines möglicherweise vorhandenen Eintrags mit dem gleichen Zeitstempel
    DELETE FROM public.baby_daily
    WHERE user_id = v_linked_user_id
      AND entry_date = NEW.entry_date
      AND entry_type = NEW.entry_type;
    
    -- Hinzufügen des Eintrags für den verknüpften Benutzer mit Sync-Marker
    INSERT INTO public.baby_daily (
      user_id,
      entry_date,
      entry_type,
      start_time,
      end_time,
      notes,
      created_at,
      updated_at
    ) VALUES (
      v_linked_user_id,
      NEW.entry_date,
      NEW.entry_type,
      NEW.start_time,
      NEW.end_time,
      NEW.notes || '[SYNC_IN_PROGRESS]', -- Marker hinzufügen, um Rekursion zu verhindern
      NOW(),
      NOW()
    );
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN NEW;
END;
$$;

-- 2. Aktualisierte Trigger-Funktion zum automatischen Synchronisieren aktualisierter Alltag-Einträge (bidirektional mit Rekursionsschutz)
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
  v_is_inviter BOOLEAN;
BEGIN
  -- Prüfen, ob dieser Eintrag bereits Teil einer Synchronisation ist
  IF NEW.notes LIKE '%[SYNC_IN_PROGRESS]%' THEN
    -- Entfernen des Sync-Markers aus der Notiz
    NEW.notes := REPLACE(NEW.notes, '[SYNC_IN_PROGRESS]', '');
    RETURN NEW;
  END IF;

  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Bestimmen, ob der aktuelle Benutzer der Einladende ist
    SELECT EXISTS (
      SELECT 1 
      FROM public.account_links al 
      WHERE al.creator_id = NEW.user_id AND al.invited_id = v_linked_user_id
    ) INTO v_is_inviter;
    
    -- Suchen nach einem entsprechenden Eintrag beim verknüpften Benutzer
    SELECT id INTO v_linked_entry_id
    FROM public.baby_daily
    WHERE user_id = v_linked_user_id
      AND entry_date = NEW.entry_date
      AND entry_type = NEW.entry_type
    LIMIT 1;
    
    IF v_linked_entry_id IS NOT NULL THEN
      -- Aktualisieren des vorhandenen Eintrags mit Sync-Marker
      UPDATE public.baby_daily
      SET
        start_time = NEW.start_time,
        end_time = NEW.end_time,
        notes = NEW.notes || '[SYNC_IN_PROGRESS]', -- Marker hinzufügen, um Rekursion zu verhindern
        updated_at = NOW()
      WHERE id = v_linked_entry_id;
    ELSE
      -- Hinzufügen eines neuen Eintrags mit Sync-Marker
      INSERT INTO public.baby_daily (
        user_id,
        entry_date,
        entry_type,
        start_time,
        end_time,
        notes,
        created_at,
        updated_at
      ) VALUES (
        v_linked_user_id,
        NEW.entry_date,
        NEW.entry_type,
        NEW.start_time,
        NEW.end_time,
        NEW.notes || '[SYNC_IN_PROGRESS]', -- Marker hinzufügen, um Rekursion zu verhindern
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN NEW;
END;
$$;

-- 3. Aktualisierte Trigger-Funktion zum automatischen Synchronisieren gelöschter Alltag-Einträge (bidirektional)
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
  v_is_inviter BOOLEAN;
BEGIN
  -- Prüfen, ob dieser Eintrag bereits Teil einer Synchronisation ist
  IF OLD.notes LIKE '%[SYNC_IN_PROGRESS]%' THEN
    RETURN OLD;
  END IF;

  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Bestimmen, ob der aktuelle Benutzer der Einladende ist
    SELECT EXISTS (
      SELECT 1 
      FROM public.account_links al 
      WHERE al.creator_id = OLD.user_id AND al.invited_id = v_linked_user_id
    ) INTO v_is_inviter;
    
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

-- 4. Aktualisierte Funktion zum Synchronisieren aller bestehenden Alltag-Einträge (bidirektional mit Rekursionsschutz)
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
  v_all_entries jsonb;
  v_my_entries jsonb;
  v_their_entries jsonb;
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
    
    -- Bidirektionale Synchronisation
    -- Abrufen aller Einträge des aktuellen Benutzers
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bd.id,
            'user_id', bd.user_id,
            'entry_date', bd.entry_date,
            'entry_type', bd.entry_type,
            'start_time', bd.start_time,
            'end_time', bd.end_time,
            'notes', bd.notes
          )
        ),
        '[]'::jsonb
      ) INTO v_my_entries
    FROM
      public.baby_daily bd
    WHERE
      bd.user_id = p_user_id;
    
    -- Abrufen aller Einträge des verknüpften Benutzers
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bd.id,
            'user_id', bd.user_id,
            'entry_date', bd.entry_date,
            'entry_type', bd.entry_type,
            'start_time', bd.start_time,
            'end_time', bd.end_time,
            'notes', bd.notes
          )
        ),
        '[]'::jsonb
      ) INTO v_their_entries
    FROM
      public.baby_daily bd
    WHERE
      bd.user_id = v_linked_user_id;
    
    -- Wenn der aktuelle Benutzer der Einladende ist, haben seine Einträge Priorität
    IF v_is_inviter THEN
      -- Löschen aller bestehenden Einträge des Eingeladenen
      DELETE FROM public.baby_daily
      WHERE user_id = v_linked_user_id;
      
      -- Kopieren aller Einträge vom Einladenden zum Eingeladenen mit Sync-Marker
      INSERT INTO public.baby_daily (
        user_id,
        entry_date,
        entry_type,
        start_time,
        end_time,
        notes,
        created_at,
        updated_at
      )
      SELECT
        v_linked_user_id,
        bd.entry_date,
        bd.entry_type,
        bd.start_time,
        bd.end_time,
        bd.notes || '[SYNC_IN_PROGRESS]', -- Marker hinzufügen, um Rekursion zu verhindern
        v_now,
        v_now
      FROM
        public.baby_daily bd
      WHERE
        bd.user_id = p_user_id;
      
      GET DIAGNOSTICS v_synced_count = ROW_COUNT;
      RAISE NOTICE 'Synced % entries from inviter to invitee %', v_synced_count, v_linked_user_id;
    ELSE
      -- Der aktuelle Benutzer ist der Eingeladene
      -- In diesem Fall werden die Einträge vom Einladenden zum Eingeladenen synchronisiert
      
      -- Löschen aller bestehenden Einträge des Eingeladenen (aktueller Benutzer)
      DELETE FROM public.baby_daily
      WHERE user_id = p_user_id;
      
      -- Kopieren aller Einträge vom Einladenden zum Eingeladenen mit Sync-Marker
      INSERT INTO public.baby_daily (
        user_id,
        entry_date,
        entry_type,
        start_time,
        end_time,
        notes,
        created_at,
        updated_at
      )
      SELECT
        p_user_id,
        bd.entry_date,
        bd.entry_type,
        bd.start_time,
        bd.end_time,
        bd.notes || '[SYNC_IN_PROGRESS]', -- Marker hinzufügen, um Rekursion zu verhindern
        v_now,
        v_now
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
