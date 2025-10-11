import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface TextInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
}

export const TextInputField: React.FC<TextInputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  numberOfLines = 1,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        style={[
          styles.input,
          multiline && { minHeight: 24 * numberOfLines, textAlignVertical: 'top' },
          { color: theme.text, borderColor: 'rgba(0,0,0,0.1)' }
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
        multiline={multiline}
        numberOfLines={numberOfLines}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    paddingTop: 10,
    width: '100%',
  },
});
