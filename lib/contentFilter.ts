/**
 * Clientseitiger Filter für anstößige Inhalte (App Store Guideline 1.2).
 *
 * Der Filter läuft vor jedem Absenden von Posts, Kommentaren und Nachrichten.
 * Serverseitig greift zusätzlich `moderation_banned_terms` mit denselben
 * Begriffen – der Client ist nur die schnelle, erklärende erste Instanz.
 */

export type FilterSeverity = 'block' | 'warn';

export type ContentFilterResult =
  | { ok: true }
  | { ok: false; severity: FilterSeverity; matchedTerm: string };

type BannedTerm = {
  term: string;
  severity: FilterSeverity;
};

/**
 * Harte Treffer werden abgewiesen, weiche Treffer landen zusätzlich in der
 * Moderations-Queue. Bewusst auf eindeutige Beschimpfungen und Slurs begrenzt,
 * damit normale Elterngespräche (Geburt, Stillen, Körper) nicht blockiert werden.
 */
const BANNED_TERMS: BannedTerm[] = [
  // Deutsch
  { term: 'hurensohn', severity: 'block' },
  { term: 'fotze', severity: 'block' },
  { term: 'missgeburt', severity: 'block' },
  { term: 'untermensch', severity: 'block' },
  { term: 'judensau', severity: 'block' },
  { term: 'kanake', severity: 'block' },
  { term: 'neger', severity: 'block' },
  { term: 'schwuchtel', severity: 'block' },
  { term: 'bring dich um', severity: 'block' },
  { term: 'vergewaltigen', severity: 'warn' },
  { term: 'halt die fresse', severity: 'warn' },
  { term: 'wichser', severity: 'warn' },
  { term: 'arschloch', severity: 'warn' },
  { term: 'hure', severity: 'warn' },
  // Englisch
  { term: 'nigger', severity: 'block' },
  { term: 'faggot', severity: 'block' },
  { term: 'retard', severity: 'block' },
  { term: 'cunt', severity: 'block' },
  { term: 'kill yourself', severity: 'block' },
  { term: 'rape', severity: 'warn' },
  { term: 'whore', severity: 'warn' },
  { term: 'bitch', severity: 'warn' },
  { term: 'motherfucker', severity: 'warn' },
  // Spanisch
  { term: 'puta madre', severity: 'block' },
  { term: 'hijo de puta', severity: 'block' },
  { term: 'maricon', severity: 'block' },
  { term: 'violar', severity: 'warn' },
  { term: 'puta', severity: 'warn' },
];

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  $: 's',
  '@': 'a',
  '!': 'i',
};

/**
 * Vereinheitlicht Groß-/Kleinschreibung, Umlaute, Akzente und Leetspeak,
 * damit "H_u_r3nsohn" genauso erkannt wird wie "Hurensohn".
 */
export const normalizeForFilter = (input: string): string => {
  const lowered = (input || '').toLowerCase();

  const withoutAccents = lowered
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');

  return withoutAccents.replace(/[0134567$@!]/g, (character) => LEET_MAP[character] ?? character);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Erkennt auch auseinandergezogene Schreibweisen ("h u r e n s o h n").
 * Nur für längere Begriffe, damit kurze Wörter keine Fehlalarme auslösen.
 */
const buildSpacedPattern = (term: string): RegExp =>
  new RegExp(
    term
      .split('')
      .map((character) => escapeRegExp(character))
      .join('[^a-z]{0,2}'),
  );

const matchesTerm = (normalizedText: string, term: string): boolean => {
  const wordBoundary = new RegExp(`(^|[^a-z])${escapeRegExp(term)}([^a-z]|$)`);
  if (wordBoundary.test(normalizedText)) return true;

  if (term.length >= 5 && buildSpacedPattern(term).test(normalizedText)) return true;

  return false;
};

/**
 * Prüft einen Text auf verbotene Begriffe.
 * `block` verhindert das Absenden, `warn` erzeugt serverseitig eine Meldung.
 */
export const checkContent = (text: string | null | undefined): ContentFilterResult => {
  if (!text || !text.trim()) return { ok: true };

  const normalized = normalizeForFilter(text);

  // Harte Treffer haben Vorrang, damit die Meldung an den Nutzer eindeutig ist.
  for (const severity of ['block', 'warn'] as const) {
    for (const banned of BANNED_TERMS) {
      if (banned.severity !== severity) continue;
      if (matchesTerm(normalized, banned.term)) {
        return { ok: false, severity, matchedTerm: banned.term };
      }
    }
  }

  return { ok: true };
};

/**
 * Bequemer Wrapper: nur harte Treffer blockieren das Absenden.
 */
export const isContentBlocked = (text: string | null | undefined): boolean => {
  const result = checkContent(text);
  return !result.ok && result.severity === 'block';
};

/**
 * Fehlercode, den die Datenlayer-Funktionen zurückgeben, wenn der Filter
 * greift. Die UI übersetzt ihn in eine erklärende Meldung.
 */
export const CONTENT_BLOCKED_ERROR = 'content_blocked';

export const buildContentBlockedError = (): Error => new Error(CONTENT_BLOCKED_ERROR);

/**
 * Erkennt sowohl den clientseitigen Fehlercode als auch die Ablehnung durch
 * den serverseitigen Trigger (`moderation_filter`).
 */
export const isContentBlockedError = (error: unknown): boolean => {
  if (!error) return false;

  const message = typeof error === 'string' ? error : (error as any)?.message;
  const hint = (error as any)?.hint;

  return (
    message === CONTENT_BLOCKED_ERROR ||
    hint === 'moderation_filter' ||
    (typeof message === 'string' && message.includes('content rejected by moderation filter'))
  );
};
