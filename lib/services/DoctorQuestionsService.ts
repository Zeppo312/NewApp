import { BaseDataService, BackendType, DualWriteResult, ReadResult } from './BaseDataService';
import {
  getDoctorQuestions,
  saveDoctorQuestion,
  updateDoctorQuestion,
  deleteDoctorQuestion,
  DoctorQuestion,
} from '@/lib/supabase';
import { ConvexReactClient } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

/**
 * DoctorQuestionsService
 *
 * Service layer for doctor questions with dual-backend support.
 * - Dual-writes to both Supabase and Convex
 * - Reads from the active backend (based on user preference)
 * - Handles data synchronization and error scenarios
 */

export class DoctorQuestionsService extends BaseDataService {
  constructor(
    private userId: string,
    private activeBackend: BackendType,
    private convexClient: ConvexReactClient | null
  ) {
    super();
  }

  /**
   * Get all doctor questions for the user.
   * Reads from the active backend only.
   */
  async getQuestions(): Promise<ReadResult<DoctorQuestion[]>> {
    return this.readFromActive<DoctorQuestion[]>(
      this.activeBackend,
      // Supabase operation
      async () => {
        const result = await getDoctorQuestions();
        return result;
      },
      // Convex operation
      async () => {
        if (!this.convexClient) {
          return { data: null, error: new Error('Convex client not available') };
        }

        try {
          const questions = await this.convexClient.query(api.doctorQuestions.listQuestions, {
            userId: this.userId,
          });

          // Transform Convex format to match Supabase DoctorQuestion type
          const transformed: DoctorQuestion[] = questions.map((q: any) => ({
            id: q._id,
            user_id: q.user_id,
            question: q.question,
            answer: q.answer,
            is_answered: q.is_answered,
            created_at: q.created_at,
            updated_at: q.updated_at,
          }));

          return { data: transformed, error: null };
        } catch (error) {
          return { data: null, error };
        }
      }
    );
  }

  /**
   * Save a new doctor question.
   * Dual-writes to both backends.
   */
  async saveQuestion(question: string): Promise<DualWriteResult<DoctorQuestion>> {
    const primaryBackend = this.activeBackend;

    return this.dualWrite<DoctorQuestion>(
      primaryBackend,
      // Primary operation
      async () => {
        if (primaryBackend === 'supabase') {
          return await saveDoctorQuestion(question);
        } else {
          if (!this.convexClient) {
            return { data: null, error: new Error('Convex client not available') };
          }
          try {
            const result = await this.convexClient.mutation(api.doctorQuestions.createQuestion, {
              userId: this.userId,
              question,
            });
            const transformed: DoctorQuestion = {
              id: result._id,
              user_id: result.user_id,
              question: result.question,
              answer: result.answer,
              is_answered: result.is_answered,
              created_at: result.created_at,
              updated_at: result.updated_at,
            };
            return { data: transformed, error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      },
      // Secondary operation
      async () => {
        if (primaryBackend === 'supabase') {
          // Secondary is Convex
          if (!this.convexClient) {
            return { data: null, error: new Error('Convex client not available') };
          }
          try {
            const result = await this.convexClient.mutation(api.doctorQuestions.createQuestion, {
              userId: this.userId,
              question,
            });
            const transformed: DoctorQuestion = {
              id: result._id,
              user_id: result.user_id,
              question: result.question,
              answer: result.answer,
              is_answered: result.is_answered,
              created_at: result.created_at,
              updated_at: result.updated_at,
            };
            return { data: transformed, error: null };
          } catch (error) {
            return { data: null, error };
          }
        } else {
          // Secondary is Supabase
          return await saveDoctorQuestion(question);
        }
      }
    );
  }

  /**
   * Update a doctor question.
   * Dual-writes to both backends.
   */
  async updateQuestion(
    questionId: string,
    updates: Partial<DoctorQuestion>
  ): Promise<DualWriteResult<DoctorQuestion>> {
    const primaryBackend = this.activeBackend;

    return this.dualWrite<DoctorQuestion>(
      primaryBackend,
      // Primary operation
      async () => {
        if (primaryBackend === 'supabase') {
          return await updateDoctorQuestion(questionId, updates);
        } else {
          if (!this.convexClient) {
            return { data: null, error: new Error('Convex client not available') };
          }
          try {
            const result = await this.convexClient.mutation(api.doctorQuestions.updateQuestion, {
              questionId: questionId as Id<'doctor_questions'>,
              userId: this.userId,
              updates: {
                question: updates.question,
                answer: updates.answer,
                is_answered: updates.is_answered,
              },
            });
            const transformed: DoctorQuestion = {
              id: result._id,
              user_id: result.user_id,
              question: result.question,
              answer: result.answer,
              is_answered: result.is_answered,
              created_at: result.created_at,
              updated_at: result.updated_at,
            };
            return { data: transformed, error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      },
      // Secondary operation
      async () => {
        if (primaryBackend === 'supabase') {
          // Secondary is Convex
          if (!this.convexClient) {
            return { data: null, error: new Error('Convex client not available') };
          }
          try {
            const result = await this.convexClient.mutation(api.doctorQuestions.updateQuestion, {
              questionId: questionId as Id<'doctor_questions'>,
              userId: this.userId,
              updates: {
                question: updates.question,
                answer: updates.answer,
                is_answered: updates.is_answered,
              },
            });
            const transformed: DoctorQuestion = {
              id: result._id,
              user_id: result.user_id,
              question: result.question,
              answer: result.answer,
              is_answered: result.is_answered,
              created_at: result.created_at,
              updated_at: result.updated_at,
            };
            return { data: transformed, error: null };
          } catch (error) {
            return { data: null, error };
          }
        } else {
          // Secondary is Supabase
          return await updateDoctorQuestion(questionId, updates);
        }
      }
    );
  }

  /**
   * Delete a doctor question.
   * Dual-writes to both backends.
   */
  async deleteQuestion(questionId: string): Promise<DualWriteResult<void>> {
    const primaryBackend = this.activeBackend;

    return this.dualWrite<void>(
      primaryBackend,
      // Primary operation
      async () => {
        if (primaryBackend === 'supabase') {
          const result = await deleteDoctorQuestion(questionId);
          return { data: result.error ? null : undefined, error: result.error };
        } else {
          if (!this.convexClient) {
            return { data: null, error: new Error('Convex client not available') };
          }
          try {
            await this.convexClient.mutation(api.doctorQuestions.deleteQuestion, {
              questionId: questionId as Id<'doctor_questions'>,
              userId: this.userId,
            });
            return { data: undefined, error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      },
      // Secondary operation
      async () => {
        if (primaryBackend === 'supabase') {
          // Secondary is Convex
          if (!this.convexClient) {
            return { data: null, error: new Error('Convex client not available') };
          }
          try {
            await this.convexClient.mutation(api.doctorQuestions.deleteQuestion, {
              questionId: questionId as Id<'doctor_questions'>,
              userId: this.userId,
            });
            return { data: undefined, error: null };
          } catch (error) {
            return { data: null, error };
          }
        } else {
          // Secondary is Supabase
          const result = await deleteDoctorQuestion(questionId);
          return { data: result.error ? null : undefined, error: result.error };
        }
      }
    );
  }
}
