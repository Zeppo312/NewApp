import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const CheckboxOption: React.FC<CheckboxOptionProps> = ({ label, checked, onToggle, disabled = false }) => {
  const adaptiveColors = useAdaptiveColors();
  const accentColor = adaptiveColors.accent;

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={disabled ? undefined : onToggle}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.checkbox, { borderColor: accentColor }]}>
        {checked && (
          <Ionicons name="checkmark" size={16} color={accentColor} />
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
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    flex: 1,
  },
});
