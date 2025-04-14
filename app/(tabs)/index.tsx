import { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, FlatList, Alert, View, StatusBar, SafeAreaView, ActivityIndicator, ImageBackground, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ContractionChart from '@/components/ContractionChart';
import ContractionItem from '@/components/SwipeableContractionItem';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { saveContraction, getContractions, deleteContraction } from '@/lib/supabase';

type Contraction = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null; // in seconds
  interval: number | null; // time since last contraction in seconds
  intensity: string | null; // Stärke der Wehe (schwach, mittel, stark)
};

export default function HomeScreen() {
  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [currentContraction, setCurrentContraction] = useState<Contraction | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();

  // Start a new contraction
  const startContraction = () => {
    const newContraction: Contraction = {
      id: Date.now().toString(),
      startTime: new Date(),
      endTime: null,
      duration: null,
      interval: contractions.length > 0
        ? Math.floor((Date.now() - new Date(contractions[0].startTime).getTime()) / 1000)
        : null,
      intensity: null // Wird später beim Beenden der Wehe gesetzt
    };

    setCurrentContraction(newContraction);
    setTimerRunning(true);
    setElapsedTime(0);
  };

  // Funktion zum Anzeigen des Intensitäts-Dialogs mit Buttons
  const showIntensityDialog = (completedContraction: Contraction) => {
    // Erstellen eines benutzerdefinierten Dialogs mit farbigen Buttons
    Alert.alert(
      'Intensität der Wehe',
      'Wie stark war die Wehe?',
      [
        {
          text: '🟢 Schwach',
          onPress: () => saveContractionWithIntensity(completedContraction, 'schwach')
        },
        {
          text: '🟠 Mittel',
          onPress: () => saveContractionWithIntensity(completedContraction, 'mittel')
        },
        {
          text: '🔴 Stark',
          onPress: () => saveContractionWithIntensity(completedContraction, 'stark')
        },
        {
          text: 'Abbrechen',
          style: 'cancel',
          onPress: () => saveContractionWithIntensity(completedContraction, null)
        }
      ]
    );
  };

  // Funktion zum Speichern der Wehe mit Intensität
  const saveContractionWithIntensity = async (completedContraction: Contraction, intensity: string | null) => {
    // Aktualisiere die Wehe mit der Intensität
    const finalContraction: Contraction = {
      ...completedContraction,
      intensity
    };

    // Lokale Aktualisierung für sofortige UI-Reaktion
    setContractions([finalContraction, ...contractions]);

    // In Supabase speichern
    try {
      const { error } = await saveContraction({
        start_time: finalContraction.startTime.toISOString(),
        end_time: finalContraction.endTime?.toISOString() || null,
        duration: finalContraction.duration,
        interval: finalContraction.interval,
        intensity: finalContraction.intensity
      });

      if (error) {
        console.error('Error saving contraction:', error);
        Alert.alert('Fehler', 'Wehe konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error('Failed to save contraction:', err);
    }

    // Check if contractions are getting close together and frequent
    checkContractionWarning(finalContraction, contractions);
  };

  // Stop the current contraction
  const stopContraction = async () => {
    if (currentContraction) {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - new Date(currentContraction.startTime).getTime()) / 1000);

      const completedContraction: Contraction = {
        ...currentContraction,
        endTime,
        duration
      };

      setCurrentContraction(null);
      setTimerRunning(false);

      // Zeige den Dialog zur Eingabe der Intensität an
      showIntensityDialog(completedContraction);
    }
  };

  // Check if contractions indicate active labor
  const checkContractionWarning = (newContraction: Contraction, existingContractions: Contraction[]) => {
    if (existingContractions.length >= 2) {
      const recentContractions = [newContraction, ...existingContractions.slice(0, 2)];

      // Check if we have 3 contractions that are:
      // 1. Less than 5 minutes apart (300 seconds)
      // 2. Each lasting more than 45 seconds
      const closeIntervals = recentContractions.every(c =>
        c.interval !== null && c.interval < 300
      );

      const longDurations = recentContractions.every(c =>
        c.duration !== null && c.duration > 45
      );

      if (closeIntervals && longDurations) {
        Alert.alert(
          "Aktive Wehen",
          "Deine Wehen sind weniger als 5 Minuten auseinander und dauern länger als 45 Sekunden. Dies könnte auf aktive Wehen hindeuten.",
          [{ text: "OK" }]
        );
      }
    }
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };





  // Funktion zum Löschen einer Wehe
  const handleDeleteContraction = (contractionId: string) => {
    console.log('Handling delete for contraction ID:', contractionId);

    // Wir führen die Löschung direkt aus, da der Bestätigungsdialog bereits in der ContractionItem-Komponente angezeigt wird
    try {
      // Optimistische UI-Aktualisierung
      setContractions(prevContractions =>
        prevContractions.filter(c => c.id !== contractionId)
      );

      console.log('Sending delete request to Supabase for ID:', contractionId);
      // In Supabase löschen
      deleteContraction(contractionId).then(({ error }) => {
        if (error) {
          console.error('Error deleting contraction:', error);
          Alert.alert('Fehler', 'Wehe konnte nicht gelöscht werden.');

          // Bei Fehler die Wehen neu laden
          loadContractions();
        } else {
          console.log('Successfully deleted contraction with ID:', contractionId);
        }
      }).catch(err => {
        console.error('Failed to delete contraction:', err);
        // Bei Fehler die Wehen neu laden
        loadContractions();
      });
    } catch (err) {
      console.error('Failed to delete contraction:', err);
      // Bei Fehler die Wehen neu laden
      loadContractions();
    }
  };

  // Funktion zum Laden der Wehen aus Supabase
  const loadContractions = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await getContractions();

      if (error) {
        console.error('Error loading contractions:', error);
        Alert.alert('Fehler', 'Wehen konnten nicht geladen werden.');
        return;
      }

      if (data) {
        // Konvertieren der Supabase-Daten in das lokale Format
        const formattedContractions: Contraction[] = data.map(c => ({
          id: c.id,
          startTime: new Date(c.start_time),
          endTime: c.end_time ? new Date(c.end_time) : null,
          duration: c.duration,
          interval: c.interval,
          intensity: c.intensity
        }));

        setContractions(formattedContractions);
      }
    } catch (err) {
      console.error('Failed to load contractions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Laden der Wehen aus Supabase beim Start
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const { data, error } = await getContractions();

        if (error) {
          console.error('Error loading contractions:', error);
          Alert.alert('Fehler', 'Wehen konnten nicht geladen werden.');
          return;
        }

        if (data) {
          // Konvertieren der Supabase-Daten in das lokale Format
          const formattedContractions: Contraction[] = data.map(c => ({
            id: c.id,
            startTime: new Date(c.start_time),
            endTime: c.end_time ? new Date(c.end_time) : null,
            duration: c.duration,
            interval: c.interval,
            intensity: c.intensity
          }));

          setContractions(formattedContractions);
        }
      } catch (err) {
        console.error('Failed to load contractions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerRunning]);









  // Holen der Bildschirmabmessungen für das Hintergrundbild
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  return (
    <ImageBackground
      source={require('../../assets/images/Background_Hell.png')}
      style={[styles.backgroundImage, { width: screenWidth, height: screenHeight }]}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header with title - moved down for better visibility */}
          <View style={styles.header}>
            <ThemedText type="title" style={styles.headerTitle} lightColor="#5C4033" darkColor="#F2E6DD">
              Wehen-Tracker
            </ThemedText>
            <ThemedText style={styles.headerSubtitle} lightColor="#5C4033" darkColor="#F2E6DD">
              Für werdende Mamas
            </ThemedText>
          </View>

          {/* Timer Section - improved for better visibility */}
          <ThemedView style={styles.timerSection} lightColor="rgba(255, 255, 255, 0.8)" darkColor="rgba(50, 50, 50, 0.8)">
            <ThemedView
              style={[styles.timerDisplay, {borderColor: theme.timerBorder, overflow: 'visible'}]}
              lightColor={theme.timerBackground}
              darkColor={theme.timerBackground}
            >
              <ThemedText
                style={styles.timerText}
                lightColor={theme.timerText}
                darkColor={theme.timerText}
              >
                {formatTime(elapsedTime)}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.buttonContainer}>
              {!timerRunning ? (
                <TouchableOpacity
                  style={[styles.button, styles.startButton]}
                  onPress={startContraction}
                >
                  <ThemedText style={styles.buttonText}>Wehe Starten</ThemedText>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.stopButton]}
                  onPress={stopContraction}
                >
                  <ThemedText style={styles.buttonText}>Wehe Beenden</ThemedText>
                </TouchableOpacity>
              )}
            </ThemedView>
          </ThemedView>

          {/* Contractions History */}
          <ThemedView style={styles.historySection} lightColor="transparent" darkColor="transparent">
            <ThemedText
              type="subtitle"
              style={styles.historyTitle}
              lightColor="#5C4033"
              darkColor="#F2E6DD"
            >
              Wehen Verlauf
            </ThemedText>

            {/* Visualisierung der Wehen */}
            {!isLoading && contractions.length > 0 && (
              <ContractionChart
                contractions={contractions}
                lightColor="rgba(255, 255, 255, 0.8)"
                darkColor="rgba(50, 50, 50, 0.8)"
              />
            )}

            {isLoading ? (
              <ThemedView
                style={styles.emptyState}
                lightColor={theme.card}
                darkColor={theme.card}
              >
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={{marginTop: 10}} lightColor={theme.text} darkColor={theme.text}>
                  Wehen werden geladen...
                </ThemedText>
              </ThemedView>
            ) : contractions.length === 0 ? (
              <ThemedView
                style={styles.emptyState}
                lightColor={theme.card}
                darkColor={theme.card}
              >
                <ThemedText lightColor={theme.text} darkColor={theme.text}>
                  Noch keine Wehen aufgezeichnet
                </ThemedText>
              </ThemedView>
            ) : (
              <FlatList
                data={contractions}
                renderItem={({ item, index }) => (
                  <ContractionItem
                    item={item}
                    index={index}
                    totalCount={contractions.length}
                    onDelete={handleDeleteContraction}
                  />
                )}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            )}
          </ThemedView>
        </ScrollView>
      </View>
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent background to show the image
  },
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 30, // Add more padding at the top for better visibility
  },
  header: {
    alignItems: 'center',
    marginBottom: 30, // Increased margin for better spacing
    paddingVertical: 15,
    marginTop: 10, // Push header down a bit
  },
  headerTitle: {
    fontSize: 36, // Larger title
    marginBottom: 8,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 18, // Larger subtitle
    opacity: 0.8,
    fontStyle: 'italic',
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 10, // Increased margin
    borderRadius: 24, // More rounded corners
    padding: 5, // More padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  timerDisplay: {
    marginVertical: 25, // More vertical margin
    padding: 30, // More padding, especially vertical padding
    paddingVertical: 40, // Extra vertical padding to ensure text is fully visible
    borderRadius: 30, // More rounded corners
    borderWidth: 3, // Thicker border for emphasis
    // Dynamic border color based on theme will be set in the component
    minWidth: 280, // Even wider for better visibility
    minHeight: 200, // Much taller to ensure text is fully visible
    alignItems: 'center',
    justifyContent: 'center', // Center vertically too
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, // Stronger shadow
    shadowRadius: 5,
    elevation: 4, // Stronger elevation
  },
  timerText: {
    fontSize: 64, // Large font but not too large to avoid clipping
    fontWeight: '700', // Bold but not too heavy
    letterSpacing: 2, // Moderate letter spacing
    textAlign: 'center', // Ensure text is centered
    textShadowColor: 'rgba(0, 0, 0, 0.1)', // Subtle text shadow
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    includeFontPadding: false, // Reduce extra padding around text
    lineHeight: 70, // Control the line height to prevent clipping
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10, // Add some margin at the top
  },
  button: {
    paddingVertical: 16, // Taller buttons
    paddingHorizontal: 30, // Wider buttons
    borderRadius: 40, // Very rounded corners
    minWidth: 240, // Wider for better touch targets
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: Colors.light.success,
  },
  stopButton: {
    backgroundColor: Colors.light.warning,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 20, // Larger text
    letterSpacing: 0.5,
  },
  historySection: {
    marginTop: 30, // More margin
  },
  historyTitle: {
    marginBottom: 20, // More margin
    fontSize: 24, // Larger title
    fontWeight: '600',
  },
  emptyState: {
    padding: 30, // More padding
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 20, // More rounded corners
    height: 120, // Taller
  },
  contractionItem: {
    padding: 20, // More padding
    borderRadius: 20, // More rounded corners
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  contractionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14, // More margin
    paddingBottom: 10, // More padding
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  contractionDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
  },
  leftColumn: {
    flex: 1,
    marginRight: 10,
  },
  rightColumn: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  detailItem: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    marginBottom: 10,
    borderRadius: 12,
  },
  detailLabel: {
    fontSize: 16,
    marginBottom: 6,
    opacity: 0.8,
  },
  detailValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  intensityBadge: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  intensityText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
  },
  deleteActionText: {
    color: 'white',
    fontWeight: 'bold',
    padding: 10,
  },
});
