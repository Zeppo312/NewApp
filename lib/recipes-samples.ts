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

const normalizeRecipeTitle = (title: string) => title.trim().toLowerCase();

const SAMPLE_IMAGE_BY_TITLE = new Map(
  RECIPE_SAMPLES.map((sample) => [normalizeRecipeTitle(sample.title), sample.image ?? null])
);

export const getSampleRecipeImage = (title: string): string | null => {
  if (!title) return null;
  return SAMPLE_IMAGE_BY_TITLE.get(normalizeRecipeTitle(title)) ?? null;
};
