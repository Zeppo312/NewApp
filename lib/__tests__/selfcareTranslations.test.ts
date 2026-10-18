import {
  SELFCARE_ACTIVITIES,
  SELFCARE_EXERCISES,
  SELFCARE_TIP_KEYS,
  SELFCARE_TRANSLATIONS,
  getSelfcareLocaleTag,
  translateSelfcareText,
} from '../selfcareTranslations';

describe('self-care translations', () => {
  it('keeps the German, English and Spanish catalogs in sync', () => {
    const germanKeys = Object.keys(SELFCARE_TRANSLATIONS.de).sort();

    expect(Object.keys(SELFCARE_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(SELFCARE_TRANSLATIONS.es).sort()).toEqual(germanKeys);
  });

  it('interpolates personalized and progress copy', () => {
    expect(translateSelfcareText('en', 'hero.greetingName', { name: 'Mia' }))
      .toBe('How are you, Mia?');
    expect(translateSelfcareText('es', 'checklist.progress', { completed: 3, total: 8 }))
      .toBe('3/8 completados');
  });

  it('provides all translated content collections and locale tags', () => {
    expect(SELFCARE_TIP_KEYS).toHaveLength(10);
    expect(SELFCARE_EXERCISES).toHaveLength(4);
    expect(SELFCARE_ACTIVITIES).toHaveLength(8);
    expect(getSelfcareLocaleTag('de')).toBe('de-DE');
    expect(getSelfcareLocaleTag('en')).toBe('en-US');
    expect(getSelfcareLocaleTag('es')).toBe('es-ES');
  });
});
