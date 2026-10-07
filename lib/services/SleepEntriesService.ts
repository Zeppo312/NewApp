import { BaseDataService, DualWriteResult, ReadResult } from './BaseDataService';
import { supabase } from '@/lib/supabase';
import { emitLottiMoment } from '@/lib/lottiMomentEvents';
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
    updates: UpdateSleepEntryInput
  ): Promise<DualWriteResult<SleepEntry>> {
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
  async deleteEntry(entryId: string): Promise<DualWriteResult<boolean>> {
    // Supabase operation
    const { error } = await supabase.from('sleep_entries').delete().eq('id', entryId);

    return {
      primary: { data: !error, error },
      secondary: { data: null, error: null },
      success: !error,
    };
  }
}
