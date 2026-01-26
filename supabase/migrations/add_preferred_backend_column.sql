-- Add preferred_backend column to user_settings table
-- This enables dual-backend architecture by storing user preference

ALTER TABLE user_settings
ADD COLUMN preferred_backend TEXT DEFAULT 'supabase'
CHECK (preferred_backend IN ('supabase', 'convex'));

-- Add comment for documentation
COMMENT ON COLUMN user_settings.preferred_backend IS 'User preference for backend selection in dual-backend architecture (supabase or convex)';
