// Server-side subscription feature verification. A client-provided tier or
// locally cached feature matrix is never trusted here: RevenueCat determines
// the tier and Postgres determines whether that tier may use the feature.

type SupabaseAdmin = { from: (table: string) => any };

export type ServerSubscriptionTier = 'lite' | 'standard' | 'premium';
export type RevenueCatEntitlementConfig = {
  premium: string | undefined;
  standard?: string | undefined;
  lite?: string | undefined;
};
export type FeatureAccessResult = {
  allowed: boolean;
  reason: 'admin' | 'special_access' | 'revenuecat' | 'feature_disabled' | 'not_entitled' | 'unavailable';
  tier: ServerSubscriptionTier | null;
};
export type PremiumAccessResult = {
  allowed: boolean;
  reason: 'admin' | 'premium_tester' | 'revenuecat' | 'not_premium' | 'unavailable';
};

type RevenueCatActiveEntitlement = { entitlement_id?: unknown; expires_at?: unknown };
type VerifiedTierState = {
  tier: ServerSubscriptionTier | null;
  productId: string | null;
  expiresAt: string | null;
};

const CACHE_MAX_AGE_MS = 15 * 60_000;
const STALE_POSITIVE_GRACE_MS = 24 * 60 * 60_000;
const isFutureOrLifetime = (value: unknown): boolean =>
  value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now());
const tierRank = (tier: ServerSubscriptionTier) => tier === 'premium' ? 3 : tier === 'standard' ? 2 : 1;

const entitlementTier = (
  entitlementId: unknown,
  config: RevenueCatEntitlementConfig,
): ServerSubscriptionTier | null => {
  if (typeof entitlementId !== 'string') return null;
  if (config.premium && entitlementId === config.premium) return 'premium';
  if (config.standard && entitlementId === config.standard) return 'standard';
  if (config.lite && entitlementId === config.lite) return 'lite';
  return null;
};

export const parseRevenueCatTier = (
  payload: unknown,
  config: RevenueCatEntitlementConfig,
): VerifiedTierState => {
  const items = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { tier: null, productId: null, expiresAt: null };

  let best: VerifiedTierState = { tier: null, productId: null, expiresAt: null };
  for (const entitlement of items as RevenueCatActiveEntitlement[]) {
    const tier = entitlementTier(entitlement?.entitlement_id, config);
    if (!tier) continue;
    const expiryMs =
      typeof entitlement.expires_at === 'number' && Number.isFinite(entitlement.expires_at)
        ? entitlement.expires_at
        : typeof entitlement.expires_at === 'string' && Number.isFinite(Number(entitlement.expires_at))
          ? Number(entitlement.expires_at)
          : null;
    if (expiryMs !== null && expiryMs <= Date.now()) continue;
    if (!best.tier || tierRank(tier) > tierRank(best.tier)) {
      best = {
        tier,
        productId: String(entitlement.entitlement_id),
        expiresAt: expiryMs === null ? null : new Date(expiryMs).toISOString(),
      };
    }
  }
  return best;
};

export const syncRevenueCatTier = async (
  admin: SupabaseAdmin,
  userId: string,
  revenueCatSecretKey: string,
  revenueCatProjectId: string,
  entitlementConfig: RevenueCatEntitlementConfig,
  source: 'revenuecat_api' | 'revenuecat_webhook',
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const response = await fetch(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(revenueCatProjectId)}/customers/${encodeURIComponent(userId)}/active_entitlements?limit=100`,
    {
      headers: { Authorization: `Bearer ${revenueCatSecretKey}`, Accept: 'application/json' },
      signal: controller.signal,
    },
  ).finally(() => clearTimeout(timeout));

  if (!response.ok && response.status !== 404) throw new Error(`revenuecat_${response.status}`);
  const state = response.status === 404
    ? { tier: null, productId: null, expiresAt: null }
    : parseRevenueCatTier(await response.json(), entitlementConfig);
  const { error } = await admin.from('lotti_subscription_entitlements').upsert({
    user_id: userId,
    tier: state.tier,
    is_premium: state.tier === 'premium',
    product_id: state.productId,
    expires_at: state.expiresAt,
    source,
    checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('subscription_cache_write_failed');
  return state;
};

const featureEnabledForTier = async (
  admin: SupabaseAdmin,
  feature: string,
  tier: ServerSubscriptionTier,
) => {
  const { data, error } = await admin
    .from('subscription_plan_features')
    .select('enabled')
    .eq('feature_key', feature)
    .eq('plan_key', tier)
    .maybeSingle();
  if (error || !data || typeof data.enabled !== 'boolean') return null;
  return data.enabled;
};

const specialTier = (profile: any): ServerSubscriptionTier | null => {
  if (profile?.is_admin === true || profile?.paywall_access_role === 'premium_tester') return 'premium';
  if (profile?.paywall_access_role === 'lite_tester') return 'lite';
  if (profile?.paywall_access_role === 'tester' || profile?.paywall_access_role === 'cooperation_partner') return 'standard';
  return null;
};

const resultForTier = async (
  admin: SupabaseAdmin,
  feature: string,
  tier: ServerSubscriptionTier,
  source: FeatureAccessResult['reason'],
): Promise<FeatureAccessResult> => {
  const enabled = await featureEnabledForTier(admin, feature, tier);
  if (enabled === null) return { allowed: false, reason: 'unavailable', tier };
  return { allowed: enabled, reason: enabled ? source : 'feature_disabled', tier };
};

export const verifySubscriptionFeatureAccess = async (
  admin: SupabaseAdmin,
  userId: string,
  feature: string,
  revenueCatSecretKey: string | undefined,
  revenueCatProjectId: string | undefined,
  entitlementConfig: RevenueCatEntitlementConfig,
): Promise<FeatureAccessResult> => {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_admin, paywall_access_role')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) return { allowed: false, reason: 'unavailable', tier: null };

  const overrideTier = specialTier(profile);
  if (overrideTier) {
    return resultForTier(admin, feature, overrideTier, profile?.is_admin === true ? 'admin' : 'special_access');
  }

  const { data: cached, error: cacheError } = await admin
    .from('lotti_subscription_entitlements')
    .select('tier, is_premium, expires_at, checked_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (cacheError) return { allowed: false, reason: 'unavailable', tier: null };

  const cachedTier: ServerSubscriptionTier | null =
    cached?.tier === 'lite' || cached?.tier === 'standard' || cached?.tier === 'premium'
      ? cached.tier
      : cached?.is_premium === true ? 'premium' : null;
  const cacheFresh = cached?.checked_at && Date.now() - Date.parse(cached.checked_at) < CACHE_MAX_AGE_MS;
  const cacheWithinGrace = cached?.checked_at && Date.now() - Date.parse(cached.checked_at) < STALE_POSITIVE_GRACE_MS;
  const cacheActive = cachedTier !== null && isFutureOrLifetime(cached?.expires_at ?? null);

  if (cacheFresh) {
    if (!cacheActive) return { allowed: false, reason: 'not_entitled', tier: null };
    return resultForTier(admin, feature, cachedTier, 'revenuecat');
  }

  if (!revenueCatSecretKey || !revenueCatProjectId || !entitlementConfig.premium) {
    if (cacheActive && cacheWithinGrace) return resultForTier(admin, feature, cachedTier, 'revenuecat');
    return { allowed: false, reason: 'unavailable', tier: cachedTier };
  }

  try {
    const state = await syncRevenueCatTier(
      admin,
      userId,
      revenueCatSecretKey,
      revenueCatProjectId,
      entitlementConfig,
      'revenuecat_api',
    );
    if (!state.tier) return { allowed: false, reason: 'not_entitled', tier: null };
    return resultForTier(admin, feature, state.tier, 'revenuecat');
  } catch {
    if (cacheActive && cacheWithinGrace) return resultForTier(admin, feature, cachedTier, 'revenuecat');
    return { allowed: false, reason: 'unavailable', tier: cachedTier };
  }
};

// Compatibility wrappers for already deployed callers while they transition.
export const syncRevenueCatPremium = async (
  admin: SupabaseAdmin,
  userId: string,
  revenueCatSecretKey: string,
  revenueCatProjectId: string,
  premiumEntitlementId: string,
  source: 'revenuecat_api' | 'revenuecat_webhook',
) => {
  const state = await syncRevenueCatTier(
    admin, userId, revenueCatSecretKey, revenueCatProjectId,
    { premium: premiumEntitlementId }, source,
  );
  return { isPremium: state.tier === 'premium', productId: state.productId, expiresAt: state.expiresAt };
};

export const verifyPremiumAccess = async (
  admin: SupabaseAdmin,
  userId: string,
  revenueCatSecretKey: string | undefined,
  revenueCatProjectId: string | undefined,
  premiumEntitlementId: string | undefined,
): Promise<PremiumAccessResult> => {
  const result = await verifySubscriptionFeatureAccess(
    admin, userId, 'fragLotti', revenueCatSecretKey, revenueCatProjectId,
    { premium: premiumEntitlementId },
  );
  return {
    allowed: result.allowed,
    reason: result.reason === 'admin'
      ? 'admin'
      : result.reason === 'special_access'
        ? 'premium_tester'
        : result.reason === 'revenuecat'
          ? 'revenuecat'
          : result.reason === 'unavailable'
            ? 'unavailable'
            : 'not_premium',
  };
};
