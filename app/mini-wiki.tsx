import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, SafeAreaView, StatusBar, FlatList, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter, Stack } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LiquidGlassCard, LAYOUT_PAD } from '@/constants/DesignGuide';
import { getWikiCategories, getWikiArticles, addWikiArticleToFavorites, removeWikiArticleFromFavorites, WikiArticle, WikiCategory } from '@/lib/supabase/wiki';
import Header from '@/components/Header';

// Lokale Erweiterung des WikiArticle-Typs für die UI
interface Article extends WikiArticle {
  category?: string; // Für die Anzeige des Kategorienamens
  readingTime?: string; // Alias für reading_time
}

// Lokale Erweiterung des WikiCategory-Typs für die UI
interface Category extends WikiCategory {
  isAll?: boolean; // Für die "Alle Artikel"-Kategorie
  isFavorites?: boolean; // Für die "Favoriten"-Kategorie
}

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8; // match ActivityCard inset
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const timelineWidth = contentWidth - TIMELINE_INSET * 2; // EXACT Timeline card width

export default function MiniWikiScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // Details laufen über eigene Route: /mini-wiki/[id]
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Laden der Kategorien und Artikel beim ersten Rendern
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Kategorien laden
        const { data: categoriesData, error: categoriesError } = await getWikiCategories();
        if (categoriesError) throw categoriesError;

        // Artikel laden
        const { data: articlesData, error: articlesError } = await getWikiArticles();
        if (articlesError) throw articlesError;

        // Kategorien mit "Alle Artikel" und "Favoriten" erweitern
        const allCategories: Category[] = [
          { id: 'all', name: 'Alle Artikel', icon: 'doc.text.fill', isAll: true },
          ...categoriesData,
          { id: 'favorites', name: 'Favoriten', icon: 'star.fill', isFavorites: true }
        ];

        // Artikel mit Kategorienamen anreichern
        const articlesWithCategories = articlesData.map(article => ({
          ...article,
          category: categoriesData.find(cat => cat.id === article.category_id)?.name || '',
          readingTime: article.reading_time
        }));

        setCategories(allCategories);
        setArticles(articlesWithCategories);
      } catch (err) {
        console.error('Error loading wiki data:', err);
        setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter articles based on search query and selected category
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.teaser.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' ? true :
      selectedCategory === 'favorites' ? article.isFavorite :
      article.category_id === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Toggle favorite status
  const toggleFavorite = async (id: string) => {
    try {
      const article = articles.find(a => a.id === id);
      if (!article) return;

      // Optimistisches UI-Update
      setArticles(articles.map(article =>
        article.id === id
          ? { ...article, isFavorite: !article.isFavorite }
          : article
      ));

      // Wenn der Artikel ein Favorit ist, entfernen wir ihn aus den Favoriten
      if (article.isFavorite) {
        const { error } = await removeWikiArticleFromFavorites(id);
        if (error) throw error;
      } else {
        // Andernfalls fügen wir ihn zu den Favoriten hinzu
        const { error } = await addWikiArticleToFavorites(id);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      Alert.alert('Fehler', 'Der Favoriten-Status konnte nicht geändert werden.');

      // Rückgängig machen des optimistischen Updates
      const { data: articlesData } = await getWikiArticles();
      if (articlesData) {
        setArticles(articlesData.map(article => ({
          ...article,
          category: categories.find(cat => cat.id === article.category_id)?.name || '',
          readingTime: article.reading_time
        })));
      }
    }
  };

  // Render category item
  const renderCategoryItem = ({ item }: { item: Category }) => (
    <LiquidGlassCard
      style={[styles.categoryItemGlass, selectedCategory === item.id && styles.categoryItemActive]}
      onPress={() => setSelectedCategory(item.id)}
      intensity={24}
      activeOpacity={0.9}
    >
      <View style={styles.categoryItemInnerGlass}>
        <IconSymbol name={item.icon as any} size={18} color={theme.accent} />
        <ThemedText style={styles.categoryText}>{item.name}</ThemedText>
      </View>
    </LiquidGlassCard>
  );

  // Render article item
  const renderArticleItem = ({ item }: { item: Article }) => (
    <LiquidGlassCard style={[styles.articleItemGlass, { width: '100%' }]} onPress={() => router.push(`/mini-wiki/${item.id}`)} intensity={24}>
      <View style={styles.articleItemInnerGlass}>
        <View style={styles.articleHeader}>
          <ThemedText style={styles.articleTitle}>{item.title}</ThemedText>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(item.id)}
          >
            <IconSymbol
              name={item.isFavorite ? 'star.fill' : 'star'}
              size={20}
              color={item.isFavorite ? theme.accent : theme.tabIconDefault}
            />
          </TouchableOpacity>
        </View>
        <ThemedText style={styles.articleCategory}>{item.category}</ThemedText>
        <ThemedText style={styles.articleTeaser}>{item.teaser}</ThemedText>
        <View style={styles.articleFooter}>
          <ThemedText style={styles.readingTime}>
            <IconSymbol name="clock" size={14} color={theme.tabIconDefault} /> {item.readingTime}
          </ThemedText>
          <ThemedText style={styles.readMore}>Weiterlesen</ThemedText>
        </View>
      </View>
    </LiquidGlassCard>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground
        style={styles.backgroundImage}
        resizeMode="repeat"
      >
        <SafeAreaView style={styles.container}>
          <StatusBar hidden={true} />
          
          <Header title="Mini-Wiki" showBackButton onBackPress={() => router.push('/more')} />
          

        {isLoading ? (
          // Ladeindikator
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade Artikel...</ThemedText>
          </View>
        ) : error ? (
          // Fehleranzeige
          <View style={styles.errorContainer}>
            <IconSymbol name="exclamationmark.triangle.fill" size={40} color={theme.warning} />
            <ThemedText style={styles.errorText}>Fehler beim Laden der Artikel</ThemedText>
            <ThemedText style={styles.errorSubtext}>{error.message}</ThemedText>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setIsLoading(true);
                getWikiArticles().then(({ data }) => {
                  if (data) {
                    setArticles(data.map(article => ({
                      ...article,
                      category: categories.find(cat => cat.id === article.category_id)?.name || '',
                      readingTime: article.reading_time
                    })));
                    setError(null);
                  }
                }).catch(err => {
                  setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
                }).finally(() => {
                  setIsLoading(false);
                });
              }}
            >
              <ThemedText style={styles.retryButtonText}>Erneut versuchen</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          // Article list view
          <>
            <View style={[styles.searchContainer, { alignSelf: 'center', width: contentWidth }]}>
              <LiquidGlassCard style={styles.searchGlass} intensity={24}>
                <View style={styles.searchRow}>
                  <IconSymbol name="magnifyingglass" size={20} color={theme.tabIconDefault} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Suche nach Artikeln..."
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
            </View>

            <View style={[styles.categoriesContainer, { alignSelf: 'center', width: contentWidth }]}>
              <FlatList
                data={categories}
                renderItem={renderCategoryItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.categoriesList, { paddingHorizontal: TIMELINE_INSET }]}
              />
            </View>

            <View style={{ alignSelf: 'center', width: contentWidth }}>
            <FlatList
              data={filteredArticles}
              renderItem={renderArticleItem}
              keyExtractor={item => item.id}
              contentContainerStyle={[styles.articlesList, { paddingHorizontal: TIMELINE_INSET }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <LiquidGlassCard style={styles.emptyState}>
                  <IconSymbol name="doc.text.magnifyingglass" size={40} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyStateText}>
                    Keine Artikel gefunden
                  </ThemedText>
                  <ThemedText style={styles.emptyStateSubtext}>
                    Versuche es mit einem anderen Suchbegriff oder einer anderen Kategorie
                  </ThemedText>
                </LiquidGlassCard>
              }
            />
            </View>
          </>
        )}
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: LAYOUT_PAD,
  },
  backgroundImage: {
    flex: 1,
  },

  // Ladeindikator und Fehleranzeige
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    marginVertical: 12,
  },
  searchGlass: {
    borderRadius: 22,
    padding: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    paddingVertical: 4,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoriesList: {
    paddingRight: 16,
  },
  categoryItemGlass: {
    borderRadius: 20,
    marginRight: 8,
  },
  categoryItemActive: {
    borderColor: 'rgba(94,61,179,0.65)'
  },
  categoryItemInnerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  categoryText: {
    marginLeft: 6,
    fontSize: 14,
  },
  articlesList: {
    paddingBottom: 100,
  },
  articleItemGlass: {
    borderRadius: 22,
    marginBottom: 12,
    width: '100%',
  },
  articleItemInnerGlass: {
    padding: 16,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  articleCategory: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  articleTeaser: {
    fontSize: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  articleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readingTime: {
    fontSize: 14,
    opacity: 0.7,
  },
  readMore: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 22,
    marginTop: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  articleDetailContainer: {
    flex: 1,
  },
  backToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  backToListText: {
    fontSize: 16,
    marginLeft: 4,
  },
  articleDetailCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
  },
  articleDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  articleDetailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  articleDetailCategory: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 8,
  },
  readingTimeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  readingTimeText: {
    fontSize: 14,
    opacity: 0.7,
    marginLeft: 4,
  },
  coreStatementsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  coreStatementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 8,
  },
  coreStatementText: {
    fontSize: 16,
    flex: 1,
  },
  contentSection: {
    marginBottom: 20,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
  },
});
