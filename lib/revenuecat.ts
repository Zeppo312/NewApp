import { Platform } from 'react-native';
import Constants from 'expo-constants';

import Purchases from '@/lib/purchasesClient';

export const REVENUECAT_ENTITLEMENT_KEY = 'LottiBabyAbo';
export const REVENUECAT_LITE_ENTITLEMENT_KEY = 'LottiBabyLite';
export const REVENUECAT_OFFERING_ID = 'default';
export const REVENUECAT_MONTHLY_PRODUCT_ID = 'lottibaby_monthly';
export const REVENUECAT_YEARLY_PRODUCT_ID = 'lottibaby_yearly';
export const REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID = 'lottibaby_premium_monthly';
export const REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID = 'lottibaby_premium_yearly';
export const REVENUECAT_STANDARD_MONTHLY_PRODUCT_ID = 'lottibaby_standard_monthly';
export const REVENUECAT_STANDARD_YEARLY_PRODUCT_ID = 'lottibaby_standard_yearly';
export const REVENUECAT_LITE_MONTHLY_PRODUCT_ID = 'lottibaby_lite_monthly';
export const REVENUECAT_LITE_YEARLY_PRODUCT_ID = 'lottibaby_lite_yearly';

export type RevenueCatProductId =
  | typeof REVENUECAT_MONTHLY_PRODUCT_ID
  | typeof REVENUECAT_YEARLY_PRODUCT_ID
  | typeof REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID
  | typeof REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID
  | typeof REVENUECAT_STANDARD_MONTHLY_PRODUCT_ID
  | typeof REVENUECAT_STANDARD_YEARLY_PRODUCT_ID
  | typeof REVENUECAT_LITE_MONTHLY_PRODUCT_ID
  | typeof REVENUECAT_LITE_YEARLY_PRODUCT_ID;

export type RevenueCatPlanType = 'monthly' | 'yearly' | 'unknown';

export type SubscriptionTier = 'premium' | 'standard' | 'lite';
export type SubscriptionInterval = 'monthly' | 'yearly';

export type RevenueCatPlanKey =
  | 'premiumMonthly'
  | 'premiumYearly'
  | 'standardMonthly'
  | 'standardYearly'
  | 'liteMonthly'
  | 'liteYearly';

export type RevenueCatPlanPricing = Partial<
  Record<RevenueCatPlanKey, { price: number; priceString: string }>
>;

export type RevenueCatSubscriptionSummary = {
  isActive: boolean;
  productId: string | null;
  planType: RevenueCatPlanType | null;
  tier: SubscriptionTier | null;
  willRenew: boolean | null;
  expiresDate: string | null;
};

let configuredForUserId: string | null = null;

const isExpoGo = () => Constants.appOwnership === 'expo';

const getRevenueCatApiKey = () => {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_RC_IOS_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? null;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? null;
  }

  return null;
};

let didWarnTestKey = false;

export const getRevenueCatConfigurationIssue = () => {
  if (Platform.OS === 'web') return null;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return 'RevenueCat API Key fehlt. Setze EXPO_PUBLIC_RC_IOS_KEY/EXPO_PUBLIC_REVENUECAT_IOS_API_KEY (iOS) und/oder EXPO_PUBLIC_RC_ANDROID_KEY/EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (Android).';
  }

  if (Platform.OS === 'ios') {
    if (isExpoGo() && !apiKey.startsWith('test_')) {
      return 'In Expo Go (Preview API Mode) sind echte Käufe nicht verfügbar. Verwende den RevenueCat Test Store Key (beginnt mit "test_") für EXPO_PUBLIC_RC_IOS_KEY oder nutze eine Development Build/TestFlight für echte Käufe.';
    }

    if (!isExpoGo() && apiKey.startsWith('test_')) {
      if (__DEV__) {
        if (!didWarnTestKey) {
          didWarnTestKey = true;
          console.warn(
            '[RevenueCat] Test-Key erkannt in Development Build. Käufe sind deaktiviert. Für echte Käufe EXPO_PUBLIC_RC_IOS_KEY auf einen appl_-Key setzen.',
          );
        }
        return null;
      }
      return 'RevenueCat ist für diesen iOS-Build falsch konfiguriert. In TestFlight und App Store muss EXPO_PUBLIC_RC_IOS_KEY mit "appl_" beginnen.';
    }
  }

  return null;
};

export async function initRevenueCat(userId: string) {
  if (Platform.OS === 'web') return;

  const apiKey = getRevenueCatApiKey();
  const configurationIssue = getRevenueCatConfigurationIssue();
  if (configurationIssue) throw new Error(configurationIssue);
  if (!apiKey) throw new Error('RevenueCat API Key fehlt.');

  if (configuredForUserId === userId) return;

  await Purchases.configure({
    apiKey,
    appUserID: userId,
  });

  configuredForUserId = userId;
}

const getCurrentOffering = async () => {
  const offerings = await Purchases.getOfferings();
  return offerings?.all?.[REVENUECAT_OFFERING_ID] ?? offerings?.current ?? null;
};

const getPackageProductId = (pkg: any): string | null => {
  return pkg?.product?.identifier ?? pkg?.product?.productIdentifier ?? null;
};

const MONTHLY_PRODUCT_IDS: string[] = [
  REVENUECAT_MONTHLY_PRODUCT_ID,
  REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID,
  REVENUECAT_STANDARD_MONTHLY_PRODUCT_ID,
  REVENUECAT_LITE_MONTHLY_PRODUCT_ID,
];

const YEARLY_PRODUCT_IDS: string[] = [
  REVENUECAT_YEARLY_PRODUCT_ID,
  REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID,
  REVENUECAT_STANDARD_YEARLY_PRODUCT_ID,
  REVENUECAT_LITE_YEARLY_PRODUCT_ID,
];

const LITE_PRODUCT_IDS: string[] = [
  REVENUECAT_LITE_MONTHLY_PRODUCT_ID,
  REVENUECAT_LITE_YEARLY_PRODUCT_ID,
];

const PREMIUM_PRODUCT_IDS: string[] = [
  REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID,
  REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID,
];

const STANDARD_PRODUCT_IDS: string[] = [
  REVENUECAT_MONTHLY_PRODUCT_ID,
  REVENUECAT_YEARLY_PRODUCT_ID,
  REVENUECAT_STANDARD_MONTHLY_PRODUCT_ID,
  REVENUECAT_STANDARD_YEARLY_PRODUCT_ID,
];

const getPlanTypeFromProductId = (productId: string | null): RevenueCatPlanType | null => {
  if (!productId) return null;
  if (MONTHLY_PRODUCT_IDS.includes(productId)) return 'monthly';
  if (YEARLY_PRODUCT_IDS.includes(productId)) return 'yearly';
  return 'unknown';
};

export const getTierFromProductId = (
  productId: string | null,
): SubscriptionTier | null => {
  if (!productId) return null;
  if (LITE_PRODUCT_IDS.includes(productId)) return 'lite';
  if (PREMIUM_PRODUCT_IDS.includes(productId)) return 'premium';
  if (STANDARD_PRODUCT_IDS.includes(productId)) return 'standard';
  return null;
};

// Vorläufige Produkt-IDs. Sobald die finalen RevenueCat-Keys vorliegen, werden
// nur diese Konstanten angepasst. Legacy-Produkte bleiben Standard-Fallbacks.
const getProductIdCandidates = (
  tier: SubscriptionTier,
  interval: SubscriptionInterval,
): RevenueCatProductId[] => {
  if (tier === 'lite') {
    return interval === 'yearly'
      ? [REVENUECAT_LITE_YEARLY_PRODUCT_ID]
      : [REVENUECAT_LITE_MONTHLY_PRODUCT_ID];
  }

  if (tier === 'standard') {
    return interval === 'yearly'
      ? [REVENUECAT_STANDARD_YEARLY_PRODUCT_ID, REVENUECAT_YEARLY_PRODUCT_ID]
      : [REVENUECAT_STANDARD_MONTHLY_PRODUCT_ID, REVENUECAT_MONTHLY_PRODUCT_ID];
  }

  return interval === 'yearly'
    ? [REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID]
    : [REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID];
};

const getActiveEntitlement = (customerInfo: any) => {
  const active = customerInfo?.entitlements?.active ?? {};
  return active[REVENUECAT_ENTITLEMENT_KEY] ?? active[REVENUECAT_LITE_ENTITLEMENT_KEY] ?? null;
};

const hasAnyActiveEntitlement = (customerInfo: any) =>
  Boolean(getActiveEntitlement(customerInfo));

export const findRevenueCatPackageByProductId = (packages: any[], productId: RevenueCatProductId) => {
  return packages.find((pkg: any) => getPackageProductId(pkg) === productId) ?? null;
};

export async function getRevenueCatPackages(userId: string) {
  if (Platform.OS === 'web') return [];

  await initRevenueCat(userId);

  const offering = await getCurrentOffering();
  return offering?.availablePackages ?? [];
}

export async function hasRevenueCatEntitlement(userId: string) {
  if (Platform.OS === 'web') return false;

  try {
    await initRevenueCat(userId);
    const customerInfo = await Purchases.getCustomerInfo();
    return hasAnyActiveEntitlement(customerInfo);
  } catch (err) {
    console.warn('RevenueCat entitlement check failed', err);
    return false;
  }
}

export async function getActiveSubscriptionTier(
  userId: string,
): Promise<SubscriptionTier | null> {
  if (Platform.OS === 'web') return null;

  try {
    await initRevenueCat(userId);
    const customerInfo = await Purchases.getCustomerInfo();
    const active = customerInfo?.entitlements?.active ?? {};
    if (active[REVENUECAT_ENTITLEMENT_KEY]) {
      const entitlement = active[REVENUECAT_ENTITLEMENT_KEY];
      return getTierFromProductId(entitlement?.productIdentifier) ?? 'standard';
    }
    if (active[REVENUECAT_LITE_ENTITLEMENT_KEY]) return 'lite';
    return null;
  } catch (err) {
    console.warn('RevenueCat tier check failed', err);
    return null;
  }
}

export async function getRevenueCatSubscriptionSummary(
  userId: string,
): Promise<RevenueCatSubscriptionSummary> {
  if (Platform.OS === 'web') {
    return {
      isActive: false,
      productId: null,
      planType: null,
      tier: null,
      willRenew: null,
      expiresDate: null,
    };
  }

  try {
    await initRevenueCat(userId);
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = getActiveEntitlement(customerInfo);
    const productId =
      entitlement?.productIdentifier ??
      customerInfo?.activeSubscriptions?.[0] ??
      null;

    return {
      isActive: Boolean(entitlement),
      productId,
      planType: getPlanTypeFromProductId(productId),
      tier: getTierFromProductId(productId),
      willRenew:
        typeof entitlement?.willRenew === 'boolean'
          ? entitlement.willRenew
          : null,
      expiresDate:
        typeof entitlement?.expirationDate === 'string'
          ? entitlement.expirationDate
          : null,
    };
  } catch (err) {
    console.warn('RevenueCat subscription summary failed', err);
    return {
      isActive: false,
      productId: null,
      planType: null,
      tier: null,
      willRenew: null,
      expiresDate: null,
    };
  }
}

export async function purchaseRevenueCatProduct(userId: string, productId: RevenueCatProductId) {
  if (Platform.OS === 'web') {
    throw new Error('Käufe sind auf Web nicht verfügbar.');
  }

  const packages = await getRevenueCatPackages(userId);
  const pkg = findRevenueCatPackageByProductId(packages, productId);

  if (!pkg) {
    throw new Error(`RevenueCat product "${productId}" im Offering "${REVENUECAT_OFFERING_ID}" nicht gefunden.`);
  }

  const purchaseResult = await Purchases.purchasePackage(pkg as any);
  const customerInfo = purchaseResult?.customerInfo ?? purchaseResult;
  return hasAnyActiveEntitlement(customerInfo);
}

export async function purchaseSubscriptionPlan(
  userId: string,
  tier: SubscriptionTier,
  interval: SubscriptionInterval,
) {
  if (Platform.OS === 'web') {
    throw new Error('Käufe sind auf Web nicht verfügbar.');
  }

  const packages = await getRevenueCatPackages(userId);
  const candidates = getProductIdCandidates(tier, interval);

  for (const productId of candidates) {
    const pkg = findRevenueCatPackageByProductId(packages, productId);
    if (!pkg) continue;

    const purchaseResult = await Purchases.purchasePackage(pkg as any);
    const customerInfo = purchaseResult?.customerInfo ?? purchaseResult;
    return hasAnyActiveEntitlement(customerInfo);
  }

  throw new Error(
    `Kein passendes Produkt (${candidates.join(', ')}) im Offering "${REVENUECAT_OFFERING_ID}" gefunden.`,
  );
}

export async function getRevenueCatPlanPricing(
  userId: string,
): Promise<RevenueCatPlanPricing> {
  if (Platform.OS === 'web') return {};

  try {
    const packages = await getRevenueCatPackages(userId);
    const pricing: RevenueCatPlanPricing = {};

    const assign = (
      key: RevenueCatPlanKey,
      tier: SubscriptionTier,
      interval: SubscriptionInterval,
    ) => {
      for (const productId of getProductIdCandidates(tier, interval)) {
        const pkg = findRevenueCatPackageByProductId(packages, productId);
        const price = pkg?.product?.price;
        const priceString = pkg?.product?.priceString;
        if (typeof price === 'number' && typeof priceString === 'string') {
          pricing[key] = { price, priceString };
          return;
        }
      }
    };

    assign('premiumMonthly', 'premium', 'monthly');
    assign('premiumYearly', 'premium', 'yearly');
    assign('standardMonthly', 'standard', 'monthly');
    assign('standardYearly', 'standard', 'yearly');
    assign('liteMonthly', 'lite', 'monthly');
    assign('liteYearly', 'lite', 'yearly');

    return pricing;
  } catch (err) {
    console.warn('RevenueCat plan pricing lookup failed', err);
    return {};
  }
}

export async function purchaseMonthlyPackage(userId: string) {
  return purchaseSubscriptionPlan(userId, 'premium', 'monthly');
}

export async function purchaseYearlyPackage(userId: string) {
  return purchaseSubscriptionPlan(userId, 'premium', 'yearly');
}

export async function restoreRevenueCatPurchases(userId: string) {
  if (Platform.OS === 'web') return false;

  try {
    await initRevenueCat(userId);
    const customerInfo = await Purchases.restorePurchases();
    return hasAnyActiveEntitlement(customerInfo);
  } catch (err) {
    console.warn('RevenueCat restorePurchases failed', err);
    return false;
  }
}
