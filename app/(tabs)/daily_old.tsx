import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';

import { DailyEntry } from '@/lib/baby';
import {
  addBabyCareEntry,
  getBabyCareEntriesForDate,
  getBabyCareEntriesForDateRange,
  getBabyCareEntriesForMonth,
  deleteBabyCareEntry,
  stopBabyCareEntryTimer,
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

// Removed old managers; using unified baby_care_entries
import { SupabaseErrorHandler } from '@/lib/errorHandler';
import { ConnectionStatus } from '@/components/ConnectionStatus';

import { BlurView } from 'expo-blur';
import { GlassCard, LiquidGlassCard, LAYOUT_PAD, SECTION_GAP_TOP, SECTION_GAP_BOTTOM, PRIMARY, GLASS_OVERLAY, GLASS_BORDER } from '@/constants/DesignGuide';
import { useNotifications } from '@/hooks/useNotifications';
import { usePartnerNotifications } from '@/hooks/usePartnerNotifications';
import { buildFeedingOverview } from '@/lib/feedingOverview';

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

type QuickActionType =
  | 'feeding_breast'
  | 'feeding_bottle'
  | 'feeding_solids'
  | 'diaper_wet'
  | 'diaper_dirty'
  | 'diaper_both';

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
}> = ({ timer, onStop, onCancel }) => {
  // Adaptive Farben für Dark Mode
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - timer.start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [timer]);
  if (!timer) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerLabel =
    timer.type === 'BREAST'
      ? '🤱 Stillen'
      : timer.type === 'BOTTLE'
      ? '🍼 Fläschchen'
      : timer.type === 'SOLIDS'
      ? '🥄 Beikost'
      : '🧷 Wickeln';

  return (
    <GlassCard style={[s.timerBanner, { paddingVertical: 12, paddingHorizontal: 16 }]} intensity={28}>
      <View style={{ flex: 1 }}>
        <Text style={[s.timerType, { color: textPrimary }]}>
          {timerLabel} • läuft seit {new Date(timer.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={[s.timerTime, { color: textSecondary }]}>{formatTime(elapsed)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity style={s.timerCancelButton} onPress={onCancel}>
          <IconSymbol name="xmark.circle" size={26} color={isDark ? '#888888' : '#a3a3a3'} />
        </TouchableOpacity>
        <TouchableOpacity style={s.timerStopButton} onPress={onStop}>
          <IconSymbol name="stop.circle.fill" size={28} color={textPrimary} />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
};

const quickBtns: { icon: string; label: string; action: QuickActionType }[] = [
  { action: 'feeding_breast', label: 'Stillen', icon: '🤱' },
  { action: 'feeding_bottle', label: 'Fläschchen', icon: '🍼' },
  { action: 'feeding_solids', label: 'Beikost', icon: '🥄' },
  { action: 'diaper_wet', label: 'Nass', icon: '💧' },
  { action: 'diaper_dirty', label: 'Voll', icon: '💩' },
  { action: 'diaper_both', label: 'Beides', icon: '💧💩' },
];

const QuickActionRow: React.FC<{ onPressAction: (action: QuickActionType) => void }> = ({ onPressAction }) => {
  // Adaptive Farben für Dark Mode
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';

  const itemWidth = 96 + 16; // Button width + separator

  const renderQuickButton = ({ item }: { item: (typeof quickBtns)[number] }) => (
    <GlassCard
      style={s.circleButton}
      intensity={30}
      overlayColor="rgba(255,255,255,0.32)"
      borderColor="rgba(255,255,255,0.70)"
    >
      <TouchableOpacity style={s.circleInner} onPress={() => onPressAction(item.action)} activeOpacity={0.9}>
        <Text style={s.circleEmoji}>{item.icon}</Text>
        <Text style={[s.circleLabel, { color: textSecondary }]}>{item.label}</Text>
      </TouchableOpacity>
    </GlassCard>
  );

  return (
    <View style={s.quickActionSection}>
      <FlatList
        data={quickBtns}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={renderQuickButton}
        keyExtractor={(item) => item.action}
        contentContainerStyle={s.quickScrollContainer}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
        decelerationRate="normal"
        getItemLayout={(_, index) => ({
          length: itemWidth,
          offset: itemWidth * index,
          index,
        })}
      />
    </View>
  );
};

export default function DailyScreen() {
  // Adaptive Farben für Dark Mode (basierend auf Hintergrundbild-Einstellung)
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;

  // Dark Mode angepasste Farben
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const router = useRouter();
  const { quickAction } = useLocalSearchParams<{ quickAction?: string | string[] }>();
  
  const { activeBabyId, isReady } = useActiveBaby();

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
  const [showDateNav, setShowDateNav] = useState(true);
  const fadeNavAnim = useRef(new Animated.Value(1)).current;
  const hideNavTimeout = useRef<NodeJS.Timeout | null>(null);
  const quickActionHandledRef = useRef<string | null>(null);

  const [activeTimer, setActiveTimer] = useState<{
    id: string;
    type: 'BOTTLE' | 'BREAST' | 'SOLIDS' | 'DIAPER';
    start: number;
  } | null>(null);

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
  const splashEmojiParts = useMemo(() => Array.from(splashEmoji), [splashEmoji]);

  // Notification hooks
  const { requestPermissions } = useNotifications();
  const { isPartnerLinked } = usePartnerNotifications();

  // Request notification permissions on mount
  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

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

  // Realtime subscription removed for simplicity; list refreshes on actions
  // mapCareToDaily moved to dailyCache.ts

  const lastBottleVolumeMl = useMemo(() => {
    const allEntries = [...entries, ...weekEntries, ...monthEntries];
    let latestTime = -Infinity;
    let latestVolume: number | null = null;

    for (const entry of allEntries) {
      if (entry.entry_type !== 'feeding' || entry.feeding_type !== 'BOTTLE') continue;
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
    }

    setRefreshing(false);
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
    if (action.startsWith('feeding')) setSelectedActivityType('feeding');
    else if (action.startsWith('diaper')) setSelectedActivityType('diaper');
    else setSelectedActivityType('other');
    setSelectedSubType(action);
    // Preselect modal fields by subtype
    if (action === 'feeding_breast') setEditingEntry({} as any);
    if (action === 'feeding_bottle') setEditingEntry({} as any);
    if (action === 'feeding_solids') setEditingEntry({} as any);
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
          : rawAction === 'feeding_breast' || rawAction === 'feeding_bottle' || rawAction === 'feeding_solids'
            ? { activityType: 'feeding' as const, subType: rawAction as QuickActionType }
            : rawAction === 'diaper_wet' || rawAction === 'diaper_dirty' || rawAction === 'diaper_both'
              ? { activityType: 'diaper' as const, subType: rawAction as QuickActionType }
              : null;

    if (!resolved) return;
    quickActionHandledRef.current = rawAction;
    setSelectedActivityType(resolved.activityType);
    setSelectedSubType(resolved.subType);
    setEditingEntry(null);
    setShowInputModal(true);
    router.setParams({ quickAction: undefined });
  }, [quickAction, router]);

  const handleSaveEntry = async (payload: any, options?: { startTimer?: boolean }) => {
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
    const timerRequested = !!options?.startTimer;
    
    if (selectedActivityType === 'feeding') {
      const feedingType = (payload.feeding_type as 'BREAST' | 'BOTTLE' | 'SOLIDS' | undefined) ?? undefined;
      let data, error;
      if (editingEntry?.id) {
        const res = await updateBabyCareEntry(editingEntry.id, {
          start_time: payload.start_time,
          end_time: payload.end_time ?? null,
          notes: payload.notes ?? null,
          feeding_type: feedingType,
          feeding_volume_ml: payload.feeding_volume_ml ?? null,
          feeding_side: payload.feeding_side ?? null,
        }, activeBabyId ?? undefined);
        data = res.data; error = res.error;
      } else {
        const res = await addBabyCareEntry({
          entry_type: 'feeding',
          start_time: payload.start_time,
          end_time: payload.end_time ?? null,
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
        const startMs = payload.start_time ? new Date(payload.start_time).getTime() : Date.now();
        const timerType = feedingType as 'BREAST' | 'BOTTLE' | 'SOLIDS';
        setActiveTimer({
          id: data?.id || editingEntry?.id || `temp_${Date.now()}`,
          type: timerType,
          start: startMs,
        });
      }
      showSuccessSplash(
        feedingType === 'BREAST' ? '#8E4EC6' : feedingType === 'BOTTLE' ? '#4A90E2' : '#F5A623',
        feedingType === 'BREAST' ? '🤱' : feedingType === 'BOTTLE' ? '🍼' : '🥄',
        feedingType === 'BREAST' ? 'feeding_breast' : feedingType === 'BOTTLE' ? 'feeding_bottle' : 'feeding_solids',
        timerRequested
      );
    } else if (selectedActivityType === 'diaper') {
      const diaperType = (payload.diaper_type as 'WET' | 'DIRTY' | 'BOTH' | undefined) ?? undefined;
      let data, error;
      if (editingEntry?.id) {
        const res = await updateBabyCareEntry(editingEntry.id, {
          start_time: payload.start_time,
          end_time: payload.end_time ?? null,
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
          start_time: payload.start_time,
          end_time: payload.end_time ?? null,
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
        const startMs = payload.start_time ? new Date(payload.start_time).getTime() : Date.now();
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

  const handleTimerStop = async () => {
    if (!activeTimer) return;
    if (!activeBabyId) return;
    const { error } = await stopBabyCareEntryTimer(activeTimer.id, activeBabyId);
    if (error) {
      Alert.alert('Fehler', String((error as any)?.message ?? error ?? 'Unbekannter Fehler'));
      return;
    }
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
  };

  const handleDeleteEntry = async (id: string) => {
    Alert.alert('Eintrag löschen', 'Möchtest du diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          if (!activeBabyId) return;
          const { error } = await deleteBabyCareEntry(id, activeBabyId);
          if (error) return;

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
    const totalFeedings = weekEntries.filter((e) => e.entry_type === 'feeding').length;
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

        {/* Füttern diese Woche (Stillen, Fläschchen, Beikost) - EXAKT wie Sleep-Tracker */}
        <LiquidGlassCard style={s.chartGlassCard}>
          <Text style={[s.chartTitle, { color: textSecondary }]}>Füttern diese Woche</Text>

          {/* feste Gesamtbreite = WEEK_CONTENT_WIDTH (wie Timeline) */}
          <View style={[s.chartArea, { width: WEEK_CONTENT_WIDTH, alignSelf: 'center' }]}>
            {weekDays.map((day, i) => {
              const feedingEntries = getEntriesForDay(day).filter((e) => e.entry_type === 'feeding');
              const breast = feedingEntries.filter((e: any) => e.feeding_type === 'BREAST').length;
              const bottle = feedingEntries.filter((e: any) => e.feeding_type === 'BOTTLE').length;
              const solids = feedingEntries.filter((e: any) => e.feeding_type === 'SOLIDS').length;
              
              const maxFeed = Math.max(4, ...weekDays.flatMap((d) => {
                const items = getEntriesForDay(d).filter((e) => e.entry_type === 'feeding');
                return [
                  items.filter((e: any) => e.feeding_type === 'BREAST').length,
                  items.filter((e: any) => e.feeding_type === 'BOTTLE').length,
                  items.filter((e: any) => e.feeding_type === 'SOLIDS').length
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
                  <Text style={[s.statLabel, { color: textSecondary }]}>Fütterungen</Text>
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
                <Text style={[s.statValue, { color: textPrimary }]}>{monthEntries.filter(e => e.entry_type === 'feeding').length}</Text>
                <Text style={[s.statLabel, { color: textSecondary }]}>Fütterungen</Text>
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
          feedingSecondaryDetail = hasSolidFeedings ? `Beikost ${feedingOverview.solidsCount}×` : null;
        } else {
          feedingStatValue = `${feedingOverview.solidsCount}`;
          feedingPrimaryDetail = 'Beikost';
          feedingSecondaryDetail = hasBreastFeedings ? `Stillen ${feedingOverview.breastCount}×` : null;
        }
      }
    }

    const lastDiaperEntry = diaperEntries
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0];

    const lastDiaperTime = lastDiaperEntry
      ? new Date(lastDiaperEntry.entry_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : 'Nie';

    return (
      <View style={s.kpiRow}>
        <GlassCard
          style={s.kpiCard}
          intensity={24}
          overlayColor="rgba(94, 61, 179, 0.13)"
          borderColor="rgba(94, 61, 179, 0.35)"
        >
          <View style={s.kpiHeaderRow}>
            <Text style={s.kpiEmoji}>🍼</Text>
            <Text style={[s.kpiTitle, { color: textSecondary }]}>Fütterung</Text>
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
          ) : null}
        </GlassCard>

        <GlassCard
          style={s.kpiCard}
          intensity={24}
          overlayColor="rgba(94, 61, 179, 0.08)"
          borderColor="rgba(94, 61, 179, 0.22)"
        >
          <View style={s.kpiHeaderRow}>
            <Text style={s.kpiEmoji}>🧷</Text>
            <Text style={[s.kpiTitle, { color: textSecondary }]}>Wickeln</Text>
          </View>
          <Text style={[s.kpiValue, s.kpiValueCentered, { color: textPrimary }]}>{diaperEntries.length}</Text>
          <Text style={[s.kpiSub, { color: textSecondary }]}>Letzter: {lastDiaperTime}</Text>
        </GlassCard>
      </View>
    );
  };

  return (
    <ThemedBackground style={s.backgroundImage}>
      <SafeAreaView style={s.container}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header
          title="Unser Tag"
          subtitle="Euer Tag – voller kleiner Meilensteine ✨"
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />

        <ConnectionStatus showAlways={false} autoCheck={true} onRetry={loadEntries} />

        <TimerBanner
          timer={activeTimer}
          onStop={handleTimerStop}
          onCancel={async () => {
            if (!activeTimer) return;
            Alert.alert('Timer abbrechen', 'Willst du den laufenden Eintrag wirklich verwerfen?', [
              { text: 'Nein', style: 'cancel' },
              {
                text: 'Ja, verwerfen',
                style: 'destructive',
                onPress: async () => {
                  const { error } = await deleteBabyCareEntry(activeTimer.id, activeBabyId ?? undefined);
                  if (!error) {
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

              <QuickActionRow onPressAction={handleQuickActionPress} />

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
                  {entries.map((item) => (
                    <ActivityCard
                      key={item.id ?? Math.random().toString()}
                      entry={item}
                      onDelete={handleDeleteEntry}
                      onEdit={(entry) => {
                        setEditingEntry(entry);
                        if (entry.entry_type === 'feeding') setSelectedActivityType('feeding');
                        else if (entry.entry_type === 'diaper') setSelectedActivityType('diaper');
                        setSelectedSubType((entry as any).sub_type ?? null);
                        setShowInputModal(true);
                      }}
                      marginHorizontal={8}
                    />
                  ))}
                  {entries.length === 0 && <EmptyState type="day" message="Tippe auf ein Symbol um einen Eintrag zu erstellen" />}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* FAB entfernt wie gewünscht */}

        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          initialSubType={selectedSubType}
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
            feeding_type: selectedSubType === 'feeding_breast' ? 'BREAST' : selectedSubType === 'feeding_bottle' ? 'BOTTLE' : selectedSubType === 'feeding_solids' ? 'SOLIDS' : undefined,
            feeding_volume_ml: selectedSubType === 'feeding_bottle' ? lastBottleVolumeMl : null,
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

  sectionTitle: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
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
  quickScrollContainer: { paddingHorizontal: 0 },
  circleButton: {
    width: 96,
    height: 96,
    borderRadius: 48, // fully round
    borderWidth: 1,
    overflow: 'hidden',
  },
  circleInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  circleEmoji: { fontSize: 26 },
  circleLabel: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#7D5A50' },

  // KPI glass cards
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  kpiCard: {
    width: '48%',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  kpiHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  kpiEmoji: { fontSize: 14, marginRight: 6 },
  kpiTitle: { fontSize: 14, fontWeight: '700', color: '#7D5A50' },
  kpiValue: { fontSize: 34, fontWeight: '800', color: PRIMARY, fontVariant: ['tabular-nums'] },
  kpiValueCentered: { textAlign: 'center', width: '100%' },
  kpiMlUnit: { fontSize: 18, fontWeight: '700' },
  kpiSub: { marginTop: 6, fontSize: 12, color: '#7D5A50' },
  kpiSubPrimary: { textAlign: 'center', fontWeight: '700', width: '100%', maxWidth: '100%' },
  kpiSubSecondary: { marginTop: 2, fontSize: 11, textAlign: 'center', width: '100%', maxWidth: '100%' },

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
