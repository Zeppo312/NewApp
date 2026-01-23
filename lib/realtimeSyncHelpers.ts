import { supabase } from "./supabase";
import { RealtimeChannel } from '@supabase/supabase-js';

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
    const { data: userData } = await getCachedUser();
    if (!userData?.user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    console.log('setupSleepEntriesRealtime: Partner-Synchronisierung wird aktiviert');

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
          // Prüfe, welche Art der Änderung und von wem
          const record = payload.new || payload.old;
          // Type-Cast für den Record, da er die SleepEntry-Eigenschaften enthält
          if (record) {
            // Sichere Type-Cast-Version
            const entryRecord = record as { updated_by?: string | null };
            const isPartnerUpdate = entryRecord.updated_by && entryRecord.updated_by !== userData.user.id;
            if (isPartnerUpdate) {
              console.log('Dies ist ein Update vom Partner!');
            }
          }
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

/**
 * Hilfsfunktion zum Überprüfen, ob Realtime für Sleep-Einträge aktiviert ist
 */
export function isSleepEntriesRealtimeActive(): boolean {
  return sleepEntriesSubscription !== null;
}
