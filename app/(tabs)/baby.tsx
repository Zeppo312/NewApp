import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, TextInput, Alert, SafeAreaView, StatusBar, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getBabyInfo, saveBabyInfo, BabyInfo } from '@/lib/baby';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useRouter, Stack } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import Header from '@/components/Header';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defineMilestoneCheckerTask, saveBabyInfoForBackgroundTask, isTaskRegistered } from '@/tasks/milestoneCheckerTask';

export default function BabyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();

  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [notificationsRequested, setNotificationsRequested] = useState(false);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<{status: string, isRegistered: boolean} | null>(null);

  useEffect(() => {
    if (user) {
      loadBabyInfo();
      registerForPushNotificationsAsync();
      setupBackgroundTask();
    } else {
      setIsLoading(false);
    }
  }, [user]);
  
  // Wir speichern die Baby-Infos für den Hintergrund-Task nur in handleSave,
  // um unnötige Speichervorgänge zu vermeiden
  
  // Hintergrund-Task einrichten
  const setupBackgroundTask = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus === 'granted') {
        // Definiere Task (Registrierung erfolgt in App-Scope; hier stellen wir sicher, dass sie definiert ist)
        defineMilestoneCheckerTask();
        console.log('Hintergrund-Task für Meilensteine definiert.');
        
        // Status prüfen und speichern (einfacher Check)
        const registered = await isTaskRegistered();
        const status: { status: string; isRegistered: boolean } = { status: registered ? 'REGISTERED' : 'NOT_REGISTERED', isRegistered: !!registered };
        setBackgroundTaskStatus(status);
        console.log('Background Fetch Status:', status);
      } else {
        console.log('Keine Berechtigung für Benachrichtigungen, Hintergrund-Task nicht registriert.');
      }
    } catch (error) {
      console.error('Fehler beim Einrichten des Hintergrund-Tasks:', error);
    }
  };

  const loadBabyInfo = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getBabyInfo();
      if (error) {
        console.error('Error loading baby info:', error);
      } else if (data) {
        setBabyInfo({
          id: data.id,
          name: data.name || '',
          birth_date: data.birth_date || null,
          weight: data.weight || '',
          height: data.height || '',
          photo_url: data.photo_url || null,
          baby_gender: data.baby_gender || 'unknown'
        });
        
        // Wir planen keine Benachrichtigungen im Voraus mehr, stattdessen prüfen wir täglich
      }
    } catch (err) {
      console.error('Failed to load baby info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await saveBabyInfo(babyInfo);
      if (error) {
        console.error('Error saving baby info:', error);
        Alert.alert('Fehler', 'Die Informationen konnten nicht gespeichert werden.');
      } else {
        Alert.alert('Erfolg', 'Die Informationen wurden erfolgreich gespeichert.');
        setIsEditing(false);
        
        // Speichere relevante Baby-Infos für den Hintergrund-Task
        if (babyInfo.birth_date) {
          await saveBabyInfoForBackgroundTask(babyInfo);
          console.log('Baby-Infos für Hintergrund-Task gespeichert.');
        }
        
        loadBabyInfo(); // Neu laden, um sicherzustellen, dass wir die aktuellsten Daten haben
      }
    } catch (err) {
      console.error('Failed to save baby info:', err);
      Alert.alert('Fehler', 'Die Informationen konnten nicht gespeichert werden.');
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBabyInfo({
        ...babyInfo,
        birth_date: selectedDate.toISOString()
      });
    }
  };

  const pickImage = async () => {
    try {
      // Berechtigungen anfordern
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Wir benötigen die Berechtigung, auf deine Fotos zuzugreifen.');
        return;
      }

      // Bild auswählen
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Reduzierte Qualität für kleinere Dateigröße
        base64: true, // Base64-Daten anfordern
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64Data: string;

        // Wenn base64 nicht direkt verfügbar ist, konvertieren wir das Bild
        if (!asset.base64) {
          console.log('Base64 nicht direkt verfügbar, konvertiere Bild...');
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const reader = new FileReader();

            // Promise für FileReader erstellen
            base64Data = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            console.log('Bild erfolgreich in Base64 konvertiert');
          } catch (convError) {
            console.error('Fehler bei der Konvertierung:', convError);
            Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
            return;
          }
        } else {
          // Base64-Daten direkt verwenden
          base64Data = `data:image/jpeg;base64,${asset.base64}`;
          console.log('Base64-Daten direkt verwendet');
        }

        // Aktualisiere den lokalen Zustand
        const updatedBabyInfo = {
          ...babyInfo,
          photo_url: base64Data
        };

        setBabyInfo(updatedBabyInfo);

        // Speichere das Bild sofort in der Datenbank
        try {
          const { error } = await saveBabyInfo(updatedBabyInfo);
          if (error) {
            console.error('Error saving baby photo:', error);
            Alert.alert('Fehler', 'Das Bild konnte nicht gespeichert werden.');
          } else {
            console.log('Bild erfolgreich gespeichert');
            // Kein Alert hier, um den Benutzer nicht zu stören
          }
        } catch (saveError) {
          console.error('Failed to save baby photo:', saveError);
          Alert.alert('Fehler', 'Das Bild konnte nicht gespeichert werden.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Es ist ein Fehler beim Auswählen des Bildes aufgetreten.');
    }
  };

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header title="Mein Baby" subtitle="Alle Infos & Einstellungen" />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          

          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <View style={styles.photoContainer}>
              {babyInfo.photo_url ? (
                <Image source={{ uri: babyInfo.photo_url }} style={styles.babyPhoto} />
              ) : (
                <View style={[styles.placeholderPhoto, { backgroundColor: colorScheme === 'dark' ? '#555' : '#E0E0E0' }]}>
                  <IconSymbol name="person.fill" size={60} color={theme.tabIconDefault} />
                </View>
              )}

              {isEditing && (
                <TouchableOpacity style={styles.editPhotoButton} onPress={pickImage}>
                  <IconSymbol name="camera.fill" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoContainer}>
              {isEditing ? (
                <>
                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Name:</ThemedText>
                    <TextInput
                      style={[
                        styles.input, 
                        { 
                          color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                          borderColor: colorScheme === 'dark' ? '#666' : '#CCCCCC',
                          backgroundColor: colorScheme === 'dark' ? '#444' : '#FFFFFF'
                        }
                      ]}
                      value={babyInfo.name}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, name: text })}
                      placeholder="Name des Babys"
                      placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#888888'}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Geburtsdatum:</ThemedText>
                    <TouchableOpacity
                      style={[
                        styles.dateButton,
                        {
                          borderColor: colorScheme === 'dark' ? '#666' : '#CCCCCC',
                          backgroundColor: colorScheme === 'dark' ? '#444' : '#FFFFFF' 
                        }
                      ]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <ThemedText style={styles.dateText}>
                        {babyInfo.birth_date
                          ? new Date(babyInfo.birth_date).toLocaleDateString('de-DE')
                          : 'Datum wählen'}
                      </ThemedText>
                      <IconSymbol name="calendar" size={20} color={theme.text} />
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={babyInfo.birth_date ? new Date(babyInfo.birth_date) : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                        textColor={colorScheme === 'dark' ? '#FFFFFF' : undefined}
                      />
                    )}
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Gewicht:</ThemedText>
                    <TextInput
                      style={[
                        styles.input, 
                        { 
                          color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                          borderColor: colorScheme === 'dark' ? '#666' : '#CCCCCC',
                          backgroundColor: colorScheme === 'dark' ? '#444' : '#FFFFFF'
                        }
                      ]}
                      value={babyInfo.weight}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, weight: text })}
                      placeholder="z.B. 3250g"
                      placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#888888'}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Größe:</ThemedText>
                    <TextInput
                      style={[
                        styles.input, 
                        { 
                          color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                          borderColor: colorScheme === 'dark' ? '#666' : '#CCCCCC',
                          backgroundColor: colorScheme === 'dark' ? '#444' : '#FFFFFF'
                        }
                      ]}
                      value={babyInfo.height}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, height: text })}
                      placeholder="z.B. 52cm"
                      placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#888888'}
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => {
                        setIsEditing(false);
                        loadBabyInfo(); // Zurücksetzen auf gespeicherte Daten
                      }}
                    >
                      <ThemedText style={styles.buttonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                        Abbrechen
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.saveButton]}
                      onPress={handleSave}
                    >
                      <ThemedText style={styles.buttonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                        Speichern
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Name:</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {babyInfo.name || 'Noch nicht festgelegt'}
                    </ThemedText>
                  </View>

                  <View style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Geburtsdatum:</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {babyInfo.birth_date
                        ? new Date(babyInfo.birth_date).toLocaleDateString('de-DE')
                        : 'Noch nicht festgelegt'}
                    </ThemedText>
                  </View>

                  <View style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Gewicht:</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {babyInfo.weight || 'Noch nicht festgelegt'}
                    </ThemedText>
                  </View>

                  <View style={styles.infoRow}>
                    <ThemedText style={styles.infoLabel}>Größe:</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {babyInfo.height || 'Noch nicht festgelegt'}
                    </ThemedText>
                  </View>

                  <TouchableOpacity
                    style={[styles.button, styles.editButton]}
                    onPress={() => setIsEditing(true)}
                  >
                    <ThemedText style={styles.buttonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                      Bearbeiten
                    </ThemedText>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ThemedView>

          <TouchableOpacity onPress={() => router.push({ pathname: '/baby-stats' } as any)}>
            <ThemedView style={styles.infoCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
              <View style={styles.statsButtonContent}>
                <View>
                  <ThemedText style={styles.infoTitle}>
                    Baby-Statistiken
                  </ThemedText>
                  <ThemedText style={styles.infoText}>
                    Alter, Entwicklung, Meilensteine und interessante Fakten über dein Baby
                  </ThemedText>
                </View>
              </View>
            </ThemedView>
          </TouchableOpacity>
          
          <ThemedView style={styles.infoCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
            <ThemedText style={styles.infoTitle}>
              Die ersten Wochen
            </ThemedText>
            <ThemedText style={styles.infoText}>
              • In den ersten Wochen ist es wichtig, eine Bindung zu deinem Baby aufzubauen.
            </ThemedText>
            <ThemedText style={styles.infoText}>
              • Achte auf ausreichend Ruhe und Erholung für dich und dein Baby.
            </ThemedText>
            <ThemedText style={styles.infoText}>
              • Nimm dir Zeit, dein Baby kennenzulernen und seine Bedürfnisse zu verstehen.
            </ThemedText>
            <ThemedText style={styles.infoText}>
              • Scheue dich nicht, um Hilfe zu bitten, wenn du sie brauchst.
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
    </>
  );
}

  const registerForPushNotificationsAsync = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Permission to receive notifications was denied');
        return;
      }
      
      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };
  
  // Die Meilenstein-Prüfung erfolgt jetzt vollständig im Hintergrund-Task

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonContainer: {
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  card: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  babyPhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  placeholderPhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#7D5A50',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  infoContainer: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 120,
  },
  infoValue: {
    fontSize: 16,
    flex: 1,
  },
  inputRow: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
  },
  dateText: {
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  editButton: {
    backgroundColor: '#7D5A50',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
    flex: 1,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#9DBEBB',
    flex: 1,
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  statsButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
});
