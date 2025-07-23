-- Erstelle eine Tabelle für direkte Nachrichten zwischen Benutzern
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  
  -- Optional: Metadata-Felder für Medien, Anhänge, etc.
  metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS aktivieren
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS-Richtlinien
-- Benutzer können nur ihre eigenen gesendeten oder empfangenen Nachrichten sehen
CREATE POLICY direct_messages_select_policy 
  ON direct_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Benutzer können nur Nachrichten senden (nicht im Namen anderer)
CREATE POLICY direct_messages_insert_policy 
  ON direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

-- Nur Empfänger können Nachrichten als gelesen markieren
CREATE POLICY direct_messages_update_policy 
  ON direct_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
  );

-- Benutzer können ihre gesendeten Nachrichten löschen (optional)
CREATE POLICY direct_messages_delete_policy 
  ON direct_messages
  FOR DELETE USING (
    auth.uid() = sender_id
  );

-- Index für schnellere Abfragen
CREATE INDEX direct_messages_sender_idx ON direct_messages(sender_id);
CREATE INDEX direct_messages_receiver_idx ON direct_messages(receiver_id);
CREATE INDEX direct_messages_created_at_idx ON direct_messages(created_at);

-- Funktion zum Benachrichtigen über neue Nachrichten
CREATE OR REPLACE FUNCTION notify_new_direct_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Diese Funktion wird aufgerufen, wenn eine neue Nachricht eingefügt wird
  -- Im Hintergrund können wir Push-Benachrichtigungen auslösen
  
  -- Ein Webhook oder eine Serverless-Funktion könnte hier aufgerufen werden
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für neue Nachrichten
CREATE TRIGGER direct_messages_insert_trigger
AFTER INSERT ON direct_messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_direct_message();

-- Funktion zum Zählen ungelesener Nachrichten
CREATE OR REPLACE FUNCTION get_unread_messages_count(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM direct_messages
  WHERE receiver_id = user_id_param
    AND is_read = FALSE;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql; 