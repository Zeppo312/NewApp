import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Image,
  Alert,
  TextInputProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getSampleRecipeImage, RECIPE_SAMPLES } from '@/lib/recipes-samples';
import { fetchRecipes, RecipeRecord } from '@/lib/recipes';
import TextInputOverlay from '@/components/modals/TextInputOverlay';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Typ-Definitionen
type ActivityType = 'feeding' | 'diaper' | 'other';
type FeedingType = 'breast' | 'bottle' | 'solids';
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
  date?: Date;
  forceDarkMode?: boolean;
  onClose: () => void;
  onSave: (data: any, options?: { startTimer?: boolean }) => void; // data ist DB-ready für baby_care_entries
  onDelete?: (id: string) => void; // Optional: Nur wenn ein Eintrag bearbeitet wird
  initialData?: Partial<{
    id: string;
    feeding_type: 'BREAST' | 'BOTTLE' | 'SOLIDS';
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
  date,
  forceDarkMode,
  onClose,
  onSave,
  onDelete,
  initialData,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = forceDarkMode ?? (colorScheme === 'dark');

  // Theme und Farben - angepasst für Dark Mode
  const theme = isDark ? {
    background: Colors.dark.background,
    modalBackground: 'rgba(45, 37, 34, 0.98)', // Dark background
    text: Colors.dark.text, // Light text for contrast
    textSecondary: Colors.dark.textTertiary, // Lighter gray for subtitles
    primary: '#4A90E2', // Solid blue for selected bottle
    accent: '#E5B9A0',  // Warm orange for save button
    lightGray: 'rgba(60, 60, 60, 0.8)', // Dark gray for unselected buttons
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
    lightGray: 'rgba(230, 230, 230, 0.8)', // Light gray for unselected buttons
    mediumGray: 'rgba(220, 220, 220, 0.5)',
    green: '#38A169', // Solid green for BOTH
    orange: '#F5A623', // Orange for Beikost
    purple: '#9B59B6', // Solid purple
  };

  // States
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
  const [diaperFeverMeasured, setDiaperFeverMeasured] = useState(false);
  const [diaperTemperatureC, setDiaperTemperatureC] = useState('');
  const [diaperSuppositoryGiven, setDiaperSuppositoryGiven] = useState(false);
  const [diaperSuppositoryDoseMg, setDiaperSuppositoryDoseMg] = useState('');

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

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Effekt zum Zurücksetzen der Werte bei Sichtbarkeit
  // Only initialize on open or target change to avoid resetting user edits.
  useEffect(() => {
    if (!visible) {
      initKeyRef.current = null;
      return;
    }

    const initKey = `${activityType}:${initialData?.id ?? 'new'}:${initialSubType ?? ''}`;
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
      if (initialData?.feeding_type === 'BREAST') setFeedingType('breast');
      else if (initialData?.feeding_type === 'SOLIDS') setFeedingType('solids');
      else setFeedingType('bottle');
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
      setDiaperType(
        initialData?.diaper_type === 'DIRTY' ? 'dirty' : initialData?.diaper_type === 'BOTH' ? 'both' : 'wet'
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
  }, [visible, initialSubType, date, initialData, activityType, sanitizeManualDate]);

  // Rezepte laden (Supabase), fallback auf Samples
  useEffect(() => {
    const loadRecipes = async () => {
      if (!(visible && activityType === 'feeding' && feedingType === 'solids')) return;
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
  }, [visible, activityType, feedingType]);

  // Speichern: Payload für baby_care_entries
  const handleSave = () => {
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
      end_time: isDiaperEntry ? null : (safeEndTime ? safeEndTime.toISOString() : null as string | null),
      notes: combinedNotes || null,
    };

    let payload: any = base;

    if (activityType === 'feeding') {
      const feeding_type =
        feedingType === 'breast' ? 'BREAST' :
        feedingType === 'bottle' ? 'BOTTLE' :
        'SOLIDS';

      const feeding_side =
        feedingType === 'breast'
          ? (breastSide === 'left' ? 'LEFT' : breastSide === 'right' ? 'RIGHT' : 'BOTH')
          : null;

      payload = {
        ...base,
        feeding_type,
        feeding_volume_ml: feedingType === 'bottle' ? volumeMl : null,
        feeding_side,
      };
    } else if (activityType === 'diaper') {
      const parsedTemp = diaperFeverMeasured ? toDecimalValue(diaperTemperatureC) : null;
      const parsedDose = diaperSuppositoryGiven ? toPositiveInt(diaperSuppositoryDoseMg) : null;

      if (diaperFeverMeasured && (parsedTemp === null || parsedTemp < 30 || parsedTemp > 45)) {
        Alert.alert('Ungültige Temperatur', 'Bitte gib eine Temperatur zwischen 30 und 45 °C ein.');
        return;
      }

      if (diaperSuppositoryGiven && parsedDose === null) {
        Alert.alert('Ungültige Dosis', 'Bitte gib eine gültige Dosis in mg ein (z. B. 125).');
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
      };
    }
    // other: nur base + notes

    console.log('ActivityInputModal - Sending payload:', JSON.stringify(payload, null, 2));
    onSave(payload, { startTimer: activityType === 'feeding' ? startTimer : false });
    onClose();
  };

  // Löschen: Nur bei Bearbeitung verfügbar
  const handleDelete = () => {
    if (!initialData?.id || !onDelete) return;
    onDelete(initialData.id);
    onClose();
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
    const pickerCardBg = isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)';
    const pickerCardBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

    return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        <FixedEmojiText style={styles.sectionTitleEmoji}>⏰</FixedEmojiText>{' '}
        {showEndTime ? 'Zeitraum' : 'Zeitpunkt'}
      </Text>

      <View style={[styles.timeRow, !showEndTime && styles.timeRowSingle]}> 
        <TouchableOpacity
          style={[
            styles.timeButton,
            !showEndTime && styles.timeButtonSingle,
            isDark && {
              backgroundColor: 'rgba(24, 24, 28, 0.92)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
            },
          ]}
          onPress={openStartPicker}
        >
          <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Start</Text>
          <Text style={[styles.timeValue, { color: theme.text }]}>
            {safeModalStartTime.toLocaleString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })}
          </Text>
        </TouchableOpacity>

        {showEndTime && (
          <TouchableOpacity
            style={[
              styles.timeButton,
              isDark && {
                backgroundColor: 'rgba(24, 24, 28, 0.92)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
              },
              startTimer && styles.timeButtonDisabled,
            ]}
            onPress={() => {
              if (startTimer) return;
              setEndTimeVisible(true);
              openEndPicker();
            }}
            activeOpacity={startTimer ? 1 : 0.7}
          >
            <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Ende</Text>
            <Text
              style={[
                styles.timeValue,
                startTimer ? [styles.timeDisabledText, { color: theme.textSecondary }] : { color: theme.text },
              ]}
            >
              {startTimer
                ? 'Timer läuft'
                : safeModalEndTime
                ? safeModalEndTime.toLocaleString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })
                : 'Offen'}
            </Text>
            {startTimer && <Text style={[styles.timeHint, { color: theme.textSecondary }]}>Stoppe später, Ende wird gesetzt</Text>}
          </TouchableOpacity>
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
              if (event.type === 'dismissed') return;
              const nextStart = getSafePickerDateFromEvent(event, date, safeModalStartTime);
              applyStartPickerValue(nextStart);
            }}
            style={styles.dateTimePicker}
          />
          <View style={styles.datePickerActions}>
            <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowStartPicker(false)}>
              <Text style={styles.datePickerCancelText}>Fertig</Text>
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
              if (event.type === 'dismissed') return;
              const nextEnd = getSafePickerDateFromEvent(event, date, safeModalEndPickerTime);
              applyEndPickerValue(nextEnd);
            }}
            style={styles.dateTimePicker}
          />
          <View style={styles.datePickerActions}>
            <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowEndPicker(false)}>
              <Text style={styles.datePickerCancelText}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {Platform.OS === 'ios' && showStartPicker && (
        <Modal
          visible={showStartPicker}
          transparent
          animationType="fade"
          onRequestClose={() => {
            commitStartPickerDraft();
            setShowStartPicker(false);
          }}
        >
          <View style={styles.manualPickerOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => {
                commitStartPickerDraft();
                setShowStartPicker(false);
              }}
              activeOpacity={1}
            />
            <View
              style={[
                styles.manualPickerCard,
                {
                  backgroundColor: pickerCardBg,
                  borderColor: pickerCardBorder,
                },
              ]}
            >
              <View style={styles.manualPickerHeader}>
                <TouchableOpacity
                  onPress={() => setShowStartPicker(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.manualPickerActionText, { color: theme.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <Text style={[styles.manualPickerTitle, { color: theme.text }]}>Start</Text>
                <TouchableOpacity
                  onPress={() => {
                    commitStartPickerDraft();
                    setShowStartPicker(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.manualPickerActionText, { color: theme.accent }]}>Fertig</Text>
                </TouchableOpacity>
              </View>
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
                locale="de-DE"
                onChange={(event, d) => {
                  if (event.type === 'dismissed') return;
                  setStartPickerDraft((prev) =>
                    getSafePickerDateFromEvent(event, d, prev)
                  );
                }}
                accentColor={theme.accent}
                themeVariant={isDark ? 'dark' : 'light'}
                style={styles.manualPickerSpinner}
              />
            </View>
          </View>
        </Modal>
      )}

      {showEndTime && Platform.OS === 'ios' && showEndPicker && (
        <Modal
          visible={showEndPicker}
          transparent
          animationType="fade"
          onRequestClose={() => {
            commitEndPickerDraft();
            setShowEndPicker(false);
          }}
        >
          <View style={styles.manualPickerOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => {
                commitEndPickerDraft();
                setShowEndPicker(false);
              }}
              activeOpacity={1}
            />
            <View
              style={[
                styles.manualPickerCard,
                {
                  backgroundColor: pickerCardBg,
                  borderColor: pickerCardBorder,
                },
              ]}
            >
              <View style={styles.manualPickerHeader}>
                <TouchableOpacity
                  onPress={() => setShowEndPicker(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.manualPickerActionText, { color: theme.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <Text style={[styles.manualPickerTitle, { color: theme.text }]}>Ende</Text>
                <TouchableOpacity
                  onPress={() => {
                    commitEndPickerDraft();
                    setShowEndPicker(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.manualPickerActionText, { color: theme.accent }]}>Fertig</Text>
                </TouchableOpacity>
              </View>
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
                locale="de-DE"
                onChange={(event, d) => {
                  if (event.type === 'dismissed') return;
                  setEndPickerDraft((prev) =>
                    getSafePickerDateFromEvent(event, d, prev)
                  );
                }}
                accentColor={theme.accent}
                themeVariant={isDark ? 'dark' : 'light'}
                style={styles.manualPickerSpinner}
              />
            </View>
          </View>
        </Modal>
      )}

      {activityType === 'feeding' && (
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
              Timer optional mitlaufen lassen
            </Text>
            <Text style={[styles.timerToggleSub, { color: theme.textSecondary }]}>
              {startTimer ? 'Läuft, bis du stoppst' : 'Ohne Timer speichern'}
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
      default: return theme.lightGray;
    }
  };
  
  const getModalTitle = () => {
    switch (activityType) {
      case 'feeding': return 'Neue Fütterung';
      case 'diaper': return 'Wickeln';
      default: return 'Neuer Eintrag';
    }
  };

  // --- RENDER FUNKTIONEN ---

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={[styles.headerButton, { backgroundColor: theme.lightGray }]} onPress={onClose}>
        <Text style={styles.closeHeaderButtonText}>✕</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>{getModalTitle()}</Text>
        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Details eingeben</Text>
      </View>
      <TouchableOpacity 
        style={[styles.headerButton, { backgroundColor: theme.accent }]} 
        onPress={handleSave}
      >
        <Text style={styles.saveHeaderButtonText}>✓</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBreastSideSelector = () => (
    <View style={styles.sideSelectorContainer}>
      {(['left', 'right', 'both'] as BreastSide[]).map((side) => (
        <TouchableOpacity
          key={side}
          style={[
            styles.sideSelectorButton,
            { backgroundColor: theme.lightGray },
            breastSide === side && { backgroundColor: theme.purple, },
          ]}
          onPress={() => setBreastSide(side)}
        >
          <Text style={[styles.sideSelectorButtonText, { color: breastSide === side ? '#FFFFFF' : theme.text }]}>
            {side === 'left' ? 'Links' : side === 'right' ? 'Rechts' : 'Beide'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );



  const renderVolumeControl = () => {
    const quickVolumes = [60, 90, 120, 150, 180, 210];
    return (
      <View style={{width: '100%', alignItems: 'center'}}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          <FixedEmojiText style={styles.sectionTitleEmoji}>🥛</FixedEmojiText>{' '}
          Menge (ml)
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
        <FixedEmojiText style={styles.sectionTitleEmoji}>🍼</FixedEmojiText>{' '}
        Art der Fütterung
      </Text>
      <View style={styles.optionsGrid}>
        {[
          { type: 'breast', label: 'Stillen', icon: '🤱' },
          { type: 'bottle', label: 'Flasche', icon: '🍼' },
          { type: 'solids', label: 'Beikost', icon: '🥄' },
        ].map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.optionButton,
              { backgroundColor: theme.lightGray },
              feedingType === option.type && { backgroundColor: getButtonColor(option.type as FeedingType) }
            ]}
            onPress={() => setFeedingType(option.type as FeedingType)}
          >
            <FixedEmojiText style={styles.optionIcon}>{option.icon}</FixedEmojiText>
            <Text style={[styles.optionLabel, { color: feedingType === option.type ? '#FFFFFF' : theme.text }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.contentContainer}>
        {feedingType === 'bottle' && renderVolumeControl()}
        {feedingType === 'breast' && (
          <View style={{width: '100%', alignItems: 'center'}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              <FixedEmojiText style={styles.sectionTitleEmoji}>🤱</FixedEmojiText>{' '}
              Seite
            </Text>
            {renderBreastSideSelector()}
            <Text style={[styles.infoText, { marginTop: 20, color: theme.textSecondary }]}>Wähle die Seite, auf der gestillt wurde.</Text>
          </View>
        )}
        {feedingType === 'solids' && (
          <View style={{width: '100%', alignItems: 'center', paddingTop: 20}}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              <FixedEmojiText style={styles.sectionTitleEmoji}>🥦</FixedEmojiText>{' '}
              BLW-Rezepte
            </Text>
            <TouchableOpacity
              style={[
                styles.recipeDropdown,
                isDark && {
                  backgroundColor: 'rgba(24, 24, 28, 0.92)',
                  borderColor: 'rgba(255,255,255,0.14)',
                },
              ]}
              onPress={() => setRecipeDropdownOpen((v) => !v)}
              activeOpacity={0.9}
            >
              <Text style={[styles.recipeDropdownLabel, { color: theme.text }]}>
                {selectedRecipeId
                  ? recipeOptions.find((r) => r.id === selectedRecipeId)?.title?.trim() || 'Rezept wählen'
                  : isLoadingRecipes
                  ? 'Lade Rezepte...'
                  : 'Rezept auswählen (optional)'}
              </Text>
              <Text style={[styles.recipeDropdownCaret, { color: theme.textSecondary }]}>{recipeDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {recipeDropdownOpen && (
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
                    <Text style={[styles.recipeRowTitle, { color: theme.text }]}>Lade Rezepte ...</Text>
                  </View>
                ) : recipeOptions.length === 0 ? (
                  <View style={styles.recipeLoadingRow}>
                    <Text style={[styles.recipeRowTitle, { color: theme.text }]}>Keine Rezepte gefunden</Text>
                  </View>
                ) : recipeOptions.map((recipe) => {
                  const isSelected = selectedRecipeId === recipe.id;
                  const displayTitle = recipe.title?.trim() || 'Rezept';
                  const subtitle = recipe.minMonths ? `${recipe.minMonths}+ Monate` : recipe.source === 'sample' ? 'Sample' : '';
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
              Der gewählte Rezepttitel erscheint als Hinweis in der Timeline.
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
        Art der Windel
      </Text>
      <View style={styles.optionsGrid}>
        {[
          { type: 'wet', label: 'Nass', icon: '💧' },
          { type: 'dirty', label: 'Voll', icon: '💩' },
          { type: 'both', label: 'Beides', icon: '💧💩' },
        ].map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.optionButton,
              { backgroundColor: theme.lightGray },
              diaperType === option.type && {
                backgroundColor:
                  option.type === 'wet' ? '#3498DB' : option.type === 'dirty' ? '#8E5A2B' : theme.green,
              }
            ]}
            onPress={() => setDiaperType(option.type as DiaperType)}
          >
            <FixedEmojiText style={styles.optionIcon}>{option.icon}</FixedEmojiText>
            <Text style={[styles.optionLabel, { color: diaperType === option.type ? '#FFFFFF' : theme.text }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
            <Text style={[styles.healthToggleLabel, { color: theme.text }]}>Fieber gemessen</Text>
            <Text style={[styles.healthToggleSub, { color: theme.textSecondary }]}>
              {diaperFeverMeasured ? 'Ja, Temperatur eintragen' : 'Optional'}
            </Text>
          </View>
        </TouchableOpacity>

        {diaperFeverMeasured && (
          <TouchableOpacity
            style={[
              styles.diaperHealthInput,
              {
                backgroundColor: isDark ? 'rgba(24, 24, 28, 0.92)' : 'rgba(255,255,255,0.82)',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
              },
            ]}
            activeOpacity={0.9}
            onPress={() => {
              setFocusValue(diaperTemperatureC);
              setFocusConfig({
                field: 'diaper_temperature_c',
                label: 'Temperatur (°C)',
                placeholder: 'z. B. 38,5',
                keyboardType: 'decimal-pad',
                inputMode: 'decimal',
              });
            }}
          >
            <Text style={[styles.diaperHealthInputLabel, { color: theme.textSecondary }]}>Temperatur (°C)</Text>
            <Text
              style={[
                styles.diaperHealthInputValue,
                { color: diaperTemperatureC.trim() ? theme.text : theme.textSecondary },
              ]}
            >
              {diaperTemperatureC.trim() ? `${diaperTemperatureC.trim()} °C` : 'Wert eingeben'}
            </Text>
          </TouchableOpacity>
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
            <Text style={[styles.healthToggleLabel, { color: theme.text }]}>Zäpfchen gegeben</Text>
            <Text style={[styles.healthToggleSub, { color: theme.textSecondary }]}>
              {diaperSuppositoryGiven ? 'Ja, Dosis eintragen' : 'Optional'}
            </Text>
          </View>
        </TouchableOpacity>

        {diaperSuppositoryGiven && (
          <TouchableOpacity
            style={[
              styles.diaperHealthInput,
              {
                backgroundColor: isDark ? 'rgba(24, 24, 28, 0.92)' : 'rgba(255,255,255,0.82)',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
              },
            ]}
            activeOpacity={0.9}
            onPress={() => {
              setFocusValue(diaperSuppositoryDoseMg);
              setFocusConfig({
                field: 'diaper_suppository_dose_mg',
                label: 'Dosis (mg)',
                placeholder: 'z. B. 125',
                keyboardType: 'number-pad',
                inputMode: 'numeric',
              });
            }}
          >
            <Text style={[styles.diaperHealthInputLabel, { color: theme.textSecondary }]}>Dosis (mg)</Text>
            <Text
              style={[
                styles.diaperHealthInputValue,
                { color: diaperSuppositoryDoseMg.trim() ? theme.text : theme.textSecondary },
              ]}
            >
              {diaperSuppositoryDoseMg.trim() ? `${diaperSuppositoryDoseMg.trim()} mg` : 'Wert eingeben'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.infoText, { marginTop: 20, color: theme.textSecondary }]}>Wähle aus, was auf die Windel zutrifft.</Text>
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
      label: 'Notizen',
      placeholder: 'Details hinzufügen...',
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
             Notizen
           </Text>
           <Text style={{ fontSize: 20, transform: [{ rotate: isNotesVisible ? '90deg' : '0deg' }] }}>›</Text>
         </TouchableOpacity>
         {isNotesVisible && (
            <TouchableOpacity
              style={[
                styles.notesInput,
                {
                  backgroundColor: isDark ? 'rgba(24, 24, 28, 0.92)' : theme.lightGray,
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : '#E0E0E0',
                },
              ]}
              activeOpacity={0.9}
              onPress={openNotesEditor}
            >
              <Text
                style={{ color: notes.trim() ? theme.text : theme.textSecondary, fontSize: 14 }}
                numberOfLines={3}
              >
                {notes.trim() || 'Details hinzufügen...'}
              </Text>
            </TouchableOpacity>
         )}
      </View>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.modalOverlay,
          { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.62)' : 'rgba(0, 0, 0, 0.4)' },
        ]}
      >
        {/* This empty view allows closing the modal by tapping the background */}
        <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <BlurView
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.modalBackground,
                borderTopWidth: isDark ? 1 : 0,
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
              },
            ]}
            tint={isDark ? 'dark' : 'extraLight'}
            intensity={80} // Slightly less intense blur
        >
            {renderHeader()}
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* This wrapper ensures keyboard dismiss works inside the scroll view */}
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{width: '100%', alignItems: 'center'}}>
                        {activityType === 'feeding' && renderFeedingSection()}
                        {activityType === 'diaper' && renderDiaperSection()}
                        {renderTimeSection()}
                        {renderNotes()}

                        {/* Löschen-Button nur beim Bearbeiten anzeigen */}
                        {initialData?.id && onDelete && (
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={handleDelete}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.deleteButtonText}>🗑️  Eintrag löschen</Text>
                          </TouchableOpacity>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </ScrollView>
        </BlurView>
      </View>

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
      />
    </Modal>
  );
};

// --- STYLES ---

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimming backdrop
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    height: '85%',
    maxHeight: 700,
    minHeight: 650,
    overflow: 'hidden',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  closeHeaderButtonText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#888888',
  },
  headerCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
    color: '#A8978E',
  },
  saveHeaderButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  saveHeaderButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    width: '90%',
    textAlign: 'left',
  },
  sectionTitleEmoji: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    marginHorizontal: 5,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  optionIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  contentContainer: {
    minHeight: 180, // Feste Höhe, um Springen zu verhindern
    justifyContent: 'center',
    paddingTop: 10,
  },
  volumeStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 30,
    paddingVertical: 5,
    paddingHorizontal: 20,
    width: '90%',
    minHeight: 70,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 36,
    fontWeight: 'bold',
  },
  timeCard: {
    width: '90%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 12,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '90%', gap: 15 },
  timeRowSingle: { gap: 0 },
  timeButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  timeButtonSingle: {
    width: '100%',
    flex: 0,
  },
  timeButtonDisabled: {
    opacity: 0.72,
  },
  timeLabel: { fontSize: 12, color: '#888888', fontWeight: '600', marginBottom: 5 },
  timeValue: { fontSize: 16, color: '#333333', fontWeight: 'bold' },
  timeDisabledText: { color: '#777' },
  timeHint: { marginTop: 6, fontSize: 12, color: '#777' },
  datePickerContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 15,
    width: '90%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  dateTimePicker: { width: '100%', backgroundColor: 'transparent' },
  datePickerActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  datePickerCancel: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#8E4EC6' },
  datePickerCancelText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  manualPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  manualPickerCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  manualPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  manualPickerActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  manualPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
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
    marginTop: 15,
    width: '90%',
  },
  quickVolumeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    margin: 5,
  },
  quickVolumeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recipeDropdown: {
    width: '90%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  recipeDropdownLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  recipeDropdownCaret: {
    fontSize: 16,
    color: '#666',
  },
  recipeList: {
    width: '90%',
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
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
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
  diaperHealthGroup: {
    width: '90%',
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
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
  diaperHealthInput: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  diaperHealthInputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  diaperHealthInputValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
  },
  sideSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
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
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 15,
    backgroundColor: 'rgba(240, 240, 240, 0.9)',
    width: '100%',
    marginTop: 10,
  },
  deleteButton: {
    width: '90%',
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
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D63031',
  },
});

export default ActivityInputModal;
