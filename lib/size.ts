import { supabase } from './supabase';
import { getCachedUser } from './supabase';

export type SizeSubject = 'mom' | 'baby';

export type SizeEntry = {
  id: string;
  user_id: string;
  date: string;
  // Keep `weight` shape for tracker compatibility; persisted column is `size`.
  weight: number;
  subject: SizeSubject;
  baby_id?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
};

// Groessendaten speichern
export const saveSizeEntry = async (
  entry: Omit<SizeEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>
) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const now = new Date().toISOString();
    const subject = entry.subject ?? 'baby';
    const babyId = entry.baby_id ?? null;

    if (subject === 'baby' && !babyId) {
      return { data: null, error: new Error('Kein Baby ausgewählt') };
    }

    // Prüfen, ob bereits ein Eintrag für dieses Datum existiert
    let existingQuery = supabase
      .from('size_entries')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('subject', subject)
      .eq('date', entry.date);

    if (subject === 'baby') {
      existingQuery = existingQuery.eq('baby_id', babyId);
    }

    const { data: existingData, error: fetchError } = await existingQuery.maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing size entry:', fetchError);
      return { data: null, error: fetchError };
    }

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Eintrag existiert, aktualisieren wir diesen
      result = await supabase
        .from('size_entries')
        .update({
          size: entry.weight,
          subject,
          baby_id: babyId,
          notes: entry.notes && entry.notes.trim().length > 0 ? entry.notes.trim() : null,
          updated_at: now
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Wenn kein Eintrag existiert, erstellen wir einen neuen
      result = await supabase
        .from('size_entries')
        .insert({
          user_id: userData.user.id,
          date: entry.date,
          size: entry.weight,
          subject,
          baby_id: babyId,
          notes: entry.notes,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to save size entry:', err);
    return { data: null, error: err };
  }
};

// Alle Groessendaten abrufen
export const getSizeEntries = async (subject?: SizeSubject, babyId?: string | null) => {
  try {
    const { data: userData, error: userErr } = await getCachedUser();
    if (userErr) return { data: null, error: userErr };
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const myId = userData.user.id;

    let query = supabase
      .from('size_entries')
      .select('*')
      .order('date', { ascending: true });

    if (subject === 'baby') {
      if (!babyId) {
        return { data: [], error: null };
      }
      query = query.eq('subject', 'baby').eq('baby_id', babyId);
    } else if (subject === 'mom') {
      query = query.eq('user_id', myId).eq('subject', 'mom');
    } else {
      if (babyId) {
        query = query.or(
          `and(user_id.eq.${myId},subject.eq.mom),and(subject.eq.baby,baby_id.eq.${babyId})`
        );
      } else {
        query = query.eq('user_id', myId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching size entries:', error);
      return { data: null, error };
    }

    const normalized = (data ?? []).map((entry: any) => ({
      ...entry,
      weight: entry.size,
      subject: entry.subject ?? 'baby',
    })) as SizeEntry[];

    return { data: normalized, error: null };
  } catch (err) {
    console.error('Failed to get size entries:', err);
    return { data: null, error: err };
  }
};

// Groesseneintrag loeschen
export const deleteSizeEntry = async (id: string) => {
  try {
    const { error } = await supabase
      .from('size_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting size entry:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Failed to delete size entry:', err);
    return { error: err };
  }
};
