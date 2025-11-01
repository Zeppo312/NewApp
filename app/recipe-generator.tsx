import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  TextInput,
  StatusBar,
  Platform,
  Pressable,
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

type IngredientDetail = {
  id: string;
  name: string;
  amount: string;
  optional?: boolean;
  note?: string;
};

type StepDetail = {
  title: string;
  description: string;
  duration?: string;
  tip?: string;
};

type Recipe = {
  id: string;
  title: string;
  minMonths: number;
  maxMonths?: number;
  description: string;
  servings: string;
  prepTime?: string;
  ingredients: string[];
  ingredientDetails: IngredientDetail[];
  allergens: string[];
  tags: string[];
  steps: StepDetail[];
};

type GeneratedRecipe = Recipe & {
  missingIngredients: string[];
  matchedIngredients: number;
  score: number;
};

const COMMON_INGREDIENTS: { id: string; label: string }[] = [
  { id: 'avocado', label: 'Avocado' },
  { id: 'banane', label: 'Banane' },
  { id: 'birne', label: 'Birne' },
  { id: 'haferflocken', label: 'Haferflocken' },
  { id: 'hirse', label: 'Hirse' },
  { id: 'süßkartoffel', label: 'Süßkartoffel' },
  { id: 'rote linsen', label: 'Rote Linsen' },
  { id: 'brokkoli', label: 'Brokkoli' },
  { id: 'kichererbsen', label: 'Kichererbsen' },
  { id: 'milder quark', label: 'Milder Quark' },
  { id: 'dinkelgrieß', label: 'Dinkelgrieß' },
  { id: 'ei', label: 'Ei' },
  { id: 'apfel', label: 'Apfel' },
  { id: 'olivenöl', label: 'Olivenöl' },
  { id: 'kokosmilch', label: 'Kokosmilch' },
  { id: 'zimt', label: 'Zimt' },
  { id: 'zitronensaft', label: 'Zitronensaft' },
  { id: 'kumin', label: 'Kreuzkümmel' },
  { id: 'karotte', label: 'Karotte' },
  { id: 'zucchini', label: 'Zucchini' },
  { id: 'erbsen', label: 'Erbsen' },
  { id: 'lachs', label: 'Lachs' },
  { id: 'vollkornnudeln', label: 'Vollkornnudeln' },
  { id: 'spinat', label: 'Spinat' },
  { id: 'kichererbsenmehl', label: 'Kichererbsenmehl' },
  { id: 'naturjoghurt', label: 'Naturjoghurt' },
  { id: 'hühnerbrust', label: 'Hühnerbrust' },
  { id: 'erdbeeren', label: 'Erdbeeren' },
  { id: 'hirseflocken', label: 'Hirseflocken' },
  { id: 'reis', label: 'Reis' },
  { id: 'butter', label: 'Butter' },
  { id: 'zwiebel', label: 'Zwiebel' },
  { id: 'knoblauch', label: 'Knoblauch' },
  { id: 'zitrone', label: 'Zitrone' },
  { id: 'kirschtomaten', label: 'Kirschtomaten' },
  { id: 'aprikose', label: 'Aprikose' },
  { id: 'vanille', label: 'Vanille' },
  { id: 'backpulver', label: 'Backpulver' },
];

const RECIPE_LIBRARY: Recipe[] = [
  {
    id: 'avocado-hirse',
    title: 'Avocado-Hirse-Häppchen',
    minMonths: 6,
    description:
      'Cremige Avocado trifft auf weiche Hirse – kleine, nährstoffreiche Häppchen, die sich gut greifen lassen.',
    servings: 'Für ca. 12 Häppchen (2 Babyportionen)',
    prepTime: '10 Min. Vorbereitung • 10 Min. Kochzeit',
    ingredients: ['hirse', 'avocado', 'banane', 'olivenöl'],
    ingredientDetails: [
      { id: 'hirse', name: 'Feine Hirse', amount: '80 g' },
      { id: 'wasser', name: 'Wasser', amount: '200 ml', optional: true, note: 'oder ungesüßte Pflanzenmilch' },
      { id: 'avocado', name: 'Reife Avocado', amount: '1/2 Stück' },
      { id: 'banane', name: 'Banane', amount: '1/2 Stück', note: 'reif, für natürliche Süße' },
      { id: 'olivenöl', name: 'Olivenöl', amount: '1 TL' },
      { id: 'zitronensaft', name: 'Zitronensaft', amount: 'ein Spritzer', optional: true },
    ],
    allergens: [],
    tags: ['fingerfood', 'herzhaft', 'eisenreich'],
    steps: [
      {
        title: 'Hirse vorbereiten',
        description: 'Hirse gründlich spülen und mit Wasser in einem kleinen Topf 10 Minuten weich köcheln lassen.',
        duration: '10 Min.',
      },
      {
        title: 'Creme mischen',
        description: 'Avocado und Banane mit einer Gabel fein zerdrücken, Olivenöl und optional Zitronensaft einrühren.',
      },
      {
        title: 'Formen & servieren',
        description: 'Hirse unter die Creme rühren, kleine Häppchen formen und kurz auskühlen lassen, damit sie gut halten.',
        tip: 'Für ältere Babys können die Häppchen kurz in der Pfanne ohne Fett erwärmt werden.',
      },
    ],
  },
  {
    id: 'süßkartoffel-linsen',
    title: 'Süßkartoffel-Linsen-Püree',
    minMonths: 6,
    description: 'Sämiges Püree mit pflanzlichem Protein – mild gewürzt und wunderbar cremig.',
    servings: 'Ergibt 2 Portionen',
    prepTime: '12 Min. Vorbereitung • 15 Min. Kochzeit',
    ingredients: ['süßkartoffel', 'rote linsen', 'kokosmilch'],
    ingredientDetails: [
      { id: 'süßkartoffel', name: 'Süßkartoffel', amount: '200 g', note: 'geschält und gewürfelt' },
      { id: 'rote linsen', name: 'Rote Linsen', amount: '60 g', note: 'gut gespült' },
      { id: 'kokosmilch', name: 'Kokosmilch (light)', amount: '120 ml' },
      { id: 'kumin', name: 'Milder Kreuzkümmel', amount: '1 Prise', optional: true },
      { id: 'olivenöl', name: 'Olivenöl', amount: '1 TL', optional: true, note: 'für extra Energie' },
    ],
    allergens: [],
    tags: ['püree', 'pflanzlich', 'proteinreich'],
    steps: [
      {
        title: 'Gemüse garen',
        description: 'Süßkartoffelwürfel in wenig Wasser 8 Minuten weich dämpfen oder kochen.',
        duration: '8 Min.',
      },
      {
        title: 'Linsen weich kochen',
        description: 'Linsen mit Kokosmilch bedecken und 10 Minuten köcheln, bis sie zerfallen.',
        duration: '10 Min.',
      },
      {
        title: 'Püree vollenden',
        description:
          'Beides zusammen fein pürieren, mit Kreuzkümmel und Olivenöl abschmecken und lauwarm servieren.',
      },
    ],
  },
  {
    id: 'hafer-apfel',
    title: 'Hafer-Apfel-Pfännchen',
    minMonths: 7,
    description: 'Weiche Mini-Pancakes aus dem Ofen – süß ohne Zucker und ideal zum Greifen.',
    servings: 'Für 6–8 kleine Pfännchen',
    prepTime: '10 Min. Vorbereitung • 15 Min. Backzeit',
    ingredients: ['haferflocken', 'apfel', 'ei'],
    ingredientDetails: [
      { id: 'haferflocken', name: 'Zarte Haferflocken', amount: '80 g' },
      { id: 'apfel', name: 'Apfel', amount: '1 kleines Stück', note: 'fein gerieben' },
      { id: 'ei', name: 'Ei', amount: '1 Stück (Größe M)' },
      { id: 'zimt', name: 'Zimt', amount: 'eine Prise', optional: true },
      { id: 'backpulver', name: 'Backpulver', amount: '1/4 TL', optional: true },
    ],
    allergens: ['ei'],
    tags: ['frühstück', 'fingerfood', 'süß'],
    steps: [
      {
        title: 'Teig mischen',
        description: 'Haferflocken mit Apfel, Ei, Zimt und optional Backpulver verrühren, bis ein cremiger Teig entsteht.',
      },
      {
        title: 'Backen',
        description: 'Teig in kleine Silikonförmchen füllen und bei 180 °C Ober-/Unterhitze 15 Minuten backen.',
        duration: '15 Min.',
      },
      {
        title: 'Abkühlen lassen',
        description: 'Pfännchen kurz ausdampfen lassen und lauwarm servieren.',
      },
    ],
  },
  {
    id: 'brokkoli-kichererbsen',
    title: 'Brokkoli-Kichererbsen-Taler',
    minMonths: 8,
    description: 'Softe Taler voller Protein und Ballaststoffe, die nicht so schnell zerbröseln.',
    servings: 'Ergibt ca. 10 Taler',
    prepTime: '12 Min. Vorbereitung • 8 Min. Bratzeit',
    ingredients: ['brokkoli', 'kichererbsen', 'haferflocken'],
    ingredientDetails: [
      { id: 'brokkoli', name: 'Brokkoliröschen', amount: '150 g', note: 'sehr weich gedämpft' },
      { id: 'kichererbsen', name: 'Gekochte Kichererbsen', amount: '150 g', note: 'abgespült' },
      { id: 'haferflocken', name: 'Haferflocken', amount: '50 g' },
      { id: 'zitronensaft', name: 'Zitronensaft', amount: '1 TL', optional: true },
      { id: 'olivenöl', name: 'Olivenöl', amount: '1 TL', optional: true, note: 'für die Pfanne' },
    ],
    allergens: [],
    tags: ['fingerfood', 'herzhaft', 'proteinreich'],
    steps: [
      {
        title: 'Masse zubereiten',
        description: 'Brokkoli sehr weich dämpfen, mit Kichererbsen und Haferflocken grob pürieren.',
      },
      {
        title: 'Formen',
        description: 'Mit Zitronensaft abschmecken, kleine Taler formen und leicht andrücken.',
      },
      {
        title: 'Schonend braten',
        description: 'In einer beschichteten Pfanne bei mittlerer Hitze je Seite 3–4 Minuten braten, bis sie halten.',
        duration: '8 Min.',
      },
    ],
  },
  {
    id: 'birnen-quark',
    title: 'Birnen-Quark-Creme',
    minMonths: 9,
    description: 'Ein mildes Dessert mit Kalzium, ideal nach dem Mittagsschlaf.',
    servings: 'Für 2 Dessertportionen',
    prepTime: '5 Min. Vorbereitung • 8 Min. Kochzeit',
    ingredients: ['birne', 'milder quark', 'dinkelgrieß', 'vanille'],
    ingredientDetails: [
      { id: 'birne', name: 'Birne', amount: '1 reife Frucht', note: 'geschält und gewürfelt' },
      { id: 'wasser', name: 'Wasser', amount: '50 ml', optional: true },
      { id: 'dinkelgrieß', name: 'Dinkelgrieß', amount: '1 EL' },
      { id: 'vanille', name: 'Gemahlene Vanille', amount: '1 Messerspitze' },
      { id: 'milder quark', name: 'Milder Quark', amount: '120 g' },
    ],
    allergens: ['milch'],
    tags: ['dessert', 'süß', 'kalziumreich'],
    steps: [
      {
        title: 'Birne dünsten',
        description: 'Birnenwürfel mit Wasser und Vanille 5 Minuten weich köcheln.',
        duration: '5 Min.',
      },
      {
        title: 'Grieß einrühren',
        description: 'Dinkelgrieß einstreuen und 2 Minuten rühren, bis die Masse eindickt.',
      },
      {
        title: 'Mit Quark mischen',
        description: 'Etwas abkühlen lassen und mit Quark cremig rühren. Lauwarm oder gekühlt servieren.',
      },
    ],
  },
  {
    id: 'zucchini-frittata',
    title: 'Zucchini-Erbsen-Frittata',
    minMonths: 9,
    description: 'Eiweißreiche Ofen-Frittata, die sich gut in Sticks schneiden lässt.',
    servings: 'Für 3 Snackportionen',
    prepTime: '10 Min. Vorbereitung • 18 Min. Backzeit',
    ingredients: ['zucchini', 'erbsen', 'ei', 'naturjoghurt'],
    ingredientDetails: [
      { id: 'zucchini', name: 'Zucchini', amount: '1 kleines Stück', note: 'grob geraspelt' },
      { id: 'erbsen', name: 'TK-Erbsen', amount: '80 g', note: 'kurz blanchiert' },
      { id: 'ei', name: 'Eier', amount: '2 Stück' },
      { id: 'naturjoghurt', name: 'Naturjoghurt 3,5 %', amount: '2 EL' },
      { id: 'hirseflocken', name: 'Hirseflocken', amount: '2 EL', optional: true, note: 'für mehr Bindung' },
    ],
    allergens: ['ei', 'milch'],
    tags: ['fingerfood', 'ofengericht', 'proteinreich'],
    steps: [
      {
        title: 'Backform vorbereiten',
        description: 'Backofen auf 180 °C vorheizen, eine kleine Auflaufform leicht fetten oder mit Backpapier auslegen.',
      },
      {
        title: 'Masse verrühren',
        description: 'Alle Zutaten vermengen, nach Wunsch mit Kräutern abschmecken und in die Form geben.',
      },
      {
        title: 'Backen & Portionieren',
        description: '18 Minuten backen, kurz abkühlen lassen und in handliche Streifen schneiden.',
        duration: '18 Min.',
      },
    ],
  },
  {
    id: 'lachs-vollkornbowl',
    title: 'Lachs-Vollkorn-Bowl',
    minMonths: 10,
    description: 'Sanft gegarter Lachs mit weichen Nudeln und Gemüse – viel Omega-3 für kleine Entdecker:innen.',
    servings: 'Für 2 Portionen',
    prepTime: '15 Min. Vorbereitung • 12 Min. Kochzeit',
    ingredients: ['lachs', 'vollkornnudeln', 'spinat', 'olivenöl'],
    ingredientDetails: [
      { id: 'lachs', name: 'Lachsfilet (ohne Haut)', amount: '120 g', note: 'in kleinen Würfeln' },
      { id: 'vollkornnudeln', name: 'Vollkornnudeln', amount: '120 g', note: 'sehr weich gekocht' },
      { id: 'spinat', name: 'Babyspinat', amount: '2 Hände voll', note: 'gewaschen' },
      { id: 'kirschtomaten', name: 'Kirschtomaten', amount: '4 Stück', optional: true, note: 'entkernt und weich gedünstet' },
      { id: 'olivenöl', name: 'Olivenöl', amount: '1 TL' },
      { id: 'zitrone', name: 'Zitronenschale', amount: 'Abrieb von 1 Bio-Zitrone', optional: true },
    ],
    allergens: ['fisch', 'gluten'],
    tags: ['mittagessen', 'omega-3', 'herzhaft'],
    steps: [
      {
        title: 'Nudeln kochen',
        description: 'Vollkornnudeln in reichlich Wasser sehr weich garen, anschließend abgießen.',
        duration: '10 Min.',
      },
      {
        title: 'Lachs dämpfen',
        description: 'Lachswürfel in einer Pfanne mit wenig Wasser 4–5 Minuten zugedeckt garziehen lassen.',
      },
      {
        title: 'Alles vermengen',
        description:
          'Spinat kurz unter die warmen Nudeln mischen, Lachs und Tomaten hinzufügen, mit Olivenöl und Zitronenabrieb verfeinern.',
        tip: 'Für kleinere Babys alles grob zerdrücken, für ältere in fingerfoodtaugliche Stücke teilen.',
      },
    ],
  },
  {
    id: 'joghurt-hirse',
    title: 'Joghurt-Hirse-Frühstück',
    minMonths: 10,
    description: 'Sahniger Frühstücksbrei mit Obst und Eisen aus Hirseflocken.',
    servings: 'Für 2 kleine Schälchen',
    prepTime: '5 Min. Vorbereitung • 5 Min. Kochzeit',
    ingredients: ['hirseflocken', 'naturjoghurt', 'erdbeeren', 'banane'],
    ingredientDetails: [
      { id: 'hirseflocken', name: 'Hirseflocken', amount: '60 g' },
      { id: 'wasser', name: 'Wasser oder Milch', amount: '150 ml', optional: true },
      { id: 'naturjoghurt', name: 'Naturjoghurt 3,5 %', amount: '100 g' },
      { id: 'banane', name: 'Banane', amount: '1/2 Stück', note: 'zerdrückt' },
      { id: 'erdbeeren', name: 'Erdbeeren', amount: '3 Stück', note: 'fein gewürfelt' },
    ],
    allergens: ['milch'],
    tags: ['frühstück', 'süß', 'eisenreich'],
    steps: [
      {
        title: 'Hirse kochen',
        description: 'Hirseflocken mit Wasser oder Milch 3 Minuten sämig kochen.',
        duration: '3 Min.',
      },
      {
        title: 'Cremig rühren',
        description: 'Vom Herd nehmen, Banane einrühren und kurz abkühlen lassen.',
      },
      {
        title: 'Toppings hinzufügen',
        description: 'Joghurt unterheben und mit Erdbeeren toppen.',
      },
    ],
  },
  {
    id: 'huhn-karotte-risotto',
    title: 'Hühner-Karotten-Risotto',
    minMonths: 11,
    description: 'Zartes Reisgericht mit viel Gemüse, das sich gut vorbereiten lässt.',
    servings: 'Für 3 Babyportionen',
    prepTime: '15 Min. Vorbereitung • 20 Min. Kochzeit',
    ingredients: ['hühnerbrust', 'reis', 'karotte', 'zwiebel'],
    ingredientDetails: [
      { id: 'hühnerbrust', name: 'Hühnerbrust', amount: '120 g', note: 'fein gewürfelt' },
      { id: 'reis', name: 'Rundkornreis', amount: '120 g' },
      { id: 'karotte', name: 'Karotte', amount: '2 Stück', note: 'fein gewürfelt' },
      { id: 'zwiebel', name: 'Zwiebel', amount: '1/2 kleine', note: 'sehr fein gehackt' },
      { id: 'butter', name: 'Butter', amount: '1 TL' },
      { id: 'wasser', name: 'Gemüsebrühe ohne Salz', amount: '350 ml', note: 'oder Wasser', optional: true },
      { id: 'erbsen', name: 'Erbsen', amount: '60 g', optional: true },
    ],
    allergens: ['milch'],
    tags: ['mittagessen', 'sättigend', 'herzhaft'],
    steps: [
      {
        title: 'Gemüse anschwitzen',
        description: 'Butter in einem Topf schmelzen, Zwiebel und Karotte darin 3 Minuten glasig dünsten.',
      },
      {
        title: 'Reis garen',
        description: 'Reis zugeben, kurz umrühren und nach und nach Brühe angießen. 15 Minuten sanft köcheln lassen.',
        duration: '15 Min.',
      },
      {
        title: 'Hähnchen hinzufügen',
        description: 'Hühnerwürfel und Erbsen unterrühren, weitere 5 Minuten garziehen lassen, bis alles weich ist.',
        tip: 'Bei Bedarf mit etwas Wasser strecken und für Babys grob zerdrücken.',
      },
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
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState('');
  const [preferences, setPreferences] = useState('');
  const [allergies, setAllergies] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [results, setResults] = useState<GeneratedRecipe[]>([]);

  const infoTextColor = colorScheme === 'dark' ? '#fdf7f1' : TEXT_PRIMARY;

  const toggleIngredient = (id: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleGenerate = () => {
    if (isGenerating) return;

    setIsGenerating(true);

    requestAnimationFrame(() => {
      const ageInMonths = Math.max(4, parseInt(babyAge, 10) || 0);
      const manualIngredients = splitInput(ingredients);
      const availableIngredients = Array.from(new Set([...selectedIngredients, ...manualIngredients]));
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

      setResults(scoredRecipes.slice(0, 4));
      setHasGenerated(true);
      setIsGenerating(false);
    });
  };

  const helperHint = useMemo(() => {
    const age = parseInt(babyAge, 10);
    let baseHint = '';

    if (!Number.isFinite(age)) {
      baseHint = 'Gib das Alter in Monaten ein (z. B. 6).';
    } else if (age < 6) {
      baseHint = 'Für BLW empfehlen wir ab etwa 6 Monaten – achte auf Reifezeichen!';
    } else if (age >= 10) {
      baseHint = 'Ab 10 Monaten dürfen die Rezepte gern stückiger sein – probier mehr Fingerfood.';
    } else {
      baseHint = 'Perfekt! BLW-Rezepte lassen sich wunderbar mit euren Zutaten kombinieren.';
    }

    const selectedCount = selectedIngredients.length;
    if (selectedCount > 0) {
      return `${baseHint} Markiert: ${selectedCount} Vorräte – ergänze spezielle Zutaten per Text.`;
    }

    return `${baseHint} Markier eure Lieblingszutaten oder tippe sie ein.`;
  }, [babyAge, selectedIngredients.length]);

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
              Wir schlagen dir BLW-Rezepte vor, die zu eurem Babyalter passen und eure Vorräte nutzen. Zutaten kannst du jetzt
              bequem abhaken oder ergänzend kommagetrennt eintippen – Allergene landen einfach im entsprechenden Feld.
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
            <ThemedText style={styles.helperText}>
              Tipp: Hake Basics einfach ab und ergänze Besonderheiten per Text.
            </ThemedText>
            <View style={styles.ingredientToggleGrid}>
              {COMMON_INGREDIENTS.map((item) => {
                const isActive = selectedIngredients.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleIngredient(item.id)}
                    style={[styles.ingredientToggle, isActive && styles.ingredientToggleActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <ThemedText
                      style={[styles.ingredientToggleText, isActive && styles.ingredientToggleTextActive]}
                    >
                      {isActive ? `✓ ${item.label}` : item.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={ingredients}
              onChangeText={setIngredients}
              style={[styles.input, styles.multilineInput]}
              multiline
              placeholder="Weitere Zutaten z. B. Aprikose, Pastinake, Käse"
              placeholderTextColor="rgba(125,90,80,0.45)"
            />
            <ThemedText style={styles.helperText}>
              Zusätzliche Angaben helfen, die Trefferquote zu erhöhen.
            </ThemedText>
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

            {Number.isFinite(parseInt(babyAge, 10)) && (
              <ThemedText style={styles.resultsHint}>
                Wir berücksichtigen das Alter von {parseInt(babyAge, 10)} Monaten bei den Empfehlungen.
              </ThemedText>
            )}

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

            {results.map((recipe) => {
              const missingDetails = recipe.ingredientDetails.filter((detail) =>
                recipe.missingIngredients.includes(detail.id),
              );

              return (
                <GlassCard
                  key={recipe.id}
                  style={styles.recipeCard}
                  intensity={28}
                  overlayColor="rgba(255,255,255,0.32)"
                  borderColor="rgba(255,255,255,0.5)"
                >
                  <View style={styles.recipeHeader}>
                    <ThemedText style={[styles.recipeTitle, { color: PRIMARY }]}>🍲 {recipe.title}</ThemedText>
                    <ThemedText style={styles.recipeMeta}>
                      ab {recipe.minMonths} Monaten • {recipe.tags.join(' • ')}
                    </ThemedText>
                  </View>

                  <ThemedText style={styles.recipeDescription}>{recipe.description}</ThemedText>

                  <View style={styles.metaInfoRow}>
                    {recipe.prepTime && (
                      <View style={styles.metaPill}>
                        <ThemedText style={styles.metaPillText}>⏱️ {recipe.prepTime}</ThemedText>
                      </View>
                    )}
                    <View style={styles.metaPill}>
                      <ThemedText style={styles.metaPillText}>🥣 {recipe.servings}</ThemedText>
                    </View>
                    <View style={styles.metaPill}>
                      <ThemedText style={styles.metaPillText}>
                        ✅ {recipe.matchedIngredients} / {recipe.ingredients.length} passende Zutaten
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.subSection}>
                    <ThemedText style={styles.subSectionTitle}>Zutaten & Mengen</ThemedText>
                    <View style={styles.ingredientList}>
                      {recipe.ingredientDetails.map((detail) => (
                        <View key={`${detail.id}-${detail.amount}`} style={styles.ingredientRow}>
                          <View
                            style={[
                              styles.ingredientBullet,
                              detail.optional && styles.ingredientBulletOptional,
                            ]}
                          />
                          <View style={styles.ingredientTextContainer}>
                            <ThemedText style={styles.ingredientText}>
                              {detail.amount} {detail.name}
                              {detail.optional ? ' (optional)' : ''}
                            </ThemedText>
                            {detail.note && (
                              <ThemedText style={styles.ingredientNote}>{detail.note}</ThemedText>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {missingDetails.length > 0 && (
                    <ThemedText style={styles.missingText}>
                      Fehlt euch noch:{' '}
                      {missingDetails
                        .map((detail) => `${detail.amount} ${detail.name}`.trim())
                        .join(', ')}
                    </ThemedText>
                  )}

                  <View style={styles.subSection}>
                    <ThemedText style={styles.subSectionTitle}>Exakter Ablauf</ThemedText>
                    {recipe.steps.map((step, index) => (
                      <View key={`${step.title}-${index}`} style={styles.stepBlock}>
                        <ThemedText style={styles.stepTitle}>
                          {index + 1}. {step.title}
                        </ThemedText>
                        <ThemedText style={styles.stepDescription}>{step.description}</ThemedText>
                        {(step.duration || step.tip) && (
                          <View style={styles.stepMetaRow}>
                            {step.duration && (
                              <ThemedText style={styles.stepMeta}>⏱️ {step.duration}</ThemedText>
                            )}
                            {step.tip && (
                              <ThemedText style={styles.stepMeta}>💡 {step.tip}</ThemedText>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </GlassCard>
              );
            })}
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
  ingredientToggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -4,
  },
  ingredientToggle: {
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  ingredientToggleActive: {
    backgroundColor: 'rgba(142,78,198,0.18)',
    borderColor: 'rgba(142,78,198,0.55)',
  },
  ingredientToggleText: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  ingredientToggleTextActive: {
    color: PRIMARY,
    fontWeight: '600',
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
  resultsHint: {
    fontSize: 12,
    color: 'rgba(125,90,80,0.75)',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 16,
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
  metaInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    marginHorizontal: -4,
  },
  metaPill: {
    backgroundColor: 'rgba(142,78,198,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  metaPillText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
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
  ingredientList: {
    marginTop: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(142,78,198,0.6)',
    marginTop: 7,
    marginRight: 8,
  },
  ingredientBulletOptional: {
    backgroundColor: 'rgba(142,78,198,0.25)',
  },
  ingredientTextContainer: {
    flex: 1,
  },
  ingredientText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  ingredientNote: {
    fontSize: 12,
    color: 'rgba(125,90,80,0.7)',
    marginTop: 2,
  },
  missingText: {
    fontSize: 12,
    color: '#a76d5d',
    marginBottom: 12,
  },
  stepBlock: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.35)',
  },
  stepTitle: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  stepDescription: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 19,
    marginTop: 4,
  },
  stepMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -4,
  },
  stepMeta: {
    fontSize: 12,
    color: 'rgba(125,90,80,0.8)',
    marginHorizontal: 4,
    marginBottom: 4,
  },
});
