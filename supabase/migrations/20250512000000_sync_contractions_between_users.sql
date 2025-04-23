-- Skript zur Synchronisierung der Wehen (Kontraktionen) zwischen verknüpften Benutzern
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Funktion zum Synchronisieren der Wehen vom einladenden Benutzer zum eingeladenen Benutzer
CREATE OR REPLACE FUNCTION public.sync_contractions_from_inviter_to_invitee(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_inviter_id UUID;
  v_invitee_id UUID;
  v_inviter_contractions_count INTEGER := 0;
  v_synced_count INTEGER := 0;
  v_inviter_name TEXT;
  v_result jsonb;
BEGIN
  -- Bestimmen, ob der Benutzer der Einladende oder der Eingeladene ist
  -- Wir suchen nach einer akzeptierten Verknüpfung, bei der der Benutzer beteiligt ist
  SELECT
    al.creator_id, al.invited_id
  INTO
    v_inviter_id, v_invitee_id
  FROM
    public.account_links al
  WHERE
    (al.creator_id = p_user_id OR al.invited_id = p_user_id)
    AND al.status = 'accepted'
  LIMIT 1;

  -- Wenn keine Verknüpfung gefunden wurde, Fehler zurückgeben
  IF v_inviter_id IS NULL OR v_invitee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Keine akzeptierte Verknüpfung gefunden'
    );
  END IF;

  -- Wenn der Benutzer der Eingeladene ist, synchronisieren wir die Wehen vom Einladenden
  IF p_user_id = v_invitee_id THEN
    -- Abrufen des Namens des Einladenden
    SELECT
      first_name INTO v_inviter_name
    FROM
      public.profiles
    WHERE
      id = v_inviter_id;

    -- Zählen der Wehen des Einladenden
    SELECT
      COUNT(*) INTO v_inviter_contractions_count
    FROM
      public.contractions
    WHERE
      user_id = v_inviter_id;

    -- Löschen aller bestehenden Wehen des Eingeladenen
    DELETE FROM public.contractions
    WHERE user_id = v_invitee_id;

    -- Kopieren aller Wehen vom Einladenden zum Eingeladenen
    INSERT INTO public.contractions (
      user_id,
      start_time,
      end_time,
      duration,
      intensity,
      notes,
      created_at,
      updated_at
    )
    SELECT
      v_invitee_id,
      c.start_time,
      c.end_time,
      c.duration,
      c.intensity,
      c.notes,
      NOW(),
      NOW()
    FROM
      public.contractions c
    WHERE
      c.user_id = v_inviter_id;

    -- Zählen der synchronisierten Wehen
    GET DIAGNOSTICS v_synced_count = ROW_COUNT;

    -- Erfolg zurückgeben
    RETURN jsonb_build_object(
      'success', true,
      'syncedFrom', jsonb_build_object(
        'userId', v_inviter_id,
        'firstName', v_inviter_name
      ),
      'contractionsCount', v_inviter_contractions_count,
      'syncedCount', v_synced_count
    );
  ELSE
    -- Wenn der Benutzer der Einladende ist, geben wir eine Erfolgsmeldung zurück
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Sie sind der Einladende. Ihre Wehen werden mit dem Eingeladenen synchronisiert.'
    );
  END IF;
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_contractions_from_inviter_to_invitee IS 'Synchronisiert die Wehen vom einladenden Benutzer zum eingeladenen Benutzer';

-- 2. Funktion zum Abrufen der Wehen mit Synchronisierungsinformationen
CREATE OR REPLACE FUNCTION public.get_contractions_with_sync_info(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_contractions jsonb;
  v_inviter_id UUID;
  v_invitee_id UUID;
  v_is_inviter BOOLEAN;
  v_sync_info jsonb;
  v_partner_name TEXT;
BEGIN
  -- Bestimmen, ob der Benutzer der Einladende oder der Eingeladene ist
  SELECT
    al.creator_id, al.invited_id
  INTO
    v_inviter_id, v_invitee_id
  FROM
    public.account_links al
  WHERE
    (al.creator_id = p_user_id OR al.invited_id = p_user_id)
    AND al.status = 'accepted'
  LIMIT 1;

  -- Wenn keine Verknüpfung gefunden wurde, nur die Wehen des Benutzers zurückgeben
  IF v_inviter_id IS NULL OR v_invitee_id IS NULL THEN
    -- Abrufen der Wehen des Benutzers
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'startTime', c.start_time,
          'endTime', c.end_time,
          'duration', c.duration,
          'intensity', c.intensity,
          'notes', c.notes
        )
      ) INTO v_contractions
    FROM
      public.contractions c
    WHERE
      c.user_id = p_user_id
    ORDER BY
      c.start_time DESC;

    -- Wenn keine Wehen gefunden wurden, leeres Array zurückgeben
    IF v_contractions IS NULL THEN
      v_contractions := '[]'::jsonb;
    END IF;

    -- Erfolg zurückgeben ohne Synchronisierungsinformationen
    RETURN jsonb_build_object(
      'success', true,
      'contractions', v_contractions,
      'syncInfo', NULL
    );
  END IF;

  -- Bestimmen, ob der Benutzer der Einladende ist
  v_is_inviter := (p_user_id = v_inviter_id);

  -- Abrufen des Namens des Partners
  IF v_is_inviter THEN
    SELECT
      first_name INTO v_partner_name
    FROM
      public.profiles
    WHERE
      id = v_invitee_id;
  ELSE
    SELECT
      first_name INTO v_partner_name
    FROM
      public.profiles
    WHERE
      id = v_inviter_id;
  END IF;

  -- Abrufen der Wehen des Benutzers
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'startTime', c.start_time,
        'endTime', c.end_time,
        'duration', c.duration,
        'intensity', c.intensity,
        'notes', c.notes
      )
    ) INTO v_contractions
  FROM
    public.contractions c
  WHERE
    c.user_id = p_user_id
  ORDER BY
    c.start_time DESC;

  -- Wenn keine Wehen gefunden wurden, leeres Array zurückgeben
  IF v_contractions IS NULL THEN
    v_contractions := '[]'::jsonb;
  END IF;

  -- Erstellen der Synchronisierungsinformationen
  v_sync_info := jsonb_build_object(
    'isInviter', v_is_inviter,
    'partnerName', v_partner_name,
    'partnerId', CASE WHEN v_is_inviter THEN v_invitee_id ELSE v_inviter_id END
  );

  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'contractions', v_contractions,
    'syncInfo', v_sync_info
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_contractions_with_sync_info IS 'Gibt die Wehen des Benutzers mit Synchronisierungsinformationen zurück';

-- 3. Funktion zum Hinzufügen einer Wehe und Synchronisieren mit dem Partner (in beide Richtungen)
CREATE OR REPLACE FUNCTION public.add_contraction_and_sync(
  p_user_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_duration INTEGER,
  p_intensity TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_contraction_id UUID;
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
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
BEGIN
  -- Hinzufügen der Wehe für den Benutzer
  INSERT INTO public.contractions (
    user_id,
    start_time,
    end_time,
    duration,
    intensity,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_start_time,
    p_end_time,
    p_duration,
    p_intensity,
    p_notes,
    NOW(),
    NOW()
  ) RETURNING id INTO v_contraction_id;

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

    -- Hinzufügen der Wehe für den verknüpften Benutzer
    INSERT INTO public.contractions (
      user_id,
      start_time,
      end_time,
      duration,
      intensity,
      notes,
      created_at,
      updated_at
    ) VALUES (
      v_linked_user_id,
      p_start_time,
      p_end_time,
      p_duration,
      p_intensity,
      p_notes,
      NOW(),
      NOW()
    );

    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;

  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'contractionId', v_contraction_id,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.add_contraction_and_sync IS 'Fügt eine Wehe hinzu und synchronisiert sie automatisch mit allen verknüpften Benutzern';

-- 4. Funktion zum Löschen einer Wehe und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.delete_contraction_and_sync(
  p_user_id UUID,
  p_contraction_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
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
  v_deleted_count INTEGER := 0;
  v_synced_count INTEGER := 0;
  v_linked_users jsonb := '[]'::jsonb;
BEGIN
  -- Abrufen der Startzeit der zu löschenden Wehe
  SELECT
    start_time INTO v_start_time
  FROM
    public.contractions
  WHERE
    id = p_contraction_id
    AND user_id = p_user_id;

  -- Wenn die Wehe nicht gefunden wurde, Fehler zurückgeben
  IF v_start_time IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wehe nicht gefunden oder Sie haben keine Berechtigung, sie zu löschen.'
    );
  END IF;

  -- Löschen der Wehe für den Benutzer
  DELETE FROM public.contractions
  WHERE id = p_contraction_id
    AND user_id = p_user_id;

  -- Zählen der gelöschten Wehen
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

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

    -- Löschen der Wehe für den verknüpften Benutzer basierend auf der Startzeit
    DELETE FROM public.contractions
    WHERE user_id = v_linked_user_id
      AND start_time = v_start_time;

    -- Zählen der synchronisierten Löschungen
    GET DIAGNOSTICS v_synced_count = v_synced_count + ROW_COUNT;
  END LOOP;
  CLOSE v_linked_users_cursor;

  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'deletedCount', v_deleted_count,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.delete_contraction_and_sync IS 'Löscht eine Wehe und synchronisiert die Löschung automatisch mit allen verknüpften Benutzern';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Synchronisierung der Wehen zwischen verknüpften Benutzern wurde implementiert.';
END
$$;
