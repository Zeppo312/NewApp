import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { RADIUS } from '@/constants/DesignGuide';
import type { NightGroup, ClassifiedSleepEntry } from '@/app/(tabs)/sleep-tracker';

// ─── Constants ──────────────────────────────────────────────
const NIGHT_WINDOW_MINUTES = 990;
const NIGHT_WINDOW_START_HOUR = 17;
const NIGHT_WINDOW_START_MINUTES = 30;

const ACCENT_LIGHT = '#8E4EC6';
const ACCENT_DARK = '#A26BFF';
const WAKE_COLOR = 'rgba(232, 160, 130, 0.9)';
const WAKE_BG_LIGHT = 'rgba(232, 160, 130, 0.1)';
const WAKE_BG_DARK = 'rgba(232, 160, 130, 0.12)';

// ─── Types ──────────────────────────────────────────────────
type NightSleepEditorProps = {
  visible: boolean;
  nightGroup: NightGroup;
  onClose: () => void;
  onSplit: (params: {
    targetEntry: ClassifiedSleepEntry;
    splitTime: Date;
    wakeMinutes: number;
  }) => Promise<boolean>;
  onMerge: (entryA: ClassifiedSleepEntry, entryB: ClassifiedSleepEntry) => Promise<boolean>;
  onAdjustBoundary: (
    entry: ClassifiedSleepEntry,
    field: 'start_time' | 'end_time',
    newTime: Date
  ) => Promise<void>;
  onDeleteSegment: (entryId: string) => void;
  isSaving: boolean;
};

// ─── Helpers ────────────────────────────────────────────────
const formatClockTime = (date: Date) =>
  date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const minutesToHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h <= 0) return `${m} Min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const formatWakeDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} Sek`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes} Min ${remainingSeconds} Sek` : `${minutes} Min`;
  }

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (remainingSeconds > 0) {
    return m > 0
      ? `${h}h ${m.toString().padStart(2, '0')}m ${remainingSeconds} Sek`
      : `${h}h ${remainingSeconds} Sek`;
  }
  return m > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${h}h`;
};

const getNightAnchor = (group: NightGroup): Date => {
  const start = group.start;
  const anchor = new Date(start);
  const startTotalMin = start.getHours() * 60 + start.getMinutes();
  const anchorTotalMin = NIGHT_WINDOW_START_HOUR * 60 + NIGHT_WINDOW_START_MINUTES;
  if (startTotalMin < anchorTotalMin) {
    anchor.setDate(anchor.getDate() - 1);
  }
  anchor.setHours(NIGHT_WINDOW_START_HOUR, NIGHT_WINDOW_START_MINUTES, 0, 0);
  return anchor;
};

const minutesFromAnchor = (date: Date, anchor: Date): number =>
  Math.max(0, (date.getTime() - anchor.getTime()) / 60000);

const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const withReferenceDate = (pickedTime: Date, referenceDate: Date): Date => {
  const normalized = new Date(referenceDate);
  normalized.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
  return normalized;
};

// ─── WakePhase type (derived from gaps between entries) ─────
type WakePhase = {
  start: Date;
  end: Date;
  durationSeconds: number;
  prevEntry: ClassifiedSleepEntry;
  nextEntry: ClassifiedSleepEntry;
};

// ─── MiniNightTimeline (exported for sleep-tracker) ─────────
const MINI_BAR_HEIGHT = 10;

export const MiniNightTimeline = ({
  nightGroup,
  width,
  isDark,
  showLabels = false,
}: {
  nightGroup: NightGroup;
  width: number;
  isDark: boolean;
  showLabels?: boolean;
}) => {
  const anchor = getNightAnchor(nightGroup);
  const segments = nightGroup.segments;
  if (segments.length === 0) return null;

  // Compute range: first start to last end
  const firstStart = segments[0].start;
  const lastEnd = segments[segments.length - 1].end;
  const rangeStartMin = minutesFromAnchor(firstStart, anchor);
  const rangeEndMin = minutesFromAnchor(lastEnd, anchor);
  const rangeMin = Math.max(rangeEndMin - rangeStartMin, 1);
  const ppm = width / rangeMin;

  // Sleep blocks (purple)
  const sleepBlocks = segments.map((segment) => {
    const s = segment.start;
    const e = segment.end;
    const x = (minutesFromAnchor(s, anchor) - rangeStartMin) * ppm;
    const w = Math.max(((e.getTime() - s.getTime()) / 60000) * ppm, 2);
    return { x, w };
  });

  // Wake gaps (beige cutouts)
  const wakeBlocks: { x: number; w: number }[] = [];
  for (let i = 1; i < segments.length; i++) {
    const gapStart = segments[i - 1].end;
    const gapEnd = segments[i].start;
    const gapDur = (gapEnd.getTime() - gapStart.getTime()) / 60000;
    if (gapDur > 0) {
      const x = (minutesFromAnchor(gapStart, anchor) - rangeStartMin) * ppm;
      const w = Math.max(gapDur * ppm, 3);
      wakeBlocks.push({ x, w });
    }
  }

  const purpleColor = isDark ? 'rgba(162, 107, 255, 0.65)' : 'rgba(142, 78, 198, 0.55)';
  const wakeColor = isDark ? 'rgba(232, 160, 130, 0.5)' : 'rgba(232, 160, 130, 0.45)';

  return (
    <View style={{ marginTop: 8 }}>
      <View style={[miniStyles.container, { width, height: MINI_BAR_HEIGHT }]}>
        {/* Full purple bar from first sleep to last sleep */}
        <View
          style={[
            miniStyles.fullBar,
            { width, backgroundColor: purpleColor },
          ]}
        />
        {/* Wake cutouts */}
        {wakeBlocks.map((wb, i) => (
          <View
            key={`wg-${i}`}
            style={[
              miniStyles.wakeCutout,
              {
                left: wb.x,
                width: wb.w,
                backgroundColor: wakeColor,
              },
            ]}
          />
        ))}
      </View>
      {/* Optional time labels */}
      {showLabels && (
        <View style={miniStyles.labelRow}>
          <Text style={[miniStyles.label, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }]}>
            {formatClockTime(firstStart)}
          </Text>
          <Text style={[miniStyles.label, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }]}>
            {formatClockTime(lastEnd)}
          </Text>
        </View>
      )}
    </View>
  );
};

const miniStyles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: MINI_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  fullBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: MINI_BAR_HEIGHT,
    borderRadius: MINI_BAR_HEIGHT / 2,
  },
  wakeCutout: {
    position: 'absolute',
    top: 0,
    height: MINI_BAR_HEIGHT,
    borderRadius: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'] as any,
  },
});

// ─── Time Picker Row ────────────────────────────────────────
const TimePickerRow = ({
  label,
  time,
  onChange,
  accentColor,
  isDark,
  textPrimary,
  textSecondary,
}: {
  label: string;
  time: Date;
  onChange: (newTime: Date) => void;
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
}) => {
  const [showAndroid, setShowAndroid] = useState(false);

  return (
    <View style={rowStyles.container}>
      <Text style={[rowStyles.label, { color: textSecondary }]}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={time}
          mode="time"
          display="compact"
          onChange={(_, d) => { if (d) onChange(d); }}
          style={rowStyles.picker}
          accentColor={accentColor}
          themeVariant={isDark ? 'dark' : 'light'}
          locale="de-DE"
        />
      ) : (
        <>
          <TouchableOpacity
            style={[rowStyles.timeBtn, { backgroundColor: isDark ? 'rgba(162,107,255,0.12)' : 'rgba(142,78,198,0.06)' }]}
            onPress={() => setShowAndroid(true)}
            activeOpacity={0.7}
          >
            <Text style={[rowStyles.timeBtnText, { color: accentColor }]}>
              {formatClockTime(time)}
            </Text>
          </TouchableOpacity>
          {showAndroid && (
            <DateTimePicker
              value={time}
              mode="time"
              is24Hour
              onChange={(_, d) => {
                setShowAndroid(false);
                if (d) onChange(d);
              }}
            />
          )}
        </>
      )}
    </View>
  );
};

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: { fontSize: 15, fontWeight: '500' },
  picker: { height: 34 },
  timeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  timeBtnText: { fontSize: 16, fontWeight: '700' },
});

// ─── Main Editor Component ──────────────────────────────────
export default function NightSleepEditor({
  visible,
  nightGroup,
  onClose,
  onSplit,
  onMerge,
  onAdjustBoundary,
  onDeleteSegment,
  isSaving,
}: NightSleepEditorProps) {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const ghostColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const overlayColor = isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)';
  const panelColor = isDark ? 'rgba(10,10,12,0.86)' : 'transparent';
  const panelBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'transparent';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const wakeBg = isDark ? WAKE_BG_DARK : WAKE_BG_LIGHT;

  const [addingWake, setAddingWake] = useState(false);
  const [newWakeStart, setNewWakeStart] = useState<Date | null>(null);
  const [newWakeEnd, setNewWakeEnd] = useState<Date | null>(null);
  const [isSubmittingWake, setIsSubmittingWake] = useState(false);

  const entries = nightGroup.entries;
  const firstEntry = useMemo(() => {
    return entries.reduce((earliest, entry) => {
      if (!earliest) return entry;
      return new Date(entry.start_time).getTime() < new Date(earliest.start_time).getTime()
        ? entry
        : earliest;
    }, entries[0]);
  }, [entries]);
  const lastEntry = useMemo(() => {
    return entries.reduce((latest, entry) => {
      if (!latest) return entry;
      const latestEnd = latest.end_time ? new Date(latest.end_time).getTime() : Number.NEGATIVE_INFINITY;
      const currentEnd = entry.end_time ? new Date(entry.end_time).getTime() : Number.NEGATIVE_INFINITY;
      if (currentEnd > latestEnd) return entry;
      if (currentEnd === latestEnd) {
        return new Date(entry.start_time).getTime() > new Date(latest.start_time).getTime()
          ? entry
          : latest;
      }
      return latest;
    }, entries[0]);
  }, [entries]);

  const nightStart = nightGroup.start;
  const nightEnd = nightGroup.end;
  const totalSleepMin = nightGroup.totalMinutes;
  const totalWakeSeconds = nightGroup.wakeGaps.reduce((a, b) => a + b, 0);

  // Derive wake phases from gaps between entries
  const wakePhases: WakePhase[] = useMemo(() => {
    const phases: WakePhase[] = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const next = entries[i];
      if (!prev.end_time) continue;
      const start = new Date(prev.end_time);
      const end = new Date(next.start_time);
      const durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
      if (durationSeconds > 0) {
        phases.push({ start, end, durationSeconds, prevEntry: prev, nextEntry: next });
      }
    }
    return phases;
  }, [entries]);

  // ─── Handlers ──────────────────────────────────────────
  const handleChangeNightStart = useCallback((newTime: Date) => {
    newTime.setSeconds(0, 0);
    // Keep the same date as original start
    const original = new Date(firstEntry.start_time);
    newTime.setFullYear(original.getFullYear(), original.getMonth(), original.getDate());
    onAdjustBoundary(firstEntry, 'start_time', newTime);
    hapticLight();
  }, [firstEntry, onAdjustBoundary]);

  const handleChangeNightEnd = useCallback((newTime: Date) => {
    newTime.setSeconds(0, 0);
    const original = lastEntry.end_time ? new Date(lastEntry.end_time) : new Date();
    newTime.setFullYear(original.getFullYear(), original.getMonth(), original.getDate());
    onAdjustBoundary(lastEntry, 'end_time', newTime);
    hapticLight();
  }, [lastEntry, onAdjustBoundary]);

  const handleChangeWakeStart = useCallback((phase: WakePhase, newTime: Date) => {
    newTime.setSeconds(0, 0);
    const original = phase.start;
    newTime.setFullYear(original.getFullYear(), original.getMonth(), original.getDate());
    onAdjustBoundary(phase.prevEntry, 'end_time', newTime);
    hapticLight();
  }, [onAdjustBoundary]);

  const handleChangeWakeEnd = useCallback((phase: WakePhase, newTime: Date) => {
    newTime.setSeconds(0, 0);
    const original = phase.end;
    newTime.setFullYear(original.getFullYear(), original.getMonth(), original.getDate());
    onAdjustBoundary(phase.nextEntry, 'start_time', newTime);
    hapticLight();
  }, [onAdjustBoundary]);

  const handleDeleteWake = useCallback((phase: WakePhase) => {
    Alert.alert(
      'Wachphase entfernen',
      `${formatClockTime(phase.start)} – ${formatClockTime(phase.end)} (${formatWakeDuration(phase.durationSeconds)}) entfernen und Schlaf verbinden?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            const didMerge = await onMerge(phase.prevEntry, phase.nextEntry);
            if (didMerge) {
              hapticLight();
            } else {
              Alert.alert('Konnte nicht löschen', 'Die Wachphase konnte nicht entfernt werden.');
            }
          },
        },
      ]
    );
  }, [onMerge]);

  // Add wake phase: find the longest sleep segment and split in the middle
  const handleStartAddWake = useCallback(() => {
    // Find longest entry
    let longestIdx = 0;
    let longestDur = 0;
    entries.forEach((entry, i) => {
      const start = new Date(entry.start_time);
      const end = entry.end_time ? new Date(entry.end_time) : new Date();
      const dur = end.getTime() - start.getTime();
      if (dur > longestDur) {
        longestDur = dur;
        longestIdx = i;
      }
    });

    const longest = entries[longestIdx];
    const mid = new Date(
      new Date(longest.start_time).getTime() + longestDur / 2
    );
    mid.setSeconds(0, 0);
    // Default: 15 min wake
    const wakeEnd = new Date(mid.getTime() + 15 * 60000);
    wakeEnd.setSeconds(0, 0);

    setNewWakeStart(mid);
    setNewWakeEnd(wakeEnd);
    setAddingWake(true);
  }, [entries]);

  const handleConfirmAddWake = useCallback(async () => {
    if (!newWakeStart || !newWakeEnd || isSubmittingWake) return;

    if (newWakeEnd.getTime() <= newWakeStart.getTime()) {
      Alert.alert('Ungültige Zeit', 'Die Endzeit muss nach der Startzeit liegen.');
      return;
    }

    // Find which entry contains newWakeStart
    const wakeStartMs = newWakeStart.getTime();
    const targetEntry = entries.find((entry) => {
      const start = new Date(entry.start_time).getTime();
      const end = (entry.end_time ? new Date(entry.end_time) : new Date()).getTime();
      return wakeStartMs >= start && wakeStartMs < end;
    });

    if (!targetEntry) {
      Alert.alert(
        'Nicht speicherbar',
        'Die gewählte Startzeit liegt außerhalb der Schlafphase. Bitte passe "Von" an.'
      );
      return;
    }

    const wakeMinutes = Math.max(0, Math.round((newWakeEnd.getTime() - newWakeStart.getTime()) / 60000));
    if (wakeMinutes < 1) {
      Alert.alert('Ungültige Dauer', 'Die Wachphase muss mindestens 1 Minute dauern.');
      return;
    }

    setIsSubmittingWake(true);
    try {
      const didSave = await onSplit({
        targetEntry,
        splitTime: newWakeStart,
        wakeMinutes,
      });

      if (!didSave) {
        Alert.alert('Konnte nicht speichern', 'Bitte versuche es erneut.');
        return;
      }

      setAddingWake(false);
      setNewWakeStart(null);
      setNewWakeEnd(null);
      hapticLight();
    } catch {
      Alert.alert('Konnte nicht speichern', 'Beim Speichern ist ein Fehler aufgetreten.');
    } finally {
      setIsSubmittingWake(false);
    }
  }, [newWakeStart, newWakeEnd, entries, onSplit, isSubmittingWake]);

  const handleChangeNewWakeStart = useCallback((pickedTime: Date) => {
    if (!newWakeStart) return;
    setNewWakeStart(withReferenceDate(pickedTime, newWakeStart));
  }, [newWakeStart]);

  const handleChangeNewWakeEnd = useCallback((pickedTime: Date) => {
    if (!newWakeEnd) return;
    setNewWakeEnd(withReferenceDate(pickedTime, newWakeEnd));
  }, [newWakeEnd]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !isSaving && onClose()}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => !isSaving && onClose()}
          activeOpacity={1}
        />

        <BlurView
          style={[
            styles.panel,
            {
              backgroundColor: panelColor,
              borderTopWidth: isDark ? 1 : 0,
              borderTopColor: panelBorderColor,
            },
          ]}
          tint={isDark ? 'dark' : 'extraLight'}
          intensity={80}
        >
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerEmoji]}>🌙</Text>
              <Text style={[styles.headerTitle, { color: textPrimary }]}>
                Nachtschlaf bearbeiten
              </Text>
            </View>

            {/* Summary */}
            <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: textSecondary }]}>Schlaf</Text>
                <Text style={[styles.summaryValue, { color: accentColor }]}>{minutesToHMM(totalSleepMin)}</Text>
              </View>
              {totalWakeSeconds > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}>Wach</Text>
                  <Text style={[styles.summaryValue, { color: WAKE_COLOR }]}>{formatWakeDuration(totalWakeSeconds)}</Text>
                </View>
              )}
            </View>

            {/* Start / End times */}
            <View style={[styles.section, { backgroundColor: cardBg }]}>
              <TimePickerRow
                label="Eingeschlafen"
                time={nightStart}
                onChange={handleChangeNightStart}
                accentColor={accentColor}
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
              />
              <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
              <TimePickerRow
                label="Aufgewacht"
                time={nightEnd}
                onChange={handleChangeNightEnd}
                accentColor={accentColor}
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
              />
            </View>

            {/* Wake phases */}
            <View style={styles.wakeSection}>
              <Text style={[styles.wakeSectionTitle, { color: textPrimary }]}>
                Wachphasen
              </Text>
              <Text style={[styles.wakeSectionSub, { color: textSecondary }]}>
                optional
              </Text>
            </View>

            {wakePhases.length === 0 && !addingWake && (
              <Text style={[styles.noWakeText, { color: textSecondary }]}>
                Keine Wachphasen eingetragen
              </Text>
            )}

            {wakePhases.map((phase, i) => (
              <View key={`wake-${i}`} style={[styles.wakeCard, { backgroundColor: wakeBg }]}>
                <View style={styles.wakeCardHeader}>
                  <View style={[styles.wakeDot, { backgroundColor: WAKE_COLOR }]} />
                  <Text style={[styles.wakeTimeRange, { color: textPrimary }]}>
                    {formatClockTime(phase.start)} – {formatClockTime(phase.end)}
                  </Text>
                  <Text style={[styles.wakeDuration, { color: WAKE_COLOR }]}>
                    {formatWakeDuration(phase.durationSeconds)}
                  </Text>
                  <TouchableOpacity
                    style={styles.wakeDeleteBtn}
                    onPress={() => {
                      if (isSaving) return;
                      void handleDeleteWake(phase);
                    }}
                    disabled={isSaving}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.wakeDeleteText, { color: textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Editable times */}
                <View style={styles.wakePickerRow}>
                  <TimePickerRow
                    label="Von"
                    time={phase.start}
                    onChange={(d) => handleChangeWakeStart(phase, d)}
                    accentColor={WAKE_COLOR}
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                  />
                  <TimePickerRow
                    label="Bis"
                    time={phase.end}
                    onChange={(d) => handleChangeWakeEnd(phase, d)}
                    accentColor={WAKE_COLOR}
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                  />
                </View>
              </View>
            ))}

            {/* Adding new wake phase */}
            {addingWake && newWakeStart && newWakeEnd && (
              <View style={[styles.wakeCard, styles.wakeCardNew, { backgroundColor: wakeBg, borderColor: WAKE_COLOR }]}>
                <Text style={[styles.newWakeTitle, { color: textPrimary }]}>
                  Neue Wachphase
                </Text>
                <View style={styles.wakePickerRow}>
                  <TimePickerRow
                    label="Von"
                    time={newWakeStart}
                    onChange={handleChangeNewWakeStart}
                    accentColor={WAKE_COLOR}
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                  />
                  <TimePickerRow
                    label="Bis"
                    time={newWakeEnd}
                    onChange={handleChangeNewWakeEnd}
                    accentColor={WAKE_COLOR}
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                  />
                </View>
                <View style={styles.newWakeBtns}>
                  <TouchableOpacity
                    style={[styles.newWakeCancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
                    onPress={() => setAddingWake(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.newWakeCancelText, { color: textSecondary }]}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.newWakeConfirmBtn, { backgroundColor: WAKE_COLOR }]}
                    onPress={handleConfirmAddWake}
                    disabled={isSaving || isSubmittingWake}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.newWakeConfirmText}>
                      {isSaving || isSubmittingWake ? 'Speichert...' : 'Hinzufügen'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Add wake button */}
            {!addingWake && (
              <TouchableOpacity
                style={[styles.addWakeBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
                onPress={handleStartAddWake}
                activeOpacity={0.7}
              >
                <Text style={[styles.addWakePlus, { color: WAKE_COLOR }]}>+</Text>
                <Text style={[styles.addWakeText, { color: textSecondary }]}>Wachphase hinzufügen</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Bottom Bar */}
          <View style={[styles.bottomBar, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: accentColor }]}
              onPress={() => !isSaving && onClose()}
              activeOpacity={0.7}
            >
              <Text style={styles.doneBtnText}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: 'hidden',
    maxHeight: '97%',
    minHeight: 500,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  summaryRow: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  section: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  wakeSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  wakeSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  wakeSectionSub: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
  },
  noWakeText: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.5,
    textAlign: 'center',
    paddingVertical: 12,
  },
  wakeCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  wakeCardNew: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  wakeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  wakeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  wakeTimeRange: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  wakeDuration: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  wakeDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wakeDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.5,
  },
  wakePickerRow: {
    marginTop: 4,
  },
  newWakeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  newWakeBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  newWakeCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  newWakeCancelText: { fontSize: 14, fontWeight: '600' },
  newWakeConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  newWakeConfirmText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  addWakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
    marginTop: 2,
  },
  addWakePlus: {
    fontSize: 18,
    fontWeight: '700',
  },
  addWakeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
