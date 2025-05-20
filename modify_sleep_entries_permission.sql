-- Dieses Skript behebt Berechtigungsprobleme mit der sleep_entries Tabelle

-- 1. Prüfen der bestehenden Richtlinien
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM 
  pg_policies
WHERE 
  tablename = 'sleep_entries';

-- 2. Neue Richtlinie für geteilte Einträge hinzufügen
DROP POLICY IF EXISTS allow_shared_entries ON sleep_entries;

CREATE POLICY allow_shared_entries ON sleep_entries 
  FOR ALL 
  TO authenticated 
  USING (
    -- Entweder der Benutzer ist der Ersteller ODER der Eintrag ist mit dem Benutzer geteilt
    (auth.uid() = user_id) OR (auth.uid() = shared_with_user_id)
  );

-- 3. Funktion zur Korrektur der Berechtigungsüberprüfung aktualisieren
CREATE OR REPLACE FUNCTION check_sleep_entry_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Erlauben, wenn der aktuelle Benutzer der Ersteller des Eintrags ist
  IF NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Erlauben, wenn der Eintrag mit dem aktuellen Benutzer geteilt ist
  IF NEW.shared_with_user_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Verweigern, wenn keine der Bedingungen erfüllt ist
  RAISE EXCEPTION 'Keine Berechtigung zum Ändern dieses Schlafeintrags';
END;
$$;

-- 4. Funktion zum direkten Korrigieren von selbst-geteilten Einträgen
-- Diese Funktion sollte nur von Datenbankadministratoren ausgeführt werden
CREATE OR REPLACE FUNCTION admin_fix_self_shared_entries()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fixed_count INT;
BEGIN
  UPDATE sleep_entries
  SET shared_with_user_id = NULL
  WHERE user_id = shared_with_user_id
    AND shared_with_user_id IS NOT NULL;
    
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % self-shared entries', fixed_count;
END;
$$;

-- Führe die Korrektur aus
SELECT admin_fix_self_shared_entries(); 