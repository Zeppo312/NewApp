import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { GlassCard } from '@/constants/DesignGuide';

type Props = Pick<TouchableOpacityProps, 'onPress' | 'onLongPress' | 'activeOpacity'> & {
  emoji: string; label: string; textColor: string; disabled?: boolean; dimmed?: boolean;
};

/** The round action used by Unser Tag, also usable with local demo callbacks. */
export function DailyQuickAction({ emoji, label, textColor, disabled, dimmed, onPress, onLongPress, activeOpacity = .9 }: Props) {
  return <GlassCard style={styles.circle} intensity={30} overlayColor="rgba(255,255,255,.32)" borderColor="rgba(255,255,255,.70)">
    <TouchableOpacity style={[styles.inner, dimmed && { opacity: .45 }]} disabled={disabled} onPress={onPress} onLongPress={onLongPress} delayLongPress={250} activeOpacity={activeOpacity} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.emoji} numberOfLines={1}>{emoji}</Text><Text style={[styles.label, { color: textColor }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  </GlassCard>;
}
const styles = StyleSheet.create({
  circle: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, overflow: 'hidden' },
  inner: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 8 },
  emoji: { fontSize: 26, lineHeight: 30, textAlign: 'center' },
  label: { marginTop: 4, fontSize: 12, lineHeight: 14, fontWeight: '700', textAlign: 'center', alignSelf: 'stretch' },
});
