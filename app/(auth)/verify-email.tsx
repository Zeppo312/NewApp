import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { resendOTPToken, checkEmailVerification } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyEmailScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();

  useEffect(() => {
    // E-Mail aus dem aktuellen User laden
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    // Countdown für erneutes Senden
    let interval: ReturnType<typeof setInterval>;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert('Fehler', 'E-Mail-Adresse nicht gefunden');
      return;
    }

    setIsLoading(true);
    setCanResend(false);

    try {
      const { error } = await resendOTPToken(email);
      
      if (error) {
        console.error('Resend email error:', error);
        Alert.alert('Fehler', 'E-Mail konnte nicht erneut gesendet werden');
        setCanResend(true);
      } else {
        Alert.alert(
          'E-Mail gesendet',
          'Wir haben dir eine neue Bestätigungs-E-Mail gesendet. Bitte prüfe deinen Posteingang.'
        );
        setCountdown(60); // 60 Sekunden warten bis zum nächsten Versuch
      }
    } catch (err) {
      console.error('Resend email exception:', err);
      Alert.alert('Fehler', 'E-Mail konnte nicht erneut gesendet werden');
      setCanResend(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsLoading(true);
    
    try {
      const { isVerified } = await checkEmailVerification();
      
      if (isVerified) {
        Alert.alert(
          'E-Mail bestätigt!',
          'Deine E-Mail-Adresse wurde erfolgreich bestätigt.',
          [
            {
              text: 'Weiter',
              onPress: () => router.replace('../getUserInfo')
            }
          ]
        );
      } else {
        Alert.alert(
          'Noch nicht bestätigt',
          'Deine E-Mail-Adresse wurde noch nicht bestätigt. Bitte prüfe deinen Posteingang und klicke auf den Bestätigungslink.'
        );
      }
    } catch (err) {
      console.error('Check verification error:', err);
      Alert.alert('Fehler', 'Status konnte nicht überprüft werden');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'E-Mail-Bestätigung überspringen?',
      'Du kannst die App auch ohne E-Mail-Bestätigung nutzen, aber einige Funktionen sind möglicherweise eingeschränkt.',
      [
        { text: 'Zurück', style: 'cancel' },
        { 
          text: 'Überspringen', 
          style: 'destructive',
          onPress: () => router.replace('../getUserInfo')
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage} resizeMode="repeat">
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          <View style={styles.container}>
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <ThemedText style={styles.emailIcon}>📧</ThemedText>
              </View>

              <ThemedText type="title" style={styles.title}>
                E-Mail bestätigen
              </ThemedText>

              <ThemedText style={styles.description}>
                Wir haben dir eine Bestätigungs-E-Mail an{'\n'}
                <ThemedText style={styles.emailText}>{email}</ThemedText>{'\n'}
                gesendet.
              </ThemedText>

              <ThemedText style={styles.instruction}>
                Bitte öffne die E-Mail und klicke auf den Bestätigungslink.
              </ThemedText>

              <ThemedView style={styles.buttonContainer} lightColor={theme.card} darkColor={theme.card}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleCheckVerification}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? 'Überprüfe...' : 'Status prüfen'}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.secondaryButton,
                    (!canResend || isLoading) && styles.buttonDisabled
                  ]}
                  onPress={handleResendEmail}
                  disabled={!canResend || isLoading}
                >
                  <ThemedText style={[styles.buttonText, styles.secondaryButtonText]}>
                    {countdown > 0 
                      ? `Erneut senden (${countdown}s)` 
                      : 'E-Mail erneut senden'
                    }
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkip}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.skipButtonText} lightColor={theme.accent} darkColor={theme.accent}>
                    Erstmal überspringen
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </View>
          </View>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  emailIcon: {
    fontSize: 64,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
    opacity: 0.8,
  },
  emailText: {
    fontWeight: '600',
    color: Colors.light.accent,
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  button: {
    height: 54,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: Colors.light.success,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButtonText: {
    color: Colors.light.accent,
  },
  skipButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
