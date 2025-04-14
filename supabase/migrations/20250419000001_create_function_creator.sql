-- Funktion zum Erstellen der get_table_columns-Funktion
CREATE OR REPLACE FUNCTION create_get_table_columns_function()
RETURNS void AS $$
BEGIN
  EXECUTE '
    CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
    RETURNS TABLE (
      column_name text,
      data_type text,
      is_nullable boolean
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        c.column_name::text,
        c.data_type::text,
        (c.is_nullable = ''YES'')::boolean
      FROM
        information_schema.columns c
      WHERE
        c.table_schema = ''public''
        AND c.table_name = table_name
      ORDER BY
        c.ordinal_position;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  ';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
