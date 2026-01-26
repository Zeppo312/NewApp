import { useMemo } from 'react';
import { DoctorQuestionsService } from '@/lib/services/DoctorQuestionsService';
import { useAuth } from '@/contexts/AuthContext';
import { useBackend } from '@/contexts/BackendContext';
import { useConvex } from '@/contexts/ConvexContext';

/**
 * useDoctorQuestionsService Hook
 *
 * Provides access to the DoctorQuestionsService with proper context dependencies.
 * Automatically manages service instance based on user, backend preference, and Convex client.
 */

export const useDoctorQuestionsService = () => {
  const { user } = useAuth();
  const { activeBackend } = useBackend();
  const { convexClient } = useConvex();

  const service = useMemo(() => {
    if (!user) {
      return null;
    }

    return new DoctorQuestionsService(user.id, activeBackend, convexClient);
  }, [user, activeBackend, convexClient]);

  return service;
};
