import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, SafeAreaView, StatusBar, FlatList, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter, Stack } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD, TIMELINE_INSET, TEXT_PRIMARY } from '@/constants/DesignGuide';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isUserAdmin } from '@/lib/supabase/recommendations';

// Fallback-Daten für Babynamen, falls die Datenbank nicht verfügbar ist
const FALLBACK_NAMES = {
  male: [
    { name: 'Noah', meaning: 'Ruhe, Trost', origin: 'Hebräisch', gender: 'male' as const },
    { name: 'Leon', meaning: 'Löwe', origin: 'Lateinisch', gender: 'male' as const },
    { name: 'Paul', meaning: 'Der Kleine, der Bescheidene', origin: 'Lateinisch', gender: 'male' as const },
    { name: 'Ben', meaning: 'Sohn', origin: 'Hebräisch', gender: 'male' as const },
    { name: 'Finn', meaning: 'Der Blonde, der Helle', origin: 'Irisch', gender: 'male' as const },
  ],
  female: [
    { name: 'Emma', meaning: 'Die Große, die Starke', origin: 'Germanisch', gender: 'female' as const },
    { name: 'Mia', meaning: 'Mein', origin: 'Italienisch', gender: 'female' as const },
    { name: 'Hannah', meaning: 'Die Anmutige', origin: 'Hebräisch', gender: 'female' as const },
    { name: 'Emilia', meaning: 'Die Eifrige, die Fleißige', origin: 'Lateinisch', gender: 'female' as const },
    { name: 'Lina', meaning: 'Die Zarte, die Milde', origin: 'Arabisch', gender: 'female' as const },
  ],
  unisex: [
    { name: 'Alex', meaning: 'Der Beschützer', origin: 'Griechisch', gender: 'unisex' as const },
    { name: 'Charlie', meaning: 'Die Freie', origin: 'Germanisch', gender: 'unisex' as const },
    { name: 'Robin', meaning: 'Der Glänzende', origin: 'Germanisch', gender: 'unisex' as const },
    { name: 'Kim', meaning: 'Der Kühne', origin: 'Englisch', gender: 'unisex' as const },
    { name: 'Noel', meaning: 'Weihnachten', origin: 'Französisch', gender: 'unisex' as const },
  ]
};

// Kategorien für die Filterung
const CATEGORIES = [
  { id: 'all', name: 'Alle Namen', icon: 'list.bullet' },
  { id: 'male', name: 'Jungennamen', icon: 'figure.boy' },
  { id: 'female', name: 'Mädchennamen', icon: 'figure.girl' },
  { id: 'unisex', name: 'Unisex Namen', icon: 'person.2' },
  { id: 'favorites', name: 'Favoriten', icon: 'heart.fill' },
];

interface Name {
  id?: string;
  name: string;
  meaning?: string | null;
  origin?: string | null;
  gender?: 'male' | 'female' | 'unisex' | null;
  isFavorite?: boolean;
}

export default function BabyNamesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [names, setNames] = useState<Name[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingName, setIsCreatingName] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [persistedMeaning, setPersistedMeaning] = useState('');
  const [persistedOrigin, setPersistedOrigin] = useState('');
  const [persistedGender, setPersistedGender] = useState<'male' | 'female' | 'unisex'>('unisex');
  const [allNames, setAllNames] = useState<{
    male: Name[];
    female: Name[];
    unisex: Name[];
  }>({
    male: [],
    female: [],
    unisex: []
  });

  useEffect(() => {
    loadBabyNames();
    if (user) {
      loadFavorites();
    }
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    loadNames();
  }, [selectedCategory, favorites, allNames]);

  useEffect(() => {
    if (searchQuery !== '') {
      loadNames();
    }
  }, [searchQuery]);

  const checkAdminStatus = async () => {
    const adminStatus = await isUserAdmin();
    setIsAdmin(adminStatus);
  };

  // Lade alle Babynamen aus der Datenbank
  const loadBabyNames = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('baby_names')
        .select('id, name, meaning, origin, gender');

      if (error) {
        console.error('Error loading baby names:', error);
        // Fallback zu lokalen Daten
        setAllNames({
          male: FALLBACK_NAMES.male,
          female: FALLBACK_NAMES.female,
          unisex: FALLBACK_NAMES.unisex
        });
      } else if (data && data.length > 0) {
        // Gruppiere Namen nach Geschlecht
        const male = data.filter(name => name.gender === 'male');
        const female = data.filter(name => name.gender === 'female');
        const unisex = data.filter(name => name.gender === 'unisex');

        setAllNames({
          male,
          female,
          unisex
        });
      } else {
        // Keine Daten gefunden, verwende Fallback
        setAllNames({
          male: FALLBACK_NAMES.male,
          female: FALLBACK_NAMES.female,
          unisex: FALLBACK_NAMES.unisex
        });
      }
    } catch (err) {
      console.error('Failed to load baby names:', err);
      // Fallback zu lokalen Daten
      setAllNames({
        male: FALLBACK_NAMES.male,
        female: FALLBACK_NAMES.female,
        unisex: FALLBACK_NAMES.unisex
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Lade Favoriten aus Supabase
  const loadFavorites = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('baby_names_favorites')
        .select('name')
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error loading favorites:', error);
        Alert.alert('Fehler', 'Favoriten konnten nicht geladen werden.');
      } else if (data) {
        const favoriteNames = data.map(item => item.name);
        setFavorites(favoriteNames);
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNames = () => {
    setIsLoading(true);

    // Kurze Verzögerung für bessere UX
    setTimeout(() => {
      let filteredNames: Name[] = [];

      if (selectedCategory === 'all') {
        filteredNames = [
          ...allNames.male,
          ...allNames.female,
          ...allNames.unisex
        ];
      } else if (selectedCategory === 'favorites') {
        const allNamesFlat = [
          ...allNames.male,
          ...allNames.female,
          ...allNames.unisex
        ];
        filteredNames = allNamesFlat.filter(name => favorites.includes(name.name));
      } else {
        filteredNames = allNames[selectedCategory as keyof typeof allNames] || [];
      }

      // Markiere Favoriten
      filteredNames = filteredNames.map(name => ({
        ...name,
        isFavorite: favorites.includes(name.name)
      }));

      // Filtere nach Suchbegriff, wenn vorhanden
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredNames = filteredNames.filter(
          name =>
            name.name.toLowerCase().includes(query) ||
            name.meaning.toLowerCase().includes(query) ||
            name.origin.toLowerCase().includes(query)
        );
      }

      setNames(filteredNames);
      setIsLoading(false);
    }, 300);
  };

  // Füge einen Namen zu Favoriten hinzu oder entferne ihn
  const toggleFavorite = async (name: string) => {
    if (!user) {
      Alert.alert('Hinweis', 'Du musst angemeldet sein, um Favoriten zu speichern.');
      return;
    }

    setIsSaving(true);

    try {
      if (favorites.includes(name)) {
        // Entferne aus Favoriten
        const { error } = await supabase
          .from('baby_names_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('name', name);

        if (error) {
          console.error('Error removing favorite:', error);
          Alert.alert('Fehler', 'Favorit konnte nicht entfernt werden.');
        } else {
          // Lokale Favoriten aktualisieren
          setFavorites(favorites.filter(n => n !== name));
        }
      } else {
        // Füge zu Favoriten hinzu
        const { error } = await supabase
          .from('baby_names_favorites')
          .insert({
            user_id: user.id,
            name: name
          });

        if (error) {
          console.error('Error adding favorite:', error);
          Alert.alert('Fehler', 'Favorit konnte nicht hinzugefügt werden.');
        } else {
          // Lokale Favoriten aktualisieren
          setFavorites([...favorites, name]);
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    setNewName('');
    setPersistedMeaning('');
    setPersistedOrigin('');
    setPersistedGender('unisex');
    setEditingNameId(null);
    setShowCreateModal(true);
  };

  const handleEditName = (item: Name) => {
    setEditingNameId(item.id ?? null);
    setNewName(item.name);
    setPersistedMeaning(item.meaning || '');
    setPersistedOrigin(item.origin || '');
    setPersistedGender(item.gender || 'unisex');
    setShowCreateModal(true);
  };

  const handleDeleteName = (item: Name) => {
    if (!item.id) return;
    Alert.alert(
      'Name löschen',
      `Möchtest du "${item.name}" wirklich entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsCreatingName(true);
              const { error } = await supabase.from('baby_names').delete().eq('id', item.id);
              if (error) throw error;
              await loadBabyNames();
              setShowCreateModal(false);
              Alert.alert('Erfolg', 'Der Name wurde gelöscht.');
            } catch (err) {
              console.error('Error deleting baby name:', err);
              Alert.alert('Fehler', 'Der Name konnte nicht gelöscht werden.');
            } finally {
              setIsCreatingName(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateName = async () => {
    if (!isAdmin) {
      Alert.alert('Hinweis', 'Nur Admins können Babynamen hinzufügen.');
      return;
    }

    const nameValue = newName.trim();
    if (!nameValue) {
      Alert.alert('Fehler', 'Bitte gib einen Namen ein.');
      return;
    }

    const existingNames = [
      ...allNames.male,
      ...allNames.female,
      ...allNames.unisex,
    ];
    const duplicate = existingNames.some(
      n => n.name.trim().toLowerCase() === nameValue.toLowerCase() && (!editingNameId || n.id !== editingNameId)
    );
    if (duplicate) {
      Alert.alert('Hinweis', 'Dieser Name existiert bereits.');
      return;
    }

    try {
      setIsCreatingName(true);
      const payload = {
        name: nameValue,
        meaning: (persistedMeaning || '').trim() || null,
        origin: (persistedOrigin || '').trim() || null,
        gender: persistedGender || 'unisex',
      };

      if (editingNameId) {
        const { error } = await supabase.from('baby_names').update(payload).eq('id', editingNameId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('baby_names').insert(payload);
        if (error) throw error;
      }

      await loadBabyNames();
      setShowCreateModal(false);
      setSelectedCategory('all');
      setSearchQuery('');
      setEditingNameId(null);
      Alert.alert('Erfolg', editingNameId ? 'Der Name wurde aktualisiert.' : 'Der Name wurde hinzugefügt.');
    } catch (err) {
      console.error('Failed to create baby name:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsCreatingName(false);
    }
  };

  const renderCategoryItem = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item.id && { backgroundColor: theme.accent + '30' }
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <ThemedView
        style={styles.categoryItemInner}
        lightColor="rgba(255, 255, 255, 0.8)"
        darkColor="rgba(50, 50, 50, 0.8)"
      >
        <IconSymbol name={item.icon as any} size={20} color={theme.accent} />
        <ThemedText style={styles.categoryText}>{item.name}</ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );

  const genderOverlay = (gender?: string) => {
    if (gender === 'male') return 'rgba(135,206,235,0.32)'; // Baby blue
    if (gender === 'female') return 'rgba(142,78,198,0.32)'; // Lila
    return 'rgba(168,196,193,0.32)'; // Neutral grünlich
  };

  const renderNameItem = ({ item }: { item: Name }) => {
    const originText = item.origin || 'Herkunft unbekannt';
    const meaningText = item.meaning || 'Keine Bedeutung hinterlegt.';
    return (
      <LiquidGlassCard
        style={[styles.fullWidthCard, styles.glassCard]}
        intensity={26}
        overlayColor={genderOverlay(item.gender)}
        borderColor={'rgba(255,255,255,0.7)'}
      >
        <View style={styles.nameItemInner}>
          <View style={styles.nameHeader}>
            <ThemedText style={styles.nameTitle}>{item.name}</ThemedText>
            <View style={styles.nameActions}>
              {isAdmin && item.id && (
                <>
                  <TouchableOpacity style={styles.iconButton} onPress={() => handleEditName(item)}>
                    <IconSymbol name="pencil" size={18} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconButton, { marginLeft: 6 }]} onPress={() => handleDeleteName(item)}>
                    <IconSymbol name="trash" size={18} color="#C94A4A" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.favoriteButton, { marginLeft: 8 }]}
                onPress={() => toggleFavorite(item.name)}
                disabled={isSaving}
              >
                {isSaving && favorites.includes(item.name) === item.isFavorite ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <IconSymbol
                    name={item.isFavorite ? 'heart.fill' : 'heart'}
                    size={20}
                    color={item.isFavorite ? theme.accent : theme.tabIconDefault}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <ThemedText style={[styles.nameOrigin, { color: TEXT_PRIMARY }]}>{originText}</ThemedText>
          <ThemedText style={[styles.nameMeaning, { color: TEXT_PRIMARY }]}>{meaningText}</ThemedText>
        </View>
      </LiquidGlassCard>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage}>
        <SafeAreaView style={styles.container}>
          <StatusBar hidden={true} />
          <Header 
            title="Babynamen" 
            subtitle="Finde den perfekten Namen für dein Baby"
            showBackButton 
          />
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>

          {/* Suchleiste */}
          <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
            <View style={styles.searchInputContainer}>
              <IconSymbol name="magnifyingglass" size={20} color={theme.tabIconDefault} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Suche nach Namen..."
                placeholderTextColor={theme.tabIconDefault}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <IconSymbol name="xmark.circle.fill" size={20} color={theme.tabIconDefault} />
                </TouchableOpacity>
              )}
            </View>
          </LiquidGlassCard>

          {/* Kategorien */}
          <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
            <View style={styles.categoriesContainer}>
              <FlatList
                data={CATEGORIES}
                renderItem={renderCategoryItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>
          </LiquidGlassCard>

          {/* Namen-Liste */}
          {isLoading ? (
            <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <ThemedText style={[styles.loadingText, { color: TEXT_PRIMARY }]}>Lade Namen...</ThemedText>
              </View>
            </LiquidGlassCard>
          ) : names.length === 0 ? (
            <LiquidGlassCard style={[styles.fullWidthCard, styles.glassCard]} intensity={26} overlayColor={GLASS_OVERLAY}>
              <View style={styles.emptyContainer}>
                <IconSymbol name="magnifyingglass" size={40} color={theme.tabIconDefault} />
                <ThemedText style={[styles.emptyText, { color: TEXT_PRIMARY }]}>
                  {selectedCategory === 'favorites'
                    ? 'Du hast noch keine Favoriten gespeichert.'
                    : 'Keine Namen gefunden.'}
                </ThemedText>
                {selectedCategory === 'favorites' && (
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => setSelectedCategory('all')}
                  >
                    <ThemedText style={styles.emptyButtonText}>Alle Namen anzeigen</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </LiquidGlassCard>
          ) : (
            <View style={styles.namesContainer}>
              {names.map((item, index) => (
                <View key={item.id ?? index} style={{ width: '100%', marginBottom: 12 }}>
                  {renderNameItem({ item })}
                </View>
              ))}
            </View>
          )}
          </ScrollView>

          {isAdmin && (
            <TouchableOpacity
              style={[styles.adminFab, { backgroundColor: theme.accent }]}
              onPress={handleOpenCreateModal}
              activeOpacity={0.9}
            >
              <IconSymbol name="plus" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <Modal
            visible={showCreateModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCreateModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.dailyModalWrapper}
            >
              <View style={styles.dailyModalOverlay}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    setShowCreateModal(false);
                    Keyboard.dismiss();
                  }}
                >
                  <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>

                <BlurView style={styles.dailyModalContent} tint="extraLight" intensity={82}>
                  <View style={styles.modalHeaderRow}>
                    <View style={styles.headerLeft}>
                      <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.headerCircleButton}>
                        <IconSymbol name="xmark" size={18} color={BABY_LILA} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.headerCenter}>
                      <ThemedText style={[styles.modalTitle, { color: BABY_LILA }]}>
                        {editingNameId ? 'Name bearbeiten' : 'Neuen Namen hinzufügen'}
                      </ThemedText>
                    </View>
                    <View style={styles.headerRight}>
                      <TouchableOpacity
                        style={[styles.headerCircleButton, { backgroundColor: BABY_LILA }]}
                        onPress={handleCreateName}
                        disabled={isCreatingName}
                      >
                        {isCreatingName ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <IconSymbol name="checkmark" size={18} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 12 }}
                  >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                      <View>
                        <View style={styles.modalField}>
                          <ThemedText style={[styles.modalLabel, { color: BABY_LILA }]}>Name</ThemedText>
                          <TextInput
                            style={[styles.modalInput, { color: theme.text }]}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="z.B. Mila"
                            placeholderTextColor={theme.tabIconDefault}
                            autoFocus
                          />
                        </View>

                        <View style={styles.modalField}>
                          <ThemedText style={[styles.modalLabel, { color: BABY_LILA }]}>Bedeutung</ThemedText>
                          <TextInput
                            style={[styles.modalInput, { color: theme.text }]}
                            value={persistedMeaning}
                            onChangeText={setPersistedMeaning}
                            placeholder="z.B. Wunder, Hoffnung"
                            placeholderTextColor={theme.tabIconDefault}
                          />
                        </View>

                        <View style={styles.modalField}>
                          <ThemedText style={[styles.modalLabel, { color: BABY_LILA }]}>Herkunft</ThemedText>
                          <TextInput
                            style={[styles.modalInput, { color: theme.text }]}
                            value={persistedOrigin}
                            onChangeText={setPersistedOrigin}
                            placeholder="z.B. Hebräisch"
                            placeholderTextColor={theme.tabIconDefault}
                          />
                        </View>
                      </View>
                    </TouchableWithoutFeedback>
                  </ScrollView>
                </BlurView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const BABY_LILA = '#8E4EC6';

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 10,
    paddingBottom: 40,
  },
  fullWidthCard: {
    marginHorizontal: TIMELINE_INSET,
  },
  glassCard: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    padding: 8,
  },
  categoriesContainer: { paddingVertical: 6 },
  categoriesRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  categoryItem: {
    borderRadius: 20,
    marginRight: 8,
    overflow: 'hidden',
  },
  categoryItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 14,
    marginLeft: 8,
  },
  namesContainer: { marginBottom: 16 },
  nameItem: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  nameItemInner: {
    padding: 16,
  },
  nameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  nameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  favoriteButton: {
    padding: 4,
  },
  nameOrigin: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.7,
  },
  nameMeaning: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  emptyButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#E9C9B6',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  adminFab: {
    position: 'absolute',
    right: LAYOUT_PAD + 6,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dailyModalWrapper: {
    flex: 1,
  },
  dailyModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dailyModalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    maxHeight: '78%',
    overflow: 'hidden',
    padding: 20,
    paddingBottom: 28,
    backgroundColor: 'rgba(142,78,198,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.2)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: { flex: 1, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  headerCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    color: BABY_LILA,
    opacity: 0.85,
    marginTop: 2,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
  },
  modalField: {
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(142,78,198,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    fontSize: 16,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  genderPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7D5A50',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
