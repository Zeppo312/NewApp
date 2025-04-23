import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, StatusBar, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getDailyEntries, saveDailyEntry, deleteDailyEntry, DailyEntry } from '@/lib/baby';
import DateTimePicker from '@react-native-community/datetimepicker';
import ActivitySelector from '@/components/ActivitySelector';
import ActivityInputModal from '@/components/ActivityInputModal';

export default function DailyOldScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'diaper' | 'sleep' | 'feeding'>('all');

  // State for activity selector and modal
  const [showActivitySelector, setShowActivitySelector] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'sleep' | 'diaper' | 'other'>('feeding');

  useEffect(() => {
    if (user) {
      loadEntries();
    } else {
      setIsLoading(false);
    }
  }, [user, activeTab, selectedDate]);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const type = activeTab === 'all' ? undefined : activeTab;
      const { data, error } = await getDailyEntries(type, selectedDate);
      if (error) {
        console.error('Error loading daily entries:', error);
      } else if (data) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to load daily entries:', err);
    } finally {
      setIsLoading(false);
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
        loadEntries(); // Neu laden, um den neuen Eintrag anzuzeigen
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
                loadEntries(); // Neu laden, um den gelöschten Eintrag zu entfernen
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

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  // Handle activity selection
  const handleActivitySelect = (type: 'feeding' | 'sleep' | 'diaper' | 'other') => {
    setSelectedActivityType(type);
    setShowActivitySelector(false);
    setShowInputModal(true);
  };

  // Toggle activity selector
  const toggleActivitySelector = () => {
    setShowActivitySelector(!showActivitySelector);
  };

  const getEntryTypeIcon = (type: string) => {
    switch (type) {
      case 'diaper':
        return <IconSymbol name="heart.fill" size={24} color="#4CAF50" />;
      case 'sleep':
        return <IconSymbol name="moon.fill" size={24} color="#5C6BC0" />;
      case 'feeding':
        return <IconSymbol name="drop.fill" size={24} color="#FF9800" />;
      default:
        return <IconSymbol name="star.fill" size={24} color="#9C27B0" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const renderEntry = ({ item }: { item: DailyEntry }) => {
    return (
      <ThemedView style={styles.entryCard} lightColor={theme.card} darkColor={theme.card}>
        <View style={styles.entryHeader}>
          <View style={styles.typeContainer}>
            {getEntryTypeIcon(item.entry_type)}
            <ThemedText style={styles.entryType}>
              {item.entry_type === 'diaper' ? 'Wickeln' :
               item.entry_type === 'sleep' ? 'Schlafen' :
               item.entry_type === 'feeding' ? 'Füttern' : 'Sonstiges'}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => item.id && handleDeleteEntry(item.id)}
          >
            <IconSymbol name="trash" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        </View>

        <View style={styles.timeContainer}>
          <ThemedText style={styles.timeText}>
            {item.start_time && formatTime(item.start_time)}
            {item.end_time && ` - ${formatTime(item.end_time)}`}
          </ThemedText>
        </View>

        {item.notes && (
          <ThemedText style={styles.entryNotes}>
            {item.notes}
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <ImageBackground
      source={require('@/assets/images/Background_Hell.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/(tabs)/home')}
          >
            <IconSymbol name="chevron.left" size={24} color="#E57373" />
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>
            Alltag
          </ThemedText>

          {/* Plus-Button wurde nach unten rechts verschoben */}
          <View style={{width: 40}} />
        </View>

        <View style={styles.dateSelector}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              const prevDate = new Date(selectedDate);
              prevDate.setDate(prevDate.getDate() - 1);
              setSelectedDate(prevDate);
            }}
          >
            <IconSymbol name="chevron.left" size={20} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateDisplay}
            onPress={() => setShowDatePicker(true)}
          >
            <ThemedText style={styles.dateText}>
              {selectedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              const nextDate = new Date(selectedDate);
              nextDate.setDate(nextDate.getDate() + 1);
              setSelectedDate(nextDate);
            }}
          >
            <IconSymbol name="chevron.right" size={20} color={theme.text} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <ThemedText
              style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}
              lightColor={activeTab === 'all' ? '#FFFFFF' : theme.text}
              darkColor={activeTab === 'all' ? '#FFFFFF' : theme.text}
            >
              Alle
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'feeding' && styles.activeTab]}
            onPress={() => setActiveTab('feeding')}
          >
            <ThemedText
              style={[styles.tabText, activeTab === 'feeding' && styles.activeTabText]}
              lightColor={activeTab === 'feeding' ? '#FFFFFF' : theme.text}
              darkColor={activeTab === 'feeding' ? '#FFFFFF' : theme.text}
            >
              Füttern
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'sleep' && styles.activeTab]}
            onPress={() => setActiveTab('sleep')}
          >
            <ThemedText
              style={[styles.tabText, activeTab === 'sleep' && styles.activeTabText]}
              lightColor={activeTab === 'sleep' ? '#FFFFFF' : theme.text}
              darkColor={activeTab === 'sleep' ? '#FFFFFF' : theme.text}
            >
              Schlafen
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'diaper' && styles.activeTab]}
            onPress={() => setActiveTab('diaper')}
          >
            <ThemedText
              style={[styles.tabText, activeTab === 'diaper' && styles.activeTabText]}
              lightColor={activeTab === 'diaper' ? '#FFFFFF' : theme.text}
              darkColor={activeTab === 'diaper' ? '#FFFFFF' : theme.text}
            >
              Wickeln
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Activity Input Modal */}
        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          onClose={() => setShowInputModal(false)}
          onSave={handleSaveEntry}
        />

        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.entriesContainer}
          ListEmptyComponent={
            <ThemedView style={styles.emptyContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
              <ThemedText style={styles.emptyText}>
                Keine Einträge für diesen Tag vorhanden. Tippe auf das Plus-Symbol, um einen neuen Eintrag zu erstellen.
              </ThemedText>
            </ThemedView>
          }
        />

        {/* Activity Selector */}
        <ActivitySelector
          visible={showActivitySelector}
          onSelect={handleActivitySelect}
        />

        {/* Floating Action Button (FAB) unten rechts */}
        <TouchableOpacity
          style={styles.fab}
          onPress={toggleActivitySelector}
        >
          <IconSymbol
            name={showActivitySelector ? "xmark" : "plus"}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </SafeAreaView>
    </ImageBackground>
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    flex: 1,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#7D5A50',
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 90, // Weiter nach oben verschoben, um nicht von der Navigationsleiste verdeckt zu werden
    right: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 999,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 20,
  },
  dateButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  dateDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#7D5A50',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
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
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  entryCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryType: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  deleteButton: {
    padding: 5,
  },
  timeContainer: {
    marginBottom: 10,
  },
  timeText: {
    fontSize: 14,
  },
  entryNotes: {
    fontSize: 16,
    lineHeight: 24,
  },
  emptyContainer: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});