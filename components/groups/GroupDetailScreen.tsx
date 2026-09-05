/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { LAYOUT_PAD, RADIUS, LiquidGlassCard } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  type CommunityGroup,
  type GroupMemberProfile,
  type GroupUserSearchResult,
  getGroupDetails,
  getGroupMembers,
  inviteUserToGroup,
  joinPublicGroup,
  leaveGroup,
  respondToGroupInvite,
  searchProfilesForGroupInvite,
} from '@/lib/groups';
import {
  CommunityTranslationKey,
  DEFAULT_COMMUNITY_LOCALE,
  translateCommunityText,
} from '@/lib/communityTranslations';

let ACTIVE_COMMUNITY_LOCALE = DEFAULT_COMMUNITY_LOCALE;
const t = (key: CommunityTranslationKey, params?: Record<string, string | number>) =>
  translateCommunityText(ACTIVE_COMMUNITY_LOCALE, key, params);

// ── Pastel avatar palette (shared with hub) ──────────────────────
const AVATAR_LIGHT = [
  { bg: 'rgba(255, 223, 209, 0.92)', text: '#C87A5A' },
  { bg: 'rgba(255, 210, 224, 0.88)', text: '#C46B8A' },
  { bg: 'rgba(214, 236, 220, 0.88)', text: '#5E9470' },
  { bg: 'rgba(236, 224, 255, 0.88)', text: '#8B6EC2' },
  { bg: 'rgba(222, 238, 255, 0.92)', text: '#5A8AB5' },
  { bg: 'rgba(255, 239, 214, 0.92)', text: '#B8935A' },
];
const AVATAR_DARK = [
  { bg: 'rgba(255, 177, 138, 0.3)', text: '#FFB18A' },
  { bg: 'rgba(255, 133, 170, 0.3)', text: '#FF85AA' },
  { bg: 'rgba(150, 210, 178, 0.26)', text: '#96D2B2' },
  { bg: 'rgba(190, 156, 255, 0.28)', text: '#BE9CFF' },
  { bg: 'rgba(135, 192, 255, 0.26)', text: '#87C0FF' },
  { bg: 'rgba(255, 210, 137, 0.28)', text: '#FFD289' },
];

function avatarColor(name: string, dark: boolean) {
  const pal = dark ? AVATAR_DARK : AVATAR_LIGHT;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return pal[h % pal.length];
}

const GroupAvatar = ({ name, size = 46, isDark }: { name: string; size?: number; isDark: boolean }) => {
  const c = avatarColor(name, isDark);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText style={{ fontSize: size * 0.4, fontWeight: '800', color: c.text }}>
        {name.charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
};

// ── Main screen ──────────────────────────────────────────────────
export default function GroupDetailScreen() {
  ACTIVE_COMMUNITY_LOCALE = useLocale().locale;
  const { groupId } = useLocalSearchParams<{ groupId?: string | string[] }>();
  const resolvedGroupId = Array.isArray(groupId) ? groupId[0] : groupId;
  const router = useRouter();

  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = Colors[isDark ? 'dark' : 'light'];

  const primaryText = isDark ? theme.textPrimary : '#5C4033';
  const secondaryText = isDark ? theme.textSecondary : '#7D5A50';
  const tertiaryText = isDark ? theme.textTertiary : '#9C8178';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125,90,80,0.08)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#F9F5F1';

  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [members, setMembers] = useState<GroupMemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<GroupUserSearchResult[]>([]);
  const [searchingInvitees, setSearchingInvitees] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [processingInvite, setProcessingInvite] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const loadGroup = useCallback(async () => {
    if (!resolvedGroupId) {
      setLoading(false);
      return;
    }

    try {
      const { data: detail, error } = await getGroupDetails(resolvedGroupId);
      if (error) throw error;
      setGroup(detail);

      if (detail && (detail.visibility === 'public' || detail.is_member)) {
        const { data: memberData, error: membersError } = await getGroupMembers(resolvedGroupId);
        if (membersError) throw membersError;
        setMembers(memberData || []);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Failed to load group detail:', error);
      Alert.alert(t('common.group'), t('groups.detailLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [resolvedGroupId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadGroup();
    }, [loadGroup, resolvedGroupId]),
  );

  useEffect(() => {
    if (!loading && group?.is_member) {
      router.replace({
        pathname: '/group-chat/[groupId]',
        params: { groupId: group.id, from: 'groups' },
      } as any);
    }
  }, [group?.id, group?.is_member, loading, router]);

  useEffect(() => {
    if (!showInviteModal || !resolvedGroupId) return;

    const cleanedQuery = inviteQuery.trim();
    if (cleanedQuery.length < 2) {
      setInviteResults([]);
      setSearchingInvitees(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingInvitees(true);
      const { data, error } = await searchProfilesForGroupInvite(resolvedGroupId, cleanedQuery);
      setSearchingInvitees(false);

      if (error) {
        console.error('Failed to search invite candidates:', error);
        return;
      }

      setInviteResults(data || []);
    }, 250);

    return () => clearTimeout(timeout);
  }, [inviteQuery, resolvedGroupId, showInviteModal]);

  const canManageGroup =
    group?.current_user_role === 'owner' || group?.current_user_role === 'admin';
  const canLeaveGroup = !!group?.is_member && group.current_user_role !== 'owner';

  const handleJoinGroup = useCallback(async () => {
    if (!group) return;
    setJoining(true);
    const { error } = await joinPublicGroup(group.id);
    setJoining(false);

    if (error) {
      Alert.alert(t('common.group'), error instanceof Error ? error.message : t('groups.joinFailed'));
      return;
    }

    setLoading(true);
    await loadGroup();
  }, [group, loadGroup]);

  const handleRespondInvite = useCallback(
    async (accept: boolean) => {
      if (!group?.pending_invite_id) return;
      setProcessingInvite(true);
      const { error } = await respondToGroupInvite(group.pending_invite_id, accept);
      setProcessingInvite(false);

      if (error) {
        Alert.alert(
          t('common.invitation'),
          error instanceof Error
            ? error.message
            : t('groups.inviteFailed'),
        );
        return;
      }

      if (!accept) {
        router.back();
        return;
      }

      setLoading(true);
      await loadGroup();
    },
    [group?.pending_invite_id, loadGroup, router],
  );

  const handleInviteUser = useCallback(
    async (user: GroupUserSearchResult) => {
      if (!group) return;
      setInvitingUserId(user.id);
      const { error } = await inviteUserToGroup(group.id, user.id);
      setInvitingUserId(null);

      if (error) {
        Alert.alert(
          t('common.invite'),
          error instanceof Error ? error.message : t('groups.inviteSendFailed'),
        );
        return;
      }

      setInviteQuery('');
      setInviteResults([]);
      setShowInviteModal(false);
      Alert.alert(t('common.invitation'), t('groups.invitedSuccess', { name: user.display_name }));
    },
    [group],
  );

  const handleLeaveGroup = useCallback(async () => {
    if (!group) return;

    Alert.alert(t('groups.leaveTitle'), t('groups.leaveMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('groups.leave'),
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          const { error } = await leaveGroup(group.id);
          setLeaving(false);

          if (error) {
            Alert.alert(
              t('common.group'),
              error instanceof Error
                ? error.message
                : t('groups.leaveFailed'),
            );
            return;
          }

          router.replace('/(tabs)/groups' as any);
        },
      },
    ]);
  }, [group, router]);

  // ── Loading state ──
  if (loading) {
    return (
      <ThemedBackground style={styles.bg}>
        <ThemedView style={styles.screen}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#C89F81" />
            </View>
          </SafeAreaView>
        </ThemedView>
      </ThemedBackground>
    );
  }

  // ── Not found ──
  if (!group) {
    return (
      <ThemedBackground style={styles.bg}>
        <ThemedView style={styles.screen}>
          <SafeAreaView style={styles.safe}>
            <Header
              title={t('common.group')}
              showBackButton
              onBackPress={() => router.push('/(tabs)/groups' as any)}
              showBabySwitcher={false}
            />
            <View style={styles.emptyWrap}>
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: isDark
                      ? 'rgba(200,159,129,0.15)'
                      : 'rgba(200,159,129,0.1)',
                  },
                ]}
              >
                <IconSymbol name="person.2" size={28} color="#C89F81" />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: primaryText }]}>
                {t('groups.notFound')}
              </ThemedText>
            </View>
          </SafeAreaView>
        </ThemedView>
      </ThemedBackground>
    );
  }

  // ── Non-member view ──
  if (!group.is_member) {
    const isPrivate = group.visibility === 'private';

    return (
      <ThemedBackground style={styles.bg}>
        <ThemedView style={styles.screen}>
          <SafeAreaView style={styles.safe}>
            <Header
              title={group.name}
              showBackButton
              onBackPress={() => router.push('/(tabs)/groups' as any)}
              showBabySwitcher={false}
            />

            <ScrollView
              contentContainerStyle={styles.nonMemberScroll}
              showsVerticalScrollIndicator={false}
            >
              <LiquidGlassCard>
                <View style={styles.heroInner}>
                  <GroupAvatar name={group.name} size={64} isDark={isDark} />

                  <View
                    style={[
                      styles.heroBadge,
                      {
                        backgroundColor: isPrivate
                          ? 'rgba(214,84,65,0.1)'
                          : 'rgba(200,159,129,0.12)',
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.heroBadgeText,
                        { color: isPrivate ? '#D65441' : '#C89F81' },
                      ]}
                    >
                      {t(isPrivate ? 'common.private' : 'common.public')}
                    </ThemedText>
                  </View>

                  <View style={styles.heroMemberRow}>
                    <IconSymbol name="person.2.fill" size={13} color={tertiaryText} />
                    <ThemedText style={[styles.heroMemberText, { color: tertiaryText }]}>
                      {t((group.member_count || 0) === 1 ? 'groups.members.one' : 'groups.members.other', { count: group.member_count || 0 })}
                    </ThemedText>
                  </View>

                  {!!group.description && (
                    <ThemedText style={[styles.heroDesc, { color: secondaryText }]}>
                      {group.description}
                    </ThemedText>
                  )}

                  {group.pending_invite_id ? (
                    <View style={styles.heroActions}>
                      <TouchableOpacity
                        style={[styles.declineBtn, { borderColor: cardBorder }]}
                        onPress={() => handleRespondInvite(false)}
                        disabled={processingInvite}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={[styles.declineBtnText, { color: tertiaryText }]}>
                          {t('groups.decline')}
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleRespondInvite(true)}
                        disabled={processingInvite}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#D4A88C', '#C89F81']}
                          style={styles.acceptBtnGrad}
                        >
                          {processingInvite ? (
                            <ActivityIndicator color="#FFF" size="small" />
                          ) : (
                            <ThemedText style={styles.acceptBtnText}>
                              {t('groups.acceptInvitation')}
                            </ThemedText>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ) : group.visibility === 'public' ? (
                    <TouchableOpacity
                      style={styles.heroJoinBtn}
                      onPress={handleJoinGroup}
                      disabled={joining}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#D4A88C', '#C89F81']}
                        style={styles.heroJoinGrad}
                      >
                        {joining ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <ThemedText style={styles.heroJoinText}>{t('groups.join')}</ThemedText>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={[
                        styles.lockNotice,
                        { backgroundColor: inputBg, borderColor: cardBorder },
                      ]}
                    >
                      <IconSymbol name="lock.fill" size={14} color="#D65441" />
                      <ThemedText style={[styles.lockNoticeText, { color: secondaryText }]}>
                        {t('groups.privateNotice')}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </LiquidGlassCard>
            </ScrollView>
          </SafeAreaView>
        </ThemedView>
      </ThemedBackground>
    );
  }

  // ── Member redirect ──
  return (
    <>
      <ThemedBackground style={styles.bg}>
        <ThemedView style={styles.screen}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#C89F81" />
            </View>
          </SafeAreaView>
        </ThemedView>
      </ThemedBackground>

      {/* ── Settings modal ── */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalFlex}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSettingsModal(false)}
          />
          <View
            style={[
              styles.settingsSheet,
              {
                backgroundColor: isDark ? '#1E1916' : '#FFFAF5',
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.modalHandle}>
              <View
                style={[
                  styles.handleBar,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(125,90,80,0.15)',
                  },
                ]}
              />
            </View>

            <ThemedText style={[styles.settingsTitle, { color: primaryText }]}>
              {t('groups.settings')}
            </ThemedText>

            {/* Members info */}
            <View style={[styles.settingsRow, { borderColor: cardBorder }]}>
              <IconSymbol name="person.2.fill" size={18} color="#C89F81" />
              <ThemedText style={[styles.settingsRowText, { color: primaryText }]}>
                {t((members.length > 0 ? members.length : group.member_count || 0) === 1 ? 'groups.members.one' : 'groups.members.other', {
                  count: members.length > 0 ? members.length : group.member_count || 0,
                })}
              </ThemedText>
            </View>

            {/* Invite (private groups, admin only) */}
            {canManageGroup && group.visibility === 'private' && (
              <TouchableOpacity
                style={[styles.settingsRow, { borderColor: cardBorder }]}
                onPress={() => {
                  setShowSettingsModal(false);
                  setTimeout(() => setShowInviteModal(true), 300);
                }}
                activeOpacity={0.7}
              >
                <IconSymbol name="person.badge.plus" size={18} color="#C89F81" />
                <ThemedText style={[styles.settingsRowText, { color: primaryText }]}>
                  {t('groups.inviteMembers')}
                </ThemedText>
                <IconSymbol name="chevron.right" size={13} color={tertiaryText} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}

            {/* Leave group */}
            {canLeaveGroup && (
              <TouchableOpacity
                style={[styles.settingsRow, { borderColor: cardBorder }]}
                onPress={() => {
                  setShowSettingsModal(false);
                  handleLeaveGroup();
                }}
                disabled={leaving}
                activeOpacity={0.7}
              >
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#D65441" />
                <ThemedText style={[styles.settingsRowText, { color: '#D65441' }]}>
                  {t('groups.leaveTitle')}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Invite modal ── */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalFlex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: isDark ? '#1E1916' : '#FFFAF5',
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.modalHandle}>
                <View
                  style={[
                    styles.handleBar,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.2)'
                        : 'rgba(125,90,80,0.15)',
                    },
                  ]}
                />
              </View>

              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setShowInviteModal(false)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.modalCancel, { color: tertiaryText }]}>
                    {t('common.close')}
                  </ThemedText>
                </TouchableOpacity>
                <ThemedText style={[styles.modalTitle, { color: primaryText }]}>
                  {t('groups.inviteMembers')}
                </ThemedText>
                <View style={styles.modalPlaceholder} />
              </View>

              <TextInput
                value={inviteQuery}
                onChangeText={setInviteQuery}
                placeholder={t('groups.searchPeoplePlaceholder')}
                placeholderTextColor={tertiaryText}
                style={[
                  styles.searchInput,
                  {
                    color: primaryText,
                    backgroundColor: inputBg,
                    borderColor: cardBorder,
                  },
                ]}
              />

              <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
                {searchingInvitees ? (
                  <View style={styles.searchState}>
                    <ActivityIndicator size="small" color="#C89F81" />
                  </View>
                ) : inviteQuery.trim().length < 2 ? (
                  <View style={styles.searchState}>
                    <ThemedText style={[styles.searchHint, { color: tertiaryText }]}>
                      {t('groups.searchMinLength')}
                    </ThemedText>
                  </View>
                ) : inviteResults.length === 0 ? (
                  <View style={styles.searchState}>
                    <ThemedText style={[styles.searchHint, { color: tertiaryText }]}>
                      {t('groups.noPeopleFound')}
                    </ThemedText>
                  </View>
                ) : (
                  inviteResults.map((user) => (
                    <View key={user.id} style={[styles.userRow, { borderColor: cardBorder }]}>
                      <GroupAvatar name={user.display_name} size={36} isDark={isDark} />
                      <View style={styles.userMeta}>
                        <ThemedText style={[styles.userName, { color: primaryText }]}>
                          {user.display_name}
                        </ThemedText>
                        {!!user.username && (
                          <ThemedText style={[styles.userUsername, { color: tertiaryText }]}>
                            @{user.username}
                          </ThemedText>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleInviteUser(user)}
                        disabled={invitingUserId === user.id}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#D4A88C', '#C89F81']}
                          style={styles.userInviteGrad}
                        >
                          {invitingUserId === user.id ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <ThemedText style={styles.userInviteText}>{t('common.invite')}</ThemedText>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Empty / not found ──
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  // ── Non-member ──
  nonMemberScroll: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 32,
    paddingTop: 10,
  },
  heroInner: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  heroBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMemberText: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroDesc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 1,
  },
  acceptBtnGrad: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroJoinBtn: {
    width: '100%',
    marginTop: 8,
  },
  heroJoinGrad: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroJoinText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  lockNotice: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  lockNoticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  // ── Header buttons ──
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBtnBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 13,
  },

  // ── Settings modal ──
  settingsSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 4,
  },
  settingsTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsRowText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Modal ──
  modalFlex: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 14,
    maxHeight: '75%',
  },
  modalHandle: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCancel: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalPlaceholder: {
    width: 68,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  searchResults: {
    maxHeight: 360,
  },
  searchState: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHint: {
    fontSize: 14,
  },
  userRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  userMeta: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userUsername: {
    fontSize: 13,
  },
  userInviteGrad: {
    minHeight: 36,
    minWidth: 96,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  userInviteText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
