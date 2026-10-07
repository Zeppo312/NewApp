import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import GetUserInfoScreen from '../../app/(auth)/getUserInfo';
import { AccountLinkingQrModal } from '@/components/account-linking-qr-modal';
import { translateOnboardingText } from '@/lib/onboardingTranslations';
import { LinkedBabySelectionModal } from '@/components/LinkedBabySelectionModal';

const mockUser = { id: 'invited-user' };
let mockParams: { invitationCode?: string } = {};
const mockReplace = jest.fn();
const mockRedeem = jest.fn();
const mockSelection = jest.fn();
const mockSaveBaby = jest.fn();
const mockProfile = jest.fn();
const mockSettingsInsert = jest.fn();
const mockSettingsUpdate = jest.fn();
const mockSettingsRead = jest.fn();
const mockUpdateUser = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(true);
const mockPaywall = jest.fn();
const mockRefreshFamily = jest.fn().mockResolvedValue({ status: 'active' });
const mockInvalidateFamily = jest.fn();
const mockInvalidatePremium = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ refreshBabies: mockRefresh, activeBaby: null }) }));
jest.mock('@/contexts/BabyStatusContext', () => ({ useBabyStatus: () => ({ refreshBabyDetails: mockRefresh }) }));
jest.mock('@/contexts/OnboardingStatusContext', () => ({ useOnboardingStatus: () => ({ refresh: mockRefresh }) }));
jest.mock('@/lib/paywall', () => ({
  shouldShowPaywall: (...args: any[]) => mockPaywall(...args),
  shouldRedirectToPaywallForState: jest.requireActual('../paywallDecision').shouldRedirectToPaywallForState,
}));
jest.mock('@/lib/familySubscriptionAccess', () => ({
  invalidateFamilyAccess: (...args: any[]) => mockInvalidateFamily(...args),
  refreshFamilyAccess: (...args: any[]) => mockRefreshFamily(...args),
}));
jest.mock('@/lib/appCache', () => ({
  invalidateUserProfileCache: jest.fn(), invalidateUserSettingsCache: jest.fn(),
  invalidatePremiumStatusCache: (...args: any[]) => mockInvalidatePremium(...args),
}));
jest.mock('@/lib/redeemInvitationCodeFixed', () => ({ redeemInvitationCodeFixed: (...args: any[]) => mockRedeem(...args) }));
jest.mock('@/lib/baby', () => ({
  getLinkedBabySelectionOptions: (...args: any[]) => mockSelection(...args),
  saveBabyInfo: (...args: any[]) => mockSaveBaby(...args),
}));
jest.mock('@/lib/supabase', () => ({
  buildInvitationLink: () => 'com.lottibaby.app://invite?code=',
  supabase: {
    auth: { updateUser: (...args: any[]) => mockUpdateUser(...args) },
    from: (table: string) => table === 'profiles' ? { upsert: mockProfile } : {
      select: () => ({ eq: () => ({ maybeSingle: mockSettingsRead }) }),
      insert: mockSettingsInsert, update: mockSettingsUpdate,
    },
  },
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null }, router: { replace: (...args: any[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/onboarding/surfaces', () => ({
  OnboardingSurface: jest.requireActual('react-native').View,
  OnboardingTransition: jest.requireActual('react-native').View,
  OnboardingChoice: jest.requireActual('react-native').TouchableOpacity,
}));
jest.mock('@/components/onboarding/personalized-steps', () => ({ SurveyStep: () => null, ProductTryout: () => null }));
jest.mock('@/components/onboarding/value-steps', () => ({ ValueStep: () => null, FeedbackStep: () => null, HabitStep: () => null }));
jest.mock('@/components/onboarding/wellbeing-step', () => ({ WellbeingStep: () => null, wellbeingCopy: () => ({ skip: 'Überspringen' }) }));
jest.mock('@/components/onboarding/product-moment', () => ({ OnboardingProductMoment: () => null }));
jest.mock('@/components/modals/IOSBottomDatePicker', () => () => null);
jest.mock('@/components/ui/DateTimePicker', () => () => null);
jest.mock('@/components/LinkedBabySelectionModal', () => ({ LinkedBabySelectionModal: () => null }));
jest.mock('@/components/account-linking-qr-modal', () => ({ AccountLinkingQrModal: () => null }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));

let tree: ReactTestRenderer;
const press = async (text: string) => {
  const button = tree.root.findAllByType(TouchableOpacity).find(node =>
    node.props.accessibilityLabel === text || node.findAllByType(Text).some(label => label.props.children === text));
  expect(button).toBeDefined();
  expect(button!.props.disabled).not.toBe(true);
  await act(async () => { await button!.props.onPress(); });
};
const next = async () => {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  const button = buttons.find(node => node.props.accessibilityState && node.props.accessibilityRole === 'button');
  expect(button!.props.disabled).not.toBe(true);
  await act(async () => { await button!.props.onPress(); });
};
const basics = async () => {
  await act(async () => { tree = create(<GetUserInfoScreen />); });
  await next();
  act(() => tree.root.findByType(TextInput).props.onChangeText('  Alex  '));
  await next();
  await press('Papa');
};
const invitation = async () => { await basics(); await press('Ich habe einen Einladungscode'); };
const scan = async () => {
  await press('QR-Code scannen');
  await act(async () => { tree.root.findByType(AccountLinkingQrModal).props.onScanned('AABBCCDD001142228333AABBCCDDEEFF'); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockRedeem.mockResolvedValue({ success: true, linkedUserId: 'parent', creatorInfo: { firstName: 'Sam' }, syncedData: { isBabyBorn: true, dueDate: null } });
  mockSelection.mockResolvedValue({ data: [{ id: 'baby', is_shared_between_accounts: true }], error: null });
  mockProfile.mockResolvedValue({ error: null });
  mockSettingsRead.mockResolvedValue({ data: { id: 'settings' }, error: null });
  mockSettingsInsert.mockResolvedValue({ error: null });
  mockPaywall.mockResolvedValue({ shouldShow: false, state: { subscriptionStatus: 'active', accessReason: 'family_subscription' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); });

it('scans, saves name/role and opens the shared home without surveys or duplicate baby data', async () => {
  await invitation();
  await scan();
  expect(mockRedeem).toHaveBeenCalledWith(mockUser.id, 'AABBCCDD001142228333AABBCCDDEEFF');
  expect(mockProfile).toHaveBeenCalledWith(expect.objectContaining({ id: mockUser.id, first_name: 'Alex', user_role: 'papa' }));
  expect(mockSettingsUpdate).not.toHaveBeenCalled();
  expect(mockSaveBaby).not.toHaveBeenCalled();
  expect(mockUpdateUser).not.toHaveBeenCalled();
  expect(mockRefreshFamily).toHaveBeenCalledWith(mockUser.id, { force: true });
  expect(mockRefreshFamily.mock.invocationCallOrder[0]).toBeLessThan(mockPaywall.mock.invocationCallOrder[0]);
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
});

it('redeems a typed code through the same short flow', async () => {
  await invitation();
  act(() => tree.root.findByType(TextInput).props.onChangeText(' abcd 2345 '));
  await press('Code einlösen');
  expect(mockRedeem).toHaveBeenCalledWith(mockUser.id, 'ABCD2345');
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
});

it('waits for name and role before redeeming an invitation link', async () => {
  mockParams = { invitationCode: 'ABCD2345' };
  await basics();
  expect(mockRedeem).not.toHaveBeenCalled();
  await next();
  expect(mockRedeem).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
});

it('keeps multiple babies behind a selection before saving and entering the app', async () => {
  mockSelection.mockResolvedValue({ data: [{ id: 'one' }, { id: 'two' }], error: null });
  await invitation(); await scan();
  expect(tree.root.findByType(LinkedBabySelectionModal).props.visible).toBe(true);
  expect(mockProfile).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { await tree.root.findByType(LinkedBabySelectionModal).props.onApplied(); });
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
});

it('leaves an invalid code editable without completing registration', async () => {
  mockRedeem.mockResolvedValue({ success: false });
  await invitation(); await scan();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockProfile).not.toHaveBeenCalled();
  expect(tree.root.findByType(TextInput).props.editable).toBe(true);
});

it('retries a failed save without redeeming a consumed code again', async () => {
  mockProfile.mockResolvedValueOnce({ error: new Error('offline') });
  await invitation(); await scan();
  expect(mockReplace).not.toHaveBeenCalled();
  await press('App öffnen');
  expect(mockProfile).toHaveBeenCalledTimes(2);
  expect(mockRedeem).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
});

it('retains the subscription check when the invitation does not grant access', async () => {
  mockPaywall.mockResolvedValue({ shouldShow: true, state: { subscriptionStatus: 'inactive', accessReason: 'none' } });
  await invitation(); await scan();
  expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/paywall', params: expect.objectContaining({ next: '/(tabs)/home' }) }));
});

it.each(['unavailable', 'error'])('leaves unresolved onboarding access to the root recovery gate on %s instead of opening a purchase screen', async failure => {
  if (failure === 'error') mockPaywall.mockRejectedValue(new Error('offline'));
  else mockPaywall.mockResolvedValue({ shouldShow: true, state: { subscriptionStatus: 'unavailable', accessReason: 'none' } });
  await invitation(); await scan();
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
  expect(mockReplace).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/paywall' }));
});

it('returns from the scanner to manual entry without redeeming anything', async () => {
  await invitation(); await press('QR-Code scannen');
  act(() => tree.root.findByType(AccountLinkingQrModal).props.onClose());
  expect(tree.root.findAllByType(AccountLinkingQrModal)).toHaveLength(0);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  expect(mockRedeem).not.toHaveBeenCalled();
});

it('still asks for baby details when continuing without a code', async () => {
  await invitation(); await press('Ohne Code weiter');
  expect(tree.root.findAllByType(Text).some(node => node.props.children === translateOnboardingText('de', 'flow.stageTitle'))).toBe(true);
});


it('opens the pregnancy home and creates missing settings from the invitation', async () => {
  mockRedeem.mockResolvedValue({ success: true, linkedUserId: 'parent', syncedData: { isBabyBorn: false, dueDate: '2027-01-01T00:00:00.000Z' } });
  mockSettingsRead.mockResolvedValue({ data: null, error: null });
  await invitation(); await scan();
  expect(mockSettingsInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: mockUser.id, is_baby_born: false, due_date: '2027-01-01T00:00:00.000Z' }));
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/pregnancy-home');
});

it('does not enter the app when saving missing settings fails', async () => {
  mockSettingsRead.mockResolvedValue({ data: null, error: null });
  mockSettingsInsert.mockResolvedValue({ error: new Error('offline') });
  await invitation(); await scan();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalled();
});

it('does not bypass baby selection when its lookup fails', async () => {
  mockSelection.mockResolvedValue({ data: null, error: new Error('offline') });
  await invitation(); await scan();
  expect(tree.root.findByType(LinkedBabySelectionModal).props.visible).toBe(true);
  expect(mockProfile).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('prevents duplicate redemption while a scan is being processed', async () => {
  let resolve!: (value: unknown) => void;
  mockRedeem.mockImplementation(() => new Promise(done => { resolve = done; }));
  await invitation(); await press('QR-Code scannen');
  const onScanned = tree.root.findByType(AccountLinkingQrModal).props.onScanned;
  act(() => { onScanned('ABCD2345'); onScanned('ABCD2345'); });
  expect(mockRedeem).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ success: true, syncedData: { isBabyBorn: true } }); });
  expect(mockProfile).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
});
