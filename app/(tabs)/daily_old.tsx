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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// ▸ THEMED BACKGROUND --------------------------------------------------------
import { ThemedBackground } from '@/components/ThemedBackground';

// ▸ DATA + HELPERS -----------------------------------------------------------
import {
  getDailyEntries,
  saveDailyEntry,
  deleteDailyEntry,
  DailyEntry,
  saveFeedingEvent,
  updateFeedingEventEnd, // NEU: für Timer-Stop
} from '@/lib/baby';
import { syncAllExistingDailyEntries } from '@/lib/syncDailyEntries';
import { subscribeToDailyEntries } from '@/lib/realtime';

// ▸ REUSABLE COMPONENTS ------------------------------------------------------
import Header from '@/components/Header';
import ActivityCard from '@/components/ActivityCard';
import EmptyState from '@/components/EmptyState';
import ActivityInputModal from '@/components/ActivityInputModal';
import ActivitySelector from '@/components/ActivitySelector';
import DailySummary from '@/components/DailySummary';
import WeekScroller from '@/components/WeekScroller';
import TimelineView from '@/components/TimelineView';
import { IconSymbol } from '@/components/ui/IconSymbol';

// ▸ CRUD MANAGERS ------------------------------------------------------------
import { FeedingEventManager, FeedingEventData } from '@/components/FeedingEventManager';
import { DiaperEventManager, DiaperEventData } from '@/components/DiaperEventManager';
import { SupabaseErrorHandler } from '@/lib/errorHandler';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { DebugPanel } from '@/components/DebugPanel';

// ▸ TYPE ALIASES -------------------------------------------------------------
type QuickActionType =
  | 'feeding_breast'
  | 'feeding_bottle'
  | 'feeding_solids'
  | 'diaper_wet'
  | 'diaper_dirty'
  | 'diaper_both';

const { width: screenWidth } = Dimensions.get('window');

// ▸ DATE SPIDER COMPONENT ===================================================
const DateSpider: React.FC<{ date: Date; visible: boolean }> = ({ date, visible }) => {
  if (!visible) return null;
  return (
    <View style={s.dateSpider}>
      <Text style={s.dateSpiderText}>
        {date.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })}
      </Text>
    </View>
  );
};



// ▸ TIMER BANNER COMPONENT ==================================================
const TimerBanner: React.FC<{
  timer: { id: string; type: string; start: number } | null;
  onStop: () => void;
}> = ({ timer, onStop }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timer) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timer.start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  if (!timer) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={s.timerBanner}>
      <View style={s.timerContent}>
        <Text style={s.timerType}>
          {timer.type === 'BREAST' ? '🤱 Stillen' : '🍼 Fläschchen'}
        </Text>
        <Text style={s.timerTime}>{formatTime(elapsed)}</Text>
      </View>
      <TouchableOpacity style={s.timerStopButton} onPress={onStop}>
        <IconSymbol name="stop.circle.fill" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

// ▸ MAIN COMPONENT ===========================================================
export default function DailyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  // -------------------------------------------------------------------------
  // LOCAL STATE
  // -------------------------------------------------------------------------
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
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
  // EFFECTS
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadEntries();
    syncDailyEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Date-Nav fade-in and auto-fade-out logic
  useEffect(() => {
    // Fade in
    Animated.timing(fadeNavAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto hide after 5 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeNavAnim, {
        toValue: 0,
        duration: 500, // Slower fade-out
        useNativeDriver: true,
      }).start(() => setShowDateNav(false));
    }, 5000) as unknown as NodeJS.Timeout;

    return () => clearTimeout(timer);
  }, [selectedDate, fadeNavAnim]); // Re-trigger on date change

  // Show nav and tag when date changes or user interacts
  const triggerShowDateNav = () => {
    setShowDateNav(true);
    Animated.timing(fadeNavAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (hideNavTimeout.current) clearTimeout(hideNavTimeout.current);
    hideNavTimeout.current = setTimeout(() => {
      Animated.timing(fadeNavAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowDateNav(false));
    }, 5000) as unknown as NodeJS.Timeout;
  };

  useEffect(() => {
    triggerShowDateNav();
    return () => {
      if (hideNavTimeout.current) clearTimeout(hideNavTimeout.current);
    };
  }, [selectedDate]);

  // Realtime subscription to Supabase changes
  useEffect(() => {
    const unsubscribe = subscribeToDailyEntries(
      'dummy', // userId placeholder since it's handled server-side
      () => loadEntries(),
      () => loadEntries(),
      () => loadEntries(),
    );
    return () => unsubscribe?.();
  }, []);

  // -------------------------------------------------------------------------
  // DATA I/O
  // -------------------------------------------------------------------------
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

    if (result.success) {
      setEntries(result.data!);
    } else {
      setEntries([]);
    }

    setIsLoading(false);
    setRefreshing(false);
  };

  const syncDailyEntries = async () => {
    await SupabaseErrorHandler.executeWithHandling(
      async () => {
        await syncAllExistingDailyEntries();
        return true;
      },
      'SyncDailyEntries',
      false, // Don't show user errors for sync
      1
    );
  };

  // -------------------------------------------------------------------------
  // HANDLERS – NAVIGATION & UI
  // -------------------------------------------------------------------------
  const changeRelativeDate = (days: number) =>
    setSelectedDate(
      new Date(selectedDate.getTime() + days * 24 * 60 * 60 * 1000),
    );

  const handleQuickActionPress = (action: QuickActionType) => {
    // map subtype to generic activity type ➜ steuert Felder/Masken im Modal
    if (action.startsWith('feeding')) {
      setSelectedActivityType('feeding');
    } else if (action.startsWith('diaper')) {
      setSelectedActivityType('diaper');
    } else {
      setSelectedActivityType('other');
    }
    setSelectedSubType(action);
    setShowInputModal(true);
  };

  const handleSaveEntry = async (payload: any) => {
    console.log('💾 Saving entry with payload:', payload);
    console.log('💾 Activity type:', selectedActivityType);
    console.log('💾 Sub type:', selectedSubType);

    // 1) Feeding Events mit FeedingEventManager
    if (selectedActivityType === 'feeding') {
      const feedingData: FeedingEventData = {
        type: selectedSubType as 'feeding_breast' | 'feeding_bottle' | 'feeding_solids',
        volume_ml: payload.volume_ml,
        side: payload.side,
        note: payload.note,
        date: (payload.date as Date) || selectedDate,
      };

      const result = await FeedingEventManager.createFeedingEvent(feedingData);
      
      if (!result.success) {
        console.error('Feeding event error:', result.error);
        Alert.alert('Fehler', String(result.error ?? 'Fehler beim Speichern der Fütterung'));
        return;
      }

      // Start timer for breast/bottle feeding
      if (selectedSubType === 'feeding_breast' || selectedSubType === 'feeding_bottle') {
        const timerType = selectedSubType === 'feeding_breast' ? 'BREAST' : 'BOTTLE';
        setActiveTimer({
          id: result.id || `temp_${Date.now()}`,
          type: timerType,
          start: Date.now(),
        });
      }

      Alert.alert('Erfolg', 'Fütterungseintrag erfolgreich gespeichert! 🍼');
    }

    // 2) Diaper Events mit DiaperEventManager
    else if (selectedActivityType === 'diaper') {
      const diaperData: DiaperEventData = {
        type: selectedSubType as 'diaper_wet' | 'diaper_dirty' | 'diaper_both',
        note: payload.note,
        date: (payload.date as Date) || selectedDate,
      };

      const result = await DiaperEventManager.createDiaperEvent(diaperData);
      
      if (!result.success) {
        console.error('Feeding event error:', result.error);
        Alert.alert('Fehler', String(result.error ?? 'Fehler beim Speichern der Fütterung'));
        return;
      }

      Alert.alert('Erfolg', 'Wickeleintrag erfolgreich gespeichert! 💧');
    }

    // 3) Andere Events (fallback zum alten System)
    else {
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
        console.error('Feeding event error:', result.error);
        Alert.alert('Fehler', String(result.error ?? 'Fehler beim Speichern der Fütterung'));
        return;
      }

      Alert.alert('Erfolg', 'Eintrag erfolgreich gespeichert! ✅');
    }

    setShowInputModal(false);
    loadEntries();
  };

  const handleTimerStop = async () => {
    if (!activeTimer) return;

    const result = await FeedingEventManager.stopFeedingTimer(activeTimer.id);
    
    if (!result.success) {
      console.error('Other entry error:', result.error);
      Alert.alert('Fehler', result.error || 'Unbekannter Fehler beim Speichern');
      return;
    }

    setActiveTimer(null);
    loadEntries();
    Alert.alert('Erfolg', 'Timer erfolgreich gestoppt! ⏹️');
  };

  const handleDeleteEntry = async (id: string) => {
    console.log('🗑️ Attempting to delete entry:', id);
    
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const result = await DiaperEventManager.deleteDiaperEvent(id);
            
            if (!result.success) {
              return; // Error already handled by ErrorHandler
            }

            loadEntries();
            Alert.alert('Erfolg', 'Eintrag erfolgreich gelöscht! 🗑️');
          }
        }
      ]
    );
  };

  // -------------------------------------------------------------------------
  // RENDERERS – SMALL UI PIECES
  // -------------------------------------------------------------------------
  const TopTabs = () => (
    <View style={s.topTabsContainer}>
      {(['day', 'week', 'month'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[s.topTab, selectedTab === tab && s.activeTopTab]}
          onPress={() => {
            setSelectedTab(tab);
            if (tab === 'day') triggerShowDateNav();
          }}
        >
          <Text style={[s.topTabText, selectedTab === tab && s.activeTopTabText]}>
            {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const DateNavigator = () => (
    <Animated.View style={[s.dateNav, { opacity: fadeNavAnim }]}> 
      <TouchableOpacity
        style={s.navButton}
        onPress={() => { changeRelativeDate(-1); triggerShowDateNav(); }}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.left" size={22} color={theme.text} />
      </TouchableOpacity>
      <DateSpider date={selectedDate} visible={showDateNav} />
      <TouchableOpacity
        style={s.navButton}
        onPress={() => { changeRelativeDate(1); triggerShowDateNav(); }}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.right" size={22} color={theme.text} />
      </TouchableOpacity>
    </Animated.View>
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
      <TouchableOpacity
        style={s.circleButton}
        onPress={() => handleQuickActionPress(item.action)}
      >
        <Text style={s.circleEmoji}>{item.icon}</Text>
        <Text style={s.circleLabel}>{item.label}</Text>
      </TouchableOpacity>
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
        />
      </View>
    );
  };

  const KPISection = () => {
    const feedingEntries = entries.filter((e) => e.entry_type === 'feeding');
    const diaperEntries = entries.filter((e) => e.entry_type === 'diaper');
    
    // Get last diaper change time
    const lastDiaperEntry = diaperEntries
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0];
    const lastDiaperTime = lastDiaperEntry 
      ? new Date(lastDiaperEntry.entry_date).toLocaleTimeString('de-DE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : '–';

    return (
      <View style={s.kpiRow}>
        <View style={[s.kpiCard, { backgroundColor: 'rgba(249, 224, 230, 0.9)' }]}>
          <Text style={s.kpiTitle}>Fütterung</Text>
          <Text style={s.kpiValue}>{feedingEntries.length}</Text>
          <Text style={s.kpiSub}>Stillen/Flasche</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: 'rgba(235, 236, 237, 0.9)' }]}>
          <Text style={s.kpiTitle}>Wickeln</Text>
          <Text style={s.kpiValue}>{diaperEntries.length}</Text>
          <Text style={s.kpiSub}>Letzter: {lastDiaperTime}</Text>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // MAIN RENDER BODY
  // -------------------------------------------------------------------------
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} />
          }
        >
          <TopTabs />
          {showDateNav && (
            <Animated.View style={{ opacity: fadeNavAnim }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={s.navButton}
                    onPress={() => { changeRelativeDate(-1); triggerShowDateNav(); }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol name="chevron.left" size={22} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={triggerShowDateNav}
                  >
                    <DateSpider date={selectedDate} visible={true} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.navButton}
                    onPress={() => { changeRelativeDate(1); triggerShowDateNav(); }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol name="chevron.right" size={22} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}

          {selectedTab === 'day' && (
            <>
              <QuickActionRow />
              <KPISection />
              
              <View style={s.entriesSection}>
                {entries.map((item) => (
                  <ActivityCard 
                    key={item.id ?? Math.random().toString()} 
                    entry={item} 
                    onDelete={handleDeleteEntry} 
                  />
                ))}
                {entries.length === 0 && <EmptyState type="day" />}
              </View>
            </>
          )}

          {selectedTab === 'week' && (
            <WeekScroller selectedDate={selectedDate} onDateSelect={setSelectedDate} />
          )}

          {selectedTab === 'month' && (
            <View style={s.emptyOverlay}>
              <EmptyState type="timeline" message="Monatsansicht folgt bald ✨" />
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[s.fab, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => handleQuickActionPress('feeding_breast')}
        >
          <IconSymbol name="plus" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Modals */}
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

// =============================================================================
// STYLES
// =============================================================================
const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  // ----- DateSpider --------------------------------------------------------
  dateSpider: {
    backgroundColor: 'rgba(136, 84, 208, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 14,
  },
  dateSpiderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8854d0',
    textAlign: 'center',
  },
  // ----- Timer Banner ------------------------------------------------------
  timerBanner: {
    backgroundColor: '#8854d0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  timerContent: {
    flex: 1,
  },
  timerType: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  timerTime: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  timerStopButton: {
    padding: 8,
  },
  // ----- Tabs --------------------------------------------------------------
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  topTab: {
    paddingHorizontal: 32,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(136, 84, 208, 0.15)',
  },
  activeTopTab: {
    backgroundColor: '#8854d0',
  },
  topTabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6c6c6c',
  },
  activeTopTabText: {
    color: '#fff',
  },
  // ----- Date Navigator ----------------------------------------------------
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  navButton: {
    padding: 8,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  // ----- Quick Actions -----------------------------------------------------
  quickActionSection: {
    marginTop: 28,
  },
  quickScrollContainer: {
    paddingHorizontal: 30,
    gap: 20,
  },
  circleButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Even more transparent
    alignItems: 'center',
    justifyContent: 'center',
    // Add border for glass edge effect
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // Softer border
    // Add subtle shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 6,
  },
  circleEmoji: {
    fontSize: 28,
  },
  circleLabel: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#4a4a4a',
  },

  // ----- KPI Cards ---------------------------------------------------------
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 26,
    paddingHorizontal: 16,
  },
  kpiCard: {
    width: '45%',
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  kpiTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  kpiSub: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
  },
  // ----- Entries Section ---------------------------------------------------
  entriesSection: {
    paddingHorizontal: 16,
  },
  // ----- FAB ---------------------------------------------------------------
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  // ----- Empty overlay (month placeholder) ---------------------------------
  emptyOverlay: {
    marginTop: 40,
    alignItems: 'center',
  },
});
