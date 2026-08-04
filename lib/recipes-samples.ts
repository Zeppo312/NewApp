export type RecipeSample = {
  id: string;
  title: string;
  description: string;
  min_months: number;
  ingredients: string[];
  allergens?: string[];
  instructions: string;
  tip?: string;
  image?: string;
  emoji?: string;
};

import type { AppLocale } from './localization';

export const RECIPE_SAMPLES: RecipeSample[] = [
  {
    id: 'sweet-potato',
    title: 'Süßkartoffel & Kichererbsen Mash',
    description: 'Cremiger BLW-Mash mit milden Kräutern – perfekt zum Löffeln oder Dippen.',
    min_months: 6,
    ingredients: ['Süßkartoffel', 'Kichererbsen', 'Rapsöl', 'Kräuter'],
    instructions:
      'Süßkartoffel schälen, würfeln und weich garen. Kichererbsen abspülen, mit der warmen Süßkartoffel zerdrücken, Rapsöl und Kräuter unterrühren.',
    tip: 'Kichererbsen kurz pürieren, damit kleine Hände sie gut greifen können.',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=50',
    emoji: '🥔',
  },
  {
    id: 'apple-porridge',
    title: 'Apfel-Hafer-Porridge',
    description: 'Warmer Haferschmaus mit Apfelstückchen und optional Joghurt.',
    min_months: 6,
    ingredients: ['Haferflocken', 'Apfel', 'Naturjoghurt', 'Rapsöl'],
    allergens: ['gluten', 'milk'],
    instructions:
      'Haferflocken köcheln, Apfel fein reiben und kurz mitziehen lassen. Vom Herd nehmen, Rapsöl und ggf. Joghurt einrühren.',
    tip: 'Für milchfrei den Joghurt durch Haferdrink ersetzen.',
    image: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=400&q=50',
    emoji: '🍎',
  },
  {
    id: 'broccoli-balls',
    title: 'Brokkoli-Lachs-Bällchen',
    description: 'Weiche Fingerfood-Bällchen mit Omega-3-Power.',
    min_months: 7,
    ingredients: ['Brokkoli', 'Lachs', 'Kartoffel', 'Olivenöl'],
    allergens: ['fish'],
    instructions:
      'Kartoffeln und Brokkoli weich dämpfen. Lachs zupfen, alles zerdrücken, zu Bällchen formen, mit Öl bestreichen und kurz backen.',
    tip: 'Backen, bis sie außen leicht gold sind – dann zerfallen sie nicht.',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=50',
    emoji: '🥦',
  },
  {
    id: 'banana-pancake',
    title: 'Banane-Hirse-Puffer',
    description: 'Schnelle Puffer ohne Zucker – ideal als Frühstück oder Snack.',
    min_months: 8,
    ingredients: ['Banane', 'Hirse', 'Ei', 'Rapsöl'],
    allergens: ['egg'],
    instructions:
      'Gekochte Hirse mit Banane und Ei verrühren, kleine Puffer formen und in wenig Öl ausbacken.',
    tip: 'Für allergiefreundlich das Ei durch Apfelmus ersetzen.',
    image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=400&q=50',
    emoji: '🍌',
  },
  {
    id: 'avocado-toast',
    title: 'Avocado-Erbsen-Toast',
    description: 'Weicher Toast mit cremigem Belag – prima zum Selbstschmieren.',
    min_months: 9,
    ingredients: ['Vollkornbrot', 'Avocado', 'Erbsen', 'Frischkäse'],
    allergens: ['gluten', 'milk'],
    instructions:
      'Erbsen blanchieren, mit Avocado und Frischkäse zerdrücken. Brot toasten, Creme aufstreichen, in Streifen schneiden.',
    tip: 'Rinde entfernen, damit es kleine Esser leichter haben.',
    image: 'https://images.unsplash.com/photo-1524186304631-1952b10641a9?auto=format&fit=crop&w=400&q=50',
    emoji: '🥑',
  },
  {
    id: 'pumpkin-soup',
    title: 'Kürbis-Kokos-Suppe',
    description: 'Samtene Suppe, leicht süßlich und sanft gewürzt.',
    min_months: 7,
    ingredients: ['Kürbis', 'Kartoffel', 'Kokosmilch', 'Rapsöl'],
    instructions:
      'Kürbis und Kartoffel würfeln, anschwitzen, mit Wasser aufgießen, weich kochen, Kokosmilch zugeben und fein pürieren.',
    image: 'https://images.unsplash.com/photo-1542541864-4abf21a55761?auto=format&fit=crop&w=400&q=50',
    emoji: '🎃',
  },
  {
    id: 'zucchini-lentil',
    title: 'Zucchini-Linsen-Gulasch',
    description: 'Sämiger Gemüse-Linsen-Eintopf, ideal zum Löffeln.',
    min_months: 8,
    ingredients: ['Zucchini', 'Rote Linsen', 'Karotte', 'Tomate', 'Olivenöl', 'Kräuter'],
    instructions:
      'Karotte und Zucchini anschwitzen, Linsen und Tomate dazu, mit Wasser bedecken, weich köcheln, mild würzen.',
    image: 'https://images.unsplash.com/photo-1481934353530-318b6f776db0?auto=format&fit=crop&w=400&q=50',
    emoji: '🍲',
  },
  {
    id: 'carrot-polenta',
    title: 'Karotten-Polenta-Sticks',
    description: 'Knusprige Sticks, die innen weich bleiben.',
    min_months: 9,
    ingredients: ['Polenta', 'Karotte', 'Butter', 'Kräuter'],
    allergens: ['milk'],
    instructions:
      'Polenta kochen, geriebene Karotte und Kräuter unterheben, Masse abkühlen lassen, in Sticks schneiden und kurz backen.',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=50',
    emoji: '🥕',
  },
  {
    id: 'pear-compote',
    title: 'Apfel-Birnen-Kompott mit Hirse',
    description: 'Fruchtiger Kompott mit extra Eisen aus der Hirse.',
    min_months: 6,
    ingredients: ['Apfel', 'Birne', 'Hirse', 'Zimt'],
    instructions:
      'Apfel und Birne würfeln, mit Wasser und Zimt weich kochen. Gekochte Hirse unterrühren, grob pürieren.',
    image: 'https://images.unsplash.com/photo-1502741126161-b048400d0832?auto=format&fit=crop&w=400&q=50',
    emoji: '🍐',
  },
  {
    id: 'chicken-rice',
    title: 'Hühnchen-Reis-Bowl',
    description: 'Herzhafte Schüssel mit zarten Hühnchenstreifen und Gemüse.',
    min_months: 9,
    ingredients: ['Hühnchen', 'Reis', 'Brokkoli', 'Erbsen', 'Rapsöl'],
    instructions:
      'Reis garen, Hühnchen sanft gar ziehen, Brokkoli und Erbsen dämpfen, alles mit Rapsöl vermengen.',
    image: 'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=400&q=50',
    emoji: '🍲',
  },
  {
    id: 'pumpkin-coconut',
    title: 'Kürbis-Kokos-Suppe (mild)',
    description: 'Sanft, leicht süßlich und cremig.',
    min_months: 7,
    ingredients: ['Kürbis', 'Kartoffel', 'Kokosmilch', 'Rapsöl'],
    instructions:
      'Kürbis und Kartoffel anschwitzen, mit Wasser aufgießen, weich kochen, Kokosmilch einrühren und pürieren.',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=50',
    emoji: '🥥',
  },
  {
    id: 'spinach-pasta',
    title: 'Spinat-Ricotta-Pasta',
    description: 'Cremige Pasta mit mildem Spinat und Ricotta.',
    min_months: 10,
    ingredients: ['Vollkornnudeln', 'Spinat', 'Ricotta', 'Olivenöl'],
    allergens: ['gluten', 'milk'],
    instructions:
      'Pasta kochen, Spinat dämpfen und hacken, Ricotta mit Nudelwasser cremig rühren, Spinat und Öl zugeben.',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=50',
    emoji: '🍝',
  },
  {
    id: 'pear-muffins',
    title: 'Birnen-Buchweizen-Muffins',
    description: 'Saftige Mini-Muffins ohne Zuckerzusatz.',
    min_months: 10,
    ingredients: ['Birne', 'Buchweizenmehl', 'Ei', 'Rapsöl', 'Backpulver'],
    allergens: ['egg'],
    instructions:
      'Birne reiben, mit Mehl, Ei, Backpulver und Öl verrühren, in Mini-Förmchen füllen und backen.',
    image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=400&q=50',
    emoji: '🧁',
  },
];

type RecipeTranslation = Pick<RecipeSample, 'title' | 'description' | 'ingredients' | 'instructions' | 'tip'>;

const translatedSamples: Record<'en' | 'es', Record<string, RecipeTranslation>> = {
  en: {
    'sweet-potato': { title: 'Sweet Potato & Chickpea Mash', description: 'Creamy, mildly seasoned mash for spooning or dipping.', ingredients: ['Sweet potato', 'Chickpeas', 'Canola oil', 'Herbs'], instructions: 'Peel and dice the sweet potato, then cook until soft. Rinse the chickpeas, mash them with the warm sweet potato, and stir in the oil and herbs.', tip: 'Blend the chickpeas briefly so little hands can manage the texture.' },
    'apple-porridge': { title: 'Apple Oat Porridge', description: 'Warm oat porridge with apple and optional yogurt.', ingredients: ['Rolled oats', 'Apple', 'Plain yogurt', 'Canola oil'], instructions: 'Simmer the oats, finely grate the apple, and cook it briefly with the oats. Remove from the heat and stir in the oil and yogurt if desired.', tip: 'For a dairy-free version, replace the yogurt with an oat drink.' },
    'broccoli-balls': { title: 'Broccoli Salmon Bites', description: 'Soft finger-food bites with omega-3.', ingredients: ['Broccoli', 'Salmon', 'Potato', 'Olive oil'], instructions: 'Steam the potato and broccoli until soft. Flake the salmon, mash everything together, shape into balls, brush with oil, and bake briefly.', tip: 'Bake until lightly golden outside so the bites hold together.' },
    'banana-pancake': { title: 'Banana Millet Pancakes', description: 'Quick, sugar-free pancakes for breakfast or a snack.', ingredients: ['Banana', 'Millet', 'Egg', 'Canola oil'], instructions: 'Mix cooked millet with banana and egg, shape small pancakes, and cook them in a little oil.', tip: 'For an egg-free version, replace the egg with apple purée.' },
    'avocado-toast': { title: 'Avocado Pea Toast', description: 'Soft toast with a creamy spread, ideal for self-feeding.', ingredients: ['Whole-grain bread', 'Avocado', 'Peas', 'Cream cheese'], instructions: 'Blanch the peas and mash with the avocado and cream cheese. Toast the bread, spread the mixture on top, and cut into strips.', tip: 'Remove the crust to make it easier for little eaters.' },
    'pumpkin-soup': { title: 'Pumpkin Coconut Soup', description: 'Silky, gently seasoned soup with a mild sweetness.', ingredients: ['Pumpkin', 'Potato', 'Coconut milk', 'Canola oil'], instructions: 'Dice and sauté the pumpkin and potato, add water, cook until soft, add coconut milk, and blend until smooth.', tip: undefined },
    'zucchini-lentil': { title: 'Zucchini Lentil Stew', description: 'Thick vegetable and lentil stew, perfect for spooning.', ingredients: ['Zucchini', 'Red lentils', 'Carrot', 'Tomato', 'Olive oil', 'Herbs'], instructions: 'Sauté the carrot and zucchini, add the lentils and tomato, cover with water, simmer until soft, and season gently.', tip: undefined },
    'carrot-polenta': { title: 'Carrot Polenta Sticks', description: 'Crisp sticks that stay soft inside.', ingredients: ['Polenta', 'Carrot', 'Butter', 'Herbs'], instructions: 'Cook the polenta, fold in grated carrot and herbs, let the mixture cool, cut into sticks, and bake briefly.', tip: undefined },
    'pear-compote': { title: 'Apple Pear Compote with Millet', description: 'Fruity compote with extra iron from millet.', ingredients: ['Apple', 'Pear', 'Millet', 'Cinnamon'], instructions: 'Dice the apple and pear and cook with water and cinnamon until soft. Stir in cooked millet and blend roughly.', tip: undefined },
    'chicken-rice': { title: 'Chicken Rice Bowl', description: 'Savory bowl with tender chicken strips and vegetables.', ingredients: ['Chicken', 'Rice', 'Broccoli', 'Peas', 'Canola oil'], instructions: 'Cook the rice, gently poach the chicken, steam the broccoli and peas, and combine everything with the oil.', tip: undefined },
    'pumpkin-coconut': { title: 'Mild Pumpkin Coconut Soup', description: 'Gentle, lightly sweet, and creamy.', ingredients: ['Pumpkin', 'Potato', 'Coconut milk', 'Canola oil'], instructions: 'Sauté the pumpkin and potato, add water, cook until soft, stir in coconut milk, and blend.', tip: undefined },
    'spinach-pasta': { title: 'Spinach Ricotta Pasta', description: 'Creamy pasta with mild spinach and ricotta.', ingredients: ['Whole-grain pasta', 'Spinach', 'Ricotta', 'Olive oil'], instructions: 'Cook the pasta, steam and chop the spinach, loosen the ricotta with pasta water, then add the spinach and oil.', tip: undefined },
    'pear-muffins': { title: 'Pear Buckwheat Muffins', description: 'Moist mini muffins with no added sugar.', ingredients: ['Pear', 'Buckwheat flour', 'Egg', 'Canola oil', 'Baking powder'], instructions: 'Grate the pear, mix with flour, egg, baking powder, and oil, spoon into mini molds, and bake.', tip: undefined },
  },
  es: {
    'sweet-potato': { title: 'Puré de boniato y garbanzos', description: 'Puré cremoso con hierbas suaves, ideal para cuchara o para mojar.', ingredients: ['Boniato', 'Garbanzos', 'Aceite de colza', 'Hierbas'], instructions: 'Pela y corta el boniato y cuécelo hasta que esté tierno. Enjuaga los garbanzos, aplástalos con el boniato caliente y añade el aceite y las hierbas.', tip: 'Tritura brevemente los garbanzos para conseguir una textura fácil de manejar.' },
    'apple-porridge': { title: 'Gachas de avena y manzana', description: 'Avena caliente con manzana y yogur opcional.', ingredients: ['Copos de avena', 'Manzana', 'Yogur natural', 'Aceite de colza'], instructions: 'Cuece la avena, ralla la manzana y cocínala brevemente con los copos. Retira del fuego y añade el aceite y, si quieres, el yogur.', tip: 'Para una versión sin lácteos, sustituye el yogur por bebida de avena.' },
    'broccoli-balls': { title: 'Bolitas de brócoli y salmón', description: 'Bolitas blandas para comer con las manos, ricas en omega-3.', ingredients: ['Brócoli', 'Salmón', 'Patata', 'Aceite de oliva'], instructions: 'Cuece al vapor la patata y el brócoli. Desmenuza el salmón, aplasta todo, forma bolitas, pincela con aceite y hornea brevemente.', tip: 'Hornéalas hasta que estén ligeramente doradas por fuera para que no se deshagan.' },
    'banana-pancake': { title: 'Tortitas de plátano y mijo', description: 'Tortitas rápidas sin azúcar para desayunar o merendar.', ingredients: ['Plátano', 'Mijo', 'Huevo', 'Aceite de colza'], instructions: 'Mezcla el mijo cocido con el plátano y el huevo, forma tortitas pequeñas y cocínalas con un poco de aceite.', tip: 'Para una versión sin huevo, sustitúyelo por puré de manzana.' },
    'avocado-toast': { title: 'Tostada de aguacate y guisantes', description: 'Tostada blanda con una crema suave, ideal para comer solo.', ingredients: ['Pan integral', 'Aguacate', 'Guisantes', 'Queso crema'], instructions: 'Escalda los guisantes y aplástalos con el aguacate y el queso crema. Tuesta el pan, unta la mezcla y córtalo en tiras.', tip: 'Retira la corteza para facilitarlo a los más pequeños.' },
    'pumpkin-soup': { title: 'Crema de calabaza y coco', description: 'Crema aterciopelada, suave y ligeramente dulce.', ingredients: ['Calabaza', 'Patata', 'Leche de coco', 'Aceite de colza'], instructions: 'Corta y rehoga la calabaza y la patata, añade agua, cuece hasta que estén tiernas, incorpora la leche de coco y tritura.', tip: undefined },
    'zucchini-lentil': { title: 'Guiso de calabacín y lentejas', description: 'Guiso espeso de verduras y lentejas, ideal para cuchara.', ingredients: ['Calabacín', 'Lentejas rojas', 'Zanahoria', 'Tomate', 'Aceite de oliva', 'Hierbas'], instructions: 'Rehoga la zanahoria y el calabacín, añade las lentejas y el tomate, cubre con agua, cuece hasta que esté tierno y sazona suavemente.', tip: undefined },
    'carrot-polenta': { title: 'Palitos de polenta y zanahoria', description: 'Palitos crujientes por fuera y blandos por dentro.', ingredients: ['Polenta', 'Zanahoria', 'Mantequilla', 'Hierbas'], instructions: 'Cuece la polenta, añade la zanahoria rallada y las hierbas, deja enfriar, corta en palitos y hornea brevemente.', tip: undefined },
    'pear-compote': { title: 'Compota de manzana y pera con mijo', description: 'Compota afrutada con el hierro adicional del mijo.', ingredients: ['Manzana', 'Pera', 'Mijo', 'Canela'], instructions: 'Corta la manzana y la pera y cuécelas con agua y canela. Añade el mijo cocido y tritura de forma gruesa.', tip: undefined },
    'chicken-rice': { title: 'Bol de pollo y arroz', description: 'Bol sabroso con pollo tierno y verduras.', ingredients: ['Pollo', 'Arroz', 'Brócoli', 'Guisantes', 'Aceite de colza'], instructions: 'Cuece el arroz y el pollo suavemente, cocina al vapor el brócoli y los guisantes y mezcla todo con el aceite.', tip: undefined },
    'pumpkin-coconut': { title: 'Crema suave de calabaza y coco', description: 'Suave, cremosa y ligeramente dulce.', ingredients: ['Calabaza', 'Patata', 'Leche de coco', 'Aceite de colza'], instructions: 'Rehoga la calabaza y la patata, añade agua, cuece hasta que estén tiernas, incorpora la leche de coco y tritura.', tip: undefined },
    'spinach-pasta': { title: 'Pasta con espinacas y ricotta', description: 'Pasta cremosa con espinacas suaves y ricotta.', ingredients: ['Pasta integral', 'Espinacas', 'Ricotta', 'Aceite de oliva'], instructions: 'Cuece la pasta, cocina al vapor y pica las espinacas, mezcla la ricotta con agua de cocción y añade las espinacas y el aceite.', tip: undefined },
    'pear-muffins': { title: 'Muffins de pera y trigo sarraceno', description: 'Mini muffins jugosos sin azúcar añadido.', ingredients: ['Pera', 'Harina de trigo sarraceno', 'Huevo', 'Aceite de colza', 'Levadura química'], instructions: 'Ralla la pera, mezcla con harina, huevo, levadura y aceite, reparte en moldes pequeños y hornea.', tip: undefined },
  },
};

export const getLocalizedRecipeSamples = (locale: AppLocale): RecipeSample[] => {
  if (locale === 'de') return RECIPE_SAMPLES;
  return RECIPE_SAMPLES.map((sample) => ({ ...sample, ...translatedSamples[locale][sample.id] }));
};

const normalizeRecipeTitle = (title: string) => title.trim().toLowerCase();

const SAMPLE_IMAGE_BY_TITLE = new Map(
  (['de', 'en', 'es'] as AppLocale[])
    .flatMap((locale) => getLocalizedRecipeSamples(locale))
    .map((sample) => [normalizeRecipeTitle(sample.title), sample.image ?? null])
);

export const getSampleRecipeImage = (title: string): string | null => {
  if (!title) return null;
  return SAMPLE_IMAGE_BY_TITLE.get(normalizeRecipeTitle(title)) ?? null;
};
