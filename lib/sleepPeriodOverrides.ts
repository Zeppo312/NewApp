import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SleepEntry } from '@/lib/sleepData';
import type { SleepPeriod } from '@/lib/sleepPeriods';

const ACTIVE_SLEEP_PERIOD_OVERRIDES_KEY = 'sleep_active_period_overrides_v1';

export type StoredActiveSleepPeriodOverride = {
  period: SleepPeriod;
  startTime?: string;
  updatedAt?: string;
};

export type ActiveSleepPeriodOverrideMap = Record<string, StoredActiveSleepPeriodOverride>;

const isSleepPeriod = (value: unknown): value is SleepPeriod =>
  value === 'day' || value === 'night';

export const loadActiveSleepPeriodOverrides = async (): Promise<ActiveSleepPeriodOverrideMap> => {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SLEEP_PERIOD_OVERRIDES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed as Record<string, unknown>).reduce<ActiveSleepPeriodOverrideMap>(
      (acc, [entryId, value]) => {
        if (!entryId || !value || typeof value !== 'object') return acc;
        const candidate = value as Partial<StoredActiveSleepPeriodOverride>;
        if (!isSleepPeriod(candidate.period)) return acc;
        acc[entryId] = {
          period: candidate.period,
          startTime: typeof candidate.startTime === 'string' ? candidate.startTime : undefined,
          updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
        };
        return acc;
      },
      {}
    );
  } catch (error) {
    console.error('Failed to load active sleep period overrides:', error);
    return {};
  }
};

export const saveActiveSleepPeriodOverrides = async (overrides: ActiveSleepPeriodOverrideMap) => {
  try {
    await AsyncStorage.setItem(ACTIVE_SLEEP_PERIOD_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.error('Failed to save active sleep period overrides:', error);
  }
};

export const rememberActiveSleepPeriodOverride = async (
  entryId: string | undefined,
  period: SleepPeriod,
  startTime: string | Date
) => {
  if (!entryId) return;
  const overrides = await loadActiveSleepPeriodOverrides();

  if (period === 'night') {
    overrides[entryId] = {
      period,
      startTime: new Date(startTime).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    delete overrides[entryId];
  }

  await saveActiveSleepPeriodOverrides(overrides);
};

export const forgetActiveSleepPeriodOverride = async (entryId: string | undefined) => {
  if (!entryId) return;
  const overrides = await loadActiveSleepPeriodOverrides();
  if (!overrides[entryId]) return;
  delete overrides[entryId];
  await saveActiveSleepPeriodOverrides(overrides);
};

export const loadStoredActiveSleepPeriodOverride = async (
  entry: Pick<SleepEntry, 'id' | 'start_time'>
): Promise<SleepPeriod | undefined> => {
  if (!entry.id) return undefined;

  const overrides = await loadActiveSleepPeriodOverrides();
  const stored = overrides[entry.id];
  if (!stored) return undefined;

  const entryStartMs = new Date(entry.start_time).getTime();
  const storedStartMs = stored.startTime ? new Date(stored.startTime).getTime() : null;
  if (
    storedStartMs !== null &&
    Number.isFinite(entryStartMs) &&
    Number.isFinite(storedStartMs) &&
    Math.abs(entryStartMs - storedStartMs) > 60 * 1000
  ) {
    delete overrides[entry.id];
    await saveActiveSleepPeriodOverrides(overrides);
    return undefined;
  }

  return stored.period;
};
