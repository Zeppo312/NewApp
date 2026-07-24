import type { DailySignals } from './types';

export type CarePredictionKind = 'sleep' | 'feeding';

export interface CareHorizon {
  headline: string;
  nowText: string;
  nextText: string;
  windowText: string;
  confidenceText: string;
  nextKind: CarePredictionKind | null;
  nextWindowStart: string | null;
  nextWindowEnd: string | null;
  windowMinutes: number | null;
  roughNight: boolean;
  isLearning: boolean;
  handoffLabel: string;
  handoffMessage: string;
}

type Prediction = {
  kind: CarePredictionKind;
  at: Date;
  start: Date;
  end: Date;
  samples: number;
};

const validDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const durationText = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} Min.`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
};

const minutesSince = (date: Date, now: Date): number =>
  Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));

const predictionFrom = (
  kind: CarePredictionKind,
  anchor: Date | null,
  intervalMinutes: number | null,
  samples: number,
): Prediction | null => {
  if (!anchor || intervalMinutes == null || samples < 4) return null;
  const at = new Date(anchor.getTime() + intervalMinutes * 60_000);
  const spread = Math.max(15, Math.min(30, Math.round(intervalMinutes * 0.12)));
  return {
    kind,
    at,
    start: new Date(at.getTime() - spread * 60_000),
    end: new Date(at.getTime() + spread * 60_000),
    samples,
  };
};

const currentStateText = (signals: DailySignals, now: Date): string => {
  const parts: string[] = [];
  const sleepStarted = validDate(signals.sleep.currentSleepStartedAt);
  if (signals.sleep.isSleepingNow && sleepStarted) {
    parts.push(`${signals.babyName} schläft seit ${durationText(minutesSince(sleepStarted, now))}`);
  } else {
    const lastSleepEnd = validDate(signals.sleep.lastSleepEndAt);
    const rawAwakeMinutes = lastSleepEnd
      ? minutesSince(lastSleepEnd, now)
      : signals.sleep.currentAwakeMinutes;
    const awakeMinutes =
      rawAwakeMinutes != null && rawAwakeMinutes <= 24 * 60
        ? rawAwakeMinutes
        : null;
    parts.push(
      awakeMinutes != null
        ? `${signals.babyName} ist seit ${durationText(awakeMinutes)} wach`
        : `Aktueller Stand für ${signals.babyName}`,
    );
  }

  const lastFeeding = validDate(signals.feeding.lastFeedingAt);
  if (lastFeeding && minutesSince(lastFeeding, now) <= 24 * 60) {
    parts.push(`letzte Mahlzeit vor ${durationText(minutesSince(lastFeeding, now))}`);
  }
  return parts.join(' · ');
};

const nextTextFor = (prediction: Prediction | null, now: Date): string => {
  if (!prediction) {
    return 'Noch keine belastbare Zeitprognose – Lotti zeigt lieber keine erfundene Uhrzeit.';
  }
  const need = prediction.kind === 'sleep' ? 'Schlaf' : 'Mahlzeit';
  if (prediction.start <= now && prediction.end >= now) {
    return `${need} liegt nach eurem bisherigen Rhythmus wahrscheinlich jetzt an.`;
  }
  return `${need} wahrscheinlich zwischen ${formatTime(prediction.start)} und ${formatTime(prediction.end)} Uhr.`;
};

const handoffRequest = (signals: DailySignals, prediction: Prediction | null): string => {
  if (prediction?.kind === 'sleep') {
    return 'Kannst du bitte das Einschlafen in diesem Zeitfenster übernehmen?';
  }
  if (prediction?.kind === 'feeding') {
    if (signals.feeding.likelyFeedingMode === 'breast') {
      return 'Kannst du bitte das Drumherum übernehmen und danach wickeln, damit ich direkt wieder Pause habe?';
    }
    return 'Kannst du bitte die nächste Mahlzeit in diesem Zeitfenster übernehmen oder vorbereiten?';
  }
  return `Kannst du ${signals.babyName} bitte für die nächsten 30 Minuten übernehmen?`;
};

export const buildCareHorizon = (
  signals: DailySignals,
  options: { now?: Date; atLimit?: boolean } = {},
): CareHorizon => {
  const now = options.now ?? new Date();
  const sleepPrediction = signals.sleep.isSleepingNow
    ? null
    : predictionFrom(
        'sleep',
        validDate(signals.sleep.lastSleepEndAt),
        signals.sleep.typicalWakeMinutes,
        signals.sleep.wakeSampleCount,
      );
  const feedingPrediction = predictionFrom(
    'feeding',
    validDate(signals.feeding.lastFeedingAt),
    signals.feeding.typicalIntervalMinutes,
    signals.feeding.intervalSampleCount,
  );

  const relevant = [sleepPrediction, feedingPrediction]
    .filter((value): value is Prediction => value != null)
    .filter(
      (value) =>
        value.end.getTime() >= now.getTime() - 30 * 60_000 &&
        value.start.getTime() <= now.getTime() + 6 * 60 * 60_000,
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const next = relevant[0] ?? null;

  let windowMinutes: number | null = null;
  let windowText: string;
  if (signals.sleep.isSleepingNow) {
    windowText = 'Der Schlaf läuft. Nutze den Moment, wenn es für dich passt – Lotti macht keine Aufgabe daraus.';
  } else if (next) {
    windowMinutes = Math.max(
      0,
      Math.round((next.start.getTime() - now.getTime()) / 60_000) - 5,
    );
    windowText = signals.sleep.roughNight
      ? windowMinutes >= 10
        ? `Bis dahin etwa ${durationText(windowMinutes)} Schonzeit: nichts zusätzlich erledigen.`
        : 'Heute gilt Schonmodus: Vor dem nächsten Bedürfnis nichts zusätzlich erledigen.'
      : windowMinutes >= 10
        ? `Etwa ${durationText(windowMinutes)}, bevor du dich auf das Nächste einstellen musst.`
        : 'Das nächste Bedürfnis könnte bald anstehen. Du musst vorher nichts zusätzlich erledigen.';
  } else {
    windowText = 'Noch keine verlässliche Zeitspanne. Mit vier persönlichen Abständen wird die Vorschau genauer.';
  }

  const nowText = currentStateText(signals, now);
  const nextText = signals.sleep.isSleepingNow
    ? 'Lotti wartet mit der nächsten Prognose, bis der laufende Schlaf beendet ist.'
    : nextTextFor(next, now);
  const lastWet = validDate(signals.diaper.lastWetAt);
  const handoffLines = [
    options.atLimit ? 'Ich bin gerade am Limit und brauche eine konkrete Ablösung.' : 'Kurze Übergabe von Lotti:',
    signals.sleep.roughNight && !options.atLimit
      ? '• Lotti hat eine deutlich kürzere Nacht als sonst erkannt – heute ist Schonmodus.'
      : null,
    `• ${nowText}`,
    lastWet ? `• Letzte nasse Windel vor ${durationText(minutesSince(lastWet, now))}` : null,
    `• Als Nächstes: ${nextText}`,
    '',
    handoffRequest(signals, next),
  ].filter((line): line is string => line != null);

  const sampleCount = next?.samples ?? 0;
  return {
    headline: options.atLimit
      ? 'Jetzt zählt nur die Ablösung'
      : signals.sleep.roughNight
        ? 'Heute im Schonmodus'
        : next
          ? 'Das ist wahrscheinlich als Nächstes dran'
          : 'Lotti lernt euren Rhythmus',
    nowText,
    nextText,
    windowText,
    confidenceText:
      sampleCount >= 4
        ? `Aus ${sampleCount} persönlichen Abständen abgeleitet`
        : 'Noch nicht genug persönliche Vergleichsdaten',
    nextKind: next?.kind ?? null,
    nextWindowStart: next?.start.toISOString() ?? null,
    nextWindowEnd: next?.end.toISOString() ?? null,
    windowMinutes,
    roughNight: signals.sleep.roughNight,
    isLearning: !next && !signals.sleep.isSleepingNow,
    handoffLabel:
      options.atLimit
        ? 'Jetzt Ablösung anfragen'
        : signals.sleep.roughNight
          ? 'Schonmodus übergeben'
        : next?.kind === 'sleep'
          ? 'Einschlafen übergeben'
          : next?.kind === 'feeding'
            ? 'Nächste Mahlzeit übergeben'
            : 'Aktuellen Stand übergeben',
    handoffMessage: handoffLines.join('\n'),
  };
};
