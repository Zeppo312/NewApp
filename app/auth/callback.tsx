import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function Callback() {
  const router = useRouter();
  const [status, setStatus] = useState('Bestätigung wird verarbeitet...');
  const searchParams = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const code = useMemo(() => {
    const raw = searchParams.code;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [searchParams.code]);

  const type = useMemo(() => {
    const raw = searchParams.type;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [searchParams.type]);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // PKCE: Code aus Deep Link gegen Session tauschen (z.B. signup/recovery)
        if (code) {
          setStatus('Link wird verarbeitet...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Auth code exchange error:', exchangeError);
            setStatus('Fehler bei der Bestätigung');
            Alert.alert(
              'Bestätigung fehlgeschlagen',
              'Der Link ist ungültig oder abgelaufen. Bitte fordere ihn erneut an.',
              [
                {
                  text: 'Zurück zum Login',
                  onPress: () => router.replace('/(auth)/login'),
                },
              ],
            );
            return;
          }
        }

        // Recovery-Link: direkt zur Passwort-Änderung weiterleiten
        if (type === 'recovery') {
          setStatus('Passwort-Reset wird vorbereitet...');
          router.replace('/auth/reset-password' as any);
          return;
        }

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

    // Initial check
    handleAuthCallback();
  }, [code, router, type]);

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
