-- Hinzufügen des baby_gender-Felds zur baby_info-Tabelle, falls es noch nicht existiert
ALTER TABLE baby_info ADD COLUMN IF NOT EXISTS baby_gender TEXT;
