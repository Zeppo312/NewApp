import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Convex Functions for Doctor Questions
 *
 * These functions provide CRUD operations for doctor questions,
 * mirroring the Supabase implementation for dual-backend support.
 */

// Query to list all doctor questions for a user
export const listQuestions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query("doctor_questions")
      .withIndex("by_user_and_created", (q) => q.eq("user_id", args.userId))
      .order("desc")
      .collect();

    return questions;
  },
});

// Mutation to create a new doctor question
export const createQuestion = mutation({
  args: {
    userId: v.string(),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const questionId = await ctx.db.insert("doctor_questions", {
      user_id: args.userId,
      question: args.question,
      is_answered: false,
      created_at: now,
      updated_at: now,
    });

    const newQuestion = await ctx.db.get(questionId);
    return newQuestion;
  },
});

// Mutation to update a doctor question
export const updateQuestion = mutation({
  args: {
    questionId: v.id("doctor_questions"),
    userId: v.string(),
    updates: v.object({
      question: v.optional(v.string()),
      answer: v.optional(v.string()),
      is_answered: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.questionId);

    if (!existing) {
      throw new Error("Question not found");
    }

    if (existing.user_id !== args.userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.questionId, {
      ...args.updates,
      updated_at: new Date().toISOString(),
    });

    const updated = await ctx.db.get(args.questionId);
    return updated;
  },
});

// Mutation to delete a doctor question
export const deleteQuestion = mutation({
  args: {
    questionId: v.id("doctor_questions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.questionId);

    if (!existing) {
      throw new Error("Question not found");
    }

    if (existing.user_id !== args.userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.questionId);
    return { success: true };
  },
});
