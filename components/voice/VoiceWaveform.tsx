// Live-Waveform für die Sprachaufnahme: schmale Balken reagieren auf den
// Mikrofonpegel (expo-audio Metering, dBFS) und ruhen im Leerlauf als
// gleichmäßige Linie — bewusst zurückhaltend.

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { meteringToLevel } from '@/lib/voiceLog/metering';

const BAR_COUNT = 25;
const BAR_WIDTH = 2.5;
const BAR_GAP = 3.5;
const MIN_HEIGHT = 2.5;

/** Glockenförmige Gewichtung: Mitte schlägt stärker aus als die Ränder. */
const buildWeights = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => {
    const center = (count - 1) / 2;
    const distance = Math.abs(index - center) / center;
    const bell = 1 - distance * distance * 0.8;
    // Kleine, deterministische Unregelmäßigkeit, damit es organisch wirkt.
    const jitter = 0.88 + (((index * 7919) % 23) / 23) * 0.24;
    return bell * jitter;
  });

type BarProps = {
  level: SharedValue<number>;
  weight: number;
  index: number;
  maxHeight: number;
  color: string;
  reducedMotion: boolean;
};

const WaveBar: React.FC<BarProps> = ({ level, weight, index, maxHeight, color, reducedMotion }) => {
  const idle = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(idle);
      idle.set(0);
      return;
    }
    idle.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 1100 + (index % 5) * 130, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100 + (index % 5) * 130, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    ));
    return () => cancelAnimation(idle);
  }, [idle, index, reducedMotion]);

  const style = useAnimatedStyle(() => {
    const breathing = MIN_HEIGHT + idle.get() * 1.5 * weight;
    const spoken = level.get() * weight * (maxHeight - MIN_HEIGHT);
    const height = Math.max(MIN_HEIGHT, Math.min(maxHeight, breathing + spoken));
    return {
      transform: [{ scaleY: height / maxHeight }],
      opacity: 0.24 + level.get() * 0.58,
    };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: maxHeight,
          backgroundColor: color,
          marginHorizontal: BAR_GAP / 2,
          borderRadius: BAR_WIDTH / 2,
        },
        style,
      ]}
    />
  );
};

type Props = {
  /** Aktueller Pegel in dBFS aus dem Recorder-Status (undefined = kein Metering). */
  metering: number | undefined | null;
  color: string;
  height?: number;
};

export const VoiceWaveform: React.FC<Props> = ({ metering, color, height = 36 }) => {
  const reducedMotion = useReducedMotion();
  const level = useSharedValue(0);
  const weights = useMemo(() => buildWeights(BAR_COUNT), []);

  useEffect(() => {
    // Schnell hoch, etwas langsamer runter — wirkt wie ein echter Pegelmesser.
    const next = meteringToLevel(metering);
    level.set(withTiming(next, {
      duration: reducedMotion ? 320 : next > level.get() ? 110 : 240,
      easing: Easing.out(Easing.quad),
    }));
  }, [level, metering, reducedMotion]);

  return (
    <View style={[styles.container, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {weights.map((weight, index) => (
        <WaveBar
          key={index}
          level={level}
          weight={weight}
          index={index}
          maxHeight={height}
          color={color}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bar: {
    width: BAR_WIDTH,
  },
});
