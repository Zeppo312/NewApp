import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol, type IconSymbolName } from '@/components/ui/IconSymbol';
import { GLASS_BORDER, GLASS_OVERLAY, PRIMARY } from '@/constants/PlannerDesign';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

type Props = {
  onOpenCapture: (type: 'todo' | 'event') => void;
};

export const QuickActions: React.FC<Props> = ({ onOpenCapture }) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' ||
    adaptiveColors.isDarkBackground;
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;
  const textPrimary = isDark ? Colors.dark.textPrimary : PRIMARY;
  const blurTint = isDark ? 'dark' : 'light';
  const overlayColor = isDark ? 'rgba(0,0,0,0.3)' : GLASS_OVERLAY;
  const borderColor = isDark ? 'rgba(255,255,255,0.18)' : GLASS_BORDER;

  const Chip: React.FC<{
    label: string;
    iconName: IconSymbolName;
    onPress: () => void;
  }> = ({ label, iconName, onPress }) => (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          { borderColor },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <BlurView intensity={24} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.chipOverlay,
            { backgroundColor: overlayColor },
          ]}
        />
        <View style={styles.chipContent}>
          <IconSymbol name={iconName} size={17} color={accentColor as any} />
          <ThemedText style={[styles.chipLabel, { color: textPrimary }]}>
            {label}
          </ThemedText>
        </View>
      </Pressable>
    );

  return (
    <View style={styles.row}>
      <Chip label="Aufgabe" iconName="checklist" onPress={() => onOpenCapture('todo')} />
      <Chip label="Termin" iconName="calendar" onPress={() => onOpenCapture('event')} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 2,
  },
  chip: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
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
    borderRadius: 18,
    backgroundColor: GLASS_OVERLAY,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  chipLabel: {
    fontWeight: '700',
    color: PRIMARY,
    fontSize: 14,
  },
});

export default QuickActions;
