import React from 'react';
import { requireOptionalNativeModule } from 'expo';
import { ACTION_BUTTON_LAYOUT } from '@/constants/Actions';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { PeriodNavigationButtonFallback, type PeriodNavigationButtonProps } from './period-navigation-button-fallback';

// Conditional imports keep older installed builds without these native views OTA-safe.
/* eslint-disable @typescript-eslint/no-require-imports */
const swiftUI = requireOptionalNativeModule('ExpoUI')
  ? require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui') : null;
const Host = swiftUI ? (require('@expo/ui') as typeof import('@expo/ui')).Host : null;
const modifiers = swiftUI
  ? require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers') : null;
const glass = requireOptionalNativeModule('ExpoGlassEffect')
  ? require('expo-glass-effect') as typeof import('expo-glass-effect') : null;
const canUseGlass = !!glass && glass.isLiquidGlassAvailable() && glass.isGlassEffectAPIAvailable();
/* eslint-enable @typescript-eslint/no-require-imports */

/** A real SwiftUI Button with Apple's circular Liquid Glass button style. */
export function PeriodNavigationButton(props: PeriodNavigationButtonProps) {
  const reduceTransparency = useReduceTransparency();
  if (!swiftUI || !Host || !modifiers || reduceTransparency) {
    return <PeriodNavigationButtonFallback {...props} />;
  }
  const { Button } = swiftUI;
  const { buttonStyle, buttonBorderShape, controlSize, labelStyle, font, tint, disabled, frame } = modifiers;
  const size = ACTION_BUTTON_LAYOUT.compactMinHeight;
  return (
    <Host colorScheme={props.isDark ? 'dark' : 'light'} ignoreSafeArea="all"
      style={{ width: size, height: size, flexShrink: 0 }}>
      <Button label={props.accessibilityLabel}
        systemImage={props.direction === 'previous' ? 'chevron.left' : 'chevron.right'}
        onPress={() => { if (!props.disabled) props.onPress(); }}
        modifiers={[
          labelStyle('iconOnly'),
          font({ size: 18, weight: 'semibold' }),
          buttonStyle(canUseGlass ? 'glass' : 'bordered'),
          buttonBorderShape('circle'),
          controlSize('large'),
          tint(props.color),
          disabled(!!props.disabled),
          frame({ width: size, height: size }),
        ]}
      />
    </Host>
  );
}

export type { PeriodNavigationButtonProps } from './period-navigation-button-fallback';
