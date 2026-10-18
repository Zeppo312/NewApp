// Farbpalette für einzelne Planer-Einträge.
// Ohne eigene Farbe fällt ein Termin auf die Personenfarbe zurück.

export type PlannerColorKey =
  | 'rose'
  | 'coral'
  | 'amber'
  | 'olive'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'berry'
  | 'slate';

export type PlannerColorOption = {
  key: PlannerColorKey;
  /** Basisfarbe für den hellen Modus – zugleich der in der DB gespeicherte Wert. */
  hex: string;
};

export const PLANNER_ITEM_COLORS: readonly PlannerColorOption[] = [
  { key: 'rose', hex: '#D2566E' },
  { key: 'coral', hex: '#D97A2F' },
  { key: 'amber', hex: '#C9911C' },
  { key: 'olive', hex: '#7C9A3C' },
  { key: 'green', hex: '#3F9A6B' },
  { key: 'teal', hex: '#2E8C8A' },
  { key: 'blue', hex: '#3E7BC4' },
  { key: 'indigo', hex: '#6E4DBD' },
  { key: 'berry', hex: '#A4508B' },
  { key: 'slate', hex: '#6E7F92' },
] as const;

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Bringt einen beliebigen Eingabewert auf das gespeicherte Format (#rrggbb) oder null. */
export function normalizePlannerColor(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  return `#${trimmed.slice(1).toLowerCase()}`;
}

/** Vergleicht zwei Farbwerte unabhängig von Groß-/Kleinschreibung. */
export function isSamePlannerColor(a?: string | null, b?: string | null) {
  return normalizePlannerColor(a) === normalizePlannerColor(b);
}

function lighten(hex: string, amount: number) {
  const int = parseInt(hex.replace('#', ''), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const channel = (value: number) =>
    Math.min(255, Math.round(value + (255 - value) * amount)).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Passt eine gespeicherte Farbe an das aktuelle Theme an. */
export function adaptPlannerColor(hex: string, isDark: boolean) {
  return isDark ? lighten(hex, 0.18) : hex;
}
