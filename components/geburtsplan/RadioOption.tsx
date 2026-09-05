import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

interface RadioOptionProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export const RadioOption: React.FC<RadioOptionProps> = ({ label, selected, onSelect, disabled = false }) => {
  const adaptiveColors = useAdaptiveColors();
  const accentColor = adaptiveColors.accent;

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={disabled ? undefined : onSelect}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.radio, { borderColor: accentColor }]}>
        {selected && (
          <View style={[styles.radioInner, { backgroundColor: accentColor }]} />
        )}
      </View>
      <ThemedText style={styles.label}>{label}</ThemedText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  radio: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 11,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    fontSize: 15,
    flex: 1,
  },
});
