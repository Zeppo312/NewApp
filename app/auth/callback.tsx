import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    // Verarbeiten des Auth-Callbacks
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Zur Hauptapp navigieren
        router.replace('/(tabs)');
      }
    });
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Bestätigung wird verarbeitet...</Text>
    </View>
  );
}
