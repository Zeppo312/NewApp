import { supabase } from './supabase';

// Typen für die Baby-Informationen
export interface BabyInfo {
  id?: string;
  name?: string;
  birth_date?: string | null;
  weight?: string;
  height?: string;
  photo_url?: string | null;
}

// Typen für die Tagebucheinträge
export interface DiaryEntry {
  id?: string;
  entry_date: string;
  mood?: string;
  content: string;
  photo_url?: string | null;
  phase_id?: string;
  milestone_id?: string;
}

// Typen für die Alltags-Einträge
export interface DailyEntry {
  id?: string;
  entry_date: string;
  entry_type: 'diaper' | 'sleep' | 'feeding' | 'other';
  start_time?: string;
  end_time?: string;
  notes?: string;
}

// Typen für Entwicklungsphasen
export interface DevelopmentPhase {
  id: string;
  phase_number: number;
  title: string;
  description: string;
  age_range: string;
  created_at?: string;
  updated_at?: string;
}

// Typen für Meilensteine
export interface Milestone {
  id: string;
  phase_id: string;
  title: string;
  description: string;
  position: number;
  created_at?: string;
  updated_at?: string;
  is_completed?: boolean; // Für die Anzeige, ob der Meilenstein erreicht wurde
  completion_date?: string | null;
}

// Typen für den Fortschritt bei Meilensteinen
export interface MilestoneProgress {
  id?: string;
  user_id?: string;
  milestone_id: string;
  is_completed: boolean;
  completion_date?: string | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Typen für die aktuelle Phase des Babys
export interface CurrentPhase {
  id?: string;
  user_id?: string;
  phase_id: string;
  start_date: string;
  created_at?: string;
  updated_at?: string;
}

// Baby-Informationen
export const getBabyInfo = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('baby_info')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching baby info:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to get baby info:', err);
    return { data: null, error: err };
  }
};

export const saveBabyInfo = async (info: BabyInfo) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob bereits ein Eintrag existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('baby_info')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing baby info:', fetchError);
      return { data: null, error: fetchError };
    }

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Eintrag existiert, aktualisieren wir diesen
      result = await supabase
        .from('baby_info')
        .update({
          ...info,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id);
    } else {
      // Wenn kein Eintrag existiert, erstellen wir einen neuen
      result = await supabase
        .from('baby_info')
        .insert({
          user_id: userData.user.id,
          ...info,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to save baby info:', err);
    return { data: null, error: err };
  }
};

// Tagebucheinträge
export const getDiaryEntries = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('baby_diary')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching diary entries:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to get diary entries:', err);
    return { data: null, error: err };
  }
};

export const saveDiaryEntry = async (entry: DiaryEntry) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let result;

    if (entry.id) {
      // Wenn ein ID vorhanden ist, aktualisieren wir den Eintrag
      result = await supabase
        .from('baby_diary')
        .update({
          ...entry,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)
        .eq('user_id', userData.user.id);
    } else {
      // Wenn keine ID vorhanden ist, erstellen wir einen neuen Eintrag
      result = await supabase
        .from('baby_diary')
        .insert({
          user_id: userData.user.id,
          ...entry,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to save diary entry:', err);
    return { data: null, error: err };
  }
};

export const deleteDiaryEntry = async (id: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('baby_diary')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id);

    return { data, error };
  } catch (err) {
    console.error('Failed to delete diary entry:', err);
    return { data: null, error: err };
  }
};

// Alltags-Einträge
export const getDailyEntries = async (type?: string, date?: Date) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let query = supabase
      .from('baby_daily')
      .select('*')
      .eq('user_id', userData.user.id);

    if (type) {
      query = query.eq('entry_type', type);
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.gte('entry_date', startOfDay.toISOString())
                  .lte('entry_date', endOfDay.toISOString());
    }

    const { data, error } = await query.order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching daily entries:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to get daily entries:', err);
    return { data: null, error: err };
  }
};

export const saveDailyEntry = async (entry: DailyEntry) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let result;

    if (entry.id) {
      // Wenn ein ID vorhanden ist, aktualisieren wir den Eintrag
      result = await supabase
        .from('baby_daily')
        .update({
          ...entry,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)
        .eq('user_id', userData.user.id);
    } else {
      // Wenn keine ID vorhanden ist, erstellen wir einen neuen Eintrag
      result = await supabase
        .from('baby_daily')
        .insert({
          user_id: userData.user.id,
          ...entry,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to save daily entry:', err);
    return { data: null, error: err };
  }
};

export const deleteDailyEntry = async (id: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('baby_daily')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id);

    return { data, error };
  } catch (err) {
    console.error('Failed to delete daily entry:', err);
    return { data: null, error: err };
  }
};

// Entwicklungsphasen und Meilensteine

// Alle Entwicklungsphasen abrufen
export const getDevelopmentPhases = async () => {
  try {
    const { data, error } = await supabase
      .from('baby_development_phases')
      .select('*')
      .order('phase_number', { ascending: true });

    if (error) {
      console.error('Error fetching development phases:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to get development phases:', err);
    return { data: null, error: err };
  }
};

// Meilensteine für eine bestimmte Phase abrufen
export const getMilestonesByPhase = async (phaseId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Meilensteine abrufen
    const { data: milestones, error: milestonesError } = await supabase
      .from('baby_milestones')
      .select('*')
      .eq('phase_id', phaseId)
      .order('position', { ascending: true });

    if (milestonesError) {
      console.error('Error fetching milestones:', milestonesError);
      return { data: null, error: milestonesError };
    }

    // Fortschritt für diese Meilensteine abrufen
    const { data: progress, error: progressError } = await supabase
      .from('baby_milestone_progress')
      .select('*')
      .eq('user_id', userData.user.id)
      .in('milestone_id', milestones.map(m => m.id));

    if (progressError) {
      console.error('Error fetching milestone progress:', progressError);
      return { data: null, error: progressError };
    }

    // Meilensteine mit Fortschrittsinformationen anreichern
    const enrichedMilestones = milestones.map(milestone => {
      const milestoneProgress = progress?.find(p => p.milestone_id === milestone.id);
      return {
        ...milestone,
        is_completed: milestoneProgress?.is_completed || false,
        completion_date: milestoneProgress?.completion_date || null
      };
    });

    return { data: enrichedMilestones, error: null };
  } catch (err) {
    console.error('Failed to get milestones by phase:', err);
    return { data: null, error: err };
  }
};

// Aktuelle Phase des Babys abrufen
export const getCurrentPhase = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Aktuelle Phase abrufen
    const { data: currentPhase, error: phaseError } = await supabase
      .from('baby_current_phase')
      .select('*, baby_development_phases!inner(*)')
      .eq('user_id', userData.user.id)
      .single();

    if (phaseError && phaseError.code !== 'PGRST116') {
      console.error('Error fetching current phase:', phaseError);
      return { data: null, error: phaseError };
    }

    // Wenn keine aktuelle Phase gefunden wurde, setzen wir Phase 1 als Standard
    if (!currentPhase) {
      const { data: defaultPhase, error: defaultPhaseError } = await supabase
        .from('baby_development_phases')
        .select('*')
        .eq('phase_number', 1)
        .single();

      if (defaultPhaseError) {
        console.error('Error fetching default phase:', defaultPhaseError);
        return { data: null, error: defaultPhaseError };
      }

      return { data: { phase_id: defaultPhase.id, baby_development_phases: defaultPhase }, error: null };
    }

    return { data: currentPhase, error: null };
  } catch (err) {
    console.error('Failed to get current phase:', err);
    return { data: null, error: err };
  }
};

// Aktuelle Phase des Babys setzen oder aktualisieren
export const setCurrentPhase = async (phaseId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob bereits eine aktuelle Phase existiert
    const { data: existingPhase, error: fetchError } = await supabase
      .from('baby_current_phase')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing phase:', fetchError);
      return { data: null, error: fetchError };
    }

    let result;

    if (existingPhase && existingPhase.id) {
      // Wenn eine Phase existiert, aktualisieren wir diese
      result = await supabase
        .from('baby_current_phase')
        .update({
          phase_id: phaseId,
          start_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPhase.id);
    } else {
      // Wenn keine Phase existiert, erstellen wir eine neue
      result = await supabase
        .from('baby_current_phase')
        .insert({
          user_id: userData.user.id,
          phase_id: phaseId,
          start_date: new Date().toISOString()
        });
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to set current phase:', err);
    return { data: null, error: err };
  }
};

// Meilenstein als erreicht oder nicht erreicht markieren
export const toggleMilestone = async (milestoneId: string, isCompleted: boolean) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob bereits ein Fortschritt für diesen Meilenstein existiert
    const { data: existingProgress, error: fetchError } = await supabase
      .from('baby_milestone_progress')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('milestone_id', milestoneId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing progress:', fetchError);
      return { data: null, error: fetchError };
    }

    let result;

    if (existingProgress && existingProgress.id) {
      // Wenn ein Fortschritt existiert, aktualisieren wir diesen
      result = await supabase
        .from('baby_milestone_progress')
        .update({
          is_completed: isCompleted,
          completion_date: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProgress.id);
    } else {
      // Wenn kein Fortschritt existiert, erstellen wir einen neuen
      result = await supabase
        .from('baby_milestone_progress')
        .insert({
          user_id: userData.user.id,
          milestone_id: milestoneId,
          is_completed: isCompleted,
          completion_date: isCompleted ? new Date().toISOString() : null
        });
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to toggle milestone:', err);
    return { data: null, error: err };
  }
};

// Fortschritt für eine Phase berechnen
export const getPhaseProgress = async (phaseId: string) => {
  try {
    const { data: milestones, error: milestonesError } = await getMilestonesByPhase(phaseId);

    if (milestonesError || !milestones) {
      return { progress: 0, completedCount: 0, totalCount: 0, error: milestonesError };
    }

    const totalCount = milestones.length;
    const completedCount = milestones.filter(m => m.is_completed).length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return { progress, completedCount, totalCount, error: null };
  } catch (err) {
    console.error('Failed to calculate phase progress:', err);
    return { progress: 0, completedCount: 0, totalCount: 0, error: err };
  }
};
