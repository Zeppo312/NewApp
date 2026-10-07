import React from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({}) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/termsConsent', () => ({ acceptTerms: jest.fn(), TERMS_VERSION: 'test' }));
jest.mock('expo-linking', () => ({ createURL: jest.fn() }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), Stack: { Screen: () => null }, router: {} }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));

const originalOS = Platform.OS;
let LoginScreen: typeof import('@/app/(auth)/login').default;
let tree: ReactTestRenderer;
let keyboardVisible = false;
const listeners = new Map<string, Set<Parameters<typeof Keyboard.addListener>[1]>>();

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  // Styles and platform branches must be loaded for the target platform.
  LoginScreen = jest.requireActual('@/app/(auth)/login').default;
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
});

beforeEach(() => {
  keyboardVisible = false;
  listeners.clear();
  jest.clearAllMocks();
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => keyboardVisible);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => {
    const callbacks = listeners.get(name) ?? new Set();
    callbacks.add(callback);
    listeners.set(name, callbacks);
    return { remove: () => { callbacks.delete(callback); } } as ReturnType<typeof Keyboard.addListener>;
  });
  act(() => { tree = create(<LoginScreen />); });
});

afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.restoreAllMocks();
});

function setKeyboardVisible(visible: boolean) {
  keyboardVisible = visible;
  act(() => {
    listeners.get(visible ? 'keyboardDidShow' : 'keyboardDidHide')?.forEach(callback => callback({
      duration: 0,
      easing: 'keyboard',
      endCoordinates: { screenX: 0, screenY: visible ? 420 : 800, width: 360, height: visible ? 380 : 0 },
    }));
  });
}

it('uses overlap padding instead of retaining a fixed pre-keyboard height', () => {
  expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  expect(tree.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(0);
  expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.style).flex).toBe(1);
  setKeyboardVisible(true);
  expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle).justifyContent).toBe('flex-start');
  expect(tree.root.findByType(SafeAreaView).props.edges).not.toContain('bottom');
});

it('restores the full header and bottom safe area after dismissing the keyboard', () => {
  const hiddenViews = () => tree.root.findAllByType(View).filter(view => StyleSheet.flatten(view.props.style)?.display === 'none');
  expect(hiddenViews()).toHaveLength(0);
  setKeyboardVisible(true);
  expect(hiddenViews()).toHaveLength(1);
  setKeyboardVisible(false);
  expect(hiddenViews()).toHaveLength(0);
  expect(tree.root.findByType(SafeAreaView).props.edges).toBeUndefined();
  expect(StyleSheet.flatten(tree.root.findByType(ScrollView).props.contentContainerStyle).justifyContent).toBe('center');
});

it('keeps the focused field visible after keyboard opening, field changes and viewport resizing', () => {
  const [email, password] = tree.root.findAllByType(TextInput);
  const scroll = tree.root.findByType(ScrollView);
  const reveal = scroll.instance.scrollResponderScrollNativeHandleToKeyboard;
  act(() => email.props.onFocus());
  expect(reveal).not.toHaveBeenCalled();
  setKeyboardVisible(true);
  expect(reveal).toHaveBeenLastCalledWith(email.instance, 24, true);
  act(() => { email.props.onBlur(); password.props.onFocus(); });
  expect(reveal).toHaveBeenLastCalledWith(password.instance, 24, true);
  reveal.mockClear();
  act(() => scroll.props.onLayout());
  expect(reveal).toHaveBeenLastCalledWith(password.instance, 24, true);
  setKeyboardVisible(false);
  reveal.mockClear();
  act(() => scroll.props.onContentSizeChange());
  expect(reveal).not.toHaveBeenCalled();
});

it('moves from email to password with the Next key without dismissing the keyboard', () => {
  const [email, password] = tree.root.findAllByType(TextInput);
  expect(email.props.returnKeyType).toBe('next');
  expect(email.props.submitBehavior).toBe('submit');
  act(() => email.props.onSubmitEditing());
  expect(password.instance.focus).toHaveBeenCalled();
});
