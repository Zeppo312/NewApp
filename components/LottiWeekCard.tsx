/**
 * LottiWeekCard — Home-Teaser für die Lotti-Woche.
 *
 * Zeigt sanften Wochenfortschritt (Mo–So) PLUS leichtes Lotti-Stufen-System.
 * Punkte kommen aus den drei Kernbereichen (Essen, Pflege, Schlaf), mit
 * Tages-Caps und kleinen Bonusregeln (siehe `lib/lottiPoints.ts`).
 *
 * UI-Sprache bewusst soft:
 *   – „Lotti-Punkte", „Stufe", „Lotti-Moment" statt XP / Level / Mission
 *   – kein Streak-Verlust, kein Druck, kein Konfetti.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLottiWeek } from '@/hooks/useLottiWeek';
import { useLottiLevel } from '@/hooks/useLottiLevel';
import { useWeekHeartsClaim } from '@/hooks/useWeekHeartsClaim';
import { useLottiAvatarChoice } from '@/hooks/useLottiAvatarChoice';
import { LEVEL_BABY_IMAGES, babyImageForLevel } from '@/lib/lottiBabyImages';
import { getWochenkarteMood, WochenkarteStory } from '@/components/WochenkarteStory';
import { useLocale } from '@/contexts/LocaleContext';
import { useFontScale, useLineLimit, useScaledSize } from '@/lib/fontScaling';

const ACCENT_PURPLE = '#5E3DB3';
const PLACEHOLDER_SIZE = 64;
const DAY_COUNT = 7;

/**
 * Avatar-Zustände — gemäß Spec. Aktuell wählen wir ein zufälliges Bild aus
 * dem Pool. Sobald Lotti-Illustrationen pro Zustand existieren, wird hier
 * gemappt (z. B. require('@/assets/lotti/state-sleeping.png')).
 */
type AvatarState = 'sleeping' | 'curious' | 'heart' | 'card' | 'present';

function pickAvatarStateFromActiveDays(
  activeDays: number,
  isWeekComplete: boolean,
): AvatarState {
  if (isWeekComplete) return 'present';
  if (activeDays >= 6) return 'card';
  if (activeDays >= 3) return 'heart';
  if (activeDays >= 1) return 'curious';
  return 'sleeping';
}

type CopySet = {
  title: string;
  cta: string;
};

function getCopy(isWeekComplete: boolean): CopySet {
  if (isWeekComplete) {
    return {
      title: 'Euer Wochen-Review ist bereit 🤍',
      cta: 'Details',
    };
  }
  return {
    title: 'Lottis Wochenmoment 🤍',
    cta: 'Details',
  };
}

function pickUnlockedBabyImage(currentLevel: number) {
  const unlockedCount = Math.min(
    LEVEL_BABY_IMAGES.length,
    Math.max(1, Math.floor(currentLevel)),
  );
  return LEVEL_BABY_IMAGES[Math.floor(Math.random() * unlockedCount)];
}

type Props = {
  style?: ViewStyle;
};

export function LottiWeekCard({ style }: Props) {
  const { locale } = useLocale();
  // Bei größerer Systemschrift lieber umbrechen als abschneiden.
  const oneLineLimit = useLineLimit(1);
  // Enge Zeilen-Layouts (Emoji + Text + Button nebeneinander) lassen bei großer
  // Schrift keine sinnvolle Textbreite mehr übrig — dann untereinander stapeln.
  const isStacked = useFontScale() >= 1.3;
  const twoLineLimit = useLineLimit(2);
  const reviewCtaHeight = useScaledSize(32);
  const reviewEmojiBubbleSize = useScaledSize(38);
  // Feste 22pt-Spalte pro Wochentag reicht bei großer Schrift nicht für
  // zweibuchstabige Kürzel (Lu, Ma, …).
  const dayChipWidth = useScaledSize(22);
  const c = {
    de: { completeTitle: 'Euer Wochen-Review ist bereit 🤍', title: 'Lottis Wochenmoment 🤍', details: 'Details', collect: 'einsammeln', hearts: 'Herzen', moments: 'Momente', waiting: 'Wochen-Review wartet', days: 'Tage', startHint: 'Sobald ihr trackt, entsteht hier euer Rückblick.', level: 'Stufe', until: 'Noch {{points}} Herzen bis Stufe {{level}}', max: 'Höchste Stufe erreicht 🤍', avatar: 'Lotti-Avatar', storyA11y: 'Wochen-Review als Story ansehen', story: 'Story', dayLabels: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] },
    en: { completeTitle: 'Your weekly review is ready 🤍', title: "Lotti's weekly moment 🤍", details: 'Details', collect: 'collect', hearts: 'hearts', moments: 'moments', waiting: 'Weekly review waiting', days: 'days', startHint: 'Your review will appear as soon as you start tracking.', level: 'Level', until: '{{points}} hearts until level {{level}}', max: 'Highest level reached 🤍', avatar: 'Lotti avatar', storyA11y: 'View weekly review as a story', story: 'Story', dayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    es: { completeTitle: 'Vuestro resumen semanal está listo 🤍', title: 'Momento semanal de Lotti 🤍', details: 'Detalles', collect: 'recoger', hearts: 'corazones', moments: 'momentos', waiting: 'El resumen semanal está esperando', days: 'días', startHint: 'El resumen aparecerá cuando empecéis a registrar.', level: 'Nivel', until: 'Faltan {{points}} corazones para el nivel {{level}}', max: 'Nivel máximo alcanzado 🤍', avatar: 'Avatar de Lotti', storyA11y: 'Ver el resumen semanal como historia', story: 'Historia', dayLabels: ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'] },
  }[locale];
  const router = useRouter();
  const [storyVisible, setStoryVisible] = useState(false);
  const adaptiveColors = useAdaptiveColors();
  const {
    days,
    activeDays,
    todayIndex,
    weekStart,
    weekEnd,
    weekPoints,
    counts,
    totalSleepMinutes,
    dayBuckets,
    dayPoints,
  } = useLottiWeek();
  const { totalPoints, level, levelJustIncreased } = useLottiLevel();
  const { claimable } = useWeekHeartsClaim(weekStart, weekPoints);
  const { chosenLevel } = useLottiAvatarChoice();

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;

  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const textTertiary = isDark ? Colors.dark.textTertiary : '#9C8178';

  const glassBlurBg = isDark
    ? 'rgba(0, 0, 0, 0.18)'
    : 'rgba(255, 255, 255, 0.35)';
  const glassContainerBg = isDark
    ? 'rgba(255, 255, 255, 0.04)'
    : 'rgba(255, 255, 255, 0.22)';
  const glassBorder = isDark
    ? 'rgba(255, 255, 255, 0.18)'
    : 'rgba(255, 255, 255, 0.55)';

  const avatarBorder = isDark
    ? 'rgba(255,255,255,0.20)'
    : 'rgba(255,255,255,0.85)';

  const dayLabelColor = isDark ? Colors.dark.textTertiary : '#9C8178';
  const daySpotEmpty = isDark
    ? 'rgba(255,255,255,0.18)'
    : 'rgba(94,61,179,0.18)';
  const dividerColor = isDark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(94,61,179,0.12)';

  const progressTrackColor = isDark
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(94,61,179,0.14)';

  const isSundayToday = todayIndex === 6;
  const isWeekComplete =
    activeDays >= DAY_COUNT || (isSundayToday && activeDays >= 3);

  const copy = { title: isWeekComplete ? c.completeTitle : c.title, cta: c.details };
  // Wartende Herzen machen den CTA zum Einsammel-Hinweis.
  const ctaLabel = claimable > 0 ? `✨ ${claimable} ${c.collect}` : copy.cta;
  const totalMoments = counts.feeding + counts.care + counts.sleep;
  const mood = useMemo(() => getWochenkarteMood({ counts }, locale), [counts, locale]);
  const reviewTitle =
    totalMoments > 0 ? `${mood.word} · ${totalMoments} ${c.moments}` : c.waiting;
  const reviewSubtitle =
    totalMoments > 0
      ? `${activeDays}/7 ${c.days} · +${weekPoints} ${c.hearts}`
      : c.startHint;

  // Aktueller Avatar-Zustand — vorbereitet für spätere Lotti-Illus.
  const avatarState = pickAvatarStateFromActiveDays(activeDays, isWeekComplete);

  // Gewähltes Sammlungs-Bild hat Vorrang; sonst Zufall aus freigeschalteten.
  const randomUnlockedImage = useMemo(
    () => pickUnlockedBabyImage(level.level),
    [level.level],
  );
  const unlockedBabyImage =
    chosenLevel !== null && chosenLevel <= level.level
      ? babyImageForLevel(chosenLevel)
      : randomUnlockedImage;

  const handlePress = () => {
    router.push('/wochenmoment' as any);
  };

  const handleStoryPress = (event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    setStoryVisible(true);
  };

  // Untertitel: Stufenname + Herzen. Stufe Nr. zeigt das Badge.
  const subtitle = level.isMax
    ? `${c.level} ${level.level} · ${totalPoints} ${c.hearts}`
    : `${c.level} ${level.level} · ${totalPoints} / ${level.nextThreshold ?? '—'} ${c.hearts}`;

  // Progressbar-Animation
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: level.progressFraction,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [level.progressFraction, progressAnim]);

  // Sanfter Bounce/Blink des Avatars beim Laden.
  const avatarScale = useMemo(() => new Animated.Value(0.92), []);
  useEffect(() => {
    Animated.spring(avatarScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [avatarScale]);

  // Level-Up-Glow: sanfter Halo + leichter Bounce des Badges.
  const glowOpacity = useMemo(() => new Animated.Value(0), []);
  const glowScale = useMemo(() => new Animated.Value(0.6), []);
  const badgeBounce = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (!levelJustIncreased) {
      glowOpacity.stopAnimation();
      glowScale.stopAnimation();
      glowOpacity.setValue(0);
      glowScale.setValue(0.6);
      return;
    }

    // Glow Sequence
    Animated.sequence([
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.5,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.9,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      glowOpacity.setValue(0);
      glowScale.setValue(0.6);
    });

    // Badge-Bounce
    Animated.sequence([
      Animated.timing(badgeBounce, {
        toValue: 1.25,
        duration: 240,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.spring(badgeBounce, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [levelJustIncreased, glowOpacity, glowScale, badgeBounce]);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={[styles.wrapper, style]}
        accessibilityRole="button"
        accessibilityLabel={`${copy.title}. ${subtitle}`}
      >
        <BlurView
          {...(Platform.OS === 'android'
            ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
            : {})}
          intensity={22}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.blur, { backgroundColor: glassBlurBg }]}
        >
          <View
            style={[
              styles.container,
              { backgroundColor: glassContainerBg, borderColor: glassBorder },
            ]}
          >
            <View style={[styles.row, isStacked ? styles.rowStacked : null]}>
              <Animated.View
                style={[
                  styles.avatarBlock,
                  { transform: [{ scale: avatarScale }] },
                ]}
                // data-avatar-state damit später Illustration leicht zu finden
        accessibilityLabel={`${c.avatar} (${avatarState})`}
              >
                <View
                  style={[
                    styles.placeholder,
                    { borderColor: avatarBorder },
                  ]}
                >
                  <Image
                    source={unlockedBabyImage}
                    style={styles.placeholderImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.badgeAnchor} pointerEvents="none">
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.levelGlow,
                      {
                        opacity: glowOpacity,
                        transform: [{ scale: glowScale }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.levelBadge,
                      {
                        backgroundColor: ACCENT_PURPLE,
                        borderColor: isDark
                          ? 'rgba(20,18,28,0.85)'
                          : 'rgba(255,255,255,0.95)',
                        transform: [{ scale: badgeBounce }],
                      },
                    ]}
                  >
                    <ThemedText adaptive={false} style={styles.levelBadgeText}>
                      {level.level}
                    </ThemedText>
                  </Animated.View>
                </View>
              </Animated.View>

              <View style={[styles.textBlock, isStacked ? styles.textBlockStacked : null]}>
                <ThemedText
                  adaptive={false}
                  style={[styles.title, { color: textPrimary }]}
                  numberOfLines={twoLineLimit}
                >
                  {copy.title}
                </ThemedText>
                <ThemedText
                  adaptive={false}
                  style={[styles.subtitle, { color: textSecondary }]}
                  numberOfLines={twoLineLimit}
                >
                  {subtitle}
                </ThemedText>

                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: progressTrackColor },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: ACCENT_PURPLE,
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                {!level.isMax ? (
                  <ThemedText
                    adaptive={false}
                    style={[styles.progressHint, { color: textTertiary }]}
                    numberOfLines={oneLineLimit}
                  >
                    {c.until.replace('{{points}}', String(level.pointsToNext)).replace('{{level}}', String(level.level + 1))}
                  </ThemedText>
                ) : (
                  <ThemedText
                    adaptive={false}
                    style={[styles.progressHint, { color: textTertiary }]}
                    numberOfLines={oneLineLimit}
                  >
                    {c.max}
                  </ThemedText>
                )}
              </View>
            </View>

            <Pressable
              onPress={handleStoryPress}
              style={({ pressed }) => [
                styles.reviewRow,
                isStacked ? styles.reviewRowStacked : null,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(94,61,179,0.08)',
                  borderColor: dividerColor,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={c.storyA11y}
            >
              <View
                style={[
                  styles.reviewEmojiBubble,
                  {
                    width: reviewEmojiBubbleSize,
                    height: reviewEmojiBubbleSize,
                    borderRadius: reviewEmojiBubbleSize / 2,
                  },
                ]}
              >
                <ThemedText adaptive={false} allowFontScaling={false} style={styles.reviewEmoji}>
                  {mood.emoji}
                </ThemedText>
              </View>
              <View style={[styles.reviewTextBlock, isStacked ? styles.reviewTextBlockStacked : null]}>
                <ThemedText
                  adaptive={false}
                  style={[styles.reviewTitle, { color: textPrimary }]}
                  numberOfLines={oneLineLimit}
                >
                  {reviewTitle}
                </ThemedText>
                <ThemedText
                  adaptive={false}
                  style={[styles.reviewSubtitle, { color: textSecondary }]}
                  numberOfLines={oneLineLimit}
                >
                  {reviewSubtitle}
                </ThemedText>
              </View>
              <View style={[styles.reviewCta, { height: reviewCtaHeight, borderRadius: reviewCtaHeight / 2 }]}>
                <ThemedText adaptive={false} style={styles.reviewCtaText}>
                  {c.story}
                </ThemedText>
                <IconSymbol name="play.fill" size={13} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <View style={[styles.bottomRow, isStacked ? styles.bottomRowStacked : null]}>
              <View style={[styles.daysRow, isStacked ? styles.daysRowStacked : null]}>
                {c.dayLabels.map((label, idx) => {
                  const isToday = idx === todayIndex;
                  const isOn = days[idx];
                  return (
                    <View
                      key={label}
                      style={[
                        styles.dayChip,
                        isStacked ? styles.dayChipStacked : { width: dayChipWidth },
                      ]}
                    >
                      <ThemedText
                        adaptive={false}
                        style={[
                          styles.dayLabel,
                          {
                            color: isToday ? ACCENT_PURPLE : dayLabelColor,
                            fontWeight: isToday ? '800' : '600',
                          },
                        ]}
                      >
                        {label}
                      </ThemedText>
                      <View
                        style={[
                          styles.daySpot,
                          {
                            backgroundColor: isOn ? ACCENT_PURPLE : daySpotEmpty,
                          },
                          isToday && !isOn ? styles.daySpotTodayRing : null,
                        ]}
                      />
                    </View>
                  );
                })}
              </View>

              <View style={styles.ctaInner}>
                <ThemedText
                  adaptive={false}
                  style={[styles.cta, { color: ACCENT_PURPLE }]}
                  numberOfLines={oneLineLimit}
                >
                  {ctaLabel}
                </ThemedText>
                <IconSymbol name="chevron.right" size={13} color={ACCENT_PURPLE} />
              </View>
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>

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
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  blur: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  container: {
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowStacked: {
    // Avatar + Text nebeneinander lassen dem Titel bei großer Schrift keine
    // Breite mehr — „Wochenmoment" bricht sonst mitten im Wort.
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  avatarBlock: {
    position: 'relative',
    width: PLACEHOLDER_SIZE,
    height: PLACEHOLDER_SIZE,
  },
  placeholder: {
    width: PLACEHOLDER_SIZE,
    height: PLACEHOLDER_SIZE,
    borderRadius: PLACEHOLDER_SIZE / 2,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
  },
  badgeAnchor: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  levelGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(94, 61, 179, 0.40)',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  textBlockStacked: {
    flex: 0,
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 21,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.95,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressHint: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0,
  },
  reviewRow: {
    minHeight: 58,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewEmojiBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  reviewEmoji: {
    fontSize: 23,
    lineHeight: 29,
    textAlign: 'center',
  },
  reviewTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  reviewRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  reviewTextBlockStacked: {
    flex: 0,
    alignSelf: 'stretch',
  },
  reviewTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  reviewSubtitle: {
    marginTop: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0,
  },
  reviewCta: {
    minWidth: 68,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: ACCENT_PURPLE,
  },
  reviewCtaText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bottomRowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  daysRowStacked: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  dayChipStacked: {
    // Volle Breite gleichmäßig auf die sieben Tage verteilen, statt feste
    // Spaltenbreiten zu skalieren (die sonst über den Kartenrand laufen).
    flex: 1,
    width: 'auto',
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayChip: {
    alignItems: 'center',
    width: 22,
    gap: 3,
  },
  dayLabel: {
    fontSize: 10,
    letterSpacing: 0,
  },
  daySpot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  daySpotTodayRing: {
    borderWidth: 1.5,
    borderColor: 'rgba(94, 61, 179, 0.55)',
    backgroundColor: 'transparent',
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  cta: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
