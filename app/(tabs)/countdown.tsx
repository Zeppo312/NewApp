import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, Platform, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import CountdownTimer from '@/components/CountdownTimer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase, hasGeburtsplan, getSyncedDueDate } from '@/lib/supabase';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { generateAndDownloadPDF } from '@/lib/geburtsplan-utils';
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
  const [babyIconBase64, setBabyIconBase64] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [syncedFrom, setSyncedFrom] = useState<{ firstName?: string } | null>(null);

  // Lade das Baby-Icon beim Start
  useEffect(() => {
    const loadBabyIcon = async () => {
      try {
        // Lade das Bild
        const asset = Asset.fromModule(require('@/assets/images/Baby_Icon.png'));
        await asset.downloadAsync();

        // Lese die Datei als Base64
        const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setBabyIconBase64(base64);
      } catch (error) {
        console.error('Fehler beim Laden des Baby-Icons:', error);
      }
    };

    loadBabyIcon();
  }, []);

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

  const loadDueDate = async () => {
    try {
      setIsLoading(true);

      // Versuchen, den synchronisierten Entbindungstermin zu laden
      // Diese Funktion gibt nur den aktuellen Termin zurück, ohne Synchronisierung
      const syncedResult = await getSyncedDueDate(user?.id || '');

      if (syncedResult.success) {
        console.log('Loaded due date:', syncedResult);

        if (syncedResult.dueDate) {
          setDueDate(new Date(syncedResult.dueDate));

          // Wenn der Termin von einem anderen Benutzer synchronisiert wurde
          if (syncedResult.syncedFrom) {
            setSyncedFrom(syncedResult.syncedFrom);
            console.log('Due date synced from:', syncedResult.syncedFrom);
          } else {
            // Wenn kein syncedFrom vorhanden ist, setzen wir es zurück
            setSyncedFrom(null);
          }
        } else {
          console.log('No due date found in result');
          setDueDate(null);
          setSyncedFrom(null);
        }
      } else {
        console.error('Error loading due date:', syncedResult.error);

        // Fallback auf lokalen Termin
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
          console.log('Loaded local due date:', new Date(data.due_date).toLocaleDateString());
          setDueDate(new Date(data.due_date));
          setSyncedFrom(null); // Kein synchronisierter Termin
        } else {
          console.log('No due date found for user:', user?.id);
          setDueDate(null);
          setSyncedFrom(null);
        }
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
        .select('id, is_baby_born')
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
            updated_at: new Date().toISOString(),
            // Wichtig: sync_in_progress auf false setzen, damit der Trigger funktioniert
            sync_in_progress: false
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
            is_baby_born: false, // Standardwert
            updated_at: new Date().toISOString(),
            sync_in_progress: false // Wichtig: sync_in_progress auf false setzen
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

        // Wenn der Benutzer mit anderen Benutzern verknüpft ist, zeigen wir eine entsprechende Meldung an
        const linkedUsersResult = await getLinkedUsers(user.id);
        if (linkedUsersResult.success && linkedUsersResult.linkedUsers && linkedUsersResult.linkedUsers.length > 0) {
          const linkedUserNames = linkedUsersResult.linkedUsers
            .map(user => user.firstName)
            .join(', ');

          Alert.alert(
            'Erfolg',
            `Dein Geburtstermin wurde erfolgreich gespeichert und mit ${linkedUserNames} synchronisiert.`
          );
        } else {
          Alert.alert('Erfolg', 'Dein Geburtstermin wurde erfolgreich gespeichert.');
        }

        // Setzen wir syncedFrom zurück, da wir jetzt der "Besitzer" des Termins sind
        setSyncedFrom(null);

        // Aktualisieren der Anzeige
        loadDueDate();
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

  // Funktion zum Herunterladen des Geburtsplans als PDF
  const handleDownloadPDF = async () => {
    if (!user) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtsplan als PDF zu speichern.');
      return;
    }

    // Verwende die ausgelagerte Funktion
    await generateAndDownloadPDF(babyIconBase64, setIsGeneratingPDF);
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
              // Setzen des Baby-Status auf 'geboren'
              await setIsBabyBorn(true);

              // Prüfen, ob der Benutzer mit anderen Benutzern verknüpft ist
              const linkedUsersResult = await getLinkedUsers(user?.id || '');
              let syncMessage = '';

              if (linkedUsersResult.success && linkedUsersResult.linkedUsers && linkedUsersResult.linkedUsers.length > 0) {
                const linkedUserNames = linkedUsersResult.linkedUsers
                  .map(user => user.firstName)
                  .join(', ');

                syncMessage = `\n\nDiese Information wurde auch mit ${linkedUserNames} geteilt.`;
              }

              // Erfolgsmeldung anzeigen
              Alert.alert(
                "Herzlichen Glückwunsch!",
                `Wir freuen uns mit dir über die Geburt deines Babys! 🎉${syncMessage}`,
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
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <ThemedText type="title" style={styles.title} lightColor="#5C4033" darkColor="#FFFFFF">
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText style={styles.cardTitle} lightColor="#5C4033" darkColor="#FFFFFF">
                Geburtstermin
              </ThemedText>

              {syncedFrom && syncedFrom.firstName && (
                <ThemedView style={styles.syncBadge} lightColor={theme.accent} darkColor={theme.accent}>
                  <ThemedText style={styles.syncBadgeText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                    Synchronisiert mit {syncedFrom.firstName}
                  </ThemedText>
                </ThemedView>
              )}
            </View>

            <View style={styles.dateContainer}>
              <ThemedText style={styles.dateText} lightColor="#333333" darkColor="#F8F0E5">
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
            <ThemedText style={styles.infoTitle} lightColor="#5C4033" darkColor="#FFFFFF">
              Geburtsplan
            </ThemedText>
            {/* Wenn kein Geburtsplan existiert, zeigen wir den Text an */}
            {!geburtsplanExists && (
              <ThemedText style={styles.infoText} lightColor="#333333" darkColor="#F8F0E5">
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

            {/* Download-Button, nur anzeigen wenn ein Geburtsplan existiert */}
            {geburtsplanExists && (
              <TouchableOpacity
                style={[styles.geburtsplanButton, { marginTop: 10 }]}
                onPress={handleDownloadPDF}
                disabled={isGeneratingPDF}
              >
                <ThemedView style={[styles.geburtsplanButtonInner, { backgroundColor: theme.success }]} lightColor={theme.success} darkColor={theme.success}>
                  {isGeneratingPDF ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconSymbol name="arrow.down.doc" size={20} color="#FFFFFF" />
                      <ThemedText style={[styles.geburtsplanButtonText, { marginLeft: 8 }]} lightColor="#FFFFFF" darkColor="#FFFFFF">
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
      </ThemedBackground>
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
  syncBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginLeft: 10,
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
