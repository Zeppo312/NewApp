import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useConvex } from '@/contexts/ConvexContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router, useLocalSearchParams } from 'expo-router';
import { buildInvitationLink, createInvitationLink, getUserInvitations, getLinkedUsers, deactivateAccountLink } from '@/lib/supabase';
import { redeemInvitationCodeFixed } from '@/lib/redeemInvitationCodeFixed';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LinkedBabySelectionModal } from '@/components/LinkedBabySelectionModal';
import { LiquidGlassCard, GLASS_OVERLAY, GLASS_OVERLAY_DARK, LAYOUT_PAD } from '@/constants/DesignGuide';
import { LockedFeatureScreen } from '@/components/LockedFeatureScreen';
import { useFeatureAccess } from '@/lib/entitlements';
import {
  DEFAULT_ACCOUNT_LINKING_LOCALE,
  getAccountLinkingLocaleTag,
  translateAccountLinkingText,
  type AccountLinkingTranslationKey,
} from '@/lib/accountLinkingTranslations';

type Invitation = {
  id: string;
  invitationCode: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string | Date;
  expiresAt: string | Date;
};

type LinkedUser = {
  linkId: string;
  firstName: string;
  lastName: string;
  userRole: 'mama' | 'papa' | string;
};

const ACCENT_PURPLE  = '#8E4EC6';
const ACCENT_MINT    = '#A8C4C1';
const ACCENT_ORANGE  = '#FF8C42';
const ACCENT_RED     = '#E06464';

const ACTIVE_ACCOUNT_LINKING_LOCALE = DEFAULT_ACCOUNT_LINKING_LOCALE;
const ACCOUNT_LINKING_LOCALE_TAG = getAccountLinkingLocaleTag(ACTIVE_ACCOUNT_LINKING_LOCALE);
const t = (
  key: AccountLinkingTranslationKey,
  params?: Record<string, string | number>,
) => translateAccountLinkingText(ACTIVE_ACCOUNT_LINKING_LOCALE, key, params);

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const lightenHex = (hex: string, amount = 0.35) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

// Abo-Gate: in Lotti Lite ist dieses Feature gesperrt (lib/entitlements.ts).
export default function AccountLinkingScreen() {
  const access = useFeatureAccess('partnerLink');

  if (access.hasAccess === null) return null;
  if (!access.hasAccess) {
    return <LockedFeatureScreen feature="partnerLink" />;
  }

  return <AccountLinkingScreenContent />;
}

function AccountLinkingScreenContent() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;

  const accentPurple = isDark ? lightenHex(ACCENT_PURPLE) : ACCENT_PURPLE;
  const accentMint = isDark ? lightenHex(ACCENT_MINT) : ACCENT_MINT;
  const accentOrange = isDark ? lightenHex(ACCENT_ORANGE) : ACCENT_ORANGE;
  const accentRed = isDark ? lightenHex(ACCENT_RED) : ACCENT_RED;

  const listItemBorderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)';
  const listItemBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.6)';
  const inputBorderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
  const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)';
  const inputTextColor = isDark ? Colors.dark.textPrimary : '#333';
  const inputPlaceholderColor = isDark ? 'rgba(240,230,220,0.7)' : '#9BA0A6';
  const sharePillBg = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.9)';
  const sharePillBorder = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)';
  const { user } = useAuth();
  const { refreshBabies } = useActiveBaby();
  const { refreshBabyDetails } = useBabyStatus();
  const { syncUser } = useConvex();
  const params = useLocalSearchParams<{ invitationCode?: string }>();
  const prefilledInvitationCode = typeof params.invitationCode === 'string'
    ? params.invitationCode.replace(/\s+/g, '').toUpperCase()
    : '';

  const [isLoading, setIsLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [invitationCode, setInvitationCode] = useState(prefilledInvitationCode);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [autoRedeemAttempted, setAutoRedeemAttempted] = useState(false);
  const [pendingBabySelection, setPendingBabySelection] = useState<{
    linkedUserId: string;
    linkedUserName?: string | null;
  } | null>(null);
  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'pending');

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setInvitations([]);
      setLinkedUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const invitationsResult = await getUserInvitations(user.id);
      if (invitationsResult.success) setInvitations(invitationsResult.invitations);

      const linkedUsersResult = await getLinkedUsers(user.id);
      if (linkedUsersResult.success) setLinkedUsers(linkedUsersResult.linkedUsers);
    } catch (error) {
      console.error('Error loading account linking data:', error);
      Alert.alert(t('common.error'), t('screen.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [loadData, user]);

  useEffect(() => {
    if (prefilledInvitationCode) {
      setInvitationCode(prefilledInvitationCode);
    }
  }, [prefilledInvitationCode]);

  const refreshLinkedBabyState = useCallback(async () => {
    await Promise.allSettled([
      loadData(),
      refreshBabies(),
      refreshBabyDetails(),
    ]);
    void syncUser();
  }, [loadData, refreshBabies, refreshBabyDetails, syncUser]);

  const handleCreateInvitation = async () => {
    if (!user?.id) {
      Alert.alert(t('common.error'), t('auth.signInAgain'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await createInvitationLink(user.id);
      if (result.success && result.invitationCode && result.invitationLink) {
        await Share.share({
          message: t('create.shareMessage', {
            code: result.invitationCode,
            link: result.invitationLink,
          }),
          title: t('create.shareTitle'),
        });
        await loadData();
        void syncUser();
      } else {
        Alert.alert(t('common.error'), t('create.failed'));
      }
    } catch (error) {
      console.error('Error creating invitation:', error);
      Alert.alert(t('common.error'), t('create.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const redeemInvitation = useCallback(async (rawCode: string, shouldShowSuccessAlert = true) => {
    if (!rawCode.trim()) {
      Alert.alert(t('common.error'), t('redeem.empty'));
      return;
    }
    const cleanedCode = rawCode.replace(/\s+/g, '').toUpperCase();

    setIsRedeeming(true);
    try {
      if (!user?.id) {
        Alert.alert(t('common.error'), t('auth.signInAgain'));
        return;
      }
      const result = await redeemInvitationCodeFixed(user.id, cleanedCode);
      if (result.success) {
        const creatorName = result.creatorInfo?.firstName || t('redeem.creatorFallback');
        setInvitationCode('');
        await refreshLinkedBabyState();

        if (result.linkedUserId) {
          setPendingBabySelection({
            linkedUserId: result.linkedUserId,
            linkedUserName: creatorName || null,
          });
          return;
        }

        if (shouldShowSuccessAlert) {
          Alert.alert(
            t('redeem.successTitle'),
            t('redeem.successMessage', { name: creatorName }),
          );
        }
      } else {
        const errorMessage = result.error?.message ||
          t('redeem.failed');
        Alert.alert(t('common.error'), errorMessage);
      }
    } catch (error: any) {
      console.error('Exception redeeming invitation:', error);
      Alert.alert(
        t('common.error'),
        t('redeem.unexpected', { message: error?.message ?? t('redeem.unknownError') }),
      );
    } finally {
      setIsRedeeming(false);
    }
  }, [refreshLinkedBabyState, setInvitationCode, setIsRedeeming, setPendingBabySelection, user]);

  const handleRedeemInvitation = async () => {
    await redeemInvitation(invitationCode, true);
  };

  useEffect(() => {
    if (!user?.id || !prefilledInvitationCode || autoRedeemAttempted || isRedeeming) {
      return;
    }

    setAutoRedeemAttempted(true);
    void redeemInvitation(prefilledInvitationCode, false);
  }, [autoRedeemAttempted, isRedeeming, prefilledInvitationCode, redeemInvitation, user?.id]);

  const performDeactivateLink = async (link: LinkedUser) => {
    if (!link?.linkId) return;
    setUnlinkingId(link.linkId);
    try {
      const result = await deactivateAccountLink(link.linkId);
      if (result.success) {
        Alert.alert(t('linked.unlinkedTitle'), t('linked.unlinkedMessage'));
        void loadData();
        void syncUser();
      } else {
        const errorMessage = result.error?.message || t('linked.unlinkFailed');
        Alert.alert(t('common.error'), errorMessage);
      }
    } catch (error) {
      console.error('Error deactivating account link:', error);
      Alert.alert(t('common.error'), t('linked.unlinkFailed'));
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleDeactivateLink = (link: LinkedUser) => {
    const displayName = [link.firstName, link.lastName].filter(Boolean).join(' ').trim() || t('linked.unnamedAccount');
    Alert.alert(
      t('linked.unlinkTitle'),
      t('linked.unlinkQuestion', { name: displayName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('linked.unlinkAction'),
          style: 'destructive',
          onPress: () => performDeactivateLink(link),
        },
      ]
    );
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString(ACCOUNT_LINKING_LOCALE_TAG, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getLinkedUserName = (linkedUser: LinkedUser) =>
    [linkedUser.firstName, linkedUser.lastName].filter(Boolean).join(' ').trim() || t('common.user');

  const getLinkedUserRole = (role: LinkedUser['userRole']) => {
    if (role === 'mama') return t('linked.roleMama');
    if (role === 'papa') return t('linked.rolePapa');
    return t('linked.roleUser');
  };

  const linkedCountLabel = t(
    linkedUsers.length === 1 ? 'hero.linkedCount.one' : 'hero.linkedCount.other',
    { count: linkedUsers.length },
  );
  const pendingCountLabel = t(
    pendingInvitations.length === 1 ? 'hero.pendingCount.one' : 'hero.pendingCount.other',
    { count: pendingInvitations.length },
  );

  return (
    <ThemedBackground style={[styles.background, isDark && styles.backgroundDark]}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Header
          title={t('screen.title')}
          subtitle={t('screen.subtitle')}
          showBackButton
          showBabySwitcher={false}
          onBackPress={() => router.back()}
        />

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <LiquidGlassCard style={styles.centerCard} intensity={26} overlayColor={glassOverlay}>
              <ActivityIndicator size="large" color={isDark ? adaptiveColors.accent : theme.accent} />
              <ThemedText style={[styles.loadingText, { color: textSecondary }]}>
                {t('screen.loading')}
              </ThemedText>
            </LiquidGlassCard>
          ) : (
            <>
              <LiquidGlassCard style={styles.heroCard} intensity={30} overlayColor={glassOverlay}>
                <View style={[styles.heroOrb, styles.heroOrbTop, { backgroundColor: toRgba(accentPurple, 0.16) }]} />
                <View style={[styles.heroOrb, styles.heroOrbBottom, { backgroundColor: toRgba(accentMint, 0.2) }]} />

                <View style={[styles.heroIcon, { backgroundColor: toRgba(accentPurple, isDark ? 0.24 : 0.14) }]}>
                  <IconSymbol name="person.2.fill" size={30} color={accentPurple} />
                </View>
                <ThemedText style={[styles.heroEyebrow, { color: accentPurple }]}>
                  {t('hero.eyebrow')}
                </ThemedText>
                <ThemedText style={[styles.heroTitle, { color: textPrimary }]}>
                  {t('hero.title')}
                </ThemedText>
                <ThemedText style={[styles.heroDescription, { color: textSecondary }]}>
                  {t('hero.description')}
                </ThemedText>

                <View style={styles.statusRow}>
                  <View style={[styles.statusPill, { backgroundColor: listItemBg, borderColor: listItemBorderColor }]}>
                    <IconSymbol name="link" size={15} color={accentPurple} />
                    <ThemedText style={[styles.statusText, { color: textPrimary }]}>
                      {linkedCountLabel}
                    </ThemedText>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: listItemBg, borderColor: listItemBorderColor }]}>
                    <IconSymbol name="envelope.fill" size={15} color={accentOrange} />
                    <ThemedText style={[styles.statusText, { color: textPrimary }]}>
                      {pendingCountLabel}
                    </ThemedText>
                  </View>
                </View>
              </LiquidGlassCard>

              <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: toRgba(accentPurple, isDark ? 0.22 : 0.12) }]}>
                    <IconSymbol name="paperplane.fill" size={20} color={accentPurple} />
                  </View>
                  <View style={styles.sectionHeadingText}>
                    <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                      {t('create.title')}
                    </ThemedText>
                    <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                      {t('create.description')}
                    </ThemedText>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCreateInvitation}
                  disabled={isLoading}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  style={[styles.primaryAction, { backgroundColor: accentPurple }]}
                >
                  <View style={styles.actionLabelRow}>
                    <IconSymbol name="plus" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.primaryActionText}>{t('create.button')}</ThemedText>
                  </View>
                  <View style={styles.actionArrowLight}>
                    <IconSymbol name="arrow.up.right" size={15} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                <View style={styles.hintRow}>
                  <IconSymbol name="lock.shield" size={13} color={textSecondary} />
                  <ThemedText style={[styles.hintText, { color: textSecondary }]}>
                    {t('create.hint')}
                  </ThemedText>
                </View>
              </LiquidGlassCard>

              <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: toRgba(accentMint, isDark ? 0.24 : 0.18) }]}>
                    <IconSymbol name="link" size={20} color={accentMint} />
                  </View>
                  <View style={styles.sectionHeadingText}>
                    <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                      {t('redeem.title')}
                    </ThemedText>
                    <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                      {t('redeem.description')}
                    </ThemedText>
                  </View>
                </View>

                <View
                  style={[
                    styles.inputShell,
                    { borderColor: inputBorderColor, backgroundColor: inputBg },
                  ]}
                >
                  <TextInput
                    style={[styles.inputGlass, { color: inputTextColor }]}
                    placeholder={t('redeem.placeholder')}
                    placeholderTextColor={inputPlaceholderColor}
                    value={invitationCode}
                    onChangeText={(value) => setInvitationCode(value.replace(/\s+/g, '').toUpperCase())}
                    onSubmitEditing={() => {
                      if (invitationCode.trim() && !isRedeeming) void handleRedeemInvitation();
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={8}
                    returnKeyType="done"
                    accessibilityLabel={t('redeem.accessibility')}
                  />
                  {invitationCode.length === 8 && (
                    <IconSymbol name="checkmark.circle.fill" size={22} color={accentMint} />
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleRedeemInvitation}
                  disabled={isRedeeming || !invitationCode.trim()}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  style={[
                    styles.primaryAction,
                    styles.redeemAction,
                    { backgroundColor: accentMint },
                    (isRedeeming || !invitationCode.trim()) && styles.actionDisabled,
                  ]}
                >
                  <View style={styles.actionLabelRow}>
                    {isRedeeming ? (
                      <ActivityIndicator color={textPrimary} />
                    ) : (
                      <IconSymbol name="checkmark" size={20} color={textPrimary} />
                    )}
                    <ThemedText style={[styles.primaryActionText, { color: textPrimary }]}>
                      {isRedeeming ? t('redeem.loading') : t('redeem.button')}
                    </ThemedText>
                  </View>
                  {!isRedeeming && (
                    <View style={[styles.actionArrowDark, { backgroundColor: toRgba(textPrimary, 0.1) }]}>
                      <IconSymbol name="chevron.right" size={15} color={textPrimary} />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.hintRow}>
                  <IconSymbol name="info.circle" size={13} color={textSecondary} />
                  <ThemedText style={[styles.hintText, { color: textSecondary }]}>
                    {t('redeem.hint')}
                  </ThemedText>
                </View>
              </LiquidGlassCard>

              {linkedUsers.length > 0 && (
                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <View style={styles.listHeader}>
                    <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                      {t('linked.title')}
                    </ThemedText>
                    <ThemedText style={[styles.listSubtitle, { color: textSecondary }]}>
                      {t('linked.subtitle')}
                    </ThemedText>
                  </View>

                  <View style={styles.list}>
                    {linkedUsers.map((u) => (
                      <View key={u.linkId} style={[styles.listItem, { backgroundColor: listItemBg, borderColor: listItemBorderColor }]}>
                        <View style={styles.listItemLeft}>
                          <View style={[styles.avatar, { backgroundColor: toRgba(accentPurple, 0.16), borderColor: listItemBorderColor }]}>
                            <IconSymbol name="person.fill" size={20} color={accentPurple} />
                          </View>
                          <View style={styles.listItemText}>
                            <ThemedText style={[styles.userName, { color: textPrimary }]}>
                              {getLinkedUserName(u)}
                            </ThemedText>
                            <ThemedText style={[styles.userRole, { color: textSecondary }]}>
                              {getLinkedUserRole(u.userRole)}
                            </ThemedText>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeactivateLink(u)}
                          disabled={unlinkingId === u.linkId}
                          accessibilityLabel={t('linked.unlinkAccessibility', { name: getLinkedUserName(u) })}
                          accessibilityRole="button"
                          style={[
                            styles.unlinkPill,
                            {
                              backgroundColor: isDark ? toRgba(accentRed, 0.18) : 'rgba(255,200,200,0.6)',
                              borderColor: listItemBorderColor,
                            },
                            unlinkingId === u.linkId && { opacity: 0.7 },
                          ]}
                        >
                          {unlinkingId === u.linkId ? (
                            <ActivityIndicator color={accentRed} />
                          ) : (
                            <IconSymbol name="xmark.circle.fill" size={18} color={accentRed} />
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </LiquidGlassCard>
              )}

              {pendingInvitations.length > 0 && (
                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={glassOverlay}>
                  <View style={styles.listHeader}>
                    <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>
                      {t('pending.title')}
                    </ThemedText>
                    <ThemedText style={[styles.listSubtitle, { color: textSecondary }]}>
                      {t('pending.subtitle')}
                    </ThemedText>
                  </View>

                  <View style={styles.list}>
                    {pendingInvitations.map((inv) => (
                        <View key={inv.id} style={[styles.listItem, { backgroundColor: listItemBg, borderColor: listItemBorderColor }]}>
                          <View style={styles.listItemLeft}>
                            <View style={[styles.avatar, { backgroundColor: toRgba(accentOrange, 0.14), borderColor: listItemBorderColor }]}>
                              <IconSymbol name="doc.on.doc" size={19} color={accentOrange} />
                            </View>
                            <View style={styles.listItemText}>
                              <ThemedText selectable style={[styles.invCode, { color: textPrimary }]}>
                                {t('pending.code', { code: inv.invitationCode })}
                              </ThemedText>
                              <ThemedText style={[styles.metaText, { color: textSecondary }]}>
                                {t('pending.created', { date: formatDate(inv.createdAt) })}
                              </ThemedText>
                              <ThemedText style={[styles.metaText, { color: textSecondary }]}>
                                {t('pending.expires', { date: formatDate(inv.expiresAt) })}
                              </ThemedText>
                            </View>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              void Share.share({
                                message: t('pending.shareMessage', {
                                  code: inv.invitationCode,
                                  link: buildInvitationLink(inv.invitationCode),
                                }),
                                title: t('pending.shareTitle'),
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('pending.shareAccessibility', { code: inv.invitationCode })}
                            style={[styles.sharePill, { backgroundColor: sharePillBg, borderColor: sharePillBorder }]}
                          >
                            <IconSymbol name="square.and.arrow.up" size={18} color={accentPurple} />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                </LiquidGlassCard>
              )}
            </>
          )}
        </ScrollView>

        <LinkedBabySelectionModal
          visible={Boolean(pendingBabySelection)}
          currentUserId={user?.id}
          linkedUserId={pendingBabySelection?.linkedUserId}
          linkedUserName={pendingBabySelection?.linkedUserName}
          locale={ACTIVE_ACCOUNT_LINKING_LOCALE}
          onApplied={async () => {
            setPendingBabySelection(null);
            await refreshLinkedBabyState();
            Alert.alert(t('baby.appliedTitle'), t('baby.appliedMessage'));
          }}
        />
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', backgroundColor: '#F5EEE0' },
  backgroundDark: { backgroundColor: Colors.dark.background },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 140,
    paddingTop: 12,
    gap: 16,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingVertical: 32,
    borderRadius: 26,
  },
  loadingText: { marginTop: 12, fontSize: 15, fontWeight: '600' },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  heroOrbTop: { top: -84, right: -52 },
  heroOrbBottom: { bottom: -104, left: -46 },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 7,
  },
  heroTitle: {
    maxWidth: 290,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroDescription: {
    maxWidth: 330,
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  statusRow: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  statusPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  sectionCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginBottom: 18,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadingText: { flex: 1, gap: 4 },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  redeemAction: { marginTop: 12 },
  actionDisabled: { opacity: 0.52 },
  actionLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  actionArrowLight: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  actionArrowDark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  hintText: { flex: 1, fontSize: 12, lineHeight: 17 },
  inputShell: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputGlass: {
    flex: 1,
    minHeight: 54,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.7,
  },
  listHeader: { gap: 4, marginBottom: 14 },
  listSubtitle: { fontSize: 13, lineHeight: 19 },
  list: { gap: 10 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    gap: 10,
  },
  listItemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  listItemText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  userName: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  userRole: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  invCode: { fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: 0.5 },
  metaText: { fontSize: 11, lineHeight: 16, marginTop: 1 },
  sharePill: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  unlinkPill: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
