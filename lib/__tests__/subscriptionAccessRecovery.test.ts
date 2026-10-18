import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hydrateSubscriptionAccess, refreshSubscriptionAccess, resetSubscriptionAccessForTests,
  getCurrentSubscriptionAccessState, subscribeToSubscriptionAccess,
} from '../subscriptionAccess';

const mockProfile = jest.fn();
const mockSummary = jest.fn();
const mockPolicyRefresh = jest.fn();
let mockFamily: any;
const policy = { features: { fragLotti: ['premium'] } };
jest.mock('../familySubscriptionAccess', () => ({
  getCachedFamilyAccess: () => mockFamily,
  refreshFamilyAccess: async () => mockFamily,
}));
jest.mock('../revenuecat', () => ({
  getRevenueCatSubscriptionSummary: (...args: any[]) => mockSummary(...args),
  getTierFromProductId: () => null,
}));
jest.mock('../supabase', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockProfile() }) }) }),
} }));
jest.mock('../subscriptionFeaturePolicy', () => {
  const value = { features: { fragLotti: ['premium'] } };
  return {
    getCurrentSubscriptionFeaturePolicy: () => value,
    hydrateSubscriptionFeaturePolicy: async () => value,
    isSubscriptionFeaturePolicyStale: () => false,
    refreshSubscriptionFeaturePolicy: () => mockPolicyRefresh(),
    subscribeToSubscriptionFeaturePolicy: () => () => {},
  };
});
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
};

describe('subscription refresh recovery after network and account changes', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    resetSubscriptionAccessForTests();
    await AsyncStorage.clear();
    mockProfile.mockReset().mockResolvedValue({ data: {}, error: null });
    mockSummary.mockReset().mockResolvedValue({ isActive: false, availability: 'available' });
    mockPolicyRefresh.mockReset().mockResolvedValue(policy);
    mockFamily = { status: 'active', userId: 'A', tier: 'premium', expiresAt: '2027-01-01', validUntil: Date.now() + 300_000 };
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it.each(['profile', 'provider', 'policy'])('allows a retry after a hanging %s request', async source => {
    const pending = deferred();
    const target = source === 'profile' ? mockProfile : source === 'provider' ? mockSummary : mockPolicyRefresh;
    target.mockReturnValueOnce(pending.promise);
    await hydrateSubscriptionAccess('A');
    await flush();
    let settled = false;
    void refreshSubscriptionAccess('A', { force: true }).then(() => { settled = true; });
    await jest.advanceTimersByTimeAsync(15_000);
    expect(settled).toBe(true);
    expect(await refreshSubscriptionAccess('A', { force: true })).toMatchObject({ tier: 'premium', source: 'family_subscription', refreshing: false });
  });

  it('immediately notifies mounted features when the lease expires during a pending refresh', async () => {
    await hydrateSubscriptionAccess('A');
    await refreshSubscriptionAccess('A', { force: true });
    const observed = jest.fn();
    const unsubscribe = subscribeToSubscriptionAccess(observed);
    mockProfile.mockReturnValueOnce(new Promise(() => {}));
    void refreshSubscriptionAccess('A', { force: true });
    await flush();
    mockFamily = { status: 'unavailable', userId: 'A' };
    // Same call made by SubscriptionAccessProvider's family-expiry listener.
    void refreshSubscriptionAccess('A', { force: true });
    expect(observed.mock.calls.at(-1)?.[0].tier).not.toBe('premium');
    unsubscribe();
  });

  it('does not reuse an old A request or apply its late result after A -> B -> A', async () => {
    const old = deferred();
    mockFamily = { status: 'none', userId: 'A' };
    mockSummary.mockResolvedValue({ isActive: true, availability: 'available', tier: 'premium' });
    mockSummary.mockReturnValueOnce(old.promise);
    await hydrateSubscriptionAccess('A');
    await flush();
    const first = refreshSubscriptionAccess('A', { force: true });
    await hydrateSubscriptionAccess(null);
    await hydrateSubscriptionAccess('B');
    await flush();
    await hydrateSubscriptionAccess(null);
    await hydrateSubscriptionAccess('A');
    await flush();
    expect(getCurrentSubscriptionAccessState()).toMatchObject({ userId: 'A', tier: 'premium', refreshing: false });
    old.resolve({ isActive: true, availability: 'available', tier: 'lite' });
    await first;
    expect(getCurrentSubscriptionAccessState()).toMatchObject({ userId: 'A', tier: 'premium' });
    expect(JSON.parse((await AsyncStorage.getItem('subscription_access_v1:A'))!)).toMatchObject({ tier: 'premium' });
  });
});
