import { REVENUECAT_PLANS, resolvePurchasablePlan, resolveSubscriptionProduct, resolveSubscriptionTier } from '../revenuecatProducts';
import { applePackage, googlePackage } from './fixtures/revenuecat';

describe.each(REVENUECAT_PLANS)('$key product contract', (plan) => {
  it('resolves Google entitlement base-plan fields and combined IDs independently of the device', () => {
    expect(resolveSubscriptionProduct(plan.google, plan.interval)).toEqual(plan);
    expect(resolveSubscriptionProduct(`${plan.google}:${plan.interval}`)).toEqual(plan);
    expect(resolveSubscriptionProduct(plan.ios)).toEqual(plan);
    expect(resolveSubscriptionTier(plan.google)).toBe(plan.tier);
    expect(resolveSubscriptionProduct(plan.google)).toBeNull();
    expect(resolveSubscriptionProduct(`${plan.google}:${plan.interval}`, 'weekly')).toBeNull();
  });
  it('prices the explicit recurring Google base plan, not the automatic trial option', () => {
    const pkg = googlePackage(plan);
    const result = resolvePurchasablePlan([pkg], plan, 'android');
    expect(result?.option).toBe(pkg.product.subscriptionOptions![0]);
    expect(result?.pricing).toEqual({ price: 12.49, priceString: '$12.49', currencyCode: 'USD' });
    expect(resolvePurchasablePlan([applePackage(plan)], plan, 'android')).toBeNull();
  });
  it('retains the exact Apple product and price, rejecting Android products on iOS', () => {
    const pkg = applePackage(plan);
    expect(resolvePurchasablePlan([pkg], plan, 'ios')).toMatchObject({ pkg, option: null, pricing: { price: 12.49 } });
    expect(resolvePurchasablePlan([googlePackage(plan)], plan, 'ios')).toBeNull();
  });
});

const plan = REVENUECAT_PLANS[0];
it.each([
  ['wrong package', (pkg: any) => { pkg.identifier = '$rc_monthly'; }],
  ['wrong product', (pkg: any) => { pkg.product.identifier = 'lottibaby_premium:monthly'; }],
  ['wrong period', (pkg: any) => { pkg.product.subscriptionPeriod = 'P1W'; }],
  ['missing options', (pkg: any) => { pkg.product.subscriptionOptions = null; }],
  ['offer only', (pkg: any) => { pkg.product.subscriptionOptions[0].isBasePlan = false; }],
  ['wrong base plan', (pkg: any) => { pkg.product.subscriptionOptions[0].id = 'yearly'; }],
  ['wrong option product', (pkg: any) => { pkg.product.subscriptionOptions[0].productId = 'lottibaby_premium'; }],
  ['wrong option store product', (pkg: any) => { pkg.product.subscriptionOptions[0].storeProductId = 'lottibaby_lite:yearly'; }],
  ['wrong phase period', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase.billingPeriod.iso8601 = 'P1W'; }],
  ['prepaid', (pkg: any) => { pkg.product.subscriptionOptions[0].isPrepaid = true; }],
  ['installments', (pkg: any) => { pkg.product.subscriptionOptions[0].installmentsInfo = { commitmentPaymentsCount: 12 }; }],
  ['non recurring', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase.recurrenceMode = 3; }],
  ['missing price phase', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase = null; }],
  ['unpriced', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase.price.amountMicros = NaN; }],
  ['negative price', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase.price.amountMicros = -1; }],
  ['free price', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase.price.amountMicros = 0; }],
  ['missing formatted price', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase.price.formatted = ''; }],
  ['missing currency', (pkg: any) => { pkg.product.subscriptionOptions[0].fullPricePhase.price.currencyCode = ''; }],
  ['ambiguous options', (pkg: any) => { pkg.product.subscriptionOptions.push(pkg.product.subscriptionOptions[0]); }],
])('rejects %s', (_name, mutate) => {
  const pkg = googlePackage(plan);
  mutate(pkg);
  expect(resolvePurchasablePlan([pkg], plan, 'android')).toBeNull();
});
it('rejects ambiguous packages and unknown identifiers', () => {
  const pkg = googlePackage(plan);
  expect(resolvePurchasablePlan([pkg, pkg], plan, 'android')).toBeNull();
  expect(resolveSubscriptionTier('lottibaby_premium:weekly')).toBeNull();
  expect(resolveSubscriptionTier('lottibaby_standard_monthly')).toBeNull();
});
