import { getCachedUser, supabase } from './supabase';
import { getCachedPremiumStatus, getCachedUserProfile, getCachedUserSettings } from './appCache';
import type { PaywallAccessReason, PaywallAccessRole } from './paywallAccess';
import { isPaywallAccessRole } from './paywallAccess';
import { DEFAULT_PAYWALL_TRIAL_DAYS } from './paywallDefaults';
import { getCachedPaywallContent, getPaywallTrialDays } from './paywallContent';

export const PAYWALL_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 Stunden
export const PAYWALL_TRIAL_DAYS = DEFAULT_PAYWALL_TRIAL_DAYS;

export type PaywallState = {
  isPro: boolean;
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

const mapRowToState = (
  settings: any,
  isPro: boolean,
  isAdmin: boolean,
  paywallAccessRole: PaywallAccessRole | null,
  accountCreatedAt: Date | null,
  trialDays: number,
): PaywallState => {
  const accessReason: PaywallAccessReason = isPro
    ? 'subscription'
    : isAdmin
      ? 'admin'
      : paywallAccessRole ?? 'none';
  const paywallAccountCreationGraceMs = trialDays * 24 * 60 * 60 * 1000;
  const accountAge = accountCreatedAt ? Date.now() - accountCreatedAt.getTime() : null;
  const isTrialExpired =
    accessReason === 'none' &&
    accountAge !== null &&
    accountAge >= paywallAccountCreationGraceMs;

  return {
    isPro,
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
    const [isPro, settings, profile, paywallContent] = await Promise.all([
      getCachedPremiumStatus(),
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
      isPro,
      isAdmin,
      paywallAccessRole,
      accountCreatedAt,
      trialDays,
    );
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
      trialDays: PAYWALL_TRIAL_DAYS,
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
    const paywallAccountCreationGraceMs =
      state.trialDays * 24 * 60 * 60 * 1000;
    if (accountAge < paywallAccountCreationGraceMs) {
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
