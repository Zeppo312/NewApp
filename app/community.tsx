import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { BlogPost, createBlogPost, getBlogPosts, updateBlogPost, uploadBlogCover, deleteBlogPost } from '@/lib/blog';
import { supabase } from '@/lib/supabase';

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const displayNameForProfile = (profile?: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}) => {
  const firstName = profile?.first_name?.trim();
  const lastName = profile?.last_name?.trim();
  const username = profile?.username?.trim();

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }

  if (username) {
    return username;
  }

  return 'Lotti Baby Team';
};

const mapSupabaseError = (error: any) => {
  if (!error) {
    return 'Beim Speichern ist ein Fehler aufgetreten.';
  }

  const message = typeof error?.message === 'string' ? error.message : '';
  const code = error?.code;

  if (code === '42501' || message.toLowerCase().includes('row-level security')) {
    return 'Du brauchst Admin-Rechte (profiles.is_admin = true), um Beiträge zu speichern. Bitte neu anmelden oder Admin-Flag setzen.';
  }

  if (code === '23503' || message.toLowerCase().includes('foreign key')) {
    return 'Dein Profil wurde nicht gefunden. Bitte erneut anmelden, damit dein Profil geladen wird.';
  }

  if (message.toLowerCase().includes('jwt') || message.toLowerCase().includes('token')) {
    return 'Session abgelaufen. Bitte melde dich erneut an.';
  }

  return message || 'Beim Speichern ist ein Fehler aufgetreten.';
};

export default function CommunityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const adaptiveColors = useAdaptiveColors();
  const isDarkMode = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  const statusBarStyle = isDarkMode ? 'light-content' : 'dark-content';
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerTextColor = '#7D5A50';
  const primaryTextOnCommunity = isDarkMode ? theme.textPrimary : headerTextColor;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [coverIsLocal, setCoverIsLocal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('Lotti Baby Team');
  const [showDraftList, setShowDraftList] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const openModal = useCallback((publish: boolean, draft?: BlogPost) => {
    setErrorMessage('');
    setCoverIsLocal(false);
    setCoverImageUri(draft?.cover_image_url ?? null);
    setIsPublished(draft?.is_published ?? publish);
    setNewTitle(draft?.title ?? '');
    setNewSummary(draft?.summary ?? '');
    setNewContent(draft?.content ?? '');
    setEditingPostId(draft?.id ?? null);
    setShowCreateModal(true);
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await getBlogPosts();
    if (error) {
      console.error('Fehler beim Laden der Blogeinträge:', error);
    } else {
      setPosts(data);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setIsAdmin(false);
      setCurrentUserName('Lotti Baby Team');
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, username, is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Fehler beim Laden des Profils:', error);
      return;
    }

    setCurrentUserName(displayNameForProfile(profile ?? undefined));
    setIsAdmin(profile?.is_admin === true);
  }, [user?.id]);

  useEffect(() => {
    setIsLoading(true);
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPosts();
  }, [loadPosts]);

  const pickCoverImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrorMessage('Bitte erlaube den Zugriff auf deine Fotos, um ein Titelbild auszuwählen.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.length) {
      setCoverImageUri(result.assets[0].uri);
      setCoverIsLocal(true);
      setErrorMessage('');
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!user?.id) {
      setErrorMessage('Bitte erneut anmelden.');
      return;
    }

    if (!newTitle.trim() || !newContent.trim()) {
      setErrorMessage('Titel und Inhalt dürfen nicht leer sein.');
      return;
    }

    setIsCreating(true);
    setErrorMessage('');

    let uploadedCoverUrl: string | null = coverImageUri;
    if (coverImageUri && coverIsLocal) {
      const { data: url, error } = await uploadBlogCover(coverImageUri, user.id);
      if (error) {
        console.error('Cover konnte nicht hochgeladen werden:', error);
        setErrorMessage(mapSupabaseError(error));
        setIsCreating(false);
        return;
      }
      uploadedCoverUrl = url;
    }

    const payload = {
      authorId: user.id,
      title: newTitle,
      content: newContent,
      summary: newSummary,
      coverImageUrl: uploadedCoverUrl ?? null,
      isPublished,
    };

    const { authorId, ...postData } = payload;

    const { error } = editingPostId
      ? await updateBlogPost(editingPostId, {
          ...postData,
          publishedAt: isPublished ? new Date().toISOString() : null,
        })
      : await createBlogPost(payload);

    setIsCreating(false);

    if (error) {
      console.error('Blogeintrag konnte nicht gespeichert werden:', error);
      setErrorMessage(mapSupabaseError(error));
      return;
    }

    setShowCreateModal(false);
    setNewTitle('');
    setNewContent('');
    setNewSummary('');
    setCoverImageUri(null);
    setCoverIsLocal(false);
    setIsPublished(true);
    setEditingPostId(null);
    setExpandedPostId(null);
    setIsLoading(true);
    loadPosts();
  }, [coverImageUri, coverIsLocal, editingPostId, isPublished, loadPosts, newContent, newSummary, newTitle, user?.id]);

  const drafts = useMemo(() => posts.filter((p) => !p.is_published), [posts]);
  const published = useMemo(() => posts.filter((p) => p.is_published), [posts]);

  const renderPost = useCallback(
    ({ item }: { item: BlogPost }) => {
      const isExpanded = expandedPostId === item.id;
      const previewText = isExpanded ? item.content : item.summary ?? item.content;
      const canToggle = item.content.length > (item.summary?.length ?? 0) + 40;
      const handleDelete = async () => {
        Alert.alert('Eintrag löschen', 'Möchtest du diesen Eintrag wirklich löschen?', [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: async () => {
              const { error } = await deleteBlogPost(item.id);
              if (error) {
                console.error('Konnte Blogeintrag nicht löschen:', error);
                setErrorMessage(mapSupabaseError(error));
                return;
              }
              setPosts((prev) => prev.filter((p) => p.id !== item.id));
            },
          },
        ]);
      };
      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDarkMode ? theme.cardDark : '#FFF5EE',
              borderColor: theme.border,
            },
          ]}
        >
          {isAdmin ? (
            <View style={styles.adminOverlay}>
              <TouchableOpacity style={[styles.adminOverlayButton, { backgroundColor: '#FFFFFF' }]} onPress={() => openModal(!item.is_published, item)}>
                <IconSymbol name="pencil" size={14} color={primaryTextOnCommunity} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.adminOverlayButton, { backgroundColor: '#C25B5B' }]} onPress={handleDelete}>
                <IconSymbol name="trash" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
          {item.cover_image_url ? (
            <View style={[styles.coverWrapper, { height: isExpanded ? 260 : 180 }]}>
              <Image
                source={{ uri: item.cover_image_url }}
                style={styles.coverImage}
                resizeMode={isExpanded ? 'contain' : 'cover'}
              />
              {!item.is_published && (
                <View style={styles.draftBadge}>
                  <ThemedText style={styles.draftBadgeText}>Entwurf</ThemedText>
                </View>
              )}
            </View>
          ) : null}
          <View style={styles.cardBodyBlock}>
            <View style={styles.cardHeaderRow}>
              <ThemedText type="subtitle" style={[styles.cardTitle, { color: primaryTextOnCommunity }]}>
                {item.title}
              </ThemedText>
              <View style={[styles.metaPill, { backgroundColor: isDarkMode ? '#3D3330' : '#FFE2CF' }]}>
                <IconSymbol name="doc.text.fill" size={14} color={primaryTextOnCommunity} />
                <ThemedText style={[styles.metaPillText, { color: primaryTextOnCommunity }]}>{formatDate(item.published_at)}</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.metaText, { color: theme.textTertiary }]}>von {item.authorName}</ThemedText>
            <ThemedText style={[styles.cardBodyText, { color: theme.textSecondary }]}>{previewText}</ThemedText>
            {canToggle && (
              <TouchableOpacity
                style={styles.readMoreButton}
                onPress={() => setExpandedPostId(isExpanded ? null : item.id)}
              >
                <ThemedText style={[styles.readMoreText, { color: theme.tint }]}>
                  {isExpanded ? 'Weniger anzeigen' : 'Weiterlesen'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [expandedPostId, isDarkMode, primaryTextOnCommunity, theme.border, theme.cardDark, theme.textSecondary, theme.textTertiary, theme.tint],
  );

  const renderEmptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <ThemedText style={[styles.emptyTitle, { color: primaryTextOnCommunity }]}>Hier wächst gerade etwas Neues...</ThemedText>
        <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>Die Redaktion bereitet aktuell neue Inhalte vor. Schau später noch einmal rein.</ThemedText>
      </View>
    ),
    [primaryTextOnCommunity, theme.textSecondary],
  );

  const openInstagram = () => {
    Linking.openURL('https://www.instagram.com/anyhelptoolate?igsh=MXRkb3VpcGRrNjJ1cA==');
  };

  const hero = (
    <View style={[styles.hero, { backgroundColor: isDarkMode ? '#3A2E2A' : '#FFE7D6' }]}>
      <TouchableOpacity style={styles.heroImageContainer} onPress={openInstagram} activeOpacity={0.8}>
        <Image source={require('@/assets/images/LottiPic.png')} style={styles.heroImage} />
      </TouchableOpacity>
      <View style={styles.heroBubbleTwo} />
      <View style={styles.heroTextBlock}>
        <ThemedText type="title" style={[styles.heroTitle, { color: primaryTextOnCommunity }]}>Lotti Baby Blog</ThemedText>
        <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>Sanfte Stories, Tipps von Hebammen und echte Erfahrungen aus der Community – alles an einem Ort.</ThemedText>
        <View style={styles.heroChips}>
          <View style={[styles.heroChip, { backgroundColor: '#FFD8C2' }]}>
            <IconSymbol name="heart.fill" size={14} color="#7D5A50" />
            <ThemedText style={[styles.heroChipText, { color: primaryTextOnCommunity }]}>Warm & liebevoll</ThemedText>
          </View>
          <View style={[styles.heroChip, { backgroundColor: '#E7F2ED' }]}>
            <IconSymbol name="star.fill" size={14} color="#7D5A50" />
            <ThemedText style={[styles.heroChipText, { color: primaryTextOnCommunity }]}>Expertinnen geprüft</ThemedText>
          </View>
        </View>
      </View>
      {isAdmin ? (
        <View style={styles.heroStats}>
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#2F2522' : '#FFFFFF', borderColor: theme.border }]}>
            <ThemedText style={[styles.statNumber, { color: primaryTextOnCommunity }]}>{published.length}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>veröffentlichte Artikel</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#2F2522' : '#FFFFFF', borderColor: theme.border }]}>
            <ThemedText style={[styles.statNumber, { color: primaryTextOnCommunity }]}>{drafts.length}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>in Vorbereitung</ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );

  const adminPanel = isAdmin ? (
    <View style={[styles.adminPanel, { backgroundColor: isDarkMode ? '#2E2522' : '#FFF4EA', borderColor: theme.border }]}>
      <View style={styles.adminHeaderRow}>
        <View style={styles.adminBadgeRow}>
          <View style={styles.adminBadge}>
            <IconSymbol name="star.fill" size={14} color="#fff" />
            <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
          </View>
          <ThemedText style={[styles.adminTitle, { color: primaryTextOnCommunity }]}>Redaktionsbereich</ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.adminSubtitle, { color: theme.textSecondary }]}>Veröffentliche einen neuen Artikel oder speichere ihn als Entwurf, um später weiterzuschreiben.</ThemedText>
      {drafts.length > 0 ? (
        <View style={styles.draftRow}>
          {drafts.slice(0, 3).map((draft) => (
            <View key={draft.id} style={[styles.draftCard, { borderColor: theme.border }]}> 
              <ThemedText style={[styles.draftTitle, { color: primaryTextOnCommunity }]} numberOfLines={1}>{draft.title}</ThemedText>
              <ThemedText style={[styles.draftMeta, { color: theme.textTertiary }]}>{formatDate(draft.updated_at)}</ThemedText>
            </View>
          ))}
        </View>
      ) : (
        <ThemedText style={[styles.noDraftsText, { color: theme.textSecondary }]}>Keine Entwürfe – bereit für etwas Neues?</ThemedText>
      )}
    </View>
  ) : null;

  const listHeader = (
    <View style={styles.listHeader}>
      <Header
        title="Lotti Baby Blog"
        subtitle="Begleiter durch Schwangerschaft und erstes Jahr"
        showBackButton
        onBackPress={() => router.push('/(tabs)/home')}
      />
      {hero}
      {adminPanel}
      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: primaryTextOnCommunity }]}>Aktuelle Artikel</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Frisch für dich zusammengestellt</ThemedText>
      </View>
    </View>
  );

  return (
    <ThemedBackground style={styles.bgImage}>
      <ThemedView style={styles.screen}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={theme.background} />
        <SafeAreaView style={styles.safeArea}>
          {isLoading && posts.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.tint} />
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderPost}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 140 + insets.bottom },
                posts.length === 0 && styles.listEmptyPadding,
              ]}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.tint} />}
              ListEmptyComponent={!isLoading ? renderEmptyState : null}
              ListHeaderComponent={listHeader}
            />
          )}

          {isAdmin ? (
            <View
              style={[
                styles.fabContainer,
                {
                  bottom: Math.max(32, insets.bottom + 72),
                  zIndex: 50,
                },
              ]}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                style={[styles.fab, styles.fabGhost, { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : theme.border }]}
                onPress={() => setShowDraftList(true)}
              >
                <IconSymbol name="tray.full.fill" size={16} color={primaryTextOnCommunity} />
                <ThemedText style={[styles.fabLabelSecondary, { color: primaryTextOnCommunity }]}>Entwürfe ({drafts.length})</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fab, styles.fabSecondary]} onPress={() => openModal(false)}>
                <IconSymbol name="plus" size={16} color={primaryTextOnCommunity} />
                <ThemedText style={[styles.fabLabelSecondary, { color: primaryTextOnCommunity }]}>Entwurf</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fab, styles.fabPrimary]} onPress={() => openModal(true)}>
                <IconSymbol name="plus" size={18} color="#fff" />
                <ThemedText style={styles.fabLabel}>Schreiben</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}

          <Modal
            visible={showCreateModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowCreateModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContainer}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View
                  style={[
                    styles.modalContent,
                    {
                      backgroundColor: isDarkMode ? 'rgba(34, 24, 20, 0.94)' : 'rgba(255, 247, 239, 0.94)',
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(125,90,80,0.1)',
                    },
                  ]}
                >
                <ThemedText type="subtitle" style={[styles.modalTitle, { color: primaryTextOnCommunity }]}>Neue Publikation</ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: theme.textTertiary }]}>Veröffentlicht als {currentUserName}</ThemedText>

              <TextInput
                placeholder="Titel"
                placeholderTextColor={theme.textTertiary}
                value={newTitle}
                onChangeText={setNewTitle}
                style={[
                  styles.input,
                  {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.border,
                    color: primaryTextOnCommunity,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
                  },
                ]}
              />

              <TextInput
                placeholder="Kurzbeschreibung (optional)"
                placeholderTextColor={theme.textTertiary}
                value={newSummary}
                onChangeText={setNewSummary}
                style={[
                  styles.input,
                  {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.border,
                    color: primaryTextOnCommunity,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
                  },
                ]}
              />

              <TouchableOpacity
                style={[
                  styles.coverPicker,
                  {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.border,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
                  },
                ]}
                onPress={pickCoverImage}
              >
                <View style={[styles.coverPickerIcon, { backgroundColor: isDarkMode ? '#3A2E2A' : '#FADBC7' }]}>
                  <IconSymbol name="photo" size={18} color={primaryTextOnCommunity} />
                </View>
                <View style={styles.coverPickerTextBlock}>
                  <ThemedText style={[styles.coverPickerTitle, { color: primaryTextOnCommunity }]}>Titelbild hinzufügen</ThemedText>
                  <ThemedText style={[styles.coverPickerSubtitle, { color: theme.textSecondary }]}>Optionales Cover für den Artikel.</ThemedText>
                </View>
                {coverImageUri ? <View style={[styles.coverStatusDot, { backgroundColor: theme.success }]} /> : null}
              </TouchableOpacity>
              {coverImageUri ? (
                <Image source={{ uri: coverImageUri }} style={styles.coverPreview} resizeMode="cover" />
              ) : null}

              <TextInput
                placeholder="Artikel"
                placeholderTextColor={theme.textTertiary}
                value={newContent}
                onChangeText={setNewContent}
                style={[
                  styles.input,
                  styles.multiline,
                  {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.border,
                    color: primaryTextOnCommunity,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
                  },
                ]}
                multiline
                numberOfLines={6}
              />

              <View style={styles.publishRow}>
                <View>
                  <ThemedText style={[styles.publishLabel, { color: primaryTextOnCommunity }]}>Sofort veröffentlichen</ThemedText>
                  <ThemedText style={[styles.publishHint, { color: theme.textSecondary }]}>Wenn deaktiviert, bleibt der Beitrag als Entwurf gespeichert.</ThemedText>
                </View>
                <Switch value={isPublished} onValueChange={setIsPublished} thumbColor={isPublished ? theme.tint : '#ccc'} />
              </View>

                {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

                <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: theme.tint, opacity: isCreating ? 0.7 : 1 },
                  ]}
                  onPress={handlePublish}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.modalButtonText}>Speichern</ThemedText>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowCreateModal(false);
                    setErrorMessage('');
                    setNewTitle('');
                    setNewSummary('');
                    setNewContent('');
                    setCoverImageUri(null);
                    setCoverIsLocal(false);
                    setIsPublished(true);
                    setEditingPostId(null);
                  }}
                >
                  <ThemedText style={{ color: theme.textSecondary }}>Abbrechen</ThemedText>
                </TouchableOpacity>
                </View>
              </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Modal>

          <Modal
            visible={showDraftList}
            animationType="fade"
            transparent
            onRequestClose={() => setShowDraftList(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowDraftList(false)} accessible={false}>
              <View style={styles.draftModalOverlay}>
                <TouchableWithoutFeedback accessible={false}>
                  <View
                    style={[
                      styles.draftModalContent,
                      {
                        backgroundColor: isDarkMode ? 'rgba(34, 24, 20, 0.96)' : 'rgba(255, 247, 239, 0.96)',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(125,90,80,0.1)',
                      },
                    ]}
                  >
                    <ThemedText type="subtitle" style={[styles.modalTitle, { color: primaryTextOnCommunity }]}>Entwürfe</ThemedText>
                    <ThemedText style={[styles.modalSubtitle, { color: theme.textTertiary }]}>Tippe auf einen Entwurf, um weiterzuschreiben.</ThemedText>

                    {drafts.length > 0 ? (
                      <View style={styles.draftList}>
                        {drafts.map((draft) => (
                          <TouchableOpacity
                            key={draft.id}
                            style={[
                              styles.draftListItem,
                              {
                                borderColor: theme.border,
                                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
                              },
                            ]}
                            onPress={() => {
                              setShowDraftList(false);
                              openModal(false, draft);
                            }}
                          >
                            <View style={styles.draftListText}>
                              <ThemedText style={[styles.draftListTitle, { color: primaryTextOnCommunity }]} numberOfLines={1}>
                                {draft.title || 'Ohne Titel'}
                              </ThemedText>
                              <ThemedText style={[styles.draftListMeta, { color: theme.textSecondary }]}>
                                Letzte Änderung: {formatDate(draft.updated_at)}
                              </ThemedText>
                            </View>
                            <IconSymbol name="chevron.right" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <ThemedText style={[styles.noDraftsText, { color: theme.textSecondary }]}>Keine Entwürfe vorhanden.</ThemedText>
                    )}

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalCancelButton]}
                        onPress={() => setShowDraftList(false)}
                      >
                        <ThemedText style={{ color: theme.textSecondary }}>Schließen</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </SafeAreaView>
      </ThemedView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  listEmptyPadding: {
    flexGrow: 1,
  },
  listHeader: {
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  heroImageContainer: {
    position: 'absolute',
    width: 100,
    height: 100,
    top: 10,
    right: 10,
    zIndex: 10,
  },
  heroImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  heroBubbleTwo: {
    position: 'absolute',
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 60,
    bottom: -20,
    left: -10,
  },
  heroTextBlock: {
    gap: 8,
    paddingRight: 115,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  heroChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  heroChipText: {
    fontSize: 12,
    color: '#7D5A50',
    fontWeight: '600',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
  },
  adminPanel: {
    marginTop: 16,
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  adminHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadge: {
    backgroundColor: '#7D5A50',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  adminSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  adminButtonGhost: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  adminButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  draftRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  draftCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  draftTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  draftMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  noDraftsText: {
    fontSize: 14,
  },
  sectionHeader: {
    marginTop: 18,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  card: {
    borderRadius: 18,
    marginVertical: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  coverWrapper: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  draftBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  draftBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  cardBodyBlock: {
    padding: 16,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  adminOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  adminOverlayButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  cardBodyText: {
    fontSize: 16,
    lineHeight: 24,
  },
  readMoreButton: {
    marginTop: 6,
  },
  readMoreText: {
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  multiline: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  coverPicker: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coverPickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPickerTextBlock: {
    flex: 1,
  },
  coverPickerTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  coverPickerSubtitle: {
    fontSize: 13,
  },
  coverStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
  },
  coverPreview: {
    marginTop: 10,
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  publishRow: {
    marginTop: 14,
    paddingVertical: 6,
    paddingRight: 64, // bring toggle further inwards
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  publishLabel: {
    fontWeight: '700',
    fontSize: 15,
  },
  publishHint: {
    fontSize: 13,
    marginTop: 2,
  },
  errorText: {
    marginTop: 10,
    color: '#FF6B6B',
    fontSize: 14,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'transparent',
  },
  fabContainer: {
    position: 'absolute',
    right: 18,
    bottom: 88, // lifted above nav bar
    alignItems: 'flex-end',
    gap: 12,
  },
  fab: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    minWidth: 170,
    justifyContent: 'center',
  },
  fabPrimary: {
    backgroundColor: '#9B7658',
  },
  fabSecondary: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  fabGhost: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
  },
  fabLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  fabLabelSecondary: {
    fontWeight: '700',
  },
  draftModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 22,
  },
  draftModalContent: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  draftList: {
    marginTop: 10,
    gap: 10,
  },
  draftListItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  draftListText: {
    flex: 1,
  },
  draftListTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  draftListMeta: {
    fontSize: 13,
    marginTop: 2,
  },
});
