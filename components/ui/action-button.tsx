import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { getActionColors, type SurfaceTone } from '@/constants/Colors';
import { ACTION_BUTTON_LAYOUT } from '@/constants/Actions';
import { TYPOGRAPHY } from '@/constants/Typography';

export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export type ActionButtonProps = Omit<PressableProps,
  'children' | 'style' | 'accessibilityRole' | 'accessibilityState'
> & {
  label: string;
  busy?: boolean;
  busyLabel?: string;
  variant?: ActionButtonVariant;
  size?: 'regular' | 'compact';
  /** The appearance of the button's own surface, independent of wallpaper. */
  isDark?: boolean;
  tone?: SurfaceTone;
  /** A brief transition locks taps while preserving the action's appearance. */
  interactionDisabled?: boolean;
  /** Layout overrides only; action colors and text roles belong to this component. */
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  label,
  busy = false,
  busyLabel,
  disabled = false,
  variant = 'primary',
  size = 'regular',
  isDark = false,
  tone = 'default',
  interactionDisabled = false,
  style,
  onPress,
  accessibilityLabel,
  ...props
}: ActionButtonProps) {
  const colors = getActionColors(isDark ? 'dark' : 'light', tone);
  const blocked = disabled || busy || interactionDisabled;
  const compact = size === 'compact';
  const foreground = disabled && !busy
    ? colors.onDisabled
    : variant === 'primary' ? colors.onPrimary
      : variant === 'destructive' ? colors.onDestructive
        : colors.onSecondary;

  const background = (pressed: boolean) => {
    if (disabled && !busy) return colors.disabled;
    if (variant === 'primary') return pressed && !blocked ? colors.primaryPressed : colors.primary;
    if (variant === 'destructive') return pressed && !blocked ? colors.destructivePressed : colors.destructive;
    if (pressed && !blocked) return colors.secondaryPressed;
    return variant === 'ghost' ? 'transparent' : colors.secondary;
  };

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy }}
      disabled={blocked}
      onPress={(event) => {
        if (!blocked) return onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: background(pressed) },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={foreground} accessible={false} /> : null}
      <Text style={[compact ? TYPOGRAPHY.buttonSmall : TYPOGRAPHY.button, styles.label, { color: foreground }]}>
        {busy && busyLabel ? busyLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ACTION_BUTTON_LAYOUT.contentGap,
    borderRadius: ACTION_BUTTON_LAYOUT.radius,
    borderCurve: 'continuous',
    minWidth: 0,
    maxWidth: '100%',
  },
  regular: {
    minHeight: ACTION_BUTTON_LAYOUT.minHeight,
    paddingHorizontal: ACTION_BUTTON_LAYOUT.paddingHorizontal,
    paddingVertical: ACTION_BUTTON_LAYOUT.paddingVertical,
  },
  compact: {
    minHeight: Platform.OS === 'android'
      ? ACTION_BUTTON_LAYOUT.androidCompactMinHeight
      : ACTION_BUTTON_LAYOUT.compactMinHeight,
    paddingHorizontal: ACTION_BUTTON_LAYOUT.compactPaddingHorizontal,
    paddingVertical: ACTION_BUTTON_LAYOUT.compactPaddingVertical,
  },
  label: { minWidth: 0, flexShrink: 1, textAlign: 'center' },
});
