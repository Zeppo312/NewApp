import type { Comment, NestedComment, Post } from './community';
import { getCachedUser, supabase } from './supabase';

type ProfileLike = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  user_role?: string | null;
  avatar_url?: string | null;
  community_use_avatar?: boolean | null;
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

const loadProfile = async (userId: string) => {
  const { data: profileData, error: profileError } = await supabase
    .rpc('get_user_profile', { user_id_param: userId });

  if (!profileError && profileData && profileData.length > 0) {
    return profileData[0] as ProfileLike;
  }

  const { data: directProfileData, error: directProfileErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, username, user_role, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (!directProfileErr && directProfileData) {
    return directProfileData as ProfileLike;
  }

  return null;
};

const hydrateAuthor = async (userId: string, isAnonymousRaw: boolean | null | undefined, currentUserId: string) => {
  const profile = await loadProfile(userId);
  const isAnonymous = isAnonymousRaw === true;
  const displayName = resolveProfileDisplayName(profile) || 'Benutzer';

  let userName = 'Anonym';
  if (!isAnonymous) {
    userName = displayName;
  }

  if (userId === currentUserId) {
    userName = isAnonymous ? 'Anonym (Du)' : `${userName} (Du)`;
  }

  return {
    user_name: userName,
    user_role: isAnonymous ? 'unknown' : (profile?.user_role || 'unknown'),
    user_avatar_url: isAnonymous ? null : resolveCommunityAvatarUrl(profile),
    is_anonymous: isAnonymous,
  };
};

export const getGroupPosts = async (groupId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: posts, error } = await supabase
      .from('community_group_posts')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const items = await Promise.all(
      (posts || []).map(async (post: any) => {
        const [{ count: likesCount }, { count: commentsCount }, { data: userLike }, author] = await Promise.all([
          supabase
            .from('community_group_post_likes')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', post.id),
          supabase
            .from('community_group_comments')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', post.id),
          supabase
            .from('community_group_post_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', userData.user.id)
            .maybeSingle(),
          hydrateAuthor(post.user_id, post.is_anonymous, userData.user.id),
        ]);

        return {
          ...post,
          ...author,
          likes_count: likesCount || 0,
          comments_count: commentsCount || 0,
          has_liked: !!userLike,
        } as Post;
      }),
    );

    return { data: items, error: null };
  } catch (error) {
    console.error('Failed to get group posts:', error);
    return { data: null, error };
  }
};

export const createGroupPost = async (groupId: string, content: string, isAnonymous: boolean = false) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('community_group_posts')
      .insert({
        group_id: groupId,
        user_id: userData.user.id,
        content,
        is_anonymous: isAnonymous,
        type: 'text',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Failed to create group post:', error);
    return { data: null, error };
  }
};

export const deleteGroupPost = async (postId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_group_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userData.user.id);

    return { data, error };
  } catch (error) {
    console.error('Failed to delete group post:', error);
    return { data: null, error };
  }
};

export const toggleGroupPostLike = async (postId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: existingLike, error: checkError } = await supabase
      .from('community_group_post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      return { data: null, error: checkError };
    }

    const result = existingLike
      ? await supabase.from('community_group_post_likes').delete().eq('id', existingLike.id)
      : await supabase.from('community_group_post_likes').insert({
          post_id: postId,
          user_id: userData.user.id,
          created_at: new Date().toISOString(),
        });

    if (result.error) {
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (error) {
    console.error('Failed to toggle group post like:', error);
    return { data: null, error };
  }
};

export const getGroupComments = async (postId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: comments, error } = await supabase
      .from('community_group_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    const items = await Promise.all(
      (comments || []).map(async (comment: any) => {
        const [{ count: likesCount }, { data: userLike }, author] = await Promise.all([
          supabase
            .from('community_group_comment_likes')
            .select('id', { count: 'exact', head: true })
            .eq('comment_id', comment.id),
          supabase
            .from('community_group_comment_likes')
            .select('id')
            .eq('comment_id', comment.id)
            .eq('user_id', userData.user.id)
            .maybeSingle(),
          hydrateAuthor(comment.user_id, comment.is_anonymous, userData.user.id),
        ]);

        return {
          ...comment,
          ...author,
          likes_count: likesCount || 0,
          has_liked: !!userLike,
        } as Comment;
      }),
    );

    return { data: items, error: null };
  } catch (error) {
    console.error('Failed to get group comments:', error);
    return { data: null, error };
  }
};

export const createGroupComment = async (postId: string, content: string, isAnonymous: boolean = false) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('community_group_comments')
      .insert({
        post_id: postId,
        user_id: userData.user.id,
        content,
        is_anonymous: isAnonymous,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Failed to create group comment:', error);
    return { data: null, error };
  }
};

export const deleteGroupComment = async (commentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_group_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userData.user.id);

    return { data, error };
  } catch (error) {
    console.error('Failed to delete group comment:', error);
    return { data: null, error };
  }
};

export const toggleGroupCommentLike = async (commentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: existingLike, error: checkError } = await supabase
      .from('community_group_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      return { data: null, error: checkError };
    }

    const result = existingLike
      ? await supabase.from('community_group_comment_likes').delete().eq('id', existingLike.id)
      : await supabase.from('community_group_comment_likes').insert({
          comment_id: commentId,
          user_id: userData.user.id,
          created_at: new Date().toISOString(),
        });

    if (result.error) {
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (error) {
    console.error('Failed to toggle group comment like:', error);
    return { data: null, error };
  }
};

export const getGroupNestedComments = async (commentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: comments, error } = await supabase
      .from('community_group_nested_comments')
      .select('*')
      .eq('parent_comment_id', commentId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    const items = await Promise.all(
      (comments || []).map(async (comment: any) => {
        const [{ count: likesCount }, { data: userLike }, author] = await Promise.all([
          supabase
            .from('community_group_nested_comment_likes')
            .select('id', { count: 'exact', head: true })
            .eq('nested_comment_id', comment.id),
          supabase
            .from('community_group_nested_comment_likes')
            .select('id')
            .eq('nested_comment_id', comment.id)
            .eq('user_id', userData.user.id)
            .maybeSingle(),
          hydrateAuthor(comment.user_id, comment.is_anonymous, userData.user.id),
        ]);

        return {
          ...comment,
          ...author,
          likes_count: likesCount || 0,
          has_liked: !!userLike,
        } as NestedComment;
      }),
    );

    return { data: items, error: null };
  } catch (error) {
    console.error('Failed to get group nested comments:', error);
    return { data: null, error };
  }
};

export const createGroupReply = async (commentId: string, content: string, isAnonymous: boolean = false) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('community_group_nested_comments')
      .insert({
        parent_comment_id: commentId,
        user_id: userData.user.id,
        content,
        is_anonymous: isAnonymous,
        created_at: now,
        updated_at: now,
      })
      .select();

    return { data, error };
  } catch (error) {
    console.error('Failed to create group reply:', error);
    return { data: null, error };
  }
};

export const deleteGroupNestedComment = async (nestedCommentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data, error } = await supabase
      .from('community_group_nested_comments')
      .delete()
      .eq('id', nestedCommentId)
      .eq('user_id', userData.user.id);

    return { data, error };
  } catch (error) {
    console.error('Failed to delete group nested comment:', error);
    return { data: null, error };
  }
};

export const toggleGroupNestedCommentLike = async (nestedCommentId: string) => {
  try {
    const { data: userData } = await getCachedUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    const { data: existingLike, error: checkError } = await supabase
      .from('community_group_nested_comment_likes')
      .select('id')
      .eq('nested_comment_id', nestedCommentId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (checkError) {
      return { data: null, error: checkError };
    }

    const result = existingLike
      ? await supabase.from('community_group_nested_comment_likes').delete().eq('id', existingLike.id)
      : await supabase.from('community_group_nested_comment_likes').insert({
          nested_comment_id: nestedCommentId,
          user_id: userData.user.id,
          created_at: new Date().toISOString(),
        });

    if (result.error) {
      return { data: null, error: result.error };
    }

    return { data: { liked: !existingLike }, error: null };
  } catch (error) {
    console.error('Failed to toggle group nested comment like:', error);
    return { data: null, error };
  }
};
