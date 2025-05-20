-- Erweitere die community_posts Tabelle um ein Feld für Bilder
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Stelle sicher, dass der community-images Bucket existiert
DO $$
DECLARE
  bucket_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'community-images'
  ) INTO bucket_exists;

  IF NOT bucket_exists THEN
    -- Erstelle den Bucket
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('community-images', 'community-images', true);
    
    -- Erstelle eine Policy, damit angemeldete Benutzer Bilder hochladen können
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'Users can upload images',
      '(bucket_id = ''community-images''::text AND auth.role() = ''authenticated''::text)',
      'community-images'
    );
    
    -- Erstelle eine Policy, damit alle Bilder sehen können
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'Anyone can view images',
      '(bucket_id = ''community-images''::text)',
      'community-images'
    );
  END IF;
END
$$;
