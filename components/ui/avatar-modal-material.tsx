import React, { useId } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { LavenderColors } from '@/constants/Colors';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import type { useAvatarModalMotion } from '@/hooks/useAvatarModalMotion';

const MotionPath = Animated.createAnimatedComponent(Path);
type Motion = ReturnType<typeof useAvatarModalMotion>;

/** Only two vector outlines move; blur and shadow stay fixed and crossfade in. */
export function AvatarModalMaterial({ isDark, shapeProps, materialStyle }: {
  isDark: boolean;
  shapeProps: Motion['shapeProps'];
  materialStyle: Motion['materialStyle'];
}) {
  const colors = LavenderColors[isDark ? 'dark' : 'light'];
  const reduceTransparency = useReduceTransparency();
  const gradientId = `avatar-glass-${useId().replace(/:/g, '')}`;
  return <>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blur, materialStyle]}>
      {Platform.OS !== 'android' && !reduceTransparency && <BlurView style={StyleSheet.absoluteFill} intensity={70} tint={isDark ? 'dark' : 'extraLight'} />}
    </Animated.View>
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" testID="baby-switcher-glass-shape">
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          {colors.gradient.map((color, index) => <Stop key={index} offset={`${index * 50}%`} stopColor={color} />)}
        </LinearGradient>
      </Defs>
      <MotionPath animatedProps={shapeProps} fill={colors.surface} />
      <MotionPath animatedProps={shapeProps} fill={`url(#${gradientId})`} stroke={colors.surfaceBorder} strokeWidth={1} />
    </Svg>
  </>;
}

const styles = StyleSheet.create({ blur: { borderRadius: 32, overflow: 'hidden' } });
