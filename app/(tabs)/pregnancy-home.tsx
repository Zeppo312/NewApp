import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, Platform, ToastAndroid, Animated } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import CountdownTimer from '@/components/CountdownTimer';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, getDueDateWithLinkedUsers } from '@/lib/supabase';
import { pregnancyWeekInfo } from '@/constants/PregnancyWeekInfo';
import { pregnancyMotherInfo } from '@/constants/PregnancyMotherInfo';
import { pregnancyPartnerInfo } from '@/constants/PregnancyPartnerInfo';
import { pregnancySymptoms } from '@/constants/PregnancySymptoms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBabyStatus } from '@/contexts/BabyStatusContext';

// Tägliche Tipps für Schwangere
const dailyTips = [
  "Nimm dir heute 10 Minuten nur für dich – eine kleine Auszeit kann Wunder wirken!",
  "Trinke ausreichend Wasser – besonders wichtig für dich und dein Baby.",
  "Ein kurzer Spaziergang an der frischen Luft kann deine Stimmung heben.",
  "Bitte um Hilfe, wenn du sie brauchst – du musst nicht alles alleine schaffen.",
  "Achte auf gute Ernährung – sie ist die Basis für eine gesunde Schwangerschaft.",
  "Gönn dir ausreichend Schlaf – er ist wichtig für dich und dein Baby.",
  "Stress reduzieren – probiere Entspannungsübungen wie Schwangerschaftsyoga.",
  "Feiere jeden kleinen Fortschritt – dein Körper leistet Großartiges!",
  "Vertraue deinem Instinkt – du weißt, was gut für dich und dein Baby ist.",
  "Verbinde dich mit deinem Baby – sprich mit ihm oder höre gemeinsam Musik."
];

// AsyncStorage-Schlüssel
const LAST_POPUP_DATE_KEY = 'lastDueDatePopup';
const DEBUG_POPUP_COUNTER_KEY = 'debugPopupCounter';

// Definiere Typen für die verknüpften Benutzer
interface LinkedUser {
  firstName: string;
  id: string;
}

// Konstanten für Überfälligkeits-Informationen
const overdueInfo = {
  baby: "Dein Baby ist jetzt vollständig entwickelt. Die Plazenta versorgt es weiterhin mit allen notwendigen Nährstoffen. Die Verbindung zwischen euch beiden ist stärker denn je. Das Immunsystem deines Babys wird durch die Übertragung von Antikörpern über die Plazenta weiter gestärkt.",
  mother: "Viele Frauen empfinden diese Wartezeit als besonders anstrengend. Versuche dich abzulenken und nutze die Zeit für Entspannung. Bewegung kann helfen, den Geburtsprozess anzuregen. Achte auf Anzeichen für Wehen oder den Abgang des Mutterkuchens. Bei Unsicherheiten kontaktiere immer deine Hebamme oder deinen Arzt.",
  partner: "Deine Unterstützung ist jetzt besonders wichtig. Sei geduldig und verständnisvoll. Hilf beim Ablenken und sorge für Aktivitäten, die die Wartezeit verkürzen. Stelle sicher, dass alles für die Fahrt ins Krankenhaus bereit ist und ihr jederzeit los könnt.",
  symptoms: [
    "Harter, tiefer Bauch",
    "Verstärkter Ausfluss",
    "Zunehmender Druck im Becken",
    "Vorwehen (Übungswehen)",
    "Rückenschmerzen",
    "Verstärkte Müdigkeit",
    "Emotionale Anspannung"
  ]
};

export default function PregnancyHomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const { isBabyBorn, setIsBabyBorn } = useBabyStatus();

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [debugCounter, setDebugCounter] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  // Animation für Erfolgsmeldung
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  // Hilfsfunktion zur Protokollierung mit Zeitstempel
  const logWithTimestamp = (message: string) => {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString()}] ${message}`);
  };

  // Debug-Funktion: Popup-Zähler erhöhen
  const incrementDebugCounter = async () => {
    try {
      const currentCountStr = await AsyncStorage.getItem(DEBUG_POPUP_COUNTER_KEY) || '0';
      const currentCount = parseInt(currentCountStr, 10);
      const newCount = currentCount + 1;
      await AsyncStorage.setItem(DEBUG_POPUP_COUNTER_KEY, newCount.toString());
      setDebugCounter(newCount);
      logWithTimestamp(`Popup-Zähler erhöht auf: ${newCount}`);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Debug-Zählers:', error);
    }
  };

  // Debug-Funktion: AsyncStorage-Key löschen
  const clearLastPopupDate = async () => {
    try {
      await AsyncStorage.removeItem(LAST_POPUP_DATE_KEY);
      logWithTimestamp('Letztes Popup-Datum zurückgesetzt');
    } catch (error) {
      console.error('Fehler beim Zurücksetzen des letzten Popup-Datums:', error);
    }
  };

  // Debug: Zeige den aktuellen Status beim Laden an
  useEffect(() => {
    const loadDebugInfo = async () => {
      try {
        const countStr = await AsyncStorage.getItem(DEBUG_POPUP_COUNTER_KEY) || '0';
        setDebugCounter(parseInt(countStr, 10));
        
        const lastPopupDateStr = await AsyncStorage.getItem(LAST_POPUP_DATE_KEY);
        logWithTimestamp(`DEBUG INFO - Popup-Zähler: ${countStr}, Letztes Popup: ${lastPopupDateStr || 'nie'}`);
      } catch (error) {
        console.error('Fehler beim Laden der Debug-Informationen:', error);
      }
    };
    
    loadDebugInfo();
  }, []);

  // Debug-Funktion: Manuelles Anzeigen des Popups für Testzwecke
  const debugShowPopup = () => {
    showPastDueDateAlert();
  };

  // Überprüfen, ob das Fälligkeitsdatum überschritten ist und ggf. Popup anzeigen
  useEffect(() => {
    const checkPastDueDate = async () => {
      logWithTimestamp('Überprüfe, ob Entbindungstermin überschritten wurde...');
      
      if (!dueDate) {
        logWithTimestamp('Kein Entbindungstermin festgelegt');
        return;
      }
      
      if (!user) {
        logWithTimestamp('Kein Benutzer angemeldet');
        return;
      }
      
      if (isBabyBorn) {
        logWithTimestamp('Baby ist bereits geboren');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dueDateCopy = new Date(dueDate);
      dueDateCopy.setHours(0, 0, 0, 0);

      logWithTimestamp(`Heutiges Datum: ${today.toLocaleDateString()}`);
      logWithTimestamp(`Entbindungstermin: ${dueDateCopy.toLocaleDateString()}`);

      // Prüfen, ob der Entbindungstermin überschritten ist oder heute ist
      if (today.getTime() >= dueDateCopy.getTime()) {
        logWithTimestamp('Entbindungstermin ist heute oder wurde überschritten');

        // Prüfen, wann das letzte Popup gezeigt wurde
        const lastPopupDateStr = await AsyncStorage.getItem(LAST_POPUP_DATE_KEY);
        logWithTimestamp(`Letztes Popup-Datum: ${lastPopupDateStr || 'nie'}`);
        
        if (!lastPopupDateStr || new Date(lastPopupDateStr).toDateString() !== today.toDateString()) {
          logWithTimestamp('Zeige Popup an');
          
          // Speichern des heutigen Datums als letztes Popup-Datum
          await AsyncStorage.setItem(LAST_POPUP_DATE_KEY, today.toISOString());
          incrementDebugCounter();
          
          // Popup anzeigen
          showPastDueDateAlert();
        } else {
          logWithTimestamp('Popup wurde heute bereits angezeigt');
        }
      } else {
        logWithTimestamp('Entbindungstermin liegt in der Zukunft');
      }
    };

    // Verzögerung hinzufügen, um sicherzustellen, dass alles initialisiert ist
    const timer = setTimeout(() => {
      checkPastDueDate();
    }, 1000);

    return () => clearTimeout(timer);
  }, [dueDate, user, isBabyBorn]);

  const showPastDueDateAlert = () => {
    Alert.alert(
      "Entbindungstermin überschritten",
      "Dein Entbindungstermin ist bereits überschritten. Ist dein Baby schon geboren?",
      [
        {
          text: "Noch nicht geboren",
          style: "cancel"
        },
        {
          text: "Ja, mein Baby ist da!",
          onPress: handleBabyBorn
        }
      ]
    );
  };

  const getLinkedUsers = async (userId: string) => {
    try {
      const result = await getDueDateWithLinkedUsers(userId);
      return {
        success: result.success,
        linkedUsers: result.linkedUsers || [],
        error: result.error
      };
    } catch (error) {
      console.error('Error getting linked users:', error);
      return { success: false, linkedUsers: [], error };
    }
  };

  const handleBabyBorn = async () => {
    try {
      // Setzen des Baby-Status auf 'geboren'
      await setIsBabyBorn(true);

      // Prüfen, ob der Benutzer mit anderen Benutzern verknüpft ist
      const linkedUsersResult = await getLinkedUsers(user?.id || '');
      let syncMessage = '';

      if (linkedUsersResult.success && linkedUsersResult.linkedUsers && linkedUsersResult.linkedUsers.length > 0) {
        const linkedUserNames = linkedUsersResult.linkedUsers
          .map((user: LinkedUser) => user.firstName)
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
              // Navigation zum Baby-Dashboard
              router.replace('/(tabs)/baby');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Fehler beim Setzen des Baby-Status:', error);
      Alert.alert('Fehler', 'Es gab ein Problem bei der Aktualisierung des Status.');
    }
  };

  // Lädt Benutzerinformationen und aktualisiert die Anzeige
  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // Benutzername laden
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;
      if (profileData) {
        setUserName(profileData.first_name || '');
      }

      // Entbindungstermin laden
      const result = await getDueDateWithLinkedUsers(user?.id || '');

      if (result.success && result.dueDate) {
        const due = new Date(result.dueDate);
        setDueDate(due);

        // Berechne die aktuelle SSW
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Kopie des Entbindungstermins ohne Uhrzeit
        const dueDateCopy = new Date(due);
        dueDateCopy.setHours(0, 0, 0, 0);

        // Berechne die Differenz in Tagen
        const difference = dueDateCopy.getTime() - now.getTime();
        const daysLeft = Math.round(difference / (1000 * 60 * 60 * 24));

        // Schwangerschaft dauert ca. 40 Wochen = 280 Tage
        const totalDaysInPregnancy = 280;
        const daysRemaining = Math.max(0, daysLeft);
        const daysPregnant = totalDaysInPregnancy - daysRemaining;

        // Berechne SSW und Tag
        const weeksPregnant = Math.floor(daysPregnant / 7);
        const daysInCurrentWeek = daysPregnant % 7;

        // currentWeek ist die aktuelle Schwangerschaftswoche (1-basiert)
        const currentWeek = weeksPregnant + 1;

        setCurrentWeek(currentWeek);
        setCurrentDay(daysInCurrentWeek);
      } else {
        setDueDate(null);
        setCurrentWeek(null);
        setCurrentDay(null);
      }

    } catch (error) {
      console.error('Fehler beim Laden der Benutzerdaten:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Zeigt eine Erfolgsmeldung an, die nach einigen Sekunden ausblendet
  const showUpdateSuccess = () => {
    setUpdateSuccess(true);
    
    // Animation starten
    Animated.sequence([
      // Einblenden
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Warten
      Animated.delay(2000),
      // Ausblenden
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setUpdateSuccess(false);
    });
  };

  // Funktion zum Aktualisieren der Daten (Pull-to-Refresh)
  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      await loadUserData();
      
      // Plattformspezifisches Feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show('Daten aktualisiert', ToastAndroid.SHORT);
      } else {
        // iOS-Feedback (wird durch Animation angezeigt)
        showUpdateSuccess();
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        
        {/* Erfolgs-Animation für iOS */}
        {updateSuccess && (
          <Animated.View style={[styles.updateSuccessContainer, { opacity: fadeAnim }]}>
            <View style={styles.updateSuccessContent}>
              <IconSymbol name="checkmark.circle.fill" size={32} color="#7D5A50" />
              <ThemedText style={styles.updateSuccessText}>
                Daten aktualisiert
              </ThemedText>
            </View>
          </Animated.View>
        )}
        
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#7D5A50']} // Farbe für Android
              tintColor={colorScheme === 'dark' ? '#F8F0E5' : '#7D5A50'} // Farbe für iOS
              title={refreshing ? "Aktualisiere..." : "Zum Aktualisieren ziehen"} // Nur auf iOS sichtbar
              titleColor={colorScheme === 'dark' ? '#F8F0E5' : '#7D5A50'} // Farbe für den Text auf iOS
            />
          }
        >
          {/* Begrüßung */}
          <ThemedView style={styles.greetingContainer} lightColor={theme.card} darkColor={theme.card}>
            <View style={styles.greetingHeader}>
              <View>
                <ThemedText style={styles.greeting} lightColor="#7D5A50" darkColor="#7D5A50">
                  Hallo {userName ? userName : 'Mama'}!
                </ThemedText>
                <ThemedText style={styles.dateText} lightColor="#7D5A50" darkColor="#7D5A50">
                  {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </ThemedText>
              </View>

              {user && (
                <View style={styles.profileImage}>
                  <IconSymbol name="person.fill" size={30} color="#FFFFFF" />
                </View>
              )}
            </View>

            <ThemedView style={styles.tipContainer} lightColor="rgba(157, 190, 187, 0.3)" darkColor="rgba(157, 190, 187, 0.2)">
              <IconSymbol name="lightbulb.fill" size={20} color={Colors.light.success} />
              <ThemedText style={styles.tipText} lightColor="#7D5A50" darkColor="#7D5A50">
                {dailyTips[Math.floor(Math.random() * dailyTips.length)]}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* Debug-Panel (nur im Entwicklungsmodus sichtbar) */}
          {__DEV__ && (
            <ThemedView style={styles.debugCard} lightColor="#ffefdb" darkColor="#453531">
              <ThemedText style={styles.debugTitle} lightColor="#8b4513" darkColor="#f5deb3">
                Debug Info
              </ThemedText>
              <View style={{ marginBottom: 10 }}>
                <ThemedText style={styles.debugText} lightColor="#333" darkColor="#f0f0f0">
                  Popup-Zähler: {debugCounter}
                </ThemedText>
              </View>
              <View style={styles.debugButtonRow}>
                <TouchableOpacity 
                  style={[styles.debugButton, { backgroundColor: '#4caf50' }]} 
                  onPress={debugShowPopup}
                >
                  <ThemedText style={styles.debugButtonText} lightColor="#fff" darkColor="#fff">
                    Test Popup
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.debugButton, { backgroundColor: '#f44336' }]} 
                  onPress={clearLastPopupDate}
                >
                  <ThemedText style={styles.debugButtonText} lightColor="#fff" darkColor="#fff">
                    Reset Timer
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}

          {/* Schwangerschaftsübersicht (Ersetzt den großen Countdown) */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/countdown')}
            activeOpacity={0.8}
          >
            <ThemedView style={styles.summaryContainer} lightColor={theme.card} darkColor={theme.card}>
              <View style={styles.sectionTitleContainer}>
                <ThemedText style={styles.sectionTitle} lightColor="#7D5A50" darkColor="#7D5A50">
                  Dein Tag im Überblick
                </ThemedText>
                <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <IconSymbol name="calendar" size={24} color="#FF9800" />
                  <ThemedText style={styles.statValue}>{currentWeek || 0}</ThemedText>
                  <ThemedText style={styles.statLabel} lightColor="#7D5A50" darkColor="#7D5A50">SSW</ThemedText>
                </View>

                <View style={styles.statItem}>
                  <IconSymbol name="number.square.fill" size={24} color="#4CAF50" />
                  <ThemedText style={styles.statValue}>
                    {currentWeek && currentWeek <= 13 
                      ? "1" 
                      : currentWeek && currentWeek <= 26 
                        ? "2" 
                        : "3"}
                  </ThemedText>
                  <ThemedText style={styles.statLabel} lightColor="#7D5A50" darkColor="#7D5A50">Trimester</ThemedText>
                </View>

                <View style={styles.statItem}>
                  <IconSymbol name="chart.pie.fill" size={24} color="#9DBEBB" />
                  <ThemedText style={styles.statValue}>
                    {currentWeek 
                      ? Math.min(100, Math.round((currentWeek / 40) * 100)) 
                      : 0}%
                  </ThemedText>
                  <ThemedText style={styles.statLabel} lightColor="#7D5A50" darkColor="#7D5A50">Fortschritt</ThemedText>
                </View>
              </View>
            </ThemedView>
          </TouchableOpacity>

          {/* Post-Pregnancy Preview Section */}
          <ThemedView style={styles.postPregnancyContainer} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.sectionTitle} lightColor="#7D5A50" darkColor="#7D5A50">Nach der Geburt</ThemedText>
            
            <View style={styles.postPregnancyContent}>
              <View style={styles.postPregnancyImageContainer}>
                <IconSymbol name="figure.and.child.holdinghands" size={60} color="#9DBEBB" />
              </View>
              
              <ThemedText style={styles.postPregnancyDescription} lightColor="#7D5A50" darkColor="#7D5A50">
                Lotti Baby begleitet dich auch nach der Schwangerschaft! Tracke die Entwicklung deines Babys, erstelle Meilensteine und behalte wichtige Termine im Blick.
              </ThemedText>
              
              <View style={styles.postPregnancyFeatures}>
                <View style={styles.postPregnancyFeatureItem}>
                  <IconSymbol name="chart.line.uptrend.xyaxis" size={22} color="#E9C9B6" />
                  <ThemedText style={styles.featureText} lightColor="#7D5A50" darkColor="#7D5A50">Wachstumstracker</ThemedText>
                </View>
                
                <View style={styles.postPregnancyFeatureItem}>
                  <IconSymbol name="calendar.badge.clock" size={22} color="#E9C9B6" />
                  <ThemedText style={styles.featureText} lightColor="#7D5A50" darkColor="#7D5A50">Schlafprotokolle</ThemedText>
                </View>
                
                <View style={styles.postPregnancyFeatureItem}>
                  <IconSymbol name="fork.knife" size={22} color="#E9C9B6" />
                  <ThemedText style={styles.featureText} lightColor="#7D5A50" darkColor="#7D5A50">Ernährungstagebuch</ThemedText>
                </View>
                
                <View style={styles.postPregnancyFeatureItem}>
                  <IconSymbol name="photo.on.rectangle.angled" size={22} color="#E9C9B6" />
                  <ThemedText style={styles.featureText} lightColor="#7D5A50" darkColor="#7D5A50">Meilenstein-Fotos</ThemedText>
                </View>
              </View>
            </View>
          </ThemedView>

          {/* Schnellzugriff-Buttons */}
          <View style={styles.cardsSection}>
            <ThemedText style={styles.sectionTitle} lightColor="#7D5A50" darkColor="#7D5A50">Schnellzugriff</ThemedText>

            <View style={styles.cardsGrid}>
              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(157, 190, 187, 0.9)' }]}
                onPress={() => router.push({ pathname: '/(tabs)/countdown' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="calendar" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">Countdown</ThemedText>
                <ThemedText style={styles.cardDescription} lightColor="#FFFFFF" darkColor="#FFFFFF">Dein Weg zur Geburt</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(233, 201, 182, 0.9)' }]}
                onPress={() => router.push({ pathname: '/(tabs)' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="timer" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">Wehen-Tracker</ThemedText>
                <ThemedText style={styles.cardDescription} lightColor="#FFFFFF" darkColor="#FFFFFF">Wehen messen und verfolgen</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(125, 90, 80, 0.7)' }]}
                onPress={() => router.push({ pathname: '/(tabs)/explore' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="checklist" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">Checkliste</ThemedText>
                <ThemedText style={styles.cardDescription} lightColor="#FFFFFF" darkColor="#FFFFFF">Kliniktasche vorbereiten</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(229, 115, 115, 0.7)' }]}
                onPress={() => router.push({ pathname: '/(tabs)/geburtsplan' })}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="doc.text.fill" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">Geburtsplan</ThemedText>
                <ThemedText style={styles.cardDescription} lightColor="#FFFFFF" darkColor="#FFFFFF">Wünsche für die Geburt</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(157, 190, 187, 0.9)' }]}
                onPress={() => router.push('/doctor-questions' as any)}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="questionmark.circle" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle}>Frauenarzt-Fragen</ThemedText>
                <ThemedText style={styles.cardDescription}>Fragen für den nächsten Termin</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.card, { backgroundColor: 'rgba(233, 201, 182, 0.9)' }]}
                onPress={() => router.push('/baby-names' as any)}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="person.text.rectangle" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, { fontSize: 15 }]} lightColor="#FFFFFF" darkColor="#FFFFFF">Babynamen</ThemedText>
                <ThemedText style={styles.cardDescription} lightColor="#FFFFFF" darkColor="#FFFFFF">Finde den perfekten Namen</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  greetingContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  greetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7D5A50',
    textAlign: 'left',
  },
  dateText: {
    fontSize: 14,
    color: '#7D5A50',
    textAlign: 'left',
  },
  profileImage: {
    width: 50, 
    height: 50,
    borderRadius: 25,
    backgroundColor: '#9DBEBB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  tipContainer: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(157, 190, 187, 0.3)',
  },
  tipText: {
    fontSize: 14,
    color: '#7D5A50',
  },
  countdownContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weeklyInfoContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#7D5A50',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 32,
  },
  symptomsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  symptomsList: {
    paddingLeft: 8,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  symptomText: {
    fontSize: 14,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#7D5A50',
  },
  cardsSection: {
    marginBottom: 16,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#7D5A50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7D5A50',
    textAlign: 'center',
  },
  debugCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 14,
    marginBottom: 10,
  },
  debugButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debugButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  updateSuccessContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingTop: 60,
  },
  updateSuccessContent: {
    backgroundColor: 'rgba(248, 240, 229, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 6,
  },
  updateSuccessText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7D5A50',
    marginLeft: 10,
  },
  overdueContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueTitle: {
    color: '#E57373',
  },
  overdueInfoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#E57373',
  },
  overdueInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overdueInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E57373',
    marginLeft: 8,
  },
  overdueInfoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  overdueButton: {
    backgroundColor: '#E57373',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  overdueButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  summaryContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#7D5A50',
  },
  postPregnancyContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#9DBEBB',
  },
  postPregnancyContent: {
    alignItems: 'center',
  },
  postPregnancyImageContainer: {
    marginBottom: 15,
  },
  postPregnancyDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 15,
  },
  postPregnancyFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  postPregnancyFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    backgroundColor: 'rgba(157, 190, 187, 0.15)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 12,
    marginLeft: 8,
    color: '#7D5A50',
    fontWeight: '500',
  },
});
