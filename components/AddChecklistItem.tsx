import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LiquidGlassCard, GlassCard, TEXT_PRIMARY } from '@/constants/DesignGuide';

const CTA_ACCENT = '#9D7BD8';
const LILAC_GLASS_OVERLAY = 'rgba(142, 78, 198, 0.25)';
const LILAC_BORDER_COLOR = 'rgba(255,255,255,0.6)';
const LILAC_ICON_BG = 'rgba(255,255,255,0.32)';

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
      <LiquidGlassCard
        onPress={() => setModalVisible(true)}
        style={styles.addButton}
        overlayColor={LILAC_GLASS_OVERLAY}
        borderColor={LILAC_BORDER_COLOR}
        intensity={30}
        activeOpacity={0.9}
      >
        <View style={styles.addButtonContent}>
          <View style={[styles.addButtonIcon, { backgroundColor: LILAC_ICON_BG }]}>
            <Ionicons name="add" size={22} color="#fff" />
          </View>
          <View>
            <ThemedText style={styles.addButtonLabel} lightColor={TEXT_PRIMARY}>
              Neuer Eintrag
            </ThemedText>
            <ThemedText style={styles.addButtonHint} lightColor="rgba(125,90,80,0.75)">
              Wunsch ergänzen und direkt abhaken
            </ThemedText>
          </View>
        </View>
      </LiquidGlassCard>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.modalInner}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle} lightColor={TEXT_PRIMARY}>
                  Neuer Eintrag
                </ThemedText>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.label} lightColor={TEXT_PRIMARY}>Name *</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={itemName}
                onChangeText={setItemName}
                placeholder="z.B. Mutterpass"
                placeholderTextColor={theme.tabIconDefault}
              />

              <ThemedText style={styles.label} lightColor={TEXT_PRIMARY}>Kategorie</ThemedText>
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
                      lightColor={category === cat ? TEXT_PRIMARY : undefined}
                    >
                      {cat}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={styles.label} lightColor={TEXT_PRIMARY}>Notizen</ThemedText>
              <TextInput
                style={[styles.input, styles.notesInput, { color: theme.text }]}
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
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  addButton: {
    marginTop: 12,
    padding: 18,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  addButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  addButtonHint: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalInner: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 15,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 6,
    gap: 8,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  categoryButtonSelected: {
    backgroundColor: 'rgba(157,123,216,0.12)',
    borderColor: CTA_ACCENT,
  },
  categoryButtonText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  categoryButtonTextSelected: {
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: CTA_ACCENT,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
