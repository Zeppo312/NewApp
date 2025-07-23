-- Skript zum Hinzufügen der Spalte "notes" zur Tabelle "contractions"
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

-- 2. Überprüfen, ob die Spalte 'notes' bereits existiert
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contractions' 
    AND column_name = 'notes'
  ) THEN
    RAISE NOTICE 'Die Spalte "notes" existiert bereits in der Tabelle "contractions".';
  ELSE
    -- 3. Hinzufügen der Spalte 'notes' zur Tabelle 'contractions'
    ALTER TABLE public.contractions ADD COLUMN notes TEXT;
    RAISE NOTICE 'Die Spalte "notes" wurde zur Tabelle "contractions" hinzugefügt.';
  END IF;
END
$$;

-- 4. Aktualisieren der Funktionen, die mit der Tabelle 'contractions' arbeiten

-- Verbesserte Funktion zum Hinzufügen einer Wehe und Synchronisieren mit allen verknüpften Benutzern
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in add_contraction_and_sync: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Verbesserte Funktion zum einmaligen Synchronisieren aller bestehenden Wehen zwischen verknüpften Benutzern
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
  v_my_contractions RECORD;
  v_their_contractions RECORD;
BEGIN
  -- Debug-Ausgabe
  RAISE NOTICE 'Syncing all existing contractions for user %', p_user_id;
  
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
    
    -- Kopieren aller Wehen vom Benutzer zum verknüpften Benutzer
    FOR v_my_contractions IN 
      SELECT * FROM public.contractions WHERE user_id = p_user_id
    LOOP
      -- Prüfen, ob die Wehe bereits beim verknüpften Benutzer existiert
      IF NOT EXISTS (
        SELECT 1 
        FROM public.contractions 
        WHERE user_id = v_linked_user_id 
        AND start_time = v_my_contractions.start_time
      ) THEN
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
          v_my_contractions.start_time,
          v_my_contractions.end_time,
          v_my_contractions.duration,
          v_my_contractions.intensity,
          v_my_contractions.notes,
          NOW(),
          NOW()
        );
        
        v_synced_count := v_synced_count + 1;
        RAISE NOTICE 'Copied contraction from % to %', p_user_id, v_linked_user_id;
      END IF;
    END LOOP;
    
    -- Kopieren aller Wehen vom verknüpften Benutzer zum Benutzer
    FOR v_their_contractions IN 
      SELECT * FROM public.contractions WHERE user_id = v_linked_user_id
    LOOP
      -- Prüfen, ob die Wehe bereits beim Benutzer existiert
      IF NOT EXISTS (
        SELECT 1 
        FROM public.contractions 
        WHERE user_id = p_user_id 
        AND start_time = v_their_contractions.start_time
      ) THEN
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
          v_their_contractions.start_time,
          v_their_contractions.end_time,
          v_their_contractions.duration,
          v_their_contractions.intensity,
          v_their_contractions.notes,
          NOW(),
          NOW()
        );
        
        v_synced_count := v_synced_count + 1;
        RAISE NOTICE 'Copied contraction from % to %', v_linked_user_id, p_user_id;
      END IF;
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in sync_all_existing_contractions: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Spalte "notes" wurde zur Tabelle "contractions" hinzugefügt und die Funktionen wurden aktualisiert.';
END
$$;
