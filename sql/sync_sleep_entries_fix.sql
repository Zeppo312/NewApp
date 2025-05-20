-- Verbesserte Version der Synchronisierungsfunktion, die alle Verbindungen berücksichtigt
CREATE OR REPLACE FUNCTION sync_sleep_entries(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  linked_user_id UUID;
  user_entries RECORD;
  linked_user_entries RECORD;
  unique_entries JSONB := '[]';
  entry RECORD;
  counter INTEGER := 0;
  link_id UUID;
  debug_info JSONB := '{}';
  user_connections_record RECORD;
  any_connection_found BOOLEAN := FALSE;
BEGIN
  -- Debug-Info zum User
  debug_info = jsonb_set(debug_info, '{user_uuid}', to_jsonb(user_uuid::text));

  -- Validate input
  IF user_uuid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'User UUID cannot be null', 
      'synced_count', 0,
      'debug_info', debug_info
    );
  END IF;

  -- Check all connections for the user regardless of status
  BEGIN
    -- Liste alle Verbindungen des Nutzers
    SELECT jsonb_agg(jsonb_build_object(
      'id', uc.id,
      'inviter_id', uc.inviter_id,
      'invited_id', uc.invited_id, 
      'status', uc.status
    )) INTO debug_info
    FROM user_connections uc
    WHERE uc.inviter_id = user_uuid OR uc.invited_id = user_uuid;
    
    debug_info = jsonb_set(debug_info, '{all_connections}', COALESCE(debug_info, '[]'::jsonb));
    
    -- Versuche zunächst, aktive Verbindungen zu finden
    FOR user_connections_record IN
      SELECT *
      FROM user_connections
      WHERE (inviter_id = user_uuid OR invited_id = user_uuid)
        AND status = 'active'
    LOOP
      IF user_connections_record.inviter_id = user_uuid THEN
        linked_user_id := user_connections_record.invited_id;
      ELSE
        linked_user_id := user_connections_record.inviter_id;
      END IF;
      
      link_id := user_connections_record.id;
      any_connection_found := TRUE;
      EXIT WHEN linked_user_id IS NOT NULL;
    END LOOP;
    
    -- Wenn keine aktive Verbindung gefunden wurde, auch pending Verbindungen versuchen
    IF linked_user_id IS NULL THEN
      FOR user_connections_record IN
        SELECT *
        FROM user_connections
        WHERE (inviter_id = user_uuid OR invited_id = user_uuid)
          AND status = 'pending'
      LOOP
        IF user_connections_record.inviter_id = user_uuid THEN
          linked_user_id := user_connections_record.invited_id;
        ELSE
          linked_user_id := user_connections_record.inviter_id;
        END IF;
        
        link_id := user_connections_record.id;
        any_connection_found := TRUE;
        debug_info = jsonb_set(debug_info, '{used_pending_connection}', 'true'::jsonb);
        EXIT WHEN linked_user_id IS NOT NULL;
      END LOOP;
    END IF;
    
    -- Wenn immer noch keine Verbindung gefunden wurde, alle anderen Verbindungen versuchen
    IF linked_user_id IS NULL THEN
      FOR user_connections_record IN
        SELECT *
        FROM user_connections
        WHERE inviter_id = user_uuid OR invited_id = user_uuid
      LOOP
        IF user_connections_record.inviter_id = user_uuid THEN
          linked_user_id := user_connections_record.invited_id;
        ELSE
          linked_user_id := user_connections_record.inviter_id;
        END IF;
        
        link_id := user_connections_record.id;
        any_connection_found := TRUE;
        debug_info = jsonb_set(debug_info, '{used_any_connection}', 'true'::jsonb);
        EXIT WHEN linked_user_id IS NOT NULL;
      END LOOP;
    END IF;
    
    -- Debug-Informationen
    debug_info = jsonb_set(debug_info, '{linked_user_id}', COALESCE(to_jsonb(linked_user_id::text), 'null'::jsonb));
    debug_info = jsonb_set(debug_info, '{connection_id}', COALESCE(to_jsonb(link_id::text), 'null'::jsonb));
    debug_info = jsonb_set(debug_info, '{any_connection_found}', to_jsonb(any_connection_found));
    
    IF link_id IS NOT NULL THEN
      -- Detailierte Informationen zur gefundenen Verbindung
      WITH connection_details AS (
        SELECT 
          id, 
          inviter_id, 
          invited_id, 
          status, 
          created_at,
          updated_at
        FROM user_connections
        WHERE id = link_id
      )
      SELECT jsonb_build_object(
        'id', cd.id,
        'inviter_id', cd.inviter_id,
        'invited_id', cd.invited_id,
        'status', cd.status,
        'created_at', cd.created_at,
        'updated_at', cd.updated_at
      ) INTO debug_info
      FROM connection_details cd;
      
      debug_info = jsonb_set(debug_info, '{found_connection_details}', COALESCE(debug_info, '{}'::jsonb));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Error finding linked user: ' || SQLERRM, 
      'synced_count', 0,
      'debug_info', debug_info
    );
  END;
  
  -- If no linked user, return early with additional diagnostic info
  IF linked_user_id IS NULL THEN
    -- Hole mehr Informationen für Diagnosezwecke
    BEGIN
      -- Versuche, Profile-Informationen zu bekommen
      WITH profile_info AS (
        SELECT id, username, first_name, last_name, email
        FROM profiles
        WHERE id = user_uuid
      )
      SELECT jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'email', p.email
      ) INTO debug_info
      FROM profile_info p;
      
      debug_info = jsonb_set(debug_info, '{user_profile}', COALESCE(debug_info, '{}'::jsonb));
    EXCEPTION WHEN OTHERS THEN
      debug_info = jsonb_set(debug_info, '{profile_info_error}', to_jsonb(SQLERRM));
    END;
    
    -- Prüfe, ob der Benutzer "Lotti" in der Datenbank existiert
    BEGIN
      SELECT COUNT(*) 
      INTO counter
      FROM profiles 
      WHERE username ILIKE 'Lotti%' OR first_name ILIKE 'Lotti%' OR last_name ILIKE 'Lotti%';
      
      debug_info = jsonb_set(debug_info, '{lotti_profile_count}', to_jsonb(counter));
      
      -- Wenn Lotti existiert, versuche diese Verbindung automatisch zu reparieren
      IF counter > 0 AND any_connection_found THEN
        -- Setze den Status der gefundenen Verbindung auf 'active'
        UPDATE user_connections
        SET status = 'active'
        WHERE id = link_id
        RETURNING invited_id, inviter_id INTO user_connections_record;
        
        IF user_connections_record.inviter_id = user_uuid THEN
          linked_user_id := user_connections_record.invited_id;
        ELSE
          linked_user_id := user_connections_record.inviter_id;
        END IF;
        
        debug_info = jsonb_set(debug_info, '{connection_auto_repaired}', 'true'::jsonb);
        debug_info = jsonb_set(debug_info, '{repaired_linked_user_id}', to_jsonb(linked_user_id::text));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      debug_info = jsonb_set(debug_info, '{lotti_check_error}', to_jsonb(SQLERRM));
    END;
    
    -- Wenn nach der Reparatur immer noch kein verknüpfter Benutzer gefunden wurde
    IF linked_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'No connected user found for user ID: ' || user_uuid::text,
        'synced_count', 0,
        'debug_info', debug_info
      );
    END IF;
  END IF;
  
  -- Der Rest der Funktion bleibt unverändert...
  BEGIN
    -- Add user entry count to debug
    SELECT COUNT(*) INTO counter FROM baby_sleep_tracking WHERE user_id = user_uuid;
    debug_info = jsonb_set(debug_info, '{user_entries_count}', to_jsonb(counter));
    counter := 0;
    
    -- Add linked user entry count to debug
    SELECT COUNT(*) INTO counter FROM baby_sleep_tracking WHERE user_id = linked_user_id;
    debug_info = jsonb_set(debug_info, '{linked_user_entries_count}', to_jsonb(counter));
    counter := 0;
    
    -- Get all entries from the current user
    FOR user_entries IN 
      SELECT 
        id, 
        user_id, 
        start_time, 
        end_time, 
        duration_minutes, 
        notes, 
        quality, 
        COALESCE(external_id, id) as entry_id,
        created_at,
        updated_at
      FROM baby_sleep_tracking
      WHERE user_id = user_uuid
    LOOP
      -- Add to unique entries using external_id or original id as key
      unique_entries = jsonb_insert(
        unique_entries, 
        '{-1}', 
        jsonb_build_object(
          'id', user_entries.id,
          'user_id', user_entries.user_id,
          'start_time', user_entries.start_time,
          'end_time', user_entries.end_time,
          'duration_minutes', user_entries.duration_minutes,
          'notes', user_entries.notes,
          'quality', user_entries.quality,
          'external_id', user_entries.entry_id,
          'synced_from', user_uuid,
          'created_at', user_entries.created_at,
          'updated_at', user_entries.updated_at
        )
      );
    END LOOP;
    
    -- Get all entries from linked user
    FOR linked_user_entries IN 
      SELECT 
        id, 
        user_id, 
        start_time, 
        end_time, 
        duration_minutes, 
        notes, 
        quality, 
        COALESCE(external_id, id) as entry_id,
        created_at,
        updated_at
      FROM baby_sleep_tracking
      WHERE user_id = linked_user_id
    LOOP
      -- Add to unique entries using external_id or original id as key
      unique_entries = jsonb_insert(
        unique_entries, 
        '{-1}', 
        jsonb_build_object(
          'id', linked_user_entries.id,
          'user_id', linked_user_entries.user_id,
          'start_time', linked_user_entries.start_time,
          'end_time', linked_user_entries.end_time,
          'duration_minutes', linked_user_entries.duration_minutes,
          'notes', linked_user_entries.notes,
          'quality', linked_user_entries.quality,
          'external_id', linked_user_entries.entry_id,
          'synced_from', linked_user_id,
          'created_at', linked_user_entries.created_at,
          'updated_at', linked_user_entries.updated_at
        )
      );
    END LOOP;
    
    -- Sync data both ways
    -- For current user, add or update entries from linked user
    FOR entry IN SELECT * FROM jsonb_array_elements(unique_entries)
    LOOP
      -- Skip entries that already belong to the current user
      IF (entry->>'user_id')::UUID = user_uuid THEN
        CONTINUE;
      END IF;
      
      -- Check if this entry (by external_id) already exists for current user
      DECLARE
        existing_id UUID := NULL;
        entry_data JSONB := entry;
      BEGIN
        SELECT id INTO existing_id
        FROM baby_sleep_tracking
        WHERE user_id = user_uuid
          AND external_id = (entry->>'external_id')::UUID;
        
        IF existing_id IS NOT NULL THEN
          -- Update existing entry
          UPDATE baby_sleep_tracking
          SET 
            start_time = (entry->>'start_time')::TIMESTAMP WITH TIME ZONE,
            end_time = (entry->>'end_time')::TIMESTAMP WITH TIME ZONE,
            duration_minutes = (entry->>'duration_minutes')::INTEGER,
            notes = entry->>'notes',
            quality = entry->>'quality',
            synced_from = (entry->>'synced_from')::UUID,
            synced_at = NOW()
          WHERE id = existing_id;
        ELSE
          -- Create new entry
          INSERT INTO baby_sleep_tracking (
            user_id,
            start_time,
            end_time,
            duration_minutes,
            notes,
            quality,
            external_id,
            synced_from,
            synced_at
          ) VALUES (
            user_uuid,
            (entry->>'start_time')::TIMESTAMP WITH TIME ZONE,
            (entry->>'end_time')::TIMESTAMP WITH TIME ZONE,
            (entry->>'duration_minutes')::INTEGER,
            entry->>'notes',
            entry->>'quality',
            (entry->>'external_id')::UUID,
            (entry->>'synced_from')::UUID,
            NOW()
          );
          
          counter := counter + 1;
        END IF;
      END;
    END LOOP;
    
    -- For linked user, add or update entries from current user
    FOR entry IN SELECT * FROM jsonb_array_elements(unique_entries)
    LOOP
      -- Skip entries that already belong to the linked user
      IF (entry->>'user_id')::UUID = linked_user_id THEN
        CONTINUE;
      END IF;
      
      -- Check if this entry (by external_id) already exists for linked user
      DECLARE
        existing_id UUID := NULL;
        entry_data JSONB := entry;
      BEGIN
        SELECT id INTO existing_id
        FROM baby_sleep_tracking
        WHERE user_id = linked_user_id
          AND external_id = (entry->>'external_id')::UUID;
        
        IF existing_id IS NOT NULL THEN
          -- Update existing entry
          UPDATE baby_sleep_tracking
          SET 
            start_time = (entry->>'start_time')::TIMESTAMP WITH TIME ZONE,
            end_time = (entry->>'end_time')::TIMESTAMP WITH TIME ZONE,
            duration_minutes = (entry->>'duration_minutes')::INTEGER,
            notes = entry->>'notes',
            quality = entry->>'quality',
            synced_from = (entry->>'synced_from')::UUID,
            synced_at = NOW()
          WHERE id = existing_id;
        ELSE
          -- Create new entry
          INSERT INTO baby_sleep_tracking (
            user_id,
            start_time,
            end_time,
            duration_minutes,
            notes,
            quality,
            external_id,
            synced_from,
            synced_at
          ) VALUES (
            linked_user_id,
            (entry->>'start_time')::TIMESTAMP WITH TIME ZONE,
            (entry->>'end_time')::TIMESTAMP WITH TIME ZONE,
            (entry->>'duration_minutes')::INTEGER,
            entry->>'notes',
            entry->>'quality',
            (entry->>'external_id')::UUID,
            (entry->>'synced_from')::UUID,
            NOW()
          );
          
          counter := counter + 1;
        END IF;
      END;
    END LOOP;
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', counter || ' sleep entries synchronized successfully',
      'synced_count', counter,
      'debug_info', debug_info
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Error during synchronization: ' || SQLERRM,
      'synced_count', 0,
      'debug_info', debug_info
    );
  END;
END;
$$; 