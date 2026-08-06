// Server-side Premium verification for paid AI features. Never trust a tier
// or entitlement sent by the app: RevenueCat is queried with its secret key
// and the result is cached in a table that has no client RLS policies.

type SupabaseAdmin = {
  from: (table: string) => any;
};

export type PremiumAccessResult = {
  allowed: boolean;
  reason: 'admin' | 'premium_tester' | 'revenuecat' | 'not_premium' | 'unavailable';
};

type RevenueCatActiveEntitlement = {
  entitlement_id?: unknown;
  expires_at?: unknown;
};

const CACHE_MAX_AGE_MS = 15 * 60_000;
const STALE_POSITIVE_GRACE_MS = 24 * 60 * 60_000;

const isFutureOrLifetime = (value: unknown): boolean =>
  value === null ||
  (typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now());

const parseRevenueCatPremium = (payload: unknown, premiumEntitlementId: string) => {
  const items = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) {
    return { isPremium: false, productId: null, expiresAt: null };
  }

  for (const entitlement of items as RevenueCatActiveEntitlement[]) {
    if (entitlement?.entitlement_id !== premiumEntitlementId) continue;
    const expiryMs =
      typeof entitlement.expires_at === 'number' && Number.isFinite(entitlement.expires_at)
        ? entitlement.expires_at
        : typeof entitlement.expires_at === 'string' && Number.isFinite(Number(entitlement.expires_at))
          ? Number(entitlement.expires_at)
          : null;
    const expiresAt = expiryMs === null ? null : new Date(expiryMs).toISOString();
    if (expiryMs === null || expiryMs > Date.now()) {
      return {
        isPremium: true,
        productId: premiumEntitlementId,
        expiresAt,
      };
    }
  }
  return { isPremium: false, productId: null, expiresAt: null };
};

export const syncRevenueCatPremium = async (
  admin: SupabaseAdmin,
  userId: string,
  revenueCatSecretKey: string,
  revenueCatProjectId: string,
  premiumEntitlementId: string,
  source: 'revenuecat_api' | 'revenuecat_webhook',
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const response = await fetch(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(revenueCatProjectId)}/customers/${encodeURIComponent(userId)}/active_entitlements?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${revenueCatSecretKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    },
  ).finally(() => clearTimeout(timeout));

  if (!response.ok && response.status !== 404) {
    throw new Error(`revenuecat_${response.status}`);
  }
  const state = response.status === 404
    ? { isPremium: false, productId: null, expiresAt: null }
    : parseRevenueCatPremium(await response.json(), premiumEntitlementId);
  const { error } = await admin.from('lotti_subscription_entitlements').upsert({
    user_id: userId,
    is_premium: state.isPremium,
    product_id: state.productId,
    expires_at: state.expiresAt,
    source,
    checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('premium_cache_write_failed');
  return state;
};

export const verifyPremiumAccess = async (
  admin: SupabaseAdmin,
  userId: string,
  revenueCatSecretKey: string | undefined,
  revenueCatProjectId: string | undefined,
  premiumEntitlementId: string | undefined,
): Promise<PremiumAccessResult> => {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_admin, paywall_access_role')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) return { allowed: false, reason: 'unavailable' };
  if (profile?.is_admin === true) return { allowed: true, reason: 'admin' };
  if (profile?.paywall_access_role === 'premium_tester') {
    return { allowed: true, reason: 'premium_tester' };
  }

  const { data: cached, error: cacheError } = await admin
    .from('lotti_subscription_entitlements')
    .select('is_premium, expires_at, checked_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (cacheError) return { allowed: false, reason: 'unavailable' };

  const cacheFresh =
    cached?.checked_at && Date.now() - Date.parse(cached.checked_at) < CACHE_MAX_AGE_MS;
  const cacheWithinGrace =
    cached?.checked_at && Date.now() - Date.parse(cached.checked_at) < STALE_POSITIVE_GRACE_MS;
  const cacheActive =
    cached?.is_premium === true && isFutureOrLifetime(cached.expires_at ?? null);
  if (cacheFresh) {
    return { allowed: cacheActive, reason: cacheActive ? 'revenuecat' : 'not_premium' };
  }

  if (!revenueCatSecretKey || !revenueCatProjectId || !premiumEntitlementId) {
    // A valid but stale positive cache may bridge a temporary configuration
    // issue. A missing/negative state always fails closed.
    const canBridgeOutage = cacheActive && Boolean(cacheWithinGrace);
    return { allowed: canBridgeOutage, reason: canBridgeOutage ? 'revenuecat' : 'unavailable' };
  }

  try {
    const state = await syncRevenueCatPremium(
      admin,
      userId,
      revenueCatSecretKey,
      revenueCatProjectId,
      premiumEntitlementId,
      'revenuecat_api',
    );
    return {
      allowed: state.isPremium,
      reason: state.isPremium ? 'revenuecat' : 'not_premium',
    };
  } catch {
    const canBridgeOutage = cacheActive && Boolean(cacheWithinGrace);
    return { allowed: canBridgeOutage, reason: canBridgeOutage ? 'revenuecat' : 'unavailable' };
  }
};
