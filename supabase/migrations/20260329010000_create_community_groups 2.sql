CREATE TABLE IF NOT EXISTS public.community_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  avatar_url TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_group_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.community_group_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'poll')),
  image_url TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_group_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.community_group_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_group_post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.community_group_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_group_comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES public.community_group_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_group_nested_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_comment_id UUID NOT NULL REFERENCES public.community_group_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_group_nested_comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nested_comment_id UUID NOT NULL REFERENCES public.community_group_nested_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (nested_comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_groups_owner_id_idx
  ON public.community_groups(owner_id);

CREATE INDEX IF NOT EXISTS community_groups_visibility_idx
  ON public.community_groups(visibility);

CREATE INDEX IF NOT EXISTS community_group_members_group_id_idx
  ON public.community_group_members(group_id);

CREATE INDEX IF NOT EXISTS community_group_members_user_id_idx
  ON public.community_group_members(user_id);

CREATE INDEX IF NOT EXISTS community_group_invites_group_id_idx
  ON public.community_group_invites(group_id);

CREATE INDEX IF NOT EXISTS community_group_invites_invited_user_id_idx
  ON public.community_group_invites(invited_user_id);

CREATE INDEX IF NOT EXISTS community_group_posts_group_id_idx
  ON public.community_group_posts(group_id);

CREATE INDEX IF NOT EXISTS community_group_posts_user_id_idx
  ON public.community_group_posts(user_id);

CREATE INDEX IF NOT EXISTS community_group_comments_post_id_idx
  ON public.community_group_comments(post_id);

CREATE INDEX IF NOT EXISTS community_group_comments_user_id_idx
  ON public.community_group_comments(user_id);

CREATE INDEX IF NOT EXISTS community_group_post_likes_post_id_idx
  ON public.community_group_post_likes(post_id);

CREATE INDEX IF NOT EXISTS community_group_comment_likes_comment_id_idx
  ON public.community_group_comment_likes(comment_id);

CREATE INDEX IF NOT EXISTS community_group_nested_comments_parent_comment_id_idx
  ON public.community_group_nested_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS community_group_nested_comment_likes_nested_comment_id_idx
  ON public.community_group_nested_comment_likes(nested_comment_id);

CREATE UNIQUE INDEX IF NOT EXISTS community_group_invites_pending_unique_idx
  ON public.community_group_invites(group_id, invited_user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.is_active_group_member(
  target_group_id UUID,
  target_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_group_members member
    WHERE member.group_id = target_group_id
      AND member.user_id = COALESCE(target_user_id, auth.uid())
      AND member.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_group(
  target_group_id UUID,
  target_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_groups grp
    WHERE grp.id = target_group_id
      AND (
        grp.visibility = 'public'
        OR grp.owner_id = COALESCE(target_user_id, auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.community_group_members member
          WHERE member.group_id = grp.id
            AND member.user_id = COALESCE(target_user_id, auth.uid())
            AND member.status = 'active'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_group(
  target_group_id UUID,
  target_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_groups grp
    WHERE grp.id = target_group_id
      AND (
        grp.owner_id = COALESCE(target_user_id, auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.community_group_members member
          WHERE member.group_id = grp.id
            AND member.user_id = COALESCE(target_user_id, auth.uid())
            AND member.status = 'active'
            AND member.role IN ('owner', 'admin')
        )
      )
  );
$$;

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

REVOKE ALL ON FUNCTION public.is_active_group_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_group(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_group(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_group_invite_profiles(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_group_member_profiles(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_group_invite_profiles(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_member_profiles(UUID) TO authenticated;

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_nested_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_nested_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view groups they can access" ON public.community_groups;
CREATE POLICY "Users can view groups they can access"
  ON public.community_groups
  FOR SELECT
  USING (
    visibility = 'public'
    OR owner_id = auth.uid()
    OR public.can_access_group(id)
    OR EXISTS (
      SELECT 1
      FROM public.community_group_invites invite
      WHERE invite.group_id = id
        AND invite.invited_user_id = auth.uid()
        AND invite.status = 'pending'
    )
  );

DROP POLICY IF EXISTS "Users can create their own groups" ON public.community_groups;
CREATE POLICY "Users can create their own groups"
  ON public.community_groups
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners and admins can update groups" ON public.community_groups;
CREATE POLICY "Owners and admins can update groups"
  ON public.community_groups
  FOR UPDATE
  USING (public.can_manage_group(id))
  WITH CHECK (public.can_manage_group(id));

DROP POLICY IF EXISTS "Owners and admins can delete groups" ON public.community_groups;
CREATE POLICY "Owners and admins can delete groups"
  ON public.community_groups
  FOR DELETE
  USING (public.can_manage_group(id));

DROP POLICY IF EXISTS "Users can view memberships for accessible groups" ON public.community_group_members;
CREATE POLICY "Users can view memberships for accessible groups"
  ON public.community_group_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.can_access_group(group_id)
  );

DROP POLICY IF EXISTS "Users can create memberships they are allowed to own" ON public.community_group_members;
CREATE POLICY "Users can create memberships they are allowed to own"
  ON public.community_group_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.community_groups grp
        WHERE grp.id = group_id
          AND grp.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.community_groups grp
        WHERE grp.id = group_id
          AND grp.visibility = 'public'
      )
      OR EXISTS (
        SELECT 1
        FROM public.community_group_invites invite
        WHERE invite.group_id = group_id
          AND invite.invited_user_id = auth.uid()
          AND invite.status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS "Users and admins can update memberships" ON public.community_group_members;
CREATE POLICY "Users and admins can update memberships"
  ON public.community_group_members
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.can_manage_group(group_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.can_manage_group(group_id)
  );

DROP POLICY IF EXISTS "Users and admins can delete memberships" ON public.community_group_members;
CREATE POLICY "Users and admins can delete memberships"
  ON public.community_group_members
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.can_manage_group(group_id)
  );

DROP POLICY IF EXISTS "Invited users and managers can view invites" ON public.community_group_invites;
CREATE POLICY "Invited users and managers can view invites"
  ON public.community_group_invites
  FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR public.can_manage_group(group_id)
  );

DROP POLICY IF EXISTS "Managers can create invites" ON public.community_group_invites;
CREATE POLICY "Managers can create invites"
  ON public.community_group_invites
  FOR INSERT
  WITH CHECK (
    public.can_manage_group(group_id)
    AND invited_by_user_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Invited users and managers can update invites" ON public.community_group_invites;
CREATE POLICY "Invited users and managers can update invites"
  ON public.community_group_invites
  FOR UPDATE
  USING (
    invited_user_id = auth.uid()
    OR public.can_manage_group(group_id)
  )
  WITH CHECK (
    invited_user_id = auth.uid()
    OR public.can_manage_group(group_id)
  );

DROP POLICY IF EXISTS "Managers can delete invites" ON public.community_group_invites;
CREATE POLICY "Managers can delete invites"
  ON public.community_group_invites
  FOR DELETE
  USING (public.can_manage_group(group_id));

DROP POLICY IF EXISTS "Users can view accessible group posts" ON public.community_group_posts;
CREATE POLICY "Users can view accessible group posts"
  ON public.community_group_posts
  FOR SELECT
  USING (public.can_access_group(group_id));

DROP POLICY IF EXISTS "Users can insert group posts when active members" ON public.community_group_posts;
CREATE POLICY "Users can insert group posts when active members"
  ON public.community_group_posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  );

DROP POLICY IF EXISTS "Users can update their own group posts" ON public.community_group_posts;
CREATE POLICY "Users can update their own group posts"
  ON public.community_group_posts
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  );

DROP POLICY IF EXISTS "Users can delete their own group posts" ON public.community_group_posts;
CREATE POLICY "Users can delete their own group posts"
  ON public.community_group_posts
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  );

DROP POLICY IF EXISTS "Users can view accessible group comments" ON public.community_group_comments;
CREATE POLICY "Users can view accessible group comments"
  ON public.community_group_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_group_posts post
      WHERE post.id = post_id
        AND public.can_access_group(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can insert group comments when active members" ON public.community_group_comments;
CREATE POLICY "Users can insert group comments when active members"
  ON public.community_group_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_posts post
      WHERE post.id = post_id
        AND public.is_active_group_member(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can update their own group comments" ON public.community_group_comments;
CREATE POLICY "Users can update their own group comments"
  ON public.community_group_comments
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_posts post
      WHERE post.id = post_id
        AND public.is_active_group_member(post.group_id)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_posts post
      WHERE post.id = post_id
        AND public.is_active_group_member(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own group comments" ON public.community_group_comments;
CREATE POLICY "Users can delete their own group comments"
  ON public.community_group_comments
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_posts post
      WHERE post.id = post_id
        AND public.is_active_group_member(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can view accessible group post likes" ON public.community_group_post_likes;
CREATE POLICY "Users can view accessible group post likes"
  ON public.community_group_post_likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_group_posts post
      WHERE post.id = post_id
        AND public.can_access_group(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can like group posts when active members" ON public.community_group_post_likes;
CREATE POLICY "Users can like group posts when active members"
  ON public.community_group_post_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_posts post
      WHERE post.id = post_id
        AND public.is_active_group_member(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can unlike their own group post likes" ON public.community_group_post_likes;
CREATE POLICY "Users can unlike their own group post likes"
  ON public.community_group_post_likes
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view accessible group comment likes" ON public.community_group_comment_likes;
CREATE POLICY "Users can view accessible group comment likes"
  ON public.community_group_comment_likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_group_comments comment
      JOIN public.community_group_posts post ON post.id = comment.post_id
      WHERE comment.id = comment_id
        AND public.can_access_group(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can like group comments when active members" ON public.community_group_comment_likes;
CREATE POLICY "Users can like group comments when active members"
  ON public.community_group_comment_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_comments comment
      JOIN public.community_group_posts post ON post.id = comment.post_id
      WHERE comment.id = comment_id
        AND public.is_active_group_member(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can unlike their own group comment likes" ON public.community_group_comment_likes;
CREATE POLICY "Users can unlike their own group comment likes"
  ON public.community_group_comment_likes
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view accessible group nested comments" ON public.community_group_nested_comments;
CREATE POLICY "Users can view accessible group nested comments"
  ON public.community_group_nested_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_group_comments comment
      JOIN public.community_group_posts post ON post.id = comment.post_id
      WHERE comment.id = parent_comment_id
        AND public.can_access_group(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can create group nested comments when active members" ON public.community_group_nested_comments;
CREATE POLICY "Users can create group nested comments when active members"
  ON public.community_group_nested_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_comments comment
      JOIN public.community_group_posts post ON post.id = comment.post_id
      WHERE comment.id = parent_comment_id
        AND public.is_active_group_member(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own group nested comments" ON public.community_group_nested_comments;
CREATE POLICY "Users can delete their own group nested comments"
  ON public.community_group_nested_comments
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view accessible group nested comment likes" ON public.community_group_nested_comment_likes;
CREATE POLICY "Users can view accessible group nested comment likes"
  ON public.community_group_nested_comment_likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_group_nested_comments nested_comment
      JOIN public.community_group_comments comment ON comment.id = nested_comment.parent_comment_id
      JOIN public.community_group_posts post ON post.id = comment.post_id
      WHERE nested_comment.id = nested_comment_id
        AND public.can_access_group(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can like group nested comments when active members" ON public.community_group_nested_comment_likes;
CREATE POLICY "Users can like group nested comments when active members"
  ON public.community_group_nested_comment_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.community_group_nested_comments nested_comment
      JOIN public.community_group_comments comment ON comment.id = nested_comment.parent_comment_id
      JOIN public.community_group_posts post ON post.id = comment.post_id
      WHERE nested_comment.id = nested_comment_id
        AND public.is_active_group_member(post.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can unlike their own group nested comment likes" ON public.community_group_nested_comment_likes;
CREATE POLICY "Users can unlike their own group nested comment likes"
  ON public.community_group_nested_comment_likes
  FOR DELETE
  USING (auth.uid() = user_id);
