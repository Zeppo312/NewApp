CREATE OR REPLACE FUNCTION public.get_group_member_profiles(
  target_group_id UUID
)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  community_use_avatar BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_access_group(target_group_id) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    member.user_id,
    member.role,
    member.status,
    member.joined_at,
    profile.username,
    profile.first_name,
    profile.last_name,
    profile.avatar_url,
    settings.community_use_avatar
  FROM public.community_group_members member
  LEFT JOIN public.profiles profile
    ON profile.id = member.user_id
  LEFT JOIN LATERAL (
    SELECT user_settings.community_use_avatar
    FROM public.user_settings user_settings
    WHERE user_settings.user_id = member.user_id
    ORDER BY user_settings.updated_at DESC NULLS LAST
    LIMIT 1
  ) settings ON TRUE
  WHERE member.group_id = target_group_id
    AND member.status = 'active'
  ORDER BY member.joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_member_profiles(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_member_profiles(UUID) TO authenticated;
