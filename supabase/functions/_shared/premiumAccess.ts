import { assertAccountActive } from './accountDeletion/access.ts';
// Server-side subscription feature verification. A client-provided tier or
// locally cached feature matrix is never trusted here: RevenueCat determines
// the tier and Postgres determines whether that tier may use the feature.

type SupabaseAdmin = { from: (table: string) => any; rpc: (name: string, args?: any) => any };

import { CACHE_MAX_AGE_MS, cachedSubscriptionTier, fetchRevenueCatTier } from './revenuecatState.ts';
import { familySharingEnvironment } from './familySandboxEnvironment.ts';
import type { RevenueCatEntitlementConfig, ServerSubscriptionTier } from './revenuecatState.ts';
export { parseRevenueCatTier } from './revenuecatState.ts';
export type { RevenueCatEntitlementConfig, ServerSubscriptionTier } from './revenuecatState.ts';
export type FeatureAccessResult = {
  allowed: boolean;
  reason: 'admin' | 'special_access' | 'revenuecat' | 'family_subscription' | 'feature_disabled' | 'not_entitled' | 'unavailable';
  tier: ServerSubscriptionTier | null;
};
export type PremiumAccessResult = {
  allowed: boolean;
  reason: 'admin' | 'premium_tester' | 'revenuecat' | 'not_premium' | 'unavailable';
};

const STALE_POSITIVE_GRACE_MS = 24 * 60 * 60_000;
const isFutureOrLifetime = (value: unknown): boolean =>
  value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now());

export const syncRevenueCatTier = async (
  admin: SupabaseAdmin,
  userId: string,
  revenueCatSecretKey: string,
  revenueCatProjectId: string,
  entitlementConfig: RevenueCatEntitlementConfig,
  source: 'revenuecat_api' | 'revenuecat_webhook',
) => {
  await assertAccountActive(admin, userId);
  // Optimistic concurrency across Edge isolates AND app/webhook requests. Read the
  // version BEFORE RevenueCat. After a conflict discard the snapshot and fetch again.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: previous, error: readError } = await admin.from('lotti_subscription_entitlements')
      .select('checked_at').eq('user_id', userId).maybeSingle();
    if (readError) throw new Error('subscription_cache_read_failed');
    const state = await fetchRevenueCatTier(userId, revenueCatSecretKey, revenueCatProjectId, entitlementConfig,
      familySharingEnvironment(userId));
    const checkedAt = new Date(Math.max(Date.now(), previous ? Date.parse(previous.checked_at) + 1 : 0)).toISOString();
    const row = {
      user_id: userId, tier: state.tier, is_premium: state.tier === 'premium',
      product_id: state.productId, expires_at: state.expiresAt, source,
      checked_at: checkedAt, updated_at: checkedAt,
      paid_tier: state.paid?.tier ?? null,
      paid_expires_at: state.paid?.expiresAt ?? null,
      paid_subscription_id: state.paid?.subscriptionId ?? null,
      paid_verified_at: checkedAt,
    };
    const query = previous
      ? admin.from('lotti_subscription_entitlements').update(row).eq('user_id', userId).eq('checked_at', previous.checked_at)
      : admin.from('lotti_subscription_entitlements').upsert(row, { onConflict: 'user_id', ignoreDuplicates: true });
    const { data, error } = await query.select('user_id');
    if (error) throw new Error('subscription_cache_write_failed');
    if (data?.length === 1) return state;
  }
  throw new Error('subscription_cache_conflict');
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

const verifyOwnSubscriptionFeatureAccess = async (
  admin: SupabaseAdmin,
  userId: string,
  feature: string,
  revenueCatSecretKey: string | undefined,
  revenueCatProjectId: string | undefined,
  entitlementConfig: RevenueCatEntitlementConfig,
): Promise<FeatureAccessResult> => {
  await assertAccountActive(admin, userId);
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
    .select('tier, is_premium, product_id, expires_at, checked_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (cacheError) return { allowed: false, reason: 'unavailable', tier: null };

  const cachedTier = cachedSubscriptionTier(cached);
  const age = typeof cached?.checked_at === 'string' ? Date.now() - Date.parse(cached.checked_at) : NaN;
  const cacheFresh = age >= 0 && age < CACHE_MAX_AGE_MS;
  const cacheWithinGrace = age >= 0 && age < STALE_POSITIVE_GRACE_MS;
  const cacheActive = cachedTier !== null && isFutureOrLifetime(cached?.expires_at);

  // Refresh expired paid and negative rows: renewal/restore may precede its webhook.
  if (cacheFresh && cacheActive) {
    return resultForTier(admin, feature, cachedTier, 'revenuecat');
  }

  if (!revenueCatSecretKey || !revenueCatProjectId) {
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
    // A webhook may have revoked access while this API request was failing.
    // Never fall back to the positive row read before that revocation.
    const { data: latest, error } = await admin.from('lotti_subscription_entitlements')
      .select('tier, is_premium, product_id, expires_at, checked_at').eq('user_id', userId).maybeSingle();
    if (!error && latest?.checked_at === cached?.checked_at && cacheActive && cacheWithinGrace &&
      cachedSubscriptionTier(latest) === cachedTier && isFutureOrLifetime(latest?.expires_at)) return resultForTier(admin, feature, cachedTier, 'revenuecat');
    return { allowed: false, reason: 'unavailable', tier: null };
  }
};

/** The service-only SQL resolver returns one verified partner, never a chain. */
export async function resolveFamilySubscriptionAccess(
  admin: SupabaseAdmin, userId: string, secret: string | undefined,
  projectId: string | undefined, config: RevenueCatEntitlementConfig,
): Promise<Record<string, any>> {
  await assertAccountActive(admin, userId);
  let refreshed = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.rpc('family_subscription_state', { p_user_id: userId });
    if (error || !data || data.userId !== userId || data.schemaVersion !== 1) {
      throw new Error('family_state_unavailable');
    }
    if (data.status === 'none') return data;
    if (data.status === 'active') {
      // Refresh before the client lease ends. On failure re-read membership and
      // the cache; never return a grant captured before an unlink/revocation.
      if (!refreshed && secret && projectId && typeof data.sponsorId === 'string' &&
          Date.parse(data.validUntil) <= Date.now() + 30_000) {
        refreshed = true;
        try { await syncRevenueCatTier(admin, data.sponsorId, secret, projectId, config, 'revenuecat_api'); }
        catch { /* A still-valid lease can survive only after the SQL re-read. */ }
        continue;
      }
      return data;
    }
    if (data.status !== 'stale' || typeof data.sponsorId !== 'string' || !secret || !projectId) {
      throw new Error('family_verification_unavailable');
    }
    await syncRevenueCatTier(admin, data.sponsorId, secret, projectId, config, 'revenuecat_api');
    refreshed = true;
    // Re-read the relationship after HTTP: it may have been severed or changed.
  }
  throw new Error('family_state_conflict');
}

export const verifySubscriptionFeatureAccess = async (
  admin: SupabaseAdmin, userId: string, feature: string,
  secret: string | undefined, projectId: string | undefined, config: RevenueCatEntitlementConfig,
): Promise<FeatureAccessResult> => {
  const own = await verifyOwnSubscriptionFeatureAccess(admin, userId, feature, secret, projectId, config);
  // Special access is personal and keeps its existing precedence.
  if (own.reason === 'admin' || own.reason === 'special_access') return own;
  const { data: profile, error } = await admin.from('profiles').select('is_admin, paywall_access_role')
    .eq('id', userId).maybeSingle();
  if (error) return { allowed: false, reason: 'unavailable', tier: null };
  if (specialTier(profile) || own.tier === 'premium') return own;
  try {
    const family = await resolveFamilySubscriptionAccess(admin, userId, secret, projectId, config);
    const rank = (tier: any) => tier === 'premium' ? 3 : tier === 'standard' ? 2 : tier === 'lite' ? 1 : 0;
    if (family.status === 'active' && rank(family.tier) > rank(own.tier)) {
      return resultForTier(admin, feature, family.tier, 'family_subscription');
    }
    return own;
  } catch {
    return own.allowed ? own : { allowed: false, reason: 'unavailable', tier: null };
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
        : result.reason === 'revenuecat' || result.reason === 'family_subscription'
          ? 'revenuecat'
          : result.reason === 'unavailable'
            ? 'unavailable'
            : 'not_premium',
  };
};
