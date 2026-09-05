-- Fix invitation sync so born-baby state is copied even when due_date is NULL.
-- Future-only fix: no backfill for existing links.

CREATE OR REPLACE FUNCTION public.accept_invitation_and_sync_due_date(
  invitation_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_data jsonb;
  v_creator_id UUID;
  v_creator_info jsonb;
  v_creator_due_date TIMESTAMPTZ;
  v_creator_is_baby_born BOOLEAN;
  v_user_settings_exist BOOLEAN;
BEGIN
  SELECT * FROM public.accept_invitation(invitation_id, p_user_id) INTO v_link_data;

  IF NOT (v_link_data->>'success')::boolean THEN
    RETURN v_link_data;
  END IF;

  v_creator_id := (v_link_data->'data'->>'creator_id')::UUID;

  SELECT
    jsonb_build_object(
      'userId', p.id,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'userRole', p.user_role
    ) INTO v_creator_info
  FROM public.profiles p
  WHERE p.id = v_creator_id;

  SELECT
    due_date,
    is_baby_born
  INTO
    v_creator_due_date,
    v_creator_is_baby_born
  FROM public.user_settings
  WHERE user_id = v_creator_id;

  SELECT EXISTS(
    SELECT 1
    FROM public.user_settings
    WHERE user_id = p_user_id
  ) INTO v_user_settings_exist;

  -- Important: sync settings even when due_date is NULL.
  -- This is required for already-born babies where only is_baby_born=true exists.
  IF v_creator_due_date IS NOT NULL OR v_creator_is_baby_born IS NOT NULL THEN
    IF v_user_settings_exist THEN
      UPDATE public.user_settings
      SET
        due_date = v_creator_due_date,
        is_baby_born = v_creator_is_baby_born,
        updated_at = NOW()
      WHERE user_id = p_user_id;
    ELSE
      INSERT INTO public.user_settings (
        user_id,
        due_date,
        is_baby_born,
        created_at,
        updated_at
      ) VALUES (
        p_user_id,
        v_creator_due_date,
        v_creator_is_baby_born,
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  PERFORM public.sync_babies_for_user_links(p_user_id);
  IF v_creator_id IS NOT NULL THEN
    PERFORM public.sync_babies_for_user_links(v_creator_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'linkData', v_link_data->'data',
    'creatorInfo', v_creator_info,
    'syncedData', jsonb_build_object(
      'dueDate', v_creator_due_date,
      'isBabyBorn', v_creator_is_baby_born
    )
  );
END;
$$;

COMMENT ON FUNCTION public.accept_invitation_and_sync_due_date IS
  'Akzeptiert eine Einladung, synchronisiert Entbindungstermin & Babys und kopiert is_baby_born auch ohne due_date';
