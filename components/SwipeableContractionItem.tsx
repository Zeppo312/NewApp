import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { deleteContraction } from '@/lib/supabase';

type Contraction = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null; // in seconds
  interval: number | null; // time since last contraction in seconds
  intensity: string | null; // Stärke der Wehe (schwach, mittel, stark)
};

type SwipeableContractionItemProps = {
  item: Contraction;
  index?: number;
  totalCount?: number;
  onDelete: (id: string) => void;
};

// Format seconds to mm:ss or hh:mm if longer than 60 minutes
const formatTime = (seconds: number): string => {
  // Wenn der Abstand größer als 60 Minuten ist, in Stunden und Minuten anzeigen
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}min`;
  } else {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};

// Format date to readable time
const formatDateTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date only
const formatDate = (date: Date): string => {
  return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

// Funktion zur Bestimmung der Farbe basierend auf der Intensität
const getIntensityColor = (intensity: string): string => {
  // Pastellfarben für eine weichere Optik
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

const ContractionItem: React.FC<SwipeableContractionItemProps> = ({
  item,
  index,
  totalCount,
  onDelete
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Funktion zum Löschen einer Wehe
  const handleDelete = () => {
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
              console.log('Deleting contraction with ID:', item.id);
              onDelete(item.id);
            }, 300); // Längere Verzögerung für mehr Stabilität
          }
        }
      ]
    );
  };

  return (
    <ThemedView
      style={styles.contractionItem}
      lightColor={theme.card}
      darkColor={theme.card}
    >
      <View style={styles.contractionHeader}>
        <View style={{flex: 1}}>
          <ThemedText
            type="defaultSemiBold"
            style={{fontSize: 18}} // Larger font
            lightColor={theme.text}
            darkColor={theme.text}
          >
            {index !== undefined && totalCount !== undefined ? `Wehe #${totalCount - index}` : 'Wehe'}
          </ThemedText>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <ThemedText
              style={{fontSize: 16}} // Larger font
              lightColor={theme.text}
              darkColor={theme.text}
            >
              {formatDateTime(new Date(item.startTime))}
            </ThemedText>
            <View style={{
              backgroundColor: '#FF9A8A',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 10,
              marginLeft: 8
            }}>
              <ThemedText
                style={{fontSize: 12, fontWeight: 'bold'}}
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
              >
                {formatDate(new Date(item.startTime))}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Löschen-Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <ThemedText
            style={styles.deleteButtonText}
            lightColor="#FF6B6B"
            darkColor="#FF6B6B"
          >
            Löschen
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.contractionDetailsContainer}>
        {/* Linke Spalte: Dauer und Abstand */}
        <View style={styles.leftColumn}>
          <ThemedView
            style={[styles.detailItem, {backgroundColor: colorScheme === 'light' ? 'rgba(230, 204, 178, 0.15)' : 'rgba(230, 204, 178, 0.1)'}]}
            lightColor={colorScheme === 'light' ? 'rgba(247, 239, 229, 0.8)' : theme.card}
            darkColor={colorScheme === 'dark' ? 'rgba(92, 77, 65, 0.8)' : theme.card}
          >
            <ThemedText
              style={styles.detailLabel}
              lightColor={theme.text}
              darkColor={theme.text}
            >
              Dauer:
            </ThemedText>
            <ThemedText
              type="defaultSemiBold"
              style={styles.detailValue}
              lightColor={theme.accent}
              darkColor={theme.accent}
            >
              {item.duration ? formatTime(item.duration) : '--:--'}
            </ThemedText>
          </ThemedView>

          <ThemedView
            style={[styles.detailItem, {backgroundColor: colorScheme === 'light' ? 'rgba(230, 204, 178, 0.15)' : 'rgba(230, 204, 178, 0.1)'}]}
            lightColor={colorScheme === 'light' ? 'rgba(247, 239, 229, 0.8)' : theme.card}
            darkColor={colorScheme === 'dark' ? 'rgba(92, 77, 65, 0.8)' : theme.card}
          >
            <ThemedText
              style={styles.detailLabel}
              lightColor={theme.text}
              darkColor={theme.text}
            >
              Abstand:
            </ThemedText>
            <ThemedText
              type="defaultSemiBold"
              style={styles.detailValue}
              lightColor={theme.accent}
              darkColor={theme.accent}
            >
              {item.interval ? formatTime(item.interval) : '--:--'}
            </ThemedText>
          </ThemedView>
        </View>

        {/* Rechte Spalte: Stärke */}
        <View style={styles.rightColumn}>
          <ThemedText
            style={styles.detailLabel}
            lightColor={theme.text}
            darkColor={theme.text}
          >
            Stärke:
          </ThemedText>

          {item.intensity ? (
            <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(item.intensity) }]} />
          ) : (
            <ThemedText
              type="defaultSemiBold"
              style={styles.detailValue}
              lightColor={theme.accent}
              darkColor={theme.accent}
            >
              --
            </ThemedText>
          )}
        </View>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  contractionItem: {
    padding: 20, // More padding
    borderRadius: 20, // More rounded corners
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  contractionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14, // More margin
    paddingBottom: 10, // More padding
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  contractionDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
  },
  leftColumn: {
    flex: 1,
    marginRight: 10,
  },
  rightColumn: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  detailItem: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    marginBottom: 10,
    borderRadius: 12,
  },
  detailLabel: {
    fontSize: 16,
    marginBottom: 6,
    opacity: 0.8,
  },
  detailValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  intensityBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ContractionItem;
