import type { TextStyle } from 'react-native';

/**
 * Gemeinsame Textrollen mit Größe, Zeilenhöhe und Gewicht.
 * Ohne fontFamily bleibt die Systemschrift aktiv. Farben werden weiterhin
 * durch ThemedText bzw. die jeweilige Oberfläche bestimmt.
 */
export const TYPOGRAPHY = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  pageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  dialogTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  buttonSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  // Die bisherige Link-Zeilenhöhe bleibt für bestehende Aufrufer erhalten.
  link: { fontSize: 16, lineHeight: 30, fontWeight: '400' },
  timer: { fontSize: 32, lineHeight: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TextRole = keyof typeof TYPOGRAPHY;
