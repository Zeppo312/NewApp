import type { SleepEntry } from '@/lib/sleepData';
import type { BabyCareEntry } from '@/lib/supabase';
import { getAppLocaleTag, type AppLocale } from '@/lib/localization';
import { translateCareAnalytics } from './careAnalyticsTranslations';

export type CareAnalyticsPeriod = 'week' | 'month' | 'year';
export type CareMetricKey = 'sleep' | 'feeding' | 'diaper';

type DailyCareMetric = {
  date: Date;
  key: string;
  sleepMinutes: number;
  feedingCount: number;
  diaperCount: number;
  bottleMl: number;
  isPartial: boolean;
  entries: Record<CareMetricKey, CareEvidenceEntry[]>;
};

export type CareEvidenceEntry = {
  key: string;
  startTime: string;
  endTime: string | null;
  label: string;
  minutes: number | null;
  ongoing: boolean;
};

export type CareDayCoverage = {
  key: string;
  label: string;
  status: 'missing' | 'partial' | 'present';
  isToday: boolean;
  openSleep: boolean;
  missingMetrics: CareMetricKey[];
  counts: Record<CareMetricKey, number>;
};

export type CareAnalyticsInsight = {
  key: CareMetricKey;
  observation: string;
  action: string;
  evidence: string;
  previousEvidence: string;
  entries: CareEvidenceEntry[];
  previousEntries: CareEvidenceEntry[];
  pendingEntries: CareEvidenceEntry[];
};

export type CareTrendPoint = {
  key: string;
  label: string;
  sleep: number | null;
  feeding: number | null;
  diaper: number | null;
  partial: boolean;
  openSleep: boolean;
};

export type CareMetricSummary = {
  key: CareMetricKey;
  label: string;
  emoji: string;
  value: number | null;
  previousValue: number | null;
  changePercent: number | null;
  recordedDays: number;
  previousRecordedDays: number;
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
  insights: CareAnalyticsInsight[];
  dayCoverage: CareDayCoverage[];
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
    isPartial: addDays(date, 1).getTime() > end.getTime(),
    entries: { sleep: [], feeding: [], diaper: [] },
  }));

const buildDailyMetrics = (
  start: Date,
  end: Date,
  careEntries: BabyCareEntry[],
  sleepEntries: SleepEntry[],
  now: Date,
  locale: AppLocale,
) => {
  const days = emptyDailyMetrics(start, end);
  const byKey = new Map(days.map((day) => [day.key, day]));

  careEntries.forEach((entry, index) => {
    const entryDate = validDate(entry.start_time);
    if (!entryDate || entryDate < start || entryDate > end) return;
    const target = byKey.get(dateKey(entryDate));
    if (!target) return;
    if (entry.entry_type === 'feeding') {
      // Abpumpen und Wasser sind wichtige Logs, aber keine Mahlzeiten.
      if (entry.feeding_type !== 'PUMP' && entry.feeding_type !== 'WATER') {
        target.feedingCount += 1;
        const label = entry.feeding_type === 'BREAST' ? 'breast' : entry.feeding_type === 'BOTTLE' ? 'bottle' : entry.feeding_type === 'SOLIDS' ? 'solids' : 'feeding';
        target.entries.feeding.push({
          key: entry.id ?? `care-${index}`,
          startTime: entryDate.toISOString(), endTime: entry.end_time ?? null,
          label: translateCareAnalytics(locale, label), minutes: null, ongoing: false,
        });
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
      const label = entry.diaper_type === 'WET' ? 'wet' : entry.diaper_type === 'DIRTY' ? 'dirty' : entry.diaper_type === 'BOTH' ? 'both' : 'diaper';
      target.entries.diaper.push({
        key: entry.id ?? `care-${index}`,
        startTime: entryDate.toISOString(), endTime: null,
        label: translateCareAnalytics(locale, label), minutes: null, ongoing: false,
      });
    }
  });

  sleepEntries.forEach((entry, index) => {
    const sleepStart = validDate(entry.start_time);
    if (!sleepStart) return;
    let sleepEnd = validDate(entry.end_time);
    if (!sleepEnd && typeof entry.duration_minutes === 'number' && entry.duration_minutes > 0) {
      sleepEnd = new Date(sleepStart.getTime() + entry.duration_minutes * 60_000);
    }
    const ongoing = !sleepEnd;
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
        const minutes = (overlapEnd - overlapStart) / 60_000;
        target.sleepMinutes += minutes;
        target.entries.sleep.push({
          key: entry.id ?? `sleep-${index}`,
          startTime: sleepStart.toISOString(),
          endTime: ongoing ? null : sleepEnd.toISOString(),
          label: translateCareAnalytics(locale, 'sleep'), minutes, ongoing,
        });
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
  const values = eligibleDays(days, metric).map((day) => dailyValue(day, metric));
  if (values.length === 0) return { value: null, recordedDays: 0 };
  return {
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
    recordedDays: values.length,
  };
};

const eligibleDays = (days: DailyCareMetric[], metric: CareMetricKey) =>
  days.filter((day) => !day.isPartial && dailyValue(day, metric) > 0 && !day.entries[metric].some((entry) => entry.ongoing));

const evidenceEntries = (days: DailyCareMetric[], metric: CareMetricKey) => {
  const entries = new Map<string, CareEvidenceEntry>();
  days.flatMap((day) => day.entries[metric]).forEach((entry) => {
    const previous = entries.get(entry.key);
    entries.set(entry.key, { ...entry, minutes: entry.minutes === null ? null : entry.minutes + (previous?.minutes ?? 0) });
  });
  return [...entries.values()].sort((a, b) => b.startTime.localeCompare(a.startTime));
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
    partial: day.isPartial,
    openSleep: day.entries.sleep.some((entry) => entry.ongoing),
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
      partial: bucket.some((day) => day.isPartial),
      openSleep: bucket.some((day) => day.entries.sleep.some((entry) => entry.ongoing)),
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
        .filter((day) => !day.isPartial && !day.entries[x].some((entry) => entry.ongoing) && !day.entries[y].some((entry) => entry.ongoing))
        .map((day) => ({ x: dailyValue(day, x), y: dailyValue(day, y), key: day.key }))
        .filter((point) => point.x > 0 && point.y > 0);
      return { x, y, points, coefficient: pearson(points) };
    })
    .sort((a, b) => Math.abs(b.coefficient ?? 0) - Math.abs(a.coefficient ?? 0) || b.points.length - a.points.length);

  const best = ranked[0];
  const coefficient = best.coefficient;
  const title = `${relationshipLabel(best.x, locale)} & ${relationshipLabel(best.y, locale)}`;
  if (coefficient === null) {
    return {
      ...best,
      coefficient,
      sampleDays: best.points.length,
      title,
      description: best.points.length >= 8
        ? locale === 'en' ? 'The recorded daily values vary too little to calculate a relationship.' : locale === 'es' ? 'Los valores diarios registrados varían demasiado poco para calcular una relación.' : 'Die erfassten Tageswerte variieren zu wenig, um einen Zusammenhang zu berechnen.'
        : locale === 'en' ? `This comparison needs at least 8 finished days with both values. There are currently ${best.points.length}.` : locale === 'es' ? `Esta comparación necesita al menos 8 días finalizados con ambos valores. Ahora hay ${best.points.length}.` : `Für diese Gegenüberstellung braucht Lotti mindestens 8 Tage mit beiden Werten, jeweils abgeschlossen. Aktuell sind es ${best.points.length}.`,
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

const buildInsights = (summaries: CareMetricSummary[], days: DailyCareMetric[], previousDays: DailyCareMetric[], locale: AppLocale): CareAnalyticsInsight[] => {
  const t = (key: Parameters<typeof translateCareAnalytics>[1], params?: Record<string, string | number>) => translateCareAnalytics(locale, key, params);
  return summaries.map((summary) => {
    const includedDays = eligibleDays(days, summary.key);
    const entries = evidenceEntries(includedDays, summary.key);
    const previousEntries = evidenceEntries(eligibleDays(previousDays, summary.key), summary.key);
    const pendingEntries = evidenceEntries(days.filter((day) => !includedDays.includes(day)), summary.key);
    const unit = t(summary.key === 'sleep' ? 'sleepUnit' : summary.key);
    const valueText = (value: number | null) => value === null ? '–' : summary.key === 'sleep' ? formatMinutes(value, locale) : value.toLocaleString(getAppLocaleTag(locale), { maximumFractionDigits: 1 });
    const observation = summary.value === null ? t('noAverage') : t('average', { value: valueText(summary.value), unit });
    const change = summary.changePercent;
    const comparison = change === null ? t('noComparison') : Math.abs(change) < 3 ? t('stable') : t(change >= 0 ? 'higher' : 'lower', { percent: Math.round(Math.abs(change)) });
    const hasGaps = days.some((day) => !day.isPartial && (dailyValue(day, summary.key) === 0 || day.entries[summary.key].some((entry) => entry.ongoing)))
      || previousDays.some((day) => !day.isPartial && dailyValue(day, summary.key) === 0);
    return {
      key: summary.key,
      observation: `${observation} ${comparison}`,
      action: pendingEntries.some((entry) => entry.ongoing) ? t('finish') : summary.value === null ? t('start') : hasGaps ? t('check') : t('keep'),
      evidence: t('evidence', { count: entries.length, days: summary.recordedDays, value: valueText(summary.value), unit }),
      previousEvidence: t('evidence', { count: previousEntries.length, days: summary.previousRecordedDays, value: valueText(summary.previousValue), unit }),
      entries, previousEntries, pendingEntries,
    };
  });
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
    locale,
  );
  const previousDays = buildDailyMetrics(
    range.previousStart,
    range.previousEnd,
    careEntries,
    sleepEntries,
    now,
    locale,
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
      previousRecordedDays: previous.recordedDays,
    };
  });
  const dayCoverage: CareDayCoverage[] = currentDays.map((day) => {
    const missingMetrics = (Object.keys(meta) as CareMetricKey[]).filter((key) => day.entries[key].length === 0);
    return {
      key: day.key,
      label: day.date.toLocaleDateString(getAppLocaleTag(locale), { day: '2-digit', month: 'short', year: period === 'year' ? 'numeric' : undefined }),
      status: missingMetrics.length === 3 ? 'missing' : missingMetrics.length > 0 ? 'partial' : 'present',
      isToday: day.key === dateKey(now),
      openSleep: day.entries.sleep.some((entry) => entry.ongoing),
      missingMetrics,
      counts: { sleep: day.entries.sleep.length, feeding: day.feedingCount, diaper: day.diaperCount },
    };
  });

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
    headline: translateCareAnalytics(locale, 'headline'),
    insights: buildInsights(summaries, currentDays, previousDays, locale),
    dayCoverage,
    relationship: buildRelationship(currentDays, locale),
  };
};
