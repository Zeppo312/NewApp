-- Run after the migration with an administrative connection. No user data is
-- changed or returned; JWT claims used by the checks are rolled back.
BEGIN;
DO $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
  v_expected jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM public.get_contractions_with_sync_info(gen_random_uuid());
    RAISE EXCEPTION 'Unauthenticated call was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  v_user_id := gen_random_uuid();
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  v_result := public.get_contractions_with_sync_info(v_user_id);
  ASSERT v_result->'contractions' = '[]'::jsonb, 'Empty history must be an array';
  ASSERT v_result->'syncInfo'->'linkedUsers' = '[]'::jsonb, 'Empty links must be an array';

  BEGIN
    PERFORM public.get_contractions_with_sync_info(gen_random_uuid());
    RAISE EXCEPTION 'Cross-user call was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  FOR v_user_id IN SELECT DISTINCT user_id FROM public.contractions LIMIT 3 LOOP
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_result := public.get_contractions_with_sync_info(v_user_id);
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'startTime', start_time, 'start_time', start_time,
      'endTime', end_time, 'end_time', end_time,
      'duration', duration, 'intensity', intensity, 'notes', notes
    ) ORDER BY start_time DESC, id DESC)
    INTO v_expected FROM public.contractions WHERE user_id = v_user_id;
    ASSERT v_result->'contractions' = v_expected, 'History timestamps, ownership or ordering differ';
    ASSERT v_result->>'success' = 'true', 'RPC did not return success';
  END LOOP;

  ASSERT NOT has_function_privilege('anon', 'public.get_contractions_with_sync_info(uuid)', 'EXECUTE'),
    'Anonymous execution must be disabled';
  ASSERT has_function_privilege('authenticated', 'public.get_contractions_with_sync_info(uuid)', 'EXECUTE'),
    'Signed-in users must be able to load their history';
END;
$$;
ROLLBACK;
