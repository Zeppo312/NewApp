import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, ImageBackground, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  // Benutzerinformationen
  const [userName, setUserName] = useState('');
  
  // Baby-Informationen
  const [isBabyBorn, setIsBabyBorn] = useState(false);
  const [babyName, setBabyName] = useState('');
  const [babyGender, setBabyGender] = useState<'male' | 'female' | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [babyHeight, setBabyHeight] = useState('');
  const [babyWeight, setBabyWeight] = useState('');
  
  // UI-Status
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  
  // Benutzer-ID abrufen
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        await loadUserData(data.user.id);
      } else {
        // Wenn kein Benutzer angemeldet ist, zur Login-Seite weiterleiten
        router.replace('/(auth)/login');
      }
    };
    
    checkUser();
  }, []);

  // Lade Benutzerdaten aus der Datenbank
  const loadUserData = async (userId: string) => {
    try {
      setIsLoading(true);

      // 1. Lade Benutzerprofil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile:', profileError);
      } else if (profileData) {
        setUserName(profileData.first_name || '');
      }

      // 2. Lade Benutzereinstellungen
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error loading settings:', settingsError);
      } else if (settingsData) {
        setIsBabyBorn(settingsData.is_baby_born || false);
        if (settingsData.due_date) {
          setDueDate(new Date(settingsData.due_date));
        }
      }

      // 3. Lade Baby-Informationen
      const { data: babyData, error: babyError } = await supabase
        .from('baby_info')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (babyError && babyError.code !== 'PGRST116') {
        console.error('Error loading baby info:', babyError);
      } else if (babyData) {
        setBabyName(babyData.name || '');
        setBabyGender(babyData.gender as 'male' | 'female' | null || null);
        if (babyData.birth_date) {
          setBirthDate(new Date(babyData.birth_date));
        }
        setBabyHeight(babyData.height || '');
        setBabyWeight(babyData.weight || '');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Fehler', 'Deine Daten konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  // Formatiere das Datum für die Anzeige
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'dd.MM.yyyy', { locale: de });
  };

  // Speichere alle Daten
  const saveData = async () => {
    try {
      if (!userId) {
        Alert.alert('Fehler', 'Du bist nicht angemeldet. Bitte melde dich erneut an.');
        return;
      }

      setIsSaving(true);

      // 1. Speichere den Benutzernamen in der profiles-Tabelle
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          first_name: userName,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        throw new Error(`Fehler beim Speichern des Profils: ${profileError.message}`);
      }

      // 2. Speichere den Baby-Status und Geburtstermin in der user_settings-Tabelle
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          is_baby_born: isBabyBorn,
          due_date: isBabyBorn ? null : dueDate?.toISOString(),
          updated_at: new Date().toISOString()
        });

      if (settingsError) {
        throw new Error(`Fehler beim Speichern der Einstellungen: ${settingsError.message}`);
      }

      // 3. Speichere die Baby-Informationen
      const { error: babyError } = await supabase
        .from('baby_info')
        .upsert({
          user_id: userId,
          name: babyName,
          gender: babyGender,
          birth_date: isBabyBorn ? birthDate?.toISOString() : null,
          height: isBabyBorn ? babyHeight : null,
          weight: isBabyBorn ? babyWeight : null,
          updated_at: new Date().toISOString()
        });

      if (babyError) {
        throw new Error(`Fehler beim Speichern der Baby-Informationen: ${babyError.message}`);
      }

      Alert.alert('Erfolg', 'Deine Daten wurden erfolgreich gespeichert.');
    } catch (error) {
      console.error('Fehler beim Speichern der Daten:', error);
      Alert.alert('Fehler', `Es ist ein Fehler aufgetreten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ImageBackground
          source={require('@/assets/images/Background_Hell.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={24} color={theme.text} />
              <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
            </TouchableOpacity>

            <ThemedText type="title" style={styles.title}>
              Profil
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>Daten werden geladen...</ThemedText>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
                <ThemedText style={styles.sectionTitle}>Deine Informationen</ThemedText>
                
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Dein Name</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Wie möchtest du genannt werden?"
                    placeholderTextColor={theme.tabIconDefault}
                    value={userName}
                    onChangeText={setUserName}
                  />
                </View>
              </ThemedView>

              <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
                <ThemedText style={styles.sectionTitle}>Baby-Informationen</ThemedText>
                
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Status</ThemedText>
                  <View style={styles.babyStatusButtons}>
                    <TouchableOpacity
                      style={[
                        styles.babyStatusButton,
                        !isBabyBorn && styles.activeStatusButton,
                        !isBabyBorn && { backgroundColor: theme.accent + '30' }
                      ]}
                      onPress={() => setIsBabyBorn(false)}
                    >
                      <IconSymbol name="heart.fill" size={24} color={!isBabyBorn ? theme.accent : theme.tabIconDefault} />
                      <ThemedText style={styles.babyStatusText}>Mein Baby ist noch unterwegs</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.babyStatusButton,
                        isBabyBorn && styles.activeStatusButton,
                        isBabyBorn && { backgroundColor: theme.accent + '30' }
                      ]}
                      onPress={() => setIsBabyBorn(true)}
                    >
                      <IconSymbol name="person.crop.circle" size={24} color={isBabyBorn ? theme.accent : theme.tabIconDefault} />
                      <ThemedText style={styles.babyStatusText}>Mein Baby ist schon da</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Name des Babys</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Name deines Babys (optional)"
                    placeholderTextColor={theme.tabIconDefault}
                    value={babyName}
                    onChangeText={setBabyName}
                  />
                </View>

                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Geschlecht</ThemedText>
                  <View style={styles.genderButtons}>
                    <TouchableOpacity
                      style={[
                        styles.genderButton,
                        babyGender === 'male' && styles.activeGenderButton,
                        babyGender === 'male' && { backgroundColor: '#9FD8FF' }
                      ]}
                      onPress={() => setBabyGender('male')}
                    >
                      <IconSymbol name="person.fill" size={20} color={babyGender === 'male' ? '#0066CC' : theme.tabIconDefault} />
                      <ThemedText style={styles.genderButtonText}>Junge</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.genderButton,
                        babyGender === 'female' && styles.activeGenderButton,
                        babyGender === 'female' && { backgroundColor: '#FFB6C1' }
                      ]}
                      onPress={() => setBabyGender('female')}
                    >
                      <IconSymbol name="person.fill" size={20} color={babyGender === 'female' ? '#CC0066' : theme.tabIconDefault} />
                      <ThemedText style={styles.genderButtonText}>Mädchen</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                {!isBabyBorn ? (
                  <View style={styles.formGroup}>
                    <ThemedText style={styles.label}>Voraussichtlicher Geburtstermin</ThemedText>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowDueDatePicker(true)}
                    >
                      <ThemedText style={styles.datePickerButtonText}>
                        {dueDate ? formatDate(dueDate) : 'Datum auswählen'}
                      </ThemedText>
                      <IconSymbol name="calendar" size={20} color={theme.accent} />
                    </TouchableOpacity>
                    {showDueDatePicker && (
                      <DateTimePicker
                        value={dueDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDueDatePicker(false);
                          if (selectedDate) {
                            setDueDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </View>
                ) : (
                  <>
                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Geburtsdatum</ThemedText>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowBirthDatePicker(true)}
                      >
                        <ThemedText style={styles.datePickerButtonText}>
                          {birthDate ? formatDate(birthDate) : 'Datum auswählen'}
                        </ThemedText>
                        <IconSymbol name="calendar" size={20} color={theme.accent} />
                      </TouchableOpacity>
                      {showBirthDatePicker && (
                        <DateTimePicker
                          value={birthDate || new Date()}
                          mode="date"
                          display="default"
                          onChange={(event, selectedDate) => {
                            setShowBirthDatePicker(false);
                            if (selectedDate) {
                              setBirthDate(selectedDate);
                            }
                          }}
                        />
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Größe bei der Geburt (cm)</ThemedText>
                      <TextInput
                        style={[styles.input, { color: theme.text }]}
                        placeholder="z.B. 52"
                        placeholderTextColor={theme.tabIconDefault}
                        value={babyHeight}
                        onChangeText={setBabyHeight}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText style={styles.label}>Gewicht bei der Geburt (g)</ThemedText>
                      <TextInput
                        style={[styles.input, { color: theme.text }]}
                        placeholder="z.B. 3500"
                        placeholderTextColor={theme.tabIconDefault}
                        value={babyWeight}
                        onChangeText={setBabyWeight}
                        keyboardType="numeric"
                      />
                    </View>
                  </>
                )}
              </ThemedView>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.accent }]}
                onPress={saveData}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>Speichern</ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </ImageBackground>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    borderRadius: 16,
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  babyStatusButtons: {
    flexDirection: 'column',
    marginBottom: 8,
  },
  babyStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  activeStatusButton: {
    borderWidth: 2,
    borderColor: '#FF9F9F',
  },
  babyStatusText: {
    fontSize: 16,
    marginLeft: 12,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerButtonText: {
    fontSize: 16,
  },
  genderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  activeGenderButton: {
    borderWidth: 2,
    borderColor: '#000',
  },
  genderButtonText: {
    fontSize: 14,
    marginLeft: 8,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
