import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { Stack, useRouter } from 'expo-router';

import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  GLASS_BORDER,
  GLASS_OVERLAY,
  LAYOUT_PAD,
  LiquidGlassCard,
  PRIMARY,
  RADIUS,
  SECTION_GAP_BOTTOM,
  SECTION_GAP_TOP,
  GRID_GAP,
} from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  fetchMyRecipes,
  updateRecipe,
  deleteRecipe,
  RecipeRecord,
  RecipeUpdate,
} from '@/lib/recipes';

const AGE_LIMITS = { min: 4, max: 24 };

const ALLERGEN_OPTIONS: { id: string; label: string }[] = [
  { id: 'milk', label: 'Milchprodukte' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'egg', label: 'Ei' },
  { id: 'nuts', label: 'Nüsse' },
  { id: 'fish', label: 'Fisch' },
];

const { width: screenWidth } = Dimensions.get('window');
const SCREEN_PADDING = 4;
const contentWidth = screenWidth - 2 * SCREEN_PADDING;
const isCompact = screenWidth < 380;
const CARD_INTERNAL_PADDING = 32;
const CARD_SPACING = 16;

const MyRecipesScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editTip, setEditTip] = useState('');
  const [editMinMonths, setEditMinMonths] = useState('6');
  const [editIngredients, setEditIngredients] = useState<string[]>([]);
  const [editIngredientInput, setEditIngredientInput] = useState('');
  const [editAllergens, setEditAllergens] = useState<string[]>([]);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);

  const loadMyRecipes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await fetchMyRecipes();
      if (error) throw error;
      setRecipes(data);
    } catch (error) {
      console.error('Error loading my recipes:', error);
      Alert.alert(
        'Fehler beim Laden',
        'Deine Rezepte konnten nicht geladen werden. Bitte versuche es später erneut.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyRecipes();
  }, [loadMyRecipes]);

  const openEditModal = (recipe: RecipeRecord) => {
    setSelectedRecipe(recipe);
    setEditTitle(recipe.title);
    setEditDescription(recipe.description || '');
    setEditInstructions(recipe.instructions);
    setEditTip(recipe.tip || '');
    setEditMinMonths(recipe.min_months.toString());
    setEditIngredients([...recipe.ingredients]);
    setEditAllergens([...recipe.allergens]);
    setEditImage(recipe.image_url);
    setImageChanged(false);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedRecipe(null);
    setEditTitle('');
    setEditDescription('');
    setEditInstructions('');
    setEditTip('');
    setEditMinMonths('6');
    setEditIngredients([]);
    setEditIngredientInput('');
    setEditAllergens([]);
    setEditImage(null);
    setImageChanged(false);
  };

  const addIngredientToForm = () => {
    const trimmed = editIngredientInput.trim();
    if (!trimmed) return;
    setEditIngredients((prev) => {
      if (prev.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
    setEditIngredientInput('');
  };

  const removeIngredientFromForm = (ingredient: string) => {
    setEditIngredients((prev) => prev.filter((item) => item !== ingredient));
  };

  const toggleEditAllergen = (allergen: string) => {
    setEditAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((item) => item !== allergen) : [...prev, allergen]
    );
  };

  const pickEditImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Berechtigung erforderlich',
          'Wir benötigen Zugriff auf deine Fotos, um Bilder hinzuzufügen.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setEditImage(`data:image/jpeg;base64,${asset.base64}`);
          setImageChanged(true);
        } else {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          setEditImage(base64Data);
          setImageChanged(true);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Das Bild konnte nicht ausgewählt werden.');
    }
  };

  const handleUpdateRecipe = async () => {
    if (!selectedRecipe) return;

    if (!editTitle.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Rezepttitel ein.');
      return;
    }

    if (editIngredients.length === 0) {
      Alert.alert('Hinweis', 'Bitte füge mindestens eine Zutat hinzu.');
      return;
    }

    if (!editInstructions.trim()) {
      Alert.alert('Hinweis', 'Beschreibe kurz die Zubereitung.');
      return;
    }

    const months = Math.max(
      AGE_LIMITS.min,
      Math.min(AGE_LIMITS.max, Number.parseInt(editMinMonths, 10) || AGE_LIMITS.min)
    );

    try {
      setIsSubmitting(true);
      const updatePayload: RecipeUpdate = {
        title: editTitle,
        description: editDescription || null,
        min_months: months,
        ingredients: editIngredients,
        allergens: editAllergens,
        instructions: editInstructions,
        tip: editTip || null,
      };

      const { data, error } = await updateRecipe(
        selectedRecipe.id,
        updatePayload,
        imageChanged ? editImage ?? undefined : undefined
      );

      if (error) {
        throw error;
      }

      if (data) {
        setRecipes((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      } else {
        await loadMyRecipes();
      }

      closeEditModal();
      Alert.alert('Erfolg', 'Dein Rezept wurde aktualisiert.');
    } catch (error) {
      console.error('Error updating recipe:', error);
      const message =
        error instanceof Error ? error.message : 'Beim Aktualisieren ist ein Fehler aufgetreten.';
      Alert.alert('Fehler', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecipe = (recipe: RecipeRecord) => {
    Alert.alert(
      'Rezept löschen',
      `Möchtest du "${recipe.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const { error } = await deleteRecipe(recipe.id);
              if (error) {
                throw error;
              }
              setRecipes((prev) => prev.filter((item) => item.id !== recipe.id));
              Alert.alert('Erfolg', 'Das Rezept wurde gelöscht.');
            } catch (error) {
              console.error('Error deleting recipe:', error);
              const message =
                error instanceof Error
                  ? error.message
                  : 'Beim Löschen ist ein Fehler aufgetreten.';
              Alert.alert('Fehler', message);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
          <Header
            title='Meine Rezepte'
            subtitle='Bearbeite und verwalte deine eigenen Rezepte'
            showBackButton
            onBackPress={() => router.back()}
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.contentContainer, { width: contentWidth }]}>
              {isLoading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size='large' color={PRIMARY} />
                  <ThemedText style={styles.loadingText}>Rezepte werden geladen ...</ThemedText>
                </View>
              ) : recipes.length === 0 ? (
                <LiquidGlassCard
                  style={styles.card}
                  intensity={24}
                  overlayColor='rgba(255,255,255,0.2)'
                  borderColor='rgba(255,255,255,0.32)'
                >
                  <View style={styles.emptyStateBody}>
                    <IconSymbol name='sparkles' size={24} color={PRIMARY} />
                    <ThemedText style={styles.emptyStateTitle}>
                      Noch keine eigenen Rezepte
                    </ThemedText>
                    <ThemedText style={styles.emptyStateText}>
                      Erstelle dein erstes Rezept im Rezept-Generator!
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              ) : (
                recipes.map((recipe) => (
                  <LiquidGlassCard
                    key={recipe.id}
                    style={[styles.card, styles.recipeCard]}
                    intensity={24}
                    overlayColor='rgba(255,255,255,0.2)'
                    borderColor='rgba(255,255,255,0.35)'
                  >
                    <View style={styles.imageHeader}>
                      {recipe.image_url ? (
                        <Image
                          source={{ uri: recipe.image_url }}
                          style={styles.imageHeaderImg}
                          resizeMode='cover'
                        />
                      ) : (
                        <View style={[styles.imageHeaderImg, styles.imageHeaderPlaceholder]}>
                          <IconSymbol name='fork.knife' size={22} color='#FFFFFF' />
                        </View>
                      )}
                      <View style={styles.imageHeaderOverlay} />
                      <View style={styles.imageHeaderBadges}>
                        <View style={styles.imageHeaderBadge}>
                          <IconSymbol name='clock' size={14} color='#FFFFFF' />
                          <ThemedText style={styles.imageHeaderBadgeText}>
                            ab {recipe.min_months} M
                          </ThemedText>
                        </View>
                        {!!recipe.allergens.length && (
                          <View style={[styles.imageHeaderBadge, styles.imageHeaderWarn]}>
                            <IconSymbol name='exclamationmark.triangle.fill' size={14} color='#FFFFFF' />
                            <ThemedText style={styles.imageHeaderBadgeText}>
                              {recipe.allergens.join(', ')}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.catalogTextColumn}>
                      <ThemedText style={styles.recipeTitle} numberOfLines={2}>
                        {recipe.title}
                      </ThemedText>
                      <ThemedText
                        style={styles.catalogDescription}
                        numberOfLines={2}
                        ellipsizeMode='tail'
                      >
                        {recipe.description ?? 'Leckeres BLW-Gericht.'}
                      </ThemedText>
                      <View style={styles.catalogMetaRow}>
                        <View style={styles.statPill}>
                          <IconSymbol name='checklist' size={14} color={PRIMARY} />
                          <ThemedText style={styles.statText}>
                            {recipe.ingredients.length} Zutaten
                          </ThemedText>
                        </View>
                      </View>
                    </View>

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => openEditModal(recipe)}
                        activeOpacity={0.85}
                      >
                        <IconSymbol name='pencil' size={18} color='#FFFFFF' />
                        <ThemedText style={styles.editButtonText}>Bearbeiten</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteRecipe(recipe)}
                        activeOpacity={0.85}
                        disabled={isDeleting}
                      >
                        <IconSymbol name='trash' size={18} color='#FFFFFF' />
                        <ThemedText style={styles.deleteButtonText}>Löschen</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </LiquidGlassCard>
                ))
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>

      {/* Edit Recipe Modal */}
      <Modal
        visible={showEditModal}
        animationType='slide'
        transparent
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.recipeModalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeEditModal}
            activeOpacity={1}
          />
          <BlurView
            style={[styles.recipeModalCard, styles.createModalCard]}
            intensity={90}
            tint={colorScheme === 'dark' ? 'dark' : 'extraLight'}
          >
            <View style={styles.recipeModalHandle} />
            <View style={styles.recipeModalHeaderRow}>
              <TouchableOpacity
                style={styles.recipeModalHeaderButton}
                onPress={closeEditModal}
                activeOpacity={0.85}
              >
                <IconSymbol name='xmark' size={18} color='#7D5A50' />
              </TouchableOpacity>
              <View style={styles.recipeModalHeaderCenter}>
                <ThemedText style={styles.recipeModalHeaderTitle}>Rezept bearbeiten</ThemedText>
                <ThemedText style={styles.recipeModalHeaderSubtitle}>
                  Aktualisiere dein Rezept
                </ThemedText>
              </View>
              <View style={styles.recipeModalHeaderSpacer} />
            </View>
            <ScrollView
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Titel</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder='z. B. Cremige Kürbis-Pasta'
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholderTextColor='rgba(0,0,0,0.35)'
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Kurzbeschreibung</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.formMultiline]}
                  placeholder='Was macht das Rezept besonders?'
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor='rgba(0,0,0,0.35)'
                />
              </View>
              <View style={styles.formRow}>
                <View style={styles.formRowItem}>
                  <ThemedText style={styles.formLabel}>Alter (Monate)</ThemedText>
                  <TextInput
                    style={styles.formInput}
                    placeholder={`${AGE_LIMITS.min}-${AGE_LIMITS.max}`}
                    value={editMinMonths}
                    onChangeText={(text) => setEditMinMonths(text.replace(/[^0-9]/g, ''))}
                    keyboardType='number-pad'
                    maxLength={2}
                    placeholderTextColor='rgba(0,0,0,0.35)'
                  />
                </View>
                <View style={styles.formRowItem}>
                  <ThemedText style={styles.formLabel}>Optionaler Tipp</ThemedText>
                  <TextInput
                    style={styles.formInput}
                    placeholder='Tricks oder Variation'
                    value={editTip}
                    onChangeText={setEditTip}
                    placeholderTextColor='rgba(0,0,0,0.35)'
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Zutaten</ThemedText>
                <View style={styles.formRow}>
                  <TextInput
                    style={[styles.formInput, styles.formRowInput]}
                    placeholder='Zutat eingeben'
                    value={editIngredientInput}
                    onChangeText={setEditIngredientInput}
                    onSubmitEditing={addIngredientToForm}
                    placeholderTextColor='rgba(0,0,0,0.35)'
                  />
                  <TouchableOpacity
                    style={styles.formAddButton}
                    onPress={addIngredientToForm}
                    activeOpacity={0.85}
                  >
                    <IconSymbol name='plus' size={18} color='#FFFFFF' />
                  </TouchableOpacity>
                </View>
                <View style={styles.formChipRow}>
                  {editIngredients.length === 0 ? (
                    <ThemedText style={styles.formChipHint}>
                      Noch keine Zutaten hinzugefügt.
                    </ThemedText>
                  ) : (
                    editIngredients.map((ingredient) => (
                      <TouchableOpacity
                        key={ingredient}
                        style={styles.formChip}
                        onPress={() => removeIngredientFromForm(ingredient)}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.formChipText}>{ingredient}</ThemedText>
                        <IconSymbol name='xmark.circle.fill' size={16} color='#FFFFFF' />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Allergene</ThemedText>
                <View style={styles.formChipRow}>
                  {ALLERGEN_OPTIONS.map((option) => {
                    const isSelected = editAllergens.includes(option.id);
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.formAllergenChip,
                          isSelected && styles.formAllergenSelected,
                        ]}
                        onPress={() => toggleEditAllergen(option.id)}
                        activeOpacity={0.85}
                      >
                        <ThemedText
                          style={[
                            styles.formAllergenLabel,
                            isSelected && styles.formAllergenLabelSelected,
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Anleitung</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.formMultiline, styles.formInstructions]}
                  placeholder='Beschreibe die Zubereitungsschritte'
                  value={editInstructions}
                  onChangeText={setEditInstructions}
                  multiline
                  numberOfLines={5}
                  placeholderTextColor='rgba(0,0,0,0.35)'
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Bild (optional)</ThemedText>
                {editImage ? (
                  <View style={styles.formImagePreviewWrapper}>
                    <Image source={{ uri: editImage }} style={styles.formImagePreview} />
                    <TouchableOpacity
                      style={styles.formImageRemove}
                      onPress={() => {
                        setEditImage(null);
                        setImageChanged(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <IconSymbol name='trash' size={18} color='#FFFFFF' />
                      <ThemedText style={styles.formImageRemoveText}>Entfernen</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.formImagePicker}
                    onPress={pickEditImage}
                    activeOpacity={0.85}
                  >
                    <IconSymbol name='camera' size={22} color={PRIMARY} />
                    <ThemedText style={styles.formImagePickerText}>
                      Bild aus der Mediathek wählen
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formCancelButton]}
                  onPress={closeEditModal}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  <ThemedText style={styles.formCancelText}>Abbrechen</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formSubmitButton]}
                  onPress={handleUpdateRecipe}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color='#FFFFFF' />
                  ) : (
                    <ThemedText style={styles.formSubmitText}>Speichern</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

export default MyRecipesScreen;

// @ts-nocheck - StyleSheet.create type inference issues with strict mode
const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#f5eee0',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  scrollContent: {
    paddingBottom: 120,
    alignItems: 'center',
  },
  contentContainer: {
    alignSelf: 'center',
  },
  card: {
    marginBottom: CARD_SPACING,
    padding: CARD_INTERNAL_PADDING,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  recipeCard: {
    paddingHorizontal: CARD_INTERNAL_PADDING,
    paddingVertical: CARD_INTERNAL_PADDING,
  },
  imageHeader: {
    marginTop: -CARD_INTERNAL_PADDING,
    marginHorizontal: -CARD_INTERNAL_PADDING,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  imageHeaderImg: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: isCompact ? 180 : 220,
  },
  imageHeaderPlaceholder: {
    backgroundColor: 'rgba(142,78,198,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageHeaderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  imageHeaderBadges: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  imageHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  imageHeaderWarn: {
    backgroundColor: 'rgba(255,87,87,0.7)',
  },
  imageHeaderBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingWrapper: {
    marginTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '500',
  },
  emptyStateBody: {
    alignItems: 'center',
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    lineHeight: 26,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    color: '#7D5A50',
    lineHeight: 22,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
    flex: 1,
    lineHeight: 24,
    paddingRight: 12,
    paddingLeft: 8,
  },
  catalogDescription: {
    fontSize: 15,
    color: '#7D5A50',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 22,
    paddingHorizontal: 2,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
  },
  catalogTextColumn: {
    marginTop: 12,
    flex: 1,
    minWidth: 0,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  statText: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: PRIMARY,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(231,76,60,0.9)',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recipeModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  recipeModalCard: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  createModalCard: {
    maxHeight: '96%',
    paddingBottom: 48,
  },
  recipeModalHandle: {
    width: 56,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  recipeModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recipeModalHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeModalHeaderSpacer: {
    width: 44,
    height: 44,
  },
  recipeModalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  recipeModalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  recipeModalHeaderSubtitle: {
    fontSize: 13,
    color: '#A8978E',
    marginTop: 4,
  },
  formContent: {
    paddingBottom: 48,
    paddingHorizontal: 4,
    gap: 24,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
  },
  formInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    color: '#7D5A50',
  },
  formMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  formInstructions: {
    minHeight: 120,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  formRowItem: {
    flex: 1,
    gap: 8,
  },
  formRowInput: {
    flex: 1,
  },
  formAddButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formChipHint: {
    fontSize: 13,
    color: 'rgba(125,90,80,0.7)',
    fontWeight: '500',
  },
  formChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: PRIMARY,
  },
  formChipText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  formAllergenChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.25)',
  },
  formAllergenSelected: {
    backgroundColor: 'rgba(142,78,198,0.22)',
    borderColor: 'rgba(142,78,198,0.4)',
  },
  formAllergenLabel: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '600',
  },
  formAllergenLabelSelected: {
    color: PRIMARY,
  },
  formImagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderColor: 'rgba(125,90,80,0.2)',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  formImagePickerText: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '600',
  },
  formImagePreviewWrapper: {
    gap: 8,
  },
  formImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 20,
  },
  formImageRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(142,78,198,0.6)',
  },
  formImageRemoveText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  formActionButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  formCancelButton: {
    backgroundColor: 'rgba(125,90,80,0.15)',
  },
  formSubmitButton: {
    backgroundColor: PRIMARY,
  },
  formCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7D5A50',
  },
  formSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

