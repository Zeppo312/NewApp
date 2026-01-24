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

const CACHE_VERSION = '1.0.0';
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
export async function cacheHomeData(data: Partial<CachedHomeData>): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const entries: [string, string][] = [
      [CACHE_KEYS.VERSION, CACHE_VERSION],
      [CACHE_KEYS.LAST_UPDATE, timestamp],
    ];

    // Nur definierte Felder cachen
    if (data.babyInfo !== undefined) {
      entries.push([CACHE_KEYS.BABY_INFO, JSON.stringify(data.babyInfo)]);
    }
    if (data.diaryEntries !== undefined) {
      entries.push([CACHE_KEYS.DIARY_ENTRIES, JSON.stringify(data.diaryEntries)]);
    }
    if (data.dailyEntries !== undefined) {
      entries.push([CACHE_KEYS.DAILY_ENTRIES, JSON.stringify(data.dailyEntries)]);
    }
    if (data.todaySleepMinutes !== undefined) {
      entries.push([CACHE_KEYS.SLEEP_MINUTES, JSON.stringify(data.todaySleepMinutes)]);
    }
    if (data.currentPhase !== undefined) {
      entries.push([CACHE_KEYS.CURRENT_PHASE, JSON.stringify(data.currentPhase)]);
    }
    if (data.phaseProgress !== undefined) {
      entries.push([CACHE_KEYS.PHASE_PROGRESS, JSON.stringify(data.phaseProgress)]);
    }
    if (data.milestones !== undefined) {
      entries.push([CACHE_KEYS.MILESTONES, JSON.stringify(data.milestones)]);
    }
    if (data.recommendations !== undefined) {
      entries.push([CACHE_KEYS.RECOMMENDATIONS, JSON.stringify(data.recommendations)]);
    }
    if (data.userName !== undefined) {
      entries.push([CACHE_KEYS.USER_NAME, JSON.stringify(data.userName)]);
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
export async function loadCachedHomeData(): Promise<CachedHomeData | null> {
  try {
    const keys = [
      CACHE_KEYS.VERSION,
      CACHE_KEYS.LAST_UPDATE,
      CACHE_KEYS.BABY_INFO,
      CACHE_KEYS.DIARY_ENTRIES,
      CACHE_KEYS.DAILY_ENTRIES,
      CACHE_KEYS.SLEEP_MINUTES,
      CACHE_KEYS.CURRENT_PHASE,
      CACHE_KEYS.PHASE_PROGRESS,
      CACHE_KEYS.MILESTONES,
      CACHE_KEYS.RECOMMENDATIONS,
      CACHE_KEYS.USER_NAME,
    ];

    const values = await AsyncStorage.multiGet(keys);
    const cache = Object.fromEntries(values);

    // Prüfe Cache-Version
    const version = cache[CACHE_KEYS.VERSION];
    if (version !== CACHE_VERSION) {
      console.log('Cache version mismatch, clearing cache');
      await clearHomeCache();
      return null;
    }

    // Prüfe ob Cache existiert
    const lastUpdate = cache[CACHE_KEYS.LAST_UPDATE];
    if (!lastUpdate) {
      return null;
    }

    // Parse gecachte Daten
    const babyInfo = cache[CACHE_KEYS.BABY_INFO]
      ? JSON.parse(cache[CACHE_KEYS.BABY_INFO])
      : null;
    const diaryEntries = cache[CACHE_KEYS.DIARY_ENTRIES]
      ? JSON.parse(cache[CACHE_KEYS.DIARY_ENTRIES])
      : [];
    const dailyEntries = cache[CACHE_KEYS.DAILY_ENTRIES]
      ? JSON.parse(cache[CACHE_KEYS.DAILY_ENTRIES])
      : [];
    const todaySleepMinutes = cache[CACHE_KEYS.SLEEP_MINUTES]
      ? JSON.parse(cache[CACHE_KEYS.SLEEP_MINUTES])
      : 0;
    const currentPhase = cache[CACHE_KEYS.CURRENT_PHASE]
      ? JSON.parse(cache[CACHE_KEYS.CURRENT_PHASE])
      : null;
    const phaseProgress = cache[CACHE_KEYS.PHASE_PROGRESS]
      ? JSON.parse(cache[CACHE_KEYS.PHASE_PROGRESS])
      : null;
    const milestones = cache[CACHE_KEYS.MILESTONES]
      ? JSON.parse(cache[CACHE_KEYS.MILESTONES])
      : [];
    const recommendations = cache[CACHE_KEYS.RECOMMENDATIONS]
      ? JSON.parse(cache[CACHE_KEYS.RECOMMENDATIONS])
      : [];
    const userName = cache[CACHE_KEYS.USER_NAME]
      ? JSON.parse(cache[CACHE_KEYS.USER_NAME])
      : '';

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
export async function clearHomeCache(): Promise<void> {
  try {
    const keys = Object.values(CACHE_KEYS);
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
    const keys = Object.values(CACHE_KEYS);
    const values = await AsyncStorage.multiGet(keys);
    const cache = Object.fromEntries(values);

    const version = cache[CACHE_KEYS.VERSION] || null;
    const lastUpdate = cache[CACHE_KEYS.LAST_UPDATE] || null;
    const size = values.filter(([_, value]) => value !== null).length;

    return { version, lastUpdate, size };
  } catch (error) {
    console.error('Failed to get cache info:', error);
    return { version: null, lastUpdate: null, size: 0 };
  }
}
