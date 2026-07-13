/**
 * Zyklus-Erinnerungen – lokale Notifications aus der Zyklusprognose.
 *
 * Zwei Erinnerungen, beide opt-in:
 *   - Periode: 2 Tage vor dem prognostizierten Periodenstart
 *   - Fruchtbares Fenster: 1 Tag vor Fensterbeginn
 *
 * Diskret-Modus: neutraler Notification-Text ohne Zyklus-Inhalt auf dem
 * Sperrbildschirm. Einstellungen liegen lokal in AsyncStorage (pro User);
 * die Termine werden bei jedem Laden des Trackers gegen die aktuelle
 * Prognose neu geplant (Pattern wie lib/vitaminDReminder.ts).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { CyclePrediction } from './cyclePredictions';
import {
  DEFAULT_CYCLE_LOCALE,
  translateCycleText,
  type CycleLocale,
} from './cycleTranslations';

const SETTINGS_KEY_PREFIX = 'cycle:reminders:settings';
const PERIOD_IDENTIFIER_PREFIX = 'cycle:period-reminder';
const FERTILE_IDENTIFIER_PREFIX = 'cycle:fertile-reminder';

export const CYCLE_REMINDER_HOUR = 9;
export const CYCLE_PERIOD_REMINDER_LEAD_DAYS = 2;
export const CYCLE_FERTILE_REMINDER_LEAD_DAYS = 1;
export const CYCLE_NOTIFICATION_TYPE = 'cycle_reminder';

export type CycleReminderSettings = {
  periodReminder: boolean;
  fertileReminder: boolean;
  discreet: boolean;
};

export const DEFAULT_CYCLE_REMINDER_SETTINGS: CycleReminderSettings = {
  periodReminder: false,
  fertileReminder: false,
  discreet: false,
};

const buildSettingsKey = (userId: string) => `${SETTINGS_KEY_PREFIX}:${userId}`;

export const getCyclePeriodReminderIdentifier = (userId: string) =>
  `${PERIOD_IDENTIFIER_PREFIX}:${userId}`;

export const getCycleFertileReminderIdentifier = (userId: string) =>
  `${FERTILE_IDENTIFIER_PREFIX}:${userId}`;

export const loadCycleReminderSettings = async (
  userId: string,
): Promise<CycleReminderSettings> => {
  try {
    const raw = await AsyncStorage.getItem(buildSettingsKey(userId));
    if (!raw) return { ...DEFAULT_CYCLE_REMINDER_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      periodReminder: parsed?.periodReminder === true,
      fertileReminder: parsed?.fertileReminder === true,
      discreet: parsed?.discreet === true,
    };
  } catch {
    return { ...DEFAULT_CYCLE_REMINDER_SETTINGS };
  }
};

export const saveCycleReminderSettings = async (
  userId: string,
  settings: CycleReminderSettings,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(buildSettingsKey(userId), JSON.stringify(settings));
  } catch (error) {
    console.warn('Cycle reminders: failed to persist settings', error);
  }
};

const ensureDefaultNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#8E4EC6',
    sound: 'default',
  });
};

export const requestCycleReminderPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

const parseDateKey = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(CYCLE_REMINDER_HOUR, 0, 0, 0);
  return date;
};

const cancelReminder = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {}
};

const scheduleDateReminder = async (
  identifier: string,
  triggerDate: Date,
  title: string,
  body: string,
) => {
  if (triggerDate.getTime() <= Date.now()) return false;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: CYCLE_NOTIFICATION_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
  return true;
};

export type SyncCycleRemindersResult = {
  permissionGranted: boolean;
  periodScheduled: boolean;
  fertileScheduled: boolean;
};

/**
 * Plant beide Erinnerungen gegen die aktuelle Prognose neu (vorher werden
 * bestehende immer abgeräumt, damit sich verschobene Termine korrigieren).
 */
export const syncCycleReminders = async ({
  userId,
  settings,
  prediction,
  locale = DEFAULT_CYCLE_LOCALE,
}: {
  userId: string;
  settings: CycleReminderSettings;
  prediction: CyclePrediction;
  locale?: CycleLocale;
}): Promise<SyncCycleRemindersResult> => {
  const t = (key: string, params?: Record<string, string | number>) =>
    translateCycleText(locale, key, params);
  const result: SyncCycleRemindersResult = {
    permissionGranted: true,
    periodScheduled: false,
    fertileScheduled: false,
  };

  if (Platform.OS === 'web') {
    return { ...result, permissionGranted: false };
  }

  await Promise.all([
    cancelReminder(getCyclePeriodReminderIdentifier(userId)),
    cancelReminder(getCycleFertileReminderIdentifier(userId)),
  ]);

  if (!settings.periodReminder && !settings.fertileReminder) {
    return result;
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    return { ...result, permissionGranted: false };
  }

  await ensureDefaultNotificationChannel();

  try {
    if (settings.periodReminder && prediction.nextPeriodWindow.anchorDate) {
      const anchor = parseDateKey(prediction.nextPeriodWindow.anchorDate);
      if (anchor) {
        const triggerDate = new Date(anchor.getTime());
        triggerDate.setDate(triggerDate.getDate() - CYCLE_PERIOD_REMINDER_LEAD_DAYS);
        result.periodScheduled = await scheduleDateReminder(
          getCyclePeriodReminderIdentifier(userId),
          triggerDate,
          settings.discreet ? t('notification.discreet.title') : t('notification.period.title'),
          settings.discreet
            ? t('notification.discreet.body')
            : t('notification.period.body', { days: CYCLE_PERIOD_REMINDER_LEAD_DAYS }),
        );
      }
    }

    if (settings.fertileReminder && prediction.fertileWindow.startDate) {
      const start = parseDateKey(prediction.fertileWindow.startDate);
      if (start) {
        const triggerDate = new Date(start.getTime());
        triggerDate.setDate(triggerDate.getDate() - CYCLE_FERTILE_REMINDER_LEAD_DAYS);
        result.fertileScheduled = await scheduleDateReminder(
          getCycleFertileReminderIdentifier(userId),
          triggerDate,
          settings.discreet ? t('notification.discreet.title') : t('notification.fertile.title'),
          settings.discreet
            ? t('notification.discreet.body')
            : t('notification.fertile.body'),
        );
      }
    }
  } catch (error) {
    console.error('Cycle reminders: failed to schedule', error);
  }

  return result;
};
