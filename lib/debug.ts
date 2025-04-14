import { supabase } from './supabase';

// Funktion zum Überprüfen der Tabellenstruktur
export const checkTableStructure = async (tableName: string) => {
  try {
    console.log(`Checking structure of table: ${tableName}`);
    
    // Spalten der Tabelle abrufen
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: tableName });
    
    if (columnsError) {
      console.error(`Error getting columns for table ${tableName}:`, columnsError);
      return { success: false, error: columnsError };
    }
    
    console.log(`Columns for table ${tableName}:`, columns);
    
    return { success: true, columns };
  } catch (err) {
    console.error(`Failed to check table structure for ${tableName}:`, err);
    return { success: false, error: err };
  }
};

// Funktion zum direkten Speichern von Daten in eine Tabelle
export const directSaveToTable = async (tableName: string, data: any) => {
  try {
    console.log(`Directly saving data to table ${tableName}:`, data);
    
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select();
    
    if (error) {
      console.error(`Error saving data to table ${tableName}:`, error);
      return { success: false, error };
    }
    
    console.log(`Successfully saved data to table ${tableName}:`, result);
    
    return { success: true, data: result };
  } catch (err) {
    console.error(`Failed to save data to table ${tableName}:`, err);
    return { success: false, error: err };
  }
};

// Funktion zum Abrufen aller Daten aus einer Tabelle
export const getAllDataFromTable = async (tableName: string, userId?: string) => {
  try {
    console.log(`Getting all data from table ${tableName}`);
    
    let query = supabase.from(tableName).select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error getting data from table ${tableName}:`, error);
      return { success: false, error };
    }
    
    console.log(`Data from table ${tableName}:`, data);
    
    return { success: true, data };
  } catch (err) {
    console.error(`Failed to get data from table ${tableName}:`, err);
    return { success: false, error: err };
  }
};

// Funktion zum Erstellen einer RPC-Funktion in Supabase
export const createGetTableColumnsFunction = async () => {
  try {
    console.log('Creating get_table_columns function in Supabase');
    
    const { error } = await supabase.rpc('create_get_table_columns_function');
    
    if (error) {
      console.error('Error creating get_table_columns function:', error);
      return { success: false, error };
    }
    
    console.log('Successfully created get_table_columns function');
    
    return { success: true };
  } catch (err) {
    console.error('Failed to create get_table_columns function:', err);
    return { success: false, error: err };
  }
};

// Funktion zum Testen des Speicherprozesses
export const testSaveProcess = async (userId: string) => {
  try {
    console.log('Testing save process for user:', userId);
    
    // Test für user_settings
    const userSettingsData = {
      user_id: userId,
      due_date: new Date().toISOString(),
      is_baby_born: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const userSettingsResult = await directSaveToTable('user_settings', userSettingsData);
    
    // Test für baby_info
    const babyInfoData = {
      user_id: userId,
      name: 'Test Baby',
      baby_gender: 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const babyInfoResult = await directSaveToTable('baby_info', babyInfoData);
    
    return {
      success: userSettingsResult.success && babyInfoResult.success,
      userSettingsResult,
      babyInfoResult
    };
  } catch (err) {
    console.error('Failed to test save process:', err);
    return { success: false, error: err };
  }
};

// Funktion zum Überprüfen der Berechtigungen für eine Tabelle
export const checkTablePermissions = async (tableName: string, userId: string) => {
  try {
    console.log(`Checking permissions for table ${tableName}`);
    
    // Test SELECT
    const { data: selectData, error: selectError } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    
    console.log(`SELECT permission for ${tableName}:`, selectError ? 'Error' : 'OK');
    
    // Test INSERT
    const testData = {
      user_id: userId,
      test_field: 'test_value',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from(tableName)
      .insert(testData)
      .select();
    
    console.log(`INSERT permission for ${tableName}:`, insertError ? 'Error' : 'OK');
    
    // Test UPDATE (falls ein Eintrag existiert)
    let updateResult = { success: false, error: null };
    
    if (selectData && selectData.length > 0) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ test_field: 'updated_value' })
        .eq('id', selectData[0].id);
      
      console.log(`UPDATE permission for ${tableName}:`, updateError ? 'Error' : 'OK');
      
      updateResult = { success: !updateError, error: updateError };
    }
    
    // Test DELETE (falls ein Testeintrag erstellt wurde)
    let deleteResult = { success: false, error: null };
    
    if (insertData && insertData.length > 0) {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', insertData[0].id);
      
      console.log(`DELETE permission for ${tableName}:`, deleteError ? 'Error' : 'OK');
      
      deleteResult = { success: !deleteError, error: deleteError };
    }
    
    return {
      success: true,
      select: { success: !selectError, error: selectError },
      insert: { success: !insertError, error: insertError },
      update: updateResult,
      delete: deleteResult
    };
  } catch (err) {
    console.error(`Failed to check permissions for table ${tableName}:`, err);
    return { success: false, error: err };
  }
};
