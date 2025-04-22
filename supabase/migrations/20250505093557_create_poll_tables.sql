-- Tabelle für Umfragen
CREATE TABLE IF NOT EXISTS community_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  allow_multiple_choices BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Umfrageoptionen
CREATE TABLE IF NOT EXISTS community_poll_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES community_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Benutzerantworten
CREATE TABLE IF NOT EXISTS community_poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id UUID NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(option_id, user_id)
);

-- Row Level Security für community_polls
ALTER TABLE community_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all polls" ON community_polls
  FOR SELECT USING (true);

CREATE POLICY "Users can insert polls for their own posts" ON community_polls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE id = post_id AND user_id = auth.uid()
    )
  );

-- Row Level Security für community_poll_options
ALTER TABLE community_poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all poll options" ON community_poll_options
  FOR SELECT USING (true);

CREATE POLICY "Users can insert poll options for their own polls" ON community_poll_options
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_polls p
      JOIN community_posts post ON p.post_id = post.id
      WHERE p.id = poll_id AND post.user_id = auth.uid()
    )
  );

-- Row Level Security für community_poll_votes
ALTER TABLE community_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all poll votes" ON community_poll_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own votes" ON community_poll_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON community_poll_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS community_polls_post_id_idx ON community_polls(post_id);
CREATE INDEX IF NOT EXISTS community_poll_options_poll_id_idx ON community_poll_options(poll_id);
CREATE INDEX IF NOT EXISTS community_poll_votes_option_id_idx ON community_poll_votes(option_id);
CREATE INDEX IF NOT EXISTS community_poll_votes_user_id_idx ON community_poll_votes(user_id);

-- Funktion zum Abrufen von Umfrageergebnissen
CREATE OR REPLACE FUNCTION get_poll_results(poll_id_param UUID)
RETURNS TABLE (
  option_id UUID,
  option_text TEXT,
  votes_count BIGINT,
  percentage NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_votes BIGINT;
BEGIN
  -- Gesamtzahl der Stimmen für diese Umfrage ermitteln
  SELECT COUNT(*) INTO total_votes
  FROM community_poll_votes v
  JOIN community_poll_options o ON v.option_id = o.id
  WHERE o.poll_id = poll_id_param;

  -- Ergebnisse zurückgeben
  RETURN QUERY
  SELECT 
    o.id AS option_id,
    o.option_text,
    COUNT(v.id) AS votes_count,
    CASE 
      WHEN total_votes = 0 THEN 0
      ELSE ROUND((COUNT(v.id)::NUMERIC / total_votes) * 100, 1)
    END AS percentage
  FROM 
    community_poll_options o
  LEFT JOIN 
    community_poll_votes v ON o.id = v.option_id
  WHERE 
    o.poll_id = poll_id_param
  GROUP BY 
    o.id, o.option_text
  ORDER BY 
    votes_count DESC, o.option_text;
END;
$$;
