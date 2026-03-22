-- Erstelle die lotti_recommendations Tabelle
CREATE TABLE IF NOT EXISTS public.lotti_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  product_link TEXT NOT NULL,
  discount_code TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Erstelle Admin-Flag in der profiles Tabelle falls noch nicht vorhanden
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_recommendations_order ON public.lotti_recommendations(order_index);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON public.lotti_recommendations(created_at DESC);

-- RLS Policies aktivieren
ALTER TABLE public.lotti_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder authentifizierte User kann Empfehlungen lesen
CREATE POLICY "Jeder kann Empfehlungen sehen"
  ON public.lotti_recommendations
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Nur Admins können Empfehlungen erstellen
CREATE POLICY "Nur Admins können Empfehlungen erstellen"
  ON public.lotti_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Nur Admins können Empfehlungen aktualisieren
CREATE POLICY "Nur Admins können Empfehlungen aktualisieren"
  ON public.lotti_recommendations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Nur Admins können Empfehlungen löschen
CREATE POLICY "Nur Admins können Empfehlungen löschen"
  ON public.lotti_recommendations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Funktion zum automatischen Aktualisieren von updated_at
CREATE OR REPLACE FUNCTION update_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für updated_at
DROP TRIGGER IF EXISTS set_recommendations_updated_at ON public.lotti_recommendations;
CREATE TRIGGER set_recommendations_updated_at
  BEFORE UPDATE ON public.lotti_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendations_updated_at();

-- Kommentar für Dokumentation
COMMENT ON TABLE public.lotti_recommendations IS 'Speichert Produktempfehlungen von Lotti, die von Admins verwaltet werden';
COMMENT ON COLUMN public.profiles.is_admin IS 'Flag für Admin-Berechtigungen zum Verwalten von Empfehlungen';

