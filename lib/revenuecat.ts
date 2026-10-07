import { checkFamilyPurchaseAccess, clearFamilyAccess } from './familySubscriptionAccess';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Sentry from '@sentry/react-native';

import Purchases from '@/lib/purchasesClient';
import { REVENUECAT_PLANS, resolvePurchasablePlan, resolveSubscriptionProduct, resolveSubscriptionTier, type StorePlanPrice } from './revenuecatProducts';

export const REVENUECAT_ENTITLEMENT_KEY = 'LottiBabyAbo';
export const REVENUECAT_LITE_ENTITLEMENT_KEY = 'LottiBabyLite';
export const REVENUECAT_PREMIUM_ENTITLEMENT_KEY = 'LottiBabyPremium';
export const REVENUECAT_OFFERING_ID = 'default';
export const REVENUECAT_MONTHLY_PRODUCT_ID = 'lottibaby_monthly';
export const REVENUECAT_YEARLY_PRODUCT_ID = 'lottibaby_yearly';
export const REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID = 'lottibaby_premium_monthly';
export const REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID = 'lottibaby_premium_yearly';
export const REVENUECAT_LITE_MONTHLY_PRODUCT_ID = 'lottibaby_lite_monthly';
export const REVENUECAT_LITE_YEARLY_PRODUCT_ID = 'lottibaby_lite_yearly';

export type RevenueCatProductId =
  | typeof REVENUECAT_MONTHLY_PRODUCT_ID
  | typeof REVENUECAT_YEARLY_PRODUCT_ID
  | typeof REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID
  | typeof REVENUECAT_PREMIUM_YEARLY_PRODUCT_ID
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
  Record<RevenueCatPlanKey, StorePlanPrice>
>;

export type RevenueCatSubscriptionSummary = {
  isActive: boolean;
  availability: 'available' | 'unavailable';
  productId: string | null;
  store: string | null;
  basePlanId: string | null;
  planType: RevenueCatPlanType | null;
  tier: SubscriptionTier | null;
  willRenew: boolean | null;
  expiresDate: string | null;
};

export type RevenueCatEntitlementStatus =
  | { status: 'active'; customerInfo: any }
  | { status: 'inactive'; customerInfo: any }
  | { status: 'unavailable'; error: unknown };

let initializationQueue: Promise<void> = Promise.resolve();
let lastInitializedUserId: string | null = null;

const isExpoGo = () => Constants.appOwnership === 'expo';

const getRevenueCatApiKey = () => {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_RC_IOS_KEY?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || null;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_RC_ANDROID_KEY?.trim() || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || null;
  }

  return null;
};


export const getRevenueCatConfigurationIssue = () => {
  if (Platform.OS === 'web') return null;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return Platform.OS === 'android'
      ? 'RevenueCat API Key für Android fehlt. Setze EXPO_PUBLIC_RC_ANDROID_KEY oder EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY in .env.local bzw. der EAS-Umgebung und starte Metro neu.'
      : 'RevenueCat API Key für iOS fehlt. Setze EXPO_PUBLIC_RC_IOS_KEY oder EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in .env.local bzw. der EAS-Umgebung und starte Metro neu.';
  }

  if (isExpoGo()) return 'Store-Käufe benötigen einen Development- oder Store-Build.';
  const prefix = Platform.OS === 'android' ? 'goog_' : 'appl_';
  if (!apiKey.startsWith(prefix)) {
    return `RevenueCat ist für diesen Build falsch konfiguriert. Der Store-Schlüssel muss mit "${prefix}" beginnen.`;
  }

  return null;
};

class RevenueCatConfigurationError extends Error {}

const loggedConfigurationIssues = new Set<string>();
const warnRevenueCatFailure = (message: string, error: unknown) => {
  // Missing local configuration is actionable in the paywall, but repeated
  // background checks must not keep opening LogBox during development.
  if (__DEV__ && error instanceof RevenueCatConfigurationError) {
    if (!loggedConfigurationIssues.has(error.message)) {
      loggedConfigurationIssues.add(error.message);
      console.info('[RevenueCat]', error.message);
    }
    return;
  }
  console.warn(message, error);
};

const getErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code)
    : null;
};

const reportRevenueCatFailure = async (
  operation: string,
  userId: string,
  error: unknown,
) => {
  if (__DEV__ && error instanceof RevenueCatConfigurationError) return;
  let userHash: string | null = null;
  try {
    userHash = (
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        userId,
      )
    ).slice(0, 12);
  } catch {
    // Diagnose darf niemals die eigentliche Abo-Prüfung beeinflussen.
  }

  const normalizedError = error instanceof Error
    ? error
    : new Error(`RevenueCat ${operation} failed`);
  const errorCode = getErrorCode(error);

  try {
    Sentry.withScope((scope) => {
      scope.setTag('component', 'revenuecat');
      scope.setTag('operation', operation);
      if (errorCode) scope.setTag('revenuecat.error_code', errorCode);
      scope.setContext('revenuecat', {
        userHash,
        errorCode,
        message: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(normalizedError);
    });
  } catch {
    // Auch ein Telemetriefehler darf den fail-open-Pfad nicht verhindern.
  }
};

const synchronizeRevenueCatUser = async (userId: string, apiKey: string) => {
  const isConfigured = await Purchases.isConfigured();
  if (!isConfigured) {
    // configure() liefert im React-Native-SDK void. isConfigured() ist der
    // belastbare, native Abschluss-Check und verhindert Mehrfachkonfiguration.
    Purchases.configure({
      apiKey,
      appUserID: userId,
    });

    const didConfigure = await Purchases.isConfigured();
    if (!didConfigure) {
      throw new Error('RevenueCat konnte nicht initialisiert werden.');
    }
  } else {
    const currentUserId = await Purchases.getAppUserID();
    if (currentUserId !== userId) {
      lastInitializedUserId = null;
      await Purchases.logIn(userId);
    }
  }

  lastInitializedUserId = userId;
};

// Serialize the entire SDK operation, not just logIn: the SDK has one global identity.
let sessionUserId: string | null | undefined;
let sessionRevision = 0;
const assertSession = (userId: string, revision = sessionRevision) => {
  if (!userId.trim() || revision !== sessionRevision ||
      (sessionUserId !== undefined && sessionUserId !== userId)) {
    throw new Error('Das angemeldete Konto hat sich geändert. Bitte erneut versuchen.');
  }
};

function withRevenueCatUser<T>(userId: string, action: () => Promise<T>): Promise<T> {
  const revision = sessionRevision;
  const operation = initializationQueue.then(async () => {
    assertSession(userId, revision);
    const issue = getRevenueCatConfigurationIssue();
    const apiKey = getRevenueCatApiKey();
    if (issue || !apiKey) throw new RevenueCatConfigurationError(issue ?? 'RevenueCat API Key fehlt.');
    await synchronizeRevenueCatUser(userId, apiKey);
    assertSession(userId, revision);
    const result = await action();
    assertSession(userId, revision);
    return result;
  });
  initializationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

// Called synchronously by AuthContext, so stale screens/listeners are blocked
// even while a previous purchase or native logout is still finishing.
export function setRevenueCatSessionUser(userId: string | null) {
  if (sessionUserId === userId) return;
  clearFamilyAccess();
  sessionUserId = userId;
  sessionRevision += 1;
  lastInitializedUserId = null;
  if (userId !== null || Platform.OS === 'web') return;
  const logout = initializationQueue.then(async () => {
    if (await Purchases.isConfigured() && !(await Purchases.isAnonymous())) {
      await Purchases.logOut();
      lastInitializedUserId = null;
    }
  });
  initializationQueue = logout.catch((error) => {
    warnRevenueCatFailure('RevenueCat logout failed', error);
  });
}

export async function initRevenueCat(userId: string) {
  if (Platform.OS === 'web') return;
  return withRevenueCatUser(userId, async () => undefined);
}

const getCurrentOffering = async () => {
  const offerings = await Purchases.getOfferings();
  return offerings?.all?.[REVENUECAT_OFFERING_ID] ?? null;
};

const getPlanTypeFromProductId = (productId: string | null, basePlan?: string | null): RevenueCatPlanType | null =>
  productId ? resolveSubscriptionProduct(productId, basePlan)?.interval ?? 'unknown' : null;

export const getTierFromProductId = resolveSubscriptionTier;

const getEntitlementTier = (entitlement: any, key: string): SubscriptionTier | null =>
  getTierFromProductId(entitlement?.productIdentifier) ??
  (key === REVENUECAT_PREMIUM_ENTITLEMENT_KEY ? 'premium' :
    key === REVENUECAT_LITE_ENTITLEMENT_KEY ? 'lite' : null);

const getActiveEntitlement = (customerInfo: any) => {
  const active = customerInfo?.entitlements?.active ?? {};
  const rank = { premium: 3, standard: 2, lite: 1 };
  const entitlements = [REVENUECAT_PREMIUM_ENTITLEMENT_KEY, REVENUECAT_ENTITLEMENT_KEY, REVENUECAT_LITE_ENTITLEMENT_KEY]
    .filter((key) => active[key] && active[key].isActive !== false)
    .map((key) => ({ ...active[key], resolvedTier: getEntitlementTier(active[key], key) }));
  if (!entitlements.length) return null;

  // One legacy entitlement can represent several active products. RevenueCat
  // may select longer-running Lite even when shorter family-shared Premium is
  // active. Rank the SDK's verified subscriptions too, keeping each product's
  // own expiry and renewal metadata rather than borrowing the Lite period.
  const subscriptions = Object.values(customerInfo?.subscriptionsByProductIdentifier ?? {})
    .filter((subscription: any) => subscription?.isActive === true && !subscription.refundedAt)
    .flatMap((subscription: any) => {
      const productId = subscription.productIdentifier;
      const plan = resolveSubscriptionProduct(productId);
      if (!plan || !(
        (subscription.store === 'APP_STORE' && productId === plan.ios) ||
        (subscription.store === 'PLAY_STORE' && productId === `${plan.google}:${plan.interval}`)
      )) return [];
      return [{
        ...subscription,
        resolvedTier: plan.tier,
        productPlanIdentifier: subscription.store === 'PLAY_STORE' ? plan.interval : null,
        expirationDate: subscription.gracePeriodExpiresDate ?? subscription.expiresDate,
      }];
    });
  return [...entitlements, ...subscriptions]
    .sort((a, b) => (rank[b.resolvedTier as SubscriptionTier] ?? 0) - (rank[a.resolvedTier as SubscriptionTier] ?? 0))[0] ?? null;
};

const hasAnyActiveEntitlement = (customerInfo: any) =>
  Boolean(getActiveEntitlement(customerInfo));

export async function getRevenueCatPackages(userId: string) {
  if (Platform.OS === 'web') return [];

  return withRevenueCatUser(userId, async () => {
    const offering = await getCurrentOffering();
    return offering?.availablePackages ?? [];
  });
}

export async function hasRevenueCatEntitlement(userId: string) {
  if (Platform.OS === 'web') return false;

  const result = await getRevenueCatEntitlementStatus(userId);
  if (result.status === 'unavailable') {
    throw result.error instanceof Error
      ? result.error
      : new Error('RevenueCat-Abo-Status ist derzeit nicht verfügbar.');
  }
  return result.status === 'active';
}

export async function getRevenueCatEntitlementStatus(
  userId: string,
): Promise<RevenueCatEntitlementStatus> {
  if (Platform.OS === 'web') {
    return { status: 'inactive', customerInfo: { entitlements: { active: {} } } };
  }

  try {
    const customerInfo = await withRevenueCatUser(userId, () => Purchases.getCustomerInfo());
    return hasAnyActiveEntitlement(customerInfo)
      ? { status: 'active', customerInfo }
      : { status: 'inactive', customerInfo };
  } catch (error) {
    warnRevenueCatFailure('RevenueCat entitlement check unavailable', error);
    await reportRevenueCatFailure('entitlement_check', userId, error);
    return { status: 'unavailable', error };
  }
}

export async function getActiveSubscriptionTier(
  userId: string,
): Promise<SubscriptionTier | null> {
  if (Platform.OS === 'web') return null;

  try {
    const customerInfo = await withRevenueCatUser(userId, () => Purchases.getCustomerInfo());
    return getActiveEntitlement(customerInfo)?.resolvedTier ?? null;
  } catch (err) {
    warnRevenueCatFailure('RevenueCat tier check failed', err);
    return null;
  }
}

export async function getRevenueCatSubscriptionSummary(
  userId: string,
): Promise<RevenueCatSubscriptionSummary> {
  if (Platform.OS === 'web') {
    return {
      isActive: false,
      availability: 'available',
      productId: null,
      store: null,
      basePlanId: null,
      planType: null,
      tier: null,
      willRenew: null,
      expiresDate: null,
    };
  }

  try {
    const status = await getRevenueCatEntitlementStatus(userId);
    if (status.status === 'unavailable') {
      return {
        isActive: false,
        availability: 'unavailable',
        productId: null,
        store: null,
        basePlanId: null,
        planType: null,
        tier: null,
        willRenew: null,
        expiresDate: null,
      };
    }
    const customerInfo = status.customerInfo;
    const entitlement = getActiveEntitlement(customerInfo);
    const productId =
      entitlement?.productIdentifier ??
      customerInfo?.activeSubscriptions?.[0] ??
      null;

    return {
      isActive: Boolean(entitlement),
      availability: 'available',
      productId,
      store: entitlement?.store ?? null,
      basePlanId: entitlement?.store === 'PLAY_STORE' ? entitlement?.productPlanIdentifier ?? resolveSubscriptionProduct(productId)?.interval ?? null : null,
      planType: getPlanTypeFromProductId(productId, entitlement?.productPlanIdentifier),
      tier: entitlement?.resolvedTier ?? null,
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
    warnRevenueCatFailure('RevenueCat subscription summary failed', err);
    await reportRevenueCatFailure('subscription_summary', userId, err);
    return {
      isActive: false,
      availability: 'unavailable',
      productId: null,
      store: null,
      basePlanId: null,
      planType: null,
      tier: null,
      willRenew: null,
      expiresDate: null,
    };
  }
}

export class RevenueCatPurchaseBlockedError extends Error {
  constructor(public readonly reason: 'activeSubscription' | 'familySubscription' | 'unavailable' | 'priceChanged') {
    super(reason);
  }
}

export const isRevenueCatPurchaseCancelled = (error: unknown) => {
  const value = error as { userCancelled?: boolean; code?: string | number } | null;
  // purchases-typescript-internal: PURCHASE_CANCELLED_ERROR = '1'.
  return value?.userCancelled === true || String(value?.code) === '1';
};

export async function purchaseRevenueCatProduct(userId: string, productId: RevenueCatProductId) {
  const plan = REVENUECAT_PLANS.find((candidate) => candidate.ios === productId);
  if (!plan) throw new RevenueCatPurchaseBlockedError('unavailable');
  return purchaseSubscriptionPlan(userId, plan.tier, plan.interval);
}

export async function purchaseSubscriptionPlan(
  userId: string,
  tier: SubscriptionTier,
  interval: SubscriptionInterval,
  displayedPrice?: StorePlanPrice,
) {
  if (Platform.OS === 'web') throw new RevenueCatPurchaseBlockedError('unavailable');
  const revision = sessionRevision;
  const familyCheck = await checkFamilyPurchaseAccess(userId);
  assertSession(userId, revision);
  if (familyCheck !== 'allowed') {
    throw new RevenueCatPurchaseBlockedError(familyCheck === 'family' ? 'familySubscription' : 'unavailable');
  }
  return withRevenueCatUser(userId, async () => {
    // Fail closed on a status error. A cancelled renewal still blocks another
    // subscription while entitlement/access remains active.
    await Purchases.invalidateCustomerInfoCache();
    const current = await Purchases.getCustomerInfo();
    const active = Object.values(current.entitlements.active).filter((value) => value.isActive !== false);
    const hasSubscription = active.length > 0 || current.activeSubscriptions.length > 0;
    const sameProduct = active.some((value) => {
      const plan = resolveSubscriptionProduct(value.productIdentifier, value.productPlanIdentifier);
      return plan?.tier === tier && plan.interval === interval;
    });
    if (hasSubscription && (Platform.OS === 'android' || sameProduct || active.length === 0 ||
        active.some((value) => value.store !== 'APP_STORE'))) {
      throw new RevenueCatPurchaseBlockedError('activeSubscription');
    }
    const offering = await getCurrentOffering();
    const plan = REVENUECAT_PLANS.find((value) => value.tier === tier && value.interval === interval);
    const selection = plan && resolvePurchasablePlan(offering?.availablePackages ?? [], plan, Platform.OS);
    if (!selection) throw new RevenueCatPurchaseBlockedError('unavailable');
    if (displayedPrice && (Object.keys(selection.pricing) as (keyof StorePlanPrice)[])
      .some((key) => displayedPrice[key] !== selection.pricing[key])) {
      throw new RevenueCatPurchaseBlockedError('priceChanged');
    }
    assertSession(userId, revision);
    const result = selection.option
      ? await Purchases.purchaseSubscriptionOption(selection.option)
      : await Purchases.purchasePackage(selection.pkg);
    // Any old entitlement is not proof that the requested plan is now active.
    return Object.entries(result.customerInfo.entitlements.active).some(([key, value]) => {
      const purchased = resolveSubscriptionProduct(value.productIdentifier, value.productPlanIdentifier);
      return value.isActive !== false && value.store === (Platform.OS === 'android' ? 'PLAY_STORE' : 'APP_STORE') &&
        getEntitlementTier(value, key) === tier && purchased?.interval === interval;
    });
  });
}

export async function getRevenueCatPlanPricing(userId: string): Promise<RevenueCatPlanPricing> {
  if (Platform.OS === 'web') return {};
  try {
    const packages = await getRevenueCatPackages(userId);
    const pricing: RevenueCatPlanPricing = {};
    for (const plan of REVENUECAT_PLANS) {
      const selection = resolvePurchasablePlan(packages, plan, Platform.OS);
      if (selection) pricing[plan.key] = selection.pricing;
    }
    return pricing;
  } catch (error) {
    warnRevenueCatFailure('RevenueCat plan pricing lookup failed', error);
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
    const customerInfo = await withRevenueCatUser(userId, () => Purchases.restorePurchases());
    return hasAnyActiveEntitlement(customerInfo);
  } catch (err) {
    warnRevenueCatFailure('RevenueCat restorePurchases failed', err);
    await reportRevenueCatFailure('restore_purchases', userId, err);
    throw err;
  }
}

export const subscribeToRevenueCatCustomerInfoUpdates = (
  userId: string,
  listener: (customerInfo: any) => void,
) => {
  if (Platform.OS === 'web') return () => undefined;

  const revision = sessionRevision;
  let disposed = false;
  let registered = false;

  const customerInfoListener = (customerInfo: any) => {
    if (!disposed && revision === sessionRevision && lastInitializedUserId === userId) listener(customerInfo);
  };

  void initRevenueCat(userId)
    .then(() => {
      if (disposed || revision !== sessionRevision || lastInitializedUserId !== userId) return;
      Purchases.addCustomerInfoUpdateListener(customerInfoListener);
      registered = true;
    })
    .catch(async (error) => {
      warnRevenueCatFailure('RevenueCat customer info listener setup failed', error);
      await reportRevenueCatFailure('listener_setup', userId, error);
    });

  return () => {
    disposed = true;
    if (registered) {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    }
  };
};
