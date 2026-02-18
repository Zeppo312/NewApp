import { supabase } from './supabase';
import { getCachedUser } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache-Konfiguration für Baby-Liste
const BABY_LIST_CACHE_KEY = 'baby_list_cache_v1';
const BABY_LIST_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 Minuten Cache

// Typen für die Baby-Informationen
export interface BabyInfo {
  id?: string;
  name?: string;
  birth_date?: string | null;
  preferred_bedtime?: string | null;
  weight?: string;
  height?: string;
  photo_url?: string | null;
  baby_gender?: 'male' | 'female' | 'unknown' | string;
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
  baby_id?: string | null;
  entry_date: string;
  entry_type: 'diaper' | 'sleep' | 'feeding' | 'other';
  start_time?: string;
  end_time?: string;
  notes?: string;
  // Optional detailed fields for unified baby care entries
  feeding_type?: 'BREAST' | 'BOTTLE' | 'SOLIDS';
  feeding_volume_ml?: number | null;
  feeding_side?: 'LEFT' | 'RIGHT' | 'BOTH' | null;
  diaper_type?: 'WET' | 'DIRTY' | 'BOTH' | null;
  diaper_fever_measured?: boolean | null;
  diaper_temperature_c?: number | null;
  diaper_suppository_given?: boolean | null;
  diaper_suppository_dose_mg?: number | null;
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

/**
 * Invalidiere Baby-Liste Cache (z.B. nach Baby-Erstellung/-Update)
 */
export const invalidateBabyListCache = async () => {
  try {
    await AsyncStorage.removeItem(BABY_LIST_CACHE_KEY);
    try {
      const { data: userData } = await getCachedUser();
      if (userData.user?.id) {
        await AsyncStorage.removeItem(`${BABY_LIST_CACHE_KEY}_${userData.user.id}`);
      }
    } catch (userCacheError) {
      console.error('Failed to invalidate user baby list cache:', userCacheError);
    }
  } catch (error) {
    console.error('Failed to invalidate baby list cache:', error);
  }
};

/**
 * Sync all partner babies for the current user based on accepted account_links.
 */
export const syncBabiesForLinkedUsers = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { success: false, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase.rpc('sync_babies_for_user_links', {
      p_user_id: userData.user.id,
    });

    if (error) {
      console.error('Error syncing linked babies:', error);
      return { success: false, error };
    }

    await invalidateBabyListCache();
    return { success: true, data };
  } catch (err) {
    console.error('Failed to sync linked babies:', err);
    return { success: false, error: err };
  }
};

// Baby-Informationen mit Cache
export const listBabies = async (forceRefresh = false) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    const userId = userData.user.id;
    const cacheKey = `${BABY_LIST_CACHE_KEY}_${userId}`;

    // 1. Versuche Cache zu laden (nur wenn nicht forceRefresh)
    if (!forceRefresh) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          // Cache ist noch gültig
          if (age < BABY_LIST_CACHE_DURATION_MS) {
            return { data, error: null, fromCache: true };
          }
        }
      } catch (cacheError) {
        console.warn('Cache read failed, fetching fresh data:', cacheError);
      }
    }

    const { data, error } = await supabase
      .from('baby_info')
      .select(`
        *,
        baby_members!inner (
          role
        )
      `)
      .eq('baby_members.user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching member baby list:', error);
    }

    const { data: ownedData, error: ownedError } = await supabase
      .from('baby_info')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (ownedError) {
      console.error('Error fetching owned baby list:', ownedError);
    }

    const combined = [...(data ?? []), ...(ownedData ?? [])];
    const seen = new Set<string>();
    const deduped = combined.filter((baby) => {
      if (!baby?.id || seen.has(baby.id)) return false;
      seen.add(baby.id);
      return true;
    });

    if (deduped.length === 0 && (error || ownedError)) {
      return { data: null, error: error ?? ownedError };
    }

    // 2. Speichere im Cache
    try {
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: deduped,
          timestamp: Date.now(),
        })
      );
    } catch (cacheError) {
      console.warn('Failed to cache baby list:', cacheError);
    }

    return { data: deduped, error: null, fromCache: false };
  } catch (err) {
    console.error('Failed to list babies:', err);
    return { data: null, error: err };
  }
};

export const getBabyInfo = async (babyId?: string) => {
  try {
    if (!babyId) {
      return { data: null, error: new Error('No babyId provided') };
    }

    const { data, error } = await supabase
      .from('baby_info')
      .select('*')
      .eq('id', babyId)
      .single();

    if (error) {
      console.error('Error fetching baby info:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to get baby info:', err);
    return { data: null, error: err };
  }
};

export const createBaby = async (info: BabyInfo = {}) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const userId = userData.user.id;

    // Invalidiere Cache vor Erstellung
    await invalidateBabyListCache();

    const { data: baby, error } = await supabase
      .from('baby_info')
      .insert({
        user_id: userId,
        ...info,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !baby) {
      return { data: null, error };
    }

    const { error: ownerInsertError } = await supabase.from('baby_members').upsert(
      {
        baby_id: baby.id,
        user_id: userId,
        role: 'owner',
      },
      { onConflict: 'baby_id,user_id' },
    );

    if (ownerInsertError) {
      console.error('Failed to add owner to baby_members:', ownerInsertError);
    }

    const { data: links, error: linksError } = await supabase
      .from('account_links')
      .select('creator_id, invited_id')
      .eq('status', 'accepted')
      .or(`creator_id.eq.${userId},invited_id.eq.${userId}`);

    if (linksError) {
      console.error('Failed to load account links for baby sharing:', linksError);
    } else if (links?.length) {
      const partnerIds = new Set<string>();
      for (const link of links) {
        if (link.creator_id && link.creator_id !== userId) {
          partnerIds.add(link.creator_id);
        }
        if (link.invited_id && link.invited_id !== userId) {
          partnerIds.add(link.invited_id);
        }
      }

      if (partnerIds.size > 0) {
        const { error: partnerInsertError } = await supabase
          .from('baby_members')
          .upsert(
            Array.from(partnerIds).map((partnerId) => ({
              baby_id: baby.id,
              user_id: partnerId,
              role: 'partner',
            })),
            { onConflict: 'baby_id,user_id' },
          );

        if (partnerInsertError) {
          console.error('Failed to share baby with linked users:', partnerInsertError);
        }
      }
    }

    return { data: baby, error: null };
  } catch (err) {
    console.error('Failed to create baby info:', err);
    return { data: null, error: err };
  }
};

export const saveBabyInfo = async (info: BabyInfo, babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Invalidiere Cache vor Update
    await invalidateBabyListCache();

    const targetId = babyId ?? info.id;

    if (targetId) {
      const { data: existingData, error: fetchError } = await supabase
        .from('baby_info')
        .select('id')
        .eq('id', targetId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing baby info:', fetchError);
        return { data: null, error: fetchError };
      }

      if (existingData?.id) {
        const result = await supabase
          .from('baby_info')
          .update({
            ...info,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id);

        return { data: result.data, error: result.error };
      }
    }

    const result = await supabase
      .from('baby_info')
      .insert({
        user_id: userData.user.id,
        ...info,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*');

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to save baby info:', err);
    return { data: null, error: err };
  }
};

export const deleteBaby = async (babyId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };
    if (!babyId) return { data: null, error: new Error('Keine babyId angegeben') };

    // Invalidiere Cache vor Löschen
    await invalidateBabyListCache();

    const { error } = await supabase
      .from('baby_info')
      .delete()
      .eq('id', babyId);

    if (error) {
      console.error('Error deleting baby info:', error);
      return { data: null, error };
    }

    return { data: true, error: null };
  } catch (err) {
    console.error('Failed to delete baby info:', err);
    return { data: null, error: err };
  }
};

// Tagebucheinträge
export const getDiaryEntries = async (babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let query = supabase.from('baby_diary').select('*');

    if (babyId) {
      query = query.eq('baby_id', babyId);
    } else {
      query = query.eq('user_id', userData.user.id);
    }

    const { data, error } = await query.order('entry_date', { ascending: false });

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

export const saveDiaryEntry = async (entry: DiaryEntry, babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let result;

    if (entry.id) {
      // Wenn ein ID vorhanden ist, aktualisieren wir den Eintrag
      let updateQuery = supabase
        .from('baby_diary')
        .update({
          ...entry,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)
        .eq('user_id', userData.user.id);

      if (babyId) {
        updateQuery = updateQuery.eq('baby_id', babyId);
      }

      result = await updateQuery;
    } else {
      // Wenn keine ID vorhanden ist, erstellen wir einen neuen Eintrag
      result = await supabase
        .from('baby_diary')
        .insert({
          user_id: userData.user.id,
          baby_id: babyId ?? null,
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

export const deleteDiaryEntry = async (id: string, babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    let query = supabase.from('baby_diary').delete().eq('id', id).eq('user_id', userData.user.id);
    if (babyId) {
      query = query.eq('baby_id', babyId);
    }

    const { data, error } = await query;

    return { data, error };
  } catch (err) {
    console.error('Failed to delete diary entry:', err);
    return { data: null, error: err };
  }
};

// Alltags-Einträge
export const getDailyEntries = async (type?: string, date?: Date, babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    if (babyId) {
      let scopedQuery = supabase
        .from('baby_daily')
        .select('*')
        .eq('baby_id', babyId);

      if (type) {
        scopedQuery = scopedQuery.eq('entry_type', type);
      }

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        scopedQuery = scopedQuery.gte('entry_date', startOfDay.toISOString()).lte('entry_date', endOfDay.toISOString());
      }

      const { data, error } = await scopedQuery.order('entry_date', { ascending: false });
      if (error) {
        console.error('Error fetching daily entries:', error);
        return { data: null, error };
      }

      return { data, error: null };
    }

    // Verwenden der verbesserten RPC-Funktion, wenn verfügbar
    try {
      // Versuche, die Einträge mit Synchronisierungsinformationen abzurufen
      const { data: syncData, error: syncError } = await supabase.rpc('get_daily_entries_with_sync_info', {
        p_user_id: userData.user.id,
        p_date: date ? date.toISOString() : null
      });

      if (!syncError && syncData) {
        console.log('Retrieved daily entries with sync info:', syncData);

        // Filtern nach Typ, wenn angegeben
        let filteredEntries = syncData.entries;
        if (type && filteredEntries) {
          filteredEntries = filteredEntries.filter((entry: any) => entry.entryType === type);
        }

        // Konvertiere die Daten in das erwartete Format
        const formattedEntries = filteredEntries.map((entry: any) => ({
          id: entry.id,
          user_id: userData.user.id,
          baby_id: entry.baby_id ?? entry.babyId ?? null,
          entry_date: entry.entryDate,
          entry_type: entry.entryType,
          start_time: entry.startTime,
          end_time: entry.endTime,
          notes: entry.notes
        }));

        return {
          data: formattedEntries,
          error: null,
          syncInfo: syncData.syncInfo
        };
      }
    } catch (rpcError) {
      console.warn('RPC function not available, falling back to standard query:', rpcError);
    }

    // Fallback: Standard-Abfrage verwenden
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

export const saveDailyEntry = async (entry: DailyEntry, babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    console.log('Saving daily entry:', entry);

    let result;

    if (entry.id) {
      if (babyId) {
        result = await supabase
          .from('baby_daily')
          .update({
            ...entry,
            baby_id: babyId,
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id)
          .eq('user_id', userData.user.id)
          .eq('baby_id', babyId);

        return { data: result.data, error: result.error };
      }

      // Wenn ein ID vorhanden ist, aktualisieren wir den Eintrag mit Synchronisation
      console.log('Updating existing entry with ID:', entry.id);
      try {
        // Verwenden der verbesserten RPC-Funktion für die Synchronisation
        result = await supabase.rpc('update_daily_entry_and_sync', {
          p_user_id: userData.user.id,
          p_entry_id: entry.id,
          p_entry_date: entry.entry_date,
          p_entry_type: entry.entry_type,
          p_start_time: entry.start_time,
          p_end_time: entry.end_time,
          p_notes: entry.notes
        });

        console.log('Entry updated with sync, result:', result);
      } catch (rpcError) {
        console.warn('RPC function not available, falling back to standard update:', rpcError);

        // Fallback: Standard-Update verwenden
      result = await supabase
        .from('baby_daily')
        .update({
          ...entry,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)
          .eq('user_id', userData.user.id);
      }
    } else {
      if (babyId) {
        result = await supabase
          .from('baby_daily')
          .insert({
            user_id: userData.user.id,
            baby_id: babyId,
            entry_date: entry.entry_date,
            entry_type: entry.entry_type,
            start_time: entry.start_time,
            end_time: entry.end_time,
            notes: entry.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        return { data: result.data, error: result.error };
      }

      // Wenn keine ID vorhanden ist, erstellen wir einen neuen Eintrag mit Synchronisation
      console.log('Creating new entry with data:', {
        user_id: userData.user.id,
        entry_date: entry.entry_date,
        entry_type: entry.entry_type,
        start_time: entry.start_time,
        end_time: entry.end_time,
        notes: entry.notes
      });

      try {
        // Verwenden der verbesserten RPC-Funktion für die Synchronisation
        result = await supabase.rpc('add_daily_entry_and_sync', {
          p_user_id: userData.user.id,
          p_entry_date: entry.entry_date,
          p_entry_type: entry.entry_type,
          p_start_time: entry.start_time,
          p_end_time: entry.end_time,
          p_notes: entry.notes
        });

        console.log('Entry created with sync, result:', result);
      } catch (rpcError) {
        console.warn('RPC function not available, falling back to standard insert:', rpcError);

        // Fallback: Standard-Insert verwenden
        result = await supabase
          .from('baby_daily')
          .insert({
            user_id: userData.user.id,
            entry_date: entry.entry_date,
            entry_type: entry.entry_type,
            start_time: entry.start_time,
            end_time: entry.end_time,
            notes: entry.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    }

    if (result.error) {
      console.error('Error saving daily entry:', result.error);
    } else {
      console.log('Entry saved successfully, result:', result);
    }

    return { data: result.data, error: result.error };
  } catch (err) {
    console.error('Failed to save daily entry:', err);
    return { data: null, error: err };
  }
};

export const deleteDailyEntry = async (id: string, babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    console.log('Deleting daily entry with ID:', id);

    let result;

    if (babyId) {
      result = await supabase
        .from('baby_daily')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.user.id)
        .eq('baby_id', babyId);

      return { data: result.data, error: result.error };
    }

    try {
      // Verwenden der verbesserten RPC-Funktion für die Synchronisation
      result = await supabase.rpc('delete_daily_entry_and_sync', {
        p_user_id: userData.user.id,
        p_entry_id: id
      });

      console.log('Entry deleted with sync, result:', result);
    } catch (rpcError) {
      console.warn('RPC function not available, falling back to standard delete:', rpcError);

      // Fallback: Standard-Delete verwenden
      result = await supabase
        .from('baby_daily')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.user.id);
    }

    if (result.error) {
      console.error('Error deleting daily entry:', result.error);
    } else {
      console.log('Entry deleted successfully');
    }

    return { data: result.data, error: result.error };
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
    const { data: userData } = await getCachedUser();
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
    const { data: userData } = await getCachedUser();
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
    const { data: userData } = await getCachedUser();
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
          start_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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
    const { data: userData } = await getCachedUser();
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
          completion_date: isCompleted ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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

export const getDailyEntriesForDateRange = async (startDate: Date, endDate: Date, babyId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    console.log('Fetching entries from', startDate.toISOString(), 'to', endDate.toISOString());

    // Versuche zuerst die RPC-Funktion zu verwenden
    try {
      if (babyId) {
        const { data, error } = await supabase
          .from('baby_daily')
          .select('*')
          .eq('baby_id', babyId)
          .gte('entry_date', startDate.toISOString())
          .lte('entry_date', endDate.toISOString())
          .order('entry_date', { ascending: true });

        if (error) {
          console.error('Error fetching daily entries for date range:', error);
          return { data: null, error };
        }

        console.log('Retrieved daily entries with standard query:', data?.length);
        return { data, error: null };
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_daily_entries_for_date_range', {
        p_user_id: userData.user.id,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (!rpcError && rpcData) {
        console.log('Retrieved daily entries with RPC:', rpcData.length);
        return { data: rpcData, error: null };
      }
    } catch (rpcError) {
      console.warn('RPC function not available, falling back to standard query:', rpcError);
    }

    // Fallback: Standard-Abfrage
    const { data, error } = await supabase
      .from('baby_daily')
      .select('*')
      .eq('user_id', userData.user.id)
      .gte('entry_date', startDate.toISOString())
      .lte('entry_date', endDate.toISOString())
      .order('entry_date', { ascending: true });

    if (error) {
      console.error('Error fetching daily entries for date range:', error);
      return { data: null, error };
    }

    console.log('Retrieved daily entries with standard query:', data?.length);
    return { data, error: null };
  } catch (err) {
    console.error('Failed to get daily entries for date range:', err);
    return { data: null, error: err };
  }
};

// Berechne Statistiken für Alltags-Einträge
export const calculateDailyStats = (entries: DailyEntry[]) => {
  const stats: Record<string, {
    feeding: number;
    diaper: number;
    sleep: number;
    other: number;
    sleepDuration: number;
  }> = {};

  entries.forEach(entry => {
    if (!entry.start_time) return;

    // Extrahiere das Datum ohne Uhrzeit
    const dateStr = new Date(entry.start_time).toISOString().split('T')[0];

    // Initialisiere Statistiken für diesen Tag, falls noch nicht vorhanden
    if (!stats[dateStr]) {
      stats[dateStr] = {
        feeding: 0,
        diaper: 0,
        sleep: 0,
        other: 0,
        sleepDuration: 0
      };
    }

    // Zähle den Eintrag basierend auf dem Typ
    switch (entry.entry_type) {
      case 'feeding':
        stats[dateStr].feeding++;
        break;
      case 'diaper':
        stats[dateStr].diaper++;
        break;
      case 'sleep':
        stats[dateStr].sleep++;
        // Berechne Schlafdauer, wenn End-Zeit vorhanden ist
        if (entry.end_time) {
          const start = new Date(entry.start_time);
          const end = new Date(entry.end_time);
          const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          stats[dateStr].sleepDuration += durationMinutes;
        }
        break;
      case 'other':
        stats[dateStr].other++;
        break;
    }
  });

  return stats;
};

// Feeding Events Interface - matches database schema exactly
export interface FeedingEvent {
  id?: string;
  user_id?: string;
  baby_id?: string;
  type: 'BREAST' | 'BOTTLE' | 'SOLIDS'; // matches public.feeding_type
  start_time: string; // timestamp with time zone
  end_time?: string; // timestamp with time zone
  volume_ml?: number; // integer
  side?: 'LEFT' | 'RIGHT' | 'BOTH'; // matches public.breast_side
  note?: string; // text
  created_at?: string;
  updated_at?: string;
}

export const saveFeedingEvent = async (
  feedingData: FeedingEvent,
  babyId: string
) => {
  try {
    const userData = await getCachedUser();
    if (!userData.data.user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    if (!babyId) {
      return { data: null, error: new Error('No active baby selected') };
    }

    const payload = {
      ...feedingData,
      user_id: userData.data.user.id,
      baby_id: babyId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('feeding_events')
      .insert([payload])
      .select()
      .single();

    if (error) return { data: null, error };

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const updateFeedingEventEnd = async (id: string, endTime: Date) => {
  try {
    const userData = await getCachedUser();
    if (!userData.data.user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    const { data, error } = await supabase
      .from('feeding_events')
      .update({ 
        end_time: endTime.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userData.data.user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating feeding event end time:', error);
      return { data: null, error };
    }

    console.log('Feeding event end time updated successfully:', data);
    return { data, error: null };
  } catch (err) {
    console.error('Failed to update feeding event end time:', err);
    return { data: null, error: err };
  }
};
