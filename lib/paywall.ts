import { getCachedUser, supabase } from './supabase';
import { getCachedPremiumStatus, getCachedUserProfile, getCachedUserSettings } from './appCache';
import type { PaywallAccessReason, PaywallAccessRole } from './paywallAccess';
import { isPaywallAccessRole } from './paywallAccess';

export const PAYWALL_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 Stunden
export const PAYWALL_TRIAL_DAYS = 14;
export const PAYWALL_ACCOUNT_CREATION_GRACE_MS = PAYWALL_TRIAL_DAYS * 24 * 60 * 60 * 1000; // 14 Tage

export type PaywallState = {
  isPro: boolean;
  isAdmin: boolean;
  paywallAccessRole: PaywallAccessRole | null;
  accessReason: PaywallAccessReason;
  isTrialExpired: boolean;
  lastShownAt: Date | null;
  accountCreatedAt: Date | null;
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveAccountCreatedAt = (user: any): Date | null => {
  return parseDate(user?.created_at);
};

const mapRowToState = (
  settings: any,
  isPro: boolean,
  isAdmin: boolean,
  paywallAccessRole: PaywallAccessRole | null,
  accountCreatedAt: Date | null,
): PaywallState => {
  const accessReason: PaywallAccessReason = isPro
    ? 'subscription'
    : isAdmin
      ? 'admin'
      : paywallAccessRole ?? 'none';
  const accountAge = accountCreatedAt ? Date.now() - accountCreatedAt.getTime() : null;
  const isTrialExpired =
    accessReason === 'none' &&
    accountAge !== null &&
    accountAge >= PAYWALL_ACCOUNT_CREATION_GRACE_MS;

  return {
    isPro,
    isAdmin,
    paywallAccessRole,
    accessReason,
    isTrialExpired,
    lastShownAt: parseDate(settings?.paywall_last_shown_at),
    accountCreatedAt,
  };
};

export const fetchPaywallState = async (): Promise<PaywallState> => {
  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return {
      isPro: false,
      isAdmin: false,
      paywallAccessRole: null,
      accessReason: 'none',
      isTrialExpired: false,
      lastShownAt: null,
      accountCreatedAt: null,
    };
  }

  try {
    // Nutze gecachte Daten für bessere Performance
    const [isPro, settings, profile] = await Promise.all([
      getCachedPremiumStatus(),
      getCachedUserSettings(),
      getCachedUserProfile(),
    ]);

    const accountCreatedAt = resolveAccountCreatedAt(userData.user);
    const isAdmin = profile?.is_admin === true;
    const paywallAccessRole = isPaywallAccessRole(profile?.paywall_access_role)
      ? profile.paywall_access_role
      : null;
    return mapRowToState(settings, isPro, isAdmin, paywallAccessRole, accountCreatedAt);
  } catch (err) {
    console.error('Exception while fetching paywall state:', err);
    return {
      isPro: false,
      isAdmin: false,
      paywallAccessRole: null,
      accessReason: 'none',
      isTrialExpired: false,
      lastShownAt: null,
      accountCreatedAt: null,
    };
  }
};

export const shouldShowPaywall = async (
  intervalMs: number = PAYWALL_INTERVAL_MS,
): Promise<{ shouldShow: boolean; state: PaywallState }> => {
  const state = await fetchPaywallState();
  if (state.accessReason !== 'none') {
    return { shouldShow: false, state };
  }

  if (state.isTrialExpired) {
    return { shouldShow: true, state };
  }

  const now = Date.now();
  if (state.accountCreatedAt) {
    const accountAge = now - state.accountCreatedAt.getTime();
    if (accountAge < PAYWALL_ACCOUNT_CREATION_GRACE_MS) {
      return { shouldShow: false, state };
    }
  }
  const last = state.lastShownAt?.getTime() ?? 0;
  const delta = now - last;
  const shouldShow = !state.lastShownAt || delta >= intervalMs;

  return { shouldShow, state };
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
