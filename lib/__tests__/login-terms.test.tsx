import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
import LoginScreen from '@/app/(auth)/login';

const mockEmail = jest.fn();
const mockSignup = jest.fn();
const mockApple = jest.fn();
const mockGoogle = jest.fn();
const mockSignOut = jest.fn();
const mockConsent = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockProfile = jest.fn();
let mockLocale: 'de' | 'en' | 'es' = 'de';
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: mockLocale }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  signInWithEmail: mockEmail, signUpWithEmail: mockSignup, signInWithApple: mockApple,
  signInWithGoogle: mockGoogle, signOut: mockSignOut,
}) }));
jest.mock('@/lib/supabase', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ single: () => mockProfile() }) }) }),
} }));
jest.mock('@/lib/termsConsent', () => ({
  acceptTerms: (...args: unknown[]) => mockConsent(...args), TERMS_VERSION: 'current',
}));
jest.mock('@/lib/google-auth', () => ({ googleAuthErrorKey: () => 'login.googleFailed' }));
jest.mock('expo-linking', () => ({ createURL: () => 'com.lottibaby.app://invite?code=' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}), Stack: { Screen: () => null },
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));

let tree: ReactTestRenderer;
const originalOS = Platform.OS;
const button = (label: string) => [...tree.root.findAllByType(TouchableOpacity),
  ...tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')].find(node =>
  node.findAllByType(Text).some(text => text.props.children === label))!;
const mount = () => act(() => { tree = create(<LoginScreen />); });
const enterCredentials = () => act(() => {
  const [email, password] = tree.root.findAllByType(TextInput);
  email.props.onChangeText('parent@example.com');
  password.props.onChangeText('password');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'de';
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockEmail.mockResolvedValue({ data: { session: { user: { id: 'email-user' } } }, error: null });
  mockSignup.mockResolvedValue({ data: { user: { id: 'new-user' }, session: null }, error: null });
  mockApple.mockResolvedValue({ data: { user: { id: 'apple-user' } }, error: null });
  mockGoogle.mockResolvedValue({ status: 'cancelled' });
  mockConsent.mockResolvedValue({ success: true });
  mockProfile.mockResolvedValue({ data: { first_name: 'Parent' }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  act(() => tree?.unmount());
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  jest.restoreAllMocks();
});

it.each([
  ['de', 'Mit dem Fortfahren akzeptierst du unsere', 'Wie wir deine Daten verarbeiten, erfährst du in der'],
  ['en', 'By continuing, you accept our', 'Learn how we process your data in our'],
  ['es', 'Al continuar, aceptas nuestras', 'Consulta cómo tratamos tus datos en nuestra'],
] as const)('shows acceptance and separate privacy information in %s', (locale, terms, privacy) => {
  mockLocale = locale;
  mount();
  const content = JSON.stringify(tree.toJSON());
  expect(content).toContain(terms);
  expect(content).toContain(privacy);
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'checkbox')).toHaveLength(0);
  expect(mockConsent).not.toHaveBeenCalled();
});

it('opens both legal documents without recording acceptance', () => {
  mount();
  const links = tree.root.findAllByType(Text).filter(node => node.props.accessibilityRole === 'link');
  act(() => { links[0].props.onPress(); links[1].props.onPress(); });
  expect(mockPush.mock.calls).toEqual([['/nutzungsbedingungen'], ['/datenschutz']]);
  expect(mockConsent).not.toHaveBeenCalled();
  expect(tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
});

it('keeps Android Google and email actions available immediately', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mount();
  expect(button('Anmelden').props.disabled).toBe(false);
  expect(button('Mit Google anmelden').props.disabled).toBe(false);
  expect(button('Mit Apple anmelden')).toBeUndefined();
});

it('records Apple acceptance only after authentication succeeds', async () => {
  mount();
  expect(button('Mit Apple anmelden').props.disabled).toBe(false);
  await act(async () => { await button('Mit Apple anmelden').props.onPress(); });
  expect(mockConsent).toHaveBeenCalledWith('login', 'apple-user');
  expect(mockApple.mock.invocationCallOrder[0]).toBeLessThan(mockConsent.mock.invocationCallOrder[0]);
  expect(mockConsent.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('does not record Apple acceptance on cancellation and permits retry', async () => {
  mockApple.mockResolvedValue({ data: null, error: { message: 'Anmeldung abgebrochen' } });
  mount();
  await act(async () => { await button('Mit Apple anmelden').props.onPress(); });
  expect(mockConsent).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(button('Mit Apple anmelden').props.disabled).toBe(false);
  mockApple.mockResolvedValue({ data: { user: { id: 'apple-user' } }, error: null });
  await act(async () => { await button('Mit Apple anmelden').props.onPress(); });
  expect(mockConsent).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('waits for email acceptance before continuing and disables concurrent sign-in actions', async () => {
  let finishConsent!: (result: { success: boolean }) => void;
  mockConsent.mockImplementationOnce(() => new Promise(resolve => { finishConsent = resolve; }));
  mount();
  enterCredentials();
  let login!: Promise<void>;
  await act(async () => { login = button('Anmelden').props.onPress(); });
  expect(mockEmail).toHaveBeenCalledWith('parent@example.com', 'password');
  expect(mockConsent).toHaveBeenCalledWith('login', 'email-user');
  expect(mockReplace).not.toHaveBeenCalled();
  for (const label of ['Anmelden...', 'Mit Google anmelden', 'Mit Apple anmelden']) {
    expect(button(label).props.disabled).toBe(true);
  }
  await act(async () => { finishConsent({ success: true }); await login; });
  expect(mockReplace).toHaveBeenCalledWith('/');
  expect(button('Anmelden').props.disabled).toBe(false);
});

it.each(['email', 'apple'] as const)('blocks continuation and allows retry when %s acceptance cannot be saved', async provider => {
  mockConsent.mockResolvedValueOnce({ success: false });
  mount();
  if (provider === 'email') enterCredentials();
  const label = provider === 'email' ? 'Anmelden' : 'Mit Apple anmelden';
  await act(async () => { await button(label).props.onPress(); });
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(button(label).props.disabled).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('Die Zustimmung konnte nicht sicher gespeichert werden.');
  await act(async () => { await button(label).props.onPress(); });
  expect(mockReplace).toHaveBeenCalledWith('/');
});

it('does not record acceptance for invalid email credentials', async () => {
  mockEmail.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });
  mount();
  enterCredentials();
  await act(async () => { await button('Anmelden').props.onPress(); });
  expect(mockConsent).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(button('Anmelden').props.disabled).toBe(false);
});

it('preserves the accepted version through email registration and OTP verification', async () => {
  mount();
  act(() => button('Noch kein Konto? Registrieren').props.onPress());
  enterCredentials();
  expect(button('Registrieren').props.disabled).toBe(false);
  await act(async () => { await button('Registrieren').props.onPress(); });
  expect(mockSignup).toHaveBeenCalledWith('parent@example.com', 'password', {
    version: 'current', acceptedAt: expect.any(String),
  });
  expect(mockConsent).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: './verify-otp', params: { email: 'parent@example.com', invitationCode: undefined },
  });
});
