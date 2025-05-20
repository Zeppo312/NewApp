-- 1. Alte Tabelle und Funktionen entfernen
DROP FUNCTION IF EXISTS public.add_sleep_entry_and_sync(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.add_sleep_entry_and_sync(UUID, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS public.update_sleep_entry_and_sync(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_sleep_entry_and_sync(UUID, UUID);
DROP FUNCTION IF EXISTS public.sync_all_existing_sleep_entries(UUID);
DROP FUNCTION IF EXISTS public.get_linked_users_with_details(UUID);
DROP FUNCTION IF EXISTS public.debug_start_sleep(UUID);

-- Die alte Tabelle löschen (wenn vorhanden)
DROP TABLE IF EXISTS public.sleep_entries;

-- 2. Neu anfangen mit einer vereinfachten Tabelle
CREATE TABLE public.sleep_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  quality TEXT CHECK (quality IN ('good', 'medium', 'bad') OR quality IS NULL),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS-Policies erstellen
ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;

-- Benutzer können nur ihre eigenen Einträge sehen
CREATE POLICY "Users can view their own entries" 
  ON public.sleep_entries
  FOR SELECT 
  USING (user_id = auth.uid());

-- Benutzer können nur ihre eigenen Einträge einfügen
CREATE POLICY "Users can insert their own entries" 
  ON public.sleep_entries
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Benutzer können nur ihre eigenen Einträge aktualisieren
CREATE POLICY "Users can update only their own entries" 
  ON public.sleep_entries
  FOR UPDATE
  USING (user_id = auth.uid());

-- Benutzer können nur ihre eigenen Einträge löschen
CREATE POLICY "Users can delete only their own entries" 
  ON public.sleep_entries
  FOR DELETE
  USING (user_id = auth.uid());

-- 4. Trigger für updated_at erstellen
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sleep_entries_updated_at
BEFORE UPDATE ON public.sleep_entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Einfache Funktionen erstellen

-- Funktion zum Starten der Schlafaufzeichnung
CREATE OR REPLACE FUNCTION public.start_sleep_tracking(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_entry_id UUID;
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
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion zum Beenden der Schlafaufzeichnung
CREATE OR REPLACE FUNCTION public.stop_sleep_tracking(
  p_user_id UUID,
  p_entry_id UUID,
  p_quality TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_duration INTEGER;
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
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'duration_minutes', v_duration
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion zum Aktualisieren eines Schlafeintrags
CREATE OR REPLACE FUNCTION public.update_sleep_entry(
  p_user_id UUID,
  p_entry_id UUID,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_quality TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_duration INTEGER;
BEGIN
  -- Zuerst den aktuellen Eintrag holen
  SELECT * INTO v_record 
  FROM public.sleep_entries
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF v_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Schlafeintrag nicht gefunden'
    );
  END IF;
  
  -- Startzeit bestimmen
  IF p_start_time IS NULL THEN
    p_start_time := v_record.start_time;
  END IF;
  
  -- Endzeit bestimmen
  IF p_end_time IS NULL THEN
    p_end_time := v_record.end_time;
  END IF;
  
  -- Wenn wir eine Start- und Endzeit haben, Dauer berechnen
  IF p_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
    v_duration := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;
  END IF;
  
  -- Eintrag aktualisieren
  UPDATE public.sleep_entries
  SET 
    start_time = p_start_time,
    end_time = p_end_time,
    quality = COALESCE(p_quality, v_record.quality),
    notes = COALESCE(p_notes, v_record.notes),
    duration_minutes = COALESCE(v_duration, v_record.duration_minutes)
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion zum Löschen eines Schlafeintrags
CREATE OR REPLACE FUNCTION public.delete_sleep_entry(
  p_user_id UUID,
  p_entry_id UUID
) RETURNS JSONB AS $$
BEGIN
  DELETE FROM public.sleep_entries
  WHERE id = p_entry_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Schlafeintrag nicht gefunden'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indizes für schnellere Abfragen
CREATE INDEX idx_sleep_entries_user_id ON public.sleep_entries(user_id);
CREATE INDEX idx_sleep_entries_active ON public.sleep_entries(user_id) 
WHERE end_time IS NULL;

-- Kommentare zu den Funktionen
COMMENT ON FUNCTION public.start_sleep_tracking IS 'Startet eine neue Schlafaufzeichnung';
COMMENT ON FUNCTION public.stop_sleep_tracking IS 'Beendet eine laufende Schlafaufzeichnung';
COMMENT ON FUNCTION public.update_sleep_entry IS 'Aktualisiert einen Schlafeintrag';
COMMENT ON FUNCTION public.delete_sleep_entry IS 'Löscht einen Schlafeintrag'; 