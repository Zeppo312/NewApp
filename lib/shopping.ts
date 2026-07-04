import { PostgrestError } from '@supabase/supabase-js';
import { getCachedUser, supabase } from './supabase';
import type { RecipeRecord } from './recipes';

export type ShoppingItemSource = 'manual' | 'recipe' | 'inventory';

export interface ShoppingListItem {
  id: string;
  baby_id: string;
  created_by: string;
  title: string;
  normalized_name: string;
  category: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  source_type: ShoppingItemSource;
  source_recipe_id: string | null;
  inventory_item_id: string | null;
  is_purchased: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryCategory = 'diapers' | 'formula' | 'care' | 'food' | 'other';

export interface InventoryItem {
  id: string;
  baby_id: string;
  created_by: string;
  name: string;
  category: InventoryCategory | string;
  barcode: string | null;
  current_quantity: number;
  unit: string;
  package_quantity: number | null;
  reorder_threshold: number;
  daily_usage_estimate: number | null;
  dosage_grams_per_100ml: number | null;
  reminder_enabled: boolean;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryTransactionType = 'usage' | 'refill' | 'scan_refill' | 'correction';

export interface InventoryUsageSummary {
  inventory_item_id: string;
  usedLast7Days: number;
  lastTransactionAt: string | null;
  lastQuantityChange: number | null;
}

type InventoryTransactionRow = {
  inventory_item_id: string;
  quantity_change: number | string;
  created_at: string;
};

export interface ProductCatalogEntry {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  default_package_quantity: number | null;
  default_unit: string | null;
  provider: 'manual' | 'open_food_facts';
  provider_payload: Record<string, unknown> | null;
}

export type ResolvedBarcodeProduct =
  | { status: 'known'; source: 'catalog' | 'open_food_facts'; product: {
      barcode: string;
      name: string;
      brand: string | null;
      category: string;
      packageQuantity: number | null;
      unit: string | null;
    } }
  | { status: 'unknown'; barcode: string };

type DataResult<T> = { data: T | null; error: PostgrestError | Error | null };

// --- Normalisierung & Parsing -------------------------------------------------

const KNOWN_UNITS = new Set([
  'g', 'kg', 'mg', 'ml', 'l', 'el', 'tl', 'stück', 'stk', 'prise', 'prisen',
  'packung', 'packungen', 'becher', 'dose', 'dosen', 'bund', 'scheibe', 'scheiben',
]);

/**
 * Normalisiert einen Zutaten-/Produktnamen für Dedupe:
 * Kleinschreibung, Whitespace kollabieren und eine einfache
 * deutsche Plural-Heuristik (Bananen -> Banane, Möhren -> Möhre).
 */
export const normalizeItemName = (raw: string): string => {
  let name = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (name.length === 0) return '';
  const words = name.split(' ');
  const lastIndex = words.length - 1;
  const last = words[lastIndex];
  if (last.length >= 5 && last.endsWith('n') && !last.endsWith('nn')) {
    words[lastIndex] = last.slice(0, -1);
  }
  return words.join(' ');
};

export interface ParsedIngredient {
  title: string;
  normalizedName: string;
  quantityValue: number | null;
  quantityUnit: string | null;
}

/**
 * Zerlegt eine freie Zutatenzeile wie "200 g Kürbis" oder "1,5 Bananen"
 * in Menge, Einheit und normalisierten Namen. Zeilen ohne führende Menge
 * bleiben unverändert als Titel bestehen.
 */
export const parseIngredientLine = (raw: string): ParsedIngredient | null => {
  const line = raw.trim().replace(/\s+/g, ' ');
  if (line.length === 0) return null;

  let quantityValue: number | null = null;
  let quantityUnit: string | null = null;
  let name = line;

  const quantityMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (quantityMatch) {
    quantityValue = parseFloat(quantityMatch[1].replace(',', '.'));
    let rest = quantityMatch[2].trim();
    const unitMatch = rest.match(/^([A-Za-zÄÖÜäöüß]+)\.?\s+(.+)$/);
    if (unitMatch && KNOWN_UNITS.has(unitMatch[1].toLowerCase())) {
      quantityUnit = unitMatch[1].toLowerCase();
      rest = unitMatch[2].trim();
    }
    name = rest;
  }

  if (name.length === 0) return null;

  return {
    title: line,
    normalizedName: normalizeItemName(name),
    quantityValue: quantityValue !== null && Number.isFinite(quantityValue) ? quantityValue : null,
    quantityUnit,
  };
};

/**
 * Dedupliziert geparste Zutaten anhand des normalisierten Namens;
 * gleiche Namen mit gleicher Einheit werden aufsummiert.
 */
export const dedupeParsedIngredients = (items: ParsedIngredient[]): ParsedIngredient[] => {
  const byName = new Map<string, ParsedIngredient>();
  for (const item of items) {
    const existing = byName.get(item.normalizedName);
    if (!existing) {
      byName.set(item.normalizedName, { ...item });
      continue;
    }
    if (
      existing.quantityValue !== null &&
      item.quantityValue !== null &&
      existing.quantityUnit === item.quantityUnit
    ) {
      existing.quantityValue += item.quantityValue;
      existing.title = formatIngredientTitle(existing);
    }
  }
  return Array.from(byName.values());
};

const formatIngredientTitle = (item: ParsedIngredient): string => {
  const displayName = item.title.replace(/^\d+(?:[.,]\d+)?\s*[A-Za-zÄÖÜäöüß]*\.?\s+/, '') || item.normalizedName;
  if (item.quantityValue === null) return displayName;
  const value = Number.isInteger(item.quantityValue)
    ? String(item.quantityValue)
    : String(item.quantityValue).replace('.', ',');
  return item.quantityUnit
    ? `${value} ${item.quantityUnit} ${displayName}`
    : `${value} ${displayName}`;
};

// --- Mengenlogik ---------------------------------------------------------------

export const clampQuantity = (value: number): number => Math.max(0, value);

export const isLowStock = (item: Pick<InventoryItem, 'current_quantity' | 'reorder_threshold'>): boolean =>
  item.reorder_threshold > 0 && item.current_quantity <= item.reorder_threshold;

/** Geschätzte Reichweite in ganzen Tagen; null ohne Verbrauchsschätzung. */
export const computeDaysLeft = (
  item: Pick<InventoryItem, 'current_quantity' | 'daily_usage_estimate'>
): number | null => {
  if (!item.daily_usage_estimate || item.daily_usage_estimate <= 0) return null;
  return Math.floor(item.current_quantity / item.daily_usage_estimate);
};

// --- Einkaufsliste --------------------------------------------------------------

export interface ShoppingState {
  shoppingItems: ShoppingListItem[];
  inventoryItems: InventoryItem[];
}

export const fetchShoppingState = async (babyId: string): Promise<DataResult<ShoppingState>> => {
  const [shoppingResult, inventoryResult] = await Promise.all([
    supabase
      .from('shopping_list_items')
      .select('*')
      .eq('baby_id', babyId)
      .order('is_purchased', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('inventory_items')
      .select('*')
      .eq('baby_id', babyId)
      .order('name', { ascending: true }),
  ]);

  const error = shoppingResult.error ?? inventoryResult.error;
  if (error) return { data: null, error };

  return {
    data: {
      shoppingItems: (shoppingResult.data ?? []) as ShoppingListItem[],
      inventoryItems: (inventoryResult.data ?? []) as InventoryItem[],
    },
    error: null,
  };
};

const numericValue = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const fetchInventoryUsageSummaries = async (
  babyId: string
): Promise<DataResult<Record<string, InventoryUsageSummary>>> => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('inventory_item_id, quantity_change, created_at')
    .eq('baby_id', babyId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error };

  const summaries: Record<string, InventoryUsageSummary> = {};
  for (const row of ((data ?? []) as InventoryTransactionRow[])) {
    const quantityChange = numericValue(row.quantity_change);
    const existing = summaries[row.inventory_item_id] ?? {
      inventory_item_id: row.inventory_item_id,
      usedLast7Days: 0,
      lastTransactionAt: null,
      lastQuantityChange: null,
    };

    if (quantityChange < 0) {
      existing.usedLast7Days += Math.abs(quantityChange);
    }
    if (!existing.lastTransactionAt) {
      existing.lastTransactionAt = row.created_at;
      existing.lastQuantityChange = quantityChange;
    }
    summaries[row.inventory_item_id] = existing;
  }

  return { data: summaries, error: null };
};

const getUserId = async (): Promise<{ userId: string | null; error: Error | null }> => {
  const { data, error } = await getCachedUser();
  if (error) return { userId: null, error };
  const userId = data.user?.id ?? null;
  if (!userId) return { userId: null, error: new Error('Benutzer ist nicht angemeldet.') };
  return { userId, error: null };
};

export const addRecipeIngredientsToShoppingList = async (
  recipe: Pick<RecipeRecord, 'id' | 'ingredients'>,
  babyId: string
): Promise<DataResult<{ added: number; skipped: number }>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const parsed = dedupeParsedIngredients(
    recipe.ingredients
      .map(parseIngredientLine)
      .filter((item): item is ParsedIngredient => item !== null)
  );
  if (parsed.length === 0) {
    return { data: { added: 0, skipped: 0 }, error: null };
  }

  const { data: existing, error: existingError } = await supabase
    .from('shopping_list_items')
    .select('normalized_name')
    .eq('baby_id', babyId)
    .eq('is_purchased', false);
  if (existingError) return { data: null, error: existingError };

  const existingNames = new Set((existing ?? []).map((row: { normalized_name: string }) => row.normalized_name));
  const toInsert = parsed.filter((item) => !existingNames.has(item.normalizedName));

  if (toInsert.length === 0) {
    return { data: { added: 0, skipped: parsed.length }, error: null };
  }

  const { error: insertError } = await supabase.from('shopping_list_items').insert(
    toInsert.map((item) => ({
      baby_id: babyId,
      created_by: userId,
      title: item.title,
      normalized_name: item.normalizedName,
      category: 'food',
      quantity_value: item.quantityValue,
      quantity_unit: item.quantityUnit,
      source_type: 'recipe' as const,
      source_recipe_id: recipe.id,
    }))
  );
  if (insertError) return { data: null, error: insertError };

  return { data: { added: toInsert.length, skipped: parsed.length - toInsert.length }, error: null };
};

export type ShoppingItemUpsert = {
  id?: string;
  title: string;
  category?: string;
  quantity_value?: number | null;
  quantity_unit?: string | null;
  source_type?: ShoppingItemSource;
  inventory_item_id?: string | null;
  notes?: string | null;
};

export const upsertShoppingItem = async (
  babyId: string,
  payload: ShoppingItemUpsert
): Promise<DataResult<ShoppingListItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const title = payload.title.trim();
  if (title.length === 0) {
    return { data: null, error: new Error('Titel darf nicht leer sein.') };
  }

  const row = {
    baby_id: babyId,
    title,
    normalized_name: normalizeItemName(title),
    category: payload.category ?? 'other',
    quantity_value: payload.quantity_value ?? null,
    quantity_unit: payload.quantity_unit ?? null,
    source_type: payload.source_type ?? 'manual',
    inventory_item_id: payload.inventory_item_id ?? null,
    notes: payload.notes ?? null,
  };

  const query = payload.id
    ? supabase.from('shopping_list_items').update(row).eq('id', payload.id).select().single()
    : supabase.from('shopping_list_items').insert({ ...row, created_by: userId }).select().single();

  const { data, error } = await query;
  return { data: (data as ShoppingListItem) ?? null, error };
};

export const toggleShoppingItemPurchased = async (
  itemId: string,
  isPurchased: boolean
): Promise<DataResult<ShoppingListItem>> => {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .update({ is_purchased: isPurchased })
    .eq('id', itemId)
    .select()
    .single();
  return { data: (data as ShoppingListItem) ?? null, error };
};

export const deleteShoppingItem = async (itemId: string): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', itemId);
  return { error };
};

// --- Vorräte --------------------------------------------------------------------

export type InventoryItemUpsert = {
  id?: string;
  name: string;
  category?: string;
  barcode?: string | null;
  current_quantity?: number;
  unit?: string;
  package_quantity?: number | null;
  reorder_threshold?: number;
  daily_usage_estimate?: number | null;
  dosage_grams_per_100ml?: number | null;
  reminder_enabled?: boolean;
};

export const upsertInventoryItem = async (
  babyId: string,
  payload: InventoryItemUpsert
): Promise<DataResult<InventoryItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const name = payload.name.trim();
  if (name.length === 0) {
    return { data: null, error: new Error('Name darf nicht leer sein.') };
  }

  const row = {
    baby_id: babyId,
    name,
    category: payload.category ?? 'other',
    barcode: payload.barcode ?? null,
    current_quantity: clampQuantity(payload.current_quantity ?? 0),
    unit: payload.unit ?? 'Stück',
    package_quantity: payload.package_quantity ?? null,
    reorder_threshold: clampQuantity(payload.reorder_threshold ?? 0),
    daily_usage_estimate: payload.daily_usage_estimate ?? null,
    dosage_grams_per_100ml: payload.dosage_grams_per_100ml ?? null,
    reminder_enabled: payload.reminder_enabled ?? true,
  };

  const query = payload.id
    ? supabase.from('inventory_items').update(row).eq('id', payload.id).select().single()
    : supabase.from('inventory_items').insert({ ...row, created_by: userId }).select().single();

  const { data, error } = await query;
  return { data: (data as InventoryItem) ?? null, error };
};

export const deleteInventoryItem = async (itemId: string): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase.from('inventory_items').delete().eq('id', itemId);
  return { error };
};

/**
 * Verbucht eine Bestandsänderung (positiv = Auffüllen, negativ = Verbrauch)
 * und schreibt einen Audit-Eintrag. Der Bestand fällt nie unter 0.
 */
export const adjustInventoryQuantity = async (
  item: Pick<InventoryItem, 'id' | 'baby_id' | 'current_quantity'>,
  quantityChange: number,
  transactionType: InventoryTransactionType,
  note?: string
): Promise<DataResult<InventoryItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  // Auf 2 Nachkommastellen runden, damit keine Float-Artefakte
  // (z. B. -17.80000000000001) in Bestand und Audit-Log landen.
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const quantityAfter = round2(clampQuantity(item.current_quantity + quantityChange));
  const effectiveChange = round2(quantityAfter - item.current_quantity);

  const { data, error } = await supabase
    .from('inventory_items')
    .update({ current_quantity: quantityAfter })
    .eq('id', item.id)
    .select()
    .single();
  if (error) return { data: null, error };

  const { error: txError } = await supabase.from('inventory_transactions').insert({
    inventory_item_id: item.id,
    baby_id: item.baby_id,
    created_by: userId,
    transaction_type: transactionType,
    quantity_change: effectiveChange,
    quantity_after: quantityAfter,
    note: note ?? null,
  });
  if (txError) {
    console.error('Failed to log inventory transaction:', txError);
  }

  return { data: (data as InventoryItem) ?? null, error: null };
};

/**
 * Füllt den Vorrat nach einem Barcode-Scan auf: existiert ein Vorratsposten
 * mit diesem Barcode, wird eine Packungsmenge addiert; sonst wird ein neuer
 * Posten mit der Packungsmenge als Startbestand angelegt.
 */
export const refillInventoryFromProduct = async (
  babyId: string,
  product: {
    barcode: string;
    name: string;
    category: string;
    packageQuantity: number;
    unit: string;
  }
): Promise<DataResult<InventoryItem>> => {
  const { data: existingItems, error: lookupError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('baby_id', babyId)
    .eq('barcode', product.barcode)
    .limit(1);
  if (lookupError) return { data: null, error: lookupError };

  const existing = (existingItems?.[0] as InventoryItem | undefined) ?? null;
  if (existing) {
    return adjustInventoryQuantity(existing, product.packageQuantity, 'scan_refill', product.name);
  }

  const created = await upsertInventoryItem(babyId, {
    name: product.name,
    category: product.category,
    barcode: product.barcode,
    current_quantity: product.packageQuantity,
    unit: product.unit,
    package_quantity: product.packageQuantity,
  });
  if (created.error || !created.data) return created;

  const { userId } = await getUserId();
  if (userId) {
    const { error: txError } = await supabase.from('inventory_transactions').insert({
      inventory_item_id: created.data.id,
      baby_id: babyId,
      created_by: userId,
      transaction_type: 'scan_refill',
      quantity_change: product.packageQuantity,
      quantity_after: created.data.current_quantity,
      note: product.name,
    });
    if (txError) {
      console.error('Failed to log inventory transaction:', txError);
    }
  }

  return created;
};

/** Windel-Vorräte des Babys, älteste zuerst — z. B. für die Auswahl im Wickeleintrag. */
export const fetchDiaperInventoryItems = async (
  babyId: string
): Promise<{ data: InventoryItem[]; error: PostgrestError | null }> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('baby_id', babyId)
    .eq('category', 'diapers')
    .order('created_at', { ascending: true });
  return { data: (data ?? []) as InventoryItem[], error };
};

/** Milchpulver-Vorräte des Babys, älteste zuerst — für die Auswahl im Fläschchen-Eintrag. */
export const fetchFormulaInventoryItems = async (
  babyId: string
): Promise<{ data: InventoryItem[]; error: PostgrestError | null }> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('baby_id', babyId)
    .eq('category', 'formula')
    .order('created_at', { ascending: true });
  return { data: (data ?? []) as InventoryItem[], error };
};

/**
 * Bucht Milchpulver für ein Fläschchen ab: aus den ml trinkfertiger Nahrung
 * und der Dosierung (g Pulver pro 100 ml) des Vorratspostens wird die
 * Grammzahl berechnet. Posten ohne Dosierung werden übersprungen; ohne
 * passenden Vorrat passiert nichts.
 */
export const recordBottleUsage = async (
  babyId: string,
  volumeMl: number,
  preferredItemId?: string | null
): Promise<DataResult<InventoryItem>> => {
  if (!Number.isFinite(volumeMl) || volumeMl <= 0) return { data: null, error: null };

  const { data: items, error } = await fetchFormulaInventoryItems(babyId);
  if (error) return { data: null, error };

  const candidates = items.filter(
    (item) => item.dosage_grams_per_100ml !== null && item.dosage_grams_per_100ml > 0
  );
  if (candidates.length === 0) return { data: null, error: null };

  const preferred = preferredItemId
    ? candidates.find((item) => item.id === preferredItemId)
    : undefined;
  const target =
    preferred ?? candidates.find((item) => item.current_quantity > 0) ?? candidates[0];
  if (target.current_quantity <= 0) return { data: target, error: null };

  const grams = Math.round((volumeMl / 100) * target.dosage_grams_per_100ml! * 10) / 10;
  if (grams <= 0) return { data: target, error: null };

  return adjustInventoryQuantity(target, -grams, 'usage', `Fläschchen ${volumeMl} ml`);
};

/** Vorratsposten anhand eines gescannten Barcodes finden — für den Einkaufs-Scan. */
export const findInventoryItemByBarcode = async (
  babyId: string,
  barcode: string
): Promise<DataResult<InventoryItem>> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('baby_id', babyId)
    .eq('barcode', barcode)
    .limit(1);
  if (error) return { data: null, error };
  return { data: (data?.[0] as InventoryItem | undefined) ?? null, error: null };
};

/**
 * Bucht eine Windel vom Vorrat ab, wenn in „Unser Tag" ein Wickeleintrag
 * angelegt wird. Mit preferredItemId wird gezielt dieser Posten abgebucht;
 * sonst der älteste mit Restbestand. Ohne Windel-Vorrat passiert nichts.
 */
export const recordDiaperUsage = async (
  babyId: string,
  preferredItemId?: string | null
): Promise<DataResult<InventoryItem>> => {
  const { data: candidates, error } = await fetchDiaperInventoryItems(babyId);
  if (error) return { data: null, error };
  if (candidates.length === 0) return { data: null, error: null };

  const preferred = preferredItemId
    ? candidates.find((item) => item.id === preferredItemId)
    : undefined;
  const target =
    preferred ?? candidates.find((item) => item.current_quantity > 0) ?? candidates[0];
  if (target.current_quantity <= 0) return { data: target, error: null };

  return adjustInventoryQuantity(target, -1, 'usage', 'Wickeleintrag aus Unser Tag');
};

/** Anzahl der Vorräte unter oder auf dem Schwellenwert — für das Badge auf der Home-Karte. */
export const fetchLowStockCount = async (babyId: string): Promise<{ count: number; error: PostgrestError | null }> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('current_quantity, reorder_threshold')
    .eq('baby_id', babyId);
  if (error) return { count: 0, error };
  const rows = (data ?? []) as Pick<InventoryItem, 'current_quantity' | 'reorder_threshold'>[];
  return { count: rows.filter(isLowStock).length, error: null };
};

export const markInventoryReminded = async (itemId: string): Promise<{ error: PostgrestError | null }> => {
  const { error } = await supabase
    .from('inventory_items')
    .update({ last_reminded_at: new Date().toISOString() })
    .eq('id', itemId);
  return { error };
};

// --- Barcode-Auflösung ------------------------------------------------------------

// Open Food/Beauty/Products Facts sind getrennte Datenbanken desselben Projekts:
// Lebensmittel & Milchpulver in Food, Feuchttücher & Pflege in Beauty,
// Windeln & sonstige Non-Food-Artikel in Products.
const OPEN_FACTS_PRODUCT_URLS = [
  'https://world.openfoodfacts.org/api/v2/product',
  'https://world.openbeautyfacts.org/api/v2/product',
  'https://world.openproductsfacts.org/api/v2/product',
];

const parseOpenFoodFactsQuantity = (
  quantity: string | undefined
): { value: number | null; unit: string | null } => {
  if (!quantity) return { value: null, unit: null };
  const match = quantity.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\b/i);
  if (!match) return { value: null, unit: null };
  return { value: parseFloat(match[1].replace(',', '.')), unit: match[2].toLowerCase() };
};

/**
 * Löst einen Barcode auf: zuerst lokaler product_catalog, dann Open Food Facts
 * (nur Hilfsquelle, Daten dort sind freiwillig gepflegt), sonst 'unknown' —
 * dann bestätigt der Nutzer die Produktdaten einmalig manuell.
 */
export const resolveBarcodeProduct = async (
  barcode: string
): Promise<DataResult<ResolvedBarcodeProduct>> => {
  const { data: catalogRows, error: catalogError } = await supabase
    .from('product_catalog')
    .select('*')
    .eq('barcode', barcode)
    .limit(1);
  if (catalogError) return { data: null, error: catalogError };

  const catalogEntry = (catalogRows?.[0] as ProductCatalogEntry | undefined) ?? null;
  if (catalogEntry) {
    return {
      data: {
        status: 'known',
        source: 'catalog',
        product: {
          barcode: catalogEntry.barcode,
          name: catalogEntry.name,
          brand: catalogEntry.brand,
          category: catalogEntry.category,
          packageQuantity: catalogEntry.default_package_quantity,
          unit: catalogEntry.default_unit,
        },
      },
      error: null,
    };
  }

  for (const baseUrl of OPEN_FACTS_PRODUCT_URLS) {
    try {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(barcode)}.json?fields=product_name,brands,quantity,categories_tags`
      );
      if (!response.ok) continue;
      const body = await response.json();
      const product = body?.product;
      const name = typeof product?.product_name === 'string' ? product.product_name.trim() : '';
      if (body?.status === 1 && name.length > 0) {
        const { value, unit } = parseOpenFoodFactsQuantity(product?.quantity);
        const isFoodSource = baseUrl.includes('openfoodfacts');
        return {
          data: {
            status: 'known',
            source: 'open_food_facts',
            product: {
              barcode,
              name,
              brand: typeof product?.brands === 'string' ? product.brands : null,
              category: isFoodSource ? 'food' : 'care',
              packageQuantity: value,
              unit,
            },
          },
          error: null,
        };
      }
    } catch (error) {
      console.warn('Open Facts lookup failed:', error);
    }
  }

  return { data: { status: 'unknown', barcode }, error: null };
};

/** Speichert eine bestätigte Barcode-Zuordnung lokal, damit der nächste Scan sofort trifft. */
export const saveProductToCatalog = async (product: {
  barcode: string;
  name: string;
  brand?: string | null;
  category: string;
  packageQuantity: number | null;
  unit: string | null;
  provider?: 'manual' | 'open_food_facts';
  providerPayload?: Record<string, unknown> | null;
}): Promise<DataResult<ProductCatalogEntry>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const { data, error } = await supabase
    .from('product_catalog')
    .upsert(
      {
        barcode: product.barcode,
        name: product.name.trim(),
        brand: product.brand ?? null,
        category: product.category,
        default_package_quantity: product.packageQuantity,
        default_unit: product.unit,
        provider: product.provider ?? 'manual',
        provider_payload: product.providerPayload ?? null,
        created_by: userId,
      },
      { onConflict: 'barcode' }
    )
    .select()
    .single();

  return { data: (data as ProductCatalogEntry) ?? null, error };
};
