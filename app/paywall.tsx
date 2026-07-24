import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import {
  PaywallPlansExperience,
  type PaywallPlanPrices,
} from '@/components/paywall/PaywallPlansExperience';
import { useAuth } from '@/contexts/AuthContext';
import { invalidatePremiumStatusCache } from '@/lib/appCache';
import { invalidateSubscriptionTierCache } from '@/lib/entitlements';
import { markPaywallShown } from '@/lib/paywall';
import {
  DEFAULT_PAYWALL_CONTENT,
  clonePaywallPlansContent,
  fetchPaywallContent,
  formatEuroAmount,
  type PaywallPlansContent,
} from '@/lib/paywallContent';
import {
  DEFAULT_DISPLAY_LITE_MONTHLY_PRICE,
  DEFAULT_DISPLAY_LITE_YEARLY_PRICE,
  DEFAULT_DISPLAY_MONTHLY_PRICE,
  DEFAULT_DISPLAY_STANDARD_MONTHLY_PRICE,
  DEFAULT_DISPLAY_STANDARD_YEARLY_PRICE,
  DEFAULT_DISPLAY_YEARLY_PRICE,
} from '@/lib/paywallDefaults';
import {
  getRevenueCatConfigurationIssue,
  getRevenueCatPlanPricing,
  hasRevenueCatEntitlement,
  purchaseSubscriptionPlan,
  restoreRevenueCatPurchases,
  type RevenueCatPlanPricing,
  type SubscriptionInterval,
  type SubscriptionTier,
} from '@/lib/revenuecat';

const APPLE_EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const buildPlanPrices = (
  storePricing: RevenueCatPlanPricing,
): PaywallPlanPrices => {
  const resolve = (
    fromStore: { price: number; priceString: string } | undefined,
    fallbackAmount: number,
  ) =>
    fromStore
      ? { amount: fromStore.price, label: fromStore.priceString }
      : { amount: fallbackAmount, label: formatEuroAmount(fallbackAmount) };

  return {
    premiumMonthly: resolve(
      storePricing.premiumMonthly,
      DEFAULT_DISPLAY_MONTHLY_PRICE,
    ),
    premiumYearly: resolve(
      storePricing.premiumYearly,
      DEFAULT_DISPLAY_YEARLY_PRICE,
    ),
    standardMonthly: resolve(
      storePricing.standardMonthly,
      DEFAULT_DISPLAY_STANDARD_MONTHLY_PRICE,
    ),
    standardYearly: resolve(
      storePricing.standardYearly,
      DEFAULT_DISPLAY_STANDARD_YEARLY_PRICE,
    ),
    liteMonthly: resolve(
      storePricing.liteMonthly,
      DEFAULT_DISPLAY_LITE_MONTHLY_PRICE,
    ),
    liteYearly: resolve(
      storePricing.liteYearly,
      DEFAULT_DISPLAY_LITE_YEARLY_PRICE,
    ),
  };
};

export default function PaywallScreen() {
  const { next, origin, preview, trialExpired } = useLocalSearchParams<{
    next?: string;
    origin?: string;
    preview?: string;
    trialExpired?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const nextRoute =
    typeof next === 'string' && next.length > 0 ? next : '/(tabs)/home';
  const isAdminPreview = preview === 'admin';
  const isTrialExpired = trialExpired === '1';
  const [plansContent, setPlansContent] = useState<PaywallPlansContent>(() =>
    clonePaywallPlansContent(DEFAULT_PAYWALL_CONTENT.plans),
  );
  const [storePricing, setStorePricing] = useState<RevenueCatPlanPricing>({});
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
    isPurchasesSupported && (!isRevenueCatConfigured || !user || !!pendingAction);
  const billingLabel =
    Platform.OS === 'ios'
      ? 'Abrechnung über den App Store'
      : Platform.OS === 'android'
        ? 'Abrechnung über Google Play'
        : 'Abrechnung';
  const storeProvider =
    Platform.OS === 'ios'
      ? 'Apple'
      : Platform.OS === 'android'
        ? 'Google Play'
        : 'der Store';
  const visiblePurchaseError = purchaseError ?? revenueCatConfigurationIssue;

  const planPrices = useMemo(
    () => buildPlanPrices(storePricing),
    [storePricing],
  );

  useEffect(() => {
    let cancelled = false;

    const loadContentSettings = async () => {
      try {
        const record = await fetchPaywallContent();
        if (!cancelled) {
          setPlansContent(record.content.plans);
        }
      } catch (error) {
        console.error('Failed to load paywall content:', error);
      }
    };

    void loadContentSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPurchasesSupported || !isRevenueCatConfigured || !user) return;

    let cancelled = false;

    const loadStorePricing = async () => {
      const pricing = await getRevenueCatPlanPricing(user.id);
      if (!cancelled) {
        setStorePricing(pricing);
      }
    };

    void loadStorePricing();

    return () => {
      cancelled = true;
    };
  }, [isPurchasesSupported, isRevenueCatConfigured, user]);

  useEffect(() => {
    if (isAdminPreview) return;
    void markPaywallShown(origin);
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
      router.replace(nextRoute as any);
      return;
    }

    if (!user) {
      setPurchaseError('Bitte zuerst anmelden.');
      return;
    }

    if (!isRevenueCatConfigured) {
      setPurchaseError(
        revenueCatConfigurationIssue ??
          'Zahlungen sind aktuell nicht verfügbar (RevenueCat nicht konfiguriert).',
      );
      return;
    }

    setPurchaseError(null);
    setPendingAction('purchase');

    try {
      const hasAccess = await purchaseSubscriptionPlan(user.id, tier, interval);

      if (!hasAccess) {
        setPurchaseError(
          'Kauf abgeschlossen – der Status wird noch synchronisiert. Bitte tippe „Status aktualisieren“.',
        );
        return;
      }

      invalidateSubscriptionTierCache();
      await invalidatePremiumStatusCache();
      router.replace(nextRoute as any);
    } catch (err: any) {
      if (err?.userCancelled === true) return;
      if (
        typeof err?.message === 'string' &&
        err.message.toLowerCase().includes('cancel')
      ) {
        return;
      }
      setPurchaseError(
        err?.message ?? 'Kauf fehlgeschlagen. Bitte versuche es erneut.',
      );
    } finally {
      setPendingAction(null);
    }
  };

  const restoreAndRefresh = async () => {
    if (!isPurchasesSupported) {
      router.replace(nextRoute as any);
      return;
    }

    if (!user) {
      setPurchaseError('Bitte zuerst anmelden.');
      return;
    }

    if (!isRevenueCatConfigured) {
      setPurchaseError(
        revenueCatConfigurationIssue ??
          'Zahlungen sind aktuell nicht verfügbar (RevenueCat nicht konfiguriert).',
      );
      return;
    }

    setPurchaseError(null);
    setPendingAction('restore');

    try {
      const restored = await restoreRevenueCatPurchases(user.id);
      if (restored) {
        invalidateSubscriptionTierCache();
        await invalidatePremiumStatusCache();
        router.replace(nextRoute as any);
        return;
      }

      const current = await hasRevenueCatEntitlement(user.id);
      if (current) {
        invalidateSubscriptionTierCache();
        await invalidatePremiumStatusCache();
        router.replace(nextRoute as any);
        return;
      }

      setPurchaseError('Kein aktives Abo gefunden.');
    } catch (err: any) {
      setPurchaseError(
        err?.message ??
          'Status-Aktualisierung fehlgeschlagen. Bitte versuche es erneut.',
      );
    } finally {
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
        billingLabel={billingLabel}
        storeProvider={storeProvider}
        isTrialExpired={isTrialExpired}
        allowClose={!isAdminPreview}
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
        onClose={() => router.back()}
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
