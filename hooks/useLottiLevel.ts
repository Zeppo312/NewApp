/**
 * useLottiLevel
 *
 * Liefert die langfristige Lotti-Stufe + Gesamtpunkte (all-time).
 *
 * MVP: Aggregation aus den bestehenden Tabellen, ohne neue Progress-Tabelle.
 * Lädt bis zu FETCH_LIMIT Einträge pro Tabelle und gruppiert clientseitig
 * nach Kalendertag — Caps werden in `computeDayPoints` angewandt.
 *
 * HINWEIS für später:
 *   Wenn ein/e Nutzer/in mehrere Monate Daten hat, sollte das auf eine
 *   kleine `lotti_progress_daily`-Tabelle (date, baby_id, feeding_pts,
 *   care_pts, sleep_pts, bonus_pts) umgestellt werden — per Trigger oder
 *   Upsert beim Insert. Bis dahin reicht die clientseitige Aggregation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCachedUser } from '@/lib/supabase';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import {
  aggregateEntriesByDay,
  computeLevelInfo,
  sumDayPointsAcrossMap,
  type LottiLevelInfo,
} from '@/lib/lottiPoints';

const FETCH_LIMIT = 10000;
const LAST_SEEN_LEVEL_KEY = (babyId: string | null | undefined) =>
  `lotti_last_seen_level:${babyId ?? 'default'}`;
const LEVEL_UP_DISPLAY_MS = 5500;

export type LottiLevelData = {
  totalPoints: number;
  level: LottiLevelInfo;
  /** true für ~5,5 Sekunden, nachdem ein Level-Up erkannt wurde */
  levelJustIncreased: boolean;
  /** sofort manuell „gesehen" markieren (z. B. nach Tap auf Glow) */
  acknowledgeLevelUp: () => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const initialLevel: LottiLevelInfo = computeLevelInfo(0);

export function useLottiLevel(): LottiLevelData {
  const { activeBabyId, isReady } = useActiveBaby();
  const [totalPoints, setTotalPoints] = useState(0);
  const [level, setLevel] = useState<LottiLevelInfo>(initialLevel);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelJustIncreased, setLevelJustIncreased] = useState(false);
  const levelUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acknowledgeLevelUp = useCallback(() => {
    if (levelUpTimerRef.current) {
      clearTimeout(levelUpTimerRef.current);
      levelUpTimerRef.current = null;
    }
    setLevelJustIncreased(false);
  }, []);

  // Cleanup beim Unmount.
  useEffect(() => {
    return () => {
      if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    };
  }, []);

  // Vergleicht das gerade berechnete Level mit dem zuletzt gesehenen
  // (persistiert in AsyncStorage). Beim ersten Mal wird nur gespeichert,
  // ohne Animation auszulösen.
  const checkLevelUp = useCallback(
    async (newLevel: number, babyKey: string | null) => {
      try {
        const key = LAST_SEEN_LEVEL_KEY(babyKey);
        const stored = await AsyncStorage.getItem(key);

        if (stored === null) {
          await AsyncStorage.setItem(key, String(newLevel));
          return;
        }

        const prev = parseInt(stored, 10);
        if (Number.isFinite(prev) && newLevel > prev) {
          setLevelJustIncreased(true);
          if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
          levelUpTimerRef.current = setTimeout(() => {
            setLevelJustIncreased(false);
            levelUpTimerRef.current = null;
          }, LEVEL_UP_DISPLAY_MS);
          await AsyncStorage.setItem(key, String(newLevel));
        } else if (Number.isFinite(prev) && newLevel < prev) {
          // Z. B. bei Baby-Wechsel: nur den gespeicherten Wert anpassen,
          // nichts anzeigen.
          await AsyncStorage.setItem(key, String(newLevel));
        }
      } catch {
        // Stillschweigend ignorieren — Persistenz ist optional.
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setError(null);

    const { data: userData } = await getCachedUser();
    const userId = userData?.user?.id;
    if (!userId) {
      setTotalPoints(0);
      setLevel(initialLevel);
      setIsLoading(false);
      return;
    }

    try {
      let careQuery = supabase
        .from('baby_care_entries')
        .select('feeding_type, diaper_type, start_time')
        .limit(FETCH_LIMIT);

      if (activeBabyId) {
        careQuery = careQuery.eq('baby_id', activeBabyId);
      } else {
        careQuery = careQuery.eq('user_id', userId);
      }

      let sleepQuery = supabase
        .from('sleep_entries')
        .select('start_time')
        .or(
          `user_id.eq.${userId},partner_id.eq.${userId},shared_with_user_id.eq.${userId}`,
        )
        .limit(FETCH_LIMIT);

      if (activeBabyId) {
        sleepQuery = sleepQuery.eq('baby_id', activeBabyId);
      }

      const [careRes, sleepRes] = await Promise.all([careQuery, sleepQuery]);
      if (careRes.error) throw careRes.error;
      if (sleepRes.error) throw sleepRes.error;

      const rows = [
        ...((careRes.data ?? []).map((r) => ({
          start_time: r.start_time,
          feeding: !!r.feeding_type,
          care: !!r.diaper_type,
        }))),
        ...((sleepRes.data ?? []).map((r) => ({
          start_time: r.start_time,
          sleep: true,
        }))),
      ];

      const map = aggregateEntriesByDay(rows);
      const total = sumDayPointsAcrossMap(map);
      const nextLevel = computeLevelInfo(total);

      setTotalPoints(total);
      setLevel(nextLevel);
      void checkLevelUp(nextLevel.level, activeBabyId ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
      setTotalPoints(0);
      setLevel(initialLevel);
    } finally {
      setIsLoading(false);
    }
  }, [activeBabyId, checkLevelUp]);

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
    totalPoints,
    level,
    levelJustIncreased,
    acknowledgeLevelUp,
    isLoading,
    error,
    refresh: load,
  };
}
