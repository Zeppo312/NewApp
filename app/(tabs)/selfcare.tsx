import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, StatusBar, FlatList, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import { LAYOUT_PAD, SECTION_GAP_TOP, RADIUS } from '@/constants/DesignGuide';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;

// Typen für die Stimmungen
type MoodType = 'great' | 'good' | 'okay' | 'bad' | 'awful';

// Typen für die Selfcare-Einträge
interface SelfcareEntry {
  id?: string;
  user_id?: string;
  date?: string;
  mood?: MoodType;
  journal_entry?: string;
  sleep_hours?: number;
  water_intake?: number;
  exercise_done?: boolean;
  selfcare_activities?: string[];
  created_at?: string;
}

// Selfcare-Tipps
const selfcareTips = [
  "Gönn dir 10 Minuten Meditation.",
  "Ein kurzer Spaziergang an der frischen Luft tut immer gut!",
  "Trinke ein Glas Wasser, atme tief durch und entspanne dich.",
  "Nimm dir Zeit für ein warmes Bad oder eine entspannende Dusche.",
  "Höre deine Lieblingsmusik und tanze für ein paar Minuten.",
  "Mache eine kurze Pause und genieße eine Tasse Tee.",
  "Strecke und dehne deinen Körper für 5 Minuten.",
  "Rufe eine Freundin an, die dir gut tut.",
  "Schreibe drei Dinge auf, für die du heute dankbar bist.",
  "Lege dich für 15 Minuten hin und schließe die Augen."
];

// Rückbildungsübungen
const postpartumExercises = [
  {
    title: "Beckenbodenübung",
    description: "Spanne deinen Beckenboden an, als würdest du versuchen, den Urinfluss zu stoppen. Halte für 5 Sekunden und entspanne dann. Wiederhole 10 Mal."
  },
  {
    title: "Sanfte Bauchmuskelübung",
    description: "Lege dich auf den Rücken, Knie gebeugt. Atme aus und ziehe den Bauchnabel sanft zur Wirbelsäule. Halte für 5 Sekunden und entspanne. Wiederhole 5-10 Mal."
  },
  {
    title: "Schulter-Entspannung",
    description: "Kreise deine Schultern langsam nach hinten, 5 Mal. Dann kreise sie langsam nach vorne, 5 Mal. Spüre, wie sich die Spannung löst."
  },
  {
    title: "Sanfte Rückenstreckung",
    description: "Stehe aufrecht, Füße hüftbreit auseinander. Hebe die Arme über den Kopf und strecke dich sanft. Halte für 10 Sekunden und entspanne."
  }
];

// Selfcare-Aktivitäten für die Checkliste
const selfcareActivities = [
  { id: '1', title: 'Dusche/Bad genommen' },
  { id: '2', title: 'Gesichtspflege gemacht' },
  { id: '3', title: 'Mindestens 2L Wasser getrunken' },
  { id: '4', title: 'Kurze Pause gemacht' },
  { id: '5', title: 'Gesund gegessen' },
  { id: '6', title: 'Kurze Bewegung/Spaziergang' },
  { id: '7', title: 'Rückbildungsübung gemacht' },
  { id: '8', title: 'Mit jemandem gesprochen' }
];

export default function SelfcareScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  
  // Set fallback route for smart back navigation
  useSmartBack('/(tabs)/home');
  const router = useRouter();

  const [userName, setUserName] = useState<string>('');
  const [currentMood, setCurrentMood] = useState<MoodType | null>(null);
  const [journalEntry, setJournalEntry] = useState('');
  const [sleepHours, setSleepHours] = useState<number>(7);
  const [waterIntake, setWaterIntake] = useState<number>(0);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [dailyTip, setDailyTip] = useState('');
  const [checkedActivities, setCheckedActivities] = useState<string[]>([]);
  const [todayEntry, setTodayEntry] = useState<SelfcareEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Lade Benutzerdaten und heutigen Eintrag
  useEffect(() => {
    if (user) {
      loadUserData();
      loadTodayEntry();
      // Setze einen zufälligen Tipp für den Tag
      setDailyTip(selfcareTips[Math.floor(Math.random() * selfcareTips.length)]);
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Lade Benutzerdaten
  const loadUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('Error loading user data:', error);
      } else if (data) {
        setUserName(data.first_name || '');
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  };

  // Lade den heutigen Eintrag
  const loadTodayEntry = async () => {
    try {
      setIsLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('selfcare_entries')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', today.toISOString())
        .lt('date', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (error) {
        console.error('Error loading today entry:', error);
      } else if (data) {
        setTodayEntry(data);
        setCurrentMood(data.mood as MoodType || null);
        setJournalEntry(data.journal_entry || '');
        setSleepHours(data.sleep_hours || 7);
        setWaterIntake(data.water_intake || 0);
        setExerciseDone(data.exercise_done || false);
        setCheckedActivities(data.selfcare_activities || []);
      }
    } catch (err) {
      console.error('Failed to load today entry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Speichere den Eintrag
  const saveEntry = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deine Daten zu speichern.');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const entryData: SelfcareEntry = {
        user_id: user.id,
        date: today.toISOString(),
        mood: currentMood || undefined,
        journal_entry: journalEntry,
        sleep_hours: sleepHours,
        water_intake: waterIntake,
        exercise_done: exerciseDone,
        selfcare_activities: checkedActivities
      };

      let result;

      if (todayEntry?.id) {
        // Update existing entry
        result = await supabase
          .from('selfcare_entries')
          .update(entryData)
          .eq('id', todayEntry.id);
      } else {
        // Create new entry
        result = await supabase
          .from('selfcare_entries')
          .insert(entryData);
      }

      if (result.error) {
        console.error('Error saving entry:', result.error);
        Alert.alert('Fehler', 'Deine Daten konnten nicht gespeichert werden.');
      } else {
        Alert.alert('Erfolg', 'Deine Selfcare-Daten wurden gespeichert!');
        loadTodayEntry(); // Lade den aktualisierten Eintrag
      }
    } catch (err) {
      console.error('Failed to save entry:', err);
      Alert.alert('Fehler', 'Deine Daten konnten nicht gespeichert werden.');
    }
  };

  // Stimmungs-Emoji basierend auf der Stimmung
  const getMoodEmoji = (mood: MoodType | null) => {
    switch (mood) {
      case 'great': return '😃';
      case 'good': return '🙂';
      case 'okay': return '😐';
      case 'bad': return '😔';
      case 'awful': return '😢';
      default: return '❓';
    }
  };

  // Feedback-Text basierend auf der Stimmung
  const getMoodFeedback = (mood: MoodType | null) => {
    switch (mood) {
      case 'great': return 'Super! Du machst das großartig!';
      case 'good': return 'Schön zu hören! Weiter so!';
      case 'okay': return 'Ein normaler Tag. Denk an kleine Freuden!';
      case 'bad': return 'Heute ist ein schwieriger Tag – du schaffst das!';
      case 'awful': return 'Es ist okay, nicht okay zu sein. Sei lieb zu dir selbst.';
      default: return 'Wie fühlst du dich heute?';
    }
  };

  // Toggle für Selfcare-Aktivitäten
  const toggleActivity = (id: string) => {
    if (checkedActivities.includes(id)) {
      setCheckedActivities(checkedActivities.filter(actId => actId !== id));
    } else {
      setCheckedActivities([...checkedActivities, id]);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="repeat"
      >
        <SafeAreaView style={styles.container}>
          <StatusBar hidden={true} />
          
          <Header title="Mama Selfcare" showBackButton />
          

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          {/* 1. Persönliche Begrüßung & Daily Check-In */}
          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.cardTitle}>
              {userName ? `Hallo, ${userName}!` : 'Hallo!'} Wie fühlst du dich heute?
            </ThemedText>

            <View style={styles.moodContainer}>
              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'great' && styles.selectedMoodButton]}
                onPress={() => setCurrentMood('great')}
              >
                <ThemedText style={styles.moodEmoji}>😃</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'good' && styles.selectedMoodButton]}
                onPress={() => setCurrentMood('good')}
              >
                <ThemedText style={styles.moodEmoji}>🙂</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'okay' && styles.selectedMoodButton]}
                onPress={() => setCurrentMood('okay')}
              >
                <ThemedText style={styles.moodEmoji}>😐</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'bad' && styles.selectedMoodButton]}
                onPress={() => setCurrentMood('bad')}
              >
                <ThemedText style={styles.moodEmoji}>😔</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'awful' && styles.selectedMoodButton]}
                onPress={() => setCurrentMood('awful')}
              >
                <ThemedText style={styles.moodEmoji}>😢</ThemedText>
              </TouchableOpacity>
            </View>

            {currentMood && (
              <ThemedText style={styles.moodFeedback}>
                {getMoodFeedback(currentMood)}
              </ThemedText>
            )}

            <ThemedText style={styles.sectionTitle}>Tagebucheintrag</ThemedText>
            <TextInput
              style={[
                styles.journalInput,
                { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
              ]}
              value={journalEntry}
              onChangeText={setJournalEntry}
              placeholder="Wie geht es dir heute? Was beschäftigt dich?"
              placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#888888'}
              multiline
              numberOfLines={4}
            />
          </ThemedView>

          {/* 2. Selbstfürsorge-Tipps & Anleitungen */}
          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.cardTitle}>Täglicher Selfcare-Tipp</ThemedText>

            <View style={styles.tipContainer}>
              <IconSymbol name="lightbulb.fill" size={24} color="#FFD700" />
              <ThemedText style={styles.tipText}>{dailyTip}</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => setDailyTip(selfcareTips[Math.floor(Math.random() * selfcareTips.length)])}
            >
              <IconSymbol name="arrow.clockwise" size={16} color={theme.text} />
              <ThemedText style={styles.refreshButtonText}>Neuer Tipp</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* 3. Gesundheit & Wohlbefinden */}
          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.cardTitle}>Gesundheit & Wohlbefinden</ThemedText>

            <View style={styles.healthItem}>
              <ThemedText style={styles.healthLabel}>Schlaf:</ThemedText>
              <View style={styles.sleepContainer}>
                <TouchableOpacity
                  style={styles.sleepButton}
                  onPress={() => setSleepHours(Math.max(0, sleepHours - 1))}
                >
                  <IconSymbol name="minus" size={16} color={theme.text} />
                </TouchableOpacity>

                <ThemedText style={styles.sleepHours}>{sleepHours} Stunden</ThemedText>

                <TouchableOpacity
                  style={styles.sleepButton}
                  onPress={() => setSleepHours(Math.min(24, sleepHours + 1))}
                >
                  <IconSymbol name="plus" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.healthItem}>
              <ThemedText style={styles.healthLabel}>Wasser:</ThemedText>
              <View style={styles.waterContainer}>
                <View style={styles.waterProgressBackground}>
                  <View
                    style={[
                      styles.waterProgress,
                      { width: `${Math.min(100, (waterIntake / 8) * 100)}%` }
                    ]}
                  />
                </View>
                <ThemedText style={styles.waterText}>{waterIntake} / 8 Gläser</ThemedText>
                <TouchableOpacity
                  style={styles.waterButton}
                  onPress={() => setWaterIntake(Math.min(8, waterIntake + 1))}
                >
                  <IconSymbol name="plus.circle.fill" size={24} color={Colors.light.success} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.healthItem}>
              <ThemedText style={styles.healthLabel}>Bewegung:</ThemedText>
              <TouchableOpacity
                style={[
                  styles.exerciseButton,
                  exerciseDone && styles.exerciseButtonDone
                ]}
                onPress={() => setExerciseDone(!exerciseDone)}
              >
                <IconSymbol
                  name={exerciseDone ? "checkmark.circle.fill" : "circle"}
                  size={24}
                  color={exerciseDone ? Colors.light.success : theme.text}
                />
                <ThemedText
                  style={[
                    styles.exerciseText,
                    exerciseDone && styles.exerciseTextDone
                  ]}
                >
                  {exerciseDone ? "Erledigt!" : "Heute bewegt?"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* 4. Rückbildung & Körperpflege */}
          <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
            <ThemedText style={styles.cardTitle}>Rückbildung & Körperpflege</ThemedText>

            <ThemedText style={styles.sectionTitle}>Rückbildungsübung des Tages</ThemedText>
            <View style={styles.exerciseCard}>
              <ThemedText style={styles.exerciseTitle}>
                {postpartumExercises[Math.floor(Math.random() * postpartumExercises.length)].title}
              </ThemedText>
              <ThemedText style={styles.exerciseDescription}>
                {postpartumExercises[Math.floor(Math.random() * postpartumExercises.length)].description}
              </ThemedText>
            </View>

            <ThemedText style={styles.sectionTitle}>Meine Selfcare-Checkliste</ThemedText>
            {selfcareActivities.map(activity => (
              <TouchableOpacity
                key={activity.id}
                style={styles.checklistItem}
                onPress={() => toggleActivity(activity.id)}
              >
                <IconSymbol
                  name={checkedActivities.includes(activity.id) ? "checkmark.square.fill" : "square"}
                  size={24}
                  color={checkedActivities.includes(activity.id) ? Colors.light.success : theme.text}
                />
                <ThemedText
                  style={[
                    styles.checklistText,
                    checkedActivities.includes(activity.id) && styles.checklistTextDone
                  ]}
                >
                  {activity.title}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveEntry}
          >
            <ThemedText style={styles.saveButtonText} lightColor="#FFFFFF" darkColor="#FFFFFF">
              Speichern
            </ThemedText>
          </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </>
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
    paddingHorizontal: LAYOUT_PAD,
    paddingVertical: 20,
    paddingBottom: 140,
    alignItems: 'center',
  },
  card: {
    width: contentWidth - 2 * TIMELINE_INSET,
    borderRadius: RADIUS,
    padding: 20,
    marginBottom: SECTION_GAP_TOP,
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
  moodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  moodButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  selectedMoodButton: {
    backgroundColor: 'rgba(125, 90, 80, 0.3)',
    borderWidth: 2,
    borderColor: '#7D5A50',
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodFeedback: {
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  journalInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  tipText: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  refreshButtonText: {
    fontSize: 14,
    marginLeft: 5,
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(125, 90, 80, 0.1)',
  },
  healthLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sleepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sleepHours: {
    fontSize: 16,
    marginHorizontal: 10,
    minWidth: 80,
    textAlign: 'center',
  },
  waterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterProgressBackground: {
    height: 10,
    width: 150,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    marginRight: 10,
    overflow: 'hidden',
  },
  waterProgress: {
    height: '100%',
    backgroundColor: Colors.light.success,
    borderRadius: 5,
  },
  waterText: {
    fontSize: 14,
    marginRight: 10,
  },
  waterButton: {
    padding: 5,
  },
  exerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
    padding: 10,
    borderRadius: 10,
  },
  exerciseButtonDone: {
    backgroundColor: 'rgba(157, 190, 187, 0.2)',
  },
  exerciseText: {
    fontSize: 16,
    marginLeft: 10,
  },
  exerciseTextDone: {
    fontWeight: 'bold',
  },
  exerciseCard: {
    backgroundColor: 'rgba(125, 90, 80, 0.05)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  exerciseDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checklistText: {
    fontSize: 16,
    marginLeft: 10,
  },
  checklistTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  saveButton: {
    width: contentWidth - 2 * TIMELINE_INSET,
    backgroundColor: '#7D5A50',
    paddingVertical: 15,
    borderRadius: RADIUS,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
