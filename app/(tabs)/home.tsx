/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Animated, Easing, StyleSheet, ScrollView, View, TouchableOpacity, Text, SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl, Alert, Platform, StyleProp, ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter , useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { supabase, addBabyCareEntry, getBabyCareEntriesForDate } from '@/lib/supabase';
import { useAdvisorAccess } from '@/lib/advisor/access';
import { useVoiceLogAccess } from '@/lib/voiceLog/access';
import { useAskLottiAccess } from '@/lib/askLotti/access';
import VoiceLogModal from '@/components/VoiceLogModal';
import PremiumHighlights, {
  type PremiumHighlightItem,
} from '@/components/PremiumHighlights';
import { BlurView } from 'expo-blur';
import ActivityInputModal from '@/components/ActivityInputModal';
import NightWakePrompt from '@/components/NightWakePrompt';
import { useNightWakePrompt } from '@/hooks/useNightWakePrompt';
import SleepQuickAddModal, { SleepQuickEntry } from '@/components/SleepQuickAddModal';
import BabySwitcherButton from '@/components/BabySwitcherButton';
import { LottiWeekCard } from '@/components/LottiWeekCard';
import { LottiWeekRing } from '@/components/LottiWeekRing';
import { loadCachedHomeData, cacheHomeData, isCacheFresh, type HomeCacheScope } from '@/lib/homeCache';
import { getLocalProfileName } from '@/lib/localProfile';
import { buildFeedingOverview } from '@/lib/feedingOverview';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import type { SleepEntry } from '@/lib/sleepData';
import { cancelBabyReminderNotification } from '@/lib/babyReminderNotifications';
import { cancelLocalFeedingReminders } from '@/lib/feedingReminderNotifications';
import { shouldCancelStaleReminderAfterManualEntry } from '@/lib/reminderCancellationGuards';
import { emitLottiMoment } from '@/lib/lottiMomentEvents';
import BaseSortableTileGrid, { type SortableTileGridScrollMetrics } from '@/components/SortableTileGrid';
import {
  featureAllowedForTier,
  useSubscriptionTier,
  type AppFeature,
} from '@/lib/entitlements';
import {
  DEFAULT_HOME_LOCALE,
  getHomeLocaleTag,
  HomeTranslationKey,
  translateHomeText,
} from '@/lib/homeTranslations';
import { useFontScale, useLineLimit, useTileGridMetrics } from '@/lib/fontScaling';

let ACTIVE_HOME_LOCALE = DEFAULT_HOME_LOCALE;
let HOME_LOCALE_TAG = getHomeLocaleTag(ACTIVE_HOME_LOCALE);
const t = (key: HomeTranslationKey, params?: Record<string, string | number>) =>
  translateHomeText(ACTIVE_HOME_LOCALE, key, params);

type HomeActiveTimer = {
  source: 'sleep' | 'daily';
  start: number;
  route: '/(tabs)/sleep-tracker' | '/(tabs)/daily_old';
  label: string;
  title: string;
  hint: string;
  iconName: string;
  accentColor: string;
  accentBackground: string;
};

type HomeQuickAccessCardId =
  | 'recipe-generator'
  | 'shopping-list'
  | 'baby'
  | 'planner'
  | 'daily'
  | 'selfcare'
  | 'babyweather'
  | 'recommendations'
  | 'weight-tracker'
  | 'size-tracker'
  | 'tooth-tracker'
  | 'period-tracker'
  | 'milestones';

type HomeQuickAccessCardConfig = {
  id: HomeQuickAccessCardId;
  title: string;
  description: string;
  iconName: string;
  destination: any;
  cardBackgroundColor: string;
  iconBackgroundColor: string;
  blurIntensity?: number;
};

type HomeQuickAccessCardDefinition = Omit<HomeQuickAccessCardConfig, 'title' | 'description'> & {
  titleKey: HomeTranslationKey;
  descriptionKey: HomeTranslationKey;
};

const HOME_QUICK_ACCESS_ORDER_STORAGE_PREFIX = 'home_quick_access_order';
const HOME_QUICK_ACCESS_HIDDEN_STORAGE_PREFIX = 'home_quick_access_hidden';

// Kacheln, die in Tiers ohne das jeweilige Feature komplett ausgeblendet
// werden (kleinteilige Features ohne Lock-Screen). Gesperrte Flaggschiff-
// Features (Planer, Einkauf) bleiben sichtbar und führen zum Lock-Screen.
const QUICK_ACCESS_CARD_FEATURES: Partial<
  Record<HomeQuickAccessCardId, AppFeature>
> = {
  'recipe-generator': 'recipes',
};

const HOME_QUICK_ACCESS_CARD_DEFINITIONS: HomeQuickAccessCardDefinition[] = [
  {
    id: 'recipe-generator',
    titleKey: 'card.recipes.title',
    descriptionKey: 'card.recipes.description',
    iconName: 'fork.knife',
    destination: '/recipe-generator',
    cardBackgroundColor: 'rgba(168, 196, 193, 0.6)',
    iconBackgroundColor: 'rgba(168, 196, 193, 0.9)',
  },
  {
    id: 'shopping-list',
    titleKey: 'card.shopping.title',
    descriptionKey: 'card.shopping.description',
    iconName: 'cart',
    destination: {
      pathname: '/shopping-list',
      params: { returnTo: 'home' },
    },
    cardBackgroundColor: 'rgba(210, 235, 215, 0.6)',
    iconBackgroundColor: 'rgba(140, 200, 150, 0.9)',
  },
  {
    id: 'baby',
    titleKey: 'card.baby.title',
    descriptionKey: 'card.baby.description',
    iconName: 'person.fill',
    destination: '/(tabs)/baby',
    cardBackgroundColor: 'rgba(255, 190, 190, 0.6)',
    iconBackgroundColor: 'rgba(255, 140, 160, 0.9)',
  },
  {
    id: 'planner',
    titleKey: 'card.planner.title',
    descriptionKey: 'card.planner.description',
    iconName: 'calendar',
    destination: '/planner',
    cardBackgroundColor: 'rgba(220, 200, 255, 0.6)',
    iconBackgroundColor: 'rgba(200, 130, 220, 0.9)',
  },
  {
    id: 'daily',
    titleKey: 'card.daily.title',
    descriptionKey: 'card.daily.description',
    iconName: 'list.bullet',
    destination: '/(tabs)/daily_old',
    cardBackgroundColor: 'rgba(255, 215, 180, 0.6)',
    iconBackgroundColor: 'rgba(255, 180, 130, 0.9)',
  },
  {
    id: 'selfcare',
    titleKey: 'card.selfcare.title',
    descriptionKey: 'card.selfcare.description',
    iconName: 'heart.fill',
    destination: '/(tabs)/selfcare',
    cardBackgroundColor: 'rgba(255, 210, 230, 0.6)',
    iconBackgroundColor: 'rgba(255, 160, 180, 0.9)',
  },
  {
    id: 'babyweather',
    titleKey: 'card.weather.title',
    descriptionKey: 'card.weather.description',
    iconName: 'cloud.sun.fill',
    destination: '/(tabs)/babyweather',
    cardBackgroundColor: 'rgba(200, 225, 255, 0.6)',
    iconBackgroundColor: 'rgba(140, 190, 255, 0.9)',
    blurIntensity: 16,
  },
  {
    id: 'recommendations',
    titleKey: 'card.shop.title',
    descriptionKey: 'card.shop.description',
    iconName: 'bag.fill',
    destination: '/prints-shop',
    cardBackgroundColor: 'rgba(255, 235, 200, 0.6)',
    iconBackgroundColor: 'rgba(255, 200, 120, 0.9)',
  },
  {
    id: 'weight-tracker',
    titleKey: 'card.weight.title',
    descriptionKey: 'card.weight.description',
    iconName: 'chart.line.uptrend.xyaxis',
    destination: '/(tabs)/weight-tracker',
    cardBackgroundColor: 'rgba(200, 240, 200, 0.6)',
    iconBackgroundColor: 'rgba(130, 210, 130, 0.9)',
  },
  {
    id: 'size-tracker',
    titleKey: 'card.size.title',
    descriptionKey: 'card.size.description',
    iconName: 'ruler',
    destination: '/(tabs)/size-tracker',
    cardBackgroundColor: 'rgba(200, 230, 240, 0.6)',
    iconBackgroundColor: 'rgba(130, 180, 210, 0.9)',
  },
  {
    id: 'tooth-tracker',
    titleKey: 'card.teeth.title',
    descriptionKey: 'card.teeth.description',
    iconName: 'mouth.fill',
    destination: '/tooth-tracker',
    cardBackgroundColor: 'rgba(200, 220, 255, 0.6)',
    iconBackgroundColor: 'rgba(150, 180, 240, 0.9)',
  },
  // Period-Tracker-Kachel vorerst ausgeblendet (Screen bleibt erhalten).
  {
    id: 'milestones',
    titleKey: 'card.milestones.title',
    descriptionKey: 'card.milestones.description',
    iconName: 'flag.fill',
    destination: '/milestones',
    cardBackgroundColor: 'rgba(255, 228, 195, 0.6)',
    iconBackgroundColor: 'rgba(255, 190, 130, 0.9)',
  },
];

const HOME_QUICK_ACCESS_ORDER = HOME_QUICK_ACCESS_CARD_DEFINITIONS.map(({ id }) => id);

const normalizeHomeQuickAccessOrder = (value: unknown): HomeQuickAccessCardId[] => {
  if (!Array.isArray(value)) return [...HOME_QUICK_ACCESS_ORDER];

  const seen = new Set<HomeQuickAccessCardId>();
  const normalized: HomeQuickAccessCardId[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!HOME_QUICK_ACCESS_ORDER.includes(entry as HomeQuickAccessCardId)) continue;
    if (seen.has(entry as HomeQuickAccessCardId)) continue;
    seen.add(entry as HomeQuickAccessCardId);
    normalized.push(entry as HomeQuickAccessCardId);
  }

  for (const id of HOME_QUICK_ACCESS_ORDER) {
    if (!seen.has(id)) {
      normalized.push(id);
    }
  }

  return normalized;
};

const buildHomeQuickAccessOrderStorageKey = (userId?: string | null, babyId?: string | null) =>
  `${HOME_QUICK_ACCESS_ORDER_STORAGE_PREFIX}:${userId ?? 'anonymous'}:${babyId ?? 'default'}`;

const buildHomeQuickAccessHiddenStorageKey = (userId?: string | null, babyId?: string | null) =>
  `${HOME_QUICK_ACCESS_HIDDEN_STORAGE_PREFIX}:${userId ?? 'anonymous'}:${babyId ?? 'default'}`;

const normalizeHomeQuickAccessHidden = (value: unknown): HomeQuickAccessCardId[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<HomeQuickAccessCardId>();
  const normalized = value
    .filter((entry): entry is HomeQuickAccessCardId => {
      return typeof entry === 'string' && HOME_QUICK_ACCESS_ORDER.includes(entry as HomeQuickAccessCardId);
    })
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .sort((left, right) => HOME_QUICK_ACCESS_ORDER.indexOf(left) - HOME_QUICK_ACCESS_ORDER.indexOf(right));

  return normalized.slice(0, Math.max(0, HOME_QUICK_ACCESS_ORDER.length - 1));
};

type SortableQuickAccessGridProps = {
  items: HomeQuickAccessCardConfig[];
  order: HomeQuickAccessCardId[];
  isEditing: boolean;
  onPressItem: (item: HomeQuickAccessCardConfig) => void;
  onRequestEditMode: () => void;
  onOrderChange: (order: HomeQuickAccessCardId[]) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  renderTile: (params: { item: HomeQuickAccessCardConfig; isEditing: boolean; isActive: boolean }) => React.ReactNode;
  scrollConfig?: {
    metricsRef: React.MutableRefObject<SortableTileGridScrollMetrics>;
    scrollToOffset: (offsetY: number) => void;
    slowEdgeThreshold?: number;
    fastEdgeThreshold?: number;
    slowSpeed?: number;
    fastSpeed?: number;
  };
  style?: StyleProp<ViewStyle>;
};

function SortableQuickAccessGrid({
  items,
  order,
  isEditing,
  onPressItem,
  onRequestEditMode,
  onOrderChange,
  onDragStateChange,
  renderTile,
  scrollConfig,
  style,
}: SortableQuickAccessGridProps) {
  const orderedItems = useMemo(
    () =>
      order
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is HomeQuickAccessCardConfig => !!item),
    [items, order],
  );

  return (
    <BaseSortableTileGrid
      items={orderedItems}
      isEditing={isEditing}
      onPressItem={onPressItem}
      onRequestEditMode={onRequestEditMode}
      onOrderChange={(nextItems) => onOrderChange(nextItems.map(({ id }) => id))}
      onDragStateChange={onDragStateChange}
      renderTile={renderTile}
      scrollConfig={scrollConfig}
      style={style}
    />
  );
}

function formatDurationSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, '0')))
    .join(':');
}

function buildSleepHomeTimer(entries: SleepEntry[] | undefined): HomeActiveTimer | null {
  if (!entries?.length) {
    return null;
  }

  const activeSleepEntry = entries.find((entry) => {
    const startMs = new Date(entry.start_time).getTime();
    return !entry.end_time && Number.isFinite(startMs);
  });

  if (!activeSleepEntry) {
    return null;
  }

  const start = new Date(activeSleepEntry.start_time).getTime();
  if (!Number.isFinite(start)) {
    return null;
  }

  return {
    source: 'sleep',
    start,
    route: '/(tabs)/sleep-tracker',
    label: t('timer.sleep.label'),
    title: t('timer.sleep.title'),
    hint: t('timer.sleep.hint'),
    iconName: 'moon.fill',
    accentColor: '#4FA9FF',
    accentBackground: 'rgba(79, 169, 255, 0.18)',
  };
}

function buildDailyHomeTimer(entry: {
  id?: string | null;
  feeding_type?: string | null;
  start_time?: string | null;
} | null): HomeActiveTimer | null {
  if (!entry?.start_time) {
    return null;
  }

  const start = new Date(entry.start_time).getTime();
  if (!Number.isFinite(start)) {
    return null;
  }

  const feedingType = typeof entry.feeding_type === 'string' ? entry.feeding_type : null;
  const config =
    feedingType === 'BREAST'
      ? { title: t('timer.breast'), iconName: 'heart.fill', accentColor: '#FF8EB0', accentBackground: 'rgba(255, 142, 176, 0.18)' }
      : feedingType === 'BOTTLE'
      ? { title: t('timer.bottle'), iconName: 'drop.fill', accentColor: '#F2A65A', accentBackground: 'rgba(242, 166, 90, 0.18)' }
      : feedingType === 'SOLIDS'
      ? { title: t('timer.solids'), iconName: 'fork.knife', accentColor: '#A274FF', accentBackground: 'rgba(162, 116, 255, 0.18)' }
      : feedingType === 'PUMP'
      ? { title: t('timer.pump'), iconName: 'drop.circle.fill', accentColor: '#76C7C0', accentBackground: 'rgba(118, 199, 192, 0.18)' }
      : feedingType === 'WATER'
      ? { title: t('timer.water'), iconName: 'drop.fill', accentColor: '#5BB6E6', accentBackground: 'rgba(91, 182, 230, 0.18)' }
      : null;

  if (!config) {
    return null;
  }

  return {
    source: 'daily',
    start,
    route: '/(tabs)/daily_old',
    label: t('timer.daily.label'),
    title: config.title,
    hint: t('timer.daily.hint'),
    iconName: config.iconName,
    accentColor: config.accentColor,
    accentBackground: config.accentBackground,
  };
}

function pickLatestHomeTimer(...timers: (HomeActiveTimer | null)[]): HomeActiveTimer | null {
  return timers
    .filter((timer): timer is HomeActiveTimer => timer !== null)
    .sort((a, b) => b.start - a.start)[0] ?? null;
}

function GlassBorderGlint({ radius = 30 }: { radius?: number }) {
  const anim = React.useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -6],
  });

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, overflow: 'hidden' },
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 2,
          left: -140,
          width: 220,
          height: 8,
          opacity: 0.65,
          transform: [{ translateX }, { translateY }, { rotate: '-10deg' }],
        }}
      >
        <LinearGradient
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.6)',
            'rgba(255,255,255,0)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </Animated.View>
    </View>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const value = Number.parseInt(full, 16);

  if (!Number.isFinite(value)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type ActiveTimerCardProps = {
  timer: HomeActiveTimer;
  elapsedSeconds: number;
  sinceLabel: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  onPress: () => void;
};

function ActiveTimerCard({
  timer,
  elapsedSeconds,
  sinceLabel,
  isDark,
  textPrimary,
  textSecondary,
  onPress,
}: ActiveTimerCardProps) {
  const pulse = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const accent = timer.accentColor;
  const formatted = formatDurationSeconds(elapsedSeconds);
  const lastColon = formatted.lastIndexOf(':');
  const mainTime = lastColon >= 0 ? formatted.slice(0, lastColon) : formatted;
  const secondsPart = lastColon >= 0 ? formatted.slice(lastColon + 1) : null;

  const haloStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
  };
  const liveDotStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
  };

  return (
    <TouchableOpacity
      style={[
        styles.activeTimerCard,
        {
          backgroundColor: isDark ? 'rgba(10, 8, 26, 0.55)' : 'rgba(255, 255, 255, 0.55)',
          borderColor: hexToRgba(accent, isDark ? 0.35 : 0.28),
          shadowColor: accent,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[hexToRgba(accent, isDark ? 0.28 : 0.2), hexToRgba(accent, 0.06), 'rgba(0, 0, 0, 0)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.activeTimerGradient}
      />

      <View style={styles.activeTimerHeader}>
        <View style={styles.activeTimerIconStack}>
          <Animated.View
            pointerEvents="none"
            style={[styles.activeTimerIconHalo, { backgroundColor: hexToRgba(accent, 0.22) }, haloStyle]}
          />
          <View
            style={[
              styles.activeTimerIconWrap,
              { backgroundColor: hexToRgba(accent, isDark ? 0.22 : 0.16), borderColor: hexToRgba(accent, 0.45) },
            ]}
          >
            <IconSymbol name={timer.iconName as any} size={18} color={accent} />
          </View>
        </View>

        <View style={styles.activeTimerContent}>
          <View style={styles.activeTimerLabelRow}>
            <Animated.View style={[styles.activeTimerLiveDot, { backgroundColor: accent }, liveDotStyle]} />
            <ThemedText adaptive={false} style={[styles.activeTimerLabel, { color: accent }]}>
              {timer.label.toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText adaptive={false} style={[styles.activeTimerTitle, { color: textPrimary }]}>
            {timer.title}
          </ThemedText>
        </View>

        <View style={[styles.activeTimerChevron, { backgroundColor: hexToRgba(accent, isDark ? 0.16 : 0.12) }]}>
          <IconSymbol name="chevron.right" size={14} color={accent} />
        </View>
      </View>

      <View style={styles.activeTimerStatsRow}>
        <View style={styles.activeTimerElapsedRow}>
          <ThemedText adaptive={false} style={[styles.activeTimerElapsed, { color: textPrimary }]}>
            {mainTime}
          </ThemedText>
          {secondsPart ? (
            <ThemedText adaptive={false} style={[styles.activeTimerElapsedSeconds, { color: hexToRgba(accent, 0.95) }]}>
              {`:${secondsPart}`}
            </ThemedText>
          ) : null}
        </View>

        <View
          style={[
            styles.activeTimerSincePill,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              borderColor: hexToRgba(accent, 0.22),
            },
          ]}
        >
          <ThemedText adaptive={false} style={[styles.activeTimerSince, { color: textSecondary }]}>
            {sinceLabel}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.activeTimerTrack, { backgroundColor: hexToRgba(accent, 0.14) }]}>
        <Animated.View
          style={[
            styles.activeTimerTrackFill,
            {
              backgroundColor: accent,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
              transform: [
                { scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
              ],
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { locale } = useLocale();
  ACTIVE_HOME_LOCALE = locale;
  HOME_LOCALE_TAG = getHomeLocaleTag(ACTIVE_HOME_LOCALE);
  // Verwende useAdaptiveColors für korrekte Farben basierend auf Hintergrundbild
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;

  // Dark Mode angepasste Farben
  const textPrimary = isDark ? Colors.dark.textPrimary : '#6B4C3B';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentPurple = isDark ? Colors.dark.textAccent : '#5E3DB3';
  const glassCardBg = isDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.04)';
  const glassBlurBg = isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.35)';
  const { user } = useAuth();
  const userId = user?.id;
  const { activeBabyId, isReady: isActiveBabyReady } = useActiveBaby();
  const { isBabyBorn } = useBabyStatus();
  const pathname = usePathname();
  const router = useRouter();
  // Lottis Fürsorge: nur für Premiumtester/Admins sichtbar (später Premium-Abo).
  const advisorAccess = useAdvisorAccess();
  // Sprach-Logging: gleiches Premium-Gating.
  const voiceLogAccess = useVoiceLogAccess();
  const askLottiAccess = useAskLottiAccess();
  const [showVoiceLogModal, setShowVoiceLogModal] = useState(false);
  const DEFAULT_OVERVIEW_HEIGHT = 230;
  const OVERVIEW_ROTATION_INTERVAL_MS = 20000;
  const OVERVIEW_ROTATION_PAUSE_MS = 12000;

  const [dailyEntries, setDailyEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'diaper' | 'other'>('feeding');
  const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
  const [todaySleepMinutes, setTodaySleepMinutes] = useState(0);
  const [activeHomeTimer, setActiveHomeTimer] = useState<HomeActiveTimer | null>(null);
  const [activeHomeTimerNow, setActiveHomeTimerNow] = useState(() => Date.now());
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepModalStart, setSleepModalStart] = useState(new Date());
  const [overviewCarouselWidth, setOverviewCarouselWidth] = useState(0);
  const [overviewIndex, setOverviewIndex] = useState(0);
  const [overviewSummaryHeight, setOverviewSummaryHeight] = useState<number | null>(null);
  const [quickAccessOrder, setQuickAccessOrder] = useState<HomeQuickAccessCardId[]>([...HOME_QUICK_ACCESS_ORDER]);
  const [hiddenQuickAccessIds, setHiddenQuickAccessIds] = useState<HomeQuickAccessCardId[]>([]);
  const [isQuickAccessEditMode, setIsQuickAccessEditMode] = useState(false);
  const [isQuickAccessDragging, setIsQuickAccessDragging] = useState(false);
  // Kachelmaße wachsen mit der Systemschriftgröße mit, damit Titel und
  // Beschreibung bei großer Schrift nicht abgeschnitten werden.
  const layoutFontScale = useFontScale();
  // Enge Zeilen-Layouts (Text + Button nebeneinander) brechen bei großer
  // Schrift auseinander — ab ~130 % stapeln wir sie stattdessen.
  const isStackedLayout = layoutFontScale >= 1.3;
  const twoLineLimit = useLineLimit(2);
  const tileMetrics = useTileGridMetrics();
  const scaledCardSizing = useMemo(
    () => ({
      minHeight: tileMetrics.itemHeight,
      height: tileMetrics.itemHeight,
    }),
    [tileMetrics.itemHeight],
  );
  const scaledHiddenTileSizing = useMemo(
    () => ({
      minHeight: tileMetrics.itemHeight,
      height: tileMetrics.itemHeight,
    }),
    [tileMetrics.itemHeight],
  );
  // Versteckte Kacheln liegen in einem einfachen Wrap-Grid — bei einer Spalte
  // muss der Wrapper auf volle Breite gehen.
  const hiddenTileWrapperSizing = useMemo(
    () => (tileMetrics.isSingleColumn ? { width: '100%' as const } : null),
    [tileMetrics.isSingleColumn],
  );
  const mainScrollRef = useRef<ScrollView>(null);
  const quickAccessScrollMetricsRef = useRef<SortableTileGridScrollMetrics>({
    offsetY: 0,
    viewportHeight: 0,
    contentHeight: 0,
  });
  const overviewScrollRef = useRef<ScrollView>(null);
  const overviewIndexRef = useRef(0);
  const overviewRotationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overviewRotationPauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScrollingRef = useRef(false);
  const androidBlurProps =
    Platform.OS === 'android'
      ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
      : {};
  const quickAccessOrderStorageKey = useMemo(
    () => buildHomeQuickAccessOrderStorageKey(user?.id, activeBabyId),
    [activeBabyId, user?.id],
  );
  const quickAccessHiddenStorageKey = useMemo(
    () => buildHomeQuickAccessHiddenStorageKey(user?.id, activeBabyId),
    [activeBabyId, user?.id],
  );
  const quickAccessCardById = useMemo(
    () =>
      new Map(
        HOME_QUICK_ACCESS_CARD_DEFINITIONS.map(({ titleKey, descriptionKey, ...card }) => [
          card.id,
          {
            ...card,
            title: translateHomeText(locale, titleKey),
            description: translateHomeText(locale, descriptionKey),
          },
        ] as const),
      ),
    [locale],
  );
  const hiddenQuickAccessIdSet = useMemo(() => new Set(hiddenQuickAccessIds), [hiddenQuickAccessIds]);
  const subscriptionTier = useSubscriptionTier();
  const isCardAvailableForTier = useCallback(
    (id: HomeQuickAccessCardId) => {
      if (subscriptionTier === null) return true;
      const feature = QUICK_ACCESS_CARD_FEATURES[id];
      if (!feature) return true;
      return featureAllowedForTier(feature, subscriptionTier);
    },
    [subscriptionTier],
  );
  const orderedQuickAccessCards = useMemo(
    () =>
      quickAccessOrder
        .map((id) => quickAccessCardById.get(id))
        .filter(
          (card): card is HomeQuickAccessCardConfig =>
            !!card &&
            !hiddenQuickAccessIdSet.has(card.id) &&
            isCardAvailableForTier(card.id),
        ),
    [hiddenQuickAccessIdSet, isCardAvailableForTier, quickAccessCardById, quickAccessOrder],
  );
  const hiddenQuickAccessCards = useMemo(
    () =>
      quickAccessOrder
        .map((id) => quickAccessCardById.get(id))
        .filter(
          (card): card is HomeQuickAccessCardConfig =>
            !!card &&
            hiddenQuickAccessIdSet.has(card.id) &&
            isCardAvailableForTier(card.id),
        ),
    [hiddenQuickAccessIdSet, isCardAvailableForTier, quickAccessCardById, quickAccessOrder],
  );

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  const handleNavigate = (destination: any) => {
    triggerHaptic();
    router.push(destination);
  };

  const openQuickAccessEditor = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsQuickAccessEditMode(true);
  }, []);

  const closeQuickAccessEditor = useCallback(() => {
    setIsQuickAccessDragging(false);
    setIsQuickAccessEditMode(false);
  }, []);

  const persistQuickAccessHiddenIds = useCallback(
    async (nextHiddenIds: HomeQuickAccessCardId[]) => {
      try {
        const normalized = normalizeHomeQuickAccessHidden(nextHiddenIds);

        if (normalized.length === 0) {
          await AsyncStorage.removeItem(quickAccessHiddenStorageKey);
          return;
        }

        await AsyncStorage.setItem(quickAccessHiddenStorageKey, JSON.stringify(normalized));
      } catch (error) {
        console.error('Home: failed to save hidden quick access tiles', error);
      }
    },
    [quickAccessHiddenStorageKey],
  );

  const mergeVisibleOrderIntoQuickAccessOrder = useCallback(
    (nextVisibleOrder: HomeQuickAccessCardId[]) => {
      const hiddenIds = new Set(hiddenQuickAccessIds);
      const visibleQueue = [...nextVisibleOrder];
      const nextOrder: HomeQuickAccessCardId[] = [];

      for (const id of quickAccessOrder) {
        if (hiddenIds.has(id)) {
          nextOrder.push(id);
          continue;
        }

        const nextVisibleId = visibleQueue.shift();
        if (nextVisibleId) {
          nextOrder.push(nextVisibleId);
        }
      }

      nextOrder.push(...visibleQueue);
      return normalizeHomeQuickAccessOrder(nextOrder);
    },
    [hiddenQuickAccessIds, quickAccessOrder],
  );

  const handleHideQuickAccessCard = useCallback(
    (itemId: HomeQuickAccessCardId) => {
      if (orderedQuickAccessCards.length <= 1) {
        Alert.alert(t('common.notice'), t('alert.keepTile'));
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setHiddenQuickAccessIds((currentHiddenIds) => {
        const nextHiddenIds = normalizeHomeQuickAccessHidden([...currentHiddenIds, itemId]);
        void persistQuickAccessHiddenIds(nextHiddenIds);
        return nextHiddenIds;
      });
    },
    [orderedQuickAccessCards.length, persistQuickAccessHiddenIds],
  );

  const handleRestoreQuickAccessCard = useCallback(
    (itemId: HomeQuickAccessCardId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setHiddenQuickAccessIds((currentHiddenIds) => {
        const nextHiddenIds = currentHiddenIds.filter((hiddenId) => hiddenId !== itemId);
        void persistQuickAccessHiddenIds(nextHiddenIds);
        return nextHiddenIds;
      });
    },
    [persistQuickAccessHiddenIds],
  );

  const handleRestoreAllQuickAccessCards = useCallback(() => {
    if (!hiddenQuickAccessIds.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHiddenQuickAccessIds([]);
    void persistQuickAccessHiddenIds([]);
  }, [hiddenQuickAccessIds.length, persistQuickAccessHiddenIds]);

  const loadLocalProfileName = useCallback(async () => {
    if (!userId) {
      setUserName('');
      return;
    }
    const localProfile = await getLocalProfileName(userId);
    const nextName = localProfile?.firstName || localProfile?.lastName || '';
    setUserName(nextName);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadLocalProfileName();
    }, [loadLocalProfileName])
  );

  useEffect(() => {
    overviewIndexRef.current = overviewIndex;
  }, [overviewIndex]);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const [storedOrder, storedHiddenIds] = await Promise.all([
          AsyncStorage.getItem(quickAccessOrderStorageKey),
          AsyncStorage.getItem(quickAccessHiddenStorageKey),
        ]);
        if (!isActive) return;

        setQuickAccessOrder(
          storedOrder ? normalizeHomeQuickAccessOrder(JSON.parse(storedOrder)) : [...HOME_QUICK_ACCESS_ORDER],
        );
        setHiddenQuickAccessIds(
          storedHiddenIds ? normalizeHomeQuickAccessHidden(JSON.parse(storedHiddenIds)) : [],
        );
      } catch (error) {
        console.error('Home: failed to load quick access order or hidden tiles', error);
        if (isActive) {
          setQuickAccessOrder([...HOME_QUICK_ACCESS_ORDER]);
          setHiddenQuickAccessIds([]);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [quickAccessHiddenStorageKey, quickAccessOrderStorageKey]);

  const persistQuickAccessOrder = useCallback(
    async (nextOrder: HomeQuickAccessCardId[]) => {
      try {
        const normalized = normalizeHomeQuickAccessOrder(nextOrder);

        if (normalized.every((id, index) => id === HOME_QUICK_ACCESS_ORDER[index])) {
          await AsyncStorage.removeItem(quickAccessOrderStorageKey);
          return;
        }

        await AsyncStorage.setItem(quickAccessOrderStorageKey, JSON.stringify(normalized));
      } catch (error) {
        console.error('Home: failed to save quick access order', error);
      }
    },
    [quickAccessOrderStorageKey],
  );

  const handleReorderQuickAccess = useCallback(
    (nextVisibleOrder: HomeQuickAccessCardId[]) => {
      const normalized = mergeVisibleOrderIntoQuickAccessOrder(nextVisibleOrder);
      setQuickAccessOrder(normalized);
      void persistQuickAccessOrder(normalized);
    },
    [mergeVisibleOrderIntoQuickAccessOrder, persistQuickAccessOrder],
  );

  const stopOverviewRotation = useCallback(() => {
    if (overviewRotationIntervalRef.current) {
      clearInterval(overviewRotationIntervalRef.current);
      overviewRotationIntervalRef.current = null;
    }
  }, []);

  const startOverviewRotation = useCallback(() => {
    if (!overviewCarouselWidth) return;
    stopOverviewRotation();

    const slideCount = 2;
    if (slideCount <= 1) return;

    overviewRotationIntervalRef.current = setInterval(() => {
      const nextIndex = (overviewIndexRef.current + 1) % slideCount;
      overviewIndexRef.current = nextIndex;
      setOverviewIndex(nextIndex);
      isAutoScrollingRef.current = true;
      overviewScrollRef.current?.scrollTo({
        x: nextIndex * overviewCarouselWidth,
        animated: true,
      });
    }, OVERVIEW_ROTATION_INTERVAL_MS);
  }, [overviewCarouselWidth, OVERVIEW_ROTATION_INTERVAL_MS, stopOverviewRotation]);

  const scheduleOverviewRotationResume = useCallback(() => {
    if (overviewRotationPauseTimeoutRef.current) {
      clearTimeout(overviewRotationPauseTimeoutRef.current);
    }
    overviewRotationPauseTimeoutRef.current = setTimeout(() => {
      startOverviewRotation();
    }, OVERVIEW_ROTATION_PAUSE_MS);
  }, [OVERVIEW_ROTATION_PAUSE_MS, startOverviewRotation]);

  useEffect(() => {
    startOverviewRotation();
    return () => {
      stopOverviewRotation();
      if (overviewRotationPauseTimeoutRef.current) {
        clearTimeout(overviewRotationPauseTimeoutRef.current);
        overviewRotationPauseTimeoutRef.current = null;
      }
    };
  }, [startOverviewRotation, stopOverviewRotation]);

  const handleOverviewScrollBeginDrag = () => {
    isAutoScrollingRef.current = false;
    stopOverviewRotation();
    if (overviewRotationPauseTimeoutRef.current) {
      clearTimeout(overviewRotationPauseTimeoutRef.current);
      overviewRotationPauseTimeoutRef.current = null;
    }
  };

  const handleOverviewScrollEndDrag = () => {
    scheduleOverviewRotationResume();
  };

  useEffect(() => {
    const syncNow = () => setActiveHomeTimerNow(Date.now());
    const interval = setInterval(syncNow, 1000);
    return () => clearInterval(interval);
  }, []);

  // Funktion für Pull-to-Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (!isActiveBabyReady) {
        return;
      }
      // Lade die Daten neu
      await loadData();
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  async function loadData() {
    try {
      if (!user?.id) {
        setDailyEntries([]);
        setTodaySleepMinutes(0);
        setActiveHomeTimer(null);
        return;
      }

      const today = new Date();
      const homeCacheScope: HomeCacheScope = {
        userId: user.id,
        babyId: activeBabyId ?? null,
        dateKey: today.toISOString().split('T')[0],
      };

      // 🆕 Cache-First Strategy: Lade gecachte Daten zuerst
      const cachedData = await loadCachedHomeData(homeCacheScope);
      if (cachedData) {
        console.log('Loading cached home data (age:', new Date().toISOString(), '-', cachedData.lastUpdate, ')');
        // Zeige sofort gecachte Daten für instant load
        if (cachedData.dailyEntries) setDailyEntries(cachedData.dailyEntries);
        if (cachedData.todaySleepMinutes !== undefined) setTodaySleepMinutes(cachedData.todaySleepMinutes);

        // Wenn Cache frisch ist (< 5 Min), beende Loading sofort
        if (isCacheFresh(cachedData.lastUpdate) && !refreshing) {
          setIsLoading(false);
        }
      }

      // Lade trotzdem immer frische Daten von Supabase (parallel)
      if (!refreshing && !cachedData) {
        setIsLoading(true);
      }

      // Alltags-Einträge für heute laden
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: dailyData, error: dailyError } = await getBabyCareEntriesForDate(
        today,
        activeBabyId ?? undefined
      );

      let freshDailyEntries: any[] = [];
      if (!dailyError && dailyData) {
        freshDailyEntries = dailyData;
        setDailyEntries(dailyData);
      }

      const { totalMinutes: freshSleepMinutes, activeSleepTimer } = await fetchTodaySleepMinutes(startOfDay, endOfDay);
      const activeDailyTimer = await loadActiveDailyTimer();
      setActiveHomeTimer(pickLatestHomeTimer(activeSleepTimer, activeDailyTimer));

      // 🆕 Speichere frische Daten im Cache für nächstes Mal
      await cacheHomeData({
        dailyEntries: freshDailyEntries,
        todaySleepMinutes: freshSleepMinutes,
      }, homeCacheScope);
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user && isActiveBabyReady) {
      const timeoutId = setTimeout(() => {
        void loadData();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [user, activeBabyId, isActiveBabyReady]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !isActiveBabyReady) {
        return;
      }

      void loadData();
    }, [user, activeBabyId, isActiveBabyReady, refreshing])
  );

  // Formatiere das aktuelle Datum
  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString(HOME_LOCALE_TAG, options);
  };

  // Berechne die Anzahl der heutigen Windelwechsel
  const getTodayDiaperChanges = () => {
    return dailyEntries.filter(entry => entry.entry_type === 'diaper').length;
  };

  const formatMinutes = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Handle stat item press
  const handleStatPress = (type: 'feeding' | 'diaper' | 'sleep') => {
    if (type === 'sleep') {
      handleNavigate('/(tabs)/sleep-tracker');
      return;
    }
    handleNavigate({
      pathname: '/(tabs)/daily_old',
      params: { quickAction: type },
    });
  };

  // Load only daily entries (for quick refresh after adding entries)
  const loadDailyEntriesOnly = async () => {
    try {
      if (!user?.id) {
        setDailyEntries([]);
        setTodaySleepMinutes(0);
        setActiveHomeTimer(null);
        return;
      }

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('Loading daily entries for date:', today.toISOString());

      const { data: dailyData, error } = await getBabyCareEntriesForDate(
        today,
        activeBabyId ?? undefined
      );

      if (error) {
        console.error('Error loading daily entries:', error);
        return;
      }

      if (dailyData) {
        console.log('Loaded daily entries:', dailyData.length, 'entries');
        setDailyEntries(dailyData);
      }

      const [{ activeSleepTimer }, activeDailyTimer] = await Promise.all([
        fetchTodaySleepMinutes(startOfDay, endOfDay),
        loadActiveDailyTimer(),
      ]);
      setActiveHomeTimer(pickLatestHomeTimer(activeSleepTimer, activeDailyTimer));
    } catch (err) {
      console.error('Failed to load daily entries:', err);
    }
  };

  const loadActiveDailyTimer = async (): Promise<HomeActiveTimer | null> => {
    if (!activeBabyId) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('baby_care_entries')
        .select('id,feeding_type,start_time')
        .eq('baby_id', activeBabyId)
        .eq('entry_type', 'feeding')
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading active daily timer for home:', error);
        return null;
      }

      const openEntries = Array.isArray(data) ? data : [];
      const activeDailyEntry =
        openEntries.find((entry) => buildDailyHomeTimer(entry) !== null) ?? null;

      return buildDailyHomeTimer(activeDailyEntry);
    } catch (error) {
      console.error('Failed to resolve active daily timer for home:', error);
      return null;
    }
  };

  const fetchTodaySleepMinutes = async (
    startOfDay: Date,
    endOfDay: Date
  ): Promise<{ totalMinutes: number; activeSleepTimer: HomeActiveTimer | null }> => {
    try {
      if (!user?.id) {
        setTodaySleepMinutes(0);
        return { totalMinutes: 0, activeSleepTimer: null };
      }

      const { success, entries, error } = await loadAllVisibleSleepEntries(activeBabyId ?? undefined);
      if (!success || !entries) {
        console.error('Error loading visible sleep entries for today:', error);
        setTodaySleepMinutes(0);
        return { totalMinutes: 0, activeSleepTimer: null };
      }

      const now = new Date();
      const activeSleepTimer = buildSleepHomeTimer(entries);
      const intervals = entries
        .map((entry) => {
          const entryStart = new Date(entry.start_time);
          const entryEnd = entry.end_time ? new Date(entry.end_time) : now;
          const isValid = Number.isFinite(entryStart.getTime()) && Number.isFinite(entryEnd.getTime()) && entryEnd > entryStart;
          const overlapsToday = entryStart <= endOfDay && entryEnd >= startOfDay;

          if (!isValid || !overlapsToday) {
            return null;
          }

          // Für die Home-Kachel den vollständigen Schlafblock zählen (ab Startzeit),
          // sobald er den heutigen Tag berührt.
          return { start: entryStart, end: entryEnd };
        })
        .filter((interval): interval is { start: Date; end: Date } => interval !== null)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      const mergedIntervals = intervals.reduce<{ start: Date; end: Date }[]>((acc, interval) => {
        const last = acc[acc.length - 1];
        if (!last || interval.start.getTime() > last.end.getTime()) {
          acc.push(interval);
          return acc;
        }

        if (interval.end.getTime() > last.end.getTime()) {
          last.end = interval.end;
        }
        return acc;
      }, []);

      const totalMinutes = mergedIntervals.reduce((sum, interval) => {
        const diff = interval.end.getTime() - interval.start.getTime();
        return diff > 0 ? sum + Math.round(diff / 60000) : sum;
      }, 0);

      setTodaySleepMinutes(totalMinutes);
      return { totalMinutes, activeSleepTimer };
    } catch (error) {
      console.error('Failed to calculate today sleep minutes:', error);
      setTodaySleepMinutes(0);
      return { totalMinutes: 0, activeSleepTimer: null };
    }
  };

  // Handle save entry from modal
  const {
    promptVisible: nightWakePromptVisible,
    promptCandidate: nightWakeCandidate,
    promptFeedingStart: nightWakeFeedingStart,
    promptBusy: nightWakeBusy,
    maybeOfferNightWake,
    pickWake: pickNightWake,
    truncateNight,
    dismissNightWakePrompt,
  } = useNightWakePrompt({
    userId: user?.id,
    babyId: activeBabyId,
    onAfterSplit: () => loadDailyEntriesOnly(),
  });

  const handleSaveEntry = async (payload: any) => {
    console.log('handleSaveEntry - Received payload:', JSON.stringify(payload, null, 2));
    const entryType =
      payload?.entry_type === 'feeding' || payload?.entry_type === 'diaper'
        ? payload.entry_type
        : selectedActivityType;

    if (entryType !== 'feeding' && entryType !== 'diaper') {
      Alert.alert(t('common.error'), t('alert.unknownEntry'));
      return;
    }

    const { error } = await addBabyCareEntry({
      entry_type: entryType,
      start_time: payload.start_time,
      end_time: payload.end_time ?? null,
      notes: payload.notes ?? null,
      feeding_type: payload.feeding_type ?? null,
      feeding_volume_ml: payload.feeding_volume_ml ?? null,
      feeding_side: payload.feeding_side ?? null,
      diaper_type: payload.diaper_type ?? null,
      diaper_fever_measured: payload.diaper_fever_measured ?? null,
      diaper_temperature_c: payload.diaper_temperature_c ?? null,
      diaper_suppository_given: payload.diaper_suppository_given ?? null,
      diaper_suppository_dose_mg: payload.diaper_suppository_dose_mg ?? null,
    }, activeBabyId ?? undefined, {
      diaperInventoryItemId: payload.diaper_inventory_item_id ?? null,
      bottleInventoryItemId: payload.bottle_inventory_item_id ?? null,
    });

    if (error) {
      console.error('Error saving baby care entry:', error);
      Alert.alert(t('common.error'), t('alert.entrySaveFailed'));
      return;
    }

    if (
      entryType === 'feeding' &&
      shouldCancelStaleReminderAfterManualEntry({
        startTime: payload.start_time,
        endTime: payload.end_time ?? null,
      })
    ) {
      try {
        await cancelLocalFeedingReminders();
        if (user?.id && activeBabyId) {
          await cancelBabyReminderNotification({
            userId: user.id,
            babyId: activeBabyId,
            reminderType: 'feeding',
          });
        }
      } catch (reminderError) {
        console.error('Failed to cancel stale feeding reminders after home entry:', reminderError);
      }
    }

    setShowInputModal(false);
    setSelectedActivityType('feeding');
    setSelectedSubType(null);

    // Quick reload of daily entries to show the new entry immediately
    await loadDailyEntriesOnly();

    if (entryType === 'feeding' && payload.start_time) {
      void maybeOfferNightWake({
        startTime: payload.start_time,
        endTime: payload.end_time ?? null,
        feedingType: payload.feeding_type ?? null,
      });
    }

  };

  const handleSaveSleepQuickEntry = async (entry: SleepQuickEntry) => {
    if (!user?.id) {
      Alert.alert(t('common.notice'), t('alert.signInForSleep'));
      return;
    }
    try {
      const payload = {
        user_id: user.id,
        baby_id: activeBabyId ?? null,
        start_time: entry.start.toISOString(),
        end_time: entry.end ? entry.end.toISOString() : null,
        quality: entry.quality,
        notes: entry.notes || null,
        duration_minutes: entry.end ? Math.max(0, Math.round((entry.end.getTime() - entry.start.getTime()) / 60000)) : null,
      };

      const { error } = await supabase.from('sleep_entries').insert(payload);
      if (error) {
        console.error('Error saving sleep entry:', error);
        Alert.alert(t('common.error'), t('alert.sleepSaveFailed'));
        return;
      }

      emitLottiMoment('sleep');
      setShowSleepModal(false);

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      await fetchTodaySleepMinutes(startOfDay, endOfDay);
    } catch (err) {
      console.error('Failed to save sleep entry:', err);
      Alert.alert(t('common.error'), t('alert.sleepEntrySaveFailed'));
    }
  };

  // Nach dem Sprach-Logging alles neu laden, was betroffen sein kann
  // (Alltag-Einträge und die Schlafminuten der Home-Kachel).
  const handleVoiceLogSaved = async () => {
    await loadDailyEntriesOnly();
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    await fetchTodaySleepMinutes(startOfDay, endOfDay);
  };

  const handleFocusRecommendation = () => {
    triggerHaptic();
    router.push('/prints-shop' as any);
  };
  // Rendere den Begrüßungsbereich
  const renderGreetingSection = () => {
    const metadataFirstName =
      typeof user?.user_metadata?.first_name === 'string' ? user.user_metadata.first_name : '';
    const metadataFullName =
      typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
    const displayName = userName || metadataFirstName || metadataFullName || t('greeting.fallbackName');
    const activeTimerElapsedSeconds = activeHomeTimer
      ? Math.max(0, Math.floor((activeHomeTimerNow - activeHomeTimer.start) / 1000))
      : 0;

    return (
      <View style={[styles.liquidGlassWrapper, styles.greetingCardWrapper]}>
        <BlurView
          {...androidBlurProps}
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[styles.liquidGlassBackground, styles.greetingGlassBackground, { backgroundColor: glassBlurBg }]}
        >
          <ThemedView
            style={[styles.greetingContainer, styles.liquidGlassContainer, styles.greetingGlassContainer, { backgroundColor: glassCardBg }]}
            lightColor="rgba(255, 255, 255, 0.04)"
            darkColor="rgba(255, 255, 255, 0.02)"
          >
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)']}
              locations={[0, 0.45, 1]}
              start={{ x: 0.15, y: 0.0 }}
              end={{ x: 0.85, y: 1.0 }}
              style={styles.greetingGloss}
            />

            <View style={styles.greetingHeader}>
              <View style={styles.greetingTextBlock}>
                <ThemedText adaptive={false} style={[styles.greeting, styles.liquidGlassText, { color: textPrimary }]}>
                  {t('greeting.hello', { name: displayName })}
                </ThemedText>
                <ThemedText adaptive={false} style={[styles.dateText, styles.liquidGlassSecondaryText, { color: textPrimary }]}>
                  {formatDate()}
                </ThemedText>
              </View>

              <View style={styles.profileBadge}>
                <LottiWeekRing contentSize={68} inset={4} ringStroke={4.5}>
                  <BabySwitcherButton size={68} />
                </LottiWeekRing>
                <View style={styles.profileStatusDot} />
              </View>
            </View>

            {activeHomeTimer ? (
              <ActiveTimerCard
                timer={activeHomeTimer}
                elapsedSeconds={activeTimerElapsedSeconds}
                sinceLabel={t('timer.since', {
                  time: new Date(activeHomeTimer.start).toLocaleTimeString(HOME_LOCALE_TAG, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                onPress={() => handleNavigate(activeHomeTimer.route)}
              />
            ) : (
              <LottiWeekCard style={{ marginTop: 14, marginBottom: 0 }} />
            )}
          </ThemedView>
        </BlurView>
        <GlassBorderGlint radius={30} />
      </View>
    );
  };

  // Rendere die Tagesübersicht
  const renderDailySummary = (wrapperStyle?: StyleProp<ViewStyle>) => {
    const feedingOverview = buildFeedingOverview(dailyEntries);
    const hasBottleFeedings = feedingOverview.bottleCount > 0;
    const hasBreastFeedings = feedingOverview.breastCount > 0;
    const hasSolidFeedings = feedingOverview.solidsCount > 0;
    const hasPumpEntries = feedingOverview.pumpCount > 0;
    const hasWaterEntries = feedingOverview.waterCount > 0;

    let feedingStatValue = `${feedingOverview.totalBottleMl}`;
    let feedingStatUnit: 'ml' | 'times' = 'ml';
    let todayFeedingsPrimaryDetail = t('summary.noMeal');
    let todayFeedingsSecondaryDetail: string | null = null;

    if (feedingOverview.totalFeedingCount > 0) {
      if (hasBottleFeedings) {
        todayFeedingsPrimaryDetail = t('summary.bottle', { count: feedingOverview.bottleCount });
        todayFeedingsSecondaryDetail = [
          hasBreastFeedings ? t('summary.breast', { count: feedingOverview.breastCount }) : null,
          hasSolidFeedings ? t('summary.solids', { count: feedingOverview.solidsCount }) : null,
          hasPumpEntries ? t('summary.pump', { count: feedingOverview.pumpCount }) : null,
          hasWaterEntries ? t('summary.water', { count: feedingOverview.waterCount }) : null,
        ]
          .filter(Boolean)
          .join(' • ') || null;
      } else if (hasBreastFeedings || hasSolidFeedings) {
        const useBreastAsPrimary =
          hasBreastFeedings && (!hasSolidFeedings || feedingOverview.breastCount >= feedingOverview.solidsCount);

        feedingStatUnit = 'times';
        if (useBreastAsPrimary) {
          feedingStatValue = `${feedingOverview.breastCount}`;
          todayFeedingsPrimaryDetail = t('summary.breastOnly');
          todayFeedingsSecondaryDetail = [
            hasSolidFeedings ? t('summary.solids', { count: feedingOverview.solidsCount }) : null,
            hasPumpEntries ? t('summary.pump', { count: feedingOverview.pumpCount }) : null,
            hasWaterEntries ? t('summary.water', { count: feedingOverview.waterCount }) : null,
          ]
            .filter(Boolean)
            .join(' • ') || null;
        } else {
          feedingStatValue = `${feedingOverview.solidsCount}`;
          todayFeedingsPrimaryDetail = t('summary.solidsOnly');
          todayFeedingsSecondaryDetail = [
            hasBreastFeedings ? t('summary.breast', { count: feedingOverview.breastCount }) : null,
            hasPumpEntries ? t('summary.pump', { count: feedingOverview.pumpCount }) : null,
            hasWaterEntries ? t('summary.water', { count: feedingOverview.waterCount }) : null,
          ]
            .filter(Boolean)
            .join(' • ') || null;
        }
      }
    } else if (hasPumpEntries || hasWaterEntries) {
      todayFeedingsSecondaryDetail = [
        hasPumpEntries ? t('summary.pump', { count: feedingOverview.pumpCount }) : null,
        hasWaterEntries ? t('summary.water', { count: feedingOverview.waterCount }) : null,
      ]
        .filter(Boolean)
        .join(' • ') || null;
    }
    const todayDiaperChanges = getTodayDiaperChanges();

    return (
      <TouchableOpacity
        onPress={() => handleNavigate('/(tabs)/daily_old')}
        activeOpacity={0.9}
        style={[styles.liquidGlassWrapper, wrapperStyle]}
        onLayout={(event) => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          if (nextHeight && nextHeight !== overviewSummaryHeight) {
            setOverviewSummaryHeight(nextHeight);
          }
        }}
      >
        <BlurView
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[styles.liquidGlassBackground, { backgroundColor: glassBlurBg }]}
        >
          <ThemedView
            style={[styles.summaryContainer, styles.liquidGlassContainer, { backgroundColor: glassCardBg }]}
            lightColor="rgba(255, 255, 255, 0.04)"
            darkColor="rgba(255, 255, 255, 0.02)"
          >
            <View style={styles.sectionTitleContainer}>
              <ThemedText adaptive={false} style={[styles.sectionTitle, { color: textSecondary, fontSize: 22 }]}>
                {t('summary.title')}
              </ThemedText>
              <View style={styles.liquidGlassChevron}>
                <IconSymbol name="chevron.right" size={20} color={textSecondary} />
              </View>
            </View>

            <View style={[styles.statsContainer, isStackedLayout ? styles.statsContainerStacked : null]}>
              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, isStackedLayout ? styles.statItemStacked : null, {
                  backgroundColor: 'rgba(94, 61, 179, 0.13)',
                  borderColor: 'rgba(94, 61, 179, 0.35)'
                }]}
                activeOpacity={0.85}
                onPress={(event) => {
                  event.stopPropagation();
                  handleStatPress('feeding');
                }}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji} allowFontScaling={false}>🍼</Text>
                </View>
                <View style={styles.statValueContainer}>
                  <ThemedText adaptive={false} style={[styles.statValue, styles.liquidGlassStatValue, {
                    color: accentPurple,
                    textShadowColor: 'rgba(255, 255, 255, 0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }]}>
                    {feedingStatValue}
                    <Text style={styles.feedingMlUnit}>{feedingStatUnit === 'ml' ? ' ml' : '×'}</Text>
                  </ThemedText>
                </View>
                <View style={styles.feedingDetailsWrap}>
                  <ThemedText
                    adaptive={false}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                    style={[styles.feedingDetailPrimary, { color: textSecondary }]}
                  >
                    {todayFeedingsPrimaryDetail}
                  </ThemedText>
                  {todayFeedingsSecondaryDetail ? (
                    <ThemedText
                      adaptive={false}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                      style={[styles.feedingDetailSecondary, { color: textSecondary }]}
                    >
                      {todayFeedingsSecondaryDetail}
                    </ThemedText>
                  ) : null}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, isStackedLayout ? styles.statItemStacked : null, {
                  backgroundColor: 'rgba(94, 61, 179, 0.08)',
                  borderColor: 'rgba(94, 61, 179, 0.22)'
                }]}
                activeOpacity={0.85}
                onPress={(event) => {
                  event.stopPropagation();
                  handleStatPress('diaper');
                }}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji} allowFontScaling={false}>💩</Text>
                </View>
                <View style={styles.statValueContainer}>
                  <ThemedText adaptive={false} style={[styles.statValue, styles.liquidGlassStatValue, {
                    color: accentPurple,
                    textShadowColor: 'rgba(255, 255, 255, 0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }]}>{todayDiaperChanges}</ThemedText>
                </View>
                <ThemedText adaptive={false} style={[styles.statLabel, styles.liquidGlassStatLabel, { color: textSecondary }]}>{t('summary.diapers')}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, isStackedLayout ? styles.statItemStacked : null, {
                  backgroundColor: 'rgba(94, 61, 179, 0.05)',
                  borderColor: 'rgba(94, 61, 179, 0.15)'
                }]}
                activeOpacity={0.85}
                onPress={(event) => {
                  event.stopPropagation();
                  handleStatPress('sleep');
                }}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji} allowFontScaling={false}>💤</Text>
                </View>
                <View style={styles.statValueContainer}>
                  <ThemedText adaptive={false} style={[styles.statValue, styles.liquidGlassStatValue, {
                    color: accentPurple,
                    textShadowColor: 'rgba(255, 255, 255, 0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }]}>{formatMinutes(todaySleepMinutes)}</ThemedText>
                </View>
                <ThemedText adaptive={false} style={[styles.statLabel, styles.liquidGlassStatLabel, { color: textSecondary }]}>{t('summary.sleep')}</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </BlurView>
      </TouchableOpacity>
    );
  };

  const renderRecommendationCard = (wrapperStyle?: StyleProp<ViewStyle>) => {
    const cardHeightStyle = {
      height: overviewSummaryHeight ?? DEFAULT_OVERVIEW_HEIGHT,
    };
    const buttonLabel = t('shop.button');
    const showShopCard = true;

    return (
      <View style={[styles.liquidGlassWrapper, wrapperStyle, cardHeightStyle]}>
        <BlurView
          {...androidBlurProps}
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[styles.liquidGlassBackground, cardHeightStyle, { backgroundColor: glassBlurBg }]}
        >
          <ThemedView
            style={[
              styles.liquidGlassContainer,
              styles.recommendationContainer,
              cardHeightStyle,
              { backgroundColor: glassCardBg },
            ]}
            lightColor="rgba(255, 255, 255, 0.04)"
            darkColor="rgba(255, 255, 255, 0.02)"
          >
            {showShopCard ? (
              <View style={styles.recommendationCard}>
                <TouchableOpacity
                  style={styles.recommendationInnerCard}
                  onPress={handleFocusRecommendation}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={t('shop.accessibility')}
                >
                  <Image
                    source={require('../../assets/images/lotti-baby-shop-hero.png')}
                    style={[StyleSheet.absoluteFill, styles.recommendationImage]}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={[
                      'rgba(32, 19, 13, 0.02)',
                      'rgba(32, 19, 13, 0.16)',
                      'rgba(32, 19, 13, 0.88)',
                    ]}
                    locations={[0, 0.38, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.recommendationContentPane}>
                    <ThemedText adaptive={false} style={styles.recommendationEyebrow}>
                      {t('shop.eyebrow')}
                    </ThemedText>
                    <View
                      style={[
                        styles.recommendationFooter,
                        isStackedLayout ? styles.recommendationFooterStacked : null,
                      ]}
                    >
                      <View style={styles.recommendationTextWrap}>
                        <ThemedText adaptive={false} style={styles.recommendationTitle}>
                          {t('shop.title')}
                        </ThemedText>
                        <ThemedText adaptive={false} style={styles.recommendationDescription} numberOfLines={twoLineLimit}>
                          {t('shop.description')}
                        </ThemedText>
                      </View>
                      <View style={styles.recommendationButton}>
                        <ThemedText adaptive={false} style={styles.recommendationButtonText} numberOfLines={1}>
                          {buttonLabel}
                        </ThemedText>
                        <IconSymbol name="chevron.right" size={14} color="#5E3DB3" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.recommendationEmptyWrapper}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText adaptive={false} style={[styles.sectionTitle, styles.liquidGlassText, { color: textPrimary, fontSize: 22 }]}>
                    {t('shop.eyebrow')}
                  </ThemedText>
                  <View style={[styles.liquidGlassChevron, styles.recommendationHeaderSpacer]} />
                </View>
                <View style={styles.recommendationEmpty}>
                  <IconSymbol name="bag.fill" size={20} color={textSecondary} />
                  <ThemedText adaptive={false} style={[styles.recommendationEmptyText, { color: textSecondary }]}>
                    {t('shop.empty')}
                  </ThemedText>
                </View>
              </View>
            )}
          </ThemedView>
        </BlurView>
      </View>
    );
  };

  const renderOverviewSection = () => (
    <View
      style={styles.overviewCarouselWrapper}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth && nextWidth !== overviewCarouselWidth) {
          setOverviewCarouselWidth(nextWidth);
        }
      }}
    >
      <ScrollView
        ref={overviewScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.overviewCarousel}
        decelerationRate="fast"
        onScrollBeginDrag={handleOverviewScrollBeginDrag}
        onScrollEndDrag={handleOverviewScrollEndDrag}
        onMomentumScrollEnd={(event) => {
          if (!overviewCarouselWidth) return;
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / overviewCarouselWidth);
          overviewIndexRef.current = nextIndex;
          setOverviewIndex(nextIndex);
          if (isAutoScrollingRef.current) {
            isAutoScrollingRef.current = false;
            return;
          }
          scheduleOverviewRotationResume();
        }}
        scrollEventThrottle={16}
      >
        {[
          <React.Fragment key="daily-summary">{renderDailySummary(styles.carouselCardWrapper)}</React.Fragment>,
          <React.Fragment key="recommendation">{renderRecommendationCard(styles.carouselCardWrapper)}</React.Fragment>,
        ].map(
          (slide, index) => (
            <View
              key={`overview-slide-${index}`}
              style={[
                styles.overviewSlide,
                overviewCarouselWidth ? { width: overviewCarouselWidth } : null,
              ]}
            >
              {slide}
            </View>
          )
        )}
      </ScrollView>
      <View style={styles.carouselDots}>
        {[0, 1].map((index) => (
          <View
            key={`overview-dot-${index}`}
            style={[
              styles.carouselDot,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(107, 76, 59, 0.25)' },
              overviewIndex === index && { backgroundColor: isDark ? Colors.dark.text : '#6B4C3B' },
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderPremiumSection = () => {
    const items: PremiumHighlightItem[] = [];
    if (advisorAccess === true) {
      items.push({
        key: 'advisor',
        emoji: '🌿',
        title: t('premium.advisor'),
        subtitle: t('premium.advisorDescription'),
        onPress: () => handleNavigate('/lottis-fuersorge'),
      });
    }
    if (voiceLogAccess === true) {
      items.push({
        key: 'voice-log',
        emoji: '🎙️',
        title: t('premium.voice'),
        subtitle: t('premium.voiceDescription'),
        onPress: () => setShowVoiceLogModal(true),
      });
    }
    if (askLottiAccess === true) {
      items.push({
        key: 'ask-lotti',
        emoji: '✨',
        title: t('premium.askLotti'),
        subtitle: t('premium.askLottiDescription'),
        onPress: () => handleNavigate('/frag-lotti'),
      });
    }
    return <PremiumHighlights items={items} />;
  };

  const renderQuickAccessCard = (
    item: HomeQuickAccessCardConfig,
    options?: { isEditing?: boolean; isActive?: boolean }
  ) => {
    const isEditing = options?.isEditing ?? false;
    const canHideCard = isEditing && orderedQuickAccessCards.length > 1;

    return (
      <View
        style={[
          styles.liquidGlassCardWrapper,
          isEditing ? styles.quickAccessEditorCardWrapper : null,
          options?.isActive ? styles.quickAccessEditorCardWrapperActive : null,
        ]}
      >
        <BlurView
          {...androidBlurProps}
          intensity={item.blurIntensity ?? 24}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={styles.liquidGlassCardBackground}
        >
          <View
            style={[
              styles.card,
              styles.liquidGlassCard,
              scaledCardSizing,
              {
                backgroundColor: item.cardBackgroundColor,
                borderColor: 'rgba(255, 255, 255, 0.35)',
              },
              isEditing ? styles.quickAccessEditorCard : null,
            ]}
          >
            {canHideCard ? (
              <TouchableOpacity
                style={styles.quickAccessHideBadge}
                onPress={() => handleHideQuickAccessCard(item.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('quick.hideAccessibility', { title: item.title })}
              >
                <IconSymbol name="eye.slash" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            {isEditing ? (
              <View style={styles.quickAccessDragBadge}>
                <IconSymbol name="line.3.horizontal" size={14} color="#FFFFFF" />
              </View>
            ) : null}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: item.iconBackgroundColor,
                  borderRadius: 30,
                  padding: 8,
                  marginBottom: 10,
                  borderWidth: 2,
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                },
              ]}
            >
              <IconSymbol name={item.iconName} size={28} color="#FFFFFF" />
            </View>
            <ThemedText adaptive={false} style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
              {item.title}
            </ThemedText>
            <ThemedText adaptive={false} style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>
              {item.description}
            </ThemedText>
          </View>
        </BlurView>
      </View>
    );
  };

  const renderHiddenQuickAccessSection = () => {
    if (!isQuickAccessEditMode || !hiddenQuickAccessCards.length) {
      return null;
    }

    return (
      <View style={styles.quickAccessHiddenSection}>
        <View style={styles.quickAccessHiddenHeader}>
          <View style={styles.quickAccessHiddenHeaderText}>
            <ThemedText adaptive={false} style={[styles.quickAccessHiddenTitle, { color: textSecondary }]}>
              {t('quick.hiddenTitle')}
            </ThemedText>
            <ThemedText adaptive={false} style={[styles.quickAccessHiddenSubtitle, { color: textSecondary }]}>
              {hiddenQuickAccessCards.length === 1
                ? t('quick.hidden.one')
                : t('quick.hidden.other', { count: hiddenQuickAccessCards.length })}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[
              styles.quickAccessHiddenRestoreAllButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)',
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.8)',
              },
            ]}
            onPress={handleRestoreAllQuickAccessCards}
            activeOpacity={0.85}
          >
            <Text style={[styles.quickAccessHiddenRestoreAllText, { color: textPrimary }]}>{t('quick.restoreAll')}</Text>
          </TouchableOpacity>
        </View>

        <ThemedText adaptive={false} style={[styles.quickAccessHiddenHint, { color: textSecondary }]}>
          {t('quick.restoreHint')}
        </ThemedText>

        <View style={styles.quickAccessHiddenGrid}>
          {hiddenQuickAccessCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.quickAccessHiddenTileWrapper, hiddenTileWrapperSizing]}
              activeOpacity={0.86}
              onPress={() => handleRestoreQuickAccessCard(card.id)}
            >
              <BlurView
                {...androidBlurProps}
                intensity={card.blurIntensity ?? 24}
                tint={colorScheme === 'dark' ? 'dark' : 'light'}
                style={styles.liquidGlassCardBackground}
              >
                <View
                  style={[
                    styles.card,
                    styles.quickAccessHiddenTileCard,
                    scaledHiddenTileSizing,
                    {
                      backgroundColor: card.cardBackgroundColor,
                      borderColor: 'rgba(255, 255, 255, 0.28)',
                    },
                  ]}
                >
                  <View style={styles.quickAccessRestoreBadge}>
                    <IconSymbol name="arrow.uturn.left" size={14} color="#FFFFFF" />
                  </View>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor: card.iconBackgroundColor,
                        borderRadius: 26,
                        padding: 8,
                        marginBottom: 10,
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 255, 0.35)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4,
                      },
                    ]}
                  >
                    <IconSymbol name={card.iconName} size={24} color="#FFFFFF" />
                  </View>
                  <ThemedText adaptive={false} style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
                    {card.title}
                  </ThemedText>
                  <ThemedText adaptive={false} style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>
                    {t('quick.restore')}
                  </ThemedText>
                </View>
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderQuickAccessCards = () => (
    <View style={styles.cardsSection}>
      <ThemedText adaptive={false} style={[styles.cardsSectionTitle, styles.liquidGlassText, { color: textSecondary, fontSize: 22 }]}>
        {t('quick.title')}
      </ThemedText>

      {isQuickAccessEditMode ? (
        <View style={styles.quickAccessEditBar}>
          <TouchableOpacity
            style={[
              styles.quickAccessDoneButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)',
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.8)',
              },
            ]}
            onPress={closeQuickAccessEditor}
            activeOpacity={0.85}
          >
            <Text style={[styles.quickAccessDoneText, { color: textPrimary }]}>{t('quick.done')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <SortableQuickAccessGrid
        items={orderedQuickAccessCards}
        order={orderedQuickAccessCards.map(({ id }) => id)}
        isEditing={isQuickAccessEditMode}
        onPressItem={(item) => handleNavigate(item.destination)}
        onRequestEditMode={openQuickAccessEditor}
        onOrderChange={handleReorderQuickAccess}
        onDragStateChange={setIsQuickAccessDragging}
        scrollConfig={{
          metricsRef: quickAccessScrollMetricsRef,
          scrollToOffset: (offsetY) => {
            quickAccessScrollMetricsRef.current.offsetY = offsetY;
            mainScrollRef.current?.scrollTo({ y: offsetY, animated: false });
          },
          slowEdgeThreshold: 150,
          fastEdgeThreshold: 52,
          slowSpeed: 1.4,
          fastSpeed: 9,
        }}
        renderTile={({ item, isEditing, isActive }) =>
          renderQuickAccessCard(item, { isEditing, isActive })
        }
        style={styles.quickAccessGridList}
      />
      <ThemedText adaptive={false} style={[styles.quickAccessHint, { color: textSecondary }]}>
        {isQuickAccessEditMode
          ? t('quick.editHint')
          : t('quick.longPressHint')}
      </ThemedText>
      {isQuickAccessEditMode && hiddenQuickAccessCards.length > 0 ? (
        <ThemedText adaptive={false} style={[styles.quickAccessHiddenHint, { color: textSecondary }]}>
          {t('quick.hiddenHint')}
        </ThemedText>
      ) : null}
      {renderHiddenQuickAccessSection()}
    </View>
  );

  // Route-Guard in _layout.tsx handles mode-based redirects centrally.
  // An inline redirect here fires before isLoading settles and breaks
  // navigation flows like "Kind anlegen" (which temporarily sets
  // isBabyBorn=false while navigating to the baby-edit screen).

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>{t('loading.title')}</ThemedText>
          </View>
        ) : (
          <ScrollView 
          ref={mainScrollRef}
          style={styles.scrollView} 
          contentContainerStyle={styles.contentContainer}
          scrollEnabled={!isQuickAccessDragging}
          onLayout={(event) => {
            quickAccessScrollMetricsRef.current.viewportHeight = event.nativeEvent.layout.height;
          }}
            onContentSizeChange={(_, height) => {
              quickAccessScrollMetricsRef.current.contentHeight = height;
            }}
            onScroll={(event) => {
              quickAccessScrollMetricsRef.current.offsetY = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#7D5A50']}
                tintColor={theme.text}
                title={t('loading.refresh')}
                titleColor={theme.text}
              />
            }
          >
            {renderGreetingSection()}
            {renderOverviewSection()}
            {renderPremiumSection()}
            {renderQuickAccessCards()}
          </ScrollView>
        )}

        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          initialSubType={selectedSubType}
          date={new Date()}
          onClose={() => {
            setShowInputModal(false);
            setSelectedActivityType('feeding');
            setSelectedSubType(null);
          }}
          onSave={handleSaveEntry}
        />
        <SleepQuickAddModal
          visible={showSleepModal}
          initialStart={sleepModalStart}
          onClose={() => setShowSleepModal(false)}
          onSave={handleSaveSleepQuickEntry}
        />
        <VoiceLogModal
          visible={showVoiceLogModal}
          userId={user?.id}
          babyId={activeBabyId}
          onClose={() => setShowVoiceLogModal(false)}
          onSaved={() => {
            void handleVoiceLogSaved();
          }}
        />
        <NightWakePrompt
          visible={nightWakePromptVisible}
          candidate={nightWakeCandidate}
          feedingStart={nightWakeFeedingStart}
          busy={nightWakeBusy}
          onPickWake={pickNightWake}
          onTruncate={truncateNight}
          onDismiss={dismissNightWakePrompt}
        />
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f5eee0', // Beige Hintergrund wie im Bild
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },

  // Liquid Glass styles - Core Components
  liquidGlassWrapper: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  greetingCardWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  greetingGlassBackground: {
    borderRadius: 30,
  },
  greetingGlassContainer: {
    borderRadius: 30,
  },
  liquidGlassBackground: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)', // stärkerer Frostglas-Effekt
  },
  liquidGlassContainer: {
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },

  // Begrüßungsbereich - Liquid Glass Design
  greetingContainer: {
    paddingTop: 26,
    paddingHorizontal: 24,
    paddingBottom: 22,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  greetingTextBlock: {
    // Ohne flex drängt der Gruß bei großer Schrift das Profilbild aus der Karte.
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  dateText: {
    fontSize: 18,
    opacity: 0.8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileBadge: {
    flexShrink: 0,
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileStatusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5E3DB3',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  greetingGloss: {
    ...StyleSheet.absoluteFill,
    borderRadius: 30,
  },

  activeTimerCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 5,
  },
  activeTimerGradient: {
    // Kein absoluteFillObject — in RN 0.86 entfernt (zur Laufzeit undefined).
    ...StyleSheet.absoluteFill,
  },
  activeTimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTimerIconStack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTimerIconHalo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activeTimerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTimerContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  activeTimerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  activeTimerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeTimerLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  activeTimerTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  activeTimerChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTimerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  activeTimerElapsedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  activeTimerElapsed: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  activeTimerElapsedSeconds: {
    marginLeft: 1,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  activeTimerSincePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeTimerSince: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  activeTimerTrack: {
    marginTop: 12,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  activeTimerTrackFill: {
    height: 3,
    borderRadius: 2,
    width: '100%',
  },

  // Overview Carousel
  overviewCarouselWrapper: {
    marginBottom: 16,
  },
  overviewCarousel: {
    width: '100%',
  },
  overviewSlide: {
    width: '100%',
  },
  carouselCardWrapper: {
    marginBottom: 0,
    width: '100%',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107, 76, 59, 0.25)',
    marginHorizontal: 4,
  },
  carouselDotActive: {
    backgroundColor: '#6B4C3B',
  },

  // Recommendation Card
  recommendationContainer: {
    flex: 1,
    padding: 12,
  },
  recommendationCard: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  recommendationInnerCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#6B4C3B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  recommendationImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  recommendationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recommendationContentPane: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  recommendationEyebrow: {
    color: 'rgba(255, 255, 255, 0.84)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recommendationFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  recommendationFooterStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  recommendationTextWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  recommendationTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.25,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  recommendationDescription: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recommendationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingLeft: 14,
    paddingRight: 11,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  recommendationButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5E3DB3',
  },
  recommendationEmptyWrapper: {
    flex: 1,
  },
  recommendationHeaderSpacer: {
    opacity: 0,
  },
  recommendationEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  recommendationEmptyText: {
    fontSize: 13,
    color: '#7D5A50',
    marginTop: 8,
    textAlign: 'center',
  },

  // Tagesübersicht - Liquid Glass Design
  summaryContainer: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    width: '100%',
  },
  statsContainerStacked: {
    flexDirection: 'column',
    gap: 10,
  },
  statItemStacked: {
    width: '100%',
    minWidth: '100%',
    maxWidth: '100%',
  },
  statItem: {
    alignItems: 'center',
    width: '31.4%',
    minWidth: '31.4%',
    maxWidth: '31.4%',
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 16,

  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.9,
  },

  // Enhanced Liquid Glass Text Styles
  liquidGlassText: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
  },
  liquidGlassSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },

  // Stats with Liquid Glass Enhancement
  liquidGlassStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    minHeight: 66,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liquidGlassStatIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 32,
    padding: 14,
    marginBottom: 6,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  statEmoji: {
    fontSize: 32,
    lineHeight: 34,
    textAlign: 'center',
  },
  liquidGlassStatValue: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
    marginBottom: 2,
    lineHeight: 26,
  },
  statValueContainer: {
    minHeight: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedingMlUnit: {
    fontSize: 14,
    fontWeight: '700',
  },
  liquidGlassStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  feedingDetailsWrap: {
    alignItems: 'center',
    marginTop: 4,
    minHeight: 30,
    width: '100%',
    minWidth: 0,
  },
  feedingDetailPrimary: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
  },
  feedingDetailSecondary: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    opacity: 0.9,
    textAlign: 'center',
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
  },
  liquidGlassChevron: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // Quick Access Cards Section
  cardsSection: {
    marginBottom: 16,
  },
  cardsSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
    color: '#6B4C3B',
    letterSpacing: -0.3,
  },
  quickAccessHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  quickAccessHiddenHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  quickAccessGridItem: {
    width: '48%',
    marginBottom: 14,
  },

  // Liquid Glass Cards
  liquidGlassCardWrapper: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassCardBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    height: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  quickAccessEditorCardWrapper: {
    marginBottom: 0,
  },
  quickAccessEditorCardWrapperActive: {
    opacity: 0.92,
  },
  quickAccessEditorCard: {
    minHeight: 132,
  },
  quickAccessHideBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 76, 59, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  quickAccessDragBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 76, 59, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  quickAccessEditBar: {
    alignItems: 'center',
    marginBottom: 12,
  },
  quickAccessDoneButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickAccessDoneText: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickAccessGridList: {
    flexGrow: 0,
  },
  quickAccessGridListContent: {
    paddingBottom: 12,
  },
  quickAccessHiddenSection: {
    marginTop: 14,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  quickAccessHiddenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  quickAccessHiddenHeaderText: {
    flex: 1,
  },
  quickAccessHiddenTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  quickAccessHiddenSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  quickAccessHiddenRestoreAllButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickAccessHiddenRestoreAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickAccessHiddenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAccessHiddenTileWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  quickAccessHiddenTileCard: {
    minHeight: 118,
    height: 118,
    paddingVertical: 14,
    opacity: 0.92,
  },
  quickAccessRestoreBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(94, 61, 179, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  quickAccessEditorRow: {
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  liquidGlassIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '500',
  },
});
