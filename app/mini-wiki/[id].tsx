import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  TextInput,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  FlatList,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { BlurView } from 'expo-blur';
import { LiquidGlassCard, LAYOUT_PAD } from '@/constants/DesignGuide';
import {
  getWikiArticle,
  getWikiCategories,
  getWikiArticleIndex,
  createWikiArticle,
  updateWikiArticle,
  deleteWikiArticle,
  addWikiArticleToFavorites,
  removeWikiArticleFromFavorites,
  uploadWikiCover,
  type WikiCategory,
} from '@/lib/supabase/wiki';
import { isUserAdmin } from '@/lib/supabase/recommendations';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import * as ImagePicker from 'expo-image-picker';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const timelineWidth = contentWidth - TIMELINE_INSET * 2; // EXACT Timeline card width

type Theme = typeof Colors.light;
type ActiveField =
  | { type: 'teaser' }
  | { type: 'core'; index: number }
  | { type: 'section'; index: number };
type AdminSection = { title: string; content: string };

const normalizeTitle = (value: string) => value.trim().toLowerCase();
const INLINE_PATTERN = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;

const renderInlineMarkup = (
  text: string,
  options: {
    theme: Theme;
    articleIndex: Record<string, string>;
    onPressLink: (id: string) => void;
  }
) => {
  if (!text || (!text.includes('**') && !text.includes(']('))) return text;
  INLINE_PATTERN.lastIndex = 0;
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**')) {
      const content = token.slice(2, -2);
      if (content) {
        nodes.push(
          <Text key={`b-${match.index}`} style={styles.inlineBold}>
            {content}
          </Text>
        );
      }
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!linkMatch) {
        nodes.push(token);
      } else {
        const label = linkMatch[1];
        const target = linkMatch[2];
        const articleId = options.articleIndex[normalizeTitle(target)];
        if (articleId) {
          nodes.push(
            <Text
              key={`l-${match.index}`}
              style={[styles.inlineLink, { color: options.theme.accent }]}
              onPress={() => options.onPressLink(articleId)}
            >
              {label}
            </Text>
          );
        } else {
          nodes.push(label);
        }
      }
    }

    lastIndex = INLINE_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
};

export default function WikiArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [article, setArticle] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [articleIndex, setArticleIndex] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminMode, setAdminMode] = useState<'create' | 'edit'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formReadingTime, setFormReadingTime] = useState('');
  const [formTeaser, setFormTeaser] = useState('');
  const [formCoverImageUrl, setFormCoverImageUrl] = useState('');
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [coverIsLocal, setCoverIsLocal] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [formCoreStatements, setFormCoreStatements] = useState<string[]>(['']);
  const [formSections, setFormSections] = useState<AdminSection[]>([
    { title: '', content: '' },
  ]);
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [activeSelection, setActiveSelection] = useState<{ start: number; end: number } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingLink, setPendingLink] = useState<{
    field: ActiveField;
    selection: { start: number; end: number };
  } | null>(null);
  const [articleList, setArticleList] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { data, error } = await getWikiArticle(id);
        if (error) throw error;
        setArticle(data);
      } catch (e: any) {
        setError(e?.message || 'Fehler beim Laden');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      const { data } = await getWikiCategories();
      if (active && data) {
        setCategories(data);
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadArticleIndex = async () => {
      const { data, error } = await getWikiArticleIndex();
      if (!active) return;
      if (error) {
        console.warn('Fehler beim Laden der Artikel-Links:', error);
        return;
      }
      if (data) {
        const map = data.reduce<Record<string, string>>((acc, item) => {
          const key = normalizeTitle(item.title);
          if (key && !acc[key]) {
            acc[key] = item.id;
          }
          return acc;
        }, {});
        setArticleIndex(map);
        setArticleList(data);
      }
    };

    loadArticleIndex();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      const status = await isUserAdmin();
      if (active) {
        setIsAdmin(status);
      }
    };

    checkAdmin();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (showAdminModal && !formCategoryId && categories.length > 0) {
      setFormCategoryId(categories[0].id);
    }
  }, [categories, formCategoryId, showAdminModal]);

  const toggleFavorite = async () => {
    if (!article) return;
    try {
      const isFav = !!article.isFavorite;
      if (isFav) {
        const { error } = await removeWikiArticleFromFavorites(article.id);
        if (error) throw error;
        setArticle({ ...article, isFavorite: false });
      } else {
        const { error } = await addWikiArticleToFavorites(article.id);
        if (error) throw error;
        setArticle({ ...article, isFavorite: true });
      }
    } catch (e) {
      // noop simple error
    }
  };

  const getDefaultCategoryId = (fallback?: string) =>
    fallback || categories[0]?.id || '';

  const resetAdminForm = (categoryId?: string) => {
    setFormTitle('');
    setFormCategoryId(getDefaultCategoryId(categoryId));
    setFormReadingTime('');
    setFormTeaser('');
    setFormCoverImageUrl('');
    setCoverImageUri(null);
    setCoverIsLocal(false);
    setFormCoreStatements(['']);
    setFormSections([{ title: '', content: '' }]);
  };

  const populateAdminForm = () => {
    const content = article?.content && typeof article.content === 'object' ? article.content : null;
    setFormTitle(article?.title || '');
    setFormCategoryId(getDefaultCategoryId(article?.category_id));
    setFormReadingTime(article?.reading_time || '');
    setFormTeaser(article?.teaser || '');
    setFormCoverImageUrl(article?.cover_image_url || '');
    setCoverImageUri(null);
    setCoverIsLocal(false);
    setFormCoreStatements(
      Array.isArray(content?.coreStatements) && content.coreStatements.length > 0
        ? content.coreStatements
        : ['']
    );
    setFormSections(
      Array.isArray(content?.sections) && content.sections.length > 0
        ? content.sections
        : [{ title: '', content: '' }]
    );
  };

  const openAdminModal = (mode: 'create' | 'edit') => {
    setAdminMode(mode);
    if (mode === 'edit' && article) {
      populateAdminForm();
    } else {
      resetAdminForm();
    }
    setShowAdminModal(true);
  };

  const pickCoverImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Zugriff benötigt', 'Bitte erlaube den Zugriff auf deine Fotos, um ein Titelbild auszuwählen.');
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
      setFormCoverImageUrl('');
    }
  };

  const clearCoverImage = () => {
    setCoverImageUri(null);
    setCoverIsLocal(false);
    setFormCoverImageUrl('');
  };

  const handleCoverUrlChange = (value: string) => {
    setFormCoverImageUrl(value);
    if (value.trim().length > 0) {
      setCoverImageUri(null);
      setCoverIsLocal(false);
    }
  };

  const updateCoreStatement = (index: number, value: string) => {
    setFormCoreStatements((prev) =>
      prev.map((statement, i) => (i === index ? value : statement))
    );
  };

  const addCoreStatement = () => {
    setFormCoreStatements((prev) => [...prev, '']);
  };

  const removeCoreStatement = (index: number) => {
    setFormCoreStatements((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']
    );
  };

  const updateSection = (index: number, updates: Partial<AdminSection>) => {
    setFormSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, ...updates } : section))
    );
  };

  const addSection = () => {
    setFormSections((prev) => [...prev, { title: '', content: '' }]);
  };

  const removeSection = (index: number) => {
    setFormSections((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ title: '', content: '' }]
    );
  };

  const coverPreviewUri = coverImageUri || formCoverImageUrl;

  const handleLinkPress = (articleId: string) => {
    router.push(`/mini-wiki/${articleId}`);
  };

  const getFieldValue = (field: ActiveField) => {
    if (field.type === 'teaser') return formTeaser;
    if (field.type === 'core') return formCoreStatements[field.index] ?? '';
    if (field.type === 'section') return formSections[field.index]?.content ?? '';
    return '';
  };

  const setFieldValue = (field: ActiveField, value: string) => {
    if (field.type === 'teaser') {
      setFormTeaser(value);
      return;
    }
    if (field.type === 'core') {
      setFormCoreStatements((prev) =>
        prev.map((item, index) => (index === field.index ? value : item))
      );
      return;
    }
    if (field.type === 'section') {
      setFormSections((prev) =>
        prev.map((item, index) =>
          index === field.index ? { ...item, content: value } : item
        )
      );
    }
  };

  const applyWrapperToSelection = (wrapperStart: string, wrapperEnd: string) => {
    if (!activeField || !activeSelection) {
      Alert.alert('Hinweis', 'Bitte markiere zuerst Text in einem Feld.');
      return;
    }
    const { start, end } = activeSelection;
    if (start === end) {
      Alert.alert('Hinweis', 'Bitte markiere zuerst Text in einem Feld.');
      return;
    }
    const value = getFieldValue(activeField);
    const selStart = Math.max(0, Math.min(start, end));
    const selEnd = Math.min(value.length, Math.max(start, end));
    const selected = value.slice(selStart, selEnd);
    const next = `${value.slice(0, selStart)}${wrapperStart}${selected}${wrapperEnd}${value.slice(selEnd)}`;
    setFieldValue(activeField, next);
  };

  const handleBold = () => applyWrapperToSelection('**', '**');

  const openLinkPicker = () => {
    if (!activeField || !activeSelection || activeSelection.start === activeSelection.end) {
      Alert.alert('Hinweis', 'Bitte markiere zuerst Text für den Link.');
      return;
    }
    setPendingLink({ field: activeField, selection: activeSelection });
    setShowLinkModal(true);
  };

  const applyLinkToPending = (title: string) => {
    if (!pendingLink) return;
    const value = getFieldValue(pendingLink.field);
    const { start, end } = pendingLink.selection;
    const selStart = Math.max(0, Math.min(start, end));
    const selEnd = Math.min(value.length, Math.max(start, end));
    if (selStart === selEnd) {
      Alert.alert('Hinweis', 'Bitte markiere zuerst Text für den Link.');
      return;
    }
    const label = value.slice(selStart, selEnd);
    const next = `${value.slice(0, selStart)}[${label}](${title})${value.slice(selEnd)}`;
    setFieldValue(pendingLink.field, next);
    setPendingLink(null);
    setShowLinkModal(false);
  };

  const renderFormatToolbar = () => (
    <View style={styles.formatToolbar}>
      <TouchableOpacity style={styles.formatButton} onPress={handleBold}>
        <ThemedText style={styles.formatButtonText}>Fett</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity style={styles.formatButton} onPress={openLinkPicker}>
        <ThemedText style={styles.formatButtonText}>Link</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const handleSaveAdmin = async () => {
    const title = formTitle.trim();
    const teaser = formTeaser.trim();
    const readingTime = formReadingTime.trim();
    const coverImageUrl = formCoverImageUrl.trim();

    if (!title || !teaser || !readingTime) {
      Alert.alert('Pflichtfelder', 'Titel, Teaser und Lesezeit sind erforderlich.');
      return;
    }

    if (!formCategoryId) {
      Alert.alert('Kategorie fehlt', 'Bitte eine Kategorie auswählen.');
      return;
    }

    const content = {
      coreStatements: formCoreStatements.map((s) => s.trim()).filter(Boolean),
      sections: formSections
        .map((section) => ({
          title: section.title.trim(),
          content: section.content.trim(),
        }))
        .filter((section) => section.title || section.content),
    };

    setIsSaving(true);
    try {
      let uploadedCoverUrl: string | null = coverImageUrl || null;
      if (coverImageUri && coverIsLocal) {
        setIsUploadingCover(true);
        const { data: url, error } = await uploadWikiCover(coverImageUri);
        setIsUploadingCover(false);
        if (error) throw error;
        uploadedCoverUrl = url;
      }

      if (adminMode === 'edit' && article?.id) {
        const { error } = await updateWikiArticle(article.id, {
          title,
          category_id: formCategoryId,
          teaser,
          reading_time: readingTime,
          cover_image_url: uploadedCoverUrl,
          content,
        });
        if (error) throw error;
        const { data: refreshed } = await getWikiArticle(article.id);
        if (refreshed) setArticle(refreshed);
      } else {
        const { data, error } = await createWikiArticle({
          title,
          category_id: formCategoryId,
          teaser,
          reading_time: readingTime,
          cover_image_url: uploadedCoverUrl,
          content,
        });
        if (error || !data) throw error || new Error('Fehler beim Erstellen');
        const { data: refreshed } = await getWikiArticle(data.id);
        if (refreshed) setArticle(refreshed);
        router.replace(`/mini-wiki/${data.id}`);
      }
      setShowAdminModal(false);
    } catch (err) {
      Alert.alert('Fehler', 'Artikel konnte nicht gespeichert werden.');
    } finally {
      setIsUploadingCover(false);
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!article?.id || isDeleting) return;
    Alert.alert('Artikel löschen', 'Möchtest du diesen Artikel wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            const { error } = await deleteWikiArticle(article.id);
            if (error) throw error;
            router.replace('/mini-wiki');
          } catch (err) {
            Alert.alert('Fehler', 'Artikel konnte nicht gelöscht werden.');
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage} resizeMode="repeat">
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          <Header
            title={article?.title || 'Artikel'}
            showBackButton
            rightContent={article ? (
              <TouchableOpacity onPress={toggleFavorite} style={styles.headerFavButton}>
                <IconSymbol
                  name={article.isFavorite ? 'star.fill' : 'star'}
                  size={22}
                  color={article.isFavorite ? theme.accent : theme.tabIconDefault}
                />
              </TouchableOpacity>
            ) : null}
          />

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={{ marginTop: 12 }}>Lade Artikel…</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <IconSymbol name="exclamationmark.triangle" size={40} color={theme.warning} />
              <ThemedText style={{ marginTop: 8 }}>{error}</ThemedText>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ alignSelf: 'center', width: screenWidth, paddingHorizontal: 12 }}>
                {isAdmin && (
                  <LiquidGlassCard
                    style={styles.adminPanel}
                    intensity={24}
                    overlayColor="rgba(142, 78, 198, 0.12)"
                    borderColor="rgba(142, 78, 198, 0.35)"
                  >
                    <View style={styles.adminHeaderRow}>
                      <View style={styles.adminBadge}>
                        <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
                      </View>
                      <ThemedText style={styles.adminTitle}>Artikel verwalten</ThemedText>
                    </View>
                    <ThemedText style={styles.adminSubtitle}>
                      Erstelle neue Einträge oder bearbeite den aktuellen Artikel.
                    </ThemedText>
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={[styles.adminButton, styles.adminButtonPrimary]}
                        onPress={() => openAdminModal('edit')}
                        disabled={!article}
                      >
                        <ThemedText style={styles.adminButtonText}>Bearbeiten</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.adminButton, styles.adminButtonSecondary]}
                        onPress={() => openAdminModal('create')}
                      >
                        <ThemedText style={styles.adminButtonText}>Neu</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.adminButton, styles.adminButtonDanger]}
                        onPress={confirmDelete}
                        disabled={!article || isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#A34A4A" />
                        ) : (
                          <ThemedText style={[styles.adminButtonText, styles.adminButtonTextDanger]}>
                            Löschen
                          </ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  </LiquidGlassCard>
                )}
                <LiquidGlassCard style={[styles.articleCard, { width: '100%' }] }>
                  {article.category && (
                    <ThemedText style={styles.category}>{article.category.name || ''}</ThemedText>
                  )}
                  {article.reading_time && (
                    <View style={styles.readingRow}>
                      <IconSymbol name="clock" size={14} color={theme.tabIconDefault} />
                      <ThemedText style={styles.reading}>{article.reading_time}</ThemedText>
                    </View>
                  )}

                  {article.cover_image_url ? (
                    <View style={styles.coverWrapper}>
                      <Image
                        source={{ uri: article.cover_image_url }}
                        style={styles.coverImage}
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}

                  {article.content && (
                    <View style={styles.bodyInset}>
                      {Array.isArray(article.content.coreStatements) && article.content.coreStatements.length > 0 && (
                        <View style={{ marginTop: 8, marginBottom: 16 }}>
                          <ThemedText style={styles.sectionTitle}>Das Wichtigste in Kürze</ThemedText>
                          {article.content.coreStatements.map((s: string, i: number) => (
                            <View key={i} style={styles.coreRow}>
                              <View style={styles.bullet} />
                              <ThemedText style={styles.coreText}>
                                {renderInlineMarkup(s, { theme, articleIndex, onPressLink: handleLinkPress })}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      )}

                      {Array.isArray(article.content.sections) && article.content.sections.map((section: any, i: number) => (
                        <View key={i} style={{ marginBottom: 20 }}>
                          <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                          <ThemedText style={styles.sectionText}>
                            {renderInlineMarkup(section.content, { theme, articleIndex, onPressLink: handleLinkPress })}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                </LiquidGlassCard>
              </View>
            </ScrollView>
          )}

          <Modal
            visible={showAdminModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowAdminModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.adminModalWrapper}
            >
              <View style={styles.adminModalOverlay}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowAdminModal(false);
                  }}
                >
                  <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>

                <BlurView style={styles.adminModalContent} tint="extraLight" intensity={80}>
                  <View style={styles.modalHeaderRow}>
                    <TouchableOpacity
                      style={styles.modalHeaderButton}
                      onPress={() => setShowAdminModal(false)}
                    >
                      <IconSymbol name="xmark" size={18} color={theme.text} />
                    </TouchableOpacity>
                    <ThemedText style={styles.modalTitle}>
                      {adminMode === 'edit' ? 'Artikel bearbeiten' : 'Neuen Artikel erstellen'}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.modalHeaderButton, styles.modalHeaderButtonPrimary]}
                      onPress={handleSaveAdmin}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <IconSymbol name="checkmark" size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalField}>
                      <ThemedText style={styles.modalLabel}>Titel</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        value={formTitle}
                        onChangeText={setFormTitle}
                        placeholder="Titel"
                        placeholderTextColor="#A8978E"
                      />
                    </View>

                    <View style={styles.modalField}>
                      <ThemedText style={styles.modalLabel}>Kategorie</ThemedText>
                      {categories.length === 0 ? (
                        <ThemedText style={styles.modalHint}>Kategorien werden geladen…</ThemedText>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.categoryChipRow}>
                            {categories.map((cat) => {
                              const isActive = formCategoryId === cat.id;
                              return (
                                <TouchableOpacity
                                  key={cat.id}
                                  style={[
                                    styles.categoryChip,
                                    isActive && styles.categoryChipActive,
                                  ]}
                                  onPress={() => setFormCategoryId(cat.id)}
                                >
                                  <ThemedText
                                    style={[
                                      styles.categoryChipText,
                                      isActive && styles.categoryChipTextActive,
                                    ]}
                                  >
                                    {cat.name}
                                  </ThemedText>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                      )}
                    </View>

                    <View style={styles.modalField}>
                      <ThemedText style={styles.modalLabel}>Lesezeit</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        value={formReadingTime}
                        onChangeText={setFormReadingTime}
                        placeholder="z.B. 5 Min"
                        placeholderTextColor="#A8978E"
                      />
                    </View>

                    <View style={styles.modalField}>
                      <ThemedText style={styles.modalLabel}>Titelbild</ThemedText>
                      <TouchableOpacity
                        style={styles.coverPicker}
                        onPress={pickCoverImage}
                        disabled={isSaving || isUploadingCover}
                      >
                        <View style={styles.coverPickerIcon}>
                          <IconSymbol name="photo" size={18} color="#7D5A50" />
                        </View>
                        <View style={styles.coverPickerTextBlock}>
                          <ThemedText style={styles.coverPickerTitle}>Bild auswählen</ThemedText>
                          <ThemedText style={styles.coverPickerSubtitle}>Aus deiner Galerie hochladen</ThemedText>
                        </View>
                        {isUploadingCover ? (
                          <ActivityIndicator size="small" color="#7D5A50" />
                        ) : coverPreviewUri ? (
                          <View style={[styles.coverStatusDot, { backgroundColor: theme.success }]} />
                        ) : null}
                      </TouchableOpacity>
                      <TextInput
                        style={styles.modalInput}
                        value={formCoverImageUrl}
                        onChangeText={handleCoverUrlChange}
                        placeholder="Bild-URL (optional)"
                        placeholderTextColor="#A8978E"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {coverPreviewUri ? (
                        <>
                          <Image
                            source={{ uri: coverPreviewUri }}
                            style={styles.coverPreview}
                            resizeMode="cover"
                          />
                          <TouchableOpacity style={styles.coverRemoveButton} onPress={clearCoverImage}>
                            <ThemedText style={styles.removeText}>Titelbild entfernen</ThemedText>
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>

                    <View style={styles.modalField}>
                      <ThemedText style={styles.modalLabel}>Teaser</ThemedText>
                      <TextInput
                        style={[styles.modalInput, styles.modalInputMultiline]}
                        value={formTeaser}
                        onChangeText={setFormTeaser}
                        onFocus={() => setActiveField({ type: 'teaser' })}
                        onSelectionChange={(event) => {
                          setActiveField({ type: 'teaser' });
                          setActiveSelection(event.nativeEvent.selection);
                        }}
                        placeholder="Kurzer Teaser für die Übersicht"
                        placeholderTextColor="#A8978E"
                        multiline
                      />
                      {renderFormatToolbar()}
                      <ThemedText style={[styles.modalHint, styles.modalHintInline]}>
                        Formatierung: **fett** und Links wie [Text](Artikel-Titel).
                      </ThemedText>
                    </View>

                    <View style={styles.modalField}>
                      <View style={styles.modalFieldRow}>
                        <ThemedText style={styles.modalLabel}>Kernaussagen</ThemedText>
                        <TouchableOpacity
                          style={styles.inlineIconButton}
                          onPress={addCoreStatement}
                        >
                          <IconSymbol name="plus" size={16} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                      {renderFormatToolbar()}
                      {formCoreStatements.map((statement, index) => (
                        <View key={`core-${index}`} style={styles.inlineRow}>
                          <TextInput
                            style={[styles.modalInput, styles.inlineInput]}
                            value={statement}
                            onChangeText={(value) => updateCoreStatement(index, value)}
                            onFocus={() => setActiveField({ type: 'core', index })}
                            onSelectionChange={(event) => {
                              setActiveField({ type: 'core', index });
                              setActiveSelection(event.nativeEvent.selection);
                            }}
                            placeholder="Aussage"
                            placeholderTextColor="#A8978E"
                          />
                          {formCoreStatements.length > 1 && (
                            <TouchableOpacity
                              style={styles.removeIconButton}
                              onPress={() => removeCoreStatement(index)}
                            >
                              <IconSymbol name="xmark" size={14} color={theme.tabIconDefault} />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>

                    <View style={styles.modalField}>
                      <View style={styles.modalFieldRow}>
                        <ThemedText style={styles.modalLabel}>Abschnitte</ThemedText>
                        <TouchableOpacity style={styles.inlineIconButton} onPress={addSection}>
                          <IconSymbol name="plus" size={16} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                      {renderFormatToolbar()}
                      {formSections.map((section, index) => (
                        <View key={`section-${index}`} style={styles.sectionBlock}>
                          <TextInput
                            style={styles.modalInput}
                            value={section.title}
                            onChangeText={(value) => updateSection(index, { title: value })}
                            placeholder="Abschnittstitel"
                            placeholderTextColor="#A8978E"
                          />
                          <TextInput
                            style={[styles.modalInput, styles.modalInputMultiline]}
                            value={section.content}
                            onChangeText={(value) => updateSection(index, { content: value })}
                            onFocus={() => setActiveField({ type: 'section', index })}
                            onSelectionChange={(event) => {
                              setActiveField({ type: 'section', index });
                              setActiveSelection(event.nativeEvent.selection);
                            }}
                            placeholder="Abschnittstext"
                            placeholderTextColor="#A8978E"
                            multiline
                          />
                          {formSections.length > 1 && (
                            <TouchableOpacity
                              style={styles.removeTextButton}
                              onPress={() => removeSection(index)}
                            >
                              <ThemedText style={styles.removeText}>Abschnitt entfernen</ThemedText>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </BlurView>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal
            visible={showLinkModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowLinkModal(false)}
          >
            <View style={styles.linkModalOverlay}>
              <View style={styles.linkModalCard}>
                <View style={styles.linkModalHeader}>
                  <ThemedText style={styles.linkModalTitle}>Artikel verlinken</ThemedText>
                  <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={theme.tabIconDefault} />
                  </TouchableOpacity>
                </View>
                {articleList.length === 0 ? (
                  <ThemedText style={styles.modalHint}>Keine Artikel gefunden.</ThemedText>
                ) : (
                  <FlatList
                    data={articleList}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    style={styles.linkList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.linkListItem}
                        onPress={() => applyLinkToPending(item.title)}
                      >
                        <ThemedText style={styles.linkListItemText}>{item.title}</ThemedText>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  articleCard: {
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 20,
    marginTop: 12,
    marginBottom: 24,
  },
  adminPanel: {
    borderRadius: 20,
    padding: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  adminHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(142, 78, 198, 0.18)',
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7D5A50',
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  adminSubtitle: {
    fontSize: 13,
    color: '#A8978E',
    marginBottom: 10,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
  },
  adminButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  adminButtonPrimary: {
    borderWidth: 1,
    borderColor: 'rgba(142, 78, 198, 0.45)',
    backgroundColor: 'rgba(142, 78, 198, 0.16)',
  },
  adminButtonSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  adminButtonDanger: {
    borderWidth: 1,
    borderColor: 'rgba(229, 62, 62, 0.35)',
    backgroundColor: 'rgba(229, 62, 62, 0.12)',
  },
  adminButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7D5A50',
  },
  adminButtonTextDanger: {
    color: '#A34A4A',
  },
  headerFavButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  category: { fontSize: 14, opacity: 0.7, marginTop: 4, marginBottom: 8 },
  readingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  reading: { marginLeft: 4, fontSize: 14, opacity: 0.7 },
  coverWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: -36,
    marginTop: 8,
    marginBottom: 18,
  },
  coverImage: {
    width: '100%',
    height: 220,
  },
  bodyInset: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  coreRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8, backgroundColor: 'rgba(94,61,179,0.85)' },
  coreText: { fontSize: 16, flex: 1 },
  sectionText: { fontSize: 16, lineHeight: 24 },
  inlineBold: {
    fontWeight: '700',
  },
  inlineLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  adminModalWrapper: {
    flex: 1,
  },
  adminModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  adminModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  modalHeaderButtonPrimary: {
    backgroundColor: '#8E4EC6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  modalField: {
    marginBottom: 14,
  },
  modalFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 13,
    color: '#A8978E',
  },
  modalHintInline: {
    marginTop: 6,
  },
  formatToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  formatButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.2)',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  formatButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7D5A50',
  },
  linkModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  linkModalCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    maxHeight: '70%',
  },
  linkModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  linkModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  linkList: {
    marginTop: 4,
  },
  linkListItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(125, 90, 80, 0.12)',
  },
  linkListItemText: {
    fontSize: 14,
    color: '#7D5A50',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#7D5A50',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  coverPicker: {
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.2)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  coverPickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142, 78, 198, 0.12)',
  },
  coverPickerTextBlock: {
    flex: 1,
  },
  coverPickerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
  },
  coverPickerSubtitle: {
    fontSize: 12,
    color: '#A8978E',
  },
  coverStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  coverPreview: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  coverRemoveButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  modalInputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inlineInput: {
    flex: 1,
  },
  inlineIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  removeIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  sectionBlock: {
    marginBottom: 12,
  },
  removeTextButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  removeText: {
    fontSize: 12,
    color: '#A34A4A',
    fontWeight: '600',
  },
  categoryChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.2)',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  categoryChipActive: {
    borderColor: 'rgba(142, 78, 198, 0.5)',
    backgroundColor: 'rgba(142, 78, 198, 0.12)',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#7D5A50',
  },
  categoryChipTextActive: {
    fontWeight: '600',
  },
});
