import { supabase, getCachedUser } from "./supabase";
import type { SleepEntry, ConnectedUser } from "./sleepData";

// Interface für geteilte Einträge
export interface SleepEntryShare {
  id: string;
  entry_id: string;
  owner_id: string;
  shared_with_id: string;
  created_at: string;
}

/**
 * Lädt alle sichtbaren Schlafeinträge (eigene und geteilte)
 */
export async function loadAllVisibleSleepEntries(babyId?: string): Promise<{
  success: boolean;
  entries?: SleepEntry[];
  error?: string;
}> {
  try {
    const { data: user } = await getCachedUser();
    if (!user || !user.user) {
      console.log('loadAllVisibleSleepEntries: Kein Benutzer angemeldet');
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('loadAllVisibleSleepEntries: Lade Einträge für Benutzer', user.user.id);

    const allEntries: SleepEntry[] = [];

    // 1) RPC (explicit parameter to avoid overload ambiguity in PostgREST)
    const { data: rpcEntries, error: rpcError } = await supabase.rpc(
      'get_all_visible_sleep_entries',
      { p_baby_id: babyId ?? null }
    );
    if (rpcError) {
      console.error('loadAllVisibleSleepEntries: Fehler beim Laden per RPC:', rpcError);
    } else if (rpcEntries) {
      const scopedEntries = babyId
        ? rpcEntries.filter((entry: SleepEntry) => entry.baby_id === babyId)
        : rpcEntries;
      allEntries.push(...scopedEntries);
    }

    // 2) Direkter Abruf, der auch partner_id und legacy shared_with_user_id berücksichtigt
    let partnerQuery = supabase
      .from('sleep_entries')
      .select('*')
      .or(`user_id.eq.${user.user.id},partner_id.eq.${user.user.id},shared_with_user_id.eq.${user.user.id}`);

    if (babyId) {
      partnerQuery = partnerQuery.eq('baby_id', babyId);
    }

    const { data: partnerVisible, error: partnerError } = await partnerQuery.order('start_time', { ascending: false });

    if (partnerError && !partnerError.message?.includes('does not exist')) {
      console.error('loadAllVisibleSleepEntries: Fehler beim Laden von Partner-Einträgen:', partnerError);
    } else if (partnerVisible) {
      allEntries.push(...partnerVisible);
    }

    // 3) Einträge, die über die neue Share-Tabelle geteilt wurden
    let tableQuery = supabase
      .from('sleep_entries')
      .select('*, sleep_entry_shares!inner(shared_with_id)')
      .eq('sleep_entry_shares.shared_with_id', user.user.id);

    if (babyId) {
      tableQuery = tableQuery.eq('baby_id', babyId);
    }

    const { data: tableShared, error: tableSharedError } = await tableQuery.order('start_time', { ascending: false });

    if (tableSharedError && !tableSharedError.message?.includes('does not exist')) {
      console.error('loadAllVisibleSleepEntries: Fehler beim Laden der über Tabelle geteilten Einträge:', tableSharedError);
    } else if (tableShared) {
      allEntries.push(...tableShared);
    }

    // Deduplizieren nach ID und sortieren (neueste zuerst)
    const deduped = Object.values(
      allEntries.reduce((acc, entry) => {
        if (entry.id && !acc[entry.id]) {
          acc[entry.id] = entry;
        }
        return acc;
      }, {} as Record<string, SleepEntry>)
    ).sort((a, b) => {
      const aTime = a.start_time ? new Date(a.start_time).getTime() : 0;
      const bTime = b.start_time ? new Date(b.start_time).getTime() : 0;
      return bTime - aTime;
    });

    console.log(`loadAllVisibleSleepEntries: ${deduped.length} Einträge geladen (inkl. Partner & Shares)`);
    return { success: true, entries: deduped };
  } catch (error) {
    console.error('loadAllVisibleSleepEntries: Unerwarteter Fehler:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Teilt einen Schlafeintrag mit einem Partner
 */
export async function shareEntryWithPartner(
  entryId: string,
  partnerId: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { data: user } = await getCachedUser();
    if (!user || !user.user) {
      console.log('shareEntryWithPartner: Kein Benutzer angemeldet');
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log(`shareEntryWithPartner: Teile Eintrag ${entryId} mit Partner ${partnerId}`);
    
    // Versuche zuerst die neue Funktion
    const { data, error } = await supabase.rpc('share_sleep_entry_v2', {
      p_entry_id: entryId,
      p_partner_id: partnerId
    });

    if (error) {
      console.error('shareEntryWithPartner: Fehler beim Teilen (neue Methode):', error);
      
      // Fallback: Direkte Freigabe über shared_with_user_id
      console.log('shareEntryWithPartner: Fallback - Direkte Spalte aktualisieren');
      
      const { error: updateError } = await supabase
        .from('sleep_entries')
        .update({ shared_with_user_id: partnerId })
        .eq('id', entryId)
        .eq('user_id', user.user.id);
        
      if (updateError) {
        console.error('shareEntryWithPartner: Fallback fehlgeschlagen:', updateError);
        return { success: false, error: updateError.message };
      }
      
      return { 
        success: true, 
        message: 'Eintrag erfolgreich geteilt (Fallback-Methode)'
      };
    }

    // Erfolg der RPC-Funktion überprüfen
    if (!data.success) {
      console.error('shareEntryWithPartner: RPC meldet Fehler:', data.error);
      return { success: false, error: data.error };
    }

    return { 
      success: true, 
      message: data.message || 'Eintrag erfolgreich geteilt'
    };
  } catch (error) {
    console.error('shareEntryWithPartner: Unerwarteter Fehler:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Hebt die Freigabe eines Schlafeintrags auf
 */
export async function unshareEntry(
  entryId: string,
  partnerId?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { data: user } = await getCachedUser();
    if (!user || !user.user) {
      console.log('unshareEntry: Kein Benutzer angemeldet');
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log(`unshareEntry: Hebe Freigabe für Eintrag ${entryId} auf`);
    
    // Versuche zuerst die neue Funktion
    const { data, error } = await supabase.rpc('unshare_sleep_entry_v2', {
      p_entry_id: entryId,
      p_partner_id: partnerId || null
    });

    if (error) {
      console.error('unshareEntry: Fehler beim Aufheben der Freigabe (neue Methode):', error);
      
      // Fallback: Direkte Aktualisierung über shared_with_user_id
      console.log('unshareEntry: Fallback - Direkte Spalte aktualisieren');
      
      const { error: updateError } = await supabase
        .from('sleep_entries')
        .update({ shared_with_user_id: null })
        .eq('id', entryId)
        .eq('user_id', user.user.id);
        
      if (updateError) {
        console.error('unshareEntry: Fallback fehlgeschlagen:', updateError);
        return { success: false, error: updateError.message };
      }
      
      return { 
        success: true, 
        message: 'Freigabe erfolgreich aufgehoben (Fallback-Methode)'
      };
    }

    return { 
      success: true, 
      message: data.message || 'Freigabe erfolgreich aufgehoben'
    };
  } catch (error) {
    console.error('unshareEntry: Unerwarteter Fehler:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Migration von alten geteilten Einträgen zur neuen Tabelle
 * Nur für Administratoren
 */
export async function migrateSharedEntries(): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  try {
    const { data: user } = await getCachedUser();
    if (!user || !user.user) {
      console.log('migrateSharedEntries: Kein Benutzer angemeldet');
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('migrateSharedEntries: Starte Migration für Benutzer', user.user.id);
    
    // RPC-Funktion aufrufen
    const { data, error } = await supabase.rpc('migrate_existing_shared_entries');

    if (error) {
      console.error('migrateSharedEntries: Fehler bei der Migration:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      result: data
    };
  } catch (error) {
    console.error('migrateSharedEntries: Unerwarteter Fehler:', error);
    return { success: false, error: String(error) };
  }
} 
