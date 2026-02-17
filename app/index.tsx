import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

export default function Index() {
  const { session, loading, refreshSession } = useAuth();
  const { isBabyBorn, isLoading: isBabyStatusLoading, isResolved: isBabyStatusResolved } = useBabyStatus();
  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const backgroundColor = isDark ? Colors.dark.background : '#FFFFFF';
  const textColor = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const hasTriedRecoveryRef = useRef(false);

  // Debug-Ausgabe
  useEffect(() => {
    console.log('Auth state:', { session, loading, isBabyBorn });
  }, [session, loading, isBabyBorn]);

  // Einmaliger Session-Recovery-Pass:
  // verhindert Login-Bounce, falls die Session kurzzeitig noch nicht im Context angekommen ist.
  useEffect(() => {
    if (loading) return;

    if (session) {
      hasTriedRecoveryRef.current = false;
      setIsRecoveringSession(false);
      return;
    }

    if (hasTriedRecoveryRef.current) return;
    hasTriedRecoveryRef.current = true;
    setIsRecoveringSession(true);

    refreshSession()
      .catch((error) => {
        console.error('Session recovery failed:', error);
      })
      .finally(() => {
        setIsRecoveringSession(false);
      });
  }, [loading, refreshSession, session]);

  // Zeige einen Ladeindikator, während der Authentifizierungsstatus geprüft wird
  if (loading || isBabyStatusLoading || !isBabyStatusResolved || isRecoveringSession) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
        <Text style={{ marginTop: 10, color: textColor }}>Lade...</Text>
      </View>
    );
  }

  // Explizite Weiterleitung zum Login-Screen, wenn keine Session vorhanden ist
  if (!session) {
    console.log('No session, redirecting to auth');
    return <Redirect href="/(auth)" />;
  }

  // Wenn der Benutzer angemeldet ist, zur entsprechenden Seite navigieren
  // basierend auf dem isBabyBorn-Status

  if (isBabyBorn) {
    console.log('Baby is born, redirecting to home');
    return <Redirect href="/(tabs)/home" />;
  } else {
    console.log('Baby is not born yet, redirecting to pregnancy home');
    return <Redirect href="/(tabs)/pregnancy-home" />;
  }
}
