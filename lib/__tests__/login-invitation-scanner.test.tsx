import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import LoginScreen from '@/app/(auth)/login';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';

let mockParams: { invitationCode?: string } = {};
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({}) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/termsConsent', () => ({ acceptTerms: jest.fn(), TERMS_VERSION: 'test' }));
jest.mock('expo-linking', () => ({ createURL: () => 'com.lottibaby.app://invite?code=' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, Stack: { Screen: () => null }, router: {} }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));

let tree: ReactTestRenderer;
const press = (text: string) => {
  const button = tree.root.findAllByType(TouchableOpacity).find(node =>
    node.findAllByType(Text).some(label => label.props.children === text));
  expect(button).toBeDefined();
  act(() => button!.props.onPress());
};
beforeEach(() => { mockParams = {}; });
afterEach(() => { act(() => tree?.unmount()); });

it('scans the optional registration code and preserves credentials while returning to signup', () => {
  act(() => { tree = create(<LoginScreen />); });
  press('Noch kein Konto? Registrieren');
  act(() => {
    tree.root.findAllByType(TextInput)[0].props.onChangeText('parent@example.com');
    tree.root.findAllByType(TextInput)[1].props.onChangeText('password');
  });
  press('Ich habe einen Einladungscode');
  press('QR-Code scannen');
  const code = 'AABBCCDD001142228333AABBCCDDEEFF';
  act(() => tree.root.findByType(AccountLinkingQrModal).props.onScanned(code));
  expect(tree.root.findAllByType(AccountLinkingQrModal)).toHaveLength(0);
  expect(tree.root.findAllByType(TextInput).map(node => node.props.value)).toEqual(['parent@example.com', 'password', code]);
});

it('keeps an invitation link when switching from login to registration', () => {
  mockParams = { invitationCode: 'ABCD2345' };
  act(() => { tree = create(<LoginScreen />); });
  press('Noch kein Konto? Registrieren');
  expect(tree.root.findAllByType(TextInput).some(node => node.props.value === 'ABCD2345')).toBe(true);
});
