-- Bucket für Blog-Coverbilder
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-images', 'community-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Alte Policies entfernen, falls vorhanden
DROP POLICY IF EXISTS "Public read community-images" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload community-images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update community-images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete community-images" ON storage.objects;

-- Öffentlich lesen erlaubt, Upload/Änderungen nur für Admins
CREATE POLICY "Public read community-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'community-images');

CREATE POLICY "Admins upload community-images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'community-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

CREATE POLICY "Admins update community-images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'community-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

CREATE POLICY "Admins delete community-images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'community-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );
