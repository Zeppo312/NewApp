import TextInputOverlay from '@/components/modals/TextInputOverlay';
import DateTimePicker,{ DateTimePickerEvent } from '@/components/ui/DateTimePicker';
import { FormField,FormSheet } from '@/components/ui/form-sheet';
import { Colors,FormColors } from '@/constants/Colors';
import { TYPOGRAPHY } from '@/constants/Typography';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useActivityDraft } from '@/hooks/useActivityDraft';
import { useColorScheme } from '@/hooks/useColorScheme';
import { type ActivitySaveOutcome } from '@/lib/activityDrafts';
import { DailyTranslationKey,getDailyLocaleTag,translateDailyText } from '@/lib/dailyTranslations';
import { isBeforeHistoryCutoff,useFeatureAccess,useHistoryCutoff } from '@/lib/entitlements';
import { localHealthAllowed,localHealthGeneration } from '@/lib/localHealthStorage';
import { backendHost } from '@/lib/localReadSnapshots';
import { offlineText } from '@/lib/offlineTranslations';
import { fetchRecipes,RecipeRecord } from '@/lib/recipes';
import { getSampleRecipeImage,RECIPE_SAMPLES } from '@/lib/recipes-samples';
import { saveErrorMessage } from '@/lib/saveErrorMessage';
import {
computeTotalQuantity,
fetchDiaperInventoryItems,
fetchFormulaInventoryItems,
InventoryItem,
} from '@/lib/shopping';
import { getBabyCareEntriesForDate } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React,{ useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
Alert,
Image,
Keyboard,
LayoutAnimation,
Platform,
StyleSheet,
Text,
TextInputProps,
TouchableOpacity,
TouchableWithoutFeedback,
useWindowDimensions,
View
} from 'react-native';

// Typ-Definitionen
type ActivityType = 'feeding' | 'diaper' | 'other';
type FeedingType = 'breast' | 'bottle' | 'solids' | 'pump' | 'water';
type DiaperType = 'wet' | 'dirty' | 'both';
type BreastSide = 'left' | 'right' | 'both';
type FocusField = 'notes' | 'diaper_temperature_c' | 'diaper_suppository_dose_mg';
type FocusConfig = {
  field: FocusField;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  inputMode?: TextInputProps['inputMode'];
};

// Props-Interface
interface ActivityInputModalProps {
  visible: boolean;
  activityType: ActivityType;
  initialSubType?: string | null;
  hiddenSubTypes?: string[];
  restricted?: boolean;
  saving?: boolean;
  draftEnabled?: boolean;
  date?: Date;
  forceDarkMode?: boolean;
  onClose: () => void;
  onSave: (data: any, options?: { startTimer?: boolean; draftManaged?: boolean }) => void | ActivitySaveOutcome | Promise<void | ActivitySaveOutcome>; // data ist DB-ready für baby_care_entries
  onDelete?: (id: string) => void; // Optional: Nur wenn ein Eintrag bearbeitet wird
  initialData?: Partial<{
    id: string;
    feeding_type: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'PUMP' | 'WATER';
    feeding_volume_ml: number | null;
    feeding_side: 'LEFT' | 'RIGHT' | 'BOTH' | null;
    diaper_type: 'WET' | 'DIRTY' | 'BOTH' | null;
    diaper_fever_measured: boolean | null;
    diaper_temperature_c: number | null;
    diaper_suppository_given: boolean | null;
    diaper_suppository_dose_mg: number | null;
    notes: string | null;
    start_time: string;
    end_time: string | null;
  }>;
}

const FixedEmojiText: React.FC<React.ComponentProps<typeof Text>> = ({ style, children, ...rest }) => (
  <Text {...rest} allowFontScaling={false} style={style}>
    {children}
  </Text>
);

const toDecimalValue = (raw: string): number | null => {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInt = (raw: string): number | null => {
  const normalized = raw.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const formatTempInput = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return String(value).replace('.', ',');
};

const formatIntInput = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return String(Math.trunc(value));
};

const MIN_VALID_MANUAL_DATE = new Date(2000, 0, 1);
const MAX_VALID_MANUAL_DATE = new Date(2100, 11, 31, 23, 59, 59, 999);

const ActivityInputModal: React.FC<ActivityInputModalProps> = ({
  visible,
  activityType,
  initialSubType,
  hiddenSubTypes = [],
  restricted = false,
  saving = false,
  draftEnabled = false,
  date,
  forceDarkMode,
  onClose,
  onSave,
  onDelete,
  initialData,
}) => {
  const router = useRouter();

  const { width, fontScale } = useWindowDimensions();
  const useWideOptions = width < 360 || fontScale > 1.2;
  const { locale } = useLocale();
  const { user } = useAuth();
  const ot = (key: Parameters<typeof offlineText>[1], values?: Record<string, string | number>) => offlineText(locale, key, values);
  const recipesAccess = useFeatureAccess('recipes').hasAccess;
  const t = useCallback((key: DailyTranslationKey) => translateDailyText(locale, key), [locale]);
  const localeTag = getDailyLocaleTag(locale);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = forceDarkMode ?? (colorScheme === 'dark');

  // Theme und Farben - angepasst für Dark Mode
  const baseTheme = isDark ? {
    background: Colors.dark.background,
    modalBackground: 'rgba(45, 37, 34, 0.98)', // Dark background
    text: Colors.dark.text, // Light text for contrast
    textSecondary: Colors.dark.textTertiary, // Lighter gray for subtitles
    primary: '#4A90E2', // Solid blue for selected bottle
    accent: '#E5B9A0',  // Warm orange for save button
    lightGray: 'rgba(255, 255, 255, 0.08)', // Dark gray for unselected buttons
    mediumGray: 'rgba(80, 80, 80, 0.5)',
    green: '#38A169', // Solid green for BOTH
    orange: '#F5A623', // Orange for Beikost
    purple: '#9B59B6', // Solid purple
  } : {
    background: '#F4F1ED',
    modalBackground: 'rgba(255, 255, 255, 0.95)', // Brighter background
    text: '#333333', // Dark text for contrast
    textSecondary: '#888888', // Lighter gray for subtitles
    primary: '#4A90E2', // Solid blue for selected bottle
    accent: '#E5B9A0',  // Warm orange for save button
    lightGray: 'rgba(255, 255, 255, 0.64)', // Light gray for unselected buttons
    mediumGray: 'rgba(220, 220, 220, 0.5)',
    green: '#38A169', // Solid green for BOTH
    orange: '#F5A623', // Orange for Beikost
    purple: '#9B59B6', // Solid purple
  };
  const formPalette = FormColors[isDark ? 'dark' : 'light'];
  const theme = { ...baseTheme, text: formPalette.text, textSecondary: formPalette.secondary, lightGray: formPalette.field, mediumGray: formPalette.border };

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saveInFlightRef = useRef(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [isEndTimeVisible, setEndTimeVisible] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startPickerDraft, setStartPickerDraft] = useState(new Date());
  const [endPickerDraft, setEndPickerDraft] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [isNotesVisible, setNotesVisible] = useState(false);
  const [focusConfig, setFocusConfig] = useState<FocusConfig | null>(null);
  const [focusValue, setFocusValue] = useState('');
  const [startTimer, setStartTimer] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeDropdownOpen, setRecipeDropdownOpen] = useState(false);
  const [recipeOptions, setRecipeOptions] = useState<
    { id: string; title: string; minMonths?: number; image?: string | null; emoji?: string; source: 'live' | 'sample' }[]
  >(RECIPE_SAMPLES.map((r) => ({ id: r.id, title: r.title, minMonths: r.min_months, image: r.image, emoji: r.emoji, source: 'sample' })));
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const initKeyRef = useRef<string | null>(null);

  // Feeding States
  const [feedingType, setFeedingType] = useState<FeedingType>('bottle');
  const [volumeMl, setVolumeMl] = useState(120);
  const [breastSide, setBreastSide] = useState<BreastSide>('left');

  // Diaper States
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');
  const { activeBabyId, activeBaby } = useActiveBaby();
  const [diaperInventoryItems, setDiaperInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedDiaperItemId, setSelectedDiaperItemId] = useState<string | null>(null);
  const [inventoryAttempt, setInventoryAttempt] = useState(0);
  const [inventoryFailed, setInventoryFailed] = useState(false);
  const [formulaInventoryItems, setFormulaInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedFormulaItemId, setSelectedFormulaItemId] = useState<string | null | 'none'>(null);
  const [diaperFeverMeasured, setDiaperFeverMeasured] = useState(false);
  const [diaperTemperatureC, setDiaperTemperatureC] = useState('');
  const [diaperSuppositoryGiven, setDiaperSuppositoryGiven] = useState(false);
  const [diaperSuppositoryDoseMg, setDiaperSuppositoryDoseMg] = useState('');
  const hiddenSubTypeSet = useMemo(() => new Set(hiddenSubTypes), [hiddenSubTypes]);
  const isEditingExistingEntry = !!initialData?.id;
  const standaloneSpecialEntryType =
    activityType !== 'feeding'
      ? null
      : initialSubType === 'feeding_pump'
      ? 'pump'
      : initialSubType === 'feeding_water'
      ? 'water'
      : initialData?.feeding_type === 'PUMP'
      ? 'pump'
      : initialData?.feeding_type === 'WATER'
      ? 'water'
      : null;
  const isStandaloneSpecialFlow = standaloneSpecialEntryType !== null;
  const isPumpSelection = activityType === 'feeding' && feedingType === 'pump';
  const isWaterSelection = activityType === 'feeding' && feedingType === 'water';
  const feedingOptions = useMemo(() => {
    const currentEditingType =
      initialData?.feeding_type === 'BREAST'
        ? 'breast'
        : initialData?.feeding_type === 'SOLIDS'
        ? 'solids'
        : initialData?.feeding_type === 'PUMP'
        ? 'pump'
        : initialData?.feeding_type === 'WATER'
        ? 'water'
        : initialData?.feeding_type === 'BOTTLE'
        ? 'bottle'
        : null;

    const options = [
      { type: 'breast' as const, label: t('feeding.breast'), icon: '🤱', hiddenKey: 'feeding_breast' },
      { type: 'bottle' as const, label: t('feeding.bottle'), icon: '🍼', hiddenKey: 'feeding_bottle' },
      { type: 'solids' as const, label: t('feeding.solids'), icon: '🥄', hiddenKey: 'feeding_solids' },
      { type: 'pump' as const, label: t('feeding.pump'), icon: '🥛', hiddenKey: 'feeding_pump' },
      { type: 'water' as const, label: t('feeding.water'), icon: '🚰', hiddenKey: 'feeding_water' },
    ];

    const visibleOptions = isStandaloneSpecialFlow
      ? options.filter((option) => option.type === standaloneSpecialEntryType)
      : options.filter((option) => option.type !== 'pump' && option.type !== 'water');

    return visibleOptions.filter(
      (option) => !hiddenSubTypeSet.has(option.hiddenKey) || (isEditingExistingEntry && currentEditingType === option.type)
    );
  }, [hiddenSubTypeSet, initialData?.feeding_type, isEditingExistingEntry, isStandaloneSpecialFlow, standaloneSpecialEntryType, t]);
  const diaperOptions = useMemo(() => {
    const currentEditingType =
      initialData?.diaper_type === 'DIRTY'
        ? 'dirty'
        : initialData?.diaper_type === 'BOTH'
        ? 'both'
        : initialData?.diaper_type === 'WET'
        ? 'wet'
        : null;

    return [
      { type: 'wet' as const, label: t('diaper.wet'), icon: '💧', hiddenKey: 'diaper_wet' },
      { type: 'dirty' as const, label: t('diaper.dirty'), icon: '💩', hiddenKey: 'diaper_dirty' },
      { type: 'both' as const, label: t('diaper.both'), icon: '💧💩', hiddenKey: 'diaper_both' },
    ].filter((option) => !hiddenSubTypeSet.has(option.hiddenKey) || (isEditingExistingEntry && currentEditingType === option.type));
  }, [hiddenSubTypeSet, initialData?.diaper_type, isEditingExistingEntry, t]);

  const isFiniteManualDate = useCallback((value: unknown): value is Date => {
    return value instanceof Date && Number.isFinite(value.getTime());
  }, []);

  const isValidManualDate = useCallback((value: unknown): boolean => {
    if (!isFiniteManualDate(value)) return false;
    const timestamp = value.getTime();
    return timestamp >= MIN_VALID_MANUAL_DATE.getTime()
      && timestamp <= MAX_VALID_MANUAL_DATE.getTime()
      && value.getFullYear() >= 2000;
  }, [isFiniteManualDate]);

  const sanitizeManualDate = useCallback(
    (value?: Date | null, fallback?: Date) => {
      const safeFallback =
        fallback && isValidManualDate(fallback) ? new Date(fallback.getTime()) : new Date();

      if (!isFiniteManualDate(value)) return safeFallback;
      if (isValidManualDate(value)) return new Date(value.getTime());

      if (value.getTime() <= 0 || value.getFullYear() < 2000) {
        const patched = new Date(safeFallback.getTime());
        patched.setHours(
          value.getHours(),
          value.getMinutes(),
          value.getSeconds(),
          value.getMilliseconds()
        );
        if (isValidManualDate(patched)) return patched;
      }

      return safeFallback;
    },
    [isFiniteManualDate, isValidManualDate]
  );

  const getSafePickerDateFromEvent = useCallback(
    (event: DateTimePickerEvent, date: Date | undefined, fallback?: Date) => {
      const safeFallback = sanitizeManualDate(fallback, new Date());

      if (date) {
        const fromDate = sanitizeManualDate(date, safeFallback);
        if (isValidManualDate(fromDate)) return fromDate;
      }

      const nativeTimestamp = event.nativeEvent?.timestamp;
      if (typeof nativeTimestamp === 'number' && Number.isFinite(nativeTimestamp)) {
        const fromTimestamp = sanitizeManualDate(new Date(nativeTimestamp), safeFallback);
        if (isValidManualDate(fromTimestamp)) return fromTimestamp;
      }

      return safeFallback;
    },
    [isValidManualDate, sanitizeManualDate]
  );

  // Effekt zum Zurücksetzen der Werte bei Sichtbarkeit
  // Only initialize on open or target change to avoid resetting user edits.
  useEffect(() => {
    if (!visible) {
      initKeyRef.current = null;
      return;
    }

    const initKey = `${user?.id}:${activeBabyId}:${activityType}:${initialData?.id ?? 'new'}:${initialSubType ?? ''}`;
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;

    const safeParsed = (iso: string | null | undefined): Date | null => {
      if (!iso) return null;
      const d = new Date(iso);
      return Number.isFinite(d.getTime()) ? d : null;
    };

    const now = sanitizeManualDate(date, new Date());
    const parsedStart = safeParsed(initialData?.start_time);
    const nextStartTime = sanitizeManualDate(parsedStart ?? now, now);
    setStartTime(nextStartTime);
    const parsedEnd = safeParsed(initialData?.end_time);
    const nextEndTime = parsedEnd ? sanitizeManualDate(parsedEnd, nextStartTime) : null;
    setEndTime(nextEndTime);
    setStartPickerDraft(nextStartTime);
    setEndPickerDraft(nextEndTime ?? nextStartTime);
    setShowStartPicker(false);
    setShowEndPicker(false);
    setEndTimeVisible(!!initialData?.end_time);
    setNotes(initialData?.notes ?? '');
    setNotesVisible(false);
    setFocusConfig(null);
    setFocusValue('');
    setStartTimer(false);
    setSelectedRecipeId(null);
    setRecipeDropdownOpen(false);

    // Standardwerte setzen
    if (activityType === 'feeding') {
      const preferredFeedingType =
        initialSubType === 'feeding_breast'
          ? 'breast'
        : initialSubType === 'feeding_solids'
          ? 'solids'
        : initialSubType === 'feeding_pump'
          ? 'pump'
        : initialSubType === 'feeding_water'
          ? 'water'
        : initialSubType === 'feeding_bottle'
          ? 'bottle'
        : initialData?.feeding_type === 'BREAST'
          ? 'breast'
        : initialData?.feeding_type === 'SOLIDS'
          ? 'solids'
        : initialData?.feeding_type === 'PUMP'
          ? 'pump'
        : initialData?.feeding_type === 'WATER'
          ? 'water'
        : 'bottle';
      const fallbackFeedingType = feedingOptions[0]?.type ?? preferredFeedingType;
      setFeedingType(
        feedingOptions.some((option) => option.type === preferredFeedingType)
          ? preferredFeedingType
          : fallbackFeedingType
      );
      setVolumeMl(initialData?.feeding_volume_ml ?? 120);
      setBreastSide(
        initialData?.feeding_side === 'RIGHT' ? 'right' : initialData?.feeding_side === 'BOTH' ? 'both' : 'left'
      );
      setDiaperFeverMeasured(false);
      setDiaperTemperatureC('');
      setDiaperSuppositoryGiven(false);
      setDiaperSuppositoryDoseMg('');
    } else if (activityType === 'diaper') {
      const hasTemp = typeof initialData?.diaper_temperature_c === 'number' && Number.isFinite(initialData.diaper_temperature_c);
      const hasDose =
        typeof initialData?.diaper_suppository_dose_mg === 'number' && Number.isFinite(initialData.diaper_suppository_dose_mg);
      const preferredDiaperType =
        initialData?.diaper_type === 'DIRTY' ? 'dirty' : initialData?.diaper_type === 'BOTH' ? 'both' : 'wet';
      const fallbackDiaperType = diaperOptions[0]?.type ?? preferredDiaperType;
      setDiaperType(
        diaperOptions.some((option) => option.type === preferredDiaperType)
          ? preferredDiaperType
          : fallbackDiaperType
      );
      setDiaperFeverMeasured(initialData?.diaper_fever_measured === true || hasTemp);
      setDiaperTemperatureC(formatTempInput(initialData?.diaper_temperature_c));
      setDiaperSuppositoryGiven(initialData?.diaper_suppository_given === true || hasDose);
      setDiaperSuppositoryDoseMg(formatIntInput(initialData?.diaper_suppository_dose_mg));
    } else {
      setDiaperFeverMeasured(false);
      setDiaperTemperatureC('');
      setDiaperSuppositoryGiven(false);
      setDiaperSuppositoryDoseMg('');
    }

    // Hier könnten initialSubType ausgewertet werden
  }, [visible, user?.id, activeBabyId, initialSubType, date, initialData, activityType, sanitizeManualDate, feedingOptions, diaperOptions]);

  const draftKind = activityType === 'diaper' ? 'diaper' : 'bottle';
  const canDraft = draftEnabled && visible && !restricted && !initialData?.id && !!user?.id && !!activeBabyId && !startTimer
    && (activityType === 'diaper' || activityType === 'feeding' && feedingType === 'bottle');
  const [reviewEntries, setReviewEntries] = useState<any[] | null>(null);
  const historyCutoff = useHistoryCutoff();
  const historyCutoffRef = useRef(historyCutoff); historyCutoffRef.current = historyCutoff;
  const draftScope = { backendHost: backendHost(), userId: user?.id ?? '', babyId: activeBabyId };
  const draftSessionKey = `${draftScope.userId}:${activeBabyId}:${draftKind}`;
  const draftSessionRef = useRef(draftSessionKey); draftSessionRef.current = draftSessionKey;
  const draftValues = {
    startTime: startTime.toISOString(), endTime: endTime?.toISOString() ?? null, isEndTimeVisible,
    notes: focusConfig?.field === 'notes' ? focusValue : notes, volumeMl, diaperType,
    selectedDiaperItemId, selectedFormulaItemId, diaperFeverMeasured,
    diaperTemperatureC: focusConfig?.field === 'diaper_temperature_c' ? focusValue : diaperTemperatureC,
    diaperSuppositoryGiven, diaperSuppositoryDoseMg: focusConfig?.field === 'diaper_suppository_dose_mg' ? focusValue : diaperSuppositoryDoseMg,
  };
  const draft = useActivityDraft({ enabled: canDraft, scope: draftScope, kind: draftKind, values: draftValues, restore: v => {
    setStartTime(new Date(v.startTime)); setEndTime(v.endTime ? new Date(v.endTime) : null); setEndTimeVisible(v.isEndTimeVisible);
    setNotes(v.notes); setVolumeMl(v.volumeMl); setDiaperType(v.diaperType);
    setSelectedDiaperItemId(v.selectedDiaperItemId); setSelectedFormulaItemId(v.selectedFormulaItemId);
    setDiaperFeverMeasured(v.diaperFeverMeasured); setDiaperTemperatureC(v.diaperTemperatureC);
    setDiaperSuppositoryGiven(v.diaperSuppositoryGiven); setDiaperSuppositoryDoseMg(v.diaperSuppositoryDoseMg);
  } });
  const closeModal = async () => { try { if (canDraft) await draft.flush(); } catch {} onClose(); };
  const inspectHistory = async () => {
    const key = draftSessionKey; const generation = localHealthGeneration();
    const original = draft.draft?.values.startTime ?? startTime.toISOString();
    if (isBeforeHistoryCutoff(new Date(original),historyCutoffRef.current)) { setReviewEntries(null); Alert.alert(ot('checkHistory'),ot('blocked')); return; }
    const result = await getBabyCareEntriesForDate(new Date(original), activeBabyId ?? undefined);
    if (draftSessionRef.current !== key || !localHealthAllowed(draftScope.userId, generation) || isBeforeHistoryCutoff(new Date(original),historyCutoffRef.current)) return;
    if (result.error) { setReviewEntries(null); Alert.alert(ot('checkHistory'), ot('blocked')); return; }
    setReviewEntries(result.data ?? []);
  };
  useEffect(() => { setReviewEntries(null); }, [visible, draftSessionKey, historyCutoff?.getTime()]);

  // Windel-Vorräte laden, damit bei mehreren Posten optional gewählt werden
  // kann, welche Windel abgebucht wird (nur bei neuen Einträgen).
  useEffect(() => {
    if (restricted || !visible || activityType !== 'diaper' || initialData?.id || !activeBabyId) {
      setDiaperInventoryItems([]);
      setSelectedDiaperItemId(null);
      return;
    }
    let cancelled = false;
    setInventoryFailed(false);
    fetchDiaperInventoryItems().then(({ data, error }) => {
      if (!cancelled) {
        if (error) { setInventoryFailed(true); return; }
        setDiaperInventoryItems(data);
      }
    }).catch(() => { if (!cancelled) setInventoryFailed(true); });
    return () => { cancelled = true; };
  }, [restricted, visible, activityType, initialData?.id, activeBabyId, user?.id, inventoryAttempt]);

  // Milchpulver-Vorräte (mit hinterlegter Dosierung) für Fläschchen-Einträge.
  useEffect(() => {
    if (restricted || !visible || activityType !== 'feeding' || initialData?.id || !activeBabyId) {
      setFormulaInventoryItems([]);
      setSelectedFormulaItemId(null);
      return;
    }
    let cancelled = false;
    setInventoryFailed(false);
    fetchFormulaInventoryItems().then(({ data, error }) => {
      if (!cancelled) {
        if (error) { setInventoryFailed(true); return; }
        setFormulaInventoryItems(
          data.filter(
            (item) => item.dosage_grams_per_100ml !== null && item.dosage_grams_per_100ml > 0
          )
        );
      }
    }).catch(() => { if (!cancelled) setInventoryFailed(true); });
    return () => { cancelled = true; };
  }, [restricted, visible, activityType, initialData?.id, activeBabyId, user?.id, inventoryAttempt]);

  // Rezepte laden (Supabase), fallback auf Samples
  useEffect(() => {
    const loadRecipes = async () => {
      if (restricted || !(visible && activityType === 'feeding' && feedingType === 'solids' && recipesAccess === true)) return;
      try {
        setIsLoadingRecipes(true);
        const { data, error } = await fetchRecipes();
        if (!error && data && data.length > 0) {
          const mapped = data.map((r: RecipeRecord) => ({
            id: r.id,
            title: r.title,
            minMonths: r.min_months,
            image: r.image_url ?? getSampleRecipeImage(r.title),
            emoji: '🥄',
            source: 'live' as const,
          }));
          setRecipeOptions(mapped);
        } else {
          // Fallback auf Samples
          setRecipeOptions(RECIPE_SAMPLES.map((r) => ({ id: r.id, title: r.title, minMonths: r.min_months, image: r.image, emoji: r.emoji, source: 'sample' })));
        }
      } finally {
        setIsLoadingRecipes(false);
      }
    };
    loadRecipes();
  }, [restricted, visible, activityType, feedingType, recipesAccess]);

  useEffect(() => {
    if (feedingType === 'pump' || feedingType === 'water') {
      setStartTimer(false);
    }
  }, [feedingType]);

  // Speichern: Payload für baby_care_entries
  const handleSave = async (unsafe = false) => {
    if (saving || saveInFlightRef.current) return;
    if (canDraft && (!draft.ready || draft.unknown)) return;
    if (activityType === 'feeding' && !isStandaloneSpecialFlow && feedingOptions.length === 0) {
      Alert.alert(t('input.noFeedingTitle'), t('input.noFeedingBody'));
      return;
    }

    if (activityType === 'diaper' && diaperOptions.length === 0) {
      Alert.alert(t('input.noDiaperTitle'), t('input.noDiaperBody'));
      return;
    }

    const safeStartTime = sanitizeManualDate(startTime, date ?? new Date());
    const safeEndTime = endTime ? sanitizeManualDate(endTime, safeStartTime) : null;
    const entryDateISO = safeStartTime.toISOString();
    const isDiaperEntry = activityType === 'diaper';
    const selectedRecipe = recipeOptions.find((r) => r.id === selectedRecipeId);
    const recipeTitle = selectedRecipe?.title?.trim() || (selectedRecipe ? 'BLW-Rezept' : null);
    const recipeNote = recipeTitle ? `BLW: ${recipeTitle}` : null;
    const combinedNotes = [notes?.trim(), recipeNote ?? ''].filter(Boolean).join('\n');
    const base = {
      entry_type: activityType,           // 'feeding' | 'diaper'
      start_time: entryDateISO,
      end_time: !startTimer ? (safeEndTime?.toISOString() ?? entryDateISO) : null,
      notes: combinedNotes || null,
    };

    let payload: any = base;

    if (activityType === 'feeding') {
      const feeding_type =
        feedingType === 'breast' ? 'BREAST' :
        feedingType === 'bottle' ? 'BOTTLE' :
        feedingType === 'pump' ? 'PUMP' :
        feedingType === 'water' ? 'WATER' :
        'SOLIDS';

      const feeding_side =
        feedingType === 'breast' || feedingType === 'pump'
          ? (breastSide === 'left' ? 'LEFT' : breastSide === 'right' ? 'RIGHT' : 'BOTH')
          : null;

      payload = {
        ...base,
        feeding_type,
        feeding_volume_ml: feedingType === 'bottle' || feedingType === 'pump' || feedingType === 'water' ? volumeMl : null,
        feeding_side,
        // Kein DB-Feld: steuert die Milchpulver-Abbuchung ('none' = kein Abzug).
        bottle_inventory_item_id: feedingType === 'bottle' ? selectedFormulaItemId : 'none',
      };
    } else if (activityType === 'diaper') {
      const parsedTemp = diaperFeverMeasured ? toDecimalValue(diaperTemperatureC) : null;
      const parsedDose = diaperSuppositoryGiven ? toPositiveInt(diaperSuppositoryDoseMg) : null;

      if (diaperFeverMeasured && (parsedTemp === null || parsedTemp < 30 || parsedTemp > 45)) {
        Alert.alert(t('input.invalidTemperatureTitle'), t('input.invalidTemperatureBody'));
        return;
      }

      if (diaperSuppositoryGiven && parsedDose === null) {
        Alert.alert(t('input.invalidDoseTitle'), t('input.invalidDoseBody'));
        return;
      }

      const diaper_type =
        diaperType === 'wet' ? 'WET' :
        diaperType === 'dirty' ? 'DIRTY' :
        'BOTH';

      payload = {
        ...base,
        diaper_type,
        diaper_fever_measured: diaperFeverMeasured,
        diaper_temperature_c: diaperFeverMeasured ? parsedTemp : null,
        diaper_suppository_given: diaperSuppositoryGiven,
        diaper_suppository_dose_mg: diaperSuppositoryGiven ? parsedDose : null,
        // Kein DB-Feld: wird vom Aufrufer an die Vorratsabbuchung durchgereicht.
        diaper_inventory_item_id: selectedDiaperItemId,
      };
    }
    // other: nur base + notes

    // The server validates the saved inventory ID at sync time. A failed
    // inventory read must not block a durable offline care entry.
    saveInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      if (canDraft) {
        const result = await draft.save(() => Promise.resolve(onSave(payload, { startTimer: false, draftManaged: true })), unsafe);
        if (result?.status === 'confirmed' || result?.status === 'queued') onClose();
      } else {
        const result = await onSave(payload, { startTimer: !restricted && activityType === 'feeding' ? startTimer : false });
        if (!result || result.status === 'confirmed' || result.status === 'queued') onClose();
      }
    } catch (error) {
      Alert.alert(t('common.error'), saveErrorMessage(error, locale, t('daily.saveFailed')));
    } finally {
      saveInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Löschen: Nur bei Bearbeitung verfügbar
  const handleDelete = () => {
    if (!initialData?.id || !onDelete) return;
    if (saving) return;
    onDelete(initialData.id);
    if (!restricted) onClose();
  };

  const safeModalStartTime = useMemo(
    () => sanitizeManualDate(startTime, new Date()),
    [sanitizeManualDate, startTime]
  );

  const safeModalEndTime = useMemo(() => {
    if (!endTime) return null;
    return sanitizeManualDate(endTime, safeModalStartTime);
  }, [endTime, sanitizeManualDate, safeModalStartTime]);

  const safeModalEndPickerTime = useMemo(
    () => sanitizeManualDate(endTime ?? safeModalStartTime, safeModalStartTime),
    [endTime, sanitizeManualDate, safeModalStartTime]
  );

  const openStartPicker = useCallback(() => {
    setShowEndPicker(false);
    if (Platform.OS === 'ios') {
      setStartPickerDraft(safeModalStartTime);
    }
    setShowStartPicker(true);
  }, [safeModalStartTime]);

  const openEndPicker = useCallback(() => {
    setShowStartPicker(false);
    if (Platform.OS === 'ios') {
      setEndPickerDraft(safeModalEndPickerTime);
    }
    setShowEndPicker(true);
  }, [safeModalEndPickerTime]);

  const applyStartPickerValue = useCallback((nextStartValue: Date) => {
    const nextStart = sanitizeManualDate(nextStartValue, safeModalStartTime);
    setStartTime(nextStart);
    setEndTime((prevEnd) => {
      if (!prevEnd) return null;
      const safePrevEnd = sanitizeManualDate(prevEnd, nextStart);
      return safePrevEnd.getTime() <= nextStart.getTime() ? null : safePrevEnd;
    });
  }, [safeModalStartTime, sanitizeManualDate]);

  const applyEndPickerValue = useCallback((nextEndValue: Date) => {
    const baseEnd = endTime ? sanitizeManualDate(endTime, safeModalStartTime) : safeModalStartTime;
    const nextEnd = sanitizeManualDate(nextEndValue, baseEnd);
    setEndTime(nextEnd);
  }, [endTime, safeModalStartTime, sanitizeManualDate]);

  const commitStartPickerDraft = useCallback(() => {
    const currentMinute = Math.floor(safeModalStartTime.getTime() / 60000);
    const draftMinute = Math.floor(startPickerDraft.getTime() / 60000);
    if (currentMinute !== draftMinute) {
      applyStartPickerValue(startPickerDraft);
    }
  }, [applyStartPickerValue, safeModalStartTime, startPickerDraft]);

  const commitEndPickerDraft = useCallback(() => {
    const currentMinute = Math.floor(safeModalEndPickerTime.getTime() / 60000);
    const draftMinute = Math.floor(endPickerDraft.getTime() / 60000);
    if (currentMinute !== draftMinute) {
      applyEndPickerValue(endPickerDraft);
    }
  }, [applyEndPickerValue, endPickerDraft, safeModalEndPickerTime]);

  const renderTimeSection = () => {
    const showEndTime = activityType !== 'diaper';
    const pickerInlineBg = isDark ? 'rgba(20, 20, 24, 0.95)' : 'rgba(255, 255, 255, 0.9)';
    const pickerInlineBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';

    return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        <FixedEmojiText style={styles.sectionTitleEmoji}>⏰</FixedEmojiText>{' '}
        {showEndTime ? t('input.period') : t('input.time')}
      </Text>

      <View style={[styles.timeRow, !showEndTime && styles.timeRowSingle]}> 
        <FormField isDark={isDark} onPress={openStartPicker}
    label={t('input.start')} value={safeModalStartTime.toLocaleString(localeTag, {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })}
     style={{flex:1}}  />

        {showEndTime && (
          <FormField isDark={isDark} onPress={() => {
              if (startTimer) return;
              setEndTimeVisible(true);
              openEndPicker();
            }}
    label={t('input.end')} value={startTimer
                ? t('input.timerRunning')
                : safeModalEndTime
                ? safeModalEndTime.toLocaleString(localeTag, {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })
                : t('input.open')}
     style={{flex:1}}  />
        )}
      </View>

      {Platform.OS !== 'ios' && showStartPicker && (
        <View
          style={[
            styles.datePickerContainer,
            {
              backgroundColor: pickerInlineBg,
              borderColor: pickerInlineBorder,
            },
          ]}
        >
          <DateTimePicker
            value={safeModalStartTime}
            minimumDate={MIN_VALID_MANUAL_DATE}
            maximumDate={MAX_VALID_MANUAL_DATE}
            mode="datetime"
            display="default"
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={theme.accent}
            onChange={(event, date) => {
              setShowStartPicker(false);
              if (event.type === 'dismissed') return;
              const nextStart = getSafePickerDateFromEvent(event, date, safeModalStartTime);
              applyStartPickerValue(nextStart);
            }}
            style={styles.dateTimePicker}
          />
          <View style={styles.datePickerActions}>
            <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowStartPicker(false)}>
              <Text style={styles.datePickerCancelText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showEndTime && Platform.OS !== 'ios' && showEndPicker && (
        <View
          style={[
            styles.datePickerContainer,
            {
              backgroundColor: pickerInlineBg,
              borderColor: pickerInlineBorder,
            },
          ]}
        >
          <DateTimePicker
            value={safeModalEndPickerTime}
            minimumDate={MIN_VALID_MANUAL_DATE}
            maximumDate={MAX_VALID_MANUAL_DATE}
            mode="datetime"
            display="default"
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={theme.accent}
            onChange={(event, date) => {
              setShowEndPicker(false);
              if (event.type === 'dismissed') return;
              const nextEnd = getSafePickerDateFromEvent(event, date, safeModalEndPickerTime);
              applyEndPickerValue(nextEnd);
            }}
            style={styles.dateTimePicker}
          />
          <View style={styles.datePickerActions}>
            <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowEndPicker(false)}>
              <Text style={styles.datePickerCancelText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {Platform.OS === 'ios' && showStartPicker && (
        <FormSheet
            visible={showStartPicker}
            isDark={isDark}
            title={t('input.start')}
            onClose={() => setShowStartPicker(false)}
            onCancel={() => setShowStartPicker(false)}
            confirmLabel={t('common.done')}
            onConfirm={() => {
              commitStartPickerDraft();
              setShowStartPicker(false);
            }}
            scrollable={false}
          >
            <DateTimePicker
              value={(() => {
                const d = sanitizeManualDate(startPickerDraft, safeModalStartTime);
                d.setSeconds(0, 0);
                return d;
              })()}
              minimumDate={MIN_VALID_MANUAL_DATE}
              maximumDate={MAX_VALID_MANUAL_DATE}
              mode="datetime"
              display="spinner"
              locale={localeTag}
              onChange={(event, d) => {
                if (event.type === 'dismissed') return;
                setStartPickerDraft((prev) => getSafePickerDateFromEvent(event, d, prev));
              }}
              accentColor={theme.accent}
              themeVariant={isDark ? 'dark' : 'light'}
              style={styles.manualPickerSpinner}
            />
          </FormSheet>
      )}

      {showEndTime && Platform.OS === 'ios' && showEndPicker && (
        <FormSheet
            visible={showEndPicker}
            isDark={isDark}
            title={t('input.end')}
            onClose={() => setShowEndPicker(false)}
            onCancel={() => setShowEndPicker(false)}
            confirmLabel={t('common.done')}
            onConfirm={() => {
              commitEndPickerDraft();
              setShowEndPicker(false);
            }}
            scrollable={false}
          >
            <DateTimePicker
              value={(() => {
                const d = sanitizeManualDate(endPickerDraft, safeModalEndPickerTime);
                d.setSeconds(0, 0);
                return d;
              })()}
              minimumDate={MIN_VALID_MANUAL_DATE}
              maximumDate={MAX_VALID_MANUAL_DATE}
              mode="datetime"
              display="spinner"
              locale={localeTag}
              onChange={(event, d) => {
                if (event.type === 'dismissed') return;
                setEndPickerDraft((prev) => getSafePickerDateFromEvent(event, d, prev));
              }}
              accentColor={theme.accent}
              themeVariant={isDark ? 'dark' : 'light'}
              style={styles.manualPickerSpinner}
            />
          </FormSheet>
      )}

      {!restricted && activityType === 'feeding' && feedingType !== 'pump' && feedingType !== 'water' && (
        <TouchableOpacity
          style={[
            styles.timerToggle,
            isDark && {
              backgroundColor: 'rgba(24, 24, 28, 0.92)',
              borderColor: 'rgba(255,255,255,0.14)',
            },
            startTimer && styles.timerToggleActive,
          ]}
          onPress={() => {
            setStartTimer((prev) => {
              const next = !prev;
              if (next) {
                setEndTime(null);
                setEndTimeVisible(false);
                setShowEndPicker(false);
                setEndPickerDraft(safeModalStartTime);
              }
              return next;
            });
          }}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.timerTogglePill,
              isDark && { backgroundColor: 'rgba(255,255,255,0.22)' },
              startTimer && styles.timerTogglePillActive,
            ]}
          >
            <View style={[styles.timerToggleKnob, startTimer && styles.timerToggleKnobActive]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.timerToggleLabel, { color: theme.text }]}>
              {t('input.timerOptional')}
            </Text>
            <Text style={[styles.timerToggleSub, { color: theme.textSecondary }]}>
              {startTimer ? t('input.runningUntilStop') : t('input.saveWithoutTimer')}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
    );
  };

  const getButtonColor = (type: FeedingType) => {
    switch (type) {
      case 'breast': return theme.purple;
      case 'bottle': return theme.primary;
      case 'solids': return theme.orange; // Beikost in Orange
      case 'pump': return '#35B6B4';
      case 'water': return '#4FC3F7';
      default: return theme.lightGray;
    }
  };

  const getModalTitle = () => {
    switch (activityType) {
      case 'feeding': return isPumpSelection ? t('feeding.pump') : isWaterSelection ? t('feeding.water') : t('input.newFeeding');
      case 'diaper': return t('input.diaper');
      default: return t('input.newEntry');
    }
  };

  const getModalSubtitle = () => {
    if (isPumpSelection || isWaterSelection) {
      return t('input.documentedSeparately');
    }
    return t('input.enterDetails');
  };

  // --- RENDER FUNKTIONEN ---

  const renderFeedingSideSelector = () => (
    <View style={styles.sideSelectorContainer}>
      {(['left', 'right', 'both'] as BreastSide[]).map((side) => (
        <TouchableOpacity
          key={side}
          style={[
            styles.sideSelectorButton,
            { backgroundColor: theme.lightGray },
            breastSide === side && { backgroundColor: getButtonColor(feedingType) },
          ]}
          onPress={() => setBreastSide(side)}
        >
          <Text style={[styles.sideSelectorButtonText, { color: breastSide === side ? '#FFFFFF' : theme.text }]}>
            {side === 'left' ? t('input.left') : side === 'right' ? t('input.right') : t('input.both')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderVolumeControl = () => {
    const quickVolumes = [60, 90, 120, 150, 180, 210];
    return (
      <View pointerEvents={canDraft && (!draft.ready || draft.unknown) ? 'none' : 'auto'} style={{width: '100%', alignItems: 'center'}}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          <FixedEmojiText style={styles.sectionTitleEmoji}>🥛</FixedEmojiText>{' '}
          {feedingType === 'pump' ? t('input.pumpedAmount') : feedingType === 'water' ? t('input.drunkAmount') : t('input.amountMl')}
        </Text>
        <View
          style={[
            styles.volumeStepperContainer,
            isDark && {
              backgroundColor: 'rgba(24, 24, 28, 0.92)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.stepperButton,
              isDark && { backgroundColor: 'rgba(255,255,255,0.14)' },
            ]}
            onPress={() => setVolumeMl(v => Math.max(0, v - 10))}
          >
            <Text style={[styles.stepperButtonText, { color: theme.text }]}>-</Text>
          </TouchableOpacity>
          <View style={styles.volumeDisplay}>
            <Text style={[styles.volumeText, { color: theme.text }]}>{volumeMl}</Text>
            <Text style={[styles.volumeUnit, { color: theme.textSecondary }]}> ml</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.stepperButton,
              isDark && { backgroundColor: 'rgba(255,255,255,0.14)' },
            ]}
            onPress={() => setVolumeMl(v => v + 10)}
          >
            <Text style={[styles.stepperButtonText, { color: theme.text }]}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickVolumeGrid}>
          {quickVolumes.map((vol) => (
            <TouchableOpacity
              key={vol}
              style={[
                styles.quickVolumeButton,
                { backgroundColor: volumeMl === vol ? theme.primary : theme.lightGray },
              ]}
              onPress={() => setVolumeMl(vol)}
            >
              <Text style={[styles.quickVolumeText, { color: volumeMl === vol ? '#fff' : theme.text }]}>{vol}ml</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderFeedingSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        <FixedEmojiText style={styles.sectionTitleEmoji}>{feedingType === 'pump' ? '🥛' : feedingType === 'water' ? '🚰' : '🍼'}</FixedEmojiText>{' '}
        {feedingType === 'pump' ? t('feeding.pump') : feedingType === 'water' ? t('feeding.water') : t('input.feedingType')}
      </Text>
      {!isStandaloneSpecialFlow && feedingOptions.length > 0 ? (
        <View style={styles.optionsGrid}>
          {feedingOptions.map((option) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.optionButton,
                useWideOptions && styles.optionButtonWide,
                { backgroundColor: theme.lightGray },
                feedingType === option.type && {
                  backgroundColor: `${getButtonColor(option.type as FeedingType)}${isDark ? '38' : '20'}`,
                  borderColor: getButtonColor(option.type as FeedingType),
                }
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: feedingType === option.type }}
              accessibilityLabel={option.label}
              onPress={() => setFeedingType(option.type as FeedingType)}
            >
              <FixedEmojiText style={styles.optionIcon}>{option.icon}</FixedEmojiText>
              <Text style={[styles.optionLabel, { color: theme.text, fontWeight: feedingType === option.type ? '700' : '500' }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : !isStandaloneSpecialFlow ? (
        <View
          style={[
            styles.hiddenOptionNotice,
            {
              backgroundColor: isDark ? 'rgba(24, 24, 28, 0.92)' : 'rgba(255,255,255,0.82)',
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <Text style={[styles.hiddenOptionNoticeText, { color: theme.textSecondary }]}>
            {t('input.allFeedingHidden')}
          </Text>
        </View>
      ) : null}
      <View style={styles.contentContainer}>
        {(feedingOptions.length > 0 || isStandaloneSpecialFlow) && (feedingType === 'pump' || feedingType === 'water') && (
          <View
            style={[
              styles.pumpNoticeCard,
              {
                backgroundColor:
                  feedingType === 'water'
                    ? isDark
                      ? 'rgba(16, 35, 48, 0.92)'
                      : 'rgba(222, 242, 255, 0.92)'
                    : isDark
                      ? 'rgba(20, 36, 40, 0.92)'
                      : 'rgba(214, 245, 242, 0.92)',
                borderColor:
                  feedingType === 'water'
                    ? isDark
                      ? 'rgba(79, 195, 247, 0.3)'
                      : 'rgba(79, 195, 247, 0.24)'
                    : isDark
                      ? 'rgba(83, 196, 194, 0.28)'
                      : 'rgba(53, 182, 180, 0.24)',
              },
            ]}
          >
            <Text style={[styles.pumpNoticeTitle, { color: theme.text }]}>{t('input.separateEntry')}</Text>
            <Text style={[styles.pumpNoticeText, { color: theme.textSecondary }]}>
              {feedingType === 'water'
                ? t('input.waterNotice')
                : t('input.pumpNotice')}
            </Text>
          </View>
        )}
        {(feedingOptions.length > 0 || isStandaloneSpecialFlow) && (feedingType === 'bottle' || feedingType === 'pump' || feedingType === 'water') && renderVolumeControl()}
        {feedingType === 'bottle' && !initialData?.id && formulaInventoryItems.length > 0 ? (
          <View style={styles.diaperStockGroup}>
            <Text style={[styles.diaperStockTitle, { color: theme.textSecondary }]}>
              {t('input.formulaQuestion')}
            </Text>
            <View style={styles.diaperStockChipRow}>
              <TouchableOpacity
                style={[
                  styles.diaperStockChip,
                  { backgroundColor: theme.lightGray },
                  selectedFormulaItemId === null && styles.diaperStockChipActive,
                ]}
                onPress={() => setSelectedFormulaItemId(null)}
              >
                <Text
                  style={[
                    styles.diaperStockChipText,
                    { color: selectedFormulaItemId === null ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {t('input.automatic')}
                </Text>
              </TouchableOpacity>
              {formulaInventoryItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.diaperStockChip,
                    { backgroundColor: theme.lightGray },
                    selectedFormulaItemId === item.id && styles.diaperStockChipActive,
                  ]}
                  onPress={() => setSelectedFormulaItemId(item.id)}
                >
                  <Text
                    style={[
                      styles.diaperStockChipText,
                      { color: selectedFormulaItemId === item.id ? '#FFFFFF' : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.diaperStockChip,
                  { backgroundColor: theme.lightGray },
                  selectedFormulaItemId === 'none' && styles.diaperStockChipActive,
                ]}
                onPress={() => setSelectedFormulaItemId('none')}
              >
                <Text
                  style={[
                    styles.diaperStockChipText,
                    { color: selectedFormulaItemId === 'none' ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {t('input.noFormula')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {feedingOptions.length > 0 && (feedingType === 'breast' || feedingType === 'pump') && (
          <View pointerEvents={canDraft && (!draft.ready || draft.unknown) ? 'none' : 'auto'} style={{width: '100%', alignItems: 'center'}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              <FixedEmojiText style={styles.sectionTitleEmoji}>{feedingType === 'pump' ? '🥛' : '🤱'}</FixedEmojiText>{' '}
              {t('input.side')}
            </Text>
            {renderFeedingSideSelector()}
            <Text style={[styles.infoText, { marginTop: 20, color: theme.textSecondary }]}>
              {feedingType === 'pump'
                ? t('input.pumpSideHint')
                : t('input.breastSideHint')}
            </Text>
          </View>
        )}
        {!restricted && feedingOptions.length > 0 && feedingType === 'solids' && (
          <View style={{width: '100%', alignItems: 'center', paddingTop: 20}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              <FixedEmojiText style={styles.sectionTitleEmoji}>🥦</FixedEmojiText>{' '}
              {t('input.blwRecipes')}
            </Text>
            <TouchableOpacity
              style={[
                styles.recipeDropdown,
                isDark && {
                  backgroundColor: 'rgba(24, 24, 28, 0.92)',
                  borderColor: 'rgba(255,255,255,0.14)',
                },
              ]}
              onPress={() => {
                if (recipesAccess === null) return;
                if (!recipesAccess) {
                  Alert.alert(t('input.blwRecipes'), t('input.recipesLockedHint'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('input.recipeSubscriptionOptions'),
                      onPress: () => {
                        onClose();
                        router.push('/paywall?origin=lock_recipes');
                      },
                    },
                  ]);
                  return;
                }
                setRecipeDropdownOpen((v) => !v);
              }}
              activeOpacity={0.9}
            >
              <Text style={[styles.recipeDropdownLabel, { color: theme.text }]}>
                {recipesAccess === false
                  ? t('input.recipeSubscriptionOptions')
                  : selectedRecipeId
                  ? recipeOptions.find((r) => r.id === selectedRecipeId)?.title?.trim() || t('input.chooseRecipe')
                  : isLoadingRecipes
                  ? t('input.loadingRecipes')
                  : t('input.chooseRecipeOptional')}
              </Text>
              <Text style={[styles.recipeDropdownCaret, { color: theme.textSecondary }]}>{recipesAccess === false ? '🔒' : recipeDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {recipesAccess === true && recipeDropdownOpen && (
              <View
                style={[
                  styles.recipeList,
                  isDark && {
                    backgroundColor: 'rgba(20, 20, 24, 0.95)',
                    borderColor: 'rgba(255,255,255,0.14)',
                  },
                ]}
              >
                {isLoadingRecipes ? (
                  <View style={styles.recipeLoadingRow}>
                    <Text style={[styles.recipeRowTitle, { color: theme.text }]}>{t('input.loadingRecipes')}</Text>
                  </View>
                ) : recipeOptions.length === 0 ? (
                  <View style={styles.recipeLoadingRow}>
                    <Text style={[styles.recipeRowTitle, { color: theme.text }]}>{t('input.noRecipes')}</Text>
                  </View>
                ) : recipeOptions.map((recipe) => {
                  const isSelected = selectedRecipeId === recipe.id;
                  const displayTitle = recipe.title?.trim() || t('input.recipe');
                  const subtitle = recipe.minMonths ? `${recipe.minMonths}+ ${t('input.months')}` : recipe.source === 'sample' ? 'Sample' : '';
                  return (
                    <TouchableOpacity
                      key={recipe.id}
                      style={[styles.recipeRow, isSelected && styles.recipeRowSelected]}
                      onPress={() => {
                        setSelectedRecipeId(isSelected ? null : recipe.id);
                        setRecipeDropdownOpen(false);
                      }}
                      activeOpacity={0.9}
                      >
                        {recipe.image ? (
                          <Image source={{ uri: recipe.image }} style={styles.recipeThumb} resizeMode="cover" />
                        ) : (
                          <View style={[styles.recipeThumb, styles.recipeThumbFallback]}>
                          <FixedEmojiText style={styles.recipeThumbEmoji}>{recipe.emoji ?? '🥄'}</FixedEmojiText>
                          </View>
                        )}
                        <View style={styles.recipeRowText}>
                        <Text numberOfLines={2} style={[styles.recipeRowTitle, { color: theme.text }]}>{displayTitle}</Text>
                        {subtitle.length > 0 && (
                          <Text style={[styles.recipeRowSub, { color: theme.textSecondary }]}>{subtitle}</Text>
                        )}
                        </View>
                        <View style={[styles.recipeCheckbox, isSelected && styles.recipeCheckboxActive]}>
                          {isSelected && <Text style={styles.recipeCheckboxTick}>✓</Text>}
                        </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.infoText, { marginTop: 12, color: theme.textSecondary }]}>
              {t(recipesAccess === false ? 'input.recipesLockedHint' : 'input.recipeHint')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderDiaperSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        <FixedEmojiText style={styles.sectionTitleEmoji}>💧</FixedEmojiText>{' '}
        {t('input.diaperType')}
      </Text>
      {diaperOptions.length > 0 ? (
        <View style={styles.optionsGrid}>
          {diaperOptions.map((option) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.optionButton,
                useWideOptions && styles.optionButtonWide,
                { backgroundColor: theme.lightGray },
                diaperType === option.type && {
                  backgroundColor: `${option.type === 'wet' ? '#3498DB' : option.type === 'dirty' ? '#8E5A2B' : theme.green}${isDark ? '38' : '20'}`,
                  borderColor: option.type === 'wet' ? '#3498DB' : option.type === 'dirty' ? '#8E5A2B' : theme.green,
                }
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: diaperType === option.type }}
              accessibilityLabel={option.label}
              onPress={() => setDiaperType(option.type as DiaperType)}
            >
              <FixedEmojiText style={styles.optionIcon}>{option.icon}</FixedEmojiText>
              <Text style={[styles.optionLabel, { color: theme.text, fontWeight: diaperType === option.type ? '700' : '500' }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View
          style={[
            styles.hiddenOptionNotice,
            {
              backgroundColor: isDark ? 'rgba(24, 24, 28, 0.92)' : 'rgba(255,255,255,0.82)',
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <Text style={[styles.hiddenOptionNoticeText, { color: theme.textSecondary }]}>
            {t('input.allDiaperHidden')}
          </Text>
        </View>
      )}

      {diaperOptions.length > 0 && !initialData?.id && diaperInventoryItems.length >= 2 ? (
        <View style={styles.diaperStockGroup}>
          <Text style={[styles.diaperStockTitle, { color: theme.textSecondary }]}>
            {t('input.diaperQuestion')}
          </Text>
          <View style={styles.diaperStockChipRow}>
            <TouchableOpacity
              style={[
                styles.diaperStockChip,
                { backgroundColor: theme.lightGray },
                selectedDiaperItemId === null && styles.diaperStockChipActive,
              ]}
              onPress={() => setSelectedDiaperItemId(null)}
            >
              <Text
                style={[
                  styles.diaperStockChipText,
                  { color: selectedDiaperItemId === null ? '#FFFFFF' : theme.text },
                ]}
              >
                {t('input.automatic')}
              </Text>
            </TouchableOpacity>
            {diaperInventoryItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.diaperStockChip,
                  { backgroundColor: theme.lightGray },
                  selectedDiaperItemId === item.id && styles.diaperStockChipActive,
                ]}
                onPress={() => setSelectedDiaperItemId(item.id)}
              >
                <Text
                  style={[
                    styles.diaperStockChipText,
                    { color: selectedDiaperItemId === item.id ? '#FFFFFF' : theme.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.name} ({Math.max(0, Math.trunc(computeTotalQuantity(item)))})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {!restricted && diaperOptions.length > 0 ? (
      <View style={styles.diaperHealthGroup}>
        <TouchableOpacity
          style={[
            styles.diaperHealthToggle,
            { backgroundColor: isDark ? 'rgba(24, 24, 28, 0.92)' : 'rgba(255,255,255,0.82)' },
            diaperFeverMeasured && styles.diaperHealthToggleActive,
          ]}
          onPress={() => {
            setDiaperFeverMeasured((prev) => {
              const next = !prev;
              if (!next) setDiaperTemperatureC('');
              return next;
            });
          }}
          activeOpacity={0.85}
        >
          <View style={[styles.healthTogglePill, diaperFeverMeasured && styles.healthTogglePillActive]}>
            <View style={[styles.healthToggleKnob, diaperFeverMeasured && styles.healthToggleKnobActive]} />
          </View>
          <View style={styles.healthToggleTextWrap}>
            <Text style={[styles.healthToggleLabel, { color: theme.text }]}>{t('input.feverMeasured')}</Text>
            <Text style={[styles.healthToggleSub, { color: theme.textSecondary }]}>
              {diaperFeverMeasured ? t('input.yesTemperature') : t('input.optional')}
            </Text>
          </View>
        </TouchableOpacity>

        {diaperFeverMeasured && (
          <FormField isDark={isDark} onPress={() => {
              setFocusValue(diaperTemperatureC);
              setFocusConfig({
                field: 'diaper_temperature_c',
                label: t('input.temperature'),
                placeholder: 'z. B. 38,5',
                keyboardType: 'decimal-pad',
                inputMode: 'decimal',
              });
            }}
    label={t('input.temperature')} value={diaperTemperatureC.trim() ? `${diaperTemperatureC.trim()} °C` : t('input.enterValue')}
       />
        )}

        <TouchableOpacity
          style={[
            styles.diaperHealthToggle,
            { backgroundColor: isDark ? 'rgba(24, 24, 28, 0.92)' : 'rgba(255,255,255,0.82)' },
            diaperSuppositoryGiven && styles.diaperHealthToggleActive,
          ]}
          onPress={() => {
            setDiaperSuppositoryGiven((prev) => {
              const next = !prev;
              if (!next) setDiaperSuppositoryDoseMg('');
              return next;
            });
          }}
          activeOpacity={0.85}
        >
          <View style={[styles.healthTogglePill, diaperSuppositoryGiven && styles.healthTogglePillActive]}>
            <View style={[styles.healthToggleKnob, diaperSuppositoryGiven && styles.healthToggleKnobActive]} />
          </View>
          <View style={styles.healthToggleTextWrap}>
            <Text style={[styles.healthToggleLabel, { color: theme.text }]}>{t('input.suppositoryGiven')}</Text>
            <Text style={[styles.healthToggleSub, { color: theme.textSecondary }]}>
              {diaperSuppositoryGiven ? t('input.yesDose') : t('input.optional')}
            </Text>
          </View>
        </TouchableOpacity>

        {diaperSuppositoryGiven && (
          <FormField isDark={isDark} onPress={() => {
              setFocusValue(diaperSuppositoryDoseMg);
              setFocusConfig({
                field: 'diaper_suppository_dose_mg',
                label: t('input.dose'),
                placeholder: 'z. B. 125',
                keyboardType: 'number-pad',
                inputMode: 'numeric',
              });
            }}
    label={t('input.dose')} value={diaperSuppositoryDoseMg.trim() ? `${diaperSuppositoryDoseMg.trim()} mg` : t('input.enterValue')}
       />
        )}
      </View>
      ) : null}

      {diaperOptions.length > 0 ? (
        <Text style={[styles.infoText, { marginTop: 20, color: theme.textSecondary }]}>{t('input.diaperHint')}</Text>
      ) : null}
    </View>
  );

  const toggleNotes = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotesVisible(!isNotesVisible);
  };

  const openNotesEditor = () => {
    setFocusValue(notes);
    setFocusConfig({
      field: 'notes',
      label: t('input.notes'),
      placeholder: t('input.details'),
      multiline: true,
    });
  };

  const closeFocusEditor = () => {
    setFocusConfig(null);
    setFocusValue('');
  };

  const saveFocusEditor = (next?: string) => {
    const val = typeof next === 'string' ? next : focusValue;
    if (focusConfig?.field === 'notes') {
      setNotes(val);
    } else if (focusConfig?.field === 'diaper_temperature_c') {
      setDiaperTemperatureC(val);
    } else if (focusConfig?.field === 'diaper_suppository_dose_mg') {
      setDiaperSuppositoryDoseMg(val);
    }
    closeFocusEditor();
  };

  const renderNotes = () => (
      <View style={styles.section}>
         <TouchableOpacity style={styles.notesHeader} onPress={toggleNotes}>
           <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
             <FixedEmojiText style={styles.sectionTitleEmoji}>📝</FixedEmojiText>{' '}
             {t('input.notes')}
           </Text>
           <Text style={{ fontSize: 20, transform: [{ rotate: isNotesVisible ? '90deg' : '0deg' }] }}>›</Text>
         </TouchableOpacity>
         {isNotesVisible && (
            <FormField isDark={isDark} onPress={openNotesEditor}
     value={notes.trim()} placeholder={t('input.details')}
    multiline   />
         )}
      </View>
  );

  return (
    <FormSheet
        visible={visible}
        isDark={isDark}
        title={getModalTitle()}
        subtitle={getModalSubtitle()}
        onClose={() => void closeModal()}
        onCancel={() => closeModal()}
        busy={saving || isSubmitting}
        confirmDisabled={canDraft && (!draft.ready || draft.unknown)}
        onConfirm={() => handleSave()}
        overlays={
          <>
            <TextInputOverlay
              visible={!!focusConfig}
              label={focusConfig?.label ?? ''}
              value={focusValue}
              placeholder={focusConfig?.placeholder}
              multiline={!!focusConfig?.multiline}
              keyboardType={focusConfig?.keyboardType}
              inputMode={focusConfig?.inputMode}
              onClose={closeFocusEditor}
              onSubmit={(next) => saveFocusEditor(next)}
              onChangeText={setFocusValue}
            />
          </>
        }
      >
        {canDraft &&
          (draft.choice ||
            draft.corrupt ||
            draft.error ||
            draft.unknown ||
            (inventoryFailed &&
              (!!selectedDiaperItemId ||
                (!!selectedFormulaItemId && selectedFormulaItemId !== 'none')))) && (
            <View
              style={[
                styles.draftFeedback,
                { backgroundColor: theme.lightGray, borderColor: theme.mediumGray },
              ]}
              accessibilityLiveRegion="polite"
            >
              {draft.choice && (
                <>
                  <Text style={[styles.draftFeedbackText, { color: theme.text }]}>
                    {ot('restore')} · {activeBaby?.name ?? activeBabyId} ·{' '}
                    {new Date(draft.choice.values.startTime).toLocaleString(locale)}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.draftFeedbackAction}
                    onPress={draft.resume}
                  >
                    <Text style={{ color: theme.text }}>{ot('resume')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.draftFeedbackAction}
                    onPress={() => void draft.discard()}
                  >
                    <Text style={{ color: theme.text }}>{ot('discard')}</Text>
                  </TouchableOpacity>
                </>
              )}
              {draft.corrupt && (
                <>
                  <Text style={[styles.draftFeedbackText, { color: theme.text }]}>{ot('corrupt')}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.draftFeedbackAction}
                    onPress={() => void draft.discard()}
                  >
                    <Text style={{ color: theme.text }}>{ot('discard')}</Text>
                  </TouchableOpacity>
                </>
              )}
              {inventoryFailed &&
                (!!selectedDiaperItemId ||
                  (!!selectedFormulaItemId && selectedFormulaItemId !== 'none')) && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.draftFeedbackAction}
                    onPress={() => setInventoryAttempt((v) => v + 1)}
                  >
                    <Text style={{ color: theme.text }}>
                      {ot('inventoryCheck')} · {ot('retry')}
                    </Text>
                  </TouchableOpacity>
                )}
              {draft.error && (
                <>
                  <Text style={[styles.draftFeedbackText, { color: theme.text }]}>
                    {ot('storageError')}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.draftFeedbackAction}
                    onPress={() => void draft.flush().catch(() => {})}
                  >
                    <Text style={{ color: theme.text }}>{ot('retry')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.draftFeedbackAction}
                    onPress={() =>
                      Alert.alert(ot('onlineAnyway'), ot('unsafe'), [
                        { text: ot('back') },
                        { text: ot('onlineAnyway'), onPress: () => void handleSave(true) },
                      ])
                    }
                  >
                    <Text style={{ color: theme.text }}>{ot('onlineAnyway')}</Text>
                  </TouchableOpacity>
                </>
              )}
              {draft.unknown && (
                <>
                  <Text style={[styles.draftFeedbackText, { color: theme.text }]}>{ot('unknown')}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.draftFeedbackAction}
                    onPress={() => void inspectHistory()}
                  >
                    <Text style={{ color: theme.text }}>{ot('checkHistory')}</Text>
                  </TouchableOpacity>
                  {reviewEntries !== null && (
                    <>
                      {reviewEntries.map((entry) => (
                        <Text key={entry.id} style={[styles.draftFeedbackText, { color: theme.text }]}>
                          {new Date(entry.start_time).toLocaleString(locale)} ·{' '}
                          {entry.feeding_volume_ml ?? entry.diaper_type ?? ''} · {entry.notes ?? ''}
                        </Text>
                      ))}
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.draftFeedbackAction}
                        onPress={() => void draft.discard().then(onClose)}
                      >
                        <Text style={{ color: theme.text }}>{ot('alreadyInHistory')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.draftFeedbackAction}
                        onPress={() =>
                          void draft.allowRetryAfterReview().then(() => setReviewEntries(null))
                        }
                      >
                        <Text style={{ color: theme.text }}>{ot('notInHistory')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          )}

        {/* This wrapper ensures keyboard dismiss works inside the scroll view */}

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            pointerEvents={canDraft && (!draft.ready || draft.unknown) ? 'none' : 'auto'}
            style={{ width: '100%', alignItems: 'center' }}
          >
            {activityType === 'feeding' && renderFeedingSection()}
            {activityType === 'diaper' && renderDiaperSection()}
            {renderTimeSection()}
            {renderNotes()}

            {/* Löschen-Button nur beim Bearbeiten anzeigen */}
            {initialData?.id && onDelete && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.85}>
                <Text style={styles.deleteButtonText}>{t('input.deleteEntry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableWithoutFeedback>
      </FormSheet>
  );
};

// --- STYLES ---

const styles = StyleSheet.create({
  draftFeedback: { width: '100%', marginBottom: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, borderWidth: 1, borderRadius: 20 },
  draftFeedbackText: { fontSize: 14, lineHeight: 21 },
  draftFeedbackAction: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },

  section: { width: '100%', gap: 8, marginBottom: 20 },
  sectionTitle: { ...TYPOGRAPHY.label, alignSelf: 'flex-start' },
  sectionTitleEmoji: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 10,
  },
  optionButton: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 8,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(160,145,136,0.22)',
    overflow: 'hidden',
    minHeight: 96,
  },
  optionButtonWide: { flexBasis: '45%' },
  optionIcon: {
    fontSize: 28,
    backgroundColor: 'transparent',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  hiddenOptionNotice: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hiddenOptionNoticeText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pumpNoticeCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  pumpNoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  pumpNoticeText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  contentContainer: {
    width: '100%',
    gap: 20,
    paddingTop: 24,
  },
  volumeStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 30,
    paddingVertical: 5,
    paddingHorizontal: 12,
    width: '100%',
    minHeight: 70,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  stepperButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
  volumeDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flex: 1,
  },
  volumeText: {
    fontVariant: ['tabular-nums'],
    fontSize: 36,
    fontWeight: 'bold',
  },
  timeCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 12,
  },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', gap: 12 },
  timeRowSingle: { gap: 0 },

  datePickerContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(160,145,136,0.18)',
    padding: 16,
    width: '100%',
  },
  dateTimePicker: { width: '100%', backgroundColor: 'transparent' },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  datePickerCancel: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#8E4EC6' },
  datePickerCancelText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  manualPickerActionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  manualPickerSpinner: {
    width: '100%',
    height: 220,
  },
  roundStepper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundStepperText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },
  volumeUnit: {
    fontSize: 18,
    marginLeft: 5,
    marginBottom: 5,
  },
  quickVolumeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 10,
    width: '100%',
  },
  quickVolumeButton: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 22,
  },
  quickVolumeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recipeDropdown: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeDropdownLabel: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  recipeDropdownCaret: {
    fontSize: 16,
    color: '#666',
  },
  recipeList: {
    width: '100%',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 64,
    width: '100%',
  },
  recipeRowSelected: {
    backgroundColor: 'rgba(74,144,226,0.12)',
  },
  recipeThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f2f2f2',
  },
  recipeThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeThumbEmoji: {
    fontSize: 22,
  },
  recipeRowText: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 8,
    marginLeft: 12,
  },
  recipeRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  recipeRowSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  recipeLoadingRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  recipeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4A90E2',
    backgroundColor: 'rgba(74,144,226,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  recipeCheckboxActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  recipeCheckboxTick: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  timerToggle: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  timerToggleActive: {
    borderColor: 'rgba(74,144,226,0.45)',
    backgroundColor: 'rgba(74,144,226,0.12)',
  },
  timerTogglePill: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D6D6D6',
    padding: 4,
    justifyContent: 'center',
  },
  timerTogglePillActive: {
    backgroundColor: '#4A90E2',
  },
  timerToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  timerToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  timerToggleLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  timerToggleSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  diaperStockGroup: {
    marginTop: 14,
    gap: 8,
  },
  diaperStockTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  diaperStockChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  diaperStockChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '100%',
  },
  diaperStockChipActive: {
    backgroundColor: '#8E4EC6',
  },
  diaperStockChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  diaperHealthGroup: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  diaperHealthToggle: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  diaperHealthToggleActive: {
    borderColor: 'rgba(74,144,226,0.45)',
    backgroundColor: 'rgba(74,144,226,0.12)',
  },
  healthTogglePill: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D6D6D6',
    padding: 4,
    justifyContent: 'center',
  },
  healthTogglePillActive: {
    backgroundColor: '#4A90E2',
  },
  healthToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  healthToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  healthToggleTextWrap: {
    flex: 1,
  },
  healthToggleLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  healthToggleSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },

  sideSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
  },
  sideSelectorButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 20,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  sideSelectorButtonText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  chevron: {
    fontSize: 24,
    color: '#888',
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },

  deleteButton: {
    width: '100%',
    marginTop: 30,
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D63031',
  },
});

export default ActivityInputModal;
