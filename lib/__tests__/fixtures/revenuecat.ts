import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import type { RevenueCatPlan } from '../../revenuecatProducts';

// Fields follow installed purchases-typescript-internal 17.41.1 / RN purchases 9.10.5.
export function googlePackage(plan: RevenueCatPlan): PurchasesPackage {
  const period = { iso8601: plan.interval === 'monthly' ? 'P1M' : 'P1Y', unit: plan.interval === 'monthly' ? 'MONTH' : 'YEAR', value: 1 };
  const phase = { billingPeriod: period, recurrenceMode: 1, billingCycleCount: 0,
    price: { amountMicros: 12_490_000, formatted: '$12.49', currencyCode: 'USD' } };
  const base = { id: plan.interval, storeProductId: `${plan.google}:${plan.interval}`, productId: plan.google,
    isBasePlan: true, isPrepaid: false, installmentsInfo: null, pricingPhases: [phase],
    billingPeriod: period, fullPricePhase: phase, freePhase: null, introPhase: null };
  return { identifier: plan.packageId, product: { identifier: base.storeProductId,
    subscriptionPeriod: period.iso8601, price: 0, priceString: 'Free', currencyCode: 'USD',
    defaultOption: { ...base, id: `${plan.interval}:trial`, isBasePlan: false }, subscriptionOptions: [base] } } as unknown as PurchasesPackage;
}

export function applePackage(plan: RevenueCatPlan): PurchasesPackage {
  return { identifier: plan.packageId, product: { identifier: plan.ios,
    subscriptionPeriod: plan.interval === 'monthly' ? 'P1M' : 'P1Y',
    price: 12.49, priceString: '$12.49', currencyCode: 'USD' } } as PurchasesPackage;
}

export function customer(plan?: RevenueCatPlan, store = 'PLAY_STORE', compound = false): CustomerInfo {
  const productId = plan && (store === 'APP_STORE' ? plan.ios : compound ? `${plan.google}:${plan.interval}` : plan.google);
  return { activeSubscriptions: plan ? [productId] : [], entitlements: { active: plan ? {
    LottiBabyAbo: { isActive: true, productIdentifier: productId, productPlanIdentifier: store === 'PLAY_STORE' ? plan.interval : null,
      store, willRenew: false, expirationDate: '2027-01-01T00:00:00Z' },
  } : {} } } as unknown as CustomerInfo;
}
