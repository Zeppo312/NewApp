-- Skript zur Diagnose von Benutzerverknüpfungen in der Sleep-Tracker App
-- Dieses Skript prüft account_links und die zugehörigen profile-Daten

-- 1. Prüfe die account_links-Tabelle
SELECT 
  id,
  creator_id,
  invited_id,
  status,
  created_at,
  updated_at,
  last_synced_at
FROM 
  account_links
ORDER BY 
  updated_at DESC
LIMIT 20;

-- 2. Zähle Verknüpfungen nach Status
SELECT 
  status, 
  COUNT(*) as anzahl
FROM 
  account_links
GROUP BY 
  status;

-- 3. Prüfe Verknüpfungen eines bestimmten Benutzers
-- (Ersetze 'USER_ID' mit der tatsächlichen Benutzer-ID)
SELECT 
  al.id,
  al.status,
  al.created_at,
  al.updated_at,
  CASE 
    WHEN al.creator_id = 'USER_ID' THEN 'Creator'
    ELSE 'Invited'
  END as role,
  CASE 
    WHEN al.creator_id = 'USER_ID' THEN al.invited_id
    ELSE al.creator_id
  END as partner_id,
  p.display_name as partner_name
FROM 
  account_links al
LEFT JOIN 
  profiles p ON (
    CASE 
      WHEN al.creator_id = 'USER_ID' THEN p.id = al.invited_id
      ELSE p.id = al.creator_id
    END
  )
WHERE 
  al.creator_id = 'USER_ID' OR al.invited_id = 'USER_ID';

-- 4. Prüfe die get_linked_users_with_details Funktion
-- Dies zeigt, ob die RPC-Funktion korrekt benutzerübergreifende Daten abruft
-- (Ersetze 'USER_ID' mit der tatsächlichen Benutzer-ID)
SELECT * FROM get_linked_users_with_details('USER_ID');

-- 5. Prüfe Berechtigungen für die account_links-Tabelle
-- Zeigt, ob Row-Level Security richtig eingerichtet ist
SELECT
  schemaname,
  tablename,
  tableowner,
  rowsecurity
FROM
  pg_tables
WHERE
  tablename = 'account_links';

-- 6. Prüfe RLS-Richtlinien für account_links
SELECT
  polname,
  polpermissive,
  polroles,
  polcmd,
  polqual
FROM
  pg_policy
WHERE
  polrelid = 'public.account_links'::regclass;

-- 7. Prüfe, ob bestimmte Benutzer überhaupt existieren
-- (Ersetze die IDs durch die tatsächlichen Benutzer-IDs aus den Testdaten)
SELECT 
  id,
  email,
  created_at,
  updated_at
FROM 
  auth.users
WHERE 
  id IN ('a9db51e0-2666-49d5-8594-1628056ab7e5', '3b7c130b-4213-42c7-a2a3-bb3058df4d32');

-- 8. Prüfe die Profildaten für bestimmte Benutzer
SELECT 
  id,
  display_name,
  created_at,
  updated_at
FROM 
  profiles
WHERE 
  id IN ('a9db51e0-2666-49d5-8594-1628056ab7e5', '3b7c130b-4213-42c7-a2a3-bb3058df4d32'); 