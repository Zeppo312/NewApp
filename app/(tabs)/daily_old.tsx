import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, SafeAreaView, StatusBar, FlatList, RefreshControl, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedBackground } from '@/components/ThemedBackground';
import { getDailyEntries, saveDailyEntry, deleteDailyEntry, DailyEntry } from '@/lib/baby';
import DateTimePicker from '@react-native-community/datetimepicker';
import ActivityInputModal from '@/components/ActivityInputModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { syncAllExistingDailyEntries } from '@/lib/syncDailyEntries';
import { subscribeToDailyEntries } from '@/lib/realtime';
import { BlurView } from 'expo-blur';

const { width: screenWidth } = Dimensions.get('window');

export default function DailyOldScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // State for activity input modal
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'diaper' | 'other'>('feeding');

  // State für Zeitraum-Selektor
  const [timeRange, setTimeRange] = useState<'Tag' | 'Woche' | 'Monat'>('Tag');

  // State für Quick Actions Pager
  const [activeQuickActionPage, setActiveQuickActionPage] = useState(0);

  // useEffect für das Laden der Einträge bei Änderung des Datums
  useEffect(() => {
    if (user) {
      loadEntries();
      syncDailyEntries();
    } else {
      setIsLoading(false);
    }
  }, [user, selectedDate]);

  // useEffect für das Abonnieren von Echtzeit-Updates
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (user) {
      unsubscribe = subscribeToDailyEntries(
        user.id,
        (payload) => {
          console.log('New daily entry received:', payload);
          loadEntries();
          if (payload.new && payload.new.user_id !== user.id) {
            Alert.alert(
              'Neuer Eintrag',
              'Ein neuer Alltag-Eintrag wurde von einem verbundenen Benutzer hinzugefügt.',
              [{ text: 'OK' }]
            );
          }
        },
        (payload) => {
          console.log('Daily entry updated:', payload);
          loadEntries();
        },
        (payload) => {
          console.log('Daily entry deleted:', payload);
          loadEntries();
        }
      );
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const syncDailyEntries = async () => {
    try {
      console.log('Starting daily entries sync...');
      setIsLoading(true);

      const result = await syncAllExistingDailyEntries();
      console.log('Daily entries sync result:', result);

      if (result.success) {
        loadEntries();
        if (result.syncedCount && result.syncedCount > 0) {
          const linkedUserNames = result.linkedUsers
            .map((user: any) => user.firstName)
            .join(', ');

          Alert.alert(
            'Synchronisierung',
            `Deine Alltag-Einträge wurden mit ${linkedUserNames} synchronisiert.`
          );
        }
      }
    } catch (err) {
      console.error('Error syncing daily entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      console.log('Loading entries for date:', selectedDate);

      const { data, error } = await getDailyEntries(undefined, selectedDate);
      if (error) {
        console.error('Error loading daily entries:', error);
      } else if (data) {
        console.log(`Loaded ${data.length} entries`);
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to load daily entries:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncDailyEntries();
      await loadEntries();
    } catch (error) {
      console.error('Error during refresh:', error);
      setRefreshing(false);
    }
  };

  const handleSaveEntry = async (entryData: {
    entry_type: 'feeding' | 'sleep' | 'diaper' | 'other';
    start_time: string;
    end_time?: string;
    notes?: string;
    duration: number;
  }) => {
    try {
      const newEntry: DailyEntry = {
        entry_date: selectedDate.toISOString(),
        entry_type: entryData.entry_type,
        start_time: entryData.start_time,
        end_time: entryData.end_time,
        notes: entryData.notes || ''
      };

      const { error } = await saveDailyEntry(newEntry);
      if (error) {
        console.error('Error saving daily entry:', error);
        Alert.alert('Fehler', 'Der Eintrag konnte nicht gespeichert werden.');
      } else {
        Alert.alert('Erfolg', 'Eintrag erfolgreich gespeichert.');
        loadEntries();
      }
    } catch (err) {
      console.error('Failed to save daily entry:', err);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht gespeichert werden.');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      Alert.alert(
        'Eintrag löschen',
        'Möchtest du diesen Eintrag wirklich löschen?',
        [
          {
            text: 'Abbrechen',
            style: 'cancel'
          },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: async () => {
              const { error } = await deleteDailyEntry(id);
              if (error) {
                console.error('Error deleting daily entry:', error);
                Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
              } else {
                Alert.alert('Erfolg', 'Eintrag erfolgreich gelöscht.');
                loadEntries();
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Failed to delete daily entry:', err);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
    }
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  // Quick Action Handler
  const handleQuickAction = (type: 'feeding' | 'diaper' | 'other', subType?: string) => {
    setSelectedActivityType(type);
    setShowInputModal(true);
  };

  // Berechne Statistiken
  const getStatistics = () => {
    const today = new Date();
    const todayEntries = entries.filter(entry => {
      if (!entry.entry_date) return false;
      const entryDate = new Date(entry.entry_date);
      return entryDate.toDateString() === today.toDateString();
    });

    const feedingCount = todayEntries.filter(entry => entry.entry_type === 'feeding').length;
    const diaperCount = todayEntries.filter(entry => entry.entry_type === 'diaper').length;

    const lastDiaper = todayEntries
      .filter(entry => entry.entry_type === 'diaper' && entry.start_time)
      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime())[0];

    return {
      feedingCount,
      diaperCount,
      lastDiaper: lastDiaper && lastDiaper.start_time ? new Date(lastDiaper.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Nie'
    };
  };

  const stats = getStatistics();

  // Rendere Header
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <IconSymbol name="chevron.left" size={24} color="#4A332E" />
      </TouchableOpacity>
      
      <View style={styles.titleContainer}>
        <ThemedText style={styles.title}>Unser Tag</ThemedText>
        <ThemedText style={styles.subtitle}>Euer Tag – voller kleiner Meilensteine ✨</ThemedText>
      </View>
      
      <View style={styles.headerSpacer} />
    </View>
  );

  // Rendere Zeitraum-Selektor
  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {(['Tag', 'Woche', 'Monat'] as const).map((range) => (
        <TouchableOpacity
          key={range}
          style={[
            styles.timeRangeButton,
            timeRange === range && styles.activeTimeRangeButton
          ]}
          onPress={() => setTimeRange(range)}
        >
          <ThemedText style={[
            styles.timeRangeText,
            timeRange === range && styles.activeTimeRangeText
          ]}>
            {range}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Rendere Quick Actions
  const renderQuickActions = () => {
    const quickActionsData = [
      [
        { icon: '👩‍🍼', label: 'Stillen', type: 'feeding' as const, subType: 'breastfeeding' },
        { icon: '🍼', label: 'Fläschchen', type: 'feeding' as const, subType: 'bottle' },
        { icon: '🥄', label: 'Beikost', type: 'feeding' as const, subType: 'solid' }
      ],
      [
        { icon: '💧', label: 'Nass', type: 'diaper' as const, subType: 'wet' },
        { icon: '💩', label: 'Voll', type: 'diaper' as const, subType: 'dirty' },
        { icon: '🌊', label: 'Beides', type: 'diaper' as const, subType: 'both' }
      ]
    ];

    return (
      <View style={styles.quickActionsContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const pageIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setActiveQuickActionPage(pageIndex);
          }}
        >
          {quickActionsData.map((page, pageIndex) => (
            <View key={pageIndex} style={[styles.quickActionsPage, { width: screenWidth }]}>
              {page.map((action, actionIndex) => (
                <TouchableOpacity
                  key={actionIndex}
                  style={styles.quickActionButton}
                  onPress={() => handleQuickAction(action.type, action.subType)}
                >
                  <View style={styles.liquidGlassWrapper}>
                    <BlurView 
                      intensity={25} 
                      tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                      style={styles.liquidGlassBackground}
                    >
                      <View style={styles.quickActionCircle}>
                        <ThemedText style={styles.emojiIcon}>{action.icon}</ThemedText>
                      </View>
                    </BlurView>
                  </View>
                  <ThemedText style={styles.quickActionLabel}>{action.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
        
        {/* Page Indicator */}
        <View style={styles.pageIndicator}>
          {quickActionsData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.pageIndicatorDot,
                activeQuickActionPage === index && styles.activePageIndicatorDot
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  // Rendere Kennzahlen-Karten
  const renderStatCards = () => (
    <View style={styles.statCardsContainer}>
      <View style={[styles.statCard, styles.feedingCard]}>
        <View style={styles.statCardHeader}>
          <IconSymbol name="cup.and.saucer" size={20} color="#4A332E" />
          <ThemedText style={styles.statCardTitle}>Fütterung</ThemedText>
        </View>
        <ThemedText style={styles.statCardNumber}>{stats.feedingCount}</ThemedText>
        <ThemedText style={styles.statCardSubtext}>
          {stats.feedingCount}x Stillen • 0x Flasche
        </ThemedText>
      </View>

      <View style={[styles.statCard, styles.diaperCard]}>
        <View style={styles.statCardHeader}>
          <IconSymbol name="repeat" size={20} color="#4A332E" />
          <ThemedText style={styles.statCardTitle}>Wickeln</ThemedText>
        </View>
        <ThemedText style={styles.statCardNumber}>{stats.diaperCount}</ThemedText>
        <ThemedText style={styles.statCardSubtext}>
          Letzter: {stats.lastDiaper}
        </ThemedText>
      </View>
    </View>
  );

  // Rendere Timeline
  const renderTimeline = () => (
    <View style={styles.timelineContainer}>
      <ThemedText style={styles.timelineTitle}>Timeline</ThemedText>
      
      {entries.length > 0 ? (
        entries
          .filter(entry => entry.start_time)
          .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime())
          .slice(0, 5)
          .map((entry, index) => (
            <View key={entry.id || index} style={styles.timelineEntry}>
              <ThemedText style={styles.timelineIcon}>
                {entry.entry_type === 'feeding' ? '👩‍🍼' : 
                 entry.entry_type === 'diaper' ? '💧' : '📝'}
              </ThemedText>
              <ThemedText style={styles.timelineText}>
                {entry.entry_type === 'feeding' ? 'Stillen' :
                 entry.entry_type === 'diaper' ? 'Wickeln' : 'Sonstiges'}
              </ThemedText>
              <ThemedText style={styles.timelineTime}>
                {entry.start_time ? new Date(entry.start_time).toLocaleTimeString('de-DE', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }) : '--:--'}
              </ThemedText>
            </View>
          ))
      ) : (
        <View style={styles.emptyTimeline}>
          <ThemedText style={styles.emptyTimelineText}>
            Noch keine Einträge für heute vorhanden.
          </ThemedText>
        </View>
      )}
    </View>
  );

  // Rendere Tagesanalyse
  const renderDayAnalysis = () => (
    <View style={styles.dayAnalysisContainer}>
      <ThemedText style={styles.dayAnalysisTitle}>Tagesanalyse kompakt</ThemedText>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '30%' }]} />
      </View>
    </View>
  );

  return (
    <ThemedBackground style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
          
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#8458DC']}
                tintColor="#8458DC"
                title="Aktualisiere..."
                titleColor="#4A332E"
              />
            }
          >
            {renderHeader()}
            {renderTimeRangeSelector()}
            {renderQuickActions()}
            {renderStatCards()}
            {renderTimeline()}
            {renderDayAnalysis()}
          </ScrollView>

          {/* DateTimePicker */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          {/* ActivityInputModal */}
          <ActivityInputModal
            visible={showInputModal}
            activityType={selectedActivityType}
            onClose={() => setShowInputModal(false)}
            onSave={handleSaveEntry}
          />
        </SafeAreaView>
      </GestureHandlerRootView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  scrollView: {
    flex: 1,
  },

  // Header Styles
  header: {
    height: 80,
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A332E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8C7569',
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },

  // Zeitraum-Selektor Styles
  timeRangeContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  timeRangeButton: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#E5E0D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTimeRangeButton: {
    backgroundColor: '#8458DC',
  },
  timeRangeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A332E',
  },
  activeTimeRangeText: {
    color: '#FFFFFF',
  },

  // Quick Actions Styles
  quickActionsContainer: {
    height: 120,
    marginTop: 16,
  },
  quickActionsPage: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  liquidGlassWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  liquidGlassBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  quickActionCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emojiIcon: {
    fontSize: 32,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C1810',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 16,
    marginTop: 8,
  },
  pageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCCCCC',
    marginHorizontal: 4,
  },
  activePageIndicatorDot: {
    backgroundColor: '#8458DC',
  },

  // Kennzahlen-Karten Styles
  statCardsContainer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  feedingCard: {
    backgroundColor: 'rgba(212, 158, 158, 0.2)',
  },
  diaperCard: {
    backgroundColor: 'rgba(173, 205, 226, 0.2)',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4A332E',
    marginLeft: 4,
  },
  statCardNumber: {
    fontSize: 48,
    fontWeight: '600',
    color: '#4A332E',
    textAlign: 'center',
    marginVertical: 8,
  },
  statCardSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8C7569',
    textAlign: 'center',
    marginTop: 4,
  },

  // Timeline Styles
  timelineContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A332E',
    marginBottom: 8,
  },
  timelineEntry: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timelineIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  timelineText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#4A332E',
    flex: 1,
  },
  timelineTime: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8C7569',
  },
  emptyTimeline: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
  },
  emptyTimelineText: {
    fontSize: 14,
    color: '#8C7569',
    textAlign: 'center',
  },

  // Tagesanalyse Styles
  dayAnalysisContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  dayAnalysisTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A332E',
    marginBottom: 8,
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E0D9',
    overflow: 'hidden',
  },
  progressFill: {
    height: 12,
    backgroundColor: '#8458DC',
  },
});