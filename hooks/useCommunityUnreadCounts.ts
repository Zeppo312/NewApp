import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { supabase } from '@/lib/supabase';
import { getTotalGroupChatUnreadCount } from '@/lib/groupChat';

type CommunityUnreadCounts = {
  unreadMessageCount: number;
  unreadChatCount: number;
  unreadGroupChatCount: number;
  unreadActivityCount: number;
  unreadCommentCount: number;
  unreadFollowCount: number;
  unreadNotificationCount: number;
  unreadCommunityTotal: number;
};

const EMPTY_COUNTS: CommunityUnreadCounts = {
  unreadMessageCount: 0,
  unreadChatCount: 0,
  unreadGroupChatCount: 0,
  unreadActivityCount: 0,
  unreadCommentCount: 0,
  unreadFollowCount: 0,
  unreadNotificationCount: 0,
  unreadCommunityTotal: 0,
};

const ACTIVITY_TYPES = new Set(['like_post', 'like_comment', 'like_nested_comment']);
const COMMENT_TYPES = new Set(['comment', 'reply']);

export function useCommunityUnreadCounts(userId?: string | null) {
  const [counts, setCounts] = useState<CommunityUnreadCounts>(EMPTY_COUNTS);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshCounts = useCallback(async () => {
    if (!userId) {
      setCounts(EMPTY_COUNTS);
      return;
    }

    try {
      const [
        { data: unreadMessages, error: unreadMessagesError },
        { data: unreadNotifications, error: unreadNotificationsError },
        groupChatUnread,
      ] = await Promise.all([
        supabase
          .from('direct_messages')
          .select('sender_id')
          .eq('receiver_id', userId)
          .eq('is_read', false),
        supabase
          .from('community_notifications')
          .select('type')
          .eq('user_id', userId)
          .eq('is_read', false),
        getTotalGroupChatUnreadCount(),
      ]);

      if (unreadMessagesError) throw unreadMessagesError;
      if (unreadNotificationsError) throw unreadNotificationsError;

      const unreadMessageCount = unreadMessages?.length || 0;
      const unreadChatCount = new Set((unreadMessages || []).map((item) => item.sender_id).filter(Boolean)).size;
      const unreadGroupChatCount = groupChatUnread;

      let unreadActivityCount = 0;
      let unreadCommentCount = 0;
      let unreadFollowCount = 0;

      for (const notification of unreadNotifications || []) {
        if (ACTIVITY_TYPES.has(notification.type)) {
          unreadActivityCount += 1;
          continue;
        }

        if (COMMENT_TYPES.has(notification.type)) {
          unreadCommentCount += 1;
          continue;
        }

        if (notification.type === 'follow') {
          unreadFollowCount += 1;
        }
      }

      const unreadNotificationCount = unreadActivityCount + unreadCommentCount + unreadFollowCount;

      setCounts({
        unreadMessageCount,
        unreadChatCount,
        unreadGroupChatCount,
        unreadActivityCount,
        unreadCommentCount,
        unreadFollowCount,
        unreadNotificationCount,
        unreadCommunityTotal: unreadMessageCount + unreadGroupChatCount + unreadNotificationCount,
      });
    } catch (error) {
      console.error('Failed to refresh community unread counts:', error);
      setCounts(EMPTY_COUNTS);
    }
  }, [userId]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    if (!userId) return;

    const directMessagesChannel = supabase
      .channel(`community-unread-direct-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          void refreshCounts();
        },
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel(`community-unread-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshCounts();
        },
      )
      .subscribe();

    // Group chat messages – subscribe without filter (RLS ensures only
    // messages in the user's groups are delivered by Supabase Realtime)
    const groupMessagesChannel = supabase
      .channel(`community-unread-group-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_group_messages',
        },
        () => {
          void refreshCounts();
        },
      )
      .subscribe();

    // Group chat read tracking – when the user marks a group chat as read,
    // update the badge immediately instead of waiting for the next poll
    const groupReadsChannel = supabase
      .channel(`community-unread-group-reads-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_group_chat_reads',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshCounts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(directMessagesChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(groupMessagesChannel);
      supabase.removeChannel(groupReadsChannel);
    };
  }, [refreshCounts, userId]);

  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      if (appStateRef.current === 'active') {
        void refreshCounts();
      }
    }, 10000);

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;

      if (nextAppState === 'active') {
        void refreshCounts();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [refreshCounts, userId]);

  return {
    ...counts,
    refreshCounts,
  };
}
