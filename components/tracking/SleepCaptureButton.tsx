import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/IconSymbol';

/** Shared capture card from the sleep tracker. */
export function SleepCaptureButton({ kind, title, hint, textColor, disabled, onPress, style }: {
  kind: 'start' | 'stop' | 'manual'; title: string; hint: string; textColor: string;
  disabled?: boolean; onPress: () => void; style?: StyleProp<ViewStyle>;
}) {
  const colors = kind === 'start' ? ['rgba(220,200,255,0.6)', 'rgba(142,78,198,0.9)']
    : kind === 'stop' ? ['rgba(255,190,190,0.6)', 'rgba(255,140,160,0.9)'] : ['rgba(168,196,193,0.6)', 'rgba(168,196,193,0.9)'];
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress}
    activeOpacity={0.9} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    style={[styles.wrapper, style, disabled && { opacity: 0.6 }]}>
    <BlurView intensity={24} tint="light" style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: colors[0] }]}>
        <View style={[styles.icon, { backgroundColor: colors[1] }]}>
          <IconSymbol name={kind === 'start' ? 'moon.fill' : kind === 'stop' ? 'stop.fill' : 'plus.circle.fill'} size={28} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.hint, { color: textColor }]}>{hint}</Text>
      </View>
    </BlurView>
  </TouchableOpacity>;
}
const styles = StyleSheet.create({
  wrapper: { borderRadius: 22, overflow: 'hidden' },
  card: { borderRadius: 22, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 128, height: 140,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', shadowColor: 'rgba(255,255,255,0.3)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: .12, shadowRadius: 6, elevation: 5 },
  icon: { width: 54, height: 54, borderRadius: 30, padding: 8, marginBottom: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -.2, marginBottom: 4, textAlign: 'center' },
  hint: { fontSize: 11, fontWeight: '500', textAlign: 'center', lineHeight: 14 },
});
