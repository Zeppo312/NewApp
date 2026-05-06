import { supabase, getDueDateWithLinkedUsers } from './supabase';
import { getRecommendations, LottiRecommendation } from './supabase/recommendations';
import { parseSafeDate } from './safeDate';
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

      if (!result.success || !result.dueDate) {
        return {
          date: null,
          currentWeek: null,
          currentDay: null,
        };
      }

      const due = parseSafeDate(result.dueDate);
      if (!due) {
        return {
          date: null,
          currentWeek: null,
          currentDay: null,
        };
      }

      // Berechne die aktuelle SSW
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const dueDateCopy = new Date(due);
      dueDateCopy.setHours(0, 0, 0, 0);

      // Berechne die Differenz in Tagen
      const difference = dueDateCopy.getTime() - now.getTime();
      const daysLeft = Math.round(difference / (1000 * 60 * 60 * 24));

      // Schwangerschaft dauert ca. 40 Wochen = 280 Tage
      const totalDaysInPregnancy = 280;
      const daysRemaining = Math.max(0, daysLeft);
      const daysPregnant = totalDaysInPregnancy - daysRemaining;

      // Berechne SSW und Tag
      const weeksPregnant = Math.floor(daysPregnant / 7);
      const daysInCurrentWeek = daysPregnant % 7;

      // currentWeek ist die aktuelle Schwangerschaftswoche (1-basiert)
      const currentWeek = weeksPregnant + 1;

      return {
        date: due,
        currentWeek,
        currentDay: daysInCurrentWeek,
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
    dueDate: dueDateResult.data || { date: null, currentWeek: null, currentDay: null },
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
