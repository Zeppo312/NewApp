import { useMemo } from 'react';
import { useConvex } from '@/contexts/ConvexContext';
import { useBackend } from '@/contexts/BackendContext';
import { SleepEntriesService } from '@/lib/services/SleepEntriesService';

/**
 * Hook to provide SleepEntriesService with current backend context
 *
 * Usage:
 * const service = useSleepEntriesService(user?.id);
 * const result = await service.getEntries();
 */
export const useSleepEntriesService = (userId?: string | null) => {
  const { convexClient } = useConvex();
  const { activeBackend } = useBackend();

  const service = useMemo(() => {
    if (!userId) {
      return null;
    }

    return new SleepEntriesService(activeBackend, convexClient, userId);
  }, [activeBackend, convexClient, userId]);

  return service;
};
