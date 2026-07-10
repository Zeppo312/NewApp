import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  SafeAreaView,
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

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GlassCard } from '@/components/ui/GlassCard';
import { MagicBriefingIntroOverlay } from '@/components/MagicBriefingIntroOverlay';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAdvisorAccess } from '@/lib/advisor/access';
import {
  fetchAdvisorSettings,
  fetchHistory,
  localDateString,
  markTodayRead,
  saveAdvisorSettings,
  saveTodayInsight,
  setActed,
  updateAdvisorContext,
  type AdvisorCategory,
  type AdvisorFrequency,
  type AdvisorHistoryItem,
  type AdvisorSettings,
} from '@/lib/advisor/advisorStorage';
import { buildDailySignals } from '@/lib/advisor/buildDailySignals';
import {
  registerForPushNotificationsAsync,
  savePushToken,
} from '@/lib/notificationService';
import { generateAdvisorInsight } from '@/lib/advisor/generateInsight';
import { buildMockAnalysis } from '@/lib/advisor/mockInsights';
import type {
  AdvisorAnalysis,
  AdvisorInsight,
  AdvisorTone,
  AnalysisCard,
} from '@/lib/advisor/types';

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

const TILE_PROPS = {
  frostColor: 'rgba(255,255,255,0.55)',
  borderColor: 'rgba(255,255,255,0.9)',
  innerBorderColor: 'rgba(255,255,255,0.5)',
  highlightStrength: 'strong' as const,
  glossOpacity: 0.5,
  grainOpacity: 0.04,
  shadeOpacity: 0.5,
};

/** Themen-Chips, optional aus dem Haupt-Hinweis abgeleitet. */
const TOPIC_CHIPS: Record<AnalysisCard['key'], { emoji: string; label: string }> = {
  sleep: { emoji: '💤', label: 'Schlaf' },
  feeding: { emoji: '🍼', label: 'Ernährung' },
  diaper: { emoji: '💧', label: 'Windeln' },
  weather: { emoji: '🌤️', label: 'Wetter' },
};

const chipsForInsight = (id: string): { emoji: string; label: string }[] => {
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
  return Array.from(new Set(keys)).slice(0, 2).map((k) => TOPIC_CHIPS[k]);
};

const THEME_OPTIONS: { key: AdvisorCategory; emoji: string; label: string }[] = [
  { key: 'weather', emoji: '🌤️', label: 'Wetter' },
  { key: 'sleep', emoji: '💤', label: 'Schlaf' },
  { key: 'feeding', emoji: '🍼', label: 'Ernährung' },
  { key: 'motivation', emoji: '🌿', label: 'Motivation' },
];

const FREQUENCY_OPTIONS: { key: AdvisorFrequency; label: string }[] = [
  { key: 'daily', label: 'Täglich' },
  { key: 'critical_only', label: 'Nur Wichtiges' },
  { key: 'off', label: 'Aus' },
];

/** „Heute" / „Gestern" / 24.06. für Verlaufskarten. */
const formatHistoryDate = (localDate: string): string => {
  if (localDate === localDateString()) return 'Heute';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDate === localDateString(yesterday)) return 'Gestern';
  const d = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
};

const toneAccent = (tone: AdvisorTone): { dot: string; soft: string } => {
  switch (tone) {
    case 'positive':
      return { dot: '#5FAE96', soft: 'rgba(95, 174, 150, 0.16)' };
    case 'gentle':
      return { dot: '#E0925F', soft: 'rgba(224, 146, 95, 0.16)' };
    default:
      return { dot: BRAND_PURPLE_SOFT, soft: 'rgba(142, 78, 198, 0.13)' };
  }
};

const cardAccent = (key: AnalysisCard['key']): { color: string; soft: string } => {
  switch (key) {
    case 'sleep':
      return { color: '#6C5CE0', soft: 'rgba(108, 92, 224, 0.14)' };
    case 'feeding':
      return { color: '#DB6F9C', soft: 'rgba(219, 111, 156, 0.15)' };
    case 'diaper':
      return { color: '#3FA294', soft: 'rgba(63, 162, 148, 0.15)' };
    default:
      return { color: '#D88A3C', soft: 'rgba(216, 138, 60, 0.16)' };
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
  style,
}: {
  width: number | string;
  height: number;
  radius?: number;
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
        { width: width as any, height, borderRadius: radius, backgroundColor: 'rgba(74,58,51,0.10)', opacity: v },
        style,
      ]}
    />
  );
}

/* Balken, der sich beim Erscheinen aufbaut. */
function AnimatedBar({ progress, color, play }: { progress: number; color: string; play: boolean }) {
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
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { width, backgroundColor: color }]} />
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
  // In Erprobung: nur Premiumtester/Admins (später zusätzlich Premium-Abo).
  const access = useAdvisorAccess();

  const [analysis, setAnalysis] = useState<AdvisorAnalysis | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  /** Echter Verlauf aus Supabase; null = (noch) nicht verfügbar → Mock zeigen. */
  const [history, setHistory] = useState<AdvisorHistoryItem[] | null>(null);
  const [settings, setSettings] = useState<AdvisorSettings | null>(null);

  const runIdRef = useRef(0);
  const ready = !!analysis;

  // Weiche Hero-Einblendung, sobald Intro vorbei und Daten da sind.
  const heroIn = React.useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (ready && !showIntro) {
      Animated.timing(heroIn, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [ready, showIntro, heroIn]);

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

  const handleIntroFinish = useCallback(() => {
    setShowIntro(false);
  }, []);

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
    let result: AdvisorAnalysis = buildMockAnalysis(signals);
    if (!alive()) return;
    // Lokales Ergebnis sofort zeigen …
    setAnalysis(result);

    // … dann Server-Analyse nachziehen (Regel-Engine + KI-Formulierung).
    // Der Server persistiert den Hinweis selbst; klappt es nicht, bleibt
    // der Mock und wir speichern wie bisher clientseitig.
    let persistedByServer = false;
    const babyId = activeBaby?.id;
    if (babyId) {
      const remote = await generateAdvisorInsight(babyId, signals);
      if (!alive()) return;
      if (remote) {
        result = { ...result, main: remote.main, reasons: remote.reasons };
        persistedByServer = remote.persisted;
        setAnalysis(result);
      }
    }

    // Persistenz: heutigen Hinweis in Supabase ablegen, Verlauf +
    // Einstellungen laden. Fällt still zurück, wenn Tabellen fehlen.
    if (babyId) {
      if (!persistedByServer) await saveTodayInsight(babyId, result);
      const [dbHistory, dbSettings] = await Promise.all([
        fetchHistory(babyId),
        fetchAdvisorSettings(),
      ]);
      if (!alive()) return;
      setHistory(dbHistory);
      setSettings(dbSettings);
      markTodayRead(babyId);
    } else {
      const dbSettings = await fetchAdvisorSettings();
      if (!alive()) return;
      setHistory(null);
      setSettings(dbSettings);
    }
  }, [activeBaby]);

  useFocusEffect(
    useCallback(() => {
      // Erst laden, wenn der Zugriff bestätigt ist (kein Persistieren
      // von Hinweisen für Nutzer ohne Freischaltung).
      if (access !== true) return;
      loadAnalysis();
      // Magic-Intro bei jedem Öffnen abspielen.
      heroIn.setValue(0);
      setShowIntro(true);
      return () => {
        runIdRef.current += 1;
      };
    }, [access, loadAnalysis, heroIn]),
  );

  const handleCta = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push('/(tabs)/daily_old');
  };

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
          'Mitteilungen nicht möglich',
          'Bitte erlaube Lotti Benachrichtigungen in den Systemeinstellungen. Ohne Erlaubnis kann Lotti dir keine Tageshinweise schicken.',
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
  const chips = useMemo(() => (main ? chipsForInsight(main.id) : []), [main]);
  const summary = main?.headline ?? main?.title ?? '';
  const whyLine = analysis?.reasons?.[0] ?? '';

  /* ---- Tagesbriefing-Karte: Struktur steht sofort, Text per Skeleton ---- */
  const renderBriefing = () => (
    <GlassCard {...TILE_PROPS} radius={28} style={styles.briefingShadow} contentStyle={styles.briefingContent}>
      {/* Kopfzeile: Titel */}
      <View style={styles.briefingHeader}>
        <View style={styles.briefingTitleRow}>
          <View style={styles.briefingIcon}>
            <IconSymbol name="sparkles" size={15} color={BRAND_PURPLE} />
          </View>
          <View>
            <ThemedText adaptive={false} style={styles.briefingTitle}>
              Tagesbriefing
            </ThemedText>
            <ThemedText adaptive={false} style={styles.briefingDate}>
              Heute · von Lotti
            </ThemedText>
          </View>
        </View>
      </View>

      {/* „Heute entdeckt"-Badge */}
      <View style={styles.discoverBadgeRow}>
        <View style={styles.discoverBadge}>
          <Text style={styles.discoverBadgeText}>✨ Heute entdeckt</Text>
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
            Lotti hat Schlaf, Ernährung und Wetter zusammengeführt.
          </ThemedText>
        </Animated.View>
      ) : (
        <View style={styles.summarySkeleton}>
          <Skeleton width="92%" height={22} />
          <Skeleton width="64%" height={22} />
          <Skeleton width="80%" height={13} style={{ marginTop: 6 }} />
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
              <Skeleton width={84} height={28} radius={999} />
              <Skeleton width={96} height={28} radius={999} />
            </>
          )}
      </View>

      <View style={styles.briefingDivider} />

      {/* Warum? */}
      <View style={styles.whyBlock}>
        <ThemedText adaptive={false} style={styles.whyLabel}>
          Warum?
        </ThemedText>
        {ready ? (
          <ThemedText adaptive={false} style={styles.whyText}>
            {whyLine}
          </ThemedText>
        ) : (
          <View style={styles.whySkeleton}>
            <Skeleton width="100%" height={13} />
            <Skeleton width="48%" height={13} />
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
          Details
        </ThemedText>
        <IconSymbol
          name={detailsOpen ? 'chevron.up' : 'chevron.down'}
          size={14}
          color={BRAND_PURPLE}
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
                  <IconSymbol name="checkmark" size={10} color={BRAND_PURPLE} />
                </View>
                <ThemedText adaptive={false} style={styles.reasonText}>
                  {reason}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* CTA – Navigation unverändert */}
      <TouchableOpacity activeOpacity={0.9} onPress={handleCta} style={styles.ctaWrap} disabled={!ready}>
        <LinearGradient
          colors={[BRAND_PURPLE_SOFT, BRAND_PURPLE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ctaButton, !ready && styles.ctaButtonDisabled]}
        >
          <Text style={styles.ctaText}>Analyse ansehen</Text>
          <IconSymbol name="chevron.right" size={15} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </GlassCard>
  );

  const renderCards = () => (
    <View style={styles.cardGrid}>
      {(analysis ? analysis.cards : ([0, 1, 2, 3] as const)).map((card, index) => {
        if (typeof card === 'number') {
          return (
            <View key={card} style={styles.miniCardWrap}>
              <GlassCard {...TILE_PROPS} radius={22} contentStyle={styles.miniContent}>
                <Skeleton width={38} height={38} radius={13} />
                <Skeleton width="70%" height={22} radius={8} style={{ marginTop: 12 }} />
                <Skeleton width="55%" height={14} radius={7} style={{ marginTop: 6 }} />
                <Skeleton width="100%" height={6} radius={999} style={{ marginTop: 12 }} />
              </GlassCard>
            </View>
          );
        }
        const accent = cardAccent(card.key);
        return (
          <FadeInUp key={card.key} delay={120 + index * 70} style={styles.miniCardWrap}>
            <GlassCard {...TILE_PROPS} radius={22} contentStyle={styles.miniContent}>
              <View style={styles.miniHeader}>
                <View style={[styles.miniIconChip, { backgroundColor: accent.soft }]}>
                  <Text style={styles.miniEmoji}>{card.emoji}</Text>
                </View>
                {!card.isReal ? (
                  <View style={styles.exampleBadge}>
                    <Text style={styles.exampleBadgeText}>Beispiel</Text>
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
              <AnimatedBar progress={card.progress} color={accent.color} play={ready} />
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
      <ThemedText style={styles.historyHeading}>Frühere Hinweise</ThemedText>
      {items.map((item, index) => {
        const accent = toneAccent(item.tone);
        const acted = !!item.actedAt;
        return (
          <FadeInUp key={item.id} delay={260 + index * 70}>
            <GlassCard {...TILE_PROPS} radius={20} contentStyle={styles.historyContent}>
              <View style={[styles.historyEmojiBubble, { backgroundColor: accent.soft }]}>
                <Text style={styles.historyEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.historyTextWrap}>
                <View style={styles.historyTitleRow}>
                  <ThemedText adaptive={false} style={styles.historyCardTitle}>
                    {item.headline || item.title}
                  </ThemedText>
                  <Text style={styles.historyDate}>{formatHistoryDate(item.localDate)}</Text>
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
                  color={acted ? '#FFFFFF' : BRAND_PURPLE}
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
      <ThemedText style={styles.historyHeading}>Weitere Hinweise</ThemedText>
      {history.map((item, index) => {
        const accent = toneAccent(item.tone);
        return (
          <FadeInUp key={item.id} delay={260 + index * 70}>
            <GlassCard {...TILE_PROPS} radius={20} contentStyle={styles.historyContent}>
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
        <ThemedText style={styles.historyHeading}>Einstellungen</ThemedText>
        <GlassCard {...TILE_PROPS} radius={22} contentStyle={styles.settingsContent}>
          <ThemedText adaptive={false} style={styles.settingsGroupLabel}>
            Themen
          </ThemedText>
          {THEME_OPTIONS.map((option, index) => (
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
                trackColor={{ false: 'rgba(74,58,51,0.18)', true: BRAND_PURPLE_SOFT }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}

          <ThemedText
            adaptive={false}
            style={[styles.settingsGroupLabel, styles.settingsGroupSpacing]}
          >
            Mitteilungen
          </ThemedText>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsEmoji}>🔔</Text>
            <View style={styles.settingsLabelColumn}>
              <ThemedText adaptive={false} style={styles.settingsLabel}>
                Push für wichtige Hinweise
              </ThemedText>
              <ThemedText adaptive={false} style={styles.settingsHint}>
                Max. 1 Nachricht am Tag, morgens gegen 8 Uhr – nie in deinen
                stillen Zeiten ({settings.quietHoursStart}–{settings.quietHoursEnd} Uhr).
              </ThemedText>
            </View>
            <Switch
              value={settings.pushEnabled}
              disabled={pushBusy}
              onValueChange={togglePush}
              trackColor={{ false: 'rgba(74,58,51,0.18)', true: BRAND_PURPLE_SOFT }}
              thumbColor="#FFFFFF"
            />
          </View>

          <ThemedText
            adaptive={false}
            style={[styles.settingsGroupLabel, styles.settingsGroupSpacing]}
          >
            Häufigkeit
          </ThemedText>
          <View style={styles.frequencyRow}>
            {FREQUENCY_OPTIONS.map((option) => {
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
              🛡️ Deine Daten
            </ThemedText>
            <ThemedText adaptive={false} style={styles.privacyText}>
              Für den Wetterteil wird dein ungefährer Standort (auf ca. 1 km
              gerundet) gespeichert und an den Wetterdienst Open-Meteo
              übertragen – nie deine genaue Position. Für die persönliche
              Formulierung gehen die Tageswerte (Schlaf, Mahlzeiten, Windeln,
              Wetter) sowie Vorname und Alter deines Babys an einen
              KI-Dienst. Alles lässt sich hier jederzeit abschalten.
            </ThemedText>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/datenschutz')}
              style={styles.privacyLink}
            >
              <ThemedText adaptive={false} style={styles.privacyLinkText}>
                Mehr in der Datenschutzerklärung
              </ThemedText>
              <IconSymbol name="chevron.right" size={12} color={BRAND_PURPLE} />
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
          <StatusBar barStyle="dark-content" />
          <Header
            title="Lottis Fürsorge"
            subtitle="Dein tägliches Briefing"
            showBackButton
            showBabySwitcher={false}
          />
          {access === false ? (
            <View style={styles.gateWrap}>
              <GlassCard {...TILE_PROPS} radius={22} contentStyle={styles.gateContent}>
                <Text style={styles.gateEmoji}>🔒</Text>
                <ThemedText adaptive={false} style={styles.gateTitle}>
                  Noch nicht freigeschaltet
                </ThemedText>
                <ThemedText adaptive={false} style={styles.gateText}>
                  Lottis Fürsorge ist aktuell in Erprobung und nur für
                  Premiumtester verfügbar. Bald öffnen wir das Feature für
                  Premium-Mitglieder.
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
        <StatusBar barStyle="dark-content" />
        <Header
          title="Lottis Fürsorge"
          subtitle="Dein tägliches Briefing"
          showBackButton
          showBabySwitcher={false}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderBriefing()}
          {renderCards()}
          {history && history.length > 0
            ? renderRealHistory(history)
            : analysis && analysis.history.length > 0
              ? renderHistory(analysis.history)
              : null}
          {renderSettings()}

          <View style={styles.disclaimerWrap}>
            <IconSymbol name="info.circle" size={14} color={TEXT_TERTIARY} />
            <ThemedText style={styles.disclaimerText}>
              Lottis Hinweise sind allgemeine Alltagstipps und ersetzen keinen
              medizinischen Rat, keine Diagnose und keine Behandlung. Bei
              Fieber, Trinkverweigerung, Teilnahmslosigkeit oder wenn du dir
              unsicher bist: wende dich an deine Hebamme, Kinderarztpraxis
              oder den ärztlichen Bereitschaftsdienst (116 117), im Notfall an
              den Notruf 112.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Premium-Intro: liegt fullscreen über dem Screen, blendet sich am
          Ende selbst aus und gibt dann die Empfehlungskarte frei. */}
      {showIntro ? <MagicBriefingIntroOverlay onFinish={handleIntroFinish} /> : null}
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: BRAND_PURPLE,
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
    backgroundColor: 'rgba(142,78,198,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefingTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.2 },
  briefingDate: { fontSize: 11.5, fontWeight: '600', color: TEXT_TERTIARY, marginTop: 1 },

  summarySkeleton: { gap: 8, marginTop: 18, marginBottom: 2 },

  /* Hero-Empfehlung */
  discoverBadgeRow: { flexDirection: 'row', marginTop: 16 },
  discoverBadge: {
    backgroundColor: 'rgba(142,78,198,0.12)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  discoverBadgeText: { fontSize: 12, fontWeight: '800', color: BRAND_PURPLE, letterSpacing: 0.2 },
  heroGlow: {
    marginTop: 10,
    alignSelf: 'flex-start',
    shadowColor: BRAND_PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  summaryHero: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
  },
  heroReason: { fontSize: 13.5, lineHeight: 19, color: TEXT_SECONDARY, marginTop: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(142,78,198,0.10)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 12.5, fontWeight: '700', color: BRAND_PURPLE },

  briefingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(74,58,51,0.12)',
    marginTop: 16,
  },

  whyBlock: { marginTop: 14 },
  whyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_PURPLE,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  whyText: { fontSize: 13.5, lineHeight: 19, color: TEXT_SECONDARY },
  whySkeleton: { gap: 7, marginTop: 2 },

  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 2,
  },
  detailsToggleText: { fontSize: 13.5, fontWeight: '700', color: BRAND_PURPLE },
  detailsBody: { marginTop: 12, gap: 12 },
  detailsParagraph: { fontSize: 13.5, lineHeight: 20, color: TEXT_SECONDARY },
  reasonList: { gap: 10 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reasonCheck: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: 'rgba(94,61,179,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  reasonText: { flex: 1, fontSize: 13, lineHeight: 18, color: TEXT_SECONDARY },

  ctaWrap: { marginTop: 18 },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    shadowColor: BRAND_PURPLE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaButtonDisabled: { opacity: 0.55 },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

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
    backgroundColor: 'rgba(94,61,179,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  exampleBadgeText: { fontSize: 10, fontWeight: '700', color: BRAND_PURPLE },
  miniValue: { fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  miniLabel: { fontSize: 14.5, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 3 },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(74,58,51,0.12)',
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 999 },
  miniCaption: { fontSize: 11.5, lineHeight: 15, color: TEXT_TERTIARY, marginTop: 8 },

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
  historyCardTitle: { fontSize: 14.5, fontWeight: '700', color: TEXT_PRIMARY, flexShrink: 1 },
  historyDate: { fontSize: 11.5, fontWeight: '600', color: TEXT_TERTIARY },
  historyCardBody: { fontSize: 13, lineHeight: 18, color: TEXT_SECONDARY, marginTop: 2 },
  actedToggle: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: 'rgba(94,61,179,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actedToggleOn: {
    backgroundColor: BRAND_PURPLE,
    borderColor: BRAND_PURPLE,
  },

  /* Einstellungen */
  settingsSection: { gap: 14 },
  settingsContent: { paddingHorizontal: 18, paddingVertical: 14 },
  settingsGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_PURPLE,
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
    borderTopColor: 'rgba(74,58,51,0.12)',
  },
  settingsEmoji: { fontSize: 17 },
  settingsLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', color: TEXT_PRIMARY },
  settingsLabelColumn: { flex: 1, gap: 2 },
  settingsHint: { fontSize: 11.5, lineHeight: 15, color: TEXT_TERTIARY },
  frequencyRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  frequencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(94,61,179,0.10)',
  },
  frequencyChipActive: { backgroundColor: BRAND_PURPLE },
  frequencyChipText: { fontSize: 13, fontWeight: '700', color: BRAND_PURPLE },
  frequencyChipTextActive: { color: '#FFFFFF' },

  /* Datenschutz-Hinweis in den Einstellungen */
  privacyBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(74,58,51,0.12)',
    gap: 6,
  },
  privacyTitle: { fontSize: 12.5, fontWeight: '800', color: TEXT_PRIMARY },
  privacyText: { fontSize: 12, lineHeight: 17, color: TEXT_SECONDARY },
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  privacyLinkText: { fontSize: 12.5, fontWeight: '700', color: BRAND_PURPLE },

  /* Zugriffs-Gate */
  gateWrap: { paddingHorizontal: 20, paddingTop: 24 },
  gateContent: { alignItems: 'center', padding: 24, gap: 8 },
  gateEmoji: { fontSize: 34 },
  gateTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  gateText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },

  /* Disclaimer */
  disclaimerWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 17, opacity: 0.85 },
});
