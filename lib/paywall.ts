import { getCachedUser, supabase } from './supabase';
import { getCachedPremiumStatus, getCachedUserProfile, getCachedUserSettings } from './appCache';

export const PAYWALL_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 Stunden
export const PAYWALL_TRIAL_DAYS = 14;
export const PAYWALL_ACCOUNT_CREATION_GRACE_MS = PAYWALL_TRIAL_DAYS * 24 * 60 * 60 * 1000; // 14 Tage

export type PaywallState = {
  isPro: boolean;
  isAdmin: boolean;
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
  accountCreatedAt: Date | null,
): PaywallState => ({
  isPro,
  isAdmin,
  lastShownAt: parseDate(settings?.paywall_last_shown_at),
  accountCreatedAt,
});

export const fetchPaywallState = async (): Promise<PaywallState> => {
  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return { isPro: false, isAdmin: false, lastShownAt: null, accountCreatedAt: null };
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
    return mapRowToState(settings, isPro, isAdmin, accountCreatedAt);
  } catch (err) {
    console.error('Exception while fetching paywall state:', err);
    return { isPro: false, isAdmin: false, lastShownAt: null, accountCreatedAt: null };
  }
};

export const shouldShowPaywall = async (
  intervalMs: number = PAYWALL_INTERVAL_MS,
): Promise<{ shouldShow: boolean; state: PaywallState }> => {
  const state = await fetchPaywallState();
  if (state.isPro || state.isAdmin) {
    return { shouldShow: false, state };
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
