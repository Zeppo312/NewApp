import type { PaywallAccessReason } from './paywallAccess';

export type PaywallDecisionState = {
  subscriptionStatus: 'active' | 'inactive' | 'unavailable';
  accessReason: PaywallAccessReason;
  isTrialExpired: boolean;
  lastShownAt: Date | null;
  accountCreatedAt: Date | null;
  trialDays: number;
};

export const shouldShowPaywallForState = (
  state: PaywallDecisionState,
  _intervalMs: number,
  _now: number = Date.now(),
): boolean => {
  // Nur bestätigter Zugang gibt die App frei. Ein Store-Testabo zählt als
  // aktives Abo; Kontoalter und frühere Paywall-Aufrufe gewähren keinen Zugang.
  // Bereits bestätigte Abos bleiben bei Netzfehlern über den Premium-Cache aktiv.
  return state.subscriptionStatus !== 'active' && state.accessReason === 'none';
};

/** A background refresh must not interrupt an open screen on an unknown result. */
export const shouldRedirectToPaywallForState = (state: PaywallDecisionState): boolean =>
  state.subscriptionStatus === 'inactive' &&
  shouldShowPaywallForState(state, 0);
