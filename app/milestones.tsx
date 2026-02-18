import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import Header from '@/components/Header';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
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
  const adaptiveColors = useAdaptiveColors();
  const insets = useSafeAreaInsets();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#6B4C3B';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';
  const selectedChipBg = isDark ? 'rgba(94,61,179,0.45)' : 'rgba(94,61,179,0.16)';
  const cardBg = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.8)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)';
  const inputBg = isDark ? 'rgba(20,20,24,0.9)' : 'rgba(255,255,255,0.95)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
  const dateButtonTextColor = isDark ? '#FFFFFF' : textPrimary;

  const router = useRouter();
  const { activeBabyId, isReady } = useActiveBaby();

  const [entries, setEntries] = useState<BabyMilestoneEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BabyMilestoneEntry | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MilestoneCategory>('motorik');
  const [eventDate, setEventDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [initialImageUri, setInitialImageUri] = useState<string | null>(null);

  const modalTitle = editingEntry ? 'Meilenstein bearbeiten' : 'Neuer Meilenstein';

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
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (entry: BabyMilestoneEntry) => {
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleDelete = (entry: BabyMilestoneEntry) => {
    Alert.alert(
      'Meilenstein löschen',
      'Möchtest du diesen Meilenstein wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteMilestoneEntry(entry.id);
            if (error) {
              Alert.alert('Fehler', 'Der Meilenstein konnte nicht gelöscht werden.');
              return;
            }
            await loadEntries();
          },
        },
      ]
    );
  };

  const sortedCategories = useMemo(() => CATEGORY_ORDER, []);

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Header
          title="Meilensteine"
          subtitle="Erste Male und besondere Momente"
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />

        <View style={styles.content}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: filter === 'all' ? selectedChipBg : chipBg, borderColor: cardBorder },
              ]}
              onPress={() => setFilter('all')}
            >
              <ThemedText style={[styles.filterChipText, { color: textPrimary }]}>Alle</ThemedText>
            </TouchableOpacity>

            {sortedCategories.map((value) => (
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
                  {MILESTONE_CATEGORY_LABELS[value]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: selectedChipBg, borderColor: cardBorder }]}
            onPress={openCreateModal}
            activeOpacity={0.85}
          >
            <IconSymbol name="plus.circle.fill" size={20} color={textPrimary} />
            <ThemedText style={[styles.addButtonText, { color: textPrimary }]}>Meilenstein hinzufügen</ThemedText>
          </TouchableOpacity>

          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            refreshing={refreshing}
            onRefresh={onRefresh}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
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
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
                onPress={() => openEditModal(item)}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>{item.title}</ThemedText>
                  <TouchableOpacity
                    style={styles.deleteIconButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleDelete(item);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <IconSymbol name="trash" size={18} color={isDark ? '#FF9A9A' : '#D45B5B'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.cardMetaRow}>
                  <View style={[styles.badge, { backgroundColor: selectedChipBg }]}>
                    <ThemedText style={[styles.badgeText, { color: textPrimary }]}>
                      {MILESTONE_CATEGORY_LABELS[item.category]}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.cardDate, { color: textSecondary }]}>
                    {fromDateOnly(item.event_date).toLocaleDateString('de-DE')}
                  </ThemedText>
                </View>

                {item.notes ? (
                  <ThemedText style={[styles.cardNotes, { color: textSecondary }]}>{item.notes}</ThemedText>
                ) : null}

                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
                ) : null}
              </TouchableOpacity>
            )}
          />
        </View>
      </SafeAreaView>

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
              <ThemedText style={[styles.modalTitle, { color: textPrimary }]}>{modalTitle}</ThemedText>

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

              {showDatePicker ? (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant={isDark ? 'dark' : 'light'}
                  onChange={(_, pickedDate) => {
                    setShowDatePicker(false);
                    if (pickedDate) setEventDate(pickedDate);
                  }}
                  maximumDate={new Date()}
                />
              ) : null}

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
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
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
                disabled={saving}
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
  filterRow: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  filterScroll: {
    maxHeight: 52,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 13,
    borderWidth: 1,
    marginRight: 8,
    alignSelf: 'center',
  },
  filterChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  addButton: {
    marginTop: 10,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 24,
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
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    paddingRight: 10,
  },
  deleteIconButton: {
    padding: 2,
  },
  cardMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardNotes: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 10,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
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
