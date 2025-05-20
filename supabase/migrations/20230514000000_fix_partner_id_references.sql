-- Fix entries with literal 'PARTNER_ID' instead of an actual UUID
-- This migration removes invalid 'PARTNER_ID' values and will set correct values based on the user connections

-- First remove invalid entries
UPDATE sleep_entries
SET shared_with_user_id = NULL
WHERE shared_with_user_id::text = 'PARTNER_ID';

-- Create a function to properly update entries with partner IDs
CREATE OR REPLACE FUNCTION fix_sleep_entry_sharing()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec RECORD;
BEGIN
  -- For each user with entries that need sharing
  FOR rec IN (
    SELECT DISTINCT s.user_id, 
           (SELECT invited_id FROM user_connections 
            WHERE inviter_id = s.user_id AND status = 'active' 
            LIMIT 1) as partner_id
    FROM sleep_entries s
    WHERE s.shared_with_user_id IS NULL
    AND EXISTS (
      SELECT 1 FROM user_connections 
      WHERE inviter_id = s.user_id AND status = 'active'
    )
  ) LOOP
    -- Skip if no partner found
    IF rec.partner_id IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Update entries to share with the partner
    UPDATE sleep_entries
    SET shared_with_user_id = rec.partner_id,
        synced_at = NOW()
    WHERE user_id = rec.user_id
    AND shared_with_user_id IS NULL;
    
    RAISE NOTICE 'Updated entries for user % to share with partner %', rec.user_id, rec.partner_id;
  END LOOP;
END;
$$;

-- Execute the function
SELECT fix_sleep_entry_sharing();

-- Drop the function (cleanup)
DROP FUNCTION fix_sleep_entry_sharing(); 