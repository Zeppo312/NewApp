-- Aktiviere Row Level Security für die sleep_entries-Tabelle
ALTER TABLE sleep_entries ENABLE ROW LEVEL SECURITY;

-- Deaktiviere alle bestehenden Policies für sleep_entries
DROP POLICY IF EXISTS read_own_or_shared ON sleep_entries;
DROP POLICY IF EXISTS select_sleep_entries ON sleep_entries;
DROP POLICY IF EXISTS insert_own_entries ON sleep_entries;
DROP POLICY IF EXISTS insert_sleep_entries ON sleep_entries;
DROP POLICY IF EXISTS update_own_entries ON sleep_entries;
DROP POLICY IF EXISTS update_sleep_entries ON sleep_entries;
DROP POLICY IF EXISTS delete_own_entries ON sleep_entries;
DROP POLICY IF EXISTS delete_sleep_entries ON sleep_entries;

-- Erstelle eine generelle Read-Policy, die eigene und geteilte Einträge anzeigt
CREATE POLICY read_own_or_shared
  ON sleep_entries
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = shared_with_user_id
  );

-- Policy zum Einfügen eigener Einträge
CREATE POLICY insert_own_entries
  ON sleep_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy zum Aktualisieren eigener Einträge
CREATE POLICY update_own_entries
  ON sleep_entries
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
  );

-- Policy zum Löschen eigener Einträge
CREATE POLICY delete_own_entries
  ON sleep_entries
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
  );

-- Kommentar zur Erklärung
COMMENT ON TABLE sleep_entries IS 'Tabelle für Schlafeinträge mit Sharing-Funktionalität zwischen verknüpften Benutzern'; 