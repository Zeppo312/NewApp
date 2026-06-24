/**
 * useLottiWeek
 *
 * Liefert den sanften Wochenfortschritt für die "Lotti-Woche":
 * Essen (baby_care_entries.feeding_type), Pflege (baby_care_entries.diaper_type),
 * Schlafen (sleep_entries) — pro Woche von Montag 00:00 bis Sonntag 23:59 lokal.
 *
 * MVP: Aggregation direkt aus den bestehenden Supabase-Tabellen,
 * keine eigene lotti_moments-Tabelle.
 */

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, getCachedUser } from '@/lib/supabase';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import {
  computeDayPoints,
  type DayCounts,
  type DayPointBreakdown,
} from '@/lib/lottiPoints';

export type LottiArea = 'feeding' | 'care' | 'sleep';

export type LottiWeekData = {
  weekStart: Date;
  weekEnd: Date;
  // Bereiche (für Detailseite)
  areas: Record<LottiArea, boolean>;
  counts: Record<LottiArea, number>;
  activeAreas: number;
  totalAreas: 3;
  totalSleepMinutes: number;
  // Tage (für Home-Karte) — Mo..So
  days: boolean[];
  activeDays: number;
  totalDays: 7;
  /** 0 = Montag … 6 = Sonntag. -1 wenn heute außerhalb der Woche liegt. */
  todayIndex: number;
  // Lotti-Punkte dieser Woche
  /** Counts pro Tag (Mo..So). Eintragsanzahlen, ohne Caps. */
  dayBuckets: DayCounts[];
  /** Punkte pro Tag (Mo..So) — bereits mit Caps und Bonus. */
  dayPoints: DayPointBreakdown[];
  /** Summe der Wochenpunkte. */
  weekPoints: number;
};

const TOTAL_AREAS = 3 as const;
const TOTAL_DAYS = 7 as const;

/**
 * Wochenstart auf Montag 00:00 (lokale Zeit) — passend für Deutschland.
 */
export function getWeekStartMonday(reference: Date = new Date()): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sonntag, 1=Montag, ..., 6=Samstag
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export function getWeekEndSunday(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

const computeTodayIndex = (weekStart: Date): number => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const idx = Math.floor(
    (startOfToday.getTime() - weekStart.getTime()) / 86400000,
  );
  return idx >= 0 && idx < TOTAL_DAYS ? idx : -1;
};

const emptyDayBuckets = (): DayCounts[] =>
  Array.from({ length: TOTAL_DAYS }, () => ({
    feedingCount: 0,
    careCount: 0,
    sleepCount: 0,
  }));

const emptyDayPoints = (): DayPointBreakdown[] =>
  Array.from({ length: TOTAL_DAYS }, () => ({
    feeding: 0,
    care: 0,
    sleep: 0,
    bonus: 0,
    total: 0,
  }));

const emptyData = (weekStart: Date, weekEnd: Date): LottiWeekData => ({
  weekStart,
  weekEnd,
  areas: { feeding: false, care: false, sleep: false },
  counts: { feeding: 0, care: 0, sleep: 0 },
  activeAreas: 0,
  totalAreas: TOTAL_AREAS,
  totalSleepMinutes: 0,
  days: [false, false, false, false, false, false, false],
  activeDays: 0,
  totalDays: TOTAL_DAYS,
  todayIndex: computeTodayIndex(weekStart),
  dayBuckets: emptyDayBuckets(),
  dayPoints: emptyDayPoints(),
  weekPoints: 0,
});

export function useLottiWeek() {
  const { activeBabyId, isReady } = useActiveBaby();
  const [data, setData] = useState<LottiWeekData>(() => {
    const ws = getWeekStartMonday();
    return emptyData(ws, getWeekEndSunday(ws));
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const weekStart = getWeekStartMonday();
    const weekEnd = getWeekEndSunday(weekStart);

    setError(null);

    const { data: userData } = await getCachedUser();
    const userId = userData?.user?.id;
    if (!userId) {
      setData(emptyData(weekStart, weekEnd));
      setIsLoading(false);
      return;
    }

    try {
      const startISO = weekStart.toISOString();
      const endISO = weekEnd.toISOString();

      let careQuery = supabase
        .from('baby_care_entries')
        .select('feeding_type, diaper_type, start_time')
        .gte('start_time', startISO)
        .lte('start_time', endISO);

      if (activeBabyId) {
        careQuery = careQuery.eq('baby_id', activeBabyId);
      } else {
        careQuery = careQuery.eq('user_id', userId);
      }

      let sleepQuery = supabase
        .from('sleep_entries')
        .select('start_time, duration_minutes')
        .or(
          `user_id.eq.${userId},partner_id.eq.${userId},shared_with_user_id.eq.${userId}`,
        )
        .gte('start_time', startISO)
        .lte('start_time', endISO);

      if (activeBabyId) {
        sleepQuery = sleepQuery.eq('baby_id', activeBabyId);
      }

      const [careRes, sleepRes] = await Promise.all([careQuery, sleepQuery]);

      if (careRes.error) throw careRes.error;
      if (sleepRes.error) throw sleepRes.error;

      let feedingCount = 0;
      let careCount = 0;
      const days = [false, false, false, false, false, false, false];
      const dayBuckets = emptyDayBuckets();

      const dayIndexOf = (iso: string | null | undefined): number => {
        if (!iso) return -1;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return -1;
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const idx = Math.floor(
          (startOfDay.getTime() - weekStart.getTime()) / 86400000,
        );
        return idx >= 0 && idx < TOTAL_DAYS ? idx : -1;
      };

      for (const row of careRes.data ?? []) {
        const idx = dayIndexOf(row.start_time);
        if (row.feeding_type) {
          feedingCount += 1;
          if (idx >= 0) {
            days[idx] = true;
            dayBuckets[idx].feedingCount += 1;
          }
        }
        if (row.diaper_type) {
          careCount += 1;
          if (idx >= 0) {
            days[idx] = true;
            dayBuckets[idx].careCount += 1;
          }
        }
      }

      const sleepRows = sleepRes.data ?? [];
      const sleepCount = sleepRows.length;
      const totalSleepMinutes = sleepRows.reduce(
        (sum, row) => sum + (typeof row.duration_minutes === 'number' ? row.duration_minutes : 0),
        0,
      );
      for (const row of sleepRows) {
        const idx = dayIndexOf(row.start_time);
        if (idx >= 0) {
          days[idx] = true;
          dayBuckets[idx].sleepCount += 1;
        }
      }

      const areas = {
        feeding: feedingCount > 0,
        care: careCount > 0,
        sleep: sleepCount > 0,
      };
      const activeAreas = Object.values(areas).filter(Boolean).length;
      const activeDays = days.filter(Boolean).length;

      const dayPoints = dayBuckets.map((b) => computeDayPoints(b));
      const weekPoints = dayPoints.reduce((sum, dp) => sum + dp.total, 0);

      setData({
        weekStart,
        weekEnd,
        areas,
        counts: { feeding: feedingCount, care: careCount, sleep: sleepCount },
        activeAreas,
        totalAreas: TOTAL_AREAS,
        totalSleepMinutes,
        days,
        activeDays,
        totalDays: TOTAL_DAYS,
        todayIndex: computeTodayIndex(weekStart),
        dayBuckets,
        dayPoints,
        weekPoints,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
      setData(emptyData(weekStart, weekEnd));
    } finally {
      setIsLoading(false);
    }
  }, [activeBabyId]);

  useEffect(() => {
    if (!isReady) return;
    setIsLoading(true);
    load();
  }, [isReady, load]);

  useFocusEffect(
    useCallback(() => {
      if (!isReady) return;
      load();
    }, [isReady, load]),
  );

  return {
    ...data,
    isLoading,
    error,
    refresh: load,
  };
}
