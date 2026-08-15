import { useWindowDimensions } from 'react-native';

/**
 * Obergrenze, bis zu der feste Layout-Maße mit der Systemschriftgröße mitwachsen.
 * iOS meldet bei den Accessibility-Größen bis zu ~3.1 – so weit mitzuwachsen würde
 * Kacheln unbedienbar hoch machen. 2.2 deckt die großen Größen ab und lässt
 * mehrzeilige Titel vollständig sichtbar werden.
 */
export const MAX_LAYOUT_FONT_SCALE = 2.2;

/**
 * Begrenzt den Systemfaktor nach unten auf 1 (kleinere Schrift soll Layouts
 * nicht schrumpfen lassen) und nach oben auf `max`.
 */
export function clampFontScale(scale: number, max: number = MAX_LAYOUT_FONT_SCALE) {
  if (!Number.isFinite(scale) || scale <= 1) {
    return 1;
  }
  return Math.min(scale, max);
}

/** Aktueller, begrenzter Textskalierungsfaktor des Systems. */
export function useFontScale(max: number = MAX_LAYOUT_FONT_SCALE) {
  const { fontScale } = useWindowDimensions();
  return clampFontScale(fontScale, max);
}

/**
 * Skaliert ein festes Layout-Maß (Höhe, Mindesthöhe, Icon-Container …) mit der
 * Systemschriftgröße mit, damit Text bei großer Schrift nicht abgeschnitten wird.
 */
export function useScaledSize(size: number, max: number = MAX_LAYOUT_FONT_SCALE) {
  const scale = useFontScale(max);
  return Math.round(size * scale);
}

/**
 * Maße für das Schnellzugriff-Raster. Ab ~130 % Systemschrift sind zwei
 * Spalten so schmal, dass Titel mitten im Wort umbrechen — dann wechseln wir
 * auf eine Spalte, die dafür deutlich flacher sein darf.
 *
 * Die Kachelhöhe ist bewusst fix (das Raster ist per Drag sortierbar und
 * rechnet mit Slot-Positionen), wächst aber mit der Schriftgröße mit.
 */
export function useTileGridMetrics() {
  const scale = useFontScale();
  const columns = scale >= 1.3 ? 1 : 2;
  const itemHeight =
    columns === 1 ? Math.round(78 * scale + 52) : Math.round(140 * scale);
  return { columns, itemHeight, scale, isSingleColumn: columns === 1 };
}

/**
 * Zeilenlimit für `numberOfLines`, das bei größerer Systemschrift mitwächst:
 * Bei großer Schrift passt schlicht weniger in eine Zeile — dann lieber
 * umbrechen als abschneiden. Ab ~160 % wird gar nicht mehr gekürzt.
 */
export function useLineLimit(base: number) {
  const scale = useFontScale();
  if (scale >= 1.6) {
    return undefined;
  }
  if (scale >= 1.15) {
    return base + 1;
  }
  return base;
}
