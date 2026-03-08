import { Platform } from 'react-native';
import Constants from 'expo-constants';

import Purchases from '@/lib/purchasesClient';

export const REVENUECAT_ENTITLEMENT_KEY = 'LottiBabyAbo';
export const REVENUECAT_OFFERING_ID = 'default';
export const REVENUECAT_MONTHLY_PRODUCT_ID = 'lottibaby_monthly';
export const REVENUECAT_YEARLY_PRODUCT_ID = 'lottibaby_yearly';

export type RevenueCatProductId =
  | typeof REVENUECAT_MONTHLY_PRODUCT_ID
  | typeof REVENUECAT_YEARLY_PRODUCT_ID;

export type RevenueCatPlanType = 'monthly' | 'yearly' | 'unknown';

export type RevenueCatSubscriptionSummary = {
  isActive: boolean;
  productId: string | null;
  planType: RevenueCatPlanType | null;
  willRenew: boolean | null;
  expiresDate: string | null;
};

let configuredForUserId: string | null = null;

const isExpoGo = () => Constants.appOwnership === 'expo';

const getRevenueCatApiKey = () => {
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_RC_IOS_KEY ?? null;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? null;
  return null;
};

export async function initRevenueCat(userId: string) {
  if (Platform.OS === 'web') return;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error(
      'RevenueCat API Key fehlt. Setze EXPO_PUBLIC_RC_IOS_KEY (iOS) und/oder EXPO_PUBLIC_RC_ANDROID_KEY (Android).',
    );
  }

  if (isExpoGo() && !apiKey.startsWith('test_')) {
    throw new Error(
      'In Expo Go (Preview API Mode) sind echte Käufe nicht verfügbar. Verwende den RevenueCat Test Store Key (beginnt mit "test_") für EXPO_PUBLIC_RC_IOS_KEY oder nutze eine Development Build/TestFlight für echte Käufe.',
    );
  }

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

const getPlanTypeFromProductId = (productId: string | null): RevenueCatPlanType | null => {
  if (!productId) return null;
  if (productId === REVENUECAT_MONTHLY_PRODUCT_ID) return 'monthly';
  if (productId === REVENUECAT_YEARLY_PRODUCT_ID) return 'yearly';
  return 'unknown';
};

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
    return Boolean(customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_KEY]);
  } catch (err) {
    console.warn('RevenueCat entitlement check failed', err);
    return false;
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
      willRenew: null,
      expiresDate: null,
    };
  }

  try {
    await initRevenueCat(userId);
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_KEY] ?? null;
    const productId =
      entitlement?.productIdentifier ??
      customerInfo?.activeSubscriptions?.[0] ??
      null;

    return {
      isActive: Boolean(entitlement),
      productId,
      planType: getPlanTypeFromProductId(productId),
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
  return Boolean(customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_KEY]);
}

export async function purchaseMonthlyPackage(userId: string) {
  return purchaseRevenueCatProduct(userId, REVENUECAT_MONTHLY_PRODUCT_ID);
}

export async function purchaseYearlyPackage(userId: string) {
  return purchaseRevenueCatProduct(userId, REVENUECAT_YEARLY_PRODUCT_ID);
}

export async function restoreRevenueCatPurchases(userId: string) {
  if (Platform.OS === 'web') return false;

  try {
    await initRevenueCat(userId);
    const customerInfo = await Purchases.restorePurchases();
    return Boolean(customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_KEY]);
  } catch (err) {
    console.warn('RevenueCat restorePurchases failed', err);
    return false;
  }
}
