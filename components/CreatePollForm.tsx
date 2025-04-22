import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { createPoll } from '@/lib/polls';

interface CreatePollFormProps {
  postId: string;
  onPollCreated: () => void;
  onCancel: () => void;
}

export const CreatePollForm: React.FC<CreatePollFormProps> = ({ 
  postId, 
  onPollCreated, 
  onCancel 
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultipleChoices, setAllowMultipleChoices] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Option hinzufügen
  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    } else {
      Alert.alert('Hinweis', 'Maximal 10 Optionen erlaubt.');
    }
  };

  // Option entfernen
  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    } else {
      Alert.alert('Hinweis', 'Mindestens 2 Optionen erforderlich.');
    }
  };

  // Option aktualisieren
  const updateOption = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  // Umfrage erstellen
  const handleCreatePoll = async () => {
    // Validierung
    if (!question.trim()) {
      Alert.alert('Fehler', 'Bitte gib eine Frage ein.');
      return;
    }

    const validOptions = options.filter(option => option.trim() !== '');
    if (validOptions.length < 2) {
      Alert.alert('Fehler', 'Bitte gib mindestens 2 Optionen ein.');
      return;
    }

    try {
      setIsCreating(true);
      
      const { data, error } = await createPoll(postId, {
        question: question.trim(),
        options: validOptions,
        allow_multiple_choices: allowMultipleChoices
      });
      
      if (error) throw error;
      
      onPollCreated();
      Alert.alert('Erfolg', 'Deine Umfrage wurde erstellt.');
    } catch (err) {
      console.error('Error creating poll:', err);
      Alert.alert('Fehler', 'Deine Umfrage konnte nicht erstellt werden.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Umfrage erstellen</ThemedText>
        <TouchableOpacity onPress={onCancel}>
          <IconSymbol name="xmark.circle.fill" size={24} color={theme.tabIconDefault} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={[styles.questionInput, { color: theme.text }]}
        placeholder="Deine Frage"
        placeholderTextColor={theme.tabIconDefault}
        value={question}
        onChangeText={setQuestion}
        multiline
      />

      <ThemedText style={styles.sectionTitle}>Antwortoptionen</ThemedText>
      
      {options.map((option, index) => (
        <View key={index} style={styles.optionContainer}>
          <TextInput
            style={[styles.optionInput, { color: theme.text }]}
            placeholder={`Option ${index + 1}`}
            placeholderTextColor={theme.tabIconDefault}
            value={option}
            onChangeText={(text) => updateOption(text, index)}
          />
          
          {options.length > 2 && (
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => removeOption(index)}
            >
              <IconSymbol name="minus.circle.fill" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {options.length < 10 && (
        <TouchableOpacity 
          style={styles.addOptionButton}
          onPress={addOption}
        >
          <IconSymbol name="plus.circle.fill" size={20} color={theme.accent} />
          <ThemedText style={styles.addOptionText}>Option hinzufügen</ThemedText>
        </TouchableOpacity>
      )}

      <View style={styles.switchContainer}>
        <ThemedText style={styles.switchLabel}>Mehrfachauswahl erlauben</ThemedText>
        <Switch
          value={allowMultipleChoices}
          onValueChange={setAllowMultipleChoices}
          trackColor={{ false: '#E0E0E0', true: '#E57373' }}
          thumbColor={allowMultipleChoices ? '#FF9F9F' : '#f4f3f4'}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.createButton, 
          { backgroundColor: theme.accent },
          isCreating && { opacity: 0.7 }
        ]}
        onPress={handleCreatePoll}
        disabled={isCreating}
      >
        <ThemedText style={styles.createButtonText}>
          {isCreating ? 'Wird erstellt...' : 'Umfrage erstellen'}
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  addOptionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#888',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
  },
  createButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
