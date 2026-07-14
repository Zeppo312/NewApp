import { supabase } from './supabase';
import {
  CacheStrategy,
  loadWithRevalidate,
  invalidateCacheAfterAction,
  cacheData,
  loadCachedData,
} from './screenCache';
import {
  getBabyCareEntriesForDate,
  getBabyCareEntriesForDateRange,
  getBabyCareEntriesForMonth,
} from './supabase';

/**
 * Daily Screen Cache System
 *
 * Optimiert Supabase-Queries durch intelligentes Caching:
 * - Day View: 2 Minuten Cache (ändert sich häufig)
 * - Week View: 2 Minuten Cache (Updates nach User Actions)
 * - Month View: 5 Minuten Cache (ändert sich selten)
 */

// Helper: Map Care Entries to Daily Format
export const mapCareToDaily = (rows: any[]): any[] =>
  rows.map((r) => ({
    id: r.id,
    entry_date: r.start_time,
    entry_type: r.entry_type,
    start_time: r.start_time,
    end_time: r.end_time ?? null,
    notes: r.notes ?? null,
    feeding_type: r.feeding_type ?? undefined,
    feeding_volume_ml: r.feeding_volume_ml ?? undefined,
    feeding_side: r.feeding_side ?? undefined,
    diaper_type: r.diaper_type ?? undefined,
    sub_type:
      r.entry_type === 'feeding'
        ? r.feeding_type === 'BREAST'
          ? 'feeding_breast'
          : r.feeding_type === 'BOTTLE'
          ? 'feeding_bottle'
          : 'feeding_solids'
        : r.entry_type === 'diaper'
        ? r.diaper_type === 'WET'
          ? 'diaper_wet'
          : r.diaper_type === 'DIRTY'
          ? 'diaper_dirty'
          : 'diaper_both'
        : undefined,
  }));

/**
 * Load Day Entries mit Cache
 */
export async function loadDayEntriesWithCache(
  date: Date,
  babyId: string
): Promise<{
  data: any[] | null;
  isStale: boolean;
  refresh: () => Promise<any[]>;
}> {
  const dateKey = date.toISOString().split('T')[0];
  const cacheKey = `screen_cache_daily_day_${babyId}_${dateKey}`;

  return await loadWithRevalidate(
    cacheKey,
    async () => {
      const { data, error } = await getBabyCareEntriesForDate(date, babyId);
      if (error) throw error;
      return mapCareToDaily(data ?? []);
    },
    CacheStrategy.MEDIUM // 2 Minuten
  );
}

/**
 * Load Week Entries mit Cache
 */
export async function loadWeekEntriesWithCache(
  weekStart: Date,
  weekEnd: Date,
  babyId: string
): Promise<{
  data: any[] | null;
  isStale: boolean;
  refresh: () => Promise<any[]>;
}> {
  // Cache Key basierend auf Week Start
  const weekKey = weekStart.toISOString().split('T')[0];
  const cacheKey = `screen_cache_daily_week_${babyId}_${weekKey}`;

  return await loadWithRevalidate(
    cacheKey,
    async () => {
      const { data, error } = await getBabyCareEntriesForDateRange(
        weekStart,
        weekEnd,
        babyId
      );
      if (error) throw error;
      return mapCareToDaily(data ?? []);
    },
    CacheStrategy.MEDIUM // 2 Minuten
  );
}

/**
 * Load Month Entries mit Cache
 */
export async function loadMonthEntriesWithCache(
  monthDate: Date,
  babyId: string
): Promise<{
  data: any[] | null;
  isStale: boolean;
  refresh: () => Promise<any[]>;
}> {
  // Cache Key: Jahr-Monat
  const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const cacheKey = `screen_cache_daily_month_${babyId}_${monthKey}`;

  return await loadWithRevalidate(
    cacheKey,
    async () => {
      const { data, error } = await getBabyCareEntriesForMonth(monthDate, babyId);
      if (error) throw error;
      return mapCareToDaily(data ?? []);
    },
    CacheStrategy.LONG // 10 Minuten - Monatsdaten ändern sich selten
  );
}

/**
 * Invalidate ALL Daily Caches after User Actions
 *
 * Called after: Add, Update, Delete Entries
 */
export async function invalidateDailyCache(babyId: string): Promise<void> {
  await invalidateCacheAfterAction(`daily_day_${babyId}`);
  await invalidateCacheAfterAction(`daily_week_${babyId}`);
  await invalidateCacheAfterAction(`daily_month_${babyId}`);

  console.log('✅ Daily cache invalidated for baby:', babyId);
}

/**
 * Invalidate specific view cache
 */
export async function invalidateDayCache(date: Date, babyId: string): Promise<void> {
  const dateKey = date.toISOString().split('T')[0];
  const cacheKey = `screen_cache_daily_day_${babyId}_${dateKey}`;
  await invalidateCacheAfterAction(cacheKey);
}

export async function invalidateWeekCache(weekStart: Date, babyId: string): Promise<void> {
  const weekKey = weekStart.toISOString().split('T')[0];
  const cacheKey = `screen_cache_daily_week_${babyId}_${weekKey}`;
  await invalidateCacheAfterAction(cacheKey);
}

export async function invalidateMonthCache(monthDate: Date, babyId: string): Promise<void> {
  const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const cacheKey = `screen_cache_daily_month_${babyId}_${monthKey}`;
  await invalidateCacheAfterAction(cacheKey);
}
