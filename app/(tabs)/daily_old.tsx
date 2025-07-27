import React, { useState, useEffect } from 'react';
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
  saveFeedingEvent, //  NEU: eigenes Insert in feeding_events
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

// ▸ TYPE ALIASES -------------------------------------------------------------
type QuickActionType =
  | 'feeding_breast'
  | 'feeding_bottle'
  | 'feeding_solids'
  | 'diaper_wet'
  | 'diaper_dirty'
  | 'diaper_both';

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

  // Quick‑Action → Modal -----------------------------------------------------
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] =
    useState<'feeding' | 'diaper' | 'other'>('feeding');
  const [selectedSubType, setSelectedSubType] = useState<QuickActionType | null>(
    null,
  );

  // -------------------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadEntries();
    syncDailyEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    try {
      setIsLoading(true);
      const { data, error } = await getDailyEntries(undefined, selectedDate);
      if (error) throw error;
      setEntries(data ?? []);
    } catch (err) {
      console.error('Error loading entries', err);
      Alert.alert('Fehler', 'Einträge konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const syncDailyEntries = async () => {
    try {
      await syncAllExistingDailyEntries();
    } catch (err) {
      console.error('Sync error', err);
    }
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
    try {
      // 1) spezifische Feeding‑Events direkt in feeding_events ablegen
      if (selectedActivityType === 'feeding') {
        const { error } = await saveFeedingEvent(payload); // erwartet { baby_id, type, start_time, volume_ml, side, note }
        if (error) throw error;
      }

      // 2) sonst in die generische daily‑Tabelle
      if (selectedActivityType !== 'feeding') {
        const { error } = await saveDailyEntry(payload);
        if (error) throw error;
      }

      setShowInputModal(false);
      loadEntries();
    } catch (err) {
      console.error('Save error', err);
      Alert.alert('Fehler', 'Eintrag konnte nicht gespeichert werden.');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    Alert.alert('Eintrag löschen', 'Möchtest du diesen Eintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await deleteDailyEntry(id);
            if (error) throw error;
            loadEntries();
          } catch (err) {
            console.error('Delete error', err);
            Alert.alert('Fehler', 'Eintrag konnte nicht gelöscht werden.');
          }
        },
      },
    ]);
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
          onPress={() => setSelectedTab(tab)}
        >
          <Text style={[s.topTabText, selectedTab === tab && s.activeTopTabText]}>
            {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const DateNavigator = () => (
    <View style={s.dateNav}>
      <TouchableOpacity style={s.navButton} onPress={() => changeRelativeDate(-1)}>
        <IconSymbol name="chevron.left" size={20} color={theme.text} />
      </TouchableOpacity>
      <View style={s.dateDisplay}>
        <Text style={s.dateText}>{selectedDate.toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        })}</Text>
      </View>
      <TouchableOpacity style={s.navButton} onPress={() => changeRelativeDate(1)}>
        <IconSymbol name="chevron.right" size={20} color={theme.text} />
      </TouchableOpacity>
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

  const QuickActions = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.quickScrollContainer}
      style={s.quickScrollView}
    >
      {quickBtns.map((btn) => (
        <TouchableOpacity
          key={btn.action}
          style={s.circleButton}
          onPress={() => handleQuickActionPress(btn.action)}
        >
          <Text style={s.circleEmoji}>{btn.icon}</Text>
          <Text style={s.circleLabel}>{btn.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const KPISection = () => (
    <View style={s.kpiRow}>
      <View style={[s.kpiCard, { backgroundColor: 'rgba(249, 224, 230, 0.6)' }]}>
        <Text style={s.kpiTitle}>Fütterung</Text>
        <Text style={s.kpiValue}>{entries.filter((e) => e.entry_type === 'feeding').length}</Text>
        <Text style={s.kpiSub}>Stillen/Flasche</Text>
      </View>
      <View style={[s.kpiCard, { backgroundColor: 'rgba(235, 236, 237, 0.6)' }]}>
        <Text style={s.kpiTitle}>Wickeln</Text>
        <Text style={s.kpiValue}>{entries.filter((e) => e.entry_type === 'diaper').length}</Text>
        <Text style={s.kpiSub}>Letzter: –</Text>
      </View>
    </View>
  );

  // -------------------------------------------------------------------------
  // MAIN RENDER BODY
  // -------------------------------------------------------------------------
  return (
    <ThemedBackground style={s.backgroundImage}>
      <SafeAreaView style={s.container}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header title="Unser Tag" subtitle="Euer Tag – voller kleiner Meilensteine ✨" />

        <TopTabs />
        <DateNavigator />
        {selectedTab === 'day' && <QuickActions />}
        <KPISection />

        {/* -------- View specific content -------------------------------- */}
        {selectedTab === 'day' && (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id ?? Math.random().toString()}
            renderItem={({ item }) => (
              <ActivityCard entry={item} onDelete={handleDeleteEntry} />
            )}
            ListEmptyComponent={<EmptyState type="day" />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} />}
          />
        )}

        {selectedTab === 'week' && (
          <WeekScroller selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        )}

        {selectedTab === 'month' && (
          <View style={s.emptyOverlay}>
            <EmptyState type="timeline" message="Monatsansicht folgt bald ✨" />
          </View>
        )}

        {/* Floating Action Button (öffnet generischen Selector) */}
        <TouchableOpacity
          style={[s.fab, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => handleQuickActionPress('feeding_breast') /* default */}
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
  // ----- Tabs --------------------------------------------------------------
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  topTab: {
    paddingHorizontal: 22,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  activeTopTab: {
    backgroundColor: '#8854d0',
  },
  topTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
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
  dateDisplay: {
    marginHorizontal: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
  },
  // ----- Quick Actions -----------------------------------------------------
  quickScrollView: {
    marginTop: 28,
  },
  quickScrollContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  circleButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleEmoji: {
    fontSize: 26,
  },
  circleLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // ----- KPI Cards ---------------------------------------------------------
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 26,
  },
  kpiCard: {
    width: '42%',
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 14,
    alignItems: 'center',
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
