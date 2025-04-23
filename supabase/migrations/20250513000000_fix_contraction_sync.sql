-- Skript zur Behebung von Problemen mit der Synchronisierung der Wehen zwischen verknüpften Benutzern
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Überprüfen, ob die Tabelle 'contractions' existiert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'contractions'
  ) THEN
    RAISE EXCEPTION 'Die Tabelle "contractions" existiert nicht. Bitte erstellen Sie zuerst die Tabelle.';
  END IF;
END
$$;

-- 2. Überprüfen, ob die Tabelle 'account_links' existiert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'account_links'
  ) THEN
    RAISE EXCEPTION 'Die Tabelle "account_links" existiert nicht. Bitte erstellen Sie zuerst die Tabelle.';
  END IF;
END
$$;

-- 3. Überprüfen, ob die Tabelle 'profiles' existiert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'Die Tabelle "profiles" existiert nicht. Bitte erstellen Sie zuerst die Tabelle.';
  END IF;
END
$$;

-- 4. Überprüfen, ob es akzeptierte Verbindungen gibt
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.account_links WHERE status = 'accepted';
  
  IF v_count = 0 THEN
    RAISE NOTICE 'Es gibt keine akzeptierten Verbindungen zwischen Benutzern. Die Synchronisierung wird erst funktionieren, wenn Benutzer verbunden sind.';
  ELSE
    RAISE NOTICE 'Es gibt % akzeptierte Verbindungen zwischen Benutzern.', v_count;
  END IF;
END
$$;

-- 5. Verbesserte Funktion zum Abrufen der Wehen mit Synchronisierungsinformationen
CREATE OR REPLACE FUNCTION public.get_contractions_with_sync_info(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_contractions jsonb;
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
BEGIN
  -- Abrufen der Wehen des Benutzers
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'startTime', c.start_time,
          'endTime', c.end_time,
          'duration', c.duration,
          'intensity', c.intensity,
          'notes', c.notes
        )
      ),
      '[]'::jsonb
    ) INTO v_contractions
  FROM 
    public.contractions c
  WHERE 
    c.user_id = p_user_id
  ORDER BY 
    c.start_time DESC;
  
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
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'contractions', v_contractions,
    'syncInfo', jsonb_build_object(
      'linkedUsers', v_linked_users
    )
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_contractions_with_sync_info IS 'Gibt die Wehen des Benutzers mit Synchronisierungsinformationen zurück';

-- 6. Verbesserte Funktion zum Hinzufügen einer Wehe und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.add_contraction_and_sync(
  p_user_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_duration INTEGER,
  p_intensity TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_contraction_id UUID;
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
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Adding contraction for user %', p_user_id;
  
  -- Hinzufügen der Wehe für den Benutzer
  INSERT INTO public.contractions (
    user_id,
    start_time,
    end_time,
    duration,
    intensity,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_start_time,
    p_end_time,
    p_duration,
    p_intensity,
    p_notes,
    NOW(),
    NOW()
  ) RETURNING id INTO v_contraction_id;
  
  RAISE NOTICE 'Contraction added with ID %', v_contraction_id;
  
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
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Hinzufügen der Wehe für den verknüpften Benutzer
    INSERT INTO public.contractions (
      user_id,
      start_time,
      end_time,
      duration,
      intensity,
      notes,
      created_at,
      updated_at
    ) VALUES (
      v_linked_user_id,
      p_start_time,
      p_end_time,
      p_duration,
      p_intensity,
      p_notes,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Contraction synced to user %', v_linked_user_id;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RAISE NOTICE 'Synced to % users', v_synced_count;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'contractionId', v_contraction_id,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.add_contraction_and_sync IS 'Fügt eine Wehe hinzu und synchronisiert sie automatisch mit allen verknüpften Benutzern';

-- 7. Verbesserte Funktion zum Löschen einer Wehe und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.delete_contraction_and_sync(
  p_user_id UUID,
  p_contraction_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
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
  v_temp_count INTEGER;
  v_linked_users jsonb := '[]'::jsonb;
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Deleting contraction % for user %', p_contraction_id, p_user_id;
  
  -- Abrufen der Startzeit der zu löschenden Wehe
  SELECT 
    start_time INTO v_start_time
  FROM 
    public.contractions
  WHERE 
    id = p_contraction_id
    AND user_id = p_user_id;
  
  -- Wenn die Wehe nicht gefunden wurde, Fehler zurückgeben
  IF v_start_time IS NULL THEN
    RAISE NOTICE 'Contraction not found';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wehe nicht gefunden oder Sie haben keine Berechtigung, sie zu löschen.'
    );
  END IF;
  
  RAISE NOTICE 'Found contraction with start time %', v_start_time;
  
  -- Löschen der Wehe für den Benutzer
  DELETE FROM public.contractions
  WHERE id = p_contraction_id
    AND user_id = p_user_id;
  
  -- Zählen der gelöschten Wehen
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % contractions', v_deleted_count;
  
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
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Löschen der Wehe für den verknüpften Benutzer basierend auf der Startzeit
    DELETE FROM public.contractions
    WHERE user_id = v_linked_user_id
      AND start_time = v_start_time;
    
    -- Zählen der synchronisierten Löschungen
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_synced_count := v_synced_count + v_temp_count;
    
    RAISE NOTICE 'Deleted % contractions for user %', v_temp_count, v_linked_user_id;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RAISE NOTICE 'Synced deletion to % users', v_synced_count;
  
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
COMMENT ON FUNCTION public.delete_contraction_and_sync IS 'Löscht eine Wehe und synchronisiert die Löschung automatisch mit allen verknüpften Benutzern';

-- 8. Funktion zum einmaligen Synchronisieren aller bestehenden Wehen zwischen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.sync_all_existing_contractions(p_user_id UUID)
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
  v_my_contractions jsonb;
  v_their_contractions jsonb;
  v_merged_contractions jsonb;
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Syncing all existing contractions for user %', p_user_id;
  
  -- Abrufen aller Wehen des Benutzers
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'startTime', c.start_time,
          'endTime', c.end_time,
          'duration', c.duration,
          'intensity', c.intensity,
          'notes', c.notes
        )
      ),
      '[]'::jsonb
    ) INTO v_my_contractions
  FROM 
    public.contractions c
  WHERE 
    c.user_id = p_user_id;
  
  RAISE NOTICE 'Found % contractions for user %', jsonb_array_length(v_my_contractions), p_user_id;
  
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
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Abrufen aller Wehen des verknüpften Benutzers
    SELECT 
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'startTime', c.start_time,
            'endTime', c.end_time,
            'duration', c.duration,
            'intensity', c.intensity,
            'notes', c.notes
          )
        ),
        '[]'::jsonb
      ) INTO v_their_contractions
    FROM 
      public.contractions c
    WHERE 
      c.user_id = v_linked_user_id;
    
    RAISE NOTICE 'Found % contractions for linked user %', jsonb_array_length(v_their_contractions), v_linked_user_id;
    
    -- Zusammenführen der Wehen
    v_merged_contractions := v_my_contractions || v_their_contractions;
    
    -- Löschen aller bestehenden Wehen beider Benutzer
    DELETE FROM public.contractions
    WHERE user_id IN (p_user_id, v_linked_user_id);
    
    -- Hinzufügen aller zusammengeführten Wehen für beide Benutzer
    FOR i IN 0..jsonb_array_length(v_merged_contractions) - 1 LOOP
      INSERT INTO public.contractions (
        user_id,
        start_time,
        end_time,
        duration,
        intensity,
        notes,
        created_at,
        updated_at
      )
      SELECT
        p_user_id,
        (v_merged_contractions->i->>'startTime')::TIMESTAMPTZ,
        (v_merged_contractions->i->>'endTime')::TIMESTAMPTZ,
        (v_merged_contractions->i->>'duration')::INTEGER,
        v_merged_contractions->i->>'intensity',
        v_merged_contractions->i->>'notes',
        NOW(),
        NOW();
      
      INSERT INTO public.contractions (
        user_id,
        start_time,
        end_time,
        duration,
        intensity,
        notes,
        created_at,
        updated_at
      )
      SELECT
        v_linked_user_id,
        (v_merged_contractions->i->>'startTime')::TIMESTAMPTZ,
        (v_merged_contractions->i->>'endTime')::TIMESTAMPTZ,
        (v_merged_contractions->i->>'duration')::INTEGER,
        v_merged_contractions->i->>'intensity',
        v_merged_contractions->i->>'notes',
        NOW(),
        NOW();
      
      v_synced_count := v_synced_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Synced % contractions with user %', v_synced_count, v_linked_user_id;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_all_existing_contractions IS 'Synchronisiert alle bestehenden Wehen zwischen verknüpften Benutzern';

-- 9. Funktion zum Abrufen aller verknüpften Benutzer
CREATE OR REPLACE FUNCTION public.get_linked_users_with_details(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_linked_users jsonb := '[]'::jsonb;
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
  v_role TEXT;
BEGIN
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id, v_role;
    EXIT WHEN NOT FOUND;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role,
        'linkRole', v_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Erfolg zurückgeben mit verknüpften Benutzern
  RETURN jsonb_build_object(
    'success', true,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_linked_users_with_details IS 'Gibt alle verknüpften Benutzer mit Details zurück';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Synchronisierung der Wehen zwischen verknüpften Benutzern wurde verbessert.';
END
$$;
