import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { Colors } from '@/constants/Colors';
import {
  CycleBleedingIntensity,
  CycleCervicalMucus,
  CycleDailyLog,
  CycleLhTestResult,
  CycleTrackerData,
  getCycleTrackerData,
  saveCycleSettings,
  upsertCyclePeriod,
  upsertCycleDailyLog,
} from '@/lib/cycleData';
import {
  buildCycleHistory,
  buildCyclePrediction,
  CycleFactorKey,
  CyclePrediction,
  CyclePhaseSegment,
} from '@/lib/cyclePredictions';
import {
  DEFAULT_CYCLE_REMINDER_SETTINGS,
  loadCycleReminderSettings,
  requestCycleReminderPermission,
  saveCycleReminderSettings,
  syncCycleReminders,
  type CycleReminderSettings,
} from '@/lib/cycleReminders';
import { getCachedUser } from '@/lib/supabase';
import {
  DEFAULT_CYCLE_LOCALE,
  translateCycleText,
} from '@/lib/cycleTranslations';

const ACTIVE_CYCLE_LOCALE = DEFAULT_CYCLE_LOCALE;
const CYCLE_DATE_LOCALE = ACTIVE_CYCLE_LOCALE === 'de' ? 'de-DE' : 'en-US';
const t = (key: string, params?: Record<string, string | number>) =>
  translateCycleText(ACTIVE_CYCLE_LOCALE, key, params);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_PAD = 18;

const C_PERIOD = '#E8706A';
const C_FOLLICULAR = '#C8B5A0';
const C_FERTILE = '#C4A8E0';
const C_OVULATION = '#8E4EC6';
const C_LUTEAL = '#A88EC0';
const C_CALENDAR = '#6BBF9C';

const PHASE_COLORS = {
  period: C_PERIOD,
  follicular: C_FOLLICULAR,
  fertile: C_FERTILE,
  luteal: C_LUTEAL,
} as const;

const FACTOR_COLORS: Record<CycleFactorKey, string> = {
  calendar: C_CALENDAR,
  lh: C_OVULATION,
  mucus: C_FERTILE,
  bbt: C_FOLLICULAR,
};

const LEGEND = [
  { labelKey: 'hero.legend.period', color: C_PERIOD },
  { labelKey: 'hero.legend.fertile', color: C_FERTILE },
  { labelKey: 'hero.legend.ovulation', color: C_OVULATION },
  { labelKey: 'hero.legend.luteal', color: C_LUTEAL },
] as const;

const WEEK_DAYS_DE = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

const LH_OPTIONS: { value: CycleLhTestResult | null; label: string }[] = [
  { value: null, label: 'Kein Test' },
  { value: 'negative', label: 'Negativ' },
  { value: 'high', label: 'High' },
  { value: 'peak', label: 'Peak' },
];

const MUCUS_OPTIONS: { value: CycleCervicalMucus | null; label: string }[] = [
  { value: null, label: 'Keine Angabe' },
  { value: 'dry', label: 'Trocken' },
  { value: 'sticky', label: 'Klebrig' },
  { value: 'creamy', label: 'Cremig' },
  { value: 'watery', label: 'Wässrig' },
  { value: 'eggwhite', label: 'Eiklar' },
];

const BLEEDING_OPTIONS: { value: CycleBleedingIntensity; label: string }[] = [
  { value: 'none', label: 'Keine Blutung' },
  { value: 'light', label: 'Leicht' },
  { value: 'medium', label: 'Mittel' },
  { value: 'heavy', label: 'Stark' },
];

const BLEEDING_LABEL: Record<CycleBleedingIntensity, string> = {
  none: '—',
  light: 'Leicht',
  medium: 'Mittel',
  heavy: 'Stark',
};

const MUCUS_LABEL: Record<string, string> = {
  dry: 'Trocken',
  sticky: 'Klebrig',
  creamy: 'Cremig',
  watery: 'Wässrig',
  eggwhite: 'Eiklar',
};

const LH_LABEL: Record<string, string> = {
  negative: 'Negativ',
  high: 'High',
  peak: 'Peak ✓',
};

const PHASE_META = {
  period: { label: 'Periode', color: C_PERIOD },
  follicular: { label: 'Follikelphase', color: C_FOLLICULAR },
  fertile: { label: 'Fruchtbares Fenster', color: C_FERTILE },
  luteal: { label: 'Lutealphase', color: C_LUTEAL },
} as const;

const SYMPTOMS = [
  { emoji: '🫶', label: 'Brustspannen' },
  { emoji: '😮‍💨', label: 'Blähungen' },
  { emoji: '😣', label: 'Krämpfe' },
  { emoji: '🤕', label: 'Kopfschmerzen' },
  { emoji: '😤', label: 'Reizbar' },
  { emoji: '💤', label: 'Müdigkeit' },
  { emoji: '🌸', label: 'Libido hoch' },
  { emoji: '✨', label: 'Alles gut' },
] as const;

const CANVAS_SIZE = 230;
const STROKE_WIDTH = 22;
const GAP_DEG = 3;
const PILL_GAP = 10;
const PILL_WIDTH = (SCREEN_WIDTH - CONTENT_PAD * 2 - PILL_GAP) / 2;
const MIN_CYCLE_DATE = new Date(2000, 0, 1);
const DEFAULT_SETUP_CYCLE_LENGTH = 28;
const DEFAULT_SETUP_PERIOD_LENGTH = 5;
const DEFAULT_SETUP_LUTEAL_PHASE = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const IS_COMPACT_SCREEN = SCREEN_WIDTH < 390;
const MONTH_DAY_CELL_SIZE = Math.floor((SCREEN_WIDTH - 52) / 7);
const MONTH_DAY_CIRCLE_SIZE = Math.max(36, Math.min(IS_COMPACT_SCREEN ? 46 : 50, MONTH_DAY_CELL_SIZE - 4));
const MONTH_SHEET_PAST_MONTHS = 18;
const MONTH_SHEET_FUTURE_MONTHS = 12;

type ChartPhase = CyclePhaseSegment & { color: string };
type CalendarPeriodRange = { startDate: Date; endDate: Date };

const getDefaultLastPeriodStartDate = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - DEFAULT_SETUP_CYCLE_LENGTH);
  return date;
};

const dateToKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + amount);
  next.setHours(12, 0, 0, 0);
  return next;
};

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);
  return next;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year ?? 2000, (month ?? 1) - 1, day ?? 1);
  date.setHours(12, 0, 0, 0);
  return date;
};

const formatDateLong = (date: Date) =>
  date.toLocaleDateString(CYCLE_DATE_LOCALE, { day: 'numeric', month: 'long' });

const formatDateShort = (value: string | null) => {
  if (!value) return '—';
  return parseDateOnly(value).toLocaleDateString(CYCLE_DATE_LOCALE, { day: 'numeric', month: 'short' });
};

const formatDateRange = (startDate: string | null, endDate: string | null) => {
  if (!startDate || !endDate) return '—';
  return `${formatDateShort(startDate)}–${formatDateShort(endDate)}`;
};

const parseBbtInput = (value: string): number | null | 'invalid' => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return 'invalid';
  if (numeric < 34 || numeric > 42) return 'invalid';
  return Number(numeric.toFixed(2));
};

const buildFormFingerprint = (params: {
  bleedingIntensity: CycleBleedingIntensity;
  spotting: boolean;
  lh: CycleLhTestResult | null;
  mucus: CycleCervicalMucus | null;
  sex: boolean;
  bbt: string;
  symptoms: string[];
}) =>
  JSON.stringify({
    bleedingIntensity: params.bleedingIntensity,
    spotting: params.spotting,
    lh: params.lh,
    mucus: params.mucus,
    sex: params.sex,
    bbt: params.bbt.trim(),
    symptoms: [...params.symptoms].sort(),
  });

const mergeDailyLogs = (entries: CycleDailyLog[], entry: CycleDailyLog) => {
  const nextEntries = entries.filter((item) => item.entry_date !== entry.entry_date);
  nextEntries.push(entry);
  return nextEntries.sort(
    (left, right) => parseDateOnly(left.entry_date).getTime() - parseDateOnly(right.entry_date).getTime(),
  );
};

const diffDays = (left: Date, right: Date) =>
  Math.round((left.getTime() - right.getTime()) / DAY_MS);

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isSameMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const getMonthGrid = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
  const firstWeekday = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

  const gridStart = addDays(firstDayOfMonth, -firstWeekday);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

const getPhaseColorForDay = (day: number, phases: ChartPhase[], ovulationDay: number) => {
  if (day === ovulationDay) return C_OVULATION;
  const phase = phases.find((segment) => day >= segment.startDay && day <= segment.endDay);
  return phase?.color ?? null;
};

const isWithinRange = (date: Date, startDate: Date, endDate: Date) =>
  date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();

const buildActualPeriodRanges = (
  settings: CycleTrackerData['settings'],
  periods: CycleTrackerData['periods'],
) => {
  const ranges = new Map<string, CalendarPeriodRange>();

  periods.forEach((period) => {
    ranges.set(period.period_start_date, {
      startDate: parseDateOnly(period.period_start_date),
      endDate: parseDateOnly(period.period_end_date),
    });
  });

  if (settings?.last_period_start_date && settings.last_period_end_date) {
    ranges.set(settings.last_period_start_date, {
      startDate: parseDateOnly(settings.last_period_start_date),
      endDate: parseDateOnly(settings.last_period_end_date),
    });
  }

  return [...ranges.values()].sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
};

const getProjectionAnchorDate = (prediction: CyclePrediction, referenceDate: Date) => {
  if (prediction.lastPeriod.startDate) {
    return parseDateOnly(prediction.lastPeriod.startDate);
  }

  return addDays(referenceDate, -(prediction.currentDay - 1));
};

function CycleRing({
  isDark,
  currentDay,
  cycleLength,
  ovulationDay,
  phases,
}: {
  isDark: boolean;
  currentDay: number;
  cycleLength: number;
  ovulationDay: number;
  phases: ChartPhase[];
}) {
  const size = CANVAS_SIZE;
  const verticalPadding = 6;
  const sw = STROKE_WIDTH;
  const radius = (size - sw) / 2;
  const circumference = radius * 2 * Math.PI;
  const cx = size / 2;
  const cy = size / 2;

  const bgStroke = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)';
  const reflexStroke = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.45)';
  const gapFraction = GAP_DEG / 360;

  const arcs = useMemo(
    () =>
      phases.map((phase) => {
        const startFraction = (phase.startDay - 1) / cycleLength + gapFraction / 2;
        const endFraction = phase.endDay / cycleLength - gapFraction / 2;
        const arcLength = Math.max(0, (endFraction - startFraction) * circumference);
        const offset = startFraction * circumference;
        return { arcLength, offset, color: phase.color };
      }),
    [cycleLength, circumference, gapFraction, phases],
  );

  const ovulationLength = circumference / cycleLength;
  const ovulationOffset = ((ovulationDay - 1) / cycleLength) * circumference;

  const todayFraction = (currentDay - 0.5) / cycleLength;
  const todayRadians = todayFraction * 2 * Math.PI - Math.PI / 2;
  const markerX = cx + radius * Math.cos(todayRadians);
  const markerY = cy + radius * Math.sin(todayRadians);

  return (
    <Svg
      width={size}
      height={size + verticalPadding * 2}
      viewBox={`0 ${-verticalPadding} ${size} ${size + verticalPadding * 2}`}
    >
      <SvgCircle cx={cx} cy={cy} r={radius} stroke={bgStroke} strokeWidth={sw} fill="none" />

      {arcs.map((arc, index) => (
        <SvgCircle
          key={`${arc.color}-${index}`}
          cx={cx}
          cy={cy}
          r={radius}
          stroke={arc.color}
          strokeWidth={sw}
          strokeDasharray={`${arc.arcLength} ${circumference - arc.arcLength}`}
          strokeDashoffset={-arc.offset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      ))}

      <SvgCircle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={C_OVULATION}
        strokeWidth={sw}
        strokeDasharray={`${ovulationLength} ${circumference - ovulationLength}`}
        strokeDashoffset={-ovulationOffset}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90, ${cx}, ${cy})`}
      />

      <SvgCircle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={reflexStroke}
        strokeWidth={sw * 0.55}
        strokeDasharray={`${(circumference * 0.22).toFixed(1)} ${circumference.toFixed(1)}`}
        strokeDashoffset={(circumference * 0.15).toFixed(1)}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90, ${cx}, ${cy})`}
      />

      <SvgCircle cx={markerX} cy={markerY} r={sw / 2 + 5} fill="white" fillOpacity={0.95} />
      <SvgCircle cx={markerX} cy={markerY} r={sw / 2} fill={C_OVULATION} />
      <SvgCircle cx={markerX} cy={markerY} r={4.5} fill="white" fillOpacity={0.9} />
    </Svg>
  );
}

function WeekCalendarStrip({
  isDark,
  referenceDate,
  currentDay,
  cycleLength,
  ovulationDay,
  phases,
  onSelectDate,
}: {
  isDark: boolean;
  referenceDate: Date;
  currentDay: number;
  cycleLength: number;
  ovulationDay: number;
  phases: ChartPhase[];
  onSelectDate: (date: Date) => void;
}) {
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  const weekData = useMemo(() => {
    const selectedDate = new Date(referenceDate.getTime());
    selectedDate.setHours(0, 0, 0, 0);
    const actualToday = new Date();
    actualToday.setHours(0, 0, 0, 0);
    const dayOfWeek = selectedDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + mondayOffset + index);
      const offset = Math.round((date.getTime() - selectedDate.getTime()) / (24 * 60 * 60 * 1000));
      return {
        date,
        dateNum: date.getDate(),
        cycleDay: currentDay + offset,
        isSelected: offset === 0,
        isToday: isSameDay(date, actualToday),
      };
    });
  }, [currentDay, referenceDate]);

  return (
    <View style={styles.weekStrip}>
      {weekData.map((entry, index) => {
        const color = getPhaseColorForDay(entry.cycleDay, phases, ovulationDay);
        const numColor = entry.isSelected
          ? textPrimary
          : color === C_OVULATION || color === C_FERTILE
            ? C_OVULATION
            : color === C_PERIOD
              ? C_PERIOD
              : textSecondary;

        return (
          <TouchableOpacity
            key={`${entry.dateNum}-${index}`}
            style={styles.weekCol}
            onPress={() => onSelectDate(entry.date)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.weekLabel,
                { color: entry.isToday ? C_OVULATION : textSecondary },
                entry.isToday && styles.weekLabelToday,
              ]}
            >
              {entry.isToday ? t('common.todayUpper') : WEEK_DAYS_DE[index]}
            </Text>
            <View
              style={[
                styles.weekCircle,
                entry.isSelected && {
                  borderColor: textPrimary,
                  borderWidth: 2,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.10)'
                    : 'rgba(142,78,198,0.08)',
                },
              ]}
            >
              <Text
                style={[
                  styles.weekNum,
                  { color: numColor },
                  entry.isSelected && { fontWeight: '700' },
                ]}
              >
                {entry.dateNum}
              </Text>
            </View>
            {entry.isToday ? <View style={[styles.weekTodayDot, { backgroundColor: textSecondary }]} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CalendarMonthSection({
  monthDate,
  selectedDate,
  today,
  logMap,
  actualPeriodRanges,
  prediction,
  projectionAnchorDate,
  onSelectDate,
  isDark,
}: {
  monthDate: Date;
  selectedDate: Date;
  today: Date;
  logMap: Map<string, CycleDailyLog>;
  actualPeriodRanges: CalendarPeriodRange[];
  prediction: CyclePrediction;
  projectionAnchorDate: Date;
  onSelectDate: (date: Date) => void;
  isDark: boolean;
}) {
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const glassOverlay = isDark ? 'rgba(10,10,16,0.36)' : 'rgba(255,255,255,0.16)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.26)';
  const gridDates = useMemo(() => getMonthGrid(monthDate), [monthDate]);
  const monthLabel = useMemo(
    () => monthDate.toLocaleDateString(CYCLE_DATE_LOCALE, { month: 'long', year: 'numeric' }),
    [monthDate],
  );

  return (
    <LiquidGlassCard
      style={styles.monthSheetSection}
      intensity={28}
      overlayColor={glassOverlay}
      borderColor={glassBorder}
    >
      <Text style={[styles.monthSheetMonthLabel, { color: textPrimary }]}>{monthLabel}</Text>

      <View style={styles.monthSheetGrid}>
        {gridDates.map((date) => {
          const key = dateToKey(date);
          const inCurrentMonth = isSameMonth(date, monthDate);
          if (!inCurrentMonth) {
            return <View key={key} style={styles.monthSheetSpacerCell} />;
          }

          const log = logMap.get(key);
          const isTodayDate = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDate);
          const dayHasBleedingLog = Boolean(log && (log.bleeding_intensity !== 'none' || log.spotting));
          const isActualPeriod = dayHasBleedingLog || actualPeriodRanges.some((range) => isWithinRange(date, range.startDate, range.endDate));
          const cycleIndex = Math.floor(diffDays(date, projectionAnchorDate) / prediction.cycleLength);
          const cycleStartDate = addDays(projectionAnchorDate, cycleIndex * prediction.cycleLength);
          const predictedPeriodStartDate = cycleStartDate;
          const predictedPeriodEndDate = addDays(cycleStartDate, prediction.periodLength - 1);
          const predictedOvulationDate = addDays(cycleStartDate, prediction.ovulationDay - 1);
          const predictedFertileStartDate = addDays(cycleStartDate, prediction.fertileStartDay - 1);
          const predictedFertileEndDate = addDays(cycleStartDate, prediction.fertileEndDay - 1);
          const isPredictedPeriod =
            !isActualPeriod &&
            date.getTime() >= today.getTime() &&
            isWithinRange(date, predictedPeriodStartDate, predictedPeriodEndDate);
          const isFertileDay =
            !isActualPeriod && isWithinRange(date, predictedFertileStartDate, predictedFertileEndDate);
          const isOvulationDay = !isActualPeriod && isSameDay(date, predictedOvulationDate);
          const hasEntryDot = Boolean(log && !dayHasBleedingLog);

          let textColor = textPrimary;
          if (isActualPeriod) {
            textColor = '#FFFFFF';
          } else if (isPredictedPeriod) {
            textColor = C_PERIOD;
          } else if (isSelected || isOvulationDay) {
            textColor = C_OVULATION;
          } else if (isFertileDay || isTodayDate) {
            textColor = C_FERTILE;
          }

          return (
            <TouchableOpacity
              key={key}
              style={styles.monthSheetDayCell}
              onPress={() => onSelectDate(date)}
              activeOpacity={0.8}
            >
              {isTodayDate ? (
                <Text style={[styles.monthSheetTodayLabel, { color: textPrimary }]}>
                  {t('common.todayUpper')}
                </Text>
              ) : (
                <View style={styles.monthSheetTodaySpacer} />
              )}

              <View
                style={[
                  styles.monthSheetDayCircle,
                  isActualPeriod && styles.monthSheetDayCirclePeriod,
                  isPredictedPeriod && styles.monthSheetDayCirclePredictedPeriod,
                  !isActualPeriod &&
                    !isPredictedPeriod &&
                    isFertileDay &&
                    styles.monthSheetDayCircleFertile,
                  !isActualPeriod &&
                    !isPredictedPeriod &&
                    isOvulationDay &&
                    styles.monthSheetDayCircleOvulation,
                  isActualPeriod &&
                    isSelected && {
                      borderColor: 'rgba(255,255,255,0.95)',
                      borderWidth: 2.5,
                    },
                  !isActualPeriod &&
                    isSelected && {
                      borderColor: isPredictedPeriod ? C_PERIOD : C_OVULATION,
                      borderWidth: 2.5,
                    },
                ]}
              >
                <Text style={[styles.monthSheetDayText, { color: textColor }]}>{date.getDate()}</Text>
              </View>

              <View style={styles.monthSheetEntryDotSlot}>
                {hasEntryDot ? (
                  <View
                    style={[
                      styles.monthSheetEntryDot,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.72)' : `${C_OVULATION}88` },
                    ]}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </LiquidGlassCard>
  );
}

function MonthCalendarOverlay({
  visible,
  baseMonthDate,
  selectedDate,
  trackerData,
  prediction,
  referenceDate,
  onClose,
  onSelectDate,
  onJumpToToday,
  isDark,
}: {
  visible: boolean;
  baseMonthDate: Date;
  selectedDate: Date;
  trackerData: CycleTrackerData | null;
  prediction: CyclePrediction;
  referenceDate: Date;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  onJumpToToday: () => void;
  isDark: boolean;
}) {
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const divider = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)';
  const headerOverlay = isDark ? 'rgba(8,8,14,0.40)' : 'rgba(255,255,255,0.16)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.26)';
  const scrollRef = useRef<ScrollView | null>(null);
  const monthSectionOffsetsRef = useRef<Record<string, number>>({});
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  }, []);

  const logMap = useMemo(() => {
    const map = new Map<string, CycleDailyLog>();
    (trackerData?.dailyLogs ?? []).forEach((entry) => map.set(entry.entry_date, entry));
    return map;
  }, [trackerData?.dailyLogs]);

  const actualPeriodRanges = useMemo(
    () => buildActualPeriodRanges(trackerData?.settings ?? null, trackerData?.periods ?? []),
    [trackerData?.periods, trackerData?.settings],
  );

  const projectionAnchorDate = useMemo(
    () => getProjectionAnchorDate(prediction, referenceDate),
    [prediction, referenceDate],
  );

  const activeMonthKey = useMemo(
    () => `${baseMonthDate.getFullYear()}-${baseMonthDate.getMonth()}`,
    [baseMonthDate],
  );

  const monthDates = useMemo(() => {
    const activeMonth = startOfMonth(baseMonthDate);
    return Array.from(
      { length: MONTH_SHEET_PAST_MONTHS + MONTH_SHEET_FUTURE_MONTHS + 1 },
      (_, index) => addMonths(activeMonth, index - MONTH_SHEET_PAST_MONTHS),
    );
  }, [baseMonthDate]);

  const handleMonthSectionLayout = useCallback(
    (monthKey: string, y: number) => {
      monthSectionOffsetsRef.current[monthKey] = y;
      if (!visible || monthKey !== activeMonthKey) return;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
      });
    },
    [activeMonthKey, visible],
  );

  if (!visible) return null;

  return (
    <View style={styles.monthSheetOverlay}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={
            isDark
              ? ['rgba(14,10,28,0.88)', 'rgba(12,12,18,0.82)']
              : ['rgba(250,243,252,0.96)', 'rgba(247,238,232,0.94)']
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </View>

      <SafeAreaView style={styles.monthSheetContainer}>
        <LiquidGlassCard
          style={styles.monthSheetHeaderCard}
          intensity={28}
          overlayColor={headerOverlay}
          borderColor={headerBorder}
        >
          <View style={styles.monthSheetHeader}>
            <TouchableOpacity style={styles.monthSheetCloseButton} onPress={onClose}>
              <IconSymbol name="xmark" size={24} color={textPrimary} />
            </TouchableOpacity>

            <View style={styles.monthSheetTitleChip}>
              <Text style={styles.monthSheetTitleChipText}>{t('monthLauncher.title')}</Text>
              <Text style={[styles.monthSheetTitleChipHint, { color: textSecondary }]}> 
                {t('monthLauncher.selectDays')}
              </Text>
            </View>

            <TouchableOpacity style={styles.monthSheetTodayButton} onPress={onJumpToToday}>
              <Text style={styles.monthSheetTodayButtonText}>{t('common.today')}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.monthSheetWeekdayRow, { borderBottomColor: divider }]}>
            {WEEK_DAYS_DE.map((label, index) => (
              <Text key={`${label}-${index}`} style={[styles.monthSheetWeekdayLabel, { color: textSecondary }]}>
                {label}
              </Text>
            ))}
          </View>
        </LiquidGlassCard>

        <ScrollView
          ref={scrollRef}
          style={styles.monthSheetScroll}
          contentContainerStyle={styles.monthSheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {monthDates.map((monthDate, index) => (
            <View
              key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
              onLayout={(event) => {
                handleMonthSectionLayout(
                  `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
                  event.nativeEvent.layout.y,
                );
              }}
            >
              <CalendarMonthSection
                monthDate={monthDate}
                selectedDate={selectedDate}
                today={today}
                logMap={logMap}
                actualPeriodRanges={actualPeriodRanges}
                prediction={prediction}
                projectionAnchorDate={projectionAnchorDate}
                onSelectDate={onSelectDate}
                isDark={isDark}
              />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InfoPill({
  label,
  value,
  color,
  isDark,
  fullWidth = false,
}: {
  label: string;
  value: string;
  color: string;
  isDark: boolean;
  fullWidth?: boolean;
}) {
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  return (
    <LiquidGlassCard style={[styles.infoPill, fullWidth && styles.infoPillFullWidth]}>
      <View style={styles.infoPillHeader}>
        <View style={[styles.infoPillDot, { backgroundColor: color }]} />
        <Text style={[styles.infoPillLabel, { color: textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.infoPillValue, { color: textPrimary }]}>{value}</Text>
    </LiquidGlassCard>
  );
}

function FactorRow({
  label,
  detail,
  color,
  active,
  pct,
  isDark,
}: {
  label: string;
  detail: string;
  color: string;
  active: boolean;
  pct: number;
  isDark: boolean;
}) {
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  return (
    <View style={styles.factorRow}>
      <View
        style={[
          styles.factorDot,
          active
            ? { backgroundColor: color }
            : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: color },
        ]}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.factorLabel, { color: textPrimary }]}>{label}</Text>
        <Text style={[styles.factorDetail, { color: textSecondary }]}>{detail}</Text>
      </View>
      <Text style={[styles.factorPct, { color }]}>{pct}%</Text>
    </View>
  );
}

function ChipRow<T extends string | null>({
  options,
  value,
  onChange,
  isDark,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (nextValue: T) => void;
  isDark: boolean;
}) {
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              active
                ? { backgroundColor: C_OVULATION }
                : { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? '#FFFFFF' : textSecondary }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SymptomChip({
  emoji,
  label,
  selected,
  onToggle,
  isDark,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[
        styles.symptomChip,
        selected
          ? { backgroundColor: `${C_OVULATION}22`, borderColor: `${C_OVULATION}80` }
          : {
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
              borderColor: 'transparent',
            },
      ]}
    >
      <Text style={styles.symptomEmoji}>{emoji}</Text>
      <Text style={[styles.symptomLabel, { color: selected ? C_OVULATION : textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SettingToggleRow({
  label,
  helper,
  value,
  onToggle,
  disabled,
  isDark,
}: {
  label: string;
  helper?: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  isDark: boolean;
}) {
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  return (
    <View style={[styles.settingToggleRow, disabled && { opacity: 0.55 }]}>
      <View style={styles.settingToggleCopy}>
        <Text style={[styles.settingToggleLabel, { color: textPrimary }]}>{label}</Text>
        {helper ? (
          <Text style={[styles.settingToggleHelper, { color: textSecondary }]}>{helper}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{
          false: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)',
          true: `${C_OVULATION}88`,
        }}
        thumbColor={value ? C_OVULATION : '#FFFFFF'}
      />
    </View>
  );
}

function QuickEntryTile({
  icon,
  label,
  value,
  helper,
  hasValue,
  expanded,
  onPress,
  accentColor,
  isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  hasValue: boolean;
  expanded: boolean;
  onPress: () => void;
  accentColor: string;
  isDark: boolean;
}) {
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.quickTile,
        hasValue
          ? { backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}50` }
          : {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
        expanded && { borderColor: accentColor, borderWidth: 2 },
      ]}
    >
      <View
        style={[
          styles.quickTileIconWrap,
          {
            backgroundColor: hasValue
              ? `${accentColor}22`
              : isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        {icon}
      </View>
      <View style={styles.quickTileCopy}>
        <Text style={[styles.quickTileLabel, { color: textPrimary }]}>{label}</Text>
        <Text style={[styles.quickTileHelper, { color: hasValue ? accentColor : textSecondary }]}>
          {helper}
        </Text>
      </View>
      <Text
        style={[
          styles.quickTileValue,
          { color: hasValue ? textPrimary : textSecondary },
        ]}
      >
        {value}
      </Text>
      {hasValue ? (
        <View
          style={[
            styles.quickTileStatusBadge,
            { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}44` },
          ]}
        >
          <Text style={[styles.quickTileStatusText, { color: accentColor }]}>Erfasst</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function PeriodTrackerScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const stackInfoPills = windowWidth < 360;
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const divider = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  const [trackerData, setTrackerData] = useState<CycleTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lh, setLh] = useState<CycleLhTestResult | null>(null);
  const [mucus, setMucus] = useState<CycleCervicalMucus | null>(null);
  const [sex, setSex] = useState(false);
  const [bleedingIntensity, setBleedingIntensity] = useState<CycleBleedingIntensity>('none');
  const [spotting, setSpotting] = useState(false);
  const [bbt, setBbt] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  });
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(1);
    return date;
  });
  const [expandedSection, setExpandedSection] = useState<'period' | 'mucus' | 'lh' | 'bbt' | 'symptoms' | null>(null);
  const [showLogEntryModal, setShowLogEntryModal] = useState(false);
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showInitialSetupPrompt, setShowInitialSetupPrompt] = useState(false);
  const [isSavingInitialSetup, setIsSavingInitialSetup] = useState(false);
  const [showInitialSetupDatePicker, setShowInitialSetupDatePicker] = useState(false);
  const [initialLastPeriodStartDate, setInitialLastPeriodStartDate] = useState<Date>(
    getDefaultLastPeriodStartDate(),
  );

  const hydratedControlsRef = useRef(false);
  const persistedFingerprintRef = useRef('');
  const saveErrorShownRef = useRef(false);
  const initialSetupPromptShownRef = useRef(false);

  const actualTodayKey = useMemo(() => dateToKey(new Date()), []);
  const selectedDateKey = useMemo(() => dateToKey(selectedDate), [selectedDate]);
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  }, []);
  const maxCycleDate = useMemo(() => new Date(today.getTime()), [today]);

  const applyTodayLogToControls = useCallback((log: CycleDailyLog | null) => {
    hydratedControlsRef.current = false;
    setBleedingIntensity(log?.bleeding_intensity ?? 'none');
    setSpotting(Boolean(log?.spotting));
    setLh(log?.lh_test_result ?? null);
    setMucus(log?.cervical_mucus ?? null);
    setSex(Boolean(log?.had_sex));
    setBbt(log?.bbt_celsius !== null && log?.bbt_celsius !== undefined ? String(log.bbt_celsius) : '');
    setSelectedSymptoms(log?.symptoms ?? []);
    persistedFingerprintRef.current = buildFormFingerprint({
      bleedingIntensity: log?.bleeding_intensity ?? 'none',
      spotting: Boolean(log?.spotting),
      lh: log?.lh_test_result ?? null,
      mucus: log?.cervical_mucus ?? null,
      sex: Boolean(log?.had_sex),
      bbt: log?.bbt_celsius !== null && log?.bbt_celsius !== undefined ? String(log.bbt_celsius) : '',
      symptoms: log?.symptoms ?? [],
    });
    hydratedControlsRef.current = true;
  }, []);

  const loadTrackerData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
      }

      const result = await getCycleTrackerData({ logWindowDays: 365, periodLimit: 18 });
      if (result.error || !result.data) {
        console.error('Failed to load cycle tracker data:', result.error);
        setDataError(
          result.error instanceof Error
            ? result.error.message
            : t('screen.loadError'),
        );
        setTrackerData({
          settings: null,
          periods: [],
          dailyLogs: [],
          todayLog: null,
        });
        applyTodayLogToControls(null);
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      setDataError(null);
      setTrackerData(result.data);
      if (!silent) {
        setLoading(false);
      }
    },
    [applyTodayLogToControls],
  );

  useEffect(() => {
    void loadTrackerData();
  }, [loadTrackerData]);

  useEffect(() => {
    if (!trackerData || dataError || initialSetupPromptShownRef.current) return;

    const hasSeedPeriod =
      trackerData.periods.length > 0 || Boolean(trackerData.settings?.last_period_start_date);
    if (hasSeedPeriod) return;

    setInitialLastPeriodStartDate(getDefaultLastPeriodStartDate());
    setShowInitialSetupPrompt(true);
    initialSetupPromptShownRef.current = true;
  }, [dataError, trackerData]);

  const prediction = useMemo(
    () =>
      buildCyclePrediction({
        settings: trackerData?.settings ?? null,
        periods: trackerData?.periods ?? [],
        dailyLogs: trackerData?.dailyLogs ?? [],
        referenceDate: selectedDate,
        locale: ACTIVE_CYCLE_LOCALE,
      }),
    [selectedDate, trackerData?.dailyLogs, trackerData?.periods, trackerData?.settings],
  );

  const selectedLog = useMemo(
    () => trackerData?.dailyLogs.find((entry) => entry.entry_date === selectedDateKey) ?? null,
    [selectedDateKey, trackerData?.dailyLogs],
  );

  useEffect(() => {
    if (!trackerData) return;
    applyTodayLogToControls(selectedLog);
  }, [applyTodayLogToControls, selectedLog, trackerData]);

  const chartPhases = useMemo<ChartPhase[]>(
    () =>
      prediction.phases.map((phase) => ({
        ...phase,
        color: PHASE_COLORS[phase.kind],
      })),
    [prediction.phases],
  );

  // Prognose mit "heute" als Referenz – für Erinnerungen und die
  // Laufzeit des aktuellen Zyklus (unabhängig vom ausgewählten Datum).
  const todayPrediction = useMemo(
    () =>
      buildCyclePrediction({
        settings: trackerData?.settings ?? null,
        periods: trackerData?.periods ?? [],
        dailyLogs: trackerData?.dailyLogs ?? [],
        locale: ACTIVE_CYCLE_LOCALE,
      }),
    [trackerData?.dailyLogs, trackerData?.periods, trackerData?.settings],
  );

  const cycleHistory = useMemo(
    () =>
      buildCycleHistory({
        settings: trackerData?.settings ?? null,
        periods: trackerData?.periods ?? [],
        dailyLogs: trackerData?.dailyLogs ?? [],
        maxCycles: 6,
      }),
    [trackerData?.dailyLogs, trackerData?.periods, trackerData?.settings],
  );

  const [reminderUserId, setReminderUserId] = useState<string | null>(null);
  const [reminderSettings, setReminderSettings] = useState<CycleReminderSettings>(
    DEFAULT_CYCLE_REMINDER_SETTINGS,
  );
  const [reminderPermissionDenied, setReminderPermissionDenied] = useState(false);
  const [isSavingLifePhase, setIsSavingLifePhase] = useState(false);
  const [showFactorDetails, setShowFactorDetails] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await getCachedUser();
      const userId = data.user?.id ?? null;
      if (!active || !userId) return;
      setReminderUserId(userId);
      const stored = await loadCycleReminderSettings(userId);
      if (active) setReminderSettings(stored);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!reminderUserId || !trackerData || dataError) return;

    void syncCycleReminders({
      userId: reminderUserId,
      settings: reminderSettings,
      prediction: todayPrediction,
      locale: ACTIVE_CYCLE_LOCALE,
    }).then((result) => {
      setReminderPermissionDenied(
        !result.permissionGranted &&
          (reminderSettings.periodReminder || reminderSettings.fertileReminder),
      );
    });
  }, [dataError, reminderSettings, reminderUserId, todayPrediction, trackerData]);

  const handleToggleReminder = useCallback(
    async (key: keyof CycleReminderSettings) => {
      if (!reminderUserId) return;
      const next = { ...reminderSettings, [key]: !reminderSettings[key] };

      if ((key === 'periodReminder' || key === 'fertileReminder') && next[key]) {
        const granted = await requestCycleReminderPermission();
        setReminderPermissionDenied(!granted);
        if (!granted) {
          Alert.alert(
            t('reminders.permissionAlert.title'),
            t('reminders.permissionAlert.body'),
          );
        }
      }

      setReminderSettings(next);
      await saveCycleReminderSettings(reminderUserId, next);
    },
    [reminderSettings, reminderUserId],
  );

  const handleToggleLifePhase = useCallback(
    async (key: 'is_postpartum' | 'is_breastfeeding' | 'is_perimenopause') => {
      if (isSavingLifePhase) return;
      const current = Boolean(trackerData?.settings?.[key]);
      setIsSavingLifePhase(true);
      try {
        const result = await saveCycleSettings({ [key]: !current });
        if (result.error) throw result.error;
        await loadTrackerData({ silent: true });
      } catch (error) {
        console.error('Failed to update cycle life phase:', error);
        Alert.alert(t('lifePhase.saveError.title'), t('lifePhase.saveError.body'));
      } finally {
        setIsSavingLifePhase(false);
      }
    },
    [isSavingLifePhase, loadTrackerData, trackerData?.settings],
  );

  useEffect(() => {
    if (!hydratedControlsRef.current || !trackerData) return;

    const parsedBbt = parseBbtInput(bbt);
    if (parsedBbt === 'invalid') return;

    const fingerprint = buildFormFingerprint({
      bleedingIntensity,
      spotting,
      lh,
      mucus,
      sex,
      bbt,
      symptoms: selectedSymptoms,
    });
    if (fingerprint === persistedFingerprintRef.current) return;
    setSaveStatus('saving');

    const baseLog = selectedLog;
    const hasMeaningfulData = Boolean(
      bleedingIntensity !== 'none' ||
        spotting ||
      lh ||
        mucus ||
        sex ||
        parsedBbt !== null ||
        selectedSymptoms.length ||
        baseLog?.pain_score !== null ||
        baseLog?.pms_score !== null,
    );

    if (!hasMeaningfulData && !baseLog) {
      persistedFingerprintRef.current = fingerprint;
      return;
    }

    const timeoutId = setTimeout(async () => {
      const saveResult = await upsertCycleDailyLog({
        entry_date: selectedDateKey,
        bleeding_intensity: bleedingIntensity,
        spotting,
        cervical_mucus: mucus,
        lh_test_result: lh,
        bbt_celsius: parsedBbt,
        had_sex: sex,
        pain_score: baseLog?.pain_score ?? null,
        pms_score: baseLog?.pms_score ?? null,
        symptoms: selectedSymptoms,
        cycle_notes: baseLog?.cycle_notes ?? null,
        sleep_hours: baseLog?.sleep_hours ?? null,
        stress_level: baseLog?.stress_level ?? null,
        illness: baseLog?.illness ?? false,
        travel: baseLog?.travel ?? false,
        alcohol_units: baseLog?.alcohol_units ?? null,
      });

      if (saveResult.error || !saveResult.data) {
        setSaveStatus('idle');
        console.error('Failed to save cycle daily log:', saveResult.error);
        if (!saveErrorShownRef.current) {
          saveErrorShownRef.current = true;
          Alert.alert(t('common.error'), t('log.saveError'));
        }
        return;
      }

      saveErrorShownRef.current = false;
      persistedFingerprintRef.current = fingerprint;
      setSaveStatus('saved');
      setTrackerData((current) => {
        if (!current) return current;
        return {
          ...current,
          todayLog: selectedDateKey === actualTodayKey ? saveResult.data ?? null : current.todayLog,
          dailyLogs: mergeDailyLogs(current.dailyLogs, saveResult.data),
        };
      });
    }, 650);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [actualTodayKey, bbt, bleedingIntensity, lh, mucus, selectedDateKey, selectedLog, selectedSymptoms, sex, spotting, trackerData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTrackerData({ silent: true });
    setRefreshing(false);
  }, [loadTrackerData]);

  const toggleSymptom = useCallback((label: string) => {
    setSelectedSymptoms((current) =>
      current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label],
    );
  }, []);

  const toggleSection = useCallback(
    (section: 'period' | 'mucus' | 'lh' | 'bbt' | 'symptoms') => {
      setExpandedSection((current) => (current === section ? null : section));
    },
    [],
  );

  const handleSelectDate = useCallback((date: Date) => {
    const nextDate = new Date(date.getTime());
    nextDate.setHours(12, 0, 0, 0);
    setSelectedDate(nextDate);

    const monthAnchor = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1, 12, 0, 0, 0);
    if (!isSameMonth(monthAnchor, calendarMonthDate)) {
      setCalendarMonthDate(monthAnchor);
    }
  }, [calendarMonthDate]);

  const changeSelectedDate = useCallback((offset: number) => {
    handleSelectDate(addDays(selectedDate, offset));
  }, [handleSelectDate, selectedDate]);

  const openMonthCalendar = useCallback(() => {
    setCalendarMonthDate(startOfMonth(selectedDate));
    setShowMonthCalendar(true);
  }, [selectedDate]);

  const openLogEntryModal = useCallback(() => {
    setShowLogEntryModal(true);
  }, []);

  const handleQuickPeriodStart = useCallback(() => {
    setBleedingIntensity((current) => current === 'none' ? 'medium' : current);
    setSpotting(false);
    setExpandedSection('period');
    setShowLogEntryModal(true);
  }, []);

  const closeLogEntryModal = useCallback(() => {
    setShowLogEntryModal(false);
    setExpandedSection(null);
  }, []);

  const handleMonthCalendarSelectDate = useCallback((date: Date) => {
    handleSelectDate(date);
    setShowMonthCalendar(false);
  }, [handleSelectDate]);

  const handleMonthCalendarJumpToToday = useCallback(() => {
    setCalendarMonthDate(startOfMonth(today));
    handleSelectDate(today);
    setShowMonthCalendar(false);
  }, [handleSelectDate, today]);

  const handleInitialSetupDateChange = useCallback((_: unknown, selectedDate?: Date) => {
    if (!selectedDate) {
      if (Platform.OS === 'android') {
        setShowInitialSetupDatePicker(false);
      }
      return;
    }

    setInitialLastPeriodStartDate(selectedDate);
    if (Platform.OS === 'android') {
      setShowInitialSetupDatePicker(false);
    }
  }, []);

  const handleDismissInitialSetup = useCallback(() => {
    if (isSavingInitialSetup) return;
    setShowInitialSetupPrompt(false);
    setShowInitialSetupDatePicker(false);
  }, [isSavingInitialSetup]);

  const handleSaveInitialSetup = useCallback(async () => {
    const startDate = new Date(initialLastPeriodStartDate.getTime());
    startDate.setHours(12, 0, 0, 0);

    const todayDate = new Date();
    todayDate.setHours(12, 0, 0, 0);

    const configuredPeriodLength =
      trackerData?.settings?.average_period_length ?? DEFAULT_SETUP_PERIOD_LENGTH;
    const inferredEndDate = addDays(startDate, configuredPeriodLength - 1);
    const cappedEndDate =
      inferredEndDate.getTime() > todayDate.getTime() ? todayDate : inferredEndDate;

    const startDateKey = dateToKey(startDate);
    const endDateKey = dateToKey(cappedEndDate);

    try {
      setIsSavingInitialSetup(true);

      const [settingsResult, periodResult] = await Promise.all([
        saveCycleSettings({
          average_cycle_length:
            trackerData?.settings?.average_cycle_length ?? DEFAULT_SETUP_CYCLE_LENGTH,
          average_period_length: configuredPeriodLength,
          luteal_phase_length:
            trackerData?.settings?.luteal_phase_length ?? DEFAULT_SETUP_LUTEAL_PHASE,
          last_period_start_date: startDateKey,
          last_period_end_date: endDateKey,
          tracking_goal: trackerData?.settings?.tracking_goal ?? 'cycle_health',
        }),
        upsertCyclePeriod({
          period_start_date: startDateKey,
          period_end_date: endDateKey,
        }),
      ]);

      const error = settingsResult.error ?? periodResult.error;
      if (error) {
        throw error;
      }

      setShowInitialSetupPrompt(false);
      setShowInitialSetupDatePicker(false);
      await loadTrackerData({ silent: true });
    } catch (error) {
      console.error('Failed to save initial cycle setup:', error);
      const message =
        error instanceof Error
          ? error.message
          : t('setup.saveError');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsSavingInitialSetup(false);
    }
  }, [initialLastPeriodStartDate, loadTrackerData, trackerData?.settings]);

  const heroGradientStart = isDark ? 'rgba(142,78,198,0.22)' : 'rgba(196,168,224,0.38)';
  const heroGradientEnd = isDark ? 'rgba(0,0,0,0)' : 'rgba(255,248,245,0)';
  const selectedDateLabel = useMemo(() => formatDateLong(selectedDate), [selectedDate]);
  const monthOverviewLabel = useMemo(
    () => selectedDate.toLocaleDateString(CYCLE_DATE_LOCALE, { month: 'long', year: 'numeric' }),
    [selectedDate],
  );
  const logEntryDateLabel = useMemo(
    () => selectedDate.toLocaleDateString(CYCLE_DATE_LOCALE, { day: 'numeric', month: 'long' }),
    [selectedDate],
  );
  const isSelectedToday = useMemo(() => isSameDay(selectedDate, today), [selectedDate, today]);
  const activePhase = useMemo(
    () =>
      prediction.phases.find(
        (phase) =>
          prediction.currentDay >= phase.startDay && prediction.currentDay <= phase.endDay,
      ) ?? prediction.phases[prediction.phases.length - 1],
    [prediction.currentDay, prediction.phases],
  );
  const activePhaseMeta = activePhase ? PHASE_META[activePhase.kind] : PHASE_META.luteal;
  const isExtendedCycle = prediction.currentDay > prediction.cycleLength;
  const heroSubline = isExtendedCycle
    ? t('hero.extended', { day: prediction.currentDay })
    : prediction.subline;
  const symptomsSummary =
    selectedSymptoms.length > 0
      ? `${selectedSymptoms.length} ${
          selectedSymptoms.length === 1 ? 'Symptom erfasst' : 'Symptome erfasst'
        }`
      : 'Noch keine Symptome erfasst';

  if (loading && !trackerData) {
    return (
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <Header title={t('screen.title')} showBackButton />
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C_OVULATION} />
          </View>
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={t('screen.title')}
          showBackButton
          showBabySwitcher={false}
          rightContent={(
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowSettings(true)}
              accessibilityRole="button"
              accessibilityLabel={t('screen.settings.open')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="gear" size={22} color={textPrimary} />
            </TouchableOpacity>
          )}
        />

        <IOSBottomDatePicker
          visible={showInitialSetupDatePicker && Platform.OS === 'ios'}
          title={t('setup.pickerTitle')}
          value={initialLastPeriodStartDate}
          mode="date"
          minimumDate={MIN_CYCLE_DATE}
          maximumDate={maxCycleDate}
          onClose={() => setShowInitialSetupDatePicker(false)}
          onConfirm={(date) => {
            setInitialLastPeriodStartDate(date);
            setShowInitialSetupDatePicker(false);
          }}
          initialVariant="calendar"
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <LiquidGlassCard style={styles.heroCard}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <LinearGradient
                colors={[heroGradientStart, heroGradientEnd]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
              />
            </View>

            <View style={styles.heroDateRow}>
              <TouchableOpacity style={styles.heroNavButton} onPress={() => changeSelectedDate(-1)}>
                <IconSymbol name="chevron.left" size={18} color={textPrimary} />
              </TouchableOpacity>

              <Text style={[styles.heroDateLabel, { color: textSecondary }]}>{selectedDateLabel}</Text>

              <TouchableOpacity style={styles.heroNavButton} onPress={() => changeSelectedDate(1)}>
                <IconSymbol name="chevron.right" size={18} color={textPrimary} />
              </TouchableOpacity>
            </View>

            <WeekCalendarStrip
              isDark={isDark}
              referenceDate={selectedDate}
              currentDay={prediction.currentDay}
              cycleLength={prediction.cycleLength}
              ovulationDay={prediction.ovulationDay}
              phases={chartPhases}
              onSelectDate={handleSelectDate}
            />

            {!isSameDay(selectedDate, today) ? (
              <TouchableOpacity
                style={styles.heroTodayButton}
                onPress={() => handleSelectDate(today)}
              >
                <Text style={styles.heroTodayButtonText}>{t('hero.backToToday')}</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={[styles.heroHeadline, styles.centerText, { color: textPrimary }]}>
              {prediction.headline}
            </Text>
            <Text style={[styles.heroSubline, styles.centerText, { color: C_OVULATION }]}> 
              {heroSubline}
            </Text>
            <Text style={[styles.heroCaption, styles.centerText, { color: textSecondary }]}>
              {prediction.caption}
            </Text>
            {prediction.modeNote ? (
              <View
                style={[
                  styles.modeNoteWrap,
                  {
                    backgroundColor: isDark ? 'rgba(142,78,198,0.16)' : 'rgba(142,78,198,0.10)',
                    borderColor: isDark ? 'rgba(142,78,198,0.34)' : 'rgba(142,78,198,0.22)',
                  },
                ]}
              >
                <Text style={styles.modeNoteEmoji}>
                  {prediction.mode === 'perimenopause' ? '🌸' : '🤱'}
                </Text>
                <Text style={[styles.modeNoteText, { color: textSecondary }]}>
                  {prediction.modeNote}
                </Text>
              </View>
            ) : null}
            {dataError ? (
              <Text style={[styles.heroErrorText, styles.centerText]}>
                {t('hero.dataError', { error: dataError })}
              </Text>
            ) : null}

            <View style={styles.ringContainer}>
              <CycleRing
                isDark={isDark}
                currentDay={Math.min(prediction.currentDay, prediction.cycleLength)}
                cycleLength={prediction.cycleLength}
                ovulationDay={prediction.ovulationDay}
                phases={chartPhases}
              />
              <View style={styles.ringCenter} pointerEvents="none">
                <Text style={[styles.ringDayBig, { color: textPrimary }]}>{prediction.currentDay}</Text>
                <Text style={[styles.ringDayOf, { color: textSecondary }]}> 
                  {isExtendedCycle
                    ? t('hero.ringOpen')
                    : t('hero.ringDayOf', { cycleLength: prediction.cycleLength })}
                </Text>
              </View>
            </View>

            <View style={styles.legend}>
              {LEGEND.map((entry) => (
                <View key={entry.labelKey} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
                  <Text style={[styles.legendText, { color: textSecondary }]}>
                    {t(entry.labelKey)}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openMonthCalendar}
              style={styles.heroMonthButton}
            >
              <View style={styles.monthLauncherBadge}>
                <IconSymbol name="calendar" size={16} color={C_OVULATION} />
                <Text style={styles.monthLauncherBadgeText}>
                  {t('monthLauncher.label', { month: monthOverviewLabel })}
                </Text>
              </View>
              <View style={styles.monthLauncherArrow}>
                <IconSymbol name="chevron.right" size={16} color={C_OVULATION} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleQuickPeriodStart}
              style={[
                styles.quickPeriodButton,
                {
                  backgroundColor: bleedingIntensity !== 'none' ? `${C_PERIOD}18` : C_PERIOD,
                  borderColor: C_PERIOD,
                },
              ]}
            >
              <View style={[styles.quickPeriodIcon, { backgroundColor: bleedingIntensity !== 'none' ? `${C_PERIOD}18` : 'rgba(255,255,255,0.18)' }]}>
                <IconSymbol name={bleedingIntensity !== 'none' ? 'checkmark' : 'drop.fill'} size={18} color={bleedingIntensity !== 'none' ? C_PERIOD : '#FFFFFF'} />
              </View>
              <View style={styles.quickPeriodCopy}>
                <Text style={[styles.quickPeriodTitle, { color: bleedingIntensity !== 'none' ? C_PERIOD : '#FFFFFF' }]}>
                  {bleedingIntensity !== 'none'
                    ? t('quickPeriod.logged')
                    : t('quickPeriod.startToday')}
                </Text>
                <Text style={[styles.quickPeriodHelper, { color: bleedingIntensity !== 'none' ? textSecondary : 'rgba(255,255,255,0.82)' }]}>
                  {bleedingIntensity !== 'none'
                    ? t('quickPeriod.edit', { intensity: BLEEDING_LABEL[bleedingIntensity] })
                    : t('quickPeriod.helper')}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={17} color={bleedingIntensity !== 'none' ? C_PERIOD : '#FFFFFF'} />
            </TouchableOpacity>
          </LiquidGlassCard>

          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>
              {t('section.outlook')}
            </Text>
            <View style={[styles.sectionLabelLine, { backgroundColor: divider }]} />
          </View>
          <View style={styles.pillRow}>
            <InfoPill
              label={t('pill.nextPeriod')}
              value={isExtendedCycle ? t('pill.currentlyOpen') : formatDateRange(prediction.nextPeriodWindow.startDate, prediction.nextPeriodWindow.endDate)}
              color={C_PERIOD}
              isDark={isDark}
              fullWidth={stackInfoPills}
            />
            <InfoPill
              label={t('pill.fertileWindow')}
              value={isExtendedCycle ? t('pill.currentlyUncertain') : formatDateRange(prediction.fertileWindow.startDate, prediction.fertileWindow.endDate)}
              color={C_FERTILE}
              isDark={isDark}
              fullWidth={stackInfoPills}
            />
          </View>
          <View style={styles.forecastNote}>
            <View style={[styles.forecastNoteIcon, { backgroundColor: `${C_OVULATION}12` }]}>
              <IconSymbol name="info.circle" size={15} color={C_OVULATION} />
            </View>
            <View style={styles.forecastNoteCopy}>
              <Text style={[styles.forecastNoteText, { color: textSecondary }]}>
                {t('forecast.windowHint', { uncertaintyDays: prediction.uncertaintyDays })}
              </Text>
              <Text style={[styles.forecastConfidenceText, { color: C_OVULATION }]}>
                {t('forecast.confidence', { confidence: prediction.confidence })}
              </Text>
            </View>
          </View>

          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>
              {t('section.dailyLog')}
            </Text>
            <View style={[styles.sectionLabelLine, { backgroundColor: divider }]} />
          </View>
          <LiquidGlassCard style={styles.selectedDaySummaryCard}>
            <View style={styles.selectedDaySummaryHeader}>
              <View style={styles.selectedDayTitleBlock}>
                <Text style={[styles.selectedDaySummaryEyebrow, { color: C_OVULATION }]}>
                  {isSelectedToday ? t('common.todayUpper') : t('daily.selectedDay')}
                </Text>
                <Text style={[styles.selectedDaySummaryTitle, { color: textPrimary }]}>{selectedDateLabel}</Text>
              </View>
              <View style={[styles.saveStatusBadge, { backgroundColor: saveStatus === 'saving' ? `${C_FOLLICULAR}25` : selectedLog ? `${C_CALENDAR}20` : `${textSecondary}12` }]}>
                {saveStatus === 'saving' ? <ActivityIndicator size="small" color={C_FOLLICULAR} /> : <IconSymbol name={selectedLog ? 'checkmark' : 'circle'} size={14} color={selectedLog ? C_CALENDAR : textSecondary} />}
                <Text style={[styles.saveStatusText, { color: saveStatus === 'saving' ? C_FOLLICULAR : selectedLog ? C_CALENDAR : textSecondary }]}>
                  {saveStatus === 'saving'
                    ? t('daily.status.saving')
                    : selectedLog
                      ? t('daily.status.saved')
                      : t('daily.status.empty')}
                </Text>
              </View>
            </View>
            <View style={styles.selectedDayFacts}>
              <View style={styles.selectedDayFact}><Text style={styles.selectedDayFactIcon}>🩸</Text><Text style={[styles.selectedDayFactText, { color: textSecondary }]}>{selectedLog?.bleeding_intensity && selectedLog.bleeding_intensity !== 'none' ? BLEEDING_LABEL[selectedLog.bleeding_intensity] : selectedLog?.spotting ? 'Spotting' : t('daily.noBleeding')}</Text></View>
              <View style={styles.selectedDayFact}><Text style={styles.selectedDayFactIcon}>✨</Text><Text style={[styles.selectedDayFactText, { color: textSecondary }]}>{selectedLog?.symptoms?.length ? t('daily.symptomCount', { count: selectedLog.symptoms.length }) : t('daily.noSymptoms')}</Text></View>
              <View style={styles.selectedDayFact}><Text style={styles.selectedDayFactIcon}>🌡️</Text><Text style={[styles.selectedDayFactText, { color: textSecondary }]}>{selectedLog?.bbt_celsius ? `${selectedLog.bbt_celsius} °C` : t('daily.noTemperature')}</Text></View>
            </View>
            <TouchableOpacity style={[styles.selectedDayEditButton, { backgroundColor: `${C_OVULATION}12` }]} onPress={openLogEntryModal}>
              <Text style={styles.selectedDayEditText}>{selectedLog ? t('daily.edit') : t('daily.add')}</Text>
              <IconSymbol name="chevron.right" size={16} color={C_OVULATION} />
            </TouchableOpacity>
          </LiquidGlassCard>

          <View style={styles.predictionLegendRow}>
            <View style={[styles.predictionLegendSample, { borderColor: C_PERIOD }]} />
            <Text style={[styles.predictionLegendText, { color: textSecondary }]}>
              {t('daily.predictionLegend')}
            </Text>
          </View>

          <Modal
            visible={showLogEntryModal}
            transparent
            animationType="fade"
            onRequestClose={closeLogEntryModal}
          >
            <View
              style={[
                styles.logEntryOverlay,
                { backgroundColor: isDark ? 'rgba(7, 10, 15, 0.68)' : 'rgba(32, 24, 20, 0.26)' },
              ]}
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={closeLogEntryModal}
              />

              <View
                style={[
                  styles.logEntrySheet,
                  {
                    backgroundColor: isDark ? 'rgba(18, 18, 24, 0.95)' : 'rgba(255, 250, 244, 0.98)',
                    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)',
                  },
                ]}
              >
                <View style={styles.logEntrySheetHandle} />
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.logEntrySheetScrollContent}
                >
                  <LiquidGlassCard style={styles.logEntryCard}>
                    <View style={styles.logEntryTopRow}>
                      <View style={styles.logEntryHeader}>
                        <View
                          style={[
                            styles.logEntryEyebrowBadge,
                            {
                              backgroundColor: isSelectedToday ? `${C_OVULATION}16` : 'rgba(125,90,80,0.10)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.logEntryEyebrowText,
                              { color: isSelectedToday ? C_OVULATION : textSecondary },
                            ]}
                          >
                            {isSelectedToday ? 'HEUTE' : 'EINTRAGEN'}
                          </Text>
                        </View>
                        <Text style={[styles.logEntryTitle, { color: textPrimary }]}>{logEntryDateLabel}</Text>
                        <Text style={[styles.logEntryMeta, { color: textSecondary }]}>
                          Zyklustag {prediction.currentDay} · {activePhaseMeta.label}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.logEntryCloseButton,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
                            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                          },
                        ]}
                        activeOpacity={0.88}
                        onPress={closeLogEntryModal}
                      >
                        <IconSymbol name="xmark" size={16} color={textPrimary} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.logEntrySectionEyebrow, { color: textSecondary }]}>
                      Primäre Eingabe
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.periodHero,
                        bleedingIntensity !== 'none' || spotting
                          ? { backgroundColor: C_PERIOD, borderColor: `${C_PERIOD}AA` }
                          : {
                              backgroundColor: isDark ? 'rgba(232,112,106,0.12)' : 'rgba(255,245,244,0.98)',
                              borderWidth: 1.5,
                              borderColor: `${C_PERIOD}45`,
                            },
                      ]}
                      onPress={() => toggleSection('period')}
                      activeOpacity={0.82}
                    >
                      <View
                        style={[
                          styles.periodHeroIconBubble,
                          {
                            backgroundColor:
                              bleedingIntensity !== 'none' || spotting
                                ? 'rgba(255,255,255,0.16)'
                                : `${C_PERIOD}12`,
                          },
                        ]}
                      >
                        <IconSymbol
                          name="drop.fill"
                          size={20}
                          color={bleedingIntensity !== 'none' || spotting ? '#FFFFFF' : C_PERIOD}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.periodHeroTitle,
                            {
                              color: bleedingIntensity !== 'none' || spotting ? '#FFFFFF' : C_PERIOD,
                            },
                          ]}
                        >
                          Blutung / Periode
                        </Text>
                        <Text
                          style={[
                            styles.periodHeroSub,
                            {
                              color:
                                bleedingIntensity !== 'none' || spotting
                                  ? 'rgba(255,255,255,0.82)'
                                  : textSecondary,
                            },
                          ]}
                        >
                          {bleedingIntensity !== 'none'
                            ? `${BLEEDING_LABEL[bleedingIntensity]}${spotting ? ' · Spotting' : ''}`
                            : spotting
                              ? 'Spotting'
                              : 'Heute als wichtigste Eingabe'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.periodHeroBadge,
                          {
                            backgroundColor:
                              bleedingIntensity !== 'none' || spotting
                                ? 'rgba(255,255,255,0.16)'
                                : `${C_PERIOD}12`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.periodHeroBadgeText,
                            {
                              color:
                                bleedingIntensity !== 'none' || spotting ? '#FFFFFF' : C_PERIOD,
                            },
                          ]}
                        >
                          {bleedingIntensity !== 'none' || spotting ? 'Aktiv' : 'Offen'}
                        </Text>
                      </View>
                      <IconSymbol
                        name={expandedSection === 'period' ? 'chevron.up' : 'chevron.down'}
                        size={14}
                        color={bleedingIntensity !== 'none' || spotting ? '#FFFFFF' : C_PERIOD}
                      />
                    </TouchableOpacity>

                    {expandedSection === 'period' ? (
                      <View
                        style={[
                          styles.expandedSection,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(232,112,106,0.06)',
                          },
                        ]}
                      >
                        <Text style={[styles.expandedSectionLabel, { color: textSecondary }]}>
                          Blutungsstärke
                        </Text>
                        <ChipRow
                          options={BLEEDING_OPTIONS}
                          value={bleedingIntensity}
                          onChange={setBleedingIntensity}
                          isDark={isDark}
                        />
                        <View style={[styles.divider, { backgroundColor: divider, marginVertical: 4 }]} />
                        <View style={styles.expandedToggleRow}>
                          <Text style={[styles.expandedSectionLabel, { color: textSecondary }]}>
                            Spotting
                          </Text>
                          <TouchableOpacity
                            onPress={() => setSpotting((current) => !current)}
                            style={[
                              styles.toggleBtn,
                              spotting
                                ? { backgroundColor: C_PERIOD }
                                : {
                                    backgroundColor: isDark
                                      ? 'rgba(255,255,255,0.10)'
                                      : 'rgba(0,0,0,0.06)',
                                  },
                            ]}
                          >
                            <Text
                              style={[styles.toggleBtnText, { color: spotting ? '#FFFFFF' : textSecondary }]}
                            >
                              {spotting ? '✓ Ja' : 'Nein'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    <Text style={[styles.logEntrySectionEyebrow, { color: textSecondary }]}>
                      Weitere Einträge
                    </Text>
                    <View style={styles.quickGridRow}>
                      <QuickEntryTile
                        icon={<IconSymbol name="drop.fill" size={20} color={C_FERTILE} />}
                        label="Schleim"
                        helper={mucus ? 'Aktueller Status' : 'Nicht eingetragen'}
                        value={mucus ? (MUCUS_LABEL[mucus] ?? 'Nicht eingetragen') : 'Nicht eingetragen'}
                        hasValue={mucus !== null}
                        expanded={expandedSection === 'mucus'}
                        onPress={() => toggleSection('mucus')}
                        accentColor={C_FERTILE}
                        isDark={isDark}
                      />
                      <QuickEntryTile
                        icon={<IconSymbol name="magnifyingglass" size={20} color={C_OVULATION} />}
                        label="LH-Test"
                        helper={lh ? 'Testergebnis' : 'Heute offen'}
                        value={lh ? (LH_LABEL[lh] ?? 'Kein Test') : 'Kein Test'}
                        hasValue={lh !== null}
                        expanded={expandedSection === 'lh'}
                        onPress={() => toggleSection('lh')}
                        accentColor={C_OVULATION}
                        isDark={isDark}
                      />
                    </View>
                    <View style={styles.quickGridRow}>
                      <QuickEntryTile
                        icon={<IconSymbol name="heart.fill" size={20} color={C_OVULATION} />}
                        label="Sex"
                        helper={sex ? 'Bereits eingetragen' : 'Nicht eingetragen'}
                        value={sex ? 'Ja' : 'Noch offen'}
                        hasValue={sex}
                        expanded={false}
                        onPress={() => setSex((current) => !current)}
                        accentColor={C_OVULATION}
                        isDark={isDark}
                      />
                      <QuickEntryTile
                        icon={<IconSymbol name="waveform.path.ecg" size={20} color={C_FOLLICULAR} />}
                        label="Temperatur"
                        helper={bbt.trim() ? 'Letzter Wert' : 'Kein Wert'}
                        value={bbt.trim() ? `${bbt} °C` : 'Nicht eingetragen'}
                        hasValue={Boolean(bbt.trim())}
                        expanded={expandedSection === 'bbt'}
                        onPress={() => toggleSection('bbt')}
                        accentColor={C_FOLLICULAR}
                        isDark={isDark}
                      />
                    </View>

                    {expandedSection === 'mucus' ? (
                      <View
                        style={[
                          styles.expandedSection,
                          {
                            backgroundColor: isDark ? `${C_FERTILE}14` : `${C_FERTILE}10`,
                          },
                        ]}
                      >
                        <Text style={[styles.expandedSectionLabel, { color: textSecondary }]}>
                          Zervixschleim
                        </Text>
                        <ChipRow options={MUCUS_OPTIONS} value={mucus} onChange={setMucus} isDark={isDark} />
                      </View>
                    ) : null}

                    {expandedSection === 'lh' ? (
                      <View
                        style={[
                          styles.expandedSection,
                          {
                            backgroundColor: isDark ? `${C_OVULATION}14` : `${C_OVULATION}0E`,
                          },
                        ]}
                      >
                        <Text style={[styles.expandedSectionLabel, { color: textSecondary }]}>
                          LH-Test Ergebnis
                        </Text>
                        <ChipRow options={LH_OPTIONS} value={lh} onChange={setLh} isDark={isDark} />
                      </View>
                    ) : null}

                    {expandedSection === 'bbt' ? (
                      <View
                        style={[
                          styles.expandedSection,
                          {
                            backgroundColor: isDark
                              ? 'rgba(200,181,160,0.12)'
                              : 'rgba(200,181,160,0.14)',
                          },
                        ]}
                      >
                        <Text style={[styles.expandedSectionLabel, { color: textSecondary }]}>
                          Basaltemperatur (°C)
                        </Text>
                        <TextInput
                          value={bbt}
                          onChangeText={setBbt}
                          keyboardType="decimal-pad"
                          style={[
                            styles.bbtInput,
                            { color: textPrimary, borderColor: `${C_FOLLICULAR}55` },
                          ]}
                          placeholderTextColor={textSecondary}
                          placeholder="z.B. 36,50"
                        />
                      </View>
                    ) : null}

                    <Text style={[styles.logEntrySectionEyebrow, { color: textSecondary }]}>
                      Symptome
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.symptomsRow,
                        selectedSymptoms.length > 0
                          ? {
                              backgroundColor: isDark ? `${C_OVULATION}16` : `${C_OVULATION}0D`,
                              borderColor: `${C_OVULATION}35`,
                            }
                          : {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.64)',
                              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
                            },
                        expandedSection === 'symptoms' && { borderColor: C_OVULATION, borderWidth: 1.5 },
                      ]}
                      onPress={() => toggleSection('symptoms')}
                      activeOpacity={0.82}
                    >
                      <View style={[styles.symptomsRowIconBubble, { backgroundColor: `${C_OVULATION}14` }]}>
                        <IconSymbol name="sparkles" size={18} color={C_OVULATION} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.symptomsRowHeader}>
                          <Text style={[styles.symptomsRowTitle, { color: textPrimary }]}>Symptome</Text>
                          <View
                            style={[
                              styles.symptomsCountBadge,
                              {
                                backgroundColor:
                                  selectedSymptoms.length > 0 ? `${C_OVULATION}14` : 'rgba(125,90,80,0.10)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.symptomsCountBadgeText,
                                { color: selectedSymptoms.length > 0 ? C_OVULATION : textSecondary },
                              ]}
                            >
                              {selectedSymptoms.length > 0 ? symptomsSummary : 'Offen'}
                            </Text>
                          </View>
                        </View>
                        {selectedSymptoms.length > 0 ? (
                          <Text style={[styles.symptomsRowSub, { color: C_OVULATION }]}>
                            {selectedSymptoms.join(' · ')}
                          </Text>
                        ) : (
                          <Text style={[styles.symptomsRowSub, { color: textSecondary }]}>
                            Müdigkeit, Krämpfe oder Blähungen festhalten
                          </Text>
                        )}
                      </View>
                      <IconSymbol
                        name={expandedSection === 'symptoms' ? 'chevron.up' : 'chevron.down'}
                        size={15}
                        color={selectedSymptoms.length > 0 ? C_OVULATION : textSecondary}
                      />
                    </TouchableOpacity>

                    {expandedSection === 'symptoms' ? (
                      <View style={styles.symptomGrid}>
                        {SYMPTOMS.map((symptom) => (
                          <SymptomChip
                            key={symptom.label}
                            emoji={symptom.emoji}
                            label={symptom.label}
                            selected={selectedSymptoms.includes(symptom.label)}
                            onToggle={() => toggleSymptom(symptom.label)}
                            isDark={isDark}
                          />
                        ))}
                      </View>
                    ) : null}
                  </LiquidGlassCard>
                </ScrollView>
              </View>
            </View>
          </Modal>

          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>
              {t('section.analysis')}
            </Text>
            <View style={[styles.sectionLabelLine, { backgroundColor: divider }]} />
          </View>
          <LiquidGlassCard style={styles.card}>
            <Text style={[styles.cardTitle, styles.centerText, { color: textPrimary }]}>
              {t('factors.patternTitle')}
            </Text>
            <Text style={[styles.cardSubtitle, styles.centerText, { color: textSecondary }]}>
              {prediction.insight}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowFactorDetails((current) => !current)}
              style={styles.factorsToggle}
            >
              <Text style={styles.factorsToggleText}>
                {showFactorDetails ? t('factors.hideDetails') : t('factors.showDetails')}
              </Text>
              <IconSymbol
                name={showFactorDetails ? 'chevron.up' : 'chevron.down'}
                size={14}
                color={C_OVULATION}
              />
            </TouchableOpacity>
            {showFactorDetails ? (
              <>
                <Text style={[styles.cardSubtitle, styles.centerText, { color: textSecondary, marginTop: 10 }]}>
                  {t('factors.subtitle')}
                </Text>
                <View style={[styles.divider, { backgroundColor: divider, marginTop: 6 }]} />
                {prediction.factors.map((factor, index) => (
                  <React.Fragment key={factor.key}>
                    <FactorRow
                      label={factor.label}
                      detail={factor.detail}
                      color={FACTOR_COLORS[factor.key]}
                      active={factor.active}
                      pct={factor.pct}
                      isDark={isDark}
                    />
                    {index < prediction.factors.length - 1 ? (
                      <View style={[styles.factorSep, { backgroundColor: divider }]} />
                    ) : null}
                  </React.Fragment>
                ))}
              </>
            ) : null}
          </LiquidGlassCard>

          {cycleHistory.entries.length > 0 ? (
            <LiquidGlassCard style={styles.card}>
              <Text style={[styles.cardTitle, styles.centerText, { color: textPrimary }]}>
                {t('history.title')}
              </Text>
              <Text style={[styles.cardSubtitle, styles.centerText, { color: textSecondary }]}>
                {t('history.shortSubtitle')}
              </Text>
              <View style={styles.historyList}>
                {(() => {
                  const barMax = Math.max(
                    ...cycleHistory.entries.map(
                      (item) => item.cycleLength ?? todayPrediction.currentDay,
                    ),
                    todayPrediction.cycleLength,
                  );
                  return cycleHistory.entries.map((entry) => {
                    const length = entry.cycleLength
                      ?? Math.max(todayPrediction.currentDay, entry.periodLength);
                    const [year, month, day] = entry.startDate.split('-');
                    return (
                      <View key={entry.startDate} style={styles.historyRow}>
                        <Text style={[styles.historyDate, { color: textSecondary }]}>
                          {`${day}.${month}.${year.slice(2)}`}
                        </Text>
                        <View
                          style={[
                            styles.historyBarTrack,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                          ]}
                        >
                          <View
                            style={[
                              styles.historyBar,
                              {
                                width: `${Math.min(100, (length / barMax) * 100)}%`,
                                backgroundColor: entry.isCurrent
                                  ? `${C_OVULATION}44`
                                  : `${C_LUTEAL}55`,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.historyBarPeriod,
                                {
                                  width: `${Math.min(100, (entry.periodLength / length) * 100)}%`,
                                  backgroundColor: C_PERIOD,
                                },
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={[styles.historyLength, { color: textPrimary }]}>
                          {entry.isCurrent
                            ? t('history.currentDay', { day: length })
                            : t('history.lengthDays', { days: length })}
                        </Text>
                      </View>
                    );
                  });
                })()}
              </View>
              {cycleHistory.averageCycleLength !== null ? (
                <Text style={[styles.historyStats, styles.centerText, { color: textSecondary }]}>
                  {t('history.statsAverage', { days: cycleHistory.averageCycleLength })}
                  {cycleHistory.variabilityDays !== null
                    ? ` · ${t('history.statsVariability', { days: cycleHistory.variabilityDays })}`
                    : ''}
                  {cycleHistory.shortestCycleLength !== null &&
                  cycleHistory.longestCycleLength !== null &&
                  cycleHistory.shortestCycleLength !== cycleHistory.longestCycleLength
                    ? ` · ${t('history.statsRange', { min: cycleHistory.shortestCycleLength, max: cycleHistory.longestCycleLength })}`
                    : ''}
                </Text>
              ) : null}
            </LiquidGlassCard>
          ) : null}

          <Text style={[styles.disclaimer, { color: textSecondary }]}> 
            {t('disclaimer')}
          </Text>

        </ScrollView>

        <MonthCalendarOverlay
          visible={showMonthCalendar}
          baseMonthDate={calendarMonthDate}
          selectedDate={selectedDate}
          trackerData={trackerData}
          prediction={prediction}
          referenceDate={selectedDate}
          onClose={() => setShowMonthCalendar(false)}
          onSelectDate={handleMonthCalendarSelectDate}
          onJumpToToday={handleMonthCalendarJumpToToday}
          isDark={isDark}
        />

        <Modal
          visible={showSettings}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSettings(false)}
        >
          <ThemedBackground style={styles.settingsModalBackground}>
            <SafeAreaView style={styles.settingsModalSafeArea}>
              <View style={styles.settingsModalHeader}>
                <View style={styles.settingsModalHeaderSpacer} />
                <View style={styles.settingsModalTitleWrap}>
                  <Text style={[styles.settingsModalTitle, { color: textPrimary }]}>{t('common.settings')}</Text>
                  <Text style={[styles.settingsModalSubtitle, { color: textSecondary }]}>{t('settings.subtitle')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.settingsCloseButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)' }]}
                  onPress={() => setShowSettings(false)}
                  accessibilityLabel={t('screen.settings.close')}
                >
                  <IconSymbol name="xmark" size={20} color={textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.settingsModalContent} showsVerticalScrollIndicator={false}>
                <LiquidGlassCard style={styles.card}>
                  <Text style={[styles.cardSubtitle, { color: textSecondary }]}>{t('section.settings.subtitle')}</Text>
                  <Text style={[styles.settingsGroupLabel, { color: textSecondary }]}>{t('settings.remindersGroup')}</Text>
                  <SettingToggleRow label={t('reminders.period.label')} helper={t('reminders.period.helper')} value={reminderSettings.periodReminder} onToggle={() => void handleToggleReminder('periodReminder')} isDark={isDark} />
                  <SettingToggleRow label={t('reminders.fertile.label')} helper={t('reminders.fertile.helper')} value={reminderSettings.fertileReminder} onToggle={() => void handleToggleReminder('fertileReminder')} isDark={isDark} />
                  <SettingToggleRow label={t('reminders.discreet.label')} helper={t('reminders.discreet.helper')} value={reminderSettings.discreet} onToggle={() => void handleToggleReminder('discreet')} isDark={isDark} />
                  {reminderPermissionDenied ? <Text style={styles.reminderPermissionHint}>{t('reminders.permissionHint')}</Text> : null}
                </LiquidGlassCard>

                <LiquidGlassCard style={styles.card}>
                  <Text style={[styles.settingsGroupLabel, { color: textSecondary, marginTop: 0 }]}>{t('settings.lifePhaseGroup')}</Text>
                  <SettingToggleRow label={t('lifePhase.postpartum.label')} helper={t('lifePhase.postpartum.helper')} value={Boolean(trackerData?.settings?.is_postpartum)} onToggle={() => void handleToggleLifePhase('is_postpartum')} disabled={isSavingLifePhase} isDark={isDark} />
                  <SettingToggleRow label={t('lifePhase.breastfeeding.label')} helper={t('lifePhase.breastfeeding.helper')} value={Boolean(trackerData?.settings?.is_breastfeeding)} onToggle={() => void handleToggleLifePhase('is_breastfeeding')} disabled={isSavingLifePhase} isDark={isDark} />
                  <SettingToggleRow label={t('lifePhase.perimenopause.label')} helper={t('lifePhase.perimenopause.helper')} value={Boolean(trackerData?.settings?.is_perimenopause)} onToggle={() => void handleToggleLifePhase('is_perimenopause')} disabled={isSavingLifePhase} isDark={isDark} />
                </LiquidGlassCard>
              </ScrollView>
            </SafeAreaView>
          </ThemedBackground>
        </Modal>

        {showInitialSetupPrompt ? (
          <View style={styles.setupOverlay}>
            <View
              style={[
                styles.setupCard,
                {
                  backgroundColor: isDark ? 'rgba(24,24,28,0.98)' : 'rgba(255,255,255,0.98)',
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              <Text style={[styles.setupTitle, { color: textPrimary }]}>
                {t('setup.title')}
              </Text>
              <Text style={[styles.setupBody, { color: textSecondary }]}>
                {t('setup.body')}
              </Text>
              <Text style={[styles.setupHint, { color: textSecondary }]}>
                {t('setup.hint')}
              </Text>

              <TouchableOpacity
                style={[
                  styles.setupDateButton,
                  { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)' },
                ]}
                onPress={() => setShowInitialSetupDatePicker(true)}
                disabled={isSavingInitialSetup}
              >
                <Text style={[styles.setupDateButtonLabel, { color: textSecondary }]}>
                  {t('setup.dateLabel')}
                </Text>
                <Text style={[styles.setupDateButtonValue, { color: textPrimary }]}>
                  {initialLastPeriodStartDate.toLocaleDateString(CYCLE_DATE_LOCALE)}
                </Text>
              </TouchableOpacity>

              {showInitialSetupDatePicker && Platform.OS !== 'ios' ? (
                <View style={styles.setupDatePickerWrap}>
                  <DateTimePicker
                    value={initialLastPeriodStartDate}
                    mode="date"
                    display="default"
                    onChange={handleInitialSetupDateChange}
                    minimumDate={MIN_CYCLE_DATE}
                    maximumDate={maxCycleDate}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                </View>
              ) : null}

              <View style={styles.setupActions}>
                <TouchableOpacity
                  style={[
                    styles.setupSecondaryButton,
                    { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)' },
                  ]}
                  onPress={handleDismissInitialSetup}
                  disabled={isSavingInitialSetup}
                >
                  <Text style={[styles.setupSecondaryButtonText, { color: textSecondary }]}>
                    {t('common.later')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.setupPrimaryButton}
                  onPress={handleSaveInitialSetup}
                  disabled={isSavingInitialSetup}
                >
                  <Text style={styles.setupPrimaryButtonText}>
                    {isSavingInitialSetup ? t('common.saving') : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: CONTENT_PAD, paddingTop: 10, paddingBottom: 150, gap: 16 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: {
    textAlign: 'center',
    alignSelf: 'center',
  },
  setupOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.34)',
    zIndex: 20,
    elevation: 20,
  },
  setupCard: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },
  setupTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  setupBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  setupHint: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
    textAlign: 'center',
  },
  setupDateButton: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  setupDateButtonLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  setupDateButtonValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  setupDatePickerWrap: {
    marginTop: -4,
    marginBottom: 4,
  },
  setupActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  setupSecondaryButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  setupPrimaryButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C_OVULATION,
  },
  setupPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  heroCard: {
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 18,
    overflow: 'hidden',
    marginHorizontal: -2,
    borderCurve: 'continuous',
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  heroNavButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroDateLabel: {
    fontSize: IS_COMPACT_SCREEN ? 15 : 16,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  heroTodayButton: {
    alignSelf: 'center',
    marginTop: -6,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: `${C_OVULATION}18`,
  },
  heroTodayButtonText: {
    color: C_OVULATION,
    fontSize: 13,
    fontWeight: '700',
  },
  heroHeadline: {
    fontSize: IS_COMPACT_SCREEN ? 28 : 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: IS_COMPACT_SCREEN ? 34 : 38,
    marginBottom: 10,
    width: '100%',
  },
  heroSubline: {
    fontSize: IS_COMPACT_SCREEN ? 14 : 15,
    fontWeight: '600',
    lineHeight: IS_COMPACT_SCREEN ? 20 : 22,
    marginBottom: 6,
    width: '100%',
  },
  heroCaption: {
    fontSize: IS_COMPACT_SCREEN ? 13 : 14,
    lineHeight: IS_COMPACT_SCREEN ? 19 : 21,
    marginBottom: 8,
    opacity: 0.9,
    width: '100%',
  },
  heroErrorText: {
    color: '#B35B52',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },

  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  weekCol: { alignItems: 'center', flex: 1, gap: 4 },
  weekLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  weekLabelToday: { fontWeight: '700', fontSize: 9.5 },
  weekCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  weekNum: { fontSize: 16, fontWeight: '500' },
  weekTodayDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: -1 },

  ringContainer: {
    alignSelf: 'center',
    width: CANVAS_SIZE,
    height: CANVAS_SIZE + 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringDayBig: { fontSize: 46, fontWeight: '800', letterSpacing: -1 },
  ringDayOf: { fontSize: 13, marginTop: -4 },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11.5 },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PILL_GAP,
  },
  infoPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  infoPill: {
    flexGrow: 1,
    flexBasis: PILL_WIDTH,
    alignSelf: 'auto' as const,
    minHeight: 104,
    paddingVertical: 15,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderCurve: 'continuous',
  },
  infoPillFullWidth: {
    flexBasis: '100%',
    width: '100%',
  },
  infoPillDot: { width: 11, height: 11, borderRadius: 6 },
  infoPillValue: {
    fontSize: IS_COMPACT_SCREEN ? 15 : 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: IS_COMPACT_SCREEN ? 21 : 24,
  },
  infoPillLabel: { fontSize: IS_COMPACT_SCREEN ? 12 : 13, fontWeight: '500', textAlign: 'center', lineHeight: 18, flexShrink: 1 },

  card: { padding: 20, borderCurve: 'continuous' },
  cardTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  cardSubtitle: { fontSize: 12.5, marginTop: 4, marginBottom: 6, lineHeight: 18 },
  divider: { height: 1, marginVertical: 14 },
  monthLauncherBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: `${C_OVULATION}14`,
  },
  monthLauncherBadgeText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: C_OVULATION,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  monthLauncherArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${C_OVULATION}10`,
  },
  monthSheetOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(20,12,28,0.18)',
    zIndex: 18,
    elevation: 18,
  },
  monthSheetContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  monthSheetHeaderCard: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 6,
    borderRadius: 30,
    marginBottom: 12,
  },
  monthSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 10,
  },
  monthSheetCloseButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  monthSheetTitleChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  monthSheetTitleChipText: {
    fontSize: 15,
    fontWeight: '800',
    color: C_OVULATION,
  },
  monthSheetTitleChipHint: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  monthSheetTodayButton: {
    minWidth: 66,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    minHeight: 42,
    paddingVertical: 10,
    borderRadius: 21,
    backgroundColor: `${C_OVULATION}14`,
  },
  monthSheetTodayButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C_OVULATION,
  },
  monthSheetWeekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  monthSheetWeekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '600',
  },
  monthSheetScroll: {
    flex: 1,
  },
  monthSheetScrollContent: {
    gap: 12,
    paddingBottom: 38,
  },
  monthSheetSection: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 28,
  },
  monthSheetMonthLabel: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  monthSheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthSheetSpacerCell: {
    width: `${100 / 7}%`,
    minHeight: IS_COMPACT_SCREEN ? 88 : 96,
  },
  monthSheetDayCell: {
    width: `${100 / 7}%`,
    minHeight: IS_COMPACT_SCREEN ? 88 : 96,
    alignItems: 'center',
    paddingTop: IS_COMPACT_SCREEN ? 8 : 10,
  },
  monthSheetTodayLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  monthSheetTodaySpacer: {
    height: 18,
    marginBottom: 6,
  },
  monthSheetDayCircle: {
    width: MONTH_DAY_CIRCLE_SIZE,
    height: MONTH_DAY_CIRCLE_SIZE,
    borderRadius: MONTH_DAY_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  monthSheetDayCirclePeriod: {
    backgroundColor: '#E8706A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  monthSheetDayCirclePredictedPeriod: {
    borderWidth: 2.5,
    borderStyle: 'dotted',
    borderColor: '#E8706A',
  },
  monthSheetDayCircleFertile: {
    backgroundColor: `${C_FERTILE}20`,
  },
  monthSheetDayCircleOvulation: {
    borderWidth: 2.5,
    borderStyle: 'dotted',
    borderColor: C_OVULATION,
    backgroundColor: `${C_OVULATION}12`,
  },
  monthSheetDayText: {
    fontSize: IS_COMPACT_SCREEN ? 19 : 21,
    fontWeight: '600',
  },
  monthSheetEntryDotSlot: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  monthSheetEntryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9B9B9B',
  },

  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  factorDot: { width: 12, height: 12, borderRadius: 6 },
  factorLabel: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  factorDetail: { fontSize: 12, lineHeight: 16 },
  factorPct: { fontSize: 13, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  factorSep: { height: 1, marginHorizontal: 24 },
  sectionEyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 14,
  },

  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logIcon: { fontSize: 20, lineHeight: 28 },
  logRowContent: { flex: 1, gap: 8 },
  logLabel: { fontSize: 13, fontWeight: '500' },

  bbtInput: {
    height: 38,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '600',
    width: 120,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipText: { fontSize: 12.5, fontWeight: '700' },

  toggleBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
  },
  toggleBtnText: { fontSize: 13, fontWeight: '600' },

  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  symptomEmoji: { fontSize: 15 },
  symptomLabel: { fontSize: 12, fontWeight: '500' },

  timelineContent: { gap: 4, paddingBottom: 2 },
  timelineDay: {
    width: 36,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timelineDayToday: { borderWidth: 2.5, borderColor: '#FFFFFF' },
  timelineDayNum: { fontSize: 12 },
  timelineOvDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  timelineHint: { fontSize: 12, opacity: 0.72, textAlign: 'center', marginTop: 12 },

  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  insightIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${C_OVULATION}1E`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightEmoji: { fontSize: 20 },
  insightTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  insightText: { fontSize: 13, lineHeight: 19 },
  heroMonthButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickPeriodButton: { marginTop: 14, minHeight: 62, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  quickPeriodIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickPeriodCopy: { flex: 1, minWidth: 0, gap: 2 }, quickPeriodTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800', flexShrink: 1 }, quickPeriodHelper: { fontSize: 11.5, lineHeight: 16, flexShrink: 1 },
  selectedDaySummaryCard: { padding: 16, gap: 14 },
  selectedDaySummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  selectedDayTitleBlock: { flex: 1, minWidth: 0 },
  selectedDaySummaryEyebrow: { alignSelf: 'flex-start', marginLeft: 12, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1 }, selectedDaySummaryTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 2 },
  saveStatusBadge: { minHeight: 30, borderRadius: 15, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 }, saveStatusText: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  selectedDayFacts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 10 }, selectedDayFact: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '48%', minWidth: 0 }, selectedDayFactIcon: { fontSize: 14, flexShrink: 0 }, selectedDayFactText: { flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 16 },
  selectedDayEditButton: { minHeight: 42, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectedDayEditText: { color: C_OVULATION, fontSize: 12.5, lineHeight: 18, fontWeight: '800', flex: 1, minWidth: 0 },
  predictionLegendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 10, paddingVertical: 2 }, predictionLegendSample: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: `${C_PERIOD}0A`, marginTop: 1, flexShrink: 0 }, predictionLegendText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  sectionLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.25 },
  sectionLabelLine: { flex: 1, height: StyleSheet.hairlineWidth },
  factorsToggle: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  factorsToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: C_OVULATION,
    flexShrink: 1,
    textAlign: 'center',
  },
  settingsGroupLabel: {
    marginTop: 10,
    marginBottom: 2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsModalBackground: { flex: 1 },
  settingsModalSafeArea: { flex: 1 },
  settingsModalHeader: {
    minHeight: 64,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsModalHeaderSpacer: { width: 40 },
  settingsModalTitleWrap: { alignItems: 'center', gap: 2 },
  settingsModalTitle: { fontSize: 20, fontWeight: '700' },
  settingsModalSubtitle: { fontSize: 12 },
  settingsCloseButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  settingsModalContent: { paddingHorizontal: CONTENT_PAD, paddingTop: 8, paddingBottom: 40, gap: 14 },
  forecastNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: -2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  forecastNoteIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  forecastNoteCopy: { flex: 1, minWidth: 0, gap: 3 },
  forecastNoteText: { fontSize: 11.5, lineHeight: 16.5 },
  forecastConfidenceText: { fontSize: 11, lineHeight: 15.5, fontWeight: '700' },
  modeNoteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeNoteEmoji: { fontSize: 16, marginTop: 1 },
  modeNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  historyList: { marginTop: 14, gap: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyDate: { width: IS_COMPACT_SCREEN ? 52 : 58, fontSize: IS_COMPACT_SCREEN ? 11 : 12, fontVariant: ['tabular-nums'], flexShrink: 0 },
  historyBarTrack: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden' },
  historyBar: { height: '100%', borderRadius: 7, overflow: 'hidden' },
  historyBarPeriod: { height: '100%', borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  historyLength: { width: IS_COMPACT_SCREEN ? 56 : 62, fontSize: IS_COMPACT_SCREEN ? 11 : 12, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'], flexShrink: 0 },
  historyStats: { marginTop: 12, fontSize: 12 },
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  settingToggleCopy: { flex: 1, gap: 2 },
  settingToggleLabel: { fontSize: 14, fontWeight: '600' },
  settingToggleHelper: { fontSize: 12, lineHeight: 17 },
  reminderPermissionHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: '#C0392B',
  },

  disclaimer: {
    fontSize: 11.5,
    lineHeight: 18.5,
    textAlign: 'center',
    opacity: 0.72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  logEntryOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  logEntrySheet: {
    width: '100%',
    maxHeight: '84%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  logEntrySheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 14,
  },
  logEntrySheetScrollContent: {
    paddingBottom: 8,
  },

  // --- Log Entry Card ---
  logEntryCard: { padding: 20, gap: 14 },
  logEntryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  logEntryHeader: { flex: 1, gap: 6 },
  logEntryEyebrowBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  logEntryEyebrowText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  logEntryTitle: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 },
  logEntryDate: { fontSize: 13, fontWeight: '500' },
  logEntryMeta: { fontSize: 14, fontWeight: '600' },
  logEntryCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logEntrySectionEyebrow: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  periodHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  periodHeroIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodHeroTitle: { fontSize: 16, fontWeight: '800' },
  periodHeroSub: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  periodHeroBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  periodHeroBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  quickGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickTile: {
    flex: 1,
    position: 'relative',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'flex-start',
    gap: 8,
    minHeight: 156,
  },
  quickTileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileCopy: {
    gap: 4,
    paddingRight: 54,
  },
  quickTileLabel: { fontSize: 15, fontWeight: '700' },
  quickTileHelper: { fontSize: 11.5, fontWeight: '700' },
  quickTileValue: { fontSize: 13.5, lineHeight: 18, fontWeight: '600' },
  quickTileStatusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(125,90,80,0.08)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  quickTileStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  expandedSection: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  expandedSectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  expandedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  symptomsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  symptomsRowIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symptomsRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  symptomsCountBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  symptomsCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  symptomsRowTitle: { fontSize: 16, fontWeight: '800' },
  symptomsRowSub: { fontSize: 12.5, lineHeight: 18 },
});
