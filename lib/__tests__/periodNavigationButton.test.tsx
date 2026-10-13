import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PeriodNavigationButtonProps } from '@/components/ui/period-navigation-button';
import { DAILY_TRANSLATIONS } from '@/lib/dailyTranslations';
import { SLEEP_TRACKER_TRANSLATIONS } from '@/lib/sleepTrackerTranslations';
import { PLANNER_TRANSLATIONS } from '@/lib/plannerTranslations';

let mockNativeAvailable = true;
let mockGlassAvailable = true;
let mockReduceTransparency = false;
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => mockNativeAvailable ? {} : null,
  requireNativeModule: () => ({}),
}));
jest.mock('expo-glass-effect', () => ({
  isLiquidGlassAvailable: () => mockGlassAvailable,
  isGlassEffectAPIAvailable: () => mockGlassAvailable,
}));
jest.mock('@expo/ui', () => ({ Host: 'NativeHost' }));
jest.mock('@expo/ui/swift-ui', () => ({ Button: 'NativeButton' }));
jest.mock('@expo/ui/swift-ui/modifiers', () => jest.requireActual('@expo/ui/swift-ui/modifiers'));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: 'IconSymbol' }));
jest.mock('@/hooks/useReduceTransparency', () => ({ useReduceTransparency: () => mockReduceTransparency }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));
beforeEach(() => {
  mockNativeAvailable = true;
  mockGlassAvailable = true;
  mockReduceTransparency = false;
});

function render(props: Partial<PeriodNavigationButtonProps> = {}) {
  let Button!: React.ComponentType<PeriodNavigationButtonProps>;
  jest.isolateModules(() => {
    // Re-evaluate native availability for each installed-build scenario.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Button = require('@/components/ui/period-navigation-button.ios').PeriodNavigationButton;
  });
  const onPress = jest.fn();
  act(() => {
    tree = create(<Button direction="next" accessibilityLabel="Nächster Tag" isDark={false}
      color="#5E3DB3" onPress={onPress} {...props} />);
  });
  return onPress;
}

it('delivers native taps while retaining an accessible name for an icon-only button', () => {
  const onPress = render();
  const native = tree.root.findByType('NativeButton' as any);
  expect(native.props.label).toBe('Nächster Tag');
  act(() => native.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('ignores a late native press event after navigation becomes disabled', () => {
  const onPress = render({ disabled: true });
  act(() => tree.root.findByType('NativeButton' as any).props.onPress());
  expect(onPress).not.toHaveBeenCalled();
});

it('keeps older installed builds without Expo UI usable', () => {
  mockNativeAvailable = false;
  const onPress = render();
  expect(tree.root.findAllByType('NativeButton' as any)).toHaveLength(0);
  const fallback = tree.root.findAll(node => node.props.accessibilityRole === 'button'
    && typeof node.props.style === 'function')[0];
  expect(fallback.props.accessibilityLabel).toBe('Nächster Tag');
  act(() => fallback.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('uses an opaque control without blur when transparency is reduced', () => {
  mockReduceTransparency = true;
  render({ disabled: true });
  expect(tree.root.findAllByType('NativeButton' as any)).toHaveLength(0);
  expect(tree.root.findAllByType('BlurView' as any)).toHaveLength(0);
  const fallback = tree.root.findAll(node => node.props.accessibilityRole === 'button'
    && typeof node.props.style === 'function')[0];
  expect(fallback.props.accessibilityState.disabled).toBe(true);
});

it('uses a supported native style when Liquid Glass is unavailable', () => {
  mockGlassAvailable = false;
  render();
  expect(tree.root.findByType('NativeButton' as any).props.modifiers).toContainEqual({
    $type: 'buttonStyle', style: 'bordered',
  });
});

it.each(['de', 'en', 'es'] as const)('uses the same period navigation labels across all three views in %s', locale => {
  for (const period of ['Day', 'Week', 'Month']) {
    for (const direction of ['previous', 'next']) {
      const key = `navigation.${direction}${period}` as keyof typeof PLANNER_TRANSLATIONS.de;
      const expected = PLANNER_TRANSLATIONS[locale][key];
      expect(DAILY_TRANSLATIONS[locale][key as keyof typeof DAILY_TRANSLATIONS.de]).toBe(expected);
      expect(SLEEP_TRACKER_TRANSLATIONS[locale][key as keyof typeof SLEEP_TRACKER_TRANSLATIONS.de]).toBe(expected);
    }
  }
});
