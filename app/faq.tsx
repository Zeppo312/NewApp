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
import { getFaqCategories, getFaqEntries, FaqCategory, FaqEntry } from '@/lib/supabase/faq';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Header from '@/components/Header';

// Lokale Erweiterung des FaqCategory-Typs für die UI
interface Category extends FaqCategory {
  isAll?: boolean; // Für die "Alle Fragen"-Kategorie
}

export default function FaqScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { width: screenWidth } = Dimensions.get('window');
  const TIMELINE_INSET = 8; // Match ActivityCard inset
  const contentWidth = screenWidth - 2 * LAYOUT_PAD;

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

  // Render FAQ entry item
  const renderFaqItem = ({ item }: { item: FaqEntry }) => {
    const isExpanded = expandedEntries[item.id] || false;

    return (
      <LiquidGlassCard style={styles.faqItemGlass} intensity={24}>
        <TouchableOpacity style={styles.faqQuestion} onPress={() => toggleExpanded(item.id)}>
          <View style={styles.faqQuestionContent}>
            <ThemedText style={styles.faqQuestionText}>{item.question}</ThemedText>
            <ThemedText style={styles.faqCategoryText}>{item.category}</ThemedText>
          </View>
          <IconSymbol name={isExpanded ? 'chevron.up' : 'chevron.down'} size={20} color={theme.tabIconDefault} />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.faqAnswer}>
            <ThemedText style={styles.faqAnswerText}>{item.answer}</ThemedText>
          </View>
        )}
      </LiquidGlassCard>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground
        style={styles.backgroundImage}
        resizeMode="repeat"
      >
        <SafeAreaView style={styles.container}>
          <StatusBar hidden={true} />
          
          <Header title="Häufige Fragen" showBackButton onBackPress={() => router.push('/more')} />
          

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
            <View style={[styles.searchContainer, { alignSelf: 'center', width: contentWidth }]}>
              <LiquidGlassCard style={styles.searchGlass} intensity={24}>
                <View style={styles.searchRow}>
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
                data={filteredEntries}
                renderItem={renderFaqItem}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.faqList, { paddingHorizontal: TIMELINE_INSET }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <LiquidGlassCard style={styles.emptyState}>
                    <IconSymbol name="doc.text.magnifyingglass" size={40} color={theme.tabIconDefault} />
                    <ThemedText style={styles.emptyStateText}>
                      Keine Fragen gefunden
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
  searchGlass: { borderRadius: 22, padding: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoriesList: { paddingRight: 0 },
  categoryItemGlass: { borderRadius: 20, marginRight: 8 },
  categoryItemActive: { borderColor: 'rgba(94,61,179,0.65)' },
  categoryItemInnerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
  },
  faqList: {
    paddingBottom: 100,
  },
  faqItemGlass: { borderRadius: 22, marginBottom: 12, width: '100%' },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  faqQuestionContent: {
    flex: 1,
    marginRight: 8,
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  faqCategoryText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  faqAnswer: {
    padding: 14,
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
});
