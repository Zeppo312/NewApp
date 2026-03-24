-- Add username column for community display names
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT;

COMMENT ON COLUMN public.profiles.username IS 'Öffentlicher Community-Benutzername';

-- Enforce uniqueness (case-insensitive) for usernames when provided
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- Extend helper function to expose username
DROP FUNCTION IF EXISTS get_user_profile(UUID);

CREATE OR REPLACE FUNCTION get_user_profile(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  user_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.username,
    p.user_role,
    p.created_at,
    p.updated_at
  FROM 
    profiles p
  WHERE 
    p.id = user_id_param;
END;
$$;
