import {
  SUPPORT_TRANSLATIONS,
  translateSupportText,
} from '../supportTranslations';

describe('support translations', () => {
  it('keeps every locale catalog in sync with German', () => {
    const expectedKeys = Object.keys(SUPPORT_TRANSLATIONS.de).sort();

    expect(Object.keys(SUPPORT_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(SUPPORT_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('provides core support copy in all supported languages', () => {
    expect(translateSupportText('de', 'hero.title')).toBe('Wie können wir helfen?');
    expect(translateSupportText('en', 'form.send')).toBe('Open email app');
    expect(translateSupportText('es', 'screen.title')).toBe('Soporte');
  });

  it('interpolates dynamic values', () => {
    expect(translateSupportText('en', 'alert.unavailableMessage', {
      email: 'support@example.com',
    })).toBe('Please email us at support@example.com.');
  });
});
