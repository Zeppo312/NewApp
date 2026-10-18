import {
  DEFAULT_APP_LOCALE,
  getAppLocaleTag,
  isAppLocale,
  isLanguagePreference,
  resolveAppLocale,
} from '../localization';

describe('localization foundation', () => {
  it('accepts only supported locales and preferences', () => {
    expect(['de', 'en', 'es'].every(isAppLocale)).toBe(true);
    expect(isAppLocale('fr')).toBe(false);
    expect(isLanguagePreference('system')).toBe(true);
    expect(isLanguagePreference('fr')).toBe(false);
  });

  it('resolves explicit and system preferences', () => {
    expect(resolveAppLocale('system', 'es')).toBe('es');
    expect(resolveAppLocale('en', 'de')).toBe('en');
    expect(resolveAppLocale('de', 'es')).toBe(DEFAULT_APP_LOCALE);
  });

  it('provides stable locale tags', () => {
    expect(getAppLocaleTag('de')).toBe('de-DE');
    expect(getAppLocaleTag('en')).toBe('en-US');
    expect(getAppLocaleTag('es')).toBe('es-ES');
  });
});
