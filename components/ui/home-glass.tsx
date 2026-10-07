import React, { createContext, use, useRef, type ComponentProps, type RefObject } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView, type BlurViewProps } from 'expo-blur';
import { ThemedBackground } from '@/components/ThemedBackground';

const HomeBlurTarget = createContext<RefObject<View | null> | undefined>(undefined);

/** Share only the wallpaper as the blur source, never the cards themselves. */
export function HomeBackground({ children, style, ...props }: ComponentProps<typeof ThemedBackground>) {
  const blurTarget = useRef<View | null>(null);

  if (Platform.OS !== 'android') {
    return <ThemedBackground style={style} {...props}>{children}</ThemedBackground>;
  }

  return (
    <HomeBlurTarget value={blurTarget}>
      <View style={[styles.background, style]}>
        <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill} pointerEvents="none">
          <ThemedBackground {...props}>{null}</ThemedBackground>
        </BlurTargetView>
        {children}
      </View>
    </HomeBlurTarget>
  );
}

/** SDK 55+ requires an explicit target for Android blur. */
export function HomeGlassSurface(props: BlurViewProps) {
  const blurTarget = use(HomeBlurTarget);

  return (
    <BlurView
      {...props}
      {...(Platform.OS === 'android' ? {
        blurTarget,
        blurMethod: blurTarget ? 'dimezisBlurViewSdk31Plus' as const : 'none' as const,
        blurReductionFactor: 4,
      } : {})}
    />
  );
}

// Android elevation draws hard outlines around translucent, nested cards.
// A box shadow follows their rounded bounds without changing their z-order.
export const androidHomeShadow = Platform.OS === 'android' ? {
  elevation: 0,
  boxShadow: '0 4px 14px rgba(92, 64, 51, 0.10)',
} : {};

const styles = StyleSheet.create({
  background: { flex: 1, overflow: 'hidden' },
});
