/**
 * Lottis Fürsorge – Sammelt die echten Tagesdaten der App zu DailySignals.
 *
 * Nutzt, soweit vorhanden, echte Quellen:
 *   - Ernährung / Windeln : getBabyCareEntriesForDate + buildFeedingOverview
 *   - Schlaf              : loadAllVisibleSleepEntries
 *   - Babyalter           : BabyInfo.birth_date
 *   - Wetter              : weatherService (nur wenn Standortfreigabe bereits erteilt)
 *
 * Fehlt eine Quelle oder gibt es noch keine Einträge, werden sinnvolle
 * ehrliche Leerwerte gesetzt (keine Beispieldaten).
 */

import type { BabyInfo } from '@/lib/baby';
import { buildFeedingOverview } from '@/lib/feedingOverview';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import { getBabyCareEntriesForDateRange } from '@/lib/supabase';
import {
  getDailyForecastByCoordinates,
  getWeatherByCoordinates,
  type DailyForecast,
  type WeatherData,
} from '@/lib/weatherService';

import type { DailySignals } from './types';

const HOT_THRESHOLD_C = 27;
const COLD_THRESHOLD_C = 5;
/** Ab UV 5 greift die Sonnenschutz-Regel (Babyhaut braucht ab UV 3 Schutz). */
const HIGH_UV_THRESHOLD = 5;
/** Ab dieser Regenwahrscheinlichkeit (%) gilt der Tag als „regnerisch". */
const RAIN_PROB_THRESHOLD = 60;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Babyalter in Monaten aus dem Geburtsdatum. */
export const getAgeMonths = (birthDate?: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
};

/** Warmer, lesbarer Alterstext. */
export const formatAgeText = (birthDate?: string | null): string => {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - birth.getTime()) / 86_400_000);

  if (diffDays < 0) return '';
  if (diffDays < 14) return `${diffDays} Tage alt`;
  if (diffDays < 70) return `${Math.floor(diffDays / 7)} Wochen alt`;

  const months = getAgeMonths(birthDate) ?? 0;
  if (months < 24) return `${months} Monate alt`;
  return `${Math.floor(months / 12)} Jahre alt`;
};

const formatSleepMinutes = (minutes: number): string => {
  if (minutes <= 0) return '–';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
};

/**
 * Summiert die Schlafphasen, die heute geendet ODER begonnen haben (Minuten).
 * Damit zählt auch der Nachtschlaf mit, der gestern Abend begann und heute
 * Morgen endete — nicht nur die heute gestarteten Nickerchen.
 */
const computeTodaySleepMinutes = (entries: any[] | undefined): number => {
  if (!entries?.length) return 0;
  const today = new Date();
  let total = 0;
  for (const entry of entries) {
    const start = entry?.start_time ? new Date(entry.start_time) : null;
    if (!start || Number.isNaN(start.getTime())) continue;
    const end = entry?.end_time ? new Date(entry.end_time) : null;
    const endValid = end && !Number.isNaN(end.getTime());
    const countsToday =
      (endValid && isSameDay(end, today)) || isSameDay(start, today);
    if (!countsToday) continue;
    if (typeof entry?.duration_minutes === 'number' && entry.duration_minutes > 0) {
      total += entry.duration_minutes;
    } else if (endValid) {
      total += Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
    }
  }
  return total;
};

/**
 * Wetter nur laden, wenn die Standortfreigabe bereits erteilt ist (kein Prompt).
 * Lädt aktuelles Wetter (Beschreibung) UND den Tagesforecast (Tmax, UV-Index,
 * Regenwahrscheinlichkeit) parallel; jede Quelle darf einzeln ausfallen.
 */
const tryLoadWeather = async (): Promise<{
  current: WeatherData | null;
  forecast: DailyForecast | null;
} | null> => {
  try {
    const Location = await import('expo-location');
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getLastKnownPositionAsync();
    const coords =
      pos?.coords ?? (await Location.getCurrentPositionAsync({})).coords;
    if (!coords) return null;
    const [current, forecast] = await Promise.allSettled([
      getWeatherByCoordinates(coords.latitude, coords.longitude),
      getDailyForecastByCoordinates(coords.latitude, coords.longitude),
    ]);
    return {
      current: current.status === 'fulfilled' ? current.value : null,
      forecast: forecast.status === 'fulfilled' ? forecast.value : null,
    };
  } catch {
    return null;
  }
};

/**
 * Leere Ausgangssignale: Es werden ausschließlich echte Daten angezeigt.
 * Ist heute (noch) nichts erfasst, stehen ehrliche Null-Werte da —
 * keine Beispieldaten mehr.
 */
const buildEmptySignals = (babyName: string): DailySignals => ({
  babyName,
  ageMonths: null,
  ageText: '',
  feeding: {
    totalCount: 0,
    bottleCount: 0,
    breastCount: 0,
    solidsCount: 0,
    waterCount: 0,
    totalBottleMl: 0,
    summaryText: 'Noch keine Mahlzeit heute',
    isReal: true,
    lastFeedingAt: null,
    hoursSinceLastFeeding: null,
    lastBreastAt: null,
    daysSinceLastBreast: null,
    breastCountLast21Days: 0,
    bottleCountLast21Days: 0,
    solidsCountLast21Days: 0,
    likelyFeedingMode: 'unknown',
    typicalPerDay: null,
  },
  diaper: { count: 0, isReal: true, wetCountToday: 0, lastWetAt: null },
  sleep: { minutes: 0, text: '–', isReal: true },
  weather: {
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
  },
});

/**
 * Baut die Tagessignale aus echten App-Daten zusammen.
 * Best-effort: fällt eine Quelle aus, bleibt ihr ehrlicher Leerwert stehen.
 */
export const buildDailySignals = async (
  activeBaby: BabyInfo | null,
): Promise<DailySignals> => {
  const babyName = activeBaby?.name?.trim() || 'dein Baby';

  // Ohne Baby-Kontext: leere Signale (keine Beispieldaten).
  if (!activeBaby?.id) {
    return buildEmptySignals(babyName);
  }

  const empty = buildEmptySignals(babyName);
  const babyId = activeBaby.id;
  const ageMonths = getAgeMonths(activeBaby.birth_date);
  const ageText = formatAgeText(activeBaby.birth_date);

  // Echte Quellen parallel laden – Fehler einzeln tolerieren.
  // Care-Einträge über 21 Tage: liefert heutige Werte UND die Historie
  // fürs Feeding-Profil (Fütter-Modus, eigene Baseline) in einer Abfrage.
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 21);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date();
  rangeEnd.setHours(23, 59, 59, 999);
  const [entriesResult, sleepResult, weatherResult] = await Promise.allSettled([
    getBabyCareEntriesForDateRange(rangeStart, rangeEnd, babyId),
    loadAllVisibleSleepEntries(babyId),
    tryLoadWeather(),
  ]);

  // --- Ernährung & Windeln (heute) + Feeding-Profil (21 Tage) ---
  let feeding = empty.feeding;
  let diaper = empty.diaper;
  if (entriesResult.status === 'fulfilled') {
    const allEntries: any[] =
      (entriesResult.value as any)?.data ?? entriesResult.value ?? [];
    if (Array.isArray(allEntries)) {
      const now = new Date();
      const today = new Date();
      const validDate = (v: any): Date | null => {
        const d = v ? new Date(v) : null;
        return d && !Number.isNaN(d.getTime()) ? d : null;
      };
      const todayEntries = allEntries.filter((e) => {
        const start = validDate(e?.start_time);
        return start ? isSameDay(start, today) : false;
      });

      const overview = buildFeedingOverview(todayEntries);
      const summaryParts = [
        overview.bottleCount > 0 ? `Flasche ${overview.bottleCount}×` : null,
        overview.breastCount > 0 ? `Stillen ${overview.breastCount}×` : null,
        overview.solidsCount > 0 ? `Beikost ${overview.solidsCount}×` : null,
        overview.waterCount > 0 ? `Wasser ${overview.waterCount}×` : null,
      ].filter(Boolean);

      // 21-Tage-Historie: Fütter-Modus + letzte Mahlzeit / letztes Stillen.
      const feedingEntries = allEntries.filter((e) => e?.entry_type === 'feeding');
      const countByType = (type: string) =>
        feedingEntries.filter((e) => e?.feeding_type === type).length;
      const breast21 = countByType('BREAST');
      const bottle21 = countByType('BOTTLE') + countByType('PUMP');
      const solids21 = countByType('SOLIDS');

      const latestOf = (list: any[]): Date | null =>
        list.reduce((latest: Date | null, e) => {
          const start = validDate(e?.start_time);
          return start && (!latest || start > latest) ? start : latest;
        }, null);
      const lastFeeding = latestOf(feedingEntries);
      const lastBreast = latestOf(
        feedingEntries.filter((e) => e?.feeding_type === 'BREAST'),
      );

      const likelyFeedingMode =
        breast21 > 0 && bottle21 > 0
          ? 'mixed'
          : breast21 > 0
            ? 'breast'
            : bottle21 > 0
              ? 'bottle'
              : solids21 > 0
                ? 'solids'
                : 'unknown';

      // Eigene Baseline: Ø Mahlzeiten/Tag der letzten 14 Tage (ohne heute),
      // nur Tage mit Einträgen; ab 3 solchen Tagen aussagekräftig.
      const perDay = new Map<string, number>();
      for (const e of feedingEntries) {
        const start = validDate(e?.start_time);
        if (!start || isSameDay(start, today)) continue;
        if (now.getTime() - start.getTime() > 14 * 86_400_000) continue;
        const key = start.toDateString();
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
      }
      const trackedDays = perDay.size;
      const typicalPerDay =
        trackedDays >= 3
          ? Array.from(perDay.values()).reduce((a, b) => a + b, 0) / trackedDays
          : null;

      feeding = {
        totalCount: overview.totalFeedingCount,
        bottleCount: overview.bottleCount,
        breastCount: overview.breastCount,
        solidsCount: overview.solidsCount,
        waterCount: overview.waterCount,
        totalBottleMl: overview.totalBottleMl,
        summaryText: summaryParts.join(' • ') || 'Noch keine Mahlzeit heute',
        isReal: true,
        lastFeedingAt: lastFeeding ? lastFeeding.toISOString() : null,
        hoursSinceLastFeeding: lastFeeding
          ? Math.round(((now.getTime() - lastFeeding.getTime()) / 3_600_000) * 10) / 10
          : null,
        lastBreastAt: lastBreast ? lastBreast.toISOString() : null,
        daysSinceLastBreast: lastBreast
          ? Math.floor((now.getTime() - lastBreast.getTime()) / 86_400_000)
          : null,
        breastCountLast21Days: breast21,
        bottleCountLast21Days: bottle21,
        solidsCountLast21Days: solids21,
        likelyFeedingMode,
        typicalPerDay,
      };

      const todayDiapers = todayEntries.filter((e) => e?.entry_type === 'diaper');
      const wetDiapers = todayDiapers.filter(
        (e) => e?.diaper_type === 'WET' || e?.diaper_type === 'BOTH',
      );
      const lastWet = latestOf(wetDiapers);
      diaper = {
        count: todayDiapers.length,
        isReal: true,
        wetCountToday: wetDiapers.length,
        lastWetAt: lastWet ? lastWet.toISOString() : null,
      };
    }
  }

  // --- Schlaf ---
  let sleep = empty.sleep;
  if (sleepResult.status === 'fulfilled') {
    const sleepValue: any = sleepResult.value;
    const sleepEntries: any[] = sleepValue?.entries ?? sleepValue ?? [];
    const minutes = computeTodaySleepMinutes(sleepEntries);
    if (minutes > 0) {
      sleep = { minutes, text: formatSleepMinutes(minutes), isReal: true };
    }
  }

  // --- Wetter (nur echt; ohne Standortfreigabe bleibt es leer) ---
  // Maßgeblich ist der TAGESforecast (Tmax, UV, Regen) — so warnt Lotti
  // morgens vor dem heißen Nachmittag. Die aktuelle Messung liefert die
  // schönere Beschreibung und dient als Fallback ohne Forecast.
  let weather = empty.weather;
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
        isHot:
          temperature >= HOT_THRESHOLD_C ||
          (feelsLike ?? -99) >= HOT_THRESHOLD_C + 2,
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
    babyName,
    ageMonths,
    ageText,
    feeding,
    diaper,
    sleep,
    weather,
  };
};
