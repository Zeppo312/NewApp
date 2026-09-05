import {
  getOnboardingLocaleTag,
  ONBOARDING_TRANSLATIONS,
  translateOnboardingText,
} from '../onboardingTranslations';

describe('onboarding translations', () => {
  it('keeps all locale catalogs in sync', () => {
    const expectedKeys = Object.keys(ONBOARDING_TRANSLATIONS.de).sort();

    expect(Object.keys(ONBOARDING_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(ONBOARDING_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('translates and interpolates onboarding copy', () => {
    expect(translateOnboardingText('de', 'screen.progress', { current: 2, total: 9 }))
      .toBe('Schritt 2 von 9');
    expect(translateOnboardingText('en', 'invitation.linkedWith', { name: 'Alex' }))
      .toBe('You are now connected with Alex.');
    expect(translateOnboardingText('es', 'background.customPreview', { mode: 'oscura' }))
      .toBe('Imagen propia (oscura)');
  });

  it('provides date locale tags for each language', () => {
    expect(getOnboardingLocaleTag('de')).toBe('de-DE');
    expect(getOnboardingLocaleTag('en')).toBe('en-US');
    expect(getOnboardingLocaleTag('es')).toBe('es-ES');
  });
});
