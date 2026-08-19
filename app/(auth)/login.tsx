/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { acceptTerms, TERMS_VERSION } from '@/lib/termsConsent';
import {
  AuthTranslationKey,
  DEFAULT_AUTH_LOCALE,
  translateAuthText,
} from '@/lib/authTranslations';

let ACTIVE_AUTH_LOCALE = DEFAULT_AUTH_LOCALE;
const t = (key: AuthTranslationKey, params?: Record<string, string | number>) =>
  translateAuthText(ACTIVE_AUTH_LOCALE, key, params);

export default function LoginScreen() {
  ACTIVE_AUTH_LOCALE = useLocale().locale;
  const params = useLocalSearchParams<{ invitationCode?: string }>();
  const prefilledInvitationCode = typeof params.invitationCode === 'string'
    ? params.invitationCode.replace(/\s+/g, '').toUpperCase()
    : '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [invitationCode, setInvitationCode] = useState(prefilledInvitationCode);
  const [showInvitationField, setShowInvitationField] = useState(prefilledInvitationCode.length > 0);
  // EULA-Gate: ohne Zustimmung ist keine Anmeldung und keine Registrierung möglich
  // (App Store Guideline 1.2).
  const [termsAccepted, setTermsAccepted] = useState(false);
  const accentColor = Colors.light.accent;
  const primaryTextColor = Colors.light.textPrimary;
  const secondaryTextColor = Colors.light.textSecondary;
  const { signInWithEmail, signUpWithEmail, signInWithApple, signOut } = useAuth();
  const normalizedInvitationCode = showInvitationField && invitationCode
    ? invitationCode.trim().replace(/\s+/g, '').toUpperCase()
    : undefined;

  // Nach Auth immer über Root-Router gehen, damit ein zentraler Guard
  // den passenden Startscreen anhand des aktuellen Baby-Status auswählt.
  const navigateAfterAuth = async () => {
    try {
      if (normalizedInvitationCode) {
        router.replace({
          pathname: '/account-linking',
          params: {
            invitationCode: normalizedInvitationCode,
          },
        });
        return;
      }

      router.replace('/');
    } catch (navError) {
      console.error('Navigation error:', navError);
      if (normalizedInvitationCode) {
        router.navigate({
          pathname: '/account-linking',
          params: {
            invitationCode: normalizedInvitationCode,
          },
        });
        return;
      }

      router.navigate('/');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(
        t('login.emailRequiredTitle'),
        t('login.emailRequiredMessage'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const redirectTo = Linking.createURL('auth/reset-password');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        throw resetError;
      }

      Alert.alert(
        t('login.resetEmailSentTitle'),
        t('login.resetEmailSentMessage'),
        [{ text: t('common.ok') }]
      );
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(t('login.resetFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const waitForAuthenticatedSession = async (timeoutMs = 2000) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session check error after login:', sessionError);
        return null;
      }

      if (data.session?.user) {
        return data.session;
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return null;
  };

  const ensureTermsAccepted = () => {
    if (termsAccepted) return true;
    Alert.alert(t('login.termsRequiredTitle'), t('login.termsRequiredMessage'), [
      { text: t('common.ok') },
    ]);
    return false;
  };

  const handleAuth = async () => {
    // Reset error state
    setError('');

    if (!ensureTermsAccepted()) return;

    // Basic validation
    if (!email || !password) {
      setError(t('login.credentialsRequired'));
      return;
    }

    try {
      setIsLoading(true);

      if (isRegistering) {
        // Registrierung mit Supabase
        const { data, error: signUpError } = await signUpWithEmail(email, password, {
          version: TERMS_VERSION,
          acceptedAt: new Date().toISOString(),
        });

        if (signUpError) {
          console.error('Sign up error:', signUpError);
          throw signUpError;
        }

        if (data?.session?.user) {
          const consentResult = await acceptTerms('signup', data.session.user.id);
          if (!consentResult.success) {
            await signOut();
            setError(t('login.termsSaveFailed'));
            return;
          }
        }

        // Wenn die Registrierung erfolgreich war
        if (data && data.user) {
          // Bei Supabase wird nach der Registrierung automatisch ein OTP gesendet
          router.replace({
            pathname: './verify-otp',
            params: {
              email: email,
              invitationCode: normalizedInvitationCode
            }
          });
          return;
        } else if (data && !data.user) {
          // Registrierung erfolgreich, aber User muss OTP bestätigen
          router.replace({
            pathname: './verify-otp', 
            params: {
              email: email,
              invitationCode: normalizedInvitationCode
            }
          });
          return;
        }
      } else {
        // Anmeldung mit Supabase
        const { data, error: signInError } = await signInWithEmail(email, password);

        if (signInError) {
          console.error('Sign in error:', signInError);
          throw signInError;
        }

        // Session explizit bestätigen, damit der Root-Guard nicht in einen Login-Redirect fällt
        const session = data?.session ?? await waitForAuthenticatedSession();
        if (!session?.user) {
          setError(t('login.sessionUnavailable'));
          return;
        }

        const consentResult = await acceptTerms('login', session.user.id);
        if (!consentResult.success) {
          await signOut();
          setError(t('login.termsSaveFailed'));
          return;
        }

        await navigateAfterAuth();
      }
    } catch (err: any) {
      // Benutzerfreundliche Fehlermeldungen
      console.error('Authentication error:', err);

      if (err.message?.toLowerCase().includes('rate limit')) {
        setError(t('login.tooManyAttempts'));
      } else if (err.message?.includes('Invalid login')) {
        setError(t('login.invalidCredentials'));
      } else if (err.message?.includes('Email not confirmed')) {
        setError(t('login.emailNotConfirmed'));
        Alert.alert(
          t('login.emailNotConfirmedTitle'),
          t('login.emailNotConfirmedMessage'),
          [{ text: t('common.ok') }]
        );
      } else {
        const friendlyFallback = isRegistering
          ? t('login.registrationFailed')
          : t('login.signInFailed');
        setError(friendlyFallback);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    if (!ensureTermsAccepted()) return;
    setIsLoading(true);
    
    try {
      const { data, error: appleError } = await signInWithApple();
      
      if (appleError) {
        console.error('Apple Sign-In error:', appleError);
        throw appleError;
      }
      
      // Check if this is a new user or existing user
      if (data && data.user) {
        const consentResult = await acceptTerms(isRegistering ? 'signup' : 'login', data.user.id);
        if (!consentResult.success) {
          await signOut();
          setError(t('login.termsSaveFailed'));
          return;
        }

        // Check if user profile exists and is complete
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', data.user.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error checking profile:', profileError);
        }
        
        // If profile is incomplete or doesn't exist, go to onboarding
        if (!profileData || !profileData.first_name) {
          router.replace({
            pathname: '/(auth)/getUserInfo',
            params: normalizedInvitationCode ? { invitationCode: normalizedInvitationCode } : {},
          });
        } else {
          // Existing user -> zentraler Root-Guard entscheidet über Startscreen
          await navigateAfterAuth();
        }
      }
    } catch (err: any) {
      console.error('Apple Sign-In error:', err);
      if (err.message?.includes('abgebrochen')) {
        // User cancelled, don't show error
        return;
      }
      setError(t('login.appleFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage} resizeMode="repeat">
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <SafeAreaView style={styles.safeArea}>
            <StatusBar hidden={true} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.logoContainer}>
                <ThemedText type="title" style={styles.appTitle} lightColor={primaryTextColor} darkColor={primaryTextColor}>
                  Lotti Baby
                </ThemedText>
                <ThemedText style={styles.appSubtitle} lightColor={secondaryTextColor} darkColor={secondaryTextColor}>
                  {t('login.subtitle')}
                </ThemedText>
              </View>

              <View style={styles.formContainer}>
                <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.formContent}>
                  <ThemedText type="subtitle" style={styles.formTitle} lightColor={primaryTextColor} darkColor={primaryTextColor}>
                    {isRegistering ? t('login.register') : t('common.login')}
                  </ThemedText>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(244,67,54,0.15)' }]} />
                      <ThemedText style={styles.errorText} lightColor="#B71C1C" darkColor="#B71C1C">
                        {error}
                      </ThemedText>
                    </View>
                  ) : null}

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel} lightColor={secondaryTextColor} darkColor={secondaryTextColor}>
                    {t('login.email')}
                  </ThemedText>
                  <View style={styles.inputWrapper}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('login.emailPlaceholder')}
                      placeholderTextColor="#9D9D9D"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel} lightColor={secondaryTextColor} darkColor={secondaryTextColor}>
                    {t('login.password')}
                  </ThemedText>
                  <View style={styles.inputWrapper}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#9D9D9D"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>

                {!isRegistering && (
                  <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={handleForgotPassword}
                    disabled={isLoading}
                  >
                    <ThemedText style={styles.forgotPasswordText} lightColor={accentColor} darkColor={accentColor}>
                      {t('login.forgotPassword')}
                    </ThemedText>
                  </TouchableOpacity>
                )}

                <View style={styles.termsContainer}>
                    <TouchableOpacity
                      style={styles.termsCheckboxRow}
                      onPress={() => setTermsAccepted((current) => !current)}
                      disabled={isLoading}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: termsAccepted }}
                      activeOpacity={0.8}
                    >
                      <IconSymbol
                        name={termsAccepted ? 'checkmark.circle.fill' : 'circle'}
                        size={24}
                        color={termsAccepted ? accentColor : secondaryTextColor}
                      />
                      <View style={styles.termsTextWrap}>
                        <ThemedText
                          style={styles.termsText}
                          lightColor={primaryTextColor}
                          darkColor={primaryTextColor}
                        >
                          {t('login.termsIntro')}{' '}
                          <ThemedText
                            style={styles.termsLink}
                            lightColor={accentColor}
                            darkColor={accentColor}
                            onPress={() => router.push('/nutzungsbedingungen')}
                          >
                            {t('login.termsLink')}
                          </ThemedText>{' '}
                          {t('login.termsAnd')}{' '}
                          <ThemedText
                            style={styles.termsLink}
                            lightColor={accentColor}
                            darkColor={accentColor}
                            onPress={() => router.push('/datenschutz')}
                          >
                            {t('login.privacyLink')}
                          </ThemedText>
                          .
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                    <ThemedText
                      style={styles.termsHint}
                      lightColor={secondaryTextColor}
                      darkColor={secondaryTextColor}
                    >
                      {t('login.termsRulesHint')}
                    </ThemedText>
                  </View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.loginButton,
                    (isLoading || !termsAccepted) && styles.buttonDisabled,
                  ]}
                  onPress={handleAuth}
                  disabled={isLoading || !termsAccepted}
                  activeOpacity={0.9}
                >
                  <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={['#9DBEBB', 'rgba(157, 190, 187, 0.9)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <ThemedText style={styles.buttonText}>
                    {isLoading
                      ? (isRegistering ? t('login.registering') : t('login.signingIn'))
                      : (isRegistering ? t('login.register') : t('common.login'))}
                  </ThemedText>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.appleButton,
                      (isLoading || !termsAccepted) && styles.buttonDisabled,
                    ]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading || !termsAccepted}
                    activeOpacity={0.9}
                  >
                    <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={['#000000', '#000000E6']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.buttonContent}>
                      <ThemedText style={styles.appleIcon}></ThemedText>
                      <ThemedText style={styles.buttonText}>
                        {t('login.apple')}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                )}

                {isRegistering && (
                  <View style={styles.inputContainer}>
                    <TouchableOpacity
                      style={styles.invitationToggle}
                      onPress={() => setShowInvitationField(!showInvitationField)}
                      disabled={isLoading}
                    >
                      <ThemedText style={styles.invitationToggleText} lightColor={accentColor} darkColor={accentColor}>
                        {showInvitationField ? t('login.withoutInvitation') : t('login.hasInvitation')}
                      </ThemedText>
                    </TouchableOpacity>

                    {showInvitationField && (
                      <>
                        <ThemedText style={styles.inputLabel} lightColor={secondaryTextColor} darkColor={secondaryTextColor}>
                          {t('login.invitationOptional')}
                        </ThemedText>
                        <View style={styles.inputWrapper}>
                          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
                          <TextInput
                            style={styles.input}
                            placeholder={t('login.invitationPlaceholder')}
                            placeholderTextColor="#9D9D9D"
                            value={invitationCode}
                            onChangeText={(value) => setInvitationCode(value.replace(/\s+/g, '').toUpperCase())}
                            autoCapitalize="characters"
                            autoCorrect={false}
                          />
                        </View>
                      </>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => {
                    setIsRegistering(!isRegistering);
                    setTermsAccepted(false);
                    setShowInvitationField(false);
                    setInvitationCode('');
                  }}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.switchModeText} lightColor={accentColor} darkColor={accentColor}>
                    {isRegistering ? t('login.hasAccount') : t('login.noAccount')}
                  </ThemedText>
                </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 36,
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appSubtitle: {
    fontSize: 18,
    opacity: 0.8,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formContainer: {
    padding: 0,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  formContent: {
    padding: 24,
    position: 'relative',
    zIndex: 1,
  },
  formTitle: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.3)',
    position: 'relative',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputWrapper: {
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  input: {
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#7D5A50',
    fontWeight: '500',
    position: 'relative',
    zIndex: 1,
  },
  button: {
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  loginButton: {
    marginTop: 24,
  },
  appleButton: {
    marginTop: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  },
  appleIcon: {
    fontSize: 18,
    marginRight: 8,
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    position: 'relative',
    zIndex: 1,
  },
  switchModeButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  invitationToggle: {
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  invitationToggleText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  termsContainer: {
    marginTop: 20,
  },
  termsCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  termsTextWrap: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  termsLink: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  termsHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  termsPassive: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsPassiveLink: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
    padding: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
