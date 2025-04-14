import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, ImageBackground, StatusBar, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase, checkSupabasePermissions } from '@/lib/supabase';
import { getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { checkTableStructure, getAllDataFromTable, testSaveProcess, checkTablePermissions } from '@/lib/debug';
import DateTimePicker from '@react-native-community/datetimepicker';

// Definieren der Schritte im Onboarding-Prozess
type Step = {
  id: string;
  title: string;
  subtitle: string;
};

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Willkommen!',
    subtitle: 'Lass uns dein Profil einrichten'
  },
  {
    id: 'name',
    title: 'Wie heißt du?',
    subtitle: 'Gib deinen Vor- und Nachnamen ein'
  },
  {
    id: 'due_date',
    title: 'Wann ist der Geburtstermin?',
    subtitle: 'Wähle den errechneten Geburtstermin aus'
  },
  {
    id: 'baby_born',
    title: 'Ist dein Baby bereits geboren?',
    subtitle: 'Wähle aus, ob dein Baby bereits auf der Welt ist'
  },
  {
    id: 'baby_name',
    title: 'Wie soll dein Baby heißen? (Optional)',
    subtitle: 'Gib den Namen deines Babys ein, falls du schon einen hast'
  },
  {
    id: 'baby_gender',
    title: 'Welches Geschlecht hat dein Baby?',
    subtitle: 'Wähle das Geschlecht deines Babys aus'
  },
  {
    id: 'baby_birth_details',
    title: 'Geburtsdaten',
    subtitle: 'Wann wurde dein Baby geboren? (Optional: Gewicht und Größe)'
  },
  {
    id: 'complete',
    title: 'Geschafft!',
    subtitle: 'Dein Profil ist jetzt eingerichtet'
  }
];

export default function OnboardingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();

  // Zustand für den aktuellen Schritt
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = STEPS[currentStepIndex];

  // Benutzerdaten
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [babyName, setBabyName] = useState('');
  const [babyGender, setBabyGender] = useState<'male' | 'female' | ''>('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [babyWeight, setBabyWeight] = useState('');
  const [babyHeight, setBabyHeight] = useState('');

  // UI-Status
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  // Formatieren eines Datums für die Anzeige
  const formatDate = (date: Date | null) => {
    if (!date) return 'Nicht festgelegt';
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Handler für Änderungen am Geburtstermin
  const handleDueDateChange = (event: any, selectedDate?: Date) => {
    setShowDueDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  // Handler für Änderungen am Geburtsdatum
  const handleBirthDateChange = (event: any, selectedDate?: Date) => {
    setShowBirthDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  // Zum nächsten Schritt gehen
  const goToNextStep = () => {
    // Validierung für den aktuellen Schritt
    if (currentStep.id === 'name' && (!firstName || !lastName)) {
      Alert.alert('Hinweis', 'Bitte gib deinen Vor- und Nachnamen ein.');
      return;
    }

    if (currentStep.id === 'due_date' && !dueDate) {
      Alert.alert('Hinweis', 'Bitte wähle einen Geburtstermin aus.');
      return;
    }

    // Baby-Name ist optional
    // Keine Validierung für den Baby-Namen, da nicht alle Eltern bereits einen Namen haben

    if (currentStep.id === 'baby_gender' && !babyGender) {
      Alert.alert('Hinweis', 'Bitte wähle das Geschlecht deines Babys aus.');
      return;
    }

    if (currentStep.id === 'baby_birth_details' && isBabyBorn && !birthDate) {
      Alert.alert('Hinweis', 'Bitte gib das Geburtsdatum deines Babys ein.');
      return;
    }

    // Wenn wir beim letzten Schritt sind, speichern wir die Daten
    if (currentStepIndex === STEPS.length - 2) {
      saveUserData();
      return;
    }

    // Zum nächsten Schritt gehen
    setCurrentStepIndex(prevIndex => {
      // Wenn das Baby nicht geboren ist, überspringen wir den Schritt mit den Geburtsdaten
      if (prevIndex === 5 && !isBabyBorn) {
        return prevIndex + 2;
      }
      return prevIndex + 1;
    });
  };

  // Zum vorherigen Schritt gehen
  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prevIndex => {
        // Wenn das Baby nicht geboren ist, überspringen wir den Schritt mit den Geburtsdaten
        if (prevIndex === 7 && !isBabyBorn) {
          return prevIndex - 2;
        }
        return prevIndex - 1;
      });
    }
  };

  // Speichern der Benutzerdaten
  const saveUserData = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deine Daten zu speichern.');
        return;
      }

      setIsSaving(true);

      console.log('Starting to save user data with values:', {
        firstName,
        lastName,
        dueDate: dueDate ? dueDate.toISOString() : null,
        isBabyBorn,
        babyName,
        babyGender,
        birthDate: birthDate ? birthDate.toISOString() : null,
        babyWeight,
        babyHeight
      });

      // Speichern der Profildaten (Vorname, Nachname)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error saving profile data:', profileError);
        throw new Error('Profildaten konnten nicht gespeichert werden.');
      }

      // Speichern der Benutzereinstellungen (Geburtstermin, Baby geboren)
      // Zuerst prüfen, ob bereits ein Eintrag existiert
      const { data: existingSettings, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing settings:', fetchError);
        throw new Error('Benutzereinstellungen konnten nicht überprüft werden.');
      }

      let settingsResult;

      if (existingSettings && existingSettings.id) {
        // Wenn ein Eintrag existiert, aktualisieren wir diesen
        settingsResult = await supabase
          .from('user_settings')
          .update({
            due_date: dueDate ? dueDate.toISOString() : null,
            is_baby_born: isBabyBorn,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id);
      } else {
        // Wenn kein Eintrag existiert, erstellen wir einen neuen
        settingsResult = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            due_date: dueDate ? dueDate.toISOString() : null,
            is_baby_born: isBabyBorn,
            updated_at: new Date().toISOString()
          });
      }

      if (settingsResult.error) {
        console.error('Error saving user settings:', settingsResult.error);
        throw new Error('Benutzereinstellungen konnten nicht gespeichert werden.');
      }

      // Speichern der Baby-Informationen (Name, Geschlecht, Geburtsdatum, Gewicht, Größe)
      console.log('Saving baby info with values:', {
        babyName,
        babyGender,
        birthDate: birthDate ? birthDate.toISOString() : null,
        babyWeight,
        babyHeight,
        isBabyBorn
      });

      try {
        // Berechtigungen prüfen
        console.log('Checking Supabase permissions...');
        const permissionCheck = await checkSupabasePermissions();
        console.log('Permission check result:', permissionCheck);

        // Direkte Speicherung in Supabase ohne Umwege
        console.log('Checking if baby info entry exists...');
        const { data: existingBabyInfo, error: fetchError } = await supabase
          .from('baby_info')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('Existing baby info check result:', { existingBabyInfo, fetchError });

        // Daten vorbereiten
        const babyInfoData = {
          name: babyName || null,
          baby_gender: babyGender || null,
          birth_date: birthDate ? birthDate.toISOString() : null,
          weight: babyWeight || null,
          height: babyHeight || null,
          updated_at: new Date().toISOString()
        };

        console.log('Prepared baby info data:', babyInfoData);

        let saveResult;

        if (existingBabyInfo && existingBabyInfo.id) {
          // Update existing entry
          console.log('Updating existing baby info with ID:', existingBabyInfo.id);
          saveResult = await supabase
            .from('baby_info')
            .update(babyInfoData)
            .eq('id', existingBabyInfo.id)
            .select();
        } else {
          // Create new entry
          console.log('Creating new baby info entry for user:', user.id);
          saveResult = await supabase
            .from('baby_info')
            .insert({
              user_id: user.id,
              ...babyInfoData,
              created_at: new Date().toISOString()
            })
            .select();
        }

        console.log('Direct save result:', saveResult);

        if (saveResult.error) {
          throw new Error(`Fehler beim Speichern der Baby-Informationen: ${saveResult.error.message}`);
        }

        // Auch noch die ursprüngliche Methode versuchen
        const babyInfo = {
          name: babyName,
          baby_gender: babyGender,
          birth_date: birthDate ? birthDate.toISOString() : null,
          weight: babyWeight,
          height: babyHeight
        };

        const { data: babyData, error: babyError } = await saveBabyInfo(babyInfo);
        console.log('Original saveBabyInfo result:', { data: babyData, error: babyError });

        // Daten nach dem Speichern abrufen, um zu überprüfen, ob sie korrekt gespeichert wurden
        console.log('Fetching saved data to verify...');
        const { data: savedBabyInfo } = await supabase
          .from('baby_info')
          .select('*')
          .eq('user_id', user.id);

        console.log('Saved baby info:', savedBabyInfo);

        const { data: savedUserSettings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id);

        console.log('Saved user settings:', savedUserSettings);
      } catch (saveError) {
        console.error('Error in direct save process:', saveError);
        Alert.alert('Fehler', `Fehler beim Speichern: ${saveError.message}`);
        throw saveError;
      }

      // Fehlerbehandlung erfolgt bereits im try-catch-Block oben

      // Zum letzten Schritt gehen
      setCurrentStepIndex(STEPS.length - 1);
    } catch (err) {
      console.error('Failed to save user data:', err);
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Deine Daten konnten nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  // Onboarding abschließen und zur Hauptapp navigieren
  const completeOnboarding = async () => {
    try {
      // Setzen eines Flags in AsyncStorage, um anzuzeigen, dass die Daten neu geladen werden müssen
      console.log('Setting reload flag...');
      await AsyncStorage.setItem('reload_data_after_onboarding', 'true');

      // Kurze Verzögerung, um sicherzustellen, dass alle Daten gespeichert wurden
      setIsSaving(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsSaving(false);

      // Zur entsprechenden Seite navigieren
      if (isBabyBorn) {
        router.replace('/(tabs)/baby');
      } else {
        router.replace('/(tabs)/countdown');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Fehler', 'Es gab ein Problem beim Abschließen des Onboarding-Prozesses. Bitte versuche es erneut.');
    }
  };

  // Rendern des aktuellen Schritts
  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'welcome':
        return (
          <View style={styles.stepContent}>
            <IconSymbol name="person.crop.circle" size={80} color={theme.accent} style={styles.welcomeIcon} />
            <ThemedText style={styles.welcomeText}>
              Wir freuen uns, dass du da bist! Lass uns ein paar Informationen sammeln, damit wir deine App personalisieren können.
            </ThemedText>
          </View>
        );

      case 'name':
        return (
          <View style={styles.stepContent}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Vorname</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Dein Vorname"
                placeholderTextColor={theme.tabIconDefault}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Nachname</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Dein Nachname"
                placeholderTextColor={theme.tabIconDefault}
              />
            </View>
          </View>
        );

      case 'due_date':
        return (
          <View style={styles.stepContent}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Errechneter Geburtstermin</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDueDatePicker(true)}
              >
                <ThemedText style={styles.dateButtonText}>
                  {dueDate ? formatDate(dueDate) : 'Geburtstermin auswählen'}
                </ThemedText>
                <IconSymbol name="calendar" size={20} color={theme.tabIconDefault} />
              </TouchableOpacity>

              {showDueDatePicker && (
                <DateTimePicker
                  value={dueDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDueDateChange}
                />
              )}
            </View>
          </View>
        );

      case 'baby_born':
        return (
          <View style={styles.stepContent}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Ist dein Baby bereits geboren?</ThemedText>
              <View style={styles.switchContainer}>
                <ThemedText style={styles.switchLabel}>
                  {isBabyBorn ? 'Ja' : 'Nein'}
                </ThemedText>
                <Switch
                  value={isBabyBorn}
                  onValueChange={setIsBabyBorn}
                  trackColor={{ false: '#767577', true: '#E9C9B6' }}
                  thumbColor={isBabyBorn ? '#7D5A50' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>
        );

      case 'baby_name':
        return (
          <View style={styles.stepContent}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Name des Babys (Optional)</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={babyName}
                onChangeText={setBabyName}
                placeholder="Name deines Babys (optional)"
                placeholderTextColor={theme.tabIconDefault}
              />
              <ThemedText style={styles.helperText}>
                Du kannst dieses Feld auch leer lassen, wenn du noch keinen Namen hast.
              </ThemedText>
            </View>
          </View>
        );

      case 'baby_gender':
        return (
          <View style={styles.stepContent}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Geschlecht</ThemedText>
              <View style={styles.genderContainer}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    babyGender === 'male' && styles.genderButtonActive
                  ]}
                  onPress={() => setBabyGender('male')}
                >
                  <IconSymbol
                    name="person.fill"
                    size={24}
                    color={babyGender === 'male' ? '#FFFFFF' : theme.tabIconDefault}
                  />
                  <ThemedText
                    style={[
                      styles.genderButtonText,
                      babyGender === 'male' && styles.genderButtonTextActive
                    ]}
                  >
                    Junge
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    babyGender === 'female' && styles.genderButtonActive
                  ]}
                  onPress={() => setBabyGender('female')}
                >
                  <IconSymbol
                    name="person.fill"
                    size={24}
                    color={babyGender === 'female' ? '#FFFFFF' : theme.tabIconDefault}
                  />
                  <ThemedText
                    style={[
                      styles.genderButtonText,
                      babyGender === 'female' && styles.genderButtonTextActive
                    ]}
                  >
                    Mädchen
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.unknownGenderButton,
                  babyGender === 'unknown' && styles.genderButtonActive
                ]}
                onPress={() => setBabyGender('unknown')}
              >
                <IconSymbol
                  name="questionmark.circle"
                  size={24}
                  color={babyGender === 'unknown' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText
                  style={[
                    styles.genderButtonText,
                    babyGender === 'unknown' && styles.genderButtonTextActive
                  ]}
                >
                  Weiß ich noch nicht
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'baby_birth_details':
        return (
          <View style={styles.stepContent}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Geburtsdatum</ThemedText>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowBirthDatePicker(true)}
              >
                <ThemedText style={styles.dateButtonText}>
                  {birthDate ? formatDate(birthDate) : 'Geburtsdatum auswählen'}
                </ThemedText>
                <IconSymbol name="calendar" size={20} color={theme.tabIconDefault} />
              </TouchableOpacity>

              {showBirthDatePicker && (
                <DateTimePicker
                  value={birthDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleBirthDateChange}
                  maximumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Geburtsgewicht (g)</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={babyWeight}
                onChangeText={setBabyWeight}
                placeholder="z.B. 3500"
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Größe bei Geburt (cm)</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={babyHeight}
                onChangeText={setBabyHeight}
                placeholder="z.B. 52"
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="numeric"
              />
            </View>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.stepContent}>
            <IconSymbol name="checkmark.circle.fill" size={80} color={theme.accent} style={styles.welcomeIcon} />
            <ThemedText style={styles.welcomeText}>
              Super! Dein Profil ist jetzt eingerichtet. Du kannst jetzt die App nutzen und alle Funktionen entdecken.
            </ThemedText>

            {/* Debug-Button zum Testen der Speicherung */}
            <TouchableOpacity
              style={[styles.button, { marginTop: 20, backgroundColor: '#FF5722' }]}
              onPress={async () => {
                if (!user) return;

                try {
                  // Tabellenüberprüfung
                  Alert.alert('Debug', 'Prüfe Tabellen...');

                  // Struktur der Tabellen prüfen
                  const babyInfoStructure = await checkTableStructure('baby_info');
                  console.log('Baby Info Structure:', babyInfoStructure);

                  const userSettingsStructure = await checkTableStructure('user_settings');
                  console.log('User Settings Structure:', userSettingsStructure);

                  // Berechtigungen prüfen
                  const babyInfoPermissions = await checkTablePermissions('baby_info', user.id);
                  console.log('Baby Info Permissions:', babyInfoPermissions);

                  const userSettingsPermissions = await checkTablePermissions('user_settings', user.id);
                  console.log('User Settings Permissions:', userSettingsPermissions);

                  // Direkter Speichertest
                  const saveTestResult = await testSaveProcess(user.id);
                  console.log('Save Test Result:', saveTestResult);

                  // Daten abrufen
                  const babyInfoData = await getAllDataFromTable('baby_info', user.id);
                  console.log('Baby Info Data:', babyInfoData);

                  const userSettingsData = await getAllDataFromTable('user_settings', user.id);
                  console.log('User Settings Data:', userSettingsData);

                  Alert.alert('Debug', 'Prüfung abgeschlossen. Siehe Konsole für Details.');
                } catch (error) {
                  console.error('Debug error:', error);
                  Alert.alert('Debug Error', error instanceof Error ? error.message : 'Unbekannter Fehler');
                }
              }}
            >
              <ThemedText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                DEBUG: Speicherung testen
              </ThemedText>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade Daten...</ThemedText>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
              <ThemedText style={styles.title}>{currentStep.title}</ThemedText>
              <ThemedText style={styles.subtitle}>{currentStep.subtitle}</ThemedText>
            </View>

            <ThemedView style={styles.card} lightColor={theme.cardLight} darkColor={theme.cardDark}>
              {renderStepContent()}
            </ThemedView>

            <View style={styles.buttonContainer}>
              {currentStepIndex > 0 && currentStep.id !== 'complete' && (
                <TouchableOpacity
                  style={[styles.button, styles.backButton]}
                  onPress={goToPreviousStep}
                >
                  <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
                </TouchableOpacity>
              )}

              {currentStep.id !== 'complete' ? (
                <TouchableOpacity
                  style={[styles.button, styles.nextButton, isSaving && styles.buttonDisabled]}
                  onPress={goToNextStep}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.nextButtonText}>
                      {currentStepIndex === STEPS.length - 2 ? 'Speichern' : 'Weiter'}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.nextButton]}
                  onPress={completeOnboarding}
                >
                  <ThemedText style={styles.nextButtonText}>Los geht's</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.progressContainer}>
              {STEPS.map((step, index) => (
                <View
                  key={step.id}
                  style={[
                    styles.progressDot,
                    index === currentStepIndex && styles.progressDotActive
                  ]}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    opacity: 0.8,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stepContent: {
    minHeight: 150,
  },
  welcomeIcon: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  dateButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  dateButtonText: {
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  unknownGenderButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  genderButtonActive: {
    backgroundColor: '#7D5A50',
    borderColor: '#7D5A50',
  },
  genderButtonText: {
    fontSize: 16,
    marginLeft: 8,
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    flex: 1,
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#7D5A50',
    flex: 2,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#A89992',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#7D5A50',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
