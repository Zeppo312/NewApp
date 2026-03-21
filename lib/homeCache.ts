import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Home Cache Module
 *
 * Implementiert eine Cache-First-Strategie mit "Stale-While-Revalidate" Pattern:
 * 1. Zeige sofort gecachte Daten (instant load)
 * 2. Lade parallel neue Daten von Supabase
 * 3. Aktualisiere UI wenn neue Daten verfügbar sind
 *
 * Offline-Support: App funktioniert auch ohne Internet mit gecachten Daten
 */

const CACHE_VERSION = '1.1.0';

export interface HomeCacheScope {
  userId?: string | null;
  babyId?: string | null;
  dateKey?: string | null;
}

const parseCachedValue = <T>(value: string | null, fallback: T): T => {
  if (value === null) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Failed to parse cached home data entry:', error);
    return fallback;
  }
};
const CACHE_KEYS = {
  BABY_INFO: 'home_cache_baby_info',
  DIARY_ENTRIES: 'home_cache_diary_entries',
  DAILY_ENTRIES: 'home_cache_daily_entries',
  SLEEP_MINUTES: 'home_cache_sleep_minutes',
  CURRENT_PHASE: 'home_cache_current_phase',
  PHASE_PROGRESS: 'home_cache_phase_progress',
  MILESTONES: 'home_cache_milestones',
  RECOMMENDATIONS: 'home_cache_recommendations',
  USER_NAME: 'home_cache_user_name',
  VERSION: 'home_cache_version',
  LAST_UPDATE: 'home_cache_last_update',
} as const;

const buildScopeSuffix = (scope?: HomeCacheScope): string => {
  const userPart = scope?.userId?.trim() || 'anonymous';
  const babyPart = scope?.babyId?.trim() || 'no-baby';
  const datePart = scope?.dateKey?.trim() || 'no-date';
  return `${userPart}:${babyPart}:${datePart}`;
};

const scopedKey = (key: string, scope?: HomeCacheScope): string => `${key}:${buildScopeSuffix(scope)}`;

export interface CachedHomeData {
  babyInfo: any;
  diaryEntries: any[];
  dailyEntries: any[];
  todaySleepMinutes: number;
  currentPhase: any;
  phaseProgress: any;
  milestones: any[];
  recommendations: any[];
  userName: string;
  lastUpdate: string;
}

/**
 * Speichere alle Home-Daten im Cache
 */
export async function cacheHomeData(data: Partial<CachedHomeData>, scope?: HomeCacheScope): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const entries: [string, string][] = [
      [scopedKey(CACHE_KEYS.VERSION, scope), CACHE_VERSION],
      [scopedKey(CACHE_KEYS.LAST_UPDATE, scope), timestamp],
    ];

    // Nur definierte Felder cachen
    if (data.babyInfo !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.BABY_INFO, scope), JSON.stringify(data.babyInfo)]);
    }
    if (data.diaryEntries !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.DIARY_ENTRIES, scope), JSON.stringify(data.diaryEntries)]);
    }
    if (data.dailyEntries !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.DAILY_ENTRIES, scope), JSON.stringify(data.dailyEntries)]);
    }
    if (data.todaySleepMinutes !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.SLEEP_MINUTES, scope), JSON.stringify(data.todaySleepMinutes)]);
    }
    if (data.currentPhase !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.CURRENT_PHASE, scope), JSON.stringify(data.currentPhase)]);
    }
    if (data.phaseProgress !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.PHASE_PROGRESS, scope), JSON.stringify(data.phaseProgress)]);
    }
    if (data.milestones !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.MILESTONES, scope), JSON.stringify(data.milestones)]);
    }
    if (data.recommendations !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.RECOMMENDATIONS, scope), JSON.stringify(data.recommendations)]);
    }
    if (data.userName !== undefined) {
      entries.push([scopedKey(CACHE_KEYS.USER_NAME, scope), JSON.stringify(data.userName)]);
    }

    await AsyncStorage.multiSet(entries);
  } catch (error) {
    console.error('Failed to cache home data:', error);
    // Fail silently - caching ist optional
  }
}

/**
 * Lade gecachte Home-Daten
 */
export async function loadCachedHomeData(scope?: HomeCacheScope): Promise<CachedHomeData | null> {
  try {
    const keys = [
      scopedKey(CACHE_KEYS.VERSION, scope),
      scopedKey(CACHE_KEYS.LAST_UPDATE, scope),
      scopedKey(CACHE_KEYS.BABY_INFO, scope),
      scopedKey(CACHE_KEYS.DIARY_ENTRIES, scope),
      scopedKey(CACHE_KEYS.DAILY_ENTRIES, scope),
      scopedKey(CACHE_KEYS.SLEEP_MINUTES, scope),
      scopedKey(CACHE_KEYS.CURRENT_PHASE, scope),
      scopedKey(CACHE_KEYS.PHASE_PROGRESS, scope),
      scopedKey(CACHE_KEYS.MILESTONES, scope),
      scopedKey(CACHE_KEYS.RECOMMENDATIONS, scope),
      scopedKey(CACHE_KEYS.USER_NAME, scope),
    ];

    const values = await AsyncStorage.multiGet(keys);
    const cache = Object.fromEntries(values);

    // Prüfe Cache-Version
    const version = cache[scopedKey(CACHE_KEYS.VERSION, scope)];
    if (version !== CACHE_VERSION) {
      console.log('Cache version mismatch, clearing cache');
      await clearHomeCache(scope);
      return null;
    }

    // Prüfe ob Cache existiert
    const lastUpdate = cache[scopedKey(CACHE_KEYS.LAST_UPDATE, scope)];
    if (!lastUpdate) {
      return null;
    }

    // Parse gecachte Daten
    const babyInfo = parseCachedValue(cache[scopedKey(CACHE_KEYS.BABY_INFO, scope)] ?? null, null);
    const diaryEntries = parseCachedValue(cache[scopedKey(CACHE_KEYS.DIARY_ENTRIES, scope)] ?? null, []);
    const dailyEntries = parseCachedValue(cache[scopedKey(CACHE_KEYS.DAILY_ENTRIES, scope)] ?? null, []);
    const todaySleepMinutes = parseCachedValue(cache[scopedKey(CACHE_KEYS.SLEEP_MINUTES, scope)] ?? null, 0);
    const currentPhase = parseCachedValue(cache[scopedKey(CACHE_KEYS.CURRENT_PHASE, scope)] ?? null, null);
    const phaseProgress = parseCachedValue(cache[scopedKey(CACHE_KEYS.PHASE_PROGRESS, scope)] ?? null, null);
    const milestones = parseCachedValue(cache[scopedKey(CACHE_KEYS.MILESTONES, scope)] ?? null, []);
    const recommendations = parseCachedValue(cache[scopedKey(CACHE_KEYS.RECOMMENDATIONS, scope)] ?? null, []);
    const userName = parseCachedValue(cache[scopedKey(CACHE_KEYS.USER_NAME, scope)] ?? null, '');

    return {
      babyInfo,
      diaryEntries,
      dailyEntries,
      todaySleepMinutes,
      currentPhase,
      phaseProgress,
      milestones,
      recommendations,
      userName,
      lastUpdate,
    };
  } catch (error) {
    console.error('Failed to load cached home data:', error);
    return null;
  }
}

/**
 * Lösche alle gecachten Home-Daten
 */
export async function clearHomeCache(scope?: HomeCacheScope): Promise<void> {
  try {
    const keys = Object.values(CACHE_KEYS).map((key) => scopedKey(key, scope));
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error('Failed to clear home cache:', error);
  }
}

/**
 * Prüfe ob Cache "frisch" ist (< 5 Minuten alt)
 */
export function isCacheFresh(lastUpdate: string): boolean {
  const FRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 Minuten
  const cacheAge = Date.now() - new Date(lastUpdate).getTime();
  return cacheAge < FRESH_THRESHOLD_MS;
}

/**
 * Debug: Zeige Cache-Info
 */
export async function getCacheInfo(): Promise<{
  version: string | null;
  lastUpdate: string | null;
  size: number;
}> {
  try {
    const keys = Object.values(CACHE_KEYS).map((key) => scopedKey(key));
    const values = await AsyncStorage.multiGet(keys);
    const cache = Object.fromEntries(values);

    const version = cache[scopedKey(CACHE_KEYS.VERSION)] || null;
    const lastUpdate = cache[scopedKey(CACHE_KEYS.LAST_UPDATE)] || null;
    const size = values.filter(([_, value]) => value !== null).length;

    return { version, lastUpdate, size };
  } catch (error) {
    console.error('Failed to get cache info:', error);
    return { version: null, lastUpdate: null, size: 0 };
  }
}
