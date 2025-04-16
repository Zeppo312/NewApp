const { createClient } = require('@supabase/supabase-js');

// Supabase-Konfiguration
const supabaseUrl = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bmlpeWF5aHpnamZxanNqY2Z1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Mzk3MTI2MiwiZXhwIjoyMDU5NTQ3MjYyfQ.qob9H2oQeQ8dqRHS19R0RrrXGs8Y-AszF-8ZBsVcH9Ic';

// Supabase-Client erstellen
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  try {
    // SQL-Abfrage, um alle Tabellen im öffentlichen Schema zu erhalten
    const { data, error } = await supabase.rpc('list_tables');
    
    if (error) {
      console.error('Fehler beim Abrufen der Tabellen:', error);
      
      // Alternativer Ansatz mit direkter SQL-Abfrage
      const { data: tables, error: sqlError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
      
      if (sqlError) {
        console.error('Fehler bei der SQL-Abfrage:', sqlError);
        
        // Dritter Versuch mit einer anderen SQL-Abfrage
        const { data: result, error: queryError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public');
        
        if (queryError) {
          console.error('Fehler bei der dritten Abfrage:', queryError);
        } else {
          console.log('Tabellen im öffentlichen Schema:');
          result.forEach(table => {
            console.log(`- ${table.table_name}`);
          });
        }
      } else {
        console.log('Tabellen im öffentlichen Schema:');
        tables.forEach(table => {
          console.log(`- ${table.tablename}`);
        });
      }
    } else {
      console.log('Tabellen im öffentlichen Schema:');
      data.forEach(table => {
        console.log(`- ${table}`);
      });
    }
    
    // Versuchen wir, die Struktur der user_settings-Tabelle zu erhalten
    const { data: userSettingsColumns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_settings');
    
    if (columnsError) {
      console.error('Fehler beim Abrufen der Spalten für user_settings:', columnsError);
    } else {
      console.log('\nSpalten in der user_settings-Tabelle:');
      userSettingsColumns.forEach(column => {
        console.log(`- ${column.column_name} (${column.data_type})`);
      });
    }
    
  } catch (error) {
    console.error('Unerwarteter Fehler:', error);
  }
}

// Funktion ausführen
listTables();
