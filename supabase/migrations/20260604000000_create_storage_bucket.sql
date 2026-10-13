-- Erstelle den public-images Storage Bucket falls noch nicht vorhanden
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-images', 'public-images', true)
ON CONFLICT (id) DO NOTHING;

-- Lösche existierende Policies falls vorhanden
DROP POLICY IF EXISTS "Authentifizierte User können Bilder hochladen" ON storage.objects;
DROP POLICY IF EXISTS "Öffentlicher Zugriff auf Bilder" ON storage.objects;
DROP POLICY IF EXISTS "Admins können Bilder löschen" ON storage.objects;

-- Policy: Jeder authentifizierte User kann Bilder hochladen
CREATE POLICY "Authentifizierte User können Bilder hochladen"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'public-images');

-- Policy: Jeder kann öffentliche Bilder sehen
CREATE POLICY "Öffentlicher Zugriff auf Bilder"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'public-images');

-- Policy: Admins können Bilder löschen
CREATE POLICY "Admins können Bilder löschen"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'public-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

