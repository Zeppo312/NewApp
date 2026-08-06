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
  intervalMs: number,
  now: number = Date.now(),
): boolean => {
  // Ein technischer Fehler ist kein bestätigtes "kein Abo". In diesem Fall
  // darf die harte Paywall den Nutzer nicht aussperren.
  if (state.subscriptionStatus === 'unavailable') return false;
  if (state.accessReason !== 'none') return false;
  if (state.isTrialExpired) return true;

  if (state.accountCreatedAt) {
    const accountAge = now - state.accountCreatedAt.getTime();
    const graceMs = state.trialDays * 24 * 60 * 60 * 1000;
    if (accountAge < graceMs) return false;
  }

  const lastShownAt = state.lastShownAt?.getTime() ?? 0;
  return !state.lastShownAt || now - lastShownAt >= intervalMs;
};
