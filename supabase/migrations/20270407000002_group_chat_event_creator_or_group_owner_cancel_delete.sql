CREATE OR REPLACE FUNCTION public.can_cancel_or_delete_group_event(
  target_event_id UUID,
  target_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_group_events event
    WHERE event.id = target_event_id
      AND (
        event.created_by_user_id = COALESCE(target_user_id, auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.community_group_members member
          WHERE member.group_id = event.group_id
            AND member.user_id = COALESCE(target_user_id, auth.uid())
            AND member.status = 'active'
            AND member.role = 'owner'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.cancel_group_chat_event(
  target_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_cancel_or_delete_group_event(target_event_id) THEN
    RAISE EXCEPTION 'Nur Event-Ersteller:innen oder Gruppen-Besitzer:innen koennen Events absagen.'
      USING ERRCODE = '42501';
  END IF;

  SELECT event.status INTO current_status
  FROM public.community_group_events event
  WHERE event.id = target_event_id;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Event not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF current_status = 'cancelled' THEN
    RETURN TRUE;
  END IF;

  UPDATE public.community_group_events
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by_user_id = auth.uid(),
    updated_at = now()
  WHERE id = target_event_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_group_chat_event(
  target_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_message_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_cancel_or_delete_group_event(target_event_id) THEN
    RAISE EXCEPTION 'Nur Event-Ersteller:innen oder Gruppen-Besitzer:innen koennen Events loeschen.'
      USING ERRCODE = '42501';
  END IF;

  SELECT msg.id
  INTO linked_message_id
  FROM public.community_group_messages msg
  WHERE msg.event_id = target_event_id
  LIMIT 1;

  IF linked_message_id IS NULL THEN
    RAISE EXCEPTION 'Event not found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.allow_group_event_message_delete', 'on', true);

  DELETE FROM public.community_group_messages
  WHERE id = linked_message_id;

  DELETE FROM public.community_group_events
  WHERE id = target_event_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_cancel_or_delete_group_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_cancel_or_delete_group_event(UUID, UUID) TO authenticated;
