import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PaywallPlansExperience, type PaywallPlanPrices } from '../../components/paywall/PaywallPlansExperience';

jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de', localeTag: 'de-DE' }) }));
jest.mock('@/contexts/SubscriptionAccessContext', () => ({ useSubscriptionAccess: () => ({ policy: jest.requireActual('../subscriptionFeaturePolicy').DEFAULT_SUBSCRIPTION_FEATURE_POLICY }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const unavailable = { amount: 0, label: 'Preis derzeit nicht verfügbar', verified: false };
const price = { amount: 120, label: '$120.00', currencyCode: 'USD', verified: true };
const initialPrices: PaywallPlanPrices = { liteMonthly: unavailable, liteYearly: unavailable, standardMonthly: unavailable, standardYearly: unavailable, premiumMonthly: price, premiumYearly: price };

describe('paywall purchase availability and currency', () => {
  let tree: ReactTestRenderer;
  afterEach(() => act(() => tree?.unmount()));
  const mount = async (prices = initialPrices) => {
    await act(async () => { tree = create(<PaywallPlansExperience prices={prices} storeProvider="Google Play" billingLabel="Abrechnung über Google Play" isTrialExpired showAppleEula={false} />); });
  };
  const cta = () => tree.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityState?.disabled !== undefined)[0]!;
  const restore = () => tree.root.findAll((node) => node.props.hitSlop === 8 && node.props.disabled !== undefined)[0]!;
  it('disables the selected missing product while leaving restore enabled', async () => {
    await mount();
    expect(cta().props.disabled).toBe(true);
    expect(restore().props.disabled).toBe(false);
    const premium = tree.root.findAll((node) => node.props.accessibilityRole === 'radio' && node.props.accessibilityState?.selected === false)[0];
    act(() => premium.props.onPress());
    expect(cta().props.disabled).toBe(false);
  });
  it('formats yearly monthly equivalents in the actual store currency', async () => {
    await mount({ ...initialPrices, liteYearly: price });
    expect(JSON.stringify(tree.toJSON())).toContain('10,00');
    expect(JSON.stringify(tree.toJSON())).toContain('$');
    expect(JSON.stringify(tree.toJSON())).not.toContain('€');
    expect(cta().props.disabled).toBe(false);
  });
  it('does not make unverified preview prices purchasable', async () => {
    await mount({ ...initialPrices, liteYearly: { amount: 44.99, label: '44,99 €' } });
    expect(cta().props.disabled).toBe(true);
  });
});
