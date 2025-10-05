import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, Modal, SafeAreaView, StatusBar, Text } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { saveWeightEntry, getWeightEntries, deleteWeightEntry, WeightEntry } from '@/lib/weight';
import { Stack } from 'expo-router';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD, SECTION_GAP_TOP, SECTION_GAP_BOTTOM } from '@/constants/DesignGuide';
import ActivityCard from '@/components/ActivityCard';

export default function WeightTrackerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  // router wird durch die BackButton-Komponente verwaltet

  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Lade Gewichtsdaten beim ersten Rendern
  useEffect(() => {
    loadWeightEntries();
  }, []);

  // Lade Gewichtsdaten
  const loadWeightEntries = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getWeightEntries();
      if (error) throw error;
      setWeightEntries(data || []);
    } catch (error) {
      console.error('Error loading weight entries:', error);
      Alert.alert('Fehler', 'Beim Laden der Gewichtsdaten ist ein Fehler aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  // Speichere einen neuen Gewichtseintrag
  const handleSaveWeightEntry = async () => {
    if (!weight.trim()) {
      Alert.alert('Hinweis', 'Bitte gib ein Gewicht ein.');
      return;
    }

    const weightValue = parseFloat(weight.replace(',', '.'));
    if (isNaN(weightValue) || weightValue <= 0) {
      Alert.alert('Hinweis', 'Bitte gib ein gültiges Gewicht ein.');
      return;
    }

    try {
      setIsSaving(true);
      const formattedDate = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const { error } = await saveWeightEntry({
        date: formattedDate,
        weight: weightValue,
        notes: notes.trim() || undefined
      });

      if (error) throw error;

      // Lade Gewichtsdaten neu
      setIsLoading(true);
      await loadWeightEntries();
      setWeight('');
      setNotes('');
      setDate(new Date());
      setShowAddForm(false);
      Alert.alert('Erfolg', 'Dein Gewichtseintrag wurde erfolgreich gespeichert.');
    } catch (error) {
      console.error('Error saving weight entry:', error);
      Alert.alert('Fehler', 'Beim Speichern des Gewichtseintrags ist ein Fehler aufgetreten.');
    } finally {
      setIsSaving(false);
      setIsLoading(false);
    }
  };

  // Lösche einen Gewichtseintrag
  const handleDeleteWeightEntry = async (id: string) => {
    Alert.alert(
      'Eintrag löschen',
      'Möchtest du diesen Gewichtseintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              const { error } = await deleteWeightEntry(id);
              if (error) throw error;

              // Lade Gewichtsdaten neu
              setIsLoading(true);
              await loadWeightEntries();
              Alert.alert('Erfolg', 'Dein Gewichtseintrag wurde erfolgreich gelöscht.');
            } catch (error) {
              console.error('Error deleting weight entry:', error);
              Alert.alert('Fehler', 'Beim Löschen des Gewichtseintrags ist ein Fehler aufgetreten.');
            } finally {
              setIsSaving(false);
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Formatiere das Datum für die Anzeige
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Bereite die Daten für das Diagramm vor
  const prepareChartData = () => {
    // Sortiere die Einträge nach Datum
    const sortedEntries = [...weightEntries].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Begrenze auf die letzten 10 Einträge für bessere Übersichtlichkeit
    const recentEntries = sortedEntries.slice(-10);

    return {
      labels: recentEntries.map(entry => {
        const date = new Date(entry.date);
        // Formatiere das Datum als Tag.Monat
        return `${date.getDate()}.${date.getMonth() + 1}.`;
      }),
      datasets: [
        {
          data: recentEntries.map(entry => entry.weight),
          color: (opacity = 1) => `rgba(229, 115, 115, ${opacity})`, // Pastellrot
          strokeWidth: 3, // Dickere Linie für bessere Sichtbarkeit
        }
      ],
      legend: ['Gewicht']
    };
  };

  const chartData = prepareChartData();

  // Rendere die Gewichtskurve
  const renderWeightChart = () => {
    if (weightEntries.length < 2) {
      return (
        <LiquidGlassCard style={styles.emptyChartContainer} intensity={26} overlayColor={GLASS_OVERLAY}>
          <IconSymbol name="chart.line.uptrend.xyaxis" size={40} color={theme.tabIconDefault} />
          <ThemedText style={styles.emptyChartText} lightColor="#888" darkColor="#E9D8C2">
            Füge mindestens zwei Gewichtseinträge hinzu, um eine Kurve zu sehen.
          </ThemedText>
        </LiquidGlassCard>
      );
    }

    return (
      <LiquidGlassCard style={styles.chartContainer} intensity={26} overlayColor={GLASS_OVERLAY}>
        <View style={styles.chartWrapper}>
          <LineChart
          data={chartData}
          width={screenWidth - 80} // Angepasste Breite für bessere Zentrierung
          height={220}
          chartConfig={{
            backgroundColor: theme.card,
            backgroundGradientFrom: theme.card,
            backgroundGradientTo: theme.card,
            decimalPlaces: 0, // Keine Dezimalstellen für kg-Werte
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '4', // Noch kleinere Punkte für bessere Darstellung
              strokeWidth: '1',
              stroke: '#E57373',
              fill: '#E57373'
            },
            // Formatierung der Y-Achsen-Labels (kg-Anzeige)
            formatYLabel: (value) => `${value} kg`, // Mit kg-Suffix bei jedem Wert
            // Mehr Platz zwischen den Datenpunkten
            propsForBackgroundLines: {
              strokeDasharray: '',
              strokeWidth: 1,
              stroke: '#EFEFEF'
            },
            // Anpassung der Beschriftungen
            propsForLabels: {
              fontSize: 9,
              fontWeight: 'bold'
            },
            // Spezifische Anpassung der Y-Achsen-Labels
            propsForVerticalLabels: {
              fontSize: 10,
              fontWeight: 'normal', // Normale Schrift statt fett
              dx: 5, // Etwas mehr Abstand nach rechts
              textAnchor: 'end', // Rechtsbündige Ausrichtung
              alignmentBaseline: 'middle' // Vertikale Zentrierung
            },
            // Spezifische Anpassung der X-Achsen-Labels
            propsForHorizontalLabels: {
              fontSize: 8,
              fontWeight: 'bold',
              dy: -3, // Leichte Verschiebung nach oben
              rotation: -45 // Schräge Darstellung für bessere Lesbarkeit
            }
          }}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={true}
          segments={5} // Optimale Anzahl von Segmenten
          withVerticalLines={false} // Keine vertikalen Linien für bessere Übersicht
          withHorizontalLines={true} // Horizontale Linien beibehalten
          withVerticalLabels={true}
          withHorizontalLabels={true}
          fromZero={false} // Automatische Skalierung
          yAxisLabel="" // Leeres Präfix
          yAxisSuffix="" // Kein Suffix an jedem Wert
          formatXLabel={(value) => value} // Standard-Formatierung für X-Achse
        />
        </View>
      </LiquidGlassCard>
    );
  };

  // Mappe Gewichtseintrag auf ActivityCard-kompatibles Format
  const convertWeightToDailyEntry = (e: WeightEntry): any => {
    return {
      id: e.id,
      entry_date: e.date,
      entry_type: 'other',
      // keine Zeiten -> keine Zeit-Pills
      notes: e.notes ?? undefined,
      // Custom Anzeige wie im Sleep-Tracker (über emoji/label)
      emoji: '⚖️',
      label: `Gewicht ${e.weight} kg`,
    };
  };

  // Rendere die Gewichtseinträge
  const renderWeightEntries = () => {
    if (weightEntries.length === 0) {
      return (
        <LiquidGlassCard style={styles.emptyState} intensity={26} overlayColor={GLASS_OVERLAY}>
          <IconSymbol name="scalemass" size={40} color={theme.tabIconDefault} />
          <ThemedText style={styles.emptyStateText} lightColor="#5C4033" darkColor="#FFFFFF">
            Noch keine Gewichtseinträge
          </ThemedText>
          <ThemedText style={styles.emptyStateSubtext} lightColor="#888" darkColor="#E9D8C2">
            Füge deinen ersten Gewichtseintrag hinzu, um deine Gewichtskurve zu sehen.
          </ThemedText>
        </LiquidGlassCard>
      );
    }

    return (
      <View style={styles.timelineSection}>
        <Text style={[styles.sectionTitleSleepLike]}>Gewichtseinträge</Text>
        <View style={styles.entriesContainer}> 
          {weightEntries.map((entry) => (
            <ActivityCard
              key={entry.id}
              entry={convertWeightToDailyEntry(entry)}
              onDelete={(id) => handleDeleteWeightEntry(id)}
              marginHorizontal={8}
            />
          ))}
        </View>
      </View>
    );
  };

  // Rendere die SaveView-Komponente
  const renderSaveView = () => {
    return (
      <Modal
        transparent={true}
        visible={isSaving}
        animationType="fade"
      >
        <View style={styles.saveViewContainer}>
          <LiquidGlassCard style={styles.saveView} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.saveViewText} lightColor="#5C4033" darkColor="#FFFFFF">
              Daten werden gespeichert...
            </ThemedText>
          </LiquidGlassCard>
        </View>
      </Modal>
    );
  };

  // Rendere das Formular zum Hinzufügen eines Gewichtseintrags
  const renderAddForm = () => {
    return (
      <LiquidGlassCard style={styles.addFormContainer} intensity={26} overlayColor={GLASS_OVERLAY}>
        <View style={styles.formHeader}>
          <ThemedText style={styles.formTitle} lightColor="#5C4033" darkColor="#FFFFFF">Neuen Gewichtseintrag hinzufügen</ThemedText>
          <TouchableOpacity onPress={() => setShowAddForm(false)}>
            <IconSymbol name="xmark.circle.fill" size={24} color={theme.tabIconDefault} />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label} lightColor="#5C4033" darkColor="#FFFFFF">Datum</ThemedText>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <ThemedText lightColor="#333333" darkColor="#F8F0E5">{date.toLocaleDateString('de-DE')}</ThemedText>
            <IconSymbol name="calendar" size={20} color={theme.tabIconDefault} />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDate(selectedDate);
                }
              }}
            />
          )}
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label} lightColor="#5C4033" darkColor="#FFFFFF">Gewicht (kg)</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="z.B. 65.5"
            placeholderTextColor={theme.tabIconDefault}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label} lightColor="#5C4033" darkColor="#FFFFFF">Notizen (optional)</ThemedText>
          <TextInput
            style={[styles.input, styles.notesInput, { color: theme.text }]}
            placeholder="z.B. Nach dem Sport gemessen"
            placeholderTextColor={theme.tabIconDefault}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.accent }]}
          onPress={handleSaveWeightEntry}
          disabled={isLoading || isSaving}
        >
          <ThemedText style={styles.saveButtonText}>
            {isLoading || isSaving ? 'Wird gespeichert...' : 'Speichern'}
          </ThemedText>
        </TouchableOpacity>
      </LiquidGlassCard>
    );
  };

  // Holen der Bildschirmabmessungen für das Diagramm
  const screenWidth = Dimensions.get('window').width;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground
        style={styles.backgroundImage}
        resizeMode="repeat"
      >
        {/* SaveView Modal */}
        {renderSaveView()}

        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          
          <Header title="Gewichtskurve" showBackButton />
          
          <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

            {isLoading && !showAddForm ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={styles.loadingText} lightColor="#888" darkColor="#E9D8C2">Daten werden geladen...</ThemedText>
              </View>
            ) : showAddForm ? (
              renderAddForm()
            ) : (
              <>
                {renderWeightChart()}
                {renderWeightEntries()}
              </>
            )}
            </ScrollView>

            {/* Floating Add Button - nur anzeigen, wenn nicht im Formular-Modus */}
            {!showAddForm && !isLoading && (
              <TouchableOpacity
                style={[styles.floatingAddButton, { backgroundColor: theme.accent }]}
                onPress={() => setShowAddForm(true)}
              >
                <IconSymbol name="plus" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </ThemedBackground>
    </>
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
    padding: 20,
    paddingBottom: 40,
  },

  saveViewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  saveView: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  saveViewText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  chartContainer: {
    marginBottom: 20,
    alignItems: 'center',
    width: '100%', // Volle Breite nutzen
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    width: '100%',
    justifyContent: 'center', // Zentriert den Chart horizontal
  },
  // yAxisLabel wurde entfernt, da kg jetzt direkt in den Y-Achsenwerten angezeigt wird
  chart: {
    borderRadius: 16,
    marginVertical: 8,
    paddingHorizontal: 10, // Gleichmäßiger Abstand auf beiden Seiten
  },
  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  emptyChartText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  entriesContainer: {
    gap: 16,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  sectionTitleSleepLike: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
    fontSize: 15,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.1,
  },
  entryItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  entryDate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  entryWeight: {
    fontSize: 18,
    marginBottom: 4,
  },
  entryNotes: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 80, // Höher positioniert, um nicht vom Navigationsbalken verdeckt zu werden
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 100,
  },
  addFormContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    marginVertical: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
