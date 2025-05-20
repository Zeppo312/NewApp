-- 1. Funktion zum Abrufen der Alltag-Einträge mit Synchronisierungsinformationen
CREATE OR REPLACE FUNCTION public.get_daily_entries_with_sync_info(p_user_id UUID, p_date TIMESTAMPTZ DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_entries jsonb;
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
  v_is_inviter BOOLEAN;
BEGIN
  -- Abrufen der Alltag-Einträge des Benutzers
  IF p_date IS NULL THEN
    -- Alle Einträge abrufen, wenn kein Datum angegeben ist
    SELECT 
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bd.id,
            'entry_date', bd.entry_date,
            'entry_type', bd.entry_type,
            'start_time', bd.start_time,
            'end_time', bd.end_time,
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
      bd.entry_date DESC, bd.start_time DESC;
  ELSE
    -- Nur Einträge für das angegebene Datum abrufen
    SELECT 
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', bd.id,
            'entry_date', bd.entry_date,
            'entry_type', bd.entry_type,
            'start_time', bd.start_time,
            'end_time', bd.end_time,
            'notes', bd.notes
          )
        ),
        '[]'::jsonb
      ) INTO v_entries
    FROM 
      public.baby_daily bd
    WHERE 
      bd.user_id = p_user_id
      AND bd.entry_date >= date_trunc('day', p_date)
      AND bd.entry_date < date_trunc('day', p_date) + interval '1 day'
    ORDER BY 
      bd.entry_date DESC, bd.start_time DESC;
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
      WHERE al.creator_id = p_user_id AND al.invited_id = v_linked_user_id
    ) INTO v_is_inviter;
    
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
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'entries', v_entries,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_daily_entries_with_sync_info IS 'Gibt die Alltag-Einträge des Benutzers mit Synchronisierungsinformationen zurück';

-- 2. Funktion zum Hinzufügen eines Alltag-Eintrags und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.add_daily_entry_and_sync(
  p_user_id UUID,
  p_entry_date TIMESTAMPTZ,
  p_entry_type TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_entry_id UUID;
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
  v_linked_users jsonb := '[]'::jsonb;
  v_synced_count INTEGER := 0;
BEGIN
  -- Hinzufügen des Eintrags für den Benutzer
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
    p_user_id,
    p_entry_date,
    p_entry_type,
    p_start_time,
    p_end_time,
    p_notes,
    NOW(),
    NOW()
  ) RETURNING id INTO v_entry_id;
  
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
      p_entry_date,
      p_entry_type,
      p_start_time,
      p_end_time,
      p_notes,
      NOW(),
      NOW()
    );
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'entryId', v_entry_id,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.add_daily_entry_and_sync IS 'Fügt einen Alltag-Eintrag hinzu und synchronisiert ihn automatisch mit allen verknüpften Benutzern';

-- 3. Funktion zum Aktualisieren eines Alltag-Eintrags und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.update_daily_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID,
  p_entry_date TIMESTAMPTZ,
  p_entry_type TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_entry RECORD;
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
  v_linked_entry_id UUID;
  v_linked_users jsonb := '[]'::jsonb;
  v_synced_count INTEGER := 0;
BEGIN
  -- Aktualisieren des Eintrags für den Benutzer
  UPDATE public.baby_daily
  SET
    entry_date = p_entry_date,
    entry_type = p_entry_type,
    start_time = p_start_time,
    end_time = p_end_time,
    notes = p_notes,
    updated_at = NOW()
  WHERE
    id = p_entry_id
    AND user_id = p_user_id
  RETURNING * INTO v_entry;
  
  -- Wenn kein Eintrag gefunden wurde, Fehler zurückgeben
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Eintrag nicht gefunden'
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
    
    -- Suchen nach einem entsprechenden Eintrag beim verknüpften Benutzer
    SELECT id INTO v_linked_entry_id
    FROM public.baby_daily
    WHERE user_id = v_linked_user_id
      AND entry_date = v_entry.entry_date
      AND entry_type = v_entry.entry_type
    LIMIT 1;
    
    IF v_linked_entry_id IS NOT NULL THEN
      -- Aktualisieren des vorhandenen Eintrags
      UPDATE public.baby_daily
      SET
        start_time = p_start_time,
        end_time = p_end_time,
        notes = p_notes,
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
        p_entry_date,
        p_entry_type,
        p_start_time,
        p_end_time,
        p_notes,
        NOW(),
        NOW()
      );
    END IF;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.update_daily_entry_and_sync IS 'Aktualisiert einen Alltag-Eintrag und synchronisiert ihn automatisch mit allen verknüpften Benutzern';

-- 4. Funktion zum Löschen eines Alltag-Eintrags und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.delete_daily_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_entry RECORD;
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
  v_linked_users jsonb := '[]'::jsonb;
  v_synced_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Abrufen des Eintrags vor dem Löschen
  SELECT * INTO v_entry
  FROM public.baby_daily
  WHERE id = p_entry_id
    AND user_id = p_user_id;
  
  -- Wenn kein Eintrag gefunden wurde, Fehler zurückgeben
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Eintrag nicht gefunden'
    );
  END IF;
  
  -- Löschen des Eintrags für den Benutzer
  DELETE FROM public.baby_daily
  WHERE id = p_entry_id
    AND user_id = p_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
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
    
    -- Löschen des entsprechenden Eintrags beim verknüpften Benutzer
    DELETE FROM public.baby_daily
    WHERE user_id = v_linked_user_id
      AND entry_date = v_entry.entry_date
      AND entry_type = v_entry.entry_type;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'deletedCount', v_deleted_count,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.delete_daily_entry_and_sync IS 'Löscht einen Alltag-Eintrag und synchronisiert die Löschung automatisch mit allen verknüpften Benutzern';

-- 5. Funktion zum Synchronisieren aller bestehenden Alltag-Einträge
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
  v_linked_users jsonb := '[]'::jsonb;
  v_synced_count INTEGER := 0;
  v_my_entries RECORD;
  v_their_entries RECORD;
BEGIN
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id, v_is_inviter;
    EXIT WHEN NOT FOUND;
    
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
    IF v_is_inviter THEN
      -- Der aktuelle Benutzer ist der Einladende
      -- Seine Einträge haben Priorität
      
      -- Kopieren aller Einträge vom Benutzer zum verknüpften Benutzer
      FOR v_my_entries IN 
        SELECT * FROM public.baby_daily WHERE user_id = p_user_id
      LOOP
        -- Prüfen, ob der Eintrag bereits beim verknüpften Benutzer existiert
        IF NOT EXISTS (
          SELECT 1 
          FROM public.baby_daily 
          WHERE user_id = v_linked_user_id 
          AND entry_date = v_my_entries.entry_date
          AND entry_type = v_my_entries.entry_type
        ) THEN
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
            v_my_entries.entry_date,
            v_my_entries.entry_type,
            v_my_entries.start_time,
            v_my_entries.end_time,
            v_my_entries.notes,
            NOW(),
            NOW()
          );
          
          v_synced_count := v_synced_count + 1;
        END IF;
      END LOOP;
    ELSE
      -- Der aktuelle Benutzer ist der Eingeladene
      -- Die Einträge des Einladenden haben Priorität
      
      -- Kopieren aller Einträge vom verknüpften Benutzer zum Benutzer
      FOR v_their_entries IN 
        SELECT * FROM public.baby_daily WHERE user_id = v_linked_user_id
      LOOP
        -- Prüfen, ob der Eintrag bereits beim Benutzer existiert
        IF NOT EXISTS (
          SELECT 1 
          FROM public.baby_daily 
          WHERE user_id = p_user_id 
          AND entry_date = v_their_entries.entry_date
          AND entry_type = v_their_entries.entry_type
        ) THEN
          -- Hinzufügen des Eintrags für den Benutzer
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
            p_user_id,
            v_their_entries.entry_date,
            v_their_entries.entry_type,
            v_their_entries.start_time,
            v_their_entries.end_time,
            v_their_entries.notes,
            NOW(),
            NOW()
          );
          
          v_synced_count := v_synced_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Alltag-Einträge wurden bidirektional synchronisiert',
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_all_existing_daily_entries IS 'Synchronisiert alle bestehenden Alltag-Einträge zwischen verknüpften Benutzern';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Synchronisierung der Alltag-Einträge zwischen verknüpften Benutzern wurde implementiert.';
END
$$;
