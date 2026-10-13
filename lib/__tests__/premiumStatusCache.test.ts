jest.mock('../familySubscriptionAccess', () => ({ refreshFamilyAccess: jest.fn() }));
import { refreshFamilyAccess } from '../familySubscriptionAccess';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedPremiumStatusResult,
  invalidateAllCaches,
} from '../appCache';

jest.mock('../supabase', () => ({
  getCachedUser: jest.fn(),
  supabase: {},
}));

jest.mock('../revenuecat', () => ({
  getRevenueCatEntitlementStatus: jest.fn(),
}));

const { getCachedUser: mockGetCachedUser } = jest.requireMock('../supabase');
const { getRevenueCatEntitlementStatus: mockGetRevenueCatEntitlementStatus } =
  jest.requireMock('../revenuecat');

describe('premium status cache', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-06T12:00:00.000Z'));
    mockGetCachedUser.mockReset().mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetRevenueCatEntitlementStatus.mockReset();
    jest.mocked(refreshFamilyAccess).mockReset().mockResolvedValue({ status: 'unsupported', userId: 'user-123' });
    await AsyncStorage.clear();
    await invalidateAllCaches();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('never retains a revoked family grant in the own-subscription cache', async () => {
    mockGetRevenueCatEntitlementStatus.mockResolvedValue({ status: 'inactive' });
    jest.mocked(refreshFamilyAccess).mockResolvedValueOnce({ status: 'active', userId: 'user-123', tier: 'premium', expiresAt: '2026-10-12', validUntil: Date.now() + 300_000 });
    expect(await getCachedPremiumStatusResult()).toMatchObject({ status: 'active', source: 'family' });
    jest.mocked(refreshFamilyAccess).mockResolvedValue({ status: 'none', userId: 'user-123' });
    expect(await getCachedPremiumStatusResult()).toMatchObject({ status: 'inactive' });
  });

  it('keeps an own subscription accessible when the family endpoint fails', async () => {
    mockGetRevenueCatEntitlementStatus.mockResolvedValue({ status: 'active' });
    jest.mocked(refreshFamilyAccess).mockResolvedValue({ status: 'unavailable', userId: 'user-123' });
    expect(await getCachedPremiumStatusResult()).toMatchObject({ status: 'active', source: 'revenuecat' });
  });

  it('does not cache a temporary RevenueCat failure as inactive', async () => {
    const error = new Error('network unavailable');
    mockGetRevenueCatEntitlementStatus
      .mockResolvedValueOnce({ status: 'unavailable', error })
      .mockResolvedValueOnce({
        status: 'active',
        customerInfo: { entitlements: { active: { LottiBabyAbo: {} } } },
      });

    await expect(getCachedPremiumStatusResult()).resolves.toMatchObject({
      status: 'unavailable',
      isPro: null,
    });
    await expect(getCachedPremiumStatusResult()).resolves.toMatchObject({
      status: 'active',
      isPro: true,
      source: 'revenuecat',
    });
    expect(mockGetRevenueCatEntitlementStatus).toHaveBeenCalledTimes(2);
  });

  it('does not turn a failed Auth lookup into a confirmed missing subscription', async () => {
    mockGetCachedUser.mockResolvedValue({ data: { user: null }, error: new Error('offline') });
    await expect(getCachedPremiumStatusResult()).resolves.toMatchObject({ status: 'unavailable', isPro: null });
    expect(mockGetRevenueCatEntitlementStatus).not.toHaveBeenCalled();
    expect(refreshFamilyAccess).not.toHaveBeenCalled();
  });

  it('uses one account lookup throughout an entitlement check instead of repeating it during an outage', async () => {
    mockGetCachedUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null })
      .mockResolvedValue({ data: { user: null }, error: new Error('offline') });
    mockGetRevenueCatEntitlementStatus.mockResolvedValue({ status: 'active' });
    await expect(getCachedPremiumStatusResult()).resolves.toMatchObject({ status: 'active', isPro: true });
    expect(mockGetCachedUser).toHaveBeenCalledTimes(1);
  });

  it('continues treating an authoritative missing account as inactive', async () => {
    mockGetCachedUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getCachedPremiumStatusResult()).resolves.toMatchObject({ status: 'inactive', isPro: false });
  });

  it('keeps a stale last-known-active status during an outage', async () => {
    mockGetRevenueCatEntitlementStatus.mockResolvedValueOnce({
      status: 'active',
      customerInfo: { entitlements: { active: { LottiBabyAbo: {} } } },
    });

    await expect(getCachedPremiumStatusResult()).resolves.toMatchObject({
      status: 'active',
      source: 'revenuecat',
    });

    jest.advanceTimersByTime(31 * 60 * 1000);
    mockGetRevenueCatEntitlementStatus.mockResolvedValueOnce({
      status: 'unavailable',
      error: new Error('offline'),
    });

    await expect(getCachedPremiumStatusResult()).resolves.toEqual({
      status: 'active',
      isPro: true,
      source: 'stale_active',
    });
  });
});
