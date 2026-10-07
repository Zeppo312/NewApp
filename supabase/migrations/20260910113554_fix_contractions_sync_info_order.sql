-- Sort inside jsonb_agg to avoid PostgreSQL 42803. Keep both timestamp key
-- formats so installed clients and direct table fallback use the same dates.
CREATE OR REPLACE FUNCTION public.get_contractions_with_sync_info(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contractions jsonb;
  v_linked_users jsonb := '[]'::jsonb;
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id
    FROM
      public.account_links al
    WHERE
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- Abrufen der Wehen des Benutzers
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'startTime', c.start_time,
          'start_time', c.start_time,
          'endTime', c.end_time,
          'end_time', c.end_time,
          'duration', c.duration,
          'intensity', c.intensity,
          'notes', c.notes
        ) ORDER BY c.start_time DESC, c.id DESC
      ),
      '[]'::jsonb
    ) INTO v_contractions
  FROM
    public.contractions c
  WHERE
    c.user_id = p_user_id;

  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;

    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM
      public.profiles p
    WHERE
      p.id = v_linked_user_id;
  END LOOP;
  CLOSE v_linked_users_cursor;

  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'contractions', v_contractions,
    'syncInfo', jsonb_build_object(
      'linkedUsers', v_linked_users
    )
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_contractions_with_sync_info IS 'Gibt die Wehen des Benutzers mit Synchronisierungsinformationen zurück';

REVOKE ALL ON FUNCTION public.get_contractions_with_sync_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contractions_with_sync_info(uuid) TO authenticated;
