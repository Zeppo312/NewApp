-- Korrigierte Version der Synchronisierungsfunktion, die user_connections verwendet
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
BEGIN
  -- Add user_uuid to debug info
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

  -- Find linked user using user_connections table
  BEGIN
    WITH connected_users AS (
      -- Als Einlader
      SELECT invited_id AS other_user_id, id AS connection_id
      FROM user_connections
      WHERE inviter_id = user_uuid AND status = 'active'
      UNION ALL
      -- Als Eingeladener
      SELECT inviter_id AS other_user_id, id AS connection_id
      FROM user_connections
      WHERE invited_id = user_uuid AND status = 'active'
    )
    SELECT other_user_id, connection_id INTO linked_user_id, link_id
    FROM connected_users
    LIMIT 1;
    
    -- Add linked user info to debug
    debug_info = jsonb_set(debug_info, '{linked_user_id}', COALESCE(to_jsonb(linked_user_id::text), 'null'::jsonb));
    debug_info = jsonb_set(debug_info, '{connection_id}', COALESCE(to_jsonb(link_id::text), 'null'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Error finding linked user: ' || SQLERRM, 
      'synced_count', 0,
      'debug_info', debug_info
    );
  END;
  
  -- If no linked user, return early
  IF linked_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'No active connected user found for user ID: ' || user_uuid::text,
      'synced_count', 0,
      'debug_info', debug_info
    );
  END IF;
  
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
    
    -- Add count of unique entries to debug info
    debug_info = jsonb_set(debug_info, '{unique_entries_count}', to_jsonb(jsonb_array_length(unique_entries)));
    
    -- Delete all existing entries for both users
    DELETE FROM baby_sleep_tracking
    WHERE user_id IN (user_uuid, linked_user_id);
    
    -- Insert all merged unique entries for both users
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
    
    -- Update the last_synced_at timestamp in user_connections
    IF link_id IS NOT NULL THEN
      UPDATE user_connections
      SET updated_at = now()
      WHERE id = link_id;
    END IF;
    
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
END;
$$; 