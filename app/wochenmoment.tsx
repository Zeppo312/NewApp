/**
 * Wochenmoment — sanfter Wochenrückblick + Lotti-Reise.
 *
 * Aufbau:
 *   1) „Eure Woche" — Mo–So mit Herz-Status pro Tag + kleine Stats
 *   2) Bereichs-Tiles (Essen / Pflege / Schlaf der Woche)
 *   3) Lotti-Sammlung — kompakte Vorschau, ausklappbar
 *   4) Lotti-Reise — aktuelle Stufe als Reise-Moment
 *   5) Abschlusssatz
 *
 * Ton bleibt soft: kein Druck, keine negative Sprache.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLottiWeek } from '@/hooks/useLottiWeek';
import { useLottiLevel } from '@/hooks/useLottiLevel';
import { useWeekHeartsClaim } from '@/hooks/useWeekHeartsClaim';
import { useLottiAvatarChoice } from '@/hooks/useLottiAvatarChoice';
import { LottiJourneyMap } from '@/components/LottiJourneyMap';
import { LottiCollection } from '@/components/LottiCollection';
import { WochenkarteStory } from '@/components/WochenkarteStory';
import { babyImageForLevel } from '@/lib/lottiBabyImages';
import {
  LOTTI_LEVELS,
  type DayCounts,
  type DayPointBreakdown,
} from '@/lib/lottiPoints';
import { LockedFeatureScreen } from '@/components/LockedFeatureScreen';
import { useFeatureAccess } from '@/lib/entitlements';

const ACCENT_PURPLE = '#5E3DB3';
const POINTS_NOUN = 'Herzen';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const formatRange = (start: Date, end: Date) => {
  const sameMonth = start.getMonth() === end.getMonth();
  const dayMonth = (d: Date) =>
    `${d.getDate()}. ${d.toLocaleString('de-DE', { month: 'long' })}`;
  const dayOnly = (d: Date) => `${d.getDate()}.`;
  if (sameMonth) {
    return `${dayOnly(start)}–${dayMonth(end)}`;
  }
  return `${dayMonth(start)} – ${dayMonth(end)}`;
};

const formatHoursMinutes = (totalMinutes: number) => {
  if (totalMinutes <= 0) return null;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h <= 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
};

// Abo-Gate: in Lotti Lite ist dieses Feature gesperrt (lib/entitlements.ts).
export default function WochenmomentScreen() {
  const access = useFeatureAccess('wochenmomente');

  if (access.hasAccess === null) return null;
  if (!access.hasAccess) {
    return <LockedFeatureScreen feature="wochenmomente" />;
  }

  return <WochenmomentScreenContent />;
}

function WochenmomentScreenContent() {
  const adaptiveColors = useAdaptiveColors();
  const {
    areas,
    counts,
    activeDays,
    totalSleepMinutes,
    weekStart,
    weekEnd,
    days,
    todayIndex,
    weekPoints,
    dayBuckets,
    dayPoints,
  } = useLottiWeek();
  const { totalPoints, level, levelJustIncreased } = useLottiLevel();
  const heartsClaim = useWeekHeartsClaim(weekStart, weekPoints);
  const { chosenLevel } = useLottiAvatarChoice();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [storyVisible, setStoryVisible] = useState(false);
  const chosenAvatarImage = useMemo(
    () =>
      chosenLevel !== null && chosenLevel <= level.level
        ? babyImageForLevel(chosenLevel)
        : undefined,
    [chosenLevel, level.level],
  );

  const isWeekComplete =
    activeDays >= 7 || (todayIndex === 6 && activeDays >= 3);

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const textTertiary = isDark ? Colors.dark.textTertiary : '#9C8178';

  const cardBlurBg = isDark ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.40)';
  const cardContainerBg = isDark
    ? 'rgba(255, 255, 255, 0.04)'
    : 'rgba(255, 255, 255, 0.22)';
  const cardBorder = isDark
    ? 'rgba(255, 255, 255, 0.18)'
    : 'rgba(255, 255, 255, 0.55)';

  const tileBg = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(94, 61, 179, 0.08)';
  const tileBorder = isDark
    ? 'rgba(255, 255, 255, 0.18)'
    : 'rgba(94, 61, 179, 0.20)';

  const sleepTotal = formatHoursMinutes(totalSleepMinutes);
  const sleepRange = `${weekStart.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}`;

  return (
    <ThemedBackground style={styles.background}>
      <StatusBar hidden />
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Wochenmoment"
          subtitle={formatRange(weekStart, weekEnd)}
          showBackButton
          showBabySwitcher={false}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* 0) Wochenkarte / Story-Einstieg */}
          <Pressable
            onPress={() => setStoryVisible(true)}
            style={({ pressed }) => [
              styles.storyBanner,
              isWeekComplete
                ? styles.storyBannerReady
                : {
                    backgroundColor: tileBg,
                    borderColor: tileBorder,
                  },
              pressed ? { opacity: 0.85 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Wochenkarte ansehen"
          >
            <ThemedText adaptive={false} style={styles.storyBannerEmoji}>
              ✨
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[
                styles.storyBannerText,
                { color: isWeekComplete ? '#FFFFFF' : ACCENT_PURPLE },
              ]}
            >
              {isWeekComplete
                ? 'Eure Wochenkarte ist bereit'
                : 'Eure Wochen-Story ansehen'}
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[
                styles.storyBannerCta,
                { color: isWeekComplete ? '#FFFFFF' : ACCENT_PURPLE },
              ]}
            >
              Ansehen ›
            </ThemedText>
          </Pressable>

          {/* 1) Eure Woche */}
          <EureWocheCard
            days={days}
            todayIndex={todayIndex}
            activeDays={activeDays}
            weekPoints={weekPoints}
            heartsClaim={heartsClaim}
            onDayPress={setSelectedDayIndex}
            sleepRange={sleepRange}
            isDark={isDark}
            cardBg={cardContainerBg}
            cardBorder={cardBorder}
            cardBlurBg={cardBlurBg}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            textTertiary={textTertiary}
          />

          {/* 2) Bereichs-Tiles */}
          <View style={styles.tilesRow}>
            <AreaTile
              emoji="🍼"
              count={counts.feeding}
              singular="Essensmoment"
              plural="Essensmomente"
              active={areas.feeding}
              tileBg={tileBg}
              tileBorder={tileBorder}
              textSecondary={textSecondary}
            />
            <AreaTile
              emoji="🤍"
              count={counts.care}
              singular="Pflegemoment"
              plural="Pflegemomente"
              active={areas.care}
              tileBg={tileBg}
              tileBorder={tileBorder}
              textSecondary={textSecondary}
            />
            <AreaTile
              emoji="🌙"
              count={counts.sleep}
              singular="Schlafmoment"
              plural="Schlafmomente"
              active={areas.sleep}
              tileBg={tileBg}
              tileBorder={tileBorder}
              textSecondary={textSecondary}
            />
          </View>

          {sleepTotal ? (
            <View
              style={[
                styles.sleepTotalRow,
                { backgroundColor: tileBg, borderColor: tileBorder },
              ]}
            >
              <ThemedText adaptive={false} style={styles.sleepTotalEmoji}>
                🌙
              </ThemedText>
              <View style={styles.sleepTotalTextWrap}>
                <ThemedText
                  adaptive={false}
                  style={[styles.sleepTotalLabel, { color: textTertiary }]}
                >
                  Gesamtschlaf diese Woche
                </ThemedText>
                <ThemedText
                  adaptive={false}
                  style={[styles.sleepTotalValue, { color: textPrimary }]}
                >
                  {sleepTotal}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {/* 3) Lotti-Sammlung — bewusst vor der Reise, damit sie nicht
              unter der großen Karte verschwindet */}
          <LottiCollection
            currentLevel={level.level}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            textTertiary={textTertiary}
          />

          {/* 4) Lotti-Reise */}
          <LottiJourneyMap
            levels={LOTTI_LEVELS}
            currentLevel={level.level}
            totalPoints={totalPoints}
            pointsToNext={level.pointsToNext}
            nextLevelName={level.nextLevelName}
            progressFraction={level.progressFraction}
            avatarState={{ image: chosenAvatarImage, levelJustIncreased }}
          />

          <ThemedText
            adaptive={false}
            style={[styles.closing, { color: textTertiary }]}
          >
            Nicht jeder Tag muss perfekt dokumentiert sein. Jeder kleine Eintrag
            hilft euch, euren Alltag besser zu verstehen.
          </ThemedText>
        </ScrollView>

        <WochenkarteStory
          visible={storyVisible}
          onClose={() => setStoryVisible(false)}
          data={{
            weekStart,
            weekEnd,
            counts,
            activeDays,
            totalSleepMinutes,
            weekPoints,
            dayBuckets,
            dayPoints,
            level,
            totalPoints,
          }}
        />

        <DayDetailSheet
          dayIndex={selectedDayIndex}
          weekStart={weekStart}
          todayIndex={todayIndex}
          buckets={selectedDayIndex !== null ? dayBuckets[selectedDayIndex] : null}
          points={selectedDayIndex !== null ? dayPoints[selectedDayIndex] : null}
          onClose={() => setSelectedDayIndex(null)}
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textTertiary={textTertiary}
        />
      </SafeAreaView>
    </ThemedBackground>
  );
}

/* -------------------------------------------------------------- */
/* Eure Woche — Mo–So mit Herz-Status                              */
/* -------------------------------------------------------------- */

type EureWocheProps = {
  days: boolean[];
  todayIndex: number;
  activeDays: number;
  weekPoints: number;
  heartsClaim: ReturnType<typeof useWeekHeartsClaim>;
  onDayPress: (index: number) => void;
  sleepRange: string;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  cardBlurBg: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
};

function EureWocheCard({
  days,
  todayIndex,
  activeDays,
  weekPoints,
  heartsClaim,
  onDayPress,
  isDark,
  cardBg,
  cardBorder,
  cardBlurBg,
  textPrimary,
  textSecondary,
  textTertiary,
}: EureWocheProps) {
  const heartFilled = ACCENT_PURPLE;
  const heartEmptyBg = isDark
    ? 'rgba(255,255,255,0.06)'
    : 'rgba(94,61,179,0.06)';
  const heartEmptyBorder = isDark
    ? 'rgba(255,255,255,0.20)'
    : 'rgba(94,61,179,0.22)';

  const { claimable, claimedPoints, isLoaded, claim } = heartsClaim;

  // Claim-Animation: Herzchen-Burst + Count-up der eingesammelten Herzen.
  const [burst, setBurst] = useState<{ key: number; amount: number } | null>(
    null,
  );
  const [displayCount, setDisplayCount] = useState(0);
  const [countAnim] = useState(() => new Animated.Value(0));
  const isClaiming = burst !== null;

  useEffect(() => {
    const id = countAnim.addListener(({ value }) =>
      setDisplayCount(Math.round(value)),
    );
    return () => countAnim.removeListener(id);
  }, [countAnim]);

  const handleClaim = async () => {
    const amount = await claim();
    if (amount <= 0) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    setBurst({ key: Date.now(), amount });
    countAnim.setValue(0);
    Animated.timing(countAnim, {
      toValue: amount,
      duration: 1300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      // Burst nach dem Count-up noch kurz stehen lassen, dann aufräumen.
      setTimeout(() => setBurst(null), 700);
    });
  };

  return (
    <BlurView
      {...(Platform.OS === 'android'
        ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
        : {})}
      intensity={22}
      tint={isDark ? 'dark' : 'light'}
      style={[styles.weekBlur, { backgroundColor: cardBlurBg }]}
    >
      <View
        style={[
          styles.weekCard,
          { backgroundColor: cardBg, borderColor: cardBorder },
        ]}
      >
        <View style={styles.weekHeaderRow}>
          <View style={styles.weekHeaderLeft}>
            <ThemedText adaptive={false} style={styles.weekHeaderEmoji}>
              📅
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[styles.weekHeaderTitle, { color: textPrimary }]}
            >
              Eure Woche
            </ThemedText>
          </View>
          <ThemedText
            adaptive={false}
            style={[styles.weekHeaderRight, { color: ACCENT_PURPLE }]}
          >
            {activeDays} von 7 Tagen begleitet
          </ThemedText>
        </View>

        <View style={styles.dayChipsRow}>
          {DAY_LABELS.map((label, idx) => {
            const isToday = idx === todayIndex;
            const isOn = days[idx];
            const isFuture = idx > todayIndex && todayIndex !== -1;
            return (
              <Pressable
                key={label}
                style={({ pressed }) => [
                  styles.dayChip,
                  pressed ? { opacity: 0.7, transform: [{ scale: 0.94 }] } : null,
                ]}
                onPress={() => onDayPress(idx)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${label} — Tagesdetails anzeigen`}
              >
                <ThemedText
                  adaptive={false}
                  style={[
                    styles.dayChipLabel,
                    {
                      color: isToday ? ACCENT_PURPLE : textTertiary,
                      fontWeight: isToday ? '800' : '600',
                    },
                  ]}
                >
                  {label}
                </ThemedText>
                <View
                  style={[
                    styles.dayChipCircle,
                    {
                      backgroundColor: isOn ? heartFilled : heartEmptyBg,
                      borderColor: isOn
                        ? heartFilled
                        : isToday
                          ? ACCENT_PURPLE
                          : heartEmptyBorder,
                      borderStyle: isFuture && !isOn ? 'dashed' : 'solid',
                    },
                  ]}
                >
                  <ThemedText
                    adaptive={false}
                    style={[
                      styles.dayChipHeart,
                      {
                        color: isOn
                          ? '#FFFFFF'
                          : isToday
                            ? ACCENT_PURPLE
                            : heartEmptyBorder,
                      },
                    ]}
                  >
                    ♥
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        {isClaiming ? (
          <View style={[styles.weekFooterRow, styles.claimCountRow]}>
            <ThemedText
              adaptive={false}
              style={[styles.claimCountText, { color: ACCENT_PURPLE }]}
            >
              +{displayCount} {POINTS_NOUN} 🤍
            </ThemedText>
          </View>
        ) : isLoaded && claimable > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleClaim}
            style={[styles.claimButton, { backgroundColor: ACCENT_PURPLE }]}
            accessibilityRole="button"
            accessibilityLabel={`${claimable} ${POINTS_NOUN} einsammeln`}
          >
            <ThemedText adaptive={false} style={styles.claimButtonText}>
              ✨ {claimable} {POINTS_NOUN} einsammeln
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={styles.weekFooterRow}>
            <ThemedText
              adaptive={false}
              style={[styles.weekFooterText, { color: textSecondary }]}
            >
              Diese Woche
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[styles.weekFooterPoints, { color: ACCENT_PURPLE }]}
            >
              {claimedPoints > 0
                ? `Eingesammelt 🤍 +${claimedPoints} ${POINTS_NOUN}`
                : `+${weekPoints} ${POINTS_NOUN}`}
            </ThemedText>
          </View>
        )}

        {burst ? <HeartBurst burstKey={burst.key} /> : null}
      </View>
    </BlurView>
  );
}

/* -------------------------------------------------------------- */
/* Herzchen-Burst — kleine Herzen steigen beim Einsammeln auf      */
/* -------------------------------------------------------------- */

const BURST_HEART_COUNT = 12;

function HeartBurst({ burstKey }: { burstKey: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: BURST_HEART_COUNT }).map((_, i) => (
        <FloatingHeart key={`${burstKey}-${i}`} index={i} />
      ))}
    </View>
  );
}

function FloatingHeart({ index }: { index: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [config] = useState(() => ({
    leftPct: 8 + Math.random() * 84,
    delay: index * 55 + Math.random() * 90,
    driftX: (Math.random() - 0.5) * 46,
    rise: 90 + Math.random() * 70,
    size: 13 + Math.random() * 9,
    duration: 950 + Math.random() * 500,
  }));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: config.duration,
      delay: config.delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, config]);

  return (
    <Animated.Text
      style={[
        styles.floatingHeart,
        {
          left: `${config.leftPct}%`,
          fontSize: config.size,
          opacity: progress.interpolate({
            inputRange: [0, 0.12, 0.75, 1],
            outputRange: [0, 1, 1, 0],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -config.rise],
              }),
            },
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, config.driftX],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0.5, 1, 1],
              }),
            },
          ],
        },
      ]}
    >
      💜
    </Animated.Text>
  );
}

/* -------------------------------------------------------------- */
/* Day-Detail-Sheet — Momente + Herzen eines Tages                 */
/* -------------------------------------------------------------- */

const DAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

function DayDetailSheet({
  dayIndex,
  weekStart,
  todayIndex,
  buckets,
  points,
  onClose,
  isDark,
  textPrimary,
  textSecondary,
  textTertiary,
}: {
  dayIndex: number | null;
  weekStart: Date;
  todayIndex: number;
  buckets: DayCounts | null;
  points: DayPointBreakdown | null;
  onClose: () => void;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
}) {
  if (dayIndex === null || !buckets || !points) {
    return (
      <Modal visible={false} transparent animationType="slide">
        <View />
      </Modal>
    );
  }

  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayIndex);
  const dateLabel = `${DAY_NAMES[dayIndex]}, ${date.getDate()}. ${date.toLocaleString('de-DE', { month: 'long' })}`;

  const isToday = dayIndex === todayIndex;
  const isFuture = todayIndex !== -1 && dayIndex > todayIndex;
  const totalMoments =
    buckets.feedingCount + buckets.careCount + buckets.sleepCount;

  const rows: { emoji: string; label: string; count: number; pts: number }[] = [
    {
      emoji: '🍼',
      label: buckets.feedingCount === 1 ? 'Essensmoment' : 'Essensmomente',
      count: buckets.feedingCount,
      pts: points.feeding,
    },
    {
      emoji: '🤍',
      label: buckets.careCount === 1 ? 'Pflegemoment' : 'Pflegemomente',
      count: buckets.careCount,
      pts: points.care,
    },
    {
      emoji: '🌙',
      label: buckets.sleepCount === 1 ? 'Schlafmoment' : 'Schlafmomente',
      count: buckets.sleepCount,
      pts: points.sleep,
    },
  ].filter((row) => row.count > 0);

  const emptyMessage = isFuture
    ? 'Dieser Tag liegt noch vor euch 🤍'
    : isToday
      ? 'Heute ist noch nichts festgehalten — der erste Moment zählt doppelt schön.'
      : 'An diesem Tag habt ihr nichts festgehalten — völlig okay. Nicht jeder Tag braucht Einträge.';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.sheetWrapper}
        >
          <BlurView
            {...(Platform.OS === 'android'
              ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
              : {})}
            intensity={30}
            tint={isDark ? 'dark' : 'light'}
            style={styles.sheetBlur}
          >
            <View
              style={[
                styles.sheetCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(24,20,30,0.88)'
                    : 'rgba(255,255,255,0.94)',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(255,255,255,0.82)',
                },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetHeaderText}>
                  <ThemedText adaptive={false} style={styles.sheetKicker}>
                    {isToday ? 'Heute' : DAY_NAMES[dayIndex]}
                  </ThemedText>
                  <ThemedText
                    adaptive={false}
                    style={[styles.sheetTitle, { color: textPrimary }]}
                  >
                    {dateLabel}
                  </ThemedText>
                </View>
                {totalMoments > 0 ? (
                  <View style={styles.sheetPointsBadge}>
                    <ThemedText
                      adaptive={false}
                      style={styles.sheetPointsBadgeText}
                    >
                      +{points.total} {POINTS_NOUN}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {totalMoments === 0 ? (
                <ThemedText
                  adaptive={false}
                  style={[styles.sheetEmpty, { color: textSecondary }]}
                >
                  {emptyMessage}
                </ThemedText>
              ) : (
                <View style={styles.sheetRows}>
                  {rows.map((row) => (
                    <View key={row.label} style={styles.sheetRow}>
                      <ThemedText adaptive={false} style={styles.sheetRowEmoji}>
                        {row.emoji}
                      </ThemedText>
                      <ThemedText
                        adaptive={false}
                        style={[styles.sheetRowLabel, { color: textPrimary }]}
                      >
                        {row.count} {row.label}
                      </ThemedText>
                      <ThemedText
                        adaptive={false}
                        style={[styles.sheetRowPoints, { color: ACCENT_PURPLE }]}
                      >
                        +{row.pts}
                      </ThemedText>
                    </View>
                  ))}
                  {points.bonus > 0 ? (
                    <View style={styles.sheetRow}>
                      <ThemedText adaptive={false} style={styles.sheetRowEmoji}>
                        ✨
                      </ThemedText>
                      <ThemedText
                        adaptive={false}
                        style={[styles.sheetRowLabel, { color: textPrimary }]}
                      >
                        Bonus
                        {buckets.feedingCount > 0 &&
                        buckets.careCount > 0 &&
                        buckets.sleepCount > 0
                          ? ' — alle drei Bereiche an einem Tag!'
                          : ''}
                      </ThemedText>
                      <ThemedText
                        adaptive={false}
                        style={[styles.sheetRowPoints, { color: ACCENT_PURPLE }]}
                      >
                        +{points.bonus}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              )}

              <Pressable onPress={onClose} style={styles.sheetCloseButton}>
                <ThemedText adaptive={false} style={styles.sheetCloseText}>
                  Schließen
                </ThemedText>
              </Pressable>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* -------------------------------------------------------------- */
/* Bereichs-Tile                                                  */
/* -------------------------------------------------------------- */

function AreaTile({
  emoji,
  count,
  singular,
  plural,
  active,
  tileBg,
  tileBorder,
  textSecondary,
}: {
  emoji: string;
  count: number;
  singular: string;
  plural: string;
  active: boolean;
  tileBg: string;
  tileBorder: string;
  textSecondary: string;
}) {
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: tileBg,
          borderColor: tileBorder,
          opacity: active ? 1 : 0.65,
        },
      ]}
    >
      <ThemedText adaptive={false} style={styles.tileEmoji}>
        {emoji}
      </ThemedText>
      <ThemedText
        adaptive={false}
        style={[styles.tileValue, { color: ACCENT_PURPLE }]}
      >
        {count}
      </ThemedText>
      <ThemedText
        adaptive={false}
        style={[styles.tileLabel, { color: textSecondary }]}
      >
        {count === 1 ? singular : plural}
      </ThemedText>
    </View>
  );
}

/* -------------------------------------------------------------- */
/* Styles                                                         */
/* -------------------------------------------------------------- */

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#f5eee0',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 60,
  },
  // Story-Banner
  storyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  storyBannerReady: {
    backgroundColor: ACCENT_PURPLE,
    borderColor: ACCENT_PURPLE,
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  storyBannerEmoji: {
    fontSize: 16,
  },
  storyBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  storyBannerCta: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Eure Woche
  weekBlur: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
  },
  weekCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekHeaderEmoji: {
    fontSize: 18,
  },
  weekHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  weekHeaderRight: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
    flexShrink: 1,
    textAlign: 'right',
  },
  dayChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayChipLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  dayChipCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipHeart: {
    fontSize: 14,
    lineHeight: 16,
  },
  weekFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 61, 179, 0.15)',
  },
  weekFooterText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  weekFooterPoints: {
    fontSize: 13,
    fontWeight: '800',
  },
  claimButton: {
    marginTop: 2,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  claimButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  claimCountRow: {
    justifyContent: 'center',
  },
  claimCountText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  floatingHeart: {
    position: 'absolute',
    bottom: 10,
  },

  // Tiles
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tileEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  tileLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  sleepTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
  },
  sleepTotalEmoji: {
    fontSize: 22,
  },
  sleepTotalTextWrap: {
    flex: 1,
  },
  sleepTotalLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  sleepTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Day-Detail-Sheet
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  sheetWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  sheetBlur: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  sheetCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(94,61,179,0.24)',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sheetKicker: {
    color: ACCENT_PURPLE,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  sheetPointsBadge: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: 'rgba(94,61,179,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.20)',
  },
  sheetPointsBadgeText: {
    color: ACCENT_PURPLE,
    fontSize: 12.5,
    fontWeight: '800',
  },
  sheetEmpty: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '500',
  },
  sheetRows: {
    gap: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetRowEmoji: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  sheetRowLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
  },
  sheetRowPoints: {
    fontSize: 14,
    fontWeight: '800',
  },
  sheetCloseButton: {
    alignSelf: 'flex-end',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(94,61,179,0.10)',
  },
  sheetCloseText: {
    color: ACCENT_PURPLE,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },

  // Closing
  closing: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    paddingHorizontal: 4,
    marginTop: 18,
  },
});
