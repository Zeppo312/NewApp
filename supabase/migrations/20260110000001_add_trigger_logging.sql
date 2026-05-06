-- Add logging to partner notification trigger function for debugging
-- This will help us understand why triggers aren't firing from the app

CREATE OR REPLACE FUNCTION create_partner_sleep_notification()
RETURNS TRIGGER AS $$
DECLARE
  partner_user_id UUID;
BEGIN
  -- Log that trigger was called
  RAISE NOTICE 'Sleep trigger fired for entry: %, user: %', NEW.id, NEW.user_id;

  -- Get partner ID from account_links table
  SELECT CASE
    WHEN creator_id = NEW.user_id THEN invited_id
    ELSE creator_id
  END INTO partner_user_id
  FROM account_links
  WHERE status = 'accepted'
    AND relationship_type = 'partner'
    AND (creator_id = NEW.user_id OR invited_id = NEW.user_id)
  LIMIT 1;

  -- Log partner lookup result
  RAISE NOTICE 'Partner lookup result: %', partner_user_id;

  -- If no partner exists, exit early
  IF partner_user_id IS NULL THEN
    RAISE NOTICE 'No partner found, exiting';
    RETURN NEW;
  END IF;

  -- Log before insert
  RAISE NOTICE 'Inserting notification for partner: %', partner_user_id;

  -- Insert notification for partner
  INSERT INTO partner_activity_notifications (
    user_id,
    partner_id,
    activity_type,
    activity_subtype,
    entry_id,
    is_read,
    created_at
  ) VALUES (
    partner_user_id,      -- The partner who should receive the notification
    NEW.user_id,          -- The user who created the entry
    'sleep',              -- Type of activity
    NULL,                 -- No subtype for sleep
    NEW.id,               -- Reference to the entry
    false,                -- Not read initially
    NOW()                 -- Current timestamp
  );

  RAISE NOTICE 'Notification created successfully';

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in trigger: %', SQLERRM;
    -- Return NEW to not block the insert
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_partner_care_notification()
RETURNS TRIGGER AS $$
DECLARE
  partner_user_id UUID;
  activity_subtype_value TEXT;
BEGIN
  -- Log that trigger was called
  RAISE NOTICE 'Care trigger fired for entry: %, user: %, type: %', NEW.id, NEW.user_id, NEW.entry_type;

  -- Get partner ID from account_links table
  SELECT CASE
    WHEN creator_id = NEW.user_id THEN invited_id
    ELSE creator_id
  END INTO partner_user_id
  FROM account_links
  WHERE status = 'accepted'
    AND relationship_type = 'partner'
    AND (creator_id = NEW.user_id OR invited_id = NEW.user_id)
  LIMIT 1;

  -- Log partner lookup result
  RAISE NOTICE 'Partner lookup result: %', partner_user_id;

  -- If no partner exists, exit early
  IF partner_user_id IS NULL THEN
    RAISE NOTICE 'No partner found, exiting';
    RETURN NEW;
  END IF;

  -- Determine subtype based on entry type
  IF NEW.entry_type = 'feeding' THEN
    activity_subtype_value := NEW.feeding_type::TEXT;
  ELSIF NEW.entry_type = 'diaper' THEN
    activity_subtype_value := NEW.diaper_type::TEXT;
  ELSE
    activity_subtype_value := NULL;
  END IF;

  -- Log before insert
  RAISE NOTICE 'Inserting notification for partner: %, subtype: %', partner_user_id, activity_subtype_value;

  -- Insert notification for partner
  INSERT INTO partner_activity_notifications (
    user_id,
    partner_id,
    activity_type,
    activity_subtype,
    entry_id,
    is_read,
    created_at
  ) VALUES (
    partner_user_id,           -- The partner who should receive the notification
    NEW.user_id,               -- The user who created the entry
    NEW.entry_type::TEXT,      -- Type of activity (feeding or diaper)
    activity_subtype_value,    -- Subtype
    NEW.id,                    -- Reference to the entry
    false,                     -- Not read initially
    NOW()                      -- Current timestamp
  );

  RAISE NOTICE 'Notification created successfully';

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in trigger: %', SQLERRM;
    -- Return NEW to not block the insert
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_partner_sleep_notification IS 'Trigger function with logging for debugging partner sleep notifications';
COMMENT ON FUNCTION create_partner_care_notification IS 'Trigger function with logging for debugging partner care notifications';
