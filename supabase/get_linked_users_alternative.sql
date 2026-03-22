-- Alternative Funktion zum Abrufen verbundener Benutzer
-- Diese Funktion umgeht mögliche Berechtigungsprobleme der ursprünglichen RPC-Funktion

CREATE OR REPLACE FUNCTION get_linked_users_alternative(p_user_id UUID)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Mit Rechten des Erstellers ausführen
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jsonb_build_object(
      'userId', CASE
                 WHEN al.creator_id = p_user_id THEN al.invited_id
                 ELSE al.creator_id
               END,
      'displayName', COALESCE(p.display_name, 'Unbekannter Benutzer'),
      'linkRole', CASE
                   WHEN al.creator_id = p_user_id THEN 'creator'
                   ELSE 'invited'
                 END
    )
  FROM account_links al
  LEFT JOIN profiles p ON (
    CASE
      WHEN al.creator_id = p_user_id THEN p.id = al.invited_id
      ELSE p.id = al.creator_id
    END
  )
  WHERE (al.creator_id = p_user_id OR al.invited_id = p_user_id)
    AND al.status = 'accepted';
END;
$$;

-- Beispiel für die Verwendung:
-- SELECT * FROM get_linked_users_alternative('deine-user-id-hier');

-- Um die Berechtigungen für alle Benutzer zu erteilen:
GRANT EXECUTE ON FUNCTION get_linked_users_alternative(UUID) TO authenticated; 