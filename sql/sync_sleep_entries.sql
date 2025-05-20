-- Function to synchronize sleep entries between linked users
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
  column_exists BOOLEAN;
BEGIN
  -- Add user_uuid to debug info
  debug_info = jsonb_set(debug_info, '{user_uuid}', to_jsonb(user_uuid::text));
  
  -- Prüfe, welche Spalten in account_links existieren
  BEGIN
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'account_links' 
      AND column_name = 'source_user_id'
    ) INTO column_exists;
    
    debug_info = jsonb_set(debug_info, '{source_user_id_exists}', to_jsonb(column_exists));
    
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'account_links' 
      AND column_name = 'target_user_id'
    ) INTO column_exists;
    
    debug_info = jsonb_set(debug_info, '{target_user_id_exists}', to_jsonb(column_exists));
    
    -- Prüfe alternative Spaltennamen
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'account_links' 
      AND column_name = 'user_id'
    ) INTO column_exists;
    
    debug_info = jsonb_set(debug_info, '{user_id_exists}', to_jsonb(column_exists));
    
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'account_links' 
      AND column_name = 'linked_user_id'
    ) INTO column_exists;
    
    debug_info = jsonb_set(debug_info, '{linked_user_id_exists}', to_jsonb(column_exists));
    
    -- Prüfe, ob die Tabelle überhaupt existiert
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_name = 'account_links'
    ) INTO column_exists;
    
    debug_info = jsonb_set(debug_info, '{table_account_links_exists}', to_jsonb(column_exists));
    
    -- Listet alle Spaltennamen und Typen auf
    BEGIN
      SELECT jsonb_agg(jsonb_build_object('column_name', column_name, 'data_type', data_type))
      INTO debug_info
      FROM information_schema.columns
      WHERE table_name = 'account_links';
      
      debug_info = jsonb_set(debug_info, '{account_links_columns}', debug_info);
    EXCEPTION WHEN OTHERS THEN
      debug_info = jsonb_set(debug_info, '{error_getting_columns}', to_jsonb(SQLERRM));
    END;

    -- Prüfe auch auf user_connections Tabelle
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_name = 'user_connections'
    ) INTO column_exists;
    
    debug_info = jsonb_set(debug_info, '{table_user_connections_exists}', to_jsonb(column_exists));
  EXCEPTION WHEN OTHERS THEN
    debug_info = jsonb_set(debug_info, '{schema_check_error}', to_jsonb(SQLERRM));
  END;

  -- Validate input
  IF user_uuid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'User UUID cannot be null', 
      'synced_count', 0,
      'debug_info', debug_info
    );
  END IF;

  -- Versuch, einen verknüpften Benutzer zu finden
  BEGIN
    -- Erste Möglichkeit: account_links Tabelle mit source_user_id/target_user_id
    BEGIN
      SELECT 
        CASE 
          WHEN source_user_id = user_uuid THEN target_user_id 
          ELSE source_user_id 
        END INTO linked_user_id
      FROM account_links
      WHERE (source_user_id = user_uuid OR target_user_id = user_uuid)
        AND status = 'active'
      LIMIT 1;
      
      IF linked_user_id IS NOT NULL THEN
        debug_info = jsonb_set(debug_info, '{lookup_method}', '"account_links" with source/target');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      debug_info = jsonb_set(debug_info, '{error_account_links_lookup}', to_jsonb(SQLERRM));
    END;
    
    -- Zweite Möglichkeit: account_links mit anderen Spaltennamen
    IF linked_user_id IS NULL THEN
      BEGIN
        -- Diese Abfrage muss an die tatsächlichen Spaltennamen angepasst werden
        -- Hier nur als Platzhalter
        SELECT linked_user_id INTO linked_user_id
        FROM account_links
        WHERE user_id = user_uuid
          AND status = 'active'
        LIMIT 1;
        
        IF linked_user_id IS NOT NULL THEN
          debug_info = jsonb_set(debug_info, '{lookup_method}', '"account_links" with user_id/linked_user_id');
        END IF;
      EXCEPTION WHEN OTHERS THEN
        debug_info = jsonb_set(debug_info, '{error_account_links_alt_lookup}', to_jsonb(SQLERRM));
      END;
    END IF;
    
    -- Dritte Möglichkeit: user_connections Tabelle
    IF linked_user_id IS NULL THEN
      BEGIN
        -- Versuche, verknüpfte Benutzer aus der user_connections Tabelle zu bekommen
        WITH connected_users AS (
          SELECT invited_id AS connected_user_id
          FROM user_connections
          WHERE inviter_id = user_uuid AND status = 'active'
          UNION
          SELECT inviter_id AS connected_user_id
          FROM user_connections
          WHERE invited_id = user_uuid AND status = 'active'
        )
        SELECT connected_user_id INTO linked_user_id
        FROM connected_users
        LIMIT 1;
        
        IF linked_user_id IS NOT NULL THEN
          debug_info = jsonb_set(debug_info, '{lookup_method}', '"user_connections"');
        END IF;
      EXCEPTION WHEN OTHERS THEN
        debug_info = jsonb_set(debug_info, '{error_user_connections_lookup}', to_jsonb(SQLERRM));
      END;
    END IF;
    
    -- Füge linked_user_id zum Debug-Info hinzu
    debug_info = jsonb_set(debug_info, '{linked_user_id}', COALESCE(to_jsonb(linked_user_id::text), 'null'::jsonb));
    
    -- Wenn kein verknüpfter Benutzer gefunden wurde, early return
    IF linked_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'No active linked user found for user ID: ' || user_uuid::text,
        'synced_count', 0,
        'debug_info', debug_info
      );
    END IF;
    
    -- Get link ID for updating last_synced_at later
    SELECT id INTO link_id
    FROM account_links
    WHERE (source_user_id = user_uuid AND target_user_id = linked_user_id)
       OR (source_user_id = linked_user_id AND target_user_id = user_uuid)
    LIMIT 1;
    
    debug_info = jsonb_set(debug_info, '{link_id}', COALESCE(to_jsonb(link_id::text), 'null'::jsonb));
    
    -- Begin transaction
    BEGIN
      -- Add user entry count to debug
      SELECT COUNT(*) INTO counter FROM baby_sleep_tracking WHERE user_id = user_uuid;
      debug_info = jsonb_set(debug_info, '{user_entries_count}', to_jsonb(counter));
      counter := 0;
      
      -- Add linked user entry count to debug
      SELECT COUNT(*) INTO counter FROM baby_sleep_tracking WHERE user_id = linked_user_id;
      debug_info = jsonb_set(debug_info, '{linked_user_entries_count}', to_jsonb(counter));
      counter := 0;
      
      -- Get all entries from both users
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Error processing user entries: ' || SQLERRM, 
          'synced_count', 0,
          'debug_info', debug_info
        );
      END;
      
      -- Get all entries from linked user
      BEGIN
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
          -- Only add if not already present (based on external_id)
          IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(unique_entries) AS e 
            WHERE e->>'external_id' = linked_user_entries.entry_id::text
          ) THEN
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
          END IF;
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Error processing linked user entries: ' || SQLERRM, 
          'synced_count', 0,
          'debug_info', debug_info
        );
      END;
      
      -- Add count of unique entries to debug info
      debug_info = jsonb_set(debug_info, '{unique_entries_count}', to_jsonb(jsonb_array_length(unique_entries)));
      
      -- Delete all existing entries for both users
      BEGIN
        DELETE FROM baby_sleep_tracking
        WHERE user_id IN (user_uuid, linked_user_id);
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Error deleting existing entries: ' || SQLERRM, 
          'synced_count', 0,
          'debug_info', debug_info
        );
      END;
      
      -- Insert all merged unique entries for both users
      BEGIN
        FOR entry IN 
          SELECT * FROM jsonb_array_elements(unique_entries) AS e
        LOOP
          -- Insert for the original user
          INSERT INTO baby_sleep_tracking (
            user_id,
            start_time,
            end_time,
            duration_minutes,
            notes,
            quality,
            external_id,
            synced_from,
            synced_at,
            created_at,
            updated_at
          ) VALUES (
            user_uuid,
            (entry->>'start_time')::timestamp with time zone,
            (entry->>'end_time')::timestamp with time zone,
            (entry->>'duration_minutes')::integer,
            entry->>'notes',
            (entry->>'quality')::"text",
            (entry->>'external_id')::uuid,
            (entry->>'synced_from')::uuid,
            now(),
            COALESCE((entry->>'created_at')::timestamp with time zone, now()),
            COALESCE((entry->>'updated_at')::timestamp with time zone, now())
          );
          
          -- Insert for the linked user
          INSERT INTO baby_sleep_tracking (
            user_id,
            start_time,
            end_time,
            duration_minutes,
            notes,
            quality,
            external_id,
            synced_from,
            synced_at,
            created_at,
            updated_at
          ) VALUES (
            linked_user_id,
            (entry->>'start_time')::timestamp with time zone,
            (entry->>'end_time')::timestamp with time zone,
            (entry->>'duration_minutes')::integer,
            entry->>'notes',
            (entry->>'quality')::"text",
            (entry->>'external_id')::uuid,
            (entry->>'synced_from')::uuid,
            now(),
            COALESCE((entry->>'created_at')::timestamp with time zone, now()),
            COALESCE((entry->>'updated_at')::timestamp with time zone, now())
          );
          
          counter := counter + 1;
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Error inserting synchronized entries: ' || SQLERRM, 
          'synced_count', 0,
          'debug_info', debug_info
        );
      END;
      
      -- Update the last_synced_at timestamp in account_links
      BEGIN
        IF link_id IS NOT NULL THEN
          UPDATE account_links
          SET last_synced_at = now()
          WHERE id = link_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Error updating last_synced_at: ' || SQLERRM, 
          'synced_count', counter,
          'debug_info', debug_info
        );
      END;
      
      -- Commit the transaction
      RETURN jsonb_build_object(
        'success', true, 
        'synced_count', counter,
        'debug_info', debug_info
      );
    EXCEPTION WHEN OTHERS THEN
      -- In case of error, rollback and return the error
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Unhandled error in sync process: ' || SQLERRM, 
        'synced_count', 0,
        'debug_info', debug_info
      );
    END;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Error finding linked user: ' || SQLERRM, 
      'synced_count', 0,
      'debug_info', debug_info
    );
  END;
END;
$$;
