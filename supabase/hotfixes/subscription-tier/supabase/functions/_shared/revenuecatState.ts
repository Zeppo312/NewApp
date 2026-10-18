// RevenueCat API v2 contract: subscription.gives_access is authoritative;
// auto_renewal_status, pending changes and webhook event names are not grants.
export type ServerSubscriptionTier = 'lite' | 'standard' | 'premium';
export type RevenueCatEntitlementConfig = {
  premium: string | undefined;
  standard?: string;
  lite?: string;
};
export type VerifiedTierState = {
  tier: ServerSubscriptionTier | null;
  productId: string | null;
  expiresAt: string | null;
  // Separate evidence for sharing. Never populated by a promotional entitlement.
  paid?: { tier: ServerSubscriptionTier; expiresAt: string; subscriptionId: string } | null;
};
export const CACHE_MAX_AGE_MS = 15 * 60_000;
const SHARED_ENTITLEMENT_ID = 'entl7a7b4e9838'; // Live LottiBabyAbo; never means Premium.
// Applies both to fresh cache reads and outage fallback. The old live resolver
// stored this shared grant as a Premium product; it is never tier evidence.
export function cachedSubscriptionTier(row: any): ServerSubscriptionTier | null {
  if (row?.product_id === SHARED_ENTITLEMENT_ID || row?.product_id === 'LottiBabyAbo') return null;
  return row?.tier === 'lite' || row?.tier === 'standard' || row?.tier === 'premium'
    ? row.tier : row?.is_premium === true ? 'premium' : null;
}
const emptyState = (): VerifiedTierState => ({ tier: null, productId: null, expiresAt: null });
const rank = (tier: ServerSubscriptionTier) => tier === 'premium' ? 3 : tier === 'standard' ? 2 : 1;
const record = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('revenuecat_invalid_response');
  return value;
};
const expiry = (value: unknown): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 8.64e15) {
    throw new Error('revenuecat_invalid_expiry');
  }
  return value;
};
const items = (payload: unknown): Record<string, any>[] => {
  const list = record(payload);
  if (!Array.isArray(list.items)) throw new Error('revenuecat_invalid_response');
  return list.items.map(record);
};
const choose = (best: VerifiedTierState, next: VerifiedTierState): VerifiedTierState => {
  if (!next.tier) return best;
  if (!best.tier || rank(next.tier) > rank(best.tier)) return next;
  if (next.tier === best.tier && best.expiresAt !== null &&
    (next.expiresAt === null || Date.parse(next.expiresAt) > Date.parse(best.expiresAt))) return next;
  if (next.tier === best.tier && next.expiresAt === best.expiresAt && !best.productId && next.productId) return next;
  return best;
};

// Exact allowlist, kept in parity with lib/revenuecatProducts.ts by a contract test.
export function serverProductTier(id: string, store: string): ServerSubscriptionTier | null {
  for (const tier of ['lite', 'standard', 'premium'] as const) {
    const ios = tier === 'standard' ? 'lottibaby' : `lottibaby_${tier}`;
    if (store === 'app_store' && (id === `${ios}_monthly` || id === `${ios}_yearly`)) return tier;
    if (store === 'play_store' && ['monthly', 'yearly'].some(plan => id === `lottibaby_${tier}:${plan}`)) return tier;
  }
  return null;
}

export function parseRevenueCatTier(payload: unknown, config: RevenueCatEntitlementConfig): VerifiedTierState {
  const configured = Object.values(config).filter(Boolean);
  if (new Set(configured).size !== configured.length) throw new Error('revenuecat_ambiguous_entitlements');
  let best = emptyState();
  for (const entitlement of items(payload)) {
    const end = expiry(entitlement.expires_at);
    if (typeof entitlement.entitlement_id !== 'string') throw new Error('revenuecat_invalid_response');
    if (end !== null && end <= Date.now()) continue;
    // Shared legacy entitlement requires a verified subscription product below.
    if (entitlement.entitlement_id === SHARED_ENTITLEMENT_ID) continue;
    const tier = (['premium', 'standard', 'lite'] as const).find(t => config[t] && config[t] === entitlement.entitlement_id);
    if (tier) best = choose(best, { tier, productId: null, expiresAt: end === null ? null : new Date(end).toISOString() });
  }
  return best;
}

export async function fetchRevenueCatTier(
  userId: string, secret: string, projectId: string, config: RevenueCatEntitlementConfig,
  sharingEnvironment: 'production' | 'sandbox' = 'production',
): Promise<VerifiedTierState> {
  const origin = 'https://api.revenuecat.com';
  const projectPath = `/v2/projects/${encodeURIComponent(projectId)}/`;
  const customerPath = `${projectPath}customers/${encodeURIComponent(userId)}/`;
  const controller = new AbortController();
  // Includes body reads and all pagination/product requests, not just headers.
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const get = async (path: string) => {
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith(projectPath)) throw new Error('revenuecat_invalid_page');
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      signal: controller.signal, redirect: 'error',
    });
    // A 404 can also mean a wrong project/configuration. Never cache it as revocation.
    if (!response.ok) throw new Error(`revenuecat_${response.status}`);
    return record(await response.json());
  };
  const list = async (path: string): Promise<Record<string, any>[]> => {
    const result: Record<string, any>[] = [];
    const seen = new Set<string>();
    let next: string | null = path;
    const expectedPath = new URL(path, origin).pathname;
    while (next) {
      if (seen.has(next) || seen.size >= 20 || new URL(next, origin).pathname !== expectedPath) throw new Error('revenuecat_invalid_page');
      seen.add(next);
      const page = await get(next);
      result.push(...items(page));
      if (page.next_page != null && typeof page.next_page !== 'string') throw new Error('revenuecat_invalid_page');
      next = page.next_page ?? null;
    }
    return result;
  };
  try {
    const entitlements = await list(`${customerPath}active_entitlements?limit=100`);
    let best = parseRevenueCatTier({ items: entitlements }, config);
    let paidBest: VerifiedTierState['paid'] = null;
    const active = new Map(entitlements.filter(e => e.expires_at === null || e.expires_at > Date.now()).map(e => [e.entitlement_id, e]));
    if (active.size === 0) return best;
    const subscriptions = await list(`${customerPath}subscriptions?limit=100`);
    const products = new Map<string, Record<string, any>>();
    for (const sub of subscriptions) {
      if (typeof sub.gives_access !== 'boolean') throw new Error('revenuecat_invalid_response');
      if (!sub.gives_access) continue;
      if (typeof sub.product_id !== 'string' || typeof sub.store !== 'string') throw new Error('revenuecat_invalid_response');
      const grants = items(sub.entitlements);
      // Follow nested entitlement pagination too; never silently drop later grants.
      if (sub.entitlements.next_page) grants.push(...await list(sub.entitlements.next_page));
      const matching = grants.filter(e => active.has(e.id));
      if (!matching.length) continue;
      let product = products.get(sub.product_id);
      if (!product) {
        product = await get(`${projectPath}products/${encodeURIComponent(sub.product_id)}`);
        if (product.id !== sub.product_id || typeof product.store_identifier !== 'string') throw new Error('revenuecat_invalid_product');
        products.set(sub.product_id, product);
      }
      const tier = serverProductTier(product.store_identifier, sub.store);
      if (!tier) {
        if (matching.some(e => e.id === SHARED_ENTITLEMENT_ID)) throw new Error('revenuecat_unmapped_product');
        continue;
      }
      // The shared entitlement can expire after this particular tier (e.g. overlapping
      // Lite and Premium). Bound by this subscription's period. In grace, gives_access
      // remains true after that period: use a short recheck horizon, never lifetime.
      const periodEnd = expiry(sub.ends_at);
      let end = periodEnd !== null && periodEnd > Date.now() ? periodEnd : Date.now() + CACHE_MAX_AGE_MS;
      const grantEnds = matching.map(e => expiry(active.get(e.id)!.expires_at));
      if (!grantEnds.includes(null)) end = Math.min(end, Math.max(...grantEnds as number[]));
      best = choose(best, { tier, productId: product.store_identifier, expiresAt: new Date(end).toISOString() });
      // A store's family_shared ownership, a trial, a sandbox purchase, an alias
      // or a free/promotional grant must never sponsor another account.
      if (sub.customer_id === userId && sub.ownership === 'purchased' &&
          sub.environment === sharingEnvironment &&
          (sub.status === 'active' || sub.status === 'in_grace_period') &&
          typeof sub.total_revenue_in_usd?.gross === 'number' &&
          Number.isFinite(sub.total_revenue_in_usd.gross) &&
          (sharingEnvironment === 'sandbox' ? sub.total_revenue_in_usd.gross >= 0 : sub.total_revenue_in_usd.gross > 0) &&
          typeof sub.id === 'string' && sub.id.length > 0) {
        const paidEnd = new Date(end).toISOString();
        if (!paidBest || rank(tier) > rank(paidBest.tier) ||
            (tier === paidBest.tier && paidEnd > paidBest.expiresAt)) {
          paidBest = { tier, expiresAt: paidEnd, subscriptionId: sub.id };
        }
      }
    }
    if (!best.tier && active.has(SHARED_ENTITLEMENT_ID)) throw new Error('revenuecat_unresolved_shared_entitlement');
    return { ...best, paid: paidBest };
  } finally {
    clearTimeout(timeout);
  }
}
