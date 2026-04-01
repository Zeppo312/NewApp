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
import ChatComposer from '@/components/chat/ChatComposer';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useChatAudioPlayback } from '@/hooks/useChatAudioPlayback';
import { useColorScheme } from '@/hooks/useColorScheme';
import { deleteChatMessage, uploadChatAudio } from '@/lib/chatAudio';
import {
  type ChatMessageType,
  VOICE_MESSAGE_PREVIEW,
  formatAudioDuration,
  getAudioProgress,
  getMessagePreviewText,
} from '@/lib/chatMessages';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DirectMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  message_type: ChatMessageType;
  audio_storage_path: string | null;
  audio_duration_ms: number | null;
  audio_mime_type: string | null;
  created_at: string;
  is_read: boolean;
  reply_to_id: string | null;
};

type ProfileLookup = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

type EnrichedMessage = DirectMessage & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showDateSeparator: boolean;
  dateLabel: string;
  quotedContent: string | null;
  quotedMessageType: ChatMessageType | null;
  quotedSenderId: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getDisplayName = (profile?: ProfileLookup | null) => {
  const username = profile?.username?.trim();
  if (username) return username;
  const first = profile?.first_name?.trim() || '';
  const last = profile?.last_name?.trim() || '';
  return `${first} ${last}`.trim() || 'Chat';
};

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (isSameDay(date, now)) return 'Heute';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Gestern';
  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
};

const GROUP_GAP_MINUTES = 3;

const enrichMessages = (
  messages: DirectMessage[],
  _currentUserId?: string,
): EnrichedMessage[] => {
  const map = new Map<string, DirectMessage>();
  for (const m of messages) map.set(m.id, m);

  return messages.map((msg, index) => {
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;
    const msgDate = new Date(msg.created_at);

    const showDateSeparator = !prev || !isSameDay(new Date(prev.created_at), msgDate);

    const sameSenderAsPrev =
      prev &&
      prev.sender_id === msg.sender_id &&
      isSameDay(new Date(prev.created_at), msgDate) &&
      (msgDate.getTime() - new Date(prev.created_at).getTime()) / 60_000 <= GROUP_GAP_MINUTES;

    const sameSenderAsNext =
      next &&
      next.sender_id === msg.sender_id &&
      isSameDay(msgDate, new Date(next.created_at)) &&
      (new Date(next.created_at).getTime() - msgDate.getTime()) / 60_000 <= GROUP_GAP_MINUTES;

    const isFirstInGroup = showDateSeparator || !sameSenderAsPrev;
    const isLastInGroup = !sameSenderAsNext;

    // Resolve quoted message from local map
    const quoted = msg.reply_to_id ? map.get(msg.reply_to_id) : null;

    return {
      ...msg,
      isFirstInGroup,
      isLastInGroup,
      showDateSeparator,
      dateLabel: formatDateLabel(msg.created_at),
      quotedContent: quoted?.content ?? null,
      quotedMessageType: quoted?.message_type ?? null,
      quotedSenderId: quoted?.sender_id ?? null,
    };
  });
};

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
  wrapper: {
    overflow: 'visible',
  },
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

export default function ChatThreadScreen() {
  const { user } = useAuth();
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  const partnerId = useMemo(() => (Array.isArray(userId) ? userId[0] : userId) || '', [userId]);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<EnrichedMessage>>(null);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [partnerName, setPartnerName] = useState('Chat');
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const {
    activeMessageId,
    currentTime,
    isPlaying,
    loadingMessageId,
    stopPlayback,
    togglePlayback,
  } = useChatAudioPlayback('direct');

  const enriched = useMemo(() => enrichMessages(messages, user?.id), [messages, user?.id]);

  // ---- Bubble colors ----
  const ownBubbleBg = theme.accent;
  const otherBubbleBg = isDark ? '#3D3330' : '#F3ECE7';
  const ownTextColor = '#FFFFFF';
  const otherTextColor = theme.text;
  const ownMetaColor = 'rgba(255,255,255,0.7)';
  const otherMetaColor = theme.textTertiary;

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

  const loadPartner = useCallback(async () => {
    if (!partnerId) return;

    setPartnerAvatarUrl(null);

    const { data: settings } = await supabase
      .from('user_settings')
      .select('community_use_avatar')
      .eq('user_id', partnerId)
      .maybeSingle();
    const avatarAllowed = settings?.community_use_avatar !== false;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', partnerId)
      .maybeSingle();
    if (profileData) {
      setPartnerName(getDisplayName(profileData));
      setPartnerAvatarUrl(profileData.avatar_url && avatarAllowed ? profileData.avatar_url : null);
      return;
    }
    const { data: rpcData } = await supabase.rpc('get_user_profile', { user_id_param: partnerId });
    if (rpcData && rpcData.length > 0) {
      setPartnerName(getDisplayName(rpcData[0]));
      setPartnerAvatarUrl(rpcData[0].avatar_url && avatarAllowed ? rpcData[0].avatar_url : null);
      return;
    }
    setPartnerName('Chat');
  }, [partnerId]);

  const loadMessages = useCallback(async () => {
    if (!user?.id || !partnerId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('direct_messages')
        .select(
          'id, sender_id, receiver_id, content, message_type, audio_storage_path, audio_duration_ms, audio_mime_type, created_at, is_read, reply_to_id',
        )
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`,
        )
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Find first unread message from partner before marking as read
      const unreadFromPartner = (data || []).filter(
        (m) => m.sender_id === partnerId && !m.is_read,
      );
      if (unreadFromPartner.length > 0) {
        setFirstUnreadId(unreadFromPartner[0].id);
        setUnreadCount(unreadFromPartner.length);
      }

      setMessages(data || []);

      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Fehler beim Laden des Chats:', error);
    } finally {
      setLoading(false);
    }
  }, [partnerId, user?.id]);

  useEffect(() => {
    void loadPartner();
    void loadMessages();
  }, [loadMessages, loadPartner]);

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!user?.id || !partnerId) return;
    const channel = supabase
      .channel(`chat-${[user.id, partnerId].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const record = payload.new as DirectMessage | undefined;
          const oldRecord = payload.old as { id?: string } | undefined;
          if (!record && !oldRecord) return;

          const isRelevant =
            (record &&
              ((record.sender_id === user.id && record.receiver_id === partnerId) ||
                (record.sender_id === partnerId && record.receiver_id === user.id))) ||
            (oldRecord?.id && !record);

          if (!isRelevant) return;

          if (payload.eventType === 'INSERT' && record) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === record.id)) return prev;
              return [...prev, record];
            });
            if (record.sender_id === partnerId && !record.is_read) {
              supabase.from('direct_messages').update({ is_read: true }).eq('id', record.id).then();
            }
          } else if (payload.eventType === 'UPDATE' && record) {
            setMessages((prev) => prev.map((m) => (m.id === record.id ? record : m)));
          } else if (payload.eventType === 'DELETE' && oldRecord?.id) {
            setMessages((prev) => prev.filter((m) => m.id !== oldRecord.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId, user?.id]);

  useEffect(() => {
    if (!loading) scrollToBottom(false);
  }, [loading, enriched.length, scrollToBottom]);

  useEffect(
    () => () => {
      clearPendingScrolls();
      void stopPlayback();
    },
    [clearPendingScrolls, stopPlayback],
  );

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleReply = useCallback(
    (message: DirectMessage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setReplyTo(message);
    },
    [],
  );

  const handleSendText = useCallback(async () => {
    const content = draft.trim();
    if (!user?.id || !partnerId || !content || sending) return;
    try {
      setSending(true);

      const insertPayload: Record<string, unknown> = {
        sender_id: user.id,
        receiver_id: partnerId,
        content,
        message_type: 'text',
      };
      if (replyTo?.id) insertPayload.reply_to_id = replyTo.id;
      const insertResult = await supabase.from('direct_messages').insert(insertPayload);

      if (insertResult.error) throw insertResult.error;
      setDraft('');
      setReplyTo(null);
      setTimeout(() => {
        void loadMessages();
        scrollToBottom(true);
      }, 600);
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
    } finally {
      setSending(false);
    }
  }, [draft, loadMessages, partnerId, replyTo, scrollToBottom, sending, user?.id]);

  const handleSendVoice = useCallback(
    async ({
      localUri,
      durationMs,
      mimeType,
    }: {
      localUri: string;
      durationMs: number;
      mimeType: string;
    }) => {
      if (!user?.id || !partnerId) return;

      const audioUpload = await uploadChatAudio({
        scope: 'direct',
        userId: user.id,
        localUri,
      });

      const insertPayload: Record<string, unknown> = {
        sender_id: user.id,
        receiver_id: partnerId,
        content: null,
        message_type: 'voice',
        audio_storage_path: audioUpload.storagePath,
        audio_duration_ms: durationMs,
        audio_mime_type: mimeType,
      };
      if (replyTo?.id) insertPayload.reply_to_id = replyTo.id;

      const { error } = await supabase.from('direct_messages').insert(insertPayload);
      if (error) throw error;

      setReplyTo(null);
      setTimeout(() => {
        void loadMessages();
        scrollToBottom(true);
      }, 300);
    },
    [loadMessages, partnerId, replyTo, scrollToBottom, user?.id],
  );

  const handleDeleteMessage = useCallback(
    (message: DirectMessage) => {
      if (message.sender_id !== user?.id) return;
      Alert.alert('Nachricht löschen', 'Möchtest du diese Nachricht wirklich löschen?', [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChatMessage('direct', message.id);
            } catch (error) {
              console.error('Fehler beim Löschen der Nachricht:', error);
              Alert.alert('Chat', 'Die Nachricht konnte gerade nicht gelöscht werden.');
              return;
            }
            setMessages((current) => current.filter((item) => item.id !== message.id));
            if (replyTo?.id === message.id) setReplyTo(null);
            if (activeMessageId === message.id) {
              void stopPlayback();
            }
            scrollToBottom(false);
          },
        },
      ]);
    },
    [activeMessageId, replyTo, scrollToBottom, stopPlayback, user?.id],
  );

  const handleMessageLongPress = useCallback(
    (message: DirectMessage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      if (message.sender_id === user?.id) {
        // Own message → reply or delete
        Alert.alert('Nachricht', undefined, [
          { text: 'Antworten', onPress: () => handleReply(message) },
          { text: 'Löschen', style: 'destructive', onPress: () => handleDeleteMessage(message) },
          { text: 'Abbrechen', style: 'cancel' },
        ]);
      } else {
        // Partner message → reply
        handleReply(message);
      }
    },
    [handleDeleteMessage, handleReply, user?.id],
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

  const renderCheckmarks = (item: DirectMessage) => {
    const readColor = '#53BDEB';
    const unreadColor = ownMetaColor;
    return (
      <ThemedText style={[styles.checkmarks, { color: item.is_read ? readColor : unreadColor }]}>
        {item.is_read ? '\u2713\u2713' : '\u2713'}
      </ThemedText>
    );
  };

  const renderQuoteBlock = (item: EnrichedMessage, isOwnBubble: boolean) => {
    const quotedPreview =
      item.quotedMessageType === 'voice' ? VOICE_MESSAGE_PREVIEW : item.quotedContent;
    if (!quotedPreview) return null;
    const quotedIsOwn = item.quotedSenderId === user?.id;
    const accentBarColor = quotedIsOwn ? theme.accent : '#9775FA';
    const quoteBg = isOwnBubble
      ? 'rgba(255,255,255,0.18)'
      : isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(0,0,0,0.05)';
    const quoteSenderColor = isOwnBubble
      ? 'rgba(255,255,255,0.9)'
      : quotedIsOwn
        ? theme.accent
        : '#9775FA';
    const quoteTextColor = isOwnBubble ? 'rgba(255,255,255,0.75)' : theme.textTertiary;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => scrollToMessage(item.reply_to_id)}
        style={[
          styles.quoteBlock,
          { backgroundColor: quoteBg, borderLeftColor: accentBarColor },
        ]}
      >
        <ThemedText style={[styles.quoteSender, { color: quoteSenderColor }]} numberOfLines={1}>
          {quotedIsOwn ? 'Du' : partnerName}
        </ThemedText>
        <ThemedText style={[styles.quoteText, { color: quoteTextColor }]} numberOfLines={2}>
          {quotedPreview}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: EnrichedMessage }) => {
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
        <Pressable
          style={[
            styles.messageBubble,
            bubbleRadius,
            item.message_type === 'voice' && styles.voiceBubble,
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

          {item.message_type === 'voice' ? (
            <>
              <View style={styles.voiceRow}>
                <TouchableOpacity
                  style={[
                    styles.voicePlayButton,
                    {
                      backgroundColor: isOwn
                        ? 'rgba(255,255,255,0.18)'
                        : isDark
                          ? '#2A2321'
                          : '#FFFFFF',
                    },
                  ]}
                  onPress={() => void togglePlayback(item)}
                  activeOpacity={0.8}
                >
                  {loadingMessageId === item.id ? (
                    <ActivityIndicator size="small" color={isOwn ? '#FFFFFF' : theme.accent} />
                  ) : (
                    <IconSymbol
                      name={activeMessageId === item.id && isPlaying ? 'pause.fill' : 'play.fill'}
                      size={18}
                      color={isOwn ? '#FFFFFF' : theme.accent}
                    />
                  )}
                </TouchableOpacity>
                <View style={styles.voiceBody}>
                  <ThemedText
                    style={[styles.voiceTitle, { color: isOwn ? ownTextColor : otherTextColor }]}
                  >
                    {VOICE_MESSAGE_PREVIEW}
                  </ThemedText>
                  <View
                    style={[
                      styles.voiceProgressTrack,
                      {
                        backgroundColor: isOwn
                          ? 'rgba(255,255,255,0.24)'
                          : isDark
                            ? '#4A3F3B'
                            : '#E8DDD6',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.voiceProgressFill,
                        {
                          backgroundColor: isOwn ? '#FFFFFF' : theme.accent,
                          width: `${getAudioProgress(
                            activeMessageId === item.id ? currentTime : 0,
                            item.audio_duration_ms,
                          ) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.voiceFooter}>
                <ThemedText
                  style={[styles.messageTime, { color: isOwn ? ownMetaColor : otherMetaColor }]}
                >
                  {formatAudioDuration(item.audio_duration_ms)}
                </ThemedText>
                <View style={styles.voiceFooterRight}>
                  <ThemedText
                    style={[styles.messageTime, { color: isOwn ? ownMetaColor : otherMetaColor }]}
                  >
                    {formatMessageTime(item.created_at)}
                  </ThemedText>
                  {isOwn && renderCheckmarks(item)}
                </View>
              </View>
            </>
          ) : (
            <>
              <ThemedText
                style={[styles.messageText, { color: isOwn ? ownTextColor : otherTextColor }]}
              >
                {item.content}
                <ThemedText style={styles.metaSpacer}>
                  {'  '}
                  {formatMessageTime(item.created_at)}
                  {isOwn ? ' \u2713\u2713' : ''}
                </ThemedText>
              </ThemedText>

              <View style={styles.metaFloat}>
                <ThemedText
                  style={[
                    styles.messageTime,
                    { color: isOwn ? ownMetaColor : otherMetaColor },
                  ]}
                >
                  {formatMessageTime(item.created_at)}
                </ThemedText>
                {isOwn && renderCheckmarks(item)}
              </View>
            </>
          )}
        </Pressable>
      </View>
    );

    return (
      <>
        {item.showDateSeparator && renderDateSeparator(item.dateLabel)}
        {firstUnreadId === item.id && renderUnreadDivider()}
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
  // Main render
  // -----------------------------------------------------------------------

  return (
    <ThemedBackground style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title={partnerName}
          subtitle="Chat"
          showBackButton
          onBackPress={() => router.push('/(tabs)/notifications')}
          showBabySwitcher={false}
          leftContent={
            partnerAvatarUrl ? (
              <Image
                source={{ uri: partnerAvatarUrl }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { backgroundColor: isDark ? '#3D3330' : '#F3ECE7' }]}>
                <ThemedText style={[styles.headerAvatarInitial, { color: theme.accent }]}>
                  {partnerName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )
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
                  <IconSymbol name="bubble.right" size={36} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyTitle}>Noch kein Chatverlauf</ThemedText>
                  <ThemedText style={styles.emptyText}>
                    Schreib die erste Nachricht, um das Gespräch zu starten.
                  </ThemedText>
                </View>
              }
            />
          )}

          <ChatComposer
            draft={draft}
            onChangeDraft={setDraft}
            sending={sending}
            onSendText={handleSendText}
            onSendVoice={handleSendVoice}
            onInputFocus={() => scrollToBottom(true)}
            replyPreviewSender={replyTo ? (replyTo.sender_id === user?.id ? 'Du' : partnerName) : null}
            replyPreviewText={replyTo ? getMessagePreviewText(replyTo) : null}
            replyPreviewAccentColor={replyTo?.sender_id === user?.id ? theme.accent : '#9775FA'}
            onCancelReply={replyTo ? () => setReplyTo(null) : undefined}
            focusToken={replyTo?.id || null}
            theme={theme}
            isDark={isDark}
            bottomInset={insets.bottom}
          />
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

  // ---- Message rows ----
  messageRow: { flexDirection: 'row', paddingHorizontal: 4 },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },

  // ---- Bubble ----
  messageBubble: {
    maxWidth: '80%',
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
  checkmarks: { fontSize: 13, fontWeight: '700', marginTop: -1 },
  voiceBubble: {
    minWidth: 220,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voicePlayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBody: {
    flex: 1,
    gap: 6,
  },
  voiceTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  voiceProgressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  voiceProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  voiceFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  voiceFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

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

  // ---- Header avatar ----
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontSize: 15,
    fontWeight: '700',
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
