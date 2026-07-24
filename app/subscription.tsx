import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';

import Header from '@/components/Header';
import { SubscriptionCancellationFeedbackModal } from '@/components/SubscriptionCancellationFeedbackModal';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import {
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
  LAYOUT_PAD,
  LiquidGlassCard,
} from '@/constants/DesignGuide';
import { useAuth } from '@/contexts/AuthContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { getCachedUserProfile } from '@/lib/appCache';
import {
  isPaywallAccessRole,
  type PaywallAccessRole,
} from '@/lib/paywallAccess';
import {
  getRevenueCatSubscriptionSummary,
  hasRevenueCatEntitlement,
  restoreRevenueCatPurchases,
  type RevenueCatPlanType,
  type SubscriptionTier,
} from '@/lib/revenuecat';
import {
  saveSubscriptionCancellationFeedback,
  type SubscriptionCancellationFeedbackReason,
} from '@/lib/subscriptionCancellationFeedback';
import {
  getSubscriptionManagementStoreLabel,
  openSubscriptionManagement,
} from '@/lib/subscriptionManagement';
import {
  DEFAULT_SUBSCRIPTION_LOCALE,
  getSubscriptionAccessRoleLabel,
  getSubscriptionLocaleTag,
  translateSubscriptionText,
  type SubscriptionTranslationKey,
} from '@/lib/subscriptionTranslations';

type SubscriptionViewState = {
  isAdmin: boolean;
  accessRole: PaywallAccessRole | null;
  isPremium: boolean;
  planType: RevenueCatPlanType | null;
  tier: SubscriptionTier | null;
  productId: string | null;
  expiresDate: string | null;
  willRenew: boolean | null;
};

const EMPTY_STATE: SubscriptionViewState = {
  isAdmin: false,
  accessRole: null,
  isPremium: false,
  planType: null,
  tier: null,
  productId: null,
  expiresDate: null,
  willRenew: null,
};

const ACTIVE_SUBSCRIPTION_LOCALE = DEFAULT_SUBSCRIPTION_LOCALE;
const t = (
  key: SubscriptionTranslationKey,
  params?: Record<string, string | number>,
) => translateSubscriptionText(ACTIVE_SUBSCRIPTION_LOCALE, key, params);

const formatDate = (date: string | null) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(
    getSubscriptionLocaleTag(ACTIVE_SUBSCRIPTION_LOCALE),
    { day: '2-digit', month: '2-digit', year: 'numeric' },
  ).format(parsed);
};

export default function SubscriptionScreen() {
  const adaptiveColors = useAdaptiveColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const [state, setState] = useState<SubscriptionViewState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const textTertiary = isDark ? Colors.dark.textTertiary : '#9C8178';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const dividerColor = isDark
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(125,90,80,0.10)';
  const softSurface = isDark
    ? 'rgba(255,255,255,0.07)'
    : 'rgba(255,255,255,0.42)';
  const iconAccentColor = isDark ? '#FFD0AE' : '#8E4EC6';
  const iconSecondaryColor = isDark
    ? 'rgba(255,255,255,0.86)'
    : '#9C8178';

  const loadState = useCallback(async () => {
    if (!user) {
      setState(EMPTY_STATE);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const profile = await getCachedUserProfile();
      if (profile?.is_admin === true) {
        setState({
          ...EMPTY_STATE,
          isAdmin: true,
          isPremium: true,
        });
        return;
      }

      const accessRole = isPaywallAccessRole(profile?.paywall_access_role)
        ? profile.paywall_access_role
        : null;
      if (accessRole) {
        setState({
          ...EMPTY_STATE,
          accessRole,
        });
        return;
      }

      const summary = await getRevenueCatSubscriptionSummary(user.id);
      const fallbackPremium = summary.isActive
        ? true
        : await hasRevenueCatEntitlement(user.id);

      setState({
        isAdmin: false,
        accessRole: null,
        isPremium: fallbackPremium,
        planType: summary.planType,
        tier: summary.tier,
        productId: summary.productId,
        expiresDate: summary.expiresDate,
        willRenew: summary.willRenew,
      });
    } catch (error) {
      console.error('Failed to load subscription state:', error);
      setState(EMPTY_STATE);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadState();
    }, [loadState]),
  );

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const continueToStoreManagement = async () => {
    setIsFeedbackModalVisible(false);
    await openSubscriptionManagement({
      failureTitle: t('alert.manageErrorTitle'),
      failureMessage: t('alert.manageErrorMessage'),
    });
  };

  const handleSubmitCancellationFeedback = async ({
    reason,
    details,
  }: {
    reason: SubscriptionCancellationFeedbackReason;
    details: string;
  }) => {
    if (!user) {
      await continueToStoreManagement();
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      await saveSubscriptionCancellationFeedback({
        userId: user.id,
        reason,
        details,
        source: 'subscription_screen',
        store: getSubscriptionManagementStoreLabel(),
        productId: state.productId,
        planType: state.planType,
        expiresAt: state.expiresDate,
        willRenew: state.willRenew,
      });
    } catch (error) {
      console.warn('Failed to save subscription cancellation feedback:', error);
    } finally {
      setIsSubmittingFeedback(false);
      await continueToStoreManagement();
    }
  };

  const handleRestore = async () => {
    if (!user) return;

    setIsRestoring(true);
    try {
      const restored = await restoreRevenueCatPurchases(user.id);
      if (!restored) {
        Alert.alert(
          t('alert.restoreNoneTitle'),
          t('alert.restoreNoneMessage'),
        );
      }
      await loadState();
    } catch (error) {
      console.error('Restore purchases failed:', error);
      Alert.alert(t('alert.errorTitle'), t('alert.restoreError'));
    } finally {
      setIsRestoring(false);
    }
  };

  const showPlans = () => {
    router.push({
      pathname: '/paywall',
      params: {
        next: '/subscription',
        origin: 'subscription-screen',
      },
    } as any);
  };

  const roleLabel = state.accessRole
    ? getSubscriptionAccessRoleLabel(
        ACTIVE_SUBSCRIPTION_LOCALE,
        state.accessRole,
      )
    : null;
  const intervalLabel =
    state.planType === 'monthly'
      ? t('plan.monthly')
      : state.planType === 'yearly'
        ? t('plan.yearly')
        : null;
  const tierLabel = state.tier ? t(`tier.${state.tier}`) : null;
  const planLabel = state.isAdmin
    ? t('plan.admin')
    : roleLabel
      ? t('plan.special', { role: roleLabel })
      : tierLabel && intervalLabel
        ? t('plan.withTier', { tier: tierLabel, interval: intervalLabel })
        : intervalLabel ?? (state.isPremium ? t('plan.active') : t('plan.none'));

  const statusLabel = state.isAdmin
    ? t('status.admin')
    : roleLabel
      ? t('status.special', { role: roleLabel })
      : state.isPremium
        ? t('status.subscription')
        : t('status.noSubscription');
  const detailLabel = state.isAdmin
    ? t('detail.admin')
    : roleLabel
      ? t('detail.special', { role: roleLabel })
      : state.isPremium
        ? state.willRenew === false
          ? t('detail.activeEnding')
          : t('detail.activeRenewing')
        : t('detail.inactive');

  const hasActiveAccess = state.isAdmin || !!state.accessRole || state.isPremium;
  const expirationLabel = formatDate(state.expiresDate);
  const canManageStore = state.isPremium && !state.isAdmin && !state.accessRole;
  const canRestore = !state.isAdmin && !state.accessRole;
  const showActions = canManageStore || canRestore;
  const renewalLabel =
    state.isAdmin || state.accessRole
      ? t('renewal.notApplicable')
      : state.willRenew === false
        ? t('renewal.ended')
        : state.isPremium
          ? t('renewal.automatic')
          : t('renewal.none');
  const statusColor = hasActiveAccess ? '#6F9F99' : '#C7835F';
  const statusSurface = hasActiveAccess
    ? isDark
      ? 'rgba(157,190,187,0.18)'
      : 'rgba(157,190,187,0.24)'
    : isDark
      ? 'rgba(233,201,182,0.16)'
      : 'rgba(233,201,182,0.34)';

  const renderSummaryRow = (
    icon: string,
    label: string,
    value: string,
    isLast = false,
  ) => (
    <View
      style={[
        styles.summaryRow,
        !isLast && { borderBottomColor: dividerColor, borderBottomWidth: 1 },
      ]}
    >
      <View style={[styles.summaryIcon, { backgroundColor: softSurface }]}>
        <IconSymbol name={icon} size={17} color={iconSecondaryColor} />
      </View>
      <ThemedText style={[styles.summaryLabel, { color: textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText
        selectable
        style={[styles.summaryValue, { color: textPrimary }]}
      >
        {value}
      </ThemedText>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />

          <Header
            title={t('screen.title')}
            subtitle={t('screen.subtitle')}
            showBackButton
            showBabySwitcher={false}
            onBackPress={() => router.push('/(tabs)/more')}
          />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
          >
            <LiquidGlassCard
              style={styles.statusCard}
              intensity={30}
              overlayColor={glassOverlay}
            >
              <View
                style={[
                  styles.statusAccent,
                  { backgroundColor: hasActiveAccess ? '#9DBEBB' : '#E9C9B6' },
                ]}
              />
              {isLoading ? (
                <View style={styles.loadingWrap}>
                  <View style={[styles.loadingIcon, { backgroundColor: softSurface }]}>
                    <ActivityIndicator color={iconAccentColor} />
                  </View>
                  <ThemedText style={[styles.loadingText, { color: textSecondary }]}>
                    {t('screen.loading')}
                  </ThemedText>
                </View>
              ) : (
                <>
                  <View style={styles.statusContent}>
                    <View style={styles.statusTopRow}>
                      <View
                        style={[
                          styles.statusIconWrap,
                          { backgroundColor: statusSurface },
                        ]}
                      >
                        <IconSymbol
                          name={
                            state.isAdmin
                              ? 'checkmark.seal.fill'
                              : state.accessRole
                                ? 'person.fill'
                                : state.isPremium
                                  ? 'star.fill'
                                  : 'lock.shield'
                          }
                          size={25}
                          color={hasActiveAccess ? '#6F9F99' : iconAccentColor}
                        />
                      </View>
                      <View style={styles.statusHeading}>
                        <ThemedText
                          style={[styles.eyebrow, { color: textTertiary }]}
                        >
                          {t('status.eyebrow')}
                        </ThemedText>
                        <ThemedText
                          selectable
                          style={[styles.planTitle, { color: textPrimary }]}
                        >
                          {planLabel}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: statusSurface },
                        ]}
                      >
                        <View
                          style={[styles.statusDot, { backgroundColor: statusColor }]}
                        />
                        <ThemedText
                          style={[styles.statusPillText, { color: statusColor }]}
                        >
                          {hasActiveAccess
                            ? t('status.active')
                            : t('status.inactive')}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.statusCopy}>
                      <ThemedText
                        style={[styles.statusTitle, { color: textPrimary }]}
                      >
                        {statusLabel}
                      </ThemedText>
                      <ThemedText
                        selectable
                        style={[styles.detailText, { color: textSecondary }]}
                      >
                        {detailLabel}
                      </ThemedText>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.summaryPanel,
                      { backgroundColor: softSurface, borderColor: dividerColor },
                    ]}
                  >
                    {renderSummaryRow(
                      'square.grid.2x2.fill',
                      t('summary.plan'),
                      planLabel,
                    )}
                    {renderSummaryRow(
                      'arrow.triangle.2.circlepath',
                      t('summary.renewal'),
                      renewalLabel,
                      !expirationLabel,
                    )}
                    {expirationLabel
                      ? renderSummaryRow(
                          'calendar',
                          state.willRenew === false
                            ? t('summary.accessUntil')
                            : t('summary.nextRenewal'),
                          expirationLabel,
                          true,
                        )
                      : null}
                  </View>
                </>
              )}
            </LiquidGlassCard>

            {!isLoading ? (
              <View style={styles.plansCard}>
                <LinearGradient
                  colors={isDark ? ['#493783', '#7655B8'] : ['#7052C7', '#9A72DD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.decorativeOrbLarge} />
                <View style={styles.decorativeOrbSmall} />
                <View style={styles.plansContent}>
                  <View style={styles.plansHeaderRow}>
                    <View style={styles.plansIconWrap}>
                      <IconSymbol name="sparkles" size={24} color="#FFD8B5" />
                    </View>
                    <ThemedText style={styles.plansEyebrow}>
                      {t('plans.eyebrow')}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.plansTitle}>
                    {hasActiveAccess
                      ? t('plans.title.active')
                      : t('plans.title.inactive')}
                  </ThemedText>
                  <ThemedText style={styles.plansDescription}>
                    {hasActiveAccess
                      ? t('plans.description.active')
                      : t('plans.description.inactive')}
                  </ThemedText>

                  <View style={styles.tierRow}>
                    {(['lite', 'standard', 'premium'] as const).map((tier) => (
                      <View key={tier} style={styles.tierPill}>
                        <View style={styles.tierDot} />
                        <ThemedText style={styles.tierText}>
                          {t(`tier.${tier}`)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.plansButton}
                    activeOpacity={0.84}
                    onPress={showPlans}
                  >
                    <LinearGradient
                      colors={['#FFF5EB', '#FFD6BC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <ThemedText style={styles.plansButtonText}>
                      {hasActiveAccess
                        ? t('plans.button.active')
                        : t('plans.button.inactive')}
                    </ThemedText>
                    <IconSymbol
                      name="arrow.right.circle.fill"
                      size={21}
                      color="#6748B5"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {!isLoading && showActions ? (
              <LiquidGlassCard
                style={styles.sectionCard}
                intensity={26}
                overlayColor={glassOverlay}
              >
                <View style={styles.sectionHeader}>
                  <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                    {t('actions.title')}
                  </ThemedText>
                </View>

                {canManageStore ? (
                  <TouchableOpacity
                    style={[styles.menuItem, { borderTopColor: dividerColor }]}
                    activeOpacity={0.78}
                    onPress={() => setIsFeedbackModalVisible(true)}
                  >
                    <View style={[styles.menuItemIcon, { backgroundColor: softSurface }]}>
                      <IconSymbol
                        name="creditcard.fill"
                        size={22}
                        color={iconAccentColor}
                      />
                    </View>
                    <View style={styles.menuItemContent}>
                      <ThemedText
                        style={[styles.menuItemTitle, { color: textPrimary }]}
                      >
                        {t('actions.manageTitle')}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.menuItemDescription,
                          { color: textSecondary },
                        ]}
                      >
                        {t('actions.manageDescription', {
                          store: getSubscriptionManagementStoreLabel(),
                        })}
                      </ThemedText>
                    </View>
                    <IconSymbol
                      name="chevron.right"
                      size={20}
                      color={iconSecondaryColor}
                    />
                  </TouchableOpacity>
                ) : null}

                {canRestore ? (
                  <TouchableOpacity
                    style={[styles.menuItem, { borderTopColor: dividerColor }]}
                    activeOpacity={0.78}
                    onPress={handleRestore}
                    disabled={isRestoring}
                  >
                    <View style={[styles.menuItemIcon, { backgroundColor: softSurface }]}>
                      {isRestoring ? (
                        <ActivityIndicator size="small" color={iconAccentColor} />
                      ) : (
                        <IconSymbol
                          name="arrow.clockwise"
                          size={22}
                          color={iconAccentColor}
                        />
                      )}
                    </View>
                    <View style={styles.menuItemContent}>
                      <ThemedText
                        style={[styles.menuItemTitle, { color: textPrimary }]}
                      >
                        {isRestoring
                          ? t('actions.restoring')
                          : t('actions.restore')}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.menuItemDescription,
                          { color: textSecondary },
                        ]}
                      >
                        {t('actions.restoreDescription')}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </LiquidGlassCard>
            ) : null}

            {!isLoading && !showActions ? (
              <LiquidGlassCard
                style={styles.sectionCard}
                intensity={26}
                overlayColor={glassOverlay}
              >
                <View style={styles.noteRow}>
                  <View style={[styles.menuItemIcon, { backgroundColor: softSurface }]}>
                    <IconSymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color="#7EAAA4"
                    />
                  </View>
                  <View style={styles.menuItemContent}>
                    <ThemedText
                      style={[styles.menuItemTitle, { color: textPrimary }]}
                    >
                      {t('note.title')}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.menuItemDescription,
                        { color: textSecondary },
                      ]}
                    >
                      {t('note.description')}
                    </ThemedText>
                  </View>
                </View>
              </LiquidGlassCard>
            ) : null}

            {!isLoading && state.productId ? (
              <LiquidGlassCard
                style={styles.technicalCard}
                intensity={22}
                overlayColor={glassOverlay}
              >
                <View style={styles.technicalHeader}>
                  <IconSymbol
                    name="info.circle"
                    size={17}
                    color={iconSecondaryColor}
                  />
                  <ThemedText
                    style={[styles.technicalTitle, { color: textSecondary }]}
                  >
                    {t('technical.title')}
                  </ThemedText>
                </View>
                <View style={styles.technicalRow}>
                  <ThemedText
                    style={[styles.technicalLabel, { color: textTertiary }]}
                  >
                    {t('technical.productId')}
                  </ThemedText>
                  <ThemedText
                    selectable
                    numberOfLines={2}
                    style={[styles.technicalValue, { color: textPrimary }]}
                  >
                    {state.productId}
                  </ThemedText>
                </View>
              </LiquidGlassCard>
            ) : null}
          </ScrollView>
        </SafeAreaView>

        <SubscriptionCancellationFeedbackModal
          visible={isFeedbackModalVisible}
          isSubmitting={isSubmittingFeedback}
          locale={ACTIVE_SUBSCRIPTION_LOCALE}
          onClose={() => setIsFeedbackModalVisible(false)}
          onSkip={() => void continueToStoreManagement()}
          onSubmit={(feedback) =>
            void handleSubmitCancellationFeedback(feedback)
          }
        />
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 14,
    paddingBottom: 64,
    gap: 16,
  },
  statusCard: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  statusAccent: {
    height: 4,
    width: '100%',
  },
  loadingWrap: {
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  statusContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 17,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusHeading: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.15,
  },
  planTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  statusPill: {
    minHeight: 30,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  statusCopy: {
    gap: 5,
    paddingBottom: 17,
  },
  statusTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryPanel: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  summaryIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  summaryValue: {
    flexShrink: 1,
    maxWidth: '54%',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'right',
  },
  plansCard: {
    minHeight: 315,
    borderRadius: 26,
    overflow: 'hidden',
    boxShadow: '0 10px 28px rgba(83, 57, 151, 0.24)',
  },
  decorativeOrbLarge: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.08)',
    right: -68,
    top: -82,
  },
  decorativeOrbSmall: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,216,181,0.10)',
    left: -32,
    bottom: -35,
  },
  plansContent: {
    padding: 22,
    gap: 12,
  },
  plansHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plansIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plansEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  plansTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  plansDescription: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 20,
  },
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierPill: {
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFD8B5',
  },
  tierText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  plansButton: {
    minHeight: 52,
    borderRadius: 17,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 9,
  },
  plansButtonText: {
    color: '#5D3FA9',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  sectionCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  menuItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: 1,
    gap: 12,
  },
  menuItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    gap: 2,
  },
  menuItemTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  menuItemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  noteRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  technicalCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  technicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 14,
    gap: 7,
  },
  technicalTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  technicalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
  },
  technicalLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  technicalValue: {
    flex: 2,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'right',
  },
});
