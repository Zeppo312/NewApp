import {
  SUBSCRIPTION_TRANSLATIONS,
  getSubscriptionAccessRoleLabel,
  translateSubscriptionText,
} from '../subscriptionTranslations';

describe('subscription translations', () => {
  it('keeps every locale catalog in sync with German', () => {
    const expectedKeys = Object.keys(SUBSCRIPTION_TRANSLATIONS.de).sort();

    expect(Object.keys(SUBSCRIPTION_TRANSLATIONS.en).sort()).toEqual(expectedKeys);
    expect(Object.keys(SUBSCRIPTION_TRANSLATIONS.es).sort()).toEqual(expectedKeys);
  });

  it('provides subscription and paywall copy in every supported language', () => {
    expect(translateSubscriptionText('de', 'plans.button.active')).toBe(
      'Alle Abos ansehen',
    );
    expect(translateSubscriptionText('en', 'plans.button.active')).toBe(
      'View all plans',
    );
    expect(translateSubscriptionText('es', 'plans.button.active')).toBe(
      'Ver todos los planes',
    );
  });

  it('interpolates dynamic values and localizes access roles', () => {
    expect(
      translateSubscriptionText('en', 'plan.withTier', {
        tier: 'Premium',
        interval: 'Annual plan',
      }),
    ).toBe('Premium · Annual plan');
    expect(getSubscriptionAccessRoleLabel('es', 'cooperation_partner')).toBe(
      'Colaborador',
    );
  });
});
