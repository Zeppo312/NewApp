import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, ImageBackground, SafeAreaView, StatusBar, FlatList } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';

// Define article type
interface Article {
  id: string;
  title: string;
  category: string;
  teaser: string;
  readingTime: string;
  isFavorite: boolean;
  content?: {
    coreStatements: string[];
    sections: {
      title: string;
      content: string;
    }[];
  };
}

// Sample articles data
const SAMPLE_ARTICLES: Article[] = [
  {
    id: '1',
    title: 'Stillen für Anfängerinnen',
    category: 'Stillen & Ernährung',
    teaser: 'Die wichtigsten Grundlagen zum erfolgreichen Stillen deines Babys.',
    readingTime: '5 Min',
    isFavorite: false,
    content: {
      coreStatements: [
        'Stillen ist die natürlichste Form der Ernährung für dein Baby',
        'Die richtige Anlegetechnik ist entscheidend für erfolgreiches Stillen',
        'Bei Problemen kann eine Stillberaterin helfen'
      ],
      sections: [
        {
          title: 'Die richtige Anlegetechnik',
          content: 'Achte darauf, dass dein Baby den Mund weit öffnet und möglichst viel vom Warzenhof erfasst. Die Nase und das Kinn deines Babys sollten die Brust berühren.'
        },
        {
          title: 'Stillpositionen',
          content: 'Es gibt verschiedene Stillpositionen wie die Wiegehaltung, die Rückengriffhaltung oder die Seitenlage. Probiere verschiedene Positionen aus, um herauszufinden, welche für dich und dein Baby am bequemsten ist.'
        }
      ]
    }
  },
  {
    id: '2',
    title: 'Schlafrhythmus im ersten Monat',
    category: 'Schlaf & Tagesrhythmus',
    teaser: 'So findest du einen sanften Rhythmus für dein Neugeborenes.',
    readingTime: '4 Min',
    isFavorite: true,
    content: {
      coreStatements: [
        'Neugeborene haben noch keinen Tag-Nacht-Rhythmus',
        'Ein Baby schläft 14-17 Stunden täglich, aber in kurzen Phasen',
        'Regelmäßige Abläufe helfen, einen Rhythmus zu entwickeln'
      ],
      sections: [
        {
          title: 'Schlafphasen verstehen',
          content: 'Neugeborene durchlaufen kürzere Schlafzyklen als Erwachsene und wachen daher häufiger auf. Das ist völlig normal und dient dem Überleben.'
        },
        {
          title: 'Tag-Nacht-Rhythmus fördern',
          content: 'Tagsüber normal im Haushalt agieren, nachts gedämpftes Licht und ruhige Stimme verwenden. So lernt dein Baby mit der Zeit den Unterschied zwischen Tag und Nacht.'
        }
      ]
    }
  },
  {
    id: '3',
    title: 'Nabelschnurpflege',
    category: 'Gesundheit & Pflege',
    teaser: 'So pflegst du den Nabelschnurrest richtig, bis er abfällt.',
    readingTime: '3 Min',
    isFavorite: false
  },
  {
    id: '4',
    title: 'Die ersten Meilensteine',
    category: 'Entwicklung & Meilensteine',
    teaser: 'Diese Entwicklungsschritte erwarten dich in den ersten drei Monaten.',
    readingTime: '6 Min',
    isFavorite: false
  },
  {
    id: '5',
    title: 'Wochenbett überstehen',
    category: 'Mama & Papa',
    teaser: 'Tipps für die herausfordernde Zeit nach der Geburt.',
    readingTime: '7 Min',
    isFavorite: true
  },
  {
    id: '6',
    title: 'Beikost einführen',
    category: 'Stillen & Ernährung',
    teaser: 'Der richtige Zeitpunkt und die besten ersten Lebensmittel.',
    readingTime: '8 Min',
    isFavorite: false
  },
  {
    id: '7',
    title: 'Baby-Blues und postpartale Depression',
    category: 'Mama & Papa',
    teaser: 'Unterschiede erkennen und Hilfe finden.',
    readingTime: '5 Min',
    isFavorite: false
  }
];

// Category data with icons
const CATEGORIES = [
  { id: 'all', name: 'Alle Artikel', icon: 'doc.text.fill' },
  { id: 'Stillen & Ernährung', name: 'Stillen & Ernährung', icon: 'drop.fill' },
  { id: 'Schlaf & Tagesrhythmus', name: 'Schlaf & Tagesrhythmus', icon: 'moon.stars.fill' },
  { id: 'Gesundheit & Pflege', name: 'Gesundheit & Pflege', icon: 'heart.fill' },
  { id: 'Entwicklung & Meilensteine', name: 'Entwicklung & Meilensteine', icon: 'chart.bar.fill' },
  { id: 'Mama & Papa', name: 'Mama & Papa', icon: 'person.2.fill' },
  { id: 'favorites', name: 'Favoriten', icon: 'star.fill' }
];

export default function MiniWikiScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>(SAMPLE_ARTICLES);

  // Filter articles based on search query and selected category
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.teaser.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' ? true :
      selectedCategory === 'favorites' ? article.isFavorite :
      article.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Toggle favorite status
  const toggleFavorite = (id: string) => {
    setArticles(articles.map(article =>
      article.id === id
        ? { ...article, isFavorite: !article.isFavorite }
        : article
    ));
  };

  // Render category item
  const renderCategoryItem = ({ item }: { item: typeof CATEGORIES[0] }) => (
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

  // Render article item
  const renderArticleItem = ({ item }: { item: Article }) => (
    <TouchableOpacity
      style={styles.articleItem}
      onPress={() => setSelectedArticle(item)}
    >
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
    </TouchableOpacity>
  );

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
            Mini-Wiki
          </ThemedText>
        </View>

        {selectedArticle ? (
          // Article detail view
          <ScrollView style={styles.articleDetailContainer}>
            <TouchableOpacity
              style={styles.backToListButton}
              onPress={() => setSelectedArticle(null)}
            >
              <IconSymbol name="chevron.left" size={20} color={theme.accent} />
              <ThemedText style={[styles.backToListText, { color: theme.accent }]}>
                Zurück zur Übersicht
              </ThemedText>
            </TouchableOpacity>

            <ThemedView style={styles.articleDetailCard} lightColor={theme.card} darkColor={theme.card}>
              <View style={styles.articleDetailHeader}>
                <ThemedText style={styles.articleDetailTitle}>{selectedArticle.title}</ThemedText>
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={() => toggleFavorite(selectedArticle.id)}
                >
                  <IconSymbol
                    name={selectedArticle.isFavorite ? 'star.fill' : 'star'}
                    size={24}
                    color={selectedArticle.isFavorite ? theme.accent : theme.tabIconDefault}
                  />
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.articleDetailCategory}>{selectedArticle.category}</ThemedText>

              <View style={styles.readingTimeDetail}>
                <IconSymbol name="clock" size={14} color={theme.tabIconDefault} />
                <ThemedText style={styles.readingTimeText}>{selectedArticle.readingTime}</ThemedText>
              </View>

              {selectedArticle.content && (
                <>
                  <View style={styles.coreStatementsContainer}>
                    <ThemedText style={styles.sectionTitle}>Das Wichtigste in Kürze</ThemedText>
                    {selectedArticle.content.coreStatements.map((statement, index) => (
                      <View key={index} style={styles.coreStatementItem}>
                        <View style={[styles.bulletPoint, { backgroundColor: theme.accent }]} />
                        <ThemedText style={styles.coreStatementText}>{statement}</ThemedText>
                      </View>
                    ))}
                  </View>

                  {selectedArticle.content.sections.map((section, index) => (
                    <View key={index} style={styles.contentSection}>
                      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                      <ThemedText style={styles.sectionContent}>{section.content}</ThemedText>
                    </View>
                  ))}
                </>
              )}
            </ThemedView>
          </ScrollView>
        ) : (
          // Article list view
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
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
            </View>

            <View style={styles.categoriesContainer}>
              <FlatList
                data={CATEGORIES}
                renderItem={renderCategoryItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesList}
              />
            </View>

            <FlatList
              data={filteredArticles}
              renderItem={renderArticleItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.articlesList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <ThemedView style={styles.emptyState} lightColor={theme.card} darkColor={theme.card}>
                  <IconSymbol name="doc.text.magnifyingglass" size={40} color={theme.tabIconDefault} />
                  <ThemedText style={styles.emptyStateText}>
                    Keine Artikel gefunden
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
  articlesList: {
    paddingBottom: 100,
  },
  articleItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    borderRadius: 12,
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
