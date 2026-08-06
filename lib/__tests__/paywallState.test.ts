import {
  shouldShowPaywallForState,
} from '../paywallDecision';
import type { PaywallState } from '../paywall';

const intervalMs = 2 * 60 * 60 * 1000;

const expiredState: PaywallState = {
  isPro: false,
  subscriptionStatus: 'inactive',
  isAdmin: false,
  paywallAccessRole: null,
  accessReason: 'none',
  isTrialExpired: true,
  lastShownAt: null,
  accountCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
  trialDays: 7,
};

describe('paywall state decision', () => {
  it('shows the hard paywall for a confirmed inactive expired account', () => {
    expect(shouldShowPaywallForState(expiredState, intervalMs)).toBe(true);
  });

  it('fails open when subscription status is technically unavailable', () => {
    expect(
      shouldShowPaywallForState({
        ...expiredState,
        subscriptionStatus: 'unavailable',
      }, intervalMs),
    ).toBe(false);
  });

  it('never shows for confirmed active access', () => {
    expect(
      shouldShowPaywallForState({
        ...expiredState,
        subscriptionStatus: 'active',
        accessReason: 'subscription',
      }, intervalMs),
    ).toBe(false);
  });
});
