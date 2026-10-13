import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hydrateSubscriptionAccess, refreshSubscriptionAccess, resetSubscriptionAccessForTests,
  getCurrentSubscriptionAccessState,
} from '../subscriptionAccess';
import { getRevenueCatSubscriptionSummary } from '../revenuecat';
import type { FamilyAccess } from '../familySubscriptionAccess';

let mockFamily: FamilyAccess;
jest.mock('../familySubscriptionAccess', () => ({
  getCachedFamilyAccess: () => mockFamily,
  refreshFamilyAccess: async () => mockFamily,
}));
jest.mock('../revenuecat', () => ({ getRevenueCatSubscriptionSummary: jest.fn(), getTierFromProductId: () => null }));
jest.mock('../supabase', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {}, error: null }) }) }) }),
  auth: { getSession: async () => ({ data: { session: { user: { id: 'partner' } } } }) },
} }));
jest.mock('../subscriptionFeaturePolicy', () => {
  const policy = { features: { voiceLog: ['premium'], fullHistory: ['standard', 'premium'] } };
  return {
    getCurrentSubscriptionFeaturePolicy: () => policy,
    hydrateSubscriptionFeaturePolicy: async () => policy,
    isSubscriptionFeaturePolicyStale: () => false,
    refreshSubscriptionFeaturePolicy: async () => policy,
    subscribeToSubscriptionFeaturePolicy: () => () => {},
  };
});

describe('effective family and own subscription tier', () => {
  beforeEach(async () => {
    resetSubscriptionAccessForTests();
    await AsyncStorage.clear();
    mockFamily = { status: 'active', userId: 'partner', tier: 'premium', expiresAt: '2026-10-12', validUntil: Date.now() + 300_000 };
    jest.mocked(getRevenueCatSubscriptionSummary).mockResolvedValue({ isActive: false, availability: 'available' } as any);
  });

  it('unlocks the family tier without a RevenueCat purchase on the partner account', async () => {
    await hydrateSubscriptionAccess('partner');
    expect(await refreshSubscriptionAccess('partner', { force: true })).toMatchObject({ source: 'family_subscription', tier: 'premium' });
    expect(await AsyncStorage.getItem('subscription_access_v1:partner')).toBeNull();
  });

  it.each([
    ['lite', 'standard', 'family_subscription', 'standard'],
    ['premium', 'lite', 'subscription', 'premium'],
    ['premium', 'premium', 'subscription', 'premium'],
  ] as const)('resolves own %s and shared %s without downgrading the owner', async (own, shared, source, tier) => {
    mockFamily = { ...mockFamily, tier: shared } as FamilyAccess;
    jest.mocked(getRevenueCatSubscriptionSummary).mockResolvedValue({ isActive: true, availability: 'available', tier: own } as any);
    await hydrateSubscriptionAccess('partner');
    expect(await refreshSubscriptionAccess('partner', { force: true })).toMatchObject({ source, tier });
  });

  it('returns to the own tier after the family grant is revoked', async () => {
    jest.mocked(getRevenueCatSubscriptionSummary).mockResolvedValue({ isActive: true, availability: 'available', tier: 'lite' } as any);
    await hydrateSubscriptionAccess('partner');
    await refreshSubscriptionAccess('partner', { force: true });
    mockFamily = { status: 'none', userId: 'partner' };
    expect(await refreshSubscriptionAccess('partner', { force: true })).toMatchObject({ source: 'subscription', tier: 'lite' });
  });

  it('does not keep an expired family tier indefinitely when RevenueCat is unavailable', async () => {
    await hydrateSubscriptionAccess('partner');
    await refreshSubscriptionAccess('partner', { force: true });
    mockFamily = { status: 'unavailable', userId: 'partner' };
    jest.mocked(getRevenueCatSubscriptionSummary).mockResolvedValue({ availability: 'unavailable' } as any);
    await refreshSubscriptionAccess('partner', { force: true });
    expect(getCurrentSubscriptionAccessState().source).not.toBe('family_subscription');
    expect(getCurrentSubscriptionAccessState().tier).not.toBe('premium');
  });
});
