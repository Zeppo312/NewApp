-- Fix baby_names admin policies to avoid auth.users access.
ALTER TABLE baby_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can add baby names" ON baby_names;
DROP POLICY IF EXISTS "Only admins can update baby names" ON baby_names;
DROP POLICY IF EXISTS "Only admins can delete baby names" ON baby_names;

CREATE POLICY "Only admins can add baby names"
  ON baby_names
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

CREATE POLICY "Only admins can update baby names"
  ON baby_names
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

CREATE POLICY "Only admins can delete baby names"
  ON baby_names
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );
