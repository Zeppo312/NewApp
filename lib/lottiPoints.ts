/**
 * Lotti-Punkte & Lotti-Stufe — sanftes Progressionssystem.
 *
 * Intern XP, im UI „Lotti-Punkte" und „Stufe". Punkte werden pro Kalendertag
 * mit Caps berechnet, damit Übertracking nicht belohnt wird. Keine Streaks,
 * keine Verlust-Mechanik.
 */

export const LOTTI_POINTS = {
  PER_FEEDING: 5,
  PER_CARE: 5,
  PER_SLEEP: 8,
  FIRST_ENTRY_BONUS: 5,
  ALL_AREAS_BONUS: 10,
  CAP_FEEDING: 20,
  CAP_CARE: 20,
  CAP_SLEEP: 16,
  CAP_BONUS: 15,
} as const;

export type DayCounts = {
  feedingCount: number;
  careCount: number;
  sleepCount: number;
};

export type DayPointBreakdown = {
  feeding: number;
  care: number;
  sleep: number;
  bonus: number;
  total: number;
};

/** Punkte für einen Kalendertag — mit Caps und sanften Bonusregeln. */
export function computeDayPoints(counts: DayCounts): DayPointBreakdown {
  const feeding = Math.min(
    counts.feedingCount * LOTTI_POINTS.PER_FEEDING,
    LOTTI_POINTS.CAP_FEEDING,
  );
  const care = Math.min(
    counts.careCount * LOTTI_POINTS.PER_CARE,
    LOTTI_POINTS.CAP_CARE,
  );
  const sleep = Math.min(
    counts.sleepCount * LOTTI_POINTS.PER_SLEEP,
    LOTTI_POINTS.CAP_SLEEP,
  );

  const totalEntries =
    counts.feedingCount + counts.careCount + counts.sleepCount;
  const hasFirst = totalEntries > 0;
  const hasAllThree =
    counts.feedingCount > 0 && counts.careCount > 0 && counts.sleepCount > 0;

  const rawBonus =
    (hasFirst ? LOTTI_POINTS.FIRST_ENTRY_BONUS : 0) +
    (hasAllThree ? LOTTI_POINTS.ALL_AREAS_BONUS : 0);
  const bonus = Math.min(rawBonus, LOTTI_POINTS.CAP_BONUS);

  return {
    feeding,
    care,
    sleep,
    bonus,
    total: feeding + care + sleep + bonus,
  };
}

export type LottiLevel = {
  level: number;
  name: string;
  threshold: number;
  /** Kleines Bild-Emoji für die Reise-Ansicht. */
  icon: string;
  /** Ein-Satz-Beschreibung — soft, nicht heroisch. */
  description: string;
};

/**
 * 30 sanfte Lotti-Stufen — Schwellen wachsen progressiv (immer +50 pro Level
 * im Delta), damit langfristige Begleitung sich nach Mastery anfühlt.
 *
 * Für ein/e Power-User/in mit ~50 Punkten/Tag dauert Stufe 30 etwa 1 Jahr.
 */
export const LOTTI_LEVELS: readonly LottiLevel[] = [
  { level: 1, name: 'Erste Schritte', threshold: 0, icon: '👣', description: 'Ihr lernt euch kennen — Schritt für Schritt.' },
  { level: 2, name: 'Routinen entstehen', threshold: 40, icon: '🌅', description: 'Kleine Gewohnheiten, die euch tragen.' },
  { level: 3, name: 'Eure Woche wächst', threshold: 100, icon: '🌱', description: 'Eure Tage bekommen langsam Form.' },
  { level: 4, name: 'Muster werden sichtbar', threshold: 180, icon: '🪟', description: 'Ihr erkennt, was Lotti gerade braucht.' },
  { level: 5, name: 'Lotti begleitet euch', threshold: 300, icon: '🤍', description: 'Lotti ist mit eurem Alltag verwoben.' },
  { level: 6, name: 'Erinnerungen wachsen', threshold: 450, icon: '⭐', description: 'Gemeinsam besondere Momente sammeln.' },
  { level: 7, name: 'Wochenprofi', threshold: 650, icon: '📅', description: 'Ihr meistert eure Wochen mit Ruhe.' },
  { level: 8, name: 'Vertraute Wege', threshold: 900, icon: '🛤️', description: 'Eure Wege werden sicherer und leichter.' },
  { level: 9, name: 'Gemeinsame Routinen', threshold: 1200, icon: '🤝', description: 'Ihr tragt euch gegenseitig.' },
  { level: 10, name: 'Kleine Rituale', threshold: 1550, icon: '☕', description: 'Eure liebevollen Momente werden zur Tradition.' },
  { level: 11, name: 'Sanfte Gewohnheiten', threshold: 1950, icon: '🍃', description: 'Was euch gut tut, bleibt.' },
  { level: 12, name: 'Familienrhythmus', threshold: 2400, icon: '💜', description: 'Euer Alltag findet seinen kleinen, großen Rhythmus.' },
  { level: 13, name: 'Lotti-Familie', threshold: 2900, icon: '🏡', description: 'Euer Netzwerk stärkt und trägt euch.' },
  { level: 14, name: 'Geteilte Augenblicke', threshold: 3450, icon: '✨', description: 'Eure kleinen Momente verbinden euch tief.' },
  { level: 15, name: 'Eure Geschichte', threshold: 4050, icon: '📖', description: 'Eure Wochen werden zu eurer Geschichte.' },
  { level: 16, name: 'Erinnerungssammler', threshold: 4700, icon: '🎁', description: 'Ihr habt schon einen Schatz angelegt.' },
  { level: 17, name: 'Wochenchronisten', threshold: 5400, icon: '📝', description: 'Ihr habt einen Sinn für eure Zeit entwickelt.' },
  { level: 18, name: 'Eure Reise wächst', threshold: 6150, icon: '🌈', description: 'Euer Pfad wird klarer.' },
  { level: 19, name: 'Sanfte Beobachter', threshold: 6950, icon: '👁️', description: 'Ihr bemerkt die feinen Veränderungen.' },
  { level: 20, name: 'Achtsame Eltern', threshold: 7800, icon: '🧘', description: 'Eure Aufmerksamkeit ist Lottis Halt.' },
  { level: 21, name: 'Eure Verbundenheit', threshold: 8700, icon: '🪢', description: 'Euer Band wächst tief.' },
  { level: 22, name: 'Lotti-Begleiter', threshold: 9650, icon: '🐾', description: 'Ihr seid Lottis sichere Heimat.' },
  { level: 23, name: 'Eure Schatzkiste', threshold: 10650, icon: '💎', description: 'Erinnerungen, die ihr für immer behaltet.' },
  { level: 24, name: 'Eure Welt entsteht', threshold: 11700, icon: '🌍', description: 'Ihr formt Lottis erste eigene Welt.' },
  { level: 25, name: 'Tag um Tag', threshold: 12800, icon: '☀️', description: 'Eure Beständigkeit ist ein Geschenk.' },
  { level: 26, name: 'Eure stille Stärke', threshold: 13950, icon: '🌟', description: 'Ihr seid stärker, als ihr wisst.' },
  { level: 27, name: 'Vertraute Wärme', threshold: 15150, icon: '🔥', description: 'Euer Zuhause hat einen eigenen Klang.' },
  { level: 28, name: 'Eure Kapitel', threshold: 16400, icon: '📚', description: 'Jede Woche ein neues Kapitel.' },
  { level: 29, name: 'Familien-Chronik', threshold: 17700, icon: '📜', description: 'Eure Familie hat eine Geschichte.' },
  { level: 30, name: 'Eure Erinnerungswelt', threshold: 19050, icon: '🌌', description: 'Eine Welt, die nur euch gehört.' },
] as const;

export type LottiLevelInfo = {
  level: number;
  name: string;
  threshold: number;
  /** null wenn maximale Stufe erreicht */
  nextThreshold: number | null;
  /** null wenn maximale Stufe erreicht */
  nextLevelName: string | null;
  /** Punkte gesammelt seit Beginn der aktuellen Stufe */
  progressInLevel: number;
  /** Spannweite der aktuellen Stufe (next - current). null bei Max-Level. */
  levelSpan: number | null;
  /** Punkte bis zur nächsten Stufe. 0 bei Max-Level. */
  pointsToNext: number;
  isMax: boolean;
  /** 0..1 — Anteil innerhalb der aktuellen Stufe. 1 bei Max-Level. */
  progressFraction: number;
};

export function computeLevelInfo(totalPoints: number): LottiLevelInfo {
  const safe = Math.max(0, Math.floor(totalPoints));
  let current = LOTTI_LEVELS[0];
  let next: LottiLevel | null = null;

  for (let i = 0; i < LOTTI_LEVELS.length; i++) {
    const candidate = LOTTI_LEVELS[i];
    if (safe >= candidate.threshold) {
      current = candidate;
      next = LOTTI_LEVELS[i + 1] ?? null;
    } else {
      break;
    }
  }

  const isMax = next === null;
  const levelSpan = next ? next.threshold - current.threshold : null;
  const progressInLevel = safe - current.threshold;
  const progressFraction = isMax
    ? 1
    : levelSpan && levelSpan > 0
      ? Math.min(1, Math.max(0, progressInLevel / levelSpan))
      : 0;

  return {
    level: current.level,
    name: current.name,
    threshold: current.threshold,
    nextThreshold: next ? next.threshold : null,
    nextLevelName: next ? next.name : null,
    progressInLevel,
    levelSpan,
    pointsToNext: next ? next.threshold - safe : 0,
    isMax,
    progressFraction,
  };
}

/**
 * Lokale YYYY-MM-DD-Schlüssel — für Tagesgruppierung.
 */
export function localDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type RawEntryFlag = {
  start_time: string | null | undefined;
  feeding?: boolean;
  care?: boolean;
  sleep?: boolean;
};

/**
 * Aggregiert eine Liste roher Einträge zu Tageszählern. Mehrere Einträge
 * desselben Bereichs am selben Tag werden gezählt; Caps werden später
 * in `computeDayPoints` angewandt.
 */
export function aggregateEntriesByDay(
  rows: RawEntryFlag[],
): Map<string, DayCounts> {
  const map = new Map<string, DayCounts>();
  for (const row of rows) {
    const key = localDayKey(row.start_time);
    if (!key) continue;
    const cur =
      map.get(key) ?? { feedingCount: 0, careCount: 0, sleepCount: 0 };
    if (row.feeding) cur.feedingCount += 1;
    if (row.care) cur.careCount += 1;
    if (row.sleep) cur.sleepCount += 1;
    map.set(key, cur);
  }
  return map;
}

export function sumDayPointsAcrossMap(
  map: Map<string, DayCounts>,
): number {
  let total = 0;
  for (const counts of map.values()) total += computeDayPoints(counts).total;
  return total;
}
