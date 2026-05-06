import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase, type AppSettings } from './supabase';

const VITAMIN_D_CHECKS_KEY_PREFIX = 'planner:vitamin-d:checks';
const VITAMIN_D_NOTIFICATION_IDENTIFIER_PREFIX = 'planner:vitamin-d:daily-reminder';
const VITAMIN_D_REMOTE_READY_KEY_PREFIX = 'planner:vitamin-d:remote-ready';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STORED_DAYS = 730;
const VITAMIN_D_HABIT_KEY = 'vitamin_d';
const REMOTE_FALLBACK_CODES = new Set(['PGRST205', '42P01', '42703']);

export const VITAMIN_D_REMINDER_HOUR = 9;
export const VITAMIN_D_REMINDER_MINUTE = 0;
export const VITAMIN_D_NOTIFICATION_TYPE = 'vitamin_d_reminder';

export type VitaminDChecks = Record<string, true>;

function buildChecksKey(userId: string) {
  return `${VITAMIN_D_CHECKS_KEY_PREFIX}:${userId}`;
}

function buildScopedChecksKey(userId: string, babyId?: string) {
  if (!babyId) {
    return buildChecksKey(userId);
  }

  return `${VITAMIN_D_CHECKS_KEY_PREFIX}:${userId}:baby:${babyId}`;
}
function buildRemoteReadyKey(userId: string, babyId: string) {
  return `${VITAMIN_D_REMOTE_READY_KEY_PREFIX}:${userId}:baby:${babyId}`;
}

export function getVitaminDReminderIdentifier(userId: string) {
  return `${VITAMIN_D_NOTIFICATION_IDENTIFIER_PREFIX}:${userId}`;
}

function sanitizeChecks(value: unknown): VitaminDChecks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value)
    .filter(
      ([dateKey, completed]) =>
        DATE_KEY_PATTERN.test(dateKey) && completed === true,
    )
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, MAX_STORED_DAYS);

  return Object.fromEntries(entries) as VitaminDChecks;
}

function parseStoredChecks(checksRaw: string | null): VitaminDChecks {
  if (!checksRaw) {
    return {};
  }

  try {
    return sanitizeChecks(JSON.parse(checksRaw));
  } catch (error) {
    console.warn('Vitamin D: failed to parse stored checks', error);
    return {};
  }
}

function hasChecks(checks: VitaminDChecks) {
  return Object.keys(checks).length > 0;
}

function shouldFallbackToLocal(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (REMOTE_FALLBACK_CODES.has(code)) {
    return true;
  }

  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message).toLowerCase()
      : String(error ?? '').toLowerCase();

  return (
    message.includes('baby_daily_habit_checks') &&
    (message.includes('does not exist') ||
      message.includes('could not find the table') ||
      message.includes('schema cache'))
  );
}

async function persistChecks(
  userId: string,
  checks: VitaminDChecks,
  babyId?: string,
) {
  await AsyncStorage.setItem(
    buildScopedChecksKey(userId, babyId),
    JSON.stringify(checks),
  );
}

async function loadLocalChecks(
  userId: string,
  babyId?: string,
): Promise<VitaminDChecks> {
  const scopedKey = buildScopedChecksKey(userId, babyId);
  const scopedChecksRaw = await AsyncStorage.getItem(scopedKey);

  if (scopedChecksRaw !== null) {
    return parseStoredChecks(scopedChecksRaw);
  }

  if (!babyId) {
    return {};
  }

  const legacyChecksRaw = await AsyncStorage.getItem(buildChecksKey(userId));
  const legacyChecks = parseStoredChecks(legacyChecksRaw);

  if (hasChecks(legacyChecks)) {
    await persistChecks(userId, legacyChecks, babyId);
  }

  return legacyChecks;
}

async function isRemoteReady(userId: string, babyId: string) {
  const ready = await AsyncStorage.getItem(buildRemoteReadyKey(userId, babyId));
  return ready === 'true';
}

async function markRemoteReady(userId: string, babyId: string) {
  await AsyncStorage.setItem(buildRemoteReadyKey(userId, babyId), 'true');
}

async function loadRemoteChecks(babyId: string): Promise<VitaminDChecks> {
  const { data, error } = await supabase
    .from('baby_daily_habit_checks')
    .select('day')
    .eq('baby_id', babyId)
    .eq('habit_key', VITAMIN_D_HABIT_KEY)
    .order('day', { ascending: false })
    .limit(MAX_STORED_DAYS);

  if (error) {
    throw error;
  }

  const mappedChecks = (data ?? []).reduce<VitaminDChecks>((acc, row) => {
    if (typeof row.day === 'string' && DATE_KEY_PATTERN.test(row.day)) {
      acc[row.day] = true;
    }
    return acc;
  }, {});

  return sanitizeChecks(mappedChecks);
}

async function seedRemoteChecksFromLocal(
  userId: string,
  babyId: string,
  checks: VitaminDChecks,
) {
  const rows = Object.keys(checks)
    .filter((dateKey) => DATE_KEY_PATTERN.test(dateKey))
    .map((dateKey) => ({
      baby_id: babyId,
      habit_key: VITAMIN_D_HABIT_KEY,
      day: dateKey,
      checked_at: `${dateKey}T12:00:00.000Z`,
      checked_by: userId,
    }));

  if (!rows.length) {
    return;
  }

  const { error } = await supabase
    .from('baby_daily_habit_checks')
    .upsert(rows, { onConflict: 'baby_id,habit_key,day' });

  if (error) {
    throw error;
  }
}

async function saveRemoteCompletion(
  userId: string,
  babyId: string,
  dateKey: string,
  completed: boolean,
) {
  if (completed) {
    const { error } = await supabase.from('baby_daily_habit_checks').upsert(
      {
        baby_id: babyId,
        habit_key: VITAMIN_D_HABIT_KEY,
        day: dateKey,
        checked_at: new Date().toISOString(),
        checked_by: userId,
      },
      { onConflict: 'baby_id,habit_key,day' },
    );

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from('baby_daily_habit_checks')
    .delete()
    .eq('baby_id', babyId)
    .eq('habit_key', VITAMIN_D_HABIT_KEY)
    .eq('day', dateKey);

  if (error) {
    throw error;
  }
}

function matchesVitaminDReminder(
  request: Notifications.NotificationRequest,
  userId: string,
) {
  const type = (request.content.data as { type?: unknown } | null)?.type;
  return (
    request.identifier === getVitaminDReminderIdentifier(userId) ||
    type === VITAMIN_D_NOTIFICATION_TYPE
  );
}

export function resolveVitaminDReminderConfig(settings?: Partial<AppSettings> | null) {
  return {
    enabled: settings?.vitamin_d_reminder_enabled ?? true,
    hour: settings?.vitamin_d_reminder_hour ?? VITAMIN_D_REMINDER_HOUR,
    minute: settings?.vitamin_d_reminder_minute ?? VITAMIN_D_REMINDER_MINUTE,
  };
}

async function ensureDefaultNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#8E4EC6',
    sound: 'default',
  });
}

export async function cancelVitaminDReminder(userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matching = scheduled.filter((request) =>
    matchesVitaminDReminder(request, userId),
  );

  const identifiers = new Set<string>([
    getVitaminDReminderIdentifier(userId),
    ...matching.map((request) => request.identifier),
  ]);

  await Promise.all(
    Array.from(identifiers).map(async (identifier) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch {}
    }),
  );
}

export async function isVitaminDReminderScheduled(userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((request) => matchesVitaminDReminder(request, userId));
}

export async function syncVitaminDReminderSchedule({
  userId,
  enabled,
  hour = VITAMIN_D_REMINDER_HOUR,
  minute = VITAMIN_D_REMINDER_MINUTE,
}: {
  userId: string;
  enabled: boolean;
  hour?: number;
  minute?: number;
}) {
  await cancelVitaminDReminder(userId);

  if (!enabled) {
    return { scheduled: false, permissionGranted: true };
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    return { scheduled: false, permissionGranted: false };
  }

  await ensureDefaultNotificationChannel();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: getVitaminDReminderIdentifier(userId),
      content: {
        title: 'Vitamin D nicht vergessen',
        body: 'Denk an die Vitamin-D-Tablette und hake sie danach in Unser Tag ab.',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: VITAMIN_D_NOTIFICATION_TYPE,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    return {
      scheduled: await isVitaminDReminderScheduled(userId),
      permissionGranted: true,
    };
  } catch (error) {
    console.error('Vitamin D: failed to schedule reminder', error);
    return { scheduled: false, permissionGranted: true };
  }
}

export async function loadVitaminDReminderState(
  userId: string,
  babyId?: string,
): Promise<VitaminDChecks> {
  const localChecks = await loadLocalChecks(userId, babyId);

  if (!babyId) {
    return localChecks;
  }

  try {
    const [remoteChecks, remoteReady] = await Promise.all([
      loadRemoteChecks(babyId),
      isRemoteReady(userId, babyId),
    ]);

    if (!hasChecks(remoteChecks) && hasChecks(localChecks) && !remoteReady) {
      await seedRemoteChecksFromLocal(userId, babyId, localChecks);
      await markRemoteReady(userId, babyId);
      await persistChecks(userId, localChecks, babyId);
      return localChecks;
    }

    await markRemoteReady(userId, babyId);
    await persistChecks(userId, remoteChecks, babyId);

    return remoteChecks;
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      console.warn('Vitamin D: remote sync unavailable, using local fallback');
    } else {
      console.error('Vitamin D: failed to load remote checks, using local cache', error);
    }

    return localChecks;
  }
}

export async function saveVitaminDCompletion(
  userId: string,
  dateKey: string,
  completed: boolean,
  babyId?: string,
) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error(`Invalid Vitamin-D date key: ${dateKey}`);
  }

  const currentChecks = await loadLocalChecks(userId, babyId);
  const nextChecks: Record<string, true> = { ...currentChecks };

  if (completed) {
    nextChecks[dateKey] = true;
  } else {
    delete nextChecks[dateKey];
  }

  const sanitizedChecks = sanitizeChecks(nextChecks);

  if (!babyId) {
    await persistChecks(userId, sanitizedChecks);
    return sanitizedChecks;
  }

  try {
    await saveRemoteCompletion(userId, babyId, dateKey, completed);
    await markRemoteReady(userId, babyId);
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      console.warn('Vitamin D: remote sync unavailable, saving locally');
      await persistChecks(userId, sanitizedChecks, babyId);
      return sanitizedChecks;
    }

    throw error;
  }

  await persistChecks(userId, sanitizedChecks, babyId);
  return sanitizedChecks;
}
export function formatVitaminDReminderTime(
  locale = 'de-DE',
  hour = VITAMIN_D_REMINDER_HOUR,
  minute = VITAMIN_D_REMINDER_MINUTE,
) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
