import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { ActionColors, ContentColors } from '@/constants/Colors';
import { CONTENT_LAYOUT } from '@/constants/DesignGuide';
import { TYPOGRAPHY } from '@/constants/Typography';
import { IconSymbol } from './IconSymbol';
import { HomeGlassSurface } from './home-glass';

type Period = 'day' | 'week' | 'month';
type Props = {
  value: Period;
  labels: Record<Period, string>;
  onSelect: (period: Period) => void;
  isDark: boolean;
  monthLocked?: boolean;
  /** Override the horizontal margin when the parent already supplies screen padding. */
  style?: StyleProp<ViewStyle>;
};

/** Shared selection chrome; access checks and date changes stay in each screen. */
export function PeriodTabs({ value, labels, onSelect, isDark, monthLocked, style }: Props) {
  const colors = ActionColors[isDark ? 'dark' : 'light'];
  const surface = ContentColors[isDark ? 'dark' : 'light'];
  const { fontScale } = useWindowDimensions();
  return <View style={[styles.group, style]}>
    {(['day', 'week', 'month'] as const).map(period => {
      const selected = value === period;
      return <Pressable key={period} onPress={() => onSelect(period)}
        accessibilityRole="tab" accessibilityLabel={labels[period]} accessibilityState={{ selected }} aria-selected={selected}
        style={({ pressed }) => [styles.touchTarget, pressed && styles.pressed]}>
        <View style={[styles.tab, fontScale >= 1.3 && styles.largeTextTab, {
          backgroundColor: selected ? surface.surface
            : isDark ? 'rgba(39,33,30,0.60)' : 'rgba(255,255,255,0.48)',
          borderColor: selected ? colors.primary : surface.border,
        }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <HomeGlassSurface intensity={22} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </View>
        <Text style={[TYPOGRAPHY.label, styles.label, { color: selected ? isDark ? '#E9D5FF' : colors.primary : colors.onSecondary }]}>{labels[period]}</Text>
        {period === 'month' && monthLocked && <IconSymbol name="lock.fill" size={14} color={selected ? isDark ? '#E9D5FF' : colors.primary : colors.onSecondary} />}
        </View>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginHorizontal: CONTENT_LAYOUT.edge, marginTop: 6,
    marginBottom: CONTENT_LAYOUT.itemGap, gap: 10 },
  touchTarget: { flexShrink: 1, minWidth: 0, maxWidth: '100%', minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.86 },
  tab: { minWidth: 0, minHeight: 38, paddingHorizontal: 18, paddingVertical: 6,
    borderRadius: 19, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', alignItems: 'center', alignContent: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 4 },
  largeTextTab: { paddingHorizontal: 10 },
  label: { flexShrink: 1, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
});
