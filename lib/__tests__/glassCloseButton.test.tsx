import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { LavenderColors } from '@/constants/Colors';
import { FORM_LAYOUT } from '@/constants/Forms';
import type { GlassCloseButtonProps } from '@/components/ui/glass-close-button';

let mockUIAvailable = true;
let mockGlassModule = true;
let mockLiquidGlass = true;
let mockGlassAPI = true;
let mockReduceTransparency = false;
jest.mock('expo', () => ({
  requireOptionalNativeModule: (name: string) => (name === 'ExpoUI' ? mockUIAvailable : mockGlassModule) ? {} : null,
  requireNativeModule: () => ({}),
}));
jest.mock('expo-glass-effect', () => ({
  isLiquidGlassAvailable: () => mockLiquidGlass,
  isGlassEffectAPIAvailable: () => mockGlassAPI,
}));
jest.mock('@expo/ui', () => ({ Host: 'NativeHost' }));
jest.mock('@expo/ui/swift-ui', () => ({ Button: 'NativeButton' }));
jest.mock('@expo/ui/swift-ui/modifiers', () => jest.requireActual('@expo/ui/swift-ui/modifiers'));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: 'IconSymbol' }));
jest.mock('@/hooks/useReduceTransparency', () => ({ useReduceTransparency: () => mockReduceTransparency }));

let tree: ReactTestRenderer;
beforeEach(() => {
  mockUIAvailable = mockGlassModule = mockLiquidGlass = mockGlassAPI = true;
  mockReduceTransparency = false;
});
afterEach(() => act(() => tree?.unmount()));

function render(props: Partial<GlassCloseButtonProps> = {}) {
  let Button!: React.ComponentType<GlassCloseButtonProps>;
  jest.isolateModules(() => {
    // Re-evaluate installed native capabilities for each build scenario.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Button = require('@/components/ui/glass-close-button.ios').GlassCloseButton;
  });
  const onPress = jest.fn();
  act(() => { tree = create(<Button accessibilityLabel="Schließen" onPress={onPress} isDark={false} {...props} />); });
  return onPress;
}

it('uses a circular native Liquid Glass button with an accessible SF Symbol', () => {
  const onPress = render();
  const button = tree.root.findByType('NativeButton' as any);
  expect(button.props.label).toBe('Schließen');
  expect(button.props.systemImage).toBe('xmark');
  expect(button.props.modifiers).toEqual(expect.arrayContaining([
    { $type: 'buttonStyle', style: 'glass' },
    { $type: 'buttonBorderShape', shape: 'circle' },
    { $type: 'labelStyle', style: 'iconOnly' },
  ]));
  expect(StyleSheet.flatten(tree.root.findByType('NativeHost' as any).props.style)).toMatchObject({
    width: FORM_LAYOUT.closeSize, height: FORM_LAYOUT.closeSize,
  });
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each([false, true])('forces the native host to match the popup theme (dark: %s)', isDark => {
  render({ isDark });
  expect(tree.root.findByType('NativeHost' as any).props.colorScheme).toBe(isDark ? 'dark' : 'light');
  expect(tree.root.findByType('NativeButton' as any).props.modifiers).toContainEqual({
    $type: 'tint', color: LavenderColors[isDark ? 'dark' : 'light'].text,
  });
});

it.each(['missingModule', 'olderOS', 'missingBuildAPI'])('uses a supported native style for %s', unavailable => {
  if (unavailable === 'missingModule') mockGlassModule = false;
  if (unavailable === 'olderOS') mockLiquidGlass = false;
  if (unavailable === 'missingBuildAPI') mockGlassAPI = false;
  render();
  expect(tree.root.findByType('NativeButton' as any).props.modifiers).toContainEqual({
    $type: 'buttonStyle', style: 'bordered',
  });
});

it('keeps an older installed build without Expo UI usable', () => {
  mockUIAvailable = false;
  const onPress = render({ isDark: true });
  expect(tree.root.findAllByType('NativeButton' as any)).toHaveLength(0);
  const fallback = tree.root.find(node => node.props.accessibilityLabel === 'Schließen' && typeof node.props.style === 'function');
  expect(fallback.props.accessibilityRole).toBe('button');
  expect(StyleSheet.flatten(fallback.props.style({ pressed: false })).backgroundColor).toBe(LavenderColors.dark.field);
  act(() => fallback.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each([false, true])('ignores disabled close events with reduced transparency: %s', reduced => {
  mockReduceTransparency = reduced;
  const onPress = render({ disabled: true, isDark: true });
  const button = reduced
    ? tree.root.find(node => node.props.accessibilityLabel === 'Schließen' && typeof node.props.style === 'function')
    : tree.root.findByType('NativeButton' as any);
  act(() => button.props.onPress());
  expect(onPress).not.toHaveBeenCalled();
  if (reduced) {
    expect(tree.root.findAllByType('BlurView' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('LinearGradient' as any)).toHaveLength(0);
    expect(StyleSheet.flatten(button.props.style({ pressed: false })).backgroundColor).toBe(LavenderColors.dark.disabled);
  }
});
