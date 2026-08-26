import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import {
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
  LAYOUT_PAD,
  LiquidGlassCard,
} from '@/constants/DesignGuide';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getCachedUserProfile, invalidateUserProfileCache } from '@/lib/appCache';
import {
  DEFAULT_PAYWALL_CONTENT,
  fetchPaywallContent,
  isPaywallComparisonIncluded,
  type PaywallPlansContent,
} from '@/lib/paywallContent';
import { localizePaywallPlansContent } from '@/lib/paywallTranslations';
import {
  APP_FEATURES,
  cloneFeatureMatrix,
  FEATURE_ADMIN_COPY,
  getCurrentSubscriptionFeaturePolicy,
  publishSubscriptionFeaturePolicy,
  refreshSubscriptionFeaturePolicy,
  SUBSCRIPTION_TIERS,
  type AppFeature,
  type AppSubscriptionTier,
  type SubscriptionFeatureMatrix,
} from '@/lib/subscriptionFeaturePolicy';

type FeatureSection = 'baby' | 'ai' | 'pregnancy';
type FeatureFilter = 'paywall' | 'all' | FeatureSection;

const copyFor = (locale: string) =>
  locale === 'en'
    ? {
        title: 'Subscription features',
        subtitle: 'Control access without an app update',
        checking: 'Checking admin permissions …',
        adminsOnly: 'This section is for admins only.',
        heroEyebrow: 'LIVE ACCESS POLICY',
        heroTitle: 'One matrix for the entire app',
        explanation:
          'These are subscription feature groups, not individual pages. Each group shows every app area it controls.',
        version: 'Version',
        groups: 'Groups',
        serverRules: 'Server rules',
        live: 'Live from server',
        cache: 'Local cache',
        local: 'The cached policy is shown. Reload before publishing changes.',
        unsaved: 'Draft open',
        savedState: 'Everything published',
        save: 'Publish changes',
        saving: 'Publishing …',
        reset: 'Discard draft',
        error: 'Error',
        loadFailed: 'The current server policy could not be loaded. The cached version remains active.',
        saveFailed: 'The policy could not be published. Reload it and try again.',
        conflict: 'The policy changed elsewhere. Reload it before publishing again.',
        server: 'App + server',
        appOnly: 'App',
        areas: 'Controlled areas',
        alwaysIncluded: 'Always included',
        paywall: 'Paywall',
        paywallTitle: 'Exact paywall matrix',
        paywallDescription: 'Same rows, same order and the same access evaluation as the live paywall.',
        fixed: 'Always included',
        dynamic: 'Dynamic',
        standardHidden: 'Standard is a legacy plan and is hidden on the live paywall.',
        all: 'All',
        sectionBaby: 'Baby & family',
        sectionAi: 'AI & assistance',
        sectionPregnancy: 'Pregnancy',
        sectionBabyDescription: 'Everyday tools after birth and shared family organization',
        sectionAiDescription: 'Usage-sensitive features additionally protected by the backend',
        sectionPregnancyDescription: 'Features shown during pregnancy',
        liteHint: 'Basic',
        standardHint: 'Everyday',
        premiumHint: 'All features',
        discardTitle: 'Discard draft?',
        discardMessage: 'Your unpublished changes will be lost.',
        cancel: 'Cancel',
        discard: 'Discard',
        published: 'Policy published',
      }
    : locale === 'es'
      ? {
          title: 'Funciones de suscripción',
          subtitle: 'Controla el acceso sin actualizar la app',
          checking: 'Comprobando permisos de administrador …',
          adminsOnly: 'Esta sección es solo para administradores.',
          heroEyebrow: 'POLÍTICA DE ACCESO ACTIVA',
          heroTitle: 'Una matriz para toda la app',
          explanation:
            'Son grupos de funciones, no páginas individuales. Cada grupo muestra todas las áreas que controla.',
          version: 'Versión',
          groups: 'Grupos',
          serverRules: 'Reglas de servidor',
          live: 'En directo desde el servidor',
          cache: 'Caché local',
          local: 'Se muestra la política en caché. Recárgala antes de publicar cambios.',
          unsaved: 'Borrador abierto',
          savedState: 'Todo publicado',
          save: 'Publicar cambios',
          saving: 'Publicando …',
          reset: 'Descartar borrador',
          error: 'Error',
          loadFailed: 'No se pudo cargar la política del servidor. La versión en caché sigue activa.',
          saveFailed: 'No se pudo publicar. Recárgala e inténtalo de nuevo.',
          conflict: 'La política cambió en otro lugar. Recárgala antes de publicar.',
          server: 'App + servidor',
          appOnly: 'App',
          areas: 'Áreas controladas',
          alwaysIncluded: 'Siempre incluido',
          paywall: 'Paywall',
          paywallTitle: 'Matriz exacta del paywall',
          paywallDescription: 'Las mismas filas, el mismo orden y la misma evaluación que en el paywall activo.',
          fixed: 'Siempre incluido',
          dynamic: 'Dinámico',
          standardHidden: 'Standard es un plan anterior y está oculto en el paywall activo.',
          all: 'Todas',
          sectionBaby: 'Bebé y familia',
          sectionAi: 'IA y asistencia',
          sectionPregnancy: 'Embarazo',
          sectionBabyDescription: 'Herramientas cotidianas tras el nacimiento y organización familiar',
          sectionAiDescription: 'Funciones sensibles al uso, protegidas también por el backend',
          sectionPregnancyDescription: 'Funciones que aparecen durante el embarazo',
          liteHint: 'Básico',
          standardHint: 'Día a día',
          premiumHint: 'Todo',
          discardTitle: '¿Descartar el borrador?',
          discardMessage: 'Se perderán los cambios que aún no has publicado.',
          cancel: 'Cancelar',
          discard: 'Descartar',
          published: 'Política publicada',
        }
      : {
          title: 'Abo-Funktionen',
          subtitle: 'Zugriffe ohne App-Update steuern',
          checking: 'Admin-Rechte werden geprüft …',
          adminsOnly: 'Dieser Bereich ist nur für Admins.',
          heroEyebrow: 'LIVE-ZUGRIFFSPOLICY',
          heroTitle: 'Eine Matrix für die ganze App',
          explanation:
            'Hier stehen Funktionsgruppen, nicht einzelne Seiten. Bei jeder Gruppe siehst du alle App-Bereiche, die damit gesteuert werden.',
          version: 'Version',
          groups: 'Gruppen',
          serverRules: 'Server-Regeln',
          live: 'Live vom Server',
          cache: 'Lokaler Cache',
          local: 'Der Cache wird angezeigt. Vor dem Veröffentlichen bitte neu laden.',
          unsaved: 'Entwurf offen',
          savedState: 'Alles veröffentlicht',
          save: 'Änderungen veröffentlichen',
          saving: 'Wird veröffentlicht …',
          reset: 'Entwurf verwerfen',
          error: 'Fehler',
          loadFailed: 'Die Server-Policy konnte nicht geladen werden. Der Cache bleibt aktiv.',
          saveFailed: 'Die Policy konnte nicht veröffentlicht werden. Bitte neu laden und erneut versuchen.',
          conflict: 'Die Policy wurde anderswo geändert. Bitte vor dem Speichern neu laden.',
          server: 'App + Server',
          appOnly: 'App',
          areas: 'Gesteuerte Bereiche',
          alwaysIncluded: 'Immer enthalten',
          paywall: 'Paywall',
          paywallTitle: 'Exakte Paywall-Matrix',
          paywallDescription: 'Dieselben Zeilen, dieselbe Reihenfolge und exakt dieselbe Zugriffsauswertung wie auf der Live-Paywall.',
          fixed: 'Immer enthalten',
          dynamic: 'Dynamisch',
          standardHidden: 'Standard ist ein Bestandstarif und auf der Live-Paywall ausgeblendet.',
          all: 'Alle',
          sectionBaby: 'Baby & Familie',
          sectionAi: 'KI & Assistenz',
          sectionPregnancy: 'Schwangerschaft',
          sectionBabyDescription: 'Alltagsfunktionen nach der Geburt und gemeinsame Organisation',
          sectionAiDescription: 'Nutzungsintensive Funktionen mit zusätzlicher Server-Prüfung',
          sectionPregnancyDescription: 'Funktionen, die während der Schwangerschaft erscheinen',
          liteHint: 'Basis',
          standardHint: 'Alltag',
          premiumHint: 'Alles',
          discardTitle: 'Entwurf verwerfen?',
          discardMessage: 'Deine noch nicht veröffentlichten Änderungen gehen verloren.',
          cancel: 'Abbrechen',
          discard: 'Verwerfen',
          published: 'Policy veröffentlicht',
        };

const sameMatrix = (
  left: SubscriptionFeatureMatrix,
  right: SubscriptionFeatureMatrix,
) => JSON.stringify(left) === JSON.stringify(right);

const tierLabel = (tier: AppSubscriptionTier) =>
  tier === 'lite' ? 'Lite' : tier === 'standard' ? 'Standard' : 'Premium';

const tierPalette: Record<AppSubscriptionTier, string> = {
  lite: '#5E947F',
  standard: '#7659A7',
  premium: '#D27A4D',
};

export default function SubscriptionFeaturesAdminScreen() {
  const { locale } = useLocale();
  const c = copyFor(locale);
  const { session, user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = Colors[colorScheme];
  const textPrimary = isDark ? Colors.dark.textPrimary : '#4E382F';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const textMuted = isDark ? 'rgba(248,240,229,0.64)' : 'rgba(92,64,51,0.64)';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const cardSurface = isDark ? 'rgba(10,8,12,0.24)' : 'rgba(255,255,255,0.22)';
  const divider = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(92,64,51,0.10)';
  const isCompact = width < 390;

  const initialPolicy = useMemo(() => getCurrentSubscriptionFeaturePolicy(), []);
  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [filter, setFilter] = useState<FeatureFilter>('paywall');
  const [version, setVersion] = useState(initialPolicy.policyVersion);
  const [published, setPublished] = useState(() =>
    cloneFeatureMatrix(initialPolicy.features),
  );
  const [draft, setDraft] = useState(() =>
    cloneFeatureMatrix(initialPolicy.features),
  );
  const [paywallPlans, setPaywallPlans] = useState<PaywallPlansContent>(() =>
    DEFAULT_PAYWALL_CONTENT.plans,
  );
  const isDirty = !sameMatrix(draft, published);

  const localizedPaywallRows = useMemo(
    () => localizePaywallPlansContent(locale, paywallPlans).comparisonRows,
    [locale, paywallPlans],
  );
  const draftPolicy = useMemo(
    () => ({ ...initialPolicy, policyVersion: version, features: draft }),
    [draft, initialPolicy, version],
  );

  const serverRuleCount = useMemo(
    () => APP_FEATURES.filter((feature) => FEATURE_ADMIN_COPY[feature].serverEnforced).length,
    [],
  );

  const sectionDefinitions = useMemo(
    () => [
      {
        id: 'baby' as const,
        title: c.sectionBaby,
        description: c.sectionBabyDescription,
        icon: '👶',
      },
      {
        id: 'ai' as const,
        title: c.sectionAi,
        description: c.sectionAiDescription,
        icon: '✨',
      },
      {
        id: 'pregnancy' as const,
        title: c.sectionPregnancy,
        description: c.sectionPregnancyDescription,
        icon: '🤰',
      },
    ],
    [
      c.sectionAi,
      c.sectionAiDescription,
      c.sectionBaby,
      c.sectionBabyDescription,
      c.sectionPregnancy,
      c.sectionPregnancyDescription,
    ],
  );

  const filters = useMemo(
    () => [
      {
        id: 'paywall' as const,
        label: c.paywall,
        icon: '✓',
        count: localizedPaywallRows.length,
      },
      { id: 'all' as const, label: c.all, icon: '⊙', count: APP_FEATURES.length },
      ...sectionDefinitions.map((section) => ({
        id: section.id,
        label: section.title,
        icon: section.icon,
        count: APP_FEATURES.filter(
          (feature) => FEATURE_ADMIN_COPY[feature].section === section.id,
        ).length,
      })),
    ],
    [c.all, c.paywall, localizedPaywallRows.length, sectionDefinitions],
  );

  const loadPolicy = async () => {
    setIsLoading(true);
    try {
      const [policy, paywallRecord] = await Promise.all([
        refreshSubscriptionFeaturePolicy({ force: true }),
        fetchPaywallContent().catch((error) => {
          console.warn('Paywall rows could not be loaded for policy preview:', error);
          return null;
        }),
      ]);
      setVersion(policy.policyVersion);
      setPublished(cloneFeatureMatrix(policy.features));
      setDraft(cloneFeatureMatrix(policy.features));
      if (paywallRecord) setPaywallPlans(paywallRecord.content.plans);
      setIsCached(false);
    } catch (error) {
      console.warn('Subscription policy admin refresh failed:', error);
      const cached = getCurrentSubscriptionFeaturePolicy();
      setVersion(cached.policyVersion);
      setPublished(cloneFeatureMatrix(cached.features));
      setDraft(cloneFeatureMatrix(cached.features));
      setIsCached(true);
      Alert.alert(c.error, c.loadFailed);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const authorize = async () => {
      try {
        await invalidateUserProfileCache();
        const profile = await getCachedUserProfile();
        if (!mounted) return;
        const allowed = profile?.is_admin === true;
        setIsAdmin(allowed);
        if (allowed) void loadPolicy();
      } catch (error) {
        console.warn('Subscription policy admin authorization failed:', error);
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setIsAuthorizing(false);
      }
    };

    if (user) void authorize();
    return () => {
      mounted = false;
    };
    // loadPolicy uses module functions; a user change must re-check access.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggle = (
    feature: AppFeature,
    tier: AppSubscriptionTier,
    enabled: boolean,
  ) => {
    if (!FEATURE_ADMIN_COPY[feature].editable) return;
    setDraft((current) => ({
      ...current,
      [feature]: enabled
        ? SUBSCRIPTION_TIERS.filter(
            (candidate) =>
              candidate === tier || current[feature].includes(candidate),
          )
        : current[feature].filter((candidate) => candidate !== tier),
    }));
  };

  const resetDraft = () => setDraft(cloneFeatureMatrix(published));

  const goBack = () => {
    if (!isDirty) {
      router.push('/app-settings');
      return;
    }
    Alert.alert(c.discardTitle, c.discardMessage, [
      { text: c.cancel, style: 'cancel' },
      {
        text: c.discard,
        style: 'destructive',
        onPress: () => router.push('/app-settings'),
      },
    ]);
  };

  const reload = () => {
    if (!isDirty) {
      void loadPolicy();
      return;
    }
    Alert.alert(c.discardTitle, c.discardMessage, [
      { text: c.cancel, style: 'cancel' },
      { text: c.discard, style: 'destructive', onPress: () => void loadPolicy() },
    ]);
  };

  const save = async () => {
    if (!isDirty || isSaving || isCached) return;
    setIsSaving(true);
    try {
      const policy = await publishSubscriptionFeaturePolicy(version, draft);
      setVersion(policy.policyVersion);
      setPublished(cloneFeatureMatrix(policy.features));
      setDraft(cloneFeatureMatrix(policy.features));
      Alert.alert(c.published);
    } catch (error: any) {
      const message = String(error?.message ?? error);
      Alert.alert(
        c.error,
        message.includes('version conflict') ? c.conflict : c.saveFailed,
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={c.title}
          subtitle={c.subtitle}
          showBackButton
          showBabySwitcher={false}
          onBackPress={goBack}
        />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={reload}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          {isAuthorizing ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={[styles.stateText, { color: textSecondary }]}>
                {c.checking}
              </ThemedText>
            </View>
          ) : !isAdmin ? (
            <LiquidGlassCard
              style={styles.permissionCard}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <ThemedText style={styles.permissionIcon}>🔐</ThemedText>
              <ThemedText style={[styles.permissionTitle, { color: textPrimary }]}>
                {c.adminsOnly}
              </ThemedText>
            </LiquidGlassCard>
          ) : (
            <>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(91,58,125,0.82)', 'rgba(58,44,78,0.78)']
                    : ['#8E67B8', '#B17D9A']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.heroIcon}>
                    <ThemedText style={styles.heroIconText}>🧩</ThemedText>
                  </View>
                  <View style={styles.heroCopy}>
                    <ThemedText style={styles.heroEyebrow}>{c.heroEyebrow}</ThemedText>
                    <ThemedText style={styles.heroTitle}>{c.heroTitle}</ThemedText>
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={[styles.liveDot, isCached && styles.cacheDot]} />
                    <ThemedText style={styles.liveBadgeText}>
                      {isCached ? c.cache : c.live}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.heroDescription}>{c.explanation}</ThemedText>

                <View style={styles.metricsRow}>
                  {[
                    { value: version, label: c.version },
                    { value: APP_FEATURES.length, label: c.groups },
                    { value: serverRuleCount, label: c.serverRules },
                  ].map((metric) => (
                    <View key={metric.label} style={styles.metricCard}>
                      <ThemedText selectable style={styles.metricValue}>
                        {metric.value}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>{metric.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </LinearGradient>

              {isCached ? (
                <View style={styles.cacheNotice}>
                  <ThemedText style={styles.cacheNoticeIcon}>↻</ThemedText>
                  <ThemedText style={styles.cacheNoticeText}>{c.local}</ThemedText>
                  <TouchableOpacity onPress={reload} style={styles.cacheReloadButton}>
                    <ThemedText style={styles.cacheReloadText}>Reload</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {filters.map((item) => {
                  const selected = filter === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => setFilter(item.id)}
                      style={[
                        styles.filterChip,
                        { backgroundColor: cardSurface, borderColor: divider },
                        selected && styles.filterChipSelected,
                      ]}
                    >
                      <ThemedText style={styles.filterIcon}>{item.icon}</ThemedText>
                      <ThemedText
                        style={[
                          styles.filterLabel,
                          { color: textSecondary },
                          selected && styles.filterLabelSelected,
                        ]}
                      >
                        {item.label}
                      </ThemedText>
                      <View style={[styles.filterCount, selected && styles.filterCountSelected]}>
                        <ThemedText
                          style={[
                            styles.filterCountText,
                            selected && styles.filterCountTextSelected,
                          ]}
                        >
                          {item.count}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {filter === 'paywall' ? (
                <LiquidGlassCard
                  style={styles.paywallMatrixCard}
                  intensity={28}
                  overlayColor={glassOverlay}
                >
                  <View style={styles.paywallMatrixHeading}>
                    <View style={styles.paywallMatrixIcon}>
                      <ThemedText style={styles.paywallMatrixIconText}>✓</ThemedText>
                    </View>
                    <View style={styles.paywallMatrixHeadingCopy}>
                      <ThemedText style={[styles.paywallMatrixTitle, { color: textPrimary }]}>
                        {c.paywallTitle}
                      </ThemedText>
                      <ThemedText style={[styles.paywallMatrixDescription, { color: textSecondary }]}>
                        {c.paywallDescription}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.standardNotice, { borderColor: divider }]}>
                    <ThemedText style={styles.standardNoticeIcon}>ℹ</ThemedText>
                    <ThemedText style={[styles.standardNoticeText, { color: textSecondary }]}>
                      {c.standardHidden}
                    </ThemedText>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.matrixScrollContent}
                  >
                    <View style={styles.matrixTable}>
                      <View style={[styles.matrixHeaderRow, { borderBottomColor: divider }]}>
                        <View style={styles.matrixLabelCell} />
                        {SUBSCRIPTION_TIERS.map((tier) => (
                          <View key={tier} style={styles.matrixTierCell}>
                            <ThemedText
                              style={[styles.matrixTierHeader, { color: tierPalette[tier] }]}
                            >
                              {tierLabel(tier)}
                            </ThemedText>
                          </View>
                        ))}
                      </View>

                      {localizedPaywallRows.map((row, index) => {
                        const featureKey = row.featureKey;
                        const editable = featureKey
                          ? FEATURE_ADMIN_COPY[featureKey].editable
                          : false;
                        return (
                          <View
                            key={`${featureKey ?? 'fixed'}-${index}`}
                            style={[
                              styles.matrixRow,
                              { borderBottomColor: divider },
                              index % 2 === 1 && { backgroundColor: cardSurface },
                            ]}
                          >
                            <View style={styles.matrixLabelCell}>
                              <ThemedText
                                style={[styles.matrixLabel, { color: textPrimary }]}
                              >
                                {row.label}
                              </ThemedText>
                              <View
                                style={[
                                  styles.matrixSourceBadge,
                                  featureKey
                                    ? styles.matrixSourceBadgeDynamic
                                    : styles.matrixSourceBadgeFixed,
                                ]}
                              >
                                <ThemedText
                                  style={[
                                    styles.matrixSourceText,
                                    featureKey
                                      ? styles.matrixSourceTextDynamic
                                      : styles.matrixSourceTextFixed,
                                  ]}
                                >
                                  {featureKey ? c.dynamic : c.fixed}
                                </ThemedText>
                              </View>
                            </View>

                            {SUBSCRIPTION_TIERS.map((tier) => {
                              const included = isPaywallComparisonIncluded(
                                row,
                                tier,
                                draftPolicy,
                              );
                              return (
                                <View key={tier} style={styles.matrixTierCell}>
                                  {featureKey ? (
                                    <Switch
                                      value={included}
                                      disabled={!editable || isSaving}
                                      onValueChange={(value) =>
                                        toggle(featureKey, tier, value)
                                      }
                                      trackColor={{
                                        false: '#B8B1AD',
                                        true: tierPalette[tier],
                                      }}
                                      ios_backgroundColor="#B8B1AD"
                                      style={styles.matrixSwitch}
                                      accessibilityLabel={`${row.label}: ${tierLabel(tier)}`}
                                    />
                                  ) : (
                                    <View
                                      style={[
                                        styles.matrixStaticCheck,
                                        included
                                          ? styles.matrixStaticCheckIncluded
                                          : styles.matrixStaticCheckExcluded,
                                      ]}
                                    >
                                      <ThemedText
                                        style={[
                                          styles.matrixStaticCheckText,
                                          included
                                            ? styles.matrixStaticCheckTextIncluded
                                            : styles.matrixStaticCheckTextExcluded,
                                        ]}
                                      >
                                        {included ? '✓' : '–'}
                                      </ThemedText>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </LiquidGlassCard>
              ) : null}

              {sectionDefinitions
                .filter((section) => filter === 'all' || filter === section.id)
                .map((section) => {
                  const features = APP_FEATURES.filter(
                    (feature) => FEATURE_ADMIN_COPY[feature].section === section.id,
                  );
                  return (
                    <View key={section.id} style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconWrap}>
                          <ThemedText style={styles.sectionIcon}>{section.icon}</ThemedText>
                        </View>
                        <View style={styles.sectionCopy}>
                          <View style={styles.sectionTitleRow}>
                            <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                              {section.title}
                            </ThemedText>
                            <ThemedText style={[styles.sectionCount, { color: textMuted }]}>
                              {features.length}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                            {section.description}
                          </ThemedText>
                        </View>
                      </View>

                      {features.map((feature) => {
                        const copy = FEATURE_ADMIN_COPY[feature];
                        return (
                          <LiquidGlassCard
                            key={feature}
                            style={styles.featureCard}
                            intensity={26}
                            overlayColor={glassOverlay}
                          >
                            <View style={styles.featureHeader}>
                              <View style={[styles.featureIcon, { backgroundColor: cardSurface }]}>
                                <ThemedText style={styles.featureEmoji}>{copy.icon}</ThemedText>
                              </View>
                              <View style={styles.featureCopy}>
                                <ThemedText style={[styles.featureTitle, { color: textPrimary }]}>
                                  {copy.label}
                                </ThemedText>
                                <ThemedText style={[styles.featureDescription, { color: textSecondary }]}>
                                  {copy.description}
                                </ThemedText>
                              </View>
                              <View
                                style={[
                                  styles.enforcementBadge,
                                  copy.serverEnforced
                                    ? styles.enforcementBadgeServer
                                    : styles.enforcementBadgeApp,
                                ]}
                              >
                                <ThemedText
                                  style={[
                                    styles.enforcementText,
                                    copy.serverEnforced
                                      ? styles.enforcementTextServer
                                      : styles.enforcementTextApp,
                                  ]}
                                >
                                  {copy.serverEnforced ? c.server : c.appOnly}
                                </ThemedText>
                              </View>
                            </View>

                            <View style={styles.areasBlock}>
                              <ThemedText style={[styles.areasLabel, { color: textMuted }]}>
                                {c.areas}
                              </ThemedText>
                              <View style={styles.areaChips}>
                                {copy.areas.map((area) => (
                                  <View
                                    key={area}
                                    style={[
                                      styles.areaChip,
                                      { backgroundColor: cardSurface, borderColor: divider },
                                    ]}
                                  >
                                    <View style={styles.areaDot} />
                                    <ThemedText style={[styles.areaText, { color: textSecondary }]}>
                                      {area}
                                    </ThemedText>
                                  </View>
                                ))}
                              </View>
                            </View>

                            <View style={[styles.divider, { backgroundColor: divider }]} />

                            {!copy.editable ? (
                              <View style={styles.alwaysIncludedRow}>
                                <ThemedText style={styles.alwaysIncludedIcon}>✓</ThemedText>
                                <ThemedText style={[styles.alwaysIncludedText, { color: textSecondary }]}>
                                  {c.alwaysIncluded}
                                </ThemedText>
                              </View>
                            ) : null}

                            <View style={[styles.tierRow, isCompact && styles.tierRowCompact]}>
                              {SUBSCRIPTION_TIERS.map((tier) => {
                                const enabled = draft[feature].includes(tier);
                                const hint =
                                  tier === 'lite'
                                    ? c.liteHint
                                    : tier === 'standard'
                                      ? c.standardHint
                                      : c.premiumHint;
                                return (
                                  <View
                                    key={tier}
                                    style={[
                                      styles.tierControl,
                                      isCompact && styles.tierControlCompact,
                                      { backgroundColor: cardSurface, borderColor: divider },
                                      enabled && {
                                        borderColor: tierPalette[tier],
                                        backgroundColor: `${tierPalette[tier]}18`,
                                      },
                                      !copy.editable && styles.tierControlLocked,
                                    ]}
                                  >
                                    <View style={styles.tierCopy}>
                                      <ThemedText
                                        style={[
                                          styles.tierLabel,
                                          { color: enabled ? tierPalette[tier] : textPrimary },
                                        ]}
                                      >
                                        {tierLabel(tier)}
                                      </ThemedText>
                                      <ThemedText style={[styles.tierHint, { color: textMuted }]}>
                                        {hint}
                                      </ThemedText>
                                    </View>
                                    <Switch
                                      value={enabled}
                                      disabled={!copy.editable || isSaving}
                                      onValueChange={(value) => toggle(feature, tier, value)}
                                      trackColor={{ false: '#B8B1AD', true: tierPalette[tier] }}
                                      ios_backgroundColor="#B8B1AD"
                                      accessibilityLabel={`${copy.label}: ${tierLabel(tier)}`}
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          </LiquidGlassCard>
                        );
                      })}
                    </View>
                  );
                })}

              <LiquidGlassCard
                style={styles.actionCard}
                intensity={30}
                overlayColor={glassOverlay}
              >
                <View style={styles.actionStatus}>
                  <View
                    style={[
                      styles.actionStatusIcon,
                      isDirty ? styles.actionStatusIconDirty : styles.actionStatusIconSaved,
                    ]}
                  >
                    <ThemedText style={styles.actionStatusIconText}>
                      {isDirty ? '•' : '✓'}
                    </ThemedText>
                  </View>
                  <View style={styles.actionStatusCopy}>
                    <ThemedText style={[styles.actionStatusTitle, { color: textPrimary }]}>
                      {isDirty ? c.unsaved : c.savedState}
                    </ThemedText>
                    <ThemedText style={[styles.actionStatusVersion, { color: textMuted }]}>
                      {c.version} {version}
                    </ThemedText>
                  </View>
                </View>

                {isDirty ? (
                  <TouchableOpacity
                    style={[styles.resetButton, { borderColor: divider }]}
                    onPress={resetDraft}
                    disabled={isSaving}
                  >
                    <ThemedText style={[styles.resetText, { color: textSecondary }]}>
                      {c.reset}
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[
                    styles.saveButton,
                    (!isDirty || isSaving || isCached) && styles.saveButtonDisabled,
                  ]}
                  disabled={!isDirty || isSaving || isCached}
                  onPress={save}
                >
                  {isSaving ? <ActivityIndicator color="#FFFFFF" /> : null}
                  <ThemedText style={styles.saveText}>
                    {isSaving ? c.saving : c.save}
                  </ThemedText>
                </TouchableOpacity>
              </LiquidGlassCard>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1 },
  content: { padding: LAYOUT_PAD, paddingBottom: 54, gap: 20 },
  centerState: { alignItems: 'center', gap: 14, paddingVertical: 72 },
  stateText: { textAlign: 'center', fontSize: 15 },
  permissionCard: { padding: 28, alignItems: 'center', gap: 12 },
  permissionIcon: { fontSize: 38 },
  permissionTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    gap: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroIconText: { fontSize: 25 },
  heroCopy: { flex: 1, gap: 2 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.15,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: '800' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8FE0B5' },
  cacheDot: { backgroundColor: '#FFD38B' },
  liveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  heroDescription: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricCard: {
    flex: 1,
    minHeight: 66,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  metricValue: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 10, lineHeight: 13, marginTop: 2 },
  cacheNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(245,158,11,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
  },
  cacheNoticeIcon: { color: '#B76B00', fontSize: 21, fontWeight: '800' },
  cacheNoticeText: { flex: 1, color: '#9A5B08', fontSize: 12, lineHeight: 17 },
  cacheReloadButton: { paddingHorizontal: 8, paddingVertical: 6 },
  cacheReloadText: { color: '#9A5B08', fontSize: 12, fontWeight: '800' },
  filterRow: { gap: 9, paddingRight: 8 },
  filterChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
  },
  filterChipSelected: { backgroundColor: '#7455A5', borderColor: '#7455A5' },
  filterIcon: { fontSize: 14 },
  filterLabel: { fontSize: 13, fontWeight: '700' },
  filterLabelSelected: { color: '#FFFFFF' },
  filterCount: {
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(92,64,51,0.08)',
  },
  filterCountSelected: { backgroundColor: 'rgba(255,255,255,0.18)' },
  filterCountText: { color: '#7D5A50', fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] },
  filterCountTextSelected: { color: '#FFFFFF' },
  paywallMatrixCard: { padding: 16, gap: 14 },
  paywallMatrixHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  paywallMatrixIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(66,138,109,0.16)',
  },
  paywallMatrixIconText: { color: '#428A6D', fontSize: 19, fontWeight: '900' },
  paywallMatrixHeadingCopy: { flex: 1, gap: 2 },
  paywallMatrixTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  paywallMatrixDescription: { fontSize: 12, lineHeight: 17 },
  standardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: 'rgba(118,89,167,0.07)',
  },
  standardNoticeIcon: { color: '#7659A7', fontSize: 13, fontWeight: '900' },
  standardNoticeText: { flex: 1, fontSize: 10, lineHeight: 14 },
  matrixScrollContent: { paddingBottom: 2 },
  matrixTable: { width: 520 },
  matrixHeaderRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  matrixRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  matrixLabelCell: { width: 280, paddingHorizontal: 10, paddingVertical: 9, gap: 5 },
  matrixTierCell: { width: 80, alignItems: 'center', justifyContent: 'center' },
  matrixTierHeader: { fontSize: 11, fontWeight: '800' },
  matrixLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  matrixSourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  matrixSourceBadgeDynamic: { backgroundColor: 'rgba(118,89,167,0.12)' },
  matrixSourceBadgeFixed: { backgroundColor: 'rgba(66,138,109,0.12)' },
  matrixSourceText: { fontSize: 8, lineHeight: 10, fontWeight: '800' },
  matrixSourceTextDynamic: { color: '#7659A7' },
  matrixSourceTextFixed: { color: '#428A6D' },
  matrixSwitch: { transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }] },
  matrixStaticCheck: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixStaticCheckIncluded: { backgroundColor: 'rgba(66,138,109,0.14)' },
  matrixStaticCheckExcluded: { backgroundColor: 'rgba(125,90,80,0.08)' },
  matrixStaticCheckText: { fontSize: 14, fontWeight: '900' },
  matrixStaticCheckTextIncluded: { color: '#428A6D' },
  matrixStaticCheckTextExcluded: { color: '#9B8D87' },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142,78,198,0.11)',
  },
  sectionIcon: { fontSize: 21 },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionCount: { fontSize: 12, fontWeight: '800' },
  sectionDescription: { fontSize: 12, lineHeight: 17 },
  featureCard: { padding: 16, gap: 14 },
  featureHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: { fontSize: 22 },
  featureCopy: { flex: 1, gap: 3, paddingTop: 1 },
  featureTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  featureDescription: { fontSize: 12, lineHeight: 17 },
  enforcementBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  enforcementBadgeServer: { backgroundColor: 'rgba(48,145,102,0.14)' },
  enforcementBadgeApp: { backgroundColor: 'rgba(101,83,122,0.10)' },
  enforcementText: { fontSize: 9, lineHeight: 11, fontWeight: '800' },
  enforcementTextServer: { color: '#27805C' },
  enforcementTextApp: { color: '#6F587F' },
  areasBlock: { gap: 7 },
  areasLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65, textTransform: 'uppercase' },
  areaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 11,
    borderWidth: 1,
  },
  areaDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#9A78B8' },
  areaText: { fontSize: 10, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
  alwaysIncludedRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  alwaysIncludedIcon: { color: '#428A6D', fontSize: 13, fontWeight: '900' },
  alwaysIncludedText: { fontSize: 11, fontWeight: '700' },
  tierRow: { flexDirection: 'row', gap: 8 },
  tierRowCompact: { flexDirection: 'column' },
  tierControl: {
    flex: 1,
    minWidth: 0,
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tierControlCompact: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierControlLocked: { opacity: 0.72 },
  tierCopy: { gap: 1 },
  tierLabel: { fontSize: 12, fontWeight: '800' },
  tierHint: { fontSize: 9, lineHeight: 12 },
  actionCard: { padding: 16, gap: 12 },
  actionStatus: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionStatusIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionStatusIconDirty: { backgroundColor: 'rgba(210,122,77,0.16)' },
  actionStatusIconSaved: { backgroundColor: 'rgba(66,138,109,0.16)' },
  actionStatusIconText: { color: '#5E947F', fontSize: 17, fontWeight: '900' },
  actionStatusCopy: { flex: 1 },
  actionStatusTitle: { fontSize: 14, fontWeight: '800' },
  actionStatusVersion: { fontSize: 11, marginTop: 2 },
  resetButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { fontSize: 13, fontWeight: '700' },
  saveButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: '#D27A4D',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
