-- Delete all user data and optionally the auth user.
CREATE OR REPLACE FUNCTION public.delete_user_data(delete_auth boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_table record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Detach shared references that could block profile deletion.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sleep_entries'
      AND column_name = 'shared_with_user_id'
  ) THEN
    EXECUTE 'UPDATE public.sleep_entries SET shared_with_user_id = NULL WHERE shared_with_user_id = $1'
      USING v_user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sleep_entries'
      AND column_name = 'partner_id'
  ) THEN
    EXECUTE 'UPDATE public.sleep_entries SET partner_id = NULL WHERE partner_id = $1'
      USING v_user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'baby_sleep_tracking'
      AND column_name = 'shared_with_user_id'
  ) THEN
    EXECUTE 'UPDATE public.baby_sleep_tracking SET shared_with_user_id = NULL WHERE shared_with_user_id = $1'
      USING v_user_id;
  END IF;

  -- Delete records that do not use a user_id column.
  IF to_regclass('public.account_links') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.account_links WHERE creator_id = $1 OR invited_id = $1'
      USING v_user_id;
  END IF;

  IF to_regclass('public.user_follows') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_follows WHERE follower_id = $1 OR following_id = $1'
      USING v_user_id;
  END IF;

  IF to_regclass('public.direct_messages') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.direct_messages WHERE sender_id = $1 OR receiver_id = $1'
      USING v_user_id;
  END IF;

  IF to_regclass('public.lotti_recommendations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.lotti_recommendations WHERE created_by = $1'
      USING v_user_id;
  END IF;

  -- Delete all user-owned rows.
  FOR v_table IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'user_id'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table.table_name)
      USING v_user_id;
  END LOOP;

  -- Remove profile row so linked data can be recreated.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.profiles WHERE id = $1'
      USING v_user_id;
  END IF;

  IF delete_auth THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_data(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_data(boolean) TO authenticated;
