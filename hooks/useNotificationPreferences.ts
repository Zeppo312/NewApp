import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notification_preferences_v1';

export interface NotificationPreferences {
  sleepWindowReminder: boolean;
  feedingReminder: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  sleepWindowReminder: true,
  feedingReminder: true,
};

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Preferences aus AsyncStorage laden
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
          setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
        }
      } catch (error) {
        console.error('Fehler beim Laden der Notification-Preferences:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  const updatePreference = useCallback(
    async <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
      const updated = { ...preferences, [key]: value };
      setPreferences(updated);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Fehler beim Speichern der Notification-Preferences:', error);
      }
    },
    [preferences]
  );

  return { preferences, updatePreference, isLoaded };
}
