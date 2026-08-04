import {
  BABY_NAMES_TRANSLATIONS,
  getLocalizedFallbackBabyNames,
  translateBabyNamesText,
} from '../babyNamesTranslations';

describe('baby-name translations', () => {
  it('keeps all locale catalogs in sync', () => {
    const germanKeys = Object.keys(BABY_NAMES_TRANSLATIONS.de).sort();

    expect(Object.keys(BABY_NAMES_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(BABY_NAMES_TRANSLATIONS.es).sort()).toEqual(germanKeys);
  });

  it('translates UI copy and interpolates batch counts', () => {
    expect(translateBabyNamesText('en', 'screen.title')).toBe('Baby names');
    expect(translateBabyNamesText('es', 'admin.added', { count: 25 }))
      .toBe('Se han añadido 25 nombres.');
  });

  it('localizes fallback meanings without changing the name', () => {
    const germanNoah = getLocalizedFallbackBabyNames('de').find((entry) => entry.name === 'Noah');
    const englishNoah = getLocalizedFallbackBabyNames('en').find((entry) => entry.name === 'Noah');
    const spanishNoah = getLocalizedFallbackBabyNames('es').find((entry) => entry.name === 'Noah');

    expect(germanNoah?.meaning).toBe('Ruhe, Trost');
    expect(englishNoah?.meaning).toBe('Rest, comfort');
    expect(spanishNoah?.meaning).toBe('Descanso, consuelo');
  });
});

