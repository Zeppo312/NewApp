import { compressImage } from '@/lib/imageCompression';
import { getCachedUser, supabase } from '@/lib/supabase';

export type GroupChatEventStatus = 'active' | 'cancelled';
export type GroupChatEventRsvpStatus = 'yes' | 'no' | 'maybe';

export type GroupChatEvent = {
  id: string;
  group_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  location: string;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  status: GroupChatEventStatus;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
};

export type GroupChatEventRsvp = {
  event_id: string;
  user_id: string;
  status: GroupChatEventRsvpStatus;
  responded_at: string;
  updated_at: string;
};

const GROUP_EVENT_IMAGE_BUCKET = 'group-event-images';

export const GROUP_CHAT_EVENT_RSVP_LABELS: Record<GroupChatEventRsvpStatus, string> = {
  yes: 'Ja',
  no: 'Nein',
  maybe: 'Vielleicht',
};

type GroupChatEventPayload = {
  groupId: string;
  title: string;
  location: string;
  startsAt: string;
  description?: string | null;
  coverImage?: { uri?: string | null; base64?: string | null } | null;
  existingCoverImageUrl?: string | null;
  endsAt?: string | null;
};

const normalizeText = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const createGroupEventImagePath = (groupId: string, userId: string) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${groupId}/${userId}/${suffix}.jpg`;
};

const uploadGroupChatEventImage = async (
  imageInput: { uri?: string | null; base64?: string | null },
  groupId: string,
  userId: string,
) => {
  const { bytes } = await compressImage(
    { uri: imageInput.uri ?? undefined, base64: imageInput.base64 ?? undefined },
    { maxDimension: 1280, quality: 0.72 },
  );

  const filePath = createGroupEventImagePath(groupId, userId);
  const { error } = await supabase.storage
    .from(GROUP_EVENT_IMAGE_BUCKET)
    .upload(filePath, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from(GROUP_EVENT_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};

export async function loadGroupChatEvents(groupId: string): Promise<GroupChatEvent[]> {
  const { data, error } = await supabase
    .from('community_group_events')
    .select(
      'id, group_id, created_by_user_id, title, description, location, starts_at, ends_at, cover_image_url, status, created_at, updated_at, cancelled_at, cancelled_by_user_id',
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as GroupChatEvent[]) ?? [];
}

export async function loadGroupChatEventRsvps(eventIds: string[]): Promise<GroupChatEventRsvp[]> {
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from('community_group_event_rsvps')
    .select('event_id, user_id, status, responded_at, updated_at')
    .in('event_id', eventIds);

  if (error) throw error;
  return (data as GroupChatEventRsvp[]) ?? [];
}

export async function createGroupChatEvent(input: GroupChatEventPayload) {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    let coverImageUrl: string | null = null;
    if (input.coverImage?.uri || input.coverImage?.base64) {
      coverImageUrl = await uploadGroupChatEventImage(input.coverImage, input.groupId, userData.user.id);
    }

    const { data, error } = await supabase.rpc('create_group_chat_event', {
      target_group_id: input.groupId,
      target_title: input.title.trim(),
      target_location: input.location.trim(),
      target_starts_at: input.startsAt,
      target_description: normalizeText(input.description),
      target_cover_image_url: coverImageUrl,
      target_reply_to_id: null,
      target_ends_at: input.endsAt ?? null,
    });

    return { data, error };
  } catch (error) {
    console.error('Failed to create group chat event:', error);
    return { data: null, error };
  }
}

export async function updateGroupChatEvent(input: GroupChatEventPayload & { eventId: string }) {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet') };
    }

    let coverImageUrl: string | null = input.existingCoverImageUrl ?? null;
    if (input.coverImage?.uri || input.coverImage?.base64) {
      coverImageUrl = await uploadGroupChatEventImage(input.coverImage, input.groupId, userData.user.id);
    }

    const { data, error } = await supabase.rpc('update_group_chat_event', {
      target_event_id: input.eventId,
      target_title: input.title.trim(),
      target_location: input.location.trim(),
      target_starts_at: input.startsAt,
      target_description: normalizeText(input.description),
      target_cover_image_url: coverImageUrl,
      target_ends_at: input.endsAt ?? null,
    });

    return { data, error };
  } catch (error) {
    console.error('Failed to update group chat event:', error);
    return { data: null, error };
  }
}

export async function cancelGroupChatEvent(eventId: string) {
  try {
    const { data, error } = await supabase.rpc('cancel_group_chat_event', {
      target_event_id: eventId,
    });
    return { data, error };
  } catch (error) {
    console.error('Failed to cancel group chat event:', error);
    return { data: null, error };
  }
}

export async function deleteGroupChatEvent(eventId: string) {
  try {
    const { data, error } = await supabase.rpc('delete_group_chat_event', {
      target_event_id: eventId,
    });
    return { data, error };
  } catch (error) {
    console.error('Failed to delete group chat event:', error);
    return { data: null, error };
  }
}

export async function respondToGroupChatEvent(
  eventId: string,
  status: GroupChatEventRsvpStatus,
) {
  try {
    const { data, error } = await supabase.rpc('respond_group_chat_event', {
      target_event_id: eventId,
      target_status: status,
    });
    return { data, error };
  } catch (error) {
    console.error('Failed to respond to group chat event:', error);
    return { data: null, error };
  }
}

export const buildEventRsvpMap = (rsvps: GroupChatEventRsvp[]) => {
  const map = new Map<string, GroupChatEventRsvp[]>();
  for (const rsvp of rsvps) {
    const current = map.get(rsvp.event_id);
    if (current) {
      current.push(rsvp);
    } else {
      map.set(rsvp.event_id, [rsvp]);
    }
  }
  return map;
};

export const buildEventMap = (events: GroupChatEvent[]) =>
  new Map(events.map((event) => [event.id, event]));

export const getEventRsvpCounts = (rsvps: GroupChatEventRsvp[] | undefined) => {
  const counts = { yes: 0, no: 0, maybe: 0 };
  for (const rsvp of rsvps || []) {
    counts[rsvp.status] += 1;
  }
  return counts;
};

export const formatGroupEventDateTime = (startsAt: string) => {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
