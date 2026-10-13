import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { supabase } from './supabase';
import { backendHost, localScopeKey, readSnapshot, validRows, type LocalScope } from './localReadSnapshots';
import { localHealthAllowed, localHealthGeneration, notifyLocalHealth, serializeLocalHealth } from './localHealthStorage';

export type TrackingKind = 'care' | 'sleep' | 'vitamin';
export type TrackingRow = Record<string, any> & { id: string; baby_id: string };
export type TrackingOperation = {
  version: 1; operationId: string; scope: LocalScope; kind: TrackingKind;
  action: 'create' | 'update' | 'delete' | 'check'; entryId: string;
  fields: Record<string, any>; inventoryItemId?: string | null; dependsOn?: string;
  expectedUpdatedAt?: string; state: 'pending' | 'sending' | 'blocked' | 'confirmed';
  reason?: string; createdAt: string; row?: TrackingRow; baseRow?: TrackingRow; conflictRow?: TrackingRow; confirmedUpdatedAt?: string; confirmedAt?: string;
};
const keyFor = (userId: string) => `local_tracking_outbox_v1:${localScopeKey({ backendHost: backendHost(), userId })}`;
const runners = new Map<string, Promise<void>>();
const valid = (v: any): v is TrackingOperation => v?.version === 1 && typeof v.operationId === 'string'
  && typeof v.entryId === 'string' && v.scope?.backendHost === backendHost() && typeof v.scope?.userId === 'string'
  && typeof v.scope?.babyId === 'string' && ['care','sleep','vitamin'].includes(v.kind)
  && ['create','update','delete','check'].includes(v.action) && ['pending','sending','blocked','confirmed'].includes(v.state)
  && v.fields && typeof v.fields === 'object' && !Array.isArray(v.fields) && Number.isFinite(Date.parse(v.createdAt));

export async function readTrackingOutbox(userId: string): Promise<TrackingOperation[]> {
  const generation = localHealthGeneration();
  if (!localHealthAllowed(userId, generation)) return [];
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!localHealthAllowed(userId, generation) || !raw) return [];
  const rows: unknown = JSON.parse(raw);
  // Do not silently overwrite a damaged journal with an empty one.
  if (!Array.isArray(rows) || !rows.every(v => valid(v) && v.scope.userId === userId)) throw new Error('Unreadable tracking journal');
  return rows;
}
async function changeJournal<T>(userId: string, change: (rows: TrackingOperation[]) => T, generation = localHealthGeneration()): Promise<T> {
  return serializeLocalHealth(keyFor(userId), async () => {
    if (!localHealthAllowed(userId, generation)) throw new Error('Tracking scope changed');
    const rows = await readTrackingOutbox(userId);
    const result = change(rows);
    if (!localHealthAllowed(userId, generation)) throw new Error('Tracking scope changed');
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(rows));
    if (!localHealthAllowed(userId, generation)) throw new Error('Tracking scope changed');
    notifyLocalHealth(); return result;
  });
}
export function trackingScope(userId: string, babyId: string): LocalScope { return { backendHost: backendHost(), userId, babyId }; }
export async function queueTrackingCreate(kind: 'care' | 'sleep', scope: LocalScope, fields: Record<string, any>, inventoryItemId?: string | null): Promise<TrackingRow> {
  const id = randomUUID(); const now = new Date().toISOString();
  const row: TrackingRow = { ...fields, id, baby_id: scope.babyId!, user_id: scope.userId, created_at: now, updated_at: now, local_pending: true };
  await changeJournal(scope.userId, rows => {
    // Confirmed receipts can be dropped locally after a week. Unsent work never expires.
    const referenced = new Set(rows.filter(v => v.state !== 'confirmed').map(v => v.dependsOn));
    const keep = rows.filter(v => v.state !== 'confirmed' || referenced.has(v.operationId) || Date.now() - Date.parse(v.createdAt) < 7 * 86400000);
    if (keep.length >= 1000) throw new Error('Tracking journal full');
    rows.splice(0, rows.length, ...keep, { version: 1, operationId: randomUUID(), scope, kind, action: 'create', entryId: id,
      fields: { ...fields }, inventoryItemId, state: 'pending', createdAt: now, row });
  });
  void runTrackingSync(scope.userId).catch(() => {});
  return row;
}
export async function queueTrackingUpdate(kind: 'care' | 'sleep', scope: LocalScope, entryId: string, fields: Record<string, any>, base?: TrackingRow, remove = false): Promise<TrackingRow> {
  const result = await changeJournal(scope.userId, rows => {
    const previous = rows.filter(v => v.kind === kind && v.entryId === entryId && v.scope.babyId === scope.babyId).at(-1);
    if (rows.length >= 1000) throw new Error('Tracking journal full');
    // Unconfirmed changes stay ordered. A new edit of an already refreshed row
    // uses the version actually shown, rather than an old local receipt.
    const dependency = previous && (previous.state !== 'confirmed' || base?.local_pending || !base?.updated_at) ? previous : undefined;
    const rowBase = dependency?.row ?? base ?? previous?.row;
    if (!rowBase || rowBase.baby_id !== scope.babyId) throw new Error('Original tracking entry unavailable');
    const row = { ...rowBase, ...fields, local_pending: true } as TrackingRow;
    rows.push({ version: 1, operationId: randomUUID(), scope, kind, action: remove ? 'delete' : 'update', entryId,
      fields: { ...fields }, dependsOn: dependency?.operationId, expectedUpdatedAt: dependency ? undefined : rowBase.updated_at,
      state: 'pending', createdAt: new Date().toISOString(), row, baseRow: rowBase });
    return row;
  });
  void runTrackingSync(scope.userId).catch(() => {});
  return result;
}
export async function queueVitaminCheck(scope: LocalScope, day: string, completed: boolean) {
  await changeJournal(scope.userId, rows => {
    const previous = rows.filter(v => v.kind === 'vitamin' && v.scope.babyId === scope.babyId && v.entryId === day).at(-1);
    if (rows.length >= 1000) throw new Error('Tracking journal full');
    rows.push({ version: 1, operationId: randomUUID(), scope, kind: 'vitamin', action: 'check', entryId: day,
      fields: { day, completed, checked_at: new Date().toISOString() }, dependsOn: previous?.operationId,
      state: 'pending', createdAt: new Date().toISOString() });
  });
  void runTrackingSync(scope.userId).catch(() => {});
}
/** Pending work overlays confirmed reads; confirmations never replace a newer server row. */
export function overlayTrackingRows<T extends { id?: string }>(kind: 'care' | 'sleep', rows: T[], operations: TrackingOperation[], babyId?: string | null, cacheVerifiedAt?: string): T[] {
  const result = new Map<string | undefined, T>();
  for (const row of rows) {
    if ((row as any).local_pending) {
      const latest = operations.filter(v => v.kind === kind && v.entryId === row.id && v.scope.babyId === babyId).at(-1);
      if (!latest || latest.state === 'confirmed' && (latest.action === 'delete' || !latest.row)) continue;
      if (latest.state === 'confirmed' && latest.row) { result.set(row.id, latest.row as unknown as T); continue; }
    }
    result.set(row.id, row);
  }
  for (const op of operations) {
    if (op.kind !== kind || op.scope.babyId !== babyId) continue;
    if (op.state === 'confirmed') {
      // Receipts can update an older local cache, never an authoritative fresh read.
      if (cacheVerifiedAt === undefined || Date.parse(op.confirmedAt ?? '') <= (Date.parse(cacheVerifiedAt) || 0)) continue;
      const existing = result.get(op.entryId) as any;
      if (existing?.updated_at && op.row?.updated_at && Date.parse(existing.updated_at) > Date.parse(op.row.updated_at)) continue;
      if (op.action === 'delete' || !op.row) result.delete(op.entryId);
      else result.set(op.entryId, op.row as unknown as T);
      continue;
    }
    if (op.action === 'delete') result.delete(op.entryId);
    else if (op.row) result.set(op.entryId, { ...op.row, local_pending: true } as unknown as T);
  }
  return [...result.values()];
}
export function overlayVitaminChecks(checks: Record<string, true>, operations: TrackingOperation[], babyId: string) {
  const result = { ...checks };
  for (const op of operations) if (op.kind === 'vitamin' && op.scope.babyId === babyId && op.state !== 'confirmed') {
    if (op.fields.completed) result[op.entryId] = true; else delete result[op.entryId];
  }
  return result;
}
export async function findLocalTrackingRow(kind: 'care' | 'sleep', userId: string, entryId: string, babyId?: string): Promise<TrackingRow | undefined> {
  const latest = (await readTrackingOutbox(userId)).filter(v => v.kind === kind && v.entryId === entryId && (!babyId || v.scope.babyId === babyId)).at(-1);
  if (latest && (latest.state !== 'confirmed' || !latest.row)) return latest.row;
  if (!babyId) return latest?.row;
  const scope = trackingScope(userId, babyId);
  const saved = await readSnapshot(scope, `tracking-${kind}`, validRows);
  const active = kind === 'care' ? await readSnapshot(scope, 'tracking-care-active', validRows) : null;
  const candidates = [latest?.row, saved?.data.find(row => row.id === entryId), active?.data.find(row => row.id === entryId)].filter(Boolean) as TrackingRow[];
  return candidates.sort((a,b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0))[0];
}
export function runTrackingSync(userId: string): Promise<void> {
  const existing = runners.get(userId); if (existing) return existing;
  const run = sync(userId).finally(() => { if (runners.get(userId) === run) runners.delete(userId); });
  runners.set(userId, run); return run;
}
async function sync(userId: string) {
  const generation = localHealthGeneration();
  if (!localHealthAllowed(userId, generation)) return;
  for (const initial of await readTrackingOutbox(userId)) {
    if (!localHealthAllowed(userId, generation)) return;
    if (initial.state === 'confirmed' || initial.state === 'blocked') continue;
    const rows = await readTrackingOutbox(userId);
    const op = rows.find(v => v.operationId === initial.operationId);
    if (!op || op.state === 'confirmed' || op.state === 'blocked') continue;
    const dependency = op.dependsOn ? rows.find(v => v.operationId === op.dependsOn) : undefined;
    if (op.dependsOn && dependency?.state !== 'confirmed') continue;
    // Freeze the base before dispatch. A lost reply is retried with the same ID and payload.
    await changeJournal(userId, journal => {
      const current = journal.find(v => v.operationId === op.operationId)!;
      if (current.state === 'pending') current.expectedUpdatedAt ??= dependency?.confirmedUpdatedAt;
      current.state = 'sending'; Object.assign(op, current);
    }, generation);
    const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 8000);
    try {
      const { data, error } = await supabase.rpc('tracking_sync_operation', {
        p_expected_actor: userId, p_operation_id: op.operationId, p_baby_id: op.scope.babyId,
        p_kind: op.kind, p_action: op.action, p_entry_id: op.kind === 'vitamin' ? null : op.entryId,
        p_fields: op.fields, p_expected_updated_at: op.expectedUpdatedAt ?? null, p_inventory_item_id: op.inventoryItemId ?? null,
      }).abortSignal(abort.signal);
      if (!localHealthAllowed(userId, generation)) return;
      if (error) throw error;
      if (!data || data.operationId !== op.operationId || !['applied','already_applied','conflict','forbidden'].includes(data.status)) throw new Error('Invalid tracking receipt');
      if (data.row && (data.row.id !== op.entryId || data.row.baby_id !== op.scope.babyId)) throw new Error('Invalid tracking row');
      await changeJournal(userId, journal => {
        const current = journal.find(v => v.operationId === op.operationId)!;
        current.state = ['applied','already_applied'].includes(data.status) ? 'confirmed' : 'blocked';
        current.reason = data.reason ?? data.status;
        current.confirmedUpdatedAt = data.appliedUpdatedAt ?? undefined;
        if (current.state === 'confirmed') {
          const localPeriod = current.row?.local_period ?? current.fields.local_period;
          current.confirmedAt = new Date().toISOString(); current.row = data.row ? { ...data.row, ...(localPeriod ? {local_period:localPeriod} : {}) } : undefined;
        }
        else current.conflictRow = data.row ?? undefined;
      }, generation);
    } catch (error: any) {
      if (!localHealthAllowed(userId, generation)) return;
      const rejected = error?.name === 'DataConsentRequiredError' || error?.code === '42501' || /^(22|23)/.test(error?.code ?? '') || error?.code === '55000';
      await changeJournal(userId, journal => {
        const current = journal.find(v => v.operationId === op.operationId)!;
        current.state = rejected ? 'blocked' : 'sending';
        current.reason = rejected ? 'forbidden' : error?.code === 'PGRST202' ? 'server_upgrade_required' : 'connection';
      }, generation);
      // One failed transport is enough; the foreground/reconnect worker retries later.
      if (!rejected) return;
    } finally { clearTimeout(timeout); }
  }
}
export async function retryTrackingOperation(userId: string, operationId: string) {
  await runners.get(userId);
  await changeJournal(userId, rows => { const op = rows.find(v => v.operationId === operationId); if (op?.state === 'blocked') { op.state = 'pending'; op.reason = undefined; } });
  await runTrackingSync(userId);
}
export async function discardTrackingOperation(userId: string, operationId: string) {
  await runners.get(userId);
  await changeJournal(userId, rows => {
    const op = rows.find(v => v.operationId === operationId);
    if (!op || op.state === 'sending') throw new Error('Confirmation still pending');
    // Drop dependent local changes with the rejected root, never replay an orphan.
    const ids = new Set([operationId]);
    for (const row of rows) if (row.dependsOn && ids.has(row.dependsOn)) ids.add(row.operationId);
    rows.splice(0, rows.length, ...rows.filter(row => !ids.has(row.operationId)));
  });
}
/** An explicit choice binds the displayed competing version, never a silent fresh rebase. */
export async function acceptOwnTrackingChange(userId: string, operationId: string, displayedVersion?: string) {
  await runners.get(userId);
  await changeJournal(userId, rows => {
    const op = rows.find(v => v.operationId === operationId);
    if (!op || op.state !== 'blocked') throw new Error('Tracking decision changed');
    const latest = rows.filter(v => v.kind === op.kind && v.entryId === op.entryId && v.scope.babyId === op.scope.babyId).at(-1);
    if (op.action === 'create' && op.kind === 'sleep' && op.reason === 'active_sleep') {
      if (!latest?.row?.end_time || latest.action === 'delete') throw new Error('Stop the local sleep first');
      op.fields = { start_time: latest.row.start_time, end_time: latest.row.end_time, quality: latest.row.quality ?? null, notes: latest.row.notes ?? null, duration_minutes: latest.row.duration_minutes };
      op.row = latest.row;
      rows.splice(0,rows.length,...rows.filter(v => v === op || v.entryId !== op.entryId || v.kind !== op.kind));
    } else if (op.action === 'update' && op.conflictRow?.updated_at && op.conflictRow.updated_at === displayedVersion) {
      // A stop does not implicitly overwrite a note/rating changed by the partner.
      for (const field of ['notes','quality']) if (op.fields[field] === op.baseRow?.[field]) delete op.fields[field];
      op.expectedUpdatedAt = displayedVersion; op.dependsOn = undefined; op.baseRow = op.conflictRow;
    } else throw new Error('Tracking decision unavailable');
    const nextId = randomUUID();
    for (const row of rows) if (row.dependsOn === op.operationId) row.dependsOn = nextId;
    op.operationId = nextId; op.state = 'pending'; op.reason = undefined; op.conflictRow = undefined;
  });
  await runTrackingSync(userId);
}
