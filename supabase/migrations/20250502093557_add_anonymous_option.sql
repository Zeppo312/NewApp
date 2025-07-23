-- Füge is_anonymous-Feld zu community_posts hinzu
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Füge is_anonymous-Feld zu community_comments hinzu
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Kommentare zu den Feldern hinzufügen
COMMENT ON COLUMN community_posts.is_anonymous IS 'Gibt an, ob der Beitrag anonym gepostet wurde';
COMMENT ON COLUMN community_comments.is_anonymous IS 'Gibt an, ob der Kommentar anonym gepostet wurde';
