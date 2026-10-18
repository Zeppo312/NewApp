/**
 * Bestimmt das zu speichernde Ende eines Sprach-Eintrags.
 * Nur ein ausdrücklich angeforderter Timer bleibt offen (`null`). Ohne Timer
 * wird ein fehlendes oder ungültiges Ende auf den Startzeitpunkt gesetzt.
 */
export const resolveVoiceLogEnd = (
  start: Date,
  parsedEnd: Date | null,
  timerRequested: boolean,
): Date | null => {
  if (timerRequested) return null;
  if (parsedEnd && parsedEnd.getTime() > start.getTime()) return parsedEnd;
  return start;
};
