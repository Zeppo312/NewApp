import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { format, differenceInHours, differenceInMinutes, isAfter, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

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
type VerticalContractionTimelineProps = {
  contractions: Contraction[];
  onDeleteContraction: (id: string) => void;
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
  return format(date, 'HH:mm', { locale: de });
};

// Formatierung des Datums für die Anzeige
const formatDate = (date: Date): string => {
  return format(date, 'dd. MMMM', { locale: de });
};

// Formatierung der Dauer in Minuten und Sekunden
const formatDuration = (seconds: number | null): string => {
  if (seconds === null) return '-';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

// Formatierung des Intervalls in Stunden und Minuten
const formatInterval = (seconds: number | null): string => {
  if (seconds === null) return '-';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} Min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes < 10 ? '0' : ''}${remainingMinutes} Std`;
  }
};

const VerticalContractionTimeline: React.FC<VerticalContractionTimelineProps> = ({
  contractions,
  onDeleteContraction,
  lightColor = '#FFFFFF',
  darkColor = '#333333'
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Sortieren der Wehen nach Startzeit (neueste zuerst)
  const sortedContractions = [...contractions].sort((a, b) =>
    b.startTime.getTime() - a.startTime.getTime()
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

  // Berechne, ob ein Tageswechsel zwischen zwei Wehen stattfindet
  const shouldShowDateSeparator = (current: Contraction, next: Contraction | null): boolean => {
    if (!next) return false;
    return !isSameDay(current.startTime, next.startTime);
  };

  // Berechne, ob ein großer Zeitabstand zwischen zwei Wehen besteht (> 6 Stunden)
  const hasLargeTimeGap = (current: Contraction, next: Contraction | null): boolean => {
    if (!next) return false;
    return differenceInHours(current.startTime, next.startTime) >= 6;
  };

  // Berechne die Höhe des Abstands basierend auf dem Zeitunterschied
  const getSpacingHeight = (current: Contraction, next: Contraction | null): number => {
    if (!next) return 20; // Standard-Abstand am Ende

    const diffInMinutes = differenceInMinutes(current.startTime, next.startTime);

    // Dynamischerer Abstand basierend auf der Zeit
    // Minimaler Abstand: 15px, Maximaler Abstand: 150px
    // Logarithmische Skalierung für natürlicheres Gefühl
    const minSpacing = 15;
    const maxSpacing = 150;

    if (diffInMinutes <= 10) {
      // Sehr kurze Abstände (< 10 Min): minimaler Abstand
      return minSpacing;
    } else if (diffInMinutes > 10 && diffInMinutes <= 60) {
      // 10-60 Min: leicht erhöhter Abstand
      return minSpacing + (diffInMinutes - 10) * 0.5; // 0.5px pro Minute
    } else if (diffInMinutes > 60 && diffInMinutes <= 180) {
      // 1-3 Stunden: mittlerer Abstand
      return minSpacing + 25 + (diffInMinutes - 60) * 0.3; // 0.3px pro Minute
    } else if (diffInMinutes > 180 && diffInMinutes <= 720) {
      // 3-12 Stunden: größerer Abstand
      return minSpacing + 25 + 36 + (diffInMinutes - 180) * 0.1; // 0.1px pro Minute
    } else {
      // > 12 Stunden: maximaler Abstand
      return maxSpacing;
    }
  };

  return (
    <ThemedView style={styles.container} lightColor={lightColor} darkColor={darkColor}>
      <ThemedText style={styles.title}>Wehen Verlauf</ThemedText>

      <ScrollView style={styles.scrollView}>
        <View style={styles.timeline}>
          {sortedContractions.map((contraction, index) => {
            const nextContraction = index < sortedContractions.length - 1 ? sortedContractions[index + 1] : null;
            const showDateSeparator = shouldShowDateSeparator(contraction, nextContraction);
            const hasTimeGap = hasLargeTimeGap(contraction, nextContraction);
            const spacingHeight = getSpacingHeight(contraction, nextContraction);

            return (
              <React.Fragment key={contraction.id}>
                <View style={styles.timelineItem}>
                  {/* Linke Seite: Zeitstempel */}
                  <View style={styles.timeColumn}>
                    <ThemedText style={styles.timeText}>
                      {formatTime(contraction.startTime)}
                    </ThemedText>
                  </View>

                  {/* Mittlere Spalte: Linie und Punkt */}
                  <View style={styles.lineColumn}>
                    <View style={[styles.lineAbove, index === 0 && styles.firstLineAbove]} />
                    <View
                      style={[
                        styles.contractionDot,
                        { backgroundColor: getIntensityColor(contraction.intensity) }
                      ]}
                    />
                    <View style={[styles.lineBelow, index === sortedContractions.length - 1 && styles.lastLineBelow]} />
                  </View>

                  {/* Rechte Spalte: Details */}
                  <View style={styles.detailsColumn}>
                    <View style={styles.contractionDetails}>
                      <View style={styles.detailHeader}>
                        <View style={[
                          styles.intensityIndicator,
                          { backgroundColor: getIntensityColor(contraction.intensity) }
                        ]} />
                        <ThemedText style={styles.detailHeaderText}>
                          {contraction.intensity || 'Unbekannt'}
                        </ThemedText>
                        <TouchableOpacity
                          style={styles.deleteButtonSmall}
                          onPress={() => onDeleteContraction(contraction.id)}
                        >
                          <Text style={styles.deleteButtonIcon}>×</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.detailContent}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>⏱</Text>
                          <ThemedText style={styles.detailValue}>
                            {formatDuration(contraction.duration)}
                          </ThemedText>
                        </View>

                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>⌛</Text>
                          <ThemedText style={styles.detailValue}>
                            {formatInterval(contraction.interval)}
                          </ThemedText>
                        </View>

                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>🕒</Text>
                          <ThemedText style={styles.detailValue}>
                            {formatTime(contraction.startTime)}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Abstand und ggf. Datumstrenner */}
                <View style={{ height: spacingHeight }} />

                {showDateSeparator && (
                  <View style={styles.dateSeparatorContainer}>
                    <View style={styles.dateSeparator}>
                      <View style={styles.dateLine} />
                      <View style={styles.dateContainer}>
                        <Text style={styles.dateText}>
                          {formatDate(nextContraction!.startTime)}
                        </Text>
                      </View>
                      <View style={styles.dateLine} />
                    </View>
                    <View style={styles.dateBackground} />
                  </View>
                )}

                {hasTimeGap && !showDateSeparator && (
                  <View style={styles.timeGapIndicator}>
                    <View style={styles.timeGapLine} />
                    <Text style={styles.timeGapText}>
                      {differenceInHours(contraction.startTime, nextContraction!.startTime)} Stunden Pause
                    </Text>
                    <View style={styles.timeGapLine} />
                  </View>
                )}
              </React.Fragment>
            );
          })}
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
    marginBottom: 15,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 500, // Begrenzte Höhe, damit die ScrollView nicht zu groß wird
  },
  timeline: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    zIndex: 1,
  },
  timeColumn: {
    width: 45,
    alignItems: 'flex-end',
    paddingTop: 10,
    paddingRight: 8,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555555',
  },
  lineColumn: {
    width: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  lineAbove: {
    width: 2,
    height: 30,
    backgroundColor: '#CCCCCC',
  },
  firstLineAbove: {
    // Erste Linie oben ist kürzer
    height: 15,
    backgroundColor: 'transparent',
  },
  lineBelow: {
    width: 2,
    height: 30,
    backgroundColor: '#CCCCCC',
  },
  lastLineBelow: {
    // Letzte Linie unten ist kürzer
    height: 15,
  },
  contractionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
    zIndex: 3,
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 10,
  },
  contractionDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  intensityIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  detailHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  deleteButtonSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonIcon: {
    color: '#FF0000',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
    textAlign: 'center',
  },
  detailContent: {
    padding: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 8,
    width: 16,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 13,
  },
  // Styles für Tagesgrenzen
  dateSeparatorContainer: {
    position: 'relative',
    marginVertical: 15,
    zIndex: 1,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    zIndex: 3,
  },
  dateBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -10,
    bottom: -10,
    backgroundColor: 'rgba(240, 240, 240, 0.5)',
    borderRadius: 5,
    zIndex: 1,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  dateContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 10,
    zIndex: 2,
  },
  dateText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555555',
  },
  // Styles für Zeitlücken
  timeGapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  timeGapLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  timeGapText: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
    marginHorizontal: 10,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
    color: '#888888',
  },
});

export default VerticalContractionTimeline;
