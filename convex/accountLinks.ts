import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

/**
 * Convex Functions for Account Links
 *
 * Handles account linking between users (e.g., partners)
 */

const loadLinksForUser = async (ctx: QueryCtx, userId: string) => {
  const createdLinks = await ctx.db
    .query("account_links")
    .withIndex("by_creator", (q) => q.eq("creator_id", userId))
    .collect();

  const invitedLinks = await ctx.db
    .query("account_links")
    .withIndex("by_invited", (q) => q.eq("invited_id", userId))
    .collect();

  return { createdLinks, invitedLinks };
};

// Query to get all links for a user (as creator or invited)
export const getUserLinks = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { createdLinks, invitedLinks } = await loadLinksForUser(
      ctx,
      args.userId
    );

    return {
      created: createdLinks,
      invited: invitedLinks,
      all: [...createdLinks, ...invitedLinks],
    };
  },
});

// Query to get linked users for a user
export const getLinkedUsers = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { createdLinks, invitedLinks } = await loadLinksForUser(
      ctx,
      args.userId
    );
    const all = [...createdLinks, ...invitedLinks];

    // Filter accepted links only
    const acceptedLinks = all.filter((link) => link.status === "accepted");

    // Get the other user IDs
    const linkedUserIds = acceptedLinks.map((link) =>
      link.creator_id === args.userId ? link.invited_id : link.creator_id
    );

    // Get profiles for linked users
    const profiles = await Promise.all(
      linkedUserIds.map((userId) =>
        userId
          ? ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("user_id", userId))
              .first()
          : null
      )
    );

    return profiles.filter((p) => p !== null);
  },
});

// Mutation to sync an account link
export const syncAccountLink = mutation({
  args: {
    supabaseLinkId: v.string(),
    creatorId: v.string(),
    invitedId: v.optional(v.string()),
    invitationCode: v.string(),
    status: v.string(),
    relationshipType: v.optional(v.string()),
    createdAt: v.string(),
    expiresAt: v.string(),
    acceptedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if link already exists by Supabase ID
    const existingLink = await ctx.db
      .query("account_links")
      .withIndex("by_supabase_id", (q) =>
        q.eq("supabase_link_id", args.supabaseLinkId)
      )
      .first();

    if (existingLink) {
      // Update existing link
      await ctx.db.patch(existingLink._id, {
        invited_id: args.invitedId,
        invitation_code: args.invitationCode,
        status: args.status,
        relationship_type: args.relationshipType,
        expires_at: args.expiresAt,
        accepted_at: args.acceptedAt,
      });

      const updated = await ctx.db.get(existingLink._id);
      return updated;
    }

    // Create new link
    const linkId = await ctx.db.insert("account_links", {
      supabase_link_id: args.supabaseLinkId,
      creator_id: args.creatorId,
      invited_id: args.invitedId,
      invitation_code: args.invitationCode,
      status: args.status,
      relationship_type: args.relationshipType,
      created_at: args.createdAt,
      expires_at: args.expiresAt,
      accepted_at: args.acceptedAt,
    });

    const newLink = await ctx.db.get(linkId);
    return newLink;
  },
});

// Mutation to delete an account link
export const deleteAccountLink = mutation({
  args: {
    supabaseLinkId: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("account_links")
      .withIndex("by_supabase_id", (q) =>
        q.eq("supabase_link_id", args.supabaseLinkId)
      )
      .first();

    if (link) {
      await ctx.db.delete(link._id);
      return { success: true };
    }

    return { success: false, message: "Link not found" };
  },
});
