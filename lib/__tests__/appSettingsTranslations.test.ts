import {
  APP_SETTINGS_TRANSLATIONS,
  getAppSettingsLocaleTag,
  translateAppSettingsText,
} from '../appSettingsTranslations';

describe('app settings translations', () => {
  it('keeps every locale catalog in sync with German', () => {
    const expectedKeys = Object.keys(APP_SETTINGS_TRANSLATIONS.de).sort();

    expect(Object.keys(APP_SETTINGS_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(APP_SETTINGS_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('translates dynamic settings copy in all supported languages', () => {
    expect(translateAppSettingsText('de', 'notifications.activeCategories', { count: 3 }))
      .toBe('3 Kategorien aktiv');
    expect(translateAppSettingsText('en', 'sleep.nightWindowRange', {
      start: '19:00',
      end: '07:00',
    })).toBe('19:00 to 07:00');
    expect(translateAppSettingsText('es', 'background.customPreview', { mode: 'oscura' }))
      .toBe('Imagen propia (oscura)');
  });

  it('provides locale tags for dates and times', () => {
    expect(getAppSettingsLocaleTag('de')).toBe('de-DE');
    expect(getAppSettingsLocaleTag('en')).toBe('en-US');
    expect(getAppSettingsLocaleTag('es')).toBe('es-ES');
  });
});
