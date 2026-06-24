/**
 * Wochenmoment — sanfter Wochenrückblick + Lotti-Reise.
 *
 * Aufbau:
 *   1) „Eure Woche" — Mo–So mit Herz-Status pro Tag + kleine Stats
 *   2) Bereichs-Tiles (Essen / Pflege / Schlaf der Woche)
 *   3) Lotti-Reise — aktuelle Stufe als Reise-Moment
 *   4) Abschlusssatz
 *
 * Ton bleibt soft: kein Druck, keine negative Sprache.
 */

import React from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLottiWeek } from '@/hooks/useLottiWeek';
import { useLottiLevel } from '@/hooks/useLottiLevel';
import { LottiJourneyMap } from '@/components/LottiJourneyMap';
import { LOTTI_LEVELS } from '@/lib/lottiPoints';

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

export default function WochenmomentScreen() {
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
  } = useLottiWeek();
  const { totalPoints, level, levelJustIncreased } = useLottiLevel();

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
          {/* 1) Eure Woche */}
          <EureWocheCard
            days={days}
            todayIndex={todayIndex}
            activeDays={activeDays}
            weekPoints={weekPoints}
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

          {/* 3) Lotti-Reise */}
          <LottiJourneyMap
            levels={LOTTI_LEVELS}
            currentLevel={level.level}
            totalPoints={totalPoints}
            pointsToNext={level.pointsToNext}
            nextLevelName={level.nextLevelName}
            progressFraction={level.progressFraction}
            avatarState={{ levelJustIncreased }}
          />

          <ThemedText
            adaptive={false}
            style={[styles.closing, { color: textTertiary }]}
          >
            Nicht jeder Tag muss perfekt dokumentiert sein. Jeder kleine Eintrag
            hilft euch, euren Alltag besser zu verstehen.
          </ThemedText>
        </ScrollView>
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
              <View key={label} style={styles.dayChip}>
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
              </View>
            );
          })}
        </View>

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
            +{weekPoints} {POINTS_NOUN}
          </ThemedText>
        </View>
      </View>
    </BlurView>
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

  // Closing
  closing: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    paddingHorizontal: 4,
    marginTop: 18,
  },
});
