import { supabase } from './supabase';
import { getPartnerId } from './accountLinks';

export type WeightSubject = 'mom' | 'baby';

export type WeightEntry = {
  id: string;
  user_id: string;
  date: string;
  weight: number;
  subject: WeightSubject;
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
    const subject = entry.subject ?? 'mom';

    // Prüfen, ob bereits ein Eintrag für dieses Datum existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('weight_entries')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('subject', subject)
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
          subject,
          notes: entry.notes && entry.notes.trim().length > 0 ? entry.notes.trim() : null,
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
          subject,
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
export const getWeightEntries = async (subject?: WeightSubject) => {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return { data: null, error: userErr };
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const myId = userData.user.id;
    const partnerId = await getPartnerId();

    let query = supabase
      .from('weight_entries')
      .select('*')
      .order('date', { ascending: true });

    if (subject === 'baby') {
      if (partnerId) {
        query = query.or(
          `and(user_id.eq.${myId},subject.eq.baby),and(user_id.eq.${partnerId},subject.eq.baby)`
        );
      } else {
        query = query.eq('user_id', myId).eq('subject', 'baby');
      }
    } else if (subject === 'mom') {
      query = query.eq('user_id', myId).eq('subject', 'mom');
    } else {
      if (partnerId) {
        query = query.or(
          `user_id.eq.${myId},and(user_id.eq.${partnerId},subject.eq.baby)`
        );
      } else {
        query = query.eq('user_id', myId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching weight entries:', error);
      return { data: null, error };
    }

    const normalized = (data ?? []).map((entry) => ({
      ...entry,
      subject: (entry as WeightEntry).subject ?? 'mom',
    })) as WeightEntry[];

    return { data: normalized, error: null };
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
