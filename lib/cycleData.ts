import { getCachedUser, supabase } from './supabase';

export type CycleTrackingGoal = 'cycle_health' | 'trying_to_conceive';
export type CycleBleedingIntensity = 'none' | 'light' | 'medium' | 'heavy';
export type CycleCervicalMucus = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite';
export type CycleLhTestResult = 'negative' | 'high' | 'peak';

export type CycleSettings = {
  user_id: string;
  average_cycle_length: number | null;
  average_period_length: number | null;
  luteal_phase_length: number | null;
  last_period_start_date: string | null;
  last_period_end_date: string | null;
  tracking_goal: CycleTrackingGoal;
  is_postpartum: boolean;
  is_breastfeeding: boolean;
  is_perimenopause: boolean;
  cycle_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CyclePeriod = {
  id: string;
  user_id: string;
  period_start_date: string;
  period_end_date: string;
  cycle_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CycleDailyLog = {
  id: string;
  user_id: string;
  entry_date: string;
  bleeding_intensity: CycleBleedingIntensity;
  spotting: boolean;
  cervical_mucus: CycleCervicalMucus | null;
  lh_test_result: CycleLhTestResult | null;
  bbt_celsius: number | null;
  had_sex: boolean;
  pain_score: number | null;
  pms_score: number | null;
  symptoms: string[];
  cycle_notes: string | null;
  sleep_hours: number | null;
  stress_level: number | null;
  illness: boolean;
  travel: boolean;
  alcohol_units: number | null;
  created_at: string;
  updated_at: string;
};

export type CycleTrackerData = {
  settings: CycleSettings | null;
  periods: CyclePeriod[];
  dailyLogs: CycleDailyLog[];
  todayLog: CycleDailyLog | null;
};

type GetCycleDailyLogsOptions = {
  startDate?: string;
  endDate?: string;
  limit?: number;
};

type SaveCycleSettingsInput = Partial<
  Omit<CycleSettings, 'user_id' | 'created_at' | 'updated_at'>
>;

type SaveCyclePeriodInput = {
  id?: string;
  period_start_date: string;
  period_end_date: string;
  cycle_notes?: string | null;
};

type SaveCycleDailyLogInput = Partial<
  Omit<CycleDailyLog, 'id' | 'user_id' | 'created_at' | 'updated_at'>
> & {
  entry_date: string;
};

type GetCycleTrackerDataOptions = {
  logWindowDays?: number;
  periodLimit?: number;
};

const TRACKING_GOALS = new Set<CycleTrackingGoal>(['cycle_health', 'trying_to_conceive']);
const BLEEDING_INTENSITIES = new Set<CycleBleedingIntensity>(['none', 'light', 'medium', 'heavy']);
const CERVICAL_MUCUS_VALUES = new Set<CycleCervicalMucus>([
  'dry',
  'sticky',
  'creamy',
  'watery',
  'eggwhite',
]);
const LH_TEST_VALUES = new Set<CycleLhTestResult>(['negative', 'high', 'peak']);

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDateOnly = (value: string) => {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Ungültiges Datum. Erwartet wird YYYY-MM-DD.');
  }
  return normalized;
};

const dateToKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date.getTime());
  next.setHours(12, 0, 0, 0);
  next.setTime(next.getTime() + amount * DAY_MS);
  return next;
};

const normalizeNullableDateOnly = (value?: string | null) => {
  if (value === undefined || value === null || value === '') return null;
  return normalizeDateOnly(value);
};

const normalizeNullableString = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeNullableInteger = (value: unknown, min: number, max: number) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Ungültiger numerischer Wert.');
  }
  const rounded = Math.round(numeric);
  if (rounded < min || rounded > max) {
    throw new Error(`Numerischer Wert außerhalb des erlaubten Bereichs ${min}-${max}.`);
  }
  return rounded;
};

const normalizeNullableDecimal = (
  value: unknown,
  min: number,
  max: number,
  fractionDigits = 2,
) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Ungültiger Dezimalwert.');
  }
  if (numeric < min || numeric > max) {
    throw new Error(`Dezimalwert außerhalb des erlaubten Bereichs ${min}-${max}.`);
  }
  return Number(numeric.toFixed(fractionDigits));
};

const normalizeSymptoms = (value?: string[] | null) => {
  if (!Array.isArray(value)) return [] as string[];

  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || normalized.includes(trimmed)) continue;
    normalized.push(trimmed);
  }

  return normalized;
};

const normalizeTrackingGoal = (value: unknown): CycleTrackingGoal => {
  if (TRACKING_GOALS.has(value as CycleTrackingGoal)) {
    return value as CycleTrackingGoal;
  }
  return 'cycle_health';
};

const normalizeBleedingIntensity = (value: unknown): CycleBleedingIntensity => {
  if (BLEEDING_INTENSITIES.has(value as CycleBleedingIntensity)) {
    return value as CycleBleedingIntensity;
  }
  return 'none';
};

const normalizeCervicalMucus = (value: unknown): CycleCervicalMucus | null => {
  if (!value) return null;
  return CERVICAL_MUCUS_VALUES.has(value as CycleCervicalMucus)
    ? (value as CycleCervicalMucus)
    : null;
};

const normalizeLhTestResult = (value: unknown): CycleLhTestResult | null => {
  if (!value) return null;
  return LH_TEST_VALUES.has(value as CycleLhTestResult)
    ? (value as CycleLhTestResult)
    : null;
};

const normalizeSettings = (entry: any): CycleSettings => ({
  user_id: entry.user_id,
  average_cycle_length: normalizeNullableInteger(entry.average_cycle_length, 15, 60),
  average_period_length: normalizeNullableInteger(entry.average_period_length, 1, 14),
  luteal_phase_length: normalizeNullableInteger(entry.luteal_phase_length, 8, 20),
  last_period_start_date: normalizeNullableDateOnly(entry.last_period_start_date),
  last_period_end_date: normalizeNullableDateOnly(entry.last_period_end_date),
  tracking_goal: normalizeTrackingGoal(entry.tracking_goal),
  is_postpartum: Boolean(entry.is_postpartum),
  is_breastfeeding: Boolean(entry.is_breastfeeding),
  is_perimenopause: Boolean(entry.is_perimenopause),
  cycle_notes: normalizeNullableString(entry.cycle_notes),
  created_at: entry.created_at,
  updated_at: entry.updated_at,
});

const normalizePeriod = (entry: any): CyclePeriod => ({
  id: entry.id,
  user_id: entry.user_id,
  period_start_date: normalizeDateOnly(entry.period_start_date),
  period_end_date: normalizeDateOnly(entry.period_end_date),
  cycle_notes: normalizeNullableString(entry.cycle_notes),
  created_at: entry.created_at,
  updated_at: entry.updated_at,
});

const normalizeDailyLog = (entry: any): CycleDailyLog => ({
  id: entry.id,
  user_id: entry.user_id,
  entry_date: normalizeDateOnly(entry.entry_date),
  bleeding_intensity: normalizeBleedingIntensity(entry.bleeding_intensity),
  spotting: Boolean(entry.spotting),
  cervical_mucus: normalizeCervicalMucus(entry.cervical_mucus),
  lh_test_result: normalizeLhTestResult(entry.lh_test_result),
  bbt_celsius: normalizeNullableDecimal(entry.bbt_celsius, 34, 42, 2),
  had_sex: Boolean(entry.had_sex),
  pain_score: normalizeNullableInteger(entry.pain_score, 0, 10),
  pms_score: normalizeNullableInteger(entry.pms_score, 0, 10),
  symptoms: normalizeSymptoms(entry.symptoms),
  cycle_notes: normalizeNullableString(entry.cycle_notes),
  sleep_hours: normalizeNullableDecimal(entry.sleep_hours, 0, 24, 1),
  stress_level: normalizeNullableInteger(entry.stress_level, 0, 10),
  illness: Boolean(entry.illness),
  travel: Boolean(entry.travel),
  alcohol_units: normalizeNullableDecimal(entry.alcohol_units, 0, 50, 1),
  created_at: entry.created_at,
  updated_at: entry.updated_at,
});

const getCurrentUserId = async () => {
  const { data: userData, error: userError } = await getCachedUser();
  if (userError) return { userId: null, error: userError };
  if (!userData.user) return { userId: null, error: new Error('Nicht angemeldet') };
  return { userId: userData.user.id, error: null };
};

export const getCycleSettings = async () => {
  try {
    const { userId, error: userError } = await getCurrentUserId();
    if (userError) return { data: null, error: userError };
    if (!userId) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('cycle_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return { data: null, error };
    }

    return { data: data ? normalizeSettings(data) : null, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const saveCycleSettings = async (updates: SaveCycleSettingsInput) => {
  try {
    const { userId, error: userError } = await getCurrentUserId();
    if (userError) return { data: null, error: userError };
    if (!userId) return { data: null, error: new Error('Nicht angemeldet') };

    const payload: Record<string, unknown> = {
      user_id: userId,
      tracking_goal: 'cycle_health',
    };

    if (updates.average_cycle_length !== undefined) {
      payload.average_cycle_length = normalizeNullableInteger(updates.average_cycle_length, 15, 60);
    }
    if (updates.average_period_length !== undefined) {
      payload.average_period_length = normalizeNullableInteger(updates.average_period_length, 1, 14);
    }
    if (updates.luteal_phase_length !== undefined) {
      payload.luteal_phase_length = normalizeNullableInteger(updates.luteal_phase_length, 8, 20);
    }
    if (updates.last_period_start_date !== undefined) {
      payload.last_period_start_date = normalizeNullableDateOnly(updates.last_period_start_date);
    }
    if (updates.last_period_end_date !== undefined) {
      payload.last_period_end_date = normalizeNullableDateOnly(updates.last_period_end_date);
    }
    if (updates.tracking_goal !== undefined) {
      payload.tracking_goal = normalizeTrackingGoal(updates.tracking_goal);
    }
    if (updates.is_postpartum !== undefined) {
      payload.is_postpartum = Boolean(updates.is_postpartum);
    }
    if (updates.is_breastfeeding !== undefined) {
      payload.is_breastfeeding = Boolean(updates.is_breastfeeding);
    }
    if (updates.is_perimenopause !== undefined) {
      payload.is_perimenopause = Boolean(updates.is_perimenopause);
    }
    if (updates.cycle_notes !== undefined) {
      payload.cycle_notes = normalizeNullableString(updates.cycle_notes);
    }

    const { data, error } = await supabase
      .from('cycle_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: normalizeSettings(data), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const getCyclePeriods = async (limit = 18) => {
  try {
    const { userId, error: userError } = await getCurrentUserId();
    if (userError) return { data: null, error: userError };
    if (!userId) return { data: null, error: new Error('Nicht angemeldet') };

    let query = supabase
      .from('cycle_periods')
      .select('*')
      .eq('user_id', userId)
      .order('period_start_date', { ascending: false });

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) return { data: null, error };

    return { data: (data ?? []).map(normalizePeriod), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const upsertCyclePeriod = async (entry: SaveCyclePeriodInput) => {
  try {
    const { userId, error: userError } = await getCurrentUserId();
    if (userError) return { data: null, error: userError };
    if (!userId) return { data: null, error: new Error('Nicht angemeldet') };

    const startDate = normalizeDateOnly(entry.period_start_date);
    const endDate = normalizeDateOnly(entry.period_end_date);
    if (endDate < startDate) {
      return { data: null, error: new Error('Das Periodenende darf nicht vor dem Start liegen.') };
    }

    const payload: Record<string, unknown> = {
      user_id: userId,
      period_start_date: startDate,
      period_end_date: endDate,
      cycle_notes: normalizeNullableString(entry.cycle_notes),
    };

    if (entry.id) {
      payload.id = entry.id;
    }

    const { data, error } = await supabase
      .from('cycle_periods')
      .upsert(payload, { onConflict: 'user_id,period_start_date' })
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: normalizePeriod(data), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const getCycleDailyLogs = async (options?: GetCycleDailyLogsOptions) => {
  try {
    const { userId, error: userError } = await getCurrentUserId();
    if (userError) return { data: null, error: userError };
    if (!userId) return { data: null, error: new Error('Nicht angemeldet') };

    let query = supabase
      .from('cycle_daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: true });

    if (options?.startDate) {
      query = query.gte('entry_date', normalizeDateOnly(options.startDate));
    }
    if (options?.endDate) {
      query = query.lte('entry_date', normalizeDateOnly(options.endDate));
    }
    if (options?.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) return { data: null, error };

    return { data: (data ?? []).map(normalizeDailyLog), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const upsertCycleDailyLog = async (entry: SaveCycleDailyLogInput) => {
  try {
    const { userId, error: userError } = await getCurrentUserId();
    if (userError) return { data: null, error: userError };
    if (!userId) return { data: null, error: new Error('Nicht angemeldet') };

    const payload: Record<string, unknown> = {
      user_id: userId,
      entry_date: normalizeDateOnly(entry.entry_date),
      bleeding_intensity: normalizeBleedingIntensity(entry.bleeding_intensity),
      spotting: entry.spotting === undefined ? false : Boolean(entry.spotting),
      cervical_mucus: normalizeCervicalMucus(entry.cervical_mucus),
      lh_test_result: normalizeLhTestResult(entry.lh_test_result),
      bbt_celsius: normalizeNullableDecimal(entry.bbt_celsius, 34, 42, 2),
      had_sex: entry.had_sex === undefined ? false : Boolean(entry.had_sex),
      pain_score: normalizeNullableInteger(entry.pain_score, 0, 10),
      pms_score: normalizeNullableInteger(entry.pms_score, 0, 10),
      symptoms: normalizeSymptoms(entry.symptoms),
      cycle_notes: normalizeNullableString(entry.cycle_notes),
      sleep_hours: normalizeNullableDecimal(entry.sleep_hours, 0, 24, 1),
      stress_level: normalizeNullableInteger(entry.stress_level, 0, 10),
      illness: entry.illness === undefined ? false : Boolean(entry.illness),
      travel: entry.travel === undefined ? false : Boolean(entry.travel),
      alcohol_units: normalizeNullableDecimal(entry.alcohol_units, 0, 50, 1),
    };

    const { data, error } = await supabase
      .from('cycle_daily_logs')
      .upsert(payload, { onConflict: 'user_id,entry_date' })
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: normalizeDailyLog(data), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const getCycleTrackerData = async (options?: GetCycleTrackerDataOptions) => {
  try {
    const periodLimit = options?.periodLimit ?? 18;
    const logWindowDays = options?.logWindowDays ?? 365;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const startDate = dateToKey(addDays(today, -logWindowDays));
    const todayKey = dateToKey(today);

    const [settingsResult, periodsResult, logsResult] = await Promise.all([
      getCycleSettings(),
      getCyclePeriods(periodLimit),
      getCycleDailyLogs({ startDate, endDate: todayKey }),
    ]);

    const error = settingsResult.error ?? periodsResult.error ?? logsResult.error;
    if (error) {
      return { data: null, error };
    }

    const periods = periodsResult.data ?? [];
    const dailyLogs = logsResult.data ?? [];
    const todayLog = dailyLogs.find((entry) => entry.entry_date === todayKey) ?? null;

    return {
      data: {
        settings: settingsResult.data,
        periods,
        dailyLogs,
        todayLog,
      } as CycleTrackerData,
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
};
