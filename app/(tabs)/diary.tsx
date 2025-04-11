import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, TextInput, Alert, ImageBackground, SafeAreaView, StatusBar, FlatList, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  getDiaryEntries,
  saveDiaryEntry,
  deleteDiaryEntry,
  DiaryEntry,
  getBabyInfo,
  getDevelopmentPhases,
  getCurrentPhase,
  getMilestonesByPhase,
  toggleMilestone,
  getPhaseProgress,
  DevelopmentPhase,
  Milestone
} from '@/lib/baby';
import { setCurrentPhase as updateCurrentPhase } from '@/lib/baby';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { differenceInDays, differenceInMonths, differenceInWeeks } from 'date-fns';

export default function DiaryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();

  // Zustand für Tagebucheinträge
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntry, setNewEntry] = useState<DiaryEntry>({
    entry_date: new Date().toISOString(),
    content: '',
    mood: 'happy'
  });

  // Zustand für Entwicklungsphasen und Meilensteine
  const [babyBirthDate, setBabyBirthDate] = useState<Date | null>(null);
  const [phases, setPhases] = useState<DevelopmentPhase[]>([]);
  const [currentPhase, setCurrentPhase] = useState<DevelopmentPhase | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [phaseProgress, setPhaseProgress] = useState({ progress: 0, completedCount: 0, totalCount: 0 });
  const [showPhaseChangeModal, setShowPhaseChangeModal] = useState(false);
  const [nextPhase, setNextPhase] = useState<DevelopmentPhase | null>(null);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Laden der Daten beim Start
  useEffect(() => {
    if (user) {
      loadInitialData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Laden aller benötigten Daten
  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Baby-Informationen laden
      const { data: babyData } = await getBabyInfo();
      if (babyData?.birth_date) {
        setBabyBirthDate(new Date(babyData.birth_date));
      }

      // Entwicklungsphasen laden
      const { data: phasesData } = await getDevelopmentPhases();
      if (phasesData) {
        setPhases(phasesData);
      }

      // Aktuelle Phase laden
      const { data: currentPhaseData } = await getCurrentPhase();
      if (currentPhaseData) {
        setCurrentPhase(currentPhaseData.baby_development_phases);
        setExpandedPhaseId(currentPhaseData.phase_id);

        // Meilensteine für die aktuelle Phase laden
        await loadMilestonesForPhase(currentPhaseData.phase_id);
      }

      // Tagebucheinträge laden
      await loadEntries();
    } catch (err) {
      console.error('Failed to load initial data:', err);
      Alert.alert('Fehler', 'Die Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  // Meilensteine für eine bestimmte Phase laden
  const loadMilestonesForPhase = async (phaseId: string) => {
    try {
      const { data: milestonesData } = await getMilestonesByPhase(phaseId);
      if (milestonesData) {
        setMilestones(milestonesData);
      }

      // Fortschritt berechnen
      const { progress, completedCount, totalCount } = await getPhaseProgress(phaseId);
      setPhaseProgress({ progress, completedCount, totalCount });

      // Prüfen, ob die nächste Phase vorgeschlagen werden sollte (bei 80% Fortschritt)
      if (progress >= 80) {
        const nextPhaseNumber = currentPhase ? currentPhase.phase_number + 1 : 2;
        const nextPhaseData = phases.find(p => p.phase_number === nextPhaseNumber);
        if (nextPhaseData) {
          setNextPhase(nextPhaseData);
          setShowPhaseChangeModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to load milestones:', err);
    }
  };

  // Meilenstein umschalten (erreicht/nicht erreicht)
  const handleToggleMilestone = async (milestone: Milestone) => {
    try {
      const newStatus = !milestone.is_completed;
      await toggleMilestone(milestone.id, newStatus);

      // Meilensteine neu laden, um den aktualisierten Status zu erhalten
      if (expandedPhaseId) {
        await loadMilestonesForPhase(expandedPhaseId);
      }
    } catch (err) {
      console.error('Failed to toggle milestone:', err);
      Alert.alert('Fehler', 'Der Meilenstein konnte nicht aktualisiert werden.');
    }
  };

  // Zur nächsten Phase wechseln
  const handlePhaseChange = async () => {
    if (!nextPhase) return;

    try {
      // Aktuelle Phase in Supabase aktualisieren
      await updateCurrentPhase(nextPhase.id);

      // Lokalen Zustand aktualisieren
      setCurrentPhase(nextPhase);
      setExpandedPhaseId(nextPhase.id);
      await loadMilestonesForPhase(nextPhase.id);
      setShowPhaseChangeModal(false);
    } catch (err) {
      console.error('Failed to change phase:', err);
      Alert.alert('Fehler', 'Die Phase konnte nicht gewechselt werden.');
    }
  };

  // Berechnung des Babyalters
  const calculateBabyAge = () => {
    if (!babyBirthDate) return null;

    const today = new Date();
    const months = differenceInMonths(today, babyBirthDate);
    const weeks = differenceInWeeks(today, babyBirthDate) % 4; // Wochen im aktuellen Monat

    if (months < 1) {
      const days = differenceInDays(today, babyBirthDate);
      return `${days} Tage`;
    } else if (months < 24) {
      return `${months} Monate${weeks > 0 ? `, ${weeks} Wochen` : ''}`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return `${years} Jahr${years > 1 ? 'e' : ''}${remainingMonths > 0 ? `, ${remainingMonths} Monate` : ''}`;
    }
  };

  const loadEntries = async () => {
    try {
      const { data, error } = await getDiaryEntries();
      if (error) {
        console.error('Error loading diary entries:', error);
      } else if (data) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to load diary entries:', err);
    }
  };

  const handleSaveEntry = async () => {
    try {
      if (!newEntry.content.trim()) {
        Alert.alert('Fehler', 'Bitte gib einen Eintrag ein.');
        return;
      }

      const { error } = await saveDiaryEntry(newEntry);
      if (error) {
        console.error('Error saving diary entry:', error);
        Alert.alert('Fehler', 'Der Eintrag konnte nicht gespeichert werden.');
      } else {
        // Zurücksetzen des neuen Eintrags
        setNewEntry({
          entry_date: new Date().toISOString(),
          content: '',
          mood: 'happy'
        });
        setShowNewEntry(false);
        loadEntries(); // Neu laden, um den neuen Eintrag anzuzeigen
      }
    } catch (err) {
      console.error('Failed to save diary entry:', err);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht gespeichert werden.');
    }
  };

  const handleDeleteEntry = async (id?: string) => {
    if (!id) return;

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
              const { error } = await deleteDiaryEntry(id);
              if (error) {
                console.error('Error deleting diary entry:', error);
                Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
              } else {
                loadEntries(); // Neu laden, um den gelöschten Eintrag zu entfernen
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Failed to delete diary entry:', err);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht gelöscht werden.');
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
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;

        // Dateiname und Typ extrahieren
        const fileExt = uri.substring(uri.lastIndexOf('.') + 1);
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `diary-photos/${user?.id}/${fileName}`;

        // Datei in einen Blob umwandeln
        const response = await fetch(uri);
        const blob = await response.blob();

        // Datei zu Supabase Storage hochladen
        const { error } = await supabase.storage
          .from('diary-photos')
          .upload(filePath, blob);

        if (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Fehler', 'Das Bild konnte nicht hochgeladen werden.');
          return;
        }

        // Öffentliche URL für das Bild abrufen
        const { data: publicUrlData } = supabase.storage
          .from('diary-photos')
          .getPublicUrl(filePath);

        // Bild-URL in den Zustand setzen
        setNewEntry({
          ...newEntry,
          photo_url: publicUrlData.publicUrl
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Es ist ein Fehler beim Auswählen des Bildes aufgetreten.');
    }
  };

  const renderMoodIcon = (mood: string) => {
    switch (mood) {
      case 'happy':
        return <IconSymbol name="face.smiling" size={24} color="#FFD700" />;
      case 'neutral':
        return <IconSymbol name="face.dashed" size={24} color="#A9A9A9" />;
      case 'sad':
        return <IconSymbol name="face.smiling.fill" size={24} color="#4682B4" />;
      default:
        return <IconSymbol name="face.smiling" size={24} color="#FFD700" />;
    }
  };

  const renderEntry = ({ item }: { item: DiaryEntry }) => {
    const date = new Date(item.entry_date);

    return (
      <ThemedView style={styles.entryCard} lightColor={theme.card} darkColor={theme.card}>
        <View style={styles.entryHeader}>
          <View style={styles.dateContainer}>
            <ThemedText style={styles.entryDate}>
              {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </ThemedText>
            {item.mood && (
              <View style={styles.moodContainer}>
                {renderMoodIcon(item.mood)}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => item.id && handleDeleteEntry(item.id)}
          >
            <IconSymbol name="trash" size={20} color="#FF6B6B" />
          </TouchableOpacity>
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

  // Render-Funktion für die Meilensteine einer Phase
  const renderMilestones = (phaseMilestones: Milestone[]) => {
    return (
      <View style={styles.milestonesContainer}>
        {phaseMilestones.map((milestone) => (
          <TouchableOpacity
            key={milestone.id}
            style={styles.milestoneItem}
            onPress={() => handleToggleMilestone(milestone)}
          >
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, milestone.is_completed && styles.checkboxChecked]}>
                {milestone.is_completed && (
                  <IconSymbol name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </View>
            <View style={styles.milestoneTextContainer}>
              <ThemedText style={styles.milestoneTitle}>{milestone.title}</ThemedText>
              {milestone.description && (
                <ThemedText style={styles.milestoneDescription}>{milestone.description}</ThemedText>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render-Funktion für den Fortschrittsbalken
  const renderProgressBar = (progress: number, completedCount: number, totalCount: number) => {
    return (
      <View style={styles.progressContainer}>
        <ThemedText style={styles.progressText}>
          {completedCount} von {totalCount} Meilensteinen erreicht ({Math.round(progress)}%)
        </ThemedText>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      </View>
    );
  };

  // Render-Funktion für eine Entwicklungsphase
  const renderPhase = (phase: DevelopmentPhase, isExpanded: boolean, isActive: boolean) => {
    return (
      <ThemedView
        key={phase.id}
        style={[styles.phaseCard, isActive && styles.activePhaseCard]}
        lightColor="#fff"
        darkColor="#333"
      >
        <TouchableOpacity
          style={styles.phaseHeader}
          onPress={() => setExpandedPhaseId(isExpanded ? null : phase.id)}
        >
          <View style={styles.phaseHeaderContent}>
            <ThemedText style={[styles.phaseTitle, isActive && styles.activePhaseTitle]}>
              Phase {phase.phase_number}: {phase.title}
            </ThemedText>
            <ThemedText style={styles.phaseAgeRange}>{phase.age_range}</ThemedText>
          </View>
          <IconSymbol
            name={isExpanded ? "chevron.down" : "chevron.right"}
            size={24}
            color={theme.text}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.phaseContent}>
            {milestones.length > 0 && renderMilestones(milestones)}
            {renderProgressBar(phaseProgress.progress, phaseProgress.completedCount, phaseProgress.totalCount)}

            <View style={styles.phaseEntriesContainer}>
              <ThemedText style={styles.phaseEntriesTitle}>Einträge zu dieser Phase</ThemedText>
              <TouchableOpacity
                style={styles.addEntryButton}
                onPress={() => {
                  setSelectedMilestone(null);
                  setShowNewEntryModal(true);
                }}
              >
                <IconSymbol name="plus" size={18} color="#fff" />
                <ThemedText style={styles.addEntryButtonText}>Eintrag hinzufügen</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ThemedView>
    );
  };

  // Render-Funktion für das Modal zum Phasenwechsel
  const renderPhaseChangeModal = () => {
    if (!nextPhase) return null;

    return (
      <Modal
        visible={showPhaseChangeModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer} lightColor="#fff" darkColor="#333">
            <ThemedText style={styles.modalTitle}>Nächste Entwicklungsphase</ThemedText>
            <ThemedText style={styles.modalText}>
              Glückwunsch! Dein Baby hat die meisten Meilensteine der aktuellen Phase erreicht.
              Möchtest du zur nächsten Phase wechseln?
            </ThemedText>
            <ThemedText style={styles.nextPhaseTitle}>
              Phase {nextPhase.phase_number}: {nextPhase.title} ({nextPhase.age_range})
            </ThemedText>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowPhaseChangeModal(false)}
              >
                <ThemedText style={styles.modalButtonText}>Später</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handlePhaseChange}
              >
                <ThemedText style={styles.modalButtonText}>Zur nächsten Phase</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    );
  };

  // Render-Funktion für das Modal zum Hinzufügen eines neuen Eintrags
  const renderNewEntryModal = () => {
    return (
      <Modal
        visible={showNewEntryModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.newEntryModalContainer} lightColor="#fff" darkColor="#333">
            <View style={styles.newEntryHeader}>
              <ThemedText style={styles.newEntryTitle}>
                Neuer Eintrag {selectedMilestone ? `zu "${selectedMilestone.title}"` : ''}
              </ThemedText>
              <TouchableOpacity onPress={() => setShowNewEntryModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.moodSelector}>
              <TouchableOpacity
                style={[
                  styles.moodButton,
                  newEntry.mood === 'happy' && styles.selectedMood
                ]}
                onPress={() => setNewEntry({ ...newEntry, mood: 'happy' })}
              >
                <IconSymbol name="face.smiling" size={30} color="#FFD700" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.moodButton,
                  newEntry.mood === 'neutral' && styles.selectedMood
                ]}
                onPress={() => setNewEntry({ ...newEntry, mood: 'neutral' })}
              >
                <IconSymbol name="face.dashed" size={30} color="#A9A9A9" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.moodButton,
                  newEntry.mood === 'sad' && styles.selectedMood
                ]}
                onPress={() => setNewEntry({ ...newEntry, mood: 'sad' })}
              >
                <IconSymbol name="face.smiling.fill" size={30} color="#4682B4" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.contentInput}
              placeholder="Was möchtest du festhalten?"
              placeholderTextColor="#999"
              multiline
              value={newEntry.content}
              onChangeText={(text) => setNewEntry({ ...newEntry, content: text })}
            />

            <View style={styles.newEntryActions}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={pickImage}
              >
                <IconSymbol name="photo" size={24} color={theme.text} />
                <ThemedText style={styles.photoButtonText}>Foto hinzufügen</ThemedText>
              </TouchableOpacity>

              {newEntry.photo_url && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: newEntry.photo_url }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => setNewEntry({ ...newEntry, photo_url: undefined })}
                  >
                    <IconSymbol name="xmark.circle.fill" size={24} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  handleSaveEntry();
                  setShowNewEntryModal(false);
                }}
                disabled={!newEntry.content.trim()}
              >
                <ThemedText style={styles.saveButtonText}>Speichern</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ThemedText>Lade Daten...</ThemedText>
          </View>
        ) : (
          <>
            {/* Header mit Babyalter und aktueller Phase */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <ThemedText type="title" style={styles.title}>Mein Babytagebuch</ThemedText>
                {currentPhase && (
                  <ThemedText style={styles.currentPhase}>
                    Phase aktuell: "{currentPhase.title}"
                  </ThemedText>
                )}
                {babyBirthDate && (
                  <ThemedText style={styles.babyAge}>
                    Alter deines Babys: {calculateBabyAge()}
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Hauptinhalt mit Phasen und Meilensteinen */}
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
              {phases.map((phase) => (
                renderPhase(
                  phase,
                  expandedPhaseId === phase.id,
                  currentPhase?.id === phase.id
                )
              ))}
            </ScrollView>

            {/* Tagebucheinträge */}
            <ThemedText style={styles.sectionTitle}>Tagebucheinträge</ThemedText>
            <FlatList
              data={entries}
              renderItem={renderEntry}
              keyExtractor={(item) => item.id || Math.random().toString()}
              contentContainerStyle={styles.entriesContainer}
              ListEmptyComponent={
                <ThemedView style={styles.emptyContainer} lightColor="#f8f8f8" darkColor="#333">
                  <ThemedText style={styles.emptyText}>
                    Noch keine Einträge vorhanden. Tippe auf das Plus-Symbol, um deinen ersten Eintrag zu erstellen.
                  </ThemedText>
                </ThemedView>
              }
            />

            {/* Floating Action Button zum Hinzufügen eines neuen Eintrags */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setSelectedMilestone(null);
                setShowNewEntry(!showNewEntry);
              }}
            >
              <IconSymbol
                name={showNewEntry ? "xmark" : "plus"}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Modals */}
            {renderPhaseChangeModal()}
            {renderNewEntryModal()}

            {/* Formular für neuen Eintrag */}
            {showNewEntry && (
              <ThemedView style={styles.newEntryCard} lightColor={theme.card} darkColor={theme.card}>
                <View style={styles.moodSelector}>
                  <TouchableOpacity
                    style={[
                      styles.moodButton,
                      newEntry.mood === 'happy' && styles.selectedMoodButton
                    ]}
                    onPress={() => setNewEntry({ ...newEntry, mood: 'happy' })}
                  >
                    <IconSymbol name="face.smiling" size={30} color="#FFD700" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.moodButton,
                      newEntry.mood === 'neutral' && styles.selectedMoodButton
                    ]}
                    onPress={() => setNewEntry({ ...newEntry, mood: 'neutral' })}
                  >
                    <IconSymbol name="face.dashed" size={30} color="#A9A9A9" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.moodButton,
                      newEntry.mood === 'sad' && styles.selectedMoodButton
                    ]}
                    onPress={() => setNewEntry({ ...newEntry, mood: 'sad' })}
                  >
                    <IconSymbol name="face.smiling.fill" size={30} color="#4682B4" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.contentInput,
                    { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                  ]}
                  value={newEntry.content}
                  onChangeText={(text) => setNewEntry({ ...newEntry, content: text })}
                  placeholder="Was ist heute passiert?"
                  placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#888888'}
                  multiline
                  numberOfLines={4}
                />

                {newEntry.photo_url && (
                  <View style={styles.previewImageContainer}>
                    <Image source={{ uri: newEntry.photo_url }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setNewEntry({ ...newEntry, photo_url: undefined })}
                    >
                      <IconSymbol name="xmark.circle.fill" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={pickImage}
                  >
                    <IconSymbol name="photo" size={24} color="#7D5A50" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveEntry}
                  >
                    <ThemedText style={styles.saveButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                      Speichern
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </ThemedView>
            )}
          </>
        )}
      </ImageBackground>
    </SafeAreaView>
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
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    marginBottom: 5,
  },
  currentPhase: {
    fontSize: 16,
    marginBottom: 3,
  },
  babyAge: {
    fontSize: 16,
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  // Phasen-Styles
  phaseCard: {
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  activePhaseCard: {
    borderWidth: 2,
    borderColor: '#7D5A50',
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  phaseHeaderContent: {
    flex: 1,
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  activePhaseTitle: {
    color: '#7D5A50',
  },
  phaseAgeRange: {
    fontSize: 14,
    opacity: 0.7,
  },
  phaseContent: {
    padding: 15,
    paddingTop: 0,
  },
  // Meilenstein-Styles
  milestonesContainer: {
    marginBottom: 15,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkboxContainer: {
    marginRight: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7D5A50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#7D5A50',
  },
  milestoneTextContainer: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  milestoneDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  // Fortschrittsbalken-Styles
  progressContainer: {
    marginBottom: 15,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7D5A50',
  },
  // Einträge zu Phasen
  phaseEntriesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  phaseEntriesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7D5A50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  addEntryButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
  },
  // Modal-Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  nextPhaseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#7D5A50',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#7D5A50',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Neuer Eintrag Modal
  newEntryModalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // Bestehende Styles
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#7D5A50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
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
  newEntryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  newEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  newEntryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  moodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  moodButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedMood: {
    borderColor: '#7D5A50',
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  selectedMoodButton: {
    borderColor: '#7D5A50',
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  newEntryActions: {
    marginTop: 15,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  photoButtonText: {
    marginLeft: 10,
    fontSize: 16,
  },
  previewContainer: {
    marginBottom: 15,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  saveButton: {
    backgroundColor: '#7D5A50',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewImageContainer: {
    marginTop: 15,
    position: 'relative',
    alignItems: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryDate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  moodContainer: {
    marginLeft: 10,
  },
  deleteButton: {
    padding: 5,
  },
  entryContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  entryImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
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
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    padding: 5,
  },
});
