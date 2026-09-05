/**
 * useWeekHeartsClaim
 *
 * „Herzen einsammeln" — rein zelebrierender Claim-Moment für die Wochenpunkte.
 * Die Punkte zählen unabhängig davon fürs Level (kein Verlust, kein Druck);
 * hier wird nur persistiert, wie viele Herzen der aktuellen Woche bereits
 * feierlich abgeholt wurden, damit der Button den Rest anbieten kann.
 *
 * Persistenz: AsyncStorage pro Baby + Wochenstart (Mo), z. B.
 *   lotti_week_claimed:<babyId>:2026-07-06 → "43"
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';

const CLAIM_KEY = (babyId: string | null | undefined, weekKey: string) =>
  `lotti_week_claimed:${babyId ?? 'default'}:${weekKey}`;

const weekKeyOf = (weekStart: Date): string => {
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export type WeekHeartsClaim = {
  /** Bereits eingesammelte Herzen dieser Woche. */
  claimedPoints: number;
  /** Noch einsammelbare Herzen (weekPoints - claimed, nie negativ). */
  claimable: number;
  /** true sobald der persistierte Stand geladen ist. */
  isLoaded: boolean;
  /** Sammelt alle aktuell offenen Herzen ein; liefert die Anzahl zurück. */
  claim: () => Promise<number>;
};

export function useWeekHeartsClaim(
  weekStart: Date,
  weekPoints: number,
): WeekHeartsClaim {
  const { activeBabyId } = useActiveBaby();
  const [claimedPoints, setClaimedPoints] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const weekKey = weekKeyOf(weekStart);
  const storageKey = CLAIM_KEY(activeBabyId, weekKey);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (cancelled) return;
        const parsed = stored === null ? 0 : parseInt(stored, 10);
        setClaimedPoints(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
        setIsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setClaimedPoints(0);
        setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const claimable = isLoaded ? Math.max(0, weekPoints - claimedPoints) : 0;

  const claim = useCallback(async (): Promise<number> => {
    const amount = Math.max(0, weekPoints - claimedPoints);
    if (amount <= 0) return 0;
    setClaimedPoints(weekPoints);
    try {
      await AsyncStorage.setItem(storageKey, String(weekPoints));
    } catch {
      // Persistenz ist optional — der Claim bleibt für die Session bestehen.
    }
    return amount;
  }, [storageKey, weekPoints, claimedPoints]);

  return { claimedPoints, claimable, isLoaded, claim };
}
