-- Erstellen der Tabelle für Account-Verlinkungen
CREATE TABLE IF NOT EXISTS account_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  relationship_type TEXT, -- 'partner', 'family', 'friend', etc.
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Row Level Security
ALTER TABLE account_links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own account links" 
  ON account_links 
  FOR SELECT 
  USING (auth.uid() = creator_id OR auth.uid() = invited_id);

CREATE POLICY "Users can create invitation links" 
  ON account_links 
  FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own account links" 
  ON account_links 
  FOR UPDATE 
  USING (auth.uid() = creator_id OR auth.uid() = invited_id);

-- Indizes für schnellere Abfragen
CREATE INDEX IF NOT EXISTS account_links_creator_id_idx ON account_links(creator_id);
CREATE INDEX IF NOT EXISTS account_links_invited_id_idx ON account_links(invited_id);
CREATE INDEX IF NOT EXISTS account_links_invitation_code_idx ON account_links(invitation_code);
CREATE INDEX IF NOT EXISTS account_links_status_idx ON account_links(status);

-- Kommentare
COMMENT ON TABLE account_links IS 'Speichert Einladungen und Verknüpfungen zwischen Benutzerkonten';
COMMENT ON COLUMN account_links.creator_id IS 'ID des Benutzers, der die Einladung erstellt hat';
COMMENT ON COLUMN account_links.invited_id IS 'ID des eingeladenen Benutzers (NULL, wenn noch nicht angenommen)';
COMMENT ON COLUMN account_links.invitation_code IS 'Eindeutiger Einladungscode zur Verknüpfung von Konten';
COMMENT ON COLUMN account_links.status IS 'Status der Einladung: pending, accepted, rejected';
COMMENT ON COLUMN account_links.relationship_type IS 'Art der Beziehung zwischen den Benutzern: partner, family, friend, etc.';
