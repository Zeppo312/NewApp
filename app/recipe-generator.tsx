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
import { createRecipe, fetchRecipes, RecipeRecord } from '@/lib/recipes';

type AllergenId = 'milk' | 'gluten' | 'egg' | 'nuts' | 'fish';

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

const defaultIngredientsSet = new Set(
  INGREDIENT_GROUPS.flatMap((group) => group.items.map((item) => item.toLowerCase()))
);

// Layout-System mit maximaler Content-Breite
const { width: screenWidth } = Dimensions.get('window');
const SCREEN_PADDING = 4; // Minimales Außen-Padding
const contentWidth = screenWidth - 2 * SCREEN_PADDING; // Maximale Breite
const isCompact = screenWidth < 380;

const CARD_INTERNAL_PADDING = 32; // Noch großzügigerer Abstand zum Rand für bessere Lesbarkeit
const CARD_SPACING = 16; // Abstand zwischen Cards
const INGREDIENT_COLUMNS = 2; // Immer 2 Buttons pro Reihe
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

type SampleRecipe = {
  title: string;
  description: string;
  min_months: number;
  ingredients: string[];
  allergens?: AllergenId[];
  instructions: string;
  tip?: string;
};

const SAMPLE_RECIPES: SampleRecipe[] = [
  {
    title: 'Süßkartoffel & Kichererbsen Mash',
    description: 'Cremiger BLW-Mash mit milden Kräutern – perfekt zum Löffeln oder Dippen.',
    min_months: 6,
    ingredients: ['Süßkartoffel', 'Kichererbsen', 'Rapsöl', 'Kräuter'],
    instructions:
      'Süßkartoffel schälen, würfeln und in wenig Wasser oder im Dampfgarer weich garen. Kichererbsen gründlich abspülen und mit der warmen Süßkartoffel zerdrücken. Rapsöl und fein gehackte Kräuter unterrühren, bis eine cremige Konsistenz entsteht.',
    tip: 'Kichererbsen kurz pürieren, damit kleine Hände sie gut greifen können.',
  },
  {
    title: 'Apfel-Hafer-Porridge',
    description: 'Warmer Haferschmaus mit Apfelstückchen und optional einem Klecks Joghurt.',
    min_months: 6,
    ingredients: ['Haferflocken', 'Apfel', 'Naturjoghurt', 'Rapsöl'],
    allergens: ['gluten', 'milk'],
    instructions:
      'Haferflocken mit Wasser oder Milchalternative sanft köcheln lassen. Apfel fein reiben und kurz mitziehen lassen. Vom Herd nehmen, Rapsöl und bei Bedarf Naturjoghurt einrühren und servieren.',
    tip: 'Für milchfreie Variante den Joghurt durch Haferdrink ersetzen.',
  },
  {
    title: 'Brokkoli-Lachs-Bällchen',
    description: 'Weiche Fingerfood-Bällchen mit Omega-3-Power – lassen sich gut vorbereiten.',
    min_months: 7,
    ingredients: ['Brokkoli', 'Lachs', 'Kartoffel', 'Olivenöl'],
    allergens: ['fish'],
    instructions:
      'Kartoffeln und Brokkoli im Dampf weich garen. Lachs ohne Haut schonend dämpfen und fein zupfen. Alles miteinander zerdrücken, kleine Bällchen formen, mit Olivenöl bepinseln und im Ofen bei 180 °C 10 Minuten backen.',
    tip: 'Im Ofen backen, bis sie außen leicht gold werden – dann zerfallen sie nicht.',
  },
  {
    title: 'Banane-Hirse-Puffer',
    description: 'Schnelle Puffer ohne Zucker – ideal als Frühstück oder Snack.',
    min_months: 8,
    ingredients: ['Banane', 'Hirse', 'Ei', 'Rapsöl'],
    allergens: ['egg'],
    instructions:
      'Gekochte Hirse mit zerdrückter Banane und geschlagenem Ei verrühren. Kleine Puffer formen und in wenig Rapsöl bei mittlerer Hitze goldbraun ausbacken. Kurz auf Küchenpapier abtropfen lassen.',
    tip: 'Für allergiefreundliche Variante das Ei durch Apfelmus ersetzen.',
  },
  {
    title: 'Avocado-Erbsen-Toast',
    description: 'Weicher Toast mit cremigem Belag – prima zum Selbstschmieren üben.',
    min_months: 9,
    ingredients: ['Vollkornbrot', 'Avocado', 'Erbsen', 'Frischkäse'],
    allergens: ['gluten', 'milk'],
    instructions:
      'Erbsen kurz blanchieren und mit Avocado und Frischkäse zu einer Creme zerdrücken. Vollkornbrot leicht toasten, Rinde entfernen, Creme darauf streichen und in babygerechte Streifen schneiden.',
    tip: 'Rinde entfernen, damit es kleine Esser leichter haben.',
  },
  {
    title: 'Zucchini-Linsen-Gulasch',
    description: 'Sämiger Gemüse-Linsen-Eintopf, ideal zum Löffeln.',
    min_months: 8,
    ingredients: ['Zucchini', 'Rote Linsen', 'Karotte', 'Tomate', 'Olivenöl', 'Kräuter'],
    instructions:
      'Karotte und Zucchini klein würfeln und in Olivenöl anschwitzen. Rote Linsen und gewürfelte Tomate dazugeben, mit Wasser bedecken und weich köcheln. Mit milden Kräutern abschmecken und grob zerdrücken.',
  },
  {
    title: 'Karotten-Polenta-Sticks',
    description: 'Knusprige Sticks, die innen schön weich bleiben.',
    min_months: 9,
    ingredients: ['Polenta', 'Karotte', 'Butter', 'Kräuter'],
    allergens: ['milk'],
    instructions:
      'Polenta nach Packungsangabe mit Wasser und etwas Butter kochen. Fein geriebene Karotte und Kräuter unterheben, Masse in eine Form streichen, auskühlen lassen und in Sticks schneiden. Kurz im Ofen knusprig backen.',
  },
  {
    title: 'Apfel-Birnen-Kompott mit Hirse',
    description: 'Fruchtiger Kompott mit extra Eisen aus der Hirse.',
    min_months: 6,
    ingredients: ['Apfel', 'Birne', 'Hirse', 'Zimt'],
    instructions:
      'Apfel und Birne schälen, würfeln und mit etwas Wasser sowie einer Prise Zimt weich köcheln. Gekochte Hirse unterrühren, alles grob pürieren und lauwarm servieren.',
  },
  {
    title: 'Hühnchen-Reis-Bowl',
    description: 'Herzhafte Schüssel mit zarten Hühnchenstreifen und Gemüse.',
    min_months: 9,
    ingredients: ['Hühnchen', 'Reis', 'Brokkoli', 'Erbsen', 'Rapsöl'],
    instructions:
      'Reis garen und warm halten. Hühnchen in feine Streifen schneiden und in wenig Wasser gar ziehen lassen. Brokkoli und Erbsen dämpfen, alles zusammen mit etwas Rapsöl vermengen und servieren.',
  },
  {
    title: 'Kürbis-Kokos-Suppe',
    description: 'Samtene Suppe, leicht süßlich und sanft gewürzt.',
    min_months: 7,
    ingredients: ['Kürbis', 'Kartoffel', 'Kokosmilch', 'Rapsöl'],
    instructions:
      'Kürbis und Kartoffel würfeln, in Rapsöl anschwitzen und mit Wasser bedecken. Weich kochen, Kokosmilch zugeben und fein pürieren. Nach Belieben mit mildem Curry abschmecken.',
  },
  {
    title: 'Spinat-Ricotta-Pasta',
    description: 'Cremige Pasta mit mildem Spinat und Ricotta.',
    min_months: 10,
    ingredients: ['Vollkornnudeln', 'Spinat', 'Ricotta', 'Olivenöl'],
    allergens: ['gluten', 'milk'],
    instructions:
      'Vollkornnudeln weich kochen. Spinat kurz dämpfen und fein hacken. Ricotta mit etwas Nudelwasser cremig rühren, Spinat und Olivenöl hinzufügen und mit den Nudeln vermengen.',
  },
  {
    title: 'Birnen-Buchweizen-Muffins',
    description: 'Saftige Mini-Muffins ohne Zuckerzusatz.',
    min_months: 10,
    ingredients: ['Birne', 'Buchweizenmehl', 'Ei', 'Rapsöl', 'Backpulver'],
    allergens: ['egg'],
    instructions:
      'Reife Birne fein reiben, mit Buchweizenmehl, Ei, etwas Backpulver und Rapsöl zu einem Teig verrühren. In Mini-Muffinförmchen füllen und bei 180 °C etwa 12 Minuten backen.',
  },
];

const RecipeGeneratorScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ageMonths, setAgeMonths] = useState<number>(8);
  const [selectedAllergies, setSelectedAllergies] = useState<AllergenId[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [recipeMatches, setRecipeMatches] = useState<RecipeMatch[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newTip, setNewTip] = useState('');
  const [newMinMonths, setNewMinMonths] = useState('6');
  const [newIngredients, setNewIngredients] = useState<string[]>([]);
  const [newIngredientInput, setNewIngredientInput] = useState('');
  const [newAllergens, setNewAllergens] = useState<AllergenId[]>([]);
  const [newImage, setNewImage] = useState<string | null>(null);

  const selectedIngredientSet = useMemo(
    () => new Set(availableIngredients.map((item) => item.toLowerCase())),
    [availableIngredients]
  );

  const extraIngredients = useMemo(() => {
    const extras = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        const normalized = ingredient.trim();
        if (!defaultIngredientsSet.has(normalized.toLowerCase())) {
          extras.add(normalized);
        }
      });
    });
    return Array.from(extras).sort((a, b) => a.localeCompare(b, 'de'));
  }, [recipes]);

  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      if (a.min_months === b.min_months) {
        return a.title.localeCompare(b.title, 'de');
      }
      return a.min_months - b.min_months;
    });
  }, [recipes]);

  const disabledIngredientsCount = useMemo(() => {
    if (selectedAllergies.length === 0) return 0;
    const allergySet = new Set(selectedAllergies);
    return recipes.reduce((count, recipe) => {
      const hasConflictingAllergen = recipe.allergens.some((item) =>
        allergySet.has(item as AllergenId)
      );
      return hasConflictingAllergen ? count + 1 : count;
    }, 0);
  }, [selectedAllergies, recipes]);

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

  const toggleIngredient = (ingredient: string) => {
    setAvailableIngredients((prev) =>
      prev.includes(ingredient)
        ? prev.filter((item) => item !== ingredient)
        : [...prev, ingredient]
    );
  };

  const allergenRows = useMemo(
    () => chunkItems(ALLERGEN_OPTIONS, ALLERGEN_COLUMNS),
    []
  );

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
      Alert.alert(
        'Noch keine Vorräte ausgewählt',
        'Hake ein paar Zutaten an, damit wir passende Rezepte finden können.'
      );
      return;
    }

    const matches = recipes
      .map((recipe) => {
        const matching = recipe.ingredients.filter((ingredient) =>
          selectedIngredientSet.has(ingredient.toLowerCase())
        );
        const missing = recipe.ingredients.filter(
          (ingredient) => !selectedIngredientSet.has(ingredient.toLowerCase())
        );
        const hasBlockedAllergen = recipe.allergens.some((allergen) =>
          selectedAllergies.includes(allergen as AllergenId)
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
      .slice(0, 6)
      .map(({ recipe, matchCount, missingIngredients }) => ({
        recipe,
        matchCount,
        missingIngredients,
      }));

    setRecipeMatches(matches);
    setHasGenerated(true);
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

    const months = Math.max(
      AGE_LIMITS.min,
      Math.min(AGE_LIMITS.max, Number.parseInt(newMinMonths, 10) || AGE_LIMITS.min)
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

      setHasGenerated(false);
      setRecipeMatches([]);
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
      setHasGenerated(false);
      setRecipeMatches([]);

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
              subtitle='Aus euren Vorräten blitzschnell Ideen zaubern'
              showBackButton
              onBackPress={() => router.back()}
            />
            
            <TouchableOpacity 
              style={styles.myRecipesButton}
              onPress={() => router.push('/my-recipes')}
            >
              <IconSymbol 
                name='book.fill' 
                size={24} 
                color={PRIMARY} 
              />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.contentContainer, { width: contentWidth }]}>
              {/* Hero Card */}
              <LiquidGlassCard
                style={styles.card}
                intensity={28}
                overlayColor='rgba(255,255,255,0.22)'
                borderColor='rgba(255,255,255,0.35)'
              >
              <View style={styles.heroRow}>
                <View style={styles.heroIcon}>
                  <IconSymbol name='checklist' size={26} color={PRIMARY} />
                </View>
                <View style={styles.heroTextWrap}>
                  <ThemedText style={styles.heroTitle}>Dein Vorrats-Assistent</ThemedText>
                  <ThemedText style={styles.heroSubtitle}>
                    Wähle Zutaten, setze Allergien, und entdecke passende BLW-Rezepte.
                  </ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            {/* Action Card - Eigenes Rezept */}
            <LiquidGlassCard
              style={styles.card}
              intensity={24}
              overlayColor='rgba(255,255,255,0.18)'
              borderColor={GLASS_BORDER}
              onPress={() => {
                resetCreateForm();
                setShowCreateModal(true);
              }}
              activeOpacity={0.86}
            >
              <View style={styles.actionContent}>
                <View style={styles.actionIcon}>
                  <IconSymbol name='plus.circle.fill' size={26} color={PRIMARY} />
                </View>
                <View style={styles.actionTextWrap}>
                  <ThemedText style={styles.actionTitle}>Eigenes Rezept ergänzen</ThemedText>
                  <ThemedText style={styles.actionHint}>
                    Teile eure Lieblingsgerichte mit allen Nutzer*innen.
                  </ThemedText>
                </View>
                <IconSymbol name='chevron.right' size={20} color={PRIMARY} />
              </View>
            </LiquidGlassCard>

            {/* Baby-Alter Card */}
            <LiquidGlassCard
              style={styles.card}
              intensity={26}
              overlayColor='rgba(255,255,255,0.20)'
              borderColor={GLASS_BORDER}
            >
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
            </LiquidGlassCard>

            {/* Allergien Card */}
            <LiquidGlassCard
              style={styles.card}
              intensity={26}
              overlayColor='rgba(255,255,255,0.20)'
              borderColor={GLASS_BORDER}
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
            </LiquidGlassCard>

            {/* Section Intro */}
            <View style={styles.sectionIntro}>
              <IconSymbol name='checklist' size={20} color={PRIMARY} />
              <ThemedText style={styles.sectionIntroText}>
                Hake eure verfügbaren Zutaten ab:
              </ThemedText>
            </View>

            {/* Ingredients Groups */}
            {INGREDIENT_GROUPS.map((group) => (
              <LiquidGlassCard
                key={group.key}
                style={styles.card}
                intensity={24}
                overlayColor={GLASS_OVERLAY}
                borderColor={GLASS_BORDER}
              >
                <ThemedText style={styles.ingredientsTitle}>{group.label}</ThemedText>
                <View style={styles.ingredientsGrid}>
                  {chunkItems(group.items, INGREDIENT_COLUMNS).map((row, rowIndex, rows) => (
                    <View
                      key={`${group.key}-row-${rowIndex}`}
                      style={[
                        styles.gridRow,
                        rowIndex === rows.length - 1 && styles.gridRowLast,
                      ]}
                    >
                      {row.map((ingredient, colIndex) => {
                        if (!ingredient) {
                          return (
                            <View
                              key={`${group.key}-placeholder-${rowIndex}-${colIndex}`}
                              style={[
                                styles.gridItem,
                                colIndex === 0 && styles.gridItemLeft,
                              ]}
                            />
                          );
                        }
                        const isSelected = selectedIngredientSet.has(ingredient.toLowerCase());
                        return (
                          <View
                            key={ingredient}
                            style={[
                              styles.gridItem,
                              colIndex === 0 && styles.gridItemLeft,
                            ]}
                          >
                            <TouchableOpacity
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
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </LiquidGlassCard>
            ))}

            {/* Extra Ingredients */}
            {extraIngredients.length > 0 && (
              <LiquidGlassCard
                style={styles.card}
                intensity={24}
                overlayColor='rgba(255,255,255,0.18)'
                borderColor={GLASS_BORDER}
              >
                <ThemedText style={styles.ingredientsTitle}>Weitere Zutaten aus Rezepten</ThemedText>
                <View style={styles.ingredientsGrid}>
                  {chunkItems(extraIngredients, INGREDIENT_COLUMNS).map((row, rowIndex, rows) => (
                    <View
                      key={`extra-row-${rowIndex}`}
                      style={[
                        styles.gridRow,
                        rowIndex === rows.length - 1 && styles.gridRowLast,
                      ]}
                    >
                      {row.map((ingredient, colIndex) => {
                        if (!ingredient) {
                          return (
                            <View
                              key={`extra-placeholder-${rowIndex}-${colIndex}`}
                              style={[
                                styles.gridItem,
                                colIndex === 0 && styles.gridItemLeft,
                              ]}
                            />
                          );
                        }
                        const isSelected = selectedIngredientSet.has(ingredient.toLowerCase());
                        return (
                          <View
                            key={ingredient}
                            style={[
                              styles.gridItem,
                              colIndex === 0 && styles.gridItemLeft,
                            ]}
                          >
                            <TouchableOpacity
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
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </LiquidGlassCard>
            )}

            {/* Generate Button - REFERENZ-BREITE */}
            <LiquidGlassCard
              style={[
                styles.card,
                availableIngredients.length === 0 && styles.generateButtonDisabled,
              ]}
              intensity={28}
              overlayColor='rgba(142,78,198,0.36)'
              borderColor='rgba(255,255,255,0.4)'
              onPress={computeMatches}
              activeOpacity={0.85}
            >
              <View style={styles.generateButtonInner}>
                <IconSymbol name='star.fill' size={22} color='#FFFFFF' />
                <ThemedText style={styles.generateLabel}>Rezepte generieren</ThemedText>
                <View style={styles.generateBadge}>
                  <ThemedText style={styles.generateBadgeText}>
                    {availableIngredients.length}
                  </ThemedText>
                </View>
              </View>
            </LiquidGlassCard>

            {/* Loading State */}
            {isLoading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size='large' color={PRIMARY} />
                <ThemedText style={styles.loadingText}>Rezepte werden geladen ...</ThemedText>
              </View>
            ) : (
              <>
                {/* Generated Results */}
                {hasGenerated && (
                  <View style={styles.resultsWrapper}>
                    <ThemedText style={styles.resultsTitle}>Eure Top-Treffer</ThemedText>
                    {recipeMatches.length === 0 ? (
                      <LiquidGlassCard
                        style={styles.card}
                        intensity={26}
                        overlayColor='rgba(255,255,255,0.26)'
                        borderColor='rgba(255,255,255,0.3)'
                      >
                        <View style={styles.emptyStateBody}>
                          <IconSymbol name='info.circle.fill' size={24} color={PRIMARY} />
                          <ThemedText style={styles.emptyStateTitle}>
                            Noch keine Treffer
                          </ThemedText>
                          <ThemedText style={styles.emptyStateText}>
                            Probiere mehr Zutaten zu markieren oder passe das Alter an.
                          </ThemedText>
                        </View>
                      </LiquidGlassCard>
                    ) : (
                      recipeMatches.map((match) => (
                        <LiquidGlassCard
                          key={match.recipe.id}
                          style={[styles.card, styles.recipeCard]}
                          intensity={26}
                          overlayColor='rgba(255,255,255,0.24)'
                          borderColor='rgba(255,255,255,0.35)'
                          onPress={() => setSelectedRecipe(match.recipe)}
                          activeOpacity={0.88}
                        >
                          <View style={styles.recipeHeader}>
                            <ThemedText style={styles.recipeTitle}>{match.recipe.title}</ThemedText>
                            <View style={styles.ageTag}>
                              <IconSymbol name='clock' size={16} color='#FFFFFF' />
                              <ThemedText style={styles.ageTagText}>
                                ab {match.recipe.min_months} M
                              </ThemedText>
                            </View>
                          </View>
                          <ThemedText style={styles.recipeDescription}>
                            {match.recipe.description ?? 'Perfekt passend zu euren Zutaten.'}
                          </ThemedText>
                          <View style={styles.recipeStatsRow}>
                            <View style={styles.statPill}>
                              <IconSymbol name='checklist' size={16} color={PRIMARY} />
                              <ThemedText style={styles.statText}>
                                {match.matchCount} / {match.recipe.ingredients.length} Zutaten
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
                          {match.recipe.tip && (
                            <View style={styles.tipBox}>
                              <IconSymbol name='info.circle.fill' size={16} color={PRIMARY} />
                              <ThemedText style={styles.tipText}>{match.recipe.tip}</ThemedText>
                            </View>
                          )}
                        </LiquidGlassCard>
                      ))
                    )}
                  </View>
                )}

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
            {selectedAllergies.length > 0 && (
              <LiquidGlassCard
                style={styles.card}
                intensity={22}
                overlayColor='rgba(255,255,255,0.18)'
                borderColor='rgba(255,255,255,0.28)'
              >
                <ThemedText style={styles.noticeTitle}>Allergie-Filter aktiv</ThemedText>
                <ThemedText style={styles.noticeText}>
                  Wir haben {disabledIngredientsCount} Rezepte ausgeblendet.
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
                  {selectedRecipe.image_url ? (
                    <>
                      <Image
                        source={{ uri: selectedRecipe.image_url }}
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
                            {selectedRecipe.allergens.join(', ')}
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
                        ? selectedRecipe.allergens.join(', ')
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
                    <ThemedText style={styles.recipeInstructions}>
                      {selectedRecipe.instructions}
                    </ThemedText>
                  </View>
                ) : null}

                {selectedRecipe.tip ? (
                  <View style={[styles.recipeSectionCard, styles.recipeTipCard]}>
                    <IconSymbol name='lightbulb.fill' size={18} color={PRIMARY} />
                    <ThemedText style={styles.recipeTipText}>{selectedRecipe.tip}</ThemedText>
                  </View>
                ) : null}
              </ScrollView>
            </BlurView>
          </View>
        </Modal>
      )}

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
                    placeholder={`${AGE_LIMITS.min}-${AGE_LIMITS.max}`}
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
  scrollContent: {
    paddingBottom: 120,
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
    gap: 12,
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
    gap: 8,
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
  actionContent: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(142,78,198,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    alignItems: 'center',
    gap: 8,
  },
  actionTitle: {
    fontSize: 18, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    lineHeight: 24,
  },
  actionHint: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    lineHeight: 22,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
    marginBottom: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  ageControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(142,78,198,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageButtonText: {
    fontSize: 28,
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
  sectionIntro: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginTop: SECTION_GAP_TOP,
    marginBottom: 16,
  },
  sectionIntroText: {
    fontSize: 18, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    lineHeight: 24,
  },
  ingredientsTitle: {
    fontSize: 18, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  ingredientsGrid: {
    paddingHorizontal: GRID_GAP,
    paddingTop: GRID_GAP,
    paddingBottom: GRID_GAP,
  },
  ingredientChip: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientChipSelected: {
    backgroundColor: 'rgba(142,78,198,0.28)',
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
  generateButtonDisabled: {
    opacity: 0.65,
  },
  generateButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    gap: 12,
  },
  generateLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18, // Größere Schrift für bessere Sichtbarkeit
  },
  generateBadge: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  generateBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
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
  resultsWrapper: {
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 20, // Größere Schrift für bessere Sichtbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 16,
    letterSpacing: -0.2,
    textAlign: 'center',
    lineHeight: 26,
  },
  emptyStateBody: {
    alignItems: 'center',
    gap: 16,
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
    marginBottom: 14, // Noch mehr Abstand für bessere Trennung
    gap: 12, // Abstand zwischen Titel und Tag
  },
  recipeTitle: {
    fontSize: 18, // Größere Schrift für bessere Lesbarkeit
    fontWeight: '700',
    color: '#7D5A50',
    flex: 1,
    lineHeight: 24,
    paddingRight: 12, // Mehr Abstand vom rechten Rand
    paddingLeft: 8, // Mehr Abstand vom linken Rand
  },
  recipeDescription: {
    fontSize: 15, // Größere Schrift für bessere Lesbarkeit
    lineHeight: 22,
    color: '#7D5A50',
    marginBottom: 18, // Mehr Abstand für bessere Trennung
    paddingHorizontal: 8, // Mehr Abstand links/rechts - nichts direkt am Rand
  },
  recipeStatsRow: {
    gap: 10, // Mehr Abstand zwischen Stats
    paddingHorizontal: 4, // Abstand vom Rand
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
  readyPill: {
    backgroundColor: 'rgba(142,78,198,0.3)',
  },
  readyText: {
    fontSize: 14, // Größere Schrift für bessere Lesbarkeit
    fontWeight: '600',
    color: '#FFFFFF',
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
  missingList: {
    gap: 4,
    paddingHorizontal: 4, // Abstand vom Rand
  },
  missingLabel: {
    fontSize: 14, // Größere Schrift für bessere Lesbarkeit
    fontWeight: '600',
    color: '#7D5A50',
    paddingHorizontal: 2, // Abstand vom Rand
  },
  missingItems: {
    fontSize: 14, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    lineHeight: 20,
    paddingHorizontal: 2, // Abstand vom Rand
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 20, // Mehr Padding - nichts direkt am Rand
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.26)',
    marginHorizontal: 4, // Zusätzlicher Abstand vom Container-Rand
  },
  tipText: {
    fontSize: 14, // Größere Schrift für bessere Lesbarkeit
    color: '#7D5A50',
    flex: 1,
    lineHeight: 20,
    paddingLeft: 4, // Abstand vom Icon
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
    marginTop: 32,
    marginBottom: 16,
    gap: 12,
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
    gap: 8,
    paddingHorizontal: 4, // Abstand vom Rand
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
    marginBottom: 24,
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
    marginBottom: 20,
  },
  recipeInfoChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
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
  myRecipesButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
});
