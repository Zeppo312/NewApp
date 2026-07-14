import {
  CacheStrategy,
  loadWithRevalidate,
  invalidateCacheAfterAction,
} from './screenCache';
import { getBabyInfo, BabyInfo } from './baby';

/**
 * Baby Screen Cache System
 *
 * Optimiert Supabase-Queries durch intelligentes Caching:
 * - Baby-Daten ändern sich sehr selten (nur bei User Edit)
 * - LONG Cache (10 Minuten) ist perfekt dafür
 * - Cache wird nur nach Save invalidiert
 */

/**
 * Load Baby Info mit Cache
 *
 * Baby-Daten ändern sich sehr selten, daher LONG Cache (10 Min)
 */
export async function loadBabyInfoWithCache(
  babyId: string
): Promise<{
  data: BabyInfo | null;
  isStale: boolean;
  refresh: () => Promise<BabyInfo>;
}> {
  const cacheKey = `screen_cache_baby_info_${babyId}`;

  return await loadWithRevalidate(
    cacheKey,
    async () => {
      const { data, error } = await getBabyInfo(babyId);
      if (error) {
        console.error('Error loading baby info:', error);
        throw error;
      }

      if (!data) {
        // Return empty BabyInfo if no data
        return {};
      }

      return {
        id: data.id,
        name: data.name || '',
        birth_date: data.birth_date || null,
        weight: data.weight || '',
        height: data.height || '',
        photo_url: data.photo_url || null,
        baby_gender: data.baby_gender || 'unknown',
      };
    },
    CacheStrategy.LONG // 10 Minuten - Baby-Daten ändern sich selten
  );
}

/**
 * Invalidate Baby Cache after Save
 *
 * Called after: Save Baby Info
 */
export async function invalidateBabyCache(babyId: string): Promise<void> {
  const cacheKey = `screen_cache_baby_info_${babyId}`;
  await invalidateCacheAfterAction(cacheKey);

  console.log('✅ Baby cache invalidated for baby:', babyId);
}
