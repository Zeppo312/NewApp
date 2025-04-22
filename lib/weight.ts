import { supabase } from './supabase';

export type WeightEntry = {
  id: string;
  user_id: string;
  date: string;
  weight: number;
  notes?: string;
  created_at: string;
  updated_at: string;
};

// Gewichtsdaten speichern
export const saveWeightEntry = async (entry: Omit<WeightEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const now = new Date().toISOString();

    // Prüfen, ob bereits ein Eintrag für dieses Datum existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('weight_entries')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('date', entry.date)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing weight entry:', fetchError);
      return { data: null, error: fetchError };
    }

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Eintrag existiert, aktualisieren wir diesen
      result = await supabase
        .from('weight_entries')
        .update({
          weight: entry.weight,
          notes: entry.notes,
          updated_at: now
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Wenn kein Eintrag existiert, erstellen wir einen neuen
      result = await supabase
        .from('weight_entries')
        .insert({
          user_id: userData.user.id,
          date: entry.date,
          weight: entry.weight,
          notes: entry.notes,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to save weight entry:', err);
    return { data: null, error: err };
  }
};

// Alle Gewichtsdaten abrufen
export const getWeightEntries = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching weight entries:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to get weight entries:', err);
    return { data: null, error: err };
  }
};

// Gewichtseintrag löschen
export const deleteWeightEntry = async (id: string) => {
  try {
    const { error } = await supabase
      .from('weight_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting weight entry:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Failed to delete weight entry:', err);
    return { error: err };
  }
};
