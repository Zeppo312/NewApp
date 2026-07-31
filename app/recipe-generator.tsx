import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { BlurView } from "expo-blur";
import { Stack, useRouter } from "expo-router";

import { ThemedBackground } from "@/components/ThemedBackground";
import Header from "@/components/Header";
import { RecipeVideoCourse } from "@/components/RecipeVideoCourse";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import {
  GLASS_BORDER,
  GLASS_BORDER_DARK,
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
  LiquidGlassCard,
  PRIMARY,
  GRID_GAP,
} from "@/constants/DesignGuide";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import { createRecipe, fetchRecipes, RecipeRecord } from "@/lib/recipes";
import {
  getSampleRecipeImage,
  RECIPE_SAMPLES,
  RecipeSample,
} from "@/lib/recipes-samples";
import { extractYouTubeVideoId } from "@/lib/recipeVideo";
import { addRecipeIngredientsToShoppingList } from "@/lib/shopping";
import { useActiveBaby } from "@/contexts/ActiveBabyContext";
import {
  DEFAULT_RECIPE_LOCALE,
  getRecipeAllergenLabel,
  getRecipeLocaleTag,
  RecipeTranslationKey,
  translateRecipePlural,
  translateRecipeText,
} from "@/lib/recipeTranslations";

type AllergenId = "milk" | "gluten" | "egg" | "nuts" | "fish";

const RECIPE_AGE_LIMITS = { min: 4, max: 24 };
const FILTER_AGE_LIMITS = { min: 0, max: 24 };
const clampFilterAgeMonths = (value: number) =>
  Math.max(FILTER_AGE_LIMITS.min, Math.min(FILTER_AGE_LIMITS.max, value));
const clampRecipeAgeMonths = (value: number) =>
  Math.max(RECIPE_AGE_LIMITS.min, Math.min(RECIPE_AGE_LIMITS.max, value));

const ALLERGEN_OPTIONS: {
  id: AllergenId;
  labelKey: RecipeTranslationKey;
  hintKey: RecipeTranslationKey;
}[] = [
  { id: "milk", labelKey: "allergy.milk", hintKey: "allergy.milkHint" },
  { id: "gluten", labelKey: "allergy.gluten", hintKey: "allergy.glutenHint" },
  { id: "egg", labelKey: "allergy.egg", hintKey: "allergy.eggHint" },
  { id: "nuts", labelKey: "allergy.nuts", hintKey: "allergy.nutsHint" },
  { id: "fish", labelKey: "allergy.fish", hintKey: "allergy.fishHint" },
];

const ACTIVE_RECIPE_LOCALE = DEFAULT_RECIPE_LOCALE;
const RECIPE_LOCALE_TAG = getRecipeLocaleTag(ACTIVE_RECIPE_LOCALE);
const t = (
  key: RecipeTranslationKey,
  params?: Record<string, string | number>,
) => translateRecipeText(ACTIVE_RECIPE_LOCALE, key, params);

const SCREEN_PADDING = 16;
const MAX_CONTENT_WIDTH = 720;
const CARD_INTERNAL_PADDING = 18;
const CARD_SPACING = 14;
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
  allergens
    .map((id) => getRecipeAllergenLabel(ACTIVE_RECIPE_LOCALE, id))
    .join(", ");

type InstructionStep = {
  number: string;
  text: string;
};

const parseInstructionSteps = (value: string) => {
  if (!value) return null;
  const stepRegex = /(?:^|\n)\s*(\d+)\.\s*/g;
  const matches = Array.from(value.matchAll(stepRegex));
  if (matches.length < 2 || matches[0]?.[1] !== "1") {
    return null;
  }
  const steps: InstructionStep[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match) continue;
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex =
      i + 1 < matches.length
        ? (matches[i + 1]?.index ?? value.length)
        : value.length;
    const rawStep = value.slice(startIndex, endIndex).trim();
    if (!rawStep) continue;
    const cleanedStep = rawStep.replace(/\n[ \t]+/g, "\n").trim();
    steps.push({ number: match[1] ?? `${i + 1}`, text: cleanedStep });
  }
  if (steps.length === 0) return null;
  const intro = value.slice(0, matches[0]?.index ?? 0).trim();
  return { intro, steps };
};

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const lightenHex = (hex: string, amount = 0.35) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0");

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

const RecipeGeneratorScreen = () => {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.min(
    Math.max(0, screenWidth - SCREEN_PADDING * 2),
    MAX_CONTENT_WIDTH,
  );
  const isCompact = screenWidth < 380;
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : "#5C4033";
  const textSecondary = isDark ? Colors.dark.textSecondary : "#7D5A50";
  const textTertiary = isDark ? Colors.dark.textTertiary : "#9C8B82";
  const accentColor = isDark ? lightenHex(PRIMARY, 0.2) : PRIMARY;
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const glassBorder = isDark ? GLASS_BORDER_DARK : GLASS_BORDER;
  const blurTint = isDark ? "dark" : "extraLight";
  const quickActionBlurTint = isDark ? "dark" : "light";
  const placeholderTextColor = isDark
    ? "rgba(255,255,255,0.55)"
    : "rgba(0,0,0,0.35)";
  const styles = useMemo(
    () =>
      createStyles({
        isDark,
        textPrimary,
        textSecondary,
        textTertiary,
        accentColor,
        glassOverlay,
        glassBorder,
        isCompact,
      }),
    [
      isDark,
      textPrimary,
      textSecondary,
      textTertiary,
      accentColor,
      glassOverlay,
      glassBorder,
      isCompact,
    ],
  );
  const { activeBaby, activeBabyId } = useActiveBaby();

  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ageMonths, setAgeMonths] = useState<number>(FILTER_AGE_LIMITS.min);
  const [selectedAllergies, setSelectedAllergies] = useState<AllergenId[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRecord | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAddingToShoppingList, setIsAddingToShoppingList] = useState(false);

  const handleAddIngredientsToShoppingList = useCallback(
    async (recipe: RecipeRecord) => {
      if (!activeBabyId) {
        Alert.alert(t("shopping.noBabyTitle"), t("shopping.noBabyMessage"));
        return;
      }
      setIsAddingToShoppingList(true);
      const { data, error } = await addRecipeIngredientsToShoppingList(
        recipe,
        activeBabyId,
      );
      setIsAddingToShoppingList(false);
      if (error || !data) {
        Alert.alert(t("common.error"), t("shopping.addFailed"));
        return;
      }
      const message =
        data.added === 0
          ? t("shopping.allPresent")
          : data.skipped > 0
            ? t("shopping.addedSkipped", {
                added: data.added,
                skipped: data.skipped,
              })
            : t("shopping.added", { added: data.added });
      Alert.alert(t("shopping.title"), message, [
        { text: t("common.ok") },
        {
          text: t("shopping.open"),
          onPress: () => router.push("/shopping-list" as any),
        },
      ]);
    },
    [activeBabyId, router],
  );

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [newTip, setNewTip] = useState("");
  const [newMinMonths, setNewMinMonths] = useState("6");
  const [newIngredients, setNewIngredients] = useState<string[]>([]);
  const [newIngredientInput, setNewIngredientInput] = useState("");
  const [newAllergens, setNewAllergens] = useState<AllergenId[]>([]);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState("");

  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      if (a.min_months === b.min_months) {
        return a.title.localeCompare(b.title, RECIPE_LOCALE_TAG);
      }
      return a.min_months - b.min_months;
    });
  }, [recipes]);

  const blockedRecipeCount = useMemo(() => {
    if (selectedAllergies.length === 0) return 0;
    const allergySet = new Set(selectedAllergies);
    return recipes.reduce((count, recipe) => {
      const hasConflictingAllergen = recipe.allergens.some((item) =>
        allergySet.has(item as AllergenId),
      );
      return hasConflictingAllergen ? count + 1 : count;
    }, 0);
  }, [selectedAllergies, recipes]);

  const selectedRecipeImageUrl = selectedRecipe
    ? (selectedRecipe.image_url ?? getSampleRecipeImage(selectedRecipe.title))
    : null;
  const instructionParts = selectedRecipe?.instructions
    ? parseInstructionSteps(selectedRecipe.instructions)
    : null;
  const selectedRecipeVideoId = selectedRecipe?.video_url
    ? extractYouTubeVideoId(selectedRecipe.video_url)
    : null;

  const loadRecipes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await fetchRecipes();
      if (error) throw error;
      setRecipes(data);
    } catch (error) {
      console.error("Error loading recipes:", error);
      Alert.alert(t("load.errorTitle"), t("load.errorMessage"));
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
          (today.getTime() - birthDate.getTime()) /
            (1000 * 60 * 60 * 24 * 30.44),
        );
        const calculatedAge = Math.max(0, months);
        setAgeMonths(clampFilterAgeMonths(calculatedAge));
        return;
      }
    }
    // Fallback auf 0 wenn kein Geburtsdatum vorhanden
    setAgeMonths(FILTER_AGE_LIMITS.min);
  }, [activeBabyId, activeBaby?.birth_date]);

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewInstructions("");
    setNewTip("");
    setNewMinMonths("6");
    setNewIngredients([]);
    setNewIngredientInput("");
    setNewAllergens([]);
    setNewImage(null);
    setNewVideoUrl("");
  };

  const toggleAllergy = (allergen: AllergenId) => {
    setSelectedAllergies((prev) =>
      prev.includes(allergen)
        ? prev.filter((item) => item !== allergen)
        : [...prev, allergen],
    );
  };

  const allergenRows = useMemo(
    () => chunkItems(ALLERGEN_OPTIONS, ALLERGEN_COLUMNS),
    [],
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
    setNewIngredientInput("");
  };

  const removeIngredientFromForm = (ingredient: string) => {
    setNewIngredients((prev) => prev.filter((item) => item !== ingredient));
  };

  const toggleNewAllergen = (allergen: AllergenId) => {
    setNewAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((item) => item !== allergen)
        : [...prev, allergen],
    );
  };

  const pickRecipeImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("photo.permissionTitle"), t("photo.permissionMessage"));
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
      console.error("Error picking image:", error);
      Alert.alert(t("common.error"), t("photo.pickFailed"));
    }
  };

  const handleCreateRecipe = async () => {
    if (!newTitle.trim()) {
      Alert.alert(t("common.notice"), t("validation.titleRequired"));
      return;
    }

    if (newIngredients.length === 0) {
      Alert.alert(t("common.notice"), t("validation.ingredientsRequired"));
      return;
    }

    if (!newInstructions.trim()) {
      Alert.alert(t("common.notice"), t("validation.instructionsRequired"));
      return;
    }

    const months = clampRecipeAgeMonths(
      Number.parseInt(newMinMonths, 10) || RECIPE_AGE_LIMITS.min,
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
          video_url: newVideoUrl || null,
        },
        newImage ?? undefined,
      );

      if (error) {
        throw error;
      }

      if (data) {
        setRecipes((prev) => [
          data,
          ...prev.filter((item) => item.id !== data.id),
        ]);
      } else {
        await loadRecipes();
      }

      resetCreateForm();
      setShowCreateModal(false);
      Alert.alert(t("common.success"), t("create.saved"));
    } catch (error) {
      console.error("Error creating recipe:", error);
      const message =
        error instanceof Error ? error.message : t("create.saveFailed");
      Alert.alert(t("common.error"), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const seedSampleRecipes = async () => {
    try {
      setIsSeeding(true);
      const existingTitles = new Set(
        recipes.map((recipe) => recipe.title.toLowerCase()),
      );
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
          undefined,
        );

        if (!error) {
          inserted += 1;
          existingTitles.add(sample.title.toLowerCase());
        } else {
          console.warn(
            "Konnte Beispielrezept nicht erstellen:",
            sample.title,
            error,
          );
        }
      }

      await loadRecipes();

      Alert.alert(
        t("import.title"),
        inserted > 0
          ? t("import.added", { count: inserted })
          : t("import.alreadyPresent"),
      );
    } catch (error) {
      console.error("Error seeding recipes:", error);
      Alert.alert(t("common.error"), t("import.failed"));
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
          <View style={styles.overlayContainer}>
            <Header
              title={t("screen.title")}
              subtitle={t("screen.subtitle")}
              showBackButton
              onBackPress={() => router.back()}
            />
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => router.push("/my-recipes")}
                accessibilityRole="button"
                accessibilityLabel={t("screen.myRecipesAccessibility")}
              >
                <IconSymbol name="book.fill" size={22} color={accentColor} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.contentContainer, { width: contentWidth }]}>
              {/* Hero Card */}
              <LiquidGlassCard
                style={[styles.card, styles.topCard]}
                intensity={28}
                overlayColor={
                  isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.22)"
                }
                borderColor={isDark ? glassBorder : "rgba(255,255,255,0.35)"}
              >
                <View style={styles.heroGlowLarge} />
                <View style={styles.heroGlowSmall} />
                <View style={styles.heroRow}>
                  <View style={styles.heroIcon}>
                    <IconSymbol
                      name="checklist"
                      size={26}
                      color={accentColor}
                    />
                  </View>
                  <View style={styles.heroTextWrap}>
                    <ThemedText style={styles.heroEyebrow}>
                      {t("hero.eyebrow")}
                    </ThemedText>
                    <ThemedText style={styles.heroTitle}>
                      {t("hero.title")}
                    </ThemedText>
                    <ThemedText style={styles.heroSubtitle}>
                      {t("hero.subtitle")}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStatPill}>
                    <IconSymbol
                      name="fork.knife"
                      size={14}
                      color={accentColor}
                    />
                    <ThemedText style={styles.heroStatText}>
                      {translateRecipePlural(
                        ACTIVE_RECIPE_LOCALE,
                        "hero.recipeCount",
                        recipes.length,
                      )}
                    </ThemedText>
                  </View>
                  <View style={styles.heroStatPill}>
                    <IconSymbol
                      name="slider.horizontal.3"
                      size={14}
                      color={accentColor}
                    />
                    <ThemedText style={styles.heroStatText}>
                      {t("hero.personalized")}
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
                  <BlurView
                    intensity={24}
                    tint={quickActionBlurTint}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.quickActionOverlay} />
                  <View style={styles.quickActionContent}>
                    <View style={styles.quickActionIcon}>
                      <IconSymbol name="plus" size={20} color={accentColor} />
                    </View>
                    <ThemedText style={styles.quickActionLabel}>
                      {t("action.recipe")}
                    </ThemedText>
                    <ThemedText style={styles.quickActionMeta}>
                      {t("action.create")}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => setShowAgeModal(true)}
                  activeOpacity={0.85}
                >
                  <BlurView
                    intensity={24}
                    tint={quickActionBlurTint}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.quickActionOverlay} />
                  <View style={styles.quickActionContent}>
                    <View style={styles.quickActionIcon}>
                      <IconSymbol
                        name="calendar"
                        size={20}
                        color={accentColor}
                      />
                    </View>
                    <ThemedText style={styles.quickActionLabel}>
                      {t("action.age")}
                    </ThemedText>
                    <ThemedText style={styles.quickActionMeta}>
                      {translateRecipePlural(
                        ACTIVE_RECIPE_LOCALE,
                        "age.months",
                        ageMonths,
                      )}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.quickActionButton,
                    selectedAllergies.length > 0 &&
                      styles.quickActionButtonActive,
                  ]}
                  onPress={() => setShowAllergyModal(true)}
                  activeOpacity={0.85}
                >
                  <BlurView
                    intensity={24}
                    tint={quickActionBlurTint}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.quickActionOverlay,
                      selectedAllergies.length > 0 &&
                        styles.quickActionOverlayActive,
                    ]}
                  />
                  <View style={styles.quickActionContent}>
                    <View style={styles.quickActionIcon}>
                      <IconSymbol
                        name="exclamationmark.triangle.fill"
                        size={18}
                        color={accentColor}
                      />
                      {selectedAllergies.length > 0 && (
                        <View style={styles.quickActionBadge}>
                          <ThemedText style={styles.quickActionBadgeText}>
                            {selectedAllergies.length}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={styles.quickActionLabel}>
                      {t("action.allergies")}
                    </ThemedText>
                    <ThemedText style={styles.quickActionMeta}>
                      {selectedAllergies.length > 0
                        ? t("action.active")
                        : t("action.none")}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Loading State */}
              {isLoading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="large" color={accentColor} />
                  <ThemedText style={styles.loadingText}>
                    {t("catalog.loading")}
                  </ThemedText>
                </View>
              ) : (
                <>
                  {/* All Recipes Catalog */}
                  <View style={styles.catalogHeader}>
                    <View style={styles.catalogTitleGroup}>
                      <ThemedText style={styles.catalogTitle}>
                        {t("catalog.title")}
                      </ThemedText>
                      <ThemedText style={styles.catalogCount}>
                        {translateRecipePlural(
                          ACTIVE_RECIPE_LOCALE,
                          "catalog.count",
                          sortedRecipes.length,
                        )}
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.refreshButton}
                      onPress={loadRecipes}
                      activeOpacity={0.85}
                    >
                      <IconSymbol
                        name="arrow.clockwise"
                        size={16}
                        color={accentColor}
                      />
                      <ThemedText style={styles.refreshLabel}>
                        {t("catalog.refresh")}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  {sortedRecipes.length === 0 ? (
                    <LiquidGlassCard
                      style={styles.card}
                      intensity={24}
                      overlayColor={
                        isDark ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.2)"
                      }
                      borderColor={
                        isDark ? glassBorder : "rgba(255,255,255,0.32)"
                      }
                    >
                      <View style={styles.emptyStateBody}>
                        <IconSymbol
                          name="sparkles"
                          size={24}
                          color={accentColor}
                        />
                        <ThemedText style={styles.emptyStateTitle}>
                          {t("catalog.emptyTitle")}
                        </ThemedText>
                        <ThemedText style={styles.emptyStateText}>
                          {t("catalog.emptyText")}
                        </ThemedText>
                        <TouchableOpacity
                          style={[
                            styles.seedButton,
                            isSeeding && styles.seedButtonDisabled,
                          ]}
                          onPress={seedSampleRecipes}
                          activeOpacity={0.85}
                          disabled={isSeeding}
                        >
                          {isSeeding ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <>
                              <IconSymbol
                                name="tray.and.arrow.down.fill"
                                size={18}
                                color="#FFFFFF"
                              />
                              <ThemedText style={styles.seedButtonText}>
                                {t("catalog.import")}
                              </ThemedText>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </LiquidGlassCard>
                  ) : (
                    sortedRecipes.map((recipe) => {
                      const isFilteredOut = selectedAllergies.some((allergen) =>
                        recipe.allergens.includes(allergen),
                      );
                      const meetsAge = ageMonths >= recipe.min_months;
                      const imageUrl =
                        recipe.image_url ?? getSampleRecipeImage(recipe.title);

                      if (!meetsAge || isFilteredOut) {
                        return (
                          <LiquidGlassCard
                            key={recipe.id}
                            style={[
                              styles.card,
                              styles.recipeCard,
                              styles.disabledRecipeCard,
                            ]}
                            intensity={20}
                            overlayColor={
                              isDark
                                ? "rgba(0,0,0,0.42)"
                                : "rgba(200,200,200,0.2)"
                            }
                            borderColor={
                              isDark ? glassBorder : "rgba(255,255,255,0.25)"
                            }
                          >
                            <View style={styles.recipeHeader}>
                              <ThemedText
                                style={[
                                  styles.recipeTitle,
                                  styles.disabledRecipeTitle,
                                ]}
                              >
                                {recipe.title}
                              </ThemedText>
                              <View
                                style={[styles.ageTag, styles.disabledAgeTag]}
                              >
                                <IconSymbol
                                  name="clock"
                                  size={16}
                                  color="#FFFFFF"
                                />
                                <ThemedText style={styles.ageTagText}>
                                  {t("age.fromShort", {
                                    count: recipe.min_months,
                                  })}
                                </ThemedText>
                              </View>
                            </View>
                            <ThemedText style={styles.disabledNotice}>
                              {t("catalog.filteredNotice")}
                            </ThemedText>
                          </LiquidGlassCard>
                        );
                      }

                      return (
                        <LiquidGlassCard
                          key={recipe.id}
                          style={[styles.card, styles.recipeCard]}
                          intensity={24}
                          overlayColor={glassOverlay}
                          borderColor={glassBorder}
                          onPress={() => setSelectedRecipe(recipe)}
                          activeOpacity={0.88}
                        >
                          <View style={styles.imageHeader}>
                            {imageUrl ? (
                              <Image
                                source={{ uri: imageUrl }}
                                style={styles.imageHeaderImg}
                                contentFit="cover"
                                cachePolicy="disk"
                                transition={300}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.imageHeaderImg,
                                  styles.imageHeaderPlaceholder,
                                ]}
                              >
                                <IconSymbol
                                  name="fork.knife"
                                  size={22}
                                  color="#FFFFFF"
                                />
                              </View>
                            )}
                            <View style={styles.imageHeaderOverlay} />
                            <View style={styles.imageHeaderBadges}>
                              <View style={styles.imageHeaderBadge}>
                                <IconSymbol
                                  name="clock"
                                  size={14}
                                  color="#FFFFFF"
                                />
                                <ThemedText style={styles.imageHeaderBadgeText}>
                                  {t("age.fromShort", {
                                    count: recipe.min_months,
                                  })}
                                </ThemedText>
                              </View>
                              {!!recipe.allergens.length && (
                                <View
                                  style={[
                                    styles.imageHeaderBadge,
                                    styles.imageHeaderWarn,
                                  ]}
                                >
                                  <IconSymbol
                                    name="exclamationmark.triangle.fill"
                                    size={14}
                                    color="#FFFFFF"
                                  />
                                  <ThemedText
                                    style={styles.imageHeaderBadgeText}
                                  >
                                    {formatAllergens(recipe.allergens)}
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.catalogTextColumn}>
                            <ThemedText
                              style={styles.recipeTitle}
                              numberOfLines={2}
                            >
                              {recipe.title}
                            </ThemedText>
                            <ThemedText
                              style={styles.catalogDescription}
                              numberOfLines={2}
                              ellipsizeMode="tail"
                            >
                              {recipe.description ??
                                t("catalog.fallbackDescription")}
                            </ThemedText>
                            <View style={styles.catalogMetaRow}>
                              <View style={styles.statPill}>
                                <IconSymbol
                                  name="checklist"
                                  size={14}
                                  color={accentColor}
                                />
                                <ThemedText style={styles.statText}>
                                  {translateRecipePlural(
                                    ACTIVE_RECIPE_LOCALE,
                                    "recipe.ingredients",
                                    recipe.ingredients.length,
                                  )}
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
                  overlayColor={
                    isDark ? "rgba(0,0,0,0.36)" : "rgba(255,255,255,0.18)"
                  }
                  borderColor={isDark ? glassBorder : "rgba(255,255,255,0.28)"}
                >
                  <ThemedText style={styles.noticeTitle}>
                    {t("catalog.filterActive")}
                  </ThemedText>
                  <ThemedText style={styles.noticeText}>
                    {translateRecipePlural(
                      ACTIVE_RECIPE_LOCALE,
                      "catalog.hidden",
                      blockedRecipeCount,
                    )}
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
          animationType="slide"
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
              tint={blurTint}
            >
              <View style={styles.recipeModalHandle} />
              <View style={styles.recipeModalHeaderRow}>
                <TouchableOpacity
                  style={styles.recipeModalHeaderButton}
                  onPress={() => setSelectedRecipe(null)}
                  activeOpacity={0.85}
                >
                  <IconSymbol name="xmark" size={18} color={textSecondary} />
                </TouchableOpacity>
                <View style={styles.recipeModalHeaderCenter}>
                  <ThemedText style={styles.recipeModalHeaderTitle}>
                    {t("recipe.view")}
                  </ThemedText>
                  <ThemedText style={styles.recipeModalHeaderSubtitle}>
                    {translateRecipePlural(
                      ACTIVE_RECIPE_LOCALE,
                      "age.fromLong",
                      selectedRecipe.min_months,
                    )}
                  </ThemedText>
                </View>
                <View style={styles.recipeModalHeaderSpacer} />
              </View>
              <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.recipeModalScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.recipeHeroCard}>
                  {selectedRecipeImageUrl ? (
                    <>
                      <Image
                        source={{ uri: selectedRecipeImageUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={300}
                      />
                      <View style={styles.recipeHeroTint} />
                    </>
                  ) : (
                    <View
                      style={[StyleSheet.absoluteFill, styles.recipeHeroSolid]}
                    />
                  )}
                  <View style={styles.recipeHeroContent}>
                    <ThemedText
                      style={styles.recipeHeroTitle}
                      numberOfLines={2}
                    >
                      {selectedRecipe.title}
                    </ThemedText>
                    <View style={styles.recipeHeroChipRow}>
                      <View style={styles.recipeHeroChip}>
                        <IconSymbol name="clock" size={14} color="#FFFFFF" />
                        <ThemedText style={styles.recipeHeroChipText}>
                          {t("age.fromShort", {
                            count: selectedRecipe.min_months,
                          })}
                        </ThemedText>
                      </View>
                      {selectedRecipe.allergens.length > 0 && (
                        <View
                          style={[
                            styles.recipeHeroChip,
                            styles.recipeHeroChipWarn,
                          ]}
                        >
                          <IconSymbol
                            name="exclamationmark.triangle.fill"
                            size={14}
                            color="#FFFFFF"
                          />
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

                {selectedRecipe.video_url && selectedRecipeVideoId ? (
                  <View style={styles.recipeSectionCard}>
                    <ThemedText style={styles.recipeSectionTitle}>
                      {t("recipe.video")}
                    </ThemedText>
                    <RecipeVideoCourse
                      accentColor={accentColor}
                      textColor={textPrimary}
                      secondaryTextColor={textSecondary}
                      videoUrl={selectedRecipe.video_url}
                      locale={ACTIVE_RECIPE_LOCALE}
                    />
                  </View>
                ) : null}

                <View style={styles.recipeInfoChipsRow}>
                  <View style={styles.recipeInfoChip}>
                    <IconSymbol
                      name="checklist"
                      size={16}
                      color={accentColor}
                    />
                    <ThemedText style={styles.recipeInfoChipText}>
                      {translateRecipePlural(
                        ACTIVE_RECIPE_LOCALE,
                        "recipe.ingredients",
                        selectedRecipe.ingredients.length,
                      )}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.recipeInfoChip,
                      selectedRecipe.allergens.length === 0 &&
                        styles.recipeInfoChipSafe,
                    ]}
                  >
                    <IconSymbol
                      name={
                        selectedRecipe.allergens.length > 0
                          ? "exclamationmark.triangle.fill"
                          : "sparkles"
                      }
                      size={16}
                      color={
                        selectedRecipe.allergens.length > 0
                          ? "#FFFFFF"
                          : accentColor
                      }
                    />
                    <ThemedText
                      style={[
                        styles.recipeInfoChipText,
                        selectedRecipe.allergens.length === 0 &&
                          styles.recipeInfoChipTextSafe,
                      ]}
                    >
                      {selectedRecipe.allergens.length > 0
                        ? formatAllergens(selectedRecipe.allergens)
                        : t("recipe.allergyFriendly")}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.recipeSectionCard}>
                  <ThemedText style={styles.recipeSectionTitle}>
                    {t("recipe.ingredientsTitle")}
                  </ThemedText>
                  {selectedRecipe.ingredients.map((ingredient) => (
                    <View key={ingredient} style={styles.recipeIngredientRow}>
                      <View style={styles.recipeIngredientDot} />
                      <ThemedText style={styles.recipeIngredientText}>
                        {ingredient}
                      </ThemedText>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.ingredientsToListButton}
                    onPress={() =>
                      handleAddIngredientsToShoppingList(selectedRecipe)
                    }
                    disabled={isAddingToShoppingList}
                  >
                    {isAddingToShoppingList ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <IconSymbol name="cart" size={16} color="#FFFFFF" />
                    )}
                    <ThemedText style={styles.ingredientsToListButtonText}>
                      {t("recipe.addToShopping")}
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                {selectedRecipe.instructions ? (
                  <View style={styles.recipeSectionCard}>
                    <ThemedText style={styles.recipeSectionTitle}>
                      {t("recipe.instructions")}
                    </ThemedText>
                    {instructionParts ? (
                      <>
                        {instructionParts.intro ? (
                          <ThemedText
                            style={[
                              styles.recipeInstructions,
                              styles.recipeInstructionsIntro,
                            ]}
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
                  <View
                    style={[styles.recipeSectionCard, styles.recipeTipCard]}
                  >
                    <IconSymbol
                      name="lightbulb.fill"
                      size={18}
                      color={accentColor}
                    />
                    <ThemedText style={styles.recipeTipText}>
                      {selectedRecipe.tip}
                    </ThemedText>
                  </View>
                ) : null}

                <ThemedText style={styles.recipeDisclaimer}>
                  {t("recipe.disclaimer")}
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
        animationType="slide"
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
            tint={blurTint}
          >
            <View style={styles.recipeModalHandle} />
            <View style={styles.recipeModalHeaderRow}>
              <TouchableOpacity
                style={styles.recipeModalHeaderButton}
                onPress={() => setShowAgeModal(false)}
                activeOpacity={0.85}
              >
                <IconSymbol name="xmark" size={18} color={textSecondary} />
              </TouchableOpacity>
              <View style={styles.recipeModalHeaderCenter}>
                <ThemedText style={styles.recipeModalHeaderTitle}>
                  {t("action.age")}
                </ThemedText>
                <ThemedText style={styles.recipeModalHeaderSubtitle}>
                  {t("age.filter", { count: ageMonths })}
                </ThemedText>
              </View>
              <View style={styles.recipeModalHeaderSpacer} />
            </View>
            <View style={styles.filterModalContent}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="calendar" size={22} color={accentColor} />
                <ThemedText style={styles.sectionTitle}>
                  {t("action.age")}
                </ThemedText>
              </View>
              <ThemedText style={styles.sectionHint}>
                {t("age.filterHint", { count: ageMonths })}
              </ThemedText>
              <View style={styles.ageControlRow}>
                <TouchableOpacity
                  style={styles.ageButton}
                  onPress={() => handleAgeChange(-1)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t("age.decrease")}
                >
                  <ThemedText style={styles.ageButtonText}>-</ThemedText>
                </TouchableOpacity>
                <View style={styles.ageBadge}>
                  <ThemedText style={styles.ageValue}>{ageMonths}</ThemedText>
                  <ThemedText style={styles.ageLabel}>
                    {t(ageMonths === 1 ? "age.unit.one" : "age.unit.other")}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.ageButton}
                  onPress={() => handleAgeChange(1)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t("age.increase")}
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
        animationType="slide"
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
            tint={blurTint}
          >
            <View style={styles.recipeModalHandle} />
            <View style={styles.recipeModalHeaderRow}>
              <TouchableOpacity
                style={styles.recipeModalHeaderButton}
                onPress={() => setShowAllergyModal(false)}
                activeOpacity={0.85}
              >
                <IconSymbol name="xmark" size={18} color={textSecondary} />
              </TouchableOpacity>
              <View style={styles.recipeModalHeaderCenter}>
                <ThemedText style={styles.recipeModalHeaderTitle}>
                  {t("allergy.title")}
                </ThemedText>
                <ThemedText style={styles.recipeModalHeaderSubtitle}>
                  {t("allergy.subtitle")}
                </ThemedText>
              </View>
              <View style={styles.recipeModalHeaderSpacer} />
            </View>
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={styles.filterModalScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionHeader}>
                <IconSymbol
                  name="info.circle.fill"
                  size={22}
                  color={accentColor}
                />
                <ThemedText style={styles.sectionTitle}>
                  {t("allergy.title")}
                </ThemedText>
              </View>
              <ThemedText style={styles.sectionHint}>
                {t("allergy.hint")}
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
                              {t(option.labelKey)}
                            </ThemedText>
                            <ThemedText style={styles.chipHint}>
                              {t(option.hintKey)}
                            </ThemedText>
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
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            tint={blurTint}
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
                <IconSymbol name="xmark" size={18} color={textSecondary} />
              </TouchableOpacity>
              <View style={styles.recipeModalHeaderCenter}>
                <ThemedText style={styles.recipeModalHeaderTitle}>
                  {t("form.title")}
                </ThemedText>
                <ThemedText style={styles.recipeModalHeaderSubtitle}>
                  {t("form.subtitle")}
                </ThemedText>
              </View>
              <View style={styles.recipeModalHeaderSpacer} />
            </View>
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={styles.formHint}>{t("form.hint")}</ThemedText>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  {t("form.name")}
                </ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder={t("form.namePlaceholder")}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  {t("form.description")}
                </ThemedText>
                <TextInput
                  style={[styles.formInput, styles.formMultiline]}
                  placeholder={t("form.descriptionPlaceholder")}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.formRow}>
                <View style={styles.formRowItem}>
                  <ThemedText style={styles.formLabel}>
                    {t("form.age")}
                  </ThemedText>
                  <TextInput
                    style={styles.formInput}
                    placeholder={`${RECIPE_AGE_LIMITS.min}-${RECIPE_AGE_LIMITS.max}`}
                    value={newMinMonths}
                    onChangeText={(text) =>
                      setNewMinMonths(text.replace(/[^0-9]/g, ""))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>
                <View style={styles.formRowItem}>
                  <ThemedText style={styles.formLabel}>
                    {t("form.tip")}
                  </ThemedText>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t("form.tipPlaceholder")}
                    value={newTip}
                    onChangeText={setNewTip}
                    placeholderTextColor={placeholderTextColor}
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  {t("form.ingredients")}
                </ThemedText>
                <View style={styles.formRow}>
                  <TextInput
                    style={[styles.formInput, styles.formRowInput]}
                    placeholder={t("form.ingredientPlaceholder")}
                    value={newIngredientInput}
                    onChangeText={setNewIngredientInput}
                    onSubmitEditing={addIngredientToForm}
                    placeholderTextColor={placeholderTextColor}
                  />
                  <TouchableOpacity
                    style={styles.formAddButton}
                    onPress={addIngredientToForm}
                    activeOpacity={0.85}
                  >
                    <IconSymbol name="plus" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.formChipRow}>
                  {newIngredients.length === 0 ? (
                    <ThemedText style={styles.formChipHint}>
                      {t("form.noIngredients")}
                    </ThemedText>
                  ) : (
                    newIngredients.map((ingredient) => (
                      <TouchableOpacity
                        key={ingredient}
                        style={styles.formChip}
                        onPress={() => removeIngredientFromForm(ingredient)}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.formChipText}>
                          {ingredient}
                        </ThemedText>
                        <IconSymbol
                          name="xmark.circle.fill"
                          size={16}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  {t("form.allergens")}
                </ThemedText>
                <View style={styles.formChipRow}>
                  {ALLERGEN_OPTIONS.map((option) => {
                    const isSelected = newAllergens.includes(option.id);
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.formAllergenChip,
                          isSelected && styles.formAllergenSelected,
                        ]}
                        onPress={() => toggleNewAllergen(option.id)}
                        activeOpacity={0.85}
                      >
                        <ThemedText
                          style={[
                            styles.formAllergenLabel,
                            isSelected && styles.formAllergenLabelSelected,
                          ]}
                        >
                          {t(option.labelKey)}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  {t("form.instructions")}
                </ThemedText>
                <TextInput
                  style={[
                    styles.formInput,
                    styles.formMultiline,
                    styles.formInstructions,
                  ]}
                  placeholder={t("form.instructionsPlaceholder")}
                  value={newInstructions}
                  onChangeText={setNewInstructions}
                  multiline
                  numberOfLines={5}
                  placeholderTextColor={placeholderTextColor}
                />
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  {t("form.video")}
                </ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder={t("form.videoPlaceholder")}
                  value={newVideoUrl}
                  onChangeText={setNewVideoUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholderTextColor={placeholderTextColor}
                />
                <ThemedText style={styles.formChipHint}>
                  {t("form.videoHint")}
                </ThemedText>
              </View>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>
                  {t("form.image")}
                </ThemedText>
                {newImage ? (
                  <View style={styles.formImagePreviewWrapper}>
                    <Image
                      source={{ uri: newImage }}
                      style={styles.formImagePreview}
                      contentFit="cover"
                      cachePolicy="memory"
                      transition={200}
                    />
                    <TouchableOpacity
                      style={styles.formImageRemove}
                      onPress={() => setNewImage(null)}
                      activeOpacity={0.85}
                    >
                      <IconSymbol name="trash" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.formImageRemoveText}>
                        {t("common.remove")}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.formImagePicker}
                    onPress={pickRecipeImage}
                    activeOpacity={0.85}
                  >
                    <IconSymbol name="camera" size={22} color={accentColor} />
                    <ThemedText style={styles.formImagePickerText}>
                      {t("form.imagePicker")}
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
                  <ThemedText style={styles.formCancelText}>
                    {t("common.cancel")}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formActionButton, styles.formSubmitButton]}
                  onPress={handleCreateRecipe}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.formSubmitText}>
                      {t("common.save")}
                    </ThemedText>
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
type RecipeGeneratorStyleParams = {
  isDark: boolean;
  isCompact: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accentColor: string;
  glassOverlay: string;
  glassBorder: string;
};

const createStyles = ({
  isDark,
  isCompact,
  textPrimary,
  textSecondary,
  textTertiary,
  accentColor,
  glassOverlay,
  glassBorder,
}: RecipeGeneratorStyleParams) =>
  StyleSheet.create({
    background: {
      flex: 1,
      backgroundColor: "transparent",
    },
    safeArea: {
      flex: 1,
    },
    overlayContainer: {
      width: "100%",
      position: "relative",
    },
    headerActions: {
      position: "absolute",
      top: 12,
      right: 60, // Verschoben nach links, um Platz für den BabySwitcherButton zu lassen
      flexDirection: "row",
      gap: 10,
      zIndex: 10,
    },
    headerActionButton: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 19,
      backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.75)",
      borderWidth: 1,
      borderColor: glassBorder,
    },
    scrollContent: {
      paddingBottom: 100,
      paddingHorizontal: SCREEN_PADDING,
      alignItems: "center",
    },
    contentContainer: {
      alignSelf: "center",
      paddingTop: 4,
    },
    card: {
      marginBottom: CARD_SPACING,
      padding: CARD_INTERNAL_PADDING,
      borderRadius: 26,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.16 : 0.07,
      shadowRadius: 18,
      elevation: 3,
    },
    topCard: {
      width: "100%",
      alignSelf: "stretch",
      marginBottom: 12,
      overflow: "hidden",
      padding: isCompact ? 18 : 22,
    },
    recipeCard: {
      paddingHorizontal: CARD_INTERNAL_PADDING,
      paddingVertical: CARD_INTERNAL_PADDING,
    },
    imageHeader: {
      marginTop: -CARD_INTERNAL_PADDING,
      marginHorizontal: -CARD_INTERNAL_PADDING,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      overflow: "hidden",
      position: "relative",
    },
    imageHeaderImg: {
      width: "100%",
      aspectRatio: 16 / 9,
      maxHeight: isCompact ? 180 : 220,
    },
    imageHeaderPlaceholder: {
      backgroundColor: toRgba(accentColor, isDark ? 0.45 : 0.28),
      alignItems: "center",
      justifyContent: "center",
    },
    imageHeaderOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: isDark ? "rgba(0,0,0,0.34)" : "rgba(0,0,0,0.18)",
    },
    imageHeaderBadges: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 12,
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    imageHeaderBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.38)",
    },
    imageHeaderWarn: {
      backgroundColor: "rgba(255,87,87,0.7)",
    },
    imageHeaderBadgeText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },
    heroGlowLarge: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 90,
      right: -70,
      top: -85,
      backgroundColor: toRgba(accentColor, isDark ? 0.18 : 0.1),
    },
    heroGlowSmall: {
      position: "absolute",
      width: 90,
      height: 90,
      borderRadius: 45,
      left: -45,
      bottom: -48,
      backgroundColor: toRgba(accentColor, isDark ? 0.12 : 0.07),
    },
    heroRow: {
      flexDirection: isCompact ? "column" : "row",
      alignItems: isCompact ? "flex-start" : "center",
      gap: 16,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: toRgba(accentColor, isDark ? 0.28 : 0.14),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: toRgba(accentColor, isDark ? 0.34 : 0.18),
    },
    heroTextWrap: {
      flex: 1,
      alignItems: "flex-start",
      gap: 4,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: accentColor,
      letterSpacing: 1.15,
      marginBottom: 1,
    },
    heroTitle: {
      fontSize: isCompact ? 23 : 25,
      fontWeight: "800",
      color: textPrimary,
      letterSpacing: -0.55,
      textAlign: "left",
      lineHeight: 30,
    },
    heroSubtitle: {
      fontSize: 14,
      color: textSecondary,
      lineHeight: 20,
      textAlign: "left",
    },
    heroStatsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 18,
    },
    heroStatPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(0,0,0,0.24)" : "rgba(255,255,255,0.52)",
      borderWidth: 1,
      borderColor: glassBorder,
    },
    heroStatText: {
      fontSize: 12,
      fontWeight: "700",
      color: textSecondary,
    },
    // Action Section
    actionCard: {
      paddingHorizontal: CARD_INTERNAL_PADDING + 8,
      paddingVertical: CARD_INTERNAL_PADDING + 6,
    },
    actionContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    actionIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: toRgba(accentColor, isDark ? 0.28 : 0.18),
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
      marginVertical: 4,
    },
    actionTextWrap: {
      flex: 1,
      gap: 2,
    },
    actionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: textSecondary,
      lineHeight: 24,
    },
    actionChevron: {
      padding: 6,
      borderRadius: 18,
      backgroundColor: toRgba(accentColor, isDark ? 0.2 : 0.12),
      marginRight: 6,
      marginVertical: 4,
    },
    quickActionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 22,
    },
    quickActionButton: {
      flex: 1,
      minHeight: 112,
      paddingVertical: 13,
      paddingHorizontal: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: isDark ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.35)",
      overflow: "hidden",
      position: "relative",
    },
    quickActionButtonActive: {
      borderColor: toRgba(accentColor, isDark ? 0.65 : 0.5),
    },
    quickActionOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: glassOverlay,
    },
    quickActionOverlayActive: {
      backgroundColor: toRgba(accentColor, isDark ? 0.28 : 0.16),
    },
    quickActionContent: {
      alignItems: "center",
    },
    quickActionIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.6)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.65)",
      marginBottom: 7,
    },
    quickActionLabel: {
      fontSize: isCompact ? 12 : 13,
      fontWeight: "700",
      color: textPrimary,
      textAlign: "center",
    },
    quickActionMeta: {
      fontSize: 12,
      color: textSecondary,
      marginTop: 2,
      fontWeight: "500",
      textAlign: "center",
    },
    quickActionBadge: {
      position: "absolute",
      top: -6,
      right: -6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: accentColor,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    quickActionBadgeText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    sectionHeader: {
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: 20, // Größere Schrift für bessere Sichtbarkeit
      fontWeight: "600",
      color: textSecondary,
      letterSpacing: -0.2,
      textAlign: "center",
      lineHeight: 26,
    },
    sectionHint: {
      fontSize: 15, // Größere Schrift für bessere Lesbarkeit
      color: textSecondary,
      marginBottom: 8,
      lineHeight: 22,
      textAlign: "center",
    },
    ageControlRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    ageButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: toRgba(accentColor, isDark ? 0.28 : 0.16),
      alignItems: "center",
      justifyContent: "center",
    },
    ageButtonText: {
      fontSize: 22,
      fontWeight: "600",
      color: accentColor,
    },
    ageBadge: {
      alignItems: "center",
      paddingHorizontal: 24,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: toRgba(accentColor, isDark ? 0.22 : 0.12),
    },
    ageValue: {
      fontSize: 20,
      fontWeight: "700",
      color: textSecondary,
      fontVariant: ["tabular-nums"],
    },
    ageLabel: {
      fontSize: 12,
      color: textSecondary,
      fontWeight: "500",
    },
    chipGrid: {
      paddingHorizontal: GRID_GAP,
      paddingTop: GRID_GAP,
      paddingBottom: GRID_GAP,
    },
    gridRow: {
      flexDirection: "row",
      width: "100%",
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
      width: "100%",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.18)",
    },
    chipSelected: {
      backgroundColor: toRgba(accentColor, isDark ? 0.34 : 0.22),
    },
    chipLabel: {
      fontSize: 15, // Größere Schrift für bessere Lesbarkeit
      fontWeight: "600",
      color: textSecondary,
    },
    chipLabelSelected: {
      color: accentColor,
    },
    chipHint: {
      fontSize: 13, // Größere Schrift für bessere Lesbarkeit
      color: textSecondary,
      marginTop: 4,
      fontWeight: "500",
      lineHeight: 18,
    },
    filterModalCard: {
      maxHeight: "80%",
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
      fontWeight: "600",
      color: textSecondary,
      textAlign: "center",
    },
    ingredientLabelSelected: {
      color: "#FFFFFF",
    },
    loadingWrapper: {
      marginTop: 28,
      alignItems: "center",
      gap: 8,
    },
    loadingText: {
      fontSize: 14,
      color: textSecondary,
      fontWeight: "500",
    },
    emptyStateBody: {
      alignItems: "center",
      gap: 8,
    },
    emptyStateTitle: {
      fontSize: 20, // Größere Schrift für bessere Sichtbarkeit
      fontWeight: "700",
      color: textSecondary,
      textAlign: "center",
      lineHeight: 26,
    },
    emptyStateText: {
      fontSize: 15, // Größere Schrift für bessere Lesbarkeit
      textAlign: "center",
      color: textSecondary,
      lineHeight: 22,
    },
    seedButton: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 20,
      backgroundColor: accentColor,
    },
    seedButtonDisabled: {
      opacity: 0.7,
    },
    seedButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    recipeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start", // Besser für mehrzeilige Titel
      marginBottom: 8,
      gap: 6,
    },
    recipeTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: textPrimary,
      flex: 1,
      lineHeight: 24,
      paddingRight: 6,
      paddingLeft: 2,
    },
    recipeDescription: {
      fontSize: 15, // Größere Schrift für bessere Lesbarkeit
      lineHeight: 22,
      color: textSecondary,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    statPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: toRgba(accentColor, isDark ? 0.2 : 0.1),
    },
    statText: {
      fontSize: 14, // Größere Schrift für bessere Lesbarkeit
      color: textSecondary,
      fontWeight: "500",
    },
    ageTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: accentColor,
    },
    ageTagText: {
      color: "#FFFFFF",
      fontSize: 13, // Größere Schrift für bessere Lesbarkeit
      fontWeight: "600",
    },
    noticeTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: textSecondary,
      marginBottom: 8,
      textAlign: "left",
    },
    noticeText: {
      fontSize: 14,
      color: textSecondary,
      lineHeight: 20,
      textAlign: "left",
    },
    catalogHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      paddingHorizontal: 2,
      gap: 12,
    },
    catalogTitleGroup: {
      flex: 1,
      gap: 2,
    },
    catalogTitle: {
      fontSize: 21,
      fontWeight: "800",
      color: textPrimary,
      letterSpacing: -0.35,
      textAlign: "left",
      lineHeight: 26,
    },
    catalogCount: {
      fontSize: 13,
      color: textTertiary,
      fontWeight: "600",
    },
    refreshButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: toRgba(accentColor, isDark ? 0.28 : 0.15),
    },
    refreshLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: accentColor,
    },
    catalogTextColumn: {
      marginTop: 14,
      flex: 1,
      minWidth: 0,
    },
    catalogDescription: {
      fontSize: 15, // Größere Schrift für bessere Lesbarkeit
      color: textSecondary,
      marginTop: 6,
      marginBottom: 10,
      lineHeight: 22,
      paddingHorizontal: 2,
    },
    catalogMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 2,
    },
    disabledRecipeCard: {
      opacity: 0.68,
    },
    disabledRecipeTitle: {
      color: isDark ? "rgba(255,255,255,0.68)" : "rgba(125,90,80,0.6)",
    },
    disabledNotice: {
      fontSize: 14,
      color: isDark ? "rgba(240,230,220,0.8)" : "rgba(125,90,80,0.7)",
      lineHeight: 20,
      paddingHorizontal: 6, // Abstand vom Rand - nichts direkt am Rand
    },
    disabledAgeTag: {
      backgroundColor: toRgba(accentColor, isDark ? 0.44 : 0.35),
    },
    recipeModalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: isDark ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.45)",
    },
    recipeModalCard: {
      width: "100%",
      maxHeight: "92%",
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: "hidden",
      paddingTop: 16,
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    recipeModalHandle: {
      width: 56,
      height: 5,
      borderRadius: 3,
      backgroundColor: isDark
        ? "rgba(255,255,255,0.42)"
        : "rgba(255,255,255,0.8)",
      alignSelf: "center",
      marginBottom: 16,
    },
    recipeModalHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    recipeModalHeaderButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.85)",
      alignItems: "center",
      justifyContent: "center",
    },
    recipeModalHeaderSpacer: {
      width: 44,
      height: 44,
    },
    recipeModalHeaderCenter: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 12,
    },
    recipeModalHeaderTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: textSecondary,
    },
    recipeModalHeaderSubtitle: {
      fontSize: 13,
      color: textTertiary,
      marginTop: 4,
    },
    recipeModalScroll: {
      paddingBottom: 80,
    },
    recipeHeroCard: {
      borderRadius: 28,
      overflow: "hidden",
      marginBottom: 16,
      minHeight: isCompact ? 220 : 260,
      backgroundColor: toRgba(accentColor, isDark ? 0.42 : 0.25),
      justifyContent: "flex-end",
    },
    recipeHeroTint: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    recipeHeroSolid: {
      backgroundColor: toRgba(accentColor, isDark ? 0.54 : 0.35),
    },
    recipeHeroContent: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 24,
      paddingVertical: 24,
      gap: 12,
    },
    recipeHeroTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: "#FFFFFF",
      lineHeight: 30,
    },
    recipeHeroChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    recipeHeroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    recipeHeroChipWarn: {
      backgroundColor: "rgba(255,87,87,0.75)",
    },
    recipeHeroChipText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "600",
    },
    recipeModalDescription: {
      fontSize: 15,
      color: textSecondary,
      lineHeight: 22,
      marginBottom: 16,
    },
    recipeInfoChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 16,
    },
    recipeInfoChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: isDark ? "rgba(0,0,0,0.44)" : "rgba(255,255,255,0.9)",
      flexGrow: 1,
    },
    recipeInfoChipSafe: {
      backgroundColor: toRgba(accentColor, isDark ? 0.28 : 0.18),
    },
    recipeInfoChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: textSecondary,
    },
    recipeInfoChipTextSafe: {
      color: accentColor,
    },
    recipeSectionCard: {
      borderRadius: 20,
      padding: 20,
      backgroundColor: isDark ? "rgba(0,0,0,0.42)" : "rgba(255,255,255,0.95)",
      marginBottom: 16,
    },
    recipeSectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: textSecondary,
      marginBottom: 12,
    },
    recipeIngredientRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
    },
    recipeIngredientDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: accentColor,
    },
    recipeIngredientText: {
      fontSize: 14,
      color: textSecondary,
      flex: 1,
    },
    ingredientsToListButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      height: 44,
      borderRadius: 14,
      backgroundColor: accentColor,
    },
    ingredientsToListButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    recipeInstructions: {
      fontSize: 14,
      color: textSecondary,
      lineHeight: 22,
    },
    recipeInstructionsIntro: {
      marginBottom: 12,
    },
    recipeSteps: {
      gap: 12,
    },
    recipeStepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    recipeStepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: accentColor,
      marginTop: 2,
    },
    recipeStepBadgeText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },
    recipeStepText: {
      flex: 1,
      fontSize: 14,
      color: textSecondary,
      lineHeight: 22,
    },
    recipeTipCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: toRgba(accentColor, isDark ? 0.22 : 0.12),
    },
    recipeTipText: {
      flex: 1,
      fontSize: 14,
      color: textSecondary,
      lineHeight: 20,
    },
    recipeDisclaimer: {
      fontSize: 11,
      color: textTertiary,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 8,
      paddingHorizontal: 8,
    },
    createModalCard: {
      maxHeight: "96%",
      paddingBottom: 48,
    },
    formContent: {
      paddingBottom: 48,
      paddingHorizontal: 4,
      gap: 24,
    },
    formHint: {
      fontSize: 14,
      color: textSecondary,
      lineHeight: 20,
    },
    formGroup: {
      gap: 8,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: textSecondary,
    },
    formInput: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(125,90,80,0.2)",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.85)",
      fontSize: 14,
      color: textPrimary,
    },
    formMultiline: {
      minHeight: 96,
      textAlignVertical: "top",
    },
    formInstructions: {
      minHeight: 120,
    },
    formRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
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
      backgroundColor: accentColor,
      alignItems: "center",
      justifyContent: "center",
    },
    formChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    formChipHint: {
      fontSize: 13,
      color: isDark ? "rgba(240,230,220,0.75)" : "rgba(125,90,80,0.7)",
      fontWeight: "500",
    },
    formChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: accentColor,
    },
    formChipText: {
      fontSize: 13,
      color: "#FFFFFF",
      fontWeight: "600",
    },
    formAllergenChip: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(125,90,80,0.25)",
      backgroundColor: isDark ? "rgba(0,0,0,0.28)" : "transparent",
    },
    formAllergenSelected: {
      backgroundColor: toRgba(accentColor, isDark ? 0.34 : 0.22),
      borderColor: toRgba(accentColor, isDark ? 0.52 : 0.4),
    },
    formAllergenLabel: {
      fontSize: 14,
      color: textSecondary,
      fontWeight: "600",
    },
    formAllergenLabelSelected: {
      color: accentColor,
    },
    formImagePicker: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(125,90,80,0.2)",
      borderWidth: 1,
      backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.85)",
    },
    formImagePickerText: {
      fontSize: 14,
      color: accentColor,
      fontWeight: "600",
    },
    formImagePreviewWrapper: {
      gap: 8,
    },
    formImagePreview: {
      width: "100%",
      height: 180,
      borderRadius: 20,
    },
    formImageRemove: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: toRgba(accentColor, isDark ? 0.72 : 0.6),
    },
    formImageRemoveText: {
      fontSize: 14,
      color: "#FFFFFF",
      fontWeight: "600",
    },
    formActions: {
      flexDirection: "row",
      gap: 16,
      marginTop: 16,
    },
    formActionButton: {
      flex: 1,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: "center",
      minHeight: 56,
      justifyContent: "center",
    },
    formCancelButton: {
      backgroundColor: isDark
        ? "rgba(255,255,255,0.12)"
        : "rgba(125,90,80,0.15)",
    },
    formSubmitButton: {
      backgroundColor: accentColor,
    },
    formCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: textSecondary,
    },
    formSubmitText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
    },
  });
