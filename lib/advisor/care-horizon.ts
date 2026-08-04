import type { DailySignals } from './types';
import { getAppLocaleTag, type AppLocale } from '@/lib/localization';

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

const formatTime = (date: Date, locale: AppLocale): string =>
  date.toLocaleTimeString(getAppLocaleTag(locale), { hour: '2-digit', minute: '2-digit' });

const durationText = (minutes: number, locale: AppLocale): string => {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} ${locale === 'en' ? 'min' : locale === 'es' ? 'min' : 'Min.'}`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  const hourUnit = locale === 'en' ? 'hr' : locale === 'es' ? 'h' : 'Std.';
  const minuteUnit = locale === 'de' ? 'Min.' : 'min';
  return rest === 0 ? `${hours} ${hourUnit}` : `${hours} ${hourUnit} ${rest} ${minuteUnit}`;
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

const currentStateText = (signals: DailySignals, now: Date, locale: AppLocale): string => {
  const parts: string[] = [];
  const sleepStarted = validDate(signals.sleep.currentSleepStartedAt);
  if (signals.sleep.isSleepingNow && sleepStarted) {
    const elapsed = durationText(minutesSince(sleepStarted, now), locale);
    parts.push(locale === 'en' ? `${signals.babyName} has been asleep for ${elapsed}` : locale === 'es' ? `${signals.babyName} duerme desde hace ${elapsed}` : `${signals.babyName} schläft seit ${elapsed}`);
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
        ? locale === 'en' ? `${signals.babyName} has been awake for ${durationText(awakeMinutes, locale)}` : locale === 'es' ? `${signals.babyName} lleva ${durationText(awakeMinutes, locale)} despierto/a` : `${signals.babyName} ist seit ${durationText(awakeMinutes, locale)} wach`
        : locale === 'en' ? `Current status for ${signals.babyName}` : locale === 'es' ? `Situación actual de ${signals.babyName}` : `Aktueller Stand für ${signals.babyName}`,
    );
  }

  const lastFeeding = validDate(signals.feeding.lastFeedingAt);
  if (lastFeeding && minutesSince(lastFeeding, now) <= 24 * 60) {
    const elapsed = durationText(minutesSince(lastFeeding, now), locale);
    parts.push(locale === 'en' ? `last feed ${elapsed} ago` : locale === 'es' ? `última toma hace ${elapsed}` : `letzte Mahlzeit vor ${elapsed}`);
  }
  return parts.join(' · ');
};

const nextTextFor = (prediction: Prediction | null, now: Date, locale: AppLocale): string => {
  if (!prediction) {
    return locale === 'en' ? 'No reliable time prediction yet – Lotti would rather not invent a time.' : locale === 'es' ? 'Aún no hay una previsión horaria fiable; Lotti prefiere no inventar una hora.' : 'Noch keine belastbare Zeitprognose – Lotti zeigt lieber keine erfundene Uhrzeit.';
  }
  const need = prediction.kind === 'sleep' ? (locale === 'en' ? 'Sleep' : locale === 'es' ? 'El sueño' : 'Schlaf') : (locale === 'en' ? 'A feed' : locale === 'es' ? 'Una toma' : 'Mahlzeit');
  if (prediction.start <= now && prediction.end >= now) {
    return locale === 'en' ? `${need} is probably due now based on your rhythm.` : locale === 'es' ? `${need} probablemente toca ahora según vuestro ritmo.` : `${need} liegt nach eurem bisherigen Rhythmus wahrscheinlich jetzt an.`;
  }
  return locale === 'en' ? `${need} will probably be due between ${formatTime(prediction.start, locale)} and ${formatTime(prediction.end, locale)}.` : locale === 'es' ? `${need} probablemente tocará entre las ${formatTime(prediction.start, locale)} y las ${formatTime(prediction.end, locale)}.` : `${need} wahrscheinlich zwischen ${formatTime(prediction.start, locale)} und ${formatTime(prediction.end, locale)} Uhr.`;
};

const handoffRequest = (signals: DailySignals, prediction: Prediction | null, locale: AppLocale): string => {
  if (prediction?.kind === 'sleep') {
    return locale === 'en' ? 'Could you please handle settling the baby to sleep during this window?' : locale === 'es' ? '¿Puedes encargarte de dormir al bebé durante este margen?' : 'Kannst du bitte das Einschlafen in diesem Zeitfenster übernehmen?';
  }
  if (prediction?.kind === 'feeding') {
    if (signals.feeding.likelyFeedingMode === 'breast') {
      return locale === 'en' ? 'Could you handle everything around the feed and the diaper afterward so I can rest again right away?' : locale === 'es' ? '¿Puedes encargarte de todo lo que rodea la toma y del pañal después para que yo pueda descansar enseguida?' : 'Kannst du bitte das Drumherum übernehmen und danach wickeln, damit ich direkt wieder Pause habe?';
    }
    return locale === 'en' ? 'Could you handle or prepare the next feed during this window?' : locale === 'es' ? '¿Puedes encargarte o preparar la próxima toma durante este margen?' : 'Kannst du bitte die nächste Mahlzeit in diesem Zeitfenster übernehmen oder vorbereiten?';
  }
  return locale === 'en' ? `Could you take over with ${signals.babyName} for the next 30 minutes?` : locale === 'es' ? `¿Puedes encargarte de ${signals.babyName} durante los próximos 30 minutos?` : `Kannst du ${signals.babyName} bitte für die nächsten 30 Minuten übernehmen?`;
};

export const buildCareHorizon = (
  signals: DailySignals,
  options: { now?: Date; atLimit?: boolean; locale?: AppLocale } = {},
): CareHorizon => {
  const now = options.now ?? new Date();
  const locale = options.locale ?? 'de';
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
    windowText = locale === 'en' ? 'Sleep is in progress. Use the moment if it works for you – Lotti will not turn it into another task.' : locale === 'es' ? 'El sueño ya está en marcha. Aprovecha el momento si te viene bien; Lotti no lo convertirá en otra tarea.' : 'Der Schlaf läuft. Nutze den Moment, wenn es für dich passt – Lotti macht keine Aufgabe daraus.';
  } else if (next) {
    windowMinutes = Math.max(
      0,
      Math.round((next.start.getTime() - now.getTime()) / 60_000) - 5,
    );
    windowText = signals.sleep.roughNight
      ? windowMinutes >= 10
        ? locale === 'en' ? `About ${durationText(windowMinutes, locale)} of recovery time until then: do nothing extra.` : locale === 'es' ? `Hasta entonces, unos ${durationText(windowMinutes, locale)} de descanso: no hagas nada más.` : `Bis dahin etwa ${durationText(windowMinutes, locale)} Schonzeit: nichts zusätzlich erledigen.`
        : locale === 'en' ? 'Recovery mode today: do nothing extra before the next need.' : locale === 'es' ? 'Hoy toca modo descanso: no hagas nada más antes de la próxima necesidad.' : 'Heute gilt Schonmodus: Vor dem nächsten Bedürfnis nichts zusätzlich erledigen.'
      : windowMinutes >= 10
        ? locale === 'en' ? `About ${durationText(windowMinutes, locale)} before you need to prepare for what comes next.` : locale === 'es' ? `Unos ${durationText(windowMinutes, locale)} antes de prepararte para lo siguiente.` : `Etwa ${durationText(windowMinutes, locale)}, bevor du dich auf das Nächste einstellen musst.`
        : locale === 'en' ? 'The next need may come soon. You do not need to do anything extra first.' : locale === 'es' ? 'La próxima necesidad puede llegar pronto. No tienes que hacer nada más antes.' : 'Das nächste Bedürfnis könnte bald anstehen. Du musst vorher nichts zusätzlich erledigen.';
  } else {
    windowText = locale === 'en' ? 'No reliable time window yet. The preview becomes more accurate after four personal intervals.' : locale === 'es' ? 'Aún no hay un margen fiable. La previsión mejora con cuatro intervalos personales.' : 'Noch keine verlässliche Zeitspanne. Mit vier persönlichen Abständen wird die Vorschau genauer.';
  }

  const nowText = currentStateText(signals, now, locale);
  const nextText = signals.sleep.isSleepingNow
    ? locale === 'en' ? 'Lotti will wait until the current sleep ends before making the next prediction.' : locale === 'es' ? 'Lotti esperará a que termine el sueño actual para hacer la próxima previsión.' : 'Lotti wartet mit der nächsten Prognose, bis der laufende Schlaf beendet ist.'
    : nextTextFor(next, now, locale);
  const lastWet = validDate(signals.diaper.lastWetAt);
  const handoffLines = [
    options.atLimit ? (locale === 'en' ? 'I am at my limit and need someone to take over now.' : locale === 'es' ? 'Estoy al límite y necesito un relevo concreto.' : 'Ich bin gerade am Limit und brauche eine konkrete Ablösung.') : (locale === 'en' ? 'Quick handoff from Lotti:' : locale === 'es' ? 'Relevo rápido de Lotti:' : 'Kurze Übergabe von Lotti:'),
    signals.sleep.roughNight && !options.atLimit
      ? locale === 'en' ? '• Lotti detected a much shorter night than usual – use recovery mode today.' : locale === 'es' ? '• Lotti ha detectado una noche mucho más corta de lo habitual: hoy toca modo descanso.' : '• Lotti hat eine deutlich kürzere Nacht als sonst erkannt – heute ist Schonmodus.'
      : null,
    `• ${nowText}`,
    lastWet ? `• ${locale === 'en' ? 'Last wet diaper' : locale === 'es' ? 'Último pañal mojado' : 'Letzte nasse Windel'} ${locale === 'de' ? 'vor ' : locale === 'es' ? 'hace ' : ''}${durationText(minutesSince(lastWet, now), locale)}${locale === 'en' ? ' ago' : ''}` : null,
    `• ${locale === 'en' ? 'Up next' : locale === 'es' ? 'A continuación' : 'Als Nächstes'}: ${nextText}`,
    '',
    handoffRequest(signals, next, locale),
  ].filter((line): line is string => line != null);

  const sampleCount = next?.samples ?? 0;
  return {
    headline: options.atLimit
      ? locale === 'en' ? 'Getting relief is all that matters now' : locale === 'es' ? 'Ahora solo importa conseguir relevo' : 'Jetzt zählt nur die Ablösung'
      : signals.sleep.roughNight
        ? locale === 'en' ? 'Recovery mode today' : locale === 'es' ? 'Hoy, modo descanso' : 'Heute im Schonmodus'
        : next
          ? locale === 'en' ? 'This is probably up next' : locale === 'es' ? 'Esto es probablemente lo siguiente' : 'Das ist wahrscheinlich als Nächstes dran'
          : locale === 'en' ? 'Lotti is learning your rhythm' : locale === 'es' ? 'Lotti está aprendiendo vuestro ritmo' : 'Lotti lernt euren Rhythmus',
    nowText,
    nextText,
    windowText,
    confidenceText:
      sampleCount >= 4
        ? locale === 'en' ? `Based on ${sampleCount} personal intervals` : locale === 'es' ? `Basado en ${sampleCount} intervalos personales` : `Aus ${sampleCount} persönlichen Abständen abgeleitet`
        : locale === 'en' ? 'Not enough personal comparison data yet' : locale === 'es' ? 'Aún no hay suficientes datos personales' : 'Noch nicht genug persönliche Vergleichsdaten',
    nextKind: next?.kind ?? null,
    nextWindowStart: next?.start.toISOString() ?? null,
    nextWindowEnd: next?.end.toISOString() ?? null,
    windowMinutes,
    roughNight: signals.sleep.roughNight,
    isLearning: !next && !signals.sleep.isSleepingNow,
    handoffLabel:
      options.atLimit
        ? locale === 'en' ? 'Ask for relief now' : locale === 'es' ? 'Pedir relevo ahora' : 'Jetzt Ablösung anfragen'
        : signals.sleep.roughNight
          ? locale === 'en' ? 'Share recovery mode' : locale === 'es' ? 'Compartir modo descanso' : 'Schonmodus übergeben'
        : next?.kind === 'sleep'
          ? locale === 'en' ? 'Hand off settling to sleep' : locale === 'es' ? 'Delegar el momento de dormir' : 'Einschlafen übergeben'
          : next?.kind === 'feeding'
            ? locale === 'en' ? 'Hand off the next feed' : locale === 'es' ? 'Delegar la próxima toma' : 'Nächste Mahlzeit übergeben'
            : locale === 'en' ? 'Share current status' : locale === 'es' ? 'Compartir situación actual' : 'Aktuellen Stand übergeben',
    handoffMessage: handoffLines.join('\n'),
  };
};
