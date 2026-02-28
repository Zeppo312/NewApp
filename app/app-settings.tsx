import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator, Image, Linking, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Redirect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useConvex } from '@/contexts/ConvexContext';
import { useBackground } from '@/contexts/BackgroundContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getAppSettings, saveAppSettings, AppSettings } from '@/lib/supabase';
import { exportUserData } from '@/lib/dataExport';
import { deleteUserAccount, deleteUserData } from '@/lib/profile';
import { sleepActivityService } from '@/lib/sleepActivityService';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import { findFreshActiveSleepEntry } from '@/lib/sleepEntryGuards';
import {
  DEFAULT_NIGHT_WINDOW_SETTINGS,
  loadNightWindowSettings,
  saveNightWindowSettings,
} from '@/lib/nightWindowSettings';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

// Admin emails - nur diese User sehen Debug Tools
const ADMIN_EMAILS = [
  'jan.zepp1999@gmail.com',
  'anyhelptoolate@gmail.com',
];

const PRESET_OPTIONS = [
  { id: 'default', label: 'Standard' },
  { id: 'heller', label: 'Heller' },
  { id: 'dunkler', label: 'Dunkler' },
  { id: 'nightmode', label: 'Night Mode' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'wave', label: 'Wave' },
  { id: 'stone', label: 'Stone' },
] as const;

export default function AppSettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { user, session, signOut } = useAuth();
  const {
    autoDarkModeEnabled,
    autoDarkModeStartTime,
    autoDarkModeEndTime,
    setAutoDarkModeEnabled,
    setAutoDarkModeStartTime,
    setAutoDarkModeEndTime,
  } = useTheme();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAutoDark, setIsSavingAutoDark] = useState(false);
  const [isAutoDarkExpanded, setIsAutoDarkExpanded] = useState(false);
  const [showAutoDarkStartPicker, setShowAutoDarkStartPicker] = useState(false);
  const [showAutoDarkEndPicker, setShowAutoDarkEndPicker] = useState(false);
  const [nightWindowStartTime, setNightWindowStartTime] = useState(
    DEFAULT_NIGHT_WINDOW_SETTINGS.startTime
  );
  const [nightWindowEndTime, setNightWindowEndTime] = useState(
    DEFAULT_NIGHT_WINDOW_SETTINGS.endTime
  );
  const [isNightWindowExpanded, setIsNightWindowExpanded] = useState(false);
  const [showNightWindowStartPicker, setShowNightWindowStartPicker] = useState(false);
  const [showNightWindowEndPicker, setShowNightWindowEndPicker] = useState(false);
  const [isSavingNightWindow, setIsSavingNightWindow] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isChangingBackground, setIsChangingBackground] = useState(false);
  const [isSyncingLiveActivities, setIsSyncingLiveActivities] = useState(false);
  const [liveActivitiesStatusText, setLiveActivitiesStatusText] = useState('Status wird geladen...');

  // Convex context
  const { convexClient, lastSyncError } = useConvex();

  // Background context
  const {
    selectedBackground,
    backgroundSource,
    hasCustomBackground,
    isDarkBackground,
    pickAndSaveBackground,
    setPresetBackground,
    setBackgroundMode,
    resetToDefault,
  } = useBackground();

  // Notification sub-preferences
  const { preferences: notifPrefs, updatePreference: updateNotifPref } = useNotificationPreferences();

  // Check if current user is admin
  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email) : false;
  const isAutoDarkWindowActive = autoDarkModeEnabled && colorScheme === 'dark';
  const isBackgroundModeAutoSynced = isAutoDarkWindowActive;
  const effectiveIsDarkBackground = isBackgroundModeAutoSynced
    ? colorScheme === 'dark'
    : isDarkBackground;
  const useLightIcons = colorScheme === 'dark' || effectiveIsDarkBackground;
  const primaryIconColor = useLightIcons ? '#FFFFFF' : theme.accent;
  const trailingIconColor = useLightIcons ? 'rgba(255,255,255,0.9)' : theme.tabIconDefault;
  const autoDarkTimeTextColor = useLightIcons ? '#FFFFFF' : '#000000';

  // no extra width logic; match "Mehr" padding rhythm via ScrollView

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  useEffect(() => {
    if (focus === 'night-window') {
      setIsNightWindowExpanded(true);
    }
  }, [focus]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [{ data, error }, nightWindowSettings] = await Promise.all([
        getAppSettings(),
        loadNightWindowSettings(user?.id),
      ]);

      setNightWindowStartTime(nightWindowSettings.startTime);
      setNightWindowEndTime(nightWindowSettings.endTime);

      if (error) {
        console.error('Error loading app settings:', error);
        Alert.alert('Fehler', 'Einstellungen konnten nicht geladen werden.');
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load app settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatElapsedSeconds = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const refreshLiveActivitiesStatus = async (): Promise<string> => {
    if (!sleepActivityService.isLiveActivitySupported()) {
      const status = 'Auf diesem Gerät nicht verfügbar.';
      setLiveActivitiesStatusText(status);
      return status;
    }

    try {
      const current = await sleepActivityService.restoreCurrentActivity();
      if (current?.isTracking && current.startTime) {
        const startDate = new Date(current.startTime);
        const hasValidStart = Number.isFinite(startDate.getTime());
        const status =
          hasValidStart
            ? `Aktiv seit ${startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
            : 'Aktiv';
        setLiveActivitiesStatusText(status);
        return status;
      }

      const status = 'Keine aktive Anzeige oder in iOS deaktiviert.';
      setLiveActivitiesStatusText(status);
      return status;
    } catch (error) {
      console.error('Failed to refresh live activities status:', error);
      const status = 'Status konnte nicht geladen werden.';
      setLiveActivitiesStatusText(status);
      return status;
    }
  };

  const handleSaveSettings = async (updatedSettings: Partial<AppSettings>) => {
    try {
      setIsSaving(true);

      // Aktualisiere die lokalen Einstellungen sofort für bessere UX
      setSettings(prev => prev ? { ...prev, ...updatedSettings } : null);

      const { data, error } = await saveAppSettings(updatedSettings);

      if (error) {
        console.error('Error saving app settings:', error);
        Alert.alert('Fehler', 'Einstellungen konnten nicht gespeichert werden.');
        // Lade die Einstellungen neu, falls ein Fehler auftritt
        await loadSettings();
        return;
      }

      if (data) {
        // Aktualisiere die Einstellungen mit den vom Server zurückgegebenen Daten
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to save app settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    await handleSaveSettings({ notifications_enabled: value });
  };

  const handleToggleAutoDarkMode = async (value: boolean) => {
    try {
      setIsSavingAutoDark(true);
      await setAutoDarkModeEnabled(value);
    } finally {
      setIsSavingAutoDark(false);
    }
  };

  const getDateFromTimeString = (time: string) => {
    const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    const date = new Date();
    if (!match) {
      date.setHours(20, 0, 0, 0);
      return date;
    }
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return date;
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleAutoDarkStartTimeChange = async (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowAutoDarkStartPicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    try {
      setIsSavingAutoDark(true);
      await setAutoDarkModeStartTime(formatTime(selectedDate));
    } finally {
      setIsSavingAutoDark(false);
    }
  };

  const handleAutoDarkEndTimeChange = async (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowAutoDarkEndPicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    try {
      setIsSavingAutoDark(true);
      await setAutoDarkModeEndTime(formatTime(selectedDate));
    } finally {
      setIsSavingAutoDark(false);
    }
  };

  const updateNightWindowSettings = async (nextStartTime: string, nextEndTime: string) => {
    if (nextStartTime === nextEndTime) {
      Alert.alert('Ungültige Zeit', 'Start und Ende dürfen nicht identisch sein.');
      return;
    }

    try {
      setIsSavingNightWindow(true);
      const saved = await saveNightWindowSettings(
        { startTime: nextStartTime, endTime: nextEndTime },
        user?.id,
      );
      setNightWindowStartTime(saved.startTime);
      setNightWindowEndTime(saved.endTime);
    } catch (error) {
      console.error('Failed to save night window settings:', error);
      Alert.alert('Fehler', 'Nachtschlaf-Zeitfenster konnte nicht gespeichert werden.');
      const restored = await loadNightWindowSettings(user?.id);
      setNightWindowStartTime(restored.startTime);
      setNightWindowEndTime(restored.endTime);
    } finally {
      setIsSavingNightWindow(false);
    }
  };

  const handleNightWindowStartTimeChange = async (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowNightWindowStartPicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }
    await updateNightWindowSettings(formatTime(selectedDate), nightWindowEndTime);
  };

  const handleNightWindowEndTimeChange = async (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowNightWindowEndPicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }
    await updateNightWindowSettings(nightWindowStartTime, formatTime(selectedDate));
  };

  const handleChangeBackground = async () => {
    if (isChangingBackground) return;

    try {
      setIsChangingBackground(true);
      const result = await pickAndSaveBackground();

      if (result.error) {
        if (result.error === 'Zugriff auf Fotos wurde verweigert') {
          Alert.alert(
            'Fotos-Zugriff benötigt',
            'Bitte erlaube den Fotozugriff in den Einstellungen, um ein Hintergrundbild auszuwählen.',
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Einstellungen öffnen',
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.error('Failed to open app settings:', error);
                    Alert.alert('Fehler', 'Einstellungen konnten nicht geöffnet werden.');
                  }
                },
              },
            ],
          );
          return;
        }

        Alert.alert('Fehler', result.error);
        return;
      }

      // Nach erfolgreicher Bildauswahl: Helligkeit abfragen
      if (result.success && result.needsModeSelection) {
        Alert.alert(
          'Bildhelligkeit',
          'Ist dein Hintergrundbild eher hell oder dunkel? Dies passt die Textfarben an.',
          [
            {
              text: 'Hell',
              onPress: () => setBackgroundMode(false),
            },
            {
              text: 'Dunkel',
              onPress: () => setBackgroundMode(true),
            },
          ]
        );
      }
    } catch (err) {
      console.error('Error changing background:', err);
      Alert.alert('Fehler', 'Hintergrundbild konnte nicht geändert werden.');
    } finally {
      setIsChangingBackground(false);
    }
  };

  const handleResetBackground = async () => {
    if (isChangingBackground) return;

    Alert.alert(
      'Hintergrund zurücksetzen',
      'Möchtest du zum Standard-Hintergrundbild zurückkehren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          onPress: async () => {
            try {
              setIsChangingBackground(true);
              const result = await resetToDefault();

              if (result.error) {
                Alert.alert('Fehler', result.error);
              }
            } catch (err) {
              console.error('Error resetting background:', err);
              Alert.alert('Fehler', 'Hintergrundbild konnte nicht zurückgesetzt werden.');
            } finally {
              setIsChangingBackground(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Failed to open app settings:', error);
      Alert.alert('Fehler', 'Einstellungen konnten nicht geöffnet werden.');
    }
  };

  const handleSyncLiveActivities = async () => {
    if (isSyncingLiveActivities) return;

    if (!sleepActivityService.isLiveActivitySupported()) {
      setLiveActivitiesStatusText('Auf diesem Gerät nicht verfügbar.');
      Alert.alert(
        'Live Activities',
        'Live Activities werden auf diesem Gerät oder in diesem Build nicht unterstützt.'
      );
      return;
    }

    try {
      setIsSyncingLiveActivities(true);

      const { success, entries } = await loadAllVisibleSleepEntries();
      if (!success || !entries) {
        throw new Error('Schlafdaten konnten nicht geladen werden.');
      }

      const activeEntry = findFreshActiveSleepEntry(entries);

      if (!activeEntry?.start_time) {
        await sleepActivityService.endAllSleepActivities();
        setLiveActivitiesStatusText('Kein aktiver Schlaf. Keine Live Activity aktiv.');
        Alert.alert('Live Activities', 'Es läuft aktuell kein Schlaftracking.');
        return;
      }

      const startDate = new Date(activeEntry.start_time);
      if (!Number.isFinite(startDate.getTime())) {
        throw new Error('Ungültige Startzeit beim aktiven Schlaf.');
      }

      // Prüfe ob bereits eine native Live Activity läuft
      const existing = await sleepActivityService.restoreCurrentActivity();

      let needsNewActivity = !existing;

      // Falls bestehende Activity zu einer anderen Session gehört → beenden
      if (existing) {
        const existingStart = new Date(existing.startTime).getTime();
        const dbStart = startDate.getTime();
        if (!Number.isFinite(existingStart) || Math.abs(existingStart - dbStart) >= 2000) {
          await sleepActivityService.endAllSleepActivities();
          needsNewActivity = true;
        }
      }

      if (needsNewActivity) {
        const startedId = await sleepActivityService.startSleepActivity(startDate);
        if (!startedId) {
          setLiveActivitiesStatusText('In iOS deaktiviert oder derzeit nicht verfügbar.');
          Alert.alert(
            'Live Activities',
            'Die Anzeige konnte nicht gestartet werden. Bitte prüfe die iOS-Einstellungen.'
          );
          return;
        }
      }

      // Bestehende oder neu gestartete Activity mit aktueller Zeit updaten
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 1000));
      await sleepActivityService.updateSleepActivity(formatElapsedSeconds(elapsedSeconds));

      setLiveActivitiesStatusText(
        `Aktiv seit ${startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
      );
      Alert.alert('Live Activities', 'Die Anzeige wurde synchronisiert.');
    } catch (error) {
      console.error('Failed to synchronize live activities:', error);
      setLiveActivitiesStatusText('Synchronisierung fehlgeschlagen.');
      Alert.alert('Fehler', 'Live Activities konnten nicht synchronisiert werden.');
    } finally {
      setIsSyncingLiveActivities(false);
    }
  };

  const handleOpenLiveActivitiesPopup = async () => {
    const status = await refreshLiveActivitiesStatus();
    const message = [
      `Status: ${status}`,
      '',
      '• Zeigt Schlafzeit auf Sperrbildschirm an.',
      '• Dynamic Island nur auf unterstützten iPhones.',
      '• Bei aktivem Schlaf kannst du neu synchronisieren.',
    ].join('\n');

    Alert.alert(
      'Live Activities',
      message,
      [
        { text: 'Schließen', style: 'cancel' },
        { text: 'iOS-Einstellungen', onPress: () => void handleOpenSystemSettings() },
        { text: 'Synchronisieren', onPress: () => void handleSyncLiveActivities() },
      ],
      { cancelable: true }
    );
  };

  const handleExportData = async () => {
    if (!user) {
      Alert.alert('Fehler', 'Bitte melde dich erneut an.');
      return;
    }

    try {
      setIsExporting(true);
      const result = await exportUserData('pdf');

      if (!result.success) {
        Alert.alert('Fehler', result.error ?? 'Datenexport fehlgeschlagen.');
        return;
      }

      const totalRecords = result.summary
        ? Object.values(result.summary).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0)
        : undefined;
      const sizeKb = result.bytesWritten ? (result.bytesWritten / 1024).toFixed(1) : null;
      const warningText = result.warnings && result.warnings.length
        ? `\n\nHinweise:\n- ${result.warnings.slice(0, 3).join('\n- ')}`
        : '';
      const locationHint = result.shared || !result.fileUri
        ? ''
        : `\n\nDatei gespeichert unter:\n${result.fileUri}`;

      Alert.alert(
        'Export abgeschlossen',
        `Deine Daten wurden als PDF vorbereitet${totalRecords !== undefined ? ` (${totalRecords} Einträge)` : ''}${sizeKb ? `, ca. ${sizeKb} KB` : ''}.${locationHint}${warningText}`
      );
    } catch (err) {
      console.error('Failed to export data:', err);
      Alert.alert('Fehler', 'Datenexport fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsExporting(false);
    }
  };

  const runDeleteDataFlow = async (deleteAccount: boolean) => {
    if (!user) {
      Alert.alert('Fehler', 'Bitte melde dich erneut an.');
      return;
    }

    try {
      setIsDeletingData(true);
      const { error } = deleteAccount ? await deleteUserAccount() : await deleteUserData();
      if (error) throw error;

      if (deleteAccount) {
        Alert.alert(
          'Konto gelöscht',
          'Dein Profil und Konto wurden gelöscht. Du wirst jetzt abgemeldet.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await signOut();
              },
            },
          ],
        );
        return;
      }

      await loadSettings();
      Alert.alert('Daten gelöscht', 'Deine gespeicherten Daten wurden entfernt.');
    } catch (err: any) {
      console.error('Failed to delete user data:', err);
      Alert.alert('Fehler', err?.message || 'Daten konnten nicht gelöscht werden.');
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleDeleteDataRequest = () => {
    if (isDeletingData) return;
    Alert.alert(
      'Daten löschen',
      'Möchtest du wirklich alle deine Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Weiter',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Konto ebenfalls löschen?',
              'Soll dein Konto auch dauerhaft gelöscht werden?',
              [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Nur Daten löschen', style: 'destructive', onPress: () => runDeleteDataFlow(false) },
                { text: 'Daten + Konto löschen', style: 'destructive', onPress: () => runDeleteDataFlow(true) },
              ],
            );
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!user) {
      setLiveActivitiesStatusText('Bitte anmelden.');
      return;
    }

    void refreshLiveActivitiesStatus();
  }, [user?.id]);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          <View style={styles.container}>
            <Header
              title="App-Einstellungen"
              subtitle="Benachrichtigungen und mehr"
              showBackButton
              onBackPress={() => router.push('/more')}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <ThemedText style={styles.loadingText}>Einstellungen werden geladen...</ThemedText>
                </View>
              ) : (
                <View style={styles.contentWrap}>
                {settings ? (
                <>
                  {/* Benachrichtigungen-Einstellungen */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Benachrichtigungen</ThemedText>

                    <View style={styles.rowItem}>
                      <View style={styles.rowIcon}>
                        <IconSymbol name="bell" size={24} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Benachrichtigungen aktivieren</ThemedText>
                        <ThemedText style={styles.rowDescription}>Erhalte wichtige Erinnerungen und Updates</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        <Switch
                          value={settings.notifications_enabled}
                          onValueChange={handleToggleNotifications}
                          disabled={isSaving}
                          trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                          thumbColor={settings.notifications_enabled ? '#FFFFFF' : '#F4F4F4'}
                          ios_backgroundColor="#D1D1D6"
                        />
                      </View>
                    </View>

                    {settings.notifications_enabled && (
                      <>
                        <View style={styles.rowItem}>
                          <View style={styles.rowIcon}>
                            <IconSymbol name="moon.zzz" size={22} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>Schlaffenster-Erinnerung</ThemedText>
                            <ThemedText style={styles.rowDescription}>Benachrichtigung vor dem nächsten Schlaffenster</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <Switch
                              value={notifPrefs.sleepWindowReminder}
                              onValueChange={(v) => updateNotifPref('sleepWindowReminder', v)}
                              trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                              thumbColor={notifPrefs.sleepWindowReminder ? '#FFFFFF' : '#F4F4F4'}
                              ios_backgroundColor="#D1D1D6"
                            />
                          </View>
                        </View>

                        <View style={styles.rowItem}>
                          <View style={styles.rowIcon}>
                            <ThemedText style={{ fontSize: 22 }}>🍼</ThemedText>
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>Fütterungs-Erinnerung</ThemedText>
                            <ThemedText style={styles.rowDescription}>Benachrichtigung wenn es Zeit zum Füttern wird</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <Switch
                              value={notifPrefs.feedingReminder}
                              onValueChange={(v) => updateNotifPref('feedingReminder', v)}
                              trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                              thumbColor={notifPrefs.feedingReminder ? '#FFFFFF' : '#F4F4F4'}
                              ios_backgroundColor="#D1D1D6"
                            />
                          </View>
                        </View>
                      </>
                    )}

                  </LiquidGlassCard>

                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Schlaftracking</ThemedText>

                    <TouchableOpacity
                      style={styles.rowItem}
                      onPress={() => setIsNightWindowExpanded((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="moon.zzz" size={22} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Nachtschlaf-Zeitfenster</ThemedText>
                        <ThemedText style={styles.rowDescription}>
                          Von {nightWindowStartTime} bis {nightWindowEndTime} Uhr
                        </ThemedText>
                      </View>
                      <View style={styles.autoDarkTrailing}>
                        {isSavingNightWindow ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : null}
                        <IconSymbol
                          name={isNightWindowExpanded ? 'chevron.up' : 'chevron.down'}
                          size={18}
                          color={trailingIconColor}
                        />
                      </View>
                    </TouchableOpacity>

                    {isNightWindowExpanded && (
                      <View style={styles.autoDarkScheduleContainer}>
                        <View style={styles.autoDarkScheduleHeader}>
                          <ThemedText style={styles.autoDarkScheduleLabel}>Zeitfenster</ThemedText>
                          {isSavingNightWindow && <ActivityIndicator size="small" color={theme.accent} />}
                        </View>

                        <View style={styles.autoDarkTimeRow}>
                          <ThemedText style={styles.autoDarkTimeTitle}>Von</ThemedText>
                          <TouchableOpacity
                            style={styles.autoDarkTimeButton}
                            onPress={() => setShowNightWindowStartPicker(true)}
                            disabled={isSavingNightWindow}
                          >
                            <ThemedText style={[styles.autoDarkTimeButtonText, { color: autoDarkTimeTextColor }]}>
                              {nightWindowStartTime}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.autoDarkTimeRow}>
                          <ThemedText style={styles.autoDarkTimeTitle}>Bis</ThemedText>
                          <TouchableOpacity
                            style={styles.autoDarkTimeButton}
                            onPress={() => setShowNightWindowEndPicker(true)}
                            disabled={isSavingNightWindow}
                          >
                            <ThemedText style={[styles.autoDarkTimeButtonText, { color: autoDarkTimeTextColor }]}>
                              {nightWindowEndTime}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>

                        {showNightWindowStartPicker && (
                          <View style={styles.autoDarkPickerContainer}>
                            <DateTimePicker
                              mode="time"
                              value={getDateFromTimeString(nightWindowStartTime)}
                              onChange={handleNightWindowStartTimeChange}
                              is24Hour
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              themeVariant={useLightIcons ? 'dark' : 'light'}
                              textColor={Platform.OS === 'ios' ? autoDarkTimeTextColor : undefined}
                            />
                            {Platform.OS === 'ios' && (
                              <TouchableOpacity
                                style={styles.autoDarkPickerDone}
                                onPress={() => setShowNightWindowStartPicker(false)}
                              >
                                <ThemedText style={styles.autoDarkPickerDoneText}>Fertig</ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        {showNightWindowEndPicker && (
                          <View style={styles.autoDarkPickerContainer}>
                            <DateTimePicker
                              mode="time"
                              value={getDateFromTimeString(nightWindowEndTime)}
                              onChange={handleNightWindowEndTimeChange}
                              is24Hour
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              themeVariant={useLightIcons ? 'dark' : 'light'}
                              textColor={Platform.OS === 'ios' ? autoDarkTimeTextColor : undefined}
                            />
                            {Platform.OS === 'ios' && (
                              <TouchableOpacity
                                style={styles.autoDarkPickerDone}
                                onPress={() => setShowNightWindowEndPicker(false)}
                              >
                                <ThemedText style={styles.autoDarkPickerDoneText}>Fertig</ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </LiquidGlassCard>

                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Darstellung</ThemedText>

                    <TouchableOpacity
                      style={styles.rowItem}
                      onPress={() => setIsAutoDarkExpanded((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="moon.stars" size={22} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Auto-Dunkelmodus</ThemedText>
                        <ThemedText style={styles.rowDescription}>
                          Aktiv von {autoDarkModeStartTime} bis {autoDarkModeEndTime} Uhr.
                        </ThemedText>
                      </View>
                      <View style={styles.autoDarkTrailing}>
                        <Switch
                          value={autoDarkModeEnabled}
                          onValueChange={handleToggleAutoDarkMode}
                          disabled={isSavingAutoDark}
                          trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                          thumbColor={autoDarkModeEnabled ? '#FFFFFF' : '#F4F4F4'}
                          ios_backgroundColor="#D1D1D6"
                        />
                        <IconSymbol
                          name={isAutoDarkExpanded ? 'chevron.up' : 'chevron.down'}
                          size={18}
                          color={trailingIconColor}
                        />
                      </View>
                    </TouchableOpacity>

                    {isAutoDarkExpanded && (
                      <View style={styles.autoDarkScheduleContainer}>
                        <View style={styles.autoDarkScheduleHeader}>
                          <ThemedText style={styles.autoDarkScheduleLabel}>Zeitfenster</ThemedText>
                          {isSavingAutoDark && <ActivityIndicator size="small" color={theme.accent} />}
                        </View>

                        <View style={styles.autoDarkTimeRow}>
                          <ThemedText style={styles.autoDarkTimeTitle}>Von</ThemedText>
                          <TouchableOpacity
                            style={styles.autoDarkTimeButton}
                            onPress={() => setShowAutoDarkStartPicker(true)}
                            disabled={isSavingAutoDark}
                          >
                            <ThemedText style={[styles.autoDarkTimeButtonText, { color: autoDarkTimeTextColor }]}>
                              {autoDarkModeStartTime}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.autoDarkTimeRow}>
                          <ThemedText style={styles.autoDarkTimeTitle}>Bis</ThemedText>
                          <TouchableOpacity
                            style={styles.autoDarkTimeButton}
                            onPress={() => setShowAutoDarkEndPicker(true)}
                            disabled={isSavingAutoDark}
                          >
                            <ThemedText style={[styles.autoDarkTimeButtonText, { color: autoDarkTimeTextColor }]}>
                              {autoDarkModeEndTime}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>

                        {showAutoDarkStartPicker && (
                          <View style={styles.autoDarkPickerContainer}>
                            <DateTimePicker
                              mode="time"
                              value={getDateFromTimeString(autoDarkModeStartTime)}
                              onChange={handleAutoDarkStartTimeChange}
                              is24Hour
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              themeVariant={useLightIcons ? 'dark' : 'light'}
                              textColor={Platform.OS === 'ios' ? autoDarkTimeTextColor : undefined}
                            />
                            {Platform.OS === 'ios' && (
                              <TouchableOpacity
                                style={styles.autoDarkPickerDone}
                                onPress={() => setShowAutoDarkStartPicker(false)}
                              >
                                <ThemedText style={styles.autoDarkPickerDoneText}>Fertig</ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        {showAutoDarkEndPicker && (
                          <View style={styles.autoDarkPickerContainer}>
                            <DateTimePicker
                              mode="time"
                              value={getDateFromTimeString(autoDarkModeEndTime)}
                              onChange={handleAutoDarkEndTimeChange}
                              is24Hour
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              themeVariant={useLightIcons ? 'dark' : 'light'}
                              textColor={Platform.OS === 'ios' ? autoDarkTimeTextColor : undefined}
                            />
                            {Platform.OS === 'ios' && (
                              <TouchableOpacity
                                style={styles.autoDarkPickerDone}
                                onPress={() => setShowAutoDarkEndPicker(false)}
                              >
                                <ThemedText style={styles.autoDarkPickerDoneText}>Fertig</ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </LiquidGlassCard>

                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <TouchableOpacity
                      style={[styles.rowItem, isSyncingLiveActivities && styles.disabledRow]}
                      onPress={handleOpenLiveActivitiesPopup}
                      disabled={isSyncingLiveActivities}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="moon.zzz" size={22} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Live Activities</ThemedText>
                        <ThemedText style={styles.rowDescription}>Status und Optionen anzeigen</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        {isSyncingLiveActivities ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                        )}
                      </View>
                    </TouchableOpacity>
                  </LiquidGlassCard>

                  {/* Hintergrundbild */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Hintergrundbild</ThemedText>

                    {/* Vorschau */}
                    <View style={styles.backgroundPreviewContainer}>
                      <Image
                        source={backgroundSource}
                        style={styles.backgroundPreview}
                        resizeMode={hasCustomBackground ? 'cover' : 'repeat'}
                      />
                      <View style={styles.backgroundPreviewOverlay}>
                        <ThemedText style={styles.backgroundPreviewLabel}>
                          {selectedBackground === 'custom'
                            ? `Eigenes Bild (${isDarkBackground ? 'dunkel' : 'hell'})`
                            : PRESET_OPTIONS.find(option => option.id === selectedBackground)?.label ?? 'Standard'}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.backgroundPresetRow}>
                      {PRESET_OPTIONS.map((option) => {
                        const isSelected = selectedBackground === option.id;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[
                              styles.backgroundPresetButton,
                              isSelected && {
                                borderColor: theme.accent,
                                backgroundColor: `${theme.accent}22`,
                              },
                            ]}
                            onPress={() => void setPresetBackground(option.id)}
                          >
                            <ThemedText
                              style={[
                                styles.backgroundPresetButtonLabel,
                                isSelected && { color: theme.accent, fontWeight: '700' },
                              ]}
                            >
                              {option.label}
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={[styles.rowItem, isChangingBackground && styles.disabledRow]}
                      onPress={handleChangeBackground}
                      disabled={isChangingBackground}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="photo" size={24} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Hintergrund ändern</ThemedText>
                        <ThemedText style={styles.rowDescription}>Wähle ein eigenes Bild aus deiner Galerie</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        {isChangingBackground ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {hasCustomBackground && (
                      <>
                        <TouchableOpacity
                          style={styles.rowItem}
                          onPress={() => {
                            if (isBackgroundModeAutoSynced) {
                              Alert.alert(
                                'Auto-Dunkelmodus aktiv',
                                'Die Textfarbe wird automatisch durch den Auto-Dunkelmodus gesteuert. Deaktiviere ihn unter "Darstellung", um die Textfarbe manuell anzupassen.'
                              );
                              return;
                            }
                            void setBackgroundMode(!effectiveIsDarkBackground);
                          }}
                        >
                          <View style={styles.rowIcon}>
                            <IconSymbol name={effectiveIsDarkBackground ? 'sun.max' : 'moon'} size={24} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>Textfarbe anpassen</ThemedText>
                            <ThemedText style={styles.rowDescription}>
                              {isBackgroundModeAutoSynced
                                ? `Automatisch: ${effectiveIsDarkBackground ? 'Heller Text (dunkles Bild)' : 'Dunkler Text (helles Bild)'}`
                                : `Aktuell: ${effectiveIsDarkBackground ? 'Heller Text (dunkles Bild)' : 'Dunkler Text (helles Bild)'}`}
                            </ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <IconSymbol name="arrow.left.arrow.right" size={20} color={trailingIconColor} />
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.rowItem, isChangingBackground && styles.disabledRow]}
                          onPress={handleResetBackground}
                          disabled={isChangingBackground}
                        >
                          <View style={styles.rowIcon}>
                            <IconSymbol name="arrow.counterclockwise" size={24} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>Zurücksetzen</ThemedText>
                            <ThemedText style={styles.rowDescription}>Standard-Hintergrundbild wiederherstellen</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                  </LiquidGlassCard>

                  {/* Daten verwalten */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <ThemedText style={styles.sectionTitle}>Daten verwalten</ThemedText>

                    <TouchableOpacity
                      style={[styles.rowItem, isExporting && styles.disabledRow]}
                      onPress={handleExportData}
                      disabled={isExporting}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="arrow.down.doc" size={24} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>Daten exportieren</ThemedText>
                        <ThemedText style={styles.rowDescription}>Exportiere deine Daten als Backup</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        {isExporting ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                        )}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.rowItem, isDeletingData && styles.disabledRow]}
                      onPress={handleDeleteDataRequest}
                      disabled={isDeletingData}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="trash" size={24} color="#FF6B6B" />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={[styles.rowTitle, styles.dangerText]}>Alle Daten löschen</ThemedText>
                        <ThemedText style={styles.rowDescription}>Lösche alle deine gespeicherten Daten</ThemedText>
                      </View>
                      <View style={styles.trailing}>
                        {isDeletingData ? (
                          <ActivityIndicator size="small" color="#FF6B6B" />
                        ) : (
                          <IconSymbol name="chevron.right" size={20} color="#FF6B6B" />
                        )}
                      </View>
                    </TouchableOpacity>
                  </LiquidGlassCard>

                  {/* Debug Tools - nur für Admins */}
                  {isAdmin && (
                    <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                      <ThemedText style={styles.sectionTitle}>🐛 Debug Tools (Admin)</ThemedText>

                      <TouchableOpacity
                        style={styles.rowItem}
                        onPress={() => router.push('/debug-notifications')}
                      >
                        <View style={styles.rowIcon}>
                          <ThemedText style={{ fontSize: 24 }}>🔔</ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText style={styles.rowTitle}>Debug Notifications</ThemedText>
                          <ThemedText style={styles.rowDescription}>Benachrichtigungen testen und debuggen</ThemedText>
                        </View>
                        <View style={styles.trailing}>
                          <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                        </View>
                      </TouchableOpacity>

                      {/* Convex Status Info */}
                      <View style={[styles.rowItem, styles.infoRow]}>
                        <View style={styles.rowIcon}>
                          <ThemedText style={{ fontSize: 24 }}>ℹ️</ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText style={styles.rowTitle}>Convex Status</ThemedText>
                          <ThemedText style={[styles.rowDescription, { fontSize: 11 }]}>
                            Client: {convexClient ? '✅ Bereit' : '❌ Nicht verfügbar'}
                            {lastSyncError && `\n❌ Fehler: ${lastSyncError.message.substring(0, 50)}...`}
                          </ThemedText>
                        </View>
                      </View>
                    </LiquidGlassCard>
                  )}
                </>
              ) : (
                <LiquidGlassCard style={[styles.sectionCard, styles.errorContainerGlass]} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <IconSymbol name="exclamationmark.triangle" size={40} color="#FF6B6B" />
                  <ThemedText style={styles.errorText}>
                    Einstellungen konnten nicht geladen werden
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: theme.accent }]}
                    onPress={loadSettings}
                  >
                    <ThemedText style={styles.retryButtonText}>
                      Erneut versuchen
                    </ThemedText>
                  </TouchableOpacity>
                  </LiquidGlassCard>
              )}
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
  },
  contentWrap: {
    width: '100%',
  },

  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  sectionCard: { marginBottom: 16, borderRadius: 22, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)'
  },
  rowIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowDescription: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  trailing: { marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
  autoDarkTrailing: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autoDarkScheduleContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  autoDarkScheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoDarkScheduleLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  autoDarkTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  autoDarkTimeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  autoDarkTimeButton: {
    minWidth: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoDarkTimeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  autoDarkPickerContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  autoDarkPickerDone: {
    alignSelf: 'flex-end',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(157,190,187,0.2)',
  },
  autoDarkPickerDoneText: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedThemeButton: {
    borderColor: '#9DBEBB',
    backgroundColor: '#9DBEBB',
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedThemeButtonText: {
    color: '#FFFFFF',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  disabledRow: {
    opacity: 0.6,
  },
  dangerText: {
    color: '#FF6B6B',
  },
  backgroundPreviewContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    height: 120,
    position: 'relative',
  },
  backgroundPreview: {
    width: '100%',
    height: '100%',
  },
  backgroundPreviewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backgroundPreviewLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  backgroundPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backgroundPresetButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backgroundPresetButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    borderBottomWidth: 0,
  },
  errorContainerGlass: {
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
