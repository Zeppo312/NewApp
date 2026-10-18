import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRuntimeDataConsents, runtimeConsentAllowed } from './dataConsentRuntime';

export const HEALTH_LOCAL_PREFIXES = ['local_read_snapshot_v1:', 'local_activity_draft_v1:', 'local_sleep_stop_v1:', 'local_tracking_outbox_v1:'];
let generation = 0;
let cleanups = 0;
const writes = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
export const localHealthGeneration = () => generation + (getRuntimeDataConsents?.()?.generation ?? 0);
export const subscribeLocalHealth = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const notifyLocalHealth = () => { for (const listener of listeners) listener(); };
export function localHealthAllowed(userId: string, at = localHealthGeneration()) {
  const runtime = getRuntimeDataConsents();
  return cleanups === 0 && at === localHealthGeneration() && runtimeConsentAllowed('health') && runtime.userId === userId;
}
export function serializeLocalHealth<T>(key: string, run: () => Promise<T>): Promise<T> {
  const next = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
  writes.set(key, next);
  void next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => {});
  return next;
}
/** Invalidate first, then drain already-started writes before removing keys. */
export async function clearLocalHealthData(userId?: string, babyId?: string) {
  cleanups += 1; generation += 1;
  notifyLocalHealth();
  try {
  await Promise.allSettled([...writes.values()]);
  const keys = await AsyncStorage.getAllKeys();
  const removable = keys.filter(key => HEALTH_LOCAL_PREFIXES.some(prefix => key.startsWith(prefix))
    && (!userId || key.includes(`:${encodeURIComponent(userId)}:`))
    && (!babyId || key.includes(`:${encodeURIComponent(babyId)}:`)));
  await AsyncStorage.multiRemove(removable);
  // The outbox is per account; a child access loss removes only that child's work.
  if (babyId) for (const key of keys.filter(key => key.startsWith('local_tracking_outbox_v1:') && (!userId || key.includes(`:${encodeURIComponent(userId)}:`)))) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) { const rows = JSON.parse(raw); await AsyncStorage.setItem(key, JSON.stringify(rows.filter((row: any) => row.scope?.babyId !== babyId))); }
  }
  } finally { cleanups -= 1; generation += 1; notifyLocalHealth(); }
}
