import {
  getPregnancySetupLocaleTag,
  PREGNANCY_SETUP_TRANSLATIONS,
  translatePregnancySetupText,
} from '../pregnancySetupTranslations';

describe('pregnancy setup translations', () => {
  it('keeps all locale catalogs in sync', () => {
    const expectedKeys = Object.keys(PREGNANCY_SETUP_TRANSLATIONS.de).sort();

    expect(Object.keys(PREGNANCY_SETUP_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(PREGNANCY_SETUP_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('contains complete setup copy in all supported languages', () => {
    expect(translatePregnancySetupText('de', 'screen.title')).toBe('Schwangerschaft anlegen');
    expect(translatePregnancySetupText('en', 'dueDate.pickerTitle')).toBe('Choose due date');
    expect(translatePregnancySetupText('es', 'submit.saving')).toBe('Configurando...');
  });

  it('provides date locale tags for each language', () => {
    expect(getPregnancySetupLocaleTag('de')).toBe('de-DE');
    expect(getPregnancySetupLocaleTag('en')).toBe('en-US');
    expect(getPregnancySetupLocaleTag('es')).toBe('es-ES');
  });
});
