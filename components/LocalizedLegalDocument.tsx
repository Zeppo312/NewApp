import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { LAYOUT_PAD } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { LegalDocument } from '@/lib/legalTranslations';

export function LocalizedLegalDocument({ document }: { document: LegalDocument }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden />
        <Header title={document.headerTitle} subtitle={document.headerSubtitle} showBackButton />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#FFF5EE', borderColor: theme.border }]}>
            <ThemedText style={styles.pageTitle}>{document.pageTitle}</ThemedText>
            {document.updated ? <ThemedText style={styles.paragraph}>{document.updated}</ThemedText> : null}
            {document.sections.map((section) => <View key={section.title} style={styles.section}>
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
              {section.paragraphs?.map((paragraph, index) => <ThemedText key={`${section.title}-p-${index}`} selectable style={styles.paragraph}>{paragraph}</ThemedText>)}
              {section.bullets?.map((bullet, index) => <ThemedText key={`${section.title}-b-${index}`} selectable style={styles.listItem}>{`• ${bullet}`}</ThemedText>)}
            </View>)}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  </>;
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%' }, safeArea: { flex: 1 }, content: { paddingHorizontal: LAYOUT_PAD, paddingBottom: 40, paddingTop: 10 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 20, paddingVertical: 18, gap: 10 },
  pageTitle: { fontSize: 22, fontWeight: '700' }, section: { marginBottom: 8 }, sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 22, marginBottom: 6 }, listItem: { fontSize: 14, lineHeight: 22, marginBottom: 6, paddingLeft: 4 },
});
