import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { GLASS_BORDER, GLASS_OVERLAY, LiquidGlassCard, PRIMARY, GRID_GAP } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createRecipe, fetchRecipes, RecipeRecord } from '@/lib/recipes';
import { getSampleRecipeImage, RECIPE_SAMPLES, RecipeSample } from '@/lib/recipes-samples';
import { isUserAdmin } from '@/lib/supabase/recommendations';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';

type AllergenId = 'milk' | 'gluten' | 'egg' | 'nuts' | 'fish';

const RECIPE_AGE_LIMITS = { min: 4, max: 24 };
const FILTER_AGE_LIMITS = { min: 0, max: 24 };
const clampFilterAgeMonths = (value: number) =>
  Math.max(FILTER_AGE_LIMITS.min, Math.min(FILTER_AGE_LIMITS.max, value));
const clampRecipeAgeMonths = (value: number) =>
  Math.max(RECIPE_AGE_LIMITS.min, Math.min(RECIPE_AGE_LIMITS.max, value));

const ALLERGEN_OPTIONS: { id: AllergenId; label: string; hint: string }[] = [
  { id: 'milk', label: 'Milchprodukte', hint: 'Joghurt, Käse, Butter' },
  { id: 'gluten', label: 'Gluten', hint: 'Hafer, Weizen, Brot' },
  { id: 'egg', label: 'Ei', hint: 'Rührei, Gebäck' },
  { id: 'nuts', label: 'Nüsse', hint: 'Erdnuss, Mandel, Haselnuss' },
  { id: 'fish', label: 'Fisch', hint: 'Lachs, Forelle' },
];

const ALLERGEN_LABELS: Record<AllergenId, string> = {
  milk: 'Milchprodukte',
  gluten: 'Gluten',
  egg: 'Ei',
  nuts: 'Nüsse',
  fish: 'Fisch',
};

// Layout-System mit maximaler Content-Breite
const { width: screenWidth } = Dimensions.get('window');
const SCREEN_PADDING = 4; // Minimales Außen-Padding
const contentWidth = screenWidth - 2 * SCREEN_PADDING; // Maximale Breite
const isCompact = screenWidth < 380;

const CARD_INTERNAL_PADDING = 20; // Sehr kompakter Abstand zum Rand
const CARD_SPACING = 4; // Ultra minimaler Abstand zwischen Cards
const ALLERGEN_COLUMNS = 2; // Immer 2 Buttons pro Reihe

const chunkItems = <T,>(items: T[], columns: number): (T | null)[][] => {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && lastRow.length < columns) {
      const padded = [...lastRow];
      while (padded.length < columns) {
        padded.push(null);
      }
      rows[rows.length - 1] = padded;
    }
  }
  return rows;
};

const SAMPLE_RECIPES: RecipeSample[] = RECIPE_SAMPLES;

const formatAllergens = (allergens: string[] = []) =>
  allergens.map((id) => ALLERGEN_LABELS[id as AllergenId] ?? id).join(', ');

type InstructionStep = {
  number: string;
  text: string;
};

const parseInstructionSteps = (value: string) => {
  if (!value) return null;
  const stepRegex = /(?:^|\n)\s*(\d+)\.\s*/g;
  const matches = Array.from(value.matchAll(stepRegex));
  if (matches.length < 2 || matches[0]?.[1] !== '1') {
    return null;
  }
  const steps: InstructionStep[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match) continue;
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex =
      i + 1 < matches.length ? matches[i + 1]?.index ?? value.length : value.length;
    const rawStep = value.slice(startIndex, endIndex).trim();
    if (!rawStep) continue;
    const cleanedStep = rawStep.replace(/\n[ \t]+/g, '\n').trim();
    steps.push({ number: match[1] ?? `${i + 1}`, text: cleanedStep });
  }
  if (steps.length === 0) return null;
  const intro = value.slice(0, matches[0]?.index ?? 0).trim();
  return { intro, steps };
};

const RecipeGeneratorScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { activeBaby, activeBabyId } = useActiveBaby();

  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ageMonths, setAgeMonths] = useState<number>(FILTER_AGE_LIMITS.min);
  const [selectedAllergies, setSelectedAllergies] = useState<AllergenId[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newTip, setNewTip] = useState('');
  const [newMinMonths, setNewMinMonths] = useState('6');
  const [newIngredients, setNewIngredients] = useState<string[]>([]);
  const [newIngredientInput, setNewIngredientInput] = useState('');
  const [newAllergens, setNewAllergens] = useState<AllergenId[]>([]);
  const [newImage, setNewImage] = useState<string | null>(null);

  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      if (a.min_months === b.min_months) {
        return a.title.localeCompare(b.title, 'de');
      }
      return a.min_months - b.min_months;
    });
  }, [recipes]);

  const blockedRecipeCount = useMemo(() => {
    if (selectedAllergies.length === 0) return 0;
    const allergySet = new Set(selectedAllergies);
    return recipes.reduce((count, recipe) => {
      const hasConflictingAllergen = recipe.allergens.some((item) =>
        allergySet.has(item as AllergenId)
      );
      return hasConflictingAllergen ? count + 1 : count;
    }, 0);
  }, [selectedAllergies, recipes]);

  const selectedRecipeImageUrl = selectedRecipe
    ? selectedRecipe.image_url ?? getSampleRecipeImage(selectedRecipe.title)
    : null;
  const instructionParts = selectedRecipe?.instructions
    ? parseInstructionSteps(selectedRecipe.instructions)
    : null;

  const loadRecipes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await fetchRecipes();
      if (error) throw error;
      setRecipes(data);
    } catch (error) {
      console.error('Error loading recipes:', error);
      Alert.alert(
        'Fehler beim Laden',
        'Die Rezepte konnten nicht geladen werden. Bitte versuche es später erneut.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Berechne das Alter des aktiven Babys in Monaten
  useEffect(() => {
    if (activeBaby?.birth_date) {
      const birthDate = new Date(activeBaby.birth_date);
      if (!Number.isNaN(birthDate.getTime())) {
        const today = new Date();
        const months = Math.floor(
          (today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        );
        const calculatedAge = Math.max(0, months);
        setAgeMonths(clampFilterAgeMonths(calculatedAge));
        return;
      }
    }
    // Fallback auf 0 wenn kein Geburtsdatum vorhanden
    setAgeMonths(FILTER_AGE_LIMITS.min);
  }, [activeBabyId, activeBaby?.birth_date]);

  useEffect(() => {
    let isMounted = true;
    const checkAdminStatus = async () => {
      const adminStatus = await isUserAdmin();
      if (isMounted) {
        setIsAdmin(adminStatus);
      }
    };
    checkAdminStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewInstructions('');
    setNewTip('');
    setNewMinMonths('6');
    setNewIngredients([]);
    setNewIngredientInput('');
    setNewAllergens([]);
    setNewImage(null);
  };

  const toggleAllergy = (allergen: AllergenId) => {
    setSelectedAllergies((prev) =>
      prev.includes(allergen) ? prev.filter((item) => item !== allergen) : [...prev, allergen]
    );
  };

  const allergenRows = useMemo(
    () => chunkItems(ALLERGEN_OPTIONS, ALLERGEN_COLUMNS),
    []
  );

  const handleAgeChange = (delta: number) => {
    setAgeMonths((prev) => {
      const next = prev + delta;
      return clampFilterAgeMonths(next);
    });
  };

  const addIngredientToForm = () => {
    const trimmed = newIngredientInput.trim();
    if (!trimmed) return;
    setNewIngredients((prev) => {
      if (prev.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
    setNewIngredientInput('');
  };

  const removeIngredientFromForm = (ingredient: string) => {
    setNewIngredients((prev) => prev.filter((item) => item !== ingredient));
  };

  const toggleNewAllergen = (allergen: AllergenId) => {
    setNewAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((item) => item !== allergen) : [...prev, allergen]
    );
  };

  const pickRecipeImage = async () => {
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
          setNewImage(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          setNewImage(base64Data);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Das Bild konnte nicht ausgewählt werden.');
    }
  };

  const handleCreateRecipe = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Rezepttitel ein.');
      return;
    }

    if (newIngredients.length === 0) {
      Alert.alert('Hinweis', 'Bitte füge mindestens eine Zutat hinzu.');
      return;
    }

    if (!newInstructions.trim()) {
      Alert.alert('Hinweis', 'Beschreibe kurz die Zubereitung.');
      return;
    }

    const months = clampRecipeAgeMonths(
      Number.parseInt(newMinMonths, 10) || RECIPE_AGE_LIMITS.min
    );

    try {
      setIsSubmitting(true);
      const { data, error } = await createRecipe(
        {
          title: newTitle,
          description: newDescription || null,
          min_months: months,
          ingredients: newIngredients,
          allergens: newAllergens,
          instructions: newInstructions,
          tip: newTip || null,
        },
        newImage ?? undefined
      );

      if (error) {
        throw error;
      }

      if (data) {
        setRecipes((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
      } else {
        await loadRecipes();
      }

      resetCreateForm();
      setShowCreateModal(false);
      Alert.alert('Erfolg', 'Dein Rezept wurde gespeichert.');
    } catch (error) {
      console.error('Error creating recipe:', error);
      const message =
        error instanceof Error ? error.message : 'Beim Speichern ist ein Fehler aufgetreten.';
      Alert.alert('Fehler', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const seedSampleRecipes = async () => {
    try {
      setIsSeeding(true);
      const existingTitles = new Set(recipes.map((recipe) => recipe.title.toLowerCase()));
      let inserted = 0;

      for (const sample of SAMPLE_RECIPES) {
        if (existingTitles.has(sample.title.toLowerCase())) {
          continue;
        }

        const { error } = await createRecipe(
          {
            title: sample.title,
            description: sample.description,
            min_months: sample.min_months,
            ingredients: sample.ingredients,
            allergens: sample.allergens ?? [],
            instructions: sample.instructions,
            tip: sample.tip ?? null,
          },
          undefined
        );

        if (!error) {
          inserted += 1;
          existingTitles.add(sample.title.toLowerCase());
        } else {
          console.warn('Konnte Beispielrezept nicht erstellen:', sample.title, error);
        }
      }

      await loadRecipes();

      Alert.alert(
        'Rezepte importiert',
        inserted > 0
          ? `${inserted} Standardrezepte wurden hinzugefügt.`
          : 'Alle Standardrezepte sind bereits vorhanden.'
      );
    } catch (error) {
      console.error('Error seeding recipes:', error);
      Alert.alert('Fehler', 'Standardrezepte konnten nicht importiert werden.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
          <View style={styles.overlayContainer}>
            <Header
              title='BLW-Rezepte'
              subtitle='Filter nach Alter & Allergien'
              showBackButton
              onBackPress={() => router.back()}
            />
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => router.push('/my-recipes')}
              >
                <IconSymbol name='book.fill' size={22} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.contentContainer, { width: contentWidth }]}>
              {/* Hero Card */}
              <LiquidGlassCard
                style={[styles.card, styles.topCard]}
                intensity={28}
                overlayColor='rgba(255,255,255,0.22)'
                borderColor='rgba(255,255,255,0.35)'
              >
              <View style={styles.heroRow}>
                <View style={styles.heroIcon}>
                  <IconSymbol name='checklist' size={26} color={PRIMARY} />
                </View>
                <View style={styles.heroTextWrap}>
                  <ThemedText style={styles.heroTitle}>Rezepte für kleine Entdecker</ThemedText>
                  <ThemedText style={styles.heroSubtitle}>
                    Stell Alter und Allergien ein – wir zeigen passende Rezepte.
                  </ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            <View style={styles.quickActionRow}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => {
                  resetCreateForm();
                  setShowCreateModal(true);
                }}
                activeOpacity={0.85}
              >
                <BlurView intensity={24} tint='light' style={StyleSheet.absoluteFillObject} />
                <View style={styles.quickActionOverlay} />
                <View style={styles.quickActionContent}>
                  <View style={styles.quickActionIcon}>
                    <IconSymbol name='plus' size={20} color={PRIMARY} />
                  </View>
                  <ThemedText style={styles.quickActionLabel}>Rezept</ThemedText>
                  <ThemedText style={styles.quickActionMeta}>Erstellen</ThemedText>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => setShowAgeModal(true)}
                activeOpacity={0.85}
              >
                <BlurView intensity={24} tint='light' style={StyleSheet.absoluteFillObject} />
                <View style={styles.quickActionOverlay} />
                <View style={styles.quickActionContent}>
                  <View style={styles.quickActionIcon}>
                    <IconSymbol name='calendar' size={20} color={PRIMARY} />
                  </View>
                  <ThemedText style={styles.quickActionLabel}>Baby-Alter</ThemedText>
                  <ThemedText style={styles.quickActionMeta}>{ageMonths} Monate</ThemedText>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  selectedAllergies.length > 0 && styles.quickActionButtonActive,
                ]}
                onPress={() => setShowAllergyModal(true)}
                activeOpacity={0.85}
              >
                <BlurView intensity={24} tint='light' style={StyleSheet.absoluteFillObject} />
                <View
                  style={[
                    styles.quickActionOverlay,
                    selectedAllergies.length > 0 && styles.quickActionOverlayActive,
                  ]}
                />
                <View style={styles.quickActionContent}>
                  <View style={styles.quickActionIcon}>
                    <IconSymbol name='exclamationmark.triangle.fill' size={18} color={PRIMARY} />
                    {selectedAllergies.length > 0 && (
                      <View style={styles.quickActionBadge}>
                        <ThemedText style={styles.quickActionBadgeText}>
                          {selectedAllergies.length}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.quickActionLabel}>Allergien</ThemedText>
                  <ThemedText style={styles.quickActionMeta}>
                    {selectedAllergies.length > 0 ? 'Aktiv' : 'Keine'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </View>

            {/* Loading State */}
            {isLoading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size='large' color={PRIMARY} />
                <ThemedText style={styles.loadingText}>Rezepte werden geladen ...</ThemedText>
              </View>
            ) : (
              <>
                {/* All Recipes Catalog */}
                <View style={styles.catalogHeader}>
                  <ThemedText style={styles.catalogTitle}>Alle Rezepte</ThemedText>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={loadRecipes}
                    activeOpacity={0.85}
                  >
                    <IconSymbol name='arrow.clockwise' size={16} color={PRIMARY} />
                    <ThemedText style={styles.refreshLabel}>Aktualisieren</ThemedText>
                  </TouchableOpacity>
                </View>

                {sortedRecipes.length === 0 ? (
                  <LiquidGlassCard
                    style={styles.card}
                    intensity={24}
                    overlayColor='rgba(255,255,255,0.2)'
                    borderColor='rgba(255,255,255,0.32)'
                  >
                    <View style={styles.emptyStateBody}>
                      <IconSymbol name='sparkles' size={24} color={PRIMARY} />
                      <ThemedText style={styles.emptyStateTitle}>
                        Noch keine Supabase-Rezepte
                      </ThemedText>
                      <ThemedText style={styles.emptyStateText}>
                        Leg direkt los und füge euer erstes Lieblingsrezept hinzu!
                      </ThemedText>
                      <TouchableOpacity
                        style={[styles.seedButton, isSeeding && styles.seedButtonDisabled]}
                        onPress={seedSampleRecipes}
                        activeOpacity={0.85}
                        disabled={isSeeding}
                      >
                        {isSeeding ? (
                          <ActivityIndicator color='#FFFFFF' />
                        ) : (
                          <>
                            <IconSymbol name='tray.and.arrow.down.fill' size={18} color='#FFFFFF' />
                            <ThemedText style={styles.seedButtonText}>
                              Standardrezepte importieren
                            </ThemedText>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </LiquidGlassCard>
                ) : (
                  sortedRecipes.map((recipe) => {
                    const isFilteredOut = selectedAllergies.some((allergen) =>
                      recipe.allergens.includes(allergen)
                    );
                    const meetsAge = ageMonths >= recipe.min_months;
                    const imageUrl = recipe.image_url ?? getSampleRecipeImage(recipe.title);

                    if (!meetsAge || isFilteredOut) {
                      return (
                        <LiquidGlassCard
                          key={recipe.id}
                          style={[styles.card, styles.recipeCard, styles.disabledRecipeCard]}
                          intensity={20}
                          overlayColor='rgba(200,200,200,0.2)'
                          borderColor='rgba(255,255,255,0.25)'
                        >
                          <View style={styles.recipeHeader}>
                            <ThemedText style={[styles.recipeTitle, styles.disabledRecipeTitle]}>
                              {recipe.title}
                            </ThemedText>
                            <View style={[styles.ageTag, styles.disabledAgeTag]}>
                              <IconSymbol name='clock' size={16} color='#FFFFFF' />
                              <ThemedText style={styles.ageTagText}>
                                ab {recipe.min_months} M
                              </ThemedText>
                            </View>
                          </View>
                          <ThemedText style={styles.disabledNotice}>
                            Dieses Rezept ist aktuell ausgeblendet (Filter aktiv).
                          </ThemedText>
                        </LiquidGlassCard>
                      );
                    }

                    return (
                      <LiquidGlassCard
                        key={recipe.id}
                        style={[styles.card, styles.recipeCard]}
                        intensity={24}
                        overlayColor='rgba(255,255,255,0.2)'
                        borderColor='rgba(255,255,255,0.35)'
                        onPress={() => setSelectedRecipe(recipe)}
                        activeOpacity={0.88}
                      >
                        <View style={styles.imageHeader}>
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
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
                                  {formatAllergens(recipe.allergens)}
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
                            {recipe.description ?? 'Leckeres BLW-Gericht – tippe für Details.'}
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
                      </LiquidGlassCard>
                    );
                  })
                )}
              </>
            )}

            {/* Allergie Notice */}
            {blockedRecipeCount > 0 && (
              <LiquidGlassCard
                style={styles.card}
                intensity={22}
                overlayColor='rgba(255,255,255,0.18)'
                borderColor='rgba(255,255,255,0.28)'
              >
                <ThemedText style={styles.noticeTitle}>Allergie-Filter aktiv</ThemedText>
                <ThemedText style={styles.noticeText}>
                  Wir haben {blockedRecipeCount} Rezepte ausgeblendet.
                </ThemedText>
              </LiquidGlassCard>
            )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <Modal
          visible={!!selectedRecipe}
          transparent
          animationType='slide'
          onRequestClose={() => setSelectedRecipe(null)}
        >
          <View style={styles.recipeModalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setSelectedRecipe(null)}
              activeOpacity={1}
            />
            <BlurView
              style={styles.recipeModalCard}
              intensity={90}
              tint={colorScheme === 'dark' ? 'dark' : 'extraLight'}
            >
              <View style={styles.recipeModalHandle} />
              <View style={styles.recipeModalHeaderRow}>
                <TouchableOpacity
                  style={styles.recipeModalHeaderButton}
                  onPress={() => setSelectedRecipe(null)}
                  activeOpacity={0.85}
                >
                  <IconSymbol name='xmark' size={18} color='#7D5A50' />
                </TouchableOpacity>
                <View style={styles.recipeModalHeaderCenter}>
                  <ThemedText style={styles.recipeModalHeaderTitle}>Rezept ansehen</ThemedText>
                  <ThemedText style={styles.recipeModalHeaderSubtitle}>
                    Ab {selectedRecipe.min_months} Monaten
                  </ThemedText>
                </View>
                <View style={styles.recipeModalHeaderSpacer} />
              </View>
              <ScrollView
                contentContainerStyle={styles.recipeModalScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.recipeHeroCard}>
                  {selectedRecipeImageUrl ? (
                    <>
                      <Image
                        source={{ uri: selectedRecipeImageUrl }}
                        style={StyleSheet.absoluteFill}
                        resizeMode='cover'
                      />
                      <View style={styles.recipeHeroTint} />
                    </>
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.recipeHeroSolid]} />
                  )}
                  <View style={styles.recipeHeroContent}>
                    <ThemedText style={styles.recipeHeroTitle} numberOfLines={2}>
                      {selectedRecipe.title}
                    </ThemedText>
                    <View style={styles.recipeHeroChipRow}>
                      <View style={styles.recipeHeroChip}>
                        <IconSymbol name='clock' size={14} color='#FFFFFF' />
                        <ThemedText style={styles.recipeHeroChipText}>
                          ab {selectedRecipe.min_months} M
                        </ThemedText>
                      </View>
                      {selectedRecipe.allergens.length > 0 && (
                        <View style={[styles.recipeHeroChip, styles.recipeHeroChipWarn]}>
                          <IconSymbol name='exclamationmark.triangle.fill' size={14} color='#FFFFFF' />
                          <ThemedText style={styles.recipeHeroChipText}>
                            {formatAllergens(selectedRecipe.allergens)}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {selectedRecipe.description ? (
                  <ThemedText style={styles.recipeModalDescription}>
                    {selectedRecipe.description}
                  </ThemedText>
                ) : null}

                <View style={styles.recipeInfoChipsRow}>
                  <View style={styles.recipeInfoChip}>
                    <IconSymbol name='checklist' size={16} color={PRIMARY} />
                    <ThemedText style={styles.recipeInfoChipText}>
                      {selectedRecipe.ingredients.length} Zutaten
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.recipeInfoChip,
                      selectedRecipe.allergens.length === 0 && styles.recipeInfoChipSafe,
                    ]}
                  >
                    <IconSymbol
                      name={
                        selectedRecipe.allergens.length > 0
                          ? 'exclamationmark.triangle.fill'
                          : 'sparkles'
                      }
                      size={16}
                      color={selectedRecipe.allergens.length > 0 ? '#FFFFFF' : PRIMARY}
                    />
                    <ThemedText
                      style={[
                        styles.recipeInfoChipText,
                        selectedRecipe.allergens.length === 0 && styles.recipeInfoChipTextSafe,
                      ]}
                    >
                      {selectedRecipe.allergens.length > 0
                        ? formatAllergens(selectedRecipe.allergens)
                        : 'Allergiefreundlich'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.recipeSectionCard}>
                  <ThemedText style={styles.recipeSectionTitle}>Zutaten</ThemedText>
                  {selectedRecipe.ingredients.map((ingredient) => (
                    <View key={ingredient} style={styles.recipeIngredientRow}>
                      <View style={styles.recipeIngredientDot} />
                      <ThemedText style={styles.recipeIngredientText}>{ingredient}</ThemedText>
                    </View>
                  ))}
                </View>

                {selectedRecipe.instructions ? (
                  <View style={styles.recipeSectionCard}>
                    <ThemedText style={styles.recipeSectionTitle}>Anleitung</ThemedText>
                    {instructionParts ? (
                      <>
                        {instructionParts.intro ? (
                          <ThemedText
                            style={[styles.recipeInstructions, styles.recipeInstructionsIntro]}
                          >
                            {instructionParts.intro}
                          </ThemedText>
                        ) : null}
                        <View style={styles.recipeSteps}>
                          {instructionParts.steps.map((step, index) => (
                            <View
                              key={`step-${step.number}-${index}`}
                              style={styles.recipeStepRow}
                            >
                              <View style={styles.recipeStepBadge}>
                                <ThemedText style={styles.recipeStepBadgeText}>
                                  {step.number}
                                </ThemedText>
                              </View>
                              <ThemedText style={styles.recipeStepText}>
                                {step.text}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : (
                      <ThemedText style={styles.recipeInstructions}>
                        {selectedRecipe.instructions}
                      </ThemedText>
                    )}
                  </View>
                ) : null}

                {selectedRecipe.tip ? (
                  <View style={[styles.recipeSectionCard, styles.recipeTipCard]}>
                    <IconSymbol name='lightbulb.fill' size={18} color={PRIMARY} />
                    <ThemedText style={styles.recipeTipText}>{selectedRecipe.tip}</ThemedText>
                  </View>
                ) : null}

                <ThemedText style={styles.recipeDisclaimer}>
                  Hinweis: Die Rezepte sind allgemeine Empfehlungen und ersetzen keine medizinische
                  Beratung. Achte auf altersgerechte Konsistenz, Erstickungsgefahr und individuelle
                  Allergien. Bei Unsicherheiten sprich mit Kinderarzt oder Hebamme.
                </ThemedText>
              </ScrollView>
            </BlurView>
          </View>
        </Modal>
      )}

      {/* Baby Age Modal */}
      <Modal
        visible={showAgeModal}
        transparent
        animationType='slide'
        onRequestClose={() => setShowAgeModal(false)}
      >
        <View style={styles.recipeModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowAgeModal(false)}
            activeOpacity={1}
          />
          <BlurView
            style={[styles.recipeModalCard, styles.filterModalCard]}
            intensity={90}
            tint={colorScheme === 'dark' ? 'dark' : 'extraLight'}
          >
            <View style={styles.recipeModalHandle} />
            <View style={styles.recipeModalHeaderRow}>
              <TouchableOpacity
                style={styles.recipeModalHeaderButton}
                onPress={() => setShowAgeModal(false)}
                activeOpacity={0.85}
              >
                <IconSymbol name='xmark' size={18} color='#7D5A50' />
              </TouchableOpacity>
              <View style={styles.recipeModalHeaderCenter}>
                <ThemedText style={styles.recipeModalHeaderTitle}>Baby-Alter</ThemedText>
                <ThemedText style={styles.recipeModalHeaderSubtitle}>
                  Filter auf {ageMonths} Monate
                </ThemedText>
              </View>
              <View style={styles.recipeModalHeaderSpacer} />
            </View>
            <View style={styles.filterModalContent}>
              <View style={styles.sectionHeader}>
                <IconSymbol name='calendar' size={22} color={PRIMARY} />
                <ThemedText style={styles.sectionTitle}>Baby-Alter</ThemedText>
              </View>
              <ThemedText style={styles.sectionHint}>
                Wir filtern alle Rezepte passend zu {ageMonths} Monaten.
              </ThemedText>
              <View style={styles.ageControlRow}>
                <TouchableOpacity
                  style={styles.ageButton}
                  onPress={() => handleAgeChange(-1)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.ageButtonText}>-</ThemedText>
                </TouchableOpacity>
                <View style={styles.ageBadge}>
                  <ThemedText style={styles.ageValue}>{ageMonths}</ThemedText>
                  <ThemedText style={styles.ageLabel}>Monate</ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.ageButton}
                  onPress={() => handleAgeChange(1)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.ageButtonText}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Allergy Filter Modal */}
      <Modal
        visible={showAllergyModal}
        transparent
        animationType='slide'
        onRequestClose={() => setShowAllergyModal(false)}
      >
        <View style={styles.recipeModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowAllergyModal(false)}
            activeOpacity={1}
          />
          <BlurView
            style={[styles.recipeModalCard, styles.filterModalCard]}
            intensity={90}
            tint={colorScheme === 'dark' ? 'dark' : 'extraLight'}
          >
            <View style={styles.recipeModalHandle} />
            <View style={styles.recipeModalHeaderRow}>
              <TouchableOpacity
                style={styles.recipeModalHeaderButton}
                onPress={() => setShowAllergyModal(false)}
                activeOpacity={0.85}
              >
                <IconSymbol name='xmark' size={18} color='#7D5A50' />
              </TouchableOpacity>
              <View style={styles.recipeModalHeaderCenter}>
                <ThemedText style={styles.recipeModalHeaderTitle}>
                  Allergien berücksichtigen
                </ThemedText>
                <ThemedText style={styles.recipeModalHeaderSubtitle}>
                  Markiere, was ihr aktuell meidet
                </ThemedText>
              </View>
              <View style={styles.recipeModalHeaderSpacer} />
            </View>
            <ScrollView
              contentContainerStyle={styles.filterModalScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionHeader}>
                <IconSymbol name='info.circle.fill' size={22} color={PRIMARY} />
                <ThemedText style={styles.sectionTitle}>Allergien berücksichtigen</ThemedText>
              </View>
              <ThemedText style={styles.sectionHint}>
                Markiere, was ihr aktuell meidet.
              </ThemedText>
              <View style={styles.chipGrid}>
                {allergenRows.map((row, rowIndex, rows) => (
                  <View
                    key={`allergen-row-${rowIndex}`}
                    style={[
                      styles.gridRow,
                      rowIndex === rows.length - 1 && styles.gridRowLast,
                    ]}
                  >
                    {row.map((option, colIndex) => {
                      if (!option) {
                        return (
                          <View
                            key={`allergen-placeholder-${rowIndex}-${colIndex}`}
                            style={[
                              styles.gridItem,
                              colIndex === 0 && styles.gridItemLeft,
                            ]}
                          />
                        );
                      }
                      const isSelected = selectedAllergies.includes(option.id);
                      return (
                        <View
                          key={option.id}
                          style={[
                            styles.gridItem,
                            colIndex === 0 && styles.gridItemLeft,
                          ]}
                        >
                          <TouchableOpacity
                            style={[styles.chip, isSelected && styles.chipSelected]}
                            onPress={() => toggleAllergy(option.id)}
                            activeOpacity={0.85}
                          >
                            <ThemedText
                              style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}
                            >
                              {option.label}
                            </ThemedText>
                            <ThemedText style={styles.chipHint}>{option.hint}</ThemedText>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* Create Recipe Modal */}
      <Modal
        visible={showCreateModal}
        animationType='slide'
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.recipeModalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowCreateModal(false)}
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
                onPress={() => {
                  resetCreateForm();
                  setShowCreateModal(false);
                }}
                activeOpacity={0.85}
              >
                <IconSymbol name='xmark' size={18} color='#7D5A50' />
              </TouchableOpacity>
              <View style={styles.recipeModalHeaderCenter}>
                <ThemedText style={styles.recipeModalHeaderTitle}>Neues Rezept</ThemedText>
                <ThemedText style={styles.recipeModalHeaderSubtitle}>
                  Teile euer Lieblingsgericht
                </ThemedText>
              </View>
              <View style={styles.recipeModalHeaderSpacer} />
            </View>
            <ScrollView
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={styles.formHint}>
                Beschreibe kurz das Gericht, Zutaten, Allergene und optional ein Foto.
              </ThemedText>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Titel</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder='z. B. Cremige Kürbis-Pasta'
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholderTextColor='rgba(0,0,0,0.35)'
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Kurzbeschreibung</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.formMultiline]}
                  placeholder='Was macht das Rezept besonders?'
                  value={newDescription}
                  onChangeText={setNewDescription}
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
                    placeholder={`${RECIPE_AGE_LIMITS.min}-${RECIPE_AGE_LIMITS.max}`}
                    value={newMinMonths}
                    onChangeText={(text) => setNewMinMonths(text.replace(/[^0-9]/g, ''))}
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
                    value={newTip}
                    onChangeText={setNewTip}
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
                    value={newIngredientInput}
                    onChangeText={setNewIngredientInput}
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
                  {newIngredients.length === 0 ? (
                    <ThemedText style={styles.formChipHint}>
                      Noch keine Zutaten hinzugefügt.
                    </ThemedText>
                  ) : (
                    newIngredients.map((ingredient) => (
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
                    const isSelected = newAllergens.includes(option.id);
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.formAllergenChip, isSelected && styles.formAllergenSelected]}
                        onPress={() => toggleNewAllergen(option.id)}
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
                  value={newInstructions}
                  onChangeText={setNewInstructions}
                  multiline
                  numberOfLines={5}
                  placeholderTextColor='rgba(0,0,0,0.35)'
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Bild (optional)</ThemedText>
                {newImage ? (
                  <View style={styles.formImagePreviewWrapper}>
                    <Image source={{ uri: newImage }} style={styles.formImagePreview} />
                    <TouchableOpacity
                      style={styles.formImageRemove}
                      onPress={() => setNewImage(null)}
                      activeOpacity={0.85}
                    >
                      <IconSymbol name='trash' size={18} color='#FFFFFF' />
                      <ThemedText style={styles.formImageRemoveText}>Entfernen</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.formImagePicker}
                    onPress={pickRecipeImage}
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
                  onPress={() => {
                    resetCreateForm();
                    setShowCreateModal(false);
                  }}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  <ThemedText style={styles.formCancelText}>Abbrechen</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formSubmitButton]}
                  onPress={handleCreateRecipe}
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

export default RecipeGeneratorScreen;

// @ts-nocheck - StyleSheet.create type inference issues with strict mode
const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#f5eee0',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING, // Minimales Padding für maximale Breite
  },
  overlayContainer: {
    width: '100%',
    position: 'relative',
  },
  headerActions: {
    position: 'absolute',
    top: 12,
    right: 60, // Verschoben nach links, um Platz für den BabySwitcherButton zu lassen
    flexDirection: 'row',
    gap: 10,
    zIndex: 10,
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  scrollContent: {
    paddingBottom: 100,
    alignItems: 'center',
  },
  contentContainer: {
    alignSelf: 'center',
  },
  // JEDE Card verwendet diesen Style - garantiert einheitliche Breite
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
  topCard: {
    marginBottom: CARD_SPACING,
  },
  recipeCard: {
    // Gleiche Breite wie normale Cards - Padding wird durch innere Elemente erreicht
    paddingHorizontal: CARD_INTERNAL_PADDING, // 32px - gleiche Breite wie andere Cards
    paddingVertical: CARD_INTERNAL_PADDING, // 32px
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
  // Hero Section
  heroRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(142,78,198,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    alignItems: 'center',
    gap: 4,
  },
  heroTitle: {
    fontSize: 24, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    lineHeight: 22,
    textAlign: 'center',
  },
  // Action Section
  actionCard: {
    paddingHorizontal: CARD_INTERNAL_PADDING + 8,
    paddingVertical: CARD_INTERNAL_PADDING + 6,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(94,61,179,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginVertical: 4,
  },
  actionTextWrap: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
    lineHeight: 24,
  },
  actionChevron: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(94,61,179,0.12)',
    marginRight: 6,
    marginVertical: 4,
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    position: 'relative',
  },
  quickActionButtonActive: {
    borderColor: 'rgba(142,78,198,0.5)',
  },
  quickActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS_OVERLAY,
  },
  quickActionOverlayActive: {
    backgroundColor: 'rgba(142,78,198,0.16)',
  },
  quickActionContent: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
  },
  quickActionMeta: {
    fontSize: 12,
    color: '#7D5A50',
    marginTop: 2,
    fontWeight: '500',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '600',
    color: '#7D5A50',
    letterSpacing: -0.2,
    textAlign: 'center',
    lineHeight: 26,
  },
  sectionHint: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    marginBottom: 8,
    lineHeight: 22,
    textAlign: 'center',
  },
  ageControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(142,78,198,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: PRIMARY,
  },
  ageBadge: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(142,78,198,0.12)',
  },
  ageValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7D5A50',
    fontVariant: ['tabular-nums'],
  },
  ageLabel: {
    fontSize: 12,
    color: '#7D5A50',
    fontWeight: '500',
  },
  chipGrid: {
    paddingHorizontal: GRID_GAP,
    paddingTop: GRID_GAP,
    paddingBottom: GRID_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: GRID_GAP,
  },
  gridRowLast: {
    marginBottom: 0,
  },
  gridItem: {
    flex: 1,
  },
  gridItemLeft: {
    marginRight: GRID_GAP,
  },
  chip: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipSelected: {
    backgroundColor: 'rgba(142,78,198,0.22)',
  },
  chipLabel: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    fontWeight: '600',
    color: '#7D5A50',
  },
  chipLabelSelected: {
    color: PRIMARY,
  },
  chipHint: {
    fontSize: 13, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 18,
  },
  filterModalCard: {
    maxHeight: '80%',
  },
  filterModalContent: {
    paddingHorizontal: 4,
    paddingBottom: 32,
  },
  filterModalScroll: {
    paddingHorizontal: 4,
    paddingBottom: 32,
  },
  ingredientLabel: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    fontWeight: '600',
    color: '#7D5A50',
    textAlign: 'center',
  },
  ingredientLabelSelected: {
    color: '#FFFFFF',
  },
  loadingWrapper: {
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '500',
  },
  emptyStateBody: {
    alignItems: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 20, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    lineHeight: 26,
  },
  emptyStateText: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    textAlign: 'center',
    color: '#7D5A50',
    lineHeight: 22,
  },
  seedButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: PRIMARY,
  },
  seedButtonDisabled: {
    opacity: 0.7,
  },
  seedButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Besser für mehrzeilige Titel
    marginBottom: 8,
    gap: 6,
  },
  recipeTitle: {
    fontSize: 18, // Größere Schrift für bessere Lesbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    flex: 1,
    lineHeight: 24,
    paddingRight: 6,
    paddingLeft: 2,
  },
  recipeDescription: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    lineHeight: 22,
    color: '#7D5A50',
    marginBottom: 8,
    paddingHorizontal: 2,
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
    fontSize: 14, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    fontWeight: '500',
  },
  ageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  ageTagText: {
    color: '#FFFFFF',
    fontSize: 13, // Größere Schrift für bessere Lesbarkeit
    fontWeight: '600',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 8,
    textAlign: 'center',
  },
  noticeText: {
    fontSize: 14,
    color: '#7D5A50',
    lineHeight: 20,
    textAlign: 'center',
  },
  catalogHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    gap: 6,
  },
  catalogTitle: {
    fontSize: 20, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    letterSpacing: -0.2,
    textAlign: 'center',
    lineHeight: 26,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(142,78,198,0.15)',
  },
  refreshLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  catalogTextColumn: {
    marginTop: 12,
    flex: 1,
    minWidth: 0,
  },
  catalogDescription: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 22,
    paddingHorizontal: 2,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 2,
  },
  disabledRecipeCard: {
    opacity: 0.6,
  },
  disabledRecipeTitle: {
    color: 'rgba(125,90,80,0.6)',
  },
  disabledNotice: {
    fontSize: 14,
    color: 'rgba(125,90,80,0.7)',
    lineHeight: 20,
    paddingHorizontal: 6, // Abstand vom Rand - nichts direkt am Rand
  },
  disabledAgeTag: {
    backgroundColor: 'rgba(142,78,198,0.35)',
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
  recipeModalScroll: {
    paddingBottom: 80,
  },
  recipeHeroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    minHeight: isCompact ? 220 : 260,
    backgroundColor: 'rgba(142,78,198,0.25)',
    justifyContent: 'flex-end',
  },
  recipeHeroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  recipeHeroSolid: {
    backgroundColor: 'rgba(142,78,198,0.35)',
  },
  recipeHeroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
  },
  recipeHeroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  recipeHeroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recipeHeroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  recipeHeroChipWarn: {
    backgroundColor: 'rgba(255,87,87,0.75)',
  },
  recipeHeroChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  recipeModalDescription: {
    fontSize: 15,
    color: '#7D5A50',
    lineHeight: 22,
    marginBottom: 16,
  },
  recipeInfoChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  recipeInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexGrow: 1,
  },
  recipeInfoChipSafe: {
    backgroundColor: 'rgba(142,78,198,0.18)',
  },
  recipeInfoChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
  },
  recipeInfoChipTextSafe: {
    color: PRIMARY,
  },
  recipeSectionCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginBottom: 16,
  },
  recipeSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 12,
  },
  recipeIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  recipeIngredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  recipeIngredientText: {
    fontSize: 14,
    color: '#7D5A50',
    flex: 1,
  },
  recipeInstructions: {
    fontSize: 14,
    color: '#7D5A50',
    lineHeight: 22,
  },
  recipeInstructionsIntro: {
    marginBottom: 12,
  },
  recipeSteps: {
    gap: 12,
  },
  recipeStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recipeStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    marginTop: 2,
  },
  recipeStepBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  recipeStepText: {
    flex: 1,
    fontSize: 14,
    color: '#7D5A50',
    lineHeight: 22,
  },
  recipeTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(142,78,198,0.12)',
  },
  recipeTipText: {
    flex: 1,
    fontSize: 14,
    color: '#7D5A50',
    lineHeight: 20,
  },
  recipeDisclaimer: {
    fontSize: 11,
    color: '#9C8B82',
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  createModalCard: {
    maxHeight: '96%',
    paddingBottom: 48,
  },
  formContent: {
    paddingBottom: 48,
    paddingHorizontal: 4,
    gap: 24,
  },
  formHint: {
    fontSize: 14,
    color: '#7D5A50',
    lineHeight: 20,
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
