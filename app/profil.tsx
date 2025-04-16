import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, StatusBar, Platform, Switch, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/lib/supabase';
import { getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { router, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ProfilScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();

  // Benutzerinformationen
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Baby-Informationen
  const [babyName, setBabyName] = useState('');
  const [babyGender, setBabyGender] = useState<'male' | 'female' | ''>('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [babyWeight, setBabyWeight] = useState('');
  const [babyHeight, setBabyHeight] = useState('');

  // UI-Status
  const [isLoading, setIsLoading] = useState(true);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Laden der Daten beim Start
  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Laden der Benutzerdaten aus verschiedenen Tabellen
  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // E-Mail aus dem Auth-Objekt
      if (user?.email) {
        setEmail(user.email);
      }

      // Laden der Profildaten (Vorname, Nachname)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile data:', profileError);
      } else if (profileData) {
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
      }

      // Laden der Benutzereinstellungen (Geburtstermin, Baby geboren)
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('due_date, is_baby_born')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error loading user settings:', settingsError);
      } else if (settingsData) {
        if (settingsData.due_date) {
          setDueDate(new Date(settingsData.due_date));
        }
        if (settingsData.is_baby_born !== undefined) {
          setIsBabyBorn(settingsData.is_baby_born);
        }
      }

      // Laden der Baby-Informationen (Name, Geschlecht, Geburtsdatum, Gewicht, Größe)
      const { data: babyData } = await getBabyInfo();
      if (babyData) {
        setBabyName(babyData.name || '');
        setBabyGender(babyData.baby_gender || '');
        setBabyWeight(babyData.weight || '');
        setBabyHeight(babyData.height || '');
        if (babyData.birth_date) {
          setBirthDate(new Date(babyData.birth_date));
        }
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      Alert.alert('Fehler', 'Deine Daten konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
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

      // Speichern der Profildaten (Vorname, Nachname)
      // Zuerst prüfen, ob bereits ein Eintrag existiert
      const { data: existingProfile, error: fetchProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchProfileError && fetchProfileError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', fetchProfileError);
        throw new Error('Profildaten konnten nicht überprüft werden.');
      }

      let profileResult;

      if (existingProfile && existingProfile.id) {
        // Wenn ein Eintrag existiert, aktualisieren wir diesen
        profileResult = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } else {
        // Wenn kein Eintrag existiert, erstellen wir einen neuen
        profileResult = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

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

      Alert.alert('Erfolg', 'Deine Daten wurden erfolgreich gespeichert.');
    } catch (err) {
      console.error('Failed to save user data:', err);
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Deine Daten konnten nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

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
      // Wenn ein Geburtsdatum gesetzt wird, setzen wir is_baby_born automatisch auf true
      setIsBabyBorn(true);
    }
  };

  // Handler für Änderungen am Baby-Status
  const handleBabyBornChange = (value: boolean) => {
    setIsBabyBorn(value);
    // Wenn das Baby noch nicht geboren ist, setzen wir das Geburtsdatum zurück
    if (!value) {
      setBirthDate(null);
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/(tabs)/more')}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.text} />
            <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>
            Mein Profil
          </ThemedText>

          <View style={styles.headerRight} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade Daten...</ThemedText>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
            {/* Benutzerinformationen */}
            <ThemedView style={styles.section} lightColor={theme.cardLight} darkColor={theme.cardDark}>
              <ThemedText style={styles.sectionTitle}>Persönliche Daten</ThemedText>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>E-Mail</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: 'rgba(200, 200, 200, 0.3)' }]}
                  value={email}
                  editable={false}
                  placeholder="Deine E-Mail-Adresse"
                  placeholderTextColor={theme.tabIconDefault}
                />
              </View>

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
            </ThemedView>

            {/* Schwangerschafts-/Baby-Informationen */}
            <ThemedView style={styles.section} lightColor={theme.cardLight} darkColor={theme.cardDark}>
              <ThemedText style={styles.sectionTitle}>Baby-Informationen</ThemedText>

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

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Baby bereits geboren?</ThemedText>
                <View style={styles.switchContainer}>
                  <ThemedText style={styles.switchLabel}>
                    {isBabyBorn ? 'Ja' : 'Nein'}
                  </ThemedText>
                  <Switch
                    value={isBabyBorn}
                    onValueChange={handleBabyBornChange}
                    trackColor={{ false: '#767577', true: '#E9C9B6' }}
                    thumbColor={isBabyBorn ? '#7D5A50' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Name des Babys - immer anzeigen */}
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Name des Babys</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={babyName}
                  onChangeText={setBabyName}
                  placeholder="Name deines Babys"
                  placeholderTextColor={theme.tabIconDefault}
                />
              </View>

              {/* Geschlecht - immer anzeigen */}
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
              </View>

              {/* Geburtsdatum, Gewicht und Größe - nur anzeigen, wenn Baby geboren ist */}
              {isBabyBorn && (
                <>
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
                </>
              )}
            </ThemedView>

            {/* Speichern-Button */}
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={saveUserData}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.saveButtonText}>
                  Änderungen speichern
                </ThemedText>
              )}
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    width: 80, // Für die Balance im Header
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
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
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
  saveButton: {
    backgroundColor: '#7D5A50',
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    backgroundColor: '#A89992',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
