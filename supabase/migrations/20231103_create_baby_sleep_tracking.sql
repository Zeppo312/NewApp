-- Erstelle die Tabelle für das Baby-Schlaftracking
CREATE TABLE IF NOT EXISTS baby_sleep_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  quality TEXT CHECK (quality IN ('good', 'medium', 'bad')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Erstelle einen Index für schnellere Abfragen nach Benutzer-ID
CREATE INDEX IF NOT EXISTS baby_sleep_tracking_user_id_idx ON baby_sleep_tracking(user_id);

-- Aktiviere Row-Level-Security
ALTER TABLE baby_sleep_tracking ENABLE ROW LEVEL SECURITY;

-- Berechtigungsrichtlinien für RLS
CREATE POLICY "Nutzer können nur ihre eigenen Schlafeinträge lesen" 
  ON baby_sleep_tracking FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Nutzer können nur ihre eigenen Schlafeinträge erstellen" 
  ON baby_sleep_tracking FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nutzer können nur ihre eigenen Schlafeinträge aktualisieren" 
  ON baby_sleep_tracking FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Nutzer können nur ihre eigenen Schlafeinträge löschen" 
  ON baby_sleep_tracking FOR DELETE 
  USING (auth.uid() = user_id);

-- Erstelle einen Trigger, um updated_at automatisch zu aktualisieren
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_baby_sleep_tracking_updated_at
BEFORE UPDATE ON baby_sleep_tracking
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 