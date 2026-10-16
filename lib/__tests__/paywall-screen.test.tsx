import { refreshFamilyAccess } from '../familySubscriptionAccess';
import type { FamilyAccess } from '../familySubscriptionAccess';
let mockFamily: FamilyAccess = { status: 'unsupported', userId: 'new-parent' };
jest.mock('@/hooks/useFamilySubscriptionAccess', () => ({ useFamilySubscriptionAccess: () => mockFamily }));
jest.mock('../familySubscriptionAccess', () => ({ refreshFamilyAccess: jest.fn(), hasCheckedFamilyAccess: () => true }));

import React from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import PaywallScreen from '../../app/paywall';
import { PaywallPlansExperience } from '../../components/paywall/PaywallPlansExperience';
import { shouldShowPaywall, markPaywallShown } from '../paywall';
import { purchaseSubscriptionPlan, restoreRevenueCatPurchases, hasRevenueCatEntitlement, getRevenueCatPlanPricing, RevenueCatPurchaseBlockedError } from '../revenuecat';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockUser: { id: string } | null = { id: 'new-parent' };
const verifiedPrice = { price: 12.49, priceString: '$12.49', currencyCode: 'USD' };
const mockParams = { next: '/(tabs)/sleep-tracker', origin: 'onboarding', trialExpired: '0' };
const mockRouter = { replace: mockReplace, back: mockBack, push: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
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
  RevenueCatPurchaseBlockedError: class extends Error { reason: string; constructor(value: string) { super(value); this.reason = value; } },
  isRevenueCatPurchaseCancelled: (error: any) => error?.userCancelled === true || String(error?.code) === '1',
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
    mockUser = { id: 'new-parent' };
    mockFamily = { status: 'unsupported', userId: 'new-parent' };
    jest.mocked(refreshFamilyAccess).mockReset().mockResolvedValue(mockFamily);
    jest.mocked(getRevenueCatPlanPricing).mockResolvedValue({ standardMonthly: verifiedPrice, liteYearly: verifiedPrice });
    jest.mocked(shouldShowPaywall).mockResolvedValue({ shouldShow: true } as any);
    jest.mocked(markPaywallShown).mockResolvedValue({ error: null });
  });
  afterEach(() => {
    act(() => tree?.unmount());
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('closes the paywall for family access and disables a second purchase', async () => {
    mockFamily = { status: 'active', userId: 'new-parent', tier: 'premium', expiresAt: '2026-12-01', validUntil: Date.now() + 60_000 };
    await mount();
    expect(props().isPurchaseActionDisabled).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/sleep-tracker');
    expect(purchaseSubscriptionPlan).not.toHaveBeenCalled();
  });

  it('lets an unpaid partner open code redemption without purchasing or dismissing the paywall', async () => {
    await mount();
    expect(props().allowClose).toBe(false);
    act(() => props().onRedeemFamilyCode());
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/account-linking');
    expect(purchaseSubscriptionPlan).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('lets an unpaid account open account and data management from the hard paywall', async () => {
    await mount();
    expect(props().allowClose).toBe(false);
    act(() => props().onOpenDataManagement());
    expect(mockRouter.push).toHaveBeenCalledWith('/dsgvo');
    expect(purchaseSubscriptionPlan).not.toHaveBeenCalled();
  });

  it('keeps checkout disabled when family access cannot be verified', async () => {
    mockFamily = { status: 'unavailable', userId: 'new-parent' };
    await mount();
    expect(props().isPurchaseActionDisabled).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('refreshes family access without requiring a store restore', async () => {
    await mount();
    jest.mocked(refreshFamilyAccess).mockResolvedValueOnce({ status: 'active', userId: 'new-parent', tier: 'premium', expiresAt: '2026-12-01', validUntil: Date.now() + 60_000 });
    await act(async () => { await props().onRestorePress(); });
    expect(restoreRevenueCatPurchases).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/sleep-tracker');
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
  it('uses Google copy without Apple EULA on Android and retains Apple copy on iOS', async () => {
    Platform.OS = 'android';
    await mount();
    expect(props()).toMatchObject({ billingLabel: 'billingGoogle', storeProvider: 'Google Play', showAppleEula: false });
    await act(async () => { Platform.OS = 'ios'; tree.update(<PaywallScreen />); });
    expect(props()).toMatchObject({ billingLabel: 'billingApple', storeProvider: 'Apple', showAppleEula: true });
  });

  it('never displays fallback amounts or purchases a missing plan; restore stays available', async () => {
    jest.mocked(getRevenueCatPlanPricing).mockResolvedValueOnce({});
    await mount();
    expect(props().prices.liteYearly).toEqual({ amount: 0, label: 'priceUnavailable', verified: false });
    expect(props().isPurchaseActionDisabled).toBe(false);
    await act(async () => props().onPurchase('lite', 'yearly'));
    expect(purchaseSubscriptionPlan).not.toHaveBeenCalled();
    jest.mocked(restoreRevenueCatPurchases).mockResolvedValueOnce(true);
    await act(async () => props().onRestorePress());
    expect(mockReplace).toHaveBeenCalledWith(mockParams.next);
  });

  it('passes the displayed store price to the purchase guard', async () => {
    await mount();
    jest.mocked(purchaseSubscriptionPlan).mockResolvedValueOnce(true);
    await act(async () => props().onPurchase('standard', 'monthly'));
    expect(purchaseSubscriptionPlan).toHaveBeenCalledWith('new-parent', 'standard', 'monthly', verifiedPrice);
  });

  it('shows errors containing cancel instead of silently dismissing them', async () => {
    await mount();
    jest.mocked(purchaseSubscriptionPlan).mockRejectedValueOnce(new Error('Cannot cancel network request'));
    await act(async () => props().onPurchase('standard', 'monthly'));
    expect(props().visiblePurchaseError).toBe('purchaseFailed');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('explains a pending Google payment without granting access', async () => {
    Platform.OS = 'android';
    await mount();
    jest.mocked(purchaseSubscriptionPlan).mockRejectedValueOnce({ code: '20' });
    await act(async () => props().onPurchase('lite', 'yearly'));
    expect(props().visiblePurchaseError).toBe('paymentPending');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('offers subscription management when a duplicate subscription is blocked', async () => {
    await mount();
    jest.mocked(purchaseSubscriptionPlan).mockRejectedValueOnce(new RevenueCatPurchaseBlockedError('activeSubscription'));
    await act(async () => props().onPurchase('lite', 'yearly'));
    expect(props().visiblePurchaseError).toBe('activeSubscription');
    act(() => props().onManageSubscription());
    expect(mockRouter.push).toHaveBeenCalledWith('/subscription');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('ignores a finished purchase after logout and clears the previous account pricing', async () => {
    await mount();
    let finish!: (value: boolean) => void;
    jest.mocked(purchaseSubscriptionPlan).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => props().onPurchase('standard', 'monthly'));
    await act(async () => { mockUser = null; tree.update(<PaywallScreen />); });
    await act(async () => finish(true));
    expect(props().prices.standardMonthly.verified).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('prevents duplicate taps during a native purchase', async () => {
    await mount();
    let finish!: (value: boolean) => void;
    jest.mocked(purchaseSubscriptionPlan).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => { props().onPurchase('standard', 'monthly'); props().onPurchase('standard', 'monthly'); });
    expect(purchaseSubscriptionPlan).toHaveBeenCalledTimes(1);
    await act(async () => finish(false));
  });

});
