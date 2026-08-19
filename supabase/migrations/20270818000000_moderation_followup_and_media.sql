-- ============================================================================
-- Moderation, Teil 2
--
-- 1. Medien in der Meldung: Bild-URL und Audio-Pfad werden mitgespeichert,
--    damit gemeldete Fotos und Sprachnachrichten beurteilt werden können.
-- 2. Rückfrage an den Melder: Moderatoren können nachfragen, ohne die Meldung
--    zu schließen. Die Rückfrage geht als Direktnachricht an den Melder.
-- ============================================================================

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS follow_up_message TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.content_reports.media_url IS
  'Öffentliche Bild-URL des gemeldeten Inhalts (Post-Foto oder Profilbild) zum Meldezeitpunkt.';
COMMENT ON COLUMN public.content_reports.audio_storage_path IS
  'Storage-Pfad einer gemeldeten Sprachnachricht; wird über get-chat-audio-url signiert.';
COMMENT ON COLUMN public.content_reports.follow_up_at IS
  'Zeitpunkt der letzten Rückfrage an den Melder. Die Meldung bleibt dabei offen.';

-- --------------------------------------------------------------------------
-- 1. report_content: Medien mitspeichern
-- --------------------------------------------------------------------------

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
  media TEXT;
  audio_path TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF source_param NOT IN ('user', 'block') THEN
    RAISE EXCEPTION 'invalid report source' USING ERRCODE = '22023';
  END IF;

  CASE target_type_param
    WHEN 'post' THEN
      SELECT src.user_id, src.content, src.image_url INTO author_id, snapshot, media
      FROM public.community_posts src WHERE src.id = target_id_param;
    WHEN 'comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_comments src WHERE src.id = target_id_param;
    WHEN 'nested_comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_nested_comments src WHERE src.id = target_id_param;
    WHEN 'group_post' THEN
      SELECT src.user_id, src.content, src.image_url INTO author_id, snapshot, media
      FROM public.community_group_posts src WHERE src.id = target_id_param;
    WHEN 'group_comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_group_comments src WHERE src.id = target_id_param;
    WHEN 'group_nested_comment' THEN
      SELECT src.user_id, src.content INTO author_id, snapshot
      FROM public.community_group_nested_comments src WHERE src.id = target_id_param;
    WHEN 'group_message' THEN
      SELECT src.sender_id, src.content, src.audio_storage_path
        INTO author_id, snapshot, audio_path
      FROM public.community_group_messages src WHERE src.id = target_id_param;
    WHEN 'direct_message' THEN
      SELECT src.sender_id, src.content, src.audio_storage_path
        INTO author_id, snapshot, audio_path
      FROM public.direct_messages src WHERE src.id = target_id_param;
    WHEN 'profile' THEN
      SELECT src.id,
             CONCAT_WS(' | ',
               NULLIF(BTRIM(src.username), ''),
               NULLIF(BTRIM(CONCAT_WS(' ', src.first_name, src.last_name)), '')
             ),
             src.avatar_url
        INTO author_id, snapshot, media
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
    media_url,
    audio_storage_path,
    reason,
    details,
    source
  ) VALUES (
    auth.uid(),
    author_id,
    target_type_param,
    target_id_param,
    left(COALESCE(snapshot, ''), 2000),
    media,
    audio_path,
    reason_param,
    details_param,
    source_param
  )
  ON CONFLICT (reporter_id, target_type, target_id) WHERE reporter_id IS NOT NULL DO UPDATE
    SET reason = EXCLUDED.reason,
        details = EXCLUDED.details,
        target_snapshot = EXCLUDED.target_snapshot,
        media_url = EXCLUDED.media_url,
        audio_storage_path = EXCLUDED.audio_storage_path,
        status = 'open',
        created_at = now()
  RETURNING id INTO report_id;

  RETURN report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_content(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_content(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- 2. Automatische Filtertreffer: Audio-Pfad ebenfalls mitnehmen
-- --------------------------------------------------------------------------

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
  media TEXT := NULL;
  audio_path TEXT := NULL;
BEGIN
  matched_term := public.moderation_match_term(NEW.content, 'flag');

  IF matched_term IS NULL THEN
    RETURN NEW;
  END IF;

  IF target_label IN ('direct_message', 'group_message') THEN
    author_id := NEW.sender_id;
    audio_path := NEW.audio_storage_path;
  ELSE
    author_id := NEW.user_id;
    IF target_label IN ('post', 'group_post') THEN
      media := NEW.image_url;
    END IF;
  END IF;

  INSERT INTO public.content_reports (
    reporter_id,
    reported_user_id,
    target_type,
    target_id,
    target_snapshot,
    media_url,
    audio_storage_path,
    reason,
    details,
    source
  ) VALUES (
    NULL,
    author_id,
    target_label,
    NEW.id,
    left(COALESCE(NEW.content, ''), 2000),
    media,
    audio_path,
    'auto_filter',
    'Automatischer Filtertreffer: ' || matched_term,
    'auto_filter'
  );

  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- 3. Rückfrage an den Melder
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.moderation_ask_reporter(
  report_id_param UUID,
  message_param TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_report RECORD;
  reporter_locale TEXT;
  message_prefix TEXT;
  trimmed_message TEXT;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'moderator role required' USING ERRCODE = '42501';
  END IF;

  trimmed_message := btrim(COALESCE(message_param, ''));

  IF trimmed_message = '' THEN
    RAISE EXCEPTION 'message must not be empty' USING ERRCODE = '22023';
  END IF;

  SELECT report.id, report.reporter_id, report.target_type
  INTO target_report
  FROM public.content_reports report
  WHERE report.id = report_id_param;

  IF target_report.id IS NULL THEN
    RAISE EXCEPTION 'report not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF target_report.reporter_id IS NULL THEN
    RAISE EXCEPTION 'report has no reporter to contact' USING ERRCODE = '22023';
  END IF;

  IF target_report.reporter_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot ask yourself' USING ERRCODE = '22023';
  END IF;

  -- Sprache des Melders bestimmen, damit die Einleitung verständlich ist.
  SELECT COALESCE(
           NULLIF(settings.resolved_language, ''),
           NULLIF(settings.language_preference, 'system'),
           'de'
         )
  INTO reporter_locale
  FROM public.user_settings settings
  WHERE settings.user_id = target_report.reporter_id
  ORDER BY settings.updated_at DESC NULLS LAST, settings.created_at DESC NULLS LAST
  LIMIT 1;

  IF reporter_locale NOT IN ('de', 'en', 'es') THEN
    reporter_locale := 'de';
  END IF;

  message_prefix := CASE reporter_locale
    WHEN 'en' THEN 'Question about your report: '
    WHEN 'es' THEN 'Consulta sobre tu denuncia: '
    ELSE 'Rückfrage zu deiner Meldung: '
  END;

  INSERT INTO public.direct_messages (
    sender_id,
    receiver_id,
    content,
    message_type,
    is_read
  ) VALUES (
    auth.uid(),
    target_report.reporter_id,
    message_prefix || trimmed_message,
    'text',
    FALSE
  );

  -- Die Meldung bleibt offen; der Vermerk dokumentiert die Rückfrage.
  UPDATE public.content_reports
  SET follow_up_at = now(),
      follow_up_message = left(trimmed_message, 1000),
      follow_up_by = auth.uid()
  WHERE id = report_id_param;
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_ask_reporter(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderation_ask_reporter(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- 4. Backoffice-Abfrage um Medien und Rückfrage-Status erweitern
-- --------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_moderation_reports(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_moderation_reports(
  status_param TEXT DEFAULT 'open',
  limit_param INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  target_type TEXT,
  target_id UUID,
  target_snapshot TEXT,
  media_url TEXT,
  audio_storage_path TEXT,
  reason TEXT,
  details TEXT,
  source TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  follow_up_at TIMESTAMPTZ,
  follow_up_message TEXT,
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
    report.media_url,
    report.audio_storage_path,
    report.reason,
    report.details,
    report.source,
    report.status,
    report.created_at,
    report.follow_up_at,
    report.follow_up_message,
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
