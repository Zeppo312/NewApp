-- Add columns for synchronization
ALTER TABLE IF EXISTS baby_sleep_tracking
ADD COLUMN IF NOT EXISTS external_id UUID,
ADD COLUMN IF NOT EXISTS synced_from UUID,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_baby_sleep_tracking_external_id ON baby_sleep_tracking(external_id);
CREATE INDEX IF NOT EXISTS idx_baby_sleep_tracking_synced_from ON baby_sleep_tracking(synced_from);
CREATE INDEX IF NOT EXISTS idx_baby_sleep_tracking_user_id_external_id ON baby_sleep_tracking(user_id, external_id);

-- Use CREATE UNIQUE INDEX instead of ALTER TABLE ADD CONSTRAINT for partial unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_external_id_user_id 
ON baby_sleep_tracking(external_id, user_id) 
WHERE external_id IS NOT NULL; 