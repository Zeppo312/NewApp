import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { ContentCard } from '@/components/ui/content-card';
import { TYPOGRAPHY } from '@/constants/Typography';
import { ActionColors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { IconSymbol } from '@/components/ui/IconSymbol';

/** Shared capture card from the sleep tracker. */
export function SleepCaptureButton({ kind, title, hint, textColor, disabled, onPress, style }: {
  kind: 'start' | 'stop' | 'manual'; title: string; hint: string; textColor: string;
  disabled?: boolean; onPress: () => void; style?: StyleProp<ViewStyle>;
}) {
  const adaptive = useAdaptiveColors();
  const palette = ActionColors[adaptive.effectiveScheme === 'dark' || adaptive.isDarkBackground ? 'dark' : 'light'];
  const colors = kind === 'start' ? ['rgba(142,78,198,0.08)', palette.primary]
    : kind === 'stop' ? ['rgba(171,52,76,0.08)', palette.destructive] : ['rgba(157,190,187,0.08)', palette.primary];
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    activeOpacity={0.9} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    style={[styles.wrapper, style, disabled && { opacity: 0.6 }]}>
    <ContentCard intensity={22} style={styles.card} overlayColor={colors[0]}>
        <View style={[styles.icon, { backgroundColor: colors[1] }]}>
          <IconSymbol name={kind === 'start' ? 'moon.fill' : kind === 'stop' ? 'stop.fill' : 'plus.circle.fill'} size={28} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.hint, { color: textColor }]}>{hint}</Text>
    </ContentCard>
  </TouchableOpacity>;
}
const styles = StyleSheet.create({
  wrapper: { borderRadius: 22, overflow: 'hidden' },
  card: { borderRadius: 22, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  icon: { width: 54, height: 54, borderRadius: 30, padding: 8, marginBottom: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  title: { ...TYPOGRAPHY.headline, marginBottom: 4, textAlign: 'center' },
  hint: { ...TYPOGRAPHY.bodySmall, textAlign: 'center' },
});
