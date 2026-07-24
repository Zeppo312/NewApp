import {
  ACCOUNT_LINKING_TRANSLATIONS,
  getAccountLinkingLocaleTag,
  translateAccountLinkingText,
} from '../accountLinkingTranslations';

describe('account linking translations', () => {
  it('keeps every locale catalog in sync with German', () => {
    const expectedKeys = Object.keys(ACCOUNT_LINKING_TRANSLATIONS.de).sort();

    expect(Object.keys(ACCOUNT_LINKING_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(ACCOUNT_LINKING_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('translates dynamic account-linking copy in all supported languages', () => {
    expect(translateAccountLinkingText('de', 'hero.linkedCount.other', { count: 2 }))
      .toBe('2 Accounts verknüpft');
    expect(translateAccountLinkingText('en', 'redeem.successMessage', { name: 'Sam' }))
      .toBe('The code was redeemed. You are now linked with Sam.');
    expect(translateAccountLinkingText('es', 'pending.code', { code: 'ABCD2345' }))
      .toBe('Código ABCD2345');
  });

  it('provides locale tags for dates', () => {
    expect(getAccountLinkingLocaleTag('de')).toBe('de-DE');
    expect(getAccountLinkingLocaleTag('en')).toBe('en-US');
    expect(getAccountLinkingLocaleTag('es')).toBe('es-ES');
  });
});
