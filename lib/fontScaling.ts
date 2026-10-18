import { useWindowDimensions } from 'react-native';

/**
 * Obergrenze, bis zu der feste Layout-Maße mit der Systemschriftgröße mitwachsen.
 * Entspricht der maximalen Skalierung von Fließtext (siehe maxFontScaleFor):
 * Weiter wächst Text nicht, also müssen auch Layouts nicht weiter wachsen.
 */
export const MAX_LAYOUT_FONT_SCALE = 2;

/**
 * Höchster Skalierungsfaktor, den eine Schrift dieser Größe erreicht.
 * Spiegelt den react-native-Patch (Libraries/Text/defaultMaxFontSizeMultiplier.js),
 * der für jeden Text ohne eigenes `maxFontSizeMultiplier` greift: bis 16 pt
 * 200 %, jeder Punkt darüber wächst nur zu 60 % mit – wie Dynamic Type auf iOS.
 */
export function maxFontScaleFor(fontSize: number) {
  if (!(fontSize > 16)) {
    return 2;
  }
  const maxRendered = 32 + (fontSize - 16) * 0.6;
  return Math.max(1.1, Math.round((maxRendered / fontSize) * 100) / 100);
}

/** Tatsächlich gerenderte Schriftgröße bei aktueller Systemschrift. */
export function useScaledFontSize(fontSize: number) {
  const { fontScale } = useWindowDimensions();
  return Math.round(fontSize * clampFontScale(fontScale, maxFontScaleFor(fontSize)));
}

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
    columns === 1 ? Math.round(92 * scale + 56) : Math.round(140 * scale);
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
