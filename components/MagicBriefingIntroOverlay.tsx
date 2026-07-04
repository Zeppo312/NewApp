/**
 * MagicBriefingIntroOverlay
 * -------------------------------------------------------------------
 * Premium-Intro für „Lottis Fürsorge". Fünf Glas-Chips (Schlaf,
 * Ernährung, Wetter, Routine, Wachstum) wirbeln kurz umeinander und
 * werden dann magisch zur Mitte zusammengezogen – dort entsteht ein
 * lila Glow/Pulse, bevor das Overlay weich ausblendet und die
 * Empfehlungskarte freigibt.
 *
 * Nutzt bewusst React Native Animated, damit das Intro ohne zusätzliche
 * Worklet-/JSI-Anforderungen stabil bleibt. Die Komponente ändert keinerlei
 * Datenquellen – reine UI/Animation.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const BRAND_PURPLE = '#5E3DB3';
const TEXT_PRIMARY = '#4A3A33';
const TEXT_SECONDARY = '#7D5A50';

const RING_RADIUS = 112;
const CHIP_W = 130;
const CHIP_H = 46;
const GLOW_SIZE = 240;

const TOPICS = [
  { emoji: '💤', label: 'Schlaf' },
  { emoji: '🍼', label: 'Ernährung' },
  { emoji: '🌤', label: 'Wetter' },
  { emoji: '🔁', label: 'Routine' },
  { emoji: '🌱', label: 'Wachstum' },
] as const;

type SharedSet = {
  enter: Animated.Value;
  swirl: Animated.Value;
  gather: Animated.Value;
};

/* Ein einzelner Glas-Chip auf seiner Kreisbahn. */
function Chip({ index, total, shared }: { index: number; total: number; shared: SharedSet }) {
  const baseAngle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const stagger = index * 0.08;
  const enter = shared.enter.interpolate({
    inputRange: [stagger, stagger + 0.5],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const gatherOpacity = shared.gather.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const opacity = Animated.multiply(enter, gatherOpacity);
  const scale = Animated.multiply(
    enter,
    shared.gather.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.3],
    }),
  );

  const x0 = Math.cos(baseAngle) * RING_RADIUS;
  const y0 = Math.sin(baseAngle) * RING_RADIUS;
  const x1 = Math.cos(baseAngle + 0.6) * RING_RADIUS;
  const y1 = Math.sin(baseAngle + 0.6) * RING_RADIUS;
  const swirlX = shared.swirl.interpolate({
    inputRange: [0, 1],
    outputRange: [x0, x1],
  });
  const swirlY = shared.swirl.interpolate({
    inputRange: [0, 1],
    outputRange: [y0, y1],
  });
  const gatherX = shared.gather.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const translateX = Animated.multiply(swirlX, gatherX);
  const translateY = Animated.multiply(swirlY, gatherX);

  return (
    <Animated.View
      style={[styles.chip, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}
      pointerEvents="none"
    >
      <Text style={styles.chipEmoji}>{TOPICS[index].emoji}</Text>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {TOPICS[index].label}
      </Text>
    </Animated.View>
  );
}

/* Lila Glow/Pulse, der beim Zusammenziehen in der Mitte aufleuchtet. */
function CenterGlow({ glow }: { glow: Animated.Value }) {
  const scale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1.25],
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow, transform: [{ scale }] }]}>
      <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
        <Defs>
          <RadialGradient id="mbio-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="rgba(94,61,179,0.55)" />
            <Stop offset="55%" stopColor="rgba(142,78,198,0.26)" />
            <Stop offset="100%" stopColor="rgba(142,78,198,0)" />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#mbio-glow)" />
      </Svg>
    </Animated.View>
  );
}

export interface MagicBriefingIntroOverlayProps {
  /** Wird aufgerufen, wenn das Overlay fertig ausgeblendet hat. */
  onFinish: () => void;
}

export function MagicBriefingIntroOverlay({ onFinish }: MagicBriefingIntroOverlayProps) {
  const enter = useRef(new Animated.Value(0)).current;
  const swirl = useRef(new Animated.Value(0)).current;
  const gather = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    swirl.setValue(0);
    gather.setValue(0);
    glow.setValue(0);
    overlay.setValue(0);

    const animation = Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(overlay, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1340),
        Animated.timing(overlay, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(swirl, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(1080),
        Animated.timing(gather, {
          toValue: 1,
          duration: 580,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(1260),
        Animated.timing(glow, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 360,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) onFinish();
    });

    return () => {
      animation.stop();
    };
  }, [enter, gather, glow, onFinish, overlay, swirl]);

  const captionOpacity = Animated.multiply(
    enter,
    gather.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
  );
  const captionTranslateY = gather.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const shared: SharedSet = { enter, swirl, gather };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlay }]}>
      <BlurView intensity={26} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.beige]} />

      <View style={styles.center}>
        <View style={styles.anchor}>
          <CenterGlow glow={glow} />
          {TOPICS.map((topic, i) => (
            <Chip key={topic.label} index={i} total={TOPICS.length} shared={shared} />
          ))}
          <Animated.Text
            style={[
              styles.caption,
              { opacity: captionOpacity, transform: [{ translateY: captionTranslateY }] },
            ]}
          >
            Lotti führt euren Tag zusammen …
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  beige: { backgroundColor: 'rgba(245,238,224,0.80)' },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchor: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },

  chip: {
    position: 'absolute',
    left: -CHIP_W / 2,
    top: -CHIP_H / 2,
    width: CHIP_W,
    height: CHIP_H,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: BRAND_PURPLE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  chipEmoji: { fontSize: 18 },
  chipLabel: { fontSize: 13.5, fontWeight: '700', color: TEXT_PRIMARY },

  glow: {
    position: 'absolute',
    left: -GLOW_SIZE / 2,
    top: -GLOW_SIZE / 2,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  caption: {
    position: 'absolute',
    top: 158,
    left: -130,
    width: 260,
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    letterSpacing: 0.2,
  },
});

export default MagicBriefingIntroOverlay;
