import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, TextInput, Alert, SafeAreaView, StatusBar, Platform, BackHandler } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getBabyInfo, saveBabyInfo, BabyInfo } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { loadBabyInfoWithCache, invalidateBabyCache } from '@/lib/babyCache';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, Stack } from 'expo-router';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import * as Notifications from 'expo-notifications';
import { defineMilestoneCheckerTask, saveBabyInfoForBackgroundTask, isTaskRegistered } from '@/tasks/milestoneCheckerTask';
import { LAYOUT_PAD, LiquidGlassCard, GLASS_OVERLAY, GLASS_OVERLAY_DARK } from '@/constants/DesignGuide';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  bedtimeAnchorToDate,
  dateToBedtimeAnchor,
  DEFAULT_BEDTIME_ANCHOR,
  normalizeBedtimeAnchor,
} from '@/lib/bedtime';

export default function BabyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const textTertiary = isDark ? Colors.dark.textTertiary : '#A8978E';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const photoButtonBackground = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(125, 90, 80, 0.15)';
  const photoButtonBorder = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.35)';
  const accentButtonBackground = isDark ? 'rgba(142, 78, 198, 0.26)' : 'rgba(142, 78, 198, 0.16)';
  const accentButtonBorder = isDark ? 'rgba(196, 160, 233, 0.55)' : 'rgba(142, 78, 198, 0.35)';
  const inputBackground = isDark ? 'rgba(18,18,22,0.76)' : 'rgba(255,255,255,0.85)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.35)';
  const { user } = useAuth();
  const { activeBabyId, refreshBabies, isReady } = useActiveBaby();
  const { refreshBabyDetails } = useBabyStatus();
  const router = useRouter();

  // Set fallback route for smart back navigation
  useSmartBack('/(tabs)/home');

  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBedtimePicker, setShowBedtimePicker] = useState(false);
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
    if (!activeBabyId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Load with cache - instant if cached
      const { data, isStale, refresh } = await loadBabyInfoWithCache(activeBabyId);

      // Show cached data immediately
      if (data) {
        setBabyInfo({
          ...data,
          preferred_bedtime: data.preferred_bedtime
            ? normalizeBedtimeAnchor(data.preferred_bedtime)
            : null,
        });
        setIsLoading(false);
      }

      // Refresh in background if stale
      if (isStale) {
        const freshData = await refresh();
        setBabyInfo({
          ...freshData,
          preferred_bedtime: freshData.preferred_bedtime
            ? normalizeBedtimeAnchor(freshData.preferred_bedtime)
            : null,
        });
      }

      // If no cache, data is already fresh
      if (!data) {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to load baby info:', err);
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!user || !isReady || !activeBabyId) return;
  
      loadBabyInfo();
  
      const handleHardwareBack = () => {
        router.push('/(tabs)/home');
        return true;
      };
  
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handleHardwareBack
      );
  
      return () => subscription.remove();
    }, [user, isReady, activeBabyId, router])
  );

  const displayPhoto = babyInfo.photo_url || null;

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  const pickBabyPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64Data: string | null = null;

        if (asset.base64) {
          base64Data = `data:image/jpeg;base64,${asset.base64}`;
        } else if (asset.uri) {
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const reader = new FileReader();
            base64Data = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('Fehler bei der Bildkonvertierung:', error);
            Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
            return;
          }
        }

        if (!base64Data) {
          Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
          return;
        }

        setBabyInfo((current) => ({
          ...current,
          photo_url: base64Data,
        }));
      }
    } catch (error) {
      console.error('Error picking baby photo:', error);
      Alert.alert('Fehler', 'Das Babyfoto konnte nicht ausgewählt werden.');
    }
  };

  const removeBabyPhoto = () => {
    setBabyInfo((current) => ({
      ...current,
      photo_url: null,
    }));
  };

  const handleSave = async () => {
    if (!activeBabyId) return;

    try {
      const { error } = await saveBabyInfo(babyInfo, activeBabyId ?? undefined);
      if (error) {
        console.error('Error saving baby info:', error);
        Alert.alert('Fehler', 'Die Informationen konnten nicht gespeichert werden.');
      } else {
        Alert.alert('Erfolg', 'Die Informationen wurden erfolgreich gespeichert.');
        setIsEditing(false);
        await refreshBabyDetails();
        await refreshBabies();

        // Speichere relevante Baby-Infos für den Hintergrund-Task
        if (babyInfo.birth_date) {
          await saveBabyInfoForBackgroundTask(babyInfo);
          console.log('Baby-Infos für Hintergrund-Task gespeichert.');
        }

        // Invalidate cache after save
        await invalidateBabyCache(activeBabyId);

        // Reload fresh data from Supabase
        loadBabyInfo();
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

  const handleBedtimeChange = (_event: any, selectedTime?: Date) => {
    setShowBedtimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setBabyInfo({
        ...babyInfo,
        preferred_bedtime: dateToBedtimeAnchor(selectedTime),
      });
    }
  };

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        
        <Header
          title="Mein Baby"
          subtitle="Alle Infos & Einstellungen"
          showBackButton
          onBackPress={() => {
            triggerHaptic();
            router.push('/(tabs)/home');
          }}
        />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <LiquidGlassCard style={styles.glassCard} intensity={24} overlayColor={glassOverlay}>
            <View style={styles.glassInner}>
            <View style={styles.photoContainer}>
              {displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.babyPhoto} />
              ) : (
                <View style={[styles.placeholderPhoto, { backgroundColor: isDark ? '#555' : '#E0E0E0' }]}>
                  <IconSymbol name="person.fill" size={60} color={isDark ? adaptiveColors.iconSecondary : theme.tabIconDefault} />
                </View>
              )}

              <View style={styles.photoHintContainer}>
                {isEditing ? (
                  <>
                    <ThemedText style={[styles.photoHintText, { color: textSecondary }]}>
                      {displayPhoto ? 'Babyfoto anpassen' : 'Füge ein Babyfoto hinzu'}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.photoHintButton, { backgroundColor: photoButtonBackground, borderColor: photoButtonBorder }]}
                      onPress={() => {
                        triggerHaptic();
                        pickBabyPhoto();
                      }}
                    >
                      <ThemedText style={[styles.photoHintButtonText, { color: textPrimary }]}>
                        Foto wählen
                      </ThemedText>
                    </TouchableOpacity>
                    {!!displayPhoto && (
                      <TouchableOpacity
                        style={[styles.photoHintButton, styles.photoRemoveButton, { backgroundColor: photoButtonBackground, borderColor: photoButtonBorder }]}
                        onPress={() => {
                          triggerHaptic();
                          removeBabyPhoto();
                        }}
                      >
                        <ThemedText style={[styles.photoHintButtonText, { color: textPrimary }]}>
                          Foto entfernen
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <ThemedText style={[styles.photoHintText, { color: textSecondary }]}>
                      Ändere das Babyfoto direkt hier.
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.photoHintButton, { backgroundColor: photoButtonBackground, borderColor: photoButtonBorder }]}
                      onPress={() => {
                        triggerHaptic();
                        setIsEditing(true);
                        pickBabyPhoto();
                      }}
                    >
                      <ThemedText style={[styles.photoHintButtonText, { color: textPrimary }]}>
                        Foto ändern
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            <View style={styles.infoContainer}>
              {isEditing ? (
                <>
                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Name:</ThemedText>
                    <TextInput
                      style={[styles.glassInput, { color: textPrimary, backgroundColor: inputBackground, borderColor: inputBorder }]}
                      value={babyInfo.name}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, name: text })}
                      placeholder="Name des Babys"
                      placeholderTextColor={textTertiary}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Geburtsdatum:</ThemedText>
                    <TouchableOpacity
                      style={[styles.glassDateButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                      onPress={() => {
                        triggerHaptic();
                        setShowDatePicker(true);
                      }}
                    >
                      <ThemedText style={[styles.dateText, { color: textPrimary }]}>
                        {babyInfo.birth_date
                          ? new Date(babyInfo.birth_date).toLocaleDateString('de-DE')
                          : 'Datum wählen'}
                      </ThemedText>
                      <IconSymbol name="calendar" size={20} color={textPrimary} />
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={babyInfo.birth_date ? new Date(babyInfo.birth_date) : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                        textColor={isDark ? '#FFFFFF' : undefined}
                      />
                    )}
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Schlafenszeit (Nacht):</ThemedText>
                    <TouchableOpacity
                      style={[styles.glassDateButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                      onPress={() => {
                        triggerHaptic();
                        setShowBedtimePicker(true);
                      }}
                    >
                      <ThemedText style={[styles.dateText, { color: textPrimary }]}>
                        {normalizeBedtimeAnchor(babyInfo.preferred_bedtime)}
                      </ThemedText>
                      <IconSymbol name="moon.zzz" size={20} color={textPrimary} />
                    </TouchableOpacity>

                    <ThemedText style={[styles.photoHintText, { color: textSecondary, textAlign: 'left', marginTop: 8, marginBottom: 0 }]}>
                      Diese Uhrzeit wird für die Schlafvorhersage und Schlaffenster-Erinnerungen genutzt.
                    </ThemedText>

                    {showBedtimePicker && (
                      <DateTimePicker
                        value={bedtimeAnchorToDate(babyInfo.preferred_bedtime)}
                        mode="time"
                        display="default"
                        is24Hour
                        onChange={handleBedtimeChange}
                        textColor={isDark ? '#FFFFFF' : undefined}
                      />
                    )}
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Gewicht:</ThemedText>
                    <TextInput
                      style={[styles.glassInput, { color: textPrimary, backgroundColor: inputBackground, borderColor: inputBorder }]}
                      value={babyInfo.weight}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, weight: text })}
                      placeholder="z.B. 3250g"
                      placeholderTextColor={textTertiary}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={styles.label}>Größe:</ThemedText>
                    <TextInput
                      style={[styles.glassInput, { color: textPrimary, backgroundColor: inputBackground, borderColor: inputBorder }]}
                      value={babyInfo.height}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, height: text })}
                      placeholder="z.B. 52cm"
                      placeholderTextColor={textTertiary}
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.cancelButton,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)',
                          borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.35)',
                        }
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setIsEditing(false);
                        loadBabyInfo(); // Zurücksetzen auf gespeicherte Daten
                      }}
                    >
                      <ThemedText style={[styles.buttonText, { color: textPrimary }]}>
                        Abbrechen
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.saveButton, { backgroundColor: accentButtonBackground, borderColor: accentButtonBorder }]}
                      onPress={() => {
                        triggerHaptic();
                        handleSave();
                      }}
                    >
                      <ThemedText style={[styles.buttonText, { color: textPrimary }]}>
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
                    <ThemedText style={styles.infoLabel}>Schlafenszeit:</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {babyInfo.preferred_bedtime
                        ? normalizeBedtimeAnchor(babyInfo.preferred_bedtime)
                        : `${DEFAULT_BEDTIME_ANCHOR} (Standard)`}
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
                    style={[styles.button, styles.editButton, { backgroundColor: accentButtonBackground, borderColor: accentButtonBorder }]}
                    onPress={() => {
                      triggerHaptic();
                      setIsEditing(true);
                    }}
                  >
                    <ThemedText style={[styles.buttonText, { color: textPrimary }]}>
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
            overlayColor={accentButtonBackground}
            borderColor={accentButtonBorder}
            onPress={() => {
              triggerHaptic();
              router.push({ pathname: '/baby-stats' } as any);
            }}
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
          
          <LiquidGlassCard style={styles.infoGlassCard} intensity={24} overlayColor={glassOverlay}>
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
    textAlign: 'center',
    marginBottom: 8,
  },
  photoHintButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  photoRemoveButton: {
    marginTop: 8,
  },
  photoHintButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
