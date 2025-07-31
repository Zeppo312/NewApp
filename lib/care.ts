import { supabase } from './supabase';

export interface CareEntry {
  id?: string;
  user_id?: string;
  entry_date: string;
  entry_type: 'feeding' | 'diaper';
  diaper_type?: 'wet' | 'poop' | 'both';
  feeding_type?: 'breast' | 'bottle' | 'solid';
  breast_side?: 'left' | 'right' | 'both';
  bottle_amount?: number;
  start_time: string;
  end_time?: string;
  notes?: string;
}

export const getCareEntries = async (date?: Date) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let query = supabase
      .from('baby_care_entries')
      .select('*')
      .order('start_time', { ascending: false });

    if (date) {
      const start = new Date(date);
      start.setHours(0,0,0,0);
      const end = new Date(date);
      end.setHours(23,59,59,999);
      query = query.gte('entry_date', start.toISOString()).lte('entry_date', end.toISOString());
    }

    const { data, error } = await query;
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const saveCareEntry = async (entry: CareEntry) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    if (entry.id) {
      const { data, error } = await supabase
        .from('baby_care_entries')
        .update({ ...entry, updated_at: new Date().toISOString() })
        .eq('id', entry.id)
        .eq('user_id', userData.user.id)
        .select()
        .single();
      return { data, error };
    } else {
      const { data, error } = await supabase
        .from('baby_care_entries')
        .insert({
          user_id: userData.user.id,
          ...entry,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      return { data, error };
    }
  } catch (err) {
    return { data: null, error: err };
  }
};

export const deleteCareEntry = async (id: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };
    const { data, error } = await supabase
      .from('baby_care_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id);
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
};
