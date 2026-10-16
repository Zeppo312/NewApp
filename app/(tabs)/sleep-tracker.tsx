import { PeriodNavigationButton } from '@/components/ui/period-navigation-button';
import { TrackingSyncStatus } from '@/components/TrackingSyncStatus';
import { ContentCard as GlassCard,ContentCard as LiquidGlassCard } from '@/components/ui/content-card';
import { FormField,FormSheet } from '@/components/ui/form-sheet';
import { PeriodTabs } from '@/components/ui/period-tabs';
import { CONTENT_LAYOUT, METRIC_TEXT, METRIC_TEXT_LARGE, LAYOUT_PAD, PRIMARY, SECTION_GAP_BOTTOM, SECTION_GAP_TOP } from '@/constants/DesignGuide';
import { TYPOGRAPHY } from '@/constants/Typography';
import { useSleepOffline } from '@/contexts/SleepOfflineContext';
import { useTrackingSync } from '@/contexts/TrackingSyncContext';
import { localHealthAllowed } from '@/lib/localHealthStorage';
import { readSnapshot,validRows } from '@/lib/localReadSnapshots';
import { offlineText } from '@/lib/offlineTranslations';
import { saveErrorMessage } from '@/lib/saveErrorMessage';
import { pendingSleepOverlay } from '@/lib/sleepOfflineActions';
import { SLEEP_OFFLINE_ENABLED } from '@/lib/sleepSyncContract';
import { overlayTrackingRows,queueTrackingUpdate,readTrackingOutbox,trackingScope } from '@/lib/trackingOutbox';
/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';

import { useRouter } from 'expo-router';
import { useFocusEffect } from '@/lib/navigation/useFocusEffect';
import React,{ useCallback,useEffect,useMemo,useRef,useState } from 'react';
import Reanimated,{ Easing,FadeIn,FadeOut,LinearTransition } from 'react-native-reanimated';
import {
Alert,
Animated,
Dimensions,
Modal,
Platform,
RefreshControl,
SafeAreaView,
ScrollView,
StatusBar,
StyleSheet,
Text,
TouchableOpacity,
View,
useWindowDimensions,
} from 'react-native';

import TextInputOverlay from '@/components/modals/TextInputOverlay';
import DateTimePicker,{ DateTimePickerEvent } from '@/components/ui/DateTimePicker';
import { HomeBackground,HomeGlassSurface } from '@/components/ui/home-glass';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { isBeforeHistoryCutoff,useFeatureAccess,useHistoryCutoff } from '@/lib/entitlements';
import { showHistoryLimitAlert } from '@/lib/historyLimit';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

import ActivityCard from '@/components/ActivityCard';
import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
invalidateCacheAfterAction
} from '@/lib/screenCache';
import { SleepEntry,SleepQuality,loadConnectedUsers } from '@/lib/sleepData';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
// SplashOverlay Import entfernt - keine Popups
import NightSleepEditor,{ MiniNightTimeline } from '@/components/NightSleepEditor';
import { SleepCaptureButton } from '@/components/tracking/SleepCaptureButton';
import { SleepTimerFace } from '@/components/tracking/SleepTimerFace';

import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useBackend } from '@/contexts/BackendContext';
import { useNotifications } from '@/hooks/useNotifications';
import { usePartnerNotifications } from '@/hooks/usePartnerNotifications';
import { useSleepEntriesService } from '@/hooks/useSleepEntriesService';
import { useSleepEntriesSync } from '@/hooks/useSleepEntriesSync';
import { getBabyInfo } from '@/lib/baby';
import { cancelBabyReminderNotification } from '@/lib/babyReminderNotifications';
import { normalizeBedtimeAnchor } from '@/lib/bedtime';
import {
DEFAULT_NIGHT_WINDOW_SETTINGS,
clockTimeToMinutes,
getNightWindowRangeForDate,
loadNightWindowSettings,
type NightWindowSettings,
} from '@/lib/nightWindowSettings';
import { shouldCancelStaleReminderAfterManualEntry } from '@/lib/reminderCancellationGuards';
import { parseSafeDate } from '@/lib/safeDate';
import type { SleepEntry as StoredSleepEntry } from '@/lib/services/SleepEntriesService';
import { getDailySleepTargetMinutes,initializePersonalization,predictNextSleepWindow,updatePersonalizationAfterNap,type SleepWindowPrediction } from '@/lib/sleep-window';
import { sleepActivityService } from '@/lib/sleepActivityService';
import { findFreshActiveSleepEntry } from '@/lib/sleepEntryGuards';
import { splitNightSleepSegment } from '@/lib/sleepNightSplit';
import {
forgetActiveSleepPeriodOverride,
loadStoredActiveSleepPeriodOverride,
rememberActiveSleepPeriodOverride,
} from '@/lib/sleepPeriodOverrides';
import {
getSleepPeriodForEntry,
getSleepPeriodForStart,
overlapMinutes,
type SleepPeriod,
} from '@/lib/sleepPeriods';
import { DEFAULT_SLEEP_TRACKER_LOCALE,SleepTrackerTranslationKey,getSleepTrackerLocaleTag,translateSleepTrackerText } from '@/lib/sleepTrackerTranslations';
import { syncSleepWidget } from '@/lib/sleepWidget';
import { cancelLocalSleepWindowReminders } from '@/lib/sleepWindowReminderNotifications';
import { navigateBack } from '@/lib/navigation/backNavigation';

let ACTIVE_SLEEP_TRACKER_LOCALE = DEFAULT_SLEEP_TRACKER_LOCALE;
let SLEEP_TRACKER_LOCALE_TAG = getSleepTrackerLocaleTag(ACTIVE_SLEEP_TRACKER_LOCALE);
const t = (key: SleepTrackerTranslationKey, params?: Record<string, string | number>) => translateSleepTrackerText(ACTIVE_SLEEP_TRACKER_LOCALE, key, params);

const getLocalizedWeekdayLabels = (localeTag: string) =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(localeTag, { weekday: 'short' })
      .format(new Date(2024, 0, 1 + index))
      .replace(/\.$/, ''),
  );
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  t('preview.message');

// Globale Helper-Funktionen für Zeitberechnungen
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
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

// Match Timeline (ActivityCard marginHorizontal=8 -> 16px gesamt)
const TIMELINE_INSET = 8;
// Soft appear/disappear for timeline cards: day switches, deletes and new
// entries fade instead of snapping, and the remaining cards glide into place.
// The short exit plus a small entry delay keeps old and new cards from
// visibly overlapping when the day changes. Remaining cards wait until a
// deleted card has mostly faded before they glide up into its place.
const TIMELINE_ITEM_ENTERING = FadeIn.duration(260).delay(70);
const TIMELINE_ITEM_EXITING = FadeOut.duration(160);
const TIMELINE_ITEM_LAYOUT = LinearTransition.duration(280).delay(110).easing(Easing.out(Easing.cubic));
// The empty state follows only after the last card is gone.
const TIMELINE_EMPTY_ENTERING = FadeIn.duration(280).delay(200);
const contentWidth = screenWidth - 2 * LAYOUT_PAD;

const COLS = 7;
const GUTTER = 4; // weniger Abstand zwischen Spalten => mehr Netto-Breite
const COL_WIDTH = Math.floor((contentWidth - (COLS - 1) * GUTTER) / COLS);
const totalGutters = (COLS - 1) * GUTTER;

// Week-Chart spezifische Konstanten (wie Timeline)
const WEEK_CONTENT_WIDTH = contentWidth - TIMELINE_INSET * 2;
const WEEK_COL_WIDTH   = Math.floor((WEEK_CONTENT_WIDTH - (COLS - 1) * GUTTER) / COLS);
const WEEK_COLS_WIDTH  = COLS * WEEK_COL_WIDTH;
const WEEK_LEFTOVER    = WEEK_CONTENT_WIDTH - (WEEK_COLS_WIDTH + totalGutters);

// Action Buttons Konstanten (2-Spalten Layout)
const GRID_COLS = 2;
const GRID_GUTTER = 12;
const GRID_COL_W = Math.floor((contentWidth - (GRID_COLS - 1) * GRID_GUTTER) / GRID_COLS);
const GRID_LEFTOVER = contentWidth - (GRID_COLS * GRID_COL_W + (GRID_COLS - 1) * GRID_GUTTER);

const MAX_BAR_H = 140; // Höhe der Balkenfläche (mehr Luft)

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
  entry: Pick<SleepEntry, 'start_time' | 'end_time'>,
  nightWindowSettings: NightWindowSettings,
  allowActiveNightFallback = false
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

  if (previousOverlap <= 0 && upcomingOverlap <= 0) {
    if (!allowActiveNightFallback || entry.end_time) return null;
    const startMs = start.getTime();
    const previousEndMs = previousWindow.nightWindowEnd.getTime();
    const upcomingStartMs = upcomingWindow.nightWindowStart.getTime();
    const selectedWindow =
      startMs >= previousEndMs && startMs <= upcomingStartMs
        ? upcomingWindow
        : Math.abs(upcomingStartMs - startMs) < Math.abs(startMs - previousEndMs)
          ? upcomingWindow
          : previousWindow;
    return `${selectedWindow.nightWindowStart.toISOString()}|${selectedWindow.nightWindowEnd.toISOString()}`;
  }

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
    const key = getNightWindowKeyForEntry(entry, nightWindowSettings, true);
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

const getAssignedDateForEntry = (
  entry: ClassifiedSleepEntry,
  nightWindowSettings: NightWindowSettings
) => {
  if (entry.period === 'night') {
    const windowKey = getNightWindowKeyForEntry(entry, nightWindowSettings, true);
    if (windowKey) {
      const [windowStartIso] = windowKey.split('|');
      const windowStart = new Date(windowStartIso);
      if (Number.isFinite(windowStart.getTime())) {
        return windowStart;
      }
    }
  }

  return new Date(entry.start_time);
};

const isEntryAssignedToDate = (
  entry: ClassifiedSleepEntry,
  selectedDate: Date,
  nightWindowSettings: NightWindowSettings
) => {
  if (isSameDay(getAssignedDateForEntry(entry, nightWindowSettings), selectedDate)) {
    return true;
  }

  // Nachtschlaf-Einträge, die über Mitternacht in einen anderen Kalendertag reichen,
  // sollen auch am Aufwachtag sichtbar sein (z.B. Nachtschlaf Mo 20:00 → Di 06:00
  // erscheint am Montag als letzter und am Dienstag als erster Eintrag).
  if (entry.period === 'night') {
    const entryStart = new Date(entry.start_time);
    const entryEnd = entry.end_time ? new Date(entry.end_time) : new Date();
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    if (overlapMinutes(entryStart, entryEnd, dayStart, dayEnd) > 0) {
      return true;
    }
  }

  return false;
};

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
  date.toLocaleTimeString(SLEEP_TRACKER_LOCALE_TAG, { hour: '2-digit', minute: '2-digit' });

const isNightSleepPrediction = (prediction: SleepWindowPrediction | null | undefined): boolean =>
  prediction?.predictionKind === 'night_sleep';

const resolvePredictionBedtimeDate = (
  prediction: SleepWindowPrediction | null | undefined
): Date | null => {
  const currentDayBedtime = prediction?.debug?.currentDayBedtime;
  if (typeof currentDayBedtime === 'string') {
    const parsed = new Date(currentDayBedtime);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  const rawAnchor = prediction?.debug?.anchorBedtime;
  if (typeof rawAnchor !== 'string') return null;

  const match = rawAnchor.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const anchorDate = new Date();
  anchorDate.setHours(hours, minutes, 0, 0);
  return anchorDate;
};

const getBedtimePredictionLabel = (prediction: SleepWindowPrediction | null | undefined): string => {
  const rawAnchor = prediction?.debug?.anchorBedtime;
  const bedtimeDate = resolvePredictionBedtimeDate(prediction);
  const now = new Date();

  if (bedtimeDate && now.getTime() >= bedtimeDate.getTime()) {
    const minutesSinceBedtime = Math.round((now.getTime() - bedtimeDate.getTime()) / 60000);
    if (minutesSinceBedtime <= 45) {
      return t('prediction.bedtimeNow');
    }
    if (typeof rawAnchor === 'string' && rawAnchor.trim().length > 0) {
      return t('prediction.bedtimeSince', { time: rawAnchor });
    }
    return t('splash.nightStartTitle');
  }

  if (typeof rawAnchor === 'string' && rawAnchor.trim().length > 0) {
    return t('prediction.bedtimeAround', { time: rawAnchor });
  }
  return t('prediction.bedtimeDirect');
};

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
  onStart: () => Promise<unknown>;
  startLabel: string;
  startHint: string;
  startDisabled: boolean;
};

function CentralTimerComponent({
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
  onStart,
  startLabel,
  startHint,
  startDisabled,
}: CentralTimerProps) {
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const currentTime = new Date(currentTimeMs);
  const { width, fontScale } = useWindowDimensions();
  const circleSize = fontScale >= 1.3
    ? Math.min(width - 2 * CONTENT_LAYOUT.edge, 280)
    : Math.min(width * 0.6, 260);
  const activeStartMs = activeSleepEntry
    ? new Date(activeSleepEntry.start_time).getTime()
    : Number.NaN;
  const elapsedTime = Number.isFinite(activeStartMs)
    ? Math.max(0, Math.floor((currentTimeMs - activeStartMs) / 1000))
    : 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = activeSleepEntry ? (elapsedTime / (8 * 60 * 60)) * 100 : 0;

  return (
    <View style={styles.centralTimerContainer}>
      <Animated.View style={[styles.centralContainer, { transform: [{ scale: pulseAnim }] }]}>
        <SleepTimerFace size={circleSize} active={Boolean(activeSleepEntry)} progress={progress} textColor={textPrimary}
          pending={isStartingSleep || isStoppingSleep}
          onStart={onStart} startLabel={startLabel} startHint={startHint} startDisabled={startDisabled}
          timeLabel={activeSleepEntry
            ? isStoppingSleep ? t('prediction.stopping') : formatDurationSeconds(elapsedTime)
            : isStartingSleep ? t('prediction.starting') : currentTime.toLocaleTimeString(SLEEP_TRACKER_LOCALE_TAG, { hour: '2-digit', minute: '2-digit' })}>
            {activeSleepEntry && (
              <Text style={[styles.centralStatus, fontScale < 1.3 && TYPOGRAPHY.label, { color: textPrimary, fontWeight: '700' }]}>
                {t('prediction.sleeping')}
              </Text>
            )}
            {activeSleepEntry ? (
              <Text style={[styles.centralHint, fontScale < 1.3 && TYPOGRAPHY.caption, { color: textSecondary }]}>
                {t('prediction.since')} {new Date(activeSleepEntry.start_time).toLocaleTimeString(SLEEP_TRACKER_LOCALE_TAG, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : predictionLoading && !sleepPrediction ? (
              // A recalculation keeps the previous window visible instead of
              // flashing "calculating" after every list change.
              <Text style={[styles.centralHint, fontScale < 1.3 && TYPOGRAPHY.caption, { color: textSecondary }]}>
                {t('prediction.calculating')}
              </Text>
            ) : sleepPrediction && hasSleepData && isNightSleepPrediction(sleepPrediction) ? (
              <Text style={[styles.centralHintPrimary, fontScale < 1.3 && TYPOGRAPHY.label, { color: textPrimary }]}>
                {t('prediction.noMoreNaps')}{'\n'}
                {getBedtimePredictionLabel(sleepPrediction)}
              </Text>
            ) : sleepPrediction && hasSleepData ? (
              <Text style={[styles.centralHintPrimary, fontScale < 1.3 && TYPOGRAPHY.label, { color: textPrimary }]}>
                {t('prediction.next')}{'\n'}
                {formatClockTime(sleepPrediction.earliest)} – {formatClockTime(sleepPrediction.latest)}
              </Text>
            ) : !hasSleepData ? (
              <Text style={[styles.centralHint, fontScale < 1.3 && TYPOGRAPHY.caption, { color: textSecondary, fontWeight: '500', textAlign: 'center' }]}>
                {t('prediction.learning')}{'\n'}{t('prediction.first')}
              </Text>
            ) : (
              <Text style={[styles.centralHint, fontScale < 1.3 && TYPOGRAPHY.caption, { color: textSecondary }]}>
                {predictionError || t('prediction.ready')}
              </Text>
            )}
        </SleepTimerFace>
      </Animated.View>
    </View>
  );
}

const CentralTimer = React.memo(CentralTimerComponent);

const StatusMetricsBar = ({
  stats,
  selectedDate,
  sleepPrediction,
  activeSleepEntry,
  hasSleepData,
  statsPage,
  onPageChange,
}: StatusMetricsBarProps) => {
  const { fontScale } = useWindowDimensions();
  // Adaptive Farben für Dark Mode
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  const statsPageCount = 3;
  const statsScrollRef = useRef<ScrollView>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const currentTime = new Date(currentTimeMs);

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTimeMs(Date.now()), 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

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
      return { emoji: '💤', label: t('status.sleeping'), color: '#87CEEB' };
    }

    if (!sleepPrediction || !hasSleepData) {
      return { emoji: '🔮', label: t('prediction.learningStatus'), color: '#B0B0B0' };
    }

    if (isNightSleepPrediction(sleepPrediction)) {
      return { emoji: '🌙', label: t('prediction.nightStatus'), color: '#8E4EC6' };
    }

    // Echtzeit-Berechnung: Minuten bis zum empfohlenen Schlafzeitpunkt
    const minutesUntilWindow = Math.round(
      (sleepPrediction.recommendedStart.getTime() - currentTimeMs) / 60000
    );

    if (minutesUntilWindow > 20) {
      return { emoji: '😊', label: t('prediction.rested'), color: '#A8C4A2' };
    }

    if (minutesUntilWindow > 10) {
      return { emoji: '🥱', label: t('status.tiredSoon'), color: '#FF8C42' };
    }

    if (minutesUntilWindow >= -5 && minutesUntilWindow <= 10) {
      return { emoji: '😴', label: t('prediction.putDownNow'), color: '#8E4EC6' };
    }

    return { emoji: '😫', label: t('status.overtired'), color: '#E53E3E' };
  };

  const getReasoningText = (): string => {
    if (activeSleepEntry) {
      const currentHour = currentTime.getHours();
      const isNightNow = currentHour >= 20 || currentHour < 6;

      // Nachtschlaf: keine Nap-Zielzeit anzeigen
      if (activeSleepEntry.period === 'night' || isNightNow) {
        return t('prediction.goodNight');
      }
      // Tagschlaf: verbleibende ideale Schlafdauer
      const target = toOptionalNumber(sleepPrediction?.debug?.targetNapDuration);
      if (target !== null) {
        const elapsed = (currentTimeMs - new Date(activeSleepEntry.start_time).getTime()) / 60000;
        const remaining = Math.round(target - elapsed);
        if (remaining > 0) {
          return t('prediction.idealRemaining', { minutes: remaining });
        }
        return t('prediction.wakingSoon');
      }
      return t('prediction.sleeping');
    }

    if (!sleepPrediction || !sleepPrediction.debug) return t('prediction.noPrediction');
    if (!hasSleepData) return t('prediction.noData');
    if (isNightSleepPrediction(sleepPrediction)) {
      return getBedtimePredictionLabel(sleepPrediction);
    }

    const lastNapDuration = toOptionalNumber(sleepPrediction.debug.lastNapDuration);
    const targetNapDuration = toOptionalNumber(sleepPrediction.debug.targetNapDuration);
    const sleepDebt = toNumber(sleepPrediction.debug.sleepDebt, 0);
    const circadianHour = toOptionalNumber(sleepPrediction.debug.circadianHour);
    const napDurationAdjustment = toNumber(sleepPrediction.debug.napDurationAdjustment, 0);
    const sleepDebtAdjustment = toNumber(sleepPrediction.debug.sleepDebtAdjustment, 0);

    const reasons: string[] = [];

    if (lastNapDuration !== null && targetNapDuration !== null && Math.abs(napDurationAdjustment) > 5) {
      if (napDurationAdjustment > 5) {
        reasons.push(t('prediction.shortNapReason'));
      } else if (napDurationAdjustment < -5) {
        reasons.push(t('prediction.longNapReason'));
      }
    }

    if (Math.abs(sleepDebt) > 30) {
      if (sleepDebtAdjustment < -5) {
        reasons.push(t('prediction.awakeReason'));
      } else if (sleepDebtAdjustment > 5) {
        reasons.push(t('prediction.sleptReason'));
      }
    }

    if (circadianHour !== null && circadianHour >= 16) {
      reasons.push(t('prediction.afternoonReason'));
    }

    if (reasons.length === 0) {
      return t('prediction.normalRhythm');
    }

    return reasons[0];
  };

  const getCountdownText = (): string => {
    if (activeSleepEntry) return t('prediction.sleeping');
    if (!sleepPrediction) return t('prediction.noneShort');
    if (!hasSleepData) return t('prediction.stillLearning');
    if (isNightSleepPrediction(sleepPrediction)) {
      return t('prediction.noMoreNaps');
    }

    const now = new Date();
    const minutesUntil = Math.round((sleepPrediction.recommendedStart.getTime() - now.getTime()) / 60000);

    if (minutesUntil <= 0 && minutesUntil >= -10) {
      return t('prediction.optimalNow');
    }

    if (minutesUntil < -10) {
      return t('prediction.windowMissed');
    }

    if (minutesUntil <= 5) {
      return t('prediction.readyToSleep');
    }

    const hours = Math.floor(minutesUntil / 60);
    const mins = minutesUntil % 60;

    if (hours > 0) {
      return t('prediction.tiredInHours', { hours, minutes: mins });
    }

    return t('prediction.tiredInMinutes', { minutes: mins });
  };

  const getHistoricalText = (): string | null => {
    const historicalSampleCount = sleepPrediction?.debug
      ? toNumber(sleepPrediction.debug.historicalSampleCount, 0)
      : 0;
    if (!sleepPrediction || historicalSampleCount <= 0 || isNightSleepPrediction(sleepPrediction)) {
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

    return t('prediction.history', { duration: timeStr });
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
  const historyText = historicalText ?? t('trend.insufficient');
  const personalizationSamples = sleepPrediction?.debug
    ? toNumber(sleepPrediction.debug.personalizationSampleCount, 0)
    : 0;
  const hasPersonalization = personalizationSamples > 0;
  const confidenceLevel = sleepPrediction ? getConfidenceLevel() : null;
  const confidenceLabel =
    confidenceLevel === 'high'
      ? t('trend.reliable')
      : confidenceLevel === 'medium'
        ? t('prediction.confidenceImproving')
        : t('prediction.learningStatus');
  const confidenceDot =
    confidenceLevel === 'high' ? '🟢' : confidenceLevel === 'medium' ? '🟡' : '⚪';
  const dayLabel = isSameDay(selectedDate, new Date())
    ? t('prediction.today')
    : selectedDate.toLocaleDateString(SLEEP_TRACKER_LOCALE_TAG, { weekday: 'short', day: '2-digit', month: '2-digit' });

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
          <View style={[styles.kpiRow, fontScale >= 1.3 && { flexDirection: 'column' }]}>
            <GlassCard
              style={[styles.kpiCard, fontScale >= 1.3 && { width: '100%' }]}
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
              style={[styles.kpiCard, fontScale >= 1.3 && { width: '100%' }]}
              intensity={20}
              overlayColor="rgba(255, 140, 66, 0.1)"
              borderColor="rgba(255, 140, 66, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="zzz" size={12} color="#FF8C42" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.naps')}</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>{stats.napsCount}</Text>
            </GlassCard>
          </View>

          <View style={[styles.kpiRow, fontScale >= 1.3 && { flexDirection: 'column' }]}>
            <GlassCard
              style={[styles.kpiCard, fontScale >= 1.3 && { width: '100%' }]}
              intensity={20}
              overlayColor="rgba(168, 196, 162, 0.1)"
              borderColor="rgba(168, 196, 162, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="clock.fill" size={12} color="#A8C4A2" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.longest')}</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>{minutesToHMM(stats.longestStretch)}</Text>
            </GlassCard>

            <GlassCard
              style={[styles.kpiCard, fontScale >= 1.3 && { width: '100%' }]}
              intensity={20}
              overlayColor="rgba(255, 155, 155, 0.1)"
              borderColor="rgba(255, 155, 155, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="chart.line.uptrend.xyaxis" size={12} color="#FF9B9B" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.score')}</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>{stats.score}%</Text>
            </GlassCard>
          </View>

        </View>

        <View style={[styles.statsPage, { width: screenWidth }]}>
          <View style={[styles.kpiRow, fontScale >= 1.3 && { flexDirection: 'column' }]}>
            <GlassCard
              style={[styles.kpiCard, styles.kpiCardWide]}
              intensity={20}
              overlayColor="rgba(142, 78, 198, 0.1)"
              borderColor="rgba(142, 78, 198, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="clock.badge" size={12} color="#8E4EC6" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.nextWindow')}</Text>
                {confidenceLevel && (
                  <View style={styles.predictionMetaInline}>
                    <View style={styles.predictionBadge}>
                      <Text style={[styles.predictionBadgeText, { color: textSecondary }]}>
                        {hasPersonalization && confidenceLevel === 'high'
                          ? t('prediction.personalized')
                          : `${confidenceDot} ${confidenceLabel}`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              {sleepPrediction && !activeSleepEntry && hasSleepData ? (
                <>
                  {isNightSleepPrediction(sleepPrediction) ? (
                    <Text style={[styles.kpiValue, styles.kpiValueCentered, { fontSize: 16, color: textPrimary }]}>
                      {getBedtimePredictionLabel(sleepPrediction)}
                    </Text>
                  ) : (
                    <Text style={[styles.kpiValue, styles.kpiValueCentered, { fontSize: 16, color: textPrimary }]}>
                      {sleepPrediction.earliest.toLocaleTimeString(SLEEP_TRACKER_LOCALE_TAG, { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {sleepPrediction.latest.toLocaleTimeString(SLEEP_TRACKER_LOCALE_TAG, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                  <Text style={[styles.kpiSub, { color: textSecondary }]}>{countdownText}</Text>
                </>
              ) : (
                <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>
                  {activeSleepEntry ? '💤' : countdownText}
                </Text>
              )}
            </GlassCard>
          </View>

          <View style={[styles.kpiRow, fontScale >= 1.3 && { flexDirection: 'column' }]}>
            <GlassCard
              style={[styles.kpiCard, fontScale >= 1.3 && { width: '100%' }]}
              intensity={20}
              overlayColor={`${tirednessLevel.color}20`}
              borderColor={`${tirednessLevel.color}40`}
            >
              <View style={styles.kpiHeaderRow}>
                <Text style={{ fontSize: 14 }}>{tirednessLevel.emoji}</Text>
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.tiredness')}</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { fontSize: 14, color: textPrimary }]}>
                {tirednessLevel.label}
              </Text>
            </GlassCard>

            <GlassCard
              style={[styles.kpiCard, fontScale >= 1.3 && { width: '100%' }]}
              intensity={20}
              overlayColor="rgba(168, 196, 162, 0.1)"
              borderColor="rgba(168, 196, 162, 0.25)"
            >
              <View style={styles.kpiHeaderRow}>
                <IconSymbol name="lightbulb.fill" size={12} color="#A8C4A2" />
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.reason')}</Text>
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
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.history')}</Text>
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
                <Text style={[styles.kpiTitle, { color: textSecondary }]}>{t('kpi.nightTotal')}</Text>
              </View>
              <Text style={[styles.kpiValue, styles.kpiValueCentered, { color: textPrimary }]}>
                {minutesToHMM(stats.nightTotalMinutes)}
              </Text>
              <Text style={[styles.kpiSub, { color: textSecondary }]}>
                {stats.nightSegmentCount > 0
                  ? t(stats.nightSegmentCount === 1 ? 'prediction.segmentCount' : 'prediction.segmentCountPlural', { count: stats.nightSegmentCount })
                  : t('prediction.noNightSegments')}
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
    return date.toLocaleTimeString(SLEEP_TRACKER_LOCALE_TAG, { hour: '2-digit', minute: '2-digit' });
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

    const inferredEnd = durationMinutes
      ? new Date(date.getTime() + durationMinutes * 60000)
      : null;

    // Nachtschlaf zuerst prüfen: auch ein kurzes Segment (z.B. 20 Min um 2 Uhr)
    // ist Nachtschlaf und kein Nickerchen.
    // Für längere Einträge zählt auch eine deutliche Überlappung mit dem Nachtfenster,
    // damit ein vor dem Fenster gestarteter Nachtschlaf nach dem Beenden nicht als Tagschlaf verschwindet.
    if (
      getSleepPeriodForEntry(
        {
          start_time: date,
          end_time: inferredEnd,
        },
        nightWindowSettings
      ) === 'night'
    ) {
      return 'nacht';
    }

    // Nickerchen: max 30 Minuten
    if (durationMinutes && durationMinutes <= 30) {
      return 'nickerchen';
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
    const sleepLabels: Record<string, SleepTrackerTranslationKey> = {
      nickerchen: 'type.nap',
      nacht: 'stats.nightSleep',
      mittag: 'type.noonSleep',
      tag: 'stats.daySleep',
    };
    const label = t(sleepLabels[sleepType] ?? 'type.sleep');
    if (!quality) return label;
    return `${label} · ${t(`quality.${quality}` as SleepTrackerTranslationKey)}`;
  };

  // Bestimme Schlaftyp basierend auf Startzeit und Dauer
  const sleepType = getSleepType(sleepEntry.start_time, sleepEntry.duration_minutes);

  const notes = [];
  if (sleepEntry.quality) {
    notes.push(`${t('summary.quality')}: ${t(`quality.${sleepEntry.quality}` as SleepTrackerTranslationKey)}`);
  }
  if (sleepEntry.notes) {
    notes.push(sleepEntry.notes);
  }
  if (sleepEntry.duration_minutes) {
    notes.push(`${t('summary.duration')}: ${formatDuration(sleepEntry.duration_minutes)}`);
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

// LiquidGlassCard imported from DesignGuide

export default function SleepTrackerScreen() {
  ACTIVE_SLEEP_TRACKER_LOCALE = useLocale().locale;
  SLEEP_TRACKER_LOCALE_TAG = getSleepTrackerLocaleTag(ACTIVE_SLEEP_TRACKER_LOCALE);
  const weekdayLabels = getLocalizedWeekdayLabels(SLEEP_TRACKER_LOCALE_TAG);
  // Verwende useAdaptiveColors für korrekte Farben basierend auf Hintergrundbild
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;

  // Dark Mode angepasste Farben
  const textPrimary = isDark ? Colors.dark.textPrimary : '#6B4C3B';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  const modalOverlayColor = isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)';
  // An opaque sheet keeps the timeline and tab bar from bleeding through on Android.

  const modalFieldColor = isDark ? '#2C2C2E' : '#FFFFFF';
  const modalFieldBorderColor = isDark ? '#414144' : '#E8E1DB';
  const modalPickerColor = modalFieldColor;
  const modalQualityDefaultColor = modalFieldColor;
  const modalAccentColor = isDark ? '#A26BFF' : '#8E4EC6';

  const router = useRouter();
  const sleepOffline = useSleepOffline();
  const trackingSync = useTrackingSync();
  const [sleepReadFailed, setSleepReadFailed] = useState(false);
  const [sleepLiveConfirmed, setSleepLiveConfirmed] = useState(false);
  const requestedStop = useRef<{ id: string; at: string } | null>(null);
  const { user } = useAuth();
  const userId = user?.id;
  const { activeBackend } = useBackend();
  const { activeBabyId } = useActiveBaby();
  useEffect(() => { setSleepLiveConfirmed(false); requestedStop.current = null; }, [user?.id, activeBabyId]);

  const { isReadOnlyPreviewMode } = useBabyStatus();
  const sleepService = useSleepEntriesService(user?.id);
  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);
  const showReadOnlyPreviewAlert = useCallback(() => {
    Alert.alert(t('preview.title'), t('preview.message'));
  }, []);
  const ensureWritableInCurrentMode = useCallback(() => {
    if (!isReadOnlyPreviewMode) return true;
    showReadOnlyPreviewAlert();
    return false;
  }, [isReadOnlyPreviewMode, showReadOnlyPreviewAlert]);

  // State management
  const [sleepEntries, setSleepEntries] = useState<ClassifiedSleepEntry[]>([]);
  const sleepEntriesDisplayRef = useRef(sleepEntries); sleepEntriesDisplayRef.current = sleepEntries;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadSleepDataRequestIdRef = useRef(0);
  const loadSleepDataRef = useRef<(() => Promise<void>) | null>(null);
  const sleepDataScopeKey = `${userId ?? ''}|${activeBackend}|${activeBabyId ?? ''}`;
  const sleepDataScopeRef = useRef(sleepDataScopeKey);
  const verifiedSleepScopeRef = useRef('');
  const sleepMutationRef = useRef({ scope: sleepDataScopeKey, pending: 0 });
  const [activeSleepEntry, setActiveSleepEntry] = useState<ClassifiedSleepEntry | null>(null);
  const activeSleepEntryRef = useRef<ClassifiedSleepEntry | null>(null);
  const activeEntryPeriodOverridesRef = useRef<Record<string, SleepPeriod>>({});
  const [pausedNightState, setPausedNightState] = useState<PausedNightState | null>(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const historyCutoff = useHistoryCutoff();
  const monthViewAccess = useFeatureAccess('sleepMonthView');
  const isMonthViewLocked = monthViewAccess.hasAccess === false;
  const visibleTab = selectedTab === 'month' && isMonthViewLocked ? 'day' : selectedTab;
  const [editingEntry, setEditingEntry] = useState<ClassifiedSleepEntry | null>(null);
  const hasAutoSelectedDateRef = useRef(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Navigation offsets für Woche und Monat
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = diese Woche, -1 = letzte, +1 = nächste
  const [monthOffset, setMonthOffset] = useState(0); // 0 = dieser Monat, -1 = vorheriger, +1 = nächster
  const selectTab = useCallback((tab: 'day' | 'week' | 'month') => {
    setSelectedTab(tab);
    setWeekOffset(0);
    setMonthOffset(0);
  }, []);
  const showMonthViewLockedAlert = useCallback(() => {
    Alert.alert(t('view.monthLockedTitle'), t('view.monthLockedBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('view.monthLockedAction'),
        onPress: () => router.push('/paywall?origin=lock_sleepMonthView' as any),
      },
    ]);
  }, [router]);

  useEffect(() => {
    // Wird die Policy im Hintergrund aktualisiert, darf eine bereits geöffnete
    // Monatsansicht nicht bis zum nächsten Tab-Wechsel sichtbar bleiben.
    if (selectedTab === 'month' && isMonthViewLocked) {
      const normalizationTimer = setTimeout(() => selectTab('day'), 0);
      return () => clearTimeout(normalizationTimer);
    }
  }, [isMonthViewLocked, selectTab, selectedTab]);
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

  const refreshNightWindowSettings = useCallback(async () => {
    try {
      const loaded = await loadNightWindowSettings(userId);
      setNightWindowSettings(loaded);
    } catch (error) {
      console.error('Failed to load night window settings:', error);
      setNightWindowSettings(DEFAULT_NIGHT_WINDOW_SETTINGS);
    }
  }, [userId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refreshNightWindowSettings();
    }, 0);
    return () => clearTimeout(timeoutId);
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
  const splashAnim = React.useState(() => new Animated.Value(0))[0];
  const splashEmojiAnim = React.useState(() => new Animated.Value(0.9))[0];
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
  const handledLivePauseRequestIdRef = useRef(0);
  const [livePauseRequestId, setLivePauseRequestId] = useState(0);
  const handledAutoStartRequestIdRef = useRef(0);
  const [autoStartRequestId, setAutoStartRequestId] = useState(0);

  const queueLiveStopRequestFromUrl = useCallback((incomingUrl: string | null) => {
    if (!incomingUrl) return;

    const targetsSleepTracker = incomingUrl.toLowerCase().includes('sleep-tracker');
    if (!targetsSleepTracker) return;

    const hasLiveStopParam = /[?&]liveStop=(1|true)(?:&|$)/i.test(incomingUrl);
    const hasLivePauseParam = /[?&]livePause=(1|true)(?:&|$)/i.test(incomingUrl);
    const hasAutoStartParam = /[?&]autoStart=(1|true)(?:&|$)/i.test(incomingUrl);

    if (!hasLiveStopParam && !hasLivePauseParam && !hasAutoStartParam) {
      return;
    }

    const now = Date.now();
    const lastEvent = lastLiveStopEventRef.current;
    if (lastEvent && lastEvent.url === incomingUrl && now - lastEvent.at < 1500) {
      return;
    }

    lastLiveStopEventRef.current = { url: incomingUrl, at: now };

    if (hasLivePauseParam) {
      setLivePauseRequestId((prev) => prev + 1);
    } else if (hasLiveStopParam) {
      setLiveStopRequestId((prev) => prev + 1);
    } else if (hasAutoStartParam) {
      setAutoStartRequestId((prev) => prev + 1);
    }
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
    setNotesOverlayVisible(false);
    setNotesOverlayValue('');
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
    const startCandidate = sanitizeManualDate(new Date(entry.start_time), new Date());
    const endCandidate = entry.end_time
      ? sanitizeManualDate(new Date(entry.end_time), startCandidate)
      : null;
    setEditingEntry(entry);
    setShowStartPicker(false);
    setShowEndPicker(false);
    setSleepModalData({
      start_time: startCandidate,
      end_time: endCandidate && endCandidate.getTime() <= startCandidate.getTime() ? null : endCandidate,
      quality: entry.quality || null,
      notes: entry.notes || '',
    });
    setShowInputModal(true);
  }, [ensureWritableInCurrentMode, sanitizeManualDate]);

  // Animation refs
  const pulseAnim = React.useState(() => new Animated.Value(1))[0];
  const appearAnim = React.useState(() => new Animated.Value(0))[0];

  const invalidateSleepDataRequests = useCallback(() => {
    loadSleepDataRequestIdRef.current += 1;
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  // A read from another account/baby must never become this screen's timer.
  useEffect(() => {
    sleepDataScopeRef.current = sleepDataScopeKey;
    verifiedSleepScopeRef.current = '';
    sleepMutationRef.current = { scope: sleepDataScopeKey, pending: 0 };
    invalidateSleepDataRequests();
    // Only a new scope hides empty hints until its first server read settles.
    setIsLoading(true);
    activeSleepEntryRef.current = null;
    activeEntryPeriodOverridesRef.current = {};
    hasAutoSelectedDateRef.current = false;
    setActiveSleepEntry(null);
    setSleepEntries([]);
    setPausedNightState(null);
    setIsLiveStatusLoaded(false);
    setIsStartingSleep(false);
    setIsStoppingSleep(false);
    setIsSplittingSegment(false);
    return () => {
      sleepDataScopeRef.current = '';
      loadSleepDataRequestIdRef.current += 1;
    };
  }, [invalidateSleepDataRequests, sleepDataScopeKey]);

  const beginSleepMutation = useCallback(() => {
    const mutations = sleepMutationRef.current;
    const scope = sleepDataScopeKey;
    mutations.pending += 1;
    invalidateSleepDataRequests();
    let finished = false;
    return {
      isCurrentScope: () => sleepDataScopeRef.current === scope && sleepMutationRef.current === mutations,
      finish: () => {
        if (finished) return false;
        finished = true;
        mutations.pending -= 1;
        if (sleepMutationRef.current === mutations) invalidateSleepDataRequests();
        return true;
      },
    };
  }, [invalidateSleepDataRequests, sleepDataScopeKey]);

  useEffect(() => {
    activeSleepEntryRef.current = activeSleepEntry;
  }, [activeSleepEntry]);

  useEffect(() => {
    if (activeSleepEntry) {
      const timeoutId = setTimeout(() => setPausedNightState(null), 0);
      return () => clearTimeout(timeoutId);
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
    const timeoutId = setTimeout(() => {
      void refreshPartnerId();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [refreshPartnerId]);

  useEffect(() => {
    if (!userId) return;

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
  }, [userId, activeBabyId]);

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
      if (!userId) {
        setSleepPrediction(null);
        predictionRef.current = null;
        setPredictionLoading(false);
        return;
      }

      setPredictionLoading(true);
      try {
        const prediction = await predictNextSleepWindow({
          userId,
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
        setPredictionError(t('prediction.unavailable'));
      } finally {
        setPredictionLoading(false);
      }
    },
    [userId, activeBabyId, babyBirthdate, babyBedtime]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void updateSleepPrediction(sleepEntries);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [sleepEntries, updateSleepPrediction]);

  // Keep prediction in sync with notification engine (which refreshes every 5 minutes in _layout)
  useEffect(() => {
    const interval = setInterval(() => {
      updateSleepPrediction(sleepEntries);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [sleepEntries, updateSleepPrediction]);

  // Home-Screen-Widget nachziehen, sobald sich Einträge oder Vorhersage ändern.
  // Ohne das hinge das Widget bis zum nächsten 5-Minuten-Lauf in app/_layout.tsx
  // hinterher — beim Starten und Stoppen eines Schlafs die auffälligste Stelle.
  useEffect(() => {
    if (SLEEP_OFFLINE_ENABLED || !activeBabyId) return;
    void syncSleepWidget(sleepEntries, {
      prediction: sleepPrediction,
      locale: ACTIVE_SLEEP_TRACKER_LOCALE,
      babyName: babyName ?? null,
      nightWindowSettings,
    });
  }, [activeBabyId, babyName, nightWindowSettings, sleepEntries, sleepPrediction]);

  useEffect(() => {
    if (SLEEP_OFFLINE_ENABLED || !isLiveStatusLoaded || !sleepLiveConfirmed || !sleepActivityService.isLiveActivitySupported()) {
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
    if (SLEEP_OFFLINE_ENABLED || !isLiveStatusLoaded || !activeSleepEntry?.start_time) {
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
    const isActive = !entry.end_time;
    let period = forcedPeriod ?? (entry.local_period === 'night' || entry.local_period === 'day' ? entry.local_period : getSleepPeriodForEntry(entry, nightWindowSettings));

    if (!forcedPeriod && isActive && period === 'day') {
      const activeNightWindowKey = getNightWindowKeyForEntry(entry, nightWindowSettings);
      if (activeNightWindowKey) {
        period = 'night';
      }
    }

    return {
      ...entry,
      period,
      isActive
    };
  }, [nightWindowSettings]);
  const classifySleepEntryRef = useRef(classifySleepEntry);
  const nightWindowSettingsRef = useRef(nightWindowSettings);

  useEffect(() => {
    classifySleepEntryRef.current = classifySleepEntry;
    nightWindowSettingsRef.current = nightWindowSettings;
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
  }, [classifySleepEntry, nightWindowSettings]);

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
          if (SLEEP_OFFLINE_ENABLED) return { success: true, entries: result.data };
          const subMinuteEntries = result.data.filter((entry) => isSubMinuteFinishedSleepEntry(entry) && !sleepOffline.actions.some(action => action.originalEntryId === entry.id && !['confirmed','discarded'].includes(action.state)));

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
                ownEntryIdsToDelete.map((entryId) => sleepService.deleteEntry(entryId, sleepEntries.find(e => e.id === entryId)))
              );

              const failedDeletes = deleteResults.filter((deleteResult) => deleteResult.primary.error);
              if (failedDeletes.length > 0) {
                console.warn(
                  `[SleepTracker] Failed to auto-delete ${failedDeletes.length} sub-minute sleep entries from Supabase.`
                );
              }
            }
          }

          const cleanedEntries = result.data.filter((entry) => !isSubMinuteFinishedSleepEntry(entry) || sleepOffline.actions.some(action => action.originalEntryId === entry.id));
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
    [activeBackend, sleepService, user?.id, sleepOffline.enabled]
  );

  // Timer and history must describe the same fresh server snapshot. A failed
  // read preserves the previous display; a successful empty/ended read clears it.
  async function loadSleepData() {
    if (sleepDataScopeRef.current !== sleepDataScopeKey || sleepMutationRef.current.pending > 0) return;
    const requestId = loadSleepDataRequestIdRef.current + 1;
    loadSleepDataRequestIdRef.current = requestId;
    const isLatestRequest = () =>
      loadSleepDataRequestIdRef.current === requestId &&
      sleepDataScopeRef.current === sleepDataScopeKey;
    const canCommit = () => isLatestRequest() && sleepMutationRef.current.pending === 0;

    // Background reloads keep the current UI; toggling isLoading here made the
    // empty hints flash on every focus/sync refresh.
    try {
      const result = await loadVisibleSleepEntries(activeBabyId ?? undefined);
      if (!canCommit()) return;
      if (!result.success || !Array.isArray(result.entries)) {
        throw new Error('error' in result && typeof result.error === 'string'
          ? result.error
          : t('alert.loadHistoryFailed'));
      }

      const localOperations = userId ? await readTrackingOutbox(userId) : [];
      if (!canCommit()) return;
      const visibleEntries = pendingSleepOverlay<(typeof result.entries)[number]>(overlayTrackingRows<(typeof result.entries)[number]>('sleep',result.entries,localOperations,activeBabyId), sleepOffline.actions);
      const active = findFreshActiveSleepEntry<(typeof visibleEntries)[number]>(visibleEntries);
      let periodOverride = active?.id ? activeEntryPeriodOverridesRef.current[active.id] : undefined;
      if (active && !periodOverride) {
        periodOverride = await loadStoredActiveSleepPeriodOverride(active) ?? undefined;
      }
      // Storage reads can also finish after a stop, a newer load or a baby switch.
      if (!canCommit()) return;

      // Use the current settings even if this read began before they loaded.
      const classify = classifySleepEntryRef.current;
      const activeSleep = active ? classify(active, periodOverride) : null;
      const finishedEntries = visibleEntries
        .filter((entry) => entry.end_time)
        .map((entry) => classify(entry));
      const allEntries = activeSleep ? [activeSleep, ...finishedEntries] : finishedEntries;

      activeEntryPeriodOverridesRef.current = active?.id && periodOverride
        ? { [active.id]: periodOverride }
        : {};
      // An unchanged snapshot keeps the current objects, so repeated refreshes
      // (own reload after a delete plus the realtime echo) cost no re-render,
      // no prediction rerun and no restarted card animations.
      const previousEntries = sleepEntriesDisplayRef.current;
      const entriesUnchanged = previousEntries.length === allEntries.length
        && JSON.stringify(previousEntries) === JSON.stringify(allEntries);
      const nextEntries = entriesUnchanged ? previousEntries : allEntries;
      const nextActive = activeSleep && entriesUnchanged ? nextEntries[0] : activeSleep;
      activeSleepEntryRef.current = nextActive;
      setActiveSleepEntry(nextActive);
      setSleepEntries(nextEntries);
      setIsLiveStatusLoaded(true);
      setSleepLiveConfirmed(true);
      verifiedSleepScopeRef.current = sleepDataScopeKey;
      sleepEntriesDisplayRef.current = nextEntries;
      setSleepReadFailed(false);
      // No auto-jump to the latest entry's day: the view stays on the day the
      // user is looking at, and an empty today offers "Zum letzten Eintrag".
    } catch (error) {
      if (!isLatestRequest()) return;
      console.error('Failed to load sleep data:', error);
      setPredictionLoading(false);
      setSleepReadFailed(true);
    } finally {
      if (isLatestRequest()) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }
  useEffect(() => {
    loadSleepDataRef.current = loadSleepData;
  }, [loadSleepData]);

  useEffect(() => {
    if (!trackingSync.ready || !user?.id || !activeBabyId || SLEEP_OFFLINE_ENABLED) return;
    const key = sleepDataScopeKey; let alive = true;
    void (async () => {
      const cached = await readSnapshot(trackingScope(user.id,activeBabyId),'tracking-sleep',validRows);
      const operations = await readTrackingOutbox(user.id);
      if (!alive || sleepDataScopeRef.current !== key) return;
      const current = sleepEntriesDisplayRef.current;
      const verified = verifiedSleepScopeRef.current === key;
      const base = current.length || verified ? current : cached?.data ?? [];
      const projected = overlayTrackingRows('sleep',base,operations,activeBabyId,verified ? undefined : cached?.verifiedAt ?? '').map(row => classifySleepEntry(row as any));
      // Outbox changes (e.g. a queued delete) often project the same list;
      // keeping the current objects avoids a needless full re-render.
      const unchanged = current.length === projected.length && JSON.stringify(current) === JSON.stringify(projected);
      if (!unchanged) {
        const active = findFreshActiveSleepEntry(projected);
        activeSleepEntryRef.current = active; setActiveSleepEntry(active); setSleepEntries(projected);
      }
      // Local hydration releases the start buttons even with an empty cached history.
      setIsLiveStatusLoaded(true);
      if (operations.some(op => op.kind === 'sleep' && op.scope.babyId === activeBabyId && op.state === 'confirmed')) void loadSleepDataRef.current?.();
    })().catch(() => {});
    return () => { alive = false; };
  }, [trackingSync.operations, trackingSync.ready, activeBabyId, sleepDataScopeKey]);

  useEffect(() => {
    const known = sleepOffline.knownActive;
    if (!sleepLiveConfirmed && known && known.entry.baby_id === activeBabyId) {
      const visible = pendingSleepOverlay([known.entry],sleepOffline.actions);
      const active = visible.find(entry => !entry.end_time);
      const classified = active ? classifySleepEntry(active as any) : null;
      activeSleepEntryRef.current = classified; setActiveSleepEntry(classified);
    }
    const pendingIds = new Set(sleepOffline.actions.filter(action => !['confirmed','discarded'].includes(action.state)).map(action => action.originalEntryId));
    setActiveSleepEntry(current => current?.id && pendingIds.has(current.id) ? null : current);
    if (activeSleepEntryRef.current?.id && pendingIds.has(activeSleepEntryRef.current.id)) activeSleepEntryRef.current = null;
    setSleepEntries(entries => pendingSleepOverlay(entries,sleepOffline.actions).map(entry => classifySleepEntry(entry)));
    if (sleepOffline.actions.some(action => ['confirmed','discarded'].includes(action.state))) void loadSleepDataRef.current?.();
  }, [sleepOffline.actions, sleepOffline.knownActive, activeBabyId]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSleepData();
  };

  const refreshSleepData = useCallback(async () => {
    await loadSleepDataRef.current?.();
  }, []);
  const visibleSleepEntryIds = useMemo(
    () => sleepEntries.flatMap((entry) => entry.id ? [entry.id] : []),
    [sleepEntries]
  );
  useSleepEntriesSync({
    userId,
    babyId: activeBabyId,
    enabled: activeBackend === 'supabase',
    entryIds: visibleSleepEntryIds,
    activeEntryId: activeSleepEntry?.id,
    onRefresh: refreshSleepData,
    onInvalidate: invalidateSleepDataRequests,
  });

  const applyNightQualityToSession = useCallback(async (
    quality: NonNullable<SleepQuality>,
    referenceDate: Date,
    excludedEntryIds: string[] = [],
  ) => {
    if (!sleepService || SLEEP_OFFLINE_ENABLED) return { updated: 0, failed: 0 };

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

      const result = await sleepService.updateEntry(entryId, { quality }, segment);

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
  }, [nightWindowSettings, sleepEntries, sleepService, sleepOffline.enabled]);

  // Start sleep tracking
  const handleStartSleep = async (period: SleepPeriod) => {
    if (!ensureWritableInCurrentMode()) return false;
    if (isStartingSleep || activeSleepEntryRef.current) return false;
    if (!user?.id || !sleepService) {
      Alert.alert(t('common.error'), t('alert.serviceUnavailable'));
      return false;
    }

    setIsStartingSleep(true);
    const mutation = beginSleepMutation();
    try {
      const effectivePartnerId = activeBabyId && localHealthAllowed(user.id) && !SLEEP_OFFLINE_ENABLED ? partnerId : await getEffectivePartnerId();
      if (!mutation.isCurrentScope()) return false;
      const now = new Date();
      const startTime = now.toISOString();

      // Dual-write to both backends (completely separate, no sync)
      const result = await sleepService.createEntry({
        user_id: user.id,
        local_period: period,
        baby_id: activeBabyId ?? null,
        start_time: startTime,
        end_time: null, // Active sleep has no end time yet
        quality: null,
        notes: null,
        duration_minutes: null,
        partner_id: effectivePartnerId ?? null,
      });
      if (!mutation.isCurrentScope()) return false;

      if (result.primary.error) {
        console.error('❌ Start sleep error:', result.primary.error);
        Alert.alert(t('common.error'), saveErrorMessage(result.primary.error, ACTIVE_SLEEP_TRACKER_LOCALE, t('alert.startFailed')));
        return false;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend write failed:', result.secondary.error);
      }

      // Commit the confirmed write before reminder/storage work can yield to an
      // older read. Reads started during the write are invalidated by finish().
      const entry = result.primary.data!;
      if (period === 'night') {
        activeEntryPeriodOverridesRef.current[entry.id] = period;
      } else {
        delete activeEntryPeriodOverridesRef.current[entry.id];
      }
      const classifiedEntry = classifySleepEntry(entry, period === 'night' ? period : undefined);
      activeSleepEntryRef.current = classifiedEntry;
      setActiveSleepEntry(classifiedEntry);
      setSleepEntries((prevEntries) => [
        classifiedEntry,
        ...prevEntries.filter((existingEntry) => existingEntry.id !== classifiedEntry.id),
      ]);
      setIsLiveStatusLoaded(true);
      hasAutoSelectedDateRef.current = true;
      selectTab('day');
      setSelectedDate(getAssignedDateForEntry(classifiedEntry, nightWindowSettings));
      mutation.finish();
      await rememberActiveSleepPeriodOverride(entry.id, period, entry.start_time);
      if (!mutation.isCurrentScope()) return true;
      if (entry.local_pending) {
        void cancelLocalSleepWindowReminders().catch(() => {});
        showSuccessSplash('#87CEEB', period === 'night' ? '🌙' : '😴', period === 'night' ? 'sleep_start_night' : 'sleep_start_day');
        return true;
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
      if (!mutation.isCurrentScope()) return true;

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
          if (mutation.isCurrentScope()) {
            predictionRef.current = null;
            setSleepPrediction(null);
            setPredictionError(null);
            setPredictionLoading(true);
          }
        }
      }
      if (!mutation.isCurrentScope()) return true;

      // Invalidate cache and reload
      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
      if (!mutation.isCurrentScope()) return true;

      // Splash anzeigen
      // Function declaration is intentionally hoisted; this handler only runs after user interaction.
      // eslint-disable-next-line react-hooks/immutability
      showSuccessSplash(
        '#87CEEB', // Baby blue
        period === 'night' ? '🌙' : '😴',
        period === 'night' ? 'sleep_start_night' : 'sleep_start_day'
      );
      return true;
    } catch (error) {
      console.error('❌ Unexpected start sleep error:', error);
      Alert.alert(t('common.error'), saveErrorMessage(error, ACTIVE_SLEEP_TRACKER_LOCALE, t('alert.unexpectedStart')));
      return false;
    } finally {
      if (mutation.isCurrentScope()) setIsStartingSleep(false);
      if (mutation.finish() && mutation.isCurrentScope()) void loadSleepDataRef.current?.();
    }
  };

  // Stop sleep tracking
  const handleStopSleep = async (quality: NonNullable<SleepQuality>, notes?: string, request?: { id: string; at: string }) => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeSleepEntry?.id || isStoppingSleep || !sleepService || request && request.id !== activeSleepEntry.id) return;
    if (!SLEEP_OFFLINE_ENABLED && trackingSync.ready && user?.id && activeBabyId && localHealthAllowed(user.id)) {
      const original = activeSleepEntry; const mutation = beginSleepMutation(); setIsStoppingSleep(true);
      try {
        const stored = requestedStop.current;
        const at = request?.at ?? (stored && stored.id === original.id ? stored.at : new Date().toISOString());
        const durationMs = Math.max(0, Date.parse(at)-new Date(original.start_time).getTime());
        const duration = Math.round(durationMs/60000); const short = durationMs < MIN_PERSISTED_SLEEP_DURATION_MS;
        await queueTrackingUpdate('sleep',trackingScope(user.id,activeBabyId),original.id!,{ end_time: at, duration_minutes: duration, quality, notes: notes ?? original.notes ?? null }, original as any, short);
        if (!mutation.isCurrentScope()) return;
        requestedStop.current = null; activeSleepEntryRef.current = null; setActiveSleepEntry(null); setPausedNightState(null);
        setSleepEntries(rows => short ? rows.filter(row=>row.id!==original.id) : rows.map(row=>row.id===original.id ? classifySleepEntry({...row,end_time:at,duration_minutes:duration,quality,notes:notes ?? original.notes ?? null,local_pending:true} as any) : row));
        void sleepActivityService.endAllSleepActivities().catch(() => {});
      } catch { Alert.alert(t('common.error'),offlineText(ACTIVE_SLEEP_TRACKER_LOCALE,'storageError')); }
      finally { mutation.finish(); if (mutation.isCurrentScope()) setIsStoppingSleep(false); }
      return;
    }
    if (sleepOffline.enabled) {
      const original = activeSleepEntry;
      const storedRequest = requestedStop.current;
      const at = request?.at ?? (storedRequest && storedRequest.id === original.id ? storedRequest.at : new Date().toISOString());
      setIsStoppingSleep(true);
      const mutation = beginSleepMutation();
      try {
        const saved = await sleepOffline.stop(original,at,quality,notes ?? original.notes ?? null);
        if (requestedStop.current && requestedStop.current.id === original.id && requestedStop.current.at === at) requestedStop.current = null;
        if (!mutation.isCurrentScope()) return;
        activeSleepEntryRef.current = null; setActiveSleepEntry(null); setPausedNightState(null);
        setSleepEntries(entries => entries.map(entry => entry.id === original.id ? classifySleepEntry({ ...entry,end_time:saved.chosenStopAt,duration_minutes:Math.max(0,Math.round((Date.parse(saved.chosenStopAt)-new Date(original.start_time).getTime())/60000)) }) : entry));
      } catch (error) { Alert.alert(t('common.error'), offlineText(ACTIVE_SLEEP_TRACKER_LOCALE, (error as Error)?.message === 'Original sleep is unavailable' ? 'unavailable' : (error as Error)?.message === 'No matching active snapshot' ? 'localTimer' : 'storageError')); }
      finally { mutation.finish(); if (mutation.isCurrentScope()) setIsStoppingSleep(false); }
      return;
    }
    setIsStoppingSleep(true);
    const mutation = beginSleepMutation();

    try {
      const endTime = new Date();
      const startTime = new Date(activeSleepEntry.start_time);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      if (durationMs < MIN_PERSISTED_SLEEP_DURATION_MS) {
        const deleteResult = await sleepService.deleteEntry(activeSleepEntry.id, activeSleepEntry);
        if (!mutation.isCurrentScope()) return;
        if (deleteResult.primary.error) {
          console.error('❌ Delete sub-minute sleep error:', deleteResult.primary.error);
          Alert.alert(t('common.error'), t('alert.shortDeleteFailed'));
          return;
        }

        if (deleteResult.secondary.error) {
          console.warn('[SleepTracker] Secondary backend delete failed:', deleteResult.secondary.error);
        }

        activeSleepEntryRef.current = null;
        setActiveSleepEntry(null);
        setSleepEntries((entries) => entries.filter((entry) => entry.id !== activeSleepEntry.id));
        setPausedNightState(null);
        mutation.finish();

        try {
          await sleepActivityService.endAllSleepActivities();
        } catch (liveActivityError) {
          console.error('Failed to end sleep live activity after deleting sub-minute entry:', liveActivityError);
        }
        if (!mutation.isCurrentScope()) return;

        delete activeEntryPeriodOverridesRef.current[activeSleepEntry.id];
        await forgetActiveSleepPeriodOverride(activeSleepEntry.id);
        if (!mutation.isCurrentScope()) return;

        Alert.alert(t('common.notice'), t('alert.shortDeleted'));

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
      }, activeSleepEntry);
      if (!mutation.isCurrentScope()) return;

      if (result.primary.error) {
        console.error('❌ Stop sleep error:', result.primary.error);
        Alert.alert(t('common.error'), t('alert.stopFailed'));
        return;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
      }

      activeSleepEntryRef.current = null;
      setActiveSleepEntry(null);
      setPausedNightState(null);
      setSleepEntries((entries) => entries.map((entry) => entry.id === activeSleepEntry.id
        ? classifySleepEntry({ ...entry, ...result.primary.data, end_time: endTime.toISOString() })
        : entry));
      mutation.finish();

      if (activeSleepEntry.period === 'night') {
        const propagated = await applyNightQualityToSession(quality, startTime, [activeSleepEntry.id]);
        if (!mutation.isCurrentScope()) return;
        if (propagated.failed > 0) {
          Alert.alert(t('common.notice'), t('alert.qualitySegments'));
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
      if (!mutation.isCurrentScope()) return;

      delete activeEntryPeriodOverridesRef.current[activeSleepEntry.id];
      await forgetActiveSleepPeriodOverride(activeSleepEntry.id);
      if (!mutation.isCurrentScope()) return;

      const splashKind = quality === 'good' ? 'sleep_stop_good' : quality === 'bad' ? 'sleep_stop_bad' : 'sleep_stop_medium';
      const splashColor = QUALITY_VISUALS[quality].color;
      const splashEmoji = QUALITY_VISUALS[quality].emoji;
      showSuccessSplash(splashColor, splashEmoji, splashKind);

      // Invalidate cache because stopped sleep now appears in history
      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Unexpected stop sleep error:', error);
      Alert.alert(t('common.error'), t('alert.unexpectedStop'));
    } finally {
      if (mutation.isCurrentScope()) setIsStoppingSleep(false);
      if (mutation.finish() && mutation.isCurrentScope()) void loadSleepDataRef.current?.();
    }
  };

  const handlePauseNightSleep = async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeSleepEntry?.id || isStoppingSleep || !sleepService) return;

    const activeStart = new Date(activeSleepEntry.start_time);
    if (activeSleepEntry.period !== 'night') {
      Alert.alert(t('common.notice'), t('alert.pauseNightOnly'));
      return;
    }

    setIsStoppingSleep(true);
    const mutation = beginSleepMutation();
    try {
      const pausedAt = new Date();
      const durationMs = pausedAt.getTime() - activeStart.getTime();
      if (durationMs < MIN_PERSISTED_SLEEP_DURATION_MS) {
        Alert.alert(t('common.wait'), t('alert.pauseTooSoon'));
        return;
      }
      const durationMinutes = Math.max(
        0,
        Math.round(durationMs / 60000)
      );

      const result = await sleepService.updateEntry(activeSleepEntry.id, {
        end_time: pausedAt.toISOString(),
        duration_minutes: durationMinutes,
      }, activeSleepEntry);
      if (!mutation.isCurrentScope()) return;

      if (result.primary.error) {
        console.error('❌ Pause night sleep error:', result.primary.error);
        Alert.alert(t('common.error'), t('alert.pauseFailed'));
        return;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
      }

      setPausedNightState({
        lastPausedEntryId: activeSleepEntry.id,
        pausedAt: pausedAt.toISOString(),
      });
      activeSleepEntryRef.current = null;
      setActiveSleepEntry(null);
      setSleepEntries((entries) => entries.map((entry) => entry.id === activeSleepEntry.id
        ? classifySleepEntry({ ...entry, ...result.primary.data, end_time: pausedAt.toISOString() })
        : entry));
      mutation.finish();

      if (result.primary.data?.local_pending) {
        void sleepActivityService.endAllSleepActivities().catch(() => {});
        delete activeEntryPeriodOverridesRef.current[activeSleepEntry.id];
        void forgetActiveSleepPeriodOverride(activeSleepEntry.id).catch(() => {});
        showSuccessSplash('#F2C78A', '⏸️', 'sleep_pause_night');
        return;
      }
      try {
        if (!SLEEP_OFFLINE_ENABLED) await sleepActivityService.endAllSleepActivities();
      } catch (liveActivityError) {
        console.error('Failed to pause sleep live activity:', liveActivityError);
      }
      if (!mutation.isCurrentScope()) return;

      delete activeEntryPeriodOverridesRef.current[activeSleepEntry.id];
      await forgetActiveSleepPeriodOverride(activeSleepEntry.id);
      if (!mutation.isCurrentScope()) return;

      showSuccessSplash('#F2C78A', '⏸️', 'sleep_pause_night');

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Unexpected pause sleep error:', error);
      Alert.alert(t('common.error'), t('alert.unexpectedPause'));
    } finally {
      if (mutation.isCurrentScope()) setIsStoppingSleep(false);
      if (mutation.finish() && mutation.isCurrentScope()) void loadSleepDataRef.current?.();
    }
  };

  const handleResumeNightSleep = async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (!pausedNightState || activeSleepEntry || isStartingSleep) return;
    const scope = sleepDataScopeKey;
    const mutations = sleepMutationRef.current;
    const started = await handleStartSleep('night');
    if (started && sleepDataScopeRef.current === scope && sleepMutationRef.current === mutations) {
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
      }, sleepEntries.find(e => e.id === pausedNightState.lastPausedEntryId));

      if (result.primary.error) {
        console.error('❌ Finalize paused night error:', result.primary.error);
        Alert.alert(t('common.error'), t('alert.finishFailed'));
        return;
      }

      if (result.secondary.error) {
        console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
      }

      const referenceDate = pausedNightState.pausedAt ? new Date(pausedNightState.pausedAt) : new Date();
      const propagated = await applyNightQualityToSession(quality, referenceDate, [pausedNightState.lastPausedEntryId]);
      if (propagated.failed > 0) {
        Alert.alert(t('common.notice'), t('alert.qualitySegments'));
      }

      setPausedNightState(null);

      const splashKind =
        quality === 'good' ? 'sleep_stop_good' : quality === 'bad' ? 'sleep_stop_bad' : 'sleep_stop_medium';
      showSuccessSplash(QUALITY_VISUALS[quality].color, QUALITY_VISUALS[quality].emoji, splashKind);

      if (result.primary.data?.local_pending) return;
      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Unexpected finalize paused night error:', error);
      Alert.alert(t('common.error'), t('alert.unexpectedFinish'));
    } finally {
      setIsStoppingSleep(false);
    }
  };

  // Refs auf die neuesten Handler: die Handler selbst sind nicht memoized (neue
  // Identität pro Render). Effects/Callbacks greifen über die Refs zu, damit sie
  // die Funktionen nicht in ihren Dependency-Arrays brauchen und nicht bei jedem
  // Render neu laufen (gleiches Muster wie loadSleepDataRef).
  const handleStartSleepRef = useRef(handleStartSleep);
  const handleStopSleepRef = useRef(handleStopSleep);
  const handlePauseNightSleepRef = useRef(handlePauseNightSleep);
  const handleFinalizePausedNightRef = useRef(handleFinalizePausedNight);
  useEffect(() => {
    handleStartSleepRef.current = handleStartSleep;
    handleStopSleepRef.current = handleStopSleep;
    handlePauseNightSleepRef.current = handlePauseNightSleep;
    handleFinalizePausedNightRef.current = handleFinalizePausedNight;
  }, [handleFinalizePausedNight, handlePauseNightSleep, handleStartSleep, handleStopSleep]);

  const promptSleepQualityForStop = useCallback(() => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeSleepEntry?.id || isStoppingSleep) return;
    const isNightStop = activeSleepEntry.period === 'night';
    const request = requestedStop.current?.id === activeSleepEntry.id ? requestedStop.current : { id: activeSleepEntry.id, at: new Date().toISOString() };
    requestedStop.current = request;
    const cancelRequest = () => { if (requestedStop.current === request) requestedStop.current = null; };

    Alert.alert(
      isNightStop ? t('quality.dialogNightTitle') : t('quality.dialogTitle'),
      (isNightStop ? t('quality.dialogNightQuestion') : t('quality.dialogQuestion')) + (sleepOffline.enabled ? '\n\n' + offlineText(ACTIVE_SLEEP_TRACKER_LOCALE, 'stopExplain') : ''),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: cancelRequest },
        { text: t('quality.bad'), onPress: () => void handleStopSleepRef.current('bad', undefined, request) },
        { text: t('quality.medium'), onPress: () => void handleStopSleepRef.current('medium', undefined, request) },
        { text: t('quality.good'), onPress: () => void handleStopSleepRef.current('good', undefined, request) },
      ],
      { cancelable: true, onDismiss: cancelRequest }
    );
  }, [activeSleepEntry?.id, activeSleepEntry?.period, ensureWritableInCurrentMode, isStoppingSleep, sleepOffline.enabled]);

  const promptSleepQualityForFinalizePausedNight = useCallback(() => {
    if (!ensureWritableInCurrentMode()) return;
    if (!pausedNightState?.lastPausedEntryId || isStoppingSleep) return;

    Alert.alert(
      t('quality.dialogNightTitle'),
      t('quality.dialogNightQuestion') + (SLEEP_OFFLINE_ENABLED ? '\n\n' + offlineText(ACTIVE_SLEEP_TRACKER_LOCALE,'stopExplain') : ''),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('quality.bad'), onPress: () => void handleFinalizePausedNightRef.current('bad') },
        { text: t('quality.medium'), onPress: () => void handleFinalizePausedNightRef.current('medium') },
        { text: t('quality.good'), onPress: () => void handleFinalizePausedNightRef.current('good') },
      ],
      { cancelable: true }
    );
  }, [ensureWritableInCurrentMode, isStoppingSleep, pausedNightState?.lastPausedEntryId]);

  useEffect(() => {
    if (liveStopRequestId === 0) return;
    if (handledLiveStopRequestIdRef.current === liveStopRequestId) return;
    if (!isLiveStatusLoaded) return;

    handledLiveStopRequestIdRef.current = liveStopRequestId;
    if (SLEEP_OFFLINE_ENABLED) { Alert.alert(t('common.notice'), offlineText(ACTIVE_SLEEP_TRACKER_LOCALE, 'nativeReview')); return; }

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

  useEffect(() => {
    if (livePauseRequestId === 0) return;
    if (handledLivePauseRequestIdRef.current === livePauseRequestId) return;
    if (!isLiveStatusLoaded) return;

    handledLivePauseRequestIdRef.current = livePauseRequestId;
    if (SLEEP_OFFLINE_ENABLED) { Alert.alert(t('common.notice'), offlineText(ACTIVE_SLEEP_TRACKER_LOCALE, 'nativeReview')); return; }

    if (isStoppingSleep) {
      return;
    }

    if (!activeSleepEntry?.id) {
      console.log('Live Activity pause requested, but no active sleep entry exists.');
      return;
    }

    if (activeSleepEntry.period !== 'night') {
      Alert.alert(t('common.notice'), t('alert.pauseNightOnly'));
      return;
    }

    void handlePauseNightSleepRef.current();
  }, [
    activeSleepEntry?.id,
    activeSleepEntry?.period,
    isLiveStatusLoaded,
    isStoppingSleep,
    livePauseRequestId,
  ]);

  // Handle autoStart=1 from widget deep link — starts sleep if none is active
  useEffect(() => {
    if (autoStartRequestId === 0) return;
    if (handledAutoStartRequestIdRef.current === autoStartRequestId) return;
    if (!isLiveStatusLoaded) return;

    handledAutoStartRequestIdRef.current = autoStartRequestId;

    if (activeSleepEntry || isStartingSleep) return;

    const now = new Date();
    const period = isNightSleepPrediction(sleepPrediction)
      ? 'night'
      : getSleepPeriodForStart(now, nightWindowSettings);
    void handleStartSleepRef.current(period);
  }, [
    activeSleepEntry,
    autoStartRequestId,
    isLiveStatusLoaded,
    isStartingSleep,
    nightWindowSettings,
    sleepPrediction,
  ]);

  // Handle save entry (compatible with SleepInputModal)
  const handleSaveEntry = async (payload: any) => {
    if (!ensureWritableInCurrentMode()) return;
    try {
      if (!user?.id) {
        Alert.alert(t('common.error'), t('alert.userRequired'));
        return;
      }

      console.log('🔍 handleSaveEntry called with:', payload);
      console.log('🔍 editingEntry:', editingEntry);

      // SleepInputModal sendet die Daten direkt als Objekt
      const sleepData = payload;
      let createdEntryDateToSelect: Date | null = null;
      let locallyQueuedEntry: StoredSleepEntry | null = null;

      // Validierung der Daten
      if (!sleepData.start_time) {
      Alert.alert(t('common.error'), t('alert.startRequired'));
        return;
      }

      const normalizedStartDate = new Date(sleepData.start_time);
      if (!isValidManualDate(normalizedStartDate)) {
      Alert.alert(t('common.error'), t('alert.invalidStart'));
        return;
      }

      const normalizedEndDate = sleepData.end_time ? new Date(sleepData.end_time) : null;
      if (normalizedEndDate && !isValidManualDate(normalizedEndDate)) {
      Alert.alert(t('common.error'), t('alert.invalidEnd'));
        return;
      }

      if (normalizedEndDate && normalizedEndDate.getTime() <= normalizedStartDate.getTime()) {
      Alert.alert(t('common.error'), t('alert.endAfterStart'));
        return;
      }

      const enteredDurationMs = normalizedEndDate
        ? normalizedEndDate.getTime() - normalizedStartDate.getTime()
        : null;
      if (typeof enteredDurationMs === 'number' && enteredDurationMs < MIN_PERSISTED_SLEEP_DURATION_MS) {
        if (editingEntry?.id) {
          if (!sleepService) {
            Alert.alert(t('common.error'), t('alert.serviceUnavailable'));
            return;
          }

          const deleteResult = await sleepService.deleteEntry(editingEntry.id, editingEntry);
          if (deleteResult.primary.error) {
            console.error('❌ Delete sub-minute edit error:', deleteResult.primary.error);
            Alert.alert(t('common.error'), t('alert.shortDeleteFailed'));
            return;
          }

          if (deleteResult.secondary.error) {
            console.warn('[SleepTracker] Secondary backend delete failed:', deleteResult.secondary.error);
          }

          closeManualSleepModal();
          await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
          await loadSleepData();
          Alert.alert(t('common.notice'), t('alert.shortDeleted'));
          return;
        }

      Alert.alert(t('common.notice'), t('alert.shortEntry'));
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
            const entryStart = new Date(entry.start_time).toLocaleString(SLEEP_TRACKER_LOCALE_TAG, {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
            const entryEnd = entry.end_time
              ? new Date(entry.end_time).toLocaleString(SLEEP_TRACKER_LOCALE_TAG, {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
              : t('state.running');
            return `• ${entryStart} - ${entryEnd}`;
          })
          .join('\n');
        const moreCount = overlappingEntries.length - 3;

        Alert.alert(
          t('alert.overlapTitle'),
          t('alert.overlapBody', {
            entries: overlapsPreview,
            more: moreCount > 0 ? t('alert.moreEntries', { count: moreCount }) : '',
          })
        );
        return;
      }

      const effectivePartnerId = activeBabyId && localHealthAllowed(user.id) && !SLEEP_OFFLINE_ENABLED ? partnerId : await getEffectivePartnerId();

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
          Alert.alert(t('common.error'), t('alert.serviceUnavailable'));
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
        }, editingEntry);

        if (result.primary.error) {
          console.error('❌ Update error:', result.primary.error);
          Alert.alert(t('alert.updateTitle'), saveErrorMessage(result.primary.error, ACTIVE_SLEEP_TRACKER_LOCALE, t('common.unknownError')));
          return;
        }

        if (result.secondary.error) {
          console.warn('[SleepTracker] Secondary backend update failed:', result.secondary.error);
        }

        console.log('✅ Entry updated successfully:', result.primary.data);
        if (result.primary.data?.local_pending) locallyQueuedEntry = result.primary.data;
        // Splash anzeigen für Bearbeitung
        showSuccessSplash('#4A90E2', '✏️', 'sleep_edit_save');
      } else {
        console.log('➕ Creating new entry');

        if (!sleepService) {
          Alert.alert(t('common.error'), t('alert.serviceUnavailable'));
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
          Alert.alert(t('alert.saveTitle'), saveErrorMessage(result.primary.error, ACTIVE_SLEEP_TRACKER_LOCALE, t('common.unknownError')));
          return;
        }

        if (result.secondary.error) {
          console.warn('[SleepTracker] Secondary backend write failed:', result.secondary.error);
        }

        console.log('✅ Entry created successfully:', result.primary.data);
        if (result.primary.data?.local_pending) locallyQueuedEntry = result.primary.data;
        const createdEntry = classifySleepEntry(result.primary.data!);
        createdEntryDateToSelect = getAssignedDateForEntry(createdEntry, nightWindowSettings);
        // Splash anzeigen für neuen Eintrag
        showSuccessSplash('#8E4EC6', '💤', 'sleep_manual_save');
      }

      if (createdEntryDateToSelect) {
        // Nach einer Neuanlage immer den Tag zeigen, dem der gespeicherte Eintrag
        // zugeordnet ist. Bei Nachtschlaf ist das der Beginn des Nachtfensters.
        hasAutoSelectedDateRef.current = true;
        selectTab('day');
        setSelectedDate(createdEntryDateToSelect);
      }

      if (locallyQueuedEntry) {
        const entry = classifySleepEntry(locallyQueuedEntry);
        setSleepEntries(rows => [entry, ...rows.filter(row => row.id !== entry.id)]);
        if (!entry.end_time) { activeSleepEntryRef.current = entry; setActiveSleepEntry(entry); }
        else if (activeSleepEntryRef.current?.id === entry.id) { activeSleepEntryRef.current = null; setActiveSleepEntry(null); }
        closeManualSleepModal();
        void cancelLocalSleepWindowReminders().catch(() => {});
        return;
      }
      if (
        shouldCancelStaleReminderAfterManualEntry({
          startTime: normalizedStartTime,
          endTime: normalizedEndTime,
        })
      ) {
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
          console.error('Failed to cancel stale sleep window reminders after manual entry:', reminderError);
        }
      }

      closeManualSleepModal();

      // Invalidate cache because new/updated entry should appear immediately
      // WICHTIG: Korrekter Cache-Key wie in loadSleepHistory!
      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('❌ Sleep entry save error:', error);
      Alert.alert(
        t('alert.unexpectedSave'),
        saveErrorMessage(error, ACTIVE_SLEEP_TRACKER_LOCALE, t('common.unknownError'))
      );
    }
  };

  const handleSplitNightSegment = async (params: {
    targetEntry: ClassifiedSleepEntry;
    splitTime: Date;
    wakeMinutes: number;
  }) => {
    if (!ensureWritableInCurrentMode()) return null;
    const { targetEntry, splitTime: paramSplitTime, wakeMinutes: paramWakeMinutes } = params;

    if (!sleepService || !user?.id) {
      Alert.alert(t('common.error'), t('alert.relogin'));
      return null;
    }
    if (isSplittingSegment) {
      Alert.alert(t('common.wait'), t('alert.saveInProgress'));
      return null;
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
      Alert.alert(t('alert.notSaveable'), t('alert.segmentAmbiguous'));
      return null;
    }

    const segmentStart = new Date(resolvedTarget.start_time);
    const safeSplitTime = sanitizeManualDate(paramSplitTime, segmentStart);

    setIsSplittingSegment(true);
    const mutation = beginSleepMutation();
    try {
      const effectivePartnerId = await getEffectivePartnerId();
      if (!mutation.isCurrentScope()) return null;

      const result = await splitNightSleepSegment({
        service: sleepService,
        userId: user.id,
        targetEntry: {
          id: resolvedTarget.id,
          user_id: resolvedTarget.user_id ?? null,
          baby_id: resolvedTarget.baby_id ?? null,
          start_time: resolvedTarget.start_time,
          end_time: resolvedTarget.end_time ?? null,
          duration_minutes: resolvedTarget.duration_minutes ?? null,
          notes: resolvedTarget.notes ?? null,
          quality: resolvedTarget.quality ?? null,
          partner_id: resolvedTarget.partner_id ?? null,
        },
        splitTime: safeSplitTime,
        wakeMinutes: paramWakeMinutes,
        fallbackPartnerId: effectivePartnerId ?? null,
        babyId: activeBabyId ?? null,
        babyName,
        targetPeriodIsNight: resolvedTarget.period === 'night',
      });
      if (!mutation.isCurrentScope()) return null;

      if (!result.ok) {
        if (result.reason === 'invalid-split-time') {
          const targetWasActive = !resolvedTarget.end_time;
          Alert.alert(
            t('common.error'),
            targetWasActive
              ? t('alert.splitActiveTime')
              : t('alert.splitFinishedTime')
          );
        } else if (result.reason === 'wake-too-long') {
          Alert.alert(t('common.error'), result.message);
        } else if (result.reason === 'partner-active') {
          Alert.alert(t('alert.notPossible'), result.message);
        } else {
          Alert.alert(t('common.error'), t('alert.splitFailed', { error: result.message }));
        }
        return null;
      }

      if (result.mode !== 'split') {
        return null;
      }

      if (result.secondIsActive) {
        if (resolvedTarget.period === 'night' && result.secondEntry.id) {
          activeEntryPeriodOverridesRef.current[result.secondEntry.id] = 'night';
        }
        if (resolvedTarget.id) {
          delete activeEntryPeriodOverridesRef.current[resolvedTarget.id];
        }
      }

      const forcedPeriod = resolvedTarget.period === 'night' ? 'night' : undefined;
      const savedFirstEntry = classifySleepEntry(result.firstEntry, forcedPeriod);
      const savedSecondEntry = classifySleepEntry(result.secondEntry, forcedPeriod);

      // Die Mutation liefert bereits den autoritativen Stand. Diesen sofort lokal
      // übernehmen, statt ihn durch einen möglicherweise noch alten Read zu ersetzen.
      setSleepEntries((currentEntries) => {
        const replacementIds = new Set([savedFirstEntry.id, savedSecondEntry.id]);
        const nextEntries: ClassifiedSleepEntry[] = [];
        let didReplaceTarget = false;

        for (const entry of currentEntries) {
          if (entry.id === resolvedTarget.id) {
            nextEntries.push(savedSecondEntry, savedFirstEntry);
            didReplaceTarget = true;
            continue;
          }
          if (replacementIds.has(entry.id)) continue;
          nextEntries.push(entry);
        }

        return didReplaceTarget
          ? nextEntries
          : [savedSecondEntry, savedFirstEntry, ...nextEntries];
      });

      if (result.secondIsActive) {
        activeSleepEntryRef.current = savedSecondEntry;
        setActiveSleepEntry(savedSecondEntry);
      }
      mutation.finish();
      // Realtime reloads received during the split were intentionally blocked.
      // Re-read after its final write so a concurrent partner stop is included.
      void loadSleepDataRef.current?.();

      showSuccessSplash('#4A90E2', '✂️', 'sleep_split_save');

      try {
        await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      } catch (cacheError) {
        // Der Split ist bereits bestätigt und lokal übernommen. Ein Cache-Fehler darf
        // deshalb nicht fälschlich als fehlgeschlagene Wachphase gemeldet werden.
        console.warn('[SleepTracker] Cache invalidation after split failed:', cacheError);
      }
      return {
        firstEntry: savedFirstEntry,
        secondEntry: savedSecondEntry,
      };
    } catch (error) {
      console.error('Unexpected split error:', error);
      Alert.alert(t('common.error'), t('alert.unexpectedSplit'));
      return null;
    } finally {
      if (mutation.isCurrentScope()) setIsSplittingSegment(false);
      if (mutation.finish() && mutation.isCurrentScope()) void loadSleepDataRef.current?.();
    }
  };

  const handleMergeNightSegments = async (entryA: ClassifiedSleepEntry, entryB: ClassifiedSleepEntry) => {
    if (!ensureWritableInCurrentMode()) return false;
    if (!sleepService || !user?.id) {
      Alert.alert(t('common.error'), t('alert.relogin'));
      return false;
    }
    if (isSplittingSegment) {
      Alert.alert(t('common.wait'), t('alert.saveInProgress'));
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
      source: { id?: string; start_time: Date | string; end_time?: Date | string | null }[]
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
      Alert.alert(t('alert.notSaveable'), t('alert.segmentsAmbiguous'));
      return false;
    }

    const mergedStart = new Date(resolvedEntryA.start_time);
    const mergedEnd = resolvedEntryB.end_time ? new Date(resolvedEntryB.end_time) : null;
    if (mergedEnd && mergedEnd.getTime() <= mergedStart.getTime()) {
      Alert.alert(t('common.error'), t('alert.invalidSegments'));
      return false;
    }

    const mergedDuration = mergedEnd
      ? Math.max(1, Math.round((mergedEnd.getTime() - mergedStart.getTime()) / 60000))
      : null;

    setIsSplittingSegment(true);
    try {
      if (SLEEP_OFFLINE_ENABLED) {
        if (!activeBabyId || !resolvedEntryA.sync_scope_revision || !resolvedEntryA.sync_revision || !resolvedEntryB.sync_revision || resolvedEntryA.sync_scope_revision !== resolvedEntryB.sync_scope_revision) return false;
        const result = await sleepService.versionedBatch(activeBabyId, resolvedEntryA.sync_scope_revision, [
          { action: 'update', id: resolvedEntryA.id, revision: resolvedEntryA.sync_revision, fields: { end_time: mergedEnd?.toISOString() ?? null } },
          { action: 'delete', id: resolvedEntryB.id, revision: resolvedEntryB.sync_revision, fields: {} },
        ]);
        if (result.error) { Alert.alert(t('common.error'), result.error.message); return false; }
      } else {
      // Update first entry to span both (including open-ended active segments)
      const updateResult = await sleepService.updateEntry(resolvedEntryA.id, {
        end_time: mergedEnd ? mergedEnd.toISOString() : null,
        duration_minutes: mergedDuration,
      }, resolvedEntryA);

      if (updateResult.primary.error) {
        console.error('Merge update error:', updateResult.primary.error);
        Alert.alert(
          t('common.error'),
          t('alert.mergeUpdateFailed', { error: updateResult.primary.error.message || t('common.unknownError') })
        );
        return false;
      }

      // Delete second entry
      const deleteResult = await sleepService.deleteEntry(resolvedEntryB.id, resolvedEntryB);
      if (deleteResult.primary.error) {
        console.error('Merge delete error:', deleteResult.primary.error);
        Alert.alert(
          t('common.error'),
          t('alert.mergeDeleteFailed', { error: deleteResult.primary.error.message || t('common.unknownError') })
        );
        return false;
      }

      }

      if (!mergedEnd) {
        const nextPeriod = resolvedEntryA.period === 'night' || resolvedEntryB.period === 'night'
          ? 'night'
          : getSleepPeriodForStart(mergedStart, nightWindowSettings);
        if (nextPeriod === 'night') {
          activeEntryPeriodOverridesRef.current[resolvedEntryA.id] = nextPeriod;
        } else {
          delete activeEntryPeriodOverridesRef.current[resolvedEntryA.id];
        }
        await rememberActiveSleepPeriodOverride(resolvedEntryA.id, nextPeriod, mergedStart);
        if (resolvedEntryB.id) {
          delete activeEntryPeriodOverridesRef.current[resolvedEntryB.id];
          await forgetActiveSleepPeriodOverride(resolvedEntryB.id);
        }

        try {
          if (!SLEEP_OFFLINE_ENABLED) await sleepActivityService.startSleepActivity(mergedStart, babyName);
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
      Alert.alert(t('common.error'), t('alert.unexpectedMerge'));
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
      Alert.alert(t('common.error'), t('alert.startBeforeEnd'));
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
      }, entry);

      if (updateResult.primary.error) {
        console.error('Adjust boundary error:', updateResult.primary.error);
        Alert.alert(t('common.error'), t('alert.adjustFailed'));
        return;
      }

      if (!entry.end_time && field === 'end_time') {
        delete activeEntryPeriodOverridesRef.current[entry.id];
        await forgetActiveSleepPeriodOverride(entry.id);
      } else if (!entry.end_time && field === 'start_time' && entry.period === 'night') {
        activeEntryPeriodOverridesRef.current[entry.id] = 'night';
        await rememberActiveSleepPeriodOverride(entry.id, 'night', newTime);
      }

      showSuccessSplash('#4A90E2', '⏱️', 'sleep_adjust_save');

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
    } catch (error) {
      console.error('Unexpected adjust error:', error);
      Alert.alert(t('common.error'), t('alert.unexpectedAdjust'));
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
      if (SLEEP_OFFLINE_ENABLED) {
        const group = ids.map(id => sleepEntries.find(e => e.id === id));
        const revision = group[0]?.sync_scope_revision;
        if (!activeBabyId || !revision || group.some(e => !e?.sync_revision || e.sync_scope_revision !== revision)) return false;
        const result = await sleepService.versionedBatch(activeBabyId, revision, group.map(e => ({ action:'delete', id:e!.id, revision:e!.sync_revision, fields:{} })));
        if (result.error) { Alert.alert(t('common.error'), result.error.message); return false; }
      } else {
      const results = await Promise.all(ids.map((entryId) => sleepService.deleteEntry(entryId, sleepEntries.find(e => e.id === entryId))));
      const failedPrimary = results.filter((result) => result.primary.error);

      if (failedPrimary.length > 0) {
        console.error('[SleepTracker] Night group delete failed:', failedPrimary.map((item) => item.primary.error));
        Alert.alert(t('common.error'), t('alert.nightDeleteIncomplete'));
        return false;
      }

      const failedSecondary = results.filter((result) => result.secondary.error);
      if (failedSecondary.length > 0) {
        console.warn('[SleepTracker] Secondary backend delete failed for night group:', failedSecondary.map((item) => item.secondary.error));
      }

      }

      await Promise.all(ids.map((entryId) => forgetActiveSleepPeriodOverride(entryId)));
      ids.forEach((entryId) => {
        delete activeEntryPeriodOverridesRef.current[entryId];
      });

      await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
      await loadSleepData();
      Alert.alert(t('common.success'), t('alert.nightDeleted'));
      return true;
    } catch (error) {
      console.error('[SleepTracker] Unexpected night group delete error:', error);
      Alert.alert(t('common.error'), t('alert.nightDeleteFailed'));
      return false;
    } finally {
      setIsSplittingSegment(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!ensureWritableInCurrentMode()) return;
    Alert.alert(
      t('alert.deleteTitle'),
      t('alert.deleteQuestion'),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => { triggerHaptic(); } },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            triggerHaptic();
            if (!ensureWritableInCurrentMode()) return;
            if (!sleepService) {
              Alert.alert(t('common.error'), t('alert.serviceUnavailable'));
              return;
            }
            const deletedEntry = sleepEntries.find(e => e.id === entryId);
            const mutation = beginSleepMutation();
            // Remove the card right away so it fades out instead of waiting for
            // the server round trip and a full reload.
            setSleepEntries(prev => prev.filter(e => e.id !== entryId));
            const restoreDeletedEntry = () => {
              if (!deletedEntry || !mutation.isCurrentScope()) return;
              setSleepEntries(prev => prev.some(e => e.id === entryId) ? prev : [...prev, deletedEntry]);
            };
            try {
              // Delete entry via service (dual-write)
              const result = await sleepService.deleteEntry(entryId, deletedEntry);

              if (result.primary.error) {
                console.error('❌ Delete error:', result.primary.error);
                restoreDeletedEntry();
                Alert.alert(t('common.error'), t('alert.entryDeleteFailed'));
                return;
              }

              if (result.secondary.error) {
                console.warn('[SleepTracker] Secondary backend delete failed:', result.secondary.error);
              }

              delete activeEntryPeriodOverridesRef.current[entryId];
              await forgetActiveSleepPeriodOverride(entryId);

              // Invalidate cache because entry was deleted
              // WICHTIG: Korrekter Cache-Key wie in loadSleepHistory!
              await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${activeBabyId || 'default'}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch {
              restoreDeletedEntry();
              Alert.alert(t('common.error'), t('alert.entryDeleteFailed'));
            } finally {
              if (mutation.finish() && mutation.isCurrentScope()) void loadSleepDataRef.current?.();
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
  function showSuccessSplash(hex: string, _emoji: string, kind: string) {
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
      setSplashTitle(t('splash.nightStartTitle'));
      setSplashSubtitle(t('splash.nightStartBody'));
      setSplashStatus(t('splash.timerStarted'));
      setSplashHint(t('splash.nightStartHint'));
    } else if (kind === 'sleep_start_day') {
      setSplashTitle(t('splash.dayStartTitle'));
      setSplashSubtitle(t('splash.dayStartBody'));
      setSplashStatus(t('splash.timerStarted'));
      setSplashHint(t('splash.dayStartHint'));
    } else if (kind === 'sleep_pause_night') {
      setSplashTitle(t('splash.pauseTitle'));
      setSplashSubtitle(t('splash.pauseBody'));
      setSplashStatus('');
      setSplashHint(t('splash.pauseHint'));
    } else if (kind === 'sleep_stop_good') {
      setSplashTitle(t('splash.stopTitle'));
      setSplashSubtitle(t('splash.goodBody'));
      setSplashStatus('');
      setSplashHint(t('splash.goodHint'));
    } else if (kind === 'sleep_stop_medium') {
      setSplashTitle(t('splash.stopTitle'));
      setSplashSubtitle(t('splash.mediumBody'));
      setSplashStatus('');
      setSplashHint(t('splash.mediumHint'));
    } else if (kind === 'sleep_stop_bad') {
      setSplashTitle(t('splash.stopTitle'));
      setSplashSubtitle(t('splash.badBody'));
      setSplashStatus('');
      setSplashHint(t('splash.badHint'));
    } else if (kind === 'sleep_manual_save') {
      setSplashTitle(t('splash.manualTitle'));
      setSplashSubtitle(t('splash.manualBody'));
      setSplashStatus('');
      setSplashHint(t('splash.manualHint'));
    } else if (kind === 'sleep_edit_save') {
      setSplashTitle(t('splash.editTitle'));
      setSplashSubtitle(t('splash.editBody'));
      setSplashStatus('');
      setSplashHint(t('splash.editHint'));
    } else if (kind === 'sleep_split_save') {
      setSplashTitle(t('splash.splitTitle'));
      setSplashSubtitle(t('splash.splitBody'));
      setSplashStatus('');
      setSplashHint(t('splash.splitHint'));
    } else {
      setSplashTitle(t('splash.actionTitle'));
      setSplashSubtitle(t('splash.actionBody'));
      setSplashStatus('');
      setSplashHint(t('splash.actionHint'));
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
  }

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

    // Score: altersabhängiges Tagesziel (AGE_PROFILES), lineare Abweichung (keine 100% bei 25h).
    // Ohne Geburtsdatum fällt getDailySleepTargetMinutes auf 14h zurück.
    const target = getDailySleepTargetMinutes(babyBirthdate, selectedDate);
    const deviation = Math.abs(totalMinutes - target);
    const score = Math.max(0, Math.round(100 - (deviation / target) * 100));

    return { totalMinutes, napsCount, longestStretch, score, nightTotalMinutes, nightSegmentCount };
  }, [babyBirthdate, nightWindowSettings, selectedDate, sleepEntries]);

  // Daily navigation helpers
  const goPrevDay = () => setSelectedDate(d => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() - 1);
    if (isBeforeHistoryCutoff(nd, historyCutoff)) {
      showHistoryLimitAlert(router);
      return d;
    }
    return nd;
  });
  const goNextDay = () => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd; });
  const today = new Date();
  const nextDisabled = isSameDay(selectedDate, today) || selectedDate > today;
  const hasEntryToday = useMemo(() => {
    const currentDate = new Date();
    return sleepEntries.some((entry) =>
      isEntryAssignedToDate(entry, currentDate, nightWindowSettings)
    );
  }, [nightWindowSettings, sleepEntries]);

  // Einträge für den aktuell ausgewählten Tag (Tag-Ansicht)
  const dayEntries = useMemo(() => {
    return sleepEntries
      .filter((entry) => isEntryAssignedToDate(entry, selectedDate, nightWindowSettings))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [nightWindowSettings, selectedDate, sleepEntries]);

  const nightGroups = useMemo(() => {
    const baseGroups = getNightGroupsForDayEntries(dayEntries, nightWindowSettings);
    if (baseGroups.length === 0) return [];

    const expandedGroups = new Map<string, NightGroup>();

    for (const baseGroup of baseGroups) {
      const referenceEntry = baseGroup.entries[0];
      if (!referenceEntry) continue;

      const windowKey = getNightWindowKeyForEntry(referenceEntry, nightWindowSettings, true);
      if (!windowKey) continue;
      if (expandedGroups.has(windowKey)) continue;

      const fullWindowSegments = sleepEntries
        .filter((entry) =>
          entry.period === 'night' &&
          getNightWindowKeyForEntry(entry, nightWindowSettings, true) === windowKey
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

    const currentEntryIds = new Set(
      nightEditorGroup.entries
        .map((entry) => entry.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const currentIdentities = new Set(
      nightEditorGroup.entries.map((entry) => getEntryIdentity(entry))
    );

    let bestMatch: NightGroup | null = null;
    let bestOverlap = 0;

    for (const group of nightGroups) {
      const overlap = group.entries.reduce((sum, entry) => {
        const hasStableIdMatch = Boolean(entry.id && currentEntryIds.has(entry.id));
        const hasIdentityFallback = currentIdentities.has(getEntryIdentity(entry));
        return sum + (hasStableIdMatch || hasIdentityFallback ? 1 : 0);
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
      const timeoutId = setTimeout(() => setNightEditorGroup(bestMatch), 0);
      return () => clearTimeout(timeoutId);
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
      selectTab('day');
      setSelectedDate(getAssignedDateForEntry(latest, nightWindowSettings));
    }
  }, [nightWindowSettings, sleepEntries]);

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
  const TopTabs = () => (<PeriodTabs value={visibleTab} isDark={isDark} monthLocked={isMonthViewLocked}
    labels={{ day: t('view.day'), week: t('view.week'), month: t('view.month') }}
    onSelect={(tab) => {
              triggerHaptic();
              if (tab === 'month' && isMonthViewLocked) {
                showMonthViewLockedAlert();
                return;
              }
              selectTab(tab);
              // Wenn Tag-Tab gewählt wird, springe zu heute
              if (tab === 'day') {
                setSelectedDate(new Date());
              }
            }} />);

  // The clock and capture card use the same start/resume flow.
  const handleStartSleepFromControl = async () => {
    if (isStartingSleep || isStoppingSleep || !isLiveStatusLoaded || isReadOnlyPreviewMode || activeSleepEntryRef.current) return;
    triggerHaptic();
    if (pausedNightState) return handleResumeNightSleep();
    const now = new Date();
    const period = isNightSleepPrediction(sleepPrediction) ? 'night' : getSleepPeriodForStart(now, nightWindowSettings);
    return handleStartSleep(period);
  };

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
            <GlassCard intensity={24} style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, styles.fullWidthCard, { backgroundColor: 'rgba(210, 210, 210, 0.45)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(150, 150, 150, 0.85)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <IconSymbol name="clock.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>{t('timer.loading')}</Text>
                <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary }]}>{t('timer.wait')}</Text>
              </View>
            </GlassCard>
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
              <GlassCard intensity={24} style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(242, 199, 138, 0.55)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(242, 166, 80, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="pause.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>{t('timer.pause')}</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary }]}>{t('timer.pauseHint')}</Text>
                </View>
              </GlassCard>
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
              <GlassCard intensity={24} style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
                    {isStoppingSleep ? t('timer.ending') : t('timer.endNight')}
                  </Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary }]}>
                    {loadingLabel || t('timer.chooseQuality')}
                  </Text>
                </View>
              </GlassCard>
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
            <GlassCard intensity={24} style={styles.liquidGlassCardBackground}>
              <View style={[styles.card, styles.liquidGlassCard, styles.fullWidthCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                  <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
                </View>
                <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
                  {isStoppingSleep ? t('timer.sleepEnding') : t('timer.endSleep')}
                </Text>
                <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary }]}>
                  {loadingLabel || t('timer.stop')}
                </Text>
                </View>
              </GlassCard>
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
              <GlassCard intensity={24} style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(142, 78, 198, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="play.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>{t('timer.resume')}</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary }]}>
                    {loadingLabel || t('timer.resumeNight')}
                  </Text>
                </View>
              </GlassCard>
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
              <GlassCard intensity={24} style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="checkmark.circle.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>
                    {t('timer.finishNight')}
                  </Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary }]}>
                    {loadingLabel || t('timer.saveQuality')}
                  </Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <SleepCaptureButton kind="start" title={t('timer.start')} hint={loadingLabel || t('timer.startHint')}
              textColor={textSecondary} disabled={isActionBlocked}
              style={{ width: GRID_COL_W, marginRight: GRID_GUTTER, marginBottom: 16 }}
              onPress={() => { void handleStartSleepFromControl(); }} />
            <SleepCaptureButton kind="manual" title={t('timer.manual')} hint={t('timer.add')}
              textColor={textSecondary} disabled={isActionBlocked} style={{ width: GRID_COL_W, marginBottom: 16 }}
              onPress={() => { if (!isActionBlocked) { triggerHaptic(); openManualSleepModal(); } }} />
          </>
        )}
      </View>
    );
  };

  // Wochenansicht (als Render-Funktion aufgerufen, keine eigene Komponente:
  // eine inline definierte Komponente würde bei jedem Parent-Render remounten)
  const WeekView = () => {
    // Referenz-Datum: Heute + (weekOffset * 7 Tage)
    const refDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + weekOffset * 7);
      return d;
    })();

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

    const weekDays = getWeekDays(refDate);
    const weekStart = getWeekStart(refDate);
    const weekEnd = getWeekEnd(refDate);

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
          <PeriodNavigationButton direction="previous"
            accessibilityLabel={t('navigation.previousWeek')}
            isDark={isDark} color={textSecondary}
            onPress={() => {
              triggerHaptic();
              setWeekOffset(o => o - 1);
            }}
          />

          <View style={styles.weekHeaderCenter}>
            <Text style={[styles.weekHeaderTitle, { color: textSecondary }]}>{t('view.weekTitle')}</Text>
            <Text style={[styles.weekHeaderSubtitle, { color: textSecondary }]}>
              {weekStart.toLocaleDateString(SLEEP_TRACKER_LOCALE_TAG, { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString(SLEEP_TRACKER_LOCALE_TAG, { day: 'numeric', month: 'short' })}
            </Text>
              </View>

          <PeriodNavigationButton direction="next"
            accessibilityLabel={t('navigation.nextWeek')}
            isDark={isDark} color={textSecondary}
            disabled={weekOffset >= 0}
            onPress={() => {
              triggerHaptic();
              setWeekOffset(o => o + 1);
            }}
          />
        </View>

        {/* Balkendiagramm - Design Guide konform mit Liquid Glass */}
        <LiquidGlassCard style={styles.chartGlassCard}>
          <Text style={[styles.chartTitle, { color: textSecondary }]}>{t('week.times')}</Text>

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
                    if (isBeforeHistoryCutoff(day, historyCutoff)) {
                      showHistoryLimitAlert(router);
                      return;
                    }
                    setSelectedDate(day);
                    selectTab('day');
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
                    <Text allowFontScaling={false} style={[styles.chartLabel, { color: textSecondary }]}>{weekdayLabels[i]}</Text>
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
            <Text style={[styles.summaryTitle, { color: textSecondary }]}>{t('week.summary')}</Text>
            <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🌙</Text>
                  <Text style={[styles.statValue, { color: textSecondary }]}>{Math.round(nightWeekMins / 60)}h</Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>{t('stats.nightSleep')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>☀️</Text>
                  <Text style={[styles.statValue, { color: textSecondary }]}>{Math.round(dayWeekMins / 60)}h</Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>{t('stats.daySleep')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>⭐</Text>
                  <Text style={[styles.statValue, { color: textSecondary }]}>{Math.round(totalWeekMins / 7 / 60)}h</Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>{t('month.average')}</Text>
                </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };

  // Monatsansicht (als Render-Funktion aufgerufen, siehe WeekView)
  const MonthView = () => {
    // Referenz-Monat: aktueller Monat + monthOffset
    const refMonthDate = (() => {
      const d = new Date();
      d.setDate(1);                 // Normalize to first of month
      d.setMonth(d.getMonth() + monthOffset);
      return d;
    })();

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

    const monthStart = getMonthStart(refMonthDate);
    const monthEnd = getMonthEnd(refMonthDate);
    const monthRangeEnd = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + 1);
    const daysInMonth = getDaysInMonth(refMonthDate);
    const averageDayCount = (() => {
      const today = new Date();
      const isCurrentMonth =
        refMonthDate.getFullYear() === today.getFullYear() &&
        refMonthDate.getMonth() === today.getMonth();

      return isCurrentMonth ? today.getDate() : daysInMonth;
    })();

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

    const calendarWeeks = getCalendarWeeks();

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

    const monthStats = (() => {
      const nowMs = Date.now();
      const monthStartMs = monthStart.getTime();
      const monthEndMs = monthRangeEnd.getTime();

      const entriesInMonth = sleepEntries.filter((entry) => {
        const entryStartMs = new Date(entry.start_time).getTime();
        const entryEndMs = entry.end_time ? new Date(entry.end_time).getTime() : nowMs;
        if (!Number.isFinite(entryStartMs) || !Number.isFinite(entryEndMs)) return false;

        return Math.min(entryEndMs, monthEndMs) > Math.max(entryStartMs, monthStartMs);
      });

      const totalMonthMinutes = minutesFromMergedIntervals(
        getMergedIntervalsForEntries(sleepEntries, {
          rangeStart: monthStart,
          rangeEnd: monthRangeEnd,
          nowMs,
        })
      );

      const longestSleepMinutes = entriesInMonth.reduce((longest, entry) => {
        const entryStartMs = new Date(entry.start_time).getTime();
        const entryEndMs = entry.end_time ? new Date(entry.end_time).getTime() : nowMs;
        if (!Number.isFinite(entryStartMs) || !Number.isFinite(entryEndMs)) return longest;

        const clippedMinutes = Math.floor(
          Math.max(0, Math.min(entryEndMs, monthEndMs) - Math.max(entryStartMs, monthStartMs)) / 60000
        );
        return Math.max(longest, clippedMinutes);
      }, 0);

      return {
        entriesCount: entriesInMonth.length,
        averageHoursPerDay: Math.round(totalMonthMinutes / averageDayCount / 60),
        longestSleepHours: Math.round(longestSleepMinutes / 60),
      };
    })();

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
          <PeriodNavigationButton direction="previous"
            accessibilityLabel={t('navigation.previousMonth')}
            isDark={isDark} color={textSecondary}
            onPress={() => {
              triggerHaptic();
              setMonthOffset(o => o - 1);
            }}
          />

          <View style={styles.monthHeaderCenter}>
            <Text style={[styles.monthHeaderTitle, { color: textSecondary }]}>
              {refMonthDate.toLocaleDateString(SLEEP_TRACKER_LOCALE_TAG, { month: 'long', year: 'numeric' })}
            </Text>
          </View>

          <PeriodNavigationButton direction="next"
            accessibilityLabel={t('navigation.nextMonth')}
            isDark={isDark} color={textSecondary}
            disabled={monthOffset >= 0}
            onPress={() => {
              triggerHaptic();
              setMonthOffset(o => o + 1);
            }}
          />
        </View>

        {/* Kalender-Block mit exakt gleicher Innenbreite wie Week-Chart */}
        <LiquidGlassCard style={styles.chartGlassCard}>
          <Text style={[styles.chartTitle, { color: textSecondary }]}>{t('month.calendar')}</Text>
          <View style={{ width: WEEK_CONTENT_WIDTH, alignSelf: 'center', paddingVertical: 16 }}>
            {/* Wochentags-Header mit exakten Spaltenbreiten */}
            <View style={styles.weekdayHeader}>
              {weekdayLabels.map((label, i) => {
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
                              if (isBeforeHistoryCutoff(date, historyCutoff)) {
                                showHistoryLimitAlert(router);
                                return;
                              }
                              setSelectedDate(date);
                              selectTab('day');
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
            <Text style={[styles.summaryTitle, isDark && { color: '#FFFFFF' }]}>{t('view.monthTitle')}</Text>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>📊</Text>
                <Text style={[styles.statValue, isDark && { color: '#FFFFFF' }]}>{monthStats.entriesCount}</Text>
                <Text style={[styles.statLabel, isDark && { color: '#FFFFFF' }]}>{t('month.entries')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>⏰</Text>
                <Text style={[styles.statValue, isDark && { color: '#FFFFFF' }]}>{monthStats.averageHoursPerDay}h</Text>
                <Text style={[styles.statLabel, isDark && { color: '#FFFFFF' }]}>{t('month.average')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🏆</Text>
                <Text style={[styles.statValue, isDark && { color: '#FFFFFF' }]}>{monthStats.longestSleepHours}h</Text>
                <Text style={[styles.statLabel, isDark && { color: '#FFFFFF' }]}>{t('month.longest')}</Text>
              </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };

  const headerSubtitle = isReadOnlyPreviewMode
    ? t('screen.previewSubtitle')
    : t('screen.subtitle');

  return (
    <HomeBackground style={styles.backgroundImage}>
      {!sleepLiveConfirmed && sleepOffline.knownActive && <Text>{offlineText(ACTIVE_SLEEP_TRACKER_LOCALE, 'localTimer')}</Text>}
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <Header 
          title={t('screen.title')}
          subtitle={headerSubtitle}
          showBackButton
          onBackPress={() => navigateBack('/(tabs)/home')}
        />

        {/* Top Tabs - über der Status Bar (Funktionsaufruf statt <TopTabs />, verhindert Remount bei jedem Render) */}
        {TopTabs()}

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
          <TrackingSyncStatus babyId={activeBabyId} offline={sleepReadFailed} />
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
              <Text style={styles.readOnlyPreviewTitle}>{t('preview.active')}</Text>
              <Text style={styles.readOnlyPreviewText}>
                {t('preview.banner')}
              </Text>
            </View>
          )}

          {visibleTab === 'week' ? (
            WeekView()
          ) : visibleTab === 'month' ? (
            MonthView()
          ) : (
            <>
              {/* Day Navigation - gleiche Position/Höhe wie Woche/Monat */}
              <View style={[styles.weekNavigationContainer, styles.dayNavigationContainer]}>
                <PeriodNavigationButton direction="previous"
                  accessibilityLabel={t('navigation.previousDay')}
                  isDark={isDark} color={textSecondary}
                  onPress={() => {
                    triggerHaptic();
                    goPrevDay();
                  }}
                />
                <View style={styles.weekHeaderCenter}>
                  <Text style={[styles.weekHeaderTitle, { color: textSecondary }]}>{t('view.dayTitle')}</Text>
                  <Text style={[styles.weekHeaderSubtitle, { color: textSecondary }]}>
                    {isSameDay(selectedDate, today)
                      ? new Date().toLocaleDateString(SLEEP_TRACKER_LOCALE_TAG, { weekday: 'long', day: '2-digit', month: 'long' })
                      : selectedDate.toLocaleDateString(SLEEP_TRACKER_LOCALE_TAG, { weekday: 'long', day: '2-digit', month: 'long' })}
                  </Text>
                  {/* The invisible copy keeps the header height constant, so switching
                      days or loading never shifts the content below. */}
                  <View>
                    <Text
                      style={[styles.todayEmptyHint, styles.todayEmptyHintPlaceholder]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      {t('day.empty')}
                    </Text>
                    {!isLoading && !hasEntryToday && isSameDay(selectedDate, today) && (
                      <Reanimated.Text
                        entering={FadeIn.duration(240)}
                        exiting={FadeOut.duration(160)}
                        style={[styles.todayEmptyHint, styles.todayEmptyHintOverlay, { color: textSecondary }]}
                      >
                        {t('day.empty')}
                      </Reanimated.Text>
                    )}
                  </View>
                </View>
                <PeriodNavigationButton direction="next"
                  accessibilityLabel={t('navigation.nextDay')}
                  isDark={isDark} color={textSecondary}
                  disabled={nextDisabled}
                  onPress={() => {
                    triggerHaptic();
                    goNextDay();
                  }}
                />
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
                  onStart={handleStartSleepFromControl}
                  startLabel={pausedNightState ? t('timer.resume') : t('timer.start')}
                  startHint={pausedNightState ? t('timer.resumeNight') : t('timer.startHint')}
                  startDisabled={isStartingSleep || isStoppingSleep || !isLiveStatusLoaded || isReadOnlyPreviewMode}
                />
              </Animated.View>

              {/* Schlaferfassung Section - nur in Tag-Ansicht */}
              <View style={styles.sleepCaptureSection}>
                <Text style={[styles.sectionTitle, styles.sectionTitleTight, { color: textSecondary }]}>{t('day.capture')}</Text>

                {/* Action Buttons - nur in Tag-Ansicht */}
                {ActionButtons()}
              </View>

              {/* Timeline Section - nur in Tag-Ansicht */}
            <View style={styles.timelineSection}>
              <Text style={[styles.sectionTitle, styles.sectionTitleTight, { color: textSecondary }]}>{t('day.timeline')}</Text>

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
                if (sleepHours >= 10 && wakeCount === 0) nightMood = t('night.mood.wonderful');
                else if (sleepHours >= 8 && wakeCount <= 1) nightMood = t('night.mood.veryGood');
                else if (sleepHours >= 7 && wakeCount <= 2) nightMood = t('night.mood.good');
                else if (sleepHours >= 6) nightMood = t('night.mood.solid');
                else if (sleepHours >= 4) nightMood = t('night.mood.restless');
                else nightMood = t('night.mood.short');

                const accentPurple = isDark ? '#A26BFF' : '#8E4EC6';
                // Timeline bar width = 85% of contentWidth, capped & centered
                const timelineBarWidth = Math.round(contentWidth * 0.70);

                return (
                  <Reanimated.View
                    key={`night-group-${group.start.toISOString()}`}
                    entering={TIMELINE_ITEM_ENTERING}
                    exiting={TIMELINE_ITEM_EXITING}
                    layout={TIMELINE_ITEM_LAYOUT}
                  >
                  <TouchableOpacity
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
                        <Text style={[styles.nightGroupTitle, { color: textPrimary }]}>{t('night.title')}</Text>
                        <Text style={[styles.nightGroupEditHint, { color: accentPurple }]}>{t('night.edit')}</Text>
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
                        nightWindowSettings={nightWindowSettings}
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
                                {t('night.sleep')} {minutesToHMM(group.totalMinutes)}
                              </Text>
                            </View>
                            <View style={styles.nightGroupStat}>
                              <View style={[styles.nightGroupStatDot, { backgroundColor: 'rgba(232,160,130,0.8)' }]} />
                              <Text style={[styles.nightGroupStatText, { color: textSecondary }]}>
                                {t('night.awake')} {formatWakeDuration(totalWakeSeconds)}
                              </Text>
                            </View>
                          </View>
                          {longestSleepMin > 0 && (
                            <Text style={[styles.nightGroupLongestPhase, { color: textSecondary }]}>
                              {t('night.longest')} {minutesToHMM(longestSleepMin)}
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
                  </Reanimated.View>
                );
              }

              const entry = item.entry;
              return (
                <Reanimated.View
                  key={entry.id || index}
                  entering={TIMELINE_ITEM_ENTERING}
                  exiting={TIMELINE_ITEM_EXITING}
                  layout={TIMELINE_ITEM_LAYOUT}
                >
                <ActivityCard
                  entry={convertSleepToDailyEntry(entry, nightWindowSettings)}
                  auxiliaryBadgeLabel={(entry as any).local_pending ? offlineText(ACTIVE_SLEEP_TRACKER_LOCALE,'queuedEntry') : null}
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
                </Reanimated.View>
              );
            })}
          {dayEntries.length === 0 && !isLoading && (
            <Reanimated.View entering={TIMELINE_EMPTY_ENTERING} exiting={TIMELINE_ITEM_EXITING} layout={TIMELINE_ITEM_LAYOUT}>
              <LiquidGlassCard style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>💤</Text>
                <Text style={[styles.emptyTitle, { color: textSecondary }]}>{t('day.noEntries')}</Text>
                <Text style={styles.emptySubtitle}>
                  {sleepEntries.length > 0
                    ? t('day.changeDate')
                    : t('day.first')}
                </Text>
                {sleepEntries.length > 0 && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.manualButton, { marginTop: 12 }]}
                    onPress={() => {
                      triggerHaptic();
                      jumpToLatestEntry();
                    }}
                  >
                    <Text style={[styles.actionButtonText, { color: textSecondary }]}>{t('day.lastAction')}</Text>
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
                  <Text style={[styles.actionButtonText, { color: textSecondary }]}>{t('day.manualAction')}</Text>
                </TouchableOpacity>
              </LiquidGlassCard>
            </Reanimated.View>
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
              <GlassCard intensity={24} style={styles.liquidGlassCardBackground}>
                <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.6)' }]}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.6)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 4 }]}>
                    <IconSymbol name="plus.circle.fill" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: textSecondary, fontWeight: '700' }]}>{t('timer.manual')}</Text>
                  <Text style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: textSecondary }]}>{t('timer.add')}</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Sleep Input Modal direkt hier rendern */}
        <FormSheet
            visible={showInputModal}
            isDark={isDark}
            title={editingEntry ? t('form.edit') : t('form.add')}
            subtitle={editingEntry ? t('form.adjust') : t('form.create')}
            onClose={closeManualSleepModal}
            onCancel={closeManualSleepModal}
            confirmDisabled={isReadOnlyPreviewMode}
            onConfirm={() => {
              triggerHaptic();
              handleSaveEntry({
                start_time: safeModalStartTime.toISOString(),
                end_time: safeModalEndTime?.toISOString() || null,
                quality: sleepModalData.quality,
                notes: sleepModalData.notes,
              });
            }}
            overlays={
              <>
                <TextInputOverlay
                  visible={notesOverlayVisible}
                  label={t('form.notes').replace(/^📝\s*/, '')}
                  value={notesOverlayValue}
                  placeholder={t('form.notesPlaceholder')}
                  multiline
                  accentColor={modalAccentColor}
                  onClose={closeNotesEditor}
                  onSubmit={(next) => saveNotesEditor(next)}
                />
              </>
            }
          >
            <View style={{ width: '100%', alignItems: 'center' }}>
              {/* Zeit Sektion */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: textSecondary }]}>{t('form.period')}</Text>

                <View style={styles.timeRow}>
                  <FormField
                    isDark={isDark}
                    onPress={openStartPicker}
                    label={t('form.start')}
                    value={safeModalStartTime.toLocaleString(SLEEP_TRACKER_LOCALE_TAG, {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                    style={{ flex: 1 }}
                  />

                  <FormField
                    isDark={isDark}
                    onPress={openEndPicker}
                    label={t('form.end')}
                    value={
                      safeModalEndTime
                        ? safeModalEndTime.toLocaleString(SLEEP_TRACKER_LOCALE_TAG, {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                          })
                        : t('form.open')
                    }
                    style={{ flex: 1 }}
                  />
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
                        setShowStartPicker(false);
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
                        <Text style={styles.datePickerCancelText}>{t('common.done')}</Text>
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
                        setShowEndPicker(false);
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
                        <Text style={styles.datePickerCancelText}>{t('common.done')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {Platform.OS === 'ios' && showStartPicker && (
                  <FormSheet
                    visible={showStartPicker}
                    isDark={isDark}
                    title={t('form.start')}
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
                      locale={SLEEP_TRACKER_LOCALE_TAG}
                      onChange={(event, d) => {
                        if (event.type === 'dismissed') return;
                        setStartPickerDraft((prev) => getSafePickerDateFromEvent(event, d, prev));
                      }}
                      accentColor={modalAccentColor}
                      themeVariant={isDark ? 'dark' : 'light'}
                      style={styles.manualPickerSpinner}
                    />
                  </FormSheet>
                )}

                {Platform.OS === 'ios' && showEndPicker && (
                  <FormSheet
                    visible={showEndPicker}
                    isDark={isDark}
                    title={t('form.end')}
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
                      locale={SLEEP_TRACKER_LOCALE_TAG}
                      onChange={(event, d) => {
                        if (event.type === 'dismissed') return;
                        setEndPickerDraft((prev) => getSafePickerDateFromEvent(event, d, prev));
                      }}
                      accentColor={modalAccentColor}
                      themeVariant={isDark ? 'dark' : 'light'}
                      style={styles.manualPickerSpinner}
                    />
                  </FormSheet>
                )}
              </View>

              {/* Qualität Sektion */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: textSecondary }]}>{t('form.quality')}</Text>
                <View style={styles.optionsGrid}>
                  {(['good', 'medium', 'bad'] as const).map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor:
                            sleepModalData.quality === q
                              ? QUALITY_VISUALS[q].color
                              : modalQualityDefaultColor,
                          borderColor: sleepModalData.quality === q ? 'transparent' : modalFieldBorderColor,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sleepModalData.quality === q }}
                      onPress={() => {
                        triggerHaptic();
                        setSleepModalData((prev) => ({ ...prev, quality: q }));
                      }}
                    >
                      <Text style={styles.optionIcon}>{QUALITY_VISUALS[q].emoji}</Text>
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color: sleepModalData.quality === q ? '#FFFFFF' : textPrimary,
                          },
                        ]}
                      >
                        {t(
                          q === 'good' ? 'quality.good' : q === 'medium' ? 'quality.medium' : 'quality.bad',
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notizen Sektion */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: textSecondary }]}>{t('form.notes')}</Text>
                <FormField
                  isDark={isDark}
                  onPress={() => {
                    triggerHaptic();
                    openNotesEditor();
                  }}
                  value={sleepModalData.notes.trim()}
                  placeholder={t('form.notesPlaceholder')}
                  multiline
                />
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
                    <Text style={styles.deleteButtonText}>{t('form.delete')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </FormSheet>

        {nightEditorGroup && (
          <NightSleepEditor
            visible={showNightEditor}
            nightGroup={nightEditorGroup}
            nightWindowSettings={nightWindowSettings}
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
              <Text style={[styles.sleepInfoTitle, { color: textPrimary }]}>{t('explain.title')}</Text>
              <TouchableOpacity onPress={() => setShowSleepInfoModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)'} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sleepInfoScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sleepInfoHeading, { color: textPrimary }]}>
                {t('explain.headingDetail')}
              </Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.intro')}{'\n\n'}
                <Text style={{ fontStyle: 'italic' }}>{t('explain.important')}</Text>
              </Text>

              <Text style={[styles.sleepInfoSubheading, { color: textPrimary }]}>{t('explain.approach')}</Text>
              <View style={styles.sleepInfoBullets}>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  {t('explain.bulletExplainable')}
                </Text>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  {t('explain.bulletRobust')}
                </Text>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  {t('explain.bulletIndividual')}
                </Text>
                <Text style={[styles.sleepInfoBullet, { color: textSecondary }]}>
                  {t('explain.bulletRelief')}
                </Text>
              </View>

              <Text style={[styles.sleepInfoSubheading, { color: textPrimary }]}>{t('explain.steps')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary, marginBottom: 8 }]}>
                {t('explain.stepsIntro')}
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>{t('explain.step1Title')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.step1Body')}
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>{t('explain.step2Title')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.step2Body')}
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>{t('explain.step3Title')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.step3Body')}
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>{t('explain.step4Title')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.step4Body')}
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>{t('explain.step5Title')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.step5Body')}
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>{t('explain.step6Title')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.step6Body')}
              </Text>

              <Text style={[styles.sleepInfoStep, { color: textPrimary }]}>{t('explain.step7Title')}</Text>
              <Text style={[styles.sleepInfoBody, { color: textSecondary }]}>
                {t('explain.step7Body')}{'\n\n'}
                <Text style={{ fontWeight: '600' }}>{t('explain.extra')}</Text> {t('explain.extraBody')}
              </Text>

              <View style={[styles.sleepInfoSafety, { backgroundColor: isDark ? 'rgba(255,155,155,0.1)' : 'rgba(255,155,155,0.08)', borderColor: isDark ? 'rgba(255,155,155,0.2)' : 'rgba(255,155,155,0.15)' }]}>
                <Text style={[styles.sleepInfoBody, { color: textSecondary, marginBottom: 0 }]}>
                  <Text style={{ fontWeight: '700', color: textPrimary }}>{t('explain.safety')}</Text> {t('explain.safetyBody')}
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
            style={StyleSheet.absoluteFill as any}
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
    </HomeBackground>
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
    ...TYPOGRAPHY.label,
    color: '#FFE2B3',
    marginBottom: 2,
  },
  readOnlyPreviewText: {
    ...TYPOGRAPHY.bodySmall,
    color: 'rgba(255, 240, 220, 0.95)',
  },

  // Stats Container (Swipeable)
  statsContainer: {
    width: screenWidth,
    marginHorizontal: -LAYOUT_PAD,
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
    alignSelf: 'center',
    width: contentWidth,
    marginTop: 4,
    marginBottom: 4,
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
    width: '100%',
    marginTop: 6,
    marginBottom: 4,
    gap: CONTENT_LAYOUT.itemGap,
  },
  kpiCard: {
    width: '48%',
    borderRadius: CONTENT_LAYOUT.cardRadius,
    paddingVertical: CONTENT_LAYOUT.compactPadding,
    paddingHorizontal: CONTENT_LAYOUT.compactPadding,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 96,
  },
  kpiCardWide: {
    width: '100%', // Vollbreite für spezielle Karten
  },
  kpiColumn: {
    alignSelf: 'center',
    width: '100%',
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
    flexWrap: 'wrap',
  },
  kpiTitle: {
    ...TYPOGRAPHY.label,
    color: '#7D5A50',
    marginLeft: 4,
    flexShrink: 1,
  },
  kpiValue: {
    ...METRIC_TEXT,
    color: PRIMARY,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  kpiValueCentered: { 
    textAlign: 'center', 
    width: '100%' 
  },
  kpiSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
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
    ...TYPOGRAPHY.caption,
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
  centralStatus: {
    ...TYPOGRAPHY.bodyStrong,
    marginBottom: 2,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  centralHint: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    maxWidth: undefined,
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: 2,
  },
  centralHintPrimary: {
    ...TYPOGRAPHY.bodyStrong,
    textAlign: 'center',
    includeFontPadding: false,
  },
  centralHintSecondary: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    includeFontPadding: false,
    opacity: 0.85,
  },

  sectionTitle: {
    ...TYPOGRAPHY.sectionTitle,
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
    color: '#7D5A50',
    textAlign: 'left',
    width: '100%',
  },
  sectionTitleTight: {
    marginTop: Math.max(2, SECTION_GAP_TOP - 12),
  },

  // Top Tabs (exakt wie daily_old.tsx)

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
    minHeight: 140,
    height: undefined,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 0,
    boxShadow: CONTENT_LAYOUT.cardShadow,
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
    ...TYPOGRAPHY.headline,
    marginBottom: 4,
    textAlign: 'center',
  },
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: 0,
  },
  cardDescription: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '400',
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
    ...TYPOGRAPHY.headline,
    marginBottom: 4,
  },
  nextSleepTime: {
    ...TYPOGRAPHY.bodyStrong,
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
    ...TYPOGRAPHY.button,
    color: '#7D5A50',
  },

  // Empty State Styles
  emptyState: {
    padding: CONTENT_LAYOUT.cardPadding,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    ...TYPOGRAPHY.headline,
    color: '#7D5A50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...TYPOGRAPHY.bodySmall,
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
    paddingTop: CONTENT_LAYOUT.cardPadding,
    paddingBottom: CONTENT_LAYOUT.cardPadding,
    paddingHorizontal: CONTENT_LAYOUT.cardPadding,
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
    ...TYPOGRAPHY.headline,
    flex: 1,
  },
  nightGroupEditHint: {
    ...TYPOGRAPHY.label,
  },
  nightGroupBigDuration: {
    ...METRIC_TEXT_LARGE,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
    marginBottom: 4,
  },
  nightGroupMood: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
    opacity: 1,
  },
  nightGroupTimeRange: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginBottom: 20,
    opacity: 1,
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
    ...TYPOGRAPHY.label,
    fontVariant: ['tabular-nums'],
  },
  nightGroupLongestPhase: {
    ...TYPOGRAPHY.caption,
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
    ...TYPOGRAPHY.caption,
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
    ...TYPOGRAPHY.caption,
    opacity: 1,
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
    ...TYPOGRAPHY.caption,
    color: '#7D5A50',
    flex: 1,
  },
  insightValue: {
    ...METRIC_TEXT,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  // Solid, rounded form surfaces avoid Android elevation artifacts inside the sheet.
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimming backdrop
  },

  section: { width: '100%', gap: 8, marginBottom: 20 },
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 80,
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
    width: '100%',
    gap: 12,
  },

  deleteButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    borderCurve: 'continuous',
    overflow: 'hidden',
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
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 15,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: 15,
    width: '90%',
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

  manualPickerActionText: {
    fontSize: 16,
    fontWeight: '600',
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
  weekHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
    minWidth: 0,
  },
  monthHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  weekHeaderTitle: {
    ...TYPOGRAPHY.headline,
    color: '#7D5A50',
    marginBottom: 6,
    textAlign: 'center',
  },
  monthHeaderTitle: {
    ...TYPOGRAPHY.headline,
    color: '#7D5A50',
    marginBottom: 4,
    textAlign: 'center',
  },
  weekHeaderSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: '#7D5A50',
    textAlign: 'center',
  },
  todayEmptyHint: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 4,
    textAlign: 'center',
  },
  todayEmptyHintPlaceholder: {
    opacity: 0,
  },
  todayEmptyHintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    ...TYPOGRAPHY.headline,
    color: '#5D4A40',
    textAlign: 'center',
    marginBottom: SECTION_GAP_BOTTOM,
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
    ...TYPOGRAPHY.headline,
    color: '#7D5A50',
    marginBottom: SECTION_GAP_BOTTOM,
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
    ...METRIC_TEXT,
    color: '#7D5A50',
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: '#7D5A50',
    textAlign: 'center',
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
    ...TYPOGRAPHY.headline,
    color: '#7D5A50',
    marginBottom: SECTION_GAP_BOTTOM,
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
    ...TYPOGRAPHY.bodySmall,
    color: '#7D5A50',
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
    ...TYPOGRAPHY.label,
    color: '#7D5A50',
    marginBottom: 6,
  },
  highlightValue: {
    ...METRIC_TEXT,
    color: '#8E4EC6',
    fontVariant: ['tabular-nums'],
  },

});
