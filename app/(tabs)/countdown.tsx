import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, Platform, ImageBackground, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import CountdownTimer from '@/components/CountdownTimer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase, hasGeburtsplan, getGeburtsplan } from '@/lib/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';

export default function CountdownScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();
  const router = useRouter();

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [geburtsplanExists, setGeburtsplanExists] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  useEffect(() => {
    if (user) {
      loadDueDate();
      checkGeburtsplan();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const checkGeburtsplan = async () => {
    try {
      const { exists, error } = await hasGeburtsplan();
      if (error) {
        console.error('Error checking geburtsplan:', error);
      } else {
        setGeburtsplanExists(exists);
      }
    } catch (err) {
      console.error('Failed to check geburtsplan:', err);
    }
  };

  // Funktion zum Herunterladen des Geburtsplans als PDF
  const handleDownloadGeburtsplan = async () => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtsplan herunterzuladen.');
      return;
    }

    try {
      setIsDownloadingPDF(true);

      // Geburtsplan laden
      const { data, error } = await getGeburtsplan();

      if (error) {
        console.error('Error loading geburtsplan:', error);
        Alert.alert('Fehler', 'Der Geburtsplan konnte nicht geladen werden.');
        return;
      }

      if (!data) {
        Alert.alert('Hinweis', 'Es wurde noch kein Geburtsplan erstellt.');
        return;
      }

      // Generiere den Inhalt für das PDF
      let content = '';

      if (data.structured_data) {
        // Wenn strukturierte Daten vorhanden sind, verwenden wir den gespeicherten Textinhalt
        content = data.textContent || data.content || '';
      } else {
        // Ansonsten verwenden wir den einfachen Textinhalt
        content = data.content || '';
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
              margin: 1.5cm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              line-height: 1.4;
              margin: 0;
              padding: 0;
              color: #333;
              background-color: #FFF8F0;
              font-size: 10pt;
            }
            .container {
              max-width: 100%;
              margin: 0 auto;
              background-color: white;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1px solid #E8D5C4;
            }
            h1 {
              color: #7D5A50;
              font-size: 18pt;
              margin: 0 0 5px 0;
            }
            h2 {
              color: #7D5A50;
              font-size: 12pt;
              margin: 10px 0 5px 0;
              border-bottom: 1px solid #E8D5C4;
              padding-bottom: 3px;
            }
            h3 {
              color: #7D5A50;
              font-size: 11pt;
              margin: 8px 0 4px 0;
            }
            p {
              margin: 4px 0;
            }
            .columns {
              display: flex;
              flex-direction: row;
              justify-content: space-between;
              gap: 20px;
            }
            .column {
              width: 48%;
            }
            .section {
              margin-bottom: 10px;
            }
            .item {
              margin-bottom: 4px;
            }
            .item-label {
              font-weight: bold;
              color: #5D4037;
            }
            .item-value {
              margin-left: 3px;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              font-size: 9pt;
              color: #7D5A50;
              font-style: italic;
              border-top: 1px solid #E8D5C4;
              padding-top: 10px;
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
              ${content.replace(/\n/g, '<br>').replace(/^# (.*)$/gm, '<h1>$1</h1>').replace(/^## (.*)$/gm, '<h2>$2</h2>')}
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
      setIsDownloadingPDF(false);
    }
  };



  const loadDueDate = async () => {
    try {
      setIsLoading(true);
      // Wir holen den neuesten Eintrag, sortiert nach dem Aktualisierungsdatum
      const { data, error } = await supabase
        .from('user_settings')
        .select('due_date')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading due date:', error);
      } else if (data && data.due_date) {
        console.log('Loaded due date:', new Date(data.due_date).toLocaleDateString());
        setDueDate(new Date(data.due_date));
      } else {
        console.log('No due date found for user:', user?.id);
      }
    } catch (err) {
      console.error('Failed to load due date:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDueDate = async (date: Date) => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtstermin zu speichern.');
        return;
      }

      // Zuerst prüfen, ob bereits ein Eintrag existiert
      const { data: existingData, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing settings:', fetchError);
        Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
        return;
      }

      let result;

      if (existingData && existingData.id) {
        // Wenn ein Eintrag existiert, aktualisieren wir diesen
        console.log('Updating existing due date for user:', user.id);
        result = await supabase
          .from('user_settings')
          .update({
            due_date: date.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id);
      } else {
        // Wenn kein Eintrag existiert, erstellen wir einen neuen
        console.log('Creating new due date for user:', user.id);
        result = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            due_date: date.toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      const { error } = result;

      if (error) {
        console.error('Error saving due date:', error);
        Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
      } else {
        setDueDate(date);
        // Erfolgreiche Speicherung mit Erfolgsmeldung
        console.log('Geburtstermin erfolgreich gespeichert:', date.toLocaleDateString());
        Alert.alert('Erfolg', 'Dein Geburtstermin wurde erfolgreich gespeichert.');
      }
    } catch (err) {
      console.error('Failed to save due date:', err);
      Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
    }
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      saveDueDate(selectedDate);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const handleBabyBorn = async () => {
    try {
      Alert.alert(
        "Herzlichen Glückwunsch!",
        "Ist dein Baby geboren?",
        [
          {
            text: "Abbrechen",
            style: "cancel"
          },
          {
            text: "Ja, mein Baby ist da!",
            onPress: async () => {
              await setIsBabyBorn(true);

              // Erfolgsmeldung anzeigen
              Alert.alert(
                "Herzlichen Glückwunsch!",
                "Wir freuen uns mit dir über die Geburt deines Babys! 🎉",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // Nach der Bestätigung zur Baby-Seite navigieren
                      router.replace("/baby");
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error setting baby born status:', error);
      Alert.alert("Fehler", "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.");
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
          <ThemedText type="title" style={styles.title}>
            Countdown zur Geburt
          </ThemedText>

          <CountdownTimer dueDate={dueDate} />

          <TouchableOpacity
            style={styles.babyBornButton}
            onPress={handleBabyBorn}
          >
            <ThemedView style={styles.babyBornButtonInner} lightColor={theme.accent} darkColor={theme.accent}>
              <ThemedText style={styles.babyBornButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                Ich bin da! 👶
              </ThemedText>
            </ThemedView>
          </TouchableOpacity>

          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.cardTitle}>
              Geburtstermin
            </ThemedText>

            <View style={styles.dateContainer}>
              <ThemedText style={styles.dateText}>
                {dueDate
                  ? dueDate.toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })
                  : 'Nicht festgelegt'}
              </ThemedText>

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.accent }]}
                onPress={showDatepicker}
              >
                <IconSymbol name="calendar" size={20} color="#FFFFFF" />
                <ThemedText style={styles.dateButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                  {dueDate ? 'Ändern' : 'Festlegen'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
                maximumDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 280)} // ca. 40 Wochen
              />
            )}
          </ThemedView>

          <ThemedView style={styles.infoCard} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.infoTitle}>
              Geburtsplan
            </ThemedText>
            {!geburtsplanExists && (
              <ThemedText style={styles.infoText}>
                Hast du schon deinen Geburtsplan erstellt? Ein durchdachter Plan kann dir helfen, besser vorbereitet in den Kreißsaal zu gehen. Erstelle jetzt deinen individuellen Geburtsplan mit deinen Wünschen und Vorstellungen für die Geburt.
              </ThemedText>
            )}

            <TouchableOpacity
              style={styles.geburtsplanButton}
              onPress={() => router.push('/(tabs)/geburtsplan')}
            >
              <ThemedView style={styles.geburtsplanButtonInner} lightColor={theme.accent} darkColor={theme.accent}>
                <ThemedText style={styles.geburtsplanButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                  {geburtsplanExists ? 'Geburtsplan bearbeiten' : 'Geburtsplan erstellen'}
                </ThemedText>
              </ThemedView>
            </TouchableOpacity>

            {geburtsplanExists && (
              <TouchableOpacity
                style={[styles.geburtsplanButton, { marginTop: 10 }]}
                onPress={handleDownloadGeburtsplan}
                disabled={isDownloadingPDF}
              >
                <ThemedView style={[styles.geburtsplanButtonInner, { backgroundColor: theme.success }]} lightColor={theme.success} darkColor={theme.success}>
                  {isDownloadingPDF ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.downloadButtonInner}>
                      <IconSymbol name="arrow.down.doc" size={20} color="#FFFFFF" />
                      <ThemedText style={styles.geburtsplanButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                        Als PDF herunterladen
                      </ThemedText>
                    </View>
                  )}
                </ThemedView>
              </TouchableOpacity>
            )}
          </ThemedView>
        </ScrollView>
        </SafeAreaView>
      </ImageBackground>

  );
}

const styles = StyleSheet.create({
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
  babyBornButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  babyBornButtonInner: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  babyBornButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
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
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  dateButtonText: {
    marginLeft: 5,
    fontWeight: 'bold',
  },
  infoCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  geburtsplanButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  geburtsplanButtonInner: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  geburtsplanButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
