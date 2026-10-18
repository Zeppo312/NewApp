/**
 * Lottis Fürsorge – Schwangerschaftsmodus: Tagessignale ohne Baby.
 *
 * Vor der Geburt gibt es keine Schlaf-/Füttern-/Windel-Einträge. Lotti
 * schaut stattdessen auf die Schwangerschaftsseite der App:
 *   - SSW / Trimester / Countdown   : user_settings.due_date (RPC)
 *   - Mama-Selfcare-Check-ins        : selfcare_entries (7 Tage)
 *   - Gewichtskurve                  : weight_entries (30 Tage)
 *   - Wehen                          : contractions (24 Std.)
 *   - Nächster Termin                : planner_items (auch Partner)
 *   - Arztfragen / Kliniktasche / Geburtsplan
 *   - Wetter                         : wie beim Baby (nur mit Standortfreigabe)
 *
 * Fehlt eine Quelle, bleibt ihr ehrlicher Leerwert stehen (keine Mockdaten).
 */

import { supabase } from '@/lib/supabase';
import { loadPregnancyBriefingSignals } from '@/lib/pregnancy-briefing-data';
import {
  EMPTY_PREGNANCY_BRIEFING_SIGNALS,
  type PregnancyBriefingSignals,
} from '@/lib/pregnancy-briefing';

import { tryLoadWeather } from './buildDailySignals';
import type { DailySignals } from './types';

const HOT_THRESHOLD_C = 27;
const COLD_THRESHOLD_C = 5;
const HIGH_UV_THRESHOLD = 5;
const RAIN_PROB_THRESHOLD = 60;
const DAY_MS = 86_400_000;
const PREGNANCY_DAYS = 280;

export type PregnancyMood = 'great' | 'good' | 'okay' | 'bad' | 'awful';

export interface PregnancySignals {
  /** Vorname der Schwangeren (für die persönliche Formulierung). */
  motherName: string;
  /** Aktuelle SSW (1-basiert), null = kein Termin hinterlegt. */
  week: number | null;
  /** Tag innerhalb der Woche (0–6). */
  day: number | null;
  trimester: 1 | 2 | 3 | null;
  daysUntilDue: number | null;
  dueDate: string | null; // YYYY-MM-DD

  selfcare: {
    /** Heute schon ein Check-in? */
    hasToday: boolean;
    /** Anzahl Check-ins in den letzten 7 Tagen. */
    checkinsLast7Days: number;
    latestDate: string | null;
    latestMood: PregnancyMood | null;
    latestSleepHours: number | null;
    latestWaterIntake: number | null;
    latestExerciseDone: boolean | null;
    /** Ø der letzten 7 Tage (nur Check-ins mit Wert). */
    averageSleepHours: number | null;
    averageWaterIntake: number | null;
    exerciseDaysLast7: number;
    /** Zwei oder mehr „schlechte" Stimmungen in Folge. */
    lowMoodStreak: number;
  };

  weight: {
    latestKg: number | null;
    latestDate: string | null;
    /** Veränderung über die letzten 30 Tage (kg), null = zu wenig Einträge. */
    change30Days: number | null;
    entriesLast30Days: number;
  };

  contractions: {
    countLast24h: number;
    averageIntervalMinutes: number | null;
    averageDurationSeconds: number | null;
  };

  nextAppointment: {
    title: string;
    startAt: string;
    location: string | null;
    /** Tage bis zum Termin (0 = heute). */
    inDays: number;
  } | null;

  openQuestionCount: number;
  checklist: { checked: number; total: number };
  hasBirthPlan: boolean;
  partnerFirstName: string | null;
  /** Rohsignale fürs Tagesbriefing (buildPregnancyBriefing) – Woche/Tag-Text + nächste Schritte. */
  briefing: PregnancyBriefingSignals;

  context: { localHour: number; localMinute: number };

  weather: DailySignals['weather'];
}

/** SSW/Trimester/Countdown aus dem Entbindungstermin (Gerätezeitzone). */
export const pregnancyProgressFromDueDate = (
  dueDate: Date | string | null | undefined,
  now = new Date(),
): Pick<PregnancySignals, 'week' | 'day' | 'trimester' | 'daysUntilDue' | 'dueDate'> => {
  if (!dueDate) return { week: null, day: null, trimester: null, daysUntilDue: null, dueDate: null };
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime()))
    return { week: null, day: null, trimester: null, daysUntilDue: null, dueDate: null };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const daysUntilDue = Math.round((dueDay.getTime() - today.getTime()) / DAY_MS);
  const daysPregnant = Math.max(0, Math.min(PREGNANCY_DAYS + 21, PREGNANCY_DAYS - daysUntilDue));
  const week = Math.floor(daysPregnant / 7) + 1;
  const trimester: 1 | 2 | 3 = week <= 12 ? 1 : week <= 27 ? 2 : 3;
  const iso = `${dueDay.getFullYear()}-${String(dueDay.getMonth() + 1).padStart(2, '0')}-${String(
    dueDay.getDate(),
  ).padStart(2, '0')}`;
  return { week, day: daysPregnant % 7, trimester, daysUntilDue, dueDate: iso };
};

const emptyWeather = (): DailySignals['weather'] => ({
  available: false,
  temperature: null,
  feelsLike: null,
  description: '',
  isHot: false,
  isCold: false,
  isReal: true,
  uvIndex: null,
  rainProbability: null,
  isHighUv: false,
  isRainy: false,
});

export const buildEmptyPregnancySignals = (motherName = ''): PregnancySignals => ({
  motherName,
  week: null,
  day: null,
  trimester: null,
  daysUntilDue: null,
  dueDate: null,
  selfcare: {
    hasToday: false,
    checkinsLast7Days: 0,
    latestDate: null,
    latestMood: null,
    latestSleepHours: null,
    latestWaterIntake: null,
    latestExerciseDone: null,
    averageSleepHours: null,
    averageWaterIntake: null,
    exerciseDaysLast7: 0,
    lowMoodStreak: 0,
  },
  weight: { latestKg: null, latestDate: null, change30Days: null, entriesLast30Days: 0 },
  contractions: { countLast24h: 0, averageIntervalMinutes: null, averageDurationSeconds: null },
  nextAppointment: null,
  openQuestionCount: 0,
  checklist: { checked: 0, total: 0 },
  hasBirthPlan: false,
  partnerFirstName: null,
  briefing: { ...EMPTY_PREGNANCY_BRIEFING_SIGNALS, checklist: { ...EMPTY_PREGNANCY_BRIEFING_SIGNALS.checklist } },
  context: { localHour: new Date().getHours(), localMinute: new Date().getMinutes() },
  weather: emptyWeather(),
});

type SelfcareRow = {
  date: string;
  mood: string | null;
  sleep_hours: number | null;
  water_intake: number | null;
  exercise_done: boolean | null;
};
type WeightRow = { date: string; weight: number | string };
type ContractionRow = { start_time: string; end_time: string | null; duration: number | null };

const isMood = (value: unknown): value is PregnancyMood =>
  value === 'great' || value === 'good' || value === 'okay' || value === 'bad' || value === 'awful';

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const average = (values: number[]) =>
  values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

/** Reine Auswertung der Selfcare-Zeilen (testbar). */
export const summarizeSelfcare = (rows: SelfcareRow[], now = new Date()): PregnancySignals['selfcare'] => {
  const sorted = [...rows]
    .filter((row) => !Number.isNaN(new Date(row.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0] ?? null;
  const sleep = sorted
    .map((row) => row.sleep_hours)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const water = sorted
    .map((row) => row.water_intake)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  let lowMoodStreak = 0;
  for (const row of sorted) {
    if (row.mood === 'bad' || row.mood === 'awful') lowMoodStreak += 1;
    else break;
  }
  return {
    hasToday: latest ? isSameLocalDay(new Date(latest.date), now) : false,
    checkinsLast7Days: sorted.length,
    latestDate: latest?.date ?? null,
    latestMood: latest && isMood(latest.mood) ? latest.mood : null,
    latestSleepHours: typeof latest?.sleep_hours === 'number' ? latest.sleep_hours : null,
    latestWaterIntake: typeof latest?.water_intake === 'number' ? latest.water_intake : null,
    latestExerciseDone: typeof latest?.exercise_done === 'boolean' ? latest.exercise_done : null,
    averageSleepHours: average(sleep),
    averageWaterIntake: average(water),
    exerciseDaysLast7: sorted.filter((row) => row.exercise_done === true).length,
    lowMoodStreak,
  };
};

export const summarizeWeight = (rows: WeightRow[], now = new Date()): PregnancySignals['weight'] => {
  const sorted = rows
    .map((row) => ({ date: row.date, weight: Number(row.weight) }))
    .filter((row) => Number.isFinite(row.weight) && !Number.isNaN(new Date(row.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0] ?? null;
  const since = now.getTime() - 30 * DAY_MS;
  const inRange = sorted.filter((row) => new Date(row.date).getTime() >= since);
  const earliest = inRange[inRange.length - 1];
  return {
    latestKg: latest?.weight ?? null,
    latestDate: latest?.date ?? null,
    change30Days:
      latest && earliest && inRange.length >= 2
        ? Math.round((latest.weight - earliest.weight) * 10) / 10
        : null,
    entriesLast30Days: inRange.length,
  };
};

export const summarizeContractions = (
  rows: ContractionRow[],
  now = new Date(),
): PregnancySignals['contractions'] => {
  const since = now.getTime() - DAY_MS;
  const recent = rows
    .filter((row) => {
      const ms = new Date(row.start_time).getTime();
      return !Number.isNaN(ms) && ms >= since && ms <= now.getTime();
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const durations = recent
    .map((row) =>
      typeof row.duration === 'number' && row.duration > 0
        ? row.duration
        : row.end_time
          ? (new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / 1000
          : null,
    )
    .filter((value): value is number => typeof value === 'number' && value > 0 && value < 3600);
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i += 1) {
    const gap =
      (new Date(recent[i].start_time).getTime() - new Date(recent[i - 1].start_time).getTime()) /
      60_000;
    if (gap > 0 && gap < 12 * 60) gaps.push(gap);
  }
  return {
    countLast24h: recent.length,
    averageIntervalMinutes: gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
    averageDurationSeconds:
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
  };
};

/**
 * Sammelt die Schwangerschaftssignale des Tages. Best effort: jede Quelle
 * darf einzeln ausfallen.
 */
export const buildPregnancySignals = async (input: {
  userId: string | null | undefined;
  motherName?: string | null;
  dueDate?: Date | string | null;
}): Promise<PregnancySignals> => {
  const now = new Date();
  const base = buildEmptyPregnancySignals(input.motherName?.trim() || '');
  if (!input.userId) return base;
  const userId = input.userId;

  const weekStart = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const monthStart = new Date(now.getTime() - 30 * DAY_MS).toISOString().slice(0, 10);
  const dayStart = new Date(now.getTime() - DAY_MS).toISOString();

  const [dueResult, briefingResult, selfcareResult, weightResult, contractionResult, weatherResult] =
    await Promise.allSettled([
      input.dueDate
        ? Promise.resolve(input.dueDate)
        : supabase
            .rpc('get_due_date_with_linked_users', { p_user_id: userId })
            .then(({ data }) => (typeof data?.dueDate === 'string' ? data.dueDate : null)),
      loadPregnancyBriefingSignals(userId),
      supabase
        .from('selfcare_entries')
        .select('date,mood,sleep_hours,water_intake,exercise_done')
        .eq('user_id', userId)
        .gte('date', weekStart)
        .order('date', { ascending: false })
        .limit(30),
      supabase
        .from('weight_entries')
        .select('date,weight')
        .eq('user_id', userId)
        .gte('date', monthStart)
        .order('date', { ascending: false })
        .limit(60),
      supabase
        .from('contractions')
        .select('start_time,end_time,duration')
        .eq('user_id', userId)
        .gte('start_time', dayStart)
        .order('start_time', { ascending: false })
        .limit(200),
      tryLoadWeather(),
    ]);

  const progress = pregnancyProgressFromDueDate(
    dueResult.status === 'fulfilled' ? (dueResult.value as Date | string | null) : null,
    now,
  );

  let briefing = base;
  if (briefingResult.status === 'fulfilled') {
    const b = briefingResult.value;
    const inDays = b.nextAppointment
      ? Math.max(
          0,
          Math.round(
            (new Date(new Date(b.nextAppointment.startAt).toDateString()).getTime() -
              new Date(now.toDateString()).getTime()) /
              DAY_MS,
          ),
        )
      : 0;
    briefing = {
      ...base,
      nextAppointment: b.nextAppointment
        ? {
            title: b.nextAppointment.title,
            startAt: b.nextAppointment.startAt,
            location: b.nextAppointment.location,
            inDays,
          }
        : null,
      openQuestionCount: b.openQuestionCount,
      checklist: { ...b.checklist },
      hasBirthPlan: b.hasBirthPlan,
      partnerFirstName: b.partnerFirstName,
      briefing: b,
    };
  }

  const selfcare =
    selfcareResult.status === 'fulfilled' && !selfcareResult.value.error
      ? summarizeSelfcare((selfcareResult.value.data ?? []) as SelfcareRow[], now)
      : base.selfcare;
  const weight =
    weightResult.status === 'fulfilled' && !weightResult.value.error
      ? summarizeWeight((weightResult.value.data ?? []) as WeightRow[], now)
      : base.weight;
  const contractions =
    contractionResult.status === 'fulfilled' && !contractionResult.value.error
      ? summarizeContractions((contractionResult.value.data ?? []) as ContractionRow[], now)
      : base.contractions;

  let weather = emptyWeather();
  if (weatherResult.status === 'fulfilled' && weatherResult.value) {
    const { current, forecast } = weatherResult.value;
    const temperature = forecast?.tempMax ?? current?.temperature ?? null;
    const feelsLike = forecast?.feelsLikeMax ?? current?.feelsLike ?? null;
    if (temperature != null) {
      const uvIndex = forecast?.uvIndexMax ?? null;
      const rainProbability = forecast?.rainProbability ?? null;
      weather = {
        available: true,
        temperature,
        feelsLike,
        description: current?.description || forecast?.description || '',
        isHot: temperature >= HOT_THRESHOLD_C || (feelsLike ?? -99) >= HOT_THRESHOLD_C + 2,
        isCold: temperature <= COLD_THRESHOLD_C || (feelsLike ?? 99) <= 0,
        isReal: true,
        uvIndex,
        rainProbability,
        isHighUv: uvIndex != null && uvIndex >= HIGH_UV_THRESHOLD,
        isRainy: rainProbability != null && rainProbability >= RAIN_PROB_THRESHOLD,
      };
    }
  }

  return {
    ...briefing,
    ...progress,
    selfcare,
    weight,
    contractions,
    context: { localHour: now.getHours(), localMinute: now.getMinutes() },
    weather,
  };
};
