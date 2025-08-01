import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase-Konfiguration
// Ersetzen Sie diese Werte mit Ihren eigenen Supabase-Projektdaten
export const supabaseUrl = 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bmlpeWF5aHpnamZxanNqY2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NzEyNjIsImV4cCI6MjA1OTU0NzI2Mn0.h0CL1_SXhfp9BXSPy0ipprs57qSZ8A_26wh2hP-8vZk';

// Konfiguration für die Entwicklungsumgebung
// Wir verwenden eine bedingte Prüfung, um sicherzustellen, dass der Code sowohl im Browser als auch in Node.js funktioniert
const isClient = typeof window !== 'undefined';

// Erstellen des Supabase-Clients mit einer Prüfung, ob wir im Browser oder in Node.js sind
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isClient ? AsyncStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce', // Empfohlen für mobile Apps
  },
});

// Hilfsfunktion, um zu prüfen, ob der Client bereit ist
export const isSupabaseReady = () => {
  return isClient;
};

// Debug-Funktion, um zu prüfen, ob Supabase korrekt funktioniert
export const checkSupabaseConnection = async () => {
  // Prüfen, ob wir im Browser sind
  if (!isClient) {
    console.log('Skipping Supabase connection check (server-side rendering)');
    return { success: false, error: 'Server-side rendering' };
  }

  // Prüfen, ob die Supabase-Anmeldedaten konfiguriert sind
  if (supabaseUrl.includes('example.supabase.co')) {
    console.log('Supabase credentials not configured, using demo mode');
    return { success: false, error: 'Supabase credentials not configured' };
  }

  try {
    // Timeout für die Verbindungsprüfung (3 Sekunden)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 3000);
    });

    // Supabase-Verbindungsprüfung
    const connectionPromise = supabase.from('contractions').select('count');

    // Wir verwenden Promise.race, um einen Timeout zu implementieren
    const result = await Promise.race([
      connectionPromise,
      timeoutPromise
    ]) as { data: any, error: any };

    if (result.error) {
      console.error('Supabase connection error:', result.error);
      return { success: false, error: result.error };
    }

    console.log('Supabase connection successful:', result.data);
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Supabase connection exception:', error);
    return { success: false, error };
  }
};

// Typdefinitionen für Supabase-Tabellen
export type Contraction = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration: number | null; // in seconds
  interval: number | null; // time since last contraction in seconds
  intensity: string | null; // Stärke der Wehe (schwach, mittel, stark)
  created_at: string;
};

export type DoctorQuestion = {
  id: string;
  user_id: string;
  question: string;
  answer?: string | null;
  is_answered: boolean;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  user_id: string;
  item_name: string;
  is_checked: boolean;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  position: number;
};

import { GeburtsplanData } from '@/types/geburtsplan';

export type Geburtsplan = {
  id: string;
  user_id: string;
  content: string;
  structured_data?: GeburtsplanData;
  created_at: string;
  updated_at: string;
};

// Hilfsfunktionen für die Authentifizierung

// E-Mail-Authentifizierung
export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

// Telefon-Authentifizierung
export const signUpWithPhone = async (phone: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    phone,
    password,
  });
  return { data, error };
};

export const signInWithPhone = async (phone: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    phone,
    password,
  });
  return { data, error };
};

// OTP (One-Time Password) für Telefon-Authentifizierung
export const signInWithOtp = async (phone: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  });
  return { data, error };
};

export const verifyOtp = async (phone: string, token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  return { data, error };
};

// Magic Link (passwortlose Anmeldung)
export const signInWithMagicLink = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
  });
  return { data, error };
};

// Social Logins
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  return { data, error };
};

export const signInWithApple = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
  });
  return { data, error };
};

export const signInWithFacebook = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
  });
  return { data, error };
};

// Anonyme Authentifizierung
export const signInAnonymously = async () => {
  const { data, error } = await supabase.auth.signUp({
    email: `${Math.random().toString(36).substring(2)}@anonymous.com`,
    password: Math.random().toString(36).substring(2),
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

// Hilfsfunktionen für Wehen-Daten
export const saveContraction = async (contraction: Omit<Contraction, 'id' | 'user_id' | 'created_at'>) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Verwenden der neuen RPC-Funktion zum Hinzufügen und Synchronisieren
    const { data: rpcData, error: rpcError } = await supabase.rpc('add_contraction_and_sync', {
      p_user_id: userData.user.id,
      p_start_time: contraction.start_time,
      p_end_time: contraction.end_time,
      p_duration: contraction.duration,
      p_intensity: contraction.intensity,
      p_notes: contraction.notes || null
    });

    if (rpcError) {
      console.error('Error adding contraction with sync:', rpcError);

      // Fallback auf die alte Methode
      const { data, error } = await supabase
        .from('contractions')
        .insert({
          ...contraction,
          user_id: userData.user.id,
        })
        .select()
        .single();

      return { data, error, synced: false };
    }

    console.log('Contraction added with sync:', rpcData);

    // Umwandeln des Formats, um mit der bestehenden Implementierung kompatibel zu sein
    return {
      data: { id: rpcData.contractionId, ...contraction, user_id: userData.user.id },
      error: null,
      synced: rpcData.synced,
      syncedTo: rpcData.syncedTo
    };
  } catch (err) {
    console.error('Failed to save contraction:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
};

export const getContractions = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Verwenden der verbesserten RPC-Funktion
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_contractions_with_sync_info', {
      p_user_id: userData.user.id
    });

    if (rpcError) {
      console.error('Error fetching contractions with sync info:', rpcError);

      // Fallback auf die alte Methode
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('contractions')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('start_time', { ascending: false });

      return { data: fallbackData, error: fallbackError };
    }

    console.log('Contractions with sync info:', rpcData);

    // Umwandeln des Formats, um mit der bestehenden Implementierung kompatibel zu sein
    return {
      data: rpcData.contractions,
      error: null,
      syncInfo: rpcData.syncInfo
    };
  } catch (err) {
    console.error('Failed to fetch contractions:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
};

// Funktion zum einmaligen Synchronisieren aller bestehenden Wehen
export const syncAllExistingContractions = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { success: false, error: 'Nicht angemeldet' };

    console.log('Attempting to sync all existing contractions for user:', userData.user.id);

    // Prüfen, ob der Benutzer verknüpfte Benutzer hat
    const linkedUsersResult = await getLinkedUsersWithDetails();
    if (!linkedUsersResult.success || !linkedUsersResult.linkedUsers || linkedUsersResult.linkedUsers.length === 0) {
      console.log('No linked users found, skipping sync');
      return {
        success: true,
        message: 'Keine verknüpften Benutzer gefunden',
        syncedCount: 0,
        linkedUsers: []
      };
    }

    console.log('Found linked users:', linkedUsersResult.linkedUsers);

    // Verwenden der verbesserten RPC-Funktion
    const { data, error } = await supabase.rpc('sync_all_existing_contractions', {
      p_user_id: userData.user.id
    });

    if (error) {
      console.error('Error syncing all existing contractions:', error);

      // Fallback: Manuelles Synchronisieren der Wehen
      console.log('Attempting manual sync as fallback...');

      // Abrufen aller Wehen des Benutzers
      const { data: myContractions, error: myError } = await supabase
        .from('contractions')
        .select('*')
        .eq('user_id', userData.user.id);

      if (myError) {
        console.error('Error fetching user contractions:', myError);
        return { success: false, error: myError };
      }

      console.log(`Found ${myContractions?.length || 0} contractions for current user`);

      let syncedCount = 0;

      // Für jeden verknüpften Benutzer
      for (const linkedUser of linkedUsersResult.linkedUsers) {
        console.log(`Syncing with linked user: ${linkedUser.firstName} (${linkedUser.userId})`);

        // Abrufen aller Wehen des verknüpften Benutzers
        const { data: theirContractions, error: theirError } = await supabase
          .from('contractions')
          .select('*')
          .eq('user_id', linkedUser.userId);

        if (theirError) {
          console.error(`Error fetching contractions for linked user ${linkedUser.userId}:`, theirError);
          continue;
        }

        console.log(`Found ${theirContractions?.length || 0} contractions for linked user ${linkedUser.userId}`);

        // Kopieren aller Wehen vom Benutzer zum verknüpften Benutzer
        if (myContractions && myContractions.length > 0) {
          for (const contraction of myContractions) {
            // Prüfen, ob die Wehe bereits beim verknüpften Benutzer existiert
            const exists = theirContractions?.some(c =>
              new Date(c.start_time).getTime() === new Date(contraction.start_time).getTime()
            );

            if (!exists) {
              console.log(`Copying contraction from ${userData.user.id} to ${linkedUser.userId}:`, contraction);

              // Hinzufügen der Wehe für den verknüpften Benutzer
              const { error: insertError } = await supabase
                .from('contractions')
                .insert({
                  user_id: linkedUser.userId,
                  start_time: contraction.start_time,
                  end_time: contraction.end_time,
                  duration: contraction.duration,
                  intensity: contraction.intensity,
                  notes: contraction.notes
                });

              if (insertError) {
                console.error(`Error copying contraction to linked user ${linkedUser.userId}:`, insertError);
              } else {
                syncedCount++;
              }
            }
          }
        }

        // Kopieren aller Wehen vom verknüpften Benutzer zum Benutzer
        if (theirContractions && theirContractions.length > 0) {
          for (const contraction of theirContractions) {
            // Prüfen, ob die Wehe bereits beim Benutzer existiert
            const exists = myContractions?.some(c =>
              new Date(c.start_time).getTime() === new Date(contraction.start_time).getTime()
            );

            if (!exists) {
              console.log(`Copying contraction from ${linkedUser.userId} to ${userData.user.id}:`, contraction);

              // Hinzufügen der Wehe für den Benutzer
              const { error: insertError } = await supabase
                .from('contractions')
                .insert({
                  user_id: userData.user.id,
                  start_time: contraction.start_time,
                  end_time: contraction.end_time,
                  duration: contraction.duration,
                  intensity: contraction.intensity,
                  notes: contraction.notes
                });

              if (insertError) {
                console.error(`Error copying contraction to current user:`, insertError);
              } else {
                syncedCount++;
              }
            }
          }
        }
      }

      console.log(`Manual sync completed, synced ${syncedCount} contractions`);

      return {
        success: true,
        syncedCount,
        linkedUsers: linkedUsersResult.linkedUsers,
        message: 'Manuelle Synchronisierung erfolgreich'
      };
    }

    console.log('All existing contractions synced:', data);
    return data; // Die Funktion gibt { success: true, syncedCount: X, linkedUsers: [...] } zurück
  } catch (err) {
    console.error('Failed to sync all existing contractions:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
  }
};

// Funktion zum Abrufen aller verknüpften Benutzer mit Details
export const getLinkedUsersWithDetails = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { success: false, error: 'Nicht angemeldet' };

    // Verwenden der neuen RPC-Funktion
    const { data, error } = await supabase.rpc('get_linked_users_with_details', {
      p_user_id: userData.user.id
    });

    if (error) {
      console.error('Error fetching linked users with details:', error);
      return { success: false, error };
    }

    console.log('Linked users with details:', data);
    return data; // Die Funktion gibt { success: true, linkedUsers: [...] } zurück
  } catch (err) {
    console.error('Failed to fetch linked users with details:', err);
    return { success: false, error: err };
  }
};



export const updateContraction = async (id: string, updates: Partial<Contraction>) => {
  const { data, error } = await supabase
    .from('contractions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

export const deleteContraction = async (id: string) => {
  try {
    console.log(`Attempting to delete contraction with ID: ${id}`);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: new Error('Nicht angemeldet') };

    // Verwenden der neuen RPC-Funktion zum Löschen und Synchronisieren
    const { data: rpcData, error: rpcError } = await supabase.rpc('delete_contraction_and_sync', {
      p_user_id: userData.user.id,
      p_contraction_id: id
    });

    if (rpcError) {
      console.error(`Error deleting contraction with sync for ID ${id}:`, rpcError);

      // Fallback auf die alte Methode
      const { error } = await supabase
        .from('contractions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`Error deleting contraction with ID ${id}:`, error);
      }

      return { error, synced: false };
    }

    console.log('Contraction deleted with sync:', rpcData);

    return {
      error: null,
      synced: rpcData.synced,
      deletedCount: rpcData.deletedCount,
      syncedCount: rpcData.syncedCount
    };
  } catch (err) {
    console.error(`Exception when deleting contraction with ID ${id}:`, err);
    return { error: err instanceof Error ? err : new Error('Unknown error during deletion') };
  }
};

// Hilfsfunktionen für den Baby-Status
export const getBabyBornStatus = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: false, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('user_settings')
      .select('is_baby_born')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching baby born status:', error);
      return { data: false, error };
    }

    return { data: data?.is_baby_born || false, error: null };
  } catch (err) {
    console.error('Failed to get baby born status:', err);
    return { data: false, error: err };
  }
};

export const setBabyBornStatus = async (isBabyBorn: boolean) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Verwenden der neuen RPC-Funktion
    const { data, error } = await supabase.rpc('update_baby_born_status_and_sync', {
      p_user_id: userData.user.id,
      p_is_baby_born: isBabyBorn
    });

    if (error) {
      console.error('Error updating baby born status and syncing:', error);
      return { data: null, error };
    }

    console.log('Baby born status updated and synced:', data);

    // Extrahieren der verknüpften Benutzer aus dem Ergebnis
    const linkedUsers = data.syncResult?.linkedUsers || [];

    return {
      data: { is_baby_born: isBabyBorn },
      error: null,
      linkedUsers: linkedUsers
    };
  } catch (err) {
    console.error('Failed to set baby born status:', err);
    return { data: null, error: err };
  }
};

// Hilfsfunktionen für den Geburtsplan

// Prüfen, ob ein Geburtsplan existiert
export const hasGeburtsplan = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { exists: false, error: new Error('Nicht angemeldet') };

    // Wir prüfen, ob ein Geburtsplan existiert
    const { data, error } = await supabase
      .from('geburtsplan')
      .select('id')
      .eq('user_id', userData.user.id)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    return { exists: !!data, error: null };
  } catch (error) {
    console.error('Error checking geburtsplan existence:', error);
    return { exists: false, error };
  }
};

export const getGeburtsplan = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Wir holen alle Geburtspläne des Benutzers, sortiert nach dem neuesten zuerst
    const { data, error } = await supabase
      .from('geburtsplan')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows returned

    // Wenn Daten gefunden wurden, prüfen wir, ob der Inhalt ein gültiges JSON ist
    if (data && data.content) {
      try {
        // Prüfen, ob der Inhalt mit einem { beginnt (wahrscheinlich JSON)
        if (data.content.trim().startsWith('{')) {
          const parsedContent = JSON.parse(data.content);

          // Prüfen, ob es das neue Format mit structuredData und textContent ist
          if (parsedContent.structuredData && parsedContent.textContent) {
            data.structured_data = parsedContent.structuredData;
            data.textContent = parsedContent.textContent;
          }
          // Prüfen, ob es das alte Format mit allgemeineAngaben ist
          else if (parsedContent.allgemeineAngaben) {
            data.structured_data = parsedContent;
          }
          // Sonst ist es wahrscheinlich ein einfacher Text
          else {
            // Nichts tun, der Inhalt bleibt in data.content
          }
        }
      } catch (e) {
        // Wenn das Parsen fehlschlägt, ist es wahrscheinlich kein JSON, also ignorieren wir es
        console.log('Content is not valid JSON, treating as plain text');
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching geburtsplan:', error);
    return { data: null, error };
  }
};

// Speichern oder Aktualisieren des Geburtsplans (Textversion)
export const saveGeburtsplan = async (content: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Zuerst prüfen, ob bereits ein Geburtsplan existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('geburtsplan')
      .select('id')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Geburtsplan existiert, aktualisieren wir diesen
      result = await supabase
        .from('geburtsplan')
        .update({
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Wenn kein Geburtsplan existiert, erstellen wir einen neuen
      result = await supabase
        .from('geburtsplan')
        .insert({
          user_id: userData.user.id,
          content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving geburtsplan:', error);
    return { data: null, error };
  }
};

// Speichern oder Aktualisieren des strukturierten Geburtsplans
export const saveStructuredGeburtsplan = async (structuredData: any, textContent: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Wir speichern die strukturierten Daten und den generierten Text zusammen in der content-Spalte
    const combinedData = {
      structuredData: structuredData,
      textContent: textContent
    };
    const combinedContent = JSON.stringify(combinedData);

    // Zuerst prüfen, ob bereits ein Geburtsplan existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('geburtsplan')
      .select('id')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Geburtsplan existiert, aktualisieren wir diesen
      result = await supabase
        .from('geburtsplan')
        .update({
          content: combinedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Wenn kein Geburtsplan existiert, erstellen wir einen neuen
      result = await supabase
        .from('geburtsplan')
        .insert({
          user_id: userData.user.id,
          content: combinedContent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) throw error;

    // Für die Rückgabe setzen wir die strukturierten Daten, damit die Anwendung sie verwenden kann
    if (data) {
      data.structured_data = structuredData;
      data.textContent = textContent;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error saving structured geburtsplan:', error);
    return { data: null, error };
  }
};

// Löschen des Geburtsplans
export const deleteGeburtsplan = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: new Error('Nicht angemeldet') };

    const { error } = await supabase
      .from('geburtsplan')
      .delete()
      .eq('user_id', userData.user.id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting geburtsplan:', error);
    return { error };
  }
};

// Hilfsfunktionen für die Krankenhaus-Checkliste

// Abrufen aller Checklisten-Einträge
export const getHospitalChecklist = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('hospital_checklist')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('position', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching hospital checklist:', error);
    return { data: null, error };
  }
};

// Hinzufügen eines neuen Checklisten-Eintrags
export const addChecklistItem = async (item: Omit<ChecklistItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('hospital_checklist')
      .insert({
        ...item,
        user_id: userData.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error adding checklist item:', error);
    return { data: null, error };
  }
};

// Aktualisieren eines Checklisten-Eintrags
export const updateChecklistItem = async (id: string, updates: Partial<ChecklistItem>) => {
  try {
    const { data, error } = await supabase
      .from('hospital_checklist')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return { data: null, error };
  }
};

// Aktualisieren des Status eines Checklisten-Eintrags (abgehakt/nicht abgehakt)
export const toggleChecklistItem = async (id: string, isChecked: boolean) => {
  return updateChecklistItem(id, { is_checked: isChecked });
};

// Löschen eines Checklisten-Eintrags
export const deleteChecklistItem = async (id: string) => {
  try {
    const { error } = await supabase
      .from('hospital_checklist')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return { error };
  }
};

// Aktualisieren der Position mehrerer Checklisten-Einträge (für Drag & Drop)
export const updateChecklistPositions = async (items: { id: string, position: number }[]) => {
  try {
    const updates = items.map(item => ({
      id: item.id,
      position: item.position
    }));

    const { data, error } = await supabase
      .from('hospital_checklist')
      .upsert(updates, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating checklist positions:', error);
    return { data: null, error };
  }
};

// Hilfsfunktionen für Frauenarzt-Fragen

// Frage speichern
export const saveDoctorQuestion = async (question: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('doctor_questions')
      .insert({
        user_id: userData.user.id,
        question,
        is_answered: false,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving doctor question:', error);
    return { data: null, error };
  }
};

// Alle Fragen abrufen
export const getDoctorQuestions = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('doctor_questions')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching doctor questions:', error);
    return { data: null, error };
  }
};

// Frage aktualisieren
export const updateDoctorQuestion = async (id: string, updates: Partial<DoctorQuestion>) => {
  try {
    const { data, error } = await supabase
      .from('doctor_questions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating doctor question:', error);
    return { data: null, error };
  }
};

// Frage löschen
export const deleteDoctorQuestion = async (id: string) => {
  try {
    const { error } = await supabase
      .from('doctor_questions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting doctor question:', error);
    return { error };
  }
};

// Hilfsfunktionen für App-Einstellungen

// Typ-Definition für App-Einstellungen
export type AppSettings = {
  id?: string;
  user_id?: string;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  due_date?: string | null;
  is_baby_born?: boolean;
  created_at?: string;
  updated_at?: string;
};

// App-Einstellungen laden
export const getAppSettings = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching app settings:', error);
      return { data: null, error };
    }

    // Standardwerte, falls keine Einstellungen gefunden wurden
    const defaultSettings: AppSettings = {
      theme: 'light',
      notifications_enabled: true,
      due_date: null,
      is_baby_born: false
    };

    return { data: data || defaultSettings, error: null };
  } catch (err) {
    console.error('Failed to get app settings:', err);
    return { data: null, error: err };
  }
};

// App-Einstellungen speichern
export const saveAppSettings = async (settings: Partial<AppSettings>) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Zuerst prüfen, ob bereits ein Eintrag existiert
    const { data: existingData, error: fetchError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing settings:', fetchError);
      return { data: null, error: fetchError };
    }

    let result;

    if (existingData && existingData.id) {
      // Wenn ein Eintrag existiert, aktualisieren wir diesen
      result = await supabase
        .from('user_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Wenn kein Eintrag existiert, erstellen wir einen neuen
      result = await supabase
        .from('user_settings')
        .insert({
          user_id: userData.user.id,
          ...settings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving app settings:', result.error);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  } catch (err) {
    console.error('Failed to save app settings:', err);
    return { data: null, error: err };
  }
};

// Typdefinitionen für Account-Verlinkung
export type AccountLink = {
  id: string;
  creator_id: string;
  invited_id: string | null;
  invitation_code: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  relationship_type: string | null;
};

// Funktion zum Generieren eines eindeutigen Einladungscodes
export const generateInvitationCode = () => {
  // 8-stelliger alphanumerischer Code mit nur Großbuchstaben und Zahlen
  // Vermeidet Buchstaben, die leicht verwechselt werden können (O/0, I/1, etc.)
  const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * allowedChars.length);
    code += allowedChars[randomIndex];
  }

  return code;
};

// Funktion zum Erstellen eines Einladungslinks
export const createInvitationLink = async (userId: string, relationshipType: string = 'partner') => {
  // Generiere einen eindeutigen Code
  let invitationCode = generateInvitationCode();
  let isUnique = false;
  let attempts = 0;

  // Stelle sicher, dass der Code eindeutig ist
  while (!isUnique && attempts < 5) {
    attempts++;

    // Prüfe, ob der Code bereits existiert
    const { data: existingCode, error: checkError } = await supabase
      .from('account_links')
      .select('id')
      .eq('invitation_code', invitationCode)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking invitation code uniqueness:', checkError);
      break;
    }

    if (!existingCode) {
      isUnique = true;
    } else {
      console.log(`Code ${invitationCode} already exists, generating a new one (attempt ${attempts})`);
      invitationCode = generateInvitationCode();
    }
  }

  if (!isUnique) {
    console.error('Failed to generate a unique invitation code after multiple attempts');
    return { success: false, error: { message: 'Konnte keinen eindeutigen Einladungscode generieren.' } };
  }

  console.log(`Creating invitation with code: ${invitationCode}`);
  const { data, error } = await supabase
    .from('account_links')
    .insert({
      creator_id: userId,
      invitation_code: invitationCode,
      relationship_type: relationshipType
    })
    .select();

  if (error) {
    console.error('Error creating invitation link:', error);
    return { success: false, error };
  }

  return {
    success: true,
    invitationCode,
    invitationLink: `wehen-tracker://invite?code=${invitationCode}`
  };
};

// Funktion zum Abrufen aller Einladungen eines Benutzers mit Profilinformationen
export const getUserInvitations = async (userId: string) => {
  try {
    // Verwenden der neuen RPC-Funktion, die Benutzerinformationen zurückgibt
    const { data, error } = await supabase.rpc('get_user_invitations_with_info', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error fetching user invitations:', error);
      return { success: false, error };
    }

    console.log('User invitations with info:', data);
    return data; // Die Funktion gibt bereits { success: true, invitations: [...] } zurück
  } catch (error) {
    console.error('Exception fetching user invitations:', error);
    return {
      success: false,
      error: { message: 'Fehler beim Abrufen der Einladungen.' }
    };
  }
};

// Funktion zum Einlösen eines Einladungscodes wurde in eine separate Datei ausgelagert
export { redeemInvitationCode } from './redeemInvitationCode';

// Funktion zum Abrufen verknüpfter Benutzer mit Profilinformationen
export const getLinkedUsers = async (userId: string) => {
  try {
    // Verwenden der neuen RPC-Funktion, die Benutzerinformationen zurückgibt
    const { data, error } = await supabase.rpc('get_linked_users_with_info', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error fetching linked users:', error);
      return { success: false, error };
    }

    console.log('Linked users with info:', data);
    return data; // Die Funktion gibt bereits { success: true, linkedUsers: [...] } zurück
  } catch (error) {
    console.error('Exception fetching linked users:', error);
    return {
      success: false,
      error: { message: 'Fehler beim Abrufen der verknüpften Benutzer.' }
    };
  }
};

// Funktion zum Abrufen des Entbindungstermins mit Informationen über verknüpfte Benutzer
export const getDueDateWithLinkedUsers = async (userId: string) => {
  try {
    // Verwenden der neuen RPC-Funktion
    const { data, error } = await supabase.rpc('get_due_date_with_linked_users', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error fetching due date with linked users:', error);
      return { success: false, error };
    }

    console.log('Due date with linked users:', data);
    return data; // Die Funktion gibt { success: true, dueDate: ..., isBabyBorn: ..., linkedUsers: [...] } zurück
  } catch (error) {
    console.error('Exception fetching due date with linked users:', error);
    return {
      success: false,
      error: { message: 'Fehler beim Abrufen des Entbindungstermins.' }
    };
  }
};

// Funktion zum Aktualisieren des Entbindungstermins und Synchronisieren mit verknüpften Benutzern
export const updateDueDateAndSync = async (userId: string, dueDate: Date) => {
  try {
    // Verwenden der neuen RPC-Funktion
    const { data, error } = await supabase.rpc('update_due_date_and_sync', {
      p_user_id: userId,
      p_due_date: dueDate.toISOString()
    });

    if (error) {
      console.error('Error updating due date and syncing:', error);
      return { success: false, error };
    }

    console.log('Due date updated and synced:', data);
    return data; // Die Funktion gibt { success: true, dueDate: ..., syncResult: {...} } zurück
  } catch (error) {
    console.error('Exception updating due date and syncing:', error);
    return {
      success: false,
      error: { message: 'Fehler beim Aktualisieren des Entbindungstermins.' }
    };
  }
};
