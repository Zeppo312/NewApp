import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, SafeAreaView, StatusBar, Animated } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import { LiquidGlassCard, LAYOUT_PAD, TIMELINE_INSET } from '@/constants/DesignGuide';
import * as Haptics from 'expo-haptics';
import { ProgressCircle } from '@/components/ProgressCircle';

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
  // Animations
  const moodPulse = React.useRef(new Animated.Value(1)).current;
  const tipOpacity = React.useRef(new Animated.Value(1)).current;

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
    try { Haptics.selectionAsync(); } catch {}
  };

  const selectMood = (m: MoodType) => {
    setCurrentMood(m);
    try { Haptics.selectionAsync(); } catch {}
    moodPulse.setValue(1);
    Animated.sequence([
      Animated.timing(moodPulse, { toValue: 1.08, duration: 140, useNativeDriver: true }),
      Animated.spring(moodPulse, { toValue: 1, useNativeDriver: true })
    ]).start();
  };

  const refreshTipAnimated = () => {
    Animated.timing(tipOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setDailyTip(selfcareTips[Math.floor(Math.random() * selfcareTips.length)]);
      Animated.timing(tipOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden={true} />
        
        <Header title="Mama Selfcare" subtitle="Dein täglicher Check‑in" showBackButton />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* 1. Persönliche Begrüßung & Daily Check-In */}
          <LiquidGlassCard style={styles.glassCard}>
            <View style={styles.glassInner}>
            <ThemedText style={styles.cardTitle}>{userName ? `Wie geht’s dir, ${userName}?` : 'Wie geht’s dir, Mama?'}</ThemedText>
            <ThemedText style={styles.cardSubtitle}>Nimm dir kurz einen Moment nur für dich 💭</ThemedText>

            <View style={styles.moodContainer}>
              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'great' && styles.selectedMoodButton]}
                onPress={() => selectMood('great')}
              >
                <Animated.Text style={[styles.moodEmoji, currentMood === 'great' && { transform: [{ scale: moodPulse }] }]}>😃</Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'good' && styles.selectedMoodButton]}
                onPress={() => selectMood('good')}
              >
                <Animated.Text style={[styles.moodEmoji, currentMood === 'good' && { transform: [{ scale: moodPulse }] }]}>🙂</Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'okay' && styles.selectedMoodButton]}
                onPress={() => selectMood('okay')}
              >
                <Animated.Text style={[styles.moodEmoji, currentMood === 'okay' && { transform: [{ scale: moodPulse }] }]}>😐</Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'bad' && styles.selectedMoodButton]}
                onPress={() => selectMood('bad')}
              >
                <Animated.Text style={[styles.moodEmoji, currentMood === 'bad' && { transform: [{ scale: moodPulse }] }]}>😔</Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moodButton, currentMood === 'awful' && styles.selectedMoodButton]}
                onPress={() => selectMood('awful')}
              >
                <Animated.Text style={[styles.moodEmoji, currentMood === 'awful' && { transform: [{ scale: moodPulse }] }]}>😢</Animated.Text>
              </TouchableOpacity>
            </View>

            {currentMood && (
              <ThemedText style={styles.moodFeedback}>
                {getMoodFeedback(currentMood)}
              </ThemedText>
            )}

            <ThemedText style={styles.sectionTitle}>💭 Tagebuch</ThemedText>
            <TextInput
              style={styles.glassInput}
              value={journalEntry}
              onChangeText={setJournalEntry}
              placeholder="Wie geht es dir heute? Was beschäftigt dich?"
              placeholderTextColor={'#A8978E'}
              multiline
              numberOfLines={4}
            />
            </View>
          </LiquidGlassCard>

          {/* 2. Selbstfürsorge-Tipps & Anleitungen */}
          <LiquidGlassCard style={styles.glassCard}>
            <View style={styles.glassInner}>
              <ThemedText style={styles.cardTitle}>💡 Tipp des Tages</ThemedText>

            <View style={styles.tipContainer}>
              <IconSymbol name="lightbulb.fill" size={24} color="#FFD700" />
              <Animated.View style={{ flex: 1, opacity: tipOpacity }}>
                <ThemedText style={styles.tipText}>{dailyTip}</ThemedText>
              </Animated.View>
            </View>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshTipAnimated}
            >
              <IconSymbol name="arrow.clockwise" size={16} color={theme.text} />
              <ThemedText style={styles.refreshButtonText}>Neuer Tipp</ThemedText>
            </TouchableOpacity>
            </View>
          </LiquidGlassCard>

          {/* 3. Gesundheit & Wohlbefinden */}
          <LiquidGlassCard style={styles.glassCard}>
            <View style={styles.glassInner}>
              <ThemedText style={styles.cardTitle}>💧 Gesundheit & Wohlbefinden</ThemedText>

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
                <ThemedText style={styles.waterText}>{waterIntake} / 8 Gläser – {Math.max(0, 8 - waterIntake)} verbleibend ✨</ThemedText>
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
            </View>
          </LiquidGlassCard>

          {/* 4. Rückbildung & Körperpflege */}
          <LiquidGlassCard style={styles.glassCard}>
            <View style={styles.glassInner}>
              <ThemedText style={styles.cardTitle}>Rückbildung & Körperpflege</ThemedText>

              <ThemedText style={styles.sectionTitle}>🌸 Rückbildungsübung des Tages</ThemedText>
            <View style={styles.exerciseCard}>
              <ThemedText style={styles.exerciseTitle}>
                {postpartumExercises[Math.floor(Math.random() * postpartumExercises.length)].title}
              </ThemedText>
              <ThemedText style={styles.exerciseDescription}>
                {postpartumExercises[Math.floor(Math.random() * postpartumExercises.length)].description}
              </ThemedText>
            </View>

            <ThemedText style={styles.sectionTitle}>☑️ Meine Selfcare‑Checkliste</ThemedText>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <ProgressCircle
                progress={(checkedActivities.length / selfcareActivities.length) * 100}
                size={58}
                strokeWidth={6}
                progressColor={'#8E4EC6'}
                backgroundColor={'rgba(255,255,255,0.25)'}
                textColor={'transparent'}
              />
              <ThemedText style={{ marginTop: 6, color: '#7D5A50', fontWeight: '700' }}>{checkedActivities.length}/{selfcareActivities.length} erledigt</ThemedText>
            </View>
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
            </View>
          </LiquidGlassCard>

          {/* Spacer for sticky CTA */}
          <View style={{ height: 110 }} />

        </ScrollView>
        {/* Sticky CTA */}
        <LiquidGlassCard style={styles.stickyCta} onPress={saveEntry}>
          <View style={styles.saveButtonInner}>
            <ThemedText style={styles.saveButtonText}>💜 Speichern & Weitermachen</ThemedText>
          </View>
        </LiquidGlassCard>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 140,
  },
  // Liquid Glass card wrappers
  glassCard: {
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
    borderRadius: 22,
  },
  glassInner: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 15,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#7D5A50',
    opacity: 0.85,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 10,
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  selectedMoodButton: {
    backgroundColor: 'rgba(142, 78, 198, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(142, 78, 198, 0.45)',
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodFeedback: {
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
    color: '#7D5A50',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'center',
  },
  glassInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.85)'
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)'
  },
  tipText: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
    color: '#7D5A50',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  refreshButtonText: {
    fontSize: 14,
    marginLeft: 5,
    fontWeight: '700',
    color: '#7D5A50',
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
  },
  healthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
  sleepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sleepHours: {
    fontSize: 16,
    marginHorizontal: 10,
    minWidth: 80,
    textAlign: 'center',
    color: '#7D5A50',
  },
  waterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterProgressBackground: {
    height: 10,
    width: 150,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 5,
    marginRight: 10,
    overflow: 'hidden',
  },
  waterProgress: {
    height: '100%',
    backgroundColor: '#8E4EC6',
    borderRadius: 5,
  },
  waterText: {
    fontSize: 14,
    marginRight: 10,
    color: '#7D5A50',
  },
  waterButton: {
    padding: 5,
  },
  exerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    padding: 10,
    borderRadius: 12,
  },
  exerciseButtonDone: {
    backgroundColor: 'rgba(142, 78, 198, 0.16)',
    borderColor: 'rgba(142, 78, 198, 0.35)',
  },
  exerciseText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#7D5A50',
  },
  exerciseTextDone: {
    fontWeight: 'bold',
  },
  exerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    padding: 15,
    borderRadius: 14,
    marginBottom: 15,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
    color: '#7D5A50',
  },
  exerciseDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7D5A50',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checklistText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#7D5A50',
  },
  checklistTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  saveButtonCard: {
    marginHorizontal: TIMELINE_INSET,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(142, 78, 198, 0.35)',
    backgroundColor: 'rgba(142, 78, 198, 0.16)',
    marginBottom: 24,
  },
  stickyCta: {
    position: 'absolute',
    left: TIMELINE_INSET,
    right: TIMELINE_INSET,
    bottom: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(142, 78, 198, 0.35)',
    backgroundColor: 'rgba(142, 78, 198, 0.16)'
  },
  saveButtonInner: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
  },
});
