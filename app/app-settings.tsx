import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator, Image, Linking, Platform, Share } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Redirect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useConvex } from '@/contexts/ConvexContext';
import { useBackground } from '@/contexts/BackgroundContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getAppSettings, saveAppSettings, AppSettings } from '@/lib/supabase';
import { getCachedUserProfile } from '@/lib/appCache';
import { exportUserData } from '@/lib/dataExport';
import {
  deleteUserAccount,
  deleteUserData,
  getAccountDeletionRequirements,
} from '@/lib/profile';
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
import { useNotifications } from '@/hooks/useNotifications';
import { formatVitaminDReminderTime } from '@/lib/vitaminDReminder';
import {
  getSubscriptionManagementStoreLabel,
  openSubscriptionManagement,
} from '@/lib/subscriptionManagement';
import { buildSleepDebugSnapshot, serializeSleepDebugSnapshot } from '@/lib/sleepDebug';
import { hasFeatureAccess } from '@/lib/entitlements';
import {
  AppSettingsTranslationKey,
  DEFAULT_APP_SETTINGS_LOCALE,
  getAppSettingsLocaleTag,
  translateAppSettingsText,
} from '@/lib/appSettingsTranslations';

const PRESET_OPTIONS = [
  { id: 'default', labelKey: 'background.preset.default' },
  { id: 'verspielt', labelKey: 'background.preset.playful' },
  { id: 'dunkler', labelKey: 'background.preset.darker' },
  { id: 'nightmode', labelKey: 'background.preset.night' },
  { id: 'shadow', labelKey: 'background.preset.shadow' },
  { id: 'wave', labelKey: 'background.preset.wave' },
  { id: 'stone', labelKey: 'background.preset.stone' },
] as const;

const ACTIVE_APP_SETTINGS_LOCALE = DEFAULT_APP_SETTINGS_LOCALE;
const APP_SETTINGS_LOCALE_TAG = getAppSettingsLocaleTag(ACTIVE_APP_SETTINGS_LOCALE);
const t = (
  key: AppSettingsTranslationKey,
  params?: Record<string, string | number>,
) => translateAppSettingsText(ACTIVE_APP_SETTINGS_LOCALE, key, params);

export default function AppSettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { user, session, signOut } = useAuth();
  const { activeBabyId } = useActiveBaby();
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
  const [isNotificationsExpanded, setIsNotificationsExpanded] = useState(true);
  const [showVitaminDTimePicker, setShowVitaminDTimePicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isChangingBackground, setIsChangingBackground] = useState(false);
  const [isSyncingLiveActivities, setIsSyncingLiveActivities] = useState(false);
  const [liveActivitiesStatusText, setLiveActivitiesStatusText] = useState(t('live.statusLoading'));
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExportingSleepDebug, setIsExportingSleepDebug] = useState(false);

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
  const {
    preferences: notifPrefs,
    updatePreference: updateNotifPref,
    updatePreferences: updateNotifPrefs,
  } = useNotificationPreferences();
  const { requestPermissions } = useNotifications();

  const isAutoDarkWindowActive = autoDarkModeEnabled && colorScheme === 'dark';
  const isBackgroundModeAutoSynced = isAutoDarkWindowActive;
  const effectiveIsDarkBackground = isBackgroundModeAutoSynced
    ? colorScheme === 'dark'
    : isDarkBackground;
  const useLightIcons = colorScheme === 'dark' || effectiveIsDarkBackground;
  const primaryIconColor = useLightIcons ? '#FFFFFF' : theme.accent;
  const trailingIconColor = useLightIcons ? 'rgba(255,255,255,0.9)' : theme.tabIconDefault;
  const autoDarkTimeTextColor = useLightIcons ? '#FFFFFF' : '#000000';
  const vitaminDTimeLabel = formatVitaminDReminderTime(
    APP_SETTINGS_LOCALE_TAG,
    notifPrefs.vitaminDReminderHour,
    notifPrefs.vitaminDReminderMinute,
  );
  const activeNotificationTypes = [
    notifPrefs.sleepWindowReminder,
    notifPrefs.feedingReminder,
    notifPrefs.vitaminDReminder,
    notifPrefs.partnerActivity,
    notifPrefs.plannerReminder,
  ].filter(Boolean).length;

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
    if (focus === 'notifications') {
      setIsNotificationsExpanded(true);
    }
  }, [focus]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [{ data, error }, nightWindowSettings, profile] = await Promise.all([
        getAppSettings(),
        loadNightWindowSettings(user?.id),
        getCachedUserProfile(),
      ]);

      setNightWindowStartTime(nightWindowSettings.startTime);
      setNightWindowEndTime(nightWindowSettings.endTime);
      setIsAdmin(profile?.is_admin === true);

      if (error) {
        console.error('Error loading app settings:', error);
        Alert.alert(t('common.error'), t('settings.loadFailed'));
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
      const status = t('live.unavailable');
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
            ? t('live.activeSince', {
                time: startDate.toLocaleTimeString(APP_SETTINGS_LOCALE_TAG, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            : t('live.active');
        setLiveActivitiesStatusText(status);
        return status;
      }

      const status = t('live.none');
      setLiveActivitiesStatusText(status);
      return status;
    } catch (error) {
      console.error('Failed to refresh live activities status:', error);
      const status = t('live.statusFailed');
      setLiveActivitiesStatusText(status);
      return status;
    }
  };

  const handleExportSleepDebug = async () => {
    if (!user?.id) {
      Alert.alert(t('common.error'), t('auth.mustSignIn'));
      return;
    }

    try {
      setIsExportingSleepDebug(true);
      const snapshot = await buildSleepDebugSnapshot(user.id, activeBabyId);
      const payload = serializeSleepDebugSnapshot(snapshot);

      await Share.share({
        title: t('debug.shareTitle'),
        message: payload,
      });
    } catch (error) {
      console.error('Failed to export sleep debug snapshot:', error);
      Alert.alert(t('common.error'), t('debug.exportFailed'));
    } finally {
      setIsExportingSleepDebug(false);
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
        Alert.alert(t('common.error'), t('settings.saveFailed'));
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
    if (value) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          t('notifications.systemMissingTitle'),
          t('notifications.systemMissingMessage'),
          [
            { text: t('common.later'), style: 'cancel' },
            { text: t('common.systemSettings'), onPress: () => void handleOpenSystemSettings() },
          ],
        );
      }
    }
  };

  const handleToggleNotificationPreference = async (
    key:
      | 'sleepWindowReminder'
      | 'feedingReminder'
      | 'vitaminDReminder'
      | 'partnerActivity'
      | 'plannerReminder',
    value: boolean,
  ) => {
    try {
      await updateNotifPref(key, value);
    } catch (error) {
      console.error('Failed to save notification preference:', error);
      Alert.alert(t('common.error'), t('notifications.saveFailed'));
      return;
    }

    if (value && settings?.notifications_enabled) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          t('notifications.systemMissingTitle'),
          t('notifications.categorySavedMessage'),
          [
            { text: t('common.later'), style: 'cancel' },
            { text: t('common.systemSettings'), onPress: () => void handleOpenSystemSettings() },
          ],
        );
      }
    }
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
      Alert.alert(t('sleep.invalidTimeTitle'), t('sleep.invalidTimeMessage'));
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
      Alert.alert(t('common.error'), t('sleep.windowSaveFailed'));
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

  const handleVitaminDTimeChange = async (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowVitaminDTimePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    try {
      await updateNotifPrefs({
        vitaminDReminderHour: selectedDate.getHours(),
        vitaminDReminderMinute: selectedDate.getMinutes(),
      });
    } catch (error) {
      console.error('Failed to save Vitamin D reminder time:', error);
      Alert.alert(t('common.error'), t('notifications.vitaminTimeSaveFailed'));
    }
  };

  const handleChangeBackground = async () => {
    if (isChangingBackground) return;

    try {
      setIsChangingBackground(true);
      const result = await pickAndSaveBackground();

      if (result.error) {
        if (result.error === 'Zugriff auf Fotos wurde verweigert') {
          Alert.alert(
            t('background.photoPermissionTitle'),
            t('background.photoPermissionMessage'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('background.openSettings'),
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.error('Failed to open app settings:', error);
                    Alert.alert(t('common.error'), t('system.openFailed'));
                  }
                },
              },
            ],
          );
          return;
        }

        Alert.alert(t('common.error'), result.error);
        return;
      }

      // Nach erfolgreicher Bildauswahl: Helligkeit abfragen
      if (result.success && result.needsModeSelection) {
        Alert.alert(
          t('background.brightnessTitle'),
          t('background.brightnessMessage'),
          [
            {
              text: t('common.light'),
              onPress: () => setBackgroundMode(false),
            },
            {
              text: t('common.dark'),
              onPress: () => setBackgroundMode(true),
            },
          ]
        );
      }
    } catch (err) {
      console.error('Error changing background:', err);
      Alert.alert(t('common.error'), t('background.changeFailed'));
    } finally {
      setIsChangingBackground(false);
    }
  };

  const handleResetBackground = async () => {
    if (isChangingBackground) return;

    Alert.alert(
      t('background.resetTitle'),
      t('background.resetMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          onPress: async () => {
            try {
              setIsChangingBackground(true);
              const result = await resetToDefault();

              if (result.error) {
                Alert.alert(t('common.error'), result.error);
              }
            } catch (err) {
              console.error('Error resetting background:', err);
              Alert.alert(t('common.error'), t('background.resetFailed'));
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
      Alert.alert(t('common.error'), t('system.openFailed'));
    }
  };

  const handleSyncLiveActivities = async () => {
    if (isSyncingLiveActivities) return;

    if (!sleepActivityService.isLiveActivitySupported()) {
      setLiveActivitiesStatusText(t('live.unavailable'));
      Alert.alert(
        t('live.title'),
        t('live.unsupportedMessage')
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
        setLiveActivitiesStatusText(t('live.noActiveSleep'));
        Alert.alert(t('live.title'), t('live.noTrackingMessage'));
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
          setLiveActivitiesStatusText(t('live.iosUnavailable'));
          Alert.alert(
            t('live.title'),
            t('live.startFailed')
          );
          return;
        }
      }

      // Bestehende oder neu gestartete Activity mit aktueller Zeit updaten
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 1000));
      await sleepActivityService.updateSleepActivity(formatElapsedSeconds(elapsedSeconds));

      setLiveActivitiesStatusText(t('live.activeSince', {
        time: startDate.toLocaleTimeString(APP_SETTINGS_LOCALE_TAG, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));
      Alert.alert(t('live.title'), t('live.synced'));
    } catch (error) {
      console.error('Failed to synchronize live activities:', error);
      setLiveActivitiesStatusText(t('live.syncFailedStatus'));
      Alert.alert(t('common.error'), t('live.syncFailed'));
    } finally {
      setIsSyncingLiveActivities(false);
    }
  };

  const handleOpenLiveActivitiesPopup = async () => {
    const status = await refreshLiveActivitiesStatus();
    const message = [
      t('live.popupStatus', { status }),
      '',
      t('live.popupLockScreen'),
      t('live.popupIsland'),
      t('live.popupSync'),
    ].join('\n');

    Alert.alert(
      t('live.title'),
      message,
      [
        { text: t('common.close'), style: 'cancel' },
        { text: t('live.iosSettings'), onPress: () => void handleOpenSystemSettings() },
        { text: t('common.sync'), onPress: () => void handleSyncLiveActivities() },
      ],
      { cancelable: true }
    );
  };

  const handleExportData = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('auth.signInAgain'));
      return;
    }

    // PDF-Berichte sind nicht in Lotti Lite enthalten (DSGVO-Datenauskunft
    // läuft separat über den DSGVO-Screen und bleibt immer verfügbar).
    const canExport = await hasFeatureAccess('pdfExport');
    if (!canExport) {
      Alert.alert(
        t('data.liteTitle'),
        t('data.liteMessage'),
        [
          { text: t('common.later'), style: 'cancel' },
          {
            text: t('data.viewPlans'),
            onPress: () => router.push('/paywall?origin=lock_pdfExport' as any),
          },
        ],
      );
      return;
    }

    try {
      setIsExporting(true);
      const result = await exportUserData('pdf');

      if (!result.success) {
        Alert.alert(t('common.error'), result.error ?? t('data.exportFailed'));
        return;
      }

      const totalRecords = result.summary
        ? Object.values(result.summary).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0)
        : undefined;
      const sizeKb = result.bytesWritten ? (result.bytesWritten / 1024).toFixed(1) : null;
      const warningText = result.warnings && result.warnings.length
        ? t('data.warnings', { warnings: result.warnings.slice(0, 3).join('\n- ') })
        : '';
      const locationHint = result.shared || !result.fileUri
        ? ''
        : t('data.location', { path: result.fileUri });
      const recordHint = totalRecords !== undefined
        ? t('data.records', { count: totalRecords })
        : '';
      const sizeHint = sizeKb ? t('data.size', { size: sizeKb }) : '';

      Alert.alert(
        t('data.exportComplete'),
        t('data.exportSummary', {
          records: recordHint,
          size: sizeHint,
          location: locationHint,
          warnings: warningText,
        }),
      );
    } catch (err) {
      console.error('Failed to export data:', err);
      Alert.alert(t('common.error'), t('data.exportRetry'));
    } finally {
      setIsExporting(false);
    }
  };

  const runDeleteDataFlow = async (deleteAccount: boolean) => {
    if (!user) {
      Alert.alert(t('common.error'), t('auth.signInAgain'));
      return;
    }

    try {
      setIsDeletingData(true);
      const { error } = deleteAccount ? await deleteUserAccount() : await deleteUserData();
      if (error) throw error;

      if (deleteAccount) {
        Alert.alert(
          t('data.accountDeletedTitle'),
          t('data.accountDeletedMessage'),
          [
            {
              text: t('common.ok'),
              onPress: async () => {
                await signOut();
              },
            },
          ],
        );
        return;
      }

      await loadSettings();
      Alert.alert(t('data.deletedTitle'), t('data.deletedMessage'));
    } catch (err: any) {
      console.error('Failed to delete user data:', err);
      Alert.alert(t('common.error'), err?.message || t('data.deleteFailed'));
    } finally {
      setIsDeletingData(false);
    }
  };

  const confirmAccountDeletion = async (onConfirm: () => void) => {
    try {
      const { data: requirements, error } = await getAccountDeletionRequirements();
      if (error) throw error;

      Alert.alert(
        t('data.warningTitle'),
        t('data.warningMessage', {
          store: getSubscriptionManagementStoreLabel(),
          apple: requirements?.hasAppleSignIn ? t('data.warningApple') : '',
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('data.manageSubscription'), onPress: () => void openSubscriptionManagement() },
          { text: t('data.deleteAnyway'), style: 'destructive', onPress: onConfirm },
        ],
      );
    } catch (error: any) {
      console.error('Failed to load account deletion requirements:', error);
      Alert.alert(
        t('common.error'),
        error?.message || t('data.warningLoadFailed'),
      );
    }
  };

  const handleDeleteDataRequest = () => {
    if (isDeletingData) return;
    Alert.alert(
      t('data.deleteTitle'),
      t('data.deleteQuestion'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('data.continue'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('data.deleteAccountTitle'),
              t('data.deleteAccountQuestion'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('data.deleteOnly'), style: 'destructive', onPress: () => runDeleteDataFlow(false) },
                {
                  text: t('data.deleteWithAccount'),
                  style: 'destructive',
                  onPress: () => {
                    void confirmAccountDeletion(() => runDeleteDataFlow(true));
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!user) {
      setLiveActivitiesStatusText(t('live.signIn'));
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
              title={t('screen.title')}
              subtitle={t('screen.subtitle')}
              showBackButton
              onBackPress={() => router.push('/more')}
            />
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <ThemedText style={styles.loadingText}>{t('screen.loading')}</ThemedText>
                </View>
              ) : (
                <View style={styles.contentWrap}>
                {settings ? (
                <>
                  <LiquidGlassCard style={styles.heroCard} intensity={34} overlayColor={GLASS_OVERLAY}>
                    <View style={styles.heroGlow} />
                    <View style={styles.heroTopRow}>
                      <View style={[styles.heroIcon, { backgroundColor: `${theme.accent}22` }]}>
                        <IconSymbol name="slider.horizontal.3" size={26} color={primaryIconColor} />
                      </View>
                      <View style={styles.heroCopy}>
                        <ThemedText style={[styles.heroEyebrow, { color: theme.accent }]}>
                          {t('hero.eyebrow')}
                        </ThemedText>
                        <ThemedText style={styles.heroTitle}>{t('hero.title')}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.heroDescription}>{t('hero.description')}</ThemedText>
                    <View style={styles.heroPills}>
                      {[
                        ['bell', t('hero.notifications')],
                        ['moon.zzz', t('hero.sleep')],
                        ['paintpalette', t('hero.appearance')],
                      ].map(([icon, label]) => (
                        <View key={label} style={styles.heroPill}>
                          <IconSymbol name={icon} size={14} color={primaryIconColor} />
                          <ThemedText style={styles.heroPillLabel}>{label}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </LiquidGlassCard>

                  {/* Benachrichtigungen-Einstellungen */}
                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <TouchableOpacity
                      style={[styles.rowItem, styles.firstRow]}
                      onPress={() => setIsNotificationsExpanded((prev) => !prev)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="bell" size={24} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>{t('notifications.title')}</ThemedText>
                        <ThemedText style={styles.rowDescription}>
                          {settings.notifications_enabled
                            ? t('notifications.activeCategories', { count: activeNotificationTypes })
                            : t('notifications.paused')}
                        </ThemedText>
                      </View>
                      <View style={styles.autoDarkTrailing}>
                        {isSaving ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : null}
                        <IconSymbol
                          name={isNotificationsExpanded ? 'chevron.up' : 'chevron.down'}
                          size={18}
                          color={trailingIconColor}
                        />
                      </View>
                    </TouchableOpacity>

                    {isNotificationsExpanded && (
                      <View style={styles.expandedSection}>
                        <View style={styles.rowItem}>
                          <View style={styles.rowIcon}>
                            <IconSymbol name="bell.badge" size={22} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>{t('notifications.allTitle')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('notifications.allDescription')}</ThemedText>
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

                        <TouchableOpacity style={styles.rowItem} onPress={handleOpenSystemSettings} activeOpacity={0.8}>
                          <View style={styles.rowIcon}>
                            <IconSymbol name="gearshape" size={21} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>{t('common.systemSettings')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('notifications.systemDescription')}</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                          </View>
                        </TouchableOpacity>

                        <ThemedText style={styles.subsectionLabel}>{t('notifications.types')}</ThemedText>

                        <View style={styles.rowItem}>
                          <View style={styles.rowIcon}>
                            <IconSymbol name="moon.zzz" size={22} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>{t('notifications.sleepTitle')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('notifications.sleepDescription')}</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <Switch
                              value={notifPrefs.sleepWindowReminder}
                              onValueChange={(v) => void handleToggleNotificationPreference('sleepWindowReminder', v)}
                              disabled={!settings.notifications_enabled}
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
                            <ThemedText style={styles.rowTitle}>{t('notifications.feedingTitle')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('notifications.feedingDescription')}</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <Switch
                              value={notifPrefs.feedingReminder}
                              onValueChange={(v) => void handleToggleNotificationPreference('feedingReminder', v)}
                              disabled={!settings.notifications_enabled}
                              trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                              thumbColor={notifPrefs.feedingReminder ? '#FFFFFF' : '#F4F4F4'}
                              ios_backgroundColor="#D1D1D6"
                            />
                          </View>
                        </View>

                        <View style={styles.rowItem}>
                          <View style={styles.rowIcon}>
                            <IconSymbol name="sun.max" size={21} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>{t('notifications.vitaminTitle')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('notifications.vitaminDescription')}</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <Switch
                              value={notifPrefs.vitaminDReminder}
                              onValueChange={(v) => void handleToggleNotificationPreference('vitaminDReminder', v)}
                              disabled={!settings.notifications_enabled}
                              trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                              thumbColor={notifPrefs.vitaminDReminder ? '#FFFFFF' : '#F4F4F4'}
                              ios_backgroundColor="#D1D1D6"
                            />
                          </View>
                        </View>

                        {notifPrefs.vitaminDReminder && (
                          <>
                            <TouchableOpacity
                              style={[
                                styles.rowItem,
                                !settings.notifications_enabled && styles.disabledRow,
                              ]}
                              onPress={() => setShowVitaminDTimePicker(true)}
                              disabled={!settings.notifications_enabled}
                              activeOpacity={0.82}
                            >
                              <View style={styles.rowIcon}>
                                <IconSymbol name="clock" size={20} color={primaryIconColor} />
                              </View>
                              <View style={styles.rowContent}>
                                <ThemedText style={styles.rowTitle}>{t('notifications.vitaminTimeTitle')}</ThemedText>
                                <ThemedText style={styles.rowDescription}>
                                  {t('notifications.vitaminTimeDescription', { time: vitaminDTimeLabel })}
                                </ThemedText>
                              </View>
                              <View style={styles.trailing}>
                                <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                              </View>
                            </TouchableOpacity>

                            {showVitaminDTimePicker && (
                              <View style={styles.autoDarkPickerContainer}>
                                <DateTimePicker
                                  mode="time"
                                  value={new Date(2000, 0, 1, notifPrefs.vitaminDReminderHour, notifPrefs.vitaminDReminderMinute)}
                                  onChange={handleVitaminDTimeChange}
                                  is24Hour
                                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                  themeVariant={useLightIcons ? 'dark' : 'light'}
                                  textColor={Platform.OS === 'ios' ? autoDarkTimeTextColor : undefined}
                                />
                                {Platform.OS === 'ios' && (
                                  <TouchableOpacity
                                    style={styles.autoDarkPickerDone}
                                    onPress={() => setShowVitaminDTimePicker(false)}
                                  >
                                    <ThemedText style={styles.autoDarkPickerDoneText}>{t('common.done')}</ThemedText>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </>
                        )}

                        <View style={styles.rowItem}>
                          <View style={styles.rowIcon}>
                            <IconSymbol name="person.2" size={21} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>{t('notifications.partnerTitle')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('notifications.partnerDescription')}</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <Switch
                              value={notifPrefs.partnerActivity}
                              onValueChange={(v) => void handleToggleNotificationPreference('partnerActivity', v)}
                              disabled={!settings.notifications_enabled}
                              trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                              thumbColor={notifPrefs.partnerActivity ? '#FFFFFF' : '#F4F4F4'}
                              ios_backgroundColor="#D1D1D6"
                            />
                          </View>
                        </View>

                        <View style={styles.rowItem}>
                          <View style={styles.rowIcon}>
                            <IconSymbol name="calendar" size={21} color={primaryIconColor} />
                          </View>
                          <View style={styles.rowContent}>
                            <ThemedText style={styles.rowTitle}>{t('notifications.plannerTitle')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('notifications.plannerDescription')}</ThemedText>
                          </View>
                          <View style={styles.trailing}>
                            <Switch
                              value={notifPrefs.plannerReminder}
                              onValueChange={(v) => void handleToggleNotificationPreference('plannerReminder', v)}
                              disabled={!settings.notifications_enabled}
                              trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                              thumbColor={notifPrefs.plannerReminder ? '#FFFFFF' : '#F4F4F4'}
                              ios_backgroundColor="#D1D1D6"
                            />
                          </View>
                        </View>

                        {!settings.notifications_enabled && (
                          <ThemedText style={styles.inlineNote}>
                            {t('notifications.pausedNote')}
                          </ThemedText>
                        )}
                      </View>
                    )}
                  </LiquidGlassCard>

                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <View style={styles.sectionHeading}>
                      <IconSymbol name="bed.double.fill" size={16} color={primaryIconColor} />
                      <ThemedText style={styles.sectionTitle}>{t('sleep.section')}</ThemedText>
                    </View>

                    <TouchableOpacity
                      style={styles.rowItem}
                      onPress={() => setIsNightWindowExpanded((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="moon.zzz" size={22} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>{t('sleep.nightWindowTitle')}</ThemedText>
                        <ThemedText style={styles.rowDescription}>
                          {t('sleep.nightWindowRange', {
                            start: nightWindowStartTime,
                            end: nightWindowEndTime,
                          })}
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
                          <ThemedText style={styles.autoDarkScheduleLabel}>{t('sleep.window')}</ThemedText>
                          {isSavingNightWindow && <ActivityIndicator size="small" color={theme.accent} />}
                        </View>

                        <View style={styles.autoDarkTimeRow}>
                          <ThemedText style={styles.autoDarkTimeTitle}>{t('sleep.from')}</ThemedText>
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
                          <ThemedText style={styles.autoDarkTimeTitle}>{t('sleep.until')}</ThemedText>
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
                                <ThemedText style={styles.autoDarkPickerDoneText}>{t('common.done')}</ThemedText>
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
                                <ThemedText style={styles.autoDarkPickerDoneText}>{t('common.done')}</ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </LiquidGlassCard>

                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <View style={styles.sectionHeading}>
                      <IconSymbol name="paintpalette" size={16} color={primaryIconColor} />
                      <ThemedText style={styles.sectionTitle}>{t('appearance.section')}</ThemedText>
                    </View>

                    <TouchableOpacity
                      style={styles.rowItem}
                      onPress={() => setIsAutoDarkExpanded((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="moon.stars" size={22} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>{t('appearance.autoDarkTitle')}</ThemedText>
                        <ThemedText style={styles.rowDescription}>
                          {t('appearance.autoDarkRange', {
                            start: autoDarkModeStartTime,
                            end: autoDarkModeEndTime,
                          })}
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
                          <ThemedText style={styles.autoDarkScheduleLabel}>{t('sleep.window')}</ThemedText>
                          {isSavingAutoDark && <ActivityIndicator size="small" color={theme.accent} />}
                        </View>

                        <View style={styles.autoDarkTimeRow}>
                          <ThemedText style={styles.autoDarkTimeTitle}>{t('sleep.from')}</ThemedText>
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
                          <ThemedText style={styles.autoDarkTimeTitle}>{t('sleep.until')}</ThemedText>
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
                                <ThemedText style={styles.autoDarkPickerDoneText}>{t('common.done')}</ThemedText>
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
                                <ThemedText style={styles.autoDarkPickerDoneText}>{t('common.done')}</ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </LiquidGlassCard>

                  <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <TouchableOpacity
                      style={[styles.rowItem, styles.firstRow, isSyncingLiveActivities && styles.disabledRow]}
                      onPress={handleOpenLiveActivitiesPopup}
                      disabled={isSyncingLiveActivities}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="moon.zzz" size={22} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>{t('live.title')}</ThemedText>
                        <ThemedText style={styles.rowDescription}>{liveActivitiesStatusText}</ThemedText>
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
                    <View style={styles.sectionHeading}>
                      <IconSymbol name="photo" size={16} color={primaryIconColor} />
                      <ThemedText style={styles.sectionTitle}>{t('background.section')}</ThemedText>
                    </View>

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
                            ? t('background.customPreview', {
                                mode: t(isDarkBackground ? 'background.modeDark' : 'background.modeLight'),
                              })
                            : t(PRESET_OPTIONS.find(option => option.id === selectedBackground)?.labelKey
                                ?? 'background.preset.default')}
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
                              {t(option.labelKey)}
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
                        <ThemedText style={styles.rowTitle}>{t('background.changeTitle')}</ThemedText>
                        <ThemedText style={styles.rowDescription}>{t('background.changeDescription')}</ThemedText>
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
                                t('background.autoDarkActiveTitle'),
                                t('background.autoDarkActiveMessage')
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
                            <ThemedText style={styles.rowTitle}>{t('background.textColorTitle')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>
                              {isBackgroundModeAutoSynced
                                ? t('background.textColorAuto', {
                                    mode: t(effectiveIsDarkBackground ? 'background.lightText' : 'background.darkText'),
                                  })
                                : t('background.textColorCurrent', {
                                    mode: t(effectiveIsDarkBackground ? 'background.lightText' : 'background.darkText'),
                                  })}
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
                            <ThemedText style={styles.rowTitle}>{t('common.reset')}</ThemedText>
                            <ThemedText style={styles.rowDescription}>{t('background.resetDescription')}</ThemedText>
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
                    <View style={styles.sectionHeading}>
                      <IconSymbol name="lock.shield" size={16} color={primaryIconColor} />
                      <ThemedText style={styles.sectionTitle}>{t('data.section')}</ThemedText>
                    </View>

                    <TouchableOpacity
                      style={[styles.rowItem, isExporting && styles.disabledRow]}
                      onPress={handleExportData}
                      disabled={isExporting}
                    >
                      <View style={styles.rowIcon}>
                        <IconSymbol name="arrow.down.doc" size={24} color={primaryIconColor} />
                      </View>
                      <View style={styles.rowContent}>
                        <ThemedText style={styles.rowTitle}>{t('data.exportTitle')}</ThemedText>
                        <ThemedText style={styles.rowDescription}>{t('data.exportDescription')}</ThemedText>
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
                        <ThemedText style={[styles.rowTitle, styles.dangerText]}>{t('data.deleteTitle')}</ThemedText>
                        <ThemedText style={styles.rowDescription}>{t('data.deleteDescription')}</ThemedText>
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
                      <View style={styles.sectionHeading}>
                        <IconSymbol name="wrench.fill" size={16} color={primaryIconColor} />
                        <ThemedText style={styles.sectionTitle}>{t('admin.section')}</ThemedText>
                      </View>

                      <TouchableOpacity
                        style={styles.rowItem}
                        onPress={() => router.push('/debug-notifications')}
                      >
                        <View style={styles.rowIcon}>
                          <ThemedText style={{ fontSize: 24 }}>🔔</ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText style={styles.rowTitle}>{t('admin.notificationsTitle')}</ThemedText>
                          <ThemedText style={styles.rowDescription}>{t('admin.notificationsDescription')}</ThemedText>
                        </View>
                        <View style={styles.trailing}>
                          <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.rowItem, isExportingSleepDebug && styles.disabledRow]}
                        onPress={handleExportSleepDebug}
                        disabled={isExportingSleepDebug}
                      >
                        <View style={styles.rowIcon}>
                          <ThemedText style={{ fontSize: 24 }}>😴</ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText style={styles.rowTitle}>{t('admin.sleepTitle')}</ThemedText>
                          <ThemedText style={styles.rowDescription}>{t('admin.sleepDescription')}</ThemedText>
                        </View>
                        <View style={styles.trailing}>
                          {isExportingSleepDebug ? (
                            <ActivityIndicator size="small" color={theme.accent} />
                          ) : (
                            <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                          )}
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rowItem}
                        onPress={() => router.push('/paywall-access-admin')}
                      >
                        <View style={styles.rowIcon}>
                          <ThemedText style={{ fontSize: 24 }}>🧾</ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText style={styles.rowTitle}>{t('admin.accessTitle')}</ThemedText>
                          <ThemedText style={styles.rowDescription}>{t('admin.accessDescription')}</ThemedText>
                        </View>
                        <View style={styles.trailing}>
                          <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rowItem}
                        onPress={() => router.push('/paywall-content-admin')}
                      >
                        <View style={styles.rowIcon}>
                          <ThemedText style={{ fontSize: 24 }}>✍️</ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText style={styles.rowTitle}>{t('admin.editorTitle')}</ThemedText>
                          <ThemedText style={styles.rowDescription}>{t('admin.editorDescription')}</ThemedText>
                        </View>
                        <View style={styles.trailing}>
                          <IconSymbol name="chevron.right" size={20} color={trailingIconColor} />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rowItem}
                        onPress={() => router.push('/startup-message-admin')}
                      >
                        <View style={styles.rowIcon}>
                          <ThemedText style={{ fontSize: 24 }}>📣</ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText style={styles.rowTitle}>{t('admin.startupTitle')}</ThemedText>
                          <ThemedText style={styles.rowDescription}>{t('admin.startupDescription')}</ThemedText>
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
                          <ThemedText style={styles.rowTitle}>{t('admin.convexTitle')}</ThemedText>
                          <ThemedText style={[styles.rowDescription, { fontSize: 11 }]}>
                            {t('admin.client')}: {convexClient ? t('admin.clientReady') : t('admin.clientUnavailable')}
                            {lastSyncError && `\n${t('admin.error', { message: lastSyncError.message.substring(0, 50) })}`}
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
                    {t('screen.loadFailed')}
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: theme.accent }]}
                    onPress={loadSettings}
                  >
                    <ThemedText style={styles.retryButtonText}>
                      {t('screen.retry')}
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
    paddingBottom: 48,
    paddingTop: 12,
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
  heroCard: {
    marginBottom: 18,
    borderRadius: 26,
    overflow: 'hidden',
    padding: 20,
    boxShadow: '0 10px 30px rgba(83, 59, 89, 0.12)',
  },
  heroGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -76,
    right: -46,
    backgroundColor: 'rgba(157,190,187,0.22)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.78,
    paddingTop: 13,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 16,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  heroPillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    boxShadow: '0 6px 20px rgba(83, 59, 89, 0.08)',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 17,
    paddingBottom: 9,
    paddingHorizontal: 18,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.35,
    opacity: 0.82,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)'
  },
  firstRow: {
    borderTopWidth: 0,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  rowDescription: { fontSize: 13, lineHeight: 18, opacity: 0.72, marginTop: 2 },
  trailing: { marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
  autoDarkTrailing: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expandedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 10,
  },
  subsectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.62,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  inlineNote: {
    fontSize: 13,
    opacity: 0.75,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
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
    borderRadius: 16,
    overflow: 'hidden',
    height: 132,
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
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
