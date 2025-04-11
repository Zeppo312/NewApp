import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface RadioOptionProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export const RadioOption: React.FC<RadioOptionProps> = ({ label, selected, onSelect }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <TouchableOpacity style={styles.container} onPress={onSelect} activeOpacity={0.7}>
      <View style={[styles.radio, { borderColor: theme.accent }]}>
        {selected && (
          <View style={[styles.radioInner, { backgroundColor: theme.accent }]} />
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
