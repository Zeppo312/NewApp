import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, ContentColors } from '@/constants/Colors';
import { ACTION_BUTTON_LAYOUT } from '@/constants/Actions';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { IconSymbol } from './IconSymbol';

export type PeriodNavigationButtonProps = {
  direction: 'previous' | 'next';
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
  color: string;
};

/** Shared fallback for Android, web and iOS builds without Expo UI. */
export function PeriodNavigationButtonFallback({
  direction, accessibilityLabel, onPress, disabled = false, isDark, color,
}: PeriodNavigationButtonProps) {
  const reduceTransparency = useReduceTransparency();
  const scheme = isDark ? 'dark' : 'light';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { if (!disabled) onPress(); }}
      style={({ pressed }) => [styles.button, {
        backgroundColor: reduceTransparency ? Colors[scheme].card : ContentColors[scheme].surface,
        borderColor: ContentColors[scheme].border,
      }, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {Platform.OS === 'ios' && !reduceTransparency && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <BlurView tint={isDark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
            intensity={80} style={StyleSheet.absoluteFill} />
        </View>
      )}
      <IconSymbol name={direction === 'previous' ? 'chevron.left' : 'chevron.right'}
        size={18} weight="semibold" color={color} />
    </Pressable>
  );
}

const size = ACTION_BUTTON_LAYOUT.compactMinHeight;
const styles = StyleSheet.create({
  button: { width: size, height: size, borderRadius: size / 2, flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
