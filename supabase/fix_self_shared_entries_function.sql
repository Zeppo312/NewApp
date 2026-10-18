-- Funktion erstellen, die mit SECURITY DEFINER die Berechtigungsprüfung umgeht
CREATE OR REPLACE FUNCTION fix_self_shared_entries()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fixed BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Diese Funktion läuft mit den Rechten des Erstellers
AS $$
DECLARE
  fixed_count INT := 0;
BEGIN
  -- Finde und korrigiere selbst-geteilte Einträge
  RETURN QUERY
  WITH updated_entries AS (
    UPDATE sleep_entries
    SET shared_with_user_id = NULL
    WHERE user_id = shared_with_user_id
      AND shared_with_user_id IS NOT NULL
    RETURNING id, user_id
  )
  SELECT 
    ue.id,
    ue.user_id,
    TRUE AS fixed
  FROM updated_entries ue;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  IF fixed_count = 0 THEN
    RAISE NOTICE 'Keine selbst-geteilten Einträge gefunden.';
  ELSE
    RAISE NOTICE '% selbst-geteilte Einträge wurden korrigiert.', fixed_count;
  END IF;
END;
$$;

-- Funktion mit Admin-Rechten ausführen
SELECT * FROM fix_self_shared_entries();

-- Optional: Funktion nach Verwendung wieder löschen
-- DROP FUNCTION fix_self_shared_entries(); 