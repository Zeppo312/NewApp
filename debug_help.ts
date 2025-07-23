/**
 * Alternative Implementierung zum Abrufen verknüpfter Benutzer direkt aus der Datenbank-Tabelle
 */
export async function getLinkedUsersAlternative() {
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
    const linkedUsers = links.map(link => {
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

// ==========================================================================
// Füge diese Funktion in sleep-tracker.tsx ein oder ergänze die bestehende
// ==========================================================================

const debugCheckConnectionsDetailed = async () => {
  try {
    setIsSyncing(true);
    
    // Original-Methode
    console.log('Teste Original-Methode:');
    const { success: success1, linkedUsers: linkedUsers1, error: error1 } = 
      await getLinkedUsersWithDetails();
    console.log('Original-Methode Ergebnis:', 
      success1 ? `${linkedUsers1?.length || 0} verbundene Benutzer gefunden` : `Fehler: ${error1}`);
    
    // Alternative Methode testen
    console.log('Teste Alternative Methode:');
    // Da die Hilfsfunktionen nicht sofort importiert werden können, ruft sie direkt auf:
    const { getLinkedUsersAlternative } = await import('../lib/sleepData');
    const { success: success2, linkedUsers: linkedUsers2, error: error2 } = 
      await getLinkedUsersAlternative();
    console.log('Alternative Methode Ergebnis:', 
      success2 ? `${linkedUsers2?.length || 0} verbundene Benutzer gefunden` : `Fehler: ${error2}`);
    
    // Ergebnisse anzeigen
    const result1Text = success1 
      ? `${linkedUsers1?.length || 0} Benutzer: ${linkedUsers1?.map(u => u.displayName).join(', ') || 'keine'}`
      : `Fehler: ${error1}`;
    
    const result2Text = success2 
      ? `${linkedUsers2?.length || 0} Benutzer: ${linkedUsers2?.map(u => u.displayName).join(', ') || 'keine'}`
      : `Fehler: ${error2}`;
    
    Alert.alert(
      'Verbundene Benutzer Test',
      `Original: ${result1Text}\n\nAlternativ: ${result2Text}`
    );
    
    // Wenn die alternative Methode erfolgreicher ist, setzen wir die Ergebnisse
    if (!success1 && success2 && linkedUsers2?.length) {
      // @ts-ignore - Typprobleme umgehen wegen unterschiedlicher Types
      setConnectedUsers(linkedUsers2);
      setConnectionStatus('connected');
      Alert.alert(
        'Erfolg!',
        'Die verbundenen Benutzer wurden mit der alternativen Methode geladen.'
      );
    }
    
    return true;
  } catch (error) {
    console.error('Fehler beim detaillierten Prüfen der Verbindungen:', error);
    Alert.alert('Fehler', String(error));
    return false;
  } finally {
    setIsSyncing(false);
  }
};

// ==========================================================================
// Anwendung: Ergänze die bestehende Debug-Button-Leiste mit diesem Button:
// ==========================================================================

/*
<TouchableOpacity 
  style={styles.debugButton}
  onPress={debugCheckConnectionsDetailed}
  disabled={isSyncing}
>
  <ThemedText style={styles.debugButtonText}>Verbindungen detailliert</ThemedText>
</TouchableOpacity>
*/

// ==========================================================================
// SQL-Abfrage zur Überprüfung der Berechtigungen (in Supabase SQL Editor):
// ==========================================================================

/*
-- Direkte SQL-Abfrage zur Überprüfung der Benutzerverknüpfung
SELECT * FROM account_links 
WHERE (creator_id = 'DEINE_BENUTZER_ID' OR invited_id = 'DEINE_BENUTZER_ID')
AND status = 'accepted';

-- Überprüfung der RPC-Funktion (muss in der Datenbank existieren)
SELECT pg_get_functiondef('public.get_linked_users_with_details(uuid)'::regprocedure);

-- Überprüfung der Berechtigungen (RLS)
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'account_links';
SELECT * FROM pg_policies WHERE tablename = 'account_links';
*/ 