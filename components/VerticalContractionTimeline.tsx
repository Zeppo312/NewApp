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

// Funktion zur Bestimmung des Icons basierend auf der Intensität
const getIntensityIcon = (intensity: string | null): string => {
  if (!intensity) return '❓'; // Fragezeichen für unbekannte Intensität

  switch (intensity.toLowerCase()) {
    case 'schwach':
      return '💧'; // Wassertropfen für schwache Intensität
    case 'mittel':
      return '💦'; // Mehrere Tropfen für mittlere Intensität
    case 'stark':
      return '🌊'; // Welle für hohe Intensität
    default:
      return '❓'; // Fragezeichen für unbekannte Intensität
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
                    <View style={styles.dotContainer}>
                      <View
                        style={[
                          styles.contractionDot,
                          { backgroundColor: getIntensityColor(contraction.intensity) }
                        ]}
                      >
                        <Text style={styles.intensityIconText}>
                          {getIntensityIcon(contraction.intensity)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.lineBelow, index === sortedContractions.length - 1 && styles.lastLineBelow]} />
                  </View>

                  {/* Rechte Spalte: Details */}
                  <View style={styles.detailsColumn}>
                    <View style={styles.contractionDetails}>
                      <View style={styles.detailContent}>
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Text style={styles.detailIcon}>⏱</Text>
                          </View>
                          <View style={styles.detailTextContainer}>
                            <ThemedText style={styles.detailLabel}>Dauer</ThemedText>
                            <ThemedText style={styles.detailValue}>
                              {formatDuration(contraction.duration)}
                            </ThemedText>
                          </View>
                        </View>

                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Text style={styles.detailIcon}>⌛</Text>
                          </View>
                          <View style={styles.detailTextContainer}>
                            <ThemedText style={styles.detailLabel}>Abstand</ThemedText>
                            <ThemedText style={styles.detailValue}>
                              {formatInterval(contraction.interval)}
                            </ThemedText>
                          </View>
                        </View>

                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Text style={styles.detailIcon}>{getIntensityIcon(contraction.intensity)}</Text>
                          </View>
                          <View style={styles.detailTextContainer}>
                            <ThemedText style={styles.detailLabel}>Stärke</ThemedText>
                            <ThemedText style={[
                              styles.detailValue,
                              styles.intensityText,
                              { color: getIntensityColor(contraction.intensity) }
                            ]}>
                              {contraction.intensity || 'Unbekannt'}
                            </ThemedText>
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => onDeleteContraction(contraction.id)}
                      >
                        <Text style={styles.deleteButtonIcon}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Abstand und ggf. Datumstrenner */}
                <View style={{ height: spacingHeight }} />

                {showDateSeparator && (
                  <View style={styles.dateSeparatorContainer}>
                    <View style={styles.dateHeader}>
                      <Text style={styles.dateText}>
                        {formatDate(nextContraction!.startTime)}
                      </Text>
                    </View>
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
    borderRadius: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#5C4033', // Wärmerer Braunton
  },
  scrollView: {
    maxHeight: 500, // Begrenzte Höhe, damit die ScrollView nicht zu groß wird
  },
  timeline: {
    paddingBottom: 20,
    paddingTop: 10,
    paddingHorizontal: 5,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    zIndex: 1,
  },
  timeColumn: {
    width: 50,
    alignItems: 'flex-end',
    paddingTop: 12,
    paddingRight: 10,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5C4033', // Wärmerer Braunton
  },
  lineColumn: {
    width: 30,
    alignItems: 'center',
    zIndex: 2,
  },
  lineAbove: {
    width: 2,
    height: 40,
    backgroundColor: '#E6D7C3', // Warmer Beigeton
  },
  firstLineAbove: {
    // Erste Linie oben ist kürzer
    height: 15,
    backgroundColor: 'transparent',
  },
  lineBelow: {
    width: 2,
    height: 40,
    backgroundColor: '#E6D7C3', // Warmer Beigeton
  },
  lastLineBelow: {
    // Letzte Linie unten ist kürzer
    height: 15,
  },
  dotContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  contractionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intensityIconText: {
    fontSize: 12,
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 10,
  },
  contractionDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
    paddingBottom: 5,
  },
  detailContent: {
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(230, 215, 195, 0.3)', // Heller Beigeton
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailIcon: {
    fontSize: 16,
    textAlign: 'center',
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5C4033', // Wärmerer Braunton
  },
  intensityText: {
    fontWeight: 'bold',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
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
  // Styles für Tagesgrenzen
  dateSeparatorContainer: {
    marginVertical: 20,
    paddingLeft: 50, // Gleicher Abstand wie die Timeline
    position: 'relative',
  },
  dateHeader: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    backgroundColor: '#F2E6DD', // Warmer Beigeton
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#5C4033', // Wärmerer Braunton
  },
  // Styles für Zeitlücken
  timeGapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingLeft: 80, // Mehr Einrückung für Zeitlücken
  },
  timeGapLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(230, 215, 195, 0.5)', // Heller Beigeton
  },
  timeGapText: {
    fontSize: 12,
    color: '#8D7B68', // Wärmerer Grauton
    fontStyle: 'italic',
    marginHorizontal: 10,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
    color: '#8D7B68', // Wärmerer Grauton
  },
});

export default VerticalContractionTimeline;
