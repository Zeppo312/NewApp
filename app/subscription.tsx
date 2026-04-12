import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import Header from '@/components/Header';
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
import { useColorScheme } from '@/hooks/useColorScheme';
import { getCachedUserProfile } from '@/lib/appCache';
import {
  getPaywallAccessRoleLabel,
  isPaywallAccessRole,
  type PaywallAccessRole,
} from '@/lib/paywallAccess';
import {
  getRevenueCatSubscriptionSummary,
  hasRevenueCatEntitlement,
  restoreRevenueCatPurchases,
  type RevenueCatPlanType,
} from '@/lib/revenuecat';
import { openSubscriptionManagement } from '@/lib/subscriptionManagement';

type SubscriptionViewState = {
  isAdmin: boolean;
  accessRole: PaywallAccessRole | null;
  isPremium: boolean;
  planType: RevenueCatPlanType | null;
  productId: string | null;
  expiresDate: string | null;
  willRenew: boolean | null;
};

const EMPTY_STATE: SubscriptionViewState = {
  isAdmin: false,
  accessRole: null,
  isPremium: false,
  planType: null,
  productId: null,
  expiresDate: null,
  willRenew: null,
};

const formatDate = (date: string | null) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function SubscriptionScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const [state, setState] = useState<SubscriptionViewState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const iconAccentColor = isDark ? '#FFFFFF' : theme.accent;
  const iconSecondaryColor = isDark ? 'rgba(255,255,255,0.9)' : theme.tabIconDefault;

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
          isAdmin: true,
          accessRole: null,
          isPremium: true,
          planType: null,
          productId: null,
          expiresDate: null,
          willRenew: null,
        });
        return;
      }

      const accessRole = isPaywallAccessRole(profile?.paywall_access_role)
        ? profile.paywall_access_role
        : null;
      if (accessRole) {
        setState({
          isAdmin: false,
          accessRole,
          isPremium: false,
          planType: null,
          productId: null,
          expiresDate: null,
          willRenew: null,
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

  const openStoreManagement = async () => {
    await openSubscriptionManagement();
  };

  const handleRestore = async () => {
    if (!user) return;

    setIsRestoring(true);
    try {
      const restored = await restoreRevenueCatPurchases(user.id);
      if (!restored) {
        Alert.alert(
          'Kein Abo gefunden',
          'Es wurde kein aktives Abo zum Wiederherstellen gefunden.',
        );
      }
      await loadState();
    } catch (error) {
      console.error('Restore purchases failed:', error);
      Alert.alert('Fehler', 'Käufe konnten nicht wiederhergestellt werden.');
    } finally {
      setIsRestoring(false);
    }
  };

  const planLabel = state.isAdmin
    ? 'Admin-Zugang'
    : state.accessRole
      ? `${getPaywallAccessRoleLabel(state.accessRole)}-Zugang`
    : state.planType === 'monthly'
      ? 'Monatsabo'
      : state.planType === 'yearly'
        ? 'Jahresabo'
        : state.isPremium
          ? 'Aktives Abo'
          : 'Kein aktives Abo';

  const statusLabel = state.isAdmin
    ? 'Aktiv durch Admin-Rechte'
    : state.accessRole
      ? `Aktiv als ${getPaywallAccessRoleLabel(state.accessRole)}`
    : state.isPremium
      ? 'Abo aktiv'
      : 'Derzeit nicht aktiv';

  const detailLabel = state.isAdmin
    ? 'Du siehst den Zustand ohne Paywall. Store-Käufe sind im Admin-Modus nicht nötig.'
    : state.accessRole
      ? `Dieser Account umgeht die Paywall aktuell über den Sonderzugang "${getPaywallAccessRoleLabel(state.accessRole)}". Store-Käufe sind dafür nicht nötig.`
    : state.isPremium
      ? state.willRenew === false
        ? 'Dein Abo läuft aktuell, verlängert sich aber nicht automatisch.'
        : 'Dein Abo läuft und die App bleibt ohne Paywall nutzbar.'
      : 'Für die Nutzung von Lotti Baby brauchst du ein aktives Abo. Eine eventuelle kostenlose Apple-Testphase wird dir vor dem Kauf im Store angezeigt.';

  const hasActiveAccess = state.isAdmin || !!state.accessRole || state.isPremium;
  const expirationLabel = formatDate(state.expiresDate);
  const canManageStore = state.isPremium && !state.isAdmin && !state.accessRole;
  const canChoosePlan = !hasActiveAccess;
  const canRestore = !state.isAdmin && !state.accessRole;
  const showActions = canManageStore || canChoosePlan || canRestore;

  const statusDotColor = hasActiveAccess ? '#9DBEBB' : '#E9C9B6';
  const statusText = hasActiveAccess ? 'Aktiv' : 'Inaktiv';

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        />

        <Header
          title="Abo"
          subtitle="Status und Verwaltung deines Zugangs"
          showBackButton
          showBabySwitcher={false}
          onBackPress={() => router.push('/(tabs)/more')}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Status Card */}
          <LiquidGlassCard
            style={[styles.sectionCard, canChoosePlan && styles.sectionCardTinted]}
            intensity={26}
            overlayColor={glassOverlay}
          >
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={theme.accent} />
                <ThemedText
                  style={[styles.loadingText, { color: textSecondary }]}
                >
                  Abo-Status wird geladen…
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.statusHeader}>
                  <View style={styles.statusIconWrap}>
                    <IconSymbol
                      name={
                        (state.isAdmin
                          ? 'checkmark.shield.fill'
                          : state.accessRole
                            ? 'person.fill'
                            : state.isPremium
                              ? 'star.fill'
                              : 'lock.fill') as any
                      }
                      size={22}
                      color={iconAccentColor}
                    />
                  </View>
                  <View style={styles.statusHeaderText}>
                    <ThemedText
                      style={[styles.statusTitle, { color: textPrimary }]}
                    >
                      {planLabel}
                    </ThemedText>
                    <View style={styles.statusBadgeRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: statusDotColor },
                        ]}
                      />
                      <ThemedText
                        style={[styles.statusBadgeText, { color: textSecondary }]}
                      >
                        {statusText}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <ThemedText
                    style={[styles.statusSubtitle, { color: textPrimary }]}
                  >
                    {statusLabel}
                  </ThemedText>
                  <ThemedText
                    style={[styles.detailText, { color: textSecondary }]}
                  >
                    {detailLabel}
                  </ThemedText>
                </View>

                {/* Info-Zeilen */}
                <View style={styles.infoRows}>
                  <View style={styles.infoRow}>
                    <IconSymbol
                      name="square.grid.2x2.fill"
                      size={15}
                      color={iconSecondaryColor}
                    />
                    <ThemedText
                      style={[styles.infoLabel, { color: textSecondary }]}
                    >
                      Tarif
                    </ThemedText>
                    <ThemedText
                      style={[styles.infoValue, { color: textPrimary }]}
                    >
                      {planLabel}
                    </ThemedText>
                  </View>

                  <View style={styles.infoRow}>
                    <IconSymbol
                      name="arrow.triangle.2.circlepath"
                      size={15}
                      color={iconSecondaryColor}
                    />
                    <ThemedText
                      style={[styles.infoLabel, { color: textSecondary }]}
                    >
                      Verlängerung
                    </ThemedText>
                    <ThemedText
                      style={[styles.infoValue, { color: textPrimary }]}
                    >
                      {state.isAdmin
                        ? 'Nicht relevant'
                        : state.accessRole
                          ? 'Nicht relevant'
                          : state.willRenew === false
                            ? 'Beendet'
                            : state.isPremium
                              ? 'Automatisch'
                              : 'Keine'}
                    </ThemedText>
                  </View>

                  {expirationLabel ? (
                    <View style={styles.infoRow}>
                      <IconSymbol
                        name="calendar"
                        size={15}
                        color={iconSecondaryColor}
                      />
                      <ThemedText
                        style={[styles.infoLabel, { color: textSecondary }]}
                      >
                        Ablauf
                      </ThemedText>
                      <ThemedText
                        style={[styles.infoValue, { color: textPrimary }]}
                      >
                        {expirationLabel}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </LiquidGlassCard>

          {/* Hervorgehobener CTA wenn kein Abo */}
          {!isLoading && canChoosePlan ? (
            <View style={styles.ctaCard}>
              <LinearGradient
                colors={['#6B4FCE', '#8E6BE8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.ctaInner}>
                <View style={styles.ctaIconWrap}>
                  <IconSymbol name="star.fill" size={26} color="#FFD8B5" />
                </View>
                <ThemedText style={styles.ctaTitle}>
                  Lotti Baby freischalten
                </ThemedText>
                <ThemedText style={styles.ctaDescription}>
                  Wähle dein Abo und nutze alle Funktionen ohne Einschränkung weiter.
                </ThemedText>
                <TouchableOpacity
                  style={styles.ctaButton}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: '/paywall',
                      params: {
                        next: '/subscription',
                        origin: 'subscription-screen',
                      },
                    } as any)
                  }
                >
                  <LinearGradient
                    colors={['#FFCFAE', '#FEB493']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <ThemedText style={styles.ctaButtonText}>
                    Jetzt Abo auswählen
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Aktionen */}
          {!isLoading && showActions ? (
            <LiquidGlassCard
              style={[styles.sectionCard, canChoosePlan && styles.sectionCardTinted]}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                Aktionen
              </ThemedText>

              {canManageStore ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={openStoreManagement}
                >
                  <View style={styles.menuItemIcon}>
                    <IconSymbol
                      name="creditcard.fill"
                      size={24}
                      color={iconAccentColor}
                    />
                  </View>
                  <View style={styles.menuItemContent}>
                    <ThemedText
                      style={[styles.menuItemTitle, { color: textPrimary }]}
                    >
                      Abo verwalten
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.menuItemDescription,
                        { color: textSecondary },
                      ]}
                    >
                      Öffne deine Abo-Verwaltung im App Store oder Google Play
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
                  style={styles.menuItem}
                  onPress={handleRestore}
                  disabled={isRestoring}
                >
                  <View style={styles.menuItemIcon}>
                    <IconSymbol
                      name="arrow.clockwise"
                      size={24}
                      color={iconAccentColor}
                    />
                  </View>
                  <View style={styles.menuItemContent}>
                    <ThemedText
                      style={[styles.menuItemTitle, { color: textPrimary }]}
                    >
                      {isRestoring
                        ? 'Wird geprüft…'
                        : 'Käufe wiederherstellen'}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.menuItemDescription,
                        { color: textSecondary },
                      ]}
                    >
                      Prüft, ob bereits ein Abo in deinem Store-Konto vorhanden
                      ist
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ) : null}
            </LiquidGlassCard>
          ) : null}

          {/* Alles gut Card */}
          {!isLoading && !showActions ? (
            <LiquidGlassCard
              style={styles.sectionCard}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <View style={styles.noteRow}>
                <View style={styles.menuItemIcon}>
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={24}
                    color="#9DBEBB"
                  />
                </View>
                <View style={styles.menuItemContent}>
                  <ThemedText
                    style={[styles.menuItemTitle, { color: textPrimary }]}
                  >
                    Keine weiteren Schritte nötig
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.menuItemDescription,
                      { color: textSecondary },
                    ]}
                  >
                    Dein Zugang ist aktiv. Für diesen Account sind aktuell keine
                    weiteren Schritte nötig.
                  </ThemedText>
                </View>
              </View>
            </LiquidGlassCard>
          ) : null}

          {/* Technische Info */}
          {!isLoading && state.productId ? (
            <LiquidGlassCard
              style={styles.sectionCard}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                Technische Info
              </ThemedText>
              <View style={styles.infoRow}>
                <IconSymbol
                  name="info.circle"
                  size={15}
                  color={iconSecondaryColor}
                />
                <ThemedText
                  style={[styles.infoLabel, { color: textSecondary }]}
                >
                  Produkt-ID
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textPrimary }]}>
                  {state.productId}
                </ThemedText>
              </View>
            </LiquidGlassCard>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
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
    paddingTop: 10,
    paddingBottom: 56,
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sectionCardTinted: {
    borderWidth: 1,
    borderColor: 'rgba(107,79,206,0.15)',
    backgroundColor: 'rgba(107,79,206,0.04)',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  /* Status header */
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142,78,198,0.12)',
    marginRight: 14,
  },
  statusHeaderText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  /* Detail section */
  detailSection: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  statusSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  /* Info rows */
  infoRows: {
    paddingTop: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  /* Section title */
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  /* Menu items (same pattern as more.tsx) */
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  menuItemIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  /* CTA Card */
  ctaCard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#6B4FCE',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ctaInner: {
    padding: 24,
    alignItems: 'center',
  },
  ctaIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FDFBF6',
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaDescription: {
    fontSize: 14,
    color: 'rgba(253,251,246,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 300,
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#FEB493',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaButtonText: {
    color: '#5E3DB3',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  /* Note row */
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
