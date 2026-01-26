import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Convex Functions for Babies
 *
 * Handles baby data synchronization between Supabase and Convex
 */

// Query to get all babies for a user
export const getUserBabies = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const ownedBabies = await ctx.db
      .query("babies")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .collect();

    const memberships = await ctx.db
      .query("baby_members")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .collect();

    const memberBabyIds = Array.from(
      new Set(memberships.map((member) => member.baby_id))
    );

    // For legacy support: try Supabase IDs first
    const memberBabiesLegacy = await Promise.all(
      memberBabyIds.map((babyId) =>
        ctx.db
          .query("babies")
          .withIndex("by_supabase_id", (q) =>
            q.eq("supabase_baby_id", babyId)
          )
          .first()
      )
    );

    // Filter out nulls and combine
    const combined = [...ownedBabies, ...memberBabiesLegacy.filter(Boolean)];

    // Deduplicate by Convex _id
    const seen = new Set<string>();
    return combined.filter((baby) => {
      if (!baby || seen.has(baby._id)) {
        return false;
      }
      seen.add(baby._id);
      return true;
    });
  },
});

// Query to get a specific baby by Supabase ID (deprecated)
export const getBabyBySupabaseId = query({
  args: {
    supabaseBabyId: v.string(),
  },
  handler: async (ctx, args) => {
    const baby = await ctx.db
      .query("babies")
      .withIndex("by_supabase_id", (q) =>
        q.eq("supabase_baby_id", args.supabaseBabyId)
      )
      .first();

    return baby;
  },
});

// Query to get a specific baby by Convex ID
export const getBabyById = query({
  args: {
    babyId: v.id("babies"),
  },
  handler: async (ctx, args) => {
    const baby = await ctx.db.get(args.babyId);
    return baby;
  },
});

// Mutation to sync/create a baby
export const syncBaby = mutation({
  args: {
    supabaseBabyId: v.string(),
    userId: v.string(),
    name: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    babyGender: v.optional(v.string()),
    weight: v.optional(v.string()),
    height: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if baby already exists by Supabase ID
    const existingBaby = await ctx.db
      .query("babies")
      .withIndex("by_supabase_id", (q) =>
        q.eq("supabase_baby_id", args.supabaseBabyId)
      )
      .first();

    const now = new Date().toISOString();
    const updatedAt = args.updatedAt ?? now;
    const createdAt = args.createdAt ?? now;

    if (existingBaby) {
      // Update existing baby
      await ctx.db.patch(existingBaby._id, {
        user_id: args.userId,
        name: args.name,
        birth_date: args.birthDate,
        baby_gender: args.babyGender,
        weight: args.weight,
        height: args.height,
        photo_url: args.photoUrl,
        updated_at: updatedAt,
      });

      const updated = await ctx.db.get(existingBaby._id);
      return updated;
    }

    // Create new baby
    const babyId = await ctx.db.insert("babies", {
      supabase_baby_id: args.supabaseBabyId,
      user_id: args.userId,
      name: args.name,
      birth_date: args.birthDate,
      baby_gender: args.babyGender,
      weight: args.weight,
      height: args.height,
      photo_url: args.photoUrl,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    const newBaby = await ctx.db.get(babyId);
    return newBaby;
  },
});

// Mutation to sync/create a baby member record
export const syncBabyMember = mutation({
  args: {
    babyId: v.string(),
    userId: v.string(),
    role: v.optional(v.string()),
    createdAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingMember = await ctx.db
      .query("baby_members")
      .withIndex("by_baby_user", (q) =>
        q.eq("baby_id", args.babyId).eq("user_id", args.userId)
      )
      .first();

    const createdAt = args.createdAt ?? new Date().toISOString();

    if (existingMember) {
      await ctx.db.patch(existingMember._id, {
        role: args.role ?? existingMember.role,
      });
      return await ctx.db.get(existingMember._id);
    }

    const memberId = await ctx.db.insert("baby_members", {
      baby_id: args.babyId,
      user_id: args.userId,
      role: args.role ?? "parent",
      created_at: createdAt,
    });

    return await ctx.db.get(memberId);
  },
});

// Mutation to create a new baby (standalone)
export const createBaby = mutation({
  args: {
    userId: v.string(),
    name: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    weight: v.optional(v.string()),
    height: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    babyGender: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const createdAt = args.createdAt ?? now;
    const updatedAt = args.updatedAt ?? now;

    const babyId = await ctx.db.insert("babies", {
      user_id: args.userId,
      name: args.name,
      birth_date: args.birthDate,
      weight: args.weight,
      height: args.height,
      photo_url: args.photoUrl,
      baby_gender: args.babyGender,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    return await ctx.db.get(babyId);
  },
});

// Mutation to update a baby by Convex ID
export const updateBaby = mutation({
  args: {
    babyId: v.id("babies"),
    name: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    weight: v.optional(v.string()),
    height: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    babyGender: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const baby = await ctx.db.get(args.babyId);
    if (!baby) {
      return null;
    }

    const now = new Date().toISOString();
    const updatedAt = args.updatedAt ?? now;

    const updateData: any = { updated_at: updatedAt };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.birthDate !== undefined) updateData.birth_date = args.birthDate;
    if (args.weight !== undefined) updateData.weight = args.weight;
    if (args.height !== undefined) updateData.height = args.height;
    if (args.photoUrl !== undefined) updateData.photo_url = args.photoUrl;
    if (args.babyGender !== undefined) updateData.baby_gender = args.babyGender;

    await ctx.db.patch(args.babyId, updateData);
    return await ctx.db.get(args.babyId);
  },
});

// Mutation to delete a baby by Convex ID
export const deleteBaby = mutation({
  args: {
    babyId: v.id("babies"),
    // Deprecated: kept for backwards compatibility
    supabaseBabyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Try to use babyId first (new way)
    if (args.babyId) {
      const baby = await ctx.db.get(args.babyId);
      if (baby) {
        await ctx.db.delete(args.babyId);
        return { success: true };
      }
      return { success: false, message: "Baby not found" };
    }

    // Fallback to supabaseBabyId (old way)
    if (args.supabaseBabyId) {
      const baby = await ctx.db
        .query("babies")
        .withIndex("by_supabase_id", (q) =>
          q.eq("supabase_baby_id", args.supabaseBabyId)
        )
        .first();

      if (baby) {
        await ctx.db.delete(baby._id);
        return { success: true };
      }
    }

    return { success: false, message: "Baby not found" };
  },
});
