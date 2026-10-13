-- ============================================================================
-- App Review hardening
--
-- 1. Append-only evidence for terms consent, including email sign-up.
-- 2. One atomic moderation action: delete content, suspend author, then resolve.
-- 3. Blocked senders are excluded from group-chat previews and unread counts.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Auditable terms consent
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.terms_consents (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('signup', 'login', 'otp', 'gate')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version)
);

ALTER TABLE public.terms_consents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.terms_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.terms_consents TO authenticated;

DROP POLICY IF EXISTS "terms_consents_select_own" ON public.terms_consents;
CREATE POLICY "terms_consents_select_own"
  ON public.terms_consents
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Preserve consent evidence written by released app versions before this
-- append-only ledger existed. Only the currently supported terms version is
-- imported, so stale consent can never satisfy the current gate.
INSERT INTO public.terms_consents (user_id, terms_version, accepted_at, source)
SELECT profile.id, profile.terms_version, profile.terms_accepted_at, 'gate'
FROM public.profiles profile
WHERE profile.terms_version = '2026-08-17'
  AND profile.terms_accepted_at IS NOT NULL
ON CONFLICT (user_id, terms_version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_terms_consent(
  terms_version_param TEXT,
  source_param TEXT DEFAULT 'gate'
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  recorded_acceptance TIMESTAMPTZ;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF terms_version_param <> '2026-08-17' THEN
    RAISE EXCEPTION 'unsupported terms version' USING ERRCODE = '22023';
  END IF;

  IF source_param NOT IN ('signup', 'login', 'otp', 'gate') THEN
    RAISE EXCEPTION 'invalid consent source' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.terms_consents (user_id, terms_version, accepted_at, source)
  VALUES (current_user_id, terms_version_param, clock_timestamp(), source_param)
  ON CONFLICT (user_id, terms_version) DO NOTHING;

  SELECT consent.accepted_at
  INTO STRICT recorded_acceptance
  FROM public.terms_consents consent
  WHERE consent.user_id = current_user_id
    AND consent.terms_version = terms_version_param;

  -- Keep the legacy profile fields synchronized for dashboard/reporting code.
  UPDATE public.profiles
  SET terms_accepted_at = recorded_acceptance,
      terms_version = terms_version_param
  WHERE id = current_user_id;

  RETURN recorded_acceptance;
END;
$$;

REVOKE ALL ON FUNCTION public.record_terms_consent(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_terms_consent(TEXT, TEXT) TO authenticated;

-- Email registration may not produce an authenticated session until OTP
-- verification. Capture the explicit pre-registration checkbox assertion from
-- the auth metadata, while validating version, source and timestamp.
CREATE OR REPLACE FUNCTION public.capture_signup_terms_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  metadata JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  consent_time TIMESTAMPTZ;
BEGIN
  IF metadata ->> 'terms_version' <> '2026-08-17'
     OR metadata ->> 'terms_consent_source' <> 'signup' THEN
    RETURN NEW;
  END IF;

  BEGIN
    consent_time := (metadata ->> 'terms_accepted_at')::TIMESTAMPTZ;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN NEW;
  END;

  IF consent_time IS NULL
     OR consent_time < statement_timestamp() - INTERVAL '1 hour'
     OR consent_time > statement_timestamp() + INTERVAL '5 minutes' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.terms_consents (user_id, terms_version, accepted_at, source)
  VALUES (NEW.id, '2026-08-17', consent_time, 'signup')
  ON CONFLICT (user_id, terms_version) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_signup_terms_consent()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_signup_terms_consent ON auth.users;
CREATE TRIGGER capture_signup_terms_consent
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_signup_terms_consent();

CREATE OR REPLACE FUNCTION public.sync_profile_terms_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  recorded_acceptance TIMESTAMPTZ;
  recorded_version TEXT;
BEGIN
  SELECT consent.accepted_at, consent.terms_version
  INTO recorded_acceptance, recorded_version
  FROM public.terms_consents consent
  WHERE consent.user_id = NEW.id
  ORDER BY consent.accepted_at DESC
  LIMIT 1;

  -- Older app versions may still supply the legacy profile fields directly.
  -- Only replace them when the append-only ledger has stronger evidence.
  IF FOUND THEN
    NEW.terms_accepted_at := recorded_acceptance;
    NEW.terms_version := recorded_version;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_terms_consent()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_profile_terms_consent ON public.profiles;
CREATE TRIGGER sync_profile_terms_consent
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_terms_consent();

-- --------------------------------------------------------------------------
-- 2. Atomic content removal + account suspension
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.moderation_remove_content_and_suspend_user(
  report_id_param UUID,
  reason_param TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_report public.content_reports%ROWTYPE;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  SELECT report.*
  INTO target_report
  FROM public.content_reports report
  WHERE report.id = report_id_param
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderation report not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF target_report.reported_user_id IS NULL THEN
    RAISE EXCEPTION 'reported user missing' USING ERRCODE = '22023';
  END IF;

  IF public.is_moderator(target_report.reported_user_id) THEN
    RAISE EXCEPTION 'cannot suspend a moderator' USING ERRCODE = '42501';
  END IF;

  CASE target_report.target_type
    WHEN 'post' THEN
      DELETE FROM public.community_posts WHERE id = target_report.target_id;
    WHEN 'comment' THEN
      DELETE FROM public.community_comments WHERE id = target_report.target_id;
    WHEN 'nested_comment' THEN
      DELETE FROM public.community_nested_comments WHERE id = target_report.target_id;
    WHEN 'group_post' THEN
      DELETE FROM public.community_group_posts WHERE id = target_report.target_id;
    WHEN 'group_comment' THEN
      DELETE FROM public.community_group_comments WHERE id = target_report.target_id;
    WHEN 'group_nested_comment' THEN
      DELETE FROM public.community_group_nested_comments WHERE id = target_report.target_id;
    WHEN 'group_message' THEN
      DELETE FROM public.community_group_messages WHERE id = target_report.target_id;
    WHEN 'direct_message' THEN
      DELETE FROM public.direct_messages WHERE id = target_report.target_id;
    WHEN 'profile' THEN
      NULL; -- The profile/account is suspended rather than deleted.
    ELSE
      RAISE EXCEPTION 'invalid target type: %', target_report.target_type
        USING ERRCODE = '22023';
  END CASE;

  UPDATE public.profiles
  SET suspended_at = clock_timestamp(),
      suspension_reason = COALESCE(reason_param, 'report:' || report_id_param::TEXT)
  WHERE id = target_report.reported_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reported user profile not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- This happens only after both preceding actions completed successfully.
  UPDATE public.content_reports
  SET status = 'resolved',
      resolution = 'content_deleted_user_suspended',
      resolved_by = auth.uid(),
      resolved_at = clock_timestamp()
  WHERE target_type = target_report.target_type
    AND target_id = target_report.target_id
    AND status = 'open';
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_remove_content_and_suspend_user(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_remove_content_and_suspend_user(UUID, TEXT)
  TO authenticated;

-- A standalone suspension must not imply that reported content was removed.
CREATE OR REPLACE FUNCTION public.moderation_suspend_user(
  target_user_id UUID,
  reason_param TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  IF public.is_moderator(target_user_id) THEN
    RAISE EXCEPTION 'cannot suspend a moderator' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET suspended_at = clock_timestamp(),
      suspension_reason = reason_param
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_suspend_user(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_suspend_user(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- 3. Block-aware group-chat summaries and badge counts
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_group_chat_summaries()
RETURNS TABLE(
  group_id UUID,
  group_name TEXT,
  group_visibility TEXT,
  latest_message_content TEXT,
  latest_message_type TEXT,
  latest_message_preview TEXT,
  latest_message_sender_id UUID,
  latest_message_created_at TIMESTAMPTZ,
  unread_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    group_record.id AS group_id,
    group_record.name AS group_name,
    group_record.visibility::TEXT AS group_visibility,
    latest_msg.content AS latest_message_content,
    latest_msg.message_type AS latest_message_type,
    CASE
      WHEN latest_msg.message_type = 'voice' THEN 'Sprachnachricht'
      WHEN latest_msg.message_type = 'event' THEN
        COALESCE('Event: ' || NULLIF(event_msg.title, ''), 'Event')
      ELSE latest_msg.content
    END AS latest_message_preview,
    latest_msg.sender_id AS latest_message_sender_id,
    latest_msg.created_at AS latest_message_created_at,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.community_group_messages message_record
      WHERE message_record.group_id = group_record.id
        AND message_record.sender_id <> auth.uid()
        AND NOT public.is_blocked_pair(auth.uid(), message_record.sender_id)
        AND message_record.created_at > COALESCE(
          (
            SELECT read_record.last_read_at
            FROM public.community_group_chat_reads read_record
            WHERE read_record.group_id = group_record.id
              AND read_record.user_id = auth.uid()
          ),
          '1970-01-01'::TIMESTAMPTZ
        )
    ), 0) AS unread_count
  FROM public.community_groups group_record
  INNER JOIN public.community_group_members member_record
    ON member_record.group_id = group_record.id
    AND member_record.user_id = auth.uid()
    AND member_record.status = 'active'
  LEFT JOIN LATERAL (
    SELECT
      message_record.id,
      message_record.content,
      message_record.message_type,
      message_record.sender_id,
      message_record.created_at,
      message_record.event_id
    FROM public.community_group_messages message_record
    WHERE message_record.group_id = group_record.id
      AND NOT public.is_blocked_pair(auth.uid(), message_record.sender_id)
    ORDER BY message_record.created_at DESC
    LIMIT 1
  ) latest_msg ON TRUE
  LEFT JOIN public.community_group_events event_msg
    ON event_msg.id = latest_msg.event_id
  WHERE latest_msg.id IS NOT NULL
  ORDER BY latest_msg.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_group_chat_summaries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_group_chat_summaries() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_total_group_chat_unread_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(group_counts.unread), 0)::INTEGER
  FROM (
    SELECT (
      SELECT COUNT(*)::INTEGER
      FROM public.community_group_messages message_record
      WHERE message_record.group_id = member_record.group_id
        AND message_record.sender_id <> auth.uid()
        AND NOT public.is_blocked_pair(auth.uid(), message_record.sender_id)
        AND message_record.created_at > COALESCE(
          (
            SELECT read_record.last_read_at
            FROM public.community_group_chat_reads read_record
            WHERE read_record.group_id = member_record.group_id
              AND read_record.user_id = auth.uid()
          ),
          '1970-01-01'::TIMESTAMPTZ
        )
    ) AS unread
    FROM public.community_group_members member_record
    WHERE member_record.user_id = auth.uid()
      AND member_record.status = 'active'
  ) group_counts;
$$;

REVOKE ALL ON FUNCTION public.get_total_group_chat_unread_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_total_group_chat_unread_count() TO authenticated;

-- --------------------------------------------------------------------------
-- 4. Require the database-to-function shared secret
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_moderation_report_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  request_id BIGINT;
  webhook_secret TEXT;
BEGIN
  SELECT NULLIF(secret_record.decrypted_secret, '')
  INTO webhook_secret
  FROM vault.decrypted_secrets secret_record
  WHERE secret_record.name = 'moderation_webhook_secret'
  LIMIT 1;

  IF webhook_secret IS NULL THEN
    RAISE WARNING 'Moderation webhook secret missing; notification was not sent';
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := 'https://kwniiyayhzgjfqjsjcfu.supabase.co/functions/v1/moderation-report-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
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

REVOKE ALL ON FUNCTION public.send_moderation_report_webhook()
  FROM PUBLIC, anon, authenticated;
