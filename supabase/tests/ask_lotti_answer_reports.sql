-- Run against an isolated test database after the moderation/report migrations.
-- Synthetic accounts and report writes are rolled back. Do not run against
-- production: content_reports has an external notification trigger.
BEGIN;
INSERT INTO auth.users (id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.report_lotti_answer('chat-old', 'lotti-old', 'Answer', 'other');
    RAISE EXCEPTION 'Missing authentication accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
DO $$
DECLARE first_id UUID; retry_id UUID; invalid_reason TEXT;
BEGIN
  first_id := public.report_lotti_answer('chat-old', 'lotti-old', 'Selected answer', 'misinformation', '  Comment  ');
  retry_id := public.report_lotti_answer('chat-old', 'lotti-old', 'Changed retry', 'other');
  ASSERT first_id IS NOT NULL AND first_id = retry_id, 'Retry must return the same report';
  ASSERT (SELECT count(*) FROM public.content_reports WHERE id = first_id) = 1, 'Duplicate report';
  ASSERT (SELECT target_snapshot = 'Selected answer' AND details = 'Comment'
    AND reported_user_id IS NULL AND target_type = 'ai_answer' AND source = 'user'
    AND status = 'open' AND reason = 'misinformation'
    FROM public.content_reports WHERE id = first_id), 'Incorrect moderation snapshot';

  FOREACH invalid_reason IN ARRAY ARRAY['invalid', 'auto_filter', NULL] LOOP
    BEGIN
      PERFORM public.report_lotti_answer('chat', 'bad', 'Answer', invalid_reason);
      RAISE EXCEPTION 'Invalid reason accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.report_lotti_answer('chat', 'bad', repeat('a', 30001), 'other');
    RAISE EXCEPTION 'Oversized answer accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.report_lotti_answer('chat', 'bad', 'Answer', 'other', repeat('a', 1001));
    RAISE EXCEPTION 'Oversized comment accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.report_lotti_answer('chat', '', 'Answer', 'other');
    RAISE EXCEPTION 'Empty identity accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    INSERT INTO public.content_reports (reporter_id, target_type, target_id, target_snapshot, reason)
    VALUES ('10000000-0000-4000-8000-000000000002', 'ai_answer', gen_random_uuid(), 'Forged', 'other');
    RAISE EXCEPTION 'Reporter impersonation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.content_reports (reporter_id, reported_user_id, target_type, target_id, target_snapshot, reason)
    VALUES (auth.uid(), '10000000-0000-4000-8000-000000000002', 'ai_answer', gen_random_uuid(), 'Forged author', 'other');
    RAISE EXCEPTION 'AI answer attributed to a person';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

RESET ROLE;
UPDATE public.content_reports SET status = 'resolved'
WHERE reporter_id = '10000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.report_lotti_answer('chat-old', 'lotti-old', 'Retry after review', 'other');
  ASSERT (SELECT status = 'resolved' FROM public.content_reports
    WHERE reporter_id = auth.uid()), 'Retry reopened a reviewed report';
END $$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.content_reports
    WHERE reporter_id = '10000000-0000-4000-8000-000000000001'), 'Another user can read the private answer';
  PERFORM public.report_lotti_answer('chat-old', 'lotti-old', 'Second account answer', 'other');
  ASSERT (SELECT count(*) FROM public.content_reports WHERE reporter_id = auth.uid()) = 1,
    'Identical local IDs from another account must create a separate report';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(DISTINCT target_id) FROM public.content_reports
    WHERE reporter_id IN ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')) = 2,
    'Answer identity must be scoped to its reporter';
  ASSERT NOT has_function_privilege('anon', 'public.report_lotti_answer(text,text,text,text,text)', 'EXECUTE'),
    'Anonymous execution enabled';
  ASSERT has_function_privilege('authenticated', 'public.report_lotti_answer(text,text,text,text,text)', 'EXECUTE'),
    'Signed-in execution disabled';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.report_lotti_answer(text,text,text,text,text)'::regprocedure),
    'Report RPC must enforce caller RLS';
END $$;
ROLLBACK;
