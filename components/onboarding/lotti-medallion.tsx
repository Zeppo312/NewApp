import React, { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { onboardingColors as brand } from './theme';

/** Lotti illustrations from the weekly moment, so the onboarding speaks the app's visual language. */
export const LOTTI = {
  bottle: require('@/assets/images/LottiBaby_Babys/1.jpg'),
  sleeping: require('@/assets/images/LottiBaby_Babys/2.jpg'),
  waving: require('@/assets/images/LottiBaby_Babys/5.jpg'),
  heart: require('@/assets/images/LottiBaby_Babys/6.jpg'),
  curious: require('@/assets/images/LottiBaby_Babys/7.jpg'),
  book: require('@/assets/images/LottiBaby_Babys/9.jpg'),
  teddy: require('@/assets/images/LottiBaby_Babys/10.jpg'),
  thumbsUp: require('@/assets/images/LottiBaby_Babys/11.jpg'),
  confetti: require('@/assets/images/LottiBaby_Babys/12.jpg'),
  night: require('@/assets/images/LottiBaby_Babys/15.jpg'),
  blanket: require('@/assets/images/LottiBaby_Babys/16.jpg'),
  kiss: require('@/assets/images/LottiBaby_Babys/17.jpg'),
  star: require('@/assets/images/LottiBaby_Babys/18.jpg'),
  bunny: require('@/assets/images/LottiBaby_Babys/20.jpg'),
  yawning: require('@/assets/images/LottiBaby_Babys/24.jpg'),
  thinking: require('@/assets/images/LottiBaby_Babys/25.jpg'),
  peeking: require('@/assets/images/LottiBaby_Babys/30.jpg'),
} satisfies Record<string, ImageSourcePropType>;
export type LottiPose = keyof typeof LOTTI;

const sizes = { hero: 176, regular: 128, small: 76 } as const;

export function LottiMedallion({ pose, size = 'regular', float = false, style }: {
  pose: LottiPose; size?: keyof typeof sizes | number; float?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const diameter = typeof size === 'number' ? size : sizes[size];
  const scale = useSharedValue(reduced ? 1 : 0.86);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    scale.value = withSpring(1, { damping: 13, stiffness: 160, reduceMotion: ReduceMotion.System });
    if (float) {
      lift.value = withDelay(500, withRepeat(withSequence(
        withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ), -1, false, undefined, ReduceMotion.System));
    }
  }, [float, lift, reduced, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { scale: scale.value }] }));
  return <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.wrap, animated, style]}>
    <View style={[styles.halo, { width: diameter + 22, height: diameter + 22, borderRadius: (diameter + 22) / 2 }]} />
    <View style={[styles.disc, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
      <Image source={LOTTI[pose]} style={[styles.image, { borderRadius: diameter / 2 }]} resizeMode="cover" />
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: brand.softAccent, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  disc: {
    // No overflow clipping here: iOS would cut off the shadow. The image rounds itself.
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)',
    boxShadow: '0 10px 28px rgba(94,61,179,0.16)',
  },
  image: { width: '100%', height: '100%' },
});
