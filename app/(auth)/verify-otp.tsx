/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
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
import { invalidateAllCaches } from '@/lib/appCache';
import { supabase, verifyOTPToken, resendOTPToken } from '@/lib/supabase';
import { acceptTerms } from '@/lib/termsConsent';
import {
  AuthTranslationKey,
  DEFAULT_AUTH_LOCALE,
  translateAuthText,
} from '@/lib/authTranslations';

const OTP_LENGTH = 6;
let ACTIVE_AUTH_LOCALE = DEFAULT_AUTH_LOCALE;
const t = (key: AuthTranslationKey, params?: Record<string, string | number>) =>
  translateAuthText(ACTIVE_AUTH_LOCALE, key, params);

export default function VerifyOTPScreen() {
  ACTIVE_AUTH_LOCALE = useLocale().locale;
  const { email, invitationCode } = useLocalSearchParams<{ email: string, invitationCode?: string }>();
  const [otp, setOTP] = useState(Array.from({ length: OTP_LENGTH }, () => ''));
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  // Refs für die Input-Felder
  const inputRefs = useRef<TextInput[]>([]);

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

  const applyOTPDigits = (input: string, startIndex = 0) => {
    const digits = input.replace(/\D/g, '');
    if (!digits) return;

    const nextOTP = [...otp];
    let targetIndex = startIndex;

    for (const digit of digits) {
      if (targetIndex >= OTP_LENGTH) break;
      nextOTP[targetIndex] = digit;
      targetIndex += 1;
    }

    setOTP(nextOTP);

    if (nextOTP.every((digit) => digit !== '') && !isLoading) {
      Keyboard.dismiss();
      handleVerifyOTP(nextOTP.join(''));
      return;
    }

    if (targetIndex < OTP_LENGTH) {
      inputRefs.current[targetIndex]?.focus();
    } else {
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleOTPChange = (value: string, index: number) => {
    const digitsOnly = value.replace(/\D/g, '');

    // Mehrstellige Eingabe (Paste/AutoFill) auf alle Felder verteilen
    if (digitsOnly.length > 1) {
      applyOTPDigits(digitsOnly, index);
      return;
    }

    // Nur Zahlen erlauben
    if (!/^\d*$/.test(digitsOnly)) return;

    const newOTP = [...otp];
    newOTP[index] = digitsOnly;
    setOTP(newOTP);

    // Automatisch zum nächsten Feld springen
    if (digitsOnly && index < OTP_LENGTH - 1) {
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
    
    if (code.length !== OTP_LENGTH) {
      Alert.alert(t('otp.invalidTitle'), t('otp.enterCompleteCode', { length: OTP_LENGTH }));
      return;
    }

    if (!email) {
      Alert.alert(t('common.error'), t('otp.emailMissing'));
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await verifyOTPToken(email, code);
      
      if (error) {
        console.error('OTP verification error:', error);

        // Spezifische Fehlermeldungen
        if (error.message?.includes('invalid') || error.message?.includes('expired')) {
          Alert.alert(t('otp.invalidTitle'), t('otp.invalidOrExpired'));
          setOTP(Array.from({ length: OTP_LENGTH }, () => ''));
          inputRefs.current[0]?.focus();
        } else if (error.message?.toLowerCase().includes('rate limit')) {
          Alert.alert(t('otp.tooManyAttemptsTitle'), t('otp.tooManyAttemptsMessage'));
        } else {
          Alert.alert(t('otp.verificationFailedTitle'), t('otp.tryAgain'));
        }
        return;
      }

      if (data.user) {
        const consentResult = await acceptTerms('otp', data.user.id);
        if (!consentResult.success) {
          await supabase.auth.signOut();
          Alert.alert(t('common.error'), t('otp.termsSaveFailed'));
          return;
        }

        Alert.alert(
          t('otp.confirmedTitle'),
          t('otp.confirmedMessage'),
          [
            {
              text: t('common.continue'),
              onPress: () => {
                void (async () => {
                  try {
                    await invalidateAllCaches();
                  } catch (cacheError) {
                    console.error('Failed to invalidate caches after OTP verification:', cacheError);
                  }

                  const nextParams = invitationCode ? { invitationCode: String(invitationCode) } : {};
                  router.replace({
                    pathname: '/(auth)/getUserInfo',
                    params: nextParams
                  });
                })();
              }
            }
          ]
        );
      }
    } catch (err) {
      console.error('OTP verification exception:', err);
      Alert.alert(t('common.error'), t('otp.verificationFailedTitle'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('otp.emailMissing'));
      return;
    }

    setIsLoading(true);
    setCanResend(false);

    try {
      const { error } = await resendOTPToken(email);
      
      if (error) {
        console.error('Resend OTP error:', error);
        if (error.message?.toLowerCase().includes('rate limit')) {
          Alert.alert(t('otp.tooManyRequestsTitle'), t('otp.tooManyRequestsMessage'));
        } else {
          Alert.alert(t('common.error'), t('otp.resendFailed'));
        }
        setCanResend(true);
      } else {
        Alert.alert(
          t('otp.sentTitle'),
          t('otp.sentMessage', { length: OTP_LENGTH })
        );
        setCountdown(60); // 60 Sekunden warten
        setOTP(Array.from({ length: OTP_LENGTH }, () => ''));
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('Resend OTP exception:', err);
      Alert.alert(t('common.error'), t('otp.resendFailed'));
      setCanResend(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    Alert.alert(
      t('otp.backTitle'),
      t('otp.backMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.back'),
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
                  {t('otp.title')}
                </ThemedText>
                <ThemedText style={styles.description}>
                  {t('otp.descriptionBeforeEmail', { length: OTP_LENGTH })}{'\n'}
                  <ThemedText style={styles.emailText}>{email}</ThemedText>{'\n'}
                  {t('otp.descriptionAfterEmail')}
                </ThemedText>
              </View>

              {/* OTP Input */}
              <ThemedView style={styles.otpContainer} lightColor={theme.card} darkColor={theme.card}>
                <View style={styles.otpInputContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={ref => { inputRefs.current[index] = ref!; }}
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
                      maxLength={OTP_LENGTH}
                      textAlign="center"
                      autoFocus={index === 0}
                      selectTextOnFocus
                      editable={!isLoading}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.verifyButton,
                    (isLoading || otp.join('').length !== OTP_LENGTH) && styles.buttonDisabled
                  ]}
                  onPress={() => handleVerifyOTP()}
                  disabled={isLoading || otp.join('').length !== OTP_LENGTH}
                >
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? t('otp.verifying') : t('otp.confirm')}
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
                      ? t('otp.resendCountdown', { seconds: countdown })
                      : t('otp.resend')
                    }
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleGoBack}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.backButtonText} lightColor={theme.text} darkColor={theme.text}>
                    ← {t('common.backToLogin')}
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
