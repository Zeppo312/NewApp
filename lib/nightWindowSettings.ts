import AsyncStorage from '@react-native-async-storage/async-storage';

export type NightWindowSettings = {
  startTime: string;
  endTime: string;
};

export const DEFAULT_NIGHT_WINDOW_SETTINGS: NightWindowSettings = {
  startTime: '18:00',
  endTime: '10:00',
};

const STORAGE_KEY_PREFIX = 'sleep_night_window_settings_v1';
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_START_MINUTES = 18 * 60;
const DEFAULT_END_MINUTES = 10 * 60;

const buildStorageKey = (userId?: string | null) =>
  userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;

export const isValidClockTime = (value: string): boolean =>
  CLOCK_TIME_PATTERN.test(value);

export const normalizeClockTime = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return isValidClockTime(trimmed) ? trimmed : fallback;
};

const normalizeNightWindowSettings = (
  settings?: Partial<NightWindowSettings> | null
): NightWindowSettings => ({
  startTime: normalizeClockTime(settings?.startTime, DEFAULT_NIGHT_WINDOW_SETTINGS.startTime),
  endTime: normalizeClockTime(settings?.endTime, DEFAULT_NIGHT_WINDOW_SETTINGS.endTime),
});

export const clockTimeToMinutes = (value: string, fallback: number): number => {
  const normalized = normalizeClockTime(value, '');
  if (!normalized) return fallback;

  const [hoursText, minutesText] = normalized.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return hours * 60 + minutes;
};

const minutesToHourMinute = (minutes: number) => ({
  hour: Math.floor(minutes / 60),
  minute: minutes % 60,
});

export const getNightWindowRangeForDate = (
  date: Date,
  settings: NightWindowSettings,
  anchor: 'previous' | 'upcoming' = 'previous'
) => {
  const startMinutes = clockTimeToMinutes(settings.startTime, DEFAULT_START_MINUTES);
  const endMinutes = clockTimeToMinutes(settings.endTime, DEFAULT_END_MINUTES);
  const isOvernightWindow = endMinutes <= startMinutes;
  const startParts = minutesToHourMinute(startMinutes);
  const endParts = minutesToHourMinute(endMinutes);

  if (anchor === 'upcoming') {
    const nightWindowStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      startParts.hour,
      startParts.minute,
      0,
      0
    );

    const nightWindowEnd = new Date(nightWindowStart);
    if (isOvernightWindow) {
      nightWindowEnd.setDate(nightWindowEnd.getDate() + 1);
    }
    nightWindowEnd.setHours(endParts.hour, endParts.minute, 0, 0);
    return { nightWindowStart, nightWindowEnd };
  }

  const nightWindowEnd = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    endParts.hour,
    endParts.minute,
    0,
    0
  );
  const nightWindowStart = new Date(nightWindowEnd);
  if (isOvernightWindow) {
    nightWindowStart.setDate(nightWindowStart.getDate() - 1);
  }
  nightWindowStart.setHours(startParts.hour, startParts.minute, 0, 0);
  return { nightWindowStart, nightWindowEnd };
};

export const loadNightWindowSettings = async (
  userId?: string | null
): Promise<NightWindowSettings> => {
  try {
    const raw = await AsyncStorage.getItem(buildStorageKey(userId));
    if (!raw) return DEFAULT_NIGHT_WINDOW_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<NightWindowSettings> | null;
    return normalizeNightWindowSettings(parsed);
  } catch (error) {
    console.error('Failed to load night window settings:', error);
    return DEFAULT_NIGHT_WINDOW_SETTINGS;
  }
};

export const saveNightWindowSettings = async (
  settings: Partial<NightWindowSettings>,
  userId?: string | null
): Promise<NightWindowSettings> => {
  try {
    const current = await loadNightWindowSettings(userId);
    const merged = normalizeNightWindowSettings({
      ...current,
      ...settings,
    });
    await AsyncStorage.setItem(buildStorageKey(userId), JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.error('Failed to save night window settings:', error);
    throw error;
  }
};
