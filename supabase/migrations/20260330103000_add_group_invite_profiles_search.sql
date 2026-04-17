DROP FUNCTION IF EXISTS public.search_group_invite_profiles(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.search_group_invite_profiles(
  target_group_id UUID,
  search_text TEXT
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_search TEXT := NULLIF(BTRIM(search_text), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF normalized_search IS NULL OR CHAR_LENGTH(normalized_search) < 2 THEN
    RETURN;
  END IF;

  IF NOT public.can_manage_group(target_group_id) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.username,
    profile.first_name,
    profile.last_name,
    profile.avatar_url
  FROM public.profiles profile
  JOIN LATERAL (
    SELECT
      settings.community_identity_mode,
      settings.community_use_avatar
    FROM public.user_settings settings
    WHERE settings.user_id = profile.id
    ORDER BY settings.updated_at DESC NULLS LAST
    LIMIT 1
  ) community_settings ON TRUE
  WHERE profile.id <> auth.uid()
    AND community_settings.community_identity_mode IS NOT NULL
    AND community_settings.community_use_avatar IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.community_group_members member
      WHERE member.group_id = target_group_id
        AND member.user_id = profile.id
        AND member.status = 'active'
    )
    AND (
      COALESCE(profile.username, '') ILIKE '%' || normalized_search || '%'
      OR COALESCE(profile.first_name, '') ILIKE '%' || normalized_search || '%'
      OR COALESCE(profile.last_name, '') ILIKE '%' || normalized_search || '%'
      OR BTRIM(CONCAT_WS(' ', COALESCE(profile.first_name, ''), COALESCE(profile.last_name, '')))
        ILIKE '%' || normalized_search || '%'
    )
  ORDER BY
    CASE
      WHEN COALESCE(profile.username, '') ILIKE normalized_search || '%' THEN 0
      WHEN COALESCE(profile.first_name, '') ILIKE normalized_search || '%' THEN 1
      WHEN COALESCE(profile.last_name, '') ILIKE normalized_search || '%' THEN 2
      ELSE 3
    END,
    COALESCE(profile.updated_at, profile.created_at) DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.search_group_invite_profiles(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_group_invite_profiles(UUID, TEXT) TO authenticated;
