-- Funktion zum Teilen von Schlafdaten zwischen verbundenen Benutzern
-- Diese Funktion setzt das shared_with_user_id-Feld, damit beide Benutzer
-- auf die gleichen Daten zugreifen können

CREATE OR REPLACE FUNCTION public.share_sleep_data(main_user_id UUID, shared_user_id UUID)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  affected_rows INT;
  result json;
BEGIN
  -- Füge zuerst die shared_with_user_id-Spalte hinzu, falls sie noch nicht existiert
  BEGIN
    ALTER TABLE baby_sleep_tracking ADD COLUMN IF NOT EXISTS shared_with_user_id UUID REFERENCES auth.users(id);
    -- Füge einen Index hinzu, um die Leistung zu verbessern
    CREATE INDEX IF NOT EXISTS idx_baby_sleep_tracking_shared_with ON baby_sleep_tracking(shared_with_user_id);
  EXCEPTION WHEN OTHERS THEN
    -- Fehler ignorieren, wenn die Spalte bereits existiert
    NULL;
  END;

  -- Aktualisiere die Schlafdaten des Hauptbenutzers, um sie mit dem eingeladenen Benutzer zu teilen
  UPDATE baby_sleep_tracking
  SET shared_with_user_id = shared_user_id
  WHERE user_id = main_user_id
    AND (shared_with_user_id IS NULL OR shared_with_user_id != shared_user_id);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  result := json_build_object(
    'success', true,
    'affected_rows', affected_rows,
    'message', 'Schlafdaten wurden erfolgreich geteilt'
  );
  
  RETURN result;
END;
$$; 