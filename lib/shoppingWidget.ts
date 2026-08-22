import { NativeModules, Platform } from 'react-native';

import {
  applyPurchaseToInventory,
  fetchShoppingState,
  toggleShoppingItemPurchased,
  type InventoryItem,
  type ShoppingListItem,
} from './shopping';
import {
  DEFAULT_SHOPPING_LOCALE,
  formatShoppingQuantity,
  getShoppingUnitLabel,
  translateShoppingText,
  type ShoppingLocale,
} from './shoppingTranslations';

/**
 * Brücke zum iOS-Home-Screen-Widget der Einkaufsliste.
 *
 * App → Widget: `syncShoppingWidget` schreibt einen Snapshot in die App-Group
 * und lädt die Widget-Timeline neu.
 * Widget → App: im Widget abgehakte Posten landen in einer Warteschlange, die
 * `drainShoppingWidgetToggles` beim Aktivieren der App nach Supabase schreibt.
 *
 * Das Datenformat entspricht `ShoppingWidgetSnapshot` in
 * targets/widget/ShoppingWidgetStore.swift.
 */

type ShoppingWidgetNativeModule = {
  syncSnapshot: (json: string) => Promise<boolean>;
  clearSnapshot: () => Promise<boolean>;
  consumePendingToggles: () => Promise<string>;
  isAvailable: () => Promise<boolean>;
};

const nativeModule: ShoppingWidgetNativeModule | null =
  Platform.OS === 'ios' ? (NativeModules.ShoppingWidgetModule ?? null) : null;

export const isShoppingWidgetSupported = () => nativeModule !== null;

/** Mehr Posten braucht selbst das große Widget nicht. */
const MAX_SNAPSHOT_ITEMS = 12;

type WidgetItem = {
  id: string;
  title: string;
  quantity: string | null;
  category: string;
  purchased: boolean;
};

type PendingToggle = {
  id: string;
  purchased: boolean;
  at: number;
};

const quantityLabel = (locale: ShoppingLocale, item: ShoppingListItem): string | null => {
  if (item.quantity_value == null) {
    return item.quantity_unit ? getShoppingUnitLabel(locale, item.quantity_unit) : null;
  }
  return formatShoppingQuantity(locale, item.quantity_value, item.quantity_unit ?? '');
};

const buildSnapshot = (
  items: ShoppingListItem[],
  locale: ShoppingLocale,
  babyName: string | null
) => {
  const t = (key: string) => translateShoppingText(locale, key);

  // Offene Posten zuerst, damit das Widget bei begrenztem Platz das Wichtige zeigt.
  const ordered = [
    ...items.filter((item) => !item.is_purchased),
    ...items.filter((item) => item.is_purchased),
  ];

  const widgetItems: WidgetItem[] = ordered.slice(0, MAX_SNAPSHOT_ITEMS).map((item) => ({
    id: item.id,
    title: item.title,
    quantity: quantityLabel(locale, item),
    category: item.category,
    purchased: item.is_purchased,
  }));

  return {
    updatedAt: Date.now() / 1000,
    babyName,
    openCount: items.filter((item) => !item.is_purchased).length,
    purchasedCount: items.filter((item) => item.is_purchased).length,
    items: widgetItems,
    strings: {
      title: t('widget.title'),
      openLabel: t('widget.open'),
      doneLabel: t('widget.done'),
      emptyTitle: t('widget.emptyTitle'),
      emptyHint: t('widget.emptyHint'),
      signedOut: t('widget.signedOut'),
      moreItems: t('widget.moreItems'),
    },
  };
};

/** Schreibt den aktuellen Stand der Einkaufsliste ins Widget. */
export const syncShoppingWidget = async (
  items: ShoppingListItem[],
  options: { locale?: ShoppingLocale; babyName?: string | null } = {}
): Promise<void> => {
  if (!nativeModule) return;
  const locale = options.locale ?? DEFAULT_SHOPPING_LOCALE;
  try {
    const snapshot = buildSnapshot(items, locale, options.babyName ?? null);
    await nativeModule.syncSnapshot(JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Failed to sync shopping widget:', error);
  }
};

/** Leert das Widget, z. B. beim Abmelden oder ohne aktives Baby. */
export const clearShoppingWidget = async (): Promise<void> => {
  if (!nativeModule) return;
  try {
    await nativeModule.clearSnapshot();
  } catch (error) {
    console.warn('Failed to clear shopping widget:', error);
  }
};

const readPendingToggles = async (): Promise<PendingToggle[]> => {
  if (!nativeModule) return [];
  try {
    const raw = await nativeModule.consumePendingToggles();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingToggle[]) : [];
  } catch (error) {
    console.warn('Failed to read pending shopping widget toggles:', error);
    return [];
  }
};

export type DrainResult = {
  /** Anzahl erfolgreich nach Supabase übertragener Abhakungen. */
  applied: number;
  /** Frischer Stand der Liste, sofern etwas übertragen wurde. */
  items: ShoppingListItem[] | null;
};

/**
 * Lädt die Einkaufsliste frisch aus Supabase und schreibt sie ins Widget.
 * Nötig, damit das Widget auch dann gefüllt ist, wenn der Einkaufslisten-Screen
 * seit dem App-Start nie geöffnet wurde.
 */
export const refreshShoppingWidget = async (
  babyId: string,
  options: { locale?: ShoppingLocale; babyName?: string | null } = {}
): Promise<ShoppingListItem[] | null> => {
  if (!nativeModule || !babyId) return null;

  const { data: state, error } = await fetchShoppingState(babyId);
  if (error || !state) {
    console.warn('Failed to load shopping state for widget refresh:', error);
    return null;
  }

  await syncShoppingWidget(state.shoppingItems, {
    locale: options.locale ?? DEFAULT_SHOPPING_LOCALE,
    babyName: options.babyName ?? null,
  });
  return state.shoppingItems;
};

/**
 * Überträgt die im Widget abgehakten Posten nach Supabase, zieht verknüpfte
 * Vorräte nach und schreibt den frischen Stand zurück ins Widget.
 */
export const drainShoppingWidgetToggles = async (
  babyId: string,
  options: { locale?: ShoppingLocale; babyName?: string | null } = {}
): Promise<DrainResult> => {
  if (!nativeModule || !babyId) return { applied: 0, items: null };

  const pending = await readPendingToggles();
  if (pending.length === 0) {
    // Nichts abzuarbeiten, aber das Widget soll trotzdem den aktuellen Stand zeigen.
    await refreshShoppingWidget(babyId, options);
    return { applied: 0, items: null };
  }

  const locale = options.locale ?? DEFAULT_SHOPPING_LOCALE;
  const { data: state, error } = await fetchShoppingState(babyId);
  if (error || !state) {
    console.error('Failed to load shopping state for widget sync:', error);
    return { applied: 0, items: null };
  }

  const itemsById = new Map<string, ShoppingListItem>(
    state.shoppingItems.map((item) => [item.id, item])
  );
  const inventoryById = new Map<string, InventoryItem>(
    state.inventoryItems.map((item) => [item.id, item])
  );

  let applied = 0;

  for (const toggle of pending) {
    const item = itemsById.get(toggle.id);
    // Posten kann in der Zwischenzeit gelöscht oder bereits umgestellt worden sein.
    if (!item || item.is_purchased === toggle.purchased) continue;

    const { data: updated, error: toggleError } = await toggleShoppingItemPurchased(
      toggle.id,
      toggle.purchased
    );
    if (toggleError || !updated) {
      console.error('Failed to apply widget toggle:', toggleError);
      continue;
    }

    itemsById.set(updated.id, updated);
    applied += 1;

    const inventory = item.inventory_item_id ? inventoryById.get(item.inventory_item_id) : undefined;
    if (!inventory) continue;

    const note = translateShoppingText(
      locale,
      toggle.purchased ? 'shopping.transactionPurchase' : 'shopping.transactionReverted',
      { name: item.title }
    );
    const { data: updatedInventory } = await applyPurchaseToInventory(
      item,
      inventory,
      toggle.purchased,
      note
    );
    if (updatedInventory) {
      inventoryById.set(updatedInventory.id, updatedInventory);
    }
  }

  const items = Array.from(itemsById.values());
  await syncShoppingWidget(items, { locale, babyName: options.babyName ?? null });

  return { applied, items: applied > 0 ? items : null };
};
