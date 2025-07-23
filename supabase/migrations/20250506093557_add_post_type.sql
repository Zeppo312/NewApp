-- Füge ein type-Feld zur community_posts-Tabelle hinzu
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';

-- Kommentar zum Feld hinzufügen
COMMENT ON COLUMN community_posts.type IS 'Art des Posts: "text" oder "poll"';

-- Erstelle einen Index für bessere Performance
CREATE INDEX IF NOT EXISTS community_posts_type_idx ON community_posts(type);

-- Aktualisiere bestehende Posts auf den Typ "text"
UPDATE community_posts SET type = 'text' WHERE type IS NULL;
