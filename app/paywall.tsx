import React, { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedBackground } from '@/components/ThemedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { markPaywallShown, PAYWALL_TRIAL_DAYS } from '@/lib/paywall';
import {
  findRevenueCatPackageByProductId,
  getRevenueCatConfigurationIssue,
  getRevenueCatPackages,
  hasRevenueCatEntitlement,
  purchaseMonthlyPackage,
  purchaseYearlyPackage,
  restoreRevenueCatPurchases,
  REVENUECAT_MONTHLY_PRODUCT_ID,
  REVENUECAT_YEARLY_PRODUCT_ID,
} from '@/lib/revenuecat';

const extractCurrencySymbol = (value: string) => {
  const match = value.match(/[€$£¥]/);
  return match?.[0] ?? null;
};

const resolveStorePriceLabel = (storePriceLabel: string | null | undefined, fallbackPriceLabel: string) => {
  if (typeof storePriceLabel !== 'string') return null;

  const normalizedPriceLabel = storePriceLabel.trim();
  if (normalizedPriceLabel.length === 0) return null;

  const storeCurrencySymbol = extractCurrencySymbol(normalizedPriceLabel);
  const fallbackCurrencySymbol = extractCurrencySymbol(fallbackPriceLabel);

  if (storeCurrencySymbol && fallbackCurrencySymbol && storeCurrencySymbol !== fallbackCurrencySymbol) {
    return null;
  }

  return normalizedPriceLabel;
};

export default function PaywallScreen() {
  const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
  const { next, origin, preview } = useLocalSearchParams<{ next?: string; origin?: string; preview?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const nextRoute = typeof next === 'string' && next.length > 0 ? next : '/(tabs)/home';
  const isAdminPreview = preview === 'admin';
  const [step, setStep] = useState(0);
  const [pendingAction, setPendingAction] = useState<'monthly' | 'yearly' | 'restore' | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState<string | null>(null);
  const [yearlyPriceLabel, setYearlyPriceLabel] = useState<string | null>(null);
  const isPurchasesSupported = Platform.OS !== 'web';
  const isCompactPlanLayout = width < 720;
  const contentMaxWidth = Math.min(width - 40, 760);

  const CTA_LABEL = 'Weiter';
  const MONTHLY_FALLBACK_PRICE = '3,79 €';
  const YEARLY_FALLBACK_PRICE = '44,99 €';

  const revenueCatConfigurationIssue = useMemo(() => {
    if (!isPurchasesSupported) return null;
    return getRevenueCatConfigurationIssue();
  }, [isPurchasesSupported]);

  const isRevenueCatConfigured = revenueCatConfigurationIssue === null;

  const isPurchaseActionDisabled = isPurchasesSupported && (!isRevenueCatConfigured || !user || !!pendingAction);

  const billingLabel =
    Platform.OS === 'ios'
      ? 'Abrechnung über den App Store'
      : Platform.OS === 'android'
        ? 'Abrechnung über Google Play'
        : 'Abrechnung';

  const monthlyDisplayPrice = monthlyPriceLabel ?? MONTHLY_FALLBACK_PRICE;
  const yearlyDisplayPrice = yearlyPriceLabel ?? YEARLY_FALLBACK_PRICE;
  const monthlyPriceText = `${monthlyDisplayPrice} pro Monat`;
  const yearlyPriceText = `${yearlyDisplayPrice} pro Jahr`;
  const introPriceSummary = `Aktuell ${monthlyPriceText} oder ${yearlyPriceText}.`;
  const trialDaysLabel = `${PAYWALL_TRIAL_DAYS} Tage`;
  const trialDaysAfterLabel = `${PAYWALL_TRIAL_DAYS} Tagen`;
  const visiblePurchaseError = purchaseError ?? revenueCatConfigurationIssue;

  useEffect(() => {
    if (isAdminPreview) return;
    markPaywallShown(origin);
  }, [isAdminPreview, origin]);

  useEffect(() => {
    if (!isPurchasesSupported || !user || !isRevenueCatConfigured) return;

    let cancelled = false;

    const loadPrices = async () => {
      try {
        const packages = await getRevenueCatPackages(user.id);
        const monthlyPkg = findRevenueCatPackageByProductId(packages, REVENUECAT_MONTHLY_PRODUCT_ID);
        const yearlyPkg = findRevenueCatPackageByProductId(packages, REVENUECAT_YEARLY_PRODUCT_ID);
        const monthlyPriceString = monthlyPkg?.product?.priceString;
        const yearlyPriceString = yearlyPkg?.product?.priceString;
        const resolvedMonthlyPriceLabel = resolveStorePriceLabel(monthlyPriceString, MONTHLY_FALLBACK_PRICE);
        const resolvedYearlyPriceLabel = resolveStorePriceLabel(yearlyPriceString, YEARLY_FALLBACK_PRICE);

        if (cancelled) return;

        if (resolvedMonthlyPriceLabel) {
          setMonthlyPriceLabel(resolvedMonthlyPriceLabel);
        }

        if (resolvedYearlyPriceLabel) {
          setYearlyPriceLabel(resolvedYearlyPriceLabel);
        }
      } catch (err) {
        console.warn('RevenueCat offerings load failed', err);
      }
    };

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, [isPurchasesSupported, isRevenueCatConfigured, user]);

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
      setPurchaseError(revenueCatConfigurationIssue ?? 'Zahlungen sind aktuell nicht verfügbar (RevenueCat nicht konfiguriert).');
      return;
    }

    setPurchaseError(null);
    setPendingAction(plan);

    try {
      const hasAccess =
        plan === 'yearly' ? await purchaseYearlyPackage(user.id) : await purchaseMonthlyPackage(user.id);

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
      setPurchaseError(revenueCatConfigurationIssue ?? 'Zahlungen sind aktuell nicht verfügbar (RevenueCat nicht konfiguriert).');
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
        title: `${trialDaysLabel} kostenlos, danach Abo`,
        subtitle: 'Lotti Baby ist nach der kostenlosen Phase nur mit aktivem Abo weiter nutzbar. Es geht also nicht um einzelne Extras, sondern um die App insgesamt.',
        body: (
          <BlurView intensity={32} tint="light" style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.96)', 'rgba(249,239,230,0.88)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{trialDaysLabel}</Text>
                <Text style={styles.heroStatLabel}>kostenlos testen</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{monthlyDisplayPrice}</Text>
                <Text style={styles.heroStatLabel}>pro Monat</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>Abo</Text>
                <Text style={styles.heroStatLabel}>für die ganze App</Text>
              </View>
            </View>
            <View style={styles.heroCardHeader}>
              <Text style={styles.heroCardTitle}>Alles in einer App</Text>
              <Text style={styles.heroCardSub}>Von Schwangerschaft bis Baby-Alltag.</Text>
            </View>

            <View style={styles.previewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Schwangerschaft</Text>
                <Text style={styles.previewValue}>Wehen, Checkliste, Geburtsplan</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Baby</Text>
                <Text style={styles.previewValue}>Schlaf, Füttern, Wachstum</Text>
              </View>
              <View style={[styles.previewRow, styles.previewRowLast]}>
                <Text style={styles.previewLabel}>Organisation</Text>
                <Text style={[styles.previewValue, styles.previewAccent]}>Planner, Listen, Auswertungen</Text>
              </View>
            </View>
          </BlurView>
        ),
      },
      {
        id: 'reminder',
        title: 'So läuft es nach der Testphase',
        subtitle: `Die ersten ${trialDaysLabel} kannst du Lotti Baby kostenlos nutzen. Danach ist ein Abo nötig, um die App weiter zu verwenden.`,
        body: (
          <View style={styles.timelineCard}>
            <View style={styles.timelineLine} />
            <View style={styles.timelineRow}>
              <View style={styles.dot}>
                <Text style={styles.dotLabel}>1</Text>
              </View>
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Tag 1 bis {PAYWALL_TRIAL_DAYS}</Text>
                <Text style={styles.timelineDesc}>Voller Zugriff auf Schwangerschaft, Baby, Planung und Auswertungen.</Text>
              </View>
            </View>
            <View style={styles.timelineRow}>
              <View style={styles.dot}>
                <Text style={styles.dotLabel}>2</Text>
              </View>
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Ab Tag {PAYWALL_TRIAL_DAYS + 1}</Text>
                <Text style={styles.timelineDesc}>Ohne aktives Abo kannst du Lotti Baby nicht weiter nutzen.</Text>
              </View>
            </View>
            <View style={styles.timelineRow}>
              <View style={styles.dot}>
                <Text style={styles.dotLabel}>M</Text>
              </View>
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Monatsabo</Text>
                <Text style={styles.timelineDesc}>
                  {monthlyPriceText} · {billingLabel}
                </Text>
              </View>
            </View>
            <View style={styles.timelineRow}>
              <View style={styles.dot}>
                <Text style={styles.dotLabel}>J</Text>
              </View>
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Jahresabo</Text>
                <Text style={styles.timelineDesc}>
                  {yearlyPriceText} · {billingLabel}
                </Text>
              </View>
            </View>
            <View style={[styles.timelineRow, { marginBottom: 0 }]}>
              <View style={styles.dot}>
                <Text style={styles.dotLabel}>✓</Text>
              </View>
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Kündigung</Text>
                <Text style={styles.timelineDesc}>Jederzeit in den Store-Einstellungen.</Text>
              </View>
            </View>
          </View>
        ),
      },
      {
        id: 'pricing',
        title: 'Lotti Baby weiter nutzen',
        subtitle: `Wähle dein Abo für die Zeit nach den ersten ${trialDaysAfterLabel} kostenloser Nutzung.`,
        body: (
          <View style={styles.pricingBody}>
            <Text style={styles.socialProof}>Alles enthalten, was dich vor und nach der Geburt begleitet.</Text>
            <BlurView intensity={20} tint="light" style={styles.featureCard}>
              <Text style={styles.featureTitle}>Das ist in Lotti Baby enthalten:</Text>
              <View style={styles.featurePill}>
                <View style={styles.featureIcon}>
                  <Text style={styles.featureIconText}>1</Text>
                </View>
                <Text style={styles.featureText}>Schwangerschaft: Wehen-Tracker, Kliniktaschen-Checkliste, Geburtsplan und Babynamen</Text>
              </View>
              <View style={styles.featurePill}>
                <View style={styles.featureIcon}>
                  <Text style={styles.featureIconText}>2</Text>
                </View>
                <Text style={styles.featureText}>Baby: Schlaftracker, Stillen, Flasche, Beikost und Tagesübersicht</Text>
              </View>
              <View style={styles.featurePill}>
                <View style={styles.featureIcon}>
                  <Text style={styles.featureIconText}>3</Text>
                </View>
                <Text style={styles.featureText}>Entwicklung: Gewichtskurve, Größenkurve, Zahn-Tracker und Meilensteine</Text>
              </View>
              <View style={styles.featurePill}>
                <View style={styles.featureIcon}>
                  <Text style={styles.featureIconText}>4</Text>
                </View>
                <Text style={styles.featureText}>Alltag: Planer, Listen, Auswertungen, PDF-Exporte und weitere Familien-Tools</Text>
              </View>
            </BlurView>
          </View>
        ),
      },
    ],
    [billingLabel, monthlyDisplayPrice, monthlyPriceText, trialDaysAfterLabel, trialDaysLabel, yearlyPriceText],
  );

  const handleClose = () => {
    router.back();
  };

  const openLegalRoute = (route: '/datenschutz' | '/nutzungsbedingungen' | '/impressum') => {
    router.push(route as any);
  };

  const openExternalUrl = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <ThemedBackground style={styles.shell}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#5E4BC4', '#7C63D8', '#D8CDEA', '#F5EEE6']}
        locations={[0, 0.32, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.ambientOrb, styles.ambientOrbTop]} />
      <View style={[styles.ambientOrb, styles.ambientOrbMiddle]} />
      <View style={[styles.ambientOrb, styles.ambientOrbBottom]} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
          <View style={styles.topBar}>
            <View style={styles.topBarSpacer} />
            <View style={styles.brandBlock}>
              <Text style={styles.logo}>Lotti Baby</Text>
              <Text style={styles.logoSub}>Schwangerschaft bis Baby-Alltag</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={8} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.eyebrow}>
            {step === 0 ? 'Kostenlos testen' : step === 1 ? 'So funktioniert es' : 'Passendes Abo wählen'}
          </Text>
          <Text style={styles.headline}>{slides[step].title}</Text>
          <Text style={styles.subline}>{slides[step].subtitle}</Text>
          {step === 0 && (
            <>
              <Text style={styles.sublineAlt}>
                {introPriceSummary}
              </Text>
              <Text style={styles.miniBenefit}>Nach {trialDaysAfterLabel} brauchst du ein aktives Abo, um Lotti Baby weiter zu nutzen.</Text>
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
              <Text style={styles.ctaTitle}>Alles transparent erklärt</Text>
              <Text style={styles.ctaSub}>Kein Kauf auf diesem Schritt. Erst einmal Überblick, dann Preiswahl.</Text>
              <Pressable style={styles.primaryButton} onPress={() => setStep(prev => Math.min(prev + 1, slides.length - 1))}>
                <LinearGradient
                  colors={['#FFCFAE', '#FEB493']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.primaryText}>{CTA_LABEL}</Text>
              </Pressable>
              <Pressable onPress={handleClose} hitSlop={8} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>Vielleicht später</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.planStack}>
              <View style={[styles.planGrid, isCompactPlanLayout && styles.planGridCompact]}>
                <View
                  style={[
                    styles.planCard,
                    !isCompactPlanLayout && styles.planCardHalf,
                    !isCompactPlanLayout && styles.planCardMonthly,
                    isCompactPlanLayout && styles.planCardCompact,
                  ]}
                >
                  <View style={styles.planBadgeRow}>
                    <Text style={styles.planBadge}>Monatsabo</Text>
                    <Text style={styles.planSave}>pro Monat</Text>
                  </View>
                  <Text style={styles.planTitle}>Monatlich flexibel</Text>
                  <Text style={styles.planPrice}>{monthlyDisplayPrice}</Text>
                  <Text style={styles.planMeta}>{billingLabel}</Text>
                  <Text style={styles.planDesc}>Für die Nutzung von Lotti Baby nach den ersten {trialDaysAfterLabel}. Zahlung wird bei Bestätigung im Store fällig.</Text>
                  <View style={styles.planList}>
                    <View style={styles.planListItem}>
                      <View style={styles.planListDot} />
                      <Text style={styles.planListText}>Voller Zugriff auf alle Inhalte</Text>
                    </View>
                    <View style={styles.planListItem}>
                      <View style={styles.planListDot} />
                      <Text style={styles.planListText}>Jederzeit kündbar</Text>
                    </View>
                  </View>
                  <Text style={styles.planNote}>Ideal, wenn du erst einmal flexibel bleiben möchtest.</Text>
                  <Pressable
                    style={styles.primaryButton}
                    disabled={isPurchaseActionDisabled}
                    onPress={() => purchaseAndNavigate('monthly')}
                  >
                    <LinearGradient
                      colors={['#FFCFAE', '#FEB493']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.primaryText}>
                      {pendingAction === 'monthly' ? 'Bitte warten…' : 'Monatsabo starten'}
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.planCard,
                    !isCompactPlanLayout && styles.planCardHalf,
                    styles.planCardHighlight,
                    isCompactPlanLayout && styles.planCardCompact,
                    isCompactPlanLayout && styles.planCardHighlightCompact,
                  ]}
                >
                  <View style={styles.planBadgeRow}>
                    <Text style={[styles.planBadge, styles.planBadgeYearly]}>Jahresabo</Text>
                    <Text style={[styles.planSave, styles.planSaveYearly]}>pro Jahr</Text>
                  </View>
                  <Text style={styles.planTitle}>Günstiger im Jahrespaket</Text>
                  <Text style={styles.planPrice}>{yearlyDisplayPrice}</Text>
                  <Text style={styles.planMeta}>{billingLabel}</Text>
                  <Text style={styles.planDesc}>Einmal im Jahr zahlen und Lotti Baby nach den ersten {trialDaysAfterLabel} ohne Unterbrechung weiter nutzen.</Text>
                  <View style={styles.planList}>
                    <View style={styles.planListItem}>
                      <View style={[styles.planListDot, styles.planListDotYearly]} />
                      <Text style={styles.planListText}>Bester Preis für die ganze App</Text>
                    </View>
                    <View style={styles.planListItem}>
                      <View style={[styles.planListDot, styles.planListDotYearly]} />
                      <Text style={styles.planListText}>Läuft das ganze Jahr ohne Unterbrechung</Text>
                    </View>
                  </View>
                  <Text style={styles.planNote}>Automatische Verlängerung bis zur Kündigung in den Store-Einstellungen.</Text>
                  <Pressable
                    style={[styles.primaryButton, styles.primaryButtonYearly]}
                    disabled={isPurchaseActionDisabled}
                    onPress={() => purchaseAndNavigate('yearly')}
                  >
                    <LinearGradient
                      colors={['#FFE6C8', '#FFD2A5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.primaryText}>
                      {pendingAction === 'yearly' ? 'Bitte warten…' : 'Jahresabo starten'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={restoreAndRefresh} hitSlop={8} disabled={isPurchaseActionDisabled}>
                <Text style={styles.secondaryAction}>
                  {pendingAction === 'restore' ? 'Aktualisiere…' : 'Käufe wiederherstellen / Status aktualisieren'}
                </Text>
              </Pressable>

              <Pressable onPress={handleClose} hitSlop={8} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Vielleicht später</Text>
              </Pressable>

              <Text style={styles.legal}>
                Nach den ersten {trialDaysAfterLabel} ist für die weitere Nutzung ein Abo erforderlich. Zahlung wird bei Kaufbestätigung deinem App-Store/Google-Play-Konto belastet. Abos verlängern sich automatisch, wenn sie nicht rechtzeitig gekündigt werden.
              </Text>
              <Text style={styles.legal}>
                Mit dem Kauf gelten die Nutzungsbedingungen und auf iOS ergänzend die Apple-Standard-EULA; Hinweise zur Datenverarbeitung findest du direkt im Datenschutz.
              </Text>
              <View style={styles.legalLinksRow}>
                <Pressable accessibilityRole="link" hitSlop={8} onPress={() => openLegalRoute('/datenschutz')}>
                  <Text style={styles.legalLink}>Datenschutz</Text>
                </Pressable>
                <Pressable accessibilityRole="link" hitSlop={8} onPress={() => openLegalRoute('/nutzungsbedingungen')}>
                  <Text style={styles.legalLink}>Nutzungsbedingungen</Text>
                </Pressable>
                {Platform.OS === 'ios' ? (
                  <Pressable accessibilityRole="link" hitSlop={8} onPress={() => openExternalUrl(APPLE_EULA_URL)}>
                    <Text style={styles.legalLink}>Apple-Standard-EULA</Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="link" hitSlop={8} onPress={() => openLegalRoute('/impressum')}>
                  <Text style={styles.legalLink}>Impressum</Text>
                </Pressable>
              </View>
            </View>
          )}
          {visiblePurchaseError ? <Text style={styles.errorText}>{visiblePurchaseError}</Text> : null}
        </View>
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
    alignItems: 'center',
  },
  content: {
    width: '100%',
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  ambientOrbTop: {
    width: 240,
    height: 240,
    top: 92,
    right: -72,
  },
  ambientOrbMiddle: {
    width: 180,
    height: 180,
    top: 430,
    left: -70,
    backgroundColor: 'rgba(255,207,174,0.14)',
  },
  ambientOrbBottom: {
    width: 280,
    height: 280,
    bottom: 140,
    right: -120,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  topBarSpacer: {
    width: 46,
    height: 46,
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FDFBF6',
  },
  logoSub: {
    color: 'rgba(253,251,246,0.78)',
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  closeButtonText: {
    fontSize: 22,
    color: '#FDFBF6',
    fontWeight: '400',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFE7CF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FDFBF6',
    marginBottom: 10,
    lineHeight: 40,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  subline: {
    fontSize: 17,
    color: '#FDFBF6',
    opacity: 0.9,
    marginBottom: 12,
    lineHeight: 25,
    maxWidth: 620,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  sublineAlt: {
    fontSize: 14,
    color: '#FDFBF6',
    opacity: 0.84,
    marginBottom: 10,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  miniBenefit: {
    fontSize: 15,
    color: '#FDFBF6',
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 18,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  hero: {
    marginBottom: 18,
  },
  heroCard: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(255,255,255,0.28)',
    padding: 22,
    overflow: 'hidden',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  heroStat: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(94,61,179,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.08)',
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3D2C80',
    marginBottom: 2,
  },
  heroStatLabel: {
    fontSize: 11,
    color: '#7B6B63',
    fontWeight: '600',
  },
  heroCardHeader: {
    marginBottom: 16,
  },
  heroCardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#4A3A36',
    marginBottom: 4,
  },
  heroCardSub: {
    fontSize: 14,
    color: '#8B7C72',
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  previewRowLast: {
    borderBottomWidth: 0,
  },
  previewLabel: {
    fontSize: 14,
    color: '#6A5952',
    flex: 0.9,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2F1F1B',
    fontVariant: ['tabular-nums'],
    flex: 1.2,
    textAlign: 'right',
  },
  previewAccent: {
    color: '#5E3DB3',
  },
  timelineCard: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    marginBottom: 12,
  },
  timelineLine: {
    position: 'absolute',
    left: 36,
    top: 34,
    bottom: 34,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDD0AF',
    marginTop: 2,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotLabel: {
    color: '#5E3DB3',
    fontSize: 11,
    fontWeight: '800',
  },
  timelineTextWrap: {
    flex: 1,
  },
  timelineLabel: {
    color: '#FDFBF6',
    fontWeight: '800',
    marginBottom: 4,
    fontSize: 15,
  },
  timelineDesc: {
    color: '#FDFBF6',
    opacity: 0.88,
    fontSize: 14,
    lineHeight: 20,
  },
  featureCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.32)',
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4A3A36',
    marginBottom: 14,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.1)',
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3E9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  featureIconText: {
    color: '#5E3DB3',
    fontWeight: '800',
    fontSize: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#4A3A36',
    fontWeight: '700',
    lineHeight: 20,
  },
  socialProof: {
    fontSize: 14,
    color: '#FDFBF6',
    opacity: 0.95,
    marginBottom: 12,
    fontWeight: '700',
  },
  pricingBody: {},
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  dotStep: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.32)',
    marginHorizontal: 4,
  },
  dotStepActive: {
    backgroundColor: '#FFD2AF',
    width: 28,
  },
  ctaCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  ctaTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#3B2E2A',
    marginBottom: 6,
  },
  ctaSub: {
    textAlign: 'center',
    fontSize: 14,
    color: '#7A6D67',
    lineHeight: 20,
    marginBottom: 14,
  },
  secondaryAction: {
    textAlign: 'center',
    color: '#5E3DB3',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    textDecorationLine: 'underline',
  },
  skipButton: {
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(94,61,179,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.08)',
  },
  skipButtonText: {
    textAlign: 'center',
    color: '#5E3DB3',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cancelButtonText: {
    textAlign: 'center',
    color: '#4A3A36',
    fontSize: 15,
    fontWeight: '700',
  },
  planStack: {
    marginTop: 6,
  },
  planGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 14,
  },
  planGridCompact: {
    flexDirection: 'column',
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(94,61,179,0.1)',
  },
  planCardHalf: {
    flex: 1,
  },
  planCardCompact: {
    marginBottom: 14,
  },
  planCardMonthly: {
    marginRight: 8,
  },
  planCardHighlight: {
    borderColor: 'rgba(255,221,196,0.92)',
    backgroundColor: 'rgba(255,255,255,0.98)',
    marginLeft: 8,
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  planCardHighlightCompact: {
    marginLeft: 0,
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
  planBadgeYearly: {
    backgroundColor: '#7A52D1',
  },
  planSave: {
    color: '#8B7C72',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  planSaveYearly: {
    color: '#7A52D1',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2F1F1B',
    marginBottom: 6,
  },
  planPrice: {
    fontSize: 34,
    fontWeight: '800',
    color: '#2F1F1B',
    marginBottom: 2,
  },
  planMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B6B63',
    marginBottom: 10,
  },
  planDesc: {
    fontSize: 14,
    color: '#6A5952',
    marginBottom: 12,
    lineHeight: 20,
  },
  planList: {
    marginBottom: 12,
    gap: 8,
  },
  planListItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5E3DB3',
    marginRight: 10,
  },
  planListDotYearly: {
    backgroundColor: '#F1A96D',
  },
  planListText: {
    flex: 1,
    color: '#4A3A36',
    fontSize: 13,
    fontWeight: '600',
  },
  planNote: {
    fontSize: 12,
    color: '#6A5952',
    marginBottom: 12,
    lineHeight: 18,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: 'center',
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#FEB493',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonYearly: {
    shadowColor: '#FFD2A5',
    shadowOpacity: 0.38,
  },
  primaryText: {
    color: '#5E3DB3',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  errorText: {
    color: '#FDFBF6',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(176,0,32,0.8)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: '600',
  },
  legal: {
    fontSize: 11,
    opacity: 0.78,
    lineHeight: 16,
    color: '#4A3A36',
    textAlign: 'center',
  },
  legalLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5E3DB3',
    textDecorationLine: 'underline',
  },
});
