-- Add new columns to the sleep_entries table for synchronization
ALTER TABLE sleep_entries 
ADD COLUMN IF NOT EXISTS shared_with_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS external_id UUID,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- Add index to improve query performance for shared entries
CREATE INDEX IF NOT EXISTS idx_sleep_entries_shared_with_user_id ON sleep_entries(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_entries_external_id ON sleep_entries(external_id);

-- Create comment to explain the purpose of these columns
COMMENT ON COLUMN sleep_entries.shared_with_user_id IS 'ID of the user this entry is shared with';
COMMENT ON COLUMN sleep_entries.external_id IS 'ID of the original entry when this is a mirrored copy';
COMMENT ON COLUMN sleep_entries.synced_at IS 'Timestamp of the last synchronization'; 