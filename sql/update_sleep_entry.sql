-- Funktion zum Aktualisieren eines Schlafeintrags
-- Diese Funktion erlaubt es einem Benutzer, einen Schlafeintrag zu aktualisieren,
-- auch wenn er nur über shared_with_user_id Zugriff darauf hat

CREATE OR REPLACE FUNCTION public.update_sleep_entry(
  p_entry_id UUID,
  p_end_time TIMESTAMP WITH TIME ZONE,
  p_duration_minutes INTEGER,
  p_notes TEXT,
  p_quality TEXT
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  affected_rows INT;
  current_user_id UUID;
  result json;
  entry_exists BOOLEAN;
BEGIN
  -- Aktueller Benutzer
  current_user_id := auth.uid();
  
  -- Prüfen, ob der Eintrag existiert und der aktuelle Benutzer Zugriff hat
  SELECT EXISTS (
    SELECT 1 FROM baby_sleep_tracking
    WHERE id = p_entry_id
      AND (user_id = current_user_id OR shared_with_user_id = current_user_id)
  ) INTO entry_exists;
  
  IF NOT entry_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Der Eintrag existiert nicht oder du hast keinen Zugriff darauf'
    );
  END IF;
  
  -- Eintrag aktualisieren
  UPDATE baby_sleep_tracking
  SET 
    end_time = p_end_time,
    duration_minutes = p_duration_minutes,
    notes = p_notes,
    quality = p_quality,
    updated_at = NOW()
  WHERE id = p_entry_id
    AND (user_id = current_user_id OR shared_with_user_id = current_user_id);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  result := json_build_object(
    'success', affected_rows > 0,
    'affected_rows', affected_rows,
    'message', CASE 
                WHEN affected_rows > 0 THEN 'Schlafeintrag wurde erfolgreich aktualisiert'
                ELSE 'Schlafeintrag konnte nicht aktualisiert werden'
               END
  );
  
  RETURN result;
END;
$$; 