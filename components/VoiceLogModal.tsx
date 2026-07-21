// Sprach-Logging (Premium) — Aufnahme → KI-Vorschläge → Bestätigen.
//
// Ablauf: Elternteil spricht eine kurze Notiz ein ("Lotti hat um halb drei
// 120 ml Fläschchen getrunken und ich habe sie gewickelt"), die Edge
// Function voice-log-parse transkribiert und extrahiert Einträge, hier
// werden sie zur Bestätigung angezeigt und erst dann gespeichert.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { BlurView } from 'expo-blur';
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
import type { VoiceLogParsedEntry } from '@/lib/voiceLog/types';

const MAX_RECORDING_MS = 60_000;
/** Kürzere Aufnahmen gar nicht erst hochladen (Versehens-Taps kosten sonst API-Calls & Rate-Limit). */
const MIN_RECORDING_MS = 1_000;
const VOICE_LOG_MIME_TYPE = 'audio/mp4';
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
} as const;

const ACCENT_LIGHT = '#9C27B0';
const ACCENT_DARK = '#CE93D8';

type Phase = 'idle' | 'recording' | 'processing' | 'review' | 'saving';
type EditedTimeField = 'start' | 'end';

const ENTRY_TYPE_OPTIONS: { value: VoiceLogParsedEntry['type']; label: string }[] = [
  { value: 'sleep', label: 'Schlaf' },
  { value: 'feeding', label: 'Füttern' },
  { value: 'diaper', label: 'Windel' },
];

const FEEDING_TYPE_OPTIONS: {
  value: NonNullable<VoiceLogParsedEntry['feeding_type']>;
  label: string;
}[] = [
  { value: 'BREAST', label: 'Stillen' },
  { value: 'BOTTLE', label: 'Fläschchen' },
  { value: 'SOLIDS', label: 'Beikost' },
  { value: 'PUMP', label: 'Abpumpen' },
  { value: 'WATER', label: 'Wasser/Tee' },
];

const FEEDING_SIDE_OPTIONS: {
  value: NonNullable<VoiceLogParsedEntry['feeding_side']>;
  label: string;
}[] = [
  { value: 'LEFT', label: 'Links' },
  { value: 'RIGHT', label: 'Rechts' },
  { value: 'BOTH', label: 'Beide' },
];

const DIAPER_TYPE_OPTIONS: {
  value: NonNullable<VoiceLogParsedEntry['diaper_type']>;
  label: string;
}[] = [
  { value: 'WET', label: 'Nass' },
  { value: 'DIRTY', label: 'Stuhlgang' },
  { value: 'BOTH', label: 'Beides' },
];

const dateToLocalValue = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;

const formatEditorDate = (date: Date): string =>
  date.toLocaleString('de-DE', {
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
  onClose: () => void;
  /** Nach erfolgreichem Speichern (Home lädt Einträge/Schlafminuten neu). */
  onSaved: () => void;
};

const formatSeconds = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const VoiceLogModal: React.FC<Props> = ({
  visible,
  userId,
  babyId,
  babyName,
  onClose,
  onSaved,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const overlayColor = isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)';
  const panelColor = isDark ? 'rgba(10,10,12,0.86)' : 'transparent';
  const sectionBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);

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
  }, []);

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

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
        Alert.alert('Mikrofon', 'Bitte erlaube den Mikrofonzugriff, um Einträge einzusprechen.');
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
      Alert.alert('Aufnahme', 'Die Aufnahme konnte nicht gestartet werden.');
      setPhase('idle');
    }
  }, [disableRecordingMode, phase, recorder]);

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
        'Aufnahme zu kurz',
        'Halte den Moment kurz fest — sprich z. B. was, wann und wie viel passiert ist.',
      );
      setPhase('idle');
      return;
    }

    const localUri = recorder.uri || recorderState.url || knownUrlBeforeStop;
    if (!localUri) {
      Alert.alert('Aufnahme', 'Die Aufnahme konnte nicht gelesen werden.');
      setPhase('idle');
      return;
    }

    try {
      const result = await parseVoiceRecording(
        localUri,
        VOICE_LOG_MIME_TYPE,
        babyName,
        babyId,
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
          : 'Die Aufnahme konnte nicht verarbeitet werden.';
      Alert.alert('Sprach-Eintrag', message);
      setPhase('idle');
    }
  }, [babyId, babyName, disableRecordingMode, phase, recorder, recorderState.url]);

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
    setEditedTimeField(null);
    Haptics.selectionAsync().catch(() => {});
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingDraft(null);
    setEditedTimeField(null);
    setVolumeInput('');
  };

  const updateDraft = (changes: Partial<VoiceLogParsedEntry>) => {
    setEditingDraft((current) => (current ? { ...current, ...changes } : current));
  };

  const updateEntryType = (type: VoiceLogParsedEntry['type']) => {
    if (!editingDraft) return;
    updateDraft({
      type,
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
    if (editingDraft.type === 'feeding' && editingDraft.feeding_type_needs_confirmation) {
      Alert.alert(
        'Fütterung auswählen',
        'Bitte bestätige, ob gestillt oder ein Fläschchen gegeben wurde.',
      );
      return;
    }
    const start = localTimeToDate(editingDraft.start_local);
    const end = localTimeToDate(editingDraft.end_local);
    if (!start) {
      Alert.alert('Ungültige Zeit', 'Bitte wähle eine gültige Startzeit.');
      return;
    }
    if (end && end.getTime() < start.getTime()) {
      Alert.alert('Ungültige Zeit', 'Die Endzeit darf nicht vor der Startzeit liegen.');
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
        Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Menge in ml ein.');
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
      Alert.alert('Hinweis', 'Bitte melde dich an, um Einträge zu speichern.');
      return;
    }
    if (selectedEntries.length === 0) return;
    if (hasUnconfirmedMilkChoice) {
      Alert.alert(
        'Fütterung auswählen',
        'Bitte bestätige zuerst, ob gestillt oder ein Fläschchen gegeben wurde.',
      );
      return;
    }

    setPhase('saving');
    const { savedCount, failedCount } = await saveVoiceLogEntries(
      selectedEntries,
      userId,
      babyId,
    );

    if (savedCount > 0) {
      onSaved();
    }
    if (failedCount > 0) {
      Alert.alert(
        'Sprach-Eintrag',
        savedCount > 0
          ? `${savedCount} Einträge gespeichert, ${failedCount} fehlgeschlagen.`
          : 'Die Einträge konnten nicht gespeichert werden.',
      );
      setPhase(savedCount > 0 ? 'idle' : 'review');
      if (savedCount > 0) onClose();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const renderIdle = () => (
    <View style={styles.centerBlock}>
      <Text style={[styles.hintText, { color: textSecondary }]}>
        Sprich einfach ein, was passiert ist — z. B.{' '}
        <Text style={{ fontStyle: 'italic' }}>
          „{babyName || 'Sie'} hat um halb drei 120 ml Fläschchen getrunken und ich habe sie
          frisch gewickelt.“
        </Text>
      </Text>
      <TouchableOpacity
        style={[styles.micButton, { backgroundColor: accentColor }]}
        onPress={startRecording}
        activeOpacity={0.8}
      >
        <Text style={styles.micEmoji}>🎙️</Text>
      </TouchableOpacity>
      <Text style={[styles.microHint, { color: textSecondary }]}>Tippen zum Aufnehmen</Text>
    </View>
  );

  const renderRecording = () => (
    <View style={styles.centerBlock}>
      <Text style={[styles.recordingTimer, { color: textPrimary }]}>
        {formatSeconds(recorderState.durationMillis)}
      </Text>
      <Text style={[styles.microHint, { color: textSecondary }]}>
        Aufnahme läuft … (max. 1 Minute)
      </Text>
      <View style={styles.recordingActions}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: sectionBorder }]}
          onPress={cancelRecording}
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryButtonText, { color: textSecondary }]}>Abbrechen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: accentColor }]}
          onPress={stopAndProcess}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Fertig</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProcessing = (label: string) => (
    <View style={styles.centerBlock}>
      <ActivityIndicator size="large" color={accentColor} />
      <Text style={[styles.microHint, { color: textSecondary, marginTop: 16 }]}>{label}</Text>
    </View>
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

    const renderOptions = <T extends string>(
      options: { value: T; label: string }[],
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
                {option.label}
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
              Eintrag ändern
            </Text>
            <Text
              style={[styles.editorSubtitle, { color: textSecondary }]}
            >
              Prüfe die Details vor dem Speichern.
            </Text>
          </View>
          <TouchableOpacity
            onPress={cancelEditing}
            style={[styles.editorCloseButton, { backgroundColor: sectionBg }]}
            accessibilityRole="button"
            accessibilityLabel="Bearbeitung schließen"
          >
            <Text style={[styles.editorCloseText, { color: textPrimary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { color: textPrimary }]}>Art</Text>
        {renderOptions(
          ENTRY_TYPE_OPTIONS,
          editingDraft.type,
          updateEntryType,
        )}

        <Text style={[styles.fieldLabel, { color: textPrimary }]}>Startzeit</Text>
        <TouchableOpacity
          style={[
            styles.timeButton,
            { backgroundColor: inputBackground, borderColor: sectionBorder },
          ]}
          onPress={() => setEditedTimeField('start')}
          activeOpacity={0.8}
        >
          <Text style={[styles.timeButtonText, { color: textPrimary }]}>{formatEditorDate(start)}</Text>
          <Text style={[styles.timeButtonAction, { color: accentColor }]}>Ändern</Text>
        </TouchableOpacity>

        {editingDraft.type !== 'diaper' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>Endzeit</Text>
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
                  <Text style={[styles.timeButtonText, { color: textPrimary }]}>{formatEditorDate(end)}</Text>
                  <Text style={[styles.timeButtonAction, { color: accentColor }]}>Ändern</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removeTimeButton, { borderColor: sectionBorder }]}
                  onPress={() => {
                    updateDraft({ end_local: null, timer_requested: false });
                    if (editedTimeField === 'end') setEditedTimeField(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Endzeit entfernen"
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
                <Text style={[styles.addTimeText, { color: accentColor }]}>+ Endzeit hinzufügen</Text>
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
              locale="de-DE"
              is24Hour
              maximumDate={editedTimeField === 'start' ? new Date() : undefined}
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
                <Text style={styles.pickerDoneText}>Fertig</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {editingDraft.type === 'feeding' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>Fütterung</Text>
            {renderOptions(
              FEEDING_TYPE_OPTIONS,
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
                <Text style={[styles.fieldLabel, { color: textPrimary }]}>Menge (optional)</Text>
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
                    accessibilityLabel="Menge in Millilitern"
                  />
                  <Text style={[styles.volumeUnit, { color: textSecondary }]}>ml</Text>
                </View>
              </>
            ) : null}

            {editingDraft.feeding_type === 'BREAST' || editingDraft.feeding_type === 'PUMP' ? (
              <>
                <Text style={[styles.fieldLabel, { color: textPrimary }]}>Seite</Text>
                {renderOptions(
                  FEEDING_SIDE_OPTIONS,
                  editingDraft.feeding_side,
                  (feedingSide) => updateDraft({ feeding_side: feedingSide }),
                )}
              </>
            ) : null}
          </>
        ) : null}

        {editingDraft.type === 'diaper' ? (
          <>
            <Text style={[styles.fieldLabel, { color: textPrimary }]}>Windel</Text>
            {renderOptions(
              DIAPER_TYPE_OPTIONS,
              editingDraft.diaper_type,
              (diaperType) => updateDraft({ diaper_type: diaperType }),
            )}
          </>
        ) : null}

        <Text style={[styles.fieldLabel, { color: textPrimary }]}>Notiz (optional)</Text>
        <TextInput
          style={[
            styles.noteInput,
            { color: textPrimary, backgroundColor: inputBackground, borderColor: sectionBorder },
          ]}
          value={editingDraft.note ?? ''}
          onChangeText={(note) => updateDraft({ note: note || null })}
          placeholder="Notiz ergänzen"
          placeholderTextColor={textSecondary}
          multiline
          textAlignVertical="top"
          maxLength={500}
        />

        <View style={styles.recordingActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: sectionBorder }]}
            onPress={cancelEditing}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: textSecondary }]}>Abbrechen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={saveEditing}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Änderung übernehmen</Text>
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
      {transcript ? (
        <View style={[styles.transcriptBox, { backgroundColor: sectionBg, borderColor: sectionBorder }]}>
          <Text style={[styles.transcriptText, { color: textSecondary }]}>„{transcript}“</Text>
        </View>
      ) : null}

      {entries.length === 0 ? (
        <View style={styles.centerBlock}>
          <Text style={[styles.hintText, { color: textSecondary }]}>
            Ich konnte keinen Eintrag erkennen. Versuch es gern noch einmal mit Zeit und
            Aktivität, z. B. „hat vor einer Stunde geschlafen“.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor, marginTop: 16 }]}
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Neue Aufnahme</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Erkannte Einträge</Text>
          {entries.map((entry, index) => {
            const { emoji, title, timeText } = describeVoiceLogEntry(entry);
            const isActive = selected[index];
            const needsMilkChoice =
              entry.type === 'feeding' && entry.feeding_type_needs_confirmation;
            return (
              <View
                key={`${entry.type}-${index}`}
                style={[
                  styles.entryRow,
                  {
                    backgroundColor: sectionBg,
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
                  accessibilityLabel={`${title} ${isActive ? 'ausgewählt' : 'nicht ausgewählt'}`}
                >
                  <Text style={styles.entryEmoji}>{emoji}</Text>
                  <View style={styles.entryTextWrap}>
                    <Text style={[styles.entryTitle, { color: textPrimary }]}>{title}</Text>
                    <Text
                      style={[styles.entryTime, { color: textSecondary }]}
                    >
                      {timeText}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.entryCheck,
                      { color: isActive ? accentColor : textSecondary },
                    ]}
                  >
                    {isActive ? '✓' : '○'}
                  </Text>
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
                      Stillen oder Fläschchen?
                    </Text>
                    <Text
                      style={[styles.milkChoiceHint, { color: textSecondary }]}
                    >
                      Die Spracheingabe war nicht eindeutig. Bitte bestätige die Fütterung.
                    </Text>
                    <View style={styles.milkChoiceActions}>
                      {([
                        { value: 'BREAST' as const, label: '🤱 Stillen' },
                        { value: 'BOTTLE' as const, label: '🍼 Fläschchen' },
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
                                ? `${option.label}, aus den letzten Einträgen vorgeschlagen`
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
                                Zuletzt häufiger
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
                  accessibilityLabel={`${title} ändern`}
                >
                  <Text style={[styles.editEntryButtonText, { color: accentColor }]}>✎ Eintrag ändern</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.recordingActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: sectionBorder }]}
              onPress={reset}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: textSecondary }]}>
                Neue Aufnahme
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
                  ? 'Fütterung auswählen'
                  : selectedEntries.length === 1
                  ? 'Eintrag speichern'
                  : `${selectedEntries.length} Einträge speichern`}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <BlurView
          style={[
            styles.panel,
            {
              backgroundColor: panelColor,
              borderTopWidth: isDark ? 1 : 0,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
            },
          ]}
          tint={isDark ? 'dark' : 'extraLight'}
          intensity={80}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>🎙️</Text>
              <View style={styles.headerTitleRow}>
                <Text style={[styles.headerTitle, { color: textPrimary }]}>Per Sprache eintragen</Text>
                <View style={[styles.premiumBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.premiumBadgeText}>Premium</Text>
                </View>
              </View>
              <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                Schlaf, Füttern & Windeln einfach einsprechen
              </Text>
            </View>

            {phase === 'idle' && renderIdle()}
            {phase === 'recording' && renderRecording()}
            {phase === 'processing' && renderProcessing('Ich höre mir das kurz an …')}
            {phase === 'saving' && renderProcessing('Einträge werden gespeichert …')}
            {phase === 'review' && renderReview()}
          </ScrollView>
        </BlurView>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '82%',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollInner: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 34,
    marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  premiumBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  micButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  micEmoji: {
    fontSize: 36,
  },
  microHint: {
    fontSize: 13,
    marginTop: 12,
  },
  recordingTimer: {
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  transcriptBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  transcriptText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  entryRow: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  entrySelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  entryEmoji: {
    fontSize: 22,
    marginRight: 10,
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
  entryCheck: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
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
    alignItems: 'center',
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
