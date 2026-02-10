import type { BabyCareEntry } from '@/lib/supabase';

export interface FeedingPredictionInput {
  babyBirthDate: string | Date;
  recentFeedings: BabyCareEntry[];
  now?: Date;
}

export interface FeedingPrediction {
  nextFeedingTime: Date;
  intervalMinutes: number;
  isPersonalized: boolean;
  confidence: number;
}

/**
 * Altersabhängige Standard-Fütterungsintervalle in Minuten
 */
function getDefaultIntervalMinutes(ageMonths: number): number {
  if (ageMonths < 3) return 150;   // 2.5h
  if (ageMonths < 6) return 210;   // 3.5h
  if (ageMonths < 12) return 270;  // 4.5h
  return 300;                       // 5h
}

/**
 * Berechnet das Alter des Babys in Monaten
 */
function getAgeMonths(birthDate: Date, now: Date): number {
  const years = now.getFullYear() - birthDate.getFullYear();
  const months = now.getMonth() - birthDate.getMonth();
  const days = now.getDate() - birthDate.getDate();
  return years * 12 + months + (days < 0 ? -1 : 0);
}

/**
 * Berechnet das Durchschnittsintervall zwischen Fütterungen.
 * Nachtpausen >8h werden gefiltert.
 */
function calculateAverageInterval(feedings: BabyCareEntry[]): number | null {
  if (feedings.length < 2) return null;

  // Sortiere chronologisch (älteste zuerst)
  const sorted = [...feedings].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].start_time).getTime();
    const curr = new Date(sorted[i].start_time).getTime();
    const diffMinutes = (curr - prev) / (1000 * 60);

    // Nachtpausen >8h ignorieren
    if (diffMinutes <= 480) {
      intervals.push(diffMinutes);
    }
  }

  if (intervals.length === 0) return null;
  return intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
}

/**
 * Prüft ob ein Zeitpunkt in der Nacht liegt (22:00-06:00)
 */
function isNightTime(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

/**
 * Verschiebt einen Zeitpunkt auf 06:00 des nächsten Morgens,
 * wenn er in der Nacht liegt
 */
function skipNightTime(date: Date): Date {
  if (!isNightTime(date)) return date;

  const result = new Date(date);
  if (result.getHours() >= 22) {
    // Verschiebe auf nächsten Tag 06:00
    result.setDate(result.getDate() + 1);
  }
  result.setHours(6, 0, 0, 0);
  return result;
}

/**
 * Berechnet den voraussichtlichen nächsten Fütterungszeitpunkt
 */
export function predictNextFeedingTime(
  input: FeedingPredictionInput
): FeedingPrediction | null {
  const now = input.now ?? new Date();
  const birthDate = input.babyBirthDate instanceof Date
    ? input.babyBirthDate
    : new Date(input.babyBirthDate);

  if (isNaN(birthDate.getTime())) return null;

  const ageMonths = getAgeMonths(birthDate, now);
  const defaultInterval = getDefaultIntervalMinutes(ageMonths);

  // Nur Feeding-Einträge verwenden
  const feedings = input.recentFeedings.filter(e => e.entry_type === 'feeding');

  if (feedings.length === 0) return null;

  // Letztes Feeding finden
  const lastFeeding = feedings.reduce((latest, entry) => {
    const t = new Date(entry.start_time).getTime();
    return t > new Date(latest.start_time).getTime() ? entry : latest;
  }, feedings[0]);

  const lastFeedingTime = new Date(lastFeeding.start_time);

  // Personalisiertes Intervall berechnen
  const personalInterval = feedings.length >= 5
    ? calculateAverageInterval(feedings)
    : null;

  let intervalMinutes: number;
  let isPersonalized: boolean;
  let confidence: number;

  if (personalInterval !== null) {
    // 70% persönlich / 30% Altersdefault
    intervalMinutes = personalInterval * 0.7 + defaultInterval * 0.3;
    isPersonalized = true;
    confidence = Math.min(0.9, 0.5 + feedings.length * 0.03);
  } else {
    intervalMinutes = defaultInterval;
    isPersonalized = false;
    confidence = 0.4;
  }

  // Nächsten Fütterungszeitpunkt berechnen
  let nextFeedingTime = new Date(lastFeedingTime.getTime() + intervalMinutes * 60 * 1000);

  // Nachtfilter: Bei Babys >=6 Monate keine Notifications zwischen 22-06 Uhr
  if (ageMonths >= 6 && isNightTime(nextFeedingTime)) {
    nextFeedingTime = skipNightTime(nextFeedingTime);
  }

  // Wenn der berechnete Zeitpunkt in der Vergangenheit liegt, nicht vorhersagen
  if (nextFeedingTime <= now) return null;

  return {
    nextFeedingTime,
    intervalMinutes: Math.round(intervalMinutes),
    isPersonalized,
    confidence,
  };
}
