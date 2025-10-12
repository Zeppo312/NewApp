import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useRouter, Stack } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol, IconSymbolName } from '@/components/ui/IconSymbol';
import { getBabyInfo, saveBabyInfo, BabyInfo } from '@/lib/baby';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import {
  defineMilestoneCheckerTask,
  saveBabyInfoForBackgroundTask,
  isTaskRegistered,
} from '@/tasks/milestoneCheckerTask';
import {
  GlassCard,
  LiquidGlassCard,
  LAYOUT_PAD,
  SECTION_GAP_TOP,
  GLASS_BORDER,
  PRIMARY,
  RADIUS,
} from '@/constants/DesignGuide';

const FIRST_WEEKS_TIPS = [
  'In den ersten Wochen ist es wichtig, eine Bindung zu deinem Baby aufzubauen.',
  'Achte auf ausreichend Ruhe und Erholung für dich und dein Baby.',
  'Nimm dir Zeit, dein Baby kennenzulernen und seine Bedürfnisse zu verstehen.',
  'Scheue dich nicht, um Hilfe zu bitten, wenn du sie brauchst.',
];

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;

export default function BabyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDarkMode = colorScheme === 'dark';
  const { user } = useAuth();
  const router = useRouter();

  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<{ status: string; isRegistered: boolean } | null>(null);

  useSmartBack('/(tabs)/home');

  useEffect(() => {
    if (user) {
      loadBabyInfo();
      registerForPushNotificationsAsync();
      setupBackgroundTask();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const glassBorderColor = isDarkMode ? 'rgba(255,255,255,0.22)' : GLASS_BORDER;
  const heroOverlay = isDarkMode ? 'rgba(45,37,34,0.55)' : 'rgba(255,255,255,0.35)';
  const fieldOverlay = isDarkMode ? 'rgba(45,37,34,0.6)' : 'rgba(255,255,255,0.58)';
  const supportOverlay = isDarkMode ? 'rgba(45,37,34,0.4)' : 'rgba(255,255,255,0.3)';
  const placeholderColor = isDarkMode ? 'rgba(248,240,229,0.55)' : 'rgba(125,90,80,0.55)';
  const labelColor = isDarkMode ? 'rgba(248,240,229,0.7)' : 'rgba(125,90,80,0.75)';
  const hintColor = isDarkMode ? 'rgba(248,240,229,0.6)' : 'rgba(125,90,80,0.6)';
  const accentColor = PRIMARY;

  const parseBirthDate = babyInfo.birth_date ? new Date(babyInfo.birth_date) : null;
  const hasValidBirthDate = parseBirthDate && !Number.isNaN(parseBirthDate.getTime());
  const birthDateLabel = hasValidBirthDate
    ? parseBirthDate!.toLocaleDateString('de-DE')
    : 'Noch nicht festgelegt';

  const metrics = [
    { label: 'Geburtsdatum', value: birthDateLabel },
    { label: 'Gewicht', value: babyInfo.weight?.trim() || 'Noch nicht festgelegt' },
    { label: 'Größe', value: babyInfo.height?.trim() || 'Noch nicht festgelegt' },
  ];

  const milestoneStatus: { icon: IconSymbolName; title: string; description: string } | null = backgroundTaskStatus
    ? backgroundTaskStatus.isRegistered
      ? {
          icon: 'checkmark.seal.fill',
          title: 'Meilenstein-Checks aktiv',
          description: 'Wir prüfen täglich auf neue Entwicklungsschritte.',
        }
      : {
          icon: 'bell.badge.fill',
          title: 'Benachrichtigungen noch inaktiv',
          description: 'Erlaube Mitteilungen, um Meilenstein-Erinnerungen zu erhalten.',
        }
    : null;

  const setupBackgroundTask = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus === 'granted') {
        defineMilestoneCheckerTask();
        const registered = await isTaskRegistered();
        const status = { status: registered ? 'REGISTERED' : 'NOT_REGISTERED', isRegistered: !!registered };
        setBackgroundTaskStatus(status);
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
          baby_gender: data.baby_gender || 'unknown',
        });
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

        if (babyInfo.birth_date) {
          await saveBabyInfoForBackgroundTask(babyInfo);
        }

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
        birth_date: selectedDate.toISOString(),
      });
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Wir benötigen die Berechtigung, auf deine Fotos zuzugreifen.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64Data: string;

        if (!asset.base64) {
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const reader = new FileReader();

            base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (convError) {
            console.error('Fehler bei der Konvertierung:', convError);
            Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
            return;
          }
        } else {
          base64Data = `data:image/jpeg;base64,${asset.base64}`;
        }

        const updatedBabyInfo = {
          ...babyInfo,
          photo_url: base64Data,
        };

        setBabyInfo(updatedBabyInfo);

        try {
          const { error } = await saveBabyInfo(updatedBabyInfo);
          if (error) {
            console.error('Error saving baby photo:', error);
            Alert.alert('Fehler', 'Das Bild konnte nicht gespeichert werden.');
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

  if (isLoading) {
    return (
      <ThemedBackground style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Stack.Screen options={{ headerShown: false }} />
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <Header title="Mein Baby" subtitle="Alle Infos & Einstellungen" showBackButton />
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={accentColor} />
            <ThemedText style={[styles.loadingText, { color: hintColor }]}>
              Profil wird geladen …
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <Header title="Mein Baby" subtitle={isEditing ? 'Angaben bearbeiten' : 'Alle Infos & Einstellungen'} showBackButton />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentWrap, { width: contentWidth }]}>
            <LiquidGlassCard
              style={[styles.profileCard, { borderColor: glassBorderColor }]}
              overlayColor={heroOverlay}
            >
              <View style={styles.profileTop}>
              <View
                style={[
                  styles.photoWrapper,
                  {
                    borderColor: glassBorderColor,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)',
                  },
                ]}
              >
                {babyInfo.photo_url ? (
                  <Image source={{ uri: babyInfo.photo_url }} style={styles.babyPhoto} />
                ) : (
                  <View style={styles.placeholderPhoto}>
                    <IconSymbol
                      name="person.fill"
                      size={64}
                      color={isDarkMode ? 'rgba(248,240,229,0.85)' : 'rgba(125,90,80,0.7)'}
                    />
                  </View>
                )}

                {isEditing && (
                  <TouchableOpacity
                    style={[styles.editPhotoButton, { backgroundColor: accentColor }]}
                    onPress={pickImage}
                  >
                    <IconSymbol name="camera.fill" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>

              <ThemedText style={styles.profileName}>
                {babyInfo.name?.trim() || 'Noch kein Name hinterlegt'}
              </ThemedText>
              <ThemedText style={[styles.profileHint, { color: hintColor }]}>
                Diese Angaben helfen uns, relevante Inhalte für dich zu kuratieren.
              </ThemedText>
            </View>

            {isEditing ? (
              <>
                <GlassCard
                  style={[styles.fieldCard, { borderColor: glassBorderColor }]}
                  overlayColor={fieldOverlay}
                >
                  <ThemedText style={[styles.fieldLabel, { color: labelColor }]}>
                    Name
                  </ThemedText>
                  <TextInput
                    style={[styles.textInput, { color: theme.textPrimary }]}
                    value={babyInfo.name}
                    onChangeText={(text) => setBabyInfo({ ...babyInfo, name: text })}
                    placeholder="Name des Babys"
                    placeholderTextColor={placeholderColor}
                  />
                </GlassCard>

                <GlassCard
                  style={[styles.fieldCard, { borderColor: glassBorderColor }]}
                  overlayColor={fieldOverlay}
                >
                  <ThemedText style={[styles.fieldLabel, { color: labelColor }]}>
                    Geburtsdatum
                  </ThemedText>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        borderColor: glassBorderColor,
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
                      },
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <ThemedText style={[styles.dateText, { color: theme.textPrimary }]}>
                      {birthDateLabel === 'Noch nicht festgelegt' ? 'Datum wählen' : birthDateLabel}
                    </ThemedText>
                    <IconSymbol name="calendar" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </GlassCard>

                {showDatePicker && (
                  <DateTimePicker
                    value={hasValidBirthDate ? parseBirthDate! : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    textColor={isDarkMode ? '#FFFFFF' : undefined}
                  />
                )}

                <View style={styles.fieldRow}>
                  <GlassCard
                    style={[
                      styles.fieldCard,
                      styles.fieldHalf,
                      styles.fieldHalfSpacing,
                      { borderColor: glassBorderColor },
                    ]}
                    overlayColor={fieldOverlay}
                  >
                    <ThemedText style={[styles.fieldLabel, { color: labelColor }]}>
                      Gewicht
                    </ThemedText>
                    <TextInput
                      style={[styles.textInput, { color: theme.textPrimary }]}
                      value={babyInfo.weight}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, weight: text })}
                      placeholder="z.B. 3250g"
                      placeholderTextColor={placeholderColor}
                    />
                  </GlassCard>

                  <GlassCard
                    style={[styles.fieldCard, styles.fieldHalf, { borderColor: glassBorderColor }]}
                    overlayColor={fieldOverlay}
                  >
                    <ThemedText style={[styles.fieldLabel, { color: labelColor }]}>
                      Größe
                    </ThemedText>
                    <TextInput
                      style={[styles.textInput, { color: theme.textPrimary }]}
                      value={babyInfo.height}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, height: text })}
                      placeholder="z.B. 52cm"
                      placeholderTextColor={placeholderColor}
                    />
                  </GlassCard>
                </View>

                <View style={styles.actionRow}>
                  <LiquidGlassCard
                    style={[styles.actionButton, styles.actionButtonSpacing]}
                    overlayColor={supportOverlay}
                    borderColor={glassBorderColor}
                    onPress={() => {
                      setIsEditing(false);
                      loadBabyInfo();
                    }}
                  >
                    <View style={styles.actionButtonInner}>
                      <IconSymbol
                        name="xmark.circle.fill"
                        size={20}
                        color={isDarkMode ? theme.textSecondary : theme.text}
                        style={styles.actionIcon}
                      />
                      <ThemedText style={[styles.actionButtonText, { color: theme.textPrimary }]}>
                        Abbrechen
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>

                  <LiquidGlassCard
                    style={styles.actionButton}
                    overlayColor={isDarkMode ? 'rgba(142,78,198,0.55)' : 'rgba(142,78,198,0.75)'}
                    borderColor="rgba(255,255,255,0.45)"
                    onPress={handleSave}
                  >
                    <View style={styles.actionButtonInner}>
                      <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" style={styles.actionIcon} />
                      <ThemedText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                        Speichern
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                </View>
              </>
            ) : (
              <>
                <View style={styles.metricsColumn}>
                  {metrics.map((metric, index) => (
                    <GlassCard
                      key={metric.label}
                      style={[
                        styles.metricCard,
                        index !== metrics.length - 1 && styles.metricCardSpacing,
                        { borderColor: glassBorderColor },
                      ]}
                      overlayColor={supportOverlay}
                    >
                      <ThemedText style={[styles.metricLabel, { color: labelColor }]}>
                        {metric.label}
                      </ThemedText>
                      <ThemedText style={[styles.metricValue, { color: theme.textPrimary }]}>
                        {metric.value}
                      </ThemedText>
                    </GlassCard>
                  ))}
                </View>

                {milestoneStatus && (
                  <GlassCard
                    style={[styles.statusCard, { borderColor: glassBorderColor }]}
                    overlayColor={supportOverlay}
                  >
                    <View style={styles.statusRow}>
                      <IconSymbol
                        name={milestoneStatus.icon}
                        size={22}
                        color={backgroundTaskStatus?.isRegistered ? '#6FCF97' : accentColor}
                      />
                      <View style={styles.statusCopy}>
                        <ThemedText style={[styles.statusTitle, { color: theme.textPrimary }]}>
                          {milestoneStatus.title}
                        </ThemedText>
                        <ThemedText style={[styles.statusText, { color: hintColor }]}>
                          {milestoneStatus.description}
                        </ThemedText>
                      </View>
                    </View>
                  </GlassCard>
                )}

                <LiquidGlassCard
                  style={styles.primaryButton}
                  overlayColor={isDarkMode ? 'rgba(142,78,198,0.46)' : 'rgba(142,78,198,0.68)'}
                  borderColor="rgba(255,255,255,0.45)"
                  onPress={() => setIsEditing(true)}
                >
                  <View style={styles.primaryButtonInner}>
                    <IconSymbol name="pencil" size={18} color="#FFFFFF" style={styles.primaryIcon} />
                    <ThemedText style={[styles.primaryButtonText, { color: '#FFFFFF' }]}>
                      Bearbeiten
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              </>
            )}
            </LiquidGlassCard>

            <LiquidGlassCard
              style={[styles.statsCard, { borderColor: glassBorderColor }]}
              overlayColor={supportOverlay}
              onPress={() => router.push({ pathname: '/baby-stats' } as any)}
            >
              <View style={styles.statsCardInner}>
                <View
                  style={[
                    styles.statsIcon,
                    {
                      backgroundColor: isDarkMode ? 'rgba(142,78,198,0.2)' : 'rgba(142,78,198,0.15)',
                    borderWidth: 1,
                    borderColor: glassBorderColor,
                  },
                ]}
              >
                <IconSymbol name="chart.bar.fill" size={24} color={accentColor} />
              </View>
              <View style={styles.statsCopyBlock}>
                <ThemedText style={[styles.statsTitle, { color: theme.textPrimary }]}>
                  Baby-Statistiken
                </ThemedText>
                <ThemedText style={[styles.statsSubtitle, { color: hintColor }]}>
                  Alter, Entwicklung, Meilensteine und interessante Fakten über dein Baby.
                </ThemedText>
              </View>
                <IconSymbol
                  name="chevron.right"
                  size={20}
                  color={isDarkMode ? theme.textSecondary : accentColor}
                />
              </View>
            </LiquidGlassCard>

            <GlassCard
              style={[styles.tipsCard, { borderColor: glassBorderColor }]}
              overlayColor={supportOverlay}
            >
              <ThemedText style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Die ersten Wochen
              </ThemedText>
              {FIRST_WEEKS_TIPS.map((tip) => (
                <View key={tip} style={styles.tipRow}>
                  <ThemedText style={[styles.tipBullet, { color: accentColor }]}>
                    •
                  </ThemedText>
                  <ThemedText style={[styles.tipText, { color: hintColor }]}>
                    {tip}
                  </ThemedText>
                </View>
              ))}
            </GlassCard>
          </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT_PAD,
  },
  loadingText: {
    marginTop: 18,
    fontSize: 16,
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 140,
    paddingTop: 10,
  },
  contentWrap: {
    alignSelf: 'center',
    width: contentWidth,
  },
  profileCard: {
    padding: 24,
    borderRadius: RADIUS,
    marginBottom: SECTION_GAP_TOP,
    alignSelf: 'stretch',
    marginHorizontal: TIMELINE_INSET,
  },
  profileTop: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoWrapper: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  babyPhoto: {
    width: '100%',
    height: '100%',
  },
  placeholderPhoto: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 16,
  },
  profileHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  metricsColumn: {
    width: '100%',
  },
  metricCard: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: RADIUS,
    width: '100%',
  },
  metricCardSpacing: {
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statusCard: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS,
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCopy: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: RADIUS,
    alignSelf: 'stretch',
    marginHorizontal: TIMELINE_INSET,
  },
  primaryButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  fieldCard: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: RADIUS,
    marginBottom: 14,
    width: '100%',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  textInput: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldHalfSpacing: {
    marginRight: 12,
  },
  dateButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS - 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: RADIUS,
  },
  actionButtonSpacing: {
    marginRight: 12,
  },
  actionButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsCard: {
    padding: 22,
    borderRadius: RADIUS,
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_TOP,
    alignSelf: 'stretch',
    marginHorizontal: TIMELINE_INSET,
  },
  statsCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statsCopyBlock: {
    flex: 1,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  statsSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  tipsCard: {
    padding: 22,
    borderRadius: RADIUS,
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_TOP,
    alignSelf: 'stretch',
    marginHorizontal: TIMELINE_INSET,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 16,
    lineHeight: 22,
    marginRight: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
