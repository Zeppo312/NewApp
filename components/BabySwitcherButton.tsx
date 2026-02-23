import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { createBaby, deleteBaby, getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
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
  const rowBgColor = isDark ? Colors.dark.cardDark : '#FFFFFF';
  const backdropColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)';
  const modalBorderColor = isDark ? 'rgba(233, 216, 194, 0.22)' : 'rgba(125, 90, 80, 0.08)';
  const rowBorderColor = isDark ? 'rgba(233, 216, 194, 0.2)' : 'rgba(125, 90, 80, 0.1)';
  const activeRowBorderColor = isDark ? 'rgba(233, 201, 182, 0.55)' : '#E9C9B6';
  const activeRowBgColor = isDark ? 'rgba(233, 201, 182, 0.16)' : 'rgba(233, 201, 182, 0.2)';
  const rowFallbackBgColor = isDark ? 'rgba(248, 240, 229, 0.12)' : 'rgba(125, 90, 80, 0.08)';
  const sectionDividerColor = isDark ? 'rgba(233, 216, 194, 0.18)' : 'rgba(125, 90, 80, 0.1)';
  const actionIconColor = isDark ? 'rgba(248, 240, 229, 0.72)' : 'rgba(125, 90, 80, 0.55)';
  const activeStateIconColor = isDark ? '#F2D0B9' : '#E9C9B6';
  const primaryButtonBgColor = isDark ? '#DEC1AE' : '#E9C9B6';
  const primaryButtonTextColor = isDark ? Colors.light.textPrimary : textColor;
  const secondaryButtonBgColor = isDark ? 'rgba(248, 240, 229, 0.12)' : 'rgba(233, 201, 182, 0.25)';
  const secondaryButtonBorderColor = isDark ? 'rgba(233, 216, 194, 0.35)' : 'rgba(125, 90, 80, 0.25)';
  const secondaryButtonTextColor = isDark ? Colors.dark.text : textColor;
  const triggerBgColor = isDark ? 'rgba(248, 240, 229, 0.16)' : 'rgba(255, 255, 255, 0.6)';
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
  const { isBabyBorn, temporaryViewMode, setTemporaryViewMode } = useBabyStatus();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isCreatingBaby, setIsCreatingBaby] = useState(false);
  const [isCreatingPregnancy, setIsCreatingPregnancy] = useState(false);
  const [deletingBabyId, setDeletingBabyId] = useState<string | null>(null);
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
      setTemporaryViewMode(null);
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
    if (isCreatingBaby) return;
    setIsCreatingBaby(true);

    const fallbackName = `Kind ${babies.length + 1}`;

    try {
      const { data, error } = await createBaby({ name: fallbackName });

      if (error) {
        console.error('Error creating baby:', error);
        Alert.alert('Fehler', 'Das neue Kind konnte nicht angelegt werden.');
        return;
      }

      const created = Array.isArray(data) ? data[0] : data;
      await refreshBabies();
      if (created?.id) {
        setTemporaryViewMode(null);
        await setActiveBabyId(created.id);
        setModalOpen(false);
        router.push({ pathname: '/(tabs)/baby', params: { edit: '1', created: '1' } } as any);
        return;
      }

      setModalOpen(false);
    } finally {
      setIsCreatingBaby(false);
    }
  };

  const handleOpenPregnancySetup = async () => {
    if (isCreatingPregnancy) return;
    setIsCreatingPregnancy(true);

    const fallbackName = 'Schwangerschaft';

    try {
      const { data, error } = await createBaby({
        name: fallbackName,
        baby_gender: 'unknown',
        birth_date: null,
      });

      if (error) {
        console.error('Error creating pregnancy baby:', error);
        Alert.alert('Fehler', 'Die Schwangerschaft konnte nicht vorbereitet werden.');
        return;
      }

      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.id) {
        Alert.alert('Fehler', 'Das neue Kind konnte nicht angelegt werden.');
        return;
      }

      await refreshBabies();
      await setActiveBabyId(created.id);
      setTemporaryViewMode(null);
      setModalOpen(false);
      router.push({ pathname: '/pregnancy-setup', params: { babyId: created.id } } as any);
    } catch (error) {
      console.error('Error preparing pregnancy setup:', error);
      Alert.alert('Fehler', 'Die Schwangerschaft konnte nicht vorbereitet werden.');
    } finally {
      setIsCreatingPregnancy(false);
    }
  };

  const handleSwitchViewMode = () => {
    const targetMode = isBabyBorn ? 'pregnancy' : 'baby';
    const targetRoute = targetMode === 'baby' ? '/(tabs)/home' : '/(tabs)/pregnancy-home';
    setTemporaryViewMode(targetMode);
    setModalOpen(false);
    router.replace(targetRoute as any);
  };

  const runDeleteBaby = async (babyId: string, fallbackBabyId: string | null) => {
    try {
      setDeletingBabyId(babyId);
      const isDeletingActive = babyId === activeBabyId;

      const { error } = await deleteBaby(babyId);
      if (error) {
        throw error;
      }

      await refreshBabies();

      if (isDeletingActive && fallbackBabyId) {
        await setActiveBabyId(fallbackBabyId);
        const targetRoute = await getHomeRouteForBaby(fallbackBabyId);
        router.replace(targetRoute as any);
      }
    } catch (error) {
      console.error('Error deleting baby:', error);
      Alert.alert('Fehler', 'Das Kind konnte nicht gelöscht werden.');
    } finally {
      setDeletingBabyId(null);
    }
  };

  const handleDeleteBaby = (babyId: string, label: string) => {
    if (deletingBabyId) return;
    if (babies.length <= 1) {
      Alert.alert('Nicht möglich', 'Du brauchst mindestens ein Kind in der App.');
      return;
    }

    const fallbackBabyId = babies.find((baby) => baby.id && baby.id !== babyId)?.id ?? null;

    Alert.alert(
      'Kind löschen?',
      `Möchtest du "${label}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            void runDeleteBaby(babyId, fallbackBabyId);
          },
        },
      ],
    );
  };

  const handleBabyActions = (babyId: string, label: string) => {
    if (deletingBabyId) return;

    const canDelete = babies.length > 1;
    if (!canDelete) {
      Alert.alert('Verwalten', `"${label}" kann nicht gelöscht werden, weil mindestens ein Kind bestehen bleiben muss.`);
      return;
    }

    Alert.alert(
      `"${label}" verwalten`,
      'Was möchtest du tun?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Kind löschen',
          style: 'destructive',
          onPress: () => handleDeleteBaby(babyId, label),
        },
      ],
    );
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
              backgroundColor: triggerBgColor,
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
        <Pressable style={[styles.modalBackdrop, { backgroundColor: backdropColor }]} onPress={() => setModalOpen(false)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: modalBgColor, borderColor: modalBorderColor, shadowOpacity: isDark ? 0.28 : 0.1 },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
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
                const isDeletingThisBaby = baby.id != null && deletingBabyId === baby.id;
                return (
                  <TouchableOpacity
                    key={baby.id ?? `${label}-${index}`}
                    style={[
                      styles.babyRow,
                      { backgroundColor: rowBgColor, borderColor: rowBorderColor },
                      isActive && { borderColor: activeRowBorderColor, backgroundColor: activeRowBgColor },
                    ]}
                    onPress={() => baby.id && handleSelectBaby(baby.id)}
                    disabled={Boolean(deletingBabyId)}
                  >
                    {baby.photo_url ? (
                      <CachedImage
                        uri={baby.photo_url}
                        style={styles.babyRowAvatar}
                        showLoader={false}
                      />
                    ) : (
                      <View style={[styles.babyRowAvatar, styles.babyRowFallback, { backgroundColor: rowFallbackBgColor }]}>
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
                      <IconSymbol name="checkmark.circle.fill" size={18} color={activeStateIconColor} />
                    )}
                    {baby.id && (
                      <TouchableOpacity
                        style={[
                          styles.babyActionsButton,
                          (isDeletingThisBaby || Boolean(deletingBabyId)) && styles.deleteBabyButtonDisabled,
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          handleBabyActions(baby.id as string, label);
                        }}
                        disabled={isDeletingThisBaby || Boolean(deletingBabyId)}
                      >
                        <IconSymbol
                          name="ellipsis.circle.fill"
                          size={18}
                          color={actionIconColor}
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.photoSection, { borderTopColor: sectionDividerColor }]}>
              <ThemedText style={[styles.photoSectionTitle, { color: textColor }]}>Aktives Kind</ThemedText>
              <TouchableOpacity
                style={[styles.photoButton, { backgroundColor: primaryButtonBgColor }, isChangingPhoto && styles.createButtonDisabled]}
                onPress={handleChangePhoto}
                disabled={!activeBabyId || isChangingPhoto}
              >
                <ThemedText style={[styles.photoButtonText, { color: primaryButtonTextColor }]}>
                  {isChangingPhoto ? 'Bild wird aktualisiert...' : 'Bild ändern'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={[styles.viewModeSection, { borderTopColor: sectionDividerColor }]}>
              <ThemedText style={[styles.viewModeTitle, { color: textColor }]}>Ansicht</ThemedText>
              <TouchableOpacity style={[styles.viewModeButton, { backgroundColor: primaryButtonBgColor }]} onPress={handleSwitchViewMode}>
                <ThemedText style={[styles.viewModeButtonText, { color: primaryButtonTextColor }]}>
                  {isBabyBorn ? 'Schwangerschaftsmodus anschauen' : 'Babymodus anschauen'}
                </ThemedText>
              </TouchableOpacity>
              {temporaryViewMode && (
                <ThemedText style={[styles.viewModeHint, { color: subtitleColor }]}>
                  Temporär aktiv (max. 10 Minuten)
                </ThemedText>
              )}
            </View>

            <View style={[styles.newBabySection, { borderTopColor: sectionDividerColor }]}>
              <ThemedText style={[styles.newBabyTitle, { color: textColor }]}>Neu anlegen</ThemedText>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: primaryButtonBgColor }, isCreatingBaby && styles.createButtonDisabled]}
                onPress={handleCreateBaby}
                disabled={isCreatingBaby}
              >
                <ThemedText style={[styles.createButtonText, { color: primaryButtonTextColor }]}>
                  {isCreatingBaby ? 'Wird angelegt...' : 'Kind anlegen'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  { borderColor: secondaryButtonBorderColor, backgroundColor: secondaryButtonBgColor },
                  (isCreatingPregnancy || isCreatingBaby) && styles.createButtonDisabled,
                ]}
                onPress={handleOpenPregnancySetup}
                disabled={isCreatingPregnancy || isCreatingBaby}
              >
                <ThemedText style={[styles.secondaryActionButtonText, { color: secondaryButtonTextColor }]}>
                  {isCreatingPregnancy ? 'Wird vorbereitet...' : 'Schwangerschaft anlegen'}
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
    borderWidth: 1,
    borderColor: 'transparent',
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
  babyActionsButton: {
    marginLeft: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
  },
  deleteBabyButtonDisabled: {
    opacity: 0.55,
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
  viewModeSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(125, 90, 80, 0.1)',
    paddingTop: 12,
    marginBottom: 12,
  },
  viewModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  viewModeButton: {
    backgroundColor: '#E9C9B6',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewModeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  viewModeHint: {
    fontSize: 12,
    marginTop: 6,
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
  createButton: {
    backgroundColor: '#E9C9B6',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  secondaryActionButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.25)',
    backgroundColor: 'rgba(233, 201, 182, 0.25)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
});

export default BabySwitcherButton;
