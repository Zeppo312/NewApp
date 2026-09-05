jest.mock('../revenuecat', () => ({
  getRevenueCatSubscriptionSummary: jest.fn(),
  getTierFromProductId: jest.fn(),
}));

import { sanitizeSubscriptionTierSnapshot } from '../subscriptionAccess';

describe('subscription access cache', () => {
  const snapshot = {
    schemaVersion: 1,
    userId: 'user-a',
    tier: 'premium',
    source: 'subscription',
    verifiedAt: 1_777_000_000_000,
    subscriptionExpiresAt: '2027-01-01T00:00:00.000Z',
  };

  it('accepts only a complete verified snapshot for the current user', () => {
    const valid = { ...snapshot, verifiedAt: Date.now() - 1_000 };
    expect(sanitizeSubscriptionTierSnapshot(valid, 'user-a')).toEqual(valid);
    expect(sanitizeSubscriptionTierSnapshot(snapshot, 'user-b')).toBeNull();
    expect(
      sanitizeSubscriptionTierSnapshot({ ...snapshot, tier: 'ultimate' }, 'user-a'),
    ).toBeNull();
    expect(
      sanitizeSubscriptionTierSnapshot({ ...snapshot, verifiedAt: 'today' }, 'user-a'),
    ).toBeNull();
  });

  it('keeps a valid tier but makes a future timestamp stale', () => {
    expect(
      sanitizeSubscriptionTierSnapshot(
        { ...snapshot, verifiedAt: Date.now() + 24 * 60 * 60_000 },
        'user-a',
      ),
    ).toEqual({ ...snapshot, verifiedAt: 0 });
  });
});
