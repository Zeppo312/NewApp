import { Dimensions, PixelRatio } from 'react-native';

import { clampFontScale, maxFontScaleFor } from '@/lib/fontScaling';
import { getDeviceAppLocale, type AppLocale } from '@/lib/localization';

/**
 * Silbentrennung für große Systemschrift.
 *
 * Bei vergrößerter Schrift passen lange Wörter („Benachrichtigungen“,
 * „Wochenzusammenfassung“) oft nicht mehr in eine Zeile. iOS bricht sie dann
 * an beliebiger Stelle ohne Trennstrich um. Mit weichen Trennstellen (U+00AD)
 * trennt das System stattdessen nach Silben und zeigt einen Strich.
 *
 * Weiche Trennstellen nutzt das System aber auch dann, wenn das Wort in die
 * nächste Zeile gepasst hätte. Deshalb bekommen nur Wörter Trennstellen, die
 * bei der tatsächlichen Schriftgröße voraussichtlich breiter sind als eine
 * schmale Zeile (Karte mit Icon). Bei normaler Schriftgröße bleibt jeder Text
 * unverändert, und die Trennmuster werden gar nicht erst geladen.
 *
 * Der react-native-Patch (Libraries/Text/Text.js) ruft hyphenateTextChildren
 * für jeden Text-Inhalt mit dessen Schriftgröße auf.
 */

/** Darunter passen lange Wörter auch in enge Layouts. */
const MIN_FONT_SCALE = 1.15;
/** Schriftgröße für Text ohne eigene Angabe (erbt vom Elterntext). */
const FALLBACK_FONT_SIZE = 16;
/** Durchschnittliche Zeichenbreite der Systemschrift (fett) relativ zur Größe. */
const AVERAGE_CHAR_WIDTH = 0.58;
/** Anteil der Bildschirmbreite, den eine schmale Textzeile typischerweise hat. */
const NARROW_LINE_RATIO = 0.7;
const LONG_WORDS = /[A-Za-zÀ-ÖØ-öø-ÿß]{8,}/g;
const MAX_CACHE_ENTRIES = 2000;

type Hyphenate = (text: string, options?: { minWordLength?: number }) => string;

let currentLocale: AppLocale | null = null;
const hyphenators: Partial<Record<AppLocale, Hyphenate>> = {};
const cache = new Map<string, string>();

function loadHyphenator(locale: AppLocale): Hyphenate {
  // Inline-require: Die Muster (DE ~400 KB) werden erst bei großer Schrift geladen.
  switch (locale) {
    case 'en':
      return require('hyphen/en-us').hyphenateSync;
    case 'es':
      return require('hyphen/es').hyphenateSync;
    default:
      return require('hyphen/de').hyphenateSync;
  }
}

/** Wird vom LocaleProvider gesetzt, damit nach den Regeln der App-Sprache getrennt wird. */
export function setHyphenationLocale(locale: AppLocale) {
  if (locale !== currentLocale) {
    currentLocale = locale;
    cache.clear();
  }
}

/** Ab wie vielen Buchstaben ein Wort bei dieser Schriftgröße nicht mehr in eine schmale Zeile passt. */
export function maxUnbrokenWordLength(fontSize: number, fontScale: number, screenWidth: number) {
  const renderedSize = fontSize * clampFontScale(fontScale, maxFontScaleFor(fontSize));
  return Math.floor((screenWidth * NARROW_LINE_RATIO) / (renderedSize * AVERAGE_CHAR_WIDTH));
}

export function hyphenateLongWords(text: string, maxWordLength: number): string {
  LONG_WORDS.lastIndex = 0;
  if (!LONG_WORDS.test(text)) {
    return text;
  }
  const key = `${maxWordLength}|${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const locale = currentLocale ?? getDeviceAppLocale();
  const hyphenate = (hyphenators[locale] ??= loadHyphenator(locale));
  const result = text.replace(LONG_WORDS, (word) =>
    word.length > maxWordLength ? hyphenate(word, { minWordLength: maxWordLength + 1 }) : word,
  );
  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.clear();
  }
  cache.set(key, result);
  return result;
}

/** Gibt `children` unverändert zurück, solange nichts zu trennen ist. */
export function hyphenateTextChildren(children: unknown, fontSize?: unknown): unknown {
  const fontScale = PixelRatio.getFontScale();
  if (fontScale < MIN_FONT_SCALE) {
    return children;
  }
  const maxWordLength = maxUnbrokenWordLength(
    typeof fontSize === 'number' ? fontSize : FALLBACK_FONT_SIZE,
    fontScale,
    Dimensions.get('window').width,
  );
  if (typeof children === 'string') {
    return hyphenateLongWords(children, maxWordLength);
  }
  if (Array.isArray(children)) {
    let changed = false;
    const next = children.map((child) => {
      if (typeof child !== 'string') return child;
      const hyphenated = hyphenateLongWords(child, maxWordLength);
      if (hyphenated !== child) changed = true;
      return hyphenated;
    });
    return changed ? next : children;
  }
  return children;
}

/** Hängt die Silbentrennung in den gepatchten <Text> von React Native ein. */
export function installTextHyphenation() {
  (globalThis as { __LOTTI_TEXT_CHILDREN_TRANSFORM__?: unknown }).__LOTTI_TEXT_CHILDREN_TRANSFORM__ =
    hyphenateTextChildren;
}
