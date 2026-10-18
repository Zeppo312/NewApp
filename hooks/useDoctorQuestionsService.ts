import { useMemo } from 'react';
import { DoctorQuestionsService } from '@/lib/services/DoctorQuestionsService';
import { useAuth } from '@/contexts/AuthContext';

/**
 * useDoctorQuestionsService Hook
 *
 * Provides access to the Supabase-backed DoctorQuestionsService.
 */

export const useDoctorQuestionsService = () => {
  const { user } = useAuth();

  const service = useMemo(() => {
    if (!user) {
      return null;
    }

    return new DoctorQuestionsService();
  }, [user]);

  return service;
};
