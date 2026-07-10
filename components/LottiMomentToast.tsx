/**
 * LottiMomentToast — sehr leiser Mini-Banner.
 *
 * Wird nach dem Speichern eines Essens-/Pflege-/Schlaf-Eintrags kurz
 * eingeblendet ("Essensmoment zur Woche hinzugefügt 🍼"). Kein Konfetti,
 * kein Sound, keine Vibration, kein großer Effekt.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import {
  addLottiMomentListener,
  type LottiMomentCategory,
} from '@/lib/lottiMomentEvents';

const ACCENT_PURPLE = '#5E3DB3';
const SHOW_DURATION_MS = 2400;
const FADE_IN_MS = 220;
const FADE_OUT_MS = 260;

const COPY: Record<LottiMomentCategory, { emoji: string; text: string }> = {
  feeding: { emoji: '🍼', text: 'Essensmoment zur Woche hinzugefügt' },
  care: { emoji: '🤍', text: 'Pflegemoment zur Woche hinzugefügt' },
  sleep: { emoji: '🌙', text: 'Schlafmoment zur Woche hinzugefügt' },
};

type ActiveToast = {
  id: number;
  category: LottiMomentCategory;
};

export function LottiMomentToast() {
  const insets = useSafeAreaInsets();
  const adaptiveColors = useAdaptiveColors();
  const [active, setActive] = useState<ActiveToast | null>(null);

  const opacity = React.useState(() => new Animated.Value(0))[0];
  const translateY = React.useState(() => new Animated.Value(-6))[0];
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const containerBg = isDark
    ? 'rgba(0, 0, 0, 0.55)'
    : 'rgba(255, 255, 255, 0.85)';
  const containerBorder = isDark
    ? 'rgba(255, 255, 255, 0.18)'
    : 'rgba(94, 61, 179, 0.18)';

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -4,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setActive(null);
    });
  }, [opacity, translateY]);

  useEffect(() => {
    const sub = addLottiMomentListener((event) => {
      if (!event?.category) return;
      const id = Date.now();
      setActive({ id, category: event.category });
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    opacity.setValue(0);
    translateY.setValue(-6);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(dismiss, SHOW_DURATION_MS);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [active, dismiss, opacity, translateY]);

  if (!active) return null;

  const copy = COPY[active.category];

  return (
    <View
      pointerEvents="none"
      style={[styles.host, { paddingTop: insets.top + 8 }]}
    >
      <Animated.View
        style={[
          styles.toastWrap,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <BlurView
          {...(Platform.OS === 'android'
            ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
            : {})}
          intensity={28}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blur}
        >
          <View
            style={[
              styles.pill,
              { backgroundColor: containerBg, borderColor: containerBorder },
            ]}
          >
            <ThemedText adaptive={false} style={styles.emoji}>
              {copy.emoji}
            </ThemedText>
            <ThemedText
              adaptive={false}
              style={[styles.text, { color: textPrimary }]}
            >
              {copy.text}
            </ThemedText>
            <View style={[styles.dot, { backgroundColor: ACCENT_PURPLE }]} />
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toastWrap: {
    maxWidth: '92%',
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  blur: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 16,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
});
