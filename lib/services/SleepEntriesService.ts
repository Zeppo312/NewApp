import { BaseDataService, DualWriteResult, ReadResult } from './BaseDataService';
import { supabase } from '@/lib/supabase';
import type { ConvexReactClient } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { BackendType } from '@/contexts/BackendContext';
import {
  getAutoCloseEndTimeISO,
  isStaleActiveSleepEntry,
  MAX_ACTIVE_SLEEP_DURATION_MINUTES,
} from '@/lib/sleepEntryGuards';

/**
 * SleepEntriesService
 *
 * Manages sleep entry data with dual-backend support (Supabase + Convex).
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
  constructor(
    activeBackend: BackendType,
    convexClient: ConvexReactClient | null,
    userId: string
  ) {
    super(activeBackend, convexClient, userId);
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

    const convexOperation = async () => {
      if (!this.convexClient) {
        return { data: null, error: new Error('Convex client not available') };
      }

      try {
        const data = await this.convexClient.query(api.sleepEntries.listVisibleEntries, {
          userId: this.userId,
          babyId: babyId,
        });

        // Map Convex data to SleepEntry format
        const mappedData: SleepEntry[] = (data || []).map((entry: any) => ({
          id: entry._id,
          user_id: entry.user_id,
          baby_id: entry.baby_id || null,
          start_time: entry.start_time,
          end_time: entry.end_time || null,
          duration_minutes: entry.duration_minutes || null,
          notes: entry.notes || null,
          quality: entry.quality || null,
          shared_with_user_id: entry.shared_with_user_id || null,
          partner_id: entry.partner_id || null,
          updated_by: entry.updated_by || null,
          created_at: entry.created_at,
          updated_at: entry.updated_at,
        }));

        return { data: mappedData, error: null };
      } catch (error) {
        return { data: null, error };
      }
    };

    const readResult = await this.readFromActive(
      this.activeBackend,
      supabaseOperation,
      convexOperation
    );

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
   * Create a new sleep entry (uses only the active backend)
   */
  async createEntry(input: CreateSleepEntryInput): Promise<DualWriteResult<SleepEntry>> {
    if (this.activeBackend === 'supabase') {
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

      return {
        primary: { data: data as SleepEntry | null, error },
        secondary: { data: null, error: null },
        success: !error,
      };
    } else {
      // Convex operation
      if (!this.convexClient) {
        const error = new Error('Convex client not available');
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }

      try {
        const now = new Date().toISOString();
        const convexData = await this.convexClient.mutation(api.sleepEntries.createSleepEntry, {
          userId: input.user_id,
          babyId: input.baby_id ?? undefined,
          startTime: input.start_time,
          endTime: input.end_time ?? undefined,
          durationMinutes: input.duration_minutes ?? undefined,
          notes: input.notes ?? undefined,
          quality: input.quality ?? undefined,
          sharedWithUserId: input.shared_with_user_id ?? undefined,
          partnerId: input.partner_id ?? undefined,
          updatedBy: input.updated_by ?? undefined,
          createdAt: now,
          updatedAt: now,
        });

        // Map Convex response to SleepEntry
        const mappedData: SleepEntry = {
          id: convexData._id,
          user_id: convexData.user_id,
          baby_id: convexData.baby_id || null,
          start_time: convexData.start_time,
          end_time: convexData.end_time || null,
          duration_minutes: convexData.duration_minutes || null,
          notes: convexData.notes || null,
          quality: convexData.quality || null,
          shared_with_user_id: convexData.shared_with_user_id || null,
          partner_id: convexData.partner_id || null,
          updated_by: convexData.updated_by || null,
          created_at: convexData.created_at,
          updated_at: convexData.updated_at,
        };

        return {
          primary: { data: mappedData, error: null },
          secondary: { data: null, error: null },
          success: true,
        };
      } catch (error) {
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }
    }
  }

  /**
   * Update an existing sleep entry (uses only the active backend)
   */
  async updateEntry(
    entryId: string,
    updates: UpdateSleepEntryInput
  ): Promise<DualWriteResult<SleepEntry>> {
    if (this.activeBackend === 'supabase') {
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
    } else {
      // Convex operation
      if (!this.convexClient) {
        const error = new Error('Convex client not available');
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }

      try {
        const now = new Date().toISOString();
        const convexData = await this.convexClient.mutation(api.sleepEntries.updateSleepEntry, {
          entryId: entryId,
          startTime: updates.start_time,
          endTime: updates.end_time ?? undefined,
          durationMinutes: updates.duration_minutes ?? undefined,
          notes: updates.notes ?? undefined,
          quality: updates.quality ?? undefined,
          sharedWithUserId: updates.shared_with_user_id ?? undefined,
          partnerId: updates.partner_id ?? undefined,
          updatedBy: updates.updated_by ?? undefined,
          updatedAt: now,
        });

        if (!convexData) {
          return {
            primary: { data: null, error: new Error('Entry not found') },
            secondary: { data: null, error: null },
            success: false,
          };
        }

        // Map Convex response to SleepEntry
        const mappedData: SleepEntry = {
          id: convexData._id,
          user_id: convexData.user_id,
          baby_id: convexData.baby_id || null,
          start_time: convexData.start_time,
          end_time: convexData.end_time || null,
          duration_minutes: convexData.duration_minutes || null,
          notes: convexData.notes || null,
          quality: convexData.quality || null,
          shared_with_user_id: convexData.shared_with_user_id || null,
          partner_id: convexData.partner_id || null,
          updated_by: convexData.updated_by || null,
          created_at: convexData.created_at,
          updated_at: convexData.updated_at,
        };

        return {
          primary: { data: mappedData, error: null },
          secondary: { data: null, error: null },
          success: true,
        };
      } catch (error) {
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }
    }
  }

  /**
   * Delete a sleep entry (uses only the active backend)
   */
  async deleteEntry(entryId: string): Promise<DualWriteResult<boolean>> {
    if (this.activeBackend === 'supabase') {
      // Supabase operation
      const { error } = await supabase.from('sleep_entries').delete().eq('id', entryId);

      return {
        primary: { data: !error, error },
        secondary: { data: null, error: null },
        success: !error,
      };
    } else {
      // Convex operation
      if (!this.convexClient) {
        const error = new Error('Convex client not available');
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }

      try {
        const result = await this.convexClient.mutation(api.sleepEntries.deleteSleepEntry, {
          entryId: entryId,
        });

        return {
          primary: { data: result.success, error: null },
          secondary: { data: null, error: null },
          success: result.success,
        };
      } catch (error) {
        return {
          primary: { data: null, error },
          secondary: { data: null, error: null },
          success: false,
        };
      }
    }
  }
}
