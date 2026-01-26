import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Convex Functions for Sleep Entries
 *
 * Handles sleep data synchronization between Supabase and Convex.
 */

// Query to get all visible sleep entries for a user (including partner/shared)
export const listVisibleEntries = query({
  args: {
    userId: v.string(),
    babyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownedEntries = await ctx.db
      .query("sleep_entries")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .collect();

    const partnerEntries = await ctx.db
      .query("sleep_entries")
      .withIndex("by_partner", (q) => q.eq("partner_id", args.userId))
      .collect();

    const sharedEntries = await ctx.db
      .query("sleep_entries")
      .withIndex("by_shared", (q) =>
        q.eq("shared_with_user_id", args.userId)
      )
      .collect();

    const combined = [...ownedEntries, ...partnerEntries, ...sharedEntries];

    // Deduplicate by _id (Convex ID)
    const deduped = new Map<string, (typeof combined)[number]>();
    for (const entry of combined) {
      deduped.set(entry._id, entry);
    }

    let results = Array.from(deduped.values());

    if (args.babyId) {
      results = results.filter((entry) => entry.baby_id === args.babyId);
    }

    results.sort((a, b) => {
      const aTime = new Date(a.start_time).getTime();
      const bTime = new Date(b.start_time).getTime();
      return bTime - aTime;
    });

    return results;
  },
});

// Mutation to sync/create a sleep entry
export const syncSleepEntry = mutation({
  args: {
    supabaseSleepId: v.string(),
    userId: v.string(),
    babyId: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
    quality: v.optional(v.string()),
    sharedWithUserId: v.optional(v.string()),
    partnerId: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
    // Deprecated but kept for backwards compatibility
    externalId: v.optional(v.string()),
    syncedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingEntry = await ctx.db
      .query("sleep_entries")
      .withIndex("by_supabase_id", (q) =>
        q.eq("supabase_sleep_id", args.supabaseSleepId)
      )
      .first();

    const now = new Date().toISOString();
    const updatedAt = args.updatedAt ?? now;
    const createdAt = args.createdAt ?? now;

    if (existingEntry) {
      await ctx.db.patch(existingEntry._id, {
        user_id: args.userId,
        baby_id: args.babyId,
        start_time: args.startTime,
        end_time: args.endTime,
        duration_minutes: args.durationMinutes,
        notes: args.notes,
        quality: args.quality,
        shared_with_user_id: args.sharedWithUserId,
        partner_id: args.partnerId,
        updated_by: args.updatedBy,
        updated_at: updatedAt,
      });

      return await ctx.db.get(existingEntry._id);
    }

    const entryId = await ctx.db.insert("sleep_entries", {
      supabase_sleep_id: args.supabaseSleepId,
      user_id: args.userId,
      baby_id: args.babyId,
      start_time: args.startTime,
      end_time: args.endTime,
      duration_minutes: args.durationMinutes,
      notes: args.notes,
      quality: args.quality,
      shared_with_user_id: args.sharedWithUserId,
      partner_id: args.partnerId,
      updated_by: args.updatedBy,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    return await ctx.db.get(entryId);
  },
});

// Mutation to create a new sleep entry (standalone)
export const createSleepEntry = mutation({
  args: {
    userId: v.string(),
    babyId: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
    quality: v.optional(v.string()),
    sharedWithUserId: v.optional(v.string()),
    partnerId: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const createdAt = args.createdAt ?? now;
    const updatedAt = args.updatedAt ?? now;

    const entryId = await ctx.db.insert("sleep_entries", {
      user_id: args.userId,
      baby_id: args.babyId,
      start_time: args.startTime,
      end_time: args.endTime,
      duration_minutes: args.durationMinutes,
      notes: args.notes,
      quality: args.quality,
      shared_with_user_id: args.sharedWithUserId,
      partner_id: args.partnerId,
      updated_by: args.updatedBy,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    return await ctx.db.get(entryId);
  },
});

// Mutation to update a sleep entry by Convex ID
export const updateSleepEntry = mutation({
  args: {
    entryId: v.id("sleep_entries"),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
    quality: v.optional(v.string()),
    sharedWithUserId: v.optional(v.string()),
    partnerId: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      return null;
    }

    const now = new Date().toISOString();
    const updatedAt = args.updatedAt ?? now;

    const updateData: any = { updated_at: updatedAt };

    if (args.startTime !== undefined) updateData.start_time = args.startTime;
    if (args.endTime !== undefined) updateData.end_time = args.endTime;
    if (args.durationMinutes !== undefined) updateData.duration_minutes = args.durationMinutes;
    if (args.notes !== undefined) updateData.notes = args.notes;
    if (args.quality !== undefined) updateData.quality = args.quality;
    if (args.sharedWithUserId !== undefined) updateData.shared_with_user_id = args.sharedWithUserId;
    if (args.partnerId !== undefined) updateData.partner_id = args.partnerId;
    if (args.updatedBy !== undefined) updateData.updated_by = args.updatedBy;

    await ctx.db.patch(args.entryId, updateData);
    return await ctx.db.get(args.entryId);
  },
});

// Mutation to delete a sleep entry by Convex ID
export const deleteSleepEntry = mutation({
  args: {
    entryId: v.id("sleep_entries"),
    // Deprecated: kept for backwards compatibility
    supabaseSleepId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Try to use entryId first (new way)
    if (args.entryId) {
      const entry = await ctx.db.get(args.entryId);
      if (entry) {
        await ctx.db.delete(args.entryId);
        return { success: true };
      }
      return { success: false, message: "Entry not found" };
    }

    // Fallback to supabaseSleepId (old way)
    if (args.supabaseSleepId) {
      const entry = await ctx.db
        .query("sleep_entries")
        .withIndex("by_supabase_id", (q) =>
          q.eq("supabase_sleep_id", args.supabaseSleepId)
        )
        .first();

      if (entry) {
        await ctx.db.delete(entry._id);
        return { success: true };
      }
    }

    return { success: false, message: "Entry not found" };
  },
});
