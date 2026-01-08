import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { createBaby } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAuth } from '@/contexts/AuthContext';

type BabySwitcherButtonProps = {
  size?: number;
};

const BabySwitcherButton: React.FC<BabySwitcherButtonProps> = ({ size = 36 }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const {
    babies,
    activeBaby,
    activeBabyId,
    setActiveBabyId,
    refreshBabies,
    isLoading,
    loadError,
  } = useActiveBaby();
  const [isOpen, setIsOpen] = useState(false);
  const [newBabyName, setNewBabyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const displayInitial = useMemo(() => {
    const name = activeBaby?.name?.trim();
    if (name) return name.charAt(0).toUpperCase();
    return 'B';
  }, [activeBaby?.name]);

  if (!user) {
    return null;
  }

  const handleSelectBaby = async (babyId: string) => {
    await setActiveBabyId(babyId);
    setIsOpen(false);
  };

  const handleCreateBaby = async () => {
    if (isCreating) return;
    setIsCreating(true);

    const trimmedName = newBabyName.trim();
    const fallbackName = `Kind ${babies.length + 1}`;
    const name = trimmedName || fallbackName;

    const { data, error } = await createBaby({ name });

    if (error) {
      console.error('Error creating baby:', error);
      Alert.alert('Fehler', 'Das neue Kind konnte nicht angelegt werden.');
      setIsCreating(false);
      return;
    }

    const created = Array.isArray(data) ? data[0] : data;
    await refreshBabies();
    if (created?.id) {
      await setActiveBabyId(created.id);
    }
    setNewBabyName('');
    setIsCreating(false);
    setIsOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.avatarButton,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        onPress={() => setIsOpen(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        disabled={isLoading}
      >
        {activeBaby?.photo_url ? (
          <Image source={{ uri: activeBaby.photo_url }} style={styles.avatarImage} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {
                borderRadius: size / 2,
                borderColor: theme.text,
              },
            ]}
          >
            <ThemedText style={[styles.avatarInitial, { color: theme.text }]}>
              {displayInitial}
            </ThemedText>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Kind auswählen</ThemedText>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <IconSymbol name="xmark" size={18} color="#7D5A50" />
              </TouchableOpacity>
            </View>

            <View style={styles.listContainer}>
              {!isLoading && babies.length === 0 && (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateTitle}>
                    Keine Kinder gefunden.
                  </ThemedText>
                  {loadError && (
                    <ThemedText style={styles.emptyStateHint}>
                      Fehler: {loadError}
                    </ThemedText>
                  )}
                </View>
              )}
              {babies.map((baby, index) => {
                const label = baby.name?.trim() || `Kind ${index + 1}`;
                const isActive = baby.id === activeBabyId;
                return (
                  <TouchableOpacity
                    key={baby.id ?? `${label}-${index}`}
                    style={[styles.babyRow, isActive && styles.babyRowActive]}
                    onPress={() => baby.id && handleSelectBaby(baby.id)}
                  >
                    {baby.photo_url ? (
                      <Image source={{ uri: baby.photo_url }} style={styles.babyRowAvatar} />
                    ) : (
                      <View style={[styles.babyRowAvatar, styles.babyRowFallback]}>
                        <ThemedText style={styles.babyRowInitial}>
                          {label.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                    <View style={styles.babyRowText}>
                      <ThemedText style={styles.babyRowTitle}>{label}</ThemedText>
                      {isActive && <ThemedText style={styles.babyRowSubtitle}>Aktiv</ThemedText>}
                    </View>
                    {isActive && (
                      <IconSymbol name="checkmark.circle.fill" size={18} color="#E9C9B6" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.newBabySection}>
              <ThemedText style={styles.newBabyTitle}>Neues Kind</ThemedText>
              <TextInput
                style={styles.newBabyInput}
                placeholder="Name (optional)"
                placeholderTextColor="#B2A8A1"
                value={newBabyName}
                onChangeText={setNewBabyName}
              />
              <TouchableOpacity
                style={[styles.createButton, isCreating && styles.createButtonDisabled]}
                onPress={handleCreateBaby}
                disabled={isCreating}
              >
                <ThemedText style={styles.createButtonText}>
                  {isCreating ? 'Wird angelegt...' : 'Kind anlegen'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFF7F3',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
  },
  listContainer: {
    gap: 8,
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
  },
  emptyStateHint: {
    fontSize: 12,
    color: '#A8978E',
    marginTop: 4,
  },
  babyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.1)',
  },
  babyRowActive: {
    borderColor: '#E9C9B6',
    backgroundColor: 'rgba(233, 201, 182, 0.2)',
  },
  babyRowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  babyRowFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(125, 90, 80, 0.08)',
  },
  babyRowInitial: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7D5A50',
  },
  babyRowText: {
    flex: 1,
  },
  babyRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7D5A50',
  },
  babyRowSubtitle: {
    fontSize: 12,
    color: '#A8978E',
    marginTop: 2,
  },
  newBabySection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(125, 90, 80, 0.1)',
    paddingTop: 12,
  },
  newBabyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
    marginBottom: 8,
  },
  newBabyInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#7D5A50',
    marginBottom: 10,
  },
  createButton: {
    backgroundColor: '#E9C9B6',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
  },
});

export default BabySwitcherButton;
