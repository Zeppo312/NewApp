import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Convex Auth Sync Functions
 *
 * These functions handle user synchronization between Supabase and Convex.
 * Auth remains in Supabase, but user records are synced to Convex for queries.
 */

// Query to get or verify a user exists in Convex
export const getUser = query({
  args: {
    supabaseUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_supabase_id", (q) =>
        q.eq("supabase_user_id", args.supabaseUserId)
      )
      .first();

    return user;
  },
});

// Mutation to sync/create a user from Supabase
export const verifyAndSyncUser = mutation({
  args: {
    supabaseUserId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_supabase_id", (q) =>
        q.eq("supabase_user_id", args.supabaseUserId)
      )
      .first();

    if (existingUser) {
      // User exists, update if needed
      if (args.email && existingUser.email !== args.email) {
        await ctx.db.patch(existingUser._id, {
          email: args.email,
          updated_at: new Date().toISOString(),
        });
      }
      return existingUser;
    }

    // Create new user
    const now = new Date().toISOString();
    const userId = await ctx.db.insert("users", {
      supabase_user_id: args.supabaseUserId,
      email: args.email,
      created_at: now,
      updated_at: now,
    });

    const newUser = await ctx.db.get(userId);
    return newUser;
  },
});
