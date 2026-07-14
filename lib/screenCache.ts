import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Intelligentes Screen Cache System
 *
 * WICHTIG: Unterscheidet zwischen LIVE und STATISCHEN Daten!
 *
 * Beispiel Sleep Tracker:
 * - LIVE (nicht cachen): Aktuell laufender Sleep, Timer-Status
 * - STATISCH (cachen): Vergangene Sleep Entries, Statistics
 *
 * Cache Invalidation:
 * - Nach User Actions (Sleep starten/stoppen) → Cache löschen
 * - Bei Screen Focus → Prüfen ob Cache noch gültig
 */

const CACHE_VERSION = '1.0.0';
const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 Minuten

// Cache-Strategie für verschiedene Datentypen
export enum CacheStrategy {
  NEVER = 'never',           // Nie cachen (Live-Daten wie Timer)
  SHORT = 'short',           // 30 Sekunden (häufig geändert)
  MEDIUM = 'medium',         // 2 Minuten (normal)
  LONG = 'long',             // 10 Minuten (selten geändert)
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  strategy: CacheStrategy;
}

/**
 * Speichere Daten im Cache mit Strategie
 */
export async function cacheData<T>(
  key: string,
  data: T,
  strategy: CacheStrategy = CacheStrategy.MEDIUM
): Promise<void> {
  // NEVER Strategy: Nicht cachen
  if (strategy === CacheStrategy.NEVER) {
    return;
  }

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      strategy,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error(`Failed to cache data for ${key}:`, error);
  }
}

/**
 * Lade Daten aus dem Cache (berücksichtigt Strategy)
 */
export async function loadCachedData<T>(key: string): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);

    // Prüfe Version
    if (entry.version !== CACHE_VERSION) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    // Prüfe Alter basierend auf Strategy
    const age = Date.now() - entry.timestamp;
    const maxAge = getMaxAgeForStrategy(entry.strategy);

    if (age > maxAge) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error(`Failed to load cached data for ${key}:`, error);
    return null;
  }
}

function getMaxAgeForStrategy(strategy: CacheStrategy): number {
  switch (strategy) {
    case CacheStrategy.SHORT:
      return 30 * 1000; // 30 Sekunden
    case CacheStrategy.MEDIUM:
      return 2 * 60 * 1000; // 2 Minuten
    case CacheStrategy.LONG:
      return 10 * 60 * 1000; // 10 Minuten
    case CacheStrategy.NEVER:
    default:
      return 0;
  }
}

/**
 * Prüfe ob Cache frisch ist (< 30 Sekunden)
 */
export async function isCacheFresh(key: string): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return false;

    const entry: CacheEntry<any> = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;
    return age < 30000; // 30 Sekunden
  } catch {
    return false;
  }
}

/**
 * Lösche Cache für einen Key
 */
export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear cache for ${key}:`, error);
  }
}

/**
 * Lösche alle Caches
 */
export async function clearAllCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith('screen_cache_'));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Failed to clear all caches:', error);
  }
}

/**
 * Stale-While-Revalidate Pattern
 *
 * 1. Zeige sofort gecachte Daten (instant load)
 * 2. Lade parallel frische Daten
 * 3. Update UI wenn frische Daten da sind
 *
 * Beispiel:
 * const { data, isStale, refresh } = await loadWithRevalidate(
 *   'sleep_history',
 *   () => supabase.from('sleep_entries').select(),
 *   CacheStrategy.MEDIUM
 * );
 */
export async function loadWithRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  strategy: CacheStrategy = CacheStrategy.MEDIUM
): Promise<{
  data: T | null;
  isStale: boolean;
  refresh: () => Promise<T>;
}> {
  // Versuche Cache zu laden
  const cached = await loadCachedData<T>(key);

  // Refresh-Funktion
  const refresh = async (): Promise<T> => {
    const fresh = await fetchFn();
    await cacheData(key, fresh, strategy);
    return fresh;
  };

  // Wenn Cache existiert, gib ihn sofort zurück
  if (cached) {
    return {
      data: cached,
      isStale: true,
      refresh,
    };
  }

  // Kein Cache: Lade frische Daten
  const fresh = await refresh();
  return {
    data: fresh,
    isStale: false,
    refresh,
  };
}

/**
 * Cache Invalidation nach User Actions
 *
 * Beispiel: Nach Sleep Start/Stop → Cache löschen
 * await invalidateCacheAfterAction('sleep_tracker');
 */
export async function invalidateCacheAfterAction(
  screenKey: string
): Promise<void> {
  const patterns = [
    `screen_cache_${screenKey}`,
    `screen_cache_${screenKey}_*`,
  ];

  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(key =>
      patterns.some(pattern => {
        if (pattern.endsWith('*')) {
          return key.startsWith(pattern.slice(0, -1));
        }
        return key === pattern;
      })
    );

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
      console.log(`Invalidated ${toRemove.length} cache entries for ${screenKey}`);
    }
  } catch (error) {
    console.error(`Failed to invalidate cache for ${screenKey}:`, error);
  }
}
