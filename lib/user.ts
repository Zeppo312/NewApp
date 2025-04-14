import { supabase } from './supabase';

// Funktion zum Initialisieren der Benutzerdaten nach der Registrierung
export const initializeUserData = async (userId: string) => {
  try {
    console.log('Initializing user data for user:', userId);
    
    // Erstellen eines leeren Eintrags in der baby_info-Tabelle
    const { data: babyData, error: babyError } = await supabase
      .from('baby_info')
      .insert({
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
      
    console.log('Baby info initialization result:', { data: babyData, error: babyError });
    
    // Erstellen eines leeren Eintrags in der user_settings-Tabelle
    const { data: settingsData, error: settingsError } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        is_baby_born: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
      
    console.log('User settings initialization result:', { data: settingsData, error: settingsError });
    
    return {
      success: !babyError && !settingsError,
      babyError,
      settingsError
    };
  } catch (err) {
    console.error('Failed to initialize user data:', err);
    return {
      success: false,
      error: err
    };
  }
};
