-- ============================================================================
-- UGC-Moderation (App Store Review Guideline 1.2)
--
-- 1. content_reports  : Meldungen von Nutzern + automatische Filtertreffer
-- 2. user_blocks      : Nutzer blockieren (beidseitige Unsichtbarkeit)
-- 3. Sichtbarkeit     : RESTRICTIVE Policies filtern geblockte Inhalte überall
-- 4. Sperren          : profiles.suspended_at verhindert neue Inhalte
-- 5. Wortfilter       : moderation_banned_terms + Trigger auf allen UGC-Tabellen
-- 6. Admin-RPCs       : Inhalt löschen, Nutzer sperren, Meldung abschließen
-- 7. Consent          : profiles.terms_accepted_at / terms_version
-- 8. Webhook          : benachrichtigt den Entwickler bei jeder neuen Meldung
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- --------------------------------------------------------------------------
-- 0. Profil-Spalten (Sperre + AGB-Zustimmung)
-- --------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

COMMENT ON COLUMN public.profiles.suspended_at IS
  'Gesetzt durch moderation_suspend_user(); gesperrte Nutzer können keine Inhalte mehr erstellen.';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Zeitpunkt der Zustimmung zu den Nutzungsbedingungen (EULA-Gate vor Login).';

-- Sperrfelder sind server-verwaltet: bestehenden Schutz-Trigger erweitern.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.is_admin, FALSE)
         OR NEW.paywall_access_role IS NOT NULL
         OR NEW.suspended_at IS NOT NULL
         OR NEW.suspension_reason IS NOT NULL THEN
        RAISE EXCEPTION 'profile privilege fields are server-managed'
          USING ERRCODE = '42501';
      END IF;
    ELSIF OLD.is_admin IS DISTINCT FROM NEW.is_admin
       OR OLD.paywall_access_role IS DISTINCT FROM NEW.paywall_access_role
       OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
       OR OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason THEN
      RAISE EXCEPTION 'profile privilege fields are server-managed'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privilege_fields ON public.profiles;

CREATE TRIGGER protect_profile_privilege_fields
BEFORE INSERT OR UPDATE OF is_admin, paywall_access_role, suspended_at, suspension_reason
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- --------------------------------------------------------------------------
-- 1. Blockierte Nutzer
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx
  ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Beide Seiten dürfen die Beziehung sehen: der Blockierende zur Verwaltung,
-- der Blockierte, damit clientseitige Filter greifen können.
DROP POLICY IF EXISTS "user_blocks_select" ON public.user_blocks;
CREATE POLICY "user_blocks_select"
  ON public.user_blocks
  FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own"
  ON public.user_blocks
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own"
  ON public.user_blocks
  FOR DELETE
  USING (auth.uid() = blocker_id);

-- --------------------------------------------------------------------------
-- 2. Meldungen
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'post',
    'comment',
    'nested_comment',
    'group_post',
    'group_comment',
    'group_nested_comment',
    'group_message',
    'direct_message',
    'profile'
  )),
  target_id UUID NOT NULL,
  target_snapshot TEXT,
  reason TEXT NOT NULL CHECK (reason IN (
    'spam',
    'harassment',
    'hate',
    'sexual',
    'violence',
    'self_harm',
    'misinformation',
    'other',
    'auto_filter'
  )),
  details TEXT,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'auto_filter', 'block')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_at_idx
  ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports (target_type, target_id);

CREATE INDEX IF NOT EXISTS content_reports_reported_user_idx
  ON public.content_reports (reported_user_id);

-- Eine Meldung pro Nutzer und Inhalt.
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_unique_per_reporter_idx
  ON public.content_reports (reporter_id, target_type, target_id)
  WHERE reporter_id IS NOT NULL;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_moderator(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT profile.is_admin
    FROM public.profiles profile
    WHERE profile.id = check_user_id
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.is_moderator(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator(UUID) TO authenticated;

-- Melden darf jeder für sich selbst; lesen und bearbeiten nur Moderatoren.
DROP POLICY IF EXISTS "content_reports_insert_own" ON public.content_reports;
CREATE POLICY "content_reports_insert_own"
  ON public.content_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() = reporter_id
    AND source IN ('user', 'block')
    AND status = 'open'
  );

DROP POLICY IF EXISTS "content_reports_select_own" ON public.content_reports;
CREATE POLICY "content_reports_select_own"
  ON public.content_reports
  FOR SELECT
  USING (auth.uid() = reporter_id OR public.is_moderator());

DROP POLICY IF EXISTS "content_reports_update_moderator" ON public.content_reports;
CREATE POLICY "content_reports_update_moderator"
  ON public.content_reports
  FOR UPDATE
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- --------------------------------------------------------------------------
-- 3. Helfer für Sichtbarkeit und Sperre
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_blocked_pair(first_user UUID, second_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN first_user IS NULL OR second_user IS NULL OR first_user = second_user THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.user_blocks block
      WHERE (block.blocker_id = first_user AND block.blocked_id = second_user)
         OR (block.blocker_id = second_user AND block.blocked_id = first_user)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_blocked_pair(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(UUID, UUID) TO authenticated;

-- Kurzform für RLS-Policies: "ist der Betrachter mit diesem Autor verblockt?"
CREATE OR REPLACE FUNCTION public.viewer_blocked(other_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_blocked_pair(auth.uid(), other_user);
$$;

REVOKE ALL ON FUNCTION public.viewer_blocked(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viewer_blocked(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_suspended(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = check_user_id
      AND profile.suspended_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_suspended(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_suspended(UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- 4. Sichtbarkeit: RESTRICTIVE Policies (werden mit bestehenden UND-verknüpft)
-- --------------------------------------------------------------------------

-- Community-Feed
DROP POLICY IF EXISTS "posts_hide_blocked" ON public.community_posts;
CREATE POLICY "posts_hide_blocked"
  ON public.community_posts
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(user_id));

DROP POLICY IF EXISTS "comments_hide_blocked" ON public.community_comments;
CREATE POLICY "comments_hide_blocked"
  ON public.community_comments
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(user_id));

DROP POLICY IF EXISTS "nested_comments_hide_blocked" ON public.community_nested_comments;
CREATE POLICY "nested_comments_hide_blocked"
  ON public.community_nested_comments
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(user_id));

-- Gruppen-Posts
DROP POLICY IF EXISTS "group_posts_hide_blocked" ON public.community_group_posts;
CREATE POLICY "group_posts_hide_blocked"
  ON public.community_group_posts
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(user_id));

DROP POLICY IF EXISTS "group_comments_hide_blocked" ON public.community_group_comments;
CREATE POLICY "group_comments_hide_blocked"
  ON public.community_group_comments
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(user_id));

DROP POLICY IF EXISTS "group_nested_comments_hide_blocked" ON public.community_group_nested_comments;
CREATE POLICY "group_nested_comments_hide_blocked"
  ON public.community_group_nested_comments
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(user_id));

-- Gruppen-Chat
DROP POLICY IF EXISTS "group_messages_hide_blocked" ON public.community_group_messages;
CREATE POLICY "group_messages_hide_blocked"
  ON public.community_group_messages
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(sender_id));

-- 1:1-Chat: geblockte Paare sehen sich nicht und können nicht mehr schreiben.
DROP POLICY IF EXISTS "direct_messages_hide_blocked" ON public.direct_messages;
CREATE POLICY "direct_messages_hide_blocked"
  ON public.direct_messages
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.is_blocked_pair(sender_id, receiver_id));

DROP POLICY IF EXISTS "direct_messages_block_blocked_senders" ON public.direct_messages;
CREATE POLICY "direct_messages_block_blocked_senders"
  ON public.direct_messages
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_blocked_pair(sender_id, receiver_id));

-- Benachrichtigungen: Likes, Kommentare und Follows blockierter Personen
-- verschwinden ebenfalls aus der Liste.
DROP POLICY IF EXISTS "community_notifications_hide_blocked" ON public.community_notifications;
CREATE POLICY "community_notifications_hide_blocked"
  ON public.community_notifications
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT public.viewer_blocked(sender_id));

-- Follows
DROP POLICY IF EXISTS "user_follows_hide_blocked" ON public.user_follows;
CREATE POLICY "user_follows_hide_blocked"
  ON public.user_follows
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    NOT public.viewer_blocked(follower_id)
    AND NOT public.viewer_blocked(following_id)
  );

DROP POLICY IF EXISTS "user_follows_block_blocked" ON public.user_follows;
CREATE POLICY "user_follows_block_blocked"
  ON public.user_follows
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_blocked_pair(follower_id, following_id));

-- --------------------------------------------------------------------------
-- 5. Gesperrte Nutzer können keine Inhalte mehr erstellen
-- --------------------------------------------------------------------------

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'community_posts',
    'community_comments',
    'community_nested_comments',
    'community_group_posts',
    'community_group_comments',
    'community_group_nested_comments',
    'community_group_messages',
    'direct_messages'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      target_table || '_deny_suspended',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      'WITH CHECK (NOT public.is_suspended())',
      target_table || '_deny_suspended',
      target_table
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 6. Wortfilter
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.moderation_banned_terms (
  term TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'all',
  action TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block', 'flag')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_banned_terms ENABLE ROW LEVEL SECURITY;

-- Die Liste selbst ist nicht öffentlich; der Filter läuft SECURITY DEFINER.
DROP POLICY IF EXISTS "banned_terms_moderator_only" ON public.moderation_banned_terms;
CREATE POLICY "banned_terms_moderator_only"
  ON public.moderation_banned_terms
  FOR ALL
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- Normalisierung gegen Leetspeak und Zeichenkosmetik.
CREATE OR REPLACE FUNCTION public.moderation_normalize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    lower(COALESCE(input_text, '')),
    '0134567$@!',
    'oieasgtsai'
  );
$$;

-- Liefert den ersten Treffer der angegebenen Schärfe oder NULL.
CREATE OR REPLACE FUNCTION public.moderation_match_term(
  input_text TEXT,
  match_action TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
  banned RECORD;
  spaced_pattern TEXT;
BEGIN
  IF input_text IS NULL OR btrim(input_text) = '' THEN
    RETURN NULL;
  END IF;

  normalized := public.moderation_normalize_text(input_text);

  FOR banned IN
    SELECT term
    FROM public.moderation_banned_terms
    WHERE action = match_action
  LOOP
    -- Direkter Treffer an Wortgrenzen.
    IF normalized ~ ('\m' || banned.term || '\M') THEN
      RETURN banned.term;
    END IF;

    -- Auseinandergezogene Schreibweise ("h u r e n s o h n", "f-u-c-k").
    IF length(banned.term) >= 5 THEN
      SELECT string_agg(letters.letter, '[^a-z]{0,2}' ORDER BY letters.position)
      INTO spaced_pattern
      FROM regexp_split_to_table(banned.term, '')
        WITH ORDINALITY AS letters(letter, position);

      IF spaced_pattern IS NOT NULL AND normalized ~ spaced_pattern THEN
        RETURN banned.term;
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_match_term(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderation_match_term(TEXT, TEXT) TO authenticated;

-- BEFORE INSERT: harte Treffer werden abgewiesen.
CREATE OR REPLACE FUNCTION public.moderation_reject_banned_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.moderation_match_term(NEW.content, 'block') IS NOT NULL THEN
    RAISE EXCEPTION 'content rejected by moderation filter'
      USING ERRCODE = 'check_violation',
            HINT = 'moderation_filter';
  END IF;

  RETURN NEW;
END;
$$;

-- AFTER INSERT: weichere Treffer landen automatisch in der Moderations-Queue.
CREATE OR REPLACE FUNCTION public.moderation_flag_suspicious_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_term TEXT;
  author_id UUID;
  target_label TEXT := TG_ARGV[0];
BEGIN
  matched_term := public.moderation_match_term(NEW.content, 'flag');

  IF matched_term IS NULL THEN
    RETURN NEW;
  END IF;

  IF target_label = 'direct_message' OR target_label = 'group_message' THEN
    author_id := NEW.sender_id;
  ELSE
    author_id := NEW.user_id;
  END IF;

  INSERT INTO public.content_reports (
    reporter_id,
    reported_user_id,
    target_type,
    target_id,
    target_snapshot,
    reason,
    details,
    source
  ) VALUES (
    NULL,
    author_id,
    target_label,
    NEW.id,
    left(COALESCE(NEW.content, ''), 2000),
    'auto_filter',
    'Automatischer Filtertreffer: ' || matched_term,
    'auto_filter'
  );

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  mapping RECORD;
BEGIN
  FOR mapping IN
    SELECT *
    FROM (VALUES
      ('community_posts', 'post'),
      ('community_comments', 'comment'),
      ('community_nested_comments', 'nested_comment'),
      ('community_group_posts', 'group_post'),
      ('community_group_comments', 'group_comment'),
      ('community_group_nested_comments', 'group_nested_comment'),
      ('community_group_messages', 'group_message'),
      ('direct_messages', 'direct_message')
    ) AS t(table_name, target_label)
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS moderation_reject_banned_content_trigger ON public.%I',
      mapping.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER moderation_reject_banned_content_trigger '
      'BEFORE INSERT ON public.%I FOR EACH ROW '
      'EXECUTE FUNCTION public.moderation_reject_banned_content()',
      mapping.table_name
    );

    EXECUTE format(
      'DROP TRIGGER IF EXISTS moderation_flag_suspicious_content_trigger ON public.%I',
      mapping.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER moderation_flag_suspicious_content_trigger '
      'AFTER INSERT ON public.%I FOR EACH ROW '
      'EXECUTE FUNCTION public.moderation_flag_suspicious_content(%L)',
      mapping.table_name,
      mapping.target_label
    );
  END LOOP;
END $$;

-- Startliste. Bewusst auf eindeutige Beschimpfungen und Slurs begrenzt,
-- damit normale Elterngespräche nicht fälschlich blockiert werden.
INSERT INTO public.moderation_banned_terms (term, language, action) VALUES
  ('hurensohn', 'de', 'block'),
  ('fotze', 'de', 'block'),
  ('missgeburt', 'de', 'block'),
  ('untermensch', 'de', 'block'),
  ('judensau', 'de', 'block'),
  ('kanake', 'de', 'block'),
  ('neger', 'de', 'block'),
  ('schwuchtel', 'de', 'block'),
  ('vergewaltigen', 'de', 'flag'),
  ('bring dich um', 'de', 'flag'),
  ('halt die fresse', 'de', 'flag'),
  ('wichser', 'de', 'flag'),
  ('arschloch', 'de', 'flag'),
  ('hure', 'de', 'flag'),
  ('nigger', 'en', 'block'),
  ('faggot', 'en', 'block'),
  ('retard', 'en', 'block'),
  ('cunt', 'en', 'block'),
  ('kill yourself', 'en', 'block'),
  ('rape', 'en', 'flag'),
  ('whore', 'en', 'flag'),
  ('bitch', 'en', 'flag'),
  ('motherfucker', 'en', 'flag'),
  ('puta madre', 'es', 'block'),
  ('maricon', 'es', 'block'),
  ('hijo de puta', 'es', 'block'),
  ('violar', 'es', 'flag'),
  ('puta', 'es', 'flag')
ON CONFLICT (term) DO NOTHING;

-- --------------------------------------------------------------------------
-- 7. Community-Feed: geblockte Autoren ausschließen
--    (SECURITY DEFINER umgeht RLS, daher explizit im Query)
-- --------------------------------------------------------------------------

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
      AND NOT public.is_blocked_pair(auth.uid(), post.user_id)
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
    WHERE NOT public.is_blocked_pair(auth.uid(), comment.user_id)
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

-- --------------------------------------------------------------------------
-- 8. Moderations-RPCs
-- --------------------------------------------------------------------------

-- Meldung absetzen. Läuft SECURITY DEFINER, damit der Inhalts-Snapshot auch
-- dann gespeichert wird, wenn der Melder den Inhalt danach nicht mehr sieht.
CREATE OR REPLACE FUNCTION public.report_content(
  target_type_param TEXT,
  target_id_param UUID,
  reason_param TEXT,
  details_param TEXT DEFAULT NULL,
  source_param TEXT DEFAULT 'user'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot TEXT;
  author_id UUID;
  report_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF source_param NOT IN ('user', 'block') THEN
    RAISE EXCEPTION 'invalid report source' USING ERRCODE = '22023';
  END IF;

  CASE target_type_param
    WHEN 'post' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_posts src WHERE src.id = target_id_param;
    WHEN 'comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_comments src WHERE src.id = target_id_param;
    WHEN 'nested_comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_nested_comments src WHERE src.id = target_id_param;
    WHEN 'group_post' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_group_posts src WHERE src.id = target_id_param;
    WHEN 'group_comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_group_comments src WHERE src.id = target_id_param;
    WHEN 'group_nested_comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_group_nested_comments src WHERE src.id = target_id_param;
    WHEN 'group_message' THEN
      SELECT src.sender_id, src.content INTO author_id, snapshot
      FROM public.community_group_messages src WHERE src.id = target_id_param;
    WHEN 'direct_message' THEN
      SELECT src.sender_id, src.content INTO author_id, snapshot
      FROM public.direct_messages src WHERE src.id = target_id_param;
    WHEN 'profile' THEN
      SELECT src.id,
             CONCAT_WS(' | ',
               NULLIF(BTRIM(src.username), ''),
               NULLIF(BTRIM(CONCAT_WS(' ', src.first_name, src.last_name)), ''),
               src.avatar_url
             )
        INTO author_id, snapshot
      FROM public.profiles src WHERE src.id = target_id_param;
    ELSE
      RAISE EXCEPTION 'invalid target type: %', target_type_param USING ERRCODE = '22023';
  END CASE;

  IF author_id IS NULL THEN
    RAISE EXCEPTION 'reported content not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF author_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot report own content' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.content_reports (
    reporter_id,
    reported_user_id,
    target_type,
    target_id,
    target_snapshot,
    reason,
    details,
    source
  ) VALUES (
    auth.uid(),
    author_id,
    target_type_param,
    target_id_param,
    left(COALESCE(snapshot, ''), 2000),
    reason_param,
    details_param,
    source_param
  )
  ON CONFLICT (reporter_id, target_type, target_id) WHERE reporter_id IS NOT NULL DO UPDATE
    SET reason = EXCLUDED.reason,
        details = EXCLUDED.details,
        status = 'open',
        created_at = now()
  RETURNING id INTO report_id;

  RETURN report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_content(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_content(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Blockieren inkl. Aufräumen der Follow-Beziehungen.
CREATE OR REPLACE FUNCTION public.block_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot block yourself' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), target_user_id)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.user_follows
  WHERE (follower_id = auth.uid() AND following_id = target_user_id)
     OR (follower_id = target_user_id AND following_id = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;

-- Offene Meldungen für das Backoffice.
CREATE OR REPLACE FUNCTION public.get_moderation_reports(
  status_param TEXT DEFAULT 'open',
  limit_param INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  target_type TEXT,
  target_id UUID,
  target_snapshot TEXT,
  reason TEXT,
  details TEXT,
  source TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  reporter_id UUID,
  reporter_name TEXT,
  reported_user_id UUID,
  reported_user_name TEXT,
  reported_user_suspended BOOLEAN,
  reported_user_open_reports BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    report.id,
    report.target_type,
    report.target_id,
    report.target_snapshot,
    report.reason,
    report.details,
    report.source,
    report.status,
    report.created_at,
    report.reporter_id,
    COALESCE(
      NULLIF(BTRIM(reporter.username), ''),
      NULLIF(BTRIM(CONCAT_WS(' ', reporter.first_name, reporter.last_name)), ''),
      'System'
    ) AS reporter_name,
    report.reported_user_id,
    COALESCE(
      NULLIF(BTRIM(reported.username), ''),
      NULLIF(BTRIM(CONCAT_WS(' ', reported.first_name, reported.last_name)), ''),
      'Unbekannt'
    ) AS reported_user_name,
    reported.suspended_at IS NOT NULL AS reported_user_suspended,
    (
      SELECT COUNT(*)
      FROM public.content_reports other
      WHERE other.reported_user_id = report.reported_user_id
        AND other.status = 'open'
    ) AS reported_user_open_reports
  FROM public.content_reports report
  LEFT JOIN public.profiles reporter ON reporter.id = report.reporter_id
  LEFT JOIN public.profiles reported ON reported.id = report.reported_user_id
  WHERE public.is_moderator()
    AND (status_param IS NULL OR report.status = status_param)
  ORDER BY report.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_param, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.get_moderation_reports(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_moderation_reports(TEXT, INTEGER) TO authenticated;

-- Inhalt löschen (Moderator).
CREATE OR REPLACE FUNCTION public.moderation_delete_content(
  target_type_param TEXT,
  target_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  CASE target_type_param
    WHEN 'post' THEN
      DELETE FROM public.community_posts WHERE id = target_id_param;
    WHEN 'comment' THEN
      DELETE FROM public.community_comments WHERE id = target_id_param;
    WHEN 'nested_comment' THEN
      DELETE FROM public.community_nested_comments WHERE id = target_id_param;
    WHEN 'group_post' THEN
      DELETE FROM public.community_group_posts WHERE id = target_id_param;
    WHEN 'group_comment' THEN
      DELETE FROM public.community_group_comments WHERE id = target_id_param;
    WHEN 'group_nested_comment' THEN
      DELETE FROM public.community_group_nested_comments WHERE id = target_id_param;
    WHEN 'group_message' THEN
      DELETE FROM public.community_group_messages WHERE id = target_id_param;
    WHEN 'direct_message' THEN
      DELETE FROM public.direct_messages WHERE id = target_id_param;
    WHEN 'profile' THEN
      RAISE EXCEPTION 'profiles cannot be deleted, suspend the user instead'
        USING ERRCODE = '22023';
    ELSE
      RAISE EXCEPTION 'invalid target type: %', target_type_param USING ERRCODE = '22023';
  END CASE;

  UPDATE public.content_reports
  SET status = 'resolved',
      resolution = 'content_deleted',
      resolved_by = auth.uid(),
      resolved_at = now()
  WHERE target_type = target_type_param
    AND target_id = target_id_param
    AND status = 'open';
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_delete_content(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderation_delete_content(TEXT, UUID) TO authenticated;

-- Nutzer sperren / entsperren (Moderator).
CREATE OR REPLACE FUNCTION public.moderation_suspend_user(
  target_user_id UUID,
  reason_param TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  IF public.is_moderator(target_user_id) THEN
    RAISE EXCEPTION 'cannot suspend a moderator' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET suspended_at = now(),
      suspension_reason = reason_param
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_suspend_user(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderation_suspend_user(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderation_unsuspend_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET suspended_at = NULL,
      suspension_reason = NULL
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_unsuspend_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderation_unsuspend_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderation_resolve_report(
  report_id_param UUID,
  resolution_param TEXT DEFAULT 'dismissed'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.content_reports
  SET status = CASE WHEN resolution_param = 'dismissed' THEN 'dismissed' ELSE 'resolved' END,
      resolution = resolution_param,
      resolved_by = auth.uid(),
      resolved_at = now()
  WHERE id = report_id_param;
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_resolve_report(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderation_resolve_report(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- 9. Entwickler-Benachrichtigung bei neuen Meldungen (24-Stunden-Zusage)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_moderation_report_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id BIGINT;
  webhook_secret TEXT;
  request_headers JSONB;
BEGIN
  -- Verpflichtendes Shared Secret. Setzen mit:
  --   ALTER DATABASE postgres SET "app.settings.moderation_webhook_secret" = '...';
  -- und denselben Wert als MODERATION_WEBHOOK_SECRET in der Edge Function.
  webhook_secret := NULLIF(
    current_setting('app.settings.moderation_webhook_secret', true),
    ''
  );

  IF webhook_secret IS NULL THEN
    RAISE WARNING 'Moderation webhook secret missing; notification was not sent';
    RETURN NEW;
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || webhook_secret
  );

  SELECT net.http_post(
    url := 'https://kwniiyayhzgjfqjsjcfu.supabase.co/functions/v1/moderation-report-notify',
    headers := request_headers,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'content_reports',
      'record', jsonb_build_object(
        'id', NEW.id,
        'reporter_id', NEW.reporter_id,
        'reported_user_id', NEW.reported_user_id,
        'target_type', NEW.target_type,
        'target_id', NEW.target_id,
        'target_snapshot', NEW.target_snapshot,
        'reason', NEW.reason,
        'details', NEW.details,
        'source', NEW.source,
        'created_at', NEW.created_at
      )
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send moderation webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_moderation_report_webhook ON public.content_reports;
CREATE TRIGGER trigger_send_moderation_report_webhook
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.send_moderation_report_webhook();

COMMENT ON TABLE public.content_reports IS
  'Meldungen zu nutzergenerierten Inhalten. Wird innerhalb von 24 Stunden bearbeitet (App Store Guideline 1.2).';
COMMENT ON TABLE public.user_blocks IS
  'Von Nutzern blockierte Nutzer. Filtert Inhalte beidseitig über RESTRICTIVE RLS-Policies.';
