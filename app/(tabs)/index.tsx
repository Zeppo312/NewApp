import { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, View, StatusBar, SafeAreaView, ActivityIndicator, AppState, Platform, RefreshControl, Dimensions, Animated, Text, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
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
  formatTime as formatBackgroundTime
} from '@/lib/background-tasks';
import Header from '@/components/Header';
import { GlassCard, LiquidGlassCard, GLASS_OVERLAY, TIMELINE_INSET, LAYOUT_PAD, RADIUS, SECTION_GAP_BOTTOM, SECTION_GAP_TOP, PRIMARY } from '@/constants/DesignGuide';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ProgressCircle } from '@/components/ProgressCircle';
import DateTimePicker from '@react-native-community/datetimepicker';

type Contraction = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null; // in seconds
  interval: number | null; // time since last contraction in seconds
  intensity: string | null; // Stärke der Wehe (schwach, mittel, stark)
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
const startOfWeek = (d: Date) => {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1); // Montag als Wochenstart
  return startOfDay(new Date(copy.setDate(diff)));
};
const endOfWeek = (d: Date) => {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1);
const shiftDateForTab = (date: Date, tab: 'day' | 'week' | 'month', step: number) => {
  const next = new Date(date);
  if (tab === 'day') {
    next.setDate(date.getDate() + step);
  } else if (tab === 'week') {
    next.setDate(date.getDate() + 7 * step);
  } else {
    next.setMonth(date.getMonth() + step);
  }
  return next;
};
const ensureValidManualDate = (value: Date | null, fallback: Date) => {
  if (!value || Number.isNaN(value.getTime()) || value.getTime() <= 0) {
    return fallback;
  }
  return value;
};
const formatSecondsCompact = (seconds?: number | null) => {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const safeSeconds = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};
const formatAgo = (start?: Date | null) => {
  if (!start) return '—';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
  if (diffMinutes < 1) return 'Gerade eben';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const GRID_COLS = 2;
const GRID_GUTTER = 12;
const GRID_COL_W = Math.floor((contentWidth - (GRID_COLS - 1) * GRID_GUTTER) / GRID_COLS);
const INTENSITY_STYLES = {
  schwach: {
    background: 'rgba(56,161,105,0.18)',
    border: 'rgba(56,161,105,0.6)',
    text: '#2F855A',
  },
  mittel: {
    background: 'rgba(245,166,35,0.18)',
    border: 'rgba(245,166,35,0.6)',
    text: '#B4690E',
  },
  stark: {
    background: 'rgba(229,62,62,0.18)',
    border: 'rgba(229,62,62,0.6)',
    text: '#C53030',
  },
} as const;

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
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualStartTime, setManualStartTime] = useState(new Date());
  const [manualEndTime, setManualEndTime] = useState(new Date(Date.now() + 60 * 1000));
  const [manualIntensity, setManualIntensity] = useState<'schwach' | 'mittel' | 'stark' | null>(null);
  const [showManualStartPicker, setShowManualStartPicker] = useState(false);
  const [showManualEndPicker, setShowManualEndPicker] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const safeManualStartTime = ensureValidManualDate(manualStartTime, new Date());
  const safeManualEndTime = ensureValidManualDate(
    manualEndTime,
    new Date(safeManualStartTime.getTime() + 60 * 1000)
  );

  const selectedRange = useMemo(() => {
    if (selectedTab === 'week') {
      return { start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) };
    }
    if (selectedTab === 'month') {
      return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    }
    return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
  }, [selectedDate, selectedTab]);

  const filteredContractions = useMemo(
    () =>
      contractions.filter(
        (c) => c.startTime >= selectedRange.start && c.startTime < selectedRange.end
      ),
    [contractions, selectedRange.start, selectedRange.end]
  );

  const stats = useMemo(() => {
    const sortedContractions = [...filteredContractions].sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
    const durations = sortedContractions
      .map((c) => c.duration)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const intervals = sortedContractions
      .slice(0, -1)
      .map((contraction, index) => {
        const nextContraction = sortedContractions[index + 1];
        return Math.floor(
          (contraction.startTime.getTime() - nextContraction.startTime.getTime()) / 1000
        );
      })
      .filter((v): v is number => typeof v === 'number' && v > 0);

    const average = (values: number[]) =>
      values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

    const last = sortedContractions[0];

    return {
      count: sortedContractions.length,
      avgDuration: average(durations),
      longestDuration: durations.length ? Math.max(...durations) : 0,
      avgInterval: average(intervals),
      lastStart: last?.startTime ?? null,
      lastIntensity: last?.intensity ?? null,
    };
  }, [filteredContractions]);

  const nextRangeDisabled = useMemo(() => {
    const candidate = shiftDateForTab(selectedDate, selectedTab, 1);
    const candidateStart =
      selectedTab === 'week'
        ? startOfWeek(candidate)
        : selectedTab === 'month'
          ? startOfMonth(candidate)
          : startOfDay(candidate);
    const todayBoundary = endOfDay(startOfDay(new Date()));
    return candidateStart >= todayBoundary;
  }, [selectedDate, selectedTab]);

  const rangeTitle =
    selectedTab === 'week' ? 'Wochenansicht' : selectedTab === 'month' ? 'Monatsansicht' : 'Tagesansicht';

  const rangeSubtitle = useMemo(() => {
    if (selectedTab === 'week') {
      const start = startOfWeek(selectedDate);
      const end = endOfWeek(selectedDate);
      const displayEnd = new Date(end);
      displayEnd.setDate(end.getDate() - 1);
      return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${displayEnd.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`;
    }
    if (selectedTab === 'month') {
      return selectedDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    }
    return selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  }, [selectedDate, selectedTab]);

  const changeRange = (direction: 'prev' | 'next') => {
    if (direction === 'next' && nextRangeDisabled) return;
    setSelectedDate((prev) => shiftDateForTab(prev, selectedTab, direction === 'next' ? 1 : -1));
  };

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
        const formattedContractions: Contraction[] = data.map((c: any) => ({
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

  const openManualModal = () => {
    const now = new Date();
    setManualStartTime(now);
    setManualEndTime(new Date(now.getTime() + 60 * 1000));
    setManualIntensity(null);
    setShowManualStartPicker(false);
    setShowManualEndPicker(false);
    setManualModalVisible(true);
  };

  const closeManualModal = () => {
    setManualModalVisible(false);
    setShowManualStartPicker(false);
    setShowManualEndPicker(false);
  };

  const computeIntervalBefore = (start: Date) => {
    const previous = [...contractions]
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .find(c => c.startTime.getTime() < start.getTime());
    if (!previous) return null;
    const seconds = Math.floor((start.getTime() - previous.startTime.getTime()) / 1000);
    return seconds > 0 ? seconds : null;
  };

  const handleManualSave = async () => {
    if (safeManualEndTime <= safeManualStartTime) {
      Alert.alert('Fehler', 'Die Endzeit muss nach der Startzeit liegen.');
      return;
    }

    const durationSeconds = Math.max(
      1,
      Math.round((safeManualEndTime.getTime() - safeManualStartTime.getTime()) / 1000)
    );
    const interval = computeIntervalBefore(safeManualStartTime);

    const manualContraction: Contraction = {
      id: generateUniqueId(),
      startTime: safeManualStartTime,
      endTime: safeManualEndTime,
      duration: durationSeconds,
      interval,
      intensity: null,
    };

    await saveContractionWithIntensity(manualContraction, manualIntensity);
    closeManualModal();
    await loadContractions();
  };

  const TopTabs = () => (
    <View style={styles.topTabsContainer}>
      {(['day', 'week', 'month'] as const).map((tab) => (
        <GlassCard
          key={tab}
          style={[styles.topTab, selectedTab === tab && styles.activeTopTab]}
          intensity={22}
        >
          <TouchableOpacity
            style={styles.topTabInner}
            onPress={() => setSelectedTab(tab)}
            activeOpacity={0.85}
          >
            <Text style={[styles.topTabText, selectedTab === tab && styles.activeTopTabText]}>
              {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      ))}
    </View>
  );

  const StatusMetricsBar = () => (
    <>
      <View style={styles.kpiRow}>
        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(142, 78, 198, 0.1)"
          borderColor="rgba(142, 78, 198, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="waveform.path.ecg" size={12} color="#8E4EC6" />
            <Text style={styles.kpiTitle}>Wehen</Text>
          </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>{stats.count}</Text>
        </GlassCard>

        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(255, 140, 66, 0.1)"
          borderColor="rgba(255, 140, 66, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="timer" size={12} color="#FF8C42" />
            <Text style={styles.kpiTitle}>Ø Dauer</Text>
          </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>
            {formatSecondsCompact(stats.avgDuration)}
          </Text>
        </GlassCard>
      </View>

      <View style={styles.kpiRow}>
        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(168, 196, 162, 0.1)"
          borderColor="rgba(168, 196, 162, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="clock.fill" size={12} color="#A8C4A2" />
            <Text style={styles.kpiTitle}>Ø Intervall</Text>
          </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>
            {formatSecondsCompact(stats.avgInterval)}
          </Text>
        </GlassCard>

        <GlassCard
          style={styles.kpiCard}
          intensity={20}
          overlayColor="rgba(255, 155, 155, 0.1)"
          borderColor="rgba(255, 155, 155, 0.25)"
        >
          <View style={styles.kpiHeaderRow}>
            <IconSymbol name="heart.fill" size={12} color="#FF9B9B" />
            <Text style={styles.kpiTitle}>Letzte Wehe</Text>
          </View>
          <Text style={[styles.kpiValue, styles.kpiValueCentered]}>
            {formatAgo(stats.lastStart)}
          </Text>
        </GlassCard>
      </View>
    </>
  );

  const RangeNavigation = () => (
    <View style={styles.weekNavigationContainer}>
      <TouchableOpacity style={styles.weekNavButton} onPress={() => changeRange('prev')} activeOpacity={0.85}>
        <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
      </TouchableOpacity>
      <View style={styles.weekHeaderCenter}>
        <ThemedText style={styles.weekHeaderTitle}>{rangeTitle}</ThemedText>
        <ThemedText style={styles.weekHeaderSubtitle}>{rangeSubtitle}</ThemedText>
      </View>
      <TouchableOpacity
        style={[styles.weekNavButton, nextRangeDisabled && { opacity: 0.4 }]}
        onPress={() => changeRange('next')}
        disabled={nextRangeDisabled}
        activeOpacity={0.85}
      >
        <ThemedText style={styles.weekNavButtonText}>›</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const ActionButtons = () => (
    <View style={styles.cardsGrid}>
      {timerRunning ? (
        <TouchableOpacity
          style={styles.fullWidthStopButton}
          onPress={stopContraction}
          activeOpacity={0.9}
        >
          <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
            <View
              style={[
                styles.card,
                styles.liquidGlassCard,
                { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' },
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: 'rgba(255, 140, 160, 0.9)' },
                ]}
              >
                <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.cardTitle}>Wehe beenden</Text>
              <Text style={styles.cardDescription}>Timer stoppen</Text>
            </View>
          </BlurView>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W, marginRight: GRID_GUTTER }]}
            onPress={startContraction}
            activeOpacity={0.9}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View
                style={[
                  styles.card,
                  styles.liquidGlassCard,
                  { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: 'rgba(142, 78, 198, 0.9)' },
                  ]}
                >
                  <IconSymbol name="waveform.path.ecg" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.cardTitle}>Wehe starten</Text>
                <Text style={styles.cardDescription}>Timer beginnen</Text>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W }]}
            onPress={openManualModal}
            activeOpacity={0.9}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View
                style={[
                  styles.card,
                  styles.liquidGlassCard,
                  { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: 'rgba(168, 196, 193, 0.9)' },
                  ]}
                >
                  <IconSymbol name="plus.circle.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.cardTitle}>Manuell</Text>
                <Text style={styles.cardDescription}>Eintrag hinzufügen</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

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
            <TopTabs />
            <StatusMetricsBar />
            <RangeNavigation />

            <View style={[styles.timerWrapper, styles.fullWidthCard]}>
              <View style={styles.centralTimerContainer}>
                <Animated.View style={[styles.centralContainer, { transform: [{ scale: pulseAnim }] }]}>
                  {(() => {
                    const ringSize = screenWidth * 0.75;
                    const circleSize = Math.round(ringSize * 0.8);
                    const progress = timerRunning ? Math.min((elapsedTime / 120) * 100, 100) : 0;
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
                          <Text style={[styles.centralTime, { color: '#6B4C3B', fontWeight: '800' }]}>
                            {formatTime(elapsedTime)}
                          </Text>
                        </View>

                        <View pointerEvents="none" style={styles.upperContent}>
                          <View
                            style={[
                              styles.centralIcon,
                              {
                                backgroundColor: timerRunning ? 'rgba(135, 206, 235, 0.9)' : 'rgba(255, 140, 66, 0.9)',
                                borderRadius: 30,
                                padding: 8,
                                borderWidth: 2,
                                borderColor: 'rgba(255,255,255,0.6)',
                                shadowColor: 'rgba(255, 255, 255, 0.3)',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.12,
                                shadowRadius: 2,
                                elevation: 4,
                              },
                            ]}
                          >
                            <IconSymbol name={timerRunning ? 'waveform.path.ecg' : 'heart.fill'} size={28} color="#FFFFFF" />
                          </View>
                        </View>

                        <View pointerEvents="none" style={styles.lowerContent}>
                          <Text style={[styles.centralStatus, { color: '#6B4C3B', fontWeight: '700' }]}>
                            {timerRunning ? 'Wehe läuft' : 'Bereit'}
                          </Text>
                          {timerRunning ? (
                            <Text style={[styles.centralHint, { color: '#7D5A50', fontWeight: '500' }]}>
                              Timer läuft auch im Hintergrund weiter
                            </Text>
                          ) : (
                            <Text style={[styles.centralHint, { color: '#7D5A50', fontWeight: '500' }]}>
                              Tippe unten, um eine neue Wehe zu starten
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })()}
                </Animated.View>
              </View>
            </View>

            <View style={styles.captureSection}>
              <Text style={styles.sectionTitle}>Wehenerfassung</Text>
              <ActionButtons />
            </View>

            <View style={styles.historySection}>
              <View style={[styles.historyHeader, styles.fullWidthCard] }>
                <ThemedText
                  type="subtitle"
                  style={styles.historyTitle}
                  lightColor="#5C4033"
                  darkColor="#F2E6DD"
                >
                  Wehenverlauf
                </ThemedText>
              </View>

              {linkedUsers.length > 0 && (
                <LiquidGlassCard style={styles.fullWidthCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={{ padding: 12 }}>
                    <ThemedText style={styles.syncInfoText} lightColor="#5C4033" darkColor="#F2E6DD">
                      Deine Wehen werden automatisch mit {linkedUsers.map(user => user.firstName).join(', ')} synchronisiert.
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              )}

              {!isLoading && filteredContractions.length > 0 && (
                <VerticalContractionTimeline
                  contractions={filteredContractions}
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
              ) : filteredContractions.length === 0 ? (
                <LiquidGlassCard style={[styles.emptyGlass, styles.fullWidthCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <View style={styles.emptyInner}>
                    <ThemedText lightColor={theme.text} darkColor={theme.text}>
                      Noch keine Wehen im Zeitraum aufgezeichnet
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              ) : null}
            </View>
          </View>
        </ScrollView>
        {manualModalVisible && (
          <Modal
            visible={manualModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closeManualModal}
          >
            <View style={styles.manualModalOverlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeManualModal} />
              <BlurView intensity={80} tint="extraLight" style={styles.manualModalCard}>
                <View style={styles.manualHeader}>
                  <TouchableOpacity style={styles.manualHeaderButton} onPress={closeManualModal}>
                    <Text style={styles.manualHeaderButtonText}>✕</Text>
                  </TouchableOpacity>
                  <View style={styles.manualHeaderCenter}>
                    <Text style={styles.manualTitle}>Manuelle Wehe</Text>
                    <Text style={styles.manualSubtitle}>Trage Start- und Endzeit ein</Text>
                  </View>
                  <TouchableOpacity style={[styles.manualHeaderButton, styles.manualSaveButton]} onPress={handleManualSave}>
                    <Text style={styles.manualSaveButtonText}>✓</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.manualScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.manualContent}>
                    <View style={styles.manualSection}>
                      <Text style={styles.manualSectionTitle}>⏰ Zeitraum</Text>
                      <View style={styles.manualTimeRow}>
                        <TouchableOpacity
                          style={styles.manualTimeButton}
                          onPress={() => setShowManualStartPicker(true)}
                        >
                          <Text style={styles.manualTimeLabel}>Start</Text>
                          <Text style={styles.manualTimeValue}>
                            {safeManualStartTime.toLocaleString('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.manualTimeButton}
                          onPress={() => setShowManualEndPicker(true)}
                        >
                          <Text style={styles.manualTimeLabel}>Ende</Text>
                          <Text style={styles.manualTimeValue}>
                            {safeManualEndTime.toLocaleString('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {showManualStartPicker && (
                        <View style={styles.manualPickerContainer}>
                          <DateTimePicker
                            value={safeManualStartTime}
                            mode="datetime"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            onChange={(_, date) => {
                              if (date) {
                                setManualStartTime(date);
                                if (safeManualEndTime <= date) {
                                  setManualEndTime(new Date(date.getTime() + 60 * 1000));
                                }
                              }
                            }}
                            style={styles.manualPicker}
                          />
                          <TouchableOpacity
                            style={styles.manualPickerDone}
                            onPress={() => setShowManualStartPicker(false)}
                          >
                            <Text style={styles.manualPickerDoneText}>Fertig</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {showManualEndPicker && (
                        <View style={styles.manualPickerContainer}>
                          <DateTimePicker
                            value={safeManualEndTime}
                            mode="datetime"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            onChange={(_, date) => {
                              if (date) {
                                if (date <= safeManualStartTime) {
                                  Alert.alert('Hinweis', 'Die Endzeit muss nach der Startzeit liegen.');
                                } else {
                                  setManualEndTime(date);
                                }
                              }
                            }}
                            style={styles.manualPicker}
                          />
                          <TouchableOpacity
                            style={styles.manualPickerDone}
                            onPress={() => setShowManualEndPicker(false)}
                          >
                            <Text style={styles.manualPickerDoneText}>Fertig</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    <View style={styles.manualSection}>
                      <Text style={styles.manualSectionTitle}>💪 Intensität</Text>
                      <View style={styles.manualIntensityRow}>
                        {(['schwach', 'mittel', 'stark'] as const).map(level => (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.intensityPill,
                              manualIntensity === level && {
                                backgroundColor: INTENSITY_STYLES[level].background,
                                borderColor: INTENSITY_STYLES[level].border,
                              },
                            ]}
                            onPress={() => setManualIntensity(level)}
                          >
                            <Text
                              style={[
                                styles.intensityPillText,
                                manualIntensity === level && { color: INTENSITY_STYLES[level].text },
                              ]}
                            >
                              {level === 'schwach' ? 'Schwach' : level === 'mittel' ? 'Mittel' : 'Stark'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </BlurView>
            </View>
          </Modal>
        )}
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
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 0,
    alignSelf: 'center',
    width: contentWidth,
  },
  topTab: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  topTabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  activeTopTab: { borderColor: 'rgba(94,61,179,0.65)' },
  topTabText: { fontSize: 13, fontWeight: '700', color: '#7D5A50' },
  activeTopTabText: { color: PRIMARY },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'center',
    width: contentWidth,
    marginTop: 6,
    marginBottom: 4,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 64,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7D5A50',
    marginLeft: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY,
    marginTop: 1,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  kpiValueCentered: {
    textAlign: 'center',
    width: '100%',
  },
  kpiSub: {
    marginTop: 2,
    fontSize: 9,
    color: '#7D5A50',
    textAlign: 'center',
    opacity: 0.8,
  },
  scrollView: {
    paddingBottom: 140,
    paddingTop: 0,
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
  weekNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
  },
  weekNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 6,
  },
  weekNavButtonText: {
    fontSize: 24,
    color: '#8E4EC6',
    fontWeight: 'bold',
  },
  weekHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  weekHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 4,
  },
  weekHeaderSubtitle: {
    fontSize: 12,
    color: '#7D5A50',
    textAlign: 'center',
  },
  timerWrapper: {
    alignItems: 'center',
    marginBottom: 10,
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
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  centralHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 200,
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: 2,
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
  captureSection: {
    alignItems: 'center',
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  cardsGrid: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: contentWidth,
    marginBottom: 4,
  },
  liquidGlassCardWrapper: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  fullWidthStopButton: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  liquidGlassCardBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#7D5A50' },
  cardDescription: { fontSize: 12, fontWeight: '500', color: '#7D5A50', opacity: 0.9 },
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
  manualModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  manualModalCard: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  manualHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  manualHeaderButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
  },
  manualHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  manualSubtitle: {
    fontSize: 12,
    color: '#7D5A50',
    opacity: 0.8,
  },
  manualSaveButton: {
    backgroundColor: '#8E4EC6',
  },
  manualSaveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualScroll: {
    maxHeight: screenHeight * 0.6,
  },
  manualContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  manualSection: {
    marginBottom: 20,
  },
  manualSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 10,
  },
  manualTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  manualTimeButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  manualTimeLabel: {
    fontSize: 11,
    color: '#7D5A50',
    marginBottom: 4,
  },
  manualTimeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
  },
  manualPickerContainer: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  manualPicker: {
    width: '100%',
  },
  manualPickerDone: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  manualPickerDoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
  },
  manualIntensityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  intensityPill: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  intensityPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7D5A50',
  },
});
