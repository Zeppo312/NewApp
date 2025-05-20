-- 1. Funktion zum Deaktivieren der Trigger für die Synchronisation
CREATE OR REPLACE FUNCTION public.disable_daily_sync_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
BEGIN
  -- Deaktiviere die Trigger
  ALTER TABLE public.baby_daily DISABLE TRIGGER trigger_sync_daily_entry;
  ALTER TABLE public.baby_daily DISABLE TRIGGER trigger_sync_updated_daily_entry;
  ALTER TABLE public.baby_daily DISABLE TRIGGER trigger_sync_deleted_daily_entry;
END;
$$;

-- 2. Funktion zum Aktivieren der Trigger für die Synchronisation
CREATE OR REPLACE FUNCTION public.enable_daily_sync_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
BEGIN
  -- Aktiviere die Trigger
  ALTER TABLE public.baby_daily ENABLE TRIGGER trigger_sync_daily_entry;
  ALTER TABLE public.baby_daily ENABLE TRIGGER trigger_sync_updated_daily_entry;
  ALTER TABLE public.baby_daily ENABLE TRIGGER trigger_sync_deleted_daily_entry;
END;
$$;

-- 3. Funktion zum manuellen Synchronisieren eines einzelnen Eintrags
CREATE OR REPLACE FUNCTION public.sync_single_daily_entry(p_user_id UUID, p_entry_date TIMESTAMPTZ, p_entry_type TEXT)
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
  v_entry RECORD;
  v_linked_entry_id UUID;
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
BEGIN
  -- Finde den Eintrag
  SELECT * INTO v_entry
  FROM public.baby_daily
  WHERE user_id = p_user_id
    AND entry_date = p_entry_date
    AND entry_type = p_entry_type;
  
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Eintrag nicht gefunden'
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
        start_time = v_entry.start_time,
        end_time = v_entry.end_time,
        notes = v_entry.notes,
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
        v_entry.entry_date,
        v_entry.entry_type,
        v_entry.start_time,
        v_entry.end_time,
        v_entry.notes,
        NOW(),
        NOW()
      );
    END IF;
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Eintrag erfolgreich synchronisiert',
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;
