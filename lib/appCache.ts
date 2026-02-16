/**
 * 🚀 APP CACHE - Zentrales Caching für häufig geladene Daten
 *
 * Optimiert Supabase-Aufrufe durch:
 * - In-Memory Cache für schnellen Zugriff
 * - AsyncStorage Persistenz für App-Neustarts
 * - Automatische Invalidierung nach TTL
 * - Preloading beim App-Start
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCachedUser } from './supabase';
import { hasRevenueCatEntitlement } from './revenuecat';

// Cache Keys
const CACHE_KEYS = {
  USER_SETTINGS: 'cache_user_settings',
  USER_PROFILE: 'cache_user_profile',
  BABY_LIST: 'cache_baby_list',
  ACTIVE_BABY: 'cache_active_baby',
  PREMIUM_STATUS: 'cache_premium_status',
  PAYWALL_STATE: 'cache_paywall_state',
} as const;

// Cache Durations (in Millisekunden)
const CACHE_DURATIONS = {
  USER_SETTINGS: 10 * 60 * 1000,    // 10 Minuten - ändert sich selten
  USER_PROFILE: 15 * 60 * 1000,     // 15 Minuten - ändert sich selten
  BABY_LIST: 5 * 60 * 1000,         // 5 Minuten - kann sich ändern
  ACTIVE_BABY: 5 * 60 * 1000,       // 5 Minuten
  PREMIUM_STATUS: 30 * 60 * 1000,   // 30 Minuten - ändert sich sehr selten
  PAYWALL_STATE: 5 * 60 * 1000,     // 5 Minuten
} as const;

// In-Memory Cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Generische Cache-Funktionen
 */
const isExpired = (entry: CacheEntry<any>): boolean => {
  return Date.now() - entry.timestamp > entry.ttl;
};

const getFromMemory = <T>(key: string): T | null => {
  const entry = memoryCache.get(key);
  if (entry && !isExpired(entry)) {
    return entry.data as T;
  }
  if (entry) {
    memoryCache.delete(key);
  }
  return null;
};

const setToMemory = <T>(key: string, data: T, ttl: number): void => {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
};

const getFromStorage = async <T>(key: string, ttl: number): Promise<T | null> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const { data, timestamp } = JSON.parse(stored);
    if (Date.now() - timestamp > ttl) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    // Auch in Memory-Cache laden
    setToMemory(key, data, ttl);
    return data as T;
  } catch {
    return null;
  }
};

const setToStorage = async <T>(key: string, data: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.warn('Cache storage error:', err);
  }
};

/**
 * User Settings Cache
 */
export interface UserSettings {
  theme?: string;
  notifications_enabled?: boolean;
  language?: string;
  paywall_last_shown_at?: string;
  [key: string]: any;
}

export const getCachedUserSettings = async (): Promise<UserSettings | null> => {
  const key = CACHE_KEYS.USER_SETTINGS;
  const ttl = CACHE_DURATIONS.USER_SETTINGS;

  // 1. Memory Cache
  const memory = getFromMemory<UserSettings>(key);
  if (memory) return memory;

  // 2. Storage Cache
  const storage = await getFromStorage<UserSettings>(key, ttl);
  if (storage) return storage;

  // 3. Fetch from Supabase
  const { data: userData } = await getCachedUser();
  if (!userData.user) return null;

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && (error as any).code !== 'PGRST116') {
      console.error('Failed to fetch user settings:', error);
      return null;
    }

    const settings = data || {};
    setToMemory(key, settings, ttl);
    await setToStorage(key, settings);

    return settings;
  } catch (err) {
    console.error('Error fetching user settings:', err);
    return null;
  }
};

export const invalidateUserSettingsCache = async (): Promise<void> => {
  memoryCache.delete(CACHE_KEYS.USER_SETTINGS);
  await AsyncStorage.removeItem(CACHE_KEYS.USER_SETTINGS);
};

/**
 * User Profile Cache
 */
export interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  due_date?: string;
  is_baby_born?: boolean;
  [key: string]: any;
}

export const getCachedUserProfile = async (): Promise<UserProfile | null> => {
  const key = CACHE_KEYS.USER_PROFILE;
  const ttl = CACHE_DURATIONS.USER_PROFILE;

  const memory = getFromMemory<UserProfile>(key);
  if (memory) return memory;

  const storage = await getFromStorage<UserProfile>(key, ttl);
  if (storage) return storage;

  const { data: userData } = await getCachedUser();
  if (!userData.user) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (error && (error as any).code !== 'PGRST116') {
      console.error('Failed to fetch user profile:', error);
      return null;
    }

    if (data) {
      setToMemory(key, data, ttl);
      await setToStorage(key, data);
    }

    return data;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
};

export const invalidateUserProfileCache = async (): Promise<void> => {
  memoryCache.delete(CACHE_KEYS.USER_PROFILE);
  await AsyncStorage.removeItem(CACHE_KEYS.USER_PROFILE);
};

/**
 * Premium Status Cache
 */
export interface PremiumStatus {
  isPro: boolean;
  checkedAt: number;
}

export const getCachedPremiumStatus = async (): Promise<boolean> => {
  const key = CACHE_KEYS.PREMIUM_STATUS;
  const ttl = CACHE_DURATIONS.PREMIUM_STATUS;

  const memory = getFromMemory<PremiumStatus>(key);
  if (memory) return memory.isPro;

  const storage = await getFromStorage<PremiumStatus>(key, ttl);
  if (storage) return storage.isPro;

  const { data: userData } = await getCachedUser();
  if (!userData.user) return false;

  try {
    const isPro = await hasRevenueCatEntitlement(userData.user.id);
    const status: PremiumStatus = { isPro, checkedAt: Date.now() };

    setToMemory(key, status, ttl);
    await setToStorage(key, status);

    return isPro;
  } catch (err) {
    console.error('Error checking premium status:', err);
    return false;
  }
};

export const invalidatePremiumStatusCache = async (): Promise<void> => {
  memoryCache.delete(CACHE_KEYS.PREMIUM_STATUS);
  await AsyncStorage.removeItem(CACHE_KEYS.PREMIUM_STATUS);
};

/**
 * Preload wichtige Daten beim App-Start
 * Rufe diese Funktion in _layout.tsx oder App.tsx auf
 */
export const preloadAppData = async (): Promise<void> => {
  const { data: userData } = await getCachedUser();
  if (!userData.user) return;

  // Parallel laden für bessere Performance
  await Promise.allSettled([
    getCachedUserSettings(),
    getCachedUserProfile(),
    getCachedPremiumStatus(),
  ]);

  // Bild-Cache bereinigen (alte Einträge löschen)
  try {
    const { cleanupCache } = await import('./imageCache');
    const result = await cleanupCache();
    if (result.removed > 0) {
      console.log(`Image cache cleanup: ${result.removed} files removed, ${result.freedMB.toFixed(2)} MB freed`);
    }
  } catch (err) {
    // imageCache ist optional
  }

  console.log('App data preloaded');
};

/**
 * Alle Caches invalidieren (z.B. bei Logout)
 */
export const invalidateAllCaches = async (): Promise<void> => {
  memoryCache.clear();

  await Promise.allSettled([
    AsyncStorage.removeItem(CACHE_KEYS.USER_SETTINGS),
    AsyncStorage.removeItem(CACHE_KEYS.USER_PROFILE),
    AsyncStorage.removeItem(CACHE_KEYS.BABY_LIST),
    AsyncStorage.removeItem(CACHE_KEYS.ACTIVE_BABY),
    AsyncStorage.removeItem(CACHE_KEYS.PREMIUM_STATUS),
    AsyncStorage.removeItem(CACHE_KEYS.PAYWALL_STATE),
  ]);

  console.log('All caches invalidated');
};

/**
 * Cache-Statistiken für Debugging
 */
export const getCacheStats = (): { memoryEntries: number; keys: string[] } => {
  return {
    memoryEntries: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  };
};
