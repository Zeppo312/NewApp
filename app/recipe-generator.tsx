import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

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
} from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';

import {
  AllergenId,
  CreateRecipePayload,
  RecipeRecord,
  createRecipe,
  fetchRecipes,
  uploadRecipeImage,
} from '@/services/recipes';

type RecipeMatch = {
  recipe: RecipeRecord;
  matchCount: number;
  missingIngredients: string[];
};

const AGE_LIMITS = { min: 4, max: 24 };

const ALLERGEN_OPTIONS: { id: AllergenId; label: string; hint: string }[] = [
  { id: 'milk', label: 'Milchprodukte', hint: 'Joghurt, Käse, Butter' },
  { id: 'gluten', label: 'Gluten', hint: 'Hafer, Weizen, Brot' },
  { id: 'egg', label: 'Ei', hint: 'Rührei, Gebäck' },
  { id: 'nuts', label: 'Nüsse', hint: 'Erdnuss, Mandel, Haselnuss' },
  { id: 'fish', label: 'Fisch', hint: 'Lachs, Forelle' },
];

const INGREDIENT_GROUPS: { key: string; label: string; items: string[] }[] = [
  {
    key: 'produce',
    label: 'Gemüse & Obst',
    items: [
      'Karotte',
      'Süßkartoffel',
      'Kürbis',
      'Brokkoli',
      'Zucchini',
      'Apfel',
      'Birne',
      'Banane',
      'Avocado',
      'Spinat',
      'Blumenkohl',
      'Mango',
      'Pfirsich',
      'Heidelbeeren',
    ],
  },
  {
    key: 'carbs',
    label: 'Getreide & Sättigendes',
    items: [
      'Haferflocken',
      'Hirse',
      'Reis',
      'Kartoffel',
      'Vollkornbrot',
      'Polenta',
      'Quinoa',
      'Vollkornnudeln',
      'Couscous',
    ],
  },
  {
    key: 'proteins',
    label: 'Proteine',
    items: [
      'Hühnchen',
      'Lachs',
      'Kichererbsen',
      'Linsen',
      'Naturjoghurt',
      'Ei',
      'Tofu',
      'Räucherlachs',
      'Bohnen',
      'Rindfleisch',
    ],
  },
  {
    key: 'extras',
    label: 'Extras & Fette',
    items: [
      'Rapsöl',
      'Olivenöl',
      'Butter',
      'Kräuter',
      'Erbsen',
      'Mais',
      'Frischkäse',
      'Kokosmilch',
      'Parmesan',
      'Sesam',
    ],
  },
  {
    key: 'spices',
    label: 'Gewürze & Extras',
    items: ['Zimt', 'Vanille', 'Petersilie', 'Basilikum', 'Zitrone', 'Limette'],
  },
];

const RecipeGeneratorScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [ageMonths, setAgeMonths] = useState<number>(8);
  const [selectedAllergies, setSelectedAllergies] = useState<AllergenId[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [recipeMatches, setRecipeMatches] = useState<RecipeMatch[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRecord | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newRecipeTitle, setNewRecipeTitle] = useState('');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');
  const [newRecipeMinMonths, setNewRecipeMinMonths] = useState(6);
  const [newRecipeIngredientsText, setNewRecipeIngredientsText] = useState('');
  const [newRecipeInstructions, setNewRecipeInstructions] = useState('');
  const [newRecipeAllergens, setNewRecipeAllergens] = useState<AllergenId[]>([]);
  const [newRecipeImage, setNewRecipeImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmittingRecipe, setIsSubmittingRecipe] = useState(false);

  const selectedIngredientSet = useMemo(() => new Set(availableIngredients), [availableIngredients]);
  const allergenLabelMap = useMemo(
    () =>
      ALLERGEN_OPTIONS.reduce<Record<AllergenId, string>>((acc, option) => {
        acc[option.id] = option.label;
        return acc;
      }, {} as Record<AllergenId, string>),
    []
  );

  const loadRecipes = useCallback(async () => {
    try {
      setListError(null);
      setIsLoading(true);
      const data = await fetchRecipes();
      setRecipes(data);
    } catch (error) {
      console.error('Failed to load recipes', error);
      setListError('Rezepte konnten nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRecipes();
    setIsRefreshing(false);
  }, [loadRecipes]);

  const toggleAllergy = (allergen: AllergenId) => {
    setSelectedAllergies((prev) =>
      prev.includes(allergen) ? prev.filter((item) => item !== allergen) : [...prev, allergen]
    );
  };

  const toggleNewRecipeAllergen = (allergen: AllergenId) => {
    setNewRecipeAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((item) => item !== allergen) : [...prev, allergen]
    );
  };

  const toggleIngredient = (ingredient: string) => {
    setAvailableIngredients((prev) =>
      prev.includes(ingredient)
        ? prev.filter((item) => item !== ingredient)
        : [...prev, ingredient]
    );
  };

  const handleAgeChange = (delta: number) => {
    setAgeMonths((prev) => {
      const next = prev + delta;
      if (next < AGE_LIMITS.min) return AGE_LIMITS.min;
      if (next > AGE_LIMITS.max) return AGE_LIMITS.max;
      return next;
    });
  };

  const computeMatches = () => {
    if (recipes.length === 0) {
      Alert.alert('Noch keine Rezepte vorhanden', 'Lege ein neues Rezept an oder aktualisiere die Liste.');
      return;
    }

    if (availableIngredients.length === 0) {
      Alert.alert('Noch keine Vorräte ausgewählt', 'Hake ein paar Zutaten an, damit wir passende Rezepte finden können.');
      return;
    }

    const matches = recipes.map((recipe) => {
      const matching = recipe.ingredients.filter((ingredient) =>
        selectedIngredientSet.has(ingredient)
      );
      const missing = recipe.ingredients.filter(
        (ingredient) => !selectedIngredientSet.has(ingredient)
      );
      const hasBlockedAllergen = recipe.allergens.some((allergen) =>
        selectedAllergies.includes(allergen)
      );
      const meetsAge = ageMonths >= recipe.min_months;

      return {
        recipe,
        matchCount: matching.length,
        missingIngredients: missing,
        hasBlockedAllergen,
        meetsAge,
      };
    })
      .filter((entry) => entry.meetsAge && !entry.hasBlockedAllergen && entry.matchCount > 0)
      .sort((a, b) => {
        if (b.matchCount === a.matchCount) {
          return a.recipe.min_months - b.recipe.min_months;
        }
        return b.matchCount - a.matchCount;
      })
      .map(({ recipe, matchCount, missingIngredients }) => ({
        recipe,
        matchCount,
        missingIngredients,
      }));

    setRecipeMatches(matches);
    setHasGenerated(true);
  };

  const getInstructionPreview = (instructions: string) => {
    if (!instructions) {
      return 'Noch keine Anleitung hinterlegt.';
    }
    const trimmed = instructions.trim();
    if (trimmed.length <= 140) {
      return trimmed;
    }
    return `${trimmed.slice(0, 140)}…`;
  };

  const resetNewRecipeForm = () => {
    setNewRecipeTitle('');
    setNewRecipeDescription('');
    setNewRecipeMinMonths(6);
    setNewRecipeIngredientsText('');
    setNewRecipeInstructions('');
    setNewRecipeAllergens([]);
    setNewRecipeImage(null);
  };

  const handleSelectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Zugriff verweigert', 'Bitte erlaube den Zugriff auf die Fotomediathek, um Bilder hochzuladen.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.length) {
      setNewRecipeImage(result.assets[0]);
    }
  };

  const adjustNewRecipeAge = (delta: number) => {
    setNewRecipeMinMonths((prev) => {
      const next = prev + delta;
      if (Number.isNaN(next)) {
        return AGE_LIMITS.min;
      }
      if (next < AGE_LIMITS.min) return AGE_LIMITS.min;
      if (next > AGE_LIMITS.max) return AGE_LIMITS.max;
      return next;
    });
  };

  const handleNewRecipeAgeInput = (value: string) => {
    const numeric = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(numeric)) {
      setNewRecipeMinMonths(AGE_LIMITS.min);
      return;
    }
    setNewRecipeMinMonths(Math.max(AGE_LIMITS.min, Math.min(AGE_LIMITS.max, numeric)));
  };

  const handleCreateRecipe = async () => {
    const ingredients = newRecipeIngredientsText
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!newRecipeTitle.trim() || ingredients.length === 0 || !newRecipeInstructions.trim()) {
      Alert.alert('Bitte Formular prüfen', 'Titel, Zutaten und Anleitung müssen ausgefüllt sein.');
      return;
    }

    setIsSubmittingRecipe(true);

    try {
      let imageUrl: string | null = null;
      if (newRecipeImage?.uri) {
        imageUrl = await uploadRecipeImage(newRecipeImage.uri);
      }

      const payload: CreateRecipePayload = {
        title: newRecipeTitle.trim(),
        description: newRecipeDescription.trim() || 'Familienliebling aus der Community',
        minMonths: Math.max(AGE_LIMITS.min, Math.min(AGE_LIMITS.max, newRecipeMinMonths)),
        ingredients,
        allergens: newRecipeAllergens,
        instructions: newRecipeInstructions.trim(),
        imageUrl,
      };

      await createRecipe(payload);
      await loadRecipes();
      resetNewRecipeForm();
      setIsAddModalVisible(false);
      Alert.alert('Rezept gespeichert', 'Dein Rezept wurde veröffentlicht und steht jetzt allen zur Verfügung.');
    } catch (error) {
      console.error('Failed to create recipe', error);
      Alert.alert('Fehler', 'Das Rezept konnte nicht gespeichert werden. Bitte versuche es später erneut.');
    } finally {
      setIsSubmittingRecipe(false);
    }
  };

  const disabledIngredientsCount = useMemo(() => {
    if (selectedAllergies.length === 0) return 0;
    return recipes.reduce((acc, recipe) => {
      if (recipe.allergens.some((item) => selectedAllergies.includes(item))) {
        return acc + 1;
      }
      return acc;
    }, 0);
  }, [recipes, selectedAllergies]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
          <Header
            title="BLW-Rezepte"
            subtitle="Aus euren Vorräten blitzschnell Ideen zaubern"
            showBackButton
            onBackPress={() => router.back()}
          />

          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={PRIMARY}
              />
            }
          >
            <LiquidGlassCard
              style={styles.heroCard}
              intensity={28}
              overlayColor="rgba(255,255,255,0.22)"
              borderColor="rgba(255,255,255,0.35)"
            >
              <View style={styles.heroRow}>
                <View style={styles.heroIcon}>
                  <IconSymbol name="checklist" size={26} color={PRIMARY} />
                </View>
                <View style={styles.heroTextWrap}>
                  <ThemedText style={styles.heroTitle}>Dein Vorrats-Assistent</ThemedText>
                  <ThemedText style={styles.heroSubtitle}>
                    Wähle Zutaten, setze Allergien, und erhalte passende BLW-Rezepte für Levi.
                  </ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            <LiquidGlassCard
              style={styles.sectionCard}
              intensity={26}
              overlayColor="rgba(255,255,255,0.20)"
              borderColor={GLASS_BORDER}
            >
              <View style={styles.sectionHeader}>
                <IconSymbol name="calendar" size={22} color={PRIMARY} />
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
            </LiquidGlassCard>

            {listError && (
              <LiquidGlassCard
                style={styles.errorCard}
                intensity={24}
                overlayColor="rgba(255, 90, 90, 0.08)"
                borderColor="rgba(255, 90, 90, 0.3)"
              >
                <View style={styles.errorContent}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#D14343" />
                  <View style={styles.errorTextWrapper}>
                    <ThemedText style={styles.errorTitle}>Rezepte konnten nicht geladen werden</ThemedText>
                    <ThemedText style={styles.errorMessage}>{listError}</ThemedText>
                  </View>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={loadRecipes}
                    activeOpacity={0.85}
                  >
                    <ThemedText style={styles.retryButtonText}>Erneut</ThemedText>
                  </TouchableOpacity>
                </View>
              </LiquidGlassCard>
            )}

            <LiquidGlassCard
              style={styles.sectionCard}
              intensity={26}
              overlayColor="rgba(255,255,255,0.20)"
              borderColor={GLASS_BORDER}
            >
              <View style={styles.sectionHeader}>
                <IconSymbol name="info.circle.fill" size={22} color={PRIMARY} />
                <ThemedText style={styles.sectionTitle}>Allergien berücksichtigen</ThemedText>
              </View>
              <ThemedText style={styles.sectionHint}>
                Markiere, was ihr aktuell meidet. Wir verstecken Rezepte mit diesen Allergenen.
              </ThemedText>

              <View style={styles.chipRow}>
                {ALLERGEN_OPTIONS.map((option) => {
                  const isSelected = selectedAllergies.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      onPress={() => toggleAllergy(option.id)}
                      activeOpacity={0.85}
                    >
                      <ThemedText
                        style={[
                          styles.chipLabel,
                          isSelected && styles.chipLabelSelected,
                        ]}
                      >
                        {option.label}
                      </ThemedText>
                      <ThemedText style={styles.chipHint}>{option.hint}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LiquidGlassCard>

            <View style={styles.sectionIntro}>
              <IconSymbol name="checklist" size={20} color={PRIMARY} />
              <ThemedText style={styles.sectionIntroText}>
                Hake eure verfügbaren Zutaten ab:
              </ThemedText>
            </View>

            {INGREDIENT_GROUPS.map((group) => (
              <LiquidGlassCard
                key={group.key}
                style={styles.ingredientsCard}
                intensity={24}
                overlayColor={GLASS_OVERLAY}
                borderColor={GLASS_BORDER}
              >
                <ThemedText style={styles.ingredientsTitle}>{group.label}</ThemedText>
                <View style={styles.ingredientsGrid}>
                  {group.items.map((ingredient) => {
                    const isSelected = selectedIngredientSet.has(ingredient);
                    return (
                      <TouchableOpacity
                        key={ingredient}
                        style={[
                          styles.ingredientChip,
                          isSelected && styles.ingredientChipSelected,
                        ]}
                        onPress={() => toggleIngredient(ingredient)}
                        activeOpacity={0.85}
                      >
                        <ThemedText
                          style={[
                            styles.ingredientLabel,
                            isSelected && styles.ingredientLabelSelected,
                          ]}
                        >
                          {ingredient}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </LiquidGlassCard>
            ))}

            <LiquidGlassCard
              style={[
                styles.generateButton,
                availableIngredients.length === 0 && styles.generateButtonDisabled,
              ]}
              intensity={28}
              overlayColor="rgba(142,78,198,0.36)"
              borderColor="rgba(255,255,255,0.4)"
              onPress={computeMatches}
              activeOpacity={0.85}
            >
              <View style={styles.generateButtonInner}>
                <IconSymbol name="star.fill" size={22} color="#FFFFFF" style={styles.generateIcon} />
                <ThemedText style={styles.generateLabel}>Rezepte generieren</ThemedText>
                <View style={styles.generateBadge}>
                  <ThemedText style={styles.generateBadgeText}>
                    {availableIngredients.length}
                  </ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            {hasGenerated && (
              <View style={styles.resultsWrapper}>
                <ThemedText style={styles.resultsTitle}>Eure Vorschläge</ThemedText>
                {recipeMatches.length === 0 ? (
                  <LiquidGlassCard
                    style={styles.emptyStateCard}
                    intensity={26}
                    overlayColor="rgba(255,255,255,0.26)"
                    borderColor="rgba(255,255,255,0.3)"
                  >
                    <View style={styles.emptyStateBody}>
                      <IconSymbol name="info.circle.fill" size={24} color={PRIMARY} />
                      <ThemedText style={styles.emptyStateTitle}>Noch keine Treffer</ThemedText>
                      <ThemedText style={styles.emptyStateText}>
                        Probiere mehr Zutaten zu markieren oder passe das Alter an – dann finden wir etwas,
                        das garantiert passt.
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                  ) : (
                    recipeMatches.map((match) => (
                      <LiquidGlassCard
                        key={match.recipe.id}
                        style={styles.recipeCard}
                        intensity={26}
                        overlayColor="rgba(255,255,255,0.24)"
                        borderColor="rgba(255,255,255,0.35)"
                        onPress={() => setSelectedRecipe(match.recipe)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.recipeHeader}>
                          <ThemedText style={styles.recipeTitle}>{match.recipe.title}</ThemedText>
                          <View style={styles.ageTag}>
                            <IconSymbol name="clock" size={16} color="#FFFFFF" />
                            <ThemedText style={styles.ageTagText}>
                            ab {match.recipe.min_months} M
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.recipeDescription}>
                          {match.recipe.description}
                      </ThemedText>

                      <View style={styles.recipeStatsRow}>
                          <View style={styles.statPill}>
                            <IconSymbol name="checklist" size={16} color={PRIMARY} />
                            <ThemedText style={styles.statText}>
                              {match.matchCount} / {match.recipe.ingredients.length} Zutaten vorhanden
                            </ThemedText>
                          </View>
                        {match.missingIngredients.length === 0 ? (
                          <View style={[styles.statPill, styles.readyPill]}>
                            <ThemedText style={styles.readyText}>Alles im Haus 🎉</ThemedText>
                          </View>
                        ) : (
                          <View style={styles.missingList}>
                            <ThemedText style={styles.missingLabel}>Noch besorgen:</ThemedText>
                            <ThemedText style={styles.missingItems}>
                              {match.missingIngredients.join(', ')}
                            </ThemedText>
                          </View>
                        )}
                        </View>

                        <View style={styles.tipBox}>
                          <IconSymbol name="info.circle.fill" size={16} color={PRIMARY} />
                        <ThemedText style={styles.tipText}>
                            {getInstructionPreview(match.recipe.instructions)}
                          </ThemedText>
                        </View>
                      </LiquidGlassCard>
                    ))
                  )}
              </View>
            )}

            <LiquidGlassCard
              style={styles.addRecipeCard}
              intensity={28}
              overlayColor="rgba(142,78,198,0.12)"
              borderColor="rgba(142,78,198,0.28)"
              onPress={() => setIsAddModalVisible(true)}
              activeOpacity={0.85}
            >
              <View style={styles.addRecipeRow}>
                <View style={styles.addRecipeIcon}>
                  <IconSymbol name="plus" size={20} color={PRIMARY} />
                </View>
                <View style={styles.addRecipeTextWrap}>
                  <ThemedText style={styles.addRecipeTitle}>Eigenes Rezept hinzufügen</ThemedText>
                  <ThemedText style={styles.addRecipeSubtitle}>
                    Teile deine Lieblingsideen mit der Community – inklusive Foto und Anleitung.
                  </ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            <View style={styles.allRecipesWrapper}>
              <ThemedText style={styles.resultsTitle}>Alle Community-Rezepte</ThemedText>
              {isLoading ? (
                <View style={styles.loaderBox}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <ThemedText style={styles.loaderLabel}>Rezepte werden geladen…</ThemedText>
                </View>
              ) : listError ? (
                <View style={styles.loaderBox}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#D14343" />
                  <ThemedText style={styles.loaderLabel}>{listError}</ThemedText>
                </View>
              ) : recipes.length === 0 ? (
                <LiquidGlassCard
                  style={styles.emptyStateCard}
                  intensity={24}
                  overlayColor="rgba(255,255,255,0.26)"
                  borderColor="rgba(255,255,255,0.3)"
                >
                  <View style={styles.emptyStateBody}>
                    <IconSymbol name="info.circle.fill" size={24} color={PRIMARY} />
                    <ThemedText style={styles.emptyStateTitle}>Noch keine Rezepte vorhanden</ThemedText>
                    <ThemedText style={styles.emptyStateText}>
                      Starte mit deinem ersten Rezept und speichere es direkt in Supabase.
                    </ThemedText>
                  </View>
                </LiquidGlassCard>
              ) : (
                recipes.map((recipe) => (
                  <LiquidGlassCard
                    key={recipe.id}
                    style={styles.recipeCard}
                    intensity={24}
                    overlayColor="rgba(255,255,255,0.22)"
                    borderColor="rgba(255,255,255,0.33)"
                    onPress={() => setSelectedRecipe(recipe)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.recipeHeader}>
                      <ThemedText style={styles.recipeTitle}>{recipe.title}</ThemedText>
                      <View style={styles.ageTag}>
                        <IconSymbol name="clock" size={16} color="#FFFFFF" />
                        <ThemedText style={styles.ageTagText}>ab {recipe.min_months} M</ThemedText>
                      </View>
                    </View>

                    {recipe.image_url ? (
                      <Image source={{ uri: recipe.image_url }} style={styles.recipeThumbnail} />
                    ) : null}

                    <ThemedText style={styles.recipeDescription}>{recipe.description}</ThemedText>

                    <View style={styles.recipeStatsRow}>
                      <View style={styles.statPill}>
                        <IconSymbol name="leaf.fill" size={16} color={PRIMARY} />
                        <ThemedText style={styles.statText}>
                          {recipe.ingredients.slice(0, 4).join(', ')}
                          {recipe.ingredients.length > 4 ? ' …' : ''}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.tipBox}>
                      <IconSymbol name="info.circle.fill" size={16} color={PRIMARY} />
                      <ThemedText style={styles.tipText}>{getInstructionPreview(recipe.instructions)}</ThemedText>
                    </View>
                  </LiquidGlassCard>
                ))
              )}
            </View>

            {selectedAllergies.length > 0 && (
              <LiquidGlassCard
                style={styles.noticeCard}
                intensity={22}
                overlayColor="rgba(255,255,255,0.18)"
                borderColor="rgba(255,255,255,0.28)"
              >
                <ThemedText style={styles.noticeTitle}>Allergie-Filter aktiv</ThemedText>
                <ThemedText style={styles.noticeText}>
                  Wir haben {disabledIngredientsCount} Rezepte ausgeblendet, weil sie Allergene enthalten,
                  die ihr aktuell meiden möchtet.
                </ThemedText>
              </LiquidGlassCard>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>

      <Modal
        visible={!!selectedRecipe}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedRecipe(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedRecipe(null)} />
          {selectedRecipe && (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>{selectedRecipe.title}</ThemedText>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedRecipe(null)}
                  activeOpacity={0.85}
                >
                  <IconSymbol name="xmark.circle.fill" size={24} color={PRIMARY} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
                <View style={styles.modalAgeTag}>
                  <IconSymbol name="clock" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.modalAgeText}>
                    ab {selectedRecipe.min_months} Monaten
                  </ThemedText>
                </View>

                {selectedRecipe.image_url ? (
                  <Image source={{ uri: selectedRecipe.image_url }} style={styles.modalImage} />
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <IconSymbol name="photo" size={28} color={PRIMARY} />
                    <ThemedText style={styles.modalPlaceholderText}>Kein Bild hinterlegt</ThemedText>
                  </View>
                )}

                <ThemedText style={styles.modalSectionTitle}>Zutaten</ThemedText>
                <View style={styles.modalIngredientList}>
                  {selectedRecipe.ingredients.length === 0 ? (
                    <ThemedText style={styles.modalIngredientText}>
                      Für dieses Rezept sind noch keine Zutaten hinterlegt.
                    </ThemedText>
                  ) : (
                    selectedRecipe.ingredients.map((ingredient) => (
                      <View key={ingredient} style={styles.modalIngredientItem}>
                        <View style={styles.modalBullet} />
                        <ThemedText style={styles.modalIngredientText}>{ingredient}</ThemedText>
                      </View>
                    ))
                  )}
                </View>

                {selectedRecipe.allergens.length > 0 && (
                  <>
                    <ThemedText style={styles.modalSectionTitle}>Allergen-Hinweis</ThemedText>
                    <View style={styles.modalAllergenRow}>
                      {selectedRecipe.allergens.map((allergen) => (
                        <View key={allergen} style={styles.modalAllergenPill}>
                          <IconSymbol name="exclamationmark.triangle.fill" size={14} color="#FFFFFF" />
                          <ThemedText style={styles.modalAllergenText}>
                            {allergenLabelMap[allergen] ?? allergen}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <ThemedText style={styles.modalSectionTitle}>Anleitung</ThemedText>
                <View style={styles.modalInstructionsBox}>
                  {(() => {
                    const steps = selectedRecipe.instructions
                      .split(/\n+/)
                      .map((step) => step.trim())
                      .filter(Boolean);
                    if (steps.length === 0) {
                      return (
                        <ThemedText style={styles.modalInstructionText}>
                          Es wurde noch keine Anleitung ergänzt.
                        </ThemedText>
                      );
                    }
                    return steps.map((step, index) => (
                      <View key={`${index}-${step.slice(0, 12)}`} style={styles.modalInstructionRow}>
                        <View style={styles.stepBadge}>
                          <ThemedText style={styles.stepBadgeText}>{index + 1}</ThemedText>
                        </View>
                        <ThemedText style={styles.modalInstructionText}>{step}</ThemedText>
                      </View>
                    ));
                  })()}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsAddModalVisible(false);
          resetNewRecipeForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.addModalWrapper}
        >
          <View style={styles.addModalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setIsAddModalVisible(false);
                resetNewRecipeForm();
              }}
              activeOpacity={0.85}
            >
              <IconSymbol name="xmark" size={22} color={PRIMARY} />
            </TouchableOpacity>
            <ThemedText style={styles.addModalTitle}>Neues Rezept veröffentlichen</ThemedText>
          </View>

          <ScrollView contentContainerStyle={styles.addModalContent}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Rezeptname</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="z. B. Cremiger Süßkartoffelauflauf"
                placeholderTextColor="#9B8C80"
                value={newRecipeTitle}
                onChangeText={setNewRecipeTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Kurzbeschreibung</ThemedText>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Was macht dein Rezept besonders?"
                placeholderTextColor="#9B8C80"
                value={newRecipeDescription}
                onChangeText={setNewRecipeDescription}
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Ab welchem Alter?</ThemedText>
              <View style={styles.ageInputRow}>
                <TouchableOpacity
                  style={styles.ageInputButton}
                  onPress={() => adjustNewRecipeAge(-1)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.ageInputButtonLabel}>-</ThemedText>
                </TouchableOpacity>
                <TextInput
                  style={styles.ageInputField}
                  keyboardType="number-pad"
                  value={String(newRecipeMinMonths)}
                  onChangeText={handleNewRecipeAgeInput}
                />
                <TouchableOpacity
                  style={styles.ageInputButton}
                  onPress={() => adjustNewRecipeAge(1)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.ageInputButtonLabel}>+</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Zutaten</ThemedText>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Eine Zutat pro Zeile oder durch Komma getrennt"
                placeholderTextColor="#9B8C80"
                value={newRecipeIngredientsText}
                onChangeText={setNewRecipeIngredientsText}
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Anleitung</ThemedText>
              <TextInput
                style={[styles.input, styles.multilineInput, styles.instructionsInput]}
                placeholder="Beschreibe Schritt für Schritt die Zubereitung"
                placeholderTextColor="#9B8C80"
                value={newRecipeInstructions}
                onChangeText={setNewRecipeInstructions}
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Allergien</ThemedText>
              <View style={styles.formChipRow}>
                {ALLERGEN_OPTIONS.map((option) => {
                  const isSelected = newRecipeAllergens.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={`new-${option.id}`}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => toggleNewRecipeAllergen(option.id)}
                      activeOpacity={0.85}
                    >
                      <ThemedText
                        style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}
                      >
                        {option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Rezeptfoto</ThemedText>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={handleSelectImage}
                activeOpacity={0.85}
              >
                <IconSymbol name="photo" size={20} color={PRIMARY} />
                <ThemedText style={styles.imagePickerLabel}>Foto aus Galerie wählen</ThemedText>
              </TouchableOpacity>
              {newRecipeImage?.uri ? (
                <Image source={{ uri: newRecipeImage.uri }} style={styles.previewImage} />
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmittingRecipe && styles.submitButtonDisabled]}
              onPress={handleCreateRecipe}
              activeOpacity={0.85}
              disabled={isSubmittingRecipe}
            >
              {isSubmittingRecipe ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitButtonLabel}>Rezept speichern</ThemedText>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

export default RecipeGeneratorScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#f5eee0',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 80,
  },
  heroCard: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(142,78,198,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroTextWrap: { flex: 1 },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#7D5A50',
  },
  sectionCard: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginBottom: SECTION_GAP_BOTTOM,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  sectionHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#7D5A50',
  },
  ageControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  ageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageButtonText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#7D5A50',
    marginTop: -2,
  },
  ageBadge: {
    flex: 1,
    alignItems: 'center',
  },
  ageValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#7D5A50',
    lineHeight: 36,
  },
  ageLabel: {
    fontSize: 13,
    color: '#7D5A50',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipSelected: {
    backgroundColor: 'rgba(142,78,198,0.18)',
    borderColor: 'rgba(142,78,198,0.35)',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
  },
  chipLabelSelected: {
    color: PRIMARY,
  },
  chipHint: {
    marginTop: 2,
    fontSize: 11,
    color: '#7D5A50',
    opacity: 0.7,
  },
  sectionIntro: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIntroText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
  },
  ingredientsCard: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: SECTION_GAP_BOTTOM,
  },
  ingredientsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 12,
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ingredientChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  ingredientChipSelected: {
    backgroundColor: 'rgba(142,78,198,0.22)',
    borderColor: 'rgba(142,78,198,0.4)',
  },
  ingredientLabel: {
    fontSize: 14,
    color: '#7D5A50',
  },
  ingredientLabelSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
  generateButton: {
    marginTop: SECTION_GAP_TOP,
    borderRadius: RADIUS,
  },
  generateButtonDisabled: {
    opacity: 0.65,
  },
  generateButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  generateIcon: {
    marginRight: 12,
  },
  generateLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  generateBadge: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  generateBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorCard: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: RADIUS,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorTextWrapper: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D14343',
  },
  errorMessage: {
    marginTop: 4,
    fontSize: 13,
    color: '#7D5A50',
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(142,78,198,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.35)',
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },
  resultsWrapper: {
    marginTop: SECTION_GAP_TOP,
  },
  resultsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 12,
  },
  emptyStateCard: {
    borderRadius: RADIUS,
  },
  emptyStateBody: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#7D5A50',
  },
  recipeCard: {
    marginBottom: SECTION_GAP_BOTTOM,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: RADIUS,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    flex: 1,
    marginRight: 12,
  },
  ageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  ageTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  recipeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7D5A50',
    marginBottom: 14,
  },
  recipeStatsRow: {
    gap: 10,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  statText: {
    fontSize: 13,
    color: '#7D5A50',
  },
  readyPill: {
    backgroundColor: 'rgba(142,78,198,0.3)',
  },
  readyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  missingList: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  missingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 4,
  },
  missingItems: {
    fontSize: 13,
    color: '#7D5A50',
  },
  tipBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(142,78,198,0.12)',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#7D5A50',
  },
  addRecipeCard: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    borderRadius: RADIUS,
  },
  addRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  addRecipeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(142,78,198,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRecipeTextWrap: {
    flex: 1,
  },
  addRecipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  addRecipeSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#7D5A50',
    lineHeight: 18,
  },
  allRecipesWrapper: {
    marginTop: SECTION_GAP_TOP,
  },
  loaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  loaderLabel: {
    fontSize: 14,
    color: '#7D5A50',
  },
  recipeThumbnail: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS,
    marginBottom: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: RADIUS,
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
    marginRight: 12,
  },
  modalCloseButton: {
    padding: 6,
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 18,
  },
  modalAgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  modalAgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.28)',
    backgroundColor: 'rgba(142,78,198,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalPlaceholderText: {
    fontSize: 13,
    color: '#7D5A50',
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
  },
  modalIngredientList: {
    gap: 8,
  },
  modalIngredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  modalIngredientText: {
    flex: 1,
    fontSize: 14,
    color: '#7D5A50',
  },
  modalAllergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalAllergenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#D14343',
  },
  modalAllergenText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalInstructionsBox: {
    gap: 12,
  },
  modalInstructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(142,78,198,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },
  modalInstructionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#7D5A50',
  },
  addModalWrapper: {
    flex: 1,
    backgroundColor: '#F9F3EA',
  },
  addModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 12,
  },
  addModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
  },
  addModalContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.24)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#7D5A50',
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 90,
  },
  instructionsInput: {
    minHeight: 140,
  },
  ageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ageInputButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.28)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageInputButtonLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: PRIMARY,
    marginTop: -2,
  },
  ageInputField: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.24)',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  formChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.3)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  imagePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  previewImage: {
    marginTop: 12,
    width: '100%',
    height: 180,
    borderRadius: RADIUS,
  },
  submitButton: {
    marginTop: 12,
    borderRadius: RADIUS,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noticeCard: {
    marginTop: SECTION_GAP_TOP,
    padding: 18,
    borderRadius: RADIUS,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 13,
    color: '#7D5A50',
    lineHeight: 19,
  },
});
