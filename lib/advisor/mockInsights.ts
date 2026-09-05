/**
 * Lottis Fürsorge – Template-/Mock-Analyse.
 *
 * ⚠️ Platzhalter: Hier entsteht später die echte Regel-/KI-Logik
 * (siehe docs/KI_BERATER_KONZEPT.md). Aktuell werden aus den DailySignals
 * deterministisch warme Beispiel-Hinweise abgeleitet – ohne Backend, ohne KI.
 *
 * Die Funktion ist bewusst rein (signals -> analysis), damit sie 1:1 durch
 * eine echte Engine ersetzt werden kann.
 */

import type { AdvisorAnalysis, AdvisorInsight, AnalysisCard, DailySignals } from './types';
import { activeDayProgress } from './baselines';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const expectedFeedingsByNow = (s: DailySignals): number => {
  if (typeof s.feeding.typicalByNow === 'number') return s.feeding.typicalByNow;
  const daily = s.feeding.typicalPerDay;
  if (typeof daily !== 'number') return 0;
  return daily * activeDayProgress(s.context.localHour, s.context.localMinute);
};

const expectedFeedingInterval = (s: DailySignals): number | null => {
  if (!s.feeding.typicalPerDay) return null;
  return Math.min(6, Math.max(2, 16 / s.feeding.typicalPerDay));
};

const buildCards = (s: DailySignals): AnalysisCard[] => {
  const cards: AnalysisCard[] = [
    {
      key: 'sleep',
      emoji: '💤',
      label: 'Schlaf',
      value: s.sleep.text,
      caption: s.sleep.minutes > 0 ? 'Heute erfasst' : 'Noch nichts erfasst',
      progress:
        s.sleep.typicalMinutesByNow && s.sleep.typicalMinutesByNow > 0
          ? clamp01(s.sleep.minutes / s.sleep.typicalMinutesByNow)
          : 0,
      isReal: s.sleep.isReal,
    },
    {
      key: 'feeding',
      emoji: '🍼',
      label: 'Ernährung',
      value:
        s.feeding.totalBottleMl > 0
          ? `${s.feeding.totalBottleMl} ml`
          : `${s.feeding.totalCount}×`,
      caption: s.feeding.summaryText,
      progress:
        expectedFeedingsByNow(s) > 0
          ? clamp01(s.feeding.totalCount / expectedFeedingsByNow(s))
          : 0,
      isReal: s.feeding.isReal,
    },
    {
      key: 'diaper',
      emoji: '💧',
      label: 'Windeln',
      value: `${s.diaper.count}×`,
      caption: s.diaper.count > 0 ? 'Heute gewechselt' : 'Noch nichts erfasst',
      // Referenz: ~7 Windeln/Tag.
      progress: clamp01(s.diaper.count / 7),
      isReal: s.diaper.isReal,
    },
    {
      key: 'weather',
      emoji: s.weather.isRainy
        ? '🌧️'
        : s.weather.isHot
          ? '☀️'
          : s.weather.isCold
            ? '🥶'
            : '🌤️',
      label: 'Wetter',
      value:
        s.weather.temperature != null ? `${s.weather.temperature}°` : '–',
      caption:
        [
          s.weather.description || null,
          s.weather.uvIndex != null ? `UV ${s.weather.uvIndex}` : null,
          s.weather.rainProbability != null
            ? `Regen ${Math.round(s.weather.rainProbability)} %`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Standort nötig',
      // Temperatur auf einer Skala von 0–40 °C.
      progress:
        s.weather.temperature != null ? clamp01(s.weather.temperature / 40) : 0,
      isReal: s.weather.isReal,
    },
  ];
  return cards;
};

/** Wählt den wichtigsten Hinweis (Prioritäten wie im Konzept, vereinfacht). */
const buildMainInsight = (s: DailySignals): { insight: AdvisorInsight; reasons: string[] } => {
  const name = s.babyName;
  const expectedByNow = expectedFeedingsByNow(s);
  const expectedInterval = expectedFeedingInterval(s);
  const longInterval =
    expectedInterval != null &&
    s.feeding.hoursSinceLastFeeding != null &&
    s.feeding.hoursSinceLastFeeding > expectedInterval * 1.3;
  const lowFeeding =
    longInterval ||
    (expectedByNow >= 2 && s.feeding.totalCount + 1 < expectedByNow);
  const lowSleep =
    s.sleep.typicalMinutesByNow != null &&
    s.sleep.typicalMinutesByNow >= 60 &&
    s.sleep.minutes + 60 < s.sleep.typicalMinutesByNow * 0.75;
  const feedingReason = longInterval && s.feeding.hoursSinceLastFeeding != null
    ? `Letzte Mahlzeit vor ${s.feeding.hoursSinceLastFeeding.toString().replace('.', ',')} Std`
    : `Bis jetzt ${s.feeding.totalCount} Mahlzeiten, bei euch sonst etwa ${Math.round(expectedByNow * 10) / 10}`;
  const sleepReason = s.sleep.typicalMinutesByNow != null
    ? `Bis jetzt ${s.sleep.text}, bei euch sonst etwa ${formatMinutes(s.sleep.typicalMinutesByNow)}`
    : 'Persönliches Schlafmuster berücksichtigt';

  // 1) Kombi: Hitze + heute wenig getrunken (Kern-USP)
  if (s.weather.isHot && lowFeeding) {
    return {
      insight: {
        id: 'hot_low_feeding',
        tone: 'gentle',
        emoji: '🌞',
        title: 'Heute wichtig',
        headline: `Heute öfter trinken anbieten`,
        body: `${name} hat heute bisher etwas weniger getrunken als sonst – und es wird warm. Biete ruhig öfter mal Brust oder Flasche an, an heißen Tagen darf es gern ein Schluck mehr sein.`,
      },
      reasons: [
        feedingReason,
        `Wetter heute: warm (${s.weather.temperature ?? '–'}°)`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
    };
  }

  // 2) Kombi: Hitze + unruhiger Schlaf
  if (s.weather.isHot && lowSleep) {
    return {
      insight: {
        id: 'hot_low_sleep',
        tone: 'gentle',
        emoji: '😴',
        title: 'Heute wichtig',
        headline: `Kühl & ruhig schlafen lassen`,
        body: `${name} hat heute etwas weniger geschlafen, und es wird schwül. Wärme kann den Babyschlaf stören – ein kühler, ruhiger Raum für den nächsten Schlaf hilft euch beiden.`,
      },
      reasons: [
        sleepReason,
        `Wetter heute: warm (${s.weather.temperature ?? '–'}°)`,
        'Schlafmuster der letzten Tage',
      ],
    };
  }

  // 3) Hitze allein
  if (s.weather.isHot) {
    return {
      insight: {
        id: 'hot',
        tone: 'gentle',
        emoji: '☀️',
        title: 'Heute wichtig',
        headline: `Vor Sonne & Hitze schützen`,
        body: `Heute wird es warm. Halte ${name} aus der direkten Sonne, denk an leichte, luftige Kleidung – und biete ruhig etwas öfter zu trinken an.`,
      },
      reasons: [
        `Wetter heute: warm (${s.weather.temperature ?? '–'}°)`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
    };
  }

  // 3b) Hoher UV-Index (Sonnenschutz auch ohne Hitze)
  if (s.weather.isHighUv && s.weather.uvIndex != null) {
    return {
      insight: {
        id: 'high_uv',
        tone: 'gentle',
        emoji: '🧴',
        title: 'Heute wichtig',
        headline: `Heute an Sonnenschutz denken`,
        body: `Der UV-Index steigt heute auf ${s.weather.uvIndex} – für Babyhaut ist das viel. Schatten, Sonnenhut und leichte, lange Kleidung schützen ${name} am besten; die Mittagssonne lieber meiden.`,
      },
      reasons: [
        `UV-Index heute bis ${s.weather.uvIndex} (ab 3 braucht Babyhaut Schutz)`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
    };
  }

  // 4) Kälte
  if (s.weather.isCold) {
    return {
      insight: {
        id: 'cold',
        tone: 'neutral',
        emoji: '🧣',
        title: 'Heute wichtig',
        headline: `Warm einpacken & Mütze auf`,
        body: `Heute wird's frisch. Eine Extraschicht und eine Mütze halten ${name} schön warm – bei Babys kühlt der Kopf am schnellsten aus.`,
      },
      reasons: [
        `Wetter heute: kühl (${s.weather.temperature ?? '–'}°)`,
        `Alter berücksichtigt: ${s.ageText || 'unbekannt'}`,
      ],
    };
  }

  // 5) Wenig Schlaf
  if (lowSleep) {
    return {
      insight: {
        id: 'low_sleep',
        tone: 'gentle',
        emoji: '🌙',
        title: 'Heute wichtig',
        headline: `Nächsten Schlaf früher einplanen`,
        body: `${name} hat heute etwas weniger geschlafen als sonst. Plant den nächsten Schlaf vielleicht etwas früher – und gönn auch dir eine kleine Pause, wenn es geht.`,
      },
      reasons: [
        sleepReason,
        `${s.sleep.baselineSampleDays} Vergleichstage berücksichtigt`,
      ],
    };
  }

  // 5b) Regen wahrscheinlich — praktischer Tageshinweis
  if (s.weather.isRainy && s.weather.rainProbability != null) {
    return {
      insight: {
        id: 'rain_likely',
        tone: 'neutral',
        emoji: '🌧️',
        title: 'Für heute gut zu wissen',
        headline: `Heute Regen einplanen`,
        body: `Für heute sind ${Math.round(s.weather.rainProbability)} % Regenwahrscheinlichkeit gemeldet. Pack für unterwegs den Regenschutz für den Kinderwagen ein – oder macht es euch drinnen gemütlich.`,
      },
      reasons: [
        `Regenwahrscheinlichkeit heute: ${Math.round(s.weather.rainProbability)} %`,
        `Wetter heute: ${s.weather.description || 'wechselhaft'}`,
      ],
    };
  }

  // 6b) Persönliches Mahlzeiten-Intervall — zeitabhängig, kein Tageszähler.
  if (lowFeeding && s.feeding.isReal && s.feeding.likelyFeedingMode !== 'solids') {
    const intervalText =
      longInterval && s.feeding.hoursSinceLastFeeding != null
        ? `Die letzte Mahlzeit ist ${s.feeding.hoursSinceLastFeeding
            .toString()
            .replace('.', ',')} Std her. Magst du ${name} bald wieder etwas anbieten?`
        : `${name} hatte bis jetzt ${s.feeding.totalCount} Mahlzeiten – um diese Uhrzeit sind es bei euch meist etwa ${Math.round(expectedByNow * 10) / 10}. Magst du bald wieder etwas anbieten?`;
    return {
      insight: {
        id: 'low_feeding',
        tone: 'gentle',
        emoji: '🍼',
        title: 'Heute wichtig',
        headline: 'Vielleicht bald wieder anbieten',
        body: intervalText,
      },
      reasons: [feedingReason, `${s.feeding.baselineSampleDays} Vergleichstage berücksichtigt`],
    };
  }

  const hasPersonalBaseline =
    s.feeding.typicalByNow != null || s.sleep.typicalMinutesByNow != null;
  if (!hasPersonalBaseline) {
    return {
      insight: {
        id: 'learning',
        tone: 'neutral',
        emoji: '🌱',
        title: 'Lotti lernt euch kennen',
        headline: 'Noch kein Vergleich nötig',
        body: `Erfasse ein paar Tage lang Schlaf und Mahlzeiten von ${name}. Ab drei Vergleichstagen kann Lotti euren eigenen Rhythmus statt allgemeiner Grenzwerte nutzen.`,
      },
      reasons: ['Noch weniger als 3 ausreichend erfasste Vergleichstage'],
    };
  }

  // 7) Positiv-Fallback, aber nur mit einer belastbaren persönlichen Baseline.
  return {
    insight: {
      id: 'all_good',
      tone: 'positive',
      emoji: '🌿',
      title: 'Heute läuft es rund',
      headline: `Alles im grünen Bereich`,
      body: `${name}s Tag wirkt heute schön ausgeglichen – Schlaf, Trinken und Wickeln liegen im gewohnten Rahmen. Genießt euren Tag zusammen!`,
    },
    reasons: [
      'Heutige Werte im Vergleich zu euren üblichen Mustern',
      'Schlaf, Ernährung und Windeln berücksichtigt',
    ],
  };
};

const formatMinutes = (minutes: number): string => {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return `${rest} Min`;
  if (rest === 0) return `${hours} Std`;
  return `${hours} Std ${rest} Min`;
};

/**
 * Kleinere Zusatz-Hinweise, direkt aus den heutigen echten Daten abgeleitet.
 * Nur zeigen, was wir wirklich wissen — keine Füll-Behauptungen.
 * (Sobald echter Verlauf aus `advisor_messages` existiert, zeigt die
 * Seite ohnehin diesen statt dieser Sektion.)
 */
const buildHistory = (s: DailySignals): AdvisorInsight[] => {
  const history: AdvisorInsight[] = [];

  if (s.sleep.minutes > 0) {
    history.push(
      s.sleep.typicalMinutesByNow != null &&
      s.sleep.minutes >= s.sleep.typicalMinutesByNow * 0.85
        ? {
            id: 'h_sleep_stable',
            tone: 'positive',
            emoji: '💤',
            title: 'Schlaf im guten Rahmen',
            body: `${s.babyName} hat heute schon ${s.sleep.text} geschlafen.`,
          }
        : {
            id: 'h_sleep_low',
            tone: 'neutral',
            emoji: '💤',
            title: 'Heute bisher weniger Schlaf',
            body: `Bisher ${s.sleep.text} erfasst – vielleicht kommt der nächste Schlaf etwas früher.`,
          },
    );
  }

  if (s.feeding.totalCount > 0) {
    history.push(
      expectedFeedingsByNow(s) >= 2 &&
      s.feeding.totalCount + 1 < expectedFeedingsByNow(s)
        ? {
            id: 'h_feeding_low',
            tone: 'gentle',
            emoji: '🍼',
            title: 'Trinken heute etwas unter Durchschnitt',
            body: `Heute bisher ${s.feeding.totalCount} ${s.feeding.totalCount === 1 ? 'Mahlzeit' : 'Mahlzeiten'} erfasst.`,
          }
        : {
            id: 'h_feeding_ok',
            tone: 'positive',
            emoji: '🍼',
            title: 'Trinken im gewohnten Rahmen',
            body: `Heute schon ${s.feeding.totalCount} Mahlzeiten – das passt gut.`,
          },
    );
  }

  if (s.diaper.count > 0) {
    history.push({
      id: 'h_diaper',
      tone: 'neutral',
      emoji: '💧',
      title: 'Windeln heute',
      body: `${s.diaper.count}× gewechselt – alles im Blick.`,
    });
  }

  return history;
};

/** Erzeugt die komplette Analyse für die Seite. */
export const buildMockAnalysis = (signals: DailySignals): AdvisorAnalysis => {
  const { insight, reasons } = buildMainInsight(signals);
  return {
    main: insight,
    reasons,
    history: buildHistory(signals),
    cards: buildCards(signals),
  };
};
