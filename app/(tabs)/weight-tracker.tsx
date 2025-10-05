import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, Modal, SafeAreaView, StatusBar, Text } from 'react-native';
import { BlurView } from 'expo-blur';
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
import { supabase } from '@/lib/supabase';
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
  // Legacy inline form flag removed in favor of modal
  const [showAddForm, setShowAddForm] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [selectedRange, setSelectedRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
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
      if (editingEntry?.id) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from('weight_entries')
          .update({
            date: formattedDate,
            weight: weightValue,
            notes: notes.trim() || null,
            updated_at: nowIso,
          })
          .eq('id', editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await saveWeightEntry({
          date: formattedDate,
          weight: weightValue,
          notes: notes.trim() || undefined
        });
        if (error) throw error;
      }

      // Lade Gewichtsdaten neu
      setIsLoading(true);
      await loadWeightEntries();
      setWeight('');
      setNotes('');
      setDate(new Date());
      setShowInputModal(false);
      setEditingEntry(null);
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

  // Bereite die Daten für das Diagramm vor (nach Range)
  const prepareChartData = (range: 'week' | 'month' | 'year' | 'all') => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const sortedEntries = [...weightEntries].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const now = new Date();

    // Kein Datensatz -> leeres Chart
    if (sortedEntries.length === 0) {
      return { labels: [], datasets: [{ data: [] as number[], color: (o = 1) => `rgba(94, 61, 179, ${o})`, strokeWidth: 3 }], legend: ['Gewicht'] };
    }

    if (range === 'week') {
      const labels: string[] = [];
      const data: number[] = [];
      // Letzte 7 Tage betrachten; nur Tage mit Eintrag anzeigen (letzter pro Tag)
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        const entriesOfDay = sortedEntries.filter(e => e.date === dayStr);
        if (entriesOfDay.length > 0) {
          const last = entriesOfDay[entriesOfDay.length - 1];
          labels.push(`${d.getDate()}.${d.getMonth() + 1}.`);
          data.push(last.weight);
        }
      }
      return {
        labels,
        datasets: [{ data, color: (o = 1) => `rgba(94, 61, 179, ${o})`, strokeWidth: 3 }],
        legend: ['Gewicht']
      };
    }

    if (range === 'month') {
      const labelsRaw: string[] = [];
      const data: number[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        const entriesOfDay = sortedEntries.filter(e => e.date === dayStr);
        if (entriesOfDay.length > 0) {
          const last = entriesOfDay[entriesOfDay.length - 1];
          labelsRaw.push(`${d.getDate()}.${d.getMonth() + 1}.`);
          data.push(last.weight);
        }
      }
      const maxLabels = 12;
      const step = Math.max(1, Math.ceil(labelsRaw.length / maxLabels));
      const labels = labelsRaw.map((l, i) => (i % step === 0 ? l : ''));
      return {
        labels,
        datasets: [{ data, color: (o = 1) => `rgba(94, 61, 179, ${o})`, strokeWidth: 3 }],
        legend: ['Gewicht']
      };
    }

    if (range === 'year') {
      // Aggregiere nach Wochen (letzte 52 Wochen), nur Wochen mit Eintrag anzeigen
      const start = new Date(now);
      start.setDate(start.getDate() - 364);
      const filtered = sortedEntries.filter(e => new Date(e.date) >= start);

      // Finde Wochen-Montag (lokal, Mo=0)
      const weekStart = (d: Date) => {
        const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const day = (dt.getDay() + 6) % 7; // Mo=0..So=6
        dt.setDate(dt.getDate() - day);
        return dt;
      };

      const toWeekKey = (d: Date) => {
        const ws = weekStart(d);
        return `${ws.getFullYear()}-${pad(ws.getMonth() + 1)}-${pad(ws.getDate())}`;
      };

      const byWeek: Record<string, WeightEntry> = {};
      filtered.forEach(e => {
        const key = toWeekKey(new Date(e.date));
        byWeek[key] = e; // letzter Eintrag in dieser Woche
      });

      // Laufe über alle Wochen im Zeitraum und sammle vorhandene Wochenpunkte
      const firstWs = weekStart(start);
      const weeks: { label: string; value: number }[] = [];
      for (let i = 0; i < 54; i++) {
        const d = new Date(firstWs.getFullYear(), firstWs.getMonth(), firstWs.getDate() + i * 7);
        if (d > now) break;
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const entry = byWeek[key];
        if (entry) {
          weeks.push({ label: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`, value: entry.weight });
        }
      }

      const labelsRaw = weeks.map(w => w.label);
      const data = weeks.map(w => w.value);
      const maxLabels = 12;
      const step = Math.max(1, Math.ceil(labelsRaw.length / maxLabels));
      const labels = labelsRaw.map((l, i) => (i % step === 0 ? l : ''));
      return {
        labels,
        datasets: [{ data, color: (o = 1) => `rgba(94, 61, 179, ${o})`, strokeWidth: 3 }],
        legend: ['Gewicht']
      };
    }

    // 'all' – alle Einträge
    const labelsRaw = sortedEntries.map(entry => {
      const d = new Date(entry.date);
      return `${d.getDate()}.${d.getMonth() + 1}.`;
    });
    const data = sortedEntries.map(entry => entry.weight);
    const maxLabels = 12;
    const step = Math.max(1, Math.ceil(labelsRaw.length / maxLabels));
    const labels = labelsRaw.map((l, i) => (i % step === 0 ? l : ''));
    return {
      labels,
      datasets: [{ data, color: (o = 1) => `rgba(94, 61, 179, ${o})`, strokeWidth: 3 }],
      legend: ['Gewicht']
    };
  };

  const chartData = prepareChartData(selectedRange);

  // Rendere die Gewichtskurve
  const renderWeightChart = () => {
    if (!chartData || !chartData.datasets || chartData.datasets[0].data.length < 2) {
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
      <>
        {/* Range Tabs */}
        <View style={styles.topTabsContainer}>
          {([
            { id: 'week', label: 'Woche' },
            { id: 'month', label: 'Monat' },
            { id: 'year', label: 'Jahr' },
            { id: 'all', label: 'Gesamt' },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.topTab, selectedRange === t.id && styles.activeTopTab]}
              onPress={() => setSelectedRange(t.id)}
            >
              <View style={styles.topTabInner}><Text style={[styles.topTabText, selectedRange === t.id && styles.activeTopTabText]}>{t.label}</Text></View>
            </TouchableOpacity>
          ))}
        </View>
        <LiquidGlassCard style={styles.chartContainer} intensity={26} overlayColor={GLASS_OVERLAY}>
        <View style={styles.chartWrapper}>
          <LineChart
          data={chartData}
          width={screenWidth - LAYOUT_PAD * 2}
          height={220}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: 'transparent',
            backgroundGradientTo: 'transparent',
            decimalPlaces: 0, // Keine Dezimalstellen für kg-Werte
            color: () => theme.text,
            labelColor: () => theme.text,
            style: {
              borderRadius: 22
            },
            propsForDots: {
              r: '5',
              strokeWidth: '2',
              stroke: '#5E3DB3',
              fill: '#5E3DB3'
            },
            // Formatierung der Y-Achsen-Labels (kg-Anzeige)
            formatYLabel: (value) => `${value} kg`, // Mit kg-Suffix bei jedem Wert
            // Mehr Platz zwischen den Datenpunkten
            propsForBackgroundLines: {
              strokeWidth: 1,
              stroke: 'rgba(0,0,0,0.06)'
            },
            // Anpassung der Beschriftungen
            propsForLabels: {
              fontSize: 12,
              fontWeight: '600'
            },
            // Spezifische Anpassung der Y-Achsen-Labels
            propsForVerticalLabels: {
              fontSize: 12,
              fontWeight: '500'
            },
            // Spezifische Anpassung der X-Achsen-Labels
            propsForHorizontalLabels: {
              fontSize: 12,
              fontWeight: '600',
              dy: -2,
              rotation: 0
            },
            fillShadowGradientFrom: '#5E3DB3',
            fillShadowGradientFromOpacity: 0.15,
            fillShadowGradientTo: '#5E3DB3',
            fillShadowGradientToOpacity: 0.02
          }}
          transparent
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
      </>
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
              onEdit={() => {
                setEditingEntry(entry);
                setWeight(String(entry.weight));
                setNotes(entry.notes || '');
                setDate(new Date(entry.date));
                setShowInputModal(true);
              }}
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

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={styles.loadingText} lightColor="#888" darkColor="#E9D8C2">Daten werden geladen...</ThemedText>
              </View>
            ) : (
              <>
                {renderWeightChart()}
                {renderWeightEntries()}
              </>
            )}
            </ScrollView>

            {/* Floating Add Button - nur anzeigen, wenn nicht im Formular-Modus */}
            {!showInputModal && !isLoading && (
              <TouchableOpacity
                style={[styles.floatingAddButton, { backgroundColor: '#5E3DB3' }]}
                onPress={() => { setEditingEntry(null); setWeight(''); setNotes(''); setDate(new Date()); setShowInputModal(true); }}
              >
                <IconSymbol name="plus" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {/* Add Entry Modal (like sleep-tracker) */}
            <Modal 
              visible={showInputModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowInputModal(false)}
            >
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowInputModal(false)} activeOpacity={1} />

                <BlurView style={styles.modalContent} tint="extraLight" intensity={80}>
                  {/* Header */}
                  <View style={styles.header}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => setShowInputModal(false)}>
                      <Text style={styles.closeHeaderButtonText}>✕</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                      <Text style={styles.modalTitle}>{editingEntry ? 'Gewicht bearbeiten' : 'Gewicht hinzufügen'}</Text>
                      <Text style={styles.modalSubtitle}>{editingEntry ? 'Daten anpassen' : 'Neuen Eintrag erstellen'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.headerButton, styles.saveHeaderButton, { backgroundColor: '#5E3DB3' }]}
                      onPress={handleSaveWeightEntry}
                      disabled={isLoading || isSaving}
                    >
                      <Text style={styles.saveHeaderButtonText}>✓</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    <TouchableOpacity activeOpacity={1}>
                      <View style={{ width: '100%', alignItems: 'center' }}>
                        {/* Datum */}
                        <View style={styles.section}>
                          <Text style={styles.sectionTitleSleepLike}>⏰ Datum</Text>
                          <TouchableOpacity style={styles.timeButton} onPress={() => setShowDatePicker(true)}>
                            <Text style={styles.timeLabel}>Datum</Text>
                            <Text style={styles.timeValue}>{date.toLocaleDateString('de-DE')}</Text>
                          </TouchableOpacity>

                          {showDatePicker && (
                            <View style={styles.datePickerContainer}>
                              <DateTimePicker
                                value={date}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                                onChange={(_, selectedDate) => {
                                  setShowDatePicker(false);
                                  if (selectedDate) setDate(selectedDate);
                                }}
                                style={styles.dateTimePicker}
                              />
                              <View style={styles.datePickerActions}>
                                <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowDatePicker(false)}>
                                  <Text style={styles.datePickerCancelText}>Fertig</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Gewicht */}
                        <View style={styles.section}>
                          <Text style={styles.sectionTitleSleepLike}>⚖️ Gewicht</Text>
                          <View style={styles.timeButton}>
                            <Text style={styles.timeLabel}>kg</Text>
                            <TextInput
                              style={[styles.timeValue, { width: '100%', textAlign: 'center', color: '#333333' }]}
                              placeholder="z.B. 65.5"
                              placeholderTextColor="#888888"
                              keyboardType="decimal-pad"
                              value={weight}
                              onChangeText={setWeight}
                            />
                          </View>
                        </View>

                        {/* Notizen */}
                        <View style={styles.section}>
                          <Text style={styles.sectionTitleSleepLike}>📝 Notizen</Text>
                          <TextInput
                            style={styles.modalNotesInput}
                            placeholder="z.B. Nach dem Sport gemessen"
                            placeholderTextColor="#888888"
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </ScrollView>
                </BlurView>
              </View>
            </Modal>
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
    padding: 0,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: LAYOUT_PAD,
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
    borderRadius: 22,
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
    borderRadius: 22,
    padding: 0,
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
    borderRadius: 22,
    marginVertical: 8,
    paddingHorizontal: 0,
  },
  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 22,
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
    width: '100%',
  },
  timelineSection: {
    paddingHorizontal: 0,
  },
  sectionTitleSleepLike: {
    marginTop: SECTION_GAP_TOP,
    marginBottom: SECTION_GAP_BOTTOM,
    paddingHorizontal: LAYOUT_PAD,
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.2,
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
    width: 64,
    height: 64,
    borderRadius: 32,
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
    borderRadius: 22,
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
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
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
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
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
    borderRadius: 22,
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
  // Top tabs (like sleep-tracker)
  topTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  topTab: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  topTabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  activeTopTab: { borderColor: 'rgba(94,61,179,0.65)' },
  topTabText: { fontSize: 13, fontWeight: '700', color: '#7D5A50' },
  activeTopTabText: { color: '#5E3DB3' },
  // Modal styles (aligned with sleep-tracker)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    height: '80%',
    maxHeight: 680,
    minHeight: 560,
    overflow: 'hidden',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  closeHeaderButtonText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#888888',
  },
  headerCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
    color: '#A8978E',
  },
  saveHeaderButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  saveHeaderButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 22,
    width: '100%',
    alignItems: 'center',
  },
  timeButton: {
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  timeLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
    marginBottom: 5,
  },
  timeValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: 'bold',
  },
  modalNotesInput: {
    width: '90%',
    minHeight: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    color: '#333333',
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  datePickerContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 15,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  dateTimePicker: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  datePickerCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#5E3DB3',
  },
  datePickerCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
