import { randomUUID } from 'expo-crypto';
import { localHealthAllowed, localHealthGeneration, clearLocalHealthData } from './localHealthStorage';
import { commitSleepStop, readSleepCapability, readSleepSyncSnapshot, validSleepScopeSnapshot, type SleepScopeSnapshot, type FrozenSleepStop } from './sleepSyncContract';
import { classifySleepStop } from './sleepConflictResolution';
import { listPendingSleepStops, persistSleepStop, rememberActiveSleep, recordSleepAccessNotice, type PendingSleepStop } from './sleepOfflineActions';
import { transientReadError } from './boundedRead';
import { supabase } from './supabase';
import { invalidateReadSnapshots } from './localReadSnapshots';
const runners = new Map<string, Promise<void>>();
export function runSleepRecovery(userId: string): Promise<void> {
  const existing = runners.get(userId); if (existing) return existing;
  const task = recover(userId).finally(() => { if (runners.get(userId) === task) runners.delete(userId); });
  runners.set(userId, task); return task;
}
async function recover(userId: string) {
  const generation = localHealthGeneration();
  if (!localHealthAllowed(userId, generation)) return;
  const actions = await listPendingSleepStops(userId);
  if (!actions.some(a => !['confirmed','discarded','needs_decision','blocked'].includes(a.state)) || !await readSleepCapability(userId)) return;
  for (const action of actions) {
    if (!localHealthAllowed(userId, generation)) return;
    if (['confirmed','discarded','needs_decision','blocked'].includes(action.state)) continue;
    try { await reconcile(action, generation); } catch { /* Durable state and manual retry remain visible. */ }
  }
}
async function update(action: PendingSleepStop, patch: Partial<PendingSleepStop>, generation: number) {
  return persistSleepStop({ ...action, ...patch, localRevision: action.localRevision + 1 }, action.localRevision, generation);
}
async function reconcile(initial: PendingSleepStop, generation: number) {
  let action = initial;
  if (!action.frozen) {
    action = await update(action, { state: 'checking' }, generation);
    let current;
    try { current = await readSleepSyncSnapshot(action.scope.userId, action.scope.babyId!, action.originalEntryId); }
    catch { await update(action, { state: 'pending' }, generation); return; }
    if (current.status === 'forbidden') { await clearLocalHealthData(action.scope.userId, action.scope.babyId!); await recordSleepAccessNotice(action.scope.userId); return; }
    if (current.status !== 'available') { await update(action, { state: 'blocked' }, generation); return; }
    const kind = classifySleepStop(action.baseEntry.entry, action.baseEntry.scopeRevision, action.chosenStopAt, action.proposedQuality, action.proposedNotes, current);
    if (kind === 'agreed') { await rememberActiveSleep(action.scope, current); await update(action, { state: 'confirmed', current, outcome: 'agreed' }, generation); return; }
    if (kind !== 'unchanged' || action.reconcilePolicy === 'ask_always') {
      await update(action, { state: 'needs_decision', current, outcome: kind }, generation); return;
    }
    action = await freeze(action, current, generation);
  }
  await dispatch(action, generation);
}
async function freeze(action: PendingSleepStop, current: SleepScopeSnapshot, generation: number, fields?: { takeQuality: boolean; takeNotes: boolean }) {
  if (!current.original || !current.canWrite) return update(action, { state: 'blocked', current }, generation);
  const payload: FrozenSleepStop = {
    p_expected_actor: action.scope.userId, p_operation_id: action.operationId, p_baby_id: action.scope.babyId!, p_entry_id: action.originalEntryId,
    p_expected_entry_revision: current.original.sync_revision, p_expected_scope_revision: current.scopeRevision,
    p_stop_at: action.chosenStopAt, p_quality: action.proposedQuality, p_notes: action.proposedNotes,
    p_change_quality: fields ? fields.takeQuality : action.proposedQuality !== action.baseEntry.entry.quality,
    p_change_notes: fields ? fields.takeNotes : action.proposedNotes !== action.baseEntry.entry.notes,
  };
  return update(action, { frozen: payload, state: 'sending', current }, generation);
}
async function dispatch(initial: PendingSleepStop, generation: number) {
  let action = initial;
  if (!action.frozen) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!localHealthAllowed(action.scope.userId, generation)) return;
    try {
      const result = await commitSleepStop(action.frozen!);
      if (!localHealthAllowed(action.scope.userId, generation)) return;
      if (result.status === 'conflict') {
        await update(action, { state: 'needs_decision', current: result.currentSnapshot, frozen: undefined, outcome: 'changed' }, generation); return;
      }
      if (result.status === 'applied' || result.status === 'already_applied') {
        // Receipt proves execution, then read NOW; never overlay its old result.
        let current: SleepScopeSnapshot | undefined;
        try {
          const snapshot = await readSleepSyncSnapshot(action.scope.userId, action.scope.babyId!, action.originalEntryId);
          if (snapshot.status === 'forbidden') { await clearLocalHealthData(action.scope.userId, action.scope.babyId!); await recordSleepAccessNotice(action.scope.userId); return; }
          if (snapshot.status === 'available') current = snapshot;
        } catch { /* Confirmation remains true even if the follow-up read fails. */ }
        if (current) await rememberActiveSleep(action.scope, current);
        else await invalidateReadSnapshots(action.scope.userId, action.scope.babyId!, ['sleep-active']);
        await update(action, { state: 'confirmed', current, outcome: result.outcome }, generation); return;
      }
      let current: SleepScopeSnapshot | undefined;
      try { const fresh = await readSleepSyncSnapshot(action.scope.userId,action.scope.babyId!,action.originalEntryId);
        if (fresh.status === 'forbidden') { await clearLocalHealthData(action.scope.userId,action.scope.babyId!); await recordSleepAccessNotice(action.scope.userId); return; }
        if (fresh.status === 'available') current = fresh;
      } catch {}
      await update(action, { state: current ? 'needs_decision' : 'blocked', current, outcome: result.status, frozen: undefined }, generation); return;
    } catch (error) {
      action = await update(action, { state: 'confirmation_unknown' }, generation);
      if (attempt === 2 || !transientReadError(error)) return;
      await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 500 : 1500));
    }
  }
}
/** Every decision uses the displayed version; a changed version reopens it. */
export async function decideSleepStop(action: PendingSleepStop, decision: 'own' | 'shared' | 'later', fields?: { takeQuality: boolean; takeNotes: boolean }) {
  if (decision === 'later') return true;
  await runners.get(action.scope.userId);
  const generation = localHealthGeneration();
  if (!localHealthAllowed(action.scope.userId, generation) || action.frozen || !action.current) return false;
  const latest = (await listPendingSleepStops(action.scope.userId)).find(v => v.originalEntryId === action.originalEntryId);
  if (!latest || latest.localRevision !== action.localRevision) return false;
  if (decision === 'shared') {
    const { data, error } = await supabase.rpc('sleep_sync_keep', { p_expected_actor:action.scope.userId, p_baby_id: action.scope.babyId, p_entry_id: action.originalEntryId, p_expected_scope_revision: action.current.scopeRevision });
    if (error) throw error;
    if (data?.status === 'accepted') {
      if (!validSleepScopeSnapshot(data.currentSnapshot) || data.currentSnapshot.babyId !== action.scope.babyId
        || data.currentSnapshot.original && data.currentSnapshot.original.id !== action.originalEntryId) throw new Error('Invalid shared confirmation');
      if (!localHealthAllowed(action.scope.userId,generation)) return false;
      await rememberActiveSleep(action.scope,data.currentSnapshot); await update(action, { state: 'discarded', current: data.currentSnapshot, outcome: 'shared' }, generation); return true;
    }
    const fresh = await readSleepSyncSnapshot(action.scope.userId, action.scope.babyId!, action.originalEntryId);
    if (fresh.status === 'available') await update(action, { state: 'needs_decision', current: fresh }, generation);
    else if (fresh.status === 'forbidden') { await clearLocalHealthData(action.scope.userId,action.scope.babyId!); await recordSleepAccessNotice(action.scope.userId); return true; }
    else await update(action,{state:'blocked',current:undefined},generation);
    return false;
  }
  const target = action.current.original;
  if (!target || !action.current.canWrite || Date.parse(action.chosenStopAt) < Date.parse(target.start_time)
    || Date.parse(action.chosenStopAt) - Date.parse(target.start_time) > 86400000) return false;
  // An explicit new decision after a definitive conflict may bind a new request.
  const next = await update(action, { operationId: randomUUID() }, generation);
  await dispatch(await freeze(next, action.current, generation, fields ?? { takeQuality: target.quality === action.baseEntry.entry.quality && action.proposedQuality !== target.quality, takeNotes: target.notes === action.baseEntry.entry.notes && action.proposedNotes !== target.notes }), generation);
  const result = (await listPendingSleepStops(action.scope.userId)).find(v => v.originalEntryId === action.originalEntryId);
  return !!result && ['confirmed','discarded'].includes(result.state);
}
export async function editPendingSleepStop(action: PendingSleepStop, patch: { chosenStopAt?: string; reconcilePolicy?: PendingSleepStop['reconcilePolicy']; discard?: boolean }) {
  if (action.frozen || ['sending','confirmation_unknown','checking','confirmed','discarded'].includes(action.state)) return;
  const at = patch.chosenStopAt;
  if (at && (!Number.isFinite(Date.parse(at)) || Date.parse(at) < Date.parse(action.baseEntry.entry.start_time))) throw new Error('Invalid stop time');
  return update(action, { chosenStopAt: at ?? action.chosenStopAt, reconcilePolicy: patch.reconcilePolicy ?? action.reconcilePolicy,
    state: patch.discard ? 'discarded' : 'pending', current: undefined }, localHealthGeneration());
}
