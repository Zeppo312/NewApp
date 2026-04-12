import { getCachedUser, supabase } from './supabase';
import { compressImage } from './imageCompression';

// Typdefinitionen
export interface Post {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_anonymous?: boolean;
  type?: 'text' | 'poll';
  image_url?: string; // URL zum Bild, falls vorhanden
  // Virtuelle Felder (werden durch Joins oder clientseitige Berechnungen gefüllt)
  user_name?: string;
  user_role?: string;
  user_avatar_url?: string | null;
  likes_count?: number;
  comments_count?: number;
  has_liked?: boolean;
  poll_id?: string; // ID der zugehörigen Umfrage, falls type === 'poll'
  tags?: {
    id: string;
    name: string;
    category: 'trimester' | 'baby_age';
  }[];
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_anonymous?: boolean;
  // Virtuelle Felder
  user_name?: string;
  user_role?: string;
  user_avatar_url?: string | null;
  likes_count?: number;
  has_liked?: boolean;
  replies?: NestedComment[];
}

export interface NestedComment {
  id: string;
  parent_comment_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_anonymous?: boolean;
  user_name?: string;
  user_role?: string;
  user_avatar_url?: string | null;
  likes_count?: number;
  has_liked?: boolean;
}

export interface Notification {
  id: string;
  user_id: string;        // Empfänger der Benachrichtigung
  sender_id: string;      // Absender der Benachrichtigung
  type: 'like_post' | 'like_comment' | 'comment' | 'reply' | 'like_nested_comment' | 'follow' | 'message';
  content: string;        // Zusätzlicher Kontext oder Inhalt (z.B. Kommentartext)
  reference_id: string;   // ID des Beitrags oder Kommentars
  created_at: string;
  is_read: boolean;
}

type ProfileLike = {
  id?: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  user_role?: string | null;
  avatar_url?: string | null;
  community_use_avatar?: boolean | null;
};

type UserSettingsAvatarChoice = {
  user_id: string;
  community_use_avatar?: boolean | null;
};

export type CommunityFeedCursor = {
  createdAt: string;
  id: string;
};

const resolveProfileDisplayName = (profile?: ProfileLike | null) => {
  const username = profile?.username?.trim();
  if (username) return username;
  const firstName = profile?.first_name?.trim();
  const lastName = profile?.last_name?.trim();
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }
  return '';
};

const resolveCommunityAvatarUrl = (profile?: ProfileLike | null) => {
  if (!profile?.avatar_url) return null;
  return profile.community_use_avatar === false ? null : profile.avatar_url;
};

const dedupeIds = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const clampCommunityFeedLimit = (limit: number) => Math.max(1, Math.min(limit, 50));

const buildAuthorFields = (
  userId: string,
  isAnonymousRaw: boolean | null | undefined,
  currentUserId: string,
  profile?: ProfileLike | null,
) => {
  const isAnonymous = isAnonymousRaw === true;
  const displayName = resolveProfileDisplayName(profile) || 'Benutzer';

  let userName = isAnonymous ? 'Anonym' : displayName;
  if (userId === currentUserId) {
    userName = isAnonymous ? 'Anonym (Du)' : `${displayName} (Du)`;
  }

  return {
    user_name: userName,
    user_role: isAnonymous ? 'unknown' : (profile?.user_role || 'unknown'),
    user_avatar_url: isAnonymous ? null : resolveCommunityAvatarUrl(profile),
    is_anonymous: isAnonymous,
  };
};

const loadCommunityProfiles = async (userIds: string[]) => {
  const uniqueUserIds = dedupeIds(userIds);
  const profilesById = new Map<string, ProfileLike>();

  if (uniqueUserIds.length === 0) {
    return profilesById;
  }

  const [{ data: profiles, error: profilesError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, username, user_role, avatar_url')
      .in('id', uniqueUserIds),
    supabase
      .from('user_settings')
      .select('user_id, community_use_avatar')
      .in('user_id', uniqueUserIds)
      .order('updated_at', { ascending: false }),
  ]);

  if (profilesError) {
    console.error('Error loading community profiles:', profilesError);
  }

  if (settingsError) {
    console.error('Error loading community avatar settings:', settingsError);
  }

  const avatarChoiceByUserId = new Map<string, boolean | null>();
  for (const setting of (settings || []) as UserSettingsAvatarChoice[]) {
    if (!avatarChoiceByUserId.has(setting.user_id)) {
      avatarChoiceByUserId.set(
        setting.user_id,
        typeof setting.community_use_avatar === 'boolean' ? setting.community_use_avatar : null,
      );
    }
  }

  for (const profile of (profiles || []) as ProfileLike[]) {
    if (!profile.id) continue;
    profilesById.set(profile.id, {
      ...profile,
      community_use_avatar: avatarChoiceByUserId.get(profile.id) ?? null,
    });
  }

  return profilesById;
};

const loadEntityCountMap = async (
  tableName: string,
  entityColumn: string,
  entityIds: string[],
) => {
  const uniqueEntityIds = dedupeIds(entityIds);
  const counts = new Map<string, number>();

  if (uniqueEntityIds.length === 0) {
    return counts;
  }

  // NOTE: Supabase JS has no GROUP BY support, so we fetch matching rows
  // and count client-side. This is acceptable because:
  // - The feed path uses the RPC (no fallback needed for likes/comments counts)
  // - This is only hit for comment hydration (~10-50 items) and the fallback feed
  // For large-scale, replace with a count RPC or stats table.
  const { data, error } = await supabase
    .from(tableName)
    .select(entityColumn)
    .in(entityColumn, uniqueEntityIds);

  if (error) {
    console.error(`Error loading ${tableName} counts:`, error);
    return counts;
  }

  for (const row of data || []) {
    const entityId = row?.[entityColumn];
    if (!entityId || typeof entityId !== 'string') continue;
    counts.set(entityId, (counts.get(entityId) || 0) + 1);
  }

  return counts;
};

const loadCurrentUserEntitySet = async (
  tableName: string,
  entityColumn: string,
  entityIds: string[],
  userId: string,
) => {
  const uniqueEntityIds = dedupeIds(entityIds);
  const ids = new Set<string>();

  if (uniqueEntityIds.length === 0) {
    return ids;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select(entityColumn)
    .in(entityColumn, uniqueEntityIds)
    .eq('user_id', userId);

  if (error) {
    console.error(`Error loading ${tableName} viewer rows:`, error);
    return ids;
  }

  for (const row of data || []) {
    const entityId = row?.[entityColumn];
    if (entityId && typeof entityId === 'string') {
      ids.add(entityId);
    }
  }

  return ids;
};

const hydrateInteractiveItems = async <
  T extends {
    id: string;
    user_id: string;
    is_anonymous?: boolean | null;
  },
>(
  items: T[],
  currentUserId: string,
  likeTable: string,
  likeEntityColumn: string,
) => {
  if (items.length === 0) {
    return [] as (T & {
      user_name: string;
      user_role: string;
      user_avatar_url: string | null;
      likes_count: number;
      has_liked: boolean;
      is_anonymous: boolean;
    })[];
  }

  const itemIds = items.map((item) => item.id);
  const userIds = items.map((item) => item.user_id);

  const [profilesById, likeCounts, likedIds] = await Promise.all([
    loadCommunityProfiles(userIds),
    loadEntityCountMap(likeTable, likeEntityColumn, itemIds),
    loadCurrentUserEntitySet(likeTable, likeEntityColumn, itemIds, currentUserId),
  ]);

  return items.map((item) => ({
    ...item,
    ...buildAuthorFields(item.user_id, item.is_anonymous, currentUserId, profilesById.get(item.user_id)),
    likes_count: likeCounts.get(item.id) || 0,
    has_liked: likedIds.has(item.id),
  }));
};

const loadCommunityFeedPageFallback = async ({
  limit,
  cursor,
  userId,
  currentUserId,
}: {
  limit: number;
  cursor?: CommunityFeedCursor | null;
  userId?: string;
  currentUserId: string;
}) => {
  let query = supabase
    .from('community_posts')
    .select('id, user_id, content, created_at, updated_at, is_anonymous, type, image_url')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (cursor?.createdAt && cursor?.id) {
    // Compound cursor: posts strictly before (created_at, id)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return { data: null, error, nextCursor: null, hasMore: false };
  }

  const allPosts = (data || []) as Post[];
  const hasMore = allPosts.length > limit;
  const posts = allPosts.slice(0, limit);
  const postIds = posts.map((post) => post.id);

  const [profilesById, likeCounts, commentCounts, likedIds] = await Promise.all([
    loadCommunityProfiles(posts.map((post) => post.user_id)),
    loadEntityCountMap('community_post_likes', 'post_id', postIds),
    loadEntityCountMap('community_comments', 'post_id', postIds),
    loadCurrentUserEntitySet('community_post_likes', 'post_id', postIds, currentUserId),
  ]);

  const hydratedPosts = posts.map((post) => ({
    ...post,
    ...buildAuthorFields(post.user_id, post.is_anonymous, currentUserId, profilesById.get(post.user_id)),
    likes_count: likeCounts.get(post.id) || 0,
    comments_count: commentCounts.get(post.id) || 0,
    has_liked: likedIds.has(post.id),
  }));

  const lastPost = hydratedPosts.length > 0 ? hydratedPosts[hydratedPosts.length - 1] : null;

  return {
    data: hydratedPosts,
    error: null,
    hasMore,
    nextCursor: hasMore && lastPost
      ? { createdAt: lastPost.created_at, id: lastPost.id }
      : null,
  };
};

export const getCommunityFeedPage = async ({
  limit = 20,
  cursor,
  userId,
}: {
  limit?: number;
  cursor?: CommunityFeedCursor | null;
  userId?: string;
}) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) {
      return { data: null, error: new Error('Nicht angemeldet'), nextCursor: null, hasMore: false };
    }

    const pageSize = clampCommunityFeedLimit(limit);
    const { data, error } = await supabase.rpc('get_community_feed', {
      limit_param: pageSize,
      cursor_created_at_param: cursor?.createdAt ?? null,
      cursor_id_param: cursor?.id ?? null,
      filter_user_id_param: userId ?? null,
    });

    if (error) {
      console.warn('Falling back to client-side community feed loading:', error);
      return loadCommunityFeedPageFallback({
        limit: pageSize,
        cursor,
        userId,
        currentUserId: userData.user.id,
      });
    }

    const posts = (data || []) as Post[];
    const hasMore = posts.length === pageSize;
    const lastPost = hasMore ? posts[posts.length - 1] : null;

    return {
      data: posts,
      error: null,
      hasMore,
      nextCursor: lastPost ? { createdAt: lastPost.created_at, id: lastPost.id } : null,
    };
  } catch (err) {
    console.error('Failed to get community feed page:', err);
    return { data: null, error: err, nextCursor: null, hasMore: false };
  }
};

// Neue Funktion: Benachrichtigung erstellen
export const createNotification = async (
  recipientId: string,
  type: 'like_post' | 'like_comment' | 'comment' | 'reply' | 'like_nested_comment' | 'follow' | 'message',
  referenceId: string,
  content: string = ''
) => {
  try {
    // Prüfen, ob der aktuelle Benutzer angemeldet ist
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Nicht an sich selbst senden
    if (userData.user.id === recipientId) return { data: null, error: null };

    // Wenn der Inhalt zu lang ist, kürzen
    const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content;

    // Notifikation erstellen
    const { data, error } = await supabase
      .from('community_notifications')
      .insert({
        user_id: recipientId,
        sender_id: userData.user.id,
        type,
        content: truncatedContent,
        reference_id: referenceId,
        created_at: new Date().toISOString(),
        is_read: false
      });

    if (error) {
      console.error('Error creating notification:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to create notification:', err);
    return { data: null, error: err };
  }
};

// Benachrichtigungen für einen Benutzer abrufen
export const getNotifications = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    console.log("Fetching notifications for user:", userData.user.id);

    // Benachrichtigungen abrufen
    const { data, error } = await supabase
      .from('community_notifications')
      .select()
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return { data: null, error };
    }

    console.log(`Retrieved ${data?.length || 0} notifications total`);
    
    // Anzahl der verschiedenen Typen von Benachrichtigungen ausgeben
    const typeCounts = data?.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log("Notification types count:", typeCounts);

    // Für jede Benachrichtigung den Absendernamen abrufen
    const notificationsWithSenders = await Promise.all(data.map(async (notification) => {
      // Absenderinformationen abrufen
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, username, user_role')
        .eq('id', notification.sender_id)
        .single();

      if (profileError) {
        console.error('Error fetching sender profile:', profileError);
        return {
          ...notification,
          sender_name: 'Benutzer'
        };
      }

      // Vollständigen Namen verwenden, wenn beide Felder vorhanden sind
      const fullName = profileData.first_name
        ? (profileData.last_name 
            ? `${profileData.first_name} ${profileData.last_name}` 
            : profileData.first_name)
        : 'Benutzer';

      return {
        ...notification,
        sender_name: fullName
      };
    }));

    return { data: notificationsWithSenders, error: null };
  } catch (err) {
    console.error('Failed to get notifications:', err);
    return { data: null, error: err };
  }
};

// Benachrichtigung als gelesen markieren
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    return { data: null, error: err };
  }
};

// Alle Benachrichtigungen als gelesen markieren
export const markAllNotificationsAsRead = async () => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_notifications')
      .update({ is_read: true })
      .eq('user_id', userData.user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err);
    return { data: null, error: err };
  }
};

// Beiträge abrufen
export const getPosts = async (searchQuery: string = '', tagIds: string[] = [], userId?: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    if (!searchQuery.trim() && tagIds.length === 0) {
      const { data, error } = await getCommunityFeedPage({
        limit: userId ? 100 : 50,
        userId,
      });
      return { data, error };
    }

    // Beiträge abrufen
    let posts;
    let postsError;

    // Basisabfrage
    let query = supabase.from('community_posts').select();

    // Filtere nach Benutzer ID, wenn angegeben
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Nach Erstellungsdatum sortieren
    query = query.order('created_at', { ascending: false });

    if (tagIds.length > 0) {
      // Wenn Tags ausgewählt sind, verwende die get_posts_with_tags Funktion
      const result = await supabase
        .rpc('get_posts_with_tags', { tag_ids: tagIds });
      
      // Wenn auch user_id Filter angewendet werden soll
      if (userId && result.data) {
        result.data = result.data.filter((post: any) => post.user_id === userId);
      }
      
      posts = result.data;
      postsError = result.error;
    } else {
      // Normale Abfrage ohne Tag-Filter
      const result = await query;
      posts = result.data;
      postsError = result.error;
    }

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return { data: null, error: postsError };
    }

    // Für jeden Beitrag die Benutzerinformationen, Likes und Kommentare abrufen
    const postsWithCounts = await Promise.all(posts.map(async (post: any) => {
      let profile = null;

      const { data: profileData, error: profileErr } = await supabase
        .rpc('get_user_profile', { user_id_param: post.user_id });

      if (profileErr) {
        console.error(`Error fetching profile by id for user_id ${post.user_id}:`, profileErr);
      } else if (profileData && profileData.length > 0) {
        profile = profileData[0];
      }

      if (!profile) {
        const { data: directProfileData, error: directProfileErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username, user_role, avatar_url')
          .eq('id', post.user_id)
          .single();

        if (directProfileErr) {
          console.error(`Error fetching profile directly for user_id ${post.user_id}:`, directProfileErr);
        } else if (directProfileData) {
          profile = directProfileData;
        }
      }

      // Likes für diesen Beitrag zählen
      const { count: likesCount, error: likesError } = await supabase
        .from('community_post_likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (likesError) {
        console.error('Error counting likes:', likesError);
      }

      // Kommentare für diesen Beitrag zählen
      const { count: commentsCount, error: commentsError } = await supabase
        .from('community_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (commentsError) {
        console.error('Error counting comments:', commentsError);
      }

      // Prüfen, ob der aktuelle Benutzer diesen Beitrag geliked hat
      const { data: userLike, error: userLikeError } = await supabase
        .from('community_post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (userLikeError) {
        console.error('Error checking user like:', userLikeError);
      }
      const isAnonymous = post.is_anonymous === true;

      const displayName = resolveProfileDisplayName(profile) || 'Benutzer';
      let userName = 'Anonym';

      if (!isAnonymous) {
        userName = displayName;
      }

      // Wenn der Beitrag vom aktuellen Benutzer stammt, füge "(Du)" hinzu
      if (post.user_id === userData.user.id) {
        userName = isAnonymous ? 'Anonym (Du)' : `${userName} (Du)`;
      }

      return {
        ...post,
        user_name: userName,
        user_role: isAnonymous ? 'unknown' : (profile?.user_role || 'unknown'),
        user_avatar_url: isAnonymous ? null : resolveCommunityAvatarUrl(profile),
        likes_count: likesCount || 0,
        comments_count: commentsCount || 0,
        has_liked: !!userLike,
        // Stelle sicher, dass is_anonymous immer einen Wert hat
        is_anonymous: isAnonymous
      };
    }));

    return { data: postsWithCounts, error: null };
  } catch (err) {
    console.error('Failed to get posts:', err);
    return { data: null, error: err };
  }
};

// Kommentare für einen Beitrag abrufen
export const getComments = async (postId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Kommentare abrufen
    const { data: comments, error: commentsError } = await supabase
      .from('community_comments')
      .select()
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return { data: null, error: commentsError };
    }

    const commentsWithCounts = await hydrateInteractiveItems(
      comments || [],
      userData.user.id,
      'community_comment_likes',
      'comment_id',
    );

    return { data: commentsWithCounts, error: null };
  } catch (err) {
    console.error('Failed to get comments:', err);
    return { data: null, error: err };
  }
};

// Kommentare (Vorschau) für einen Beitrag mit Limit abrufen
export const getCommentsPreview = async (postId: string, limit: number = 2) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Kommentare abrufen (nur die ersten "limit" nach ältestem zuerst)
    const { data: comments, error: commentsError } = await supabase
      .from('community_comments')
      .select()
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (commentsError) {
      console.error('Error fetching preview comments:', commentsError);
      return { data: null, error: commentsError };
    }

    const commentsWithCounts = await hydrateInteractiveItems(
      comments || [],
      userData.user.id,
      'community_comment_likes',
      'comment_id',
    );

    return { data: commentsWithCounts, error: null };
  } catch (err) {
    console.error('Failed to get preview comments:', err);
    return { data: null, error: err };
  }
};

// Neuen Beitrag erstellen
export const createPost = async (
  content: string,
  isAnonymous: boolean = false,
  type: 'text' | 'poll' = 'text',
  pollData?: any,
  tagIds: string[] = [],
  imageBase64?: string,
) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    console.log('=== CREATE POST WITH IMAGE ===');
    console.log('User ID:', userData.user.id);
    console.log('Has image:', !!imageBase64);
    
    // Bild hochladen, falls vorhanden
    let imageUrl = null;
  if (imageBase64 && imageBase64.length > 0) {
    try {
      console.log('Starting DIRECT image upload...');

      // 1. Eindeutigen Dateinamen erzeugen
      const timestamp = new Date().getTime();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileName = `post_${timestamp}_${randomStr}.jpg`;
      const filePath = `posts/${fileName}`;
        
        console.log('File path:', filePath);

      // 2. Komprimieren & resizen (max ~1400px, moderate Qualität)
      const { bytes } = await compressImage(
        { base64: imageBase64 },
        { maxDimension: 1400, quality: 0.7 }
      );
      console.log('Compressed image bytes length:', bytes.length);

      // 3. Datei hochladen
      console.log('Uploading file to Supabase...');
      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('community-images')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg'
        });

        if (uploadError) {
          console.error('Upload error details:', JSON.stringify(uploadError));
          throw new Error(`Fehler beim Hochladen: ${uploadError.message}`);
        }

        console.log('Upload successful:', JSON.stringify(uploadResult));

        // 5. Öffentliche URL generieren
        console.log('Generating public URL...');
        const { data: urlData } = supabase.storage
          .from('community-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
        console.log('Generated image URL:', imageUrl);
      } catch (imageError) {
        console.error('IMAGE UPLOAD ERROR:', imageError);
        console.error('Error details:', JSON.stringify(imageError));
      }
    }

    // Post erstellen
    console.log('Creating post with image_url:', imageUrl);
    
    const postData = {
      user_id: userData.user.id,
      content,
      type,
      is_anonymous: isAnonymous,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Post data:', JSON.stringify(postData));

    const { data, error } = await supabase
      .from('community_posts')
      .insert(postData)
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', JSON.stringify(error));
      return { data: null, error };
    }

    console.log('Post created successfully:', data);
    console.log('Image URL in created post:', data.image_url);

    // Tags zum Beitrag hinzufügen, wenn vorhanden
    if (tagIds.length > 0 && data) {
      try {
        const tagsToInsert = tagIds.map(tagId => ({
          post_id: data.id,
          tag_id: tagId,
          created_at: new Date().toISOString()
        }));

        const { error: tagsError } = await supabase
          .from('community_post_tags')
          .insert(tagsToInsert);

        if (tagsError) {
          console.error('Error adding tags to post:', tagsError);
          // Wir geben den Post trotzdem zurück, auch wenn das Hinzufügen der Tags fehlschlägt
        }
      } catch (tagsErr) {
        console.error('Failed to add tags to post:', tagsErr);
      }
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to create post:', err);
    return { data: null, error: err };
  }
};

// Neuen Kommentar erstellen
export const createComment = async (postId: string, content: string, isAnonymous: boolean = false) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Debug-Ausgabe
    console.log('Creating comment with is_anonymous:', isAnonymous);

    // Direkter Ansatz: Explizit is_anonymous setzen
    const insertData = {
      post_id: postId,
      user_id: userData.user.id,
      content,
      is_anonymous: isAnonymous, // Explizit auf true oder false setzen
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Insert data:', JSON.stringify(insertData));

    // Versuche zuerst mit is_anonymous
    let result = await supabase
      .from('community_comments')
      .insert(insertData)
      .select()
      .single();

    // Wenn es einen Fehler gibt und der Fehler mit is_anonymous zusammenhängt, versuche es ohne
    if (result.error && result.error.message && result.error.message.includes('is_anonymous')) {
      console.log('Error with is_anonymous field, trying without it');
      const { is_anonymous, ...dataWithoutAnonymous } = insertData;
      result = await supabase
        .from('community_comments')
        .insert(dataWithoutAnonymous)
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) {
      console.error('Error creating comment:', error);
      return { data: null, error };
    }

    // Hole den Beitrag, um den Beitragersteller zu benachrichtigen
    const { data: postData, error: postError } = await supabase
      .from('community_posts')
      .select('user_id, content')
      .eq('id', postId)
      .single();

    if (!postError && postData && !isAnonymous) {
      // Erstelle eine Benachrichtigung für den Beitragersteller
      // Kürze den Beitragsinhalt für die Benachrichtigung
      const shortPostContent = postData.content.length > 30 
        ? postData.content.substring(0, 27) + '...' 
        : postData.content;
        
      await createNotification(
        postData.user_id,
        'comment',
        postId,
        `${content} (zu: "${shortPostContent}")`
      );
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to create comment:', err);
    return { data: null, error: err };
  }
};

// Beitrag liken oder Unlike
export const togglePostLike = async (postId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob der Benutzer den Beitrag bereits geliked hat
    const { data: existingLike, error: checkError } = await supabase
      .from('community_post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing like:', checkError);
      return { data: null, error: checkError };
    }

    let result;

    if (existingLike) {
      // Unlike: Like entfernen
      result = await supabase
        .from('community_post_likes')
        .delete()
        .eq('id', existingLike.id);
    } else {
      // Like hinzufügen
      result = await supabase
        .from('community_post_likes')
        .insert({
          post_id: postId,
          user_id: userData.user.id,
          created_at: new Date().toISOString()
        });

      // Wenn erfolgreich, Benachrichtigung senden
      if (!result.error) {
        // Beitrag abrufen, um den Ersteller zu finden
        const { data: postData, error: postError } = await supabase
          .from('community_posts')
          .select('user_id, content')
          .eq('id', postId)
          .single();

        if (!postError && postData) {
          // Kürze den Beitragsinhalt für die Benachrichtigung
          const shortContent = postData.content.length > 30 
            ? postData.content.substring(0, 27) + '...' 
            : postData.content;
            
          await createNotification(
            postData.user_id,
            'like_post',
            postId,
            shortContent
          );
        }
      }
    }

    if (result.error) {
      console.error('Error toggling post like:', result.error);
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (err) {
    console.error('Failed to toggle post like:', err);
    return { data: null, error: err };
  }
};

// Kommentar liken oder Unlike
export const toggleCommentLike = async (commentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob der Benutzer den Kommentar bereits geliked hat
    const { data: existingLike, error: checkError } = await supabase
      .from('community_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing comment like:', checkError);
      return { data: null, error: checkError };
    }

    let result;

    if (existingLike) {
      // Unlike: Like entfernen
      result = await supabase
        .from('community_comment_likes')
        .delete()
        .eq('id', existingLike.id);
    } else {
      // Like hinzufügen
      result = await supabase
        .from('community_comment_likes')
        .insert({
          comment_id: commentId,
          user_id: userData.user.id,
          created_at: new Date().toISOString()
        });

      // Wenn erfolgreich, Benachrichtigung senden
      if (!result.error) {
        // Kommentar abrufen, um den Ersteller zu finden
        const { data: commentData, error: commentError } = await supabase
          .from('community_comments')
          .select('user_id, content')
          .eq('id', commentId)
          .single();

        if (!commentError && commentData) {
          // Kürze den Kommentarinhalt für die Benachrichtigung
          const shortContent = commentData.content.length > 30 
            ? commentData.content.substring(0, 27) + '...' 
            : commentData.content;
            
          await createNotification(
            commentData.user_id,
            'like_comment',
            commentId,
            shortContent
          );
        }
      }
    }

    if (result.error) {
      console.error('Error toggling comment like:', result.error);
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (err) {
    console.error('Failed to toggle comment like:', err);
    return { data: null, error: err };
  }
};

// Beitrag löschen
export const deletePost = async (postId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error deleting post:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to delete post:', err);
    return { data: null, error: err };
  }
};

// Kommentar löschen
export const deleteComment = async (commentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error deleting comment:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to delete comment:', err);
    return { data: null, error: err };
  }
};

// Verschachtelte Kommentare zu einem Kommentar abrufen
export const getNestedCommentsBatch = async (commentIds: string[]) => {
  try {
    const uniqueCommentIds = dedupeIds(commentIds);
    if (uniqueCommentIds.length === 0) {
      return { data: {} as Record<string, NestedComment[]>, error: null };
    }

    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: comments, error } = await supabase
      .from('community_nested_comments')
      .select()
      .in('parent_comment_id', uniqueCommentIds)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error };

    const commentsWithInfo = await hydrateInteractiveItems(
      comments || [],
      userData.user.id,
      'community_nested_comment_likes',
      'nested_comment_id',
    );

    const groupedComments: Record<string, NestedComment[]> = {};
    for (const commentId of uniqueCommentIds) {
      groupedComments[commentId] = [];
    }

    for (const comment of commentsWithInfo as NestedComment[]) {
      if (!groupedComments[comment.parent_comment_id]) {
        groupedComments[comment.parent_comment_id] = [];
      }
      groupedComments[comment.parent_comment_id].push(comment);
    }

    return { data: groupedComments, error: null };
  } catch (error) {
    console.error('Error in getNestedCommentsBatch:', error);
    return { data: null, error };
  }
};

export const getNestedComments = async (commentId: string) => {
  const { data, error } = await getNestedCommentsBatch([commentId]);
  if (error) {
    return { data: null, error };
  }

  return { data: data?.[commentId] || [], error: null };
};

// Erstelle eine Antwort auf einen Kommentar
export const createReply = async (commentId: string, content: string, isAnonymous: boolean = false) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Kommentar erstellen
    const { data, error } = await supabase
      .from('community_nested_comments')
      .insert({
        parent_comment_id: commentId,
        user_id: userData.user.id,
        content,
        is_anonymous: isAnonymous,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select();

    if (!error && data && !isAnonymous) {
      // Hole den übergeordneten Kommentar, um den Kommentarersteller zu benachrichtigen
      const { data: commentData, error: commentError } = await supabase
        .from('community_comments')
        .select('user_id, content')
        .eq('id', commentId)
        .single();

      if (!commentError && commentData) {
        // Kürze den Kommentarinhalt für die Benachrichtigung
        const shortCommentContent = commentData.content.length > 30 
          ? commentData.content.substring(0, 27) + '...' 
          : commentData.content;
          
        await createNotification(
          commentData.user_id,
          'reply',
          commentId,
          `${content} (zu: "${shortCommentContent}")`
        );
      }
    }

    return { data, error };
  } catch (error) {
    console.error('Error in createReply:', error);
    return { data: null, error };
  }
};

// Verschachtelte Kommentare liken oder Unlike
export const toggleNestedCommentLike = async (nestedCommentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, ob der Benutzer den Kommentar bereits geliked hat
    const { data: existingLike, error: checkError } = await supabase
      .from('community_nested_comment_likes')
      .select('id')
      .eq('nested_comment_id', nestedCommentId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing nested comment like:', checkError);
      return { data: null, error: checkError };
    }

    let result;

    if (existingLike) {
      // Unlike: Like entfernen
      result = await supabase
        .from('community_nested_comment_likes')
        .delete()
        .eq('id', existingLike.id);
    } else {
      // Like hinzufügen
      result = await supabase
        .from('community_nested_comment_likes')
        .insert({
          nested_comment_id: nestedCommentId,
          user_id: userData.user.id,
          created_at: new Date().toISOString()
        });

      // Wenn erfolgreich, Benachrichtigung senden
      if (!result.error) {
        // Verschachtelten Kommentar abrufen, um den Ersteller zu finden
        const { data: nestedCommentData, error: nestedCommentError } = await supabase
          .from('community_nested_comments')
          .select('user_id, content')
          .eq('id', nestedCommentId)
          .single();

        if (!nestedCommentError && nestedCommentData) {
          // Kürze den Kommentarinhalt für die Benachrichtigung
          const shortContent = nestedCommentData.content.length > 30 
            ? nestedCommentData.content.substring(0, 27) + '...' 
            : nestedCommentData.content;
            
          await createNotification(
            nestedCommentData.user_id,
            'like_nested_comment',
            nestedCommentId,
            shortContent
          );
        }
      }
    }

    if (result.error) {
      console.error('Error toggling nested comment like:', result.error);
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (err) {
    console.error('Failed to toggle nested comment like:', err);
    return { data: null, error: err };
  }
};

// Verschachtelten Kommentar löschen
export const deleteNestedComment = async (nestedCommentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_nested_comments')
      .delete()
      .eq('id', nestedCommentId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error deleting nested comment:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Failed to delete nested comment:', err);
    return { data: null, error: err };
  }
};
