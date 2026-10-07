import { supabase } from './supabase';
import type { AppSubscriptionTier } from './subscriptionFeaturePolicy';

// Contract: docs/family-subscription-access.md. This RPC is deployed separately.
// A partner link alone is never a paid entitlement.
export const FAMILY_ACCESS_REFRESH_MS = 60_000;
export const FAMILY_ACCESS_POLL_MS = 15_000;
const FAMILY_ACCESS_RENEW_AHEAD_MS = 30_000;
export const FAMILY_ACCESS_MAX_LEASE_MS = 5 * 60_000;
export type FamilyAccess =
  | { status: 'active'; userId: string; tier: AppSubscriptionTier; expiresAt: string; validUntil: number }
  | { status: 'none' | 'unsupported' | 'unavailable'; userId: string };

const entries = new Map<string, { value: FamilyAccess; checkedAt: number }>();
const requests = new Map<string, Promise<FamilyAccess>>();
const revisions = new Map<string, number>();
const supportedUsers = new Set<string>();
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<(userId: string) => void>();
const unavailable = (userId: string): FamilyAccess => ({ status: 'unavailable', userId });

export function parseFamilyAccess(value: unknown, userId: string, now = Date.now()): FamilyAccess {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable(userId);
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== 1 || row.userId !== userId) return unavailable(userId);
  if (row.status === 'none') return { status: 'none', userId };
  if (row.status !== 'active' || !['lite', 'standard', 'premium'].includes(String(row.tier)) ||
      typeof row.expiresAt !== 'string' || typeof row.validUntil !== 'string') return unavailable(userId);
  const expiry = Date.parse(row.expiresAt);
  const lease = Date.parse(row.validUntil);
  if (!Number.isFinite(expiry) || !Number.isFinite(lease) || lease <= now || expiry <= now || lease > expiry) {
    return unavailable(userId);
  }
  return {
    status: 'active', userId, tier: row.tier as AppSubscriptionTier, expiresAt: row.expiresAt,
    validUntil: Math.min(lease, now + FAMILY_ACCESS_MAX_LEASE_MS),
  };
}

export const hasCheckedFamilyAccess = (userId: string) => entries.has(userId);

export function getCachedFamilyAccess(userId: string): FamilyAccess {
  const entry = entries.get(userId);
  if (!entry || entry.checkedAt > Date.now()) return unavailable(userId);
  if (entry.value.status === 'active' && entry.value.validUntil <= Date.now()) return unavailable(userId);
  return entry.value;
}

export function subscribeToFamilyAccess(listener: (userId: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function invalidateFamilyAccess(userId: string) {
  revisions.set(userId, (revisions.get(userId) ?? 0) + 1);
  entries.delete(userId);
  requests.delete(userId);
  clearTimeout(expiryTimers.get(userId));
  expiryTimers.delete(userId);
  listeners.forEach(listener => listener(userId));
}

export function clearFamilyAccess() {
  new Set([...entries.keys(), ...requests.keys()]).forEach(invalidateFamilyAccess);
}

export async function refreshFamilyAccess(userId: string, options: { force?: boolean } = {}): Promise<FamilyAccess> {
  const entry = entries.get(userId);
  const cached = getCachedFamilyAccess(userId);
  if (!options.force && entry && Date.now() - entry.checkedAt < FAMILY_ACCESS_REFRESH_MS &&
      cached.status !== 'unavailable' &&
      (cached.status !== 'active' || cached.validUntil - Date.now() > FAMILY_ACCESS_RENEW_AHEAD_MS)) return cached;
  const existing = requests.get(userId);
  if (existing) return existing;
  const revision = revisions.get(userId) ?? 0;
  const request = (async () => {
    let result: FamilyAccess = unavailable(userId);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      result = await Promise.race([
        (async (): Promise<FamilyAccess> => {
          const { data: session } = await supabase.auth.getSession();
          if (session.session?.user.id !== userId) return unavailable(userId);
          const { data, error } = await supabase.rpc('get_family_subscription_access')
            .abortSignal(controller.signal);
          const parsed = error ? unavailable(userId) : parseFamilyAccess(data, userId);
          if ((error?.code === 'P0001' && error.message?.includes('family_verification_required')) ||
              (parsed.status === 'active' && parsed.validUntil - Date.now() <= FAMILY_ACCESS_RENEW_AHEAD_MS)) {
            supportedUsers.add(userId);
            const refreshed = await supabase.functions.invoke('family-subscription-access', {
              body: {}, signal: controller.signal,
            });
            return refreshed.error ? unavailable(userId) : parseFamilyAccess(refreshed.data, userId);
          }
          // Once this account has used the endpoint, a missing RPC is an
          // outage, not permission to buy a duplicate subscription.
          return error?.code === 'PGRST202' && !supportedUsers.has(userId)
            ? { status: 'unsupported', userId }
            : error ? unavailable(userId) : parsed;
        })(),
        new Promise<FamilyAccess>(resolve => {
          timeout = setTimeout(() => { controller.abort(); resolve(unavailable(userId)); }, 8_000);
        }),
      ]);
    } catch {
      result = unavailable(userId);
    } finally {
      clearTimeout(timeout);
    }
    if ((revisions.get(userId) ?? 0) !== revision) return unavailable(userId);
    if (result.status === 'active' || result.status === 'none') supportedUsers.add(userId);
    // A network error can retain a previously verified, bounded lease, never
    // renew it. An explicit 'none' immediately revokes it.
    if (result.status === 'unavailable') {
      const previous = getCachedFamilyAccess(userId);
      if (previous.status === 'active') result = previous;
    }
    entries.set(userId, { value: result, checkedAt: Date.now() });
    clearTimeout(expiryTimers.get(userId));
    expiryTimers.delete(userId);
    if (result.status === 'active') {
      expiryTimers.set(userId, setTimeout(() => {
        entries.set(userId, { value: unavailable(userId), checkedAt: Date.now() });
        expiryTimers.delete(userId);
        listeners.forEach(listener => listener(userId));
      }, Math.max(0, result.validUntil - Date.now())));
    }
    listeners.forEach(listener => listener(userId));
    return result;
  })();
  requests.set(userId, request);
  try { return await request; }
  finally { if (requests.get(userId) === request) requests.delete(userId); }
}

/** Store checkout requires a fresh negative response, never an offline lease. */
export async function checkFamilyPurchaseAccess(userId: string): Promise<'allowed' | 'family' | 'unavailable'> {
  const result = await refreshFamilyAccess(userId, { force: true });
  return result.status === 'active' ? 'family'
    : result.status === 'none' || result.status === 'unsupported' ? 'allowed' : 'unavailable';
}

export function resetFamilyAccessForTests() { clearFamilyAccess(); supportedUsers.clear(); }
