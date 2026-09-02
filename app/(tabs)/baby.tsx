/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, StatusBar, Platform, BackHandler, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { saveBabyInfo, BabyInfo } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { loadBabyInfoWithCache, invalidateBabyCache } from '@/lib/babyCache';
import { supabase } from '@/lib/supabase';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, Stack , useFocusEffect, useNavigation as useRouteNavigation } from 'expo-router';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import * as Notifications from 'expo-notifications';
import { defineMilestoneCheckerTask, saveBabyInfoForBackgroundTask, isTaskRegistered } from '@/tasks/milestoneCheckerTask';
import {
  LAYOUT_PAD,
  LiquidGlassCard,
  TIMELINE_INSET,
  GLASS_BORDER,
  GLASS_BORDER_DARK,
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
} from '@/constants/DesignGuide';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  DEFAULT_BEDTIME_ANCHOR,
  isValidBedtimeAnchor,
  normalizeBedtimeAnchor,
} from '@/lib/bedtime';
import { getSafePickerDate, parseSafeDate } from '@/lib/safeDate';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import {
  differenceInYears,
  differenceInMonths,
  differenceInDays,
  addMonths,
  addDays,
} from 'date-fns';
import {
  DEFAULT_BABY_LOCALE,
  formatBabyAge,
  getBabyLocaleTag,
  translateBabyText,
  type BabyTranslationKey,
} from '@/lib/babyTranslations';
import {
  deleteBabyPhoto,
  prepareBabyPhoto,
  uploadBabyPhoto,
  type PreparedBabyPhoto,
} from '@/lib/babyPhoto';

let ACTIVE_BABY_LOCALE = DEFAULT_BABY_LOCALE;
let BABY_LOCALE_TAG = getBabyLocaleTag(ACTIVE_BABY_LOCALE);
const t = (key: BabyTranslationKey, params?: Record<string, string | number>) =>
  translateBabyText(ACTIVE_BABY_LOCALE, key, params);

const initialStats = {
  years: 0,
  months: 0,
  days: 0,
  totalDays: 0,
  totalWeeks: 0,
  totalMonths: 0,
  milestones: [] as { labelKey: BabyTranslationKey; reached: boolean; date?: Date }[],
};

const HEADER_TEXT_COLOR = '#7D5A50';
const MIN_VALID_BABY_DATE = new Date(2000, 0, 1);
const MAX_VALID_DUE_DATE = new Date(2100, 11, 31, 23, 59, 59, 999);

// Ein gesetztes Geburtsdatum ist die verlaessliche Quelle fuer "geboren".
// user_settings.is_baby_born gilt pro Nutzer (nicht pro Kind) und dient nur
// als Fallback, wenn das Kind noch kein Geburtsdatum hat.
const resolveIsBabyBorn = (birthDate: Date | null, settingsIsBabyBorn: unknown): boolean =>
  Boolean(birthDate) || settingsIsBabyBorn === true;

const formatBedtimeInputValue = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const parseManualBedtimeAnchor = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_BEDTIME_ANCHOR;

  const colonMatch = trimmed.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (colonMatch) {
    const candidate = `${colonMatch[1].padStart(2, '0')}:${colonMatch[2].padStart(2, '0')}`;
    return isValidBedtimeAnchor(candidate) ? candidate : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 3) {
    const candidate = `0${digits.slice(0, 1)}:${digits.slice(1)}`;
    return isValidBedtimeAnchor(candidate) ? candidate : null;
  }
  if (digits.length === 4) {
    const candidate = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    return isValidBedtimeAnchor(candidate) ? candidate : null;
  }

  return null;
};

const getCurrentBirthDateBounds = () => {
  const now = new Date();
  const maximumDate = now.getTime() < MIN_VALID_BABY_DATE.getTime()
    ? new Date(MIN_VALID_BABY_DATE.getTime())
    : now;

  return {
    minimumDate: MIN_VALID_BABY_DATE,
    maximumDate,
  };
};

const pastelPaletteLight = {
  peach: 'rgba(255, 223, 209, 0.85)',
  rose: 'rgba(255, 210, 224, 0.8)',
  honey: 'rgba(255, 239, 214, 0.85)',
  sage: 'rgba(214, 236, 220, 0.78)',
  lavender: 'rgba(236, 224, 255, 0.78)',
  sky: 'rgba(222, 238, 255, 0.85)',
  blush: 'rgba(255, 218, 230, 0.8)',
};

const pastelPaletteDark = {
  peach: 'rgba(255, 177, 138, 0.25)',
  rose: 'rgba(255, 133, 170, 0.25)',
  honey: 'rgba(255, 210, 137, 0.23)',
  sage: 'rgba(150, 210, 178, 0.22)',
  lavender: 'rgba(190, 156, 255, 0.24)',
  sky: 'rgba(134, 186, 255, 0.24)',
  blush: 'rgba(255, 160, 188, 0.24)',
};

const GlassLayer = ({
  tint = 'rgba(255,255,255,0.22)',
  sheenOpacity = 0.35,
  isDark = false,
}: {
  tint?: string;
  sheenOpacity?: number;
  isDark?: boolean;
}) => (
  <>
    <LinearGradient
      colors={[tint, isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statsGlassLayerGradient}
    />
    <View
      style={[
        styles.statsGlassSheen,
        {
          opacity: sheenOpacity,
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
        },
      ]}
    />
  </>
);

export default function BabyScreen() {
  ACTIVE_BABY_LOCALE = useLocale().locale;
  BABY_LOCALE_TAG = getBabyLocaleTag(ACTIVE_BABY_LOCALE);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const textTertiary = isDark ? Colors.dark.textTertiary : '#A8978E';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const glassBorderColor = isDark ? GLASS_BORDER_DARK : GLASS_BORDER;
  const glassSurfaceStyle = {
    borderColor: glassBorderColor,
    backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.15)',
    shadowOpacity: isDark ? 0.18 : 0.06,
  } as const;
  const iconBubbleBackground = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.82)';
  const pastelPalette = isDark ? pastelPaletteDark : pastelPaletteLight;
  const milestoneReachedIconColor = isDark ? '#FFB08D' : '#E88368';
  const milestoneUpcomingIconColor = isDark ? '#D8CCC2' : '#9E8F86';
  const photoButtonBackground = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(125, 90, 80, 0.15)';
  const photoButtonBorder = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.35)';
  const accentButtonBackground = isDark ? 'rgba(142, 78, 198, 0.26)' : 'rgba(142, 78, 198, 0.16)';
  const accentButtonBorder = isDark ? 'rgba(196, 160, 233, 0.55)' : 'rgba(142, 78, 198, 0.35)';
  const inputBackground = isDark ? 'rgba(18,18,22,0.76)' : 'rgba(255,255,255,0.85)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.35)';
  const { user } = useAuth();
  const { activeBabyId, refreshBabies, isReady, setActiveBabyId } = useActiveBaby();
  const { refreshBabyDetails, isBabyBorn } = useBabyStatus();
  const router = useRouter();
  const routeNavigation = useRouteNavigation();
  const params = useLocalSearchParams<{ babyId?: string | string[]; edit?: string | string[]; created?: string | string[] }>();
  const fallbackHomeRoute = isBabyBorn ? '/(tabs)/home' : '/(tabs)/pregnancy-home';
  const editParamValue = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const createdParamValue = Array.isArray(params.created) ? params.created[0] : params.created;
  const routeBabyId = Array.isArray(params.babyId) ? params.babyId[0] : params.babyId;
  const targetBabyId = routeBabyId ?? activeBabyId;
  const autoOpenEdit = editParamValue === '1' || editParamValue === 'true';
  const showCreatedHint = createdParamValue === '1' || createdParamValue === 'true';

  // Set fallback route for smart back navigation
  useSmartBack(fallbackHomeRoute);

  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [loadedBabyId, setLoadedBabyId] = useState<string | null>(null);
  const babyInfoRequestIdRef = useRef(0);
  const appliedRouteBabyIdRef = useRef<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  // null = fuer das aktuelle Kind noch nicht geladen. Solange faellt die Anzeige
  // auf den bereits aufgeloesten Context-Status zurueck statt auf ein hartes
  // "Schwangerschaft", das nach Kindwechsel oder Cold-Start kurz falsch waere.
  const [loadedIsBabyBorn, setIsBabyBornForCurrentBaby] = useState<boolean | null>(null);
  const isBabyBornForCurrentBaby = loadedIsBabyBorn ?? isBabyBorn;
  const [bedtimeInput, setBedtimeInput] = useState(DEFAULT_BEDTIME_ANCHOR);
  const [bedtimeInputError, setBedtimeInputError] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<PreparedBabyPhoto | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const birthDateBounds = getCurrentBirthDateBounds();
  const birthDateForDisplay = parseSafeDate(babyInfo.birth_date, birthDateBounds);
  const birthDatePickerValue = getSafePickerDate(
    babyInfo.birth_date,
    birthDateBounds.maximumDate,
    birthDateBounds
  );
  const dueDateBounds = useMemo(
    () => ({
      minimumDate: MIN_VALID_BABY_DATE,
      maximumDate: MAX_VALID_DUE_DATE,
    }),
    [],
  );
  const dueDateForDisplay = parseSafeDate(dueDate, dueDateBounds);
  const dueDatePickerValue = getSafePickerDate(dueDate, new Date(), dueDateBounds);
  const bedtimeAnchor = useMemo(
    () => normalizeBedtimeAnchor(babyInfo.preferred_bedtime),
    [babyInfo.preferred_bedtime]
  );

  const setPreferredBedtimeAnchor = useCallback((anchor: string) => {
    setBabyInfo((prev) => ({
      ...prev,
      preferred_bedtime: anchor,
    }));
    setBedtimeInput(anchor);
    setBedtimeInputError(null);
  }, []);

  const commitBedtimeInput = useCallback(
    (rawValue: string, showAlert = false): string | null => {
      const parsed = parseManualBedtimeAnchor(rawValue);
      if (!parsed) {
        const message = t('error.bedtimeMessage');
        setBedtimeInputError(message);
        if (showAlert) {
          Alert.alert(t('error.bedtimeTitle'), message);
        }
        return null;
      }
      setPreferredBedtimeAnchor(parsed);
      return parsed;
    },
    [setPreferredBedtimeAnchor]
  );

  useEffect(() => {
    // Invalidate in-flight loads when the selected profile changes. Saving is
    // blocked below until the matching profile has finished loading.
    babyInfoRequestIdRef.current += 1;
    setIsBabyBornForCurrentBaby(null);
  }, [targetBabyId]);

  useEffect(() => {
    if (!autoOpenEdit) return;
    setIsEditing(true);
    // Einmalige Absicht: Parameter direkt entfernen, damit ein spaeterer Besuch
    // des Tabs nicht erneut in den Bearbeiten-Modus springt.
    routeNavigation.setParams({ edit: undefined } as any);
  }, [autoOpenEdit, routeNavigation]);

  useEffect(() => {
    setBedtimeInput(bedtimeAnchor);
    setBedtimeInputError(null);
  }, [bedtimeAnchor, isEditing]);

  // Der babyId-Parameter ist eine einmalige Absicht ("oeffne genau dieses Kind").
  // Der Baby-Tab bleibt nach dem ersten Besuch montiert und behaelt seine
  // Params, deshalb wird der Parameter nur einmal angewendet und danach
  // entfernt - sonst zieht dieser Effekt jeden spaeteren Kindwechsel im
  // BabySwitcher sofort wieder zurueck.
  useEffect(() => {
    if (!routeBabyId) {
      appliedRouteBabyIdRef.current = null;
      return;
    }

    if (routeBabyId === activeBabyId) {
      appliedRouteBabyIdRef.current = null;
      routeNavigation.setParams({ babyId: undefined } as any);
      return;
    }

    if (appliedRouteBabyIdRef.current === routeBabyId) return;
    appliedRouteBabyIdRef.current = routeBabyId;
    void setActiveBabyId(routeBabyId);
  }, [activeBabyId, routeBabyId, routeNavigation, setActiveBabyId]);

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync();
      setupBackgroundTask();
    }
  }, [user]);
  
  // Wir speichern die Baby-Infos für den Hintergrund-Task nur in handleSave,
  // um unnötige Speichervorgänge zu vermeiden
  
  // Hintergrund-Task einrichten
  const setupBackgroundTask = async () => {
    try {
      const existingPermissions = await Notifications.getPermissionsAsync();
      if (existingPermissions.granted) {
        // Definiere Task (Registrierung erfolgt in App-Scope; hier stellen wir sicher, dass sie definiert ist)
        defineMilestoneCheckerTask();
        console.log('Hintergrund-Task für Meilensteine definiert.');
        
        // Status prüfen und speichern (einfacher Check)
        const registered = await isTaskRegistered();
        const status: { status: string; isRegistered: boolean } = { status: registered ? 'REGISTERED' : 'NOT_REGISTERED', isRegistered: !!registered };
        console.log('Background Fetch Status:', status);
      } else {
        console.log('Keine Berechtigung für Benachrichtigungen, Hintergrund-Task nicht registriert.');
      }
    } catch (error) {
      console.error('Fehler beim Einrichten des Hintergrund-Tasks:', error);
    }
  };

  const loadBabyInfo = useCallback(async () => {
    if (!targetBabyId || !user?.id) {
      return;
    }

    const requestId = ++babyInfoRequestIdRef.current;

    setPendingPhoto(null);
    setIsPhotoRemoved(false);

    try {
      const [
        { data, isStale, refresh },
        settingsResult,
      ] = await Promise.all([
        loadBabyInfoWithCache(targetBabyId),
        supabase
          .from('user_settings')
          .select('due_date, is_baby_born')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (requestId !== babyInfoRequestIdRef.current) return;

      if (settingsResult.error && settingsResult.error.code !== 'PGRST116') {
        console.error('Failed to load baby settings:', settingsResult.error);
      }
      const settingsData = settingsResult.data;

      // Show cached data immediately
      if (data) {
        const safeBirthDate = parseSafeDate(data.birth_date, getCurrentBirthDateBounds());
        setBabyInfo({
          ...data,
          id: data.id ?? targetBabyId,
          birth_date: safeBirthDate ? safeBirthDate.toISOString() : null,
          preferred_bedtime: data.preferred_bedtime
            ? normalizeBedtimeAnchor(data.preferred_bedtime)
            : null,
        });
        setLoadedBabyId(targetBabyId);
        setIsBabyBornForCurrentBaby(resolveIsBabyBorn(safeBirthDate, settingsData?.is_baby_born));
        setDueDate(parseSafeDate(settingsData?.due_date, dueDateBounds));
      }

      // Refresh in background if stale
      if (isStale) {
        const freshData = await refresh();
        if (requestId !== babyInfoRequestIdRef.current) return;
        const safeBirthDate = parseSafeDate(freshData.birth_date, getCurrentBirthDateBounds());
        setBabyInfo({
          ...freshData,
          id: freshData.id ?? targetBabyId,
          birth_date: safeBirthDate ? safeBirthDate.toISOString() : null,
          preferred_bedtime: freshData.preferred_bedtime
            ? normalizeBedtimeAnchor(freshData.preferred_bedtime)
            : null,
        });
        setLoadedBabyId(targetBabyId);
        setIsBabyBornForCurrentBaby(resolveIsBabyBorn(safeBirthDate, settingsData?.is_baby_born));
        setDueDate(parseSafeDate(settingsData?.due_date, dueDateBounds));
      }

      // If no cache, data is already fresh
    } catch (err) {
      console.error('Failed to load baby info:', err);
    }
  }, [dueDateBounds, targetBabyId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !isReady || !targetBabyId) return;
  
      loadBabyInfo();
  
      const handleHardwareBack = () => {
        router.push(fallbackHomeRoute as any);
        return true;
      };
  
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handleHardwareBack
      );
  
      return () => subscription.remove();
    }, [user, isReady, targetBabyId, router, loadBabyInfo, fallbackHomeRoute])
  );

  const displayPhoto = isPhotoRemoved
    ? null
    : pendingPhoto?.uri ?? babyInfo.photo_url ?? null;

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  const getAvgHeartRate = (ageMonths: number) =>
    ageMonths < 1 ? 140 : ageMonths < 6 ? 130 : 120;

  const getAvgBreathRate = (ageMonths: number) =>
    ageMonths < 1 ? 40 : ageMonths < 6 ? 35 : 30;

  const getAvgDiapers = (ageMonths: number) =>
    ageMonths < 1 ? 10 : ageMonths < 3 ? 8 : ageMonths < 12 ? 6 : 4;

  const getAvgSleepHours = (ageMonths: number) =>
    ageMonths < 1 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;

  const genderLabels = {
    male: t('gender.male'),
    female: t('gender.female'),
    unknown: t('gender.unknown'),
  };

  const pickBabyPhoto = async ({ enterEditMode = false } = {}) => {
    try {
      // Expo baut den PHPicker mit PHPickerConfiguration(photoLibrary:). Diese
      // Variante braucht eine erteilte Mediathek-Berechtigung, sonst öffnet
      // sich der Picker unter iOS als leere weiße Fläche.
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('photo.permissionTitle'), t('photo.permissionMessage'));
        return;
      }

      // Kein presentationStyle setzen: Der PHPicker läuft unter iOS in einem
      // eigenen Prozess und bleibt weiß, wenn man ihn zu fullScreen zwingt.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        selectionLimit: 1,
        shouldDownloadFromNetwork: true,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.uri) {
          Alert.alert(t('error.title'), t('photo.processError'));
          return;
        }

        const preparedPhoto = await prepareBabyPhoto(asset.uri, {
          width: asset.width,
          height: asset.height,
        });
        setPendingPhoto(preparedPhoto);
        setIsPhotoRemoved(false);
        if (enterEditMode) {
          setIsEditing(true);
        }
      }
    } catch (error) {
      console.error('Error picking baby photo:', error);
      Alert.alert(t('error.title'), t('photo.selectError'));
    }
  };

  const removeBabyPhoto = () => {
    setPendingPhoto(null);
    setIsPhotoRemoved(true);
  };

  const handleSave = async () => {
    if (!targetBabyId || !user?.id || isSaving) return;

    if (loadedBabyId !== targetBabyId || (babyInfo.id && babyInfo.id !== targetBabyId)) {
      Alert.alert(t('error.title'), t('save.profileChangedMessage'));
      void loadBabyInfo();
      return;
    }

    const normalizedBedtime = commitBedtimeInput(bedtimeInput, true);
    if (!normalizedBedtime) return;

    const birthDateForSave = isBabyBornForCurrentBaby
      ? parseSafeDate(babyInfo.birth_date, birthDateBounds)
      : null;
    const dueDateForSave = !isBabyBornForCurrentBaby
      ? parseSafeDate(dueDate, dueDateBounds)
      : null;

    if (isBabyBornForCurrentBaby && !birthDateForSave) {
      Alert.alert(t('error.missingBirthTitle'), t('error.missingBirthMessage'));
      return;
    }

    const previousPhotoUrl = babyInfo.photo_url ?? null;
    let uploadedPhotoUrl: string | null = null;
    let babyInfoWasSaved = false;
    let saveStage = 'prepare';

    setIsSaving(true);
    try {
      if (pendingPhoto) {
        saveStage = 'photo-upload';
        uploadedPhotoUrl = await uploadBabyPhoto({
          bytes: pendingPhoto.bytes,
          userId: user.id,
          babyId: targetBabyId,
        });
      }

      const sanitizedBabyInfo: BabyInfo = {
        ...babyInfo,
        id: targetBabyId,
        birth_date: birthDateForSave ? birthDateForSave.toISOString() : null,
        preferred_bedtime: normalizedBedtime,
        photo_url: uploadedPhotoUrl ?? (isPhotoRemoved ? null : previousPhotoUrl),
      };

      saveStage = 'baby-profile';
      const { error } = await saveBabyInfo(sanitizedBabyInfo, targetBabyId);
      if (error) {
        throw error;
      } else {
        babyInfoWasSaved = true;
        saveStage = 'user-settings';
        const { data: existingSettings, error: existingSettingsError } = await supabase
          .from('user_settings')
          .select('id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSettingsError && existingSettingsError.code !== 'PGRST116') {
          throw existingSettingsError;
        }

        const settingsPayload = {
          due_date: dueDateForSave ? dueDateForSave.toISOString() : null,
          is_baby_born: isBabyBornForCurrentBaby,
          updated_at: new Date().toISOString(),
        };

        const settingsResult = existingSettings?.id
          ? await supabase.from('user_settings').update(settingsPayload).eq('id', existingSettings.id)
          : await supabase.from('user_settings').insert({
              user_id: user.id,
              theme: 'light',
              notifications_enabled: true,
              ...settingsPayload,
            });

        if (settingsResult.error) {
          throw settingsResult.error;
        }

        Alert.alert(t('save.successTitle'), t('save.successMessage'));
        setBabyInfo(sanitizedBabyInfo);
        setPendingPhoto(null);
        setIsPhotoRemoved(false);
        setIsEditing(false);
        if (targetBabyId !== activeBabyId) {
          try {
            await setActiveBabyId(targetBabyId);
          } catch (activeBabyError) {
            console.warn('Baby profile saved, but active baby could not be updated:', activeBabyError);
          }
        }

        // The profile write already succeeded. Follow-up refresh/cache work must
        // not show a second, misleading error alert to the user.
        const followUpTasks: Promise<unknown>[] = [
          refreshBabyDetails(),
          refreshBabies(),
          invalidateBabyCache(targetBabyId),
        ];
        if (sanitizedBabyInfo.birth_date) {
          followUpTasks.push(saveBabyInfoForBackgroundTask(sanitizedBabyInfo));
        }
        const followUpResults = await Promise.allSettled(followUpTasks);
        followUpResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.warn(`Baby profile post-save task ${index + 1} failed:`, result.reason);
          }
        });

        if (
          previousPhotoUrl
          && previousPhotoUrl !== sanitizedBabyInfo.photo_url
        ) {
          deleteBabyPhoto(previousPhotoUrl).catch((photoDeleteError) => {
            console.warn('Failed to remove previous baby photo:', photoDeleteError);
          });
        }

        // Reload fresh data from Supabase
        void loadBabyInfo();
      }
    } catch (err) {
      if (uploadedPhotoUrl && !babyInfoWasSaved) {
        deleteBabyPhoto(uploadedPhotoUrl).catch((photoDeleteError) => {
          console.warn('Failed to clean up unsaved baby photo:', photoDeleteError);
        });
      }
      console.error(`Failed to save baby info during ${saveStage}:`, err);
      Alert.alert(t('error.title'), t('save.errorMessage'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;

    const safeDate = parseSafeDate(selectedDate, getCurrentBirthDateBounds());
    if (!safeDate) return;
    setBabyInfo((prev) => ({
      ...prev,
      birth_date: safeDate.toISOString(),
    }));
  };

  const handleIOSBirthDateConfirm = (date: Date) => {
    const safeDate = parseSafeDate(date, getCurrentBirthDateBounds());
    if (!safeDate) {
      setShowDatePicker(false);
      return;
    }
    setBabyInfo((prev) => ({
      ...prev,
      birth_date: safeDate.toISOString(),
    }));
    setShowDatePicker(false);
  };

  const handleDueDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDueDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;

    const safeDate = parseSafeDate(selectedDate, dueDateBounds);
    if (!safeDate) return;
    setDueDate(safeDate);
  };

  const handleIOSDueDateConfirm = (date: Date) => {
    const safeDate = parseSafeDate(date, dueDateBounds);
    if (!safeDate) {
      setShowDueDatePicker(false);
      return;
    }
    setDueDate(safeDate);
    setShowDueDatePicker(false);
  };

  const computeStats = (birthDate: Date) => {
    const now = new Date();
    const years = differenceInYears(now, birthDate);
    const months = differenceInMonths(now, addMonths(birthDate, years * 12));
    const days = differenceInDays(now, addMonths(birthDate, years * 12 + months));
    const totalDays = differenceInDays(now, birthDate);
    const totalWeeks = Math.floor(totalDays / 7);
    const totalMonths = years * 12 + months;

    const milestoneDefinitions: { labelKey: BabyTranslationKey; addFn: () => Date }[] = [
      { labelKey: 'milestone.weekOne', addFn: () => addDays(birthDate, 7) },
      { labelKey: 'milestone.monthOne', addFn: () => addMonths(birthDate, 1) },
      { labelKey: 'milestone.monthTwo', addFn: () => addMonths(birthDate, 2) },
      { labelKey: 'milestone.monthThree', addFn: () => addMonths(birthDate, 3) },
      { labelKey: 'milestone.dayHundred', addFn: () => addDays(birthDate, 100) },
      { labelKey: 'milestone.monthSix', addFn: () => addMonths(birthDate, 6) },
      { labelKey: 'milestone.yearOne', addFn: () => addMonths(birthDate, 12) },
      { labelKey: 'milestone.dayFiveHundred', addFn: () => addDays(birthDate, 500) },
      { labelKey: 'milestone.dayThousand', addFn: () => addDays(birthDate, 1000) },
      { labelKey: 'milestone.dayElevenEleven', addFn: () => addDays(birthDate, 1111) },
    ];

    const milestones = milestoneDefinitions.map(({ labelKey, addFn }) => {
      const date = addFn();
      const reached = now >= date;
      return { labelKey, reached, date: reached ? date : undefined };
    });

    return { years, months, days, totalDays, totalWeeks, totalMonths, milestones };
  };

  const stats = useMemo(() => {
    if (!birthDateForDisplay) return initialStats;
    return computeStats(birthDateForDisplay);
  }, [birthDateForDisplay]);

  const renderAgeDescription = () => {
    const { years, months, days } = stats;
    return formatBabyAge(ACTIVE_BABY_LOCALE, { years, months, days });
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString(BABY_LOCALE_TAG, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const renderMilestoneStatus = (milestone: { labelKey: BabyTranslationKey; reached: boolean; date?: Date }) => {
    const reached = milestone.reached;

    const tint = reached
      ? (isDark ? 'rgba(150,210,178,0.22)' : 'rgba(213,245,231,0.75)')
      : (isDark ? 'rgba(209,170,145,0.2)' : 'rgba(244,236,230,0.78)');

    return (
      <View
        style={[styles.statsMilestoneRow, styles.statsGlassSurface, glassSurfaceStyle]}
      >
        <GlassLayer tint={tint} sheenOpacity={reached ? 0.22 : 0.16} isDark={isDark} />
        <View
          style={[
            styles.statsMilestoneIcon,
            reached ? styles.statsMilestoneIconReached : styles.statsMilestoneIconUpcoming,
            {
              backgroundColor: reached
                ? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.85)')
                : (isDark ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.75)'),
            },
          ]}
        >
          <IconSymbol
            name={reached ? 'star.fill' : 'calendar.badge.exclamationmark'}
            size={18}
            color={reached ? milestoneReachedIconColor : milestoneUpcomingIconColor}
          />
        </View>
        <View style={styles.statsMilestoneInfo}>
          <ThemedText style={[styles.statsMilestoneName, { color: textPrimary }]}>{t(milestone.labelKey)}</ThemedText>
          <ThemedText style={[styles.statsMilestoneDate, { color: textSecondary }]}>
            {reached && milestone.date
              ? t('milestone.reached', { date: formatDate(milestone.date) })
              : t('milestone.upcoming')}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderInterestingFacts = () => {
    if (!birthDateForDisplay) return null;

    const totalMonths = stats.years * 12 + stats.months;
    const heartbeats = Math.round(stats.totalDays * 24 * 60 * getAvgHeartRate(totalMonths));
    const breaths = Math.round(stats.totalDays * 24 * 60 * getAvgBreathRate(totalMonths));
    const diapers = Math.round(stats.totalDays * getAvgDiapers(totalMonths));
    const sleep = Math.round(stats.totalDays * getAvgSleepHours(totalMonths));

    const factItems = [
      {
        key: 'heart',
        label: t('fact.heartbeats'),
        value: heartbeats.toLocaleString(BABY_LOCALE_TAG),
        caption: t('fact.estimated'),
        icon: 'heart.fill' as const,
        accent: pastelPalette.rose,
        iconColor: isDark ? '#FFB8C8' : '#D06262',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'breath',
        label: t('fact.breaths'),
        value: breaths.toLocaleString(BABY_LOCALE_TAG),
        caption: t('fact.sinceBirth'),
        icon: 'wind' as const,
        accent: pastelPalette.sage,
        iconColor: isDark ? '#9BE0CB' : '#5A8F80',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'diapers',
        label: t('fact.diapers'),
        value: diapers.toLocaleString(BABY_LOCALE_TAG),
        caption: t('fact.total'),
        icon: 'drop.fill' as const,
        accent: pastelPalette.honey,
        iconColor: isDark ? '#FFCA9E' : '#B98160',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'sleep',
        label: t('fact.sleepHours'),
        value: sleep.toLocaleString(BABY_LOCALE_TAG),
        caption: t('fact.sinceBirth'),
        icon: 'moon.stars.fill' as const,
        accent: pastelPalette.sky,
        iconColor: isDark ? '#C3B8FF' : '#7A6FD1',
        iconBg: iconBubbleBackground,
      },
    ];

    return (
      <LiquidGlassCard
        style={styles.statsGlassCard}
        intensity={26}
        overlayColor={glassOverlay}
        borderColor={glassBorderColor}
      >
        <View style={styles.statsGlassInner}>
          <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>{t('section.facts')}</ThemedText>
          <View style={styles.statsFactGrid}>
            {factItems.map((fact) => (
              <View key={fact.key} style={[styles.statsFactTile, styles.statsGlassSurface, glassSurfaceStyle]}>
                <GlassLayer tint={fact.accent} sheenOpacity={0.18} isDark={isDark} />
                <View style={[styles.statsFactIcon, { backgroundColor: fact.iconBg }]}>
                  <IconSymbol name={fact.icon} size={18} color={fact.iconColor} />
                </View>
                <ThemedText style={[styles.statsFactLabel, { color: textSecondary }]}>{fact.label}</ThemedText>
                <ThemedText style={[styles.statsFactValue, { color: textPrimary }]}>{fact.value}</ThemedText>
                <ThemedText style={[styles.statsFactCaption, { color: textSecondary }]}>{fact.caption}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </LiquidGlassCard>
    );
  };

  const ageChips = [
    { key: 'years', label: t(stats.years === 1 ? 'unit.year.one' : 'unit.year.other'), value: stats.years, accent: pastelPalette.rose },
    { key: 'months', label: t(stats.months === 1 ? 'unit.month.one' : 'unit.month.other'), value: stats.months, accent: pastelPalette.honey },
    { key: 'days', label: t(stats.days === 1 ? 'unit.day.one' : 'unit.day.other'), value: stats.days, accent: pastelPalette.sky },
  ];

  const statChips = [
    {
      key: 'total-days',
      label: t('stat.totalDays'),
      value: stats.totalDays.toLocaleString(BABY_LOCALE_TAG),
      icon: 'calendar' as const,
      accent: pastelPalette.peach,
      iconColor: isDark ? '#FFC5A7' : '#C17055',
    },
    {
      key: 'total-weeks',
      label: t('stat.weeks'),
      value: stats.totalWeeks.toLocaleString(BABY_LOCALE_TAG),
      icon: 'clock' as const,
      accent: pastelPalette.lavender,
      iconColor: isDark ? '#C2B7FF' : '#7A6FD1',
    },
    {
      key: 'total-months',
      label: t('stat.months'),
      value: stats.totalMonths.toLocaleString(BABY_LOCALE_TAG),
      icon: 'moon.stars.fill' as const,
      accent: pastelPalette.blush,
      iconColor: isDark ? '#FFB6D1' : '#CF6F8B',
    },
  ];

  const bodyMetrics = [
    {
      key: 'height',
      label: t('metric.height'),
      value: babyInfo.height || t('profile.notProvided'),
      icon: 'person.fill' as const,
      accent: pastelPalette.sky,
      iconColor: isDark ? '#B6CEFF' : '#6C87C1',
    },
    {
      key: 'weight',
      label: t('metric.weight'),
      value: babyInfo.weight || t('profile.notProvided'),
      icon: 'chart.bar.fill' as const,
      accent: pastelPalette.honey,
      iconColor: isDark ? '#FFCAA2' : '#B7745D',
    },
    {
      key: 'gender',
      label: t('metric.gender'),
      value: genderLabels[babyInfo.baby_gender as keyof typeof genderLabels] || genderLabels.unknown,
      icon: 'person.2.fill' as const,
      accent: pastelPalette.lavender,
      iconColor: isDark ? '#D1BDFF' : '#8C6AC3',
    },
  ];

  const profileDetails = [
    {
      key: 'gender',
      label: t('profile.gender'),
      value: genderLabels[babyInfo.baby_gender as keyof typeof genderLabels] || genderLabels.unknown,
      icon: 'person.2.fill' as const,
      accent: pastelPalette.lavender,
      iconColor: isDark ? '#D1BDFF' : '#8C6AC3',
    },
    {
      key: 'date',
      label: isBabyBornForCurrentBaby ? t('profile.birthDate') : t('profile.dueDate'),
      value: isBabyBornForCurrentBaby
        ? (birthDateForDisplay ? formatDate(birthDateForDisplay) : t('profile.notSet'))
        : (dueDateForDisplay ? formatDate(dueDateForDisplay) : t('profile.notSet')),
      icon: 'calendar' as const,
      accent: pastelPalette.peach,
      iconColor: isDark ? '#FFC5A7' : '#C17055',
    },
    {
      key: 'bedtime',
      label: t('profile.bedtime'),
      value: babyInfo.preferred_bedtime
        ? bedtimeAnchor
        : `${DEFAULT_BEDTIME_ANCHOR} · ${t('profile.default')}`,
      icon: 'moon.stars.fill' as const,
      accent: pastelPalette.sky,
      iconColor: isDark ? '#C3B8FF' : '#6C78B8',
    },
    ...(isBabyBornForCurrentBaby
      ? [
          {
            key: 'weight',
            label: t('profile.weight'),
            value: babyInfo.weight || t('profile.notSet'),
            icon: 'chart.bar.fill' as const,
            accent: pastelPalette.honey,
            iconColor: isDark ? '#FFCAA2' : '#B7745D',
          },
          {
            key: 'height',
            label: t('profile.height'),
            value: babyInfo.height || t('profile.notSet'),
            icon: 'person.fill' as const,
            accent: pastelPalette.sage,
            iconColor: isDark ? '#9BE0CB' : '#5A8F80',
          },
        ]
      : []),
  ];

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        
        <Header
          title={t('screen.title')}
          subtitle={t('screen.subtitle')}
          showBackButton
          onBackPress={() => {
            triggerHaptic();
            router.push(fallbackHomeRoute as any);
          }}
        />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <LiquidGlassCard style={styles.glassCard} intensity={24} overlayColor={glassOverlay}>
            <View style={styles.glassInner}>
            <View style={[styles.profileHero, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,244,238,0.58)' }]}>
            <View style={styles.photoContainer}>
              {displayPhoto ? (
                <View style={[styles.photoRing, { borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.92)' }]}>
                  <Image source={{ uri: displayPhoto }} style={styles.babyPhoto} contentFit="cover" />
                </View>
              ) : (
                <View style={[styles.placeholderPhoto, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.82)', borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)' }]}>
                  <IconSymbol name="person.fill" size={60} color={isDark ? adaptiveColors.iconSecondary : theme.tabIconDefault} />
                </View>
              )}

              {!isEditing && (
                <TouchableOpacity
                  style={[styles.photoEditBadge, { backgroundColor: isDark ? '#6E5A74' : '#9C7186', borderColor: isDark ? '#342C38' : '#FFFFFF' }]}
                  onPress={() => {
                    triggerHaptic();
                    void pickBabyPhoto({ enterEditMode: true });
                  }}
                  accessibilityLabel={t('photo.change')}
                >
                  <IconSymbol name="camera" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {!isEditing && (
              <View style={styles.profileIdentity}>
                <ThemedText style={[styles.profileName, { color: textPrimary }]} numberOfLines={1}>
                  {babyInfo.name || t('profile.babyFallback')}
                </ThemedText>
                <View style={[styles.statusPill, { backgroundColor: isBabyBornForCurrentBaby ? pastelPalette.sage : pastelPalette.peach, borderColor: glassBorderColor }]}>
                  <IconSymbol
                    name={isBabyBornForCurrentBaby ? 'checkmark.circle.fill' : 'heart.fill'}
                    size={14}
                    color={isBabyBornForCurrentBaby ? (isDark ? '#9BE0CB' : '#5A8F80') : milestoneReachedIconColor}
                  />
                  <ThemedText style={[styles.statusPillText, { color: textSecondary }]}>
                    {isBabyBornForCurrentBaby ? t('profile.statusBorn') : t('profile.statusPregnancy')}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.profileDateLine, { color: textSecondary }]}>
                  {isBabyBornForCurrentBaby ? t('profile.birthDate') : t('profile.dueDate')}: {' '}
                  {isBabyBornForCurrentBaby
                    ? (birthDateForDisplay ? formatDate(birthDateForDisplay) : t('profile.notSet'))
                    : (dueDateForDisplay ? formatDate(dueDateForDisplay) : t('profile.notSet'))}
                </ThemedText>
              </View>
            )}

            {isEditing && (
              <View style={styles.photoHintContainer}>
                    <ThemedText style={[styles.photoHintText, { color: textSecondary }]}>
                      {displayPhoto ? t('photo.adjust') : t('photo.add')}
                    </ThemedText>
                    <View style={styles.photoActionRow}>
                      <TouchableOpacity
                        style={[styles.photoHintButton, { backgroundColor: photoButtonBackground, borderColor: photoButtonBorder }]}
                        onPress={() => {
                          triggerHaptic();
                          void pickBabyPhoto();
                        }}
                        disabled={isSaving}
                      >
                        <IconSymbol name="photo" size={15} color={textPrimary} />
                        <ThemedText style={[styles.photoHintButtonText, { color: textPrimary }]}>
                          {t('photo.choose')}
                        </ThemedText>
                      </TouchableOpacity>
                    {!!displayPhoto && (
                      <TouchableOpacity
                        style={[styles.photoHintButton, { backgroundColor: photoButtonBackground, borderColor: photoButtonBorder }]}
                        onPress={() => {
                          triggerHaptic();
                          removeBabyPhoto();
                        }}
                        disabled={isSaving}
                      >
                        <IconSymbol name="trash" size={15} color={textPrimary} />
                        <ThemedText style={[styles.photoHintButtonText, { color: textPrimary }]}>
                          {t('photo.remove')}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                    </View>
              </View>
            )}
            </View>

            <View style={styles.infoContainer}>
              {showCreatedHint && (
                <View style={styles.createdHintBox}>
                  <ThemedText style={[styles.createdHintText, { color: textSecondary }]}>
                    {t('created.hint')}
                  </ThemedText>
                </View>
              )}
              {isEditing ? (
                <>
                  <View style={styles.inputRow}>
                    <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.name')}</ThemedText>
                    <TextInput
                      style={[styles.glassInput, { color: textPrimary, backgroundColor: inputBackground, borderColor: inputBorder }]}
                      value={babyInfo.name}
                      onChangeText={(text) => setBabyInfo({ ...babyInfo, name: text })}
                      placeholder={t('form.namePlaceholder')}
                      placeholderTextColor={textTertiary}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.isBorn')}</ThemedText>
                    <View style={[styles.switchRow, { backgroundColor: inputBackground, borderColor: inputBorder }]}>
                      <ThemedText style={[styles.switchValue, { color: textPrimary }]}>
                        {isBabyBornForCurrentBaby ? t('form.yes') : t('form.no')}
                      </ThemedText>
                      <Switch
                        value={isBabyBornForCurrentBaby}
                        onValueChange={(value) => {
                          setIsBabyBornForCurrentBaby(value);
                          if (!value) {
                            setBabyInfo((current) => ({
                              ...current,
                              birth_date: null,
                              weight: '',
                              height: '',
                            }));
                          } else {
                            setDueDate(null);
                          }
                        }}
                        trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                        thumbColor={isBabyBornForCurrentBaby ? '#FFFFFF' : '#F4F4F4'}
                        ios_backgroundColor="#D1D1D6"
                      />
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.gender')}</ThemedText>
                    <View style={styles.choiceRow}>
                      <TouchableOpacity
                        style={[
                          styles.choiceButton,
                          {
                            backgroundColor: babyInfo.baby_gender === 'male' ? 'rgba(135, 206, 235, 0.9)' : inputBackground,
                            borderColor: babyInfo.baby_gender === 'male' ? 'rgba(255,255,255,0.65)' : inputBorder,
                          },
                        ]}
                        onPress={() => setBabyInfo({ ...babyInfo, baby_gender: 'male' })}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={[styles.choiceButtonText, { color: babyInfo.baby_gender === 'male' ? '#FFFFFF' : textPrimary }]}>{t('form.genderBoy')}</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.choiceButton,
                          {
                            backgroundColor: babyInfo.baby_gender === 'female' ? 'rgba(255, 179, 193, 0.9)' : inputBackground,
                            borderColor: babyInfo.baby_gender === 'female' ? 'rgba(255,255,255,0.65)' : inputBorder,
                          },
                        ]}
                        onPress={() => setBabyInfo({ ...babyInfo, baby_gender: 'female' })}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={[styles.choiceButtonText, { color: babyInfo.baby_gender === 'female' ? '#FFFFFF' : textPrimary }]}>{t('form.genderGirl')}</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.choiceButton,
                          {
                            backgroundColor: babyInfo.baby_gender === 'unknown' || !babyInfo.baby_gender ? accentButtonBackground : inputBackground,
                            borderColor: babyInfo.baby_gender === 'unknown' || !babyInfo.baby_gender ? accentButtonBorder : inputBorder,
                          },
                        ]}
                        onPress={() => setBabyInfo({ ...babyInfo, baby_gender: 'unknown' })}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={[styles.choiceButtonText, { color: textPrimary }]}>{t('form.genderOpen')}</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {!isBabyBornForCurrentBaby ? (
                    <View style={styles.inputRow}>
                      <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.dueDate')}</ThemedText>
                      <TouchableOpacity
                        style={[styles.glassDateButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                        onPress={() => {
                          triggerHaptic();
                          setShowDueDatePicker(true);
                        }}
                      >
                        <ThemedText style={[styles.dateText, { color: textPrimary }]}>
                          {dueDateForDisplay ? formatDate(dueDateForDisplay) : t('form.chooseDueDate')}
                        </ThemedText>
                        <IconSymbol name="calendar" size={20} color={textPrimary} />
                      </TouchableOpacity>

                      {showDueDatePicker && Platform.OS === 'android' && (
                        <DateTimePicker
                          value={dueDatePickerValue}
                          mode="date"
                          display="default"
                          onChange={handleDueDateChange}
                          minimumDate={dueDateBounds.minimumDate}
                          maximumDate={dueDateBounds.maximumDate}
                          textColor={isDark ? '#FFFFFF' : undefined}
                        />
                      )}
                      {Platform.OS === 'ios' && (
                        <IOSBottomDatePicker
                          visible={showDueDatePicker}
                          title={t('form.dueDatePickerTitle')}
                          value={dueDatePickerValue}
                          mode="date"
                          minimumDate={dueDateBounds.minimumDate}
                          maximumDate={dueDateBounds.maximumDate}
                          onClose={() => setShowDueDatePicker(false)}
                          onConfirm={handleIOSDueDateConfirm}
                          initialVariant="calendar"
                          confirmLabel={t('form.done')}
                          cancelLabel={t('form.cancel')}
                          locale={BABY_LOCALE_TAG}
                        />
                      )}
                    </View>
                  ) : (
                    <View style={styles.inputRow}>
                      <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.birthDate')}</ThemedText>
                      <TouchableOpacity
                        style={[styles.glassDateButton, { backgroundColor: inputBackground, borderColor: inputBorder }]}
                        onPress={() => {
                          triggerHaptic();
                          setShowDatePicker(true);
                        }}
                      >
                        <ThemedText style={[styles.dateText, { color: textPrimary }]}>
                          {birthDateForDisplay
                            ? formatDate(birthDateForDisplay)
                            : t('form.chooseBirthDate')}
                        </ThemedText>
                        <IconSymbol name="calendar" size={20} color={textPrimary} />
                      </TouchableOpacity>

                      {showDatePicker && Platform.OS === 'android' && (
                        <DateTimePicker
                          value={birthDatePickerValue}
                          mode="date"
                          display="default"
                          onChange={handleDateChange}
                          minimumDate={birthDateBounds.minimumDate}
                          maximumDate={birthDateBounds.maximumDate}
                          textColor={isDark ? '#FFFFFF' : undefined}
                        />
                      )}
                      {Platform.OS === 'ios' && (
                        <IOSBottomDatePicker
                          visible={showDatePicker}
                          title={t('form.birthDatePickerTitle')}
                          value={birthDatePickerValue}
                          mode="date"
                          minimumDate={birthDateBounds.minimumDate}
                          maximumDate={birthDateBounds.maximumDate}
                          onClose={() => setShowDatePicker(false)}
                          onConfirm={handleIOSBirthDateConfirm}
                          initialVariant="calendar"
                          confirmLabel={t('form.done')}
                          cancelLabel={t('form.cancel')}
                          locale={BABY_LOCALE_TAG}
                        />
                      )}
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.bedtime')}</ThemedText>

                    <TextInput
                      style={[styles.glassInput, styles.bedtimeManualInput, { color: textPrimary, backgroundColor: inputBackground, borderColor: inputBorder }]}
                      value={bedtimeInput}
                      onChangeText={(text) => {
                        setBedtimeInput(formatBedtimeInputValue(text));
                        setBedtimeInputError(null);
                      }}
                      onBlur={() => {
                        if (!isEditing) return;
                        commitBedtimeInput(bedtimeInput);
                      }}
                      onSubmitEditing={() => {
                        commitBedtimeInput(bedtimeInput);
                      }}
                      placeholder={t('form.bedtimePlaceholder')}
                      placeholderTextColor={textTertiary}
                      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                      maxLength={5}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="done"
                    />
                    {bedtimeInputError ? (
                      <ThemedText
                        style={[
                          styles.bedtimeValidationText,
                          { color: isDark ? '#FFB3B3' : '#C0392B' },
                        ]}
                      >
                        {bedtimeInputError}
                      </ThemedText>
                    ) : null}

                    <ThemedText style={[styles.photoHintText, { color: textSecondary, textAlign: 'left', marginTop: 8, marginBottom: 0 }]}>
                      {t('form.bedtimeHelp')}
                    </ThemedText>
                  </View>

                  {isBabyBornForCurrentBaby && (
                    <>
                      <View style={styles.inputRow}>
                        <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.weight')}</ThemedText>
                        <TextInput
                          style={[styles.glassInput, { color: textPrimary, backgroundColor: inputBackground, borderColor: inputBorder }]}
                          value={babyInfo.weight}
                          onChangeText={(text) => setBabyInfo({ ...babyInfo, weight: text })}
                          placeholder={t('form.weightPlaceholder')}
                          placeholderTextColor={textTertiary}
                        />
                      </View>

                      <View style={styles.inputRow}>
                        <ThemedText style={[styles.label, { color: textSecondary }]}>{t('form.height')}</ThemedText>
                        <TextInput
                          style={[styles.glassInput, { color: textPrimary, backgroundColor: inputBackground, borderColor: inputBorder }]}
                          value={babyInfo.height}
                          onChangeText={(text) => setBabyInfo({ ...babyInfo, height: text })}
                          placeholder={t('form.heightPlaceholder')}
                          placeholderTextColor={textTertiary}
                        />
                      </View>
                    </>
                  )}

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
                        setPendingPhoto(null);
                        setIsPhotoRemoved(false);
                        setIsEditing(false);
                        loadBabyInfo(); // Zurücksetzen auf gespeicherte Daten
                      }}
                      disabled={isSaving}
                    >
                      <ThemedText style={[styles.buttonText, { color: textPrimary }]}>
                        {t('form.cancel')}
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.saveButton, { backgroundColor: accentButtonBackground, borderColor: accentButtonBorder }]}
                      onPress={() => {
                        triggerHaptic();
                        handleSave();
                      }}
                      disabled={isSaving}
                    >
                      <ThemedText style={[styles.buttonText, { color: textPrimary }]}>
                        {t('form.save')}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.profileDetailList}>
                    {profileDetails.map((detail) => (
                      <View
                        key={detail.key}
                        style={[styles.profileDetailRow, styles.statsGlassSurface, glassSurfaceStyle]}
                      >
                        <GlassLayer tint={detail.accent} sheenOpacity={0.15} isDark={isDark} />
                        <View style={[styles.profileDetailIcon, { backgroundColor: iconBubbleBackground }]}>
                          <IconSymbol name={detail.icon} size={17} color={detail.iconColor} />
                        </View>
                        <View style={styles.profileDetailCopy}>
                          <ThemedText style={[styles.profileDetailLabel, { color: textSecondary }]}>
                            {detail.label}
                          </ThemedText>
                          <ThemedText style={[styles.profileDetailValue, { color: textPrimary }]} numberOfLines={2}>
                            {detail.value}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.button, styles.editButton, { backgroundColor: accentButtonBackground, borderColor: accentButtonBorder }]}
                    onPress={() => {
                      triggerHaptic();
                      setIsEditing(true);
                    }}
                  >
                    <IconSymbol name="pencil" size={16} color={textPrimary} />
                    <ThemedText style={[styles.buttonText, { color: textPrimary }]}>
                      {t('profile.edit')}
                    </ThemedText>
                  </TouchableOpacity>
                </>
              )}
            </View>
            </View>
          </LiquidGlassCard>

          {babyInfo.birth_date ? (
            <>
              <LiquidGlassCard
                style={[styles.statsGlassCard, styles.statsFirstGlassCard]}
                intensity={26}
                overlayColor={glassOverlay}
                borderColor={glassBorderColor}
              >
                <View style={styles.statsGlassInner}>
                  <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>{t('section.age')}</ThemedText>

                  <View style={[styles.statsAgeHighlight, styles.statsGlassSurface, glassSurfaceStyle]}>
                    <GlassLayer
                      tint={isDark ? 'rgba(255, 177, 138, 0.24)' : 'rgba(255,232,220,0.75)'}
                      sheenOpacity={0.22}
                      isDark={isDark}
                    />
                    <View style={[styles.statsAgeHighlightIcon, { backgroundColor: iconBubbleBackground }]}>
                      <IconSymbol name="clock" size={18} color={milestoneReachedIconColor} />
                    </View>
                    <View style={styles.statsAgeHighlightText}>
                      <ThemedText style={[styles.statsAgeValue, { color: textPrimary }]}>{renderAgeDescription()}</ThemedText>
                      <ThemedText style={[styles.statsAgeSubline, { color: textSecondary }]}>{t('section.today')}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.statsAgeChipRow}>
                    {ageChips.map((chip) => (
                      <View key={chip.key} style={[styles.statsAgeChip, styles.statsGlassSurface, glassSurfaceStyle]}>
                        <GlassLayer tint={chip.accent} sheenOpacity={0.25} isDark={isDark} />
                        <ThemedText style={[styles.statsAgeChipValue, { color: textPrimary }]}>{chip.value}</ThemedText>
                        <ThemedText style={[styles.statsAgeChipLabel, { color: textSecondary }]}>{chip.label}</ThemedText>
                      </View>
                    ))}
                  </View>

                  <View style={styles.statsStatRow}>
                    {statChips.map((stat) => (
                      <View key={stat.key} style={[styles.statsStatItem, styles.statsGlassSurface, glassSurfaceStyle]}>
                        <GlassLayer tint={stat.accent} sheenOpacity={0.2} isDark={isDark} />
                        <View style={[styles.statsStatIcon, { backgroundColor: iconBubbleBackground }]}>
                          <IconSymbol name={stat.icon} size={16} color={stat.iconColor} />
                        </View>
                        <ThemedText style={[styles.statsStatValue, { color: textPrimary }]}>{stat.value}</ThemedText>
                        <ThemedText style={[styles.statsStatLabel, { color: textSecondary }]}>{stat.label}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              </LiquidGlassCard>

              <LiquidGlassCard
                style={styles.statsGlassCard}
                intensity={26}
                overlayColor={glassOverlay}
                borderColor={glassBorderColor}
              >
                <View style={styles.statsGlassInner}>
                  <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>{t('section.birthData')}</ThemedText>
                  <View style={styles.statsBodyGrid}>
                    {bodyMetrics.map((metric) => (
                      <View key={metric.key} style={[styles.statsBodyBadge, styles.statsGlassSurface, glassSurfaceStyle]}>
                        <GlassLayer tint={metric.accent} sheenOpacity={0.18} isDark={isDark} />
                        <View style={[styles.statsBodyIcon, { backgroundColor: iconBubbleBackground }]}>
                          <IconSymbol name={metric.icon} size={18} color={metric.iconColor} />
                        </View>
                        <View style={styles.statsBodyCopy}>
                          <ThemedText style={[styles.statsBodyValue, { color: textPrimary }]}>{metric.value}</ThemedText>
                          <ThemedText style={[styles.statsBodyLabel, { color: textSecondary }]}>{metric.label}</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </LiquidGlassCard>

              {renderInterestingFacts()}

              <LiquidGlassCard
                style={styles.statsGlassCard}
                intensity={26}
                overlayColor={glassOverlay}
                borderColor={glassBorderColor}
              >
                <View style={styles.statsGlassInner}>
                  <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>{t('section.milestones')}</ThemedText>
                  <View style={styles.statsMilestoneContainer}>
                    {stats.milestones.map((milestone, index) => (
                      <View key={index}>
                        {renderMilestoneStatus(milestone)}
                      </View>
                    ))}
                  </View>
                </View>
              </LiquidGlassCard>
            </>
          ) : (
            <LiquidGlassCard
              style={styles.statsGlassCard}
              intensity={26}
              overlayColor={glassOverlay}
              borderColor={glassBorderColor}
            >
              <View style={styles.statsGlassInner}>
                <ThemedText style={[styles.statsNoDataText, { color: textSecondary }]}>
                  {t('section.noBirthDate')}
                </ThemedText>
              </View>
            </LiquidGlassCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

  const registerForPushNotificationsAsync = async () => {
    try {
      const existingPermissions = await Notifications.getPermissionsAsync();
      let granted = existingPermissions.granted;
      
      if (!granted) {
        const requestedPermissions = await Notifications.requestPermissionsAsync();
        granted = requestedPermissions.granted;
      }
      
      if (!granted) {
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
    borderRadius: 26,
    overflow: 'hidden',
  },
  glassInner: {
    padding: 14,
    gap: 16,
  },
  profileHero: {
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderCurve: 'continuous',
  },
  photoContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  photoRing: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 4,
    padding: 3,
    borderCurve: 'continuous',
    boxShadow: '0 10px 24px rgba(92, 64, 51, 0.14)',
  },
  babyPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 58,
  },
  placeholderPhoto: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
    boxShadow: '0 10px 24px rgba(92, 64, 51, 0.12)',
  },
  photoEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIdentity: {
    alignItems: 'center',
    paddingTop: 14,
    gap: 8,
    width: '100%',
  },
  profileName: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  profileDateLine: {
    fontSize: 13,
    textAlign: 'center',
  },
  photoHintContainer: {
    paddingTop: 14,
    alignItems: 'center',
    gap: 10,
  },
  photoActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  photoHintText: {
    fontSize: 14,
    textAlign: 'center',
  },
  photoHintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  profileDetailList: {
    gap: 9,
  },
  profileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderCurve: 'continuous',
  },
  profileDetailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetailCopy: {
    flex: 1,
    paddingLeft: 12,
  },
  profileDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  profileDetailValue: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    paddingTop: 1,
  },
  createdHintBox: {
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.2)',
    backgroundColor: 'rgba(233, 201, 182, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  createdHintText: {
    fontSize: 13,
    fontWeight: '600',
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
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
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
  bedtimeManualInput: {
    marginTop: 10,
  },
  bedtimeValidationText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  editButton: {
    backgroundColor: 'rgba(142, 78, 198, 0.16)',
    borderColor: 'rgba(142, 78, 198, 0.35)',
    borderWidth: 1,
    marginTop: 14,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    flex: 1,
  },
  saveButton: {
    backgroundColor: 'rgba(142, 78, 198, 0.16)',
    borderColor: 'rgba(142, 78, 198, 0.35)',
    borderWidth: 1,
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsGlassSurface: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statsGlassLayerGradient: {
    ...StyleSheet.absoluteFill,
  },
  statsGlassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statsGlassCard: {
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
    borderRadius: 22,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  statsGlassInner: {
    padding: 20,
  },
  statsFirstGlassCard: {
    marginTop: 12,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  statsAgeHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsAgeHighlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statsAgeHighlightText: {
    flex: 1,
  },
  statsAgeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: HEADER_TEXT_COLOR,
  },
  statsAgeSubline: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.75,
    marginTop: 2,
  },
  statsAgeChipRow: {
    flexDirection: 'row',
    marginBottom: 6,
    marginTop: 4,
  },
  statsAgeChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statsAgeChipValue: {
    fontSize: 18,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
  },
  statsAgeChipLabel: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
  },
  statsStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statsStatItem: {
    alignItems: 'center',
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginHorizontal: 4,
  },
  statsStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statsStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: HEADER_TEXT_COLOR,
  },
  statsStatLabel: {
    fontSize: 12,
    marginTop: 2,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
    textAlign: 'center',
  },
  statsBodyGrid: {
    marginTop: 4,
  },
  statsBodyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
  },
  statsBodyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statsBodyCopy: {
    flex: 1,
  },
  statsBodyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
  },
  statsBodyLabel: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
    marginTop: 2,
  },
  statsFactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statsFactTile: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  statsFactIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsFactLabel: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statsFactValue: {
    fontSize: 18,
    fontWeight: '800',
    color: HEADER_TEXT_COLOR,
  },
  statsFactCaption: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
    marginTop: 2,
  },
  statsMilestoneContainer: {
    marginTop: 8,
  },
  statsMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  statsMilestoneIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statsMilestoneIconReached: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  statsMilestoneIconUpcoming: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  statsMilestoneInfo: {
    flex: 1,
  },
  statsMilestoneName: {
    fontSize: 16,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
  },
  statsMilestoneDate: {
    fontSize: 12,
    marginTop: 2,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
  },
  statsNoDataText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
    color: HEADER_TEXT_COLOR,
  },
});
