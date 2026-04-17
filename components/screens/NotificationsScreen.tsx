import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Text,
  Image,
  SafeAreaView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Stack, router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { RADIUS, GLASS_BORDER } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useCommunityUnreadCounts } from '@/hooks/useCommunityUnreadCounts';
import { useAuth } from '@/contexts/AuthContext';
import { getMessagePreviewText, type ChatMessageType } from '@/lib/chatMessages';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/lib/community';
import { navigateToNotificationTarget } from '@/lib/notificationService';
import { type GroupChatSummary, getGroupChatSummaries } from '@/lib/groupChat';
import Header from '@/components/Header';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  message_type: ChatMessageType;
  audio_storage_path?: string | null;
  audio_duration_ms?: number | null;
  audio_mime_type?: string | null;
  created_at: string;
  is_read: boolean;
  sender_name?: string;
  receiver_name?: string;
  unread_count?: number;
  partner_avatar_url?: string | null;
}

type NameProfile = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

// Union type for the Messages tab list items
type MessagesListItem =
  | (DirectMessage & { _kind: 'dm' })
  | (Notification & { sender_name?: string; sender_avatar_url?: string | null; _kind: 'follow' })
  | (GroupChatSummary & { _kind: 'group' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getDisplayName = (profile?: NameProfile | null) => {
  const username = profile?.username?.trim();
  if (username) return username;
  const first = profile?.first_name?.trim() || '';
  const last = profile?.last_name?.trim() || '';
  return `${first} ${last}`.trim() || 'Benutzer';
};

const normalizeSearchValue = (value?: string | null) => value?.trim().toLowerCase() || '';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diffInMinutes < 1) return 'Gerade eben';
  if (diffInMinutes < 60) return `vor ${diffInMinutes} Min`;
  if (diffInMinutes < 1440) return `vor ${Math.floor(diffInMinutes / 60)} Std`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
};

const NOTIFICATION_META: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  like_post: { icon: 'heart.fill', color: '#FF6B6B', label: 'hat deinen Beitrag geliked' },
  like_comment: { icon: 'heart.fill', color: '#FF6B6B', label: 'hat deinen Kommentar geliked' },
  like_nested_comment: { icon: 'heart.fill', color: '#FF6B6B', label: 'hat deinen Kommentar geliked' },
  comment: { icon: 'bubble.left.fill', color: '#4DABF7', label: 'hat auf deinen Beitrag geantwortet' },
  reply: { icon: 'bubble.left.fill', color: '#4DABF7', label: 'hat auf deinen Kommentar geantwortet' },
  follow: { icon: 'person.badge.plus', color: '#9775FA', label: 'folgt dir jetzt' },
  message: { icon: 'envelope.fill', color: '#C89F81', label: 'hat dir eine Nachricht gesendet' },
};

// ── Pastel avatar palette for group chats ────────────────────────
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

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS = { MESSAGES: 0, ACTIVITY: 1, COMMENTS: 2 } as const;

type TabConfig = {
  key: number;
  label: string;
  icon: string;
  emptyIcon: string;
  emptyTitle: string;
  emptySubtitle: string;
};

const TAB_LIST: TabConfig[] = [
  {
    key: TABS.MESSAGES,
    label: 'Nachrichten',
    icon: 'envelope.fill',
    emptyIcon: 'envelope',
    emptyTitle: 'Keine Nachrichten',
    emptySubtitle: 'Wenn dir jemand schreibt, erscheint es hier',
  },
  {
    key: TABS.ACTIVITY,
    label: 'Aktivität',
    icon: 'heart.fill',
    emptyIcon: 'heart',
    emptyTitle: 'Keine Aktivitäten',
    emptySubtitle: 'Wenn jemand deine Beiträge mag, erscheint es hier',
  },
  {
    key: TABS.COMMENTS,
    label: 'Kommentare',
    icon: 'bubble.left.fill',
    emptyIcon: 'bubble.left',
    emptyTitle: 'Keine Kommentare',
    emptySubtitle: 'Wenn jemand auf deine Beiträge antwortet, erscheint es hier',
  },
];

// ---------------------------------------------------------------------------
// Fetch profile helper (deduplicated)
// ---------------------------------------------------------------------------

type ResolvedProfile = { name: string; avatarUrl: string | null };

async function resolveProfile(userId: string): Promise<ResolvedProfile> {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('community_use_avatar')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const avatarAllowed = settings?.community_use_avatar !== false;
  const avatarUrl = profile?.avatar_url && avatarAllowed ? profile.avatar_url : null;

  if (profile) return { name: getDisplayName(profile), avatarUrl };

  const { data: rpcData } = await supabase.rpc('get_user_profile', { user_id_param: userId });
  if (rpcData && rpcData.length > 0) {
    return {
      name: getDisplayName(rpcData[0]),
      avatarUrl: rpcData[0].avatar_url && avatarAllowed ? rpcData[0].avatar_url : null,
    };
  }

  return { name: 'Benutzer', avatarUrl: null };
}

// ===========================================================================
// Component
// ===========================================================================

export default function NotificationsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const { user } = useAuth();

  const {
    unreadActivityCount,
    unreadCommentCount,
    unreadFollowCount,
    unreadMessageCount,
    unreadGroupChatCount,
    refreshCounts,
  } = useCommunityUnreadCounts(user?.id);

  const [activeTab, setActiveTab] = useState<number>(TABS.MESSAGES);
  const [notifications, setNotifications] = useState<(Notification & { sender_name?: string; sender_avatar_url?: string | null })[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [groupSummaries, setGroupSummaries] = useState<GroupChatSummary[]>([]);
  const [messageQuery, setMessageQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Derived badge counts ----
  const badgeCounts: Record<number, number> = {
    [TABS.MESSAGES]: unreadMessageCount + unreadFollowCount + unreadGroupChatCount,
    [TABS.ACTIVITY]: unreadActivityCount,
    [TABS.COMMENTS]: unreadCommentCount,
  };

  // ---- Colors ----
  const cardBg = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.55)';
  const cardBgUnread = isDark ? 'rgba(200,159,129,0.08)' : 'rgba(200,159,129,0.06)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.12)' : GLASS_BORDER;
  const cardBorderUnread = isDark ? 'rgba(200,159,129,0.25)' : 'rgba(200,159,129,0.2)';
  const unreadAccent = '#C89F81';
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const textTertiary = isDark ? Colors.dark.textTertiary : '#9C8178';
  const tabInactive = isDark ? 'rgba(255,255,255,0.35)' : '#B0A59E';
  const tabActive = isDark ? '#FFFFFF' : '#5C4033';
  const tabIndicator = isDark ? Colors.dark.accent : '#C89F81';
  const tabBarBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)';

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      const [
        { data: notificationData, error: notificationError },
        { data: receivedMessages, error: receivedError },
        { data: sentMessages, error: sentError },
        groupChatData,
      ] = await Promise.all([
        supabase
          .from('community_notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('direct_messages')
          .select('*')
          .eq('receiver_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('direct_messages')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false }),
        getGroupChatSummaries(),
      ]);

      if (notificationError) throw notificationError;
      if (receivedError) throw receivedError;
      if (sentError) throw sentError;

      // Group messages by chat partner – keep only latest per partner + count unread
      const allMessages = [...(receivedMessages || []), ...(sentMessages || [])];
      const latestByPartner = new Map<string, DirectMessage>();
      const unreadByPartner = new Map<string, number>();
      for (const msg of allMessages) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const existing = latestByPartner.get(partnerId);
        if (!existing || new Date(msg.created_at) > new Date(existing.created_at)) {
          latestByPartner.set(partnerId, msg);
        }
        // Count unread messages from this partner (not from self)
        if (msg.sender_id !== user.id && !msg.is_read) {
          unreadByPartner.set(partnerId, (unreadByPartner.get(partnerId) || 0) + 1);
        }
      }
      // Attach unread count to each latest message
      for (const [partnerId, msg] of latestByPartner) {
        msg.unread_count = unreadByPartner.get(partnerId) || 0;
      }
      const uniqueMessages = Array.from(latestByPartner.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      // Enrich notifications + direct messages with sender names
      const senderIds = new Set<string>();
      for (const n of notificationData || []) if (n.sender_id) senderIds.add(n.sender_id);
      for (const m of uniqueMessages) {
        const pid = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        senderIds.add(pid);
      }
      // Also resolve sender names for group chat latest messages
      for (const gs of groupChatData) {
        if (gs.latest_message_sender_id) senderIds.add(gs.latest_message_sender_id);
      }

      const profileMap = new Map<string, ResolvedProfile>();
      await Promise.all(
        Array.from(senderIds).map(async (id) => {
          try {
            profileMap.set(id, await resolveProfile(id));
          } catch {
            profileMap.set(id, { name: 'Benutzer', avatarUrl: null });
          }
        }),
      );

      setNotifications(
        (notificationData || []).map((n) => ({
          ...n,
          sender_name: n.sender_id ? profileMap.get(n.sender_id)?.name || 'Benutzer' : 'Benutzer',
          sender_avatar_url: n.sender_id ? profileMap.get(n.sender_id)?.avatarUrl ?? null : null,
        })),
      );

      setMessages(
        uniqueMessages.map((m) => {
          const pid = m.sender_id === user.id ? m.receiver_id : m.sender_id;
          const profile = profileMap.get(pid) || { name: 'Benutzer', avatarUrl: null };
          return m.sender_id === user.id
            ? { ...m, receiver_name: profile.name, partner_avatar_url: profile.avatarUrl }
            : { ...m, sender_name: profile.name, partner_avatar_url: profile.avatarUrl };
        }),
      );

      setGroupSummaries(
        groupChatData.map((gs) => ({
          ...gs,
          latest_message_sender_name: gs.latest_message_sender_id
            ? profileMap.get(gs.latest_message_sender_id)?.name || 'Benutzer'
            : undefined,
        })),
      );
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleNotificationPress = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        await supabase
          .from('community_notifications')
          .update({ is_read: true })
          .eq('id', notification.id);
        void refreshCounts();
      }
      if (notification.type === 'follow') {
        router.push(`/profile/${notification.reference_id}` as any);
      } else if (notification.type === 'message') {
        router.push(`/chat/${notification.sender_id || notification.reference_id}` as any);
      } else {
        navigateToNotificationTarget(notification.type, notification.reference_id);
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der Benachrichtigung:', error);
    }
  };

  const handleMessagePress = async (message: DirectMessage) => {
    try {
      if (!message.is_read) {
        await supabase.from('direct_messages').update({ is_read: true }).eq('id', message.id);
        void refreshCounts();
      }
      const partnerId = message.sender_id === user?.id ? message.receiver_id : message.sender_id;
      router.push(`/chat/${partnerId}` as any);
    } catch (error) {
      console.error('Fehler beim Öffnen des Chats:', error);
    }
  };

  const handleGroupChatPress = (summary: GroupChatSummary) => {
    router.push({
      pathname: '/group-chat/[groupId]',
      params: { groupId: summary.group_id, from: 'notifications' },
    } as any);
  };

  // -----------------------------------------------------------------------
  // Filtered data
  // -----------------------------------------------------------------------

  const getFilteredData = (): any[] => {
    switch (activeTab) {
      case TABS.MESSAGES: {
        const followNotifs = notifications.filter((n) => n.type === 'follow');
        const query = normalizeSearchValue(messageQuery);

        // Build unified list with _kind discriminator
        const dmItems: MessagesListItem[] = messages.map((m) => ({ ...m, _kind: 'dm' as const }));
        const followItems: MessagesListItem[] = followNotifs.map((n) => ({ ...n, _kind: 'follow' as const }));
        const groupItems: MessagesListItem[] = groupSummaries.map((gs) => ({ ...gs, _kind: 'group' as const }));

        // Merge and sort by created_at descending
        const all = [...dmItems, ...followItems, ...groupItems];
        all.sort((a, b) => {
          const dateA = a._kind === 'group'
            ? a.latest_message_created_at || ''
            : a.created_at;
          const dateB = b._kind === 'group'
            ? b.latest_message_created_at || ''
            : b.created_at;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        if (!query) {
          return all;
        }

        return all.filter((item) => {
          if (item._kind === 'dm') {
            const partnerName = item.sender_id === user?.id
              ? item.receiver_name || 'Benutzer'
              : item.sender_name || 'Benutzer';
            const previewText = getMessagePreviewText(item);
            const searchableText = [partnerName, previewText, item.content || ''].join(' ');
            return normalizeSearchValue(searchableText).includes(query);
          }

          if (item._kind === 'group') {
            const searchableText = [
              item.group_name,
              item.latest_message_sender_name || '',
              item.latest_message_preview || '',
            ].join(' ');
            return normalizeSearchValue(searchableText).includes(query);
          }

          const searchableText = [
            item.sender_name || 'Benutzer',
            'folgt dir jetzt',
          ].join(' ');
          return normalizeSearchValue(searchableText).includes(query);
        });
      }
      case TABS.ACTIVITY:
        return notifications.filter(
          (n) => n.type === 'like_post' || n.type === 'like_comment' || n.type === 'like_nested_comment',
        );
      case TABS.COMMENTS:
        return notifications.filter((n) => n.type === 'comment' || n.type === 'reply');
      default:
        return [];
    }
  };

  // -----------------------------------------------------------------------
  // Render pieces
  // -----------------------------------------------------------------------

  const renderTabBar = () => (
    <View style={[styles.tabBar, { borderBottomColor: tabBarBorder }]}>
      {TAB_LIST.map((tab) => {
        const isActive = activeTab === tab.key;
        const badge = badgeCounts[tab.key] || 0;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <View style={styles.tabInner}>
              <IconSymbol name={tab.icon as any} size={14} color={isActive ? tabActive : tabInactive} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? tabActive : tabInactive },
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </View>
            {isActive && <View style={[styles.tabIndicator, { backgroundColor: tabIndicator }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ---- Glass card wrapper for list items ----
  const GlassRow = ({
    children,
    unread,
    onPress,
    accentLeft,
  }: {
    children: React.ReactNode;
    unread?: boolean;
    onPress: () => void;
    accentLeft?: string;
  }) => (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={styles.rowOuter}>
      <View
        style={[
          styles.rowCard,
          {
            borderColor: unread ? cardBorderUnread : cardBorder,
            borderLeftColor: accentLeft || (unread ? unreadAccent : cardBorder),
            borderLeftWidth: accentLeft || unread ? 3 : 1,
          },
        ]}
      >
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={isDark ? 30 : 22}
          tint={isDark ? 'dark' : 'light'}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: unread ? cardBgUnread : cardBg }]} />
        <View style={styles.rowContent}>
          {children}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ---- Avatar helper ----
  const renderAvatar = (
    avatarUrl: string | null | undefined,
    fallbackName: string,
    fallbackIcon: string,
    fallbackColor: string,
    fallbackBg: string,
  ) => {
    if (avatarUrl) {
      return (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      );
    }
    const initial = fallbackName.charAt(0).toUpperCase();
    // Show initial if we have a name, otherwise show icon
    if (fallbackName && fallbackName !== 'Benutzer') {
      return (
        <View style={[styles.iconCircle, { backgroundColor: fallbackBg }]}>
          <Text style={[styles.avatarInitial, { color: fallbackColor }]}>{initial}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.iconCircle, { backgroundColor: fallbackBg }]}>
        <IconSymbol name={fallbackIcon as any} size={18} color={fallbackColor} />
      </View>
    );
  };

  // ---- Message row (direct) ----
  const renderMessageRow = (item: DirectMessage) => {
    const isFromSelf = user && item.sender_id === user.id;
    const partnerName = isFromSelf ? item.receiver_name || 'Benutzer' : item.sender_name || 'Benutzer';
    const previewText = getMessagePreviewText(item);
    const preview = isFromSelf ? `Du: ${previewText}` : previewText;
    const unreadCount = item.unread_count || 0;
    const unread = unreadCount > 0;

    return (
      <GlassRow unread={unread} onPress={() => void handleMessagePress(item)}>
        {renderAvatar(
          item.partner_avatar_url,
          partnerName,
          isFromSelf ? 'paperplane.fill' : 'envelope.fill',
          '#C89F81',
          isDark ? 'rgba(200,159,129,0.2)' : '#F3ECE7',
        )}
        <View style={styles.rowText}>
          <View style={styles.rowTopLine}>
            <ThemedText
              style={[
                styles.rowName,
                { color: textPrimary },
                unread && styles.rowNameUnread,
              ]}
              numberOfLines={1}
            >
              {partnerName}
            </ThemedText>
            <Text style={[styles.rowTime, unread ? { color: unreadAccent, fontWeight: '600' } : { color: textTertiary }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <ThemedText
            style={[
              styles.rowPreview,
              unread ? { color: textPrimary, fontWeight: '600' } : { color: textSecondary },
            ]}
            numberOfLines={2}
          >
            {preview}
          </ThemedText>
        </View>
        {unread && (
          <View style={styles.unreadCountBadge}>
            <Text style={styles.unreadCountText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </GlassRow>
    );
  };

  // ---- Group chat row ----
  const renderGroupChatRow = (item: GroupChatSummary) => {
    const c = avatarColor(item.group_name, isDark);
    const senderName = item.latest_message_sender_name || 'Jemand';
    const preview = item.latest_message_preview
      ? `${senderName}: ${item.latest_message_preview}`
      : 'Noch keine Nachrichten';
    const unread = item.unread_count > 0;

    return (
      <GlassRow
        unread={unread}
        onPress={() => handleGroupChatPress(item)}
        accentLeft={c.text}
      >
        <View style={[styles.iconCircle, { backgroundColor: c.bg }]}>
          <ThemedText style={{ fontSize: 18, fontWeight: '800', color: c.text }}>
            {item.group_name.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.rowText}>
          <View style={styles.rowTopLine}>
            <View style={styles.groupNameRow}>
              <ThemedText
                style={[
                  styles.rowName,
                  { color: textPrimary },
                  unread && styles.rowNameUnread,
                ]}
                numberOfLines={1}
              >
                {item.group_name}
              </ThemedText>
              <View style={[styles.groupBadge, { backgroundColor: isDark ? 'rgba(200,159,129,0.15)' : 'rgba(200,159,129,0.1)' }]}>
                <IconSymbol name="person.2.fill" size={9} color="#C89F81" />
              </View>
            </View>
            <Text style={[styles.rowTime, unread ? { color: unreadAccent, fontWeight: '600' } : { color: textTertiary }]}>
              {item.latest_message_created_at ? formatDate(item.latest_message_created_at) : ''}
            </Text>
          </View>
          <ThemedText
            style={[
              styles.rowPreview,
              unread ? { color: textPrimary, fontWeight: '600' } : { color: textSecondary },
            ]}
            numberOfLines={2}
          >
            {preview}
          </ThemedText>
        </View>
        {unread && (
          <View style={styles.unreadCountBadge}>
            <Text style={styles.unreadCountText}>
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </Text>
          </View>
        )}
      </GlassRow>
    );
  };

  // ---- Follow row ----
  const renderFollowRow = (item: Notification & { sender_name?: string; sender_avatar_url?: string | null }) => {
    const unread = !item.is_read;
    return (
      <GlassRow
        unread={unread}
        onPress={() => void handleNotificationPress(item)}
        accentLeft="#9775FA"
      >
        {renderAvatar(
          item.sender_avatar_url,
          item.sender_name || 'Benutzer',
          'person.badge.plus',
          '#9775FA',
          isDark ? 'rgba(151,117,250,0.2)' : '#F0EBFF',
        )}
        <View style={styles.rowText}>
          <View style={styles.rowTopLine}>
            <ThemedText
              style={[
                styles.rowName,
                { color: '#9775FA' },
                unread && styles.rowNameUnread,
              ]}
              numberOfLines={1}
            >
              {item.sender_name || 'Benutzer'}
            </ThemedText>
            <Text style={[styles.rowTime, unread ? { color: '#9775FA', fontWeight: '600' } : { color: textTertiary }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <ThemedText
            style={[
              styles.rowPreview,
              unread ? { color: textPrimary, fontWeight: '600' } : { color: textSecondary },
            ]}
          >
            folgt dir jetzt
          </ThemedText>
        </View>
        {unread && (
          <View style={[styles.unreadCountBadge, { backgroundColor: '#9775FA' }]}>
            <Text style={styles.unreadCountText}>Neu</Text>
          </View>
        )}
      </GlassRow>
    );
  };

  // ---- Generic notification row (activity / comments) ----
  const renderNotificationRow = (item: Notification & { sender_name?: string; sender_avatar_url?: string | null }) => {
    const meta = NOTIFICATION_META[item.type] || { icon: 'bell.fill', color: '#FFA94D', label: '' };
    const unread = !item.is_read;

    return (
      <GlassRow
        unread={unread}
        onPress={() => void handleNotificationPress(item)}
        accentLeft={unread ? meta.color : (item.type === 'follow' ? '#9775FA' : undefined)}
      >
        {renderAvatar(
          item.sender_avatar_url,
          item.sender_name || 'Benutzer',
          meta.icon,
          meta.color,
          isDark ? `${meta.color}22` : `${meta.color}18`,
        )}
        <View style={styles.rowText}>
          <View style={styles.rowTopLine}>
            <ThemedText
              style={[
                styles.rowName,
                { color: textPrimary },
                unread && styles.rowNameUnread,
              ]}
              numberOfLines={1}
            >
              {item.sender_name || 'Benutzer'}
            </ThemedText>
            <Text style={[styles.rowTime, unread ? { color: meta.color, fontWeight: '600' } : { color: textTertiary }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <ThemedText
            style={[
              styles.rowPreview,
              unread ? { color: textPrimary, fontWeight: '600' } : { color: textSecondary },
            ]}
          >
            {meta.label}
          </ThemedText>
          {item.content ? (
            <ThemedText
              style={[styles.rowQuote, { color: textTertiary, borderLeftColor: `${meta.color}44` }]}
              numberOfLines={2}
            >
              {item.content}
            </ThemedText>
          ) : null}
        </View>
        {unread && (
          <View style={[styles.unreadCountBadge, { backgroundColor: meta.color }]}>
            <Text style={styles.unreadCountText}>Neu</Text>
          </View>
        )}
      </GlassRow>
    );
  };

  // ---- List renderItem dispatcher ----
  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === TABS.MESSAGES) {
      if (item._kind === 'group') return renderGroupChatRow(item);
      if (item._kind === 'follow') return renderFollowRow(item);
      if (item._kind === 'dm') return renderMessageRow(item);
      // Fallback for legacy shape
      if ('type' in item && item.type === 'follow') return renderFollowRow(item);
      if ('receiver_id' in item) return renderMessageRow(item);
      return null;
    }
    return renderNotificationRow(item);
  };

  // ---- Empty state ----
  const activeTabConfig = TAB_LIST.find((t) => t.key === activeTab)!;
  const isSearchingMessages = activeTab === TABS.MESSAGES && Boolean(messageQuery.trim());

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconCircle,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ]}
      >
        <IconSymbol name={activeTabConfig.emptyIcon as any} size={32} color={textTertiary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>
        {isSearchingMessages ? 'Keine Chats gefunden' : activeTabConfig.emptyTitle}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: textTertiary }]}>
        {isSearchingMessages
          ? 'Für deine Suche wurden keine Nachrichten, Gruppen oder Kontakte gefunden.'
          : activeTabConfig.emptySubtitle}
      </ThemedText>
    </View>
  );

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />

        <Header
          title="Benachrichtigungen"
          subtitle="Nachrichten und Aktivitäten"
          showBackButton
          onBackPress={() => router.push('/(tabs)/community')}
        />

        {renderTabBar()}

        {activeTab === TABS.MESSAGES ? (
          <View style={styles.searchWrap}>
            <View
              style={[
                styles.searchRow,
                {
                  backgroundColor: inputBg,
                  borderColor: cardBorder,
                },
              ]}
            >
              <IconSymbol name="magnifyingglass" size={15} color={textTertiary} />
              <TextInput
                value={messageQuery}
                onChangeText={setMessageQuery}
                placeholder="Chats suchen"
                placeholderTextColor={textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={[styles.searchInput, { color: textPrimary }]}
              />
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <FlatList
            data={getFilteredData()}
            renderItem={renderItem}
            keyExtractor={(item) => {
              if (item._kind === 'group') return `group-${item.group_id}`;
              return item.id;
            }}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.accent]}
                tintColor={theme.accent}
              />
            }
            ListEmptyComponent={renderEmpty}
          />
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // ---- Tab bar ----
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    left: 16,
    right: 16,
    height: 2.5,
    borderRadius: 2,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // ---- List ----
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchRow: {
    minHeight: 48,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },

  // ---- Glass row ----
  rowOuter: {
    marginBottom: 8,
  },
  rowCard: {
    borderRadius: RADIUS - 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '700',
  },
  rowText: {
    flex: 1,
  },
  rowTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  groupBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  rowNameUnread: {
    fontWeight: '800',
  },
  rowTime: {
    fontSize: 12,
  },
  rowPreview: {
    fontSize: 14,
    lineHeight: 19,
  },
  rowQuote: {
    fontSize: 13,
    lineHeight: 17,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginTop: 5,
  },

  // ---- Unread count badge ----
  unreadCountBadge: {
    backgroundColor: '#C89F81',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // ---- Loading ----
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Empty ----
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
