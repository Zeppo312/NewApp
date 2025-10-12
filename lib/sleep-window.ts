import { SleepEntry } from '@/lib/sleepData';

export type TimeOfDayBucket = 'morning' | 'midday' | 'afternoon' | 'evening';

export interface SleepWindowPredictionInput {
  userId: string;
  birthdate?: string | Date | null;
  entries: SleepEntry[];
  /**
   * Optional bedtime anchor for the day (e.g. "19:30").
   * Used to prevent suggested naps from pushing too close to bedtime.
   */
  anchorBedtime?: string;
  /**
   * Override reference time (useful for tests); defaults to `new Date()`.
   */
  now?: Date;
}

export interface SleepWindowPrediction {
  recommendedStart: Date;
  earliest: Date;
  latest: Date;
  windowMinutes: number;
  napIndexToday: number;
  timeOfDayBucket: TimeOfDayBucket;
  debug: Record<string, unknown>;
}

interface NormalizedEntry {
  id?: string;
  start: Date;
  end?: Date | null;
  duration: number | null;
  raw: SleepEntry;
}

interface PersonalizationData {
  offsetMinutes: number;
  sampleCount: number;
  lastUpdated: string;
}

interface AgeProfile {
  maxMonths: number;
  baseWindows: number[];
  napDurations: number[];
  dailyTargetMinutes: number;
}

interface BaselineResult {
  baselineWindow: number;
  targetNapDuration: number;
  timeOfDayBucket: TimeOfDayBucket;
  profile: AgeProfile;
}

const MIN_VALID_SLEEP_MINUTES = 5;
const DEFAULT_WINDOW_MINUTES = 90;
const DEFAULT_TARGET_NAP_DURATION = 90;
const MIN_WINDOW_MINUTES = 30;
const MAX_WINDOW_MINUTES = 300;
const EARLY_FLEX_MINUTES = 15;
const LATE_FLEX_MINUTES = 20;
const PERSONALIZATION_ALPHA = 0.3;
const PERSONALIZATION_CLAMP = 60;
const BEDTIME_BUFFER_MINUTES = 120;
const AWAKE_OVERRUN_GRACE_MINUTES = 15;
const JUNIOR_AWAKE_IMMEDIATE_MINUTES = 5;

const AGE_PROFILES: AgeProfile[] = [
  {
    maxMonths: 3,
    baseWindows: [60, 75, 90, 105],
    napDurations: [60, 70, 80, 60],
    dailyTargetMinutes: 960, // 16h
  },
  {
    maxMonths: 5,
    baseWindows: [90, 105, 120, 135],
    napDurations: [75, 90, 90, 60],
    dailyTargetMinutes: 930, // 15.5h
  },
  {
    maxMonths: 8,
    baseWindows: [120, 150, 180],
    napDurations: [90, 105, 90],
    dailyTargetMinutes: 870, // 14.5h
  },
  {
    maxMonths: 12,
    baseWindows: [150, 210],
    napDurations: [100, 100],
    dailyTargetMinutes: 780, // 13h
  },
  {
    maxMonths: 18,
    baseWindows: [210, 240],
    napDurations: [105, 105],
    dailyTargetMinutes: 750, // 12.5h
  },
  {
    maxMonths: Infinity,
    baseWindows: [240],
    napDurations: [120],
    dailyTargetMinutes: 720, // 12h
  },
];

const personalizationStore = new Map<string, PersonalizationData>();

/**
 * Predict the next sleep window for a baby / toddler based on recent sleep history.
 */
export async function predictNextSleepWindow({
  userId,
  birthdate,
  entries,
  anchorBedtime,
  now = new Date(),
}: SleepWindowPredictionInput): Promise<SleepWindowPrediction> {
  const normalizedEntries = normalizeEntries(entries);
  const completedEntries = normalizedEntries
    .filter((entry) => entry.end && entry.duration !== null && entry.duration >= MIN_VALID_SLEEP_MINUTES)
    .sort((a, b) => (a.end!.getTime() - b.end!.getTime()));

  const lastCompletedEntry = [...completedEntries]
    .reverse()
    .find((entry) => entry.end && entry.end.getTime() <= now.getTime());

  const lastNapEnd = lastCompletedEntry?.end ?? null;
  const lastNapDuration = lastCompletedEntry?.duration ?? null;

  const ageInMonths = getAgeInMonths(birthdate, now);
  const baselineAnchor = lastNapEnd ?? now;

  const napCountToday = completedEntries.filter((entry) => entry.end && isSameDay(entry.end, now)).length;
  const napIndexToday = Math.max(1, napCountToday + 1);

  const baseline = getBaselineWindow(ageInMonths, napIndexToday, baselineAnchor);

  const { last24hMinutes, todayMinutes } = computeDailySleepStats(completedEntries, now);
  const sleepDebt = baseline.profile.dailyTargetMinutes - last24hMinutes;

  const personalizationKey = getPersonalizationKey(userId, napIndexToday, baseline.timeOfDayBucket);
  const personalizationData = personalizationStore.get(personalizationKey);
  const personalizationOffset = personalizationData?.offsetMinutes ?? 0;

  let adjustedWindow = baseline.baselineWindow;

  if (lastNapDuration !== null && baseline.targetNapDuration > 0) {
    const varianceRatio = clamp(
      (baseline.targetNapDuration - lastNapDuration) / baseline.targetNapDuration,
      -1,
      1,
    );
    const durationAdjustment = clamp(varianceRatio * 20, -20, 20);
    adjustedWindow -= durationAdjustment;
  }

  if (Math.abs(sleepDebt) > 30) {
    const debtAdjustment = clamp(sleepDebt / 15, -20, 20);
    adjustedWindow -= debtAdjustment;
  }

  adjustedWindow += personalizationOffset;
  adjustedWindow = clamp(Math.round(adjustedWindow), MIN_WINDOW_MINUTES, MAX_WINDOW_MINUTES);

  const flexEarly = Math.max(EARLY_FLEX_MINUTES, Math.min(30, Math.round(adjustedWindow * 0.25)));
  const flexLate = Math.max(LATE_FLEX_MINUTES, Math.min(35, Math.round(adjustedWindow * 0.3)));

  const predictedStart = addMinutes(baselineAnchor, adjustedWindow);
  let timeOfDayBucket = getTimeOfDayBucket(predictedStart);

  let recommendedStart = predictedStart;
  let earliest = addMinutes(baselineAnchor, Math.max(0, adjustedWindow - flexEarly));
  let latest = addMinutes(baselineAnchor, adjustedWindow + flexLate);

  const awakeSinceLastNap = lastNapEnd ? minutesBetween(now, lastNapEnd) : null;
  let awakeOverrideApplied = false;

  if (awakeSinceLastNap !== null) {
    if (awakeSinceLastNap > adjustedWindow + AWAKE_OVERRUN_GRACE_MINUTES) {
      recommendedStart = addMinutes(now, JUNIOR_AWAKE_IMMEDIATE_MINUTES);
      awakeOverrideApplied = true;
    } else if (awakeSinceLastNap > adjustedWindow - 10) {
      const remaining = Math.max(5, adjustedWindow - awakeSinceLastNap);
      recommendedStart = addMinutes(now, remaining);
      awakeOverrideApplied = true;
    }
  }

  earliest = new Date(Math.max(earliest.getTime(), now.getTime()));

  let anchorConstraintApplied = false;
  if (anchorBedtime) {
    const anchorDate = resolveAnchorDate(anchorBedtime, now);
    if (anchorDate) {
      const latestAllowed = addMinutes(anchorDate, -BEDTIME_BUFFER_MINUTES);
      if (latest.getTime() > latestAllowed.getTime()) {
        latest = latestAllowed;
        anchorConstraintApplied = true;
      }
    }
  }

  if (recommendedStart.getTime() < earliest.getTime()) {
    recommendedStart = earliest;
  }
  if (recommendedStart.getTime() > latest.getTime()) {
    recommendedStart = latest;
  }

  if (earliest.getTime() > latest.getTime()) {
    earliest = new Date(latest);
  }

  if (awakeOverrideApplied) {
    earliest = new Date(Math.max(earliest.getTime(), now.getTime()));
    if (recommendedStart.getTime() < earliest.getTime()) {
      recommendedStart = earliest;
    }
  }

  timeOfDayBucket = getTimeOfDayBucket(recommendedStart);
  const windowMinutes = Math.round(
    (recommendedStart.getTime() - baselineAnchor.getTime()) / 60000,
  );

  return {
    recommendedStart,
    earliest,
    latest,
    windowMinutes,
    napIndexToday,
    timeOfDayBucket,
    debug: {
      now,
      ageInMonths,
      baselineWindow: baseline.baselineWindow,
      targetNapDuration: baseline.targetNapDuration,
      adjustedWindow,
      flexEarly,
      flexLate,
      personalizationOffset,
      personalizationSampleCount: personalizationData?.sampleCount ?? 0,
      sleepDebt,
      last24hMinutes,
      todayMinutes,
      lastNapDuration,
      awakeSinceLastNap,
      awakeOverrideApplied,
      anchorConstraintApplied,
      baselineAnchor,
      predictedStart,
      anchorBedtime,
      napCountToday,
    },
  };
}

/**
 * Update personalization after the actual nap start is known.
 * This function keeps an exponential moving average of the difference
 * between predicted and actual start times for each nap slot & day segment.
 */
export async function updatePersonalizationAfterNap(
  userId: string,
  napIndex: number,
  bucket: TimeOfDayBucket,
  recommendedStart: Date,
  actualStart: Date,
): Promise<void> {
  const diffMinutes = clamp(
    minutesBetween(actualStart, recommendedStart),
    -PERSONALIZATION_CLAMP,
    PERSONALIZATION_CLAMP,
  );

  const key = getPersonalizationKey(userId, napIndex, bucket);
  const existing = personalizationStore.get(key);

  if (!existing) {
    personalizationStore.set(key, {
      offsetMinutes: diffMinutes,
      sampleCount: 1,
      lastUpdated: new Date().toISOString(),
    });
    return;
  }

  const alpha = PERSONALIZATION_ALPHA;
  const newOffset =
    existing.offsetMinutes + alpha * (diffMinutes - existing.offsetMinutes);

  personalizationStore.set(key, {
    offsetMinutes: clamp(newOffset, -PERSONALIZATION_CLAMP, PERSONALIZATION_CLAMP),
    sampleCount: Math.min(existing.sampleCount + 1, 50),
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * Expose personalization data for debugging or persistence.
 */
export function getPersonalizationSnapshot(): Record<string, PersonalizationData> {
  return Object.fromEntries(personalizationStore.entries());
}

/**
 * Allow tests to reset the in-memory personalization cache.
 */
export function resetPersonalizationSnapshot(): void {
  personalizationStore.clear();
}

function normalizeEntries(entries: SleepEntry[]): NormalizedEntry[] {
  return entries
    .map((entry) => {
      const start = parseDate(entry.start_time);
      const end = entry.end_time ? parseDate(entry.end_time) : undefined;

      let duration: number | null = entry.duration_minutes ?? null;
      if (duration === null && start && end) {
        duration = minutesBetween(end, start);
      }

      if (!start) {
        return null;
      }

      return {
        id: entry.id,
        start,
        end: end ?? null,
        duration,
        raw: entry,
      };
    })
    .filter((entry): entry is NormalizedEntry => Boolean(entry));
}

function getBaselineWindow(
  ageInMonths: number | null,
  napIndex: number,
  reference: Date,
): BaselineResult {
  const profile = getAgeProfile(ageInMonths);
  const windowIndex = Math.max(0, Math.min(profile.baseWindows.length - 1, napIndex - 1));
  const baselineWindow = profile.baseWindows[windowIndex] ?? DEFAULT_WINDOW_MINUTES;
  const targetNapDuration = profile.napDurations[windowIndex] ?? DEFAULT_TARGET_NAP_DURATION;

  const predictedStart = addMinutes(reference, baselineWindow);
  const timeOfDayBucket = getTimeOfDayBucket(predictedStart);

  return { baselineWindow, targetNapDuration, timeOfDayBucket, profile };
}

function getAgeProfile(ageInMonths: number | null): AgeProfile {
  if (ageInMonths === null) {
    return AGE_PROFILES[1];
  }

  return (
    AGE_PROFILES.find((profile) => ageInMonths <= profile.maxMonths) ??
    AGE_PROFILES[AGE_PROFILES.length - 1]
  );
}

function computeDailySleepStats(entries: NormalizedEntry[], reference: Date): {
  last24hMinutes: number;
  todayMinutes: number;
} {
  const last24hThreshold = reference.getTime() - 24 * 60 * 60 * 1000;
  const startOfTodayTs = startOfDay(reference).getTime();

  let last24hMinutes = 0;
  let todayMinutes = 0;

  entries.forEach((entry) => {
    if (!entry.end || entry.duration === null) {
      return;
    }

    if (entry.end.getTime() >= last24hThreshold) {
      last24hMinutes += entry.duration;
    }

    if (entry.end.getTime() >= startOfTodayTs) {
      todayMinutes += entry.duration;
    }
  });

  return { last24hMinutes, todayMinutes };
}

function getAgeInMonths(birthdate: string | Date | null | undefined, reference: Date): number | null {
  if (!birthdate) {
    return null;
  }

  const birth = parseDate(birthdate);
  if (!birth) {
    return null;
  }

  const years = reference.getFullYear() - birth.getFullYear();
  const months = reference.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months - (reference.getDate() < birth.getDate() ? 1 : 0);
  return Math.max(0, totalMonths);
}

function getTimeOfDayBucket(date: Date): TimeOfDayBucket {
  const hour = date.getHours();

  if (hour < 11) {
    return 'morning';
  }
  if (hour < 14) {
    return 'midday';
  }
  if (hour < 18) {
    return 'afternoon';
  }
  return 'evening';
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function minutesBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function resolveAnchorDate(anchor: string, reference: Date): Date | null {
  const match = anchor.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  const anchorDate = new Date(reference);
  anchorDate.setHours(hours, minutes, 0, 0);

  if (anchorDate.getTime() < reference.getTime() - 6 * 60 * 60 * 1000) {
    anchorDate.setDate(anchorDate.getDate() + 1);
  }

  return anchorDate;
}

function getPersonalizationKey(userId: string, napIndex: number, bucket: TimeOfDayBucket): string {
  return `${userId}::${napIndex}::${bucket}`;
}
