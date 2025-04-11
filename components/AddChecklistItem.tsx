import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface AddChecklistItemProps {
  onAdd: (itemName: string, category: string, notes: string) => Promise<void>;
  categories: string[];
}

export const AddChecklistItem: React.FC<AddChecklistItemProps> = ({ onAdd, categories }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [modalVisible, setModalVisible] = useState(false);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Allgemein');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Namen für den Eintrag ein.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onAdd(itemName.trim(), category, notes.trim());
      setItemName('');
      setNotes('');
      setModalVisible(false);
    } catch (error) {
      console.error('Error adding checklist item:', error);
      Alert.alert('Fehler', 'Der Eintrag konnte nicht hinzugefügt werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add-circle" size={24} color="#E9C9B6" />
        <ThemedText style={styles.addButtonText}>Neuen Eintrag hinzufügen</ThemedText>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Neuer Eintrag</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.label}>Name *</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={itemName}
              onChangeText={setItemName}
              placeholder="z.B. Mutterpass"
              placeholderTextColor={theme.tabIconDefault}
            />

            <ThemedText style={styles.label}>Kategorie</ThemedText>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonSelected
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <ThemedText
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextSelected
                    ]}
                  >
                    {cat}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <ThemedText style={styles.label}>Notizen</ThemedText>
            <TextInput
              style={[styles.input, styles.notesInput, { color: theme.text, borderColor: theme.border }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Zusätzliche Informationen"
              placeholderTextColor={theme.tabIconDefault}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <ThemedText style={styles.submitButtonText}>
                {isSubmitting ? 'Wird hinzugefügt...' : 'Hinzufügen'}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#E9C9B6',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginTop: 8,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: '#E9C9B6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#E9C9B6',
  },
  categoryButtonText: {
    fontSize: 14,
  },
  categoryButtonTextSelected: {
    color: '#5C4033',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#E9C9B6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#5C4033',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
