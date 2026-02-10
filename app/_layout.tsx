import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BabyStatusProvider } from '@/contexts/BabyStatusContext';
import { ActiveBabyProvider, useActiveBaby } from '@/contexts/ActiveBabyContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ConvexProvider, useConvex } from '@/contexts/ConvexContext';
import { BackendProvider, useBackend } from '@/contexts/BackendContext';
import { BackgroundProvider } from '@/contexts/BackgroundContext';
import { checkForNewNotifications, registerBackgroundNotificationTask, BACKGROUND_NOTIFICATION_TASK } from '@/lib/notificationService';
import { useNotifications } from '@/hooks/useNotifications';
import { useSleepWindowNotifications } from '@/hooks/useSleepWindowNotifications';
import { useFeedingReminderNotifications } from '@/hooks/useFeedingReminderNotifications';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { initializePersonalization, predictNextSleepWindow, type SleepWindowPrediction } from '@/lib/sleep-window';
import { predictNextFeedingTime, type FeedingPrediction } from '@/lib/feeding-interval';
import { getBabyInfo } from '@/lib/baby';
import { supabase } from '@/lib/supabase';
import type { SleepEntry } from '@/lib/sleepData';
import type { BabyCareEntry } from '@/lib/supabase';
import { preloadAppData } from '@/lib/appCache';
import { SleepEntriesService } from '@/lib/services/SleepEntriesService';
import { normalizeBedtimeAnchor } from '@/lib/bedtime';

// Importieren der Meilenstein-Task-Definition
import { defineMilestoneCheckerTask } from '@/tasks/milestoneCheckerTask';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://a379435f1d8ad0e5df795df00050dd95@o4506394338263040.ingest.us.sentry.io/4509762120056832',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Task für Meilenstein-Benachrichtigungen definieren
// Dies muss auf Root-Ebene der App geschehen, damit der Task auch im Hintergrund funktioniert
defineMilestoneCheckerTask();

// Definiere den Background-Task für Benachrichtigungen
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    console.log('Führe Benachrichtigungs-Hintergrundtask aus...');
    await checkForNewNotifications();
    return "newData";
  } catch (error) {
    console.error('Error in background notification task:', error);
    return "failed";
  }
});

// Konfiguriere das Verhalten von Benachrichtigungen für die gesamte App
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Wrapper-Komponente, die den AuthProvider verwendet
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { loading, user } = useAuth();
  const userId = user?.id ?? null;
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const { requestPermissions, expoPushToken } = useNotifications();
  const { activeBabyId } = useActiveBaby();
  const { activeBackend } = useBackend();
  const { convexClient } = useConvex();
  const [sleepPrediction, setSleepPrediction] = useState<SleepWindowPrediction | null>(null);
  const [feedingPrediction, setFeedingPrediction] = useState<FeedingPrediction | null>(null);
  const { preferences: notifPrefs } = useNotificationPreferences();
  const sleepEntriesService = useMemo(() => {
    if (!userId) return null;
    return new SleepEntriesService(activeBackend, convexClient, userId);
  }, [activeBackend, convexClient, userId]);

  useEffect(() => {
    if (!userId) return;
    initializePersonalization(activeBabyId ?? undefined).catch((error) => {
      console.error('Fehler beim Initialisieren der Sleep-Personalisierung:', error);
    });
  }, [userId, activeBabyId]);

  // Registriere Push-Notifications und Hintergrundtask, wenn der Benutzer angemeldet ist
  useEffect(() => {
    if (userId) {
      // Push-Token registrieren für Remote-Notifications
      requestPermissions().catch(error => {
        console.error('Fehler beim Registrieren von Push-Notifications:', error);
      });

      // Hintergrundtask registrieren (für Polling, falls nötig)
      registerBackgroundNotificationTask().catch(error => {
        console.error('Fehler beim Registrieren des Benachrichtigungs-Hintergrundtasks:', error);
      });
    }
  }, [userId, requestPermissions]);

  // Sleep Window Prediction für Benachrichtigungen berechnen
  useEffect(() => {
    if (!userId || !activeBabyId || !sleepEntriesService) {
      setSleepPrediction(null);
      return;
    }

    const loadSleepPrediction = async () => {
      try {
        // Baby-Info laden
        const { data: babyInfo, error: babyError } = await getBabyInfo(activeBabyId);
        if (babyError || !babyInfo?.birth_date) {
          setSleepPrediction(null);
          return;
        }

        // Sichtbare Einträge (inkl. Partner) über denselben Service wie im Sleep Tracker laden
        const { data: entries, error } = await sleepEntriesService.getEntries(activeBabyId ?? undefined);

        if (error) {
          console.error('Fehler beim Laden der Schlafeinträge für Prediction:', error);
          setSleepPrediction(null);
          return;
        }

        // Prediction berechnen
        const anchorBedtime = normalizeBedtimeAnchor(
          (babyInfo as { preferred_bedtime?: string | null }).preferred_bedtime
        );
        const prediction = await predictNextSleepWindow({
          userId,
          babyId: activeBabyId ?? undefined,
          birthdate: babyInfo.birth_date,
          entries: (entries || []) as SleepEntry[],
          anchorBedtime,
        });

        // Nur setzen, wenn Confidence ausreichend ist
        // Der Hook prüft confidence >= 0.6, gleiche Schwelle hier
        if (prediction && prediction.confidence >= 0.6) {
          setSleepPrediction(prediction);
        } else {
          setSleepPrediction(null);
        }
      } catch (error) {
        console.error('Fehler beim Berechnen der Sleep Prediction:', error);
        setSleepPrediction(null);
      }
    };

    loadSleepPrediction();

    // Alle 5 Minuten aktualisieren
    const interval = setInterval(loadSleepPrediction, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, activeBabyId, sleepEntriesService]);

  // Feeding Prediction für Benachrichtigungen berechnen
  useEffect(() => {
    if (!userId || !activeBabyId) {
      setFeedingPrediction(null);
      return;
    }

    const loadFeedingPrediction = async () => {
      try {
        // Baby-Info laden
        const { data: babyInfo, error: babyError } = await getBabyInfo(activeBabyId);
        if (babyError || !babyInfo?.birth_date) {
          setFeedingPrediction(null);
          return;
        }

        // Fütterungseinträge der letzten 7 Tage laden
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: entries, error } = await supabase
          .from('baby_care_entries')
          .select('*')
          .eq('baby_id', activeBabyId)
          .eq('entry_type', 'feeding')
          .gte('start_time', sevenDaysAgo.toISOString())
          .order('start_time', { ascending: false });

        if (error) {
          console.error('Fehler beim Laden der Feeding-Einträge für Prediction:', error);
          setFeedingPrediction(null);
          return;
        }

        const prediction = predictNextFeedingTime({
          babyBirthDate: babyInfo.birth_date,
          recentFeedings: (entries || []) as BabyCareEntry[],
        });

        setFeedingPrediction(prediction);
      } catch (error) {
        console.error('Fehler beim Berechnen der Feeding Prediction:', error);
        setFeedingPrediction(null);
      }
    };

    loadFeedingPrediction();

    // Alle 5 Minuten aktualisieren
    const interval = setInterval(loadFeedingPrediction, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, activeBabyId]);

  // Sleep Window Notifications Hook (läuft unabhängig vom Screen)
  useSleepWindowNotifications(
    sleepPrediction,
    notifPrefs.sleepWindowReminder,
    userId,
    activeBabyId,
    expoPushToken
  );

  // Feeding Reminder Notifications Hook
  useFeedingReminderNotifications(
    feedingPrediction,
    notifPrefs.feedingReminder,
    userId,
    activeBabyId,
    expoPushToken
  );

  // Wir verwenden jetzt die index.tsx Datei als Einstiegspunkt, die die Weiterleitung basierend auf dem Auth-Status übernimmt
  useEffect(() => {
    if (!loading) {
      console.log('Layout: Auth loading complete, setting initial route');
      // Wir setzen die initiale Route auf den Root-Pfad, der dann zur richtigen Route weiterleitet
      setInitialRoute('index');
    }
  }, [loading]);

  // Zeige einen Ladeindikator, während der Authentifizierungsstatus geprüft wird
  if (loading || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
        <View style={{ marginTop: 20 }}>
          <Text style={{ marginTop: 10, color: '#7D5A50' }}>Lade...</Text>
          <StatusBar hidden={true} />
        </View>
      </View>
    );
  }

  // Wenn der Benutzer angemeldet ist, zur Hauptapp navigieren, sonst zum Login-Screen
  // Anpassen der Themes, um den weißen Banner zu entfernen
  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: 'transparent',
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: 'transparent',
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? customDarkTheme : customLightTheme}>
        <Stack
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'slide_from_right'
          }}
        >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="diary-entries" />
        <Stack.Screen name="community" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="pregnancy-stats" />
        <Stack.Screen name="account-linking" />
        <Stack.Screen name="sync-test" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="auth/reset-password" />
      </Stack>
      <StatusBar hidden={true} />
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Hauptkomponente, die den AuthProvider einrichtet
export default Sentry.wrap(function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [appIsReady, setAppIsReady] = useState(false);

  // Vorbereiten der App
  useEffect(() => {
    async function prepare() {
      try {
        // Warten, bis die Schriftarten geladen sind
        if (loaded) {
          // Preload wichtige App-Daten (User Settings, Profile, Premium Status)
          // Dies reduziert Supabase-Aufrufe während der App-Nutzung
          try {
            await preloadAppData();
          } catch (preloadError) {
            console.warn('Preload warning (non-critical):', preloadError);
          }

          // Kurze Verzögerung, um sicherzustellen, dass alles bereit ist
          await new Promise(resolve => setTimeout(resolve, 300));

          // App ist bereit
          setAppIsReady(true);
        }
      } catch (e) {
        console.warn('Error preparing app:', e);
      }
    }

    prepare();
  }, [loaded]);

  // Ausblenden des Splash-Screens, wenn die App bereit ist
  useEffect(() => {
    if (appIsReady) {
      try {
        SplashScreen.hideAsync();
      } catch (error) {
        console.error('Error hiding splash screen:', error);
      }
    }
  }, [appIsReady]);

  // Anzeigen eines Ladeindikators, wenn die App noch nicht bereit ist
  if (!appIsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
        <Text style={{ marginTop: 10, color: '#7D5A50' }}>App wird geladen...</Text>
      </View>
    );
  }

  // Umschließen der App mit dem AuthProvider und BabyStatusProvider
  // ConvexProvider und BackendProvider für Dual-Backend-Architektur hinzugefügt
  return (
    <AuthProvider>
      <ConvexProvider>
        <BackendProvider>
          <BackgroundProvider>
            <AppThemeProvider>
              <NavigationProvider>
                <ActiveBabyProvider>
                  <BabyStatusProvider>
                    <RootLayoutNav />
                  </BabyStatusProvider>
                </ActiveBabyProvider>
              </NavigationProvider>
            </AppThemeProvider>
          </BackgroundProvider>
        </BackendProvider>
      </ConvexProvider>
    </AuthProvider>
  );
});
