import type {
  CycleDailyLog,
  CyclePeriod,
  CycleSettings,
} from './cycleData';
import {
  DEFAULT_CYCLE_LOCALE,
  translateCycleText,
  type CycleLocale,
} from './cycleTranslations';

export type CyclePhaseKind = 'period' | 'follicular' | 'fertile' | 'luteal';
export type CycleFactorKey = 'calendar' | 'lh' | 'mucus' | 'bbt';
export type CycleFertilityLevel = 'low' | 'medium' | 'high' | 'peak';

export type CyclePhaseSegment = {
  kind: CyclePhaseKind;
  startDay: number;
  endDay: number;
};

export type CyclePredictionFactor = {
  key: CycleFactorKey;
  label: string;
  detail: string;
  active: boolean;
  pct: number;
};

export type CyclePredictionMode = 'default' | 'postpartum' | 'perimenopause';

export type CyclePrediction = {
  hasEnoughData: boolean;
  mode: CyclePredictionMode;
  /** Sanfter Hinweis für den Modus (Wochenbett/Stillzeit/Perimenopause), sonst null. */
  modeNote: string | null;
  currentDay: number;
  cycleLength: number;
  periodLength: number;
  ovulationDay: number;
  fertileStartDay: number;
  fertileEndDay: number;
  confidence: number;
  uncertaintyDays: number;
  fertilityScore: number;
  fertilityLevel: CycleFertilityLevel;
  headline: string;
  subline: string;
  caption: string;
  insight: string;
  factors: CyclePredictionFactor[];
  phases: CyclePhaseSegment[];
  nextPeriodWindow: {
    startDate: string | null;
    endDate: string | null;
    anchorDate: string | null;
  };
  ovulationWindow: {
    startDate: string | null;
    endDate: string | null;
    anchorDate: string | null;
  };
  fertileWindow: {
    startDate: string | null;
    endDate: string | null;
  };
  lastPeriod: {
    startDate: string | null;
    endDate: string | null;
  };
  todayLog: CycleDailyLog | null;
};

type BuildCyclePredictionInput = {
  settings: CycleSettings | null;
  periods: CyclePeriod[];
  dailyLogs: CycleDailyLog[];
  referenceDate?: Date;
  locale?: CycleLocale;
};

type CycleTranslator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

type DerivedPeriod = {
  startDate: string;
  endDate: string;
};

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const DEFAULT_LUTEAL_PHASE = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const MUCUS_SCORE_MAP: Record<string, number> = {
  dry: 0,
  sticky: 0.2,
  creamy: 0.5,
  watery: 0.8,
  eggwhite: 1,
};

const CALENDAR_WINDOW_FLOOR_BY_OFFSET: Record<string, number> = {
  '5': 0.3,
  '4': 0.36,
  '3': 0.44,
  '2': 0.58,
  '1': 0.74,
  '0': 0.88,
  '-1': 0.32,
};

const toDateOnly = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDateOnly(value);
  date.setHours(12, 0, 0, 0);
  return date;
};

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year ?? 2000, (month ?? 1) - 1, day ?? 1);
  date.setHours(12, 0, 0, 0);
  return date;
};

const dateToKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date.getTime());
  next.setTime(next.getTime() + amount * DAY_MS);
  next.setHours(12, 0, 0, 0);
  return next;
};

const diffDays = (left: Date, right: Date) =>
  Math.round((toDateOnly(left).getTime() - toDateOnly(right).getTime()) / DAY_MS);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

const standardDeviation = (values: number[]) => {
  if (values.length <= 1) return 0;
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const medianAbsoluteDeviation = (values: number[]) => {
  const med = median(values);
  if (med === null) return 0;
  const deviations = values.map((value) => Math.abs(value - med));
  return median(deviations) ?? 0;
};

const weightedAverage = (values: number[]) => {
  if (!values.length) return null;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const weight = index + 1;
    numerator += value * weight;
    denominator += weight;
  });
  return denominator > 0 ? numerator / denominator : null;
};

const computeAdaptiveAlpha = (sigma: number) => {
  if (sigma <= 2) return 0.25;
  if (sigma <= 5) return 0.4;
  return 0.5;
};

const exponentialMovingAverage = (values: number[], alpha: number) => {
  if (!values.length) return null;
  return values.slice(1).reduce((accumulator, value) => {
    return alpha * value + (1 - alpha) * accumulator;
  }, values[0]);
};

const uniqueDates = (dates: Date[]) => {
  const seen = new Set<string>();
  const unique: Date[] = [];
  for (const date of dates) {
    const key = dateToKey(date);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(date);
  }
  return unique;
};

const sortPeriodsAsc = (periods: DerivedPeriod[]) =>
  [...periods].sort(
    (left, right) =>
      parseDateOnly(left.startDate).getTime() - parseDateOnly(right.startDate).getTime(),
  );

const buildPeriodsFromLogs = (dailyLogs: CycleDailyLog[]): DerivedPeriod[] => {
  const bleedingLogs = [...dailyLogs]
    .filter((log) => log.bleeding_intensity !== 'none' || log.spotting)
    .sort((left, right) => parseDateOnly(left.entry_date).getTime() - parseDateOnly(right.entry_date).getTime());

  if (!bleedingLogs.length) return [];

  const periods: DerivedPeriod[] = [];
  let currentStart = bleedingLogs[0].entry_date;
  let currentEnd = bleedingLogs[0].entry_date;

  for (let index = 1; index < bleedingLogs.length; index += 1) {
    const currentDate = parseDateOnly(bleedingLogs[index].entry_date);
    const previousDate = parseDateOnly(bleedingLogs[index - 1].entry_date);
    if (diffDays(currentDate, previousDate) <= 1) {
      currentEnd = bleedingLogs[index].entry_date;
      continue;
    }

    periods.push({ startDate: currentStart, endDate: currentEnd });
    currentStart = bleedingLogs[index].entry_date;
    currentEnd = bleedingLogs[index].entry_date;
  }

  periods.push({ startDate: currentStart, endDate: currentEnd });
  return periods;
};

const mergePeriods = (settings: CycleSettings | null, periods: CyclePeriod[], dailyLogs: CycleDailyLog[]) => {
  const map = new Map<string, DerivedPeriod>();

  periods.forEach((period) => {
    map.set(period.period_start_date, {
      startDate: period.period_start_date,
      endDate: period.period_end_date,
    });
  });

  if (settings?.last_period_start_date && settings.last_period_end_date) {
    map.set(settings.last_period_start_date, {
      startDate: settings.last_period_start_date,
      endDate: settings.last_period_end_date,
    });
  }

  for (const period of buildPeriodsFromLogs(dailyLogs)) {
    if (!map.has(period.startDate)) {
      map.set(period.startDate, period);
    }
  }

  return sortPeriodsAsc(Array.from(map.values()));
};

const sanitizeCycleLengths = (cycleLengths: number[]) => {
  const plausible = cycleLengths.filter((value) => value >= 15 && value <= 60);
  if (plausible.length <= 2) return plausible;

  const med = median(plausible);
  const mad = medianAbsoluteDeviation(plausible);
  if (med === null || mad === 0) return plausible;

  const maxDeviation = Math.max(4, mad * 3);
  return plausible.filter((value) => Math.abs(value - med) <= maxDeviation);
};

const deriveBbtConfirmedOvulationDates = (dailyLogs: CycleDailyLog[]) => {
  const logsWithBbt = [...dailyLogs]
    .filter((entry) => typeof entry.bbt_celsius === 'number')
    .sort((left, right) => parseDateOnly(left.entry_date).getTime() - parseDateOnly(right.entry_date).getTime());

  const candidates: Date[] = [];
  for (let index = 6; index <= logsWithBbt.length - 3; index += 1) {
    const previousWindow = logsWithBbt.slice(index - 6, index);
    const nextThree = logsWithBbt.slice(index, index + 3);
    if (previousWindow.length < 6 || nextThree.length < 3) continue;

    const baseline = mean(previousWindow.map((entry) => entry.bbt_celsius ?? 0));
    const isShiftConfirmed = nextThree.every((entry) => (entry.bbt_celsius ?? 0) >= baseline + 0.2);
    if (!isShiftConfirmed) continue;

    candidates.push(addDays(parseDateOnly(nextThree[0].entry_date), -1));
  }

  return uniqueDates(candidates);
};

const derivePersonalLutealPhase = (periods: DerivedPeriod[], dailyLogs: CycleDailyLog[], fallback: number) => {
  const periodsAsc = sortPeriodsAsc(periods);
  if (!periodsAsc.length) return fallback;

  const bbtCandidates = deriveBbtConfirmedOvulationDates(dailyLogs);
  const lhCandidates = dailyLogs
    .filter((entry) => entry.lh_test_result === 'peak')
    .map((entry) => addDays(parseDateOnly(entry.entry_date), 1));

  const candidateDates = uniqueDates([...bbtCandidates, ...lhCandidates]).sort(
    (left, right) => left.getTime() - right.getTime(),
  );

  const lutealLengths: number[] = [];
  candidateDates.forEach((candidate) => {
    const nextPeriod = periodsAsc.find(
      (period) => parseDateOnly(period.startDate).getTime() > candidate.getTime(),
    );
    if (!nextPeriod) return;

    const length = diffDays(parseDateOnly(nextPeriod.startDate), candidate);
    if (length >= 8 && length <= 20) {
      lutealLengths.push(length);
    }
  });

  if (!lutealLengths.length) return fallback;
  return Math.round(mean(lutealLengths));
};

const buildFactorDetailForLh = (log: CycleDailyLog | null, t: CycleTranslator) => {
  switch (log?.lh_test_result) {
    case 'peak':
      return { active: true, detail: t('engine.factor.lh.peak'), score: 1 };
    case 'high':
      return { active: true, detail: t('engine.factor.lh.high'), score: 0.7 };
    case 'negative':
      return { active: false, detail: t('engine.factor.lh.negative'), score: 0 };
    default:
      return { active: false, detail: t('engine.factor.lh.none'), score: 0 };
  }
};

const buildFactorDetailForMucus = (log: CycleDailyLog | null, t: CycleTranslator) => {
  const mucus = log?.cervical_mucus ?? null;
  const score = mucus ? MUCUS_SCORE_MAP[mucus] ?? 0 : 0;
  switch (mucus) {
    case 'eggwhite':
      return { active: true, detail: t('engine.factor.mucus.eggwhite'), score };
    case 'watery':
      return { active: true, detail: t('engine.factor.mucus.watery'), score };
    case 'creamy':
      return { active: true, detail: t('engine.factor.mucus.creamy'), score };
    case 'sticky':
      return { active: false, detail: t('engine.factor.mucus.sticky'), score };
    case 'dry':
      return { active: false, detail: t('engine.factor.mucus.dry'), score };
    default:
      return { active: false, detail: t('engine.factor.mucus.none'), score: 0 };
  }
};

const findLatestConfirmedOvulationDate = (dailyLogs: CycleDailyLog[], referenceDate: Date) => {
  const confirmedDates = deriveBbtConfirmedOvulationDates(dailyLogs)
    .filter((date) => date.getTime() <= referenceDate.getTime())
    .sort((left, right) => right.getTime() - left.getTime());
  return confirmedDates[0] ?? null;
};

const buildCalendarWindowFloor = (
  daysToOvulation: number | null,
  uncertaintyDays: number,
  hasEnoughData: boolean,
) => {
  if (!hasEnoughData || daysToOvulation === null) return 0;

  const base = CALENDAR_WINDOW_FLOOR_BY_OFFSET[String(daysToOvulation)];
  if (base === undefined) return 0;

  const uncertaintyMultiplier =
    uncertaintyDays >= 5 ? 0.76 :
    uncertaintyDays >= 3 ? 0.88 :
    1;

  return Number((base * uncertaintyMultiplier).toFixed(2));
};

export const buildCyclePrediction = ({
  settings,
  periods,
  dailyLogs,
  referenceDate = new Date(),
  locale = DEFAULT_CYCLE_LOCALE,
}: BuildCyclePredictionInput): CyclePrediction => {
  const t: CycleTranslator = (key, params) => translateCycleText(locale, key, params);
  const today = toDateOnly(referenceDate);
  const todayKey = dateToKey(today);
  const todayLog = dailyLogs.find((entry) => entry.entry_date === todayKey) ?? null;
  const mergedPeriods = mergePeriods(settings, periods, dailyLogs);
  const lastPeriod = mergedPeriods[mergedPeriods.length - 1] ?? null;

  const rawCycleLengths = mergedPeriods.slice(1).map((period, index) => {
    const previous = mergedPeriods[index];
    return diffDays(parseDateOnly(period.startDate), parseDateOnly(previous.startDate));
  });
  const cycleLengths = sanitizeCycleLengths(rawCycleLengths);

  const rawPeriodLengths = mergedPeriods.map((period) => {
    return diffDays(parseDateOnly(period.endDate), parseDateOnly(period.startDate)) + 1;
  });
  const periodLengths = rawPeriodLengths.filter((value) => value >= 1 && value <= 14);

  // Lebensphasen-Modus: Wochenbett/Stillzeit und Perimenopause machen Zyklen
  // naturgemäß unregelmäßiger – die Prognose rechnet dann bewusst mit
  // größeren Spannen und geringerer Sicherheit statt falscher Präzision.
  const mode: CyclePredictionMode =
    settings?.is_postpartum || settings?.is_breastfeeding
      ? 'postpartum'
      : settings?.is_perimenopause
        ? 'perimenopause'
        : 'default';

  const variabilityStdDev = standardDeviation(cycleLengths);
  const variabilityMad = medianAbsoluteDeviation(cycleLengths) * 1.4826;
  const baseUncertaintyDays = clamp(
    Math.round(Math.max(1, variabilityStdDev, variabilityMad, cycleLengths.length <= 1 ? 2 : 1)),
    1,
    7,
  );
  const uncertaintyDays =
    mode === 'postpartum'
      ? clamp(Math.max(baseUncertaintyDays + 2, 5), 1, 10)
      : mode === 'perimenopause'
        ? clamp(Math.max(baseUncertaintyDays + 1, 4), 1, 10)
        : baseUncertaintyDays;

  const alpha = computeAdaptiveAlpha(Math.max(variabilityStdDev, variabilityMad));
  const weighted = weightedAverage(cycleLengths);
  const ema = exponentialMovingAverage(cycleLengths, alpha);
  const predictedCycleLength = clamp(
    Math.round(
      weighted !== null && ema !== null
        ? weighted * 0.45 + ema * 0.55
        : ema ?? weighted ?? settings?.average_cycle_length ?? DEFAULT_CYCLE_LENGTH,
    ),
    15,
    60,
  );

  const predictedPeriodLength = clamp(
    Math.round(
      weightedAverage(periodLengths) ??
        settings?.average_period_length ??
        DEFAULT_PERIOD_LENGTH,
    ),
    1,
    14,
  );

  const personalLutealPhase = clamp(
    derivePersonalLutealPhase(
      mergedPeriods,
      dailyLogs,
      settings?.luteal_phase_length ?? DEFAULT_LUTEAL_PHASE,
    ),
    8,
    20,
  );

  const ovulationDay = clamp(predictedCycleLength - personalLutealPhase, 1, predictedCycleLength);
  const fertileStartDay = clamp(ovulationDay - 5, 1, predictedCycleLength);
  const fertileEndDay = clamp(ovulationDay + 1, 1, predictedCycleLength);
  const currentDay = lastPeriod
    ? Math.max(1, diffDays(today, parseDateOnly(lastPeriod.startDate)) + 1)
    : 1;

  const predictedNextPeriodDate = lastPeriod
    ? addDays(parseDateOnly(lastPeriod.startDate), predictedCycleLength)
    : null;
  const predictedOvulationDate = predictedNextPeriodDate
    ? addDays(predictedNextPeriodDate, -personalLutealPhase)
    : null;
  const latestConfirmedOvulation = findLatestConfirmedOvulationDate(dailyLogs, today);
  const daysToOvulation = predictedOvulationDate ? diffDays(predictedOvulationDate, today) : null;
  const hasEnoughData = Boolean(lastPeriod);

  const calendarSigma = Math.max(1.5, Math.min(2.5, uncertaintyDays / 2 + 0.75));
  const daysFromPredictedOvulation = predictedOvulationDate ? diffDays(today, predictedOvulationDate) : null;
  const calendarScore = daysFromPredictedOvulation === null
    ? 0
    : Math.exp(-Math.pow(daysFromPredictedOvulation, 2) / (2 * Math.pow(calendarSigma, 2)));

  const lh = buildFactorDetailForLh(todayLog, t);
  const mucus = buildFactorDetailForMucus(todayLog, t);

  let bbtScore = 0;
  let bbtActive = false;
  let bbtDetail = t('engine.factor.bbt.none');
  if (latestConfirmedOvulation) {
    const confirmedDaysAgo = diffDays(today, latestConfirmedOvulation);
    if (confirmedDaysAgo >= 0) {
      bbtScore = confirmedDaysAgo <= 1 ? 0.4 : 0;
      bbtActive = true;
      bbtDetail =
        confirmedDaysAgo <= 1
          ? t('engine.factor.bbt.confirmedRecent')
          : t('engine.factor.bbt.confirmedPast');
    }
  } else if (todayLog?.bbt_celsius !== null && todayLog?.bbt_celsius !== undefined) {
    bbtDetail = t('engine.factor.bbt.unconfirmed');
  }

  let fertilityScore =
    0.35 * calendarScore +
    0.35 * lh.score +
    0.2 * mucus.score +
    0.1 * bbtScore;

  const calendarWindowFloor = buildCalendarWindowFloor(daysToOvulation, uncertaintyDays, hasEnoughData);
  let effectiveCalendarFloor = 0;
  if (calendarWindowFloor > 0) {
    const signalPenalty =
      (todayLog?.lh_test_result === 'negative' ? 0.06 : 0) +
      (todayLog?.cervical_mucus === 'dry' ? 0.08 : 0) +
      (todayLog?.cervical_mucus === 'sticky' ? 0.04 : 0);
    effectiveCalendarFloor = Math.max(0, calendarWindowFloor - signalPenalty);
    fertilityScore = Math.max(fertilityScore, effectiveCalendarFloor);
  }

  if (latestConfirmedOvulation && diffDays(today, latestConfirmedOvulation) > 1) {
    fertilityScore = Math.min(fertilityScore, 0.25);
  }

  if (!lastPeriod) {
    fertilityScore = Math.min(fertilityScore, 0.25);
  }

  const fertilityLevel: CycleFertilityLevel =
    fertilityScore >= 0.8 ? 'peak' :
    fertilityScore >= 0.6 ? 'high' :
    fertilityScore >= 0.3 ? 'medium' :
    'low';

  const confidenceBase = 1 - Math.min(1, Math.max(variabilityStdDev, variabilityMad) / 7);
  const samplePenalty =
    cycleLengths.length >= 6 ? 1 :
    cycleLengths.length >= 3 ? 0.85 :
    cycleLengths.length >= 1 ? 0.65 :
    0.35;
  const modeConfidenceFactor =
    mode === 'postpartum' ? 0.6 : mode === 'perimenopause' ? 0.7 : 1;
  const confidence = Math.max(
    0,
    Math.round(confidenceBase * samplePenalty * modeConfidenceFactor * 100),
  );

  const modeNote =
    mode === 'postpartum'
      ? settings?.is_breastfeeding
        ? t('mode.breastfeeding')
        : t('mode.postpartum')
      : mode === 'perimenopause'
        ? t('mode.perimenopause')
        : null;

  const daysToNextPeriod = predictedNextPeriodDate ? diffDays(predictedNextPeriodDate, today) : null;

  let headline = t('engine.headline.notEnoughData');
  let subline = t('engine.subline.default');
  let caption = t('engine.caption.default');

  if (hasEnoughData) {
    if (fertilityLevel === 'peak') {
      headline = t('engine.headline.peak');
    } else if (fertilityLevel === 'high') {
      headline = t('engine.headline.high');
    } else if (fertilityLevel === 'medium') {
      headline = t('engine.headline.medium');
    } else if (daysToNextPeriod !== null && daysToNextPeriod >= 0 && daysToNextPeriod <= 3) {
      headline = t('engine.headline.periodSoon');
    } else if (latestConfirmedOvulation && diffDays(today, latestConfirmedOvulation) > 1) {
      headline = t('engine.headline.fertileOver');
    } else {
      headline = t('engine.headline.low');
    }

    if (daysToOvulation !== null) {
      if (daysToOvulation > 1) {
        subline = t('engine.subline.ovulationInDays', { day: currentDay, days: daysToOvulation });
      } else if (daysToOvulation === 1) {
        subline = t('engine.subline.ovulationTomorrow', { day: currentDay });
      } else if (daysToOvulation === 0) {
        subline = t('engine.subline.ovulationToday', { day: currentDay });
      } else if (daysToOvulation === -1) {
        subline = t('engine.subline.ovulationYesterday', { day: currentDay });
      } else if (daysToNextPeriod !== null) {
        subline = t('engine.subline.nextPeriodInDays', {
          day: currentDay,
          days: Math.max(0, daysToNextPeriod),
        });
      }
    }

    if (fertilityLevel === 'peak' || fertilityLevel === 'high') {
      caption = t('engine.caption.fertileOpen');
    } else if (fertilityLevel === 'medium' && daysToOvulation !== null && daysToOvulation >= -1 && daysToOvulation <= 5) {
      caption = t('engine.caption.likelyFertile');
    } else if (latestConfirmedOvulation && diffDays(today, latestConfirmedOvulation) > 1) {
      caption = t('engine.caption.ovulationConfirmed');
    } else if (daysToNextPeriod !== null && daysToNextPeriod >= 0) {
      caption = t('engine.caption.nextPeriodUncertainty', { days: uncertaintyDays });
    }
  }

  const insight =
    !hasEnoughData
      ? t('engine.insight.notEnoughData')
      : cycleLengths.length >= 2
        ? Math.max(variabilityStdDev, variabilityMad) <= 2
          ? t('engine.insight.stable')
          : Math.max(variabilityStdDev, variabilityMad) >= 5
            ? t('engine.insight.variable')
            : t('engine.insight.usable')
        : t('engine.insight.fewCycles', { days: personalLutealPhase });

  const factors: CyclePredictionFactor[] = [
    {
      key: 'calendar',
      label: t('factors.calendar'),
      detail: hasEnoughData
        ? t('engine.factor.calendar.history', {
            cycles: Math.max(1, cycleLengths.length),
            days: uncertaintyDays,
          })
        : t('engine.factor.calendar.none'),
      active: hasEnoughData,
      pct: Math.round(Math.max(calendarScore, effectiveCalendarFloor) * 35),
    },
    {
      key: 'lh',
      label: t('factors.lh'),
      detail: lh.detail,
      active: lh.active,
      pct: Math.round(lh.score * 35),
    },
    {
      key: 'mucus',
      label: t('factors.mucus'),
      detail: mucus.detail,
      active: mucus.active,
      pct: Math.round(mucus.score * 20),
    },
    {
      key: 'bbt',
      label: t('factors.bbt'),
      detail: bbtDetail,
      active: bbtActive,
      pct: Math.round(bbtScore * 10),
    },
  ];

  const phases: CyclePhaseSegment[] = [];
  const periodEndDay = clamp(predictedPeriodLength, 1, predictedCycleLength);
  phases.push({ kind: 'period', startDay: 1, endDay: periodEndDay });
  if (fertileStartDay > periodEndDay + 1) {
    phases.push({
      kind: 'follicular',
      startDay: periodEndDay + 1,
      endDay: fertileStartDay - 1,
    });
  }
  phases.push({
    kind: 'fertile',
    startDay: fertileStartDay,
    endDay: fertileEndDay,
  });
  if (fertileEndDay < predictedCycleLength) {
    phases.push({
      kind: 'luteal',
      startDay: fertileEndDay + 1,
      endDay: predictedCycleLength,
    });
  }

  return {
    hasEnoughData,
    mode,
    modeNote,
    currentDay,
    cycleLength: predictedCycleLength,
    periodLength: predictedPeriodLength,
    ovulationDay,
    fertileStartDay,
    fertileEndDay,
    confidence,
    uncertaintyDays,
    fertilityScore: Number(fertilityScore.toFixed(2)),
    fertilityLevel,
    headline,
    subline,
    caption,
    insight,
    factors,
    phases,
    nextPeriodWindow: {
      startDate: predictedNextPeriodDate ? dateToKey(addDays(predictedNextPeriodDate, -uncertaintyDays)) : null,
      endDate: predictedNextPeriodDate ? dateToKey(addDays(predictedNextPeriodDate, uncertaintyDays)) : null,
      anchorDate: predictedNextPeriodDate ? dateToKey(predictedNextPeriodDate) : null,
    },
    ovulationWindow: {
      startDate: predictedOvulationDate ? dateToKey(addDays(predictedOvulationDate, -1)) : null,
      endDate: predictedOvulationDate ? dateToKey(addDays(predictedOvulationDate, 1)) : null,
      anchorDate: predictedOvulationDate ? dateToKey(predictedOvulationDate) : null,
    },
    fertileWindow: {
      startDate: predictedOvulationDate ? dateToKey(addDays(predictedOvulationDate, -5)) : null,
      endDate: predictedOvulationDate ? dateToKey(addDays(predictedOvulationDate, 1)) : null,
    },
    lastPeriod: {
      startDate: lastPeriod?.startDate ?? null,
      endDate: lastPeriod?.endDate ?? null,
    },
    todayLog,
  };
};

export type CycleHistoryEntry = {
  startDate: string;
  /** Tage bis zum nächsten Periodenstart; null für den laufenden Zyklus. */
  cycleLength: number | null;
  periodLength: number;
  isCurrent: boolean;
};

export type CycleHistory = {
  /** Neueste zuerst. */
  entries: CycleHistoryEntry[];
  averageCycleLength: number | null;
  shortestCycleLength: number | null;
  longestCycleLength: number | null;
  /** Typische Schwankung (±Tage) über die abgeschlossenen Zyklen. */
  variabilityDays: number | null;
};

type BuildCycleHistoryInput = BuildCyclePredictionInput & {
  maxCycles?: number;
};

/**
 * Vergangene Zyklen für die Verlaufs-Ansicht: pro erkannter Periode die
 * Zykluslänge (Abstand zum nächsten Periodenstart) und Periodenlänge.
 */
export const buildCycleHistory = ({
  settings,
  periods,
  dailyLogs,
  referenceDate = new Date(),
  maxCycles = 6,
}: BuildCycleHistoryInput): CycleHistory => {
  const mergedPeriods = mergePeriods(settings, periods, dailyLogs);

  const entries: CycleHistoryEntry[] = mergedPeriods.map((period, index) => {
    const next = mergedPeriods[index + 1] ?? null;
    const cycleLength = next
      ? diffDays(parseDateOnly(next.startDate), parseDateOnly(period.startDate))
      : null;
    return {
      startDate: period.startDate,
      cycleLength,
      periodLength: clamp(
        diffDays(parseDateOnly(period.endDate), parseDateOnly(period.startDate)) + 1,
        1,
        14,
      ),
      isCurrent: !next,
    };
  });

  const completedLengths = sanitizeCycleLengths(
    entries
      .map((entry) => entry.cycleLength)
      .filter((value): value is number => value !== null),
  );

  const newestFirst = [...entries].reverse().slice(0, maxCycles);
  const variability = Math.max(
    standardDeviation(completedLengths),
    medianAbsoluteDeviation(completedLengths) * 1.4826,
  );

  return {
    entries: newestFirst,
    averageCycleLength: completedLengths.length
      ? Math.round(mean(completedLengths))
      : null,
    shortestCycleLength: completedLengths.length
      ? Math.min(...completedLengths)
      : null,
    longestCycleLength: completedLengths.length
      ? Math.max(...completedLengths)
      : null,
    variabilityDays: completedLengths.length >= 2 ? Math.round(variability) : null,
  };
};
