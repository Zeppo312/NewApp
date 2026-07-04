/**
 * Formatierung von Mengenangaben für Vorräte: Werte werden intern in der
 * Basiseinheit (g, ml, Stück, …) gespeichert; für die Anzeige rechnen wir
 * ab 1000 g/ml automatisch in kg bzw. l hoch (1200 g -> "1,2 kg").
 */

const LARGE_UNIT_BY_BASE: Record<string, string> = {
  g: 'kg',
  ml: 'l',
};

export const formatNumber = (value: number): string =>
  value.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/** "1200" + "g" -> "1,2 kg"; "540" + "g" -> "540 g"; "5" + "Stück" -> "5 Stück". */
export const formatUnitQuantity = (value: number, unit: string): string => {
  const normalizedUnit = unit.trim().toLowerCase();
  const largeUnit = LARGE_UNIT_BY_BASE[normalizedUnit];
  if (largeUnit && Math.abs(value) >= 1000) {
    return `${formatNumber(value / 1000)} ${largeUnit}`;
  }
  return `${formatNumber(value)} ${unit.trim()}`;
};

/**
 * Zerlegt eine Mengeneingabe wie "1,2 kg" oder "800 g" und normalisiert sie
 * auf die Basiseinheit: kg -> g, l -> ml. Eingaben ohne bekannte Einheit
 * bleiben unverändert (value + eingegebene Einheit).
 */
export const parseUnitQuantity = (
  rawValue: string,
  rawUnit: string
): { value: number; unit: string } | null => {
  const value = parseFloat(rawValue.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const unit = rawUnit.trim();
  const normalized = unit.toLowerCase();
  if (normalized === 'kg') return { value: value * 1000, unit: 'g' };
  if (normalized === 'l') return { value: value * 1000, unit: 'ml' };
  return { value, unit };
};
