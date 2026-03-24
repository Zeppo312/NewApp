import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';

import { DailyEntry } from '@/lib/baby';
import {
  addBabyCareEntry,
  getBabyCareEntriesForDate,
  getBabyCareEntriesForDateRange,
  getBabyCareEntriesForMonth,
  deleteBabyCareEntry,
  stopBabyCareEntryTimer,
  supabase,
  updateBabyCareEntry,
} from '@/lib/supabase';
import {
  loadDayEntriesWithCache,
  loadWeekEntriesWithCache,
  loadMonthEntriesWithCache,
  invalidateDailyCache,
  mapCareToDaily,
} from '@/lib/dailyCache';

import Header from '@/components/Header';
import ActivityCard from '@/components/ActivityCard';
import EmptyState from '@/components/EmptyState';
import ActivityInputModal from '@/components/ActivityInputModal';
import WeekScroller from '@/components/WeekScroller';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

// Removed old managers; using unified baby_care_entries
import { SupabaseErrorHandler } from '@/lib/errorHandler';
import { ConnectionStatus } from '@/components/ConnectionStatus';

import { BlurView } from 'expo-blur';
import { GlassCard, LiquidGlassCard, LAYOUT_PAD, SECTION_GAP_TOP, SECTION_GAP_BOTTOM, PRIMARY } from '@/constants/DesignGuide';
import { useNotifications } from '@/hooks/useNotifications';
import { usePartnerNotifications } from '@/hooks/usePartnerNotifications';
import { buildFeedingOverview } from '@/lib/feedingOverview';
import { sleepActivityService } from '@/lib/sleepActivityService';
import {
  loadVitaminDReminderState,
  saveVitaminDCompletion,
  type VitaminDChecks,
} from '@/lib/vitaminDReminder';

// Design Tokens now imported from DesignGuide

// Layout metrics for week chart (match sleep-tracker)
const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const COLS = 7;
const GUTTER = 4;
const WEEK_CONTENT_WIDTH = contentWidth - TIMELINE_INSET * 2;
const WEEK_COL_WIDTH = Math.floor((WEEK_CONTENT_WIDTH - (COLS - 1) * GUTTER) / COLS);
const WEEK_COLS_WIDTH = COLS * WEEK_COL_WIDTH;
const WEEK_LEFTOVER = WEEK_CONTENT_WIDTH - (WEEK_COLS_WIDTH + (COLS - 1) * GUTTER);
const MAX_BAR_H = 140;
const BABY_MODE_PREVIEW_READ_ONLY_MESSAGE =
  'Du bist im Babymodus zur Vorschau. Tracking ist hier nur nach der Geburt moeglich.';

function toDateKey(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
}

const formatDurationSeconds = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
};

type QuickActionType =
  | 'feeding_breast'
  | 'feeding_bottle'
  | 'feeding_solids'
  | 'feeding_pump'
  | 'feeding_water'
  | 'diaper_wet'
  | 'diaper_dirty'
  | 'diaper_both';

type QuickActionButtonConfig = { icon: string; label: string; action: QuickActionType };
type QuickActionRowItem =
  | { key: string; type: 'action'; item: QuickActionButtonConfig }
  | { key: string; type: 'restore-toggle' };

// GlassCard and LiquidGlassCard imported from DesignGuide

// DateSpider as glass pill
const DateSpider: React.FC<{ date: Date; visible: boolean }> = ({ date, visible }) => {
  // Adaptive Farben für Dark Mode
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;

  if (!visible) return null;
  return (
    <View style={s.dateSpiderWrap}>
      <GlassCard style={s.dateSpiderCard} intensity={22} overlayColor="rgba(255,255,255,0.24)">
        <Text style={[s.dateSpiderText, { color: textPrimary }]}>
          {date.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          })}
        </Text>
      </GlassCard>
    </View>
  );
};

// Timer Banner (glass)
const TimerBanner: React.FC<{
  timer: { id: string; type: string; start: number } | null;
  onStop: () => void;
  onCancel: () => void;
  disabled?: boolean;
}> = ({ timer, onStop, onCancel, disabled = false }) => {
  // Adaptive Farben für Dark Mode
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const syncElapsed = () => setElapsed(Math.floor((Date.now() - timer.start) / 1000));
    syncElapsed();
    const interval = setInterval(syncElapsed, 1000);
    return () => clearInterval(interval);
  }, [timer]);
  if (!timer) return null;

  const timerLabel =
    timer.type === 'BREAST'
      ? '🤱 Stillen'
      : timer.type === 'BOTTLE'
      ? '🍼 Fläschchen'
      : timer.type === 'PUMP'
      ? '🥛 Abpumpen'
      : timer.type === 'WATER'
      ? '🚰 Wasser'
      : timer.type === 'SOLIDS'
      ? '🥄 Beikost'
      : '🧷 Wickeln';

  return (
    <GlassCard style={[s.timerBanner, { paddingVertical: 12, paddingHorizontal: 16 }]} intensity={28}>
      <View style={{ flex: 1 }}>
        <Text style={[s.timerType, { color: textPrimary }]}>
          {timerLabel} • läuft seit {new Date(timer.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={[s.timerTime, { color: textSecondary }]}>{formatDurationSeconds(elapsed)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity style={[s.timerCancelButton, disabled && s.actionDisabled]} onPress={onCancel} disabled={disabled}>
          <IconSymbol name="xmark.circle" size={26} color={isDark ? '#888888' : '#a3a3a3'} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.timerStopButton, disabled && s.actionDisabled]} onPress={onStop} disabled={disabled}>
          <IconSymbol name="stop.circle.fill" size={28} color={textPrimary} />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
};

const QUICK_ACTION_HIDDEN_STORAGE_PREFIX = 'daily_old_hidden_quick_actions';
const QUICK_ACTION_ORDER_STORAGE_PREFIX = 'daily_old_quick_actions_order';

const quickBtns: QuickActionButtonConfig[] = [
  { action: 'feeding_breast', label: 'Stillen', icon: '🤱' },
  { action: 'feeding_bottle', label: 'Fläschchen', icon: '🍼' },
  { action: 'feeding_solids', label: 'Beikost', icon: '🥄' },
  { action: 'feeding_pump', label: 'Abpumpen', icon: '🥛' },
  { action: 'feeding_water', label: 'Wasser', icon: '🚰' },
  { action: 'diaper_wet', label: 'Nass', icon: '💧' },
  { action: 'diaper_dirty', label: 'Voll', icon: '💩' },
  { action: 'diaper_both', label: 'Beides', icon: '💧💩' },
];

const QUICK_ACTION_ORDER = quickBtns.map(({ action }) => action);

const getEntryTimelineTimestamp = (entry: Partial<DailyEntry>): number | null => {
  const rawValue = entry.start_time ?? entry.entry_date ?? null;
  if (!rawValue) return null;

  const timestamp = new Date(rawValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const formatBottleGapLabel = (diffMinutes: number): string | null => {
  if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) return null;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours <= 0) {
    return `🍼 Letzte Flasche vor ${minutes} Min.`;
  }

  if (minutes === 0) {
    return `🍼 Letzte Flasche vor ${hours} Std.`;
  }

  return `🍼 Letzte Flasche vor ${hours} Std. ${minutes} Min.`;
};

type FeedingOverviewCategoryKey = 'BOTTLE' | 'WATER' | 'SOLIDS' | 'BREAST' | 'PUMP';

type FeedingOverviewCategorySummary = {
  key: FeedingOverviewCategoryKey;
  label: string;
  icon: string;
  accent: string;
  accentSoft: string;
  count: number;
  totalMl: number;
  totalMinutes: number;
  lastAt: number | null;
  metric: string;
  secondary: string;
};

const FEEDING_OVERVIEW_CARD_ORDER: FeedingOverviewCategoryKey[] = [
  'BOTTLE',
  'WATER',
  'SOLIDS',
  'BREAST',
  'PUMP',
];

const FEEDING_OVERVIEW_CARD_META: Record<
  FeedingOverviewCategoryKey,
  Pick<FeedingOverviewCategorySummary, 'label' | 'icon' | 'accent' | 'accentSoft'>
> = {
  BOTTLE: {
    label: 'Fläschchen',
    icon: '🍼',
    accent: '#4A90E2',
    accentSoft: 'rgba(74, 144, 226, 0.16)',
  },
  WATER: {
    label: 'Wasser',
    icon: '🚰',
    accent: '#2BA7C4',
    accentSoft: 'rgba(43, 167, 196, 0.16)',
  },
  SOLIDS: {
    label: 'Beikost',
    icon: '🥄',
    accent: '#F5A623',
    accentSoft: 'rgba(245, 166, 35, 0.16)',
  },
  BREAST: {
    label: 'Stillen',
    icon: '🤱',
    accent: '#C56DD8',
    accentSoft: 'rgba(197, 109, 216, 0.16)',
  },
  PUMP: {
    label: 'Abpumpen',
    icon: '🥛',
    accent: '#35B6B4',
    accentSoft: 'rgba(53, 182, 180, 0.16)',
  },
};

const resolveFeedingOverviewType = (entry: Partial<DailyEntry>): FeedingOverviewCategoryKey | null => {
  const feedingType = entry.feeding_type?.toUpperCase();

  if (feedingType === 'BOTTLE') return 'BOTTLE';
  if (feedingType === 'WATER') return 'WATER';
  if (feedingType === 'SOLIDS') return 'SOLIDS';
  if (feedingType === 'BREAST') return 'BREAST';
  if (feedingType === 'PUMP') return 'PUMP';

  const subType = (entry as { sub_type?: string | null }).sub_type;
  if (subType === 'feeding_bottle') return 'BOTTLE';
  if (subType === 'feeding_water') return 'WATER';
  if (subType === 'feeding_solids') return 'SOLIDS';
  if (subType === 'feeding_breast') return 'BREAST';
  if (subType === 'feeding_pump') return 'PUMP';

  return null;
};

const normalizeTrackedMl = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
};

const getEntryDurationMinutes = (entry: Partial<DailyEntry>): number => {
  if (!entry.start_time || !entry.end_time) return 0;

  const start = new Date(entry.start_time).getTime();
  const end = new Date(entry.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  return Math.max(0, Math.round((end - start) / (1000 * 60)));
};

const formatDurationMinutesCompact = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) {
    return `${safe} Min.`;
  }

  const hours = Math.floor(safe / 60);
  const restMinutes = safe % 60;
  if (restMinutes === 0) {
    return `${hours} Std.`;
  }

  return `${hours} Std. ${restMinutes} Min.`;
};

const formatClockTime = (timestamp: number | null): string | null => {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

const buildFeedingOverviewCards = (entries: DailyEntry[]): FeedingOverviewCategorySummary[] => {
  const buckets: Record<
    FeedingOverviewCategoryKey,
    {
      count: number;
      totalMl: number;
      totalMinutes: number;
      lastAt: number | null;
      leftCount: number;
      rightCount: number;
      bothCount: number;
    }
  > = {
    BOTTLE: { count: 0, totalMl: 0, totalMinutes: 0, lastAt: null, leftCount: 0, rightCount: 0, bothCount: 0 },
    WATER: { count: 0, totalMl: 0, totalMinutes: 0, lastAt: null, leftCount: 0, rightCount: 0, bothCount: 0 },
    SOLIDS: { count: 0, totalMl: 0, totalMinutes: 0, lastAt: null, leftCount: 0, rightCount: 0, bothCount: 0 },
    BREAST: { count: 0, totalMl: 0, totalMinutes: 0, lastAt: null, leftCount: 0, rightCount: 0, bothCount: 0 },
    PUMP: { count: 0, totalMl: 0, totalMinutes: 0, lastAt: null, leftCount: 0, rightCount: 0, bothCount: 0 },
  };

  for (const entry of entries) {
    if (entry.entry_type !== 'feeding') continue;

    const category = resolveFeedingOverviewType(entry);
    if (!category) continue;

    const bucket = buckets[category];
    bucket.count += 1;

    const timestamp = getEntryTimelineTimestamp(entry);
    if (timestamp && (!bucket.lastAt || timestamp > bucket.lastAt)) {
      bucket.lastAt = timestamp;
    }

    if (category === 'BOTTLE' || category === 'WATER' || category === 'PUMP') {
      bucket.totalMl += normalizeTrackedMl(entry.feeding_volume_ml);
    }

    if (category === 'BREAST') {
      bucket.totalMinutes += getEntryDurationMinutes(entry);

      if (entry.feeding_side === 'LEFT') bucket.leftCount += 1;
      if (entry.feeding_side === 'RIGHT') bucket.rightCount += 1;
      if (entry.feeding_side === 'BOTH') bucket.bothCount += 1;
    }
  }

  return FEEDING_OVERVIEW_CARD_ORDER.map((key) => {
    const bucket = buckets[key];
    const lastTime = formatClockTime(bucket.lastAt);
    const defaultSecondary = lastTime ? `Zuletzt um ${lastTime} Uhr` : 'Heute noch nichts erfasst';

    let metric = bucket.count > 0 ? `${bucket.count}× dokumentiert` : 'Noch kein Eintrag';
    let secondary = defaultSecondary;

    if (key === 'BOTTLE') {
      metric = bucket.totalMl > 0 ? `${bucket.totalMl} ml insgesamt` : metric;
    } else if (key === 'WATER') {
      metric = bucket.totalMl > 0 ? `${bucket.totalMl} ml getrunken` : metric;
    } else if (key === 'SOLIDS') {
      metric = bucket.count > 0 ? `${bucket.count}× angeboten` : 'Noch keine Beikost';
    } else if (key === 'BREAST') {
      metric = bucket.totalMinutes > 0 ? `${formatDurationMinutesCompact(bucket.totalMinutes)} gesamt` : metric;

      const sideSummary = [
        bucket.leftCount > 0 ? `L ${bucket.leftCount}` : null,
        bucket.rightCount > 0 ? `R ${bucket.rightCount}` : null,
        bucket.bothCount > 0 ? `Beide ${bucket.bothCount}` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      secondary = sideSummary || defaultSecondary;
    } else if (key === 'PUMP') {
      metric = bucket.totalMl > 0 ? `${bucket.totalMl} ml abgepumpt` : metric;
    }

    return {
      key,
      ...FEEDING_OVERVIEW_CARD_META[key],
      count: bucket.count,
      totalMl: bucket.totalMl,
      totalMinutes: bucket.totalMinutes,
      lastAt: bucket.lastAt,
      metric,
      secondary,
    };
  });
};

const normalizeHiddenQuickActions = (value: unknown): QuickActionType[] => {
  if (!Array.isArray(value)) return [];

  const hiddenSet = new Set<QuickActionType>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!QUICK_ACTION_ORDER.includes(entry as QuickActionType)) continue;
    hiddenSet.add(entry as QuickActionType);
  }

  return QUICK_ACTION_ORDER.filter((action) => hiddenSet.has(action)).slice(0, quickBtns.length - 1);
};

const normalizeQuickActionOrder = (value: unknown): QuickActionType[] => {
  if (!Array.isArray(value)) return [...QUICK_ACTION_ORDER];

  const seen = new Set<QuickActionType>();
  const normalized: QuickActionType[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!QUICK_ACTION_ORDER.includes(entry as QuickActionType)) continue;
    if (seen.has(entry as QuickActionType)) continue;
    seen.add(entry as QuickActionType);
    normalized.push(entry as QuickActionType);
  }

  for (const action of QUICK_ACTION_ORDER) {
    if (!seen.has(action)) {
      normalized.push(action);
    }
  }

  return normalized;
};

const buildHiddenQuickActionsStorageKey = (userId?: string | null, babyId?: string | null) =>
  `${QUICK_ACTION_HIDDEN_STORAGE_PREFIX}:${userId ?? 'anonymous'}:${babyId ?? 'default'}`;

const buildQuickActionOrderStorageKey = (userId?: string | null, babyId?: string | null) =>
  `${QUICK_ACTION_ORDER_STORAGE_PREFIX}:${userId ?? 'anonymous'}:${babyId ?? 'default'}`;

const QuickActionRow: React.FC<{
  onPressAction: (action: QuickActionType) => void;
  onHideAction: (action: QuickActionType) => void;
  onRestoreAction: (action: QuickActionType) => void;
  onReorderActions: (actions: QuickActionType[]) => void;
  hiddenActions: QuickActionType[];
  actionOrder: QuickActionType[];
  disabled?: boolean;
}> = ({
  onPressAction,
  onHideAction,
  onRestoreAction,
  onReorderActions,
  hiddenActions,
  actionOrder,
  disabled = false,
}) => {
  // Adaptive Farben für Dark Mode
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const hiddenActionSet = useMemo(() => new Set(hiddenActions), [hiddenActions]);
  const orderedQuickBtns = useMemo(
    () => actionOrder.map((action) => quickBtns.find((btn) => btn.action === action)).filter((item): item is QuickActionButtonConfig => !!item),
    [actionOrder],
  );
  const visibleQuickBtns = useMemo(
    () => orderedQuickBtns.filter(({ action }) => !hiddenActionSet.has(action)),
    [hiddenActionSet, orderedQuickBtns],
  );
  const hiddenQuickBtns = useMemo(
    () => orderedQuickBtns.filter(({ action }) => hiddenActionSet.has(action)),
    [hiddenActionSet, orderedQuickBtns],
  );
  const [isEditMode, setIsEditMode] = useState(false);

  const itemWidth = 100 + 16; // Wrapper width + separator

  const quickActionItems = useMemo<QuickActionRowItem[]>(
    () =>
      visibleQuickBtns.map((item) => ({
        key: item.action,
        type: 'action',
        item,
      })),
    [visibleQuickBtns],
  );

  const handleHidePress = useCallback(
    (action: QuickActionType) => {
      if (visibleQuickBtns.length <= 1) {
        Alert.alert('Mindestens eine Quick Action', 'Eine Quick Action muss sichtbar bleiben.');
        return;
      }

      onHideAction(action);
    },
    [onHideAction, visibleQuickBtns.length],
  );

  const openRestoreMenu = useCallback(() => {
    if (hiddenQuickBtns.length === 0) return;

    Alert.alert(
      'Quick Action einblenden',
      'Welche Action soll wieder sichtbar sein?',
      [
        ...hiddenQuickBtns.map((hiddenBtn) => ({
          text: `${hiddenBtn.icon} ${hiddenBtn.label}`,
          onPress: () => onRestoreAction(hiddenBtn.action),
        })),
        { text: 'Abbrechen', style: 'cancel' as const },
      ],
    );
  }, [hiddenQuickBtns, onRestoreAction]);

  const renderQuickButton = ({ item, drag }: { item: QuickActionRowItem; drag?: () => void }) => {
    if (item.type === 'restore-toggle') {
      return (
        <View style={s.circleButtonWrap}>
          <GlassCard
            style={[s.circleButton, s.circleButtonRestore]}
            intensity={30}
            overlayColor="rgba(255,255,255,0.32)"
            borderColor="rgba(255,255,255,0.70)"
          >
            <TouchableOpacity
              style={s.circleInner}
              onPress={openRestoreMenu}
              activeOpacity={0.9}
            >
              <View style={[s.quickActionPlusBadge, { backgroundColor: isDark ? '#44C38A' : '#1F9D55' }]}>
                <Text style={s.quickActionPlusBadgeText}>+</Text>
              </View>
              <Text style={[s.quickActionPlusLabel, { color: textPrimary }]}>Zurück</Text>
              <Text style={[s.quickActionPlusMeta, { color: textSecondary }]}>{hiddenQuickBtns.length} verborgen</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      );
    }

    return (
      <View style={s.circleButtonWrap}>
        <GlassCard
          style={s.circleButton}
          intensity={30}
          overlayColor="rgba(255,255,255,0.32)"
          borderColor="rgba(255,255,255,0.70)"
        >
          <TouchableOpacity
            style={[s.circleInner, disabled && !isEditMode && s.actionDisabled]}
            onPress={() => {
              if (isEditMode || disabled) return;
              onPressAction(item.item.action);
            }}
            onLongPress={() => {
              if (!isEditMode) {
                setIsEditMode(true);
                return;
              }

              drag?.();
            }}
            delayLongPress={250}
            activeOpacity={isEditMode ? 1 : 0.9}
          >
            <Text style={s.circleEmoji}>{item.item.icon}</Text>
            <Text style={[s.circleLabel, { color: textSecondary }]}>{item.item.label}</Text>
          </TouchableOpacity>
        </GlassCard>
        {isEditMode ? (
          <TouchableOpacity
            style={s.quickActionHideBadge}
            onPress={() => handleHidePress(item.item.action)}
            activeOpacity={0.85}
          >
            <Text style={s.quickActionHideBadgeText}>−</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={s.quickActionSection}>
      {isEditMode ? (
        <View style={s.quickActionEditBar}>
          <TouchableOpacity
            style={[
              s.quickActionDoneButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.46)',
                borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.72)',
              },
            ]}
            onPress={() => setIsEditMode(false)}
            activeOpacity={0.85}
          >
            <Text style={[s.quickActionDoneText, { color: textPrimary }]}>Fertig</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {isEditMode ? (
        <DraggableFlatList
          data={quickActionItems}
          horizontal
          activationDistance={12}
          autoscrollSpeed={120}
          containerStyle={s.quickDragList}
          contentContainerStyle={s.quickScrollContainer}
          keyExtractor={(item) => item.key}
          onDragEnd={({ data }) => {
            onReorderActions(
              data
                .filter((entry): entry is Extract<QuickActionRowItem, { type: 'action' }> => entry.type === 'action')
                .map((entry) => entry.item.action),
            );
          }}
          renderItem={({ item, drag }: RenderItemParams<QuickActionRowItem>) => renderQuickButton({ item, drag })}
          ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
          ListFooterComponent={
            hiddenQuickBtns.length > 0 ? (
              <View style={s.quickActionFooterWrap}>{renderQuickButton({ item: { key: 'restore-toggle', type: 'restore-toggle' } })}</View>
            ) : null
          }
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={quickActionItems}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => renderQuickButton({ item })}
          keyExtractor={(item) => item.key}
          contentContainerStyle={s.quickScrollContainer}
          ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
          decelerationRate="normal"
          getItemLayout={(_, index) => ({
            length: itemWidth,
            offset: itemWidth * index,
            index,
          })}
        />
      )}
    </View>
  );
};

export default function DailyScreen() {
  // Adaptive Farben für Dark Mode (basierend auf Hintergrundbild-Einstellung)
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const { user } = useAuth();

  // Dark Mode angepasste Farben
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const vitaminDCompleteColor = isDark ? '#7FD39C' : '#3FA86B';
  const vitaminDCompleteSoft = isDark ? 'rgba(127,211,156,0.16)' : 'rgba(63,168,107,0.14)';
  const vitaminDCompleteBorder = isDark ? 'rgba(127,211,156,0.34)' : 'rgba(63,168,107,0.26)';
  const router = useRouter();
  const { quickAction } = useLocalSearchParams<{ quickAction?: string | string[] }>();
  
  const { activeBabyId, isReady } = useActiveBaby();
  const { isReadOnlyPreviewMode } = useBabyStatus();

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<DailyEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date()); // Separate state for week view
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date()); // Separate state for month view
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [weekOffset, setWeekOffset] = useState(0); // align with sleep-tracker week nav
  const [monthOffset, setMonthOffset] = useState(0); // align with sleep-tracker month nav
  const [showInputModal, setShowInputModal] = useState(false);
  const [showFeedingOverviewModal, setShowFeedingOverviewModal] = useState(false);
  const [showDateNav, setShowDateNav] = useState(true);
  const fadeNavAnim = useRef(new Animated.Value(1)).current;
  const hideNavTimeout = useRef<NodeJS.Timeout | null>(null);
  const quickActionHandledRef = useRef<string | null>(null);

  const [activeTimer, setActiveTimer] = useState<{
    id: string;
    type: 'BOTTLE' | 'BREAST' | 'SOLIDS' | 'PUMP' | 'WATER' | 'DIAPER';
    start: number;
  } | null>(null);
  const [isTimerHydrated, setIsTimerHydrated] = useState(false);
  const lastLiveStopEventRef = useRef<{ url: string; at: number } | null>(null);
  const handledLiveStopRequestIdRef = useRef(0);
  const [liveStopRequestId, setLiveStopRequestId] = useState(0);

  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'diaper' | 'other'>('feeding');
  const [selectedSubType, setSelectedSubType] = useState<QuickActionType | null>(null);
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null);
  const [splashVisible, setSplashVisible] = useState(false);
  const [splashBg, setSplashBg] = useState<string>('rgba(0,0,0,0.6)');
  const [splashEmoji, setSplashEmoji] = useState<string>('✅');
  const [splashText, setSplashText] = useState<string>('Gespeichert');
  const splashAnim = useRef(new Animated.Value(0)).current;
  const splashEmojiAnim = useRef(new Animated.Value(0.9)).current;
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [splashTitle, setSplashTitle] = useState<string>('');
  const [splashSubtitle, setSplashSubtitle] = useState<string>('');
  const [splashStatus, setSplashStatus] = useState<string>('');
  const [splashHint, setSplashHint] = useState<string>('');
  const [splashHintEmoji, setSplashHintEmoji] = useState<string>('');
  const [vitaminDChecks, setVitaminDChecks] = useState<VitaminDChecks>({});
  const [vitaminDBusy, setVitaminDBusy] = useState(false);
  const [hiddenQuickActions, setHiddenQuickActions] = useState<QuickActionType[]>([]);
  const [quickActionOrder, setQuickActionOrder] = useState<QuickActionType[]>([...QUICK_ACTION_ORDER]);
  const splashEmojiParts = useMemo(() => Array.from(splashEmoji), [splashEmoji]);
  const hiddenQuickActionsStorageKey = useMemo(
    () => buildHiddenQuickActionsStorageKey(user?.id, activeBabyId),
    [activeBabyId, user?.id],
  );
  const quickActionOrderStorageKey = useMemo(
    () => buildQuickActionOrderStorageKey(user?.id, activeBabyId),
    [activeBabyId, user?.id],
  );
  const showReadOnlyPreviewAlert = useCallback(() => {
    Alert.alert('Nur Vorschau', BABY_MODE_PREVIEW_READ_ONLY_MESSAGE);
  }, []);
  const ensureWritableInCurrentMode = useCallback(() => {
    if (!isReadOnlyPreviewMode) return true;
    showReadOnlyPreviewAlert();
    return false;
  }, [isReadOnlyPreviewMode, showReadOnlyPreviewAlert]);

  // Notification hooks
  const { requestPermissions } = useNotifications();
  const { isPartnerLinked } = usePartnerNotifications();

  // Request notification permissions on mount
  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const [storedHiddenActions, storedOrder] = await Promise.all([
          AsyncStorage.getItem(hiddenQuickActionsStorageKey),
          AsyncStorage.getItem(quickActionOrderStorageKey),
        ]);
        if (!isActive) return;

        setHiddenQuickActions(
          storedHiddenActions ? normalizeHiddenQuickActions(JSON.parse(storedHiddenActions)) : [],
        );
        setQuickActionOrder(
          storedOrder ? normalizeQuickActionOrder(JSON.parse(storedOrder)) : [...QUICK_ACTION_ORDER],
        );
      } catch (error) {
        console.error('Daily: failed to load quick action preferences', error);
        if (isActive) {
          setHiddenQuickActions([]);
          setQuickActionOrder([...QUICK_ACTION_ORDER]);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [hiddenQuickActionsStorageKey, quickActionOrderStorageKey]);

  const persistHiddenQuickActions = useCallback(
    async (nextActions: QuickActionType[]) => {
      try {
        if (nextActions.length === 0) {
          await AsyncStorage.removeItem(hiddenQuickActionsStorageKey);
          return;
        }

        await AsyncStorage.setItem(hiddenQuickActionsStorageKey, JSON.stringify(nextActions));
      } catch (error) {
        console.error('Daily: failed to save hidden quick actions', error);
      }
    },
    [hiddenQuickActionsStorageKey],
  );

  const updateHiddenQuickActions = useCallback(
    (updater: (current: QuickActionType[]) => QuickActionType[]) => {
      setHiddenQuickActions((current) => {
        const next = normalizeHiddenQuickActions(updater(current));
        void persistHiddenQuickActions(next);
        return next;
      });
    },
    [persistHiddenQuickActions],
  );

  const persistQuickActionOrder = useCallback(
    async (nextOrder: QuickActionType[]) => {
      try {
        const normalized = normalizeQuickActionOrder(nextOrder);

        if (normalized.every((action, index) => action === QUICK_ACTION_ORDER[index])) {
          await AsyncStorage.removeItem(quickActionOrderStorageKey);
          return;
        }

        await AsyncStorage.setItem(quickActionOrderStorageKey, JSON.stringify(normalized));
      } catch (error) {
        console.error('Daily: failed to save quick action order', error);
      }
    },
    [quickActionOrderStorageKey],
  );

  const handleReorderQuickActions = useCallback(
    (visibleActions: QuickActionType[]) => {
      setQuickActionOrder((current) => {
        const normalizedCurrent = normalizeQuickActionOrder(current);
        const hiddenActions = normalizedCurrent.filter((action) => hiddenQuickActions.includes(action));
        const nextOrder = normalizeQuickActionOrder([...visibleActions, ...hiddenActions]);
        void persistQuickActionOrder(nextOrder);
        return nextOrder;
      });
    },
    [hiddenQuickActions, persistQuickActionOrder],
  );

  const handleHideQuickAction = useCallback(
    (action: QuickActionType) => {
      updateHiddenQuickActions((current) => {
        if (current.includes(action)) return current;
        return [...current, action];
      });
    },
    [updateHiddenQuickActions],
  );

  const handleRestoreQuickAction = useCallback(
    (action: QuickActionType) => {
      updateHiddenQuickActions((current) => current.filter((currentAction) => currentAction !== action));
    },
    [updateHiddenQuickActions],
  );

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user?.id || !activeBabyId || !isReady) {
        if (active) {
          setVitaminDChecks({});
        }
        return;
      }

      try {
        const checks = await loadVitaminDReminderState(user.id, activeBabyId);
        if (!active) return;
        setVitaminDChecks(checks);
      } catch (error) {
        console.error('Daily: failed to load Vitamin-D reminder', error);
        if (active) {
          setVitaminDChecks({});
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [activeBabyId, isReady, user?.id]);

  useEffect(() => {
    if (!user?.id || !activeBabyId || !isReady) {
      return;
    }

    let active = true;
    const channel = supabase
      .channel(`vitamin-d-habit-checks:${activeBabyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'baby_daily_habit_checks',
        },
        async (payload) => {
          const nextRecord =
            payload && typeof payload === 'object' && 'new' in payload
              ? (payload.new as { baby_id?: string } | null)
              : null;
          const previousRecord =
            payload && typeof payload === 'object' && 'old' in payload
              ? (payload.old as { baby_id?: string } | null)
              : null;
          const changedBabyId = nextRecord?.baby_id ?? previousRecord?.baby_id ?? null;

          if (changedBabyId && changedBabyId !== activeBabyId) {
            return;
          }

          try {
            const checks = await loadVitaminDReminderState(user.id, activeBabyId);
            if (!active) return;
            setVitaminDChecks(checks);
          } catch (error) {
            console.error('Daily: failed to refresh Vitamin-D state from realtime', error);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [activeBabyId, isReady, user?.id]);

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const isSelectedDateToday = selectedDateKey === toDateKey(new Date());
  const isVitaminDCompleted = !!vitaminDChecks[selectedDateKey];
  const showVitaminDStrip = !!user?.id && !!activeBabyId && !isVitaminDCompleted;
  const showVitaminDTimelinePoint = !!user?.id && !!activeBabyId;
  const bottleGapLabelByEntryId = useMemo(() => {
    const labelMap = new Map<string, string>();

    const chronologicalEntries = [...entries]
      .map((entry) => ({
        entry,
        timestamp: getEntryTimelineTimestamp(entry),
      }))
      .filter((item): item is { entry: DailyEntry; timestamp: number } => item.timestamp !== null)
      .sort((a, b) => a.timestamp - b.timestamp);

    let previousBottleTimestamp: number | null = null;

    for (const { entry, timestamp } of chronologicalEntries) {
      if (entry.entry_type !== 'feeding' || entry.feeding_type !== 'BOTTLE') {
        continue;
      }

      if (previousBottleTimestamp !== null && entry.id) {
        const diffMinutes = Math.round((timestamp - previousBottleTimestamp) / (1000 * 60));
        const label = formatBottleGapLabel(diffMinutes);
        if (label) {
          labelMap.set(entry.id, label);
        }
      }

      previousBottleTimestamp = timestamp;
    }

    return labelMap;
  }, [entries]);
  const feedingOverviewCards = useMemo(() => buildFeedingOverviewCards(entries), [entries]);
  const feedingOverviewEntryCount = useMemo(
    () => feedingOverviewCards.reduce((sum, card) => sum + card.count, 0),
    [feedingOverviewCards],
  );
  const feedingOverviewLatestTime = useMemo(() => {
    const timestamps = feedingOverviewCards
      .map((card) => card.lastAt)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (timestamps.length === 0) return null;
    return Math.max(...timestamps);
  }, [feedingOverviewCards]);
  const feedingOverviewHighlights = useMemo(() => {
    const bottleCard = feedingOverviewCards.find((card) => card.key === 'BOTTLE');
    const waterCard = feedingOverviewCards.find((card) => card.key === 'WATER');
    const solidsCard = feedingOverviewCards.find((card) => card.key === 'SOLIDS');
    const breastCard = feedingOverviewCards.find((card) => card.key === 'BREAST');
    const pumpCard = feedingOverviewCards.find((card) => card.key === 'PUMP');

    return [
      bottleCard && bottleCard.totalMl > 0 ? `🍼 ${bottleCard.totalMl} ml Fläschchen` : null,
      waterCard && waterCard.totalMl > 0 ? `🚰 ${waterCard.totalMl} ml Wasser` : null,
      solidsCard && solidsCard.count > 0 ? `🥄 ${solidsCard.count}× Beikost` : null,
      breastCard && breastCard.totalMinutes > 0
        ? `🤱 ${formatDurationMinutesCompact(breastCard.totalMinutes)} Stillen`
        : null,
      pumpCard && pumpCard.totalMl > 0 ? `🥛 ${pumpCard.totalMl} ml abgepumpt` : null,
    ].filter((item): item is string => !!item);
  }, [feedingOverviewCards]);

  const handleToggleVitaminDCompletion = useCallback(async () => {
    if (!user?.id || !activeBabyId || vitaminDBusy) return;
    if (!ensureWritableInCurrentMode()) return;

    setVitaminDBusy(true);
    try {
      const nextChecks = await saveVitaminDCompletion(
        user.id,
        selectedDateKey,
        !isVitaminDCompleted,
        activeBabyId,
      );
      setVitaminDChecks(nextChecks);
    } catch (error) {
      console.error('Daily: failed to save Vitamin-D status', error);
      Alert.alert('Fehler', 'Der Vitamin-D-Status konnte nicht gespeichert werden.');
    } finally {
      setVitaminDBusy(false);
    }
  }, [
    ensureWritableInCurrentMode,
    activeBabyId,
    isVitaminDCompleted,
    selectedDateKey,
    user?.id,
    vitaminDBusy,
  ]);

  const queueLiveStopRequestFromUrl = useCallback((incomingUrl: string | null) => {
    if (!incomingUrl) return;

    const normalized = incomingUrl.toLowerCase();
    const targetsDailyView = normalized.includes("daily_old");
    const hasLiveStopParam = /[?&]livestop=(1|true)(?:&|$)/i.test(incomingUrl);
    const hasFeedingTypeParam = /[?&]livetype=feeding(?:&|$)/i.test(incomingUrl);

    if (!targetsDailyView || !hasLiveStopParam) return;
    if (/[?&]livetype=/i.test(incomingUrl) && !hasFeedingTypeParam) return;

    const now = Date.now();
    const lastEvent = lastLiveStopEventRef.current;
    if (lastEvent && lastEvent.url === incomingUrl && now - lastEvent.at < 1500) {
      return;
    }

    lastLiveStopEventRef.current = { url: incomingUrl, at: now };
    setLiveStopRequestId((current) => current + 1);
  }, []);

  const startBreastfeedingLiveActivity = useCallback(async (startMs: number) => {
    if (!sleepActivityService.isLiveActivitySupported()) {
      return;
    }

    try {
      await sleepActivityService.startFeedingActivity(new Date(startMs), 'BREAST');
    } catch (error) {
      console.error('Failed to start feeding live activity:', error);
    }
  }, []);

  const endBreastfeedingLiveActivity = useCallback(async (timer: {
    id: string;
    type: 'BOTTLE' | 'BREAST' | 'SOLIDS' | 'PUMP' | 'WATER' | 'DIAPER';
    start: number;
  } | null) => {
    if (!timer || timer.type !== 'BREAST') {
      return;
    }

    if (!sleepActivityService.isLiveActivitySupported()) {
      return;
    }

    try {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timer.start) / 1000));
      await sleepActivityService.endFeedingActivity(formatDurationSeconds(elapsedSeconds), timer.type);
    } catch (error) {
      console.error('Failed to end feeding live activity:', error);
    }
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      queueLiveStopRequestFromUrl(event.url);
    });

    Linking.getInitialURL()
      .then((initialUrl) => {
        queueLiveStopRequestFromUrl(initialUrl);
      })
      .catch((error) => {
        console.error('Failed to read initial URL for feeding live activity stop:', error);
      });

    return () => {
      subscription.remove();
    };
  }, [queueLiveStopRequestFromUrl]);

  useEffect(() => {
    setIsTimerHydrated(false);
  }, [activeBabyId]);

  useEffect(() => {
    if (!isReady || !activeBabyId) return;
  
    if (selectedTab === 'week') {
      loadWeekEntries();
    } else if (selectedTab === 'month') {
      loadMonthEntries();
    } else {
      loadEntries();
    }
  }, [selectedDate, selectedTab, activeBabyId, isReady]);

  // Separate effects for week/month data loading
  useEffect(() => {
    if (!isReady || !activeBabyId) return;
  
    if (selectedTab === 'week') {
      loadWeekEntries();
    }
  }, [selectedWeekDate, selectedTab, activeBabyId, isReady]);

  useEffect(() => {
    if (!isReady || !activeBabyId) return;
  
    if (selectedTab === 'month') {
      loadMonthEntries();
    }
  }, [selectedMonthDate, selectedTab, activeBabyId, isReady]);

  // Keep selectedWeekDate in sync with weekOffset (for data loading)
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    setSelectedWeekDate(d);
  }, [weekOffset]);

  // Reset offsets on tab change like sleep-tracker
  useEffect(() => {
    if (selectedTab === 'week') setWeekOffset(0);
    if (selectedTab === 'month') setMonthOffset(0);
  }, [selectedTab]);

  // Helper functions for week view
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
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

  useEffect(() => {
    Animated.timing(fadeNavAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(fadeNavAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() =>
        setShowDateNav(false),
      );
    }, 5000) as unknown as NodeJS.Timeout;
    return () => clearTimeout(timer);
  }, [selectedDate, fadeNavAnim]);

  const triggerShowDateNav = () => {
    setShowDateNav(true);
    Animated.timing(fadeNavAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (hideNavTimeout.current) clearTimeout(hideNavTimeout.current);
    hideNavTimeout.current = setTimeout(() => {
      Animated.timing(fadeNavAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
        setShowDateNav(false),
      );
    }, 5000) as unknown as NodeJS.Timeout;
  };

  useEffect(() => {
    triggerShowDateNav();
    return () => {
      if (hideNavTimeout.current) clearTimeout(hideNavTimeout.current);
    };
  }, [selectedDate]);

  useEffect(() => {
    setShowFeedingOverviewModal(false);
  }, [selectedDate, selectedTab]);

  // Realtime subscription removed for simplicity; list refreshes on actions
  // mapCareToDaily moved to dailyCache.ts

  const lastBottleVolumeMl = useMemo(() => {
    const allEntries = [...entries, ...weekEntries, ...monthEntries];
    let latestTime = -Infinity;
    let latestVolume: number | null = null;

    for (const entry of allEntries) {
      if (entry.entry_type !== 'feeding' || (entry.feeding_type !== 'BOTTLE' && entry.feeding_type !== 'PUMP')) continue;
      const volume = entry.feeding_volume_ml;
      if (volume == null) continue;
      const timeStr = entry.start_time ?? entry.entry_date;
      const time = timeStr ? new Date(timeStr).getTime() : 0;
      if (time >= latestTime) {
        latestTime = time;
        latestVolume = volume;
      }
    }

    return latestVolume ?? 120;
  }, [entries, weekEntries, monthEntries]);

  const loadActiveTimer = useCallback(async () => {
    if (!activeBabyId) {
      setActiveTimer(null);
      setIsTimerHydrated(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('baby_care_entries')
        .select('id,feeding_type,start_time')
        .eq('baby_id', activeBabyId)
        .eq('entry_type', 'feeding')
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading active timer:', error);
        return;
      }

      const openTimers = data ?? [];
      const validTypeSet = new Set(['BREAST', 'BOTTLE', 'SOLIDS', 'PUMP', 'WATER']);
      const validOpenTimers = openTimers.filter(
        (
          row,
        ): row is { id: string; feeding_type: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'PUMP' | 'WATER'; start_time: string } =>
          !!row?.id && !!row?.start_time && typeof row.feeding_type === 'string' && validTypeSet.has(row.feeding_type),
      );
      const current = validOpenTimers[0];

      // Data hygiene: only one timer can be active. Close stale open timers automatically.
      const staleOpenTimers = openTimers.filter((row) => !!row?.id && (!current || row.id !== current.id));
      if (!isReadOnlyPreviewMode && staleOpenTimers.length > 0) {
        const nowIso = new Date().toISOString();
        await Promise.allSettled(
          staleOpenTimers.map((row) => {
            const startMs = row.start_time ? new Date(row.start_time).getTime() : NaN;
            const endIso = Number.isFinite(startMs) ? new Date(startMs).toISOString() : nowIso;
            return supabase
              .from('baby_care_entries')
              .update({ end_time: endIso, updated_at: nowIso })
              .eq('id', row.id)
              .eq('baby_id', activeBabyId)
              .is('end_time', null);
          }),
        );
      }

      if (!current?.id || !current.start_time) {
        setActiveTimer(null);
        return;
      }

      const startMs = new Date(current.start_time).getTime();
      if (!Number.isFinite(startMs)) {
        setActiveTimer(null);
        return;
      }

      const nextType = current.feeding_type;

      setActiveTimer((prev) => {
        if (prev && prev.id === current.id && prev.type === nextType && prev.start === startMs) {
          return prev;
        }

        return {
          id: current.id,
          type: nextType,
          start: startMs,
        };
      });
    } catch (error) {
      console.error('Failed to resolve active timer:', error);
    } finally {
      setIsTimerHydrated(true);
    }
  }, [activeBabyId, isReadOnlyPreviewMode]);

  const loadEntries = async () => {
    if (!activeBabyId) return;
    setIsLoading(true);

    try {
      // Load with cache - instant if cached
      const { data, isStale, refresh } = await loadDayEntriesWithCache(
        selectedDate,
        activeBabyId
      );

      // Show cached data immediately
      if (data) {
        setEntries(data);
        setIsLoading(false);
      }

      // Refresh in background if stale
      if (isStale) {
        const freshData = await refresh();
        setEntries(freshData);
      }

      // If no cache, data is already fresh
      if (!data) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading day entries:', error);
      setIsLoading(false);
    } finally {
      await loadActiveTimer();
      setRefreshing(false);
    }
  };

  const loadWeekEntries = async () => {
    if (!activeBabyId) return;
    setIsLoading(true);

    const weekStart = getWeekStart(selectedWeekDate);
    const weekEnd = getWeekEnd(selectedWeekDate);

    try {
      // Load with cache - instant if cached
      const { data, isStale, refresh } = await loadWeekEntriesWithCache(
        weekStart,
        weekEnd,
        activeBabyId
      );

      // Show cached data immediately
      if (data) {
        setWeekEntries(data);
        setIsLoading(false);
      }

      // Refresh in background if stale
      if (isStale) {
        const freshData = await refresh();
        setWeekEntries(freshData);
      }

      // If no cache, data is already fresh
      if (!data) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading week entries:', error);
      setIsLoading(false);
    } finally {
      await loadActiveTimer();
    }
  };

  const loadMonthEntries = async () => {
    if (!activeBabyId) return;
    setIsLoading(true);

    try {
      // Load with cache - instant if cached
      const { data, isStale, refresh } = await loadMonthEntriesWithCache(
        selectedMonthDate,
        activeBabyId
      );

      // Show cached data immediately
      if (data) {
        setMonthEntries(data);
        setIsLoading(false);
      }

      // Refresh in background if stale
      if (isStale) {
        const freshData = await refresh();
        setMonthEntries(freshData);
      }

      // If no cache, data is already fresh
      if (!data) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading month entries:', error);
      setIsLoading(false);
    } finally {
      await loadActiveTimer();
    }
  };

  const syncDailyEntries = async () => {};

  const handleRefresh = async () => {
    setRefreshing(true);

    // Start loading entries
    const loadPromise = loadEntries();

    // Set maximum refresh time to 2 seconds
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        setRefreshing(false);
        resolve();
      }, 2000);
    });

    // Wait for either loading to complete or timeout
    await Promise.race([loadPromise, timeoutPromise]);

    // If loading completed before timeout, stop refreshing
    if (!refreshing) {
      setRefreshing(false);
    }
  };

  const changeRelativeDate = (days: number) =>
    setSelectedDate(new Date(selectedDate.getTime() + days * 24 * 60 * 60 * 1000));

  const handleQuickActionPress = (action: QuickActionType) => {
    if (!ensureWritableInCurrentMode()) return;
    if (action.startsWith('feeding')) setSelectedActivityType('feeding');
    else if (action.startsWith('diaper')) setSelectedActivityType('diaper');
    else setSelectedActivityType('other');
    setSelectedSubType(action);
    // Preselect modal fields by subtype
    if (action === 'feeding_breast') setEditingEntry({} as any);
    if (action === 'feeding_bottle') setEditingEntry({} as any);
    if (action === 'feeding_solids') setEditingEntry({} as any);
    if (action === 'feeding_pump') setEditingEntry({} as any);
    if (action === 'feeding_water') setEditingEntry({} as any);
    if (action === 'diaper_wet' || action === 'diaper_dirty' || action === 'diaper_both') setEditingEntry({} as any);
    setShowInputModal(true);
  };

  useEffect(() => {
    const rawAction = Array.isArray(quickAction) ? quickAction[0] : quickAction;
    if (!rawAction) {
      quickActionHandledRef.current = null;
      return;
    }
    if (quickActionHandledRef.current === rawAction) return;

    const resolved =
      rawAction === 'feeding'
        ? { activityType: 'feeding' as const, subType: null }
        : rawAction === 'diaper'
          ? { activityType: 'diaper' as const, subType: null }
          : rawAction === 'feeding_breast' || rawAction === 'feeding_bottle' || rawAction === 'feeding_solids' || rawAction === 'feeding_pump' || rawAction === 'feeding_water'
            ? { activityType: 'feeding' as const, subType: rawAction as QuickActionType }
            : rawAction === 'diaper_wet' || rawAction === 'diaper_dirty' || rawAction === 'diaper_both'
              ? { activityType: 'diaper' as const, subType: rawAction as QuickActionType }
              : null;

    if (!resolved) return;
    if (!ensureWritableInCurrentMode()) {
      router.setParams({ quickAction: undefined });
      return;
    }
    quickActionHandledRef.current = rawAction;
    setSelectedActivityType(resolved.activityType);
    setSelectedSubType(resolved.subType);
    setEditingEntry(null);
    setShowInputModal(true);
    router.setParams({ quickAction: undefined });
  }, [ensureWritableInCurrentMode, quickAction, router]);

  const handleSaveEntry = async (payload: any, options?: { startTimer?: boolean }) => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeBabyId) {
      Alert.alert(
        'Kein Kind ausgewählt',
        'Bitte wähle zuerst ein Kind aus.'
      );
      return;
    }
    console.log('handleSaveEntry - Received payload:', JSON.stringify(payload, null, 2));
    console.log('handleSaveEntry - selectedActivityType:', selectedActivityType);
    console.log('handleSaveEntry - selectedSubType:', selectedSubType);
    const timerRequested = !!options?.startTimer && payload?.feeding_type !== 'PUMP' && payload?.feeding_type !== 'WATER';
    
    if (selectedActivityType === 'feeding') {
      const feedingType = (payload.feeding_type as 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'PUMP' | 'WATER' | undefined) ?? undefined;
      const resolvedStartTime = payload.start_time ?? new Date().toISOString();
      const resolvedEndTime = timerRequested ? null : (payload.end_time ?? resolvedStartTime);
      let data, error;
      if (editingEntry?.id) {
        const res = await updateBabyCareEntry(editingEntry.id, {
          start_time: resolvedStartTime,
          end_time: resolvedEndTime,
          notes: payload.notes ?? null,
          feeding_type: feedingType,
          feeding_volume_ml: payload.feeding_volume_ml ?? null,
          feeding_side: payload.feeding_side ?? null,
        }, activeBabyId ?? undefined);
        data = res.data; error = res.error;
      } else {
        const res = await addBabyCareEntry({
          entry_type: 'feeding',
          start_time: resolvedStartTime,
          end_time: resolvedEndTime,
          notes: payload.notes ?? null,
          feeding_type: feedingType,
          feeding_volume_ml: payload.feeding_volume_ml ?? null,
          feeding_side: payload.feeding_side ?? null,
        }, activeBabyId ?? undefined);
        data = res.data; error = res.error;
      }
      if (error) {
        Alert.alert('Fehler', String((error as any)?.message ?? error ?? 'Fehler beim Speichern der Fütterung'));
        return;
      }
      if (timerRequested && feedingType) {
        const startMs = new Date(resolvedStartTime).getTime();
        const timerType = feedingType as 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'PUMP' | 'WATER';
        const nextTimer = {
          id: data?.id || editingEntry?.id || `temp_${Date.now()}`,
          type: timerType,
          start: startMs,
        };

        setActiveTimer(nextTimer);

        if (timerType === 'BREAST') {
          await startBreastfeedingLiveActivity(startMs);
        }
      }
      showSuccessSplash(
        feedingType === 'BREAST' ? '#8E4EC6' : feedingType === 'BOTTLE' ? '#4A90E2' : feedingType === 'PUMP' ? '#35B6B4' : feedingType === 'WATER' ? '#4FC3F7' : '#F5A623',
        feedingType === 'BREAST' ? '🤱' : feedingType === 'BOTTLE' ? '🍼' : feedingType === 'PUMP' ? '🥛' : feedingType === 'WATER' ? '🚰' : '🥄',
        feedingType === 'BREAST' ? 'feeding_breast' : feedingType === 'BOTTLE' ? 'feeding_bottle' : feedingType === 'PUMP' ? 'feeding_pump' : feedingType === 'WATER' ? 'feeding_water' : 'feeding_solids',
        timerRequested
      );
    } else if (selectedActivityType === 'diaper') {
      const diaperType = (payload.diaper_type as 'WET' | 'DIRTY' | 'BOTH' | undefined) ?? undefined;
      const resolvedStartTime = payload.start_time ?? new Date().toISOString();
      const resolvedEndTime = timerRequested ? null : (payload.end_time ?? resolvedStartTime);
      let data, error;
      if (editingEntry?.id) {
        const res = await updateBabyCareEntry(editingEntry.id, {
          start_time: resolvedStartTime,
          end_time: resolvedEndTime,
          notes: payload.notes ?? null,
          diaper_type: diaperType,
          diaper_fever_measured: payload.diaper_fever_measured ?? null,
          diaper_temperature_c: payload.diaper_temperature_c ?? null,
          diaper_suppository_given: payload.diaper_suppository_given ?? null,
          diaper_suppository_dose_mg: payload.diaper_suppository_dose_mg ?? null,
        }, activeBabyId ?? undefined);
        data = res.data; error = res.error;
      } else {
        const res = await addBabyCareEntry({
          entry_type: 'diaper',
          start_time: resolvedStartTime,
          end_time: resolvedEndTime,
          notes: payload.notes ?? null,
          diaper_type: diaperType,
          diaper_fever_measured: payload.diaper_fever_measured ?? null,
          diaper_temperature_c: payload.diaper_temperature_c ?? null,
          diaper_suppository_given: payload.diaper_suppository_given ?? null,
          diaper_suppository_dose_mg: payload.diaper_suppository_dose_mg ?? null,
        }, activeBabyId ?? undefined);
        data = res.data; error = res.error;
      }
      if (error) {
        Alert.alert('Fehler', String((error as any)?.message ?? error ?? 'Fehler beim Speichern'));
        return;
      }
      if (timerRequested) {
        const startMs = new Date(resolvedStartTime).getTime();
        setActiveTimer({
          id: data?.id || editingEntry?.id || `temp_${Date.now()}`,
          type: 'DIAPER',
          start: startMs,
        });
      }
      showSuccessSplash(
        diaperType === 'WET' ? '#3498DB' : diaperType === 'DIRTY' ? '#8E5A2B' : '#38A169',
        diaperType === 'WET' ? '💧' : diaperType === 'DIRTY' ? '💩' : '💧💩',
        diaperType === 'WET' ? 'diaper_wet' : diaperType === 'DIRTY' ? 'diaper_dirty' : 'diaper_both',
        timerRequested
      );
    } else {
      Alert.alert('Hinweis', 'Sonstige Einträge sind in der neuen Ansicht nicht verfügbar.');
    }
    setShowInputModal(false);
    setEditingEntry(null);

    // Invalidate cache after save
    if (activeBabyId) {
      await invalidateDailyCache(activeBabyId);
    }

    // Reload current view
    if (selectedTab === 'week') {
      loadWeekEntries();
    } else if (selectedTab === 'month') {
      loadMonthEntries();
    } else {
      loadEntries();
    }
  };

  const showSuccessSplash = (hex: string, emoji: string, kind: string, timerStarted = false) => {
    const rgba = (h: string, a: number) => {
      const c = h.replace('#','');
      const r = parseInt(c.substring(0,2),16);
      const g = parseInt(c.substring(2,4),16);
      const b = parseInt(c.substring(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    };
    setSplashBg(rgba(hex, 1));
    setSplashEmoji(emoji);
    // Texte je Kontext
    if (kind === 'feeding_breast') {
      setSplashTitle(timerStarted ? 'Stillen läuft' : 'Stillen gespeichert');
      setSplashSubtitle(timerStarted ? 'Nimm dir Zeit. Genieße diese besonderen Momente.' : 'Eintrag ohne Timer gesichert.');
      setSplashStatus(timerStarted ? 'Timer gestartet...' : '');
      setSplashHint(timerStarted ? 'Stoppe, wenn ihr fertig seid' : 'Du gibst deinem Baby alles, was es braucht');
      setSplashHintEmoji('💕');
      setSplashText('');
    } else if (kind === 'feeding_bottle') {
      setSplashTitle(timerStarted ? 'Fläschchen läuft' : 'Fläschchen gespeichert');
      setSplashSubtitle(timerStarted ? 'Ganz in Ruhe – du machst das super.' : 'Eintrag ohne Timer gesichert.');
      setSplashStatus(timerStarted ? 'Timer gestartet...' : '');
      setSplashHint(timerStarted ? 'Stoppe, wenn ihr fertig seid' : 'Nähe und Ernährung – perfekt kombiniert');
      setSplashHintEmoji('🤍');
      setSplashText('');
    } else if (kind === 'feeding_solids') {
      setSplashTitle(timerStarted ? 'Beikost läuft' : 'Beikost gespeichert');
      setSplashSubtitle(timerStarted ? 'Timer läuft mit, bis du stoppst.' : 'Jeder Löffel ein kleiner Fortschritt.');
      setSplashStatus(timerStarted ? 'Timer gestartet...' : '');
      setSplashHint(timerStarted ? 'Stoppe, sobald ihr fertig seid.' : 'Weiter so – ihr wachst gemeinsam!');
      setSplashHintEmoji('');
      setSplashText('');
    } else if (kind === 'feeding_pump') {
      setSplashTitle('Abpumpen gespeichert');
      setSplashSubtitle('Die abgepumpte Milch ist jetzt dokumentiert.');
      setSplashStatus('');
      setSplashHint('So behältst du Menge und Zeitpunkt im Blick');
      setSplashHintEmoji('🥛');
      setSplashText('');
    } else if (kind === 'feeding_water') {
      setSplashTitle('Wasser gespeichert');
      setSplashSubtitle('Die Wasseraufnahme ist jetzt dokumentiert.');
      setSplashStatus('');
      setSplashHint('So behältst du die Trinkmenge im Blick');
      setSplashHintEmoji('🚰');
      setSplashText('');
    } else {
      setSplashTitle(timerStarted ? 'Wickeln läuft' : 'Wickeln gespeichert');
      setSplashSubtitle(timerStarted ? 'Timer läuft mit, bis du stoppst.' : 'Alles frisch – wohlfühlen ist wichtig.');
      setSplashStatus(timerStarted ? 'Timer gestartet...' : '');
      setSplashHint(timerStarted ? 'Stoppe, wenn du fertig bist' : 'Danke für deine liebevolle Fürsorge');
      setSplashHintEmoji('✨');
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

  const handleTimerStop = useCallback(async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeTimer) return;
    if (!activeBabyId) return;

    const timerToStop = activeTimer;
    const { error } = await stopBabyCareEntryTimer(timerToStop.id, activeBabyId);
    if (error) {
      Alert.alert('Fehler', String((error as any)?.message ?? error ?? 'Unbekannter Fehler'));
      return;
    }

    await endBreastfeedingLiveActivity(timerToStop);
    setActiveTimer(null);

    // Invalidate cache after timer stop
    await invalidateDailyCache(activeBabyId);

    // Reload current view
    if (selectedTab === 'week') {
      loadWeekEntries();
    } else if (selectedTab === 'month') {
      loadMonthEntries();
    } else {
      loadEntries();
    }

    Alert.alert('Erfolg', 'Timer gestoppt! ⏹️');
  }, [
    ensureWritableInCurrentMode,
    activeBabyId,
    activeTimer,
    endBreastfeedingLiveActivity,
    selectedTab,
    loadWeekEntries,
    loadMonthEntries,
    loadEntries,
  ]);

  useEffect(() => {
    if (!sleepActivityService.isLiveActivitySupported()) {
      return;
    }
    if (!isTimerHydrated) {
      return;
    }

    let cancelled = false;

    const syncFeedingLiveActivity = async () => {
      try {
        if (activeTimer?.type === 'BREAST') {
          const restored = await sleepActivityService.restoreCurrentFeedingActivity();
          if (cancelled) return;

          if (!restored) {
            await sleepActivityService.startFeedingActivity(new Date(activeTimer.start), activeTimer.type);
            return;
          }

          const elapsedSeconds = Math.max(0, Math.floor((Date.now() - activeTimer.start) / 1000));
          await sleepActivityService.updateFeedingActivity(formatDurationSeconds(elapsedSeconds), activeTimer.type);
        } else {
          await sleepActivityService.endAllFeedingActivities();
        }
      } catch (error) {
        console.error('Failed to synchronize feeding live activity:', error);
      }
    };

    void syncFeedingLiveActivity();

    return () => {
      cancelled = true;
    };
  }, [activeTimer?.id, activeTimer?.start, activeTimer?.type, isTimerHydrated]);

  useEffect(() => {
    if (!sleepActivityService.isLiveActivitySupported()) {
      return;
    }
    if (!isTimerHydrated || activeTimer?.type !== 'BREAST') {
      return;
    }

    const updateElapsedTimeInLiveActivity = async () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - activeTimer.start) / 1000));
      await sleepActivityService.updateFeedingActivity(formatDurationSeconds(elapsedSeconds), activeTimer.type);
    };

    void updateElapsedTimeInLiveActivity();

    const intervalId = setInterval(() => {
      void updateElapsedTimeInLiveActivity();
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [activeTimer?.id, activeTimer?.start, activeTimer?.type, isTimerHydrated]);

  useEffect(() => {
    if (liveStopRequestId === 0) return;
    if (handledLiveStopRequestIdRef.current === liveStopRequestId) return;
    if (!isTimerHydrated) return;

    handledLiveStopRequestIdRef.current = liveStopRequestId;

    if (!activeTimer?.id || activeTimer.type !== 'BREAST') {
      console.log('Live Activity stop requested, but no active breastfeeding timer exists.');
      return;
    }

    if (isReadOnlyPreviewMode) return;
    void handleTimerStop();
  }, [activeTimer?.id, activeTimer?.type, handleTimerStop, isReadOnlyPreviewMode, isTimerHydrated, liveStopRequestId]);

  const handleDeleteEntry = async (id: string) => {
    if (!ensureWritableInCurrentMode()) return;
    Alert.alert('Eintrag löschen', 'Möchtest du diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          if (!ensureWritableInCurrentMode()) return;
          if (!activeBabyId) return;
          const { error } = await deleteBabyCareEntry(id, activeBabyId);
          if (error) return;

          if (activeTimer?.id === id) {
            await endBreastfeedingLiveActivity(activeTimer);
            setActiveTimer(null);
          }

          // Invalidate cache after delete
          await invalidateDailyCache(activeBabyId);

          // Reload current view
          if (selectedTab === 'week') {
            loadWeekEntries();
          } else if (selectedTab === 'month') {
            loadMonthEntries();
          } else {
            loadEntries();
          }

          Alert.alert('Erfolg', 'Eintrag gelöscht! 🗑️');
        },
      },
    ]);
  };

  const TopTabs = () => (
    <View style={s.topTabsContainer}>
      {(['day', 'week', 'month'] as const).map((tab) => (
        <GlassCard key={tab} style={[s.topTab, selectedTab === tab && s.activeTopTab]} intensity={22}>
          <TouchableOpacity
            style={s.topTabInner}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 12, right: 12 }}
            onPress={() => {
              setSelectedTab(tab);
              if (tab === 'day') {
                setSelectedDate(new Date());
                triggerShowDateNav();
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={[s.topTabText, { color: textSecondary }, selectedTab === tab && s.activeTopTabText]}>
              {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      ))}
    </View>
  );

  // Week navigation functions
  const goToPreviousWeek = () => setWeekOffset((o) => o - 1);
  const goToNextWeek = () => setWeekOffset((o) => o + 1);
  const goToCurrentWeek = () => setWeekOffset(0);

  const WeekView = () => {
    // Reference date derived from weekOffset (exact like sleep-tracker)
    const refDate = useMemo(() => {
      const d = new Date();
      d.setDate(d.getDate() + weekOffset * 7);
      return d;
    }, [weekOffset]);

    const weekDays = getWeekDays(refDate);
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    const getEntriesForDay = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return weekEntries.filter(entry => {
        const entryDateStr = new Date(entry.entry_date).toISOString().split('T')[0];
        return entryDateStr === dateStr;
      });
    };

    const getDayStats = (date: Date) => {
      const dayEntries = getEntriesForDay(date);
      const feedingCount = dayEntries.filter(e => e.entry_type === 'feeding').length;
      const diaperCount = dayEntries.filter(e => e.entry_type === 'diaper').length;
      return { feedingCount, diaperCount, total: dayEntries.length };
    };

    // Aggregation for chart: total entries per day
    const dayTotals = weekDays.map((d) => getEntriesForDay(d).length);
    const maxCount = Math.max(...dayTotals, 4);

    // Weekly summary totals
    const totalFeedings = weekEntries.filter((e: any) => e.entry_type === 'feeding' && e.feeding_type !== 'PUMP' && e.feeding_type !== 'WATER').length;
    const totalDiapers = weekEntries.filter((e) => e.entry_type === 'diaper').length;

    const weekStart = getWeekStart(refDate);
    const weekEnd = getWeekEnd(refDate);

    return (
      <View style={s.weekViewContainer}>
        {/* Week Navigation - identical structure */}
        <View style={s.weekNavigationContainer}>
          <TouchableOpacity style={s.weekNavButton} onPress={goToPreviousWeek}>
            <Text style={[s.weekNavButtonText, { color: textSecondary }]}>‹</Text>
          </TouchableOpacity>

          <View style={s.weekHeaderCenter}>
            <Text style={[s.weekHeaderTitle, { color: textSecondary }]}>Wochenübersicht</Text>
            <Text style={[s.weekHeaderSubtitle, { color: textSecondary }]}>
              {weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
            </Text>
          </View>

          <TouchableOpacity style={s.weekNavButton} onPress={goToNextWeek}>
            <Text style={[s.weekNavButtonText, { color: textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Wickeln diese Woche - Design Guide konform mit Liquid Glass (EXAKT wie Sleep-Tracker) */}
        <LiquidGlassCard style={s.chartGlassCard}>
          <Text style={[s.chartTitle, { color: textSecondary }]}>Wickeln diese Woche</Text>

          {/* feste Gesamtbreite = WEEK_CONTENT_WIDTH (wie Timeline) */}
          <View style={[s.chartArea, { width: WEEK_CONTENT_WIDTH, alignSelf: 'center' }]}>
            {weekDays.map((day, i) => {
              const diaperCount = getEntriesForDay(day).filter((e) => e.entry_type === 'diaper').length;
              const maxDiaper = Math.max(...weekDays.map((d) => getEntriesForDay(d).filter((e) => e.entry_type === 'diaper').length), 4);
              const totalH = diaperCount ? (diaperCount / maxDiaper) * MAX_BAR_H : 0;

              // Pixelgenaue Spaltenbreite für Week-Chart (EXAKT wie Sleep-Tracker)
              const extra = i < (COLS - 1) && i < Math.floor((WEEK_CONTENT_WIDTH - (COLS * WEEK_COL_WIDTH + (COLS - 1) * GUTTER))) ? 1 : 0;

              return (
                <View
                  key={i}
                  style={{
                    width: WEEK_COL_WIDTH + extra,
                    marginRight: i < (COLS - 1) ? GUTTER : 0,
                    alignItems: 'center',
                  }}
                >
                  <View style={[s.chartBarContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    {totalH > 0 && <View
                      style={[
                        s.chartBar,
                        s.chartBarDiaper,
                        { height: totalH, width: Math.max(10, Math.round(WEEK_COL_WIDTH * 0.66)) }
                      ]}
                    />}
                  </View>

                  <View style={[s.chartLabelContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    <Text allowFontScaling={false} style={[s.chartLabel, { color: textSecondary }]}>{dayNames[i]}</Text>
                    <Text allowFontScaling={false} style={[s.chartValue, { color: textSecondary }]}>{diaperCount}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </LiquidGlassCard>

        {/* Mahlzeiten diese Woche (Stillen, Fläschchen, Beikost) - EXAKT wie Sleep-Tracker */}
        <LiquidGlassCard style={s.chartGlassCard}>
          <Text style={[s.chartTitle, { color: textSecondary }]}>Mahlzeiten diese Woche</Text>

          {/* feste Gesamtbreite = WEEK_CONTENT_WIDTH (wie Timeline) */}
          <View style={[s.chartArea, { width: WEEK_CONTENT_WIDTH, alignSelf: 'center' }]}>
            {weekDays.map((day, i) => {
              const feedingEntries = getEntriesForDay(day).filter((e: any) => e.entry_type === 'feeding' && e.feeding_type !== 'PUMP' && e.feeding_type !== 'WATER');
              const breast = feedingEntries.filter((e: any) => e.feeding_type === 'BREAST').length;
              const bottle = feedingEntries.filter((e: any) => e.feeding_type === 'BOTTLE').length;
              const solids = feedingEntries.filter((e: any) => e.feeding_type === 'SOLIDS').length;
              
              const maxFeed = Math.max(4, ...weekDays.flatMap((d) => {
                const items = getEntriesForDay(d).filter((e: any) => e.entry_type === 'feeding' && e.feeding_type !== 'PUMP' && e.feeding_type !== 'WATER');
                return [
                  items.filter((e: any) => e.feeding_type === 'BREAST').length,
                  items.filter((e: any) => e.feeding_type === 'BOTTLE').length,
                  items.filter((e: any) => e.feeding_type === 'SOLIDS').length,
                ];
              }));

              const breastH = breast ? (breast / maxFeed) * MAX_BAR_H : 0;
              const bottleH = bottle ? (bottle / maxFeed) * MAX_BAR_H : 0;
              const solidsH = solids ? (solids / maxFeed) * MAX_BAR_H : 0;

              // Pixelgenaue Spaltenbreite für Week-Chart (EXAKT wie Sleep-Tracker)
              const extra = i < (COLS - 1) && i < Math.floor((WEEK_CONTENT_WIDTH - (COLS * WEEK_COL_WIDTH + (COLS - 1) * GUTTER))) ? 1 : 0;
              const barW = Math.max(10, Math.round(WEEK_COL_WIDTH * 0.66));
              const miniW = Math.max(6, Math.floor((barW - 8) / 3));

              return (
                <View
                  key={i}
                  style={{
                    width: WEEK_COL_WIDTH + extra,
                    marginRight: i < (COLS - 1) ? GUTTER : 0,
                    alignItems: 'center',
                  }}
                >
                  <View style={[s.chartBarContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                      {breastH > 0 && <View style={[s.chartBar, s.chartBarBreast, { height: breastH, width: miniW }]} />}
                      {bottleH > 0 && <View style={[s.chartBar, s.chartBarBottle, { height: bottleH, width: miniW }]} />}
                      {solidsH > 0 && <View style={[s.chartBar, s.chartBarSolids, { height: solidsH, width: miniW }]} />}
                    </View>
                  </View>

                  <View style={[s.chartLabelContainer, { width: WEEK_COL_WIDTH + extra }]}>
                    <Text allowFontScaling={false} style={[s.chartLabel, { color: textSecondary }]}>{dayNames[i]}</Text>
                    <Text allowFontScaling={false} style={[s.chartValue, { color: textSecondary }]}>{breast + bottle + solids}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Legende */}
          <View style={s.chartLegend}>
            <View style={s.legendItem}>
              <View style={[s.legendSwatch, s.legendBreast]} />
              <Text style={[s.legendLabel, { color: textSecondary }]}>Stillen</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendSwatch, s.legendBottle]} />
              <Text style={[s.legendLabel, { color: textSecondary }]}>Fläschchen</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendSwatch, s.legendSolids]} />
              <Text style={[s.legendLabel, { color: textSecondary }]}>Beikost</Text>
            </View>
          </View>
        </LiquidGlassCard>

        {/* Wochenzusammenfassung - Design Guide konform (EXAKT wie Sleep-Tracker) */}
        <LiquidGlassCard style={s.weekSummaryCard}>
          <View style={s.summaryInner}>
            <Text style={[s.summaryTitle, { color: textSecondary }]}>Wochenzusammenfassung</Text>
            <View style={s.summaryStats}>
                <View style={s.statItem}>
                  <Text style={s.statEmoji}>🍼</Text>
                  <Text style={[s.statValue, { color: textPrimary }]}>{totalFeedings}</Text>
                  <Text style={[s.statLabel, { color: textSecondary }]}>Mahlzeiten</Text>
                </View>
                <View style={s.statItem}>
                  <Text style={s.statEmoji}>💧</Text>
                  <Text style={[s.statValue, { color: textPrimary }]}>{totalDiapers}</Text>
                  <Text style={[s.statLabel, { color: textSecondary }]}>Windeln</Text>
                </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };

  // WeekSummary Component nicht mehr benötigt - direkt in WeekView integriert

  const MonthView = () => {
    // Referenz-Monat: aktueller Monat + monthOffset (wie Sleep-Tracker)
    const refMonthDate = useMemo(() => {
      const d = new Date();
      d.setDate(1);
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

    // Erstelle Kalender-Grid - gruppiert nach Wochen (wie Sleep-Tracker)
    const getCalendarWeeks = () => {
      const weeks = [];
      const firstDayOfWeek = monthStart.getDay();
      const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

      let currentWeek = [];
      
      for (let i = 0; i < startOffset; i++) {
        currentWeek.push(null);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
        
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }

      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
      }

      return weeks;
    };

    const calendarWeeks = useMemo(() => getCalendarWeeks(), [monthStart, daysInMonth]);

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    const getEntriesForDate = (date: Date) => {
      if (!date) return [];
      const dateStr = date.toISOString().split('T')[0];
      return monthEntries.filter(entry => {
        const entryDateStr = new Date(entry.entry_date).toISOString().split('T')[0];
        return entryDateStr === dateStr;
      });
    };

    const getTotalCountForDate = (date: Date) => {
      const entries = getEntriesForDate(date);
      return entries.length;
    };

    const getDayScore = (date: Date) => {
      const entries = getEntriesForDate(date);
      const totalCount = entries.length;

      if (totalCount >= 12) return 'excellent'; // 12+ Einträge
      if (totalCount >= 8) return 'good';       // 8+ Einträge
      if (totalCount >= 4) return 'okay';       // 4+ Einträge
      return 'poor';                            // <4 Einträge
    };

    type DayScore = 'excellent' | 'good' | 'okay' | 'poor' | 'none';

    const getDayColors = (score: DayScore) => {
      if (isDark) {
        switch (score) {
          case 'excellent':
            return { bg: 'rgba(34,197,94,0.46)', text: '#FFFFFF', border: 'rgba(74,222,128,0.95)' };
          case 'good':
            return { bg: 'rgba(16,185,129,0.38)', text: '#FFFFFF', border: 'rgba(45,212,191,0.88)' };
          case 'okay':
            return { bg: 'rgba(245,158,11,0.42)', text: '#FFFFFF', border: 'rgba(251,191,36,0.95)' };
          case 'poor':
            return { bg: 'rgba(239,68,68,0.42)', text: '#FFFFFF', border: 'rgba(248,113,113,0.9)' };
          default:
            return { bg: 'rgba(255,255,255,0.08)', text: textSecondary, border: 'rgba(255,255,255,0.22)' };
        }
      }

      switch (score) {
        case 'excellent':
          return { bg: 'rgba(56,161,105,0.22)', text: '#2F855A', border: 'rgba(255,255,255,0.65)' };
        case 'good':
          return { bg: 'rgba(56,161,105,0.14)', text: '#2F855A', border: 'rgba(255,255,255,0.55)' };
        case 'okay':
          return { bg: 'rgba(245,166,35,0.18)', text: '#975A16', border: 'rgba(255,255,255,0.55)' };
        case 'poor':
          return { bg: 'rgba(229,62,62,0.18)',  text: '#9B2C2C', border: 'rgba(255,255,255,0.55)' };
        default:
          return { bg: 'rgba(255,255,255,0.10)', text: textSecondary, border: 'rgba(255,255,255,0.35)' };
      }
    };

    return (
      <View style={s.monthViewContainer}>
        {/* Monats-Navigation - exakt gleich wie Wochenübersicht */}
        <View style={s.weekNavigationContainer}>
          <TouchableOpacity style={s.weekNavButton} onPress={() => setMonthOffset(o => o - 1)}>
            <Text style={[s.weekNavButtonText, { color: textSecondary }]}>‹</Text>
          </TouchableOpacity>

          <View style={s.weekHeaderCenter}>
            <Text style={[s.weekHeaderTitle, { color: textSecondary }]}>Monatsübersicht</Text>
            <Text style={[s.weekHeaderSubtitle, { color: textSecondary }]}>
              {refMonthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.weekNavButton, monthOffset >= 0 && s.disabledNavButton]}
            disabled={monthOffset >= 0}
            onPress={() => setMonthOffset(o => o + 1)}
          >
            <Text style={[s.weekNavButtonText, { color: textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Kalender-Block mit exakt gleicher Innenbreite wie Week-Chart */}
        <LiquidGlassCard style={s.chartGlassCard}>
          <Text style={[s.chartTitle, { color: textSecondary }]}>Aktivitätskalender</Text>
          <View style={{ width: WEEK_CONTENT_WIDTH, alignSelf: 'center', paddingVertical: 16 }}>
            {/* Wochentags-Header mit exakten Spaltenbreiten */}
            <View style={s.weekdayHeader}>
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
                    <Text style={[s.weekdayLabel, { color: textSecondary }]}>{label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Tage: wochenweise, gleiche Spaltenbreiten & Gutter wie oben */}
            {calendarWeeks.map((week, weekIndex) => (
              <View key={weekIndex} style={s.calendarWeek}>
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
                        const totalCount = getTotalCountForDate(date);

                        const score = entriesCount > 0 ? getDayScore(date) : 'none';
                        const c = getDayColors(score as DayScore);
                        return (
                          <TouchableOpacity
                            style={[
                              s.calendarDayButton,
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
                          >
                            <Text style={[s.calendarDayNumber, { color: c.text }]}>{date.getDate()}</Text>
                            {totalCount > 0 && (
                              <Text style={[s.calendarDayHours, { color: c.text }]}>
                                {totalCount}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })() : (
                        <View style={s.calendarDayEmpty} />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </LiquidGlassCard>

        {/* Monatsstatistiken - Design Guide konform */}
        <LiquidGlassCard style={s.monthSummaryCard}>
          <View style={s.summaryInner}>
            <Text style={[s.summaryTitle, { color: textSecondary }]}>Monatsübersicht</Text>
            <View style={s.summaryStats}>
              <View style={s.statItem}>
                <Text style={s.statEmoji}>🍼</Text>
                <Text style={[s.statValue, { color: textPrimary }]}>{monthEntries.filter((e: any) => e.entry_type === 'feeding' && e.feeding_type !== 'PUMP' && e.feeding_type !== 'WATER').length}</Text>
                <Text style={[s.statLabel, { color: textSecondary }]}>Mahlzeiten</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statEmoji}>💧</Text>
                <Text style={[s.statValue, { color: textPrimary }]}>{monthEntries.filter(e => e.entry_type === 'diaper').length}</Text>
                <Text style={[s.statLabel, { color: textSecondary }]}>Windeln</Text>
              </View>
            </View>
          </View>
        </LiquidGlassCard>

      </View>
    );
  };

  const KPISection = () => {
    const currentEntries = selectedTab === 'week' ? weekEntries : entries;
    const feedingOverview = buildFeedingOverview(currentEntries as any[]);
    const diaperEntries = currentEntries.filter((e) => e.entry_type === 'diaper');

    const hasBottleFeedings = feedingOverview.bottleCount > 0;
    const hasBreastFeedings = feedingOverview.breastCount > 0;
    const hasSolidFeedings = feedingOverview.solidsCount > 0;
    const hasPumpEntries = feedingOverview.pumpCount > 0;
    const hasWaterEntries = feedingOverview.waterCount > 0;

    let feedingStatValue = `${feedingOverview.totalBottleMl}`;
    let feedingStatUnit: 'ml' | 'times' = 'ml';
    let feedingPrimaryDetail = 'Keine Mahlzeit heute';
    let feedingSecondaryDetail: string | null = null;

    if (feedingOverview.totalFeedingCount > 0) {
      if (hasBottleFeedings) {
        feedingPrimaryDetail = `Flasche ${feedingOverview.bottleCount}×`;
        feedingSecondaryDetail = [
          hasBreastFeedings ? `Stillen ${feedingOverview.breastCount}×` : null,
          hasSolidFeedings ? `Beikost ${feedingOverview.solidsCount}×` : null,
          hasPumpEntries ? `Abpumpen ${feedingOverview.pumpCount}×` : null,
          hasWaterEntries ? `Wasser ${feedingOverview.waterCount}×` : null,
        ]
          .filter(Boolean)
          .join(' • ') || null;
      } else if (hasBreastFeedings || hasSolidFeedings) {
        const useBreastAsPrimary =
          hasBreastFeedings && (!hasSolidFeedings || feedingOverview.breastCount >= feedingOverview.solidsCount);

        feedingStatUnit = 'times';
        if (useBreastAsPrimary) {
          feedingStatValue = `${feedingOverview.breastCount}`;
          feedingPrimaryDetail = 'Stillen';
          feedingSecondaryDetail = [
            hasSolidFeedings ? `Beikost ${feedingOverview.solidsCount}×` : null,
            hasPumpEntries ? `Abpumpen ${feedingOverview.pumpCount}×` : null,
            hasWaterEntries ? `Wasser ${feedingOverview.waterCount}×` : null,
          ]
            .filter(Boolean)
            .join(' • ') || null;
        } else {
          feedingStatValue = `${feedingOverview.solidsCount}`;
          feedingPrimaryDetail = 'Beikost';
          feedingSecondaryDetail = [
            hasBreastFeedings ? `Stillen ${feedingOverview.breastCount}×` : null,
            hasPumpEntries ? `Abpumpen ${feedingOverview.pumpCount}×` : null,
            hasWaterEntries ? `Wasser ${feedingOverview.waterCount}×` : null,
          ]
            .filter(Boolean)
            .join(' • ') || null;
        }
      }
    } else if (hasPumpEntries || hasWaterEntries) {
      feedingSecondaryDetail = [
        hasPumpEntries ? `Abpumpen ${feedingOverview.pumpCount}×` : null,
        hasWaterEntries ? `Wasser ${feedingOverview.waterCount}×` : null,
      ]
        .filter(Boolean)
        .join(' • ') || null;
    }

    const lastDiaperEntry = diaperEntries
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0];

    const lastDiaperTime = lastDiaperEntry
      ? new Date(lastDiaperEntry.entry_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : 'Nie';

    return (
      <View style={s.kpiRow}>
        <TouchableOpacity
          style={s.kpiCardShell}
          activeOpacity={0.92}
          onPress={() => setShowFeedingOverviewModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Mahlzeitenübersicht öffnen"
        >
          <GlassCard
            style={[s.kpiCard, s.kpiCardInteractive]}
            intensity={24}
            overlayColor="rgba(94, 61, 179, 0.13)"
            borderColor="rgba(94, 61, 179, 0.35)"
          >
            <View style={[s.kpiHeaderRow, s.kpiHeaderRowSpaced]}>
              <View style={s.kpiHeaderCopy}>
                <Text style={s.kpiEmoji}>🍼</Text>
                <Text style={[s.kpiTitle, { color: textSecondary }]}>Mahlzeiten</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={textSecondary} />
            </View>
            <Text style={[s.kpiValue, s.kpiValueCentered, { color: textPrimary }]}>
              {feedingStatValue}
              <Text style={s.kpiMlUnit}>{feedingStatUnit === 'ml' ? ' ml' : '×'}</Text>
            </Text>
            <Text numberOfLines={2} ellipsizeMode="tail" style={[s.kpiSub, s.kpiSubPrimary, { color: textSecondary }]}>
              {feedingPrimaryDetail}
            </Text>
            {feedingSecondaryDetail ? (
              <Text numberOfLines={2} ellipsizeMode="tail" style={[s.kpiSub, s.kpiSubSecondary, { color: textSecondary }]}>
                {feedingSecondaryDetail}
              </Text>
            ) : (
              <Text numberOfLines={1} ellipsizeMode="tail" style={[s.kpiSub, s.kpiSubSecondary, { color: textSecondary }]}>
                Tippe für die Übersicht
              </Text>
            )}
          </GlassCard>
        </TouchableOpacity>

        <View style={s.kpiCardShell}>
          <GlassCard
            style={s.kpiCard}
            intensity={24}
            overlayColor="rgba(94, 61, 179, 0.08)"
            borderColor="rgba(94, 61, 179, 0.22)"
          >
            <View style={s.kpiHeaderRow}>
              <View style={s.kpiHeaderCopy}>
                <Text style={s.kpiEmoji}>🧷</Text>
                <Text style={[s.kpiTitle, { color: textSecondary }]}>Wickeln</Text>
              </View>
            </View>
            <Text style={[s.kpiValue, s.kpiValueCentered, { color: textPrimary }]}>{diaperEntries.length}</Text>
            <Text style={[s.kpiSub, { color: textSecondary }]}>Letzter: {lastDiaperTime}</Text>
          </GlassCard>
        </View>
      </View>
    );
  };

  const headerSubtitle = isReadOnlyPreviewMode
    ? 'Vorschau-Modus: nur ansehen'
    : 'Euer Tag – voller kleiner Meilensteine ✨';

  return (
    <ThemedBackground style={s.backgroundImage}>
      <SafeAreaView style={s.container}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header
          title="Unser Tag"
          subtitle={headerSubtitle}
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />

        <ConnectionStatus showAlways={false} autoCheck={true} onRetry={loadEntries} />

        {isReadOnlyPreviewMode && (
          <View style={s.readOnlyPreviewBanner}>
            <Text style={s.readOnlyPreviewTitle}>Nur Vorschau aktiv</Text>
            <Text style={s.readOnlyPreviewText}>
              Du schaust den Babymodus an. Eintraege, Timer und Bearbeitung sind gesperrt.
            </Text>
          </View>
        )}

        <TimerBanner
          timer={activeTimer}
          onStop={handleTimerStop}
          disabled={isReadOnlyPreviewMode}
          onCancel={async () => {
            if (!ensureWritableInCurrentMode()) return;
            if (!activeTimer) return;
            Alert.alert('Timer abbrechen', 'Willst du den laufenden Eintrag wirklich verwerfen?', [
              { text: 'Nein', style: 'cancel' },
              {
                text: 'Ja, verwerfen',
                style: 'destructive',
                onPress: async () => {
                  const timerToCancel = activeTimer;
                  const { error } = await deleteBabyCareEntry(timerToCancel.id, activeBabyId ?? undefined);
                  if (!error) {
                    await endBreastfeedingLiveActivity(timerToCancel);
                    setActiveTimer(null);
                    loadEntries();
                  }
                },
              },
            ]);
          }}
        />

        <ScrollView
          style={s.scrollContainer}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <TopTabs />

          {selectedTab === 'week' ? (
            <WeekView />
          ) : selectedTab === 'month' ? (
            <MonthView />
          ) : (
            <View style={s.content}>
              {/* Day Navigation - gleich wie Sleep-Tracker */}
              <View style={s.weekNavigationContainer}>
                <TouchableOpacity
                  style={s.weekNavButton}
                  onPress={() => changeRelativeDate(-1)}
                >
                  <Text style={[s.weekNavButtonText, { color: textSecondary }]}>‹</Text>
                </TouchableOpacity>
                <View style={s.weekHeaderCenter}>
                  <Text style={[s.weekHeaderTitle, { color: textSecondary }]}>Tagesansicht</Text>
                  <Text style={[s.weekHeaderSubtitle, { color: textSecondary }]}>
                    {selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.weekNavButton, new Date(selectedDate).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0) && s.disabledNavButton]}
                  disabled={new Date(selectedDate).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0)}
                  onPress={() => changeRelativeDate(1)}
                >
                  <Text style={[s.weekNavButtonText, { color: textSecondary }]}>›</Text>
                </TouchableOpacity>
              </View>

              <QuickActionRow
                onPressAction={handleQuickActionPress}
                onHideAction={handleHideQuickAction}
                onRestoreAction={handleRestoreQuickAction}
                onReorderActions={handleReorderQuickActions}
                hiddenActions={hiddenQuickActions}
                actionOrder={quickActionOrder}
                disabled={isReadOnlyPreviewMode}
              />

              {showVitaminDStrip && (
                <GlassCard
                  style={s.vitaminDStrip}
                  intensity={22}
                  overlayColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.28)'}
                  borderColor={isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.58)'}
                >
                  <View style={s.vitaminDStripInner}>
                    <View
                      style={[
                        s.vitaminDLeadIcon,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.28)',
                          borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.58)',
                        },
                      ]}
                    >
                      <IconSymbol name="checklist" size={15} color={textPrimary} />
                    </View>

                    <View style={s.vitaminDStripCopy}>
                      <Text style={[s.vitaminDTitle, { color: textPrimary }]}>Vitamin D</Text>
                      <View style={s.vitaminDSignalsRow}>
                        <View style={s.vitaminDSignal}>
                          <View
                            style={[
                              s.vitaminDSignalDot,
                              {
                                backgroundColor: isVitaminDCompleted
                                  ? textPrimary
                                  : isDark
                                  ? 'rgba(255,255,255,0.22)'
                                  : 'rgba(125,90,80,0.28)',
                              },
                            ]}
                          />
                          <Text style={[s.vitaminDSignalText, { color: textSecondary }]}>
                            {isSelectedDateToday
                              ? isVitaminDCompleted
                                ? 'Heute erledigt'
                                : 'Heute offen'
                              : isVitaminDCompleted
                              ? 'Tag erledigt'
                              : 'Tag offen'}
                          </Text>
                        </View>

                      </View>
                    </View>

                    <View style={s.vitaminDControlRow}>
                      <TouchableOpacity
                        style={[
                          s.vitaminDIconButton,
                          isVitaminDCompleted && s.vitaminDIconButtonActive,
                          (vitaminDBusy || isReadOnlyPreviewMode) && s.actionDisabled,
                        ]}
                        activeOpacity={0.85}
                        onPress={handleToggleVitaminDCompletion}
                        disabled={vitaminDBusy}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isVitaminDCompleted
                            ? 'Vitamin-D-Eintrag zurücksetzen'
                            : 'Vitamin D als gegeben markieren'
                        }
                      >
                        <Text
                          style={[
                            s.vitaminDIconButtonMark,
                            { color: isVitaminDCompleted ? '#ffffff' : textPrimary },
                          ]}
                        >
                          {isVitaminDCompleted ? '✓' : '+'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlassCard>
              )}

              <Text style={[s.sectionTitle, { color: textSecondary }]}>Kennzahlen</Text>
              <KPISection />

              <View style={s.recipeButtonSection}>
                <TouchableOpacity
                  style={s.recipeButton}
                  activeOpacity={0.88}
                  onPress={() => router.push('/recipe-generator')}
                >
                  <IconSymbol name="fork.knife.circle.fill" size={22} color={textPrimary} />
                  <Text style={[s.recipeText, { color: textPrimary }]}>BLW-Rezepte entdecken</Text>
                </TouchableOpacity>
              </View>

              <View style={s.timelineSection}>
                <Text style={[s.sectionTitle, { color: textSecondary }]}>Timeline</Text>

                <View style={s.entriesSection}>
                  {showVitaminDTimelinePoint && (
                    <View style={s.vitaminDTimelineItem}>
                      <View style={s.vitaminDTimelineRail}>
                        <View
                          style={[
                            s.vitaminDTimelineDot,
                            {
                              backgroundColor: isVitaminDCompleted
                                ? vitaminDCompleteColor
                                : isDark
                                ? 'rgba(255,255,255,0.26)'
                                : 'rgba(125,90,80,0.28)',
                            },
                          ]}
                        />
                        {entries.length > 0 && (
                          <View
                            style={[
                              s.vitaminDTimelineStem,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.14)'
                                  : 'rgba(125,90,80,0.14)',
                              },
                            ]}
                          />
                        )}
                      </View>

                      <GlassCard
                        style={s.vitaminDTimelineChip}
                        intensity={18}
                        overlayColor={
                          isVitaminDCompleted
                            ? vitaminDCompleteSoft
                            : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.22)'
                        }
                        borderColor={
                          isVitaminDCompleted
                            ? vitaminDCompleteBorder
                            : isDark
                            ? 'rgba(255,255,255,0.14)'
                            : 'rgba(255,255,255,0.5)'
                        }
                      >
                        <View style={s.vitaminDTimelineChipInner}>
                          <Text
                            style={[
                              s.vitaminDTimelineText,
                              {
                                color: isVitaminDCompleted
                                  ? vitaminDCompleteColor
                                  : textPrimary,
                              },
                            ]}
                          >
                            {isSelectedDateToday
                              ? isVitaminDCompleted
                                ? 'Vitamin D gegeben'
                                : 'Vitamin D noch offen'
                              : isVitaminDCompleted
                              ? 'Vitamin D dokumentiert'
                              : 'Vitamin D offen'}
                          </Text>

                          <View style={s.vitaminDTimelineActions}>
                            <TouchableOpacity
                              style={[
                                s.vitaminDTimelineIconButton,
                                isVitaminDCompleted
                                  ? {
                                      borderColor: vitaminDCompleteBorder,
                                      backgroundColor: vitaminDCompleteSoft,
                                    }
                                  : null,
                                (vitaminDBusy || isReadOnlyPreviewMode) && s.actionDisabled,
                              ]}
                              activeOpacity={0.85}
                              onPress={handleToggleVitaminDCompletion}
                              disabled={vitaminDBusy}
                              accessibilityRole="button"
                              accessibilityLabel="Vitamin-D-Eintrag zurücksetzen"
                            >
                              <Text
                                style={[
                                  s.vitaminDIconButtonMark,
                                  {
                                    color: isVitaminDCompleted
                                      ? vitaminDCompleteColor
                                      : textPrimary,
                                  },
                                ]}
                              >
                                {isVitaminDCompleted ? '✓' : '+'}
                              </Text>
                            </TouchableOpacity>

                          </View>
                        </View>
                      </GlassCard>
                    </View>
                  )}

                  {entries.map((item) => (
                    <ActivityCard
                      key={item.id ?? Math.random().toString()}
                      entry={item}
                      auxiliaryBadgeLabel={item.id ? bottleGapLabelByEntryId.get(item.id) ?? null : null}
                      onDelete={handleDeleteEntry}
                      onEdit={(entry) => {
                        if (!ensureWritableInCurrentMode()) return;
                        setEditingEntry(entry);
                        if (entry.entry_type === 'feeding') setSelectedActivityType('feeding');
                        else if (entry.entry_type === 'diaper') setSelectedActivityType('diaper');
                        setSelectedSubType((entry as any).sub_type ?? null);
                        setShowInputModal(true);
                      }}
                      marginHorizontal={8}
                    />
                  ))}
                  {entries.length === 0 && !showVitaminDTimelinePoint && (
                    <EmptyState type="day" message="Tippe auf ein Symbol um einen Eintrag zu erstellen" />
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* FAB entfernt wie gewünscht */}

        <Modal
          visible={showFeedingOverviewModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFeedingOverviewModal(false)}
        >
          <View
            style={[
              s.feedingOverviewOverlay,
              { backgroundColor: isDark ? 'rgba(7, 10, 15, 0.68)' : 'rgba(32, 24, 20, 0.30)' },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setShowFeedingOverviewModal(false)}
            />

            <BlurView
              style={[
                s.feedingOverviewSheet,
                {
                  backgroundColor: isDark ? 'rgba(18, 18, 24, 0.78)' : 'rgba(255, 250, 244, 0.82)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.60)',
                },
              ]}
              tint={isDark ? 'dark' : 'extraLight'}
              intensity={80}
            >
              <View style={s.feedingOverviewHandle} />

              <View style={s.feedingOverviewHeader}>
                <View style={s.feedingOverviewHeaderCopy}>
                  <Text style={[s.feedingOverviewTitle, { color: textPrimary }]}>Mahlzeiten im Überblick</Text>
                  <Text style={[s.feedingOverviewSubtitle, { color: textSecondary }]}>
                    {selectedDate.toLocaleDateString('de-DE', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    s.feedingOverviewCloseButton,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)',
                    },
                  ]}
                  activeOpacity={0.88}
                  onPress={() => setShowFeedingOverviewModal(false)}
                >
                  <IconSymbol name="xmark" size={16} color={textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.feedingOverviewScrollContent}
              >
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(79, 69, 160, 0.92)', 'rgba(35, 105, 143, 0.88)']
                      : ['rgba(112, 90, 201, 0.96)', 'rgba(70, 151, 210, 0.92)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.feedingOverviewHero}
                >
                  <View style={s.feedingOverviewHeroTop}>
                    <Text style={s.feedingOverviewHeroEyebrow}>HEUTE ERFASST</Text>
                    <Text style={s.feedingOverviewHeroValue}>{feedingOverviewEntryCount}</Text>
                    <Text style={s.feedingOverviewHeroLabel}>
                      {feedingOverviewEntryCount === 1 ? 'Eintrag rund um Mahlzeiten' : 'Einträge rund um Mahlzeiten'}
                    </Text>
                    <Text style={s.feedingOverviewHeroSubLabel}>
                      {feedingOverviewLatestTime
                        ? `Letzte Aktivität um ${formatClockTime(feedingOverviewLatestTime)} Uhr`
                        : 'Noch keine Mahlzeit an diesem Tag dokumentiert'}
                    </Text>
                  </View>

                  <View style={s.feedingOverviewHeroChipRow}>
                    {feedingOverviewHighlights.length > 0 ? (
                      feedingOverviewHighlights.map((highlight) => (
                        <View key={highlight} style={s.feedingOverviewHeroChip}>
                          <Text style={s.feedingOverviewHeroChipText}>{highlight}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={s.feedingOverviewHeroHintCard}>
                        <Text style={s.feedingOverviewHeroHintText}>
                          Schnell sehen, was gegessen, getrunken oder abgepumpt wurde.
                        </Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>

                <View style={s.feedingOverviewGrid}>
                  {feedingOverviewCards.map((card, index) => (
                    <GlassCard
                      key={card.key}
                      style={[
                        s.feedingOverviewCard,
                        index === feedingOverviewCards.length - 1 && feedingOverviewCards.length % 2 === 1
                          ? s.feedingOverviewCardFull
                          : null,
                      ]}
                      intensity={18}
                      overlayColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.34)'}
                      borderColor={isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.62)'}
                    >
                      <View
                        style={[
                          s.feedingOverviewCardAccent,
                          { backgroundColor: card.accentSoft, borderColor: `${card.accent}55` },
                        ]}
                      >
                        <Text style={s.feedingOverviewCardAccentEmoji}>{card.icon}</Text>
                      </View>

                      <Text style={[s.feedingOverviewCardTitle, { color: textPrimary }]}>{card.label}</Text>
                      <Text style={[s.feedingOverviewCardCount, { color: textPrimary }]}>{card.count}×</Text>
                      <Text style={[s.feedingOverviewCardMetric, { color: textSecondary }]}>{card.metric}</Text>
                      <Text style={[s.feedingOverviewCardSecondary, { color: textSecondary }]}>{card.secondary}</Text>
                    </GlassCard>
                  ))}
                </View>
              </ScrollView>
            </BlurView>
          </View>
        </Modal>

        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          initialSubType={selectedSubType}
          hiddenSubTypes={hiddenQuickActions}
          forceDarkMode={isDark}
          date={selectedDate}
          onClose={() => { setShowInputModal(false); setEditingEntry(null); }}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
          initialData={editingEntry && editingEntry.id ? {
            id: editingEntry.id!,
            feeding_type: (editingEntry as any).feeding_type as any,
            feeding_volume_ml: (editingEntry as any).feeding_volume_ml ?? null,
            feeding_side: (editingEntry as any).feeding_side as any,
            diaper_type: (editingEntry as any).diaper_type as any,
            diaper_fever_measured: (editingEntry as any).diaper_fever_measured ?? null,
            diaper_temperature_c: (editingEntry as any).diaper_temperature_c ?? null,
            diaper_suppository_given: (editingEntry as any).diaper_suppository_given ?? null,
            diaper_suppository_dose_mg: (editingEntry as any).diaper_suppository_dose_mg ?? null,
            notes: editingEntry.notes ?? null,
            start_time: editingEntry.start_time!,
            end_time: editingEntry.end_time ?? null,
          } : (selectedSubType ? {
            // Preselect fields from quick actions
            feeding_type: selectedSubType === 'feeding_breast' ? 'BREAST' : selectedSubType === 'feeding_bottle' ? 'BOTTLE' : selectedSubType === 'feeding_solids' ? 'SOLIDS' : selectedSubType === 'feeding_pump' ? 'PUMP' : selectedSubType === 'feeding_water' ? 'WATER' : undefined,
            feeding_volume_ml: selectedSubType === 'feeding_bottle' || selectedSubType === 'feeding_pump' ? lastBottleVolumeMl : selectedSubType === 'feeding_water' ? 120 : null,
            diaper_type: selectedSubType === 'diaper_wet' ? 'WET' : selectedSubType === 'diaper_dirty' ? 'DIRTY' : selectedSubType === 'diaper_both' ? 'BOTH' : undefined,
            start_time: new Date().toISOString(),
          } : undefined)}
        />
      </SafeAreaView>
      {splashVisible && (
        <Animated.View
          style={[s.splashOverlay, { opacity: splashAnim }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[splashBg, splashBg]}
            style={StyleSheet.absoluteFillObject as any}
          />
          <View style={s.splashCenterCard}>
            <Animated.View style={[s.splashEmojiRing, { transform: [{ scale: splashEmojiAnim }] }]}>
              {splashEmojiParts.length <= 1 ? (
                <Text style={s.splashEmoji} allowFontScaling={false}>{splashEmoji}</Text>
              ) : (
                <View style={s.splashEmojiRow}>
                  {splashEmojiParts.map((emoji, index) => (
                    <Text key={`${emoji}-${index}`} style={s.splashEmojiMulti} allowFontScaling={false}>
                      {emoji}
                    </Text>
                  ))}
                </View>
              )}
            </Animated.View>
            {splashTitle ? <Text style={s.splashTitle}>{splashTitle}</Text> : null}
            {splashSubtitle ? <Text style={s.splashSubtitle}>{splashSubtitle}</Text> : null}
            {splashStatus ? <Text style={s.splashStatus}>{splashStatus}</Text> : null}
            {splashHint ? (
              <View style={s.splashHintCard}>
                <Text style={s.splashHintText}>
                  <Text style={s.splashHintEmoji} allowFontScaling={false}>♡</Text>
                  {'  '}
                  {splashHint}
                  {splashHintEmoji ? (
                    <Text style={s.splashHintEmoji} allowFontScaling={false}> {splashHintEmoji}</Text>
                  ) : null}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      )}
    </ThemedBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', backgroundColor: '#f5eee0' },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  content: { paddingHorizontal: LAYOUT_PAD },
  actionDisabled: {
    opacity: 0.45,
  },
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

  sectionTitle: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
  },
  vitaminDStrip: {
    marginTop: SECTION_GAP_TOP,
    borderRadius: 18,
    overflow: 'hidden',
  },
  vitaminDStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 15,
  },
  vitaminDLeadIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitaminDStripCopy: {
    flex: 1,
    paddingLeft: 2,
    paddingRight: 8,
  },
  vitaminDSignalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  vitaminDSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vitaminDTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY,
  },
  vitaminDSignalDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  vitaminDSignalText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vitaminDControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 4,
  },
  vitaminDIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitaminDIconButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  vitaminDIconButtonSoftActive: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderColor: 'rgba(255,255,255,0.78)',
  },
  vitaminDIconButtonMark: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: -1,
  },
  vitaminDTimelineItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
    paddingHorizontal: 8,
  },
  vitaminDTimelineRail: {
    width: 12,
    alignItems: 'center',
    paddingTop: 10,
  },
  vitaminDTimelineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  vitaminDTimelineStem: {
    width: 1,
    flex: 1,
    marginTop: 5,
  },
  vitaminDTimelineChip: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  vitaminDTimelineChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  vitaminDTimelineText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  vitaminDTimelineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vitaminDTimelineIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  recipeButtonSection: {
    marginTop: SECTION_GAP_TOP,
  },
  recipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  recipeText: {
    marginLeft: 8,
    fontWeight: '600',
    color: PRIMARY,
    fontSize: 15,
  },

  // Glass base
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

  // Date spider
  dateSpiderWrap: { paddingHorizontal: 14 },
  dateSpiderCard: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16 },
  dateSpiderText: { fontSize: 14, fontWeight: '700', color: PRIMARY, textAlign: 'center' },

  // Timer Banner
  timerBanner: {
    marginHorizontal: LAYOUT_PAD,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerType: { fontSize: 14, fontWeight: '700' },
  timerTime: { fontSize: 22, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  timerStopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 6,
  },
  timerCancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 6,
    marginRight: 6,
  },

  // Tabs (glass pills)
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

  // Quick actions as round glass buttons
  quickActionSection: { marginTop: SECTION_GAP_TOP },
  quickScrollContainer: { paddingHorizontal: 4, paddingTop: 2 },
  quickDragList: {
    overflow: 'visible',
  },
  quickActionEditBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  quickActionDoneButton: {
    minWidth: 84,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  quickActionDoneText: {
    fontSize: 14,
    fontWeight: '800',
  },
  circleButtonWrap: {
    width: 100,
    height: 100,
    paddingTop: 4,
    paddingLeft: 4,
    overflow: 'visible',
  },
  quickActionFooterWrap: {
    marginLeft: 16,
  },
  circleButton: {
    width: 96,
    height: 96,
    borderRadius: 48, // fully round
    borderWidth: 1,
    overflow: 'hidden',
  },
  circleButtonRestore: {
    justifyContent: 'center',
  },
  circleInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  circleEmoji: { fontSize: 26 },
  circleLabel: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#7D5A50' },
  quickActionHideBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E25555',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  quickActionHideBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: -1,
  },
  quickActionPlusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionPlusBadgeText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '800',
  },
  quickActionPlusLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickActionPlusMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // KPI glass cards
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  kpiCardShell: {
    width: '48%',
  },
  kpiCard: {
    width: '100%',
    minHeight: 154,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  kpiCardInteractive: {},
  kpiHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kpiHeaderRowSpaced: { justifyContent: 'space-between' },
  kpiHeaderCopy: { flexDirection: 'row', alignItems: 'center' },
  kpiEmoji: { fontSize: 14, marginRight: 6 },
  kpiTitle: { fontSize: 14, fontWeight: '700', color: '#7D5A50' },
  kpiValue: { fontSize: 34, fontWeight: '800', color: PRIMARY, fontVariant: ['tabular-nums'] },
  kpiValueCentered: { textAlign: 'center', width: '100%' },
  kpiMlUnit: { fontSize: 18, fontWeight: '700' },
  kpiSub: { marginTop: 6, fontSize: 12, color: '#7D5A50', textAlign: 'center' },
  kpiSubPrimary: { textAlign: 'center', fontWeight: '700', width: '100%', maxWidth: '100%' },
  kpiSubSecondary: { marginTop: 2, fontSize: 11, textAlign: 'center', width: '100%', maxWidth: '100%' },

  feedingOverviewOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  feedingOverviewSheet: {
    width: '100%',
    maxHeight: '82%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
  },
  feedingOverviewHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 16,
  },
  feedingOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  feedingOverviewHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  feedingOverviewTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  feedingOverviewSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  feedingOverviewCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedingOverviewScrollContent: {
    paddingBottom: 8,
  },
  feedingOverviewHero: {
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
  },
  feedingOverviewHeroTop: {
    alignItems: 'center',
  },
  feedingOverviewHeroEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  feedingOverviewHeroValue: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  feedingOverviewHeroLabel: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedingOverviewHeroSubLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  feedingOverviewHeroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  feedingOverviewHeroChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  feedingOverviewHeroChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  feedingOverviewHeroHintCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedingOverviewHeroHintText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  feedingOverviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  feedingOverviewCard: {
    width: '48%',
    minHeight: 166,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  feedingOverviewCardFull: {
    width: '100%',
    minHeight: 150,
  },
  feedingOverviewCardAccent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  feedingOverviewCardAccentEmoji: {
    fontSize: 20,
  },
  feedingOverviewCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  feedingOverviewCardCount: {
    marginTop: 8,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  feedingOverviewCardMetric: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  feedingOverviewCardSecondary: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },

  // Liquid Glass Base Styles (exakt wie Sleep-Tracker)
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
    shadowRadius: 4,
    elevation: 4,
  },
  liquidGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Timeline Section (exakt wie Sleep-Tracker)
  timelineSection: {
    paddingHorizontal: 0, // Gleiche Breite wie Sleep-Tracker
  },

  // Entries Container (exakt wie Sleep-Tracker)
  entriesSection: {
    gap: 16,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },

  // Week View Styles
  weekViewContainer: {
    paddingHorizontal: LAYOUT_PAD,
  },
  weekNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
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
    padding: 6,
  },
  disabledNavButton: {
    opacity: 0.35,
  },
  weekNavButtonText: {
    fontSize: 24,
    color: PRIMARY,
    fontWeight: 'bold',
  },
  weekHeaderCenter: {
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
  weekHeaderSubtitle: {
    fontSize: 12,
    color: '#7D5A50',
  },
  weekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  weekDayCard: {
    flex: 1,
    marginHorizontal: 2,
  },
  todayCard: {
    // Additional styling for today's card
  },
  selectedDayCard: {
    // Additional styling for selected day card
  },
  weekDayInner: {
    padding: 12,
    alignItems: 'center',
    minHeight: 80,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 8,
  },
  selectedDayText: {
    color: '#5E3DB3',
  },
  dayStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(94, 61, 179, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginHorizontal: 1,
  },
  statBadgeEmoji: {
    fontSize: 10,
    marginRight: 2,
  },
  statCount: {
    fontSize: 10,
    fontWeight: '600',
    color: PRIMARY,
    fontVariant: ['tabular-nums'],
  },
  weekSummaryContainer: {
    marginBottom: 20,
  },
  weekEntriesContainer: {
    gap: 16,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  // Week chart styles (EXAKT wie Sleep-Tracker)
  chartGlassCard: {
    padding: 0,
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
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
  chartBarContainer: {
    height: MAX_BAR_H,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  chartBar: {
    width: Math.max(10, Math.round(WEEK_COL_WIDTH * 0.66)), // kräftiger und proportional
    borderRadius: 6,
    marginTop: 2,
    minHeight: 3,
  },
  chartBarTotal: { backgroundColor: '#8E4EC6' }, // Lila für Gesamtschlaf
  chartBarDiaper: { backgroundColor: '#38A169' }, // Grün für Windeln
  chartBarBreast: { backgroundColor: '#8E4EC6' }, // Lila für Stillen
  chartBarBottle: { backgroundColor: '#4A90E2' }, // Blau für Fläschchen
  chartBarSolids: { backgroundColor: '#F5A623' }, // Orange für Beikost
  chartBarPump: { backgroundColor: '#35B6B4' }, // Türkis für Abpumpen
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
    width: WEEK_COL_WIDTH,           // fix = kein Umbruch/Abschnitt
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { fontSize: 12, color: '#7D5A50', fontWeight: '600' },
  legendBreast: { backgroundColor: '#8E4EC6' }, // Lila für Stillen
  legendBottle: { backgroundColor: '#4A90E2' }, // Blau für Fläschchen
  legendSolids: { backgroundColor: '#F5A623' }, // Orange für Beikost
  legendPump: { backgroundColor: '#35B6B4' }, // Türkis für Abpumpen
  daySection: {
    marginBottom: 20,
  },
  daySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5E3DB3',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  // Summary Cards (Design Guide konform - EXAKT wie Sleep-Tracker)
  weekSummaryCard: {
    padding: 0,
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
  },
  summaryInner: {
    width: WEEK_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
    flex: 1,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 13,
    color: '#7D5A50',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Month View Styles (EXAKT wie Sleep-Tracker)
  monthViewContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  monthNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
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
  monthNavButtonText: {
    fontSize: 24,
    color: PRIMARY,
    fontWeight: 'bold',
  },
  monthHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  monthHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 4,
  },
  monthSummaryCard: {
    padding: 0,
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 16,
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
    borderWidth: 1.25,
  },
  calendarDayEmpty: {
    aspectRatio: 1,
    width: '100%',
  },
  calendarDayNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarDayHours: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
    opacity: 0.9,
    fontVariant: ['tabular-nums'],
  },
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
    color: '#fff',
    includeFontPadding: false,
  },
  splashEmojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashEmojiMulti: {
    fontSize: 56,
    color: '#fff',
    includeFontPadding: false,
    marginHorizontal: 2,
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
  splashHintEmoji: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  splashEmojiRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'visible',
  },
});
