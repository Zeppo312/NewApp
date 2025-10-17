import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import { GLASS_BORDER, GLASS_OVERLAY, PRIMARY, LAYOUT_PAD } from '@/constants/PlannerDesign';

type Props = {
  onOpenCapture: (type: 'todo' | 'event' | 'note') => void;
};

export const QuickActions: React.FC<Props> = ({ onOpenCapture }) => {
  const Chip: React.FC<{ label: string; emoji: string; onPress: () => void }> = ({ label, emoji, onPress }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.chipOverlay]} />
      <View style={styles.chipContent}>
        <ThemedText style={styles.chipEmoji}>{emoji}</ThemedText>
        <ThemedText style={styles.chipLabel}>{label}</ThemedText>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <Chip label="+ Aufgabe" emoji="📝" onPress={() => onOpenCapture('todo')} />
      <Chip label="+ Termin" emoji="📅" onPress={() => onOpenCapture('event')} />
      <Chip label="+ Notiz" emoji="💡" onPress={() => onOpenCapture('note')} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: LAYOUT_PAD,
    paddingVertical: 4,
  },
  chip: {
    flex: 1,
    minHeight: 52,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  chipOverlay: {
    borderRadius: 28,
    backgroundColor: GLASS_OVERLAY,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    fontWeight: '700',
    color: PRIMARY,
    fontSize: 14,
  },
});

export default QuickActions;
