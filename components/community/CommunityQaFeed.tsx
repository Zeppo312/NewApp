import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '@/components/Header';
import { FollowButton } from '@/components/FollowButton';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useCommunityUnreadCounts } from '@/hooks/useCommunityUnreadCounts';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  type Comment,
  type NestedComment,
  type Post,
  createComment,
  createPost,
  createReply,
  deleteComment,
  deleteNestedComment,
  deletePost,
  getComments,
  getNestedComments,
  getPosts,
  toggleCommentLike,
  toggleNestedCommentLike,
  togglePostLike,
} from '@/lib/community';
import {
  createGroupComment,
  createGroupPost,
  createGroupReply,
  deleteGroupComment,
  deleteGroupNestedComment,
  deleteGroupPost,
  getGroupComments,
  getGroupNestedComments,
  getGroupPosts,
  toggleGroupCommentLike,
  toggleGroupNestedCommentLike,
  toggleGroupPostLike,
} from '@/lib/groupPosts';

type CommunityQaFeedProps = {
  onSwitchToBlog?: () => void;
  groupId?: string | null;
  groupName?: string;
  groupDescription?: string | null;
  groupVisibility?: 'public' | 'private';
  showCommunitySegments?: boolean;
  onBackPress?: () => void;
  headerExtraContent?: React.ReactNode;
  headerRightContent?: React.ReactNode;
};

// ─── Helpers ────────────────────────────────────────────────────────────
const formatRelativeDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `${diffMin} Min.`;
  if (diffHours < 24) return `${diffHours} Std.`;
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `${diffDays} T.`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
};

const getInitials = (name?: string | null) => {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'LB';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const AVATAR_GRADIENTS: [string, string][] = [
  ['#F6D5C5', '#E8A88F'],
  ['#D4B5E2', '#B88FCF'],
  ['#B5D8D4', '#8FC4BD'],
  ['#F5D0A9', '#E2B07A'],
  ['#C5D5F6', '#8FA8E8'],
  ['#F6C5D5', '#E88FA8'],
];

const getAvatarGradient = (name?: string | null): [string, string] => {
  const cleaned = (name || '').trim();
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    hash = cleaned.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

// ─── Animated Heart ─────────────────────────────────────────────────────
const AnimatedHeart = ({ liked, onPress, count, color }: {
  liked: boolean;
  onPress: () => void;
  count: number;
  color: string;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity style={styles.actionBtn} onPress={handlePress} activeOpacity={0.7}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <IconSymbol name={liked ? 'heart.fill' : 'heart'} size={20} color={liked ? '#FF4D67' : color} />
      </Animated.View>
      {count > 0 && <ThemedText style={[styles.actionCount, { color }]}>{count}</ThemedText>}
    </TouchableOpacity>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────
export default function CommunityQaFeed({
  onSwitchToBlog,
  groupId,
  groupName,
  groupDescription,
  groupVisibility,
  showCommunitySegments = true,
  onBackPress,
  headerExtraContent,
  headerRightContent,
}: CommunityQaFeedProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    unreadMessageCount,
    unreadGroupChatCount,
    unreadCommunityTotal,
  } = useCommunityUnreadCounts(user?.id);
  const params = useLocalSearchParams<{ postId?: string; post?: string; comment?: string }>();

  const primaryText = isDark ? theme.textPrimary : '#5C4033';
  const secondaryText = isDark ? theme.textSecondary : '#7D5A50';
  const tertiaryText = isDark ? theme.textTertiary : '#9C8178';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125,90,80,0.08)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(125,90,80,0.06)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#F9F5F1';

  const targetPostId = useMemo(
    () => (Array.isArray(params.postId) ? params.postId[0] : params.postId) || (Array.isArray(params.post) ? params.post[0] : params.post) || null,
    [params.post, params.postId],
  );
  const targetCommentId = useMemo(
    () => (Array.isArray(params.comment) ? params.comment[0] : params.comment) || null,
    [params.comment],
  );

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [isAnonymousPost, setIsAnonymousPost] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [newAnswer, setNewAnswer] = useState('');
  const [isAnonymousAnswer, setIsAnonymousAnswer] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isAnonymousReply, setIsAnonymousReply] = useState(false);
  const [isSavingReply, setIsSavingReply] = useState(false);

  const renderBadge = useCallback((count: number, inline = false) => {
    if (count <= 0) return null;

    return (
      <View style={[styles.countBadge, inline && styles.countBadgeInline]}>
        <ThemedText style={[styles.countBadgeText, inline && styles.countBadgeTextInline]}>
          {count > 99 ? '99+' : count}
        </ThemedText>
      </View>
    );
  }, []);

  const loadRepliesForComment = useCallback(async (commentId: string) => {
    const { data, error } = groupId
      ? await getGroupNestedComments(commentId)
      : await getNestedComments(commentId);
    if (error) {
      console.error('Fehler beim Laden der Antworten auf Kommentare:', error);
      return [] as NestedComment[];
    }
    return data || [];
  }, [groupId]);

  const hydrateCommentsWithReplies = useCallback(
    async (items: Comment[]) => {
      const commentsWithReplies = await Promise.all(
        items.map(async (comment) => ({
          ...comment,
          replies: await loadRepliesForComment(comment.id),
        })),
      );

      return commentsWithReplies;
    },
    [loadRepliesForComment],
  );

  const closeInlineReplyComposer = useCallback(() => {
    setReplyingToCommentId(null);
    setReplyText('');
    setIsAnonymousReply(false);
  }, []);

  // ─── Data loading ───────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    const { data, error } = groupId
      ? await getGroupPosts(groupId)
      : await getPosts('', [], undefined);
    if (error) {
      console.error('Fehler beim Laden der Community-Posts:', error);
      Alert.alert('Community', 'Die Community konnte gerade nicht geladen werden.');
      setPosts([]);
    } else {
      setPosts(data || []);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [groupId]);

  useEffect(() => {
    setIsLoading(true);
    loadPosts();
  }, [loadPosts]);

  const loadCommentsForPost = useCallback(async (post: Post) => {
    closeInlineReplyComposer();
    setSelectedPost(post);
    setShowThreadModal(true);
    setIsCommentsLoading(true);
    const { data, error } = groupId
      ? await getGroupComments(post.id)
      : await getComments(post.id);
    if (error) {
      console.error('Fehler beim Laden der Antworten:', error);
      Alert.alert('Antworten', 'Die Antworten konnten gerade nicht geladen werden.');
      setComments([]);
    } else {
      setComments(await hydrateCommentsWithReplies(data || []));
    }
    setIsCommentsLoading(false);
  }, [closeInlineReplyComposer, groupId, hydrateCommentsWithReplies]);

  useEffect(() => {
    if (!targetPostId || posts.length === 0 || showThreadModal) return;
    const matchingPost = posts.find((post) => post.id === targetPostId);
    if (matchingPost) loadCommentsForPost(matchingPost);
  }, [loadCommentsForPost, posts, showThreadModal, targetPostId]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPosts();
  }, [loadPosts]);

  // ─── Interactions ───────────────────────────────────────────────────
  const handleTogglePostLike = useCallback(
    async (post: Post) => {
      const { data, error } = groupId
        ? await toggleGroupPostLike(post.id)
        : await togglePostLike(post.id);
      if (error) {
        Alert.alert('Community', 'Der Beitrag konnte gerade nicht aktualisiert werden.');
        return;
      }
      const liked = !!data?.liked;
      setPosts((cur) =>
        cur.map((item) =>
          item.id === post.id
            ? { ...item, has_liked: liked, likes_count: Math.max(0, (item.likes_count || 0) + (liked ? 1 : -1)) }
            : item,
        ),
      );
      if (selectedPost?.id === post.id) {
        setSelectedPost((cur) =>
          cur ? { ...cur, has_liked: liked, likes_count: Math.max(0, (cur.likes_count || 0) + (liked ? 1 : -1)) } : cur,
        );
      }
    },
    [groupId, selectedPost?.id],
  );

  const handleToggleCommentLike = useCallback(async (comment: Comment) => {
    const { data, error } = groupId
      ? await toggleGroupCommentLike(comment.id)
      : await toggleCommentLike(comment.id);
    if (error) {
      Alert.alert('Antworten', 'Die Antwort konnte gerade nicht aktualisiert werden.');
      return;
    }
    const liked = !!data?.liked;
    setComments((cur) =>
      cur.map((item) =>
        item.id === comment.id
          ? { ...item, has_liked: liked, likes_count: Math.max(0, (item.likes_count || 0) + (liked ? 1 : -1)) }
          : item,
      ),
    );
  }, [groupId]);

  const handleToggleNestedReplyLike = useCallback(async (parentCommentId: string, reply: NestedComment) => {
    const { data, error } = groupId
      ? await toggleGroupNestedCommentLike(reply.id)
      : await toggleNestedCommentLike(reply.id);
    if (error) {
      Alert.alert('Antworten', 'Die Antwort konnte gerade nicht aktualisiert werden.');
      return;
    }
    const liked = !!data?.liked;
    setComments((cur) =>
      cur.map((comment) =>
        comment.id !== parentCommentId
          ? comment
          : {
              ...comment,
              replies: (comment.replies || []).map((item) =>
                item.id === reply.id
                  ? { ...item, has_liked: liked, likes_count: Math.max(0, (item.likes_count || 0) + (liked ? 1 : -1)) }
                  : item,
              ),
            },
      ),
    );
  }, [groupId]);

  const handleCreatePost = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Community', 'Bitte melde dich erneut an.');
      return;
    }
    if (!newQuestion.trim()) {
      Alert.alert('Community', 'Bitte formuliere zuerst deine Frage oder dein Thema.');
      return;
    }
    setIsSavingPost(true);
    const { error } = groupId
      ? await createGroupPost(groupId, newQuestion.trim(), isAnonymousPost)
      : await createPost(newQuestion.trim(), isAnonymousPost);
    setIsSavingPost(false);
    if (error) {
      Alert.alert('Community', 'Dein Beitrag konnte gerade nicht erstellt werden.');
      return;
    }
    setNewQuestion('');
    setIsAnonymousPost(false);
    setShowCreateModal(false);
    setIsLoading(true);
    loadPosts();
  }, [groupId, isAnonymousPost, loadPosts, newQuestion, user?.id]);

  const handleCreateComment = useCallback(async () => {
    if (!selectedPost) return;
    if (!newAnswer.trim()) {
      Alert.alert('Antworten', 'Bitte schreibe zuerst eine Antwort.');
      return;
    }
    setIsSavingAnswer(true);
    const { error } = groupId
      ? await createGroupComment(selectedPost.id, newAnswer.trim(), isAnonymousAnswer)
      : await createComment(selectedPost.id, newAnswer.trim(), isAnonymousAnswer);
    setIsSavingAnswer(false);
    if (error) {
      Alert.alert('Antworten', 'Deine Antwort konnte gerade nicht gespeichert werden.');
      return;
    }
    setNewAnswer('');
    setIsAnonymousAnswer(false);
    const updatedPost = { ...selectedPost, comments_count: (selectedPost.comments_count || 0) + 1 };
    setSelectedPost(updatedPost);
    setPosts((cur) => cur.map((post) => (post.id === selectedPost.id ? updatedPost : post)));
    await loadCommentsForPost(updatedPost);
  }, [groupId, isAnonymousAnswer, loadCommentsForPost, newAnswer, selectedPost]);

  const handleCreateReply = useCallback(async (comment: Comment) => {
    if (!replyText.trim()) {
      Alert.alert('Antworten', 'Bitte schreibe zuerst eine Antwort.');
      return;
    }

    setIsSavingReply(true);
    const { error } = groupId
      ? await createGroupReply(comment.id, replyText.trim(), isAnonymousReply)
      : await createReply(comment.id, replyText.trim(), isAnonymousReply);
    setIsSavingReply(false);

    if (error) {
      Alert.alert('Antworten', 'Deine Antwort auf den Kommentar konnte gerade nicht gespeichert werden.');
      return;
    }

    const replies = await loadRepliesForComment(comment.id);
    setComments((cur) =>
      cur.map((item) => (item.id === comment.id ? { ...item, replies } : item)),
    );
    closeInlineReplyComposer();
  }, [closeInlineReplyComposer, groupId, isAnonymousReply, loadRepliesForComment, replyText]);

  const closeThreadModal = useCallback(() => {
    setShowThreadModal(false);
    setSelectedPost(null);
    setComments([]);
    setNewAnswer('');
    setIsAnonymousAnswer(false);
    closeInlineReplyComposer();

    if (targetPostId || targetCommentId) {
      router.replace(pathname as any);
    }
  }, [closeInlineReplyComposer, pathname, router, targetCommentId, targetPostId]);

  const handleDeletePost = useCallback((post: Post) => {
    Alert.alert(
      'Beitrag löschen',
      'Möchtest du deinen Beitrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = groupId
              ? await deleteGroupPost(post.id)
              : await deletePost(post.id);
            if (error) {
              Alert.alert('Community', 'Dein Beitrag konnte gerade nicht gelöscht werden.');
              return;
            }

            setPosts((cur) => cur.filter((item) => item.id !== post.id));

            if (selectedPost?.id === post.id) {
              closeThreadModal();
            }
          },
        },
      ],
    );
  }, [closeThreadModal, groupId, selectedPost?.id]);

  const handleDeleteComment = useCallback((comment: Comment) => {
    Alert.alert(
      'Antwort löschen',
      'Möchtest du deine Antwort wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = groupId
              ? await deleteGroupComment(comment.id)
              : await deleteComment(comment.id);
            if (error) {
              Alert.alert('Antworten', 'Deine Antwort konnte gerade nicht gelöscht werden.');
              return;
            }

            setComments((cur) => cur.filter((item) => item.id !== comment.id));
            if (replyingToCommentId === comment.id) {
              closeInlineReplyComposer();
            }

            if (selectedPost) {
              const updatedPost = {
                ...selectedPost,
                comments_count: Math.max(0, (selectedPost.comments_count || 0) - 1),
              };
              setSelectedPost(updatedPost);
              setPosts((cur) => cur.map((post) => (post.id === selectedPost.id ? updatedPost : post)));
            }
          },
        },
      ],
    );
  }, [closeInlineReplyComposer, groupId, replyingToCommentId, selectedPost]);

  const handleDeleteReply = useCallback((parentCommentId: string, reply: NestedComment) => {
    Alert.alert(
      'Antwort löschen',
      'Möchtest du deine Antwort auf den Kommentar wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = groupId
              ? await deleteGroupNestedComment(reply.id)
              : await deleteNestedComment(reply.id);
            if (error) {
              Alert.alert('Antworten', 'Deine Antwort konnte gerade nicht gelöscht werden.');
              return;
            }

            setComments((cur) =>
              cur.map((comment) =>
                comment.id !== parentCommentId
                  ? comment
                  : {
                      ...comment,
                      replies: (comment.replies || []).filter((item) => item.id !== reply.id),
                    },
              ),
            );
          },
        },
      ],
    );
  }, [groupId]);

  // ─── Trending Topics ───────────────────────────────────────────────
  const trendingTopics = useMemo(() => {
    const topics: { label: string; count: number; emoji: string }[] = [];
    let questionCount = 0;
    let hotCount = 0;
    let newCount = 0;

    for (const p of posts) {
      if ((p.content || '').includes('?')) questionCount++;
      if ((p.comments_count || 0) >= 3 || (p.likes_count || 0) >= 3) hotCount++;
      const age = Date.now() - new Date(p.created_at).getTime();
      if (age < 24 * 60 * 60 * 1000) newCount++;
    }

    if (hotCount > 0) topics.push({ label: 'Beliebt', count: hotCount, emoji: '\uD83D\uDD25' });
    if (newCount > 0) topics.push({ label: 'Heute', count: newCount, emoji: '\u2728' });
    if (questionCount > 0) topics.push({ label: 'Fragen', count: questionCount, emoji: '\u2753' });
    topics.push({ label: 'Alle', count: posts.length, emoji: '\uD83D\uDCAC' });

    return topics;
  }, [posts]);

  // ─── Avatar Component ─────────────────────────────────────────────
  const Avatar = ({ name, avatarUrl, isAnonymous, size = 44 }: {
    name?: string | null;
    avatarUrl?: string | null;
    isAnonymous?: boolean;
    size?: number;
  }) => {
    const gradient = isAnonymous ? ['#D4CCC8', '#B8AFA8'] as [string, string] : getAvatarGradient(name);
    const fontSize = size < 36 ? 11 : size < 44 ? 13 : 15;

    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {avatarUrl && !isAnonymous ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <ThemedText style={[styles.avatarText, { fontSize }]}>
            {isAnonymous ? '\uD83D\uDE4A' : getInitials(name)}
          </ThemedText>
        )}
      </LinearGradient>
    );
  };

  // ─── List Header ──────────────────────────────────────────────────
  const listHeader = (
    <View style={styles.listHeader}>
      {/* Header */}
      <Header
        title={groupName || 'Community'}
        subtitle={`${posts.length} ${posts.length === 1 ? 'Beitrag' : 'Beiträge'}`}
        showBackButton={!!groupId}
        onBackPress={onBackPress}
        showBabySwitcher={false}
        rightContent={
          headerRightContent ?? (
            <View style={styles.headerActions}>
              <View style={styles.iconBadgeWrap}>
                <TouchableOpacity
                  style={[styles.composeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(200,159,129,0.12)' }]}
                  onPress={() => router.push('/(tabs)/notifications' as any)}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="bell" size={19} color={isDark ? '#E9C9B6' : '#C89F81'} />
                </TouchableOpacity>
                {renderBadge(unreadCommunityTotal)}
              </View>
            </View>
          )
        }
      />

      {groupId ? (
        <View style={[styles.groupHeroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.groupHeroTopRow}>
            <View style={[styles.groupVisibilityBadge, { backgroundColor: isDark ? 'rgba(233,201,182,0.15)' : 'rgba(200,159,129,0.12)' }]}>
              <ThemedText style={[styles.groupVisibilityBadgeText, { color: isDark ? '#E9C9B6' : '#C89F81' }]}>
                {groupVisibility === 'private' ? 'Private Gruppe' : 'Öffentliche Gruppe'}
              </ThemedText>
            </View>
          </View>
          {!!groupDescription && (
            <ThemedText style={[styles.groupHeroDescription, { color: secondaryText }]}>
              {groupDescription}
            </ThemedText>
          )}
          {headerExtraContent}
        </View>
      ) : null}

      {showCommunitySegments ? (
        <>
          {/* Segment Tabs */}
          <View style={[styles.segmentRow, { borderBottomColor: dividerColor }]}>
            <TouchableOpacity style={styles.segmentTab} activeOpacity={0.9}>
              <ThemedText style={[styles.segmentTextActive, { color: primaryText }]}>Fragen</ThemedText>
              <View style={[styles.segmentIndicator, { backgroundColor: isDark ? '#E9C9B6' : '#C89F81' }]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.segmentTab}
              activeOpacity={0.7}
              onPress={() => router.push('/groups' as any)}
            >
              <ThemedText style={[styles.segmentText, styles.segmentTextCompact, { color: tertiaryText }]}>Gruppen</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.segmentTab}
              activeOpacity={0.7}
              onPress={() => {
                if (onSwitchToBlog) { onSwitchToBlog(); return; }
                router.push('/(tabs)/blog' as any);
              }}
            >
              <ThemedText style={[styles.segmentText, styles.segmentTextCompact, { color: tertiaryText }]}>Blog</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.segmentTab}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/notifications' as any)}
            >
              <View style={styles.segmentLabelRow}>
                <ThemedText style={[styles.segmentText, styles.segmentTextCompact, { color: tertiaryText }]}>
                  Chats
                </ThemedText>
                {renderBadge(unreadMessageCount + unreadGroupChatCount, true)}
              </View>
            </TouchableOpacity>
          </View>

          {/* Trending Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingRow}
          >
            {trendingTopics.map((topic) => (
              <View
                key={topic.label}
                style={[styles.trendingPill, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <ThemedText style={styles.trendingEmoji}>{topic.emoji}</ThemedText>
                <ThemedText style={[styles.trendingLabel, { color: secondaryText }]}>{topic.label}</ThemedText>
                <View style={[styles.trendingCount, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(200,159,129,0.1)' }]}>
                  <ThemedText style={[styles.trendingCountText, { color: tertiaryText }]}>{topic.count}</ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );

  // ─── Post Card ────────────────────────────────────────────────────
  const renderPost = ({ item }: { item: Post }) => {
    const isHighlighted = item.id === targetPostId;
    const displayName = item.user_name || 'Community Mitglied';
    const isQuestion = (item.content || '').includes('?');
    const commentCount = item.comments_count || 0;
    const likeCount = item.likes_count || 0;
    const isOwnPost = item.user_id === user?.id;

    return (
      <View
        style={[
          styles.postCard,
          {
            backgroundColor: cardBg,
            borderColor: isHighlighted ? (isDark ? '#E9C9B6' : '#C89F81') : cardBorder,
            borderWidth: isHighlighted ? 1.5 : 1,
          },
        ]}
      >
        {/* Author Row */}
        <View style={styles.postAuthorRow}>
          <TouchableOpacity
            style={styles.postAuthorInfo}
            disabled={item.is_anonymous}
            onPress={() => !item.is_anonymous && item.user_id && router.push(`/profile/${item.user_id}` as any)}
            activeOpacity={0.7}
          >
            <Avatar name={displayName} avatarUrl={item.user_avatar_url} isAnonymous={item.is_anonymous} size={40} />
            <View style={styles.postAuthorMeta}>
              <View style={styles.postAuthorNameRow}>
                <ThemedText style={[styles.postAuthorName, { color: primaryText }]} numberOfLines={1}>
                  {displayName}
                </ThemedText>
                {isQuestion && (
                  <View style={[styles.typeBadge, { backgroundColor: isDark ? 'rgba(233,201,182,0.15)' : 'rgba(200,159,129,0.12)' }]}>
                    <ThemedText style={[styles.typeBadgeText, { color: isDark ? '#E9C9B6' : '#C89F81' }]}>Frage</ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={[styles.postTime, { color: tertiaryText }]}>
                {formatRelativeDate(item.created_at)}
              </ThemedText>
            </View>
          </TouchableOpacity>
          <View style={styles.postAuthorActions}>
            {!isOwnPost && !item.is_anonymous && item.user_id ? (
              <FollowButton
                userId={item.user_id}
                size="small"
                showIcon={false}
                style={styles.feedFollowButton}
              />
            ) : null}
            {isOwnPost ? (
              <TouchableOpacity style={styles.moreBtn} activeOpacity={0.7} onPress={() => handleDeletePost(item)}>
                <IconSymbol name="trash" size={18} color={tertiaryText} />
              </TouchableOpacity>
            ) : !item.is_anonymous ? null : (
              <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} disabled>
                <IconSymbol name="ellipsis" size={18} color={tertiaryText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        <ThemedText style={[styles.postContent, { color: isDark ? theme.textSecondary : '#3D2B22' }]}>
          {item.content}
        </ThemedText>

        {/* Image */}
        {!!item.image_url && (
          <View style={styles.postImageWrap}>
            <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
          </View>
        )}

        {/* Engagement summary */}
        {(likeCount > 0 || commentCount > 0) && (
          <View style={[styles.engagementRow, { borderTopColor: dividerColor }]}>
            {likeCount > 0 && (
              <ThemedText style={[styles.engagementText, { color: tertiaryText }]}>
                {likeCount} {likeCount === 1 ? 'Gefällt mir' : 'Likes'}
              </ThemedText>
            )}
            {commentCount > 0 && (
              <TouchableOpacity onPress={() => loadCommentsForPost(item)} activeOpacity={0.7}>
                <ThemedText style={[styles.engagementText, { color: tertiaryText }]}>
                  {commentCount} {commentCount === 1 ? 'Antwort' : 'Antworten'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Bar */}
        <View style={[styles.actionBar, { borderTopColor: dividerColor }]}>
          <AnimatedHeart
            liked={!!item.has_liked}
            onPress={() => handleTogglePostLike(item)}
            count={0}
            color={tertiaryText}
          />
          <TouchableOpacity style={styles.actionBtn} onPress={() => loadCommentsForPost(item)} activeOpacity={0.7}>
            <IconSymbol name="bubble.right" size={19} color={tertiaryText} />
            {commentCount > 0 && <ThemedText style={[styles.actionCount, { color: tertiaryText }]}>{commentCount}</ThemedText>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <IconSymbol name="bookmark" size={19} color={tertiaryText} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Comment Card ─────────────────────────────────────────────────
  const renderNestedReply = (parentCommentId: string, reply: NestedComment) => {
    const displayName = reply.user_name || 'Community Mitglied';
    const isOwnReply = reply.user_id === user?.id;

    return (
      <View key={reply.id} style={[styles.replyCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F1EA', borderColor: cardBorder }]}>
        <Avatar name={displayName} avatarUrl={reply.user_avatar_url} isAnonymous={reply.is_anonymous} size={28} />
        <View style={styles.replyBody}>
          <View style={styles.replyBubble}>
            <ThemedText style={[styles.replyAuthor, { color: primaryText }]}>{displayName}</ThemedText>
            <ThemedText style={[styles.replyText, { color: isDark ? theme.textSecondary : '#3D2B22' }]}>{reply.content}</ThemedText>
          </View>
          <View style={styles.replyMeta}>
            <ThemedText style={[styles.replyTime, { color: tertiaryText }]}>{formatRelativeDate(reply.created_at)}</ThemedText>
            <TouchableOpacity
              onPress={() => handleToggleNestedReplyLike(parentCommentId, reply)}
              activeOpacity={0.7}
              style={styles.replyLikeBtn}
            >
              <IconSymbol name={reply.has_liked ? 'heart.fill' : 'heart'} size={12} color={reply.has_liked ? '#FF4D67' : tertiaryText} />
              {(reply.likes_count || 0) > 0 && (
                <ThemedText style={[styles.replyLikeCount, { color: tertiaryText }]}>{reply.likes_count}</ThemedText>
              )}
            </TouchableOpacity>
            {isOwnReply && (
              <TouchableOpacity onPress={() => handleDeleteReply(parentCommentId, reply)} activeOpacity={0.7} style={styles.replyDeleteBtn}>
                <IconSymbol name="trash" size={12} color={tertiaryText} />
                <ThemedText style={[styles.replyDeleteText, { color: tertiaryText }]}>Löschen</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isHighlighted = item.id === targetCommentId;
    const displayName = item.user_name || 'Community Mitglied';
    const isOwnComment = item.user_id === user?.id;
    const replyCount = item.replies?.length || 0;
    const isReplying = replyingToCommentId === item.id;

    return (
      <View
        style={[
          styles.commentCard,
          {
            backgroundColor: isHighlighted ? (isDark ? 'rgba(233,201,182,0.08)' : 'rgba(200,159,129,0.06)') : 'transparent',
          },
        ]}
      >
        <Avatar name={displayName} avatarUrl={item.user_avatar_url} isAnonymous={item.is_anonymous} size={34} />
        <View style={styles.commentBody}>
          <View style={styles.commentBubble}>
            <ThemedText style={[styles.commentAuthor, { color: primaryText }]}>{displayName}</ThemedText>
            <ThemedText style={[styles.commentText, { color: isDark ? theme.textSecondary : '#3D2B22' }]}>{item.content}</ThemedText>
          </View>
          <View style={styles.commentMeta}>
            <ThemedText style={[styles.commentTime, { color: tertiaryText }]}>{formatRelativeDate(item.created_at)}</ThemedText>
            <TouchableOpacity onPress={() => handleToggleCommentLike(item)} activeOpacity={0.7} style={styles.commentLikeBtn}>
              <IconSymbol name={item.has_liked ? 'heart.fill' : 'heart'} size={13} color={item.has_liked ? '#FF4D67' : tertiaryText} />
              {(item.likes_count || 0) > 0 && (
                <ThemedText style={[styles.commentLikeCount, { color: tertiaryText }]}>{item.likes_count}</ThemedText>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (isReplying) {
                  closeInlineReplyComposer();
                  return;
                }
                setReplyingToCommentId(item.id);
                setReplyText('');
                setIsAnonymousReply(false);
              }}
              activeOpacity={0.7}
              style={styles.commentReplyBtn}
            >
              <IconSymbol name="arrowshape.turn.up.left" size={13} color={isReplying ? (isDark ? '#E9C9B6' : '#C89F81') : tertiaryText} />
              <ThemedText style={[styles.commentReplyText, { color: isReplying ? (isDark ? '#E9C9B6' : '#C89F81') : tertiaryText }]}>
                Antworten
              </ThemedText>
            </TouchableOpacity>
            {replyCount > 0 && (
              <ThemedText style={[styles.commentRepliesCount, { color: tertiaryText }]}>
                {replyCount} {replyCount === 1 ? 'Antwort' : 'Antworten'}
              </ThemedText>
            )}
            {isOwnComment && (
              <TouchableOpacity onPress={() => handleDeleteComment(item)} activeOpacity={0.7} style={styles.commentDeleteBtn}>
                <IconSymbol name="trash" size={13} color={tertiaryText} />
                <ThemedText style={[styles.commentDeleteText, { color: tertiaryText }]}>Löschen</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          {isReplying && (
            <View style={[styles.inlineReplyComposer, { backgroundColor: inputBg, borderColor: cardBorder }]}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder={`Auf ${displayName} antworten...`}
                placeholderTextColor={tertiaryText}
                style={[styles.inlineReplyInput, { color: primaryText }]}
                multiline
              />
              <View style={styles.inlineReplyFooter}>
                <TouchableOpacity
                  style={styles.inlineReplyAnonToggle}
                  onPress={() => setIsAnonymousReply(!isAnonymousReply)}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name={isAnonymousReply ? 'eye.slash.fill' : 'eye'}
                    size={14}
                    color={isAnonymousReply ? (isDark ? '#E9C9B6' : '#C89F81') : tertiaryText}
                  />
                  <ThemedText style={[styles.anonToggleText, { color: isAnonymousReply ? (isDark ? '#E9C9B6' : '#C89F81') : tertiaryText }]}>
                    {isAnonymousReply ? 'Anonym' : 'Sichtbar'}
                  </ThemedText>
                </TouchableOpacity>
                <View style={styles.inlineReplyActions}>
                  <TouchableOpacity onPress={closeInlineReplyComposer} activeOpacity={0.7} style={styles.inlineReplyCancelBtn}>
                    <ThemedText style={[styles.inlineReplyCancelText, { color: tertiaryText }]}>Abbrechen</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleCreateReply(item)}
                    disabled={isSavingReply || !replyText.trim()}
                    activeOpacity={0.8}
                    style={[styles.inlineReplySendBtn, { backgroundColor: isDark ? '#E9C9B6' : '#C89F81', opacity: isSavingReply || !replyText.trim() ? 0.4 : 1 }]}
                  >
                    {isSavingReply ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.inlineReplySendText}>Antworten</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {replyCount > 0 && (
            <View style={styles.replyList}>
              {item.replies?.map((reply) => renderNestedReply(item.id, reply))}
            </View>
          )}
        </View>
      </View>
    );
  };

  // ─── Empty State ──────────────────────────────────────────────────
  const emptyState = (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(200,159,129,0.08)' }]}>
        <ThemedText style={styles.emptyEmoji}>{'\uD83D\uDCAC'}</ThemedText>
      </View>
      <ThemedText style={[styles.emptyTitle, { color: primaryText }]}>Noch keine Beiträge</ThemedText>
      <ThemedText style={[styles.emptyText, { color: tertiaryText }]}>
        {groupId
          ? 'Starte den Austausch in dieser Gruppe mit dem ersten Beitrag.'
          : 'Sei die Erste! Stelle eine Frage oder teile deine Erfahrungen mit der Community.'}
      </ThemedText>
      <TouchableOpacity
        style={[styles.emptyBtn]}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={isDark ? ['#D4A88C', '#C89F81'] : ['#D4A88C', '#C89F81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyBtnGradient}
        >
          <IconSymbol name="plus" size={16} color="#FFFFFF" />
          <ThemedText style={styles.emptyBtnText}>{groupId ? 'Ersten Beitrag schreiben' : 'Erste Frage stellen'}</ThemedText>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ─── Main Render ──────────────────────────────────────────────────
  return (
    <ThemedBackground style={styles.bg}>
      <ThemedView style={styles.screen}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <SafeAreaView style={styles.safeArea}>
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={isDark ? '#E9C9B6' : '#C89F81'} />
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderPost}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={emptyState}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={isDark ? '#E9C9B6' : '#C89F81'}
                />
              }
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* FAB */}
          <TouchableOpacity
            style={[styles.fab, { bottom: Math.max(insets.bottom + 80, 100) }]}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#D4A88C', '#C89F81', '#B8907A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <IconSymbol name="plus" size={22} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* ─── Create Post Modal ─────────────────────────────────── */}
          <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalFlex}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.modalOverlay}>
                  <View
                    style={[
                      styles.createSheet,
                      {
                        backgroundColor: isDark ? '#1E1916' : '#FFFAF5',
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    {/* Handle */}
                    <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />

                    {/* Header */}
                    <View style={styles.createHeader}>
                      <TouchableOpacity
                        onPress={() => { setShowCreateModal(false); setNewQuestion(''); setIsAnonymousPost(false); }}
                        activeOpacity={0.7}
                      >
                        <ThemedText style={[styles.createCancel, { color: tertiaryText }]}>Abbrechen</ThemedText>
                      </TouchableOpacity>
                      <ThemedText style={[styles.createTitle, { color: primaryText }]}>
                        {groupId ? 'Neuer Gruppenbeitrag' : 'Neuer Beitrag'}
                      </ThemedText>
                      <TouchableOpacity
                        style={[styles.createPostBtn, { opacity: isSavingPost || !newQuestion.trim() ? 0.4 : 1 }]}
                        onPress={handleCreatePost}
                        disabled={isSavingPost || !newQuestion.trim()}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#D4A88C', '#C89F81']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.createPostBtnInner}
                        >
                          {isSavingPost ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <ThemedText style={styles.createPostBtnText}>Posten</ThemedText>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>

                    {/* Composer */}
                    <View style={styles.composerRow}>
                      <Avatar name={user?.user_metadata?.display_name} avatarUrl={null} isAnonymous={isAnonymousPost} size={38} />
                      <View style={styles.composerMeta}>
                        <ThemedText style={[styles.composerName, { color: primaryText }]}>
                          {isAnonymousPost ? 'Anonym' : (user?.user_metadata?.display_name || 'Du')}
                        </ThemedText>
                        <ThemedText style={[styles.composerHint, { color: tertiaryText }]}>Öffentlich</ThemedText>
                      </View>
                    </View>

                    <TextInput
                      value={newQuestion}
                      onChangeText={setNewQuestion}
                      multiline
                      placeholder={groupId ? `Was möchtest du in ${groupName || 'dieser Gruppe'} teilen?` : 'Was beschäftigt dich gerade?'}
                      placeholderTextColor={tertiaryText}
                      style={[styles.createInput, { color: primaryText }]}
                      autoFocus
                    />

                    {/* Anonymous Toggle */}
                    <View style={[styles.anonRow, { borderTopColor: dividerColor }]}>
                      <View style={styles.anonInfo}>
                        <IconSymbol name="eye.slash" size={18} color={tertiaryText} />
                        <View style={styles.anonTextWrap}>
                          <ThemedText style={[styles.anonLabel, { color: secondaryText }]}>Anonym posten</ThemedText>
                          <ThemedText style={[styles.anonHint, { color: tertiaryText }]}>Dein Name wird nicht angezeigt</ThemedText>
                        </View>
                      </View>
                      <Switch
                        value={isAnonymousPost}
                        onValueChange={setIsAnonymousPost}
                        trackColor={{ false: isDark ? '#3D3330' : '#E5DDD7', true: isDark ? 'rgba(233,201,182,0.4)' : 'rgba(200,159,129,0.4)' }}
                        thumbColor={isAnonymousPost ? (isDark ? '#E9C9B6' : '#C89F81') : isDark ? '#5C4A42' : '#FFFFFF'}
                      />
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Modal>

          {/* ─── Thread Modal ──────────────────────────────────────── */}
          <Modal visible={showThreadModal} animationType="slide" transparent onRequestClose={closeThreadModal}>
            <View style={styles.threadOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.threadWrap}>
                <View style={styles.threadSheetContainer}>
                  <View
                    style={[
                      styles.threadSheet,
                      {
                        backgroundColor: isDark ? '#1E1916' : '#FFFAF5',
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                  {/* Handle */}
                  <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />

                  {/* Thread Header */}
                  <View style={[styles.threadHeader, { borderBottomColor: dividerColor }]}>
                    <ThemedText style={[styles.threadTitle, { color: primaryText }]}>Antworten</ThemedText>
                    <TouchableOpacity onPress={closeThreadModal} style={[styles.threadCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                      <IconSymbol name="xmark" size={16} color={tertiaryText} />
                    </TouchableOpacity>
                  </View>

                  {/* Original Post */}
                  {selectedPost && (
                    <View style={[styles.threadOriginal, { borderBottomColor: dividerColor }]}>
                      <View style={styles.threadOriginalAuthor}>
                        <Avatar
                          name={selectedPost.user_name}
                          avatarUrl={selectedPost.user_avatar_url}
                          isAnonymous={selectedPost.is_anonymous}
                          size={36}
                        />
                        <View>
                          <ThemedText style={[styles.threadOriginalName, { color: primaryText }]}>
                            {selectedPost.user_name || 'Community Mitglied'}
                          </ThemedText>
                          <ThemedText style={[styles.threadOriginalTime, { color: tertiaryText }]}>
                            {formatRelativeDate(selectedPost.created_at)}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.threadOriginalContent, { color: isDark ? theme.textSecondary : '#3D2B22' }]}>
                        {selectedPost.content}
                      </ThemedText>
                      <View style={styles.threadOriginalActions}>
                        <AnimatedHeart
                          liked={!!selectedPost.has_liked}
                          onPress={() => handleTogglePostLike(selectedPost)}
                          count={selectedPost.likes_count || 0}
                          color={tertiaryText}
                        />
                      </View>
                    </View>
                  )}

                  {/* Comments List */}
                  <View style={styles.threadBody}>
                    {isCommentsLoading ? (
                      <View style={styles.commentsLoading}>
                        <ActivityIndicator size="small" color={isDark ? '#E9C9B6' : '#C89F81'} />
                      </View>
                    ) : (
                      <FlatList
                        data={comments}
                        keyExtractor={(item) => item.id}
                        renderItem={renderComment}
                        style={styles.commentsScroller}
                        contentContainerStyle={styles.commentsList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                          <View style={styles.emptyComments}>
                            <ThemedText style={[styles.emptyCommentsText, { color: tertiaryText }]}>
                              Noch keine Antworten — sei die Erste!
                            </ThemedText>
                          </View>
                        }
                      />
                    )}
                  </View>

                  {/* Composer */}
                  <View style={[styles.threadComposer, { borderTopColor: dividerColor, paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.threadInputRow}>
                      <Avatar name={user?.user_metadata?.display_name} avatarUrl={null} isAnonymous={isAnonymousAnswer} size={32} />
                      <TextInput
                        value={newAnswer}
                        onChangeText={setNewAnswer}
                        placeholder="Antwort schreiben..."
                        placeholderTextColor={tertiaryText}
                        style={[styles.threadInput, { backgroundColor: inputBg, color: primaryText, borderColor: cardBorder }]}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={handleCreateComment}
                        disabled={isSavingAnswer || !newAnswer.trim()}
                        style={[styles.sendBtn, { opacity: isSavingAnswer || !newAnswer.trim() ? 0.35 : 1 }]}
                        activeOpacity={0.8}
                      >
                        {isSavingAnswer ? (
                          <ActivityIndicator color={isDark ? '#E9C9B6' : '#C89F81'} size="small" />
                        ) : (
                          <IconSymbol name="arrow.up.circle.fill" size={32} color={isDark ? '#E9C9B6' : '#C89F81'} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.anonToggleSmall}
                      onPress={() => setIsAnonymousAnswer(!isAnonymousAnswer)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        name={isAnonymousAnswer ? 'eye.slash.fill' : 'eye'}
                        size={14}
                        color={isAnonymousAnswer ? (isDark ? '#E9C9B6' : '#C89F81') : tertiaryText}
                      />
                      <ThemedText style={[styles.anonToggleText, { color: isAnonymousAnswer ? (isDark ? '#E9C9B6' : '#C89F81') : tertiaryText }]}>
                        {isAnonymousAnswer ? 'Anonym' : 'Sichtbar'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        </SafeAreaView>
      </ThemedView>
    </ThemedBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, gap: 2 },

  // ── Compose Button ──
  composeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadgeWrap: {
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 0,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
  },
  countBadgeInline: {
    position: 'relative',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 0,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 11,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  countBadgeTextInline: {
    fontSize: 10,
    lineHeight: 10,
  },

  // ── Segments ──
  segmentRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  segmentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentTextActive: { fontSize: 15, fontWeight: '700' },
  segmentText: { fontSize: 15, fontWeight: '500' },
  segmentTextCompact: { fontSize: 13, textAlign: 'center' },
  segmentIndicator: {
    marginTop: 8,
    height: 2.5,
    width: 32,
    borderRadius: 2,
  },

  // ── Trending ──
  trendingRow: { paddingHorizontal: 4, gap: 8, paddingBottom: 16 },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  trendingEmoji: { fontSize: 14 },
  trendingLabel: { fontSize: 13, fontWeight: '600' },
  trendingCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  trendingCountText: { fontSize: 11, fontWeight: '700' },

  // ── List Header ──
  listHeader: { paddingBottom: 8 },
  groupHeroCard: {
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  groupHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupVisibilityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupVisibilityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  groupHeroDescription: {
    fontSize: 14,
    lineHeight: 20,
  },

  // ── Post Card ──
  postCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 0,
  },
  postAuthorInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  postAuthorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  postAuthorMeta: { flex: 1, gap: 1 },
  postAuthorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAuthorName: { fontSize: 15, fontWeight: '700' },
  postTime: { fontSize: 12 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  moreBtn: { padding: 6 },
  feedFollowButton: {
    minWidth: 70,
    paddingHorizontal: 10,
  },

  // ── Post Content ──
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  postImageWrap: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  postImage: { width: '100%', height: 240, borderRadius: 14 },

  // ── Engagement ──
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  engagementText: { fontSize: 12, fontWeight: '500' },

  // ── Actions ──
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  actionCount: { fontSize: 13, fontWeight: '600' },

  // ── Avatar ──
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontWeight: '700', color: '#FFFFFF' },

  // ── Empty State ──
  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 14 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  emptyBtn: { marginTop: 8, borderRadius: 24, overflow: 'hidden' },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // ── FAB ──
  fab: {
    position: 'absolute',
    right: 20,
    shadowColor: '#8B6B55',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderRadius: 28,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Create Modal ──
  modalFlex: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,12,10,0.4)', justifyContent: 'flex-end' },
  createSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    minHeight: 380,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  createCancel: { fontSize: 15, fontWeight: '500' },
  createTitle: { fontSize: 17, fontWeight: '700' },
  createPostBtn: { borderRadius: 18, overflow: 'hidden' },
  createPostBtnInner: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPostBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  composerMeta: { gap: 1 },
  composerName: { fontSize: 15, fontWeight: '600' },
  composerHint: { fontSize: 12 },
  createInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  anonInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  anonTextWrap: { gap: 1 },
  anonLabel: { fontSize: 14, fontWeight: '600' },
  anonHint: { fontSize: 12 },

  // ── Thread Modal ──
  threadOverlay: { flex: 1, backgroundColor: 'rgba(16,12,10,0.45)', justifyContent: 'flex-end' },
  threadWrap: { flex: 1, justifyContent: 'flex-end' },
  threadSheetContainer: {
    width: '100%',
    maxHeight: '99%',
    minHeight: 640,
  },
  threadSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  threadTitle: { fontSize: 17, fontWeight: '700' },
  threadCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Original Post in Thread ──
  threadOriginal: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  threadOriginalAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  threadOriginalName: { fontSize: 15, fontWeight: '700' },
  threadOriginalTime: { fontSize: 12 },
  threadOriginalContent: { fontSize: 15, lineHeight: 22 },
  threadOriginalActions: { flexDirection: 'row', alignItems: 'center' },

  // ── Comments ──
  commentsLoading: { paddingVertical: 32, alignItems: 'center' },
  threadBody: { flex: 1 },
  commentsScroller: { flex: 1 },
  commentsList: { paddingTop: 8, paddingBottom: 8, flexGrow: 1 },
  commentCard: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 10,
  },
  commentBody: { flex: 1, gap: 4 },
  commentBubble: { gap: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  commentTime: { fontSize: 11 },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentLikeCount: { fontSize: 11, fontWeight: '600' },
  commentReplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentReplyText: { fontSize: 11, fontWeight: '600' },
  commentRepliesCount: { fontSize: 11, fontWeight: '500' },
  commentDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentDeleteText: { fontSize: 11, fontWeight: '600' },
  inlineReplyComposer: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  inlineReplyInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 64,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  inlineReplyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineReplyAnonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineReplyActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineReplyCancelBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  inlineReplyCancelText: { fontSize: 12, fontWeight: '600' },
  inlineReplySendBtn: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineReplySendText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  replyList: {
    marginTop: 10,
    paddingLeft: 10,
    gap: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(200,159,129,0.22)',
  },
  replyCard: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  replyBody: { flex: 1, gap: 4 },
  replyBubble: { gap: 2 },
  replyAuthor: { fontSize: 12, fontWeight: '700' },
  replyText: { fontSize: 13, lineHeight: 18 },
  replyMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  replyTime: { fontSize: 10 },
  replyLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyLikeCount: { fontSize: 10, fontWeight: '600' },
  replyDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyDeleteText: { fontSize: 10, fontWeight: '600' },

  emptyComments: { paddingVertical: 32, alignItems: 'center' },
  emptyCommentsText: { fontSize: 14 },

  // ── Thread Composer ──
  threadComposer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  threadInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  threadInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendBtn: { paddingBottom: 2 },
  anonToggleSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingLeft: 42,
    paddingBottom: 2,
  },
  anonToggleText: { fontSize: 11, fontWeight: '600' },
});
