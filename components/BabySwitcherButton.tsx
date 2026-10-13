import { offlineText } from '@/lib/offlineTranslations';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertButton,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { ContentColors, getActionColors, LavenderColors } from '@/constants/Colors';
import { FORM_LAYOUT } from '@/constants/Forms';
import { TYPOGRAPHY } from '@/constants/Typography';
import { ActionButton } from '@/components/ui/action-button';
import { GlassSheetSurface } from '@/components/ui/glass-sheet-surface';
import { AvatarModalMaterial } from '@/components/ui/avatar-modal-material';
import { GlassCloseButton } from '@/components/ui/glass-close-button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MotionView, { useReducedMotion } from 'react-native-reanimated';
import { useAvatarModalMotion } from '@/hooks/useAvatarModalMotion';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { createBaby, deleteBaby, getBabyInfo, saveBabyInfo } from '@/lib/baby';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useBabySwitchTransition } from '@/contexts/BabySwitchTransitionContext';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useLocale } from '@/contexts/LocaleContext';

type BabySwitcherButtonProps = {
  size?: number;
  /** Keep the current form open after choosing a baby. */
  navigateOnSelect?: boolean;
  showTrigger?: boolean;
  /** Zeigt unten rechts ein kleines Badge, das den Wechsel zu anderen Kindern andeutet */
  showSwitchHint?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

const LOADING_HINT_DELAY_MS = 500;

const DelayedLoadingHint = (props: React.ComponentProps<typeof ThemedText>) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), LOADING_HINT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  // Reserve the text's natural height so revealing it does not resize the modal.
  return (
    <ThemedText
      {...props}
      style={[props.style, !visible && { opacity: 0 }]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    />
  );
};

const BabySwitcherButton: React.FC<BabySwitcherButtonProps> = ({
  size = 36,
  navigateOnSelect = true,
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
  const { effectiveScheme: colorScheme } = useAdaptiveColors();
  const listCopy = {
    de: { loading: 'Kinder werden aktualisiert …', failed: 'Kinder konnten nicht aktualisiert werden.', retry: 'Erneut versuchen' },
    en: { loading: 'Updating children …', failed: 'Could not update children.', retry: 'Try again' },
    es: { loading: 'Actualizando niños …', failed: 'No se pudieron actualizar los niños.', retry: 'Volver a intentar' },
  }[locale];
  const isDark = colorScheme === 'dark';
  const forms = LavenderColors[colorScheme];
  const actions = getActionColors(colorScheme, 'lavender');
  const textColor = forms.text;
  const subtitleColor = forms.secondary;
  const rowBgColor = forms.field;
  const rowBorderColor = forms.border;
  const activeStateIconColor = isDark ? '#D9B8F4' : actions.primary;
  const activeRowBorderColor = activeStateIconColor;
  const activeRowBgColor = ContentColors[colorScheme].selected;
  const rowFallbackBgColor = actions.secondary;
  const sectionDividerColor = forms.border;
  const actionIconColor = forms.secondary;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { runSwitch, isSwitching } = useBabySwitchTransition();
  const switchCopy = {
    de: { close: 'Schließen', babyArea: 'Babyzeit', pregnancyArea: 'Schwangerschaft' },
    en: { close: 'Close', babyArea: 'Baby days', pregnancyArea: 'Pregnancy' },
    es: { close: 'Cerrar', babyArea: 'Etapa del bebé', pregnancyArea: 'Embarazo' },
  }[locale];
  const triggerBgColor = forms.field;
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
    savedListAt,
  } = useActiveBaby();
  const { isBabyBorn, temporaryViewMode, setTemporaryViewMode } = useBabyStatus();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isCreatingBaby, setIsCreatingBaby] = useState(false);
  const [isCreatingPregnancy, setIsCreatingPregnancy] = useState(false);
  const [deletingBabyId, setDeletingBabyId] = useState<string | null>(null);
  const [isChangingPhoto, setIsChangingPhoto] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
  const [displayedBabyMode, setDisplayedBabyMode] = useState(isBabyBorn);
  const selectionLocked = useRef(false);
  const selectionRevision = useRef(0);
  const currentUser = useRef(user?.id);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    currentUser.current = user?.id;
    selectionLocked.current = false;
    // Auth changed: this account must not inherit a pending selection's UI lock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSelecting(false);
    setPendingSelectionId(null);
    return () => { mounted.current = false; selectionRevision.current += 1; };
  }, [user?.id]);
  const actionBusy = isCreatingBaby || isCreatingPregnancy || isChangingPhoto || Boolean(deletingBabyId);
  const modalIsOpen = isOpen ?? internalIsOpen;
  const setModalOpen = (nextIsOpen: boolean) => {
    if (isOpen === undefined) setInternalIsOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  };
  const { presented: modalPresented, isClosing: isPopupClosing, triggerRef, panelRef, panelStyle, contentStyle, materialStyle, shapeProps, backdropStyle, dismiss: dismissPopup, onPanelLayout, onShow } = useAvatarModalMotion({ open: modalIsOpen, scope: user?.id, onClosed: () => setModalOpen(false) });
  const busy = isSelecting || isSwitching || actionBusy || isPopupClosing;

  useLayoutEffect(() => {
    // Keep the mode button's wrapping stable while the popup dismisses.
    // Capture the current area before an open popup is painted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (modalIsOpen && !busy) setDisplayedBabyMode(isBabyBorn);
  }, [modalIsOpen, busy, isBabyBorn]);

  useEffect(() => {
    if (modalIsOpen && user?.id) void refreshBabies();
  }, [modalIsOpen, refreshBabies, user?.id]);

  const closeModal = () => {
    if (!busy && !selectionLocked.current) void dismissPopup();
  };

  const navigateFromModal = async (
    href: string | { pathname: string; params?: Record<string, string> },
    options?: { replace?: boolean; viewMode?: 'baby' | 'pregnancy' | null },
  ) => {
    if (!await dismissPopup()) return;
    if (options?.viewMode !== undefined) {
      setTemporaryViewMode(options.viewMode);
    }

    // Let the native Modal dismiss after its reverse animation before routing.
    setTimeout(() => {
      if (options?.replace) {
        router.replace(href as any);
        return;
      }

      router.push(href as any);
    }, 0);
  };

  const displayInitial = useMemo(() => {
    const name = activeBaby?.name?.trim();
    if (name) return name.charAt(0).toUpperCase();
    return 'B';
  }, [activeBaby?.name]);

  const getHomeRouteForBaby = async (babyId: string): Promise<'/(tabs)/home' | '/(tabs)/pregnancy-home'> => {
    const knownBaby = babies.find((baby) => baby.id === babyId);
    if (knownBaby?.birth_date) return '/(tabs)/home';

    const { data, error } = await getBabyInfo(babyId);
    if (error) {
      // Keep a saved pregnancy usable offline. When online, a newly recorded
      // birth still takes precedence over the list shown when the popup opened.
      if (knownBaby?.birth_date === null) return '/(tabs)/pregnancy-home';
      throw error;
    }
    return data?.birth_date ? '/(tabs)/home' : '/(tabs)/pregnancy-home';
  };

  const handleSelectBaby = async (babyId: string) => {
    if (busy || selectionLocked.current) return;
    selectionLocked.current = true;
    setIsSelecting(true);
    setPendingSelectionId(babyId);
    const revision = selectionRevision.current;
    const userId = user?.id;
    const isCurrent = () => mounted.current && currentUser.current === userId && selectionRevision.current === revision;
    try {
      const targetRoute = navigateOnSelect ? await getHomeRouteForBaby(babyId) : null;
      if (!isCurrent()) return;
      // Keep the source avatar visible until the panel has returned to it.
      if (!await dismissPopup() || !isCurrent()) return;
      const change = async () => {
        if (!isCurrent()) return;
        if (babyId !== activeBabyId) await setActiveBabyId(babyId);
        if (!isCurrent()) return;
        if (!targetRoute) return;
        await navigateFromModal(targetRoute, {
          replace: true,
          viewMode: targetRoute === '/(tabs)/home' ? 'baby' : 'pregnancy',
        });
      };
      // Embedded editors keep their current form, so only area changes use the veil.
      const knownBaby = babies.find((baby) => baby.id === babyId);
      const changesArea = babyId !== activeBabyId || (
        knownBaby?.birth_date !== undefined && Boolean(knownBaby.birth_date) !== isBabyBorn
      );
      if (navigateOnSelect && changesArea) await runSwitch(change);
      else await change();
    } catch (error) {
      if (!isCurrent()) return;
      console.error('Error switching active baby:', error);
      Alert.alert(c.error, c.switchFailed);
    } finally {
      if (isCurrent()) {
        selectionLocked.current = false;
        setIsSelecting(false);
        setPendingSelectionId(null);
      }
    }
  };

  const handleCreateBaby = async () => {
    if (isCreatingBaby || selectionLocked.current || isSwitching) return;
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
        await navigateFromModal({
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

      await dismissPopup();
    } finally {
      setIsCreatingBaby(false);
    }
  };

  const handleOpenPregnancySetup = async () => {
    if (isCreatingPregnancy || selectionLocked.current || isSwitching) return;
    setIsCreatingPregnancy(true);

    try {
      await navigateFromModal('/pregnancy-setup');
    } catch (error) {
      console.error('Error preparing pregnancy setup:', error);
      Alert.alert(c.error, c.pregnancyFailed);
    } finally {
      setIsCreatingPregnancy(false);
    }
  };

  const handleSwitchViewMode = async () => {
    if (busy || selectionLocked.current) return;
    selectionLocked.current = true;
    setIsSelecting(true);
    const revision = selectionRevision.current;
    const targetMode = isBabyBorn ? 'pregnancy' : 'baby';
    const targetRoute = targetMode === 'baby' ? '/(tabs)/home' : '/(tabs)/pregnancy-home';
    try {
      if (!await dismissPopup()) return;
      await runSwitch(() => navigateFromModal(targetRoute, { replace: true, viewMode: targetMode }));
    } finally {
      if (mounted.current && selectionRevision.current === revision) {
        selectionLocked.current = false;
        setIsSelecting(false);
      }
    }
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
      await navigateFromModal({
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
    if (deletingBabyId || selectionLocked.current || isSwitching) return;

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
    if (!activeBabyId || isChangingPhoto || selectionLocked.current || isSwitching) return;

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
    if (!showSwitchHint || !showTrigger || reducedMotion || modalPresented) return;
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
  }, [showSwitchHint, showTrigger, hintScale, reducedMotion, modalPresented]);

  const animatePress = (pressed: boolean) => {
    if (reducedMotion) return;
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
          accessibilityRole="button"
          accessibilityLabel={c.select}
          activeOpacity={0.9}
          onPress={() => { if (!busy) setModalOpen(true); }}
          onPressIn={() => animatePress(true)}
          onPressOut={() => animatePress(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={busy || (isLoading && babies.length === 0)}
        >
         <View ref={triggerRef} collapsable={false} testID="baby-switcher-trigger" style={{ width: size, height: size }}>
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
                  borderColor: forms.secondary,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.avatarInitial,
                  {
                    color: forms.text,
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
         </View>
        </TouchableOpacity>
      )}

      {modalPresented && (
        <Modal
          visible={modalPresented}
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="none"
          onShow={onShow}
          onRequestClose={closeModal}
        >
          <View style={[styles.modalViewport, {
            paddingTop: insets.top + FORM_LAYOUT.edge,
            paddingBottom: Math.max(insets.bottom, FORM_LAYOUT.edge),
            paddingLeft: Math.max(insets.left, FORM_LAYOUT.edge),
            paddingRight: Math.max(insets.right, FORM_LAYOUT.edge),
          }]}>
            <MotionView.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, backdropStyle]}>
              <Pressable
                accessible={false}
                focusable={false}
                disabled={busy}
                style={[StyleSheet.absoluteFill, { backgroundColor: forms.backdrop }]}
                onPress={closeModal}
              />
            </MotionView.View>
            <View
              ref={panelRef}
              collapsable={false}
              onLayout={onPanelLayout}
              style={styles.modalCard}
              testID="baby-switcher-layout"
            >
              <MotionView.View
                pointerEvents={isPopupClosing ? 'none' : 'auto'}
                style={[styles.modalSurface, panelStyle]}
                testID="baby-switcher-motion"
              >
                <MotionView.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.modalShadow, materialStyle]} />
                <GlassSheetSurface isDark={isDark} tone="lavender" style={styles.modalSurface} testID="baby-switcher-panel"
                  material={<AvatarModalMaterial isDark={isDark} shapeProps={shapeProps} materialStyle={materialStyle} />}
                >
                  <MotionView.View style={[styles.modalSurface, contentStyle]} testID="baby-switcher-content">
                    <View style={styles.modalHeader}>
                      <GlassCloseButton
                        accessibilityLabel={switchCopy.close}
                        disabled={busy}
                        onPress={closeModal}
                        isDark={isDark}
                      />
                      <ThemedText accessibilityRole="header" style={[styles.modalTitle, { color: textColor }]}>{c.select}</ThemedText>
                      <View style={styles.headerSpacer} />
                    </View>
                    <ScrollView
                      testID="baby-switcher-scroll"
                      style={styles.modalScroll}
                      contentContainerStyle={styles.modalContent}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={styles.listContainer}>
                        {!isLoading && savedListAt && <ThemedText style={[styles.emptyStateHint, {color:subtitleColor}]}>{offlineText(locale, 'asOf', {time:new Date(savedListAt).toLocaleString(locale)})}</ThemedText>}
                        {modalIsOpen && isLoading && babies.length === 0 && user?.id && (
                          <DelayedLoadingHint key={user.id} accessibilityRole="text" style={[styles.emptyStateHint, { color: subtitleColor }]}>
                            {listCopy.loading}
                          </DelayedLoadingHint>
                        )}
                        {!isLoading && loadError && (
                          <View style={styles.emptyState}>
                            <ThemedText style={[styles.emptyStateHint, { color: subtitleColor }]}>
                              {listCopy.failed}
                            </ThemedText>
                            <TouchableOpacity accessibilityRole="button" onPress={() => { void refreshBabies(); }}>
                              <ThemedText style={[styles.retryText, { color: textColor }]}>{listCopy.retry}</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                        {!isLoading && !loadError && babies.length === 0 && (
                          <View style={styles.emptyState}>
                            <ThemedText style={[styles.emptyStateTitle, { color: textColor }]}>
                              {c.none}
                            </ThemedText>
                          </View>
                        )}
                        {babies.map((baby, index) => {
                          const label = baby.name?.trim() || `${c.child} ${index + 1}`;
                          const isActive = baby.id === (pendingSelectionId ?? activeBabyId);
                          const isDeletingThisBaby = baby.id != null && deletingBabyId === baby.id;
                          return (
                            <View
                              key={baby.id ?? `${label}-${index}`}
                              testID={`baby-switcher-row-${baby.id ?? index}`}
                              style={[
                                styles.babyRow,
                                { backgroundColor: rowBgColor, borderColor: rowBorderColor },
                                isActive && { borderColor: activeRowBorderColor, backgroundColor: activeRowBgColor },
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.babySelectButton}
                                accessibilityRole="radio"
                                accessibilityLabel={label}
                                accessibilityHint={baby.birth_date ? switchCopy.babyArea : switchCopy.pregnancyArea}
                                accessibilityState={{ checked: isActive, disabled: busy, busy: isSelecting }}
                                onPress={() => { if (baby.id) void handleSelectBaby(baby.id); }}
                                disabled={busy}
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
                                  <ThemedText style={[styles.babyRowSubtitle, { color: subtitleColor }]}>
                                    {baby.birth_date ? switchCopy.babyArea : switchCopy.pregnancyArea}
                                  </ThemedText>
                                </View>
                                <View style={styles.selectionMark}>
                                  {isActive && <IconSymbol name="checkmark.circle.fill" size={18} color={activeStateIconColor} />}
                                </View>
                              </TouchableOpacity>
                              {baby.id && (
                                <TouchableOpacity
                                  accessibilityRole="button"
                                  accessibilityLabel={c.manage(label)}
                                  style={[
                                    styles.babyActionsButton,
                                    (isDeletingThisBaby || actionBusy) && styles.deleteBabyButtonDisabled,
                                  ]}
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    handleBabyActions(baby.id as string, label);
                                  }}
                                  disabled={busy}
                                >
                                  <IconSymbol
                                    name="ellipsis.circle.fill"
                                    size={18}
                                    color={actionIconColor}
                                  />
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })}
                      </View>

                      <View style={[styles.section, { borderTopColor: sectionDividerColor }]}>
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>{c.activeChild}</ThemedText>
                        <ActionButton
                          tone="lavender"
                          label={c.changeImage}
                          busy={isChangingPhoto}
                          busyLabel={c.updating}
                          variant="secondary"
                          isDark={isDark}
                          interactionDisabled={isSelecting || isSwitching}
                          onPress={handleChangePhoto}
                          disabled={!activeBabyId || (actionBusy && !isChangingPhoto)}
                        />
                      </View>

                      <View style={[styles.section, { borderTopColor: sectionDividerColor }]}>
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>{c.view}</ThemedText>
                        <ActionButton
                          tone="lavender"
                          label={displayedBabyMode ? c.pregnancyMode : c.babyMode}
                          variant="secondary"
                          isDark={isDark}
                          interactionDisabled={isSelecting || isSwitching}
                          disabled={actionBusy}
                          onPress={() => { void handleSwitchViewMode(); }}
                        />
                          <ThemedText
                            accessibilityElementsHidden={!temporaryViewMode}
                            importantForAccessibility={temporaryViewMode ? 'auto' : 'no-hide-descendants'}
                            style={[styles.viewModeHint, { color: subtitleColor, opacity: temporaryViewMode ? 1 : 0 }]}
                          >
                            {c.temporary}
                          </ThemedText>
                      </View>

                      <View style={[styles.section, { borderTopColor: sectionDividerColor }]}>
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>{c.createNew}</ThemedText>
                        <ActionButton
                          tone="lavender"
                          label={c.createChild}
                          busy={isCreatingBaby}
                          busyLabel={c.creating}
                          isDark={isDark}
                          interactionDisabled={isSelecting || isSwitching}
                          onPress={handleCreateBaby}
                          disabled={actionBusy && !isCreatingBaby}
                        />
                        <ActionButton
                          tone="lavender"
                          label={c.createPregnancy}
                          busy={isCreatingPregnancy}
                          busyLabel={c.preparing}
                          variant="secondary"
                          isDark={isDark}
                          interactionDisabled={isSelecting || isSwitching}
                          onPress={handleOpenPregnancySetup}
                          disabled={actionBusy && !isCreatingPregnancy}
                        />
                      </View>
                    </ScrollView>
                  </MotionView.View>
                </GlassSheetSurface>
              </MotionView.View>
            </View>
          </View>
        </Modal>
      )}
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
  modalViewport: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 440,
    maxHeight: '100%',
    flexShrink: 1,
  },
  modalSurface: { maxHeight: '100%', flexShrink: 1 },
  modalShadow: { borderRadius: 32, boxShadow: '0 8px 32px rgba(35,25,20,0.14)' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: FORM_LAYOUT.contentPadding,
    paddingBottom: 16,
  },
  headerSpacer: { width: FORM_LAYOUT.closeSize },
  modalTitle: { ...TYPOGRAPHY.dialogTitle, flex: 1, textAlign: 'center' },
  modalScroll: { flexShrink: 1 },
  modalContent: {
    paddingHorizontal: FORM_LAYOUT.contentPadding,
    paddingBottom: FORM_LAYOUT.contentPadding,
    gap: FORM_LAYOUT.sectionGap,
  },
  listContainer: { gap: 10 },
  emptyState: { paddingVertical: 8 },
  emptyStateTitle: TYPOGRAPHY.label,
  emptyStateHint: { ...TYPOGRAPHY.caption, marginTop: 4 },
  retryText: { ...TYPOGRAPHY.buttonSmall, paddingVertical: 8 },
  babyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    padding: 12,
    borderRadius: FORM_LAYOUT.fieldRadius,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  babyRowAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  babySelectButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  selectionMark: { width: 20, alignItems: 'center', marginLeft: 4 },
  babyRowFallback: { alignItems: 'center', justifyContent: 'center' },
  babyRowInitial: TYPOGRAPHY.headline,
  babyRowText: { flex: 1, minWidth: 0 },
  babyRowTitle: TYPOGRAPHY.bodyStrong,
  babyRowSubtitle: { ...TYPOGRAPHY.caption, marginTop: 2 },
  babyActionsButton: {
    marginLeft: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBabyButtonDisabled: { opacity: 0.55 },
  section: {
    borderTopWidth: 1,
    paddingTop: FORM_LAYOUT.sectionGap,
    gap: FORM_LAYOUT.fieldGap,
  },
  sectionTitle: TYPOGRAPHY.label,
  viewModeHint: TYPOGRAPHY.caption,
});

export default BabySwitcherButton;
