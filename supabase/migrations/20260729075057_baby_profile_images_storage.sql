-- Store baby profile photos as files instead of large base64 strings in baby_info.
-- Object paths start with the uploader's user id so write access can be scoped safely.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'baby-profile-images',
  'baby-profile-images',
  TRUE,
  1048576,
  ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read baby profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own baby profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own baby profile images" ON storage.objects;

CREATE POLICY "Public read baby profile images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'baby-profile-images');

CREATE POLICY "Users upload own baby profile images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'baby-profile-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY "Users delete own baby profile images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'baby-profile-images'
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
