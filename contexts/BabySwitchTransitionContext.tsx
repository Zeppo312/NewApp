import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAuth } from '@/contexts/AuthContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { LavenderColors } from '@/constants/Colors';

type Transition = {
  isSwitching: boolean;
  runSwitch: (change: () => Promise<void> | void) => Promise<boolean>;
};

const BabySwitchTransitionContext = createContext<Transition>({
  isSwitching: false,
  runSwitch: async (change) => { await change(); return true; },
});

const nextPaint = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

/** Lives above the navigator so the reveal survives a home-screen replacement.
 * Native Modals present above this veil: the switcher itself never moves. */
export function BabySwitchTransitionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { effectiveScheme } = useAdaptiveColors();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [isSwitching, setIsSwitching] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  const animationId = useRef(0);
  const pending = useRef<{ id: number; resolve: (finished: boolean) => void } | null>(null);

  const settleAnimation = useCallback((id: number, finished: boolean) => {
    if (pending.current?.id !== id) return;
    const { resolve } = pending.current;
    pending.current = null;
    resolve(finished);
  }, []);

  const animate = useCallback((to: number, duration: number) => new Promise<boolean>((resolve) => {
    const id = ++animationId.current;
    pending.current = { id, resolve };
    progress.set(withTiming(to, {
      duration,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      reduceMotion: ReduceMotion.System,
    }, (finished) => { scheduleOnRN(settleAnimation, id, finished === true); }));
  }), [progress, settleAnimation]);

  useEffect(() => {
    // Auth is an external scope boundary; release an old account's interaction lock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSwitching(false);
    return () => {
      // An old account/unmounted navigator must not commit a queued switch.
      generation.current += 1;
      locked.current = false;
      cancelAnimation(progress);
      progress.set(0);
      const waiting = pending.current;
      pending.current = null;
      waiting?.resolve(false);
    };
  }, [progress, user?.id]);

  const runSwitch = useCallback(async (change: () => Promise<void> | void) => {
    if (locked.current) return false;
    locked.current = true;
    const revision = generation.current;
    setIsSwitching(true);
    try {
      // Cover first, change the underlying area, then reveal its first paint.
      if (!await animate(1, 120) || generation.current !== revision) return false;
      await change();
      if (generation.current !== revision) return false;
      await nextPaint();
      return generation.current === revision;
    } finally {
      if (generation.current === revision) {
        await animate(0, 180);
        if (generation.current === revision) {
          locked.current = false;
          setIsSwitching(false);
        }
      }
    }
  }, [animate]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: reducedMotion ? 1 : 1.035 - progress.get() * 0.035 }],
  }), [reducedMotion, progress]);
  const value = useMemo(() => ({ isSwitching, runSwitch }), [isSwitching, runSwitch]);

  return (
    <BabySwitchTransitionContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        <View
          pointerEvents={isSwitching ? 'auto' : 'none'}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, styles.veilFrame]}
        >
          <Animated.View
            testID="baby-switch-veil"
            pointerEvents={isSwitching ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, veilStyle]}
          >
            <LinearGradient
              colors={LavenderColors[effectiveScheme].transition}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </BabySwitchTransitionContext.Provider>
  );
}

export const useBabySwitchTransition = () => useContext(BabySwitchTransitionContext);

const styles = StyleSheet.create({ root: { flex: 1 }, veilFrame: { overflow: 'hidden' } });
