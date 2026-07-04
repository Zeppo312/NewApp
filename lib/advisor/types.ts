/**
 * Lottis Fürsorge – Typen für den (späteren) KI-Berater.
 *
 * Diese Datei beschreibt die Datenstruktur zwischen
 *   1. Signal-Erfassung  (buildDailySignals.ts – echte App-Daten)
 *   2. Analyse/Insights   (mockInsights.ts – aktuell Template, später Regeln/KI)
 *   3. UI                 (app/lottis-fuersorge.tsx)
 *
 * Wenn später die echte Regel-/KI-Logik kommt, muss nur die Analyse-Schicht
 * (mockInsights.ts) ersetzt werden – Signale und UI bleiben gleich.
 */

export type AdvisorTone = 'positive' | 'neutral' | 'gentle';

/** Roh-Signale eines Tages – soweit aus der App verfügbar, sonst Mockwerte. */
export interface DailySignals {
  babyName: string;
  ageMonths: number | null;
  ageText: string;

  feeding: {
    totalCount: number;
    bottleCount: number;
    breastCount: number;
    solidsCount: number;
    waterCount: number;
    totalBottleMl: number;
    summaryText: string;
    /** true = echte App-Daten, false = Mockwert */
    isReal: boolean;

    /* --- Feeding-Profil für die Regel-Engine (advisor-generate) --- */
    /** ISO-Zeitpunkt der letzten Mahlzeit (auch gestern), null = keine bekannt. */
    lastFeedingAt: string | null;
    hoursSinceLastFeeding: number | null;
    lastBreastAt: string | null;
    daysSinceLastBreast: number | null;
    breastCountLast21Days: number;
    bottleCountLast21Days: number;
    solidsCountLast21Days: number;
    /** Abgeleiteter Fütter-Modus aus den letzten 21 Tagen. */
    likelyFeedingMode: 'breast' | 'bottle' | 'mixed' | 'solids' | 'unknown';
    /** Eigene Baseline: Ø Mahlzeiten/Tag der letzten 14 Tage (null = zu wenig Historie). */
    typicalPerDay: number | null;
  };

  diaper: {
    count: number;
    isReal: boolean;
    /** Nasse Windeln heute (WET oder BOTH) – Hydrations-Indikator. */
    wetCountToday: number;
    lastWetAt: string | null;
  };

  sleep: {
    minutes: number;
    text: string;
    isReal: boolean;
  };

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

/** Eine kleine Analyse-Karte (Schlaf / Ernährung / Windeln / Wetter). */
export interface AnalysisCard {
  key: 'sleep' | 'feeding' | 'diaper' | 'weather';
  emoji: string;
  label: string;
  value: string;
  caption: string;
  /** 0..1 – Füllgrad für das Mini-Diagramm (Fortschrittsbalken). */
  progress: number;
  isReal: boolean;
}

/** Ein einzelner Hinweis (Hauptkarte oder Verlaufseintrag). */
export interface AdvisorInsight {
  id: string;
  tone: AdvisorTone;
  emoji: string;
  title: string;
  /** Kurze, fette Kernaussage – „worauf es ankommt" (nur für die Hauptkarte). */
  headline?: string;
  body: string;
}

/** Komplettes Analyse-Ergebnis für die Seite. */
export interface AdvisorAnalysis {
  main: AdvisorInsight;
  /** „Warum dieser Hinweis?" – welche Daten kombiniert wurden. */
  reasons: string[];
  history: AdvisorInsight[];
  cards: AnalysisCard[];
}
