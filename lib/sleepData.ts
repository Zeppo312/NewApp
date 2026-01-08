import { supabase } from "./supabase";
import { RealtimeChannel } from '@supabase/supabase-js';

// Sleep Quality type
export type SleepQuality = 'good' | 'medium' | 'bad' | null;

// Interface for a sleep entry
export interface SleepEntry {
  id?: string;
  user_id?: string;
  baby_id?: string | null;
  start_time: Date | string;
  end_time?: Date | string | null;
  duration_minutes?: number;
  notes?: string;
  quality?: SleepQuality;
  created_at?: Date | string;
  updated_at?: Date | string;
  external_id?: string;
  synced_at?: Date | string | null;
  owner_name?: string; // Name of the owner for shared entries
  shared_with_user_id?: string | null; // ID des Benutzers, mit dem der Eintrag geteilt wird (legacy)
  partner_id?: string | null; // ID des Partners für den gemeinsamen Datenraum
  updated_by?: string | null; // Benutzer-ID der Person, die den Eintrag zuletzt bearbeitet hat
}

// Interface for connected users
export interface ConnectedUser {
  userId: string;
  displayName: string;
  linkRole?: string;
  relationship?: string; // Beziehungstyp (partner, family, etc.)
  status?: string;     // Status der Verbindung (accepted, pending, etc.)
}

/**
 * Get linked users with their details
 */
export async function getLinkedUsersWithDetails(): Promise<{
  success: boolean;
  linkedUsers?: ConnectedUser[];
  error?: string;
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      console.log('getLinkedUsersWithDetails: Kein Benutzer angemeldet');
      return { success: false, error: 'Kein Benutzer angemeldet' };
    }

    console.log('getLinkedUsersWithDetails: Suche verknüpfte Benutzer für', user.user.id);

    // Verwende die neue RPC-Funktion für account_links
    const { data, error } = await supabase.rpc(
      'get_linked_users_with_details',
      { p_user_id: user.user.id }
    );

    console.log('getLinkedUsersWithDetails: Ergebnis', JSON.stringify(data), 'Fehler:', error);

    if (error) {
      console.error('Fehler beim Laden der verknüpften Benutzer:', error);
      return { success: false, error: error.message };
    }

    return { success: true, linkedUsers: data || [] };
  } catch (error) {
    console.error('Fehler beim Laden der verknüpften Benutzer:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Alternative Implementierung zum Abrufen verknüpfter Benutzer direkt aus der Datenbank-Tabelle
 * Umgeht mögliche Probleme mit der RPC-Funktion
 */
export async function getLinkedUsersAlternative(): Promise<{
  success: boolean;
  linkedUsers?: ConnectedUser[];
  error?: string;
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      console.log('getLinkedUsersAlternative: Kein Benutzer angemeldet');
      return { success: false, error: 'Kein Benutzer angemeldet' };
    }

    console.log('getLinkedUsersAlternative: Suche Verknüpfungen für', user.user.id);

    // Direkte Abfrage der account_links Tabelle ohne RPC
    const { data: links, error: linksError } = await supabase
      .from('account_links')
      .select(`
        *,
        creator_profile:profiles!creator_profile(id, display_name),
        invited_profile:profiles!invited_profile(id, display_name)
      `)
      .or(`creator_id.eq.${user.user.id},invited_id.eq.${user.user.id}`)
      .eq('status', 'accepted');

    console.log('getLinkedUsersAlternative: Raw results', JSON.stringify(links), 'Error:', linksError);

    if (linksError) {
      console.error('Fehler beim Laden der account_links:', linksError);
      return { success: false, error: linksError.message };
    }

    // Keine Links gefunden
    if (!links || links.length === 0) {
      console.log('getLinkedUsersAlternative: Keine Verknüpfungen gefunden');
      return { success: true, linkedUsers: [] };
    }

    // Verarbeitung der Ergebnisse
    const linkedUsers: ConnectedUser[] = links.map(link => {
      const isCreator = link.creator_id === user.user.id;
      const partnerId = isCreator ? link.invited_id : link.creator_id;
      
      // Zugriff auf die Profildaten
      const partnerProfile = isCreator 
        ? link.invited_profile 
        : link.creator_profile;
      
      const displayName = partnerProfile ? partnerProfile.display_name : 'Unbekannter Benutzer';
      
      return {
        userId: partnerId,
        displayName: displayName,
        linkRole: isCreator ? 'creator' : 'invited'
      };
    });

    console.log('getLinkedUsersAlternative: Verarbeitete Benutzer', JSON.stringify(linkedUsers));
    
    return { success: true, linkedUsers };
  } catch (error) {
    console.error('Fehler beim Laden der verknüpften Benutzer (Alternative):', error);
    return { success: false, error: String(error) };
  }
}

// Globale Variablen für Realtime-Abonnements
let sleepEntriesSubscription: RealtimeChannel | null = null;

/**
 * Setze das Realtime-Abonnement für Schlafeinträge auf
 * - Dies wird einmal beim Start der App aufgerufen
 * - Es sorgt für automatische Updates, wenn Änderungen in der Datenbank erfolgen
 * - Unterstützt das Partner-Modell mit partner_id
 */
export async function setupSleepEntriesRealtime(callback: (payload: any) => void): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Falls bereits ein Abonnement vorhanden ist, erst abmelden
    if (sleepEntriesSubscription) {
      await sleepEntriesSubscription.unsubscribe();
    }

    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('setupSleepEntriesRealtime: Einrichten des Partner-Synchronisierungs-Modells');

    // Neues Abonnement erstellen mit dem verbesserten Partner-Modell
    sleepEntriesSubscription = supabase
      .channel('sleep-entries-duo')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sleep_entries',
          // Erweitere Filter um sowohl partner_id als auch legacy shared_with_user_id zu unterstützen
          filter: `user_id=eq.${userData.user.id} OR partner_id=eq.${userData.user.id} OR shared_with_user_id=eq.${userData.user.id}`
        },
        (payload) => {
          console.log('Sleep entry changed (Partner-Modell):', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status (Partner-Modell):', status);
      });

    return { success: true };
  } catch (error) {
    console.error('setupSleepEntriesRealtime: Fehler beim Einrichten des Realtime-Abonnements:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Bereinige das Realtime-Abonnement (bei Logout oder App-Beendigung)
 */
export async function cleanupSleepEntriesRealtime(): Promise<void> {
  if (sleepEntriesSubscription) {
    await sleepEntriesSubscription.unsubscribe();
    sleepEntriesSubscription = null;
  }
}

// Sync all existing sleep entries with linked users
export async function syncAllExistingSleepEntries(): Promise<{
  success: boolean;
  syncedCount?: number;
  message?: string;
  error?: string;
  linkedUsers?: ConnectedUser[];
}> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      return { success: false, error: 'Kein Benutzer angemeldet' };
    }

    // Zuerst alle verbundenen Benutzer laden
    const linkedUsersResult = await loadConnectedUsers();
    if (!linkedUsersResult.success) {
      console.error('Fehler beim Laden verbundener Benutzer:', linkedUsersResult.error);
      return { success: false, error: linkedUsersResult.error };
    }

    const linkedUsers = linkedUsersResult.linkedUsers || [];
    if (linkedUsers.length === 0) {
      return { 
        success: true, 
        syncedCount: 0, 
        message: 'Keine verbundenen Benutzer zum Synchronisieren gefunden.',
        linkedUsers: []
      };
    }

    // Alle eigenen Schlafeinträge laden, die noch nicht geteilt wurden
    const { data: ownEntries, error: ownEntriesError } = await supabase
      .from('sleep_entries')
      .select('*')
      .eq('user_id', user.user.id)
      .is('shared_with_user_id', null);

    if (ownEntriesError) {
      console.error('Fehler beim Laden eigener Schlafeinträge:', ownEntriesError);
      return { success: false, error: ownEntriesError.message };
    }

    // Zähler für synchronisierte Einträge
    let syncedCount = 0;

    // Für jeden verbundenen Benutzer überprüfen, ob Einträge geteilt werden sollen
    for (const linkedUser of linkedUsers) {
      // Teile die Einträge mit dem verbundenen Benutzer
      for (const entry of ownEntries || []) {
        const { error: shareError } = await supabase
          .from('sleep_entries')
          .update({ shared_with_user_id: linkedUser.userId })
          .eq('id', entry.id);

        if (shareError) {
          console.error(`Fehler beim Teilen des Eintrags ${entry.id} mit ${linkedUser.userId}:`, shareError);
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
        : 'Keine Einträge wurden synchronisiert.',
      linkedUsers
    };
  } catch (error) {
    console.error('Fehler bei der Synchronisierung:', error);
    return { success: false, error: String(error) };
  }
}

// Sleep tracking start - angepasst für Partner-Funktionalität
export async function startSleepTracking(
  targetUserId?: string, // Optional: Benutzer, für den der Eintrag gestartet wird
  partnerOverride?: string | null, // Optional: explizite Partner-ID (z. B. aus dem UI-State)
  babyId?: string
): Promise<{
  success: boolean;
  entry?: SleepEntry;
  error?: string;
  linkedUsers?: ConnectedUser[];
}> {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('startSleepTracking: Start for user', targetUserId || userData.user.id);
    
    // Lade verbundene Benutzer um einen Partner zu ermitteln
    const { success: loadSuccess, linkedUsers, error: loadError } = await loadConnectedUsers();
    
    if (!loadSuccess) {
      console.error('startSleepTracking: Error loading connected users:', loadError);
      // Wir setzen den Vorgang fort, aber ohne Partner
    }
    
    // Partnerinformationen aus account_links-Beziehungen
    let partnerId: string | null = partnerOverride ?? null;
    
    // Log verbundene Benutzer
    if (linkedUsers && linkedUsers.length > 0) {
      console.log(`startSleepTracking: Gefundene Partner aus account_links: ${linkedUsers.length}`);
      linkedUsers.forEach(user => {
        console.log(`startSleepTracking: Partner gefunden - ID: ${user.userId}, Name: ${user.displayName}`);
      });
    } else {
      console.log('startSleepTracking: Keine Partner in account_links gefunden');
    }
    
    // Prüfe, ob Zielbenutzer = aktueller Benutzer oder ein verbundener Nutzer
    if (targetUserId && targetUserId !== userData.user.id) {
      // Prüfen, ob Ziel-User ein verbundener Partner ist
      const matchingPartner = linkedUsers?.find(u => u.userId === targetUserId);
      
      if (!matchingPartner) {
        return { success: false, error: 'Keine Berechtigung zum Starten für diesen Benutzer (nicht in account_links gefunden)' };
      }
      
      console.log(`startSleepTracking: Erstelle Eintrag für Partner ${matchingPartner.displayName}`);
      partnerId = partnerOverride ?? userData.user.id; // Wenn wir für den Partner aufzeichnen, sind wir selbst der Partner
    } else {
      // Wenn wir für uns selbst aufzeichnen, verwenden wir den ersten Partner aus account_links
      if (partnerId) {
        console.log(`startSleepTracking: Partner-ID via Override: ${partnerId}`);
      } else if (linkedUsers && linkedUsers.length > 0) {
        partnerId = linkedUsers[0].userId;
        console.log(`startSleepTracking: Setze Partner-ID auf ${partnerId} (${linkedUsers[0].displayName})`);
      } else {
        console.log('startSleepTracking: Kein Partner in account_links gefunden');
      }
    }
    
    const effectiveUserId = targetUserId || userData.user.id;
    
    // Prüfe zuerst, ob bereits eine aktive Aufzeichnung vorhanden ist
    const { success: checkSuccess, activeEntry, partnerHasActiveEntry, partnerName } = await checkForActiveSleepEntry(babyId);
    
    if (checkSuccess && activeEntry) {
      return { 
        success: false, 
        error: 'Es existiert bereits eine aktive Aufzeichnung. Bitte stoppe diese zuerst.' 
      };
    }
    
    // Wenn der Partner bereits einen aktiven Eintrag hat, zeige eine spezielle Nachricht
    if (checkSuccess && partnerHasActiveEntry) {
      return {
        success: false,
        error: `${partnerName || 'Dein Partner'} zeichnet bereits einen Schlaf auf. Bitte warte, bis diese Aufzeichnung beendet wurde.`
      };
    }
    
    // Direktes Erstellen des Eintrags mit partner_id
    const now = new Date();
    const { data: newEntry, error: createError } = await supabase
      .from('sleep_entries')
      .insert({
        user_id: effectiveUserId,
        baby_id: babyId ?? null,
        start_time: now.toISOString(),
        partner_id: partnerId,  // Nutze partner_id statt shared_with_user_id
        updated_by: userData.user.id, // Wer hat den Eintrag erstellt/aktualisiert
        shared_with_user_id: null // Legacy-Feld, nicht mehr verwenden
      })
      .select('*')
      .single();
    
    if (createError) {
      console.error('startSleepTracking: Error creating entry:', createError);
      return { success: false, error: createError.message };
    }

    if (!newEntry) {
      return { success: false, error: 'Eintrag konnte nicht erstellt werden' };
    }

    console.log(`startSleepTracking: Erfolgreich erstellt (user_id=${effectiveUserId}, partner_id=${partnerId})`);
    
    return {
      success: true,
      entry: {
        ...newEntry,
        start_time: new Date(newEntry.start_time)
      },
      linkedUsers
    };
  } catch (error) {
    console.error('startSleepTracking: Unhandled error:', error);
    return { success: false, error: String(error) };
  }
}

// Sleep tracking stop - angepasst für Partner-Funktionalität
export async function stopSleepTracking(
  entryId: string,
  quality: SleepQuality = null,
  notes?: string,
  targetUserId?: string, // Optional: Benutzer, für den der Eintrag gestoppt wird
  babyId?: string
): Promise<{
  success: boolean;
  entry?: SleepEntry;
  error?: string;
  linkedUsers?: ConnectedUser[];
}> {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('stopSleepTracking: Stop entry', entryId, 'with quality', quality);
    
    // Lade verbundene Benutzer für spätere Rückgabe
    const { linkedUsers } = await loadConnectedUsers();
    
    // Prüfe Berechtigungen mit FOR UPDATE Lock für Atomarität
    let fetchQuery = supabase
      .from('sleep_entries')
      .select('*')
      .eq('id', entryId);

    if (babyId) {
      fetchQuery = fetchQuery.eq('baby_id', babyId);
    }

    const { data: entryData, error: fetchError } = await fetchQuery.single();
      
    if (fetchError || !entryData) {
      console.error('stopSleepTracking: Error fetching entry:', fetchError);
      return { success: false, error: 'Eintrag nicht gefunden' };
    }
    
    // Prüfe, ob der aktuelle Benutzer Zugriff hat (entweder als Ersteller oder als Partner)
    if (entryData.user_id !== userData.user.id && 
        entryData.partner_id !== userData.user.id && 
        entryData.shared_with_user_id !== userData.user.id) { // Legacy-Prüfung für alte Einträge
      return { success: false, error: 'Keine Berechtigung zum Bearbeiten dieses Eintrags' };
    }
    
    // Direkte Update-Abfrage
    const now = new Date();
    const endTime = now.toISOString();
    const durationMinutes = Math.round((now.getTime() - new Date(entryData.start_time).getTime()) / (1000 * 60));
    
    let updateQuery = supabase
      .from('sleep_entries')
      .update({
        end_time: endTime,
        quality: quality,
        notes: notes || null,
        duration_minutes: durationMinutes,
        updated_by: userData.user.id, // Wer hat den Eintrag zuletzt aktualisiert
        // Wir aktualisieren hier nicht partner_id, da dies nur beim Erstellen gesetzt wird
      })
      .eq('id', entryId);

    if (babyId) {
      updateQuery = updateQuery.eq('baby_id', babyId);
    }

    const { data: updatedEntry, error: updateError } = await updateQuery.select('*').single();
    
    if (updateError) {
      console.error('stopSleepTracking: Error updating entry:', updateError);
      return { success: false, error: updateError.message };
    }

    if (!updatedEntry) {
      return { success: false, error: 'Eintrag konnte nicht aktualisiert werden' };
    }

    console.log(`stopSleepTracking: Erfolgreich beendet (id=${entryId}, duration=${durationMinutes}min)`);

    return {
      success: true,
      entry: {
        ...updatedEntry,
        start_time: new Date(updatedEntry.start_time),
        end_time: updatedEntry.end_time ? new Date(updatedEntry.end_time) : null
      },
      linkedUsers
    };
  } catch (error) {
    console.error('stopSleepTracking: Unhandled error:', error);
    return { success: false, error: String(error) };
  }
}

// Sleep entry update
export async function updateSleepEntry(
  id: string,
  updates: Partial<SleepEntry>
): Promise<{
  success: boolean;
  entry?: SleepEntry;
  error?: string;
  linkedUsers?: ConnectedUser[];
}> {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('updateSleepEntry: Update entry', id, 'with', JSON.stringify(updates));

    // Lade verbundene Benutzer für spätere Rückgabe
    const { linkedUsers } = await loadConnectedUsers();
    
    // Zuerst den aktuellen Eintrag abrufen und Berechtigungen prüfen
    const { data: entryData, error: fetchError } = await supabase
      .from('sleep_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !entryData) {
      console.error('updateSleepEntry: Error fetching entry:', fetchError);
      return { success: false, error: 'Eintrag nicht gefunden' };
    }

    // Prüfe, ob der aktuelle Benutzer Zugriff hat (als Ersteller oder Partner)
    if (entryData.user_id !== userData.user.id && 
        entryData.partner_id !== userData.user.id && 
        entryData.shared_with_user_id !== userData.user.id) { // Legacy-Prüfung
      return { success: false, error: 'Keine Berechtigung zum Bearbeiten dieses Eintrags' };
    }

    // Bereite Update-Objekt vor
    const updateObject: any = {
      updated_by: userData.user.id // Wer hat den Eintrag aktualisiert
    };

    // Füge nur die Felder hinzu, die tatsächlich aktualisiert werden sollen
    if (updates.start_time) {
      updateObject.start_time = new Date(updates.start_time).toISOString();
    }
    
    if (updates.end_time) {
      updateObject.end_time = new Date(updates.end_time).toISOString();
    } else if (updates.end_time === null) {
      updateObject.end_time = null;
    }
    
    if (updates.quality !== undefined) {
      updateObject.quality = updates.quality;
    }
    
    if (updates.notes !== undefined) {
      updateObject.notes = updates.notes;
    }
    
    if (updates.duration_minutes !== undefined) {
      updateObject.duration_minutes = updates.duration_minutes;
    } else if (updateObject.start_time && updateObject.end_time) {
      // Berechne Dauer in Minuten, wenn Start- und Endzeit vorhanden sind
      const startTime = new Date(updateObject.start_time);
      const endTime = new Date(updateObject.end_time);
      updateObject.duration_minutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    }

    // Direkte Update-Abfrage durchführen
    const { data: updatedEntry, error: updateError } = await supabase
      .from('sleep_entries')
      .update(updateObject)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('updateSleepEntry: Error updating entry:', updateError);
      return { success: false, error: updateError.message };
    }

    if (!updatedEntry) {
      return { success: false, error: 'Eintrag konnte nicht aktualisiert werden' };
    }

    console.log(`updateSleepEntry: Erfolgreich aktualisiert (id=${id})`);

    return {
      success: true,
      entry: {
        ...updatedEntry,
        start_time: new Date(updatedEntry.start_time),
        end_time: updatedEntry.end_time ? new Date(updatedEntry.end_time) : null
      },
      linkedUsers
    };
  } catch (error) {
    console.error('updateSleepEntry: Unhandled error:', error);
    return { success: false, error: String(error) };
  }
}

// Sleep entry delete
export async function deleteSleepEntry(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('deleteSleepEntry: Delete entry', id);
    
    // Call RPC function
    const { data, error } = await supabase.rpc(
      'delete_sleep_entry',
      {
        p_user_id: userData.user.id,
        p_entry_id: id
      }
    );

    if (error) {
      console.error('deleteSleepEntry: Error calling RPC function:', error);
      return { success: false, error: error.message };
    }

    if (!data || !data.success) {
      console.error('deleteSleepEntry: RPC function reports error:', data?.error);
      return { success: false, error: data?.error || 'Unbekannter Fehler' };
    }

    return { success: true };
  } catch (error) {
    console.error('deleteSleepEntry: Unhandled error:', error);
    return { success: false, error: String(error) };
  }
}

// Check for active sleep entries with improved partner check
export async function checkForActiveSleepEntry(babyId?: string): Promise<{
  success: boolean;
  activeEntry?: SleepEntry | null;
  error?: string;
  partnerHasActiveEntry?: boolean;
  partnerName?: string;
}> {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }
    
    // Lade verbundene Benutzer (Partner)
    const { success: loadSuccess, linkedUsers, error: loadError } = await loadConnectedUsers();
    
    if (!loadSuccess || !linkedUsers) {
      console.error('checkForActiveSleepEntry: Fehler beim Laden der verbundenen Benutzer:', loadError);
      // Wir setzen den Vorgang fort, aber ohne Partner-Check
    }
    
    // Partner-IDs für die Abfrage
    const partnerIds: string[] = linkedUsers?.map(user => user.userId) || [];
    
    // Überprüfe, ob es einen aktiven Eintrag vom aktuellen Benutzer gibt
    let activeQuery = supabase
      .from('sleep_entries')
      .select('*')
      .eq('user_id', userData.user.id)
      .is('end_time', null);

    if (babyId) {
      activeQuery = activeQuery.eq('baby_id', babyId);
    }

    const { data, error } = await activeQuery.order('start_time', { ascending: false }).limit(1);

    if (error) {
      console.error('checkForActiveSleepEntry: Error getting active entry:', error);
      return { success: false, error: error.message };
    }
    
    // Wenn es Partner gibt, prüfe auch deren aktive Einträge
    let partnerEntry = null;
    let partnerName = null;
    
    if (partnerIds.length > 0) {
      let partnerQuery = supabase
        .from('sleep_entries')
        .select('*, profiles:user_id(display_name)')
        .in('user_id', partnerIds)
        .is('end_time', null);

      if (babyId) {
        partnerQuery = partnerQuery.eq('baby_id', babyId);
      }

      const { data: partnerData, error: partnerError } = await partnerQuery
        .order('start_time', { ascending: false })
        .limit(1);
      
      if (partnerError) {
        console.error('checkForActiveSleepEntry: Fehler beim Prüfen aktiver Partner-Einträge:', partnerError);
      } else if (partnerData && partnerData.length > 0) {
        partnerEntry = partnerData[0];
        // Versuche, den Namen des Partners zu ermitteln
        if (partnerEntry.profiles?.display_name) {
          partnerName = partnerEntry.profiles.display_name;
        } else {
          // Nutze die linkedUsers Liste, um den Namen zu finden
          const matchingPartner = linkedUsers?.find(user => user.userId === partnerEntry.user_id);
          partnerName = matchingPartner?.displayName || 'Dein Partner';
        }
      }
    }

    // If no data or empty array, then no active entry from current user
    if (!data || data.length === 0) {
      // Wenn kein eigener Eintrag, aber ein Partner-Eintrag aktiv ist
      if (partnerEntry) {
        return {
          success: true,
          activeEntry: null,
          partnerHasActiveEntry: true,
          partnerName
        };
      }
      
      return {
        success: true,
        activeEntry: null,
        partnerHasActiveEntry: false
      };
    }

    return {
      success: true,
      activeEntry: {
        ...data[0],
        start_time: new Date(data[0].start_time)
      }
    };
  } catch (error) {
    console.error('Fehler beim Abrufen der verbundenen Benutzer:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Lädt alle Schlafeinträge für den aktuellen Benutzer
 */
export async function loadSleepEntries(): Promise<{
  success: boolean;
  entries?: SleepEntry[];
  error?: string;
  linkedUsers?: ConnectedUser[];
}> {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      console.error('loadSleepEntries: Nicht angemeldet');
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('loadSleepEntries: Lade Einträge für Benutzer', userData.user.id);
    
    // Lade alle Einträge, die dem Benutzer gehören oder mit ihm geteilt wurden
    // Verwende eine direkte Datenbankabfrage anstelle eines RPC-Aufrufs
    const { data, error } = await supabase
      .from('sleep_entries')
      .select('*')
      .or(`user_id.eq.${userData.user.id},shared_with_user_id.eq.${userData.user.id}`)
      .order('start_time', { ascending: false });
    
    if (error) {
      console.error('loadSleepEntries: Datenbankfehler:', error);
      return { success: false, error: error.message };
    }

    if (data) {
      console.log('loadSleepEntries: Erster Eintrag:', JSON.stringify(data[0], null, 2));

      // Zähle eigene und geteilte Einträge
      const ownEntries = data.filter(entry => entry.user_id === userData.user.id);
      const sharedWithMe = data.filter(entry => entry.shared_with_user_id === userData.user.id);
      console.log(`loadSleepEntries: ${ownEntries.length} eigene Einträge, ${sharedWithMe.length} mit mir geteilte Einträge`);

      // Registriere alle Benutzer, für die wir Namen auflösen müssen
      const otherUserIds = new Set<string>();
      data.forEach(entry => {
        if (entry.user_id !== userData.user.id) {
          otherUserIds.add(entry.user_id);
        }
        if (entry.shared_with_user_id && entry.shared_with_user_id !== userData.user.id) {
          otherUserIds.add(entry.shared_with_user_id);
        }
      });
      console.log(`loadSleepEntries: Benötige Namen für ${otherUserIds.size} andere Benutzer`);
    }
    
    // Lade verbundene Benutzer für Namenszuordnungen
    const { linkedUsers } = await getLinkedUsersWithDetails();
    
    return { 
      success: true, 
      entries: data || [],
      linkedUsers
    };
  } catch (error) {
    console.error('loadSleepEntries: Unerwarteter Fehler:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
  }
}

// Schlafeinträge teilen
export async function shareSleepEntry(
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
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    // Prüfen, ob Benutzer versucht, mit sich selbst zu teilen
    if (partnerId === userData.user.id) {
      return { success: false, error: 'Du kannst Einträge nicht mit dir selbst teilen' };
    }

    // Prüfen, ob der Partner tatsächlich verknüpft ist
    const { linkedUsers } = await getLinkedUsersWithDetails();
    if (!linkedUsers || !linkedUsers.some(u => u.userId === partnerId)) {
      return { success: false, error: 'Der gewählte Benutzer ist nicht mit dir verknüpft' };
    }

    console.log(`shareSleepEntry: Teile Eintrag ${entryId} mit Benutzer ${partnerId}`);
    
    // RPC-Funktion zum Teilen des Eintrags aufrufen
    const { data, error } = await supabase.rpc(
      'share_sleep_entry',
      {
        p_entry_id: entryId,
        p_partner_id: partnerId
      }
    );

    if (error) {
      console.error('shareSleepEntry: Fehler beim Teilen des Eintrags:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      console.error('shareSleepEntry: RPC-Funktion meldet Fehler:', data.error);
      return { success: false, error: data.error || 'Unbekannter Fehler' };
    }

    return {
      success: true,
      message: data.message || 'Eintrag erfolgreich geteilt'
    };
  } catch (error) {
    console.error('shareSleepEntry: Unbehandelter Fehler:', error);
    return { success: false, error: String(error) };
  }
}

// Freigabe eines Schlafeintrags aufheben
export async function unshareSleepEntry(
  entryId: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log(`unshareSleepEntry: Hebe Freigabe für Eintrag ${entryId} auf`);
    
    // Direkte Update-Abfrage
    const { error } = await supabase
      .from('sleep_entries')
      .update({ shared_with_user_id: null })
      .eq('id', entryId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('unshareSleepEntry: Fehler beim Aufheben der Freigabe:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: 'Freigabe erfolgreich aufgehoben'
    };
  } catch (error) {
    console.error('unshareSleepEntry: Unbehandelter Fehler:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Debug-Funktion zum Testen beider Methoden zum Abrufen verbundener Benutzer
 */
export async function debugCompareLinkedUserMethods(): Promise<{
  success: boolean;
  rpcMethod?: {
    success: boolean;
    linkedUsers?: ConnectedUser[];
    error?: string;
  };
  alternativeMethod?: {
    success: boolean;
    linkedUsers?: ConnectedUser[];
    error?: string;
  };
  comparison?: {
    rpcUserCount: number;
    alternativeUserCount: number;
    matchingUserIds: string[];
    mismatchUserIds: string[];
  };
}> {
  try {
    // Aktuellen Benutzer prüfen
    const { data: user } = await supabase.auth.getUser();
    if (!user || !user.user) {
      return { success: false };
    }

    console.log('debugCompareLinkedUserMethods: Starte Vergleich für Benutzer', user.user.id);

    // Methode 1: RPC-Funktion
    const rpcResult = await getLinkedUsersWithDetails();
    console.log('RPC Methode:', JSON.stringify(rpcResult, null, 2));

    // Methode 2: Alternative Implementierung
    const alternativeResult = await getLinkedUsersAlternative();
    console.log('Alternative Methode:', JSON.stringify(alternativeResult, null, 2));

    // Vergleiche die Ergebnisse
    const rpcUserIds = rpcResult.linkedUsers ? rpcResult.linkedUsers.map(u => u.userId) : [];
    const altUserIds = alternativeResult.linkedUsers ? alternativeResult.linkedUsers.map(u => u.userId) : [];
    
    // Finde übereinstimmende und nicht übereinstimmende IDs
    const matchingUserIds = rpcUserIds.filter(id => altUserIds.includes(id));
    const mismatchUserIds = [
      ...rpcUserIds.filter(id => !altUserIds.includes(id)),
      ...altUserIds.filter(id => !rpcUserIds.includes(id))
    ];

    return {
      success: true,
      rpcMethod: rpcResult,
      alternativeMethod: alternativeResult,
      comparison: {
        rpcUserCount: rpcUserIds.length,
        alternativeUserCount: altUserIds.length,
        matchingUserIds,
        mismatchUserIds
      }
    };
  } catch (error) {
    console.error('debugCompareLinkedUserMethods: Unbehandelter Fehler:', error);
    return { success: false };
  }
}

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
    // Wenn eine Methode explizit bevorzugt wird
    if (preferAlternative) {
      console.log('loadConnectedUsers: Verwende direkt die alternative Methode');
      const result = await getLinkedUsersAlternative();
      return {
        success: result.success,
        linkedUsers: result.linkedUsers,
        error: result.error,
        methodUsed: 'alternative'
      };
    }

    // Beide Methoden testen und vergleichen
    const compareResult = await debugCompareLinkedUserMethods();
    
    if (!compareResult.success) {
      console.log('loadConnectedUsers: Vergleich fehlgeschlagen, Fallback auf alternative Methode');
      const result = await getLinkedUsersAlternative();
      return {
        success: result.success,
        linkedUsers: result.linkedUsers,
        error: result.error,
        methodUsed: 'alternative (fallback)'
      };
    }
    
    // Entscheiden, welche Methode mehr Benutzer zurückgibt
    const rpcCount = compareResult.comparison?.rpcUserCount || 0;
    const altCount = compareResult.comparison?.alternativeUserCount || 0;
    
    if (rpcCount >= altCount && compareResult.rpcMethod?.success) {
      console.log(`loadConnectedUsers: RPC-Methode liefert ${rpcCount} Benutzer (Alternative: ${altCount})`);
      const rpcMethod = compareResult.rpcMethod;
      return {
        success: rpcMethod.success,
        linkedUsers: rpcMethod.linkedUsers,
        error: rpcMethod.error,
        methodUsed: 'rpc'
      };
    } else {
      console.log(`loadConnectedUsers: Alternative Methode liefert ${altCount} Benutzer (RPC: ${rpcCount})`);
      const altMethod = compareResult.alternativeMethod || { success: false };
      return {
        success: altMethod.success,
        linkedUsers: altMethod.linkedUsers,
        error: altMethod.error,
        methodUsed: 'alternative'
      };
    }
  } catch (error) {
    console.error('loadConnectedUsers: Unbehandelter Fehler:', error);
    return { 
      success: false, 
      error: String(error),
      methodUsed: 'error'
    };
  }
}

// Export for backwards compatibility
export {
  startSleepTracking as startSleepTrackingDB,
  stopSleepTracking as stopSleepTrackingDB,
  updateSleepEntry as updateSleepEntryDB,
  deleteSleepEntry as deleteSleepEntryDB
};

// Funktion zum Überprüfen der Datenbankstruktur
export async function checkDatabaseStructure(): Promise<{
  success: boolean;
  hasSharedColumn?: boolean;
  tableInfo?: any;
  error?: string;
  message?: string;
}> {
  try {
    // Aktuellen Benutzer abrufen
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('checkDatabaseStructure: Überprüfe Datenbankstruktur für Benutzer', userData.user.id);
    
    // Einfache Abfrage, um einen Eintrag zu laden und dessen Struktur zu prüfen
    const { data, error } = await supabase
      .from('sleep_entries')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('checkDatabaseStructure: Fehler bei der Datenbankabfrage:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Konnte keine Daten aus der sleep_entries Tabelle laden'
      };
    }

    if (!data || data.length === 0) {
      // Keine Daten gefunden, versuche direkte Metadatenabfrage
      console.log('checkDatabaseStructure: Keine Einträge in der Datenbank gefunden, prüfe Metadaten');
      
      try {
        // Wir können auch versuchen, ein leeres Element einzufügen und das Ergebnis zu prüfen
        const testEntry = {
          user_id: userData.user.id,
          start_time: new Date().toISOString(),
          shared_with_user_id: null // Prüfen, ob diese Spalte existiert
        };
        
        const { data: insertData, error: insertError } = await supabase
          .from('sleep_entries')
          .insert(testEntry)
          .select();
          
        if (insertError) {
          // Prüfen, ob der Fehler auf eine fehlende Spalte hinweist
          const isColumnMissing = insertError.message.includes('shared_with_user_id') || 
                                 insertError.message.includes('column');
                                 
          return {
            success: false,
            hasSharedColumn: !isColumnMissing,
            error: insertError.message,
            message: isColumnMissing 
              ? 'Die Spalte shared_with_user_id existiert nicht in der Datenbank' 
              : 'Fehler beim Einfügen eines Testeintrags'
          };
        }
        
        // Wenn das Einfügen erfolgreich war, löschen wir den Testeintrag wieder
        if (insertData && insertData.length > 0) {
          const entryId = insertData[0].id;
          await supabase
            .from('sleep_entries')
            .delete()
            .eq('id', entryId);
            
          // Die Spalte existiert, da der Eintrag erfolgreich eingefügt wurde
          return {
            success: true,
            hasSharedColumn: true,
            message: 'Die Spalte shared_with_user_id existiert in der Datenbank'
          };
        }
      } catch (err) {
        console.error('checkDatabaseStructure: Fehler bei der Metadatenabfrage:', err);
        return {
          success: false,
          error: String(err),
          message: 'Fehler bei der Überprüfung der Datenbankstruktur'
        };
      }
      
      return {
        success: true,
        hasSharedColumn: false,
        message: 'Keine Daten in der Datenbank gefunden'
      };
    }

    // Prüfe, ob die Spalte in den Daten existiert
    const firstEntry = data[0];
    const hasSharedColumn = 'shared_with_user_id' in firstEntry;
    
    return {
      success: true,
      hasSharedColumn,
      tableInfo: {
        columns: Object.keys(firstEntry),
        sampleEntry: firstEntry
      },
      message: hasSharedColumn
        ? 'Die Spalte shared_with_user_id existiert in der Datenbank'
        : 'Die Spalte shared_with_user_id existiert NICHT in der Datenbank'
    };
  } catch (error) {
    console.error('checkDatabaseStructure: Unerwarteter Fehler:', error);
    return { success: false, error: String(error) };
  }
} 
