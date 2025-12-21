import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedBackground } from '@/components/ThemedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { markPaywallShown } from '@/lib/paywall';
import Purchases from '@/lib/purchasesClient';
import {
  hasRevenueCatEntitlement,
  initRevenueCat,
  purchaseMonthlyPackage,
  restoreRevenueCatPurchases,
  REVENUECAT_OFFERING_ID,
  REVENUECAT_PACKAGE_ID,
} from '@/lib/revenuecat';

export default function PaywallScreen() {
  const { next, origin } = useLocalSearchParams<{ next?: string; origin?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const nextRoute = typeof next === 'string' && next.length > 0 ? next : '/(tabs)/home';
  const [step, setStep] = useState(0);
  const [pendingAction, setPendingAction] = useState<'purchase' | 'restore' | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState<string | null>(null);
  const isPurchasesSupported = Platform.OS !== 'web';

  const CTA_LABEL = 'Weiter';

  const isRevenueCatConfigured = useMemo(() => {
    if (Platform.OS === 'ios') return Boolean(process.env.EXPO_PUBLIC_RC_IOS_KEY);
    if (Platform.OS === 'android') return Boolean(process.env.EXPO_PUBLIC_RC_ANDROID_KEY);
    return false;
  }, []);

  const isPurchaseActionDisabled = isPurchasesSupported && (!isRevenueCatConfigured || !user || !!pendingAction);

  const billingLabel =
    Platform.OS === 'ios'
      ? 'Zahlung über den App Store'
      : Platform.OS === 'android'
        ? 'Zahlung über Google Play'
        : 'Zahlung';

  useEffect(() => {
    // Anzeige registrieren, damit das 2h-Fenster in Supabase gesetzt ist
    markPaywallShown(origin);
  }, [origin]);

  useEffect(() => {
    if (!isPurchasesSupported || !user || !isRevenueCatConfigured) return;

    let cancelled = false;

    const loadPrice = async () => {
      try {
        await initRevenueCat(user.id);
        const offerings = await Purchases.getOfferings();
        const offering = offerings?.all?.[REVENUECAT_OFFERING_ID] ?? offerings?.current ?? null;
        const pkg = offering?.availablePackages?.find((p: any) => p?.identifier === REVENUECAT_PACKAGE_ID) ?? null;
        const priceString = pkg?.product?.priceString;
        if (!cancelled && typeof priceString === 'string' && priceString.length > 0) {
          setMonthlyPriceLabel(priceString);
        }
      } catch (err) {
        console.warn('RevenueCat offerings load failed', err);
      }
    };

    loadPrice();

    return () => {
      cancelled = true;
    };
  }, [isPurchasesSupported, isRevenueCatConfigured, user]);

  const purchaseAndNavigate = async () => {
    if (!isPurchasesSupported) {
      router.replace(nextRoute as any);
      return;
    }

    if (!user) {
      setPurchaseError('Bitte zuerst anmelden.');
      return;
    }

    if (!isRevenueCatConfigured) {
      setPurchaseError('Zahlungen sind aktuell nicht verfügbar (RevenueCat nicht konfiguriert).');
      return;
    }

    setPurchaseError(null);
    setPendingAction('purchase');

    try {
      const hasAccess = await purchaseMonthlyPackage(user.id);
      if (!hasAccess) {
        setPurchaseError(
          'Kauf abgeschlossen – der Status wird noch synchronisiert. Bitte tippe „Status aktualisieren“.',
        );
        return;
      }

      router.replace(nextRoute as any);
    } catch (err: any) {
      if (err?.userCancelled === true) return;
      if (typeof err?.message === 'string' && err.message.toLowerCase().includes('cancel')) return;
      setPurchaseError(err?.message ?? 'Kauf fehlgeschlagen. Bitte versuche es erneut.');
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
      setPurchaseError('Zahlungen sind aktuell nicht verfügbar (RevenueCat nicht konfiguriert).');
      return;
    }

    setPurchaseError(null);
    setPendingAction('restore');

    try {
      const restored = await restoreRevenueCatPurchases(user.id);
      if (restored) {
        router.replace(nextRoute as any);
        return;
      }

      const current = await hasRevenueCatEntitlement(user.id);
      if (current) {
        router.replace(nextRoute as any);
        return;
      }

      setPurchaseError('Kein aktives Abo gefunden.');
    } catch (err: any) {
      setPurchaseError(err?.message ?? 'Status-Aktualisierung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setPendingAction(null);
    }
  };

  const slides = useMemo(
    () => [
      {
        id: 'intro',
        title: 'Mehr Überblick für deinen Mama-Alltag 💛',
        subtitle: 'Schlaf, Mahlzeiten, Planung & Shareables – alles an einem Ort.',
        showMiniBenefit: true,
        body: (
          <BlurView intensity={32} tint="light" style={styles.heroCard}>
            <LinearGradient
              colors={['#FDF4E6', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroCardHeader}>
              <Text style={styles.heroCardTitle}>Dein Lotti-Tag</Text>
              <Text style={styles.heroCardSub}>So unterstützt dich die App.</Text>
            </View>

            <View style={styles.previewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Schlaf</Text>
                <Text style={styles.previewValue}>✨ smarter</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Planner</Text>
                <Text style={styles.previewValue}>✔︎ organisiert</Text>
              </View>
              <View style={[styles.previewRow, styles.previewRowLast]}>
                <Text style={styles.previewLabel}>Insights</Text>
                <Text style={[styles.previewValue, styles.previewAccent]}>in Sekunden</Text>
              </View>
            </View>
          </BlurView>
        ),
      },
      {
        id: 'reminder',
        title: 'Keine Sorge – volle Flexibilität 💛',
        subtitle: 'Du kannst jederzeit kündigen. Keine Abofalle. Keine versteckten Kosten.',
        body: (
          <View style={styles.timelineCard}>
            <View style={styles.timelineRow}>
              <View style={styles.dot} />
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Heute</Text>
                <Text style={styles.timelineDesc}>Alle Funktionen sofort freischalten</Text>
              </View>
            </View>
            <View style={[styles.timelineRow, { marginBottom: 0 }]}>
              <View style={styles.dot} />
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Monatlich kündbar</Text>
                <Text style={styles.timelineDesc}>{billingLabel}</Text>
              </View>
            </View>
          </View>
        ),
      },
      {
        id: 'pricing',
        title: 'Premium freischalten',
        subtitle: 'Ein Abo – alle Funktionen. Monatlich kündbar.',
        body: (
          <View style={styles.pricingBody}>
            <Text style={styles.socialProof}>Schon viele Mamas nutzen Lotti Baby täglich.</Text>
            <BlurView intensity={20} tint="light" style={styles.featureCard}>
              <Text style={styles.featureTitle}>Das steckt drin:</Text>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>✨ Schlaftracker + persönliche Baby-Insights</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>📒 Planner & Einkaufslisten – immer organisiert</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>💜 Shareables & Meilensteine</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>📊 PDF-Exporte & Auswertungen – perfekt für Vorsorge & Co.</Text>
              </View>
            </BlurView>
          </View>
        ),
      },
    ],
    [billingLabel],
  );

  return (
    <ThemedBackground style={styles.shell}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#6C5ECF', '#5E3DB3', '#F5EEE0']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Premium</Text>
          </View>
          <Text style={styles.logo}>Lotti Baby</Text>
        </View>

        <Text style={styles.headline}>{slides[step].title}</Text>
        <Text style={styles.subline}>{slides[step].subtitle}</Text>
        {step === 0 && (
          <>
            <Text style={styles.sublineAlt}>Alles an einem Ort. Kein Stress. Keine Limits.</Text>
            <Text style={styles.miniBenefit}>Mehr Überblick. Weniger Mental Load.</Text>
          </>
        )}

        <View style={styles.hero}>{slides[step].body}</View>

        <View style={styles.stepDots}>
          {slides.map((s, idx) => (
            <View key={s.id} style={[styles.dotStep, idx === step && styles.dotStepActive]} />
          ))}
        </View>

        {step < slides.length - 1 ? (
          <View style={styles.ctaCard}>
            <Pressable style={styles.primaryButton} onPress={() => setStep(prev => Math.min(prev + 1, slides.length - 1))}>
              <LinearGradient
                colors={['#FFCFAE', '#FEB493']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.primaryText}>{CTA_LABEL}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.planStack}>
            <View style={[styles.planCard, styles.planCardHighlight]}>
              <View style={styles.planBadgeRow}>
                <Text style={styles.planBadge}>Monatsabo</Text>
                <Text style={styles.planSave}>{monthlyPriceLabel ? `${monthlyPriceLabel} / Monat` : 'Jederzeit kündbar'}</Text>
              </View>
              <Text style={styles.planTitle}>Premium freischalten</Text>
              <Text style={styles.planPrice}>{billingLabel}</Text>
              <Text style={styles.planDesc}>Alle Premium-Funktionen freischalten · jederzeit kündbar</Text>
              <Pressable style={styles.primaryButton} disabled={isPurchaseActionDisabled} onPress={purchaseAndNavigate}>
                <LinearGradient
                  colors={['#FFCFAE', '#FEB493']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.primaryText}>{pendingAction === 'purchase' ? 'Bitte warten…' : 'Premium aktivieren'}</Text>
              </Pressable>
            </View>

            <Pressable onPress={restoreAndRefresh} hitSlop={8} disabled={isPurchaseActionDisabled}>
              <Text style={styles.secondaryAction}>
                {pendingAction === 'restore' ? 'Aktualisiere…' : 'Käufe wiederherstellen / Status aktualisieren'}
              </Text>
            </Pressable>

            <Text style={styles.legal}>
              Zahlung wird bei Kaufbestätigung deinem App-Store/Google-Play-Konto belastet. Abos verlängern sich automatisch, wenn sie nicht rechtzeitig gekündigt werden.
            </Text>
          </View>
        )}
        {purchaseError ? <Text style={styles.errorText}>{purchaseError}</Text> : null}
      </ScrollView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 52,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  badgeText: {
    fontWeight: '700',
    color: '#FDFBF6',
    letterSpacing: 0.2,
  },
  logo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FDFBF6',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FDFBF6',
    marginBottom: 8,
  },
  subline: {
    fontSize: 15,
    color: '#FDFBF6',
    opacity: 0.92,
    marginBottom: 12,
  },
  sublineAlt: {
    fontSize: 14,
    color: '#FDFBF6',
    opacity: 0.9,
    marginBottom: 10,
  },
  miniBenefit: {
    fontSize: 14,
    color: '#FDFBF6',
    fontWeight: '700',
    marginBottom: 16,
  },
  hero: {
    marginBottom: 22,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.35)',
    padding: 18,
    overflow: 'hidden',
  },
  heroCardHeader: {
    marginBottom: 14,
  },
  heroCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4A3A36',
  },
  heroCardSub: {
    fontSize: 13,
    color: '#8B7C72',
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  previewRowLast: {
    borderBottomWidth: 0,
  },
  previewLabel: {
    fontSize: 14,
    color: '#6A5952',
  },
  previewValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2F1F1B',
    fontVariant: ['tabular-nums'],
  },
  previewAccent: {
    color: '#5E3DB3',
  },
  timelineCard: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    marginBottom: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFCFAE',
    marginTop: 6,
    marginRight: 12,
  },
  timelineTextWrap: {
    flex: 1,
  },
  timelineLabel: {
    color: '#FDFBF6',
    fontWeight: '800',
    marginBottom: 2,
    fontSize: 14,
  },
  timelineDesc: {
    color: '#FDFBF6',
    opacity: 0.9,
    fontSize: 13,
  },
  featureCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 16,
    marginBottom: 14,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4A3A36',
    marginBottom: 12,
  },
  featurePill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.08)',
  },
  featureText: {
    fontSize: 14,
    color: '#4A3A36',
    fontWeight: '700',
  },
  socialProof: {
    fontSize: 13,
    color: '#4A3A36',
    opacity: 0.9,
    marginBottom: 10,
  },
  pricingBody: {},
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dotStep: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 4,
  },
  dotStepActive: {
    backgroundColor: '#FFCFAE',
    width: 18,
  },
  ctaCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    marginBottom: 12,
  },
  secondaryAction: {
    textAlign: 'center',
    color: '#7A6E6A',
    fontSize: 13,
    marginTop: 10,
  },
  planStack: {
    marginTop: 6,
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.08)',
    marginBottom: 12,
  },
  planCardHighlight: {
    borderColor: 'rgba(255,207,174,0.6)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  planBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planBadge: {
    backgroundColor: '#5E3DB3',
    color: '#FDFBF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '800',
  },
  planSave: {
    color: '#5E3DB3',
    fontWeight: '800',
    fontSize: 12,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2F1F1B',
    marginBottom: 6,
  },
  planPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A3A36',
    marginBottom: 4,
  },
  planDesc: {
    fontSize: 13,
    color: '#6A5952',
    marginBottom: 12,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 4,
    overflow: 'hidden',
  },
  primaryText: {
    color: '#5E3DB3',
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: '#B00020',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
  },
  legal: {
    fontSize: 11,
    opacity: 0.7,
    lineHeight: 15,
    color: '#4A3A36',
    textAlign: 'center',
  },
});

