// Mikrofon-Kreis für das Sprach-Logging: ein ruhiger, gefüllter Kreis mit
// Vektor-Icon — ohne Glas, Emoji oder harte Schatten. Beim Aufnehmen atmen
// zwei zarte Ringe im Sprechpegel, beim Verarbeiten kreist ein feiner Bogen.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { meteringToLevel } from '@/lib/voiceLog/metering';

export type VoiceOrbMode = 'idle' | 'listening' | 'thinking' | 'done';

type Props = {
  mode: VoiceOrbMode;
  size?: number;
  metering?: number | null;
  accent: string;
  isDark: boolean;
};

export const VoiceOrb: React.FC<Props> = ({ mode, size = 88, metering, accent, isDark }) => {
  const reducedMotion = useReducedMotion();
  const breathe = useSharedValue(0);
  const spin = useSharedValue(0);
  const level = useSharedValue(0);

  useEffect(() => {
    if (mode !== 'listening') {
      cancelAnimation(breathe);
      breathe.set(withTiming(0, { duration: 240 }));
      return;
    }
    if (reducedMotion) {
      breathe.set(0);
      return;
    }
    breathe.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    ));
    return () => cancelAnimation(breathe);
  }, [breathe, mode, reducedMotion]);

  useEffect(() => {
    if (mode !== 'thinking') {
      cancelAnimation(spin);
      spin.set(0);
      return;
    }
    spin.set(0);
    if (reducedMotion) return;
    spin.set(withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(spin);
  }, [mode, reducedMotion, spin]);

  useEffect(() => {
    const next = mode === 'listening' ? meteringToLevel(metering) : 0;
    level.set(withTiming(next, { duration: reducedMotion ? 320 : next > level.get() ? 110 : 260 }));
  }, [level, metering, mode, reducedMotion]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.get() * 0.01 + level.get() * 0.025 }],
  }));

  const ringInner = useAnimatedStyle(() => ({
    transform: [{ scale: 1.08 + level.get() * 0.1 }],
    opacity: 0.08 + level.get() * 0.08,
  }));

  const ringOuter = useAnimatedStyle(() => ({
    transform: [{ scale: 1.18 + level.get() * 0.16 }],
    opacity: 0.035 + level.get() * 0.045,
  }));

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.get()}deg` }],
  }));

  const isFilled = mode !== 'thinking';
  const iconName = mode === 'done' ? 'checkmark' : 'mic';
  const box = size * 1.26;

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {mode === 'listening' ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, backgroundColor: accent },
              ringOuter,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, backgroundColor: accent },
              ringInner,
            ]}
          />
        </>
      ) : null}

      {mode === 'thinking' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.arc,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
              borderTopColor: accent,
            },
            arcStyle,
          ]}
        />
      ) : null}

      <Animated.View
        style={[
          styles.core,
          {
            width: size * (isFilled ? 1 : 0.8),
            height: size * (isFilled ? 1 : 0.8),
            borderRadius: size,
            backgroundColor: isFilled ? accent : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          },
          coreStyle,
        ]}
      >
        <Ionicons
          name={iconName}
          size={size * (isFilled ? 0.34 : 0.28)}
          color={isFilled ? (isDark ? '#1A1024' : '#FFFFFF') : accent}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
  arc: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
