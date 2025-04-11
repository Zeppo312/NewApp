import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BabyStatusProvider } from '@/contexts/BabyStatusContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Wrapper-Komponente, die den AuthProvider verwendet
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  // Bestimmen der initialen Route basierend auf dem Authentifizierungsstatus
  useEffect(() => {
    if (!loading) {
      setInitialRoute(session ? '(tabs)' : '(auth)');
    }
  }, [session, loading]);

  // Zeige einen Ladeindikator, während der Authentifizierungsstatus geprüft wird
  if (loading || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
        <View style={{ marginTop: 20 }}>
          <Text style={{ marginTop: 10, color: '#7D5A50' }}>Lade...</Text>
          <StatusBar style="auto" />
        </View>
      </View>
    );
  }

  // Wenn der Benutzer angemeldet ist, zur Hauptapp navigieren, sonst zum Login-Screen
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName={initialRoute}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

// Hauptkomponente, die den AuthProvider einrichtet
export default function RootLayout() {
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
      <BabyStatusProvider>
        <RootLayoutNav />
      </BabyStatusProvider>
    </AuthProvider>
  );
}
