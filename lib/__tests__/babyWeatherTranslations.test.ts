import {
  BABY_WEATHER_TRANSLATIONS,
  formatBabyWeatherMonths,
  getBabyWeatherClothingLabel,
  getBabyWeatherContextLabel,
  getBabyWeatherTipKeys,
  translateBabyWeatherText,
} from '../babyWeatherTranslations';

describe('baby weather translations', () => {
  it('keeps the German, English and Spanish catalogs in sync', () => {
    const germanKeys = Object.keys(BABY_WEATHER_TRANSLATIONS.de).sort();

    expect(Object.keys(BABY_WEATHER_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(BABY_WEATHER_TRANSLATIONS.es).sort()).toEqual(germanKeys);
  });

  it('translates dynamic weather and outfit copy', () => {
    expect(translateBabyWeatherText('en', 'recommendation.today', { band: 'mild', temperature: 21 }))
      .toBe('mild today · 21 °C');
    expect(getBabyWeatherContextLabel('es', 'carrier')).toBe('Portabebés');
    expect(getBabyWeatherClothingLabel('en', 'Langarmbody')).toBe('Long-sleeve bodysuit');
    expect(formatBabyWeatherMonths('de', 1)).toBe('1 Monat');
    expect(formatBabyWeatherMonths('es', 3)).toBe('3 meses');
  });

  it('provides translated tip keys for every temperature band', () => {
    expect(getBabyWeatherTipKeys('hot')).toHaveLength(5);
    expect(getBabyWeatherTipKeys('cold')).toHaveLength(4);
    expect(getBabyWeatherTipKeys('unknown')).toEqual([]);
  });
});
