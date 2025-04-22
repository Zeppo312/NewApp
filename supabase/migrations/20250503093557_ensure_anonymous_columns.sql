-- Stelle sicher, dass die is_anonymous-Spalte in community_posts existiert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'community_posts'
        AND column_name = 'is_anonymous'
    ) THEN
        ALTER TABLE community_posts ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Stelle sicher, dass die is_anonymous-Spalte in community_comments existiert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'community_comments'
        AND column_name = 'is_anonymous'
    ) THEN
        ALTER TABLE community_comments ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Kommentare zu den Feldern hinzufügen
COMMENT ON COLUMN community_posts.is_anonymous IS 'Gibt an, ob der Beitrag anonym gepostet wurde';
COMMENT ON COLUMN community_comments.is_anonymous IS 'Gibt an, ob der Kommentar anonym gepostet wurde';
