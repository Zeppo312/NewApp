import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
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
  createWikiArticle,
  updateWikiArticle,
  deleteWikiArticle,
  addWikiArticleToFavorites,
  removeWikiArticleFromFavorites,
  type WikiCategory,
} from '@/lib/supabase/wiki';
import { isUserAdmin } from '@/lib/supabase/recommendations';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const timelineWidth = contentWidth - TIMELINE_INSET * 2; // EXACT Timeline card width

type AdminSection = { title: string; content: string };

export default function WikiArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [article, setArticle] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminMode, setAdminMode] = useState<'create' | 'edit'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formReadingTime, setFormReadingTime] = useState('');
  const [formTeaser, setFormTeaser] = useState('');
  const [formCoreStatements, setFormCoreStatements] = useState<string[]>(['']);
  const [formSections, setFormSections] = useState<AdminSection[]>([
    { title: '', content: '' },
  ]);

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
    setFormCoreStatements(['']);
    setFormSections([{ title: '', content: '' }]);
  };

  const populateAdminForm = () => {
    const content = article?.content && typeof article.content === 'object' ? article.content : null;
    setFormTitle(article?.title || '');
    setFormCategoryId(getDefaultCategoryId(article?.category_id));
    setFormReadingTime(article?.reading_time || '');
    setFormTeaser(article?.teaser || '');
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

  const handleSaveAdmin = async () => {
    const title = formTitle.trim();
    const teaser = formTeaser.trim();
    const readingTime = formReadingTime.trim();

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
      if (adminMode === 'edit' && article?.id) {
        const { error } = await updateWikiArticle(article.id, {
          title,
          category_id: formCategoryId,
          teaser,
          reading_time: readingTime,
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

                  {article.content && (
                    <View style={styles.bodyInset}>
                      {Array.isArray(article.content.coreStatements) && article.content.coreStatements.length > 0 && (
                        <View style={{ marginTop: 8, marginBottom: 16 }}>
                          <ThemedText style={styles.sectionTitle}>Das Wichtigste in Kürze</ThemedText>
                          {article.content.coreStatements.map((s: string, i: number) => (
                            <View key={i} style={styles.coreRow}>
                              <View style={styles.bullet} />
                              <ThemedText style={styles.coreText}>{s}</ThemedText>
                            </View>
                          ))}
                        </View>
                      )}

                      {Array.isArray(article.content.sections) && article.content.sections.map((section: any, i: number) => (
                        <View key={i} style={{ marginBottom: 20 }}>
                          <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                          <ThemedText style={styles.sectionText}>{section.content}</ThemedText>
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
                      <ThemedText style={styles.modalLabel}>Teaser</ThemedText>
                      <TextInput
                        style={[styles.modalInput, styles.modalInputMultiline]}
                        value={formTeaser}
                        onChangeText={setFormTeaser}
                        placeholder="Kurzer Teaser für die Übersicht"
                        placeholderTextColor="#A8978E"
                        multiline
                      />
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
                      {formCoreStatements.map((statement, index) => (
                        <View key={`core-${index}`} style={styles.inlineRow}>
                          <TextInput
                            style={[styles.modalInput, styles.inlineInput]}
                            value={statement}
                            onChangeText={(value) => updateCoreStatement(index, value)}
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
    paddingHorizontal: 36,
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
  bodyInset: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  coreRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8, backgroundColor: 'rgba(94,61,179,0.85)' },
  coreText: { fontSize: 16, flex: 1 },
  sectionText: { fontSize: 16, lineHeight: 24 },
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
