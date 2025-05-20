import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, SafeAreaView, StatusBar, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedBackground } from '@/components/ThemedBackground';
import { getDailyEntries, saveDailyEntry, deleteDailyEntry, DailyEntry } from '@/lib/baby';
import DateTimePicker from '@react-native-community/datetimepicker';
import ActivitySelector from '@/components/ActivitySelector';
import ActivityInputModal from '@/components/ActivityInputModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TimelineView from '@/components/TimelineView';
import ActivityCard from '@/components/ActivityCard';
import WeekScroller from '@/components/WeekScroller';
import ViewDropdown from '@/components/ViewDropdown';
import EmptyState from '@/components/EmptyState';
import DailySummary from '@/components/DailySummary';
import { syncAllExistingDailyEntries } from '@/lib/syncDailyEntries';
import { subscribeToDailyEntries } from '@/lib/realtime';
import Header from '@/components/Header';

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
  // Filtertabs wurden entfernt

  // State for activity selector and modal
  const [showActivitySelector, setShowActivitySelector] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'diaper' | 'other'>('feeding');

  // State für die verschiedenen Ansichten
  const [viewType, setViewType] = useState<'day' | 'timeline' | 'week'>('day');

  // useEffect für das Laden der Einträge bei Änderung des Datums
  useEffect(() => {
    if (user) {
      loadEntries();
      // Synchronisiere Alltag-Einträge beim Laden der Seite
      syncDailyEntries();
    } else {
      setIsLoading(false);
    }
  }, [user, selectedDate]);

  // useEffect für das Abonnieren von Echtzeit-Updates
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (user) {
      // Abonniere Änderungen an der baby_daily Tabelle
      unsubscribe = subscribeToDailyEntries(
        user.id,
        // Callback für neue Einträge
        (payload) => {
          console.log('New daily entry received:', payload);
          // Lade die Einträge neu, wenn ein neuer Eintrag hinzugefügt wurde
          loadEntries();

          // Zeige eine Benachrichtigung, wenn der Eintrag von einem anderen Benutzer stammt
          if (payload.new && payload.new.user_id !== user.id) {
            Alert.alert(
              'Neuer Eintrag',
              'Ein neuer Alltag-Eintrag wurde von einem verbundenen Benutzer hinzugefügt.',
              [{ text: 'OK' }]
            );
          }
        },
        // Callback für aktualisierte Einträge
        (payload) => {
          console.log('Daily entry updated:', payload);
          // Lade die Einträge neu, wenn ein Eintrag aktualisiert wurde
          loadEntries();
        },
        // Callback für gelöschte Einträge
        (payload) => {
          console.log('Daily entry deleted:', payload);
          // Lade die Einträge neu, wenn ein Eintrag gelöscht wurde
          loadEntries();
        }
      );
    }

    // Cleanup-Funktion
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Synchronisiere Alltag-Einträge mit verbundenen Nutzern
  const syncDailyEntries = async () => {
    try {
      console.log('Starting daily entries sync...');
      setIsLoading(true);

      const result = await syncAllExistingDailyEntries();
      console.log('Daily entries sync result:', result);

      if (result.success) {
        // Wenn Einträge synchronisiert wurden, lade die Einträge neu
        loadEntries();

        // Zeige Erfolgsmeldung, wenn Einträge synchronisiert wurden
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



  // Funktion zum Laden der Einträge
  const loadEntries = async () => {
    try {
      setIsLoading(true);
      console.log('Loading entries for date:', selectedDate);

      // Keine Filterung nach Typ mehr
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
      setRefreshing(false); // Beende das Refreshing, wenn die Daten geladen sind
    }
  };

  // Funktion für Pull-to-Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Synchronisiere Alltag-Einträge
      await syncDailyEntries();
      // Lade die Einträge neu
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
      // Create a new entry with the current date
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
        // Zeige Erfolgsmeldung
        Alert.alert('Erfolg', 'Eintrag erfolgreich gespeichert.');

        // Lade die Einträge neu
        // Hinweis: Die Echtzeit-Funktionalität wird automatisch den Eintrag bei allen verbundenen Benutzern aktualisieren
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
                // Zeige Erfolgsmeldung
                Alert.alert('Erfolg', 'Eintrag erfolgreich gelöscht.');

                // Lade die Einträge neu
                // Hinweis: Die Echtzeit-Funktionalität wird automatisch den Eintrag bei allen verbundenen Benutzern aktualisieren
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

  // Handler für Ansichtswechsel
  const handleViewChange = (newViewType: 'day' | 'timeline' | 'week') => {
    setViewType(newViewType);
  };

  // Handle activity selection
  const handleActivitySelect = (type: 'feeding' | 'diaper' | 'other') => {
    setSelectedActivityType(type);
    setShowActivitySelector(false);
    setShowInputModal(true);
  };

  // Toggle activity selector
  const toggleActivitySelector = () => {
    setShowActivitySelector(!showActivitySelector);
  };

  // Rendere die Ansichtsauswahl mit dem Dropdown
  const renderViewSelector = () => {
    return (
      <ViewDropdown activeView={viewType} onViewChange={handleViewChange} />
    );
  };

  // Rendere die entsprechende Ansicht basierend auf viewType
  const renderContent = () => {
    switch (viewType) {
      case 'day':
        return (
          <>
            <DailySummary entries={entries} />

            <FlatList
              data={entries}
              renderItem={({ item }) => (
                <ActivityCard entry={item} onDelete={handleDeleteEntry} />
              )}
              keyExtractor={(item) => item.id || Math.random().toString()}
              contentContainerStyle={styles.entriesContainer}
              ListEmptyComponent={
                <EmptyState type="day" />
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#7D5A50']}
                  tintColor={theme.text}
                  title="Aktualisiere..."
                  titleColor={theme.text}
                />
              }
            />
          </>
        );
      case 'timeline':
        return (
          <>
            <DailySummary entries={entries} />
            {entries.length > 0 ? (
              <TimelineView
                entries={entries}
                onDeleteEntry={handleDeleteEntry}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#7D5A50']}
                    tintColor={theme.text}
                    title="Aktualisiere..."
                    titleColor={theme.text}
                  />
                }
              />
            ) : (
              <EmptyState type="timeline" />
            )}
          </>
        );
      case 'week':
        return (
          <>
            <DailySummary entries={entries} />
            <WeekScroller selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            {entries.length === 0 && (
              <View style={styles.emptyOverlay}>
                <EmptyState type="week" message="Keine Einträge in dieser Woche vorhanden." />
              </View>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedBackground style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
          
          <Header 
            title="Alltag" 
            subtitle="Dokumentiere den Tagesablauf deines Babys" 
          />
          
          {/* Ansichtsauswahl */}
          {renderViewSelector()}

          {/* Hauptinhalt */}
          {renderContent()}

          {/* DateTimePicker */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          {/* ActivitySelector Modal */}
          <ActivitySelector
            visible={showActivitySelector}
            onSelect={handleActivitySelect}
          />

          {/* ActivityInputModal */}
          <ActivityInputModal
            visible={showInputModal}
            activityType={selectedActivityType}
            onClose={() => setShowInputModal(false)}
            onSave={handleSaveEntry}
          />

          {/* Plus-Button (FAB) */}
          <TouchableOpacity 
            style={[styles.fab, { backgroundColor: Colors[colorScheme].tint }]}
            onPress={toggleActivitySelector}
          >
            <IconSymbol name="plus" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>
      </GestureHandlerRootView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 5,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    flex: 1,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9500', // Akzentfarbe (entspricht dem Community-Tab)
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 90, // Exakt gleiche Höhe wie Community-Tab
    right: 20, // Genau gleicher horizontaler Abstand wie in Community
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 999,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  dateButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  dateDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Tabs wurden in separate Komponente ausgelagert
  // Styles wurden in separate Komponenten ausgelagert
  newEntryCard: {
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  typeButton: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '22%',
  },
  selectedTypeButton: {
    borderColor: '#7D5A50',
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  typeButtonText: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  timeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#7D5A50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  entriesContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100, // Platz für den FAB
  },
  // Karten-Styles wurden in separate Komponente ausgelagert
  emptyContainer: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    color: '#666666',
  },
  emptyOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  addEntryText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#7D5A50',
  },
});