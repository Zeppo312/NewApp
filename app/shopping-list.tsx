import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LiquidGlassCard, PRIMARY, RADIUS } from '@/constants/DesignGuide';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useNotifications } from '@/hooks/useNotifications';
import { formatUnitQuantity } from '@/lib/units';
import {
  adjustInventoryQuantity,
  adjustSealedPackages,
  computeDaysLeft,
  computeTotalQuantity,
  deleteInventoryItem,
  deleteShoppingItem,
  fetchInventoryUsageSummaries,
  fetchShoppingState,
  findInventoryItemByBarcode,
  InventoryItem,
  InventoryUsageSummary,
  isLowStock,
  markInventoryReminded,
  normalizeItemName,
  refillInventoryFromProduct,
  resolveBarcodeProduct,
  ResolvedBarcodeProduct,
  saveProductToCatalog,
  ShoppingListItem,
  toggleShoppingItemPurchased,
  upsertInventoryItem,
  upsertShoppingItem,
} from '@/lib/shopping';

type SectionKey = 'shopping' | 'inventory' | 'scanner';
type CategoryFilterKey = 'all' | string;
type ShoppingSortKey = 'newest' | 'category' | 'name';
type InventorySortKey = 'low_stock' | 'name' | 'category' | 'days_left';

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'shopping', label: 'Einkauf', icon: 'cart' },
  { key: 'inventory', label: 'Vorrat', icon: 'shippingbox' },
  { key: 'scanner', label: 'Scanner', icon: 'barcode.viewfinder' },
];

const CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: 'diapers', label: 'Windeln' },
  { id: 'formula', label: 'Milchpulver' },
  { id: 'care', label: 'Pflege' },
  { id: 'food', label: 'Lebensmittel' },
  { id: 'other', label: 'Sonstiges' },
];

const COLLAPSED_INVENTORY_CATEGORIES_KEY = 'shopping_inventory_collapsed_categories_v1';

const CATEGORY_FILTER_OPTIONS: { id: CategoryFilterKey; label: string }[] = [
  { id: 'all', label: 'Alle' },
  ...CATEGORY_OPTIONS,
];

const SHOPPING_SORT_OPTIONS: { id: ShoppingSortKey; label: string }[] = [
  { id: 'newest', label: 'Neueste' },
  { id: 'category', label: 'Kategorie' },
  { id: 'name', label: 'Name' },
];

const INVENTORY_SORT_OPTIONS: { id: InventorySortKey; label: string }[] = [
  { id: 'low_stock', label: 'Knapp zuerst' },
  { id: 'name', label: 'Name' },
  { id: 'category', label: 'Kategorie' },
  { id: 'days_left', label: 'Reichweite' },
];

const categoryLabel = (id: string) =>
  CATEGORY_OPTIONS.find((option) => option.id === id)?.label ?? 'Sonstiges';

const shoppingSourceLabel = (item: ShoppingListItem) => {
  if (item.source_type === 'recipe') return 'Aus Rezept';
  if (item.source_type === 'inventory') return 'Aus Vorrat';
  return 'Manuell';
};

const shoppingQuantityLabel = (item: ShoppingListItem) => {
  if (item.quantity_value == null || !item.quantity_unit) return null;
  return formatUnitQuantity(item.quantity_value, item.quantity_unit);
};

const getCreatedAtTime = (item: { created_at?: string | null }) =>
  item.created_at ? new Date(item.created_at).getTime() : 0;

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const matchesShoppingSearch = (item: ShoppingListItem, query: string) => {
  if (query.length === 0) return true;
  return [
    item.title,
    item.normalized_name,
    categoryLabel(item.category),
    item.notes ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
};

const matchesInventorySearch = (item: InventoryItem, query: string) => {
  if (query.length === 0) return true;
  return [
    item.name,
    categoryLabel(item.category),
    item.unit,
    item.barcode ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
};

const SCAN_DEBOUNCE_MS = 2500;
const SHOPPING_CARD_RADIUS = 16;
const INVENTORY_CARD_RADIUS = 16;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ZoomStep = { label: string; lens?: string; zoom: number };

// 0,5x nutzt die echte Ultraweitwinkel-Linse (nur iOS, wenn vorhanden);
// 2x/3x sind digitaler Zoom auf der Weitwinkel-Linse — expo-camera wechselt
// anders als die iOS-Kamera-App nicht automatisch auf das Teleobjektiv.
const buildZoomSteps = (lenses: string[]): ZoomStep[] => {
  const steps: ZoomStep[] = [];
  if (Platform.OS === 'ios' && lenses.includes('builtInUltraWideCamera')) {
    steps.push({ label: '0,5x', lens: 'builtInUltraWideCamera', zoom: 0 });
  }
  steps.push({ label: '1x', lens: 'builtInWideAngleCamera', zoom: 0 });
  steps.push({ label: '2x', lens: 'builtInWideAngleCamera', zoom: 0.15 });
  steps.push({ label: '3x', lens: 'builtInWideAngleCamera', zoom: 0.3 });
  return steps;
};
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

type ScanSheetState =
  | { mode: 'known'; product: Extract<ResolvedBarcodeProduct, { status: 'known' }>['product']; source: string }
  | { mode: 'unknown'; barcode: string }
  | null;

export default function ShoppingListScreen() {
  const { activeBabyId, isReady } = useActiveBaby();
  const { hasPermission, scheduleNotification } = useNotifications();

  const [section, setSection] = useState<SectionKey>('shopping');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [shoppingSort, setShoppingSort] = useState<ShoppingSortKey>('newest');
  const [inventorySort, setInventorySort] = useState<InventorySortKey>('low_stock');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [isInventorySearchVisible, setIsInventorySearchVisible] = useState(false);
  const [isShoppingSearchVisible, setIsShoppingSearchVisible] = useState(false);
  const [collapsedInventoryCategories, setCollapsedInventoryCategories] = useState<string[]>([]);
  const [isAddShoppingExpanded, setIsAddShoppingExpanded] = useState(false);
  const [expandedInventoryIds, setExpandedInventoryIds] = useState<Set<string>>(() => new Set());
  const [isPurchasedExpanded, setIsPurchasedExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [usageSummaries, setUsageSummaries] = useState<Record<string, InventoryUsageSummary>>({});

  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  const [editingInventory, setEditingInventory] = useState<Partial<InventoryItem> | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const insets = useSafeAreaInsets();
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [zoomSelection, setZoomSelection] = useState('1x');
  const [purchaseScanVisible, setPurchaseScanVisible] = useState(false);
  const [inventoryBarcodeScanVisible, setInventoryBarcodeScanVisible] = useState(false);

  const zoomSteps = useMemo(() => buildZoomSteps(availableLenses), [availableLenses]);
  const activeZoomStep =
    zoomSteps.find((step) => step.label === zoomSelection) ??
    zoomSteps.find((step) => step.label === '1x')!;

  const renderZoomRow = (topOffset?: number) => (
    <View style={[styles.zoomRow, topOffset !== undefined && { top: topOffset }]}>
      {zoomSteps.map((step) => (
        <TouchableOpacity
          key={step.label}
          style={[
            styles.zoomChip,
            activeZoomStep.label === step.label && styles.zoomChipActive,
          ]}
          onPress={() => setZoomSelection(step.label)}
          accessibilityRole="button"
          accessibilityLabel={`Zoom ${step.label}`}
        >
          <ThemedText
            style={[
              styles.zoomChipText,
              activeZoomStep.label === step.label && styles.zoomChipTextActive,
            ]}
          >
            {step.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
  const [scanSheet, setScanSheet] = useState<ScanSheetState>(null);
  const [isResolvingScan, setIsResolvingScan] = useState(false);
  const lastScanRef = useRef<{ barcode: string; at: number } | null>(null);

  const [unknownName, setUnknownName] = useState('');
  const [unknownCategory, setUnknownCategory] = useState('diapers');
  const [unknownPackage, setUnknownPackage] = useState('');
  const [unknownUnit, setUnknownUnit] = useState('Stück');

  const loadState = useCallback(async () => {
    if (!activeBabyId) return;
    const [{ data, error }, usageResult] = await Promise.all([
      fetchShoppingState(activeBabyId),
      fetchInventoryUsageSummaries(activeBabyId),
    ]);
    if (error) {
      console.error('Failed to load shopping state:', error);
    } else if (data) {
      setShoppingItems(data.shoppingItems);
      setInventoryItems(data.inventoryItems);
    }
    if (usageResult.error) {
      console.error('Failed to load inventory usage summaries:', usageResult.error);
    } else if (usageResult.data) {
      setUsageSummaries(usageResult.data);
    }
    setIsLoading(false);
  }, [activeBabyId]);

  useEffect(() => {
    if (!isReady) return undefined;
    const timeoutId = setTimeout(() => {
      loadState();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [isReady, loadState]);

  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => isLowStock(item)),
    [inventoryItems]
  );

  const normalizedSearchQuery = useMemo(() => normalizeSearchText(searchQuery), [searchQuery]);

  const searchedShoppingItems = useMemo(
    () => shoppingItems.filter((item) => matchesShoppingSearch(item, normalizedSearchQuery)),
    [normalizedSearchQuery, shoppingItems]
  );

  const searchedInventoryItems = useMemo(
    () =>
      inventoryItems
        .filter((item) => (showOnlyLowStock ? isLowStock(item) : true))
        .filter((item) => matchesInventorySearch(item, normalizedSearchQuery)),
    [normalizedSearchQuery, inventoryItems, showOnlyLowStock]
  );

  const categoryCounts = useMemo(() => {
    const items = section === 'inventory' ? searchedInventoryItems : searchedShoppingItems;
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [section, searchedInventoryItems, searchedShoppingItems]);

  const lowStockShoppingSuggestions = useMemo(
    () =>
      lowStockItems.filter(
        (inventoryItem) =>
          !shoppingItems.some(
            (shoppingItem) =>
              !shoppingItem.is_purchased && shoppingItem.inventory_item_id === inventoryItem.id
          )
      ),
    [lowStockItems, shoppingItems]
  );

  const filteredShoppingItems = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? searchedShoppingItems
        : searchedShoppingItems.filter((item) => item.category === selectedCategory);

    return [...filtered].sort((a, b) => {
      if (shoppingSort === 'category') {
        const byCategory = categoryLabel(a.category).localeCompare(categoryLabel(b.category), 'de');
        if (byCategory !== 0) return byCategory;
        return a.title.localeCompare(b.title, 'de');
      }
      if (shoppingSort === 'name') {
        return a.title.localeCompare(b.title, 'de');
      }
      return getCreatedAtTime(b) - getCreatedAtTime(a);
    });
  }, [selectedCategory, searchedShoppingItems, shoppingSort]);

  const filteredInventoryItems = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? searchedInventoryItems
        : searchedInventoryItems.filter((item) => item.category === selectedCategory);

    return [...filtered].sort((a, b) => {
      if (inventorySort === 'name') {
        return a.name.localeCompare(b.name, 'de');
      }
      if (inventorySort === 'category') {
        const byCategory = categoryLabel(a.category).localeCompare(categoryLabel(b.category), 'de');
        if (byCategory !== 0) return byCategory;
        return a.name.localeCompare(b.name, 'de');
      }
      if (inventorySort === 'days_left') {
        const aDays = computeDaysLeft(a) ?? Number.POSITIVE_INFINITY;
        const bDays = computeDaysLeft(b) ?? Number.POSITIVE_INFINITY;
        if (aDays !== bDays) return aDays - bDays;
        return a.name.localeCompare(b.name, 'de');
      }
      const byLowStock = Number(isLowStock(b)) - Number(isLowStock(a));
      if (byLowStock !== 0) return byLowStock;
      return a.name.localeCompare(b.name, 'de');
    });
  }, [selectedCategory, searchedInventoryItems, inventorySort]);

  // Low-Stock: On-Page-Hinweis sofort, lokale Notification höchstens alle 24h je Posten.
  useEffect(() => {
    if (!hasPermission) return;
    const now = Date.now();
    for (const item of lowStockItems) {
      if (!item.reminder_enabled) continue;
      const lastReminded = item.last_reminded_at ? new Date(item.last_reminded_at).getTime() : 0;
      if (now - lastReminded < REMINDER_COOLDOWN_MS) continue;
      scheduleNotification(
        'Vorrat wird knapp',
        `${item.name}: nur noch ${formatUnitQuantity(computeTotalQuantity(item), item.unit)} übrig.`,
        { type: 'inventory_low', referenceId: item.id },
        null,
        `inventory_low_${item.id}`
      );
      markInventoryReminded(item.id);
    }
  }, [lowStockItems, hasPermission, scheduleNotification]);

  const applyInventoryUpdate = useCallback((updated: InventoryItem) => {
    setInventoryItems((items) =>
      items.some((it) => it.id === updated.id)
        ? items.map((it) => (it.id === updated.id ? updated : it))
        : [...items, updated].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    );
  }, []);

  // --- Einkaufsliste -------------------------------------------------------

  const handleAddShoppingItem = useCallback(async () => {
    if (!activeBabyId || newItemTitle.trim().length === 0) return;
    setIsAddingItem(true);
    const { data, error } = await upsertShoppingItem(activeBabyId, {
      title: newItemTitle,
      category: selectedCategory === 'all' ? 'other' : selectedCategory,
    });
    setIsAddingItem(false);
    if (error || !data) {
      Alert.alert('Fehler', 'Der Eintrag konnte nicht gespeichert werden.');
      return;
    }
    setNewItemTitle('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAddShoppingExpanded(false);
    setShoppingItems((items) => [data, ...items]);
  }, [activeBabyId, newItemTitle, selectedCategory]);

  const handleTogglePurchased = useCallback(
    async (item: ShoppingListItem) => {
      const nowPurchased = !item.is_purchased;
      setShoppingItems((items) =>
        items.map((it) => (it.id === item.id ? { ...it, is_purchased: nowPurchased } : it))
      );
      const { error } = await toggleShoppingItemPurchased(item.id, nowPurchased);
      if (error) {
        setShoppingItems((items) =>
          items.map((it) => (it.id === item.id ? { ...it, is_purchased: item.is_purchased } : it))
        );
        return;
      }

      // Stammt der Posten aus dem Vorrat, wird der Bestand beim Abhaken erhöht —
      // bei Packungsartikeln als ganze (versiegelte) Packung, sonst als Menge.
      // Beim Zurücknehmen wird wieder korrigiert.
      const linkedInventory = item.inventory_item_id
        ? inventoryItems.find((inv) => inv.id === item.inventory_item_id)
        : undefined;
      if (linkedInventory) {
        const note = nowPurchased
          ? `Einkauf: ${item.title}`
          : `Kauf zurückgenommen: ${item.title}`;
        const hasPackage = (linkedInventory.package_quantity ?? 0) > 0;
        const { data } = hasPackage
          ? await adjustSealedPackages(
              linkedInventory,
              (item.quantity_unit === 'Packung' ? item.quantity_value ?? 1 : 1) *
                (nowPurchased ? 1 : -1),
              nowPurchased ? 'refill' : 'correction',
              note
            )
          : await adjustInventoryQuantity(
              linkedInventory,
              (item.quantity_value ?? 1) * (nowPurchased ? 1 : -1),
              nowPurchased ? 'refill' : 'correction',
              note
            );
        if (data) {
          applyInventoryUpdate(data);
        }
      }
    },
    [inventoryItems, applyInventoryUpdate]
  );

  const handleDeleteShoppingItem = useCallback(async (item: ShoppingListItem) => {
    setShoppingItems((items) => items.filter((it) => it.id !== item.id));
    const { error } = await deleteShoppingItem(item.id);
    if (error) {
      setShoppingItems((items) => [item, ...items]);
    }
  }, []);

  // Barcode-Scan im Einkauf: gescanntes Produkt auf der Liste finden und
  // als gekauft abhaken (inkl. Vorrats-Auffüllung über handleTogglePurchased).
  const handlePurchaseScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (!activeBabyId || isResolvingScan) return;
      const barcode = result.data;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.barcode === barcode && now - last.at < SCAN_DEBOUNCE_MS) return;
      lastScanRef.current = { barcode, at: now };

      setIsResolvingScan(true);
      let matchedInventoryId: string | null = null;
      const matchNames: string[] = [];
      const { data: inventoryMatch } = await findInventoryItemByBarcode(activeBabyId, barcode);
      if (inventoryMatch) {
        matchedInventoryId = inventoryMatch.id;
        matchNames.push(normalizeItemName(inventoryMatch.name));
      } else {
        const { data: resolved } = await resolveBarcodeProduct(barcode);
        if (resolved?.status === 'known') {
          matchNames.push(normalizeItemName(resolved.product.name));
        }
      }
      setIsResolvingScan(false);

      const target = shoppingItems.find(
        (item) =>
          !item.is_purchased &&
          ((matchedInventoryId !== null && item.inventory_item_id === matchedInventoryId) ||
            matchNames.includes(item.normalized_name))
      );
      if (!target) {
        Alert.alert(
          'Kein Treffer',
          'Zu diesem Barcode steht kein offener Posten auf der Einkaufsliste.'
        );
        return;
      }
      await handleTogglePurchased(target);
      Alert.alert('Abgehakt', `„${target.title}" ist als gekauft markiert.`);
    },
    [activeBabyId, isResolvingScan, shoppingItems, handleTogglePurchased]
  );

  const handleInventoryBarcodeScan = useCallback((result: BarcodeScanningResult) => {
    const barcode = result.data;
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.barcode === barcode && now - last.at < SCAN_DEBOUNCE_MS) return;
    lastScanRef.current = { barcode, at: now };

    setEditingInventory((current) => (current ? { ...current, barcode } : current));
    setInventoryBarcodeScanVisible(false);
    Alert.alert('Barcode übernommen', 'Der Barcode wurde ins Vorratsformular übernommen.');
  }, []);

  // --- Vorrat ---------------------------------------------------------------

  const handleAdjustQuantity = useCallback(
    async (item: InventoryItem, delta: number, type: 'usage' | 'refill') => {
      const { data, error } = await adjustInventoryQuantity(item, delta, type);
      if (error || !data) {
        Alert.alert('Fehler', 'Die Bestandsänderung konnte nicht gespeichert werden.');
        return;
      }
      applyInventoryUpdate(data);
      setUsageSummaries((summaries) => ({
        ...summaries,
        [item.id]: {
          inventory_item_id: item.id,
          usedLast7Days:
            (summaries[item.id]?.usedLast7Days ?? 0) + (delta < 0 ? Math.abs(delta) : 0),
          lastTransactionAt: new Date().toISOString(),
          lastQuantityChange: delta,
        },
      }));
    },
    [applyInventoryUpdate]
  );

  // "+ Packung": bucht eine ganze versiegelte Packung zu (statt loser Menge).
  const handleAddPackage = useCallback(
    async (item: InventoryItem) => {
      const { data, error } = await adjustSealedPackages(item, 1, 'refill', 'Packung hinzugefügt');
      if (error || !data) {
        Alert.alert('Fehler', 'Die Packung konnte nicht verbucht werden.');
        return;
      }
      applyInventoryUpdate(data);
    },
    [applyInventoryUpdate]
  );

  const handleInventoryToShoppingList = useCallback(
    async (item: InventoryItem) => {
      if (!activeBabyId) return;
      // Packungsartikel landen als "1 Packung" auf der Liste, lose Artikel als Menge.
      const hasPackage = (item.package_quantity ?? 0) > 0;
      const { data, error } = await upsertShoppingItem(activeBabyId, {
        title: item.name,
        category: item.category,
        quantity_value: hasPackage ? 1 : item.package_quantity,
        quantity_unit: hasPackage ? 'Packung' : item.unit,
        source_type: 'inventory',
        inventory_item_id: item.id,
      });
      if (error || !data) {
        Alert.alert('Fehler', 'Der Eintrag konnte nicht zur Einkaufsliste hinzugefügt werden.');
        return;
      }
      setShoppingItems((items) => [data, ...items.filter((it) => it.id !== data.id)]);
      Alert.alert('Hinzugefügt', `${item.name} steht jetzt auf der Einkaufsliste.`);
    },
    [activeBabyId]
  );

  const handleSaveInventoryForm = useCallback(async () => {
    if (!activeBabyId || !editingInventory) return;
    const name = editingInventory.name?.trim() ?? '';
    if (name.length === 0) {
      Alert.alert('Fehler', 'Bitte gib einen Namen an.');
      return;
    }
    const { data, error } = await upsertInventoryItem(activeBabyId, {
      id: editingInventory.id,
      name,
      category: editingInventory.category ?? 'other',
      barcode: editingInventory.barcode ?? null,
      current_quantity: editingInventory.current_quantity ?? 0,
      packages_sealed: editingInventory.packages_sealed ?? 0,
      unit: editingInventory.unit ?? 'Stück',
      package_quantity: editingInventory.package_quantity ?? null,
      reorder_threshold: editingInventory.reorder_threshold ?? 0,
      daily_usage_estimate: editingInventory.daily_usage_estimate ?? null,
      dosage_grams_per_100ml: editingInventory.dosage_grams_per_100ml ?? null,
    });
    if (error || !data) {
      Alert.alert('Fehler', 'Der Vorrat konnte nicht gespeichert werden.');
      return;
    }
    applyInventoryUpdate(data);
    setEditingInventory(null);
  }, [activeBabyId, editingInventory, applyInventoryUpdate]);

  const handleDeleteInventory = useCallback((item: InventoryItem) => {
    Alert.alert('Vorrat löschen', `„${item.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteInventoryItem(item.id);
          if (!error) {
            setInventoryItems((items) => items.filter((it) => it.id !== item.id));
          }
        },
      },
    ]);
  }, []);

  // --- Scanner ----------------------------------------------------------------

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      const barcode = result.data;
      const now = Date.now();
      const last = lastScanRef.current;
      if (isResolvingScan || scanSheet) return;
      if (last && last.barcode === barcode && now - last.at < SCAN_DEBOUNCE_MS) return;
      lastScanRef.current = { barcode, at: now };

      setIsResolvingScan(true);
      const { data, error } = await resolveBarcodeProduct(barcode);
      setIsResolvingScan(false);

      if (error || !data) {
        Alert.alert('Fehler', 'Der Barcode konnte nicht geprüft werden.');
        return;
      }
      if (data.status === 'known') {
        setScanSheet({ mode: 'known', product: data.product, source: data.source });
      } else {
        setUnknownName('');
        setUnknownCategory('diapers');
        setUnknownPackage('');
        setUnknownUnit('Stück');
        setScanSheet({ mode: 'unknown', barcode: data.barcode });
      }
    },
    [isResolvingScan, scanSheet]
  );

  const handleRefillFromScan = useCallback(async () => {
    if (!activeBabyId || !scanSheet || scanSheet.mode !== 'known') return;
    const { product } = scanSheet;
    const packageQuantity = product.packageQuantity ?? 1;
    const { data, error } = await refillInventoryFromProduct(activeBabyId, {
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      packageQuantity,
      unit: product.unit ?? 'Stück',
    });
    if (error || !data) {
      Alert.alert('Fehler', 'Der Vorrat konnte nicht aufgefüllt werden.');
      return;
    }
    // Von Open Food Facts bestätigte Produkte lokal merken, damit der nächste Scan sofort trifft.
    if (scanSheet.source === 'open_food_facts') {
      saveProductToCatalog({
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        category: product.category,
        packageQuantity: product.packageQuantity,
        unit: product.unit,
        provider: 'open_food_facts',
      });
    }
    applyInventoryUpdate(data);
    setScanSheet(null);
    Alert.alert(
      'Aufgefüllt',
      `${product.name}: +1 Packung (${formatUnitQuantity(packageQuantity, product.unit ?? 'Stück')}).`
    );
  }, [activeBabyId, scanSheet, applyInventoryUpdate]);

  const handleConfirmUnknownProduct = useCallback(async () => {
    if (!activeBabyId || !scanSheet || scanSheet.mode !== 'unknown') return;
    const name = unknownName.trim();
    const packageQuantity = parseFloat(unknownPackage.replace(',', '.'));
    if (name.length === 0 || !Number.isFinite(packageQuantity) || packageQuantity <= 0) {
      Alert.alert('Fehler', 'Bitte gib Name und eine gültige Packungsgröße an.');
      return;
    }
    const product = {
      barcode: scanSheet.barcode,
      name,
      category: unknownCategory,
      packageQuantity,
      unit: unknownUnit.trim() || 'Stück',
    };
    const { error: catalogError } = await saveProductToCatalog({
      ...product,
      packageQuantity,
      unit: product.unit,
      provider: 'manual',
    });
    if (catalogError) {
      console.error('Failed to save product to catalog:', catalogError);
    }
    const { data, error } = await refillInventoryFromProduct(activeBabyId, product);
    if (error || !data) {
      Alert.alert('Fehler', 'Der Vorrat konnte nicht angelegt werden.');
      return;
    }
    applyInventoryUpdate(data);
    setScanSheet(null);
    Alert.alert('Gespeichert', `${name} ist jetzt als Vorrat angelegt. Der Barcode wird beim nächsten Scan erkannt.`);
  }, [activeBabyId, scanSheet, unknownName, unknownCategory, unknownPackage, unknownUnit, applyInventoryUpdate]);

  // --- Rendering ----------------------------------------------------------------

  const toggleInventoryExpanded = useCallback((itemId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedInventoryIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const togglePurchasedExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPurchasedExpanded((current) => !current);
  }, []);

  const toggleFiltersExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsFiltersExpanded((current) => !current);
  }, []);

  const toggleInventorySearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsInventorySearchVisible((current) => {
      if (current) {
        setSearchQuery('');
        setIsFiltersExpanded(false);
      }
      return !current;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(COLLAPSED_INVENTORY_CATEGORIES_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCollapsedInventoryCategories(parsed.filter((entry) => typeof entry === 'string'));
        }
      })
      .catch((error) => {
        console.error('Failed to load collapsed inventory categories:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleInventoryCategoryCollapsed = useCallback((category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedInventoryCategories((current) => {
      const next = current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category];
      AsyncStorage.setItem(COLLAPSED_INVENTORY_CATEGORIES_KEY, JSON.stringify(next)).catch((error) => {
        console.error('Failed to persist collapsed inventory categories:', error);
      });
      return next;
    });
  }, []);

  const toggleShoppingSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsShoppingSearchVisible((current) => {
      if (current) {
        setSearchQuery('');
        setIsFiltersExpanded(false);
      }
      return !current;
    });
  }, []);

  const openAddShopping = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAddShoppingExpanded(true);
  }, []);

  const closeAddShopping = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAddShoppingExpanded(false);
  }, []);

  const openItems = filteredShoppingItems.filter((item) => !item.is_purchased);
  const purchasedItems = filteredShoppingItems.filter((item) => item.is_purchased);

  const renderCategoryFilter = () => (
    <View style={styles.filterBlock}>
      <ThemedText style={styles.filterLabel}>Kategorie</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORY_FILTER_OPTIONS.map((option) => {
          const isActive = selectedCategory === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedCategory(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Kategorie ${option.label}`}
            >
              <ThemedText
                style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
              >
                {option.label} {categoryCounts[option.id] ?? 0}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderSortControls = () => {
    const options = section === 'inventory' ? INVENTORY_SORT_OPTIONS : SHOPPING_SORT_OPTIONS;
    const activeSort = section === 'inventory' ? inventorySort : shoppingSort;
    return (
      <View style={styles.filterBlock}>
        <ThemedText style={styles.filterLabel}>Sortierung</ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {options.map((option) => {
            const isActive = activeSort === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  if (section === 'inventory') {
                    setInventorySort(option.id as InventorySortKey);
                  } else {
                    setShoppingSort(option.id as ShoppingSortKey);
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Sortierung ${option.label}`}
              >
                <ThemedText
                  style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderListControls = () => {
    const activeSortOptions = section === 'inventory' ? INVENTORY_SORT_OPTIONS : SHOPPING_SORT_OPTIONS;
    const activeSort = section === 'inventory' ? inventorySort : shoppingSort;
    const activeSortLabel = activeSortOptions.find((option) => option.id === activeSort)?.label;
    const filterSummary =
      selectedCategory === 'all'
        ? activeSortLabel ?? 'Standard'
        : `${categoryLabel(selectedCategory)} · ${activeSortLabel ?? 'Standard'}`;

    return (
      <LiquidGlassCard
        style={styles.card}
        intensity={16}
        overlayColor="rgba(255,255,255,0.32)"
        borderColor="rgba(125,90,80,0.08)"
      >
        <View style={styles.cardInner}>
          <View style={styles.searchRow}>
            <IconSymbol name="magnifyingglass" size={18} color={PRIMARY} />
            <TextInput
              style={styles.searchInput}
              placeholder={section === 'inventory' ? 'Vorräte suchen …' : 'Einkaufsliste suchen …'}
              placeholderTextColor="rgba(125,90,80,0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
                accessibilityLabel="Suche löschen"
              >
                <IconSymbol name="xmark.circle.fill" size={18} color="rgba(125,90,80,0.55)" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.filterSummaryRow}
            onPress={toggleFiltersExpanded}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ expanded: isFiltersExpanded }}
            accessibilityLabel={isFiltersExpanded ? 'Filter einklappen' : 'Filter aufklappen'}
          >
            <View style={styles.filterSummaryTextBlock}>
              <ThemedText style={styles.filterSummaryTitle}>Filter</ThemedText>
              <ThemedText style={styles.filterSummaryValue} numberOfLines={1}>
                {filterSummary}
                {section === 'inventory' && showOnlyLowStock ? ' · nur knapp' : ''}
              </ThemedText>
            </View>
            <IconSymbol
              name={isFiltersExpanded ? 'chevron.up' : 'chevron.down'}
              size={20}
              color="rgba(125,90,80,0.65)"
            />
          </TouchableOpacity>

          {isFiltersExpanded ? (
            <>
              {renderCategoryFilter()}

              {section === 'inventory' ? (
                <View style={styles.switchRow}>
                  <View style={styles.switchTextBlock}>
                    <ThemedText style={styles.switchTitle}>Nur knappe Vorräte</ThemedText>
                    <ThemedText style={styles.switchSubtitle}>
                      {lowStockItems.length} unter oder auf Schwelle
                    </ThemedText>
                  </View>
                  <Switch
                    value={showOnlyLowStock}
                    onValueChange={setShowOnlyLowStock}
                    trackColor={{ false: 'rgba(125,90,80,0.2)', true: 'rgba(142,78,198,0.35)' }}
                    thumbColor={showOnlyLowStock ? PRIMARY : '#FFFFFF'}
                  />
                </View>
              ) : null}

              {renderSortControls()}
            </>
          ) : null}
        </View>
      </LiquidGlassCard>
    );
  };

  const renderShoppingRow = (item: ShoppingListItem) => {
    const quantityLabel = shoppingQuantityLabel(item);
    return (
      <View key={item.id} style={[styles.shoppingRow, item.is_purchased && styles.shoppingRowPurchased]}>
        <TouchableOpacity
          style={styles.shoppingRowMain}
          onPress={() => handleTogglePurchased(item)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.is_purchased }}
        >
          <View style={styles.shoppingCheckSlot}>
            <IconSymbol
              name={item.is_purchased ? 'checkmark.circle.fill' : 'circle'}
              size={25}
              color={item.is_purchased ? '#5FA97A' : PRIMARY}
            />
          </View>
          <View style={styles.shoppingRowText}>
            <ThemedText
              style={[styles.shoppingTitle, item.is_purchased && styles.shoppingTitlePurchased]}
              numberOfLines={2}
            >
              {item.title}
            </ThemedText>
            <View style={styles.shoppingMetaRow}>
              <View style={styles.shoppingSourcePill}>
                <ThemedText style={styles.shoppingSourceText}>{shoppingSourceLabel(item)}</ThemedText>
              </View>
              {item.notes ? (
                <ThemedText style={styles.shoppingNoteText} numberOfLines={1}>
                  {item.notes}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
        {quantityLabel ? (
          <View style={styles.shoppingQuantityPill}>
            <ThemedText style={styles.shoppingQuantityText}>{quantityLabel}</ThemedText>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.rowIconButton}
          onPress={() => handleDeleteShoppingItem(item)}
          accessibilityLabel={`${item.title} löschen`}
        >
          <IconSymbol name="trash" size={18} color="#B0625B" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderShoppingGroups = (items: ShoppingListItem[], variant: 'open' | 'purchased' = 'open') => {
    const groups = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const category = item.category || 'other';
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }

    return Array.from(groups.entries())
      .sort(([categoryA], [categoryB]) => categoryLabel(categoryA).localeCompare(categoryLabel(categoryB), 'de'))
      .map(([category, categoryItems]) => (
        <LiquidGlassCard
          key={category}
          style={[styles.shoppingGroupCard, variant === 'purchased' && styles.shoppingGroupCardPurchased]}
          radius={SHOPPING_CARD_RADIUS}
          intensity={18}
          overlayColor={variant === 'purchased' ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.42)'}
          borderColor="rgba(125,90,80,0.10)"
        >
          <View style={styles.shoppingGroup}>
            <View style={styles.shoppingGroupHeader}>
              <ThemedText style={styles.shoppingGroupTitle}>{categoryLabel(category)}</ThemedText>
              <ThemedText style={styles.shoppingGroupCount}>
                {categoryItems.length === 1 ? '1 Posten' : `${categoryItems.length} Posten`}
              </ThemedText>
            </View>
            <View style={styles.shoppingGroupList}>
              {categoryItems.map(renderShoppingRow)}
            </View>
          </View>
        </LiquidGlassCard>
      ));
  };

  const renderInventoryCard = (item: InventoryItem) => {
    const daysLeft = computeDaysLeft(item);
    const low = isLowStock(item);
    const usageSummary = usageSummaries[item.id];
    const totalQuantity = computeTotalQuantity(item);
    const packageQuantity = item.package_quantity ?? 0;
    const hasPackages = packageQuantity > 0;
    const sealedPackages = item.packages_sealed ?? 0;
    const openRatio = hasPackages
      ? Math.max(0, Math.min(1, item.current_quantity / packageQuantity))
      : 0;
    const isExpanded = expandedInventoryIds.has(item.id);
    return (
      <LiquidGlassCard
        key={item.id}
        style={[
          styles.inventoryCard,
          low && styles.inventoryCardLow,
          isExpanded && styles.inventoryCardExpanded,
        ]}
        radius={INVENTORY_CARD_RADIUS}
        intensity={18}
        overlayColor="rgba(255,255,255,0.66)"
        borderColor={low ? 'rgba(196,69,58,0.42)' : 'rgba(125,90,80,0.14)'}
      >
        <TouchableOpacity
          style={styles.inventoryCompactRow}
          onPress={() => toggleInventoryExpanded(item.id)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={`${item.name} ${isExpanded ? 'einklappen' : 'aufklappen'}`}
        >
          <View style={[styles.inventoryStatusDot, low && styles.inventoryStatusDotLow]} />
          <View style={styles.inventoryCompactText}>
            <View style={styles.inventoryNameRow}>
              <ThemedText style={styles.inventoryName} numberOfLines={1}>
                {item.name}
              </ThemedText>
              {low ? (
                <View style={styles.lowStockBadge}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color="#FFFFFF" />
                  <ThemedText style={styles.lowStockBadgeText}>Knapp</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={styles.inventoryCategory} numberOfLines={1}>
              {categoryLabel(item.category)}
              {item.reorder_threshold > 0
                ? ` · ab ${formatUnitQuantity(item.reorder_threshold, item.unit)} nachkaufen`
                : ''}
            </ThemedText>
          </View>
          <View style={styles.inventoryCompactMetric}>
            <ThemedText
              style={[styles.inventoryCompactQuantity, low && styles.inventoryCompactQuantityLow]}
              numberOfLines={1}
            >
              {formatUnitQuantity(totalQuantity, item.unit)}
            </ThemedText>
            <ThemedText style={styles.inventoryCompactMeta} numberOfLines={1}>
              {daysLeft !== null ? `~${daysLeft} Tage` : 'Bestand'}
            </ThemedText>
          </View>
          <IconSymbol
            name={isExpanded ? 'chevron.up' : 'chevron.down'}
            size={20}
            color="rgba(125,90,80,0.65)"
          />
        </TouchableOpacity>

        {isExpanded ? (
          <View style={styles.inventoryDetails}>
            <View style={styles.inventoryHero}>
              <View style={styles.inventoryHeroTile}>
                <ThemedText style={[styles.inventoryHeroValue, low && styles.inventoryHeroValueLow]}>
                  {formatUnitQuantity(totalQuantity, item.unit)}
                </ThemedText>
                <ThemedText style={styles.inventoryHeroLabel}>gesamt</ThemedText>
              </View>
              {hasPackages ? (
                <View style={styles.inventoryHeroTile}>
                  <ThemedText style={styles.inventoryHeroValue}>{sealedPackages}</ThemedText>
                  <ThemedText style={styles.inventoryHeroLabel}>
                    {sealedPackages === 1 ? 'volle Packung' : 'volle Packungen'}
                  </ThemedText>
                </View>
              ) : null}
              {daysLeft !== null ? (
                <View style={styles.inventoryHeroTile}>
                  <ThemedText style={styles.inventoryHeroValue}>~{daysLeft}</ThemedText>
                  <ThemedText style={styles.inventoryHeroLabel}>Tage Reichweite</ThemedText>
                </View>
              ) : null}
            </View>

            {hasPackages ? (
              <View style={styles.packageProgressBlock}>
                <View style={styles.packageProgressTrack}>
                  <View
                    style={[
                      styles.packageProgressFill,
                      { width: `${Math.round(openRatio * 100)}%` },
                      low && styles.packageProgressFillLow,
                    ]}
                  />
                </View>
                <ThemedText style={styles.packageProgressLabel}>
                  Angebrochen: {formatUnitQuantity(item.current_quantity, item.unit)} von{' '}
                  {formatUnitQuantity(packageQuantity, item.unit)}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.usageSummaryRow}>
              <IconSymbol name="chart.line.uptrend.xyaxis" size={15} color={PRIMARY} />
              <ThemedText style={styles.usageSummaryText}>
                7 Tage: {formatUnitQuantity(usageSummary?.usedLast7Days ?? 0, item.unit)} verbraucht
                {usageSummary?.lastTransactionAt
                  ? ` · letzte Buchung ${formatShortDate(usageSummary.lastTransactionAt)}`
                  : ''}
              </ThemedText>
            </View>

            <View style={styles.inventoryDetailControls}>
              <ThemedText style={styles.inventoryControlLabel}>Bestand anpassen</ThemedText>
              <View style={styles.quantityStepper}>
                <TouchableOpacity
                  style={[styles.stepperButton, totalQuantity <= 0 && styles.stepperButtonDisabled]}
                  onPress={() => handleAdjustQuantity(item, -1, 'usage')}
                  disabled={totalQuantity <= 0}
                  accessibilityLabel={`${item.name} Bestand um eins reduzieren`}
                >
                  <IconSymbol
                    name="minus"
                    size={18}
                    color={totalQuantity <= 0 ? 'rgba(125,90,80,0.35)' : PRIMARY}
                  />
                </TouchableOpacity>
                <View style={styles.stepperValue}>
                  <ThemedText style={styles.stepperValueText}>
                    {formatUnitQuantity(totalQuantity, item.unit)}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => handleAdjustQuantity(item, 1, 'refill')}
                  accessibilityLabel={`${item.name} Bestand um eins erhöhen`}
                >
                  <IconSymbol name="plus" size={18} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inventoryActions}>
              {hasPackages ? (
                <TouchableOpacity
                  style={styles.inventoryActionButton}
                  onPress={() => handleAddPackage(item)}
                >
                  <IconSymbol name="plus" size={15} color={PRIMARY} />
                  <ThemedText style={styles.inventoryActionText}>Packung</ThemedText>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.inventoryActionButton}
                onPress={() =>
                  handleAdjustQuantity(item, -(item.daily_usage_estimate || 1), 'usage')
                }
              >
                <IconSymbol name="minus" size={15} color={PRIMARY} />
                <ThemedText style={styles.inventoryActionText}>Verbrauch</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inventoryActionButton}
                onPress={() => setEditingInventory(item)}
                accessibilityLabel={`${item.name} bearbeiten`}
              >
                <IconSymbol name="pencil" size={15} color={PRIMARY} />
                <ThemedText style={styles.inventoryActionText}>Bearbeiten</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inventoryActionButton, styles.inventoryActionPrimary]}
                onPress={() => handleInventoryToShoppingList(item)}
              >
                <IconSymbol name="cart" size={15} color="#FFFFFF" />
                <ThemedText style={[styles.inventoryActionText, styles.inventoryActionPrimaryText]}>
                  Einkaufsliste
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </LiquidGlassCard>
    );
  };

  const renderInventoryGroups = (items: InventoryItem[]) => {
    const groups = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const category = item.category || 'other';
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }

    return Array.from(groups.entries())
      .sort(([categoryA], [categoryB]) => categoryLabel(categoryA).localeCompare(categoryLabel(categoryB), 'de'))
      .map(([category, categoryItems]) => {
        const lowCount = categoryItems.filter((inventoryItem) => isLowStock(inventoryItem)).length;
        // Bei aktiver Suche bleiben alle Gruppen offen, damit Treffer sichtbar sind.
        const isCollapsed =
          normalizedSearchQuery.length === 0 && collapsedInventoryCategories.includes(category);
        return (
          <View key={category} style={styles.inventoryGroup}>
            <TouchableOpacity
              style={styles.inventoryGroupHeader}
              onPress={() => toggleInventoryCategoryCollapsed(category)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityState={{ expanded: !isCollapsed }}
              accessibilityLabel={
                isCollapsed
                  ? `${categoryLabel(category)} aufklappen`
                  : `${categoryLabel(category)} einklappen`
              }
            >
              <View style={styles.inventoryGroupTitleRow}>
                <IconSymbol name="shippingbox" size={16} color={PRIMARY} />
                <ThemedText style={styles.inventoryGroupTitle}>{categoryLabel(category)}</ThemedText>
              </View>
              <View style={styles.inventoryGroupHeaderRight}>
                <ThemedText style={styles.inventoryGroupCount}>
                  {categoryItems.length}
                  {lowCount > 0 ? ` · ${lowCount} knapp` : ''}
                </ThemedText>
                <IconSymbol
                  name={isCollapsed ? 'chevron.down' : 'chevron.up'}
                  size={15}
                  color="rgba(125,90,80,0.65)"
                />
              </View>
            </TouchableOpacity>
            {!isCollapsed ? (
              <View style={styles.inventoryGroupList}>
                {categoryItems.map(renderInventoryCard)}
              </View>
            ) : null}
          </View>
        );
      });
  };

  const renderScanner = () => {
    if (!cameraPermission?.granted) {
      return (
        <LiquidGlassCard style={styles.card}>
          <View style={styles.cardInner}>
            <ThemedText style={styles.sectionTitle}>Kamera-Zugriff</ThemedText>
            <ThemedText style={styles.helperText}>
              Zum Scannen von Barcodes benötigt Lotti Baby Zugriff auf deine Kamera.
            </ThemedText>
            <TouchableOpacity style={styles.primaryButton} onPress={requestCameraPermission}>
              <ThemedText style={styles.primaryButtonText}>Kamera erlauben</ThemedText>
            </TouchableOpacity>
          </View>
        </LiquidGlassCard>
      );
    }
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          autofocus="on"
          enableTorch={torchEnabled}
          zoom={activeZoomStep.zoom}
          selectedLens={Platform.OS === 'ios' ? activeZoomStep.lens : undefined}
          onAvailableLensesChanged={({ lenses }) => setAvailableLenses(lenses)}
          barcodeScannerSettings={{
            // itf14/code128 zusätzlich: auf Windel- und Multipack-Kartons ist
            // häufig kein EAN-13, sondern ein ITF-14 aufgedruckt.
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.scannerOverlay} pointerEvents="box-none">
          {renderZoomRow()}
          <View style={styles.scannerFrame} pointerEvents="none" />
          <ThemedText style={styles.scannerHint}>
            {isResolvingScan ? 'Produkt wird gesucht …' : 'Barcode in den Rahmen halten'}
          </ThemedText>
          <TouchableOpacity
            style={[styles.torchButton, torchEnabled && styles.torchButtonActive]}
            onPress={() => setTorchEnabled((enabled) => !enabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: torchEnabled }}
            accessibilityLabel="Taschenlampe"
          >
            <IconSymbol
              name={torchEnabled ? 'flashlight.on.fill' : 'flashlight.off.fill'}
              size={22}
              color={torchEnabled ? '#3A2E20' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title="Einkauf & Vorräte" subtitle="Liste, Bestand, Scanner" showBackButton />

        <View style={styles.segmentRow}>
          {SECTIONS.map((entry) => (
            <TouchableOpacity
              key={entry.key}
              style={[styles.segment, section === entry.key && styles.segmentActive]}
              onPress={() => setSection(entry.key)}
            >
              <IconSymbol
                name={entry.icon as any}
                size={16}
                color={section === entry.key ? '#FFFFFF' : PRIMARY}
              />
              <ThemedText
                style={[styles.segmentText, section === entry.key && styles.segmentTextActive]}
              >
                {entry.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : section === 'scanner' ? (
          renderScanner()
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            contentInsetAdjustmentBehavior="automatic"
          >
            {lowStockItems.length > 0 ? (
              <LiquidGlassCard style={styles.card}>
                <View style={styles.cardInner}>
                  <View style={styles.lowStockHintRow}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#D08945" />
                    <ThemedText style={styles.lowStockHintText}>
                      {lowStockItems.length === 1
                        ? `${lowStockItems[0].name} wird knapp.`
                        : `${lowStockItems.length} Vorräte werden knapp.`}
                    </ThemedText>
                  </View>
                  {lowStockShoppingSuggestions.length > 0 ? (
                    <View style={styles.suggestionList}>
                      {lowStockShoppingSuggestions.slice(0, 3).map((item) => (
                        <View key={item.id} style={styles.suggestionRow}>
                          <View style={styles.suggestionTextBlock}>
                            <ThemedText style={styles.suggestionTitle}>{item.name}</ThemedText>
                            <ThemedText style={styles.suggestionMeta}>
                              {formatUnitQuantity(computeTotalQuantity(item), item.unit)} übrig
                            </ThemedText>
                          </View>
                          <TouchableOpacity
                            style={styles.suggestionButton}
                            onPress={() => handleInventoryToShoppingList(item)}
                          >
                            <IconSymbol name="plus" size={15} color="#FFFFFF" />
                            <ThemedText style={styles.suggestionButtonText}>Liste</ThemedText>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </LiquidGlassCard>
            ) : null}

            {section === 'shopping' ? (
              <>
                {!isAddShoppingExpanded ? (
                  <View style={styles.inventoryActionsRow}>
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.addInventoryButtonCompact]}
                      onPress={openAddShopping}
                      accessibilityRole="button"
                      accessibilityLabel="Neuen Einkaufsposten öffnen"
                    >
                      <IconSymbol name="plus" size={15} color="#FFFFFF" />
                      <ThemedText style={[styles.primaryButtonText, styles.addInventoryButtonCompactText]}>
                        Posten anlegen
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.inventorySearchToggle,
                        isShoppingSearchVisible && styles.inventorySearchToggleActive,
                      ]}
                      onPress={toggleShoppingSearch}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isShoppingSearchVisible }}
                      accessibilityLabel={
                        isShoppingSearchVisible
                          ? 'Suche und Filter ausblenden'
                          : 'Suche und Filter einblenden'
                      }
                    >
                      <IconSymbol
                        name="magnifyingglass"
                        size={18}
                        color={isShoppingSearchVisible ? '#FFFFFF' : PRIMARY}
                      />
                    </TouchableOpacity>
                  </View>
                ) : null}
                {isShoppingSearchVisible ? renderListControls() : null}

                {isAddShoppingExpanded ? (
                  <LiquidGlassCard
                    style={styles.card}
                    intensity={16}
                    overlayColor="rgba(255,255,255,0.32)"
                    borderColor="rgba(125,90,80,0.08)"
                  >
                    <View style={styles.cardInner}>
                      <View style={styles.addHeaderRow}>
                        <ThemedText style={styles.sectionTitle}>Einkaufsposten</ThemedText>
                        <TouchableOpacity
                          style={styles.closeInlineButton}
                          onPress={closeAddShopping}
                          accessibilityLabel="Eingabe schließen"
                        >
                          <IconSymbol name="xmark" size={18} color="rgba(125,90,80,0.65)" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.addRow}>
                        <TextInput
                          style={styles.addInput}
                          placeholder="Neuer Einkaufsposten …"
                          placeholderTextColor="rgba(125,90,80,0.5)"
                          value={newItemTitle}
                          onChangeText={setNewItemTitle}
                          onSubmitEditing={handleAddShoppingItem}
                          returnKeyType="done"
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={handleAddShoppingItem}
                          disabled={isAddingItem}
                          accessibilityLabel="Einkaufsposten hinzufügen"
                        >
                          <IconSymbol name="plus" size={20} color={PRIMARY} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={async () => {
                            if (!cameraPermission?.granted) {
                              const response = await requestCameraPermission();
                              if (!response.granted) return;
                            }
                            setPurchaseScanVisible(true);
                          }}
                          accessibilityLabel="Einkauf per Barcode abhaken"
                        >
                          <IconSymbol name="barcode.viewfinder" size={20} color={PRIMARY} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </LiquidGlassCard>
                ) : null}

                <View style={styles.shoppingSectionHeader}>
                  <View style={styles.shoppingSectionTextBlock}>
                    <ThemedText style={styles.sectionTitle}>Zu kaufen</ThemedText>
                    <ThemedText style={styles.shoppingSectionSubtitle}>
                      {openItems.length === 1
                        ? '1 offener Posten'
                        : `${openItems.length} offene Posten`}
                    </ThemedText>
                  </View>
                </View>

                {openItems.length === 0 ? (
                  <LiquidGlassCard style={styles.card}>
                    <View style={styles.cardInner}>
                      <ThemedText style={styles.helperText}>
                        {selectedCategory === 'all'
                          ? 'Alles erledigt! Füge Posten hinzu oder übernimm Zutaten aus einem Rezept.'
                          : 'Keine offenen Posten in dieser Kategorie.'}
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                ) : (
                  renderShoppingGroups(openItems)
                )}

                {purchasedItems.length > 0 ? (
                  <View style={styles.shoppingPurchasedBlock}>
                    <TouchableOpacity
                      style={[styles.collapsibleSectionHeader, styles.shoppingPurchasedHeader]}
                      onPress={togglePurchasedExpanded}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isPurchasedExpanded }}
                    >
                      <View style={styles.shoppingSectionTextBlock}>
                        <ThemedText style={styles.sectionTitle}>Gekauft</ThemedText>
                        <ThemedText style={styles.shoppingSectionSubtitle}>
                          {purchasedItems.length === 1
                            ? '1 erledigter Posten'
                            : `${purchasedItems.length} erledigte Posten`}
                        </ThemedText>
                      </View>
                      <IconSymbol
                        name={isPurchasedExpanded ? 'chevron.up' : 'chevron.down'}
                        size={20}
                        color="rgba(125,90,80,0.65)"
                      />
                    </TouchableOpacity>
                    {isPurchasedExpanded ? renderShoppingGroups(purchasedItems, 'purchased') : null}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.inventoryActionsRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.addInventoryButtonCompact]}
                    onPress={() =>
                      setEditingInventory({ category: 'diapers', unit: 'Stück', reminder_enabled: true })
                    }
                  >
                    <IconSymbol name="plus" size={15} color="#FFFFFF" />
                    <ThemedText style={[styles.primaryButtonText, styles.addInventoryButtonCompactText]}>
                      Vorrat anlegen
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.inventorySearchToggle,
                      isInventorySearchVisible && styles.inventorySearchToggleActive,
                    ]}
                    onPress={toggleInventorySearch}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isInventorySearchVisible }}
                    accessibilityLabel={
                      isInventorySearchVisible
                        ? 'Suche und Filter ausblenden'
                        : 'Suche und Filter einblenden'
                    }
                  >
                    <IconSymbol
                      name="magnifyingglass"
                      size={18}
                      color={isInventorySearchVisible ? '#FFFFFF' : PRIMARY}
                    />
                  </TouchableOpacity>
                </View>
                {isInventorySearchVisible ? renderListControls() : null}
                {inventoryItems.length === 0 ? (
                  <LiquidGlassCard style={styles.card}>
                    <View style={styles.cardInner}>
                      <ThemedText style={styles.helperText}>
                        Noch keine Vorräte. Lege Windeln, Milchpulver & Co. an oder scanne einen Barcode.
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                ) : filteredInventoryItems.length === 0 ? (
                  <LiquidGlassCard style={styles.card}>
                    <View style={styles.cardInner}>
                      <ThemedText style={styles.helperText}>
                        Keine Vorräte in dieser Kategorie.
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                ) : (
                  renderInventoryGroups(filteredInventoryItems)
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* Scan-Ergebnis-Sheet */}
        <Modal visible={scanSheet !== null} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalSheet}>
              {scanSheet?.mode === 'known' ? (
                <>
                  <ThemedText style={styles.modalTitle}>{scanSheet.product.name}</ThemedText>
                  {scanSheet.product.brand ? (
                    <ThemedText style={styles.helperText}>{scanSheet.product.brand}</ThemedText>
                  ) : null}
                  <ThemedText style={styles.modalDetail}>
                    Packung: {scanSheet.product.packageQuantity
                      ? formatUnitQuantity(scanSheet.product.packageQuantity, scanSheet.product.unit ?? 'Stück')
                      : 'unbekannt (1 wird gebucht)'}
                  </ThemedText>
                  <TouchableOpacity style={styles.primaryButton} onPress={handleRefillFromScan}>
                    <ThemedText style={styles.primaryButtonText}>Vorrat auffüllen</ThemedText>
                  </TouchableOpacity>
                </>
              ) : scanSheet?.mode === 'unknown' ? (
                <>
                  <ThemedText style={styles.modalTitle}>Unbekanntes Produkt</ThemedText>
                  <ThemedText style={styles.helperText}>
                    Barcode {scanSheet.barcode} — einmal bestätigen, danach wird er automatisch erkannt.
                  </ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Produktname"
                    placeholderTextColor="rgba(125,90,80,0.5)"
                    value={unknownName}
                    onChangeText={setUnknownName}
                  />
                  <View style={styles.categoryRow}>
                    {CATEGORY_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.categoryChip,
                          unknownCategory === option.id && styles.categoryChipActive,
                        ]}
                        onPress={() => setUnknownCategory(option.id)}
                      >
                        <ThemedText
                          style={[
                            styles.categoryChipText,
                            unknownCategory === option.id && styles.categoryChipTextActive,
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.modalInputRow}>
                    <TextInput
                      style={[styles.modalInput, styles.modalInputHalf]}
                      placeholder="Packungsgröße"
                      placeholderTextColor="rgba(125,90,80,0.5)"
                      keyboardType="decimal-pad"
                      value={unknownPackage}
                      onChangeText={setUnknownPackage}
                    />
                    <TextInput
                      style={[styles.modalInput, styles.modalInputHalf]}
                      placeholder="Einheit"
                      placeholderTextColor="rgba(125,90,80,0.5)"
                      value={unknownUnit}
                      onChangeText={setUnknownUnit}
                    />
                  </View>
                  <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmUnknownProduct}>
                    <ThemedText style={styles.primaryButtonText}>Speichern & auffüllen</ThemedText>
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setScanSheet(null)}>
                <ThemedText style={styles.secondaryButtonText}>Abbrechen</ThemedText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Vorrat anlegen/bearbeiten */}
        <Modal visible={editingInventory !== null} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalSheet}>
              <View style={styles.formHeaderRow}>
                <View style={styles.formHeaderText}>
                  <ThemedText style={styles.modalTitle}>
                    {editingInventory?.id ? 'Vorrat bearbeiten' : 'Vorrat anlegen'}
                  </ThemedText>
                  <ThemedText style={styles.formHeaderSubtitle}>
                    {editingInventory?.id
                      ? editingInventory?.name || 'Produktdaten anpassen'
                      : 'Neues Produkt im Bestand'}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.formCloseButton}
                  onPress={() => setEditingInventory(null)}
                  accessibilityLabel="Schließen"
                >
                  <IconSymbol name="xmark" size={15} color={PRIMARY} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.formSection}>
                  <ThemedText style={styles.formSectionTitle}>Produkt</ThemedText>
                  <View style={styles.fieldBlock}>
                    <ThemedText style={styles.fieldLabel}>Name</ThemedText>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="z. B. Windeln Gr. 3"
                      placeholderTextColor="rgba(125,90,80,0.5)"
                      value={editingInventory?.name ?? ''}
                      onChangeText={(name) => setEditingInventory((prev) => ({ ...prev, name }))}
                    />
                  </View>
                  <View style={styles.barcodeFormRow}>
                    <View style={styles.barcodeTextBlock}>
                      <ThemedText style={styles.barcodeLabel}>Barcode</ThemedText>
                      <ThemedText style={styles.barcodeValue}>
                        {editingInventory?.barcode ?? 'Noch keiner hinterlegt'}
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.barcodeScanButton}
                      onPress={async () => {
                        if (!cameraPermission?.granted) {
                          const response = await requestCameraPermission();
                          if (!response.granted) return;
                        }
                        setInventoryBarcodeScanVisible(true);
                      }}
                      accessibilityLabel="Barcode für Vorrat scannen"
                    >
                      <IconSymbol name="barcode.viewfinder" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.fieldBlock}>
                    <ThemedText style={styles.fieldLabel}>Kategorie</ThemedText>
                    <View style={styles.categoryRow}>
                      {CATEGORY_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.categoryChip,
                            editingInventory?.category === option.id && styles.categoryChipActive,
                          ]}
                          onPress={() =>
                            setEditingInventory((prev) => ({ ...prev, category: option.id }))
                          }
                        >
                          <ThemedText
                            style={[
                              styles.categoryChipText,
                              editingInventory?.category === option.id &&
                                styles.categoryChipTextActive,
                            ]}
                          >
                            {option.label}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.formSectionTitle}>Bestand</ThemedText>
                  <View style={styles.modalInputRow}>
                    <View style={[styles.fieldBlock, styles.modalInputHalf]}>
                      <ThemedText style={styles.fieldLabel}>Angebrochene Packung</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor="rgba(125,90,80,0.5)"
                        keyboardType="decimal-pad"
                        value={
                          editingInventory?.current_quantity !== undefined
                            ? String(editingInventory.current_quantity)
                            : ''
                        }
                        onChangeText={(value) =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            current_quantity: parseFloat(value.replace(',', '.')) || 0,
                          }))
                        }
                      />
                    </View>
                    <View style={[styles.fieldBlock, styles.modalInputHalf]}>
                      <ThemedText style={styles.fieldLabel}>Einheit</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Stück, Gramm …"
                        placeholderTextColor="rgba(125,90,80,0.5)"
                        value={editingInventory?.unit ?? ''}
                        onChangeText={(unit) => setEditingInventory((prev) => ({ ...prev, unit }))}
                      />
                    </View>
                  </View>
                  <View style={styles.modalInputRow}>
                    <View style={[styles.fieldBlock, styles.modalInputHalf]}>
                      <ThemedText style={styles.fieldLabel}>Packungsgröße</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="z. B. 500"
                        placeholderTextColor="rgba(125,90,80,0.5)"
                        keyboardType="decimal-pad"
                        value={
                          editingInventory?.package_quantity != null
                            ? String(editingInventory.package_quantity)
                            : ''
                        }
                        onChangeText={(value) =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            package_quantity: parseFloat(value.replace(',', '.')) || null,
                          }))
                        }
                      />
                    </View>
                    <View style={[styles.fieldBlock, styles.modalInputHalf]}>
                      <ThemedText style={styles.fieldLabel}>Volle Packungen</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0"
                        placeholderTextColor="rgba(125,90,80,0.5)"
                        keyboardType="number-pad"
                        value={
                          editingInventory?.packages_sealed != null
                            ? String(editingInventory.packages_sealed)
                            : ''
                        }
                        onChangeText={(value) =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            packages_sealed: parseInt(value, 10) || 0,
                          }))
                        }
                      />
                    </View>
                  </View>
                  <ThemedText style={styles.fieldFootnote}>
                    Die Gesamtmenge rechnet die App selbst aus: angebrochene Packung plus volle
                    Packungen mal Packungsgröße.
                  </ThemedText>
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.formSectionTitle}>Nachkaufen & Verbrauch</ThemedText>
                  <View style={styles.modalInputRow}>
                    <View style={[styles.fieldBlock, styles.modalInputHalf]}>
                      <ThemedText style={styles.fieldLabel}>Nachkaufen ab</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="z. B. 100"
                        placeholderTextColor="rgba(125,90,80,0.5)"
                        keyboardType="decimal-pad"
                        value={
                          editingInventory?.reorder_threshold !== undefined
                            ? String(editingInventory.reorder_threshold)
                            : ''
                        }
                        onChangeText={(value) =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            reorder_threshold: parseFloat(value.replace(',', '.')) || 0,
                          }))
                        }
                      />
                    </View>
                    <View style={[styles.fieldBlock, styles.modalInputHalf]}>
                      <ThemedText style={styles.fieldLabel}>Verbrauch pro Tag</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="z. B. 10"
                        placeholderTextColor="rgba(125,90,80,0.5)"
                        keyboardType="decimal-pad"
                        value={
                          editingInventory?.daily_usage_estimate != null
                            ? String(editingInventory.daily_usage_estimate)
                            : ''
                        }
                        onChangeText={(value) =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            daily_usage_estimate: parseFloat(value.replace(',', '.')) || null,
                          }))
                        }
                      />
                    </View>
                  </View>
                  <ThemedText style={styles.fieldFootnote}>
                    Fällt der Bestand unter „Nachkaufen ab“, landet das Produkt als Vorschlag auf
                    der Einkaufsliste.
                  </ThemedText>
                </View>

                {editingInventory?.category === 'formula' ? (
                  <View style={styles.formSection}>
                    <ThemedText style={styles.formSectionTitle}>Dosierung</ThemedText>
                    <View style={styles.fieldBlock}>
                      <ThemedText style={styles.fieldLabel}>Gramm Pulver pro 100 ml</ThemedText>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="z. B. 10,5"
                        placeholderTextColor="rgba(125,90,80,0.5)"
                        keyboardType="decimal-pad"
                        value={
                          editingInventory?.dosage_grams_per_100ml != null
                            ? String(editingInventory.dosage_grams_per_100ml).replace('.', ',')
                            : ''
                        }
                        onChangeText={(value) =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            dosage_grams_per_100ml: parseFloat(value.replace(',', '.')) || null,
                          }))
                        }
                      />
                    </View>
                    <ThemedText style={styles.fieldFootnote}>
                      Steht in der Dosiertabelle auf der Packung — z. B. 3 Löffel à 3,5 g auf
                      100 ml = 10,5. Damit bucht jedes Fläschchen automatisch die richtige
                      Grammzahl vom Vorrat ab.
                    </ThemedText>
                  </View>
                ) : null}
              </ScrollView>
              <View style={styles.formFooter}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleSaveInventoryForm}>
                  <ThemedText style={styles.primaryButtonText}>Speichern</ThemedText>
                </TouchableOpacity>
                {editingInventory?.id ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      const current = inventoryItems.find((it) => it.id === editingInventory.id);
                      setEditingInventory(null);
                      if (current) handleDeleteInventory(current);
                    }}
                  >
                    <ThemedText style={[styles.secondaryButtonText, styles.destructiveText]}>
                      Löschen
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Einkauf per Barcode abhaken */}
        <Modal visible={purchaseScanVisible} animationType="slide" onRequestClose={() => setPurchaseScanVisible(false)}>
          <View style={styles.purchaseScanContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              autofocus="on"
              enableTorch={torchEnabled}
              zoom={activeZoomStep.zoom}
              selectedLens={Platform.OS === 'ios' ? activeZoomStep.lens : undefined}
              onAvailableLensesChanged={({ lenses }) => setAvailableLenses(lenses)}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128'],
              }}
              onBarcodeScanned={handlePurchaseScan}
            />
            <View style={styles.scannerOverlay} pointerEvents="box-none">
              {/* Vollbild-Modal ohne SafeArea: unter Dynamic Island/Notch rücken. */}
              {renderZoomRow(insets.top + 12)}
              <View style={styles.scannerFrame} pointerEvents="none" />
              <ThemedText style={styles.scannerHint}>
                {isResolvingScan
                  ? 'Posten wird gesucht …'
                  : 'Gekauftes Produkt scannen, um es abzuhaken'}
              </ThemedText>
              <TouchableOpacity
                style={[styles.purchaseScanClose, { bottom: insets.bottom + 28 }]}
                onPress={() => setPurchaseScanVisible(false)}
              >
                <ThemedText style={styles.purchaseScanCloseText}>Fertig</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Barcode für bestehenden Vorrat hinterlegen */}
        <Modal
          visible={inventoryBarcodeScanVisible}
          animationType="slide"
          onRequestClose={() => setInventoryBarcodeScanVisible(false)}
        >
          <View style={styles.purchaseScanContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              autofocus="on"
              enableTorch={torchEnabled}
              zoom={activeZoomStep.zoom}
              selectedLens={Platform.OS === 'ios' ? activeZoomStep.lens : undefined}
              onAvailableLensesChanged={({ lenses }) => setAvailableLenses(lenses)}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128'],
              }}
              onBarcodeScanned={handleInventoryBarcodeScan}
            />
            <View style={styles.scannerOverlay} pointerEvents="box-none">
              {renderZoomRow(insets.top + 12)}
              <View style={styles.scannerFrame} pointerEvents="none" />
              <ThemedText style={styles.scannerHint}>
                Barcode für diesen Vorrat scannen
              </ThemedText>
              <TouchableOpacity
                style={[styles.purchaseScanClose, { bottom: insets.bottom + 28 }]}
                onPress={() => setInventoryBarcodeScanVisible(false)}
              >
                <ThemedText style={styles.purchaseScanCloseText}>Abbrechen</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: 12, paddingBottom: 96, gap: 12 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  segmentActive: { backgroundColor: PRIMARY },
  segmentText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  segmentTextActive: { color: '#FFFFFF' },
  card: { borderRadius: RADIUS },
  cardInner: { padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  helperText: { fontSize: 14, opacity: 0.75 },
  addHeaderRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    fontSize: 15,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142,78,198,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.18)',
  },
  closeInlineButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  searchRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#3A2E20',
  },
  clearSearchButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSummaryRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.07)',
  },
  filterSummaryTextBlock: { flex: 1, gap: 2 },
  filterSummaryTitle: { fontSize: 13, fontWeight: '800', color: '#5F463A' },
  filterSummaryValue: { fontSize: 12, fontWeight: '700', color: 'rgba(125,90,80,0.58)' },
  shoppingSectionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  shoppingSectionTextBlock: { flex: 1, gap: 2 },
  shoppingSectionSubtitle: { fontSize: 12, fontWeight: '700', color: 'rgba(125,90,80,0.62)' },
  shoppingGroupCard: {
    borderRadius: SHOPPING_CARD_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  shoppingGroupCardPurchased: {
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  shoppingRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.07)',
  },
  shoppingRowPurchased: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  shoppingRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  shoppingCheckSlot: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingRowText: { flex: 1, minWidth: 0, gap: 5 },
  shoppingTitle: { fontSize: 15, fontWeight: '600', color: '#3A2E20' },
  shoppingTitlePurchased: { textDecorationLine: 'line-through', opacity: 0.5 },
  shoppingMeta: { fontSize: 12, opacity: 0.6 },
  shoppingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shoppingSourcePill: {
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  shoppingSourceText: { fontSize: 12, fontWeight: '700', color: 'rgba(125,90,80,0.62)' },
  shoppingNoteText: { flex: 1, fontSize: 12, color: 'rgba(125,90,80,0.62)' },
  shoppingQuantityPill: {
    maxWidth: 72,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  shoppingQuantityText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(95,70,58,0.82)',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  shoppingGroup: { gap: 9, padding: 12 },
  shoppingGroupHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  shoppingGroupTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#5F463A' },
  shoppingGroupCount: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(125,90,80,0.56)',
    fontVariant: ['tabular-nums'],
  },
  shoppingGroupList: { gap: 7 },
  shoppingPurchasedBlock: { gap: 8 },
  shoppingPurchasedHeader: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.08)',
  },
  rowIconButton: { padding: 8 },
  collapsibleSectionHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inventoryGroup: { gap: 8 },
  inventoryGroupHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
  },
  inventoryGroupTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  inventoryGroupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inventoryGroupTitle: { fontSize: 15, fontWeight: '800', color: '#5F463A' },
  inventoryGroupCount: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  inventoryGroupList: { gap: 8 },
  inventoryCard: {
    borderRadius: INVENTORY_CARD_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.56)',
  },
  inventoryCardLow: {
    backgroundColor: 'rgba(255,247,242,0.78)',
  },
  inventoryCardExpanded: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  inventoryCompactRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inventoryStatusDot: {
    width: 9,
    height: 42,
    borderRadius: 5,
    backgroundColor: 'rgba(142,78,198,0.32)',
  },
  inventoryStatusDotLow: { backgroundColor: '#C4453A' },
  inventoryCompactText: { flex: 1, minWidth: 0, gap: 3 },
  inventoryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inventoryName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#3A2E20' },
  inventoryCategory: { fontSize: 12, opacity: 0.6 },
  inventoryCompactMetric: { width: 84, alignItems: 'flex-end', gap: 2 },
  inventoryCompactQuantity: {
    maxWidth: 84,
    fontSize: 15,
    fontWeight: '800',
    color: PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  inventoryCompactQuantityLow: { color: '#C4453A' },
  inventoryCompactMeta: {
    maxWidth: 84,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(125,90,80,0.62)',
    fontVariant: ['tabular-nums'],
  },
  inventoryDetails: {
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(125,90,80,0.10)',
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D08945',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lowStockBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  inventoryHero: { flexDirection: 'row', gap: 8 },
  inventoryHeroTile: {
    flex: 1,
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(125,90,80,0.075)',
    gap: 2,
  },
  inventoryHeroValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: PRIMARY,
  },
  inventoryHeroValueLow: { color: '#C4453A' },
  inventoryHeroLabel: {
    fontSize: 11,
    opacity: 0.7,
    textAlign: 'center',
  },
  packageProgressBlock: { gap: 4 },
  packageProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(125,90,80,0.12)',
    overflow: 'hidden',
  },
  packageProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  packageProgressFillLow: { backgroundColor: '#C4453A' },
  packageProgressLabel: { fontSize: 12, opacity: 0.75, fontVariant: ['tabular-nums'] },
  inventoryStat: { fontSize: 13, opacity: 0.8 },
  usageSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(142,78,198,0.08)',
  },
  usageSummaryText: { flex: 1, fontSize: 12, opacity: 0.78, fontVariant: ['tabular-nums'] },
  inventoryDetailControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inventoryControlLabel: { fontSize: 12, fontWeight: '600', opacity: 0.65 },
  quantityStepper: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
  },
  stepperButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: { opacity: 0.45 },
  stepperValue: {
    minWidth: 92,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(142,78,198,0.12)',
  },
  stepperValueText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  inventoryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inventoryActionButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  inventoryActionPrimary: { backgroundColor: PRIMARY },
  inventoryActionText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  inventoryActionPrimaryText: { color: '#FFFFFF' },
  lowStockHintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lowStockHintText: { fontSize: 14, fontWeight: '600' },
  suggestionList: { gap: 8 },
  suggestionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  suggestionTextBlock: { flex: 1 },
  suggestionTitle: { fontSize: 14, fontWeight: '700' },
  suggestionMeta: { fontSize: 12, opacity: 0.65, fontVariant: ['tabular-nums'] },
  suggestionButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  suggestionButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  filterBlock: { gap: 8 },
  filterLabel: { fontSize: 13, fontWeight: '700', opacity: 0.7, paddingHorizontal: 2 },
  filterRow: { gap: 8, paddingRight: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.12)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(142,78,198,0.12)',
    borderColor: 'rgba(142,78,198,0.24)',
  },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#7A4AA6', fontVariant: ['tabular-nums'] },
  filterChipTextActive: { color: PRIMARY },
  switchRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  switchTextBlock: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 14, fontWeight: '700' },
  switchSubtitle: { fontSize: 12, opacity: 0.65, fontVariant: ['tabular-nums'] },
  inventoryActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addInventoryButtonCompact: { flexDirection: 'row', gap: 6, flex: 1, height: 40, marginTop: 0 },
  addInventoryButtonCompactText: { fontSize: 14 },
  inventorySearchToggle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.14)',
  },
  inventorySearchToggleActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  scannerContainer: { flex: 1, marginHorizontal: 12, marginBottom: 20, borderRadius: RADIUS, overflow: 'hidden' },
  camera: { flex: 1 },
  scannerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scannerFrame: {
    width: 240,
    height: 150,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  zoomRow: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  zoomChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  zoomChipActive: {
    backgroundColor: '#FFFFFF',
  },
  zoomChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zoomChipTextActive: {
    color: '#3A2E20',
  },
  purchaseScanContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  purchaseScanClose: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  purchaseScanCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3A2E20',
  },
  torchButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  torchButtonActive: {
    backgroundColor: '#FFD766',
  },
  scannerHint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    marginTop: 4,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { height: 42, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  destructiveText: { color: '#B0625B' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: '#FFF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalDetail: { fontSize: 15 },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(125,90,80,0.25)',
  },
  formHeaderText: { flex: 1, gap: 2 },
  formHeaderSubtitle: { fontSize: 13, opacity: 0.6 },
  formCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142,78,198,0.1)',
  },
  formScroll: { flexGrow: 0 },
  formScrollContent: { gap: 20, paddingTop: 14, paddingBottom: 6 },
  formSection: { gap: 10 },
  formSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PRIMARY,
    opacity: 0.85,
  },
  fieldBlock: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '600', opacity: 0.65 },
  fieldFootnote: { fontSize: 12, lineHeight: 17, opacity: 0.55 },
  formFooter: { gap: 4, paddingTop: 12 },
  barcodeFormRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(142,78,198,0.08)',
  },
  barcodeTextBlock: { flex: 1, gap: 2 },
  barcodeLabel: { fontSize: 12, fontWeight: '700', opacity: 0.65 },
  barcodeValue: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  barcodeScanButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: PRIMARY,
  },
  modalInput: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(142,78,198,0.08)',
    fontSize: 15,
  },
  modalInputRow: { flexDirection: 'row', gap: 8 },
  modalInputHalf: { flex: 1 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(142,78,198,0.08)',
  },
  categoryChipActive: { backgroundColor: PRIMARY },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  categoryChipTextActive: { color: '#FFFFFF' },
});
