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
  sleep: { minutes: number; isReal: boolean };
  weather: {
    available: boolean;
    temperature: number | null;
    feelsLike: number | null;
    description: string;
    isHot: boolean;
    isCold: boolean;
    isReal: boolean;
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
 * den Positiv-Fallback `all_good`.
 */
export const evaluateRules = (s: RuleSignals): RuleCandidate[] => {
  const name = s.babyName || 'dein Baby';
  const feedRef = typicalFeedings(s);
  const sleepRef = typicalSleepMinutes(s.ageMonths);
  const mode = resolveFeedingMode(s.feeding);
  const under6Months = s.ageMonths != null && s.ageMonths < 6;

  // „Wenig getrunken" nie aus reiner Mahlzeitenzahl ableiten, wenn Beikost
  // dominiert — dort zählt Flüssigkeit (Flasche/Wasser/nasse Windeln).
  const liquidCount =
    (s.feeding.breastCount ?? 0) +
    (s.feeding.bottleCount ?? 0) +
    (s.feeding.waterCount ?? 0);
  const lowFeeding =
    mode === 'solids'
      ? s.feeding.isReal && s.feeding.totalCount > 0 && liquidCount === 0
      : s.feeding.totalCount > 0 && s.feeding.totalCount < feedRef;

  const lowSleep = s.sleep.minutes > 0 && s.sleep.minutes < sleepRef;

  // Nasse Windeln (Hydrations-Indikator bei Hitze).
  const wetCount = s.diaper?.wetCountToday;
  const wetKnown = typeof wetCount === 'number' && s.diaper?.isReal !== false;

  // Intervall seit der letzten Mahlzeit vs. übliches Intervall
  // (~16 wache Stunden / übliche Mahlzeiten pro Tag, begrenzt auf 2–6 Std).
  const hoursSince = s.feeding.hoursSinceLastFeeding;
  const expectedIntervalH = Math.min(6, Math.max(2, 16 / Math.max(feedRef, 1)));
  const intervalLong =
    typeof hoursSince === 'number' &&
    hoursSince > expectedIntervalH * 1.3 &&
    mode !== 'solids';

  const baseFacts = {
    ageMonths: s.ageMonths,
    feedingsToday: s.feeding.totalCount,
    feedingsTypical: feedRef,
    feedingMode: mode,
    liquidFeedingsToday: liquidCount,
    hoursSinceLastFeeding: hoursSince ?? null,
    wetDiapersToday: wetKnown ? wetCount : null,
    sleepMinutes: s.sleep.minutes,
    sleepTypical: sleepRef,
    temperature: s.weather.temperature,
    feelsLike: s.weather.feelsLike,
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
          : `Heute erst ${s.feeding.totalCount} Mahlzeiten (üblich sind bei euch etwa ${feedRef})`,
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
        `Heutiger Schlaf (${Math.round(s.sleep.minutes / 6) / 10} Std) unter dem üblichen Rahmen`,
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
        hydrationCore(mode, under6Months),
      reasons: [
        `Wetter heute: warm (${temp(s)})`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
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
        `Heutiger Schlaf (${Math.round(s.sleep.minutes / 6) / 10} Std) unter dem üblichen Rahmen`,
        'Schlafmuster der letzten Tage',
      ],
      facts: baseFacts,
    });
  }

  // 4.6 Lange keine Mahlzeit — bevorzugt über das echte Intervall,
  // sonst über die Tageszahl. Nicht bei Beikost-Kindern, nicht bei Hitze
  // (dort greift die Kombi-Regel).
  if ((intervalLong || lowFeeding) && s.feeding.isReal && !s.weather.isHot && mode !== 'solids') {
    const intervalBody =
      typeof hoursSince === 'number'
        ? `Die letzte Mahlzeit ist ${hoursText(hoursSince)} her – bei euch liegt das Intervall sonst eher bei ${hoursText(expectedIntervalH)}. Magst du bald wieder ${offerPhrase(mode)} anbieten?`
        : `${name} hatte heute erst ${s.feeding.totalCount} Mahlzeiten – üblich sind bei euch eher ${feedRef}. Magst du bald wieder ${offerPhrase(mode)} anbieten?`;
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
          : `Heute erst ${s.feeding.totalCount} Mahlzeiten (üblich sind bei euch etwa ${feedRef})`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
      facts: baseFacts,
    });
  }

  // 4.9 Positiv-Fallback (immer vorhanden)
  candidates.push({
    ruleId: 'all_good',
    priority: 5,
    category: 'motivation',
    tone: 'positive',
    emoji: '🌿',
    title: 'Heute läuft es rund',
    headline: 'Alles im grünen Bereich',
    body: `${name}s Tag wirkt heute schön ausgeglichen – Schlaf, Trinken und Wickeln liegen im gewohnten Rahmen. Genießt euren Tag zusammen!`,
    coreContent:
      'Positive Rückmeldung: Die heutigen Werte liegen im gewohnten Rahmen. Kurz bestärken, keinen Handlungsauftrag geben.',
    reasons: [
      'Heutige Werte im Vergleich zu euren üblichen Mustern',
      'Schlaf, Ernährung und Windeln berücksichtigt',
    ],
    facts: baseFacts,
  });

  return candidates.sort((a, b) => a.priority - b.priority);
};

/**
 * Wählt den besten Kandidaten unter Beachtung von Theme-Opt-outs und
 * Regel-Cooldown (dieselbe Regel max. 1× pro 72 h → recentRuleIds).
 * Der Positiv-Fallback ist vom Cooldown ausgenommen, damit immer
 * ein Tageshinweis existiert.
 */
export const selectCandidate = (
  candidates: RuleCandidate[],
  options: { themes?: AdvisorCategory[] | null; recentRuleIds?: string[] },
): RuleCandidate => {
  const themes = options.themes;
  const recent = new Set(options.recentRuleIds ?? []);
  const allowed = candidates.filter((c) => {
    if (themes && themes.length > 0 && !themes.includes(c.category) && c.ruleId !== 'all_good') {
      return false;
    }
    if (recent.has(c.ruleId) && c.ruleId !== 'all_good') return false;
    return true;
  });
  return allowed[0] ?? candidates[candidates.length - 1];
};
