-- ============================================================================
-- Admin-Dashboard
--
-- Liefert Nutzungs- und Betriebskennzahlen für Moderatoren: wie viel, wo und
-- wann etwas passiert ist, plus Fehlerquoten für Ask Lotti und die
-- RevenueCat-Webhooks.
--
-- Die Zähler laufen über dynamisches SQL und prüfen vorher, ob Tabelle und
-- created_at-Spalte existieren. Damit bricht das Dashboard nicht, wenn die
-- Live-Datenbank vom Repo-Schema abweicht – fehlende Tabellen erscheinen
-- schlicht ohne Werte.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Bausteine
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_table_has_created_at(table_name_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = table_name_param
      AND column_name = 'created_at'
  );
$$;

REVOKE ALL ON FUNCTION public.admin_table_has_created_at(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_table_activity(
  table_name_param TEXT,
  since_param TIMESTAMPTZ
)
RETURNS TABLE (total BIGINT, period BIGINT, last_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.admin_table_has_created_at(table_name_param) THEN
    RETURN QUERY SELECT NULL::BIGINT, NULL::BIGINT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT COUNT(*)::BIGINT,
            COUNT(*) FILTER (WHERE src.created_at >= $1)::BIGINT,
            MAX(src.created_at)::TIMESTAMPTZ
       FROM public.%I src',
    table_name_param
  ) USING since_param;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_table_activity(TEXT, TIMESTAMPTZ) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_table_daily_counts(
  table_name_param TEXT,
  since_param TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.admin_table_has_created_at(table_name_param) THEN
    RETURN '{}'::JSONB;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_object_agg(grouped.day::TEXT, grouped.entries), $2)
       FROM (
         SELECT src.created_at::DATE AS day, COUNT(*)::INT AS entries
           FROM public.%I src
          WHERE src.created_at >= $1
          GROUP BY 1
       ) grouped',
    table_name_param
  )
  INTO result
  USING since_param, '{}'::JSONB;

  RETURN COALESCE(result, '{}'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_table_daily_counts(TEXT, TIMESTAMPTZ) FROM PUBLIC;

-- --------------------------------------------------------------------------
-- 2. Dashboard
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_dashboard(days_param INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  window_days INTEGER;
  since TIMESTAMPTZ;
  previous_since TIMESTAMPTZ;
  feature RECORD;
  activity JSONB := '[]'::JSONB;
  stats RECORD;
  users JSONB;
  moderation JSONB;
  ai JSONB;
  webhooks JSONB;
  subscriptions JSONB;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  window_days := LEAST(GREATEST(COALESCE(days_param, 7), 1), 90);
  since := now() - make_interval(days => window_days);
  previous_since := since - make_interval(days => window_days);

  -- Aktivität pro Feature -------------------------------------------------
  FOR feature IN
    SELECT *
    FROM (VALUES
      ('community_posts',                 'community', 'community_posts'),
      ('community_comments',              'community', 'community_comments'),
      ('community_nested_comments',       'community', 'community_nested_comments'),
      ('community_groups',                'community', 'community_groups'),
      ('community_group_posts',           'community', 'community_group_posts'),
      ('community_group_messages',        'community', 'community_group_messages'),
      ('direct_messages',                 'community', 'direct_messages'),
      ('user_follows',                    'community', 'user_follows'),
      ('sleep_entries_new',               'tracking',  'sleep_entries_new'),
      ('baby_care_entries',               'tracking',  'baby_care_entries'),
      ('baby_diary',                      'tracking',  'baby_diary'),
      ('weight_entries',                  'tracking',  'weight_entries'),
      ('size_entries',                    'tracking',  'size_entries'),
      ('tooth_entries',                   'tracking',  'tooth_entries'),
      ('selfcare_entries',                'tracking',  'selfcare_entries'),
      ('baby_milestone_entries',          'tracking',  'baby_milestone_entries'),
      ('doctor_questions',                'tracking',  'doctor_questions'),
      ('geburtsplan',                     'tracking',  'geburtsplan'),
      ('shopping_list_items',             'tracking',  'shopping_list_items'),
      ('inventory_items',                 'tracking',  'inventory_items'),
      ('planner_recurring_items',         'tracking',  'planner_recurring_items'),
      ('lotti_ai_requests',               'premium',   'lotti_ai_requests'),
      ('voice_log_requests',              'premium',   'voice_log_requests'),
      ('advisor_messages',                'premium',   'advisor_messages'),
      ('advisor_mama_checkins',           'premium',   'advisor_mama_checkins'),
      ('lotti_recommendations',           'premium',   'lotti_recommendations'),
      ('content_reports',                 'moderation','content_reports'),
      ('user_blocks',                     'moderation','user_blocks'),
      ('profiles',                        'account',   'profiles'),
      ('account_links',                   'account',   'account_links'),
      ('feature_requests',                'account',   'feature_requests')
    ) AS t(feature_key, feature_group, table_name)
  LOOP
    SELECT * INTO stats
    FROM public.admin_table_activity(feature.table_name, since);

    activity := activity || jsonb_build_array(jsonb_build_object(
      'key', feature.feature_key,
      'group', feature.feature_group,
      'available', stats.total IS NOT NULL,
      'total', stats.total,
      'period', stats.period,
      'last_at', stats.last_at,
      'daily', public.admin_table_daily_counts(feature.table_name, since)
    ));
  END LOOP;

  -- Nutzer ----------------------------------------------------------------
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'new_in_period', COUNT(*) FILTER (WHERE profile.created_at >= since),
    'new_in_previous_period', COUNT(*) FILTER (
      WHERE profile.created_at >= previous_since AND profile.created_at < since
    ),
    'suspended', COUNT(*) FILTER (WHERE profile.suspended_at IS NOT NULL),
    'terms_accepted', COUNT(*) FILTER (WHERE profile.terms_accepted_at IS NOT NULL),
    'admins', COUNT(*) FILTER (WHERE profile.is_admin)
  )
  INTO users
  FROM public.profiles profile;

  SELECT users || jsonb_build_object('with_push_token', COUNT(DISTINCT token.user_id))
  INTO users
  FROM public.user_push_tokens token;

  -- Moderation ------------------------------------------------------------
  SELECT jsonb_build_object(
    'open', COUNT(*) FILTER (WHERE report.status = 'open'),
    'resolved', COUNT(*) FILTER (WHERE report.status = 'resolved'),
    'dismissed', COUNT(*) FILTER (WHERE report.status = 'dismissed'),
    'auto_filter', COUNT(*) FILTER (WHERE report.source = 'auto_filter'),
    'from_block', COUNT(*) FILTER (WHERE report.source = 'block'),
    'in_period', COUNT(*) FILTER (WHERE report.created_at >= since),
    'follow_ups', COUNT(*) FILTER (WHERE report.follow_up_at IS NOT NULL),
    'avg_hours_to_resolve', ROUND(
      (AVG(
        EXTRACT(EPOCH FROM (report.resolved_at - report.created_at)) / 3600.0
      ) FILTER (WHERE report.resolved_at IS NOT NULL))::NUMERIC,
      1
    ),
    'oldest_open_hours', ROUND(
      (MAX(
        EXTRACT(EPOCH FROM (now() - report.created_at)) / 3600.0
      ) FILTER (WHERE report.status = 'open'))::NUMERIC,
      1
    )
  )
  INTO moderation
  FROM public.content_reports report;

  -- Ask Lotti (Fehlerquote und Latenz sind der Gesundheitsindikator) ------
  SELECT jsonb_build_object(
    'requests_in_period', COUNT(*) FILTER (WHERE request.created_at >= since),
    'completed', COUNT(*) FILTER (
      WHERE request.created_at >= since AND request.status = 'completed'
    ),
    'failed', COUNT(*) FILTER (
      WHERE request.created_at >= since AND request.status = 'failed'
    ),
    'rejected', COUNT(*) FILTER (
      WHERE request.created_at >= since AND request.status = 'rejected'
    ),
    'avg_latency_ms', ROUND(
      (AVG(request.latency_ms) FILTER (
        WHERE request.created_at >= since AND request.latency_ms IS NOT NULL
      ))::NUMERIC
    ),
    'last_error_code', (
      SELECT failed.error_code
      FROM public.lotti_ai_requests failed
      WHERE failed.error_code IS NOT NULL
      ORDER BY failed.created_at DESC
      LIMIT 1
    ),
    'last_error_at', (
      SELECT failed.created_at
      FROM public.lotti_ai_requests failed
      WHERE failed.error_code IS NOT NULL
      ORDER BY failed.created_at DESC
      LIMIT 1
    )
  )
  INTO ai
  FROM public.lotti_ai_requests request;

  -- RevenueCat-Webhooks ---------------------------------------------------
  SELECT jsonb_build_object(
    'completed', COUNT(*) FILTER (
      WHERE event.received_at >= since AND event.status = 'completed'
    ),
    'failed', COUNT(*) FILTER (
      WHERE event.received_at >= since AND event.status = 'failed'
    ),
    'processing', COUNT(*) FILTER (WHERE event.status = 'processing'),
    'last_received_at', MAX(event.received_at),
    'last_failed_at', MAX(event.received_at) FILTER (WHERE event.status = 'failed')
  )
  INTO webhooks
  FROM public.lotti_revenuecat_webhook_events event;

  -- Abos ------------------------------------------------------------------
  SELECT jsonb_build_object(
    'premium_active', COUNT(*) FILTER (
      WHERE entitlement.is_premium
        AND (entitlement.expires_at IS NULL OR entitlement.expires_at > now())
    ),
    'expired', COUNT(*) FILTER (
      WHERE entitlement.expires_at IS NOT NULL AND entitlement.expires_at <= now()
    ),
    'total_tracked', COUNT(*),
    'last_checked_at', MAX(entitlement.checked_at)
  )
  INTO subscriptions
  FROM public.lotti_subscription_entitlements entitlement;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'range_days', window_days,
    'since', since,
    'users', COALESCE(users, '{}'::JSONB),
    'moderation', COALESCE(moderation, '{}'::JSONB),
    'ai', COALESCE(ai, '{}'::JSONB),
    'webhooks', COALESCE(webhooks, '{}'::JSONB),
    'subscriptions', COALESCE(subscriptions, '{}'::JSONB),
    'activity', activity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_admin_dashboard(INTEGER) IS
  'Nutzungs- und Betriebskennzahlen für das Admin-Dashboard. Nur für profiles.is_admin.';

-- --------------------------------------------------------------------------
-- 3. Verbesserungswünsche
--    Die Tabelle existiert live, war aber nie als Migration im Repo.
--    CREATE IF NOT EXISTS dokumentiert das Schema, ohne Daten zu berühren.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feature_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feature'
    CHECK (category IN ('feature', 'improvement', 'bug-fix')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'planned', 'completed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_requests_select_own" ON public.feature_requests;
CREATE POLICY "feature_requests_select_own"
  ON public.feature_requests
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_moderator());

DROP POLICY IF EXISTS "feature_requests_insert_own" ON public.feature_requests;
CREATE POLICY "feature_requests_insert_own"
  ON public.feature_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feature_requests_delete_own" ON public.feature_requests;
CREATE POLICY "feature_requests_delete_own"
  ON public.feature_requests
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_moderator());

CREATE INDEX IF NOT EXISTS feature_requests_status_created_at_idx
  ON public.feature_requests (status, created_at DESC);

-- Alle Wünsche inklusive Autor für das Backoffice.
CREATE OR REPLACE FUNCTION public.get_admin_feature_requests(
  status_param TEXT DEFAULT NULL,
  limit_param INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  author_name TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  priority TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    request.id,
    request.user_id,
    COALESCE(
      NULLIF(BTRIM(author.username), ''),
      NULLIF(BTRIM(CONCAT_WS(' ', author.first_name, author.last_name)), ''),
      'Unbekannt'
    ) AS author_name,
    request.title,
    request.description,
    request.category,
    request.priority,
    request.status,
    request.created_at::TIMESTAMPTZ,
    request.updated_at::TIMESTAMPTZ
  FROM public.feature_requests request
  LEFT JOIN public.profiles author ON author.id = request.user_id
  WHERE public.is_moderator()
    AND (status_param IS NULL OR request.status = status_param)
  ORDER BY
    CASE request.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
    request.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_param, 100), 1), 300);
$$;

REVOKE ALL ON FUNCTION public.get_admin_feature_requests(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_feature_requests(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_feature_request_status(
  request_id_param UUID,
  status_param TEXT
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

  IF status_param NOT IN ('pending', 'under_review', 'planned', 'completed', 'rejected') THEN
    RAISE EXCEPTION 'invalid status: %', status_param USING ERRCODE = '22023';
  END IF;

  UPDATE public.feature_requests
  SET status = status_param,
      updated_at = now()
  WHERE id = request_id_param;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_feature_request_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_feature_request_status(UUID, TEXT) TO authenticated;
