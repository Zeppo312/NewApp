import { Dimensions, PixelRatio } from 'react-native';

import { maxFontScaleFor } from '@/lib/fontScaling';
import {
  hyphenateLongWords,
  hyphenateTextChildren,
  maxUnbrokenWordLength,
  setHyphenationLocale,
} from '@/lib/hyphenation';

// Muss zum react-native-Patch passen (patches/react-native+*.patch).
const defaultMaxFontSizeMultiplier =
  require('react-native/Libraries/Text/defaultMaxFontSizeMultiplier').default as (
    fontSize: unknown,
  ) => number;

const SOFT_HYPHEN = '­';

describe('maxFontScaleFor', () => {
  it('lässt Fließtext auf 200 % wachsen', () => {
    expect(maxFontScaleFor(12)).toBe(2);
    expect(maxFontScaleFor(16)).toBe(2);
  });

  it('lässt große Überschriften weniger stark wachsen', () => {
    expect(maxFontScaleFor(22)).toBeLessThan(maxFontScaleFor(18));
    expect(32 * maxFontScaleFor(32)).toBeCloseTo(41.6, 0);
    expect(maxFontScaleFor(200)).toBe(1.1);
  });

  it('bleibt monoton: größere Schrift wird nie kleiner dargestellt', () => {
    for (let size = 10; size < 60; size += 1) {
      expect((size + 1) * maxFontScaleFor(size + 1)).toBeGreaterThanOrEqual(size * maxFontScaleFor(size));
    }
  });

  it('stimmt mit dem Standardwert im react-native-Patch überein', () => {
    for (const size of [undefined, 12, 16, 18, 22, 28, 32, 48, 80]) {
      expect(defaultMaxFontSizeMultiplier(size)).toBe(maxFontScaleFor(size ?? 16));
    }
  });
});

describe('Silbentrennung', () => {
  beforeEach(() => setHyphenationLocale('de'));
  afterEach(() => jest.restoreAllMocks());

  it('trennt nur Wörter, die breiter als eine schmale Zeile werden', () => {
    const result = hyphenateLongWords('Alle Benachrichtigungen', 12);
    expect(result.startsWith('Alle ')).toBe(true);
    expect(result.replaceAll(SOFT_HYPHEN, '-')).toBe('Alle Be-nach-rich-ti-gun-gen');
    expect(hyphenateLongWords('Lottis Wochenmoment', 13)).toBe('Lottis Wochenmoment');
  });

  it('lässt Text bei normaler Schriftgröße unverändert', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    const children = ['Benachrichtigungen', 3];
    expect(hyphenateTextChildren('Benachrichtigungen', 16)).toBe('Benachrichtigungen');
    expect(hyphenateTextChildren(children, 16)).toBe(children);
  });

  it('trennt bei großer Schrift auch in verschachteltem Inhalt', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2.14);
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 402, height: 874, scale: 3, fontScale: 2.14 });
    const result = hyphenateTextChildren(['Wochenzusammenfassung', 4], 20) as unknown[];
    expect(result[0]).toContain(SOFT_HYPHEN);
    expect(result[1]).toBe(4);
  });

  it('schätzt die Wortlänge aus der tatsächlich dargestellten Schriftgröße', () => {
    expect(maxUnbrokenWordLength(16, 2.14, 402)).toBe(15);
    expect(maxUnbrokenWordLength(16, 1.2, 402)).toBeGreaterThan(20);
  });
});
