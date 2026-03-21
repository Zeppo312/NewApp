import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';

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
  getPaywallAccessRoleLabel,
  searchPaywallAccessUsers,
  setUserPaywallAccessRole,
  type PaywallAccessAdminUser,
  type PaywallAccessRole,
} from '@/lib/paywallAccess';

const ROLE_OPTIONS: { role: PaywallAccessRole | null; label: string }[] = [
  { role: null, label: 'Keine' },
  { role: 'tester', label: 'Tester' },
  { role: 'cooperation_partner', label: 'Kooperationspartner' },
];

export default function PaywallAccessAdminScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaywallAccessAdminUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const iconSecondaryColor = isDark ? 'rgba(255,255,255,0.9)' : theme.tabIconDefault;
  const trimmedQuery = query.trim();

  useEffect(() => {
    let mounted = true;

    const loadAdminState = async () => {
      try {
        await invalidateUserProfileCache();
        const profile = await getCachedUserProfile();
        if (!mounted) return;
        setIsAdmin(profile?.is_admin === true);
      } catch (error) {
        console.error('Failed to load admin state:', error);
        if (mounted) {
          setIsAdmin(false);
        }
      } finally {
        if (mounted) {
          setIsAuthorizing(false);
        }
      }
    };

    if (!user) {
      setIsAdmin(false);
      setIsAuthorizing(false);
      return () => {
        mounted = false;
      };
    }

    void loadAdminState();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      setResults([]);
      setSearchError(null);
      return;
    }

    if (trimmedQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const nextResults = await searchPaywallAccessUsers(trimmedQuery);
        if (cancelled) return;
        setResults(nextResults);
      } catch (error: any) {
        if (cancelled) return;
        console.error('Failed to search paywall access users:', error);
        setResults([]);
        setSearchError(
          error?.message ?? 'Nutzer konnten nicht geladen werden.',
        );
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isAdmin, trimmedQuery]);

  const handleRoleChange = async (
    targetUser: PaywallAccessAdminUser,
    role: PaywallAccessRole | null,
  ) => {
    if (!targetUser.has_profile) {
      Alert.alert(
        'Profil fehlt',
        'Für diesen Nutzer existiert noch kein Profil. Der Sonderzugang kann erst gesetzt werden, wenn ein Profil angelegt wurde.',
      );
      return;
    }

    if (targetUser.is_admin) {
      Alert.alert(
        'Admin-Zugang',
        'Für Admins ist kein zusätzlicher Paywall-Sonderzugang nötig.',
      );
      return;
    }

    setUpdatingUserId(targetUser.user_id);
    try {
      const updated = await setUserPaywallAccessRole(targetUser.user_id, role);
      setResults((current) =>
        current.map((item) =>
          item.user_id === updated.user_id
            ? { ...item, paywall_access_role: updated.paywall_access_role }
            : item,
        ),
      );
    } catch (error: any) {
      console.error('Failed to update paywall access role:', error);
      Alert.alert(
        'Fehler',
        error?.message ?? 'Die Rolle konnte nicht gespeichert werden.',
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const emptyStateText = useMemo(() => {
    if (trimmedQuery.length < 2) {
      return 'Suche nach E-Mail, Vorname, Nachname oder Username.';
    }
    if (isSearching) {
      return 'Suche läuft…';
    }
    if (searchError) {
      return searchError;
    }
    return 'Keine passenden Nutzer gefunden.';
  }, [isSearching, searchError, trimmedQuery.length]);

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
          title="Paywall-Zugänge"
          subtitle="Tester und Kooperationspartner verwalten"
          showBackButton
          showBabySwitcher={false}
          onBackPress={() => router.push('/app-settings')}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          <LiquidGlassCard
            style={styles.sectionCard}
            intensity={26}
            overlayColor={glassOverlay}
          >
            <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
              Nutzer suchen
            </ThemedText>
            <View
              style={[
                styles.searchInputWrap,
                { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(92,64,51,0.12)' },
              ]}
            >
              <IconSymbol
                name="magnifyingglass"
                size={18}
                color={iconSecondaryColor}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="E-Mail, Vorname, Nachname oder Username"
                placeholderTextColor={textSecondary}
                style={[styles.searchInput, { color: textPrimary }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isSearching ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : null}
            </View>
          </LiquidGlassCard>

          <LiquidGlassCard
            style={styles.sectionCard}
            intensity={26}
            overlayColor={glassOverlay}
          >
            {isAuthorizing ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={theme.accent} />
                <ThemedText style={[styles.stateText, { color: textSecondary }]}>
                  Admin-Rechte werden geprüft…
                </ThemedText>
              </View>
            ) : !isAdmin ? (
              <View style={styles.centerState}>
                <IconSymbol
                  name="lock.fill"
                  size={22}
                  color={iconSecondaryColor}
                />
                <ThemedText style={[styles.stateText, { color: textSecondary }]}>
                  Dieser Bereich ist nur für Admins mit `profiles.is_admin = true`.
                </ThemedText>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.centerState}>
                <ThemedText style={[styles.stateText, { color: textSecondary }]}>
                  {emptyStateText}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.resultList}>
                {results.map((item) => {
                  const isUpdating = updatingUserId === item.user_id;
                  const roleLabel = getPaywallAccessRoleLabel(item.paywall_access_role);
                  const isActionDisabled = isUpdating || !!item.is_admin || !item.has_profile;

                  return (
                    <View
                      key={item.user_id}
                      style={[
                        styles.resultCard,
                        {
                          borderColor: isDark
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(92,64,51,0.10)',
                        },
                      ]}
                    >
                      <View style={styles.resultHeader}>
                        <View style={styles.resultHeaderText}>
                          <ThemedText
                            style={[styles.resultName, { color: textPrimary }]}
                          >
                            {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.username || 'Unbenannt'}
                          </ThemedText>
                          <ThemedText
                            style={[styles.resultEmail, { color: textSecondary }]}
                          >
                            {item.email ?? 'Keine E-Mail'}
                          </ThemedText>
                        </View>
                        {isUpdating ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <View style={styles.chipWrap}>
                            {item.is_admin ? (
                              <View style={[styles.chip, styles.adminChip]}>
                                <ThemedText style={styles.adminChipText}>Admin</ThemedText>
                              </View>
                            ) : null}
                            <View style={[styles.chip, styles.roleChip]}>
                              <ThemedText style={styles.roleChipText}>{roleLabel}</ThemedText>
                            </View>
                          </View>
                        )}
                      </View>

                      <View style={styles.metaRow}>
                        {item.username ? (
                          <ThemedText style={[styles.metaText, { color: textSecondary }]}>
                            @{item.username}
                          </ThemedText>
                        ) : null}
                        {!item.has_profile ? (
                          <ThemedText style={[styles.metaWarning, { color: '#C25B5B' }]}>
                            Profil fehlt
                          </ThemedText>
                        ) : null}
                      </View>

                      <View style={styles.roleButtonRow}>
                        {ROLE_OPTIONS.map((option) => {
                          const isSelected = item.paywall_access_role === option.role;
                          return (
                            <TouchableOpacity
                              key={option.label}
                              style={[
                                styles.roleButton,
                                isSelected && styles.roleButtonActive,
                                isActionDisabled && styles.roleButtonDisabled,
                              ]}
                              disabled={isActionDisabled}
                              onPress={() => handleRoleChange(item, option.role)}
                            >
                              <ThemedText
                                style={[
                                  styles.roleButtonText,
                                  isSelected && styles.roleButtonTextActive,
                                ]}
                              >
                                {option.label}
                              </ThemedText>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </LiquidGlassCard>
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
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 26,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  centerState: {
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultList: {
    gap: 14,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  resultHeaderText: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
  },
  resultEmail: {
    fontSize: 13,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adminChip: {
    backgroundColor: '#F3D7A5',
  },
  adminChipText: {
    color: '#6A4B14',
    fontSize: 12,
    fontWeight: '700',
  },
  roleChip: {
    backgroundColor: '#E9C9B6',
  },
  roleChipText: {
    color: '#6A4435',
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaText: {
    fontSize: 12,
  },
  metaWarning: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: 'rgba(233, 201, 182, 0.22)',
  },
  roleButtonActive: {
    backgroundColor: '#7D5A50',
  },
  roleButtonDisabled: {
    opacity: 0.45,
  },
  roleButtonText: {
    color: '#7D5A50',
    fontSize: 13,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
});
