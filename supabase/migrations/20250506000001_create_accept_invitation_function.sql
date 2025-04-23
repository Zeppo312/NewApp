-- Erstellen einer RPC-Funktion zum Akzeptieren von Einladungen
CREATE OR REPLACE FUNCTION accept_invitation(invitation_id UUID, user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Prüfen, ob die Einladung existiert und gültig ist
  IF NOT EXISTS (
    SELECT 1 FROM account_links 
    WHERE id = invitation_id 
    AND status = 'pending' 
    AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Einladung nicht gefunden oder ungültig');
  END IF;
  
  -- Prüfen, ob der Benutzer versucht, seine eigene Einladung anzunehmen
  IF EXISTS (
    SELECT 1 FROM account_links 
    WHERE id = invitation_id 
    AND creator_id = user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sie können Ihre eigene Einladung nicht annehmen');
  END IF;
  
  -- Aktualisieren der Einladung
  UPDATE account_links
  SET 
    invited_id = user_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = invitation_id
  RETURNING to_jsonb(account_links.*) INTO result;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'data', result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION accept_invitation IS 'Akzeptiert eine Einladung und setzt den eingeladenen Benutzer, umgeht RLS-Richtlinien';
