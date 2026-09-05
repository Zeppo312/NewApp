import { getCachedUser, supabase } from './supabase';
import {
  getCachedPremiumStatusResult,
  getCachedUserProfile,
  getCachedUserSettings,
  type PremiumStatusResult,
} from './appCache';
import type { PaywallAccessReason, PaywallAccessRole } from './paywallAccess';
import { isPaywallAccessRole } from './paywallAccess';
import { DEFAULT_PAYWALL_TRIAL_DAYS } from './paywallDefaults';
import { getCachedPaywallContent, getPaywallTrialDays } from './paywallContent';
import { shouldShowPaywallForState } from './paywallDecision';

export { shouldShowPaywallForState } from './paywallDecision';

export const PAYWALL_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 Stunden
export const PAYWALL_TRIAL_DAYS = DEFAULT_PAYWALL_TRIAL_DAYS;
export const PAYWALL_HARD_GATE_NEW_USERS_SINCE = new Date(
  '2026-04-09T00:00:00+02:00',
);

export type PaywallState = {
  isPro: boolean;
  subscriptionStatus: PremiumStatusResult['status'];
  isAdmin: boolean;
  paywallAccessRole: PaywallAccessRole | null;
  accessReason: PaywallAccessReason;
  isTrialExpired: boolean;
  lastShownAt: Date | null;
  accountCreatedAt: Date | null;
  trialDays: number;
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveAccountCreatedAt = (user: any): Date | null => {
  return parseDate(user?.created_at);
};

const shouldRequireImmediateSubscription = (
  accessReason: PaywallAccessReason,
  accountCreatedAt: Date | null,
): boolean =>
  accessReason === 'none' &&
  accountCreatedAt !== null &&
  accountCreatedAt.getTime() >= PAYWALL_HARD_GATE_NEW_USERS_SINCE.getTime();

const mapRowToState = (
  settings: any,
  premiumStatus: PremiumStatusResult,
  isAdmin: boolean,
  paywallAccessRole: PaywallAccessRole | null,
  accountCreatedAt: Date | null,
  trialDays: number,
): PaywallState => {
  const isPro = premiumStatus.status === 'active';
  const accessReason: PaywallAccessReason = isPro
    ? 'subscription'
    : isAdmin
      ? 'admin'
      : paywallAccessRole ?? 'none';
  const requiresImmediateSubscription = shouldRequireImmediateSubscription(
    accessReason,
    accountCreatedAt,
  );
  const paywallAccountCreationGraceMs = trialDays * 24 * 60 * 60 * 1000;
  const accountAge = accountCreatedAt ? Date.now() - accountCreatedAt.getTime() : null;
  const isTrialExpired =
    requiresImmediateSubscription ||
    (accessReason === 'none' &&
      accountAge !== null &&
      accountAge >= paywallAccountCreationGraceMs);

  return {
    isPro,
    subscriptionStatus: premiumStatus.status,
    isAdmin,
    paywallAccessRole,
    accessReason,
    isTrialExpired,
    lastShownAt: parseDate(settings?.paywall_last_shown_at),
    accountCreatedAt,
    trialDays,
  };
};

export const fetchPaywallState = async (): Promise<PaywallState> => {
  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return {
      isPro: false,
      subscriptionStatus: 'inactive',
      isAdmin: false,
      paywallAccessRole: null,
      accessReason: 'none',
      isTrialExpired: false,
      lastShownAt: null,
      accountCreatedAt: null,
      trialDays: PAYWALL_TRIAL_DAYS,
    };
  }

  try {
    // Nutze gecachte Daten für bessere Performance
    const [premiumStatus, settings, profile, paywallContent] = await Promise.all([
      getCachedPremiumStatusResult(),
      getCachedUserSettings(),
      getCachedUserProfile(),
      getCachedPaywallContent(),
    ]);

    const accountCreatedAt = resolveAccountCreatedAt(userData.user);
    const isAdmin = profile?.is_admin === true;
    const paywallAccessRole = isPaywallAccessRole(profile?.paywall_access_role)
      ? profile.paywall_access_role
      : null;
    const trialDays = getPaywallTrialDays(paywallContent.content);
    return mapRowToState(
      settings,
      premiumStatus,
      isAdmin,
      paywallAccessRole,
      accountCreatedAt,
      trialDays,
    );
  } catch (err) {
    console.error('Exception while fetching paywall state:', err);
    return {
      isPro: false,
      subscriptionStatus: 'unavailable',
      isAdmin: false,
      paywallAccessRole: null,
      accessReason: 'none',
      isTrialExpired: false,
      lastShownAt: null,
      accountCreatedAt: null,
      trialDays: PAYWALL_TRIAL_DAYS,
    };
  }
};

export const shouldShowPaywall = async (
  intervalMs: number = PAYWALL_INTERVAL_MS,
): Promise<{ shouldShow: boolean; state: PaywallState }> => {
  const state = await fetchPaywallState();
  return {
    shouldShow: shouldShowPaywallForState(state, intervalMs),
    state,
  };
};

export const markPaywallShown = async (source?: string) => {
  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return { error: new Error('Nicht angemeldet') };
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userData.user.id,
        paywall_last_shown_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' },
    )
    .select('paywall_last_shown_at')
    .single();

  if (error) {
    console.error('Failed to mark paywall as shown', { error, source });
    return { error };
  }

  // Cache invalidieren nach Update
  const { invalidateUserSettingsCache } = await import('./appCache');
  await invalidateUserSettingsCache();

  return { error: null };
};
