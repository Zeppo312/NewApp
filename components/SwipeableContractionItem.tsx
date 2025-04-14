import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
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

// Format seconds to mm:ss
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

const SwipeableContractionItem: React.FC<SwipeableContractionItemProps> = ({
  item,
  index,
  totalCount,
  onDelete
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Render right actions (delete button that appears when swiping)
  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          if (swipeableRef.current) {
            swipeableRef.current.close();
          }
          Alert.alert(
            'Wehe löschen',
            'Möchtest du diese Wehe wirklich löschen?',
            [
              {
                text: 'Abbrechen',
                style: 'cancel',
                onPress: () => {
                  if (swipeableRef.current) {
                    swipeableRef.current.close();
                  }
                }
              },
              {
                text: 'Löschen',
                style: 'destructive',
                onPress: () => onDelete(item.id)
              }
            ]
          );
        }}
      >
        <ThemedText style={styles.deleteActionText}>
          Löschen
        </ThemedText>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={2}
        rightThreshold={40}
      >
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
      </Swipeable>
    </GestureHandlerRootView>
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
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
  },
  deleteActionText: {
    color: 'white',
    fontWeight: 'bold',
    padding: 10,
  },
});

export default SwipeableContractionItem;
