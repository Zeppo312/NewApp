-- Funktion zum einmaligen Synchronisieren aller bestehenden Schlafeinträge zwischen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.sync_all_existing_sleep_entries(p_user_id UUID)
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
        WHEN al.creator_id = p_user_id THEN 'inviter'
        ELSE 'invitee'
      END AS role
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
  v_my_entries RECORD;
  v_their_entries RECORD;
  v_role TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Syncing all existing sleep entries for user %', p_user_id;
  
  -- Prüfen, ob der Benutzer existiert
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE NOTICE 'User % does not exist', p_user_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Benutzer existiert nicht'
    );
  END IF;
  
  -- Prüfen, ob der Benutzer verknüpfte Benutzer hat
  IF NOT EXISTS (
    SELECT 1 
    FROM public.account_links 
    WHERE (creator_id = p_user_id OR invited_id = p_user_id) 
    AND status = 'accepted'
  ) THEN
    RAISE NOTICE 'User % has no linked users', p_user_id;
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Keine verknüpften Benutzer gefunden',
      'syncedCount', 0,
      'linkedUsers', '[]'::jsonb
    );
  END IF;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id, v_role;
    EXIT WHEN NOT FOUND;
    
    RAISE NOTICE 'Processing linked user % with role %', v_linked_user_id, v_role;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'displayName', COALESCE(p.display_name, 'Unbekannter Benutzer'),
        'linkRole', v_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Kopieren aller Schlafeinträge vom aktuellen Benutzer zum verknüpften Benutzer
    FOR v_my_entries IN
      SELECT * FROM sleep_entries 
      WHERE user_id = p_user_id 
      AND end_time IS NOT NULL
    LOOP
      -- Prüfen, ob der Eintrag bereits beim verknüpften Benutzer existiert
      IF NOT EXISTS (
        SELECT 1 
        FROM sleep_entries 
        WHERE user_id = v_linked_user_id 
        AND external_id = v_my_entries.id
      ) THEN
        -- Hinzufügen des Eintrags für den verknüpften Benutzer
        INSERT INTO sleep_entries (
          user_id,
          start_time,
          end_time,
          duration_minutes,
          notes,
          quality,
          external_id,
          synced_at
        ) VALUES (
          v_linked_user_id,
          v_my_entries.start_time,
          v_my_entries.end_time,
          v_my_entries.duration_minutes,
          v_my_entries.notes,
          v_my_entries.quality,
          v_my_entries.id,
          v_now
        );
        
        v_synced_count := v_synced_count + 1;
        RAISE NOTICE 'Copied sleep entry from % to %', p_user_id, v_linked_user_id;
      END IF;
    END LOOP;
    
    -- Kopieren aller Schlafeinträge vom verknüpften Benutzer zum aktuellen Benutzer
    FOR v_their_entries IN
      SELECT * FROM sleep_entries 
      WHERE user_id = v_linked_user_id 
      AND end_time IS NOT NULL
    LOOP
      -- Prüfen, ob der Eintrag bereits beim aktuellen Benutzer existiert
      IF NOT EXISTS (
        SELECT 1 
        FROM sleep_entries 
        WHERE user_id = p_user_id 
        AND external_id = v_their_entries.id
      ) THEN
        -- Hinzufügen des Eintrags für den aktuellen Benutzer
        INSERT INTO sleep_entries (
          user_id,
          start_time,
          end_time,
          duration_minutes,
          notes,
          quality,
          external_id,
          synced_at
        ) VALUES (
          p_user_id,
          v_their_entries.start_time,
          v_their_entries.end_time,
          v_their_entries.duration_minutes,
          v_their_entries.notes,
          v_their_entries.quality,
          v_their_entries.id,
          v_now
        );
        
        v_synced_count := v_synced_count + 1;
        RAISE NOTICE 'Copied sleep entry from % to %', v_linked_user_id, p_user_id;
      END IF;
    END LOOP;
    
    -- Aktualisiere den last_synced_at Zeitstempel in der account_links Tabelle
    UPDATE account_links
    SET last_synced_at = v_now
    WHERE (creator_id = p_user_id AND invited_id = v_linked_user_id)
       OR (creator_id = v_linked_user_id AND invited_id = p_user_id);
    
    RAISE NOTICE 'Synced % sleep entries with user %', v_synced_count, v_linked_user_id;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in sync_all_existing_sleep_entries: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_all_existing_sleep_entries IS 'Synchronisiert alle bestehenden Schlafeinträge zwischen verknüpften Benutzern';

-- Funktion zum Hinzufügen eines Schlafeintrags und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.add_sleep_entry_and_sync(
  p_user_id UUID,
  p_start_time TIMESTAMPTZ
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
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Adding sleep entry for user %', p_user_id;
  
  -- Hinzufügen des Schlafeintrags für den Benutzer
  INSERT INTO sleep_entries (
    user_id,
    start_time,
    created_at
  ) VALUES (
    p_user_id,
    p_start_time,
    v_now
  ) RETURNING id INTO v_entry_id;
  
  RAISE NOTICE 'Sleep entry added with ID %', v_entry_id;
  
  -- Erfolg zurückgeben mit Entry-ID
  RETURN jsonb_build_object(
    'success', true,
    'entryId', v_entry_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in add_sleep_entry_and_sync: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.add_sleep_entry_and_sync IS 'Fügt einen Schlafeintrag hinzu';

-- Funktion zum Aktualisieren eines Schlafeintrags und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.update_sleep_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID,
  p_end_time TIMESTAMPTZ,
  p_quality TEXT,
  p_notes TEXT DEFAULT NULL
)
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
  v_start_time TIMESTAMPTZ;
  v_duration_minutes INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Updating sleep entry % for user %', p_entry_id, p_user_id;
  
  -- Hole den bestehenden Eintrag, um die Dauer zu berechnen
  SELECT start_time INTO v_start_time
  FROM sleep_entries
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF v_start_time IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Eintrag nicht gefunden oder keine Berechtigung'
    );
  END IF;
  
  -- Berechne die Dauer in Minuten
  v_duration_minutes := EXTRACT(EPOCH FROM (p_end_time - v_start_time)) / 60;
  
  -- Aktualisiere den Eintrag
  UPDATE sleep_entries
  SET 
    end_time = p_end_time,
    duration_minutes = v_duration_minutes,
    quality = p_quality,
    notes = p_notes
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    RAISE NOTICE 'Found linked user %', v_linked_user_id;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'displayName', COALESCE(p.display_name, 'Unbekannter Benutzer')
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Hinzufügen des Schlafeintrags für den verknüpften Benutzer
    INSERT INTO sleep_entries (
      user_id,
      start_time,
      end_time,
      duration_minutes,
      quality,
      notes,
      external_id,
      synced_at,
      created_at
    ) VALUES (
      v_linked_user_id,
      v_start_time,
      p_end_time,
      v_duration_minutes,
      p_quality,
      p_notes,
      p_entry_id,
      v_now,
      v_now
    )
    ON CONFLICT (user_id, external_id) 
    DO UPDATE SET
      end_time = p_end_time,
      duration_minutes = v_duration_minutes,
      quality = p_quality,
      notes = p_notes,
      synced_at = v_now;
    
    RAISE NOTICE 'Sleep entry synced to user %', v_linked_user_id;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Aktualisiere den last_synced_at Zeitstempel in der account_links Tabelle
  UPDATE account_links
  SET last_synced_at = v_now
  WHERE (creator_id = p_user_id OR invited_id = p_user_id)
     AND status = 'accepted';
  
  RAISE NOTICE 'Synced to % users', v_synced_count;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in update_sleep_entry_and_sync: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.update_sleep_entry_and_sync IS 'Aktualisiert einen Schlafeintrag und synchronisiert ihn automatisch mit allen verknüpften Benutzern';

-- Funktion zum Löschen eines Schlafeintrags und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.delete_sleep_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID
)
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
  v_deleted_count INTEGER := 0;
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Deleting sleep entry % for user %', p_entry_id, p_user_id;
  
  -- Löschen des Eintrags
  DELETE FROM sleep_entries
  WHERE id = p_entry_id AND user_id = p_user_id
  RETURNING 1 INTO v_deleted_count;
  
  IF v_deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Eintrag nicht gefunden oder keine Berechtigung'
    );
  END IF;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    RAISE NOTICE 'Found linked user %', v_linked_user_id;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'displayName', COALESCE(p.display_name, 'Unbekannter Benutzer')
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Löschen des entsprechenden Eintrags beim verknüpften Benutzer
    DELETE FROM sleep_entries
    WHERE user_id = v_linked_user_id AND external_id = p_entry_id
    RETURNING 1 INTO v_synced_count;
    
    IF v_synced_count > 0 THEN
      RAISE NOTICE 'Deleted synced sleep entry for user %', v_linked_user_id;
    END IF;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Aktualisiere den last_synced_at Zeitstempel in der account_links Tabelle
  UPDATE account_links
  SET last_synced_at = v_now
  WHERE (creator_id = p_user_id OR invited_id = p_user_id)
     AND status = 'accepted';
  
  -- Erfolg zurückgeben mit Löschinformationen
  RETURN jsonb_build_object(
    'success', true,
    'deleted', true,
    'syncedCount', v_synced_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in delete_sleep_entry_and_sync: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.delete_sleep_entry_and_sync IS 'Löscht einen Schlafeintrag und synchronisiert die Löschung mit allen verknüpften Benutzern'; 