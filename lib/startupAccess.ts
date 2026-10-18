import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { PaywallAccessReason } from './paywallAccess';

// Local display continuity only; never a subscription tier or API credential.
export const STARTUP_ACCESS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const STARTUP_ACCESS_PREFIX = 'startup_access_v1:';
export type StartupAccessScope = { backendHost: string; userId: string };
export type StartupAccessEvidence = {
  accessReason: Exclude<PaywallAccessReason, 'none'>;
  verifiedAt: number;
  subscriptionExpiresAt: number | null;
};
export type StartupAccessSnapshot = StartupAccessScope & StartupAccessEvidence & {
  schemaVersion: 1;
  validUntil: number;
};
const reasons = ['subscription', 'family_subscription', 'admin', 'tester', 'premium_tester', 'lite_tester', 'cooperation_partner'];
const keyFor = ({ backendHost, userId }: StartupAccessScope) => `${STARTUP_ACCESS_PREFIX}${encodeURIComponent(backendHost)}:${encodeURIComponent(userId)}`;
const revisions = new Map<string, number>();
const revoked = new Set<string>();
const writes = new Map<string, Promise<unknown>>();
let cleanupRevision = 0;
let clearing = false;

export const startupAccessRevision = (scope: StartupAccessScope) => `${cleanupRevision}:${revisions.get(keyFor(scope)) ?? 0}`;
function serialize<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
  writes.set(key, pending);
  void pending.finally(() => { if (writes.get(key) === pending) writes.delete(key); }).catch(() => {});
  return pending;
}
export function validStartupAccess(value: unknown, scope: StartupAccessScope, now = Date.now()): value is StartupAccessSnapshot {
  if (!value || typeof value !== 'object') return false;
  const row = value as StartupAccessSnapshot;
  return row.schemaVersion === 1 && row.backendHost === scope.backendHost && row.userId === scope.userId
    && reasons.includes(row.accessReason) && Number.isFinite(row.verifiedAt) && row.verifiedAt > 0 && row.verifiedAt <= now
    && Number.isFinite(row.validUntil) && row.validUntil > now && row.validUntil <= row.verifiedAt + STARTUP_ACCESS_MAX_AGE_MS
    && (row.subscriptionExpiresAt === null || (Number.isFinite(row.subscriptionExpiresAt) && row.validUntil <= row.subscriptionExpiresAt));
}
export async function readStartupAccess(scope: StartupAccessScope): Promise<StartupAccessSnapshot | null> {
  const revision = startupAccessRevision(scope);
  if (clearing || revoked.has(keyFor(scope))) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(scope));
    const value: unknown = raw ? JSON.parse(raw) : null;
    return !clearing && !revoked.has(keyFor(scope)) && revision === startupAccessRevision(scope) && validStartupAccess(value, scope) ? value : null;
  } catch { return null; }
}
export function createStartupAccessSnapshot(scope: StartupAccessScope, evidence: StartupAccessEvidence): StartupAccessSnapshot | null {
  const snapshot: StartupAccessSnapshot = { ...scope, ...evidence, schemaVersion: 1,
    validUntil: Math.min(evidence.verifiedAt + STARTUP_ACCESS_MAX_AGE_MS, evidence.subscriptionExpiresAt ?? Infinity) };
  return validStartupAccess(snapshot, scope) ? snapshot : null;
}
export async function persistStartupAccess(scope: StartupAccessScope, evidence: StartupAccessEvidence, revision = startupAccessRevision(scope)): Promise<StartupAccessSnapshot | null> {
  const snapshot = createStartupAccessSnapshot(scope, evidence);
  if (!snapshot) return null;
  return serialize(keyFor(scope), async () => {
    if (clearing || revision !== startupAccessRevision(scope)) return null;
    await AsyncStorage.setItem(keyFor(scope), JSON.stringify(snapshot));
    if (!clearing && revision === startupAccessRevision(scope)) revoked.delete(keyFor(scope));
    return !clearing && revision === startupAccessRevision(scope) ? snapshot : null;
  });
}
/** Invalidates synchronously, then drains older writes before removing storage. */
export function revokeStartupAccess(scope: StartupAccessScope): Promise<void> {
  const key = keyFor(scope);
  revisions.set(key, (revisions.get(key) ?? 0) + 1);
  revoked.add(key);
  return serialize(key, () => AsyncStorage.removeItem(key));
}
export async function clearStartupAccess(): Promise<void> {
  cleanupRevision++;
  clearing = true;
  try {
    await Promise.allSettled([...writes.values()]);
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(STARTUP_ACCESS_PREFIX));
    await AsyncStorage.multiRemove(keys);
  } finally { clearing = false; }
}

/** Read the SDK's existing storage, without rotating tokens or duplicating them.
 * Even an expired token can identify a local display session; the bounded access
 * snapshot is mandatory, and all server calls still use normal Supabase auth. */
export async function readStartupDisplaySession(backendHost: string, storageKey: string): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value.user?.id !== 'string' || !value.user.id || typeof value.access_token !== 'string' || !value.access_token
      || typeof value.refresh_token !== 'string' || !value.refresh_token || !Number.isFinite(value.expires_at)) return null;
    return await readStartupAccess({ backendHost, userId: value.user.id }) ? value as Session : null;
  } catch { return null; }
}
