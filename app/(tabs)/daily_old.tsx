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

import {
  getDailyEntries,
  getDailyEntriesForDateRange,
  saveDailyEntry,
  DailyEntry,
} from '@/lib/baby';
import { syncAllExistingDailyEntries } from '@/lib/syncDailyEntries';
import { subscribeToDailyEntries } from '@/lib/realtime';

import Header from '@/components/Header';
import ActivityCard from '@/components/ActivityCard';
import EmptyState from '@/components/EmptyState';
import ActivityInputModal from '@/components/ActivityInputModal';
import WeekScroller from '@/components/WeekScroller';
import { IconSymbol } from '@/components/ui/IconSymbol';

import { FeedingEventManager, FeedingEventData } from '@/components/FeedingEventManager';
import { DiaperEventManager, DiaperEventData } from '@/components/DiaperEventManager';
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
  intensity = 22,
  overlayColor = 'rgba(255,255,255,0.22)',
  borderColor = 'rgba(255,255,255,0.55)',
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
      <GlassCard style={s.dateSpiderCard} intensity={18} overlayColor="rgba(255,255,255,0.18)">
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
}> = ({ timer, onStop }) => {
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
    <GlassCard style={[s.timerBanner, { paddingVertical: 12, paddingHorizontal: 16 }]} intensity={24}>
      <View style={{ flex: 1 }}>
        <Text style={[s.timerType, { color: '#5e3db3' }]}>
          {timer.type === 'BREAST' ? '🤱 Stillen' : '🍼 Fläschchen'}
        </Text>
        <Text style={[s.timerTime, { color: '#2c2c2c' }]}>{formatTime(elapsed)}</Text>
      </View>
      <TouchableOpacity style={s.timerStopButton} onPress={onStop}>
        <IconSymbol name="stop.circle.fill" size={28} color="#5e3db3" />
      </TouchableOpacity>
    </GlassCard>
  );
};

export default function DailyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date()); // Separate state for week view
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

  useEffect(() => {
    if (selectedTab === 'week') {
      loadWeekEntries();
    } else {
      loadEntries();
    }
    syncDailyEntries();
  }, [selectedDate, selectedTab]);

  // Separate effect for week data loading
  useEffect(() => {
    if (selectedTab === 'week') {
      loadWeekEntries();
    }
  }, [selectedWeekDate, selectedTab]);

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
    const unsubscribe = subscribeToDailyEntries('dummy', () => loadEntries(), () => loadEntries(), () => loadEntries());
    return () => unsubscribe?.();
  }, []);

  const loadEntries = async () => {
    setIsLoading(true);
    const result = await SupabaseErrorHandler.executeWithHandling(
      async () => {
        const { data, error } = await getDailyEntries(undefined, selectedDate);
        if (error) throw error;
        return data ?? [];
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
        const { data, error } = await getDailyEntriesForDateRange(weekStart, weekEnd);
        if (error) throw error;
        return data ?? [];
      },
      'LoadWeekEntries',
      true,
      2
    );
    if (result.success) setWeekEntries(result.data!);
    setIsLoading(false);
  };

  const syncDailyEntries = async () => {
    await SupabaseErrorHandler.executeWithHandling(
      async () => {
        await syncAllExistingDailyEntries();
        return true;
      },
      'SyncDailyEntries',
      false,
      1
    );
  };

  const changeRelativeDate = (days: number) =>
    setSelectedDate(new Date(selectedDate.getTime() + days * 24 * 60 * 60 * 1000));

  const handleQuickActionPress = (action: QuickActionType) => {
    if (action.startsWith('feeding')) setSelectedActivityType('feeding');
    else if (action.startsWith('diaper')) setSelectedActivityType('diaper');
    else setSelectedActivityType('other');
    setSelectedSubType(action);
    setShowInputModal(true);
  };

  const handleSaveEntry = async (payload: any) => {
    console.log('handleSaveEntry - Received payload:', JSON.stringify(payload, null, 2));
    console.log('handleSaveEntry - selectedActivityType:', selectedActivityType);
    console.log('handleSaveEntry - selectedSubType:', selectedSubType);
    
    if (selectedActivityType === 'feeding') {
      const feedingData: FeedingEventData = {
        type: selectedSubType as 'feeding_breast' | 'feeding_bottle' | 'feeding_solids',
        volume_ml: payload.feeding_volume_ml, // Updated to match new payload format
        side: payload.feeding_side, // Updated to match new payload format (keep uppercase)
        note: payload.notes, // Updated to match new payload format
        date: new Date(payload.start_time) || selectedDate, // Updated to match new payload format
      };
      const result = await FeedingEventManager.createFeedingEvent(feedingData);
      if (!result.success) {
        Alert.alert('Fehler', String(result.error ?? 'Fehler beim Speichern der Fütterung'));
        return;
      }
      if (selectedSubType === 'feeding_breast' || selectedSubType === 'feeding_bottle') {
        const timerType = selectedSubType === 'feeding_breast' ? 'BREAST' : 'BOTTLE';
        setActiveTimer({ id: result.id || `temp_${Date.now()}`, type: timerType, start: Date.now() });
      }
      Alert.alert('Erfolg', 'Fütterungseintrag gespeichert! 🍼');
    } else if (selectedActivityType === 'diaper') {
      const diaperData: DiaperEventData = {
        type: selectedSubType as 'diaper_wet' | 'diaper_dirty' | 'diaper_both',
        note: payload.notes, // Updated to match new payload format
        date: new Date(payload.start_time) || selectedDate, // Updated to match new payload format
      };
      const result = await DiaperEventManager.createDiaperEvent(diaperData);
      if (!result.success) {
        Alert.alert('Fehler', String(result.error ?? 'Fehler beim Speichern'));
        return;
      }
      Alert.alert('Erfolg', 'Wickeleintrag gespeichert! 💧');
    } else {
      const result = await SupabaseErrorHandler.executeWithHandling(
        async () => {
          const { data, error } = await saveDailyEntry(payload);
          if (error) throw error;
          return data;
        },
        'SaveOtherEntry',
        true,
        2
      );
      if (!result.success) {
        Alert.alert('Fehler', String(result.error ?? 'Fehler beim Speichern'));
        return;
      }
      Alert.alert('Erfolg', 'Eintrag gespeichert! ✅');
    }
    setShowInputModal(false);
    loadEntries();
  };

  const handleTimerStop = async () => {
    if (!activeTimer) return;
    const result = await FeedingEventManager.stopFeedingTimer(activeTimer.id);
    if (!result.success) {
      Alert.alert('Fehler', result.error || 'Unbekannter Fehler');
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
          const result = await DiaperEventManager.deleteDiaperEvent(id);
          if (!result.success) return;
          loadEntries();
          Alert.alert('Erfolg', 'Eintrag gelöscht! 🗑️');
        },
      },
    ]);
  };

  const TopTabs = () => (
    <View style={s.topTabsContainer}>
      {(['day', 'week', 'month'] as const).map((tab) => (
        <GlassCard key={tab} style={[s.topTab, selectedTab === tab && s.activeTopTab]} intensity={18}>
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
        intensity={26}
        overlayColor="rgba(255,255,255,0.26)"
        borderColor="rgba(255,255,255,0.65)"
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
                  // Keep the week context when switching to day view
                  setSelectedWeekDate(selectedWeekDate);
                  setSelectedTab('day');
                }}
              >
                <GlassCard
                  style={s.weekDayInner}
                  intensity={isSelected ? 35 : 20}
                  overlayColor={isSelected ? 'rgba(94, 61, 179, 0.2)' : 'rgba(255,255,255,0.15)'}
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

        <TimerBanner timer={activeTimer} onStop={handleTimerStop} />

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
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={s.sectionTitle}>Monatsansicht</Text>
              <Text style={{ color: '#666', textAlign: 'center' }}>Monatsansicht kommt bald! 📅</Text>
            </View>
          ) : (
            <>
              <QuickActionRow />

              <Text style={s.sectionTitle}>Kennzahlen</Text>
              <KPISection />

              <Text style={[s.sectionTitle, { marginTop: 4 }]}>Timeline</Text>

              <View style={s.entriesSection}>
                {entries.map((item) => (
                  <ActivityCard key={item.id ?? Math.random().toString()} entry={item} onDelete={handleDeleteEntry} />
                ))}
                {entries.length === 0 && <EmptyState type="day" message="Noch keine Aktivitäten heute 🤍" />}
              </View>
            </>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[s.fab, { backgroundColor: 'rgba(94, 61, 179, 0.9)' }]}
          onPress={() => handleQuickActionPress('feeding_breast')}
        >
          <IconSymbol name="plus" size={28} color="#fff" />
        </TouchableOpacity>

        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          initialSubType={selectedSubType}
          date={selectedDate}
          onClose={() => setShowInputModal(false)}
          onSave={handleSaveEntry}
        />
      </SafeAreaView>
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
    color: '#6b6b6b',
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
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // Date spider
  dateSpiderWrap: { paddingHorizontal: 14 },
  dateSpiderCard: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16 },
  dateSpiderText: { fontSize: 14, fontWeight: '700', color: '#5e3db3', textAlign: 'center' },

  // Timer Banner
  timerBanner: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerType: { fontSize: 14, fontWeight: '700' },
  timerTime: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  timerStopButton: { padding: 6 },

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
  topTabText: { fontSize: 13, fontWeight: '700', color: '#5d5d5d' },
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
  circleLabel: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#4a4a4a' },

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
  kpiTitle: { fontSize: 14, fontWeight: '700', color: '#393939' },
  kpiValue: { fontSize: 34, fontWeight: '800', color: '#5e3db3' },
kpiValueCentered: { textAlign: 'center', width: '100%' },
  kpiSub: { marginTop: 6, fontSize: 12, color: '#5a5a5a' },

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
    color: '#333',
    marginBottom: 4,
  },
  weekHeaderSubtitle: {
    fontSize: 12,
    color: '#666',
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
    color: '#666',
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#333',
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
    color: '#333',
    marginBottom: 4,
  },
  weekStatLabel: {
    fontSize: 12,
    color: '#666',
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
});