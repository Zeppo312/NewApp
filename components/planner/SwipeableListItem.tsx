import React, { useRef } from 'react';
import { Alert, Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { PRIMARY, TEXT_PRIMARY } from '@/constants/PlannerDesign';

type Props = {
  id: string;
  title: string;
  type: 'todo' | 'event';
  subtitle?: string;
  completed?: boolean;
  onComplete?: (id: string) => void;
  onMoveTomorrow?: (id: string) => void;
  onLongPress?: (id: string) => void;
  showLeadingCheckbox?: boolean; // default true for todo
  trailingCheckbox?: boolean; // when true, render checkbox at right instead of left
  style?: StyleProp<ViewStyle>;
};

export const SwipeableListItem: React.FC<Props> = ({
  id,
  title,
  type,
  subtitle,
  completed,
  onComplete,
  onMoveTomorrow,
  onLongPress,
  showLeadingCheckbox = true,
  trailingCheckbox = false,
  style,
}) => {
  const ref = useRef<Swipeable | null>(null);
  const scale = useRef(new Animated.Value(completed ? 1 : 0)).current;

  const animateCheck = (to: number) => {
    Animated.spring(scale, { toValue: to, bounciness: 12, useNativeDriver: true }).start();
  };

  const leftActions = () => (
    <View style={[styles.action, styles.left]}>
      <IconSymbol name="checklist" color="#fff" size={24} />
      <Text style={styles.actionText}>Erledigt</Text>
    </View>
  );
  const rightActions = () => (
    <View style={[styles.action, styles.right]}> 
      <IconSymbol name="calendar" color="#fff" size={24} />
      <Text style={styles.actionText}>Morgen</Text>
    </View>
  );

  return (
    <Swipeable
      ref={ref}
      renderLeftActions={leftActions}
      renderRightActions={rightActions}
      onSwipeableLeftOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        animateCheck(1);
        onComplete?.(id);
        ref.current?.close();
      }}
      onSwipeableRightOpen={() => {
        Haptics.selectionAsync();
        onMoveTomorrow?.(id);
        ref.current?.close();
      }}
    >
      <Pressable
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (onLongPress) onLongPress(id);
          else Alert.alert('Aktionen', title, [
            { text: 'Bearbeiten' },
            { text: 'Zu Block verschieben' },
            { text: 'Tags' },
            { text: 'Löschen', style: 'destructive' },
            { text: 'Abbrechen', style: 'cancel' },
          ]);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${type === 'todo' ? 'Aufgabe' : 'Termin'}: ${title}${completed ? ', erledigt' : ''}`}
        accessibilityHint="Doppeltippen für Optionen, nach rechts wischen zum Erledigen, nach links zum Verschieben auf morgen"
        style={[styles.item, style]}
      >
        {/* Leading area */}
        {!trailingCheckbox && (
          <View style={styles.leading}>
            {type === 'todo' && showLeadingCheckbox ? (
              <View style={[styles.checkbox, completed && styles.checkboxDone]}>
                <Animated.View style={[styles.checkDot, { transform: [{ scale }] }]} />
              </View>
            ) : (
              type === 'event' ? <IconSymbol name="calendar" color={PRIMARY as any} size={20} /> : <View style={{ width: 20 }} />
            )}
          </View>
        )}
        <View style={{ flex: 1, minHeight: 32, justifyContent: 'center' }}>
          <Text style={[styles.title, completed && styles.titleDone]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {/* Trailing checkbox (Structured-like) */}
        {trailingCheckbox && type === 'todo' && (
          <View style={styles.trailing}>
            <View style={[styles.checkbox, completed && styles.checkboxDone]}>
              <Animated.View style={[styles.checkDot, { transform: [{ scale }] }]} />
            </View>
          </View>
        )}
      </Pressable>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  item: {
    minHeight: 48,
    paddingVertical: 10,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: PRIMARY,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  title: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: '600' },
  titleDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  subtitle: { fontSize: 12, opacity: 0.7, marginTop: 2, color: TEXT_PRIMARY },
  action: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  left: { backgroundColor: '#2ecc71' },
  right: { backgroundColor: '#9b59b6' },
  actionText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
});

export default SwipeableListItem;
