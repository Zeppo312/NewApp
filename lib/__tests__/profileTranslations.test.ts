import {
  PROFILE_TRANSLATIONS,
  translateProfileText,
} from '../profileTranslations';

describe('profile translations', () => {
  it('keeps every locale catalog in sync with German', () => {
    const expectedKeys = Object.keys(PROFILE_TRANSLATIONS.de).sort();

    expect(Object.keys(PROFILE_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(PROFILE_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('interpolates dynamic profile copy in all supported languages', () => {
    expect(translateProfileText('de', 'email.pending', { email: 'neu@example.de' }))
      .toBe('Neue E-Mail ausstehend: neu@example.de (bitte bestätigen)');
    expect(translateProfileText('en', 'email.pending', { email: 'new@example.com' }))
      .toBe('New email pending: new@example.com (please confirm)');
    expect(translateProfileText('es', 'email.pending', { email: 'nuevo@example.es' }))
      .toBe('Nuevo correo pendiente: nuevo@example.es (confírmalo)');
  });
});
