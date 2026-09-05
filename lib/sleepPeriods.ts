import type { SleepEntry } from '@/lib/sleepData';
import {
  DEFAULT_NIGHT_WINDOW_SETTINGS,
  clockTimeToMinutes,
  getNightWindowRangeForDate,
  type NightWindowSettings,
} from '@/lib/nightWindowSettings';

export type SleepPeriod = 'day' | 'night';

export const MIN_NIGHT_OVERLAP_MINUTES = 60;
export const MIN_NIGHT_OVERLAP_RATIO = 0.5;

export const overlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  Math.max(0, Math.min(+aEnd, +bEnd) - Math.max(+aStart, +bStart)) / 60000 | 0;

export const getSleepPeriodForStart = (
  date: Date,
  nightWindowSettings: NightWindowSettings = DEFAULT_NIGHT_WINDOW_SETTINGS
): SleepPeriod => {
  const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes();
  const nightStartMinutes = clockTimeToMinutes(nightWindowSettings.startTime, 18 * 60);
  const nightEndMinutes = clockTimeToMinutes(nightWindowSettings.endTime, 10 * 60);
  const isOvernightWindow = nightEndMinutes <= nightStartMinutes;
  const isNight = isOvernightWindow
    ? minutesSinceMidnight >= nightStartMinutes || minutesSinceMidnight < nightEndMinutes
    : minutesSinceMidnight >= nightStartMinutes && minutesSinceMidnight < nightEndMinutes;

  return isNight ? 'night' : 'day';
};

export const getSleepPeriodForEntry = (
  entry: Pick<SleepEntry, 'start_time' | 'end_time'>,
  nightWindowSettings: NightWindowSettings = DEFAULT_NIGHT_WINDOW_SETTINGS,
  now: Date = new Date()
): SleepPeriod => {
  const start = new Date(entry.start_time);
  const end = entry.end_time ? new Date(entry.end_time) : now;
  const startMs = start.getTime();
  const endMs = end.getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return getSleepPeriodForStart(start, nightWindowSettings);
  }

  const previousWindow = getNightWindowRangeForDate(start, nightWindowSettings, 'previous');
  const upcomingWindow = getNightWindowRangeForDate(start, nightWindowSettings, 'upcoming');
  const previousOverlap = overlapMinutes(
    start,
    end,
    previousWindow.nightWindowStart,
    previousWindow.nightWindowEnd
  );
  const upcomingOverlap = overlapMinutes(
    start,
    end,
    upcomingWindow.nightWindowStart,
    upcomingWindow.nightWindowEnd
  );
  const nightOverlap = Math.max(previousOverlap, upcomingOverlap);
  const durationMinutes = (endMs - startMs) / 60000;

  if (
    nightOverlap >= MIN_NIGHT_OVERLAP_MINUTES ||
    nightOverlap / durationMinutes >= MIN_NIGHT_OVERLAP_RATIO
  ) {
    return 'night';
  }

  return getSleepPeriodForStart(start, nightWindowSettings);
};
