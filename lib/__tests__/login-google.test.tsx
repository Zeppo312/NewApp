import 'react-native-url-polyfill/auto';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform, Text, TouchableOpacity } from 'react-native';
import LoginScreen from '@/app/(auth)/login';

const mockGoogle = jest.fn();
const mockApple = jest.fn();
const mockConsent = jest.fn();
const mockReplace = jest.fn();
const mockError = jest.fn();
let mockParams: { invitationCode?: string };
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ signInWithGoogle: mockGoogle, signInWithApple: mockApple }) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/termsConsent', () => ({ acceptTerms: (...args: unknown[]) => mockConsent(...args), TERMS_VERSION: 'current' }));
jest.mock('@/lib/google-auth', () => ({ googleAuthErrorKey: (error: unknown) => { mockError(error); return 'login.googleUnavailable'; } }));
jest.mock('expo-linking', () => ({ createURL: () => 'com.lottibaby.app://invite?code=' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, Stack: { Screen: () => null }, router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));

let tree: ReactTestRenderer;
const originalOS = Platform.OS;
const googleButton = () => tree.root.findAllByType(TouchableOpacity).find(n => n.props.accessibilityLabel === 'Mit Google anmelden')!;
const appleButton = () => tree.root.findAllByType(TouchableOpacity).find(n => n.findAllByType(Text).some(label => label.props.children === 'Mit Apple anmelden'))!;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  jest.clearAllMocks(); mockParams = {};
  mockGoogle.mockResolvedValue({ status: 'cancelled' });
  mockApple.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  act(() => tree?.unmount());
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
});
function mount() { act(() => { tree = create(<LoginScreen />); }); }

it('keeps both sign-in buttons on iOS and invokes each provider independently', async () => {
  mount();
  expect(tree.root.findAll(n => n.props.accessibilityRole === 'checkbox')).toHaveLength(0);
  expect(googleButton().props.disabled).toBe(false);
  expect(appleButton().props.disabled).toBe(false);

  await act(async () => { await googleButton().props.onPress(); });
  expect(mockGoogle).toHaveBeenCalledTimes(1);
  expect(mockApple).not.toHaveBeenCalled();

  await act(async () => { await appleButton().props.onPress(); });
  expect(mockApple).toHaveBeenCalledTimes(1);
  expect(mockGoogle).toHaveBeenCalledTimes(1);
  expect(googleButton().props.disabled).toBe(false);
  expect(appleButton().props.disabled).toBe(false);
  expect(mockConsent).not.toHaveBeenCalled();
});

it('carries terms acceptance from the Google button without requiring email/password inputs', async () => {
  mount();
  expect(googleButton().props.disabled).toBe(false);
  await act(async () => { await googleButton().props.onPress(); });
  expect(mockGoogle).toHaveBeenCalledWith({ source: 'login', termsVersion: 'current', invitationCode: undefined });
  expect(mockConsent).not.toHaveBeenCalled();
});

it('preserves signup intent and a normalized invitation code through the browser handoff', async () => {
  mockParams = { invitationCode: 'abcd2345' };
  mount();
  const signup = tree.root.findAllByType(TouchableOpacity).find(n => n.findAllByType(Text).some(label => label.props.children === 'Noch kein Konto? Registrieren'))!;
  act(() => { signup.props.onPress(); });
  mockGoogle.mockResolvedValue({ status: 'callback', url: 'com.lottibaby.app://auth/google-callback?attempt=own-attempt&code=auth-code' });
  await act(async () => { await googleButton().props.onPress(); });
  expect(mockGoogle).toHaveBeenCalledWith({ source: 'signup', termsVersion: 'current', invitationCode: 'ABCD2345' });
  expect(mockError.mock.calls).toEqual([]);
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth/google-callback', params: { attempt: 'own-attempt', code: 'auth-code' } });
});

it('lets the user retry after cancellation', async () => {
  mount();
  await act(async () => { await googleButton().props.onPress(); });
  expect(mockReplace).not.toHaveBeenCalled();
  expect(googleButton().props.disabled).toBe(false);
  await act(async () => { await googleButton().props.onPress(); });
  expect(mockGoogle).toHaveBeenCalledTimes(2);
  expect(mockConsent).not.toHaveBeenCalled();
});

it('shows a usable fallback after an unavailable provider and releases loading state', async () => {
  mockGoogle.mockRejectedValue(new Error('provider unavailable'));
  mount();
  await act(async () => { await googleButton().props.onPress(); });
  expect(mockReplace).not.toHaveBeenCalled();
  expect(googleButton().props.disabled).toBe(false);
  expect(tree.root.findAllByType(Text).some(n => String(n.props.children).includes('momentan nicht verfügbar'))).toBe(true);
  expect(mockConsent).not.toHaveBeenCalled();
});
