-- Create partner_activity_notifications table for tracking partner activities
-- This table stores notifications that should be shown to partners when activities are created

CREATE TABLE IF NOT EXISTS partner_activity_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'sleep', 'feeding', 'diaper'
  activity_subtype TEXT, -- 'BREAST', 'BOTTLE', 'SOLIDS', 'WET', 'DIRTY', 'BOTH'
  entry_id UUID, -- Reference to original entry (sleep_entries or baby_care_entries)
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for fast queries by user and read status
CREATE INDEX IF NOT EXISTS idx_partner_notifications_user_unread
  ON partner_activity_notifications(user_id, is_read, created_at DESC);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_partner_notifications_created_at
  ON partner_activity_notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE partner_activity_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON partner_activity_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON partner_activity_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: System can insert notifications (via trigger with SECURITY DEFINER)
CREATE POLICY "System can insert partner notifications"
  ON partner_activity_notifications FOR INSERT
  WITH CHECK (true);

-- Function to create partner notification for sleep entries
CREATE OR REPLACE FUNCTION create_partner_sleep_notification()
RETURNS TRIGGER AS $$
DECLARE
  partner_user_id UUID;
BEGIN
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

  -- If no partner exists, exit early
  IF partner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create partner notification for care entries
CREATE OR REPLACE FUNCTION create_partner_care_notification()
RETURNS TRIGGER AS $$
DECLARE
  partner_user_id UUID;
  activity_subtype_value TEXT;
BEGIN
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

  -- If no partner exists, exit early
  IF partner_user_id IS NULL THEN
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for sleep_entries
-- Fires when a new sleep entry is created
DROP TRIGGER IF EXISTS notify_partner_sleep_entry ON sleep_entries;
CREATE TRIGGER notify_partner_sleep_entry
  AFTER INSERT ON sleep_entries
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_sleep_notification();

-- Trigger for baby_care_entries (feeding/diaper)
-- Fires when a new care entry is created
DROP TRIGGER IF EXISTS notify_partner_care_entry ON baby_care_entries;
CREATE TRIGGER notify_partner_care_entry
  AFTER INSERT ON baby_care_entries
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_care_notification();

-- Function to cleanup old read notifications (older than 30 days)
-- This can be called periodically to keep the table size manageable
CREATE OR REPLACE FUNCTION cleanup_old_partner_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM partner_activity_notifications
  WHERE is_read = true
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, UPDATE ON partner_activity_notifications TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comment to table
COMMENT ON TABLE partner_activity_notifications IS 'Stores notifications for partners when activities (sleep, feeding, diaper) are created';
COMMENT ON COLUMN partner_activity_notifications.user_id IS 'The user who should receive the notification (the partner)';
COMMENT ON COLUMN partner_activity_notifications.partner_id IS 'The user who created the entry';
COMMENT ON COLUMN partner_activity_notifications.activity_type IS 'Type of activity: sleep, feeding, or diaper';
COMMENT ON COLUMN partner_activity_notifications.activity_subtype IS 'Subtype: BREAST, BOTTLE, SOLIDS for feeding; WET, DIRTY, BOTH for diaper';
COMMENT ON COLUMN partner_activity_notifications.entry_id IS 'Reference to the original entry (sleep_entries.id or baby_care_entries.id)';
