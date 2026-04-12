import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Convex Functions for User Profiles
 *
 * Handles user profile data synchronization between Supabase and Convex
 */

// Query to get a user's profile
export const getProfile = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .first();

    return profile;
  },
});

// Mutation to sync/create a user profile
export const syncProfile = mutation({
  args: {
    userId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    userRole: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .first();

    const now = new Date().toISOString();
    const updatedAt = args.updatedAt ?? now;
    const createdAt = args.createdAt ?? now;

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        first_name: args.firstName,
        last_name: args.lastName,
        user_role: args.userRole,
        updated_at: updatedAt,
      });

      const updated = await ctx.db.get(existingProfile._id);
      return updated;
    }

    // Create new profile
    const profileId = await ctx.db.insert("profiles", {
      user_id: args.userId,
      first_name: args.firstName,
      last_name: args.lastName,
      user_role: args.userRole,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    const newProfile = await ctx.db.get(profileId);
    return newProfile;
  },
});
