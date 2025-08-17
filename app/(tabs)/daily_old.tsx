import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LinearGradient } from 'expo-linear-gradient';

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

import Header from '@/components/Header';
import ActivityCard from '@/components/ActivityCard';
import EmptyState from '@/components/EmptyState';
import ActivityInputModal from '@/components/ActivityInputModal';
import WeekScroller from '@/components/WeekScroller';
import { IconSymbol } from '@/components/ui/IconSymbol';

// Removed old managers; using unified baby_care_entries
import { SupabaseErrorHandler } from '@/lib/errorHandler';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { DebugPanel } from '@/components/DebugPanel';

import { BlurView } from 'expo-blur';

type QuickActionType =
  | 'feeding_breast'
  | 'feeding_bottle'
  | 'feeding_solids'
  | 'diaper_wet'
  | 'diaper_dirty'
  | 'diaper_both';

// Reusable GlassCard using expo-blur
function GlassCard({
  children,
  style,
  intensity = 26,
  overlayColor = 'rgba(255,255,255,0.30)',
  borderColor = 'rgba(255,255,255,0.65)',
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;          // 0..100
  overlayColor?: string;       // tint-like overlay
  borderColor?: string;        // per-card border nuance
}) {
  return (
    <View style={[s.glassContainer, { borderColor }, style]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={intensity} tint="light" />
      <View style={[s.glassOverlay, { backgroundColor: overlayColor }]} />
      {children}
    </View>
  );
}

// DateSpider as glass pill
const DateSpider: React.FC<{ date: Date; visible: boolean }> = ({ date, visible }) => {
  if (!visible) return null;
  return (
    <View style={s.dateSpiderWrap}>
      <GlassCard style={s.dateSpiderCard} intensity={22} overlayColor="rgba(255,255,255,0.24)">
        <Text style={s.dateSpiderText}>
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

  return (
    <GlassCard style={[s.timerBanner, { paddingVertical: 12, paddingHorizontal: 16 }]} intensity={28}>
      <View style={{ flex: 1 }}>
        <Text style={[s.timerType, { color: '#5e3db3' }]}>
          {timer.type === 'BREAST' ? '🤱 Stillen' : '🍼 Fläschchen'} • läuft seit {new Date(timer.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={[s.timerTime, { color: '#7D5A50' }]}>{formatTime(elapsed)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity style={s.timerCancelButton} onPress={onCancel}>
          <IconSymbol name="xmark.circle" size={26} color="#a3a3a3" />
        </TouchableOpacity>
        <TouchableOpacity style={s.timerStopButton} onPress={onStop}>
          <IconSymbol name="stop.circle.fill" size={28} color="#5e3db3" />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
};

export default function DailyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<DailyEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date()); // Separate state for week view
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date()); // Separate state for month view
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [showInputModal, setShowInputModal] = useState(false);
  const [showDateNav, setShowDateNav] = useState(true);
  const fadeNavAnim = useRef(new Animated.Value(1)).current;
  const hideNavTimeout = useRef<NodeJS.Timeout | null>(null);

  const [activeTimer, setActiveTimer] = useState<{
    id: string;
    type: 'BOTTLE' | 'BREAST';
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

  useEffect(() => {
    if (selectedTab === 'week') {
      loadWeekEntries();
    } else if (selectedTab === 'month') {
      loadMonthEntries();
    } else {
      loadEntries();
    }
  }, [selectedDate, selectedTab]);

  // Separate effects for week/month data loading
  useEffect(() => {
    if (selectedTab === 'week') {
      loadWeekEntries();
    }
  }, [selectedWeekDate, selectedTab]);

  useEffect(() => {
    if (selectedTab === 'month') {
      loadMonthEntries();
    }
  }, [selectedMonthDate, selectedTab]);

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

  const mapCareToDaily = (rows: any[]): DailyEntry[] =>
    rows.map((r) => ({
      id: r.id,
      entry_date: r.start_time,
      entry_type: r.entry_type,
      start_time: r.start_time,
      end_time: r.end_time ?? null,
      notes: r.notes ?? null,
      feeding_type: r.feeding_type ?? undefined,
      feeding_volume_ml: r.feeding_volume_ml ?? undefined,
      feeding_side: r.feeding_side ?? undefined,
      diaper_type: r.diaper_type ?? undefined,
      // helper for KPI (not part of type, accessed as any):
      sub_type:
        r.entry_type === 'feeding'
          ? r.feeding_type === 'BREAST'
            ? 'feeding_breast'
            : r.feeding_type === 'BOTTLE'
            ? 'feeding_bottle'
            : 'feeding_solids'
          : r.entry_type === 'diaper'
          ? r.diaper_type === 'WET'
            ? 'diaper_wet'
            : r.diaper_type === 'DIRTY'
            ? 'diaper_dirty'
            : 'diaper_both'
          : undefined,
    } as unknown as DailyEntry));

  const loadEntries = async () => {
    setIsLoading(true);
    const result = await SupabaseErrorHandler.executeWithHandling(
      async () => {
        const { data, error } = await getBabyCareEntriesForDate(selectedDate);
        if (error) throw error;
        return mapCareToDaily(data ?? []);
      },
      'LoadDailyEntries',
      true,
      2
    );
    if (result.success) setEntries(result.data!);
    setIsLoading(false);
    setRefreshing(false);
  };

  const loadWeekEntries = async () => {
    setIsLoading(true);
    const weekStart = getWeekStart(selectedWeekDate);
    const weekEnd = getWeekEnd(selectedWeekDate);
    
    const result = await SupabaseErrorHandler.executeWithHandling(
      async () => {
        const { data, error } = await getBabyCareEntriesForDateRange(weekStart, weekEnd);
        if (error) throw error;
        return mapCareToDaily(data ?? []);
      },
      'LoadWeekEntries',
      true,
      2
    );
    if (result.success) setWeekEntries(result.data!);
    setIsLoading(false);
  };

  const loadMonthEntries = async () => {
    setIsLoading(true);
    const result = await SupabaseErrorHandler.executeWithHandling(
      async () => {
        const { data, error } = await getBabyCareEntriesForMonth(selectedMonthDate);
        if (error) throw error;
        return mapCareToDaily(data ?? []);
      },
      'LoadMonthEntries',
      true,
      2
    );
    if (result.success) setMonthEntries(result.data!);
    setIsLoading(false);
  };

  const syncDailyEntries = async () => {};

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

  const handleSaveEntry = async (payload: any) => {
    console.log('handleSaveEntry - Received payload:', JSON.stringify(payload, null, 2));
    console.log('handleSaveEntry - selectedActivityType:', selectedActivityType);
    console.log('handleSaveEntry - selectedSubType:', selectedSubType);
    
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
        });
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
        });
        data = res.data; error = res.error;
      }
      if (error) {
        Alert.alert('Fehler', String((error as any)?.message ?? error ?? 'Fehler beim Speichern der Fütterung'));
        return;
      }
      if (feedingType === 'BREAST' || feedingType === 'BOTTLE') {
        const timerType = feedingType;
        setActiveTimer({ id: data?.id || `temp_${Date.now()}`, type: timerType, start: Date.now() });
      }
      showSuccessSplash(
        feedingType === 'BREAST' ? '#8E4EC6' : feedingType === 'BOTTLE' ? '#4A90E2' : '#F5A623',
        feedingType === 'BREAST' ? '🤱' : feedingType === 'BOTTLE' ? '🍼' : '🥄',
        feedingType === 'BREAST' ? 'feeding_breast' : feedingType === 'BOTTLE' ? 'feeding_bottle' : 'feeding_solids'
      );
    } else if (selectedActivityType === 'diaper') {
      const diaperType = (payload.diaper_type as 'WET' | 'DIRTY' | 'BOTH' | undefined) ?? undefined;
      let error;
      if (editingEntry?.id) {
        const res = await updateBabyCareEntry(editingEntry.id, {
          start_time: payload.start_time,
          end_time: payload.end_time ?? null,
          notes: payload.notes ?? null,
          diaper_type: diaperType,
        });
        error = res.error;
      } else {
        const res = await addBabyCareEntry({
          entry_type: 'diaper',
          start_time: payload.start_time,
          end_time: payload.end_time ?? null,
          notes: payload.notes ?? null,
          diaper_type: diaperType,
        });
        error = res.error;
      }
      if (error) {
        Alert.alert('Fehler', String((error as any)?.message ?? error ?? 'Fehler beim Speichern'));
        return;
      }
      showSuccessSplash(
        diaperType === 'WET' ? '#3498DB' : diaperType === 'DIRTY' ? '#8E5A2B' : '#38A169',
        diaperType === 'WET' ? '💧' : diaperType === 'DIRTY' ? '💩' : '💧💩',
        diaperType === 'WET' ? 'diaper_wet' : diaperType === 'DIRTY' ? 'diaper_dirty' : 'diaper_both'
      );
    } else {
      Alert.alert('Hinweis', 'Sonstige Einträge sind in der neuen Ansicht nicht verfügbar.');
    }
    setShowInputModal(false);
    setEditingEntry(null);
    loadEntries();
  };

  const showSuccessSplash = (hex: string, emoji: string, kind: string) => {
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
      setSplashTitle('Stillen läuft');
      setSplashSubtitle('Nimm dir Zeit. Genieße diese besonderen Momente.');
      setSplashStatus('Wird gestartet...');
      setSplashHint('Du gibst deinem Baby alles, was es braucht 💕');
      setSplashText('');
    } else if (kind === 'feeding_bottle') {
      setSplashTitle('Fläschchen läuft');
      setSplashSubtitle('Ganz in Ruhe – du machst das super.');
      setSplashStatus('Wird gestartet...');
      setSplashHint('Nähe und Ernährung – perfekt kombiniert 🤍');
      setSplashText('');
    } else if (kind === 'feeding_solids') {
      setSplashTitle('Beikost gespeichert');
      setSplashSubtitle('Jeder Löffel ein kleiner Fortschritt.');
      setSplashStatus('');
      setSplashHint('Weiter so – ihr wachst gemeinsam!');
      setSplashText('');
    } else {
      setSplashTitle('Wickeln gespeichert');
      setSplashSubtitle('Alles frisch – wohlfühlen ist wichtig.');
      setSplashStatus('');
      setSplashHint('Danke für deine liebevolle Fürsorge ✨');
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
    const { error } = await stopBabyCareEntryTimer(activeTimer.id);
    if (error) {
      Alert.alert('Fehler', String((error as any)?.message ?? error ?? 'Unbekannter Fehler'));
      return;
    }
    setActiveTimer(null);
    loadEntries();
    Alert.alert('Erfolg', 'Timer gestoppt! ⏹️');
  };

  const handleDeleteEntry = async (id: string) => {
    Alert.alert('Eintrag löschen', 'Möchtest du diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteBabyCareEntry(id);
          if (error) return;
          loadEntries();
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
            onPress={() => {
              setSelectedTab(tab);
              if (tab === 'day') triggerShowDateNav();
            }}
            activeOpacity={0.85}
          >
            <Text style={[s.topTabText, selectedTab === tab && s.activeTopTabText]}>
              {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      ))}
    </View>
  );

  const quickBtns: { icon: string; label: string; action: QuickActionType }[] = [
    { action: 'feeding_breast', label: 'Stillen', icon: '🤱' },
    { action: 'feeding_bottle', label: 'Fläschchen', icon: '🍼' },
    { action: 'feeding_solids', label: 'Beikost', icon: '🥄' },
    { action: 'diaper_wet', label: 'Nass', icon: '💧' },
    { action: 'diaper_dirty', label: 'Voll', icon: '💩' },
    { action: 'diaper_both', label: 'Beides', icon: '💧💩' },
  ];

  const QuickActionRow = () => {
    const renderQuickButton = ({ item }: { item: typeof quickBtns[0] }) => (
      <GlassCard
        style={s.circleButton}
        intensity={30}
        overlayColor="rgba(255,255,255,0.32)"
        borderColor="rgba(255,255,255,0.70)"
      >
        <TouchableOpacity style={s.circleInner} onPress={() => handleQuickActionPress(item.action)} activeOpacity={0.9}>
          <Text style={s.circleEmoji}>{item.icon}</Text>
          <Text style={s.circleLabel}>{item.label}</Text>
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
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.quickScrollContainer}
          ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
          decelerationRate="fast"
          scrollEventThrottle={16}
          snapToInterval={112} // 96 Breite + 16 Separator
          // Wenn du 104px runde Buttons willst:
          // - stelle circleButton width/height auf 104, borderRadius 52
          // - setze snapToInterval auf 120
        />
      </View>
    );
  };

  // Week navigation functions
  const goToPreviousWeek = () => {
    const newWeekDate = new Date(selectedWeekDate);
    newWeekDate.setDate(selectedWeekDate.getDate() - 7);
    setSelectedWeekDate(newWeekDate);
  };

  const goToNextWeek = () => {
    const newWeekDate = new Date(selectedWeekDate);
    newWeekDate.setDate(selectedWeekDate.getDate() + 7);
    setSelectedWeekDate(newWeekDate);
  };

  const goToCurrentWeek = () => {
    setSelectedWeekDate(new Date());
  };

  const WeekView = () => {
    const weekDays = getWeekDays(selectedWeekDate);
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

    return (
      <View style={s.weekViewContainer}>
        {/* Week Navigation Header */}
        <View style={s.weekNavigationContainer}>
          <TouchableOpacity style={s.weekNavButton} onPress={goToPreviousWeek}>
            <Text style={s.weekNavButtonText}>‹</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={s.weekHeaderCenter} onPress={goToCurrentWeek}>
            <Text style={s.weekHeaderTitle}>Wochenübersicht</Text>
            <Text style={s.weekHeaderSubtitle}>
              {getWeekStart(selectedWeekDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - {getWeekEnd(selectedWeekDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={s.weekNavButton} onPress={goToNextWeek}>
            <Text style={s.weekNavButtonText}>›</Text>
          </TouchableOpacity>
        </View>
        
        {/* Week Calendar */}
        <View style={s.weekCalendar}>
          {weekDays.map((day, index) => {
            const stats = getDayStats(day);
            const isToday = day.toDateString() === new Date().toDateString();
            const isSelected = day.toDateString() === selectedDate.toDateString();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  s.weekDayCard,
                  isToday && s.todayCard,
                  isSelected && s.selectedDayCard
                ]}
                onPress={() => {
                  setSelectedDate(day);
                  // Stay in week view; keep week context
                  setSelectedWeekDate(selectedWeekDate);
                }}
              >
                <GlassCard
                  style={s.weekDayInner}
                  intensity={isSelected ? 35 : 24}
                  overlayColor={isSelected ? 'rgba(94, 61, 179, 0.2)' : 'rgba(255,255,255,0.20)'}
                  borderColor={isToday ? 'rgba(94, 61, 179, 0.6)' : 'rgba(255,255,255,0.3)'}
                >
                  <Text style={[s.weekDayName, isSelected && s.selectedDayText]}>
                    {dayNames[index]}
                  </Text>
                  <Text style={[s.weekDayNumber, isSelected && s.selectedDayText]}>
                    {day.getDate()}
                  </Text>
                  
                  {stats.total > 0 && (
                    <View style={s.dayStatsContainer}>
                      {stats.feedingCount > 0 && (
                        <View style={s.statBadge}>
                          <Text style={s.statEmoji}>🍼</Text>
                          <Text style={s.statCount}>{stats.feedingCount}</Text>
                        </View>
                      )}
                      {stats.diaperCount > 0 && (
                        <View style={s.statBadge}>
                          <Text style={s.statEmoji}>💧</Text>
                          <Text style={s.statCount}>{stats.diaperCount}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </GlassCard>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Week Summary */}
        <WeekSummary entries={weekEntries} />
        
        {/* Week Entries Timeline */}
        <Text style={[s.sectionTitle, { marginTop: 20 }]}>Wochenverlauf</Text>
        <View style={s.weekEntriesContainer}>
          {weekDays.map((day, dayIndex) => {
            const dayEntries = getEntriesForDay(day);
            if (dayEntries.length === 0) return null;
            
            return (
              <View key={dayIndex} style={s.daySection}>
                <Text style={s.daySectionTitle}>
                  {day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}
                </Text>
                {dayEntries.map((entry) => (
                  <ActivityCard 
                    key={entry.id ?? Math.random().toString()} 
                    entry={entry} 
                    onDelete={handleDeleteEntry}
                  />
                ))}
              </View>
            );
          })}
          {weekEntries.length === 0 && (
            <EmptyState type="week" message="Noch keine Aktivitäten diese Woche 📅" />
          )}
        </View>
      </View>
    );
  };

  const WeekSummary = ({ entries }: { entries: DailyEntry[] }) => {
    const feedingEntries = entries.filter((e) => e.entry_type === 'feeding');
    const diaperEntries = entries.filter((e) => e.entry_type === 'diaper');
    
    const totalFeedings = feedingEntries.length;
    const totalDiapers = diaperEntries.length;
    const avgFeedingsPerDay = totalFeedings / 7;
    const avgDiapersPerDay = totalDiapers / 7;

    return (
      <View style={s.weekSummaryContainer}>
        <GlassCard
          style={s.weekSummaryCard}
          intensity={24}
          overlayColor="rgba(94, 61, 179, 0.1)"
          borderColor="rgba(94, 61, 179, 0.3)"
        >
          <Text style={s.weekSummaryTitle}>Wochenzusammenfassung</Text>
          <View style={s.weekSummaryStats}>
            <View style={s.weekStat}>
              <Text style={s.weekStatEmoji}>🍼</Text>
              <Text style={s.weekStatNumber}>{totalFeedings}</Text>
              <Text style={s.weekStatLabel}>Fütterungen</Text>
              <Text style={s.weekStatAvg}>⌀ {avgFeedingsPerDay.toFixed(1)}/Tag</Text>
            </View>
            <View style={s.weekStat}>
              <Text style={s.weekStatEmoji}>💧</Text>
              <Text style={s.weekStatNumber}>{totalDiapers}</Text>
              <Text style={s.weekStatLabel}>Windeln</Text>
              <Text style={s.weekStatAvg}>⌀ {avgDiapersPerDay.toFixed(1)}/Tag</Text>
            </View>
          </View>
        </GlassCard>
      </View>
    );
  };

  const MonthView = () => {
    // Build month grid, starting from Monday
    const baseDate = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
    const startDay = (baseDate.getDay() + 6) % 7; // convert Sun(0)→6, Mon(1)→0
    const daysInMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0).getDate();

    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startDay; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), d) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });

    const getCountsForDate = (date: Date) => {
      const str = date.toISOString().split('T')[0];
      const items = monthEntries.filter((e) => new Date(e.entry_date).toISOString().split('T')[0] === str);
      return {
        feeding: items.filter((e) => e.entry_type === 'feeding').length,
        diaper: items.filter((e) => e.entry_type === 'diaper').length,
      };
    };

    const goPrevMonth = () => {
      const d = new Date(selectedMonthDate);
      d.setMonth(d.getMonth() - 1);
      setSelectedMonthDate(d);
    };
    const goNextMonth = () => {
      const d = new Date(selectedMonthDate);
      d.setMonth(d.getMonth() + 1);
      setSelectedMonthDate(d);
    };

    const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={s.weekNavigationContainer}>
          <TouchableOpacity style={s.weekNavButton} onPress={goPrevMonth}>
            <Text style={s.weekNavButtonText}>‹</Text>
          </TouchableOpacity>
          <View style={s.weekHeaderCenter}>
            <Text style={s.weekHeaderTitle}>
              {selectedMonthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity style={s.weekNavButton} onPress={goNextMonth}>
            <Text style={s.weekNavButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday header */}
        <View style={[s.weekCalendar, { marginBottom: 8 }]}>
          {weekdayLabels.map((w) => (
            <Text key={w} style={[s.weekDayName, { flex: 1, textAlign: 'center' }]}>{w}</Text>
          ))}
        </View>

        {/* Month grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((cell, idx) => {
            const isEmpty = !cell.date;
            const isToday = cell.date && cell.date.toDateString() === new Date().toDateString();
            const counts = cell.date ? getCountsForDate(cell.date) : { feeding: 0, diaper: 0 };
            return (
              <View key={idx} style={{ width: `${100 / 7}%`, padding: 4 }}>
                {isEmpty ? (
                  <View style={{ height: 64 }} />
                ) : (
                  <GlassCard
                    style={{ alignItems: 'center', paddingVertical: 8 }}
                    intensity={isToday ? 28 : 18}
                    overlayColor={isToday ? 'rgba(94,61,179,0.16)' : 'rgba(255,255,255,0.12)'}
                    borderColor={isToday ? 'rgba(94,61,179,0.5)' : 'rgba(255,255,255,0.3)'}
                  >
                    <Text style={{ fontWeight: '700', color: isToday ? '#5E3DB3' : '#333' }}>
                      {cell.date!.getDate()}
                    </Text>
                    <View style={{ flexDirection: 'row', marginTop: 6 }}>
                      {counts.feeding > 0 && (
                        <View style={s.statBadge}>
                          <Text style={s.statEmoji}>🍼</Text>
                          <Text style={s.statCount}>{counts.feeding}</Text>
                        </View>
                      )}
                      {counts.diaper > 0 && (
                        <View style={[s.statBadge, { marginLeft: 4 }]}>
                          <Text style={s.statEmoji}>💧</Text>
                          <Text style={s.statCount}>{counts.diaper}</Text>
                        </View>
                      )}
                    </View>
                  </GlassCard>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const KPISection = () => {
    const currentEntries = selectedTab === 'week' ? weekEntries : entries;
    const feedingEntries = currentEntries.filter((e) => e.entry_type === 'feeding');
    const diaperEntries = currentEntries.filter((e) => e.entry_type === 'diaper');

    const bottleCount = feedingEntries.filter((f: any) => f.sub_type === 'feeding_bottle').length;
    const breastCount = feedingEntries.filter((f: any) => f.sub_type === 'feeding_breast').length;

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
            <Text style={s.kpiTitle}>Fütterung</Text>
          </View>
          <Text style={[s.kpiValue, s.kpiValueCentered]}>{feedingEntries.length}</Text>
          <Text style={s.kpiSub}>{breastCount}× Stillen • {bottleCount}× Flasche</Text>
        </GlassCard>

        <GlassCard
          style={s.kpiCard}
          intensity={24}
          overlayColor="rgba(94, 61, 179, 0.08)"
          borderColor="rgba(94, 61, 179, 0.22)"
        >
          <View style={s.kpiHeaderRow}>
            <Text style={s.kpiEmoji}>🧷</Text>
            <Text style={s.kpiTitle}>Wickeln</Text>
          </View>
          <Text style={[s.kpiValue, s.kpiValueCentered]}>{diaperEntries.length}</Text>
          <Text style={s.kpiSub}>Letzter: {lastDiaperTime}</Text>
        </GlassCard>
      </View>
    );
  };

  return (
    <ThemedBackground style={s.backgroundImage}>
      <SafeAreaView style={s.container}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header title="Unser Tag" subtitle="Euer Tag – voller kleiner Meilensteine ✨" />

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
                  const { error } = await deleteBabyCareEntry(activeTimer.id);
                  if (!error) {
                    setActiveTimer(null);
                    loadEntries();
                  }
                },
              },
            ]);
          }}
        />

        <DebugPanel />

        <ScrollView
          style={s.scrollContainer}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} />}
        >
          <TopTabs />

          {selectedTab === 'week' ? (
            <WeekView />
          ) : selectedTab === 'month' ? (
            <MonthView />
          ) : (
            <>
              <QuickActionRow />

              <Text style={[s.sectionTitle, { textAlign: 'center' }]}>Kennzahlen</Text>
              <KPISection />

            <Text style={[s.sectionTitle, { marginTop: 4, textAlign: 'center' }]}>Timeline</Text>

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
                  />
                ))}
                {entries.length === 0 && <EmptyState type="day" message="Noch keine Aktivitäten heute 🤍" />}
              </View>
            </>
          )}
        </ScrollView>

        {/* FAB entfernt wie gewünscht */}

        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          initialSubType={selectedSubType}
          date={selectedDate}
          onClose={() => { setShowInputModal(false); setEditingEntry(null); }}
          onSave={handleSaveEntry}
          initialData={editingEntry && editingEntry.id ? {
            id: editingEntry.id!,
            feeding_type: (editingEntry as any).feeding_type as any,
            feeding_volume_ml: (editingEntry as any).feeding_volume_ml ?? null,
            feeding_side: (editingEntry as any).feeding_side as any,
            diaper_type: (editingEntry as any).diaper_type as any,
            notes: editingEntry.notes ?? null,
            start_time: editingEntry.start_time!,
            end_time: editingEntry.end_time ?? null,
          } : (selectedSubType ? {
            // Preselect fields from quick actions
            feeding_type: selectedSubType === 'feeding_breast' ? 'BREAST' : selectedSubType === 'feeding_bottle' ? 'BOTTLE' : selectedSubType === 'feeding_solids' ? 'SOLIDS' : undefined,
            diaper_type: selectedSubType === 'diaper_wet' ? 'WET' : selectedSubType === 'diaper_dirty' ? 'DIRTY' : selectedSubType === 'diaper_both' ? 'BOTH' : undefined,
            start_time: new Date().toISOString(),
          } : undefined)}
        />
      </SafeAreaView>
      {splashVisible && (
        <Animated.View
          style={[s.splashOverlay, { opacity: splashAnim }]}
          pointerEvents="auto"
        >
          <LinearGradient
            colors={[splashBg, splashBg]}
            style={StyleSheet.absoluteFillObject as any}
          />
          <View style={s.splashCenterCard}>
            <Animated.View style={[s.splashEmojiRing, { transform: [{ scale: splashEmojiAnim }] }]}>
              <Text style={s.splashEmoji}>{splashEmoji}</Text>
            </Animated.View>
            {!!s.splashTitle && <Text style={s.splashTitle}>{splashTitle}</Text>}
            {splashSubtitle ? <Text style={s.splashSubtitle}>{splashSubtitle}</Text> : null}
            {splashStatus ? <Text style={s.splashStatus}>{splashStatus}</Text> : null}
            {splashHint ? (
              <View style={s.splashHintCard}>
                <Text style={s.splashHintText}>♡  {splashHint}</Text>
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
  backgroundImage: { flex: 1, width: '100%' },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 140 },

  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
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
  dateSpiderText: { fontSize: 14, fontWeight: '700', color: '#5e3db3', textAlign: 'center' },

  // Timer Banner
  timerBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerType: { fontSize: 14, fontWeight: '700' },
  timerTime: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  timerStopButton: { padding: 6 },
  timerCancelButton: { padding: 6, marginRight: 6 },

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
  activeTopTabText: { color: '#5e3db3' },

  // Quick actions as round glass buttons
  quickActionSection: { marginTop: 16 },
  quickScrollContainer: { paddingHorizontal: 16 },
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
    paddingHorizontal: 16,
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
  kpiValue: { fontSize: 34, fontWeight: '800', color: '#5e3db3' },
kpiValueCentered: { textAlign: 'center', width: '100%' },
  kpiSub: { marginTop: 6, fontSize: 12, color: '#7D5A50' },

  // Entries
  entriesSection: { paddingHorizontal: 16, marginTop: 8 },

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
    paddingHorizontal: 16,
  },
  weekNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 8,
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
  },
  weekNavButtonText: {
    fontSize: 24,
    color: '#5E3DB3',
    fontWeight: 'bold',
  },
  weekHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  weekHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 4,
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
  statEmoji: {
    fontSize: 10,
    marginRight: 2,
  },
  statCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5E3DB3',
  },
  weekSummaryContainer: {
    marginBottom: 20,
  },
  weekSummaryCard: {
    padding: 20,
    marginHorizontal: 16,
  },
  weekSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 16,
    textAlign: 'center',
  },
  weekSummaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekStat: {
    alignItems: 'center',
  },
  weekStatEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  weekStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 4,
  },
  weekStatLabel: {
    fontSize: 12,
    color: '#7D5A50',
    marginBottom: 4,
  },
  weekStatAvg: {
    fontSize: 10,
    color: '#999',
  },
  weekEntriesContainer: {
    paddingHorizontal: 16,
  },
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
  splashEmojiRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
});