import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';

import { PaywallExperience } from '@/components/paywall/PaywallExperience';
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
import { getCachedUserProfile, invalidateUserProfileCache } from '@/lib/appCache';
import {
  DEFAULT_PAYWALL_CONTENT,
  PAYWALL_TEMPLATE_HINTS,
  clonePaywallContent,
  fetchPaywallContent,
  sanitizePaywallContent,
  savePaywallContent,
  type PaywallContent,
} from '@/lib/paywallContent';

type Mode = 'edit' | 'preview';

const pathSegmentToKey = (segment: string): string | number =>
  /^\d+$/.test(segment) ? Number(segment) : segment;

const setValueAtPath = (
  source: PaywallContent,
  path: string,
  value: string,
): PaywallContent => {
  const next = clonePaywallContent(source);
  const segments = path.split('.').map(pathSegmentToKey);
  let cursor: any = next;

  for (let index = 0; index < segments.length - 1; index += 1) {
    cursor = cursor?.[segments[index]];
    if (cursor === undefined || cursor === null) {
      return next;
    }
  }

  const lastSegment = segments[segments.length - 1];
  if (cursor && lastSegment !== undefined) {
    cursor[lastSegment] = value;
  }

  return sanitizePaywallContent(next);
};

export default function PaywallContentAdminScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const router = useRouter();
  const { session, user } = useAuth();

  const [mode, setMode] = useState<Mode>('edit');
  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<PaywallContent>(
    clonePaywallContent(DEFAULT_PAYWALL_CONTENT),
  );
  const [draft, setDraft] = useState<PaywallContent>(
    clonePaywallContent(DEFAULT_PAYWALL_CONTENT),
  );

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const billingLabel =
    Platform.OS === 'ios'
      ? 'Abrechnung über den App Store'
      : Platform.OS === 'android'
        ? 'Abrechnung über Google Play'
        : 'Abrechnung';

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedContent),
    [draft, savedContent],
  );
  const editorModeTitle =
    mode === 'edit' ? 'Inline-Editor' : 'Gerenderte Vorschau';
  const editorModeDescription =
    mode === 'edit'
      ? 'Tippe direkt auf einen Text in der Paywall und ändere ihn an Ort und Stelle.'
      : 'Hier siehst du die Paywall exakt so, wie Nutzer sie aktuell sehen.';
  const lastSavedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString('de-DE')
    : null;
  const saveStateTitle = hasUnsavedChanges ? 'Entwurf offen' : 'Alles gespeichert';
  const canSave = hasUnsavedChanges && !isSaving;
  const canRestoreSaved = hasUnsavedChanges && !isSaving;

  useEffect(() => {
    let mounted = true;

    const loadScreen = async () => {
      try {
        await invalidateUserProfileCache();
        const profile = await getCachedUserProfile();
        if (!mounted) return;

        const isCurrentUserAdmin = profile?.is_admin === true;
        setIsAdmin(isCurrentUserAdmin);

        if (!isCurrentUserAdmin) {
          return;
        }

        try {
          const record = await fetchPaywallContent();
          if (!mounted) return;
          const nextContent = sanitizePaywallContent(record.content);
          setSavedContent(clonePaywallContent(nextContent));
          setDraft(clonePaywallContent(nextContent));
          setLastSavedAt(record.updatedAt);
        } catch (error) {
          console.error('Failed to load paywall content:', error);
          if (!mounted) return;
          setSavedContent(clonePaywallContent(DEFAULT_PAYWALL_CONTENT));
          setDraft(clonePaywallContent(DEFAULT_PAYWALL_CONTENT));
          setSaveError(
            'Gespeicherte Texte konnten nicht geladen werden. Die Standardtexte sind aktiv.',
          );
        }
      } catch (error) {
        console.error('Failed to load paywall content admin screen:', error);
        if (!mounted) return;
        setIsAdmin(false);
      } finally {
        if (mounted) {
          setIsAuthorizing(false);
          setIsLoading(false);
        }
      }
    };

    if (!user) {
      setIsAdmin(false);
      setIsAuthorizing(false);
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    void loadScreen();

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleFieldChange = (path: string, value: string) => {
    setDraft((current) => setValueAtPath(current, path, value));
  };

  const restoreSavedContent = () => {
    setDraft(clonePaywallContent(savedContent));
    setSaveError(null);
  };

  const restoreDefaultContent = () => {
    Alert.alert(
      'Standardtexte laden',
      'Willst du wirklich alle Paywall-Texte auf die Standardversion zurücksetzen? Nicht gespeicherte Änderungen gehen dabei verloren.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: () => {
            setDraft(clonePaywallContent(DEFAULT_PAYWALL_CONTENT));
            setSaveError(null);
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const record = await savePaywallContent(draft, user.id);
      const nextContent = sanitizePaywallContent(record.content);
      setSavedContent(clonePaywallContent(nextContent));
      setDraft(clonePaywallContent(nextContent));
      setLastSavedAt(record.updatedAt);
      Alert.alert('Gespeichert', 'Die Paywall-Texte wurden aktualisiert.');
    } catch (error: any) {
      console.error('Failed to save paywall content:', error);
      setSaveError(
        error?.message ?? 'Die Paywall-Texte konnten nicht gespeichert werden.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        />

        <Header
          title="Paywall-Texte"
          subtitle="Direkt in der Paywall bearbeiten"
          showBackButton
          showBabySwitcher={false}
          onBackPress={() => router.push('/app-settings')}
        />

        {isAuthorizing || isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText style={[styles.stateText, { color: textSecondary }]}>
              Paywall-Konfiguration wird geladen…
            </ThemedText>
          </View>
        ) : !isAdmin ? (
          <View style={styles.centerState}>
            <IconSymbol name="lock.fill" size={22} color={textSecondary} />
            <ThemedText style={[styles.stateText, { color: textSecondary }]}>
              Dieser Bereich ist nur für Admins mit `profiles.is_admin = true`.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.pageScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <LiquidGlassCard
              style={styles.toolbarCard}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(255,255,255,0.86)',
                  'rgba(255,242,234,0.48)',
                  'rgba(255,255,255,0.18)',
                ]}
                start={{ x: 0.04, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.toolbarGlow}
              />

              <View style={styles.heroPanel}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroIcon}>
                    <IconSymbol
                      name={mode === 'edit' ? 'pencil.circle.fill' : 'sparkles'}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      hasUnsavedChanges
                        ? styles.statusBadgePending
                        : styles.statusBadgeSaved,
                    ]}
                  >
                    <IconSymbol
                      name={
                        hasUnsavedChanges ? 'clock.fill' : 'checkmark.circle.fill'
                      }
                      size={14}
                      color={hasUnsavedChanges ? '#7A4D3A' : '#5B715D'}
                    />
                    <ThemedText
                      style={[
                        styles.statusBadgeText,
                        hasUnsavedChanges
                          ? styles.statusBadgeTextPending
                          : styles.statusBadgeTextSaved,
                      ]}
                    >
                      {saveStateTitle}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.toolbarEyebrow}>
                  Paywall Studio
                </ThemedText>
                <ThemedText style={styles.toolbarTitle}>
                  {editorModeTitle}
                </ThemedText>
                <ThemedText style={styles.toolbarText}>
                  {editorModeDescription}
                </ThemedText>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoCard}>
                  <ThemedText style={styles.infoLabel}>
                    Zuletzt gespeichert
                  </ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {lastSavedLabel ?? 'Noch keine gespeicherte Version gefunden.'}
                  </ThemedText>
                </View>
                <View style={styles.infoCard}>
                  <ThemedText style={styles.infoLabel}>Workflow</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {mode === 'edit'
                      ? 'Texte direkt in der Oberfläche anfassen und sofort prüfen.'
                      : 'Sichere Ansicht zum Gegencheck, ohne Texte versehentlich zu verändern.'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    mode === 'edit' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setMode('edit')}
                >
                  <IconSymbol
                    name="pencil"
                    size={16}
                    color={mode === 'edit' ? '#FFFFFF' : '#7D5A50'}
                  />
                  <ThemedText
                    style={[
                      styles.segmentButtonText,
                      mode === 'edit' && styles.segmentButtonTextActive,
                    ]}
                  >
                    Direkt bearbeiten
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    mode === 'preview' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setMode('preview')}
                >
                  <IconSymbol
                    name="sparkles"
                    size={16}
                    color={mode === 'preview' ? '#FFFFFF' : '#7D5A50'}
                  />
                  <ThemedText
                    style={[
                      styles.segmentButtonText,
                      mode === 'preview' && styles.segmentButtonTextActive,
                    ]}
                  >
                    Vorschau
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.actionGrid}>
                <TouchableOpacity
                  style={[styles.primaryAction, !canSave && styles.actionDisabled]}
                  disabled={!canSave}
                  onPress={() => {
                    void handleSave();
                  }}
                >
                  <View style={styles.primaryActionIcon}>
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <IconSymbol
                        name="checkmark.circle.fill"
                        size={18}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <View style={styles.primaryActionCopy}>
                    <ThemedText style={styles.primaryActionTitle}>
                      {isSaving
                        ? 'Speichere Änderungen…'
                        : hasUnsavedChanges
                          ? 'Änderungen speichern'
                          : 'Alles ist gespeichert'}
                    </ThemedText>
                    <ThemedText style={styles.primaryActionHint}>
                      {hasUnsavedChanges
                        ? 'Übernimmt den aktuellen Entwurf direkt für die Live-Paywall.'
                        : 'Sobald du Texte änderst, kannst du sie hier sichern.'}
                    </ThemedText>
                  </View>
                </TouchableOpacity>

                <View style={styles.secondaryActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.utilityAction,
                      !canRestoreSaved && styles.actionDisabled,
                    ]}
                    disabled={!canRestoreSaved}
                    onPress={restoreSavedContent}
                  >
                    <View style={styles.utilityActionIcon}>
                      <IconSymbol
                        name="arrow.counterclockwise"
                        size={16}
                        color="#7D5A50"
                      />
                    </View>
                    <View style={styles.utilityActionCopy}>
                      <ThemedText style={styles.utilityActionTitle}>
                        Gespeicherten Stand laden
                      </ThemedText>
                      <ThemedText style={styles.utilityActionText}>
                        Lädt die letzte gespeicherte Version und verwirft den
                        aktuellen Entwurf.
                      </ThemedText>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.utilityAction, isSaving && styles.actionDisabled]}
                    disabled={isSaving}
                    onPress={restoreDefaultContent}
                  >
                    <View style={styles.utilityActionIcon}>
                      <IconSymbol
                        name="sparkles"
                        size={16}
                        color="#7D5A50"
                      />
                    </View>
                    <View style={styles.utilityActionCopy}>
                      <ThemedText style={styles.utilityActionTitle}>
                        Standardtexte laden
                      </ThemedText>
                      <ThemedText style={styles.utilityActionText}>
                        Setzt den Editor auf die Basisversion der Paywall zurück.
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.templateSection}>
                <View style={styles.templateSectionHeader}>
                  <View style={styles.templateSectionIcon}>
                    <IconSymbol name="sparkles" size={14} color="#7D5A50" />
                  </View>
                  <ThemedText style={styles.templateSectionTitle}>
                    Dynamische Platzhalter
                  </ThemedText>
                </View>
                <ThemedText style={styles.templateSectionText}>
                  Diese Tokens werden automatisch mit Trial-Days, Preisen oder
                  Store-Texten ersetzt.
                </ThemedText>
                <View style={styles.templateRow}>
                  {PAYWALL_TEMPLATE_HINTS.slice(0, 6).map((item) => (
                    <View key={item.token} style={styles.templateChip}>
                      <ThemedText style={styles.templateChipText}>
                        {`{{${item.token}}}`}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>

              {saveError ? (
                <View style={styles.errorCard}>
                  <IconSymbol
                    name="exclamationmark.triangle.fill"
                    size={15}
                    color="#B05D5D"
                  />
                  <ThemedText style={styles.errorText}>{saveError}</ThemedText>
                </View>
              ) : null}
            </LiquidGlassCard>

            <View style={styles.editorCanvas}>
              <PaywallExperience
                content={draft}
                billingLabel={billingLabel}
                isTrialExpired={false}
                allowClose={false}
                previewOnly
                editable={mode === 'edit'}
                useInternalScrollView={false}
                showAppleEula={mode === 'edit' || Platform.OS === 'ios'}
                onChangeField={mode === 'edit' ? handleFieldChange : undefined}
              />
            </View>
          </ScrollView>
        )}
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
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    paddingBottom: 28,
  },
  toolbarCard: {
    marginHorizontal: LAYOUT_PAD,
    marginTop: 12,
    borderRadius: 28,
    padding: 18,
    gap: 16,
    overflow: 'hidden',
  },
  toolbarGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  heroPanel: {
    borderRadius: 22,
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B6152',
    shadowColor: '#8B6152',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(233, 201, 182, 0.32)',
    borderColor: 'rgba(176, 123, 99, 0.20)',
  },
  statusBadgeSaved: {
    backgroundColor: 'rgba(216, 232, 219, 0.76)',
    borderColor: 'rgba(115, 148, 119, 0.22)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeTextPending: {
    color: '#7A4D3A',
  },
  statusBadgeTextSaved: {
    color: '#5B715D',
  },
  toolbarEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#A07E6E',
  },
  toolbarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5C4033',
  },
  toolbarText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#7D5A50',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#A07E6E',
  },
  infoValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#6A4A3D',
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(125, 90, 80, 0.10)',
  },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#7D5A50',
    shadowColor: '#7D5A50',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#7D5A50',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  actionGrid: {
    gap: 10,
  },
  primaryAction: {
    minHeight: 66,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#7D5A50',
    shadowColor: '#7D5A50',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 4,
  },
  primaryActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  primaryActionCopy: {
    flex: 1,
    gap: 3,
  },
  primaryActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  primaryActionHint: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.82)',
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  utilityAction: {
    flex: 1,
    minHeight: 96,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
  },
  utilityActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(125, 90, 80, 0.10)',
  },
  utilityActionCopy: {
    gap: 3,
  },
  utilityActionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6A4A3D',
  },
  utilityActionText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#8D6B61',
  },
  templateSection: {
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  templateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateSectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(125, 90, 80, 0.10)',
  },
  templateSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6A4A3D',
  },
  templateSectionText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#8D6B61',
  },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateChip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(233, 201, 182, 0.40)',
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6A4435',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(253, 233, 233, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(176, 93, 93, 0.18)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#B05D5D',
  },
  editorCanvas: {
    marginTop: 10,
    minHeight: 720,
  },
  actionDisabled: {
    opacity: 0.6,
  },
});
