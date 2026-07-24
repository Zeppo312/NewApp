import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  updateMilestoneEntry,
} from '@/lib/milestones';
import { generateMilestonePhotobookPdf } from '@/lib/milestonePhotobookPdf';
import {
  DEFAULT_MILESTONE_LOCALE,
  formatBabyAgeAtMilestone,
  formatMilestoneDate,
  getMilestoneCategoryLabel,
  getMilestoneLocaleTag,
  MILESTONE_SUGGESTION_KEYS,
  translateMilestoneText,
} from '@/lib/milestoneTranslations';

type CategoryFilter = 'all' | MilestoneCategory;

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
const ACTIVE_MILESTONE_LOCALE = DEFAULT_MILESTONE_LOCALE;
const MILESTONE_DATE_LOCALE = getMilestoneLocaleTag(ACTIVE_MILESTONE_LOCALE);
const t = (key: string, params?: Record<string, string | number>) =>
  translateMilestoneText(ACTIVE_MILESTONE_LOCALE, key, params);
const categoryLabel = (category: MilestoneCategory) =>
  getMilestoneCategoryLabel(ACTIVE_MILESTONE_LOCALE, category);

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
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const [sharePhotoAreaSize, setSharePhotoAreaSize] = useState({ width: 0, height: 0 });
  const [shareImageReady, setShareImageReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [exportingPhotobook, setExportingPhotobook] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MilestoneCategory>('motorik');
  const [eventDate, setEventDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [initialImageUri, setInitialImageUri] = useState<string | null>(null);

  const modalTitle = editingEntry ? t('form.editTitle') : t('form.createTitle');
  const showReadOnlyPreviewAlert = useCallback(() => {
    Alert.alert(t('preview.alertTitle'), t('preview.alertBody'));
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
      Alert.alert(t('common.error'), t('alert.loadFailed'));
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
      Alert.alert(t('common.notice'), t('alert.selectBaby'));
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert(t('common.notice'), t('alert.enterTitle'));
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
        Alert.alert(t('common.error'), t('alert.saveFailed'));
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
        Alert.alert(t('common.error'), t('alert.createFailed'));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    await loadEntries();
  };

  const pickImageFromLibrary = async (allowsEditing: boolean) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('alert.photoPermissionTitle'), t('alert.photoPermissionBody'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing,
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handlePickImage = () => {
    if (!ensureWritableInCurrentMode()) return;

    Alert.alert(
      imageUri ? t('alert.changePhotoTitle') : t('alert.selectPhotoTitle'),
      t('alert.photoChoiceBody'),
      [
        {
          text: t('alert.useOriginal'),
          onPress: () => void pickImageFromLibrary(false),
        },
        {
          text: t('alert.cropSquare'),
          onPress: () => void pickImageFromLibrary(true),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const handleDelete = (entry: BabyMilestoneEntry) => {
    if (!ensureWritableInCurrentMode()) return;
    Alert.alert(
      t('alert.deleteTitle'),
      t('alert.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!ensureWritableInCurrentMode()) return;
            const { error } = await deleteMilestoneEntry(entry.id);
            if (error) {
              Alert.alert(t('common.error'), t('alert.deleteFailed'));
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
    setSharePhotoAreaSize({ width: 0, height: 0 });
    setShareImageReady(!entry.image_url);
    setShareEntry(entry);
  };

  const rememberImageAspectRatio = useCallback((entryId: string, width?: number, height?: number) => {
    if (!width || !height || width <= 0 || height <= 0) return;

    const aspectRatio = width / height;
    setImageAspectRatios((currentRatios) => {
      if (Math.abs((currentRatios[entryId] ?? 0) - aspectRatio) < 0.001) return currentRatios;
      return { ...currentRatios, [entryId]: aspectRatio };
    });
  }, []);

  const closeShareCard = () => {
    if (sharing) return;
    setShareEntry(null);
    setSharePhotoAreaSize({ width: 0, height: 0 });
    setShareImageReady(false);
  };

  const handleShareMilestone = async () => {
    if (!shareEntry || !shareImageReady || sharing) return;

    setSharing(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert(t('share.unavailableTitle'), t('share.imageUnavailableBody'));
        return;
      }

      const uri = await shareCardRef.current?.capture?.();
      if (!uri) throw new Error(t('share.captureFailed'));

      await Sharing.shareAsync(uri, {
        dialogTitle: t('share.dialogTitle'),
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
      setShareEntry(null);
      setShareImageReady(false);
    } catch (error) {
      console.error('Failed to share milestone:', error);
      Alert.alert(t('share.failedTitle'), t('share.failedBody'));
    } finally {
      setSharing(false);
    }
  };

  const handleExportPhotobook = async () => {
    if (!activeBabyId || exportingPhotobook) return;

    setExportingPhotobook(true);
    try {
      const { data, error } = await getMilestoneEntries(activeBabyId);
      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert(t('photobook.emptyTitle'), t('photobook.emptyBody'));
        return;
      }

      const result = await generateMilestonePhotobookPdf({
        entries: data,
        babyName: activeBaby?.name,
        birthDate: activeBaby?.birth_date,
        locale: ACTIVE_MILESTONE_LOCALE,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('share.unavailableTitle'), t('photobook.pdfUnavailableBody'));
        return;
      }

      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        dialogTitle: t('photobook.shareDialogTitle'),
        UTI: 'com.adobe.pdf',
      });

      if (result.warnings.length > 0) {
        Alert.alert(
          t('photobook.createdTitle'),
          t(`photobook.warning.${result.warnings.length === 1 ? 'one' : 'other'}`, {
            pages: result.pageCount,
            warnings: result.warnings.length,
          })
        );
      }
    } catch (error) {
      console.error('Failed to export milestone photobook:', error);
      Alert.alert(t('photobook.failedTitle'), t('photobook.failedBody'));
    } finally {
      setExportingPhotobook(false);
    }
  };

  const headerSubtitle = isReadOnlyPreviewMode
    ? t('screen.previewSubtitle')
    : t('screen.subtitle');
  const shareImageAspectRatio = shareEntry
    ? (imageAspectRatios[shareEntry.id] ?? 4 / 3)
    : 4 / 3;
  const sharePhotoFrameSize = (() => {
    if (sharePhotoAreaSize.width <= 0 || sharePhotoAreaSize.height <= 0) return null;

    const frameInset = 18;
    const maxImageWidth = Math.max(1, sharePhotoAreaSize.width - frameInset);
    const maxImageHeight = Math.max(1, sharePhotoAreaSize.height - frameInset);
    let imageWidth = maxImageWidth;
    let imageHeight = imageWidth / shareImageAspectRatio;

    if (imageHeight > maxImageHeight) {
      imageHeight = maxImageHeight;
      imageWidth = imageHeight * shareImageAspectRatio;
    }

    return {
      width: imageWidth + frameInset,
      height: imageHeight + frameInset,
    };
  })();

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title={t('screen.title')}
          subtitle={headerSubtitle}
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />

        {isReadOnlyPreviewMode && (
          <View style={styles.readOnlyPreviewBanner}>
            <ThemedText style={styles.readOnlyPreviewTitle}>{t('preview.title')}</ThemedText>
            <ThemedText style={styles.readOnlyPreviewText}>
              {t('preview.body')}
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
                  {value === 'all' ? t('category.all') : categoryLabel(value)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.pdfExportButton,
              { backgroundColor: chipBg, borderColor: cardBorder },
              exportingPhotobook && styles.actionDisabled,
            ]}
            onPress={handleExportPhotobook}
            disabled={exportingPhotobook || !activeBabyId}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t('photobook.exportAccessibility')}
          >
            <View style={[styles.pdfExportIcon, { backgroundColor: selectedChipBg }]}>
              {exportingPhotobook ? (
                <ActivityIndicator size="small" color={textPrimary} />
              ) : (
                <IconSymbol name="arrow.down.doc" size={19} color={textPrimary} />
              )}
            </View>
            <View style={styles.pdfExportCopy}>
              <ThemedText style={[styles.pdfExportTitle, { color: textPrimary }]}>
                {exportingPhotobook ? t('photobook.exporting') : t('photobook.exportTitle')}
              </ThemedText>
              <ThemedText style={[styles.pdfExportSubtitle, { color: textSecondary }]}>
                {t('photobook.exportSubtitle')}
              </ThemedText>
            </View>
            {!exportingPhotobook ? (
              <IconSymbol name="chevron.right" size={18} color={textSecondary} />
            ) : null}
          </TouchableOpacity>

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
                  {loading ? t('list.loading') : t('list.emptyTitle')}
                </ThemedText>
                {!loading ? (
                  <ThemedText style={[styles.emptyText, { color: textSecondary }]}>
                    {t('list.emptyBody')}
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
                    <ThemedText style={[styles.cardEyebrow, { color: textSecondary }]}>
                      {t('card.eyebrow')}
                    </ThemedText>
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
                    accessibilityLabel={t('card.fullscreenAccessibility', { title: item.title })}
                  >
                    <Image
                      source={{ uri: item.image_url }}
                      style={[styles.cardImage, { aspectRatio: imageAspectRatios[item.id] ?? 4 / 3 }]}
                      resizeMode="cover"
                      onLoad={({ nativeEvent }) =>
                        rememberImageAspectRatio(item.id, nativeEvent.source.width, nativeEvent.source.height)
                      }
                    />
                    <View style={styles.photoZoomHint} pointerEvents="none">
                      <IconSymbol name="magnifyingglass" size={14} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.photoPlaceholder, { backgroundColor: selectedChipBg, borderColor: cardBorder }]}>
                    <IconSymbol name="sparkles" size={26} color={textSecondary} />
                    <ThemedText style={[styles.photoPlaceholderText, { color: textSecondary }]}>
                      {t('card.placeholder')}
                    </ThemedText>
                  </View>
                )}

                <View style={styles.captionBlock}>
                  <ThemedText style={[styles.cardDate, { color: textPrimary }]}>
                    {formatMilestoneDate(item.event_date, ACTIVE_MILESTONE_LOCALE)}
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
                      {categoryLabel(item.category)}
                    </ThemedText>
                  </View>
                  <View style={styles.cardFooterActions}>
                    <ThemedText style={[styles.pageNumber, { color: textSecondary }]}>
                      {t('card.page', { number: String(index + 1).padStart(2, '0') })}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.cardShareButton, { backgroundColor: selectedChipBg }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        openShareCard(item);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={t('card.shareAccessibility', { title: item.title })}
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
            accessibilityLabel={t('card.closeFullscreen')}
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
            accessibilityLabel={t('card.closeFullscreen')}
          >
            <IconSymbol name="xmark" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {previewEntry ? (
            <View
              style={[styles.imageViewerCaption, { paddingBottom: Math.max(insets.bottom, 18) }]}
              pointerEvents="none"
            >
              <ThemedText style={styles.imageViewerTitle}>{previewEntry.title}</ThemedText>
              <ThemedText style={styles.imageViewerDate}>
                {formatMilestoneDate(previewEntry.event_date, ACTIVE_MILESTONE_LOCALE)}
              </ThemedText>
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
                <ThemedText adaptive={false} style={styles.shareModalTitle}>
                  {t('share.modalTitle')}
                </ThemedText>
                <ThemedText adaptive={false} style={styles.shareModalSubtitle}>
                  {t('share.modalSubtitle')}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={styles.shareModalCloseButton}
                onPress={closeShareCard}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel={t('share.close')}
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
                    ? t('share.eyebrowWithName', { name: activeBaby.name.toUpperCase() })
                    : t('share.eyebrowDefault')}
                </ThemedText>
                <ThemedText adaptive={false} style={styles.shareCardTitle} numberOfLines={2}>
                  {shareEntry?.title}
                </ThemedText>

                <View
                  style={styles.shareCardPhotoArea}
                  onLayout={({ nativeEvent }) => {
                    const { width, height } = nativeEvent.layout;
                    setSharePhotoAreaSize((currentSize) =>
                      Math.abs(currentSize.width - width) < 0.5 &&
                      Math.abs(currentSize.height - height) < 0.5
                        ? currentSize
                        : { width, height }
                    );
                  }}
                >
                  {shareEntry?.image_url ? (
                    <View
                      style={[
                        styles.shareCardPhotoMat,
                        sharePhotoFrameSize ?? { width: '100%', aspectRatio: shareImageAspectRatio },
                      ]}
                    >
                      <Image
                        source={{ uri: shareEntry.image_url }}
                        style={styles.shareCardImage}
                        resizeMode="contain"
                        onLoad={({ nativeEvent }) =>
                          rememberImageAspectRatio(
                            shareEntry.id,
                            nativeEvent.source.width,
                            nativeEvent.source.height
                          )
                        }
                        onLoadEnd={() => setShareImageReady(true)}
                      />
                    </View>
                  ) : (
                    <View style={[styles.shareCardPhotoMat, styles.shareCardEmptyPhotoMat]}>
                      <View style={styles.shareCardPlaceholder}>
                        <IconSymbol name="sparkles" size={32} color="#9A7665" />
                        <ThemedText adaptive={false} style={styles.shareCardPlaceholderText}>
                          {t('card.specialMoment')}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.shareCardDetails}>
                  <ThemedText adaptive={false} style={styles.shareCardDate}>
                    {shareEntry
                      ? formatMilestoneDate(shareEntry.event_date, ACTIVE_MILESTONE_LOCALE)
                      : ''}
                  </ThemedText>
                  {shareEntry &&
                  formatBabyAgeAtMilestone(
                    activeBaby?.birth_date,
                    shareEntry.event_date,
                    ACTIVE_MILESTONE_LOCALE,
                  ) ? (
                    <ThemedText adaptive={false} style={styles.shareCardAge}>
                      {formatBabyAgeAtMilestone(
                        activeBaby?.birth_date,
                        shareEntry.event_date,
                        ACTIVE_MILESTONE_LOCALE,
                      )}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.shareCardFooter}>
                  <View style={styles.shareCardCategory}>
                    <ThemedText adaptive={false} style={styles.shareCardCategoryText}>
                      {shareEntry ? categoryLabel(shareEntry.category) : ''}
                    </ThemedText>
                  </View>
                  <ThemedText adaptive={false} style={styles.shareCardBrand}>
                    {t('card.brand')}
                  </ThemedText>
                </View>
              </ViewShot>
            </View>

            <TouchableOpacity
              style={[styles.shareActionButton, (!shareImageReady || sharing) && styles.shareActionButtonDisabled]}
              onPress={handleShareMilestone}
              disabled={!shareImageReady || sharing}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('share.accessibility')}
            >
              <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
              <ThemedText adaptive={false} style={styles.shareActionButtonText}>
                {sharing
                  ? t('share.creating')
                  : shareImageReady
                    ? t('share.button')
                    : t('share.loadingPhoto')}
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
                    accessibilityLabel={t('alert.deleteTitle')}
                  >
                    <IconSymbol name="trash" size={18} color={isDark ? '#FF9A9A' : '#D45B5B'} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>
                {t('form.suggestions')}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
                {MILESTONE_SUGGESTION_KEYS.map((suggestionKey) => {
                  const suggestion = t(suggestionKey);
                  return (
                  <TouchableOpacity
                    key={suggestionKey}
                    style={[styles.suggestionChip, { backgroundColor: chipBg, borderColor: inputBorder }]}
                    onPress={() => setTitle(suggestion)}
                  >
                    <ThemedText style={[styles.suggestionText, { color: textPrimary }]}>{suggestion}</ThemedText>
                  </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>{t('form.title')}</ThemedText>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('form.titlePlaceholder')}
                placeholderTextColor={textSecondary}
                style={[
                  styles.input,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary },
                ]}
              />

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>{t('form.category')}</ThemedText>
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
                      {categoryLabel(value)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>{t('form.date')}</ThemedText>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.85}
              >
                <ThemedText style={[styles.dateButtonText, { color: dateButtonTextColor }]}>
                  {eventDate.toLocaleDateString(MILESTONE_DATE_LOCALE)}
                </ThemedText>
                <IconSymbol name="calendar" size={18} color={textSecondary} />
              </TouchableOpacity>

              {showDatePicker && Platform.OS !== 'ios' ? (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display="default"
                  locale={MILESTONE_DATE_LOCALE}
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
                  title={t('form.chooseDate')}
                  locale={MILESTONE_DATE_LOCALE}
                  confirmLabel={t('common.done')}
                  cancelLabel={t('common.cancel')}
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

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>{t('form.notes')}</ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('form.notesPlaceholder')}
                placeholderTextColor={textSecondary}
                multiline
                style={[
                  styles.input,
                  styles.notesInput,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary },
                ]}
              />

              <ThemedText style={[styles.fieldLabel, { color: textSecondary }]}>{t('form.photo')}</ThemedText>
              <TouchableOpacity
                style={[styles.imagePickerButton, { backgroundColor: chipBg, borderColor: inputBorder }]}
                onPress={handlePickImage}
                activeOpacity={0.85}
              >
                <IconSymbol name="photo" size={18} color={textPrimary} />
                <ThemedText style={[styles.imagePickerButtonText, { color: textPrimary }]}>
                  {imageUri ? t('form.changeImage') : t('form.selectImage')}
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
                    <ThemedText style={[styles.removeImageText, { color: textPrimary }]}>
                      {t('form.removeImage')}
                    </ThemedText>
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
                <ThemedText style={[styles.actionButtonText, { color: textPrimary }]}>
                  {t('common.cancel')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.primaryActionButton, { borderColor: inputBorder }]}
                onPress={handleSave}
                disabled={saving || isReadOnlyPreviewMode}
              >
                <ThemedText style={[styles.actionButtonText, styles.primaryActionText]}>
                  {saving ? t('common.saving') : t('common.save')}
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
  pdfExportButton: {
    minHeight: 58,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  pdfExportIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfExportCopy: {
    flex: 1,
    gap: 1,
  },
  pdfExportTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  pdfExportSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
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
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    paddingTop: 5,
    paddingBottom: 10,
  },
  shareCardPhotoArea: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCardPhotoMat: {
    overflow: 'hidden',
    padding: 9,
    borderRadius: 4,
    borderCurve: 'continuous',
    backgroundColor: '#FFFDFC',
    boxShadow: '0 4px 12px rgba(70,45,34,0.13)',
  },
  shareCardEmptyPhotoMat: {
    width: '100%',
    height: '100%',
  },
  shareCardImage: {
    width: '100%',
    height: '100%',
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
