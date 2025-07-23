-- Erstelle eine Funktion, um Benutzerprofile abzurufen
CREATE OR REPLACE FUNCTION get_user_profile(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  user_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.user_role,
    p.created_at,
    p.updated_at
  FROM 
    profiles p
  WHERE 
    p.id = user_id_param;
END;
$$;
