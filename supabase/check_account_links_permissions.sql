-- Diagnose-Skript für Benutzerverknüpfungen in Supabase
-- Führe das Skript mit deiner Benutzer-ID als Parameter aus:
-- z.B. im Supabase SQL Editor:
--   select * from check_account_links('deine-user-id-hier');
-- oder als psql Parameter:
--   psql -v user_id="'deine-user-id-hier'" -f check_account_links_permissions.sql

-- 1. Prüfe, ob irgendwelche Verknüpfungen für den Benutzer existieren
SELECT 
  id,
  creator_id,
  invited_id,
  status,
  created_at
FROM 
  account_links
WHERE 
  (creator_id = $1 OR invited_id = $1);

-- 2. Prüfe nur akzeptierte Verknüpfungen
SELECT 
  id,
  creator_id,
  invited_id,
  status,
  created_at
FROM 
  account_links
WHERE 
  (creator_id = $1 OR invited_id = $1)
  AND status = 'accepted';

-- 3. Prüfe, ob die RPC-Funktion existiert
SELECT 
  routine_name,
  routine_definition
FROM 
  information_schema.routines
WHERE 
  routine_name = 'get_linked_users_with_details'
  AND routine_schema = 'public';

-- 4. Falls es Verknüpfungen gibt, prüfe die zugehörigen Profile
WITH linked_users AS (
  SELECT 
    CASE 
      WHEN creator_id = $1 THEN invited_id
      ELSE creator_id
    END AS partner_id
  FROM 
    account_links
  WHERE 
    (creator_id = $1 OR invited_id = $1)
    AND status = 'accepted'
)
SELECT 
  p.id,
  p.display_name,
  p.created_at
FROM 
  profiles p
JOIN 
  linked_users lu ON p.id = lu.partner_id;

-- 5. Prüfe, ob die RLS-Richtlinien korrekt konfiguriert sind
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  hasindexes,
  hasrules,
  hastriggers
FROM 
  pg_tables
WHERE 
  tablename IN ('account_links', 'profiles')
ORDER BY 
  tablename;

-- 6. Prüfe die Richtlinien für die account_links-Tabelle
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  roles,
  qual
FROM 
  pg_policies
WHERE 
  tablename = 'account_links';

-- 7. Führe die RPC-Funktion direkt aus, um den Rückgabewert zu sehen
SELECT * FROM get_linked_users_with_details($1); 