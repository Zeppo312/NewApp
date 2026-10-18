import {
  shouldRedirectToPaywallForState,
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

  it('keeps the initial gate closed when no access can be verified', () => {
    expect(
      shouldShowPaywallForState({
        ...expiredState,
        subscriptionStatus: 'unavailable',
      }, intervalMs),
    ).toBe(true);
  });

  it('redirects an open screen only for a confirmed missing subscription', () => {
    expect(shouldRedirectToPaywallForState(expiredState)).toBe(true);
    expect(shouldRedirectToPaywallForState({
      ...expiredState,
      subscriptionStatus: 'unavailable',
    })).toBe(false);
    expect(shouldRedirectToPaywallForState({
      ...expiredState,
      accessReason: 'admin',
    })).toBe(false);
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

  it.each([new Date(), null, new Date('2026-01-01')])(
    'requires a subscription regardless of account age (%s) or a recent paywall view',
    (accountCreatedAt) => {
      expect(shouldShowPaywallForState({
        ...expiredState,
        accountCreatedAt,
        isTrialExpired: false,
        trialDays: 30,
        lastShownAt: new Date(),
      }, intervalMs)).toBe(true);
    },
  );

  it.each(['admin', 'tester', 'premium_tester', 'lite_tester', 'cooperation_partner'] as const)(
    'preserves verified %s access even if the store is unavailable',
    (accessReason) => {
      expect(shouldShowPaywallForState({
        ...expiredState,
        subscriptionStatus: 'unavailable',
        accessReason,
      }, intervalMs)).toBe(false);
    },
  );
});
