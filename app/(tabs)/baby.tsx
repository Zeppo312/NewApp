import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, TextInput, Alert, SafeAreaView, StatusBar, Platform, BackHandler } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getBabyInfo, saveBabyInfo, BabyInfo } from '@/lib/baby';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, Stack } from 'expo-router';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import * as Notifications from 'expo-notifications';
import { defineMilestoneCheckerTask, saveBabyInfoForBackgroundTask, isTaskRegistered } from '@/tasks/milestoneCheckerTask';
import { LAYOUT_PAD, TIMELINE_INSET, LiquidGlassCard } from '@/constants/DesignGuide';
import { useFocusEffect } from '@react-navigation/native';

export default function BabyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();
  
  // Set fallback route for smart back navigation
  useSmartBack('/(tabs)/home');

  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<{status: string, isRegistered: boolean} | null>(null);

  useEffect(() => {
    if (user) {
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

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        return;
      }

      loadBabyInfo();

      const handleHardwareBack = () => {
        router.push('/(tabs)/home');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
      return () => subscription.remove();
    }, [user, router])
  );

  const displayPhoto = babyInfo.photo_url || null;

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

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header
          title="Mein Baby"
          subtitle="Alle Infos & Einstellungen"
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <LiquidGlassCard style={styles.glassCard} intensity={24}>
            <View style={styles.glassInner}>
            <View style={styles.photoContainer}>
              {displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.babyPhoto} />
              ) : (
                <View style={[styles.placeholderPhoto, { backgroundColor: colorScheme === 'dark' ? '#555' : '#E0E0E0' }]}>
                  <IconSymbol name="person.fill" size={60} color={theme.tabIconDefault} />
                </View>
              )}

              <View style={styles.photoHintContainer}>
                <ThemedText style={styles.photoHintText}>
                  Das Babyfoto kannst du im Profil bearbeiten.
                </ThemedText>
                <TouchableOpacity
                  style={styles.photoHintButton}
                  onPress={() => router.push('/profil')}
                >
                  <ThemedText style={styles.photoHintButtonText}>
                    Zum Profil
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoContainer}>
              {isEditing ? (
                <>
                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Name:</ThemedText>
                    <TextInput
                      style={styles.glassInput}
                      value={babyInfo.name}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, name: text })}
                      placeholder="Name des Babys"
                      placeholderTextColor={'#A8978E'}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Geburtsdatum:</ThemedText>
                    <TouchableOpacity style={styles.glassDateButton} onPress={() => setShowDatePicker(true)}>
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
                      style={styles.glassInput}
                      value={babyInfo.weight}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, weight: text })}
                      placeholder="z.B. 3250g"
                      placeholderTextColor={'#A8978E'}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Größe:</ThemedText>
                    <TextInput
                      style={styles.glassInput}
                      value={babyInfo.height}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, height: text })}
                      placeholder="z.B. 52cm"
                      placeholderTextColor={'#A8978E'}
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
                      <ThemedText style={[styles.buttonText, { color: '#7D5A50' }]} lightColor="#7D5A50" darkColor="#7D5A50">
                        Abbrechen
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.saveButton]}
                      onPress={handleSave}
                    >
                      <ThemedText style={[styles.buttonText, { color: '#7D5A50' }]} lightColor="#7D5A50" darkColor="#7D5A50">
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

                  <TouchableOpacity style={[styles.button, styles.editButton]} onPress={() => setIsEditing(true)}>
                    <ThemedText style={[styles.buttonText, { color: '#7D5A50' }]} lightColor="#7D5A50" darkColor="#7D5A50">
                      Bearbeiten
                    </ThemedText>
                  </TouchableOpacity>
                </>
              )}
            </View>
            </View>
          </LiquidGlassCard>

          <LiquidGlassCard
            style={styles.infoGlassCard}
            intensity={24}
            overlayColor={'rgba(142, 78, 198, 0.16)'}
            borderColor={'rgba(142, 78, 198, 0.35)'}
            onPress={() => router.push({ pathname: '/baby-stats' } as any)}
          >
            <View style={styles.infoGlassInner}>
              <View style={styles.statsButtonContent}>
                <View>
                  <ThemedText style={styles.infoTitle}>Baby-Statistiken</ThemedText>
                  <ThemedText style={styles.infoText}>
                    Alter, Entwicklung, Meilensteine und interessante Fakten über dein Baby
                  </ThemedText>
                </View>
              </View>
            </View>
          </LiquidGlassCard>
          
          <LiquidGlassCard style={styles.infoGlassCard} intensity={24}>
            <View style={styles.infoGlassInner}>
              <ThemedText style={styles.infoTitle}>Die ersten Wochen</ThemedText>
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
            </View>
          </LiquidGlassCard>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
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
    paddingHorizontal: LAYOUT_PAD,
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
  // Liquid Glass wrappers (Sleep-Tracker look)
  glassCard: {
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
    borderRadius: 22,
  },
  glassInner: {
    padding: 20,
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
  photoHintContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  photoHintText: {
    fontSize: 14,
    color: '#7D5A50',
    textAlign: 'center',
    marginBottom: 8,
  },
  photoHintButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(125, 90, 80, 0.15)',
  },
  photoHintButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
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
  // Glass inputs/buttons
  glassInput: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: 'rgba(255,255,255,0.35)'
  },
  glassDateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderColor: 'rgba(255,255,255,0.35)'
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
    backgroundColor: 'rgba(142, 78, 198, 0.16)',
    borderColor: 'rgba(142, 78, 198, 0.35)',
    borderWidth: 1,
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    flex: 1,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: 'rgba(142, 78, 198, 0.16)',
    borderColor: 'rgba(142, 78, 198, 0.35)',
    borderWidth: 1,
    flex: 1,
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Info cards (Liquid Glass)
  infoGlassCard: {
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
    borderRadius: 22,
  },
  infoGlassInner: {
    padding: 20,
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
