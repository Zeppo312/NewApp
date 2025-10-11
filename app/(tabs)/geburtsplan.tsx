import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch, SafeAreaView, StatusBar, FlatList, Linking, useWindowDimensions, Platform } from 'react-native';
import { Text as RNText } from 'react-native';
import { router, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD, RADIUS, PRIMARY, TEXT_PRIMARY, TIMELINE_INSET } from '@/constants/DesignGuide';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// TIMELINE_INSET zentral aus DesignGuide
import { supabase } from '@/lib/supabase';
import { getCurrentUser, getGeburtsplan, saveGeburtsplan, saveStructuredGeburtsplan } from '@/lib/supabase';
import { GeburtsplanData, defaultGeburtsplan } from '@/types/geburtsplan';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { generateAndDownloadPDF } from '@/lib/geburtsplan-utils';
import Header from '@/components/Header';

// Import der Abschnittskomponenten
import { AllgemeineAngabenSection } from '@/components/geburtsplan/AllgemeineAngabenSection';
import { GeburtsWuenscheSection } from '@/components/geburtsplan/GeburtsWuenscheSection';
import { MedizinischeEingriffeSection } from '@/components/geburtsplan/MedizinischeEingriffeSection';
import { NachDerGeburtSection } from '@/components/geburtsplan/NachDerGeburtSection';
import { NotfallSection } from '@/components/geburtsplan/NotfallSection';
import { SonstigeWuenscheSection } from '@/components/geburtsplan/SonstigeWuenscheSection';

// Die Formatierungsfunktionen wurden in eine separate Datei ausgelagert: components/geburtsplan/formatHelpers.ts

// Funktion zum Generieren eines Textes aus den strukturierten Daten
const generateTextFromStructuredData = (data: GeburtsplanData): string => {
  let text = '';

  // 1. Allgemeine Angaben
  text += 'GEBURTSPLAN\n\n';
  text += '1. Allgemeine Angaben\n';
  if (data.allgemeineAngaben.mutterName) text += `Name der Mutter: ${data.allgemeineAngaben.mutterName}\n`;
  if (data.allgemeineAngaben.entbindungstermin) text += `Entbindungstermin: ${data.allgemeineAngaben.entbindungstermin}\n`;
  if (data.allgemeineAngaben.geburtsklinik) text += `Geburtsklinik / Hausgeburt: ${data.allgemeineAngaben.geburtsklinik}\n`;
  if (data.allgemeineAngaben.begleitpersonen) text += `Begleitperson(en): ${data.allgemeineAngaben.begleitpersonen}\n`;
  text += '\n';

  // 2. Wünsche zur Geburt
  text += '2. Wünsche zur Geburt\n';
  if (data.geburtsWuensche.geburtspositionen.length > 0) {
    text += `Geburtspositionen: ${data.geburtsWuensche.geburtspositionen.join(', ')}\n`;
  }
  if (data.geburtsWuensche.schmerzmittel.length > 0) {
    text += `Schmerzmittel: ${data.geburtsWuensche.schmerzmittel.join(', ')}\n`;
  }
  if (data.geburtsWuensche.rolleBegleitperson) {
    text += `Rolle der Begleitperson: ${data.geburtsWuensche.rolleBegleitperson}\n`;
  }
  if (data.geburtsWuensche.musikAtmosphaere.length > 0) {
    text += `Musik / Atmosphäre: ${data.geburtsWuensche.musikAtmosphaere.join(', ')}\n`;
  }
  if (data.geburtsWuensche.sonstigeWuensche) {
    text += `Sonstige Wünsche: ${data.geburtsWuensche.sonstigeWuensche}\n`;
  }
  text += '\n';

  // 3. Medizinische Eingriffe & Maßnahmen
  text += '3. Medizinische Eingriffe & Maßnahmen\n';
  if (data.medizinischeEingriffe.wehenfoerderung) text += `Wehenförderung: ${data.medizinischeEingriffe.wehenfoerderung}\n`;
  if (data.medizinischeEingriffe.dammschnitt) text += `Dammschnitt / -massage: ${data.medizinischeEingriffe.dammschnitt}\n`;
  if (data.medizinischeEingriffe.monitoring) text += `Monitoring: ${data.medizinischeEingriffe.monitoring}\n`;
  if (data.medizinischeEingriffe.notkaiserschnitt) text += `Notkaiserschnitt: ${data.medizinischeEingriffe.notkaiserschnitt}\n`;
  if (data.medizinischeEingriffe.sonstigeEingriffe) text += `Sonstige Eingriffe: ${data.medizinischeEingriffe.sonstigeEingriffe}\n`;
  text += '\n';

  // 4. Nach der Geburt
  text += '4. Nach der Geburt\n';
  text += `Bonding: ${data.nachDerGeburt.bonding ? 'Ja' : 'Nein'}\n`;
  text += `Stillen: ${data.nachDerGeburt.stillen ? 'Ja' : 'Nein'}\n`;
  if (data.nachDerGeburt.plazenta) text += `Plazenta: ${data.nachDerGeburt.plazenta}\n`;
  if (data.nachDerGeburt.vitaminKGabe) text += `Vitamin-K-Gabe fürs Baby: ${data.nachDerGeburt.vitaminKGabe}\n`;
  if (data.nachDerGeburt.sonstigeWuensche) text += `Sonstige Wünsche: ${data.nachDerGeburt.sonstigeWuensche}\n`;
  text += '\n';

  // 5. Für den Notfall / Kaiserschnitt
  text += '5. Für den Notfall / Kaiserschnitt\n';
  if (data.notfall.begleitpersonImOP) text += `Begleitperson im OP: ${data.notfall.begleitpersonImOP}\n`;
  text += `Bonding im OP: ${data.notfall.bondingImOP ? 'Ja' : 'Nein'}\n`;
  if (data.notfall.fotoerlaubnis) text += `Fotoerlaubnis: ${data.notfall.fotoerlaubnis}\n`;
  if (data.notfall.sonstigeWuensche) text += `Sonstige Wünsche: ${data.notfall.sonstigeWuensche}\n`;
  text += '\n';

  // 6. Sonstige Wünsche / Hinweise
  if (data.sonstigeWuensche.freitext) {
    text += '6. Sonstige Wünsche / Hinweise\n';
    text += `${data.sonstigeWuensche.freitext}\n`;
  }

  return text;
};

export default function GeburtsplanScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // State für den Geburtsplan
  const [geburtsplan, setGeburtsplan] = useState('');
  const [structuredData, setStructuredData] = useState<GeburtsplanData>(defaultGeburtsplan);
  const [useStructuredEditor, setUseStructuredEditor] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [babyIconBase64, setBabyIconBase64] = useState<string | null>(null);

  // Lade das Baby-Icon beim Start
  useEffect(() => {
    const loadBabyIcon = async () => {
      try {
        // Lade das Bild
        const asset = Asset.fromModule(require('@/assets/images/Baby_Icon.png'));
        await asset.downloadAsync();

        // Lese die Datei als Base64
        const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: 'base64',
        });

        setBabyIconBase64(base64);
      } catch (error) {
        console.error('Fehler beim Laden des Baby-Icons:', error);
      }
    };

    loadBabyIcon();
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { user: currentUser } = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        loadGeburtsplan();
      } else {
        setIsLoading(false);
      }
    };

    checkUser();

    // Auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          loadGeburtsplan();
        } else {
          setIsLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadGeburtsplan = async () => {
    try {
      setIsLoading(true);

      // Geburtsplan laden mit der Hilfsfunktion
      const { data, error } = await getGeburtsplan();

      if (error) {
        console.error('Error loading geburtsplan:', error);
        // Keine Alert-Meldung mehr, um die Benutzererfahrung nicht zu beeinträchtigen
      } else if (data) {
        // Wenn Daten gefunden wurden

        // Wenn strukturierte Daten vorhanden sind, setzen wir diese
        if (data.structured_data) {
          setStructuredData(data.structured_data);
          // Wenn es einen gespeicherten Textinhalt gibt, setzen wir diesen
          if (data.textContent) {
            setGeburtsplan(data.textContent);
          } else {
            // Ansonsten generieren wir den Text aus den strukturierten Daten
            const generatedContent = generateTextFromStructuredData(data.structured_data);
            setGeburtsplan(generatedContent);
          }
        } else {
          // Wenn keine strukturierten Daten vorhanden sind, setzen wir den Textinhalt
          setGeburtsplan(data.content || '');
        }

        console.log('Geburtsplan geladen:', data);
      }
    } catch (err) {
      console.error('Failed to load geburtsplan:', err);
      // Keine Alert-Meldung mehr, um die Benutzererfahrung nicht zu beeinträchtigen
    } finally {
      setIsLoading(false);
    }
  };

  // Funktion zum Generieren und Herunterladen des Geburtsplans als PDF
  const handleGeneratePDF = async () => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtsplan als PDF zu speichern.');
      return;
    }

    // Verwende die ausgelagerte Funktion
    await generateAndDownloadPDF(babyIconBase64, setIsGeneratingPDF);
  };

  const handleSaveGeburtsplan = async () => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtsplan zu speichern.');
      return;
    }

    try {
      setIsSaving(true);

      let result;

      // Je nach Editor-Modus den Geburtsplan speichern
      if (useStructuredEditor) {
        // Strukturierten Geburtsplan speichern
        // Wir generieren auch einen Textinhalt aus den strukturierten Daten
        const generatedContent = generateTextFromStructuredData(structuredData);
        result = await saveStructuredGeburtsplan(structuredData, generatedContent);
        // Auch den Textinhalt aktualisieren
        setGeburtsplan(generatedContent);
      } else {
        // Einfachen Textgeburtsplan speichern
        result = await saveGeburtsplan(geburtsplan);
      }

      const { error } = result;

      if (error) {
        console.error('Error saving geburtsplan:', error);
        Alert.alert('Fehler', 'Der Geburtsplan konnte nicht gespeichert werden.');
      } else {
        Alert.alert('Erfolg', 'Dein Geburtsplan wurde gespeichert.', [
          {
            text: 'OK',
            onPress: () => {
              // Nach erfolgreichem Speichern zur Countdown-Seite zurückkehren
              router.push('/(tabs)/countdown');
            }
          }
        ]);
        // Nach erfolgreichem Speichern den Geburtsplan neu laden
        await loadGeburtsplan();
        console.log('Geburtsplan gespeichert und neu geladen');
      }
    } catch (err) {
      console.error('Failed to save geburtsplan:', err);
      Alert.alert('Fehler', 'Der Geburtsplan konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header 
          title="Geburtsplan" 
          subtitle="Plane deine ideale Geburt"
          showBackButton 
        />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <ThemedText style={styles.sectionTitle}>
                    Über den Geburtsplan
                  </ThemedText>
                  <ThemedText style={styles.infoText}>
                    Hier kannst du deinen persönlichen Geburtsplan erstellen und speichern. Notiere deine Wünsche und Vorstellungen für die Geburt, damit du sie mit deinem Geburtsteam teilen kannst.
                  </ThemedText>
                </LiquidGlassCard>

                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <ThemedText style={styles.sectionTitle}>
                    Editor-Modus
                  </ThemedText>
                  <View style={styles.switchContainer}>
                    <ThemedText style={styles.switchLabel}>Strukturierter Editor</ThemedText>
                    <Switch
                      value={useStructuredEditor}
                      onValueChange={setUseStructuredEditor}
                      trackColor={{ false: '#D1D1D6', true: '#9DBEBB' }}
                      thumbColor={useStructuredEditor ? '#FFFFFF' : '#F4F4F4'}
                      ios_backgroundColor="#D1D1D6"
                    />
                  </View>
                </LiquidGlassCard>

                {isLoading ? (
                  <ActivityIndicator size="large" color={theme.accent} style={styles.loader} />
                ) : useStructuredEditor ? (
                  // Strukturierter Editor
                  <>
                    <AllgemeineAngabenSection
                      data={structuredData.allgemeineAngaben}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        allgemeineAngaben: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                    />

                    <GeburtsWuenscheSection
                      data={structuredData.geburtsWuensche}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        geburtsWuensche: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                    />

                    <MedizinischeEingriffeSection
                      data={structuredData.medizinischeEingriffe}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        medizinischeEingriffe: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                    />

                    <NachDerGeburtSection
                      data={structuredData.nachDerGeburt}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        nachDerGeburt: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                    />

                    <NotfallSection
                      data={structuredData.notfall}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        notfall: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                    />

                    <SonstigeWuenscheSection
                      data={structuredData.sonstigeWuensche}
                      onChange={(newData) => setStructuredData({
                        ...structuredData,
                        sonstigeWuensche: newData
                      })}
                      containerStyle={styles.fullWidthCard}
                    />
                  </>
                ) : (
                  // Einfacher Texteditor
                  <LiquidGlassCard style={styles.textAreaGlass} intensity={26} overlayColor={GLASS_OVERLAY}>
                    <TextInput
                      style={[
                        styles.textArea,
                        { color: colorScheme === 'dark' ? theme.text : theme.text }
                      ]}
                      multiline
                      numberOfLines={20}
                      placeholder="Schreibe hier deinen Geburtsplan..."
                      placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                      value={geburtsplan}
                      onChangeText={setGeburtsplan}
                    />
                  </LiquidGlassCard>
                )}

                <View style={styles.cardsRow}>
                  <LiquidGlassCard
                    style={[styles.actionCardWrapper, { marginRight: 12 }]}
                    intensity={24}
                    overlayColor={'rgba(142,78,198,0.32)'}
                    borderColor={'rgba(255,255,255,0.7)'}
                    onPress={handleSaveGeburtsplan}
                  >
                    <View style={styles.actionCardInner}>
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#fff' : '#fff'} />
                      ) : (
                        <>
                          <View style={[styles.iconContainer, { backgroundColor: 'rgba(142,78,198,0.9)' }]}>
                            <IconSymbol name="tray.and.arrow.down.fill" size={24} color="#FFFFFF" />
                          </View>
                          <ThemedText style={[styles.cardTitle, { color: TEXT_PRIMARY }]}>Speichern</ThemedText>
                          <ThemedText style={[styles.cardDesc, { color: TEXT_PRIMARY }]}>Geburtsplan</ThemedText>
                        </>
                      )}
                    </View>
                  </LiquidGlassCard>

                  <LiquidGlassCard
                    style={styles.actionCardWrapper}
                    intensity={24}
                    overlayColor={'rgba(168,196,193,0.32)'}
                    borderColor={'rgba(255,255,255,0.7)'}
                    onPress={handleGeneratePDF}
                  >
                    <View style={styles.actionCardInner}>
                      {isGeneratingPDF ? (
                        <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#fff' : '#fff'} />
                      ) : (
                        <>
                          <View style={[styles.iconContainer, { backgroundColor: 'rgba(168,196,193,0.9)' }]}>
                            <IconSymbol name="arrow.down.doc" size={24} color="#FFFFFF" />
                          </View>
                          <ThemedText style={[styles.cardTitle, { color: TEXT_PRIMARY }]}>PDF</ThemedText>
                          <ThemedText style={[styles.cardDesc, { color: TEXT_PRIMARY }]}>Herunterladen</ThemedText>
                        </>
                      )}
                    </View>
                  </LiquidGlassCard>
                </View>

                <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
                  <ThemedText style={styles.sectionTitle}>
                    Tipps für deinen Geburtsplan
                  </ThemedText>
                  <ThemedText style={styles.tipText}>• Gebärposition: Welche Positionen bevorzugst du?</ThemedText>
                  <ThemedText style={styles.tipText}>• Schmerzlinderung: Welche Methoden möchtest du nutzen?</ThemedText>
                  <ThemedText style={styles.tipText}>• Atmosphäre: Musik, Licht, Anwesende Personen</ThemedText>
                  <ThemedText style={styles.tipText}>• Medizinische Eingriffe: Welche akzeptierst du, welche nicht?</ThemedText>
                  <ThemedText style={styles.tipText}>• Nach der Geburt: Wünsche für die ersten Stunden mit deinem Baby</ThemedText>
                </LiquidGlassCard>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: { paddingHorizontal: LAYOUT_PAD, paddingBottom: 40, paddingTop: 10 },
  fullWidthCard: {
    marginHorizontal: TIMELINE_INSET, // identisch zur Timeline
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    // gleiche Innenbreite wie Timeline:
    marginHorizontal: TIMELINE_INSET,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  infoText: { fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY, paddingHorizontal: 16, marginBottom: 16 },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  textAreaGlass: {
    borderRadius: 22,
    overflow: 'hidden',
    // gleiche Innenbreite wie Timeline:
    marginHorizontal: TIMELINE_INSET,
    padding: 12,
    marginBottom: 16
  },
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 300,
    textAlignVertical: 'top',
  },
  // Action cards row
  cardsRow: {
    flexDirection: 'row',
    // gleiche Innenbreite wie Timeline:
    alignSelf: 'stretch',
    marginHorizontal: TIMELINE_INSET,
    justifyContent: 'center',
    marginBottom: 16
  },
  actionCardWrapper: { flex: 1, borderRadius: 22, overflow: 'hidden' },
  actionCardInner: {
    alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 112,
  },
  iconContainer: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)'
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardDesc: { fontSize: 12, opacity: 0.9 },
  tipText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 5,
    color: TEXT_PRIMARY,
    paddingHorizontal: 16,
  },
  loader: {
    marginVertical: 30,
  },
});
