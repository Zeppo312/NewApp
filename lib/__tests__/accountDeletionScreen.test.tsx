import React from 'react';
import { Alert, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Screen from '@/app/account-deletion';
import { getDeletionAvailability, requestAccountDeletion, sendDeletionVerification, verifyDeletionCode } from '@/lib/accountDeletion';
import { deletionCopy } from '@/lib/accountDeletionCopy';
const mockSignOut = jest.fn();
let mockScope = 'account';
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' }, signOut: mockSignOut }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({ scope: mockScope }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/lib/revenuecat', () => ({ getRevenueCatSubscriptionSummary: jest.fn() }));
jest.mock('@/lib/subscriptionManagement', () => ({ openSubscriptionManagement: jest.fn() }));
jest.mock('@/lib/accountDeletion', () => ({ ACCOUNT_DELETION_URL: 'https://lottibaby.de/konto-loeschen', getDeletionAvailability: jest.fn(), requestAccountDeletion: jest.fn(), sendDeletionVerification: jest.fn(), verifyDeletionCode: jest.fn() }));
let tree: ReactTestRenderer;
beforeEach(() => {
 jest.clearAllMocks(); mockScope = 'account';
 jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
 (getDeletionAvailability as jest.Mock).mockResolvedValue('available');
 (sendDeletionVerification as jest.Mock).mockResolvedValue('test@example.invalid');
 (verifyDeletionCode as jest.Mock).mockResolvedValue('verified-test-token');
 (requestAccountDeletion as jest.Mock).mockResolvedValue({ requestId: 'test-receipt', status: 'queued', scope: 'account' });
 mockSignOut.mockResolvedValue({ error: null });
});
afterEach(() => { if (tree) act(() => tree.unmount()); jest.restoreAllMocks(); });
async function ready() {
 await act(async () => { tree = create(<Screen />); });
 await act(async () => { tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress(); });
 await act(async () => { tree.root.findByType(TextInput).props.onChangeText('123456'); });
}
it('never requests deletion on opening or requesting the verification code', async () => {
 await ready();
 expect(sendDeletionVerification).toHaveBeenCalledTimes(1);
 expect(requestAccountDeletion).not.toHaveBeenCalled();
});
it('a failed verification neither requests deletion nor logs the user out', async () => {
 await ready(); (verifyDeletionCode as jest.Mock).mockRejectedValueOnce(new Error('bad code'));
 await act(async () => { tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress(); });
 expect(requestAccountDeletion).not.toHaveBeenCalled(); expect(mockSignOut).not.toHaveBeenCalled();
 expect(Alert.alert).toHaveBeenCalledWith(deletionCopy.de.title, deletionCopy.de.error);
});
it('keeps the accepted receipt visible even when local logout throws', async () => {
 await ready(); mockSignOut.mockRejectedValueOnce(new Error('device failure'));
 await act(async () => { tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress(); });
 expect(verifyDeletionCode).toHaveBeenCalledWith('test@example.invalid', '123456', 'test-user');
 expect(requestAccountDeletion).toHaveBeenCalledWith('account','verified-test-token');
 expect(Alert.alert).toHaveBeenCalledWith(deletionCopy.de.acceptedTitle, expect.stringContaining('test-receipt'));
 expect(Alert.alert).not.toHaveBeenCalledWith(deletionCopy.de.title, deletionCopy.de.error);
});
it('preserves an explicit data-only request', async () => {
 mockScope = 'data'; await ready();
 await act(async () => { tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress(); });
 expect(requestAccountDeletion).toHaveBeenCalledWith('data','verified-test-token');
});
it('uses support without an OTP form when the service is disabled', async () => {
 (getDeletionAvailability as jest.Mock).mockResolvedValue('support');
 await act(async () => { tree = create(<Screen />); });
 expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
 expect(tree.root.findAll(node => node.props.children === deletionCopy.de.supportOnly).length).toBeGreaterThan(0);
 expect(sendDeletionVerification).not.toHaveBeenCalled();
 expect(requestAccountDeletion).not.toHaveBeenCalled();
});
it('can retry an unavailable service without requesting a verification code', async () => {
 (getDeletionAvailability as jest.Mock).mockResolvedValueOnce('unavailable').mockResolvedValueOnce('available');
 await act(async () => { tree = create(<Screen />); });
 await act(async () => { tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress(); });
 expect(getDeletionAvailability).toHaveBeenCalledTimes(2);
 expect(sendDeletionVerification).not.toHaveBeenCalled();
});
