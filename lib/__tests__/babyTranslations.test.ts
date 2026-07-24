import {
  BABY_TRANSLATIONS,
  formatBabyAge,
  getBabyLocaleTag,
  translateBabyText,
} from '../babyTranslations';

describe('baby profile translations', () => {
  it('keeps all three catalogs in sync', () => {
    const germanKeys = Object.keys(BABY_TRANSLATIONS.de).sort();

    expect(Object.keys(BABY_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(BABY_TRANSLATIONS.es).sort()).toEqual(germanKeys);
  });

  it('translates and interpolates milestone copy', () => {
    expect(translateBabyText('en', 'screen.title')).toBe('My Baby');
    expect(translateBabyText('es', 'screen.title')).toBe('Mi bebé');
    expect(translateBabyText('es', 'milestone.reached', { date: '24/07/2026' }))
      .toBe('Alcanzado el 24/07/2026');
  });

  it('formats ages and locale tags for each supported language', () => {
    const age = { years: 1, months: 2, days: 3 };

    expect(formatBabyAge('de', age)).toBe('1 Jahr, 2 Monate und 3 Tage');
    expect(formatBabyAge('en', age)).toBe('1 year, 2 months, and 3 days');
    expect(formatBabyAge('es', age)).toBe('1 año, 2 meses y 3 días');
    expect(getBabyLocaleTag('es')).toBe('es-ES');
  });
});
