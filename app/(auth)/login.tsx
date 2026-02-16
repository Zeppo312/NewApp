import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [showInvitationField, setShowInvitationField] = useState(false);
  const accentColor = Colors.light.accent;
  const primaryTextColor = Colors.light.textPrimary;
  const secondaryTextColor = Colors.light.textSecondary;
  const { signInWithEmail, signUpWithEmail, signInWithApple } = useAuth();

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(
        'E-Mail erforderlich',
        'Bitte gib deine E-Mail-Adresse ein, um dein Passwort zurückzusetzen.',
        [{ text: 'OK' }]
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
        'E-Mail gesendet',
        'Wir haben dir eine E-Mail mit einem Link zum Zurücksetzen deines Passworts gesendet. Bitte überprüfe dein Postfach.',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Passwort zurücksetzen fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  // Funktion zum Abrufen des is_baby_born-Flags
  const checkIsBabyBorn = async (userId: string) => {
    try {
      console.log('Checking is_baby_born flag for user:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('is_baby_born')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching is_baby_born flag:', error);
        return false; // Standardmäßig auf false setzen, wenn ein Fehler auftritt
      }

      console.log('is_baby_born flag data:', data);
      return data?.is_baby_born || false;
    } catch (err) {
      console.error('Exception when checking is_baby_born flag:', err);
      return false;
    }
  };

  // Funktion zur Navigation basierend auf dem is_baby_born-Flag
  const navigateBasedOnBabyBornFlag = async (userId: string) => {
    try {
      const isBabyBorn = await checkIsBabyBorn(userId);
      console.log('Navigation based on is_baby_born flag:', isBabyBorn);

      if (isBabyBorn) {
        // Wenn das Baby geboren ist, zur Home-Seite navigieren
        router.replace('/(tabs)/home');
      } else {
        // Wenn das Baby noch nicht geboren ist, zur Countdown-Seite navigieren
        router.replace('/(tabs)/countdown');
      }
    } catch (navError) {
      console.error('Navigation error:', navError);
      // Fallback-Navigation zur Countdown-Seite
      router.navigate('/(tabs)/countdown');
    }
  };

  const handleAuth = async () => {
    // Reset error state
    setError('');

    // Basic validation
    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Starting authentication process...');

      if (isRegistering) {
        console.log('Registering with email:', email);
        // Registrierung mit Supabase
        const { data, error: signUpError } = await signUpWithEmail(email, password);

        if (signUpError) {
          console.error('Sign up error:', signUpError);
          throw signUpError;
        }

        console.log('Registration successful:', data);

        // Wenn die Registrierung erfolgreich war
        if (data && data.user) {
          // Bei Supabase wird nach der Registrierung automatisch ein OTP gesendet
          console.log('Registration successful, redirecting to OTP verification...');
          router.replace({
            pathname: './verify-otp',
            params: {
              email: email,
              invitationCode: showInvitationField && invitationCode ? invitationCode.trim() : undefined
            }
          });
          return;
        } else if (data && !data.user) {
          // Registrierung erfolgreich, aber User muss OTP bestätigen
          console.log('Registration pending OTP verification...');
          router.replace({
            pathname: './verify-otp', 
            params: {
              email: email,
              invitationCode: showInvitationField && invitationCode ? invitationCode.trim() : undefined
            }
          });
          return;
        }
      } else {
        console.log('Signing in with email:', email);
        // Anmeldung mit Supabase
        const { data, error: signInError } = await signInWithEmail(email, password);

        if (signInError) {
          console.error('Sign in error:', signInError);
          throw signInError;
        }

        console.log('Sign in successful:', data);

        // Bei erfolgreicher Anmeldung basierend auf is_baby_born-Flag navigieren
        if (data && data.user && data.user.id) {
          await navigateBasedOnBabyBornFlag(data.user.id);
        } else {
          // Fallback zur Countdown-Seite, wenn keine Benutzer-ID verfügbar ist
          try {
            router.replace('/(tabs)/countdown');
          } catch (navError) {
            console.error('Navigation error:', navError);
            router.navigate('/(tabs)/countdown');
          }
        }
      }
    } catch (err: any) {
      // Benutzerfreundliche Fehlermeldungen
      console.error('Authentication error:', err);

      if (err.message?.toLowerCase().includes('rate limit')) {
        setError('Zu viele Versuche. Bitte warte kurz, bevor du es erneut probierst.');
      } else if (err.message?.includes('Invalid login')) {
        setError('Ungültige E-Mail oder Passwort');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Bitte bestätige deine E-Mail-Adresse');
        Alert.alert(
          'E-Mail nicht bestätigt',
          'Bitte öffne den Bestätigungslink in der E-Mail, die wir dir gesendet haben.',
          [{ text: 'OK' }]
        );
      } else {
        const friendlyFallback = isRegistering
          ? 'Registrierung fehlgeschlagen. Bitte versuche es erneut.'
          : 'Login fehlgeschlagen. Bitte versuche es erneut.';
        // Zeige den Supabase-Fehlertext mit Fallback, damit wir den echten Grund sehen
        setError(err?.message ? `${friendlyFallback} (${err.message})` : friendlyFallback);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      console.log('Starting Apple Sign-In...');
      const { data, error: appleError } = await signInWithApple();
      
      if (appleError) {
        console.error('Apple Sign-In error:', appleError);
        throw appleError;
      }
      
      console.log('Apple Sign-In successful:', data);
      
      // Check if this is a new user or existing user
      if (data && data.user) {
        // Check if user profile exists and is complete
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, is_baby_born')
          .eq('id', data.user.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error checking profile:', profileError);
        }
        
        // If profile is incomplete or doesn't exist, go to onboarding
        if (!profileData || !profileData.first_name) {
          console.log('New Apple user, redirecting to onboarding');
          router.replace('../getUserInfo');
        } else {
          // Existing user, navigate based on baby status
          await navigateBasedOnBabyBornFlag(data.user.id);
        }
      }
    } catch (err: any) {
      console.error('Apple Sign-In error:', err);
      if (err.message?.includes('abgebrochen')) {
        // User cancelled, don't show error
        return;
      }
      setError(err.message || 'Apple Sign-In fehlgeschlagen');
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
                  Für Eltern und alle, die es bald werden
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
                    {isRegistering ? 'Registrieren' : 'Anmelden'}
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
                    E-Mail
                  </ThemedText>
                  <View style={styles.inputWrapper}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
                    <TextInput
                      style={styles.input}
                      placeholder="deine@email.de"
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
                    Passwort
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
                      Passwort vergessen?
                    </ThemedText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.button, styles.loginButton, isLoading && styles.buttonDisabled]}
                  onPress={handleAuth}
                  disabled={isLoading}
                  activeOpacity={0.9}
                >
                  <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={['#9DBEBB', 'rgba(157, 190, 187, 0.9)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? (isRegistering ? 'Registrieren...' : 'Anmelden...') : (isRegistering ? 'Registrieren' : 'Anmelden')}
                  </ThemedText>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.button, styles.appleButton]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
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
                        Mit Apple anmelden
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
                        {showInvitationField ? 'Ohne Einladungscode fortfahren' : 'Ich habe einen Einladungscode'}
                      </ThemedText>
                    </TouchableOpacity>

                    {showInvitationField && (
                      <>
                        <ThemedText style={styles.inputLabel} lightColor={secondaryTextColor} darkColor={secondaryTextColor}>
                          Einladungscode (optional)
                        </ThemedText>
                        <View style={styles.inputWrapper}>
                          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
                          <TextInput
                            style={styles.input}
                            placeholder="Einladungscode eingeben"
                            placeholderTextColor="#9D9D9D"
                            value={invitationCode}
                            onChangeText={setInvitationCode}
                            autoCapitalize="characters"
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
                    setShowInvitationField(false);
                    setInvitationCode('');
                  }}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.switchModeText} lightColor={accentColor} darkColor={accentColor}>
                    {isRegistering ? 'Bereits ein Konto? Anmelden' : 'Noch kein Konto? Registrieren'}
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
