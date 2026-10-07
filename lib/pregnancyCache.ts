import { supabase, getDueDateWithLinkedUsers } from './supabase';
import { getRecommendations, LottiRecommendation } from './supabase/recommendations';
import { getPregnancyAge, parsePregnancyDate } from './pregnancy-age';
import {
  CacheStrategy,
  loadWithRevalidate,
  invalidateCacheAfterAction,
} from './screenCache';

/**
 * Pregnancy-Home Screen Cache System
 *
 * Optimiert Supabase-Queries durch intelligentes Caching:
 * - Profile-Daten (first_name, avatar_url): LONG Cache (10 Min) - ändern sich selten
 * - Due Date: LONG Cache (10 Min) - ändert sich nur bei Edit
 * - Recommendations: LONG Cache (10 Min) - statische Inhalte
 */

export interface PregnancyHomeData {
  profile: {
    firstName: string;
    avatarUrl: string | null;
  };
  dueDate: {
    date: Date | null;
    currentWeek: number | null;
    currentDay: number | null;
  };
  recommendations: LottiRecommendation[];
}

/**
 * Load Profile Data mit Cache
 */
export async function loadProfileDataWithCache(
  userId: string
): Promise<{
  data: { firstName: string; avatarUrl: string | null } | null;
  isStale: boolean;
  refresh: () => Promise<{ firstName: string; avatarUrl: string | null }>;
}> {
  const cacheKey = `screen_cache_pregnancy_profile_${userId}`;

  return await loadWithRevalidate(
    cacheKey,
    async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, avatar_url')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      return {
        firstName: profileData?.first_name || '',
        avatarUrl: profileData?.avatar_url || null,
      };
    },
    CacheStrategy.LONG // 10 Minuten - Profile ändern sich selten
  );
}

/**
 * Load Due Date mit Cache
 */
export async function loadDueDateWithCache(
  userId: string
): Promise<{
  data: { date: Date | null; currentWeek: number | null; currentDay: number | null } | null;
  isStale: boolean;
  refresh: () => Promise<{ date: Date | null; currentWeek: number | null; currentDay: number | null }>;
}> {
  const cacheKey = `screen_cache_pregnancy_duedate_${userId}`;

  return await loadWithRevalidate(
    cacheKey,
    async () => {
      const result = await getDueDateWithLinkedUsers(userId);

      if (!result.success) throw new Error('pregnancy_due_date_unavailable');
      if (!result.dueDate) {
        return {
          date: null,
          currentWeek: null,
          currentDay: null,
        };
      }

      const due = parsePregnancyDate(result.dueDate);
      if (!due) throw new Error('pregnancy_due_date_invalid');

      const age = getPregnancyAge(due);
      return {
        date: due,
        currentWeek: age?.runningWeek ?? null,
        currentDay: age?.day ?? null,
      };
    },
    CacheStrategy.LONG // 10 Minuten - Due Date ändert sich nicht oft
  );
}

/**
 * Load Recommendations mit Cache
 */
export async function loadRecommendationsWithCache(): Promise<{
  data: LottiRecommendation[] | null;
  isStale: boolean;
  refresh: () => Promise<LottiRecommendation[]>;
}> {
  const cacheKey = 'screen_cache_pregnancy_recommendations';

  return await loadWithRevalidate(
    cacheKey,
    async () => {
      const recommendations = await getRecommendations();
      return recommendations;
    },
    CacheStrategy.LONG // 10 Minuten - Recommendations sind statisch
  );
}

/**
 * Load ALL Pregnancy Home Data mit Cache
 *
 * Lädt alle Daten parallel für optimale Performance
 */
export async function loadPregnancyHomeDataWithCache(
  userId: string
): Promise<{
  profile: { firstName: string; avatarUrl: string | null };
  dueDate: { date: Date | null; currentWeek: number | null; currentDay: number | null };
  recommendations: LottiRecommendation[];
  isStale: boolean;
}> {
  // Alle Queries parallel ausführen
  const [profileResult, dueDateResult, recommendationsResult] = await Promise.all([
    loadProfileDataWithCache(userId),
    loadDueDateWithCache(userId),
    loadRecommendationsWithCache(),
  ]);

  // Bestimme ob irgendwelche Daten stale sind
  const isStale =
    profileResult.isStale || dueDateResult.isStale || recommendationsResult.isStale;

  // Background Refresh wenn stale
  if (isStale) {
    Promise.all([
      profileResult.isStale ? profileResult.refresh() : Promise.resolve(profileResult.data!),
      dueDateResult.isStale ? dueDateResult.refresh() : Promise.resolve(dueDateResult.data!),
      recommendationsResult.isStale ? recommendationsResult.refresh() : Promise.resolve(recommendationsResult.data!),
    ]).catch((error) => {
      console.error('Background refresh failed:', error);
    });
  }

  return {
    profile: profileResult.data || { firstName: '', avatarUrl: null },
    // Cached Date objects are JSON strings; age must be recalculated today,
    // rather than carrying yesterday's week through a ten-minute cache.
    dueDate: (() => {
      const date = parsePregnancyDate(dueDateResult.data?.date);
      const age = getPregnancyAge(date);
      return { date, currentWeek: age?.runningWeek ?? null, currentDay: age?.day ?? null };
    })(),
    recommendations: recommendationsResult.data || [],
    isStale,
  };
}

/**
 * Invalidate Pregnancy Home Cache
 *
 * Called after: Update Profile, Update Due Date
 */
export async function invalidatePregnancyCache(userId: string): Promise<void> {
  // Invalidate alle 3 Cache-Keys
  await Promise.all([
    invalidateCacheAfterAction(`pregnancy_profile_${userId}`),
    invalidateCacheAfterAction(`pregnancy_duedate_${userId}`),
    invalidateCacheAfterAction('pregnancy_recommendations'),
  ]);

  console.log('✅ Pregnancy cache invalidated for user:', userId);
}

/**
 * Invalidate nur Profile Cache
 */
export async function invalidateProfileCache(userId: string): Promise<void> {
  await invalidateCacheAfterAction(`pregnancy_profile_${userId}`);
  console.log('✅ Profile cache invalidated for user:', userId);
}

/**
 * Invalidate nur Due Date Cache
 */
export async function invalidateDueDateCache(userId: string): Promise<void> {
  await invalidateCacheAfterAction(`pregnancy_duedate_${userId}`);
  console.log('✅ Due Date cache invalidated for user:', userId);
}
