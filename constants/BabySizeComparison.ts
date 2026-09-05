import { babySizeData } from '@/lib/baby-size-data';

// Vergleiche für die Babygröße in den verschiedenen Schwangerschaftswochen
// werden direkt aus den zentralen Babydaten abgeleitet, damit Countdown
// und Babygrößen-Seite dieselben Texte anzeigen.
export const babySizeComparison: Record<number, string> = babySizeData.reduce<Record<number, string>>(
  (acc, { week, fruitComparison }) => {
    acc[week] = fruitComparison;
    return acc;
  },
  {}
);
