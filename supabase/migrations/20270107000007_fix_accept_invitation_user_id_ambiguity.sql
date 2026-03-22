-- Fix ambiguous user_id references in accept_invitation_and_sync_due_date.

DROP FUNCTION IF EXISTS public.accept_invitation_and_sync_due_date(UUID, UUID);

CREATE OR REPLACE FUNCTION public.accept_invitation_and_sync_due_date(
  invitation_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link_data jsonb;
  v_creator_id UUID;
  v_creator_info jsonb;
  v_creator_due_date TIMESTAMPTZ;
  v_creator_is_baby_born BOOLEAN;
  v_user_settings_exist BOOLEAN;
BEGIN
  -- Akzeptieren der Einladung mit der bestehenden Funktion
  SELECT * FROM public.accept_invitation(invitation_id, p_user_id) INTO v_link_data;

  -- Wenn die Einladung nicht akzeptiert werden konnte, Fehler zurückgeben
  IF NOT (v_link_data->>'success')::boolean THEN
    RETURN v_link_data;
  END IF;

  -- Abrufen der Creator-ID aus den zurückgegebenen Daten
  v_creator_id := (v_link_data->'data'->>'creator_id')::UUID;

  -- Abrufen der Profilinformationen des Erstellers
  SELECT
    jsonb_build_object(
      'userId', p.id,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'userRole', p.user_role
    ) INTO v_creator_info
  FROM
    public.profiles p
  WHERE
    p.id = v_creator_id;

  -- Abrufen des Entbindungstermins und des Baby-Status vom Ersteller
  SELECT
    due_date, is_baby_born INTO v_creator_due_date, v_creator_is_baby_born
  FROM
    public.user_settings
  WHERE
    user_id = v_creator_id;

  -- Prüfen, ob der eingeladene Benutzer bereits Einstellungen hat
  SELECT
    EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) INTO v_user_settings_exist;

  -- Wenn der Ersteller einen Entbindungstermin hat, diesen mit dem eingeladenen Benutzer synchronisieren
  IF v_creator_due_date IS NOT NULL THEN
    IF v_user_settings_exist THEN
      -- Aktualisieren der bestehenden Einstellungen
      UPDATE public.user_settings
      SET
        due_date = v_creator_due_date,
        is_baby_born = v_creator_is_baby_born,
        updated_at = NOW()
      WHERE
        user_id = p_user_id;
    ELSE
      -- Erstellen neuer Einstellungen
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

    -- Protokollieren der Synchronisierung
    RAISE NOTICE 'Synchronized due date % and baby status % from user % to user %',
      v_creator_due_date, v_creator_is_baby_born, v_creator_id, p_user_id;
  END IF;

  -- Erfolg mit Benutzerinformationen und synchronisierten Daten zurückgeben
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
