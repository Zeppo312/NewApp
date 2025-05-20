import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, ImageBackground, SafeAreaView, StatusBar, Text, Alert, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase, updateDueDateAndSync } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function PregnancyStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { user } = useAuth();

  // Schwangerschaftsdaten
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    daysLeft: 0,
    currentWeek: 0,
    currentDay: 0,
    progress: 0,
    trimester: '',
    daysPregnant: 0,
    calendarMonth: 0,
    pregnancyMonth: 0
  });
  const [tempDate, setTempDate] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      loadDueDate();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (dueDate) {
      calculateStats();
    }
  }, [dueDate]);

  const loadDueDate = async () => {
    try {
      setIsLoading(true);
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

  const calculateStats = () => {
    if (!dueDate) return;

    // Aktuelles Datum ohne Uhrzeit (nur Tag)
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Geburtstermin ohne Uhrzeit (nur Tag)
    const dueDateCopy = new Date(dueDate);
    dueDateCopy.setHours(0, 0, 0, 0);

    // Berechne die Differenz in Millisekunden
    const difference = dueDateCopy.getTime() - now.getTime();

    // Berechne die Tage bis zum Geburtstermin (immer ganze Tage)
    const days = Math.round(difference / (1000 * 60 * 60 * 24));

    // Schwangerschaft dauert ca. 40 Wochen
    const totalDaysInPregnancy = 280; // 40 Wochen * 7 Tage

    // Berechne die Tage der Schwangerschaft
    const daysRemaining = Math.max(0, days);
    const daysPregnant = totalDaysInPregnancy - daysRemaining;

    // Berechne SSW und Tag
    // weeksPregnant ist die Anzahl der vollständig abgeschlossenen Wochen
    const weeksPregnant = Math.floor(daysPregnant / 7);
    // daysInCurrentWeek ist die Anzahl der Tage in der aktuellen Woche (0-6)
    const daysInCurrentWeek = daysPregnant % 7;

    // currentWeek ist die aktuelle Schwangerschaftswoche (1-basiert)
    // Wenn du 37+3 bist, bedeutet das, du bist in der 38. SSW
    const currentWeek = weeksPregnant + 1;

    // Berechne den Fortschritt (0-1)
    const progress = Math.min(1, Math.max(0, daysPregnant / totalDaysInPregnancy));

    // Berechne das Trimester basierend auf der aktuellen SSW (1-basiert)
    let trimester = '';
    if (currentWeek <= 13) {
      trimester = '1. Trimester';
    } else if (currentWeek <= 27) {
      trimester = '2. Trimester';
    } else {
      trimester = '3. Trimester';
    }

    // Berechne den Kalendermonat
    const calendarMonth = Math.ceil(daysPregnant / 30);

    // Berechne den Schwangerschaftsmonat (jeweils 4 Wochen)
    // Basierend auf der aktuellen SSW (1-basiert)
    const pregnancyMonth = Math.ceil(currentWeek / 4);

    setStats({
      daysLeft: daysRemaining,
      currentWeek: currentWeek, // Verwende die korrekte SSW (1-basiert)
      currentDay: daysInCurrentWeek,
      progress,
      trimester,
      daysPregnant,
      calendarMonth,
      pregnancyMonth
    });
  };

  const saveDueDate = async (date: Date) => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deinen Geburtstermin zu speichern.');
        return;
      }

      // Verwenden der Funktion zum Aktualisieren des Entbindungstermins und Synchronisieren
      const result = await updateDueDateAndSync(user.id, date);

      if (!result.success) {
        console.error('Error saving due date:', result.error);
        Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
        return;
      }

      // Aktualisieren des lokalen Zustands
      setDueDate(date);

      // Erfolgreiche Speicherung mit Erfolgsmeldung
      console.log(`Geburtstermin erfolgreich gespeichert: ${date.toLocaleDateString()}`);
      
      // Prüfen, ob Benutzer synchronisiert wurden
      const syncedUsers = result.syncResult?.linkedUsers || [];

      if (syncedUsers.length > 0) {
        const linkedUserNames = syncedUsers
          .map((user: any) => user.firstName)
          .join(', ');

        Alert.alert(
          'Erfolg',
          `Dein Geburtstermin wurde erfolgreich gespeichert und mit ${linkedUserNames} synchronisiert.`
        );
      } else {
        Alert.alert('Erfolg', 'Dein Geburtstermin wurde erfolgreich gespeichert.');
      }

      // Stats neu berechnen
      calculateStats();
    } catch (err) {
      console.error('Failed to save due date:', err);
      Alert.alert('Fehler', 'Der Geburtstermin konnte nicht gespeichert werden.');
    }
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) {
        saveDueDate(selectedDate);
      }
    } else {
      // Auf iOS speichern wir das Datum temporär und warten auf die Bestätigung
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const confirmIOSDate = () => {
    if (tempDate) {
      saveDueDate(tempDate);
    }
    setShowDatePicker(false);
  };

  const showDatepicker = () => {
    if (Platform.OS === 'ios') {
      // Aktuellen Geburtstermin als Ausgangswert setzen
      setTempDate(dueDate || new Date());
      setShowDatePicker(true);
    } else {
      // Auf Android direkt den Picker anzeigen
      setShowDatePicker(true);
    }
  };

  // Teilen-Funktionalität wurde entfernt

  if (!dueDate) {
    return (
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="repeat"
      >
        <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color="#7D5A50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meine Schwangerschaft</Text>
          <View style={styles.headerRight} />
        </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>

            <View style={[styles.statsCard, { padding: 25 }]}>
              <View style={{ alignItems: 'center' }}>
                <IconSymbol name="exclamationmark.circle" size={50} color="#E8B7A9" style={{ marginBottom: 15 }} />
                <Text style={styles.noDateText}>
                  Bitte setze zuerst deinen Geburtstermin in der Countdown-Ansicht.
                </Text>
                <TouchableOpacity
                  style={[styles.shareButton, { marginTop: 20 }]}
                  onPress={() => router.push('/countdown')}
                >
                  <View style={[styles.shareButtonInner, { backgroundColor: '#E8B7A9' }]}>
                    <IconSymbol name="calendar" size={20} color="#FFFFFF" />
                    <Text style={[styles.shareButtonText, { color: '#FFFFFF' }]}>
                      Zum Countdown
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('@/assets/images/Background_Hell.png')}
      style={styles.backgroundImage}
      resizeMode="repeat"
    >
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        {/* Modal für iOS DatePicker */}
        {Platform.OS === 'ios' && showDatePicker && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={showDatePicker}
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Geburtstermin auswählen</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <IconSymbol name="xmark.circle.fill" size={28} color="#7D5A50" style={{opacity: 0.8}} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={tempDate || dueDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    maximumDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 280)} // ca. 40 Wochen
                    style={styles.datePicker}
                    textColor="#333333"
                  />
                </View>
                
                <TouchableOpacity 
                  style={styles.confirmButton}
                  onPress={confirmIOSDate}
                >
                  <Text style={styles.confirmButtonText}>Bestätigen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="xmark" size={24} color="#7D5A50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meine Schwangerschaft</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <View style={styles.progressSection}>
            <View style={styles.progressCircleContainer}>
              <Svg height="200" width="200" viewBox="0 0 100 100">
                {/* Hintergrundkreis */}
                <Circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="#E8D5C4"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Fortschrittskreis */}
                <Path
                  d={`
                    M 50 5
                    A 45 45 0 ${stats.progress > 0.5 ? 1 : 0} 1 ${50 + 45 * Math.sin(2 * Math.PI * stats.progress)} ${50 - 45 * Math.cos(2 * Math.PI * stats.progress)}
                  `}
                  stroke="#7D5A50"
                  strokeWidth="8"
                  fill="transparent"
                  strokeLinecap="round"
                />
                {/* Prozentanzeige in der Mitte */}
                <G>
                  <SvgText
                    x="50"
                    y="45"
                    fontSize="16"
                    textAnchor="middle"
                    fill="#5D4037"
                    fontWeight="bold"
                  >
                    {(stats.progress * 100).toFixed(1).replace('.', ',')}
                  </SvgText>
                  <SvgText
                    x="50"
                    y="65"
                    fontSize="16"
                    textAnchor="middle"
                    fill="#5D4037"
                  >
                    %
                  </SvgText>
                </G>
              </Svg>
            </View>
            <Text style={styles.progressText}>
              der Schwangerschaft liegen hinter Ihnen
            </Text>
            <Text style={styles.progressDays}>
              ({stats.daysPregnant} von 280 Tagen)
            </Text>

            <View style={styles.heartsContainer}>
              {Array(10).fill(0).map((_, i) => (
                <IconSymbol
                  key={i}
                  name={i < Math.floor(stats.progress * 10) ? "heart.fill" : "heart"}
                  size={24}
                  color="#7D5A50"
                />
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={styles.statsSection} 
            onPress={showDatepicker}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>ERRECHNETER GEBURTSTERMIN</Text>
            <View style={styles.dueDateContainer}>
              <IconSymbol name="calendar" size={22} color="#7D5A50" style={{ marginRight: 12 }} />
            <Text style={styles.dueDateValue}>
                {dueDate.toLocaleDateString('de-DE', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: '2-digit' 
                })}
            </Text>
          </View>
            <View style={styles.editHintContainer}>
              <IconSymbol name="pencil" size={14} color="#7D5A50" style={{ marginRight: 5, opacity: 0.7 }} />
              <Text style={styles.editHint}>Tippen zum Ändern</Text>
            </View>
          </TouchableOpacity>

          {/* DatePicker nur für Android direkt im Screen */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()}
              maximumDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 280)} // ca. 40 Wochen
            />
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>WOCHE</Text>
              <Text style={styles.statValue}>{stats.currentWeek}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>ICH BIN SCHWANGER SEIT</Text>
              <Text style={styles.statValue}>{stats.currentWeek-1} W + {stats.currentDay} T</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>TRIMESTER</Text>
              <Text style={styles.statValue}>{stats.trimester.charAt(0)}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>KALENDERMONAT</Text>
              <Text style={styles.statValue}>{stats.calendarMonth}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>SCHWANGERSCHAFTS-MONAT</Text>
              <Text style={styles.statValue}>{stats.pregnancyMonth}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>VERBLEIBENDE TAGE BIS ZUM EGT</Text>
              <Text style={styles.statValue}>{stats.daysLeft}</Text>
            </View>
          </View>

          {/* Truhe und Frucht-Link wurden entfernt */}

          {/* Teilen-Button wurde entfernt */}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Nicht mehr benötigte Styles wurden entfernt
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7D5A50',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  progressSection: {
    backgroundColor: '#F7EFE5',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    width: '100%',
  },
  progressCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  progressPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5D4037',
    textAlign: 'center',
    marginVertical: 10,
  },
  percentSymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5D4037',
  },
  progressText: {
    fontSize: 16,
    color: '#7D5A50',
    textAlign: 'center',
    marginBottom: 5,
  },
  progressDays: {
    fontSize: 14,
    color: '#7D5A50',
    marginBottom: 15,
  },
  heartsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  statsSection: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#F7EFE5',
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.1)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 12,
    letterSpacing: 1,
  },
  dueDateValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#5D4037',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsCard: {
    width: '48%',
    padding: 15,
    borderRadius: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    backgroundColor: '#F7EFE5',
  },
  statTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7D5A50',
    textAlign: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5D4037',
    textAlign: 'center',
  },
  // Truhe und Frucht-Link Stile wurden entfernt
  shareButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  shareButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
    backgroundColor: '#F7EFE5',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7D5A50',
  },
  noDateText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#7D5A50',
  },
  // SVG-Stile wurden entfernt, da sie nicht mehr benötigt werden
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editHint: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#7D5A50',
    marginTop: 5,
    opacity: 0.8,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 15,
    shadowColor: '#7D5A50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  editHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalView: {
    backgroundColor: '#F8F4ED',
    padding: 20,
    borderRadius: 20,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.25)',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(125, 90, 80, 0.15)',
  },
  pickerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#7D5A50',
  },
  pickerContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 15,
    overflow: 'hidden',
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#E2D9D0',
  },
  datePicker: {
    width: '100%',
    height: 215,
  },
  confirmButton: {
    backgroundColor: '#7D5A50',
    padding: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 0.5,
  },
});
