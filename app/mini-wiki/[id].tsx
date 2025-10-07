import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, ActivityIndicator, SafeAreaView, StatusBar, Dimensions } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LiquidGlassCard, LAYOUT_PAD } from '@/constants/DesignGuide';
import { getWikiArticle, addWikiArticleToFavorites, removeWikiArticleFromFavorites } from '@/lib/supabase/wiki';
import Header from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const timelineWidth = contentWidth - TIMELINE_INSET * 2; // EXACT Timeline card width

export default function WikiArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [article, setArticle] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { data, error } = await getWikiArticle(id);
        if (error) throw error;
        setArticle(data);
      } catch (e: any) {
        setError(e?.message || 'Fehler beim Laden');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const toggleFavorite = async () => {
    if (!article) return;
    try {
      const isFav = !!article.isFavorite;
      if (isFav) {
        const { error } = await removeWikiArticleFromFavorites(article.id);
        if (error) throw error;
        setArticle({ ...article, isFavorite: false });
      } else {
        const { error } = await addWikiArticleToFavorites(article.id);
        if (error) throw error;
        setArticle({ ...article, isFavorite: true });
      }
    } catch (e) {
      // noop simple error
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.backgroundImage} resizeMode="repeat">
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />
          <Header title={article?.title || 'Artikel'} showBackButton />

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={{ marginTop: 12 }}>Lade Artikel…</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <IconSymbol name="exclamationmark.triangle" size={40} color={theme.warning} />
              <ThemedText style={{ marginTop: 8 }}>{error}</ThemedText>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ alignSelf: 'center', width: contentWidth, paddingHorizontal: TIMELINE_INSET }}>
                <LiquidGlassCard style={[styles.articleCard, { width: '100%' }] }>
                  <View style={styles.headerRow}>
                    <ThemedText style={styles.title}>{article.title}</ThemedText>
                    <TouchableOpacity onPress={toggleFavorite} style={styles.favBtn}>
                      <IconSymbol name={article.isFavorite ? 'star.fill' : 'star'} size={24} color={article.isFavorite ? theme.accent : theme.tabIconDefault} />
                    </TouchableOpacity>
                  </View>
                  {article.category && (
                    <ThemedText style={styles.category}>{article.category.name || ''}</ThemedText>
                  )}
                  {article.reading_time && (
                    <View style={styles.readingRow}>
                      <IconSymbol name="clock" size={14} color={theme.tabIconDefault} />
                      <ThemedText style={styles.reading}>{article.reading_time}</ThemedText>
                    </View>
                  )}

                  {article.content && (
                    <>
                      {Array.isArray(article.content.coreStatements) && article.content.coreStatements.length > 0 && (
                        <View style={{ marginTop: 8, marginBottom: 16 }}>
                          <ThemedText style={styles.sectionTitle}>Das Wichtigste in Kürze</ThemedText>
                          {article.content.coreStatements.map((s: string, i: number) => (
                            <View key={i} style={styles.coreRow}>
                              <View style={styles.bullet} />
                              <ThemedText style={styles.coreText}>{s}</ThemedText>
                            </View>
                          ))}
                        </View>
                      )}

                      {Array.isArray(article.content.sections) && article.content.sections.map((section: any, i: number) => (
                        <View key={i} style={{ marginBottom: 20 }}>
                          <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                          <ThemedText style={styles.sectionText}>{section.content}</ThemedText>
                        </View>
                      ))}
                    </>
                  )}
                </LiquidGlassCard>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  articleCard: { borderRadius: 22, padding: 14, marginTop: 12, marginBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: 'bold', flex: 1, marginRight: 8 },
  favBtn: { padding: 4 },
  category: { fontSize: 14, opacity: 0.7, marginTop: 4, marginBottom: 8 },
  readingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  reading: { marginLeft: 4, fontSize: 14, opacity: 0.7 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  coreRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8, backgroundColor: 'rgba(94,61,179,0.85)' },
  coreText: { fontSize: 16, flex: 1 },
  sectionText: { fontSize: 16, lineHeight: 24 },
});
