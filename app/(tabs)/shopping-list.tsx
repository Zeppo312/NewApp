/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';
import {
  LiquidGlassCard,
  PRIMARY,
  PRIMARY_DARK_FOREGROUND,
  RADIUS,
} from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import {
  DEFAULT_SHOPPING_LOCALE,
  formatShoppingDate,
  formatShoppingQuantity,
  getShoppingCategoryLabel,
  getShoppingLocaleTag,
  translateShoppingText,
} from '@/lib/shoppingTranslations';
import {
  applyPurchaseToInventory,
  computeInventoryCount,
  deleteInventoryItem,
  deleteShoppingItem,
  deleteShoppingItems,
  fetchProductDetails,
  fetchShoppingState,
  findInventoryItemByBarcode,
  InventoryItem,
  isLowStock,
  normalizeItemName,
  ProductDetails,
  refillInventoryFromProduct,
  resolveBarcodeProduct,
  ResolvedBarcodeProduct,
  saveProductToCatalog,
  setInventoryCount,
  ShoppingListItem,
  toggleShoppingItemPurchased,
  upsertInventoryItem,
  upsertShoppingItem,
} from '@/lib/shopping';
import { drainShoppingWidgetToggles, syncShoppingWidget } from '@/lib/shoppingWidget';
import { LockedFeatureScreen } from '@/components/LockedFeatureScreen';
import { useFeatureAccess } from '@/lib/entitlements';

type SectionKey = 'shopping' | 'inventory' | 'scanner';
type ShoppingNavigationKey = SectionKey | 'cards';
type CategoryFilterKey = 'all' | string;
type ShoppingSortKey = 'newest' | 'category' | 'name';
type InventorySortKey = 'low_stock' | 'name' | 'category';
type ShoppingViewMode = 'list' | 'tiles';

let ACTIVE_SHOPPING_LOCALE = DEFAULT_SHOPPING_LOCALE;
let SHOPPING_LOCALE_TAG = getShoppingLocaleTag(ACTIVE_SHOPPING_LOCALE);
const t = (key: string, params?: Record<string, string | number>) =>
  translateShoppingText(ACTIVE_SHOPPING_LOCALE, key, params);
const formatQuantity = (value: number, unit: string) =>
  formatShoppingQuantity(ACTIVE_SHOPPING_LOCALE, value, unit);
const DEFAULT_PIECE_UNIT = t('unit.piece');
const DEFAULT_PACKAGE_UNIT = t('unit.package');

const SECTIONS: { key: ShoppingNavigationKey; labelKey: string; icon: string }[] = [
  { key: 'shopping', labelKey: 'section.shopping', icon: 'cart' },
  { key: 'cards', labelKey: 'section.cards', icon: 'wallet.pass.fill' },
];

const CATEGORY_IDS = ['diapers', 'formula', 'care', 'food', 'other'] as const;

const COLLAPSED_INVENTORY_CATEGORIES_KEY = 'shopping_inventory_collapsed_categories_v1';
const SHOPPING_VIEW_MODE_KEY = 'shopping_view_mode_v1';

const CATEGORY_FILTER_IDS: CategoryFilterKey[] = ['all', ...CATEGORY_IDS];

const SHOPPING_SORT_OPTIONS: { id: ShoppingSortKey; labelKey: string }[] = [
  { id: 'newest', labelKey: 'sort.newest' },
  { id: 'category', labelKey: 'sort.category' },
  { id: 'name', labelKey: 'sort.name' },
];

const INVENTORY_SORT_OPTIONS: { id: InventorySortKey; labelKey: string }[] = [
  { id: 'low_stock', labelKey: 'sort.lowStock' },
  { id: 'name', labelKey: 'sort.name' },
  { id: 'category', labelKey: 'sort.category' },
];

const categoryLabel = (id: string) =>
  getShoppingCategoryLabel(ACTIVE_SHOPPING_LOCALE, CATEGORY_IDS.includes(id as any) ? id : 'other');

const shoppingSourceLabel = (item: ShoppingListItem) => {
  if (item.source_type === 'recipe') return t('source.recipe');
  if (item.source_type === 'inventory') return t('source.inventory');
  return t('source.manual');
};

const shoppingQuantityLabel = (item: ShoppingListItem) => {
  if (item.quantity_value == null || !item.quantity_unit) return null;
  return formatQuantity(item.quantity_value, item.quantity_unit);
};

const getCreatedAtTime = (item: { created_at?: string | null }) =>
  item.created_at ? new Date(item.created_at).getTime() : 0;

const getPurchasedAt = (item: ShoppingListItem) => item.updated_at;

const getLocalDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatPurchaseDate = (value: string) =>
  formatShoppingDate(ACTIVE_SHOPPING_LOCALE, value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

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

/** Packungsgröße als Info-Zeile, z. B. „800 g“ — null, wenn nichts bekannt ist. */
const inventoryPackageLabel = (item: Pick<InventoryItem, 'package_quantity' | 'unit'>) => {
  if (!item.package_quantity || item.package_quantity <= 0) return null;
  if (!item.unit || item.unit === DEFAULT_PIECE_UNIT) return null;
  return formatQuantity(item.package_quantity, item.unit);
};

type ProductInfoState = {
  item: InventoryItem;
  details: ProductDetails | null;
  loading: boolean;
};

const NUTRIENT_LABEL_KEYS: Record<string, string> = {
  energy: 'info.nutrient.energy',
  fat: 'info.nutrient.fat',
  saturatedFat: 'info.nutrient.saturatedFat',
  carbohydrates: 'info.nutrient.carbohydrates',
  sugars: 'info.nutrient.sugars',
  fiber: 'info.nutrient.fiber',
  proteins: 'info.nutrient.proteins',
  salt: 'info.nutrient.salt',
};

const formatNutrientValue = (value: number, unit: string) => {
  const rounded = Math.round(value * 10) / 10;
  const text = rounded.toLocaleString(SHOPPING_LOCALE_TAG, { maximumFractionDigits: 1 });
  return `${text} ${unit}`;
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
type ScanSheetState =
  | { mode: 'known'; product: Extract<ResolvedBarcodeProduct, { status: 'known' }>['product']; source: string }
  | { mode: 'unknown'; barcode: string }
  | null;

// Abo-Gate: in Lotti Lite ist dieses Feature gesperrt (lib/entitlements.ts).

/**
 * Wischbare Hülle für eine Vorratskarte: nach links wischen zeigt Löschen,
 * nach rechts wischen setzt den Posten auf die Einkaufsliste.
 */
function InventorySwipeRow({
  children,
  onDelete,
  onAddToList,
  deleteLabel,
  addLabel,
  isOnList,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onAddToList: () => void;
  deleteLabel: string;
  addLabel: string;
  isOnList: boolean;
  accessibilityLabel: string;
}) {
  const ref = useRef<Swipeable | null>(null);
  const triggerDelete = () => {
    ref.current?.close();
    onDelete();
  };
  const triggerAdd = () => {
    ref.current?.close();
    onAddToList();
  };
  return (
    <Swipeable
      ref={ref}
      friction={2}
      leftThreshold={48}
      rightThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') triggerAdd();
      }}
      renderLeftActions={() => (
        <TouchableOpacity
          style={[styles.inventorySwipeAdd, isOnList && styles.inventorySwipeAddDone]}
          onPress={triggerAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <IconSymbol name={isOnList ? 'checkmark' : 'cart'} size={22} color="#FFFFFF" />
          <ThemedText style={styles.inventorySwipeDeleteText}>{addLabel}</ThemedText>
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.inventorySwipeDelete}
          onPress={triggerDelete}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <IconSymbol name="trash" size={22} color="#FFFFFF" />
          <ThemedText style={styles.inventorySwipeDeleteText}>{deleteLabel}</ThemedText>
        </TouchableOpacity>
      )}
    >
      {children}
    </Swipeable>
  );
}

export default function ShoppingListScreen() {
  ACTIVE_SHOPPING_LOCALE = useLocale().locale;
  SHOPPING_LOCALE_TAG = getShoppingLocaleTag(ACTIVE_SHOPPING_LOCALE);
  const access = useFeatureAccess('shoppingList');

  if (access.hasAccess === null) return null;
  if (!access.hasAccess) {
    return <LockedFeatureScreen feature="shoppingList" />;
  }

  return <ShoppingListScreenContent />;
}

function ShoppingListScreenContent() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const requestedReturnTarget = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const requestedReturnTargetRef = useRef(requestedReturnTarget);
  const backTargetRef = useRef<'home' | 'recipes'>('home');

  const [section, setSection] = useState<SectionKey>('shopping');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [shoppingSort, setShoppingSort] = useState<ShoppingSortKey>('newest');
  const [shoppingViewMode, setShoppingViewMode] = useState<ShoppingViewMode>('list');
  const [inventorySort, setInventorySort] = useState<InventorySortKey>('low_stock');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [isInventorySearchVisible, setIsInventorySearchVisible] = useState(false);
  const [isShoppingSearchVisible, setIsShoppingSearchVisible] = useState(false);
  const [collapsedInventoryCategories, setCollapsedInventoryCategories] = useState<string[]>([]);
  const [isAddShoppingExpanded, setIsAddShoppingExpanded] = useState(false);
  const [isPurchasedExpanded, setIsPurchasedExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [productInfo, setProductInfo] = useState<ProductInfoState | null>(null);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [editingInventory, setEditingInventory] = useState<Partial<InventoryItem> | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomTabOverflow = useBottomTabOverflow();
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const primaryForeground = isDark ? PRIMARY_DARK_FOREGROUND : PRIMARY;
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
          accessibilityLabel={t('scan.zoom', { zoom: step.label })}
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

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadState = useCallback(async () => {
    const { data, error } = await fetchShoppingState();
    if (error) {
      console.error('Failed to load shopping state:', error);
    } else if (data) {
      setShoppingItems(data.shoppingItems);
      setInventoryItems(data.inventoryItems);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    requestedReturnTargetRef.current = requestedReturnTarget;
  }, [requestedReturnTarget]);

  useFocusEffect(
    useCallback(() => {
      backTargetRef.current =
        requestedReturnTargetRef.current === 'recipes' ? 'recipes' : 'home';

      if (requestedReturnTargetRef.current !== undefined) {
        router.setParams({ returnTo: undefined } as any);
      }

      return () => {
        backTargetRef.current = 'home';
      };
    }, [router])
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadState();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadState]);

  // Im Widget abgehakte Posten übernehmen, sobald der Screen wieder sichtbar ist.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void drainShoppingWidgetToggles({
        locale: ACTIVE_SHOPPING_LOCALE,
      }).then(({ items }) => {
        if (!cancelled && items) setShoppingItems(items);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Home-Screen-Widget bei jeder Änderung der Liste nachziehen.
  useEffect(() => {
    if (isLoading) return;
    void syncShoppingWidget(shoppingItems, {
      locale: ACTIVE_SHOPPING_LOCALE,
    });
  }, [isLoading, shoppingItems]);

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

  const filteredShoppingItems = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? searchedShoppingItems
        : searchedShoppingItems.filter((item) => item.category === selectedCategory);

    return [...filtered].sort((a, b) => {
      if (shoppingSort === 'category') {
        const byCategory = categoryLabel(a.category).localeCompare(categoryLabel(b.category), SHOPPING_LOCALE_TAG);
        if (byCategory !== 0) return byCategory;
        return a.title.localeCompare(b.title, SHOPPING_LOCALE_TAG);
      }
      if (shoppingSort === 'name') {
        return a.title.localeCompare(b.title, SHOPPING_LOCALE_TAG);
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
        return a.name.localeCompare(b.name, SHOPPING_LOCALE_TAG);
      }
      if (inventorySort === 'category') {
        const byCategory = categoryLabel(a.category).localeCompare(categoryLabel(b.category), SHOPPING_LOCALE_TAG);
        if (byCategory !== 0) return byCategory;
        return a.name.localeCompare(b.name, SHOPPING_LOCALE_TAG);
      }
      const byLowStock = Number(isLowStock(b)) - Number(isLowStock(a));
      if (byLowStock !== 0) return byLowStock;
      return a.name.localeCompare(b.name, SHOPPING_LOCALE_TAG);
    });
  }, [selectedCategory, searchedInventoryItems, inventorySort]);

  const applyInventoryUpdate = useCallback((updated: InventoryItem) => {
    setInventoryItems((items) =>
      items.some((it) => it.id === updated.id)
        ? items.map((it) => (it.id === updated.id ? updated : it))
        : [...items, updated].sort((a, b) => a.name.localeCompare(b.name, SHOPPING_LOCALE_TAG))
    );
  }, []);

  // --- Einkaufsliste -------------------------------------------------------

  const handleAddShoppingItem = useCallback(async () => {
    if (newItemTitle.trim().length === 0) return;
    setIsAddingItem(true);
    const { data, error } = await upsertShoppingItem({
      title: newItemTitle,
      category: selectedCategory === 'all' ? 'other' : selectedCategory,
    });
    setIsAddingItem(false);
    if (error || !data) {
      Alert.alert(t('common.error'), t('shopping.addFailed'));
      return;
    }
    setNewItemTitle('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAddShoppingExpanded(false);
    setShoppingItems((items) => [data, ...items]);
  }, [newItemTitle, selectedCategory]);

  const handleTogglePurchased = useCallback(
    async (item: ShoppingListItem) => {
      const nowPurchased = !item.is_purchased;
      const updatedAt = new Date().toISOString();
      setShoppingItems((items) =>
        items.map((it) =>
          it.id === item.id
            ? { ...it, is_purchased: nowPurchased, updated_at: updatedAt }
            : it
        )
      );
      const { data: updatedItem, error } = await toggleShoppingItemPurchased(item.id, nowPurchased);
      if (error || !updatedItem) {
        console.error('Failed to toggle shopping item:', error);
        setShoppingItems((items) =>
          items.map((it) => (it.id === item.id ? item : it))
        );
        Alert.alert(
          t('shopping.updateFailedTitle'),
          t('shopping.updateFailed')
        );
        return;
      }
      setShoppingItems((items) =>
        items.map((it) => (it.id === updatedItem.id ? updatedItem : it))
      );

      // Stammt der Posten aus dem Vorrat, wird der Bestand beim Abhaken erhöht —
      // bei Packungsartikeln als ganze (versiegelte) Packung, sonst als Menge.
      // Beim Zurücknehmen wird wieder korrigiert.
      const linkedInventory = item.inventory_item_id
        ? inventoryItems.find((inv) => inv.id === item.inventory_item_id)
        : undefined;
      if (linkedInventory) {
        const note = nowPurchased
          ? t('shopping.transactionPurchase', { name: item.title })
          : t('shopping.transactionReverted', { name: item.title });
        const { data } = await applyPurchaseToInventory(
          item,
          linkedInventory,
          nowPurchased,
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

  // Alle gekauften Posten der aktuellen Ansicht auf einmal von der Liste nehmen.
  const handleClearPurchasedItems = useCallback((items: ShoppingListItem[]) => {
    if (items.length === 0) return;
    const ids = items.map((item) => item.id);
    Alert.alert(
      t('shopping.clearPurchasedTitle'),
      t(`shopping.clearPurchasedQuestion.${items.length === 1 ? 'one' : 'other'}`, {
        count: items.length,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const idSet = new Set(ids);
            setShoppingItems((current) => current.filter((it) => !idSet.has(it.id)));
            const { error } = await deleteShoppingItems(ids);
            if (error) {
              console.error('Failed to delete purchased shopping items:', error);
              setShoppingItems((current) => {
                const remaining = new Set(current.map((it) => it.id));
                const restored = items.filter((it) => !remaining.has(it.id));
                return restored.length > 0 ? [...current, ...restored] : current;
              });
              Alert.alert(t('shopping.updateFailedTitle'), t('shopping.clearPurchasedFailed'));
            }
          },
        },
      ]
    );
  }, []);

  // Barcode-Scan im Einkauf: gescanntes Produkt auf der Liste finden und
  // als gekauft abhaken (inkl. Vorrats-Auffüllung über handleTogglePurchased).
  const handlePurchaseScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (isResolvingScan) return;
      const barcode = result.data;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.barcode === barcode && now - last.at < SCAN_DEBOUNCE_MS) return;
      lastScanRef.current = { barcode, at: now };

      setIsResolvingScan(true);
      let matchedInventoryId: string | null = null;
      const matchNames: string[] = [];
      const { data: inventoryMatch } = await findInventoryItemByBarcode(barcode);
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
          t('scan.noMatchTitle'),
          t('scan.noMatch')
        );
        return;
      }
      await handleTogglePurchased(target);
      Alert.alert(t('scan.checkedTitle'), t('scan.checked', { name: target.title }));
    },
    [isResolvingScan, shoppingItems, handleTogglePurchased]
  );

  const handleInventoryBarcodeScan = useCallback((result: BarcodeScanningResult) => {
    const barcode = result.data;
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.barcode === barcode && now - last.at < SCAN_DEBOUNCE_MS) return;
    lastScanRef.current = { barcode, at: now };

    setEditingInventory((current) => (current ? { ...current, barcode } : current));
    setInventoryBarcodeScanVisible(false);
    Alert.alert(t('scan.barcodeAppliedTitle'), t('scan.barcodeApplied'));
  }, []);

  // --- Vorrat ---------------------------------------------------------------

  const handleAdjustQuantity = useCallback(
    async (item: InventoryItem, delta: number) => {
      const next = computeInventoryCount(item) + delta;
      if (next < 0) return;
      const { data, error } = await setInventoryCount(item, next);
      if (error || !data) {
        Alert.alert(t('common.error'), t('inventory.adjustFailed'));
        return;
      }
      applyInventoryUpdate(data);
    },
    [applyInventoryUpdate]
  );

  const openProductInfo = useCallback(async (item: InventoryItem) => {
    if (!item.barcode) {
      setProductInfo({ item, details: null, loading: false });
      return;
    }
    setProductInfo({ item, details: null, loading: true });
    const details = await fetchProductDetails(item.barcode);
    setProductInfo((current) =>
      current && current.item.id === item.id ? { item, details, loading: false } : current
    );
  }, []);

  const handleInventoryToShoppingList = useCallback(
    async (item: InventoryItem, showConfirmation = true) => {
      const existingOpenItem = shoppingItems.find(
        (shoppingItem) =>
          !shoppingItem.is_purchased && shoppingItem.inventory_item_id === item.id
      );
      if (existingOpenItem) {
        if (showConfirmation) {
          Alert.alert(
            t('inventory.alreadyListedTitle'),
            t('inventory.alreadyListed', { name: item.name })
          );
        }
        return;
      }
      // Vorratsposten landen als "1 Packung" auf der Liste.
      const { data, error } = await upsertShoppingItem({
        title: item.name,
        category: item.category,
        quantity_value: 1,
        quantity_unit: DEFAULT_PACKAGE_UNIT,
        source_type: 'inventory',
        inventory_item_id: item.id,
      });
      if (error || !data) {
        Alert.alert(t('common.error'), t('inventory.addToListFailed'));
        return;
      }
      setShoppingItems((items) => [data, ...items.filter((it) => it.id !== data.id)]);
      if (showConfirmation) {
        Alert.alert(t('inventory.addedTitle'), t('inventory.added', { name: item.name }));
      }
    },
    [shoppingItems]
  );

  const handleSaveInventoryForm = useCallback(async () => {
    if (!editingInventory) return;
    const name = editingInventory.name?.trim() ?? '';
    if (name.length === 0) {
      Alert.alert(t('common.error'), t('inventory.nameRequired'));
      return;
    }
    const { data, error } = await upsertInventoryItem({
      id: editingInventory.id,
      name,
      category: editingInventory.category ?? 'other',
      barcode: editingInventory.barcode ?? null,
      current_quantity: Math.max(0, Math.round(editingInventory.current_quantity ?? 0)),
      packages_sealed: 0,
      unit: editingInventory.unit ?? DEFAULT_PIECE_UNIT,
      package_quantity: editingInventory.package_quantity ?? null,
      reorder_threshold: 0,
      daily_usage_estimate: null,
      dosage_grams_per_100ml: editingInventory.dosage_grams_per_100ml ?? null,
      tracking_mode: 'quantity',
      stock_level_percent: 100,
      reorder_level_percent: 0,
    });
    if (error || !data) {
      Alert.alert(t('common.error'), t('inventory.saveFailed'));
      return;
    }
    applyInventoryUpdate(data);
    setEditingInventory(null);
  }, [editingInventory, applyInventoryUpdate]);

  const handleDeleteInventory = useCallback((item: InventoryItem) => {
    Alert.alert(t('inventory.deleteTitle'), t('inventory.deleteQuestion', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
        Alert.alert(t('common.error'), t('scan.checkFailed'));
        return;
      }
      if (data.status === 'known') {
        setScanSheet({ mode: 'known', product: data.product, source: data.source });
      } else {
        setUnknownName('');
        setUnknownCategory('diapers');
        setScanSheet({ mode: 'unknown', barcode: data.barcode });
      }
    },
    [isResolvingScan, scanSheet]
  );

  const handleRefillFromScan = useCallback(async () => {
    if (!scanSheet || scanSheet.mode !== 'known') return;
    const { product } = scanSheet;
    const { data, error } = await refillInventoryFromProduct({
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      packageQuantity: product.packageQuantity,
      unit: product.unit,
    });
    if (error || !data) {
      Alert.alert(t('common.error'), t('inventory.refillFailed'));
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
      t('inventory.refilledTitle'),
      t('inventory.refilledCount', { name: product.name, count: computeInventoryCount(data) })
    );
  }, [scanSheet, applyInventoryUpdate]);

  const handleConfirmUnknownProduct = useCallback(async () => {
    if (!scanSheet || scanSheet.mode !== 'unknown') return;
    const name = unknownName.trim();
    if (name.length === 0) {
      Alert.alert(t('common.error'), t('inventory.nameRequired'));
      return;
    }
    const product = {
      barcode: scanSheet.barcode,
      name,
      category: unknownCategory,
      packageQuantity: null,
      unit: null,
    };
    const { error: catalogError } = await saveProductToCatalog({ ...product, provider: 'manual' });
    if (catalogError) {
      console.error('Failed to save product to catalog:', catalogError);
    }
    const { data, error } = await refillInventoryFromProduct(product);
    if (error || !data) {
      Alert.alert(t('common.error'), t('inventory.createFailed'));
      return;
    }
    applyInventoryUpdate(data);
    setScanSheet(null);
    Alert.alert(t('inventory.savedTitle'), t('inventory.savedBody', { name }));
  }, [scanSheet, unknownName, unknownCategory, applyInventoryUpdate]);

  // --- Rendering ----------------------------------------------------------------

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

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SHOPPING_VIEW_MODE_KEY)
      .then((storedMode) => {
        if (!cancelled && (storedMode === 'list' || storedMode === 'tiles')) {
          setShoppingViewMode(storedMode);
        }
      })
      .catch((error) => {
        console.error('Failed to load shopping view mode:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectShoppingViewMode = useCallback((mode: ShoppingViewMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShoppingViewMode(mode);
    AsyncStorage.setItem(SHOPPING_VIEW_MODE_KEY, mode).catch((error) => {
      console.error('Failed to persist shopping view mode:', error);
    });
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
    setIsShoppingSearchVisible(false);
    setIsFiltersExpanded(false);
    setSearchQuery('');
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
      <ThemedText style={styles.filterLabel}>{t('category.label')}</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORY_FILTER_IDS.map((categoryId) => {
          const isActive = selectedCategory === categoryId;
          const label = categoryLabel(categoryId);
          return (
            <TouchableOpacity
              key={categoryId}
              style={[styles.filterChip, isDark && styles.filterChipDark, isActive && styles.filterChipActive, isActive && isDark && styles.filterChipActiveDark]}
              onPress={() => setSelectedCategory(categoryId)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t('category.accessibility', { category: label })}
            >
              <ThemedText
                style={[styles.filterChipText, isDark && styles.filterChipTextDark, isActive && styles.filterChipTextActive, isActive && isDark && styles.filterChipTextActiveDark]}
              >
                {label} {categoryCounts[categoryId] ?? 0}
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
        <ThemedText style={styles.filterLabel}>{t('sort.label')}</ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {options.map((option) => {
            const isActive = activeSort === option.id;
            const label = t(option.labelKey);
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.filterChip, isDark && styles.filterChipDark, isActive && styles.filterChipActive, isActive && isDark && styles.filterChipActiveDark]}
                onPress={() => {
                  if (section === 'inventory') {
                    setInventorySort(option.id as InventorySortKey);
                  } else {
                    setShoppingSort(option.id as ShoppingSortKey);
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={t('sort.accessibility', { sort: label })}
              >
                <ThemedText
                  style={[styles.filterChipText, isDark && styles.filterChipTextDark, isActive && styles.filterChipTextActive, isActive && isDark && styles.filterChipTextActiveDark]}
                >
                  {label}
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
    const activeSortKey = activeSortOptions.find((option) => option.id === activeSort)?.labelKey;
    const activeSortLabel = activeSortKey ? t(activeSortKey) : undefined;
    const filterSummary =
      selectedCategory === 'all'
        ? activeSortLabel ?? t('common.default')
        : `${categoryLabel(selectedCategory)} · ${activeSortLabel ?? t('common.default')}`;

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
              placeholder={section === 'inventory' ? t('search.inventory') : t('search.shopping')}
              placeholderTextColor="rgba(125,90,80,0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
                accessibilityLabel={t('search.clear')}
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
            accessibilityLabel={isFiltersExpanded ? t('filter.collapse') : t('filter.expand')}
          >
            <View style={styles.filterSummaryTextBlock}>
              <ThemedText style={styles.filterSummaryTitle}>{t('filter.title')}</ThemedText>
              <ThemedText style={styles.filterSummaryValue} numberOfLines={1}>
                {filterSummary}
                {section === 'inventory' && showOnlyLowStock
                  ? ` · ${t('filter.lowStockSuffix')}`
                  : ''}
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
                <View style={[styles.switchRow, isDark && styles.switchRowDark]}>
                  <View style={styles.switchTextBlock}>
                    <ThemedText style={styles.switchTitle}>{t('filter.lowStockOnly')}</ThemedText>
                    <ThemedText style={styles.switchSubtitle}>
                      {t('filter.lowStockThreshold', { count: lowStockItems.length })}
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

  const renderShoppingBottomDock = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'position' : undefined}
      style={styles.shoppingBottomDock}
    >
      <View
        style={[
          styles.shoppingBottomDockSurface,
          isDark && styles.shoppingBottomDockSurfaceDark,
          {
            paddingBottom: isKeyboardVisible
              ? 4
              : 4 + insets.bottom + bottomTabOverflow,
          },
        ]}
      >
        {isShoppingSearchVisible && !isAddShoppingExpanded ? renderListControls() : null}

        {isAddShoppingExpanded ? (
          <LiquidGlassCard
            style={styles.card}
            intensity={16}
            overlayColor="rgba(255,255,255,0.32)"
            borderColor="rgba(125,90,80,0.08)"
          >
            <View style={styles.cardInner}>
              <View style={styles.addHeaderRow}>
                <ThemedText style={styles.sectionTitle}>{t('shopping.item')}</ThemedText>
                <TouchableOpacity
                  style={styles.closeInlineButton}
                  onPress={closeAddShopping}
                  accessibilityLabel={t('shopping.closeInput')}
                >
                  <IconSymbol name="xmark" size={18} color="rgba(125,90,80,0.65)" />
                </TouchableOpacity>
              </View>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder={t('shopping.newPlaceholder')}
                  placeholderTextColor="rgba(125,90,80,0.5)"
                  value={newItemTitle}
                  onChangeText={setNewItemTitle}
                  onSubmitEditing={handleAddShoppingItem}
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.addButton, isDark && styles.addButtonDark]}
                  onPress={handleAddShoppingItem}
                  disabled={isAddingItem}
                  accessibilityLabel={t('shopping.addAccessibility')}
                >
                  <IconSymbol name="plus" size={20} color={primaryForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, isDark && styles.addButtonDark]}
                  onPress={async () => {
                    if (!cameraPermission?.granted) {
                      const response = await requestCameraPermission();
                      if (!response.granted) return;
                    }
                    setPurchaseScanVisible(true);
                  }}
                  accessibilityLabel={t('shopping.scanAccessibility')}
                >
                  <IconSymbol name="barcode.viewfinder" size={20} color={primaryForeground} />
                </TouchableOpacity>
              </View>
            </View>
          </LiquidGlassCard>
        ) : (
          <View style={styles.inventoryActionsRow}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.addInventoryButtonCompact]}
              onPress={openAddShopping}
              accessibilityRole="button"
              accessibilityLabel={t('shopping.openAddAccessibility')}
            >
              <IconSymbol name="plus" size={15} color="#FFFFFF" />
              <ThemedText style={[styles.primaryButtonText, styles.addInventoryButtonCompactText]}>
                {t('shopping.create')}
              </ThemedText>
            </TouchableOpacity>
            <View
              style={styles.shoppingViewToggle}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('shopping.viewAccessibility')}
            >
              <TouchableOpacity
                style={[
                  styles.shoppingViewOption,
                  shoppingViewMode === 'list' && styles.shoppingViewOptionActive,
                ]}
                onPress={() => selectShoppingViewMode('list')}
                accessibilityRole="radio"
                accessibilityState={{ selected: shoppingViewMode === 'list' }}
                accessibilityLabel={t('shopping.listView')}
              >
                <IconSymbol
                  name="list.bullet"
                  size={18}
                  color={shoppingViewMode === 'list' ? '#FFFFFF' : PRIMARY}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.shoppingViewOption,
                  shoppingViewMode === 'tiles' && styles.shoppingViewOptionActive,
                ]}
                onPress={() => selectShoppingViewMode('tiles')}
                accessibilityRole="radio"
                accessibilityState={{ selected: shoppingViewMode === 'tiles' }}
                accessibilityLabel={t('shopping.tileView')}
              >
                <IconSymbol
                  name="square.grid.2x2.fill"
                  size={18}
                  color={shoppingViewMode === 'tiles' ? '#FFFFFF' : PRIMARY}
                />
              </TouchableOpacity>
            </View>
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
                  ? t('search.hide')
                  : t('search.show')
              }
            >
              <IconSymbol
                name="magnifyingglass"
                size={18}
                color={isShoppingSearchVisible ? '#FFFFFF' : PRIMARY}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );

  const renderShoppingRow = (item: ShoppingListItem) => {
    const quantityLabel = shoppingQuantityLabel(item);
    return (
      <View
        key={item.id}
        style={[
          styles.shoppingRow,
          isDark && styles.shoppingRowDark,
          item.is_purchased && styles.shoppingRowPurchased,
          item.is_purchased && isDark && styles.shoppingRowPurchasedDark,
        ]}
      >
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
              style={[
                styles.shoppingTitle,
                isDark && styles.shoppingTitleDark,
                item.is_purchased && styles.shoppingTitlePurchased,
              ]}
              numberOfLines={2}
            >
              {item.title}
            </ThemedText>
            <View style={styles.shoppingMetaRow}>
              <View style={styles.shoppingSourcePill}>
                <ThemedText style={[styles.shoppingSourceText, isDark && styles.shoppingSourceTextDark]}>
                  {shoppingSourceLabel(item)}
                </ThemedText>
              </View>
              {item.notes ? (
                <ThemedText
                  style={[styles.shoppingNoteText, isDark && styles.shoppingNoteTextDark]}
                  numberOfLines={1}
                >
                  {item.notes}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
        {quantityLabel ? (
          <View style={styles.shoppingQuantityPill}>
            <ThemedText style={[styles.shoppingQuantityText, isDark && styles.shoppingQuantityTextDark]}>
              {quantityLabel}
            </ThemedText>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.rowIconButton}
          onPress={() => handleDeleteShoppingItem(item)}
          accessibilityLabel={t('shopping.deleteAccessibility', { name: item.title })}
        >
          <IconSymbol name="trash" size={18} color="#B0625B" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderShoppingTile = (item: ShoppingListItem) => {
    const quantityLabel = shoppingQuantityLabel(item);
    return (
      <View
        key={item.id}
        style={[
          styles.shoppingTile,
          isDark && styles.shoppingTileDark,
          item.is_purchased && styles.shoppingTilePurchased,
          item.is_purchased && isDark && styles.shoppingTilePurchasedDark,
        ]}
      >
        <TouchableOpacity
          style={styles.shoppingTileMain}
          onPress={() => handleTogglePurchased(item)}
          activeOpacity={0.76}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.is_purchased }}
          accessibilityLabel={t(
            item.is_purchased ? 'shopping.statePurchased' : 'shopping.stateOpen',
            { name: item.title }
          )}
        >
          <View style={styles.shoppingTileTopRow}>
            <IconSymbol
              name={item.is_purchased ? 'checkmark.circle.fill' : 'circle'}
              size={27}
              color={item.is_purchased ? '#5FA97A' : PRIMARY}
            />
            {quantityLabel ? (
              <ThemedText
                style={[styles.shoppingTileQuantity, isDark && styles.shoppingQuantityTextDark]}
                numberOfLines={1}
              >
                {quantityLabel}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText
            style={[
              styles.shoppingTileTitle,
              isDark && styles.shoppingTileTitleDark,
              item.is_purchased && styles.shoppingTitlePurchased,
            ]}
            numberOfLines={3}
          >
            {item.title}
          </ThemedText>
          <ThemedText
            style={[styles.shoppingSourceText, isDark && styles.shoppingSourceTextDark]}
            numberOfLines={1}
          >
            {shoppingSourceLabel(item)}
          </ThemedText>
          {item.notes ? (
            <ThemedText
              style={[styles.shoppingTileNote, isDark && styles.shoppingTileNoteDark]}
              numberOfLines={2}
            >
              {item.notes}
            </ThemedText>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shoppingTileDeleteButton}
          onPress={() => handleDeleteShoppingItem(item)}
          accessibilityRole="button"
          accessibilityLabel={t('shopping.deleteAccessibility', { name: item.title })}
        >
          <IconSymbol name="trash" size={17} color="#B0625B" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderShoppingItems = (items: ShoppingListItem[]) => (
    <View
      style={
        shoppingViewMode === 'tiles' ? styles.shoppingTileGrid : styles.shoppingGroupList
      }
    >
      {items.map((item) =>
        shoppingViewMode === 'tiles' ? renderShoppingTile(item) : renderShoppingRow(item)
      )}
    </View>
  );

  const renderShoppingGroups = (items: ShoppingListItem[], variant: 'open' | 'purchased' = 'open') => {
    const groups = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const category = item.category || 'other';
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }

    return Array.from(groups.entries())
      .sort(([categoryA], [categoryB]) =>
        categoryLabel(categoryA).localeCompare(categoryLabel(categoryB), SHOPPING_LOCALE_TAG)
      )
      .map(([category, categoryItems]) => (
        <LiquidGlassCard
          key={category}
          style={[
            styles.shoppingGroupCard,
            isDark && styles.shoppingGroupCardDark,
            variant === 'purchased' && styles.shoppingGroupCardPurchased,
            variant === 'purchased' && isDark && styles.shoppingGroupCardPurchasedDark,
          ]}
          radius={SHOPPING_CARD_RADIUS}
          intensity={18}
          overlayColor={
            isDark
              ? variant === 'purchased'
                ? 'rgba(18,15,22,0.38)'
                : 'rgba(18,15,22,0.48)'
              : variant === 'purchased'
              ? 'rgba(255,255,255,0.34)'
              : 'rgba(255,255,255,0.42)'
          }
          borderColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(125,90,80,0.10)'}
        >
          <View style={styles.shoppingGroup}>
            <View style={styles.shoppingGroupHeader}>
              <ThemedText style={[styles.shoppingGroupTitle, isDark && styles.shoppingGroupTitleDark]}>
                {categoryLabel(category)}
              </ThemedText>
              <ThemedText style={[styles.shoppingGroupCount, isDark && styles.shoppingGroupCountDark]}>
                {t(`shopping.itemCount.${categoryItems.length === 1 ? 'one' : 'other'}`, {
                  count: categoryItems.length,
                })}
              </ThemedText>
            </View>
            {renderShoppingItems(categoryItems)}
          </View>
        </LiquidGlassCard>
      ));
  };

  const renderPurchasedDateGroups = (items: ShoppingListItem[]) => {
    const groups = new Map<string, { purchasedAt: string; items: ShoppingListItem[] }>();
    for (const item of items) {
      const purchasedAt = getPurchasedAt(item);
      const dateKey = getLocalDateKey(purchasedAt);
      const currentGroup = groups.get(dateKey);
      if (currentGroup) {
        currentGroup.items.push(item);
      } else {
        groups.set(dateKey, { purchasedAt, items: [item] });
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime())
      .map((group) => (
        <LiquidGlassCard
          key={getLocalDateKey(group.purchasedAt)}
          style={[
            styles.shoppingGroupCard,
            styles.shoppingGroupCardPurchased,
            isDark && styles.shoppingGroupCardPurchasedDark,
          ]}
          radius={SHOPPING_CARD_RADIUS}
          intensity={18}
          overlayColor={isDark ? 'rgba(18,15,22,0.38)' : 'rgba(255,255,255,0.34)'}
          borderColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(125,90,80,0.10)'}
        >
          <View style={styles.shoppingGroup}>
            <View style={styles.shoppingGroupHeader}>
              <ThemedText style={[styles.shoppingGroupTitle, isDark && styles.shoppingGroupTitleDark]}>
                {t('shopping.purchaseDate', { date: formatPurchaseDate(group.purchasedAt) })}
              </ThemedText>
              <ThemedText style={[styles.shoppingGroupCount, isDark && styles.shoppingGroupCountDark]}>
                {t(`shopping.itemCount.${group.items.length === 1 ? 'one' : 'other'}`, {
                  count: group.items.length,
                })}
              </ThemedText>
              {/* Nur diesen Einkaufstag von der Liste nehmen */}
              <TouchableOpacity
                style={styles.rowIconButton}
                onPress={() => handleClearPurchasedItems(group.items)}
                accessibilityRole="button"
                accessibilityLabel={`${t('shopping.clearPurchasedTitle')}: ${formatPurchaseDate(group.purchasedAt)}`}
              >
                <IconSymbol name="trash" size={18} color="#B0625B" />
              </TouchableOpacity>
            </View>
            {renderShoppingItems(group.items)}
          </View>
        </LiquidGlassCard>
      ));
  };

  const renderInventoryCard = (item: InventoryItem) => {
    const count = computeInventoryCount(item);
    const low = isLowStock(item);
    const isOnShoppingList = shoppingItems.some(
      (shoppingItem) =>
        !shoppingItem.is_purchased && shoppingItem.inventory_item_id === item.id
    );
    const packageLabel = inventoryPackageLabel(item);
    const iconColor = isDark ? '#C496F0' : PRIMARY;
    return (
      <InventorySwipeRow
        key={item.id}
        onDelete={() => handleDeleteInventory(item)}
        onAddToList={() => handleInventoryToShoppingList(item, false)}
        deleteLabel={t('common.delete')}
        addLabel={isOnShoppingList ? t('inventory.onList') : t('inventory.shoppingList')}
        isOnList={isOnShoppingList}
        accessibilityLabel={t('inventory.deleteTitle')}
      >
      <LiquidGlassCard
        style={[
          styles.inventoryCard,
          isDark && styles.inventoryCardDark,
          low && styles.inventoryCardLow,
          low && isDark && styles.inventoryCardLowDark,
        ]}
        radius={INVENTORY_CARD_RADIUS}
        intensity={18}
        overlayColor={isDark ? 'rgba(18,15,22,0.52)' : 'rgba(255,255,255,0.66)'}
        borderColor={
          low
            ? isDark
              ? 'rgba(255,138,138,0.42)'
              : 'rgba(196,69,58,0.42)'
            : isDark
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(125,90,80,0.14)'
        }
      >
        <View style={styles.inventoryCompactRow}>
          <View style={[styles.inventoryStatusDot, low && styles.inventoryStatusDotLow]} />
          <TouchableOpacity
            style={styles.inventoryCompactText}
            onPress={() => setEditingInventory(item)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t('inventory.editAccessibility', { name: item.name })}
          >
            <View style={styles.inventoryNameRow}>
              <ThemedText
                style={[styles.inventoryName, isDark && styles.inventoryNameDark]}
                numberOfLines={1}
              >
                {item.name}
              </ThemedText>
              {low ? (
                <View style={styles.lowStockBadge}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color="#FFFFFF" />
                  <ThemedText style={styles.lowStockBadgeText}>
                    {count === 0 ? t('inventory.emptyLevel') : t('inventory.low')}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={styles.inventoryCategory} numberOfLines={1}>
              {categoryLabel(item.category)}
              {packageLabel ? ` · ${packageLabel}` : ''}
              {isOnShoppingList ? ` · ${t('inventory.onList')}` : ''}
            </ThemedText>
          </TouchableOpacity>
          <View style={[styles.quantityStepper, isDark && styles.quantityStepperDark]}>
            <TouchableOpacity
              style={[styles.stepperButton, count <= 0 && styles.stepperButtonDisabled]}
              onPress={() => handleAdjustQuantity(item, -1)}
              disabled={count <= 0}
              accessibilityLabel={t('inventory.decreaseAccessibility', { name: item.name })}
            >
              <IconSymbol name="minus" size={18} color={count <= 0 ? 'rgba(125,90,80,0.35)' : iconColor} />
            </TouchableOpacity>
            <View style={[styles.stepperValue, isDark && styles.stepperValueDark]}>
              <ThemedText style={[styles.stepperValueText, low && styles.inventoryCompactQuantityLow]}>
                {count}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => handleAdjustQuantity(item, 1)}
              accessibilityLabel={t('inventory.increaseAccessibility', { name: item.name })}
            >
              <IconSymbol name="plus" size={18} color={iconColor} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.inventoryInfoButton}
            onPress={() => openProductInfo(item)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('info.accessibility', { name: item.name })}
          >
            <IconSymbol name="info.circle" size={22} color={iconColor} />
          </TouchableOpacity>
        </View>
      </LiquidGlassCard>
      </InventorySwipeRow>
    );
  };

  const renderInventoryGroups = (items: InventoryItem[]) => {
    const groups = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const category = item.category || 'other';
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }

    return Array.from(groups.entries())
      .sort(([categoryA], [categoryB]) =>
        categoryLabel(categoryA).localeCompare(categoryLabel(categoryB), SHOPPING_LOCALE_TAG)
      )
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
                  ? t('category.expand', { category: categoryLabel(category) })
                  : t('category.collapse', { category: categoryLabel(category) })
              }
            >
              <View style={styles.inventoryGroupTitleRow}>
                <IconSymbol name="shippingbox" size={16} color={PRIMARY} />
                <ThemedText style={[styles.inventoryGroupTitle, isDark && styles.inventoryGroupTitleDark]}>{categoryLabel(category)}</ThemedText>
              </View>
              <View style={styles.inventoryGroupHeaderRight}>
                <ThemedText style={styles.inventoryGroupCount}>
                  {categoryItems.length}
                  {lowCount > 0 ? ` · ${t('inventory.lowCount', { count: lowCount })}` : ''}
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

  const renderInfoRow = (label: string, value: string | null | undefined) =>
    value ? (
      <View style={styles.infoRow} key={label}>
        <ThemedText style={styles.infoRowLabel}>{label}</ThemedText>
        <ThemedText style={[styles.infoRowValue, isDark && styles.infoRowValueDark]}>{value}</ThemedText>
      </View>
    ) : null;

  const renderInfoSection = (title: string, children: React.ReactNode) => (
    <View style={styles.formSection}>
      <ThemedText style={styles.formSectionTitle}>{title}</ThemedText>
      <View style={[styles.infoSectionBody, isDark && styles.infoSectionBodyDark]}>{children}</View>
    </View>
  );

  const renderProductInfo = ({ item, details }: ProductInfoState) => {
    const basics = [
      renderInfoRow(t('info.barcode'), item.barcode ?? t('form.noBarcode')),
      renderInfoRow(t('info.category'), categoryLabel(item.category)),
      renderInfoRow(t('info.count'), String(computeInventoryCount(item))),
      renderInfoRow(t('info.package'), details?.quantity ?? inventoryPackageLabel(item)),
    ];

    if (!details) {
      return (
        <>
          {renderInfoSection(t('info.basics'), basics)}
          <ThemedText style={styles.helperText}>
            {item.barcode ? t('info.notFound') : t('info.noBarcode')}
          </ThemedText>
        </>
      );
    }

    const scores = [
      renderInfoRow(t('info.nutriScore'), details.nutriScore),
      renderInfoRow(t('info.novaGroup'), details.novaGroup ? String(details.novaGroup) : null),
      renderInfoRow(t('info.ecoScore'), details.ecoScore),
    ].filter(Boolean);
    const origin = [
      renderInfoRow(t('info.brand'), details.brand),
      renderInfoRow(t('info.servingSize'), details.servingSize),
      renderInfoRow(t('info.categories'), details.categories.join(', ') || null),
      renderInfoRow(t('info.labels'), details.labels.join(', ') || null),
      renderInfoRow(t('info.origins'), details.origins),
      renderInfoRow(t('info.manufacturingPlaces'), details.manufacturingPlaces),
      renderInfoRow(t('info.countries'), details.countries.join(', ') || null),
      renderInfoRow(t('info.stores'), details.stores.join(', ') || null),
      renderInfoRow(t('info.packaging'), details.packaging),
    ].filter(Boolean);

    return (
      <>
        {details.imageUrl ? (
          <Image
            source={{ uri: details.imageUrl }}
            style={styles.infoImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {renderInfoSection(t('info.basics'), basics)}
        {scores.length > 0 ? renderInfoSection(t('info.scores'), scores) : null}
        {origin.length > 0 ? renderInfoSection(t('info.origin'), origin) : null}
        {details.ingredientsText
          ? renderInfoSection(
              t('info.ingredients'),
              <ThemedText style={[styles.infoParagraph, isDark && styles.infoRowValueDark]}>
                {details.ingredientsText}
              </ThemedText>
            )
          : null}
        {details.allergens.length > 0 || details.traces.length > 0
          ? renderInfoSection(t('info.allergens'), [
              renderInfoRow(t('info.contains'), details.allergens.join(', ') || null),
              renderInfoRow(t('info.traces'), details.traces.join(', ') || null),
            ])
          : null}
        {details.nutrients.length > 0
          ? renderInfoSection(
              t('info.nutrients'),
              details.nutrients.map((nutrient) =>
                renderInfoRow(
                  t(NUTRIENT_LABEL_KEYS[nutrient.key] ?? nutrient.key),
                  formatNutrientValue(nutrient.value, nutrient.unit)
                )
              )
            )
          : null}
        <ThemedText style={styles.fieldFootnote}>
          {t(`info.source.${details.source}`)}
        </ThemedText>
      </>
    );
  };

  const renderScanner = () => {
    if (!cameraPermission?.granted) {
      return (
        <LiquidGlassCard style={styles.card}>
          <View style={styles.cardInner}>
            <ThemedText style={styles.sectionTitle}>{t('scan.cameraTitle')}</ThemedText>
            <ThemedText style={styles.helperText}>
              {t('scan.cameraBody')}
            </ThemedText>
            <TouchableOpacity style={styles.primaryButton} onPress={requestCameraPermission}>
              <ThemedText style={styles.primaryButtonText}>{t('scan.allowCamera')}</ThemedText>
            </TouchableOpacity>
          </View>
        </LiquidGlassCard>
      );
    }
    return (
      <View
        style={[
          styles.scannerContainer,
          Platform.OS === 'ios' && {
            marginBottom: 20 + insets.bottom + bottomTabOverflow,
          },
        ]}
      >
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
            {isResolvingScan ? t('scan.searchingProduct') : t('scan.frameHint')}
          </ThemedText>
          <TouchableOpacity
            style={[styles.torchButton, torchEnabled && styles.torchButtonActive]}
            onPress={() => setTorchEnabled((enabled) => !enabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: torchEnabled }}
            accessibilityLabel={t('scan.flashlight')}
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header
          title={t('screen.title')}
          subtitle={t('screen.subtitle')}
          showBackButton
          onBackPress={() => {
            if (backTargetRef.current === 'recipes') {
              router.dismissTo('/recipe-generator');
              return;
            }
            router.replace('/(tabs)/home');
          }}
        />

        <View style={styles.segmentRow}>
          {SECTIONS.map((entry) => (
            <TouchableOpacity
              key={entry.key}
              style={[
                styles.segment,
                isDark && styles.segmentDark,
                section === entry.key && styles.segmentActive,
              ]}
              onPress={() => {
                if (entry.key === 'cards') {
                  router.push('/loyalty-cards' as any);
                  return;
                }
                setSection(entry.key);
              }}
            >
              <IconSymbol
                name={entry.icon as any}
                size={16}
                color={section === entry.key ? '#FFFFFF' : isDark ? '#E9DDFA' : PRIMARY}
              />
              <ThemedText
                style={[
                  styles.segmentText,
                  isDark && styles.segmentTextDark,
                  section === entry.key && styles.segmentTextActive,
                ]}
              >
                {t(entry.labelKey)}
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
            {section === 'shopping' ? (
              <>
                <View style={styles.shoppingSectionHeader}>
                  <View style={styles.shoppingSectionTextBlock}>
                    <ThemedText style={styles.sectionTitle}>{t('shopping.toBuy')}</ThemedText>
                    <ThemedText
                      style={[
                        styles.shoppingSectionSubtitle,
                        isDark && styles.shoppingSectionSubtitleDark,
                      ]}
                    >
                      {t(`shopping.openCount.${openItems.length === 1 ? 'one' : 'other'}`, {
                        count: openItems.length,
                      })}
                    </ThemedText>
                  </View>
                </View>

                {openItems.length === 0 ? (
                  <LiquidGlassCard style={styles.card}>
                    <View style={styles.cardInner}>
                      <ThemedText style={styles.helperText}>
                        {selectedCategory === 'all'
                          ? t('shopping.doneEmpty')
                          : t('shopping.categoryEmpty')}
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                ) : (
                  renderShoppingGroups(openItems)
                )}

                {purchasedItems.length > 0 ? (
                  <View style={styles.shoppingPurchasedBlock}>
                    <TouchableOpacity
                      style={[
                        styles.collapsibleSectionHeader,
                        styles.shoppingPurchasedHeader,
                        isDark && styles.shoppingPurchasedHeaderDark,
                      ]}
                      onPress={togglePurchasedExpanded}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isPurchasedExpanded }}
                    >
                      <View style={styles.shoppingSectionTextBlock}>
                        <ThemedText style={styles.sectionTitle}>{t('shopping.purchased')}</ThemedText>
                      </View>
                      <View style={styles.shoppingPurchasedHeaderRight}>
                        <TouchableOpacity
                          style={[
                            styles.clearPurchasedButton,
                            isDark && styles.clearPurchasedButtonDark,
                          ]}
                          onPress={() => handleClearPurchasedItems(purchasedItems)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={t('shopping.clearPurchasedAccessibility')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IconSymbol name="trash" size={14} color="#B0625B" />
                          <ThemedText style={styles.clearPurchasedButtonText}>
                            {t('shopping.clearPurchased')}
                          </ThemedText>
                        </TouchableOpacity>
                        <IconSymbol
                          name={isPurchasedExpanded ? 'chevron.up' : 'chevron.down'}
                          size={20}
                          color={isDark ? 'rgba(240,230,220,0.7)' : 'rgba(125,90,80,0.65)'}
                        />
                      </View>
                    </TouchableOpacity>
                    {isPurchasedExpanded ? renderPurchasedDateGroups(purchasedItems) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.inventoryActionsRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.addInventoryButtonCompact]}
                    onPress={() =>
                      setEditingInventory({
                        category: 'diapers',
                        unit: DEFAULT_PIECE_UNIT,
                        current_quantity: 1,
                        reminder_enabled: true,
                      })
                    }
                  >
                    <IconSymbol name="plus" size={15} color="#FFFFFF" />
                    <ThemedText style={[styles.primaryButtonText, styles.addInventoryButtonCompactText]}>
                      {t('inventory.create')}
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
                        ? t('search.hide')
                        : t('search.show')
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
                        {t('inventory.empty')}
                      </ThemedText>
                    </View>
                  </LiquidGlassCard>
                ) : filteredInventoryItems.length === 0 ? (
                  <LiquidGlassCard style={styles.card}>
                    <View style={styles.cardInner}>
                      <ThemedText style={styles.helperText}>
                        {t('inventory.categoryEmpty')}
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

        {!isLoading && section === 'shopping' ? renderShoppingBottomDock() : null}

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
                    {t('scan.package', {
                      value: scanSheet.product.packageQuantity
                        ? formatQuantity(
                            scanSheet.product.packageQuantity,
                            scanSheet.product.unit ?? DEFAULT_PIECE_UNIT
                          )
                        : t('scan.unknownPackage'),
                    })}
                  </ThemedText>
                  <TouchableOpacity style={styles.primaryButton} onPress={handleRefillFromScan}>
                    <ThemedText style={styles.primaryButtonText}>{t('scan.refill')}</ThemedText>
                  </TouchableOpacity>
                </>
              ) : scanSheet?.mode === 'unknown' ? (
                <>
                  <ThemedText style={styles.modalTitle}>{t('scan.unknownProduct')}</ThemedText>
                  <ThemedText style={styles.helperText}>
                    {t('scan.unknownBody', { barcode: scanSheet.barcode })}
                  </ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={t('scan.productName')}
                    placeholderTextColor="rgba(125,90,80,0.5)"
                    value={unknownName}
                    onChangeText={setUnknownName}
                  />
                  <View style={styles.categoryRow}>
                    {CATEGORY_IDS.map((categoryId) => (
                      <TouchableOpacity
                        key={categoryId}
                        style={[
                          styles.categoryChip,
                          unknownCategory === categoryId && styles.categoryChipActive,
                        ]}
                        onPress={() => setUnknownCategory(categoryId)}
                      >
                        <ThemedText
                          style={[
                            styles.categoryChipText,
                            unknownCategory === categoryId && styles.categoryChipTextActive,
                          ]}
                        >
                          {categoryLabel(categoryId)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmUnknownProduct}>
                    <ThemedText style={styles.primaryButtonText}>{t('scan.saveAndRefill')}</ThemedText>
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setScanSheet(null)}>
                <ThemedText style={styles.secondaryButtonText}>{t('common.cancel')}</ThemedText>
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
                    {editingInventory?.id ? t('form.editTitle') : t('form.createTitle')}
                  </ThemedText>
                  <ThemedText style={styles.formHeaderSubtitle}>
                    {editingInventory?.id
                      ? editingInventory?.name || t('form.editSubtitle')
                      : t('form.createSubtitle')}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.formCloseButton}
                  onPress={() => setEditingInventory(null)}
                  accessibilityLabel={t('common.close')}
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
                  <ThemedText style={styles.formSectionTitle}>{t('form.product')}</ThemedText>
                  <View style={styles.fieldBlock}>
                    <ThemedText style={styles.fieldLabel}>{t('common.name')}</ThemedText>
                    <TextInput
                      style={styles.modalInput}
                      placeholder={t('form.namePlaceholder')}
                      placeholderTextColor="rgba(125,90,80,0.5)"
                      value={editingInventory?.name ?? ''}
                      onChangeText={(name) => setEditingInventory((prev) => ({ ...prev, name }))}
                    />
                  </View>
                  <View style={styles.barcodeFormRow}>
                    <View style={styles.barcodeTextBlock}>
                      <ThemedText style={styles.barcodeLabel}>{t('form.barcode')}</ThemedText>
                      <ThemedText style={styles.barcodeValue}>
                        {editingInventory?.barcode ?? t('form.noBarcode')}
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
                      accessibilityLabel={t('form.scanBarcode')}
                    >
                      <IconSymbol name="barcode.viewfinder" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.fieldBlock}>
                    <ThemedText style={styles.fieldLabel}>{t('category.label')}</ThemedText>
                    <View style={styles.categoryRow}>
                      {CATEGORY_IDS.map((categoryId) => (
                        <TouchableOpacity
                          key={categoryId}
                          style={[
                            styles.categoryChip,
                            editingInventory?.category === categoryId && styles.categoryChipActive,
                          ]}
                          onPress={() =>
                            setEditingInventory((prev) => ({ ...prev, category: categoryId }))
                          }
                        >
                          <ThemedText
                            style={[
                              styles.categoryChipText,
                              editingInventory?.category === categoryId &&
                                styles.categoryChipTextActive,
                            ]}
                          >
                            {categoryLabel(categoryId)}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.formSectionTitle}>{t('form.stock')}</ThemedText>
                  <View style={styles.fieldBlock}>
                    <ThemedText style={styles.fieldLabel}>{t('form.count')}</ThemedText>
                    <View style={[styles.quantityStepper, styles.formStepper, isDark && styles.quantityStepperDark]}>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            current_quantity: Math.max(0, Math.round(prev?.current_quantity ?? 0) - 1),
                          }))
                        }
                        accessibilityLabel={t('form.countDecrease')}
                      >
                        <IconSymbol name="minus" size={18} color={isDark ? '#C496F0' : PRIMARY} />
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.modalInput, styles.formStepperInput]}
                        keyboardType="number-pad"
                        value={String(Math.max(0, Math.round(editingInventory?.current_quantity ?? 0)))}
                        onChangeText={(value) =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            current_quantity: Math.max(0, parseInt(value.replace(/[^0-9]/g, ''), 10) || 0),
                          }))
                        }
                        selectTextOnFocus
                      />
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() =>
                          setEditingInventory((prev) => ({
                            ...prev,
                            current_quantity: Math.round(prev?.current_quantity ?? 0) + 1,
                          }))
                        }
                        accessibilityLabel={t('form.countIncrease')}
                      >
                        <IconSymbol name="plus" size={18} color={isDark ? '#C496F0' : PRIMARY} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <ThemedText style={styles.fieldFootnote}>{t('form.countFootnote')}</ThemedText>
                </View>
              </ScrollView>
              <View style={styles.formFooter}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleSaveInventoryForm}>
                  <ThemedText style={styles.primaryButtonText}>{t('common.save')}</ThemedText>
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
                      {t('common.delete')}
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Produkt-Info */}
        <Modal
          visible={productInfo !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setProductInfo(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.formHeaderRow}>
                <View style={styles.formHeaderText}>
                  <ThemedText style={styles.modalTitle}>
                    {productInfo?.details?.name ?? productInfo?.item.name ?? ''}
                  </ThemedText>
                  <ThemedText style={styles.formHeaderSubtitle}>
                    {productInfo?.details?.brand ??
                      (productInfo?.item ? categoryLabel(productInfo.item.category) : '')}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.formCloseButton}
                  onPress={() => setProductInfo(null)}
                  accessibilityLabel={t('common.close')}
                >
                  <IconSymbol name="xmark" size={15} color={PRIMARY} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {productInfo?.loading ? (
                  <View style={styles.infoLoading}>
                    <ActivityIndicator color={PRIMARY} />
                    <ThemedText style={styles.helperText}>{t('info.loading')}</ThemedText>
                  </View>
                ) : productInfo ? (
                  renderProductInfo(productInfo)
                ) : null}
              </ScrollView>
            </View>
          </View>
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
                  ? t('scan.searchingItem')
                  : t('scan.purchaseHint')}
              </ThemedText>
              <TouchableOpacity
                style={[styles.purchaseScanClose, { bottom: insets.bottom + 28 }]}
                onPress={() => setPurchaseScanVisible(false)}
              >
                <ThemedText style={styles.purchaseScanCloseText}>{t('common.done')}</ThemedText>
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
                {t('scan.inventoryHint')}
              </ThemedText>
              <TouchableOpacity
                style={[styles.purchaseScanClose, { bottom: insets.bottom + 28 }]}
                onPress={() => setInventoryBarcodeScanVisible(false)}
              >
                <ThemedText style={styles.purchaseScanCloseText}>{t('common.cancel')}</ThemedText>
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
  shoppingBottomDock: { flexShrink: 0 },
  shoppingBottomDockSurface: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'rgba(250,245,244,0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(125,90,80,0.08)',
  },
  shoppingBottomDockSurfaceDark: {
    backgroundColor: 'rgba(20,16,34,0.94)',
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
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
  segmentDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  segmentActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  segmentText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  segmentTextDark: { color: '#E9DDFA' },
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
  addButtonDark: {
    backgroundColor: 'rgba(74,38,100,0.48)',
    borderColor: 'rgba(233,213,255,0.42)',
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
  shoppingSectionSubtitleDark: { color: 'rgba(240,230,220,0.68)' },
  shoppingGroupCard: {
    borderRadius: SHOPPING_CARD_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  shoppingGroupCardDark: {
    backgroundColor: 'rgba(18,15,22,0.52)',
  },
  shoppingGroupCardPurchased: {
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  shoppingGroupCardPurchasedDark: {
    backgroundColor: 'rgba(18,15,22,0.38)',
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
  shoppingRowDark: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shoppingRowPurchased: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  shoppingRowPurchasedDark: {
    backgroundColor: 'rgba(255,255,255,0.04)',
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
  shoppingTitleDark: { color: '#F5EFEA' },
  shoppingTitlePurchased: { textDecorationLine: 'line-through', opacity: 0.5 },
  shoppingMeta: { fontSize: 12, opacity: 0.6 },
  shoppingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shoppingSourcePill: {
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  shoppingSourceText: { fontSize: 12, fontWeight: '700', color: 'rgba(125,90,80,0.62)' },
  shoppingSourceTextDark: { color: 'rgba(240,230,220,0.62)' },
  shoppingNoteText: { flex: 1, fontSize: 12, color: 'rgba(125,90,80,0.62)' },
  shoppingNoteTextDark: { color: 'rgba(240,230,220,0.62)' },
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
  shoppingQuantityTextDark: { color: 'rgba(245,239,234,0.86)' },
  shoppingGroup: { gap: 9, padding: 12 },
  shoppingGroupHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  shoppingGroupTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#5F463A' },
  shoppingGroupTitleDark: { color: '#F0E6DC' },
  shoppingGroupCount: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(125,90,80,0.56)',
    fontVariant: ['tabular-nums'],
  },
  shoppingGroupCountDark: { color: 'rgba(240,230,220,0.6)' },
  shoppingGroupList: { gap: 7 },
  shoppingTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shoppingTile: {
    width: '48%',
    minHeight: 148,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.09)',
    overflow: 'hidden',
  },
  shoppingTileDark: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shoppingTilePurchased: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  shoppingTilePurchasedDark: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  shoppingTileMain: {
    flex: 1,
    gap: 6,
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 42,
  },
  shoppingTileTopRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  shoppingTileQuantity: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(95,70,58,0.82)',
    fontVariant: ['tabular-nums'],
  },
  shoppingTileTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    color: '#3A2E20',
  },
  shoppingTileTitleDark: { color: '#F5EFEA' },
  shoppingTileNote: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(125,90,80,0.62)',
  },
  shoppingTileNoteDark: { color: 'rgba(240,230,220,0.62)' },
  shoppingTileDeleteButton: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(176,98,91,0.08)',
  },
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
  shoppingPurchasedHeaderDark: {
    backgroundColor: 'rgba(18,15,22,0.44)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shoppingPurchasedHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearPurchasedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(176,98,91,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(176,98,91,0.18)',
  },
  clearPurchasedButtonDark: {
    backgroundColor: 'rgba(176,98,91,0.20)',
    borderColor: 'rgba(176,98,91,0.34)',
  },
  clearPurchasedButtonText: { fontSize: 13, fontWeight: '700', color: '#B0625B' },
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
  inventoryGroupTitleDark: { color: '#F0E6DC' },
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
  inventorySwipeDelete: {
    width: 88,
    marginLeft: 8,
    borderRadius: INVENTORY_CARD_RADIUS,
    backgroundColor: '#C4453A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  inventorySwipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  inventorySwipeAdd: {
    width: 104,
    marginRight: 8,
    borderRadius: INVENTORY_CARD_RADIUS,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  inventorySwipeAddDone: { backgroundColor: '#5E9E6B' },
  inventoryInfoButton: { paddingLeft: 4, paddingVertical: 4 },
  formStepper: { alignSelf: 'flex-start' },
  formStepperInput: {
    width: 72,
    textAlign: 'center',
    paddingVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  infoLoading: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  infoImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  infoSectionBody: {
    borderRadius: 12,
    backgroundColor: 'rgba(125,90,80,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoSectionBodyDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 7,
  },
  infoRowLabel: { fontSize: 13, opacity: 0.65, flexShrink: 0 },
  infoRowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A2E20',
    flex: 1,
    textAlign: 'right',
  },
  infoRowValueDark: { color: '#F5EFEA' },
  infoParagraph: { fontSize: 13, lineHeight: 19, paddingVertical: 8, color: '#3A2E20' },
  inventoryCardDark: {
    backgroundColor: 'rgba(18,15,22,0.52)',
  },
  inventoryCardLow: {
    backgroundColor: 'rgba(255,247,242,0.78)',
  },
  inventoryCardLowDark: {
    backgroundColor: 'rgba(58,26,24,0.60)',
  },
  inventoryCardExpanded: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  inventoryCardExpandedDark: {
    backgroundColor: 'rgba(24,20,28,0.66)',
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
  inventoryNameDark: { color: '#F5EFEA' },
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
  inventoryCompactMetaDark: { color: 'rgba(240,230,220,0.62)' },
  inventoryDetails: {
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(125,90,80,0.10)',
  },
  inventoryDetailsDark: { borderTopColor: 'rgba(255,255,255,0.12)' },
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
  inventoryHeroTileDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
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
  packageProgressTrackDark: { backgroundColor: 'rgba(255,255,255,0.14)' },
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
  quantityStepperDark: { backgroundColor: 'rgba(255,255,255,0.10)' },
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
  stepperValueDark: { borderColor: 'rgba(255,255,255,0.16)' },
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
  inventoryActionButtonDark: { backgroundColor: 'rgba(255,255,255,0.10)' },
  inventoryActionPrimary: { backgroundColor: PRIMARY },
  inventoryActionOnList: {
    backgroundColor: 'rgba(142,78,198,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.20)',
  },
  inventoryActionText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  inventoryActionTextDark: { color: '#C496F0' },
  inventoryActionPrimaryText: { color: '#FFFFFF' },
  levelControlBlock: { gap: 8 },
  levelOptionsRow: { flexDirection: 'row', gap: 6 },
  levelOptionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.12)',
  },
  levelOptionButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  levelOptionButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  levelOptionButtonEmpty: {
    backgroundColor: '#C4453A',
    borderColor: '#C4453A',
  },
  levelOptionValue: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  levelOptionValueDark: { color: '#C496F0' },
  levelOptionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(125,90,80,0.72)' },
  levelOptionLabelDark: { color: 'rgba(240,230,220,0.72)' },
  levelOptionValueActive: { color: '#FFFFFF' },
  levelEmptyHint: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(142,78,198,0.08)',
  },
  levelEmptyHintText: { flex: 1, fontSize: 12, fontWeight: '600', color: PRIMARY },
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
  suggestionRowDark: { backgroundColor: 'rgba(255,255,255,0.09)' },
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
  filterChipDark: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(142,78,198,0.12)',
    borderColor: 'rgba(142,78,198,0.24)',
  },
  filterChipActiveDark: {
    backgroundColor: 'rgba(142,78,198,0.32)',
    borderColor: 'rgba(196,150,240,0.48)',
  },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#7A4AA6', fontVariant: ['tabular-nums'] },
  filterChipTextDark: { color: '#D9C2F5' },
  filterChipTextActive: { color: PRIMARY },
  filterChipTextActiveDark: { color: '#FFFFFF' },
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
  switchRowDark: { backgroundColor: 'rgba(255,255,255,0.09)' },
  switchTextBlock: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 14, fontWeight: '700' },
  switchSubtitle: { fontSize: 12, opacity: 0.65, fontVariant: ['tabular-nums'] },
  inventoryActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addInventoryButtonCompact: { flexDirection: 'row', gap: 6, flex: 1, height: 40, marginTop: 0 },
  addInventoryButtonCompactText: { fontSize: 14 },
  shoppingViewToggle: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 2,
    borderRadius: 13,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(125,90,80,0.14)',
  },
  shoppingViewOption: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  shoppingViewOptionActive: { backgroundColor: PRIMARY },
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
  trackingModeRow: { flexDirection: 'row', gap: 8 },
  trackingModeButton: {
    flex: 1,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(142,78,198,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.12)',
  },
  trackingModeButtonActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  trackingModeTextBlock: { flex: 1, gap: 2 },
  trackingModeTitle: { fontSize: 12, fontWeight: '800', color: PRIMARY },
  trackingModeSubtitle: { fontSize: 10, lineHeight: 13, color: 'rgba(125,90,80,0.65)' },
  trackingModeTextActive: { color: '#FFFFFF' },
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
