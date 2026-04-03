import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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
import { uploadChatAudio } from '@/lib/chatAudio';
import {
  EVENT_MESSAGE_PREVIEW,
  VOICE_MESSAGE_PREVIEW,
  formatAudioDuration,
  getMessagePreviewText,
} from '@/lib/chatMessages';
import {
  GROUP_CHAT_EVENT_RSVP_LABELS,
  type GroupChatEvent,
  type GroupChatEventRsvp,
  type GroupChatEventRsvpStatus,
  buildEventMap,
  buildEventRsvpMap,
  cancelGroupChatEvent,
  createGroupChatEvent,
  deleteGroupChatEvent,
  formatGroupEventDateTime,
  getEventRsvpCounts,
  loadGroupChatEventRsvps,
  loadGroupChatEvents,
  respondToGroupChatEvent,
  updateGroupChatEvent,
} from '@/lib/groupChatEvents';
import { supabase } from '@/lib/supabase';
import {
  type CommunityGroup,
  type GroupMemberProfile,
  deleteGroup,
  getGroupDetails,
  getGroupMembers,
  removeGroupMember,
  updateGroup,
} from '@/lib/groups';
import {
  type GroupChatMessage,
  type GroupChatMemberInfo,
  type EnrichedGroupMessage,
  loadGroupChatMessages,
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
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const eventIdsRef = useRef<Set<string>>(new Set());

  const [groupName, setGroupName] = useState('Gruppenchat');
  const [groupDetails, setGroupDetails] = useState<CommunityGroup | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDescription, setEditingGroupDescription] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [members, setMembers] = useState<GroupMemberProfile[]>([]);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberMap, setMemberMap] = useState<Map<string, GroupChatMemberInfo>>(new Map());
  const [events, setEvents] = useState<GroupChatEvent[]>([]);
  const [eventRsvps, setEventRsvps] = useState<GroupChatEventRsvp[]>([]);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedSliderMessageId, setExpandedSliderMessageId] = useState<string | null>(null);
  const [sliderMessageId, setSliderMessageId] = useState<string | null>(null);
  const [sliderPreviewTime, setSliderPreviewTime] = useState(0);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState<Date>(() => {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return nextHour;
  });
  const [eventCoverLocalUri, setEventCoverLocalUri] = useState<string | null>(null);
  const [eventCoverRemoteUrl, setEventCoverRemoteUrl] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [respondingKey, setRespondingKey] = useState<string | null>(null);
  const [cancellingEventId, setCancellingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [showEventStartPicker, setShowEventStartPicker] = useState(false);
  const [eventStartPickerDraft, setEventStartPickerDraft] = useState<Date>(() => {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return nextHour;
  });
  const {
    activeMessageId,
    currentTime,
    isPlaying,
    loadingMessageId,
    playbackRate,
    cyclePlaybackRate,
    seekToTime,
    stopPlayback,
    togglePlayback,
  } = useChatAudioPlayback('group');

  const eventMap = useMemo(() => buildEventMap(events), [events]);
  const eventRsvpMap = useMemo(() => buildEventRsvpMap(eventRsvps), [eventRsvps]);
  const enriched = useMemo(
    () => enrichGroupMessages(messages, memberMap, eventMap, user?.id),
    [messages, memberMap, eventMap, user?.id],
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
        setGroupDetails(details);
        setGroupName(details.name);
        setCanManage(
          details.current_user_role === 'owner' || details.current_user_role === 'admin',
        );
      }
    } catch (e) {
      console.error('Failed to load group details:', e);
    }
  }, [resolvedGroupId]);

  const canEditGroup = groupDetails?.current_user_role === 'owner';
  const activeMemberCount = members.length || groupDetails?.member_count || 0;

  const loadMembers = useCallback(async () => {
    if (!resolvedGroupId) return;
    try {
      const { data, error } = await getGroupMembers(resolvedGroupId);
      if (error) throw error;

      const nextMembers = data || [];
      setMembers(nextMembers);
      setMemberMap((prev) => {
        const next = new Map(prev);
        for (const member of nextMembers) {
          next.set(member.user_id, {
            user_id: member.user_id,
            display_name: member.display_name,
            avatar_url: member.avatar_url || null,
          });
        }
        return next;
      });
    } catch (e) {
      console.error('Failed to load member profiles:', e);
    }
  }, [resolvedGroupId]);

  const loadEventRsvps = useCallback(async (eventIdsOverride?: string[]) => {
    try {
      const nextEventIds = eventIdsOverride ?? Array.from(eventIdsRef.current);
      if (nextEventIds.length === 0) {
        setEventRsvps([]);
        return;
      }

      const nextRsvps = await loadGroupChatEventRsvps(nextEventIds);
      setEventRsvps(nextRsvps);
    } catch (e) {
      console.error('Failed to load event RSVPs:', e);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    if (!resolvedGroupId) return;
    try {
      const nextEvents = await loadGroupChatEvents(resolvedGroupId);
      setEvents(nextEvents);
      const nextEventIds = nextEvents.map((event) => event.id);
      eventIdsRef.current = new Set(nextEventIds);
      await loadEventRsvps(nextEventIds);
    } catch (e) {
      console.error('Failed to load group chat events:', e);
    }
  }, [loadEventRsvps, resolvedGroupId]);

  const loadMessages = useCallback(async (options?: { showSpinner?: boolean }) => {
    if (!resolvedGroupId || !user?.id) {
      setLoading(false);
      return;
    }
    const showSpinner = options?.showSpinner ?? true;
    try {
      if (showSpinner) {
        setLoading(true);
      }

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
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [resolvedGroupId, user?.id]);

  useEffect(() => {
    void loadGroup();
    void loadMembers();
    void loadEvents();
    void loadMessages();
  }, [loadEvents, loadGroup, loadMembers, loadMessages]);

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
    if (!resolvedGroupId) return;

    const eventChannel = supabase
      .channel(`group-events-${resolvedGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_group_events',
          filter: `group_id=eq.${resolvedGroupId}`,
        },
        () => {
          void loadEvents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventChannel);
    };
  }, [loadEvents, resolvedGroupId]);

  useEffect(() => {
    const rsvpChannel = supabase
      .channel(`group-event-rsvps-${resolvedGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_group_event_rsvps',
        },
        (payload) => {
          const record = payload.new as { event_id?: string } | undefined;
          const oldRecord = payload.old as { event_id?: string } | undefined;
          const targetEventId = record?.event_id ?? oldRecord?.event_id;
          if (!targetEventId || !eventIdsRef.current.has(targetEventId)) return;
          void loadEventRsvps();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rsvpChannel);
    };
  }, [loadEventRsvps, resolvedGroupId]);

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

  useEffect(() => {
    if (activeMessageId !== null) return;
    setExpandedSliderMessageId(null);
    setSliderMessageId(null);
    setSliderPreviewTime(0);
  }, [activeMessageId]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleReply = useCallback((message: GroupChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReplyTo(message);
  }, []);

  const handleOpenProfile = useCallback((targetUserId?: string | null) => {
    if (!targetUserId) return;
    router.push(`/profile/${targetUserId}` as any);
  }, []);

  const sanitizeEventDate = useCallback((value?: Date | null, fallback?: Date) => {
    const safeFallback = fallback ? new Date(fallback.getTime()) : new Date();
    if (!value) return safeFallback;
    const candidate = new Date(value.getTime());
    return Number.isNaN(candidate.getTime()) ? safeFallback : candidate;
  }, []);

  const getSafeEventPickerDateFromEvent = useCallback(
    (event: DateTimePickerEvent, date: Date | undefined, fallback?: Date) => {
      const safeFallback = sanitizeEventDate(fallback, new Date());

      if (date) {
        const nextDate = sanitizeEventDate(date, safeFallback);
        if (!Number.isNaN(nextDate.getTime())) return nextDate;
      }

      const nativeTimestamp = event.nativeEvent?.timestamp;
      if (typeof nativeTimestamp === 'number' && Number.isFinite(nativeTimestamp)) {
        return sanitizeEventDate(new Date(nativeTimestamp), safeFallback);
      }

      return safeFallback;
    },
    [sanitizeEventDate],
  );

  const resetEventForm = useCallback(() => {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    setEventTitle('');
    setEventDescription('');
    setEventLocation('');
    setEventStartsAt(nextHour);
    setEventStartPickerDraft(nextHour);
    setEventCoverLocalUri(null);
    setEventCoverRemoteUrl(null);
    setSelectedEventId(null);
  }, []);

  const openCreateEvent = useCallback(() => {
    resetEventForm();
    setEventModalMode('create');
    setShowEventModal(true);
  }, [resetEventForm]);

  const openEditEvent = useCallback((event: GroupChatEvent) => {
    setEventModalMode('edit');
    setSelectedEventId(event.id);
    setEventTitle(event.title);
    setEventDescription(event.description || '');
    setEventLocation(event.location);
    const startsAt = new Date(event.starts_at);
    setEventStartsAt(startsAt);
    setEventStartPickerDraft(startsAt);
    setEventCoverLocalUri(null);
    setEventCoverRemoteUrl(event.cover_image_url || null);
    setShowEventDetailModal(false);
    setShowEventModal(true);
  }, []);

  const openEventStartPicker = useCallback(() => {
    const safeDate = sanitizeEventDate(eventStartsAt, new Date());
    setEventStartPickerDraft(safeDate);
    setShowEventStartPicker(true);
  }, [eventStartsAt, sanitizeEventDate]);

  const commitEventStartPickerDraft = useCallback(() => {
    setEventStartsAt(sanitizeEventDate(eventStartPickerDraft, eventStartsAt));
  }, [eventStartPickerDraft, eventStartsAt, sanitizeEventDate]);

  const handlePickEventCover = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      setEventCoverLocalUri(result.assets[0].uri);
    } catch (error) {
      console.error('Failed to pick event cover:', error);
      Alert.alert('Event', 'Das Titelbild konnte nicht ausgewählt werden.');
    }
  }, []);

  const handleSendText = useCallback(async () => {
    const content = draft.trim();
    if (!user?.id || !resolvedGroupId || !content || sending) return;
    try {
      setSending(true);
      await sendGroupChatMessage(resolvedGroupId, {
        type: 'text',
        content,
        replyToId: replyTo?.id,
      });
      setDraft('');
      setReplyTo(null);
      setTimeout(() => scrollToBottom(true), 300);
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
    } finally {
      setSending(false);
    }
  }, [draft, replyTo, resolvedGroupId, scrollToBottom, sending, user?.id]);

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
      if (!user?.id || !resolvedGroupId) return;

      const audioUpload = await uploadChatAudio({
        scope: 'group',
        userId: user.id,
        localUri,
      });

      await sendGroupChatMessage(resolvedGroupId, {
        type: 'voice',
        audioStoragePath: audioUpload.storagePath,
        audioDurationMs: durationMs,
        audioMimeType: mimeType,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
      setTimeout(() => scrollToBottom(true), 300);
    },
    [replyTo, resolvedGroupId, scrollToBottom, user?.id],
  );

  const handleSaveEvent = useCallback(async () => {
    if (!resolvedGroupId || savingEvent) return;

    const trimmedTitle = eventTitle.trim();
    const trimmedLocation = eventLocation.trim();
    if (!trimmedTitle) {
      Alert.alert('Event', 'Bitte gib einen Titel ein.');
      return;
    }
    if (!trimmedLocation) {
      Alert.alert('Event', 'Bitte gib einen Ort ein.');
      return;
    }

    setSavingEvent(true);
    try {
      const payload = {
        groupId: resolvedGroupId,
        title: trimmedTitle,
        description: eventDescription,
        location: trimmedLocation,
        startsAt: eventStartsAt.toISOString(),
        coverImage: eventCoverLocalUri ? { uri: eventCoverLocalUri } : null,
        existingCoverImageUrl: eventCoverRemoteUrl,
      };

      const result =
        eventModalMode === 'create'
          ? await createGroupChatEvent(payload)
          : selectedEventId
            ? await updateGroupChatEvent({ ...payload, eventId: selectedEventId })
            : { data: null, error: new Error('Kein Event ausgewählt.') };

      if (result.error) {
        Alert.alert(
          'Event',
          result.error instanceof Error
            ? result.error.message
            : 'Das Event konnte nicht gespeichert werden.',
        );
        return;
      }

      setShowEventModal(false);
      resetEventForm();
      void loadEvents();
      setTimeout(() => scrollToBottom(true), 250);
    } catch (error) {
      Alert.alert(
        'Event',
        error instanceof Error ? error.message : 'Das Event konnte nicht gespeichert werden.',
      );
    } finally {
      setSavingEvent(false);
    }
  }, [
    eventCoverLocalUri,
    eventCoverRemoteUrl,
    eventDescription,
    eventLocation,
    eventModalMode,
    eventStartsAt,
    eventTitle,
    loadEvents,
    resetEventForm,
    resolvedGroupId,
    savingEvent,
    scrollToBottom,
    selectedEventId,
  ]);

  const handleRespondToEvent = useCallback(
    async (eventId: string, status: GroupChatEventRsvpStatus) => {
      const key = `${eventId}:${status}`;
      setRespondingKey(key);
      try {
        const { error } = await respondToGroupChatEvent(eventId, status);

        if (error) {
          Alert.alert(
            'Event',
            error instanceof Error
              ? error.message
              : 'Deine Antwort konnte nicht gespeichert werden.',
          );
          return;
        }

        await loadEventRsvps();
      } catch (error) {
        Alert.alert(
          'Event',
          error instanceof Error ? error.message : 'Deine Antwort konnte nicht gespeichert werden.',
        );
      } finally {
        setRespondingKey(null);
      }
    },
    [loadEventRsvps],
  );

  const handleCancelEvent = useCallback(
    (event: GroupChatEvent) => {
      Alert.alert(
        'Event absagen',
        `Möchtest du "${event.title}" wirklich absagen?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Absagen',
            style: 'destructive',
            onPress: async () => {
              setCancellingEventId(event.id);
              try {
                const { error } = await cancelGroupChatEvent(event.id);

                if (error) {
                  Alert.alert(
                    'Event',
                    error instanceof Error
                      ? error.message
                      : 'Das Event konnte nicht abgesagt werden.',
                  );
                  return;
                }

                await loadEvents();
              } catch (error) {
                Alert.alert(
                  'Event',
                  error instanceof Error ? error.message : 'Das Event konnte nicht abgesagt werden.',
                );
              } finally {
                setCancellingEventId(null);
              }
            },
          },
        ],
      );
    },
    [loadEvents],
  );

  const handleDeleteEvent = useCallback(
    (event: GroupChatEvent) => {
      Alert.alert(
        'Event löschen',
        `Möchtest du "${event.title}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: async () => {
              setDeletingEventId(event.id);
              try {
                const { error } = await deleteGroupChatEvent(event.id);

                if (error) {
                  Alert.alert(
                    'Event',
                    error instanceof Error
                      ? error.message
                      : 'Das Event konnte nicht gelöscht werden.',
                  );
                  return;
                }

                setShowEventDetailModal(false);
                setSelectedEventId(null);
                setEvents((current) => current.filter((entry) => entry.id !== event.id));
                setEventRsvps((current) => current.filter((entry) => entry.event_id !== event.id));
                setMessages((current) => current.filter((entry) => entry.event_id !== event.id));
              } catch (error) {
                Alert.alert(
                  'Event',
                  error instanceof Error ? error.message : 'Das Event konnte nicht gelöscht werden.',
                );
              } finally {
                setDeletingEventId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

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
              if (activeMessageId === message.id) {
                void stopPlayback();
              }
            } catch (error) {
              console.error('Fehler beim Löschen der Nachricht:', error);
              Alert.alert('Gruppenchat', 'Die Nachricht konnte gerade nicht gelöscht werden.');
            }
          },
        },
      ]);
    },
    [activeMessageId, canManage, replyTo, stopPlayback, user?.id],
  );

  const handleOpenEditGroup = useCallback(() => {
    if (!groupDetails || !canEditGroup) return;
    setEditingGroupName(groupDetails.name);
    setEditingGroupDescription(groupDetails.description || '');
    setShowEditModal(true);
  }, [canEditGroup, groupDetails]);

  const handleSaveGroup = useCallback(async () => {
    if (!groupDetails || !canEditGroup || savingGroup) return;

    const trimmedName = editingGroupName.trim();
    if (!trimmedName) {
      Alert.alert('Gruppe', 'Bitte gib einen Gruppennamen ein.');
      return;
    }

    setSavingGroup(true);
    const { data, error } = await updateGroup({
      groupId: groupDetails.id,
      name: trimmedName,
      description: editingGroupDescription,
    });
    setSavingGroup(false);

    if (error || !data) {
      Alert.alert(
        'Gruppe',
        error instanceof Error ? error.message : 'Die Gruppe konnte nicht gespeichert werden.',
      );
      return;
    }

    setGroupDetails(data);
    setGroupName(data.name);
    setShowEditModal(false);
  }, [canEditGroup, editingGroupDescription, editingGroupName, groupDetails, savingGroup]);

  const handleConfirmDeleteGroup = useCallback(async () => {
    if (!groupDetails || !canEditGroup || deletingGroup) return;

    setDeletingGroup(true);
    const { error } = await deleteGroup(groupDetails.id);
    setDeletingGroup(false);

    if (error) {
      Alert.alert(
        'Gruppe',
        error instanceof Error ? error.message : 'Die Gruppe konnte nicht gelöscht werden.',
      );
      return;
    }

    setShowEditModal(false);
    router.replace('/(tabs)/groups' as any);
  }, [canEditGroup, deletingGroup, groupDetails]);

  const handleDeleteGroup = useCallback(() => {
    if (!groupDetails || !canEditGroup || deletingGroup) return;

    Alert.alert(
      'Gruppe löschen',
      'Möchtest du diese Gruppe wirklich löschen? Alle Nachrichten und Mitgliedschaften gehen dabei dauerhaft verloren.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Wirklich löschen?',
              `Die Gruppe "${groupDetails.name}" wird dauerhaft gelöscht.`,
              [
                { text: 'Abbrechen', style: 'cancel' },
                {
                  text: 'Ja, löschen',
                  style: 'destructive',
                  onPress: () => {
                    void handleConfirmDeleteGroup();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [canEditGroup, deletingGroup, groupDetails, handleConfirmDeleteGroup]);

  const handleRemoveMember = useCallback(
    (member: GroupMemberProfile) => {
      if (!groupDetails || !canEditGroup || removingMemberId) return;
      if (member.role === 'owner') return;

      Alert.alert(
        'Mitglied entfernen',
        `${member.display_name} wird aus der Gruppe entfernt.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Entfernen',
            style: 'destructive',
            onPress: async () => {
              setRemovingMemberId(member.user_id);
              const { error } = await removeGroupMember(groupDetails.id, member.user_id);
              setRemovingMemberId(null);

              if (error) {
                Alert.alert(
                  'Gruppe',
                  error instanceof Error
                    ? error.message
                    : 'Das Mitglied konnte nicht entfernt werden.',
                );
                return;
              }

              await Promise.all([loadGroup(), loadMembers()]);
            },
          },
        ],
      );
    },
    [canEditGroup, groupDetails, loadGroup, loadMembers, removingMemberId],
  );

  const getCurrentUserEventRsvp = useCallback(
    (eventId: string) => {
      const eventEntries = eventRsvpMap.get(eventId) || [];
      return eventEntries.find((entry) => entry.user_id === user?.id)?.status ?? null;
    },
    [eventRsvpMap, user?.id],
  );

  const canEditEvent = useCallback(
    (event?: GroupChatEvent | null) => {
      if (!event || !user?.id) return false;
      return event.created_by_user_id === user.id || canManage;
    },
    [canManage, user?.id],
  );

  const canCancelOrDeleteEvent = useCallback(
    (event?: GroupChatEvent | null) => {
      if (!event || !user?.id) return false;
      return event.created_by_user_id === user.id || canEditGroup;
    },
    [canEditGroup, user?.id],
  );

  const selectedEvent = selectedEventId ? eventMap.get(selectedEventId) ?? null : null;

  const handleMessageLongPress = useCallback(
    (message: GroupChatMessage) => {
      if (message.message_type === 'event' && message.event_id) {
        setSelectedEventId(message.event_id);
        setShowEventDetailModal(true);
        return;
      }

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

  const handleVoiceSliderStart = useCallback(
    (message: GroupChatMessage) => {
      setExpandedSliderMessageId(message.id);
      setSliderMessageId(message.id);
      setSliderPreviewTime(activeMessageId === message.id ? currentTime : 0);
    },
    [activeMessageId, currentTime],
  );

  const handleVoiceSliderComplete = useCallback(
    (message: GroupChatMessage, nextTime: number) => {
      setSliderMessageId(message.id);
      setSliderPreviewTime(nextTime);
      void seekToTime(message, nextTime).finally(() => {
        setSliderMessageId((current) => (current === message.id ? null : current));
      });
    },
    [seekToTime],
  );

  const getMemberRoleLabel = useCallback((role: GroupMemberProfile['role']) => {
    switch (role) {
      case 'owner':
        return 'Besitzer';
      case 'admin':
        return 'Admin';
      default:
        return 'Mitglied';
    }
  }, []);

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
    const quotedPreview =
      item.quotedMessageType === 'voice'
        ? VOICE_MESSAGE_PREVIEW
        : item.quotedMessageType === 'event'
          ? (item.quotedEventTitle ? `Event: ${item.quotedEventTitle}` : EVENT_MESSAGE_PREVIEW)
          : item.quotedContent;
    if (!quotedPreview) return null;
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
          {quotedPreview}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderEventRsvpButtons = useCallback(
    (event: GroupChatEvent, compact = false) => {
      const counts = getEventRsvpCounts(eventRsvpMap.get(event.id));
      const currentRsvp = getCurrentUserEventRsvp(event.id);
      const isCancelled = event.status === 'cancelled';

      return (
        <View style={[styles.eventRsvpRow, compact && styles.eventRsvpRowCompact]}>
          {(['yes', 'maybe', 'no'] as GroupChatEventRsvpStatus[]).map((status) => {
            const isActive = currentRsvp === status;
            const isLoading = respondingKey === `${event.id}:${status}`;

            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.eventRsvpButton,
                  compact && styles.eventRsvpButtonCompact,
                  {
                    backgroundColor: isActive
                      ? theme.accent
                      : isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#FFFFFF',
                    borderColor: isActive ? theme.accent : isDark ? '#4A3F3B' : '#E8DDD6',
                    opacity: isCancelled ? 0.5 : 1,
                  },
                ]}
                onPress={() => void handleRespondToEvent(event.id, status)}
                disabled={isCancelled || isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={isActive ? '#FFFFFF' : theme.accent} />
                ) : (
                  <>
                    <ThemedText
                      style={[
                        styles.eventRsvpLabel,
                        {
                          color: isActive ? '#FFFFFF' : theme.text,
                        },
                      ]}
                    >
                      {GROUP_CHAT_EVENT_RSVP_LABELS[status]}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.eventRsvpCount,
                        {
                          color: isActive ? 'rgba(255,255,255,0.86)' : theme.textTertiary,
                        },
                      ]}
                    >
                      {counts[status]}
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    },
    [eventRsvpMap, getCurrentUserEventRsvp, handleRespondToEvent, isDark, respondingKey, theme.accent, theme.text, theme.textTertiary],
  );

  const renderItem = ({ item }: { item: EnrichedGroupMessage }) => {
    const isOwn = item.sender_id === user?.id;
    const isHighlighted = highlightId === item.id;
    const event = item.event_id ? eventMap.get(item.event_id) ?? null : null;
    const isActiveVoiceMessage = activeMessageId === item.id;
    const isSlidingVoiceMessage = sliderMessageId === item.id;
    const isExpandedVoiceSlider = expandedSliderMessageId === item.id;
    const durationSeconds = Math.max((item.audio_duration_ms ?? 0) / 1000, 0);
    const voiceSliderValue = isSlidingVoiceMessage
      ? sliderPreviewTime
      : isActiveVoiceMessage
        ? currentTime
        : 0;

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
              item.message_type === 'event' && styles.eventBubble,
              item.message_type === 'voice' && styles.voiceBubble,
              {
                backgroundColor:
                  item.message_type === 'event'
                    ? (isDark ? '#2A2321' : '#FFFDF8')
                    : isOwn
                      ? ownBubbleBg
                      : otherBubbleBg,
                borderWidth: isHighlighted ? 1.5 : 0,
                borderColor: isHighlighted ? (isDark ? '#FFF' : theme.accent) : 'transparent',
              },
            ]}
            onPress={() => {
              if (item.message_type === 'event' && item.event_id) {
                setSelectedEventId(item.event_id);
                setShowEventDetailModal(true);
              }
            }}
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
                    {isExpandedVoiceSlider ? (
                      <Slider
                        style={styles.voiceSlider}
                        minimumValue={0}
                        maximumValue={Math.max(durationSeconds, 0.1)}
                        value={Math.min(voiceSliderValue, Math.max(durationSeconds, 0.1))}
                        minimumTrackTintColor={isOwn ? '#FFFFFF' : theme.accent}
                        maximumTrackTintColor={
                          isOwn
                            ? 'rgba(255,255,255,0.24)'
                            : isDark
                              ? '#4A3F3B'
                              : '#E8DDD6'
                        }
                        thumbTintColor={isOwn ? '#FFFFFF' : theme.accent}
                        disabled={loadingMessageId === item.id || durationSeconds <= 0}
                        onSlidingStart={() => handleVoiceSliderStart(item)}
                        onValueChange={(value) => {
                          setSliderMessageId(item.id);
                          setSliderPreviewTime(value);
                        }}
                        onSlidingComplete={(value) => handleVoiceSliderComplete(item, value)}
                      />
                    ) : (
                      <Pressable
                        style={styles.voiceProgressCollapsed}
                        onPress={() => setExpandedSliderMessageId(item.id)}
                      >
                        <View
                          style={[
                            styles.voiceProgressCollapsedTrack,
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
                              styles.voiceProgressCollapsedFill,
                              {
                                backgroundColor: isOwn ? '#FFFFFF' : theme.accent,
                                width: `${durationSeconds > 0 ? (voiceSliderValue / durationSeconds) * 100 : 0}%`,
                              },
                            ]}
                          />
                        </View>
                      </Pressable>
                    )}
                  </View>
                </View>

                <View style={styles.voiceFooter}>
                  <View style={styles.voiceFooterLeft}>
                    <ThemedText
                      style={[
                        styles.messageTime,
                        styles.voiceElapsedTime,
                        { color: isOwn ? ownMetaColor : otherMetaColor },
                      ]}
                    >
                      {formatAudioDuration(voiceSliderValue * 1000)}{' '}
                      / {formatAudioDuration(item.audio_duration_ms)}
                    </ThemedText>
                    {activeMessageId === item.id ? (
                      <TouchableOpacity
                        style={[
                          styles.voiceSpeedButton,
                          {
                            backgroundColor: isOwn
                              ? 'rgba(255,255,255,0.18)'
                              : isDark
                                ? '#2A2321'
                                : '#FFFFFF',
                          },
                        ]}
                        onPress={cyclePlaybackRate}
                        activeOpacity={0.8}
                      >
                        <ThemedText
                          style={[
                            styles.voiceSpeedButtonText,
                            { color: isOwn ? '#FFFFFF' : theme.accent },
                          ]}
                        >
                          {playbackRate}x
                        </ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <ThemedText
                    style={[styles.messageTime, { color: isOwn ? ownMetaColor : otherMetaColor }]}
                  >
                    {formatMessageTime(item.created_at)}
                  </ThemedText>
                </View>
              </>
            ) : item.message_type === 'event' ? (
              event ? (
                <>
                  {event.cover_image_url ? (
                    <Image
                      source={{ uri: event.cover_image_url }}
                      style={styles.eventCoverImage}
                    />
                  ) : null}

                  <View style={styles.eventHeaderRow}>
                    <View style={styles.eventHeaderBody}>
                      <ThemedText style={[styles.eventTitle, { color: theme.text }]}>
                        {event.title}
                      </ThemedText>
                      <View style={styles.eventMetaLine}>
                        <IconSymbol name="calendar" size={13} color={theme.textTertiary} />
                        <ThemedText style={[styles.eventMetaText, { color: theme.textTertiary }]}>
                          {formatGroupEventDateTime(event.starts_at)}
                        </ThemedText>
                      </View>
                      <View style={styles.eventMetaLine}>
                        <IconSymbol name="mappin.and.ellipse" size={13} color={theme.textTertiary} />
                        <ThemedText style={[styles.eventMetaText, { color: theme.textTertiary }]} numberOfLines={1}>
                          {event.location}
                        </ThemedText>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.eventStatusBadge,
                        {
                          backgroundColor:
                            event.status === 'cancelled'
                              ? (isDark ? 'rgba(214,84,65,0.16)' : '#FFF1EF')
                              : (isDark ? 'rgba(200,159,129,0.18)' : '#F4E7DB'),
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.eventStatusBadgeText,
                          { color: event.status === 'cancelled' ? '#D65441' : '#C0895B' },
                        ]}
                      >
                        {event.status === 'cancelled' ? 'Abgesagt' : 'Aktiv'}
                      </ThemedText>
                    </View>
                  </View>

                  {event.description ? (
                    <ThemedText
                      style={[styles.eventDescription, { color: theme.textTertiary }]}
                      numberOfLines={3}
                    >
                      {event.description}
                    </ThemedText>
                  ) : null}

                  {renderEventRsvpButtons(event, true)}

                  <View style={styles.eventFooterRow}>
                    <ThemedText style={[styles.eventFooterText, { color: theme.textTertiary }]}>
                      Tippen für Details
                    </ThemedText>
                    <ThemedText style={[styles.messageTime, { color: theme.textTertiary }]}>
                      {formatMessageTime(item.created_at)}
                    </ThemedText>
                  </View>
                </>
              ) : (
                <ThemedText style={[styles.messageText, { color: theme.textTertiary }]}>
                  Event wird geladen…
                </ThemedText>
              )
            ) : (
              <>
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
              </>
            )}
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

  const eventCoverPreviewUri = eventCoverLocalUri || eventCoverRemoteUrl;

  const getParticipantsForStatus = useCallback(
    (eventId: string, status: GroupChatEventRsvpStatus) => {
      return (eventRsvpMap.get(eventId) || [])
        .filter((entry) => entry.status === status)
        .map((entry) => memberMap.get(entry.user_id)?.display_name || 'Unbekannt');
    },
    [eventRsvpMap, memberMap],
  );

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <ThemedBackground style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header
          title={groupName}
          subtitle={activeMemberCount > 0 ? `${activeMemberCount} Mitglieder` : 'Gruppenchat'}
          showBackButton
          onBackPress={() => {
            if (from === 'notifications') {
              router.push('/(tabs)/notifications' as any);
            } else {
              router.push('/(tabs)/groups' as any);
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
          rightContent={
            canEditGroup ? (
              <TouchableOpacity
                style={[
                  styles.headerActionButton,
                  { backgroundColor: isDark ? '#2A2321' : '#F3ECE7' },
                ]}
                onPress={handleOpenEditGroup}
                activeOpacity={0.75}
              >
                <IconSymbol
                  name="pencil"
                  size={16}
                  color={isDark ? '#E9D8C2' : '#7D5A50'}
                />
              </TouchableOpacity>
            ) : null
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

          <ChatComposer
            draft={draft}
            onChangeDraft={setDraft}
            sending={sending}
            onSendText={handleSendText}
            onSendVoice={handleSendVoice}
            onInputFocus={() => scrollToBottom(true)}
            replyPreviewSender={replyTo ? replyToSenderName : null}
            replyPreviewText={
              replyTo
                ? getMessagePreviewText({
                    ...replyTo,
                    event_title: replyTo.event_id ? eventMap.get(replyTo.event_id)?.title ?? null : null,
                  })
                : null
            }
            replyPreviewAccentColor={replyTo ? replyToSenderColor : theme.accent}
            onCancelReply={replyTo ? () => setReplyTo(null) : undefined}
            focusToken={replyTo?.id || null}
            theme={theme}
            isDark={isDark}
            bottomInset={insets.bottom}
            leadingAction={
              <TouchableOpacity
                style={[
                  styles.headerActionButton,
                  { backgroundColor: isDark ? '#3D3330' : '#E8DDD6' },
                ]}
                onPress={openCreateEvent}
                activeOpacity={0.8}
              >
                <IconSymbol name="calendar.badge.plus" size={17} color={theme.accent} />
              </TouchableOpacity>
            }
          />
        </KeyboardAvoidingView>
      </View>

      <Modal
        visible={showEventDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEventDetailModal(false)}
      >
        <View style={styles.modalFlex}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: isDark ? '#1E1916' : '#FFFAF5',
                  borderColor: isDark ? '#3D3330' : '#E8DDD6',
                },
              ]}
            >
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
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
                    onPress={() => setShowEventDetailModal(false)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.modalCancel, { color: theme.textTertiary }]}>
                      Schließen
                    </ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                    Event
                  </ThemedText>
                  <View style={styles.modalPlaceholder} />
                </View>

                {selectedEvent ? (
                  <>
                    {selectedEvent.cover_image_url ? (
                      <Image
                        source={{ uri: selectedEvent.cover_image_url }}
                        style={styles.detailEventCoverImage}
                      />
                    ) : null}

                    <View style={styles.detailEventHeader}>
                      <View style={styles.detailEventHeaderText}>
                        <ThemedText style={[styles.detailEventTitle, { color: theme.text }]}>
                          {selectedEvent.title}
                        </ThemedText>
                        <ThemedText style={[styles.detailEventMeta, { color: theme.textTertiary }]}>
                          {formatGroupEventDateTime(selectedEvent.starts_at)}
                        </ThemedText>
                        <ThemedText style={[styles.detailEventMeta, { color: theme.textTertiary }]}>
                          {selectedEvent.location}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.eventStatusBadge,
                          {
                            backgroundColor:
                              selectedEvent.status === 'cancelled'
                                ? (isDark ? 'rgba(214,84,65,0.16)' : '#FFF1EF')
                                : (isDark ? 'rgba(200,159,129,0.18)' : '#F4E7DB'),
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.eventStatusBadgeText,
                            { color: selectedEvent.status === 'cancelled' ? '#D65441' : '#C0895B' },
                          ]}
                        >
                          {selectedEvent.status === 'cancelled' ? 'Abgesagt' : 'Aktiv'}
                        </ThemedText>
                      </View>
                    </View>

                    {selectedEvent.description ? (
                      <ThemedText style={[styles.detailEventDescription, { color: theme.text }]}>
                        {selectedEvent.description}
                      </ThemedText>
                    ) : null}

                    {renderEventRsvpButtons(selectedEvent)}

                    {canEditEvent(selectedEvent) || canCancelOrDeleteEvent(selectedEvent) ? (
                      <View style={styles.detailEventActionRow}>
                        {canEditEvent(selectedEvent) ? (
                          <TouchableOpacity
                            style={[
                              styles.detailEventActionButton,
                              {
                                backgroundColor: isDark ? '#2A2321' : '#F3ECE7',
                                borderColor: isDark ? '#3D3330' : '#E8DDD6',
                              },
                            ]}
                            onPress={() => openEditEvent(selectedEvent)}
                            activeOpacity={0.85}
                          >
                            <IconSymbol name="pencil" size={14} color={theme.text} />
                            <ThemedText style={[styles.detailEventActionText, { color: theme.text }]}>
                              Bearbeiten
                            </ThemedText>
                          </TouchableOpacity>
                        ) : null}

                        {canCancelOrDeleteEvent(selectedEvent) ? (
                          <TouchableOpacity
                            style={[
                              styles.detailEventActionButton,
                              {
                                backgroundColor: isDark ? 'rgba(214,84,65,0.12)' : '#FFF4F2',
                                borderColor: isDark ? '#5C2B2B' : '#F0C8C3',
                                opacity: cancellingEventId === selectedEvent.id ? 0.7 : 1,
                              },
                            ]}
                            onPress={() => handleCancelEvent(selectedEvent)}
                            disabled={selectedEvent.status === 'cancelled' || cancellingEventId === selectedEvent.id}
                            activeOpacity={0.85}
                          >
                            {cancellingEventId === selectedEvent.id ? (
                              <ActivityIndicator size="small" color="#D65441" />
                            ) : (
                              <>
                                <IconSymbol name="xmark.circle" size={14} color="#D65441" />
                                <ThemedText style={styles.detailEventCancelText}>Absagen</ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : null}

                        {canCancelOrDeleteEvent(selectedEvent) ? (
                          <TouchableOpacity
                            style={[
                              styles.detailEventActionButton,
                              {
                                backgroundColor: isDark ? 'rgba(214,84,65,0.12)' : '#FFF4F2',
                                borderColor: isDark ? '#5C2B2B' : '#F0C8C3',
                                opacity: deletingEventId === selectedEvent.id ? 0.7 : 1,
                              },
                            ]}
                            onPress={() => handleDeleteEvent(selectedEvent)}
                            disabled={deletingEventId === selectedEvent.id}
                            activeOpacity={0.85}
                          >
                            {deletingEventId === selectedEvent.id ? (
                              <ActivityIndicator size="small" color="#D65441" />
                            ) : (
                              <>
                                <IconSymbol name="trash.fill" size={14} color="#D65441" />
                                <ThemedText style={styles.detailEventDeleteText}>Löschen</ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}

                    {(['yes', 'maybe', 'no'] as GroupChatEventRsvpStatus[]).map((status) => {
                      const participants = getParticipantsForStatus(selectedEvent.id, status);
                      return (
                        <View
                          key={status}
                          style={[
                            styles.eventParticipantSection,
                            {
                              backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                              borderColor: isDark ? '#3D3330' : '#E8DDD6',
                            },
                          ]}
                        >
                          <View style={styles.eventParticipantHeader}>
                            <ThemedText style={[styles.eventParticipantTitle, { color: theme.text }]}>
                              {GROUP_CHAT_EVENT_RSVP_LABELS[status]}
                            </ThemedText>
                            <ThemedText style={[styles.eventParticipantCount, { color: theme.textTertiary }]}>
                              {participants.length}
                            </ThemedText>
                          </View>
                          {participants.length > 0 ? (
                            participants.map((participant) => (
                              <ThemedText
                                key={`${status}-${participant}`}
                                style={[styles.eventParticipantName, { color: theme.textTertiary }]}
                              >
                                {participant}
                              </ThemedText>
                            ))
                          ) : (
                            <ThemedText style={[styles.eventParticipantEmpty, { color: theme.textTertiary }]}>
                              Noch keine Antworten
                            </ThemedText>
                          )}
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.accent} />
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEventModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEventModal(false)}
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
                  borderColor: isDark ? '#3D3330' : '#E8DDD6',
                },
              ]}
            >
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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
                    onPress={() => {
                      setShowEventModal(false);
                      resetEventForm();
                    }}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.modalCancel, { color: theme.textTertiary }]}>
                      Abbrechen
                    </ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                    {eventModalMode === 'create' ? 'Event erstellen' : 'Event bearbeiten'}
                  </ThemedText>
                  <View style={styles.modalPlaceholder} />
                </View>

                <TextInput
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Titel"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                      borderColor: isDark ? '#3D3330' : '#E8DDD6',
                    },
                  ]}
                />

                <TextInput
                  value={eventLocation}
                  onChangeText={setEventLocation}
                  placeholder="Ort"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                      borderColor: isDark ? '#3D3330' : '#E8DDD6',
                    },
                  ]}
                />

                <TextInput
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  placeholder="Beschreibung (optional)"
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  style={[
                    styles.modalInput,
                    styles.modalTextArea,
                    {
                      color: theme.text,
                      backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                      borderColor: isDark ? '#3D3330' : '#E8DDD6',
                    },
                  ]}
                />

                <TouchableOpacity
                  style={[
                    styles.eventPickerButton,
                    {
                      backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                      borderColor: isDark ? '#3D3330' : '#E8DDD6',
                    },
                  ]}
                  onPress={openEventStartPicker}
                  activeOpacity={0.85}
                >
                  <IconSymbol name="calendar.badge.clock" size={16} color={theme.accent} />
                  <View style={styles.eventPickerBody}>
                    <ThemedText style={[styles.eventPickerLabel, { color: theme.textTertiary }]}>
                      Beginn
                    </ThemedText>
                    <ThemedText style={[styles.eventPickerText, { color: theme.text }]}>
                      {eventStartsAt.toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                  </View>
                </TouchableOpacity>

                {Platform.OS !== 'ios' && showEventStartPicker ? (
                  <View
                    style={[
                      styles.datePickerContainer,
                      {
                        backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                        borderColor: isDark ? '#3D3330' : '#E8DDD6',
                      },
                    ]}
                  >
                    <DateTimePicker
                      value={sanitizeEventDate(eventStartPickerDraft, eventStartsAt)}
                      minimumDate={new Date(2000, 0, 1)}
                      maximumDate={new Date(2100, 11, 31, 23, 59, 59, 999)}
                      mode="datetime"
                      display="default"
                      themeVariant={isDark ? 'dark' : 'light'}
                      accentColor={theme.accent}
                      onChange={(event, date) => {
                        if (event.type === 'dismissed') return;
                        const nextStart = getSafeEventPickerDateFromEvent(
                          event,
                          date,
                          eventStartPickerDraft,
                        );
                        setEventStartPickerDraft(nextStart);
                      }}
                      style={styles.dateTimePicker}
                    />
                    <View style={styles.datePickerActions}>
                      <TouchableOpacity
                        style={[styles.datePickerDone, { backgroundColor: theme.accent }]}
                        onPress={() => {
                          commitEventStartPickerDraft();
                          setShowEventStartPicker(false);
                        }}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.datePickerDoneText}>Fertig</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}


                <TouchableOpacity
                  style={[
                    styles.eventCoverButton,
                    {
                      backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                      borderColor: isDark ? '#3D3330' : '#E8DDD6',
                    },
                  ]}
                  onPress={() => void handlePickEventCover()}
                  activeOpacity={0.85}
                >
                  <IconSymbol name="photo" size={16} color={theme.accent} />
                  <ThemedText style={[styles.eventCoverButtonText, { color: theme.text }]}>
                    Titelbild auswählen
                  </ThemedText>
                </TouchableOpacity>

                {eventCoverPreviewUri ? (
                  <Image
                    source={{ uri: eventCoverPreviewUri }}
                    style={styles.eventCoverPreview}
                  />
                ) : null}

                <TouchableOpacity
                  style={[styles.saveGroupButton, { opacity: savingEvent ? 0.7 : 1 }]}
                  onPress={() => void handleSaveEvent()}
                  disabled={savingEvent}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#D4A88C', '#C89F81']}
                    style={styles.saveGroupButtonGradient}
                  >
                    {savingEvent ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.saveGroupButtonText}>
                        {eventModalMode === 'create' ? 'Event posten' : 'Event speichern'}
                      </ThemedText>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>

              {Platform.OS === 'ios' && showEventStartPicker ? (
                <Modal
                  visible={showEventStartPicker}
                  transparent
                  animationType="fade"
                  onRequestClose={() => {
                    commitEventStartPickerDraft();
                    setShowEventStartPicker(false);
                  }}
                >
                  <View style={styles.manualPickerOverlay}>
                    <TouchableOpacity
                      style={StyleSheet.absoluteFill}
                      onPress={() => {
                        commitEventStartPickerDraft();
                        setShowEventStartPicker(false);
                      }}
                      activeOpacity={1}
                    />
                    <View
                      style={[
                        styles.manualPickerCard,
                        {
                          backgroundColor: isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                        },
                      ]}
                    >
                      <View style={styles.manualPickerHeader}>
                        <TouchableOpacity
                          onPress={() => setShowEventStartPicker(false)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <ThemedText style={[styles.manualPickerActionText, { color: theme.textTertiary }]}>
                            Abbrechen
                          </ThemedText>
                        </TouchableOpacity>
                        <ThemedText style={[styles.manualPickerTitle, { color: theme.text }]}>
                          Beginn
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => {
                            commitEventStartPickerDraft();
                            setShowEventStartPicker(false);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <ThemedText style={[styles.manualPickerActionText, { color: theme.accent }]}>
                            Fertig
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={sanitizeEventDate(eventStartPickerDraft, eventStartsAt)}
                        minimumDate={new Date(2000, 0, 1)}
                        maximumDate={new Date(2100, 11, 31, 23, 59, 59, 999)}
                        mode="datetime"
                        display="spinner"
                        locale="de-DE"
                        onChange={(event, date) => {
                          if (event.type === 'dismissed') return;
                          setEventStartPickerDraft((prev) =>
                            getSafeEventPickerDateFromEvent(event, date, prev),
                          );
                        }}
                        accentColor={theme.accent}
                        themeVariant={isDark ? 'dark' : 'light'}
                        style={styles.manualPickerSpinner}
                      />
                    </View>
                  </View>
                </Modal>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
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
                  borderColor: isDark ? '#3D3330' : '#E8DDD6',
                },
              ]}
            >
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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
                    onPress={() => setShowEditModal(false)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.modalCancel, { color: theme.textTertiary }]}>
                      Abbrechen
                    </ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                    Gruppe bearbeiten
                  </ThemedText>
                  <View style={styles.modalPlaceholder} />
                </View>

                <TextInput
                  value={editingGroupName}
                  onChangeText={setEditingGroupName}
                  placeholder="Gruppenname"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                      borderColor: isDark ? '#3D3330' : '#E8DDD6',
                    },
                  ]}
                />

                <TextInput
                  value={editingGroupDescription}
                  onChangeText={setEditingGroupDescription}
                  placeholder="Beschreibung"
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  style={[
                    styles.modalInput,
                    styles.modalTextArea,
                    {
                      color: theme.text,
                      backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                      borderColor: isDark ? '#3D3330' : '#E8DDD6',
                    },
                  ]}
                />

                <TouchableOpacity
                  style={[styles.saveGroupButton, { opacity: savingGroup ? 0.7 : 1 }]}
                  onPress={() => void handleSaveGroup()}
                  disabled={savingGroup}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#D4A88C', '#C89F81']}
                    style={styles.saveGroupButtonGradient}
                  >
                    {savingGroup ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.saveGroupButtonText}>Speichern</ThemedText>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {canEditGroup ? (
                  <>
                    <View
                      style={[
                        styles.memberSection,
                        {
                          backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
                          borderColor: isDark ? '#3D3330' : '#E8DDD6',
                        },
                      ]}
                    >
                      <View style={styles.memberSectionHeader}>
                        <ThemedText style={[styles.memberSectionTitle, { color: theme.text }]}>
                          Mitglieder
                        </ThemedText>
                        <ThemedText style={[styles.memberSectionCount, { color: theme.textTertiary }]}>
                          {activeMemberCount}
                        </ThemedText>
                      </View>

                      {members.map((member, index) => {
                        const isRemoving = removingMemberId === member.user_id;
                        const isOwner = member.role === 'owner';
                        const isCurrentUser = member.user_id === user?.id;
                        const canRemoveMember = !isOwner && !isCurrentUser;
                        const accentColor = getSenderColor(member.user_id);

                        return (
                          <View
                            key={member.user_id}
                            style={[
                              styles.memberRow,
                              index < members.length - 1 && {
                                borderBottomWidth: 1,
                                borderBottomColor: isDark ? '#3D3330' : '#E8DDD6',
                              },
                            ]}
                          >
                            {member.avatar_url ? (
                              <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
                            ) : (
                              <View
                                style={[
                                  styles.memberAvatarPlaceholder,
                                  { backgroundColor: `${accentColor}30` },
                                ]}
                              >
                                <ThemedText style={[styles.memberAvatarInitial, { color: accentColor }]}>
                                  {member.display_name.charAt(0).toUpperCase()}
                                </ThemedText>
                              </View>
                            )}

                            <View style={styles.memberBody}>
                              <View style={styles.memberNameRow}>
                                <ThemedText
                                  style={[styles.memberName, { color: theme.text }]}
                                  numberOfLines={1}
                                >
                                  {member.display_name}
                                </ThemedText>
                                {isCurrentUser ? (
                                  <ThemedText style={[styles.memberYouBadge, { color: theme.textTertiary }]}>
                                    Du
                                  </ThemedText>
                                ) : null}
                              </View>
                              <ThemedText style={[styles.memberRole, { color: theme.textTertiary }]}>
                                {getMemberRoleLabel(member.role)}
                              </ThemedText>
                            </View>

                            {canRemoveMember ? (
                              <TouchableOpacity
                                style={[
                                  styles.memberRemoveButton,
                                  {
                                    borderColor: isDark ? '#5C2B2B' : '#F0C8C3',
                                    backgroundColor: isDark ? 'rgba(214,84,65,0.12)' : '#FFF4F2',
                                    opacity: isRemoving ? 0.7 : 1,
                                  },
                                ]}
                                onPress={() => handleRemoveMember(member)}
                                disabled={isRemoving}
                                activeOpacity={0.85}
                              >
                                {isRemoving ? (
                                  <ActivityIndicator size="small" color="#D65441" />
                                ) : (
                                  <ThemedText style={styles.memberRemoveButtonText}>
                                    Entfernen
                                  </ThemedText>
                                )}
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.deleteGroupButton,
                        {
                          borderColor: isDark ? '#5C2B2B' : '#F0C8C3',
                          backgroundColor: isDark ? 'rgba(214,84,65,0.12)' : '#FFF4F2',
                          opacity: deletingGroup ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleDeleteGroup}
                      disabled={deletingGroup}
                      activeOpacity={0.85}
                    >
                      {deletingGroup ? (
                        <ActivityIndicator size="small" color="#D65441" />
                      ) : (
                        <>
                          <IconSymbol name="trash.fill" size={16} color="#D65441" />
                          <ThemedText style={styles.deleteGroupButtonText}>Gruppe löschen</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  eventBubble: {
    minWidth: 260,
    overflow: 'hidden',
  },
  eventCoverImage: {
    width: '100%',
    height: 148,
    borderRadius: 12,
    marginBottom: 10,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventHeaderBody: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  eventMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  eventMetaText: {
    fontSize: 13,
    flex: 1,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  eventStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eventStatusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  eventRsvpRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  eventRsvpRowCompact: {
    marginTop: 10,
  },
  eventRsvpButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  eventRsvpButtonCompact: {
    minHeight: 38,
  },
  eventRsvpLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  eventRsvpCount: {
    fontSize: 12,
    marginTop: 2,
  },
  eventFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventFooterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  voiceBubble: {
    minWidth: 255,
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
    gap: 2,
  },
  voiceTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  voiceSlider: {
    width: '100%',
    height: 28,
    marginLeft: -10,
  },
  voiceProgressCollapsed: {
    width: '100%',
    paddingVertical: 10,
    justifyContent: 'center',
  },
  voiceProgressCollapsedTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  voiceProgressCollapsedFill: {
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
  voiceFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  voiceSpeedButton: {
    minWidth: 44,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  voiceSpeedButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  voiceElapsedTime: {
    flexShrink: 1,
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
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Edit modal ----
  modalFlex: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '88%',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
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
    width: 70,
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  modalTextArea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  saveGroupButton: {
    marginTop: 4,
  },
  saveGroupButtonGradient: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  eventPickerButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventPickerBody: {
    flex: 1,
  },
  eventPickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  eventPickerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerContainer: {
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  dateTimePicker: {
    width: '100%',
  },
  datePickerActions: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  datePickerDone: {
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerDoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  manualPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  manualPickerCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  manualPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  manualPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  manualPickerActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  manualPickerSpinner: {
    width: '100%',
  },
  eventCoverButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventCoverButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventCoverPreview: {
    width: '100%',
    height: 180,
    borderRadius: 18,
  },
  detailEventCoverImage: {
    width: '100%',
    height: 200,
    borderRadius: 18,
  },
  detailEventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailEventHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  detailEventTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  detailEventMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailEventDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailEventActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailEventActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detailEventActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailEventCancelText: {
    color: '#D65441',
    fontSize: 14,
    fontWeight: '700',
  },
  detailEventDeleteText: {
    color: '#D65441',
    fontSize: 14,
    fontWeight: '700',
  },
  eventParticipantSection: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eventParticipantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventParticipantTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventParticipantCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  eventParticipantName: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  eventParticipantEmpty: {
    fontSize: 13,
    lineHeight: 18,
  },
  memberSection: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  memberSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  memberSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberSectionCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitial: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  memberYouBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 13,
    marginTop: 2,
  },
  memberRemoveButton: {
    minWidth: 96,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  memberRemoveButtonText: {
    color: '#D65441',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteGroupButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteGroupButtonText: {
    color: '#D65441',
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
