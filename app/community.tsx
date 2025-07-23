import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
// useRouter wird durch die BackButton-Komponente verwaltet
import { useAuth } from '@/contexts/AuthContext';
import { Post, Comment, getPosts, getComments, createPost, createComment, togglePostLike, toggleCommentLike, deletePost, deleteComment, getNestedComments, createReply, toggleNestedCommentLike, deleteNestedComment } from '@/lib/community';
import { PollComponent } from '@/components/PollComponent';
import { CreatePollForm } from '@/components/CreatePollForm';
import { CreatePollPost } from '@/components/CreatePollPost';
import { getPollsByPostId } from '@/lib/polls';
import { TagSelector } from '@/components/TagSelector';
import { TagDisplay } from '@/components/TagDisplay';
import { TagFilter } from '@/components/TagFilter';
import * as ImagePicker from 'expo-image-picker';
import Header from '@/components/Header';
import { NotificationsList } from '@/components/NotificationsList';
import { NotificationBadge } from '@/components/NotificationBadge';
import { useRouter } from 'expo-router';
import { FollowButton } from '@/components/FollowButton';

export default function CommunityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  // router wird durch die BackButton-Komponente verwaltet
  const { user } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [postComments, setPostComments] = useState<{[key: string]: Comment[]}>({});
  const [postPolls, setPostPolls] = useState<{[key: string]: any[]}>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddPollForm, setShowAddPollForm] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isAnonymousPost, setIsAnonymousPost] = useState(false);
  const [postType, setPostType] = useState<'text' | 'poll'>('text');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commentInputs, setCommentInputs] = useState<{[key: string]: string}>({});
  const [isAnonymousComment, setIsAnonymousComment] = useState<{[key: string]: boolean}>({});
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [selectedPostForPoll, setSelectedPostForPoll] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [postImage, setPostImage] = useState<string | null>(null);
  // Neuer State für das Anzeigen/Ausblenden der Buttons
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const rotateAnimation = useState(new Animated.Value(0))[0];
  // State für verschachtelte Kommentare
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<{[key: string]: string}>({});
  const [isAnonymousReply, setIsAnonymousReply] = useState<{[key: string]: boolean}>({}); 
  const [nestedComments, setNestedComments] = useState<{[key: string]: Comment[]}>({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshNotificationBadge, setRefreshNotificationBadge] = useState<number>(0);

  // Konstanten für AsyncStorage-Keys
  const FILTER_STORAGE_KEY = 'community_filter_tags';

  // Lade Filter aus AsyncStorage
  const loadFilterFromStorage = async () => {
    try {
      const storedFilter = await AsyncStorage.getItem(FILTER_STORAGE_KEY);
      if (storedFilter) {
        const parsedFilter = JSON.parse(storedFilter);
        setSelectedFilterTagIds(parsedFilter);
      }
    } catch (error) {
      console.error('Error loading filter from storage:', error);
    }
  };

  // Speichere Filter in AsyncStorage
  const saveFilterToStorage = async (tagIds: string[]) => {
    try {
      await AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(tagIds));
    } catch (error) {
      console.error('Error saving filter to storage:', error);
    }
  };

  // Lade Beiträge und Filter beim ersten Rendern
  useEffect(() => {
    // Lade gespeicherte Filter
    loadFilterFromStorage().then(() => {
      // Lade Beiträge nach dem Laden der Filter
      loadPosts();
    });
  }, []);

  // Lade Beiträge
  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getPosts('', selectedFilterTagIds);
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Fehler', 'Beim Laden der Beiträge ist ein Fehler aufgetreten.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Lade Kommentare für einen Beitrag
  const loadComments = async (postId: string) => {
    try {
      const { data, error } = await getComments(postId);
      if (error) throw error;
      setPostComments(prev => ({
        ...prev,
        [postId]: data || []
      }));
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Fehler', 'Beim Laden der Kommentare ist ein Fehler aufgetreten.');
    }
  };

  // Lade verschachtelte Kommentare (Antworten auf Kommentare)
  const loadNestedComments = async (commentId: string) => {
    try {
      const { data, error } = await getNestedComments(commentId);
      if (error) throw error;
      setNestedComments(prev => ({
        ...prev,
        [commentId]: data || []
      }));
    } catch (error) {
      console.error('Error loading nested comments:', error);
      Alert.alert('Fehler', 'Beim Laden der Antworten ist ein Fehler aufgetreten.');
    }
  };

  // Bild für einen Beitrag auswählen
  const pickImage = async () => {
    try {
      // Berechtigungen anfordern
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Wir benötigen die Berechtigung, auf deine Fotos zuzugreifen.');
        return;
      }

      // Bild auswählen
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Reduzierte Qualität für kleinere Dateigröße
        base64: true, // Base64-Daten anfordern
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Wenn base64 nicht direkt verfügbar ist, konvertieren wir das Bild
        if (!asset.base64) {
          console.log('Base64 nicht direkt verfügbar, konvertiere Bild...');
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const reader = new FileReader();

            // Promise für FileReader erstellen
            const base64Data = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Base64-Daten direkt als photo_url verwenden
            setPostImage(base64Data as string);
            console.log('Bild erfolgreich in Base64 konvertiert');
          } catch (convError) {
            console.error('Fehler bei der Konvertierung:', convError);
            Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
          }
        } else {
          // Base64-Daten direkt verwenden
          const base64Data = `data:image/jpeg;base64,${asset.base64}`;
          setPostImage(base64Data);
          console.log('Base64-Daten direkt verwendet');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Es ist ein Fehler beim Auswählen des Bildes aufgetreten.');
    }
  };

  // Bild entfernen
  const removeImage = () => {
    setPostImage(null);
  };

  // Erstelle einen neuen Beitrag
  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Text ein.');
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await createPost(newPostContent, isAnonymousPost, 'text', undefined, selectedTagIds, postImage || undefined);
      if (error) {
        console.error('Detailed error creating post:', JSON.stringify(error));
        throw error;
      }

      // Lade Beiträge neu
      await loadPosts();
      setNewPostContent('');
      setIsAnonymousPost(false);
      setPostImage(null);
      setShowAddForm(false);
      Alert.alert('Erfolg', 'Dein Beitrag wurde erfolgreich veröffentlicht.');
    } catch (error) {
      console.error('Error creating post:', error);
      // Zeige detailliertere Fehlermeldung an
      const errorMessage = error instanceof Error ? error.message : 'Beim Erstellen des Beitrags ist ein Fehler aufgetreten.';
      Alert.alert('Fehler', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Erstelle einen neuen Kommentar
  const handleCreateComment = async (postId: string) => {
    const commentText = commentInputs[postId];
    if (!commentText || !commentText.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Text ein.');
      return;
    }

    try {
      const isAnonymous = isAnonymousComment[postId] || false;
      const { error } = await createComment(postId, commentText, isAnonymous);
      if (error) throw error;

      // Lade Kommentare neu
      await loadComments(postId);

      // Leere das Eingabefeld und setze anonym zurück
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));
      setIsAnonymousComment(prev => ({
        ...prev,
        [postId]: false
      }));
    } catch (error) {
      console.error('Error creating comment:', error);
      Alert.alert('Fehler', 'Beim Erstellen des Kommentars ist ein Fehler aufgetreten.');
    }
  };

  // Erstelle eine Antwort auf einen Kommentar
  const handleCreateReply = async (commentId: string) => {
    const replyText = replyInputs[commentId];
    if (!replyText || !replyText.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Text ein.');
      return;
    }

    try {
      const isAnonymous = isAnonymousReply[commentId] || false;
      const { error } = await createReply(commentId, replyText, isAnonymous);
      if (error) throw error;

      // Lade verschachtelte Kommentare neu
      await loadNestedComments(commentId);

      // Leere das Eingabefeld und setze anonym zurück
      setReplyInputs(prev => ({
        ...prev,
        [commentId]: ''
      }));
      setIsAnonymousReply(prev => ({
        ...prev,
        [commentId]: false
      }));
      
      // Schließe das Antwortformular
      setReplyToCommentId(null);
    } catch (error) {
      console.error('Error creating reply:', error);
      Alert.alert('Fehler', 'Beim Erstellen der Antwort ist ein Fehler aufgetreten.');
    }
  };

  // Like/Unlike einen Beitrag
  const handleTogglePostLike = async (postId: string) => {
    try {
      const { error } = await togglePostLike(postId);
      if (error) throw error;

      // Aktualisiere den Beitrag in der Liste
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post.id === postId) {
            const newLikesCount = post.has_liked ? (post.likes_count || 0) - 1 : (post.likes_count || 0) + 1;
            return {
              ...post,
              likes_count: newLikesCount,
              has_liked: !post.has_liked
            };
          }
          return post;
        })
      );
    } catch (error) {
      console.error('Error toggling post like:', error);
      Alert.alert('Fehler', 'Beim Liken des Beitrags ist ein Fehler aufgetreten.');
    }
  };

  // Like/Unlike einen Kommentar
  const handleToggleCommentLike = async (commentId: string, postId: string) => {
    try {
      const { error } = await toggleCommentLike(commentId);
      if (error) throw error;

      // Aktualisiere den Kommentar in der Liste
      setPostComments(prevComments => ({
        ...prevComments,
        [postId]: (prevComments[postId] || []).map(comment => {
          if (comment.id === commentId) {
            const newLikesCount = comment.has_liked ? (comment.likes_count || 0) - 1 : (comment.likes_count || 0) + 1;
            return {
              ...comment,
              likes_count: newLikesCount,
              has_liked: !comment.has_liked
            };
          }
          return comment;
        })
      }));
    } catch (error) {
      console.error('Error toggling comment like:', error);
      Alert.alert('Fehler', 'Beim Liken des Kommentars ist ein Fehler aufgetreten.');
    }
  };

  // Lösche einen Beitrag
  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Beitrag löschen',
      'Möchtest du diesen Beitrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deletePost(postId);
              if (error) throw error;

              // Entferne den Beitrag aus der Liste
              setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
              Alert.alert('Erfolg', 'Dein Beitrag wurde erfolgreich gelöscht.');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Fehler', 'Beim Löschen des Beitrags ist ein Fehler aufgetreten.');
            }
          }
        }
      ]
    );
  };

  // Lösche einen Kommentar
  const handleDeleteComment = async (commentId: string, postId: string) => {
    Alert.alert(
      'Kommentar löschen',
      'Möchtest du diesen Kommentar wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteComment(commentId);
              if (error) throw error;

              // Entferne den Kommentar aus der Liste
              setPostComments(prevComments => ({
                ...prevComments,
                [postId]: (prevComments[postId] || []).filter(comment => comment.id !== commentId)
              }));
              Alert.alert('Erfolg', 'Dein Kommentar wurde erfolgreich gelöscht.');
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Fehler', 'Beim Löschen des Kommentars ist ein Fehler aufgetreten.');
            }
          }
        }
      ]
    );
  };

  // Like/Unlike einen verschachtelten Kommentar
  const handleToggleNestedCommentLike = async (nestedCommentId: string, commentId: string) => {
    try {
      const { error } = await toggleNestedCommentLike(nestedCommentId);
      if (error) throw error;

      // Aktualisiere den verschachtelten Kommentar in der Liste
      setNestedComments(prevNestedComments => ({
        ...prevNestedComments,
        [commentId]: (prevNestedComments[commentId] || []).map(nestedComment => {
          if (nestedComment.id === nestedCommentId) {
            const newLikesCount = nestedComment.has_liked ? (nestedComment.likes_count || 0) - 1 : (nestedComment.likes_count || 0) + 1;
            return {
              ...nestedComment,
              likes_count: newLikesCount,
              has_liked: !nestedComment.has_liked
            };
          }
          return nestedComment;
        })
      }));
    } catch (error) {
      console.error('Error toggling nested comment like:', error);
      Alert.alert('Fehler', 'Beim Liken der Antwort ist ein Fehler aufgetreten.');
    }
  };

  // Verschachtelten Kommentar löschen
  const handleDeleteNestedComment = async (nestedCommentId: string, commentId: string) => {
    Alert.alert(
      'Antwort löschen',
      'Möchtest du diese Antwort wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteNestedComment(nestedCommentId);
              if (error) throw error;

              // Entferne den verschachtelten Kommentar aus der Liste
              setNestedComments(prevNestedComments => ({
                ...prevNestedComments,
                [commentId]: (prevNestedComments[commentId] || []).filter(
                  nestedComment => nestedComment.id !== nestedCommentId
                )
              }));
              
              Alert.alert('Erfolg', 'Deine Antwort wurde erfolgreich gelöscht.');
            } catch (error) {
              console.error('Error deleting nested comment:', error);
              Alert.alert('Fehler', 'Beim Löschen der Antwort ist ein Fehler aufgetreten.');
            }
          }
        }
      ]
    );
  };

  // Aktualisiere die Beiträge durch Pull-to-Refresh
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Lade die Beiträge mit den aktuellen Filtern
    loadPosts().finally(() => {
      setIsRefreshing(false);
    });
  }, []);

  // Lade Umfragen für einen Beitrag
  const loadPolls = async (postId: string) => {
    try {
      const { data, error } = await getPollsByPostId(postId);
      if (error) throw error;
      setPostPolls(prev => ({
        ...prev,
        [postId]: data || []
      }));
    } catch (error) {
      console.error('Error loading polls:', error);
      Alert.alert('Fehler', 'Beim Laden der Umfragen ist ein Fehler aufgetreten.');
    }
  };

  // Umfrage erstellen - funktionalität entfernt
  const handleCreatePoll = () => {
    // Funktionalität entfernt
  };

  // Nach Erstellung einer Umfrage
  const handlePollCreated = () => {
    setShowPollForm(false);
    setSelectedPostForPoll(null);
    if (expandedPostId) {
      loadPolls(expandedPostId);
    }
  };

  // Erweitere oder reduziere einen Beitrag
  const togglePostExpansion = (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      // Lade Kommentare und Umfragen, wenn der Beitrag erweitert wird
      if (!postComments[postId]) {
        loadComments(postId);
      }
      if (!postPolls[postId]) {
        loadPolls(postId);
      }
    }
  };

  // Filtere Beiträge basierend auf der Suchanfrage
  const filteredPosts = posts.filter(post =>
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (post.user_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Formatiere das Datum für die Anzeige
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Heute';
    } else if (diffInDays === 1) {
      return 'Gestern';
    } else if (diffInDays < 7) {
      return `Vor ${diffInDays} Tagen`;
    } else {
      return date.toLocaleDateString('de-DE');
    }
  };

  // Rendere einen Beitrag
  const renderPostItem = ({ item }: { item: Post }) => {
    const isExpanded = expandedPostId === item.id;
    const comments = postComments[item.id] || [];
    const isOwnPost = user?.id === item.user_id;

    // Debug logging für Bilder
    if (item.image_url) {
      console.log(`Post ${item.id} has image_url: ${item.image_url}`);
    }

    return (
      <ThemedView
        style={styles.postItem}
        lightColor={theme.card}
        darkColor={theme.card}
      >
        <TouchableOpacity
          style={styles.postHeader}
          onPress={() => togglePostExpansion(item.id)}
        >
          <View style={styles.userInfo}>
            <View style={[
              styles.userRoleIndicator,
              { backgroundColor: item.user_role === 'mama' ? '#FF9F9F' : item.user_role === 'papa' ? '#9FD8FF' : '#D9D9D9' }
            ]} />
            <ThemedText style={styles.userName}>
              {item.user_name || 'Anonym'}
            </ThemedText>
            {__DEV__ && (
              <ThemedText style={styles.debugText}>
                [Debug: user_id: {item.user_id?.substring(0, 8)}... anonym: {String(item.is_anonymous)}]
              </ThemedText>
            )}
            <ThemedText style={styles.postDate}>{formatDate(item.created_at)}</ThemedText>
            
            {!isOwnPost && !item.is_anonymous && (
              <FollowButton 
                userId={item.user_id} 
                size="small" 
                showText={false} 
                style={styles.followButton}
              />
            )}
          </View>

          {isOwnPost && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePost(item.id)}
            >
              <IconSymbol name="trash" size={18} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => togglePostExpansion(item.id)}
          style={styles.contentTouchable}
        >
          <ThemedView
            lightColor="#FAFAFA"
            darkColor={theme.cardDark}
          >
            <ThemedText style={styles.postContent}>{item.content}</ThemedText>

            {/* Bild anzeigen, falls vorhanden */}
            {item.image_url && item.image_url.length > 0 && (
              <View style={styles.postImageContainer}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.postImage}
                  resizeMode="cover"
                  onError={(e) => console.error('Image load error:', e.nativeEvent.error)}
                  onLoad={() => console.log(`Image loaded successfully for post ${item.id}`)}
                />
              </View>
            )}

            {/* Tags anzeigen */}
            {item.tags && item.tags.length > 0 && (
              <TagDisplay tags={item.tags} small={true} onTagPress={async (tagId) => {
                const newFilter = [tagId];
                setSelectedFilterTagIds(newFilter);
                await saveFilterToStorage(newFilter);
                loadPosts();
              }} />
            )}

            <ThemedText style={styles.tapHint}>Tippen zum {isExpanded ? 'Schließen' : 'Öffnen'}</ThemedText>
          </ThemedView>
        </TouchableOpacity>

        <View style={[
          styles.postActions,
          { borderTopColor: colorScheme === 'dark' ? theme.border : '#EFEFEF' }
        ]}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleTogglePostLike(item.id)}
          >
            <IconSymbol
              name={item.has_liked ? "heart.fill" : "heart"}
              size={20}
              color={item.has_liked ? "#FF6B6B" : theme.tabIconDefault}
            />
            <ThemedText style={styles.actionText}>{item.likes_count || 0}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => togglePostExpansion(item.id)}
          >
            <IconSymbol name="bubble.right" size={20} color={theme.tabIconDefault} />
            <ThemedText style={styles.actionText}>{item.comments_count || 0}</ThemedText>
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Umfragen anzeigen, wenn vorhanden */}
            {postPolls[item.id] && postPolls[item.id].length > 0 && (
              <View style={styles.pollsContainer}>
                {postPolls[item.id].map(poll => (
                  <PollComponent
                    key={poll.id}
                    pollId={poll.id}
                    onVoteChange={() => loadPolls(item.id)}
                  />
                ))}
              </View>
            )}

            {/* Kommentare anzeigen */}
            {comments.length > 0 && (
              <View style={[
                styles.commentsContainer,
                { borderTopColor: colorScheme === 'dark' ? theme.border : '#EFEFEF' }
              ]}>
                <ThemedText style={styles.commentsTitle}>Antworten:</ThemedText>
                {comments.map(comment => {
                  const isOwnComment = user?.id === comment.user_id;
                  return (
                    <ThemedView key={comment.id} style={styles.commentItem} lightColor="#F9F9F9" darkColor={theme.cardDark}>
                      <View style={styles.commentHeader}>
                        <View style={styles.userInfo}>
                          <View style={[
                            styles.userRoleIndicator,
                            { backgroundColor: comment.user_role === 'mama' ? '#FF9F9F' : comment.user_role === 'papa' ? '#9FD8FF' : '#D9D9D9' }
                          ]} />
                          <ThemedText style={styles.userName}>
                            {comment.user_name || 'Anonym'}
                          </ThemedText>
                          {__DEV__ && (
                            <ThemedText style={styles.debugText}>
                              [Debug: user_id: {comment.user_id?.substring(0, 8)}... anonym: {String(comment.is_anonymous)}]
                            </ThemedText>
                          )}
                          <ThemedText style={styles.commentDate}>{formatDate(comment.created_at)}</ThemedText>
                          
                          {user?.id !== comment.user_id && !comment.is_anonymous && (
                            <FollowButton 
                              userId={comment.user_id} 
                              size="small" 
                              showText={false} 
                              style={styles.followButton}
                            />
                          )}
                        </View>

                        {isOwnComment && (
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeleteComment(comment.id, item.id)}
                          >
                            <IconSymbol name="trash" size={16} color="#FF6B6B" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <ThemedText style={styles.commentContent}>{comment.content}</ThemedText>
                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleToggleCommentLike(comment.id, item.id)}
                        >
                          <IconSymbol
                            name={comment.has_liked ? "heart.fill" : "heart"}
                            size={16}
                            color={comment.has_liked ? "#FF6B6B" : theme.tabIconDefault}
                          />
                          <ThemedText style={styles.actionText}>{comment.likes_count || 0}</ThemedText>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => {
                            setReplyToCommentId(comment.id);
                            // Lade verschachtelte Kommentare, wenn noch nicht geladen
                            if (!nestedComments[comment.id]) {
                              loadNestedComments(comment.id);
                            }
                          }}
                        >
                          <IconSymbol name="arrowshape.turn.up.left" size={16} color={theme.tabIconDefault} />
                          <ThemedText style={styles.actionText}>Antworten</ThemedText>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Verschachtelte Kommentare anzeigen */}
                      {nestedComments[comment.id] && nestedComments[comment.id].length > 0 && (
                        <View style={styles.nestedCommentsContainer}>
                          <ThemedText style={styles.nestedCommentsTitle}>Antworten:</ThemedText>
                          {nestedComments[comment.id].map(nestedComment => (
                            <ThemedView 
                              key={nestedComment.id} 
                              style={styles.nestedCommentItem} 
                              lightColor="#F0F0F0" 
                              darkColor={colorScheme === 'dark' ? '#1F2937' : undefined}
                            >
                              <View style={styles.commentHeader}>
                                <View style={styles.userInfo}>
                                  <View style={[
                                    styles.userRoleIndicator,
                                    { backgroundColor: nestedComment.user_role === 'mama' ? '#FF9F9F' : nestedComment.user_role === 'papa' ? '#9FD8FF' : '#D9D9D9' }
                                  ]} />
                                  <ThemedText style={styles.userName}>
                                    {nestedComment.user_name || 'Anonym'}
                                  </ThemedText>
                                  <ThemedText style={styles.commentDate}>{formatDate(nestedComment.created_at)}</ThemedText>
                                </View>
                                
                                {user?.id === nestedComment.user_id && (
                                  <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteNestedComment(nestedComment.id, comment.id)}
                                  >
                                    <IconSymbol name="trash" size={16} color="#FF6B6B" />
                                  </TouchableOpacity>
                                )}
                              </View>
                              <ThemedText style={styles.commentContent}>{nestedComment.content}</ThemedText>
                              <View style={styles.commentActions}>
                                <TouchableOpacity
                                  style={styles.actionButton}
                                  onPress={() => handleToggleNestedCommentLike(nestedComment.id, comment.id)}
                                >
                                  <IconSymbol
                                    name={nestedComment.has_liked ? "heart.fill" : "heart"}
                                    size={16}
                                    color={nestedComment.has_liked ? "#FF6B6B" : theme.tabIconDefault}
                                  />
                                  <ThemedText style={styles.actionText}>{nestedComment.likes_count || 0}</ThemedText>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                  style={styles.actionButton}
                                  onPress={() => {
                                    setReplyToCommentId(comment.id);
                                    // Lade verschachtelte Kommentare, wenn noch nicht geladen
                                    if (!nestedComments[comment.id]) {
                                      loadNestedComments(comment.id);
                                    }
                                  }}
                                >
                                  <IconSymbol name="arrowshape.turn.up.left" size={16} color={theme.tabIconDefault} />
                                  <ThemedText style={styles.actionText}>Antworten</ThemedText>
                                </TouchableOpacity>
                              </View>
                            </ThemedView>
                          ))}
                        </View>
                      )}
                      
                      {/* Antwortformular */}
                      {replyToCommentId === comment.id && (
                        <View style={styles.replyContainer}>
                          <TextInput
                            style={[
                              styles.replyInput,
                              {
                                color: theme.text,
                                backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#F0F0F0'
                              }
                            ]}
                            placeholder="Schreibe eine Antwort..."
                            placeholderTextColor={theme.tabIconDefault}
                            value={replyInputs[comment.id] || ''}
                            onChangeText={(text) => setReplyInputs(prev => ({ ...prev, [comment.id]: text }))}
                          />
                          <View style={styles.replyActions}>
                            <TouchableOpacity
                              style={styles.anonymousReplyOption}
                              onPress={() => setIsAnonymousReply(prev => ({ ...prev, [comment.id]: !(prev[comment.id] || false) }))}
                            >
                              <View style={[
                                styles.checkbox,
                                (isAnonymousReply[comment.id] || false) && styles.checkboxChecked,
                                !(isAnonymousReply[comment.id] || false) && { backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#F0F0F0' }
                              ]}>
                                {(isAnonymousReply[comment.id] || false) && <IconSymbol name="checkmark" size={12} color="#FFFFFF" />}
                              </View>
                              <ThemedText style={styles.checkboxLabelSmall}>Anonym</ThemedText>
                            </TouchableOpacity>
                            
                            <View style={styles.replyButtonsContainer}>
                              <TouchableOpacity
                                style={styles.cancelReplyButton}
                                onPress={() => setReplyToCommentId(null)}
                              >
                                <ThemedText style={styles.cancelReplyText}>Abbrechen</ThemedText>
                              </TouchableOpacity>
                              
                              <TouchableOpacity
                                style={[styles.sendReplyButton, { backgroundColor: theme.accent }]}
                                onPress={() => handleCreateReply(comment.id)}
                              >
                                <ThemedText style={styles.sendReplyText}>Antworten</ThemedText>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}
                    </ThemedView>
                  );
                })}
              </View>
            )}

            {/* Kommentar hinzufügen */}
            <View>
              <View style={[
                styles.addCommentContainer,
                { borderTopColor: colorScheme === 'dark' ? theme.border : '#EFEFEF' }
              ]}>
                <TextInput
                  style={[
                    styles.addCommentInput,
                    {
                      color: theme.text,
                      backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#F5F5F5'
                    }
                  ]}
                  placeholder="Schreibe einen Kommentar..."
                  placeholderTextColor={theme.tabIconDefault}
                  value={commentInputs[item.id] || ''}
                  onChangeText={(text) => setCommentInputs(prev => ({ ...prev, [item.id]: text }))}
                />
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={() => handleCreateComment(item.id)}
                >
                  <IconSymbol name="paperplane.fill" size={20} color={theme.accent} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.anonymousCommentOption}
                onPress={() => setIsAnonymousComment(prev => ({ ...prev, [item.id]: !(prev[item.id] || false) }))}
              >
                <View style={[
                  styles.checkbox,
                  (isAnonymousComment[item.id] || false) && styles.checkboxChecked,
                  !(isAnonymousComment[item.id] || false) && { backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#F5F5F5' }
                ]}>
                  {(isAnonymousComment[item.id] || false) && <IconSymbol name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <ThemedText style={styles.checkboxLabelSmall}>Anonym</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ThemedView>
    );
  };

  // Funktion zum Ausblenden der Tastatur
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Funktion zum Aktualisieren des Notification Badges
  const handleNotificationUpdate = () => {
    setRefreshNotificationBadge(prev => prev + 1);
  };

  // Update in toggleFloatingButtons function
  const toggleFloatingButtons = (show: boolean) => {
    // Start animation
    Animated.timing(rotateAnimation, {
      toValue: show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Show/hide buttons
    setShowFloatingButtons(show);
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <ThemedBackground style={styles.backgroundImage}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <SafeAreaView style={styles.container}>
            <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            
            <View style={styles.overlayContainer}>
              <Header 
                title="Community" 
                subtitle="Teile und entdecke Erfahrungen" 
              />
              
              <TouchableOpacity 
                style={styles.bellButton}
                onPress={() => router.push('/notifications' as any)}
              >
                <IconSymbol 
                  name="bell.fill" 
                  size={24} 
                  color={theme.tabIconDefault} 
                />
                <NotificationBadge refreshTrigger={refreshNotificationBadge} />
              </TouchableOpacity>
            </View>

            {/* Benachrichtigungen */}
            {showNotifications ? (
              <ThemedView style={styles.notificationsContainer} lightColor={theme.card} darkColor={theme.card}>
                <View style={styles.notificationsHeader}>
                  <ThemedText style={styles.notificationsTitle}>Benachrichtigungen</ThemedText>
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => {
                      // Schließe Dropdown und navigiere zur vollen Notifications-Seite
                      setShowNotifications(false);
                      const notificationsRoute = '/notifications';
                      if (router.canGoBack()) {
                        router.push(notificationsRoute as any);
                      } else {
                        router.replace(notificationsRoute as any);
                      }
                    }}
                  >
                    <ThemedText style={[styles.viewAllText, { color: theme.accent }]}>
                      Alle ansehen
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                <NotificationsList onNotificationUpdate={handleNotificationUpdate} />
              </ThemedView>
            ) : (
              <>
                {/* Formular zum Erstellen einer Umfrage */}
                {showPollForm && selectedPostForPoll && (
                  <CreatePollForm
                    postId={selectedPostForPoll}
                    onPollCreated={handlePollCreated}
                    onCancel={() => {
                      setShowPollForm(false);
                      setSelectedPostForPoll(null);
                    }}
                  />
                )}

                {showAddPollForm ? (
                  // Formular zum Erstellen einer Umfrage
                  <CreatePollPost
                    onPollCreated={() => {
                      setShowAddPollForm(false);
                      loadPosts();
                    }}
                    onCancel={() => setShowAddPollForm(false)}
                  />
                ) : showAddForm ? (
                  // Formular zum Erstellen eines neuen Beitrags
                  <ThemedView style={styles.addFormContainer} lightColor={theme.card} darkColor={theme.card}>
                    <View style={styles.formHeader}>
                      <ThemedText style={styles.formTitle}>Neue Frage stellen</ThemedText>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          style={{ marginRight: 12 }}
                          onPress={dismissKeyboard}
                        >
                          <IconSymbol name="keyboard.chevron.compact.down" size={24} color={theme.tabIconDefault} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowAddForm(false)}>
                          <IconSymbol name="xmark.circle.fill" size={24} color={theme.tabIconDefault} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TextInput
                      style={[
                        styles.postInput,
                        {
                          color: theme.text,
                          backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#F5F5F5'
                        }
                      ]}
                      placeholder="Was möchtest du fragen?"
                      placeholderTextColor={theme.tabIconDefault}
                      value={newPostContent}
                      onChangeText={setNewPostContent}
                      multiline
                      numberOfLines={5}
                    />

                    {/* Bild-Upload-Bereich */}
                    {postImage ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: postImage }} style={styles.imagePreview} />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={removeImage}
                        >
                          <IconSymbol name="xmark.circle.fill" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.imageUploadButton}
                        onPress={pickImage}
                      >
                        <IconSymbol name="photo" size={20} color={theme.accent} />
                        <ThemedText style={styles.imageUploadText}>Bild hinzufügen</ThemedText>
                      </TouchableOpacity>
                    )}

                    {/* Tag-Auswahl */}
                    <TagSelector
                      selectedTagIds={selectedTagIds}
                      onTagsChange={setSelectedTagIds}
                    />

                    <View style={styles.anonymousOption}>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => setIsAnonymousPost(!isAnonymousPost)}
                      >
                        <View style={[
                          styles.checkbox,
                          isAnonymousPost && styles.checkboxChecked,
                          !isAnonymousPost && { backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#F5F5F5' }
                        ]}>
                          {isAnonymousPost && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
                        </View>
                        <ThemedText style={styles.checkboxLabel}>Anonym</ThemedText>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: theme.accent }]}
                      onPress={handleCreatePost}
                      disabled={isLoading}
                    >
                      <ThemedText style={styles.addButtonText}>
                        {isLoading ? 'Wird veröffentlicht...' : 'Frage veröffentlichen'}
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  // Liste der Beiträge
                  <>
                    <View style={styles.searchContainer}>
                      <ThemedView
                        style={styles.searchInputContainer}
                        lightColor="#FFFFFF"
                        darkColor={theme.cardDark}
                      >
                        <IconSymbol name="magnifyingglass" size={20} color={theme.tabIconDefault} />
                        <TextInput
                          style={[styles.searchInput, { color: theme.text }]}
                          placeholder="Suche in der Community..."
                          placeholderTextColor={theme.tabIconDefault}
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <IconSymbol name="xmark.circle.fill" size={20} color={theme.tabIconDefault} />
                          </TouchableOpacity>
                        )}
                      </ThemedView>
                    </View>

                    {/* Tag-Filter */}
                    <TagFilter
                      selectedTagIds={selectedFilterTagIds}
                      onTagsChange={async (tagIds) => {
                        // Setze den Filter und speichere ihn
                        setSelectedFilterTagIds(tagIds);
                        // Speichere den Filter in AsyncStorage
                        await saveFilterToStorage(tagIds);
                        // Lade die Beiträge neu
                        loadPosts();
                      }}
                    />

                    {isLoading && !isRefreshing ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.accent} />
                        <ThemedText style={styles.loadingText}>Beiträge werden geladen...</ThemedText>
                      </View>
                    ) : (
                      <FlatList
                        data={filteredPosts}
                        renderItem={renderPostItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.postsList}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                          <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            colors={[theme.accent]}
                            tintColor={theme.accent}
                          />
                        }
                        ListEmptyComponent={
                          <ThemedView style={styles.emptyState} lightColor={theme.card} darkColor={theme.card}>
                            <IconSymbol name="bubble.left.and.bubble.right" size={40} color={theme.tabIconDefault} />
                            <ThemedText style={styles.emptyStateText}>
                              {searchQuery ? 'Keine Beiträge gefunden' : 'Noch keine Beiträge'}
                            </ThemedText>
                            <ThemedText style={styles.emptyStateSubtext}>
                              {searchQuery ? 'Ändere deine Suchanfrage oder stelle eine neue Frage' : 'Stelle die erste Frage in der Community'}
                            </ThemedText>
                          </ThemedView>
                        }
                      />
                    )}

                    <View style={styles.floatingButtonsContainer}>
                      {showFloatingButtons ? (
                        <>
                          <TouchableOpacity
                            style={[styles.floatingAddButton, { backgroundColor: theme.accent }]}
                            onPress={() => {
                              setShowAddForm(true);
                              toggleFloatingButtons(false);
                            }}
                          >
                            <IconSymbol name="text.bubble" size={20} color="#FFFFFF" />
                            <ThemedText style={styles.floatingButtonText}>Frage</ThemedText>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.floatingPollButton, { backgroundColor: '#FF9F9F' }]}
                            onPress={() => {
                              setShowAddPollForm(true);
                              toggleFloatingButtons(false);
                            }}
                          >
                            <IconSymbol name="chart.bar" size={20} color="#FFFFFF" />
                            <ThemedText style={styles.floatingButtonText}>Umfrage</ThemedText>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.floatingProfileButton, { backgroundColor: '#9775FA' }]}
                            onPress={() => {
                              router.push('/community-profile' as any);
                              toggleFloatingButtons(false);
                            }}
                          >
                            <IconSymbol name="person.fill" size={20} color="#FFFFFF" />
                            <ThemedText style={styles.floatingButtonText}>Profil</ThemedText>
                          </TouchableOpacity>
                        </>
                      ) : null}
                      
                      <TouchableOpacity
                        style={[styles.floatingMainButton, { backgroundColor: Colors[colorScheme].tint }]}
                        onPress={() => toggleFloatingButtons(!showFloatingButtons)}
                      >
                        <Animated.View 
                          style={{ 
                            transform: [{ 
                              rotate: rotateAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '45deg']
                              }) 
                            }] 
                          }}
                        >
                          <IconSymbol name="plus" size={24} color="#FFFFFF" />
                        </Animated.View>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ThemedBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    paddingHorizontal: 16,
  },
  overlayContainer: {
    width: '100%',
    position: 'relative',
  },
  bellButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  notificationsContainer: {
    flex: 1,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllButton: {
    padding: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'center', // Zentriert den Inhalt horizontal
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  searchContainer: {
    marginVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  postsList: {
    paddingBottom: 80,
  },
  postItem: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userRoleIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  postDate: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  postContent: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#888',
  },
  commentsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  commentItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentDate: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  addCommentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
  floatingAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  addFormContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  postInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
  anonymousOption: {
    marginBottom: 16,
  },
  anonymousCommentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 4,
    marginBottom: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#E57373',
    borderColor: '#E57373',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#888',
  },
  checkboxLabelSmall: {
    fontSize: 12,
    color: '#888',
  },
  debugText: {
    fontSize: 10,
    color: '#888',
    marginLeft: 4,
  },
  pollsContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  pollButtonContainer: {
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  createPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  createPollButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#888',
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 90, // Exakt gleiche Höhe wie Alltag-Tab
    right: 20,
    flexDirection: 'column',
    alignItems: 'flex-end',
    zIndex: 100,
  },
  // Styles für Bild-Upload
  imagePreviewContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 4,
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderStyle: 'dashed',
  },
  imageUploadText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#888',
  },
  postImageContainer: {
    marginVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  floatingPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  floatingMainButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 12, // Some space above the main button when other buttons are shown
  },
  pollPostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
  },
  pollIcon: {
    marginRight: 8,
  },
  pollPostContent: {
    flex: 1,
    fontWeight: '500',
  },
  contentTouchable: {
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    backgroundColor: '#FAFAFA',
  },
  tapHint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    marginTop: 4,
    fontStyle: 'italic',
  },
  expandedContent: {
    marginTop: 12,
  },
  replyContainer: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    fontSize: 14,
    minHeight: 40,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  anonymousReplyOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelReplyButton: {
    padding: 8,
    marginRight: 8,
    paddingHorizontal: 6,
  },
  cancelReplyText: {
    color: '#888',
    fontSize: 12,
  },
  sendReplyButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  sendReplyText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  nestedCommentsContainer: {
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#EFEFEF',
  },
  nestedCommentsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 8,
  },
  nestedCommentItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  followButton: {
    marginLeft: 8,
  },
  floatingProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
