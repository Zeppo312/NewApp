-- 1. Funktion zum Synchronisieren der Alltag-Einträge vom einladenden Benutzer zum eingeladenen Benutzer
CREATE OR REPLACE FUNCTION public.sync_daily_entries_from_inviter_to_invitee(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_inviter_id UUID;
  v_invitee_id UUID;
  v_inviter_entries_count INTEGER := 0;
  v_synced_count INTEGER := 0;
  v_inviter_name TEXT;
  v_result jsonb;
BEGIN
  -- Bestimmen, ob der Benutzer der Einladende oder der Eingeladene ist
  -- Wir suchen nach einer akzeptierten Verknüpfung, bei der der Benutzer beteiligt ist
  SELECT
    al.creator_id, al.invited_id
  INTO
    v_inviter_id, v_invitee_id
  FROM
    public.account_links al
  WHERE
    (al.creator_id = p_user_id OR al.invited_id = p_user_id)
    AND al.status = 'accepted'
  LIMIT 1;

  -- Wenn keine Verknüpfung gefunden wurde, geben wir eine Fehlermeldung zurück
  IF v_inviter_id IS NULL OR v_invitee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Keine akzeptierte Verknüpfung gefunden.'
    );
  END IF;

  -- Wenn der Benutzer der Eingeladene ist, synchronisieren wir die Einträge vom Einladenden
  IF v_invitee_id = p_user_id THEN
    -- Abrufen des Namens des Einladenden
    SELECT
      p.first_name INTO v_inviter_name
    FROM
      public.profiles p
    WHERE
      p.id = v_inviter_id;

    -- Zählen der Einträge des Einladenden
    SELECT
      COUNT(*) INTO v_inviter_entries_count
    FROM
      public.baby_daily
    WHERE
      user_id = v_inviter_id;

    -- Löschen aller bestehenden Einträge des Eingeladenen
    DELETE FROM public.baby_daily
    WHERE user_id = v_invitee_id;

    -- Kopieren aller Einträge vom Einladenden zum Eingeladenen
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
      v_invitee_id,
      bd.entry_date,
      bd.entry_type,
      bd.start_time,
      bd.end_time,
      bd.notes,
      NOW(),
      NOW()
    FROM
      public.baby_daily bd
    WHERE
      bd.user_id = v_inviter_id;

    -- Zählen der synchronisierten Einträge
    GET DIAGNOSTICS v_synced_count = ROW_COUNT;

    -- Erfolg zurückgeben
    RETURN jsonb_build_object(
      'success', true,
      'syncedFrom', jsonb_build_object(
        'userId', v_inviter_id,
        'firstName', v_inviter_name
      ),
      'entriesCount', v_inviter_entries_count,
      'syncedCount', v_synced_count
    );
  ELSE
    -- Wenn der Benutzer der Einladende ist, geben wir eine Erfolgsmeldung zurück
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Sie sind der Einladende. Ihre Alltag-Einträge werden mit dem Eingeladenen synchronisiert.'
    );
  END IF;
END;
$$;

-- 2. Funktion zum Abrufen der Alltag-Einträge mit Synchronisierungsinformationen
CREATE OR REPLACE FUNCTION public.get_daily_entries_with_sync_info(p_user_id UUID, p_date TIMESTAMPTZ DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_entries jsonb;
  v_linked_users jsonb := '[]'::jsonb;
  v_inviter_id UUID;
  v_invitee_id UUID;
  v_sync_info jsonb;
  v_start_of_day TIMESTAMPTZ;
  v_end_of_day TIMESTAMPTZ;
BEGIN
  -- Wenn ein Datum angegeben wurde, filtern wir nach diesem Datum
  IF p_date IS NOT NULL THEN
    v_start_of_day := date_trunc('day', p_date);
    v_end_of_day := v_start_of_day + interval '1 day';
  END IF;

  -- Bestimmen, ob der Benutzer der Einladende oder der Eingeladene ist
  SELECT
    al.creator_id, al.invited_id
  INTO
    v_inviter_id, v_invitee_id
  FROM
    public.account_links al
  WHERE
    (al.creator_id = p_user_id OR al.invited_id = p_user_id)
    AND al.status = 'accepted'
  LIMIT 1;

  -- Wenn keine Verknüpfung gefunden wurde, nur die Einträge des Benutzers zurückgeben
  IF v_inviter_id IS NULL OR v_invitee_id IS NULL THEN
    -- Abrufen der Einträge des Benutzers
    IF p_date IS NOT NULL THEN
      SELECT
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', bd.id,
              'entryDate', bd.entry_date,
              'entryType', bd.entry_type,
              'startTime', bd.start_time,
              'endTime', bd.end_time,
              'notes', bd.notes
            )
          ),
          '[]'::jsonb
        ) INTO v_entries
      FROM
        public.baby_daily bd
      WHERE
        bd.user_id = p_user_id
        AND bd.entry_date >= v_start_of_day
        AND bd.entry_date < v_end_of_day
      ORDER BY
        bd.entry_date DESC;
    ELSE
      SELECT
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', bd.id,
              'entryDate', bd.entry_date,
              'entryType', bd.entry_type,
              'startTime', bd.start_time,
              'endTime', bd.end_time,
              'notes', bd.notes
            )
          ),
          '[]'::jsonb
        ) INTO v_entries
      FROM
        public.baby_daily bd
      WHERE
        bd.user_id = p_user_id
      ORDER BY
        bd.entry_date DESC;
    END IF;

    -- Erfolg zurückgeben ohne Synchronisierungsinformationen
    RETURN jsonb_build_object(
      'success', true,
      'entries', v_entries,
      'syncInfo', NULL
    );
  END IF;

  -- Wenn der Benutzer der Eingeladene ist, Synchronisierungsinformationen hinzufügen
  IF v_invitee_id = p_user_id THEN
    -- Abrufen des Namens des Einladenden
    SELECT
      jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_sync_info
    FROM
      public.profiles p
    WHERE
      p.id = v_inviter_id;
  ELSE
    -- Abrufen des Namens des Eingeladenen
    SELECT
      jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_sync_info
    FROM
      public.profiles p
    WHERE
      p.id = v_invitee_id;
  END IF;

  -- Abrufen der Einträge des Benutzers
  IF p_date IS NOT NULL THEN
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bd.id,
            'entryDate', bd.entry_date,
            'entryType', bd.entry_type,
            'startTime', bd.start_time,
            'endTime', bd.end_time,
            'notes', bd.notes
          )
        ),
        '[]'::jsonb
      ) INTO v_entries
    FROM
      public.baby_daily bd
    WHERE
      bd.user_id = p_user_id
      AND bd.entry_date >= v_start_of_day
      AND bd.entry_date < v_end_of_day
    ORDER BY
      bd.entry_date DESC;
  ELSE
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bd.id,
            'entryDate', bd.entry_date,
            'entryType', bd.entry_type,
            'startTime', bd.start_time,
            'endTime', bd.end_time,
            'notes', bd.notes
          )
        ),
        '[]'::jsonb
      ) INTO v_entries
    FROM
      public.baby_daily bd
    WHERE
      bd.user_id = p_user_id
    ORDER BY
      bd.entry_date DESC;
  END IF;

  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'entries', v_entries,
    'syncInfo', v_sync_info
  );
END;
$$;

-- 3. Funktion zum Synchronisieren aller bestehenden Alltag-Einträge zwischen verbundenen Benutzern
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
      END AS linked_user_id
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
  v_my_entries RECORD;
  v_their_entries RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Starting sync_all_existing_daily_entries for user %', p_user_id;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    RAISE NOTICE 'Processing linked user %', v_linked_user_id;
    
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
    
    -- Bestimmen, ob der aktuelle Benutzer der Einladende ist
    IF EXISTS (
      SELECT 1 
      FROM public.account_links al 
      WHERE al.creator_id = p_user_id AND al.invited_id = v_linked_user_id
    ) THEN
      -- Der aktuelle Benutzer ist der Einladende
      RAISE NOTICE 'Current user is the inviter, syncing entries to invitee %', v_linked_user_id;
      
      -- Löschen aller bestehenden Einträge des Eingeladenen
      DELETE FROM public.baby_daily
      WHERE user_id = v_linked_user_id;
      
      -- Kopieren aller Einträge vom Einladenden zum Eingeladenen
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
        bd.notes,
        v_now,
        v_now
      FROM
        public.baby_daily bd
      WHERE
        bd.user_id = p_user_id;
      
      GET DIAGNOSTICS v_synced_count = ROW_COUNT;
      RAISE NOTICE 'Synced % entries to invitee %', v_synced_count, v_linked_user_id;
    ELSE
      -- Der aktuelle Benutzer ist der Eingeladene
      RAISE NOTICE 'Current user is the invitee, entries will be synced from inviter %', v_linked_user_id;
    END IF;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Alltag-Einträge wurden synchronisiert',
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- 4. Trigger-Funktion zum automatischen Synchronisieren neuer Alltag-Einträge
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
  -- Nur synchronisieren, wenn der Benutzer der Einladende ist
  IF EXISTS (
    SELECT 1 
    FROM public.account_links al 
    WHERE al.creator_id = NEW.user_id
  ) THEN
    -- Für jeden verknüpften Benutzer
    OPEN v_linked_users_cursor;
    LOOP
      FETCH v_linked_users_cursor INTO v_linked_user_id;
      EXIT WHEN NOT FOUND;
      
      -- Nur synchronisieren, wenn der aktuelle Benutzer der Einladende ist
      IF EXISTS (
        SELECT 1 
        FROM public.account_links al 
        WHERE al.creator_id = NEW.user_id AND al.invited_id = v_linked_user_id
      ) THEN
        -- Löschen eines möglicherweise vorhandenen Eintrags mit dem gleichen Zeitstempel
        DELETE FROM public.baby_daily
        WHERE user_id = v_linked_user_id
          AND entry_date = NEW.entry_date
          AND entry_type = NEW.entry_type;
        
        -- Hinzufügen des Eintrags für den verknüpften Benutzer
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
          NEW.notes,
          NOW(),
          NOW()
        );
      END IF;
    END LOOP;
    CLOSE v_linked_users_cursor;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Trigger für neue Alltag-Einträge
DROP TRIGGER IF EXISTS trigger_sync_daily_entry ON public.baby_daily;
CREATE TRIGGER trigger_sync_daily_entry
AFTER INSERT ON public.baby_daily
FOR EACH ROW
EXECUTE FUNCTION public.sync_daily_entry_to_linked_users();

-- 6. Trigger-Funktion zum automatischen Synchronisieren aktualisierter Alltag-Einträge
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
  -- Nur synchronisieren, wenn der Benutzer der Einladende ist
  IF EXISTS (
    SELECT 1 
    FROM public.account_links al 
    WHERE al.creator_id = NEW.user_id
  ) THEN
    -- Für jeden verknüpften Benutzer
    OPEN v_linked_users_cursor;
    LOOP
      FETCH v_linked_users_cursor INTO v_linked_user_id;
      EXIT WHEN NOT FOUND;
      
      -- Nur synchronisieren, wenn der aktuelle Benutzer der Einladende ist
      IF EXISTS (
        SELECT 1 
        FROM public.account_links al 
        WHERE al.creator_id = NEW.user_id AND al.invited_id = v_linked_user_id
      ) THEN
        -- Suchen nach einem entsprechenden Eintrag beim verknüpften Benutzer
        SELECT id INTO v_linked_entry_id
        FROM public.baby_daily
        WHERE user_id = v_linked_user_id
          AND entry_date = NEW.entry_date
          AND entry_type = NEW.entry_type
        LIMIT 1;
        
        IF v_linked_entry_id IS NOT NULL THEN
          -- Aktualisieren des vorhandenen Eintrags
          UPDATE public.baby_daily
          SET
            start_time = NEW.start_time,
            end_time = NEW.end_time,
            notes = NEW.notes,
            updated_at = NOW()
          WHERE id = v_linked_entry_id;
        ELSE
          -- Hinzufügen eines neuen Eintrags
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
            NEW.notes,
            NOW(),
            NOW()
          );
        END IF;
      END IF;
    END LOOP;
    CLOSE v_linked_users_cursor;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Trigger für aktualisierte Alltag-Einträge
DROP TRIGGER IF EXISTS trigger_sync_updated_daily_entry ON public.baby_daily;
CREATE TRIGGER trigger_sync_updated_daily_entry
AFTER UPDATE ON public.baby_daily
FOR EACH ROW
EXECUTE FUNCTION public.sync_updated_daily_entry_to_linked_users();

-- 8. Trigger-Funktion zum automatischen Synchronisieren gelöschter Alltag-Einträge
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
  -- Nur synchronisieren, wenn der Benutzer der Einladende ist
  IF EXISTS (
    SELECT 1 
    FROM public.account_links al 
    WHERE al.creator_id = OLD.user_id
  ) THEN
    -- Für jeden verknüpften Benutzer
    OPEN v_linked_users_cursor;
    LOOP
      FETCH v_linked_users_cursor INTO v_linked_user_id;
      EXIT WHEN NOT FOUND;
      
      -- Nur synchronisieren, wenn der aktuelle Benutzer der Einladende ist
      IF EXISTS (
        SELECT 1 
        FROM public.account_links al 
        WHERE al.creator_id = OLD.user_id AND al.invited_id = v_linked_user_id
      ) THEN
        -- Löschen des entsprechenden Eintrags beim verknüpften Benutzer
        DELETE FROM public.baby_daily
        WHERE user_id = v_linked_user_id
          AND entry_date = OLD.entry_date
          AND entry_type = OLD.entry_type;
      END IF;
    END LOOP;
    CLOSE v_linked_users_cursor;
  END IF;
  
  RETURN OLD;
END;
$$;

-- 9. Trigger für gelöschte Alltag-Einträge
DROP TRIGGER IF EXISTS trigger_sync_deleted_daily_entry ON public.baby_daily;
CREATE TRIGGER trigger_sync_deleted_daily_entry
AFTER DELETE ON public.baby_daily
FOR EACH ROW
EXECUTE FUNCTION public.sync_deleted_daily_entry_to_linked_users();
