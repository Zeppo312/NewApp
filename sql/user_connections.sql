-- Tabelle für Benutzerverbindungen erstellen
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stellt sicher, dass ein Benutzer nicht mehrmals den gleichen Benutzer einladen kann
  UNIQUE (inviter_id, invited_id)
);

-- Zugriffsberechtigungen festlegen
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

-- Richtlinien für Tabellenoperationen festlegen
CREATE POLICY "Einladender kann eigene Einladungen sehen" 
  ON user_connections FOR SELECT 
  USING (auth.uid() = inviter_id);

CREATE POLICY "Eingeladener kann an ihn gerichtete Einladungen sehen" 
  ON user_connections FOR SELECT 
  USING (auth.uid() = invited_id);

CREATE POLICY "Einladender kann Einladungen erstellen" 
  ON user_connections FOR INSERT 
  WITH CHECK (auth.uid() = inviter_id);

-- Korrigierte Policy für das Aktualisieren des Einladungsstatus
CREATE POLICY "Eingeladener kann Einladungsstatus aktualisieren" 
  ON user_connections FOR UPDATE 
  USING (auth.uid() = invited_id AND status = 'pending')
  WITH CHECK (auth.uid() = invited_id AND status <> 'pending');

-- Erweiterung für die baby_sleep_tracking Tabelle, um Synchronisierungsinformationen zu speichern
ALTER TABLE baby_sleep_tracking 
  ADD COLUMN IF NOT EXISTS synced_from UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- Trigger für automatische Aktualisierung von updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_connections_updated_at
BEFORE UPDATE ON user_connections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 