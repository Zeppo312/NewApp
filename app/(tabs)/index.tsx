import { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, View, StatusBar, SafeAreaView, ActivityIndicator, AppState, Platform, ImageBackground, RefreshControl, Dimensions, Animated } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import VerticalContractionTimeline from '@/components/VerticalContractionTimeline';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { saveContraction, getContractions, deleteContraction, updateContraction, syncAllExistingContractions, getLinkedUsersWithDetails } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { 
  startContractionTimer, 
  stopContractionTimer, 
  getContractionTimerState, 
  setupNotifications,
  setupDynamicIsland,
  ContractionTimerData,
  formatTime as formatBackgroundTime
} from '@/lib/background-tasks';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, TIMELINE_INSET, LAYOUT_PAD, RADIUS } from '@/constants/DesignGuide';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ProgressCircle } from '@/components/ProgressCircle';

type Contraction = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null; // in seconds
  interval: number | null; // time since last contraction in seconds
  intensity: string | null; // Stärke der Wehe (schwach, mittel, stark)
};

export default function HomeScreen() {
  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [currentContraction, setCurrentContraction] = useState<Contraction | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<any>(null);
  const [linkedUsers, setLinkedUsers] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Hilfsfunktion zur Generierung einer eindeutigen ID
  const generateUniqueId = (): string => {
    // Kombiniere Zeitstempel mit einer zufälligen Zahl für mehr Eindeutigkeit
    return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  };

  // Initialize background tasks and notifications
  useEffect(() => {
    const initBackgroundServices = async () => {
      await setupNotifications();
      
      if (Platform.OS === 'ios') {
        await setupDynamicIsland();
      }
      
      // Check if timer is already running in background
      const timerState = await getContractionTimerState();
      if (timerState.isRunning) {
        // Resume timer
        setTimerRunning(true);
        setElapsedTime(timerState.elapsedTime);
        
        // Create a current contraction object
        const startTimeDate = new Date(timerState.startTime);
        setCurrentContraction({
          id: generateUniqueId(),
          startTime: startTimeDate,
          endTime: null,
          duration: null,
          interval: null,
          intensity: null
        });
      }
    };
    
    initBackgroundServices();
    
    // Setup notification response handler
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier === 'stop') {
        // User tapped "Stop" button in notification
        stopContraction();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Subtle pulsing of central timer
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [pulseAnim]);

  // Start a new contraction
  const startContraction = async () => {
    // Aktuelle Zeit für die neue Wehe
    const now = new Date();

    // Berechne das Intervall zur vorherigen Wehe (falls vorhanden)
    let interval = null;
    if (contractions.length > 0) {
      // Wir nehmen die neueste Wehe (contractions[0]), da die Liste nach Startzeit sortiert ist (neueste zuerst)
      const lastContraction = contractions[0];
      // Berechne den Abstand in Sekunden zwischen der aktuellen Zeit und der Startzeit der letzten Wehe
      interval = Math.floor((now.getTime() - new Date(lastContraction.startTime).getTime()) / 1000);
    }

    const newContraction: Contraction = {
      id: generateUniqueId(),
      startTime: now,
      endTime: null,
      duration: null,
      interval: interval,
      intensity: null // Wird später beim Beenden der Wehe gesetzt
    };

    console.log('Starting new contraction with ID:', newContraction.id, 'interval:', interval);
    setCurrentContraction(newContraction);
    setTimerRunning(true);
    setElapsedTime(0);
    
    // Start background timer
    await startContractionTimer();
  };

  // Funktion zum Anzeigen des Intensitäts-Dialogs mit Buttons
  const showIntensityDialog = (completedContraction: Contraction) => {
    // Erstellen eines benutzerdefinierten Dialogs mit farbigen Buttons
    Alert.alert(
      'Intensität der Wehe',
      'Wie stark war die Wehe?',
      [
        {
          text: '🟢 Schwach',
          onPress: () => saveContractionWithIntensity(completedContraction, 'schwach')
        },
        {
          text: '🟠 Mittel',
          onPress: () => saveContractionWithIntensity(completedContraction, 'mittel')
        },
        {
          text: '🔴 Stark',
          onPress: () => saveContractionWithIntensity(completedContraction, 'stark')
        },
        {
          text: 'Abbrechen',
          style: 'cancel',
          onPress: () => saveContractionWithIntensity(completedContraction, null)
        }
      ]
    );
  };

  // Funktion zum Speichern der Wehe mit Intensität
  const saveContractionWithIntensity = async (completedContraction: Contraction, intensity: string | null) => {
    // Aktualisiere die Wehe mit der Intensität
    const finalContraction: Contraction = {
      ...completedContraction,
      intensity
    };

    console.log('Saving contraction with ID:', finalContraction.id, 'and intensity:', intensity);

    // Lokale Aktualisierung für sofortige UI-Reaktion
    setContractions([finalContraction, ...contractions]);

    // In Supabase speichern
    try {
      const contractionData = {
        start_time: finalContraction.startTime.toISOString(),
        end_time: finalContraction.endTime?.toISOString() || null,
        duration: finalContraction.duration,
        interval: finalContraction.interval,
        intensity: finalContraction.intensity
      };

      console.log('Sending contraction data to Supabase:', contractionData);

      const { data, error } = await saveContraction(contractionData);

      if (error) {
        console.error('Error saving contraction:', error);
        let errorMessage = 'Wehe konnte nicht gespeichert werden.';
        if (error.message) {
          errorMessage += ` Grund: ${error.message}`;
          console.error('Detailed error message:', error.message);
        }
        Alert.alert('Fehler', errorMessage);

        // Bei Fehler die Wehen neu laden, um den lokalen Zustand zu aktualisieren
        loadContractions();
      } else {
        console.log('Successfully saved contraction with server ID:', data?.id);

        // Wenn die Wehe erfolgreich gespeichert wurde und eine Server-ID erhalten hat,
        // aktualisieren wir die lokale ID, um sie mit der Server-ID zu synchronisieren
        if (data && data.id) {
          setContractions(prevContractions => {
            return prevContractions.map(c => {
              if (c.id === finalContraction.id) {
                return { ...c, id: data.id };
              }
              return c;
            });
          });
        }
      }
    } catch (err) {
      console.error('Failed to save contraction:', err);
      Alert.alert('Fehler', `Ein unerwarteter Fehler ist aufgetreten: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
      // Bei Fehler die Wehen neu laden
      loadContractions();
    }

    // Check if contractions are getting close together and frequent
    checkContractionWarning(finalContraction, contractions);
  };

  // Stop the current contraction
  const stopContraction = async () => {
    if (currentContraction) {
      const endTime = new Date();
      
      // Get final timer data from background
      const timerData = await stopContractionTimer();
      const duration = timerData.elapsedTime;

      const completedContraction: Contraction = {
        ...currentContraction,
        endTime,
        duration
      };

      setCurrentContraction(null);
      setTimerRunning(false);
      // Timer auf 0 zurücksetzen
      setElapsedTime(0);

      // Zeige den Dialog zur Eingabe der Intensität an
      showIntensityDialog(completedContraction);
    }
  };

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        const updateTimerFromBackground = async () => {
          if (timerRunning) {
            const timerState = await getContractionTimerState();
            setElapsedTime(timerState.elapsedTime);
          }
        };
        
        updateTimerFromBackground();
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [timerRunning]);

  // Timer effect - only for UI updates when app is in foreground
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (timerRunning) {
      intervalId = setInterval(async () => {
        if (Platform.OS === 'ios' && Device.isDevice) {
          // On real iOS devices, get time from background service
          const timerState = await getContractionTimerState();
          setElapsedTime(timerState.elapsedTime);
        } else {
          // For other platforms or simulator, increment locally
          setElapsedTime(prev => prev + 1);
        }
      }, 1000) as unknown as NodeJS.Timeout;
      
      timerRef.current = intervalId;
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [timerRunning]);

  // Überprüft, ob die Wehen auf einen fortgeschrittenen Geburtsbeginn hindeuten
  const checkContractionWarning = (newContraction: Contraction, existingContractions: Contraction[]) => {
    // Wir brauchen mindestens 12 Wehen für eine Stunde Beobachtung (ca. alle 5 Minuten)
    if (existingContractions.length < 11) return; // 11 existierende + 1 neue = 12 Wehen

    // Alle Wehen der letzten Stunde sammeln (neueste zuerst)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentContractions = [newContraction, ...existingContractions]
      .filter(c => c.startTime >= oneHourAgo && c.endTime !== null && c.duration !== null);

    // Wenn wir nicht genug Wehen in der letzten Stunde haben, abbrechen
    if (recentContractions.length < 12) return;

    // Die letzten 12 Wehen für die Analyse verwenden
    const lastTwelveContractions = recentContractions.slice(0, 12);

    // 1. Häufigkeit: Wehen etwa alle 5 Minuten (300 Sekunden)
    // Wir prüfen, ob die Intervalle zwischen 240-360 Sekunden (4-6 Minuten) liegen
    const correctFrequency = lastTwelveContractions.every(c =>
      c.interval !== null && c.interval >= 240 && c.interval <= 360
    );

    // 2. Dauer: Jede Wehe hält etwa 1 Minute an (50-70 Sekunden)
    const correctDuration = lastTwelveContractions.every(c =>
      c.duration !== null && c.duration >= 50 && c.duration <= 70
    );

    // 3. Konstanz: Dieses Muster hält mindestens 1 Stunde an
    // (Wir haben bereits gefiltert, dass wir 12 Wehen in der letzten Stunde haben)

    // Wenn alle Kriterien erfüllt sind, zeige die Warnung an
    if (correctFrequency && correctDuration) {
      Alert.alert(
        "Geburtsbeginn fortgeschritten",
        "Deine Wehen zeigen ein konstantes Muster: Sie treten etwa alle 5 Minuten auf und halten jeweils etwa 1 Minute an. Dieses Muster besteht seit mindestens einer Stunde. Der Geburtsbeginn ist wahrscheinlich so weit fortgeschritten, dass du besser jetzt ins Krankenhaus fahren solltest.",
        [{ text: "Verstanden" }]
      );
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    return formatBackgroundTime(seconds);
  };

  // Funktion zum Löschen einer Wehe
  const handleDeleteContraction = async (contractionId: string) => {
    console.log('Handling delete for contraction ID:', contractionId);

    // Wir führen die Löschung direkt aus, da der Bestätigungsdialog bereits in der ContractionItem-Komponente angezeigt wird
    try {
      // Prüfen, ob die ID ein gültiges Format hat
      if (!contractionId || typeof contractionId !== 'string') {
        console.error('Invalid contraction ID:', contractionId);
        Alert.alert('Fehler', 'Ungültige Wehen-ID. Bitte versuchen Sie es erneut.');
        return;
      }

      // Prüfen, ob die Wehe in der lokalen Liste existiert
      const contractionExists = contractions.some(c => c.id === contractionId);
      if (!contractionExists) {
        console.error('Contraction not found in local state:', contractionId);
        Alert.alert('Fehler', 'Die Wehe konnte nicht gefunden werden.');
        return;
      }

      // Optimistische UI-Aktualisierung
      setContractions(prevContractions =>
        prevContractions.filter(c => c.id !== contractionId)
      );

      console.log('Sending delete request to Supabase for ID:', contractionId);
      // In Supabase löschen
      deleteContraction(contractionId).then(({ error }) => {
        if (error) {
          console.error('Error deleting contraction:', error);

          // Detailliertere Fehlermeldung
          let errorMessage = 'Wehe konnte nicht gelöscht werden.';
          if (error.message) {
            errorMessage += ` Grund: ${error.message}`;
            console.error('Detailed error message:', error.message);
          }

          Alert.alert('Fehler', errorMessage);

          // Bei Fehler die Wehen neu laden
          loadContractions();
        } else {
          console.log('Successfully deleted contraction with ID:', contractionId);
        }
      }).catch(err => {
        console.error('Failed to delete contraction:', err);
        // Bei Fehler die Wehen neu laden
        Alert.alert('Fehler', `Wehe konnte nicht gelöscht werden. Fehler: ${err.message || 'Unbekannter Fehler'}`);
        loadContractions();
      });
    } catch (err) {
      console.error('Failed to delete contraction:', err);
      // Bei Fehler die Wehen neu laden
      Alert.alert('Fehler', `Ein unerwarteter Fehler ist aufgetreten: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
      loadContractions();
    }
  };

  // Funktion zum Bearbeiten der Intensität einer Wehe
  const handleEditContractionIntensity = async (contractionId: string, newIntensity: string) => {
    console.log('Handling edit for contraction ID:', contractionId, 'new intensity:', newIntensity);

    try {
      // Prüfen, ob die ID ein gültiges Format hat
      if (!contractionId || typeof contractionId !== 'string') {
        console.error('Invalid contraction ID:', contractionId);
        Alert.alert('Fehler', 'Ungültige Wehen-ID. Bitte versuchen Sie es erneut.');
        return;
      }

      // Finde die Wehe in der lokalen Liste
      const contractionToUpdate = contractions.find(c => c.id === contractionId);
      if (!contractionToUpdate) {
        console.error('Contraction not found in local state:', contractionId);
        Alert.alert('Fehler', 'Die Wehe konnte nicht gefunden werden.');
        return;
      }

      // Optimistische UI-Aktualisierung
      setContractions(prevContractions =>
        prevContractions.map(c => {
          if (c.id === contractionId) {
            return { ...c, intensity: newIntensity };
          }
          return c;
        })
      );

      console.log('Sending update request to Supabase for ID:', contractionId);

      // In Supabase aktualisieren
      const { data, error } = await updateContraction(contractionId, { intensity: newIntensity });

      if (error) {
        console.error('Error updating contraction:', error);

        // Detailliertere Fehlermeldung
        let errorMessage = 'Wehe konnte nicht aktualisiert werden.';
        if (error.message) {
          errorMessage += ` Grund: ${error.message}`;
          console.error('Detailed error message:', error.message);
        }

        Alert.alert('Fehler', errorMessage);

        // Bei Fehler die Wehen neu laden
        loadContractions();
      } else {
        console.log('Successfully updated contraction with ID:', contractionId);
        Alert.alert('Erfolg', 'Die Intensität der Wehe wurde erfolgreich aktualisiert.');
      }
    } catch (err) {
      console.error('Failed to update contraction:', err);
      // Bei Fehler die Wehen neu laden
      Alert.alert('Fehler', `Ein unerwarteter Fehler ist aufgetreten: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
      loadContractions();
    }
  };

  // Funktion zum Laden der Wehen aus Supabase
  const loadContractions = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error, syncInfo: newSyncInfo } = await getContractions();

      if (error) {
        console.error('Error loading contractions:', error);
        Alert.alert('Fehler', 'Wehen konnten nicht geladen werden.');
        return;
      }

      if (data) {
        // Konvertieren der Supabase-Daten in das lokale Format
        const formattedContractions: Contraction[] = data.map(c => ({
          id: c.id,
          startTime: new Date(c.start_time),
          endTime: c.end_time ? new Date(c.end_time) : null,
          duration: c.duration,
          interval: c.interval,
          intensity: c.intensity
        }));

        // Sortieren der Wehen nach Startzeit (neueste zuerst)
        formattedContractions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

        // Berechne die Intervalle zwischen den Wehen, falls sie nicht korrekt gesetzt sind
        for (let i = 0; i < formattedContractions.length - 1; i++) {
          const currentContraction = formattedContractions[i];
          const nextContraction = formattedContractions[i + 1];

          // Wenn das Intervall nicht gesetzt ist oder 0 ist, berechne es neu
          if (!currentContraction.interval || currentContraction.interval <= 0) {
            // Berechne den Abstand zwischen der aktuellen und der nächsten Wehe
            const intervalInSeconds = Math.floor(
              (currentContraction.startTime.getTime() - nextContraction.startTime.getTime()) / 1000
            );

            // Setze das Intervall, wenn es positiv ist
            if (intervalInSeconds > 0) {
              currentContraction.interval = intervalInSeconds;
              console.log(`Recalculated interval for contraction ${currentContraction.id}: ${intervalInSeconds}s`);
            }
          }
        }

        setContractions(formattedContractions);

        // Speichern der Synchronisierungsinformationen
        if (newSyncInfo) {
          setSyncInfo(newSyncInfo);
          console.log('Sync info loaded:', newSyncInfo);
        }
      }
    } catch (err) {
      console.error('Failed to load contractions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Funktion zum Laden der verknüpften Benutzer
  const loadLinkedUsers = async () => {
    if (!user) return;

    try {
      console.log('Loading linked users...');
      const result = await getLinkedUsersWithDetails();
      console.log('Linked users result:', result);

      if (result.success && result.linkedUsers) {
        setLinkedUsers(result.linkedUsers);
        console.log('Linked users loaded:', result.linkedUsers);

        // Wenn verknüpfte Benutzer vorhanden sind, einmalige Synchronisierung durchführen
        if (result.linkedUsers.length > 0) {
          console.log(`Found ${result.linkedUsers.length} linked users, starting sync...`);
          await syncContractions();
        } else {
          console.log('No linked users found, skipping sync');
        }
      } else {
        console.log('No linked users found or error loading linked users');
        setLinkedUsers([]);
      }
    } catch (err) {
      console.error('Failed to load linked users:', err);
      setLinkedUsers([]);

      // Trotzdem versuchen, die Wehen zu laden
      await loadContractions();
    }
  };

  // Funktion zum einmaligen Synchronisieren aller bestehenden Wehen
  const syncContractions = async () => {
    if (!user) return;

    try {
      setIsSyncing(true);

      console.log('Starting contraction synchronization...');
      const result = await syncAllExistingContractions();
      console.log('Sync result:', result);

      if (!result.success) {
        console.error('Error syncing all existing contractions:', result.error);
        Alert.alert('Fehler', `Wehen konnten nicht synchronisiert werden: ${result.error || 'Unbekannter Fehler'}`);
        return;
      }

      // Wenn keine verknüpften Benutzer gefunden wurden
      if (result.message === 'Keine verknüpften Benutzer gefunden') {
        console.log('No linked users found, skipping sync notification');
        // Keine Benachrichtigung anzeigen, da keine Synchronisierung notwendig war
        return;
      }

      // Erfolgsmeldung anzeigen, wenn Wehen synchronisiert wurden
      if (result.syncedCount > 0) {
        const linkedUserNames = result.linkedUsers && result.linkedUsers.length > 0
          ? result.linkedUsers.map((user: any) => user.firstName).join(', ')
          : 'deinem Partner';

        Alert.alert(
          'Synchronisierung erfolgreich',
          `${result.syncedCount} Wehen wurden erfolgreich mit ${linkedUserNames} synchronisiert.`
        );
      } else {
        console.log('No contractions needed to be synced');
      }

      // Wehen neu laden
      await loadContractions();
    } catch (err) {
      console.error('Failed to sync contractions:', err);
      Alert.alert('Fehler', `Ein unerwarteter Fehler ist aufgetreten: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Laden der Wehen und verknüpften Benutzer beim Start
  useEffect(() => {
    if (user) {
      loadContractions();
      loadLinkedUsers();
    }
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadContractions();
    setIsRefreshing(false);
  };

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header 
          title="Wehen-Tracker" 
          subtitle="Verfolge deine Wehen bis zur Geburt" 
        />

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.tint]}
              tintColor={theme.tint}
            />
          }
        >
          {isSyncing && (
            <View style={styles.syncingContainer}>
              <ActivityIndicator color={theme.accent} size="small" />
              <ThemedText style={styles.syncingText}>Synchronisiere...</ThemedText>
            </View>
          )}
          
          <View style={styles.container}>
            <LiquidGlassCard style={[styles.timerGlass, styles.fullWidthCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
              <View style={styles.centralTimerContainer}>
                <Animated.View style={[styles.centralContainer, { transform: [{ scale: pulseAnim }] }]}>
                  {(() => {
                    const { width: screenWidth } = Dimensions.get('window');
                    const ringSize = Math.min(screenWidth * 0.82, 380);
                    const circleSize = Math.round(ringSize * 0.87);
                    const progress = timerRunning ? Math.min((elapsedTime / 120) * 100, 100) : 0; // 120s Ziel
                    return (
                      <View style={[styles.circleArea, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
                        <View style={[styles.glassCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
                          <BlurView intensity={18} tint="light" style={[styles.glassCircleBlur, { borderRadius: circleSize / 2 }]}>
                            <View style={[styles.glassCircleOverlay, { borderRadius: circleSize / 2 }]} />
                          </BlurView>
                        </View>

                        <View style={[styles.progressAbsolute, { width: circleSize, height: circleSize }]}>
                          <ProgressCircle
                            progress={progress}
                            size={circleSize}
                            strokeWidth={8}
                            progressColor={timerRunning ? '#87CEEB' : 'rgba(135,206,235,0.4)'}
                            backgroundColor="rgba(135,206,235,0.2)"
                            textColor="transparent"
                          />
                        </View>

                        <View pointerEvents="none" style={styles.centerOverlay}>
                          <ThemedText style={[styles.centralTime, { color: '#6B4C3B', fontWeight: '800' }]}>
                            {formatTime(elapsedTime)}
                          </ThemedText>
                        </View>

                        <View pointerEvents="none" style={styles.upperContent}>
                          <View style={[styles.centralIcon, { backgroundColor: timerRunning ? 'rgba(135,206,235,0.9)' : 'rgba(168,196,193,0.9)', borderRadius: 30, padding: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' }]}>
                            <IconSymbol name={timerRunning ? 'waveform.path.ecg' : 'heart.fill'} size={28} color="#FFFFFF" />
                          </View>
                        </View>

                        <View pointerEvents="none" style={styles.lowerContent}>
                          <ThemedText style={[styles.centralStatus, { color: '#6B4C3B', fontWeight: '700' }]}>
                            {timerRunning ? 'Wehe läuft' : 'Bereit'}
                          </ThemedText>
                          <ThemedText style={[styles.centralHint, { color: '#7D5A50', fontWeight: '500' }]}>
                            {timerRunning ? 'Timer läuft auch im Hintergrund weiter' : 'Tippe unten, um eine neue Wehe zu starten'}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })()}
                </Animated.View>
              </View>
            
              {/* Action Button(s) im Sleep‑Stil */}
              <View style={styles.actionsRow}>
                {!timerRunning ? (
                  <LiquidGlassCard
                    style={styles.actionCard}
                    intensity={24}
                    overlayColor={'rgba(142,78,198,0.32)'}
                    borderColor={'rgba(255,255,255,0.7)'}
                    onPress={startContraction}
                  >
                    <View style={styles.actionCardInner}>
                      <View style={[styles.actionIcon, { backgroundColor: 'rgba(142,78,198,0.9)' }]}>
                        <IconSymbol name="waveform.path.ecg" size={24} color="#FFFFFF" />
                      </View>
                      <ThemedText style={styles.actionTitle}>Wehe starten</ThemedText>
                      <ThemedText style={styles.actionDesc}>Timer beginnen</ThemedText>
                    </View>
                  </LiquidGlassCard>
                ) : (
                  <LiquidGlassCard
                    style={styles.actionCard}
                    intensity={24}
                    overlayColor={'rgba(255,155,155,0.32)'}
                    borderColor={'rgba(255,255,255,0.7)'}
                    onPress={stopContraction}
                  >
                    <View style={styles.actionCardInner}>
                      <View style={[styles.actionIcon, { backgroundColor: 'rgba(255, 140, 160, 0.9)' }]}>
                        <IconSymbol name="stop.fill" size={24} color="#FFFFFF" />
                      </View>
                      <ThemedText style={styles.actionTitle}>Wehe beenden</ThemedText>
                      <ThemedText style={styles.actionDesc}>Timer stoppen</ThemedText>
                    </View>
                  </LiquidGlassCard>
                )}
              </View>
            </LiquidGlassCard>

            <View style={styles.historySection}>
              <View style={[styles.historyHeader, styles.fullWidthCard] }>
                <ThemedText
                  type="subtitle"
                  style={styles.historyTitle}
                  lightColor="#5C4033"
                  darkColor="#F2E6DD"
                >
                  Wehen Verlauf
                </ThemedText>
              </View>

              {linkedUsers.length > 0 && (
                <LiquidGlassCard style={[styles.infoGlass, styles.fullWidthCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={{ padding: 12 }}>
                    <ThemedText style={styles.syncInfoText} lightColor="#5C4033" darkColor="#F2E6DD">
                      Deine Wehen werden automatisch mit {linkedUsers.map(user => user.firstName).join(', ')} synchronisiert.
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              )}

              {!isLoading && contractions.length > 0 && (
                <VerticalContractionTimeline
                  contractions={contractions}
                  lightColor="rgba(255, 255, 255, 0.8)"
                  darkColor="rgba(50, 50, 50, 0.8)"
                  onDelete={handleDeleteContraction}
                  onEdit={handleEditContractionIntensity}
                  containerStyle={styles.fullWidthCard}
                />
              )}

              {isLoading || isSyncing ? (
                <LiquidGlassCard style={[styles.emptyGlass, styles.fullWidthCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={styles.emptyInner}>
                    <ActivityIndicator size="large" color={theme.accent} />
                    <ThemedText style={{marginTop: 10}} lightColor={theme.text} darkColor={theme.text}>
                      {isSyncing ? 'Wehen werden synchronisiert...' : 'Wehen werden geladen...'}
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              ) : contractions.length === 0 ? (
                <LiquidGlassCard style={[styles.emptyGlass, styles.fullWidthCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={styles.emptyInner}>
                    <ThemedText lightColor={theme.text} darkColor={theme.text}>
                      Noch keine Wehen aufgezeichnet
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  fullWidthCard: {
    marginHorizontal: TIMELINE_INSET,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  syncButton: {
    backgroundColor: '#FF8C94', // Pastel red
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  syncInfoContainer: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  syncInfoText: {
    fontSize: 14,
    textAlign: 'center',
  },
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    paddingBottom: 40,
    paddingTop: 30, // Add more padding at the top for better visibility
    paddingHorizontal: LAYOUT_PAD,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30, // Increased margin for better spacing
    paddingVertical: 15,
    marginTop: 10, // Push header down a bit
  },
  headerTitle: {
    fontSize: 36, // Larger title
    marginBottom: 8,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 18, // Larger subtitle
    opacity: 0.8,
    fontStyle: 'italic',
  },
  timerGlass: {
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  // Central timer styles (align with sleep-tracker)
  centralTimerContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  centralContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  circleArea: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCircle: {
    position: 'absolute',
    overflow: 'hidden',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glassCircleBlur: { flex: 1 },
  glassCircleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(135, 206, 235, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  progressAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upperContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '60%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowerContent: {
    position: 'absolute',
    top: '60%',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  centralIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralStatus: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 16,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  centralTime: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    lineHeight: 32,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  centralHint: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 11,
    maxWidth: 220,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  timerDisplay: {
    marginVertical: 25, // More vertical margin
    padding: 30, // More padding, especially vertical padding
    paddingVertical: 40, // Extra vertical padding to ensure text is fully visible
    borderRadius: 30, // More rounded corners
    borderWidth: 3, // Thicker border for emphasis
    // Dynamic border color based on theme will be set in the component
    minWidth: 280, // Even wider for better visibility
    minHeight: 200, // Much taller to ensure text is fully visible
    alignItems: 'center',
    justifyContent: 'center', // Center vertically too
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, // Stronger shadow
    shadowRadius: 5,
    elevation: 4, // Stronger elevation
  },
  timerText: {
    fontSize: 64, // Large font but not too large to avoid clipping
    fontWeight: '700', // Bold but not too heavy
    letterSpacing: 2, // Moderate letter spacing
    textAlign: 'center', // Ensure text is centered
    textShadowColor: 'rgba(0, 0, 0, 0.1)', // Subtle text shadow
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    includeFontPadding: false, // Reduce extra padding around text
    lineHeight: 70, // Control the line height to prevent clipping
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 14, // etwas mehr Abstand zum Kreis
    backgroundColor: 'transparent',
  },
  // Neuer Glass-Button
  glassButton: {
    alignSelf: 'center',
    marginHorizontal: 16, // Abstand zu den Card-Rändern
    marginTop: 6,
    marginBottom: 10,
    borderRadius: 28,
    overflow: 'hidden',
    minWidth: 240,
  },
  actionsRow: {
    marginHorizontal: TIMELINE_INSET,
    marginTop: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  actionCard: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    width: '100%',
  },
  actionCardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    minHeight: 96,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)'
  },
  actionTitle: { fontSize: 15, fontWeight: '800', color: '#7D5A50' },
  actionDesc: { fontSize: 12, opacity: 0.9, color: '#7D5A50' },
  glassButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  glassButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 20, // Larger text
    letterSpacing: 0.5,
  },
  historySection: {
    marginTop: 30, // More margin
  },
  historyTitle: {
    marginBottom: 20, // More margin
    fontSize: 24, // Larger title
    fontWeight: '600',
  },
  emptyState: {
    padding: 30, // More padding
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 20, // More rounded corners
    height: 120, // Taller
  },
  emptyGlass: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
  },
  emptyInner: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractionItem: {
    padding: 20, // More padding
    borderRadius: 20, // More rounded corners
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  contractionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14, // More margin
    paddingBottom: 10, // More padding
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  contractionDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
  },
  leftColumn: {
    flex: 1,
    marginRight: 10,
  },
  rightColumn: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  detailItem: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    marginBottom: 10,
    borderRadius: 12,
  },
  detailLabel: {
    fontSize: 16,
    marginBottom: 6,
    opacity: 0.8,
  },
  detailValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  intensityBadge: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  intensityText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
  },
  deleteActionText: {
    color: 'white',
    fontWeight: 'bold',
    padding: 10,
  },
  timerRunningText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  syncingText: {
    marginLeft: 10,
  },
});
