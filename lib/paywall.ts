import { supabase } from './supabase';
import { getCachedUser } from './supabase';
import { getCachedPremiumStatus, getCachedUserSettings } from './appCache';

export const PAYWALL_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 Stunden

export type PaywallState = {
  isPro: boolean;
  lastShownAt: Date | null;
};

const mapRowToState = (settings: any, isPro: boolean): PaywallState => ({
  isPro,
  lastShownAt: settings?.paywall_last_shown_at ? new Date(settings.paywall_last_shown_at) : null,
});

export const fetchPaywallState = async (): Promise<PaywallState> => {
  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return { isPro: false, lastShownAt: null };
  }

  try {
    // Nutze gecachte Daten für bessere Performance
    const [isPro, settings] = await Promise.all([
      getCachedPremiumStatus(),
      getCachedUserSettings(),
    ]);

    return mapRowToState(settings, isPro);
  } catch (err) {
    console.error('Exception while fetching paywall state:', err);
    return { isPro: false, lastShownAt: null };
  }
};

export const shouldShowPaywall = async (
  intervalMs: number = PAYWALL_INTERVAL_MS,
): Promise<{ shouldShow: boolean; state: PaywallState }> => {
  const state = await fetchPaywallState();
  if (state.isPro) {
    return { shouldShow: false, state };
  }

  const now = Date.now();
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
