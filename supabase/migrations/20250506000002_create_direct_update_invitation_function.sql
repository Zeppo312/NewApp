-- Erstellen einer RPC-Funktion für direktes SQL-Update von Einladungen
CREATE OR REPLACE FUNCTION direct_update_invitation(p_invitation_id UUID, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_result jsonb;
  v_invitation_exists boolean;
  v_is_own_invitation boolean;
  v_is_expired boolean;
  v_is_pending boolean;
BEGIN
  -- Prüfen, ob die Einladung existiert
  SELECT EXISTS(SELECT 1 FROM account_links WHERE id = p_invitation_id) INTO v_invitation_exists;
  
  IF NOT v_invitation_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Einladung nicht gefunden');
  END IF;
  
  -- Prüfen, ob der Benutzer versucht, seine eigene Einladung anzunehmen
  SELECT EXISTS(SELECT 1 FROM account_links WHERE id = p_invitation_id AND creator_id = p_user_id) 
  INTO v_is_own_invitation;
  
  IF v_is_own_invitation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sie können Ihre eigene Einladung nicht annehmen');
  END IF;
  
  -- Prüfen, ob die Einladung abgelaufen ist
  SELECT EXISTS(SELECT 1 FROM account_links WHERE id = p_invitation_id AND expires_at <= NOW()) 
  INTO v_is_expired;
  
  IF v_is_expired THEN
    RETURN jsonb_build_object('success', false, 'error', 'Diese Einladung ist abgelaufen');
  END IF;
  
  -- Prüfen, ob die Einladung noch ausstehend ist
  SELECT EXISTS(SELECT 1 FROM account_links WHERE id = p_invitation_id AND status = 'pending') 
  INTO v_is_pending;
  
  IF NOT v_is_pending THEN
    RETURN jsonb_build_object('success', false, 'error', 'Diese Einladung wurde bereits verwendet');
  END IF;
  
  -- Aktualisieren der Einladung mit direktem SQL
  UPDATE account_links
  SET 
    invited_id = p_user_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = p_invitation_id;
  
  -- Abrufen der aktualisierten Daten
  SELECT to_jsonb(account_links.*) INTO v_result
  FROM account_links
  WHERE id = p_invitation_id;
  
  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION direct_update_invitation IS 'Aktualisiert eine Einladung direkt mit SQL, umgeht RLS-Richtlinien';
