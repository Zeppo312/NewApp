import React from 'react';
import { Alert, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Screen from '@/app/account-deletion';
import { deleteOwnAccount, getDeletionAvailability, getDirectDeletionStatus, requestAccountDeletion, sendDeletionVerification, verifyDeletionCode } from '@/lib/accountDeletion';
import { deletionCopy } from '@/lib/accountDeletionCopy';
const mockSignOut = jest.fn();
const mockBack = jest.fn(); const mockReplace = jest.fn(); let mockCanGoBack = true;
let mockScope = 'account';
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' }, signOut: mockSignOut }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }), useLocalSearchParams: () => ({ scope: mockScope }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: jest.requireActual('react-native').View }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/lib/revenuecat', () => ({ getRevenueCatSubscriptionSummary: jest.fn() }));
jest.mock('@/lib/subscriptionManagement', () => ({ openSubscriptionManagement: jest.fn() }));
jest.mock('@/lib/accountDeletion', () => ({ ACCOUNT_DELETION_URL: 'https://lottibaby.de/konto-loeschen', getDeletionAvailability: jest.fn(), getDirectDeletionStatus: jest.fn(), deleteOwnAccount: jest.fn(), isAppleLinkedUser: () => false, revokeAppleSignIn: jest.fn(), requestAccountDeletion: jest.fn(), sendDeletionVerification: jest.fn(), verifyDeletionCode: jest.fn() }));
let tree: ReactTestRenderer;
beforeEach(() => {
 jest.clearAllMocks(); mockScope = 'account'; mockCanGoBack = true;
 jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
 (getDirectDeletionStatus as jest.Mock).mockResolvedValue('unavailable');
 (deleteOwnAccount as jest.Mock).mockResolvedValue(undefined);
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
it.each([true, false])('can leave without a deletion request (history: %s)', async (history) => {
 mockCanGoBack = history;
 await ready();
 const cancel = tree.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && n.findAll(c => c.props.children === deletionCopy.de.cancel).length > 0)[0];
 act(() => cancel.props.onPress());
 expect(history ? mockBack : mockReplace).toHaveBeenCalledWith(...(history ? [] : ['/app-settings']));
 expect(requestAccountDeletion).not.toHaveBeenCalled(); expect(mockSignOut).not.toHaveBeenCalled();
});
it('keeps a failed submission retryable and calls it requested only after acceptance', async () => {
 await ready(); (requestAccountDeletion as jest.Mock).mockRejectedValueOnce(new Error('offline'));
 const confirm = () => tree.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
 await act(async () => { await confirm().props.onPress(); });
 expect(mockSignOut).not.toHaveBeenCalled();
 expect(Alert.alert).not.toHaveBeenCalledWith(deletionCopy.de.acceptedTitle, expect.anything());
 await act(async () => { await confirm().props.onPress(); });
 expect(requestAccountDeletion).toHaveBeenCalledTimes(2);
 expect(Alert.alert).toHaveBeenLastCalledWith(deletionCopy.de.acceptedTitle, expect.stringContaining('test-receipt'));
});

const pressByText = async (text: string) => {
 const button = tree.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && n.findAll(c => c.props.children === text).length > 0)[0];
 await act(async () => { await button.props.onPress(); });
 return button;
};
describe('standalone accounts', () => {
 beforeEach(() => { (getDirectDeletionStatus as jest.Mock).mockResolvedValue({ available: true, pending: null }); });
 it('deletes directly only after the confirmation word, without OTP or support request', async () => {
  await act(async () => { tree = create(<Screen />); });
  const button = await pressByText(deletionCopy.de.deleteNow);
  expect(button.props.disabled).toBe(true); expect(deleteOwnAccount).not.toHaveBeenCalled();
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText('löschen'); });
  await pressByText(deletionCopy.de.deleteNow);
  expect(deleteOwnAccount).toHaveBeenCalledWith('account'); expect(mockSignOut).toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(deletionCopy.de.deletedTitle, deletionCopy.de.deleted);
  expect(getDeletionAvailability).not.toHaveBeenCalled(); expect(sendDeletionVerification).not.toHaveBeenCalled(); expect(requestAccountDeletion).not.toHaveBeenCalled();
 });
 it('keeps the user signed in and retryable when direct deletion fails', async () => {
  (deleteOwnAccount as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await act(async () => { tree = create(<Screen />); });
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText('LÖSCHEN'); });
  await pressByText(deletionCopy.de.deleteNow);
  expect(mockSignOut).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenCalledWith(deletionCopy.de.title, deletionCopy.de.directError);
 });
 it('resets only app data for the data scope', async () => {
  mockScope = 'data';
  await act(async () => { tree = create(<Screen />); });
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText('LÖSCHEN'); });
  await pressByText(deletionCopy.de.resetNow);
  expect(deleteOwnAccount).toHaveBeenCalledWith('data');
  expect(Alert.alert).toHaveBeenCalledWith(deletionCopy.de.resetDoneTitle, deletionCopy.de.resetDone);
 });
});
it('resumes a started deletion in its original scope', async () => {
 mockScope = 'data';
 (getDirectDeletionStatus as jest.Mock).mockResolvedValue({ available: true, pending: 'account' });
 await act(async () => { tree = create(<Screen />); });
 expect(tree.root.findAll(n => n.props.children === deletionCopy.de.resumeHint).length).toBeGreaterThan(0);
 await act(async () => { tree.root.findByType(TextInput).props.onChangeText('LÖSCHEN'); });
 await pressByText(deletionCopy.de.resumeNow);
 expect(deleteOwnAccount).toHaveBeenCalledWith('account');
});
it('explains a partner link and keeps the reviewed request path for shared accounts', async () => {
 (getDirectDeletionStatus as jest.Mock).mockResolvedValue({ available: false, reason: 'linked_account' });
 await act(async () => { tree = create(<Screen />); });
 expect(tree.root.findAll(n => n.props.children === deletionCopy.de.sharedLinked).length).toBeGreaterThan(0);
 expect(getDeletionAvailability).toHaveBeenCalledTimes(1); expect(deleteOwnAccount).not.toHaveBeenCalled();
});
