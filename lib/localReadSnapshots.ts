import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseUrl } from './supabase';
import { localHealthAllowed, localHealthGeneration, serializeLocalHealth } from './localHealthStorage';

export type LocalScope = { backendHost: string; userId: string; babyId?: string | null; localDateKey?: string };
export type ReadSnapshot<T> = { schemaVersion: 1; scope: LocalScope; dataset: string; data: T; verifiedAt: string };
export const backendHost = () => new URL(supabaseUrl).host;
export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const localScopeKey = (scope: LocalScope) => [scope.backendHost, scope.userId, scope.babyId ?? '-', scope.localDateKey ?? '-'].map(encodeURIComponent).join(':');
let readRevision = 0;
export const readSnapshotRevision = () => readRevision;
const keyFor = (scope: LocalScope, dataset: string) => `local_read_snapshot_v1:${localScopeKey(scope)}:${dataset}`;
export function isRetainedLocalDay(key: string, now = new Date()) {
  for (let i = 0; i < 7; i++) { const day = new Date(now); day.setDate(day.getDate() - i); if (localDateKey(day) === key) return true; }
  return false;
}
export async function readSnapshot<T>(scope: LocalScope, dataset: string, validate: (data: unknown) => data is T, now = new Date()): Promise<ReadSnapshot<T> | null> {
  const generation = localHealthGeneration();
  if (!localHealthAllowed(scope.userId, generation)) return null;
  const key = keyFor(scope, dataset);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw || !localHealthAllowed(scope.userId, generation)) return null;
    const value = JSON.parse(raw);
    const age = now.getTime() - Date.parse(value.verifiedAt);
    if (value.schemaVersion !== 1 || localScopeKey(value.scope) !== localScopeKey(scope) || value.dataset !== dataset || !validate(value.data)) return null;
    if (!Number.isFinite(age) || age < 0 || age > 7 * 86400000 || (scope.localDateKey && !isRetainedLocalDay(scope.localDateKey, now))) {
      await serializeLocalHealth(key, () => AsyncStorage.removeItem(key)); return null;
    }
    return value;
  } catch { return null; }
}
export async function writeSnapshot<T>(scope: LocalScope, dataset: string, data: T, verifiedAt = new Date().toISOString(), expectedGeneration = localHealthGeneration(), expectedReadRevision = readRevision) {
  const key = keyFor(scope, dataset);
  await serializeLocalHealth(key, async () => {
    if (!localHealthAllowed(scope.userId, expectedGeneration) || expectedReadRevision !== readRevision) return;
    if (scope.localDateKey && !isRetainedLocalDay(scope.localDateKey)) return;
    const keys = await AsyncStorage.getAllKeys();
    const prefix = `local_read_snapshot_v1:${[scope.backendHost, scope.userId, scope.babyId ?? '-'].map(encodeURIComponent).join(':')}:`;
    const expired = keys.filter(k => k.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}$/.test(decodeURIComponent(k.split(':')[4])) && !isRetainedLocalDay(decodeURIComponent(k.split(':')[4])));
    await Promise.all(expired.map(k => serializeLocalHealth(k, () => AsyncStorage.removeItem(k))));
    if (!localHealthAllowed(scope.userId, expectedGeneration) || expectedReadRevision !== readRevision) return;
    await AsyncStorage.setItem(key, JSON.stringify({ schemaVersion: 1, scope, dataset, data, verifiedAt }));
  });
}
/** Own mutations remove known old reads. Ordinary refresh never calls this. */
export async function invalidateReadSnapshots(userId: string, babyId?: string, datasets?: string[]) {
  readRevision += 1;
  const generation = localHealthGeneration();
  const keys = await AsyncStorage.getAllKeys();
  await Promise.all(keys.filter(key => key.startsWith('local_read_snapshot_v1:') && key.includes(`:${encodeURIComponent(userId)}:`)
    && (!babyId || key.includes(`:${encodeURIComponent(babyId)}:`)) && (!datasets || datasets.some(dataset => key.endsWith(`:${dataset}`))))
    .map(key => serializeLocalHealth(key, async () => { if (generation === localHealthGeneration()) await AsyncStorage.removeItem(key); })));
}
export const validRows = (value: unknown): value is any[] => Array.isArray(value) && value.every(row => row && typeof row.id === 'string');
