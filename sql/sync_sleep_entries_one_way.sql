-- Synchronisierungsfunktion für Schlafeinträge im Stil der Daily Entries (Einladender hat Priorität)
CREATE OR REPLACE FUNCTION sync_sleep_entries_one_way(user_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  connected_user_id UUID;
  is_inviter BOOLEAN := FALSE;
  connection_id UUID;
  user_entries RECORD;
  counter INTEGER := 0;
  debug_info JSONB := '{}';
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

  -- Finde verbundenen Benutzer und bestimme Rolle (Einladender oder Eingeladener)
  BEGIN
    -- Verbindungen als Einladender (inviter)
    SELECT invited_id, id INTO connected_user_id, connection_id
    FROM user_connections
    WHERE inviter_id = user_uuid AND status = 'active'
    LIMIT 1;
    
    IF connected_user_id IS NOT NULL THEN
      is_inviter := TRUE;
    ELSE
      -- Verbindungen als Eingeladener (invited)
      SELECT inviter_id, id INTO connected_user_id, connection_id
      FROM user_connections
      WHERE invited_id = user_uuid AND status = 'active'
      LIMIT 1;
      
      is_inviter := FALSE;
    END IF;
    
    -- Debugging-Informationen
    debug_info = jsonb_set(debug_info, '{connected_user_id}', COALESCE(to_jsonb(connected_user_id::text), 'null'::jsonb));
    debug_info = jsonb_set(debug_info, '{connection_id}', COALESCE(to_jsonb(connection_id::text), 'null'::jsonb));
    debug_info = jsonb_set(debug_info, '{is_inviter}', to_jsonb(is_inviter));
    
    -- Wenn kein verbundener Benutzer gefunden wurde
    IF connected_user_id IS NULL THEN
      -- Suche nach "pending" Verbindungen und aktiviere sie
      SELECT invited_id, id INTO connected_user_id, connection_id
      FROM user_connections
      WHERE inviter_id = user_uuid AND status = 'pending'
      LIMIT 1;
      
      IF connected_user_id IS NOT NULL THEN
        -- Aktiviere die erste gefundene ausstehende Verbindung
        UPDATE user_connections
        SET status = 'active'
        WHERE id = connection_id;
        
        is_inviter := TRUE;
        debug_info = jsonb_set(debug_info, '{activated_pending_connection}', 'true'::jsonb);
        debug_info = jsonb_set(debug_info, '{connected_user_id}', to_jsonb(connected_user_id::text));
      ELSE
        -- Prüfe auf ausstehende Einladungen
        SELECT inviter_id, id INTO connected_user_id, connection_id
        FROM user_connections
        WHERE invited_id = user_uuid AND status = 'pending'
        LIMIT 1;
        
        IF connected_user_id IS NOT NULL THEN
          -- Aktiviere die erste gefundene ausstehende Einladung
          UPDATE user_connections
          SET status = 'active'
          WHERE id = connection_id;
          
          is_inviter := FALSE;
          debug_info = jsonb_set(debug_info, '{activated_pending_invitation}', 'true'::jsonb);
          debug_info = jsonb_set(debug_info, '{connected_user_id}', to_jsonb(connected_user_id::text));
        ELSE
          RETURN jsonb_build_object(
            'success', false, 
            'error', 'No connected user found for user ID: ' || user_uuid::text,
            'synced_count', 0,
            'debug_info', debug_info
          );
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Error finding connected user: ' || SQLERRM,
      'synced_count', 0,
      'debug_info', debug_info
    );
  END;
  
  -- Jetzt können wir mit der Synchronisierung beginnen
  BEGIN
    -- Zähle die Einträge für Debugging
    SELECT COUNT(*) INTO counter FROM baby_sleep_tracking WHERE user_id = user_uuid;
    debug_info = jsonb_set(debug_info, '{user_entries_count}', to_jsonb(counter));
    
    SELECT COUNT(*) INTO counter FROM baby_sleep_tracking WHERE user_id = connected_user_id;
    debug_info = jsonb_set(debug_info, '{connected_user_entries_count}', to_jsonb(counter));
    
    counter := 0;
    
    -- Je nach Rolle verschiedene Synchronisierungsstrategie
    IF is_inviter THEN
      -- Wenn aktueller Benutzer der Einladende ist:
      -- 1. Lösche alle Einträge des verbundenen Benutzers (eingeladener Benutzer)
      DELETE FROM baby_sleep_tracking
      WHERE user_id = connected_user_id;
      
      -- 2. Kopiere alle Einträge vom aktuellen Benutzer zum verbundenen Benutzer
      FOR user_entries IN 
        SELECT 
          id, 
          start_time, 
          end_time, 
          duration_minutes, 
          notes, 
          quality,
          external_id
        FROM baby_sleep_tracking
        WHERE user_id = user_uuid
      LOOP
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
          connected_user_id,
          user_entries.start_time,
          user_entries.end_time,
          user_entries.duration_minutes,
          user_entries.notes,
          user_entries.quality,
          COALESCE(user_entries.external_id, user_entries.id),
          user_uuid,
          NOW()
        );
        
        counter := counter + 1;
      END LOOP;
      
      debug_info = jsonb_set(debug_info, '{sync_direction}', '"inviter_to_invited"'::jsonb);
    ELSE
      -- Wenn aktueller Benutzer der Eingeladene ist:
      -- 1. Lösche alle Einträge des aktuellen Benutzers
      DELETE FROM baby_sleep_tracking
      WHERE user_id = user_uuid;
      
      -- 2. Kopiere alle Einträge vom verbundenen Benutzer (Einladenden) zum aktuellen Benutzer
      FOR user_entries IN 
        SELECT 
          id, 
          start_time, 
          end_time, 
          duration_minutes, 
          notes, 
          quality,
          external_id
        FROM baby_sleep_tracking
        WHERE user_id = connected_user_id
      LOOP
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
          user_entries.start_time,
          user_entries.end_time,
          user_entries.duration_minutes,
          user_entries.notes,
          user_entries.quality,
          COALESCE(user_entries.external_id, user_entries.id),
          connected_user_id,
          NOW()
        );
        
        counter := counter + 1;
      END LOOP;
      
      debug_info = jsonb_set(debug_info, '{sync_direction}', '"invited_from_inviter"'::jsonb);
    END IF;
    
    -- Aktualisiere den "updated_at" Zeitstempel in der Verbindung
    UPDATE user_connections
    SET updated_at = NOW()
    WHERE id = connection_id;
    
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