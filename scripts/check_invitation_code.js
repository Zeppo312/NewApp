/**
 * Dieses Skript überprüft einen Einladungscode in der Datenbank
 * 
 * Verwendung:
 * 1. Öffnen Sie die Supabase SQL-Konsole
 * 2. Kopieren Sie diesen Code in die Konsole
 * 3. Ersetzen Sie 'IHREN_CODE_HIER' durch den zu überprüfenden Einladungscode
 * 4. Führen Sie das Skript aus
 */

-- Einladungscode, den Sie überprüfen möchten
\set invitation_code 'X2Y6JSNX'

-- Ausgabe der Einladungscode-Informationen
SELECT 
  id,
  creator_id,
  invited_id,
  invitation_code,
  status,
  created_at,
  expires_at,
  accepted_at,
  relationship_type,
  invitation_code = :'invitation_code' AS exact_match,
  LOWER(invitation_code) = LOWER(:'invitation_code') AS case_insensitive_match
FROM 
  public.account_links
WHERE 
  invitation_code = :'invitation_code'
  OR LOWER(invitation_code) = LOWER(:'invitation_code');

-- Überprüfen, ob der Code existiert
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.account_links
  WHERE invitation_code = :'invitation_code';
  
  IF v_count = 0 THEN
    RAISE NOTICE 'Der Einladungscode % existiert nicht in der Datenbank.', :'invitation_code';
    
    -- Ähnliche Codes suchen
    RAISE NOTICE 'Suche nach ähnlichen Codes...';
    FOR r IN (
      SELECT invitation_code, status, expires_at
      FROM public.account_links
      ORDER BY created_at DESC
      LIMIT 10
    ) LOOP
      RAISE NOTICE 'Gefundener Code: %, Status: %, Gültig bis: %', r.invitation_code, r.status, r.expires_at;
    END LOOP;
  ELSE
    RAISE NOTICE 'Der Einladungscode % existiert in der Datenbank.', :'invitation_code';
    
    -- Überprüfen, ob der Code gültig ist
    FOR r IN (
      SELECT status, expires_at, creator_id, invited_id
      FROM public.account_links
      WHERE invitation_code = :'invitation_code'
    ) LOOP
      IF r.status != 'pending' THEN
        RAISE NOTICE 'Der Code wurde bereits verwendet. Status: %', r.status;
      ELSIF r.expires_at <= NOW() THEN
        RAISE NOTICE 'Der Code ist abgelaufen. Ablaufdatum: %', r.expires_at;
      ELSIF r.invited_id IS NOT NULL THEN
        RAISE NOTICE 'Der Code wurde bereits einem Benutzer zugewiesen: %', r.invited_id;
      ELSE
        RAISE NOTICE 'Der Code ist gültig und kann verwendet werden.';
      END IF;
      
      RAISE NOTICE 'Ersteller-ID: %', r.creator_id;
    END LOOP;
  END IF;
END $$;
