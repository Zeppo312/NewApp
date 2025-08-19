import { useEffect, useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function Callback() {
  const router = useRouter();
  const [status, setStatus] = useState('Bestätigung wird verarbeitet...');
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Prüfen des aktuellen Auth-Status
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          setStatus('Fehler bei der Bestätigung');
          Alert.alert(
            'Bestätigung fehlgeschlagen',
            'Die E-Mail-Bestätigung konnte nicht verarbeitet werden.',
            [
              { 
                text: 'Zurück zum Login', 
                onPress: () => router.replace('/(auth)/login')
              }
            ]
          );
          return;
        }

        if (session?.user) {
          setStatus('E-Mail erfolgreich bestätigt!');
          
          // Prüfen ob Profil vollständig ist
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, is_baby_born')
            .eq('id', session.user.id)
            .single();

          // Kurz warten für bessere UX
          setTimeout(() => {
            if (!profileData?.first_name) {
              // Neuer User -> Onboarding
              router.replace('/(auth)/getUserInfo');
            } else {
              // Bestehender User -> App
              if (profileData.is_baby_born) {
                router.replace('/(tabs)/home');
              } else {
                router.replace('/(tabs)/countdown');
              }
            }
          }, 2000);
        } else {
          setStatus('Keine gültige Session gefunden');
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        setStatus('Unerwarteter Fehler');
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      }
    };

    // Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email_confirmed_at);
      
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        handleAuthCallback();
      } else if (event === 'TOKEN_REFRESHED') {
        handleAuthCallback();
      }
    });

    // Initial check
    handleAuthCallback();

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <ThemedBackground style={styles.backgroundImage} resizeMode="repeat">
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ThemedText style={styles.icon}>✅</ThemedText>
          <ThemedText type="title" style={styles.title}>
            E-Mail-Bestätigung
          </ThemedText>
          <ThemedText style={styles.status}>
            {status}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
});
