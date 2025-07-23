-- Create a new sleep entries table with proper defaults
CREATE TABLE IF NOT EXISTS public.sleep_entries_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  quality TEXT CHECK (quality IN ('good', 'medium', 'bad') OR quality IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  group_id UUID,
  external_id TEXT,
  synced_at TIMESTAMPTZ,
  
  CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add RLS policies to the new table
ALTER TABLE public.sleep_entries_new ENABLE ROW LEVEL SECURITY;

-- Policy for viewing entries: Users can see their own entries and entries shared with them
CREATE POLICY "Users can view their own entries and shared entries" 
  ON public.sleep_entries_new
  FOR SELECT 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.account_links
      WHERE (
        (creator_id = auth.uid() AND invited_id = user_id) OR
        (invited_id = auth.uid() AND creator_id = user_id)
      )
      AND status = 'accepted'
    )
  );

-- Policy for inserting entries: Users can only insert their own entries
CREATE POLICY "Users can insert their own entries" 
  ON public.sleep_entries_new
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy for updating entries: Users can only update their own entries
CREATE POLICY "Users can update only their own entries" 
  ON public.sleep_entries_new
  FOR UPDATE
  USING (user_id = auth.uid());

-- Policy for deleting entries: Users can only delete their own entries
CREATE POLICY "Users can delete only their own entries" 
  ON public.sleep_entries_new
  FOR DELETE
  USING (user_id = auth.uid());

-- Index for faster queries
CREATE INDEX idx_sleep_entries_new_user_id ON public.sleep_entries_new(user_id);
CREATE INDEX idx_sleep_entries_new_end_time ON public.sleep_entries_new(end_time) WHERE end_time IS NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sleep_entries_new_updated_at
BEFORE UPDATE ON public.sleep_entries_new
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Drop existing functions before recreating them
DROP FUNCTION IF EXISTS public.add_sleep_entry_and_sync(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.update_sleep_entry_and_sync(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_sleep_entry_and_sync(UUID, UUID);
DROP FUNCTION IF EXISTS public.sync_all_existing_sleep_entries(UUID);
DROP FUNCTION IF EXISTS public.get_linked_users_with_details(UUID);

-- Update the RPC functions to use the new table
CREATE OR REPLACE FUNCTION public.add_sleep_entry_and_sync(
  p_user_id UUID,
  p_start_time TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
  v_entry_id UUID;
  v_linked_users JSONB;
  v_success BOOLEAN := true;
  v_error TEXT;
BEGIN
  -- Insert primary record
  INSERT INTO public.sleep_entries_new (
    user_id,
    start_time
  )
  VALUES (
    p_user_id,
    p_start_time
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

-- Update the function for updating sleep entries
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
  v_linked_entry_id UUID;
  v_success BOOLEAN := true;
  v_error TEXT;
  v_duration_minutes INTEGER;
BEGIN
  -- Get the source entry
  SELECT * INTO v_source_entry 
  FROM public.sleep_entries_new 
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
  UPDATE public.sleep_entries_new
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

-- Update the function for deleting sleep entries
CREATE OR REPLACE FUNCTION public.delete_sleep_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_success BOOLEAN := true;
  v_error TEXT;
BEGIN
  -- Delete the primary entry
  DELETE FROM public.sleep_entries_new
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

-- Add migration to copy data from old table to new table
-- Uncomment this when ready to migrate
/*
INSERT INTO public.sleep_entries_new (
  id, user_id, start_time, end_time, duration_minutes, 
  notes, quality, created_at, updated_at,
  created_by, group_id, external_id, synced_at
)
SELECT
  id, user_id, start_time, end_time, duration_minutes,
  notes, quality, created_at, updated_at,
  COALESCE(created_by, user_id), group_id, external_id, synced_at
FROM
  public.sleep_entries;
*/

-- Uncomment this when ready to switch tables
/*
-- Rename tables to switch
ALTER TABLE public.sleep_entries RENAME TO sleep_entries_old;
ALTER TABLE public.sleep_entries_new RENAME TO sleep_entries;

-- Update sequences and dependencies if needed
*/

COMMENT ON FUNCTION public.add_sleep_entry_and_sync IS 'Adds a sleep entry and syncs with linked users';
COMMENT ON FUNCTION public.update_sleep_entry_and_sync IS 'Updates a sleep entry and syncs with linked users';
COMMENT ON FUNCTION public.delete_sleep_entry_and_sync IS 'Deletes a sleep entry and syncs the deletion with linked users';
COMMENT ON FUNCTION public.sync_all_existing_sleep_entries IS 'Syncs all existing sleep entries with linked users';
COMMENT ON FUNCTION public.get_linked_users_with_details IS 'Gets details of linked users'; 