import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { backendHost, localScopeKey, type LocalScope, readSnapshot, writeSnapshot } from './localReadSnapshots';
import { localHealthAllowed, localHealthGeneration, serializeLocalHealth, notifyLocalHealth } from './localHealthStorage';
import { validVersionedSleepEntry, type VersionedSleepEntry, type SleepScopeSnapshot, type FrozenSleepStop, validSleepScopeSnapshot } from './sleepSyncContract';
export type ConfirmedSleepSnapshot = { canWrite: boolean; entry: VersionedSleepEntry; scopeRevision: string; verifiedAt: string };
export type PendingSleepStop = { schemaVersion: 1; operationId: string; localRevision: number; scope: LocalScope; originalEntryId: string;
  baseEntry: ConfirmedSleepSnapshot; originalStopAt: string; chosenStopAt: string; proposedQuality: VersionedSleepEntry['quality']; proposedNotes: string | null;
  reconcilePolicy: 'auto_if_unchanged' | 'ask_always'; state: 'pending' | 'checking' | 'needs_decision' | 'sending' | 'confirmation_unknown' | 'blocked' | 'confirmed' | 'discarded';
  frozen?: FrozenSleepStop; current?: SleepScopeSnapshot; resultSeen?: boolean; outcome?: string };
const keyFor = (scope: LocalScope, entryId: string) => `local_sleep_stop_v1:${localScopeKey(scope)}:${entryId}`;
export function validPendingSleepStop(v: any): v is PendingSleepStop {
  return v?.schemaVersion === 1 && typeof v.operationId === 'string' && v.operationId.length > 0 && Number.isInteger(v.localRevision) && v.localRevision > 0
    && typeof v.scope?.userId === 'string' && v.scope.backendHost === backendHost() && typeof v.scope.babyId === 'string'
    && v.baseEntry?.canWrite === true && validVersionedSleepEntry(v.baseEntry?.entry) && v.baseEntry.entry.id === v.originalEntryId && v.baseEntry.entry.baby_id === v.scope.babyId
    && typeof v.baseEntry.scopeRevision === 'string' && /^(0|[1-9]\d*)$/.test(v.baseEntry.scopeRevision) && Number.isFinite(Date.parse(v.baseEntry.verifiedAt))
    && Number.isFinite(Date.parse(v.originalStopAt)) && Number.isFinite(Date.parse(v.chosenStopAt)) && [null,'good','medium','bad'].includes(v.proposedQuality)
    && (v.proposedNotes === null || typeof v.proposedNotes === 'string') && ['auto_if_unchanged','ask_always'].includes(v.reconcilePolicy)
    && ['pending','checking','needs_decision','sending','confirmation_unknown','blocked','confirmed','discarded'].includes(v.state)
    && (!v.current || validSleepScopeSnapshot(v.current) && v.current.babyId === v.scope.babyId)
    && (!v.frozen || v.frozen.p_expected_actor === v.scope.userId && v.frozen.p_operation_id === v.operationId && v.frozen.p_entry_id === v.originalEntryId && v.frozen.p_baby_id === v.scope.babyId
      && v.frozen.p_stop_at === v.chosenStopAt && typeof v.frozen.p_expected_entry_revision === 'string' && typeof v.frozen.p_expected_scope_revision === 'string'
      && typeof v.frozen.p_change_quality === 'boolean' && typeof v.frozen.p_change_notes === 'boolean');
}
export async function listPendingSleepStops(userId: string): Promise<PendingSleepStop[]> {
  const generation = localHealthGeneration(); if (!localHealthAllowed(userId, generation)) return [];
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`local_sleep_stop_v1:${encodeURIComponent(backendHost())}:${encodeURIComponent(userId)}:`));
  const rows = await AsyncStorage.multiGet(keys); if (!localHealthAllowed(userId, generation)) return [];
  return rows.flatMap(([key, raw]) => {
    try { const v = JSON.parse(raw ?? 'null'); if (!validPendingSleepStop(v) || v.scope.userId !== userId || keyFor(v.scope, v.originalEntryId) !== key) return [];
      if (v.state === 'sending') v.state = 'confirmation_unknown'; if (v.state === 'checking') v.state = 'pending'; return [v];
    } catch { return []; }
  });
}
export async function persistSleepStop(value: PendingSleepStop, expectedRevision?: number, generation = localHealthGeneration()) {
  if (!validPendingSleepStop(value)) throw new Error('Invalid sleep journal');
  const key = keyFor(value.scope, value.originalEntryId);
  return serializeLocalHealth(key, async () => {
    if (!localHealthAllowed(value.scope.userId, generation)) throw new Error('Sleep scope unavailable');
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const previous = JSON.parse(raw);
      if (!validPendingSleepStop(previous) || previous.localRevision !== expectedRevision) throw new Error('Sleep action changed');
    } else if (expectedRevision !== undefined) throw new Error('Sleep action removed');
    await AsyncStorage.setItem(key, JSON.stringify(value));
    if (!localHealthAllowed(value.scope.userId, generation)) throw new Error('Sleep scope unavailable');
    notifyLocalHealth(); return value;
  });
}
export async function createPendingSleepStop(scope: LocalScope, base: ConfirmedSleepSnapshot, stopAt: string, quality: VersionedSleepEntry['quality'], notes: string | null) {
  if (!base.canWrite || base.entry.end_time !== null || base.entry.baby_id !== scope.babyId) throw new Error('Original sleep is unavailable');
  const existing = (await listPendingSleepStops(scope.userId)).find(value => value.originalEntryId === base.entry.id);
  if (existing && !['confirmed','discarded'].includes(existing.state)) return existing;
  return persistSleepStop({ schemaVersion: 1, operationId: randomUUID(), localRevision: (existing?.localRevision ?? 0) + 1, scope, originalEntryId: base.entry.id, baseEntry: base,
    originalStopAt: stopAt, chosenStopAt: stopAt, proposedQuality: quality, proposedNotes: notes, reconcilePolicy: 'auto_if_unchanged', state: 'pending' }, existing?.localRevision);
}
export { pendingSleepOverlay } from './sleepPendingOverlay';
export async function rememberActiveSleep(scope: LocalScope, snapshot: SleepScopeSnapshot) {
  const active = snapshot.entries.filter(entry => entry.end_time === null);
  if (active.length !== 1) { await writeSnapshot(scope, 'sleep-active', null); return; }
  await writeSnapshot(scope, 'sleep-active', { canWrite: snapshot.original?.id === active[0].id && snapshot.canWrite, entry: active[0], scopeRevision: snapshot.scopeRevision, verifiedAt: snapshot.verifiedAt });
}
export function readKnownActiveSleep(scope: LocalScope) {
  return readSnapshot(scope, 'sleep-active', (v): v is ConfirmedSleepSnapshot => !!v && typeof (v as any).canWrite === 'boolean' && validVersionedSleepEntry((v as any).entry)
    && (v as any).entry.baby_id === scope.babyId && (v as any).entry.end_time === null && typeof (v as any).scopeRevision === 'string' && Number.isFinite(Date.parse((v as any).verifiedAt)));
}

/** Acknowledged terminal entries can be removed; unfinished requests retain their stable ID. */
export async function acknowledgeSleepStop(action: PendingSleepStop) {
  const key = keyFor(action.scope, action.originalEntryId); const generation = localHealthGeneration();
  await serializeLocalHealth(key, async () => {
    if (!localHealthAllowed(action.scope.userId, generation)) return;
    const raw = await AsyncStorage.getItem(key); if (!raw) return;
    const value = JSON.parse(raw);
    if (value.localRevision !== action.localRevision || !['confirmed','discarded'].includes(value.state)) return;
    await AsyncStorage.removeItem(key); notifyLocalHealth();
  });
}

export const sleepAccessNoticeKey = (userId: string) => `sleep_sync_notice_v1:${encodeURIComponent(userId)}`;
export async function recordSleepAccessNotice(userId: string) {
  await AsyncStorage.setItem(sleepAccessNoticeKey(userId), 'access_lost'); notifyLocalHealth();
}
