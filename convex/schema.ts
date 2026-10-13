import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Schema for LottiBaby App
 *
 * This schema mirrors the Supabase database structure to enable
 * a dual-backend architecture with Convex running parallel to Supabase.
 */

export default defineSchema({
  // User synchronization table
  // Maps Supabase user IDs to Convex users for auth sync
  users: defineTable({
    supabase_user_id: v.string(),
    email: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_supabase_id", ["supabase_user_id"]),

  // User Profiles table
  // Stores additional user profile information
  profiles: defineTable({
    user_id: v.string(), // Supabase user ID
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    user_role: v.optional(v.string()), // 'mama', 'papa', etc.
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_user", ["user_id"]),

  // Account Links table
  // Manages linked accounts between users (e.g., partners)
  account_links: defineTable({
    supabase_link_id: v.string(), // Original Supabase link ID
    creator_id: v.string(), // Supabase user ID who created the link
    invited_id: v.optional(v.string()), // Supabase user ID who was invited
    invitation_code: v.string(),
    status: v.string(), // 'pending', 'accepted', 'rejected'
    relationship_type: v.optional(v.string()),
    created_at: v.string(),
    expires_at: v.string(),
    accepted_at: v.optional(v.string()),
  })
    .index("by_creator", ["creator_id"])
    .index("by_invited", ["invited_id"])
    .index("by_code", ["invitation_code"])
    .index("by_supabase_id", ["supabase_link_id"]),

  // Babies table
  // Stores baby information
  babies: defineTable({
    supabase_baby_id: v.optional(v.string()), // Deprecated: Only for migration/sync
    user_id: v.string(), // User ID (owner)
    name: v.optional(v.string()),
    birth_date: v.optional(v.string()),
    baby_gender: v.optional(v.string()),
    weight: v.optional(v.string()),
    height: v.optional(v.string()),
    photo_url: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_user", ["user_id"])
    .index("by_supabase_id", ["supabase_baby_id"]),

  // Baby Members table
  // Stores baby membership (sharing) information
  baby_members: defineTable({
    baby_id: v.string(), // Supabase baby ID
    user_id: v.string(), // Supabase user ID
    role: v.optional(v.string()),
    created_at: v.string(),
  })
    .index("by_user", ["user_id"])
    .index("by_baby", ["baby_id"])
    .index("by_baby_user", ["baby_id", "user_id"]),

  // Doctor Questions table
  // Stores questions for the gynecologist/doctor appointments
  doctor_questions: defineTable({
    user_id: v.string(), // Supabase user ID
    question: v.string(),
    answer: v.optional(v.string()),
    is_answered: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_user", ["user_id"])
    .index("by_user_and_created", ["user_id", "created_at"])
    .index("by_answered", ["user_id", "is_answered"]),

  // Sleep Entries table
  // Stores baby sleep tracking entries
  sleep_entries: defineTable({
    supabase_sleep_id: v.optional(v.string()), // Deprecated: Only for migration/sync
    user_id: v.string(), // User ID (owner)
    baby_id: v.optional(v.string()),
    start_time: v.string(),
    end_time: v.optional(v.string()),
    duration_minutes: v.optional(v.number()),
    notes: v.optional(v.string()),
    quality: v.optional(v.string()),
    shared_with_user_id: v.optional(v.string()),
    partner_id: v.optional(v.string()),
    updated_by: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_supabase_id", ["supabase_sleep_id"])
    .index("by_user", ["user_id"])
    .index("by_baby", ["baby_id"])
    .index("by_partner", ["partner_id"])
    .index("by_shared", ["shared_with_user_id"]),
});
