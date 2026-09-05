// Sprach-Logging (Premium) — Aufnahme → KI-Vorschläge → Bestätigen.
//
// Ablauf: Elternteil spricht eine kurze Notiz ein ("Lotti hat um halb drei
// 120 ml Fläschchen getrunken und ich habe sie gewickelt"), die Edge
// Function voice-log-parse transkribiert und extrahiert Einträge, hier
// werden sie zur Bestätigung angezeigt und erst dann gespeichert.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { Colors } from '@/constants/Colors';
import {
  describeVoiceLogEntry,
  localTimeToDate,
  parseVoiceRecording,
  saveVoiceLogEntries,
} from '@/lib/voiceLog/api';
import type { VoiceLogMode, VoiceLogParsedEntry, VoiceLogShoppingCategory } from '@/lib/voiceLog/types';
import { VoiceOrb } from '@/components/voice/VoiceOrb';
import { VoiceWaveform } from '@/components/voice/VoiceWaveform';
import { useLocale } from '@/contexts/LocaleContext';
import { DailyTranslationKey, getDailyLocaleTag, translateDailyText } from '@/lib/dailyTranslations';
import { normalizeCustomActivityEmoji } from '@/lib/customActivityEmoji';

const MAX_RECORDING_MS = 60_000;
/** Kürzere Aufnahmen gar nicht erst hochladen (Versehens-Taps kosten sonst API-Calls & Rate-Limit). */
const MIN_RECORDING_MS = 1_000;
const VOICE_LOG_MIME_TYPE = 'audio/mp4';
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  // Pegel für Waveform/Orb — kostet nichts, wenn niemand hinschaut.
  isMeteringEnabled: true,
} as const;

const ACCENT_LIGHT = '#9C27B0';
const ACCENT_DARK = '#CE93D8';

type Phase = 'idle' | 'recording' | 'processing' | 'review' | 'saving';
type EditedTimeField = 'start' | 'end';

const ENTRY_TYPE_OPTIONS: { value: VoiceLogParsedEntry['type']; labelKey: DailyTranslationKey }[] = [
  { value: 'sleep', labelKey: 'voice.sleep' },
  { value: 'feeding', labelKey: 'voice.feeding' },
  { value: 'diaper', labelKey: 'voice.diaper' },
  { value: 'shopping', labelKey: 'voice.shopping' },
  { value: 'planner', labelKey: 'voice.planner' },
];

const PLANNER_KIND_OPTIONS: { value: NonNullable<VoiceLogParsedEntry['planner_kind']>; labelKey: DailyTranslationKey }[] = [
  { value: 'event', labelKey: 'voice.plannerEvent' },
  { value: 'todo', labelKey: 'voice.plannerTodo' },
];

const SHOPPING_CATEGORY_OPTIONS: { value: VoiceLogShoppingCategory; labelKey: DailyTranslationKey }[] = [
  { value: 'diapers', labelKey: 'voice.shoppingCategoryDiapers' },
  { value: 'formula', labelKey: 'voice.shoppingCategoryFormula' },
  { value: 'care', labelKey: 'voice.shoppingCategoryCare' },
  { value: 'food', labelKey: 'voice.shoppingCategoryFood' },
  { value: 'other', labelKey: 'voice.shoppingCategoryOther' },
];

/** Leerer Einkaufs-Posten, wenn im Editor auf „Einkaufsliste“ umgeschaltet wird. */
const EMPTY_SHOPPING_FIELDS: Pick<
  VoiceLogParsedEntry,
  'shopping_title' | 'shopping_quantity_value' | 'shopping_quantity_unit' | 'shopping_category'
> = {
  shopping_title: null,
  shopping_quantity_value: null,
  shopping_quantity_unit: null,
  shopping_category: null,
};

const EMPTY_PLANNER_FIELDS: Pick<
  VoiceLogParsedEntry,
  'planner_kind' | 'planner_title' | 'planner_location' | 'planner_all_day'
> = {
  planner_kind: null,
  planner_title: null,
  planner_location: null,
  planner_all_day: false,
};

const EMPTY_CUSTOM_FIELDS: Pick<
  VoiceLogParsedEntry,
  | 'custom_activity_type_id'
  | 'custom_name'
  | 'custom_emoji'
  | 'custom_color'
  | 'custom_tracking_mode'
  | 'custom_quantity'
  | 'custom_unit'
  | 'custom_create_type'
  | 'custom_log_entry'
> = {
  custom_activity_type_id: null,
  custom_name: null,
  custom_emoji: null,
  custom_color: null,
  custom_tracking_mode: null,
  custom_quantity: null,
  custom_unit: null,
  custom_create_type: false,
  custom_log_entry: false,
};

const FEEDING_TYPE_OPTIONS: {
  value: NonNullable<VoiceLogParsedEntry['feeding_type']>;
  labelKey: DailyTranslationKey;
}[] = [
  { value: 'BREAST', labelKey: 'feeding.breast' },
  { value: 'BOTTLE', labelKey: 'feeding.bottle' },
  { value: 'SOLIDS', labelKey: 'feeding.solids' },
  { value: 'PUMP', labelKey: 'feeding.pump' },
  { value: 'WATER', labelKey: 'voice.waterTea' },
];

const FEEDING_SIDE_OPTIONS: {
  value: NonNullable<VoiceLogParsedEntry['feeding_side']>;
  labelKey: DailyTranslationKey;
}[] = [
  { value: 'LEFT', labelKey: 'voice.left' },
  { value: 'RIGHT', labelKey: 'voice.right' },
  { value: 'BOTH', labelKey: 'voice.bothSides' },
];

const DIAPER_TYPE_OPTIONS: {
  value: NonNullable<VoiceLogParsedEntry['diaper_type']>;
  labelKey: DailyTranslationKey;
}[] = [
  { value: 'WET', labelKey: 'diaper.wet' },
  { value: 'DIRTY', labelKey: 'diaper.dirty' },
  { value: 'BOTH', labelKey: 'diaper.both' },
];

const dateToLocalValue = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;

const formatEditorDate = (date: Date, localeTag: string): string =>
  date.toLocaleString(localeTag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type Props = {
  visible: boolean;
  userId?: string | null;
  babyId?: string | null;
  babyName?: string | null;
  /** 'pregnancy': nur Einkaufsliste & Planer (kein Baby-Tracking). */
  mode?: VoiceLogMode;
  onClose: () => void;
  /** Nach erfolgreichem Speichern (Home lädt Einträge/Schlafminuten neu). */
  onSaved: () => void;
};

const formatSeconds = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const getEntryIconName = (
  type: VoiceLogParsedEntry['type'],
): React.ComponentProps<typeof Ionicons>['name'] => {
  switch (type) {
    case 'sleep':
      return 'moon-outline';
    case 'feeding':
      return 'restaurant-outline';
    case 'diaper':
      return 'water-outline';
    case 'custom':
      return 'sparkles-outline';
    case 'shopping':
      return 'cart-outline';
    case 'planner':
      return 'calendar-outline';
  }
};

const VoiceLogModal: React.FC<Props> = ({
  visible,
  userId,
  babyId,
  babyName,
  mode = 'baby',
  onClose,
  onSaved,
}) => {
  const { locale } = useLocale();
  const isPregnancy = mode === 'pregnancy';
  const localeTag = getDailyLocaleTag(locale);
  const t = useCallback((key: DailyTranslationKey, params?: Record<string, string | number>) => translateDailyText(locale, key, params), [locale]);
  const entryTypeOptions = useMemo(
    () =>
      ENTRY_TYPE_OPTIONS.filter((option) =>
        isPregnancy ? option.value === 'shopping' || option.value === 'planner' : true,
      ),
    [isPregnancy],
  );
  const feedingTypeOptions = useMemo(() => FEEDING_TYPE_OPTIONS.map((option) => ({ ...option, label: option.value === 'BREAST' ? t('feeding.breast') : option.value === 'BOTTLE' ? t('card.bottle') : option.value === 'SOLIDS' ? t('feeding.solids') : option.value === 'PUMP' ? t('feeding.pump') : t('voice.waterTea') })), [t]);
  const feedingSideOptions = useMemo(() => FEEDING_SIDE_OPTIONS.map((option) => ({ ...option, label: option.value === 'LEFT' ? t('input.left') : option.value === 'RIGHT' ? t('input.right') : t('input.both') })), [t]);
  const diaperTypeOptions = useMemo(() => DIAPER_TYPE_OPTIONS.map((option) => ({ ...option, label: option.value === 'WET' ? t('diaper.wet') : option.value === 'DIRTY' ? t('voice.dirty') : t('diaper.both') })), [t]);
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const overlayColor = isDark ? 'rgba(0,0,0,0.66)' : 'rgba(32,24,36,0.28)';
  const panelColor = isDark ? '#171519' : '#FCFBFD';
  const sectionBg = isDark ? '#211F23' : '#F5F2F7';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(67,43,76,0.09)';

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  // 80 ms → flüssige Waveform; die Dauer-Anzeige braucht es ohnehin.
  const recorderState = useAudioRecorderState(recorder, 80);

  const [phase, setPhase] = useState<Phase>('idle');
  /** Startzeitpunkt der laufenden Aufnahme (Date.now()) — für die Mindestdauer. */
  const recordingStartedAtRef = useRef(0);
  const [transcript, setTranscript] = useState('');
  const [entries, setEntries] = useState<VoiceLogParsedEntry[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<VoiceLogParsedEntry | null>(null);
  const [editedTimeField, setEditedTimeField] = useState<EditedTimeField | null>(null);
  const [volumeInput, setVolumeInput] = useState('');
  const [shoppingQuantityInput, setShoppingQuantityInput] = useState('');
  const [customQuantityInput, setCustomQuantityInput] = useState('');

  const disableRecordingMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });
    } catch (error) {
      console.error('Failed to reset recording audio mode:', error);
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setTranscript('');
    setEntries([]);
    setSelected([]);
    setEditingIndex(null);
    setEditingDraft(null);
    setEditedTimeField(null);
    setVolumeInput('');
    setShoppingQuantityInput('');
    setCustomQuantityInput('');
  }, []);

  const closeModal = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // Beim Schließen/Unmount eine laufende Aufnahme sauber beenden.
  useEffect(() => {
    if (visible) return;
    void recorder.stop().catch(() => {});
    void disableRecordingMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web' || phase !== 'idle') return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('voice.microphone'), t('voice.permission'));
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();
      recordingStartedAtRef.current = Date.now();
      setPhase('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      console.error('Failed to start voice log recording:', error);
      await disableRecordingMode();
      Alert.alert(t('voice.recording'), t('voice.startFailed'));
      setPhase('idle');
    }
  }, [disableRecordingMode, phase, recorder, t]);

  const stopAndProcess = useCallback(async () => {
    if (phase !== 'recording') return;
    // Dauer über eigenen Zeitstempel messen — recorderState im useCallback
    // ist ein veralteter Schnappschuss (durationMillis steht nicht in den Deps).
    const durationMs = recordingStartedAtRef.current
      ? Date.now() - recordingStartedAtRef.current
      : 0;
    setPhase('processing');
    const knownUrlBeforeStop = recorderState.url || recorder.uri;
    try {
      await recorder.stop();
    } catch (error) {
      console.error('Failed to stop voice log recording:', error);
    }
    await disableRecordingMode();

    if (durationMs < MIN_RECORDING_MS) {
      Alert.alert(
        t('voice.tooShortTitle'),
        t('voice.tooShortBody'),
      );
      setPhase('idle');
      return;
    }

    const localUri = recorder.uri || recorderState.url || knownUrlBeforeStop;
    if (!localUri) {
      Alert.alert(t('voice.recording'), t('voice.readFailed'));
      setPhase('idle');
      return;
    }

    try {
      const result = await parseVoiceRecording(
        localUri,
        VOICE_LOG_MIME_TYPE,
        babyName,
        babyId,
        locale,
        mode,
      );
      setTranscript(result.transcript);
      setEntries(result.entries);
      setSelected(result.entries.map(() => true));
      setPhase('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('voice.processFailed');
      Alert.alert(t('voice.entry'), message);
      setPhase('idle');
    }
  }, [babyId, babyName, disableRecordingMode, locale, mode, phase, recorder, recorderState.url, t]);

  // Auto-Stopp am Limit.
  useEffect(() => {
    if (phase !== 'recording') return;
    if (recorderState.durationMillis < MAX_RECORDING_MS) return;
    void stopAndProcess();
  }, [phase, recorderState.durationMillis, stopAndProcess]);

  const cancelRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // no-op
    }
    await disableRecordingMode();
    reset();
  }, [disableRecordingMode, recorder, reset]);

  const toggleEntry = (index: number) => {
    setSelected((current) => current.map((value, i) => (i === index ? !value : value)));
  };

  const beginEditing = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    setEditingIndex(index);
    setEditingDraft({ ...entry });
    setVolumeInput(entry.feeding_volume_ml ? String(entry.feeding_volume_ml) : '');
    setShoppingQuantityInput(
      entry.shopping_quantity_value !== null ? String(entry.shopping_quantity_value).replace('.', ',') : '',
    );
    setCustomQuantityInput(
      entry.custom_quantity != null ? String(entry.custom_quantity).replace('.', ',') : '',
    );
    setEditedTimeField(null);
    Haptics.selectionAsync().catch(() => {});
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingDraft(null);
    setEditedTimeField(null);
    setVolumeInput('');
    setShoppingQuantityInput('');
    setCustomQuantityInput('');
  };

  const updateDraft = (changes: Partial<VoiceLogParsedEntry>) => {
    setEditingDraft((current) => (current ? { ...current, ...changes } : current));
  };

  const updateEntryType = (type: VoiceLogParsedEntry['type']) => {
    if (!editingDraft) return;
    if (type === 'custom') return;
    if (type === 'planner') {
      updateDraft({
        type,
        ...EMPTY_SHOPPING_FIELDS,
        ...EMPTY_CUSTOM_FIELDS,
        end_local: editingDraft.planner_kind === 'todo' ? null : editingDraft.end_local,
        feeding_type: null,
        feeding_type_needs_confirmation: false,
        timer_requested: false,
        feeding_volume_ml: null,
        feeding_side: null,
        diaper_type: null,
        planner_kind: editingDraft.planner_kind ?? 'event',
        planner_title: editingDraft.planner_title ?? '',
      });
      setVolumeInput('');
      return;
    }
    if (type === 'shopping') {
      updateDraft({
        type,
        ...EMPTY_PLANNER_FIELDS,
        ...EMPTY_CUSTOM_FIELDS,
        start_local: dateToLocalValue(new Date()),
        end_local: null,
        feeding_type: null,
        feeding_type_needs_confirmation: false,
        timer_requested: false,
        feeding_volume_ml: null,
        feeding_side: null,
        diaper_type: null,
        note: null,
        shopping_title: editingDraft.shopping_title ?? '',
        shopping_category: editingDraft.shopping_category ?? 'other',
      });
      setVolumeInput('');
      setEditedTimeField(null);
      return;
    }
    updateDraft({
      type,
      ...EMPTY_SHOPPING_FIELDS,
      ...EMPTY_PLANNER_FIELDS,
      ...EMPTY_CUSTOM_FIELDS,
      end_local: type === 'diaper' ? null : editingDraft.end_local,
      feeding_type:
        type === 'feeding' ? editingDraft.feeding_type ?? 'BOTTLE' : null,
      feeding_type_needs_confirmation: false,
      timer_requested: false,
      feeding_volume_ml: type === 'feeding' ? editingDraft.feeding_volume_ml : null,
      feeding_side: type === 'feeding' ? editingDraft.feeding_side : null,
      diaper_type: type === 'diaper' ? editingDraft.diaper_type ?? 'WET' : null,
    });
    if (type !== 'feeding') setVolumeInput('');
  };

  const saveEditing = () => {
    if (editingIndex === null || !editingDraft) return;
    if (editingDraft.type === 'planner') {
      const title = (editingDraft.planner_title ?? '').trim();
      if (!title) {
        Alert.alert(t('voice.planner'), t('voice.plannerTitleRequired'));
        return;
      }
      const start = localTimeToDate(editingDraft.start_local);
      const end = localTimeToDate(editingDraft.end_local);
      if (!start) {
        Alert.alert(t('voice.invalidTimeTitle'), t('voice.invalidStart'));
        return;
      }
      if (end && end.getTime() < start.getTime()) {
        Alert.alert(t('voice.invalidTimeTitle'), t('voice.invalidEnd'));
        return;
      }
      const isTodo = editingDraft.planner_kind === 'todo';
      const plannerEntry: VoiceLogParsedEntry = {
        ...editingDraft,
        planner_kind: isTodo ? 'todo' : 'event',
        planner_title: title,
        planner_location: isTodo ? null : editingDraft.planner_location?.trim() || null,
        end_local: isTodo || editingDraft.planner_all_day ? null : editingDraft.end_local,
        timer_requested: false,
      };
      setEntries((current) =>
        current.map((entry, index) => (index === editingIndex ? plannerEntry : entry)),
      );
      setSelected((current) => current.map((value, index) => (index === editingIndex ? true : value)));
      cancelEditing();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    if (editingDraft.type === 'shopping') {
      const title = (editingDraft.shopping_title ?? '').trim();
      if (!title) {
        Alert.alert(t('voice.shopping'), t('voice.shoppingTitleRequired'));
        return;
      }
      const rawQuantity = shoppingQuantityInput.trim();
      const parsedQuantity = rawQuantity ? Number(rawQuantity.replace(',', '.')) : null;
      if (parsedQuantity !== null && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)) {
        Alert.alert(t('voice.invalidAmountTitle'), t('voice.shoppingQuantityInvalid'));
        return;
      }
      const shoppingEntry: VoiceLogParsedEntry = {
        ...editingDraft,
        shopping_title: title,
        shopping_quantity_value: parsedQuantity,
        shopping_quantity_unit:
          parsedQuantity !== null ? (editingDraft.shopping_quantity_unit?.trim() || null) : null,
        shopping_category: editingDraft.shopping_category ?? 'other',
      };
      setEntries((current) =>
        current.map((entry, index) => (index === editingIndex ? shoppingEntry : entry)),
      );
      setSelected((current) => current.map((value, index) => (index === editingIndex ? true : value)));
      cancelEditing();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    if (editingDraft.type === 'custom') {
      const name = editingDraft.custom_name?.trim() ?? '';
      const trackingMode = editingDraft.custom_tracking_mode ?? 'event';
      const unit = trackingMode === 'quantity' ? editingDraft.custom_unit?.trim() || null : null;
      if (!name) {
        Alert.alert(t('common.notice'), t('custom.requiredName'));
        return;
      }
      if (trackingMode === 'quantity' && !unit) {
        Alert.alert(t('common.notice'), t('custom.requiredUnit'));
        return;
      }

      const shouldLog = editingDraft.custom_log_entry;
      const start = localTimeToDate(editingDraft.start_local);
      const end = localTimeToDate(editingDraft.end_local);
      if (shouldLog && !start) {
        Alert.alert(t('voice.invalidTimeTitle'), t('voice.invalidStart'));
        return;
      }
      if (shouldLog && end && start && end.getTime() < start.getTime()) {
        Alert.alert(t('voice.invalidTimeTitle'), t('voice.invalidEnd'));
        return;
      }

      const parsedQuantity = customQuantityInput.trim()
        ? Number(customQuantityInput.replace(',', '.'))
        : null;
      if (
        shouldLog &&
        trackingMode === 'quantity' &&
        (parsedQuantity === null || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0)
      ) {
        Alert.alert(t('common.notice'), t('custom.invalidQuantity'));
        return;
      }
      const timerRequested =
        shouldLog &&
        trackingMode === 'duration' &&
        editingDraft.timer_requested === true &&
        end === null;
      if (
        shouldLog &&
        trackingMode === 'duration' &&
        !timerRequested &&
        (!start || !end || end.getTime() <= start.getTime())
      ) {
        Alert.alert(t('common.notice'), t('custom.invalidDuration'));
        return;
      }

      const customEntry: VoiceLogParsedEntry = {
        ...editingDraft,
        end_local: trackingMode === 'duration' && shouldLog ? editingDraft.end_local : null,
        timer_requested: timerRequested,
        note: shouldLog ? editingDraft.note?.trim() || null : null,
        custom_name: name,
        custom_emoji: normalizeCustomActivityEmoji(editingDraft.custom_emoji, name),
        custom_color: editingDraft.custom_color || '#5E3DB3',
        custom_tracking_mode: trackingMode,
        custom_quantity: trackingMode === 'quantity' ? parsedQuantity : null,
        custom_unit: unit,
      };
      setEntries((current) =>
        current.map((entry, index) => (index === editingIndex ? customEntry : entry)),
      );
      setSelected((current) => current.map((value, index) => (index === editingIndex ? true : value)));
      cancelEditing();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    if (editingDraft.type === 'feeding' && editingDraft.feeding_type_needs_confirmation) {
      Alert.alert(
        t('voice.chooseFeeding'),
        t('voice.chooseFeedingBody'),
      );
      return;
    }
    const start = localTimeToDate(editingDraft.start_local);
    const end = localTimeToDate(editingDraft.end_local);
    if (!start) {
      Alert.alert(t('voice.invalidTimeTitle'), t('voice.invalidStart'));
      return;
    }
    if (end && end.getTime() < start.getTime()) {
      Alert.alert(t('voice.invalidTimeTitle'), t('voice.invalidEnd'));
      return;
    }
    const timerRequested =
      editingDraft.type !== 'diaper' &&
      editingDraft.timer_requested === true &&
      end === null;

    let normalizedEntry: VoiceLogParsedEntry = { ...editingDraft };
    if (editingDraft.type === 'feeding') {
      const feedingType = editingDraft.feeding_type ?? 'BOTTLE';
      const usesVolume = feedingType === 'BOTTLE' || feedingType === 'PUMP' || feedingType === 'WATER';
      const parsedVolume = volumeInput.trim() ? Number(volumeInput.replace(',', '.')) : null;
      if (
        usesVolume &&
        parsedVolume !== null &&
        (!Number.isFinite(parsedVolume) || parsedVolume <= 0)
      ) {
        Alert.alert(t('voice.invalidAmountTitle'), t('voice.invalidAmountBody'));
        return;
      }
      normalizedEntry = {
        ...normalizedEntry,
        feeding_type: feedingType,
        feeding_type_needs_confirmation: false,
        timer_requested: timerRequested,
        feeding_volume_ml:
          usesVolume && parsedVolume !== null ? Math.round(parsedVolume) : null,
        feeding_side:
          feedingType === 'BREAST' || feedingType === 'PUMP'
            ? editingDraft.feeding_side ?? 'BOTH'
            : null,
        diaper_type: null,
      };
    } else if (editingDraft.type === 'diaper') {
      normalizedEntry = {
        ...normalizedEntry,
        end_local: null,
        feeding_type: null,
        feeding_type_needs_confirmation: false,
        timer_requested: false,
        feeding_volume_ml: null,
        feeding_side: null,
        diaper_type: editingDraft.diaper_type ?? 'WET',
      };
    } else {
      normalizedEntry = {
        ...normalizedEntry,
        feeding_type: null,
        feeding_type_needs_confirmation: false,
        timer_requested: timerRequested,
        feeding_volume_ml: null,
        feeding_side: null,
        diaper_type: null,
      };
    }

    setEntries((current) =>
      current.map((entry, index) => (index === editingIndex ? normalizedEntry : entry)),
    );
    setSelected((current) => current.map((value, index) => (index === editingIndex ? true : value)));
    cancelEditing();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const selectedEntries = entries.filter((_, index) => selected[index]);
  const hasUnconfirmedMilkChoice = selectedEntries.some(
    (entry) => entry.type === 'feeding' && entry.feeding_type_needs_confirmation,
  );

  const confirmMilkFeedingType = (index: number, feedingType: 'BREAST' | 'BOTTLE') => {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              feeding_type: feedingType,
              feeding_type_needs_confirmation: false,
              feeding_volume_ml:
                feedingType === 'BOTTLE' ? entry.feeding_volume_ml : null,
              feeding_side: feedingType === 'BREAST' ? entry.feeding_side : null,
            }
          : entry,
      ),
    );
    Haptics.selectionAsync().catch(() => {});
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert(t('common.notice'), t('voice.login'));
      return;
    }
    if (selectedEntries.length === 0) return;
    if (hasUnconfirmedMilkChoice) {
      Alert.alert(
        t('voice.chooseFeeding'),
        t('voice.chooseFeedingFirst'),
      );
      return;
    }

    setPhase('saving');
    const { savedCount, failedCount } = await saveVoiceLogEntries(
      selectedEntries,
      userId,
      babyId,
      locale,
    );

    if (savedCount > 0) {
      onSaved();
    }
    if (failedCount > 0) {
      Alert.alert(
        t('voice.entry'),
        savedCount > 0
          ? t('voice.partialSave', { saved: savedCount, failed: failedCount })
          : t('voice.saveFailed'),
      );
      setPhase(savedCount > 0 ? 'idle' : 'review');
      if (savedCount > 0) closeModal();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    closeModal();
  };

  const renderIdle = () => (
    <Animated.View style={styles.centerBlock} entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)}>
      <Text style={[styles.stateTitle, { color: textPrimary }]}>
        {isPregnancy ? t('voice.aiGreetingPregnancy') : t('voice.aiGreeting')}
      </Text>
      <Text style={[styles.stateHint, { color: textSecondary }]}>
        {t(isPregnancy ? 'voice.idleHintPregnancy' : 'voice.idleHint')}
      </Text>
      <TouchableOpacity
        onPress={startRecording}
        activeOpacity={0.85}
        style={styles.recordTrigger}
        accessibilityRole="button"
        accessibilityLabel={t('voice.tap')}
      >
        <VoiceOrb mode="idle" size={78} accent={accentColor} isDark={isDark} />
        <Text style={[styles.recordActionLabel, { color: accentColor }]}>{t('voice.tap')}</Text>
      </TouchableOpacity>
      <View style={[styles.exampleBox, { backgroundColor: sectionBg, borderColor: sectionBorder }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={17} color={textSecondary} />
        <Text style={[styles.exampleText, { color: textSecondary }]}>
          {isPregnancy ? t('voice.examplePregnancy') : `${babyName ? `${babyName} ` : ''}${t('voice.example')}`}
        </Text>
      </View>
    </Animated.View>
  );

  const renderRecording = () => (
    <Animated.View style={styles.centerBlock} entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)}>
      <View style={[styles.listeningBadge, { backgroundColor: `${accentColor}14` }]}>
        <View style={[styles.liveDot, { backgroundColor: accentColor }]} />
        <Text style={[styles.listeningText, { color: accentColor }]}>{t('voice.listening')}</Text>
      </View>
      <Text style={[styles.recordingTimer, { color: textPrimary }]}>
        {formatSeconds(recorderState.durationMillis)}
      </Text>
      <View style={[styles.waveformShell, { backgroundColor: sectionBg }]}>
        <VoiceWaveform metering={recorderState.metering} color={accentColor} />
      </View>
      <TouchableOpacity
        style={[styles.stopButton, { backgroundColor: accentColor }]}
        onPress={stopAndProcess}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('common.done')}
      >
        <Ionicons name="stop" size={17} color={isDark ? '#1A1024' : '#FFFFFF'} />
        <Text style={[styles.stopButtonText, { color: isDark ? '#1A1024' : '#FFFFFF' }]}>
          {t('common.done')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={cancelRecording} activeOpacity={0.7} style={styles.ghostButton}>
        <Text style={[styles.ghostButtonText, { color: textSecondary }]}>{t('common.cancel')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderProcessing = (label: string, mode: 'thinking' | 'done') => (
    <Animated.View style={styles.centerBlock} entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)}>
      <VoiceOrb mode={mode} size={72} accent={accentColor} isDark={isDark} />
      <Text style={[styles.stateTitle, { color: textPrimary }]}>{label}</Text>
    </Animated.View>
  );

  const renderEditor = () => {
    if (!editingDraft) return null;
    const start = localTimeToDate(editingDraft.start_local) ?? new Date();
    const end = localTimeToDate(editingDraft.end_local);
    const selectedTime =
      editedTimeField === 'end'
        ? end ?? new Date(start.getTime() + 60 * 60 * 1000)
        : start;
    const inputBackground = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.72)';
    const currentEntryTypeOptions =
      editingDraft.type === 'custom'
        ? [
            ...entryTypeOptions,
            { value: 'custom' as const, labelKey: 'custom.add' as const },
          ]
        : entryTypeOptions;

    const renderOptions = <T extends string>(
      options: { value: T; labelKey: DailyTranslationKey }[],
      value: T | null,
      onChange: (next: T) => void,
    ) => (
      <View style={styles.optionWrap}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionChip,
                {
                  backgroundColor: active ? accentColor : inputBackground,
                  borderColor: active ? accentColor : sectionBorder,
                },
              ]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.optionChipText, { color: active ? '#FFF' : textPrimary }]}>
                {t(option.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    return (
      <View>
        <View style={styles.editorHeader}>
          <View style={styles.editorHeadingWrap}>
            <Text
              style={[styles.sectionTitle, { color: textPrimary, marginBottom: 2 }]}
            >
              {t('voice.edit')}
            </Text>
            <Text
              style={[styles.editorSubtitle, { color: textSecondary }]}
            >
              {t('voice.editHint')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={cancelEditing}
            style={[styles.editorCloseButton, { backgroundColor: sectionBg }]}
            accessibilityRole="button"
            accessibilityLabel={t('voice.closeEdit')}
          >
            <Text style={[styles.editorCloseText, { color: textPrimary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.kind')}</Text>
        {renderOptions(
          currentEntryTypeOptions,
          editingDraft.type,
          updateEntryType,
        )}

        {editingDraft.type === 'custom' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('custom.name')}</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: textPrimary,
                  backgroundColor: inputBackground,
                  borderColor: sectionBorder,
                  opacity: editingDraft.custom_create_type ? 1 : 0.72,
                },
              ]}
              value={editingDraft.custom_name ?? ''}
              onChangeText={(name) => updateDraft({ custom_name: name })}
              placeholder={t('custom.namePlaceholder')}
              placeholderTextColor={textSecondary}
              maxLength={40}
              editable={editingDraft.custom_create_type}
            />

            {editingDraft.custom_create_type ? (
              <>
                <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('custom.emoji')}</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.customEmojiInput,
                    { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
                  ]}
                  value={editingDraft.custom_emoji ?? ''}
                  onChangeText={(emoji) => updateDraft({ custom_emoji: emoji || null })}
                  placeholder="⭐️"
                  placeholderTextColor={textSecondary}
                  maxLength={32}
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel={t('custom.emoji')}
                />
                <Text style={[styles.fieldHint, { color: textSecondary }]}>
                  {t('custom.emojiHint')}
                </Text>

                <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('custom.tracking')}</Text>
                {renderOptions(
                  [
                    { value: 'event' as const, labelKey: 'custom.event' as const },
                    { value: 'quantity' as const, labelKey: 'custom.quantity' as const },
                    { value: 'duration' as const, labelKey: 'custom.duration' as const },
                  ],
                  editingDraft.custom_tracking_mode,
                  (trackingMode) =>
                    updateDraft({
                      custom_tracking_mode: trackingMode,
                      custom_quantity: trackingMode === 'quantity' ? editingDraft.custom_quantity : null,
                      custom_unit: trackingMode === 'quantity' ? editingDraft.custom_unit : null,
                      end_local: trackingMode === 'duration' ? editingDraft.end_local : null,
                      timer_requested: false,
                    }),
                )}
                <TouchableOpacity
                  style={[
                    styles.optionChip,
                    {
                      alignSelf: 'flex-start',
                      marginTop: 14,
                      backgroundColor: editingDraft.custom_log_entry ? accentColor : inputBackground,
                      borderColor: editingDraft.custom_log_entry ? accentColor : sectionBorder,
                    },
                  ]}
                  onPress={() => updateDraft({ custom_log_entry: !editingDraft.custom_log_entry })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: editingDraft.custom_log_entry }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: editingDraft.custom_log_entry ? '#FFF' : textPrimary },
                    ]}
                  >
                    {editingDraft.custom_log_entry
                      ? t('voice.customLogNow')
                      : t('voice.customCreateOnly')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {editingDraft.custom_tracking_mode === 'quantity' ? (
              <>
                {editingDraft.custom_create_type ? (
                  <>
                    <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('custom.unit')}</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
                      ]}
                      value={editingDraft.custom_unit ?? ''}
                      onChangeText={(unit) => updateDraft({ custom_unit: unit || null })}
                      placeholder={t('custom.unitPlaceholder')}
                      placeholderTextColor={textSecondary}
                      maxLength={20}
                    />
                  </>
                ) : null}
                {editingDraft.custom_log_entry ? (
                  <>
                    <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('custom.amount')}</Text>
                    <View style={styles.shoppingQuantityRow}>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.shoppingQuantityInput,
                          { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
                        ]}
                        value={customQuantityInput}
                        onChangeText={setCustomQuantityInput}
                        placeholder="1"
                        placeholderTextColor={textSecondary}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        maxLength={12}
                      />
                      <View style={[styles.textInput, styles.shoppingUnitInput, { backgroundColor: inputBackground, borderColor: sectionBorder, justifyContent: 'center' }]}>
                        <Text style={{ color: textSecondary }}>{editingDraft.custom_unit}</Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </>
            ) : null}

            {editingDraft.custom_log_entry && editingDraft.custom_tracking_mode === 'duration' ? (
              <TouchableOpacity
                style={[
                  styles.optionChip,
                  {
                    alignSelf: 'flex-start',
                    marginTop: 14,
                    backgroundColor: editingDraft.timer_requested ? accentColor : inputBackground,
                    borderColor: editingDraft.timer_requested ? accentColor : sectionBorder,
                  },
                ]}
                onPress={() =>
                  updateDraft({
                    timer_requested: !editingDraft.timer_requested,
                    end_local: !editingDraft.timer_requested ? null : editingDraft.end_local,
                  })
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: editingDraft.timer_requested }}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { color: editingDraft.timer_requested ? '#FFF' : textPrimary },
                  ]}
                >
                  {editingDraft.timer_requested ? t('input.timerRunning') : t('custom.startTimer')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {editingDraft.type === 'shopping' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.shoppingTitle')}</Text>
            <TextInput
              style={[
                styles.textInput,
                { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
              ]}
              value={editingDraft.shopping_title ?? ''}
              onChangeText={(title) => updateDraft({ shopping_title: title })}
              placeholder={t('voice.shoppingTitlePlaceholder')}
              placeholderTextColor={textSecondary}
              maxLength={120}
              autoCapitalize="sentences"
            />

            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.shoppingQuantity')}</Text>
            <View style={styles.shoppingQuantityRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.shoppingQuantityInput,
                  { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
                ]}
                value={shoppingQuantityInput}
                onChangeText={setShoppingQuantityInput}
                placeholder={t('voice.shoppingQuantityPlaceholder')}
                placeholderTextColor={textSecondary}
                keyboardType="decimal-pad"
                inputMode="decimal"
                maxLength={6}
                selectTextOnFocus
              />
              <TextInput
                style={[
                  styles.textInput,
                  styles.shoppingUnitInput,
                  { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
                ]}
                value={editingDraft.shopping_quantity_unit ?? ''}
                onChangeText={(unit) => updateDraft({ shopping_quantity_unit: unit || null })}
                placeholder={t('voice.shoppingUnitPlaceholder')}
                placeholderTextColor={textSecondary}
                maxLength={30}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.shoppingCategory')}</Text>
            {renderOptions(
              SHOPPING_CATEGORY_OPTIONS,
              editingDraft.shopping_category,
              (category) => updateDraft({ shopping_category: category }),
            )}
          </>
        ) : null}

        {editingDraft.type === 'planner' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.plannerKind')}</Text>
            {renderOptions(
              PLANNER_KIND_OPTIONS,
              editingDraft.planner_kind ?? 'event',
              (kind) =>
                updateDraft({
                  planner_kind: kind,
                  end_local: kind === 'todo' ? null : editingDraft.end_local,
                  planner_location: kind === 'todo' ? null : editingDraft.planner_location,
                }),
            )}

            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.plannerTitle')}</Text>
            <TextInput
              style={[
                styles.textInput,
                { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
              ]}
              value={editingDraft.planner_title ?? ''}
              onChangeText={(title) => updateDraft({ planner_title: title })}
              placeholder={t('voice.plannerTitlePlaceholder')}
              placeholderTextColor={textSecondary}
              maxLength={120}
              autoCapitalize="sentences"
            />

            {editingDraft.planner_kind !== 'todo' ? (
              <>
                <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.plannerLocation')}</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
                  ]}
                  value={editingDraft.planner_location ?? ''}
                  onChangeText={(location) => updateDraft({ planner_location: location || null })}
                  placeholder={t('voice.plannerLocationPlaceholder')}
                  placeholderTextColor={textSecondary}
                  maxLength={120}
                />
              </>
            ) : null}

            <TouchableOpacity
              style={[
                styles.optionChip,
                {
                  alignSelf: 'flex-start',
                  marginTop: 14,
                  backgroundColor: editingDraft.planner_all_day ? accentColor : inputBackground,
                  borderColor: editingDraft.planner_all_day ? accentColor : sectionBorder,
                },
              ]}
              onPress={() =>
                updateDraft({
                  planner_all_day: !editingDraft.planner_all_day,
                  end_local: !editingDraft.planner_all_day ? null : editingDraft.end_local,
                })
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: editingDraft.planner_all_day }}
            >
              <Text style={[styles.optionChipText, { color: editingDraft.planner_all_day ? '#FFF' : textPrimary }]}>
                {editingDraft.planner_all_day ? '✓ ' : ''}{t('voice.plannerAllDay')}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        {editingDraft.type !== 'shopping' &&
        !(editingDraft.type === 'custom' && !editingDraft.custom_log_entry) ? (
          <>
        <Text style={[styles.fieldLabel, { color: textPrimary }]}>
          {editingDraft.type === 'planner'
            ? editingDraft.planner_kind === 'todo'
              ? t('voice.plannerDue')
              : t('voice.startTime')
            : t('voice.startTime')}
        </Text>
        <TouchableOpacity
          style={[
            styles.timeButton,
            { backgroundColor: inputBackground, borderColor: sectionBorder },
          ]}
          onPress={() => setEditedTimeField('start')}
          activeOpacity={0.8}
        >
          <Text style={[styles.timeButtonText, { color: textPrimary }]}>{formatEditorDate(start, localeTag)}</Text>
          <Text style={[styles.timeButtonAction, { color: accentColor }]}>{t('voice.change')}</Text>
        </TouchableOpacity>

        {editingDraft.type !== 'diaper' &&
        !(editingDraft.type === 'custom' && editingDraft.custom_tracking_mode !== 'duration') &&
        !(editingDraft.type === 'planner' && (editingDraft.planner_kind === 'todo' || editingDraft.planner_all_day)) ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.endTime')}</Text>
            {end ? (
              <View style={styles.endTimeRow}>
                <TouchableOpacity
                  style={[
                    styles.timeButton,
                    styles.endTimeButton,
                    { backgroundColor: inputBackground, borderColor: sectionBorder },
                  ]}
                  onPress={() => setEditedTimeField('end')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeButtonText, { color: textPrimary }]}>{formatEditorDate(end, localeTag)}</Text>
                  <Text style={[styles.timeButtonAction, { color: accentColor }]}>{t('voice.change')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removeTimeButton, { borderColor: sectionBorder }]}
                  onPress={() => {
                    updateDraft({ end_local: null, timer_requested: false });
                    if (editedTimeField === 'end') setEditedTimeField(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('voice.removeEnd')}
                >
                  <Text style={[styles.removeTimeText, { color: textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addTimeButton, { borderColor: sectionBorder }]}
                onPress={() => {
                  const nextEnd = new Date(start.getTime() + 60 * 60 * 1000);
                  updateDraft({
                    end_local: dateToLocalValue(nextEnd),
                    timer_requested: false,
                  });
                  setEditedTimeField('end');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.addTimeText, { color: accentColor }]}>{t('voice.addEnd')}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : null}

        {editedTimeField ? (
          <View
            style={[
              styles.pickerWrap,
              { borderColor: sectionBorder, backgroundColor: inputBackground },
            ]}
          >
            <DateTimePicker
              value={selectedTime}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              locale={localeTag}
              is24Hour
              maximumDate={editedTimeField === 'start' && editingDraft.type !== 'planner' ? new Date() : undefined}
              minimumDate={editedTimeField === 'end' ? start : undefined}
              themeVariant={isDark ? 'dark' : 'light'}
              accentColor={accentColor}
              onChange={(event, date) => {
                if (event.type === 'dismissed') {
                  setEditedTimeField(null);
                  return;
                }
                if (!date) return;
                updateDraft(
                  editedTimeField === 'start'
                    ? { start_local: dateToLocalValue(date) }
                    : { end_local: dateToLocalValue(date), timer_requested: false },
                );
                if (Platform.OS !== 'ios') setEditedTimeField(null);
              }}
            />
            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                style={[styles.pickerDoneButton, { backgroundColor: accentColor }]}
                onPress={() => setEditedTimeField(null)}
              >
                <Text style={styles.pickerDoneText}>{t('common.done')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {editingDraft.type === 'feeding' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.feeding')}</Text>
            {renderOptions(
              feedingTypeOptions,
              editingDraft.feeding_type,
              (feedingType) => {
                updateDraft({
                  feeding_type: feedingType,
                  feeding_type_needs_confirmation: false,
                  feeding_side:
                    feedingType === 'BREAST' || feedingType === 'PUMP'
                      ? editingDraft.feeding_side ?? 'BOTH'
                      : null,
                });
              },
            )}

            {editingDraft.feeding_type === 'BOTTLE' ||
            editingDraft.feeding_type === 'PUMP' ||
            editingDraft.feeding_type === 'WATER' ? (
              <>
                <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.amountOptional')}</Text>
                <View
                  style={[
                    styles.volumeInputWrap,
                    { backgroundColor: inputBackground, borderColor: sectionBorder },
                  ]}
                >
                  <TextInput
                    style={[styles.volumeInput, { color: textPrimary }]}
                    value={volumeInput}
                    onChangeText={setVolumeInput}
                    placeholder="120"
                    placeholderTextColor={textSecondary}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={4}
                    selectTextOnFocus
                    accessibilityLabel={t('voice.amountA11y')}
                  />
                  <Text style={[styles.volumeUnit, { color: textSecondary }]}>ml</Text>
                </View>
              </>
            ) : null}

            {editingDraft.feeding_type === 'BREAST' || editingDraft.feeding_type === 'PUMP' ? (
              <>
                <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('input.side')}</Text>
                {renderOptions(
                  feedingSideOptions,
                  editingDraft.feeding_side,
                  (feedingSide) => updateDraft({ feeding_side: feedingSide }),
                )}
              </>
            ) : null}
          </>
        ) : null}

        {editingDraft.type === 'diaper' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.diaper')}</Text>
            {renderOptions(
              diaperTypeOptions,
              editingDraft.diaper_type,
              (diaperType) => updateDraft({ diaper_type: diaperType }),
            )}
          </>
        ) : null}

        {editingDraft.type !== 'custom' || editingDraft.custom_log_entry ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>{t('voice.noteOptional')}</Text>
            <TextInput
              style={[
                styles.noteInput,
                { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
              ]}
              value={editingDraft.note ?? ''}
              onChangeText={(note) => updateDraft({ note: note || null })}
              placeholder={t('voice.notePlaceholder')}
              placeholderTextColor={textSecondary}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
          </>
        ) : null}
          </>
        ) : null}

        <View style={styles.recordingActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: sectionBorder }]}
            onPress={cancelEditing}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: textSecondary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={saveEditing}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>{t('voice.apply')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderReview = () => (
    <View>
      {editingDraft ? (
        renderEditor()
      ) : (
        <>
      <Animated.View entering={FadeIn.duration(320)} style={styles.understoodRow}>
        <View style={[styles.statusIcon, { backgroundColor: `${accentColor}16` }]}>
          <Ionicons
            name={entries.length === 0 ? 'alert-circle-outline' : 'checkmark'}
            size={20}
            color={accentColor}
          />
        </View>
        <View style={styles.understoodTextWrap}>
          <Text style={[styles.understoodTitle, { color: textPrimary }]}>
            {entries.length === 0 ? t('voice.notUnderstood') : t('voice.understood').replace(' ✨', '')}
          </Text>
          <Text style={[styles.understoodHint, { color: textSecondary }]}>
            {entries.length === 0 ? t('voice.none') : t('voice.understoodHint')}
          </Text>
        </View>
      </Animated.View>

      {transcript ? (
        <Animated.View
          entering={FadeInUp.delay(160).duration(320)}
          style={[styles.transcriptBox, { backgroundColor: sectionBg, borderColor: sectionBorder }]}
        >
          <Ionicons name="mic-outline" size={16} color={textSecondary} />
          <Text style={[styles.transcriptText, { color: textSecondary }]}>„{transcript}“</Text>
        </Animated.View>
      ) : null}

      {entries.length === 0 ? (
        <Animated.View entering={FadeInUp.delay(260).duration(320)} style={styles.centerBlock}>
          <Text style={[styles.hintText, { color: textSecondary }]}>
            {t('voice.none')}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor, marginTop: 16 }]}
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>{t('voice.newRecording')}</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <>
          <Animated.Text entering={FadeInUp.delay(260).duration(300)} style={[styles.sectionTitle, { color: textPrimary }]}>
            {t('voice.detected')}
          </Animated.Text>
          {entries.map((entry, index) => {
            const { emoji, title, timeText } = describeVoiceLogEntry(entry, locale);
            const isActive = selected[index];
            const needsMilkChoice =
              entry.type === 'feeding' && entry.feeding_type_needs_confirmation;
            return (
              <Animated.View
                key={`${entry.type}-${index}`}
                entering={FadeInUp.delay(300 + index * 90).duration(320)}
                style={[
                  styles.entryRow,
                  {
                    backgroundColor: isActive ? `${accentColor}09` : sectionBg,
                    borderColor: isActive ? accentColor : sectionBorder,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.entrySelectButton}
                  onPress={() => toggleEntry(index)}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${title} ${isActive ? t('voice.selected') : t('voice.notSelected')}`}
                >
                  <View
                    style={[styles.entryIcon, { backgroundColor: `${accentColor}12` }]}
                  >
                    {entry.type === 'custom' ? (
                      <Text allowFontScaling={false} style={styles.customEntryEmoji}>{emoji}</Text>
                    ) : (
                      <Ionicons name={getEntryIconName(entry.type)} size={18} color={accentColor} />
                    )}
                  </View>
                  <View style={styles.entryTextWrap}>
                    <Text style={[styles.entryTitle, { color: textPrimary }]}>{title}</Text>
                    {timeText || entry.note ? (
                      <Text
                        style={[styles.entryTime, { color: textSecondary }]}
                      >
                        {timeText}
                        {entry.note ? `${timeText ? ' · ' : ''}${entry.note}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isActive ? accentColor : textSecondary}
                  />
                </TouchableOpacity>
                {isActive && needsMilkChoice ? (
                  <View
                    style={[
                      styles.milkChoiceBox,
                      { borderTopColor: accentColor },
                    ]}
                  >
                    <Text
                      style={[styles.milkChoiceTitle, { color: textPrimary }]}
                    >
                      {t('voice.milkQuestion')}
                    </Text>
                    <Text
                      style={[styles.milkChoiceHint, { color: textSecondary }]}
                    >
                      {t('voice.milkHint')}
                    </Text>
                    <View style={styles.milkChoiceActions}>
                      {([
                        { value: 'BREAST' as const, label: t('feeding.breast') },
                        { value: 'BOTTLE' as const, label: t('card.bottle') },
                      ]).map((option) => {
                        const isSuggested = entry.feeding_type === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.milkChoiceButton,
                              {
                                borderColor: isSuggested ? accentColor : sectionBorder,
                                backgroundColor: isSuggested
                                  ? `${accentColor}18`
                                  : 'transparent',
                              },
                            ]}
                            onPress={() => confirmMilkFeedingType(index, option.value)}
                            activeOpacity={0.8}
                            accessibilityRole="radio"
                            accessibilityLabel={
                              isSuggested
                                ? `${option.label}, ${t('voice.suggested')}`
                                : option.label
                            }
                          >
                            <Text
                              style={[styles.milkChoiceButtonText, { color: textPrimary }]}
                            >
                              {option.label}
                            </Text>
                            {isSuggested ? (
                              <Text
                                style={[styles.milkChoiceSuggested, { color: accentColor }]}
                              >
                                {t('voice.suggested')}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.editEntryButton, { borderTopColor: sectionBorder }]}
                  onPress={() => beginEditing(index)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('voice.editA11y', { title })}
                >
                  <Ionicons name="create-outline" size={16} color={accentColor} />
                  <Text style={[styles.editEntryButtonText, { color: accentColor }]}>{t('voice.edit')}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          <Animated.View entering={FadeInUp.delay(320 + entries.length * 90).duration(300)} style={styles.recordingActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: sectionBorder }]}
              onPress={reset}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: textSecondary }]}>
                {t('voice.newRecording')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: accentColor,
                  opacity:
                    selectedEntries.length === 0 || hasUnconfirmedMilkChoice ? 0.5 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={selectedEntries.length === 0 || hasUnconfirmedMilkChoice}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {hasUnconfirmedMilkChoice
                  ? t('voice.chooseFeeding')
                  : selectedEntries.length === 1
                  ? t('voice.saveOne')
                  : t('voice.saveMany', { count: selectedEntries.length })}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
        </>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} activeOpacity={1} />

        <View
          style={[
            styles.panel,
            {
              backgroundColor: panelColor,
              borderColor: sectionBorder,
            },
          ]}
        >
          <View style={styles.handleArea}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#514B54' : '#D9D3DC' }]} />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={[styles.headerTitle, { color: textPrimary }]}>{t('voice.title')}</Text>
                <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                  {isPregnancy ? t('voice.subtitlePregnancy') : t('voice.subtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeModal}
                activeOpacity={0.72}
                style={[styles.closeButton, { backgroundColor: sectionBg }]}
                accessibilityRole="button"
                accessibilityLabel={`${t('common.cancel')} · ${t('voice.title')}`}
              >
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {phase === 'idle' && renderIdle()}
            {phase === 'recording' && renderRecording()}
            {phase === 'processing' && renderProcessing(t('voice.processing'), 'thinking')}
            {phase === 'saving' && renderProcessing(t('voice.saving'), 'done')}
            {phase === 'review' && renderReview()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: 'hidden',
    maxHeight: '90%',
    boxShadow: '0 -8px 30px rgba(24, 18, 27, 0.08)',
  },
  handleArea: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollInner: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  stateTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  stateHint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  recordTrigger: {
    alignItems: 'center',
    marginTop: 18,
  },
  recordActionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: -2,
  },
  exampleBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 22,
  },
  exampleText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listeningText: {
    fontSize: 12,
    fontWeight: '700',
  },
  waveformShell: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    borderCurve: 'continuous',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 20,
  },
  stopButton: {
    minWidth: 136,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    marginTop: 22,
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  ghostButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  understoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  understoodTextWrap: {
    flex: 1,
  },
  understoodTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  understoodHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  recordingTimer: {
    fontSize: 44,
    fontWeight: '500',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginTop: 18,
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  transcriptBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 16,
  },
  transcriptText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  entryRow: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  entrySelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customEntryEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  entryTextWrap: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  entryTime: {
    fontSize: 12,
    marginTop: 2,
  },
  milkChoiceBox: {
    borderTopWidth: 1.5,
    padding: 12,
  },
  milkChoiceTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  milkChoiceHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  milkChoiceActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  milkChoiceButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  milkChoiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  milkChoiceSuggested: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  editEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  editEntryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  editorHeadingWrap: {
    flex: 1,
  },
  editorSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  editorCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorCloseText: {
    fontSize: 15,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 14,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timeButtonAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  endTimeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  endTimeButton: {
    flex: 1,
  },
  removeTimeButton: {
    width: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTimeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  addTimeButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  addTimeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickerWrap: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  pickerDoneButton: {
    alignSelf: 'flex-end',
    borderRadius: 10,
    marginHorizontal: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  pickerDoneText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  volumeInputWrap: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  volumeInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 10,
  },
  volumeUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  textInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customEmojiInput: {
    width: 76,
    fontSize: 24,
    textAlign: 'center',
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  shoppingQuantityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shoppingQuantityInput: {
    flex: 1,
  },
  shoppingUnitInput: {
    flex: 2,
  },
  noteInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
  },
});

export default VoiceLogModal;
