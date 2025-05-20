-- Erstelle die Tabelle für Babynamen-Favoriten
CREATE TABLE IF NOT EXISTS baby_names_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stelle sicher, dass jeder Benutzer jeden Namen nur einmal als Favorit haben kann
  CONSTRAINT unique_user_name UNIQUE (user_id, name)
);

-- Erstelle eine Row Level Security Policy, damit Benutzer nur ihre eigenen Favoriten sehen können
ALTER TABLE baby_names_favorites ENABLE ROW LEVEL SECURITY;

-- Policy für Lesen (SELECT)
CREATE POLICY "Users can view their own favorites" 
  ON baby_names_favorites 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy für Einfügen (INSERT)
CREATE POLICY "Users can add their own favorites" 
  ON baby_names_favorites 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy für Löschen (DELETE)
CREATE POLICY "Users can delete their own favorites" 
  ON baby_names_favorites 
  FOR DELETE 
  USING (auth.uid() = user_id);
