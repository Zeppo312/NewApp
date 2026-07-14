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
import { BlurView } from 'expo-blur';

interface ActivityCardProps {
  entry: DailyEntry;
  onDelete: (id: string) => void;
  onEdit?: (entry: DailyEntry) => void;
  marginHorizontal?: number;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ entry, onDelete, onEdit, marginHorizontal = 16 }) => {
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
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  // Effekt für die Press-Animation
  useEffect(() => {
    if (pressed) {
      Animated.timing(pressAnimation, {
        toValue: 0.98,
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

  // Rendere Icon/Label basierend auf detailliertem Typ
  const getDetail = () => {
    // Falls Custom-Label/Emoji gesetzt sind (z. B. für Gewicht), verwende diese
    const customEmoji = (entry as any).emoji;
    const customLabel = (entry as any).label;
    if (customEmoji && customLabel) {
      return { emoji: customEmoji, label: customLabel };
    }
    if (entry.entry_type === 'feeding') {
      if (entry.feeding_type === 'BREAST') return { emoji: '🤱', label: 'Stillen' };
      if (entry.feeding_type === 'BOTTLE') return { emoji: '🍼', label: `Flasche${entry.feeding_volume_ml ? ` ${entry.feeding_volume_ml}ml` : ''}` };
      return { emoji: '🥄', label: 'Beikost' };
    }
    if (entry.entry_type === 'diaper') {
      if (entry.diaper_type === 'WET') return { emoji: '💧', label: 'Nass' };
      if (entry.diaper_type === 'DIRTY') return { emoji: '💩', label: 'Voll' };
      return { emoji: '💧💩', label: 'Beides' };
    }
    if (entry.entry_type === 'sleep') {
      // Verwende die bereits berechneten Werte aus dem Sleep-Tracker
      if (entry.emoji && entry.label) {
        return { emoji: entry.emoji, label: entry.label };
      }
      // Fallback falls die Werte nicht gesetzt sind
      return { emoji: '💤', label: 'Schlaf' };
    }
    return { emoji: '⭐️', label: 'Sonstiges' };
  };

  // Rendere Aktivitätstyp als Text
  const detail = getDetail();

  const translateFeedingType = (t?: string | null) => {
    switch (t) {
      case 'BREAST':
        return 'Brust';
      case 'BOTTLE':
        return 'Flasche';
      case 'SOLIDS':
        return 'Beikost';
      default:
        return '–';
    }
  };

  const translateBreastSide = (s?: string | null) => {
    switch (s) {
      case 'LEFT':
        return 'Links';
      case 'RIGHT':
        return 'Rechts';
      case 'BOTH':
        return 'Beide';
      default:
        return '–';
    }
  };

  const translateDiaperType = (t?: string | null) => {
    switch (t) {
      case 'WET':
        return 'Nass';
      case 'DIRTY':
        return 'Voll';
      case 'BOTH':
        return 'Beides';
      default:
        return '–';
    }
  };

  // Farb-Tint je nach Subtyp (wie Quick Buttons)
  const getTypeTint = () => {
    // Defaults (neutral)
    let color = '#5E3DB3';
    // Feeding
    if (entry.entry_type === 'feeding') {
      if (entry.feeding_type === 'BREAST') color = '#8E4EC6';
      else if (entry.feeding_type === 'BOTTLE') color = '#4A90E2';
      else if (entry.feeding_type === 'SOLIDS') color = '#F5A623'; // Beikost Orange
    }
    // Diaper
    if (entry.entry_type === 'diaper') {
      if (entry.diaper_type === 'WET') color = '#3498DB'; // Blau
      else if (entry.diaper_type === 'DIRTY') color = '#8E5A2B'; // Braun
      else if (entry.diaper_type === 'BOTH') color = '#38A169'; // Grün
    }
    // Sleep
    if (entry.entry_type === 'sleep') {
      // Bestimme Farbe basierend auf Sleep-Typ
      const sleepType = (entry as any).sleep_type;
      if (sleepType === 'nacht') color = '#5C6BC0'; // Lila für Nachtschlaf
      else if (sleepType === 'mittag') color = '#FF8C42'; // Orange für Mittagsschlaf
      else if (sleepType === 'tag') color = '#FFB74D'; // Helles Orange für Tagschlaf
      else if (sleepType === 'nickerchen') color = '#81C784'; // Grün für Nickerchen
      else color = '#5C6BC0'; // Standard Schlaf-Farbe
    }
    // Convert hex to rgba with given alpha
    const toRgba = (hex: string, a: number) => {
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    };
    return {
      bg: toRgba(color, 0.22),
      border: toRgba(color, 0.35),
      accent: color,
    };
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

  // BLW-Rezept-Hinweis aus den Notizen ziehen (erste Zeile mit "BLW:")
  const recipeNote = (() => {
    if (!entry.notes) return null;
    const line = entry.notes
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().startsWith('blw:'));
    if (!line) return null;
    return line.replace(/blw:/i, '').trim();
  })();

  const weightDateLabel = (entry as any).weightDateLabel as string | undefined;

  // Notizen ohne evtl. BLW-Rezept-Zeile (wird separat als Badge gezeigt)
  const notesWithoutRecipe = (() => {
    if (!entry.notes) return null;
    const lines = entry.notes
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.toLowerCase().startsWith('blw:'));
    if (lines.length === 0) return null;
    return lines.join('\n');
  })();

  const showNotesBadge = !!notesWithoutRecipe;

  // Berechne Dauer
  const duration = entry.end_time
    ? calculateDuration(entry.start_time!, entry.end_time)
    : 0;

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
          onPress={() => onEdit && onEdit(entry)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          delayPressIn={0}
        >
          {(() => { const tint = getTypeTint(); return (
          <View style={[styles.card, expanded && styles.expandedCard, { borderColor: tint.border, marginHorizontal }] }>
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject as any, { backgroundColor: tint.bg }]} />
            <LinearGradient colors={[ 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.10)' ]} style={StyleSheet.absoluteFillObject} />
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { marginTop: 6 }]}><ThemedText style={{fontSize: 20}}>{detail.emoji}</ThemedText></View>

              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <ThemedText style={styles.title}>{detail.label}</ThemedText>

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
                {recipeNote ? (
                  <View style={styles.badgeRow}>
                    <ThemedText style={styles.badgeText}>🥄 BLW: {recipeNote}</ThemedText>
                  </View>
                ) : null}
                {weightDateLabel ? (
                  <View style={styles.badgeRow}>
                    <ThemedText style={styles.badgeText}>📅 {weightDateLabel}</ThemedText>
                  </View>
                ) : null}
                {showNotesBadge ? (
                  <View style={styles.badgeRow}>
                    <ThemedText style={styles.badgeText}>📝 {notesWithoutRecipe}</ThemedText>
                  </View>
                ) : null}

                {/* Zeiten nur zeigen, wenn vorhanden */}
                {(entry.start_time || entry.end_time || duration > 0) && (
                <View style={styles.timeRowTop}>
                  <View style={styles.timePill}>
                    <ThemedText style={styles.timePillText}>Start {entry.start_time && formatTime(entry.start_time)}</ThemedText>
                  </View>
                  {entry.end_time && (
                    <View style={[styles.timePill, { marginLeft: 6 }]}>
                      <ThemedText style={styles.timePillText}>Ende {formatTime(entry.end_time)}</ThemedText>
                    </View>
                  )}

                 {duration > 0 && (
                    <View style={[styles.timePill, { marginLeft: 6, backgroundColor: 'rgba(94,61,179,0.18)', borderColor: 'rgba(94,61,179,0.35)' }]}>
                      <ThemedText style={[styles.timePillText, { fontWeight: '700' }]}>{duration} Min</ThemedText>
                    </View>
                  )}
                </View>
                )}
              </View>
            </View>
            {/* Kein Expand mehr – Details werden im Modal bearbeitet */}

            {/* Farbiger Akzent am linken Rand */}
            <View
              style={[
                styles.colorAccent,
                { backgroundColor: getTypeTint().accent }
              ]}
            />

          </View>
          ); })()}
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  expandedCard: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    textShadowColor: 'rgba(0,0,0,0.06)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    fontVariant: ['tabular-nums'],
  },
  timeRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap'
  },
  badgeRow: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(94,61,179,0.12)',
    borderColor: 'rgba(94,61,179,0.28)',
    borderWidth: 1,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5E3DB3',
  },
  time: {
    fontSize: 13,
    color: '#666666',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333'
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
  notesContainer: {
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5E3DB3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
