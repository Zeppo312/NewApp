-- Löschen der alten Update-Richtlinie
DROP POLICY IF EXISTS "Users can update their own account links" ON account_links;

-- Erstellen einer neuen Update-Richtlinie, die Einladungen mit NULL invited_id berücksichtigt
CREATE POLICY "Users can update account links with invitation code" 
  ON account_links 
  FOR UPDATE 
  USING (
    auth.uid() = creator_id OR 
    auth.uid() = invited_id OR
    (invited_id IS NULL AND status = 'pending')
  );

-- Kommentar zur Erklärung
COMMENT ON POLICY "Users can update account links with invitation code" ON account_links IS 
  'Erlaubt Benutzern, ihre eigenen Account-Verlinkungen zu aktualisieren oder ausstehende Einladungen anzunehmen';
