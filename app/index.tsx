import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect } from 'react';

export default function Index() {
  const { session, loading } = useAuth();
  const { isBabyBorn, isLoading: isBabyStatusLoading } = useBabyStatus();

  // Debug-Ausgabe
  useEffect(() => {
    console.log('Auth state:', { session, loading, isBabyBorn });
  }, [session, loading, isBabyBorn]);

  // Zeige einen Ladeindikator, während der Authentifizierungsstatus geprüft wird
  if (loading || isBabyStatusLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
        <Text style={{ marginTop: 10, color: '#7D5A50' }}>Lade...</Text>
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
    console.log('Baby is not born yet, redirecting to countdown');
    return <Redirect href="/(tabs)/countdown" />;
  }
}
