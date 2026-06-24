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

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLottiWeek } from '@/hooks/useLottiWeek';
import { useLottiLevel } from '@/hooks/useLottiLevel';

const POINTS_NOUN = 'Herzen'; // UI-Bezeichnung für Lotti-Punkte (austauschbar)

const ACCENT_PURPLE = '#5E3DB3';
const PLACEHOLDER_SIZE = 64;
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_COUNT = 7;

const LEVEL_BABY_IMAGES: readonly ImageSourcePropType[] = [
  require('@/assets/images/LottiBaby_Babys/1.jpg'),
  require('@/assets/images/LottiBaby_Babys/2.jpg'),
  require('@/assets/images/LottiBaby_Babys/3.jpg'),
  require('@/assets/images/LottiBaby_Babys/4.jpg'),
  require('@/assets/images/LottiBaby_Babys/5.jpg'),
  require('@/assets/images/LottiBaby_Babys/6.jpg'),
  require('@/assets/images/LottiBaby_Babys/7.jpg'),
  require('@/assets/images/LottiBaby_Babys/8.jpg'),
  require('@/assets/images/LottiBaby_Babys/9.jpg'),
  require('@/assets/images/LottiBaby_Babys/10.jpg'),
  require('@/assets/images/LottiBaby_Babys/11.jpg'),
  require('@/assets/images/LottiBaby_Babys/12.jpg'),
  require('@/assets/images/LottiBaby_Babys/13.jpg'),
  require('@/assets/images/LottiBaby_Babys/14.jpg'),
  require('@/assets/images/LottiBaby_Babys/15.jpg'),
  require('@/assets/images/LottiBaby_Babys/16.jpg'),
  require('@/assets/images/LottiBaby_Babys/17.jpg'),
  require('@/assets/images/LottiBaby_Babys/18.jpg'),
  require('@/assets/images/LottiBaby_Babys/19.jpg'),
  require('@/assets/images/LottiBaby_Babys/20.jpg'),
  require('@/assets/images/LottiBaby_Babys/21.jpg'),
  require('@/assets/images/LottiBaby_Babys/22.jpg'),
  require('@/assets/images/LottiBaby_Babys/23.jpg'),
  require('@/assets/images/LottiBaby_Babys/24.jpg'),
  require('@/assets/images/LottiBaby_Babys/25.jpg'),
  require('@/assets/images/LottiBaby_Babys/26.jpg'),
  require('@/assets/images/LottiBaby_Babys/27.jpg'),
  require('@/assets/images/LottiBaby_Babys/28.jpg'),
  require('@/assets/images/LottiBaby_Babys/29.jpg'),
  require('@/assets/images/LottiBaby_Babys/30.jpg'),
];

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
      title: 'Eure Wochenkarte ist bereit 🤍',
      cta: 'Anzeigen',
    };
  }
  return {
    title: 'Lotti wächst mit euch 🤍',
    cta: 'Anzeigen',
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
  const router = useRouter();
  const adaptiveColors = useAdaptiveColors();
  const { days, activeDays, todayIndex } = useLottiWeek();
  const { totalPoints, level, levelJustIncreased } = useLottiLevel();

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

  const copy = getCopy(isWeekComplete);

  // Aktueller Avatar-Zustand — vorbereitet für spätere Lotti-Illus.
  const avatarState = pickAvatarStateFromActiveDays(activeDays, isWeekComplete);

  const unlockedBabyImage = useMemo(
    () => pickUnlockedBabyImage(level.level),
    [level.level],
  );

  const handlePress = () => {
    router.push('/wochenmoment' as any);
  };

  // Untertitel: Stufenname + Herzen. Stufe Nr. zeigt das Badge.
  const subtitle = level.isMax
    ? `${level.name} · ${totalPoints} ${POINTS_NOUN}`
    : `${level.name} · ${totalPoints} / ${level.nextThreshold ?? '—'} ${POINTS_NOUN}`;

  // Progressbar-Animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: level.progressFraction,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [level.progressFraction, progressAnim]);

  // Sanfter Bounce/Blink des Avatars beim Laden.
  const avatarScale = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    Animated.spring(avatarScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [avatarScale]);

  // Level-Up-Glow: sanfter Halo + leichter Bounce des Badges.
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const badgeBounce = useRef(new Animated.Value(1)).current;

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
          <View style={styles.row}>
            <Animated.View
              style={[
                styles.avatarBlock,
                { transform: [{ scale: avatarScale }] },
              ]}
              // data-avatar-state damit später Illustration leicht zu finden
              accessibilityLabel={`Lotti-Avatar (${avatarState})`}
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

            <View style={styles.textBlock}>
              <ThemedText
                adaptive={false}
                style={[styles.title, { color: textPrimary }]}
                numberOfLines={2}
              >
                {copy.title}
              </ThemedText>
              <ThemedText
                adaptive={false}
                style={[styles.subtitle, { color: textSecondary }]}
                numberOfLines={2}
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
                  numberOfLines={1}
                >
                  Noch {level.pointsToNext} {POINTS_NOUN} bis „{level.nextLevelName}“
                </ThemedText>
              ) : (
                <ThemedText
                  adaptive={false}
                  style={[styles.progressHint, { color: textTertiary }]}
                  numberOfLines={1}
                >
                  Höchste Stufe erreicht 🤍
                </ThemedText>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.bottomRow}>
            <View style={styles.daysRow}>
              {DAY_LABELS.map((label, idx) => {
                const isToday = idx === todayIndex;
                const isOn = days[idx];
                return (
                  <View key={label} style={styles.dayChip}>
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
                numberOfLines={1}
              >
                {copy.cta}
              </ThemedText>
              <IconSymbol name="chevron.right" size={13} color={ACCENT_PURPLE} />
            </View>
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    letterSpacing: 0.1,
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
    letterSpacing: 0.2,
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
    letterSpacing: 0.1,
  },
});
