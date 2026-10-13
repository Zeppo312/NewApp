import { AppState } from 'react-native';
import { localHealthAllowed, localHealthGeneration } from '@/lib/localHealthStorage';
/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/contexts/LocaleContext';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, Platform, ToastAndroid, Animated, Easing, Text, Image, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import { Colors, ContentColors } from '@/constants/Colors';
import { CONTENT_LAYOUT, TYPOGRAPHY } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { HomeBackground, HomeGlassSurface, androidHomeShadow } from '@/components/ui/home-glass';
import BabySwitcherButton from '@/components/BabySwitcherButton';
import { PregnancyProgressRing } from '@/components/PregnancyProgressRing';
import { IconSymbol } from '@/components/ui/IconSymbol';
import CountdownTimer from '@/components/CountdownTimer';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, getDueDateWithLinkedUsers } from '@/lib/supabase';
import { loadPregnancyHomeDataWithCache, invalidatePregnancyCache } from '@/lib/pregnancyCache';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { pregnancyMotherInfo } from '@/constants/PregnancyMotherInfo';
import { pregnancyPartnerInfo } from '@/constants/PregnancyPartnerInfo';
import { pregnancySymptoms } from '@/constants/PregnancySymptoms';
import { BIRTH_PREP_SECTION_START_WEEK, birthPreparationMeasures } from '@/constants/BirthPreparationMeasures';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import SortableTileGrid, { type SortableTileGridScrollMetrics } from '@/components/SortableTileGrid';
import VoiceLogModal from '@/components/VoiceLogModal';
import PremiumHighlights, { type PremiumHighlightItem } from '@/components/PremiumHighlights';
import { useAdvisorAccess } from '@/lib/advisor/access';
import { useVoiceLogAccess } from '@/lib/voiceLog/access';
import { useAskLottiAccess } from '@/lib/askLotti/access';
import {
  DEFAULT_PREGNANCY_HOME_LOCALE,
  getPregnancyHomeLocaleTag,
  PregnancyHomeTranslationKey,
  translatePregnancyHomeText,
} from '@/lib/pregnancyHomeTranslations';
import { useFontScale, useLineLimit, useTileGridMetrics } from '@/lib/fontScaling';
import PregnancyOverviewCarousel from '@/components/pregnancy-guide/overview-carousel';
import { DEFAULT_OVERVIEW_HEIGHT, PregnancyNumbersSlide } from '@/components/pregnancy-guide/overview-card';
import { usePregnancyAge } from '@/hooks/use-pregnancy-age';

let ACTIVE_PREGNANCY_HOME_LOCALE = DEFAULT_PREGNANCY_HOME_LOCALE;
let PREGNANCY_HOME_LOCALE_TAG = getPregnancyHomeLocaleTag(ACTIVE_PREGNANCY_HOME_LOCALE);
const t = (key: PregnancyHomeTranslationKey, params?: Record<string, string | number>) =>
  translatePregnancyHomeText(ACTIVE_PREGNANCY_HOME_LOCALE, key, params);

function TipHighlightDots() {
  const dotOne = React.useState(() => new Animated.Value(0))[0];
  const dotTwo = React.useState(() => new Animated.Value(0))[0];
  const dotThree = React.useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const createPulse = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

    const pulseOne = createPulse(dotOne, 0);
    const pulseTwo = createPulse(dotTwo, 500);
    const pulseThree = createPulse(dotThree, 1000);

    pulseOne.start();
    pulseTwo.start();
    pulseThree.start();

    return () => {
      pulseOne.stop();
      pulseTwo.stop();
      pulseThree.stop();
    };
  }, [dotOne, dotTwo, dotThree]);

  const makeDotStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.95] }),
    transform: [
      { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) },
    ],
  });

  return (
    <View pointerEvents="none" style={styles.tipHighlightContainer}>
      <Animated.View style={[styles.tipHighlightDot, styles.tipHighlightDotOne, makeDotStyle(dotOne)]} />
      <Animated.View style={[styles.tipHighlightDot, styles.tipHighlightDotTwo, makeDotStyle(dotTwo)]} />
      <Animated.View style={[styles.tipHighlightDot, styles.tipHighlightDotThree, makeDotStyle(dotThree)]} />
    </View>
  );
}

// AsyncStorage-Schlüssel
const LAST_POPUP_DATE_KEY = 'lastDueDatePopup';

// Definiere Typen für die verknüpften Benutzer
interface LinkedUser {
  firstName: string;
  id: string;
}

type PregnancyQuickAccessCardId =
  | 'countdown'
  | 'contraction-tracker'
  | 'planner'
  | 'checklist'
  | 'birth-plan'
  | 'selfcare'
  | 'doctor-questions'
  | 'baby'
  | 'baby-names'
  | 'weight-tracker';

type PregnancyQuickAccessCardConfig = {
  id: PregnancyQuickAccessCardId;
  title: string;
  description: string;
  iconName: string;
  destination: any;
  cardBackgroundColor: string;
  iconBackgroundColor: string;
};

type PregnancyQuickAccessCardDefinition = Omit<PregnancyQuickAccessCardConfig, 'title' | 'description'> & {
  titleKey: PregnancyHomeTranslationKey;
  descriptionKey: PregnancyHomeTranslationKey;
};

const PREGNANCY_QUICK_ACCESS_ORDER_STORAGE_PREFIX = 'pregnancy_home_quick_access_order';
const PREGNANCY_QUICK_ACCESS_HIDDEN_STORAGE_PREFIX = 'pregnancy_home_quick_access_hidden';

const PREGNANCY_QUICK_ACCESS_CARD_DEFINITIONS: PregnancyQuickAccessCardDefinition[] = [
  {
    id: 'countdown',
    titleKey: 'card.countdown.title',
    descriptionKey: 'card.countdown.description',
    iconName: 'calendar',
    destination: { pathname: '/(tabs)/countdown' },
    cardBackgroundColor: 'rgba(168, 196, 193, 0.6)',
    iconBackgroundColor: 'rgba(168, 196, 193, 0.9)',
  },
  {
    id: 'contraction-tracker',
    titleKey: 'card.contractions.title',
    descriptionKey: 'card.contractions.description',
    iconName: 'timer',
    destination: '/(tabs)',
    cardBackgroundColor: 'rgba(255, 190, 190, 0.6)',
    iconBackgroundColor: 'rgba(255, 140, 160, 0.9)',
  },
  {
    id: 'planner',
    titleKey: 'card.planner.title',
    descriptionKey: 'card.planner.description',
    iconName: 'clock',
    destination: '/planner',
    cardBackgroundColor: 'rgba(195, 220, 255, 0.6)',
    iconBackgroundColor: 'rgba(120, 170, 255, 0.9)',
  },
  {
    id: 'checklist',
    titleKey: 'card.checklist.title',
    descriptionKey: 'card.checklist.description',
    iconName: 'checklist',
    destination: { pathname: '/(tabs)/explore' },
    cardBackgroundColor: 'rgba(220, 200, 255, 0.6)',
    iconBackgroundColor: 'rgba(200, 130, 220, 0.9)',
  },
  {
    id: 'birth-plan',
    titleKey: 'card.birthPlan.title',
    descriptionKey: 'card.birthPlan.description',
    iconName: 'doc.text.fill',
    destination: { pathname: '/(tabs)/geburtsplan' },
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
    id: 'doctor-questions',
    titleKey: 'card.questions.title',
    descriptionKey: 'card.questions.description',
    iconName: 'questionmark.circle',
    destination: '/doctor-questions',
    cardBackgroundColor: 'rgba(255, 210, 230, 0.6)',
    iconBackgroundColor: 'rgba(255, 160, 180, 0.9)',
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
    id: 'baby-names',
    titleKey: 'card.names.title',
    descriptionKey: 'card.names.description',
    iconName: 'person.text.rectangle',
    destination: '/baby-names',
    cardBackgroundColor: 'rgba(200, 225, 255, 0.6)',
    iconBackgroundColor: 'rgba(140, 190, 255, 0.9)',
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
];

const PREGNANCY_QUICK_ACCESS_ORDER = PREGNANCY_QUICK_ACCESS_CARD_DEFINITIONS.map(({ id }) => id);

const normalizePregnancyQuickAccessOrder = (value: unknown): PregnancyQuickAccessCardId[] => {
  if (!Array.isArray(value)) return [...PREGNANCY_QUICK_ACCESS_ORDER];

  const seen = new Set<PregnancyQuickAccessCardId>();
  const normalized: PregnancyQuickAccessCardId[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!PREGNANCY_QUICK_ACCESS_ORDER.includes(entry as PregnancyQuickAccessCardId)) continue;
    if (seen.has(entry as PregnancyQuickAccessCardId)) continue;
    seen.add(entry as PregnancyQuickAccessCardId);
    normalized.push(entry as PregnancyQuickAccessCardId);
  }

  for (const id of PREGNANCY_QUICK_ACCESS_ORDER) {
    if (!seen.has(id)) {
      normalized.push(id);
    }
  }

  return normalized;
};

const buildPregnancyQuickAccessOrderStorageKey = (userId?: string | null) =>
  `${PREGNANCY_QUICK_ACCESS_ORDER_STORAGE_PREFIX}:${userId ?? 'anonymous'}`;

const buildPregnancyQuickAccessHiddenStorageKey = (userId?: string | null) =>
  `${PREGNANCY_QUICK_ACCESS_HIDDEN_STORAGE_PREFIX}:${userId ?? 'anonymous'}`;

const normalizePregnancyQuickAccessHidden = (value: unknown): PregnancyQuickAccessCardId[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<PregnancyQuickAccessCardId>();
  const normalized = value
    .filter((entry): entry is PregnancyQuickAccessCardId => {
      return typeof entry === 'string' && PREGNANCY_QUICK_ACCESS_ORDER.includes(entry as PregnancyQuickAccessCardId);
    })
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .sort(
      (left, right) =>
        PREGNANCY_QUICK_ACCESS_ORDER.indexOf(left) - PREGNANCY_QUICK_ACCESS_ORDER.indexOf(right),
    );

  return normalized.slice(0, Math.max(0, PREGNANCY_QUICK_ACCESS_ORDER.length - 1));
};

// Konstanten für Überfälligkeits-Informationen
const overdueInfo = {
  baby: t('overdue.baby'),
  mother: t('overdue.mother'),
  partner: t('overdue.partner'),
  symptoms: [
    t('overdue.symptom.hardBelly'),
    t('overdue.symptom.discharge'),
    t('overdue.symptom.pressure'),
    t('overdue.symptom.contractions'),
    t('overdue.symptom.backPain'),
    t('overdue.symptom.fatigue'),
    t('overdue.symptom.tension'),
  ]
};

export default function PregnancyHomeScreen() {
  const { locale } = useLocale();
  ACTIVE_PREGNANCY_HOME_LOCALE = locale;
  PREGNANCY_HOME_LOCALE_TAG = getPregnancyHomeLocaleTag(ACTIVE_PREGNANCY_HOME_LOCALE);
  // Verwende useAdaptiveColors für korrekte Farben basierend auf Hintergrundbild
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;

  // Dark Mode angepasste Farben (wie in home.tsx)
  const textPrimary = isDark ? Colors.dark.textPrimary : '#6B4C3B';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentPurple = isDark ? Colors.dark.textAccent : '#5E3DB3';
  const glassCardBg = isDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.04)';
  const glassBlurBg = ContentColors[isDark ? 'dark' : 'light'].surface;
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();
  // Premium-Bereich (wie auf der Baby-Home): Fürsorge, Sprach-Logging, Frag Lotti.
  const advisorAccess = useAdvisorAccess();
  const voiceLogAccess = useVoiceLogAccess();
  const askLottiAccess = useAskLottiAccess();
  const [showVoiceLogModal, setShowVoiceLogModal] = useState(false);

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const age = usePregnancyAge(dueDate);
  const [userName, setUserName] = useState('');
  const metadataFirstName =
    typeof user?.user_metadata?.first_name === 'string' ? user.user_metadata.first_name : '';
  const metadataFullName =
    typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const displayName = userName || metadataFirstName || metadataFullName || t('greeting.fallbackName');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  useEffect(() => {
    setCurrentWeek(age?.runningWeek ?? null);
    setCurrentDay(age?.day ?? null);
  }, [age?.runningWeek, age?.day]);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewSummaryHeight, setOverviewSummaryHeight] = useState<number | null>(null);
  const [quickAccessOrder, setQuickAccessOrder] = useState<PregnancyQuickAccessCardId[]>([...PREGNANCY_QUICK_ACCESS_ORDER]);
  const [hiddenQuickAccessIds, setHiddenQuickAccessIds] = useState<PregnancyQuickAccessCardId[]>([]);
  const [isQuickAccessEditMode, setIsQuickAccessEditMode] = useState(false);
  const [isQuickAccessDragging, setIsQuickAccessDragging] = useState(false);
  // Kachelmaße wachsen mit der Systemschriftgröße mit, damit Titel und
  // Beschreibung bei großer Schrift nicht abgeschnitten werden.
  const tileMetrics = useTileGridMetrics();
  const { width: windowWidth } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const isCompactAndroid = Platform.OS === 'android' && windowWidth < 400;
  // Enge Zeilen-Layouts (Text + Button nebeneinander) brechen bei großer
  // Schrift auseinander — ab ~130 % stapeln wir sie stattdessen.
  const isStackedLayout = useFontScale() >= 1.3;
  const twoLineLimit = useLineLimit(2);
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
  const mainScrollRef = useRef<ScrollView | null>(null);
  const quickAccessScrollMetricsRef = useRef<SortableTileGridScrollMetrics>({
    offsetY: 0,
    viewportHeight: 0,
    contentHeight: 0,
  });
  // Animation für Erfolgsmeldung
  const fadeAnim = React.useState(() => new Animated.Value(0))[0];
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const quickAccessOrderStorageKey = useMemo(
    () => buildPregnancyQuickAccessOrderStorageKey(user?.id),
    [user?.id],
  );
  const quickAccessHiddenStorageKey = useMemo(
    () => buildPregnancyQuickAccessHiddenStorageKey(user?.id),
    [user?.id],
  );
  const quickAccessCardById = useMemo(
    () =>
      new Map(
        PREGNANCY_QUICK_ACCESS_CARD_DEFINITIONS.map(({ titleKey, descriptionKey, ...card }) => [
          card.id,
          {
            ...card,
            title: translatePregnancyHomeText(locale, titleKey),
            description: translatePregnancyHomeText(locale, descriptionKey),
          },
        ] as const),
      ),
    [locale],
  );
  const hiddenQuickAccessIdSet = useMemo(() => new Set(hiddenQuickAccessIds), [hiddenQuickAccessIds]);
  const orderedQuickAccessCards = useMemo(
    () =>
      quickAccessOrder
        .map((id) => quickAccessCardById.get(id))
        .filter(
          (card): card is PregnancyQuickAccessCardConfig =>
            !!card &&
            !hiddenQuickAccessIdSet.has(card.id),
        ),
    [hiddenQuickAccessIdSet, quickAccessCardById, quickAccessOrder],
  );
  const hiddenQuickAccessCards = useMemo(
    () =>
      quickAccessOrder
        .map((id) => quickAccessCardById.get(id))
        .filter(
          (card): card is PregnancyQuickAccessCardConfig =>
            !!card &&
            hiddenQuickAccessIdSet.has(card.id),
        ),
    [hiddenQuickAccessIdSet, quickAccessCardById, quickAccessOrder],
  );

  const openQuickAccessEditor = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsQuickAccessEditMode(true);
  }, []);

  const closeQuickAccessEditor = useCallback(() => {
    setIsQuickAccessDragging(false);
    setIsQuickAccessEditMode(false);
  }, []);

  const persistQuickAccessHiddenIds = useCallback(
    async (nextHiddenIds: PregnancyQuickAccessCardId[]) => {
      try {
        const normalized = normalizePregnancyQuickAccessHidden(nextHiddenIds);

        if (normalized.length === 0) {
          await AsyncStorage.removeItem(quickAccessHiddenStorageKey);
          return;
        }

        await AsyncStorage.setItem(quickAccessHiddenStorageKey, JSON.stringify(normalized));
      } catch (error) {
        console.error('Pregnancy Home: failed to save hidden quick access tiles', error);
      }
    },
    [quickAccessHiddenStorageKey],
  );

  const mergeVisibleOrderIntoQuickAccessOrder = useCallback(
    (nextVisibleOrder: PregnancyQuickAccessCardId[]) => {
      const hiddenIds = new Set(hiddenQuickAccessIds);
      const visibleQueue = [...nextVisibleOrder];
      const nextOrder: PregnancyQuickAccessCardId[] = [];

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
      return normalizePregnancyQuickAccessOrder(nextOrder);
    },
    [hiddenQuickAccessIds, quickAccessOrder],
  );

  const handleHideQuickAccessCard = useCallback(
    (itemId: PregnancyQuickAccessCardId) => {
      if (orderedQuickAccessCards.length <= 1) {
        Alert.alert(t('common.notice'), t('alert.keepTile'));
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setHiddenQuickAccessIds((currentHiddenIds) => {
        const nextHiddenIds = normalizePregnancyQuickAccessHidden([...currentHiddenIds, itemId]);
        void persistQuickAccessHiddenIds(nextHiddenIds);
        return nextHiddenIds;
      });
    },
    [orderedQuickAccessCards.length, persistQuickAccessHiddenIds],
  );

  const handleRestoreQuickAccessCard = useCallback(
    (itemId: PregnancyQuickAccessCardId) => {
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
          storedOrder
            ? normalizePregnancyQuickAccessOrder(JSON.parse(storedOrder))
            : [...PREGNANCY_QUICK_ACCESS_ORDER],
        );
        setHiddenQuickAccessIds(
          storedHiddenIds ? normalizePregnancyQuickAccessHidden(JSON.parse(storedHiddenIds)) : [],
        );
      } catch (error) {
        console.error('Pregnancy Home: failed to load quick access order or hidden tiles', error);
        if (isActive) {
          setQuickAccessOrder([...PREGNANCY_QUICK_ACCESS_ORDER]);
          setHiddenQuickAccessIds([]);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [quickAccessHiddenStorageKey, quickAccessOrderStorageKey]);

  const persistQuickAccessOrder = useCallback(
    async (nextOrder: PregnancyQuickAccessCardId[]) => {
      try {
        const normalized = normalizePregnancyQuickAccessOrder(nextOrder);

        if (normalized.every((id, index) => id === PREGNANCY_QUICK_ACCESS_ORDER[index])) {
          await AsyncStorage.removeItem(quickAccessOrderStorageKey);
          return;
        }

        await AsyncStorage.setItem(quickAccessOrderStorageKey, JSON.stringify(normalized));
      } catch (error) {
        console.error('Pregnancy Home: failed to save quick access order', error);
      }
    },
    [quickAccessOrderStorageKey],
  );

  const handleReorderQuickAccess = useCallback(
    (nextVisibleOrder: PregnancyQuickAccessCardId[]) => {
      const normalized = mergeVisibleOrderIntoQuickAccessOrder(nextVisibleOrder);
      setQuickAccessOrder(normalized);
      void persistQuickAccessOrder(normalized);
    },
    [mergeVisibleOrderIntoQuickAccessOrder, persistQuickAccessOrder],
  );

  // Hilfsfunktion zur Protokollierung mit Zeitstempel
  const logWithTimestamp = (message: string) => {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString()}] ${message}`);
  };

  // Überprüfen, ob das Fälligkeitsdatum überschritten ist und ggf. Popup anzeigen
  useEffect(() => {
    const checkPastDueDate = async () => {
      logWithTimestamp('Überprüfe, ob Entbindungstermin überschritten wurde...');
      
      if (!dueDate) {
        logWithTimestamp('Kein Entbindungstermin festgelegt');
        return;
      }
      
      if (!user) {
        logWithTimestamp('Kein Benutzer angemeldet');
        return;
      }
      
      if (isBabyBorn) {
        logWithTimestamp('Baby ist bereits geboren');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dueDateCopy = new Date(dueDate);
      dueDateCopy.setHours(0, 0, 0, 0);

      logWithTimestamp(`Heutiges Datum: ${today.toLocaleDateString()}`);
      logWithTimestamp(`Entbindungstermin: ${dueDateCopy.toLocaleDateString()}`);

      // Prüfen, ob der Entbindungstermin überschritten ist oder heute ist
      if (today.getTime() >= dueDateCopy.getTime()) {
        logWithTimestamp('Entbindungstermin ist heute oder wurde überschritten');

        // Prüfen, wann das letzte Popup gezeigt wurde
        const lastPopupDateStr = await AsyncStorage.getItem(LAST_POPUP_DATE_KEY);
        logWithTimestamp(`Letztes Popup-Datum: ${lastPopupDateStr || 'nie'}`);
        
        if (!lastPopupDateStr || new Date(lastPopupDateStr).toDateString() !== today.toDateString()) {
          logWithTimestamp('Zeige Popup an');
          
          // Speichern des heutigen Datums als letztes Popup-Datum
          await AsyncStorage.setItem(LAST_POPUP_DATE_KEY, today.toISOString());
          
          // Popup anzeigen
          // The delayed check runs after all handlers have been initialized.
          // eslint-disable-next-line react-hooks/immutability
          showPastDueDateAlert();
        } else {
          logWithTimestamp('Popup wurde heute bereits angezeigt');
        }
      } else {
        logWithTimestamp('Entbindungstermin liegt in der Zukunft');
      }
    };

    // Verzögerung hinzufügen, um sicherzustellen, dass alles initialisiert ist
    const timer = setTimeout(() => {
      checkPastDueDate();
    }, 1000);

    return () => clearTimeout(timer);
  }, [dueDate, user, isBabyBorn]);

  const showPastDueDateAlert = () => {
    Alert.alert(
      t('dueDate.overdueTitle'),
      t('dueDate.overdueQuestion'),
      [
        {
          text: t('dueDate.notBorn'),
          style: "cancel"
        },
        {
          text: t('dueDate.born'),
          onPress: handleBabyBorn
        }
      ]
    );
  };

  const getLinkedUsers = async (userId: string) => {
    try {
      const result = await getDueDateWithLinkedUsers(userId);
      return {
        success: result.success,
        linkedUsers: result.linkedUsers || [],
        error: result.error
      };
    } catch (error) {
      console.error('Error getting linked users:', error);
      return { success: false, linkedUsers: [], error };
    }
  };

  const handleBabyBorn = async () => {
    try {
      // Setzen des Baby-Status auf 'geboren'
      await setIsBabyBorn(true);

      // Invalidate cache after status change
      if (user?.id) {
        await invalidatePregnancyCache(user.id);
      }

      // Prüfen, ob der Benutzer mit anderen Benutzern verknüpft ist
      const linkedUsersResult = await getLinkedUsers(user?.id || '');
      let syncMessage = '';

      if (linkedUsersResult.success && linkedUsersResult.linkedUsers && linkedUsersResult.linkedUsers.length > 0) {
        const linkedUserNames = linkedUsersResult.linkedUsers
          .map((user: LinkedUser) => user.firstName)
          .join(', ');

        syncMessage = t('born.synced', { names: linkedUserNames });
      }

      // Erfolgsmeldung anzeigen
      Alert.alert(
        t('born.congratulations'),
        t('born.message', { syncMessage }),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              // Navigation zum Baby-Dashboard
              router.replace('/(tabs)/baby');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Fehler beim Setzen des Baby-Status:', error);
      Alert.alert(t('common.error'), t('born.statusFailed'));
    }
  };

  // Lädt Benutzerinformationen und aktualisiert die Anzeige
  const pregnancyScopeRef = useRef(user?.id); pregnancyScopeRef.current = user?.id;
  const pregnancyFlight = useRef<{ id: string; task: Promise<boolean> } | null>(null);
  const [, setPregnancyReadState] = useState<{ verifiedAt?: string; loading?: boolean; failed?: boolean }>({});
  const loadUserData = (): Promise<boolean> => {
    if (!user?.id) return Promise.resolve(false);
    if (pregnancyFlight.current?.id === user.id) return pregnancyFlight.current.task;
    const id = user.id; const generation = localHealthGeneration();
    const current = () => pregnancyScopeRef.current === id && localHealthAllowed(id, generation);
    const task = (async () => {
      try {
        setPregnancyReadState(v => ({ ...v, loading: true }));
        const cached = await loadPregnancyHomeDataWithCache(id, { onConfirmed: (data, at) => {
          if (!current()) return;
          if (data.profile) setUserName(data.profile.firstName);
          if (data.dueDate) { setDueDate(data.dueDate.date); setCurrentWeek(data.dueDate.currentWeek); setCurrentDay(data.dueDate.currentDay); }
        } });
        if (!current()) return false;
        if (cached.hasProfile) setUserName(cached.profile.firstName);
        if (cached.hasDueDate) { setDueDate(cached.dueDate.date); setCurrentWeek(cached.dueDate.currentWeek); setCurrentDay(cached.dueDate.currentDay); }
        setPregnancyReadState(v => ({ ...v, verifiedAt: cached.verifiedAt ?? v.verifiedAt }));
        await cached.refresh();
        if (!current()) return false;
        setPregnancyReadState({ verifiedAt: new Date().toISOString() }); return true;
      } catch { if (current()) setPregnancyReadState(v => ({ ...v, loading: false, failed: true })); return false; }
    })().finally(() => { if (pregnancyFlight.current?.task === task) pregnancyFlight.current = null; });
    pregnancyFlight.current = { id, task }; return task;
  };
  useEffect(() => { setUserName(''); setDueDate(null); setPregnancyReadState({}); void loadUserData(); }, [user?.id]);
  useFocusEffect(useCallback(() => { void loadUserData(); }, [user?.id]));
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state === 'active') void loadUserData(); }); return () => listener.remove(); }, [user?.id]);

  // Zeigt eine Erfolgsmeldung an, die nach einigen Sekunden ausblendet
  const showUpdateSuccess = () => {
    setUpdateSuccess(true);
    
    // Animation starten
    Animated.sequence([
      // Einblenden
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Warten
      Animated.delay(2000),
      // Ausblenden
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setUpdateSuccess(false);
    });
  };

  // Funktion zum Aktualisieren der Daten (Pull-to-Refresh)
  const onRefresh = async () => {
    setRefreshing(true);

    try {
      const confirmed = await loadUserData();
      if (!confirmed) return;

      // Plattformspezifisches Feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show(t('refresh.updated'), ToastAndroid.SHORT);
      } else {
        // iOS-Feedback (wird durch Animation angezeigt)
        showUpdateSuccess();
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString(PREGNANCY_HOME_LOCALE_TAG, options);
  };

  const calculatePregnancyProgressPercent = () => {
    if (!dueDate) return 0;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const dueDateCopy = new Date(dueDate);
    dueDateCopy.setHours(0, 0, 0, 0);

    const difference = dueDateCopy.getTime() - now.getTime();
    const daysLeft = Math.round(difference / (1000 * 60 * 60 * 24));

    const totalDaysInPregnancy = 280;
    const daysRemaining = Math.max(0, daysLeft);
    const daysPregnant = totalDaysInPregnancy - daysRemaining;
    const progress = Math.min(1, Math.max(0, daysPregnant / totalDaysInPregnancy));

    return Math.round(progress * 100);
  };

  const pregnancyProgressPercent = calculatePregnancyProgressPercent();

  const handleFocusRecommendation = () => {
    router.push('/prints-shop' as any);
  };

  const renderPregnancyOverviewCard = () => <PregnancyNumbersSlide locale={locale} currentWeek={currentWeek}
    progress={pregnancyProgressPercent} compact={isCompactAndroid} stacked={isStackedLayout}
    onPress={() => router.push('/(tabs)/countdown')} onLayout={event => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight > 0) setOverviewSummaryHeight(current => current === nextHeight ? current : nextHeight);
    }} />;

  const renderRecommendationCard = (wrapperStyle?: StyleProp<ViewStyle>) => {
    const cardHeightStyle = { height: overviewSummaryHeight ?? DEFAULT_OVERVIEW_HEIGHT };
    const buttonLabel = t('shop.button');
    const showShopCard = true;

    return (
      <View style={[styles.liquidGlassWrapper, wrapperStyle, cardHeightStyle]}>
        <HomeGlassSurface
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[styles.liquidGlassBackground, cardHeightStyle, { backgroundColor: glassBlurBg }]}
        >
          <ThemedView
            style={[styles.liquidGlassContainer, styles.recommendationContainer, cardHeightStyle, { backgroundColor: glassCardBg }]}
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
        </HomeGlassSurface>
      </View>
    );
  };

  const renderOverviewSection = () => {
    const height = overviewSummaryHeight ?? DEFAULT_OVERVIEW_HEIGHT;
    return <PregnancyOverviewCarousel height={height}>
      {renderPregnancyOverviewCard()}
      {renderRecommendationCard(styles.carouselCardWrapper)}
    </PregnancyOverviewCarousel>;
  };

  const shouldShowBirthPreparationCard = Boolean(
    currentWeek && currentWeek >= BIRTH_PREP_SECTION_START_WEEK
  );
  const birthPrepPreview = birthPreparationMeasures
    .slice(0, 3)
    .map((measure) => measure.title)
    .join(' • ');

  const openBirthPreparationOverview = () => {
    router.push({
      pathname: '/(tabs)/countdown',
      params: { focus: 'birth-preparation' },
    } as any);
  };

  const renderQuickAccessCard = (
    item: PregnancyQuickAccessCardConfig,
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
        <HomeGlassSurface
          intensity={24}
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
                  ...androidHomeShadow,
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
        </HomeGlassSurface>
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
              <HomeGlassSurface
                intensity={24}
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
                        ...androidHomeShadow,
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
              </HomeGlassSurface>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderPremiumSection = () => {
    const items: PremiumHighlightItem[] = [];
    if (advisorAccess !== null) {
      items.push({
        key: 'advisor',
        locked: advisorAccess !== true,
        emoji: '🌿',
        title: t('premium.advisor'),
        subtitle: t('premium.advisorDescription'),
        onPress: () => router.push('/lottis-fuersorge'),
      });
    }
    if (voiceLogAccess !== null) {
      items.push({
        key: 'voice-log',
        locked: voiceLogAccess !== true,
        emoji: '🎙️',
        title: t('premium.voice'),
        subtitle: t('premium.voiceDescription'),
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setShowVoiceLogModal(true);
        },
      });
    }
    if (askLottiAccess !== null) {
      items.push({
        key: 'ask-lotti',
        locked: askLottiAccess !== true,
        emoji: '✨',
        title: t('premium.askLotti'),
        subtitle: t('premium.askLottiDescription'),
        onPress: () => router.push('/frag-lotti'),
      });
    }
    return (
      <PremiumHighlights
        items={items}
        onUnlock={() => router.push('/paywall?origin=lock_premium')}
      />
    );
  };

  const renderQuickAccessSection = () => (
    <View style={styles.cardsSection}>
      <ThemedText adaptive={false} style={[styles.cardsSectionTitle, { color: textSecondary, fontSize: 22 }]}>
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

      <SortableTileGrid
        items={orderedQuickAccessCards}
        isEditing={isQuickAccessEditMode}
        onPressItem={(item) => {
          router.push(item.destination);
        }}
        onRequestEditMode={openQuickAccessEditor}
        onOrderChange={(data) => handleReorderQuickAccess(data.map(({ id }) => id))}
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
  // An inline redirect here fires before user data loads and breaks
  // navigation flows like "Schwangerschaft anlegen".

  return (
    <HomeBackground style={styles.backgroundImage}>
      <SafeAreaView style={[styles.container, Platform.OS === 'android' && { paddingTop: safeAreaInsets.top }]}>
        <StatusBar hidden={true} />
        
        {/* Erfolgs-Animation für iOS */}
        {updateSuccess && (
          <Animated.View style={[styles.updateSuccessContainer, { opacity: fadeAnim }]}>
            <View style={styles.updateSuccessContent}>
              <IconSymbol name="checkmark.circle.fill" size={32} color={textSecondary} />
              <ThemedText adaptive={false} style={[styles.updateSuccessText, { color: textSecondary }]}>
                {t('refresh.updated')}
              </ThemedText>
            </View>
          </Animated.View>
        )}
        
        <ScrollView 
          ref={mainScrollRef}
          style={styles.scrollView} 
          contentContainerStyle={[styles.contentContainer, isCompactAndroid && styles.contentContainerCompact]}
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
              colors={['#7D5A50']} // Farbe für Android
              tintColor={theme.text} // Farbe für iOS
              title={refreshing ? t('refresh.active') : t('refresh.pull')} // Nur auf iOS sichtbar
              titleColor={theme.text} // Farbe für den Text auf iOS
            />
          }
        >
          {/* Begrüßung - Liquid Glass Design */}
          <View style={[styles.liquidGlassWrapper, styles.greetingCardWrapper]}>
            <HomeGlassSurface
              intensity={22}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
              style={[styles.liquidGlassBackground, styles.greetingGlassBackground, { backgroundColor: glassBlurBg }]}
            >
              <ThemedView
                style={[styles.greetingContainer, styles.liquidGlassContainer, styles.greetingGlassContainer, isCompactAndroid && styles.greetingContainerCompact, { backgroundColor: glassCardBg }]}
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
                    <ThemedText adaptive={false} style={[styles.liquidGlassSecondaryText, styles.dateText, { color: textPrimary }]}>
                      {formatDate()}
                    </ThemedText>
                  </View>

                  <View style={styles.profileBadge}>
                    <PregnancyProgressRing percent={pregnancyProgressPercent} contentSize={68} inset={4} ringStroke={4.5}>
                      <BabySwitcherButton size={68} showSwitchHint />
                    </PregnancyProgressRing>
                  </View>
                </View>

                {shouldShowBirthPreparationCard ? (
                  <TouchableOpacity
                    style={styles.tipCard}
                    onPress={openBirthPreparationOverview}
                    activeOpacity={0.9}
                  >
                    <TipHighlightDots />
                    <View style={styles.tipCardRow}>
                      <View style={styles.tipIconWrap}>
                        <IconSymbol name="calendar" size={18} color="#D6B28C" />
                      </View>
                      <View style={styles.tipContent}>
                        <ThemedText adaptive={false} style={[styles.tipLabel, { color: accentPurple }]}>
                          {t('birthPrep.title')}
                        </ThemedText>
                        <ThemedText adaptive={false} style={[styles.tipText, { color: textPrimary }]}>
                          {t('birthPrep.description')}
                        </ThemedText>
                        <ThemedText adaptive={false} style={[styles.birthPrepTeaserList, { color: textSecondary }]}>
                          {birthPrepPreview}
                        </ThemedText>
                        <View style={styles.birthPrepTeaserCta}>
                          <ThemedText adaptive={false} style={styles.birthPrepTeaserCtaText}>
                            {t('birthPrep.action')}
                          </ThemedText>
                          <IconSymbol name="chevron.right" size={14} color="#FFFFFF" />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </ThemedView>
            </HomeGlassSurface>
          </View>

          {renderOverviewSection()}

          {renderPremiumSection()}

          {renderQuickAccessSection()}
        </ScrollView>
      </SafeAreaView>
      <VoiceLogModal
        visible={showVoiceLogModal}
        userId={user?.id}
        babyId={null}
        babyName={null}
        mode="pregnancy"
        onClose={() => setShowVoiceLogModal(false)}
        onSaved={() => {}}
      />
    </HomeBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f5eee0', // Beige Hintergrund wie im Bild
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: CONTENT_LAYOUT.edge,
    paddingBottom: 40,
  },
  contentContainerCompact: {
    paddingHorizontal: CONTENT_LAYOUT.edge,
  },
  greetingContainerCompact: {
    paddingHorizontal: CONTENT_LAYOUT.cardPadding,
    paddingTop: CONTENT_LAYOUT.cardPadding,
    paddingBottom: CONTENT_LAYOUT.cardPadding,
  },
  summaryContainerCompact: {
    padding: 16,
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
  carouselDotButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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

  // Liquid Glass styles - Core Components
  liquidGlassWrapper: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
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
    ...androidHomeShadow,
  },
  greetingCardWrapper: {
    borderRadius: CONTENT_LAYOUT.cardRadius,
    marginBottom: CONTENT_LAYOUT.sectionGap,
    overflow: 'hidden',
  },
  greetingGlassBackground: {
    borderRadius: CONTENT_LAYOUT.cardRadius,
  },
  greetingGlassContainer: {
    borderRadius: CONTENT_LAYOUT.cardRadius,
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
    boxShadow: CONTENT_LAYOUT.cardShadow,
  },
  greetingContainer: {
    paddingTop: CONTENT_LAYOUT.cardPadding,
    paddingHorizontal: CONTENT_LAYOUT.cardPadding,
    paddingBottom: CONTENT_LAYOUT.cardPadding,
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
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    ...TYPOGRAPHY.display,
    marginBottom: 4,
  },
  dateText: {
    ...TYPOGRAPHY.bodySmall,
    opacity: 0.8,
  },
  profileBadge: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  greetingGloss: {
    ...StyleSheet.absoluteFill,
    borderRadius: CONTENT_LAYOUT.cardRadius,
  },

  // Tip Container
  tipCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    ...androidHomeShadow,
  },
  tipHighlightContainer: {
    ...StyleSheet.absoluteFill,
  },
  tipHighlightDot: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
    ...androidHomeShadow,
  },
  tipHighlightDotOne: {
    width: 10,
    height: 10,
    borderRadius: 5,
    top: 10,
    right: 16,
  },
  tipHighlightDotTwo: {
    width: 6,
    height: 6,
    borderRadius: 3,
    top: 28,
    right: 44,
  },
  tipHighlightDotThree: {
    width: 8,
    height: 8,
    borderRadius: 4,
    bottom: 10,
    right: 28,
  },
  tipCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5E3DB3',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: '#6B4C3B',
  },
  liquidGlassText: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
  },
  liquidGlassSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  countdownContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    ...androidHomeShadow,
  },
  weeklyInfoContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    ...androidHomeShadow,
  },
  infoSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#7D5A50',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 32,
  },
  symptomsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    ...androidHomeShadow,
  },
  symptomsList: {
    paddingLeft: 8,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  symptomText: {
    fontSize: 14,
    marginLeft: 8,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#7D5A50',
    lineHeight: 28,
  },
  cardsSection: {
    marginBottom: 16,
  },
  birthPrepTeaserList: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 8,
  },
  birthPrepTeaserCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5E3DB3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  birthPrepTeaserCtaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 4,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    ...androidHomeShadow,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#7D5A50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7D5A50',
    textAlign: 'center',
  },
  updateSuccessContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingTop: 60,
  },
  updateSuccessContent: {
    backgroundColor: 'rgba(248, 240, 229, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 6,
    ...androidHomeShadow,
  },
  updateSuccessText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7D5A50',
    marginLeft: 10,
  },
  overdueContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueTitle: {
    color: '#E57373',
  },
  overdueInfoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    ...androidHomeShadow,
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overdueInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E57373',
    marginLeft: 8,
  },
  overdueInfoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  overdueButton: {
    backgroundColor: '#E57373',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  overdueButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statsContainerAndroid: {
    justifyContent: 'space-between',
    gap: 8,
  },
  statsContainerStacked: {
    flexDirection: 'column',
  },
  statItemAndroid: {
    marginHorizontal: 0,
    minWidth: 0,
  },
  statItemStacked: {
    flex: 0,
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
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
  postPregnancyContainer: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  postPregnancyContent: {
    alignItems: 'center',
  },
  postPregnancyImageContainer: {
    marginBottom: 15,
  },
  postPregnancyDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 15,
  },
  postPregnancyFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  postPregnancyFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  liquidGlassFeatureItem: {
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...androidHomeShadow,
  },
  featureText: {
    fontSize: 12,
    marginLeft: 8,
    color: '#7D5A50',
    fontWeight: '500',
  },

  // Stats with Liquid Glass Enhancement
  liquidGlassStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    ...androidHomeShadow,
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
    ...androidHomeShadow,
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
  liquidGlassStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
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
    ...androidHomeShadow,
  },

  // Quick Access Cards Section
  cardsSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
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
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '500',
  },
});
