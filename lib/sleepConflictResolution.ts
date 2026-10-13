import type { SleepScopeSnapshot, VersionedSleepEntry } from './sleepSyncContract';
export type SleepConflictKind = 'unchanged' | 'agreed' | 'changed' | 'structure' | 'unavailable' | 'forbidden' | 'invalid';
export function classifySleepStop(base: VersionedSleepEntry, baseScopeRevision: string, stopAt: string,
  quality: VersionedSleepEntry['quality'], notes: string | null, current: SleepScopeSnapshot): SleepConflictKind {
  const target = current.original;
  if (!target || target.id !== base.id || target.baby_id !== base.baby_id) return 'unavailable';
  if (!current.canWrite) return 'forbidden';
  const duration = Date.parse(stopAt) - Date.parse(target.start_time);
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400000 || Date.parse(stopAt) > Date.now() + 300000) return 'invalid';
  const otherActive = current.entries.filter(entry => entry.end_time === null && entry.id !== base.id);
  if (otherActive.length > 0) return 'structure';
  if (target.sync_revision === base.sync_revision && current.scopeRevision === baseScopeRevision && target.end_time === null) return 'unchanged';
  // Identical times do not invent an operation receipt or an actor attribution.
  if (target.start_time === base.start_time && target.end_time !== null && Date.parse(target.end_time) === Date.parse(stopAt)
    && target.quality === quality && target.notes === notes && current.scopeRevision === String(BigInt(baseScopeRevision) + 1n)) return 'agreed';
  if (current.scopeRevision !== baseScopeRevision && target.sync_revision === base.sync_revision) return 'structure';
  return 'changed';
}
