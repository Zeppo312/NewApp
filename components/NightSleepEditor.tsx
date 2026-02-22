import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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

const formatShortDayDate = (date: Date) =>
  date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

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

const resolvePickerTimeNearReference = (
  pickedTime: Date,
  referenceDate: Date,
  options?: {
    minExclusive?: Date;
    maxExclusive?: Date;
  }
): Date | null => {
  const candidates = [-1, 0, 1].map((dayOffset) => {
    const candidate = withReferenceDate(pickedTime, referenceDate);
    candidate.setDate(candidate.getDate() + dayOffset);
    return candidate;
  });

  const minMs = options?.minExclusive?.getTime();
  const maxMs = options?.maxExclusive?.getTime();
  const referenceMs = referenceDate.getTime();

  const validCandidates = candidates.filter((candidate) => {
    const ts = candidate.getTime();
    if (typeof minMs === 'number' && ts <= minMs) return false;
    if (typeof maxMs === 'number' && ts >= maxMs) return false;
    return true;
  });

  if (validCandidates.length === 0) return null;

  validCandidates.sort((a, b) => {
    const distA = Math.abs(a.getTime() - referenceMs);
    const distB = Math.abs(b.getTime() - referenceMs);
    return distA - distB;
  });

  return validCandidates[0];
};

const ONE_MINUTE_MS = 60 * 1000;
const minutesBucket = (date: Date) => Math.floor(date.getTime() / ONE_MINUTE_MS);

const getWakeMinutesWithMidnightWrap = (start: Date, end: Date): number => {
  const rawMinutes = Math.round((end.getTime() - start.getTime()) / ONE_MINUTE_MS);
  if (rawMinutes > 0) return rawMinutes;

  // Allow midnight wrap (e.g. 23:50 -> 00:00).
  const startMinutesOfDay = start.getHours() * 60 + start.getMinutes();
  const endMinutesOfDay = end.getHours() * 60 + end.getMinutes();
  return (endMinutesOfDay - startMinutesOfDay + 24 * 60) % (24 * 60);
};

// ─── WakePhase type (derived from gaps between entries) ─────
type WakePhase = {
  start: Date;
  end: Date;
  durationSeconds: number;
  prevEntry: ClassifiedSleepEntry;
  nextEntry: ClassifiedSleepEntry;
};

type PendingBoundaryAdjust = {
  entry: ClassifiedSleepEntry;
  field: 'start_time' | 'end_time';
  date: Date;
};

// ─── MiniNightTimeline (exported for sleep-tracker) ─────────
const MINI_BAR_HEIGHT = 12;

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
    <View style={{ marginTop: 10, alignSelf: 'center' }}>
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
    marginTop: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'] as any,
    opacity: 0.65,
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
  onChange: (newTime: Date) => boolean;
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
}) => {
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [displayTime, setDisplayTime] = useState(time);
  const [iosDraftTime, setIosDraftTime] = useState(time);

  useEffect(() => {
    setDisplayTime(time);
  }, [time.getTime()]);

  useEffect(() => {
    if (!showIOS) {
      setIosDraftTime(displayTime);
    }
  }, [showIOS, displayTime]);

  const applyTimeChange = useCallback((nextTime: Date) => {
    const accepted = onChange(nextTime);
    if (accepted) {
      setDisplayTime(nextTime);
    }
  }, [onChange]);

  const commitIOSDraft = useCallback(() => {
    const currentMinute = Math.floor(displayTime.getTime() / 60000);
    const draftMinute = Math.floor(iosDraftTime.getTime() / 60000);
    if (currentMinute !== draftMinute) {
      applyTimeChange(iosDraftTime);
    }
  }, [applyTimeChange, displayTime, iosDraftTime]);

  return (
    <View style={rowStyles.container}>
      <Text style={[rowStyles.label, { color: textSecondary }]}>{label}</Text>
      <View style={rowStyles.valueColumn}>
        <Text style={[rowStyles.dayText, { color: textSecondary }]}>
          {formatShortDayDate(displayTime)}
        </Text>
        {Platform.OS === 'ios' ? (
          <>
            <TouchableOpacity
              style={[
                rowStyles.timeBtn,
                { backgroundColor: isDark ? 'rgba(162,107,255,0.12)' : 'rgba(142,78,198,0.06)' },
              ]}
              onPress={() => {
                setIosDraftTime(displayTime);
                setShowIOS(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.timeBtnText, { color: accentColor }]}>
                {formatClockTime(displayTime)}
              </Text>
            </TouchableOpacity>

            <Modal
              visible={showIOS}
              transparent
              animationType="fade"
              onRequestClose={() => {
                commitIOSDraft();
                setShowIOS(false);
              }}
            >
              <View style={rowStyles.iosModalOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={() => {
                    commitIOSDraft();
                    setShowIOS(false);
                  }}
                  activeOpacity={1}
                />

                <View
                  style={[
                    rowStyles.iosModalCard,
                    {
                      backgroundColor: isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <View style={rowStyles.iosModalHeader}>
                    <TouchableOpacity
                      onPress={() => setShowIOS(false)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[rowStyles.iosActionText, { color: textSecondary }]}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text style={[rowStyles.iosModalTitle, { color: textPrimary }]}>{label}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        commitIOSDraft();
                        setShowIOS(false);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[rowStyles.iosActionText, { color: accentColor }]}>Fertig</Text>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={iosDraftTime}
                    mode="time"
                    display="spinner"
                    locale="de-DE"
                    onChange={(_, d) => {
                      if (d) setIosDraftTime(d);
                    }}
                    accentColor={accentColor}
                    themeVariant={isDark ? 'dark' : 'light'}
                    style={rowStyles.iosSpinner}
                  />
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[rowStyles.timeBtn, { backgroundColor: isDark ? 'rgba(162,107,255,0.12)' : 'rgba(142,78,198,0.06)' }]}
              onPress={() => setShowAndroid(true)}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.timeBtnText, { color: accentColor }]}>
                {formatClockTime(displayTime)}
              </Text>
            </TouchableOpacity>
            {showAndroid && (
              <DateTimePicker
                value={displayTime}
                mode="time"
                is24Hour
                onChange={(_, d) => {
                  setShowAndroid(false);
                  if (d) applyTimeChange(d);
                }}
              />
            )}
          </>
        )}
      </View>
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
  valueColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
    textTransform: 'capitalize',
  },
  timeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  timeBtnText: { fontSize: 16, fontWeight: '700' },
  iosModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iosModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  iosModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iosModalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  iosActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  iosSpinner: {
    marginTop: 4,
    height: 180,
  },
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
  const pendingAdjustTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const pendingBoundaryAdjustsRef = useRef<Record<string, PendingBoundaryAdjust>>({});
  const isFlushingBoundaryAdjustsRef = useRef(false);
  const boundaryReferenceTimesRef = useRef<Record<string, Date>>({});

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

  useEffect(() => {
    const nextReferenceTimes: Record<string, Date> = {};
    const nightStartKey = `night-start-${firstEntry.id ?? 'no-id'}`;
    const nightEndKey = `night-end-${lastEntry.id ?? 'no-id'}`;

    nextReferenceTimes[nightStartKey] = new Date(firstEntry.start_time);
    nextReferenceTimes[nightEndKey] = lastEntry.end_time ? new Date(lastEntry.end_time) : new Date();

    for (const phase of wakePhases) {
      const wakeStartKey = `wake-start-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
      const wakeEndKey = `wake-end-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
      nextReferenceTimes[wakeStartKey] = new Date(phase.start);
      nextReferenceTimes[wakeEndKey] = new Date(phase.end);
    }

    boundaryReferenceTimesRef.current = nextReferenceTimes;
  }, [
    firstEntry.id,
    firstEntry.start_time,
    lastEntry.id,
    lastEntry.end_time,
    wakePhases,
  ]);

  const flushBoundaryAdjustQueue = useCallback(async () => {
    if (isSaving || isFlushingBoundaryAdjustsRef.current) return;

    const pendingKeys = Object.keys(pendingBoundaryAdjustsRef.current);
    if (pendingKeys.length === 0) return;

    isFlushingBoundaryAdjustsRef.current = true;
    try {
      while (true) {
        const nextKey = Object.keys(pendingBoundaryAdjustsRef.current)[0];
        if (!nextKey) break;

        const nextAdjust = pendingBoundaryAdjustsRef.current[nextKey];
        delete pendingBoundaryAdjustsRef.current[nextKey];
        await onAdjustBoundary(nextAdjust.entry, nextAdjust.field, nextAdjust.date);
      }
    } finally {
      isFlushingBoundaryAdjustsRef.current = false;
    }
  }, [isSaving, onAdjustBoundary]);

  useEffect(() => {
    return () => {
      Object.values(pendingAdjustTimeoutsRef.current).forEach((timeoutId) => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      pendingAdjustTimeoutsRef.current = {};
      pendingBoundaryAdjustsRef.current = {};
      boundaryReferenceTimesRef.current = {};
      isFlushingBoundaryAdjustsRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isSaving) {
      void flushBoundaryAdjustQueue();
    }
  }, [flushBoundaryAdjustQueue, isSaving]);

  const scheduleBoundaryAdjust = useCallback(
    (key: string, entry: ClassifiedSleepEntry, field: 'start_time' | 'end_time', date: Date) => {
      const existingTimeout = pendingAdjustTimeoutsRef.current[key];
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      pendingAdjustTimeoutsRef.current[key] = setTimeout(() => {
        pendingAdjustTimeoutsRef.current[key] = null;
        pendingBoundaryAdjustsRef.current[key] = { entry, field, date };
        void flushBoundaryAdjustQueue();
      }, 250);
    },
    [flushBoundaryAdjustQueue]
  );

  // ─── Handlers ──────────────────────────────────────────
  const handleChangeNightStart = useCallback((newTime: Date): boolean => {
    const key = `night-start-${firstEntry.id ?? 'no-id'}`;
    const endKey = `night-end-${lastEntry.id ?? 'no-id'}`;
    const fallbackOriginal = new Date(firstEntry.start_time);
    const fallbackNightEnd = lastEntry.end_time ? new Date(lastEntry.end_time) : nightEnd;
    const original = boundaryReferenceTimesRef.current[key] ?? fallbackOriginal;
    const currentNightEnd = boundaryReferenceTimesRef.current[endKey] ?? fallbackNightEnd;
    const resolved = resolvePickerTimeNearReference(newTime, original, {
      maxExclusive: currentNightEnd,
    });
    if (!resolved) return false;
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    boundaryReferenceTimesRef.current[key] = resolved;
    scheduleBoundaryAdjust(key, firstEntry, 'start_time', resolved);
    hapticLight();
    return true;
  }, [firstEntry, lastEntry.id, lastEntry.end_time, nightEnd, scheduleBoundaryAdjust]);

  const handleChangeNightEnd = useCallback((newTime: Date): boolean => {
    const key = `night-end-${lastEntry.id ?? 'no-id'}`;
    const startKey = `night-start-${firstEntry.id ?? 'no-id'}`;
    const fallbackNightStart = new Date(firstEntry.start_time);
    const fallbackOriginal = lastEntry.end_time ? new Date(lastEntry.end_time) : new Date();
    const original = boundaryReferenceTimesRef.current[key] ?? fallbackOriginal;
    const currentNightStart = boundaryReferenceTimesRef.current[startKey] ?? fallbackNightStart;
    const resolved = resolvePickerTimeNearReference(newTime, original, {
      minExclusive: currentNightStart,
    });
    if (!resolved) return false;
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    boundaryReferenceTimesRef.current[key] = resolved;
    scheduleBoundaryAdjust(key, lastEntry, 'end_time', resolved);
    hapticLight();
    return true;
  }, [firstEntry.id, firstEntry.start_time, lastEntry, scheduleBoundaryAdjust]);

  const handleChangeWakeStart = useCallback((phase: WakePhase, newTime: Date): boolean => {
    const startKey = `wake-start-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const endKey = `wake-end-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const original = boundaryReferenceTimesRef.current[startKey] ?? phase.start;
    const currentWakeEnd = boundaryReferenceTimesRef.current[endKey] ?? phase.end;
    const prevEntryStart = new Date(phase.prevEntry.start_time);
    const resolved = resolvePickerTimeNearReference(newTime, original, {
      minExclusive: prevEntryStart,
      maxExclusive: currentWakeEnd,
    });
    if (!resolved) return false;
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    boundaryReferenceTimesRef.current[startKey] = resolved;
    scheduleBoundaryAdjust(
      startKey,
      phase.prevEntry,
      'end_time',
      resolved
    );
    hapticLight();
    return true;
  }, [scheduleBoundaryAdjust]);

  const handleChangeWakeEnd = useCallback((phase: WakePhase, newTime: Date): boolean => {
    const endKey = `wake-end-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const startKey = `wake-start-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const original = boundaryReferenceTimesRef.current[endKey] ?? phase.end;
    const currentWakeStart = boundaryReferenceTimesRef.current[startKey] ?? phase.start;
    const nextEntryEnd = phase.nextEntry.end_time ? new Date(phase.nextEntry.end_time) : undefined;
    const resolved = resolvePickerTimeNearReference(newTime, original, {
      minExclusive: currentWakeStart,
      maxExclusive: nextEntryEnd,
    });
    if (!resolved) return false;
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    boundaryReferenceTimesRef.current[endKey] = resolved;
    scheduleBoundaryAdjust(
      endKey,
      phase.nextEntry,
      'start_time',
      resolved
    );
    hapticLight();
    return true;
  }, [scheduleBoundaryAdjust]);

  const handleDeleteWake = useCallback((phase: WakePhase) => {
    Alert.alert(
      'Wachphase entfernen',
      `${formatShortDayDate(phase.start)} ${formatClockTime(phase.start)} – ${formatShortDayDate(phase.end)} ${formatClockTime(phase.end)} (${formatWakeDuration(phase.durationSeconds)}) entfernen und Schlaf verbinden?`,
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

    const wakeMinutes = Math.max(0, getWakeMinutesWithMidnightWrap(newWakeStart, newWakeEnd));
    if (wakeMinutes < 1) {
      Alert.alert('Ungültige Dauer', 'Die Wachphase muss mindestens 1 Minute dauern.');
      return;
    }

    const startCandidates = [
      newWakeStart,
      new Date(newWakeStart.getTime() + 24 * 60 * 60 * 1000),
      new Date(newWakeStart.getTime() - 24 * 60 * 60 * 1000),
    ];

    let resolvedWakeStart: Date | null = null;
    let targetEntry: ClassifiedSleepEntry | null = null;

    for (const candidate of startCandidates) {
      const wakeStartMs = candidate.getTime();
      const candidateEntry = entries.find((entry) => {
        const start = new Date(entry.start_time).getTime();
        const end = (entry.end_time ? new Date(entry.end_time) : new Date()).getTime();
        return wakeStartMs >= start && wakeStartMs < end;
      });

      if (candidateEntry) {
        resolvedWakeStart = candidate;
        targetEntry = candidateEntry;
        break;
      }
    }

    if (!targetEntry) {
      Alert.alert(
        'Nicht speicherbar',
        'Die gewählte Startzeit liegt außerhalb der Schlafphase. Bitte passe "Von" an.'
      );
      return;
    }
    if (!resolvedWakeStart) {
      Alert.alert('Konnte nicht speichern', 'Bitte versuche es erneut.');
      return;
    }

    setIsSubmittingWake(true);
    try {
      const didSave = await onSplit({
        targetEntry,
        splitTime: resolvedWakeStart,
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

  const applyResolvedNewWakeStart = useCallback((resolvedStart: Date): boolean => {
    if (!newWakeStart || !newWakeEnd) return false;
    if (minutesBucket(resolvedStart) === minutesBucket(newWakeStart)) return false;

    const earliestAllowedStartMs = nightStart.getTime();
    const latestAllowedEndMs = nightEnd.getTime() - ONE_MINUTE_MS;
    if (resolvedStart.getTime() < earliestAllowedStartMs) return false;
    if (resolvedStart.getTime() >= latestAllowedEndMs) return false;

    const preservedWakeMinutes = Math.max(
      1,
      getWakeMinutesWithMidnightWrap(newWakeStart, newWakeEnd)
    );

    let resolvedEnd = new Date(resolvedStart.getTime() + preservedWakeMinutes * ONE_MINUTE_MS);
    if (resolvedEnd.getTime() > latestAllowedEndMs) {
      resolvedEnd = new Date(latestAllowedEndMs);
    }
    if (resolvedEnd.getTime() <= resolvedStart.getTime()) {
      resolvedEnd = new Date(resolvedStart.getTime() + ONE_MINUTE_MS);
    }

    setNewWakeStart(resolvedStart);
    setNewWakeEnd(resolvedEnd);
    return true;
  }, [newWakeEnd, newWakeStart, nightEnd, nightStart]);

  const applyResolvedNewWakeEnd = useCallback((resolvedEnd: Date): boolean => {
    if (!newWakeEnd || !newWakeStart) return false;
    if (minutesBucket(resolvedEnd) === minutesBucket(newWakeEnd)) return false;
    if (resolvedEnd.getTime() <= newWakeStart.getTime()) return false;
    if (resolvedEnd.getTime() >= nightEnd.getTime()) return false;

    setNewWakeEnd(resolvedEnd);
    return true;
  }, [newWakeEnd, newWakeStart, nightEnd]);

  const handleChangeNewWakeStart = useCallback((pickedTime: Date): boolean => {
    if (!newWakeStart) return false;

    const resolvedStart = resolvePickerTimeNearReference(pickedTime, newWakeStart, {
      minExclusive: new Date(nightStart.getTime() - 1),
      maxExclusive: nightEnd,
    });
    if (!resolvedStart) return false;

    return applyResolvedNewWakeStart(resolvedStart);
  }, [applyResolvedNewWakeStart, newWakeStart, nightEnd, nightStart]);

  const handleChangeNewWakeEnd = useCallback((pickedTime: Date): boolean => {
    if (!newWakeEnd || !newWakeStart) return false;

    const resolvedEnd = resolvePickerTimeNearReference(pickedTime, newWakeEnd, {
      minExclusive: newWakeStart,
      maxExclusive: nightEnd,
    });
    if (!resolvedEnd) return false;

    return applyResolvedNewWakeEnd(resolvedEnd);
  }, [applyResolvedNewWakeEnd, newWakeEnd, newWakeStart, nightEnd]);

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
                    {formatShortDayDate(phase.start)} {formatClockTime(phase.start)} – {formatShortDayDate(phase.end)} {formatClockTime(phase.end)}
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
