-- Erstelle eine Tabelle für die Push-Tokens
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique-Constraint für die Kombination aus user_id und token
  CONSTRAINT unique_user_token UNIQUE (user_id, token)
);

-- RLS aktivieren
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS-Richtlinien
-- Nur der Besitzer des Tokens kann es sehen
CREATE POLICY user_read_own_tokens ON user_push_tokens
  FOR SELECT USING (auth.uid() = user_id);
  
-- Nur der Besitzer kann seine Tokens hinzufügen
CREATE POLICY user_insert_own_tokens ON user_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
-- Nur der Besitzer kann seine Tokens löschen
CREATE POLICY user_delete_own_tokens ON user_push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Funktion zum Senden von Push-Benachrichtigungen
-- Wenn eine neue Benachrichtigung erstellt wird, rufe diese Funktion auf
CREATE OR REPLACE FUNCTION send_push_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Für Push-Benachrichtigungen später implementieren
  -- Hier würde ein externer Webhook oder Serverless-Funktion aufgerufen werden
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger, der die Funktion bei neuen Benachrichtigungen aufruft
CREATE TRIGGER on_new_notification
AFTER INSERT ON community_notifications
FOR EACH ROW
EXECUTE FUNCTION send_push_notification(); 