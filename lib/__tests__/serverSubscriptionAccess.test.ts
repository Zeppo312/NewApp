import { parseRevenueCatTier } from '../../supabase/functions/_shared/premiumAccess';

describe('server RevenueCat tier parsing', () => {
  const config = {
    lite: 'ent-lite',
    standard: 'ent-standard',
    premium: 'ent-premium',
  };

  it('selects the highest active configured entitlement', () => {
    const future = Date.now() + 60_000;
    expect(
      parseRevenueCatTier(
        {
          items: [
            { entitlement_id: 'ent-lite', expires_at: future },
            { entitlement_id: 'ent-premium', expires_at: future },
            { entitlement_id: 'unknown', expires_at: future },
          ],
        },
        config,
      ).tier,
    ).toBe('premium');
  });

  it('ignores expired and unknown entitlements', () => {
    expect(
      parseRevenueCatTier(
        {
          items: [
            { entitlement_id: 'ent-premium', expires_at: Date.now() - 60_000 },
            { entitlement_id: 'unknown', expires_at: null },
          ],
        },
        config,
      ),
    ).toEqual({ tier: null, productId: null, expiresAt: null });
  });
});
