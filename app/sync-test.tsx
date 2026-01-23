import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedBackground } from '@/components/ThemedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { 
  loadAllSleepEntries, 
  syncAllSleepEntries, 
  activateRealtimeSync, 
  deactivateRealtimeSync 
} from '@/lib/improvedSleepSync';
import { startSleepTracking, stopSleepTracking } from '@/lib/sleepData';
import { loadConnectedUsers } from '@/lib/improvedSleepSync';
import Header from '@/components/Header';

export default function SyncTestScreen() {
  const { user } = useAuth();
  const [results, setResults] = useState<string[]>([]);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testEntryId, setTestEntryId] = useState<string | null>(null);

  // Hilfsfunktion zum Loggen der Ergebnisse
  const logResult = (message: string) => {
    setResults(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev]);
  };

  // Teste das Laden aller Einträge
  const testLoadEntries = async () => {
    setIsLoading(true);
    logResult("Teste loadAllSleepEntries...");
    
    try {
      const result = await loadAllSleepEntries();
      if (result.success) {
        logResult(`✅ ${result.entries?.length || 0} Einträge geladen`);
      } else {
        logResult(`❌ Fehler: ${result.error}`);
      }
    } catch (error) {
      logResult(`❌ Exception: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Teste die Synchronisierung
  const testSyncEntries = async () => {
    setIsLoading(true);
    logResult("Teste syncAllSleepEntries...");
    
    try {
      const result = await syncAllSleepEntries();
      if (result.success) {
        logResult(`✅ ${result.syncedCount || 0} Einträge synchronisiert`);
        if (result.message) {
          logResult(`ℹ️ ${result.message}`);
        }
      } else {
        logResult(`❌ Fehler: ${result.error}`);
      }
    } catch (error) {
      logResult(`❌ Exception: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Teste Realtime-Sync
  const toggleRealtimeSync = async () => {
    setIsLoading(true);
    
    try {
      if (isRealtimeActive) {
        await deactivateRealtimeSync();
        logResult("✅ Realtime-Sync deaktiviert");
        setIsRealtimeActive(false);
      } else {
        await activateRealtimeSync((payload) => {
          const eventType = payload.eventType;
          const table = payload.table;
          const newData = payload.new ? JSON.stringify(payload.new).substring(0, 100) + "..." : "null";
          
          logResult(`📡 Realtime-Update: Typ=${eventType}, Tabelle=${table}`);
          logResult(`📡 Neue Daten: ${newData}`);
        });
        logResult("✅ Realtime-Sync aktiviert - Ändere etwas in der Datenbank");
        setIsRealtimeActive(true);
      }
    } catch (error) {
      logResult(`❌ Realtime Exception: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Löscht das Log
  const clearLog = () => {
    setResults([]);
    logResult("Log gelöscht");
  };
  
  // Teste account_links Verbindungen
  const testAccountLinks = async () => {
    setIsLoading(true);
    logResult("Prüfe account_links Verbindungen...");
    
    try {
      const { success, linkedUsers, error, methodUsed } = await loadConnectedUsers();
      
      if (success) {
        if (linkedUsers && linkedUsers.length > 0) {
          logResult(`✅ ${linkedUsers.length} Verbindung(en) in account_links gefunden (Methode: ${methodUsed || 'direkt'})`);
          
          // Zeige Details zu jeder Verbindung
          linkedUsers.forEach((user, index) => {
            logResult(`🔗 Partner ${index + 1}: ${user.displayName} (${user.userId})`);
            logResult(`   - Beziehungstyp: ${user.relationship || 'Partner'}`);
            logResult(`   - Link-Status: ${user.status || 'Aktiv'}`);
          });
          
          logResult("✅ Diese Partner-IDs werden für Sleep Entries verwendet");
        } else {
          logResult("⚠️ Keine Verbindungen in account_links gefunden");
          logResult("⚠️ Partner-Synchronisierung wird nicht funktionieren!");
          
          // Zeige Hinweis zur Table-Struktur
          logResult("ℹ️ Die account_links Tabelle sollte folgendes enthalten:");
          logResult("id, creator_id, invited_id, status='accepted'");
        }
      } else {
        logResult(`❌ Fehler beim Laden der Verbindungen: ${error}`);
      }
    } catch (error) {
      logResult(`❌ Exception: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Teste Sleep Entry erstellen und stoppen
  const testCreateSleepEntry = async () => {
    setIsLoading(true);
    logResult("Teste Sleep Entry erstellen (Partner-Modell)...");
    
    try {
      // Starte einen Schlafvorgang (aktiviert automatisch Partner-Synchronisierung)
      const startResult = await startSleepTracking();
      if (startResult.success && startResult.entry?.id) {
        const entryId = startResult.entry.id;
        setTestEntryId(entryId);
        logResult(`✅ Sleep Entry erstellt! ID: ${entryId}`);
        
        // Prüfe, ob ein Partner gefunden wurde
        if (startResult.entry.partner_id) {
          logResult(`✅ Partner automatisch zugewiesen: ${startResult.entry.partner_id}`);
        } else {
          logResult(`⚠️ Kein Partner gefunden - du brauchst eine Verbindung in account_links`);
        }
        
        // Aktiviere gleich Realtime, wenn sie noch nicht aktiv ist
        if (!isRealtimeActive) {
          await toggleRealtimeSync();
        }
      } else {
        logResult(`❌ Fehler beim Erstellen: ${startResult.error}`);
      }
    } catch (error) {
      logResult(`❌ Exception: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Teste Sleep Entry stoppen
  const testStopSleepEntry = async () => {
    if (!testEntryId) {
      logResult("⚠️ Erstelle zuerst einen Test-Eintrag!");
      return;
    }
    
    setIsLoading(true);
    logResult(`Teste Sleep Entry stoppen (ID: ${testEntryId})...`);
    
    try {
      // Stoppe den Schlafvorgang
      const stopResult = await stopSleepTracking(testEntryId, 'good', 'Test-Schlaf mit Partner-Synchronisierung');
      if (stopResult.success) {
        logResult(`✅ Sleep Entry gestoppt und Qualität gesetzt`);
        logResult(`✅ Diese Änderung sollte bei beiden Partnern sichtbar sein!`);
        
        // Setze ID zurück für den nächsten Test
        setTestEntryId(null);
      } else {
        logResult(`❌ Fehler beim Stoppen: ${stopResult.error}`);
      }
    } catch (error) {
      logResult(`❌ Exception: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Hinweise und Anleitung
  useEffect(() => {
    logResult("Willkommen im Sync-Test!");
    logResult("Diese Seite hilft dir, die verbesserten Synchronisierungsfunktionen zu testen.");
    logResult("1. 'Einträge laden' ruft alle Schlafeinträge mit der verbesserten Funktion ab");
    logResult("2. 'Synchronisieren' teilt deine Einträge mit verknüpften Benutzern");
    logResult("3. 'Realtime aktivieren' startet ein Echtzeit-Abonnement für Änderungen");
    logResult("4. 'Test-Eintrag erstellen + stoppen' demonstriert das Partner-Modell");
  }, []);

  // Cleanup: Realtime beim unmount beenden
  useEffect(() => {
    return () => {
      if (isRealtimeActive) {
        console.log('Sync-Test unmounting - cleaning up Realtime subscription');
        deactivateRealtimeSync();
      }
    };
  }, [isRealtimeActive]);

  return (
    <ThemedBackground>
      <Header title="Sync-Test" />
      
      <View style={styles.container}>
        <Text style={styles.title}>Synchronisierungs-Tester</Text>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Teste hier die neuen, verbesserten Synchronisierungsfunktionen. Mit Realtime erhältst du automatisch Updates, wenn sich Daten ändern.
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={testLoadEntries}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Einträge laden</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={testSyncEntries}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Synchronisieren</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, isRealtimeActive ? styles.activeButton : null]} 
            onPress={toggleRealtimeSync}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isRealtimeActive ? "Realtime deaktivieren" : "Realtime aktivieren"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.clearButton]} 
            onPress={clearLog}
          >
            <Text style={styles.buttonText}>Log löschen</Text>
          </TouchableOpacity>
          
          {/* Account-Links Tests */}
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Account-Links Tests</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.accountLinksButton]} 
            onPress={testAccountLinks}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Account-Links prüfen</Text>
          </TouchableOpacity>
          
          {/* Partner-Synchronisierungs-Tests */}
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Partner-Synchronisierungs-Tests</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.partnerButton]} 
            onPress={testCreateSleepEntry}
            disabled={isLoading || testEntryId !== null}
          >
            <Text style={styles.buttonText}>
              {testEntryId !== null ? "Test-Eintrag aktiv..." : "Test-Eintrag erstellen"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.partnerButton,
                  testEntryId === null ? styles.disabledButton : null]} 
            onPress={testStopSleepEntry}
            disabled={isLoading || testEntryId === null}
          >
            <Text style={styles.buttonText}>Test-Eintrag stoppen</Text>
          </TouchableOpacity>
        </View>
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A8D8A8" />
          </View>
        )}
        
        <Text style={styles.logTitle}>Ergebnisse:</Text>
        
        <ScrollView style={styles.logContainer}>
          {results.map((result, index) => (
            <Text key={index} style={styles.logEntry}>{result}</Text>
          ))}
        </ScrollView>
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(63, 81, 181, 0.2)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 10,
    width: '48%',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  clearButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    width: '100%',
    marginTop: 5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    width: '100%',
  },
  partnerButton: {
    backgroundColor: 'rgba(156, 39, 176, 0.3)',
  },
  accountLinksButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  logContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 10,
  },
  logEntry: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 5,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
    borderRadius: 10,
  },
});
