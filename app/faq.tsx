import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, ImageBackground, SafeAreaView, StatusBar, FlatList, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import { getFaqCategories, getFaqEntries, FaqCategory, FaqEntry } from '@/lib/supabase/faq';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Lokale Erweiterung des FaqCategory-Typs für die UI
interface Category extends FaqCategory {
  isAll?: boolean; // Für die "Alle Fragen"-Kategorie
}

export default function FaqScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Laden der Kategorien und FAQ-Einträge beim ersten Rendern
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Kategorien laden
        const { data: categoriesData, error: categoriesError } = await getFaqCategories();
        if (categoriesError) throw categoriesError;

        // FAQ-Einträge laden
        const { data: entriesData, error: entriesError } = await getFaqEntries();
        if (entriesError) throw entriesError;

        // Kategorien mit "Alle Fragen" erweitern
        const allCategories: Category[] = [
          { id: 'all', name: 'Alle Fragen', icon: 'doc.text.fill', isAll: true },
          ...categoriesData
        ];

        setCategories(allCategories);
        setFaqEntries(entriesData || []);
      } catch (err) {
        console.error('Error loading FAQ data:', err);
        setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter FAQ entries based on search query and selected category
  const filteredEntries = faqEntries.filter(entry => {
    const matchesSearch = 
      entry.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
      entry.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === 'all' ? true : 
      entry.category_id === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Toggle expanded state for an entry
  const toggleExpanded = (id: string) => {
    setExpandedEntries(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Render category item
  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item.id && { backgroundColor: theme.accent + '30' }
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <IconSymbol name={item.icon as any} size={20} color={theme.accent} />
      <ThemedText style={styles.categoryText}>{item.name}</ThemedText>
    </TouchableOpacity>
  );

  // Render FAQ entry item
  const renderFaqItem = ({ item }: { item: FaqEntry }) => {
    const isExpanded = expandedEntries[item.id] || false;
    
    return (
      <ThemedView 
        style={styles.faqItem} 
        lightColor={theme.card} 
        darkColor={theme.card}
      >
        <TouchableOpacity
          style={styles.faqQuestion}
          onPress={() => toggleExpanded(item.id)}
        >
          <View style={styles.faqQuestionContent}>
            <ThemedText style={styles.faqQuestionText}>{item.question}</ThemedText>
            <ThemedText style={styles.faqCategoryText}>{item.category}</ThemedText>
          </View>
          <IconSymbol 
            name={isExpanded ? 'chevron.up' : 'chevron.down'} 
            size={20} 
            color={theme.tabIconDefault} 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.faqAnswer}>
            <ThemedText style={styles.faqAnswerText}>{item.answer}</ThemedText>
          </View>
        )}
      </ThemedView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.text} />
            <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>
            Häufige Fragen
          </ThemedText>
        </View>

        {isLoading ? (
          // Ladeindikator
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade Fragen...</ThemedText>
          </View>
        ) : error ? (
          // Fehleranzeige
          <View style={styles.errorContainer}>
            <IconSymbol name="exclamationmark.triangle.fill" size={40} color={theme.warning} />
            <ThemedText style={styles.errorText}>Fehler beim Laden der Fragen</ThemedText>
            <ThemedText style={styles.errorSubtext}>{error.message}</ThemedText>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setIsLoading(true);
                getFaqEntries().then(({ data }) => {
                  if (data) {
                    setFaqEntries(data);
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
          // FAQ list view
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <IconSymbol name="magnifyingglass" size={20} color={theme.tabIconDefault} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Suche nach Fragen..."
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
            </View>

            <View style={styles.categoriesContainer}>
              <FlatList
                data={categories}
                renderItem={renderCategoryItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesList}
              />
            </View>

            <FlatList
              data={filteredEntries}
              renderItem={renderFaqItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.faqList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <ThemedView style={styles.emptyState} lightColor={theme.card} darkColor={theme.card}>
                  <IconSymbol name="doc.text.magnifyingglass" size={40} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyStateText}>
                    Keine Fragen gefunden
                  </ThemedText>
                  <ThemedText style={styles.emptyStateSubtext}>
                    Versuche es mit einem anderen Suchbegriff oder einer anderen Kategorie
                  </ThemedText>
                </ThemedView>
              }
            />
          </>
        )}
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    marginVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryText: {
    marginLeft: 6,
    fontSize: 14,
  },
  faqList: {
    paddingBottom: 100,
  },
  faqItem: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionContent: {
    flex: 1,
    marginRight: 8,
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  faqCategoryText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  faqAnswer: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  faqAnswerText: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
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
});
