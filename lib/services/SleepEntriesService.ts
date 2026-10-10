import { randomUUID } from 'expo-crypto';
import { SLEEP_OFFLINE_ENABLED, readSleepCapability, readSleepSyncSnapshot, type SleepScopeSnapshot, validSleepScopeSnapshot } from '@/lib/sleepSyncContract';
import { BaseDataService, DualWriteResult, ReadResult } from './BaseDataService';
import { supabase } from '@/lib/supabase';
import { emitLottiMoment } from '@/lib/lottiMomentEvents';
import { localHealthAllowed } from '@/lib/localHealthStorage';
import { findLocalTrackingRow, queueTrackingCreate, queueTrackingUpdate, trackingScope } from '@/lib/trackingOutbox';
import { writeSnapshot } from '@/lib/localReadSnapshots';
import {
  getAutoCloseEndTimeISO,
  isStaleActiveSleepEntry,
  MAX_ACTIVE_SLEEP_DURATION_MINUTES,
} from '@/lib/sleepEntryGuards';

/**
 * SleepEntriesService
 *
 * Manages sleep entry data with Supabase.
 * Extends BaseDataService to provide sleep-specific operations.
 */

export interface SleepEntry {
  id: string;
  local_pending?: boolean;
  sync_revision?: string;
  sync_scope_revision?: string;
  user_id: string;
  baby_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  quality: string | null;
  shared_with_user_id: string | null;
  partner_id: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSleepEntryInput {
  user_id: string;
  local_period?: 'day' | 'night';
  baby_id?: string | null;
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  quality?: string | null;
  shared_with_user_id?: string | null;
  partner_id?: string | null;
  updated_by?: string | null;
}

export interface UpdateSleepEntryInput {
  start_time?: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  quality?: string | null;
  updated_by?: string | null;
  shared_with_user_id?: string | null;
  partner_id?: string | null;
}

export class SleepEntriesService extends BaseDataService {
  private snapshots = new Map<string, SleepScopeSnapshot>();
  private lastBabyId?: string;

  constructor(userId: string) {
    super(userId);
  }

  private async autoCloseStaleActiveEntries(entries: SleepEntry[]): Promise<SleepEntry[]> {
    const nowMs = Date.now();
    const nextEntries = [...entries];

    for (let index = 0; index < nextEntries.length; index += 1) {
      const entry = nextEntries[index];
      if (!entry.id || !isStaleActiveSleepEntry(entry, nowMs)) continue;

      const autoCloseEnd = getAutoCloseEndTimeISO(entry);
      if (!autoCloseEnd) continue;

      const updateResult = await this.updateEntry(entry.id, {
        end_time: autoCloseEnd,
        duration_minutes: MAX_ACTIVE_SLEEP_DURATION_MINUTES,
      });

      if (updateResult.primary.error || !updateResult.primary.data) {
        console.warn(
          `[SleepEntriesService] Failed to auto-close stale active sleep entry ${entry.id}:`,
          updateResult.primary.error
        );
        continue;
      }

      nextEntries[index] = updateResult.primary.data;
      console.warn(
        `[SleepEntriesService] Auto-closed stale active sleep entry ${entry.id} after ${MAX_ACTIVE_SLEEP_DURATION_MINUTES} minutes.`
      );
    }

    return nextEntries;
  }

  /**
   * Get all visible sleep entries for a user (including partner/shared entries)
   */
  async getEntries(babyId?: string): Promise<ReadResult<SleepEntry[]>> {
    this.lastBabyId = babyId;
    if (SLEEP_OFFLINE_ENABLED) {
      if (!babyId || !await readSleepCapability(this.userId)) return { data: null, error: new Error('sleep_version_required'), source: 'supabase' };
      const snapshot = await readSleepSyncSnapshot(this.userId, babyId, null);
      if (snapshot.status !== 'available') return { data: null, error: new Error(snapshot.status), source: 'supabase' };
      this.snapshots.set(babyId, snapshot);
      return { data: snapshot.entries.map(e => ({ ...e, sync_scope_revision: snapshot.scopeRevision })) as SleepEntry[], error: null, source: 'supabase' };
    }
    const supabaseOperation = async () => {
      let query = supabase
        .from('sleep_entries')
        .select('*')
        .or(
          `user_id.eq.${this.userId},partner_id.eq.${this.userId},shared_with_user_id.eq.${this.userId}`
        );

      if (babyId) {
        query = query.eq('baby_id', babyId);
      }

      const { data, error } = await query.order('start_time', { ascending: false });

      return { data: data as SleepEntry[] | null, error };
    };

    const readResult = await this.readFromSupabase(supabaseOperation);

    if (!readResult.data) {
      return readResult;
    }

    if (babyId) await writeSnapshot(trackingScope(this.userId, babyId), 'tracking-sleep', readResult.data).catch(() => {});
    const sanitizedEntries = await this.autoCloseStaleActiveEntries(readResult.data);
    return {
      ...readResult,
      data: sanitizedEntries,
    };
  }

  /**
   * Create a new sleep entry (Supabase)
   */
  async createEntry(input: CreateSleepEntryInput): Promise<DualWriteResult<SleepEntry>> {
    if (SLEEP_OFFLINE_ENABLED) {
      if (!input.baby_id || !await readSleepCapability(this.userId)) return this.writeRejected('sleep_version_required');
      return this.versionedWrite(input.baby_id, [{ action: 'create', fields: { start_time: input.start_time, end_time: input.end_time ?? null, quality: input.quality ?? null, notes: input.notes ?? null } }]);
    }
    if (input.baby_id && localHealthAllowed(this.userId)) {
      try {
        const data = await queueTrackingCreate('sleep', trackingScope(this.userId, input.baby_id), { ...input, end_time: input.end_time ?? null });
        emitLottiMoment('sleep');
        return { primary: { data: data as unknown as SleepEntry, error: null }, secondary: { data: null, error: null }, success: true };
      } catch (error) { return { primary: { data: null, error }, secondary: { data: null, error: null }, success: false }; }
    }
    // Supabase operation
    const { data, error } = await supabase
      .from('sleep_entries')
      .insert({
        user_id: input.user_id,
        baby_id: input.baby_id ?? null,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        duration_minutes: input.duration_minutes ?? null,
        notes: input.notes ?? null,
        quality: input.quality ?? null,
        shared_with_user_id: input.shared_with_user_id ?? null,
        partner_id: input.partner_id ?? null,
        updated_by: input.updated_by ?? null,
      })
      .select()
      .single();

    if (!error) {
      emitLottiMoment('sleep');
    }

    return {
      primary: { data: data as SleepEntry | null, error },
      secondary: { data: null, error: null },
      success: !error,
    };
  }

  /**
   * Update an existing sleep entry (Supabase)
   */
  async updateEntry(
    entryId: string,
    updates: UpdateSleepEntryInput,
    expected?: Pick<SleepEntry, 'sync_revision' | 'sync_scope_revision'>
  ): Promise<DualWriteResult<SleepEntry>> {
    if (SLEEP_OFFLINE_ENABLED) {
      if (!await readSleepCapability(this.userId)) return this.writeRejected('sleep_version_required');
      const scope = [...this.snapshots.values()].find(s => s.entries.some(e => e.id === entryId));
      const entry = scope?.entries.find(e => e.id === entryId);
      if (!scope || !entry || !expected?.sync_revision || !expected.sync_scope_revision) return this.writeRejected('sleep_version_required');
      const fields = Object.fromEntries(Object.entries(updates).filter(([key,value]) => value !== undefined && ['start_time','end_time','notes','quality'].includes(key)));
      return this.versionedWrite(scope.babyId, [{ action: 'update', id: entryId, revision: expected.sync_revision, fields }], expected.sync_scope_revision);
    }
    if (localHealthAllowed(this.userId)) {
      try {
        // A local create carries the child; confirmed rows come from the displayed scope cache.
        const base = await findLocalTrackingRow('sleep', this.userId, entryId, this.lastBabyId);
        if (base) {
          const data = await queueTrackingUpdate('sleep', trackingScope(this.userId, base.baby_id), entryId, updates, base);
          return { primary: { data: data as unknown as SleepEntry, error: null }, secondary: { data: null, error: null }, success: true };
        }
      } catch (error) { return this.writeRejected((error as Error).message); }
    }
    // Supabase operation
    const { data, error } = await supabase
      .from('sleep_entries')
      .update({
        start_time: updates.start_time,
        end_time: updates.end_time,
        duration_minutes: updates.duration_minutes,
        notes: updates.notes,
        quality: updates.quality,
        updated_by: updates.updated_by,
        shared_with_user_id: updates.shared_with_user_id,
        partner_id: updates.partner_id,
      })
      .eq('id', entryId)
      .select()
      .single();

    return {
      primary: { data: data as SleepEntry | null, error },
      secondary: { data: null, error: null },
      success: !error,
    };
  }

  /**
   * Delete a sleep entry (Supabase)
   */
  async deleteEntry(entryId: string, expected?: Pick<SleepEntry, 'sync_revision' | 'sync_scope_revision'>): Promise<DualWriteResult<boolean>> {
    if (SLEEP_OFFLINE_ENABLED) {
      if (!await readSleepCapability(this.userId)) return { primary: { data: false, error: new Error('sleep_version_required') }, secondary: { data: null, error: null }, success: false };
      const scope = [...this.snapshots.values()].find(s => s.entries.some(e => e.id === entryId));
      const entry = scope?.entries.find(e => e.id === entryId);
      if (!scope || !entry || !expected?.sync_revision || !expected.sync_scope_revision) return { primary: { data: false, error: new Error('sleep_version_required') }, secondary: { data: null, error: null }, success: false };
      const result = await this.versionedWrite(scope.babyId, [{ action: 'delete', id: entryId, revision: expected.sync_revision, fields: {} }], expected.sync_scope_revision);
      return { primary: { data: result.success, error: result.primary.error }, secondary: { data: null, error: null }, success: result.success };
    }
    if (localHealthAllowed(this.userId)) {
      try {
        const base = await findLocalTrackingRow('sleep', this.userId, entryId, this.lastBabyId);
        if (base) { await queueTrackingUpdate('sleep', trackingScope(this.userId, base.baby_id), entryId, {}, base, true);
          return { primary: { data: true, error: null }, secondary: { data: null, error: null }, success: true }; }
      } catch (error) { return { primary: { data: false, error }, secondary: { data: null, error: null }, success: false }; }
    }
    // Supabase operation
    const { error } = await supabase.from('sleep_entries').delete().eq('id', entryId);

    return {
      primary: { data: !error, error },
      secondary: { data: null, error: null },
      success: !error,
    };
  }
  private writeRejected(message: string): DualWriteResult<SleepEntry> {
    return { primary: { data: null, error: new Error(message) }, secondary: { data: null, error: null }, success: false };
  }
  /** One server transaction for structural edits. The versions come from displayed rows. */
  async versionedBatch(babyId: string, expectedScope: string, changes: any[]): Promise<{ data: SleepEntry[] | null; error: Error | null }> {
    if (!SLEEP_OFFLINE_ENABLED || !expectedScope || !await readSleepCapability(this.userId)) return { data: null, error: new Error('sleep_version_required') };
    const operationId = randomUUID();
    const { data, error } = await supabase.rpc('sleep_sync_mutate', { p_expected_actor: this.userId, p_operation_id: operationId, p_baby_id: babyId, p_expected_scope_revision: expectedScope, p_changes: changes });
    if (error || !['applied','already_applied'].includes(data?.status) || data.operationId !== operationId || !validSleepScopeSnapshot(data.currentSnapshot)) {
      return { data: null, error: new Error(error?.message ?? data?.status ?? 'sleep_write_unknown') };
    }
    const snapshot = data.currentSnapshot as SleepScopeSnapshot;
    this.snapshots.set(babyId, snapshot);
    const ids: string[] = data.entryIds ?? changes.flatMap(change => change.id && change.action !== 'delete' ? [change.id] : []);
    return { data: ids.flatMap(id => { const entry = snapshot.entries.find(e => e.id === id); return entry ? [{ ...entry, sync_scope_revision: snapshot.scopeRevision } as SleepEntry] : []; }), error: null };
  }
  private async versionedWrite(babyId: string, changes: any[], expectedScope?: string): Promise<DualWriteResult<SleepEntry>> {
    const base = this.snapshots.get(babyId); if (!base && !expectedScope) return this.writeRejected('sleep_version_required');
    const result = await this.versionedBatch(babyId, expectedScope ?? base!.scopeRevision, changes);
    return { primary: { data: result.data?.[0] ?? null, error: result.error }, secondary: { data: null, error: null }, success: !result.error };
  }

}
