import { backendHost, readSnapshot, writeSnapshot, invalidateReadSnapshots, localScopeKey, readSnapshotRevision } from './localReadSnapshots';
import { localHealthGeneration, localHealthAllowed } from './localHealthStorage';
import { boundedRead } from './boundedRead';
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

      if (!result.success) throw result.error ?? new Error('pregnancy_due_date_unavailable');
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
export async function loadPregnancyHomeDataWithCache(userId: string, options?: {
  force?: boolean;
  onConfirmed?: (data: Partial<Pick<PregnancyHomeData, 'profile' | 'dueDate'>>, verifiedAt: string) => void;
}) {
  const scope = { backendHost: backendHost(), userId }; const generation = localHealthGeneration(); const readRevision = readSnapshotRevision();
  const [profile, due] = await Promise.all([
    readSnapshot(scope, 'pregnancy-profile', (v): v is { firstName: string; avatarUrl: string | null } => !!v && typeof (v as any).firstName === 'string' && ((v as any).avatarUrl === null || typeof (v as any).avatarUrl === 'string')),
    readSnapshot(scope, 'pregnancy-due', (v): v is string | null => v === null || typeof v === 'string' && !!parsePregnancyDate(v)),
  ]);
  const dueData = (date: string | Date | null) => { const parsed = parsePregnancyDate(date); const age = getPregnancyAge(parsed); return { date: parsed, currentWeek: age?.runningWeek ?? null, currentDay: age?.day ?? null }; };
  const refresh = async () => {
    const results = await Promise.allSettled([
      (async () => {
        const { value, at } = await boundedRead(localScopeKey(scope) + ':pregnancy-profile', async signal => {
        const { data, error } = await supabase.from('profiles').select('first_name,avatar_url').eq('id', userId).abortSignal(signal).single();
        if (error) throw error;
        const value = { firstName: data?.first_name ?? '', avatarUrl: data?.avatar_url ?? null }; const at = new Date().toISOString();
        return { value, at };
        });
        if (localHealthAllowed(userId, generation) && readRevision === readSnapshotRevision()) { options?.onConfirmed?.({ profile: value }, at); await writeSnapshot(scope, 'pregnancy-profile', value, at, generation, readRevision).catch(() => {}); }
        return value;
      })(),
      (async () => {
        const { value, at } = await boundedRead(localScopeKey(scope) + ':pregnancy-due', async signal => {
        const result = await getDueDateWithLinkedUsers(userId, signal);
        if (!result.success) throw result.error ?? new Error('pregnancy_due_date_unavailable');
        const parsed = parsePregnancyDate(result.dueDate); if (result.dueDate && !parsed) throw new Error('pregnancy_due_date_invalid');
        const value = parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}` : null;
        const at = new Date().toISOString();
        return { value, at };
        });
        if (localHealthAllowed(userId, generation) && readRevision === readSnapshotRevision()) { options?.onConfirmed?.({ dueDate: dueData(value) }, at); await writeSnapshot(scope, 'pregnancy-due', value, at, generation, readRevision).catch(() => {}); }
        return dueData(value);
      })(),
    ]);
    if (!localHealthAllowed(userId, generation) || readRevision !== readSnapshotRevision() || results.some(result => result.status === 'rejected')) throw new Error('pregnancy_refresh_failed');
    return true;
  };
  return { profile: profile?.data ?? { firstName: '', avatarUrl: null }, dueDate: dueData(due?.data ?? null), recommendations: [],
    isStale: options?.force === true || !profile || !due || [profile.verifiedAt,due.verifiedAt].some(at=>Date.now()-Date.parse(at)>=600000), hasProfile: !!profile, hasDueDate: !!due, verifiedAt: [profile?.verifiedAt, due?.verifiedAt].filter(Boolean).sort()[0], refresh };
}

/**
 * Invalidate Pregnancy Home Cache
 *
 * Called after: Update Profile, Update Due Date
 */
export async function invalidatePregnancyCache(userId: string): Promise<void> {
  await invalidateReadSnapshots(userId, undefined, ['pregnancy-profile', 'pregnancy-due']);
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
  await invalidateReadSnapshots(userId, undefined, ['pregnancy-profile']);
  await invalidateCacheAfterAction(`pregnancy_profile_${userId}`);
  console.log('✅ Profile cache invalidated for user:', userId);
}

/**
 * Invalidate nur Due Date Cache
 */
export async function invalidateDueDateCache(userId: string): Promise<void> {
  await invalidateReadSnapshots(userId, undefined, ['pregnancy-due']);
  await invalidateCacheAfterAction(`pregnancy_duedate_${userId}`);
  console.log('✅ Due Date cache invalidated for user:', userId);
}
