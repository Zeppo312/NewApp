-- Hinzufügen der theme und notifications_enabled Spalten zur user_settings-Tabelle
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

-- Kommentare zu den Spalten hinzufügen
COMMENT ON COLUMN user_settings.theme IS 'Speichert das vom Benutzer bevorzugte Theme (light/dark)';
COMMENT ON COLUMN user_settings.notifications_enabled IS 'Gibt an, ob Benachrichtigungen für den Benutzer aktiviert sind';
