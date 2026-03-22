import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getAppSettings, saveAppSettings, supabase, type AppSettings } from '@/lib/supabase';

export interface NotificationPreferences {
  sleepWindowReminder: boolean;
  feedingReminder: boolean;
  vitaminDReminder: boolean;
  vitaminDReminderHour: number;
  vitaminDReminderMinute: number;
  partnerActivity: boolean;
  plannerReminder: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  sleepWindowReminder: true,
  feedingReminder: true,
  vitaminDReminder: true,
  vitaminDReminderHour: 9,
  vitaminDReminderMinute: 0,
  partnerActivity: true,
  plannerReminder: true,
};

function mapAppSettingsToPreferences(settings?: AppSettings | null): NotificationPreferences {
  return {
    sleepWindowReminder:
      settings?.sleep_window_notifications_enabled ?? DEFAULT_PREFERENCES.sleepWindowReminder,
    feedingReminder:
      settings?.feeding_notifications_enabled ?? DEFAULT_PREFERENCES.feedingReminder,
    vitaminDReminder:
      settings?.vitamin_d_reminder_enabled ?? DEFAULT_PREFERENCES.vitaminDReminder,
    vitaminDReminderHour:
      settings?.vitamin_d_reminder_hour ?? DEFAULT_PREFERENCES.vitaminDReminderHour,
    vitaminDReminderMinute:
      settings?.vitamin_d_reminder_minute ?? DEFAULT_PREFERENCES.vitaminDReminderMinute,
    partnerActivity:
      settings?.partner_notifications_enabled ?? DEFAULT_PREFERENCES.partnerActivity,
    plannerReminder:
      settings?.planner_notifications_enabled ?? DEFAULT_PREFERENCES.plannerReminder,
  };
}

function mapPreferenceUpdateToSettings(
  updates: Partial<NotificationPreferences>,
): Partial<AppSettings> {
  const nextSettings: Partial<AppSettings> = {};

  if (typeof updates.sleepWindowReminder === 'boolean') {
    nextSettings.sleep_window_notifications_enabled = updates.sleepWindowReminder;
  }
  if (typeof updates.feedingReminder === 'boolean') {
    nextSettings.feeding_notifications_enabled = updates.feedingReminder;
  }
  if (typeof updates.vitaminDReminder === 'boolean') {
    nextSettings.vitamin_d_reminder_enabled = updates.vitaminDReminder;
  }
  if (typeof updates.vitaminDReminderHour === 'number') {
    nextSettings.vitamin_d_reminder_hour = updates.vitaminDReminderHour;
  }
  if (typeof updates.vitaminDReminderMinute === 'number') {
    nextSettings.vitamin_d_reminder_minute = updates.vitaminDReminderMinute;
  }
  if (typeof updates.partnerActivity === 'boolean') {
    nextSettings.partner_notifications_enabled = updates.partnerActivity;
  }
  if (typeof updates.plannerReminder === 'boolean') {
    nextSettings.planner_notifications_enabled = updates.plannerReminder;
  }

  return nextSettings;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setPreferences(DEFAULT_PREFERENCES);
      setIsLoaded(true);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const { data, error } = await getAppSettings();
        if (error) {
          console.error('Fehler beim Laden der Notification-Preferences:', error);
        }
        if (mounted) {
          setPreferences(mapAppSettingsToPreferences(data));
        }
      } catch (error) {
        console.error('Fehler beim Laden der Notification-Preferences:', error);
      } finally {
        if (mounted) {
          setIsLoaded(true);
        }
      }
    };

    void load();

    const channel = supabase
      .channel(`notification-preferences-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      const previous = preferences;
      const next = { ...preferences, ...updates };
      setPreferences(next);

      try {
        const { error } = await saveAppSettings(mapPreferenceUpdateToSettings(updates));
        if (error) {
          throw error;
        }
      } catch (error) {
        console.error('Fehler beim Speichern der Notification-Preferences:', error);
        setPreferences(previous);
        throw error;
      }
    },
    [preferences],
  );

  const updatePreference = useCallback(
    async <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
      await updatePreferences({ [key]: value } as Pick<NotificationPreferences, K>);
    },
    [updatePreferences],
  );

  return { preferences, updatePreference, updatePreferences, isLoaded };
}
