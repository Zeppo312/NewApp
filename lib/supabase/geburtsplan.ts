import { supabase } from '@/lib/supabase';

// Funktion zum Laden des Geburtsplans eines Benutzers
export const getGeburtsplan = async (userId: string) => {
  return await supabase
    .from('geburtsplan')
    .select('*')
    .eq('user_id', userId)
    .single();
};

// Funktion zum Speichern oder Aktualisieren des Geburtsplans
export const saveGeburtsplan = async (userId: string, content: string) => {
  return await supabase
    .from('geburtsplan')
    .upsert({
      user_id: userId,
      content,
      updated_at: new Date().toISOString()
    });
};

// Funktion zum Löschen des Geburtsplans
export const deleteGeburtsplan = async (userId: string) => {
  return await supabase
    .from('geburtsplan')
    .delete()
    .eq('user_id', userId);
};
