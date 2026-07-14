-- Add avatar_url column to profiles for storing user profile pictures
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Recreate helper to expose avatar_url to the app
DROP FUNCTION IF EXISTS get_user_profile(UUID);

CREATE OR REPLACE FUNCTION get_user_profile(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  user_role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    p.avatar_url,
    p.created_at,
    p.updated_at
  FROM 
    profiles p
  WHERE 
    p.id = user_id_param;
END;
$$;
