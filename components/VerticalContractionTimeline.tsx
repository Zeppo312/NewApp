import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Dimensions, Alert, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors, QualityColors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LiquidGlassCard, GLASS_OVERLAY, RADIUS } from '@/constants/DesignGuide';

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
  lightColor?: string;
  darkColor?: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, intensity: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
};

// Funktion zur Bestimmung der Farbe basierend auf der Intensität
const getIntensityColor = (intensity: string | null): string => {
  if (!intensity) return QualityColors.unknown; // Hellgrau für unbekannte Intensität

  switch (intensity.toLowerCase()) {
    case 'schwach':
      return QualityColors.good; // Pastellgrün für schwache Intensität
    case 'mittel':
      return QualityColors.medium; // Apricot für mittlere Intensität
    case 'stark':
      return QualityColors.bad; // Korallrot für hohe Intensität
    default:
      return QualityColors.unknown; // Hellgrau für unbekannte Intensität
  }
};

// Formatierung der Zeit für die Anzeige
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Formatierung des Datums für die Anzeige
const formatDate = (date: Date): string => {
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

// Prüft, ob zwei Daten am selben Tag sind
const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
};

// Formatierung der Dauer in Minuten und Sekunden
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Formatierung des Intervalls
const formatInterval = (seconds: number): string => {
  // Wenn der Abstand größer als 60 Minuten ist, in Stunden und Minuten anzeigen
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}min`;
  } else {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}min ${secs}s`;
  }
};

const VerticalContractionTimeline: React.FC<VerticalContractionTimelineProps> = ({
  contractions,
  lightColor = '#FFFFFF',
  darkColor = '#333333',
  onDelete,
  onEdit,
  containerStyle
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Sortieren der Wehen nach Startzeit (neueste zuerst)
  const sortedContractions = [...contractions].sort((a, b) =>
    b.startTime.getTime() - a.startTime.getTime()
  );

  // Gruppieren der Wehen nach Tagen
  const groupedContractions: { [key: string]: Contraction[] } = {};

  sortedContractions.forEach(contraction => {
    const date = new Date(contraction.startTime);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (!groupedContractions[dateKey]) {
      groupedContractions[dateKey] = [];
    }

    groupedContractions[dateKey].push(contraction);
  });

  // Wenn keine Wehen vorhanden sind
  if (contractions.length === 0) {
    return (
      <LiquidGlassCard style={[styles.glass, containerStyle]} intensity={26} overlayColor={GLASS_OVERLAY}>
        <View style={styles.inner}>
          <ThemedText style={styles.noDataText}>
            Noch keine Wehen aufgezeichnet.
          </ThemedText>
        </View>
      </LiquidGlassCard>
    );
  }

  // Toggle für erweiterte Kartenansicht
  const toggleCardExpansion = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  // Funktion zum Löschen einer Wehe mit Bestätigungsdialog
  const handleDelete = (id: string) => {
    if (!onDelete) return;

    Alert.alert(
      'Wehe löschen',
      'Möchtest du diese Wehe wirklich löschen?',
      [
        {
          text: 'Abbrechen',
          style: 'cancel'
        },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            // Kleine Verzögerung, um sicherzustellen, dass die UI aktualisiert ist
            setTimeout(() => {
              console.log('Deleting contraction with ID:', id);
              onDelete(id);
            }, 300); // Längere Verzögerung für mehr Stabilität
          }
        }
      ]
    );
  };

  // Funktion zum Bearbeiten der Intensität einer Wehe
  const handleEdit = (id: string) => {
    if (!onEdit) return;

    // Finde die Wehe mit der angegebenen ID
    const contraction = contractions.find(c => c.id === id);
    if (!contraction) return;

    // Zeige einen Dialog zur Auswahl der Intensität
    Alert.alert(
      'Intensität bearbeiten',
      'Wähle die neue Intensität der Wehe:',
      [
        {
          text: '🟢 Schwach',
          onPress: () => onEdit(id, 'schwach')
        },
        {
          text: '🟠 Mittel',
          onPress: () => onEdit(id, 'mittel')
        },
        {
          text: '🔴 Stark',
          onPress: () => onEdit(id, 'stark')
        },
        {
          text: 'Abbrechen',
          style: 'cancel'
        }
      ]
    );
  };

  return (
    <LiquidGlassCard style={[styles.glass, containerStyle]} intensity={26} overlayColor={GLASS_OVERLAY}>
      <View style={styles.inner}>
        <ThemedText style={styles.title}>Wehenverlauf</ThemedText>

        <ScrollView style={styles.scrollView}>
          {Object.keys(groupedContractions).map(dateKey => {
          const date = new Date(parseInt(dateKey.split('-')[0]), parseInt(dateKey.split('-')[1]), parseInt(dateKey.split('-')[2]));
          const dayContractions = groupedContractions[dateKey];

          return (
            <View key={dateKey} style={styles.dayContainer}>
              <View style={styles.dateHeader}>
                <ThemedText style={styles.dateText}>
                  {formatDate(date)}
                </ThemedText>
              </View>

              <View style={styles.timeline}>
                {dayContractions.map((contraction, index) => {
                  const isLast = index === dayContractions.length - 1;
                  const isExpanded = expandedCard === contraction.id;

                  return (
                    <View key={contraction.id} style={styles.timelineItem}>
                      {/* Zeitstempel */}
                      <View style={styles.timeColumn}>
                        <ThemedText style={styles.timeText}>
                          {formatTime(new Date(contraction.startTime))}
                        </ThemedText>
                      </View>

                      {/* Timeline-Linie und Punkt */}
                      <View style={styles.lineColumn}>
                        <View style={[
                          styles.timelineDot,
                          { backgroundColor: getIntensityColor(contraction.intensity) }
                        ]} />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>

                      {/* Wehen-Karte */}
                      <View style={styles.cardColumn}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => toggleCardExpansion(contraction.id)}
                        >
                          <ThemedView
                            style={[
                              styles.contractionCard,
                              { borderLeftColor: getIntensityColor(contraction.intensity) }
                            ]}
                            lightColor={colorScheme === 'light' ? 'rgba(247, 239, 229, 0.8)' : theme.card}
                            darkColor={colorScheme === 'dark' ? 'rgba(92, 77, 65, 0.8)' : theme.card}
                          >
                            <View style={styles.cardHeader}>
                              <View style={styles.cardTitleContainer}>
                                <ThemedText style={styles.cardTitle}>
                                  Wehe #{dayContractions.length - index}
                                </ThemedText>
                                {contraction.intensity && (
                                  <View style={[
                                    styles.intensityBadge,
                                    { backgroundColor: getIntensityColor(contraction.intensity) }
                                  ]}>
                                    <ThemedText style={styles.intensityText}>
                                      {contraction.intensity}
                                    </ThemedText>
                                  </View>
                                )}
                              </View>
                            </View>

                            <View style={styles.cardDetails}>
                              <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Dauer:</ThemedText>
                                <ThemedText style={styles.detailValue}>
                                  {contraction.duration ? formatDuration(contraction.duration) : '--:--'}
                                </ThemedText>
                              </View>

                              <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Abstand:</ThemedText>
                                <ThemedText style={styles.detailValue}>
                                  {contraction.interval && contraction.interval > 0 ? formatInterval(contraction.interval) : '--:--'}
                                </ThemedText>
                              </View>

                              {isExpanded && (
                                <View style={styles.expandedDetails}>
                                  <View style={styles.divider} />
                                  <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Startzeit:</ThemedText>
                                    <ThemedText style={styles.detailValue}>
                                      {formatTime(new Date(contraction.startTime))}
                                    </ThemedText>
                                  </View>
                                  {contraction.endTime && (
                                    <View style={styles.detailRow}>
                                      <ThemedText style={styles.detailLabel}>Endzeit:</ThemedText>
                                      <ThemedText style={styles.detailValue}>
                                        {formatTime(new Date(contraction.endTime))}
                                      </ThemedText>
                                    </View>
                                  )}

                                  {/* Aktions-Buttons - nur in aufgeklappter Karte anzeigen */}
                                  <View style={styles.actionButtonsContainer}>
                                    {/* Bearbeiten-Button */}
                                    {onEdit && (
                                      <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={(e) => {
                                          e.stopPropagation(); // Verhindert, dass der Klick die Karte erweitert
                                          handleEdit(contraction.id);
                                        }}
                                      >
                                        <Ionicons name="pencil-outline" size={16} color="#4A90E2" />
                                        <ThemedText style={styles.editButtonText}>Bearb.</ThemedText>
                                      </TouchableOpacity>
                                    )}

                                    {/* Lösch-Button */}
                                    {onDelete && (
                                      <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={(e) => {
                                          e.stopPropagation(); // Verhindert, dass der Klick die Karte erweitert
                                          handleDelete(contraction.id);
                                        }}
                                      >
                                        <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                                        <ThemedText style={styles.deleteButtonText}>Lösch.</ThemedText>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </View>
                              )}
                            </View>
                          </ThemedView>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        </ScrollView>
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  glass: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    marginBottom: 16,
  },
  inner: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
    color: '#999999',
  },
  dayContainer: {
    marginBottom: 24,
  },
  dateHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeColumn: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lineColumn: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#DDDDDD',
    position: 'absolute',
    top: 12,
    bottom: -16,
    left: 11,
  },
  cardColumn: {
    flex: 1,
    paddingLeft: 8,
  },
  contractionCard: {
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 8,
  },
  actionButtonsContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10, // Abstand zwischen den Buttons
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
    flex: 1, // Nimmt gleichen Platz ein wie der Lösch-Button
    maxWidth: '45%', // Begrenzt die Breite auf 45% des Containers
  },
  editButtonText: {
    color: '#4A90E2',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  deleteButtonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    flex: 1, // Nimmt gleichen Platz ein wie der Bearbeiten-Button
    maxWidth: '45%', // Begrenzt die Breite auf 45% des Containers
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  intensityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  intensityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardDetails: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  expandedDetails: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#DDDDDD',
    marginVertical: 8,
  },
});

export default VerticalContractionTimeline;
