-- Fix für selbst-geteilte Einträge in der Sleep-Tracker App
-- Dieses Skript identifiziert und korrigiert Einträge, bei denen ein Benutzer einen Eintrag mit sich selbst geteilt hat

-- 1. Informationen zu selbst-geteilten Einträgen anzeigen
SELECT 
  id,
  user_id,
  shared_with_user_id,
  start_time,
  end_time,
  created_at,
  updated_at
FROM 
  sleep_entries
WHERE 
  user_id = shared_with_user_id
  AND shared_with_user_id IS NOT NULL;

-- 2. Anzahl der betroffenen Einträge zählen
SELECT 
  COUNT(*) AS "Anzahl selbst-geteilter Einträge"
FROM 
  sleep_entries
WHERE 
  user_id = shared_with_user_id
  AND shared_with_user_id IS NOT NULL;

-- 3. Selbst-geteilte Einträge korrigieren
-- Dies setzt shared_with_user_id auf NULL für alle selbst-geteilten Einträge
UPDATE 
  sleep_entries
SET 
  shared_with_user_id = NULL,
  updated_at = NOW()
WHERE 
  user_id = shared_with_user_id
  AND shared_with_user_id IS NOT NULL
RETURNING 
  id, 
  user_id, 
  shared_with_user_id,
  updated_at;

-- 4. Überprüfen, ob alle selbst-geteilten Einträge korrigiert wurden
SELECT 
  COUNT(*) AS "Verbleibende selbst-geteilte Einträge"
FROM 
  sleep_entries
WHERE 
  user_id = shared_with_user_id
  AND shared_with_user_id IS NOT NULL;

-- 5. Informationen zu allen geteilten Einträgen anzeigen (zur Kontrolle)
SELECT 
  id,
  user_id,
  shared_with_user_id,
  start_time,
  end_time
FROM 
  sleep_entries
WHERE 
  shared_with_user_id IS NOT NULL
ORDER BY 
  updated_at DESC
LIMIT 10;

-- Skript zum Finden und Korrigieren von selbst-geteilten Einträgen
-- Selbst-geteilte Einträge sind Einträge, bei denen user_id = shared_with_user_id

-- 1. Identifiziere selbst-geteilte Einträge
SELECT 
  id, 
  user_id, 
  shared_with_user_id, 
  start_time,
  end_time
FROM 
  sleep_entries
WHERE 
  user_id = shared_with_user_id
  AND shared_with_user_id IS NOT NULL;

-- 2. Korrigiere selbst-geteilte Einträge (Setze shared_with_user_id auf NULL)
-- Diese Version vermeidet den Versuch, updated_at zu aktualisieren,
-- falls diese Spalte nicht existiert
UPDATE sleep_entries
SET 
  shared_with_user_id = NULL
WHERE 
  user_id = shared_with_user_id
  AND shared_with_user_id IS NOT NULL
RETURNING id, user_id, shared_with_user_id; 