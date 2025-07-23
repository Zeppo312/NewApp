import { supabase } from "./supabase";
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
export async function loadAllVisibleSleepEntries(): Promise<{
  success: boolean;
  entries?: SleepEntry[];
  error?: string;
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      console.log('loadAllVisibleSleepEntries: Kein Benutzer angemeldet');
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('loadAllVisibleSleepEntries: Lade Einträge für Benutzer', user.user.id);
    
    // Neue Funktion nutzen, die alles in einem Rutsch lädt
    const { data, error } = await supabase.rpc('get_all_visible_sleep_entries');

    if (error) {
      console.error('loadAllVisibleSleepEntries: Fehler beim Laden der Einträge:', error);
      
      // Fallback: Direkte Abfrage
      console.log('loadAllVisibleSleepEntries: Fallback - Direktabfrage');
      
      // Eigene Einträge
      const { data: ownEntries, error: ownError } = await supabase
        .from('sleep_entries')
        .select('*')
        .eq('user_id', user.user.id);
        
      if (ownError) {
        console.error('loadAllVisibleSleepEntries: Fehler beim Laden eigener Einträge:', ownError);
        return { success: false, error: ownError.message };
      }
      
      // Mit dem Benutzer geteilte Einträge
      const { data: sharedEntries, error: sharedError } = await supabase
        .from('sleep_entries')
        .select('*')
        .eq('shared_with_user_id', user.user.id);
        
      if (sharedError && !sharedError.message.includes('does not exist')) {
        console.error('loadAllVisibleSleepEntries: Fehler beim Laden geteilter Einträge:', sharedError);
        // Ignoriere Fehler wegen nicht existierender Spalte
      }
      
      // Alternative Methode über die neue Verknüpfungstabelle
      const { data: linkedEntries, error: linkedError } = await supabase
        .from('sleep_entries')
        .select(`
          *,
          sleep_entry_shares!inner (
            id
          )
        `)
        .eq('sleep_entry_shares.shared_with_id', user.user.id);
        
      if (linkedError && !linkedError.message.includes('does not exist')) {
        console.error('loadAllVisibleSleepEntries: Fehler beim Laden verknüpfter Einträge:', linkedError);
        // Ignoriere Fehler wegen nicht existierender Tabelle
      }
      
      // Kombiniere alle Einträge und entferne Duplikate
      const allEntries = [
        ...(ownEntries || []),
        ...(sharedEntries || []),
        ...(linkedEntries || [])
      ];
      
      // Deduplizieren nach ID
      const uniqueEntries = allEntries.reduce((acc, entry) => {
        if (!acc.some((e: SleepEntry) => e.id === entry.id)) {
          acc.push(entry);
        }
        return acc;
      }, [] as SleepEntry[]);
      
      return { success: true, entries: uniqueEntries };
    }

    console.log(`loadAllVisibleSleepEntries: ${data?.length || 0} Einträge geladen`);
    return { success: true, entries: data || [] };
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
    const { data: user } = await supabase.auth.getUser();
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
    const { data: user } = await supabase.auth.getUser();
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
    const { data: user } = await supabase.auth.getUser();
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