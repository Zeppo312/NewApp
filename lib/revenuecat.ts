import { Platform } from 'react-native';
import Constants from 'expo-constants';

import Purchases from '@/lib/purchasesClient';

export const REVENUECAT_ENTITLEMENT_KEY = 'LottiBabyAbo';
export const REVENUECAT_OFFERING_ID = 'default';
export const REVENUECAT_PACKAGE_ID = 'src_monthly';

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

export async function purchaseMonthlyPackage(userId: string) {
  if (Platform.OS === 'web') {
    throw new Error('Käufe sind auf Web nicht verfügbar.');
  }

  await initRevenueCat(userId);

  const offerings = await Purchases.getOfferings();
  const offering = offerings?.all?.[REVENUECAT_OFFERING_ID] ?? offerings?.current ?? null;
  const pkg =
    offering?.availablePackages?.find((p: any) => p?.identifier === REVENUECAT_PACKAGE_ID) ?? null;

  if (!pkg) {
    throw new Error(`RevenueCat package "${REVENUECAT_PACKAGE_ID}" im Offering "${REVENUECAT_OFFERING_ID}" nicht gefunden.`);
  }

  const purchaseResult = await Purchases.purchasePackage(pkg as any);
  const customerInfo = purchaseResult?.customerInfo ?? purchaseResult;
  return Boolean(customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_KEY]);
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
