-- Fügt external_id und synced_at Felder zur baby_sleep_tracking Tabelle hinzu
-- Damit können wir Einträge zwischen Benutzern synchronisieren und Duplikate vermeiden

-- Füge external_id hinzu, um die ID des Originaleintrags zu speichern
ALTER TABLE baby_sleep_tracking 
ADD COLUMN IF NOT EXISTS external_id UUID,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- Erstelle einen Index für die schnellere Suche nach external_id
CREATE INDEX IF NOT EXISTS idx_baby_sleep_tracking_external_id ON baby_sleep_tracking(external_id);

-- Entferne das shared_with_user_id Feld, da wir jetzt einen Kopieransatz verwenden
ALTER TABLE baby_sleep_tracking 
DROP COLUMN IF EXISTS shared_with_user_id;

-- Kommentar zur Durchführung
COMMENT ON TABLE baby_sleep_tracking IS 'Speichert Schlafeinträge. Wird zwischen verbundenen Benutzern synchronisiert durch Kopieren der Daten.'; 