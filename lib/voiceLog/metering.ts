// Pegel-Umrechnung für Waveform und Orb — bewusst ohne UI-Abhängigkeiten,
// damit sie testbar bleibt.

/**
 * dBFS (≈ -160 … 0, expo-audio Metering) → 0 … 1. Sprache liegt meist
 * zwischen -40 und -10 dB; darunter wird der Pegel als Stille behandelt.
 */
export const meteringToLevel = (metering: number | undefined | null): number => {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) return 0;
  const level = (metering + 48) / 42;
  return Math.max(0, Math.min(1, level));
};
