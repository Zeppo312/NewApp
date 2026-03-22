import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { PaywallExperience } from '@/components/paywall/PaywallExperience';
import { useAuth } from '@/contexts/AuthContext';
import { invalidatePremiumStatusCache } from '@/lib/appCache';
import { markPaywallShown } from '@/lib/paywall';
import {
  DEFAULT_PAYWALL_CONTENT,
  fetchPaywallContent,
  sanitizePaywallContent,
  subscribeToPaywallContent,
  unsubscribePaywallContent,
} from '@/lib/paywallContent';
import {
  getRevenueCatConfigurationIssue,
  hasRevenueCatEntitlement,
  purchaseMonthlyPackage,
  purchaseYearlyPackage,
  restoreRevenueCatPurchases,
} from '@/lib/revenuecat';

const APPLE_EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

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
  const [content, setContent] = useState(DEFAULT_PAYWALL_CONTENT);
  const [pendingAction, setPendingAction] = useState<
    'monthly' | 'yearly' | 'restore' | null
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
  const visiblePurchaseError = purchaseError ?? revenueCatConfigurationIssue;

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      try {
        const record = await fetchPaywallContent();
        if (!cancelled) {
          setContent(record.content);
        }
      } catch (error) {
        console.error('Failed to load paywall content:', error);
        if (!cancelled) {
          setContent(DEFAULT_PAYWALL_CONTENT);
        }
      }
    };

    void loadContent();

    const channel = subscribeToPaywallContent(
      (record) => {
        if (!cancelled) {
          setContent(record.content);
        }
      },
      (error) => {
        console.error('Paywall content subscription failed:', error);
      },
    );

    return () => {
      cancelled = true;
      void unsubscribePaywallContent(channel);
    };
  }, []);

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

  const purchaseAndNavigate = async (plan: 'monthly' | 'yearly') => {
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
    setPendingAction(plan);

    try {
      const hasAccess =
        plan === 'yearly'
          ? await purchaseYearlyPackage(user.id)
          : await purchaseMonthlyPackage(user.id);

      if (!hasAccess) {
        setPurchaseError(
          'Kauf abgeschlossen – der Status wird noch synchronisiert. Bitte tippe „Status aktualisieren“.',
        );
        return;
      }

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
        await invalidatePremiumStatusCache();
        router.replace(nextRoute as any);
        return;
      }

      const current = await hasRevenueCatEntitlement(user.id);
      if (current) {
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
      <PaywallExperience
        content={sanitizePaywallContent(content)}
        billingLabel={billingLabel}
        isTrialExpired={isTrialExpired}
        allowClose={!isAdminPreview}
        showAppleEula={Platform.OS === 'ios'}
        visiblePurchaseError={visiblePurchaseError}
        pendingAction={pendingAction}
        isPurchaseActionDisabled={isPurchaseActionDisabled}
        onMonthlyPress={() => {
          void purchaseAndNavigate('monthly');
        }}
        onYearlyPress={() => {
          void purchaseAndNavigate('yearly');
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
