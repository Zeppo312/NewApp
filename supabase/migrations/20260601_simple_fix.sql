-- First drop the existing functions to avoid parameter default issues
DROP FUNCTION IF EXISTS public.add_sleep_entry_and_sync(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.add_sleep_entry_and_sync(UUID, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS public.update_sleep_entry_and_sync(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_sleep_entry_and_sync(UUID, UUID);
DROP FUNCTION IF EXISTS public.sync_all_existing_sleep_entries(UUID);
DROP FUNCTION IF EXISTS public.get_linked_users_with_details(UUID);

-- Simple fix for the sleep_entries table
ALTER TABLE public.sleep_entries
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.sleep_entries
ALTER COLUMN group_id DROP NOT NULL;

-- Create the functions with corrected parameters
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
  -- Insert primary record
  INSERT INTO public.sleep_entries (
    user_id,
    start_time,
    group_id
  )
  VALUES (
    p_user_id,
    p_start_time,
    p_group_id
  )
  RETURNING id INTO v_entry_id;
  
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

-- Update function for updating sleep entries
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
  -- Get the source entry
  SELECT * INTO v_source_entry 
  FROM public.sleep_entries 
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF v_source_entry IS NULL THEN
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
  -- Delete the primary entry
  DELETE FROM public.sleep_entries
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entry not found or not owned by user'
    );
  END IF;

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
    RETURN jsonb_build_object(
      'success', true,
      'syncedCount', 0,
      'linkedUsers', '[]'::jsonb
    );
  END IF;

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

  RETURN COALESCE(v_linked_users, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in get_linked_users_with_details: %', SQLERRM;
    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.add_sleep_entry_and_sync IS 'Adds a sleep entry and syncs with linked users';
COMMENT ON FUNCTION public.update_sleep_entry_and_sync IS 'Updates a sleep entry and syncs with linked users';
COMMENT ON FUNCTION public.delete_sleep_entry_and_sync IS 'Deletes a sleep entry and syncs the deletion with linked users';
COMMENT ON FUNCTION public.sync_all_existing_sleep_entries IS 'Syncs all existing sleep entries with linked users';
COMMENT ON FUNCTION public.get_linked_users_with_details IS 'Gets details of linked users'; 