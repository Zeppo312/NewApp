import { useFamilySubscriptionAccess } from '@/hooks/useFamilySubscriptionAccess';
import { hasCheckedFamilyAccess, refreshFamilyAccess } from '@/lib/familySubscriptionAccess';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import {
  PaywallPlansExperience,
  type PaywallPlanPrices,
} from '@/components/paywall/PaywallPlansExperience';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { invalidatePremiumStatusCache } from '@/lib/appCache';
import { invalidateSubscriptionTierCache } from '@/lib/entitlements';
import { markPaywallShown, shouldShowPaywall } from '@/lib/paywall';
import {
  DEFAULT_PAYWALL_CONTENT,
  fetchPaywallContent,
  type PaywallPlansContent,
} from '@/lib/paywallContent';
import {
  getRevenueCatConfigurationIssue,
  getRevenueCatPlanPricing,
  isRevenueCatPurchaseCancelled,
  RevenueCatPurchaseBlockedError,
  type RevenueCatPlanKey,
  hasRevenueCatEntitlement,
  purchaseSubscriptionPlan,
  restoreRevenueCatPurchases,
  type RevenueCatPlanPricing,
  type SubscriptionInterval,
  type SubscriptionTier,
} from '@/lib/revenuecat';
import { localizePaywallPlansContent, translatePaywall } from '@/lib/paywallTranslations';

const APPLE_EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const buildPlanPrices = (storePricing: RevenueCatPlanPricing, unavailable: string): PaywallPlanPrices => {
  const resolve = (key: RevenueCatPlanKey) => {
    const price = storePricing[key];
    return price
      ? { amount: price.price, label: price.priceString, currencyCode: price.currencyCode, verified: true }
      : { amount: 0, label: unavailable, verified: false };
  };
  return {
    premiumMonthly: resolve('premiumMonthly'), premiumYearly: resolve('premiumYearly'),
    standardMonthly: resolve('standardMonthly'), standardYearly: resolve('standardYearly'),
    liteMonthly: resolve('liteMonthly'), liteYearly: resolve('liteYearly'),
  };
};

export default function PaywallScreen() {
  const { next, origin, preview } = useLocalSearchParams<{
    next?: string;
    origin?: string;
    preview?: string;
    trialExpired?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const family = useFamilySubscriptionAccess();
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translatePaywall>[1]) => translatePaywall(locale, key);

  const nextRoute =
    typeof next === 'string' && next.length > 0 ? next : '/(tabs)/home';
  const isAdminPreview = preview === 'admin';
  // Route-Parameter dürfen keinen kostenlosen Zugang oder Schließen erlauben.
  const [accessCheck, setAccessCheck] = useState<{
    userId: string;
    requiresSubscription: boolean;
  } | null>(null);
  const isTrialExpired = !user || accessCheck?.userId !== user.id || accessCheck.requiresSubscription;
  const [plansContent, setPlansContent] = useState<PaywallPlansContent>(() =>
    localizePaywallPlansContent(locale, DEFAULT_PAYWALL_CONTENT.plans),
  );
  const [pricingState, setPricingState] = useState<{ userId: string; pricing: RevenueCatPlanPricing } | null>(null);
  const storePricing = pricingState?.userId === user?.id ? pricingState?.pricing ?? {} : {};
  const actionInFlight = useRef(false);
  const currentUserId = useRef(user?.id);
  useEffect(() => { currentUserId.current = user?.id; }, [user?.id]);
  const [showManagement, setShowManagement] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    'purchase' | 'restore' | null
  >(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const isPurchasesSupported = Platform.OS !== 'web';

  const revenueCatConfigurationIssue = useMemo(() => {
    if (!isPurchasesSupported) return null;
    return getRevenueCatConfigurationIssue();
  }, [isPurchasesSupported]);

  const isRevenueCatConfigured = revenueCatConfigurationIssue === null;
  const isPurchaseActionDisabled =
    !isPurchasesSupported || !isRevenueCatConfigured || !user || !!pendingAction || isAdminPreview || family?.status === 'active' || family?.status === 'unavailable';
  const billingLabel =
    Platform.OS === 'ios'
      ? t('billingApple')
      : Platform.OS === 'android'
        ? t('billingGoogle')
        : t('billing');
  const storeProvider =
    Platform.OS === 'ios'
      ? 'Apple'
      : Platform.OS === 'android'
        ? 'Google Play'
        : t('store');
  const visiblePurchaseError = purchaseError ?? (family?.status === 'unavailable' && user && hasCheckedFamilyAccess(user.id) ? t('refreshFailed') : null) ?? (revenueCatConfigurationIssue ? t('unavailable') : null);

  const planPrices = useMemo(
    () => buildPlanPrices(storePricing, t('priceUnavailable')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, storePricing],
  );

  useEffect(() => {
    if (!isAdminPreview && family?.status === 'active') router.replace(nextRoute as any);
  }, [family?.status, isAdminPreview, nextRoute, router]);

  useEffect(() => {
    let cancelled = false;

    const loadContentSettings = async () => {
      try {
        const record = await fetchPaywallContent();
        if (!cancelled) {
          setPlansContent(localizePaywallPlansContent(locale, record.content.plans));
        }
      } catch (error) {
        console.error('Failed to load paywall content:', error);
      }
    };

    void loadContentSettings();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    // Clear account-specific purchase state when the external auth identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPricingState(null);
    setPurchaseError(null);
    setShowManagement(false);
    if (!isPurchasesSupported || !isRevenueCatConfigured || !user) return;

    let cancelled = false;

    const loadStorePricing = async () => {
      const pricing = await getRevenueCatPlanPricing(user.id);
      if (!cancelled) {
        setPricingState({ userId: user.id, pricing });
      }
    };

    void loadStorePricing();

    return () => {
      cancelled = true;
    };
  }, [isPurchasesSupported, isRevenueCatConfigured, user]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    const userId = user.id;
    void shouldShowPaywall().then(({ shouldShow }) => {
      if (!cancelled) setAccessCheck({ userId, requiresSubscription: shouldShow });
    }).catch((error) => {
      console.error('Paywall access check failed:', error);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (isAdminPreview) return;
    // Die Erfassung darf weder die Navigation blockieren noch Zugang gewähren.
    void markPaywallShown(origin).catch((error) => {
      console.error('Failed to record paywall view:', error);
    });
  }, [isAdminPreview, origin]);

  useEffect(() => {
    if (!isTrialExpired || Platform.OS !== 'android') return;

    const handler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => {
      handler.remove();
    };
  }, [isTrialExpired]);

  const purchaseAndNavigate = async (
    tier: SubscriptionTier,
    interval: SubscriptionInterval,
  ) => {
    if (!isPurchasesSupported) {
      setPurchaseError(t('unavailable'));
      return;
    }

    if (!user) {
      setPurchaseError(t('signIn'));
      return;
    }

    if (!isRevenueCatConfigured) {
      setPurchaseError(
        t('unavailable'),
      );
      return;
    }

    const key = `${tier}${interval === 'yearly' ? 'Yearly' : 'Monthly'}` as RevenueCatPlanKey;
    const price = storePricing[key];
    if (!price || isAdminPreview) { setPurchaseError(t('unavailable')); return; }
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    const actionUserId = user.id;
    setPurchaseError(null);
    setPendingAction('purchase');

    try {
      const hasAccess = await purchaseSubscriptionPlan(user.id, tier, interval, price);
      if (currentUserId.current !== actionUserId) return;

      if (!hasAccess) {
        setPurchaseError(
          t('syncing'),
        );
        return;
      }

      invalidateSubscriptionTierCache();
      await invalidatePremiumStatusCache();
      if (currentUserId.current === actionUserId) router.replace(nextRoute as any);
    } catch (err: any) {
      if (currentUserId.current !== actionUserId || isRevenueCatPurchaseCancelled(err)) return;
      // Installed SDK: PAYMENT_PENDING_ERROR = '20'; no access until confirmed.
      if (String(err?.code) === '20') {
        setPurchaseError(t('paymentPending'));
      } else if (err instanceof RevenueCatPurchaseBlockedError) {
        setPurchaseError(t(err.reason));
        setShowManagement(err.reason === 'activeSubscription' || err.reason === 'familySubscription');
        if (err.reason === 'priceChanged') {
          const pricing = await getRevenueCatPlanPricing(actionUserId);
          if (currentUserId.current === actionUserId) setPricingState({ userId: actionUserId, pricing });
        }
      } else {
        setPurchaseError(t('purchaseFailed'));
      }
    } finally {
      actionInFlight.current = false;
      setPendingAction(null);
    }
  };

  const restoreAndRefresh = async () => {
    if (!isPurchasesSupported) {
      setPurchaseError(t('unavailable'));
      return;
    }

    if (!user) {
      setPurchaseError(t('signIn'));
      return;
    }

    if (!isRevenueCatConfigured) {
      setPurchaseError(
        t('unavailable'),
      );
      return;
    }

    if (actionInFlight.current || isAdminPreview) return;
    actionInFlight.current = true;
    const actionUserId = user.id;
    setPurchaseError(null);
    setPendingAction('restore');

    try {
      const familyAccess = await refreshFamilyAccess(actionUserId, { force: true });
      if (currentUserId.current !== actionUserId) return;
      if (familyAccess.status === 'active') {
        invalidateSubscriptionTierCache();
        router.replace(nextRoute as any);
        return;
      }
      if (familyAccess.status === 'unavailable') { setPurchaseError(t('refreshFailed')); return; }
      const restored = await restoreRevenueCatPurchases(user.id);
      if (currentUserId.current !== actionUserId) return;
      if (restored) {
        invalidateSubscriptionTierCache();
        await invalidatePremiumStatusCache();
        if (currentUserId.current === actionUserId) router.replace(nextRoute as any);
        return;
      }

      const current = await hasRevenueCatEntitlement(user.id);
      if (currentUserId.current !== actionUserId) return;
      if (current) {
        invalidateSubscriptionTierCache();
        await invalidatePremiumStatusCache();
        if (currentUserId.current === actionUserId) router.replace(nextRoute as any);
        return;
      }

      setPurchaseError(t('noneFound'));
    } catch {
      if (currentUserId.current === actionUserId) setPurchaseError(t('refreshFailed'));
    } finally {
      actionInFlight.current = false;
      setPendingAction(null);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, gestureEnabled: !isTrialExpired }}
      />
      <PaywallPlansExperience
        content={plansContent}
        prices={planPrices}
        previewOnly={isAdminPreview}
        onManageSubscription={showManagement ? () => router.push('/subscription') : undefined}
        billingLabel={billingLabel}
        storeProvider={storeProvider}
        isTrialExpired={isTrialExpired}
        allowClose={!isAdminPreview && !isTrialExpired}
        showAppleEula={Platform.OS === 'ios'}
        visiblePurchaseError={visiblePurchaseError}
        pendingAction={pendingAction}
        isPurchaseActionDisabled={isPurchaseActionDisabled}
        onPurchase={(tier, interval) => {
          void purchaseAndNavigate(tier, interval);
        }}
        onRestorePress={() => {
          void restoreAndRefresh();
        }}
        onRedeemFamilyCode={user && !isAdminPreview && !pendingAction
          ? () => router.push('/(tabs)/account-linking') : undefined}
        onClose={() => { if (!isTrialExpired) router.back(); }}
        onOpenPrivacy={() => router.push('/datenschutz' as any)}
        onOpenTerms={() => router.push('/nutzungsbedingungen' as any)}
        onOpenAppleEula={() => {
          void Linking.openURL(APPLE_EULA_URL);
        }}
        onOpenImprint={() => router.push('/impressum' as any)}
        onOpenDataManagement={() => router.push('/dsgvo' as any)}
      />
    </>
  );
}
