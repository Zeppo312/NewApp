DROP FUNCTION IF EXISTS get_user_profile(UUID);

CREATE OR REPLACE FUNCTION get_user_profile(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  user_role TEXT,
  avatar_url TEXT,
  community_use_avatar BOOLEAN,
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
    settings.community_use_avatar,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT us.community_use_avatar
    FROM public.user_settings us
    WHERE us.user_id = p.id
    ORDER BY us.updated_at DESC NULLS LAST
    LIMIT 1
  ) settings ON TRUE
  WHERE p.id = user_id_param;
END;
$$;
