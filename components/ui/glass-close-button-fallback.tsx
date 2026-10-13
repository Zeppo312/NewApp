import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LavenderColors } from '@/constants/Colors';
import { FORM_LAYOUT } from '@/constants/Forms';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { IconSymbol } from './IconSymbol';

export type GlassCloseButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
};

/** Frosted circular control for platforms/builds without native Liquid Glass. */
export function GlassCloseButtonFallback({ accessibilityLabel, onPress, disabled = false, isDark }: GlassCloseButtonProps) {
  const reduceTransparency = useReduceTransparency();
  const colors = LavenderColors[isDark ? 'dark' : 'light'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { if (!disabled) onPress(); }}
      style={({ pressed }) => [styles.button, {
        backgroundColor: reduceTransparency ? colors.disabled : colors.field,
        borderColor: colors.surfaceBorder,
      }, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {!reduceTransparency && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Platform.OS === 'ios' && <BlurView intensity={70}
          tint={isDark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>}
      <IconSymbol name="xmark" size={18} weight="semibold" color={colors.text} />
    </Pressable>
  );
}

const size = FORM_LAYOUT.closeSize;
const styles = StyleSheet.create({
  button: { width: size, height: size, flexShrink: 0, borderRadius: size / 2,
    overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
