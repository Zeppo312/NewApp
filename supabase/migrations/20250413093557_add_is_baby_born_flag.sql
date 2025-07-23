-- Hinzufügen des is_baby_born-Flags zur user_settings-Tabelle
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS is_baby_born BOOLEAN DEFAULT FALSE;
