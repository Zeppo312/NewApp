-- =====================================================
-- EINFACHE MIGRATION FÜR SCHLAFTRACKER-APP
-- =====================================================
-- 
-- Diese Migration fügt die notwendige Spalte "shared_with_user_id" zur Tabelle "sleep_entries" hinzu,
-- damit Sleep-Einträge zwischen Partnern geteilt werden können.
--
-- ANWENDUNG:
-- 1. Führe dieses SQL-Skript in der Supabase SQL Editor aus
-- 2. Vergewissere dich, dass die Spalte hinzugefügt wurde
-- 3. Starte die App neu und nutze die "Daten prüfen"-Funktion, um zu bestätigen, dass 
--    die Spalte existiert
--
-- ÜBERPRÜFUNG:
-- Nach Ausführung kannst du folgende SQL-Befehle ausführen, um zu prüfen, ob die Migration erfolgreich war:
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'sleep_entries'
--   AND column_name = 'shared_with_user_id';
--
-- FEHLERBEHANDLUNG:
-- Bei dem Fehler "trigger already exists" wurde der Trigger bereits erstellt
-- und die Migration kann trotzdem erfolgreich sein.

-- Sehr einfache Migration - Nur die notwendigste Spalte hinzufügen
-- Diese Migration kann einfach in Supabase SQL Editor kopiert und ausgeführt werden

-- Prüfen, ob die Spalte bereits existiert und hinzufügen, falls nicht
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sleep_entries'
      AND column_name = 'shared_with_user_id'
  ) THEN
    -- Spalte für geteilte Einträge hinzufügen
    ALTER TABLE sleep_entries ADD COLUMN shared_with_user_id UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Spalte shared_with_user_id wurde zur Tabelle sleep_entries hinzugefügt';
  ELSE
    RAISE NOTICE 'Spalte shared_with_user_id existiert bereits in der Tabelle sleep_entries';
  END IF;
END $$;

-- Funktion zum Teilen eines Schlafeintrags mit einem Partner
CREATE OR REPLACE FUNCTION share_sleep_entry(
  p_entry_id UUID,
  p_partner_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Benutzer-ID des aktuellen Benutzers abrufen
  SELECT auth.uid() INTO v_user_id;

  -- Sicherstellen, dass der Benutzer nicht mit sich selbst teilen kann
  IF v_user_id = p_partner_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Du kannst Einträge nicht mit dir selbst teilen'
    );
  END IF;
  
  -- Sicherstellen, dass der Partner existiert und mit dem Benutzer verknüpft ist
  IF NOT EXISTS (
    SELECT 1 FROM account_links 
    WHERE (creator_id = v_user_id AND invited_id = p_partner_id) 
       OR (creator_id = p_partner_id AND invited_id = v_user_id)
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Der Partner ist nicht mit dir verknüpft'
    );
  END IF;
  
  -- Sicherstellen, dass der Benutzer der Eigentümer des Eintrags ist
  IF NOT EXISTS (
    SELECT 1 FROM sleep_entries 
    WHERE id = p_entry_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Du bist nicht der Eigentümer dieses Eintrags'
    );
  END IF;
  
  -- Eintrag aktualisieren
  UPDATE sleep_entries
  SET shared_with_user_id = p_partner_id
  WHERE id = p_entry_id AND user_id = auth.uid();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Eintrag erfolgreich geteilt'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 