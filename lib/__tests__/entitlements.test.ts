jest.mock('@/contexts/SubscriptionAccessContext', () => ({
  useSubscriptionAccess: jest.fn(),
}));

import { getPaywallAccessTier } from '../paywallAccess';
import {
  featureAllowedForTier,
  getHistoryCutoffDate,
  type AppFeature,
  type AppSubscriptionTier,
} from '../entitlements';

const FEATURES: AppFeature[] = [
  'basisTracker',
  'partnerLink',
  'planner',
  'shoppingList',
  'wochenmomente',
  'pdfExport',
  'recipes',
  'fullHistory',
  'sleepMonthView',
  'dailyMonthView',
  'voiceLog',
  'fuersorge',
  'fragLotti',
  'pregnancyBriefing',
];

describe('Lite-Tester entitlements', () => {
  it('maps the Lite-Tester role to the same access as a Lite subscription', () => {
    const testerTier = getPaywallAccessTier('lite_tester');
    const subscriptionTier: AppSubscriptionTier = 'lite';

    expect(testerTier).toBe('lite');
    expect(testerTier).not.toBeNull();
    expect(
      FEATURES.map((feature) =>
        featureAllowedForTier(feature, testerTier as AppSubscriptionTier),
      ),
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
