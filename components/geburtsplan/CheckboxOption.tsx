import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export const CheckboxOption: React.FC<CheckboxOptionProps> = ({ label, checked, onToggle }) => {
  const adaptiveColors = useAdaptiveColors();
  const accentColor = adaptiveColors.accent;

  return (
    <TouchableOpacity style={styles.container} onPress={onToggle} activeOpacity={0.7}>
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
