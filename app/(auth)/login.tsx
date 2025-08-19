import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey, redeemInvitationCode } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [showInvitationField, setShowInvitationField] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { signInWithEmail, signUpWithEmail, signInWithApple } = useAuth();

  // Funktion zum Abrufen des is_baby_born-Flags
  const checkIsBabyBorn = async (userId: string) => {
    try {
      console.log('Checking is_baby_born flag for user:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_baby_born')
        .eq('user_id', userId)
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

      // HINWEIS: Für Testzwecke ohne Supabase-Verbindung
      // Wir simulieren eine erfolgreiche Anmeldung
      if (supabaseUrl.includes('example.supabase.co')) {
        console.log('Using demo mode because Supabase credentials are not set');
        // Simulierte Verzögerung
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Im Demo-Modus zur Countdown-Seite navigieren
        console.log('Demo mode: Navigating to countdown page');
        try {
          router.replace('/(tabs)/countdown');
        } catch (navError) {
          console.error('Navigation error:', navError);
          // Fallback-Navigation
          router.navigate('/(tabs)/countdown');
        }
        return;
      }

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
            params: { email: email }
          });
          return;
        } else if (data && !data.user) {
          // Registrierung erfolgreich, aber User muss OTP bestätigen
          console.log('Registration pending OTP verification...');
          router.replace({
            pathname: './verify-otp', 
            params: { email: email }
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

      if (err.message?.includes('Invalid login')) {
        setError('Ungültige E-Mail oder Passwort');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Bitte bestätige deine E-Mail-Adresse');
        Alert.alert(
          'E-Mail nicht bestätigt',
          'Bitte öffne den Bestätigungslink in der E-Mail, die wir dir gesendet haben.',
          [{ text: 'OK' }]
        );
      } else {
        setError(isRegistering
          ? 'Registrierung fehlgeschlagen. Bitte versuche es erneut.'
          : 'Login fehlgeschlagen. Bitte versuche es erneut.');
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

  const handleDemoLogin = async () => {
    try {
      setIsLoading(true);
      console.log('Starting demo login...');

      // HINWEIS: Für Testzwecke ohne Supabase-Verbindung
      // Wir simulieren eine erfolgreiche Anmeldung
      if (supabaseUrl.includes('example.supabase.co')) {
        console.log('Using demo mode because Supabase credentials are not set');
        // Simulierte Verzögerung
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Im Demo-Modus zur Countdown-Seite navigieren
        console.log('Demo login mode: Navigating to countdown page');
        try {
          router.replace('/(tabs)/countdown');
        } catch (navError) {
          console.error('Navigation error:', navError);
          // Fallback-Navigation
          router.navigate('/(tabs)/countdown');
        }
        return;
      }

      // Demo-Login mit einem Test-Konto
      const { data, error: authError } = await signInWithEmail('demo@example.com', 'password123');

      if (authError) {
        console.error('Demo login auth error:', authError);
        // Wenn das Demo-Konto nicht existiert, erstellen wir es
        if (authError.message?.includes('Invalid login')) {
          console.log('Demo account does not exist, creating it...');
          const { data: signUpData, error: signUpError } = await signUpWithEmail('demo@example.com', 'password123');

          if (signUpError) {
            console.error('Demo account creation error:', signUpError);
            throw signUpError;
          }

          console.log('Demo account created successfully:', signUpData);

          // Nach der Registrierung anmelden
          console.log('Signing in with demo account...');
          const { data: loginData, error: loginError } = await signInWithEmail('demo@example.com', 'password123');

          if (loginError) {
            console.error('Demo account login error after creation:', loginError);
            throw loginError;
          }

          console.log('Demo login successful after account creation:', loginData);
        } else {
          throw authError;
        }
      } else {
        console.log('Demo login successful:', data);
      }

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
    } catch (err) {
      setError('Demo-Login fehlgeschlagen. Bitte versuche es erneut.');
      console.error('Demo login error:', err);
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
                <ThemedText type="title" style={styles.appTitle}>
                  Lotti Baby
                </ThemedText>
                <ThemedText style={styles.appSubtitle}>
                  Für werdende Eltern
                </ThemedText>
              </View>

              <ThemedView style={styles.formContainer} lightColor={theme.card} darkColor={theme.card}>
                <ThemedText type="subtitle" style={styles.formTitle}>
                  Anmelden
                </ThemedText>

                {error ? (
                  <ThemedView style={styles.errorContainer} lightColor="#FFEBEE" darkColor="#3E2723">
                    <ThemedText style={styles.errorText} lightColor="#B71C1C" darkColor="#FFCDD2">
                      {error}
                    </ThemedText>
                  </ThemedView>
                ) : null}

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>
                    E-Mail
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#362E28' : '#FFFFFF',
                        color: colorScheme === 'dark' ? '#FFF8F0' : '#7D5A50',
                        borderColor: colorScheme === 'dark' ? '#7D6A5A' : '#EFE1CF'
                      }
                    ]}
                    placeholder="deine@email.de"
                    placeholderTextColor={colorScheme === 'dark' ? '#A68A7B' : '#C8B6A6'}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>
                    Passwort
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#362E28' : '#FFFFFF',
                        color: colorScheme === 'dark' ? '#FFF8F0' : '#7D5A50',
                        borderColor: colorScheme === 'dark' ? '#7D6A5A' : '#EFE1CF'
                      }
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={colorScheme === 'dark' ? '#A68A7B' : '#C8B6A6'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, styles.loginButton, isLoading && styles.buttonDisabled]}
                  onPress={handleAuth}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.buttonText}>
                    {isLoading ? (isRegistering ? 'Registrieren...' : 'Anmelden...') : (isRegistering ? 'Registrieren' : 'Anmelden')}
                  </ThemedText>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.button, styles.appleButton]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                  >
                    <View style={styles.buttonContent}>
                      <ThemedText style={styles.appleIcon}></ThemedText>
                      <ThemedText style={styles.buttonText}>
                        Mit Apple anmelden
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.button, styles.demoButton]}
                  onPress={handleDemoLogin}
                  disabled={isLoading}
                >
                  <ThemedText style={styles.buttonText}>
                    Demo-Modus
                  </ThemedText>
                </TouchableOpacity>

                {isRegistering && (
                  <View style={styles.inputContainer}>
                    <TouchableOpacity
                      style={styles.invitationToggle}
                      onPress={() => setShowInvitationField(!showInvitationField)}
                      disabled={isLoading}
                    >
                      <ThemedText style={styles.invitationToggleText} lightColor={theme.accent} darkColor={theme.accent}>
                        {showInvitationField ? 'Ohne Einladungscode fortfahren' : 'Ich habe einen Einladungscode'}
                      </ThemedText>
                    </TouchableOpacity>

                    {showInvitationField && (
                      <>
                        <ThemedText style={styles.inputLabel}>
                          Einladungscode (optional)
                        </ThemedText>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: colorScheme === 'dark' ? '#362E28' : '#FFFFFF',
                              color: colorScheme === 'dark' ? '#FFF8F0' : '#7D5A50',
                              borderColor: colorScheme === 'dark' ? '#7D6A5A' : '#EFE1CF'
                            }
                          ]}
                          placeholder="Einladungscode eingeben"
                          placeholderTextColor={colorScheme === 'dark' ? '#A68A7B' : '#C8B6A6'}
                          value={invitationCode}
                          onChangeText={setInvitationCode}
                          autoCapitalize="characters"
                        />
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
                  <ThemedText style={styles.switchModeText} lightColor={theme.accent} darkColor={theme.accent}>
                    {isRegistering ? 'Bereits ein Konto? Anmelden' : 'Noch kein Konto? Registrieren'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
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
    fontWeight: '600',
  },
  appSubtitle: {
    fontSize: 18,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  formContainer: {
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  formTitle: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 54,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButton: {
    backgroundColor: Colors.light.success,
    marginTop: 24,
  },
  appleButton: {
    backgroundColor: '#000000',
    marginTop: 16,
  },
  demoButton: {
    backgroundColor: Colors.light.accent,
    marginTop: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: 'bold',
    fontSize: 18,
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
});
