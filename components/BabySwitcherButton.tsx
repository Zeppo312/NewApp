import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertButton,
  Animated,
  Easing,
  InteractionManager,
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
import { useLocale } from '@/contexts/LocaleContext';

type BabySwitcherButtonProps = {
  size?: number;
  showTrigger?: boolean;
  /** Zeigt unten rechts ein kleines Badge, das den Wechsel zu anderen Kindern andeutet */
  showSwitchHint?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

const BabySwitcherButton: React.FC<BabySwitcherButtonProps> = ({
  size = 36,
  showTrigger = true,
  showSwitchHint = false,
  isOpen,
  onOpenChange,
}) => {
  const { locale } = useLocale();
  const c = {
    de: { error: 'Fehler', switchFailed: 'Das aktive Kind konnte nicht gewechselt werden.', child: 'Kind', createFailed: 'Das neue Kind konnte nicht angelegt werden.', pregnancyFailed: 'Die Schwangerschaft konnte nicht vorbereitet werden.', deleteFailed: 'Das Kind konnte nicht gelöscht werden.', notPossible: 'Nicht möglich', needOne: 'Du brauchst mindestens ein Kind in der App.', deleteQuestion: 'Kind löschen?', deleteBody: (name: string) => `Möchtest du „${name}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, cancel: 'Abbrechen', delete: 'Löschen', editOpenFailed: 'Das Kind konnte nicht zum Bearbeiten geöffnet werden.', edit: 'Bearbeiten', deleteChild: 'Kind löschen', manage: (name: string) => `„${name}“ verwalten`, whatDo: 'Was möchtest du tun?', cannotDelete: (name: string) => `„${name}“ kann nicht gelöscht werden, weil mindestens ein Kind bestehen bleiben muss.`, permission: 'Berechtigung erforderlich', photoPermission: 'Bitte erlaube den Zugriff auf deine Fotos.', imageProcess: 'Das Bild konnte nicht verarbeitet werden.', imageSave: 'Das Babybild konnte nicht gespeichert werden.', imageChange: 'Das Babybild konnte nicht geändert werden.', select: 'Kind auswählen', none: 'Keine Kinder gefunden.', active: 'Aktiv', activeChild: 'Aktives Kind', updating: 'Bild wird aktualisiert…', changeImage: 'Bild ändern', view: 'Ansicht', pregnancyMode: 'Schwangerschaftsmodus anschauen', babyMode: 'Babymodus anschauen', temporary: 'Temporär aktiv (max. 10 Minuten)', createNew: 'Neu anlegen', creating: 'Wird angelegt…', createChild: 'Kind anlegen', preparing: 'Wird vorbereitet…', createPregnancy: 'Schwangerschaft anlegen' },
    en: { error: 'Error', switchFailed: 'The active child could not be changed.', child: 'Child', createFailed: 'The new child could not be created.', pregnancyFailed: 'Pregnancy setup could not be prepared.', deleteFailed: 'The child could not be deleted.', notPossible: 'Not possible', needOne: 'You need at least one child in the app.', deleteQuestion: 'Delete child?', deleteBody: (name: string) => `Are you sure you want to delete “${name}”? This cannot be undone.`, cancel: 'Cancel', delete: 'Delete', editOpenFailed: 'The child could not be opened for editing.', edit: 'Edit', deleteChild: 'Delete child', manage: (name: string) => `Manage “${name}”`, whatDo: 'What would you like to do?', cannotDelete: (name: string) => `“${name}” cannot be deleted because at least one child must remain.`, permission: 'Permission required', photoPermission: 'Please allow access to your photos.', imageProcess: 'The image could not be processed.', imageSave: "The baby's photo could not be saved.", imageChange: "The baby's photo could not be changed.", select: 'Select child', none: 'No children found.', active: 'Active', activeChild: 'Active child', updating: 'Updating photo…', changeImage: 'Change photo', view: 'View', pregnancyMode: 'View pregnancy mode', babyMode: 'View baby mode', temporary: 'Temporarily active (up to 10 minutes)', createNew: 'Create new', creating: 'Creating…', createChild: 'Add child', preparing: 'Preparing…', createPregnancy: 'Add pregnancy' },
    es: { error: 'Error', switchFailed: 'No se pudo cambiar el niño activo.', child: 'Niño', createFailed: 'No se pudo crear el nuevo niño.', pregnancyFailed: 'No se pudo preparar el embarazo.', deleteFailed: 'No se pudo eliminar el niño.', notPossible: 'No es posible', needOne: 'Necesitas al menos un niño en la aplicación.', deleteQuestion: '¿Eliminar niño?', deleteBody: (name: string) => `¿Seguro que quieres eliminar a «${name}»? Esta acción no se puede deshacer.`, cancel: 'Cancelar', delete: 'Eliminar', editOpenFailed: 'No se pudo abrir el niño para editarlo.', edit: 'Editar', deleteChild: 'Eliminar niño', manage: (name: string) => `Gestionar «${name}»`, whatDo: '¿Qué quieres hacer?', cannotDelete: (name: string) => `No se puede eliminar a «${name}» porque debe quedar al menos un niño.`, permission: 'Permiso necesario', photoPermission: 'Permite el acceso a tus fotos.', imageProcess: 'No se pudo procesar la imagen.', imageSave: 'No se pudo guardar la foto del bebé.', imageChange: 'No se pudo cambiar la foto del bebé.', select: 'Seleccionar niño', none: 'No se encontraron niños.', active: 'Activo', activeChild: 'Niño activo', updating: 'Actualizando foto…', changeImage: 'Cambiar foto', view: 'Vista', pregnancyMode: 'Ver modo embarazo', babyMode: 'Ver modo bebé', temporary: 'Activo temporalmente (máx. 10 minutos)', createNew: 'Crear nuevo', creating: 'Creando…', createChild: 'Añadir niño', preparing: 'Preparando…', createPregnancy: 'Añadir embarazo' },
  }[locale];
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

  const navigateFromModal = (
    href: string | { pathname: string; params?: Record<string, string> },
    options?: { replace?: boolean; viewMode?: 'baby' | 'pregnancy' | null },
  ) => {
    if (options?.viewMode !== undefined) {
      setTemporaryViewMode(options.viewMode);
    }

    setModalOpen(false);

    InteractionManager.runAfterInteractions(() => {
      if (options?.replace) {
        router.replace(href as any);
        return;
      }

      router.push(href as any);
    });
  };

  const displayInitial = useMemo(() => {
    const name = activeBaby?.name?.trim();
    if (name) return name.charAt(0).toUpperCase();
    return 'B';
  }, [activeBaby?.name]);

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
      navigateFromModal(targetRoute, {
        replace: true,
        viewMode: targetRoute === '/(tabs)/home' ? 'baby' : 'pregnancy',
      });
    } catch (error) {
      console.error('Error switching active baby:', error);
      setModalOpen(false);
      Alert.alert(c.error, c.switchFailed);
    }
  };

  const handleCreateBaby = async () => {
    if (isCreatingBaby) return;
    setIsCreatingBaby(true);

    const fallbackName = `${c.child} ${babies.length + 1}`;

    try {
      const { data, error } = await createBaby({ name: fallbackName });

      if (error) {
        console.error('Error creating baby:', error);
        Alert.alert(c.error, c.createFailed);
        return;
      }

      const created = Array.isArray(data) ? data[0] : data;
      await refreshBabies();
      if (created?.id) {
        await setActiveBabyId(created.id);
        navigateFromModal({
          pathname: '/(tabs)/baby',
          params: {
            babyId: created.id,
            edit: '1',
            created: '1',
          },
        }, {
          viewMode: 'baby',
        });
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

    try {
      navigateFromModal('/pregnancy-setup');
    } catch (error) {
      console.error('Error preparing pregnancy setup:', error);
      Alert.alert(c.error, c.pregnancyFailed);
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
      Alert.alert(c.error, c.deleteFailed);
    } finally {
      setDeletingBabyId(null);
    }
  };

  const handleDeleteBaby = (babyId: string, label: string) => {
    if (deletingBabyId) return;
    if (babies.length <= 1) {
      Alert.alert(c.notPossible, c.needOne);
      return;
    }

    const fallbackBabyId = babies.find((baby) => baby.id && baby.id !== babyId)?.id ?? null;

    Alert.alert(
      c.deleteQuestion,
      c.deleteBody(label),
      [
        { text: c.cancel, style: 'cancel' },
        {
          text: c.delete,
          style: 'destructive',
          onPress: () => {
            void runDeleteBaby(babyId, fallbackBabyId);
          },
        },
      ],
    );
  };

  const handleEditBaby = async (babyId: string) => {
    try {
      await setActiveBabyId(babyId);
      navigateFromModal({
        pathname: '/(tabs)/baby',
        params: {
          babyId,
          edit: '1',
        },
      }, {
        viewMode: 'baby',
      });
    } catch (error) {
      console.error('Error opening baby edit screen:', error);
      Alert.alert(c.error, c.editOpenFailed);
    }
  };

  const handleBabyActions = (babyId: string, label: string) => {
    if (deletingBabyId) return;

    const canDelete = babies.length > 1;
    const actions: AlertButton[] = [
      { text: c.cancel, style: 'cancel' as const },
      {
        text: c.edit,
        onPress: () => {
          void handleEditBaby(babyId);
        },
      },
    ];

    if (canDelete) {
      actions.push({
        text: c.deleteChild,
        style: 'destructive' as const,
        onPress: () => handleDeleteBaby(babyId, label),
      });
    }

    Alert.alert(
      c.manage(label),
      canDelete
        ? c.whatDo
        : c.cannotDelete(label),
      actions,
    );
  };

  const handleChangePhoto = async () => {
    if (!activeBabyId || isChangingPhoto) return;

    setIsChangingPhoto(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(c.permission, c.photoPermission);
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
          Alert.alert(c.error, c.imageProcess);
          return;
        }
      }

      if (!base64Data) {
        Alert.alert(c.error, c.imageProcess);
        return;
      }

      const { error } = await saveBabyInfo({ photo_url: base64Data }, activeBabyId);
      if (error) {
        console.error('Error updating baby photo:', error);
        Alert.alert(c.error, c.imageSave);
        return;
      }

      await refreshBabies();
    } catch (error) {
      console.error('Error changing baby photo:', error);
      Alert.alert(c.error, c.imageChange);
    } finally {
      setIsChangingPhoto(false);
    }
  };

  const otherBabies = useMemo(
    () => babies.filter((baby) => baby.id && baby.id !== activeBabyId),
    [babies, activeBabyId],
  );
  const otherBabyCount = otherBabies.length;
  const previewBabies = otherBabies.slice(0, 2);
  const overflowCount = otherBabyCount - previewBabies.length;
  const miniSize = Math.max(16, Math.round(size * 0.3));
  const hintSize = miniSize + 6;
  const hintBgColor = isDark ? 'rgba(52, 40, 78, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const hintBorderColor = isDark ? 'rgba(30, 24, 40, 0.9)' : 'rgba(255, 255, 255, 0.95)';
  const miniBorderColor = isDark ? 'rgba(52, 40, 78, 1)' : '#FFFFFF';
  const miniFallbackBg = isDark ? 'rgba(142, 104, 220, 0.5)' : 'rgba(94, 61, 179, 0.14)';
  const miniTextColor = isDark ? '#FFFFFF' : '#5E3DB3';
  const initialOf = (name?: string | null) => (name?.trim()?.charAt(0) || '?').toUpperCase();

  // Dezentes „Atmen“ des Badges + Ping-Ring, damit der Avatar als Button lesbar ist.
  const [pressScale] = useState(() => new Animated.Value(1));
  const [hintScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!showSwitchHint || !showTrigger) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(hintScale, { toValue: 1.14, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hintScale, { toValue: 1, duration: 480, easing: Easing.out(Easing.back(2.5)), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      hintScale.setValue(1);
    };
  }, [showSwitchHint, showTrigger, hintScale]);

  const animatePress = (pressed: boolean) => {
    Animated.spring(pressScale, {
      toValue: pressed ? 0.92 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {showTrigger && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setModalOpen(true)}
          onPressIn={() => animatePress(true)}
          onPressOut={() => animatePress(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isLoading}
        >
         <Animated.View style={[styles.avatarButton, { width: size, height: size, transform: [{ scale: pressScale }] }]}>
          <View
            style={[
              styles.avatarClip,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: triggerBgColor,
              },
            ]}
          >
          {activeBaby?.photo_url ? (
            <CachedImage
              uri={activeBaby.photo_url}
              style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
              showLoader={false}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderColor: theme.text,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.avatarInitial,
                  {
                    color: theme.text,
                    fontSize: Math.round(size * 0.34),
                    lineHeight: Math.round(size * 0.4),
                  },
                ]}
              >
                {displayInitial}
              </ThemedText>
            </View>
          )}
          </View>
          {showSwitchHint && (
            <Animated.View
              style={[
                styles.switchHint,
                {
                  height: hintSize,
                  borderRadius: hintSize / 2,
                  backgroundColor: hintBgColor,
                  borderColor: hintBorderColor,
                  transform: [{ scale: hintScale }],
                },
              ]}
            >
              {previewBabies.length > 0 ? (
                <View style={styles.miniStack}>
                  {previewBabies.map((baby, index) => (
                    <View
                      key={baby.id ?? `mini-${index}`}
                      style={[
                        styles.miniAvatar,
                        {
                          width: miniSize,
                          height: miniSize,
                          borderRadius: miniSize / 2,
                          borderColor: miniBorderColor,
                          backgroundColor: miniFallbackBg,
                          marginLeft: index === 0 ? 0 : -Math.round(miniSize * 0.35),
                          zIndex: 10 - index,
                        },
                      ]}
                    >
                      {baby.photo_url ? (
                        <CachedImage
                          uri={baby.photo_url}
                          style={[styles.miniAvatarImage, { width: miniSize, height: miniSize }]}
                          showLoader={false}
                        />
                      ) : (
                        <ThemedText style={[styles.miniInitial, { color: miniTextColor, fontSize: Math.round(miniSize * 0.5) }]}>
                          {initialOf(baby.name)}
                        </ThemedText>
                      )}
                    </View>
                  ))}
                  {overflowCount > 0 && (
                    <ThemedText style={[styles.miniOverflow, { color: miniTextColor, fontSize: Math.round(miniSize * 0.55) }]}>
                      +{overflowCount}
                    </ThemedText>
                  )}
                  <IconSymbol name="chevron.down" size={Math.round(miniSize * 0.7)} color={miniTextColor} style={styles.miniChevron} />
                </View>
              ) : (
                <View style={[styles.miniSolo, { width: miniSize, height: miniSize, borderRadius: miniSize / 2 }]}>
                  <IconSymbol name="arrow.left.arrow.right" size={Math.round(miniSize * 0.62)} color="#FFFFFF" />
                </View>
              )}
            </Animated.View>
          )}
         </Animated.View>
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
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>{c.select}</ThemedText>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <IconSymbol name="xmark" size={18} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.listContainer}>
              {!isLoading && babies.length === 0 && (
                <View style={styles.emptyState}>
                  <ThemedText style={[styles.emptyStateTitle, { color: textColor }]}>
                    {c.none}
                  </ThemedText>
                  {loadError && (
                    <ThemedText style={[styles.emptyStateHint, { color: subtitleColor }]}>
                      {c.error}: {loadError}
                    </ThemedText>
                  )}
                </View>
              )}
              {babies.map((baby, index) => {
                const label = baby.name?.trim() || `${c.child} ${index + 1}`;
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
                      {isActive && <ThemedText style={[styles.babyRowSubtitle, { color: subtitleColor }]}>{c.active}</ThemedText>}
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
              <ThemedText style={[styles.photoSectionTitle, { color: textColor }]}>{c.activeChild}</ThemedText>
              <TouchableOpacity
                style={[styles.photoButton, { backgroundColor: primaryButtonBgColor }, isChangingPhoto && styles.createButtonDisabled]}
                onPress={handleChangePhoto}
                disabled={!activeBabyId || isChangingPhoto}
              >
                <ThemedText style={[styles.photoButtonText, { color: primaryButtonTextColor }]}>
                  {isChangingPhoto ? c.updating : c.changeImage}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={[styles.viewModeSection, { borderTopColor: sectionDividerColor }]}>
              <ThemedText style={[styles.viewModeTitle, { color: textColor }]}>{c.view}</ThemedText>
              <TouchableOpacity style={[styles.viewModeButton, { backgroundColor: primaryButtonBgColor }]} onPress={handleSwitchViewMode}>
                <ThemedText style={[styles.viewModeButtonText, { color: primaryButtonTextColor }]}>
                  {isBabyBorn ? c.pregnancyMode : c.babyMode}
                </ThemedText>
              </TouchableOpacity>
              {temporaryViewMode && (
                <ThemedText style={[styles.viewModeHint, { color: subtitleColor }]}>
                  {c.temporary}
                </ThemedText>
              )}
            </View>

            <View style={[styles.newBabySection, { borderTopColor: sectionDividerColor }]}>
              <ThemedText style={[styles.newBabyTitle, { color: textColor }]}>{c.createNew}</ThemedText>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: primaryButtonBgColor }, isCreatingBaby && styles.createButtonDisabled]}
                onPress={handleCreateBaby}
                disabled={isCreatingBaby}
              >
                <ThemedText style={[styles.createButtonText, { color: primaryButtonTextColor }]}>
                  {isCreatingBaby ? c.creating : c.createChild}
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
                  {isCreatingPregnancy ? c.preparing : c.createPregnancy}
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
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarClip: {
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarInitial: {
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  switchHint: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    paddingHorizontal: 3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A2470',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 6,
  },
  miniStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarImage: {
    width: '100%',
    height: '100%',
  },
  miniInitial: {
    fontWeight: '800',
  },
  miniOverflow: {
    fontWeight: '800',
    marginLeft: 2,
  },
  miniChevron: {
    marginLeft: 1,
    marginRight: -1,
  },
  miniSolo: {
    backgroundColor: '#5E3DB3',
    alignItems: 'center',
    justifyContent: 'center',
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
