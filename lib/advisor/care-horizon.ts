import type { AnalysisCard, DailySignals } from './types';
import type { CareDayTimelineItem } from './day-timeline';
import { getAppLocaleTag, type AppLocale } from '@/lib/localization';

export type CarePredictionKind = 'sleep' | 'feeding';

/**
 * Zusatzinhalte der Seite, damit die Übergabe das komplette Tagesbriefing
 * enthält und nicht nur Jetzt/Als Nächstes. Alles optional: fehlt ein Teil,
 * bleibt der entsprechende Abschnitt einfach weg.
 */
export interface CareHandoffBriefing {
  /** Kernaussage des Tagesbriefings (Hero-Text). */
  headline?: string | null;
  /** Ausführlicher Hinweistext der Hauptkarte. */
  body?: string | null;
  /** „Warum dieser Hinweis?" – kombinierte Datenpunkte. */
  reasons?: string[] | null;
  /** Tageswerte (Schlaf/Ernährung/Windeln/Wetter); Beispielkarten fliegen raus. */
  cards?: AnalysisCard[] | null;
  /** Tagesplan inklusive Termin-Kollisionen mit der Prognose. */
  timeline?: CareDayTimelineItem[] | null;
}

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
  /** Lotti rät heute zu echter Ablösung – aus den Tagesdaten abgeleitet. */
  needsRelief: boolean;
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

/** Kurzform für die dreisprachigen Textbausteine der Übergabe. */
const say = (locale: AppLocale, de: string, en: string, es: string): string =>
  locale === 'en' ? en : locale === 'es' ? es : de;

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

/** „Montag, 01.09., Stand 08:00 Uhr" – damit die Nachricht datierbar bleibt. */
const handoffStamp = (now: Date, locale: AppLocale): string => {
  const day = now.toLocaleDateString(getAppLocaleTag(locale), {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
  const time = formatTime(now, locale);
  return say(
    locale,
    `${day}, Stand ${time} Uhr`,
    `${day}, as of ${time}`,
    `${day}, a las ${time}`,
  );
};

/** Ein Abschnitt der Übergabe – Überschrift + Zeilen, leer wird verworfen. */
const section = (title: string, lines: (string | null)[]): string | null => {
  const body = lines.filter((line): line is string => !!line);
  return body.length > 0 ? [title, ...body].join('\n') : null;
};

/**
 * Tageswerte aus den Briefing-Karten. Beispielkarten (isReal = false) bleiben
 * draußen: In einer Übergabe darf nichts stehen, was nicht gemessen wurde.
 */
const cardLines = (cards: AnalysisCard[] | null | undefined): string[] =>
  (cards ?? [])
    .filter((card) => card.isReal)
    .map(
      (card) =>
        `• ${card.emoji} ${card.label}: ${card.value}${card.caption ? ` – ${card.caption}` : ''}`,
    );

/** Termine und Aufgaben von heute; Prognosen stehen schon in „Als Nächstes". */
const planLines = (
  timeline: CareDayTimelineItem[] | null | undefined,
): string[] =>
  (timeline ?? [])
    .filter((item) => !item.isPredicted)
    .slice(0, 5)
    .map(
      (item) =>
        `• ${item.timeLabel} ${item.title}${item.subtitle ? ` (${item.subtitle})` : ''}`,
    );

/** Termin, der in das prognostizierte Fenster fällt – für die Übergabe wichtig. */
const conflictLine = (
  timeline: CareDayTimelineItem[] | null | undefined,
  locale: AppLocale,
): string | null => {
  const conflict = (timeline ?? []).find(
    (item) => item.isPredicted && item.conflictTitle,
  );
  if (!conflict?.conflictTitle) return null;
  return say(
    locale,
    `• Achtung: „${conflict.conflictTitle}" fällt in dieses Zeitfenster.`,
    `• Heads-up: “${conflict.conflictTitle}” falls into this window.`,
    `• Atención: «${conflict.conflictTitle}» cae en ese margen.`,
  );
};

/**
 * Ob Lotti heute zu echter Ablösung rät statt nur zum Übergeben. Bewusst
 * konservativ: nur bei einer deutlich kürzeren Nacht **und** einem zweiten
 * harten Signal – sonst nutzt sich der dringende Ton ab. Bewertet wird die
 * Lage, nie die Verfassung der Eltern.
 */
const needsReliefFrom = (
  signals: DailySignals,
  windowMinutes: number | null,
): boolean => {
  if (!signals.sleep.roughNight) return false;
  const {
    lastNightMinutes,
    typicalNightMinutes,
    typicalMinutesByNow,
    minutes,
    baselineSampleDays,
  } = signals.sleep;
  const nightDeficit =
    lastNightMinutes != null && typicalNightMinutes != null
      ? typicalNightMinutes - lastNightMinutes
      : null;
  const dayDeficit =
    typicalMinutesByNow != null && baselineSampleDays >= 4
      ? typicalMinutesByNow - minutes
      : null;
  return (
    (nightDeficit != null && nightDeficit >= 90) ||
    (dayDeficit != null && dayDeficit >= 45) ||
    (windowMinutes != null && windowMinutes < 15)
  );
};

export const buildCareHorizon = (
  signals: DailySignals,
  options: {
    now?: Date;
    locale?: AppLocale;
    /** Inhalte der Briefing-Karten, damit die Übergabe vollständig ist. */
    briefing?: CareHandoffBriefing;
  } = {},
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
  const needsRelief = needsReliefFrom(signals, windowMinutes);
  const headlineText = needsRelief
    ? say(locale, 'Heute wäre echte Entlastung dran', 'Real relief would matter today', 'Hoy haría falta un relevo de verdad')
    : signals.sleep.roughNight
      ? say(locale, 'Heute im Schonmodus', 'Recovery mode today', 'Hoy, modo descanso')
      : next
        ? say(locale, 'Das ist wahrscheinlich als Nächstes dran', 'This is probably up next', 'Esto es probablemente lo siguiente')
        : say(locale, 'Lotti lernt euren Rhythmus', 'Lotti is learning your rhythm', 'Lotti está aprendiendo vuestro ritmo');
  const lastWet = validDate(signals.diaper.lastWetAt);
  const sampleCount = next?.samples ?? 0;
  const confidenceText =
    sampleCount >= 4
      ? say(locale, `Aus ${sampleCount} persönlichen Abständen abgeleitet`, `Based on ${sampleCount} personal intervals`, `Basado en ${sampleCount} intervalos personales`)
      : say(locale, 'Noch nicht genug persönliche Vergleichsdaten', 'Not enough personal comparison data yet', 'Aún no hay suficientes datos personales');
  const briefing = options.briefing;
  const reasons = (briefing?.reasons ?? []).filter((reason) => !!reason);

  /* Komplettes Briefing statt Kurzfassung: Wer übernimmt, bekommt Stand,
     Prognose, Tageswerte, Lottis Hinweis und den Tagesplan in einer Nachricht. */
  const handoffBlocks = [
    [
      needsRelief
        ? say(locale, 'Übergabe von Lotti – heute wäre echte Ablösung wichtig:', 'Handoff from Lotti – real relief would matter today:', 'Resumen de Lotti: hoy haría falta un relevo de verdad:')
        : say(locale, 'Kurze Übergabe von Lotti:', 'Quick handoff from Lotti:', 'Relevo rápido de Lotti:'),
      handoffStamp(now, locale),
      // Bei Ablösungsbedarf sagt schon die Kopfzeile, worum es geht.
      needsRelief ? null : headlineText,
    ]
      .filter((line): line is string => !!line)
      .join('\n'),

    section(say(locale, 'JETZT', 'RIGHT NOW', 'AHORA'), [
      signals.sleep.roughNight
        ? say(locale, '• Lotti hat eine deutlich kürzere Nacht als sonst erkannt – heute ist Schonmodus.', '• Lotti detected a much shorter night than usual – use recovery mode today.', '• Lotti ha detectado una noche mucho más corta de lo habitual: hoy toca modo descanso.')
        : null,
      `• ${nowText}`,
      lastWet
        ? `• ${say(locale, `Letzte nasse Windel vor ${durationText(minutesSince(lastWet, now), locale)}`, `Last wet diaper ${durationText(minutesSince(lastWet, now), locale)} ago`, `Último pañal mojado hace ${durationText(minutesSince(lastWet, now), locale)}`)}`
        : null,
    ]),

    section(say(locale, 'ALS NÄCHSTES', 'UP NEXT', 'A CONTINUACIÓN'), [
      `• ${nextText}`,
      `• ${say(locale, 'Dein Fenster', 'Your window', 'Tu margen')}: ${windowText}`,
      conflictLine(briefing?.timeline, locale),
      `• ${confidenceText}`,
    ]),

    section(
      say(locale, 'TAGESWERTE', "TODAY'S NUMBERS", 'DATOS DE HOY'),
      cardLines(briefing?.cards),
    ),

    section(say(locale, 'LOTTIS HINWEIS', "LOTTI'S TIP", 'CONSEJO DE LOTTI'), [
      briefing?.headline ? `• ${briefing.headline}` : null,
      briefing?.body ? `• ${briefing.body}` : null,
      reasons.length > 0
        ? `• ${say(locale, 'Warum', 'Why', 'Por qué')}: ${reasons.join(' · ')}`
        : null,
    ]),

    section(
      say(locale, 'HEUTE IM PLAN', "TODAY'S PLAN", 'PLAN DE HOY'),
      planLines(briefing?.timeline),
    ),

    handoffRequest(signals, next, locale),
  ].filter((block): block is string => !!block);

  return {
    headline: headlineText,
    nowText,
    nextText,
    windowText,
    confidenceText,
    nextKind: next?.kind ?? null,
    nextWindowStart: next?.start.toISOString() ?? null,
    nextWindowEnd: next?.end.toISOString() ?? null,
    windowMinutes,
    roughNight: signals.sleep.roughNight,
    needsRelief,
    isLearning: !next && !signals.sleep.isSleepingNow,
    handoffLabel:
      needsRelief
        ? locale === 'en' ? 'Ask for relief' : locale === 'es' ? 'Pedir relevo' : 'Ablösung anfragen'
        : signals.sleep.roughNight
          ? locale === 'en' ? 'Share recovery mode' : locale === 'es' ? 'Compartir modo descanso' : 'Schonmodus übergeben'
        : next?.kind === 'sleep'
          ? locale === 'en' ? 'Hand off settling to sleep' : locale === 'es' ? 'Delegar el momento de dormir' : 'Einschlafen übergeben'
          : next?.kind === 'feeding'
            ? locale === 'en' ? 'Hand off the next feed' : locale === 'es' ? 'Delegar la próxima toma' : 'Nächste Mahlzeit übergeben'
            : locale === 'en' ? 'Share current status' : locale === 'es' ? 'Compartir situación actual' : 'Aktuellen Stand übergeben',
    handoffMessage: handoffBlocks.join('\n\n'),
  };
};
