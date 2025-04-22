-- Tabelle für Tags
CREATE TABLE IF NOT EXISTS community_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'trimester' oder 'baby_age'
  display_order INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für die Verknüpfung zwischen Posts und Tags
CREATE TABLE IF NOT EXISTS community_post_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES community_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);

-- Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS community_tags_category_idx ON community_tags(category);
CREATE INDEX IF NOT EXISTS community_post_tags_post_id_idx ON community_post_tags(post_id);
CREATE INDEX IF NOT EXISTS community_post_tags_tag_id_idx ON community_post_tags(tag_id);

-- Row Level Security für community_tags
ALTER TABLE community_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all tags" ON community_tags
  FOR SELECT USING (true);

-- Nur Administratoren können Tags erstellen, aktualisieren oder löschen
CREATE POLICY "Only admins can insert tags" ON community_tags
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE user_role = 'admin'
  ));

CREATE POLICY "Only admins can update tags" ON community_tags
  FOR UPDATE USING (auth.uid() IN (
    SELECT id FROM profiles WHERE user_role = 'admin'
  ));

CREATE POLICY "Only admins can delete tags" ON community_tags
  FOR DELETE USING (auth.uid() IN (
    SELECT id FROM profiles WHERE user_role = 'admin'
  ));

-- Row Level Security für community_post_tags
ALTER TABLE community_post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all post tags" ON community_post_tags
  FOR SELECT USING (true);

CREATE POLICY "Users can tag their own posts" ON community_post_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE id = post_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove tags from their own posts" ON community_post_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE id = post_id AND user_id = auth.uid()
    )
  );

-- Vordefinierte Tags einfügen
INSERT INTO community_tags (name, category, display_order) VALUES
-- Trimester
('1. Trimester', 'trimester', 1),
('2. Trimester', 'trimester', 2),
('3. Trimester', 'trimester', 3),
-- Baby-Alter
('0-3 Monate', 'baby_age', 1),
('3-6 Monate', 'baby_age', 2),
('6-9 Monate', 'baby_age', 3),
('9-12 Monate', 'baby_age', 4),
('1-2 Jahre', 'baby_age', 5),
('2-3 Jahre', 'baby_age', 6),
('3+ Jahre', 'baby_age', 7)
ON CONFLICT (name) DO NOTHING;

-- Funktion zum Abrufen von Posts mit Tags
CREATE OR REPLACE FUNCTION get_posts_with_tags(tag_ids UUID[] DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_anonymous BOOLEAN,
  type TEXT,
  tags JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.content,
    p.created_at,
    p.updated_at,
    p.is_anonymous,
    p.type,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'category', t.category
          )
        )
        FROM community_post_tags pt
        JOIN community_tags t ON pt.tag_id = t.id
        WHERE pt.post_id = p.id
      ),
      '[]'::jsonb
    ) AS tags
  FROM 
    community_posts p
  WHERE
    (tag_ids IS NULL) OR
    EXISTS (
      SELECT 1 FROM community_post_tags pt
      WHERE pt.post_id = p.id AND pt.tag_id = ANY(tag_ids)
    )
  ORDER BY 
    p.created_at DESC;
END;
$$;
