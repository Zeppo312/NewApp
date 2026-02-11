import { DualWriteResult, ReadResult } from './BaseDataService';
import {
  deleteDoctorQuestion,
  DoctorQuestion,
  getDoctorQuestions,
  saveDoctorQuestion,
  updateDoctorQuestion,
} from '@/lib/supabase';

/**
 * DoctorQuestionsService
 *
 * Supabase-only service for doctor questions.
 * Convex dual-write was intentionally removed to avoid blocked UI operations.
 */
export class DoctorQuestionsService {
  constructor() {}

  async getQuestions(): Promise<ReadResult<DoctorQuestion[]>> {
    const result = await getDoctorQuestions();
    return {
      ...result,
      source: 'supabase',
    };
  }

  async saveQuestion(question: string): Promise<DualWriteResult<DoctorQuestion>> {
    const result = await saveDoctorQuestion(question);
    return {
      primary: result,
      secondary: { data: null, error: null },
      success: !result.error,
    };
  }

  async updateQuestion(
    questionId: string,
    updates: Partial<DoctorQuestion>
  ): Promise<DualWriteResult<DoctorQuestion>> {
    const result = await updateDoctorQuestion(questionId, updates);
    return {
      primary: result,
      secondary: { data: null, error: null },
      success: !result.error,
    };
  }

  async deleteQuestion(questionId: string): Promise<DualWriteResult<void>> {
    const result = await deleteDoctorQuestion(questionId);
    return {
      primary: {
        data: result.error ? null : undefined,
        error: result.error,
      },
      secondary: { data: null, error: null },
      success: !result.error,
    };
  }
}
