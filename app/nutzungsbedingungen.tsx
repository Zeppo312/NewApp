import React from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { LAYOUT_PAD } from '@/constants/DesignGuide';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

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

const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function NutzungsbedingungenScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />

          <Header
            title="Nutzungsbedingungen"
            subtitle="Bedingungen für App und Abo"
            showBackButton
          />

          <ScrollView contentContainerStyle={styles.content}>
            <View
              style={[
                styles.card,
                { backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#FFF5EE', borderColor: theme.border },
              ]}
            >
              <ThemedText style={styles.pageTitle}>Nutzungsbedingungen</ThemedText>
              <ThemedText style={styles.paragraph}>Stand: 7. März 2026</ThemedText>

              <Section title="Geltungsbereich">
                <ThemedText style={styles.paragraph}>
                  Diese Nutzungsbedingungen regeln die Nutzung der App Lotti Baby sowie aller darin angebotenen Inhalte,
                  Funktionen und Abonnements. Anbieterin ist Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen,
                  Deutschland.
                </ThemedText>
              </Section>

              <Section title="Leistungsbeschreibung">
                <ThemedText style={styles.paragraph}>
                  Lotti Baby unterstützt Nutzerinnen und Nutzer mit digitalen Funktionen rund um Schwangerschaft,
                  Baby-Alltag, Planung und Dokumentation. Der konkrete Funktionsumfang kann sich weiterentwickeln, um
                  die App technisch, inhaltlich oder rechtlich anzupassen.
                </ThemedText>
              </Section>

              <Section title="Nutzerkonto und Zugang">
                <BulletList
                  items={[
                    'Für einzelne Funktionen ist ein Nutzerkonto erforderlich.',
                    'Zugangsdaten sind vertraulich zu behandeln und dürfen nicht missbräuchlich verwendet werden.',
                    'Die Nutzung darf nur im Rahmen geltender Gesetze und dieser Bedingungen erfolgen.',
                  ]}
                />
              </Section>

              <Section title="Abonnement, Preise und Laufzeit">
                <BulletList
                  items={[
                    'Nach der kostenlosen Testphase ist für die weitere Nutzung der App ein aktives Abonnement erforderlich.',
                    'Der jeweils angezeigte Preis auf dem Paywall-Screen ist der verbindliche Preis zum Zeitpunkt des Kaufs.',
                    'Die Abrechnung erfolgt über das App-Store- oder Google-Play-Konto, das beim Kauf verwendet wird.',
                    'Abonnements verlängern sich automatisch, wenn sie nicht rechtzeitig vor Ende der laufenden Periode in den Store-Einstellungen gekündigt werden.',
                    'Bereits begonnene Abrechnungszeiträume werden grundsätzlich nicht anteilig erstattet, soweit nicht zwingendes Recht oder Store-Regeln etwas anderes vorsehen.',
                  ]}
                />
              </Section>

              <Section title="Kündigung und Verwaltung">
                <ThemedText style={styles.paragraph}>
                  Die Verwaltung, Kündigung und Wiederherstellung von Abonnements erfolgt über die jeweiligen
                  Store-Einstellungen beziehungsweise die dafür vorgesehenen Funktionen innerhalb der App.
                </ThemedText>
              </Section>

              <Section title="Kein medizinischer Rat">
                <ThemedText style={styles.paragraph}>
                  Die Inhalte von Lotti Baby dienen der allgemeinen Information, Organisation und Dokumentation. Sie
                  ersetzen keine medizinische Beratung, Diagnose oder Behandlung. Bei gesundheitlichen Beschwerden oder
                  Unsicherheiten ist ärztlicher Rat einzuholen.
                </ThemedText>
              </Section>

              <Section title="Zulässige Nutzung">
                <BulletList
                  items={[
                    'Die App darf nicht zur Verletzung von Rechten Dritter, zur Störung des Betriebs oder für rechtswidrige Zwecke verwendet werden.',
                    'Automatisierte Zugriffe, Umgehung technischer Schutzmaßnahmen und unbefugte Vervielfältigung von Inhalten sind unzulässig.',
                  ]}
                />
              </Section>

              <Section title="Verfügbarkeit und Änderungen">
                <ThemedText style={styles.paragraph}>
                  Es besteht kein Anspruch auf eine jederzeit unterbrechungsfreie Verfügbarkeit. Wartungen, Updates,
                  technische Störungen oder Sicherheitsmaßnahmen können die Nutzung zeitweise einschränken.
                </ThemedText>
                <ThemedText style={styles.paragraph}>
                  Die Anbieterin kann Funktionen anpassen, erweitern oder einstellen, soweit dies unter Berücksichtigung
                  der Interessen der Nutzerinnen und Nutzer zumutbar ist.
                </ThemedText>
              </Section>

              <Section title="Haftung">
                <ThemedText style={styles.paragraph}>
                  Die Anbieterin haftet unbeschränkt bei Vorsatz, grober Fahrlässigkeit, bei Verletzung von Leben,
                  Körper oder Gesundheit sowie nach den zwingenden Vorschriften des Produkthaftungsrechts. Im Übrigen
                  haftet die Anbieterin nur bei Verletzung wesentlicher Vertragspflichten; in diesem Fall ist die Haftung
                  auf den typischerweise vorhersehbaren Schaden begrenzt.
                </ThemedText>
              </Section>

              <Section title="Datenschutz">
                <ThemedText style={styles.paragraph}>
                  Informationen zur Verarbeitung personenbezogener Daten finden sich in der Datenschutzerklärung innerhalb
                  der App.
                </ThemedText>
              </Section>

              <Section title="Ergänzende Store-Bedingungen">
                <ThemedText style={styles.paragraph}>
                  Für Käufe über iOS kann ergänzend die Standard-Endnutzerlizenz von Apple gelten.
                </ThemedText>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(APPLE_EULA_URL)}>
                  <ThemedText style={styles.linkText}>{APPLE_EULA_URL}</ThemedText>
                </Pressable>
              </Section>

              <Section title="Kontakt">
                <ThemedText style={styles.paragraph}>support@lottibaby.de</ThemedText>
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
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
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
  linkText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#5E3DB3',
    textDecorationLine: 'underline',
  },
});
