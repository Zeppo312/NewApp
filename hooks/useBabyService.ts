import { useState, useCallback } from 'react';
import { useBackend } from '@/contexts/BackendContext';
import { useConvex } from '@/contexts/ConvexContext';
import { useAuth } from '@/contexts/AuthContext';
import { BabyService, BabyInfo, CreateBabyInput, UpdateBabyInput } from '@/lib/services/BabyService';

/**
 * Hook to access baby data service
 * Automatically uses the active backend (Supabase or Convex)
 */
export function useBabyService() {
  const { activeBackend } = useBackend();
  const { convexClient } = useConvex();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create service instance
  const getService = useCallback(() => {
    if (!user) throw new Error('User not authenticated');
    return new BabyService(activeBackend, convexClient, user.id);
  }, [activeBackend, convexClient, user]);

  // List all babies
  const listBabies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const service = getService();
      const result = await service.listBabies();

      if (result.error) {
        setError(result.error as Error);
        return { data: null, error: result.error };
      }

      return { data: result.data, error: null };
    } catch (err) {
      const error = err as Error;
      setError(error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [getService]);

  // Get a specific baby
  const getBaby = useCallback(async (babyId: string) => {
    try {
      setLoading(true);
      setError(null);
      const service = getService();
      const result = await service.getBaby(babyId);

      if (result.error) {
        setError(result.error as Error);
        return { data: null, error: result.error };
      }

      return { data: result.data, error: null };
    } catch (err) {
      const error = err as Error;
      setError(error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [getService]);

  // Create a new baby
  const createBaby = useCallback(async (input: CreateBabyInput) => {
    try {
      setLoading(true);
      setError(null);
      const service = getService();
      const result = await service.createBaby(input);

      if (!result.success || result.primary.error) {
        const error = result.primary.error as Error;
        setError(error);
        return { data: null, error };
      }

      return { data: result.primary.data, error: null };
    } catch (err) {
      const error = err as Error;
      setError(error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [getService]);

  // Update an existing baby
  const updateBaby = useCallback(async (babyId: string, updates: UpdateBabyInput) => {
    try {
      setLoading(true);
      setError(null);
      const service = getService();
      const result = await service.updateBaby(babyId, updates);

      if (!result.success || result.primary.error) {
        const error = result.primary.error as Error;
        setError(error);
        return { data: null, error };
      }

      return { data: result.primary.data, error: null };
    } catch (err) {
      const error = err as Error;
      setError(error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [getService]);

  // Delete a baby
  const deleteBaby = useCallback(async (babyId: string) => {
    try {
      setLoading(true);
      setError(null);
      const service = getService();
      const result = await service.deleteBaby(babyId);

      if (!result.success || result.primary.error) {
        const error = result.primary.error as Error;
        setError(error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err) {
      const error = err as Error;
      setError(error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [getService]);

  return {
    listBabies,
    getBaby,
    createBaby,
    updateBaby,
    deleteBaby,
    loading,
    error,
    activeBackend,
  };
}
