import type { PurchasesPackage, SubscriptionOption } from 'react-native-purchases';
import type { RevenueCatPlanKey, SubscriptionInterval, SubscriptionTier } from './revenuecat';

// Contract from docs/android-play/product-map.md. Google IDs are provisioned in step 10.
export const REVENUECAT_PLANS = [
  { key: 'liteMonthly', tier: 'lite', interval: 'monthly', ios: 'lottibaby_lite_monthly', google: 'lottibaby_lite', packageId: 'lite_monthly' },
  { key: 'liteYearly', tier: 'lite', interval: 'yearly', ios: 'lottibaby_lite_yearly', google: 'lottibaby_lite', packageId: 'lite_yearly' },
  { key: 'standardMonthly', tier: 'standard', interval: 'monthly', ios: 'lottibaby_monthly', google: 'lottibaby_standard', packageId: '$rc_monthly' },
  { key: 'standardYearly', tier: 'standard', interval: 'yearly', ios: 'lottibaby_yearly', google: 'lottibaby_standard', packageId: '$rc_annual' },
  { key: 'premiumMonthly', tier: 'premium', interval: 'monthly', ios: 'lottibaby_premium_monthly', google: 'lottibaby_premium', packageId: 'premium_monthly' },
  { key: 'premiumYearly', tier: 'premium', interval: 'yearly', ios: 'lottibaby_premium_yearly', google: 'lottibaby_premium', packageId: 'premium_yearly' },
] as const satisfies readonly { key: RevenueCatPlanKey; tier: SubscriptionTier; interval: SubscriptionInterval; ios: string; google: string; packageId: string }[];

export type RevenueCatPlan = typeof REVENUECAT_PLANS[number];
export type StorePlanPrice = { price: number; priceString: string; currencyCode: string };

export function resolveSubscriptionProduct(productId: string | null, basePlan?: string | null) {
  return REVENUECAT_PLANS.find((plan) =>
    productId === plan.ios ||
    ((productId === `${plan.google}:${plan.interval}` ||
      (productId === plan.google && basePlan === plan.interval)) &&
      (!basePlan || basePlan === plan.interval)),
  ) ?? null;
}

export function resolveSubscriptionTier(productId: string | null): SubscriptionTier | null {
  return resolveSubscriptionProduct(productId)?.tier ??
    REVENUECAT_PLANS.find((plan) => plan.google === productId)?.tier ?? null;
}

const validPrice = (price: StorePlanPrice) =>
  Number.isFinite(price.price) && price.price > 0 &&
  typeof price.priceString === 'string' && price.priceString.trim().length > 0 &&
  typeof price.currencyCode === 'string' && /^[A-Z]{3}$/.test(price.currencyCode);

export function resolvePurchasablePlan(packages: PurchasesPackage[], plan: RevenueCatPlan, platform: string) {
  const period = plan.interval === 'monthly' ? 'P1M' : 'P1Y';
  const candidates = packages.flatMap((pkg) => {
    const product = pkg.product;
    if (!product) return [];
    if (platform === 'ios') {
      if (product.identifier !== plan.ios || product.subscriptionPeriod !== period) return [];
      const pricing = { price: product.price, priceString: product.priceString, currencyCode: product.currencyCode };
      return validPrice(pricing) ? [{ pkg, option: null as SubscriptionOption | null, pricing }] : [];
    }
    if (platform !== 'android' || pkg.identifier !== plan.packageId) return [];
    const storeProductId = `${plan.google}:${plan.interval}`;
    if (product.identifier !== storeProductId && product.identifier !== plan.google) return [];
    if (product.subscriptionPeriod !== period) return [];
    // purchasePackage chooses defaultOption, which may be a trial/discount. Buy the
    // verified base option explicitly until offers have a confirmed product decision.
    const options = (product.subscriptionOptions ?? []).filter((option) =>
      option.isBasePlan && option.id === plan.interval && option.productId === plan.google &&
      option.storeProductId === storeProductId && option.isPrepaid === false && !option.installmentsInfo &&
      option.billingPeriod?.iso8601 === period && option.fullPricePhase?.billingPeriod?.iso8601 === period &&
      option.fullPricePhase.recurrenceMode === 1 && option.pricingPhases?.length === 1 &&
      !option.freePhase && !option.introPhase,
    );
    if (options.length !== 1) return [];
    const option = options[0];
    const price = option.fullPricePhase?.price;
    if (!price) return [];
    const pricing = { price: price.amountMicros / 1_000_000, priceString: price.formatted, currencyCode: price.currencyCode };
    return validPrice(pricing) ? [{ pkg, option, pricing }] : [];
  });
  // Ambiguous bindings are configuration errors, never first-match purchases.
  return candidates.length === 1 ? candidates[0] : null;
}
