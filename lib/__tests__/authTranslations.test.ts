import {
  AUTH_TRANSLATIONS,
  getAuthLocaleTag,
  translateAuthText,
} from '../authTranslations';

describe('authentication translations', () => {
  it('keeps all locale catalogs in sync', () => {
    const expectedKeys = Object.keys(AUTH_TRANSLATIONS.de).sort();

    expect(Object.keys(AUTH_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(AUTH_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('translates dynamic authentication copy', () => {
    expect(translateAuthText('de', 'otp.enterCompleteCode', { length: 6 }))
      .toBe('Bitte gib einen 6-stelligen Code ein.');
    expect(translateAuthText('en', 'otp.resendCountdown', { seconds: 42 }))
      .toBe('Resend code (42s)');
    expect(translateAuthText('es', 'invite.preparing'))
      .toBe('Preparando invitación...');
  });

  it('provides locale tags for links and platform controls', () => {
    expect(getAuthLocaleTag('de')).toBe('de-DE');
    expect(getAuthLocaleTag('en')).toBe('en-US');
    expect(getAuthLocaleTag('es')).toBe('es-ES');
  });

  it('provides a fail-closed consent error in every locale', () => {
    (['de', 'en', 'es'] as const).forEach((locale) => {
      expect(translateAuthText(locale, 'login.termsSaveFailed')).not.toBe(
        'login.termsSaveFailed',
      );
      expect(translateAuthText(locale, 'otp.termsSaveFailed')).not.toBe(
        'otp.termsSaveFailed',
      );
    });
  });
});
