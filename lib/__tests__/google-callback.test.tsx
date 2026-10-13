import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import GoogleCallback from '@/app/auth/google-callback';
import { GoogleAuthError } from '@/lib/google-auth';

const mockComplete = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();
const mockConsent = jest.fn();
const mockOnboarding = jest.fn();
const mockFinish = jest.fn();
let mockParams: { attempt?: string; code?: string };
jest.mock('@expo/ui', () => {
  const React = jest.requireActual('react');
  const { View, Text, Pressable } = jest.requireActual('react-native');
  return { Host: View, Button: ({ label, ...props }: any) => React.createElement(Pressable,
    { ...props, accessibilityRole: 'button' }, React.createElement(Text, null, label)) };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ completeGoogleSignIn: mockComplete, signOut: mockSignOut }) }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams, useRouter: () => ({ replace: mockReplace }), Stack: { Screen: () => null },
}));
jest.mock('expo-linking', () => ({
  useURL: () => null,
  createURL: (path: string, options: { queryParams: Record<string, string> }) =>
    `com.lottibaby.app://${path}?${new URLSearchParams(options.queryParams)}`,
}));
jest.mock('@/lib/termsConsent', () => ({ TERMS_VERSION: 'current', acceptTerms: (...args: unknown[]) => mockConsent(...args) }));
jest.mock('@/lib/onboarding', () => ({ getOnboardingCompletionState: (...args: unknown[]) => mockOnboarding(...args) }));
jest.mock('@/lib/google-auth', () => ({
  ...jest.requireActual('@/lib/google-auth'), finishGoogleSignIn: (...args: unknown[]) => mockFinish(...args),
}));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { attempt: 'own-attempt', code: 'auth-code' };
  mockComplete.mockResolvedValue({ session: { user: { id: 'same-user' } }, attempt: {
    id: 'own-attempt', termsVersion: 'current', source: 'signup', invitationCode: 'ABCD2345',
  } });
  mockConsent.mockResolvedValue({ success: true });
  mockOnboarding.mockResolvedValue(false);
  mockSignOut.mockResolvedValue({ error: null });
  mockFinish.mockResolvedValue(undefined);
});
afterEach(() => act(() => tree?.unmount()));
async function mount() { await act(async () => { tree = create(<GoogleCallback />); }); }

it('records consent for the authenticated user and preserves invitations through onboarding', async () => {
  await mount();
  expect(mockConsent).toHaveBeenCalledWith('signup', 'same-user');
  expect(mockOnboarding).toHaveBeenCalledWith('same-user');
  expect(mockFinish).toHaveBeenCalledWith('own-attempt');
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/getUserInfo', params: { invitationCode: 'ABCD2345' } });
});

it('routes an existing user with an invitation to family linking', async () => {
  mockOnboarding.mockResolvedValue(true);
  await mount();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/account-linking', params: { invitationCode: 'ABCD2345' } });
});

it('routes a complete account without invitation through the central root guard', async () => {
  mockOnboarding.mockResolvedValue(true);
  mockComplete.mockResolvedValue({ session: { user: { id: 'same-user' } }, attempt: {
    id: 'own-attempt', termsVersion: 'current', source: 'login',
  } });
  await mount();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('signs out and offers retry if consent cannot be recorded', async () => {
  mockConsent.mockResolvedValue({ success: false });
  await mount();
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockOnboarding).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(Text).some(n => String(n.props.children).includes('Zustimmung konnte nicht'))).toBe(true);
  act(() => tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
});

it('does not record outdated consent as the current version', async () => {
  mockComplete.mockResolvedValue({ session: { user: { id: 'same-user' } }, attempt: {
    id: 'own-attempt', termsVersion: 'outdated', source: 'login',
  } });
  await mount();
  expect(mockConsent).not.toHaveBeenCalled();
});

it('returns to login after provider cancellation without onboarding or consent', async () => {
  mockComplete.mockRejectedValue(new GoogleAuthError('cancelled'));
  await mount();
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  expect(mockConsent).not.toHaveBeenCalled();
  expect(mockOnboarding).not.toHaveBeenCalled();
});

it('rejects a missing callback and shows a usable return action', async () => {
  mockParams = {};
  await mount();
  expect(mockComplete).not.toHaveBeenCalled();
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function').length).toBeGreaterThan(0);
});

it('does not navigate after the callback screen has been left', async () => {
  let resolve!: (value: unknown) => void;
  mockComplete.mockImplementation(() => new Promise(r => { resolve = r; }));
  await mount();
  act(() => tree.unmount());
  await act(async () => { resolve({ session: { user: { id: 'late-user' } }, attempt: { id: 'own-attempt', termsVersion: 'current', source: 'login' } }); });
  expect(mockConsent).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
