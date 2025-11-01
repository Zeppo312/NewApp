import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import {
  GlassCard,
  LiquidGlassCard,
  LAYOUT_PAD,
  PRIMARY,
  SECTION_GAP_BOTTOM,
  SECTION_GAP_TOP,
  TEXT_PRIMARY,
} from '@/constants/DesignGuide';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';

type Recipe = {
  id: string;
  title: string;
  minMonths: number;
  maxMonths?: number;
  description: string;
  ingredients: string[];
  allergens: string[];
  tags: string[];
  steps: string[];
};

type GeneratedRecipe = Recipe & {
  missingIngredients: string[];
  matchedIngredients: number;
  score: number;
};

const RECIPE_LIBRARY: Recipe[] = [
  {
    id: 'avocado-hirse',
    title: 'Avocado-Hirse-Häppchen',
    minMonths: 6,
    description: 'Cremige Avocado mit weicher Hirse – perfekt für kleine Hände und reich an Eisen.',
    ingredients: ['avocado', 'hirse', 'banane', 'olivenöl'],
    allergens: [],
    tags: ['fingerfood', 'herzhaft', 'eisenreich'],
    steps: [
      'Hirse nach Packungsanweisung sehr weich kochen.',
      'Avocado und Banane zerdrücken und mit etwas Olivenöl vermengen.',
      'Alles zu kleinen Häppchen formen und optional kurz in der Pfanne erwärmen.',
    ],
  },
  {
    id: 'süßkartoffel-linsen',
    title: 'Süßkartoffel-Linsen-Püree',
    minMonths: 6,
    description: 'Sämiges Püree aus Süßkartoffel und roten Linsen, sanft gewürzt.',
    ingredients: ['süßkartoffel', 'rote linsen', 'kumin', 'kokosmilch'],
    allergens: [],
    tags: ['püree', 'pflanzlich', 'proteinreich'],
    steps: [
      'Süßkartoffel schälen, würfeln und weich dämpfen.',
      'Rote Linsen mit etwas Kokosmilch weich kochen.',
      'Beides vermengen, fein pürieren und mit einer Prise mildem Kumin abschmecken.',
    ],
  },
  {
    id: 'hafer-apfel',
    title: 'Hafer-Apfel-Pfännchen',
    minMonths: 7,
    description: 'Weiche Ofenpfännchen aus Haferflocken, Apfel und Ei – prima als Frühstück.',
    ingredients: ['haferflocken', 'apfel', 'ei', 'zimt'],
    allergens: ['ei'],
    tags: ['frühstück', 'fingerfood', 'süß'],
    steps: [
      'Haferflocken mit fein geriebenem Apfel, Ei und einer Prise Zimt verrühren.',
      'In kleine Silikonförmchen füllen und bei 180 °C ca. 15 Minuten backen.',
      'Vor dem Servieren kurz abkühlen lassen.',
    ],
  },
  {
    id: 'brokkoli-kichererbsen',
    title: 'Brokkoli-Kichererbsen-Taler',
    minMonths: 8,
    description: 'Weiche Taler mit Brokkoli und Kichererbsen – sättigend und voller Ballaststoffe.',
    ingredients: ['brokkoli', 'kichererbsen', 'haferflocken', 'zitronensaft'],
    allergens: [],
    tags: ['fingerfood', 'herzhaft', 'proteinreich'],
    steps: [
      'Brokkoli sehr weich dämpfen und fein hacken.',
      'Mit Kichererbsen und Haferflocken pürieren, bis eine formbare Masse entsteht.',
      'Mit etwas Zitronensaft abschmecken, Taler formen und in der Pfanne langsam anbraten.',
    ],
  },
  {
    id: 'birnen-quark',
    title: 'Birnen-Quark-Creme',
    minMonths: 9,
    description: 'Cremiges Dessert mit gedünsteter Birne und mildem Quark für kleine Genießer:innen.',
    ingredients: ['birne', 'milder quark', 'vanille', 'dinkelgrieß'],
    allergens: ['milch'],
    tags: ['dessert', 'süß', 'kalziumreich'],
    steps: [
      'Birne schälen, würfeln und weich dünsten.',
      'Mit Vanille und einem Löffel Dinkelgrieß kurz aufkochen.',
      'Etwas abkühlen lassen und mit mildem Quark cremig verrühren.',
    ],
  },
];

const splitInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export default function RecipeGeneratorScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();

  const [babyAge, setBabyAge] = useState('6');
  const [ingredients, setIngredients] = useState('');
  const [preferences, setPreferences] = useState('');
  const [allergies, setAllergies] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [results, setResults] = useState<GeneratedRecipe[]>([]);

  const infoTextColor = colorScheme === 'dark' ? '#fdf7f1' : TEXT_PRIMARY;

  const handleGenerate = () => {
    if (isGenerating) return;

    setIsGenerating(true);

    requestAnimationFrame(() => {
      const ageInMonths = Math.max(4, parseInt(babyAge, 10) || 0);
      const availableIngredients = splitInput(ingredients);
      const preferredKeywords = splitInput(preferences);
      const blockedAllergens = splitInput(allergies);

      const scoredRecipes = RECIPE_LIBRARY
        .filter((recipe) => ageInMonths >= recipe.minMonths && (!recipe.maxMonths || ageInMonths <= recipe.maxMonths))
        .filter((recipe) => blockedAllergens.every((allergen) => !recipe.allergens.includes(allergen)))
        .map<GeneratedRecipe>((recipe) => {
          const matchedIngredients = availableIngredients.reduce(
            (count, ingredient) => (recipe.ingredients.includes(ingredient) ? count + 1 : count),
            0,
          );

          const preferenceHits = preferredKeywords.reduce(
            (count, pref) => (recipe.tags.some((tag) => tag.includes(pref)) ? count + 1 : count),
            0,
          );

          const score = matchedIngredients * 2 + preferenceHits;
          const missingIngredients = recipe.ingredients.filter((ingredient) => !availableIngredients.includes(ingredient));

          return {
            ...recipe,
            matchedIngredients,
            missingIngredients,
            score,
          };
        })
        .filter((recipe) => availableIngredients.length === 0 || recipe.matchedIngredients > 0)
        .sort((a, b) => b.score - a.score || a.minMonths - b.minMonths);

      setResults(scoredRecipes.slice(0, 3));
      setHasGenerated(true);
      setIsGenerating(false);
    });
  };

  const helperHint = useMemo(() => {
    const age = parseInt(babyAge, 10);
    if (!Number.isFinite(age)) return 'Gib das Alter in Monaten ein (z. B. 6).';
    if (age < 6) return 'Für BLW empfehlen wir ab etwa 6 Monaten – achte auf Reifezeichen!';
    if (age >= 10) return 'Ab 10 Monaten dürfen die Rezepte gern stückiger sein – probier mehr Fingerfood.';
    return 'Perfekt! BLW-Rezepte lassen sich wunderbar mit euren Zutaten kombinieren.';
  }, [babyAge]);

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header
          title="BLW-Rezepte"
          subtitle="Passend zu Babyalter, Vorräten & Allergien"
          showBackButton
          onBackPress={() => router.back()}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <GlassCard style={styles.infoCard} intensity={28} overlayColor="rgba(255,255,255,0.28)" borderColor="rgba(255,255,255,0.45)">
            <ThemedText style={[styles.infoTitle, { color: PRIMARY }]}>So funktioniert's</ThemedText>
            <ThemedText style={[styles.infoText, { color: infoTextColor }]}>
              Wir schlagen dir BLW-Rezepte vor, die zu eurem Babyalter passen und eure Vorräte nutzen. Zutaten oder Allergene
              kannst du einfach kommagetrennt eingeben.
            </ThemedText>
          </GlassCard>

          <GlassCard style={styles.formCard} intensity={26}>
            <ThemedText style={styles.label}>Babyalter (Monate)</ThemedText>
            <TextInput
              value={babyAge}
              onChangeText={setBabyAge}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              style={styles.input}
              placeholder="z. B. 6"
              placeholderTextColor="rgba(125,90,80,0.45)"
            />
            <ThemedText style={[styles.helperText, { color: infoTextColor }]}>{helperHint}</ThemedText>
          </GlassCard>

          <GlassCard style={styles.formCard} intensity={26}>
            <ThemedText style={styles.label}>Welche Zutaten habt ihr gerade da?</ThemedText>
            <TextInput
              value={ingredients}
              onChangeText={setIngredients}
              style={[styles.input, styles.multilineInput]}
              multiline
              placeholder="z. B. Süßkartoffel, Avocado, Haferflocken"
              placeholderTextColor="rgba(125,90,80,0.45)"
            />
            <ThemedText style={styles.helperText}>Tipp: Je genauer, desto besser passen die Rezepte.</ThemedText>
          </GlassCard>

          <GlassCard style={styles.formCard} intensity={26}>
            <ThemedText style={styles.label}>Vorlieben oder Allergien?</ThemedText>
            <TextInput
              value={preferences}
              onChangeText={setPreferences}
              style={[styles.input, styles.multilineInput]}
              multiline
              placeholder="z. B. fingerfood, süß, ohne Ei"
              placeholderTextColor="rgba(125,90,80,0.45)"
            />
            <TextInput
              value={allergies}
              onChangeText={setAllergies}
              style={[styles.input, styles.multilineInput, styles.allergyInput]}
              multiline
              placeholder="Allergene: Milch, Ei, Nüsse ..."
              placeholderTextColor="rgba(125,90,80,0.45)"
            />
          </GlassCard>

          <LiquidGlassCard
            style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
            overlayColor="rgba(142, 78, 198, 0.55)"
            borderColor="rgba(142, 78, 198, 0.65)"
            onPress={handleGenerate}
            activeOpacity={0.85}
          >
            <View style={styles.generateButtonContent}>
              <IconSymbol name="fork.knife" size={22} color="#FFFFFF" />
              <ThemedText style={styles.generateButtonText}>
                {isGenerating ? 'Zaubere Rezepte...' : 'Rezepte generieren'}
              </ThemedText>
            </View>
          </LiquidGlassCard>

          <View style={styles.resultsSection}>
            <ThemedText style={styles.resultsTitle}>Deine Vorschläge</ThemedText>

            {!hasGenerated && (
              <GlassCard style={styles.placeholderCard} intensity={24} overlayColor="rgba(255,255,255,0.22)">
                <ThemedText style={styles.placeholderText}>
                  Starte mit euren Lieblingszutaten – wir stellen passende BLW-Ideen zusammen.
                </ThemedText>
              </GlassCard>
            )}

            {hasGenerated && results.length === 0 && (
              <GlassCard style={styles.placeholderCard} intensity={24} overlayColor="rgba(255,255,255,0.22)">
                <ThemedText style={styles.placeholderText}>
                  Keine passenden Rezepte gefunden. Probier es mit anderen Zutaten oder entferne einzelne Allergene.
                </ThemedText>
              </GlassCard>
            )}

            {results.map((recipe) => (
              <GlassCard key={recipe.id} style={styles.recipeCard} intensity={28} overlayColor="rgba(255,255,255,0.32)" borderColor="rgba(255,255,255,0.5)">
                <View style={styles.recipeHeader}>
                  <ThemedText style={[styles.recipeTitle, { color: PRIMARY }]}>🍲 {recipe.title}</ThemedText>
                  <ThemedText style={styles.recipeMeta}>
                    ab {recipe.minMonths} Monaten • {recipe.tags.join(' • ')}
                  </ThemedText>
                </View>

                <ThemedText style={styles.recipeDescription}>{recipe.description}</ThemedText>

                <View style={styles.subSection}>
                  <ThemedText style={styles.subSectionTitle}>Zutaten</ThemedText>
                  <View style={styles.badgeRow}>
                    {recipe.ingredients.map((ingredient) => (
                      <View key={ingredient} style={styles.badge}>
                        <ThemedText style={styles.badgeText}>{ingredient}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                {recipe.missingIngredients.length > 0 && (
                  <ThemedText style={styles.missingText}>
                    Fehlt euch noch: {recipe.missingIngredients.join(', ')}
                  </ThemedText>
                )}

                <View style={styles.subSection}>
                  <ThemedText style={styles.subSectionTitle}>So geht's</ThemedText>
                  {recipe.steps.map((step, index) => (
                    <ThemedText key={index} style={styles.stepText}>
                      {index + 1}. {step}
                    </ThemedText>
                  ))}
                </View>
              </GlassCard>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#f5eee0',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: LAYOUT_PAD,
  },
  infoCard: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    padding: 18,
    borderRadius: 22,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    marginBottom: SECTION_GAP_TOP,
    padding: 18,
    borderRadius: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.55)',
    color: TEXT_PRIMARY,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  allergyInput: {
    marginTop: 12,
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: 'rgba(125,90,80,0.7)',
  },
  generateButton: {
    marginTop: 4,
    marginBottom: SECTION_GAP_TOP,
    paddingVertical: 4,
    borderRadius: 26,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  generateButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultsSection: {
    marginBottom: SECTION_GAP_TOP,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 14,
    textAlign: 'center',
  },
  placeholderCard: {
    padding: 18,
    borderRadius: 22,
  },
  placeholderText: {
    textAlign: 'center',
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  recipeCard: {
    marginBottom: SECTION_GAP_TOP,
    padding: 20,
    borderRadius: 24,
  },
  recipeHeader: {
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  recipeMeta: {
    fontSize: 12,
    color: 'rgba(125,90,80,0.7)',
  },
  recipeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  subSection: {
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  badge: {
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(142,78,198,0.12)',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
  },
  missingText: {
    fontSize: 12,
    color: '#a76d5d',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 19,
    marginBottom: 6,
  },
});
