import { supabase } from './supabase';
import { boundedRead } from './boundedRead';
export const SLEEP_OFFLINE_ENABLED = process.env.EXPO_PUBLIC_SLEEP_OFFLINE_ENABLED === 'true';
export type VersionedSleepEntry = {
  id: string; user_id: string; baby_id: string; start_time: string; end_time: string | null; duration_minutes: number | null;
  notes: string | null; quality: 'good' | 'medium' | 'bad' | null; partner_id: string | null; shared_with_user_id: string | null;
  updated_by: string | null; sync_revision: string;
};
export type SleepScopeSnapshot = { status: 'available'; babyId: string; scopeRevision: string; entries: VersionedSleepEntry[];
  original: VersionedSleepEntry | null; canWrite: boolean; verifiedAt: string };
export type SleepSnapshotResult = SleepScopeSnapshot | { status: 'forbidden' | 'not_available' };
export type FrozenSleepStop = { p_expected_actor: string; p_operation_id: string; p_baby_id: string; p_entry_id: string; p_expected_entry_revision: string;
  p_expected_scope_revision: string; p_stop_at: string; p_quality: VersionedSleepEntry['quality']; p_notes: string | null;
  p_change_quality: boolean; p_change_notes: boolean };
export type SleepStopResult = { status: 'applied' | 'already_applied'; operationId: string; outcome: 'stopped' | 'discarded' }
  | { status: 'conflict'; currentSnapshot: SleepScopeSnapshot } | { status: 'forbidden' | 'not_available' | 'invalid'; reason?: string };
const validRevision = (v: unknown) => typeof v === 'string' && /^\d+$/.test(v) && v !== '0';
export function validVersionedSleepEntry(v: any): v is VersionedSleepEntry {
  return !!v && ['id','user_id','baby_id'].every(key => typeof v[key] === 'string' && v[key].length > 0)
    && typeof v.start_time === 'string' && Number.isFinite(Date.parse(v.start_time))
    && (v.end_time === null || typeof v.end_time === 'string' && Number.isFinite(Date.parse(v.end_time)))
    && (v.duration_minutes === null || typeof v.duration_minutes === 'number' && Number.isFinite(v.duration_minutes))
    && (v.notes === null || typeof v.notes === 'string') && [null,'good','medium','bad'].includes(v.quality)
    && ['partner_id','shared_with_user_id','updated_by'].every(key => v[key] === null || typeof v[key] === 'string') && validRevision(v.sync_revision);
}
export function validSleepScopeSnapshot(v: any): v is SleepScopeSnapshot {
  return v?.status === 'available' && typeof v.babyId === 'string' && /^(0|[1-9]\d*)$/.test(v.scopeRevision)
    && typeof v.canWrite === 'boolean' && Number.isFinite(Date.parse(v.verifiedAt)) && Array.isArray(v.entries)
    && v.entries.every((entry: any) => validVersionedSleepEntry(entry) && entry.baby_id === v.babyId)
    && new Set(v.entries.map((entry: any) => entry.id)).size === v.entries.length
    && (v.original === null || validVersionedSleepEntry(v.original) && v.original.baby_id === v.babyId && v.entries.some((entry: any) => entry.id === v.original.id && entry.sync_revision === v.original.sync_revision));
}
export async function readSleepCapability(userId: string) {
  if (!SLEEP_OFFLINE_ENABLED) return false;
  return boundedRead(`sleep-capability:${userId}`, async signal => {
    const { data, error } = await supabase.rpc('sleep_sync_capability').abortSignal(signal);
    if (error) throw error;
    return data?.version === 1 && data.enabled === true && data.legacyWritersBlocked === true;
  });
}
export function readSleepSyncSnapshot(userId: string, babyId: string, entryId: string | null, signal?: AbortSignal): Promise<SleepSnapshotResult> {
  const read = async (requestSignal: AbortSignal): Promise<SleepSnapshotResult> => {
    const { data, error } = await supabase.rpc('sleep_sync_snapshot', { p_baby_id: babyId, p_entry_id: entryId }).abortSignal(requestSignal);
    if (error) throw error;
    if (data?.status === 'forbidden' || data?.status === 'not_available') return data;
    if (!validSleepScopeSnapshot(data) || data.babyId !== babyId || (data.original && data.original.id !== entryId)) throw new Error('Invalid sleep snapshot');
    return data;
  };
  return signal ? read(signal) : boundedRead(`sleep-sync:${userId}:${babyId}:${entryId ?? '-'}`, read);
}
/** No unsafe fallback and no new operation ID on transport failure. */
export async function commitSleepStop(payload: FrozenSleepStop): Promise<SleepStopResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10000);
  let response;
  try { response = await supabase.rpc('sleep_sync_stop', payload).abortSignal(abort.signal); } finally { clearTimeout(timer); }
  const { data, error } = response;
  if (error) throw error;
  if (!data || !['applied','already_applied','conflict','forbidden','not_available','invalid'].includes(data.status)) throw new Error('Unknown stop confirmation');
  if (data.status === 'applied' || data.status === 'already_applied') {
    if (data.operationId !== payload.p_operation_id || !['stopped','discarded'].includes(data.outcome)) throw new Error('Invalid stop receipt');
  }
  if (data.status === 'conflict' && (!validSleepScopeSnapshot(data.currentSnapshot) || data.currentSnapshot.babyId !== payload.p_baby_id
    || data.currentSnapshot.original && data.currentSnapshot.original.id !== payload.p_entry_id)) throw new Error('Invalid conflict snapshot');
  return data;
}
