import AsyncStorage from '@react-native-async-storage/async-storage';

// Optimized AsyncStorage with batch operations and error handling
class OptimizedStorage {
  private static cache = new Map<string, any>();
  private static pendingWrites = new Map<string, any>();
  private static writeTimer: NodeJS.Timeout | null = null;
  private static readonly BATCH_DELAY = 100; // 100ms delay for batching

  // Get item with in-memory cache
  static async getItem(key: string): Promise<string | null> {
    try {
      // Check in-memory cache first
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      const value = await AsyncStorage.getItem(key);
      
      // Cache the result
      if (value !== null) {
        this.cache.set(key, value);
      }
      
      return value;
    } catch (error) {
      console.warn(`Failed to get item ${key}:`, error);
      return null;
    }
  }

  // Get parsed JSON object
  static async getObject<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    try {
      const value = await this.getItem(key);
      if (value === null) return defaultValue;
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`Failed to parse object for key ${key}:`, error);
      return defaultValue;
    }
  }

  // Set item with batched writes
  static async setItem(key: string, value: string): Promise<void> {
    try {
      // Update in-memory cache immediately
      this.cache.set(key, value);
      
      // Add to pending writes
      this.pendingWrites.set(key, value);
      
      // Schedule batch write
      this.scheduleBatchWrite();
    } catch (error) {
      console.warn(`Failed to set item ${key}:`, error);
    }
  }

  // Set JSON object
  static async setObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.setItem(key, jsonValue);
    } catch (error) {
      console.warn(`Failed to stringify and set object for key ${key}:`, error);
    }
  }

  // Remove item
  static async removeItem(key: string): Promise<void> {
    try {
      this.cache.delete(key);
      this.pendingWrites.delete(key);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove item ${key}:`, error);
    }
  }

  // Batch operations
  static async multiGet(keys: string[]): Promise<{ [key: string]: string | null }> {
    try {
      const result: { [key: string]: string | null } = {};
      const keysToFetch: string[] = [];
      
      // Check cache first
      for (const key of keys) {
        if (this.cache.has(key)) {
          result[key] = this.cache.get(key);
        } else {
          keysToFetch.push(key);
        }
      }
      
      // Fetch remaining keys
      if (keysToFetch.length > 0) {
        const values = await AsyncStorage.multiGet(keysToFetch);
        
        values.forEach(([key, value]) => {
          result[key] = value;
          // Cache the result
          if (value !== null) {
            this.cache.set(key, value);
          }
        });
      }
      
      return result;
    } catch (error) {
      console.warn('Failed to perform multiGet:', error);
      return {};
    }
  }

  static async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    try {
      // Update cache
      keyValuePairs.forEach(([key, value]) => {
        this.cache.set(key, value);
      });
      
      await AsyncStorage.multiSet(keyValuePairs);
    } catch (error) {
      console.warn('Failed to perform multiSet:', error);
    }
  }

  static async multiRemove(keys: string[]): Promise<void> {
    try {
      // Remove from cache
      keys.forEach(key => {
        this.cache.delete(key);
        this.pendingWrites.delete(key);
      });
      
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.warn('Failed to perform multiRemove:', error);
    }
  }

  // Clear all data
  static async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.pendingWrites.clear();
      await AsyncStorage.clear();
    } catch (error) {
      console.warn('Failed to clear storage:', error);
    }
  }

  // Get all keys
  static async getAllKeys(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.warn('Failed to get all keys:', error);
      return [];
    }
  }

  // Force flush pending writes
  static async flushPendingWrites(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    
    await this.executeBatchWrite();
  }

  // Private methods
  private static scheduleBatchWrite(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }
    
    this.writeTimer = setTimeout(() => {
      this.executeBatchWrite();
    }, this.BATCH_DELAY);
  }

  private static async executeBatchWrite(): Promise<void> {
    if (this.pendingWrites.size === 0) return;
    
    try {
      const keyValuePairs: [string, string][] = Array.from(this.pendingWrites.entries());
      await AsyncStorage.multiSet(keyValuePairs);
      this.pendingWrites.clear();
    } catch (error) {
      console.warn('Failed to execute batch write:', error);
    }
  }

  // Utility methods for specific data types
  static async incrementNumber(key: string, increment = 1): Promise<number> {
    try {
      const current = await this.getObject<number>(key, 0);
      const newValue = (current || 0) + increment;
      await this.setObject(key, newValue);
      return newValue;
    } catch (error) {
      console.warn(`Failed to increment number for key ${key}:`, error);
      return 0;
    }
  }

  static async toggleBoolean(key: string, defaultValue = false): Promise<boolean> {
    try {
      const current = await this.getObject<boolean>(key, defaultValue);
      const newValue = !current;
      await this.setObject(key, newValue);
      return newValue;
    } catch (error) {
      console.warn(`Failed to toggle boolean for key ${key}:`, error);
      return defaultValue;
    }
  }

  static async appendToArray<T>(key: string, item: T): Promise<T[]> {
    try {
      const current = await this.getObject<T[]>(key, []);
      const newArray = [...(current || []), item];
      await this.setObject(key, newArray);
      return newArray;
    } catch (error) {
      console.warn(`Failed to append to array for key ${key}:`, error);
      return [];
    }
  }

  static async removeFromArray<T>(key: string, predicate: (item: T) => boolean): Promise<T[]> {
    try {
      const current = await this.getObject<T[]>(key, []);
      const newArray = (current || []).filter(item => !predicate(item));
      await this.setObject(key, newArray);
      return newArray;
    } catch (error) {
      console.warn(`Failed to remove from array for key ${key}:`, error);
      return [];
    }
  }
}

export default OptimizedStorage;