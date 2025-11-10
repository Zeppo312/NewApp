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
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { checkForNewNotifications, registerBackgroundNotificationTask, BACKGROUND_NOTIFICATION_TASK } from '@/lib/notificationService';

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

  // Registriere den Benachrichtigungs-Hintergrundtask, wenn der Benutzer angemeldet ist
  useEffect(() => {
    if (user) {
      registerBackgroundNotificationTask().catch(error => {
        console.error('Fehler beim Registrieren des Benachrichtigungs-Hintergrundtasks:', error);
      });
    }
  }, [user]);

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
        <Stack.Screen name="lotti-empfehlungen" />
        <Stack.Screen name="faq" />
        <Stack.Screen name="community" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="pregnancy-stats" />
        <Stack.Screen name="account-linking" />
        <Stack.Screen name="sync-test" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="auth/callback" />
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
          <BabyStatusProvider>
            <RootLayoutNav />
          </BabyStatusProvider>
        </NavigationProvider>
      </AppThemeProvider>
    </AuthProvider>
  );
});