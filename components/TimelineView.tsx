import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { CareEntry } from '@/lib/care';

interface TimelineViewProps {
  entries: CareEntry[];
  onDeleteEntry: (id: string) => void;
  refreshControl?: React.ReactElement;
}

const TimelineView: React.FC<TimelineViewProps> = ({ entries, onDeleteEntry, refreshControl }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Sortiere Einträge nach Startzeit
  const sortedEntries = [...entries].sort((a, b) => {
    if (!a.start_time || !b.start_time) return 0;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  // Gruppiere Einträge nach Stunden
  const groupedEntries: Record<string, CareEntry[]> = {};

  sortedEntries.forEach(entry => {
    if (!entry.start_time) return;

    const hour = new Date(entry.start_time).getHours();
    const hourKey = `${hour}:00`;

    if (!groupedEntries[hourKey]) {
      groupedEntries[hourKey] = [];
    }

    groupedEntries[hourKey].push(entry);
  });

  // Formatiere Zeit
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // Berechne Dauer in Minuten
  const calculateDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 0;

    const start = new Date(startTime);
    const end = new Date(endTime);

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  };

  // Rendere Icon basierend auf Aktivitätstyp
  const renderIcon = (type: string) => {
    switch (type) {
      case 'diaper':
        return <IconSymbol name="heart.fill" size={20} color="#4CAF50" />;
      case 'sleep':
        return <IconSymbol name="moon.fill" size={20} color="#5C6BC0" />;
      case 'feeding':
        return <IconSymbol name="drop.fill" size={20} color="#FF9800" />;
      default:
        return <IconSymbol name="star.fill" size={20} color="#9C27B0" />;
    }
  };

  // Rendere Aktivitätstyp als Text
  const getActivityTypeText = (type: string) => {
    switch (type) {
      case 'diaper':
        return 'Wickeln';
      case 'sleep':
        return 'Schlafen';
      case 'feeding':
        return 'Füttern';
      default:
        return 'Sonstiges';
    }
  };

  // Rendere Hintergrundfarbe basierend auf Aktivitätstyp
  const getActivityColor = (type: string, opacity: number = 0.2) => {
    switch (type) {
      case 'diaper':
        return `rgba(76, 175, 80, ${opacity})`;
      case 'sleep':
        return `rgba(92, 107, 192, ${opacity})`;
      case 'feeding':
        return `rgba(255, 152, 0, ${opacity})`;
      default:
        return `rgba(156, 39, 176, ${opacity})`;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={refreshControl}
    >
      {Object.keys(groupedEntries).length > 0 ? (
        Object.keys(groupedEntries)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map((hourKey, index) => (
            <View key={hourKey} style={styles.timeBlock}>
              <View style={styles.timeMarker}>
                <View style={styles.timeCircle}>
                  <ThemedText style={styles.timeText}>{hourKey}</ThemedText>
                </View>
                {index < Object.keys(groupedEntries).length - 1 && (
                  <View style={styles.timeLine} />
                )}
              </View>

              <View style={styles.entriesContainer}>
                {groupedEntries[hourKey].map((entry) => {
                  const duration = entry.end_time
                    ? calculateDuration(entry.start_time!, entry.end_time)
                    : 0;

                  return (
                    <ThemedView
                      key={entry.id}
                      style={[
                        styles.entryCard,
                        { backgroundColor: getActivityColor(entry.entry_type) }
                      ]}
                      lightColor={getActivityColor(entry.entry_type)}
                      darkColor={getActivityColor(entry.entry_type, 0.3)}
                    >
                      <View style={styles.entryHeader}>
                        <View style={styles.entryTypeContainer}>
                          {renderIcon(entry.entry_type)}
                          <ThemedText style={styles.entryType}>
                            {getActivityTypeText(entry.entry_type)}
                          </ThemedText>
                        </View>

                        <View style={styles.timeContainer}>
                          <ThemedText style={styles.entryTime}>
                            {entry.start_time && formatTime(entry.start_time)}
                            {entry.end_time && ` - ${formatTime(entry.end_time)}`}
                          </ThemedText>

                          {duration > 0 && (
                            <ThemedText style={styles.duration}>
                              {duration} Min
                            </ThemedText>
                          )}
                        </View>
                      </View>

                      {entry.notes && (
                        <ThemedText style={styles.notes}>
                          {entry.notes}
                        </ThemedText>
                      )}
                    </ThemedView>
                  );
                })}
              </View>
            </View>
          ))
      ) : (
        <ThemedView style={styles.emptyContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
          <ThemedText style={styles.emptyText}>
            Keine Einträge für diesen Tag vorhanden. Tippe auf das Plus-Symbol, um einen neuen Eintrag zu erstellen.
          </ThemedText>
        </ThemedView>
      )}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  timeBlock: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  timeMarker: {
    alignItems: 'center',
    width: 60,
  },
  timeCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(125, 90, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  timeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  timeLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(125, 90, 80, 0.2)',
  },
  entriesContainer: {
    flex: 1,
    paddingLeft: 10,
  },
  entryCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  entryTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryType: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  entryTime: {
    fontSize: 14,
  },
  duration: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomPadding: {
    height: 100,
  },
});

export default TimelineView;
