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
    mockGetCachedUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetRevenueCatEntitlementStatus.mockReset();
    await AsyncStorage.clear();
    await invalidateAllCaches();
  });

  afterEach(() => {
    jest.useRealTimers();
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
