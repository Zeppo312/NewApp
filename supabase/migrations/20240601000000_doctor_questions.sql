-- Erstellen der Tabelle für Frauenarzt-Fragen
CREATE TABLE IF NOT EXISTS public.doctor_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_answered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Volltextsuche
  CONSTRAINT question_not_empty CHECK (length(trim(question)) > 0)
);

-- Berechtigungen
ALTER TABLE public.doctor_questions ENABLE ROW LEVEL SECURITY;

-- Richtlinien
CREATE POLICY "Nutzer können nur ihre eigenen Fragen sehen" 
  ON public.doctor_questions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Nutzer können nur ihre eigenen Fragen erstellen" 
  ON public.doctor_questions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nutzer können nur ihre eigenen Fragen aktualisieren" 
  ON public.doctor_questions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Nutzer können nur ihre eigenen Fragen löschen" 
  ON public.doctor_questions FOR DELETE 
  USING (auth.uid() = user_id);

-- Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS doctor_questions_user_id_idx ON public.doctor_questions (user_id);
