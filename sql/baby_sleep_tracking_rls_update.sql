-- Aktualisiere die RLS-Richtlinien, um die Synchronisierung zu ermöglichen

-- Zunächst entfernen wir die bestehenden Richtlinien
DROP POLICY IF EXISTS "Nutzer können nur ihre eigenen Schlafeinträge lesen" ON baby_sleep_tracking;
DROP POLICY IF EXISTS "Nutzer können nur ihre eigenen Schlafeinträge erstellen" ON baby_sleep_tracking;
DROP POLICY IF EXISTS "Nutzer können nur ihre eigenen Schlafeinträge aktualisieren" ON baby_sleep_tracking;
DROP POLICY IF EXISTS "Nutzer können nur ihre eigenen Schlafeinträge löschen" ON baby_sleep_tracking;

-- Dann erstellen wir neue Richtlinien

-- Lesezugriff: Nutzer können ihre eigenen Einträge lesen
CREATE POLICY "Nutzer können ihre eigenen Schlafeinträge lesen" 
  ON baby_sleep_tracking FOR SELECT 
  USING (auth.uid() = user_id);

-- Schreibzugriff: Nutzer können ihre eigenen Einträge erstellen
CREATE POLICY "Nutzer können ihre eigenen Schlafeinträge erstellen" 
  ON baby_sleep_tracking FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Aktualisierungszugriff: Nutzer können ihre eigenen Einträge aktualisieren
CREATE POLICY "Nutzer können ihre eigenen Schlafeinträge aktualisieren" 
  ON baby_sleep_tracking FOR UPDATE 
  USING (auth.uid() = user_id);

-- Löschzugriff: Nutzer können ihre eigenen Einträge löschen
CREATE POLICY "Nutzer können ihre eigenen Schlafeinträge löschen" 
  ON baby_sleep_tracking FOR DELETE 
  USING (auth.uid() = user_id);

-- RPC darf auf alle Tabellen zugreifen, wenn sie mit SECURITY DEFINER ausgeführt wird
COMMENT ON FUNCTION sync_sleep_entries(UUID) IS 
  'Synchronisiert Schlafeinträge zwischen verbundenen Benutzern. 
   Diese Funktion verwendet SECURITY DEFINER, um die RLS-Richtlinien zu umgehen.'; 