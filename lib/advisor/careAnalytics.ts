import type { SleepEntry } from '@/lib/sleepData';
import type { BabyCareEntry } from '@/lib/supabase';
import { getAppLocaleTag, type AppLocale } from '@/lib/localization';

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

const metricMeta = (locale: AppLocale): Record<CareMetricKey, { label: string; emoji: string }> => ({
  sleep: { label: locale === 'en' ? 'Sleep' : locale === 'es' ? 'Sueño' : 'Schlaf', emoji: '💤' },
  feeding: { label: locale === 'en' ? 'Feeds' : locale === 'es' ? 'Tomas' : 'Mahlzeiten', emoji: '🍼' },
  diaper: { label: locale === 'en' ? 'Diapers' : locale === 'es' ? 'Pañales' : 'Windeln', emoji: '💧' },
});

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

const dailyTrend = (days: DailyCareMetric[], locale: AppLocale): CareTrendPoint[] =>
  days.map((day, index) => ({
    key: day.key,
    label:
      days.length <= 7
        ? day.date.toLocaleDateString(getAppLocaleTag(locale), { weekday: 'short' }).replace('.', '')
        : index === 0 || index === days.length - 1 || index % 5 === 0
          ? day.date.toLocaleDateString(getAppLocaleTag(locale), { day: '2-digit', month: '2-digit' })
          : '',
    sleep: day.sleepMinutes > 0 ? day.sleepMinutes : null,
    feeding: day.feedingCount > 0 ? day.feedingCount : null,
    diaper: day.diaperCount > 0 ? day.diaperCount : null,
  }));

const monthlyTrend = (days: DailyCareMetric[], locale: AppLocale): CareTrendPoint[] => {
  const buckets = new Map<string, DailyCareMetric[]>();
  days.forEach((day) => {
    const key = `${day.date.getFullYear()}-${day.date.getMonth()}`;
    buckets.set(key, [...(buckets.get(key) ?? []), day]);
  });
  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const month = bucket[0].date;
    return {
      key,
      label: month.toLocaleDateString(getAppLocaleTag(locale), { month: 'short' }).replace('.', ''),
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

const relationshipLabel = (metric: CareMetricKey, locale: AppLocale) => metricMeta(locale)[metric].label;

const buildRelationship = (days: DailyCareMetric[], locale: AppLocale): CareRelationship => {
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
  const title = `${relationshipLabel(best.x, locale)} & ${relationshipLabel(best.y, locale)}`;
  if (coefficient === null) {
    return {
      ...best,
      coefficient,
      sampleDays: best.points.length,
      title,
      description: locale === 'en' ? `Lotti needs at least 8 days with both values for a reliable comparison. There are currently ${best.points.length}.` : locale === 'es' ? `Lotti necesita al menos 8 días con ambos valores para una comparación fiable. Ahora hay ${best.points.length}.` : `Für eine belastbare Gegenüberstellung braucht Lotti mindestens 8 Tage mit beiden Werten. Aktuell sind es ${best.points.length}.`,
    };
  }

  const clear = Math.abs(coefficient) >= 0.35;
  return {
    ...best,
    coefficient,
    sampleDays: best.points.length,
    title,
    description:
      !clear
        ? locale === 'en' ? `No clear relationship appears across ${best.points.length} shared days.` : locale === 'es' ? `No aparece una relación clara en ${best.points.length} días comunes.` : `In ${best.points.length} gemeinsamen Tagen zeigt sich kein klarer Zusammenhang.`
        : locale === 'en' ? `A ${Math.abs(coefficient) >= 0.6 ? 'clear' : 'slight'} ${coefficient >= 0 ? 'parallel' : 'inverse'} relationship appears across ${best.points.length} shared days. This is a pattern, not a cause.` : locale === 'es' ? `En ${best.points.length} días comunes aparece una relación ${Math.abs(coefficient) >= 0.6 ? 'clara' : 'leve'} ${coefficient >= 0 ? 'paralela' : 'inversa'}. Es un patrón, no una causa.` : `In ${best.points.length} gemeinsamen Tagen zeigt sich ein ${Math.abs(coefficient) >= 0.6 ? 'deutlicher' : 'leichter'} ${coefficient >= 0 ? 'gleichläufiger' : 'gegenläufiger'} Zusammenhang. Das ist ein Muster, keine Ursache.`,
  };
};

const formatMinutes = (minutes: number, locale: AppLocale) => {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  const hour = locale === 'de' ? 'Std' : locale === 'en' ? 'hr' : 'h';
  const minute = locale === 'de' ? 'Min' : 'min';
  return hours > 0 ? `${hours} ${hour}${rest ? ` ${rest} ${minute}` : ''}` : `${rest} ${minute}`;
};

const buildNarrative = (summaries: CareMetricSummary[], coverageDays: number, totalDays: number, locale: AppLocale) => {
  const comparable = summaries
    .filter((summary) => summary.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0));
  const strongest = comparable[0];
  const headline = strongest && Math.abs(strongest.changePercent ?? 0) >= 5
    ? locale === 'en' ? `${strongest.label} ${strongest.changePercent! >= 0 ? 'above' : 'below'} the comparison period` : locale === 'es' ? `${strongest.label} ${strongest.changePercent! >= 0 ? 'por encima' : 'por debajo'} del periodo de comparación` : `${strongest.label} ${strongest.changePercent! >= 0 ? 'über' : 'unter'} dem Vergleichszeitraum`
    : coverageDays >= Math.min(totalDays, 5)
      ? locale === 'en' ? 'Your rhythm is becoming visible' : locale === 'es' ? 'Vuestro ritmo empieza a verse' : 'Euer Rhythmus wird sichtbar'
      : locale === 'en' ? 'Lotti is still learning your rhythm' : locale === 'es' ? 'Lotti aún está aprendiendo vuestro ritmo' : 'Lotti sammelt noch euren Rhythmus';

  const insightLines: string[] = [];
  comparable.slice(0, 2).forEach((summary) => {
    const change = Math.round(Math.abs(summary.changePercent ?? 0));
    if (change < 3) {
      insightLines.push(locale === 'en' ? `${summary.label} was almost stable compared with the previous period.` : locale === 'es' ? `${summary.label} se mantuvo casi estable frente al periodo anterior.` : `${summary.label} war nahezu stabil gegenüber dem Vergleichszeitraum.`);
    } else {
      insightLines.push(locale === 'en' ? `${summary.label} averaged ${change}% ${summary.changePercent! >= 0 ? 'higher' : 'lower'} per day.` : locale === 'es' ? `${summary.label} tuvo una media diaria un ${change} % ${summary.changePercent! >= 0 ? 'mayor' : 'menor'}.` : `${summary.label} lag im Tagesdurchschnitt ${change} % ${summary.changePercent! >= 0 ? 'höher' : 'niedriger'}.`);
    }
  });
  if (insightLines.length === 0) {
    insightLines.push(locale === 'en' ? 'Once several days are recorded in both periods, Lotti can show changes reliably.' : locale === 'es' ? 'Cuando haya varios días registrados en ambos periodos, Lotti mostrará los cambios de forma fiable.' : 'Sobald in beiden Zeiträumen mehrere Tage erfasst sind, zeigt Lotti Veränderungen zuverlässig an.');
  }
  const sleep = summaries.find((summary) => summary.key === 'sleep');
  if (sleep?.value !== null && sleep?.value !== undefined) {
    insightLines.push(locale === 'en' ? `Recorded sleep days averaged ${formatMinutes(sleep.value, locale)}.` : locale === 'es' ? `En los días con sueño registrado, la media fue de ${formatMinutes(sleep.value, locale)}.` : `An erfassten Schlaftagen waren es im Mittel ${formatMinutes(sleep.value, locale)}.`);
  }
  return { headline, insightLines: insightLines.slice(0, 3) };
};

const formatRange = (start: Date, end: Date, locale: AppLocale) => {
  const sameYear = start.getFullYear() === end.getFullYear();
  const localeTag = getAppLocaleTag(locale);
  return `${start.toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: sameYear ? undefined : 'numeric' })} – ${end.toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: 'numeric' })}`;
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
  locale = 'de',
}: {
  period: CareAnalyticsPeriod;
  careEntries: BabyCareEntry[];
  sleepEntries: SleepEntry[];
  now?: Date;
  locale?: AppLocale;
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
  const meta = metricMeta(locale);
  const summaries = (Object.keys(meta) as CareMetricKey[]).map((key) => {
    const current = averageRecorded(currentDays, key);
    const previous = averageRecorded(previousDays, key);
    return {
      key,
      ...meta[key],
      value: current.value,
      previousValue: previous.value,
      changePercent:
        current.recordedDays >= 3 && previous.recordedDays >= 3
          ? percentChange(current.value, previous.value)
          : null,
      recordedDays: current.recordedDays,
    };
  });
  const narrative = buildNarrative(summaries, coverageDays, currentDays.length, locale);

  return {
    period,
    title: period === 'week' ? (locale === 'en' ? 'Weekly report' : locale === 'es' ? 'Informe semanal' : 'Wochenbericht') : period === 'month' ? (locale === 'en' ? 'Monthly report' : locale === 'es' ? 'Informe mensual' : 'Monatsbericht') : (locale === 'en' ? 'Annual report' : locale === 'es' ? 'Informe anual' : 'Jahresbericht'),
    rangeLabel: formatRange(range.currentStart, range.currentEnd, locale),
    comparisonLabel: period === 'year' ? (locale === 'en' ? 'same period last year' : locale === 'es' ? 'mismo periodo del año anterior' : 'gleicher Zeitraum im Vorjahr') : (locale === 'en' ? 'previous period' : locale === 'es' ? 'periodo anterior' : 'vorheriger Zeitraum'),
    coverageDays,
    totalDays: currentDays.length,
    hasData: coverageDays > 0,
    summaries,
    currentTrend: period === 'year' ? monthlyTrend(currentDays, locale) : dailyTrend(currentDays, locale),
    previousTrend: period === 'year' ? monthlyTrend(previousDays, locale) : dailyTrend(previousDays, locale),
    headline: narrative.headline,
    insightLines: narrative.insightLines,
    relationship: buildRelationship(currentDays, locale),
  };
};
