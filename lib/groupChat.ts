import { getGroupMembers } from '@/lib/groups';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GroupChatMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
};

export type GroupChatMemberInfo = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type EnrichedGroupMessage = GroupChatMessage & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showDateSeparator: boolean;
  dateLabel: string;
  quotedContent: string | null;
  quotedSenderId: string | null;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GROUP_GAP_MINUTES = 3;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

export const formatDateLabel = (dateString: string) => {
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

// ---------------------------------------------------------------------------
// Message enrichment
// ---------------------------------------------------------------------------

export function enrichGroupMessages(
  messages: GroupChatMessage[],
  memberMap: Map<string, GroupChatMemberInfo>,
  currentUserId?: string,
): EnrichedGroupMessage[] {
  const map = new Map<string, GroupChatMessage>();
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

    const quoted = msg.reply_to_id ? map.get(msg.reply_to_id) : null;
    const member = memberMap.get(msg.sender_id);

    return {
      ...msg,
      isFirstInGroup,
      isLastInGroup,
      showDateSeparator,
      dateLabel: formatDateLabel(msg.created_at),
      quotedContent: quoted?.content ?? null,
      quotedSenderId: quoted?.sender_id ?? null,
      senderDisplayName: member?.display_name ?? 'Unbekannt',
      senderAvatarUrl: member?.avatar_url ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

export async function loadGroupChatMessages(
  groupId: string,
  limit = 50,
): Promise<GroupChatMessage[]> {
  const { data, error } = await supabase
    .from('community_group_messages')
    .select('id, group_id, sender_id, content, reply_to_id, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function loadGroupChatMemberProfiles(
  groupId: string,
): Promise<Map<string, GroupChatMemberInfo>> {
  const map = new Map<string, GroupChatMemberInfo>();
  const { data: members, error } = await getGroupMembers(groupId);
  if (error || !members) {
    return map;
  }

  for (const member of members) {
    map.set(member.user_id, {
      user_id: member.user_id,
      display_name: member.display_name,
      avatar_url: member.avatar_url || null,
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function sendGroupChatMessage(
  groupId: string,
  content: string,
  replyToId?: string | null,
) {
  const payload: Record<string, unknown> = {
    group_id: groupId,
    sender_id: (await supabase.auth.getUser()).data.user?.id,
    content,
  };
  if (replyToId) payload.reply_to_id = replyToId;

  const { error } = await supabase.from('community_group_messages').insert(payload);
  if (error) throw error;
}

export async function deleteGroupChatMessage(messageId: string) {
  const { error } = await supabase
    .from('community_group_messages')
    .delete()
    .eq('id', messageId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Read tracking
// ---------------------------------------------------------------------------

export async function markGroupChatRead(groupId: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('community_group_chat_reads')
    .upsert(
      { group_id: groupId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'group_id,user_id' },
    );

  if (error) console.error('Failed to mark group chat as read:', error);
}

export async function getGroupChatUnreadCount(groupId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_group_chat_unread_count', {
    target_group_id: groupId,
  });
  if (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
  return data ?? 0;
}

// ---------------------------------------------------------------------------
// Summaries (for Messages/Notifications tab)
// ---------------------------------------------------------------------------

export type GroupChatSummary = {
  group_id: string;
  group_name: string;
  group_visibility: string;
  latest_message_content: string | null;
  latest_message_sender_id: string | null;
  latest_message_sender_name?: string;
  latest_message_created_at: string | null;
  unread_count: number;
};

export async function getGroupChatSummaries(): Promise<GroupChatSummary[]> {
  const { data, error } = await supabase.rpc('get_my_group_chat_summaries');
  if (error) {
    console.error('Failed to get group chat summaries:', error);
    return [];
  }
  return (data as GroupChatSummary[]) ?? [];
}

export async function getTotalGroupChatUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_total_group_chat_unread_count');
  if (error) {
    console.error('Failed to get total group chat unread count:', error);
    return 0;
  }
  return data ?? 0;
}
