import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
import { checkForNewNotifications, registerBackgroundNotificationTask, BACKGROUND_NOTIFICATION_TASK } from '@/lib/notificationService';
import { useNotifications } from '@/hooks/useNotifications';
import { useSleepWindowNotifications } from '@/hooks/useSleepWindowNotifications';
import { predictNextSleepWindow, type SleepWindowPrediction } from '@/lib/sleep-window';
import { getBabyInfo } from '@/lib/baby';
import { supabase } from '@/lib/supabase';
import type { SleepEntry } from '@/lib/sleepData';

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
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const { requestPermissions } = useNotifications();
  const { activeBabyId } = useActiveBaby();
  const [sleepPrediction, setSleepPrediction] = useState<SleepWindowPrediction | null>(null);

  // Registriere Push-Notifications und Hintergrundtask, wenn der Benutzer angemeldet ist
  useEffect(() => {
    if (user) {
      // Push-Token registrieren für Remote-Notifications
      requestPermissions().catch(error => {
        console.error('Fehler beim Registrieren von Push-Notifications:', error);
      });

      // Hintergrundtask registrieren (für Polling, falls nötig)
      registerBackgroundNotificationTask().catch(error => {
        console.error('Fehler beim Registrieren des Benachrichtigungs-Hintergrundtasks:', error);
      });
    }
  }, [user, requestPermissions]);

  // Sleep Window Prediction für Benachrichtigungen berechnen
  useEffect(() => {
    if (!user || !activeBabyId) {
      setSleepPrediction(null);
      return;
    }

    const loadSleepPrediction = async () => {
      try {
        // Baby-Info laden
        const { data: babyInfo, error: babyError } = await getBabyInfo(activeBabyId);
        if (babyError || !babyInfo?.birthdate) {
          setSleepPrediction(null);
          return;
        }

        // Schlafeinträge der letzten 30 Tage laden
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: entries, error } = await supabase
          .from('sleep_entries')
          .select('*')
          .eq('baby_id', activeBabyId)
          .gte('start_time', thirtyDaysAgo.toISOString())
          .order('start_time', { ascending: false });

        if (error) {
          console.error('Fehler beim Laden der Schlafeinträge für Prediction:', error);
          setSleepPrediction(null);
          return;
        }

        // Prediction berechnen
        const prediction = await predictNextSleepWindow({
          userId: user.id,
          birthdate: babyInfo.birthdate,
          entries: (entries || []) as SleepEntry[],
          anchorBedtime: '19:30',
        });

        // Nur setzen, wenn Confidence ausreichend ist (mindestens 5 historische Samples)
        // Diese Logik entspricht der im Hook verwendeten confidence >= 0.6 Prüfung
        if (prediction && prediction.debug) {
          const historicalSamples = (prediction.debug.historicalSampleCount as number) ?? 0;
          const personalizationSamples = (prediction.debug.personalizationSampleCount as number) ?? 0;
          const hasGoodConfidence = historicalSamples >= 5 || (historicalSamples + personalizationSamples) >= 6;

          if (hasGoodConfidence) {
            setSleepPrediction(prediction);
          } else {
            setSleepPrediction(null);
          }
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
  }, [user, activeBabyId]);

  // Sleep Window Notifications Hook (läuft unabhängig vom Screen)
  useSleepWindowNotifications(sleepPrediction);

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
        <Stack.Screen name="mini-wiki" />
        <Stack.Screen name="community" />
        <Stack.Screen name="chat/[id]" />
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
          // Simulierte Verzögerung, um sicherzustellen, dass alles bereit ist
          await new Promise(resolve => setTimeout(resolve, 500));

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
  return (
    <AuthProvider>
      <AppThemeProvider>
        <NavigationProvider>
          <ActiveBabyProvider>
            <BabyStatusProvider>
              <RootLayoutNav />
            </BabyStatusProvider>
          </ActiveBabyProvider>
        </NavigationProvider>
      </AppThemeProvider>
    </AuthProvider>
  );
});
