-- Aktualisierung der Geburtsplan-Tabelle, um strukturierte Daten zu unterstützen
ALTER TABLE geburtsplan ADD COLUMN IF NOT EXISTS structured_data JSONB;
