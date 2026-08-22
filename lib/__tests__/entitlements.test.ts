import { getCachedUserProfile } from '@/lib/appCache';
import { getCachedUser } from '@/lib/supabase';
import { getRevenueCatSubscriptionSummary } from '@/lib/revenuecat';
import {
  featureAllowedForTier,
  getHistoryCutoffDate,
  resolveSubscriptionTier,
  type AppFeature,
} from '../entitlements';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@/lib/appCache', () => ({
  getCachedUserProfile: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  getCachedUser: jest.fn(),
  supabase: {},
}));

jest.mock('@/lib/revenuecat', () => ({
  getRevenueCatSubscriptionSummary: jest.fn(),
  getTierFromProductId: jest.fn((productId: string | null) =>
    productId === 'lottibaby_lite_monthly' ? 'lite' : null,
  ),
}));

const mockGetCachedUserProfile = getCachedUserProfile as jest.Mock;
const mockGetCachedUser = getCachedUser as jest.Mock;
const mockGetRevenueCatSubscriptionSummary =
  getRevenueCatSubscriptionSummary as jest.Mock;

const FEATURES: AppFeature[] = [
  'basisTracker',
  'partnerLink',
  'planner',
  'shoppingList',
  'wochenmomente',
  'pdfExport',
  'recipes',
  'fullHistory',
  'voiceLog',
  'fuersorge',
  'fragLotti',
  'pregnancyBriefing',
];

describe('Lite-Tester entitlements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('resolves the Lite-Tester role to the same tier as a Lite subscription', async () => {
    mockGetCachedUserProfile.mockResolvedValueOnce({
      id: 'user-1',
      paywall_access_role: 'lite_tester',
    });
    const testerTier = await resolveSubscriptionTier();

    mockGetCachedUserProfile.mockResolvedValueOnce({
      id: 'user-1',
      paywall_access_role: null,
    });
    mockGetRevenueCatSubscriptionSummary.mockResolvedValueOnce({
      isActive: true,
      productId: 'lottibaby_lite_monthly',
    });
    const subscriptionTier = await resolveSubscriptionTier();

    expect(testerTier).toBe('lite');
    expect(subscriptionTier).toBe('lite');
    expect(
      FEATURES.map((feature) => featureAllowedForTier(feature, testerTier)),
    ).toEqual(
      FEATURES.map((feature) =>
        featureAllowedForTier(feature, subscriptionTier),
      ),
    );
    expect(getHistoryCutoffDate(testerTier)?.getTime()).toBe(
      getHistoryCutoffDate(subscriptionTier)?.getTime(),
    );
  });
});
