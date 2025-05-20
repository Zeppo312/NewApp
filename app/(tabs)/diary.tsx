import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image, TextInput, Alert, SafeAreaView, StatusBar, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
// import { Collapsible } from '@/components/Collapsible';
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
// import { supabase } from '@/lib/supabase';
import { differenceInDays, differenceInMonths, differenceInWeeks } from 'date-fns';
import { router } from 'expo-router';

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

  // Zustand für Animation und Feedback
  const [animatingMilestoneId, setAnimatingMilestoneId] = useState<string | null>(null);
  const [showFeedbackMessage, setShowFeedbackMessage] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Meilenstein umschalten (erreicht/nicht erreicht)
  const handleToggleMilestone = async (milestone: Milestone) => {
    try {
      const newStatus = !milestone.is_completed;
      setAnimatingMilestoneId(milestone.id);

      // Feedback-Nachricht anzeigen, wenn ein Meilenstein erreicht wurde
      if (newStatus) {
        setFeedbackMessage('Super! Ein neuer Schritt ist geschafft.');
        setShowFeedbackMessage(true);

        // Feedback nach 2 Sekunden ausblenden
        setTimeout(() => {
          setShowFeedbackMessage(false);
        }, 2000);
      }

      await toggleMilestone(milestone.id, newStatus);

      // Meilensteine neu laden, um den aktualisierten Status zu erhalten
      if (expandedPhaseId) {
        await loadMilestonesForPhase(expandedPhaseId);
      }

      // Animation nach kurzer Zeit beenden
      setTimeout(() => {
        setAnimatingMilestoneId(null);
      }, 500);
    } catch (err) {
      console.error('Failed to toggle milestone:', err);
      Alert.alert('Fehler', 'Der Meilenstein konnte nicht aktualisiert werden.');
      setAnimatingMilestoneId(null);
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

  // Zu einer früheren Phase zurückkehren
  const handleReactivatePhase = async (phase: DevelopmentPhase) => {
    try {
      Alert.alert(
        "Phase reaktivieren",
        `Möchtest du zu Phase ${phase.phase_number}: ${phase.title} zurückkehren?`,
        [
          {
            text: "Abbrechen",
            style: "cancel"
          },
          {
            text: "Ja, reaktivieren",
            onPress: async () => {
              // Aktuelle Phase in Supabase aktualisieren
              await updateCurrentPhase(phase.id);

              // Lokalen Zustand aktualisieren
              setCurrentPhase(phase);
              setExpandedPhaseId(phase.id);
              await loadMilestonesForPhase(phase.id);

              // Erfolgsmeldung anzeigen
              Alert.alert(
                "Phase reaktiviert",
                `Du bist jetzt wieder in Phase ${phase.phase_number}: ${phase.title}.`,
                [{ text: "OK" }]
              );
            }
          }
        ]
      );
    } catch (err) {
      console.error('Failed to reactivate phase:', err);
      Alert.alert('Fehler', 'Die Phase konnte nicht reaktiviert werden.');
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

  // Nicht mehr benötigt, da Einträge auf separater Seite angezeigt werden

  // Render-Funktion für die Meilensteine einer Phase
  const renderMilestones = (phaseMilestones: Milestone[]) => {
    return (
      <View style={styles.milestonesContainer}>
        {/* Feedback-Nachricht */}
        {showFeedbackMessage && (
          <View style={styles.feedbackContainer}>
            <ThemedText style={styles.feedbackText}>{feedbackMessage}</ThemedText>
          </View>
        )}

        {phaseMilestones.map((milestone) => (
          <TouchableOpacity
            key={milestone.id}
            style={styles.milestoneItem}
            onPress={() => handleToggleMilestone(milestone)}
          >
            <View style={styles.checkboxContainer}>
              <View
                style={[
                  styles.checkbox,
                  milestone.is_completed && styles.checkboxChecked,
                  animatingMilestoneId === milestone.id && styles.checkboxAnimating
                ]}
              >
                {milestone.is_completed && (
                  <IconSymbol
                    name="checkmark"
                    size={16}
                    color="#fff"
                    style={animatingMilestoneId === milestone.id ? styles.checkmarkAnimating : undefined}
                  />
                )}
              </View>
            </View>
            <View style={styles.milestoneTextContainer}>
              <ThemedText
                style={[
                  styles.milestoneTitle,
                  milestone.is_completed && styles.milestoneTitleCompleted
                ]}
              >
                {milestone.title}
              </ThemedText>
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
    // Bestimme die Farbe des Fortschrittsbalkens basierend auf dem Fortschritt
    const getProgressBarColor = () => {
      if (progress < 30) return '#6BAAE8'; // Blau für Anfang
      if (progress < 60) return '#6BC6E8'; // Hellblau für mittleren Fortschritt
      if (progress < 80) return '#6BE8B9'; // Türkis für guten Fortschritt
      return '#6BE86B'; // Grün für fast fertig
    };

    // Motivierende Nachricht basierend auf dem Fortschritt
    const getMotivationalMessage = () => {
      if (progress === 0) return 'Los geht\'s!';
      if (progress < 30) return 'Ein guter Start!';
      if (progress < 60) return 'Weiter so!';
      if (progress < 80) return 'Schon viel geschafft!';
      if (progress < 100) return 'Fast geschafft!';
      return 'Phase abgeschlossen – Zeit für den nächsten Schritt?';
    };

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <ThemedText style={styles.progressText}>
            {completedCount} von {totalCount} Meilensteinen erreicht ({Math.round(progress)}%)
          </ThemedText>
          <ThemedText style={styles.motivationalText}>
            {getMotivationalMessage()}
          </ThemedText>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progress}%`,
                backgroundColor: getProgressBarColor()
              }
            ]}
          />
        </View>
      </View>
    );
  };

  // Render-Funktion für eine Entwicklungsphase
  const renderPhase = (phase: DevelopmentPhase, isExpanded: boolean, isActive: boolean) => {
    // Bestimme den Status der Phase
    const isCompleted = currentPhase && phase.phase_number < currentPhase.phase_number;
    const isFuture = currentPhase && phase.phase_number > currentPhase.phase_number;

    return (
      <ThemedView
        key={phase.id}
        style={[
          styles.phaseCard,
          isActive && styles.activePhaseCard,
          isCompleted && styles.completedPhaseCard,
          isFuture && styles.futurePhaseCard
        ]}
        lightColor="#fff"
        darkColor="#333"
      >
        <TouchableOpacity
          style={styles.phaseHeader}
          onPress={() => setExpandedPhaseId(isExpanded ? null : phase.id)}
          disabled={isFuture ? true : false}
        >
          <View style={styles.phaseHeaderContent}>
            <View style={styles.phaseTitleContainer}>
              <ThemedText
                style={[
                  styles.phaseTitle,
                  isActive && styles.activePhaseTitle,
                  isCompleted && styles.completedPhaseTitle,
                  isFuture && styles.futurePhaseTitle
                ]}
              >
                Phase {phase.phase_number}: {phase.title}
              </ThemedText>

              {isCompleted && (
                <View style={styles.phaseStatusContainer}>
                  <View style={styles.phaseStatusBadge}>
                    <IconSymbol name="checkmark.circle.fill" size={16} color="#9DBEBB" />
                    <ThemedText style={styles.phaseStatusText}>Abgeschlossen</ThemedText>
                  </View>
                  <TouchableOpacity
                    style={styles.reactivateButton}
                    onPress={() => handleReactivatePhase(phase)}
                  >
                    <IconSymbol name="arrow.uturn.backward" size={14} color="#7D5A50" />
                    <ThemedText style={styles.reactivateButtonText}>Reaktivieren</ThemedText>
                  </TouchableOpacity>
                </View>
              )}

              {isFuture && (
                <View style={styles.phaseStatusBadge}>
                  <IconSymbol name="lock.fill" size={16} color="#A9A9A9" />
                  <ThemedText style={styles.phaseStatusText}>Noch nicht verfügbar</ThemedText>
                </View>
              )}
            </View>

            <ThemedText style={styles.phaseAgeRange}>{phase.age_range}</ThemedText>
          </View>
          <IconSymbol
            name={isExpanded ? "chevron.down" : "chevron.right"}
            size={24}
            color={isFuture ? "#A9A9A9" : theme.text}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.phaseContent}>
            {milestones.length > 0 && renderMilestones(milestones)}
            {renderProgressBar(phaseProgress.progress, phaseProgress.completedCount, phaseProgress.totalCount)}

            <View style={styles.phaseEntriesContainer}>
              <ThemedText style={styles.phaseEntriesTitle}>Einträge zu dieser Phase</ThemedText>
            </View>

            <View style={styles.entriesButtonsContainer}>
              <TouchableOpacity
                style={styles.addEntryButton}
                onPress={() => {
                  setSelectedMilestone(null);
                  setShowNewEntryModal(true);
                }}
              >
                <IconSymbol name="pencil.and.scribble" size={18} color="#fff" />
                <ThemedText style={styles.addEntryButtonText}>Eintrag hinzufügen</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewAllEntriesButton}
                onPress={() => router.push('/diary-entries')}
              >
                <IconSymbol name="book" size={18} color="#fff" />
                <ThemedText style={styles.addEntryButtonText}>Einträge</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.entrySuggestionContainer}>
              <ThemedText style={styles.entrySuggestionText}>
                📝 Teile einen besonderen Moment aus dieser Phase
              </ThemedText>
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
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ThemedText>Lade Daten...</ThemedText>
          </View>
        ) : (
          <>
            {/* Header mit Babyalter und aktueller Phase - emotionaler und dynamischer */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <ThemedText type="title" style={styles.title}>Entwicklungssprünge</ThemedText>
                {currentPhase && (
                  <View style={styles.phaseIndicator}>
                    <IconSymbol name="star.fill" size={18} color="#E9C9B6" />
                    <ThemedText style={styles.currentPhase}>
                      Aktuelle Phase: "{currentPhase.title}"
                    </ThemedText>
                  </View>
                )}
                {babyBirthDate && (
                  <View style={styles.ageIndicator}>
                    <IconSymbol name="heart.fill" size={18} color="#E9C9B6" />
                    <ThemedText style={styles.babyAge}>
                      {calculateBabyAge()} alt
                    </ThemedText>
                  </View>
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

            {/* Button für Tagebucheinträge */}
            <TouchableOpacity
              style={styles.entriesButton}
              onPress={() => router.push('/diary-entries')}
            >
              <View style={styles.entriesButtonContent}>
                <View style={styles.entriesButtonTitleContainer}>
                  <IconSymbol name="book.fill" size={20} color="#7D5A50" />
                  <ThemedText style={styles.entriesButtonTitle}>Tagebucheinträge</ThemedText>
                </View>
                <View style={styles.entriesButtonSubtitleContainer}>
                  <ThemedText style={styles.entriesButtonSubtitle}>
                    {entries.length > 0 ? `${entries.length} Einträge` : "Keine Einträge"}
                  </ThemedText>
                </View>
              </View>
              {/* Chevron.right wurde entfernt */}
            </TouchableOpacity>

            {/* Plus-Button wurde entfernt */}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 10,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    marginBottom: 10,
    color: '#7D5A50',
  },
  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  ageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPhase: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
    color: '#7D5A50',
  },
  babyAge: {
    fontSize: 16,
    marginLeft: 8,
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
  completedPhaseCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9DBEBB',
  },
  futurePhaseCard: {
    opacity: 0.7,
    borderLeftWidth: 4,
    borderLeftColor: '#A9A9A9',
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
  phaseTitleContainer: {
    marginBottom: 5,
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  activePhaseTitle: {
    color: '#7D5A50',
  },
  completedPhaseTitle: {
    color: '#9DBEBB',
  },
  futurePhaseTitle: {
    color: '#A9A9A9',
  },
  phaseStatusContainer: {
    marginTop: 4,
  },
  phaseStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2E2CE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reactivateButtonText: {
    fontSize: 12,
    color: '#7D5A50',
    marginLeft: 4,
  },
  phaseStatusText: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.8,
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
  milestoneTitleCompleted: {
    color: '#7D5A50',
    fontWeight: 'bold',
  },
  milestoneDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  checkboxAnimating: {
    transform: [{ scale: 1.2 }],
  },
  checkmarkAnimating: {
    transform: [{ scale: 1.3 }],
  },
  feedbackContainer: {
    backgroundColor: '#F9F1EC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  // Fortschrittsbalken-Styles
  progressContainer: {
    marginBottom: 20,
    marginTop: 5,
  },
  progressHeader: {
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  motivationalText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
    color: '#7D5A50',
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7D5A50',
  },
  // Einträge zu Phasen
  phaseEntriesContainer: {
    marginTop: 10,
    marginBottom: 8,
  },
  phaseEntriesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  entriesButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  entriesButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 18,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  entriesButtonContent: {
    flex: 1,
  },
  entriesButtonTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  entriesButtonTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginLeft: 8,
  },
  entriesButtonSubtitleContainer: {
    marginLeft: 28,
  },
  entriesButtonSubtitle: {
    fontSize: 15,
    color: '#999',
  },
  addEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9C9B6',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  viewAllEntriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9DBEBB',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  addEntryButtonText: {
    color: '#7D5A50',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  entrySuggestionContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(233, 201, 182, 0.2)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E9C9B6',
  },
  entrySuggestionText: {
    fontSize: 14,
    color: '#7D5A50',
    fontStyle: 'italic',
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
  // Styles für Plus-Button wurden entfernt
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
    padding: 10,
    paddingTop: 0,
    paddingBottom: 20,
  },
  entryCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  entryImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 8,
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
