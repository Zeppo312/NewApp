-- Anpassung der RLS-Policies, um Teilen von Schlafeinträgen zu ermöglichen
DROP POLICY IF EXISTS "Users can view their own entries" ON public.sleep_entries;

-- Neue Policy: Benutzer können ihre eigenen Einträge UND Einträge von verknüpften Benutzern sehen
CREATE POLICY "Users can view their own and linked users entries" 
  ON public.sleep_entries
  FOR SELECT 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.account_links
      WHERE (
        (creator_id = auth.uid() AND invited_id = user_id) OR
        (invited_id = auth.uid() AND creator_id = user_id)
      )
      AND status = 'accepted'
    )
  );

-- Funktion zum Abrufen verknüpfter Benutzer aktualisieren
CREATE OR REPLACE FUNCTION public.get_linked_users(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_linked_users JSONB;
BEGIN
  -- Verknüpfte Benutzer mit Details holen
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', CASE 
        WHEN creator_id = p_user_id THEN invited_id
        ELSE creator_id
      END,
      'displayName', profiles.display_name,
      'linkRole', CASE 
        WHEN creator_id = p_user_id THEN 'creator'
        ELSE 'invited'
      END
    )
  )
  INTO v_linked_users
  FROM public.account_links
  JOIN public.profiles ON (
    CASE 
      WHEN creator_id = p_user_id THEN profiles.id = invited_id
      ELSE profiles.id = creator_id
    END
  )
  WHERE (creator_id = p_user_id OR invited_id = p_user_id)
  AND status = 'accepted';

  RETURN COALESCE(v_linked_users, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modifiziere die start_sleep_tracking Funktion, um Infos über verknüpfte Benutzer zurückzugeben
CREATE OR REPLACE FUNCTION public.start_sleep_tracking(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_entry_id UUID;
  v_linked_users JSONB;
BEGIN
  -- Einfach in die Tabelle einfügen
  INSERT INTO public.sleep_entries (
    user_id,
    start_time
  )
  VALUES (
    p_user_id,
    now()
  )
  RETURNING id INTO v_entry_id;
  
  -- Verknüpfte Benutzer holen
  SELECT public.get_linked_users(p_user_id) INTO v_linked_users;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'linkedUsers', v_linked_users
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modifiziere die stop_sleep_tracking Funktion, um Infos über verknüpfte Benutzer zurückzugeben
CREATE OR REPLACE FUNCTION public.stop_sleep_tracking(
  p_user_id UUID,
  p_entry_id UUID,
  p_quality TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_duration INTEGER;
  v_linked_users JSONB;
BEGIN
  -- Zuerst die Startzeit holen
  SELECT * INTO v_record 
  FROM public.sleep_entries
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF v_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Schlafeintrag nicht gefunden'
    );
  END IF;
  
  -- Dauer berechnen
  v_duration := EXTRACT(EPOCH FROM (now() - v_record.start_time)) / 60;
  
  -- Eintrag aktualisieren
  UPDATE public.sleep_entries
  SET 
    end_time = now(),
    quality = p_quality,
    notes = p_notes,
    duration_minutes = v_duration
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  -- Verknüpfte Benutzer holen
  SELECT public.get_linked_users(p_user_id) INTO v_linked_users;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'duration_minutes', v_duration,
    'linkedUsers', v_linked_users
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kommentare zu den Funktionen
COMMENT ON FUNCTION public.get_linked_users IS 'Ruft verknüpfte Benutzer mit Details ab';

-- Fix für die loadSleepEntries Funktion - Spezielle Funktion ohne end_time Filter
CREATE OR REPLACE FUNCTION public.get_all_sleep_entries(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_entries JSONB;
  v_linked_users JSONB;
BEGIN
  -- Alle Schlafeinträge des Benutzers und verknüpfter Benutzer holen
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', se.id,
      'user_id', se.user_id,
      'start_time', se.start_time,
      'end_time', se.end_time,
      'duration_minutes', se.duration_minutes,
      'quality', se.quality,
      'notes', se.notes,
      'created_at', se.created_at,
      'updated_at', se.updated_at,
      'owner_name', p.display_name
    )
    ORDER BY se.start_time DESC
  )
  INTO v_entries
  FROM public.sleep_entries se
  JOIN public.profiles p ON se.user_id = p.id
  WHERE se.user_id = p_user_id
     OR EXISTS (
       SELECT 1 FROM public.account_links
       WHERE (
         (creator_id = p_user_id AND invited_id = se.user_id) OR
         (invited_id = p_user_id AND creator_id = se.user_id)
       )
       AND status = 'accepted'
     );
  
  -- Verknüpfte Benutzer holen
  SELECT public.get_linked_users(p_user_id) INTO v_linked_users;
  
  RETURN jsonb_build_object(
    'success', true,
    'entries', COALESCE(v_entries, '[]'::jsonb),
    'linkedUsers', v_linked_users
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_all_sleep_entries IS 'Ruft alle Schlafeinträge des Benutzers und verknüpfter Benutzer ab'; 