/**
 * Lottis Fürsorge – deterministische Regel-Engine (Server-Seite).
 *
 * Wird von beiden Edge Functions genutzt (identische Kopie in
 * advisor-generate/ und advisor-daily/ — bei Änderungen BEIDE anpassen!):
 *   - advisor-generate : On-Demand beim Öffnen der Seite (Signale vom Client)
 *   - advisor-daily    : Cron-Job morgens (Signale aus der DB + Wetter-API)
 *
 * Die Regel-Ids entsprechen exakt den Ids in lib/advisor/mockInsights.ts,
 * damit die App (Chips, Kategorien) sie ohne Mapping rendern kann.
 *
 * Ernährungs-Bewusstsein: Die Signale enthalten ein Feeding-Profil
 * (Stillen/Flasche/Beikost/Wasser, letzte Mahlzeit, 21-Tage-Historie).
 * Die Texte passen sich dem tatsächlichen Fütter-Modus an — wer nie
 * stillt, bekommt keine Still-Empfehlungen.
 *
 * Wichtig: Die KI (advisorAi.ts) formuliert nur den hier festgelegten
 * Kerninhalt um — sie erfindet keine neuen medizinischen Aussagen.
 */

export type AdvisorTone = 'positive' | 'neutral' | 'gentle';
export type AdvisorCategory = 'weather' | 'sleep' | 'feeding' | 'motivation';
export type FeedingMode = 'breast' | 'bottle' | 'mixed' | 'solids' | 'unknown';

/** Ernährungs-Signale inkl. Profil. Neue Felder optional (abwärtskompatibel). */
export interface RuleFeeding {
  totalCount: number;
  isReal: boolean;
  bottleCount?: number;
  breastCount?: number;
  solidsCount?: number;
  waterCount?: number;
  totalBottleMl?: number;
  /** ISO-Zeitpunkt der letzten Mahlzeit. */
  lastFeedingAt?: string | null;
  hoursSinceLastFeeding?: number | null;
  lastBreastAt?: string | null;
  daysSinceLastBreast?: number | null;
  breastCountLast21Days?: number;
  bottleCountLast21Days?: number;
  solidsCountLast21Days?: number;
  likelyFeedingMode?: FeedingMode;
  /** Eigene 14-Tage-Baseline (Mahlzeiten/Tag); null = zu wenig Historie. */
  typicalPerDay?: number | null;
  /** Eigene 14-Tage-Baseline bis zur aktuellen Uhrzeit. */
  typicalByNow?: number | null;
  baselineSampleDays?: number;
}

export interface RuleDiaper {
  count?: number;
  wetCountToday?: number;
  lastWetAt?: string | null;
  isReal?: boolean;
}

/** Signale eines Tages – Teilmenge von lib/advisor/types.ts (DailySignals). */
export interface RuleSignals {
  babyName: string;
  ageMonths: number | null;
  ageText: string;
  feeding: RuleFeeding;
  diaper?: RuleDiaper;
  sleep: {
    minutes: number;
    isReal: boolean;
    typicalMinutesByNow?: number | null;
    baselineSampleDays?: number;
  };
  context?: { localHour: number; localMinute: number };
  weather: {
    available: boolean;
    temperature: number | null;
    feelsLike: number | null;
    description: string;
    isHot: boolean;
    isCold: boolean;
    isReal: boolean;
    /* Tagesforecast-Felder — optional (abwärtskompatibel zu alten Clients). */
    uvIndex?: number | null;
    rainProbability?: number | null;
    isHighUv?: boolean;
    isRainy?: boolean;
  };
}

export interface RuleCandidate {
  ruleId: string;
  priority: number; // 1 = höchste (Kombi-Regeln)
  category: AdvisorCategory;
  tone: AdvisorTone;
  emoji: string;
  title: string;
  headline: string;
  /** Fertiger Template-Text (KI-Fallback, sofort versandfertig). */
  body: string;
  /** Geprüfter Kerninhalt – einzige inhaltliche Quelle für die KI. */
  coreContent: string;
  /** „Warum dieser Hinweis?" für die Detail-Ansicht der App. */
  reasons: string[];
  /** Audit-Fakten für advisor_messages.facts + KI-Payload. */
  facts: Record<string, unknown>;
}

/** Altersabhängige Fallback-Referenzen (nur wenn keine eigene Baseline). */
export const typicalFeedingsByAge = (ageMonths: number | null): number => {
  if (ageMonths == null) return 5;
  if (ageMonths < 3) return 7;
  if (ageMonths < 6) return 6;
  if (ageMonths < 12) return 5;
  return 4;
};

export const typicalSleepMinutes = (ageMonths: number | null): number => {
  if (ageMonths == null) return 360;
  if (ageMonths < 3) return 420;
  if (ageMonths < 12) return 360;
  return 330;
};

/** Eigene Baseline des Babys, sonst Alters-Fallback. */
export const typicalFeedings = (s: RuleSignals): number => {
  const own = s.feeding.typicalPerDay;
  if (typeof own === 'number' && own >= 1) return Math.round(own * 10) / 10;
  return typicalFeedingsByAge(s.ageMonths);
};

/** Fütter-Modus bestimmen: explizit geliefert oder aus der 21-Tage-Historie. */
export const resolveFeedingMode = (f: RuleFeeding): FeedingMode => {
  if (f.likelyFeedingMode) return f.likelyFeedingMode;
  const breast = f.breastCountLast21Days ?? 0;
  const bottle = f.bottleCountLast21Days ?? 0;
  const solids = f.solidsCountLast21Days ?? 0;
  if (breast > 0 && bottle > 0) return 'mixed';
  if (breast > 0) return 'breast';
  if (bottle > 0) return 'bottle';
  if (solids > 0) return 'solids';
  return 'unknown';
};

/** „Biete … an" — passend zum tatsächlichen Fütter-Modus formuliert. */
const offerPhrase = (mode: FeedingMode): string => {
  switch (mode) {
    case 'breast':
      return 'die Brust';
    case 'bottle':
      return 'die Flasche';
    case 'solids':
      return 'etwas zu trinken';
    default:
      return 'Brust oder Flasche';
  }
};

/** Kerninhalt-Baustein Flüssigkeit — modus- und altersgerecht. */
const hydrationCore = (mode: FeedingMode, under6Months: boolean): string => {
  const offer =
    mode === 'breast'
      ? 'häufiger stillen'
      : mode === 'bottle'
        ? 'öfter die Flasche anbieten'
        : mode === 'solids'
          ? 'regelmäßig Flüssigkeit anbieten'
          : 'öfter Brust bzw. Flasche anbieten';
  return (
    `An heißen Tagen brauchen Babys mehr Flüssigkeit: ${offer}.` +
    (under6Months
      ? ' Unter 6 Monaten KEIN zusätzliches Wasser geben — Muttermilch bzw. Pre-Nahrung decken den Bedarf.'
      : '')
  );
};

const temp = (s: RuleSignals): string =>
  s.weather.temperature != null ? `${Math.round(s.weather.temperature)}°` : 'warm';

const hoursText = (h: number): string =>
  `${(Math.round(h * 10) / 10).toString().replace('.', ',')} Std`;

/**
 * Wertet alle Regeln aus und liefert die aktiven Kandidaten,
 * sortiert nach Priorität (beste zuerst). Enthält immer mindestens
 * einen sicheren Fallback (`all_good` oder `learning`).
 */
export const evaluateRules = (s: RuleSignals): RuleCandidate[] => {
  const name = s.babyName || 'dein Baby';
  const feedRef = typicalFeedings(s);
  const sleepRef = typicalSleepMinutes(s.ageMonths);
  const mode = resolveFeedingMode(s.feeding);
  const under6Months = s.ageMonths != null && s.ageMonths < 6;

  const localHour = s.context?.localHour ?? 12;
  const localMinute = s.context?.localMinute ?? 0;
  const activeProgress = Math.max(
    0,
    Math.min(1, (localHour * 60 + localMinute - 6 * 60) / (16 * 60)),
  );
  const expectedByNow =
    typeof s.feeding.typicalByNow === 'number'
      ? s.feeding.typicalByNow
      : typeof s.feeding.typicalPerDay === 'number'
        ? s.feeding.typicalPerDay * activeProgress
        : null;

  // Intervall seit der letzten Mahlzeit vs. übliches Intervall
  // (~16 wache Stunden / übliche Mahlzeiten pro Tag, begrenzt auf 2–6 Std).
  const hoursSince = s.feeding.hoursSinceLastFeeding;
  const expectedIntervalH = Math.min(6, Math.max(2, 16 / Math.max(feedRef, 1)));
  const intervalLong =
    typeof hoursSince === 'number' &&
    hoursSince > expectedIntervalH * 1.3 &&
    mode !== 'solids';
  const countLowForThisTime =
    expectedByNow != null && expectedByNow >= 2 &&
    s.feeding.totalCount + 1 < expectedByNow;

  // „Wenig getrunken" nie aus einer starren Tagesgrenze ableiten. Bei
  // Beikost zählt zusätzlich, ob bis jetzt überhaupt Flüssigkeit erfasst ist.
  const liquidCount =
    (s.feeding.breastCount ?? 0) +
    (s.feeding.bottleCount ?? 0) +
    (s.feeding.waterCount ?? 0);
  const lowFeeding =
    mode === 'solids'
      ? countLowForThisTime && liquidCount === 0
      : intervalLong || countLowForThisTime;

  const sleepTypicalByNow = s.sleep.typicalMinutesByNow;
  const lowSleep =
    typeof sleepTypicalByNow === 'number' &&
    sleepTypicalByNow >= 60 &&
    s.sleep.minutes + 60 < sleepTypicalByNow * 0.75;

  // Nasse Windeln (Hydrations-Indikator bei Hitze).
  const wetCount = s.diaper?.wetCountToday;
  const wetKnown = typeof wetCount === 'number' && s.diaper?.isReal !== false;

  // Tagesforecast: UV & Regen (Fallback-Schwellen, falls der Client die
  // Flags noch nicht liefert). Babyhaut braucht ab UV 3 Schutz; die eigene
  // Regel greift ab UV 5.
  const uvIndex = s.weather.uvIndex ?? null;
  const highUv = s.weather.isHighUv ?? (uvIndex != null && uvIndex >= 5);
  const rainProb = s.weather.rainProbability ?? null;
  const rainy = s.weather.isRainy ?? (rainProb != null && rainProb >= 60);

  const baseFacts = {
    ageMonths: s.ageMonths,
    feedingsToday: s.feeding.totalCount,
    feedingsTypical: feedRef,
    feedingsTypicalByNow: expectedByNow,
    baselineSampleDays: s.feeding.baselineSampleDays ?? 0,
    feedingMode: mode,
    liquidFeedingsToday: liquidCount,
    hoursSinceLastFeeding: hoursSince ?? null,
    wetDiapersToday: wetKnown ? wetCount : null,
    sleepMinutes: s.sleep.minutes,
    sleepTypical: sleepRef,
    sleepTypicalByNow: sleepTypicalByNow ?? null,
    localHour,
    temperature: s.weather.temperature,
    feelsLike: s.weather.feelsLike,
    uvIndex,
    rainProbability: rainProb,
  };

  const candidates: RuleCandidate[] = [];

  // 4.7 KOMBI: Hitze + wenig getrunken (Kern-USP)
  if (s.weather.isHot && lowFeeding) {
    const wetReason =
      wetKnown && wetCount === 0
        ? ['Heute noch keine nasse Windel erfasst']
        : [];
    candidates.push({
      ruleId: 'hot_low_feeding',
      priority: 1,
      category: 'feeding',
      tone: 'gentle',
      emoji: '🌞',
      title: 'Heute wichtig',
      headline: 'Heute öfter trinken anbieten',
      body:
        mode === 'solids'
          ? `${name} hatte heute noch nichts zu trinken – und es wird warm (${temp(s)}). Biete zwischendurch ruhig etwas Flüssigkeit an, an heißen Tagen darf es gern mehr sein.`
          : `${name} hat heute bisher etwas weniger getrunken als sonst – und es wird warm (${temp(s)}). Biete ruhig öfter ${offerPhrase(mode)} an, an heißen Tagen darf es gern ein Schluck mehr sein.`,
      coreContent:
        hydrationCore(mode, under6Months) +
        ' Auf ausreichend nasse Windeln achten; wirkt das Baby schlapp oder sind die Windeln auffallend trocken, ärztlich abklären lassen.',
      reasons: [
        mode === 'solids'
          ? `Heute ${s.feeding.totalCount} Mahlzeiten, aber noch nichts zu trinken erfasst`
          : typeof hoursSince === 'number' && intervalLong
            ? `Letzte Mahlzeit vor ${hoursText(hoursSince)} (bei euch meist etwa ${hoursText(expectedIntervalH)})`
            : `Bis jetzt ${s.feeding.totalCount} Mahlzeiten (bei euch sonst etwa ${Math.round((expectedByNow ?? 0) * 10) / 10})`,
        `Wetter heute: warm (${temp(s)})`,
        ...wetReason,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
      facts: baseFacts,
    });
  }

  // 4.8 KOMBI: Hitze + unruhiger Schlaf
  if (s.weather.isHot && lowSleep) {
    candidates.push({
      ruleId: 'hot_low_sleep',
      priority: 1,
      category: 'sleep',
      tone: 'gentle',
      emoji: '😴',
      title: 'Heute wichtig',
      headline: 'Kühl & ruhig schlafen lassen',
      body: `${name} hat weniger geschlafen als sonst, und es wird schwül (${temp(s)}). Wärme stört den Babyschlaf zusätzlich – ein kühler, ruhiger Raum für den nächsten Schlaf hilft euch beiden.`,
      coreContent:
        'Hitze stört den Babyschlaf. Für den nächsten Schlaf den kühlsten Raum wählen, leichte Kleidung bzw. dünneren Schlafsack nutzen und das Schlaffenster eher etwas vorziehen.',
      reasons: [
        `Bis jetzt ${Math.round(s.sleep.minutes / 6) / 10} Std Schlaf (bei euch sonst etwa ${Math.round((sleepTypicalByNow ?? 0) / 6) / 10} Std)`,
        `Wetter heute: warm (${temp(s)})`,
        'Schlafmuster der letzten Tage',
      ],
      facts: baseFacts,
    });
  }

  // 4.1 Hitze allein
  if (s.weather.isHot) {
    candidates.push({
      ruleId: 'hot',
      priority: s.ageMonths != null && s.ageMonths < 3 ? 1 : 2,
      category: 'weather',
      tone: 'gentle',
      emoji: '☀️',
      title: 'Heute wichtig',
      headline: 'Vor Sonne & Hitze schützen',
      body: `Heute wird es warm (${temp(s)}). Halte ${name} aus der direkten Sonne, denk an leichte, luftige Kleidung – und biete ruhig etwas öfter ${offerPhrase(mode)} an.`,
      coreContent:
        'Direkte Sonne meiden, dünne lange Kleidung, Räume kühl halten. ' +
        hydrationCore(mode, under6Months) +
        (highUv && uvIndex != null
          ? ` Zusätzlich ist der UV-Index heute hoch (${uvIndex}): Schatten, Sonnenhut, Mittagssonne meiden.`
          : ''),
      reasons: [
        `Wetter heute: warm (${temp(s)})`,
        ...(uvIndex != null && uvIndex >= 3 ? [`UV-Index heute bis ${uvIndex}`] : []),
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
      facts: baseFacts,
    });
  }

  // 4.2 Hoher UV-Index (auch ohne Hitze — Frühling/Berge/klarer Himmel)
  if (highUv && uvIndex != null) {
    candidates.push({
      ruleId: 'high_uv',
      priority: 2,
      category: 'weather',
      tone: 'gentle',
      emoji: '🧴',
      title: 'Heute wichtig',
      headline: 'Heute an Sonnenschutz denken',
      body: `Der UV-Index steigt heute auf ${uvIndex} – für Babyhaut ist das viel. Schatten, Sonnenhut und leichte, lange Kleidung schützen ${name} am besten; die Mittagssonne lieber meiden.`,
      coreContent:
        `Hoher UV-Index (heute bis ${uvIndex}). Babys im ersten Jahr nicht in die direkte Sonne: Schatten, Sonnenhut, dünne lange Kleidung. Mittagszeit (11–15 Uhr) draußen meiden.` +
        (under6Months
          ? ' Sonnencreme wird unter 6 Monaten nicht empfohlen — Schatten und Kleidung sind der beste Schutz.'
          : ' Freie Hautstellen mit Baby-Sonnencreme (LSF 50) schützen.'),
      reasons: [
        `UV-Index heute bis ${uvIndex} (ab 3 braucht Babyhaut Schutz)`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
      facts: baseFacts,
    });
  }

  // 4.4 Regen wahrscheinlich — praktischer Tageshinweis
  if (rainy && rainProb != null && !s.weather.isHot) {
    candidates.push({
      ruleId: 'rain_likely',
      priority: 4,
      category: 'weather',
      tone: 'neutral',
      emoji: '🌧️',
      title: 'Für heute gut zu wissen',
      headline: 'Heute Regen einplanen',
      body: `Für heute sind ${Math.round(rainProb)} % Regenwahrscheinlichkeit gemeldet. Pack für unterwegs den Regenschutz für den Kinderwagen ein – oder macht es euch drinnen gemütlich.`,
      coreContent:
        `Regenwahrscheinlichkeit heute ${Math.round(rainProb)} %. Praktischer Hinweis: Regenverdeck/Regenschutz für Kinderwagen oder Trage einpacken, Spaziergang in eine trockenere Tageszeit legen. Kein Gesundheitsalarm.`,
      reasons: [
        `Regenwahrscheinlichkeit heute: ${Math.round(rainProb)} %`,
        `Wetter heute: ${s.weather.description || 'wechselhaft'}`,
      ],
      facts: baseFacts,
    });
  }

  // 4.3 Kälte
  if (s.weather.isCold) {
    candidates.push({
      ruleId: 'cold',
      priority: 2,
      category: 'weather',
      tone: 'neutral',
      emoji: '🧣',
      title: 'Heute wichtig',
      headline: 'Warm einpacken & Mütze auf',
      body: `Heute wird's frisch (${temp(s)}). Eine Extraschicht und eine Mütze halten ${name} schön warm – bei Babys kühlt der Kopf am schnellsten aus.`,
      coreContent:
        'Zwiebelschicht-Prinzip, Mütze (Kopf kühlt am schnellsten aus), Hände und Füße prüfen. Im Auto oder Tragesitz dicke Jacke ausziehen (Gurt-Sicherheit).',
      reasons: [
        `Wetter heute: kühl (${temp(s)})`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
      facts: baseFacts,
    });
  }

  // 4.5 Unruhige Nacht / wenig Schlaf
  if (lowSleep) {
    candidates.push({
      ruleId: 'low_sleep',
      priority: 3,
      category: 'sleep',
      tone: 'gentle',
      emoji: '🌙',
      title: 'Heute wichtig',
      headline: 'Nächsten Schlaf früher einplanen',
      body: `${name} hat heute etwas weniger geschlafen als sonst. Plant den nächsten Schlaf vielleicht etwas früher – und gönn auch dir eine kleine Pause, wenn es geht.`,
      coreContent:
        'Nach einer kurzen Nacht den Mittagsschlaf nicht zu spät legen, Schlaffenster eher vorziehen, den Tag ruhig gestalten. Auch die Eltern-Selbstfürsorge erwähnen.',
      reasons: [
        `Bis jetzt ${Math.round(s.sleep.minutes / 6) / 10} Std Schlaf (bei euch sonst etwa ${Math.round((sleepTypicalByNow ?? 0) / 6) / 10} Std)`,
        `${s.sleep.baselineSampleDays ?? 0} Vergleichstage berücksichtigt`,
      ],
      facts: baseFacts,
    });
  }

  // 4.6 Lange keine Mahlzeit — bevorzugt über das echte Intervall,
  // sonst über die Tageszahl. Nicht bei Beikost-Kindern, nicht bei Hitze
  // (dort greift die Kombi-Regel).
  if (lowFeeding && s.feeding.isReal && !s.weather.isHot && mode !== 'solids') {
    const intervalBody =
      typeof hoursSince === 'number'
        ? `Die letzte Mahlzeit ist ${hoursText(hoursSince)} her – bei euch liegt das Intervall sonst eher bei ${hoursText(expectedIntervalH)}. Magst du bald wieder ${offerPhrase(mode)} anbieten?`
        : `${name} hatte bis jetzt ${s.feeding.totalCount} Mahlzeiten – um diese Uhrzeit sind es bei euch meist etwa ${Math.round((expectedByNow ?? 0) * 10) / 10}. Magst du bald wieder ${offerPhrase(mode)} anbieten?`;
    candidates.push({
      ruleId: 'low_feeding',
      priority: 3,
      category: 'feeding',
      tone: 'gentle',
      emoji: '🍼',
      title: 'Heute wichtig',
      headline: 'Vielleicht bald wieder anbieten',
      body: intervalBody,
      coreContent:
        'Sanfter, informativer Hinweis auf die nächste Mahlzeit. Kein Alarm — nur eine Erinnerung, wieder anzubieten.',
      reasons: [
        typeof hoursSince === 'number'
          ? `Letzte Mahlzeit vor ${hoursText(hoursSince)} (üblich: etwa ${hoursText(expectedIntervalH)})`
          : `Bis jetzt ${s.feeding.totalCount} Mahlzeiten (bei euch sonst etwa ${Math.round((expectedByNow ?? 0) * 10) / 10})`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
      facts: baseFacts,
    });
  }

  const hasPersonalBaseline = expectedByNow != null || sleepTypicalByNow != null;

  // 4.9 Fallback: ohne persönliche Daten ehrlich Lernphase zeigen.
  candidates.push({
    ruleId: hasPersonalBaseline ? 'all_good' : 'learning',
    priority: 5,
    category: 'motivation',
    tone: hasPersonalBaseline ? 'positive' : 'neutral',
    emoji: hasPersonalBaseline ? '🌿' : '🌱',
    title: hasPersonalBaseline ? 'Heute läuft es rund' : 'Lotti lernt euch kennen',
    headline: hasPersonalBaseline ? 'Alles im grünen Bereich' : 'Noch kein Vergleich nötig',
    body: hasPersonalBaseline
      ? `${name}s Tag wirkt heute schön ausgeglichen – Schlaf, Trinken und Wickeln liegen im gewohnten Rahmen. Genießt euren Tag zusammen!`
      : `Erfasse ein paar Tage lang Schlaf und Mahlzeiten von ${name}. Ab drei Vergleichstagen kann Lotti euren eigenen Rhythmus statt allgemeiner Grenzwerte nutzen.`,
    coreContent: hasPersonalBaseline
      ? 'Positive Rückmeldung: Die heutigen Werte liegen im gewohnten Rahmen. Kurz bestärken, keinen Handlungsauftrag geben.'
      : 'Transparent erklären, dass noch zu wenige persönliche Vergleichstage vorliegen. Keine medizinische Bewertung und keine Entwarnung behaupten.',
    reasons: hasPersonalBaseline
      ? [
          'Heutige Werte im Vergleich zu euren üblichen Mustern',
          'Schlaf, Ernährung und Windeln berücksichtigt',
        ]
      : ['Noch weniger als 3 ausreichend erfasste Vergleichstage'],
    facts: baseFacts,
  });

  return candidates.sort((a, b) => a.priority - b.priority);
};

/**
 * Wählt den besten Kandidaten unter Beachtung von Theme-Opt-outs und
 * Regel-Cooldown (dieselbe Regel max. 1× pro 72 h → recentRuleIds).
 * Die Fallbacks sind vom Cooldown ausgenommen, damit immer
 * ein Tageshinweis existiert.
 */
export const selectCandidate = (
  candidates: RuleCandidate[],
  options: { themes?: AdvisorCategory[] | null; recentRuleIds?: string[] },
): RuleCandidate => {
  const themes = options.themes;
  const recent = new Set(options.recentRuleIds ?? []);
  const allowed = candidates.filter((c) => {
    const fallback = c.ruleId === 'all_good' || c.ruleId === 'learning';
    if (themes && themes.length > 0 && !themes.includes(c.category) && !fallback) {
      return false;
    }
    if (recent.has(c.ruleId) && !fallback) return false;
    return true;
  });
  return allowed[0] ?? candidates[candidates.length - 1];
};
