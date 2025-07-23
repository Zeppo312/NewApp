-- Skript zur Behebung von Problemen mit der Funktion sync_all_existing_contractions
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

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

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_all_existing_contractions IS 'Synchronisiert alle bestehenden Wehen zwischen verknüpften Benutzern';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Funktion sync_all_existing_contractions wurde verbessert.';
END
$$;
