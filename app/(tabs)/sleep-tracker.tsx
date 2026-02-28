
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  Alert,
  Animated,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { ThemedBackground } from '@/components/ThemedBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import TextInputOverlay from '@/components/modals/TextInputOverlay';

import { SleepEntry, SleepQuality, loadConnectedUsers } from '@/lib/sleepData';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  CacheStrategy,
  loadWithRevalidate,
  invalidateCacheAfterAction
} from '@/lib/screenCache';
import Header from '@/components/Header';
import ActivityCard from '@/components/ActivityCard';
import ActivityInputModal from '@/components/ActivityInputModal';
// SplashOverlay Import entfernt - keine Popups
import { useAuth } from '@/contexts/AuthContext';
import { useBackend } from '@/contexts/BackendContext';
import { useConvex } from '@/contexts/ConvexContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useSleepEntriesService } from '@/hooks/useSleepEntriesService';
import { ProgressCircle } from '@/components/ProgressCircle';
import type { ViewStyle } from 'react-native';
import { GlassCard, LiquidGlassCard, LAYOUT_PAD, SECTION_GAP_TOP, SECTION_GAP_BOTTOM, RADIUS, PRIMARY, GLASS_BORDER, GLASS_OVERLAY, FONT_SM, FONT_MD, FONT_LG } from '@/constants/DesignGuide';
import { getBabyInfo } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { predictNextSleepWindow, updatePersonalizationAfterNap, initializePersonalization, type SleepWindowPrediction } from '@/lib/sleep-window';
import { normalizeBedtimeAnchor } from '@/lib/bedtime';
import { markPaywallShown, shouldShowPaywall } from '@/lib/paywall';
import { useNotifications } from '@/hooks/useNotifications';
import { usePartnerNotifications } from '@/hooks/usePartnerNotifications';
import { sleepActivityService } from '@/lib/sleepActivityService';
import { parseSafeDate } from '@/lib/safeDate';
import { cancelBabyReminderNotification } from '@/lib/babyReminderNotifications';
import { cancelLocalSleepWindowReminders } from '@/lib/sleepWindowReminderNotifications';
import {
  DEFAULT_NIGHT_WINDOW_SETTINGS,
  clockTimeToMinutes,
  getNightWindowRangeForDate,
  loadNightWindowSettings,
  type NightWindowSettings,
} from '@/lib/nightWindowSettings';
import NightSleepEditor, { MiniNightTimeline } from '@/components/NightSleepEditor';
import { isStaleActiveSleepEntry } from '@/lib/sleepEntryGuards';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Typografie helper
const FONT_NUM = { fontVariant: ['tabular-nums'] };
const QUALITY_VISUALS = {
  good: { color: '#7BBF9A', emoji: '😴' },
  medium: { color: '#F2C78A', emoji: '🙂' },
  bad: { color: '#E8A6B0', emoji: '🥱' },
} as const;

const NIGHT_SPLASH_COLORS = {
  sleep_start_night: '#141C34',
  sleep_pause_night: '#1E1A2E',
} as const;
const SPLASH_PROMO_GIF = require('@/assets/images/App_Werbung.gif');
const MIN_VALID_MANUAL_DATE = new Date(2000, 0, 1);
const MAX_VALID_MANUAL_DATE = new Date(2100, 11, 31, 23, 59, 59, 999);
const BABY_MODE_PREVIEW_READ_ONLY_MESSAGE =
  'Du bist im Babymodus zur Vorschau. Schlaftracking ist erst nach der Geburt moeglich.';

// Globale Helper-Funktionen für Zeitberechnungen
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
const overlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  Math.max(0, Math.min(+aEnd, +bEnd) - Math.max(+aStart, +bStart)) / 60000 | 0;
const MIN_PERSISTED_SLEEP_DURATION_MS = 60 * 1000;

const toTimeMs = (value: Date | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const isSubMinuteFinishedSleepEntry = (entry: Pick<SleepEntry, 'start_time' | 'end_time'>): boolean => {
  const startMs = toTimeMs(entry.start_time);
  const endMs = toTimeMs(entry.end_time ?? null);
  if (startMs === null || endMs === null) return false;
  if (endMs <= startMs) return false;
  return endMs - startMs < MIN_PERSISTED_SLEEP_DURATION_MS;
};

type TimeInterval = {
  startMs: number;
  endMs: number;
};

const mergeIntervals = (intervals: TimeInterval[]): TimeInterval[] => {
  if (intervals.length === 0) return [];

  const sorted = [...intervals]
    .filter((interval) => Number.isFinite(interval.startMs) && Number.isFinite(interval.endMs) && interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  if (sorted.length === 0) return [];

  const merged: TimeInterval[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];

    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
};

const getMergedIntervalsForEntries = (
  entries: ClassifiedSleepEntry[],
  options?: {
    rangeStart?: Date;
    rangeEnd?: Date;
    predicate?: (entry: ClassifiedSleepEntry) => boolean;
    nowMs?: number;
  }
): TimeInterval[] => {
  const rangeStartMs = options?.rangeStart?.getTime();
  const rangeEndMs = options?.rangeEnd?.getTime();
  const nowMs = options?.nowMs ?? Date.now();

  const clippedIntervals: TimeInterval[] = [];

  for (const entry of entries) {
    if (options?.predicate && !options.predicate(entry)) continue;

    const startMs = new Date(entry.start_time).getTime();
    const rawEndMs = entry.end_time ? new Date(entry.end_time).getTime() : nowMs;
    if (!Number.isFinite(startMs) || !Number.isFinite(rawEndMs)) continue;

    let clippedStartMs = startMs;
    let clippedEndMs = rawEndMs;

    if (typeof rangeStartMs === 'number') {
      clippedStartMs = Math.max(clippedStartMs, rangeStartMs);
    }
    if (typeof rangeEndMs === 'number') {
      clippedEndMs = Math.min(clippedEndMs, rangeEndMs);
    }

    if (clippedEndMs <= clippedStartMs) continue;
    clippedIntervals.push({ startMs: clippedStartMs, endMs: clippedEndMs });
  }

  return mergeIntervals(clippedIntervals);
};

const minutesFromMergedIntervals = (intervals: TimeInterval[]): number =>
  intervals.reduce((sum, interval) => {
    const minutes = Math.floor((interval.endMs - interval.startMs) / 60000);
    return sum + Math.max(0, minutes);
  }, 0);

const findOverlappingEntries = (
  entries: ClassifiedSleepEntry[],
  candidateStart: Date,
  candidateEnd: Date,
  excludedEntryId?: string | null,
): ClassifiedSleepEntry[] => {
  const candidateStartMs = candidateStart.getTime();
  const candidateEndMs = candidateEnd.getTime();
  if (!Number.isFinite(candidateStartMs) || !Number.isFinite(candidateEndMs) || candidateEndMs <= candidateStartMs) {
    return [];
  }

  const nowMs = Date.now();
  return entries.filter((entry) => {
    if (excludedEntryId && entry.id === excludedEntryId) return false;
    if (isSubMinuteFinishedSleepEntry(entry)) return false;

    const entryStartMs = new Date(entry.start_time).getTime();
    const entryEndMs = entry.end_time ? new Date(entry.end_time).getTime() : nowMs;
    if (!Number.isFinite(entryStartMs) || !Number.isFinite(entryEndMs)) return false;

    return Math.min(candidateEndMs, entryEndMs) > Math.max(candidateStartMs, entryStartMs);
  });
};

const getSleepPeriodForStart = (
  date: Date,
  nightWindowSettings: NightWindowSettings = DEFAULT_NIGHT_WINDOW_SETTINGS
) => {
  const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes();
  const nightStartMinutes = clockTimeToMinutes(nightWindowSettings.startTime, 18 * 60);
  const nightEndMinutes = clockTimeToMinutes(nightWindowSettings.endTime, 10 * 60);
  const isOvernightWindow = nightEndMinutes <= nightStartMinutes;
  const isNight = isOvernightWindow
    ? minutesSinceMidnight >= nightStartMinutes || minutesSinceMidnight < nightEndMinutes
    : minutesSinceMidnight >= nightStartMinutes && minutesSinceMidnight < nightEndMinutes;

  return isNight ? 'night' : 'day';
};

// Match Timeline (ActivityCard marginHorizontal=8 -> 16px gesamt)
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;

const COLS = 7;
const GUTTER = 4; // weniger Abstand zwischen Spalten => mehr Netto-Breite
const COL_WIDTH = Math.floor((contentWidth - (COLS - 1) * GUTTER) / COLS);
const totalGutters = (COLS - 1) * GUTTER;
const colsWidth = COLS * COL_WIDTH;
const leftover = contentWidth - (colsWidth + totalGutters); // 0..(COLS-1)

// Week-Chart spezifische Konstanten (wie Timeline)
const WEEK_CONTENT_WIDTH = contentWidth - TIMELINE_INSET * 2;
const WEEK_COL_WIDTH   = Math.floor((WEEK_CONTENT_WIDTH - (COLS - 1) * GUTTER) / COLS);
const WEEK_COLS_WIDTH  = COLS * WEEK_COL_WIDTH;
const WEEK_LEFTOVER    = WEEK_CONTENT_WIDTH - (WEEK_COLS_WIDTH + totalGutters);

// Highlight-Karten Konstanten (2-Spalten Layout)
const HL_COLS = 2;
const HL_GUTTER = 12;
const HL_COL_WIDTH = Math.floor((WEEK_CONTENT_WIDTH - (HL_COLS - 1) * HL_GUTTER) / HL_COLS);
const HL_COLS_WIDTH = HL_COLS * HL_COL_WIDTH;
const HL_LEFTOVER = WEEK_CONTENT_WIDTH - (HL_COLS_WIDTH + (HL_COLS - 1) * HL_GUTTER);

// Action Buttons Konstanten (2-Spalten Layout)
const GRID_COLS = 2;
const GRID_GUTTER = 12;
const GRID_COL_W = Math.floor((contentWidth - (GRID_COLS - 1) * GRID_GUTTER) / GRID_COLS);
const GRID_LEFTOVER = contentWidth - (GRID_COLS * GRID_COL_W + (GRID_COLS - 1) * GRID_GUTTER);

const MAX_BAR_H = 140; // Höhe der Balkenfläche (mehr Luft)

// Types for sleep periods
type SleepPeriod = 'day' | 'night';

// Sleep Entry with period classification
export interface ClassifiedSleepEntry extends SleepEntry {
  period: SleepPeriod;
  isActive: boolean;
}

type SleepStats = {
  totalMinutes: number;
  napsCount: number;
  longestStretch: number;
  score: number;
  nightTotalMinutes: number;
  nightSegmentCount: number;
};

type PausedNightState = {
  lastPausedEntryId: string;
  pausedAt: string;
};

type StatusMetricsBarProps = {
  stats: SleepStats;
  selectedDate: Date;
  sleepPrediction: SleepWindowPrediction | null;
  activeSleepEntry: ClassifiedSleepEntry | null;
  hasSleepData: boolean;
  statsPage: number;
  onPageChange: (page: number) => void;
};

export type NightGroup = {
  entries: ClassifiedSleepEntry[];
  segments: { start: Date; end: Date }[];
  totalMinutes: number;
  start: Date;
  end: Date;
  // Gap durations between segments in seconds
  wakeGaps: number[];
};

type TimelineItem =
  | { kind: 'entry'; sortTime: number; entry: ClassifiedSleepEntry }
  | { kind: 'night_group'; sortTime: number; group: NightGroup };

const getNightSessionSegmentsForReference = (
  entries: ClassifiedSleepEntry[],
  referenceDate: Date,
  nightWindowSettings: NightWindowSettings,
) => {
  const collectSegmentsForWindow = (anchor: 'previous' | 'upcoming') => {
    const { nightWindowStart, nightWindowEnd } = getNightWindowRangeForDate(
      referenceDate,
      nightWindowSettings,
      anchor
    );
    return entries
      .filter((entry) => {
        const start = new Date(entry.start_time);
        const end = entry.end_time ? new Date(entry.end_time) : new Date();
        return overlapMinutes(start, end, nightWindowStart, nightWindowEnd) > 0;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const now = new Date();
  const isReferenceToday =
    referenceDate.getFullYear() === now.getFullYear() &&
    referenceDate.getMonth() === now.getMonth() &&
    referenceDate.getDate() === now.getDate();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nightStartMinutes = clockTimeToMinutes(nightWindowSettings.startTime, 18 * 60);
  const preferUpcomingWindow = isReferenceToday && nowMinutes >= nightStartMinutes;

  const primary = collectSegmentsForWindow(preferUpcomingWindow ? 'upcoming' : 'previous');
  if (primary.length > 0) return primary;

  return collectSegmentsForWindow(preferUpcomingWindow ? 'previous' : 'upcoming');
};

const buildNightGroupFromSegments = (segments: ClassifiedSleepEntry[]): NightGroup | null => {
  if (segments.length === 0) return null;

  const sortedSegments = [...segments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const mergedIntervals = getMergedIntervalsForEntries(sortedSegments);
  if (mergedIntervals.length === 0) return null;

  const totalMinutes = minutesFromMergedIntervals(mergedIntervals);
  const wakeGaps: number[] = [];
  for (let index = 1; index < mergedIntervals.length; index += 1) {
    const previous = mergedIntervals[index - 1];
    const current = mergedIntervals[index];
    const wakeGapSeconds = Math.round((current.startMs - previous.endMs) / 1000);
    if (wakeGapSeconds > 0) {
      wakeGaps.push(wakeGapSeconds);
    }
  }

  return {
    entries: sortedSegments,
    segments: mergedIntervals.map((interval) => ({
      start: new Date(interval.startMs),
      end: new Date(interval.endMs),
    })),
    totalMinutes,
    start: new Date(mergedIntervals[0].startMs),
    end: new Date(mergedIntervals[mergedIntervals.length - 1].endMs),
    wakeGaps,
  };
};

const getNightWindowKeyForEntry = (
  entry: ClassifiedSleepEntry,
  nightWindowSettings: NightWindowSettings
): string | null => {
  const start = new Date(entry.start_time);
  const end = entry.end_time ? new Date(entry.end_time) : new Date();

  const previousWindow = getNightWindowRangeForDate(start, nightWindowSettings, 'previous');
  const upcomingWindow = getNightWindowRangeForDate(start, nightWindowSettings, 'upcoming');

  const previousOverlap = overlapMinutes(
    start,
    end,
    previousWindow.nightWindowStart,
    previousWindow.nightWindowEnd
  );
  const upcomingOverlap = overlapMinutes(
    start,
    end,
    upcomingWindow.nightWindowStart,
    upcomingWindow.nightWindowEnd
  );

  if (previousOverlap <= 0 && upcomingOverlap <= 0) return null;

  const selectedWindow = upcomingOverlap > previousOverlap ? upcomingWindow : previousWindow;
  return `${selectedWindow.nightWindowStart.toISOString()}|${selectedWindow.nightWindowEnd.toISOString()}`;
};

const getNightGroupsForDayEntries = (
  entries: ClassifiedSleepEntry[],
  nightWindowSettings: NightWindowSettings
): NightGroup[] => {
  const grouped = new Map<string, ClassifiedSleepEntry[]>();

  for (const entry of entries) {
    if (entry.period !== 'night') continue;
    const key = getNightWindowKeyForEntry(entry, nightWindowSettings);
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(entry);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((segments) => buildNightGroupFromSegments(segments))
    .filter((group): group is NightGroup => Boolean(group))
    .sort((a, b) => b.start.getTime() - a.start.getTime());
};

const getEntryIdentity = (entry: Pick<ClassifiedSleepEntry, 'id' | 'start_time' | 'end_time'>) =>
  `${entry.id ?? 'no-id'}|${entry.start_time}|${entry.end_time ?? ''}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const minutesToHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
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
      ? `${h}h ${m}m ${remainingSeconds} Sek`
      : `${h}h ${remainingSeconds} Sek`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatClockTime = (date: Date) =>
  date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const formatDurationSeconds = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

type CentralTimerProps = {
  activeSleepEntry: ClassifiedSleepEntry | null;
  isStartingSleep: boolean;
  isStoppingSleep: boolean;
  predictionLoading: boolean;
  sleepPrediction: SleepWindowPrediction | null;
  predictionError: string | null;
  hasSleepData: boolean;
  textPrimary: string;
  textSecondary: string;
  pulseAnim: Animated.Value;
};

const CentralTimer = React.memo(({
  activeSleepEntry,
  isStartingSleep,
  isStoppingSleep,
  predictionLoading,
  sleepPrediction,
  predictionError,
  hasSleepData,
  textPrimary,
  textSecondary,
  pulseAnim,
}: CentralTimerProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const ringSize = screenWidth * 0.75;
  const circleSize = ringSize * 0.8;

  useEffect(() => {
    if (!activeSleepEntry) {
      setElapsedTime(0);
      return;
    }

    const startMs = new Date(activeSleepEntry.start_time).getTime();
    if (!Number.isFinite(startMs)) {
      // Ungültiger start_time — kein Interval starten
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedTime(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  // activeSleepEntry?.id stellt sicher dass der Effect neu läuft wenn null→entry wechselt,
  // auch wenn start_time identisch bleibt (sonst würde der Interval nicht neu gestartet).
  }, [activeSleepEntry?.id, activeSleepEntry?.start_time]);

  useEffect(() => {
    if (activeSleepEntry) return;
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSleepEntry]);

  const progress = activeSleepEntry ? (elapsedTime / (8 * 60 * 60)) * 100 : 0;

  return (
    <View style={styles.centralTimerContainer}>
      <Animated.View pointerEvents="none" style={[styles.centralContainer, { transform: [{ scale: pulseAnim }] }]}>
        <View
          style={[
            styles.circleArea,
            { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }
          ]}
        >
          <View style={[styles.glassCircle, {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
          }]}>
            <BlurView intensity={18} tint="light" style={[styles.glassCircleBlur, { borderRadius: circleSize / 2 }]}>
              <View style={[styles.glassCircleOverlay, { borderRadius: circleSize / 2 }]} />
            </BlurView>
          </View>

          <View style={[styles.progressAbsolute, { width: circleSize, height: circleSize }]}>
            <ProgressCircle
              progress={progress}
              size={circleSize}
              strokeWidth={8}
              progressColor={activeSleepEntry ? '#87CEEB' : 'rgba(135, 206, 235, 0.4)'}
              backgroundColor="rgba(135, 206, 235, 0.2)"
              textColor="transparent"
            />
          </View>

          <View pointerEvents="none" style={styles.centerOverlay}>
            <Text
              style={[
                styles.centralTime,
                { color: textPrimary, fontWeight: '800' },
              ]}
            >
              {activeSleepEntry
                ? isStoppingSleep
                  ? 'Stoppe...'
                  : formatDurationSeconds(elapsedTime)
                : isStartingSleep
                  ? 'Starte...'
                  : currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View pointerEvents="none" style={styles.upperContent}>
            <View style={[styles.centralIcon, { backgroundColor: activeSleepEntry ? 'rgba(135, 206, 235, 0.9)' : 'rgba(255, 140, 66, 0.9)', borderRadius: 30, padding: 8, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
              <IconSymbol name={activeSleepEntry ? 'moon.fill' : 'sun.max.fill'} size={28} color="#FFFFFF" />
            </View>
          </View>

          <View pointerEvents="none" style={styles.lowerContent}>
            {activeSleepEntry && (
              <Text style={[styles.centralStatus, { color: textPrimary, fontWeight: '700' }]}>
                Schläft
              </Text>
            )}
            {activeSleepEntry ? (
              <Text style={[styles.centralHint, { color: textSecondary, fontWeight: '500' }]}>
                Seit {new Date(activeSleepEntry.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : predictionLoading ? (
              <Text style={[styles.centralHint, { color: textSecondary, fontWeight: '500' }]}>
                Schlaffenster wird berechnet...
              </Text>
            ) : sleepPrediction && hasSleepData ? (
              <Text style={[styles.centralHintPrimary, { color: textPrimary }]}>
                Nächstes Schlaffenster{'\n'}
                {formatClockTime(sleepPrediction.earliest)} – {formatClockTime(sleepPrediction.latest)}
              </Text>
            ) : !hasSleepData ? (
              <Text style={[styles.centralHint, { color: textSecondary, fontWeight: '500', textAlign: 'center' }]}>
                🔮 Lernphase{'\n'}Trage den ersten Schlaf ein
              </Text>
            ) : (
              <Text style={[styles.centralHint, { color: textSecondary, fontWeight: '500' }]}>
                {predictionError || 'Bereit für den nächsten Schlaf'}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

const StatusMetricsBar = ({
  stats,
  selectedDate,
  sleepPrediction,
  activeSleepEntry,
  hasSleepData,
  statsPage,
  onPageChange,
}: StatusMetricsBarProps) => {
  // Adaptive Farben für Dark Mode
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  const statsPageCount = 3;
  const statsScrollRef = useRef<ScrollView>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const getConfidenceLevel = (): 'high' | 'medium' | 'low' => {
    if (!sleepPrediction || !sleepPrediction.debug) return 'low';
    const historicalSamples = toNumber(sleepPrediction.debug.historicalSampleCount, 0);
    const personalizationSamples = toNumber(sleepPrediction.debug.personalizationSampleCount, 0);
    const totalSamples = historicalSamples + personalizationSamples;
    if (historicalSamples >= 7 || totalSamples >= 8) return 'high';
    if (historicalSamples >= 3 || totalSamples >= 4) return 'medium';
    return 'low';
  };

  const getTirednessLevel = (): { emoji: string; label: string; color: string } => {
    if (activeSleepEntry) {
      return { emoji: '💤', label: 'schläft', color: '#87CEEB' };
    }

    if (!sleepPrediction || !hasSleepData) {
      return { emoji: '🔮', label: 'lernt noch', color: '#B0B0B0' };
    }

    // Echtzeit-Berechnung: Minuten bis zum empfohlenen Schlafzeitpunkt
    const now = new Date();
    const minutesUntilWindow = Math.round(
      (sleepPrediction.recommendedStart.getTime() - now.getTime()) / 60000
    );

    if (minutesUntilWindow > 20) {
      return { emoji: '😊', label: 'ausgeruht', color: '#A8C4A2' };
    }

    if (minutesUntilWindow > 10) {
      return { emoji: '🥱', label: 'bald müde', color: '#FF8C42' };
    }

    if (minutesUntilWindow >= -5 && minutesUntilWindow <= 10) {
      return { emoji: '😴', label: 'jetzt hinlegen', color: '#8E4EC6' };
    }

    return { emoji: '😫', label: 'übermüdet', color: '#E53E3E' };
  };

  const getReasoningText = (): string => {
    if (activeSleepEntry) {
      const currentHour = new Date().getHours();
      const isNightNow = currentHour >= 20 || currentHour < 6;

      // Nachtschlaf: keine Nap-Zielzeit anzeigen
      if (activeSleepEntry.period === 'night' || isNightNow) {
        return 'Gute Nacht 🌙';
      }
      // Tagschlaf: verbleibende ideale Schlafdauer
      const target = toOptionalNumber(sleepPrediction?.debug?.targetNapDuration);
      if (target !== null) {
        const elapsed = (Date.now() - new Date(activeSleepEntry.start_time).getTime()) / 60000;
        const remaining = Math.round(target - elapsed);
        if (remaining > 0) {
          return `Noch ca. ${remaining} Min Schlaf ideal`;
        }
        return 'Könnte bald aufwachen';
      }
      return 'Schläft gerade';
    }

    if (!sleepPrediction || !sleepPrediction.debug) return 'Keine Vorhersage verfügbar';
    if (!hasSleepData) return 'Noch keine Schlafdaten';

    const lastNapDuration = toOptionalNumber(sleepPrediction.debug.lastNapDuration);
    const targetNapDuration = toOptionalNumber(sleepPrediction.debug.targetNapDuration);
    const sleepDebt = toNumber(sleepPrediction.debug.sleepDebt, 0);
    const circadianHour = toOptionalNumber(sleepPrediction.debug.circadianHour);
    const napDurationAdjustment = toNumber(sleepPrediction.debug.napDurationAdjustment, 0);
    const sleepDebtAdjustment = toNumber(sleepPrediction.debug.sleepDebtAdjustment, 0);

    const reasons: string[] = [];

    if (lastNapDuration !== null && targetNapDuration !== null && Math.abs(napDurationAdjustment) > 5) {
      if (napDurationAdjustment > 5) {
        reasons.push('Kurzer Nap → früher müde');
      } else if (napDurationAdjustment < -5) {
        reasons.push('Langer Nap → später müde');
      }
    }

    if (Math.abs(sleepDebt) > 30) {
      if (sleepDebtAdjustment < -5) {
        reasons.push('Viel wach → früher müde');
      } else if (sleepDebtAdjustment > 5) {
        reasons.push('Viel geschlafen → später müde');
      }
    }

    if (circadianHour !== null && circadianHour >= 16) {
      reasons.push('Nachmittags schneller müde');
    }

    if (reasons.length === 0) {
      return 'Normaler Rhythmus für dieses Alter';
    }

    return reasons[0];
  };

  const getCountdownText = (): string => {
    if (activeSleepEntry) return 'Schläft gerade';
    if (!sleepPrediction) return 'Keine Vorhersage';
    if (!hasSleepData) return 'Wird noch gelernt';

    const now = new Date();
    const minutesUntil = Math.round((sleepPrediction.recommendedStart.getTime() - now.getTime()) / 60000);

    if (minutesUntil <= 0 && minutesUntil >= -10) {
      return 'Schlafenszeit jetzt optimal';
    }

    if (minutesUntil < -10) {
      return 'Fenster bereits verpasst';
    }

    if (minutesUntil <= 5) {
      return 'Bereit zum Schlafen';
    }

    const hours = Math.floor(minutesUntil / 60);
    const mins = minutesUntil % 60;

    if (hours > 0) {
      return `In ca. ${hours}h ${mins}m müde`;
    }

    return `In ca. ${mins} Min müde`;
  };

  const getHistoricalText = (): string | null => {
    const historicalSampleCount = sleepPrediction
      ? toNumber(sleepPrediction.debug.historicalSampleCount, 0)
      : 0;
    if (!sleepPrediction || historicalSampleCount <= 0) {
      return null;
    }

    if (historicalSampleCount < 5) {
      return null;
    }

    // windowMinutes aus der Prediction selbst nehmen (nicht aus debug)
    const windowMinutes = sleepPrediction.windowMinutes as number;
    const hours = Math.floor(windowMinutes / 60);
    const mins = windowMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} Min`;

    return `In den letzten Tagen klappt Schlaf meist nach ~${timeStr} Wachzeit`;
  };

  useEffect(() => {
    if (!autoScrollEnabled) return;
    const timer = setInterval(() => {
      const nextPage = (statsPage + 1) % statsPageCount;
      statsScrollRef.current?.scrollTo({ x: nextPage * screenWidth, animated: true });
      onPageChange(nextPage);
    }, 8000);
    return () => clearInterval(timer);
  }, [autoScrollEnabled, onPageChange, statsPage, statsPageCount]);

  const tirednessLevel = getTirednessLevel();
  const reasoningText = getReasoningText();
  const countdownText = getCountdownText();
  const historicalText = getHistoricalText();
  const historyText = historicalText ?? 'Noch zu wenig Daten für einen Trend';
  const personalizationSamples = sleepPrediction
    ? toNumber(sleepPrediction.debug.personalizationSampleCount, 0)
    : 0;
  const hasPersonalization = personalizationSamples > 0;
  const confidenceLevel = sleepPrediction ? getConfidenceLevel() : null;
  const confidenceLabel =
    confidenceLevel === 'high'
      ? 'zuverlässig'
      : confidenceLevel === 'medium'
        ? 'wird besser'
        : 'lernt noch';
  const confidenceDot =
    confidenceLevel === 'high' ? '🟢' : confidenceLevel === 'medium' ? '🟡' : '⚪';
  const dayLabel = isSameDay(selectedDate, new Date())
    ? 'Heute'
    : selectedDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

  return (
    <View style={styles.statsContainer}>
      <ScrollView
        ref={statsScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setAutoScrollEnabled(false)}
        onScroll={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          onPageChange(page);
        }}
        scrollEventThrottle={16}
        style={styles.statsScroll}
      >
        <View style={[styles.statsPage, { width: screenWidth }]}>
          <View style={styles.kpiRow}>
            <GlassCard
              style={styles.kpiCard}
              intensity={20}
              overlayColor="rgba(142, 78, 198, 0.1)"
              borderColor="rgba(142, 78, 198, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="moon.fill" size={12} color="#8E4EC6" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{dayLabel}</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>{minutesToHMM(stats.totalMinutes)}</Text>
            </GlassCard>

            <GlassCard
              style={styles.kpiCard}
              intensity={20}
              overlayColor="rgba(255, 140, 66, 0.1)"
              borderColor="rgba(255, 140, 66, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="zzz" size={12} color="#FF8C42" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Naps</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>{stats.napsCount}</Text>
            </GlassCard>
          </View>

          <View style={styles.kpiRow}>
            <GlassCard
              style={styles.kpiCard}
              intensity={20}
              overlayColor="rgba(168, 196, 162, 0.1)"
              borderColor="rgba(168, 196, 162, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="clock.fill" size={12} color="#A8C4A2" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Längster</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>{minutesToHMM(stats.longestStretch)}</Text>
            </GlassCard>

            <GlassCard
              style={styles.kpiCard}
              intensity={20}
              overlayColor="rgba(255, 155, 155, 0.1)"
              borderColor="rgba(255, 155, 155, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="chart.line.uptrend.xyaxis" size={12} color="#FF9B9B" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Score</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>{stats.score}%</Text>
            </GlassCard>
          </View>

        </View>

        <View style={[styles.statsPage, { width: screenWidth }]}>
          <View style={styles.kpiRow}>
            <GlassCard
              style={[styles.kpiCard, styles.kpiCardWide]}
              intensity={20}
              overlayColor="rgba(142, 78, 198, 0.1)"
              borderColor="rgba(142, 78, 198, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="clock.badge" size={12} color="#8E4EC6" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Nächstes Fenster</Text>
                {confidenceLevel && (
                  <View style={styles.predictionMetaInline}>
                    <View style={styles.predictionBadge}>
                      <Text style={[styles.predictionBadgeText, { color: textSecondary }]}>
                        {hasPersonalization && confidenceLevel === 'high'
                          ? '✨ abgestimmt'
                          : `${confidenceDot} ${confidenceLabel}`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              {sleepPrediction && !activeSleepEntry && hasSleepData ? (
                <>
                  <Text style={[styles.kpiValue, styles.kpiValueCentered, { fontSize: 16, color: textPrimary }]}>
                    {sleepPrediction.earliest.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {sleepPrediction.latest.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={[styles.kpiSub, { color: textSecondary }]}>{countdownText}</Text>
                </>
              ) : (
                <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>
                  {activeSleepEntry ? '💤' : countdownText}
                </Text>
              )}
            </GlassCard>
          </View>

          <View style={styles.kpiRow}>
            <GlassCard
              style={styles.kpiCard}
              intensity={20}
              overlayColor={`${tirednessLevel.color}20`}
              borderColor={`${tirednessLevel.color}40`}
            >
              <View style={styles.kpiHeaderRow}>
                <Text style={{ fontSize: 14 }}>{tirednessLevel.emoji}</Text>
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Müdigkeit</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { fontSize: 14, color: textPrimary }]}>
                {tirednessLevel.label}
              </Text>
            </GlassCard>

            <GlassCard
              style={styles.kpiCard}
              intensity={20}
              overlayColor="rgba(168, 196, 162, 0.1)"
              borderColor="rgba(168, 196, 162, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="lightbulb.fill" size={12} color="#A8C4A2" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Grund</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { fontSize: 11, lineHeight: 14, color: textPrimary }]} numberOfLines={2}>
                {reasoningText}
              </Text>
              </GlassCard>
          </View>

        </View>

        <View style={[styles.statsPage, { width: screenWidth }]}>
          <View style={styles.kpiColumn}>
            <GlassCard
              style={[styles.kpiCard, styles.kpiCardWide, styles.kpiCardStack]}
              intensity={20}
              overlayColor="rgba(255, 140, 66, 0.1)"
              borderColor="rgba(255, 140, 66, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="chart.xyaxis.line" size={12} color="#FF8C42" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Verlauf</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { fontSize: 10, lineHeight: 13, color: textPrimary }]} numberOfLines={3}>
                {historyText}
              </Text>
            </GlassCard>

            <GlassCard
              style={[styles.kpiCard, styles.kpiCardWide]}
              intensity={20}
              overlayColor="rgba(135, 206, 235, 0.12)"
              borderColor="rgba(135, 206, 235, 0.3)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="moon.fill" size={12} color="#87CEEB" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>Nachtschlaf gesamt</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>
                {minutesToHMM(stats.nightTotalMinutes)}
              </Text>
              <Text style={[styles.kpiSub, { color: textSecondary }]}>
                {stats.nightSegmentCount > 0
                  ? `${stats.nightSegmentCount} Segment${stats.nightSegmentCount === 1 ? '' : 'e'}`
                  : 'Keine Nachtschlaf-Segmente'}
              </Text>
            </GlassCard>
          </View>
        </View>
      </ScrollView>

      <View style={styles.pagingDots}>
        <View style={[styles.pagingDot, statsPage === 0 && styles.pagingDotActive]} />
        <View style={[styles.pagingDot, statsPage === 1 && styles.pagingDotActive]} />
        <View style={[styles.pagingDot, statsPage === 2 && styles.pagingDotActive]} />
      </View>
    </View>
  );
};

// Convert SleepEntry to DailyEntry format for ActivityCard
const convertSleepToDailyEntry = (
  sleepEntry: ClassifiedSleepEntry,
  nightWindowSettings: NightWindowSettings
): any => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Bestimme Schlaftyp basierend auf Startzeit, Dauer und eingestelltem Nachtfenster
  const getSleepType = (startTime: string | Date, durationMinutes?: number) => {
    const date = new Date(startTime);
    const hour = date.getHours();
    
    // Nickerchen: max 30 Minuten
    if (durationMinutes && durationMinutes <= 30) {
      return 'nickerchen';
    }
    
    // Nachtschlaf: dynamisches, konfigurierbares Nachtfenster
    if (getSleepPeriodForStart(date, nightWindowSettings) === 'night') {
      return 'nacht';
    }
    
    // Mittagsschlaf: 12:00-14:59
    if (hour >= 12 && hour < 15) {
      return 'mittag';
    }
    
    // Tagschlaf: außerhalb des Nachtfensters (außer Mittagszeit)
    return 'tag';
  };

  const getSleepEmoji = (sleepType: string, quality?: SleepQuality) => {
    if (sleepType === 'nickerchen') return '😌';
    if (sleepType === 'nacht') return '💤';
    if (sleepType === 'mittag') return '😴';
    if (sleepType === 'tag') return '☀️';
    
    // Fallback basierend auf Qualität
    switch (quality) {
      case 'good': return QUALITY_VISUALS.good.emoji;
      case 'medium': return QUALITY_VISUALS.medium.emoji;
      case 'bad': return QUALITY_VISUALS.bad.emoji;
      default: return '💤';
    }
  };

  const getSleepLabel = (sleepType: string, quality?: SleepQuality) => {
    type LabelGender = 'm' | 'f' | 'n';
    type SleepLabelMeta = { label: string; gender: LabelGender };

    const sleepLabelMeta: Record<string, SleepLabelMeta> = {
      nickerchen: { label: 'Nickerchen', gender: 'n' },
      nacht: { label: 'Nachtschlaf', gender: 'm' },
      mittag: { label: 'Mittagsschlaf', gender: 'm' },
      tag: { label: 'Tagschlaf', gender: 'm' },
    };

    const { label, gender } = sleepLabelMeta[sleepType] ?? { label: 'Schlaf', gender: 'm' as LabelGender };
    if (!quality) return label;

    const adjectiveByQuality: Record<NonNullable<SleepQuality>, Record<LabelGender, string>> = {
      good: { m: 'Guter', f: 'Gute', n: 'Gutes' },
      medium: { m: 'Mittlerer', f: 'Mittlere', n: 'Mittleres' },
      bad: { m: 'Schlechter', f: 'Schlechte', n: 'Schlechtes' },
    };

    return `${adjectiveByQuality[quality][gender]} ${label}`;
  };

  // Bestimme Schlaftyp basierend auf Startzeit und Dauer
  const sleepType = getSleepType(sleepEntry.start_time, sleepEntry.duration_minutes);

  const notes = [];
  if (sleepEntry.quality) {
    notes.push(`Qualität: ${sleepEntry.quality === 'good' ? 'Gut' : sleepEntry.quality === 'medium' ? 'Mittel' : 'Schlecht'}`);
  }
  if (sleepEntry.notes) {
    notes.push(sleepEntry.notes);
  }
  if (sleepEntry.duration_minutes) {
    notes.push(`Dauer: ${formatDuration(sleepEntry.duration_minutes)}`);
  }

  return {
    id: sleepEntry.id,
    entry_date: sleepEntry.start_time,
    entry_type: 'sleep',
    start_time: sleepEntry.start_time,
    end_time: sleepEntry.end_time,
    notes: notes.join(' • '),
    feeding_type: undefined,
    feeding_volume_ml: undefined,
    feeding_side: undefined,
    diaper_type: undefined,
    // Sleep-specific data
    sleep_quality: sleepEntry.quality,
    sleep_type: sleepType,
    duration_minutes: sleepEntry.duration_minutes,
    // For ActivityCard compatibility
    sub_type: `sleep_${sleepEntry.quality || 'unknown'}_${sleepType}`,
    emoji: getSleepEmoji(sleepType, sleepEntry.quality),
    label: getSleepLabel(sleepType, sleepEntry.quality)
  };
};

// Manual entry modal data
interface ManualEntryData {
  start_time: Date;
  end_time?: Date;
  quality?: SleepQuality;
  notes?: string;
  period: SleepPeriod;
}

// LiquidGlassCard imported from DesignGuide


export default function SleepTrackerScreen() {
  // Verwende useAdaptiveColors für korrekte Farben basierend auf Hintergrundbild
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;

  // Dark Mode angepasste Farben
  const textPrimary = isDark ? Colors.dark.textPrimary : '#6B4C3B';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const modalSubtitleColor = isDark ? Colors.dark.textSecondary : '#A8978E';
  const modalOverlayColor = isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)';
  const modalPanelColor = isDark ? 'rgba(10,10,12,0.86)' : 'transparent';
  const modalPanelBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'transparent';
  const modalGhostButtonColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const modalFieldColor = isDark ? 'rgba(18,18,22,0.76)' : 'rgba(255,255,255,0.8)';
  const modalFieldBorderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)';
  const modalPickerColor = isDark ? 'rgba(22,22,26,0.95)' : 'rgba(255,255,255,0.9)';
  const modalQualityDefaultColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(230,230,230,0.8)';
  const modalAccentColor = isDark ? '#A26BFF' : '#8E4EC6';
  const router = useRouter();
  const { user } = useAuth();
  const { activeBackend } = useBackend();
  const { convexClient } = useConvex();
  const { activeBabyId } = useActiveBaby();
  const { isReadOnlyPreviewMode } = useBabyStatus();
  const sleepService = user ? useSleepEntriesService() : null;
  const paywallCheckInFlight = useRef(false);
  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);
  const showReadOnlyPreviewAlert = useCallback(() => {
    Alert.alert('Nur Vorschau', BABY_MODE_PREVIEW_READ_ONLY_MESSAGE);
  }, []);
  const ensureWritableInCurrentMode = useCallback(() => {
    if (!isReadOnlyPreviewMode) return true;
    showReadOnlyPreviewAlert();
    return false;
  }, [isReadOnlyPreviewMode, showReadOnlyPreviewAlert]);

  // State management
  const [sleepEntries, setSleepEntries] = useState<ClassifiedSleepEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSleepEntry, setActiveSleepEntry] = useState<ClassifiedSleepEntry | null>(null);
  const activeEntryPeriodOverridesRef = useRef<Record<string, SleepPeriod>>({});
  const [pausedNightState, setPausedNightState] = useState<PausedNightState | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingEntry, setEditingEntry] = useState<ClassifiedSleepEntry | null>(null);
  const hasAutoSelectedDateRef = useRef(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Navigation offsets für Woche und Monat
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = diese Woche, -1 = letzte, +1 = nächste
  const [monthOffset, setMonthOffset] = useState(0); // 0 = dieser Monat, -1 = vorheriger, +1 = nächster
  const [isLiveStatusLoaded, setIsLiveStatusLoaded] = useState(false);
  const [babyBirthdate, setBabyBirthdate] = useState<Date | null>(null);
  const [babyBedtime, setBabyBedtime] = useState<string>('19:30');
  const [nightWindowSettings, setNightWindowSettings] = useState<NightWindowSettings>(
    DEFAULT_NIGHT_WINDOW_SETTINGS
  );
  const [babyName, setBabyName] = useState<string | undefined>(undefined);
  const [sleepPrediction, setSleepPrediction] = useState<SleepWindowPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const predictionRef = useRef<SleepWindowPrediction | null>(null);
  const [statsPage, setStatsPage] = useState(0);

  // Notification hooks
  const { requestPermissions } = useNotifications();
  const { isPartnerLinked } = usePartnerNotifications();

  // Bei Tabwechsel Offsets zurücksetzen
  useEffect(() => {
    setWeekOffset(0);
    setMonthOffset(0);
  }, [selectedTab]);

  // Splash System komplett entfernt - saubere Sleep-Tracker Implementierung

  // Sleep Modal States
  const [sleepModalData, setSleepModalData] = useState({
    start_time: new Date(),
    end_time: null as Date | null,
    quality: null as SleepQuality | null,
    notes: ''
  });
  const [showNightEditor, setShowNightEditor] = useState(false);
  const [nightEditorGroup, setNightEditorGroup] = useState<NightGroup | null>(null);
  const [isSplittingSegment, setIsSplittingSegment] = useState(false);

  // Notes overlay (wie Planner)
  const [notesOverlayVisible, setNotesOverlayVisible] = useState(false);
  const [notesOverlayValue, setNotesOverlayValue] = useState('');

  const openNotesEditor = () => {
    setNotesOverlayValue(sleepModalData.notes ?? '');
    setNotesOverlayVisible(true);
  };

  const closeNotesEditor = () => {
    setNotesOverlayVisible(false);
    setNotesOverlayValue('');
  };

  const saveNotesEditor = (next?: string) => {
    const val = typeof next === 'string' ? next : notesOverlayValue;
    setSleepModalData((prev) => ({ ...prev, notes: val }));
    closeNotesEditor();
  };

  useEffect(() => {
    if (!showInputModal) {
      closeNotesEditor();
    }
  }, [showInputModal]);

  const checkPaywallGate = useCallback(async () => {
    if (paywallCheckInFlight.current || !user) return;
    paywallCheckInFlight.current = true;

    try {
      const { shouldShow } = await shouldShowPaywall();
      if (shouldShow) {
        await markPaywallShown('sleep-tracker');
        router.push({
          pathname: '/paywall',
          params: { next: '/(tabs)/sleep-tracker', origin: 'sleep-tracker' }
        });
      }
    } catch (err) {
      console.error('Paywall check on sleep tracker failed:', err);
    } finally {
      paywallCheckInFlight.current = false;
    }
  }, [router, user]);

  useFocusEffect(
    useCallback(() => {
      checkPaywallGate();
    }, [checkPaywallGate])
  );

  const refreshNightWindowSettings = useCallback(async () => {
    try {
      const loaded = await loadNightWindowSettings(user?.id);
      setNightWindowSettings(loaded);
    } catch (error) {
      console.error('Failed to load night window settings:', error);
      setNightWindowSettings(DEFAULT_NIGHT_WINDOW_SETTINGS);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshNightWindowSettings();
  }, [refreshNightWindowSettings]);

  useFocusEffect(
    useCallback(() => {
      void refreshNightWindowSettings();
    }, [refreshNightWindowSettings])
  );

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startPickerDraft, setStartPickerDraft] = useState(new Date());
  const [endPickerDraft, setEndPickerDraft] = useState(new Date());

  // Splash System wie in daily_old.tsx
  const [splashVisible, setSplashVisible] = useState(false);
  const [splashBg, setSplashBg] = useState<string>('rgba(0,0,0,0.6)');
  const [splashText, setSplashText] = useState<string>('Gespeichert');
  const splashAnim = useRef(new Animated.Value(0)).current;
  const splashEmojiAnim = useRef(new Animated.Value(0.9)).current;
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [splashTitle, setSplashTitle] = useState<string>('');
  const [splashSubtitle, setSplashSubtitle] = useState<string>('');
  const [splashStatus, setSplashStatus] = useState<string>('');
  const [splashHint, setSplashHint] = useState<string>('');
  const [isStartingSleep, setIsStartingSleep] = useState(false);
  const [isStoppingSleep, setIsStoppingSleep] = useState(false);
  const [showSleepInfoModal, setShowSleepInfoModal] = useState(false);
  const lastLiveStopEventRef = useRef<{ url: string; at: number } | null>(null);
  const handledLiveStopRequestIdRef = useRef(0);
  const [liveStopRequestId, setLiveStopRequestId] = useState(0);

  const queueLiveStopRequestFromUrl = useCallback((incomingUrl: string | null) => {
    if (!incomingUrl) return;

    const targetsSleepTracker = incomingUrl.toLowerCase().includes('sleep-tracker');
    const hasLiveStopParam = /[?&]liveStop=(1|true)(?:&|$)/i.test(incomingUrl);

    if (!targetsSleepTracker || !hasLiveStopParam) {
      return;
    }

    const now = Date.now();
    const lastEvent = lastLiveStopEventRef.current;
    if (lastEvent && lastEvent.url === incomingUrl && now - lastEvent.at < 1500) {
      return;
    }

    lastLiveStopEventRef.current = { url: incomingUrl, at: now };
    setLiveStopRequestId((prev) => prev + 1);
  }, []);

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

      // iOS compact datetime can emit epoch dates when only time is changed.
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

  const normalizePickerDate = useCallback(
    (value?: Date | null, fallback?: Date) => sanitizeManualDate(value, fallback),
    [sanitizeManualDate]
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

  const resetManualModalData = useCallback(() => {
    const now = sanitizeManualDate(new Date());
    setSleepModalData({
      start_time: now,
      end_time: null,
      quality: null,
      notes: ''
    });
    setStartPickerDraft(now);
    setEndPickerDraft(now);
    setShowStartPicker(false);
    setShowEndPicker(false);
  }, [sanitizeManualDate]);

  const closeManualSleepModal = useCallback(() => {
    setShowInputModal(false);
    setEditingEntry(null);
    resetManualModalData();
  }, [resetManualModalData]);

  const openManualSleepModal = useCallback(() => {
    if (!ensureWritableInCurrentMode()) return;
    setEditingEntry(null);
    resetManualModalData();
    setShowInputModal(true);
  }, [ensureWritableInCurrentMode, resetManualModalData]);

  const openEditSleepModal = useCallback((entry: ClassifiedSleepEntry) => {
    if (!ensureWritableInCurrentMode()) return;
    setEditingEntry(entry);
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowInputModal(true);
  }, [ensureWritableInCurrentMode]);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const appearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSleepData();
  }, [activeBabyId, activeBackend, convexClient]);

  useEffect(() => {
    if (activeSleepEntry) {
      setPausedNightState(null);
    }
  }, [activeSleepEntry?.id]);

  // Initialize personalization on mount or when baby changes
  useEffect(() => {
    initializePersonalization(activeBabyId ?? undefined);
  }, [activeBabyId]);

  // Request notification permissions on mount
  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      queueLiveStopRequestFromUrl(event.url);
    });

    Linking.getInitialURL()
      .then((initialUrl) => {
        queueLiveStopRequestFromUrl(initialUrl);
      })
      .catch((error) => {
        console.error('Failed to read initial URL for Live Activity stop:', error);
      });

    return () => {
      subscription.remove();
    };
  }, [queueLiveStopRequestFromUrl]);

  // Lade die aktuelle Partner-ID (aus account_links) für neue Einträge
  const refreshPartnerId = useCallback(async () => {
    if (!user?.id) {
      setPartnerId(null);
      return null;
    }
    try {
      const { success, linkedUsers } = await loadConnectedUsers(true);
      if (success && linkedUsers && linkedUsers.length > 0) {
        setPartnerId(linkedUsers[0].userId);
        return linkedUsers[0].userId;
      }
    } catch (err) {
      console.error('Failed to load partner id:', err);
    }
    setPartnerId(null);
    return null;
  }, [user?.id, activeBabyId]);

  const getEffectivePartnerId = useCallback(async () => {
    if (partnerId) return partnerId;
    return refreshPartnerId();
  }, [partnerId, refreshPartnerId]);

  useEffect(() => {
    refreshPartnerId();
  }, [refreshPartnerId]);

  useEffect(() => {
      if (!user?.id) {
        setBabyBirthdate(null);
        setBabyBedtime('19:30');
        setBabyName(undefined);
        return;
      }

    let isMounted = true;

    const fetchBabyProfile = async () => {
      try {
        const { data } = await getBabyInfo(activeBabyId ?? undefined);
        if (!isMounted) return;

        if (data?.birth_date) {
          setBabyBirthdate(parseSafeDate(data.birth_date));
        } else {
          setBabyBirthdate(null);
        }
        setBabyBedtime(normalizeBedtimeAnchor(data?.preferred_bedtime ?? null));
        setBabyName(data?.name || undefined);
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load baby info for sleep prediction:', error);
          setBabyBedtime('19:30');
        }
      }
    };

    fetchBabyProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.id, activeBabyId]);

  useEffect(() => {
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [appearAnim]);

  // Timer animation for active sleep
  useEffect(() => {
    if (!activeSleepEntry) {
      pulseAnim.setValue(1);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [activeSleepEntry, pulseAnim]);

  const updateSleepPrediction = useCallback(
    async (entries: ClassifiedSleepEntry[]) => {
      if (!user?.id) {
        setSleepPrediction(null);
        predictionRef.current = null;
        setPredictionLoading(false);
        return;
      }

      setPredictionLoading(true);
      try {
        const prediction = await predictNextSleepWindow({
          userId: user.id,
          babyId: activeBabyId ?? undefined, // Gemeinsame Personalization für Partner
          birthdate: babyBirthdate ?? undefined,
          entries,
          anchorBedtime: babyBedtime,
        });
        setSleepPrediction(prediction);
        predictionRef.current = prediction;
        setPredictionError(null);
      } catch (error) {
        console.error('Failed to predict next sleep window:', error);
        setSleepPrediction(null);
        predictionRef.current = null;
        setPredictionError('Vorhersage aktuell nicht möglich');
      } finally {
        setPredictionLoading(false);
      }
    },
    [user?.id, activeBabyId, babyBirthdate, babyBedtime]
  );

  useEffect(() => {
    updateSleepPrediction(sleepEntries);
  }, [sleepEntries, updateSleepPrediction]);

  // Keep prediction in sync with notification engine (which refreshes every 5 minutes in _layout)
  useEffect(() => {
    const interval = setInterval(() => {
      updateSleepPrediction(sleepEntries);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [sleepEntries, updateSleepPrediction]);

  useEffect(() => {
    if (!isLiveStatusLoaded || !sleepActivityService.isLiveActivitySupported()) {
      return;
    }

    let cancelled = false;

    const syncSleepLiveActivity = async () => {
      try {
        if (activeSleepEntry?.start_time) {
          const restored = await sleepActivityService.restoreCurrentActivity();

          if (cancelled) return;

          if (!restored) {
            await sleepActivityService.startSleepActivity(new Date(activeSleepEntry.start_time), babyName);
            return;
          }

          const elapsedSeconds = Math.max(
            0,
            Math.floor((Date.now() - new Date(activeSleepEntry.start_time).getTime()) / 1000)
          );
          await sleepActivityService.updateSleepActivity(formatDurationSeconds(elapsedSeconds));
        } else {
          await sleepActivityService.endAllSleepActivities();
        }
      } catch (error) {
        console.error('Failed to synchronize sleep live activity:', error);
      }
    };

    void syncSleepLiveActivity();

    return () => {
      cancelled = true;
    };
  }, [activeSleepEntry?.id, activeSleepEntry?.start_time, isLiveStatusLoaded]);

  useEffect(() => {
    if (!isLiveStatusLoaded || !activeSleepEntry?.start_time) {
      return;
    }

    if (!sleepActivityService.isLiveActivitySupported()) {
      return;
    }

    const updateElapsedTimeInLiveActivity = async () => {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(activeSleepEntry.start_time).getTime()) / 1000)
      );
      await sleepActivityService.updateSleepActivity(formatDurationSeconds(elapsedSeconds));
    };

    void updateElapsedTimeInLiveActivity();

    const intervalId = setInterval(() => {
      void updateElapsedTimeInLiveActivity();
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [activeSleepEntry?.id, activeSleepEntry?.start_time, isLiveStatusLoaded]);

  // Classify sleep entry by time period
  const classifySleepEntry = useCallback((entry: any, forcedPeriod?: SleepPeriod): ClassifiedSleepEntry => {
    const period = forcedPeriod ?? getSleepPeriodForStart(new Date(entry.start_time), nightWindowSettings);
    const isActive = !entry.end_time;
    
    return {
      ...entry,
      period,
      isActive
    };
  }, [nightWindowSettings]);

  useEffect(() => {
    setSleepEntries((prevEntries) =>
      prevEntries.map((entry) => {
        const forced = entry.id ? activeEntryPeriodOverridesRef.current[entry.id] : undefined;
        return classifySleepEntry(entry, forced);
      })
    );

    setActiveSleepEntry((prevActive) => {
      if (!prevActive) return prevActive;
      const forced = prevActive.id ? activeEntryPeriodOverridesRef.current[prevActive.id] : undefined;
      return classifySleepEntry(prevActive, forced);
    });
  }, [classifySleepEntry]);

  // Sync function removed - now using dual-write via SleepEntriesService

  const loadVisibleSleepEntries = useCallback(
    async (babyId?: string) => {
      if (!sleepService) {
        // Fallback to old method if service not available (user not logged in)
        return await loadAllVisibleSleepEntries(babyId);
      }

      try {
        const result = await sleepService.getEntries(babyId);

        if (result.data) {
          const subMinuteEntries = result.data.filter((entry) => isSubMinuteFinishedSleepEntry(entry));

          if (subMinuteEntries.length > 0) {
            const ownEntryIdsToDelete =
              activeBackend === 'supabase'
                ? subMinuteEntries
                    .filter(
                      (entry) =>
                        typeof entry.id === 'string' && entry.id.length > 0 && entry.user_id === user?.id
                    )
                    .map((entry) => entry.id as string)
                : [];

            if (ownEntryIdsToDelete.length > 0) {
              const deleteResults = await Promise.all(
                ownEntryIdsToDelete.map((entryId) => sleepService.deleteEntry(entryId))
              );

              const failedDeletes = deleteResults.filter((deleteResult) => deleteResult.primary.error);
              if (failedDeletes.length > 0) {
                console.warn(
                  `[SleepTracker] Failed to auto-delete ${failedDeletes.length} sub-minute sleep entries from Supabase.`
                );
              }
            }
          }

          const cleanedEntries = result.data.filter((entry) => !isSubMinuteFinishedSleepEntry(entry));
          return { success: true, entries: cleanedEntries };
        }

        if (result.error) {
          console.error('[SleepTracker] Failed to load sleep entries:', result.error);
          return { success: false, entries: [] };
        }

        return { success: false, entries: [] };
      } catch (error) {
        console.error('[SleepTracker] Unexpected error loading sleep entries:', error);
        return { success: false, entries: [] };
      }
    },
    [activeBackend, sleepService, user?.id]
  );

  // Load LIVE status (active sleep entry) - NEVER cache!
  const loadLiveStatus = async () => {
    try {
      const { success, entries } = await loadVisibleSleepEntries(activeBabyId ?? undefined);
      if (success && entries) {
        const active = entries.find((entry) => !entry.end_time && !isStaleActiveSleepEntry(entry)) ?? null;
        if (!active) {
          activeEntryPeriodOverridesRef.current = {};
          return null;
        }
        const periodOverride = active.id ? activeEntryPeriodOverridesRef.current[active.id] : undefined;
        return classifySleepEntry(active, periodOverride);
      }
    } catch (error) {
      console.error('Failed to load live status:', error);
    }
    return null;
  };

  // Load sleep history (finished entries) - WITH cache!
  const loadSleepHistory = async () => {
    // WICHTIG: Cache-Key nur mit Baby-ID, damit Partner denselben Cache teilen!
    const cacheKey = `screen_cache_sleep_history_${activeBackend}_${activeBabyId || 'default'}`;

    const result = await loadWithRevalidate(
      cacheKey,
      async () => {
        const { success, entries } = await loadVisibleSleepEntries(activeBabyId ?? undefined);
        if (success && entries) {
          // Only return finished entries for history
          return entries.filter(entry => entry.end_time);
        }
        return [];
      },
      CacheStrategy.SHORT // 30 Sekunden cache für Predictions-Synchronität
    );

    return result;
  };

  // Load sleep data (combines live + cached history)
  const loadSleepData = async () => {
    try {
      setIsLoading(true);
      setIsLiveStatusLoaded(false);

      // LIVE: Always fresh, no cache
      const activeSleep = await loadLiveStatus();
      // Nur auf null setzen wenn die DB explizit keinen aktiven Eintrag zurückgibt.
      // Wenn activeSleep null ist und wir bereits einen gesetzten Eintrag haben, behalten wir
      // ihn — sonst tritt eine Race Condition auf: handleStartSleep setzt activeSleepEntry
      // sofort, aber loadLiveStatus findet den Eintrag noch nicht in der DB, was den Timer
      // auf elapsedTime=0 zurücksetzt und den Interval zerstört.
      setActiveSleepEntry(prev => {
        if (activeSleep !== null) return activeSleep;
        // null von DB: nur zurücksetzen wenn kein laufender Eintrag bekannt ist,
        // oder wenn der bekannte Eintrag bereits eine end_time hat (also gestoppt wurde).
        if (prev === null || prev.end_time) return null;
        // Andernfalls: aktuellen Wert behalten (DB noch nicht synced)
        return prev;
      });

      // HISTORY: With cache, refresh in background
      const { data: finishedEntries, isStale, refresh } = await loadSleepHistory();

      // Handle null data gracefully
      const safeFinishedEntries = finishedEntries || [];

      // Combine active + finished entries
      const allEntries = activeSleep
        ? [activeSleep, ...safeFinishedEntries.map((entry) => classifySleepEntry(entry))]
        : safeFinishedEntries.map((entry) => classifySleepEntry(entry));

      setSleepEntries(allEntries);

      // Background refresh if cache was stale
      if (isStale) {
        refresh().then(freshEntries => {
          const safeFreshEntries = freshEntries || [];
          const combinedFresh = activeSleep
            ? [activeSleep, ...safeFreshEntries.map((entry) => classifySleepEntry(entry))]
            : safeFreshEntries.map((entry) => classifySleepEntry(entry));
          setSleepEntries(combinedFresh);
        });
      }

      // Auto-select latest entry logic
      if (
        !hasAutoSelectedDateRef.current &&
        allEntries.length > 0 &&
        !allEntries.some(e => {
          const s = new Date(e.start_time);
          const ee = e.end_time ? new Date(e.end_time) : new Date();
          const ds = startOfDay(selectedDate);
          const de = endOfDay(selectedDate);
          return overlapMinutes(s, ee, ds, de) > 0;
        })
      ) {
        const latest = allEntries.reduce((latestEntry, entry) => {
          if (!latestEntry) return entry;
          return new Date(entry.start_time).getTime() > new Date(latestEntry.start_time).getTime()
            ? entry
            : latestEntry;
        }, null as ClassifiedSleepEntry | null);

        if (latest) {
          hasAutoSelectedDateRef.current = true;
          setSelectedTab('day');
          setSelectedDate(new Date(latest.start_time));
        }
      }
    } catch (error) {
      console.error('Failed to load sleep data:', error);
      setPredictionLoading(false);
    } finally {
      setIsLiveStatusLoaded(true);
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSleepData();
  };

  const applyNightQualityToSession = useCallback(async (
    quality: NonNullable<SleepQuality>,
    referenceDate: Date,
    excludedEntryIds: string[] = [],
  ) => {
    if (!sleepService) return { updated: 0, failed: 0 };

    const excluded = new Set(excludedEntryIds);
    const nightSegments = getNightSessionSegmentsForReference(
      sleepEntries,
      referenceDate,
      nightWindowSettings
    )
      .filter((entry) => Boolean(entry.id) && Boolean(entry.end_time) && !excluded.has(entry.id as string));

    let updated = 0;
    let failed = 0;

    for (const segment of nightSegments) {
      const entryId = segment.id;
      if (!entryId) continue;

      const result = await sleepService.updateEntry(entryId, { quality });

      if (result.primary.error) {
        failed += 1;
        console.error('❌ Failed to propagate night quality:', result.primary.error);
        continue;
      }

      updated += 1;

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
      }
    }

    return { updated, failed };
  }, [nightWindowSettings, sleepEntries, sleepService]);

  // Start sleep tracking
  const handleStartSleep = async (period: SleepPeriod) => {
    if (!ensureWritableInCurrentMode()) return false;
    if (isStartingSleep) return false;
    if (!user?.id || !sleepService) {
      Alert.alert('Fehler', 'Service nicht verfügbar');
      return false;
    }

    setIsStartingSleep(true);
    try {
      const effectivePartnerId = await getEffectivePartnerId();
      const now = new Date();
      const startTime = now.toISOString();

      // Dual-write to both backends (completely separate, no sync)
      const result = await sleepService.createEntry({
        user_id: user.id,
        baby_id: activeBabyId ?? null,
        start_time: startTime,
        end_time: null, // Active sleep has no end time yet
        quality: null,
        notes: null,
        duration_minutes: null,
        partner_id: effectivePartnerId ?? null,
      });

      if (result.primary.error) {
        console.error('❌ Start sleep error:', result.primary.error);
        Alert.alert('Fehler', 'Schlaftracking konnte nicht gestartet werden');
        return false;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend write failed:', result.secondary.error);
      }

      // Aktiver Schlaf läuft jetzt: ausstehende Schlaffenster-Erinnerungen sofort entfernen.
      try {
        await cancelLocalSleepWindowReminders();
        if (activeBabyId) {
          await cancelBabyReminderNotification({
            userId: user.id,
            babyId: activeBabyId,
            reminderType: 'sleep_window',
          });
        }
      } catch (reminderError) {
        console.error('Failed to cancel pending sleep window reminders:', reminderError);
      }

      // Use primary result to set active sleep entry
      const entry = result.primary.data!;
      activeEntryPeriodOverridesRef.current[entry.id] = period;
      const classifiedEntry = classifySleepEntry(entry, period);
      setActiveSleepEntry(classifiedEntry);

      if (predictionRef.current) {
        try {
          // Verwende babyId statt userId für gemeinsame Personalization zwischen Partnern
          await updatePersonalizationAfterNap(
            activeBabyId || user.id,
            predictionRef.current.napIndexToday,
            predictionRef.current.timeOfDayBucket,
            predictionRef.current.recommendedStart,
            now,
          );
        } catch (personalizationError) {
          console.error('Failed to update sleep personalization:', personalizationError);
        } finally {
          predictionRef.current = null;
          setSleepPrediction(null);
          setPredictionError(null);
          setPredictionLoading(true);
        }
      }

      // Invalidate cache and reload
      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();

      // Splash anzeigen
      showSuccessSplash(
        '#87CEEB', // Baby blue
        period === 'night' ? '🌙' : '😴',
        period === 'night' ? 'sleep_start_night' : 'sleep_start_day'
      );
      return true;
    } catch (error) {
      console.error('❌ Unexpected start sleep error:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Starten des Schlaftrackers');
      return false;
    } finally {
      setIsStartingSleep(false);
    }
  };

  // Stop sleep tracking
  const handleStopSleep = async (quality: NonNullable<SleepQuality>, notes?: string) => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeSleepEntry?.id || isStoppingSleep || !sleepService) return;
    setIsStoppingSleep(true);

    try {
      const endTime = new Date();
      const startTime = new Date(activeSleepEntry.start_time);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      if (durationMs < MIN_PERSISTED_SLEEP_DURATION_MS) {
        const deleteResult = await sleepService.deleteEntry(activeSleepEntry.id);
        if (deleteResult.primary.error) {
          console.error('❌ Delete sub-minute sleep error:', deleteResult.primary.error);
          Alert.alert('Fehler', 'Sehr kurzer Eintrag konnte nicht automatisch gelöscht werden');
          return;
        }

        if (deleteResult.secondary.error) {
          console.warn('[SleepTracker] Secondary backend delete failed:', deleteResult.secondary.error);
        }

        try {
          await sleepActivityService.endAllSleepActivities();
        } catch (liveActivityError) {
          console.error('Failed to end sleep live activity after deleting sub-minute entry:', liveActivityError);
        }

        delete activeEntryPeriodOverridesRef.current[activeSleepEntry.id];
        setActiveSleepEntry(null);
        setPausedNightState(null);

        Alert.alert('Hinweis', 'Ein Schlafeintrag unter 1 Minute wurde automatisch gelöscht.');

        await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
        await loadSleepData();
        return;
      }

      // Dual-write update to both backends (completely separate, no sync)
      const result = await sleepService.updateEntry(activeSleepEntry.id, {
        end_time: endTime.toISOString(),
        quality,
        notes: notes ?? null,
        duration_minutes: durationMinutes,
      });

      if (result.primary.error) {
        console.error('❌ Stop sleep error:', result.primary.error);
        Alert.alert('Fehler', 'Schlaftracking konnte nicht gestoppt werden');
        return;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
      }

      if (activeSleepEntry.period === 'night') {
        const propagated = await applyNightQualityToSession(quality, startTime, [activeSleepEntry.id]);
        if (propagated.failed > 0) {
          Alert.alert('Hinweis', 'Die Qualität konnte nicht auf alle Nachtschlaf-Segmente übertragen werden.');
        }
      }

      try {
        await sleepActivityService.endSleepActivity(
          quality,
          formatDurationSeconds(Math.max(0, durationMinutes) * 60)
        );
      } catch (liveActivityError) {
        console.error('Failed to end sleep live activity:', liveActivityError);
      }

      delete activeEntryPeriodOverridesRef.current[activeSleepEntry.id];
      setActiveSleepEntry(null);
      setPausedNightState(null);

      const splashKind = quality === 'good' ? 'sleep_stop_good' : quality === 'bad' ? 'sleep_stop_bad' : 'sleep_stop_medium';
      const splashColor = QUALITY_VISUALS[quality].color;
      const splashEmoji = QUALITY_VISUALS[quality].emoji;
      showSuccessSplash(splashColor, splashEmoji, splashKind);

      // Invalidate cache because stopped sleep now appears in history
      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Unexpected stop sleep error:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Stoppen des Schlaftrackers');
    } finally {
      setIsStoppingSleep(false);
    }
  };

  const handlePauseNightSleep = async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeSleepEntry?.id || isStoppingSleep || !sleepService) return;

    const activeStart = new Date(activeSleepEntry.start_time);
    if (activeSleepEntry.period !== 'night') {
      Alert.alert('Hinweis', 'Pause ist nur im Nachtschlaf verfügbar.');
      return;
    }

    setIsStoppingSleep(true);
    try {
      const pausedAt = new Date();
      const durationMs = pausedAt.getTime() - activeStart.getTime();
      if (durationMs < MIN_PERSISTED_SLEEP_DURATION_MS) {
        Alert.alert('Bitte warten', 'Pausieren ist erst nach mindestens 1 Minute Schlaf möglich.');
        return;
      }
      const durationMinutes = Math.max(
        0,
        Math.round(durationMs / 60000)
      );

      const result = await sleepService.updateEntry(activeSleepEntry.id, {
        end_time: pausedAt.toISOString(),
        duration_minutes: durationMinutes,
      });

      if (result.primary.error) {
        console.error('❌ Pause night sleep error:', result.primary.error);
        Alert.alert('Fehler', 'Nachtschlaf konnte nicht pausiert werden');
        return;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
      }

      try {
        await sleepActivityService.endAllSleepActivities();
      } catch (liveActivityError) {
        console.error('Failed to pause sleep live activity:', liveActivityError);
      }

      setPausedNightState({
        lastPausedEntryId: activeSleepEntry.id,
        pausedAt: pausedAt.toISOString(),
      });
      delete activeEntryPeriodOverridesRef.current[activeSleepEntry.id];
      setActiveSleepEntry(null);

      showSuccessSplash('#F2C78A', '⏸️', 'sleep_pause_night');

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Unexpected pause sleep error:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Pausieren des Nachtschlafs');
    } finally {
      setIsStoppingSleep(false);
    }
  };

  const handleResumeNightSleep = async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (!pausedNightState || activeSleepEntry || isStartingSleep) return;
    const started = await handleStartSleep('night');
    if (started) {
      setPausedNightState(null);
    }
  };

  const handleFinalizePausedNight = async (quality: NonNullable<SleepQuality>) => {
    if (!ensureWritableInCurrentMode()) return;
    if (!pausedNightState?.lastPausedEntryId || isStoppingSleep || !sleepService) return;
    setIsStoppingSleep(true);

    try {
      const result = await sleepService.updateEntry(pausedNightState.lastPausedEntryId, {
        quality,
      });

      if (result.primary.error) {
        console.error('❌ Finalize paused night error:', result.primary.error);
        Alert.alert('Fehler', 'Nachtschlaf konnte nicht abgeschlossen werden');
        return;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
      }

      const referenceDate = pausedNightState.pausedAt ? new Date(pausedNightState.pausedAt) : new Date();
      const propagated = await applyNightQualityToSession(quality, referenceDate, [pausedNightState.lastPausedEntryId]);
      if (propagated.failed > 0) {
        Alert.alert('Hinweis', 'Die Qualität konnte nicht auf alle Nachtschlaf-Segmente übertragen werden.');
      }

      setPausedNightState(null);

      const splashKind =
        quality === 'good' ? 'sleep_stop_good' : quality === 'bad' ? 'sleep_stop_bad' : 'sleep_stop_medium';
      showSuccessSplash(QUALITY_VISUALS[quality].color, QUALITY_VISUALS[quality].emoji, splashKind);

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Unexpected finalize paused night error:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Abschließen des Nachtschlafs');
    } finally {
      setIsStoppingSleep(false);
    }
  };

  const promptSleepQualityForStop = useCallback(() => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeSleepEntry?.id || isStoppingSleep) return;
    const isNightStop = activeSleepEntry.period === 'night';

    Alert.alert(
      isNightStop ? 'Nachtschlaf abschließen' : 'Schlafqualität',
      isNightStop ? 'Wie war die Schlafqualität insgesamt?' : 'Wie war die Schlafqualität?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Schlecht', onPress: () => void handleStopSleep('bad') },
        { text: 'Mittel', onPress: () => void handleStopSleep('medium') },
        { text: 'Gut', onPress: () => void handleStopSleep('good') },
      ],
      { cancelable: true }
    );
  }, [activeSleepEntry?.id, activeSleepEntry?.period, ensureWritableInCurrentMode, handleStopSleep, isStoppingSleep]);

  const promptSleepQualityForFinalizePausedNight = useCallback(() => {
    if (!ensureWritableInCurrentMode()) return;
    if (!pausedNightState?.lastPausedEntryId || isStoppingSleep) return;

    Alert.alert(
      'Nachtschlaf abschließen',
      'Wie war die Schlafqualität insgesamt?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Schlecht', onPress: () => void handleFinalizePausedNight('bad') },
        { text: 'Mittel', onPress: () => void handleFinalizePausedNight('medium') },
        { text: 'Gut', onPress: () => void handleFinalizePausedNight('good') },
      ],
      { cancelable: true }
    );
  }, [ensureWritableInCurrentMode, handleFinalizePausedNight, isStoppingSleep, pausedNightState?.lastPausedEntryId]);

  useEffect(() => {
    if (liveStopRequestId === 0) return;
    if (handledLiveStopRequestIdRef.current === liveStopRequestId) return;
    if (!isLiveStatusLoaded) return;

    handledLiveStopRequestIdRef.current = liveStopRequestId;

    if (isStoppingSleep) {
      return;
    }

    if (!activeSleepEntry?.id) {
      console.log('Live Activity stop requested, but no active sleep entry exists.');
      return;
    }

    promptSleepQualityForStop();
  }, [
    activeSleepEntry?.id,
    isLiveStatusLoaded,
    isStoppingSleep,
    liveStopRequestId,
    promptSleepQualityForStop,
  ]);

  // Handle save entry (compatible with SleepInputModal)
  const handleSaveEntry = async (payload: any) => {
    if (!ensureWritableInCurrentMode()) return;
    try {
      if (!user?.id) {
        Alert.alert('Fehler', 'Benutzer nicht angemeldet');
        return;
      }

      console.log('🔍 handleSaveEntry called with:', payload);
      console.log('🔍 editingEntry:', editingEntry);

      // SleepInputModal sendet die Daten direkt als Objekt
      const sleepData = payload;

      // Validierung der Daten
      if (!sleepData.start_time) {
        Alert.alert('Fehler', 'Startzeit ist erforderlich');
        return;
      }

      const normalizedStartDate = new Date(sleepData.start_time);
      if (!isValidManualDate(normalizedStartDate)) {
        Alert.alert('Fehler', 'Ungültige Startzeit. Bitte Datum/Zeit neu wählen.');
        return;
      }

      const normalizedEndDate = sleepData.end_time ? new Date(sleepData.end_time) : null;
      if (normalizedEndDate && !isValidManualDate(normalizedEndDate)) {
        Alert.alert('Fehler', 'Ungültige Endzeit. Bitte Datum/Zeit neu wählen.');
        return;
      }

      if (normalizedEndDate && normalizedEndDate.getTime() <= normalizedStartDate.getTime()) {
        Alert.alert('Fehler', 'Die Endzeit muss nach der Startzeit liegen.');
        return;
      }

      const enteredDurationMs = normalizedEndDate
        ? normalizedEndDate.getTime() - normalizedStartDate.getTime()
        : null;
      if (typeof enteredDurationMs === 'number' && enteredDurationMs < MIN_PERSISTED_SLEEP_DURATION_MS) {
        if (editingEntry?.id) {
          if (!sleepService) {
            Alert.alert('Fehler', 'Service nicht verfügbar');
            return;
          }

          const deleteResult = await sleepService.deleteEntry(editingEntry.id);
          if (deleteResult.primary.error) {
            console.error('❌ Delete sub-minute edit error:', deleteResult.primary.error);
            Alert.alert('Fehler', 'Sehr kurzer Eintrag konnte nicht automatisch gelöscht werden');
            return;
          }

          if (deleteResult.secondary.error) {
            console.warn('[SleepTracker] Secondary backend delete failed:', deleteResult.secondary.error);
          }

          closeManualSleepModal();
          await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
          await loadSleepData();
          Alert.alert('Hinweis', 'Ein Schlafeintrag unter 1 Minute wurde automatisch gelöscht.');
          return;
        }

        Alert.alert('Hinweis', 'Einträge unter 1 Minute werden nicht gespeichert.');
        return;
      }

      const normalizedStartTime = normalizedStartDate.toISOString();
      const normalizedEndTime = normalizedEndDate ? normalizedEndDate.toISOString() : null;
      const overlapEndDate = normalizedEndDate
        ? normalizedEndDate
        : new Date(Math.max(Date.now(), normalizedStartDate.getTime() + 60 * 1000));
      const overlappingEntries = findOverlappingEntries(
        sleepEntries,
        normalizedStartDate,
        overlapEndDate,
        editingEntry?.id
      );

      if (overlappingEntries.length > 0) {
        const overlapsPreview = overlappingEntries
          .slice(0, 3)
          .map((entry) => {
            const entryStart = new Date(entry.start_time).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
            const entryEnd = entry.end_time
              ? new Date(entry.end_time).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
              : 'läuft noch';
            return `• ${entryStart} - ${entryEnd}`;
          })
          .join('\n');
        const moreCount = overlappingEntries.length - 3;

        Alert.alert(
          'Überschneidung erkannt',
          `Bitte den Zeitraum anpassen. Der Eintrag überschneidet sich mit bestehenden Schlafzeiten:\n\n${overlapsPreview}${moreCount > 0 ? `\n+ ${moreCount} weitere` : ''}`
        );
        return;
      }

      const effectivePartnerId = await getEffectivePartnerId();

      // Robuste Berechnung der duration_minutes
      const calculateDurationMinutes = (startTime: string | Date, endTime: string | Date | null): number | null => {
        if (!endTime) return null;

        try {
          const startDate = new Date(startTime);
          const endDate = new Date(endTime);

          // Validiere dass beide Daten gültig sind
          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            console.warn('Invalid date in duration calculation');
            return null;
          }

          // Berechne die Differenz in Millisekunden und konvertiere zu Minuten
          const durationMs = endDate.getTime() - startDate.getTime();

          // Stelle sicher, dass die Dauer nicht negativ ist
          if (durationMs < 0) {
            console.warn('End time is before start time');
            return null;
          }

          return Math.round(durationMs / 60000);
        } catch (error) {
          console.error('Error calculating duration:', error);
          return null;
        }
      };

      const calculatedDuration = calculateDurationMinutes(normalizedStartTime, normalizedEndTime);
      console.log('🔍 Calculated duration:', calculatedDuration, 'minutes');

      if (editingEntry?.id) {
        console.log('🔄 Updating existing entry:', editingEntry.id);

        if (!sleepService) {
          Alert.alert('Fehler', 'Service nicht verfügbar');
          return;
        }

        // Update existing entry via service (dual-write)
        const result = await sleepService.updateEntry(editingEntry.id, {
          start_time: normalizedStartTime,
          end_time: normalizedEndTime,
          quality: sleepData.quality || null,
          notes: sleepData.notes ?? null,
          duration_minutes: calculatedDuration,
          partner_id: editingEntry.partner_id ?? effectivePartnerId ?? null,
        });

        if (result.primary.error) {
          console.error('❌ Update error:', result.primary.error);
          Alert.alert('Fehler beim Aktualisieren', `${result.primary.error.message || 'Unbekannter Fehler'}`);
          return;
        }

        if (result.secondary.error) {
          console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
        }

        console.log('✅ Entry updated successfully:', result.primary.data);
        // Splash anzeigen für Bearbeitung
        showSuccessSplash('#4A90E2', '✏️', 'sleep_edit_save');
      } else {
        console.log('➕ Creating new entry');

        if (!sleepService) {
          Alert.alert('Fehler', 'Service nicht verfügbar');
          return;
        }

        // Create new entry via service (dual-write)
        const result = await sleepService.createEntry({
          user_id: user.id,
          baby_id: activeBabyId ?? null,
          start_time: normalizedStartTime,
          end_time: normalizedEndTime,
          quality: sleepData.quality || null,
          notes: sleepData.notes ?? null,
          duration_minutes: calculatedDuration,
          partner_id: effectivePartnerId ?? null,
        });

        if (result.primary.error) {
          console.error('❌ Insert error:', result.primary.error);
          Alert.alert('Fehler beim Speichern', `${result.primary.error.message || 'Unbekannter Fehler'}`);
          return;
        }

        if (result.secondary.error) {
          console.warn('[SleepTracker] Secondary backend write failed:', result.secondary.error);
        }

        console.log('✅ Entry created successfully:', result.primary.data);
        // Splash anzeigen für neuen Eintrag
        showSuccessSplash('#8E4EC6', '💤', 'sleep_manual_save');
      }

      closeManualSleepModal();

      // Invalidate cache because new/updated entry should appear immediately
      // WICHTIG: Korrekter Cache-Key wie in loadSleepHistory!
      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Sleep entry save error:', error);
      Alert.alert(
        'Unerwarteter Fehler',
        `${error instanceof Error ? error.message : 'Unbekannter Fehler'}\n\nBitte versuche es erneut oder kontaktiere den Support.`
      );
    }
  };


  const handleSplitNightSegment = async (params: {
    targetEntry: ClassifiedSleepEntry;
    splitTime: Date;
    wakeMinutes: number;
  }) => {
    if (!ensureWritableInCurrentMode()) return false;
    const { targetEntry, splitTime: paramSplitTime, wakeMinutes: paramWakeMinutes } = params;

    if (!sleepService || !user?.id) {
      Alert.alert('Fehler', 'Service nicht verfügbar. Bitte neu anmelden und erneut versuchen.');
      return false;
    }
    if (isSplittingSegment) {
      Alert.alert('Bitte warten', 'Es läuft bereits ein Speichervorgang.');
      return false;
    }

    const targetStartMs = new Date(targetEntry.start_time).getTime();
    const targetEndMs = targetEntry.end_time ? new Date(targetEntry.end_time).getTime() : null;
    let resolvedTarget = targetEntry;

    if (!resolvedTarget?.id) {
      const fallbackTarget = sleepEntries.find((entry) => {
        if (!entry.id) return false;
        const startMs = new Date(entry.start_time).getTime();
        if (startMs !== targetStartMs) return false;

        if (!entry.end_time && targetEndMs === null) return true;
        if (!entry.end_time || targetEndMs === null) return false;

        const endMs = new Date(entry.end_time).getTime();
        return endMs === targetEndMs;
      });

      if (fallbackTarget) {
        resolvedTarget = fallbackTarget;
      }
    }

    if (!resolvedTarget?.id) {
      Alert.alert('Nicht speicherbar', 'Das gewählte Segment konnte nicht eindeutig zugeordnet werden.');
      return false;
    }

    const targetWasActive = !resolvedTarget.end_time;
    const segmentStart = new Date(resolvedTarget.start_time);
    const segmentEnd = resolvedTarget.end_time ? new Date(resolvedTarget.end_time) : new Date();
    const safeSplitTime = sanitizeManualDate(paramSplitTime, segmentStart);
    const wakeMinutes = Math.max(0, Math.round(paramWakeMinutes));
    const resumedStart = new Date(safeSplitTime.getTime() + wakeMinutes * 60000);

    if (safeSplitTime.getTime() <= segmentStart.getTime()) {
      Alert.alert('Fehler', 'Der Teilungszeitpunkt muss nach dem Start liegen.');
      return false;
    }
    if (safeSplitTime.getTime() >= segmentEnd.getTime()) {
      Alert.alert(
        'Fehler',
        targetWasActive
          ? 'Der Teilungszeitpunkt muss vor dem aktuellen Zeitpunkt liegen.'
          : 'Der Teilungszeitpunkt muss vor dem Ende liegen.'
      );
      return false;
    }
    if (resumedStart.getTime() >= segmentEnd.getTime()) {
      Alert.alert(
        'Fehler',
        targetWasActive
          ? 'Die Wachphase darf nicht in der Zukunft enden.'
          : 'Die Wachpause ist zu lang für dieses Segment.'
      );
      return false;
    }

    const firstDuration = Math.max(1, Math.round((safeSplitTime.getTime() - segmentStart.getTime()) / 60000));
    const secondDuration = targetWasActive
      ? null
      : Math.max(1, Math.round((segmentEnd.getTime() - resumedStart.getTime()) / 60000));

    setIsSplittingSegment(true);
    try {
      const effectivePartnerId = await getEffectivePartnerId();
      const originalEndISO = resolvedTarget.end_time
        ? new Date(resolvedTarget.end_time).toISOString()
        : null;
      const originalDuration = Number.isFinite(resolvedTarget.duration_minutes as number)
        ? (resolvedTarget.duration_minutes as number)
        : targetWasActive
          ? null
          : Math.max(1, Math.round((segmentEnd.getTime() - segmentStart.getTime()) / 60000));

      const updateResult = await sleepService.updateEntry(resolvedTarget.id, {
        end_time: safeSplitTime.toISOString(),
        duration_minutes: firstDuration,
      });

      if (updateResult.primary.error) {
        console.error('Split update error:', updateResult.primary.error);
        Alert.alert(
          'Fehler',
          `Segment konnte nicht aufgeteilt werden: ${updateResult.primary.error.message || 'Unbekannter Fehler'}`
        );
        return false;
      }

      if (updateResult.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', updateResult.secondary.error);
      }

      const createResult = await sleepService.createEntry({
        user_id: user.id,
        baby_id: resolvedTarget.baby_id ?? activeBabyId ?? null,
        start_time: resumedStart.toISOString(),
        end_time: targetWasActive ? null : segmentEnd.toISOString(),
        duration_minutes: secondDuration,
        notes: resolvedTarget.notes ?? null,
        quality: resolvedTarget.quality ?? null,
        partner_id: resolvedTarget.partner_id ?? effectivePartnerId ?? null,
      });

      if (createResult.primary.error) {
        console.error('Split create error:', createResult.primary.error);

        // best effort rollback of first update
        const rollback = await sleepService.updateEntry(resolvedTarget.id, {
          end_time: originalEndISO,
          duration_minutes: originalDuration,
        });
        if (rollback.primary.error) {
          console.error('Split rollback failed:', rollback.primary.error);
        }

        Alert.alert(
          'Fehler',
          `Segment konnte nicht aufgeteilt werden: ${createResult.primary.error.message || 'Unbekannter Fehler'}`
        );
        return false;
      }

      if (createResult.secondary.error) {
        console.warn('[SleepTracker] Secondary backend write failed:', createResult.secondary.error);
      }

      if (targetWasActive) {
        try {
          await sleepActivityService.startSleepActivity(resumedStart, babyName);
        } catch (liveActivityError) {
          console.error('Failed to restart sleep live activity after split:', liveActivityError);
        }
      }

      showSuccessSplash('#4A90E2', '✂️', 'sleep_split_save');

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
      return true;
    } catch (error) {
      console.error('Unexpected split error:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Aufteilen');
      return false;
    } finally {
      setIsSplittingSegment(false);
    }
  };

  const handleMergeNightSegments = async (entryA: ClassifiedSleepEntry, entryB: ClassifiedSleepEntry) => {
    if (!ensureWritableInCurrentMode()) return false;
    if (!sleepService || !user?.id) {
      Alert.alert('Fehler', 'Service nicht verfügbar. Bitte neu anmelden und erneut versuchen.');
      return false;
    }
    if (isSplittingSegment) {
      Alert.alert('Bitte warten', 'Es läuft bereits ein Speichervorgang.');
      return false;
    }

    const toMinuteBucket = (value: Date | string | null | undefined): number | null => {
      if (!value) return null;
      const ms = new Date(value).getTime();
      if (!Number.isFinite(ms)) return null;
      return Math.floor(ms / 60000);
    };

    const matchesEntryByTime = (
      left: { start_time: Date | string; end_time?: Date | string | null },
      right: { start_time: Date | string; end_time?: Date | string | null }
    ): boolean => {
      const leftStartBucket = toMinuteBucket(left.start_time);
      const rightStartBucket = toMinuteBucket(right.start_time);
      if (leftStartBucket === null || rightStartBucket === null || leftStartBucket !== rightStartBucket) {
        return false;
      }
      return toMinuteBucket(left.end_time ?? null) === toMinuteBucket(right.end_time ?? null);
    };

    const resolveEntryFromList = (
      candidate: ClassifiedSleepEntry,
      source: Array<{ id?: string; start_time: Date | string; end_time?: Date | string | null }>
    ): ClassifiedSleepEntry => {
      if (candidate.id) return candidate;
      const match = source.find((entry) => entry.id && matchesEntryByTime(candidate, entry));
      return match?.id ? { ...candidate, id: match.id } : candidate;
    };

    let resolvedEntryA = resolveEntryFromList(entryA, sleepEntries);
    let resolvedEntryB = resolveEntryFromList(entryB, sleepEntries);

    if (!resolvedEntryA.id || !resolvedEntryB.id) {
      // Nach einem optimistischen Split kann die neue Segment-ID kurz fehlen.
      // Dann frisch vom Backend laden und die IDs über Start/End-Zeit auflösen.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const freshResult = await sleepService.getEntries(activeBabyId ?? undefined);
        if (freshResult.data) {
          resolvedEntryA = resolveEntryFromList(resolvedEntryA, freshResult.data);
          resolvedEntryB = resolveEntryFromList(resolvedEntryB, freshResult.data);
        } else if (freshResult.error) {
          console.warn('[SleepTracker] Merge resolve refresh failed:', freshResult.error);
        }

        if (resolvedEntryA.id && resolvedEntryB.id) {
          break;
        }

        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    if (!resolvedEntryA.id || !resolvedEntryB.id || !resolvedEntryA.end_time) {
      Alert.alert('Nicht speicherbar', 'Die ausgewählten Segmente konnten nicht eindeutig zugeordnet werden.');
      return false;
    }

    const mergedStart = new Date(resolvedEntryA.start_time);
    const mergedEnd = resolvedEntryB.end_time ? new Date(resolvedEntryB.end_time) : null;
    if (mergedEnd && mergedEnd.getTime() <= mergedStart.getTime()) {
      Alert.alert('Fehler', 'Die Segmentzeiten sind ungültig und können nicht verbunden werden.');
      return false;
    }

    const mergedDuration = mergedEnd
      ? Math.max(1, Math.round((mergedEnd.getTime() - mergedStart.getTime()) / 60000))
      : null;

    setIsSplittingSegment(true);
    try {
      // Update first entry to span both (including open-ended active segments)
      const updateResult = await sleepService.updateEntry(resolvedEntryA.id, {
        end_time: mergedEnd ? mergedEnd.toISOString() : null,
        duration_minutes: mergedDuration,
      });

      if (updateResult.primary.error) {
        console.error('Merge update error:', updateResult.primary.error);
        Alert.alert(
          'Fehler',
          `Segmente konnten nicht verbunden werden: ${updateResult.primary.error.message || 'Unbekannter Fehler'}`
        );
        return false;
      }

      // Delete second entry
      const deleteResult = await sleepService.deleteEntry(resolvedEntryB.id);
      if (deleteResult.primary.error) {
        console.error('Merge delete error:', deleteResult.primary.error);
        Alert.alert(
          'Fehler',
          `Zweites Segment konnte nicht entfernt werden: ${deleteResult.primary.error.message || 'Unbekannter Fehler'}`
        );
        return false;
      }

      if (!mergedEnd) {
        try {
          await sleepActivityService.startSleepActivity(mergedStart, babyName);
        } catch (liveActivityError) {
          console.error('Failed to restart sleep live activity after merge:', liveActivityError);
        }
      }

      showSuccessSplash('#4A90E2', '🔗', 'sleep_merge_save');

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
      return true;
    } catch (error) {
      console.error('Unexpected merge error:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Verbinden');
      return false;
    } finally {
      setIsSplittingSegment(false);
    }
  };

  const handleAdjustNightBoundary = async (
    entry: ClassifiedSleepEntry,
    field: 'start_time' | 'end_time',
    newTime: Date,
  ) => {
    if (!ensureWritableInCurrentMode()) return;
    if (!sleepService || !user?.id || isSplittingSegment || !entry.id) return;

    const start = field === 'start_time' ? newTime : new Date(entry.start_time);
    // Für aktive Einträge (kein end_time): end_time wird gesetzt, kein Vergleich gegen "jetzt" nötig
    const end = field === 'end_time' ? newTime : (entry.end_time ? new Date(entry.end_time) : null);

    if (end !== null && start.getTime() >= end.getTime()) {
      Alert.alert('Fehler', 'Startzeit muss vor der Endzeit liegen.');
      return;
    }

    // end kann null sein wenn der Eintrag aktiv ist und end_time gerade gesetzt wird
    const effectiveEnd = end ?? newTime;
    const newDuration = Math.max(1, Math.round((effectiveEnd.getTime() - start.getTime()) / 60000));

    setIsSplittingSegment(true);
    try {
      const updateResult = await sleepService.updateEntry(entry.id, {
        [field]: newTime.toISOString(),
        duration_minutes: newDuration,
      });

      if (updateResult.primary.error) {
        console.error('Adjust boundary error:', updateResult.primary.error);
        Alert.alert('Fehler', 'Zeit konnte nicht angepasst werden');
        return;
      }

      showSuccessSplash('#4A90E2', '⏱️', 'sleep_adjust_save');

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('Unexpected adjust error:', error);
      Alert.alert('Fehler', 'Unerwarteter Fehler beim Anpassen');
    } finally {
      setIsSplittingSegment(false);
    }
  };

  const handleDeleteNightGroup = async (entryIds: string[]): Promise<boolean> => {
    if (!ensureWritableInCurrentMode()) return false;
    if (!sleepService || !user?.id) return false;

    const ids = Array.from(new Set(entryIds.filter((id) => typeof id === 'string' && id.length > 0)));
    if (ids.length === 0) return false;

    setIsSplittingSegment(true);
    try {
      const results = await Promise.all(ids.map((entryId) => sleepService.deleteEntry(entryId)));
      const failedPrimary = results.filter((result) => result.primary.error);

      if (failedPrimary.length > 0) {
        console.error('[SleepTracker] Night group delete failed:', failedPrimary.map((item) => item.primary.error));
        Alert.alert('Fehler', 'Nachtschlaf konnte nicht vollständig gelöscht werden.');
        return false;
      }

      const failedSecondary = results.filter((result) => result.secondary.error);
      if (failedSecondary.length > 0) {
        console.warn('[SleepTracker] Secondary backend delete failed for night group:', failedSecondary.map((item) => item.secondary.error));
      }

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
      Alert.alert('Erfolg', 'Nachtschlaf wurde gelöscht.');
      return true;
    } catch (error) {
      console.error('[SleepTracker] Unexpected night group delete error:', error);
      Alert.alert('Fehler', 'Nachtschlaf konnte nicht gelöscht werden.');
      return false;
    } finally {
      setIsSplittingSegment(false);
    }
  };


  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!ensureWritableInCurrentMode()) return;
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Schlaf-Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel', onPress: () => { triggerHaptic(); } },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic();
            if (!ensureWritableInCurrentMode()) return;
            try {
              if (!sleepService) {
                Alert.alert('Fehler', 'Service nicht verfügbar');
                return;
              }

              // Delete entry via service (dual-write)
              const result = await sleepService.deleteEntry(entryId);

              if (result.primary.error) {
                console.error('❌ Delete error:', result.primary.error);
                Alert.alert('Fehler', 'Eintrag konnte nicht gelöscht werden');
                return;
              }

              if (result.secondary.error) {
                console.warn('[SleepTracker] Secondary backend delete failed:', result.secondary.error);
              }

              // Invalidate cache because entry was deleted
              // WICHTIG: Korrekter Cache-Key wie in loadSleepHistory!
              await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
              await loadSleepData();
              Alert.alert('Erfolg', 'Eintrag wurde gelöscht! 🗑️');
            } catch (error) {
              Alert.alert('Fehler', 'Eintrag konnte nicht gelöscht werden');
            }
          }
        }
      ]
    );
  };

  // Format duration for completed entries
  const formatCompletedDuration = (durationMinutes: number) => {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get quality color
  const getQualityColor = (quality?: SleepQuality) => {
    switch (quality) {
      case 'good': return QUALITY_VISUALS.good.color;
      case 'medium': return QUALITY_VISUALS.medium.color;
      case 'bad': return QUALITY_VISUALS.bad.color;
      default: return '#A0AEC0';
    }
  };

  // Get quality emoji
  const getQualityEmoji = (quality?: SleepQuality) => {
    switch (quality) {
      case 'good': return QUALITY_VISUALS.good.emoji;
      case 'medium': return QUALITY_VISUALS.medium.emoji;
      case 'bad': return QUALITY_VISUALS.bad.emoji;
      default: return '💤';
    }
  };

  // Splash Funktion wie in daily_old.tsx
  const showSuccessSplash = (hex: string, _emoji: string, kind: string) => {
    const rgba = (h: string, a: number) => {
      const c = h.replace('#','');
      const r = parseInt(c.substring(0,2),16);
      const g = parseInt(c.substring(2,4),16);
      const b = parseInt(c.substring(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const splashHex =
      kind === 'sleep_start_night'
        ? NIGHT_SPLASH_COLORS.sleep_start_night
        : kind === 'sleep_pause_night'
          ? NIGHT_SPLASH_COLORS.sleep_pause_night
          : hex;
    setSplashBg(rgba(splashHex, 1));
    // Texte je Kontext - angepasst für Sleep
    if (kind === 'sleep_start_night') {
      setSplashTitle('Nachtschlaf läuft');
      setSplashSubtitle('Gute Nacht, kleiner Schatz. Träum schön.');
      setSplashStatus('Timer gestartet...');
      setSplashHint('Du machst das großartig 🌙');
      setSplashText('');
    } else if (kind === 'sleep_start_day') {
      setSplashTitle('Tagschlaf läuft');
      setSplashSubtitle('Kuschel-Nap – Energie tanken.');
      setSplashStatus('Timer gestartet...');
      setSplashHint('Erholung ist wichtig 💤');
      setSplashText('');
    } else if (kind === 'sleep_pause_night') {
      setSplashTitle('Nachtschlaf pausiert');
      setSplashSubtitle('Aufwachphase wird nicht als Schlaf gezählt.');
      setSplashStatus('');
      setSplashHint('Wenn es weitergeht, einfach fortsetzen ⏸️');
      setSplashText('');
    } else if (kind === 'sleep_stop_good') {
      setSplashTitle('Schlaf beendet');
      setSplashSubtitle('Guter Schlaf – perfekt erholt!');
      setSplashStatus('');
      setSplashHint('Ein weiterer Meilenstein heute ✨');
      setSplashText('');
    } else if (kind === 'sleep_stop_medium') {
      setSplashTitle('Schlaf beendet');
      setSplashSubtitle('Okay geschlafen – das ist völlig normal.');
      setSplashStatus('');
      setSplashHint('Jeder Schlaf ist wertvoll 💕');
      setSplashText('');
    } else if (kind === 'sleep_stop_bad') {
      setSplashTitle('Schlaf beendet');
      setSplashSubtitle('Unruhiger Schlaf – morgen wird besser.');
      setSplashStatus('');
      setSplashHint('Du gibst dein Bestes, das reicht 🤍');
      setSplashText('');
    } else if (kind === 'sleep_manual_save') {
      setSplashTitle('Schlaf gespeichert');
      setSplashSubtitle('Eintrag erfolgreich hinzugefügt.');
      setSplashStatus('');
      setSplashHint('Danke für die genaue Aufzeichnung 💕');
      setSplashText('');
    } else if (kind === 'sleep_edit_save') {
      setSplashTitle('Schlaf aktualisiert');
      setSplashSubtitle('Änderungen erfolgreich gespeichert.');
      setSplashStatus('');
      setSplashHint('Die Daten wurden aktualisiert ✏️');
      setSplashText('');
    } else if (kind === 'sleep_split_save') {
      setSplashTitle('Segment aufgeteilt');
      setSplashSubtitle('Die Schlafphase wurde in zwei Blöcke geteilt.');
      setSplashStatus('');
      setSplashHint('Wachpause ist jetzt separat sichtbar ✂️');
      setSplashText('');
    } else {
      setSplashTitle('Schlaf-Aktion');
      setSplashSubtitle('Erfolgreich ausgeführt.');
      setSplashStatus('');
      setSplashHint('Alles in Ordnung ✅');
      setSplashText('');
    }
    setSplashVisible(true);
    // reset and animate in
    splashAnim.setValue(0);
    Animated.timing(splashAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    splashEmojiAnim.setValue(0.9);
    Animated.sequence([
      Animated.timing(splashEmojiAnim, { toValue: 1.1, duration: 220, useNativeDriver: true }),
      Animated.spring(splashEmojiAnim, { toValue: 1, useNativeDriver: true })
    ]).start();
    // clear previous timer
    if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    splashTimerRef.current = setTimeout(() => {
      Animated.timing(splashAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setSplashVisible(false);
      });
    }, 4500);
  };

  // Group entries by period
  const groupedEntries = sleepEntries.reduce((acc, entry) => {
    if (!acc[entry.period]) {
      acc[entry.period] = [];
    }
    acc[entry.period].push(entry);
    return acc;
  }, {} as Record<SleepPeriod, ClassifiedSleepEntry[]>);

  const stats = useMemo(() => {
    // Compute high-level stats & score (heutiger Kalendertag 00:00–24:00 lokal)
    const dayStart = startOfDay(selectedDate);
    const dayEnd   = endOfDay(selectedDate);
    const dayIntervals = getMergedIntervalsForEntries(sleepEntries, {
      rangeStart: dayStart,
      rangeEnd: dayEnd,
    });
    const dayNapIntervals = getMergedIntervalsForEntries(sleepEntries, {
      rangeStart: dayStart,
      rangeEnd: dayEnd,
      // Jeder Tagschlaf zählt als Nap, unabhängig von der Dauer.
      predicate: (entry) => entry.period === 'day',
    });
    const totalMinutes = minutesFromMergedIntervals(dayIntervals);
    const longestStretch = dayIntervals.reduce((maxValue, interval) => {
      const minutes = Math.floor((interval.endMs - interval.startMs) / 60000);
      return Math.max(maxValue, Math.max(0, minutes));
    }, 0);
    const napsCount = dayNapIntervals.reduce((count, interval) => {
      const minutes = Math.floor((interval.endMs - interval.startMs) / 60000);
      return minutes > 0 ? count + 1 : count;
    }, 0);

    const nightSessionSegments = getNightSessionSegmentsForReference(
      sleepEntries,
      selectedDate,
      nightWindowSettings
    );
    const nightSessionGroup = buildNightGroupFromSegments(nightSessionSegments);
    const nightTotalMinutes = nightSessionGroup?.totalMinutes ?? 0;
    const nightSegmentCount = nightSessionGroup?.segments.length ?? 0;

    // Beispiel-Score: 14h Ziel, lineare Abweichung (keine 100% bei 25h)
    const target = 14 * 60;
    const deviation = Math.abs(totalMinutes - target);
    const score = Math.max(0, Math.round(100 - (deviation / target) * 100));

    return { totalMinutes, napsCount, longestStretch, score, nightTotalMinutes, nightSegmentCount };
  }, [nightWindowSettings, selectedDate, sleepEntries]);

  // Daily navigation helpers
  const goPrevDay = () => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd; });
  const goNextDay = () => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd; });
  const today = new Date();
  const nextDisabled = isSameDay(selectedDate, today) || selectedDate > today;

  const qualityPillActive = (q: 'good' | 'medium' | 'bad'): ViewStyle => ({
    backgroundColor:
      q === 'good' ? 'rgba(56,161,105,0.25)' : q === 'medium' ? 'rgba(245,166,35,0.25)' : 'rgba(229,62,62,0.25)',
  });

  // Einträge für den aktuell ausgewählten Tag (Tag-Ansicht)
  const dayEntries = useMemo(() => {
    const ds = startOfDay(selectedDate);
    const de = endOfDay(selectedDate);
    return sleepEntries
      .filter(e => {
        const s = new Date(e.start_time);
        const ee = e.end_time ? new Date(e.end_time) : new Date();
        return overlapMinutes(s, ee, ds, de) > 0;
      })
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [sleepEntries, selectedDate]);

  const nightGroups = useMemo(() => {
    const baseGroups = getNightGroupsForDayEntries(dayEntries, nightWindowSettings);
    if (baseGroups.length === 0) return [];

    const expandedGroups = new Map<string, NightGroup>();

    for (const baseGroup of baseGroups) {
      const referenceEntry = baseGroup.entries[0];
      if (!referenceEntry) continue;

      const windowKey = getNightWindowKeyForEntry(referenceEntry, nightWindowSettings);
      if (!windowKey) continue;
      if (expandedGroups.has(windowKey)) continue;

      const fullWindowSegments = sleepEntries
        .filter((entry) =>
          entry.period === 'night' &&
          getNightWindowKeyForEntry(entry, nightWindowSettings) === windowKey
        )
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const expanded = buildNightGroupFromSegments(fullWindowSegments);
      if (expanded) {
        expandedGroups.set(windowKey, expanded);
      }
    }

    return Array.from(expandedGroups.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
  }, [dayEntries, nightWindowSettings, sleepEntries]);

  const openNightEditor = useCallback((group: NightGroup) => {
    if (!ensureWritableInCurrentMode()) return;
    setNightEditorGroup(group);
    setShowNightEditor(true);
  }, [ensureWritableInCurrentMode]);

  useEffect(() => {
    if (!showNightEditor || !nightEditorGroup || nightGroups.length === 0) return;

    const currentIdentities = new Set(
      nightEditorGroup.entries.map((entry) => getEntryIdentity(entry))
    );

    let bestMatch: NightGroup | null = null;
    let bestOverlap = 0;

    for (const group of nightGroups) {
      const overlap = group.entries.reduce((sum, entry) => {
        return sum + (currentIdentities.has(getEntryIdentity(entry)) ? 1 : 0);
      }, 0);

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = group;
      }
    }

    if (!bestMatch || bestOverlap === 0) return;

    const currentSignature = nightEditorGroup.entries
      .map((entry) => getEntryIdentity(entry))
      .join(',');
    const bestSignature = bestMatch.entries
      .map((entry) => getEntryIdentity(entry))
      .join(',');

    if (currentSignature !== bestSignature) {
      setNightEditorGroup(bestMatch);
    }
  }, [showNightEditor, nightEditorGroup, nightGroups]);

  const nightGroupEntryIdentities = useMemo(
    () =>
      new Set(
        nightGroups.flatMap((group) =>
          group.entries.map((entry) => getEntryIdentity(entry))
        )
      ),
    [nightGroups]
  );

  const regularTimelineEntries = useMemo(
    () => dayEntries.filter((entry) => !nightGroupEntryIdentities.has(getEntryIdentity(entry))),
    [dayEntries, nightGroupEntryIdentities]
  );

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = regularTimelineEntries.map((entry) => ({
      kind: 'entry' as const,
      sortTime: new Date(entry.start_time).getTime(),
      entry,
    }));

    for (const group of nightGroups) {
      items.push({
        kind: 'night_group' as const,
        sortTime: group.start.getTime(),
        group,
      });
    }

    return items.sort((a, b) => b.sortTime - a.sortTime);
  }, [nightGroups, regularTimelineEntries]);


  const jumpToLatestEntry = useCallback(() => {
    if (sleepEntries.length === 0) return;
    const latest = sleepEntries.reduce((latestEntry, entry) => {
      if (!latestEntry) return entry;
      return new Date(entry.start_time).getTime() > new Date(latestEntry.start_time).getTime()
        ? entry
        : latestEntry;
    }, null as ClassifiedSleepEntry | null);

    if (latest) {
      setSelectedTab('day');
      setSelectedDate(new Date(latest.start_time));
    }
  }, [sleepEntries]);

    // Setze die Modal-Daten beim Öffnen
    useEffect(() => {
      if (showInputModal) {
        setShowStartPicker(false);
        setShowEndPicker(false);

        if (editingEntry) {
          // Bearbeitungsmodus - lade vorhandene Daten
          const startCandidate = sanitizeManualDate(new Date(editingEntry.start_time), new Date());
          const endCandidate = editingEntry.end_time
            ? sanitizeManualDate(new Date(editingEntry.end_time), startCandidate)
            : null;
          setSleepModalData({
            start_time: startCandidate,
            end_time:
              endCandidate && endCandidate.getTime() <= startCandidate.getTime() ? null : endCandidate,
            quality: editingEntry.quality || null,
            notes: editingEntry.notes || ''
          });
        } else {
          // Neuer Eintrag - setze Standardwerte
          resetManualModalData();
        }
      }
    }, [showInputModal, editingEntry, resetManualModalData, sanitizeManualDate]);

  const openStartPicker = () => {
    triggerHaptic();
    setShowEndPicker(false);
    const normalizedStart = normalizePickerDate(sleepModalData.start_time, new Date());
    setSleepModalData((prev) => ({
      ...prev,
      start_time: normalizedStart,
    }));
    if (Platform.OS === 'ios') {
      setStartPickerDraft(normalizedStart);
    }
    setShowStartPicker(true);
  };

  const openEndPicker = () => {
    triggerHaptic();
    setShowStartPicker(false);
    const safeStart = sanitizeManualDate(sleepModalData.start_time, new Date());
    const safeEnd = sanitizeManualDate(sleepModalData.end_time ?? safeStart, safeStart);
    if (Platform.OS === 'ios') {
      setEndPickerDraft(safeEnd);
    }
    setShowEndPicker(true);
  };

  const safeModalStartTime = useMemo(
    () => sanitizeManualDate(sleepModalData.start_time, new Date()),
    [sanitizeManualDate, sleepModalData.start_time]
  );

  const safeModalEndTime = useMemo(() => {
    if (!sleepModalData.end_time) return null;
    return sanitizeManualDate(sleepModalData.end_time, safeModalStartTime);
  }, [sanitizeManualDate, safeModalStartTime, sleepModalData.end_time]);

  const safeModalEndPickerTime = useMemo(
    () => sanitizeManualDate(sleepModalData.end_time ?? safeModalStartTime, safeModalStartTime),
    [sanitizeManualDate, safeModalStartTime, sleepModalData.end_time]
  );

  const applyStartPickerValue = useCallback((nextStartValue: Date) => {
    setSleepModalData((prev) => {
      const prevStart = sanitizeManualDate(prev.start_time, new Date());
      const nextStart = sanitizeManualDate(nextStartValue, prevStart);
      const prevEnd = prev.end_time ? sanitizeManualDate(prev.end_time, nextStart) : null;
      return {
        ...prev,
        start_time: nextStart,
        end_time: prevEnd && prevEnd.getTime() <= nextStart.getTime() ? null : prevEnd,
      };
    });
  }, [sanitizeManualDate]);

  const applyEndPickerValue = useCallback((nextEndValue: Date) => {
    setSleepModalData((prev) => {
      const baseStart = sanitizeManualDate(prev.start_time, new Date());
      const baseEnd = prev.end_time
        ? sanitizeManualDate(prev.end_time, baseStart)
        : baseStart;
      const nextEnd = sanitizeManualDate(nextEndValue, baseEnd);
      return { ...prev, end_time: nextEnd };
    });
  }, [sanitizeManualDate]);

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

  // Top Tabs Component (exakt wie daily_old.tsx)
  const TopTabs = () => (
    <View style={styles.topTabsContainer}>
      {(['day', 'week', 'month'] as const).map((tab) => (
        <GlassCard key={tab} style={[styles.topTab, selectedTab === tab && styles.activeTopTab]} intensity={22}>
          <TouchableOpacity
            style={styles.topTabInner}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 12, right: 12 }}
            onPress={() => {
              triggerHaptic();
              setSelectedTab(tab);
              // Wenn Tag-Tab gewählt wird, springe zu heute
              if (tab === 'day') {
                setSelectedDate(new Date());
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.topTabText, { color: textSecondary }, selectedTab === tab && styles.activeTopTabText]}>
              {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      ))}
    </View>
  );

  // Action Buttons (Home.tsx style)
  const ActionButtons = () => {
    const isActionBlocked = isStartingSleep || isStoppingSleep || isReadOnlyPreviewMode;
    const isActiveNightSleep = activeSleepEntry?.period === 'night';
    const isNightPaused = Boolean(pausedNightState && !activeSleepEntry);
    const shouldShowStatusLoading = !isLiveStatusLoaded && !activeSleepEntry && !isNightPaused;
    const loadingLabel = isStartingSleep
        ? 'Starte...'
        : isStoppingSleep
          ? 'Stoppe...'
          : null;

    return (
      <View style={styles.cardsGrid}>
        {shouldShowStatusLoading ? (
          <TouchableOpacity
            style={[styles.fullWidthStopButton, styles.actionDisabled]}
            disabled
            activeOpacity={1}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, styles.fullWidthCard, { backgroundColor: 'rgba(210, 210, 210, 0.45)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(150, 150, 150, 0.85)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <IconSymbol name="clock.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>Status wird geladen</Text>
                <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>Bitte kurz warten</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        ) : activeSleepEntry && isActiveNightSleep ? (
          <>
            <TouchableOpacity
              style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W, marginRight: GRID_GUTTER }, isActionBlocked && styles.actionDisabled]}
              disabled={isActionBlocked}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
              onPress={() => {
                if (isActionBlocked) return;
                triggerHaptic();
                void handlePauseNightSleep();
              }}
              activeOpacity={0.9}
            >
              <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(242, 199, 138, 0.55)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(242, 166, 80, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="pause.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>Pausieren</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>Aufwachphase erfassen</Text>
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W }, isActionBlocked && styles.actionDisabled]}
              disabled={isActionBlocked}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
              onPress={() => {
                if (isActionBlocked) return;
                triggerHaptic();
                promptSleepQualityForStop();
              }}
              activeOpacity={0.9}
            >
              <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
                    {isStoppingSleep ? 'Wird beendet' : 'Nachtschlaf beenden'}
                  </Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>
                    {loadingLabel || 'Qualität auswählen'}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          </>
        ) : activeSleepEntry ? (
          <TouchableOpacity
            style={[styles.fullWidthStopButton, isActionBlocked && styles.actionDisabled]}
            disabled={isActionBlocked}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
            onPress={() => {
              if (isActionBlocked) return;
              triggerHaptic();
              promptSleepQualityForStop();
            }}
            activeOpacity={0.9}
          >
            <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, styles.fullWidthCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                  <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
                  {isStoppingSleep ? 'Schlaf wird beendet' : 'Schlaf beenden'}
                </Text>
                <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>
                  {loadingLabel || 'Timer stoppen'}
                </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
        ) : isNightPaused ? (
          <>
            <TouchableOpacity
              style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W, marginRight: GRID_GUTTER }, isActionBlocked && styles.actionDisabled]}
              disabled={isActionBlocked}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
              onPress={() => {
                if (isActionBlocked) return;
                triggerHaptic();
                void handleResumeNightSleep();
              }}
              activeOpacity={0.9}
            >
              <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(142, 78, 198, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="play.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>Fortsetzen</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>
                    {loadingLabel || 'Nachtschlaf weiter'}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W }, isActionBlocked && styles.actionDisabled]}
              disabled={isActionBlocked}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
              onPress={() => {
                if (isActionBlocked) return;
                triggerHaptic();
                promptSleepQualityForFinalizePausedNight();
              }}
              activeOpacity={0.9}
            >
              <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="checkmark.circle.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
                    Nacht abschließen
                  </Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>
                    {loadingLabel || 'Qualität speichern'}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W, marginRight: GRID_GUTTER }, isActionBlocked && styles.actionDisabled]}
              disabled={isActionBlocked}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
              onPress={() => {
                if (isActionBlocked) return;
                triggerHaptic();
                const now = new Date();
                void handleStartSleep(getSleepPeriodForStart(now, nightWindowSettings));
              }}
              activeOpacity={0.9}
            >
              <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(142, 78, 198, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="moon.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>Schlaf starten</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>
                    {loadingLabel || 'Timer beginnen'}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.liquidGlassCardWrapper, { width: GRID_COL_W }, isActionBlocked && styles.actionDisabled]}
              disabled={isActionBlocked}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
              onPress={() => {
                if (isActionBlocked) return;
                triggerHaptic();
                openManualSleepModal();
              }}
              activeOpacity={0.9}
            >
              <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="plus.circle.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>Manuell</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>Eintrag hinzufügen</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // Wochenansicht Component (Design Guide konform)
  const WeekView = () => {
    // Referenz-Datum: Heute + (weekOffset * 7 Tage)
    const refDate = useMemo(() => {
      const d = new Date();
      d.setDate(d.getDate() + weekOffset * 7);
      return d;
    }, [weekOffset]);
    
    // Lokale Hilfsfunktionen
    const getWeekStart = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    };

    const getWeekEnd = (date: Date) => {
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return weekEnd;
    };

    const getWeekDays = (date: Date) => {
      const weekStart = getWeekStart(date);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        days.push(day);
      }
      return days;
    };
    
    const weekDays = useMemo(() => getWeekDays(refDate), [refDate]);
    const weekStart = useMemo(() => getWeekStart(refDate), [refDate]);
    const weekEnd = useMemo(() => getWeekEnd(refDate), [refDate]);

    // Hilfsfunktionen (lokaler Tag, kein UTC-Shift)
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    // Berechne Schlaf-Minuten für genau diesen Kalendertag (00:00–24:00 lokal)
    const getDayStats = (date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);

      const totalMinutes = minutesFromMergedIntervals(
        getMergedIntervalsForEntries(sleepEntries, { rangeStart: dayStart, rangeEnd: dayEnd })
      );
      const nightMinutes = minutesFromMergedIntervals(
        getMergedIntervalsForEntries(sleepEntries, {
          rangeStart: dayStart,
          rangeEnd: dayEnd,
          predicate: (entry) => entry.period === 'night',
        })
      );
      const dayMinutes = minutesFromMergedIntervals(
        getMergedIntervalsForEntries(sleepEntries, {
          rangeStart: dayStart,
          rangeEnd: dayEnd,
          predicate: (entry) => entry.period === 'day',
        })
      );

      return { totalMinutes, nightMinutes, dayMinutes, count: totalMinutes > 0 ? 1 : 0 };
    };

    // Berechne Max-Höhe für Balkendiagramm
    const dayTotals = weekDays.map((day: Date) => getDayStats(day).totalMinutes);
    const maxMinutes = Math.max(...dayTotals, 480); // Min 8h für vernünftige Skala

    // Wochen-spezifische Highlight-Berechnung
    const weekSpanStart = startOfDay(weekStart);
    const weekSpanEnd   = endOfDay(weekEnd);

    // Wochen-spezifische Berechnung für Zusammenfassung
    const nightWeekMins = minutesFromMergedIntervals(
      getMergedIntervalsForEntries(sleepEntries, {
        rangeStart: weekSpanStart,
        rangeEnd: weekSpanEnd,
        predicate: (entry) => entry.period === 'night',
      })
    );

    const dayWeekMins = minutesFromMergedIntervals(
      getMergedIntervalsForEntries(sleepEntries, {
        rangeStart: weekSpanStart,
        rangeEnd: weekSpanEnd,
        predicate: (entry) => entry.period === 'day',
      })
    );

    // gesamte Schlafminuten dieser Woche (überlappungsfrei)
    const totalWeekMins = minutesFromMergedIntervals(
      getMergedIntervalsForEntries(sleepEntries, {
        rangeStart: weekSpanStart,
        rangeEnd: weekSpanEnd,
      })
    );

    
    return (
      <View style={styles.weekViewContainer}>
        {/* Week Navigation - Design Guide konform */}
        <View style={styles.weekNavigationContainer}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => {
              triggerHaptic();
              setWeekOffset(o => o - 1);
            }}
          >
            <Text style={[styles.weekNavButtonText, { color: textSecondary }]}>‹</Text>
          </TouchableOpacity>

          <View style={styles.weekHeaderCenter}>
            <Text style={[styles.weekHeaderTitle, { color: textSecondary }]}>Wochenübersicht</Text>
            <Text style={[styles.weekHeaderSubtitle, { color: textSecondary }]}>
              {weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
            </Text>
              </View>

          <TouchableOpacity
            style={[styles.weekNavButton, weekOffset >= 0 && { opacity: 0.4 }]}
            disabled={weekOffset >= 0}
            onPress={() => {
              triggerHaptic();
              setWeekOffset(o => o + 1);
            }}
          >
            <Text style={[styles.weekNavButtonText, { color: textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Balkendiagramm - Design Guide konform mit Liquid Glass */}
        <LiquidGlassCard style={styles.chartGlassCard}>
          <Text style={[styles.chartTitle, { color: textSecondary }]}>Schlafzeiten dieser Woche</Text>

          {/* feste Gesamtbreite = WEEK_CONTENT_WIDTH (wie Timeline) */}
          <View style={[styles.chartArea, { width: WEEK_CONTENT_WIDTH, alignSelf: 'center' }]}>
            {weekDays.map((day: Date, i: number) => {
              const stats = getDayStats(day);
              // Sehr große Werte deckeln (z. B. „34h“)
              const minutesCapped = Math.min(stats.totalMinutes, 24 * 60);
              const totalH = minutesCapped ? (minutesCapped / maxMinutes) * MAX_BAR_H : 0;
              const hours = Math.round(stats.totalMinutes / 60);

              // Pixelgenaue Spaltenbreite für Week-Chart
              const extra = i < WEEK_LEFTOVER ? 1 : 0;

              return (
                <TouchableOpacity
                  key={i}
                  style={{
                    width: WEEK_COL_WIDTH + extra,
                    marginRight: i < (COLS - 1) ? GUTTER : 0,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedDate(day);
                    setSelectedTab('day');
                  }}
                >
                  <View style={[styles.chartBarContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    {totalH > 0 && <View
                      style={[
                        styles.chartBar,
                        styles.chartBarTotal,
                        { height: totalH, width: Math.max(10, Math.round(WEEK_COL_WIDTH * 0.66)) }
                      ]}
                    />}
                  </View>

                  <View style={[styles.chartLabelContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    <Text allowFontScaling={false} style={[styles.chartLabel, { color: textSecondary }]}>{['Mo','Di','Mi','Do','Fr','Sa','So'][i]}</Text>
                    <Text allowFontScaling={false} style={[styles.chartValue, { color: textSecondary }]}>
                      {hours > 24 ? '24h+' : `${hours}h`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </LiquidGlassCard>

        {/* Wochenzusammenfassung - Design Guide konform */}
        <LiquidGlassCard style={styles.weekSummaryCard}>
          <View style={styles.summaryInner}>
            <Text style={[styles.summaryTitle, { color: textSecondary }]}>Wochenzusammenfassung</Text>
            <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🌙</Text>
                  <Text style={[styles.statValue, { color: textSecondary }]}>{Math.round(nightWeekMins / 60)}h</Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>Nachtschlaf</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>☀️</Text>
                  <Text style={[styles.statValue, { color: textSecondary }]}>{Math.round(dayWeekMins / 60)}h</Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>Tagschlaf</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>⭐</Text>
                  <Text style={[styles.statValue, { color: textSecondary }]}>{Math.round(totalWeekMins / 7 / 60)}h</Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>Ø pro Tag</Text>
                </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };

  // Monatsansicht Component (Design Guide konform)
  const MonthView = () => {
    // Referenz-Monat: aktueller Monat + monthOffset
    const refMonthDate = useMemo(() => {
      const d = new Date();
      d.setDate(1);                 // Normalize to first of month
      d.setMonth(d.getMonth() + monthOffset);
      return d;
    }, [monthOffset]);
    
    // Lokale Hilfsfunktionen
    const getMonthStart = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1);
    };

    const getMonthEnd = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    };

    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      return new Date(year, month + 1, 0).getDate();
    };
    
    const monthStart = useMemo(() => getMonthStart(refMonthDate), [refMonthDate]);
    const monthEnd = useMemo(() => getMonthEnd(refMonthDate), [refMonthDate]);
    const daysInMonth = useMemo(() => getDaysInMonth(refMonthDate), [refMonthDate]);

    // Erstelle Kalender-Grid - gruppiert nach Wochen (wie Wochenansicht)
    const getCalendarWeeks = () => {
      const weeks = [];
      const firstDayOfWeek = monthStart.getDay();
      const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Montag als erster Tag

      let currentWeek = [];
      
      // Füge leere Tage hinzu
      for (let i = 0; i < startOffset; i++) {
        currentWeek.push(null);
      }

      // Füge Tage des Monats hinzu
      for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
        
        // Wenn Woche voll (7 Tage)
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }

      // Füge letzte unvollständige Woche hinzu
      if (currentWeek.length > 0) {
        // Fülle mit null auf
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
      }

      return weeks;
    };

    const calendarWeeks = useMemo(() => getCalendarWeeks(), [monthStart, daysInMonth]);

    // Hilfsfunktionen für lokale Tage (kein UTC-Shift)
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    // Minuten-Überlappung zweier Zeitintervalle
    const overlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
      const ms = Math.max(0, Math.min(+aEnd, +bEnd) - Math.max(+aStart, +bStart));
      return Math.round(ms / 60000);
    };

    const getEntriesForDate = (date: Date) => {
      if (!date) return [];
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);

      return sleepEntries.filter(entry => {
        const eStart = new Date(entry.start_time);
        const eEnd   = entry.end_time ? new Date(entry.end_time) : new Date();
        const mins = overlapMinutes(eStart, eEnd, dayStart, dayEnd);
        return mins > 0;
      });
    };

    const getDayScore = (date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);
      const totalMinutes = minutesFromMergedIntervals(
        getMergedIntervalsForEntries(sleepEntries, {
          rangeStart: dayStart,
          rangeEnd: dayEnd,
        })
      );

      if (totalMinutes >= 480) return 'excellent'; // 8h+
      if (totalMinutes >= 360) return 'good';      // 6h+
      if (totalMinutes >= 240) return 'okay';      // 4h+
      return 'poor';                              // <4h
    };

    const getTotalMinutesForDate = (date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd   = endOfDay(date);
      return minutesFromMergedIntervals(
        getMergedIntervalsForEntries(sleepEntries, {
          rangeStart: dayStart,
          rangeEnd: dayEnd,
        })
      );
    };

    // Neue Farbpalette für Kalender-Tiles (wie KPI-Cards)
    type DayScore = 'excellent' | 'good' | 'okay' | 'poor' | 'none';

    const getDayColors = (score: DayScore) => {
      if (isDark) {
        switch (score) {
          case 'excellent': // 8h+
            return { bg: 'rgba(34,197,94,0.46)', text: '#FFFFFF', border: 'rgba(74,222,128,0.95)' };
          case 'good': // 6h+
            return { bg: 'rgba(16,185,129,0.38)', text: '#FFFFFF', border: 'rgba(45,212,191,0.88)' };
          case 'okay': // 4h+
            return { bg: 'rgba(245,158,11,0.42)', text: '#FFFFFF', border: 'rgba(251,191,36,0.95)' };
          case 'poor': // <4h
            return { bg: 'rgba(239,68,68,0.42)', text: '#FFFFFF', border: 'rgba(248,113,113,0.9)' };
          default:
            return { bg: 'rgba(255,255,255,0.08)', text: textSecondary, border: 'rgba(255,255,255,0.22)' };
        }
      }

      switch (score) {
        case 'excellent': // 8h+
          return { bg: 'rgba(56,161,105,0.22)', text: '#2F855A', border: 'rgba(255,255,255,0.65)' }; // grün
        case 'good':      // 6h+
          return { bg: 'rgba(56,161,105,0.14)', text: '#2F855A', border: 'rgba(255,255,255,0.55)' }; // grün (heller)
        case 'okay':      // 4h+
          return { bg: 'rgba(245,166,35,0.18)', text: '#975A16', border: 'rgba(255,255,255,0.55)' }; // amber
        case 'poor':      // <4h
          return { bg: 'rgba(229,62,62,0.18)',  text: '#9B2C2C', border: 'rgba(255,255,255,0.55)' }; // rot
        default:
          return { bg: 'rgba(255,255,255,0.10)', text: textSecondary, border: 'rgba(255,255,255,0.35)' }; // glas neutral
      }
    };

    return (
      <View style={styles.monthViewContainer}>
        {/* Monats-Navigation - Design Guide konform */}
        <View style={styles.monthNavigationContainer}>
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => {
              triggerHaptic();
              setMonthOffset(o => o - 1);
            }}
          >
            <Text style={[styles.monthNavButtonText, { color: textSecondary }]}>‹</Text>
          </TouchableOpacity>

          <View style={styles.monthHeaderCenter}>
            <Text style={[styles.monthHeaderTitle, { color: textSecondary }]}>
              {refMonthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.monthNavButton, monthOffset >= 0 && { opacity: 0.4 }]}
            disabled={monthOffset >= 0}
            onPress={() => {
              triggerHaptic();
              setMonthOffset(o => o + 1);
            }}
          >
            <Text style={[styles.monthNavButtonText, { color: textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Kalender-Block mit exakt gleicher Innenbreite wie Week-Chart */}
        <LiquidGlassCard style={styles.chartGlassCard}>
          <Text style={[styles.chartTitle, { color: textSecondary }]}>Schlafkalender</Text>
          <View style={{ width: WEEK_CONTENT_WIDTH, alignSelf: 'center', paddingVertical: 16 }}>
            {/* Wochentags-Header mit exakten Spaltenbreiten */}
            <View style={styles.weekdayHeader}>
              {['Mo','Di','Mi','Do','Fr','Sa','So'].map((label, i) => {
                const extra = i < WEEK_LEFTOVER ? 1 : 0;
                return (
                  <View
                    key={label}
                    style={{
                      width: WEEK_COL_WIDTH + extra,
                      marginRight: i < 6 ? GUTTER : 0,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={[styles.weekdayLabel, { color: textSecondary }]}>{label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Tage: wochenweise, gleiche Spaltenbreiten & Gutter wie oben */}
            {calendarWeeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.calendarWeek}>
                {week.map((date, dayIndex) => {
                  const extra = dayIndex < WEEK_LEFTOVER ? 1 : 0;
                  return (
                    <View
                      key={dayIndex}
                      style={{
                        width: WEEK_COL_WIDTH + extra,
                        marginRight: dayIndex < 6 ? GUTTER : 0,
                      }}
                    >
                      {date ? (() => {
                        const entriesCount = getEntriesForDate(date).length;
                        const totalMins = getTotalMinutesForDate(date);
                        const hours = Math.round(totalMins / 60); // runde auf ganze Stunden

                        const score = entriesCount > 0 ? getDayScore(date) : 'none';
                        const c = getDayColors(score as DayScore);
                        return (
                          <TouchableOpacity
                            style={[
                              styles.calendarDayButton,
                              { backgroundColor: c.bg, borderColor: c.border },
                              isDark &&
                                score !== 'none' && {
                                  shadowColor: c.border,
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: 0.24,
                                  shadowRadius: 4,
                                  elevation: 2,
                                },
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setSelectedDate(date);
                              setSelectedTab('day');
                            }}
                          >
                            <Text style={[styles.calendarDayNumber, { color: c.text }]}>{date.getDate()}</Text>
                            {totalMins > 0 && (
                              <Text style={[styles.calendarDayHours, { color: c.text }]}>
                                {hours}h
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })() : (
                        <View style={styles.calendarDayEmpty} />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </LiquidGlassCard>

        {/* Monatsstatistiken - Design Guide konform */}
        <LiquidGlassCard style={styles.monthSummaryCard}>
          <View style={styles.summaryInner}>
            <Text style={[styles.summaryTitle, isDark && { color: '#FFFFFF' }]}>Monatsübersicht</Text>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>📊</Text>
                <Text style={[styles.statValue, isDark && { color: '#FFFFFF' }]}>{sleepEntries.length}</Text>
                <Text style={[styles.statLabel, isDark && { color: '#FFFFFF' }]}>Einträge</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>⏰</Text>
                <Text style={[styles.statValue, isDark && { color: '#FFFFFF' }]}>{sleepEntries.length > 0 ? Math.round(sleepEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / sleepEntries.length / 60) : 0}h</Text>
                <Text style={[styles.statLabel, isDark && { color: '#FFFFFF' }]}>Ø pro Tag</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🏆</Text>
                <Text style={[styles.statValue, isDark && { color: '#FFFFFF' }]}>{sleepEntries.length > 0 ? Math.round(Math.max(...sleepEntries.map(e => e.duration_minutes || 0)) / 60) : 0}h</Text>
                <Text style={[styles.statLabel, isDark && { color: '#FFFFFF' }]}>Längster Schlaf</Text>
              </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };




  const headerSubtitle = isReadOnlyPreviewMode
    ? 'Vorschau-Modus: nur ansehen'
    : 'Verfolge das Schlafmuster deines Babys';

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        <Header 
          title="Schlaf-Tracker"
          subtitle={headerSubtitle}
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />

        {/* Top Tabs - über der Status Bar */}
        <TopTabs />

        {/* Status Bar */}
        <StatusMetricsBar
          stats={stats}
          selectedDate={selectedDate}
          sleepPrediction={sleepPrediction}
          activeSleepEntry={activeSleepEntry}
          hasSleepData={sleepEntries.length > 0}
          statsPage={statsPage}
          onPageChange={setStatsPage}
        />

        {isReadOnlyPreviewMode && (
          <View style={styles.readOnlyPreviewBanner}>
            <Text style={styles.readOnlyPreviewTitle}>Nur Vorschau aktiv</Text>
            <Text style={styles.readOnlyPreviewText}>
              Du schaust den Babymodus an. Schlaftracking ist hier gesperrt.
            </Text>
          </View>
        )}

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          {...(Platform.OS === 'ios'
            ? ({ delaysContentTouches: false, canCancelContentTouches: true } as any)
            : {})}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[textSecondary]}
              tintColor={theme.text}
            />
          }
        >
          {selectedTab === 'week' ? (
            <WeekView />
          ) : selectedTab === 'month' ? (
            <MonthView />
          ) : (
            <>
              {/* Day Navigation - gleiche Position/Höhe wie Woche/Monat */}
              <View style={[styles.weekNavigationContainer, styles.dayNavigationContainer]}>
                <TouchableOpacity
                  style={styles.weekNavButton}
                  onPress={() => {
                    triggerHaptic();
                    goPrevDay();
                  }}
                >
                  <Text style={[styles.weekNavButtonText, { color: textSecondary }]}>‹</Text>
                </TouchableOpacity>
                <View style={styles.weekHeaderCenter}>
                  <Text style={[styles.weekHeaderTitle, { color: textSecondary }]}>Tagesansicht</Text>
                  <Text style={[styles.weekHeaderSubtitle, { color: textSecondary }]}>
                    {isSameDay(selectedDate, today)
                      ? new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
                      : selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.weekNavButton, nextDisabled && { opacity: 0.4 }]}
                  disabled={nextDisabled}
                  onPress={() => {
                    triggerHaptic();
                    goNextDay();
                  }}
                >
                  <Text style={[styles.weekNavButtonText, { color: textSecondary }]}>›</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setShowSleepInfoModal(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.sleepInfoIconButton}
              >
                <IconSymbol name="info.circle" size={14} color={textSecondary} />
              </TouchableOpacity>

              {/* Central Timer - nur in Tag-Ansicht */}
              <Animated.View style={{ opacity: appearAnim }}>
                <CentralTimer
                  activeSleepEntry={activeSleepEntry}
                  isStartingSleep={isStartingSleep}
                  isStoppingSleep={isStoppingSleep}
                  predictionLoading={predictionLoading}
                  sleepPrediction={sleepPrediction}
                  predictionError={predictionError}
                  hasSleepData={sleepEntries.length > 0}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  pulseAnim={pulseAnim}
                />
              </Animated.View>

              {/* Schlaferfassung Section - nur in Tag-Ansicht */}
              <View style={styles.sleepCaptureSection}>
                <Text style={[styles.sectionTitle, styles.sectionTitleTight, { color: textSecondary }]}>Schlaferfassung</Text>

                {/* Action Buttons - nur in Tag-Ansicht */}
          <ActionButtons />
              </View>

              {/* Timeline Section - nur in Tag-Ansicht */}
            <View style={styles.timelineSection}>
              <Text style={[styles.sectionTitle, styles.sectionTitleTight, { color: textSecondary }]}>Timeline</Text>

              {/* Sleep Entries - Timeline Style like daily_old.tsx - nur in Tag-Ansicht */}
              <View style={styles.entriesContainer}>
            {timelineItems.map((item, index) => {
              if (item.kind === 'night_group') {
                const group = item.group;
                const totalWakeSeconds = group.wakeGaps.reduce((sum: number, secs: number) => sum + secs, 0);

                // Derive wake phases for display
                const wakePhasesList: { start: Date; end: Date; durationSeconds: number }[] = [];
                // Find longest sleep phase
                let longestSleepMin = 0;
                for (let wi = 0; wi < group.segments.length; wi++) {
                  const segment = group.segments[wi];
                  const eStart = segment.start;
                  const eEnd = segment.end;
                  const dur = Math.round((eEnd.getTime() - eStart.getTime()) / 60000);
                  if (dur > longestSleepMin) longestSleepMin = dur;

                  if (wi > 0) {
                    const prev = group.segments[wi - 1];
                    const ws = prev.end;
                    const we = segment.start;
                    const wdurSeconds = Math.round((we.getTime() - ws.getTime()) / 1000);
                    if (wdurSeconds > 0) {
                      wakePhasesList.push({ start: ws, end: we, durationSeconds: wdurSeconds });
                    }
                  }
                }

                // Emotional assessment
                const sleepHours = group.totalMinutes / 60;
                const wakeCount = wakePhasesList.length;
                let nightMood = '';
                if (sleepHours >= 10 && wakeCount === 0) nightMood = 'Wunderbare Nacht';
                else if (sleepHours >= 8 && wakeCount <= 1) nightMood = 'Sehr gute Nacht';
                else if (sleepHours >= 7 && wakeCount <= 2) nightMood = 'Gute Nacht';
                else if (sleepHours >= 6) nightMood = 'Solider Schlaf';
                else if (sleepHours >= 4) nightMood = 'Unruhige Nacht';
                else nightMood = 'Kurze Nacht';

                const accentPurple = isDark ? '#A26BFF' : '#8E4EC6';
                // Timeline bar width = 85% of contentWidth, capped & centered
                const timelineBarWidth = Math.round(contentWidth * 0.70);

                return (
                  <TouchableOpacity
                    key={`night-group-${group.start.toISOString()}`}
                    activeOpacity={0.85}
                    onPress={() => {
                      triggerHaptic();
                      openNightEditor(group);
                    }}
                    style={styles.nightGroupTouchable}
                  >
                    <LiquidGlassCard style={styles.nightGroupCard}>
                      <View style={styles.nightGroupCardInner}>
                      {/* Header: Moon + Title + Edit hint */}
                      <View style={styles.nightGroupHeader}>
                        <Text style={styles.nightGroupEmoji}>🌙</Text>
                        <Text style={[styles.nightGroupTitle, { color: textPrimary }]}>Nachtschlaf</Text>
                        <Text style={[styles.nightGroupEditHint, { color: accentPurple }]}>Bearbeiten</Text>
                      </View>

                      {/* Big sleep duration + mood */}
                      <Text style={[styles.nightGroupBigDuration, { color: accentPurple }]}>
                        {minutesToHMM(group.totalMinutes)}
                      </Text>
                      <Text style={[styles.nightGroupMood, { color: textSecondary }]}>
                        {nightMood} 💜
                      </Text>

                      {/* Time range */}
                      <Text style={[styles.nightGroupTimeRange, { color: textSecondary }]}>
                        {formatClockTime(group.start)} – {formatClockTime(group.end)}
                      </Text>

                      {/* Solid timeline bar with wake cutouts + labels */}
                      <MiniNightTimeline
                        nightGroup={group}
                        width={timelineBarWidth}
                        isDark={isDark}
                        showLabels
                      />

                      {/* Divider */}
                      {(wakePhasesList.length > 0 || totalWakeSeconds > 0) && (
                        <View style={[styles.nightGroupDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
                      )}

                      {/* Stats row */}
                      {totalWakeSeconds > 0 && (
                        <>
                          <View style={styles.nightGroupStatsRow}>
                            <View style={styles.nightGroupStat}>
                              <View style={[styles.nightGroupStatDot, { backgroundColor: accentPurple }]} />
                              <Text style={[styles.nightGroupStatText, { color: textSecondary }]}>
                                Schlaf: {minutesToHMM(group.totalMinutes)}
                              </Text>
                            </View>
                            <View style={styles.nightGroupStat}>
                              <View style={[styles.nightGroupStatDot, { backgroundColor: 'rgba(232,160,130,0.8)' }]} />
                              <Text style={[styles.nightGroupStatText, { color: textSecondary }]}>
                                Wach: {formatWakeDuration(totalWakeSeconds)}
                              </Text>
                            </View>
                          </View>
                          {longestSleepMin > 0 && (
                            <Text style={[styles.nightGroupLongestPhase, { color: textSecondary }]}>
                              Längste Schlafphase: {minutesToHMM(longestSleepMin)}
                            </Text>
                          )}
                        </>
                      )}

                      {/* Wake phases as subtle inline rows */}
                      {wakePhasesList.length > 0 && (
                        <View style={styles.nightGroupWakeSection}>
                          {wakePhasesList.map((wp, wi) => (
                            <View key={`wp-${wi}`} style={styles.nightGroupWakeCard}>
                              <View style={[styles.nightGroupWakeDot, { backgroundColor: isDark ? 'rgba(232,160,130,0.5)' : 'rgba(232,160,130,0.6)' }]} />
                              <Text style={[styles.nightGroupWakeTime, { color: textSecondary }]}>
                                {formatClockTime(wp.start)} – {formatClockTime(wp.end)}
                              </Text>
                              <View style={[styles.nightGroupWakeBadge, { borderColor: isDark ? 'rgba(232,160,130,0.3)' : 'rgba(232,160,130,0.35)' }]}>
                                <Text style={[styles.nightGroupWakeBadgeText, { color: isDark ? 'rgba(232,160,130,0.6)' : 'rgba(200,120,80,0.7)' }]}>
                                  {formatWakeDuration(wp.durationSeconds)}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                      </View>
                    </LiquidGlassCard>
                  </TouchableOpacity>
                );
              }

              const entry = item.entry;
              return (
                <ActivityCard
                  key={entry.id || index}
                  entry={convertSleepToDailyEntry(entry, nightWindowSettings)}
                  onDelete={(entryId) => {
                    triggerHaptic();
                    handleDeleteEntry(entryId);
                  }}
                  onEdit={() => {
                    triggerHaptic();
                    openEditSleepModal(entry);
                  }}
                  marginHorizontal={8}
                />
              );
            })}
          {dayEntries.length === 0 && !isLoading && (
            <LiquidGlassCard style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💤</Text>
              <Text style={[styles.emptyTitle, { color: textSecondary }]}>Keine Einträge für diesen Tag</Text>
              <Text style={styles.emptySubtitle}>
                {sleepEntries.length > 0
                  ? 'Wechsle das Datum oder springe zum letzten Eintrag.'
                  : 'Starte den ersten Schlaf-Eintrag!'}
              </Text>
              {sleepEntries.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.manualButton, { marginTop: 12 }]}
                  onPress={() => {
                    triggerHaptic();
                    jumpToLatestEntry();
                  }}
                >
                  <Text style={[styles.actionButtonText, { color: textSecondary }]}>Zum letzten Eintrag</Text>
                </TouchableOpacity>
              )}
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.manualButton,
                    { marginTop: 16 },
                    isReadOnlyPreviewMode && styles.actionDisabled,
                  ]}
                  disabled={isReadOnlyPreviewMode}
                  onPress={() => {
                    triggerHaptic();
                    openManualSleepModal();
                  }}
                >
                <Text style={[styles.actionButtonText, { color: textSecondary }]}>Manuell hinzufügen</Text>
              </TouchableOpacity>
            </LiquidGlassCard>
          )}
          </View>

          {/* Manuell Button - erscheint nur bei aktivem Schlaf */}
          {activeSleepEntry && (
            <TouchableOpacity
              style={[
                styles.liquidGlassCardWrapper,
                { width: contentWidth, alignSelf: 'center', marginTop: 16 },
                (isStartingSleep || isStoppingSleep || !isLiveStatusLoaded || isReadOnlyPreviewMode) && styles.actionDisabled
              ]}
              disabled={isStartingSleep || isStoppingSleep || !isLiveStatusLoaded || isReadOnlyPreviewMode}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 20, bottom: 20, left: 18, right: 18 }}
              onPress={() => {
                if (isStartingSleep || isStoppingSleep || !isLiveStatusLoaded || isReadOnlyPreviewMode) return;
                triggerHaptic();
                openManualSleepModal();
              }}
              activeOpacity={0.9}
            >
              <BlurView intensity={24} tint="light" style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="plus.circle.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>Manuell</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary, fontWeight: '500' }]}>Eintrag hinzufügen</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Sleep Input Modal direkt hier rendern */}
        <Modal 
          visible={showInputModal} 
          transparent={true} 
          animationType="slide" 
          onRequestClose={closeManualSleepModal}
        >
          <View style={[styles.modalOverlay, { backgroundColor: modalOverlayColor }]}>
            {/* Background tap to close */}
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              onPress={() => {
                triggerHaptic();
                closeManualSleepModal();
              }}
              activeOpacity={1}
            />

            <BlurView
              style={[
                styles.modalContent,
                {
                  backgroundColor: modalPanelColor,
                  borderTopWidth: isDark ? 1 : 0,
                  borderTopColor: modalPanelBorderColor,
                },
              ]}
              tint={isDark ? 'dark' : 'extraLight'}
              intensity={80}
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity 
                  style={[styles.headerButton, { backgroundColor: modalGhostButtonColor }]}
                  onPress={() => {
                    triggerHaptic();
                    closeManualSleepModal();
                  }}
                >
                  <Text style={[styles.closeHeaderButtonText, { color: textSecondary }]}>✕</Text>
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                  <Text style={[styles.modalTitle, { color: textSecondary }]}>
                    {editingEntry ? 'Schlaf bearbeiten' : 'Schlaf hinzufügen'}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: modalSubtitleColor }]}>
                    {editingEntry ? 'Daten anpassen' : 'Neuen Eintrag erstellen'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.headerButton, styles.saveHeaderButton, { backgroundColor: modalAccentColor }]}
                  onPress={() => {
                    triggerHaptic();
                    handleSaveEntry({
                      start_time: safeModalStartTime.toISOString(),
                      end_time: safeModalEndTime?.toISOString() || null,
                      quality: sleepModalData.quality,
                      notes: sleepModalData.notes
                    });
                  }}
                >
                  <Text style={styles.saveHeaderButtonText}>✓</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{width: '100%', alignItems: 'center'}}>
                    
                    {/* Zeit Sektion */}
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: textSecondary }]}>⏰ Zeitraum</Text>
                      
                      <View style={styles.timeRow}>
                        <TouchableOpacity
                          style={[
                            styles.timeButton,
                            {
                              backgroundColor: modalFieldColor,
                              borderColor: modalFieldBorderColor,
                            },
                          ]}
                          onPress={openStartPicker}
                        >
                          <Text style={[styles.timeLabel, { color: textSecondary }]}>Start</Text>
                          <Text style={[styles.timeValue, { color: textPrimary }]}>
                            {safeModalStartTime.toLocaleString('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.timeButton,
                            {
                              backgroundColor: modalFieldColor,
                              borderColor: modalFieldBorderColor,
                            },
                          ]}
                          onPress={openEndPicker}
                        >
                          <Text style={[styles.timeLabel, { color: textSecondary }]}>Ende</Text>
                          <Text style={[styles.timeValue, { color: textPrimary }]}>
                            {safeModalEndTime
                              ? safeModalEndTime.toLocaleString('de-DE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit'
                                })
                              : 'Offen'
                            }
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Android: DateTimePicker direkt im Modal */}
                      {Platform.OS !== 'ios' && showStartPicker && (
                        <View
                          style={[
                            styles.datePickerContainer,
                            {
                              backgroundColor: modalPickerColor,
                              borderColor: modalFieldBorderColor,
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
                            accentColor={modalAccentColor}
                            onChange={(event, date) => {
                              if (event.type === 'dismissed') return;
                              const nextStart = getSafePickerDateFromEvent(event, date, safeModalStartTime);
                              applyStartPickerValue(nextStart);
                            }}
                            style={styles.dateTimePicker}
                          />
                          <View style={styles.datePickerActions}>
                            <TouchableOpacity
                              style={[styles.datePickerCancel, { backgroundColor: modalAccentColor }]}
                              onPress={() => {
                                triggerHaptic();
                                setShowStartPicker(false);
                              }}
                            >
                              <Text style={styles.datePickerCancelText}>Fertig</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {Platform.OS !== 'ios' && showEndPicker && (
                        <View
                          style={[
                            styles.datePickerContainer,
                            {
                              backgroundColor: modalPickerColor,
                              borderColor: modalFieldBorderColor,
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
                            accentColor={modalAccentColor}
                            onChange={(event, date) => {
                              if (event.type === 'dismissed') return;
                              const nextEnd = getSafePickerDateFromEvent(event, date, safeModalEndPickerTime);
                              applyEndPickerValue(nextEnd);
                            }}
                            style={styles.dateTimePicker}
                          />
                          <View style={styles.datePickerActions}>
                            <TouchableOpacity
                              style={[styles.datePickerCancel, { backgroundColor: modalAccentColor }]}
                              onPress={() => {
                                triggerHaptic();
                                setShowEndPicker(false);
                              }}
                            >
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
                                  backgroundColor: isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)',
                                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                                },
                              ]}
                            >
                              <View style={styles.manualPickerHeader}>
                                <TouchableOpacity
                                  onPress={() => setShowStartPicker(false)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={[styles.manualPickerActionText, { color: textSecondary }]}>Abbrechen</Text>
                                </TouchableOpacity>
                                <Text style={[styles.manualPickerTitle, { color: textPrimary }]}>Start</Text>
                                <TouchableOpacity
                                  onPress={() => {
                                    commitStartPickerDraft();
                                    setShowStartPicker(false);
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={[styles.manualPickerActionText, { color: modalAccentColor }]}>Fertig</Text>
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
                                accentColor={modalAccentColor}
                                themeVariant={isDark ? 'dark' : 'light'}
                                style={styles.manualPickerSpinner}
                              />
                            </View>
                          </View>
                        </Modal>
                      )}

                      {Platform.OS === 'ios' && showEndPicker && (
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
                                  backgroundColor: isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)',
                                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                                },
                              ]}
                            >
                              <View style={styles.manualPickerHeader}>
                                <TouchableOpacity
                                  onPress={() => setShowEndPicker(false)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={[styles.manualPickerActionText, { color: textSecondary }]}>Abbrechen</Text>
                                </TouchableOpacity>
                                <Text style={[styles.manualPickerTitle, { color: textPrimary }]}>Ende</Text>
                                <TouchableOpacity
                                  onPress={() => {
                                    commitEndPickerDraft();
                                    setShowEndPicker(false);
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={[styles.manualPickerActionText, { color: modalAccentColor }]}>Fertig</Text>
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
                                accentColor={modalAccentColor}
                                themeVariant={isDark ? 'dark' : 'light'}
                                style={styles.manualPickerSpinner}
                              />
                            </View>
                          </View>
                        </Modal>
                      )}
                    </View>


                    {/* Qualität Sektion */}
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: textSecondary }]}>😴 Schlafqualität</Text>
                      <View style={styles.optionsGrid}>
                        {(['good','medium','bad'] as const).map(q => (
                          <TouchableOpacity
                            key={q}
                            style={[
                              styles.optionButton,
                              { 
                                backgroundColor: sleepModalData.quality === q 
                                  ? QUALITY_VISUALS[q].color
                                  : modalQualityDefaultColor,
                                borderColor: sleepModalData.quality === q ? 'transparent' : modalFieldBorderColor,
                                flex: 1,
                                marginHorizontal: 3
                              }
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setSleepModalData(prev => ({ ...prev, quality: q }));
                            }}
                          >
                            <Text style={styles.optionIcon}>
                              {QUALITY_VISUALS[q].emoji}
                            </Text>
                            <Text style={[
                              styles.optionLabel,
                              {
                                color: sleepModalData.quality === q ? '#FFFFFF' : textPrimary
                              }
                            ]}>
                              {q === 'good' ? 'Gut' : q === 'medium' ? 'Mittel' : 'Schlecht'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Notizen Sektion */}
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: textSecondary }]}>📝 Notizen</Text>
                      <TouchableOpacity
                        style={[
                          styles.notesInput,
                          {
                            backgroundColor: modalFieldColor,
                            borderColor: modalFieldBorderColor,
                          },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => {
                          triggerHaptic();
                          openNotesEditor();
                        }}
                      >
                        <Text
                          style={[
                            sleepModalData.notes.trim() ? styles.notesText : styles.notesPlaceholder,
                            { color: sleepModalData.notes.trim() ? textPrimary : textSecondary }
                          ]}
                          numberOfLines={3}
                        >
                          {sleepModalData.notes.trim() || 'Optionale Notizen zum Schlaf...'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Delete Button für Bearbeitung */}
                    {editingEntry && (
                      <View style={styles.section}>
                        <TouchableOpacity
                          style={[styles.deleteButton]}
                          onPress={() => {
                            triggerHaptic();
                            if (editingEntry.id) {
                              handleDeleteEntry(editingEntry.id);
                              closeManualSleepModal();
                            }
                          }}
                        >
                          <Text style={styles.deleteButtonText}>🗑️ Eintrag löschen</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                </View>
              </ScrollView>
	            </BlurView>
	          </View>

	          <TextInputOverlay
	            visible={notesOverlayVisible}
	            label="Notizen"
	            value={notesOverlayValue}
	            placeholder="Optionale Notizen zum Schlaf..."
	            multiline
	            accentColor={modalAccentColor}
	            onClose={closeNotesEditor}
	            onSubmit={(next) => saveNotesEditor(next)}
	          />

	        </Modal>

        {nightEditorGroup && (
          <NightSleepEditor
            visible={showNightEditor}
            nightGroup={nightEditorGroup}
            onClose={() => {
              setShowNightEditor(false);
              setNightEditorGroup(null);
            }}
            onSplit={handleSplitNightSegment}
            onMerge={handleMergeNightSegments}
            onAdjustBoundary={handleAdjustNightBoundary}
            onDeleteNightGroup={handleDeleteNightGroup}
            isSaving={isSplittingSegment}
          />
        )}
      </SafeAreaView>

      {/* Sleep Info Modal */}
      <Modal
        visible={showSleepInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSleepInfoModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: modalOverlayColor, justifyContent: 'center', alignItems: 'center' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSleepInfoModal(false)}
            activeOpacity={1}
          />
          <View style={[styles.sleepInfoPanel, { backgroundColor: isDark ? 'rgba(20,20,24,0.96)' : 'rgba(255,255,255,0.97)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={styles.sleepInfoHeader}>
              <Text style={[styles.sleepInfoTitle, { color: textPrimary }]}>So berechnen wir Schlaffenster</Text>
              <TouchableOpacity onPress={() => setShowSleepInfoModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)'} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sleepInfoScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sleepInfoHeading, { color: textPrimary }]}>
                Warum wir Schlaffenster so berechnen{'\n'}(und warum das für viele Mamas gut funktioniert)
              </Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Babyschlaf ist keine exakte Wissenschaft – aber er folgt trotzdem zwei sehr stabilen Kräften:{'\n\n'}
                <Text style={{ fontWeight: '700', color: textPrimary }}>Schlafdruck</Text> (je länger wach, desto müder) und <Text style={{ fontWeight: '700', color: textPrimary }}>innere Uhr / Tagesrhythmus</Text> (morgens oft länger wach, nachmittags schneller müde).{'\n\n'}
                Dieses Zusammenspiel ist ein zentrales, etabliertes Rahmenmodell der Schlafforschung (Two-Process Model: homeostatisch + circadian).{'\n\n'}
                Was Eltern in der Praxis brauchen, ist deshalb meist keine perfekte Minute, sondern eine stressarme Orientierung: Wann wird es wahrscheinlich Zeit, das Baby hinzulegen – ohne starr nach Uhr zu leben?{'\n\n'}
                <Text style={{ fontStyle: 'italic' }}>Wichtig: Für „die eine richtige Wake-Window-Zahl" gibt es nicht die große harte Evidenz – Babys sind zu individuell. Viele Expert:innen betonen daher: Fenster als Orientierung ja, aber flexibel bleiben und Babyzeichen mitdenken.</Text>
              </Text>

              <Text style={[styles.sleepInfoSubheading, { color: textPrimary }]}>Unser Ansatz</Text>
              <View style={styles.sleepInfoBullets}>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: textPrimary }}>Erklärbar</Text> statt Blackbox – du siehst, warum ein Vorschlag entsteht
                </Text>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: textPrimary }}>Robust</Text> statt hektisch – Caps, Puffer, Ausreißer werden gedämpft
                </Text>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: textPrimary }}>Individuell</Text> statt „One size fits all" – dein Baby kalibriert das Modell über die Zeit
                </Text>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: textPrimary }}>Entlastend</Text> statt Druck – wir geben ein Fenster, nicht einen starren Termin
                </Text>
              </View>

              <Text style={[styles.sleepInfoSubheading, { color: textPrimary }]}>Die 7 Schritte der Berechnung</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary, marginBottom: 8 }]}>
                Wir berechnen zuerst ein realistisches Wachfenster (Minuten) und wandeln es dann in ein Zeitfenster um (frühestens/spätestens).
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>1) Basis-Wachfenster nach Alter & Nap-Nummer</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Je nach Alter und ob es Nap 1/2/3 ist, gibt es eine Baseline (z.B. 6 Monate ~150 Min, 12 Monate ~210 Min – je nach Nap-Slot unterschiedlich).
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>2) Nap-Dauer-Korrektur (max. ±20 Min)</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Letzter Nap kürzer als ideal → früher müde → Wachfenster kürzer.{'\n'}
                Letzter Nap länger als ideal → später müde → Wachfenster länger.
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>3) Schlafschuld-Korrektur (max. ±20 Min)</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Wenn das Baby in den letzten 24h unter dem Tages-Schlafziel lag, wird das Wachfenster moderat verkürzt.
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>4) Circadian-Faktor (0.85–1.05×)</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Biologie des Tagesrhythmus: morgens eher länger wach (Faktor {'>'} 1), nachmittags eher schneller müde (Faktor {'<'} 1).
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>5) Historischer Faktor (0.9–1.1×)</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Die echten Wachfenster der letzten 14 Tage für denselben Nap-Slot (robust per Trimmed Mean, Ausreißer werden ignoriert).
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>6) Personalisierung (EMA, max. ±60 Min)</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Lernender Offset: Wenn dein Baby im Schnitt früher/später einschläft als prognostiziert, passt sich das Modell an. Gewichtung: 30% pro neuem Datenpunkt, damit es stabil lernt.
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>7) Clamp + Zeitfenster</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                Wachfenster wird auf 30–300 Min begrenzt. Dann berechnen wir Frühest-/Spätestzeit mit ±25–30% Puffer.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Extra:</Text> Wenn das Baby bereits länger wach ist als Fenster + 15 Min Gnadenfrist → Empfehlung: „Jetzt hinlegen".
              </Text>

              <View style={[styles.sleepInfoSafety, { backgroundColor: isDark ? 'rgba(255,155,155,0.1)' : 'rgba(255,155,155,0.08)', borderColor: isDark ? 'rgba(255,155,155,0.2)' : 'rgba(255,155,155,0.15)' }]}>
                <Text style={[styles.sleepInfoBody, { color: textSecondary, marginBottom: 0 }]}>
                  <Text style={{ fontWeight: '700', color: textPrimary }}>Hinweis zur Sicherheit:</Text> Schlaf-Timing ersetzt keine sicheren Schlafbedingungen – dafür gelten weiterhin klare Empfehlungen wie Rückenlage, eigene Schlafumgebung, keine weichen Gegenstände im Schlafplatz etc.
                </Text>
              </View>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Splash Popup wie in daily_old.tsx */}
      {splashVisible && (
        <Animated.View
          style={[styles.splashOverlay, { opacity: splashAnim }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[splashBg, splashBg]}
            style={StyleSheet.absoluteFillObject as any}
          />
          <View style={styles.splashCenterCard}>
            <Animated.View style={[styles.splashEmojiRing, { transform: [{ scale: splashEmojiAnim }] }]}>
              <Animated.Image
                source={SPLASH_PROMO_GIF}
                style={styles.splashGif}
                resizeMode="contain"
              />
            </Animated.View>
            {splashTitle ? <Text style={styles.splashTitle}>{splashTitle}</Text> : null}
            {splashSubtitle ? <Text style={styles.splashSubtitle}>{splashSubtitle}</Text> : null}
            {splashStatus ? <Text style={styles.splashStatus}>{splashStatus}</Text> : null}
            {splashHint ? (
              <View style={styles.splashHintCard}>
                <Text style={styles.splashHintText}>♡  {splashHint}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      )}
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', backgroundColor: '#f5eee0' },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 140, paddingHorizontal: LAYOUT_PAD },
  readOnlyPreviewBanner: {
    marginHorizontal: LAYOUT_PAD,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 210, 160, 0.7)',
    backgroundColor: 'rgba(70, 45, 25, 0.4)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  readOnlyPreviewTitle: {
    color: '#FFE2B3',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  readOnlyPreviewText: {
    color: 'rgba(255, 240, 220, 0.95)',
    fontSize: 12,
    fontWeight: '500',
  },

  // Stats Container (Swipeable)
  statsContainer: {
    width: '100%',
    marginBottom: 0,
  },
  statsScroll: {
    width: '100%',
  },
  statsPage: {
    paddingHorizontal: LAYOUT_PAD,
  },
  pagingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: -6,
    gap: 8,
  },
  pagingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(125, 90, 80, 0.3)',
  },
  pagingDotActive: {
    backgroundColor: '#8E4EC6',
    width: 24,
  },

  // KPI glass cards (Kompakt)
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'center',
    width: contentWidth,   // exakt gleich wie andere Abschnitte
    marginTop: 6,
    marginBottom: 4,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12, // Reduziertes Padding für bessere Balance
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 64,
  },
  kpiCardWide: {
    width: '100%', // Vollbreite für spezielle Karten
  },
  kpiColumn: {
    alignSelf: 'center',
    width: contentWidth,
    marginTop: 6,
    marginBottom: 4,
  },
  kpiCardStack: {
    marginBottom: 8,
  },
  kpiHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 3,
  },
  kpiTitle: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#7D5A50',
    marginLeft: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY,
    marginTop: 1,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern
  },
  kpiValueCentered: { 
    textAlign: 'center', 
    width: '100%' 
  },
  kpiSub: {
    marginTop: 2,
    fontSize: 9,
    color: '#7D5A50',
    textAlign: 'center',
    opacity: 0.8,
  },
  predictionMetaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 6,
  },
  predictionBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  predictionBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#7D5A50',
    opacity: 0.8,
  },

  // Central Timer (Baby Blue Circle Only)
  centralTimerContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  
  centralContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  // Neu: Expliziter quadratischer Container für den Kreis
  circleArea: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCircle: {
    position: 'absolute',
    overflow: 'hidden',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glassCircleBlur: {
    flex: 1,
  },
  glassCircleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(135, 206, 235, 0.1)', // Baby blue overlay
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  // Neu: Progress Circle absolut positionieren
  progressAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Neu: Exakte Zentrierung der Uhrzeit
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Neu: Content über der Uhrzeit (Icon)
  upperContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '60%', // Icon oben im oberen Drittel
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Neu: Content unter der Uhrzeit (Status + Hinweis)
  lowerContent: {
    position: 'absolute',
    top: '60%', // Beginnt unter der Uhrzeit
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  centralIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralStatus: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 16,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  centralTime: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    lineHeight: 32, // Match fontSize for perfect alignment
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
    textAlignVertical: 'center', // Android specific
    includeFontPadding: false, // Android specific - removes extra padding
    // Monospaced Ziffern für exakte Zentrierung
    fontVariant: ['tabular-nums'],
  },
  centralHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 200,
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: 2,
  },
  centralHintPrimary: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
  },
  centralHintSecondary: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    includeFontPadding: false,
    opacity: 0.85,
  },

  sectionTitle: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.1,
  },
  sectionTitleTight: {
    marginTop: Math.max(2, SECTION_GAP_TOP - 12),
  },

  // Top Tabs (exakt wie daily_old.tsx)
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  topTab: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  topTabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  activeTopTab: { borderColor: 'rgba(94,61,179,0.65)' },
  topTabText: { fontSize: 13, fontWeight: '700', color: '#7D5A50' },
  activeTopTabText: { color: PRIMARY },

  // Cards Grid (from home.tsx)
  cardsGrid: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: contentWidth,
    marginBottom: 0,
  },

  // Liquid Glass Cards (from home.tsx)
  liquidGlassCardWrapper: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  actionDisabled: {
    opacity: 0.6,
  },
  fullWidthStopButton: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  fullWidthCard: {
    width: '100%',
  },
  fullWidthCardTouchable: {
    flex: 1,
  },
  liquidGlassCardBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    height: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '500',
  },

  // Next Sleep Window Card (Home.tsx style)
  nextSleepCard: {
    padding: 20,
    backgroundColor: 'transparent',
    marginHorizontal: 4,
  },
  nextSleepContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextSleepInfo: {
    flex: 1,
  },
  nextSleepType: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  nextSleepTime: {
    fontSize: 16,
    fontWeight: '600',
  },


  // Glass base styles (from daily_old.tsx)
  glassContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },

  // Liquid Glass Base Styles
  liquidGlassWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  liquidGlassBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassContainer: {
    borderRadius: 22,
    borderWidth: 1.5,
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  liquidGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Schlaferfassung Section (Design Guide konform - gleiche Breite wie Wochenansicht)
  sleepCaptureSection: {
    paddingHorizontal: 0,       // Gleiche Breite wie Wochenansicht-Container
    paddingTop: 0,
    paddingBottom: 0,
  },

  // Timeline Section (Design Guide konform - gleiche Breite wie Wochenansicht)
  timelineSection: {
    paddingHorizontal: 0,       // Gleiche Breite wie Wochenansicht-Container
  },

  // Entries Container (Design Guide konform - gleiche Breite wie Wochenansicht)
  entriesContainer: {
    gap: 16,
    paddingHorizontal: 0,       // Gleiche Breite wie Wochenansicht-Container
    paddingVertical: 4,
  },

  // Action Button Styles (Home.tsx style)
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    gap: 8,
  },
  manualButton: {
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },


  // Empty State Styles
  emptyState: {
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#A8978E',
    textAlign: 'center',
  },

  nightGroupTouchable: {
    marginHorizontal: 8,
  },
  nightGroupCard: {
    borderWidth: 1.2,
    borderColor: 'rgba(142, 78, 198, 0.25)',
    backgroundColor: 'rgba(142, 78, 198, 0.06)',
  },
  nightGroupCardInner: {
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 28,
  },
  nightGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  nightGroupEmoji: {
    fontSize: 18,
  },
  nightGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  nightGroupEditHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  nightGroupBigDuration: {
    fontSize: 38,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  nightGroupMood: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
    opacity: 0.7,
  },
  nightGroupTimeRange: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginBottom: 20,
    opacity: 0.5,
  },
  nightGroupDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    marginBottom: 16,
  },
  nightGroupStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  nightGroupStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nightGroupStatDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  nightGroupStatText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  nightGroupLongestPhase: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.45,
    marginTop: 6,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  nightGroupWakeSection: {
    marginTop: 10,
    gap: 5,
  },
  nightGroupWakeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 2,
    gap: 8,
  },
  nightGroupWakeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  nightGroupWakeTime: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  nightGroupWakeBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  nightGroupWakeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  sleepInfoIconButton: {
    alignSelf: 'flex-end',
    marginRight: LAYOUT_PAD + 6,
    marginTop: 2,
    marginBottom: -2,
    opacity: 0.45,
  },

  // Sleep Info Modal Styles
  sleepInfoPanel: {
    width: screenWidth - 40,
    maxHeight: screenHeight * 0.8,
    borderRadius: 24,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
  },
  sleepInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sleepInfoTitle: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  sleepInfoScroll: {
    paddingHorizontal: 20,
  },
  sleepInfoHeading: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 12,
  },
  sleepInfoSubheading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
  sleepInfoBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  sleepInfoStep: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 2,
  },
  sleepInfoBullets: {
    gap: 6,
    marginBottom: 4,
  },
  sleepInfoBullet: {
    fontSize: 13,
    lineHeight: 19,
    paddingLeft: 8,
  },
  sleepInfoSafety: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },

  // 🆕 Insights Rondell Styles (wie KPI-Cards)
  insightsRondellScroll: {
    marginTop: 8,
    marginBottom: 4,
  },
  insightsRondellContainer: {
    paddingHorizontal: LAYOUT_PAD,
    gap: 10,
  },
  insightCard: {
    width: 110,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 64,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  insightIconText: {
    fontSize: 14,
  },
  insightTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7D5A50',
    flex: 1,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },

  // Sleep Modal Styles - wie ActivityInputModal
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
    // color wird dynamisch gesetzt
  },
  headerCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    // color wird dynamisch gesetzt
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
    // color wird dynamisch gesetzt
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
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  optionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    marginHorizontal: 5,
    minHeight: 80,
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
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    gap: 15,
  },
  timeButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  timeLabel: {
    fontSize: 12,
    // color wird dynamisch gesetzt
    fontWeight: '600',
    marginBottom: 5,
  },
  timeValue: {
    fontSize: 16,
    // color wird dynamisch gesetzt
    fontWeight: 'bold',
  },
  notesInput: {
    width: '90%',
    minHeight: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  notesText: {
    fontSize: 16,
    // color wird dynamisch gesetzt
  },
  notesPlaceholder: {
    fontSize: 16,
    // color wird dynamisch gesetzt
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // DatePicker Styles - im Modal integriert
  datePickerContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 15,
    padding: 15,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  dateTimePicker: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  datePickerCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#8E4EC6',
  },
  datePickerCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
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
  splitSegmentNav: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  splitSegmentArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitSegmentArrowText: {
    fontSize: 24,
    fontWeight: '700',
  },
  splitSegmentLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  splitSegmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  splitSegmentIndex: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
  splitWakeLabel: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  splitWakeControls: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitWakeButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  splitWakeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  splitWakeValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Splash Styles wie in daily_old.tsx
  splashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  splashEmoji: {
    fontSize: 72,
    textAlign: 'center',
    marginBottom: 10,
    color: '#fff',
  },
  splashGif: {
    width: 170,
    height: 170,
  },
  splashText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  splashCenterCard: {
    width: '100%',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  splashSubtitle: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
  },
  splashStatus: {
    marginTop: 30,
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  splashHintCard: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
  },
  splashHintText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '700',
  },
  splashEmojiRing: {
    width: 176,
    height: 176,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },

  // Wochen- und Monatsansicht Styles (Design Guide konform)
  weekViewContainer: {
    paddingHorizontal: 0,       // Padding bereits in contentWidth berücksichtigt
    paddingBottom: 20,
  },
  monthViewContainer: {
    paddingHorizontal: 0,       // Padding bereits in contentWidth berücksichtigt
    paddingBottom: 20,
  },

  // Navigation Styles (Design Guide konform)
  weekNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,     // noch näher an die Dots
    marginBottom: 0, // kompakter zum Content
    paddingHorizontal: LAYOUT_PAD, // Navigation braucht eigenen Abstand
  },
  dayNavigationContainer: {
    marginTop: 2, // minimal mehr Abstand zu den Dots in der Tagesansicht
  },
  monthNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,     // noch näher an die Dots
    marginBottom: 0, // kompakter zum Content
    paddingHorizontal: LAYOUT_PAD, // Navigation braucht eigenen Abstand
  },
  weekNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 6,                 // Mehr Touch-Komfort
  },
  monthNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  weekNavButtonText: {
    fontSize: 24,
    color: '#8E4EC6',
    fontWeight: 'bold',
  },
  monthNavButtonText: {
    fontSize: 24,
    color: '#8E4EC6',
    fontWeight: 'bold',
  },
  weekHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  monthHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  weekHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 6,
  },
  monthHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 4,
  },
  weekHeaderSubtitle: {
    fontSize: 12,
    color: '#7D5A50',
  },

  // Chart Styles (Design Guide konform)
    chartContainer: {
      marginBottom: 20,
      marginHorizontal: 0,        // Volle Breite wie Tagesansicht
      paddingHorizontal: 0,       // Volle Breite nutzen
    },
    chartGlassCard: {
      marginHorizontal: TIMELINE_INSET, // Wie Timeline-Cards
      marginBottom: 20,           // Abstand zur nächsten Karte
      padding: 0,                 // Padding wird durch Container-Abstand geregelt
    },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D4A40',           // Dunkler für bessere Lesbarkeit auf Glass
    textAlign: 'center',
    marginBottom: SECTION_GAP_BOTTOM, // Einheitlicher Abstand
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,                // Mehr Höhe für bessere Lesbarkeit
    paddingVertical: 16,        // Mehr Padding oben/unten
    paddingHorizontal: 0,       // Keine interne Breite — wir setzen contentWidth explizit
    width: '100%',              // Volle Breite der Glass Card
  },
  chartColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',  // Wochentage immer unten
    height: '100%',             // Volle Höhe der chartArea
  },
  chartBarContainer: {
    height: MAX_BAR_H,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  chartBar: {
    width: Math.max(10, Math.round(COL_WIDTH * 0.66)), // kräftiger und proportional
    borderRadius: 6,
    marginTop: 2,
    minHeight: 3,
  },
  chartBarTotal: {
    backgroundColor: '#8E4EC6', // Lila für Gesamtschlaf
  },
  chartLabel: {
    fontSize: screenWidth < 360 ? 11 : 12, // responsiv für schmale Geräte
    color: '#5D4A40',           // Dunkler für Glass Hintergrund
    fontWeight: '600',
    marginBottom: 4,
    textShadowColor: 'rgba(255, 255, 255, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    includeFontPadding: false,  // System-Scaling ausschalten
  },
  chartValue: {
    fontSize: screenWidth < 360 ? 11 : 12, // responsiv für schmale Geräte
    color: '#7D5A50',           // Dunkler für Glass Hintergrund
    fontWeight: '600',
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern für präzise Ausrichtung
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    includeFontPadding: false,  // System-Scaling ausschalten
  },
  chartLabelContainer: {
    minHeight: 44,              // Feste Höhe für einheitliche Ausrichtung
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: COL_WIDTH,           // fix = kein Umbruch/Abschnitt
  },

  // Summary Cards (Design Guide konform)
  weekSummaryCard: {
    padding: 0,                 // Padding entfernt für exakte Breite
    marginHorizontal: TIMELINE_INSET, // Wie Timeline-Cards
    marginBottom: 20,           // Mehr Abstand
  },
  monthSummaryCard: {
    padding: 0,                          // wie chartGlassCard
    marginHorizontal: TIMELINE_INSET,    // gleiche Außenbreite
    marginBottom: 16,
  },
  // Wrapper für exakt gleiche Innenbreite wie Chart
  summaryInner: {
    width: WEEK_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: 24,                // Innenabstand bleibt erhalten
  },
  summaryTitle: {
    fontSize: 18,               // Größerer Titel
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: SECTION_GAP_BOTTOM, // Einheitlicher Abstand
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,                    // Gleichmäßige Verteilung
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,               // Größer für bessere Lesbarkeit
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 6,            // Mehr Abstand
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern
  },
  statLabel: {
    fontSize: 13,               // Größer für bessere Lesbarkeit
    color: '#7D5A50',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Trend Card (Design Guide konform)
  trendCard: {
    padding: 0,                 // Padding entfernt für exakte Breite
    marginHorizontal: TIMELINE_INSET, // Wie Timeline-Cards
    marginBottom: 8,            // kompakter, da keine Highlights mehr folgen
  },
  // Wrapper für exakt gleiche Innenbreite wie Chart
  trendInner: {
    width: WEEK_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: 24,                // Innenabstand bleibt erhalten
  },
  trendTitle: {
    fontSize: 18,               // Größerer Titel
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: SECTION_GAP_BOTTOM, // Einheitlicher Abstand
    textAlign: 'center',
  },
  trendContent: {
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 8,
  },
  trendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  trendEmoji: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
    textAlign: 'center',
  },
  trendText: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },

  // Calendar Styles (Design Guide konform)
    calendarContainer: {
      // hier *keine* feste Breite setzen – die kommt inline (WEEK_CONTENT_WIDTH)
      marginBottom: 20,
    },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#7D5A50',
  },
  calendarWeek: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarDayButton: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderWidth: 1.25,                         // glasiger Rand
  },
  calendarDayEmpty: {
    aspectRatio: 1,
    width: '100%',
  },
  calendarDayNumber: {
    fontSize: 12,
    fontWeight: '600',
    // Textfarben kommen jetzt dynamisch
  },
  calendarDayIndicator: {
    fontSize: 8,
    marginTop: 2,
    opacity: 0.8,
    // Textfarben kommen jetzt dynamisch
  },
  calendarDayHours: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
    opacity: 0.9,
    fontVariant: ['tabular-nums'], // gleichbreite Ziffern
  },

  // Highlight Cards (Design Guide konform)
    highlightRow: {
      flexDirection: 'row',
      alignSelf: 'center',
      width: WEEK_CONTENT_WIDTH,  // exakt wie Chart-Innenbreite
      marginBottom: 20,
    },
  highlightCard: {
    padding: 20,                // Mehr Padding
    marginHorizontal: 0,        // Kein zusätzlicher Margin
    alignItems: 'center',       // Inhalte zentrieren
    justifyContent: 'center',   // vertikal zentrieren
  },
  highlightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightEmoji: {
    fontSize: 26,               // Größerer Emoji
    marginRight: 14,            // Mehr Abstand
  },
  highlightInfo: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 13,               // Größerer Label-Text
    color: '#7D5A50',
    fontWeight: '600',
    marginBottom: 6,            // Mehr Abstand
  },
  highlightValue: {
    fontSize: 18,               // Größerer Wert
    fontWeight: 'bold',
    color: '#8E4EC6',
    fontVariant: ['tabular-nums'], // Gleichbreite Ziffern
  },

});
