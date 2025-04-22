-- Funktion zum Sicherstellen, dass die is_anonymous-Spalte in community_posts existiert
CREATE OR REPLACE FUNCTION ensure_community_posts_is_anonymous_column()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'community_posts'
        AND column_name = 'is_anonymous'
    ) THEN
        ALTER TABLE community_posts ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE;
    END IF;
END;
$$;

-- Funktion zum Sicherstellen, dass die is_anonymous-Spalte in community_comments existiert
CREATE OR REPLACE FUNCTION ensure_community_comments_is_anonymous_column()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'community_comments'
        AND column_name = 'is_anonymous'
    ) THEN
        ALTER TABLE community_comments ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE;
    END IF;
END;
$$;
