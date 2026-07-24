import React, { useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  DEFAULT_PAYWALL_CONTENT,
  applyPaywallPlansTemplate,
  clonePaywallPlansContent,
  formatEuroAmount,
  type PaywallPlansContent,
  type PaywallPlansTierId,
} from '@/lib/paywallContent';
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
  content?: PaywallPlansContent;
  allowClose?: boolean;
  previewOnly?: boolean;
  editable?: boolean;
  useInternalScrollView?: boolean;
  showAppleEula?: boolean;
  visiblePurchaseError?: string | null;
  pendingAction?: PaywallPendingAction;
  isPurchaseActionDisabled?: boolean;
  onChangeField?: (path: string, value: string) => void;
  onPurchase?: (tier: SubscriptionTier, interval: SubscriptionInterval) => void;
  onRestorePress?: () => void;
  onClose?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenAppleEula?: () => void;
  onOpenImprint?: () => void;
  onOpenDataManagement?: () => void;
};

const TIER_ORDER: PaywallPlansTierId[] = ['premium', 'standard', 'lite'];

type InlineEditableTextProps = {
  editable: boolean;
  path?: string;
  value: string;
  displayValue: string;
  style: any;
  multiline?: boolean;
  textAlign?: 'left' | 'center';
  onChangeField?: (path: string, value: string) => void;
};

function InlineEditableText({
  editable,
  path,
  value,
  displayValue,
  style,
  multiline = false,
  textAlign = 'left',
  onChangeField,
}: InlineEditableTextProps) {
  if (!editable || !path || !onChangeField) {
    return <Text style={style}>{displayValue}</Text>;
  }

  return (
    <View style={styles.inlineEditorWrap}>
      <TextInput
        value={value}
        onChangeText={(nextValue) => onChangeField(path, nextValue)}
        multiline={multiline}
        scrollEnabled={false}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={displayValue}
        placeholderTextColor="rgba(92,64,51,0.38)"
        style={[
          style,
          styles.inlineEditorInput,
          multiline && styles.inlineEditorInputMultiline,
          textAlign === 'center' && styles.inlineEditorInputCentered,
        ]}
      />
    </View>
  );
}

export function PaywallPlansExperience({
  prices,
  billingLabel,
  storeProvider,
  isTrialExpired,
  content,
  allowClose = true,
  previewOnly = false,
  editable = false,
  useInternalScrollView = true,
  showAppleEula = true,
  visiblePurchaseError,
  pendingAction = null,
  isPurchaseActionDisabled = false,
  onChangeField,
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

  const plans = useMemo(
    () => content ?? clonePaywallPlansContent(DEFAULT_PAYWALL_CONTENT.plans),
    [content],
  );

  const enabledTiers = useMemo(() => {
    const visible = TIER_ORDER.filter((id) => plans.tiers[id].visible);
    return visible.length > 0 ? visible : TIER_ORDER;
  }, [plans]);

  // Im Editor bleiben ausgeblendete Pläne (gedimmt) sichtbar, damit ihre
  // Texte weiterhin bearbeitet werden können.
  const renderedTiers = editable ? TIER_ORDER : enabledTiers;

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(
    enabledTiers[0],
  );
  const [interval, setInterval] = useState<SubscriptionInterval>('yearly');
  const selectPulse = React.useState(() => new Animated.Value(1))[0];

  // Fällt automatisch auf den ersten sichtbaren Plan zurück, wenn der
  // gewählte Plan ausgeblendet wurde.
  const tier = enabledTiers.includes(selectedTier)
    ? selectedTier
    : enabledTiers[0];

  const showCloseButton = allowClose && !isTrialExpired;
  const purchaseDisabled =
    editable ||
    previewOnly ||
    isPurchaseActionDisabled ||
    pendingAction !== null;

  const templateVariables = useMemo(
    () => ({ storeProvider, billingLabel }),
    [storeProvider, billingLabel],
  );

  const resolveText = (value: string) =>
    applyPaywallPlansTemplate(value, templateVariables);

  const renderText = (
    path: string,
    rawValue: string,
    style: any,
    options?: { multiline?: boolean; textAlign?: 'left' | 'center' },
  ) => (
    <InlineEditableText
      editable={editable}
      path={path}
      value={rawValue}
      displayValue={resolveText(rawValue)}
      style={style}
      multiline={options?.multiline}
      textAlign={options?.textAlign}
      onChangeField={onChangeField}
    />
  );

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
    if (!enabledTiers.includes(nextTier) && !editable) return;
    if (nextTier !== tier) {
      setSelectedTier(nextTier);
      pulseSelection();
    }
  };

  const handleSelectInterval = (nextInterval: SubscriptionInterval) => {
    if (nextInterval !== interval) {
      setInterval(nextInterval);
      pulseSelection();
    }
  };

  const tierPrices = (tierId: PaywallPlansTierId) => {
    if (tierId === 'premium') {
      return { monthly: prices.premiumMonthly, yearly: prices.premiumYearly };
    }
    if (tierId === 'standard') {
      return { monthly: prices.standardMonthly, yearly: prices.standardYearly };
    }
    return { monthly: prices.liteMonthly, yearly: prices.liteYearly };
  };

  const yearlySavingsPercent = (monthly: number, yearly: number) => {
    if (monthly <= 0 || yearly <= 0) return 0;
    const full = monthly * 12;
    if (yearly >= full) return 0;
    return Math.round(((full - yearly) / full) * 100);
  };

  const tierSavings = (tierId: PaywallPlansTierId) => {
    const { monthly, yearly } = tierPrices(tierId);
    return yearlySavingsPercent(monthly.amount, yearly.amount);
  };

  const maxSavings = Math.max(...enabledTiers.map((id) => tierSavings(id)));

  const selectedPrice = useMemo(() => {
    const { monthly, yearly } = tierPrices(tier);
    return interval === 'yearly' ? yearly : monthly;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, prices, tier]);

  const perMonthLabel = (price: PaywallPlanPrice) =>
    price.amount > 0 ? `${formatEuroAmount(price.amount / 12)} / Monat` : '';

  const selectedTierContent = plans.tiers[tier];
  const ctaLabel =
    pendingAction === 'purchase'
      ? 'Einen Moment …'
      : `${resolveText(selectedTierContent.ctaLabel)} · ${selectedPrice.label}`;

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

  const renderTierCard = (cardTier: PaywallPlansTierId) => {
    const tierContent = plans.tiers[cardTier];
    const isPremium = cardTier === 'premium';
    const isSelected = tier === cardTier;
    const isHiddenInLive = !tierContent.visible;
    const { monthly, yearly } = tierPrices(cardTier);
    const price = interval === 'yearly' ? yearly : monthly;
    const savings = tierSavings(cardTier);

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
          editable && isHiddenInLive && styles.tierCardHidden,
        ]}
      >
        {isPremium ? (
          <View style={styles.popularBadge}>
            {renderText(
              'plans.popularBadge',
              plans.popularBadge,
              styles.popularBadgeText,
              { textAlign: 'center' },
            )}
          </View>
        ) : null}

        {editable && isHiddenInLive ? (
          <View style={styles.hiddenBadge}>
            <Text style={styles.hiddenBadgeText}>Ausgeblendet</Text>
          </View>
        ) : null}

        <View style={styles.tierHeaderRow}>
          <View style={styles.tierTitleWrap}>
            {renderText(
              `plans.tiers.${cardTier}.name`,
              tierContent.name,
              styles.tierName,
            )}
            {renderText(
              `plans.tiers.${cardTier}.tagline`,
              tierContent.tagline,
              styles.tierTagline,
              { multiline: true },
            )}
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
          {tierContent.bullets.map((item, index) => (
            <View key={`${cardTier}-bullet-${index}`} style={styles.tierBulletRow}>
              <View
                style={[
                  styles.tierBulletDot,
                  isPremium && styles.tierBulletDotPremium,
                ]}
              />
              <View style={styles.tierBulletTextWrap}>
                {renderText(
                  `plans.tiers.${cardTier}.bullets.${index}`,
                  item,
                  styles.tierBulletText,
                  { multiline: true },
                )}
              </View>
            </View>
          ))}
        </View>
      </Pressable>
    );
  };

  const compareTiers = editable ? TIER_ORDER : enabledTiers;
  const compareColumnOrder: PaywallPlansTierId[] = ['lite', 'standard', 'premium'];
  const compareColumns = compareColumnOrder.filter((id) =>
    compareTiers.includes(id),
  );

  const inner = (
    <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <View style={styles.brandBlock}>
          {renderText('plans.brandLogo', plans.brandLogo, styles.logo, {
            textAlign: 'center',
          })}
          {renderText('plans.brandSubtitle', plans.brandSubtitle, styles.logoSub, {
            textAlign: 'center',
          })}
        </View>
        {showCloseButton ? (
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        ) : (
          <View style={styles.topBarSpacer} />
        )}
      </View>

      {renderText('plans.headline', plans.headline, styles.headline, {
        multiline: true,
        textAlign: 'center',
      })}
      {renderText('plans.subline', plans.subline, styles.subline, {
        multiline: true,
        textAlign: 'center',
      })}

      <View style={styles.socialProofPill}>
        <Text style={styles.socialProofStars}>★★★★★</Text>
        {renderText(
          'plans.socialProofText',
          plans.socialProofText,
          styles.socialProofText,
        )}
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
        {renderedTiers.map((tierId) => renderTierCard(tierId))}
      </Animated.View>

      <Pressable
        onPress={() => onPurchase?.(tier, interval)}
        disabled={purchaseDisabled}
        style={[
          styles.ctaButton,
          purchaseDisabled && !editable && !previewOnly && styles.actionDisabled,
        ]}
      >
        <LinearGradient
          colors={tier === 'premium' ? ['#FFCFAE', '#FEB493'] : ['#FFE6C8', '#FFD2A5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
      </Pressable>
      {renderText('plans.ctaNote', plans.ctaNote, styles.ctaNote, {
        multiline: true,
        textAlign: 'center',
      })}

      {visiblePurchaseError ? (
        <Text style={styles.errorText}>{visiblePurchaseError}</Text>
      ) : null}

      <View style={styles.compareCard}>
        {renderText('plans.compareTitle', plans.compareTitle, styles.compareTitle)}
        <View style={styles.compareHeaderRow}>
          <View style={styles.compareLabelCell} />
          {compareColumns.map((columnTier) => (
            <Text
              key={columnTier}
              style={[
                styles.compareHeaderText,
                columnTier === 'premium' && styles.compareHeaderPremium,
              ]}
            >
              {columnTier === 'premium'
                ? 'Premium'
                : columnTier === 'standard'
                  ? 'Standard'
                  : 'Lite'}
            </Text>
          ))}
        </View>
        {plans.comparisonRows.map((row, index) => (
          <View
            key={`compare-row-${index}`}
            style={[
              styles.compareRow,
              index === plans.comparisonRows.length - 1 && styles.compareRowLast,
            ]}
          >
            <View style={styles.compareLabelWrap}>
              {renderText(
                `plans.comparisonRows.${index}.label`,
                row.label,
                styles.compareLabel,
                { multiline: true },
              )}
            </View>
            {compareColumns.map((columnTier) => (
              <React.Fragment key={`${index}-${columnTier}`}>
                {renderCheck(row[columnTier], columnTier === 'premium')}
              </React.Fragment>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.quoteCard}>
        {renderText('plans.quoteText', plans.quoteText, styles.quoteText, {
          multiline: true,
        })}
        {renderText('plans.quoteAuthor', plans.quoteAuthor, styles.quoteAuthor)}
      </View>

      <View style={styles.trustRow}>
        {plans.trustChips.map((item, index) => (
          <View key={`trust-chip-${index}`} style={styles.trustChip}>
            {renderText(
              `plans.trustChips.${index}`,
              item,
              styles.trustChipText,
            )}
          </View>
        ))}
      </View>

      <Pressable
        onPress={onRestorePress}
        hitSlop={8}
        disabled={purchaseDisabled && !editable}
        style={[
          styles.restoreButton,
          purchaseDisabled && !editable && !previewOnly && styles.actionDisabled,
        ]}
      >
        {pendingAction === 'restore' ? (
          <Text style={styles.restoreText}>Aktualisiere …</Text>
        ) : (
          renderText(
            'plans.restoreLabel',
            plans.restoreLabel,
            styles.restoreText,
            { textAlign: 'center' },
          )
        )}
      </Pressable>

      {showCloseButton || editable ? (
        <Pressable
          onPress={showCloseButton ? onClose : undefined}
          hitSlop={8}
          style={styles.cancelButton}
        >
          {renderText(
            'plans.cancelLabel',
            plans.cancelLabel,
            styles.cancelButtonText,
            { textAlign: 'center' },
          )}
        </Pressable>
      ) : null}

      {renderText('plans.legalText', plans.legalText, styles.legal, {
        multiline: true,
        textAlign: 'center',
      })}

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
  );

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

      {useInternalScrollView ? (
        <ScrollView
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.scrollInner}>{inner}</View>
      )}
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
  tierCardHidden: {
    opacity: 0.55,
    borderStyle: 'dashed',
    borderColor: 'rgba(114,83,74,0.4)',
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
  hiddenBadge: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(114,83,74,0.14)',
  },
  hiddenBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#72534A',
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
  tierBulletTextWrap: {
    flex: 1,
  },
  tierBulletText: {
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
    marginTop: 8,
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
  compareLabelWrap: {
    flex: 1,
    paddingRight: 8,
  },
  compareLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5F4346',
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
  inlineEditorWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(94,75,196,0.45)',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  inlineEditorInput: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  inlineEditorInputMultiline: {
    minHeight: 40,
  },
  inlineEditorInputCentered: {
    textAlign: 'center',
  },
});

export default PaywallPlansExperience;
