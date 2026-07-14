import React from 'react';
import { Image, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/IconSymbol';

const BRAND = '#5E3DB3';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function rgba(alpha: number) {
  return `rgba(255,255,255,${clamp01(alpha)})`;
}

function AvatarHighlights({ opacity = 1 }: { opacity?: number }) {
  const gradientId = React.useRef(
    `avatar-hl-${Math.random().toString(36).slice(2, 10)}`
  ).current;
  const shadeId = `${gradientId}-shade`;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={gradientId} cx="22%" cy="22%" r="40%">
            <Stop offset="0%" stopColor={rgba(0.8 * opacity)} />
            <Stop offset="48%" stopColor={rgba(0.24 * opacity)} />
            <Stop offset="100%" stopColor={rgba(0)} />
          </RadialGradient>
          <RadialGradient id={shadeId} cx="76%" cy="82%" r="55%">
            <Stop offset="0%" stopColor={`rgba(0,0,0,${clamp01(0.12 * opacity)})`} />
            <Stop offset="60%" stopColor={`rgba(0,0,0,${clamp01(0.06 * opacity)})`} />
            <Stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${shadeId})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

export function GlassAvatar({
  uri,
  size = 68,
  style,
  tint = 'light',
  intensity = 18,
  showStatusDot = true,
}: {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  tint?: BlurViewProps['tint'];
  intensity?: number;
  showStatusDot?: boolean;
}) {
  const radius = size / 2;
  const androidBlurProps: Partial<BlurViewProps> =
    Platform.OS === 'android'
      ? { experimentalBlurMethod: 'dimezisBlurView', blurReductionFactor: 1 }
      : {};

  return (
    <View style={[styles.outer, { width: size, height: size, borderRadius: radius }, style]}>
      <View style={[styles.glowRing, { borderRadius: radius }]} />
      <View style={[styles.glassRing, { borderRadius: radius }]} pointerEvents="none" />

      <View style={[styles.clip, { borderRadius: radius }]}>
        <BlurView
          {...androidBlurProps}
          intensity={intensity}
          tint={tint}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        />

        {uri ? (
          <>
            <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: radius, backgroundColor: 'rgba(94,61,179,0.10)' },
              ]}
            />
          </>
        ) : (
          <LinearGradient
            colors={['rgba(128, 88, 190, 0.85)', 'rgba(94, 61, 179, 0.45)']}
            start={{ x: 0.0, y: 0.0 }}
            end={{ x: 1.0, y: 1.0 }}
            style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}
          >
            <IconSymbol name="person.fill" size={30} color="#FFFFFF" />
          </LinearGradient>
        )}

        <View
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.14)' },
          ]}
        />
        <AvatarHighlights opacity={0.95} />
        <LinearGradient
          pointerEvents="none"
          colors={[rgba(0.5), rgba(0.12), rgba(0)]}
          locations={[0, 0.42, 1]}
          start={{ x: 0.05, y: 0.0 }}
          end={{ x: 0.9, y: 0.85 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.70)' },
          ]}
        />
      </View>

      {showStatusDot ? <View style={styles.statusDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'visible',
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(94,61,179,0.35)',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
  },
  glassRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.70)',
  },
  clip: {
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 6,
  },
});
