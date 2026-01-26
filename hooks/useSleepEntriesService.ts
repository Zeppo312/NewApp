import { useMemo } from 'react';
import { useConvex } from '@/contexts/ConvexContext';
import { useBackend } from '@/contexts/BackendContext';
import { useAuth } from '@/contexts/AuthContext';
import { SleepEntriesService } from '@/lib/services/SleepEntriesService';

/**
 * Hook to provide SleepEntriesService with current backend context
 *
 * Usage:
 * const service = useSleepEntriesService();
 * const result = await service.getEntries();
 */
export const useSleepEntriesService = () => {
  const { convexClient } = useConvex();
  const { activeBackend } = useBackend();
  const { user } = useAuth();

  const service = useMemo(() => {
    if (!user) {
      throw new Error('User must be authenticated to use SleepEntriesService');
    }

    return new SleepEntriesService(activeBackend, convexClient, user.id);
  }, [activeBackend, convexClient, user]);

  return service;
};
