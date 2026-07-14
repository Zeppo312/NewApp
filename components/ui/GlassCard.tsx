import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const TOKENS = {
  r: 22,
  frost: 'rgba(255,255,255,0.18)',
  border: 'rgba(255,255,255,0.70)',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function rgba(alpha: number) {
  return `rgba(255,255,255,${clamp01(alpha)})`;
}

function rgbaBlack(alpha: number) {
  return `rgba(0,0,0,${clamp01(alpha)})`;
}

type HighlightStrength = 'subtle' | 'default' | 'strong';

const HIGHLIGHT_ALPHA: Record<
  HighlightStrength,
  { h1: number; mid1: number; h2: number; mid2: number; h3: number; mid3: number }
> = {
  subtle: { h1: 0.55, mid1: 0.18, h2: 0.38, mid2: 0.12, h3: 0.18, mid3: 0.08 },
  default: { h1: 0.78, mid1: 0.26, h2: 0.52, mid2: 0.18, h3: 0.24, mid3: 0.1 },
  strong: { h1: 0.92, mid1: 0.34, h2: 0.66, mid2: 0.22, h3: 0.3, mid3: 0.12 },
};

function GlassHighlights({
  opacity = 1,
  strength = 'default',
}: {
  opacity?: number;
  strength?: HighlightStrength;
}) {
  const gradientPrefix = React.useRef(
    `glass-${Math.random().toString(36).slice(2, 10)}`
  ).current;
  const h1 = `${gradientPrefix}-h1`;
  const h2 = `${gradientPrefix}-h2`;
  const h3 = `${gradientPrefix}-h3`;
  const alpha = HIGHLIGHT_ALPHA[strength];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={h1} cx="25%" cy="18%" r="42%">
            <Stop offset="0%" stopColor={rgba(alpha.h1 * opacity)} />
            <Stop offset="38%" stopColor={rgba(alpha.mid1 * opacity)} />
            <Stop offset="100%" stopColor={rgba(0)} />
          </RadialGradient>

          <RadialGradient id={h2} cx="92%" cy="16%" r="52%">
            <Stop offset="0%" stopColor={rgba(alpha.h2 * opacity)} />
            <Stop offset="42%" stopColor={rgba(alpha.mid2 * opacity)} />
            <Stop offset="100%" stopColor={rgba(0)} />
          </RadialGradient>

          <RadialGradient id={h3} cx="62%" cy="112%" r="65%">
            <Stop offset="0%" stopColor={rgba(alpha.h3 * opacity)} />
            <Stop offset="46%" stopColor={rgba(alpha.mid3 * opacity)} />
            <Stop offset="100%" stopColor={rgba(0)} />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${h1})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${h2})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${h3})`} />
      </Svg>
    </View>
  );
}

function GlassGrain({
  opacity = 0.06,
  density = 60,
}: {
  opacity?: number;
  density?: number;
}) {
  const dots = React.useRef(
    Array.from({ length: density }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: 0.4 + Math.random() * 1.2,
      a: 0.35 + Math.random() * 0.65,
    }))
  ).current;

  if (opacity <= 0) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width="100%" height="100%">
        {dots.map((dot, index) => (
          <Circle
            key={`grain-${index}`}
            cx={`${dot.x}%`}
            cy={`${dot.y}%`}
            r={dot.r}
            fill={rgba(dot.a * opacity)}
          />
        ))}
      </Svg>
    </View>
  );
}

export function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 30,
  tint = 'light',
  frostColor = TOKENS.frost,
  toneColor,
  radius = TOKENS.r,
  borderWidth = 1.5,
  borderColor = TOKENS.border,
  innerBorderColor = 'rgba(255,255,255,0.30)',
  shadow = true,
  highlightOpacity = 1,
  highlightStrength = 'default',
  glossOpacity = 0.45,
  grainOpacity = 0.06,
  shadeOpacity = 1,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: BlurViewProps['tint'];
  frostColor?: string;
  toneColor?: string;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  innerBorderColor?: string;
  shadow?: boolean;
  highlightOpacity?: number;
  highlightStrength?: HighlightStrength;
  glossOpacity?: number;
  grainOpacity?: number;
  shadeOpacity?: number;
}) {
  const wrapStyle: ViewStyle = {
    borderRadius: radius,
    borderWidth,
    borderColor,
  };

  if (shadow) {
    Object.assign(wrapStyle, TOKENS.shadow);
  }

  const androidBlurProps: Partial<BlurViewProps> =
    Platform.OS === 'android'
      ? { experimentalBlurMethod: 'dimezisBlurView', blurReductionFactor: 1 }
      : {};

  return (
    <View style={[wrapStyle, style]}>
      <BlurView
        {...androidBlurProps}
        intensity={intensity}
        tint={tint}
        style={[styles.blur, { borderRadius: radius }]}
      >
        <View style={[styles.absoluteFill, { backgroundColor: frostColor }]} />
        {toneColor ? (
          <View style={[styles.absoluteFill, { backgroundColor: toneColor }]} />
        ) : null}

        <GlassHighlights opacity={highlightOpacity} strength={highlightStrength} />
        <GlassGrain opacity={grainOpacity} />

        {shadeOpacity > 0 ? (
          <LinearGradient
            pointerEvents="none"
            colors={[rgbaBlack(0), rgbaBlack(0.04 * shadeOpacity), rgbaBlack(0.12 * shadeOpacity)]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0.2 }}
            end={{ x: 0.92, y: 0.96 }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        {glossOpacity > 0 ? (
          <LinearGradient
            pointerEvents="none"
            colors={[rgba(0.55 * glossOpacity), rgba(0.18 * glossOpacity), rgba(0)]}
            locations={[0, 0.38, 1]}
            start={{ x: 0.02, y: 0.0 }}
            end={{ x: 0.9, y: 0.85 }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        {innerBorderColor ? (
          <View
            pointerEvents="none"
            style={[
              styles.absoluteFill,
              { borderRadius: radius, borderWidth: 1, borderColor: innerBorderColor },
            ]}
          />
        ) : null}

        <View style={[styles.content, contentStyle]}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  absoluteFill: StyleSheet.absoluteFillObject,
  content: {
    padding: 20,
  },
});
