import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getCachedUserProfile } from '@/lib/appCache';
import { getBabyInfo } from '@/lib/baby';
import { normalizeBedtimeAnchor } from '@/lib/bedtime';
import {
  DEFAULT_NIGHT_WINDOW_SETTINGS,
  loadNightWindowSettings,
} from '@/lib/nightWindowSettings';
import { findFreshActiveSleepEntry } from '@/lib/sleepEntryGuards';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import type { SleepEntry } from '@/lib/sleepData';
import {
  initializePersonalization,
  predictNextSleepWindow,
  type SleepWindowPrediction,
} from '@/lib/sleep-window';

const RECENT_SLEEP_WINDOW_MS = 48 * 60 * 60 * 1000;

type SleepDebugSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  device: {
    platform: string;
    timezone: string;
    locale: string;
    appVersion: string | null;
    nativeBuildVersion: string | null;
  };
  user: {
    id: string;
    isAdmin: boolean;
  };
  baby: {
    activeBabyId: string | null;
    name: string | null;
    birthDate: string | null;
    preferredBedtime: string;
  };
  nightWindowSettings: {
    startTime: string;
    endTime: string;
  };
  sleep: {
    totalVisibleEntries: number;
    recentEntriesLast48Hours: SleepEntry[];
    freshActiveEntry: SleepEntry | null;
  };
  prediction: SleepWindowPrediction | null;
};

const getLocale = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'unknown';
  } catch {
    return 'unknown';
  }
};

const getTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    return 'unknown';
  }
};

const sortByStartTimeAsc = (entries: SleepEntry[]) =>
  [...entries].sort((a, b) => {
    const aMs = new Date(a.start_time ?? 0).getTime();
    const bMs = new Date(b.start_time ?? 0).getTime();
    return aMs - bMs;
  });

export async function buildSleepDebugSnapshot(
  userId: string,
  activeBabyId?: string | null
): Promise<SleepDebugSnapshot> {
  const now = new Date();
  const profile = await getCachedUserProfile();
  const nightWindowSettings = await loadNightWindowSettings(userId);
  const babyResult = activeBabyId ? await getBabyInfo(activeBabyId) : { data: null };
  const preferredBedtime = normalizeBedtimeAnchor(babyResult.data?.preferred_bedtime ?? null);

  await initializePersonalization(activeBabyId ?? undefined);

  const visibleEntriesResult = await loadAllVisibleSleepEntries(activeBabyId ?? undefined);
  const visibleEntries = sortByStartTimeAsc(visibleEntriesResult.entries ?? []);
  const recentCutoffMs = now.getTime() - RECENT_SLEEP_WINDOW_MS;
  const recentEntries = visibleEntries.filter((entry) => {
    const startMs = new Date(entry.start_time ?? 0).getTime();
    return Number.isFinite(startMs) && startMs >= recentCutoffMs;
  });
  const freshActiveEntry = findFreshActiveSleepEntry(visibleEntries);

  let prediction: SleepWindowPrediction | null = null;
  if (visibleEntries.length > 0) {
    try {
      prediction = await predictNextSleepWindow({
        userId,
        babyId: activeBabyId ?? undefined,
        birthdate: babyResult.data?.birth_date ?? undefined,
        entries: visibleEntries,
        anchorBedtime: preferredBedtime,
        now,
      });
    } catch (error) {
      prediction = null;
      console.error('Failed to compute sleep debug prediction:', error);
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    device: {
      platform: Platform.OS,
      timezone: getTimezone(),
      locale: getLocale(),
      appVersion: Constants.expoConfig?.version ?? null,
      nativeBuildVersion: Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString() ?? null,
    },
    user: {
      id: userId,
      isAdmin: profile?.is_admin === true,
    },
    baby: {
      activeBabyId: activeBabyId ?? null,
      name: babyResult.data?.name ?? null,
      birthDate: babyResult.data?.birth_date ?? null,
      preferredBedtime,
    },
    nightWindowSettings: {
      startTime: nightWindowSettings?.startTime ?? DEFAULT_NIGHT_WINDOW_SETTINGS.startTime,
      endTime: nightWindowSettings?.endTime ?? DEFAULT_NIGHT_WINDOW_SETTINGS.endTime,
    },
    sleep: {
      totalVisibleEntries: visibleEntries.length,
      recentEntriesLast48Hours: recentEntries,
      freshActiveEntry: freshActiveEntry ?? null,
    },
    prediction,
  };
}

export const serializeSleepDebugSnapshot = (snapshot: SleepDebugSnapshot): string =>
  JSON.stringify(snapshot, null, 2);
