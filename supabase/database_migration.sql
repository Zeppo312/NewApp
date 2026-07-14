-- Vereinfachte Migration für sleep_entries Tabelle 
-- Hinzufügen der shared_with_user_id Spalte (kann in Supabase SQL Editor ausgeführt werden)

-- Prüfen, ob die Spalte bereits existiert
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
    
    -- Index für bessere Abfrageleistung erstellen
    CREATE INDEX idx_sleep_entries_shared_with_user_id ON sleep_entries(shared_with_user_id);
    
    RAISE NOTICE 'Spalte shared_with_user_id wurde zur Tabelle sleep_entries hinzugefügt';
  ELSE
    RAISE NOTICE 'Spalte shared_with_user_id existiert bereits in der Tabelle sleep_entries';
  END IF;
END $$;

-- Trigger erstellen, der die Berechtigungen prüft
CREATE OR REPLACE FUNCTION check_sleep_entry_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Überprüfen, ob der Benutzer der Eigentümer ist oder ob der Eintrag mit ihm geteilt wurde
  IF NEW.user_id = auth.uid() OR NEW.shared_with_user_id = auth.uid() THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Keine Berechtigung zum Ändern dieses Schlafeintrags';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prüfen, ob der Trigger bereits existiert, und nur erstellen, wenn er noch nicht existiert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sleep_entry_permissions_trigger'
      AND tgrelid = 'sleep_entries'::regclass
  ) THEN
    -- Trigger für INSERT und UPDATE Operationen
    CREATE TRIGGER sleep_entry_permissions_trigger
    BEFORE UPDATE ON sleep_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_sleep_entry_permissions();
    
    RAISE NOTICE 'Trigger sleep_entry_permissions_trigger wurde erstellt';
  ELSE
    RAISE NOTICE 'Trigger sleep_entry_permissions_trigger existiert bereits';
  END IF;
END $$;

-- RPC-Funktion zum Teilen eines Schlafeintrags
CREATE OR REPLACE FUNCTION share_sleep_entry(
  p_entry_id UUID,
  p_partner_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Überprüfen, ob der aktuelle Benutzer der Eigentümer des Eintrags ist
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

-- RPC-Funktion zum Prüfen, ob eine Spalte in einer Tabelle existiert
CREATE OR REPLACE FUNCTION check_column_exists(
  p_table_name TEXT,
  p_column_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 