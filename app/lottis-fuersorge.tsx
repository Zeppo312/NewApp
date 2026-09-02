import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Share,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter , useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GlassCard } from '@/components/ui/GlassCard';
import { CareAnalyticsSection } from '@/components/CareAnalyticsSection';
import { CareDayTimeline } from '@/components/advisor/CareDayTimeline';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAdvisorAccess } from '@/lib/advisor/access';
import {
  fetchAdvisorSettings,
  fetchHistory,
  fetchTodayState,
  localDateString,
  markInsightShared,
  markTodayRead,
  saveAdvisorSettings,
  saveTodayInsight,
  setActed,
  updateAdvisorContext,
  type AdvisorCategory,
  type AdvisorFrequency,
  type AdvisorHistoryItem,
  type AdvisorSettings,
  type AdvisorTodayState,
} from '@/lib/advisor/advisorStorage';
import { buildDailySignals } from '@/lib/advisor/buildDailySignals';
import {
  registerForPushNotificationsAsync,
  savePushToken,
} from '@/lib/notificationService';
import { generateAdvisorInsight } from '@/lib/advisor/generateInsight';
import { buildMockAnalysis } from '@/lib/advisor/mockInsights';
import { buildCareHorizon } from '@/lib/advisor/care-horizon';
import { buildCareDayTimeline } from '@/lib/advisor/day-timeline';
import type {
  AdvisorAnalysis,
  AdvisorInsight,
  AdvisorTone,
  AnalysisCard,
  DailySignals,
} from '@/lib/advisor/types';
import { localizeAdvisorAnalysis, localizeStoredAdvisorInsight, translateAdvisor, type AdvisorTranslationKey } from '@/lib/advisor/advisorTranslations';
import { usePlannerDay } from '@/services/planner';

const BRAND_PURPLE = '#5E3DB3';
const BRAND_PURPLE_SOFT = '#8E4EC6';

const TEXT_PRIMARY = '#4A3A33';
const TEXT_SECONDARY = '#7D5A50';
const TEXT_TERTIARY = '#9C8178';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type AdvisorTheme = {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSurface: string;
  divider: string;
  skeleton: string;
  elevatedSurface: string;
  controlSurface: string;
  controlBorder: string;
  switchTrack: string;
};

/** Themen-Chips, optional aus dem Haupt-Hinweis abgeleitet. */
const TOPIC_CHIPS: Record<AnalysisCard['key'], { emoji: string; key: AdvisorTranslationKey }> = {
  sleep: { emoji: '💤', key: 'sleep' },
  feeding: { emoji: '🍼', key: 'feeding' },
  diaper: { emoji: '💧', key: 'diaper' },
  weather: { emoji: '🌤️', key: 'weather' },
};

const chipsForInsight = (id: string, locale: 'de' | 'en' | 'es'): { emoji: string; label: string }[] => {
  const keys: AnalysisCard['key'][] = [];
  if (id.includes('feeding')) keys.push('feeding');
  if (id.includes('sleep')) keys.push('sleep');
  if (
    id.includes('hot') ||
    id.includes('cold') ||
    id.includes('uv') ||
    id.includes('rain')
  ) {
    keys.push('weather');
  }
  if (id === 'all_good') keys.push('sleep', 'feeding');
  // Duplikate raus, max. zwei kompakte Chips.
  return Array.from(new Set(keys)).slice(0, 2).map((k) => ({ emoji: TOPIC_CHIPS[k].emoji, label: translateAdvisor(locale, TOPIC_CHIPS[k].key) }));
};

/** „Heute" / „Gestern" / 24.06. für Verlaufskarten. */
const formatHistoryDate = (localDate: string, locale: 'de' | 'en' | 'es', localeTag: string): string => {
  if (localDate === localDateString()) return translateAdvisor(locale, 'today');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDate === localDateString(yesterday)) return translateAdvisor(locale, 'yesterday');
  const d = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit' });
};

const toneAccent = (tone: AdvisorTone, isDark: boolean): { dot: string; soft: string } => {
  switch (tone) {
    case 'positive':
      return { dot: isDark ? '#8ED6C0' : '#5FAE96', soft: 'rgba(95, 174, 150, 0.16)' };
    case 'gentle':
      return { dot: isDark ? '#F4B488' : '#E0925F', soft: 'rgba(224, 146, 95, 0.16)' };
    default:
      return { dot: isDark ? '#C8B3FF' : BRAND_PURPLE_SOFT, soft: 'rgba(142, 78, 198, 0.16)' };
  }
};

const cardAccent = (key: AnalysisCard['key'], isDark: boolean): { color: string; soft: string } => {
  switch (key) {
    case 'sleep':
      return { color: isDark ? '#B8ADFF' : '#6C5CE0', soft: 'rgba(108, 92, 224, 0.16)' };
    case 'feeding':
      return { color: isDark ? '#F2A7C5' : '#DB6F9C', soft: 'rgba(219, 111, 156, 0.17)' };
    case 'diaper':
      return { color: isDark ? '#83D4C8' : '#3FA294', soft: 'rgba(63, 162, 148, 0.17)' };
    default:
      return { color: isDark ? '#F1B778' : '#D88A3C', soft: 'rgba(216, 138, 60, 0.18)' };
  }
};

/* ----------------------------------------------------------------- *
 *  Skeleton – dezenter Platzhalter, damit nichts „lädt", während die
 *  Kartenstruktur schon steht (gefühlte Performance).
 * ----------------------------------------------------------------- */
function Skeleton({
  width,
  height,
  radius = 8,
  color = 'rgba(74,58,51,0.10)',
  style,
}: {
  width: number | string;
  height: number;
  radius?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const v = React.useState(() => new Animated.Value(0.45))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: color, opacity: v },
        style,
      ]}
    />
  );
}

/* Balken, der sich beim Erscheinen aufbaut. */
function AnimatedBar({
  progress,
  color,
  play,
  trackColor,
}: {
  progress: number;
  color: string;
  play: boolean;
  trackColor: string;
}) {
  const w = React.useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (!play) return;
    const anim = Animated.timing(w, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 850,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [play, progress, w]);

  const width = w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 6, borderRadius: 999, backgroundColor: trackColor, marginTop: 10, overflow: 'hidden' }}>
      <Animated.View style={{ width, height: 6, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

/* Einblendung fade + slide. */
function FadeInUp({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = React.useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function LottisFuersorgeScreen() {
  const router = useRouter();
  const { activeBaby } = useActiveBaby();
  const { locale, localeTag } = useLocale();
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = useMemo<AdvisorTheme>(
    () => ({
      isDark,
      textPrimary: isDark ? adaptiveColors.textPrimary : TEXT_PRIMARY,
      textSecondary: isDark ? adaptiveColors.textSecondary : TEXT_SECONDARY,
      textTertiary: isDark ? adaptiveColors.textTertiary : TEXT_TERTIARY,
      accent: isDark ? '#C8B3FF' : BRAND_PURPLE,
      accentStrong: isDark ? '#A98BFA' : BRAND_PURPLE_SOFT,
      accentSoft: isDark ? 'rgba(200,179,255,0.16)' : 'rgba(94,61,179,0.10)',
      accentSurface: isDark ? 'rgba(142,78,198,0.18)' : 'rgba(142,78,198,0.12)',
      divider: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(74,58,51,0.12)',
      skeleton: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(74,58,51,0.10)',
      elevatedSurface: isDark ? 'rgba(255,255,255,0.10)' : '#FFFFFF',
      controlSurface: isDark ? 'rgba(255,255,255,0.075)' : 'rgba(94,61,179,0.09)',
      controlBorder: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(94,61,179,0.20)',
      switchTrack: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(74,58,51,0.18)',
    }),
    [adaptiveColors, isDark],
  );
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tileProps = useMemo(
    () =>
      isDark
        ? {
            tint: 'dark' as const,
            intensity: 38,
            frostColor: 'rgba(18,15,24,0.78)',
            toneColor: 'rgba(72,51,101,0.16)',
            borderColor: 'rgba(255,255,255,0.17)',
            innerBorderColor: 'rgba(255,255,255,0.07)',
            highlightStrength: 'subtle' as const,
            highlightOpacity: 0.34,
            glossOpacity: 0.09,
            grainOpacity: 0.025,
            shadeOpacity: 0.75,
          }
        : {
            tint: 'light' as const,
            frostColor: 'rgba(255,255,255,0.55)',
            borderColor: 'rgba(255,255,255,0.9)',
            innerBorderColor: 'rgba(255,255,255,0.5)',
            highlightStrength: 'strong' as const,
            highlightOpacity: 1,
            glossOpacity: 0.5,
            grainOpacity: 0.04,
            shadeOpacity: 0.5,
          },
    [isDark],
  );
  const t = (key: AdvisorTranslationKey, params?: Record<string, string | number>) => translateAdvisor(locale, key, params);
  // In Erprobung: nur Premiumtester/Admins (später zusätzlich Premium-Abo).
  const access = useAdvisorAccess();

  const [analysis, setAnalysis] = useState<AdvisorAnalysis | null>(null);
  const [dailySignals, setDailySignals] = useState<DailySignals | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** Echter Verlauf aus Supabase; null = (noch) nicht verfügbar → Mock zeigen. */
  const [history, setHistory] = useState<AdvisorHistoryItem[] | null>(null);
  const [settings, setSettings] = useState<AdvisorSettings | null>(null);
  const [todayState, setTodayState] = useState<AdvisorTodayState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());
  const plannerDateKey = `${clockNow.getFullYear()}-${clockNow.getMonth()}-${clockNow.getDate()}`;
  const plannerDate = useMemo(() => {
    const [year, month, day] = plannerDateKey.split('-').map(Number);
    return new Date(year, month, day, 12, 0, 0, 0);
  }, [plannerDateKey]);
  const todayPlanner = usePlannerDay(plannerDate, { ensureDay: false });

  const runIdRef = useRef(0);
  const ready = !!analysis;

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Weiche Einblendung für das stets sichtbare Copilot-Briefing.
  const heroIn = React.useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (ready) {
      heroIn.setValue(0);
      Animated.timing(heroIn, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [ready, heroIn]);

  const heroAnimStyle = {
    opacity: heroIn,
    transform: [
      {
        translateY: heroIn.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  // --- Datenquelle: Signale -> Edge Function (Regeln + KI),
  //     Fallback auf die lokale Mock-Analyse. ---
  const loadAnalysis = useCallback(async () => {
    const myRun = ++runIdRef.current;
    const alive = () => runIdRef.current === myRun;

    // Kontext (Zeitzone/Standort) für den täglichen Push-Job mitpflegen.
    updateAdvisorContext();

    let signals;
    try {
      signals = await buildDailySignals(activeBaby);
    } catch {
      signals = await buildDailySignals(null);
    }
    setDailySignals(signals);
    let result: AdvisorAnalysis = buildMockAnalysis(signals);
    if (!alive()) return;
    // Lokales Ergebnis sofort zeigen …
    setAnalysis(localizeAdvisorAnalysis(locale, result, signals));

    // … dann Server-Analyse nachziehen (Regel-Engine + KI-Formulierung).
    // Der Server persistiert den Hinweis selbst; klappt es nicht, bleibt
    // der Mock und wir speichern wie bisher clientseitig.
    let persistedByServer = false;
    let messageId: string | null = null;
    const babyId = activeBaby?.id;
    if (babyId) {
      const remote = await generateAdvisorInsight(babyId, signals, locale);
      if (!alive()) return;
      if (remote) {
        result = { ...result, main: remote.main, reasons: remote.reasons };
        persistedByServer = remote.persisted;
        messageId = remote.messageId;
        setAnalysis(localizeAdvisorAnalysis(locale, result, signals));
      }
    }

    // Persistenz: heutigen Hinweis in Supabase ablegen, Verlauf +
    // Einstellungen laden. Fällt still zurück, wenn Tabellen fehlen.
    if (babyId) {
      if (!persistedByServer) messageId = await saveTodayInsight(babyId, result);
      const [dbHistory, dbSettings, dbTodayState] = await Promise.all([
        fetchHistory(babyId),
        fetchAdvisorSettings(),
        fetchTodayState(babyId),
      ]);
      if (!alive()) return;
      setHistory(dbHistory?.map((item) => localizeStoredAdvisorInsight(locale, item)) ?? dbHistory);
      setSettings(dbSettings);
      setTodayState(
        dbTodayState ??
          (messageId
            ? {
                id: messageId,
                actedAt: null,
                remindAt: null,
                reminderNotificationId: null,
                sharedAt: null,
              }
            : null),
      );
      markTodayRead(babyId);
    } else {
      const dbSettings = await fetchAdvisorSettings();
      if (!alive()) return;
      setHistory(null);
      setSettings(dbSettings);
      setTodayState(null);
    }
  }, [activeBaby, locale]);

  useFocusEffect(
    useCallback(() => {
      // Erst laden, wenn der Zugriff bestätigt ist (kein Persistieren
      // von Hinweisen für Nutzer ohne Freischaltung).
      if (access !== true) return;
      loadAnalysis();
      return () => {
        runIdRef.current += 1;
      };
    }, [access, loadAnalysis]),
  );

  /** „Erledigt"-Haken einer Verlaufskarte umschalten (optimistisch). */
  const toggleActed = (item: AdvisorHistoryItem) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    const acted = !item.actedAt;
    setHistory(
      (prev) =>
        prev?.map((h) =>
          h.id === item.id
            ? { ...h, actedAt: acted ? new Date().toISOString() : null }
            : h,
        ) ?? prev,
    );
    setActed(item.id, acted);
  };

  /** Einstellungen optimistisch aktualisieren + speichern. */
  const updateSettings = (next: AdvisorSettings) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSettings(next);
    saveAdvisorSettings(next);
  };

  /**
   * Push-Opt-in: Beim Einschalten System-Berechtigung anfordern und den
   * Expo-Token registrieren; erst wenn beides klappt, wird das Opt-in
   * gespeichert. Ausschalten wirkt sofort (advisor-daily prüft das Flag).
   */
  const [pushBusy, setPushBusy] = useState(false);
  const togglePush = async () => {
    if (!settings || pushBusy) return;
    if (settings.pushEnabled) {
      updateSettings({ ...settings, pushEnabled: false });
      return;
    }
    setPushBusy(true);
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        Alert.alert(
          t('notificationTitle'),
          t('notificationMessage'),
        );
        return;
      }
      await savePushToken(token);
      updateSettings({ ...settings, pushEnabled: true });
    } finally {
      setPushBusy(false);
    }
  };

  const toggleTheme = (theme: AdvisorCategory) => {
    if (!settings) return;
    const active = settings.themes.includes(theme);
    updateSettings({
      ...settings,
      themes: active
        ? settings.themes.filter((t) => t !== theme)
        : [...settings.themes, theme],
    });
  };

  const toggleDetails = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setDetailsOpen((v) => !v);
  };

  const main = analysis?.main;
  const chips = useMemo(() => (main ? chipsForInsight(main.id, locale) : []), [locale, main]);
  const summary = main?.headline ?? main?.title ?? '';
  const whyLine = analysis?.reasons?.[0] ?? '';
  const dayTimeline = useMemo(
    () =>
      dailySignals
        ? buildCareDayTimeline({
            signals: dailySignals,
            plannerBlocks: todayPlanner.blocks,
            now: clockNow,
            locale,
          })
        : [],
    [clockNow, dailySignals, locale, todayPlanner.blocks],
  );
  // Die Übergabe enthält das komplette Briefing: Stand, Prognose, Tageswerte,
  // Lottis Hinweis und den Tagesplan – deshalb bekommt sie die Kartendaten mit.
  const careHorizon = useMemo(
    () =>
      dailySignals
        ? buildCareHorizon(dailySignals, {
            now: clockNow,
            locale,
            briefing: {
              headline: analysis?.main.headline ?? analysis?.main.title ?? null,
              body: analysis?.main.body ?? null,
              reasons: analysis?.reasons ?? null,
              cards: analysis?.cards ?? null,
              timeline: dayTimeline,
            },
          })
        : null,
    [analysis, clockNow, dailySignals, dayTimeline, locale],
  );

  const haptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const shareCareHandoff = async () => {
    if (!careHorizon || actionBusy) return;
    haptic();
    setActionBusy(true);
    try {
      const result = await Share.share({
        title: t('shareTitle'),
        message: careHorizon.handoffMessage,
      });
      if (result.action === Share.sharedAction && todayState?.id) {
        await markInsightShared(todayState.id);
        setTodayState({ ...todayState, sharedAt: new Date().toISOString() });
      }
    } catch {
      Alert.alert(t('shareFailedTitle'), t('shareFailedMessage'));
    } finally {
      setActionBusy(false);
    }
  };

  /* ---- Tagesbriefing-Karte: Struktur steht sofort, Text per Skeleton ---- */
  const renderBriefing = () => (
    <GlassCard {...tileProps} radius={28} style={styles.briefingShadow} contentStyle={styles.briefingContent}>
      {/* Kopfzeile: Titel */}
      <View style={styles.briefingHeader}>
        <View style={styles.briefingTitleRow}>
          <View style={styles.briefingIcon}>
            <IconSymbol name="sparkles" size={15} color={theme.accent} />
          </View>
          <View>
            <ThemedText adaptive={false} style={styles.briefingTitle}>
              {t('briefing')}
            </ThemedText>
            <ThemedText adaptive={false} style={styles.briefingDate}>
              {t('todayByLotti')}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* „Heute entdeckt"-Badge */}
      <View style={styles.discoverBadgeRow}>
        <View style={styles.discoverBadge}>
          <Text style={styles.discoverBadgeText}>{t('discovered')}</Text>
        </View>
      </View>

      {/* Hero-Empfehlung – wichtigster Text, hervorgehoben */}
      {ready ? (
        <Animated.View style={heroAnimStyle}>
          <View style={styles.heroGlow}>
            <ThemedText adaptive={false} style={styles.summaryHero}>
              {summary}
            </ThemedText>
          </View>
          <ThemedText adaptive={false} style={styles.heroReason}>
            {t('combined')}
          </ThemedText>
        </Animated.View>
      ) : (
        <View style={styles.summarySkeleton}>
          <Skeleton width="92%" height={22} color={theme.skeleton} />
          <Skeleton width="64%" height={22} color={theme.skeleton} />
          <Skeleton width="80%" height={13} color={theme.skeleton} style={{ marginTop: 6 }} />
        </View>
      )}

      {/* Optionale Themen-Chips */}
      <View style={styles.chipRow}>
        {ready
          ? chips.map((chip) => (
              <View key={chip.label} style={styles.chip}>
                <Text style={styles.chipEmoji}>{chip.emoji}</Text>
                <Text style={styles.chipLabel}>{chip.label}</Text>
              </View>
            ))
          : (
            <>
              <Skeleton width={84} height={28} radius={999} color={theme.skeleton} />
              <Skeleton width={96} height={28} radius={999} color={theme.skeleton} />
            </>
          )}
      </View>

      <View style={styles.briefingDivider} />

      {/* Warum? */}
      <View style={styles.whyBlock}>
        <ThemedText adaptive={false} style={styles.whyLabel}>
          {t('why')}
        </ThemedText>
        {ready ? (
          <ThemedText adaptive={false} style={styles.whyText}>
            {whyLine}
          </ThemedText>
        ) : (
          <View style={styles.whySkeleton}>
            <Skeleton width="100%" height={13} color={theme.skeleton} />
            <Skeleton width="48%" height={13} color={theme.skeleton} />
          </View>
        )}
      </View>

      {/* Details – ausklappbar */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggleDetails}
        disabled={!ready}
        style={styles.detailsToggle}
      >
        <ThemedText adaptive={false} style={styles.detailsToggleText}>
          {t('details')}
        </ThemedText>
        <IconSymbol
          name={detailsOpen ? 'chevron.up' : 'chevron.down'}
          size={14}
          color={theme.accent}
        />
      </TouchableOpacity>

      {detailsOpen && analysis ? (
        <View style={styles.detailsBody}>
          <ThemedText adaptive={false} style={styles.detailsParagraph}>
            {analysis.main.body}
          </ThemedText>
          <View style={styles.reasonList}>
            {analysis.reasons.map((reason, index) => (
              <View key={index} style={styles.reasonRow}>
                <View style={styles.reasonCheck}>
                  <IconSymbol name="checkmark" size={10} color={theme.accent} />
                </View>
                <ThemedText adaptive={false} style={styles.reasonText}>
                  {reason}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

    </GlassCard>
  );

  const renderCareHorizon = () => (
    <GlassCard {...tileProps} radius={28} style={styles.horizonShadow} contentStyle={styles.horizonContent}>
      {!careHorizon ? (
        <View style={styles.horizonSkeleton}>
          <Skeleton width={128} height={25} radius={999} color={theme.skeleton} />
          <Skeleton width="82%" height={28} radius={8} color={theme.skeleton} />
          <Skeleton width="100%" height={74} radius={16} color={theme.skeleton} />
          <Skeleton width="100%" height={48} radius={999} color={theme.skeleton} />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.horizonBadge,
              careHorizon.roughNight && styles.horizonBadgeNight,
              careHorizon.needsRelief && styles.horizonBadgeRelief,
            ]}
          >
            <Text style={styles.horizonBadgeText}>
              {careHorizon.needsRelief
                ? t('reliefNeeded')
                : careHorizon.roughNight
                  ? t('shortNight')
                  : t('rhythm')}
            </Text>
          </View>

          <ThemedText adaptive={false} style={styles.horizonTitle}>
            {careHorizon.headline}
          </ThemedText>

          <View style={styles.horizonRows}>
            {[
              { emoji: '●', label: t('now'), text: careHorizon.nowText },
              { emoji: '→', label: t('next'), text: careHorizon.nextText },
              { emoji: '○', label: t('yourWindow'), text: careHorizon.windowText },
            ].map((row) => (
              <View key={row.label} style={styles.horizonRow}>
                <View style={styles.horizonRowIcon}>
                  <Text style={styles.horizonRowIconText}>{row.emoji}</Text>
                </View>
                <View style={styles.horizonRowText}>
                  <ThemedText adaptive={false} style={styles.horizonRowLabel}>
                    {row.label}
                  </ThemedText>
                  <ThemedText adaptive={false} style={styles.horizonRowBody}>
                    {row.text}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <ThemedText adaptive={false} style={styles.horizonConfidence}>
            {careHorizon.confidenceText}
          </ThemedText>

          {/* Einzige Aktion der Karte. Den Ton der Nachricht leitet Lotti aus
              den Tagesdaten ab – kein Moduswechsel, keine zweite Schaltfläche. */}
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={actionBusy}
            onPress={shareCareHandoff}
            style={styles.horizonPrimaryWrap}
          >
            <LinearGradient
              colors={
                careHorizon.needsRelief
                  ? ['#A14D74', '#74335B']
                  : isDark
                    ? ['#A98BFA', '#6F4CC3']
                    : [BRAND_PURPLE_SOFT, BRAND_PURPLE]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.horizonPrimary, actionBusy && styles.ctaButtonDisabled]}
            >
              <Text style={styles.horizonPrimaryText}>{careHorizon.handoffLabel}</Text>
              <IconSymbol name="square.and.arrow.up" size={15} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </GlassCard>
  );

  const renderCopilotBriefing = () => (
    <View style={styles.copilotSection}>
      <View style={styles.copilotHeading}>
        <View style={styles.copilotIcon}>
          <Text style={styles.copilotEmoji}>👶</Text>
        </View>
        <View style={styles.copilotHeadingText}>
          <ThemedText adaptive={false} style={styles.copilotTitle}>
            {t('copilot')}
          </ThemedText>
          <ThemedText adaptive={false} style={styles.copilotHint}>
            {t('copilotHint')}
          </ThemedText>
        </View>
      </View>
      {renderBriefing()}
      {renderCards()}
    </View>
  );

  const renderDayTimeline = () => (
    <GlassCard {...tileProps} radius={28} contentStyle={styles.timelineContent}>
      <CareDayTimeline
        items={dayTimeline}
        loading={!dailySignals || todayPlanner.loading}
        colors={{
          textPrimary: theme.textPrimary,
          textSecondary: theme.textSecondary,
          textTertiary: theme.textTertiary,
          accent: theme.accent,
          accentSurface: theme.accentSurface,
          divider: theme.divider,
          skeleton: theme.skeleton,
          warning: isDark ? '#F4B488' : '#A85D2A',
          warningSurface: isDark
            ? 'rgba(244,180,136,0.14)'
            : 'rgba(216,138,60,0.12)',
          isDark,
        }}
        onOpenPlanner={() => router.push('/planner')}
      />
    </GlassCard>
  );

  const renderCards = () => (
    <View style={styles.cardGrid}>
      {(analysis ? analysis.cards : ([0, 1, 2, 3] as const)).map((card, index) => {
        if (typeof card === 'number') {
          return (
            <View key={card} style={styles.miniCardWrap}>
              <GlassCard {...tileProps} radius={22} contentStyle={styles.miniContent}>
                <Skeleton width={38} height={38} radius={13} color={theme.skeleton} />
                <Skeleton width="70%" height={22} radius={8} color={theme.skeleton} style={{ marginTop: 12 }} />
                <Skeleton width="55%" height={14} radius={7} color={theme.skeleton} style={{ marginTop: 6 }} />
                <Skeleton width="100%" height={6} radius={999} color={theme.skeleton} style={{ marginTop: 12 }} />
              </GlassCard>
            </View>
          );
        }
        const accent = cardAccent(card.key, isDark);
        return (
          <FadeInUp key={card.key} delay={120 + index * 70} style={styles.miniCardWrap}>
            <GlassCard {...tileProps} radius={22} contentStyle={styles.miniContent}>
              <View style={styles.miniHeader}>
                <View style={[styles.miniIconChip, { backgroundColor: accent.soft }]}>
                  <Text style={styles.miniEmoji}>{card.emoji}</Text>
                </View>
                {!card.isReal ? (
                  <View style={styles.exampleBadge}>
                    <Text style={styles.exampleBadgeText}>{t('example')}</Text>
                  </View>
                ) : (
                  <View style={[styles.liveDot, { backgroundColor: accent.color }]} />
                )}
              </View>
              <ThemedText
                adaptive={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.miniValue, { color: accent.color }]}
              >
                {card.value}
              </ThemedText>
              <ThemedText adaptive={false} style={styles.miniLabel}>
                {card.label}
              </ThemedText>
              <AnimatedBar
                progress={card.progress}
                color={accent.color}
                play={ready}
                trackColor={theme.divider}
              />
              <ThemedText adaptive={false} numberOfLines={1} style={styles.miniCaption}>
                {card.caption}
              </ThemedText>
            </GlassCard>
          </FadeInUp>
        );
      })}
    </View>
  );

  /** Echter Verlauf aus Supabase – mit Datum und „Erledigt"-Haken. */
  const renderRealHistory = (items: AdvisorHistoryItem[]) => (
    <View style={styles.historySection}>
      <ThemedText style={styles.historyHeading}>{t('previous')}</ThemedText>
      {items.map((item, index) => {
        const accent = toneAccent(item.tone, isDark);
        const acted = !!item.actedAt;
        return (
          <FadeInUp key={item.id} delay={260 + index * 70}>
            <GlassCard {...tileProps} radius={20} contentStyle={styles.historyContent}>
              <View style={[styles.historyEmojiBubble, { backgroundColor: accent.soft }]}>
                <Text style={styles.historyEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.historyTextWrap}>
                <View style={styles.historyTitleRow}>
                  <ThemedText adaptive={false} style={styles.historyCardTitle}>
                    {item.headline || item.title}
                  </ThemedText>
                  <Text style={styles.historyDate}>{formatHistoryDate(item.localDate, locale, localeTag)}</Text>
                </View>
                <ThemedText adaptive={false} style={styles.historyCardBody}>
                  {item.body}
                </ThemedText>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleActed(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.actedToggle, acted && styles.actedToggleOn]}
              >
                <IconSymbol
                  name="checkmark"
                  size={13}
                  color={acted ? '#FFFFFF' : theme.accent}
                />
              </TouchableOpacity>
            </GlassCard>
          </FadeInUp>
        );
      })}
    </View>
  );

  const renderHistory = (history: AdvisorInsight[]) => (
    <View style={styles.historySection}>
      <ThemedText style={styles.historyHeading}>{t('more')}</ThemedText>
      {history.map((item, index) => {
        const accent = toneAccent(item.tone, isDark);
        return (
          <FadeInUp key={item.id} delay={260 + index * 70}>
            <GlassCard {...tileProps} radius={20} contentStyle={styles.historyContent}>
              <View style={[styles.historyEmojiBubble, { backgroundColor: accent.soft }]}>
                <Text style={styles.historyEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.historyTextWrap}>
                <ThemedText adaptive={false} style={styles.historyCardTitle}>
                  {item.title}
                </ThemedText>
                <ThemedText adaptive={false} style={styles.historyCardBody}>
                  {item.body}
                </ThemedText>
              </View>
            </GlassCard>
          </FadeInUp>
        );
      })}
    </View>
  );

  /** Einstellungen: Themen an/aus + Frequenz (persistiert in Supabase). */
  const renderSettings = () => {
    if (!settings) return null;
    return (
      <View style={styles.settingsSection}>
        <ThemedText style={styles.historyHeading}>{t('settings')}</ThemedText>
        <GlassCard {...tileProps} radius={22} contentStyle={styles.settingsContent}>
          <ThemedText adaptive={false} style={styles.settingsGroupLabel}>
            {t('topics')}
          </ThemedText>
          {([
            { key: 'weather', emoji: '🌤️', label: t('weather') },
            { key: 'sleep', emoji: '💤', label: t('sleep') },
            { key: 'feeding', emoji: '🍼', label: t('feeding') },
            { key: 'motivation', emoji: '🌿', label: t('motivation') },
          ] as { key: AdvisorCategory; emoji: string; label: string }[]).map((option, index) => (
            <View
              key={option.key}
              style={[styles.settingsRow, index > 0 && styles.settingsRowBorder]}
            >
              <Text style={styles.settingsEmoji}>{option.emoji}</Text>
              <ThemedText adaptive={false} style={styles.settingsLabel}>
                {option.label}
              </ThemedText>
              <Switch
                value={settings.themes.includes(option.key)}
                onValueChange={() => toggleTheme(option.key)}
                trackColor={{ false: theme.switchTrack, true: theme.accentStrong }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}

          <ThemedText
            adaptive={false}
            style={[styles.settingsGroupLabel, styles.settingsGroupSpacing]}
          >
            {t('notifications')}
          </ThemedText>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsEmoji}>🔔</Text>
            <View style={styles.settingsLabelColumn}>
              <ThemedText adaptive={false} style={styles.settingsLabel}>
                {t('push')}
              </ThemedText>
              <ThemedText adaptive={false} style={styles.settingsHint}>
                {t('pushHint', { start: settings.quietHoursStart, end: settings.quietHoursEnd })}
              </ThemedText>
            </View>
            <Switch
              value={settings.pushEnabled}
              disabled={pushBusy}
              onValueChange={togglePush}
              trackColor={{ false: theme.switchTrack, true: theme.accentStrong }}
              thumbColor="#FFFFFF"
            />
          </View>

          <ThemedText
            adaptive={false}
            style={[styles.settingsGroupLabel, styles.settingsGroupSpacing]}
          >
            {t('frequency')}
          </ThemedText>
          <View style={styles.frequencyRow}>
            {([
              { key: 'daily', label: t('daily') },
              { key: 'critical_only', label: t('importantOnly') },
              { key: 'off', label: t('off') },
            ] as { key: AdvisorFrequency; label: string }[]).map((option) => {
              const active = settings.frequency === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.8}
                  onPress={() => updateSettings({ ...settings, frequency: option.key })}
                  style={[styles.frequencyChip, active && styles.frequencyChipActive]}
                >
                  <Text
                    style={[
                      styles.frequencyChipText,
                      active && styles.frequencyChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Datenschutz-Hinweis: was Lottis Fürsorge wohin überträgt. */}
          <View style={styles.privacyBlock}>
            <ThemedText adaptive={false} style={styles.privacyTitle}>
              {t('privacyTitle')}
            </ThemedText>
            <ThemedText adaptive={false} style={styles.privacyText}>
              {t('privacyText')}
            </ThemedText>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/datenschutz')}
              style={styles.privacyLink}
            >
              <ThemedText adaptive={false} style={styles.privacyLinkText}>
                {t('privacyLink')}
              </ThemedText>
              <IconSymbol name="chevron.right" size={12} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    );
  };

  // Zugriffs-Gate: solange geprüft wird nur Hintergrund, ohne Freischaltung
  // ein kurzer Hinweis (z. B. bei Deep-Links).
  if (access !== true) {
    return (
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <Header
            title={t('title')}
            subtitle={t('subtitle')}
            showBackButton
            showBabySwitcher={false}
          />
          {access === false ? (
            <View style={styles.gateWrap}>
              <GlassCard {...tileProps} radius={22} contentStyle={styles.gateContent}>
                <Text style={styles.gateEmoji}>🔒</Text>
                <ThemedText adaptive={false} style={styles.gateTitle}>
                  {t('locked')}
                </ThemedText>
                <ThemedText adaptive={false} style={styles.gateText}>
                  {t('lockedText')}
                </ThemedText>
              </GlassCard>
            </View>
          ) : null}
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={t('title')}
          subtitle={t('subtitle')}
          showBackButton
          showBabySwitcher={false}
        />

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCareHorizon()}
          {renderDayTimeline()}
          {renderCopilotBriefing()}
          <CareAnalyticsSection babyId={activeBaby?.id} />
          {history && history.length > 0
            ? renderRealHistory(history)
            : analysis && analysis.history.length > 0
              ? renderHistory(analysis.history)
              : null}
          {renderSettings()}

          <View style={styles.disclaimerWrap}>
            <IconSymbol name="info.circle" size={14} color={theme.textTertiary} />
            <ThemedText style={styles.disclaimerText}>
              {t('disclaimer')}
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>

    </ThemedBackground>
  );
}

const createStyles = (theme: AdvisorTheme) => StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 52,
    gap: 18,
  },

  /* Tagesbriefing */
  briefingShadow: {
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 10,
  },
  briefingContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  briefingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  briefingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  briefingIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: theme.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefingTitle: { fontSize: 17, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.2 },
  briefingDate: { fontSize: 11.5, fontWeight: '600', color: theme.textTertiary, marginTop: 1 },

  summarySkeleton: { gap: 8, marginTop: 18, marginBottom: 2 },

  /* Hero-Empfehlung */
  discoverBadgeRow: { flexDirection: 'row', marginTop: 16 },
  discoverBadge: {
    backgroundColor: theme.accentSurface,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  discoverBadgeText: { fontSize: 12, fontWeight: '800', color: theme.accent, letterSpacing: 0.2 },
  heroGlow: {
    marginTop: 10,
    alignSelf: 'flex-start',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  summaryHero: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.4,
  },
  heroReason: { fontSize: 13.5, lineHeight: 19, color: theme.textSecondary, marginTop: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accentSurface,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 12.5, fontWeight: '700', color: theme.accent },

  briefingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.divider,
    marginTop: 16,
  },

  whyBlock: { marginTop: 14 },
  whyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  whyText: { fontSize: 13.5, lineHeight: 19, color: theme.textSecondary },
  whySkeleton: { gap: 7, marginTop: 2 },

  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 2,
  },
  detailsToggleText: { fontSize: 13.5, fontWeight: '700', color: theme.accent },
  detailsBody: { marginTop: 12, gap: 12 },
  detailsParagraph: { fontSize: 13.5, lineHeight: 20, color: theme.textSecondary },
  reasonList: { gap: 10 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reasonCheck: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  reasonText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.textSecondary },

  ctaWrap: { marginTop: 18 },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaButtonDisabled: { opacity: 0.55 },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryActionRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  secondaryAction: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.controlSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.controlBorder,
  },
  secondaryActionEmoji: { fontSize: 14 },
  secondaryActionText: { fontSize: 12.5, fontWeight: '700', color: theme.accent },
  reminderPanel: {
    gap: 9,
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: theme.controlSurface,
  },
  reminderLabel: { fontSize: 12.5, fontWeight: '700', color: theme.textSecondary },
  reminderChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reminderChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.elevatedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.controlBorder,
  },
  reminderChipText: { fontSize: 12.5, fontWeight: '700', color: theme.accent },
  reminderScheduledText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  /* Jetzt – Als Nächstes – Dein Fenster */
  horizonShadow: {
    boxShadow: theme.isDark
      ? '0 10px 30px rgba(0, 0, 0, 0.34)'
      : '0 10px 30px rgba(94, 61, 179, 0.13)',
  },
  horizonContent: { padding: 20, gap: 14 },
  horizonSkeleton: { gap: 13 },
  horizonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.accentSoft,
  },
  horizonBadgeNight: {
    backgroundColor: theme.isDark ? 'rgba(151,141,224,0.22)' : 'rgba(83,73,145,0.13)',
  },
  horizonBadgeRelief: {
    backgroundColor: theme.isDark ? 'rgba(226,140,180,0.20)' : 'rgba(161,77,116,0.13)',
  },
  horizonBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 0.15,
  },
  horizonTitle: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.45,
  },
  horizonRows: { gap: 4 },
  horizonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  horizonRowIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: theme.controlSurface,
  },
  horizonRowIconText: { fontSize: 14, fontWeight: '800', color: theme.accent },
  horizonRowText: { flex: 1, gap: 3 },
  horizonRowLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  horizonRowBody: { fontSize: 14, lineHeight: 20, color: theme.textPrimary },
  horizonConfidence: { fontSize: 11.5, lineHeight: 16, color: theme.textTertiary },
  horizonPrimaryWrap: { paddingTop: 2 },
  horizonPrimary: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
  },
  horizonPrimaryText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800' },
  timelineContent: { padding: 20 },

  /* Sichtbarer Eltern-Copilot: Orientierung und Tagesbriefing gehören zusammen. */
  copilotSection: { gap: 14 },
  copilotHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  copilotIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: theme.accentSoft,
  },
  copilotEmoji: { fontSize: 21 },
  copilotHeadingText: { flex: 1, gap: 2 },
  copilotTitle: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  copilotHint: { fontSize: 12.5, lineHeight: 17, color: theme.textTertiary },

  /* Mini cards */
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  miniCardWrap: { width: '48.5%' },
  miniContent: { padding: 16 },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  miniIconChip: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniEmoji: { fontSize: 20 },
  liveDot: { width: 8, height: 8, borderRadius: 5 },
  exampleBadge: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  exampleBadgeText: { fontSize: 10, fontWeight: '700', color: theme.accent },
  miniValue: { fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  miniLabel: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary, marginTop: 3 },
  miniCaption: { fontSize: 11.5, lineHeight: 15, color: theme.textTertiary, marginTop: 8 },

  /* History */
  historySection: { gap: 14 },
  historyHeading: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  historyContent: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15 },
  historyEmojiBubble: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyEmoji: { fontSize: 22 },
  historyTextWrap: { flex: 1 },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyCardTitle: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary, flexShrink: 1 },
  historyDate: { fontSize: 11.5, fontWeight: '600', color: theme.textTertiary },
  historyCardBody: { fontSize: 13, lineHeight: 18, color: theme.textSecondary, marginTop: 2 },
  actedToggle: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actedToggleOn: {
    backgroundColor: theme.accentStrong,
    borderColor: theme.accentStrong,
  },

  /* Einstellungen */
  settingsSection: { gap: 14 },
  settingsContent: { paddingHorizontal: 18, paddingVertical: 14 },
  settingsGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  settingsGroupSpacing: { marginTop: 16 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  settingsRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
  },
  settingsEmoji: { fontSize: 17 },
  settingsLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', color: theme.textPrimary },
  settingsLabelColumn: { flex: 1, gap: 2 },
  settingsHint: { fontSize: 11.5, lineHeight: 15, color: theme.textTertiary },
  frequencyRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  frequencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.accentSoft,
  },
  frequencyChipActive: { backgroundColor: theme.accentStrong },
  frequencyChipText: { fontSize: 13, fontWeight: '700', color: theme.accent },
  frequencyChipTextActive: { color: theme.isDark ? '#211A2B' : '#FFFFFF' },

  /* Datenschutz-Hinweis in den Einstellungen */
  privacyBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    gap: 6,
  },
  privacyTitle: { fontSize: 12.5, fontWeight: '800', color: theme.textPrimary },
  privacyText: { fontSize: 12, lineHeight: 17, color: theme.textSecondary },
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  privacyLinkText: { fontSize: 12.5, fontWeight: '700', color: theme.accent },

  /* Zugriffs-Gate */
  gateWrap: { paddingHorizontal: 20, paddingTop: 24 },
  gateContent: { alignItems: 'center', padding: 24, gap: 8 },
  gateEmoji: { fontSize: 34 },
  gateTitle: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  gateText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  /* Disclaimer */
  disclaimerWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 17, opacity: 0.85 },
});
