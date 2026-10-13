import { PostgrestError } from '@supabase/supabase-js';
import { getCachedUser, supabase } from './supabase';
import { isShoppingPackageUnit } from './shoppingTranslations';
import type { RecipeRecord } from './recipes';

export type ShoppingItemSource = 'manual' | 'recipe' | 'inventory';

export interface ShoppingListItem {
  id: string;
  /** Legacy/activity context only; shopping data is scoped to linked parents. */
  baby_id: string | null;
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
export type InventoryTrackingMode = 'quantity' | 'level';

export const INVENTORY_LEVEL_OPTIONS = [
  { percent: 100, label: 'Voll' },
  { percent: 50, label: 'Halbvoll' },
  { percent: 20, label: 'Knapp' },
  { percent: 0, label: 'Leer' },
] as const;

export interface InventoryItem {
  id: string;
  /** Legacy context only; inventory is shared across the linked parents. */
  baby_id: string | null;
  created_by: string;
  name: string;
  category: InventoryCategory | string;
  barcode: string | null;
  current_quantity: number;
  packages_sealed: number;
  unit: string;
  package_quantity: number | null;
  reorder_threshold: number;
  daily_usage_estimate: number | null;
  dosage_grams_per_100ml: number | null;
  tracking_mode: InventoryTrackingMode;
  stock_level_percent: number;
  reorder_level_percent: number;
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
export const clampStockLevel = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

export const getInventoryLevelOption = (percent: number | null | undefined) => {
  const normalized = clampStockLevel(percent ?? 100);
  return (
    INVENTORY_LEVEL_OPTIONS.find((option) => option.percent === normalized) ??
    INVENTORY_LEVEL_OPTIONS.reduce((closest, option) =>
      Math.abs(option.percent - normalized) < Math.abs(closest.percent - normalized)
        ? option
        : closest
    )
  );
};

// Auf 2 Nachkommastellen runden, damit keine Float-Artefakte
// (z. B. -17.80000000000001) in Bestand und Audit-Log landen.
const round2 = (value: number) => Math.round(value * 100) / 100;

type PackagedQuantity = Pick<InventoryItem, 'current_quantity' | 'packages_sealed' | 'package_quantity'>;

/** Gesamtbestand = angebrochene Menge + ungeöffnete Packungen × Packungsgröße. */
export const computeTotalQuantity = (item: PackagedQuantity): number =>
  round2(item.current_quantity + (item.packages_sealed ?? 0) * (item.package_quantity ?? 0));

type StockStatusItem = PackagedQuantity &
  Pick<InventoryItem, 'reorder_threshold'> &
  Partial<
    Pick<InventoryItem, 'tracking_mode' | 'stock_level_percent' | 'reorder_level_percent'>
  >;

export const isLowStock = (item: StockStatusItem): boolean => {
  if (item.tracking_mode === 'level') {
    return (
      clampStockLevel(item.stock_level_percent ?? 100) <=
      clampStockLevel(item.reorder_level_percent ?? 20)
    );
  }
  return computeTotalQuantity(item) <= Math.max(0, item.reorder_threshold ?? 0);
};

/** Vereinfachte Sicht: Bestand als ganze Zahl (angebrochen + versiegelte Packungen). */
export const computeInventoryCount = (item: PackagedQuantity): number =>
  Math.max(0, Math.round(computeTotalQuantity(item)));

/** Geschätzte Reichweite in ganzen Tagen; null ohne Verbrauchsschätzung. */
export const computeDaysLeft = (
  item: PackagedQuantity &
    Pick<InventoryItem, 'daily_usage_estimate'> &
    Partial<Pick<InventoryItem, 'tracking_mode'>>
): number | null => {
  if (item.tracking_mode === 'level') return null;
  if (!item.daily_usage_estimate || item.daily_usage_estimate <= 0) return null;
  return Math.floor(computeTotalQuantity(item) / item.daily_usage_estimate);
};

/**
 * Wendet eine Bestandsänderung auf das Packungsmodell an. Verbrauch zehrt
 * zuerst die angebrochene Packung auf; reicht sie nicht, werden automatisch
 * so viele versiegelte Packungen geöffnet wie nötig. Auffüllen (positiv)
 * erhöht nur die angebrochene Menge — ganze Packungen kommen über
 * packages_sealed dazu. Der Gesamtbestand fällt nie unter 0.
 */
export const applyQuantityChange = (
  item: PackagedQuantity,
  quantityChange: number
): { current_quantity: number; packages_sealed: number; effectiveChange: number } => {
  const packageQuantity = item.package_quantity ?? 0;
  const sealedBefore = item.packages_sealed ?? 0;
  const totalBefore = computeTotalQuantity(item);

  if (quantityChange >= 0) {
    return {
      current_quantity: round2(item.current_quantity + quantityChange),
      packages_sealed: sealedBefore,
      effectiveChange: round2(quantityChange),
    };
  }

  const demand = -quantityChange;
  let current = item.current_quantity;
  let sealed = sealedBefore;

  if (demand > current && sealed > 0 && packageQuantity > 0) {
    const deficit = demand - current;
    const packsToOpen = Math.min(sealed, Math.ceil(deficit / packageQuantity));
    sealed -= packsToOpen;
    current += packsToOpen * packageQuantity;
  }

  const currentAfter = round2(clampQuantity(current - demand));
  const totalAfter = round2(currentAfter + sealed * packageQuantity);
  return {
    current_quantity: currentAfter,
    packages_sealed: sealed,
    effectiveChange: round2(totalAfter - totalBefore),
  };
};

// --- Einkaufsliste --------------------------------------------------------------

export interface ShoppingState {
  shoppingItems: ShoppingListItem[];
  inventoryItems: InventoryItem[];
}

export const fetchShoppingState = async (): Promise<DataResult<ShoppingState>> => {
  const [shoppingResult, inventoryResult] = await Promise.all([
    supabase
      .from('shopping_list_items')
      .select('*')
      .order('is_purchased', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('inventory_items')
      .select('*')
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

export const fetchInventoryUsageSummaries = async (): Promise<
  DataResult<Record<string, InventoryUsageSummary>>
> => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('inventory_item_id, quantity_change, created_at')
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
  recipe: Pick<RecipeRecord, 'id' | 'ingredients'>
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
    .eq('is_purchased', false);
  if (existingError) return { data: null, error: existingError };

  const existingNames = new Set((existing ?? []).map((row: { normalized_name: string }) => row.normalized_name));
  const toInsert = parsed.filter((item) => !existingNames.has(item.normalizedName));

  if (toInsert.length === 0) {
    return { data: { added: 0, skipped: parsed.length }, error: null };
  }

  const { error: insertError } = await supabase.from('shopping_list_items').insert(
    toInsert.map((item) => ({
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
  payload: ShoppingItemUpsert
): Promise<DataResult<ShoppingListItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const title = payload.title.trim();
  if (title.length === 0) {
    return { data: null, error: new Error('Titel darf nicht leer sein.') };
  }

  const row = {
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

/** Mehrere Posten auf einmal entfernen (z. B. "Alle gekauften löschen"). */
export const deleteShoppingItems = async (
  itemIds: string[]
): Promise<{ error: PostgrestError | null }> => {
  if (itemIds.length === 0) return { error: null };
  const { error } = await supabase.from('shopping_list_items').delete().in('id', itemIds);
  return { error };
};

/**
 * Stammt ein Einkaufsposten aus dem Vorrat, wird der Bestand beim Abhaken
 * erhöht — bei Packungsartikeln als ganze (versiegelte) Packung, sonst als
 * Menge. Beim Zurücknehmen wird wieder korrigiert.
 *
 * Wird sowohl vom Einkaufslisten-Screen als auch beim Nachziehen der im
 * Home-Widget abgehakten Posten verwendet.
 */
export const applyPurchaseToInventory = async (
  item: Pick<ShoppingListItem, 'title' | 'quantity_value' | 'quantity_unit'>,
  inventory: InventoryItem,
  isPurchased: boolean,
  note: string
): Promise<DataResult<InventoryItem>> => {
  if (inventory.tracking_mode === 'level') {
    return setInventoryStockLevel(inventory.id, isPurchased ? 100 : 0);
  }

  const direction = isPurchased ? 1 : -1;
  const transactionType: InventoryTransactionType = isPurchased ? 'refill' : 'correction';
  const hasPackage = (inventory.package_quantity ?? 0) > 0;

  if (hasPackage) {
    const packages = (isShoppingPackageUnit(item.quantity_unit) ? item.quantity_value ?? 1 : 1) * direction;
    return adjustSealedPackages(inventory, packages, transactionType, note);
  }

  return adjustInventoryQuantity(inventory, (item.quantity_value ?? 1) * direction, transactionType, note);
};

// --- Vorräte --------------------------------------------------------------------

export type InventoryItemUpsert = {
  id?: string;
  name: string;
  category?: string;
  barcode?: string | null;
  current_quantity?: number;
  packages_sealed?: number;
  unit?: string;
  package_quantity?: number | null;
  reorder_threshold?: number;
  daily_usage_estimate?: number | null;
  dosage_grams_per_100ml?: number | null;
  tracking_mode?: InventoryTrackingMode;
  stock_level_percent?: number;
  reorder_level_percent?: number;
  reminder_enabled?: boolean;
};

export const upsertInventoryItem = async (
  payload: InventoryItemUpsert
): Promise<DataResult<InventoryItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const name = payload.name.trim();
  if (name.length === 0) {
    return { data: null, error: new Error('Name darf nicht leer sein.') };
  }

  const row = {
    name,
    category: payload.category ?? 'other',
    barcode: payload.barcode ?? null,
    current_quantity: clampQuantity(payload.current_quantity ?? 0),
    packages_sealed: Math.max(0, Math.round(payload.packages_sealed ?? 0)),
    unit: payload.unit ?? 'Stück',
    package_quantity: payload.package_quantity ?? null,
    reorder_threshold: clampQuantity(payload.reorder_threshold ?? 0),
    daily_usage_estimate: payload.daily_usage_estimate ?? null,
    dosage_grams_per_100ml: payload.dosage_grams_per_100ml ?? null,
    tracking_mode: payload.tracking_mode ?? 'quantity',
    stock_level_percent: clampStockLevel(payload.stock_level_percent ?? 100),
    reorder_level_percent: clampStockLevel(payload.reorder_level_percent ?? 20),
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

/** Setzt einen groben Füllstand für Artikel ohne exakte Verbrauchsbuchungen. */
export const setInventoryStockLevel = async (
  itemId: string,
  percent: number
): Promise<DataResult<InventoryItem>> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({ stock_level_percent: clampStockLevel(percent) })
    .eq('id', itemId)
    .select()
    .single();
  return { data: (data as InventoryItem) ?? null, error };
};

/**
 * Verbucht eine Bestandsänderung (positiv = Auffüllen, negativ = Verbrauch)
 * und schreibt einen Audit-Eintrag. Der Bestand fällt nie unter 0.
 */
export const adjustInventoryQuantity = async (
  item: Pick<InventoryItem, 'id' | 'baby_id' | 'current_quantity' | 'packages_sealed' | 'package_quantity'>,
  quantityChange: number,
  transactionType: InventoryTransactionType,
  note?: string,
  activityBabyId: string | null = null
): Promise<DataResult<InventoryItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const next = applyQuantityChange(item, quantityChange);

  const { data, error } = await supabase
    .from('inventory_items')
    .update({ current_quantity: next.current_quantity, packages_sealed: next.packages_sealed })
    .eq('id', item.id)
    .select()
    .single();
  if (error) return { data: null, error };

  const { error: txError } = await supabase.from('inventory_transactions').insert({
    inventory_item_id: item.id,
    baby_id: activityBabyId,
    created_by: userId,
    transaction_type: transactionType,
    quantity_change: next.effectiveChange,
    quantity_after: computeTotalQuantity({ ...next, package_quantity: item.package_quantity }),
    note: note ?? null,
  });
  if (txError) {
    console.error('Failed to log inventory transaction:', txError);
  }

  return { data: (data as InventoryItem) ?? null, error: null };
};

/**
 * Setzt den Bestand auf eine ganze Zahl. Versiegelte Packungen werden dabei
 * aufgelöst, sodass current_quantity allein die Menge trägt. Die Differenz
 * landet als Audit-Eintrag (Verbrauch bzw. Auffüllen).
 */
export const setInventoryCount = async (
  item: Pick<InventoryItem, 'id' | 'baby_id' | 'current_quantity' | 'packages_sealed' | 'package_quantity'>,
  count: number,
  note?: string
): Promise<DataResult<InventoryItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const target = Math.max(0, Math.round(count));
  const before = computeTotalQuantity(item);
  const change = round2(target - before);

  const { data, error } = await supabase
    .from('inventory_items')
    .update({ current_quantity: target, packages_sealed: 0 })
    .eq('id', item.id)
    .select()
    .single();
  if (error) return { data: null, error };

  if (change !== 0) {
    const { error: txError } = await supabase.from('inventory_transactions').insert({
      inventory_item_id: item.id,
      baby_id: null,
      created_by: userId,
      transaction_type: change < 0 ? 'usage' : 'refill',
      quantity_change: change,
      quantity_after: target,
      note: note ?? null,
    });
    if (txError) {
      console.error('Failed to log inventory transaction:', txError);
    }
  }

  return { data: (data as InventoryItem) ?? null, error: null };
};

/**
 * Bucht ganze (versiegelte) Packungen zu oder ab — z. B. +1 nach dem Einkauf
 * oder dem Scan. Der Audit-Eintrag hält die Änderung in der Basiseinheit fest
 * (Packungen × Packungsgröße). packages_sealed fällt nie unter 0.
 */
export const adjustSealedPackages = async (
  item: Pick<InventoryItem, 'id' | 'baby_id' | 'current_quantity' | 'packages_sealed' | 'package_quantity'>,
  packageDelta: number,
  transactionType: InventoryTransactionType,
  note?: string
): Promise<DataResult<InventoryItem>> => {
  const { userId, error: userError } = await getUserId();
  if (!userId) return { data: null, error: userError };

  const sealedBefore = item.packages_sealed ?? 0;
  const sealedAfter = Math.max(0, Math.round(sealedBefore + packageDelta));
  const effectivePackages = sealedAfter - sealedBefore;

  const { data, error } = await supabase
    .from('inventory_items')
    .update({ packages_sealed: sealedAfter })
    .eq('id', item.id)
    .select()
    .single();
  if (error) return { data: null, error };

  const packageQuantity = item.package_quantity ?? 1;
  const { error: txError } = await supabase.from('inventory_transactions').insert({
    inventory_item_id: item.id,
    baby_id: null,
    created_by: userId,
    transaction_type: transactionType,
    quantity_change: round2(effectivePackages * packageQuantity),
    quantity_after: computeTotalQuantity({ ...item, packages_sealed: sealedAfter }),
    note: note ?? null,
  });
  if (txError) {
    console.error('Failed to log inventory transaction:', txError);
  }

  return { data: (data as InventoryItem) ?? null, error: null };
};

/**
 * Legt nach einem Barcode-Scan ein Stück in den Vorrat: existiert ein Posten
 * mit diesem Barcode, zählt die Menge um 1 hoch; sonst entsteht ein neuer
 * Posten mit Menge 1. Packungsgröße und Einheit werden nur als Info gemerkt.
 */
export const refillInventoryFromProduct = async (
  product: {
    barcode: string;
    name: string;
    category: string;
    packageQuantity: number | null;
    unit: string | null;
  }
): Promise<DataResult<InventoryItem>> => {
  const { data: existingItems, error: lookupError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('barcode', product.barcode)
    .limit(1);
  if (lookupError) return { data: null, error: lookupError };

  const existing = (existingItems?.[0] as InventoryItem | undefined) ?? null;
  if (existing) {
    return setInventoryCount(existing, computeInventoryCount(existing) + 1, product.name);
  }

  const created = await upsertInventoryItem({
    name: product.name,
    category: product.category,
    barcode: product.barcode,
    current_quantity: 1,
    packages_sealed: 0,
    unit: product.unit ?? 'Stück',
    package_quantity: product.packageQuantity,
  });
  if (created.error || !created.data) return created;

  const { userId } = await getUserId();
  if (userId) {
    const { error: txError } = await supabase.from('inventory_transactions').insert({
      inventory_item_id: created.data.id,
      baby_id: null,
      created_by: userId,
      transaction_type: 'scan_refill',
      quantity_change: 1,
      quantity_after: 1,
      note: product.name,
    });
    if (txError) {
      console.error('Failed to log inventory transaction:', txError);
    }
  }

  return created;
};

/** Gemeinsame Windel-Vorräte des Haushalts, älteste zuerst. */
export const fetchDiaperInventoryItems = async (): Promise<{
  data: InventoryItem[];
  error: PostgrestError | null;
}> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('category', 'diapers')
    .order('created_at', { ascending: true });
  return { data: (data ?? []) as InventoryItem[], error };
};

/** Gemeinsame Milchpulver-Vorräte des Haushalts, älteste zuerst. */
export const fetchFormulaInventoryItems = async (): Promise<{
  data: InventoryItem[];
  error: PostgrestError | null;
}> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
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

  const { data: items, error } = await fetchFormulaInventoryItems();
  if (error) return { data: null, error };

  const candidates = items.filter(
    (item) => item.dosage_grams_per_100ml !== null && item.dosage_grams_per_100ml > 0
  );
  if (candidates.length === 0) return { data: null, error: null };

  const preferred = preferredItemId
    ? candidates.find((item) => item.id === preferredItemId)
    : undefined;
  const target =
    preferred ?? candidates.find((item) => computeTotalQuantity(item) > 0) ?? candidates[0];
  if (computeTotalQuantity(target) <= 0) return { data: target, error: null };

  const grams = Math.round((volumeMl / 100) * target.dosage_grams_per_100ml! * 10) / 10;
  if (grams <= 0) return { data: target, error: null };

  return adjustInventoryQuantity(
    target,
    -grams,
    'usage',
    `Fläschchen ${volumeMl} ml`,
    babyId
  );
};

/** Vorratsposten anhand eines gescannten Barcodes finden — für den Einkaufs-Scan. */
export const findInventoryItemByBarcode = async (
  barcode: string
): Promise<DataResult<InventoryItem>> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
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
  const { data: candidates, error } = await fetchDiaperInventoryItems();
  if (error) return { data: null, error };
  if (candidates.length === 0) return { data: null, error: null };

  const preferred = preferredItemId
    ? candidates.find((item) => item.id === preferredItemId)
    : undefined;
  const target =
    preferred ?? candidates.find((item) => computeTotalQuantity(item) > 0) ?? candidates[0];
  if (computeTotalQuantity(target) <= 0) return { data: target, error: null };

  return adjustInventoryQuantity(
    target,
    -1,
    'usage',
    'Wickeleintrag aus Unser Tag',
    babyId
  );
};

/** Anzahl der Vorräte unter oder auf dem Schwellenwert — für das Badge auf der Home-Karte. */
export const fetchLowStockCount = async (): Promise<{
  count: number;
  error: PostgrestError | null;
}> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      'current_quantity, packages_sealed, package_quantity, reorder_threshold, tracking_mode, stock_level_percent, reorder_level_percent'
    );
  if (error) return { count: 0, error };
  const rows = (data ?? []) as Pick<
    InventoryItem,
    | 'current_quantity'
    | 'packages_sealed'
    | 'package_quantity'
    | 'reorder_threshold'
    | 'tracking_mode'
    | 'stock_level_percent'
    | 'reorder_level_percent'
  >[];
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

// --- Produktdetails (Open Facts) --------------------------------------------------

export interface ProductNutrient {
  key: string;
  value: number;
  unit: string;
}

/** Alles, was die Open-Facts-Datenbanken zu einem Barcode hergeben (lückenhaft, freiwillig gepflegt). */
export interface ProductDetails {
  barcode: string;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  servingSize: string | null;
  imageUrl: string | null;
  categories: string[];
  labels: string[];
  countries: string[];
  origins: string | null;
  manufacturingPlaces: string | null;
  stores: string[];
  packaging: string | null;
  ingredientsText: string | null;
  allergens: string[];
  traces: string[];
  nutriScore: string | null;
  novaGroup: number | null;
  ecoScore: string | null;
  nutrients: ProductNutrient[];
  source: 'open_food_facts' | 'open_beauty_facts' | 'open_products_facts' | 'catalog';
}

const PRODUCT_DETAIL_FIELDS = [
  'product_name',
  'brands',
  'quantity',
  'serving_size',
  'image_front_url',
  'categories',
  'labels',
  'countries',
  'origins',
  'manufacturing_places',
  'stores',
  'packaging',
  'ingredients_text_de',
  'ingredients_text',
  'allergens_tags',
  'traces_tags',
  'nutriscore_grade',
  'nova_group',
  'ecoscore_grade',
  'nutriments',
].join(',');

const NUTRIENT_KEYS: { key: string; field: string; unit: string }[] = [
  { key: 'energy', field: 'energy-kcal_100g', unit: 'kcal' },
  { key: 'fat', field: 'fat_100g', unit: 'g' },
  { key: 'saturatedFat', field: 'saturated-fat_100g', unit: 'g' },
  { key: 'carbohydrates', field: 'carbohydrates_100g', unit: 'g' },
  { key: 'sugars', field: 'sugars_100g', unit: 'g' },
  { key: 'fiber', field: 'fiber_100g', unit: 'g' },
  { key: 'proteins', field: 'proteins_100g', unit: 'g' },
  { key: 'salt', field: 'salt_100g', unit: 'g' },
];

const splitList = (value: unknown): string[] =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

/** "en:milk" -> "milk", "de:weizen" -> "weizen" */
const cleanTags = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim())
        .filter((entry) => entry.length > 0)
    : [];

const optionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const parseProductDetails = (
  barcode: string,
  raw: Record<string, any>,
  source: ProductDetails['source']
): ProductDetails => {
  const nutriments = (raw?.nutriments ?? {}) as Record<string, unknown>;
  const nutrients: ProductNutrient[] = [];
  for (const entry of NUTRIENT_KEYS) {
    const value = Number(nutriments[entry.field]);
    if (Number.isFinite(value)) nutrients.push({ key: entry.key, value, unit: entry.unit });
  }
  const novaRaw = Number(raw?.nova_group);
  const grade = (value: unknown) => {
    const text = optionalString(value)?.toLowerCase() ?? null;
    return text && /^[a-e]$/.test(text) ? text.toUpperCase() : null;
  };
  return {
    barcode,
    name: optionalString(raw?.product_name),
    brand: optionalString(raw?.brands),
    quantity: optionalString(raw?.quantity),
    servingSize: optionalString(raw?.serving_size),
    imageUrl: optionalString(raw?.image_front_url),
    categories: splitList(raw?.categories),
    labels: splitList(raw?.labels),
    countries: splitList(raw?.countries),
    origins: optionalString(raw?.origins),
    manufacturingPlaces: optionalString(raw?.manufacturing_places),
    stores: splitList(raw?.stores),
    packaging: optionalString(raw?.packaging),
    ingredientsText: optionalString(raw?.ingredients_text_de) ?? optionalString(raw?.ingredients_text),
    allergens: cleanTags(raw?.allergens_tags),
    traces: cleanTags(raw?.traces_tags),
    nutriScore: grade(raw?.nutriscore_grade),
    novaGroup: Number.isFinite(novaRaw) && novaRaw > 0 ? novaRaw : null,
    ecoScore: grade(raw?.ecoscore_grade),
    nutrients,
    source,
  };
};

const sourceForUrl = (baseUrl: string): ProductDetails['source'] =>
  baseUrl.includes('openbeautyfacts')
    ? 'open_beauty_facts'
    : baseUrl.includes('openproductsfacts')
    ? 'open_products_facts'
    : 'open_food_facts';

/**
 * Holt alle verfügbaren Produktdaten zu einem Barcode. Erst live aus den
 * Open-Facts-Datenbanken; schlägt das fehl, aus dem lokal gespeicherten
 * provider_payload im Katalog. Null, wenn nirgends etwas bekannt ist.
 */
export const fetchProductDetails = async (barcode: string): Promise<ProductDetails | null> => {
  for (const baseUrl of OPEN_FACTS_PRODUCT_URLS) {
    try {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(barcode)}.json?fields=${PRODUCT_DETAIL_FIELDS}`
      );
      if (!response.ok) continue;
      const body = await response.json();
      if (body?.status === 1 && body?.product) {
        const details = parseProductDetails(barcode, body.product, sourceForUrl(baseUrl));
        // Rohdaten lokal merken, damit die Info auch offline erreichbar bleibt.
        void supabase
          .from('product_catalog')
          .update({ provider_payload: body.product })
          .eq('barcode', barcode)
          .then(() => undefined);
        return details;
      }
    } catch (error) {
      console.warn('Open Facts details lookup failed:', error);
    }
  }

  const { data } = await supabase
    .from('product_catalog')
    .select('*')
    .eq('barcode', barcode)
    .limit(1);
  const entry = (data?.[0] as ProductCatalogEntry | undefined) ?? null;
  if (!entry) return null;
  const payload = (entry.provider_payload ?? {}) as Record<string, any>;
  const details = parseProductDetails(barcode, payload, 'catalog');
  return {
    ...details,
    name: details.name ?? entry.name,
    brand: details.brand ?? entry.brand,
  };
};
