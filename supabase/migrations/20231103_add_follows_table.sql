-- Erstelle eine Tabelle für Benutzer-Follows
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique-Constraint, um doppelte Follows zu verhindern
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

-- RLS aktivieren
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- RLS-Richtlinien
-- Jeder kann sehen, wer wem folgt
CREATE POLICY user_follows_select_policy 
  ON user_follows
  FOR SELECT USING (
    true  -- Öffentlich lesbar
  );
  
-- Benutzer können nur selbst anderen folgen (nicht im Namen anderer)
CREATE POLICY user_follows_insert_policy 
  ON user_follows
  FOR INSERT WITH CHECK (
    auth.uid() = follower_id
  );

-- Benutzer können nur ihre eigenen Follows entfernen
CREATE POLICY user_follows_delete_policy 
  ON user_follows
  FOR DELETE USING (
    auth.uid() = follower_id
  );

-- Index für schnellere Abfragen
CREATE INDEX user_follows_follower_idx ON user_follows(follower_id);
CREATE INDEX user_follows_following_idx ON user_follows(following_id);

-- Funktion zum Zählen der Follower eines Benutzers
CREATE OR REPLACE FUNCTION get_follower_count(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  follower_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO follower_count
  FROM user_follows
  WHERE following_id = user_id_param;
  
  RETURN follower_count;
END;
$$ LANGUAGE plpgsql;

-- Funktion zum Zählen, wie vielen Benutzern ein Benutzer folgt
CREATE OR REPLACE FUNCTION get_following_count(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  following_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO following_count
  FROM user_follows
  WHERE follower_id = user_id_param;
  
  RETURN following_count;
END;
$$ LANGUAGE plpgsql;

-- Funktion zum Prüfen, ob ein Benutzer einem anderen folgt
CREATE OR REPLACE FUNCTION is_following(follower_id_param UUID, following_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_following BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM user_follows 
    WHERE follower_id = follower_id_param 
      AND following_id = following_id_param
  ) INTO is_following;
  
  RETURN is_following;
END;
$$ LANGUAGE plpgsql;

-- Funktion zum Abrufen aller gefolgten Benutzer eines Benutzers mit Profilinformationen
CREATE OR REPLACE FUNCTION get_followed_users_with_profiles(user_id_param UUID)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  user_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  followed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.first_name,
    p.last_name,
    p.user_role,
    p.created_at,
    f.created_at as followed_at
  FROM 
    user_follows f
  JOIN 
    profiles p ON f.following_id = p.id
  WHERE 
    f.follower_id = user_id_param
  ORDER BY 
    f.created_at DESC;
END;
$$ LANGUAGE plpgsql; 