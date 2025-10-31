import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, Alert, Keyboard, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { verifyOTPToken, resendOTPToken } from '@/lib/supabase';

export default function VerifyOTPScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOTP] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  // Refs für die Input-Felder
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    // Countdown für erneutes Senden
    let interval: NodeJS.Timeout;
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

  const handleOTPChange = (value: string, index: number) => {
    // Nur Zahlen erlauben
    if (!/^\d*$/.test(value)) return;

    const newOTP = [...otp];
    newOTP[index] = value;
    setOTP(newOTP);

    // Automatisch zum nächsten Feld springen
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Automatisch verifizieren wenn alle 6 Stellen eingegeben
    if (newOTP.every(digit => digit !== '') && !isLoading) {
      handleVerifyOTP(newOTP.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      // Zum vorherigen Feld springen bei Backspace
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    
    if (code.length !== 6) {
      Alert.alert('Ungültiger Code', 'Bitte gib einen 6-stelligen Code ein');
      return;
    }

    if (!email) {
      Alert.alert('Fehler', 'E-Mail-Adresse nicht gefunden');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Verifying OTP:', code, 'for email:', email);
      const { data, error } = await verifyOTPToken(email, code);
      
      if (error) {
        console.error('OTP verification error:', error);
        
        // Spezifische Fehlermeldungen
        if (error.message?.includes('invalid') || error.message?.includes('expired')) {
          Alert.alert('Ungültiger Code', 'Der eingegebene Code ist ungültig oder abgelaufen');
          setOTP(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        } else {
          Alert.alert('Verifikation fehlgeschlagen', error.message || 'Bitte versuche es erneut');
        }
        return;
      }

      console.log('OTP verification successful:', data);
      
      if (data.user) {
        Alert.alert(
          'E-Mail bestätigt! 🎉',
          'Deine E-Mail-Adresse wurde erfolgreich bestätigt.',
          [
            {
              text: 'Weiter',
              onPress: () => router.replace('../getUserInfo')
            }
          ]
        );
      }
    } catch (err) {
      console.error('OTP verification exception:', err);
      Alert.alert('Fehler', 'Verifikation fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      Alert.alert('Fehler', 'E-Mail-Adresse nicht gefunden');
      return;
    }

    setIsLoading(true);
    setCanResend(false);

    try {
      const { error } = await resendOTPToken(email);
      
      if (error) {
        console.error('Resend OTP error:', error);
        Alert.alert('Fehler', 'Code konnte nicht erneut gesendet werden');
        setCanResend(true);
      } else {
        Alert.alert(
          'Code gesendet',
          'Wir haben dir einen neuen 6-stelligen Code gesendet. Bitte prüfe deinen Posteingang.'
        );
        setCountdown(60); // 60 Sekunden warten
        setOTP(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('Resend OTP exception:', err);
      Alert.alert('Fehler', 'Code konnte nicht erneut gesendet werden');
      setCanResend(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    Alert.alert(
      'Zurück zum Login?',
      'Die Registrierung wird abgebrochen und du musst dich erneut registrieren.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Zurück', 
          style: 'destructive',
          onPress: () => router.replace('./login')
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
              {/* Header */}
              <View style={styles.header}>
                <Image
                  source={require('@/assets/images/BabyCode.png')}
                  style={styles.babyImage}
                  resizeMode="contain"
                />
                <ThemedText type="title" style={styles.title}>
                  Code eingeben
                </ThemedText>
                <ThemedText style={styles.description}>
                  Wir haben dir einen 6-stelligen Code an{'\n'}
                  <ThemedText style={styles.emailText}>{email}</ThemedText>{'\n'}
                  gesendet.
                </ThemedText>
              </View>

              {/* OTP Input */}
              <ThemedView style={styles.otpContainer} lightColor={theme.card} darkColor={theme.card}>
                <View style={styles.otpInputContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={ref => inputRefs.current[index] = ref!}
                      style={[
                        styles.otpInput,
                        {
                          backgroundColor: colorScheme === 'dark' ? '#362E28' : '#FFFFFF',
                          color: colorScheme === 'dark' ? '#FFF8F0' : '#7D5A50',
                          borderColor: digit 
                            ? Colors.light.success 
                            : (colorScheme === 'dark' ? '#7D6A5A' : '#EFE1CF'),
                          borderWidth: digit ? 2 : 1,
                        }
                      ]}
                      value={digit}
                      onChangeText={(value) => handleOTPChange(value, index)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                      autoFocus={index === 0}
                      editable={!isLoading}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.verifyButton,
                    (isLoading || otp.join('').length !== 6) && styles.buttonDisabled
                  ]}
                  onPress={() => handleVerifyOTP()}
                  disabled={isLoading || otp.join('').length !== 6}
                >
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? 'Überprüfe...' : 'Code bestätigen'}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.resendButton,
                    (!canResend || isLoading) && styles.buttonDisabled
                  ]}
                  onPress={handleResendOTP}
                  disabled={!canResend || isLoading}
                >
                  <ThemedText style={[styles.buttonText, styles.resendButtonText]}>
                    {countdown > 0 
                      ? `Code erneut senden (${countdown}s)` 
                      : 'Code erneut senden'
                    }
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleGoBack}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.backButtonText} lightColor={theme.text} darkColor={theme.text}>
                    ← Zurück zum Login
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  babyImage: {
    width: 200,
    height: 200,
    marginBottom: 16,
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
    lineHeight: 22,
    opacity: 0.8,
  },
  emailText: {
    fontWeight: '600',
    color: Colors.light.accent,
  },
  otpContainer: {
    width: '100%',
    maxWidth: 350,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpInput: {
    width: 45,
    height: 55,
    fontSize: 24,
    fontWeight: 'bold',
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
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
  verifyButton: {
    backgroundColor: Colors.light.success,
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.light.accent,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resendButtonText: {
    color: Colors.light.accent,
  },
  backButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    opacity: 0.7,
  },
});
