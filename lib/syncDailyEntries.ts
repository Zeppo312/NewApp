import { supabase, getCachedUser, getLinkedUsersWithDetails } from './supabase';

// Funktion zum einmaligen Synchronisieren aller bestehenden Alltag-Einträge (bidirektional mit Flag)
export const syncAllExistingDailyEntries = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { success: false, error: 'Nicht angemeldet' };

    console.log('Attempting to sync all existing daily entries for user:', userData.user.id);

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

    // Deaktiviere temporär die Trigger für die Synchronisation
    try {
      await supabase.rpc('disable_daily_sync_triggers');
      console.log('Disabled sync triggers');
    } catch (triggerError) {
      console.warn('Could not disable triggers, proceeding with caution:', triggerError);
    }

    try {
      // Manuelles Synchronisieren der Alltag-Einträge
      console.log('Starting manual sync...');

      // Abrufen aller Alltag-Einträge des Benutzers
      const { data: myEntries, error: myError } = await supabase
        .from('baby_daily')
        .select('*')
        .eq('user_id', userData.user.id);

      if (myError) {
        console.error('Error fetching user daily entries:', myError);
        return { success: false, error: myError };
      }

      console.log(`Found ${myEntries?.length || 0} daily entries for current user`);

      let syncedCount = 0;

      // Für jeden verknüpften Benutzer
      for (const linkedUser of linkedUsersResult.linkedUsers) {
        console.log(`Syncing with linked user: ${linkedUser.firstName} (${linkedUser.userId})`);

        // Abrufen aller Alltag-Einträge des verknüpften Benutzers
        const { data: theirEntries, error: theirError } = await supabase
          .from('baby_daily')
          .select('*')
          .eq('user_id', linkedUser.userId);

        if (theirError) {
          console.error(`Error fetching daily entries for linked user ${linkedUser.userId}:`, theirError);
          continue;
        }

        console.log(`Found ${theirEntries?.length || 0} daily entries for linked user ${linkedUser.userId}`);

        // Bestimmen, ob der aktuelle Benutzer der Einladende ist
        const isInviter = linkedUser.linkCreatorId === userData.user.id;

        if (isInviter) {
          // Der aktuelle Benutzer ist der Einladende
          // Seine Einträge haben Priorität

          // Löschen aller bestehenden Einträge des Eingeladenen
          const { error: deleteError } = await supabase
            .from('baby_daily')
            .delete()
            .eq('user_id', linkedUser.userId);

          if (deleteError) {
            console.error(`Error deleting entries for linked user ${linkedUser.userId}:`, deleteError);
            continue;
          }

          // Neu einfügen aller Einträge für den Eingeladenen
          for (const entry of myEntries || []) {
            const { error: insertError } = await supabase
              .from('baby_daily')
              .insert({
                user_id: linkedUser.userId,
                entry_date: entry.entry_date,
                entry_type: entry.entry_type,
                start_time: entry.start_time,
                end_time: entry.end_time,
                notes: entry.notes,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (insertError) {
              console.error(`Error inserting entry for linked user ${linkedUser.userId}:`, insertError);
              continue;
            }

            syncedCount++;
          }
        } else {
          // Der aktuelle Benutzer ist der Eingeladene
          // Die Einträge des Einladenden haben Priorität

          // Löschen aller bestehenden Einträge des Eingeladenen (aktueller Benutzer)
          const { error: deleteError } = await supabase
            .from('baby_daily')
            .delete()
            .eq('user_id', userData.user.id);

          if (deleteError) {
            console.error(`Error deleting entries for current user:`, deleteError);
            continue;
          }

          // Neu einfügen aller Einträge des Einladenden für den Eingeladenen
          for (const entry of theirEntries || []) {
            const { error: insertError } = await supabase
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

            if (insertError) {
              console.error(`Error inserting entry for current user:`, insertError);
              continue;
            }

            syncedCount++;
          }
        }
      }

      console.log(`Manual sync completed, synced ${syncedCount} entries`);

      return {
        success: true,
        message: 'Alltag-Einträge wurden bidirektional synchronisiert',
        syncedCount,
        linkedUsers: linkedUsersResult.linkedUsers
      };
    } finally {
      // Aktiviere die Trigger wieder, unabhängig vom Ergebnis
      try {
        await supabase.rpc('enable_daily_sync_triggers');
        console.log('Re-enabled sync triggers');
      } catch (triggerError) {
        console.warn('Could not re-enable triggers:', triggerError);
      }
    }
  } catch (err) {
    console.error('Failed to sync all existing daily entries:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
  }
};

// Funktion zum Synchronisieren der Alltag-Einträge vom einladenden Benutzer zum eingeladenen Benutzer
export const syncDailyEntriesFromInviterToInvitee = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { success: false, error: 'Nicht angemeldet' };

    console.log('Attempting to sync daily entries from inviter to invitee for user:', userData.user.id);

    // Verwenden der RPC-Funktion
    const { data, error } = await supabase.rpc('sync_daily_entries_from_inviter_to_invitee', {
      p_user_id: userData.user.id
    });

    if (error) {
      console.error('Error syncing daily entries from inviter to invitee:', error);
      return { success: false, error: error.message };
    }

    console.log('Successfully synced daily entries from inviter to invitee:', data);
    return data;
  } catch (err) {
    console.error('Failed to sync daily entries from inviter to invitee:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
  }
};
