import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import {
  GLASS_BORDER,
  GLASS_OVERLAY,
  LAYOUT_PAD,
  PRIMARY,
  TEXT_PRIMARY,
} from '@/constants/PlannerDesign';

type Props = {
  title: string;
  subline?: string;
  emoji?: string;
};

export const GreetingCard: React.FC<Props> = ({
  title,
  subline = 'Schön, dass du da bist.',
  emoji = '☀️',
}) => {
  // Animationen
  const introAnim = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Card fährt weich rein
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Emoji "atmet"
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(emojiScale, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(emojiScale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [introAnim, emojiScale]);

  const introStyle = {
    opacity: introAnim,
    transform: [
      {
        translateY: introAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View style={introStyle}>
      <LiquidGlassCard
        style={styles.card}
        overlayColor={GLASS_OVERLAY}
        borderColor={GLASS_BORDER}
        intensity={28}
      >
        {/* weicher Verlauf im Hintergrund */}
        <LinearGradient
          colors={[
            'rgba(94,61,179,0.18)',
            'rgba(255,255,255,0.0)',
            'rgba(255,207,221,0.30)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />

        {/* kleine Deko-Bubbles */}
        <View style={styles.bubbleTopLeft} />
        <View style={styles.bubbleBottomRight} />

        <View
          style={styles.content}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`Begrüßung. ${title}.`}
        >
          {/* Text */}
          <View style={styles.textColumn}>
            <ThemedText style={styles.headline}>
              {title}{' '}
              <ThemedText style={styles.highlight}>💜</ThemedText>
            </ThemedText>

            {subline ? (
              <ThemedText
                style={styles.sub}
                lightColor={TEXT_PRIMARY}
                darkColor={TEXT_PRIMARY}
                numberOfLines={2}
              >
                {subline}
              </ThemedText>
            ) : null}
          </View>

          {/* Emoji-Bubble */}
          <Animated.View
            style={[styles.emojiWrapper, { transform: [{ scale: emojiScale }] }]}
            accessible
            accessibilityLabel="Stimmungs-Emoji"
          >
            <View style={styles.emojiGlow} />
            <View style={styles.emojiBubble}>
              <ThemedText style={styles.emoji}>{emoji}</ThemedText>
            </View>
          </Animated.View>
        </View>
      </LiquidGlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    width: '108%',
    marginHorizontal: -LAYOUT_PAD, // zieht bewusst über den Außen-Padding hinaus
    paddingHorizontal: LAYOUT_PAD + 24,
    paddingVertical: LAYOUT_PAD + 14,
    borderRadius: 36,
    minHeight: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bubbleTopLeft: {
    position: 'absolute',
    top: -18,
    left: -18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.4)',
    opacity: 0.45,
  },
  bubbleBottomRight: {
    position: 'absolute',
    bottom: -24,
    right: -18,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(94,61,179,0.30)',
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textColumn: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 44,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'left',
    color: TEXT_PRIMARY,
  },
  highlight: {
    color: PRIMARY,
  },
  sub: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.9,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    textAlign: 'left',
  },
  emojiWrapper: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(94,61,179,0.35)',
    opacity: 0.55,
  },
  emojiBubble: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1.6,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  emoji: {
    fontSize: 30,
    lineHeight: 34,
  },
});

export default GreetingCard;
