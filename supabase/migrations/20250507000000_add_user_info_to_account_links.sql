-- Skript zur Erweiterung der account_links-Funktionalität um Benutzerinformationen
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Funktion zum Abrufen von verknüpften Benutzern mit Profilinformationen
CREATE OR REPLACE FUNCTION public.get_linked_users_with_info(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Abrufen aller akzeptierten Verknüpfungen, bei denen der Benutzer beteiligt ist
  WITH user_links AS (
    SELECT
      al.id AS link_id,
      al.creator_id,
      al.invited_id,
      al.relationship_type,
      al.status,
      al.created_at,
      al.accepted_at,
      -- Bestimmen, welcher Benutzer der andere ist
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS other_user_id
    FROM
      public.account_links al
    WHERE
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted'
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'linkId', ul.link_id,
        'userId', ul.other_user_id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role,
        'relationshipType', ul.relationship_type,
        'createdAt', ul.created_at,
        'acceptedAt', ul.accepted_at
      )
    ) INTO v_result
  FROM
    user_links ul
  LEFT JOIN
    public.profiles p ON ul.other_user_id = p.id;
  
  -- Wenn keine Verknüpfungen gefunden wurden, leeres Array zurückgeben
  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'linkedUsers', jsonb_build_array());
  END IF;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'linkedUsers', v_result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_linked_users_with_info IS 'Gibt alle verknüpften Benutzer mit Profilinformationen zurück';

-- 2. Funktion zum Akzeptieren einer Einladung mit Rückgabe von Benutzerinformationen
CREATE OR REPLACE FUNCTION public.accept_invitation_with_info(invitation_id UUID, user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_link_data jsonb;
  v_creator_id UUID;
  v_creator_info jsonb;
BEGIN
  -- Akzeptieren der Einladung mit der bestehenden Funktion
  SELECT * FROM public.accept_invitation(invitation_id, user_id) INTO v_link_data;
  
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
  
  -- Erfolg mit Benutzerinformationen zurückgeben
  RETURN jsonb_build_object(
    'success', true, 
    'linkData', v_link_data->'data',
    'creatorInfo', v_creator_info
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.accept_invitation_with_info IS 'Akzeptiert eine Einladung und gibt Informationen über den Ersteller zurück';

-- 3. Funktion zum Einlösen eines Einladungscodes mit Rückgabe von Benutzerinformationen
CREATE OR REPLACE FUNCTION public.redeem_invitation_by_code_with_info(p_invitation_code TEXT, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_link_data jsonb;
  v_creator_id UUID;
  v_creator_info jsonb;
BEGIN
  -- Einlösen des Codes mit der bestehenden Funktion
  SELECT * FROM public.redeem_invitation_by_code(p_invitation_code, p_user_id) INTO v_link_data;
  
  -- Wenn der Code nicht eingelöst werden konnte, Fehler zurückgeben
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
  
  -- Erfolg mit Benutzerinformationen zurückgeben
  RETURN jsonb_build_object(
    'success', true, 
    'linkData', v_link_data->'data',
    'creatorInfo', v_creator_info
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.redeem_invitation_by_code_with_info IS 'Löst einen Einladungscode ein und gibt Informationen über den Ersteller zurück';

-- 4. Funktion zum Abrufen aller Einladungen mit Benutzerinformationen
CREATE OR REPLACE FUNCTION public.get_user_invitations_with_info(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Abrufen aller Einladungen des Benutzers mit Profilinformationen
  WITH user_invitations AS (
    SELECT
      al.*,
      -- Wenn der Benutzer der Ersteller ist, dann ist der andere Benutzer der Eingeladene
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS other_user_id
    FROM
      public.account_links al
    WHERE
      al.creator_id = p_user_id OR al.invited_id = p_user_id
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', ui.id,
        'creatorId', ui.creator_id,
        'invitedId', ui.invited_id,
        'invitationCode', ui.invitation_code,
        'status', ui.status,
        'createdAt', ui.created_at,
        'expiresAt', ui.expires_at,
        'acceptedAt', ui.accepted_at,
        'relationshipType', ui.relationship_type,
        'otherUserInfo', CASE
          WHEN ui.other_user_id IS NOT NULL THEN
            jsonb_build_object(
              'userId', p.id,
              'firstName', p.first_name,
              'lastName', p.last_name,
              'userRole', p.user_role
            )
          ELSE NULL
        END
      )
    ) INTO v_result
  FROM
    user_invitations ui
  LEFT JOIN
    public.profiles p ON ui.other_user_id = p.id;
  
  -- Wenn keine Einladungen gefunden wurden, leeres Array zurückgeben
  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'invitations', jsonb_build_array());
  END IF;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'invitations', v_result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.get_user_invitations_with_info IS 'Gibt alle Einladungen des Benutzers mit Profilinformationen zurück';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die Funktionen für account_links wurden um Benutzerinformationen erweitert.';
END
$$;
