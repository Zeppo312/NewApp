import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, SafeAreaView, StatusBar, FlatList, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import { BackButton } from '@/components/BackButton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Fallback-Daten für Babynamen, falls die Datenbank nicht verfügbar ist
const FALLBACK_NAMES = {
  male: [
    { name: 'Noah', meaning: 'Ruhe, Trost', origin: 'Hebräisch' },
    { name: 'Leon', meaning: 'Löwe', origin: 'Lateinisch' },
    { name: 'Paul', meaning: 'Der Kleine, der Bescheidene', origin: 'Lateinisch' },
    { name: 'Ben', meaning: 'Sohn', origin: 'Hebräisch' },
    { name: 'Finn', meaning: 'Der Blonde, der Helle', origin: 'Irisch' },
  ],
  female: [
    { name: 'Emma', meaning: 'Die Große, die Starke', origin: 'Germanisch' },
    { name: 'Mia', meaning: 'Mein', origin: 'Italienisch' },
    { name: 'Hannah', meaning: 'Die Anmutige', origin: 'Hebräisch' },
    { name: 'Emilia', meaning: 'Die Eifrige, die Fleißige', origin: 'Lateinisch' },
    { name: 'Lina', meaning: 'Die Zarte, die Milde', origin: 'Arabisch' },
  ],
  unisex: [
    { name: 'Alex', meaning: 'Der Beschützer', origin: 'Griechisch' },
    { name: 'Charlie', meaning: 'Die Freie', origin: 'Germanisch' },
    { name: 'Robin', meaning: 'Der Glänzende', origin: 'Germanisch' },
    { name: 'Kim', meaning: 'Der Kühne', origin: 'Englisch' },
    { name: 'Noel', meaning: 'Weihnachten', origin: 'Französisch' },
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
  name: string;
  meaning: string;
  origin: string;
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
  }, [user]);

  useEffect(() => {
    loadNames();
  }, [selectedCategory, favorites, allNames]);

  useEffect(() => {
    if (searchQuery !== '') {
      loadNames();
    }
  }, [searchQuery]);

  // Lade alle Babynamen aus der Datenbank
  const loadBabyNames = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('baby_names')
        .select('name, meaning, origin, gender');

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

  const renderNameItem = ({ item }: { item: Name }) => (
    <TouchableOpacity
      style={styles.nameItem}
      onPress={() => {}}
    >
      <ThemedView
        style={styles.nameItemInner}
        lightColor="rgba(255, 255, 255, 0.8)"
        darkColor="rgba(50, 50, 50, 0.8)"
      >
        <View style={styles.nameHeader}>
          <ThemedText style={styles.nameTitle}>{item.name}</ThemedText>
          <TouchableOpacity
            style={styles.favoriteButton}
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
        <ThemedText style={styles.nameOrigin}>{item.origin}</ThemedText>
        <ThemedText style={styles.nameMeaning}>{item.meaning}</ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );

  return (
    <ThemedBackground
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* Zurück-Button */}
          <BackButton onPress={() => router.back()} />

          {/* Header */}
          <ThemedText style={[styles.title, { fontSize: 26 }]}>Babynamen</ThemedText>
          <ThemedText style={styles.subtitle}>Finde den perfekten Namen für dein Baby</ThemedText>

          {/* Suchleiste */}
          <View style={styles.searchContainer}>
            <ThemedView
              style={styles.searchInputContainer}
              lightColor="rgba(255, 255, 255, 0.8)"
              darkColor="rgba(50, 50, 50, 0.8)"
            >
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
            </ThemedView>
          </View>

          {/* Kategorien */}
          <View style={styles.categoriesContainer}>
            <FlatList
              data={CATEGORIES}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          </View>

          {/* Namen-Liste */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>Lade Namen...</ThemedText>
            </View>
          ) : names.length === 0 ? (
            <ThemedView style={styles.emptyContainer} lightColor="rgba(255, 255, 255, 0.8)" darkColor="rgba(50, 50, 50, 0.8)">
              <IconSymbol name="magnifyingglass" size={40} color={theme.tabIconDefault} />
              <ThemedText style={styles.emptyText}>
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
            </ThemedView>
          ) : (
            <View style={styles.namesContainer}>
              {names.map((item, index) => (
                <View key={index} style={{ width: '100%' }}>
                  {renderNameItem({ item })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

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
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
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
  categoriesContainer: {
    marginBottom: 16,
  },
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
  namesContainer: {
    marginBottom: 16,
  },
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
});
