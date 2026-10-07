-- Depends on 20270817000000_ugc_moderation.sql. AI chats stay on-device;
-- only an answer explicitly submitted by its reporter is stored here.
ALTER TABLE public.content_reports
  DROP CONSTRAINT content_reports_target_type_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_target_type_check CHECK (target_type IN (
    'post', 'comment', 'nested_comment', 'group_post', 'group_comment',
    'group_nested_comment', 'group_message', 'direct_message', 'profile', 'ai_answer'
  )),
  ADD CONSTRAINT content_reports_ai_answer_check CHECK (
    target_type <> 'ai_answer' OR (
      reported_user_id IS NULL AND source = 'user' AND reason <> 'auto_filter'
      AND target_snapshot IS NOT NULL
      AND char_length(btrim(target_snapshot)) BETWEEN 1 AND 30000
      AND char_length(coalesce(details, '')) <= 1000
    )
  );

-- Reuse the existing ownership and moderator RLS policies, including when
-- called through the RPC. No elevated function privileges are needed.
GRANT SELECT, INSERT ON public.content_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_lotti_answer(
  conversation_id_param TEXT,
  message_id_param TEXT,
  answer_param TEXT,
  reason_param TEXT,
  details_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := auth.uid();
  answer_id UUID;
  report_id UUID;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF conversation_id_param IS NULL OR char_length(btrim(conversation_id_param)) NOT BETWEEN 1 AND 200
    OR message_id_param IS NULL OR char_length(btrim(message_id_param)) NOT BETWEEN 1 AND 200
    OR answer_param IS NULL OR char_length(btrim(answer_param)) NOT BETWEEN 1 AND 30000
    OR char_length(coalesce(details_param, '')) > 1000
    OR reason_param IS NULL OR reason_param NOT IN (
      'spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'misinformation', 'other'
    ) THEN
    RAISE EXCEPTION 'invalid answer report' USING ERRCODE = '22023';
  END IF;

  -- Local message IDs are text, not UUIDs. A stable per-reporter identity
  -- makes retries (including a lost success response) idempotent.
  answer_id := md5(jsonb_build_array(caller_id, conversation_id_param, message_id_param)::text)::uuid;
  INSERT INTO public.content_reports (
    reporter_id, reported_user_id, target_type, target_id,
    target_snapshot, reason, details, source, status
  ) VALUES (
    caller_id, NULL, 'ai_answer', answer_id,
    btrim(answer_param), reason_param, nullif(btrim(details_param), ''), 'user', 'open'
  )
  ON CONFLICT (reporter_id, target_type, target_id) WHERE reporter_id IS NOT NULL
    DO NOTHING
  RETURNING id INTO report_id;

  IF report_id IS NULL THEN
    SELECT id INTO report_id FROM public.content_reports
    WHERE reporter_id = caller_id AND target_type = 'ai_answer' AND target_id = answer_id;
  END IF;
  RETURN report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_lotti_answer(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_lotti_answer(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.report_lotti_answer(TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Explicit user-submitted AI answer snapshot for moderation; client supplied, not a verified server transcript. Does not upload the conversation or baby records.';
