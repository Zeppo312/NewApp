-- Diese Funktion prüft die Struktur der account_links Tabelle und gibt Informationen darüber zurück
CREATE OR REPLACE FUNCTION check_account_links_schema()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  column_exists BOOLEAN;
  column_info JSONB;
BEGIN
  -- Prüfe, ob die account_links Tabelle existiert
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'account_links'
  ) INTO column_exists;
  
  result = jsonb_set(result, '{table_account_links_exists}', to_jsonb(column_exists));
  
  -- Wenn die Tabelle existiert, prüfe ihre Spalten
  IF column_exists THEN
    -- Prüfe, ob source_user_id und target_user_id existieren
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'account_links' 
      AND column_name = 'source_user_id'
    ) INTO column_exists;
    
    result = jsonb_set(result, '{source_user_id_exists}', to_jsonb(column_exists));
    
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'account_links' 
      AND column_name = 'target_user_id'
    ) INTO column_exists;
    
    result = jsonb_set(result, '{target_user_id_exists}', to_jsonb(column_exists));
    
    -- Hole alle Spaltennamen und Typen
    SELECT jsonb_agg(jsonb_build_object('column_name', column_name, 'data_type', data_type))
    INTO column_info
    FROM information_schema.columns
    WHERE table_name = 'account_links';
    
    result = jsonb_set(result, '{account_links_columns}', column_info);
  END IF;
  
  -- Prüfe auch, ob die user_connections Tabelle existiert
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'user_connections'
  ) INTO column_exists;
  
  result = jsonb_set(result, '{table_user_connections_exists}', to_jsonb(column_exists));
  
  -- Wenn die Tabelle existiert, prüfe ihre Spalten
  IF column_exists THEN
    -- Hole alle Spaltennamen und Typen
    SELECT jsonb_agg(jsonb_build_object('column_name', column_name, 'data_type', data_type))
    INTO column_info
    FROM information_schema.columns
    WHERE table_name = 'user_connections';
    
    result = jsonb_set(result, '{user_connections_columns}', column_info);
  END IF;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$; 