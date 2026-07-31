import type { SleepEntry } from '@/lib/sleepData';
import type { BabyCareEntry } from '@/lib/supabase';

export type CareAnalyticsPeriod = 'week' | 'month' | 'year';
export type CareMetricKey = 'sleep' | 'feeding' | 'diaper';

type DailyCareMetric = {
  date: Date;
  key: string;
  sleepMinutes: number;
  feedingCount: number;
  diaperCount: number;
  bottleMl: number;
};

export type CareTrendPoint = {
  key: string;
  label: string;
  sleep: number | null;
  feeding: number | null;
  diaper: number | null;
};

export type CareMetricSummary = {
  key: CareMetricKey;
  label: string;
  emoji: string;
  value: number | null;
  previousValue: number | null;
  changePercent: number | null;
  recordedDays: number;
};

export type CareRelationship = {
  x: CareMetricKey;
  y: CareMetricKey;
  coefficient: number | null;
  sampleDays: number;
  title: string;
  description: string;
  points: { x: number; y: number; key: string }[];
};

export type CareAnalyticsReport = {
  period: CareAnalyticsPeriod;
  title: string;
  rangeLabel: string;
  comparisonLabel: string;
  coverageDays: number;
  totalDays: number;
  hasData: boolean;
  summaries: CareMetricSummary[];
  currentTrend: CareTrendPoint[];
  previousTrend: CareTrendPoint[];
  headline: string;
  insightLines: string[];
  relationship: CareRelationship;
};

const METRIC_META: Record<CareMetricKey, { label: string; emoji: string }> = {
  sleep: { label: 'Schlaf', emoji: '💤' },
  feeding: { label: 'Mahlzeiten', emoji: '🍼' },
  diaper: { label: 'Windeln', emoji: '💧' },
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const addYears = (value: Date, years: number) => {
  const date = new Date(value);
  date.setFullYear(date.getFullYear() + years);
  return date;
};

const dateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const validDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const daysBetweenInclusive = (start: Date, end: Date) => {
  const days: Date[] = [];
  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
};

const periodRange = (period: CareAnalyticsPeriod, now: Date) => {
  const currentEnd = new Date(now);
  if (period === 'week' || period === 'month') {
    const length = period === 'week' ? 7 : 30;
    const currentStart = startOfDay(addDays(now, -(length - 1)));
    const previousStart = startOfDay(addDays(currentStart, -length));
    const previousEnd = addDays(now, -length);
    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  const currentStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const previousStart = addYears(currentStart, -1);
  const previousEnd = addYears(now, -1);
  return { currentStart, currentEnd, previousStart, previousEnd };
};

const emptyDailyMetrics = (start: Date, end: Date): DailyCareMetric[] =>
  daysBetweenInclusive(start, end).map((date) => ({
    date,
    key: dateKey(date),
    sleepMinutes: 0,
    feedingCount: 0,
    diaperCount: 0,
    bottleMl: 0,
  }));

const buildDailyMetrics = (
  start: Date,
  end: Date,
  careEntries: BabyCareEntry[],
  sleepEntries: SleepEntry[],
  now: Date,
) => {
  const days = emptyDailyMetrics(start, end);
  const byKey = new Map(days.map((day) => [day.key, day]));

  careEntries.forEach((entry) => {
    const entryDate = validDate(entry.start_time);
    if (!entryDate || entryDate < start || entryDate > end) return;
    const target = byKey.get(dateKey(entryDate));
    if (!target) return;
    if (entry.entry_type === 'feeding') {
      // Abpumpen und Wasser sind wichtige Logs, aber keine Mahlzeiten.
      if (entry.feeding_type !== 'PUMP' && entry.feeding_type !== 'WATER') {
        target.feedingCount += 1;
      }
      if (
        entry.feeding_type === 'BOTTLE' &&
        typeof entry.feeding_volume_ml === 'number' &&
        entry.feeding_volume_ml > 0
      ) {
        target.bottleMl += entry.feeding_volume_ml;
      }
    } else if (entry.entry_type === 'diaper') {
      target.diaperCount += 1;
    }
  });

  sleepEntries.forEach((entry) => {
    const sleepStart = validDate(entry.start_time);
    if (!sleepStart) return;
    let sleepEnd = validDate(entry.end_time);
    if (!sleepEnd && typeof entry.duration_minutes === 'number' && entry.duration_minutes > 0) {
      sleepEnd = new Date(sleepStart.getTime() + entry.duration_minutes * 60_000);
    }
    if (!sleepEnd) sleepEnd = now;
    if (sleepEnd <= sleepStart || sleepEnd < start || sleepStart > end) return;

    const firstDay = startOfDay(sleepStart < start ? start : sleepStart);
    const lastDay = startOfDay(sleepEnd > end ? end : sleepEnd);
    for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
      const target = byKey.get(dateKey(day));
      if (!target) continue;
      const dayStart = startOfDay(day).getTime();
      const dayEnd = addDays(startOfDay(day), 1).getTime();
      const overlapStart = Math.max(sleepStart.getTime(), dayStart, start.getTime());
      const overlapEnd = Math.min(sleepEnd.getTime(), dayEnd, end.getTime() + 1);
      if (overlapEnd > overlapStart) {
        target.sleepMinutes += Math.round((overlapEnd - overlapStart) / 60_000);
      }
    }
  });

  return days;
};

const dailyValue = (day: DailyCareMetric, metric: CareMetricKey) => {
  if (metric === 'sleep') return day.sleepMinutes;
  if (metric === 'feeding') return day.feedingCount;
  return day.diaperCount;
};

const averageRecorded = (days: DailyCareMetric[], metric: CareMetricKey) => {
  const values = days.map((day) => dailyValue(day, metric)).filter((value) => value > 0);
  if (values.length === 0) return { value: null, recordedDays: 0 };
  return {
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
    recordedDays: values.length,
  };
};

const percentChange = (current: number | null, previous: number | null) => {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

const dailyTrend = (days: DailyCareMetric[]): CareTrendPoint[] =>
  days.map((day, index) => ({
    key: day.key,
    label:
      days.length <= 7
        ? day.date.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')
        : index === 0 || index === days.length - 1 || index % 5 === 0
          ? day.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
          : '',
    sleep: day.sleepMinutes > 0 ? day.sleepMinutes : null,
    feeding: day.feedingCount > 0 ? day.feedingCount : null,
    diaper: day.diaperCount > 0 ? day.diaperCount : null,
  }));

const monthlyTrend = (days: DailyCareMetric[]): CareTrendPoint[] => {
  const buckets = new Map<string, DailyCareMetric[]>();
  days.forEach((day) => {
    const key = `${day.date.getFullYear()}-${day.date.getMonth()}`;
    buckets.set(key, [...(buckets.get(key) ?? []), day]);
  });
  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const month = bucket[0].date;
    return {
      key,
      label: month.toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''),
      sleep: averageRecorded(bucket, 'sleep').value,
      feeding: averageRecorded(bucket, 'feeding').value,
      diaper: averageRecorded(bucket, 'diaper').value,
    };
  });
};

const pearson = (pairs: { x: number; y: number }[]): number | null => {
  if (pairs.length < 8) return null;
  const xMean = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
  const yMean = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;
  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;
  pairs.forEach((pair) => {
    const xDelta = pair.x - xMean;
    const yDelta = pair.y - yMean;
    numerator += xDelta * yDelta;
    xVariance += xDelta * xDelta;
    yVariance += yDelta * yDelta;
  });
  const denominator = Math.sqrt(xVariance * yVariance);
  return denominator > 0 ? numerator / denominator : null;
};

const relationshipLabel = (metric: CareMetricKey) => METRIC_META[metric].label;

const buildRelationship = (days: DailyCareMetric[]): CareRelationship => {
  const candidates: [CareMetricKey, CareMetricKey][] = [
    ['feeding', 'sleep'],
    ['diaper', 'sleep'],
    ['feeding', 'diaper'],
  ];
  const ranked = candidates
    .map(([x, y]) => {
      const points = days
        .map((day) => ({ x: dailyValue(day, x), y: dailyValue(day, y), key: day.key }))
        .filter((point) => point.x > 0 && point.y > 0);
      return { x, y, points, coefficient: pearson(points) };
    })
    .sort((a, b) => Math.abs(b.coefficient ?? 0) - Math.abs(a.coefficient ?? 0));

  const best = ranked[0];
  const coefficient = best.coefficient;
  const title = `${relationshipLabel(best.x)} & ${relationshipLabel(best.y)}`;
  if (coefficient === null) {
    return {
      ...best,
      coefficient,
      sampleDays: best.points.length,
      title,
      description: `Für eine belastbare Gegenüberstellung braucht Lotti mindestens 8 Tage mit beiden Werten. Aktuell sind es ${best.points.length}.`,
    };
  }

  const strength = Math.abs(coefficient) >= 0.6 ? 'deutlicher' : Math.abs(coefficient) >= 0.35 ? 'leichter' : 'kein klarer';
  const direction = coefficient >= 0 ? 'gleichläufiger' : 'gegenläufiger';
  return {
    ...best,
    coefficient,
    sampleDays: best.points.length,
    title,
    description:
      strength === 'kein klarer'
        ? `In ${best.points.length} gemeinsamen Tagen zeigt sich kein klarer Zusammenhang.`
        : `In ${best.points.length} gemeinsamen Tagen zeigt sich ein ${strength} ${direction} Zusammenhang. Das ist ein Muster, keine Ursache.`,
  };
};

const formatMinutes = (minutes: number) => {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours > 0 ? `${hours} Std${rest ? ` ${rest} Min` : ''}` : `${rest} Min`;
};

const buildNarrative = (summaries: CareMetricSummary[], coverageDays: number, totalDays: number) => {
  const comparable = summaries
    .filter((summary) => summary.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0));
  const strongest = comparable[0];
  const headline = strongest && Math.abs(strongest.changePercent ?? 0) >= 5
    ? `${strongest.label} ${strongest.changePercent! >= 0 ? 'über' : 'unter'} dem Vergleichszeitraum`
    : coverageDays >= Math.min(totalDays, 5)
      ? 'Euer Rhythmus wird sichtbar'
      : 'Lotti sammelt noch euren Rhythmus';

  const insightLines: string[] = [];
  comparable.slice(0, 2).forEach((summary) => {
    const change = Math.round(Math.abs(summary.changePercent ?? 0));
    if (change < 3) {
      insightLines.push(`${summary.label} war nahezu stabil gegenüber dem Vergleichszeitraum.`);
    } else {
      insightLines.push(`${summary.label} lag im Tagesdurchschnitt ${change} % ${summary.changePercent! >= 0 ? 'höher' : 'niedriger'}.`);
    }
  });
  if (insightLines.length === 0) {
    insightLines.push('Sobald in beiden Zeiträumen mehrere Tage erfasst sind, zeigt Lotti Veränderungen zuverlässig an.');
  }
  const sleep = summaries.find((summary) => summary.key === 'sleep');
  if (sleep?.value !== null && sleep?.value !== undefined) {
    insightLines.push(`An erfassten Schlaftagen waren es im Mittel ${formatMinutes(sleep.value)}.`);
  }
  return { headline, insightLines: insightLines.slice(0, 3) };
};

const formatRange = (start: Date, end: Date) => {
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: sameYear ? undefined : 'numeric' })} – ${end.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

export const getCareAnalyticsEarliestDate = (now = new Date()) => {
  const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return addYears(yearStart, -1);
};

export const buildCareAnalyticsReport = ({
  period,
  careEntries,
  sleepEntries,
  now = new Date(),
}: {
  period: CareAnalyticsPeriod;
  careEntries: BabyCareEntry[];
  sleepEntries: SleepEntry[];
  now?: Date;
}): CareAnalyticsReport => {
  const range = periodRange(period, now);
  const currentDays = buildDailyMetrics(
    range.currentStart,
    range.currentEnd,
    careEntries,
    sleepEntries,
    now,
  );
  const previousDays = buildDailyMetrics(
    range.previousStart,
    range.previousEnd,
    careEntries,
    sleepEntries,
    now,
  );
  const coverageDays = currentDays.filter(
    (day) => day.sleepMinutes > 0 || day.feedingCount > 0 || day.diaperCount > 0,
  ).length;
  const summaries = (Object.keys(METRIC_META) as CareMetricKey[]).map((key) => {
    const current = averageRecorded(currentDays, key);
    const previous = averageRecorded(previousDays, key);
    return {
      key,
      ...METRIC_META[key],
      value: current.value,
      previousValue: previous.value,
      changePercent:
        current.recordedDays >= 3 && previous.recordedDays >= 3
          ? percentChange(current.value, previous.value)
          : null,
      recordedDays: current.recordedDays,
    };
  });
  const narrative = buildNarrative(summaries, coverageDays, currentDays.length);

  return {
    period,
    title: period === 'week' ? 'Wochenbericht' : period === 'month' ? 'Monatsbericht' : 'Jahresbericht',
    rangeLabel: formatRange(range.currentStart, range.currentEnd),
    comparisonLabel: period === 'year' ? 'gleicher Zeitraum im Vorjahr' : 'vorheriger Zeitraum',
    coverageDays,
    totalDays: currentDays.length,
    hasData: coverageDays > 0,
    summaries,
    currentTrend: period === 'year' ? monthlyTrend(currentDays) : dailyTrend(currentDays),
    previousTrend: period === 'year' ? monthlyTrend(previousDays) : dailyTrend(previousDays),
    headline: narrative.headline,
    insightLines: narrative.insightLines,
    relationship: buildRelationship(currentDays),
  };
};
