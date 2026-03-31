import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { getGroupDetails } from '@/lib/groups';
import {
  type GroupChatMessage,
  type GroupChatMemberInfo,
  type EnrichedGroupMessage,
  loadGroupChatMessages,
  loadGroupChatMemberProfiles,
  sendGroupChatMessage,
  deleteGroupChatMessage,
  markGroupChatRead,
  enrichGroupMessages,
  formatMessageTime,
} from '@/lib/groupChat';

// ---------------------------------------------------------------------------
// Swipeable row (swipe right → reply)
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 50;

type SwipeableRowProps = {
  children: React.ReactNode;
  onReply: () => void;
  iconColor: string;
};

const SwipeableRow = React.memo(function SwipeableRow({
  children,
  onReply,
  iconColor,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const didTrigger = useSharedValue(false);

  const gesture = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX * 0.55, 80);
      }
    })
    .onEnd(() => {
      if (translateX.value >= SWIPE_THRESHOLD && !didTrigger.value) {
        didTrigger.value = true;
        runOnJS(onReply)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      didTrigger.value = false;
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 25, SWIPE_THRESHOLD], [0, 0.4, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, SWIPE_THRESHOLD],
          [0.3, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={swipeStyles.wrapper}>
      <Animated.View style={[swipeStyles.iconContainer, iconAnimStyle]}>
        <IconSymbol name="arrowshape.turn.up.left.fill" size={18} color={iconColor} />
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={rowAnimStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
});

const swipeStyles = StyleSheet.create({
  wrapper: { overflow: 'visible' },
  iconContainer: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GroupChatScreen() {
  const { user } = useAuth();
  const { groupId, from } = useLocalSearchParams<{ groupId?: string | string[]; from?: string }>();
  const resolvedGroupId = useMemo(
    () => (Array.isArray(groupId) ? groupId[0] : groupId) || '',
    [groupId],
  );
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<EnrichedGroupMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [groupName, setGroupName] = useState('Gruppenchat');
  const [canManage, setCanManage] = useState(false);
  const [memberMap, setMemberMap] = useState<Map<string, GroupChatMemberInfo>>(new Map());
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const enriched = useMemo(
    () => enrichGroupMessages(messages, memberMap, user?.id),
    [messages, memberMap, user?.id],
  );

  // ---- Bubble colors ----
  const ownBubbleBg = theme.accent;
  const otherBubbleBg = isDark ? '#3D3330' : '#F3ECE7';
  const ownTextColor = '#FFFFFF';
  const otherTextColor = theme.text;
  const ownMetaColor = 'rgba(255,255,255,0.7)';
  const otherMetaColor = theme.textTertiary;

  // Sender name colors (cycle through a palette for other users)
  const senderColors = useMemo(
    () => ['#9775FA', '#FF6B6B', '#51CF66', '#339AF0', '#FF922B', '#CC5DE8', '#20C997', '#F06595'],
    [],
  );
  const getSenderColor = useCallback(
    (senderId: string) => {
      let hash = 0;
      for (let i = 0; i < senderId.length; i++) {
        hash = (hash * 31 + senderId.charCodeAt(i)) | 0;
      }
      return senderColors[Math.abs(hash) % senderColors.length];
    },
    [senderColors],
  );

  // -----------------------------------------------------------------------
  // Scroll helpers
  // -----------------------------------------------------------------------

  const clearPendingScrolls = useCallback(() => {
    scrollTimersRef.current.forEach((timer) => clearTimeout(timer));
    scrollTimersRef.current = [];
  }, []);

  const scrollToBottom = useCallback(
    (animated = false) => {
      clearPendingScrolls();
      const run = () => flatListRef.current?.scrollToEnd({ animated });
      run();
      scrollTimersRef.current = [
        setTimeout(run, 40),
        setTimeout(run, 140),
        setTimeout(run, 320),
      ];
    },
    [clearPendingScrolls],
  );

  const scrollToMessage = useCallback(
    (messageId: string | null) => {
      if (!messageId) return;
      const index = enriched.findIndex((m) => m.id === messageId);
      if (index === -1) return;
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightId(messageId);
      setTimeout(() => setHighlightId(null), 1500);
    },
    [enriched],
  );

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadGroup = useCallback(async () => {
    if (!resolvedGroupId) return;
    try {
      const { data: details, error } = await getGroupDetails(resolvedGroupId);
      if (error) throw error;
      if (details) {
        setGroupName(details.name);
        setCanManage(
          details.current_user_role === 'owner' || details.current_user_role === 'admin',
        );
      }
    } catch (e) {
      console.error('Failed to load group details:', e);
    }
  }, [resolvedGroupId]);

  const loadMembers = useCallback(async () => {
    if (!resolvedGroupId) return;
    try {
      const map = await loadGroupChatMemberProfiles(resolvedGroupId);
      setMemberMap(map);
    } catch (e) {
      console.error('Failed to load member profiles:', e);
    }
  }, [resolvedGroupId]);

  const loadMessages = useCallback(async () => {
    if (!resolvedGroupId || !user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Get last_read_at before loading messages to find unread divider position
      const { data: readData } = await supabase
        .from('community_group_chat_reads')
        .select('last_read_at')
        .eq('group_id', resolvedGroupId)
        .eq('user_id', user.id)
        .maybeSingle();
      const lastReadAt = readData?.last_read_at;

      const data = await loadGroupChatMessages(resolvedGroupId);

      // Find first unread message (after last_read_at, not from self)
      if (lastReadAt) {
        const lastReadTime = new Date(lastReadAt).getTime();
        const unreadMessages = data.filter(
          (m) => m.sender_id !== user.id && new Date(m.created_at).getTime() > lastReadTime,
        );
        if (unreadMessages.length > 0) {
          setFirstUnreadId(unreadMessages[0].id);
          setUnreadCount(unreadMessages.length);
        }
      } else if (data.length > 0) {
        // Never read this group – all messages from others are unread
        const othersMessages = data.filter((m) => m.sender_id !== user.id);
        if (othersMessages.length > 0) {
          setFirstUnreadId(othersMessages[0].id);
          setUnreadCount(othersMessages.length);
        }
      }

      setMessages(data);
      await markGroupChatRead(resolvedGroupId);
    } catch (e) {
      console.error('Fehler beim Laden des Gruppenchats:', e);
    } finally {
      setLoading(false);
    }
  }, [resolvedGroupId, user?.id]);

  useEffect(() => {
    void loadGroup();
    void loadMembers();
    void loadMessages();
  }, [loadGroup, loadMembers, loadMessages]);

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!user?.id || !resolvedGroupId) return;
    const channel = supabase
      .channel(`group-chat-${resolvedGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_group_messages' },
        (payload) => {
          const record = payload.new as GroupChatMessage | undefined;
          const oldRecord = payload.old as { id?: string } | undefined;

          // Filter to this group
          if (record && record.group_id !== resolvedGroupId) return;

          if (payload.eventType === 'INSERT' && record) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === record.id)) return prev;
              return [...prev, record];
            });
            // If the sender is not in our member map yet, reload profiles
            if (!memberMap.has(record.sender_id)) {
              void loadMembers();
            }
            void markGroupChatRead(resolvedGroupId);
          } else if (payload.eventType === 'DELETE' && oldRecord?.id) {
            setMessages((prev) => prev.filter((m) => m.id !== oldRecord.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedGroupId, user?.id, memberMap, loadMembers]);

  useEffect(() => {
    if (!loading) scrollToBottom(false);
  }, [loading, enriched.length, scrollToBottom]);

  useEffect(() => () => clearPendingScrolls(), [clearPendingScrolls]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleReply = useCallback((message: GroupChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReplyTo(message);
    inputRef.current?.focus();
  }, []);

  const handleOpenProfile = useCallback((targetUserId?: string | null) => {
    if (!targetUserId) return;
    router.push(`/profile/${targetUserId}` as any);
  }, []);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!user?.id || !resolvedGroupId || !content || sending) return;
    try {
      setSending(true);
      await sendGroupChatMessage(resolvedGroupId, content, replyTo?.id);
      setDraft('');
      setReplyTo(null);
      setTimeout(() => scrollToBottom(true), 300);
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
    } finally {
      setSending(false);
    }
  }, [draft, replyTo, resolvedGroupId, scrollToBottom, sending, user?.id]);

  const handleDeleteMessage = useCallback(
    (message: GroupChatMessage) => {
      const isOwnMessage = message.sender_id === user?.id;
      if (!isOwnMessage && !canManage) return;

      Alert.alert('Nachricht löschen', 'Möchtest du diese Nachricht wirklich löschen?', [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroupChatMessage(message.id);
              setMessages((current) => current.filter((item) => item.id !== message.id));
              if (replyTo?.id === message.id) setReplyTo(null);
            } catch (error) {
              console.error('Fehler beim Löschen der Nachricht:', error);
              Alert.alert('Gruppenchat', 'Die Nachricht konnte gerade nicht gelöscht werden.');
            }
          },
        },
      ]);
    },
    [canManage, replyTo, user?.id],
  );

  const handleMessageLongPress = useCallback(
    (message: GroupChatMessage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const isOwnMessage = message.sender_id === user?.id;
      const canDelete = isOwnMessage || canManage;

      if (canDelete) {
        Alert.alert('Nachricht', undefined, [
          { text: 'Antworten', onPress: () => handleReply(message) },
          { text: 'Löschen', style: 'destructive', onPress: () => handleDeleteMessage(message) },
          { text: 'Abbrechen', style: 'cancel' },
        ]);
      } else {
        handleReply(message);
      }
    },
    [canManage, handleDeleteMessage, handleReply, user?.id],
  );

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderDateSeparator = (label: string) => (
    <View style={styles.dateSeparatorRow}>
      <View style={[styles.dateSeparatorPill, { backgroundColor: isDark ? '#3D3330' : '#EDE5DC' }]}>
        <ThemedText style={[styles.dateSeparatorText, { color: isDark ? '#E9D8C2' : '#7D5A50' }]}>
          {label}
        </ThemedText>
      </View>
    </View>
  );

  const renderUnreadDivider = () => (
    <View style={styles.unreadDividerRow}>
      <View style={[styles.unreadDividerLine, { backgroundColor: theme.accent }]} />
      <View style={[styles.unreadDividerPill, { backgroundColor: theme.accent }]}>
        <ThemedText style={styles.unreadDividerText}>
          {unreadCount} ungelesene {unreadCount === 1 ? 'Nachricht' : 'Nachrichten'}
        </ThemedText>
      </View>
      <View style={[styles.unreadDividerLine, { backgroundColor: theme.accent }]} />
    </View>
  );

  const renderSenderInfo = (item: EnrichedGroupMessage) => {
    const color = getSenderColor(item.sender_id);
    return (
      <TouchableOpacity
        style={styles.senderInfoRow}
        onPress={() => handleOpenProfile(item.sender_id)}
        activeOpacity={0.75}
      >
        {item.senderAvatarUrl ? (
          <Image source={{ uri: item.senderAvatarUrl }} style={styles.senderAvatar} />
        ) : (
          <View style={[styles.senderAvatarPlaceholder, { backgroundColor: color + '30' }]}>
            <ThemedText style={[styles.senderAvatarInitial, { color }]}>
              {item.senderDisplayName.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <ThemedText style={[styles.senderName, { color }]} numberOfLines={1}>
          {item.senderDisplayName}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderQuoteBlock = (item: EnrichedGroupMessage, isOwnBubble: boolean) => {
    if (!item.quotedContent) return null;
    const quotedIsOwn = item.quotedSenderId === user?.id;
    const quotedMember = item.quotedSenderId ? memberMap.get(item.quotedSenderId) : null;
    const quotedName = quotedIsOwn ? 'Du' : (quotedMember?.display_name ?? 'Unbekannt');
    const accentBarColor = quotedIsOwn ? theme.accent : getSenderColor(item.quotedSenderId ?? '');
    const quoteBg = isOwnBubble
      ? 'rgba(255,255,255,0.18)'
      : isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(0,0,0,0.05)';
    const quoteSenderColor = isOwnBubble
      ? 'rgba(255,255,255,0.9)'
      : accentBarColor;
    const quoteTextColor = isOwnBubble ? 'rgba(255,255,255,0.75)' : theme.textTertiary;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => scrollToMessage(item.reply_to_id)}
        style={[styles.quoteBlock, { backgroundColor: quoteBg, borderLeftColor: accentBarColor }]}
      >
        <ThemedText style={[styles.quoteSender, { color: quoteSenderColor }]} numberOfLines={1}>
          {quotedName}
        </ThemedText>
        <ThemedText style={[styles.quoteText, { color: quoteTextColor }]} numberOfLines={2}>
          {item.quotedContent}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: EnrichedGroupMessage }) => {
    const isOwn = item.sender_id === user?.id;
    const isHighlighted = highlightId === item.id;

    const RADIUS = 18;
    const TAIL = 4;
    let tl: number, tr: number, bl: number, br: number;

    if (isOwn) {
      tl = RADIUS;
      tr = item.isFirstInGroup ? RADIUS : TAIL;
      bl = RADIUS;
      br = item.isLastInGroup ? TAIL : TAIL;
    } else {
      tl = item.isFirstInGroup ? RADIUS : TAIL;
      tr = RADIUS;
      bl = item.isLastInGroup ? TAIL : TAIL;
      br = RADIUS;
    }

    const bubbleRadius = {
      borderTopLeftRadius: tl,
      borderTopRightRadius: tr,
      borderBottomLeftRadius: bl,
      borderBottomRightRadius: br,
    };

    const bubbleContent = (
      <View
        style={[
          styles.messageRow,
          isOwn ? styles.messageRowOwn : styles.messageRowOther,
          { marginTop: item.isFirstInGroup && !item.showDateSeparator ? 10 : 2 },
        ]}
      >
        <View style={isOwn ? undefined : styles.otherBubbleWrap}>
          <Pressable
            style={[
              styles.messageBubble,
              bubbleRadius,
              {
                backgroundColor: isOwn ? ownBubbleBg : otherBubbleBg,
                borderWidth: isHighlighted ? 1.5 : 0,
                borderColor: isHighlighted ? (isDark ? '#FFF' : theme.accent) : 'transparent',
              },
            ]}
            onLongPress={() => handleMessageLongPress(item)}
            delayLongPress={260}
          >
            {renderQuoteBlock(item, isOwn)}

            <ThemedText
              style={[styles.messageText, { color: isOwn ? ownTextColor : otherTextColor }]}
            >
              {item.content}
              <ThemedText style={styles.metaSpacer}>
                {'  '}
                {formatMessageTime(item.created_at)}
              </ThemedText>
            </ThemedText>

            <View style={styles.metaFloat}>
              <ThemedText
                style={[styles.messageTime, { color: isOwn ? ownMetaColor : otherMetaColor }]}
              >
                {formatMessageTime(item.created_at)}
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    );

    return (
      <>
        {item.showDateSeparator && renderDateSeparator(item.dateLabel)}
        {firstUnreadId === item.id && renderUnreadDivider()}
        {!isOwn && item.isFirstInGroup && renderSenderInfo(item)}
        <SwipeableRow
          onReply={() => handleReply(item)}
          iconColor={isDark ? '#E9D8C2' : '#7D5A50'}
        >
          {bubbleContent}
        </SwipeableRow>
      </>
    );
  };

  // -----------------------------------------------------------------------
  // Reply preview sender name
  // -----------------------------------------------------------------------

  const replyToSenderName = useMemo(() => {
    if (!replyTo) return '';
    if (replyTo.sender_id === user?.id) return 'Du';
    return memberMap.get(replyTo.sender_id)?.display_name ?? 'Unbekannt';
  }, [replyTo, user?.id, memberMap]);

  const replyToSenderColor = useMemo(() => {
    if (!replyTo) return theme.accent;
    if (replyTo.sender_id === user?.id) return theme.accent;
    return getSenderColor(replyTo.sender_id);
  }, [replyTo, user?.id, theme.accent, getSenderColor]);

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <ThemedBackground style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title={groupName}
          subtitle={memberMap.size > 0 ? `${memberMap.size} Mitglieder` : 'Gruppenchat'}
          showBackButton
          onBackPress={() => {
            if (from === 'notifications') {
              router.push('/(tabs)/notifications' as any);
            } else {
              router.push(`/groups/${resolvedGroupId}` as any);
            }
          }}
          showBabySwitcher={false}
          leftContent={
            <View style={[styles.headerGroupAvatar, { backgroundColor: getSenderColor(groupName) + '30' }]}>
              <ThemedText style={[styles.headerGroupInitial, { color: getSenderColor(groupName) }]}>
                {groupName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
          keyboardVerticalOffset={0}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={enriched}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              onLayout={() => scrollToBottom(false)}
              onContentSizeChange={() => scrollToBottom(false)}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={(info) => {
                flatListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.5,
                  });
                }, 200);
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <IconSymbol name="bubble.left.and.bubble.right" size={36} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyTitle}>Noch keine Nachrichten</ThemedText>
                  <ThemedText style={styles.emptyText}>
                    Schreib die erste Nachricht im Gruppenchat!
                  </ThemedText>
                </View>
              }
            />
          )}

          {/* ---- Reply preview bar ---- */}
          {replyTo && (
            <View
              style={[
                styles.replyPreview,
                {
                  backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                  borderTopColor: isDark ? '#3D3330' : '#E8DDD6',
                },
              ]}
            >
              <View style={[styles.replyPreviewBar, { backgroundColor: replyToSenderColor }]} />
              <View style={styles.replyPreviewBody}>
                <ThemedText
                  style={[styles.replyPreviewSender, { color: replyToSenderColor }]}
                  numberOfLines={1}
                >
                  {replyToSenderName}
                </ThemedText>
                <ThemedText style={[styles.replyPreviewText, { color: theme.textTertiary }]} numberOfLines={1}>
                  {replyTo.content}
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => setReplyTo(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.replyPreviewClose}
              >
                <IconSymbol name="xmark" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* ---- Composer ---- */}
          <View
            style={[
              styles.composer,
              {
                backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                borderTopColor: replyTo ? 'transparent' : isDark ? '#3D3330' : '#E8DDD6',
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 6 : 10),
              },
            ]}
          >
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
                  borderColor: isDark ? '#3D3330' : '#E8DDD6',
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: theme.text }]}
                value={draft}
                onChangeText={setDraft}
                placeholder="Nachricht..."
                placeholderTextColor={theme.textTertiary}
                multiline
                onFocus={() => scrollToBottom(true)}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: canSend ? theme.accent : isDark ? '#3D3330' : '#E8DDD6' },
              ]}
              onPress={() => void handleSend()}
              disabled={!canSend}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <IconSymbol
                  name="paperplane.fill"
                  size={18}
                  color={canSend ? '#FFFFFF' : isDark ? '#7A6A60' : '#B0A59E'}
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </ThemedBackground>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ---- List ----
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // ---- Date separator ----
  dateSeparatorRow: { alignItems: 'center', marginVertical: 14 },
  dateSeparatorPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10 },
  dateSeparatorText: { fontSize: 12, fontWeight: '600' },

  // ---- Unread divider ----
  unreadDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 12,
  },
  unreadDividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.4,
  },
  unreadDividerPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  unreadDividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ---- Sender info (group chat) ----
  senderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    gap: 6,
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  senderAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarInitial: {
    fontSize: 11,
    fontWeight: '700',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },

  // ---- Message rows ----
  messageRow: { flexDirection: 'row', paddingHorizontal: 4 },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  otherBubbleWrap: { maxWidth: '80%' },

  // ---- Bubble ----
  messageBubble: {
    maxWidth: '100%',
    minWidth: 80,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 8,
    position: 'relative',
  },
  messageText: { fontSize: 15, lineHeight: 21 },
  metaSpacer: { fontSize: 11, opacity: 0 },
  metaFloat: {
    position: 'absolute',
    bottom: 5,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  messageTime: { fontSize: 11 },

  // ---- Quote block inside bubble ----
  quoteBlock: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 4,
  },
  quoteSender: { fontSize: 12, fontWeight: '700', marginBottom: 1 },
  quoteText: { fontSize: 13, lineHeight: 17 },

  // ---- Reply preview above composer ----
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyPreviewBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
  },
  replyPreviewBody: { flex: 1 },
  replyPreviewSender: { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  replyPreviewText: { fontSize: 13, lineHeight: 17 },
  replyPreviewClose: { padding: 6, marginLeft: 8 },

  // ---- Composer ----
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputWrapper: { flex: 1, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  input: {
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 1 : 0,
  },

  // ---- Header group avatar ----
  headerGroupAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGroupInitial: {
    fontSize: 16,
    fontWeight: '800',
  },

  // ---- Empty state ----
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
