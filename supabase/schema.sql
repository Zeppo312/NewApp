-- Erstellen der Tabelle für Wehen
CREATE TABLE IF NOT EXISTS public.contractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- in seconds
  interval INTEGER, -- time since last contraction in seconds
  intensity TEXT, -- Intensität der Wehe (schwach, mittel, stark)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Validierung
  CONSTRAINT duration_positive CHECK (duration IS NULL OR duration >= 0),
  CONSTRAINT interval_positive CHECK (interval IS NULL OR interval >= 0),
  CONSTRAINT end_time_after_start_time CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Indizes für schnellere Abfragen
CREATE INDEX IF NOT EXISTS contractions_user_id_idx ON public.contractions(user_id);
CREATE INDEX IF NOT EXISTS contractions_start_time_idx ON public.contractions(start_time);

-- Row Level Security (RLS) aktivieren
ALTER TABLE public.contractions ENABLE ROW LEVEL SECURITY;

-- Richtlinien für Row Level Security
-- Benutzer können nur ihre eigenen Wehen sehen
CREATE POLICY "Users can view their own contractions"
  ON public.contractions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Wehen einfügen
CREATE POLICY "Users can insert their own contractions"
  ON public.contractions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Wehen aktualisieren
CREATE POLICY "Users can update their own contractions"
  ON public.contractions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Wehen löschen
CREATE POLICY "Users can delete their own contractions"
  ON public.contractions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Erstellen einer Funktion, um die neuesten Wehen eines Benutzers abzurufen
CREATE OR REPLACE FUNCTION public.get_recent_contractions(limit_count INTEGER DEFAULT 10)
RETURNS SETOF public.contractions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.contractions
  WHERE user_id = auth.uid()
  ORDER BY start_time DESC
  LIMIT limit_count;
$$;

-- Erstellen der Tabelle für die Krankenhaus-Checkliste
CREATE TABLE IF NOT EXISTS public.hospital_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  is_checked BOOLEAN DEFAULT false,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  position INTEGER DEFAULT 0
);

-- Indizes für schnellere Abfragen
CREATE INDEX IF NOT EXISTS hospital_checklist_user_id_idx ON public.hospital_checklist(user_id);
CREATE INDEX IF NOT EXISTS hospital_checklist_category_idx ON public.hospital_checklist(category);

-- Row Level Security (RLS) aktivieren
ALTER TABLE public.hospital_checklist ENABLE ROW LEVEL SECURITY;

-- Richtlinien für Row Level Security
-- Benutzer können nur ihre eigenen Checklisten-Einträge sehen
CREATE POLICY "Users can view their own checklist items"
  ON public.hospital_checklist
  FOR SELECT
  USING (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Checklisten-Einträge einfügen
CREATE POLICY "Users can insert their own checklist items"
  ON public.hospital_checklist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Checklisten-Einträge aktualisieren
CREATE POLICY "Users can update their own checklist items"
  ON public.hospital_checklist
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Checklisten-Einträge löschen
CREATE POLICY "Users can delete their own checklist items"
  ON public.hospital_checklist
  FOR DELETE
  USING (auth.uid() = user_id);

-- Erstellen einer Funktion, um die Checklisten-Einträge eines Benutzers abzurufen
CREATE OR REPLACE FUNCTION public.get_hospital_checklist()
RETURNS SETOF public.hospital_checklist
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.hospital_checklist
  WHERE user_id = auth.uid()
  ORDER BY position ASC, created_at ASC;
$$;

-- Trigger für die Aktualisierung des updated_at-Felds
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hospital_checklist_updated_at
BEFORE UPDATE ON public.hospital_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
