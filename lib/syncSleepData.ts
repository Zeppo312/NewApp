import { supabase } from "./supabase";

interface UserConnection {
  id: string;
  inviter_id: string;
  invited_id: string;
  created_at: string;
  status: 'active' | 'pending' | 'declined';
}

/**
 * Synchronisiert die Schlafdaten zwischen verbundenen Nutzern.
 * Beide Nutzer erhalten exakt die gleichen Einträge.
 * 
 * @param userId Die ID des aktuellen Benutzers
 * @returns Ein Objekt mit Informationen über den Synchronisierungsstatus
 */
export async function syncSleepData(userId: string) {
  try {
    console.log('Starte Synchronisierung für Benutzer:', userId);
    
    // Finde alle verbundenen Benutzer
    const linkedUsers = await getLinkedUsers(userId);
    
    if (!linkedUsers || linkedUsers.length === 0) {
      return { 
        success: false, 
        error: 'Keine aktive Verbindung gefunden',
        details: 'Es konnte keine aktive Benutzerverbindung gefunden werden.'
      };
    }
    
    console.log(`Gefunden: ${linkedUsers.length} verbundene Benutzer`);
    
    let totalSyncedItems = 0;
    
    // Für jeden verbundenen Benutzer
    for (const linkedUser of linkedUsers) {
      console.log(`Synchronisiere mit Benutzer: ${linkedUser.userId}`);
      
      // Volle Synchronisierung in beide Richtungen für identische Datensätze
      const result = await fullSyncBetweenUsers(userId, linkedUser.userId);
      totalSyncedItems += result.syncedItems || 0;
    }
    
    // Aktualisiere die Synced-At-Zeit in der Datenbank, um das UI zu aktualisieren
    await updateSyncTimestamp(userId);
    
    return { 
      success: true, 
      message: `${totalSyncedItems} Schlafeinträge wurden erfolgreich synchronisiert.`,
      syncedItems: totalSyncedItems
    };
  } catch (error) {
    console.error('Unerwarteter Fehler bei der Synchronisierung:', error);
    return { success: false, error: 'Unerwarteter Fehler bei der Synchronisierung', details: error };
  }
}

/**
 * Aktualisiert den Synchronisierungszeitstempel für einen Benutzer
 */
async function updateSyncTimestamp(userId: string) {
  try {
    // Suche nach vorhandenen Verbindungen
    const { data: connections } = await supabase
      .from('account_links')
      .select('id')
      .or(`source_user_id.eq.${userId},target_user_id.eq.${userId}`);
      
    if (connections && connections.length > 0) {
      // Aktualisiere den Zeitstempel für alle Verbindungen dieses Benutzers
      await supabase
        .from('account_links')
        .update({ last_synced_at: new Date().toISOString() })
        .or(`source_user_id.eq.${userId},target_user_id.eq.${userId}`);
    }
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Sync-Zeitstempels:', error);
  }
}

/**
 * Führt eine vollständige Synchronisierung zwischen zwei Benutzern durch.
 * Beide Benutzer erhalten exakt die gleichen Einträge.
 */
async function fullSyncBetweenUsers(user1Id: string, user2Id: string) {
  try {
    console.log(`Vollständige Synchronisierung zwischen ${user1Id} und ${user2Id}`);
    
    // Alle Schlafdaten des ersten Benutzers abrufen
    const { data: user1Entries, error: user1Error } = await supabase
      .from('baby_sleep_tracking')
      .select('*')
      .eq('user_id', user1Id);

    if (user1Error) {
      console.error('Fehler beim Abrufen der Daten von Benutzer 1:', user1Error);
      return { success: false, error: 'Fehler beim Abrufen der Daten', syncedItems: 0 };
    }

    // Alle Schlafdaten des zweiten Benutzers abrufen
    const { data: user2Entries, error: user2Error } = await supabase
      .from('baby_sleep_tracking')
      .select('*')
      .eq('user_id', user2Id);

    if (user2Error) {
      console.error('Fehler beim Abrufen der Daten von Benutzer 2:', user2Error);
      return { success: false, error: 'Fehler beim Abrufen der Daten', syncedItems: 0 };
    }

    console.log(`Benutzer 1 hat ${user1Entries?.length || 0} Einträge`);
    console.log(`Benutzer 2 hat ${user2Entries?.length || 0} Einträge`);

    // Korrigiere die Dauer für alle Einträge
    const correctedUser1Entries = (user1Entries || []).map(ensureCorrectDuration);
    const correctedUser2Entries = (user2Entries || []).map(ensureCorrectDuration);

    // Erstelle einen gemeinsamen Satz von allen Einträgen
    const allEntries = [...correctedUser1Entries, ...correctedUser2Entries];
    
    // Finde eindeutige Einträge basierend auf ihrer Zeit
    const uniqueEntries = [];
    const seenTimeKeys = new Set();
    
    for (const entry of allEntries) {
      // Erstelle einen normalisieren Zeitschlüssel, der robust gegen Millisekunden-Unterschiede ist
      const startTime = normalizeTimestamp(entry.start_time);
      const endTime = entry.end_time ? normalizeTimestamp(entry.end_time) : '';
      const timeKey = `${startTime}-${endTime}-${entry.duration_minutes || 0}`;
      
      if (!seenTimeKeys.has(timeKey)) {
        seenTimeKeys.add(timeKey);
        uniqueEntries.push(entry);
      }
    }
    
    console.log(`Gemeinsame Einträge: ${uniqueEntries.length}`);
    
    // Synchronisiere Benutzer 1
    const syncResult1 = await syncUserWithEntries(user1Id, uniqueEntries, correctedUser1Entries);
    
    // Synchronisiere Benutzer 2
    const syncResult2 = await syncUserWithEntries(user2Id, uniqueEntries, correctedUser2Entries);
    
    const totalSynced = syncResult1.syncedItems + syncResult2.syncedItems;
    console.log(`Insgesamt ${totalSynced} Einträge synchronisiert`);
    
    return { success: true, syncedItems: totalSynced };
  } catch (error) {
    console.error('Fehler bei der Synchronisierung zwischen Benutzern:', error);
    return { success: false, error, syncedItems: 0 };
  }
}

/**
 * Stellt sicher, dass das Dauer-Feld korrekt berechnet ist
 */
function ensureCorrectDuration(entry: any): any {
  if (!entry) return entry;
  
  try {
    // Wenn Start- und Endzeit vorhanden sind, berechne die Dauer
    if (entry.start_time && entry.end_time) {
      const startTime = new Date(entry.start_time);
      const endTime = new Date(entry.end_time);
      
      // Berechne Dauer in Minuten
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      
      // Wenn durationMinutes fehlt oder falsch ist, korrigiere es
      if (!entry.duration_minutes || entry.duration_minutes !== durationMinutes) {
        console.log(`Korrigiere Dauer für Eintrag ${entry.id} von ${entry.duration_minutes} auf ${durationMinutes} Minuten`);
        return {
          ...entry,
          duration_minutes: durationMinutes
        };
      }
    }
  } catch (e) {
    console.error('Fehler bei der Berechnung der Dauer:', e);
  }
  
  return entry;
}

/**
 * Normalisiert einen Zeitstempel, um Vergleiche robuster zu machen
 */
function normalizeTimestamp(timestamp: string): string {
  try {
    // Konvertiere zu Datum und runde auf Sekunden (entferne Millisekunden)
    const date = new Date(timestamp);
    return date.toISOString().split('.')[0]; // Entferne Millisekunden
  } catch (e) {
    // Bei ungültigem Datumsformat den Original-Zeitstempel zurückgeben
    return timestamp;
  }
}

/**
 * Synchronisiert einen Benutzer mit einer Liste von Einträgen.
 * Fügt fehlende Einträge hinzu, um zu gewährleisten, dass der Benutzer 
 * genau die Einträge in der uniqueEntries-Liste hat.
 */
async function syncUserWithEntries(userId: string, uniqueEntries: any[], userEntries: any[]) {
  let syncedItems = 0;
  
  // Für jeden eindeutigen Eintrag prüfen, ob der Benutzer ihn bereits hat
  for (const entry of uniqueEntries) {
    // Erstelle normalisierte Zeitschlüssel zum Vergleich
    const entryStartTime = normalizeTimestamp(entry.start_time);
    const entryEndTime = entry.end_time ? normalizeTimestamp(entry.end_time) : '';
    const entryTimeKey = `${entryStartTime}-${entryEndTime}-${entry.duration_minutes || 0}`;
    
    // Prüfe, ob der Benutzer diesen Eintrag bereits hat
    const userHasEntry = userEntries.some(userEntry => {
      const userStartTime = normalizeTimestamp(userEntry.start_time);
      const userEndTime = userEntry.end_time ? normalizeTimestamp(userEntry.end_time) : '';
      const userEntryTimeKey = `${userStartTime}-${userEndTime}-${userEntry.duration_minutes || 0}`;
      return userEntryTimeKey === entryTimeKey;
    });
    
    // Wenn der Benutzer den Eintrag nicht hat, füge ihn hinzu
    if (!userHasEntry) {
      console.log(`Füge Eintrag für Benutzer ${userId} hinzu:`, entry);
      
      // Erstelle eine Kopie des Eintrags für den Benutzer
      const { id, created_at, updated_at, ...entryData } = entry;
      
      const { error: insertError } = await supabase
        .from('baby_sleep_tracking')
        .insert({
          ...entryData,
          user_id: userId,
          synced_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error(`Fehler beim Hinzufügen des Eintrags für Benutzer ${userId}:`, insertError);
      } else {
        syncedItems++;
      }
    }
  }
  
  return { syncedItems };
}

/**
 * Findet alle verknüpften Benutzer für einen Benutzer.
 * 
 * @param userId Die ID des aktuellen Benutzers
 * @returns Ein Array von verknüpften Benutzern oder null
 */
async function getLinkedUsers(userId: string) {
  try {
    // Prüfe in account_links (neuere Implementierung)
    const { data: accountLinks, error: accountLinksError } = await supabase.rpc('get_linked_users_with_info', {
      p_user_id: userId
    });

    if (!accountLinksError && accountLinks?.success && accountLinks.linkedUsers && accountLinks.linkedUsers.length > 0) {
      return accountLinks.linkedUsers.map((link: any) => ({
        userId: link.userId,
        firstName: link.firstName || '',
        lastName: link.lastName || '',
        isInvitee: !!link.isInvitee
      }));
    }

    // Wenn keine account_links gefunden wurden, prüfe in user_connections
    const result = await getConnectedUsers(userId);
    
    if (result.success) {
      const connectedUsers = [];
      
      // Eingeladene Benutzer
      if (result.asInvited && result.asInvited.length > 0) {
        connectedUsers.push(...result.asInvited.map(conn => ({
          userId: conn.inviter_id,
          firstName: conn.inviter?.username || '',
          lastName: conn.inviter?.email || '',
          isInvitee: true
        })));
      }
      
      // Einladende Benutzer
      if (result.asInviter && result.asInviter.length > 0) {
        connectedUsers.push(...result.asInviter.map(conn => ({
          userId: conn.invited_id,
          firstName: conn.invited?.username || '',
          lastName: conn.invited?.email || '',
          isInvitee: false
        })));
      }
      
      return connectedUsers;
    }
    
    return null;
  } catch (error) {
    console.error('Fehler beim Laden der verknüpften Benutzer:', error);
    return null;
  }
}

/**
 * Prüft, ob ein Nutzer mit einem anderen verbunden ist.
 * 
 * @param userId Die ID des Nutzers
 * @returns Ein Objekt mit Informationen über verbundene Nutzer
 */
export async function getConnectedUsers(userId: string) {
  try {
    // Als Eingeladener
    const { data: invitedConnections, error: invitedError } = await supabase
      .from('user_connections')
      .select('*, inviter:inviter_id(id, email, username, avatar_url)')
      .eq('invited_id', userId)
      .eq('status', 'active');

    if (invitedError) {
      console.error('Fehler beim Abrufen der Verbindungen als Eingeladener:', invitedError);
      return { success: false, error: invitedError };
    }

    // Als Einladender
    const { data: inviterConnections, error: inviterError } = await supabase
      .from('user_connections')
      .select('*, invited:invited_id(id, email, username, avatar_url)')
      .eq('inviter_id', userId)
      .eq('status', 'active');

    if (inviterError) {
      console.error('Fehler beim Abrufen der Verbindungen als Einladender:', inviterError);
      return { success: false, error: inviterError };
    }

    return { 
      success: true, 
      asInvited: invitedConnections || [],
      asInviter: inviterConnections || []
    };
  } catch (error) {
    console.error('Unerwarteter Fehler beim Abrufen verbundener Nutzer:', error);
    return { success: false, error };
  }
} 