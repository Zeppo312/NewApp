export type TimestampedEntry = {
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
};

export type FeedingBaselines = {
  typicalPerDay: number | null;
  typicalByNow: number | null;
  sampleDays: number;
  typicalIntervalMinutes: number | null;
  intervalSampleCount: number;
};

export type SleepBaseline = {
  todayMinutes: number;
  typicalMinutesByNow: number | null;
  sampleDays: number;
  lastSleepEndAt: string | null;
  currentSleepStartedAt: string | null;
  isSleepingNow: boolean;
  currentAwakeMinutes: number | null;
  typicalWakeMinutes: number | null;
  wakeSampleCount: number;
  lastNightMinutes: number | null;
  typicalNightMinutes: number | null;
  nightSampleDays: number;
  roughNight: boolean;
};

const DAY_MS = 86_400_000;

const validDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const minuteOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

/**
 * Persönliche Fütter-Baselines aus den vergangenen Tagen. `typicalByNow`
 * vergleicht nur mit Einträgen, die an den Vergleichstagen bis zur aktuellen
 * lokalen Uhrzeit erfolgt waren. So wirkt ein Morgen nicht wie ein zu leerer Tag.
 */
export const buildFeedingBaselines = (
  entries: TimestampedEntry[],
  now = new Date(),
  minSampleDays = 3,
): FeedingBaselines => {
  const todayKey = dateKey(now);
  const cutoffMinute = minuteOfDay(now);
  const oldestAllowed = now.getTime() - 14 * DAY_MS;
  const perDay = new Map<string, { total: number; byNow: number }>();
  const starts: Date[] = [];

  for (const entry of entries) {
    const start = validDate(entry.start_time);
    if (!start || start.getTime() < oldestAllowed || start.getTime() > now.getTime()) continue;
    const key = dateKey(start);
    if (key === todayKey) continue;
    starts.push(start);
    const value = perDay.get(key) ?? { total: 0, byNow: 0 };
    value.total += 1;
    if (minuteOfDay(start) <= cutoffMinute) value.byNow += 1;
    perDay.set(key, value);
  }

  if (perDay.size < minSampleDays) {
    return {
      typicalPerDay: null,
      typicalByNow: null,
      sampleDays: perDay.size,
      typicalIntervalMinutes: null,
      intervalSampleCount: 0,
    };
  }

  const values = Array.from(perDay.values());
  const sortedStarts = starts.sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];
  for (let index = 1; index < sortedStarts.length; index += 1) {
    const previous = sortedStarts[index - 1];
    const current = sortedStarts[index];
    if (dateKey(previous) !== dateKey(current)) continue;
    const minutes = Math.round((current.getTime() - previous.getTime()) / 60_000);
    // Sehr kurze Abstände sind meist Teile derselben Mahlzeit; sehr lange
    // Abstände sind typischerweise Nachtpausen und für „gleich“ ungeeignet.
    if (minutes >= 45 && minutes <= 480) intervals.push(minutes);
  }
  return {
    typicalPerDay: average(values.map((value) => value.total)),
    typicalByNow: average(values.map((value) => value.byNow)),
    sampleDays: values.length,
    typicalIntervalMinutes: intervals.length >= 4 ? median(intervals) : null,
    intervalSampleCount: intervals.length,
  };
};

const entryDurationMinutes = (
  entry: TimestampedEntry,
  start: Date,
  end: Date | null,
  now: Date,
): number => {
  if (end && typeof entry.duration_minutes === 'number' && entry.duration_minutes > 0) {
    return entry.duration_minutes;
  }
  const effectiveEnd = end ?? now;
  if (effectiveEnd <= start) return 0;
  return Math.round((effectiveEnd.getTime() - start.getTime()) / 60_000);
};

/**
 * Ordnet Schlaf wie der bestehende Tagestracker dem Tag zu, an dem er startet
 * oder endet. Für historische Vergleichstage zählen nur Schlafphasen, die bis
 * zur aktuellen Uhrzeit bereits bekannt gewesen wären.
 */
const sleepMinutesForDayAtCutoff = (
  entries: TimestampedEntry[],
  day: Date,
  cutoffMinute: number,
  now: Date,
): { minutes: number; hasEntries: boolean } => {
  const targetKey = dateKey(day);
  let minutes = 0;
  let hasEntries = false;

  for (const entry of entries) {
    const start = validDate(entry.start_time);
    if (!start) continue;
    const end = validDate(entry.end_time);
    const startsTarget = dateKey(start) === targetKey;
    const endsTarget = !!end && dateKey(end) === targetKey;
    if (!startsTarget && !endsTarget) continue;
    const knownByCutoff = end
      ? (endsTarget && minuteOfDay(end) <= cutoffMinute) ||
        (!endsTarget && startsTarget && minuteOfDay(start) <= cutoffMinute)
      : dateKey(now) === targetKey && startsTarget && start <= now;
    if (!knownByCutoff) continue;
    hasEntries = true;
    minutes += entryDurationMinutes(entry, start, end, now);
  }

  return { minutes, hasEntries };
};

export const buildSleepBaseline = (
  entries: TimestampedEntry[],
  now = new Date(),
  minSampleDays = 3,
): SleepBaseline => {
  const cutoffMinute = minuteOfDay(now);
  const today = sleepMinutesForDayAtCutoff(entries, now, cutoffMinute, now);
  const historical: number[] = [];
  const parsed = entries
    .map((entry) => ({
      entry,
      start: validDate(entry.start_time),
      end: validDate(entry.end_time),
    }))
    .filter((item): item is { entry: TimestampedEntry; start: Date; end: Date | null } =>
      item.start != null && item.start <= now,
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const ongoing = [...parsed]
    .reverse()
    .find(
      (item) =>
        item.start <= now &&
        (!item.end || item.end > now) &&
        now.getTime() - item.start.getTime() <= 18 * 60 * 60_000,
    );
  const lastEnded = [...parsed]
    .reverse()
    .find((item) => item.end != null && item.end <= now);

  const wakeIntervals: number[] = [];
  for (let index = 1; index < parsed.length; index += 1) {
    const previous = parsed[index - 1];
    const current = parsed[index];
    if (!previous.end || previous.end > current.start) continue;
    if (dateKey(previous.end) !== dateKey(current.start)) continue;
    const endHour = previous.end.getHours();
    if (endHour < 5 || endHour >= 20) continue;
    const minutes = Math.round(
      (current.start.getTime() - previous.end.getTime()) / 60_000,
    );
    if (minutes >= 30 && minutes <= 480) wakeIntervals.push(minutes);
  }

  const nightWindow = (endDay: Date) => {
    const end = new Date(endDay);
    end.setHours(10, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
    return { start, end };
  };
  const minutesInWindow = (start: Date, end: Date): number | null => {
    let minutes = 0;
    let hasEntries = false;
    for (const item of parsed) {
      const itemEnd = item.end ?? now;
      const overlapStart = Math.max(item.start.getTime(), start.getTime());
      const overlapEnd = Math.min(itemEnd.getTime(), end.getTime(), now.getTime());
      if (overlapEnd <= overlapStart) continue;
      hasEntries = true;
      minutes += Math.round((overlapEnd - overlapStart) / 60_000);
    }
    return hasEntries ? minutes : null;
  };

  const latestNight = nightWindow(now);
  const latestNightEnd = now < latestNight.end ? now : latestNight.end;
  const lastNightMinutes = minutesInWindow(latestNight.start, latestNightEnd);
  const historicalNights: number[] = [];
  for (let daysAgo = 1; daysAgo <= 7; daysAgo += 1) {
    const endDay = new Date(now);
    endDay.setDate(endDay.getDate() - daysAgo);
    const window = nightWindow(endDay);
    const value = minutesInWindow(window.start, window.end);
    if (value != null) historicalNights.push(value);
  }
  const typicalNightMinutes =
    historicalNights.length >= minSampleDays ? median(historicalNights) : null;

  for (let daysAgo = 1; daysAgo <= 14; daysAgo += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - daysAgo);
    const value = sleepMinutesForDayAtCutoff(entries, day, cutoffMinute, now);
    if (value.hasEntries) historical.push(value.minutes);
  }

  return {
    todayMinutes: today.minutes,
    typicalMinutesByNow:
      historical.length >= minSampleDays ? average(historical) : null,
    sampleDays: historical.length,
    lastSleepEndAt: lastEnded?.end?.toISOString() ?? null,
    currentSleepStartedAt: ongoing?.start.toISOString() ?? null,
    isSleepingNow: !!ongoing,
    currentAwakeMinutes:
      ongoing || !lastEnded?.end
        ? null
        : Math.max(0, Math.round((now.getTime() - lastEnded.end.getTime()) / 60_000)),
    typicalWakeMinutes: wakeIntervals.length >= 4 ? median(wakeIntervals) : null,
    wakeSampleCount: wakeIntervals.length,
    lastNightMinutes,
    typicalNightMinutes,
    nightSampleDays: historicalNights.length,
    roughNight:
      now.getHours() >= 6 &&
      !ongoing &&
      lastNightMinutes != null &&
      typicalNightMinutes != null &&
      lastNightMinutes + 60 < typicalNightMinutes * 0.75,
  };
};

/** Anteil des typischen aktiven Tages, der bereits vergangen ist (06–22 Uhr). */
export const activeDayProgress = (localHour: number, localMinute = 0): number => {
  const minutes = localHour * 60 + localMinute;
  return Math.max(0, Math.min(1, (minutes - 6 * 60) / (16 * 60)));
};
