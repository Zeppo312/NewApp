import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { OnboardingChapter } from '@/lib/onboarding-flow';
import { onboardingColors as brand } from './theme';

function Segment({ fill }: { fill: number }) {
  const progress = useSharedValue(fill);
  useEffect(() => {
    progress.value = withTiming(fill, { duration: 360, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System });
  }, [fill, progress]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <View style={styles.track}><Animated.View style={[styles.fill, animated]} /></View>;
}

/** One segment per chapter; the label names where the parent currently is. */
export function ChapterProgress({ chapters, label, accessibilityLabel, hidden = false }: {
  chapters: { key: OnboardingChapter; fill: number }[]; label: string | null; accessibilityLabel: string; hidden?: boolean;
}) {
  return <View accessible={!hidden} accessibilityElementsHidden={hidden} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} style={[styles.wrap, hidden && styles.hidden]}>
    <View style={styles.segments}>{chapters.map(chapter => <Segment key={chapter.key} fill={chapter.fill} />)}</View>
    <Text numberOfLines={1} style={[styles.label, !label && styles.hidden]}>{label ?? ' '}</Text>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 7, paddingTop: 2 },
  segments: { flexDirection: 'row', gap: 6 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(142,78,198,0.18)' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: brand.accent },
  label: { color: brand.accentText, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  hidden: { opacity: 0 },
});
