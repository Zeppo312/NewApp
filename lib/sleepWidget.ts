import { NativeModules, Platform } from 'react-native';

import { findFreshActiveSleepEntry } from './sleepEntryGuards';
import { getSleepPeriodForEntry, overlapMinutes } from './sleepPeriods';
import {
  DEFAULT_NIGHT_WINDOW_SETTINGS,
  type NightWindowSettings,
} from './nightWindowSettings';
import type { SleepEntry } from './sleepData';
import type { SleepWindowPrediction } from './sleep-window';
import {
  DEFAULT_SLEEP_TRACKER_LOCALE,
  translateSleepTrackerText,
  type SleepTrackerLocale,
} from './sleepTrackerTranslations';

/**
 * Brücke zum iOS-Home-Screen-Widget für den Schlaf.
 *
 * Einbahnstraße, anders als beim Einkaufslisten-Widget: das Widget zeigt nur an
 * und verlinkt in die App. Ein Schlaf, der im Widget gestartet würde, müsste bis
 * zum nächsten App-Start auf Supabase warten und käme ohne Live Activity — der
 * Deep Link `sleep-tracker?autoStart=1` startet ihn stattdessen richtig.
 *
 * Das Datenformat entspricht `SleepWidgetSnapshot` in
 * targets/widget/SleepWidgetStore.swift.
 */

type SleepWidgetNativeModule = {
  syncSnapshot: (json: string) => Promise<boolean>;
  clearSnapshot: () => Promise<boolean>;
  isAvailable: () => Promise<boolean>;
};

const nativeModule: SleepWidgetNativeModule | null =
  Platform.OS === 'ios' ? (NativeModules.SleepWidgetModule ?? null) : null;

export const isSleepWidgetSupported = () => nativeModule !== null;

/**
 * Dieselbe Schwelle, mit der `app/_layout.tsx` über die
 * Schlafenszeit-Erinnerung entscheidet. Darunter zeigt das Widget lieber gar
 * kein Fenster als ein geratenes.
 */
export const MIN_WIDGET_PREDICTION_CONFIDENCE = 0.6;

type NormalizedEntry = {
  entry: SleepEntry;
  start: Date;
  end: Date;
};

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Abgeschlossene Einträge mit gültigem Zeitraum, aufsteigend nach Ende. */
const normalizeCompleted = (entries: SleepEntry[]): NormalizedEntry[] =>
  entries
    .reduce<NormalizedEntry[]>((acc, entry) => {
      const start = toDate(entry.start_time);
      const end = toDate(entry.end_time);
      if (!start || !end || end.getTime() <= start.getTime()) return acc;
      acc.push({ entry, start, end });
      return acc;
    }, [])
    .sort((a, b) => a.end.getTime() - b.end.getTime());

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) => {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
};

/**
 * Tagesbilanz: gezählt wird der Anteil, der wirklich in den heutigen Tag fällt.
 * Ein Nachtschlaf von 19:30 bis 6:00 steuert damit nur die Stunden nach
 * Mitternacht bei — sonst stünde am Morgen eine Tagessumme im Widget, die den
 * halben Vortag enthält.
 */
export const computeTodayStats = (
  entries: SleepEntry[],
  now: Date = new Date(),
  nightWindowSettings: NightWindowSettings = DEFAULT_NIGHT_WINDOW_SETTINGS
): { todayMinutes: number; todayNapCount: number } => {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  let todayMinutes = 0;
  let todayNapCount = 0;

  for (const { entry, start, end } of normalizeCompleted(entries)) {
    const minutes = overlapMinutes(start, end, dayStart, dayEnd);
    if (minutes <= 0) continue;

    todayMinutes += minutes;

    // Der Nachtschlaf ragt in fast jeden Tag hinein; als „Schläfchen" zählt er
    // nicht, sonst stünde jeden Morgen eine Eins zu viel im Widget. Was als
    // Nacht gilt, richtet sich nach dem eingestellten Nachtfenster — mit dem
    // Standard (18–10 Uhr) fällt ein Vormittagsschlaf sonst in die falsche
    // Schublade, sobald jemand ein engeres Fenster gewählt hat.
    if (getSleepPeriodForEntry(entry, nightWindowSettings, now) === 'day') {
      todayNapCount += 1;
    }
  }

  return { todayMinutes, todayNapCount };
};

/**
 * Die Schlafabschnitte des heutigen Tages für den Verlaufsbalken, zugeschnitten
 * auf die Tagesgrenzen: Ein Nachtschlaf ab 19:30 taucht am Folgetag als
 * Abschnitt ab 00:00 auf, nicht mit seiner echten Startzeit vom Vorabend.
 *
 * Ein laufender Schlaf endet hier bei „jetzt" — im Widget wächst der Balken
 * damit bis zur nächsten Aktualisierung nicht weiter, was ehrlicher ist als ein
 * Balken bis zu einem geratenen Ende.
 */
export const computeDaySegments = (
  entries: SleepEntry[],
  now: Date = new Date(),
  nightWindowSettings: NightWindowSettings = DEFAULT_NIGHT_WINDOW_SETTINGS
): SleepWidgetSegment[] => {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const segments: SleepWidgetSegment[] = [];

  const push = (entry: SleepEntry, start: Date, end: Date, ongoing: boolean) => {
    const from = Math.max(start.getTime(), dayStart.getTime());
    const to = Math.min(end.getTime(), dayEnd.getTime());
    if (to <= from) return;

    segments.push({
      id: entry.id ?? `${from}`,
      start: Math.round(from / 1000),
      end: Math.round(to / 1000),
      isNight: getSleepPeriodForEntry(entry, nightWindowSettings, now) === 'night',
      ongoing,
    });
  };

  for (const { entry, start, end } of normalizeCompleted(entries)) {
    push(entry, start, end, false);
  }

  const activeEntry = findFreshActiveSleepEntry(entries, now.getTime());
  const activeStart = activeEntry ? toDate(activeEntry.start_time) : null;
  if (activeEntry && activeStart) {
    push(activeEntry, activeStart, now, true);
  }

  return segments.sort((a, b) => a.start - b.start);
};

export type SleepWidgetSegment = {
  id: string;
  start: number;
  end: number;
  isNight: boolean;
  ongoing: boolean;
};

export type SleepWidgetSnapshot = {
  updatedAt: number;
  babyName: string | null;
  isSleeping: boolean;
  sleepStartedAt: number | null;
  awakeSince: number | null;
  lastSleepMinutes: number | null;
  windowStart: number | null;
  windowEarliest: number | null;
  windowLatest: number | null;
  windowKind: string | null;
  todayMinutes: number;
  todayNapCount: number;
  dayStart: number;
  segments: SleepWidgetSegment[];
  strings: Record<string, string>;
};

const buildStrings = (locale: SleepTrackerLocale): Record<string, string> => {
  const t = (key: Parameters<typeof translateSleepTrackerText>[1]) =>
    translateSleepTrackerText(locale, key);

  return {
    title: t('widget.title'),
    sleepingLabel: t('widget.sleeping'),
    awakeLabel: t('widget.awake'),
    nextNapLabel: t('widget.nextNap'),
    nextBedtimeLabel: t('widget.nextBedtime'),
    windowOpenLabel: t('widget.windowOpen'),
    todayLabel: t('widget.today'),
    // Swift setzt die Zahl per String(format:) ein, deshalb aus dem
    // Platzhalter der Übersetzung ein %d machen.
    napsLabel: t('widget.naps').replace('{{count}}', '%d'),
    lastSleepLabel: t('widget.lastSleep'),
    startAction: t('widget.start'),
    noWindowHint: t('widget.noWindow'),
    signedOut: t('widget.signedOut'),
    hourShort: t('widget.hourShort'),
    minuteShort: t('widget.minuteShort'),
    timelineLabel: t('widget.timeline'),
    timelineEmpty: t('widget.timelineEmpty'),
  };
};

export const buildSleepWidgetSnapshot = (
  entries: SleepEntry[],
  options: {
    prediction?: SleepWindowPrediction | null;
    locale?: SleepTrackerLocale;
    babyName?: string | null;
    nightWindowSettings?: NightWindowSettings;
    now?: Date;
  } = {}
): SleepWidgetSnapshot => {
  const now = options.now ?? new Date();
  const locale = options.locale ?? DEFAULT_SLEEP_TRACKER_LOCALE;

  const activeEntry = findFreshActiveSleepEntry(entries, now.getTime());
  const activeStart = activeEntry ? toDate(activeEntry.start_time) : null;

  const completed = normalizeCompleted(entries);
  const lastCompleted = [...completed]
    .reverse()
    .find(({ end }) => end.getTime() <= now.getTime());

  const { todayMinutes, todayNapCount } = computeTodayStats(
    entries,
    now,
    options.nightWindowSettings
  );

  // Eine Vorhersage ergibt nur Sinn, solange kein Timer läuft — während des
  // Schlafs zeigt das Widget die laufende Dauer.
  const prediction =
    !activeEntry &&
    options.prediction &&
    options.prediction.confidence >= MIN_WIDGET_PREDICTION_CONFIDENCE
      ? options.prediction
      : null;

  const seconds = (date: Date | null | undefined) =>
    date ? Math.round(date.getTime() / 1000) : null;

  return {
    updatedAt: Math.round(now.getTime() / 1000),
    babyName: options.babyName ?? null,
    isSleeping: Boolean(activeEntry && activeStart),
    sleepStartedAt: activeEntry ? seconds(activeStart) : null,
    awakeSince: activeEntry ? null : seconds(lastCompleted?.end ?? null),
    lastSleepMinutes: lastCompleted
      ? Math.round((lastCompleted.end.getTime() - lastCompleted.start.getTime()) / 60000)
      : null,
    windowStart: seconds(prediction?.recommendedStart),
    windowEarliest: seconds(prediction?.earliest),
    windowLatest: seconds(prediction?.latest),
    windowKind: prediction?.predictionKind ?? null,
    todayMinutes,
    todayNapCount,
    dayStart: Math.round(startOfDay(now).getTime() / 1000),
    segments: computeDaySegments(entries, now, options.nightWindowSettings),
    strings: buildStrings(locale),
  };
};

/** Schreibt den aktuellen Schlafstand ins Widget. */
export const syncSleepWidget = async (
  entries: SleepEntry[],
  options: {
    prediction?: SleepWindowPrediction | null;
    locale?: SleepTrackerLocale;
    babyName?: string | null;
    nightWindowSettings?: NightWindowSettings;
  } = {}
): Promise<void> => {
  if (!nativeModule) return;
  try {
    const snapshot = buildSleepWidgetSnapshot(entries, options);
    await nativeModule.syncSnapshot(JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Failed to sync sleep widget:', error);
  }
};

/** Leert das Widget, z. B. beim Abmelden oder ohne aktives Baby. */
export const clearSleepWidget = async (): Promise<void> => {
  if (!nativeModule) return;
  try {
    await nativeModule.clearSnapshot();
  } catch (error) {
    console.warn('Failed to clear sleep widget:', error);
  }
};
