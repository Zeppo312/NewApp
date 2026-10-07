import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { HomeGlassSurface, androidHomeShadow } from '@/components/ui/home-glass';
import { ThemedText } from '@/components/ThemedText';
import { HomeOverviewHeading } from '@/components/ui/home-overview';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { Colors } from '@/constants/Colors';
import { translatePregnancyHomeText } from '@/lib/pregnancyHomeTranslations';
import { translateHomeText } from '@/lib/homeTranslations';
import type { AppLocale } from '@/lib/localization';

export const DEFAULT_OVERVIEW_HEIGHT = 230;
export function useOverviewColors() {
  const colors = useAdaptiveColors();
  const dark = colors.effectiveScheme === 'dark' || colors.isDarkBackground;
  return { dark, tint: colors.effectiveScheme === 'dark' ? 'dark' as const : 'light' as const,
    text: dark ? Colors.dark.textSecondary : '#7D5A50', accent: dark ? Colors.dark.textAccent : '#5E3DB3',
    blur: dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)', fill: dark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.04)' };
}

/** All Home slides use the numbers card's material and padding. */
export function OverviewCard({ children, height, compact = false, onPress, onLayout, testID }: {
  children: React.ReactNode; height?: number; compact?: boolean; onPress?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void; testID?: string;
}) {
  const c = useOverviewColors();
  const content = <HomeGlassSurface intensity={22} tint={c.tint}
    style={[styles.background, { backgroundColor: c.blur }, height !== undefined && { flex: 1 }]}>
    <View style={[styles.container, { padding: compact ? 16 : 20, backgroundColor: c.fill }, height !== undefined && { flex: 1 }]}>{children}</View>
  </HomeGlassSurface>;
  const outer = [styles.wrapper, height !== undefined && { height }];
  return onPress ? <TouchableOpacity activeOpacity={0.9} accessibilityRole="button" onPress={onPress} onLayout={onLayout} style={outer} testID={testID}>{content}</TouchableOpacity> :
    <View onLayout={onLayout} style={outer} testID={testID}>{content}</View>;
}
/** Preserve the original numbers card as the natural-height reference for all slides. */
export function PregnancyNumbersSlide({ locale, currentWeek, progress, compact = false, stacked = false, onPress, onLayout }: {
  locale: AppLocale; currentWeek: number | null; progress: number; compact?: boolean; stacked?: boolean;
  onPress: () => void; onLayout: (event: LayoutChangeEvent) => void;
}) {
  const c = useOverviewColors();
  const trimester = currentWeek && currentWeek <= 14 ? '1' : currentWeek && currentWeek <= 28 ? '2' : '3';
  const items = [
    { emoji: '📅', value: currentWeek || 0, label: 'overview.week' as const, opacity: 0.13, border: 0.35 },
    { emoji: '🔢', value: trimester, label: 'overview.trimester' as const, opacity: 0.08, border: 0.22 },
    { emoji: '📊', value: `${progress}%`, label: 'overview.progress' as const, opacity: 0.05, border: 0.15 },
  ];
  return <OverviewCard compact={compact} onPress={onPress} onLayout={onLayout} testID="pregnancy-numbers-slide">
    <HomeOverviewHeading color={c.text}>{translateHomeText(locale, 'summary.title')}</HomeOverviewHeading>
    <View style={[styles.stats, stacked && styles.stackedStats]}>
      {items.map(item => <View key={item.label} style={[styles.stat, stacked && styles.stackedStat,
        { backgroundColor: `rgba(94,61,179,${item.opacity})`, borderColor: `rgba(94,61,179,${item.border})` }]}>
        <View style={styles.statIcon}><Text style={styles.emoji} allowFontScaling={false}>{item.emoji}</Text></View>
        <View style={styles.valueContainer}><ThemedText adaptive={false} style={[styles.value, { color: c.accent }]}>{item.value}</ThemedText></View>
        <ThemedText adaptive={false} style={[styles.label, { color: c.text }]}>{translatePregnancyHomeText(locale, item.label)}</ThemedText>
      </View>)}
    </View>
  </OverviewCard>;
}
const styles = StyleSheet.create({
  wrapper: { width: '100%', borderRadius: 22, overflow: 'hidden', position: 'relative' },
  background: { borderRadius: 22, overflow: 'hidden' },
  container: { borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 8, ...androidHomeShadow },
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', width: '100%' },
  stackedStats: { flexDirection: 'column', gap: 10 },
  stat: { alignItems: 'center', justifyContent: 'center', minHeight: 66, width: '31.4%', minWidth: '31.4%', maxWidth: '31.4%',
    flexGrow: 0, flexShrink: 0, borderRadius: 16, padding: 8, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5, ...androidHomeShadow },
  stackedStat: { width: '100%', minWidth: '100%', maxWidth: '100%' },
  statIcon: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 32, padding: Platform.OS === 'android' ? 6 : 14, marginBottom: 6, alignSelf: 'center', width: 64, height: 64,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6, ...androidHomeShadow },
  emoji: { fontSize: 32, textAlign: 'center', ...Platform.select({ android: { width: '100%', includeFontPadding: true }, default: { lineHeight: 34 } }) },
  valueContainer: { minHeight: 56, width: '100%', alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -1, marginTop: 2, marginBottom: 2, lineHeight: 26,
    textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  label: { fontSize: 12, textAlign: 'center', fontWeight: '600', opacity: 0.9, marginTop: 4 },
});
