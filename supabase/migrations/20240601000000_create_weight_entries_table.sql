-- Erstellen der Tabelle für Gewichtsdaten
CREATE TABLE IF NOT EXISTS public.weight_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight DECIMAL(5, 2) NOT NULL, -- Gewicht in kg mit 2 Dezimalstellen
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

  -- Validierung
  CONSTRAINT weight_positive CHECK (weight > 0),
  
  -- Unique constraint für Benutzer und Datum
  UNIQUE(user_id, date)
);

-- Berechtigungen für authentifizierte Benutzer
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

-- Richtlinie für das Einfügen von Gewichtsdaten
CREATE POLICY "Users can insert their own weight entries" 
  ON public.weight_entries 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Richtlinie für das Lesen von Gewichtsdaten
CREATE POLICY "Users can view their own weight entries" 
  ON public.weight_entries 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Richtlinie für das Aktualisieren von Gewichtsdaten
CREATE POLICY "Users can update their own weight entries" 
  ON public.weight_entries 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Richtlinie für das Löschen von Gewichtsdaten
CREATE POLICY "Users can delete their own weight entries" 
  ON public.weight_entries 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Index für schnellere Abfragen
CREATE INDEX weight_entries_user_id_date_idx ON public.weight_entries (user_id, date);
