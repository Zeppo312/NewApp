/**
 * LottiWeekRing — Wochen-Progress als Ring um beliebige Children
 * (z. B. das BabySwitcherButton im Greeting).
 *
 * 7 Bogensegmente — eines pro Wochentag (Mo..So). Jeder Tag mit mindestens
 * einem Eintrag in einem Kernbereich (Essen, Pflege, Schlaf) füllt sein
 * Segment lila. Bei voller Woche (oder Sonntag mit ≥3 Tagen) gibt es einen
 * sanften Halo, sonst alles still.
 *
 * Bewusst keine Streak/XP/Level-Mechanik.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useLottiWeek } from '@/hooks/useLottiWeek';

const ACCENT_PURPLE = '#5E3DB3';

const DAY_COUNT = 7;
const GAP_DEG = 7;
const SEG_DEG = (360 - GAP_DEG * DAY_COUNT) / DAY_COUNT;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const arcPath = (
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) => {
  const [sx, sy] = polar(cx, cy, r, startDeg);
  const [ex, ey] = polar(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** Inhalt — typischerweise das Babyfoto / der BabySwitcherButton */
  children: React.ReactNode;
  /** Größe des Inhalts (Avatar). Der Ring wird drumherum gezeichnet. */
  contentSize: number;
  /** Abstand zwischen Inhalt und Ring (default 4) */
  inset?: number;
  /** Strichstärke des Rings (default 4.5) */
  ringStroke?: number;
  /** Style auf den äußeren Wrapper */
  style?: ViewStyle;
  /** Sanftes Atmen bei voller Woche aktivieren (default true) */
  pulseWhenComplete?: boolean;
};

export function LottiWeekRing({
  children,
  contentSize,
  inset = 4,
  ringStroke = 4.5,
  style,
  pulseWhenComplete = true,
}: Props) {
  const adaptiveColors = useAdaptiveColors();
  const { days, activeDays, todayIndex } = useLottiWeek();

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const arcEmptyColor = isDark
    ? 'rgba(255,255,255,0.18)'
    : 'rgba(94,61,179,0.16)';
  const haloColor = isDark
    ? 'rgba(142,104,220,0.30)'
    : 'rgba(94,61,179,0.22)';

  // Geometrie: Ring sitzt direkt außerhalb des Inhalts.
  // Outer canvas = contentSize + 2 * (inset + ringStroke + halo-padding)
  const haloPad = 6; // Platz für sanften Glow bei Voll
  const ringRadius = contentSize / 2 + inset + ringStroke / 2;
  const canvasSize = ringRadius * 2 + ringStroke + haloPad * 2;
  const center = canvasSize / 2;

  const isSundayToday = todayIndex === 6;
  const isWeekComplete =
    activeDays >= DAY_COUNT || (isSundayToday && activeDays >= 3);

  const segmentPaths = useMemo(() => {
    return Array.from({ length: DAY_COUNT }, (_, i) => {
      const segCenter = i * (SEG_DEG + GAP_DEG);
      const start = segCenter - SEG_DEG / 2;
      const end = segCenter + SEG_DEG / 2;
      return { i, d: arcPath(center, center, ringRadius, start, end) };
    });
  }, [center, ringRadius]);

  const segOpacity = useRef(
    Array.from({ length: DAY_COUNT }, () => new Animated.Value(0)),
  ).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    days.forEach((isOn, idx) => {
      Animated.timing(segOpacity[idx], {
        toValue: isOn ? 1 : 0,
        duration: 320,
        delay: isOn ? 60 * idx : 0,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [days, segOpacity]);

  useEffect(() => {
    Animated.timing(haloOpacity, {
      toValue: isWeekComplete ? 1 : 0,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (!isWeekComplete || !pulseWhenComplete) {
      haloScale.stopAnimation();
      haloScale.setValue(1);
      return;
    }

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(haloScale, {
          toValue: 1.04,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(haloScale, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [isWeekComplete, pulseWhenComplete, haloOpacity, haloScale]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          width: canvasSize,
          height: canvasSize,
          transform: [{ scale: haloScale }],
        },
        style,
      ]}
    >
      <Svg
        width={canvasSize}
        height={canvasSize}
        style={StyleSheet.absoluteFill}
      >
        <AnimatedCircle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={haloColor}
          strokeWidth={ringStroke + 6}
          fill="none"
          opacity={haloOpacity}
        />
        {segmentPaths.map((seg) => (
          <Path
            key={`bg-${seg.i}`}
            d={seg.d}
            stroke={arcEmptyColor}
            strokeWidth={ringStroke}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {segmentPaths.map((seg) => (
          <AnimatedPath
            key={`fill-${seg.i}`}
            d={seg.d}
            stroke={ACCENT_PURPLE}
            strokeWidth={ringStroke}
            strokeLinecap="round"
            fill="none"
            opacity={segOpacity[seg.i]}
          />
        ))}
      </Svg>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
