-- Prüfen, welche Tabellen existieren
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name LIKE '%sleep%';

-- Spalten der sleep_entries Tabelle prüfen (falls sie existiert)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'sleep_entries'
ORDER BY ordinal_position;

-- Prüfen, welche Funktionen existieren
SELECT 
  proname as function_name, 
  pg_get_function_arguments(p.oid) as function_arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname LIKE '%sleep%' OR proname LIKE '%sync%';

-- Zeige alle nicht abgeschlossenen Schlafeinträge
SELECT id, user_id, start_time, end_time, created_by, group_id
FROM public.sleep_entries
WHERE end_time IS NULL
LIMIT 10; 