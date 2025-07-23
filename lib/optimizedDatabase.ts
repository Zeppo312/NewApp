import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEYS = {
  USER_PROFILE: 'cached_user_profile',
  SLEEP_ENTRIES: 'cached_sleep_entries',
  LINKED_USERS: 'cached_linked_users',
  COMMUNITY_POSTS: 'cached_community_posts',
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Generic cache utility
class CacheManager {
  private static async setCache<T>(key: string, data: T): Promise<void> {
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  private static async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheEntry: CacheEntry<T> = JSON.parse(cached);
      const isExpired = Date.now() - cacheEntry.timestamp > CACHE_DURATION;

      if (isExpired) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.warn('Failed to get cached data:', error);
      return null;
    }
  }

  static async clearCache(): Promise<void> {
    try {
      const keys = Object.values(CACHE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  // User profile optimized fetch
  static async getUserProfile(userId: string) {
    const cacheKey = `${CACHE_KEYS.USER_PROFILE}_${userId}`;
    let profile = await this.getCache(cacheKey);

    if (!profile) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      profile = data;
      await this.setCache(cacheKey, profile);
    }

    return profile;
  }

  // Batch fetch sleep entries with caching
  static async getSleepEntries(userId: string, limit = 50) {
    const cacheKey = `${CACHE_KEYS.SLEEP_ENTRIES}_${userId}_${limit}`;
    let entries = await this.getCache(cacheKey);

    if (!entries) {
      const { data, error } = await supabase
        .from('sleep_entries')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      entries = data;
      await this.setCache(cacheKey, entries);
    }

    return entries;
  }

  // Optimized linked users fetch
  static async getLinkedUsers(userId: string) {
    const cacheKey = `${CACHE_KEYS.LINKED_USERS}_${userId}`;
    let linkedUsers = await this.getCache(cacheKey);

    if (!linkedUsers) {
      const { data, error } = await supabase
        .from('user_links')
        .select(`
          linked_user_id,
          profiles!user_links_linked_user_id_fkey (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      linkedUsers = data;
      await this.setCache(cacheKey, linkedUsers);
    }

    return linkedUsers;
  }

  // Invalidate specific cache
  static async invalidateCache(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to invalidate cache:', error);
    }
  }
}

// Optimized query builders
export class DatabaseOptimizer {
  // Batch insert/update operations
  static async batchUpsert(table: string, data: any[], conflictColumns: string[] = ['id']) {
    const { data: result, error } = await supabase
      .from(table)
      .upsert(data, {
        onConflict: conflictColumns.join(','),
        ignoreDuplicates: false
      });

    if (error) throw error;
    return result;
  }

  // Optimized pagination
  static async getPaginatedData(
    table: string,
    options: {
      page: number;
      pageSize: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      filters?: Record<string, any>;
      select?: string;
    }
  ) {
    const { page, pageSize, orderBy = 'created_at', orderDirection = 'desc', filters = {}, select = '*' } = options;
    
    let query = supabase
      .from(table)
      .select(select, { count: 'exact' })
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data,
      count,
      hasMore: count ? (page + 1) * pageSize < count : false,
      totalPages: count ? Math.ceil(count / pageSize) : 0
    };
  }

  // Optimized real-time subscriptions
  static createOptimizedSubscription(
    table: string,
    filters: Record<string, any> = {},
    callback: (payload: any) => void
  ) {
    let channel = supabase.channel(`${table}_changes`);
    
    let subscription = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: Object.entries(filters).map(([key, value]) => `${key}=eq.${value}`).join(',')
      },
      callback
    );

    return channel.subscribe();
  }
}

export { CacheManager };
export default DatabaseOptimizer;