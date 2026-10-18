import React from 'react';
import { requireOptionalNativeModule } from 'expo';
import { LavenderColors } from '@/constants/Colors';
import { FORM_LAYOUT } from '@/constants/Forms';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { GlassCloseButtonFallback, type GlassCloseButtonProps } from './glass-close-button-fallback';

// Existing installed builds may not contain these native views yet.
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

/** Native SF Symbol and circular SwiftUI Liquid Glass button on supported iOS. */
export function GlassCloseButton(props: GlassCloseButtonProps) {
  const reduceTransparency = useReduceTransparency();
  if (!swiftUI || !Host || !modifiers || reduceTransparency) {
    return <GlassCloseButtonFallback {...props} />;
  }
  const { Button } = swiftUI;
  const { buttonStyle, buttonBorderShape, controlSize, labelStyle, font, tint, disabled, frame } = modifiers;
  const size = FORM_LAYOUT.closeSize;
  return (
    <Host colorScheme={props.isDark ? 'dark' : 'light'} ignoreSafeArea="all"
      style={{ width: size, height: size, flexShrink: 0 }}>
      <Button label={props.accessibilityLabel} systemImage="xmark"
        onPress={() => { if (!props.disabled) props.onPress(); }}
        modifiers={[
          labelStyle('iconOnly'),
          font({ size: 18, weight: 'semibold' }),
          buttonStyle(canUseGlass ? 'glass' : 'bordered'),
          buttonBorderShape('circle'),
          controlSize('large'),
          tint(LavenderColors[props.isDark ? 'dark' : 'light'].text),
          disabled(!!props.disabled),
          frame({ width: size, height: size }),
        ]}
      />
    </Host>
  );
}

export type { GlassCloseButtonProps } from './glass-close-button-fallback';
