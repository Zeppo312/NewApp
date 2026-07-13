import React, { useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { formatEuroAmount } from '@/lib/paywallContent';
import type {
  SubscriptionInterval,
  SubscriptionTier,
} from '@/lib/revenuecat';

export type PaywallPlanPrice = {
  amount: number;
  label: string;
};

export type PaywallPlanPrices = {
  premiumMonthly: PaywallPlanPrice;
  premiumYearly: PaywallPlanPrice;
  standardMonthly: PaywallPlanPrice;
  standardYearly: PaywallPlanPrice;
  liteMonthly: PaywallPlanPrice;
  liteYearly: PaywallPlanPrice;
};

export type PaywallPendingAction = 'purchase' | 'restore' | null;

type PaywallPlansExperienceProps = {
  prices: PaywallPlanPrices;
  billingLabel: string;
  storeProvider: string;
  isTrialExpired: boolean;
  allowClose?: boolean;
  showAppleEula?: boolean;
  visiblePurchaseError?: string | null;
  pendingAction?: PaywallPendingAction;
  isPurchaseActionDisabled?: boolean;
  onPurchase?: (tier: SubscriptionTier, interval: SubscriptionInterval) => void;
  onRestorePress?: () => void;
  onClose?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenAppleEula?: () => void;
  onOpenImprint?: () => void;
  onOpenDataManagement?: () => void;
};

type ComparisonRow = {
  label: string;
  lite: boolean;
  standard: boolean;
  premium: boolean;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Schlaf-, Still- & Wickel-Tracker', lite: true, standard: true, premium: true },
  { label: 'Schwangerschaft: Wehen-Tracker & Checklisten', lite: true, standard: true, premium: true },
  { label: 'Gewichts- & Größenkurven', lite: true, standard: true, premium: true },
  { label: 'Meilensteine & Zahn-Tracker', lite: true, standard: true, premium: true },
  { label: 'Kompletter Verlauf (Lite: letzte 7 Tage)', lite: false, standard: true, premium: true },
  { label: 'Partner-Verknüpfung: gemeinsam tracken', lite: false, standard: true, premium: true },
  { label: 'Tagesübersicht, Planer & Einkaufslisten', lite: false, standard: true, premium: true },
  { label: 'Wochenmomente & Erinnerungs-Sammlung', lite: false, standard: true, premium: true },
  { label: 'Rezepte & Beikost-Begleitung', lite: false, standard: true, premium: true },
  { label: 'Auswertungen & PDF-Exporte', lite: false, standard: true, premium: true },
  { label: '✨ KI: Sprach-Logging – Einträge einsprechen', lite: false, standard: false, premium: true },
  { label: '✨ KI: Lottis Fürsorge – tägliche Hinweise', lite: false, standard: false, premium: true },
];

const PREMIUM_BULLETS = [
  '✨ KI-Features: Sprach-Logging & Lottis Fürsorge',
  'Partner-Verknüpfung für euch beide',
  'Planer, Listen, Wochenmomente & Rezepte',
  'Auswertungen, Erinnerungen & PDF-Exporte',
];

const LITE_BULLETS = [
  'Alle Basis-Tracker für den Alltag',
  'Schwangerschafts-Begleitung',
  'Wachstum & Meilensteine',
  'Verlauf der letzten 7 Tage',
];

const STANDARD_BULLETS = [
  'Alle Tracker mit vollständigem Verlauf',
  'Partner-Verknüpfung für euch beide',
  'Planer, Listen, Wochenmomente & Rezepte',
  'Auswertungen, Erinnerungen & PDF-Exporte',
];

export function PaywallPlansExperience({
  prices,
  billingLabel,
  storeProvider,
  isTrialExpired,
  allowClose = true,
  showAppleEula = true,
  visiblePurchaseError,
  pendingAction = null,
  isPurchaseActionDisabled = false,
  onPurchase,
  onRestorePress,
  onClose,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAppleEula,
  onOpenImprint,
  onOpenDataManagement,
}: PaywallPlansExperienceProps) {
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(width - 40, 640);

  const [tier, setTier] = useState<SubscriptionTier>('premium');
  const [interval, setInterval] = useState<SubscriptionInterval>('yearly');
  const selectPulse = React.useState(() => new Animated.Value(1))[0];

  const showCloseButton = allowClose && !isTrialExpired;
  const purchaseDisabled = isPurchaseActionDisabled || pendingAction !== null;

  const pulseSelection = () => {
    selectPulse.setValue(0.97);
    Animated.timing(selectPulse, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleSelectTier = (nextTier: SubscriptionTier) => {
    if (nextTier !== tier) {
      setTier(nextTier);
      pulseSelection();
    }
  };

  const handleSelectInterval = (nextInterval: SubscriptionInterval) => {
    if (nextInterval !== interval) {
      setInterval(nextInterval);
      pulseSelection();
    }
  };

  const yearlySavingsPercent = (monthly: number, yearly: number) => {
    if (monthly <= 0 || yearly <= 0) return 0;
    const full = monthly * 12;
    if (yearly >= full) return 0;
    return Math.round(((full - yearly) / full) * 100);
  };

  const premiumSavings = yearlySavingsPercent(
    prices.premiumMonthly.amount,
    prices.premiumYearly.amount,
  );
  const liteSavings = yearlySavingsPercent(
    prices.liteMonthly.amount,
    prices.liteYearly.amount,
  );
  const standardSavings = yearlySavingsPercent(
    prices.standardMonthly.amount,
    prices.standardYearly.amount,
  );
  const maxSavings = Math.max(premiumSavings, standardSavings, liteSavings);

  const selectedPrice = useMemo(() => {
    if (tier === 'premium') {
      return interval === 'yearly' ? prices.premiumYearly : prices.premiumMonthly;
    }
    if (tier === 'standard') {
      return interval === 'yearly' ? prices.standardYearly : prices.standardMonthly;
    }
    return interval === 'yearly' ? prices.liteYearly : prices.liteMonthly;
  }, [interval, prices, tier]);

  const perMonthLabel = (price: PaywallPlanPrice) =>
    price.amount > 0 ? `${formatEuroAmount(price.amount / 12)} / Monat` : '';

  const ctaLabel =
    pendingAction === 'purchase'
      ? 'Einen Moment …'
      : tier === 'premium'
        ? `Premium starten · ${selectedPrice.label}`
        : tier === 'standard'
          ? `Standard starten · ${selectedPrice.label}`
          : `Lite starten · ${selectedPrice.label}`;

  const renderCheck = (included: boolean, emphasized: boolean) => (
    <View
      style={[
        styles.checkCell,
        included
          ? emphasized
            ? styles.checkCellPremium
            : styles.checkCellLite
          : styles.checkCellEmpty,
      ]}
    >
      <Text
        style={[
          styles.checkCellText,
          !included && styles.checkCellTextEmpty,
        ]}
      >
        {included ? '✓' : '–'}
      </Text>
    </View>
  );

  const renderTierCard = (cardTier: SubscriptionTier) => {
    const isPremium = cardTier === 'premium';
    const isStandard = cardTier === 'standard';
    const isSelected = tier === cardTier;
    const monthly = isPremium
      ? prices.premiumMonthly
      : isStandard
        ? prices.standardMonthly
        : prices.liteMonthly;
    const yearly = isPremium
      ? prices.premiumYearly
      : isStandard
        ? prices.standardYearly
        : prices.liteYearly;
    const price = interval === 'yearly' ? yearly : monthly;
    const bullets = isPremium ? PREMIUM_BULLETS : isStandard ? STANDARD_BULLETS : LITE_BULLETS;
    const savings = isPremium ? premiumSavings : isStandard ? standardSavings : liteSavings;

    return (
      <Pressable
        key={cardTier}
        onPress={() => handleSelectTier(cardTier)}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        style={[
          styles.tierCard,
          isPremium && styles.tierCardPremium,
          isSelected && styles.tierCardSelected,
          isSelected && isPremium && styles.tierCardSelectedPremium,
        ]}
      >
        {isPremium ? (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>Beliebteste Wahl</Text>
          </View>
        ) : null}

        <View style={styles.tierHeaderRow}>
          <View style={styles.tierTitleWrap}>
            <Text style={styles.tierName}>
              {isPremium ? 'Lotti Premium' : isStandard ? 'Lotti Standard' : 'Lotti Lite'}
            </Text>
            <Text style={styles.tierTagline}>
              {isPremium
                ? 'Alles aus Standard plus Lottis KI-Features'
                : isStandard
                  ? 'Die volle Begleitung für eure Familie'
                  : 'Der einfache Start ins Tracking'}
            </Text>
          </View>
          <View
            style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}
          >
            {isSelected ? <View style={styles.radioInner} /> : null}
          </View>
        </View>

        <View style={styles.tierPriceRow}>
          <Text style={styles.tierPrice}>{price.label}</Text>
          <Text style={styles.tierPriceMeta}>
            {interval === 'yearly' ? 'pro Jahr' : 'pro Monat'}
          </Text>
        </View>
        {interval === 'yearly' ? (
          <Text style={styles.tierPerMonth}>
            {perMonthLabel(price)}
            {savings > 0 ? `  ·  Spare ${savings} %` : ''}
          </Text>
        ) : null}

        <View style={styles.tierBullets}>
          {bullets.map((item) => (
            <View key={item} style={styles.tierBulletRow}>
              <View
                style={[
                  styles.tierBulletDot,
                  isPremium && styles.tierBulletDotPremium,
                ]}
              />
              <Text style={styles.tierBulletText}>{item}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.shell}>
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

      <ScrollView
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
          <View style={styles.topBar}>
            <View style={styles.topBarSpacer} />
            <View style={styles.brandBlock}>
              <Text style={styles.logo}>Lotti Baby</Text>
              <Text style={styles.logoSub}>Schwangerschaft bis Baby-Alltag</Text>
            </View>
            {showCloseButton ? (
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            ) : (
              <View style={styles.topBarSpacer} />
            )}
          </View>

          <Text style={styles.headline}>
            Weniger Kopf-Chaos.{'\n'}Mehr Zeit für euer Baby.
          </Text>
          <Text style={styles.subline}>
            Lotti begleitet euch von der Schwangerschaft durch die ersten Jahre –
            alles Wichtige an einem Ort, für dich und deinen Partner.
          </Text>

          <View style={styles.socialProofPill}>
            <Text style={styles.socialProofStars}>★★★★★</Text>
            <Text style={styles.socialProofText}>
              Von Eltern entwickelt – für Familien wie eure
            </Text>
          </View>

          <View style={styles.intervalToggle}>
            {(
              [
                { key: 'monthly', label: 'Monatlich' },
                {
                  key: 'yearly',
                  label:
                    maxSavings > 0 ? `Jährlich · bis zu −${maxSavings} %` : 'Jährlich',
                },
              ] as { key: SubscriptionInterval; label: string }[]
            ).map((option) => (
              <Pressable
                key={option.key}
                onPress={() => handleSelectInterval(option.key)}
                style={[
                  styles.intervalOption,
                  interval === option.key && styles.intervalOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.intervalOptionText,
                    interval === option.key && styles.intervalOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Animated.View
            style={[styles.tierStack, { transform: [{ scale: selectPulse }] }]}
          >
            {renderTierCard('premium')}
            {renderTierCard('standard')}
            {renderTierCard('lite')}
          </Animated.View>

          <Pressable
            onPress={() => onPurchase?.(tier, interval)}
            disabled={purchaseDisabled}
            style={[styles.ctaButton, purchaseDisabled && styles.actionDisabled]}
          >
            <LinearGradient
              colors={tier === 'premium' ? ['#FFCFAE', '#FEB493'] : ['#FFE6C8', '#FFD2A5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
          </Pressable>
          <Text style={styles.ctaNote}>
            Jederzeit kündbar · {billingLabel} · Falls {storeProvider} eine
            kostenlose Testphase anbietet, siehst du sie vor dem Kauf im Store.
          </Text>

          {visiblePurchaseError ? (
            <Text style={styles.errorText}>{visiblePurchaseError}</Text>
          ) : null}

          <View style={styles.compareCard}>
            <Text style={styles.compareTitle}>Was steckt drin?</Text>
            <View style={styles.compareHeaderRow}>
              <View style={styles.compareLabelCell} />
              <Text style={styles.compareHeaderText}>Lite</Text>
              <Text style={styles.compareHeaderText}>Standard</Text>
              <Text style={[styles.compareHeaderText, styles.compareHeaderPremium]}>
                Premium
              </Text>
            </View>
            {COMPARISON_ROWS.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.compareRow,
                  index === COMPARISON_ROWS.length - 1 && styles.compareRowLast,
                ]}
              >
                <Text style={styles.compareLabel}>{row.label}</Text>
                {renderCheck(row.lite, false)}
                {renderCheck(row.standard, false)}
                {renderCheck(row.premium, true)}
              </View>
            ))}
          </View>

          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>
              „Nachts um 3 mit einer Hand den Still-Timer starten – und mein
              Partner sieht morgens direkt, wie die Nacht war. Genau das haben
              wir gebraucht.“
            </Text>
            <Text style={styles.quoteAuthor}>Eine Lotti-Mama, 4 Monate dabei</Text>
          </View>

          <View style={styles.trustRow}>
            {['Jederzeit kündbar', 'Sichere Zahlung', 'Für euch beide'].map(
              (item) => (
                <View key={item} style={styles.trustChip}>
                  <Text style={styles.trustChipText}>{item}</Text>
                </View>
              ),
            )}
          </View>

          <Pressable
            onPress={onRestorePress}
            hitSlop={8}
            disabled={purchaseDisabled}
            style={[styles.restoreButton, purchaseDisabled && styles.actionDisabled]}
          >
            <Text style={styles.restoreText}>
              {pendingAction === 'restore'
                ? 'Aktualisiere …'
                : 'Käufe wiederherstellen / Status prüfen'}
            </Text>
          </Pressable>

          {showCloseButton ? (
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Vielleicht später</Text>
            </Pressable>
          ) : null}

          <Text style={styles.legal}>
            Für die Nutzung von Lotti Baby ist ein aktives Abo erforderlich.
            Falls {storeProvider} für dein gewähltes Produkt eine kostenlose
            Testphase anbietet, wird sie vor dem Kauf im Store angezeigt. Die
            Zahlung wird bei Kaufbestätigung deinem Store-Konto belastet. Abos
            verlängern sich automatisch, wenn sie nicht rechtzeitig in den
            Store-Einstellungen gekündigt werden.
          </Text>

          <View style={styles.legalLinksRow}>
            <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenPrivacy}>
              <Text style={styles.legalLink}>Datenschutz</Text>
            </Pressable>
            <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenTerms}>
              <Text style={styles.legalLink}>Nutzungsbedingungen</Text>
            </Pressable>
            {showAppleEula ? (
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={onOpenAppleEula}
              >
                <Text style={styles.legalLink}>Apple-Standard-EULA</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenImprint}>
              <Text style={styles.legalLink}>Impressum</Text>
            </Pressable>
            {isTrialExpired ? (
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={onOpenDataManagement}
              >
                <Text style={styles.legalLink}>Konto & Daten verwalten</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    position: 'relative',
  },
  scrollInner: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  content: {
    width: '100%',
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.28,
  },
  ambientOrbTop: {
    width: 240,
    height: 240,
    backgroundColor: '#FFE0C5',
    top: -60,
    right: -40,
  },
  ambientOrbMiddle: {
    width: 220,
    height: 220,
    backgroundColor: '#BDAEF3',
    top: '34%',
    left: -80,
  },
  ambientOrbBottom: {
    width: 260,
    height: 260,
    backgroundColor: '#FFD8B8',
    bottom: -90,
    right: -70,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  logoSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headline: {
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subline: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
  },
  socialProofPill: {
    marginTop: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  socialProofStars: {
    fontSize: 13,
    color: '#FFD9A0',
    letterSpacing: 2,
  },
  socialProofText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF4E8',
  },
  intervalToggle: {
    marginTop: 24,
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  intervalOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  intervalOptionActive: {
    backgroundColor: '#FFF2E2',
  },
  intervalOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  intervalOptionTextActive: {
    color: '#6A4430',
  },
  tierStack: {
    marginTop: 18,
    gap: 14,
  },
  tierCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierCardPremium: {
    backgroundColor: 'rgba(255,246,234,0.97)',
    paddingTop: 26,
  },
  tierCardSelected: {
    borderColor: 'rgba(126,99,216,0.55)',
    shadowColor: '#4B3690',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  tierCardSelectedPremium: {
    borderColor: 'rgba(240,164,96,0.9)',
    shadowColor: '#8A5A34',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F0A460',
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tierTitleWrap: {
    flex: 1,
    gap: 4,
  },
  tierName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#513335',
  },
  tierTagline: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7D5A50',
  },
  radioOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(114,83,74,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterSelected: {
    borderColor: '#F0A460',
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F0A460',
  },
  tierPriceRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  tierPrice: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    color: '#513335',
  },
  tierPriceMeta: {
    fontSize: 14,
    color: '#8A655A',
    marginBottom: 4,
  },
  tierPerMonth: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#B06B1E',
  },
  tierBullets: {
    marginTop: 14,
    gap: 8,
  },
  tierBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierBulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B9A6EC',
  },
  tierBulletDotPremium: {
    backgroundColor: '#F0A460',
  },
  tierBulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#5F4346',
  },
  ctaButton: {
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    paddingHorizontal: 24,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#5A322B',
    textAlign: 'center',
  },
  ctaNote: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(90,60,50,0.9)',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#7B2D26',
    backgroundColor: 'rgba(255,224,219,0.92)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  compareCard: {
    marginTop: 28,
    borderRadius: 26,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  compareTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#513335',
    marginBottom: 14,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  compareLabelCell: {
    flex: 1,
  },
  compareHeaderText: {
    width: 62,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#8A655A',
  },
  compareHeaderPremium: {
    color: '#B06B1E',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(114,83,74,0.16)',
  },
  compareRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  compareLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#5F4346',
    paddingRight: 8,
  },
  checkCell: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCellLite: {},
  checkCellPremium: {},
  checkCellEmpty: {},
  checkCellText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3E8E5A',
  },
  checkCellTextEmpty: {
    color: 'rgba(114,83,74,0.35)',
    fontWeight: '600',
  },
  quoteCard: {
    marginTop: 18,
    borderRadius: 26,
    padding: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 10,
  },
  quoteText: {
    fontSize: 15,
    lineHeight: 23,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  trustRow: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  trustChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  trustChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF4E8',
  },
  restoreButton: {
    marginTop: 24,
    alignSelf: 'center',
  },
  restoreText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    color: '#6C473F',
  },
  cancelButton: {
    marginTop: 12,
    alignSelf: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7B5B55',
    textAlign: 'center',
  },
  legal: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 19,
    color: '#7A625D',
    textAlign: 'center',
  },
  legalLinksRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  legalLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A05E48',
  },
  actionDisabled: {
    opacity: 0.6,
  },
});

export default PaywallPlansExperience;
