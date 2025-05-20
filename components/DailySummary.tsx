import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DailyEntry } from '@/lib/baby';

interface DailySummaryProps {
  entries: DailyEntry[];
}

const DailySummary: React.FC<DailySummaryProps> = ({ entries }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  // Berechne die Anzahl der Einträge pro Typ
  const feedingCount = entries.filter(entry => entry.entry_type === 'feeding').length;
  const sleepCount = entries.filter(entry => entry.entry_type === 'sleep').length;
  const diaperCount = entries.filter(entry => entry.entry_type === 'diaper').length;
  const otherCount = entries.filter(entry => entry.entry_type === 'other').length;
  
  // Berechne die Gesamtschlafdauer in Minuten
  const totalSleepMinutes = entries
    .filter(entry => entry.entry_type === 'sleep' && entry.start_time && entry.end_time)
    .reduce((total, entry) => {
      const start = new Date(entry.start_time!);
      const end = new Date(entry.end_time!);
      return total + Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }, 0);
  
  // Formatiere die Schlafdauer
  const formatSleepDuration = (minutes: number) => {
    if (minutes === 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };
  
  // Prüfe, ob es überhaupt Einträge gibt
  const hasEntries = feedingCount > 0 || sleepCount > 0 || diaperCount > 0 || otherCount > 0;
  
  if (!hasEntries) {
    return null;
  }
  
  return (
    <ThemedView 
      style={styles.container}
      lightColor="rgba(255, 255, 255, 0.7)"
      darkColor="rgba(30, 30, 30, 0.7)"
    >
      <ThemedText style={styles.title}>
        Heute:
      </ThemedText>
      
      <View style={styles.statsContainer}>
        {feedingCount > 0 && (
          <View style={styles.statItem}>
            <IconSymbol name="drop.fill" size={12} color="#FF9800" />
            <ThemedText style={styles.statText}>
              {feedingCount}× Füttern
            </ThemedText>
          </View>
        )}
        
        {diaperCount > 0 && (
          <View style={styles.statItem}>
            <IconSymbol name="heart.fill" size={12} color="#4CAF50" />
            <ThemedText style={styles.statText}>
              {diaperCount}× Wickeln
            </ThemedText>
          </View>
        )}
        
        {sleepCount > 0 && (
          <View style={styles.statItem}>
            <IconSymbol name="moon.fill" size={12} color="#5C6BC0" />
            <ThemedText style={styles.statText}>
              {sleepCount}× Schlafen {totalSleepMinutes > 0 && `(${formatSleepDuration(totalSleepMinutes)})`}
            </ThemedText>
          </View>
        )}
        
        {otherCount > 0 && (
          <View style={styles.statItem}>
            <IconSymbol name="star.fill" size={12} color="#9C27B0" />
            <ThemedText style={styles.statText}>
              {otherCount}× Sonstiges
            </ThemedText>
          </View>
        )}
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  statText: {
    fontSize: 13,
    marginLeft: 4,
    color: '#666666',
  },
});

export default DailySummary;
