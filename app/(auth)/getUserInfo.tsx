import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/lib/supabase';
import { saveBabyInfo } from '@/lib/baby';
import { router, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function GetUserInfoScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();

  // Benutzerinformationen
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userRole, setUserRole] = useState<'mama' | 'papa' | ''>('');

  // Baby-Informationen
  const [babyName, setBabyName] = useState('');
  const [babyGender, setBabyGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isBabyBorn, setIsBabyBorn] = useState(false);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  // Gewicht und Größe werden in dieser Version nicht verwendet, aber für zukünftige Erweiterungen vorbereitet
  const [babyWeight] = useState('');
  const [babyHeight] = useState('');

  // UI-Status
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  // Schrittweise Abfrage
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 8; // Gesamtanzahl der Schritte

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
  const handleDueDateChange = (_: any, selectedDate?: Date) => {
    setShowDueDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  // Handler für Änderungen am Geburtsdatum
  const handleBirthDateChange = (_: any, selectedDate?: Date) => {
    setShowBirthDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  // Speichern der Benutzerdaten in verschiedenen Tabellen
  const saveUserData = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deine Daten zu speichern.');
        return;
      }

      setIsSaving(true);

      // Speichern der Profildaten (Vorname, Nachname, Rolle)
      const profileResult = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          user_role: userRole,
          updated_at: new Date().toISOString()
        });

      if (profileResult.error) {
        console.error('Error saving profile data:', profileResult.error);
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
            theme: 'light', // Standard-Theme
            notifications_enabled: true, // Benachrichtigungen standardmäßig aktiviert
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
            theme: 'light', // Standard-Theme
            notifications_enabled: true, // Benachrichtigungen standardmäßig aktiviert
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      if (settingsResult.error) {
        console.error('Error saving user settings:', settingsResult.error);
        throw new Error('Benutzereinstellungen konnten nicht gespeichert werden.');
      }

      // Speichern der Baby-Informationen (Name, Geschlecht, Geburtsdatum, Gewicht, Größe)
      const babyInfo = {
        name: babyName,
        baby_gender: babyGender,
        birth_date: birthDate ? birthDate.toISOString() : null,
        weight: babyWeight,
        height: babyHeight
      };

      const { error: babyError } = await saveBabyInfo(babyInfo);

      if (babyError) {
        console.error('Error saving baby info:', babyError);
        throw new Error('Baby-Informationen konnten nicht gespeichert werden.');
      }

      // Nach dem Speichern zur entsprechenden Seite navigieren
      if (isBabyBorn) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(tabs)/countdown');
      }
    } catch (err) {
      console.error('Failed to save user data:', err);
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Deine Daten konnten nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  // Zum nächsten Schritt gehen
  const goToNextStep = () => {
    // Validierung für den aktuellen Schritt
    if (currentStep === 0 && !firstName.trim()) {
      Alert.alert('Hinweis', 'Bitte gib deinen Vornamen ein.');
      return;
    }

    if (currentStep === 1 && !lastName.trim()) {
      Alert.alert('Hinweis', 'Bitte gib deinen Nachnamen ein.');
      return;
    }

    if (currentStep === 2 && !userRole) {
      Alert.alert('Hinweis', 'Bitte wähle aus, ob du Mama oder Papa bist.');
      return;
    }

    if (currentStep === 3 && !dueDate) {
      Alert.alert('Hinweis', 'Bitte wähle den errechneten Geburtstermin aus.');
      return;
    }

    if (currentStep === 4 && isBabyBorn === null) {
      Alert.alert('Hinweis', 'Bitte gib an, ob dein Baby bereits geboren ist.');
      return;
    }

    // Wenn das Baby geboren ist und wir beim Schritt für das Geburtsdatum sind
    if (currentStep === 5 && isBabyBorn && !birthDate) {
      Alert.alert('Hinweis', 'Bitte gib das Geburtsdatum deines Babys ein.');
      return;
    }

    // Wenn wir beim letzten Schritt sind, speichern wir die Daten
    if (currentStep === totalSteps - 1) {
      saveUserData();
      return;
    }

    // Wenn das Baby nicht geboren ist und wir beim Schritt für den Baby-Status sind,
    // überspringen wir die Schritte für Geburtsdatum
    if (currentStep === 4 && !isBabyBorn) {
      setCurrentStep(6); // Springe zum Schritt für Baby-Name und Geschlecht
      return;
    }

    // Zum nächsten Schritt
    setCurrentStep(currentStep + 1);
  };

  // Zum vorherigen Schritt gehen
  const goToPreviousStep = () => {
    // Wenn wir beim ersten Schritt sind, können wir nicht zurück
    if (currentStep === 0) {
      return;
    }

    // Wenn wir beim Schritt für Baby-Name und Geschlecht sind und das Baby nicht geboren ist,
    // gehen wir zurück zum Schritt für den Baby-Status
    if (currentStep === 6 && !isBabyBorn) {
      setCurrentStep(4);
      return;
    }

    // Zum vorherigen Schritt
    setCurrentStep(currentStep - 1);
  };

  // Render-Funktion für den aktuellen Schritt
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: // Vorname
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Wie ist dein Vorname?</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Dein Vorname"
              placeholderTextColor={theme.tabIconDefault}
              autoFocus
            />
          </ThemedView>
        );

      case 1: // Nachname
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Wie ist dein Nachname?</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Dein Nachname"
              placeholderTextColor={theme.tabIconDefault}
              autoFocus
            />
          </ThemedView>
        );

      case 2: // Mama oder Papa
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Bist du Mama oder Papa?</ThemedText>
            <View style={styles.roleButtonsContainer}>
              <TouchableOpacity
                style={[styles.roleButton, userRole === 'mama' && styles.roleButtonActive]}
                onPress={() => setUserRole('mama')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={userRole === 'mama' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.roleButtonText, userRole === 'mama' && styles.roleButtonTextActive]}>
                  Mama
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleButton, userRole === 'papa' && styles.roleButtonActive]}
                onPress={() => setUserRole('papa')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={userRole === 'papa' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.roleButtonText, userRole === 'papa' && styles.roleButtonTextActive]}>
                  Papa
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        );

      case 3: // Errechneter Geburtstermin
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Wann ist der errechnete Geburtstermin?</ThemedText>
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
          </ThemedView>
        );

      case 4: // Baby bereits geboren?
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Ist dein Baby bereits geboren?</ThemedText>
            <View style={styles.booleanButtonsContainer}>
              <TouchableOpacity
                style={[styles.booleanButton, isBabyBorn && styles.booleanButtonActive]}
                onPress={() => setIsBabyBorn(true)}
              >
                <ThemedText style={[styles.booleanButtonText, isBabyBorn && styles.booleanButtonTextActive]}>Ja</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.booleanButton, isBabyBorn === false && styles.booleanButtonActive]}
                onPress={() => setIsBabyBorn(false)}
              >
                <ThemedText style={[styles.booleanButtonText, isBabyBorn === false && styles.booleanButtonTextActive]}>Nein</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        );

      case 5: // Geburtsdatum (nur wenn Baby geboren ist)
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Wann wurde dein Baby geboren?</ThemedText>
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
          </ThemedView>
        );

      case 6: // Baby-Informationen (Name, Geschlecht)
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Wie heißt dein Baby?</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={babyName}
              onChangeText={setBabyName}
              placeholder="Name deines Babys (optional)"
              placeholderTextColor={theme.tabIconDefault}
              autoFocus
            />

            <ThemedText style={styles.stepSubtitle}>Welches Geschlecht hat dein Baby?</ThemedText>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[styles.genderButton, babyGender === 'male' && styles.genderButtonActive]}
                onPress={() => setBabyGender('male')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={babyGender === 'male' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.genderButtonText, babyGender === 'male' && styles.genderButtonTextActive]}>
                  Junge
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.genderButton, babyGender === 'female' && styles.genderButtonActive]}
                onPress={() => setBabyGender('female')}
              >
                <IconSymbol
                  name="person.fill"
                  size={24}
                  color={babyGender === 'female' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.genderButtonText, babyGender === 'female' && styles.genderButtonTextActive]}>
                  Mädchen
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.genderButton, babyGender === 'unknown' && styles.genderButtonActive]}
                onPress={() => setBabyGender('unknown')}
              >
                <IconSymbol
                  name="questionmark.circle"
                  size={24}
                  color={babyGender === 'unknown' ? '#FFFFFF' : theme.tabIconDefault}
                />
                <ThemedText style={[styles.genderButtonText, babyGender === 'unknown' && styles.genderButtonTextActive]}>
                  Weiß noch nicht
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        );

      case 7: // Zusammenfassung und Speichern
        return (
          <ThemedView style={styles.stepContainer} lightColor="#FFFFFF" darkColor="#333333">
            <ThemedText style={styles.stepTitle}>Zusammenfassung</ThemedText>

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Name:</ThemedText>
              <ThemedText style={styles.summaryValue}>{firstName} {lastName}</ThemedText>
            </View>

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Rolle:</ThemedText>
              <ThemedText style={styles.summaryValue}>{userRole === 'mama' ? 'Mama' : userRole === 'papa' ? 'Papa' : 'Nicht festgelegt'}</ThemedText>
            </View>

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Errechneter Geburtstermin:</ThemedText>
              <ThemedText style={styles.summaryValue}>{dueDate ? formatDate(dueDate) : 'Nicht festgelegt'}</ThemedText>
            </View>

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Baby geboren:</ThemedText>
              <ThemedText style={styles.summaryValue}>{isBabyBorn ? 'Ja' : 'Nein'}</ThemedText>
            </View>

            {isBabyBorn && (
              <>
                <View style={styles.summaryItem}>
                  <ThemedText style={styles.summaryLabel}>Geburtsdatum:</ThemedText>
                  <ThemedText style={styles.summaryValue}>{birthDate ? formatDate(birthDate) : 'Nicht festgelegt'}</ThemedText>
                </View>
              </>
            )}

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Baby-Name:</ThemedText>
              <ThemedText style={styles.summaryValue}>{babyName || 'Nicht festgelegt'}</ThemedText>
            </View>

            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Geschlecht:</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {babyGender === 'male' ? 'Junge' : babyGender === 'female' ? 'Mädchen' : 'Noch nicht bekannt'}
              </ThemedText>
            </View>

            <ThemedText style={styles.summaryNote}>
              Du kannst diese Informationen später in deinem Profil ändern.
            </ThemedText>
          </ThemedView>
        );

      default:
        return null;
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/Background_Hell.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden={true} />

        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Willkommen!
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Lass uns dein Profil einrichten
          </ThemedText>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${(currentStep + 1) / totalSteps * 100}%` }]}
            />
          </View>
          <ThemedText style={styles.progressText}>
            Schritt {currentStep + 1} von {totalSteps}
          </ThemedText>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade Daten...</ThemedText>
          </View>
        ) : (
          <View style={styles.content}>
            {renderCurrentStep()}

            <View style={styles.buttonsContainer}>
              {currentStep > 0 && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={goToPreviousStep}
                >
                  <IconSymbol name="chevron.left" size={20} color={theme.text} />
                  <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.nextButton, isSaving && styles.buttonDisabled]}
                onPress={goToNextStep}
                disabled={isSaving}
              >
                <ThemedText style={styles.nextButtonText}>
                  {currentStep === totalSteps - 1 ? (isSaving ? 'Speichern...' : 'Fertig') : 'Weiter'}
                </ThemedText>
                {currentStep < totalSteps - 1 && (
                  <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
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
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#7D5A50',
  },
  subtitle: {
    fontSize: 18,
    color: '#7D5A50',
    opacity: 0.8,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9DBEBB',
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#7D5A50',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#7D5A50',
  },
  stepSubtitle: {
    fontSize: 16,
    marginTop: 20,
    marginBottom: 10,
    color: '#7D5A50',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 10,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dateButtonText: {
    fontSize: 16,
  },
  booleanButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  booleanButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 10,
    marginHorizontal: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  booleanButtonActive: {
    backgroundColor: '#9DBEBB',
    borderColor: '#9DBEBB',
  },
  booleanButtonText: {
    fontSize: 16,
  },
  booleanButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  roleButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 10,
    marginHorizontal: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  roleButtonActive: {
    backgroundColor: '#9DBEBB',
    borderColor: '#9DBEBB',
  },
  roleButtonText: {
    fontSize: 16,
    marginTop: 5,
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  genderButton: {
    width: '30%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  genderButtonActive: {
    backgroundColor: '#9DBEBB',
    borderColor: '#9DBEBB',
  },
  genderButtonText: {
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  summaryItem: {
    marginBottom: 15,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#7D5A50',
    opacity: 0.8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  summaryNote: {
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#7D5A50',
    opacity: 0.7,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFCCCB', // Pastellrot
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 5,
    color: '#7D5A50',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9DBEBB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    minWidth: 120,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});
