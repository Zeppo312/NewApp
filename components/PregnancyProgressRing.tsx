/**
 * PregnancyProgressRing — zeigt den Schwangerschaftsfortschritt (0–100 %)
 * als geschlossenen Ring um beliebige Children (z. B. den BabySwitcherButton).
 *
 * Gegenstück zum LottiWeekRing im Babymodus: statt sieben Tagessegmenten
 * ein einzelner Bogen, der mit der Schwangerschaft wächst.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

const ACCENT_PURPLE = '#5E3DB3';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  children: React.ReactNode;
  /** Fortschritt in Prozent (0–100) */
  percent: number;
  /** Größe des Inhalts (Avatar). Der Ring wird drumherum gezeichnet. */
  contentSize: number;
  /** Abstand zwischen Inhalt und Ring (default 4) */
  inset?: number;
  /** Strichstärke des Rings (default 4.5) */
  ringStroke?: number;
  style?: ViewStyle;
};

export function PregnancyProgressRing({
  children,
  percent,
  contentSize,
  inset = 4,
  ringStroke = 4.5,
  style,
}: Props) {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const trackColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(94,61,179,0.16)';

  const pad = 2;
  const ringRadius = contentSize / 2 + inset + ringStroke / 2;
  const canvasSize = ringRadius * 2 + ringStroke + pad * 2;
  const center = canvasSize / 2;
  const circumference = useMemo(() => 2 * Math.PI * ringRadius, [ringRadius]);

  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamped / 100,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.wrapper, { width: canvasSize, height: canvasSize }, style]}>
      <Svg width={canvasSize} height={canvasSize} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={trackColor}
          strokeWidth={ringStroke}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={ACCENT_PURPLE}
          strokeWidth={ringStroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', justifyContent: 'center' },
});
