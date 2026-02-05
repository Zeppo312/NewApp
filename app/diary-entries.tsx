import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, TextInput, Alert, SafeAreaView, StatusBar, FlatList, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getDiaryEntries, saveDiaryEntry, deleteDiaryEntry, DiaryEntry, getBabyInfo } from '@/lib/baby';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import Header from '@/components/Header';

export default function DiaryEntriesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? Colors.dark.text : '#7D5A50';
  const { user } = useAuth();
  const { activeBabyId } = useActiveBaby();

  // Zustand für Tagebucheinträge
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntry, setNewEntry] = useState<DiaryEntry>({
    entry_date: new Date().toISOString(),
    content: '',
    mood: 'happy'
  });
  const [babyName, setBabyName] = useState('');
  const [babyPhoto, setBabyPhoto] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Laden der Tagebucheinträge
  useEffect(() => {
    if (user) {
      loadEntries();
      loadBabyInfo();
    } else {
      setLoading(false);
    }
  }, [user, activeBabyId]);

  const loadBabyInfo = async () => {
    try {
      const { data, error } = await getBabyInfo(activeBabyId ?? undefined);
      if (error) {
        console.error('Error loading baby info:', error);
      } else if (data) {
        setBabyName(data.name || '');
        setBabyPhoto(data.photo_url || null);
      }
    } catch (err) {
      console.error('Failed to load baby info:', err);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await getDiaryEntries(activeBabyId ?? undefined);
      if (error) {
        console.error('Error loading diary entries:', error);
        Alert.alert('Fehler', 'Die Tagebucheinträge konnten nicht geladen werden.');
      } else if (data) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to load diary entries:', err);
      Alert.alert('Fehler', 'Die Tagebucheinträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
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
            try {
              const { error } = await deleteDiaryEntry(id, activeBabyId ?? undefined);
              if (error) {
                console.error('Error deleting entry:', error);
                Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
              } else {
                // Eintrag aus der lokalen Liste entfernen
                setEntries(entries.filter(entry => entry.id !== id));
                Alert.alert('Erfolg', 'Der Eintrag wurde erfolgreich gelöscht.');
              }
            } catch (err) {
              console.error('Failed to delete entry:', err);
              Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
            }
          }
        }
      ]
    );
  };

  const handleSaveEntry = async () => {
    try {
      if (!newEntry.content.trim()) {
        Alert.alert('Fehler', 'Bitte gib einen Text für deinen Eintrag ein.');
        return;
      }

      const { data, error } = await saveDiaryEntry(newEntry, activeBabyId ?? undefined);
      if (error) {
        console.error('Error saving entry:', error);
        Alert.alert('Fehler', 'Der Eintrag konnte nicht gespeichert werden.');
      } else {
        // Neuen Eintrag zur lokalen Liste hinzufügen und Liste neu laden
        await loadEntries();
        setShowNewEntry(false);
        setNewEntry({
          entry_date: new Date().toISOString(),
          content: '',
          mood: 'happy'
        });
        Alert.alert('Erfolg', 'Der Eintrag wurde erfolgreich gespeichert.');
      }
    } catch (err) {
      console.error('Failed to save entry:', err);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht gespeichert werden.');
    }
  };

  const pickImage = async () => {
    try {
      // Berechtigungen anfordern
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Wir benötigen die Berechtigung, auf deine Fotos zuzugreifen.');
        return;
      }

      // Bild auswählen
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Reduzierte Qualität für kleinere Dateigröße
        base64: true, // Base64-Daten anfordern
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Wenn base64 nicht direkt verfügbar ist, konvertieren wir das Bild
        if (!asset.base64) {
          console.log('Base64 nicht direkt verfügbar, konvertiere Bild...');
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const reader = new FileReader();

            // Promise für FileReader erstellen
            const base64Data = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Base64-Daten direkt als photo_url verwenden
            setNewEntry({
              ...newEntry,
              photo_url: base64Data as string
            });

            console.log('Bild erfolgreich in Base64 konvertiert');
          } catch (convError) {
            console.error('Fehler bei der Konvertierung:', convError);
            Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
          }
        } else {
          // Base64-Daten direkt verwenden
          const base64Data = `data:image/jpeg;base64,${asset.base64}`;
          setNewEntry({
            ...newEntry,
            photo_url: base64Data
          });
          console.log('Base64-Daten direkt verwendet');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Es ist ein Fehler beim Auswählen des Bildes aufgetreten.');
    }
  };

  // Render-Funktion für die Stimmungs-Icons
  const renderMoodIcon = (mood: string) => {
    switch (mood) {
      case 'happy':
        return <IconSymbol name="face.smiling" size={20} color="#FFD700" />;
      case 'sad':
        return <IconSymbol name="face.smiling.fill" size={20} color="#6495ED" />;
      case 'angry':
        return <IconSymbol name="face.dashed" size={20} color="#FF6347" />;
      case 'tired':
        return <IconSymbol name="face.smiling" size={20} color="#8A2BE2" />;
      default:
        return <IconSymbol name="face.dashed" size={20} color="#A9A9A9" />;
    }
  };

  // Render-Funktion für einen einzelnen Tagebucheintrag
  const renderEntry = ({ item }: { item: DiaryEntry }) => {
    const date = new Date(item.entry_date);

    return (
      <ThemedView style={styles.entryCard} lightColor="#fff" darkColor="#333">
        <View style={styles.entryHeader}>
          <View style={styles.entryInfo}>
            <ThemedText style={styles.entryDate}>
              {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </ThemedText>
            {item.mood && (
              <View style={styles.moodContainer}>
                {renderMoodIcon(item.mood)}
              </View>
            )}
          </View>

          <View style={styles.entryActions}>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={() => {
                // Favoriten-Funktion hier implementieren
                Alert.alert('Info', 'Favoriten-Funktion wird bald verfügbar sein.');
              }}
            >
              <IconSymbol name="bookmark" size={20} color="#FFB6C1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => item.id && handleDeleteEntry(item.id)}
            >
              <IconSymbol name="trash" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>

        <ThemedText style={styles.entryContent}>
          {item.content}
        </ThemedText>

        {item.photo_url && (
          <Image source={{ uri: item.photo_url }} style={styles.entryImage} />
        )}
      </ThemedView>
    );
  };

  // Filterfunktion für die Einträge
  const getFilteredEntries = () => {
    switch (activeFilter) {
      case 'milestones':
        return entries.filter(entry => entry.milestone_id);
      case 'photos':
        return entries.filter(entry => entry.photo_url);
      case 'favorites':
        // Hier würde die Logik für Favoriten kommen
        return entries.filter(entry => false); // Platzhalter
      default:
        return entries;
    }
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header 
          title={babyName ? `${babyName.split(' ')[0]}s Tagebuch` : 'Tagebuch'} 
          showBackButton 
          rightContent={
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowNewEntry(true)}
            >
              <IconSymbol name="plus" size={24} color={theme.text} />
            </TouchableOpacity>
          }
        />

        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'all' && styles.activeFilterTab]}
              onPress={() => setActiveFilter('all')}
            >
              <ThemedText style={[styles.filterText, { color: activeFilter === 'all' ? '#FFFFFF' : textColor }]}>
                Alle
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'milestones' && styles.activeFilterTab]}
              onPress={() => setActiveFilter('milestones')}
            >
              <ThemedText style={[styles.filterText, { color: activeFilter === 'milestones' ? '#FFFFFF' : textColor }]}>
                Meilensteine
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'photos' && styles.activeFilterTab]}
              onPress={() => setActiveFilter('photos')}
            >
              <ThemedText style={[styles.filterText, { color: activeFilter === 'photos' ? '#FFFFFF' : textColor }]}>
                Fotos
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'favorites' && styles.activeFilterTab]}
              onPress={() => setActiveFilter('favorites')}
            >
              <ThemedText style={[styles.filterText, { color: activeFilter === 'favorites' ? '#FFFFFF' : textColor }]}>
                Favoriten
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ThemedText>Lade Einträge...</ThemedText>
          </View>
        ) : (
          <FlatList
            data={getFilteredEntries()}
            renderItem={renderEntry}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.entriesList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <IconSymbol name="book.closed" size={50} color={theme.tabIconDefault} />
                <ThemedText style={styles.emptyText}>
                  Keine Einträge gefunden.
                </ThemedText>
                <ThemedText style={styles.emptySubtext}>
                  Tippe auf + um deinen ersten Eintrag zu erstellen.
                </ThemedText>
              </View>
            }
          />
        )}

        {/* Highlight-Fotos Karussell */}
        {entries.filter(entry => entry.photo_url).length > 0 && (
          <View style={styles.highlightsContainer}>
            <ThemedText style={[styles.highlightsTitle, { color: textColor }]}>Highlight-Fotos:</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.highlightsScroll}>
              {entries
                .filter(entry => entry.photo_url)
                .slice(0, 10) // Nur die ersten 10 Fotos anzeigen
                .map((entry, index) => (
                  <TouchableOpacity key={index} style={styles.highlightItem}>
                    <Image source={{ uri: entry.photo_url || '' }} style={styles.highlightImage} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        )}

        {/* Modal für neuen Eintrag */}
        <Modal
          visible={showNewEntry}
          transparent
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalContainer} lightColor="#fff" darkColor="#333">
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Neuer Tagebucheintrag</ThemedText>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowNewEntry(false);
                    setNewEntry({
                      entry_date: new Date().toISOString(),
                      content: '',
                      mood: 'happy'
                    });
                  }}
                >
                  <IconSymbol name="xmark" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.moodSelector}>
                <ThemedText style={styles.moodLabel}>Stimmung:</ThemedText>
                <View style={styles.moodButtons}>
                  <TouchableOpacity
                    style={[styles.moodButton, newEntry.mood === 'happy' && styles.selectedMoodButton]}
                    onPress={() => setNewEntry({ ...newEntry, mood: 'happy' })}
                  >
                    <IconSymbol name="face.smiling" size={24} color="#FFD700" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moodButton, newEntry.mood === 'sad' && styles.selectedMoodButton]}
                    onPress={() => setNewEntry({ ...newEntry, mood: 'sad' })}
                  >
                    <IconSymbol name="face.smiling.fill" size={24} color="#6495ED" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moodButton, newEntry.mood === 'angry' && styles.selectedMoodButton]}
                    onPress={() => setNewEntry({ ...newEntry, mood: 'angry' })}
                  >
                    <IconSymbol name="face.dashed" size={24} color="#FF6347" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moodButton, newEntry.mood === 'tired' && styles.selectedMoodButton]}
                    onPress={() => setNewEntry({ ...newEntry, mood: 'tired' })}
                  >
                    <IconSymbol name="face.smiling" size={24} color="#8A2BE2" />
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={[styles.contentInput, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}
                value={newEntry.content}
                onChangeText={(text) => setNewEntry({ ...newEntry, content: text })}
                placeholder="Was ist heute passiert?"
                placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#888888'}
                multiline
              />

              {newEntry.photo_url ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: newEntry.photo_url }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => setNewEntry({ ...newEntry, photo_url: undefined })}
                  >
                    <IconSymbol name="xmark.circle.fill" size={24} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={pickImage}
                >
                  <IconSymbol name="photo" size={24} color="#9DBEBB" />
                  <ThemedText style={styles.addPhotoText}>Foto hinzufügen</ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveEntry}
              >
                <ThemedText style={styles.saveButtonText}>Speichern</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </Modal>
      </SafeAreaView>
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
  addButton: {
    padding: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeFilterTab: {
    backgroundColor: '#9DBEBB',
  },
  filterText: {
    fontSize: 14,
    color: '#7D5A50',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entriesList: {
    padding: 16,
    paddingBottom: 100, // Extra Platz für das Highlight-Karussell
  },
  entryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryDate: {
    fontSize: 14,
    marginRight: 8,
  },
  moodContainer: {
    marginLeft: 4,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 4,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  entryContent: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  entryImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  highlightsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  highlightsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#7D5A50',
  },
  highlightsScroll: {
    flexDirection: 'row',
  },
  highlightItem: {
    marginRight: 12,
  },
  highlightImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  moodSelector: {
    marginBottom: 16,
  },
  moodLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  moodButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  moodButton: {
    padding: 12,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedMoodButton: {
    backgroundColor: 'rgba(157, 190, 187, 0.3)',
    borderWidth: 2,
    borderColor: '#9DBEBB',
  },
  contentInput: {
    height: 120,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  photoPreviewContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#9DBEBB',
    borderRadius: 8,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addPhotoText: {
    marginLeft: 8,
    color: '#9DBEBB',
  },
  saveButton: {
    backgroundColor: '#9DBEBB',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
