import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
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
} from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';

type AllergenId = 'milk' | 'gluten' | 'egg' | 'nuts' | 'fish';

type RecipeDefinition = {
  id: string;
  title: string;
  description: string;
  minMonths: number;
  ingredients: string[];
  allergens: AllergenId[];
  tip: string;
};

type RecipeMatch = {
  recipe: RecipeDefinition;
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
    ],
  },
  {
    key: 'carbs',
    label: 'Getreide & Sättigendes',
    items: ['Haferflocken', 'Hirse', 'Reis', 'Kartoffel', 'Vollkornbrot', 'Polenta'],
  },
  {
    key: 'proteins',
    label: 'Proteine',
    items: ['Hühnchen', 'Lachs', 'Kichererbsen', 'Linsen', 'Naturjoghurt', 'Ei', 'Tofu'],
  },
  {
    key: 'extras',
    label: 'Extras & Fette',
    items: ['Rapsöl', 'Olivenöl', 'Butter', 'Kräuter', 'Erbsen', 'Mais', 'Frischkäse'],
  },
];

const RECIPE_LIBRARY: RecipeDefinition[] = [
  {
    id: 'sweet-potato-mash',
    title: 'Süßkartoffel & Kichererbsen Mash',
    description: 'Cremiger BLW-Mash mit milden Kräutern – perfekt zum Löffeln oder Dippen.',
    minMonths: 6,
    ingredients: ['Süßkartoffel', 'Kichererbsen', 'Rapsöl', 'Kräuter'],
    allergens: [],
    tip: 'Kichererbsen kurz pürieren, damit kleine Hände sie gut greifen können.',
  },
  {
    id: 'apple-oat-porridge',
    title: 'Apfel-Hafer-Porridge',
    description: 'Warmer Haferschmaus mit Apfelstückchen und optional einem Klecks Joghurt.',
    minMonths: 6,
    ingredients: ['Haferflocken', 'Apfel', 'Naturjoghurt', 'Rapsöl'],
    allergens: ['gluten', 'milk'],
    tip: 'Für Milchfrei einfach den Joghurt durch Haferdrink ersetzen.',
  },
  {
    id: 'broccoli-fish-fingers',
    title: 'Brokkoli-Lachs-Bällchen',
    description: 'Weiche Fingerfood-Bällchen mit Omega-3-Power – lassen sich gut vorbereiten.',
    minMonths: 7,
    ingredients: ['Brokkoli', 'Lachs', 'Kartoffel', 'Olivenöl'],
    allergens: ['fish'],
    tip: 'Im Ofen backen, bis sie außen leicht gold werden – dann zerfallen sie nicht.',
  },
  {
    id: 'banana-millet-pancakes',
    title: 'Banane-Hirse-Puffer',
    description: 'Schnelle Puffer ohne Zucker – ideal als Frühstück oder Snack.',
    minMonths: 8,
    ingredients: ['Banane', 'Hirse', 'Ei', 'Rapsöl'],
    allergens: ['egg'],
    tip: 'Für allergiefreundliche Variante das Ei durch Apfelmus ersetzen.',
  },
  {
    id: 'green-toast',
    title: 'Avocado-Erbsen-Toast',
    description: 'Weicher Toast mit cremigem Belag – prima zum Selbstschmieren üben.',
    minMonths: 9,
    ingredients: ['Vollkornbrot', 'Avocado', 'Erbsen', 'Frischkäse'],
    allergens: ['gluten', 'milk'],
    tip: 'Rinde entfernen, damit es kleine Esser leichter haben.',
  },
];

const RecipeGeneratorScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [ageMonths, setAgeMonths] = useState<number>(8);
  const [selectedAllergies, setSelectedAllergies] = useState<AllergenId[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [recipeMatches, setRecipeMatches] = useState<RecipeMatch[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const selectedIngredientSet = useMemo(() => new Set(availableIngredients), [availableIngredients]);

  const toggleAllergy = (allergen: AllergenId) => {
    setSelectedAllergies((prev) =>
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
    if (availableIngredients.length === 0) {
      Alert.alert('Noch keine Vorräte ausgewählt', 'Hake ein paar Zutaten an, damit wir passende Rezepte finden können.');
      return;
    }

    const matches = RECIPE_LIBRARY.map((recipe) => {
      const matching = recipe.ingredients.filter((ingredient) =>
        selectedIngredientSet.has(ingredient)
      );
      const missing = recipe.ingredients.filter(
        (ingredient) => !selectedIngredientSet.has(ingredient)
      );
      const hasBlockedAllergen = recipe.allergens.some((allergen) =>
        selectedAllergies.includes(allergen)
      );
      const meetsAge = ageMonths >= recipe.minMonths;

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
          return a.recipe.minMonths - b.recipe.minMonths;
        }
        return b.matchCount - a.matchCount;
      })
      .slice(0, 4)
      .map(({ recipe, matchCount, missingIngredients }) => ({
        recipe,
        matchCount,
        missingIngredients,
      }));

    setRecipeMatches(matches);
    setHasGenerated(true);
  };

  const disabledIngredientsCount = useMemo(() => {
    if (selectedAllergies.length === 0) return 0;
    return RECIPE_LIBRARY.reduce((acc, recipe) => {
      if (recipe.allergens.some((item) => selectedAllergies.includes(item))) {
        return acc + 1;
      }
      return acc;
    }, 0);
  }, [selectedAllergies]);

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

          <ScrollView contentContainerStyle={styles.content}>
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
                    >
                      <View style={styles.recipeHeader}>
                        <ThemedText style={styles.recipeTitle}>{match.recipe.title}</ThemedText>
                        <View style={styles.ageTag}>
                          <IconSymbol name="clock" size={16} color="#FFFFFF" />
                          <ThemedText style={styles.ageTagText}>
                            ab {match.recipe.minMonths} M
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
                        <ThemedText style={styles.tipText}>{match.recipe.tip}</ThemedText>
                      </View>
                    </LiquidGlassCard>
                  ))
                )}
              </View>
            )}

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
