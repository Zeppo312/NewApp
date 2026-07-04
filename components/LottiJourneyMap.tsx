/**
 * LottiJourneyMap — kleine, sanfte Reise-Welt statt technischer Timeline.
 *
 * Die Karte rendert alle Stufen in einem eigenen vertikalen Scrollbereich.
 * Beim Oeffnen liegt die aktuelle Stufe im Fokus, danach kann man die Reise
 * nach oben und unten erkunden.
 *
 * Der Pfad bleibt bewusst weich: breite cremefarbene Grundspur, dezente lila
 * Spur fuer erreichte Abschnitte, Glow nur am aktuellen Moment.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
} from 'react-native-svg';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { LOTTI_LEVELS, type LottiLevel } from '@/lib/lottiPoints';

const ACCENT_PURPLE = '#5E3DB3';
const BROWN = '#5C4033';
const BROWN_SOFT = '#7D5A50';
const CREAM = '#FBF5EA';
const PATH_CREAM = '#FFFDF7';
const PAST_TRACK = 'rgba(94, 61, 179, 0.34)';
const PAST_TRACK_CORE = 'rgba(94, 61, 179, 0.58)';
const CARD_BORDER = 'rgba(255, 255, 255, 0.72)';
const POINTS_NOUN = 'Lotti-Herzen';

const STATION_SPACING = 118;
const TOP_PAD = 120;
const BOTTOM_PAD = 170;
const START_STATION_PULL_UP = 54;
const PATH_LENGTH_ESTIMATE = 5200;
const X_PATTERN = [0.60, 0.32, 0.66, 0.38, 0.61, 0.34, 0.56];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DEFAULT_MAP_WIDTH = Math.min(420, SCREEN_WIDTH - 32);
const MAP_VIEWPORT_HEIGHT = Math.min(700, Math.max(540, SCREEN_HEIGHT * 0.68));

const AnimatedPath = Animated.createAnimatedComponent(Path);

const LEVEL_BABY_IMAGES: ImageSourcePropType[] = [
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

type StationState = 'past' | 'current' | 'next' | 'future';

export type LottiAvatarState =
  | ImageSourcePropType
  | {
      image?: ImageSourcePropType;
      levelJustIncreased?: boolean;
      mood?: 'calm' | 'happy' | 'sleepy';
    };

type Props = {
  levels?: readonly LottiLevel[];
  currentLevel: number;
  totalPoints?: number;
  pointsToNext?: number;
  nextLevelName?: string | null;
  progressFraction?: number;
  avatarState?: LottiAvatarState;
  width?: number;
  onCollectPress?: () => void;
};

type JourneyStation = LottiLevel & {
  state: StationState;
};

export function LottiJourneyMap({
  levels = LOTTI_LEVELS,
  currentLevel,
  totalPoints = 0,
  pointsToNext = 0,
  nextLevelName,
  progressFraction = 0,
  avatarState,
  width: widthProp,
  onCollectPress,
}: Props) {
  const router = useRouter();
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : BROWN;
  const textSecondary = isDark ? Colors.dark.textSecondary : BROWN_SOFT;
  const textTertiary = isDark ? Colors.dark.textTertiary : '#9C8178';
  const width = widthProp ?? DEFAULT_MAP_WIDTH;

  const mapScrollRef = useRef<ScrollView>(null);
  const autoScrollKeyRef = useRef<string | null>(null);
  const autoScrollAttemptsRef = useRef(0);

  const avatarImage =
    avatarState && typeof avatarState === 'object' && 'image' in avatarState
      ? avatarState.image
      : avatarState && !isAvatarStateObject(avatarState)
        ? avatarState
        : undefined;
  const levelJustIncreased = isAvatarStateObject(avatarState)
    ? Boolean(avatarState.levelJustIncreased)
    : false;

  const journeyLevels: JourneyStation[] = useMemo(() => {
    const sorted = [...levels].sort((a, b) => a.level - b.level);
    return sorted
      .reverse()
      .map((level) => ({
        ...level,
        state:
          level.level < currentLevel
            ? 'past'
            : level.level === currentLevel
              ? 'current'
              : level.level === currentLevel + 1
                ? 'next'
                : 'future',
      }));
  }, [currentLevel, levels]);

  const positions = useMemo(
    () =>
      journeyLevels.map((level, index) => ({
        x: width * X_PATTERN[index % X_PATTERN.length],
        y:
          TOP_PAD +
          index * STATION_SPACING -
          (level.level === 1 ? START_STATION_PULL_UP : 0),
      })),
    [width, journeyLevels],
  );

  const totalHeight =
    TOP_PAD + (journeyLevels.length - 1) * STATION_SPACING + BOTTOM_PAD;
  const viewportHeight = Math.min(totalHeight, MAP_VIEWPORT_HEIGHT);
  const scrollContentHeight = totalHeight + viewportHeight * 0.58;
  const currentIndex = Math.max(
    0,
    journeyLevels.findIndex((level) => level.state === 'current'),
  );
  const currentLevelData = journeyLevels[currentIndex];

  const pathD = useMemo(() => buildPath(positions, positions.length - 1, 0), [positions]);
  const completedPathD = useMemo(
    () => buildPath(positions, positions.length - 1, currentIndex),
    [currentIndex, positions],
  );

  const drawAnim = useRef(new Animated.Value(PATH_LENGTH_ESTIMATE)).current;
  const appearAnim = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.45)).current;
  const avatarBounce = useRef(new Animated.Value(0.92)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const levelUpFlash = useRef(new Animated.Value(0)).current;

  const [selectedLevel, setSelectedLevel] = useState<LottiLevel | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawAnim, {
        toValue: 0,
        duration: 1350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(appearAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(avatarBounce, {
        toValue: 1,
        friction: 6,
        tension: 80,
        delay: 380,
        useNativeDriver: true,
      }),
    ]).start();
  }, [appearAnim, avatarBounce, drawAnim]);

  const scrollToCurrentStation = useCallback(() => {
    const currentY = positions[currentIndex]?.y ?? 0;
    const startStationY = positions[positions.length - 1]?.y ?? currentY;
    const startStationTargetY =
      currentLevel <= 8 ? startStationY - viewportHeight * 0.82 : 0;
    const targetY = Math.max(
      0,
      Math.min(
        scrollContentHeight - viewportHeight,
        Math.max(currentY - viewportHeight * 0.46, startStationTargetY),
      ),
    );
    const scrollKey = `${currentIndex}:${Math.round(targetY)}:${Math.round(scrollContentHeight)}:${Math.round(viewportHeight)}`;

    if (autoScrollKeyRef.current !== scrollKey) {
      autoScrollKeyRef.current = scrollKey;
      autoScrollAttemptsRef.current = 0;
    }

    if (autoScrollAttemptsRef.current >= 4) {
      return;
    }

    autoScrollAttemptsRef.current += 1;

    requestAnimationFrame(() => {
      mapScrollRef.current?.scrollTo({ y: targetY, animated: false });
    });

    setTimeout(() => {
      mapScrollRef.current?.scrollTo({ y: targetY, animated: false });
    }, 140);
  }, [currentIndex, currentLevel, positions, scrollContentHeight, viewportHeight]);

  useEffect(() => {
    autoScrollKeyRef.current = null;
    autoScrollAttemptsRef.current = 0;
    const timer = setTimeout(scrollToCurrentStation, 80);
    return () => clearTimeout(timer);
  }, [scrollToCurrentStation]);

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.13,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.78,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.45,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [glowOpacity, glowScale]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: clamp01(progressFraction),
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progressAnim, progressFraction]);

  useEffect(() => {
    if (!levelJustIncreased) return;
    Animated.sequence([
      Animated.timing(levelUpFlash, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(levelUpFlash, {
        toValue: 0,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [levelJustIncreased, levelUpFlash]);

  const handleCollect = () => {
    if (onCollectPress) {
      onCollectPress();
      return;
    }
    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <ThemedText adaptive={false} style={[styles.title, { color: textPrimary }]}>
          Eure Lotti-Reise
        </ThemedText>
        <ThemedText adaptive={false} style={[styles.subtitle, { color: textSecondary }]}>
          Jede Woche wächst ihr ein kleines Stück weiter.
        </ThemedText>
      </View>

      <BlurView
        {...(Platform.OS === 'android'
          ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
          : {})}
        intensity={22}
        tint={isDark ? 'dark' : 'light'}
        style={styles.worldBlur}
      >
        <ScrollView
          ref={mapScrollRef}
          style={[
            styles.worldScroll,
            {
              width,
              height: viewportHeight,
              backgroundColor: isDark
                ? 'rgba(24, 20, 28, 0.72)'
                : 'rgba(255, 250, 241, 0.72)',
              borderColor: isDark ? 'rgba(255,255,255,0.16)' : CARD_BORDER,
            },
          ]}
          contentContainerStyle={{ height: scrollContentHeight }}
          nestedScrollEnabled
          bounces
          showsVerticalScrollIndicator={false}
          onLayout={scrollToCurrentStation}
          onContentSizeChange={scrollToCurrentStation}
        >
          <View style={[styles.world, { width, height: scrollContentHeight }]}>
            <MapDecorations isDark={isDark} width={width} height={scrollContentHeight} />

            <Svg width={width} height={scrollContentHeight} style={StyleSheet.absoluteFill}>
              <Path
                d={pathD}
                stroke={isDark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.62)'}
                strokeWidth={30}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={pathD}
                stroke={isDark ? 'rgba(255,255,255,0.18)' : PATH_CREAM}
                strokeWidth={22}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={pathD}
                stroke={isDark ? 'rgba(255,255,255,0.09)' : 'rgba(94,61,179,0.08)'}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="4 13"
                fill="none"
              />
              {completedPathD ? (
                <>
                  <AnimatedPath
                    d={completedPathD}
                    stroke={PAST_TRACK}
                    strokeWidth={11}
                    strokeLinecap="round"
                    strokeDasharray={`${PATH_LENGTH_ESTIMATE}`}
                    strokeDashoffset={drawAnim}
                    fill="none"
                  />
                  <AnimatedPath
                    d={completedPathD}
                    stroke={PAST_TRACK_CORE}
                    strokeWidth={4.5}
                    strokeLinecap="round"
                    strokeDasharray={`${PATH_LENGTH_ESTIMATE}`}
                    strokeDashoffset={drawAnim}
                    fill="none"
                  />
                </>
              ) : null}
            </Svg>

            {journeyLevels.map((level, index) => (
              <JourneyStationNode
                key={level.level}
                station={level}
                position={positions[index]}
                width={width}
                index={index}
                currentIndex={currentIndex}
                avatarImage={avatarImage}
                appearAnim={appearAnim}
                glowScale={glowScale}
                glowOpacity={glowOpacity}
                avatarBounce={avatarBounce}
                levelUpFlash={levelUpFlash}
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                textTertiary={textTertiary}
                onPress={() => setSelectedLevel(level)}
              />
            ))}
          </View>
        </ScrollView>
      </BlurView>

      <JourneyCompassCard
        level={currentLevelData}
        totalPoints={totalPoints}
        pointsToNext={pointsToNext}
        nextLevelName={nextLevelName}
        progressFraction={progressFraction}
        progressAnim={progressAnim}
        isDark={isDark}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        textTertiary={textTertiary}
        onPress={handleCollect}
      />

      <LevelDetailSheet
        level={selectedLevel}
        currentLevel={currentLevel}
        onClose={() => setSelectedLevel(null)}
        isDark={isDark}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        textTertiary={textTertiary}
      />
    </View>
  );
}

function buildPath(
  points: { x: number; y: number }[],
  startIndex: number,
  endIndex: number,
) {
  if (!points.length || startIndex < endIndex) return '';
  const start = points[startIndex];
  let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
  for (let index = startIndex - 1; index >= endIndex; index--) {
    const previous = points[index + 1];
    const current = points[index];
    const midY = (previous.y + current.y) / 2;
    d += ` C ${previous.x.toFixed(2)} ${midY.toFixed(2)}, ${current.x.toFixed(2)} ${midY.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }
  return d;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function babyImageForLevel(level: number) {
  return LEVEL_BABY_IMAGES[(Math.max(1, level) - 1) % LEVEL_BABY_IMAGES.length];
}

function isAvatarStateObject(
  avatarState: LottiAvatarState | undefined,
): avatarState is Exclude<LottiAvatarState, ImageSourcePropType> {
  return (
    typeof avatarState === 'object' &&
    avatarState !== null &&
    ('image' in avatarState ||
      'levelJustIncreased' in avatarState ||
      'mood' in avatarState)
  );
}

function JourneyStationNode({
  station,
  position,
  width,
  index,
  currentIndex,
  avatarImage,
  appearAnim,
  glowScale,
  glowOpacity,
  avatarBounce,
  levelUpFlash,
  isDark,
  textPrimary,
  textSecondary,
  textTertiary,
  onPress,
}: {
  station: JourneyStation;
  position: { x: number; y: number };
  width: number;
  index: number;
  currentIndex: number;
  avatarImage?: ImageSourcePropType;
  appearAnim: Animated.Value;
  glowScale: Animated.Value;
  glowOpacity: Animated.Value;
  avatarBounce: Animated.Value;
  levelUpFlash: Animated.Value;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  onPress: () => void;
}) {
  const isCurrent = station.state === 'current';
  const isPast = station.state === 'past';
  const isNext = station.state === 'next';
  const isFuture = station.state === 'future';
  const stationSize = isCurrent ? 78 : isPast ? 50 : 48;
  const half = stationSize / 2;
  const labelOnLeft = position.x > width / 2;
  const nodeLeft = position.x - half;
  const sideGap = 14;
  const leftSpace = Math.max(0, nodeLeft - 16 - sideGap);
  const rightSpace = Math.max(0, width - (nodeLeft + stationSize) - 16 - sideGap);
  const currentMomentOnLeft = leftSpace >= rightSpace;
  const currentMomentAvailableWidth = currentMomentOnLeft ? leftSpace : rightSpace;
  const currentMomentWidth = Math.max(
    132,
    Math.min(218, currentMomentAvailableWidth),
  );
  const currentMomentLeft = currentMomentOnLeft
    ? -currentMomentWidth - sideGap
    : stationSize + sideGap;
  const labelWidth = isCurrent ? currentMomentWidth : 166;
  const translateY = appearAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14 + Math.abs(index - currentIndex) * 3, 0],
  });
  const nodeOpacity = appearAnim.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [0, 0.72, 1],
  });

  const pinBg = isCurrent
    ? ACCENT_PURPLE
    : isPast
      ? 'rgba(94, 61, 179, 0.92)'
      : isDark
        ? 'rgba(255,255,255,0.10)'
        : 'rgba(255,255,255,0.86)';
  const pinBorder = isCurrent || isPast
    ? 'rgba(255,255,255,0.96)'
    : isDark
      ? 'rgba(255,255,255,0.16)'
      : 'rgba(255,255,255,0.86)';
  const iconColor = isCurrent || isPast
    ? '#FFFFFF'
    : isNext
      ? ACCENT_PURPLE
      : isDark
        ? 'rgba(255,255,255,0.44)'
        : 'rgba(94,61,179,0.40)';
  const stationBabyImage = babyImageForLevel(station.level);
  const currentAvatarImage = avatarImage ?? stationBabyImage;

  return (
    <Animated.View
      style={[
        styles.node,
        {
          left: position.x - half,
          top: position.y - half,
          opacity: nodeOpacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {isCurrent ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.currentGlow,
              {
                width: stationSize + 42,
                height: stationSize + 42,
                borderRadius: (stationSize + 42) / 2,
                left: -21,
                top: -21,
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.levelUpStars,
              {
                opacity: levelUpFlash,
                transform: [
                  {
                    scale: levelUpFlash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.18],
                    }),
                  },
                ],
              },
            ]}
          >
            <ThemedText adaptive={false} style={styles.levelUpStarOne}>* </ThemedText>
            <ThemedText adaptive={false} style={styles.levelUpStarTwo}>♥</ThemedText>
            <ThemedText adaptive={false} style={styles.levelUpStarThree}>*</ThemedText>
          </Animated.View>
        </>
      ) : null}

      <Pressable onPress={onPress} hitSlop={10}>
        <Animated.View
          style={[
            styles.pin,
            {
              width: stationSize,
              height: stationSize,
              borderRadius: half,
              backgroundColor: pinBg,
              borderColor: pinBorder,
              borderWidth: isCurrent ? 4 : 2,
              opacity: isFuture ? 0.74 : 1,
            },
            isCurrent ? { transform: [{ scale: glowScale }] } : null,
          ]}
        >
          <View style={[styles.pinImageClip, { borderRadius: half }]}>
            <Image
              source={stationBabyImage}
              style={[
                styles.pinBabyImage,
                { opacity: isFuture ? 0.48 : isNext ? 0.72 : 1 },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.pinBabyTint,
                {
                  backgroundColor: isCurrent
                    ? 'rgba(94,61,179,0.10)'
                    : isPast
                      ? 'rgba(94,61,179,0.08)'
                      : isNext
                        ? 'rgba(255,255,255,0.36)'
                        : 'rgba(255,250,241,0.54)',
                },
              ]}
            />
          </View>
          {isCurrent ? (
            <View style={styles.pinMomentIcon}>
              <LineIcon level={station.level} color={iconColor} size={18} />
            </View>
          ) : null}
          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor: isCurrent || isPast ? '#FFFFFF' : ACCENT_PURPLE,
                borderColor: isCurrent || isPast ? ACCENT_PURPLE : '#FFFFFF',
              },
            ]}
          >
            <ThemedText
              adaptive={false}
              style={[
                styles.levelBadgeText,
                { color: isCurrent || isPast ? ACCENT_PURPLE : '#FFFFFF' },
              ]}
            >
              {station.level}
            </ThemedText>
          </View>
          {isPast ? (
            <View style={styles.reachedMark}>
              <ThemedText adaptive={false} style={styles.reachedMarkText}>
                ✓
              </ThemedText>
            </View>
          ) : null}
        </Animated.View>
      </Pressable>

      {isCurrent ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.currentMoment,
              {
                left: currentMomentLeft,
                top: 4,
                width: labelWidth,
                backgroundColor: isDark ? 'rgba(26,22,34,0.78)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.84)',
              },
            ]}
          >
            <ThemedText adaptive={false} style={styles.currentStatus}>
              Aktuell
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[styles.currentStage, { color: textTertiary }]}
            >
              Stufe {station.level}
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[styles.currentName, { color: textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.74}
            >
              {station.name}
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[styles.currentDescription, { color: textSecondary }]}
              numberOfLines={3}
            >
              {station.description}
            </ThemedText>
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarWrap,
              {
                left: labelOnLeft ? -76 : stationSize + 8,
                top: -58,
                transform: [{ scale: avatarBounce }],
              },
            ]}
          >
            <View style={styles.avatarBubble}>
              <Image source={currentAvatarImage} style={styles.avatarImage as any} />
            </View>
            <View style={styles.avatarToken}>
              <LineIcon level={12} size={13} color={ACCENT_PURPLE} />
            </View>
          </Animated.View>
        </>
      ) : (
        <View
          pointerEvents="none"
          style={[
            styles.stationLabel,
            {
              left: labelOnLeft ? -labelWidth - 9 : stationSize + 9,
              top: isPast ? 5 : 2,
              width: labelWidth,
              backgroundColor: isPast
                ? 'rgba(255,255,255,0.46)'
                : 'rgba(255,255,255,0.30)',
              borderColor: isPast
                ? 'rgba(255,255,255,0.66)'
                : 'rgba(255,255,255,0.42)',
            },
          ]}
        >
          <View style={styles.stationLabelRow}>
            <View style={styles.stationLabelImageWrap}>
              <Image
                source={stationBabyImage}
                style={[
                  styles.stationLabelImage,
                  { opacity: isFuture ? 0.52 : 1 },
                ]}
              />
            </View>
            <View style={styles.stationLabelCopy}>
              <ThemedText
                adaptive={false}
                style={[
                  styles.stationKicker,
                  {
                    color: isPast
                      ? ACCENT_PURPLE
                      : isNext
                        ? ACCENT_PURPLE
                        : textTertiary,
                    opacity: isFuture ? 0.72 : 1,
                  },
                ]}
              >
                {isPast ? 'Erreicht' : isNext ? 'Als Nächstes' : `Stufe ${station.level}`}
              </ThemedText>
              <ThemedText
                adaptive={false}
                style={[
                  styles.stationName,
                  {
                    color: isPast ? textPrimary : textSecondary,
                    opacity: isFuture ? 0.78 : 1,
                  },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {station.name}
              </ThemedText>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function JourneyCompassCard({
  level,
  totalPoints,
  pointsToNext,
  nextLevelName,
  progressFraction,
  progressAnim,
  isDark,
  textPrimary,
  textSecondary,
  textTertiary,
  onPress,
}: {
  level?: LottiLevel;
  totalPoints: number;
  pointsToNext: number;
  nextLevelName?: string | null;
  progressFraction: number;
  progressAnim: Animated.Value;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  onPress: () => void;
}) {
  if (!level) return null;
  const isMax = !nextLevelName;

  return (
    <BlurView
      {...(Platform.OS === 'android'
        ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
        : {})}
      intensity={28}
      tint={isDark ? 'dark' : 'light'}
      style={styles.compassBlur}
    >
      <View
        style={[
          styles.compassCard,
          {
            backgroundColor: isDark ? 'rgba(24,20,30,0.78)' : 'rgba(255,255,255,0.68)',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.82)',
          },
        ]}
      >
        <View style={styles.compassTop}>
          <View style={styles.compassIcon}>
            <LineIcon level={level.level} size={20} color={ACCENT_PURPLE} />
          </View>
          <View style={styles.compassCopy}>
            <ThemedText
              adaptive={false}
              style={[styles.compassTitle, { color: textPrimary }]}
              numberOfLines={1}
            >
              Stufe {level.level} · {level.name}
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[styles.compassSub, { color: textSecondary }]}
              numberOfLines={2}
            >
              {isMax
                ? `${totalPoints} ${POINTS_NOUN} gesammelt`
                : `Noch ${pointsToNext} ${POINTS_NOUN} bis „${nextLevelName}“`}
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.compassTrack,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.10)'
                : 'rgba(94,61,179,0.12)',
            },
          ]}
        >
          <Animated.View
            style={[
              styles.compassFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.compassBottom}>
          <ThemedText
            adaptive={false}
            style={[styles.compassMeta, { color: textTertiary }]}
          >
            {Math.round(clamp01(progressFraction) * 100)}% dieses Moments
          </ThemedText>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.collectButton,
              { opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <ThemedText adaptive={false} style={styles.collectButtonText}>
              Weiter sammeln
            </ThemedText>
            <IconSymbol name="chevron.right" size={13} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </BlurView>
  );
}

function MapDecorations({
  isDark,
  width,
  height,
}: {
  isDark: boolean;
  width: number;
  height: number;
}) {
  const cloudColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.62)';
  const accent = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(94,61,179,0.14)';
  const decorationRows = Math.max(1, Math.floor(height / 560));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: decorationRows }).map((_, index) => {
        const top = index * 560;
        return (
          <React.Fragment key={index}>
            <View
              style={[
                styles.cloud,
                styles.cloudOne,
                { backgroundColor: cloudColor, left: width * 0.08, top: top + 88 },
              ]}
            />
            <View
              style={[
                styles.cloud,
                styles.cloudTwo,
                { backgroundColor: cloudColor, right: width * 0.05, top: top + 405 },
              ]}
            />
            <View
              style={[
                styles.starDot,
                styles.starDotOne,
                { backgroundColor: accent, top: top + 46 },
              ]}
            />
            <View
              style={[
                styles.starDot,
                styles.starDotTwo,
                { backgroundColor: accent, top: top + 272 },
              ]}
            />
            <View
              style={[
                styles.starDot,
                styles.starDotThree,
                { backgroundColor: accent, top: top + 486 },
              ]}
            />
            <View style={[styles.softMoon, { borderColor: accent, top: top + 190 }]} />
            <View style={[styles.weekCardDecor, { borderColor: accent, top: top + 372 }]} />
          </React.Fragment>
        );
      })}
    </View>
  );
}

function LineIcon({
  level,
  size,
  color,
}: {
  level: number;
  size: number;
  color: string;
}) {
  const kind = iconKindForLevel(level);
  const strokeWidth = 2.1;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'heart' ? (
        <Path
          d="M12 20s-7-4.4-8.8-9.1C2 7.7 3.8 5 6.8 5c1.8 0 3.1 1 3.9 2.2C11.5 6 12.8 5 14.6 5c3 0 4.8 2.7 3.6 5.9C16.5 15.6 12 20 12 20z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
      {kind === 'star' ? (
        <Path
          d="M12 3.8l2.2 4.5 5 .7-3.6 3.5.9 4.9-4.5-2.3-4.5 2.3.9-4.9L4.8 9l5-.7L12 3.8z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
      {kind === 'feet' ? (
        <>
          <Path d="M8 13.2c-1.8.4-2.7 2.2-2.1 4 .5 1.5 2 2.5 3.4 2.1 1.8-.5 2.1-2.7 1.5-4.3-.5-1.4-1.4-2.1-2.8-1.8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M16 10.6c1.8.4 2.7 2.2 2.1 4-.5 1.5-2 2.5-3.4 2.1-1.8-.5-2.1-2.7-1.5-4.3.5-1.4 1.4-2.1 2.8-1.8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx="7.6" cy="6" r="1.1" fill={color} />
          <Circle cx="10.4" cy="7" r="1" fill={color} />
          <Circle cx="16.3" cy="4.9" r="1.1" fill={color} />
          <Circle cx="13.5" cy="6" r="1" fill={color} />
        </>
      ) : null}
      {kind === 'sprout' ? (
        <>
          <Path d="M12 20V9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Path d="M12 10c-3.8-.3-5.7-2.1-6.2-5.1 3.5.1 5.7 1.8 6.2 5.1z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M12 12c4-.2 6-1.9 6.7-5.1-3.7 0-6 1.7-6.7 5.1z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : null}
      {kind === 'book' ? (
        <>
          <Path d="M4.5 5.2c2.8-.8 5-.2 7.5 1.3v12.3c-2.5-1.5-4.7-2-7.5-1.3V5.2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M19.5 5.2c-2.8-.8-5-.2-7.5 1.3v12.3c2.5-1.5 4.7-2 7.5-1.3V5.2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : null}
      {kind === 'home' ? (
        <>
          <Path d="M4 11.3L12 5l8 6.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M6.4 10.4v8.2h11.2v-8.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M10 18.6v-4.3h4v4.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : null}
      {kind === 'chest' ? (
        <>
          <Rect x="4.4" y="9" width="15.2" height="9.2" rx="2" stroke={color} strokeWidth={strokeWidth} fill="none" />
          <Path d="M7 9V7.8C7 6 8.5 4.5 10.3 4.5h3.4C15.5 4.5 17 6 17 7.8V9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <Line x1="4.4" y1="13" x2="19.6" y2="13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Rect x="10.2" y="11.4" width="3.6" height="3.2" rx="0.8" stroke={color} strokeWidth={strokeWidth} fill="none" />
        </>
      ) : null}
      {kind === 'moon' ? (
        <Path
          d="M17.8 16.7A8 8 0 0 1 7.3 6.2 7.2 7.2 0 1 0 17.8 16.7z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
      {kind === 'card' ? (
        <>
          <Rect x="4.5" y="6.2" width="15" height="11.6" rx="2.2" stroke={color} strokeWidth={strokeWidth} fill="none" />
          <Line x1="8" y1="10" x2="16" y2="10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="8" y1="13.5" x2="13.5" y2="13.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      ) : null}
      {kind === 'rhythm' ? (
        <>
          <Circle cx="12" cy="12" r="7.5" stroke={color} strokeWidth={strokeWidth} fill="none" />
          <Polyline points="7.7,12.4 10.1,12.4 11.2,9.6 13,15 14.3,12.4 16.4,12.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : null}
    </Svg>
  );
}

function iconKindForLevel(level: number) {
  if (level === 1) return 'feet';
  if (level === 3) return 'sprout';
  if (level === 6 || level === 14 || level === 26) return 'star';
  if (level === 7 || level === 17) return 'card';
  if (level === 10 || level === 12 || level === 21) return level === 12 ? 'rhythm' : 'heart';
  if (level === 13 || level === 24 || level === 27) return 'home';
  if (level === 15 || level === 28 || level === 29) return 'book';
  if (level === 16 || level === 23 || level === 30) return 'chest';
  if (level === 20) return 'moon';
  return 'heart';
}

type SheetProps = {
  level: LottiLevel | null;
  currentLevel: number;
  onClose: () => void;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
};

function LevelDetailSheet({
  level,
  currentLevel,
  onClose,
  isDark,
  textPrimary,
  textSecondary,
  textTertiary,
}: SheetProps) {
  if (!level) {
    return (
      <Modal visible={false} transparent animationType="slide">
        <View />
      </Modal>
    );
  }

  const stateLabel =
    level.level < currentLevel
      ? 'Erreicht'
      : level.level === currentLevel
        ? 'Aktuell'
        : 'Als Nächstes';
  const stateMessage =
    level.level < currentLevel
      ? 'Diese Station gehört schon zu eurer Reise.'
      : level.level === currentLevel
        ? 'Hier seid ihr gerade.'
        : 'Mit jedem kleinen Moment kommt ihr ein Stück näher.';
  const sheetBabyImage = babyImageForLevel(level.level);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetWrapper}>
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
                  backgroundColor: isDark ? 'rgba(24,20,30,0.88)' : 'rgba(255,255,255,0.94)',
                  borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.82)',
                },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetIcon}>
                  <Image source={sheetBabyImage} style={styles.sheetIconImage as any} />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.sheetIconTint,
                      {
                        backgroundColor:
                          level.level <= currentLevel
                            ? 'rgba(94,61,179,0.08)'
                            : 'rgba(255,250,241,0.48)',
                      },
                    ]}
                  />
                  <View style={styles.sheetIconToken}>
                    <LineIcon level={level.level} size={13} color={ACCENT_PURPLE} />
                  </View>
                </View>
                <View style={styles.sheetHeaderText}>
                  <ThemedText adaptive={false} style={styles.sheetState}>
                    Stufe {level.level} · {stateLabel}
                  </ThemedText>
                  <ThemedText adaptive={false} style={[styles.sheetTitle, { color: textPrimary }]}>
                    {level.name}
                  </ThemedText>
                </View>
              </View>
              <ThemedText adaptive={false} style={[styles.sheetDescription, { color: textPrimary }]}>
                {level.description}
              </ThemedText>
              <ThemedText adaptive={false} style={[styles.sheetFootnote, { color: textSecondary }]}>
                {stateMessage}
              </ThemedText>
              <ThemedText adaptive={false} style={[styles.sheetThreshold, { color: textTertiary }]}>
                ab {level.threshold} {POINTS_NOUN}
              </ThemedText>
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

const styles = StyleSheet.create({
  root: {
    gap: 14,
    marginBottom: 20,
  },
  heading: {
    paddingHorizontal: 2,
    gap: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  worldBlur: {
    alignSelf: 'center',
    borderRadius: 30,
    overflow: 'hidden',
  },
  worldScroll: {
    borderRadius: 30,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  world: {
    position: 'relative',
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    width: 72,
    height: 28,
    borderRadius: 18,
  },
  cloudOne: {
    transform: [{ rotate: '-8deg' }],
  },
  cloudTwo: {
    width: 84,
    opacity: 0.7,
    transform: [{ rotate: '7deg' }],
  },
  starDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  starDotOne: {
    right: 50,
  },
  starDotTwo: {
    left: 38,
  },
  starDotThree: {
    right: 68,
  },
  softMoon: {
    position: 'absolute',
    right: 34,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    opacity: 0.55,
  },
  weekCardDecor: {
    position: 'absolute',
    left: 38,
    width: 28,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    opacity: 0.55,
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
  },
  currentGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(94, 61, 179, 0.20)',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
  },
  levelUpStars: {
    position: 'absolute',
    width: 130,
    height: 110,
    left: -26,
    top: -34,
  },
  levelUpStarOne: {
    position: 'absolute',
    left: 10,
    top: 12,
    color: ACCENT_PURPLE,
    fontSize: 17,
    fontWeight: '900',
  },
  levelUpStarTwo: {
    position: 'absolute',
    right: 22,
    top: 5,
    color: ACCENT_PURPLE,
    fontSize: 16,
    fontWeight: '900',
  },
  levelUpStarThree: {
    position: 'absolute',
    right: 6,
    bottom: 18,
    color: ACCENT_PURPLE,
    fontSize: 15,
    fontWeight: '900',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 5,
  },
  pinImageClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  pinBabyImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  pinBabyTint: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  pinMomentIcon: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94,61,179,0.74)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  levelBadge: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    fontSize: 10.5,
    lineHeight: 12,
    fontWeight: '900',
    includeFontPadding: false,
  },
  reachedMark: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: ACCENT_PURPLE,
  },
  reachedMarkText: {
    color: ACCENT_PURPLE,
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '900',
    includeFontPadding: false,
  },
  stationLabel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  stationLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stationLabelImageWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: CREAM,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.86)',
  },
  stationLabelImage: {
    width: '100%',
    height: '100%',
  },
  stationLabelCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  stationKicker: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  stationName: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  currentMoment: {
    position: 'absolute',
    zIndex: 1,
    borderRadius: 20,
    borderWidth: 1.2,
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 3,
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  currentStatus: {
    alignSelf: 'flex-start',
    color: ACCENT_PURPLE,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  currentStage: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  currentName: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  currentDescription: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  avatarWrap: {
    position: 'absolute',
    zIndex: 4,
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBubble: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 11,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarToken: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(94,61,179,0.30)',
  },
  compassBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  compassCard: {
    borderRadius: 24,
    borderWidth: 1.4,
    padding: 15,
    gap: 12,
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 3,
  },
  compassTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  compassIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94,61,179,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.16)',
  },
  compassCopy: {
    flex: 1,
    minWidth: 0,
  },
  compassTitle: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: 0,
  },
  compassSub: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  compassTrack: {
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  compassFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: ACCENT_PURPLE,
  },
  compassBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compassMeta: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  collectButton: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: ACCENT_PURPLE,
  },
  collectButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    lineHeight: 15,
    fontWeight: '800',
  },
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
    gap: 13,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(94,61,179,0.24)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: CREAM,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sheetIconImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  sheetIconTint: {
    ...StyleSheet.absoluteFill,
  },
  sheetIconToken: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.4,
    borderColor: 'rgba(94,61,179,0.30)',
  },
  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sheetState: {
    color: ACCENT_PURPLE,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sheetDescription: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  sheetFootnote: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  sheetThreshold: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
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
});
