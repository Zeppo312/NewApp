import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInMonths,
  differenceInYears,
} from 'date-fns';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import Header from '@/components/Header';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { FloatingAddButton } from '@/components/planner/FloatingAddButton';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import {
  BabyMilestoneEntry,
  createMilestoneEntry,
  deleteMilestoneEntry,
  getMilestoneEntries,
  MilestoneCategory,
  MILESTONE_CATEGORY_LABELS,
  updateMilestoneEntry,
} from '@/lib/milestones';

type CategoryFilter = 'all' | MilestoneCategory;

const MILESTONE_SUGGESTIONS = [
  'Erstes Krabbeln',
  'Erste Schritte',
  'Erster Brei',
  'Erstes Wort',
  'Erster Zahn',
  'Erste durchgeschlafene Nacht',
];

const CATEGORY_ORDER: MilestoneCategory[] = [
  'motorik',
  'ernaehrung',
  'sprache',
  'zahn',
  'schlaf',
  'sonstiges',
];
const PRIMARY_FILTERS: CategoryFilter[] = ['all', 'motorik', 'ernaehrung', 'sprache', 'zahn'];
const MIN_VALID_MILESTONE_DATE = new Date(2000, 0, 1);
const BABY_MODE_PREVIEW_READ_ONLY_MESSAGE =
  'Du bist im Babymodus zur Vorschau. Meilensteine koennen erst nach der Geburt bearbeitet werden.';

const toDateOnly = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fromDateOnly = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const formatAlbumDate = (value: string) =>
  fromDateOnly(value).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const joinGermanParts = (parts: string[]) => {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}`;
};

const formatBabyAgeAtMilestone = (birthDateValue: string | null | undefined, eventDateValue: string) => {
  if (!birthDateValue) return null;

  const birthDate = fromDateOnly(birthDateValue.slice(0, 10));
  const milestoneDate = fromDateOnly(eventDateValue);
  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(milestoneDate.getTime()) ||
    milestoneDate < birthDate
  ) {
    return null;
  }

  const years = differenceInYears(milestoneDate, birthDate);
  const afterYears = addYears(birthDate, years);
  const months = differenceInMonths(milestoneDate, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInCalendarDays(milestoneDate, afterMonths);
  const parts = [
    years > 0 ? `${years} ${years === 1 ? 'Jahr' : 'Jahren'}` : null,
    months > 0 ? `${months} ${months === 1 ? 'Monat' : 'Monaten'}` : null,
    days > 0 ? `${days} ${days === 1 ? 'Tag' : 'Tagen'}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `Mit ${joinGermanParts(parts)}` : 'Am Tag der Geburt';
};

export default function MilestonesScreen() {
  const shareCardRef = useRef<ViewShotRef>(null);
  const adaptiveColors = useAdaptiveColors();
  const insets = useSafeAreaInsets();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#6B4C3B';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';
  const selectedChipBg = isDark ? 'rgba(94,61,179,0.45)' : 'rgba(94,61,179,0.16)';
  const cardBg = isDark ? 'rgba(28,25,28,0.94)' : 'rgba(255,252,246,0.97)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(111,79,61,0.10)';
  const photoMatBg = isDark ? 'rgba(255,255,255,0.08)' : '#FFFDFC';
  const albumAccent = isDark ? 'rgba(225,205,190,0.55)' : 'rgba(166,127,101,0.55)';
  const inputBg = isDark ? 'rgba(20,20,24,0.9)' : 'rgba(255,255,255,0.95)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
  const dateButtonTextColor = isDark ? '#FFFFFF' : textPrimary;

  const router = useRouter();
  const { activeBabyId, activeBaby, isReady } = useActiveBaby();
  const { isReadOnlyPreviewMode } = useBabyStatus();

  const [entries, setEntries] = useState<BabyMilestoneEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BabyMilestoneEntry | null>(null);
  const [previewEntry, setPreviewEntry] = useState<BabyMilestoneEntry | null>(null);
  const [shareEntry, setShareEntry] = useState<BabyMilestoneEntry | null>(null);
  const [shareImageReady, setShareImageReady] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MilestoneCategory>('motorik');
  const [eventDate, setEventDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [initialImageUri, setInitialImageUri] = useState<string | null>(null);

  const modalTitle = editingEntry ? 'Meilenstein bearbeiten' : 'Neuer Meilenstein';
  const showReadOnlyPreviewAlert = useCallback(() => {
    Alert.alert('Nur Vorschau', BABY_MODE_PREVIEW_READ_ONLY_MESSAGE);
  }, []);
  const ensureWritableInCurrentMode = useCallback(() => {
    if (!isReadOnlyPreviewMode) return true;
    showReadOnlyPreviewAlert();
    return false;
  }, [isReadOnlyPreviewMode, showReadOnlyPreviewAlert]);

  const loadEntries = useCallback(async () => {
    if (!isReady) return;

    if (!activeBabyId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const categoryFilter = filter === 'all' ? undefined : filter;
    const { data, error } = await getMilestoneEntries(activeBabyId, categoryFilter);

    if (error) {
      Alert.alert('Fehler', 'Meilensteine konnten nicht geladen werden.');
    } else {
      setEntries(data ?? []);
    }

    setLoading(false);
  }, [activeBabyId, filter, isReady]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }, [loadEntries]);

  const resetForm = () => {
    setEditingEntry(null);
    setTitle('');
    setCategory('motorik');
    setEventDate(new Date());
    setNotes('');
    setImageUri(null);
    setInitialImageUri(null);
    setShowDatePicker(false);
  };

  const openCreateModal = () => {
    if (!ensureWritableInCurrentMode()) return;
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (entry: BabyMilestoneEntry) => {
    if (!ensureWritableInCurrentMode()) return;
    setEditingEntry(entry);
    setTitle(entry.title);
    setCategory(entry.category);
    setEventDate(fromDateOnly(entry.event_date));
    setNotes(entry.notes ?? '');
    setImageUri(entry.image_url ?? null);
    setInitialImageUri(entry.image_url ?? null);
    setShowDatePicker(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setShowModal(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!ensureWritableInCurrentMode()) return;
    if (!activeBabyId) {
      Alert.alert('Hinweis', 'Bitte zuerst ein Baby auswählen.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Hinweis', 'Bitte einen Titel eingeben.');
      return;
    }

    setSaving(true);
    const dateOnly = toDateOnly(eventDate);
    const imageChanged = imageUri !== initialImageUri;

    if (editingEntry?.id) {
      const { error } = await updateMilestoneEntry(editingEntry.id, {
        title: trimmedTitle,
        category,
        event_date: dateOnly,
        notes,
        ...(imageChanged ? { image_uri: imageUri } : {}),
      });

      if (error) {
        Alert.alert('Fehler', 'Der Meilenstein konnte nicht gespeichert werden.');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await createMilestoneEntry({
        baby_id: activeBabyId,
        title: trimmedTitle,
        category,
        event_date: dateOnly,
        notes,
        image_uri: imageUri,
      });

      if (error) {
        Alert.alert('Fehler', 'Der Meilenstein konnte nicht erstellt werden.');
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    await loadEntries();
  };

  const handlePickImage = async () => {
    if (!ensureWritableInCurrentMode()) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleDelete = (entry: BabyMilestoneEntry) => {
    if (!ensureWritableInCurrentMode()) return;
    Alert.alert(
      'Meilenstein löschen',
      'Möchtest du diesen Meilenstein wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            if (!ensureWritableInCurrentMode()) return;
            const { error } = await deleteMilestoneEntry(entry.id);
            if (error) {
              Alert.alert('Fehler', 'Der Meilenstein konnte nicht gelöscht werden.');
              return;
            }
            setShowModal(false);
            resetForm();
            await loadEntries();
          },
        },
      ]
    );
  };

  const openShareCard = (entry: BabyMilestoneEntry) => {
    setShareImageReady(!entry.image_url);
    setShareEntry(entry);
  };

  const closeShareCard = () => {
    if (sharing) return;
    setShareEntry(null);
    setShareImageReady(false);
  };

  const handleShareMilestone = async () => {
    if (!shareEntry || !shareImageReady || sharing) return;

    setSharing(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert('Teilen nicht verfügbar', 'Auf diesem Gerät ist das Teilen von Bildern nicht verfügbar.');
        return;
      }

      const uri = await shareCardRef.current?.capture?.();
      if (!uri) throw new Error('Share-Karte konnte nicht erstellt werden');

      await Sharing.shareAsync(uri, {
        dialogTitle: 'Meilenstein teilen',
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
      setShareEntry(null);
      setShareImageReady(false);
    } catch (error) {
      console.error('Failed to share milestone:', error);
      Alert.alert('Teilen nicht möglich', 'Die Erinnerung konnte nicht geteilt werden. Bitte versuche es erneut.');
    } finally {
      setSharing(false);
    }
  };

  const headerSubtitle = isReadOnlyPreviewMode
    ? 'Vorschau-Modus: nur ansehen'
    : 'Erste Male und besondere Momente';

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title="Meilensteine"
          subtitle={headerSubtitle}
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />

        {isReadOnlyPreviewMode && (
          <View style={styles.readOnlyPreviewBanner}>
            <ThemedText style={styles.readOnlyPreviewTitle}>Nur Vorschau aktiv</ThemedText>
            <ThemedText style={styles.readOnlyPreviewText}>
              Du schaust den Babymodus an. Meilensteine sind hier gesperrt.
            </ThemedText>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.filterRow}>
            {PRIMARY_FILTERS.map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filter === value ? selectedChipBg : chipBg,
                    borderColor: cardBorder,
                  },
                ]}
                onPress={() => setFilter(value)}
              >
                <ThemedText style={[styles.filterChipText, { color: textPrimary }]}>
                  {value === 'all' ? 'Alle' : MILESTONE_CATEGORY_LABELS[value]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            refreshing={refreshing}
            onRefresh={onRefresh}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                {!loading ? (
                  <Image
                    source={require('@/assets/images/Baby_Take_Pic.gif')}
                    style={styles.emptyStateGif}
                    resizeMode="contain"
                  />
                ) : null}
                <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>
                  {loading ? 'Lade Meilensteine...' : 'Noch keine Meilensteine'}
                </ThemedText>
                {!loading ? (
                  <ThemedText style={[styles.emptyText, { color: textSecondary }]}>
                    Trage z. B. „Erstes Krabbeln“ oder „Erster Brei“ ein.
                  </ThemedText>
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
                onPress={() => openEditModal(item)}
                disabled={isReadOnlyPreviewMode}
                activeOpacity={0.9}
              >
                <View style={[styles.albumBinding, { backgroundColor: albumAccent }]} />

                <View style={styles.cardHeader}>
                  <View style={styles.cardHeading}>
                    <ThemedText style={[styles.cardEyebrow, { color: textSecondary }]}>UNSER FOTOBUCH</ThemedText>
                    <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>{item.title}</ThemedText>
                  </View>
                </View>

                {item.image_url ? (
                  <TouchableOpacity
                    style={[styles.photoPrint, { backgroundColor: photoMatBg, borderColor: cardBorder }]}
                    onPress={(event) => {
                      event.stopPropagation();
                      setPreviewEntry(item);
                    }}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} in Vollbild anzeigen`}
                  >
                    <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
                    <View style={styles.photoZoomHint} pointerEvents="none">
                      <IconSymbol name="magnifyingglass" size={14} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.photoPlaceholder, { backgroundColor: selectedChipBg, borderColor: cardBorder }]}>
                    <IconSymbol name="sparkles" size={26} color={textSecondary} />
                    <ThemedText style={[styles.photoPlaceholderText, { color: textSecondary }]}>
                      Ein Moment zum Festhalten
                    </ThemedText>
                  </View>
                )}

                <View style={styles.captionBlock}>
                  <ThemedText style={[styles.cardDate, { color: textPrimary }]}>
                    {formatAlbumDate(item.event_date)}
                  </ThemedText>
                  {item.notes ? (
                    <ThemedText style={[styles.cardNotes, { color: textSecondary }]}>{item.notes}</ThemedText>
                  ) : (
                    <View style={[styles.captionRule, { backgroundColor: cardBorder }]} />
                  )}
                </View>

                <View style={[styles.cardFooter, { borderTopColor: cardBorder }]}>
                  <View style={[styles.badge, { backgroundColor: selectedChipBg }]}>
                    <ThemedText style={[styles.badgeText, { color: textPrimary }]}>
                      {MILESTONE_CATEGORY_LABELS[item.category]}
                    </ThemedText>
                  </View>
                  <View style={styles.cardFooterActions}>
                    <ThemedText style={[styles.pageNumber, { color: textSecondary }]}>
                      SEITE {String(index + 1).padStart(2, '0')}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.cardShareButton, { backgroundColor: selectedChipBg }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        openShareCard(item);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title} teilen`}
                    >
                      <IconSymbol name="square.and.arrow.up" size={16} color={textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {!isReadOnlyPreviewMode ? (
          <FloatingAddButton
            onPress={openCreateModal}
            bottomInset={insets.bottom + 16}
            rightInset={16}
          />
        ) : null}
      </SafeAreaView>

      <Modal
        visible={Boolean(previewEntry?.image_url)}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setPreviewEntry(null)}
      >
        <View style={styles.imageViewer}>
          <TouchableWithoutFeedback
            onPress={() => setPreviewEntry(null)}
            accessibilityRole="button"
            accessibilityLabel="Vollbildansicht schließen"
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          {previewEntry?.image_url ? (
            <View style={styles.fullScreenImage} pointerEvents="none">
              <Image
                source={{ uri: previewEntry.image_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.imageViewerCloseButton, { top: Math.max(insets.top, 14) }]}
            onPress={() => setPreviewEntry(null)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Vollbildansicht schließen"
          >
            <IconSymbol name="xmark" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {previewEntry ? (
            <View
              style={[styles.imageViewerCaption, { paddingBottom: Math.max(insets.bottom, 18) }]}
              pointerEvents="none"
            >
              <ThemedText style={styles.imageViewerTitle}>{previewEntry.title}</ThemedText>
              <ThemedText style={styles.imageViewerDate}>{formatAlbumDate(previewEntry.event_date)}</ThemedText>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={Boolean(shareEntry)}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closeShareCard}
      >
        <View style={styles.shareModalOverlay}>
          <TouchableWithoutFeedback onPress={closeShareCard}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.shareModalCard, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.shareModalHeader}>
              <View>
                <ThemedText adaptive={false} style={styles.shareModalTitle}>Erinnerung teilen</ThemedText>
                <ThemedText adaptive={false} style={styles.shareModalSubtitle}>So wird deine Karte geteilt</ThemedText>
              </View>
              <TouchableOpacity
                style={styles.shareModalCloseButton}
                onPress={closeShareCard}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel="Teilen schließen"
              >
                <IconSymbol name="xmark" size={20} color="#6B4C3B" />
              </TouchableOpacity>
            </View>

            <View style={styles.shareCardFrame}>
              <ViewShot
                ref={shareCardRef}
                style={styles.shareCard}
                options={{ format: 'jpg', quality: 0.96, result: 'tmpfile', width: 1080, height: 1350 }}
              >
                <View style={styles.shareDecorationTop} />
                <View style={styles.shareDecorationBottom} />

                <ThemedText adaptive={false} style={styles.shareCardEyebrow}>
                  {activeBaby?.name
                    ? `MEILENSTEIN VON ${activeBaby.name.toUpperCase()}`
                    : 'UNSER MEILENSTEIN'}
                </ThemedText>
                <ThemedText adaptive={false} style={styles.shareCardTitle} numberOfLines={2}>
                  {shareEntry?.title}
                </ThemedText>

                <View style={styles.shareCardPhotoMat}>
                  {shareEntry?.image_url ? (
                    <Image
                      source={{ uri: shareEntry.image_url }}
                      style={styles.shareCardImage}
                      resizeMode="contain"
                      onLoadEnd={() => setShareImageReady(true)}
                    />
                  ) : (
                    <View style={styles.shareCardPlaceholder}>
                      <IconSymbol name="sparkles" size={32} color="#9A7665" />
                      <ThemedText adaptive={false} style={styles.shareCardPlaceholderText}>
                        Ein besonderer Moment
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.shareCardDetails}>
                  <ThemedText adaptive={false} style={styles.shareCardDate}>
                    {shareEntry ? formatAlbumDate(shareEntry.event_date) : ''}
                  </ThemedText>
                  {shareEntry && formatBabyAgeAtMilestone(activeBaby?.birth_date, shareEntry.event_date) ? (
                    <ThemedText adaptive={false} style={styles.shareCardAge}>
                      {formatBabyAgeAtMilestone(activeBaby?.birth_date, shareEntry.event_date)}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.shareCardFooter}>
                  <View style={styles.shareCardCategory}>
                    <ThemedText adaptive={false} style={styles.shareCardCategoryText}>
                      {shareEntry ? MILESTONE_CATEGORY_LABELS[shareEntry.category] : ''}
                    </ThemedText>
                  </View>
                  <ThemedText adaptive={false} style={styles.shareCardBrand}>LOTTI BABY</ThemedText>
                </View>
              </ViewShot>
            </View>

            <TouchableOpacity
              style={[styles.shareActionButton, (!shareImageReady || sharing) && styles.shareActionButtonDisabled]}
              onPress={handleShareMilestone}
              disabled={!shareImageReady || sharing}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Meilenstein als Bild teilen"
            >
              <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
              <ThemedText adaptive={false} style={styles.shareActionButtonText}>
                {sharing ? 'Karte wird erstellt…' : shareImageReady ? 'Als Bild teilen' : 'Foto wird geladen…'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={handleCloseModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={handleCloseModal}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.modalCard,
              { backgroundColor: inputBg, borderColor: inputBorder },
              { paddingBottom: Math.max(12, insets.bottom) },
            ]}
          >
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeaderRow}>
                <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>{modalTitle}</ThemedText>
                {editingEntry ? (
                  <TouchableOpacity
                    style={[styles.modalDeleteButton, { backgroundColor: chipBg, borderColor: inputBorder }]}
                    onPress={() => handleDelete(editingEntry)}
                    disabled={saving || isReadOnlyPreviewMode}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Meilenstein löschen"
                  >
                    <IconSymbol name="trash" size={18} color={isDark ? '#FF9A9A' : '#D45B5B'} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>Vorschläge</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
                {MILESTONE_SUGGESTIONS.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={[styles.suggestionChip, { backgroundColor: chipBg, borderColor: inputBorder }]}
                    onPress={() => setTitle(suggestion)}
                  >
                    <ThemedText style={[styles.suggestionText, { color: textPrimary }]}>{suggestion}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>Titel</ThemedText>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="z. B. Erste Schritte"
                placeholderTextColor={textSecondary}
                style={[
                  styles.input,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary },
                ]}
              />

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>Kategorie</ThemedText>
              <View style={styles.categoryGrid}>
                {CATEGORY_ORDER.map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: category === value ? selectedChipBg : chipBg,
                        borderColor: inputBorder,
                      },
                    ]}
                    onPress={() => setCategory(value)}
                  >
                    <ThemedText style={[styles.categoryChipText, { color: textPrimary }]}>
                      {MILESTONE_CATEGORY_LABELS[value]}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>Datum</ThemedText>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.85}
              >
                <ThemedText style={[styles.dateButtonText, { color: dateButtonTextColor }]}>
                  {eventDate.toLocaleDateString('de-DE')}
                </ThemedText>
                <IconSymbol name="calendar" size={18} color={textSecondary} />
              </TouchableOpacity>

              {showDatePicker && Platform.OS !== 'ios' ? (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display="default"
                  themeVariant={isDark ? 'dark' : 'light'}
                  minimumDate={MIN_VALID_MILESTONE_DATE}
                  onChange={(_, pickedDate) => {
                    setShowDatePicker(false);
                    if (pickedDate) setEventDate(pickedDate);
                  }}
                  maximumDate={new Date()}
                />
              ) : null}
              {Platform.OS === 'ios' && (
                <IOSBottomDatePicker
                  visible={showDatePicker}
                  title="Datum wählen"
                  value={eventDate}
                  mode="date"
                  minimumDate={MIN_VALID_MILESTONE_DATE}
                  maximumDate={new Date()}
                  onClose={() => setShowDatePicker(false)}
                  onConfirm={(date) => {
                    setEventDate(date);
                    setShowDatePicker(false);
                  }}
                  initialVariant="calendar"
                />
              )}

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>Notiz (optional)</ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Kurz notieren, wie es war..."
                placeholderTextColor={textSecondary}
                multiline
                style={[
                  styles.input,
                  styles.notesInput,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary },
                ]}
              />

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>Foto (optional)</ThemedText>
              <TouchableOpacity
                style={[styles.imagePickerButton, { backgroundColor: chipBg, borderColor: inputBorder }]}
                onPress={handlePickImage}
                activeOpacity={0.85}
              >
                <IconSymbol name="photo" size={18} color={textPrimary} />
                <ThemedText style={[styles.imagePickerButtonText, { color: textPrimary }]}>
                  {imageUri ? 'Bild ändern' : 'Bild auswählen'}
                </ThemedText>
              </TouchableOpacity>

              {imageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
                  <TouchableOpacity
                    style={[styles.removeImageButton, { borderColor: inputBorder }]}
                    onPress={() => setImageUri(null)}
                  >
                    <IconSymbol name="trash" size={14} color={isDark ? '#FF9A9A' : '#D45B5B'} />
                    <ThemedText style={[styles.removeImageText, { color: textPrimary }]}>Bild entfernen</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: chipBg, borderColor: inputBorder }]}
                onPress={handleCloseModal}
                disabled={saving}
              >
                <ThemedText style={[styles.actionButtonText, { color: textPrimary }]}>Abbrechen</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.primaryActionButton, { borderColor: inputBorder }]}
                onPress={handleSave}
                disabled={saving || isReadOnlyPreviewMode}
              >
                <ThemedText style={[styles.actionButtonText, styles.primaryActionText]}>
                  {saving ? 'Speichern...' : 'Speichern'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  readOnlyPreviewBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 210, 160, 0.7)',
    backgroundColor: 'rgba(70, 45, 25, 0.4)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  readOnlyPreviewTitle: {
    color: '#FFE2B3',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  readOnlyPreviewText: {
    color: 'rgba(255, 240, 220, 0.95)',
    fontSize: 12,
    fontWeight: '500',
  },
  filterRow: {
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 13,
    borderWidth: 1,
    alignSelf: 'center',
    flexShrink: 1,
  },
  filterChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 14,
    paddingBottom: 112,
    gap: 18,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyStateGif: {
    width: 180,
    height: 180,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(79, 53, 39, 0.10)',
  },
  albumBinding: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 2,
    paddingBottom: 16,
  },
  cardHeading: {
    flex: 1,
    gap: 4,
  },
  cardEyebrow: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 1.7,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    paddingRight: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardDate: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  cardNotes: {
    fontSize: 14,
    lineHeight: 21,
  },
  photoPrint: {
    position: 'relative',
    borderRadius: 4,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 24,
    boxShadow: '0 4px 12px rgba(54, 38, 30, 0.12)',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 2,
  },
  photoZoomHint: {
    position: 'absolute',
    right: 18,
    top: 18,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33, 25, 22, 0.58)',
  },
  photoPlaceholder: {
    aspectRatio: 4 / 3,
    borderRadius: 4,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  captionBlock: {
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 6,
  },
  captionRule: {
    height: 1,
    width: '38%',
    marginTop: 4,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardShareButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumber: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  shareModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(25,18,16,0.62)',
  },
  shareModalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 28,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingTop: 18,
    backgroundColor: '#FBF8F3',
    boxShadow: '0 20px 50px rgba(35,22,17,0.28)',
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  shareModalTitle: {
    color: '#5D4033',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  shareModalSubtitle: {
    color: '#9A847A',
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 2,
  },
  shareModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0E7DF',
  },
  shareCardFrame: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(78,52,39,0.16)',
  },
  shareCard: {
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 25,
    paddingBottom: 19,
    backgroundColor: '#F7EDE3',
  },
  shareDecorationTop: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -78,
    top: -82,
    backgroundColor: 'rgba(198,171,203,0.28)',
  },
  shareDecorationBottom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    left: -68,
    bottom: -72,
    backgroundColor: 'rgba(222,183,158,0.24)',
  },
  shareCardEyebrow: {
    color: '#9A7665',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1.7,
  },
  shareCardTitle: {
    color: '#5D4033',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    paddingTop: 5,
    paddingBottom: 12,
  },
  shareCardPhotoMat: {
    flex: 1,
    minHeight: 150,
    padding: 9,
    borderRadius: 4,
    borderCurve: 'continuous',
    backgroundColor: '#FFFDFC',
    boxShadow: '0 4px 12px rgba(70,45,34,0.13)',
  },
  shareCardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EEE7E1',
  },
  shareCardPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#EEE5E5',
  },
  shareCardPlaceholderText: {
    color: '#8A6A5C',
    fontSize: 12,
    fontWeight: '700',
  },
  shareCardDetails: {
    paddingTop: 12,
    gap: 1,
  },
  shareCardDate: {
    color: '#5D4033',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  shareCardAge: {
    color: '#927B70',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  shareCardFooter: {
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareCardCategory: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#E8DDEF',
  },
  shareCardCategoryText: {
    color: '#684F5E',
    fontSize: 9,
    fontWeight: '800',
  },
  shareCardBrand: {
    color: '#AC9286',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  shareActionButton: {
    minHeight: 50,
    borderRadius: 17,
    borderCurve: 'continuous',
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6B4C3B',
  },
  shareActionButtonDisabled: {
    opacity: 0.52,
  },
  shareActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  imageViewer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 7, 8, 0.98)',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  imageViewerCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 42,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(8,7,8,0.62)',
  },
  imageViewerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  imageViewerDate: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    maxHeight: '92%',
    minHeight: '55%',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 12,
  },
  modalHeaderRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalDeleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  suggestionRow: {
    paddingBottom: 10,
    gap: 8,
  },
  suggestionChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  imagePickerButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  imagePickerButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  imagePreviewWrap: {
    marginBottom: 14,
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  removeImageButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  removeImageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButton: {
    backgroundColor: '#5E3DB3',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryActionText: {
    color: '#FFFFFF',
  },
});
