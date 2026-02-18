import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, TextInput, Alert, SafeAreaView, StatusBar, Platform, BackHandler } from 'react-native';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
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
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  bedtimeAnchorToDate,
  dateToBedtimeAnchor,
  DEFAULT_BEDTIME_ANCHOR,
  normalizeBedtimeAnchor,
} from '@/lib/bedtime';
import {
  differenceInYears,
  differenceInMonths,
  differenceInDays,
  addMonths,
  addDays,
} from 'date-fns';

const initialStats = {
  years: 0,
  months: 0,
  days: 0,
  totalDays: 0,
  totalWeeks: 0,
  totalMonths: 0,
  milestones: [] as { name: string; reached: boolean; date?: Date }[],
};

const HEADER_TEXT_COLOR = '#7D5A50';

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
  const { activeBabyId, refreshBabies, isReady } = useActiveBaby();
  const { refreshBabyDetails } = useBabyStatus();
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string | string[]; created?: string | string[] }>();

  // Set fallback route for smart back navigation
  useSmartBack('/(tabs)/home');

  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBedtimePicker, setShowBedtimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<{status: string, isRegistered: boolean} | null>(null);

  const editParamValue = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const createdParamValue = Array.isArray(params.created) ? params.created[0] : params.created;
  const autoOpenEdit = editParamValue === '1' || editParamValue === 'true';
  const showCreatedHint = createdParamValue === '1' || createdParamValue === 'true';

  useEffect(() => {
    if (autoOpenEdit) {
      setIsEditing(true);
    }
  }, [autoOpenEdit]);

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

  const getAvgHeartRate = (ageMonths: number) =>
    ageMonths < 1 ? 140 : ageMonths < 6 ? 130 : 120;

  const getAvgBreathRate = (ageMonths: number) =>
    ageMonths < 1 ? 40 : ageMonths < 6 ? 35 : 30;

  const getAvgDiapers = (ageMonths: number) =>
    ageMonths < 1 ? 10 : ageMonths < 3 ? 8 : ageMonths < 12 ? 6 : 4;

  const getAvgSleepHours = (ageMonths: number) =>
    ageMonths < 1 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;

  const genderLabels = {
    male: 'Männlich',
    female: 'Weiblich',
    unknown: 'Nicht angegeben',
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

  const computeStats = (birthDate: Date) => {
    const now = new Date();
    const years = differenceInYears(now, birthDate);
    const months = differenceInMonths(now, addMonths(birthDate, years * 12));
    const days = differenceInDays(now, addMonths(birthDate, years * 12 + months));
    const totalDays = differenceInDays(now, birthDate);
    const totalWeeks = Math.floor(totalDays / 7);
    const totalMonths = years * 12 + months;

    const milestoneDefinitions = [
      { name: '1 Woche', addFn: () => addDays(birthDate, 7) },
      { name: '1 Monat', addFn: () => addMonths(birthDate, 1) },
      { name: '2 Monate', addFn: () => addMonths(birthDate, 2) },
      { name: '3 Monate', addFn: () => addMonths(birthDate, 3) },
      { name: '100 Tage', addFn: () => addDays(birthDate, 100) },
      { name: '6 Monate', addFn: () => addMonths(birthDate, 6) },
      { name: '1 Jahr', addFn: () => addMonths(birthDate, 12) },
      { name: '500 Tage', addFn: () => addDays(birthDate, 500) },
      { name: '1000 Tage', addFn: () => addDays(birthDate, 1000) },
      { name: '1111 Tage', addFn: () => addDays(birthDate, 1111) },
    ];

    const milestones = milestoneDefinitions.map(({ name, addFn }) => {
      const date = addFn();
      const reached = now >= date;
      return { name, reached, date: reached ? date : undefined };
    });

    return { years, months, days, totalDays, totalWeeks, totalMonths, milestones };
  };

  const stats = useMemo(() => {
    if (!babyInfo.birth_date) return initialStats;
    return computeStats(new Date(babyInfo.birth_date));
  }, [babyInfo.birth_date]);

  const renderAgeDescription = () => {
    const { years, months, days } = stats;

    if (years > 0) {
      return `${years} Jahr${years !== 1 ? 'e' : ''}, ${months} Monat${months !== 1 ? 'e' : ''} und ${days} Tag${days !== 1 ? 'e' : ''}`;
    }

    if (months > 0) {
      return `${months} Monat${months !== 1 ? 'e' : ''} und ${days} Tag${days !== 1 ? 'e' : ''}`;
    }

    return `${days} Tag${days !== 1 ? 'e' : ''}`;
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const renderMilestoneStatus = (milestone: { name: string; reached: boolean; date?: Date }) => {
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
          <ThemedText style={[styles.statsMilestoneName, { color: textPrimary }]}>{milestone.name}</ThemedText>
          <ThemedText style={[styles.statsMilestoneDate, { color: textSecondary }]}>
            {reached && milestone.date ? `Erreicht am ${formatDate(milestone.date)}` : 'Noch nicht erreicht'}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderInterestingFacts = () => {
    if (!babyInfo.birth_date) return null;

    const totalMonths = stats.years * 12 + stats.months;
    const heartbeats = Math.round(stats.totalDays * 24 * 60 * getAvgHeartRate(totalMonths));
    const breaths = Math.round(stats.totalDays * 24 * 60 * getAvgBreathRate(totalMonths));
    const diapers = Math.round(stats.totalDays * getAvgDiapers(totalMonths));
    const sleep = Math.round(stats.totalDays * getAvgSleepHours(totalMonths));

    const factItems = [
      {
        key: 'heart',
        label: 'Herzschläge',
        value: heartbeats.toLocaleString('de-DE'),
        caption: 'geschätzt',
        icon: 'heart.fill' as const,
        accent: pastelPalette.rose,
        iconColor: isDark ? '#FFB8C8' : '#D06262',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'breath',
        label: 'Atemzüge',
        value: breaths.toLocaleString('de-DE'),
        caption: 'seit Geburt',
        icon: 'wind' as const,
        accent: pastelPalette.sage,
        iconColor: isDark ? '#9BE0CB' : '#5A8F80',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'diapers',
        label: 'Windeln',
        value: diapers.toLocaleString('de-DE'),
        caption: 'insgesamt',
        icon: 'drop.fill' as const,
        accent: pastelPalette.honey,
        iconColor: isDark ? '#FFCA9E' : '#B98160',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'sleep',
        label: 'Schlafstunden',
        value: sleep.toLocaleString('de-DE'),
        caption: 'seit Geburt',
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
          <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>Interessante Fakten</ThemedText>
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
    { key: 'years', label: 'Jahre', value: stats.years, accent: pastelPalette.rose },
    { key: 'months', label: 'Monate', value: stats.months, accent: pastelPalette.honey },
    { key: 'days', label: 'Tage', value: stats.days, accent: pastelPalette.sky },
  ];

  const statChips = [
    {
      key: 'total-days',
      label: 'Tage gesamt',
      value: stats.totalDays.toLocaleString('de-DE'),
      icon: 'calendar' as const,
      accent: pastelPalette.peach,
      iconColor: isDark ? '#FFC5A7' : '#C17055',
    },
    {
      key: 'total-weeks',
      label: 'Wochen',
      value: stats.totalWeeks.toLocaleString('de-DE'),
      icon: 'clock' as const,
      accent: pastelPalette.lavender,
      iconColor: isDark ? '#C2B7FF' : '#7A6FD1',
    },
    {
      key: 'total-months',
      label: 'Monate',
      value: stats.totalMonths.toLocaleString('de-DE'),
      icon: 'moon.stars.fill' as const,
      accent: pastelPalette.blush,
      iconColor: isDark ? '#FFB6D1' : '#CF6F8B',
    },
  ];

  const bodyMetrics = [
    {
      key: 'height',
      label: 'Größe',
      value: babyInfo.height ? `${babyInfo.height} cm` : 'Nicht angegeben',
      icon: 'person.fill' as const,
      accent: pastelPalette.sky,
      iconColor: isDark ? '#B6CEFF' : '#6C87C1',
    },
    {
      key: 'weight',
      label: 'Gewicht',
      value: babyInfo.weight ? `${babyInfo.weight} kg` : 'Nicht angegeben',
      icon: 'chart.bar.fill' as const,
      accent: pastelPalette.honey,
      iconColor: isDark ? '#FFCAA2' : '#B7745D',
    },
    {
      key: 'gender',
      label: 'Geschlecht',
      value: genderLabels[babyInfo.baby_gender as keyof typeof genderLabels] || genderLabels.unknown,
      icon: 'person.2.fill' as const,
      accent: pastelPalette.lavender,
      iconColor: isDark ? '#D1BDFF' : '#8C6AC3',
    },
  ];

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
              {showCreatedHint && (
                <View style={styles.createdHintBox}>
                  <ThemedText style={[styles.createdHintText, { color: textSecondary }]}>
                    Neues Kind angelegt. Trage jetzt die wichtigsten Daten ein.
                  </ThemedText>
                </View>
              )}
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

          {babyInfo.birth_date ? (
            <>
              <LiquidGlassCard
                style={[styles.statsGlassCard, styles.statsFirstGlassCard]}
                intensity={26}
                overlayColor={glassOverlay}
                borderColor={glassBorderColor}
              >
                <View style={styles.statsGlassInner}>
                  <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>Alter</ThemedText>

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
                      <ThemedText style={[styles.statsAgeSubline, { color: textSecondary }]}>Stand heute</ThemedText>
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
                  <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>Geburtsdaten</ThemedText>
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
                  <ThemedText style={[styles.statsSectionTitle, { color: textSecondary }]}>Meilensteine</ThemedText>
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
                  Kein Geburtsdatum verfügbar. Bitte füge das Geburtsdatum deines Babys hinzu, um Statistiken anzuzeigen.
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
    ...StyleSheet.absoluteFillObject,
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
