import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Dimensions, TouchableOpacity, Modal } from 'react-native';
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

// Funktion zur Bestimmung der Farbe basierend auf der Intensität
const getIntensityColor = (intensity: string | null): string => {
  if (!intensity) return '#D0D0D0'; // Hellgrau für unbekannte Intensität

  switch (intensity.toLowerCase()) {
    case 'schwach':
      return '#A8D8A8'; // Pastellgrün für schwache Intensität
    case 'mittel':
      return '#FFD8A8'; // Apricot für mittlere Intensität
    case 'stark':
      return '#FF9A8A'; // Korallrot für hohe Intensität
    default:
      return '#D0D0D0'; // Hellgrau für unbekannte Intensität
  }
};

// Formatierung der Zeit für die Anzeige
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Formatierung der Dauer in Minuten und Sekunden
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
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
    intensity: string;
    duration: string;
    x: number;
    y: number;
  } | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 40; // Abstand links und rechts

  // Sortieren der Wehen nach Startzeit (älteste zuerst)
  const sortedContractions = [...contractions].sort((a, b) =>
    a.startTime.getTime() - b.startTime.getTime()
  );

  // Wenn keine Wehen vorhanden sind
  if (sortedContractions.length === 0) {
    return (
      <ThemedView style={styles.container} lightColor={lightColor} darkColor={darkColor}>
        <ThemedText style={styles.noDataText}>
          Noch keine Wehen aufgezeichnet.
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

              // Intensität als Text für den Tooltip
              const intensityText = contraction.intensity
                ? contraction.intensity.charAt(0).toUpperCase() + contraction.intensity.slice(1)
                : 'Unbekannt';

              return (
                <View key={contraction.id} style={styles.barContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setTooltipData({
                        time: formatTime(contraction.startTime),
                        intensity: intensityText,
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
                          backgroundColor: getIntensityColor(contraction.intensity),
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

              // Prüfen, ob genügend Platz für diesen Zeitstempel vorhanden ist
              // Wir zeigen nur jeden zweiten Zeitstempel an, um Überlappungen zu vermeiden
              const showLabel = i % 2 === 0;

              return (
                <View key={`marker-${i}`} style={styles.timeMarker}>
                  <View
                    style={[styles.timeMarkerLine, { left: markerPosition }]}
                  />
                  {showLabel && (
                    <Text
                      style={[styles.timeMarkerLabel, { left: markerPosition }]}
                    >
                      {formatTime(markerTime)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Legende */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: getIntensityColor('schwach') }]} />
              <Text style={styles.legendText}>Schwach</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: getIntensityColor('mittel') }]} />
              <Text style={styles.legendText}>Mittel</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: getIntensityColor('stark') }]} />
              <Text style={styles.legendText}>Stark</Text>
            </View>
          </View>

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
                {tooltipData.time} – {tooltipData.intensity} – {tooltipData.duration}
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666666',
  },
});

export default ContractionChart;
