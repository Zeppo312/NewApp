import React from 'react';
import { TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import CaretakerGuestScreen from '@/components/caretaker/caretaker-guest-screen';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';
import { CareSession } from '@/components/caretaker/caretaker-screen';
import { acceptCaretakerGuestInvitation, loadCaretakerGuestSession } from '@/lib/caretaker-guest';
import { caretakerCopy } from '@/lib/caretaker-copy';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/caretaker-guest', () => ({ acceptCaretakerGuestInvitation: jest.fn(), loadCaretakerGuestSession: jest.fn(), createCaretakerGuestRequest: () => jest.fn(), forgetCaretakerGuestSession: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string, options: any) => `com.lottibaby.app://${path.replace(/^\//, '')}?code=${options.queryParams.code}` }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), Stack: { Screen: () => null }, router: { setParams: jest.fn() }, useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/components/Header', () => () => null);
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/constants/DesignGuide', () => ({ LiquidGlassCard: jest.requireActual('react-native').View }));
jest.mock('@/components/caretaker/caretaker-screen', () => ({
  CareSession: () => null,
  useCaretakerUi: () => {
    const React = require('react'); const { Text, Pressable } = require('react-native');
    return { t: require('@/lib/caretaker-copy').caretakerCopy('de'), locale: 'de',
      text: (label: string) => React.createElement(Text, {}, label),
      button: (label: string, onPress: () => void, disabled: boolean) => React.createElement(Pressable, { accessibilityLabel: label, onPress, disabled }),
    };
  },
}));
const t = caretakerCopy('de');
const code = '1234567890abcdef1234567890abcdef';
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks(); jest.mocked(loadCaretakerGuestSession).mockResolvedValue(null);
  jest.mocked(acceptCaretakerGuestInvitation).mockResolvedValue({ token: 'a'.repeat(64), grantId: 'grant' });
});
afterEach(() => { if (tree) act(() => tree.unmount()); });
it('opens the existing scanner without an account and enters care after a scan', async () => {
  await act(async () => { tree = create(<CaretakerGuestScreen />); });
  const scanner = tree.root.findByType(AccountLinkingQrModal);
  expect(scanner.props.code).toBeNull();
  await act(async () => scanner.props.onScanned(code));
  expect(acceptCaretakerGuestInvitation).toHaveBeenCalledWith(code);
  expect(tree.root.findByType(CareSession).props.grantId).toBe('grant');
});
it('offers manual entry when scanning is unavailable', async () => {
  await act(async () => { tree = create(<CaretakerGuestScreen />); });
  act(() => tree.root.findByType(AccountLinkingQrModal).props.onClose());
  expect(tree.root.findByType(TextInput).props.accessibilityLabel).toBe(t.code);
  act(() => tree.root.findByType(TextInput).props.onChangeText(code));
  await act(async () => tree.root.findAllByProps({ accessibilityLabel: t.guestStart })[0].props.onPress());
  expect(tree.root.findByType(CareSession)).toBeDefined();
});
it('resumes a saved guest session without scanning again', async () => {
  jest.mocked(loadCaretakerGuestSession).mockResolvedValue({ token: 'a'.repeat(64), grantId: 'saved-grant' });
  await act(async () => { tree = create(<CaretakerGuestScreen />); });
  expect(tree.root.findByType(CareSession).props.grantId).toBe('saved-grant');
  expect(acceptCaretakerGuestInvitation).not.toHaveBeenCalled();
});
