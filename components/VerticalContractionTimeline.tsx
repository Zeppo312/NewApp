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
    
    // Basis-Abstand
    let spacing = 20;
    
    // Zusätzlicher Abstand basierend auf der Zeit
    if (diffInMinutes > 30 && diffInMinutes <= 120) {
      // 30 Min - 2 Stunden: leicht erhöhter Abstand
      spacing = 40;
    } else if (diffInMinutes > 120 && diffInMinutes <= 360) {
      // 2-6 Stunden: mittlerer Abstand
      spacing = 60;
    } else if (diffInMinutes > 360) {
      // > 6 Stunden: großer Abstand
      spacing = 100;
    }
    
    return spacing;
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
                    <View style={styles.lineAbove} />
                    <View 
                      style={[
                        styles.contractionDot,
                        { backgroundColor: getIntensityColor(contraction.intensity) }
                      ]} 
                    />
                    <View style={styles.lineBelow} />
                  </View>
                  
                  {/* Rechte Spalte: Details */}
                  <View style={styles.detailsColumn}>
                    <View style={styles.contractionDetails}>
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Dauer:</ThemedText>
                        <ThemedText style={styles.detailValue}>
                          {formatDuration(contraction.duration)}
                        </ThemedText>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Abstand:</ThemedText>
                        <ThemedText style={styles.detailValue}>
                          {formatInterval(contraction.interval)}
                        </ThemedText>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <ThemedText style={styles.detailLabel}>Stärke:</ThemedText>
                        <View style={[
                          styles.intensityBadge,
                          { backgroundColor: getIntensityColor(contraction.intensity) }
                        ]}>
                          <Text style={styles.intensityText}>
                            {contraction.intensity || 'Unbekannt'}
                          </Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => onDeleteContraction(contraction.id)}
                      >
                        <ThemedText style={styles.deleteButtonText}>Löschen</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                
                {/* Abstand und ggf. Datumstrenner */}
                <View style={{ height: spacingHeight }} />
                
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <View style={styles.dateLine} />
                    <View style={styles.dateContainer}>
                      <Text style={styles.dateText}>
                        {formatDate(nextContraction!.startTime)}
                      </Text>
                    </View>
                    <View style={styles.dateLine} />
                  </View>
                )}
                
                {hasTimeGap && !showDateSeparator && (
                  <View style={styles.timeGapIndicator}>
                    <Text style={styles.timeGapText}>
                      {differenceInHours(contraction.startTime, nextContraction!.startTime)} Stunden Pause
                    </Text>
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
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeColumn: {
    width: 50,
    alignItems: 'center',
    paddingTop: 10,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lineColumn: {
    width: 30,
    alignItems: 'center',
  },
  lineAbove: {
    width: 2,
    height: 20,
    backgroundColor: '#CCCCCC',
  },
  lineBelow: {
    width: 2,
    height: 20,
    backgroundColor: '#CCCCCC',
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
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 10,
  },
  contractionDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
  },
  intensityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  intensityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    alignSelf: 'flex-end',
    marginTop: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#FF0000',
    fontSize: 12,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  dateContainer: {
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  dateText: {
    fontSize: 12,
    color: '#666666',
  },
  timeGapIndicator: {
    alignItems: 'center',
    marginVertical: 5,
  },
  timeGapText: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
    color: '#888888',
  },
});

export default VerticalContractionTimeline;
