import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { LAYOUT_PAD } from '@/constants/DesignGuide';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const PLACEHOLDER = '[Bitte ergänzen]';

const BulletList = ({ items }: { items: string[] }) => (
  <View style={styles.list}>
    {items.map((item, index) => (
      <ThemedText key={`bullet-${index}`} style={styles.listItem}>
        {`\u2022 ${item}`}
      </ThemedText>
    ))}
  </View>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
    {children}
  </View>
);

export default function ImpressumScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />

          <Header
            title="Impressum"
            subtitle="Anbieterkennzeichnung"
            showBackButton
            onBackPress={() => router.push('/more')}
          />

          <ScrollView contentContainerStyle={styles.content}>
            <View
              style={[
                styles.card,
                { backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#FFF5EE', borderColor: theme.border },
              ]}
            >
              <Section title="Angaben zum Anbieter">
                <ThemedText style={styles.paragraph}>Name/Firma: Laura-Michelle Zeppenfeld</ThemedText>
                <ThemedText style={styles.paragraph}>Straße, Hausnummer: Tilburger Str. 31</ThemedText>
                <ThemedText style={styles.paragraph}>PLZ, Ort: 28259 Bremen</ThemedText>
                <ThemedText style={styles.paragraph}>Land: Deutschland</ThemedText>
                <ThemedText style={styles.paragraph}>Status: Kleinunternehmer</ThemedText>
              </Section>

              <Section title="Kontakt">
                <ThemedText style={styles.paragraph}>E-Mail: support@lottibaby.de</ThemedText>
              </Section>

              <Section title="Vertretungsberechtigte Person(en)">
                <ThemedText style={styles.paragraph}>Laura-Michelle Zeppenfeld</ThemedText>
              </Section>

              <Section title="Registereintrag (falls vorhanden)">
                <ThemedText style={styles.paragraph}>Registergericht: Wird nachgereicht</ThemedText>
                <ThemedText style={styles.paragraph}>Registernummer: Wird nachgereicht</ThemedText>
              </Section>

              <Section title="Umsatzsteuer-Identifikationsnummer (falls vorhanden)">
                <ThemedText style={styles.paragraph}>Wird nachgereicht</ThemedText>
              </Section>

              <Section title="Verantwortlich für den Inhalt">
                <ThemedText style={styles.paragraph}>
                  Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Deutschland
                </ThemedText>
              </Section>

              <Section title="Streitschlichtung">
                <BulletList
                  items={[
                    'Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
                    'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit.',
                    'OS-Plattform: https://ec.europa.eu/consumers/odr/',
                  ]}
                />
              </Section>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 10,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  list: {
    paddingLeft: 4,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
});
