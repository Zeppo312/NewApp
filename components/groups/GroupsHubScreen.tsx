import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';

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
  type GroupInvite,
  createGroup,
  getDiscoverableGroups,
  getMyGroups,
  getPendingGroupInvites,
  joinPublicGroup,
  respondToGroupInvite,
} from '@/lib/groups';

// ── Pastel avatar palette ────────────────────────────────────────
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

// ── Group avatar ─────────────────────────────────────────────────
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

// ── Group card ───────────────────────────────────────────────────
const GroupCard = ({
  group,
  isDark,
  primaryText,
  secondaryText,
  tertiaryText,
  onOpen,
  onJoin,
  joining,
}: {
  group: CommunityGroup;
  isDark: boolean;
  primaryText: string;
  secondaryText: string;
  tertiaryText: string;
  onOpen: () => void;
  onJoin?: () => void;
  joining?: boolean;
}) => {
  const isPrivate = group.visibility === 'private';
  const roleName =
    group.current_user_role === 'owner'
      ? 'Besitzerin'
      : group.current_user_role === 'admin'
        ? 'Admin'
        : 'Mitglied';

  return (
    <LiquidGlassCard onPress={onOpen} activeOpacity={0.92}>
      <View style={styles.cardInner}>
        <GroupAvatar name={group.name} isDark={isDark} />
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <ThemedText style={[styles.cardTitle, { color: primaryText }]} numberOfLines={1}>
              {group.name}
            </ThemedText>
            <View
              style={[
                styles.visBadge,
                {
                  backgroundColor: isPrivate
                    ? 'rgba(214,84,65,0.1)'
                    : 'rgba(200,159,129,0.12)',
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.visBadgeText,
                  { color: isPrivate ? '#D65441' : '#C89F81' },
                ]}
              >
                {isPrivate ? 'Privat' : 'Öffentlich'}
              </ThemedText>
            </View>
          </View>

          {!!group.description && (
            <ThemedText
              style={[styles.cardDesc, { color: secondaryText }]}
              numberOfLines={2}
            >
              {group.description}
            </ThemedText>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.memberRow}>
              <IconSymbol name="person.2.fill" size={12} color={tertiaryText} />
              <ThemedText style={[styles.memberCount, { color: tertiaryText }]}>
                {group.member_count || 0} Mitglieder
              </ThemedText>
            </View>
            {group.is_member ? (
              <View
                style={[
                  styles.rolePill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(200,159,129,0.18)'
                      : 'rgba(200,159,129,0.12)',
                  },
                ]}
              >
                <ThemedText style={styles.roleText}>{roleName}</ThemedText>
              </View>
            ) : onJoin ? (
              <TouchableOpacity onPress={onJoin} disabled={joining} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#D4A88C', '#C89F81']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.joinPill}
                >
                  {joining ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <ThemedText style={styles.joinText}>Beitreten</ThemedText>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <IconSymbol name="chevron.right" size={13} color={tertiaryText} style={{ marginLeft: 2 }} />
      </View>
    </LiquidGlassCard>
  );
};

// ── Section header with count pill ───────────────────────────────
const SectionHeader = ({
  title,
  count,
  primaryText,
  tertiaryText,
  isDark,
}: {
  title: string;
  count?: number;
  primaryText: string;
  tertiaryText: string;
  isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <ThemedText style={[styles.sectionTitle, { color: primaryText }]}>{title}</ThemedText>
    {count != null && count > 0 && (
      <View
        style={[
          styles.countPill,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(125,90,80,0.08)',
          },
        ]}
      >
        <ThemedText style={[styles.countText, { color: tertiaryText }]}>{count}</ThemedText>
      </View>
    )}
  </View>
);

// ── Main screen ──────────────────────────────────────────────────
export default function GroupsHubScreen() {
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

  const [myGroups, setMyGroups] = useState<CommunityGroup[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<CommunityGroup[]>([]);
  const [pendingInvites, setPendingInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isPrivateGroup, setIsPrivateGroup] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [
        { data: mine, error: mineError },
        { data: discover, error: discoverError },
        { data: invites, error: inviteError },
      ] = await Promise.all([getMyGroups(), getDiscoverableGroups(), getPendingGroupInvites()]);

      if (mineError) throw mineError;
      if (discoverError) throw discoverError;
      if (inviteError) throw inviteError;

      setMyGroups(mine || []);
      setDiscoverGroups(discover || []);
      setPendingInvites(invites || []);
    } catch (error) {
      console.error('Failed to load groups hub data:', error);
      Alert.alert('Gruppen', 'Die Gruppen konnten gerade nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
    }, [loadData]),
  );

  const discoverable = useMemo(
    () => discoverGroups.filter((group) => !group.is_member),
    [discoverGroups],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const handleCreateGroup = useCallback(async () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      Alert.alert('Gruppen', 'Bitte gib einen Gruppennamen ein.');
      return;
    }

    setSavingGroup(true);
    const { data, error } = await createGroup({
      name: trimmedName,
      description: newGroupDescription,
      visibility: isPrivateGroup ? 'private' : 'public',
    });
    setSavingGroup(false);

    if (error || !data) {
      Alert.alert(
        'Gruppen',
        error instanceof Error ? error.message : 'Die Gruppe konnte nicht erstellt werden.',
      );
      return;
    }

    setShowCreateModal(false);
    setNewGroupName('');
    setNewGroupDescription('');
    setIsPrivateGroup(false);
    await loadData();
    router.push(`/groups/${data.id}` as any);
  }, [isPrivateGroup, loadData, newGroupDescription, newGroupName, router]);

  const handleJoinGroup = useCallback(
    async (group: CommunityGroup) => {
      setJoiningGroupId(group.id);
      const { error } = await joinPublicGroup(group.id);
      setJoiningGroupId(null);

      if (error) {
        Alert.alert('Gruppen', error instanceof Error ? error.message : 'Beitritt nicht möglich.');
        return;
      }

      await loadData();
      router.push(`/groups/${group.id}` as any);
    },
    [loadData, router],
  );

  const handleRespondInvite = useCallback(
    async (invite: GroupInvite, accept: boolean) => {
      setProcessingInviteId(invite.id);
      const { error, data } = await respondToGroupInvite(invite.id, accept);
      setProcessingInviteId(null);

      if (error) {
        Alert.alert(
          'Einladung',
          error instanceof Error
            ? error.message
            : 'Die Einladung konnte nicht verarbeitet werden.',
        );
        return;
      }

      await loadData();

      if (accept && data?.id) {
        router.push(`/groups/${data.id}` as any);
      }
    },
    [loadData, router],
  );

  return (
    <ThemedBackground style={styles.bg}>
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safe}>
          <Header
            title="Gruppen"
            subtitle={myGroups.length > 0 ? `${myGroups.length} Gruppen` : undefined}
            showBackButton
            onBackPress={() => router.push('/(tabs)/community')}
            showBabySwitcher={false}
          />

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#C89F81" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#C89F81"
                />
              }
            >
              {/* ── Pending invites ── */}
              {pendingInvites.length > 0 && (
                <View style={styles.section}>
                  <SectionHeader
                    title="Einladungen"
                    count={pendingInvites.length}
                    primaryText={primaryText}
                    tertiaryText={tertiaryText}
                    isDark={isDark}
                  />
                  {pendingInvites.map((invite) => (
                    <LiquidGlassCard key={invite.id}>
                      <View style={styles.inviteInner}>
                        <View style={styles.inviteTop}>
                          <GroupAvatar
                            name={invite.group?.name || 'Gruppe'}
                            size={42}
                            isDark={isDark}
                          />
                          <View style={styles.inviteInfo}>
                            <ThemedText
                              style={[styles.inviteName, { color: primaryText }]}
                              numberOfLines={1}
                            >
                              {invite.group?.name || 'Private Gruppe'}
                            </ThemedText>
                            <ThemedText style={[styles.inviteBy, { color: secondaryText }]}>
                              von {invite.invited_by_name || 'jemandem'}
                            </ThemedText>
                          </View>
                        </View>
                        <View style={styles.inviteActions}>
                          <TouchableOpacity
                            style={[styles.declineBtn, { borderColor: cardBorder }]}
                            onPress={() => handleRespondInvite(invite, false)}
                            disabled={processingInviteId === invite.id}
                            activeOpacity={0.8}
                          >
                            <ThemedText
                              style={[styles.declineBtnText, { color: tertiaryText }]}
                            >
                              Ablehnen
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleRespondInvite(invite, true)}
                            disabled={processingInviteId === invite.id}
                            activeOpacity={0.85}
                          >
                            <LinearGradient
                              colors={['#D4A88C', '#C89F81']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.acceptBtnGrad}
                            >
                              {processingInviteId === invite.id ? (
                                <ActivityIndicator color="#FFF" size="small" />
                              ) : (
                                <ThemedText style={styles.acceptBtnText}>Annehmen</ThemedText>
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </LiquidGlassCard>
                  ))}
                </View>
              )}

              {/* ── My groups ── */}
              <View style={styles.section}>
                <SectionHeader
                  title="Meine Gruppen"
                  count={myGroups.length}
                  primaryText={primaryText}
                  tertiaryText={tertiaryText}
                  isDark={isDark}
                />
                {myGroups.length > 0 ? (
                  myGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      isDark={isDark}
                      primaryText={primaryText}
                      secondaryText={secondaryText}
                      tertiaryText={tertiaryText}
                      onOpen={() => router.push(`/groups/${group.id}` as any)}
                    />
                  ))
                ) : (
                  <LiquidGlassCard>
                    <View style={styles.emptyInner}>
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
                        <IconSymbol name="person.2" size={24} color="#C89F81" />
                      </View>
                      <ThemedText style={[styles.emptyTitle, { color: primaryText }]}>
                        Noch keine Gruppen
                      </ThemedText>
                      <ThemedText style={[styles.emptyText, { color: secondaryText }]}>
                        Erstelle eine eigene Gruppe oder tritt einer{'\n'}öffentlichen Gruppe bei.
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                )}
              </View>

              {/* ── Discover ── */}
              <View style={styles.section}>
                <SectionHeader
                  title="Entdecken"
                  count={discoverable.length > 0 ? discoverable.length : undefined}
                  primaryText={primaryText}
                  tertiaryText={tertiaryText}
                  isDark={isDark}
                />
                {discoverable.length > 0 ? (
                  discoverable.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      isDark={isDark}
                      primaryText={primaryText}
                      secondaryText={secondaryText}
                      tertiaryText={tertiaryText}
                      onOpen={() => router.push(`/groups/${group.id}` as any)}
                      onJoin={() => handleJoinGroup(group)}
                      joining={joiningGroupId === group.id}
                    />
                  ))
                ) : (
                  <LiquidGlassCard>
                    <View style={styles.emptyInner}>
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
                        <IconSymbol name="sparkles" size={24} color="#C89F81" />
                      </View>
                      <ThemedText style={[styles.emptyTitle, { color: primaryText }]}>
                        Keine weiteren Gruppen
                      </ThemedText>
                      <ThemedText style={[styles.emptyText, { color: secondaryText }]}>
                        Du bist bereits in allen öffentlichen Gruppen{'\n'}oder es gibt noch keine
                        weiteren.
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                )}
              </View>
            </ScrollView>
          )}

          {/* ── FAB ── */}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#D4A88C', '#C89F81', '#B8907A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGrad}
            >
              <IconSymbol name="plus" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Create group modal ── */}
          <Modal
            visible={showCreateModal}
            animationType="slide"
            transparent
            onRequestClose={() => setShowCreateModal(false)}
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
                      onPress={() => setShowCreateModal(false)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.modalCancel, { color: tertiaryText }]}>
                        Abbrechen
                      </ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={[styles.modalTitle, { color: primaryText }]}>
                      Neue Gruppe
                    </ThemedText>
                    <View style={styles.modalPlaceholder} />
                  </View>

                  <TextInput
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                    placeholder="Gruppenname"
                    placeholderTextColor={tertiaryText}
                    style={[
                      styles.input,
                      {
                        color: primaryText,
                        backgroundColor: inputBg,
                        borderColor: cardBorder,
                      },
                    ]}
                  />

                  <TextInput
                    value={newGroupDescription}
                    onChangeText={setNewGroupDescription}
                    placeholder="Worum geht es in der Gruppe?"
                    placeholderTextColor={tertiaryText}
                    multiline
                    style={[
                      styles.input,
                      styles.textArea,
                      {
                        color: primaryText,
                        backgroundColor: inputBg,
                        borderColor: cardBorder,
                      },
                    ]}
                  />

                  <View
                    style={[
                      styles.visRow,
                      { borderColor: cardBorder, backgroundColor: inputBg },
                    ]}
                  >
                    <View style={styles.visTextWrap}>
                      <ThemedText style={[styles.visTitle, { color: primaryText }]}>
                        {isPrivateGroup ? 'Private Gruppe' : 'Öffentliche Gruppe'}
                      </ThemedText>
                      <ThemedText style={[styles.visHint, { color: secondaryText }]}>
                        {isPrivateGroup
                          ? 'Mitglieder treten nur per Einladung bei.'
                          : 'Jede Nutzerin kann direkt beitreten.'}
                      </ThemedText>
                    </View>
                    <Switch
                      value={isPrivateGroup}
                      onValueChange={setIsPrivateGroup}
                      trackColor={{
                        false: 'rgba(200,159,129,0.25)',
                        true: 'rgba(214,84,65,0.25)',
                      }}
                      thumbColor={isPrivateGroup ? '#D65441' : '#C89F81'}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.submitBtn, { opacity: savingGroup ? 0.7 : 1 }]}
                    onPress={handleCreateGroup}
                    disabled={savingGroup}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#D4A88C', '#C89F81']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitBtnGrad}
                    >
                      {savingGroup ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <ThemedText style={styles.submitBtnText}>Gruppe erstellen</ThemedText>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </SafeAreaView>
      </ThemedView>
    </ThemedBackground>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 36,
    gap: 24,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    right: LAYOUT_PAD,
    bottom: 28,
    zIndex: 10,
  },
  fabGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Sections ──
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  countPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Group card ──
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  visBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  visBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  memberCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  rolePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C89F81',
  },
  joinPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  joinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Invite cards ──
  inviteInner: {
    padding: 16,
    gap: 14,
  },
  inviteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteInfo: {
    flex: 1,
    gap: 2,
  },
  inviteName: {
    fontSize: 15,
    fontWeight: '700',
  },
  inviteBy: {
    fontSize: 13,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 1,
  },
  acceptBtnGrad: {
    minHeight: 44,
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

  // ── Empty states ──
  emptyInner: {
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
    paddingBottom: 28,
    gap: 14,
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
    width: 72,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  visRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  visTextWrap: {
    flex: 1,
    gap: 3,
  },
  visTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  visHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: 4,
  },
  submitBtnGrad: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
