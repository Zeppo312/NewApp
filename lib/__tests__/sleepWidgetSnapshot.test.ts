/**
 * Der Snapshot fürs Schlaf-Widget wird nur beim Schreiben berechnet — das
 * Widget selbst rechnet nichts nach. Falsche Tageszahlen fallen deshalb erst
 * auf dem Home-Screen auf, wo sie niemand mehr korrigieren kann.
 */
import type { SleepEntry } from '@/lib/sleepData';
import type { SleepWindowPrediction } from '@/lib/sleep-window';
import {
  buildSleepWidgetSnapshot,
  computeDaySegments,
  computeTodayStats,
  MIN_WIDGET_PREDICTION_CONFIDENCE,
} from '@/lib/sleepWidget';

/**
 * Die Zeitpunkte hängen an der echten Uhr, nicht an einem festen Datum:
 * `findFreshActiveSleepEntry` verwirft einen laufenden Timer, der älter als 24
 * Stunden ist — mit einem fixen Testdatum wäre jeder „laufende" Schlaf stale.
 * `day: 0` ist heute, `day: -1` gestern.
 */
const at = (day: number, hour: number, minute = 0) => {
  const base = new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + day, hour, minute, 0, 0);
};

const entry = (start: Date, end: Date | null): SleepEntry => ({
  id: `${start.toISOString()}-${end?.toISOString() ?? 'open'}`,
  start_time: start.toISOString(),
  end_time: end ? end.toISOString() : null,
});

// Enger als der Standard (18–10 Uhr): sonst gilt ein Vormittagsschlaf um 9:15
// als Nachtschlaf, und der Test prüfte nur die Standardeinstellung mit.
const nightWindow = { startTime: '19:00', endTime: '07:00' };

describe('computeTodayStats', () => {
  const now = at(0, 15, 0);

  it('zählt vom Nachtschlaf nur den Anteil nach Mitternacht', () => {
    const nightSleep = entry(at(-1, 19, 30), at(0, 6, 0));

    const { todayMinutes } = computeTodayStats([nightSleep], now, nightWindow);

    // 00:00 bis 06:00 — die 4,5 Stunden vom Vorabend gehören nicht in die
    // heutige Bilanz.
    expect(todayMinutes).toBe(6 * 60);
  });

  it('zählt den Nachtschlaf nicht als Schläfchen', () => {
    const nightSleep = entry(at(-1, 19, 30), at(0, 6, 0));
    const nap = entry(at(0, 9, 15), at(0, 10, 30));

    const { todayMinutes, todayNapCount } = computeTodayStats([nightSleep, nap], now, nightWindow);

    expect(todayNapCount).toBe(1);
    expect(todayMinutes).toBe(6 * 60 + 75);
  });

  it('ignoriert Einträge von gestern und laufende Timer', () => {
    const yesterdayNap = entry(at(-1, 13, 0), at(-1, 14, 0));
    const running = entry(at(0, 14, 30), null);

    const { todayMinutes, todayNapCount } = computeTodayStats([yesterdayNap, running], now, nightWindow);

    expect(todayMinutes).toBe(0);
    expect(todayNapCount).toBe(0);
  });
});

describe('computeDaySegments', () => {
  const now = at(0, 15, 0);
  const seconds = (date: Date) => Math.round(date.getTime() / 1000);

  it('schneidet den Nachtschlaf an der Tagesgrenze ab', () => {
    const nightSleep = entry(at(-1, 19, 30), at(0, 6, 0));

    const [segment] = computeDaySegments([nightSleep], now, nightWindow);

    expect(segment.start).toBe(seconds(at(0, 0, 0)));
    expect(segment.end).toBe(seconds(at(0, 6, 0)));
    expect(segment.isNight).toBe(true);
  });

  it('lässt einen laufenden Schlaf bei „jetzt" enden', () => {
    const running = entry(at(0, 14, 30), null);

    const [segment] = computeDaySegments([running], now, nightWindow);

    expect(segment.ongoing).toBe(true);
    expect(segment.start).toBe(seconds(at(0, 14, 30)));
    expect(segment.end).toBe(seconds(now));
  });

  it('lässt Einträge weg, die den heutigen Tag nicht berühren', () => {
    const yesterdayNap = entry(at(-1, 13, 0), at(-1, 14, 0));

    expect(computeDaySegments([yesterdayNap], now, nightWindow)).toEqual([]);
  });

  it('gibt die Abschnitte in zeitlicher Reihenfolge zurück', () => {
    const late = entry(at(0, 12, 30), at(0, 14, 0));
    const early = entry(at(0, 9, 15), at(0, 10, 30));
    const night = entry(at(-1, 19, 30), at(0, 6, 0));

    const segments = computeDaySegments([late, early, night], now, nightWindow);

    expect(segments.map((segment) => segment.start)).toEqual([
      seconds(at(0, 0, 0)),
      seconds(at(0, 9, 15)),
      seconds(at(0, 12, 30)),
    ]);
  });
});

describe('buildSleepWidgetSnapshot', () => {
  const now = at(0, 15, 0);

  const prediction = (overrides: Partial<SleepWindowPrediction> = {}): SleepWindowPrediction =>
    ({
      recommendedStart: at(0, 16, 0),
      earliest: at(0, 15, 45),
      latest: at(0, 16, 30),
      windowMinutes: 45,
      napIndexToday: 2,
      timeOfDayBucket: 'afternoon',
      confidence: 0.8,
      predictionKind: 'nap',
      debug: {},
      ...overrides,
    }) as SleepWindowPrediction;

  it('meldet einen laufenden Schlaf mit Startzeitpunkt statt einer Vorhersage', () => {
    const running = entry(at(0, 14, 30), null);

    const snapshot = buildSleepWidgetSnapshot([running], {
      prediction: prediction(),
      now,
    });

    expect(snapshot.isSleeping).toBe(true);
    expect(snapshot.sleepStartedAt).toBe(Math.round(at(0, 14, 30).getTime() / 1000));
    expect(snapshot.awakeSince).toBeNull();
    // Während ein Timer läuft, wäre ein Müdigkeitsfenster widersprüchlich.
    expect(snapshot.windowStart).toBeNull();
  });

  it('setzt im wachen Zustand „wach seit" auf das Ende des letzten Schlafs', () => {
    const nap = entry(at(0, 12, 0), at(0, 13, 20));

    const snapshot = buildSleepWidgetSnapshot([nap], { prediction: prediction(), now });

    expect(snapshot.isSleeping).toBe(false);
    expect(snapshot.awakeSince).toBe(Math.round(at(0, 13, 20).getTime() / 1000));
    expect(snapshot.lastSleepMinutes).toBe(80);
    expect(snapshot.windowStart).toBe(Math.round(at(0, 16, 0).getTime() / 1000));
    expect(snapshot.windowKind).toBe('nap');
  });

  it('lässt eine zu unsichere Vorhersage weg', () => {
    const nap = entry(at(0, 12, 0), at(0, 13, 20));

    const snapshot = buildSleepWidgetSnapshot([nap], {
      prediction: prediction({ confidence: MIN_WIDGET_PREDICTION_CONFIDENCE - 0.01 }),
      now,
    });

    expect(snapshot.windowStart).toBeNull();
    expect(snapshot.windowKind).toBeNull();
  });

  it('liefert die Texte in der gewählten Sprache und mit %d für Swift', () => {
    const snapshot = buildSleepWidgetSnapshot([], { locale: 'en', now });

    expect(snapshot.strings.awakeLabel).toBe('awake for');
    expect(snapshot.strings.napsLabel).toContain('%d');
    expect(snapshot.strings.napsLabel).not.toContain('{{count}}');
  });

  it('legt Tagesbeginn und Verlauf für den Balken bei', () => {
    const nap = entry(at(0, 12, 0), at(0, 13, 20));

    const snapshot = buildSleepWidgetSnapshot([nap], { now, nightWindowSettings: nightWindow });

    expect(snapshot.dayStart).toBe(Math.round(at(0, 0, 0).getTime() / 1000));
    expect(snapshot.segments).toHaveLength(1);
    expect(snapshot.segments[0].isNight).toBe(false);
  });
});
