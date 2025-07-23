-- Neues Skript für die Einrichtung der Schlafdaten-Tabelle
-- Einfacheres Design: Jeder Benutzer hat seine eigenen Einträge

-- Erstelle die Haupttabelle für Schlafeinträge
CREATE TABLE IF NOT EXISTS public.sleep_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  notes TEXT,
  quality TEXT CHECK (quality IN ('good', 'medium', 'bad')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Erstelle einen Index für schnellere Abfragen nach Benutzer-ID
CREATE INDEX IF NOT EXISTS sleep_entries_user_id_idx ON sleep_entries(user_id);

-- Trigger für automatische Aktualisierung des updated_at Felds
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger hinzufügen
DROP TRIGGER IF EXISTS update_sleep_entries_modtime ON sleep_entries;
CREATE TRIGGER update_sleep_entries_modtime
BEFORE UPDATE ON sleep_entries
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Row Level Security aktivieren
ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;

-- RLS-Richtlinien erstellen
CREATE POLICY "Benutzer können ihre eigenen Schlafeinträge lesen"
  ON public.sleep_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können ihre eigenen Schlafeinträge erstellen"
  ON public.sleep_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Benutzer können ihre eigenen Schlafeinträge aktualisieren"
  ON public.sleep_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Benutzer können ihre eigenen Schlafeinträge löschen"
  ON public.sleep_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Informationsmeldung
DO $$ 
BEGIN
  RAISE NOTICE 'Schlafdaten-Tabelle und zugehörige Objekte wurden erfolgreich erstellt.';
END $$; 