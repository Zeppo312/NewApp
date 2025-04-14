import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, Dimensions, TouchableOpacity, Modal, FlatList } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

// Typ für die Wehen-Daten
type Contraction = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null; // in seconds
  interval: number | null; // time since last contraction in seconds
  intensity: string | null; // Stärke der Wehe (schwach, mittel, stark)
};

// Props für die Komponente
type ContractionChartProps = {
  contractions: Contraction[];
  lightColor?: string;
  darkColor?: string;
};

// Einheitliche Farbe für alle Wehen
const getContractionColor = (): string => {
  return '#FF9A8A'; // Korallrot für alle Wehen
};

// Formatierung der Zeit für die Anzeige
const formatTime = (date: Date, showDate: boolean = false): string => {
  if (showDate) {
    // Format: "DD.MM. HH:MM"
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}. ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Prüft, ob zwei Daten am selben Tag sind
const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
};

// Formatiert das Datum für die Anzeige im Tagesfilter
const formatDateForFilter = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) {
    return 'Heute';
  } else if (isSameDay(date, yesterday)) {
    return 'Gestern';
  } else {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  }
};

// Gruppiert Wehen nach Tagen
const groupContractionsByDay = (contractions: Contraction[]): { [key: string]: Contraction[] } => {
  const grouped: { [key: string]: Contraction[] } = {};

  contractions.forEach(contraction => {
    const date = new Date(contraction.startTime);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }

    grouped[dateKey].push(contraction);
  });

  return grouped;
};

// Formatierung der Dauer in Minuten und Sekunden oder Stunden und Minuten
const formatDuration = (seconds: number): string => {
  // Wenn die Dauer größer als 60 Minuten ist, in Stunden und Minuten anzeigen
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }
};

const ContractionChart: React.FC<ContractionChartProps> = ({
  contractions,
  lightColor = '#FFFFFF',
  darkColor = '#333333'
}) => {
  // State für den Tooltip
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    time: string;
    duration: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Gruppiere Wehen nach Tagen
  const contractionsByDay = groupContractionsByDay(contractions);

  // Sortiere die Tage absteigend (neueste zuerst)
  const dayKeys = Object.keys(contractionsByDay).sort().reverse();

  // Wenn kein Tag ausgewählt ist, wähle den neuesten Tag
  useEffect(() => {
    if (dayKeys.length > 0 && !selectedDay) {
      setSelectedDay(dayKeys[0]);
    }
  }, [dayKeys, selectedDay]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 40; // Abstand links und rechts

  // Filtere Wehen nach ausgewähltem Tag
  const filteredContractions = selectedDay ? contractionsByDay[selectedDay] || [] : contractions;

  // Sortieren der Wehen nach Startzeit (älteste zuerst)
  const sortedContractions = [...filteredContractions].sort((a, b) =>
    a.startTime.getTime() - b.startTime.getTime()
  );

  // Wenn keine Wehen vorhanden sind
  if (contractions.length === 0) {
    return (
      <ThemedView style={styles.container} lightColor={lightColor} darkColor={darkColor}>
        <ThemedText style={styles.noDataText}>
          Noch keine Wehen aufgezeichnet.
        </ThemedText>
      </ThemedView>
    );
  }

  // Wenn keine Wehen für den ausgewählten Tag vorhanden sind
  if (sortedContractions.length === 0 && selectedDay) {
    return (
      <ThemedView style={styles.container} lightColor={lightColor} darkColor={darkColor}>
        <View style={styles.dayFilterContainer}>
          {dayKeys.map(dayKey => {
            const date = new Date(parseInt(dayKey.split('-')[0]), parseInt(dayKey.split('-')[1]), parseInt(dayKey.split('-')[2]));
            return (
              <TouchableOpacity
                key={dayKey}
                style={[
                  styles.dayFilterButton,
                  selectedDay === dayKey && styles.selectedDayButton
                ]}
                onPress={() => setSelectedDay(dayKey)}
              >
                <Text style={[
                  styles.dayFilterButtonText,
                  selectedDay === dayKey && styles.selectedDayButtonText
                ]}>
                  {formatDateForFilter(date)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <ThemedText style={styles.noDataText}>
          Keine Wehen an diesem Tag aufgezeichnet.
        </ThemedText>
      </ThemedView>
    );
  }

  // Berechnung des Zeitraums für die Skalierung
  const firstTime = sortedContractions[0].startTime.getTime();
  const lastTime = sortedContractions[sortedContractions.length - 1].endTime
    ? sortedContractions[sortedContractions.length - 1].endTime!.getTime()
    : sortedContractions[sortedContractions.length - 1].startTime.getTime() +
      (sortedContractions[sortedContractions.length - 1].duration || 0) * 1000;

  const timeRange = lastTime - firstTime;

  // Fester Skalierungsfaktor für die Breite der Balken
  // Wir verwenden einen festen Wert von 20 Pixeln pro Minute, um genügend Platz zwischen den Balken zu haben
  const pixelsPerMinute = 20; // Fester Wert für bessere Lesbarkeit
  const chartContentWidth = Math.max(chartWidth, (timeRange / 1000 / 60) * pixelsPerMinute + 100); // Extra Platz am Ende

  // Höhe eines Balkens
  const barHeight = 30;

  return (
    <ThemedView style={styles.container} lightColor={lightColor} darkColor={darkColor}>
      <ThemedText style={styles.title}>Wehenverlauf</ThemedText>

      {/* Tagesfilter */}
      <View style={styles.dayFilterContainer}>
        {dayKeys.map(dayKey => {
          const date = new Date(parseInt(dayKey.split('-')[0]), parseInt(dayKey.split('-')[1]), parseInt(dayKey.split('-')[2]));
          return (
            <TouchableOpacity
              key={dayKey}
              style={[
                styles.dayFilterButton,
                selectedDay === dayKey && styles.selectedDayButton
              ]}
              onPress={() => setSelectedDay(dayKey)}
            >
              <Text style={[
                styles.dayFilterButtonText,
                selectedDay === dayKey && styles.selectedDayButtonText
              ]}>
                {formatDateForFilter(date)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.scrollView}
        contentContainerStyle={{ paddingHorizontal: 10 }}
        decelerationRate="normal"
        snapToAlignment="start"
      >
        <View style={[styles.chartContent, { width: chartContentWidth }]}>
          {/* Zeitachse - entfernt, da wir jetzt eine bessere Zeitachse unten haben */}
          <View style={styles.timeAxisPlaceholder} />

          {/* Wehen-Balken */}
          <View style={styles.bars}>
            {sortedContractions.map((contraction, index) => {
              if (!contraction.duration) return null;

              const barWidth = (contraction.duration / 60) * pixelsPerMinute;
              const barLeft = ((contraction.startTime.getTime() - firstTime) / 1000 / 60) * pixelsPerMinute;

              // Intensität wird nicht mehr angezeigt

              return (
                <View key={contraction.id} style={styles.barContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setTooltipData({
                        time: formatTime(contraction.startTime),
                        duration: formatDuration(contraction.duration),
                        x: barLeft + barWidth / 2,
                        y: 30, // Position über dem Balken
                      });
                      setTooltipVisible(true);

                      // Tooltip nach 3 Sekunden ausblenden
                      setTimeout(() => {
                        setTooltipVisible(false);
                      }, 3000);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          width: Math.max(barWidth, 8), // Mindestbreite 8px für bessere Sichtbarkeit
                          left: barLeft,
                          backgroundColor: getContractionColor(),
                          height: barHeight,
                          // Schatten für bessere Sichtbarkeit
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.2,
                          shadowRadius: 1.5,
                          elevation: 2,
                          // Rand für bessere Abgrenzung
                          borderWidth: 1,
                          borderColor: 'rgba(0,0,0,0.15)',
                          // Abgerundete Ecken für bessere Optik
                          borderRadius: 4
                        }
                      ]}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.durationLabel, { left: barLeft + barWidth / 2 }]}>
                    {formatDuration(contraction.duration)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Zeitachse am unteren Rand */}
          <View style={styles.bottomTimeAxis}>
            {/* Zeitmarken alle 15 Minuten für bessere Granularität */}
            {Array.from({ length: Math.ceil(timeRange / (15 * 60 * 1000)) + 1 }).map((_, i) => {
              const timeOffset = i * 15 * 60 * 1000; // 15 Minuten in Millisekunden
              const markerTime = new Date(firstTime + timeOffset);
              const markerPosition = (timeOffset / 1000 / 60) * pixelsPerMinute;

              // Prüfen, ob ein neuer Tag beginnt
              const previousMarkerTime = i > 0 ? new Date(firstTime + (i - 1) * 15 * 60 * 1000) : null;
              const isNewDay = previousMarkerTime && !isSameDay(markerTime, previousMarkerTime);

              // Prüfen, ob genügend Platz für diesen Zeitstempel vorhanden ist
              // Wir zeigen nur jeden zweiten Zeitstempel an, um Überlappungen zu vermeiden
              // Aber wir zeigen immer einen Zeitstempel an, wenn ein neuer Tag beginnt
              const showLabel = isNewDay || i % 2 === 0;

              return (
                <View key={`marker-${i}`} style={styles.timeMarker}>
                  {/* Wenn ein neuer Tag beginnt, zeigen wir eine spezielle Markierung an */}
                  {isNewDay && (
                    <View
                      style={[styles.dayDivider, { left: markerPosition }]}
                    />
                  )}
                  <View
                    style={[
                      styles.timeMarkerLine,
                      { left: markerPosition },
                      // Hervorhebung für Tageswechsel
                      isNewDay && styles.newDayMarkerLine
                    ]}
                  />
                  {showLabel && (
                    <Text
                      style={[
                        styles.timeMarkerLabel,
                        { left: markerPosition },
                        // Hervorhebung für Tageswechsel
                        isNewDay && styles.newDayMarkerLabel
                      ]}
                    >
                      {formatTime(markerTime, isNewDay)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Legende entfernt */}

          {/* Tooltip */}
          {tooltipVisible && tooltipData && (
            <View
              style={[
                styles.tooltip,
                {
                  left: tooltipData.x,
                  top: tooltipData.y
                }
              ]}
            >
              <Text style={styles.tooltipText}>
                {tooltipData.time} – {tooltipData.duration}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    padding: 10,
    borderRadius: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  // Styles für den Tagesfilter
  dayFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    justifyContent: 'center',
  },
  dayFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  selectedDayButton: {
    backgroundColor: '#FF9A8A',
    borderColor: '#FF7A6A',
  },
  dayFilterButtonText: {
    fontSize: 12,
    color: '#444444',
  },
  selectedDayButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollView: {
    marginBottom: 10,
  },
  chartContent: {
    paddingTop: 10, // Reduzierter Platz, da keine Zeitlabels mehr oben
    paddingBottom: 80, // Mehr Platz für Zeitachse und Legende
    position: 'relative', // Für absolute Positionierung des Tooltips
  },
  timeAxisPlaceholder: {
    height: 10, // Reduzierte Höhe, da keine Labels mehr angezeigt werden
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    position: 'relative',
  },
  bars: {
    height: 60, // Erhöhte Höhe für Balken und Labels
    position: 'relative',
  },
  barContainer: {
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    top: 10,
    borderRadius: 4, // Abgerundete Ecken für einen weicheren Look
    marginHorizontal: 2, // Mehr Abstand zwischen den Balken
  },
  durationLabel: {
    position: 'absolute',
    top: 45,
    fontSize: 10, // Größere Schrift
    fontWeight: '500', // Etwas fetter für bessere Lesbarkeit
    color: '#555555', // Dunklere Farbe für besseren Kontrast
    transform: [{ translateX: -12 }], // Zentrieren des Labels
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Hintergrund für bessere Lesbarkeit
    paddingHorizontal: 2,
    borderRadius: 2,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
    color: '#999999',
  },
  // Styles für die Zeitachse am unteren Rand
  bottomTimeAxis: {
    height: 40, // Mehr Höhe für bessere Lesbarkeit
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    position: 'relative',
    marginTop: 20,
  },
  timeMarker: {
    position: 'relative',
  },
  timeMarkerLine: {
    position: 'absolute',
    height: 8, // Längere Linie
    width: 1,
    backgroundColor: '#AAAAAA', // Dunklere Farbe für bessere Sichtbarkeit
    top: 0,
  },
  timeMarkerLabel: {
    position: 'absolute',
    fontSize: 11, // Größere Schrift
    fontWeight: '500', // Etwas fetter für bessere Lesbarkeit
    color: '#444444', // Dunklere Farbe für besseren Kontrast
    top: 12, // Mehr Abstand zur Linie
    transform: [{ translateX: -15 }], // Zentrieren des Labels
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // Hintergrund für bessere Lesbarkeit
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  // Styles für Tageswechsel
  dayDivider: {
    position: 'absolute',
    height: 80, // Höher als die normale Zeitachse
    width: 1.5, // Etwas breiter als normale Linien
    backgroundColor: '#FF9A8A', // Auffällige Farbe für Tageswechsel
    top: -60, // Nach oben versetzt, um in den Bereich der Balken zu ragen
    zIndex: 10, // Über anderen Elementen
  },
  newDayMarkerLine: {
    height: 12, // Längere Linie für Tageswechsel
    width: 2, // Dicker für Tageswechsel
    backgroundColor: '#FF9A8A', // Auffällige Farbe für Tageswechsel
  },
  newDayMarkerLabel: {
    fontWeight: '700', // Fetter für Tageswechsel
    backgroundColor: 'rgba(255, 154, 138, 0.2)', // Leicht eingefärbter Hintergrund
    borderWidth: 1,
    borderColor: '#FF9A8A',
    color: '#333333', // Dunklere Textfarbe für besseren Kontrast
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  // Styles für den Tooltip
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 5,
    transform: [{ translateX: -50 }], // Zentrieren des Tooltips
    zIndex: 1000,
  },
  tooltipText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  // Styles für die Legende entfernt
});

export default ContractionChart;
