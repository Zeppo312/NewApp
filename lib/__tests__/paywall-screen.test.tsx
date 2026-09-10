import React from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import PaywallScreen from '../../app/paywall';
import { PaywallPlansExperience } from '../../components/paywall/PaywallPlansExperience';
import { shouldShowPaywall, markPaywallShown } from '../paywall';
import { purchaseSubscriptionPlan, restoreRevenueCatPurchases, hasRevenueCatEntitlement } from '../revenuecat';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockParams = { next: '/(tabs)/sleep-tracker', origin: 'onboarding', trialExpired: '0' };
const mockRouter = { replace: mockReplace, back: mockBack, push: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'new-parent' } }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de', localeTag: 'de-DE' }) }));
jest.mock('@/components/paywall/PaywallPlansExperience', () => ({ PaywallPlansExperience: () => null }));
jest.mock('../paywall', () => ({ shouldShowPaywall: jest.fn(), markPaywallShown: jest.fn() }));
jest.mock('../appCache', () => ({ invalidatePremiumStatusCache: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../entitlements', () => ({ invalidateSubscriptionTierCache: jest.fn() }));
jest.mock('../paywallContent', () => ({
  DEFAULT_PAYWALL_CONTENT: { plans: {} },
  fetchPaywallContent: jest.fn().mockResolvedValue({ content: { plans: {} } }),
  formatEuroAmount: (amount: number) => `${amount} €`,
}));
jest.mock('../paywallTranslations', () => ({
  localizePaywallPlansContent: () => ({}),
  translatePaywall: (_locale: string, key: string) => key,
}));
jest.mock('../revenuecat', () => ({
  getRevenueCatConfigurationIssue: () => null,
  getRevenueCatPlanPricing: jest.fn().mockResolvedValue({}),
  purchaseSubscriptionPlan: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
  hasRevenueCatEntitlement: jest.fn(),
}));

describe('mandatory paywall', () => {
  let tree: ReactTestRenderer;
  const originalOS = Platform.OS;
  const props = () => tree.root.findByType(PaywallPlansExperience).props;
  const mount = async () => { await act(async () => { tree = create(<PaywallScreen />); }); };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    jest.mocked(shouldShowPaywall).mockResolvedValue({ shouldShow: true } as any);
    jest.mocked(markPaywallShown).mockResolvedValue({ error: null });
  });
  afterEach(() => {
    act(() => tree?.unmount());
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('ignores a dismissible route parameter and keeps cancelled or unverified purchases locked', async () => {
    await mount();
    expect(props().isTrialExpired).toBe(true);
    expect(props().allowClose).toBe(false);
    act(() => props().onClose());
    expect(mockBack).not.toHaveBeenCalled();
    jest.mocked(purchaseSubscriptionPlan).mockRejectedValueOnce({ userCancelled: true });
    await act(async () => props().onPurchase('standard', 'monthly'));
    expect(mockReplace).not.toHaveBeenCalled();
    jest.mocked(purchaseSubscriptionPlan).mockResolvedValueOnce(false);
    await act(async () => props().onPurchase('standard', 'monthly'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens the chosen onboarding destination only after a confirmed purchase', async () => {
    await mount();
    jest.mocked(purchaseSubscriptionPlan).mockResolvedValueOnce(true);
    await act(async () => props().onPurchase('standard', 'monthly'));
    expect(mockReplace).toHaveBeenCalledWith(mockParams.next);
  });

  it('requires an active entitlement when restoring', async () => {
    await mount();
    jest.mocked(restoreRevenueCatPurchases).mockResolvedValueOnce(false);
    jest.mocked(hasRevenueCatEntitlement).mockResolvedValueOnce(false);
    await act(async () => props().onRestorePress());
    expect(mockReplace).not.toHaveBeenCalled();
    jest.mocked(restoreRevenueCatPurchases).mockResolvedValueOnce(true);
    await act(async () => props().onRestorePress());
    expect(mockReplace).toHaveBeenCalledWith(mockParams.next);
  });

  it('never uses unsupported web purchases or restores as a bypass', async () => {
    Platform.OS = 'web';
    await mount();
    await act(async () => props().onPurchase('standard', 'monthly'));
    await act(async () => props().onRestorePress());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(props().visiblePurchaseError).toBe('unavailable');
  });

  it('stays locked when access checks or view recording fail', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(shouldShowPaywall).mockRejectedValueOnce(new Error('offline'));
    jest.mocked(markPaywallShown).mockRejectedValueOnce(new Error('offline'));
    await mount();
    expect(props().isTrialExpired).toBe(true);
    expect(props().allowClose).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('allows an existing subscriber to close a voluntary upgrade paywall', async () => {
    jest.mocked(shouldShowPaywall).mockResolvedValueOnce({ shouldShow: false } as any);
    await mount();
    expect(props().isTrialExpired).toBe(false);
    act(() => props().onClose());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
