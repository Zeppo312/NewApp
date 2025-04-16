import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ImageBackground } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { getCurrentUser, getGeburtsplan, saveGeburtsplan, saveStructuredGeburtsplan } from '@/lib/supabase';
import { GeburtsplanData, defaultGeburtsplan } from '@/types/geburtsplan';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

// Import der Abschnittskomponenten
import { AllgemeineAngabenSection } from '@/components/geburtsplan/AllgemeineAngabenSection';
import { GeburtsWuenscheSection } from '@/components/geburtsplan/GeburtsWuenscheSection';
import { MedizinischeEingriffeSection } from '@/components/geburtsplan/MedizinischeEingriffeSection';
import { NachDerGeburtSection } from '@/components/geburtsplan/NachDerGeburtSection';
import { NotfallSection } from '@/components/geburtsplan/NotfallSection';
import { SonstigeWuenscheSection } from '@/components/geburtsplan/SonstigeWuenscheSection';

// Funktion zum Formatieren des Inhalts für HTML
const formatContentForHTML = (content: string): string => {
  // Ersetze Zeilenumbrüche durch <br>
  let formattedContent = content.replace(/\n/g, '<br>');

  // Ersetze Markdown-Überschriften durch HTML-Überschriften und entferne die Hashtags
  formattedContent = formattedContent.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  formattedContent = formattedContent.replace(/^## (.*)$/gm, '<h2>$1</h2>');

  // Entferne alle verbliebenen Hashtags am Anfang von Zeilen
  formattedContent = formattedContent.replace(/^#+ (.*)(<br>|$)/gm, '<h3>$1</h3>');

  // Formatiere Schlüssel-Wert-Paare (z.B. "Name der Mutter: Anna")
  formattedContent = formattedContent.replace(/(.*?): (.*?)(<br>|$)/g, '<div class="item"><span class="item-label">$1:</span> <span class="item-value">$2</span></div>');

  // Gruppiere Abschnitte
  formattedContent = formattedContent.replace(/<h2>(.*?)<\/h2>/g, '</div><div class="section"><h2>$1</h2>');

  // Schließe den ersten Abschnitt und füge einen öffnenden div für den ersten Abschnitt hinzu
  formattedContent = '<div class="section">' + formattedContent + '</div>';

  // Entferne leere Abschnitte
  formattedContent = formattedContent.replace(/<div class="section"><\/div>/g, '');

  return formattedContent;
};

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

    try {
      setIsGeneratingPDF(true);

      // Generiere den Inhalt für das PDF
      let content = '';

      if (useStructuredEditor) {
        // Wenn der strukturierte Editor verwendet wird, generieren wir den Text aus den strukturierten Daten
        content = generateTextFromStructuredData(structuredData);
      } else {
        // Ansonsten verwenden wir den eingegebenen Text
        content = geburtsplan;
      }

      // Erstelle HTML für das PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Mein Geburtsplan</title>
          <style>
            @page {
              margin: 2cm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              color: #333;
              background-color: #FFF8F0;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background-color: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #E8D5C4;
            }
            h1 {
              color: #7D5A50;
              font-size: 28px;
              margin-bottom: 10px;
            }
            h2 {
              color: #7D5A50;
              font-size: 22px;
              margin-top: 25px;
              margin-bottom: 15px;
              border-bottom: 1px solid #E8D5C4;
              padding-bottom: 8px;
            }
            h3 {
              color: #7D5A50;
              font-size: 18px;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            p {
              margin: 12px 0;
              font-size: 16px;
            }
            .section {
              margin-bottom: 25px;
            }
            .item {
              margin-bottom: 8px;
            }
            .item-label {
              font-weight: bold;
              color: #5D4037;
            }
            .item-value {
              margin-left: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 14px;
              color: #7D5A50;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Mein Geburtsplan</h1>
              <p>Erstellt am ${new Date().toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
            </div>

            <div class="content">
              ${formatContentForHTML(content)}
            </div>

            <div class="footer">
              <p>Dieser Geburtsplan wurde mit der Wehen-Tracker App erstellt.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Generiere das PDF mit expo-print
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Teile die PDF-Datei
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Geburtsplan als PDF speichern',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Teilen nicht verfügbar', 'Das Teilen von Dateien wird auf diesem Gerät nicht unterstützt.');
      }

    } catch (error) {
      console.error('Fehler beim Generieren des PDFs:', error);
      Alert.alert('Fehler', 'Der Geburtsplan konnte nicht als PDF gespeichert werden.');
    } finally {
      setIsGeneratingPDF(false);
    }
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

    <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* Zurück-Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/(tabs)/countdown')}
          >
            <View style={styles.backButtonInner}>
              <IconSymbol name="arrow.left" size={20} color="#FFFFFF" />
              <ThemedText style={styles.backButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                Zurück
              </ThemedText>
            </View>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>
            Mein Geburtsplan
          </ThemedText>

          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.cardText}>
              Hier kannst du deinen persönlichen Geburtsplan erstellen und speichern.
              Notiere deine Wünsche und Vorstellungen für die Geburt, damit du sie mit deinem
              Geburtsteam teilen kannst.
            </ThemedText>
          </ThemedView>

          {/* Editor-Umschalter */}
          <ThemedView style={styles.switchContainer} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.switchLabel}>
              Strukturierter Editor
            </ThemedText>
            <Switch
              value={useStructuredEditor}
              onValueChange={setUseStructuredEditor}
              trackColor={{ false: '#767577', true: theme.accent }}
              thumbColor={useStructuredEditor ? '#f4f3f4' : '#f4f3f4'}
            />
          </ThemedView>

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
              />

              <GeburtsWuenscheSection
                data={structuredData.geburtsWuensche}
                onChange={(newData) => setStructuredData({
                  ...structuredData,
                  geburtsWuensche: newData
                })}
              />

              <MedizinischeEingriffeSection
                data={structuredData.medizinischeEingriffe}
                onChange={(newData) => setStructuredData({
                  ...structuredData,
                  medizinischeEingriffe: newData
                })}
              />

              <NachDerGeburtSection
                data={structuredData.nachDerGeburt}
                onChange={(newData) => setStructuredData({
                  ...structuredData,
                  nachDerGeburt: newData
                })}
              />

              <NotfallSection
                data={structuredData.notfall}
                onChange={(newData) => setStructuredData({
                  ...structuredData,
                  notfall: newData
                })}
              />

              <SonstigeWuenscheSection
                data={structuredData.sonstigeWuensche}
                onChange={(newData) => setStructuredData({
                  ...structuredData,
                  sonstigeWuensche: newData
                })}
              />
            </>
          ) : (
            // Einfacher Texteditor
            <ThemedView style={styles.textAreaContainer} lightColor={theme.card} darkColor={theme.card}>
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
            </ThemedView>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.accent }]}
              onPress={handleSaveGeburtsplan}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.saveButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                  Geburtsplan speichern
                </ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: theme.success }]}
              onPress={handleGeneratePDF}
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.downloadButtonInner}>
                  <IconSymbol name="arrow.down.doc" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.downloadButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                    Als PDF herunterladen
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <ThemedView style={styles.tipsCard} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText type="defaultSemiBold" style={styles.tipsTitle}>
              Tipps für deinen Geburtsplan:
            </ThemedText>
            <ThemedText style={styles.tipText}>• Gebärposition: Welche Positionen bevorzugst du?</ThemedText>
            <ThemedText style={styles.tipText}>• Schmerzlinderung: Welche Methoden möchtest du nutzen?</ThemedText>
            <ThemedText style={styles.tipText}>• Atmosphäre: Musik, Licht, Anwesende Personen</ThemedText>
            <ThemedText style={styles.tipText}>• Medizinische Eingriffe: Welche akzeptierst du, welche nicht?</ThemedText>
            <ThemedText style={styles.tipText}>• Nach der Geburt: Wünsche für die ersten Stunden mit deinem Baby</ThemedText>
          </ThemedView>
        </ScrollView>
        </SafeAreaView>
      </ImageBackground>

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
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginVertical: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  backButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  card: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardText: {
    fontSize: 16,
    lineHeight: 24,
  },
  // Switch-Container für den Editor-Umschalter
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  textAreaContainer: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 300,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  saveButton: {
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadButton: {
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tipsCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipsTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  tipText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 5,
  },
  loader: {
    marginVertical: 30,
  },
});
