import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { createBaby, getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

type BabySwitcherButtonProps = {
  size?: number;
  showTrigger?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

const BabySwitcherButton: React.FC<BabySwitcherButtonProps> = ({
  size = 36,
  showTrigger = true,
  isOpen,
  onOpenChange,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const modalBgColor = isDark ? Colors.dark.cardLight : '#FFF7F3';
  const textColor = isDark ? Colors.dark.text : '#7D5A50';
  const subtitleColor = isDark ? Colors.dark.textTertiary : '#A8978E';
  const inputBgColor = isDark ? Colors.dark.cardDark : '#FFFFFF';
  const rowBgColor = isDark ? Colors.dark.cardDark : '#FFFFFF';
  const router = useRouter();
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
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [newBabyName, setNewBabyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isChangingPhoto, setIsChangingPhoto] = useState(false);
  const modalIsOpen = isOpen ?? internalIsOpen;

  const setModalOpen = (nextIsOpen: boolean) => {
    if (isOpen === undefined) {
      setInternalIsOpen(nextIsOpen);
    }
    onOpenChange?.(nextIsOpen);
  };

  const displayInitial = useMemo(() => {
    const name = activeBaby?.name?.trim();
    if (name) return name.charAt(0).toUpperCase();
    return 'B';
  }, [activeBaby?.name]);

  if (!user) {
    return null;
  }

  const getHomeRouteForBaby = async (babyId: string): Promise<'/(tabs)/home' | '/(tabs)/pregnancy-home'> => {
    const knownBaby = babies.find((baby) => baby.id === babyId);
    if (knownBaby?.birth_date) {
      return '/(tabs)/home';
    }

    const { data } = await getBabyInfo(babyId);
    return data?.birth_date ? '/(tabs)/home' : '/(tabs)/pregnancy-home';
  };

  const handleSelectBaby = async (babyId: string) => {
    try {
      await setActiveBabyId(babyId);
      const targetRoute = await getHomeRouteForBaby(babyId);
      setModalOpen(false);
      router.replace(targetRoute as any);
    } catch (error) {
      console.error('Error switching active baby:', error);
      setModalOpen(false);
      Alert.alert('Fehler', 'Das aktive Kind konnte nicht gewechselt werden.');
    }
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
      setModalOpen(false);
      router.replace('/(tabs)/pregnancy-home' as any);
    }
    if (!created?.id) {
      setModalOpen(false);
    }
    setNewBabyName('');
    setIsCreating(false);
  };

  const handleChangePhoto = async () => {
    if (!activeBabyId || isChangingPhoto) return;

    setIsChangingPhoto(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      let base64Data: string | null = null;

      if (asset.base64) {
        base64Data = `data:image/jpeg;base64,${asset.base64}`;
      } else if (asset.uri) {
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          base64Data = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error converting baby photo:', error);
          Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
          return;
        }
      }

      if (!base64Data) {
        Alert.alert('Fehler', 'Das Bild konnte nicht verarbeitet werden.');
        return;
      }

      const { error } = await saveBabyInfo({ photo_url: base64Data }, activeBabyId);
      if (error) {
        console.error('Error updating baby photo:', error);
        Alert.alert('Fehler', 'Das Babybild konnte nicht gespeichert werden.');
        return;
      }

      await refreshBabies();
    } catch (error) {
      console.error('Error changing baby photo:', error);
      Alert.alert('Fehler', 'Das Babybild konnte nicht geändert werden.');
    } finally {
      setIsChangingPhoto(false);
    }
  };

  return (
    <>
      {showTrigger && (
        <TouchableOpacity
          style={[
            styles.avatarButton,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          onPress={() => setModalOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isLoading}
        >
          {activeBaby?.photo_url ? (
            <CachedImage
              uri={activeBaby.photo_url}
              style={styles.avatarImage}
              showLoader={false}
            />
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
      )}

      <Modal visible={modalIsOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: modalBgColor }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>Kind auswählen</ThemedText>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <IconSymbol name="xmark" size={18} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.listContainer}>
              {!isLoading && babies.length === 0 && (
                <View style={styles.emptyState}>
                  <ThemedText style={[styles.emptyStateTitle, { color: textColor }]}>
                    Keine Kinder gefunden.
                  </ThemedText>
                  {loadError && (
                    <ThemedText style={[styles.emptyStateHint, { color: subtitleColor }]}>
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
                    style={[styles.babyRow, { backgroundColor: rowBgColor }, isActive && styles.babyRowActive]}
                    onPress={() => baby.id && handleSelectBaby(baby.id)}
                  >
                    {baby.photo_url ? (
                      <CachedImage
                        uri={baby.photo_url}
                        style={styles.babyRowAvatar}
                        showLoader={false}
                      />
                    ) : (
                      <View style={[styles.babyRowAvatar, styles.babyRowFallback]}>
                        <ThemedText style={[styles.babyRowInitial, { color: textColor }]}>
                          {label.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                    <View style={styles.babyRowText}>
                      <ThemedText style={[styles.babyRowTitle, { color: textColor }]}>{label}</ThemedText>
                      {isActive && <ThemedText style={[styles.babyRowSubtitle, { color: subtitleColor }]}>Aktiv</ThemedText>}
                    </View>
                    {isActive && (
                      <IconSymbol name="checkmark.circle.fill" size={18} color="#E9C9B6" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.photoSection, isDark && { borderTopColor: Colors.dark.border }]}>
              <ThemedText style={[styles.photoSectionTitle, { color: textColor }]}>Aktives Kind</ThemedText>
              <TouchableOpacity
                style={[styles.photoButton, isChangingPhoto && styles.createButtonDisabled]}
                onPress={handleChangePhoto}
                disabled={!activeBabyId || isChangingPhoto}
              >
                <ThemedText style={[styles.photoButtonText, { color: textColor }]}>
                  {isChangingPhoto ? 'Bild wird aktualisiert...' : 'Bild ändern'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={[styles.newBabySection, isDark && { borderTopColor: Colors.dark.border }]}>
              <ThemedText style={[styles.newBabyTitle, { color: textColor }]}>Neues Kind</ThemedText>
              <TextInput
                style={[styles.newBabyInput, { backgroundColor: inputBgColor, color: textColor }]}
                placeholder="Name (optional)"
                placeholderTextColor={subtitleColor}
                value={newBabyName}
                onChangeText={setNewBabyName}
              />
              <TouchableOpacity
                style={[styles.createButton, isCreating && styles.createButtonDisabled]}
                onPress={handleCreateBaby}
                disabled={isCreating}
              >
                <ThemedText style={[styles.createButtonText, { color: textColor }]}>
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
    // color wird dynamisch gesetzt
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
    // color wird dynamisch gesetzt
  },
  emptyStateHint: {
    fontSize: 12,
    // color wird dynamisch gesetzt
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
    // color wird dynamisch gesetzt
  },
  babyRowText: {
    flex: 1,
  },
  babyRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    // color wird dynamisch gesetzt
  },
  babyRowSubtitle: {
    fontSize: 12,
    // color wird dynamisch gesetzt
    marginTop: 2,
  },
  photoSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(125, 90, 80, 0.1)',
    paddingTop: 12,
    marginBottom: 12,
  },
  photoSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  photoButton: {
    backgroundColor: '#E9C9B6',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  newBabySection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(125, 90, 80, 0.1)',
    paddingTop: 12,
  },
  newBabyTitle: {
    fontSize: 14,
    fontWeight: '600',
    // color wird dynamisch gesetzt
    marginBottom: 8,
  },
  newBabyInput: {
    // backgroundColor und color werden dynamisch gesetzt
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    // color wird dynamisch gesetzt
  },
});

export default BabySwitcherButton;
