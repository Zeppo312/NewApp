import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DailyEntry } from '@/lib/baby';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

interface ActivityCardProps {
  entry: DailyEntry;
  onDelete: (id: string) => void;
  onStop?: (id: string) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ entry, onDelete }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [expanded, setExpanded] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Animationen
  const expandAnimation = useRef(new Animated.Value(0)).current;
  const pressAnimation = useRef(new Animated.Value(1)).current;

  // Effekt für die Expand-Animation
  useEffect(() => {
    Animated.timing(expandAnimation, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  // Effekt für die Press-Animation
  useEffect(() => {
    if (pressed) {
      Animated.timing(pressAnimation, {
        toValue: 0.97,
        duration: 100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(pressAnimation, {
        toValue: 1,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [pressed]);

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
        return <IconSymbol name="heart.fill" size={24} color="#4CAF50" />;
      case 'sleep':
        return <IconSymbol name="moon.fill" size={24} color="#5C6BC0" />;
      case 'feeding':
        return <IconSymbol name="drop.fill" size={24} color="#FF9800" />;
      default:
        return <IconSymbol name="star.fill" size={24} color="#9C27B0" />;
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
  const getActivityColor = (type: string, opacity: number = 0.1) => {
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

  // Rendere Akzentfarbe basierend auf Aktivitätstyp
  const getActivityAccentColor = (type: string) => {
    switch (type) {
      case 'diaper':
        return '#4CAF50';
      case 'sleep':
        return '#5C6BC0';
      case 'feeding':
        return '#FF9800';
      default:
        return '#9C27B0';
    }
  };

  // Berechne Dauer
  const duration = entry.end_time
    ? calculateDuration(entry.start_time!, entry.end_time)
    : 0;

  const [elapsed, setElapsed] = useState(() =>
    entry.end_time
      ? calculateDuration(entry.start_time!, entry.end_time) * 60
      : Math.floor((Date.now() - new Date(entry.start_time!).getTime()) / 1000)
  );

  useEffect(() => {
    if (!entry.end_time) {
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - new Date(entry.start_time!).getTime()) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
  }, [entry.end_time, entry.start_time]);

  const formatSeconds = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  };

  // Rendere Swipe-Aktionen
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActions}>
        <Animated.View
          style={[
            styles.deleteAction,
            {
              transform: [{ translateX: trans }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => entry.id && onDelete(entry.id)}
            style={styles.deleteButton}
          >
            <IconSymbol name="trash" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <Animated.View
        style={{
          transform: [{ scale: pressAnimation }],
          marginBottom: 12, // Mehr Abstand zwischen Karten
        }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setExpanded(!expanded)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          delayPressIn={0}
        >
          <ThemedView
            style={[styles.card, expanded && styles.expandedCard]}
            lightColor="#FFFFFF"
            darkColor="#1A1A1A"
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                {renderIcon(entry.entry_type)}
              </View>

              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <ThemedText style={styles.title}>
                    {getActivityTypeText(entry.entry_type)}
                  </ThemedText>

                  <Animated.View
                    style={{
                      transform: [{
                        rotate: expandAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg']
                        })
                      }]
                    }}
                  >
                    <IconSymbol
                      name="chevron.down"
                      size={14}
                      color={theme.tabIconDefault}
                    />
                  </Animated.View>
                </View>

                <View style={styles.timeRow}>
                  <ThemedText style={styles.time}>
                    {entry.start_time && formatTime(entry.start_time)}
                    {entry.end_time && ` – ${formatTime(entry.end_time)}`}
                  </ThemedText>

                  {duration > 0 && (
                    <>
                      <ThemedText style={styles.timeSeparator}>•</ThemedText>
                      <ThemedText style={styles.duration}>
                        {duration} Min
                      </ThemedText>
                    </>
                  )}
                </View>
                {entry.entry_type === 'feeding' && !entry.end_time && (
                  <View style={styles.activeRow}>
                    <ThemedText style={styles.activeTimer}>{formatSeconds(elapsed)}</ThemedText>
                    {onStop && entry.id && (
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={() => onStop(entry.id!)}
                      >
                        <ThemedText style={styles.stopButtonText}>Stop</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Animierter Notizbereich */}
            <Animated.View
              style={[
                styles.notesContainer,
                {
                  maxHeight: expandAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 200]
                  }),
                  opacity: expandAnimation,
                  marginTop: expandAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 8]
                  })
                }
              ]}
            >
              <Animated.View
                style={[
                  styles.divider,
                  { opacity: expandAnimation }
                ]}
              />
              {entry.notes && (
                <ThemedText style={styles.notes}>
                  {entry.notes}
                </ThemedText>
              )}
              {!entry.notes && (
                <ThemedText style={styles.notes}>
                  Keine Notizen vorhanden
                </ThemedText>
              )}
            </Animated.View>

            {/* Farbiger Akzent am linken Rand */}
            <View
              style={[
                styles.colorAccent,
                { backgroundColor: getActivityAccentColor(entry.entry_type) }
              ]}
            />

            {/* Indikator für expandierte Karte */}
            {expanded && (
              <View
                style={[
                  styles.expandedIndicator,
                  { backgroundColor: getActivityAccentColor(entry.entry_type) }
                ]}
              />
            )}
          </ThemedView>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden', // Für den farbigen Akzent am Rand
  },
  expandedCard: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 13,
    color: '#666666',
  },
  timeSeparator: {
    fontSize: 13,
    marginHorizontal: 4,
    color: '#666666',
  },
  duration: {
    fontSize: 13,
    color: '#666666',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  activeTimer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  stopButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FF9800',
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notesContainer: {
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 4,
  },
  rightActions: {
    width: 80,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    width: 50,
    height: '80%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  expandedIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 3,
    height: 20,
    borderBottomLeftRadius: 3,
  },
});

export default ActivityCard;
