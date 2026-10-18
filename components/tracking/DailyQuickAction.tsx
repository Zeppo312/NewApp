import React from 'react';
import { StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { ContentCard } from '@/components/ui/content-card';
import { TYPOGRAPHY } from '@/constants/Typography';
import { useLineLimit, useScaledSize } from '@/lib/fontScaling';

type Props = Pick<TouchableOpacityProps, 'onPress' | 'onLongPress' | 'activeOpacity'> & {
  emoji: string; label: string; textColor: string; disabled?: boolean; dimmed?: boolean;
};

/** The round action used by Unser Tag, also usable with local demo callbacks. */
export function DailyQuickAction({ emoji, label, textColor, disabled, dimmed, onPress, onLongPress, activeOpacity = .9 }: Props) {
  const lineLimit = useLineLimit(2);
  // Der Kreis wächst mit der Schrift, sonst brechen Wörter wie „Fläschchen“
  // mitten im Wort um. Bei sehr großer Schrift schrumpft der Text notfalls.
  const diameter = useScaledSize(96, 1.7);
  return <ContentCard style={[styles.circle, { width: diameter, minHeight: diameter, borderRadius: diameter / 2 }]} intensity={22}>
    <TouchableOpacity style={[styles.inner, dimmed && { opacity: .45 }]} disabled={disabled} onPress={onPress} onLongPress={onLongPress} delayLongPress={250} activeOpacity={activeOpacity} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}>
      <Text style={styles.emoji} allowFontScaling={false} numberOfLines={1}>{emoji}</Text><Text style={[styles.label, { color: textColor }]} numberOfLines={lineLimit ?? 3} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
    </TouchableOpacity>
  </ContentCard>;
}
const styles = StyleSheet.create({
  circle: { width: 96, minHeight: 96, borderRadius: 48, borderWidth: 1, overflow: 'hidden' },
  inner: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 8 },
  emoji: { fontSize: 26, lineHeight: 30, textAlign: 'center' },
  label: { ...TYPOGRAPHY.caption, marginTop: 4, textAlign: 'center', alignSelf: 'stretch' },
});
