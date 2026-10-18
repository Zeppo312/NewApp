import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ActivityIndicator, Text } from 'react-native';
import Callback from '@/app/auth/callback';

const mockExchange = jest.fn();
const mockVerify = jest.fn();
const mockSetSession = jest.fn();
const mockGetSession = jest.fn();
const mockInvalidate = jest.fn();
const mockOnboarding = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
let mockParams: Record<string, string | string[]>;
let mockRawUrl: string | null;

jest.mock('@expo/ui', () => {
  const React = jest.requireActual('react');
  const { View, Text, Pressable } = jest.requireActual('react-native');
  return { Host: View, Button: ({ label, ...props }: any) => React.createElement(Pressable,
    { ...props, accessibilityRole: 'button' }, React.createElement(Text, null, label)) };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams, useRouter: () => mockRouter, Stack: { Screen: () => null },
}));
jest.mock('expo-linking', () => ({ useURL: () => mockRawUrl }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: {
  exchangeCodeForSession: (...args: unknown[]) => mockExchange(...args),
  verifyOtp: (...args: unknown[]) => mockVerify(...args),
  setSession: (...args: unknown[]) => mockSetSession(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
} } }));
jest.mock('@/lib/appCache', () => ({ invalidateAllCaches: (...args: unknown[]) => mockInvalidate(...args) }));
jest.mock('@/lib/onboarding', () => ({ getOnboardingCompletionState: (...args: unknown[]) => mockOnboarding(...args) }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockParams = { code: 'email-code' };
  mockRawUrl = null;
  mockExchange.mockResolvedValue({ error: null });
  mockVerify.mockResolvedValue({ error: null });
  mockSetSession.mockResolvedValue({ error: null });
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'confirmed-user' } } }, error: null });
  mockInvalidate.mockResolvedValue(undefined);
  mockOnboarding.mockResolvedValue(false);
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
async function mount() { await act(async () => { tree = create(<Callback />); }); }
const text = () => tree.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');

it('keeps a loading indicator without a success claim while verification is pending', async () => {
  let finish!: (result: unknown) => void;
  mockExchange.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await mount();
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(text()).not.toContain('✅');
  expect(text()).not.toContain('erfolgreich');
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { finish({ error: null }); });
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/getUserInfo');
});

it('handles expired OAuth state before any existing session and leaves recovery visible', async () => {
  mockParams = { error: 'server_error', error_code: 'bad_oauth_state', error_description: 'private provider details' };
  await mount();
  expect(mockExchange).not.toHaveBeenCalled();
  expect(mockGetSession).not.toHaveBeenCalled();
  expect(text()).toContain('ungültig oder abgelaufen');
  expect(text()).not.toContain('private provider details');
  expect(text()).not.toContain('✅');
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(5_000); });
  expect(mockReplace).not.toHaveBeenCalled();
  act(() => tree.root.findByProps({ testID: 'auth-transition-back' }).props.onPress());
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
});

it('also recognizes OAuth errors delivered in the URL fragment', async () => {
  mockParams = {};
  mockRawUrl = 'com.lottibaby.app://auth/callback#error=server_error&error_code=flow_state_expired';
  await mount();
  expect(text()).toContain('ungültig oder abgelaufen');
  expect(mockGetSession).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('offers a clear return after provider cancellation', async () => {
  mockParams = { error: 'access_denied' };
  await mount();
  expect(text()).toContain('Anmeldung wurde abgebrochen');
  expect(mockReplace).not.toHaveBeenCalled();
});

it('routes a verified email directly to onboarding without an artificial success delay', async () => {
  await mount();
  expect(mockExchange).toHaveBeenCalledWith('email-code');
  expect(mockInvalidate).toHaveBeenCalledTimes(1);
  expect(mockOnboarding).toHaveBeenCalledWith('confirmed-user');
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/getUserInfo');
  expect(mockReplace).toHaveBeenCalledTimes(1);
});

it('routes an already complete account through the root guard', async () => {
  mockOnboarding.mockResolvedValue(true);
  await mount();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('preserves token-hash email verification', async () => {
  mockParams = { token_hash: 'email-hash', type: 'signup' };
  mockExchange.mockResolvedValue({ error: { code: 'invalid_code' } });
  await mount();
  expect(mockVerify).toHaveBeenCalledWith({ type: 'signup', token_hash: 'email-hash' });
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/getUserInfo');
});

it('preserves the token-pair callback', async () => {
  mockParams = {};
  mockRawUrl = 'com.lottibaby.app://auth/callback#access_token=test-access&refresh_token=test-refresh';
  await mount();
  expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' });
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/getUserInfo');
});

it('preserves password-recovery navigation after exchanging its code', async () => {
  mockParams = { code: 'recovery-code', type: 'recovery' };
  await mount();
  expect(mockExchange).toHaveBeenCalledWith('recovery-code');
  expect(mockReplace).toHaveBeenCalledWith('/auth/reset-password');
  expect(mockOnboarding).not.toHaveBeenCalled();
});

it('does not proceed with an invalid email or recovery link', async () => {
  mockParams = { code: 'invalid-code', type: 'recovery' };
  mockExchange.mockResolvedValue({ error: { code: 'invalid_code' } });
  await mount();
  expect(text()).toContain('Link ist ungültig oder abgelaufen');
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockGetSession).not.toHaveBeenCalled();
});

it('keeps missing-session feedback visible instead of bouncing silently to login', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  await mount();
  expect(text()).toContain('Bitte melde dich erneut an');
  await act(async () => { jest.advanceTimersByTime(5_000); });
  expect(mockReplace).not.toHaveBeenCalled();
});

it('ignores a pending exchange after leaving the callback screen', async () => {
  let finish!: (result: unknown) => void;
  mockExchange.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await mount();
  act(() => tree.unmount());
  await act(async () => { finish({ error: null }); });
  expect(mockGetSession).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
