import { supabase } from './supabase';

/**
 * Abonniert Änderungen an der baby_daily Tabelle in Echtzeit
 * @param userId Die Benutzer-ID des aktuellen Benutzers
 * @param onInsert Callback-Funktion, die aufgerufen wird, wenn ein neuer Eintrag hinzugefügt wird
 * @param onUpdate Callback-Funktion, die aufgerufen wird, wenn ein Eintrag aktualisiert wird
 * @param onDelete Callback-Funktion, die aufgerufen wird, wenn ein Eintrag gelöscht wird
 * @returns Eine Funktion zum Beenden des Abonnements
 */
export const subscribeToDailyEntries = (
  userId: string,
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) => {
  console.log(`Subscribing to daily entries for user ${userId}`);

  // Abonniere Änderungen an den Tabellen
  const channel = supabase.channel('daily-entries-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'baby_daily',
      },
      (payload) => {
        console.log('Received realtime update:', payload);

        // Prüfe, ob der Eintrag für den aktuellen Benutzer relevant ist
        const isForCurrentUser = payload.new?.user_id === userId;
        
        // Prüfe, ob der Eintrag von einem verknüpften Benutzer stammt
        // Dies erfordert eine zusätzliche Abfrage, um zu prüfen, ob der Benutzer verknüpft ist
        const checkIfLinked = async () => {
          if (!isForCurrentUser && payload.new) {
            try {
              // Prüfe, ob der Benutzer mit dem Ersteller des Eintrags verknüpft ist
              const { data } = await supabase.rpc('get_linked_users_with_info', {
                p_user_id: userId
              });
              
              if (data?.success && data.linkedUsers) {
                const isLinked = data.linkedUsers.some(
                  (user: any) => user.userId === payload.new.user_id
                );
                
                if (isLinked) {
                  handleEvent(payload);
                }
              }
            } catch (error) {
              console.error('Error checking if user is linked:', error);
            }
          } else if (isForCurrentUser) {
            // Wenn der Eintrag für den aktuellen Benutzer ist, handle ihn direkt
            handleEvent(payload);
          }
        };

        // Verarbeite das Ereignis basierend auf dem Ereignistyp
        const handleEvent = (payload: any) => {
          switch (payload.eventType) {
            case 'INSERT':
              if (onInsert) onInsert(payload);
              break;
            case 'UPDATE':
              if (onUpdate) onUpdate(payload);
              break;
            case 'DELETE':
              if (onDelete) onDelete(payload);
              break;
          }
        };

        // Prüfe, ob der Benutzer verknüpft ist
        checkIfLinked();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'baby_care_events',
      },
      (payload) => {
        console.log('Received realtime update:', payload);
        const isForCurrentUser = payload.new?.user_id === userId;
        const checkIfLinked = async () => {
          if (!isForCurrentUser && payload.new) {
            try {
              const { data } = await supabase.rpc('get_linked_users_with_info', {
                p_user_id: userId
              });

              if (data?.success && data.linkedUsers) {
                const isLinked = data.linkedUsers.some(
                  (user: any) => user.userId === payload.new.user_id
                );

                if (isLinked) {
                  handleEvent(payload);
                }
              }
            } catch (error) {
              console.error('Error checking if user is linked:', error);
            }
          } else if (isForCurrentUser) {
            handleEvent(payload);
          }
        };

        const handleEvent = (payload: any) => {
          switch (payload.eventType) {
            case 'INSERT':
              if (onInsert) onInsert(payload);
              break;
            case 'UPDATE':
              if (onUpdate) onUpdate(payload);
              break;
            case 'DELETE':
              if (onDelete) onDelete(payload);
              break;
          }
        };

        checkIfLinked();
      }
    )
    .subscribe();

  // Rückgabe einer Funktion zum Beenden des Abonnements
  return () => {
    console.log('Unsubscribing from daily entries');
    supabase.removeChannel(channel);
  };
};
