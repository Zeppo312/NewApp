import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  Text,
  Modal
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DailyEntry } from '@/lib/baby';
import { LinearGradient } from 'expo-linear-gradient';

interface AnimatedTimelineViewProps {
  entries: DailyEntry[];
  onDeleteEntry?: (id: string) => void;
}

const AnimatedTimelineView: React.FC<AnimatedTimelineViewProps> = ({ entries, onDeleteEntry }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [selectedEntry, setSelectedEntry] = useState<DailyEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const animatedValues = useRef<{ [key: string]: Animated.Value }>({}).current;
  const screenWidth = Dimensions.get('window').width;
  
  // Initialisiere Animationswerte für jede Aktivität
  useEffect(() => {
    entries.forEach(entry => {
      if (!animatedValues[entry.id || '']) {
        animatedValues[entry.id || ''] = new Animated.Value(0);
      }
    });
    
    // Starte die Animationen nacheinander
    const animations = entries.map((entry, index) => {
      return Animated.timing(animatedValues[entry.id || ''], {
        toValue: 1,
        duration: 600,
        delay: index * 100, // Verzögerung zwischen den Animationen
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    });
    
    Animated.stagger(50, animations).start();
    
    // Scrolle zur aktuellen Uhrzeit
    const now = new Date();
    const currentHour = now.getHours();
    const scrollPosition = (currentHour * 60 + now.getMinutes()) * (HOUR_HEIGHT / 60);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: scrollPosition - 200, // Etwas Abstand nach oben
        animated: true,
      });
    }, 500);
  }, [entries]);
  
  // Konstanten für die Timeline
  const HOUR_HEIGHT = 120; // Höhe einer Stunde in der Timeline
  const TIMELINE_PADDING = 20; // Padding links und rechts
  const TIMELINE_WIDTH = screenWidth - (TIMELINE_PADDING * 2); // Breite der Timeline
  const ACTIVITY_WIDTH = TIMELINE_WIDTH * 0.7; // Breite der Aktivitätsblöcke
  
  // Berechne die Gesamthöhe der Timeline
  useEffect(() => {
    setTimelineHeight(24 * HOUR_HEIGHT);
  }, []);
  
  // Formatiere Zeit (HH:MM)
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };
  
  // Berechne die Position und Höhe eines Aktivitätsblocks
  const calculateActivityPosition = (startTime?: string, endTime?: string) => {
    if (!startTime) return { top: 0, height: 0 };
    
    const start = new Date(startTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const startPosition = (startMinutes * HOUR_HEIGHT) / 60;
    
    let height = 30; // Minimalhöhe für Aktivitäten ohne Endzeit
    
    if (endTime) {
      const end = new Date(endTime);
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const duration = endMinutes - startMinutes;
      height = Math.max(30, (duration * HOUR_HEIGHT) / 60);
    }
    
    return { top: startPosition, height };
  };
  
  // Bestimme die Farbe basierend auf dem Aktivitätstyp
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'feeding':
        return ['#FF9800', '#FFA726'];
      case 'sleep':
        return ['#5C6BC0', '#7986CB'];
      case 'diaper':
        return ['#4CAF50', '#66BB6A'];
      default:
        return ['#9C27B0', '#AB47BC'];
    }
  };
  
  // Bestimme das Icon basierend auf dem Aktivitätstyp
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'feeding':
        return 'drop.fill';
      case 'sleep':
        return 'moon.fill';
      case 'diaper':
        return 'heart.fill';
      default:
        return 'star.fill';
    }
  };
  
  // Bestimme den Text basierend auf dem Aktivitätstyp
  const getActivityText = (type: string) => {
    switch (type) {
      case 'feeding':
        return 'Füttern';
      case 'sleep':
        return 'Schlafen';
      case 'diaper':
        return 'Wickeln';
      default:
        return 'Sonstiges';
    }
  };
  
  // Berechne die Dauer in Minuten
  const calculateDuration = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  };
  
  // Bestimme, ob es Tag oder Nacht ist basierend auf der Stunde
  const isDayTime = (hour: number) => {
    return hour >= 6 && hour < 20; // Tag von 6 Uhr bis 20 Uhr
  };
  
  // Rendere die Stunden der Timeline
  const renderHours = () => {
    const hours = [];
    
    for (let i = 0; i < 24; i++) {
      const isDay = isDayTime(i);
      
      hours.push(
        <View key={i} style={[styles.hourContainer, { height: HOUR_HEIGHT }]}>
          <View style={styles.hourLabelContainer}>
            <ThemedText style={styles.hourLabel}>
              {i.toString().padStart(2, '0')}:00
            </ThemedText>
          </View>
          
          <View style={[
            styles.hourBackground,
            isDay ? styles.dayBackground : styles.nightBackground
          ]}>
            {isDay ? (
              <IconSymbol name="sun.max.fill" size={16} color="#FFB74D" style={styles.timeIcon} />
            ) : (
              <IconSymbol name="moon.stars.fill" size={16} color="#7986CB" style={styles.timeIcon} />
            )}
          </View>
        </View>
      );
    }
    
    return hours;
  };
  
  // Rendere die Aktivitätsblöcke
  const renderActivities = () => {
    return entries.map((entry) => {
      const { top, height } = calculateActivityPosition(entry.start_time, entry.end_time);
      const colors = getActivityColor(entry.entry_type);
      const duration = calculateDuration(entry.start_time, entry.end_time);
      const icon = getActivityIcon(entry.entry_type);
      
      // Bestimme, ob es eine intensive Phase ist (mehrere Aktivitäten in kurzer Zeit)
      const isIntensivePhase = entries.filter(e => {
        if (!e.start_time || !entry.start_time) return false;
        const eStart = new Date(e.start_time);
        const entryStart = new Date(entry.start_time);
        const timeDiff = Math.abs(eStart.getTime() - entryStart.getTime()) / (1000 * 60);
        return timeDiff < 30 && e.id !== entry.id && e.entry_type === entry.entry_type;
      }).length > 0;
      
      // Animierte Werte
      const opacity = animatedValues[entry.id || ''] || new Animated.Value(0);
      const translateX = opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [-50, 0],
      });
      
      return (
        <Animated.View
          key={entry.id || Math.random().toString()}
          style={[
            styles.activityContainer,
            {
              top,
              height,
              opacity,
              transform: [{ translateX }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.activityTouchable}
            onPress={() => {
              setSelectedEntry(entry);
              setModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.activityBlock,
                entry.entry_type === 'sleep' && styles.sleepBlock,
                isIntensivePhase && styles.intensivePhase,
              ]}
            >
              <View style={styles.activityContent}>
                <IconSymbol name={icon} size={16} color="#FFFFFF" />
                <ThemedText style={styles.activityText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                  {formatTime(entry.start_time)}
                  {entry.end_time && ` - ${formatTime(entry.end_time)}`}
                </ThemedText>
                {duration > 0 && (
                  <ThemedText style={styles.durationText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                    {duration} Min
                  </ThemedText>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      );
    });
  };
  
  // Rendere die aktuelle Zeitlinie
  const renderCurrentTimeLine = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const position = (currentMinutes * HOUR_HEIGHT) / 60;
    
    return (
      <View style={[styles.currentTimeLine, { top: position }]}>
        <View style={styles.currentTimeCircle} />
        <View style={styles.currentTimeLineInner} />
        <ThemedText style={styles.currentTimeText}>
          {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
      </View>
    );
  };
  
  // Rendere das Detail-Modal
  const renderDetailModal = () => {
    if (!selectedEntry) return null;
    
    const colors = getActivityColor(selectedEntry.entry_type);
    const icon = getActivityIcon(selectedEntry.entry_type);
    const activityText = getActivityText(selectedEntry.entry_type);
    const duration = calculateDuration(selectedEntry.start_time, selectedEntry.end_time);
    
    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <IconSymbol name={icon} size={24} color="#FFFFFF" />
              <ThemedText style={styles.modalTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">
                {activityText}
              </ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={styles.modalContent}>
              <View style={styles.modalRow}>
                <ThemedText style={styles.modalLabel}>Zeit:</ThemedText>
                <ThemedText style={styles.modalValue}>
                  {selectedEntry.start_time && formatTime(selectedEntry.start_time)}
                  {selectedEntry.end_time && ` - ${formatTime(selectedEntry.end_time)}`}
                </ThemedText>
              </View>
              
              {duration > 0 && (
                <View style={styles.modalRow}>
                  <ThemedText style={styles.modalLabel}>Dauer:</ThemedText>
                  <ThemedText style={styles.modalValue}>{duration} Minuten</ThemedText>
                </View>
              )}
              
              {selectedEntry.notes && (
                <View style={styles.modalRow}>
                  <ThemedText style={styles.modalLabel}>Notizen:</ThemedText>
                  <ThemedText style={styles.modalValue}>{selectedEntry.notes}</ThemedText>
                </View>
              )}
              
              {onDeleteEntry && selectedEntry.id && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    setModalVisible(false);
                    setTimeout(() => {
                      onDeleteEntry(selectedEntry.id!);
                    }, 300);
                  }}
                >
                  <IconSymbol name="trash" size={16} color="#FFFFFF" />
                  <Text style={styles.deleteButtonText}>Löschen</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };
  
  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.timeline, { height: timelineHeight }]}>
          {/* Stunden */}
          <View style={styles.hoursContainer}>
            {renderHours()}
          </View>
          
          {/* Aktivitäten */}
          <View style={styles.activitiesContainer}>
            {renderActivities()}
          </View>
          
          {/* Aktuelle Zeit */}
          {renderCurrentTimeLine()}
        </View>
      </ScrollView>
      
      {/* Detail-Modal */}
      {renderDetailModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  timeline: {
    position: 'relative',
    paddingHorizontal: 20,
  },
  hoursContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  hourContainer: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  hourLabelContainer: {
    position: 'absolute',
    left: 0,
    top: -10,
    zIndex: 10,
  },
  hourLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  hourBackground: {
    position: 'absolute',
    left: 40,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    marginVertical: 2,
  },
  dayBackground: {
    backgroundColor: 'rgba(255, 235, 205, 0.2)',
  },
  nightBackground: {
    backgroundColor: 'rgba(92, 107, 192, 0.1)',
  },
  timeIcon: {
    position: 'absolute',
    right: 10,
    top: 10,
    opacity: 0.5,
  },
  activitiesContainer: {
    position: 'absolute',
    left: 60,
    top: 0,
    right: 0,
    height: '100%',
  },
  activityContainer: {
    position: 'absolute',
    left: 0,
    width: '100%',
  },
  activityTouchable: {
    flex: 1,
    paddingRight: 40,
  },
  activityBlock: {
    flex: 1,
    borderRadius: 10,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sleepBlock: {
    // Wellenbewegung für Schlafphasen
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  intensivePhase: {
    // Glow-Effekt für intensive Phasen
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activityText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF5252',
    zIndex: 100,
  },
  currentTimeCircle: {
    position: 'absolute',
    left: 40,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5252',
  },
  currentTimeLineInner: {
    position: 'absolute',
    left: 50,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: '#FF5252',
  },
  currentTimeText: {
    position: 'absolute',
    right: 10,
    top: -18,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF5252',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    padding: 15,
  },
  modalRow: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default AnimatedTimelineView;
