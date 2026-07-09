// Premium-Bereich auf dem Home-Screen — bewusst KEIN Listen-/Kachel-Look:
// ein dunkles, sattes Lila-Panel mit lebendigen Details (wandernder
// Glanz-Sweep, funkelnde Sterne, atmende Icon-Glows) und den Features als
// große, einladende Buttons nebeneinander.
//
// Animationen laufen komplett über den nativen Driver (nur transform/opacity).

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface PremiumHighlightItem {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface Props {
  items: PremiumHighlightItem[];
}

const PANEL_GRADIENT = ['#3B2566', '#5A3A9E', '#7A4FC9'] as [string, string, string];
const GOLD = '#F2CE88';

/** Funkel-Sterne: Position (in %), Größe und Animations-Timing je Stern. */
const SPARKLES = [
  { left: 8, top: 12, size: 12, duration: 2600, delay: 0 },
  { left: 88, top: 18, size: 10, duration: 3100, delay: 600 },
  { left: 72, top: 6, size: 8, duration: 2300, delay: 1200 },
  { left: 16, top: 78, size: 9, duration: 2900, delay: 300 },
  { left: 92, top: 70, size: 11, duration: 2500, delay: 900 },
] as const;

const Sparkle: React.FC<(typeof SPARKLES)[number]> = ({ left, top, size, duration, delay }) => {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(glow, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, glow]);

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.sparkle,
        {
          left: `${left}%`,
          top: `${top}%`,
          fontSize: size,
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.95] }),
          transform: [
            { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) },
          ],
        },
      ]}
    >
      ✦
    </Animated.Text>
  );
};

const FeatureButton: React.FC<{ item: PremiumHighlightItem; pulseDelay: number }> = ({
  item,
  pulseDelay,
}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(pulseDelay),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseDelay]);

  const animatePress = (toValue: number) =>
    Animated.spring(pressScale, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={item.onPress}
      onPressIn={() => animatePress(0.96)}
      onPressOut={() => animatePress(1)}
      style={styles.featureTouchable}
    >
      <Animated.View style={[styles.featureButton, { transform: [{ scale: pressScale }] }]}>
        <View style={styles.featureIconWrap}>
          <Animated.View
            style={[
              styles.featureIconGlow,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
                ],
              },
            ]}
          />
          <Text style={styles.featureEmoji}>{item.emoji}</Text>
        </View>
        <Text style={styles.featureTitle}>{item.title}</Text>
        <Text style={styles.featureSubtitle} numberOfLines={2}>
          {item.subtitle}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const PremiumHighlights: React.FC<Props> = ({ items }) => {
  const { width } = useWindowDimensions();
  const shimmer = useRef(new Animated.Value(0)).current;

  // Glanz-Sweep: schmaler Lichtstreifen wandert alle paar Sekunden übers Panel.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(3200),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  if (items.length === 0) return null;

  const sweepTravel = width; // großzügig: von links raus bis rechts raus

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={PANEL_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.panel}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmerStrip,
            {
              transform: [
                {
                  translateX: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-160, sweepTravel],
                  }),
                },
                { rotate: '18deg' },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.16)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {SPARKLES.map((sparkle) => (
          <Sparkle key={`${sparkle.left}-${sparkle.top}`} {...sparkle} />
        ))}

        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Lotti <Text style={styles.headerTitleAccent}>Premium</Text>
          </Text>
          <Text style={styles.headerSubtitle}>Exklusiv für dich freigeschaltet</Text>
        </View>

        <View style={styles.featureRow}>
          {items.map((item, index) => (
            <FeatureButton key={item.key} item={item} pulseDelay={index * 700} />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 28,
    shadowColor: '#3B2566',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  panel: {
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  shimmerStrip: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 120,
  },
  sparkle: {
    position: 'absolute',
    color: GOLD,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  headerTitleAccent: {
    color: GOLD,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 3,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
  },
  featureTouchable: {
    flex: 1,
  },
  featureButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  featureIconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureIconGlow: {
    // Kein absoluteFillObject — in RN 0.86 entfernt (zur Laufzeit undefined).
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(242,206,136,0.45)',
  },
  featureEmoji: {
    fontSize: 30,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  featureSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default PremiumHighlights;
