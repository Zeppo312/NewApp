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
    /** Eigene Baseline bis zur aktuellen Uhrzeit. */
    typicalByNow: number | null;
    /** Anzahl historischer Tage, aus denen die Baseline entstand. */
    baselineSampleDays: number;
    /** Persönlicher Median zwischen Mahlzeiten am Tag. */
    typicalIntervalMinutes: number | null;
    intervalSampleCount: number;
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
    /** Eigener Schlafdurchschnitt bis zur aktuellen Uhrzeit. */
    typicalMinutesByNow: number | null;
    baselineSampleDays: number;
    lastSleepEndAt: string | null;
    currentSleepStartedAt: string | null;
    isSleepingNow: boolean;
    currentAwakeMinutes: number | null;
    /** Persönlicher Median der Wachphasen zwischen Tagesschläfen. */
    typicalWakeMinutes: number | null;
    wakeSampleCount: number;
    lastNightMinutes: number | null;
    typicalNightMinutes: number | null;
    nightSampleDays: number;
    /** Nur relativ zum persönlichen Nachtverlauf, keine medizinische Bewertung. */
    roughNight: boolean;
  };

  context: {
    localHour: number;
    localMinute: number;
  };

  weather: {
    available: boolean;
    /** Maßgebliche Tagestemperatur: Forecast-Tmax, sonst aktueller Wert. */
    temperature: number | null;
    feelsLike: number | null;
    description: string;
    isHot: boolean;
    isCold: boolean;
    isReal: boolean;

    /* --- Tagesforecast (Open-Meteo), null = nicht verfügbar --- */
    /** UV-Index-Maximum heute. */
    uvIndex: number | null;
    /** Regenwahrscheinlichkeit heute in %. */
    rainProbability: number | null;
    /** UV-Index über der Babyhaut-Schwelle (Sonnenschutz-Regel). */
    isHighUv: boolean;
    /** Regen heute wahrscheinlich (Regen-Hinweis). */
    isRainy: boolean;
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
