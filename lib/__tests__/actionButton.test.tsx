import React from 'react';
import { ActivityIndicator, StyleSheet, Text, type GestureResponderEvent } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ActionButton, type ActionButtonProps, type ActionButtonVariant } from '@/components/ui/action-button';
import { Colors } from '@/constants/Colors';

let tree: ReactTestRenderer;
const event = {} as GestureResponderEvent;
const mount = (props: Partial<ActionButtonProps> = {}) => {
  act(() => { tree = create(<ActionButton label="Speichern" {...props} />); });
};
const button = () => tree.root.findAll(node => node.props.accessibilityRole === 'button'
  && typeof node.props.style === 'function')[0];
afterEach(() => act(() => tree?.unmount()));

it.each([{ disabled: true }, { busy: true }, { interactionDisabled: true }])('blocks callbacks and exposes its unavailable state for %p', state => {
  const onPress = jest.fn();
  mount({ ...state, onPress });
  act(() => button().props.onPress(event));
  expect(onPress).not.toHaveBeenCalled();
  expect(button().props.disabled).toBe(true);
  expect(button().props.accessibilityState.disabled).toBe(true);
});

it('preserves the label and surface during a brief interaction lock', () => {
  mount();
  const normalSurface = StyleSheet.flatten(button().props.style({ pressed: false }));
  const normalText = StyleSheet.flatten(tree.root.findByType(Text).props.style);
  act(() => tree.update(<ActionButton label="Speichern" interactionDisabled />));
  expect(StyleSheet.flatten(button().props.style({ pressed: false }))).toEqual(normalSurface);
  expect(StyleSheet.flatten(tree.root.findByType(Text).props.style)).toEqual(normalText);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
});

it('keeps the action name while busy, shows progress and allows retry when busy clears', () => {
  const onPress = jest.fn();
  mount({ busy: true, busyLabel: 'Wird gespeichert…', onPress });
  expect(button().props.accessibilityLabel).toBe('Speichern');
  expect(button().props.accessibilityState.busy).toBe(true);
  expect(tree.root.findByType(ActivityIndicator).props.accessible).toBe(false);
  expect(tree.root.findByType(Text).props.children).toBe('Wird gespeichert…');
  act(() => tree.update(<ActionButton label="Speichern" onPress={onPress} />));
  act(() => button().props.onPress(event));
  expect(onPress).toHaveBeenCalledWith(event);
  expect(button().props.accessibilityState).toEqual({ disabled: false, busy: false });
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
});

it('preserves an async callback result and explicit accessible label', async () => {
  const result = Promise.resolve('saved');
  const onPress = jest.fn(() => result);
  mount({ onPress, accessibilityLabel: 'Aktivität speichern' });
  expect(button().props.accessibilityLabel).toBe('Aktivität speichern');
  expect(button().props.onPress(event)).toBe(result);
  await result;
});

const luminance = (hex: string) => {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (light + 0.05) / (dark + 0.05);
};

describe.each([false, true])('action contrast on a known surface, dark=%s', isDark => {
  it.each(['primary', 'secondary', 'ghost', 'destructive'] as ActionButtonVariant[])(
    'keeps %s labels readable in normal, pressed, busy and disabled states', variant => {
      for (const state of [{}, { busy: true }, { disabled: true }]) {
        if (tree) act(() => tree.unmount());
        mount({ isDark, variant, ...state });
        const textColor = StyleSheet.flatten(tree.root.findByType(Text).props.style).color as string;
        for (const pressed of [false, true]) {
          const style = StyleSheet.flatten(button().props.style({ pressed }));
          const surface = style.backgroundColor === 'transparent'
            ? Colors[isDark ? 'dark' : 'light'].background
            : style.backgroundColor;
          expect(style.opacity ?? 1).toBe(1);
          expect(contrast(textColor, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );
});
