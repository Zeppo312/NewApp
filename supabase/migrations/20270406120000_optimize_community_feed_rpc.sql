CREATE INDEX IF NOT EXISTS community_posts_created_at_id_idx
  ON public.community_posts (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS community_comments_post_id_created_at_idx
  ON public.community_comments (post_id, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS community_nested_comments_parent_created_at_idx
  ON public.community_nested_comments (parent_comment_id, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS user_settings_user_id_updated_at_idx
  ON public.user_settings (user_id, updated_at DESC);

DROP FUNCTION IF EXISTS public.get_community_feed(INTEGER, TIMESTAMPTZ, UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_community_feed(
  limit_param INTEGER DEFAULT 20,
  cursor_created_at_param TIMESTAMPTZ DEFAULT NULL,
  cursor_id_param UUID DEFAULT NULL,
  filter_user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_anonymous BOOLEAN,
  type TEXT,
  image_url TEXT,
  user_name TEXT,
  user_role TEXT,
  user_avatar_url TEXT,
  likes_count BIGINT,
  comments_count BIGINT,
  has_liked BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested_posts AS (
    SELECT post.id, post.user_id, post.content, post.created_at, post.updated_at, post.is_anonymous, post.type, post.image_url
    FROM public.community_posts post
    WHERE (filter_user_id_param IS NULL OR post.user_id = filter_user_id_param)
      AND (
        cursor_created_at_param IS NULL
        OR cursor_id_param IS NULL
        OR (post.created_at, post.id) < (cursor_created_at_param, cursor_id_param)
      )
    ORDER BY post.created_at DESC, post.id DESC
    LIMIT LEAST(GREATEST(COALESCE(limit_param, 20), 1), 50)
  ),
  latest_settings AS (
    SELECT DISTINCT ON (settings.user_id)
      settings.user_id,
      settings.community_use_avatar
    FROM public.user_settings settings
    JOIN requested_posts post ON post.user_id = settings.user_id
    ORDER BY settings.user_id, settings.updated_at DESC NULLS LAST, settings.created_at DESC NULLS LAST
  ),
  like_counts AS (
    SELECT post_like.post_id, COUNT(*)::BIGINT AS likes_count
    FROM public.community_post_likes post_like
    JOIN requested_posts post ON post.id = post_like.post_id
    GROUP BY post_like.post_id
  ),
  comment_counts AS (
    SELECT comment.post_id, COUNT(*)::BIGINT AS comments_count
    FROM public.community_comments comment
    JOIN requested_posts post ON post.id = comment.post_id
    GROUP BY comment.post_id
  ),
  viewer_likes AS (
    SELECT post_like.post_id
    FROM public.community_post_likes post_like
    JOIN requested_posts post ON post.id = post_like.post_id
    WHERE post_like.user_id = auth.uid()
  )
  SELECT
    post.id,
    post.user_id,
    post.content,
    post.created_at,
    post.updated_at,
    COALESCE(post.is_anonymous, false) AS is_anonymous,
    post.type,
    post.image_url,
    CASE
      WHEN COALESCE(post.is_anonymous, false) THEN
        CASE
          WHEN post.user_id = auth.uid() THEN 'Anonym (Du)'
          ELSE 'Anonym'
        END
      ELSE
        CASE
          WHEN post.user_id = auth.uid() THEN
            CONCAT(
              COALESCE(
                NULLIF(BTRIM(profile.username), ''),
                NULLIF(BTRIM(CONCAT_WS(' ', profile.first_name, profile.last_name)), ''),
                'Benutzer'
              ),
              ' (Du)'
            )
          ELSE
            COALESCE(
              NULLIF(BTRIM(profile.username), ''),
              NULLIF(BTRIM(CONCAT_WS(' ', profile.first_name, profile.last_name)), ''),
              'Benutzer'
            )
        END
    END AS user_name,
    CASE
      WHEN COALESCE(post.is_anonymous, false) THEN 'unknown'
      ELSE COALESCE(profile.user_role, 'unknown')
    END AS user_role,
    CASE
      WHEN COALESCE(post.is_anonymous, false) THEN NULL
      WHEN COALESCE(settings.community_use_avatar, true) THEN profile.avatar_url
      ELSE NULL
    END AS user_avatar_url,
    COALESCE(like_counts.likes_count, 0) AS likes_count,
    COALESCE(comment_counts.comments_count, 0) AS comments_count,
    EXISTS (
      SELECT 1
      FROM viewer_likes viewer_like
      WHERE viewer_like.post_id = post.id
    ) AS has_liked
  FROM requested_posts post
  LEFT JOIN public.profiles profile ON profile.id = post.user_id
  LEFT JOIN latest_settings settings ON settings.user_id = post.user_id
  LEFT JOIN like_counts ON like_counts.post_id = post.id
  LEFT JOIN comment_counts ON comment_counts.post_id = post.id
  ORDER BY post.created_at DESC, post.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_community_feed(INTEGER, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_feed(INTEGER, TIMESTAMPTZ, UUID, UUID) TO authenticated;
