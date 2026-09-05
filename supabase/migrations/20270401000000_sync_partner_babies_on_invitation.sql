-- Sync existing babies for linked users when an invitation is accepted.

CREATE OR REPLACE FUNCTION public.sync_babies_for_user_links(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_rows INTEGER := 0;
BEGIN
  -- Share all babies where linked partners are already members (owner or partner)
  INSERT INTO public.baby_members (baby_id, user_id, role)
  SELECT DISTINCT
    bm.baby_id,
    p_user_id,
    'partner'
  FROM public.baby_members bm
  JOIN public.account_links al
    ON al.status = 'accepted'
   AND (
        (al.creator_id = bm.user_id AND al.invited_id = p_user_id)
        OR
        (al.invited_id = bm.user_id AND al.creator_id = p_user_id)
       )
  WHERE bm.baby_id IS NOT NULL
    AND bm.user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  -- If the current user already has babies, mirror-share them to the linked partner
  INSERT INTO public.baby_members (baby_id, user_id, role)
  SELECT DISTINCT
    bm.baby_id,
    CASE
      WHEN al.creator_id = p_user_id THEN al.invited_id
      ELSE al.creator_id
    END,
    'partner'
  FROM public.baby_members bm
  JOIN public.account_links al
    ON al.status = 'accepted'
   AND (al.creator_id = p_user_id OR al.invited_id = p_user_id)
  WHERE bm.user_id = p_user_id
    AND bm.baby_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  RETURN jsonb_build_object('success', true, 'inserted', v_inserted);
END;
$$;

COMMENT ON FUNCTION public.sync_babies_for_user_links IS 'Teilt vorhandene Babys mit verknüpften Nutzern auf Basis von account_links';
GRANT EXECUTE ON FUNCTION public.sync_babies_for_user_links(UUID) TO authenticated;

-- Recreate accept_invitation_and_sync_due_date to also sync babies.
DROP FUNCTION IF EXISTS public.accept_invitation_and_sync_due_date(UUID, UUID);

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
  -- Accept invitation (handles validation + status updates)
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
    due_date, is_baby_born INTO v_creator_due_date, v_creator_is_baby_born
  FROM public.user_settings
  WHERE user_id = v_creator_id;

  SELECT
    EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) INTO v_user_settings_exist;

  IF v_creator_due_date IS NOT NULL THEN
    IF v_user_settings_exist THEN
      UPDATE public.user_settings
      SET
        due_date = v_creator_due_date,
        is_baby_born = v_creator_is_baby_born,
        updated_at = NOW()
      WHERE
        user_id = p_user_id;
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

  -- Share babies in both directions after the link is accepted
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

COMMENT ON FUNCTION public.accept_invitation_and_sync_due_date IS 'Akzeptiert eine Einladung, synchronisiert Entbindungstermin & Babys';
GRANT EXECUTE ON FUNCTION public.accept_invitation_and_sync_due_date(UUID, UUID) TO authenticated;

-- Keep redeem function aligned with the updated accept logic.
CREATE OR REPLACE FUNCTION public.redeem_invitation_code_and_sync_due_date(
  p_invitation_code TEXT,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_result jsonb;
BEGIN
  SELECT id INTO v_invitation_id
  FROM public.account_links
  WHERE LOWER(invitation_code) = LOWER(p_invitation_code);

  IF v_invitation_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Einladungscode nicht gefunden');
  END IF;

  SELECT * FROM public.accept_invitation_and_sync_due_date(v_invitation_id, p_user_id) INTO v_result;
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.redeem_invitation_code_and_sync_due_date IS 'Löst Einladungscodes ein, synchronisiert Termin & Babys';
GRANT EXECUTE ON FUNCTION public.redeem_invitation_code_and_sync_due_date(TEXT, UUID) TO authenticated;
