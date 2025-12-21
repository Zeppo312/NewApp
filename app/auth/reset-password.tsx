import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/lib/supabase';

const PRIMARY_TEXT = '#7D5A50';
const ACCENT_PURPLE = '#8E4EC6';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const code = useMemo(() => {
    const raw = searchParams.code;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [searchParams.code]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        if (code) {
          if (isMounted) setStatus('Link wird verarbeitet…');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) throw error;
        setHasSession(!!data.session);
        setStatus(null);
      } catch (err) {
        console.error('Reset password session check failed:', err);
        if (isMounted) {
          setHasSession(false);
          setStatus('Link konnte nicht verarbeitet werden.');
        }
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [code]);

  const handleUpdatePassword = async () => {
    if (isSubmitting) return;

    const nextPassword = password.trim();
    if (nextPassword.length < 8) {
      Alert.alert('Passwort zu kurz', 'Bitte wähle ein Passwort mit mindestens 8 Zeichen.');
      return;
    }
    if (nextPassword !== passwordConfirm.trim()) {
      Alert.alert('Passwörter stimmen nicht überein', 'Bitte überprüfe die Eingabe.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) throw error;

      Alert.alert('Passwort geändert', 'Dein Passwort wurde erfolgreich aktualisiert.', [
        { text: 'Weiter', onPress: () => router.replace('/') },
      ]);
    } catch (err: any) {
      console.error('Failed to update password:', err);
      Alert.alert('Fehler', err?.message || 'Dein Passwort konnte nicht geändert werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <Header
            title="Passwort ändern"
            subtitle="Bestätige dein neues Passwort"
            showBackButton
            onBackPress={() => router.replace('/(auth)/login')}
          />

          <View style={styles.content}>
            {isCheckingSession ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={ACCENT_PURPLE} />
                <ThemedText style={styles.statusText}>Lade…</ThemedText>
              </View>
            ) : !hasSession ? (
              <View style={styles.center}>
                <ThemedText style={styles.infoTitle}>Link ungültig</ThemedText>
                <ThemedText style={styles.infoText}>
                  {status ||
                    'Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere eine neue E-Mail an.'}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => router.replace('/(auth)/login')}
                  activeOpacity={0.9}
                  style={styles.secondaryButton}
                >
                  <ThemedText style={styles.secondaryButtonText}>Zum Login</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <BlurView intensity={28} tint="light" style={styles.card}>
                <ThemedText style={styles.label}>Neues Passwort</ThemedText>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mindestens 8 Zeichen"
                  placeholderTextColor="#9BA0A6"
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                  style={styles.input}
                />

                <ThemedText style={[styles.label, { marginTop: 14 }]}>Passwort bestätigen</ThemedText>
                <TextInput
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  placeholder="Wiederholen"
                  placeholderTextColor="#9BA0A6"
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                  style={styles.input}
                />

                <TouchableOpacity
                  onPress={handleUpdatePassword}
                  activeOpacity={0.9}
                  disabled={isSubmitting}
                  style={[
                    styles.primaryButton,
                    isSubmitting && { opacity: 0.7 },
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Speichern</ThemedText>
                  )}
                </TouchableOpacity>
              </BlurView>
            )}
          </View>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#f5eee0' },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 16 },

  statusText: { marginTop: 10, fontSize: 16, color: PRIMARY_TEXT },

  infoTitle: { fontSize: 20, fontWeight: '800', color: PRIMARY_TEXT, textAlign: 'center' },
  infoText: {
    marginTop: 10,
    fontSize: 14,
    color: PRIMARY_TEXT,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },

  label: { fontSize: 14, marginBottom: 8, color: PRIMARY_TEXT, fontWeight: '700' },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.75)',
    color: '#333',
  },

  primaryButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_PURPLE,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  secondaryButton: {
    marginTop: 18,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonText: { color: ACCENT_PURPLE, fontWeight: '800', fontSize: 15 },
});
