import { supabase } from "./supabase";
import { SleepEntry, SleepQuality, ConnectedUser } from "./sleepData";
import { setupSleepEntriesRealtime, cleanupSleepEntriesRealtime } from "./realtimeSyncHelpers";

/**
 * Verbesserte Funktion zum Laden verbundener Benutzer
 * Verwendet automatisch die besser funktionierende Methode
 */
export async function loadConnectedUsers(preferAlternative = false): Promise<{
  success: boolean;
  linkedUsers?: ConnectedUser[];
  error?: string;
  methodUsed?: string;
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      console.log('loadConnectedUsers: Kein Benutzer angemeldet');
      return { success: false, error: 'Kein Benutzer angemeldet' };
    }

    // Vereinfachte Abfrage ohne JOIN - prüft nur, ob die UUID in account_links existiert
    const { data: links, error: linksError } = await supabase
      .from('account_links')
      .select('*')
      .or(`creator_id.eq.${user.user.id},invited_id.eq.${user.user.id}`)
      .eq('status', 'accepted');

    if (linksError) {
      console.error('loadConnectedUsers: Fehler beim Laden der account_links:', linksError);
      return { success: false, error: linksError.message };
    }

    // Keine Links gefunden
    if (!links || links.length === 0) {
      console.log('loadConnectedUsers: Keine Verknüpfungen gefunden');
      return { success: true, linkedUsers: [], methodUsed: 'direct_query' };
    }

    // Vereinfachte Verarbeitung ohne Profildaten
    const linkedUsers: ConnectedUser[] = links.map(link => {
      const isCreator = link.creator_id === user.user.id;
      const partnerId = isCreator ? link.invited_id : link.creator_id;
      
      // Ohne Profile-Join verwenden wir nur die IDs
      return {
        userId: partnerId,
        displayName: `Partner-ID: ${partnerId}`,  // Keine Namen mehr verfügbar
        linkRole: isCreator ? 'creator' : 'invited',
        relationship: link.relationship_type || 'partner',
        status: link.status || 'accepted'
      };
    });

    console.log('loadConnectedUsers: Verarbeitete Benutzer', JSON.stringify(linkedUsers));
    
    return { 
      success: true, 
      linkedUsers,
      methodUsed: 'direct_query'
    };
  } catch (error) {
    console.error('loadConnectedUsers: Unbehandelter Fehler:', error);
    return { 
      success: false, 
      error: String(error),
      methodUsed: 'error'
    };
  }
}

/**
 * Verbesserte Funktion zum Laden aller Schlafeinträge (eigene und geteilte)
 */
export async function loadAllSleepEntries(): Promise<{
  success: boolean;
  entries?: SleepEntry[];
  error?: string;
  linkedUsers?: ConnectedUser[];
}> {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      console.error('loadAllSleepEntries: Nicht angemeldet');
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('loadAllSleepEntries: Lade Einträge für Benutzer', userData.user.id);
    
    // Direkte Datenbankabfrage für alle Einträge, die dem Benutzer gehören oder mit ihm geteilt wurden
    const { data, error } = await supabase
      .from('sleep_entries')
      .select('*')
      .or(`user_id.eq.${userData.user.id},shared_with_user_id.eq.${userData.user.id}`)
      .order('start_time', { ascending: false });
    
    if (error) {
      console.error('loadAllSleepEntries: Datenbankfehler:', error);
      return { success: false, error: error.message };
    }

    console.log(`loadAllSleepEntries: ${data?.length || 0} Einträge geladen`);
    
    // Wenn keine Daten vorhanden sind, gib eine leere Liste zurück
    if (!data || data.length === 0) {
      return { success: true, entries: [] };
    }
    
    // Verbundene Benutzer laden
    const linkedUsersResult = await loadConnectedUsers();
    const linkedUsers = linkedUsersResult.success ? linkedUsersResult.linkedUsers : [];
    
    // Daten für die Anzeige aufbereiten
    const processedEntries = data.map(entry => {
      // Konvertiere Datumsstrings in Date-Objekte
      const processedEntry: SleepEntry = {
        ...entry,
        start_time: typeof entry.start_time === 'string' ? new Date(entry.start_time) : entry.start_time,
        end_time: entry.end_time && typeof entry.end_time === 'string' ? new Date(entry.end_time) : entry.end_time
      };
      
      // Besitzernamen hinzufügen, wenn der Eintrag von einem anderen Benutzer stammt
      if (entry.user_id !== userData.user.id) {
        const owner = linkedUsers?.find(user => user.userId === entry.user_id);
        if (owner) {
          processedEntry.owner_name = owner.displayName;
        }
      }
      
      return processedEntry;
    });
    
    return { 
      success: true, 
      entries: processedEntries,
      linkedUsers: linkedUsers || []
    };
  } catch (error) {
    console.error('loadAllSleepEntries: Unerwarteter Fehler:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
  }
}

/**
 * Verbesserte Funktion zum Synchronisieren aller vorhandenen Schlafeinträge
 */
export async function syncAllSleepEntries(): Promise<{
  success: boolean;
  syncedCount?: number;
  message?: string;
  error?: string;
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      return { success: false, error: 'Kein Benutzer angemeldet' };
    }

    // Verbundene Benutzer laden
    const linkedUsersResult = await loadConnectedUsers();
    if (!linkedUsersResult.success) {
      console.error('syncAllSleepEntries: Fehler beim Laden verbundener Benutzer:', linkedUsersResult.error);
      return { success: false, error: linkedUsersResult.error };
    }

    const linkedUsers = linkedUsersResult.linkedUsers || [];
    if (linkedUsers.length === 0) {
      return { 
        success: true, 
        syncedCount: 0, 
        message: 'Keine verbundenen Benutzer zum Synchronisieren gefunden.' 
      };
    }

    // Eigene Schlafeinträge laden, die noch nicht geteilt wurden
    const { data: ownEntries, error: ownEntriesError } = await supabase
      .from('sleep_entries')
      .select('*')
      .eq('user_id', user.user.id)
      .is('shared_with_user_id', null);

    if (ownEntriesError) {
      console.error('syncAllSleepEntries: Fehler beim Laden eigener Schlafeinträge:', ownEntriesError);
      return { success: false, error: ownEntriesError.message };
    }

    // Zähler für synchronisierte Einträge
    let syncedCount = 0;

    // Für jeden verbundenen Benutzer teilen wir unsere Einträge
    for (const linkedUser of linkedUsers) {
      for (const entry of ownEntries || []) {
        const { error: shareError } = await supabase
          .from('sleep_entries')
          .update({ shared_with_user_id: linkedUser.userId })
          .eq('id', entry.id);

        if (shareError) {
          console.error(`syncAllSleepEntries: Fehler beim Teilen des Eintrags ${entry.id} mit ${linkedUser.userId}:`, shareError);
        } else {
          syncedCount++;
        }
      }
    }

    return {
      success: true,
      syncedCount,
      message: syncedCount > 0 
        ? `${syncedCount} Einträge wurden erfolgreich synchronisiert.`
        : 'Keine Einträge wurden synchronisiert.'
    };
  } catch (error) {
    console.error('syncAllSleepEntries: Fehler bei der Synchronisierung:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Funktion zum Teilen eines einzelnen Schlafeintrags mit einem verbundenen Benutzer
 */
export async function shareSleepEntryImproved(
  entryId: string,
  partnerId: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log(`shareSleepEntryImproved: Teile Eintrag ${entryId} mit Benutzer ${partnerId}`);
    
    // Prüfen, ob der Benutzer tatsächlich verbunden ist
    const connectedUsersResult = await loadConnectedUsers();
    if (!connectedUsersResult.success) {
      return { success: false, error: 'Fehler beim Laden verbundener Benutzer' };
    }
    
    const connectedUsers = connectedUsersResult.linkedUsers || [];
    const isConnected = connectedUsers.some(user => user.userId === partnerId);
    
    if (!isConnected) {
      return { 
        success: false, 
        error: 'Dieser Benutzer ist nicht mit Ihrem Konto verbunden' 
      };
    }
    
    // Eintrag teilen (direkte Datenbankabfrage)
    const { error } = await supabase
      .from('sleep_entries')
      .update({ shared_with_user_id: partnerId })
      .eq('id', entryId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('shareSleepEntryImproved: Fehler beim Teilen des Eintrags:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Eintrag erfolgreich geteilt'
    };
  } catch (error) {
    console.error('shareSleepEntryImproved: Unbehandelter Fehler:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Funktion zum Aufheben der Freigabe eines Schlafeintrags
 */
export async function unshareSleepEntryImproved(
  entryId: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log(`unshareSleepEntryImproved: Hebe Freigabe für Eintrag ${entryId} auf`);
    
    // Direkte Datenbankabfrage
    const { error } = await supabase
      .from('sleep_entries')
      .update({ shared_with_user_id: null })
      .eq('id', entryId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('unshareSleepEntryImproved: Fehler beim Aufheben der Freigabe:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Freigabe erfolgreich aufgehoben'
    };
  } catch (error) {
    console.error('unshareSleepEntryImproved: Unbehandelter Fehler:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Aktiviere die Echtzeit-Synchronisierung für Schlafeinträge
 * @param callback Funktion, die aufgerufen wird, wenn sich Daten ändern
 */
export async function activateRealtimeSync(callback: (payload: any) => void): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  // Echtzeit-Abonnement einrichten
  const result = await setupSleepEntriesRealtime(callback);
  if (!result.success) {
    return result;
  }
  
  // Sofortige Synchronisierung, um sicherzustellen, dass alle Daten aktuell sind
  const syncResult = await syncAllSleepEntries();
  if (!syncResult.success) {
    console.warn('activateRealtimeSync: Initiale Synchronisierung fehlgeschlagen, aber Realtime ist aktiv:', syncResult.error);
  }
  
  return {
    success: true,
    message: syncResult.success 
      ? `Echtzeit-Synchronisierung aktiviert. ${syncResult.message}` 
      : 'Echtzeit-Synchronisierung aktiviert, aber initiale Synchronisierung fehlgeschlagen.'
  };
}

/**
 * Deaktiviere die Echtzeit-Synchronisierung für Schlafeinträge
 */
export async function deactivateRealtimeSync(): Promise<void> {
  await cleanupSleepEntriesRealtime();
}
