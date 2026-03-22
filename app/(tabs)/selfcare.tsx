import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, SafeAreaView, StatusBar, Animated, Dimensions, Text } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import { useSmartBack } from '@/contexts/NavigationContext';
import { LiquidGlassCard, LAYOUT_PAD, TIMELINE_INSET, GlassCard, PRIMARY, GLASS_OVERLAY, GLASS_OVERLAY_DARK } from '@/constants/DesignGuide';
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

const movementChoices = [
  { value: true, emoji: '✨', label: 'Ja, ein bisschen' },
  { value: false, emoji: '⏳', label: 'Noch nicht' },
];

const { width: screenWidth } = Dimensions.get('window');
const contentWidth = screenWidth - 2 * LAYOUT_PAD;
const WEEK_CONTENT_WIDTH = contentWidth - TIMELINE_INSET * 2;
const WEEK_COLS = 7;
const WEEK_GUTTER = 4;
const WEEK_COL_WIDTH = Math.floor((WEEK_CONTENT_WIDTH - (WEEK_COLS - 1) * WEEK_GUTTER) / WEEK_COLS);
const WEEK_COLS_WIDTH = WEEK_COLS * WEEK_COL_WIDTH;
const WEEK_LEFTOVER = WEEK_CONTENT_WIDTH - (WEEK_COLS_WIDTH + (WEEK_COLS - 1) * WEEK_GUTTER);
const MAX_BAR_HEIGHT = 140;

const moodScoreMap: Record<MoodType, number> = {
  great: 5,
  good: 4,
  okay: 3,
  bad: 2,
  awful: 1,
};

const getMoodScoreFromEntry = (entry: SelfcareEntry) => {
  if (!entry.mood) return null;
  return moodScoreMap[entry.mood as MoodType] ?? null;
};

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const describeMoodScore = (score: number | null) => {
  if (!score) return 'Keine Daten';
  if (score >= 4.5) return 'Strahlend';
  if (score >= 3.5) return 'Gut';
  if (score >= 2.5) return 'Durchwachsen';
  if (score >= 1.5) return 'Herausfordernd';
  return 'Braucht Liebe';
};

const toNumberArray = (values: Array<number | null | undefined>) =>
  values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

const averageNumber = (values: Array<number | null | undefined>) => {
  const filtered = toNumberArray(values);
  if (!filtered.length) return null;
  return filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekEnd = (date: Date) => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

const getWeekDays = (date: Date) => {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const normalizeDate = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export default function SelfcareScreen() {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const glassBorder = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.35)';
  const actionOverlay = isDark ? 'rgba(142, 78, 198, 0.28)' : 'rgba(142, 78, 198, 0.16)';
  const actionBorder = isDark ? 'rgba(200, 164, 245, 0.52)' : 'rgba(142, 78, 198, 0.35)';
  const iconSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const successColor = isDark ? Colors.dark.success : Colors.light.success;
  const placeholderColor = isDark ? 'rgba(248,240,229,0.6)' : 'rgba(125,90,80,0.5)';
  const styles = useMemo(
    () => createStyles({ isDark, textPrimary, textSecondary }),
    [isDark, textPrimary, textSecondary],
  );
  const { user } = useAuth();
  
  // Set fallback route for smart back navigation
  useSmartBack('/(tabs)/home');

  const [userName, setUserName] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(() => normalizeDate(new Date()));
  const [currentMood, setCurrentMood] = useState<MoodType | null>(null);
  const [journalEntry, setJournalEntry] = useState('');
  const [sleepHours, setSleepHours] = useState<number>(7);
  const [waterIntake, setWaterIntake] = useState<number>(0);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [dailyTip, setDailyTip] = useState('');
  const [checkedActivities, setCheckedActivities] = useState<string[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<SelfcareEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exerciseTouched, setExerciseTouched] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [weekEntries, setWeekEntries] = useState<SelfcareEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<SelfcareEntry[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  // Animations
  const moodPulse = React.useRef(new Animated.Value(1)).current;
  const tipOpacity = React.useRef(new Animated.Value(1)).current;

  // Lade Benutzerdaten und heutigen Eintrag
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadEntryForDate(selectedDate);
      setDailyTip(selfcareTips[Math.floor(Math.random() * selfcareTips.length)]);
    } else {
      setIsLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => {
    if (user) {
      loadWeekEntries();
    }
  }, [user, weekOffset]);

  useEffect(() => {
    if (user) {
      loadMonthEntries();
    }
  }, [user, monthOffset]);

  useEffect(() => {
    if (selectedTab === 'week') setWeekOffset(0);
    if (selectedTab === 'month') setMonthOffset(0);
  }, [selectedTab]);

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

  const resetEntryState = () => {
    setCurrentMood(null);
    setJournalEntry('');
    setSleepHours(7);
    setWaterIntake(0);
    setExerciseDone(false);
    setExerciseTouched(false);
    setCheckedActivities([]);
  };

  // Lade den Eintrag für ein bestimmtes Datum
  const loadEntryForDate = async (date: Date) => {
    try {
      setIsLoading(true);

      const dayStart = normalizeDate(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      const { data, error } = await supabase
        .from('selfcare_entries')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', dayStart.toISOString())
        .lt('date', dayEnd.toISOString())
        .maybeSingle();

      if (error) {
        console.error('Error loading entry:', error);
      } else if (data) {
        setSelectedEntry(data);
        setCurrentMood((data.mood as MoodType) ?? null);
        setJournalEntry(data.journal_entry ?? '');
        setSleepHours(typeof data.sleep_hours === 'number' ? data.sleep_hours : 7);
        setWaterIntake(typeof data.water_intake === 'number' ? data.water_intake : 0);
        setExerciseDone(!!data.exercise_done);
        setExerciseTouched(data.exercise_done !== undefined && data.exercise_done !== null);
        setCheckedActivities(data.selfcare_activities || []);
      } else {
        setSelectedEntry(null);
        resetEntryState();
      }
    } catch (err) {
      console.error('Failed to load entry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeekEntries = async () => {
    if (!user) return;
    try {
      setIsWeekLoading(true);
      const reference = new Date();
      reference.setDate(reference.getDate() + weekOffset * 7);
      const start = getWeekStart(reference);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const { data, error } = await supabase
        .from('selfcare_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start.toISOString())
        .lt('date', end.toISOString())
        .order('date', { ascending: true });

      if (error) {
        console.error('Error loading week entries:', error);
      } else {
        setWeekEntries(data ?? []);
      }
    } catch (err) {
      console.error('Failed to load week entries:', err);
    } finally {
      setIsWeekLoading(false);
    }
  };

  const loadMonthEntries = async () => {
    if (!user) return;
    try {
      setIsMonthLoading(true);
      const base = new Date();
      base.setDate(1);
      base.setMonth(base.getMonth() + monthOffset);
      const start = new Date(base);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(start.getMonth() + 1);

      const { data, error } = await supabase
        .from('selfcare_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start.toISOString())
        .lt('date', end.toISOString())
        .order('date', { ascending: true });

      if (error) {
        console.error('Error loading month entries:', error);
      } else {
        setMonthEntries(data ?? []);
      }
    } catch (err) {
      console.error('Failed to load month entries:', err);
    } finally {
      setIsMonthLoading(false);
    }
  };

  // Speichere den Eintrag
  const saveEntry = async () => {
    try {
      if (!user) {
        Alert.alert('Hinweis', 'Bitte melde dich an, um deine Daten zu speichern.');
        return;
      }

      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);

      const entryData: SelfcareEntry = {
        user_id: user.id,
        date: targetDate.toISOString(),
        mood: currentMood || undefined,
        journal_entry: journalEntry,
        sleep_hours: sleepHours,
        water_intake: waterIntake,
        exercise_done: exerciseDone,
        selfcare_activities: checkedActivities
      };

      let result;

      if (selectedEntry?.id) {
        // Update existing entry
        result = await supabase
          .from('selfcare_entries')
          .update(entryData)
          .eq('id', selectedEntry.id);
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
        await loadEntryForDate(targetDate); // Lade den aktualisierten Eintrag
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

  const handleMovementSelect = (value: boolean) => {
    setExerciseDone(value);
    setExerciseTouched(true);
    try { Haptics.selectionAsync(); } catch {}
  };

  const handleWeekDayPress = (day: Date) => {
    const normalized = normalizeDate(day);
    setSelectedDate(normalized);
    setSelectedTab('day');
    try { Haptics.selectionAsync(); } catch {}
  };

  const goToAdjacentDay = (offset: number) => {
    setSelectedDate((prevDate) => {
      const next = new Date(prevDate);
      next.setDate(next.getDate() + offset);
      next.setHours(0, 0, 0, 0);
      const today = normalizeDate(new Date());
      if (next.getTime() > today.getTime()) return prevDate;
      return next;
    });
  };

  const goToPreviousDay = () => goToAdjacentDay(-1);
  const goToNextDay = () => goToAdjacentDay(1);

  const TopTabs = () => (
    <View style={styles.topTabsContainer}>
      {(['day', 'week', 'month'] as const).map((tab) => (
        <GlassCard
          key={tab}
          style={[styles.topTab, selectedTab === tab && styles.activeTopTab]}
          intensity={22}
          overlayColor={glassOverlay}
          borderColor={glassBorder}
        >
          <TouchableOpacity
            style={styles.topTabInner}
            onPress={() => setSelectedTab(tab)}
            activeOpacity={0.85}
          >
            <Text style={[styles.topTabText, selectedTab === tab && styles.activeTopTabText]}>
              {tab === 'day' ? 'Tag' : tab === 'week' ? 'Woche' : 'Monat'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      ))}
    </View>
  );

  const WeekView = () => {
    const referenceDate = useMemo(() => {
      const base = new Date();
      base.setDate(base.getDate() + weekOffset * 7);
      return base;
    }, [weekOffset]);

    const weekStart = useMemo(() => getWeekStart(referenceDate), [referenceDate]);
    const weekEnd = useMemo(() => getWeekEnd(referenceDate), [referenceDate]);
    const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);

    const getEntriesForDay = (day: Date) =>
      weekEntries.filter((entry) => {
        if (!entry.date && !entry.created_at) return false;
        const entryDate = new Date(entry.date ?? entry.created_at!);
        return isSameDay(entryDate, day);
      });

    const getMoodAverageForDay = (day: Date) =>
      averageNumber(getEntriesForDay(day).map((entry) => getMoodScoreFromEntry(entry)));

    const weekMoodScore = averageNumber(weekEntries.map((entry) => getMoodScoreFromEntry(entry)));
    const avgSleep = averageNumber(weekEntries.map((entry) => entry.sleep_hours ?? null));
    const avgWater = averageNumber(weekEntries.map((entry) => entry.water_intake ?? null));
    const movementDays = weekEntries.filter((entry) => entry.exercise_done).length;
    const checklistPercent = weekEntries.length
      ? Math.round(
          (weekEntries.reduce((sum, entry) => sum + (entry.selfcare_activities?.length ?? 0), 0) /
            (weekEntries.length * selfcareActivities.length)) *
            100,
        )
      : 0;

    return (
      <View style={styles.weekViewContainer}>
        <View style={styles.weekNavigationContainer}>
          <TouchableOpacity style={styles.weekNavButton} onPress={() => setWeekOffset((prev) => prev - 1)}>
            <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
          </TouchableOpacity>

          <View style={styles.weekHeaderCenter}>
            <ThemedText style={styles.weekHeaderTitle}>Wochenübersicht</ThemedText>
            <ThemedText style={styles.weekHeaderSubtitle}>
              {weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} –{' '}
              {weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
            </ThemedText>
          </View>

          <TouchableOpacity style={styles.weekNavButton} onPress={() => setWeekOffset((prev) => prev + 1)}>
            <ThemedText style={styles.weekNavButtonText}>›</ThemedText>
          </TouchableOpacity>
        </View>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>Stimmung diese Woche</ThemedText>
            <ThemedText style={styles.chartSubtitle}>Ø pro Tag</ThemedText>
            <View style={[styles.chartArea, { width: WEEK_CONTENT_WIDTH, alignSelf: 'center' }]}>
              {weekDays.map((day, index) => {
                const moodAvg = getMoodAverageForDay(day);
                const height = moodAvg ? (moodAvg / 5) * MAX_BAR_HEIGHT : 0;
                const extra = index < WEEK_LEFTOVER ? 1 : 0;
                const isSelectedDay = isSameDay(day, selectedDate);
                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={{
                      width: WEEK_COL_WIDTH + extra,
                      marginRight: index < WEEK_COLS - 1 ? WEEK_GUTTER : 0,
                      alignItems: 'center',
                    }}
                    activeOpacity={0.85}
                    onPress={() => handleWeekDayPress(day)}
                  >
                    <View
                      style={[
                        styles.chartBarContainer,
                        { width: WEEK_COL_WIDTH + extra },
                        isSelectedDay && styles.selectedChartBarContainer,
                      ]}
                    >
                      {height > 0 && (
                        <View
                          style={[
                            styles.chartBar,
                            { height, width: Math.max(10, Math.round(WEEK_COL_WIDTH * 0.6)) },
                          ]}
                        />
                      )}
                    </View>
                    <View style={[styles.chartLabelContainer, { width: WEEK_COL_WIDTH + extra }]}>
                      <ThemedText style={[styles.chartLabel, isSelectedDay && styles.selectedChartLabel]}>
                        {WEEKDAY_LABELS[index]}
                      </ThemedText>
                      <ThemedText style={[styles.chartValue, isSelectedDay && styles.selectedChartValue]}>
                        {moodAvg ? moodAvg.toFixed(1) : '–'}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isWeekLoading && weekEntries.length === 0 && (
              <ThemedText style={styles.loadingText}>Lade Selfcare-Daten…</ThemedText>
            )}
            {!isWeekLoading && weekEntries.length === 0 && (
              <ThemedText style={styles.emptyHint}>Noch keine Einträge in dieser Woche</ThemedText>
            )}
          </View>
        </LiquidGlassCard>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>Selfcare-Kennzahlen</ThemedText>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>😌</ThemedText>
                <ThemedText style={styles.statValue}>{describeMoodScore(weekMoodScore)}</ThemedText>
                <ThemedText style={styles.statLabel}>Ø Stimmung</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💤</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgSleep !== null ? `${avgSleep.toFixed(1)}h` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Schlaf</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💧</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgWater !== null ? `${avgWater.toFixed(1)}` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Ø Gläser</ThemedText>
              </View>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>🚶‍♀️</ThemedText>
                <ThemedText style={styles.statValue}>{movementDays}</ThemedText>
                <ThemedText style={styles.statLabel}>Bewegungstage</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>☑️</ThemedText>
                <ThemedText style={styles.statValue}>
                  {weekEntries.length ? `${checklistPercent}%` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Checkliste</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>🗓️</ThemedText>
                <ThemedText style={styles.statValue}>{weekEntries.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Einträge</ThemedText>
              </View>
            </View>
          </View>
        </LiquidGlassCard>
      </View>
    );
  };

  const MonthView = () => {
    const referenceMonth = useMemo(() => {
      const base = new Date();
      base.setDate(1);
      base.setMonth(base.getMonth() + monthOffset);
      return base;
    }, [monthOffset]);

    const monthStart = useMemo(() => new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1), [referenceMonth]);
    const daysInMonth = useMemo(() => new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + 1, 0).getDate(), [referenceMonth]);

    const calendarWeeks = useMemo(() => {
      const weeks: Array<Array<Date | null>> = [];
      const firstWeekday = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
      let currentWeek: Array<Date | null> = [];

      for (let i = 0; i < firstWeekday; i++) {
        currentWeek.push(null);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }

      if (currentWeek.length) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
      }

      return weeks;
    }, [monthStart, daysInMonth]);

    const getEntryForDate = (date: Date) =>
      monthEntries.find((entry) => {
        if (!entry.date && !entry.created_at) return false;
        const entryDate = new Date(entry.date ?? entry.created_at!);
        return isSameDay(entryDate, date);
      });

    const getCalendarColors = (mood?: MoodType | null, hasEntry?: boolean) => {
      if (mood === 'great') {
        return isDark
          ? { bg: 'rgba(56,161,105,0.28)', border: 'rgba(105,219,149,0.58)', text: '#C9F6DD' }
          : { bg: 'rgba(56,161,105,0.18)', border: 'rgba(56,161,105,0.45)', text: '#2F855A' };
      }
      if (mood === 'good') {
        return isDark
          ? { bg: 'rgba(56,161,105,0.22)', border: 'rgba(105,219,149,0.48)', text: '#C9F6DD' }
          : { bg: 'rgba(56,161,105,0.12)', border: 'rgba(56,161,105,0.35)', text: '#2F855A' };
      }
      if (mood === 'okay') {
        return isDark
          ? { bg: 'rgba(245,166,35,0.24)', border: 'rgba(245,197,120,0.54)', text: '#FFE4B8' }
          : { bg: 'rgba(245,166,35,0.16)', border: 'rgba(245,166,35,0.4)', text: '#975A16' };
      }
      if (mood === 'bad') {
        return isDark
          ? { bg: 'rgba(229,62,62,0.24)', border: 'rgba(255,151,151,0.55)', text: '#FFD1D1' }
          : { bg: 'rgba(229,62,62,0.16)', border: 'rgba(229,62,62,0.4)', text: '#9B2C2C' };
      }
      if (mood === 'awful') {
        return isDark
          ? { bg: 'rgba(229,62,62,0.32)', border: 'rgba(255,151,151,0.62)', text: '#FFD1D1' }
          : { bg: 'rgba(229,62,62,0.22)', border: 'rgba(229,62,62,0.5)', text: '#9B2C2C' };
      }
      if (hasEntry) {
        return isDark
          ? { bg: 'rgba(142,78,198,0.24)', border: 'rgba(193,149,247,0.52)', text: textSecondary }
          : { bg: 'rgba(142,78,198,0.12)', border: 'rgba(142,78,198,0.35)', text: '#7D5A50' };
      }
      return isDark
        ? { bg: 'rgba(0,0,0,0.28)', border: 'rgba(255,255,255,0.2)', text: textSecondary }
        : { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)', text: '#7D5A50' };
    };

    const monthMoodScore = averageNumber(monthEntries.map((entry) => getMoodScoreFromEntry(entry)));
    const avgSleep = averageNumber(monthEntries.map((entry) => entry.sleep_hours ?? null));
    const avgWater = averageNumber(monthEntries.map((entry) => entry.water_intake ?? null));
    const hydratedDays = monthEntries.filter((entry) => (entry.water_intake ?? 0) >= 8).length;
    const movementDays = monthEntries.filter((entry) => entry.exercise_done).length;
    const focusedDays = monthEntries.filter((entry) => (entry.selfcare_activities?.length ?? 0) >= 4).length;

    return (
      <View style={styles.monthViewContainer}>
        <View style={styles.monthNavigationContainer}>
          <TouchableOpacity style={styles.monthNavButton} onPress={() => setMonthOffset((prev) => prev - 1)}>
            <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
          </TouchableOpacity>

          <View style={styles.monthHeaderCenter}>
            <ThemedText style={styles.monthHeaderTitle}>Monatsübersicht</ThemedText>
            <ThemedText style={styles.monthHeaderSubtitle}>
              {referenceMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.monthNavButton, monthOffset >= 0 && styles.disabledNavButton]}
            disabled={monthOffset >= 0}
            onPress={() => setMonthOffset((prev) => Math.min(prev + 1, 0))}
          >
            <ThemedText style={styles.weekNavButtonText}>›</ThemedText>
          </TouchableOpacity>
        </View>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>Selfcare-Kalender</ThemedText>
            <View style={{ width: WEEK_CONTENT_WIDTH, alignSelf: 'center', paddingVertical: 12 }}>
              <View style={styles.weekdayHeader}>
                {WEEKDAY_LABELS.map((label, index) => {
                  const extra = index < WEEK_LEFTOVER ? 1 : 0;
                  return (
                    <View
                      key={label}
                      style={{
                        width: WEEK_COL_WIDTH + extra,
                        marginRight: index < WEEK_COLS - 1 ? WEEK_GUTTER : 0,
                        alignItems: 'center',
                      }}
                    >
                      <ThemedText style={styles.weekdayLabel}>{label}</ThemedText>
                    </View>
                  );
                })}
              </View>

              {calendarWeeks.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                  {week.map((date, dayIndex) => {
                    const extra = dayIndex < WEEK_LEFTOVER ? 1 : 0;
                    return (
                      <View
                        key={`day-${weekIndex}-${dayIndex}`}
                        style={{
                          width: WEEK_COL_WIDTH + extra,
                          marginRight: dayIndex < WEEK_COLS - 1 ? WEEK_GUTTER : 0,
                        }}
                      >
                        {date ? (
                          (() => {
                            const entry = getEntryForDate(date);
                            const colors = getCalendarColors(entry?.mood as MoodType | undefined, !!entry);
                            const isSelected = isSameDay(date, selectedDate);
                            return (
                              <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => handleWeekDayPress(date)}
                                style={[
                                  styles.calendarDayButton,
                                  { backgroundColor: colors.bg, borderColor: colors.border },
                                  isSelected && styles.selectedCalendarDayButton,
                                ]}
                              >
                                <ThemedText
                                  style={[
                                    styles.calendarDayNumber,
                                    { color: colors.text },
                                    isSelected && styles.selectedCalendarDayText,
                                  ]}
                                >
                                  {date.getDate()}
                                </ThemedText>
                                {entry?.mood ? (
                                  <ThemedText
                                    style={[
                                      styles.calendarMoodEmoji,
                                      { color: colors.text },
                                      isSelected && styles.selectedCalendarDayText,
                                    ]}
                                  >
                                    {getMoodEmoji(entry.mood as MoodType)}
                                  </ThemedText>
                                ) : entry ? (
                                  <ThemedText
                                    style={[
                                      styles.calendarProgressText,
                                      { color: colors.text },
                                      isSelected && styles.selectedCalendarDayText,
                                    ]}
                                  >
                                    {(entry.selfcare_activities?.length ?? 0)}/{selfcareActivities.length}
                                  </ThemedText>
                                ) : null}
                              </TouchableOpacity>
                            );
                          })()
                        ) : (
                          <View style={styles.calendarDayEmpty} />
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            {isMonthLoading && monthEntries.length === 0 && (
              <ThemedText style={styles.loadingText}>Kalender wird geladen…</ThemedText>
            )}
            {!isMonthLoading && monthEntries.length === 0 && (
              <ThemedText style={styles.emptyHint}>Noch keine Einträge in diesem Monat</ThemedText>
            )}
          </View>
        </LiquidGlassCard>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>Monatsübersicht</ThemedText>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>😌</ThemedText>
                <ThemedText style={styles.statValue}>{describeMoodScore(monthMoodScore)}</ThemedText>
                <ThemedText style={styles.statLabel}>Ø Stimmung</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💤</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgSleep !== null ? `${avgSleep.toFixed(1)}h` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Ø Schlaf</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💧</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgWater !== null ? `${avgWater.toFixed(1)}` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Ø Gläser</ThemedText>
              </View>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>🚶‍♀️</ThemedText>
                <ThemedText style={styles.statValue}>{movementDays}</ThemedText>
                <ThemedText style={styles.statLabel}>Bewegung</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💦</ThemedText>
                <ThemedText style={styles.statValue}>{hydratedDays}</ThemedText>
                <ThemedText style={styles.statLabel}>Hydriert</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>☑️</ThemedText>
                <ThemedText style={styles.statValue}>{focusedDays}</ThemedText>
                <ThemedText style={styles.statLabel}>Checkliste 4+</ThemedText>
              </View>
            </View>
          </View>
        </LiquidGlassCard>
      </View>
    );
  };

  const todayNormalized = normalizeDate(new Date());
  const isNextDayDisabled = selectedDate.getTime() >= todayNormalized.getTime();
  const selectedDateLabel = selectedDate.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden={true} />
        
        <Header title="Mama Selfcare" subtitle="Dein täglicher Check‑in" showBackButton />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <TopTabs />

          {selectedTab === 'day' && (
            <View style={styles.dayNavigationContainer}>
              <TouchableOpacity style={styles.weekNavButton} onPress={goToPreviousDay}>
                <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
              </TouchableOpacity>

              <View style={styles.weekHeaderCenter}>
                <ThemedText style={styles.weekHeaderTitle}>Tagesübersicht</ThemedText>
                <ThemedText style={styles.weekHeaderSubtitle}>{selectedDateLabel}</ThemedText>
              </View>

              <TouchableOpacity
                style={[styles.weekNavButton, isNextDayDisabled && styles.disabledNavButton]}
                onPress={goToNextDay}
                disabled={isNextDayDisabled}
              >
                <ThemedText style={styles.weekNavButtonText}>›</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {selectedTab === 'day' ? (
            <>
              {/* 1. Persönliche Begrüßung & Daily Check-In */}
              <LiquidGlassCard style={styles.glassCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
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
                    placeholderTextColor={placeholderColor}
                    multiline
                    numberOfLines={4}
                  />
                </View>
              </LiquidGlassCard>

              {/* 2. Selbstfürsorge-Tipps & Anleitungen */}
              <LiquidGlassCard style={styles.glassCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
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
                    <IconSymbol name="arrow.clockwise" size={16} color={iconSecondary} />
                    <ThemedText style={styles.refreshButtonText}>Neuer Tipp</ThemedText>
                  </TouchableOpacity>
                </View>
              </LiquidGlassCard>

              {/* 3. Gesundheit & Wohlbefinden */}
              <LiquidGlassCard style={styles.glassCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
                <View style={styles.glassInner}>
                  <ThemedText style={styles.cardTitle}>💧 Gesundheit & Wohlbefinden</ThemedText>

                  <View style={styles.healthStack}>
                    <View style={styles.healthCard}>
                      <View style={styles.healthHeader}>
                        <View style={[styles.healthIcon, { backgroundColor: 'rgba(135, 206, 235, 0.55)' }]}>
                          <IconSymbol name="moon.fill" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.healthTitle}>Schlafdauer</ThemedText>
                          <ThemedText style={styles.healthSubtitle}>Letzte Nacht</ThemedText>
                        </View>
                        <View style={styles.healthValueBadge}>
                          <ThemedText style={styles.healthValueText}>{sleepHours}h</ThemedText>
                        </View>
                      </View>
                      <View style={styles.healthControlsRow}>
                        <TouchableOpacity
                          style={styles.controlCircle}
                          onPress={() => setSleepHours(Math.max(0, sleepHours - 1))}
                          activeOpacity={0.85}
                        >
                          <IconSymbol name="minus" size={16} color={iconSecondary} />
                        </TouchableOpacity>
                        <ThemedText style={styles.healthControlValue}>{sleepHours} Stunden</ThemedText>
                        <TouchableOpacity
                          style={styles.controlCircle}
                          onPress={() => setSleepHours(Math.min(24, sleepHours + 1))}
                          activeOpacity={0.85}
                        >
                          <IconSymbol name="plus" size={16} color={iconSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.healthCard}>
                      <View style={styles.healthHeader}>
                        <View style={[styles.healthIcon, { backgroundColor: 'rgba(142, 78, 198, 0.6)' }]}>
                          <IconSymbol name="drop.fill" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.healthTitle}>Wasseraufnahme</ThemedText>
                          <ThemedText style={styles.healthSubtitle}>Ziel 8 Gläser</ThemedText>
                        </View>
                        <View style={styles.healthValueBadge}>
                          <ThemedText style={styles.healthValueText}>{waterIntake} Gläser</ThemedText>
                        </View>
                      </View>
                      <View style={styles.waterMeterWrapper}>
                        <View style={styles.waterMeterTrack}>
                          <View
                            style={[
                              styles.waterMeterFill,
                              { width: `${Math.min(100, (waterIntake / 8) * 100)}%` },
                            ]}
                          />
                        </View>
                        <ThemedText style={styles.waterHint}>
                          {Math.max(0, 8 - waterIntake)} noch offen
                        </ThemedText>
                      </View>
                      <View style={styles.healthControlsRow}>
                        <TouchableOpacity
                          style={styles.controlCircle}
                          onPress={() => setWaterIntake(Math.max(0, waterIntake - 1))}
                          activeOpacity={0.85}
                        >
                          <IconSymbol name="minus" size={16} color={iconSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.controlPrimary}
                          onPress={() => setWaterIntake(waterIntake + 1)}
                          activeOpacity={0.9}
                        >
                          <IconSymbol name="plus.circle.fill" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.controlPrimaryText}>Glas hinzufügen</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.healthCard}>
                      <View style={styles.healthHeader}>
                        <View style={[styles.healthIcon, { backgroundColor: 'rgba(168, 196, 162, 0.65)' }]}>
                          <IconSymbol name="figure.walk" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.healthTitle}>Bewegung heute</ThemedText>
                          <ThemedText style={styles.healthSubtitle}>Sanfte Aktivität zählt</ThemedText>
                        </View>
                      </View>
                      <View style={styles.segmentRow}>
                        {movementChoices.map((choice) => (
                          <TouchableOpacity
                            key={choice.label}
                            style={[
                              styles.segmentButton,
                              exerciseTouched && exerciseDone === choice.value && styles.segmentButtonActive,
                            ]}
                            onPress={() => handleMovementSelect(choice.value)}
                            activeOpacity={0.9}
                          >
                            <ThemedText style={styles.segmentEmoji}>{choice.emoji}</ThemedText>
                            <ThemedText
                              style={[
                                styles.segmentLabel,
                                exerciseTouched && exerciseDone === choice.value && styles.segmentLabelActive,
                              ]}
                            >
                              {choice.label}
                            </ThemedText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </LiquidGlassCard>

              {/* 4. Rückbildung & Körperpflege */}
              <LiquidGlassCard style={styles.glassCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
                <View style={styles.glassInner}>
                  <ThemedText style={styles.cardTitle}>Rückbildung & Körperpflege</ThemedText>

                  <ThemedText style={styles.sectionTitle}>🌸 Rückbildungsübung des Tages</ThemedText>
                  {(() => {
                    const exercise = postpartumExercises[Math.floor(Math.random() * postpartumExercises.length)];
                    return (
                      <View style={styles.exerciseCard}>
                        <ThemedText style={styles.exerciseTitle}>
                          {exercise.title}
                        </ThemedText>
                        <ThemedText style={styles.exerciseDescription}>
                          {exercise.description}
                        </ThemedText>
                      </View>
                    );
                  })()}

                  <ThemedText style={styles.sectionTitle}>☑️ Meine Selfcare‑Checkliste</ThemedText>
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <ProgressCircle
                      progress={(checkedActivities.length / selfcareActivities.length) * 100}
                      size={58}
                      strokeWidth={6}
                      progressColor={isDark ? '#B892F5' : '#8E4EC6'}
                      backgroundColor={isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.25)'}
                      textColor={'transparent'}
                    />
                    <ThemedText style={{ marginTop: 6, color: textSecondary, fontWeight: '700' }}>{checkedActivities.length}/{selfcareActivities.length} erledigt</ThemedText>
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
                        color={checkedActivities.includes(activity.id) ? successColor : iconSecondary}
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
            </>
          ) : selectedTab === 'week' ? (
            <WeekView />
          ) : (
            <MonthView />
          )}
        </ScrollView>

        {selectedTab === 'day' && (
          <View style={styles.stickyCtaContainer}>
            <LiquidGlassCard 
              style={styles.stickyCtaCard} 
              onPress={saveEntry}
              intensity={26}
              overlayColor={actionOverlay}
              borderColor={actionBorder}
            >
              <View style={styles.saveButtonInner}>
                <ThemedText style={styles.saveButtonText}>💜 Speichern & Weitermachen</ThemedText>
              </View>
            </LiquidGlassCard>
          </View>
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

type SelfcareStyleConfig = {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
};

const createStyles = ({ isDark, textPrimary, textSecondary }: SelfcareStyleConfig) => {
  const textAccent = isDark ? '#E7D8FA' : PRIMARY;
  const glassBorder = isDark ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.35)';
  const glassBorderStrong = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)';
  const glassSurface = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.12)';
  const glassSurfaceStrong = isDark ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.18)';
  const glassSurfaceBadge = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.2)';
  const accentSoft = isDark ? 'rgba(142,78,198,0.28)' : 'rgba(142,78,198,0.16)';
  const accentBorder = isDark ? 'rgba(193,149,247,0.58)' : 'rgba(142,78,198,0.45)';
  const accentFill = isDark ? 'rgba(193,149,247,0.92)' : 'rgba(142,78,198,0.85)';
  const primaryButton = isDark ? 'rgba(169,122,236,0.84)' : 'rgba(142,78,198,0.78)';
  const primaryButtonBorder = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.55)';
  const meterTrack = isDark ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.22)';
  const meterFill = isDark ? '#BC95F3' : '#8E4EC6';
  const ctaBg = isDark ? 'rgba(142, 78, 198, 0.28)' : 'rgba(142, 78, 198, 0.16)';
  const ctaBorder = isDark ? 'rgba(200, 164, 245, 0.52)' : 'rgba(142, 78, 198, 0.35)';

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: LAYOUT_PAD,
      paddingTop: 0,
      paddingBottom: 160,
    },
    topTabsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      marginTop: 6,
      marginBottom: 12,
    },
    dayNavigationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      marginTop: 0,
    },
    topTab: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
    },
    activeTopTab: {
      borderColor: isDark ? 'rgba(193,149,247,0.68)' : 'rgba(94,61,179,0.65)',
    },
    topTabInner: {
      paddingHorizontal: 18,
      paddingVertical: 6,
    },
    topTabText: {
      fontSize: 13,
      fontWeight: '700',
      color: textSecondary,
    },
    activeTopTabText: {
      color: textAccent,
    },
    weekViewContainer: {
      gap: 18,
      paddingBottom: 100,
    },
    weekNavigationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    weekNavButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.3,
      borderColor: glassBorder,
      backgroundColor: glassSurface,
    },
    weekNavButtonText: {
      fontSize: 22,
      color: textSecondary,
      fontWeight: '700',
    },
    weekHeaderCenter: {
      alignItems: 'center',
      flex: 1,
    },
    weekHeaderTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: textSecondary,
    },
    weekHeaderSubtitle: {
      fontSize: 13,
      color: textSecondary,
      opacity: 0.75,
    },
    analyticsCard: {
      marginBottom: 18,
    },
    analyticsInner: {
      padding: 20,
    },
    chartTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: textSecondary,
    },
    chartSubtitle: {
      fontSize: 13,
      color: textSecondary,
      opacity: 0.7,
      marginTop: 4,
    },
    chartArea: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    chartBarContainer: {
      height: MAX_BAR_HEIGHT,
      borderRadius: 16,
      backgroundColor: glassSurface,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 4,
    },
    selectedChartBarContainer: {
      borderWidth: 1,
      borderColor: accentBorder,
      backgroundColor: accentSoft,
    },
    chartBar: {
      backgroundColor: accentFill,
      borderRadius: 12,
    },
    chartLabelContainer: {
      alignItems: 'center',
      marginTop: 6,
    },
    chartLabel: {
      fontSize: 12,
      color: textSecondary,
      fontWeight: '600',
    },
    selectedChartLabel: {
      color: textAccent,
    },
    chartValue: {
      fontSize: 13,
      color: textPrimary,
      fontWeight: '700',
    },
    selectedChartValue: {
      color: textAccent,
    },
    loadingText: {
      textAlign: 'center',
      marginTop: 12,
      color: textSecondary,
      opacity: 0.7,
    },
    emptyHint: {
      textAlign: 'center',
      marginTop: 12,
      color: textSecondary,
      opacity: 0.7,
    },
    summaryStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 16,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 18,
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.3)',
      paddingVertical: 12,
    },
    statEmoji: {
      fontSize: 20,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: textPrimary,
    },
    statLabel: {
      fontSize: 12,
      color: textSecondary,
      opacity: 0.7,
      marginTop: 2,
      textAlign: 'center',
    },
    monthViewContainer: {
      gap: 18,
      paddingBottom: 100,
    },
    monthNavigationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    monthNavButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.3,
      borderColor: glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassSurface,
    },
    disabledNavButton: {
      opacity: 0.35,
    },
    monthHeaderCenter: {
      flex: 1,
      alignItems: 'center',
    },
    monthHeaderTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: textSecondary,
    },
    monthHeaderSubtitle: {
      fontSize: 13,
      color: textSecondary,
      opacity: 0.75,
    },
    weekdayHeader: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    weekdayLabel: {
      fontSize: 12,
      color: textSecondary,
      fontWeight: '700',
    },
    calendarWeek: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    calendarDayButton: {
      height: 72,
      borderRadius: 18,
      borderWidth: 1.2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    selectedCalendarDayButton: {
      borderColor: accentBorder,
      backgroundColor: accentSoft,
    },
    calendarDayNumber: {
      fontSize: 14,
      fontWeight: '700',
    },
    selectedCalendarDayText: {
      color: textAccent,
    },
    calendarMoodEmoji: {
      fontSize: 18,
    },
    calendarProgressText: {
      fontSize: 12,
      fontWeight: '600',
    },
    calendarDayEmpty: {
      height: 72,
    },
    glassCard: {
      marginBottom: 20,
      borderRadius: 22,
      overflow: 'hidden',
    },
    glassInner: {
      padding: 20,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: textPrimary,
      marginBottom: 15,
      textAlign: 'center',
    },
    cardSubtitle: {
      fontSize: 13,
      color: textSecondary,
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
      backgroundColor: glassSurfaceStrong,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    selectedMoodButton: {
      backgroundColor: accentSoft,
      borderWidth: 1,
      borderColor: accentBorder,
    },
    moodEmoji: {
      fontSize: 24,
    },
    moodFeedback: {
      textAlign: 'center',
      marginBottom: 15,
      fontStyle: 'italic',
      color: textSecondary,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: textSecondary,
      marginTop: 10,
      marginBottom: 10,
      textAlign: 'center',
    },
    glassInput: {
      borderWidth: 1.5,
      borderColor: glassBorder,
      borderRadius: 16,
      padding: 16,
      fontSize: 15,
      minHeight: 100,
      textAlignVertical: 'top',
      backgroundColor: glassSurfaceStrong,
      color: textPrimary,
      fontWeight: '500',
    },
    tipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: glassSurfaceStrong,
      padding: 12,
      borderRadius: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    tipText: {
      fontSize: 16,
      marginLeft: 10,
      flex: 1,
      color: textSecondary,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      backgroundColor: glassSurfaceStrong,
      borderWidth: 1,
      borderColor: glassBorder,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
    },
    refreshButtonText: {
      fontSize: 14,
      marginLeft: 5,
      fontWeight: '700',
      color: textSecondary,
    },
    healthStack: {
      flexDirection: 'column',
      gap: 16,
    },
    healthCard: {
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.3)',
      backgroundColor: isDark ? 'rgba(0,0,0,0.26)' : 'rgba(255,255,255,0.14)',
      paddingVertical: 18,
      paddingHorizontal: 18,
    },
    healthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    healthIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      borderWidth: 1.5,
      borderColor: glassBorderStrong,
    },
    healthTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: textPrimary,
    },
    healthSubtitle: {
      fontSize: 12,
      color: textSecondary,
      opacity: 0.75,
      marginTop: 2,
    },
    healthValueBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: glassSurfaceBadge,
      borderWidth: 1.2,
      borderColor: glassBorderStrong,
    },
    healthValueText: {
      fontSize: 13,
      fontWeight: '700',
      color: textPrimary,
    },
    healthControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    },
    controlCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: glassBorder,
      backgroundColor: glassSurfaceStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlPrimary: {
      flex: 1,
      height: 46,
      borderRadius: 23,
      backgroundColor: primaryButton,
      borderWidth: 1.5,
      borderColor: primaryButtonBorder,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    controlPrimaryText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    healthControlValue: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: textPrimary,
    },
    waterMeterWrapper: {
      marginBottom: 12,
    },
    waterMeterTrack: {
      height: 12,
      borderRadius: 8,
      backgroundColor: meterTrack,
      overflow: 'hidden',
    },
    waterMeterFill: {
      height: '100%',
      backgroundColor: meterFill,
      borderRadius: 8,
    },
    waterHint: {
      marginTop: 6,
      fontSize: 12,
      textAlign: 'center',
      color: textSecondary,
      opacity: 0.75,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: 10,
    },
    segmentButton: {
      flex: 1,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.3)',
      backgroundColor: glassSurface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    },
    segmentButtonActive: {
      borderColor: accentBorder,
      backgroundColor: accentSoft,
    },
    segmentEmoji: {
      fontSize: 20,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: textSecondary,
    },
    segmentLabelActive: {
      color: textPrimary,
    },
    exerciseCard: {
      marginBottom: 18,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.3)',
      backgroundColor: glassSurface,
      padding: 18,
      gap: 6,
    },
    exerciseTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: textPrimary,
    },
    exerciseDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: textSecondary,
    },
    checklistItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    checklistText: {
      fontSize: 16,
      marginLeft: 10,
      color: textSecondary,
    },
    checklistTextDone: {
      textDecorationLine: 'line-through',
      opacity: 0.7,
    },
    saveButtonCard: {
      marginHorizontal: TIMELINE_INSET,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: ctaBorder,
      backgroundColor: ctaBg,
      marginBottom: 24,
    },
    stickyCtaContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 100,
      paddingHorizontal: LAYOUT_PAD,
      alignItems: 'center',
    },
    stickyCtaCard: {
      alignSelf: 'stretch',
      borderRadius: 22,
      overflow: 'hidden',
    },
    saveButtonInner: {
      paddingVertical: 18,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      fontSize: 17,
      fontWeight: '800',
      color: textPrimary,
      letterSpacing: 0.3,
    },
  });
};
