-- 1. Stelle sicher, dass die Tabelle die richtigen Standardwerte hat
ALTER TABLE public.sleep_entries
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.sleep_entries
ALTER COLUMN group_id DROP NOT NULL;

-- 2. Alle relevanten Funktionen löschen
DROP FUNCTION IF EXISTS public.add_sleep_entry_and_sync(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.add_sleep_entry_and_sync(UUID, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS public.update_sleep_entry_and_sync(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_sleep_entry_and_sync(UUID, UUID);
DROP FUNCTION IF EXISTS public.sync_all_existing_sleep_entries(UUID);
DROP FUNCTION IF EXISTS public.get_linked_users_with_details(UUID);

-- 3. Funktionen neu erstellen, die explizit mit sleep_entries Tabelle arbeiten
CREATE OR REPLACE FUNCTION public.add_sleep_entry_and_sync(
  p_user_id UUID,
  p_start_time TIMESTAMPTZ,
  p_group_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_entry_id UUID;
  v_linked_users JSONB;
  v_success BOOLEAN := true;
  v_error TEXT;
BEGIN
  -- Log für Debug-Zwecke
  RAISE NOTICE 'add_sleep_entry_and_sync: Starting with user_id: %, start_time: %, group_id: %', 
               p_user_id, p_start_time, p_group_id;
  
  -- Insert primary record
  INSERT INTO public.sleep_entries (
    user_id,
    start_time,
    group_id,
    created_by
  )
  VALUES (
    p_user_id,
    p_start_time,
    p_group_id,
    p_user_id  -- Explizit created_by setzen
  )
  RETURNING id INTO v_entry_id;
  
  RAISE NOTICE 'add_sleep_entry_and_sync: Added entry with ID: %', v_entry_id;
  
  -- Get linked users
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', CASE 
        WHEN creator_id = p_user_id THEN invited_id
        ELSE creator_id
      END,
      'displayName', profiles.display_name,
      'linkRole', CASE 
        WHEN creator_id = p_user_id THEN 'creator'
        ELSE 'invited'
      END
    )
  )
  INTO v_linked_users
  FROM public.account_links
  JOIN public.profiles ON (
    CASE 
      WHEN creator_id = p_user_id THEN profiles.id = invited_id
      ELSE profiles.id = creator_id
    END
  )
  WHERE (creator_id = p_user_id OR invited_id = p_user_id)
  AND status = 'accepted';

  RETURN jsonb_build_object(
    'success', v_success,
    'entryId', v_entry_id,
    'linkedUsers', COALESCE(v_linked_users, '[]'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in add_sleep_entry_and_sync: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function für sleep entries
CREATE OR REPLACE FUNCTION public.update_sleep_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID,
  p_end_time TIMESTAMPTZ,
  p_quality TEXT,
  p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
  v_linked_users JSONB;
  v_source_entry RECORD;
  v_success BOOLEAN := true;
  v_error TEXT;
  v_duration_minutes INTEGER;
BEGIN
  -- Log für Debug-Zwecke
  RAISE NOTICE 'update_sleep_entry_and_sync: Starting with user_id: %, entry_id: %, end_time: %, quality: %, notes: %', 
               p_user_id, p_entry_id, p_end_time, p_quality, p_notes;
  
  -- Get the source entry
  SELECT * INTO v_source_entry 
  FROM public.sleep_entries 
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF v_source_entry IS NULL THEN
    RAISE NOTICE 'update_sleep_entry_and_sync: Entry not found: %', p_entry_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entry not found or not owned by user'
    );
  END IF;
  
  -- Calculate duration in minutes if end_time is provided
  IF p_end_time IS NOT NULL AND v_source_entry.start_time IS NOT NULL THEN
    v_duration_minutes := EXTRACT(EPOCH FROM (p_end_time - v_source_entry.start_time)) / 60;
  END IF;
  
  -- Update the primary entry
  UPDATE public.sleep_entries
  SET 
    end_time = p_end_time,
    quality = p_quality,
    notes = p_notes,
    duration_minutes = v_duration_minutes,
    updated_at = now()
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  RAISE NOTICE 'update_sleep_entry_and_sync: Updated entry successfully';
  
  -- Get linked users
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', CASE 
        WHEN creator_id = p_user_id THEN invited_id
        ELSE creator_id
      END,
      'displayName', profiles.display_name,
      'linkRole', CASE 
        WHEN creator_id = p_user_id THEN 'creator'
        ELSE 'invited'
      END
    )
  )
  INTO v_linked_users
  FROM public.account_links
  JOIN public.profiles ON (
    CASE 
      WHEN creator_id = p_user_id THEN profiles.id = invited_id
      ELSE profiles.id = creator_id
    END
  )
  WHERE (creator_id = p_user_id OR invited_id = p_user_id)
  AND status = 'accepted';

  RETURN jsonb_build_object(
    'success', v_success,
    'entryId', p_entry_id,
    'linkedUsers', COALESCE(v_linked_users, '[]'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in update_sleep_entry_and_sync: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the functions for other operations
CREATE OR REPLACE FUNCTION public.delete_sleep_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_success BOOLEAN := true;
  v_error TEXT;
BEGIN
  -- Log für Debug-Zwecke
  RAISE NOTICE 'delete_sleep_entry_and_sync: Starting with user_id: %, entry_id: %', 
               p_user_id, p_entry_id;
  
  -- Delete the primary entry
  DELETE FROM public.sleep_entries
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'delete_sleep_entry_and_sync: Entry not found: %', p_entry_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entry not found or not owned by user'
    );
  END IF;

  RAISE NOTICE 'delete_sleep_entry_and_sync: Deleted entry successfully';
  
  RETURN jsonb_build_object(
    'success', v_success
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in delete_sleep_entry_and_sync: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync all existing entries
CREATE OR REPLACE FUNCTION public.sync_all_existing_sleep_entries(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_linked_users JSONB;
  v_synced_count INTEGER := 0;
  v_success BOOLEAN := true;
  v_error TEXT;
BEGIN
  -- Log für Debug-Zwecke
  RAISE NOTICE 'sync_all_existing_sleep_entries: Starting with user_id: %', p_user_id;
  
  -- Get linked users
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', CASE 
        WHEN creator_id = p_user_id THEN invited_id
        ELSE creator_id
      END,
      'displayName', profiles.display_name,
      'linkRole', CASE 
        WHEN creator_id = p_user_id THEN 'creator'
        ELSE 'invited'
      END
    )
  )
  INTO v_linked_users
  FROM public.account_links
  JOIN public.profiles ON (
    CASE 
      WHEN creator_id = p_user_id THEN profiles.id = invited_id
      ELSE profiles.id = creator_id
    END
  )
  WHERE (creator_id = p_user_id OR invited_id = p_user_id)
  AND status = 'accepted';

  -- No linked users, nothing to sync
  IF v_linked_users IS NULL OR jsonb_array_length(v_linked_users) = 0 THEN
    RAISE NOTICE 'sync_all_existing_sleep_entries: No linked users found';
    RETURN jsonb_build_object(
      'success', true,
      'syncedCount', 0,
      'linkedUsers', '[]'::jsonb
    );
  END IF;

  RAISE NOTICE 'sync_all_existing_sleep_entries: Found linked users: %', v_linked_users;
  
  RETURN jsonb_build_object(
    'success', v_success,
    'syncedCount', v_synced_count,
    'linkedUsers', COALESCE(v_linked_users, '[]'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in sync_all_existing_sleep_entries: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get linked users with details
CREATE OR REPLACE FUNCTION public.get_linked_users_with_details(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_linked_users JSONB;
BEGIN
  -- Log für Debug-Zwecke
  RAISE NOTICE 'get_linked_users_with_details: Starting with user_id: %', p_user_id;
  
  -- Get linked users with their details
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', CASE 
        WHEN creator_id = p_user_id THEN invited_id
        ELSE creator_id
      END,
      'displayName', profiles.display_name,
      'linkRole', CASE 
        WHEN creator_id = p_user_id THEN 'creator'
        ELSE 'invited'
      END
    )
  )
  INTO v_linked_users
  FROM public.account_links
  JOIN public.profiles ON (
    CASE 
      WHEN creator_id = p_user_id THEN profiles.id = invited_id
      ELSE profiles.id = creator_id
    END
  )
  WHERE (creator_id = p_user_id OR invited_id = p_user_id)
  AND status = 'accepted';

  RAISE NOTICE 'get_linked_users_with_details: Found linked users: %', v_linked_users;
  
  RETURN COALESCE(v_linked_users, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_linked_users_with_details: %', SQLERRM;
    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion zum Debuggen von start_sleep_tracking
CREATE OR REPLACE FUNCTION public.debug_start_sleep(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_error TEXT;
  v_entry_id UUID;
BEGIN
  -- Direkte Einfügung in die Tabelle (ohne komplizierte Logik)
  INSERT INTO public.sleep_entries (
    user_id,
    start_time,
    created_by
  )
  VALUES (
    p_user_id,
    now(),
    p_user_id
  )
  RETURNING id INTO v_entry_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entryId', v_entry_id,
    'message', 'Debug entry created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = PG_EXCEPTION_DETAIL;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', v_error
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.add_sleep_entry_and_sync IS 'Adds a sleep entry and syncs with linked users';
COMMENT ON FUNCTION public.update_sleep_entry_and_sync IS 'Updates a sleep entry and syncs with linked users';
COMMENT ON FUNCTION public.delete_sleep_entry_and_sync IS 'Deletes a sleep entry and syncs the deletion with linked users';
COMMENT ON FUNCTION public.sync_all_existing_sleep_entries IS 'Syncs all existing sleep entries with linked users';
COMMENT ON FUNCTION public.get_linked_users_with_details IS 'Gets details of linked users';
COMMENT ON FUNCTION public.debug_start_sleep IS 'Debug function for sleep entry creation'; 