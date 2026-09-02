/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, StatusBar, Animated, Text, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import {
  DEFAULT_SELFCARE_LOCALE,
  getSelfcareLocaleTag,
  SELFCARE_ACTIVITIES,
  SELFCARE_EXERCISES,
  SELFCARE_TIP_KEYS,
  SelfcareTranslationKey,
  translateSelfcareText,
} from '@/lib/selfcareTranslations';

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

let ACTIVE_SELFCARE_LOCALE = DEFAULT_SELFCARE_LOCALE;
let SELFCARE_LOCALE_TAG = getSelfcareLocaleTag(ACTIVE_SELFCARE_LOCALE);
const t = (
  key: SelfcareTranslationKey,
  params?: Record<string, string | number>,
) => translateSelfcareText(ACTIVE_SELFCARE_LOCALE, key, params);

const moodOptions: { value: MoodType; emoji: string; labelKey: SelfcareTranslationKey }[] = [
  { value: 'great', emoji: '😃', labelKey: 'mood.great' },
  { value: 'good', emoji: '🙂', labelKey: 'mood.good' },
  { value: 'okay', emoji: '😐', labelKey: 'mood.okay' },
  { value: 'bad', emoji: '😔', labelKey: 'mood.bad' },
  { value: 'awful', emoji: '😢', labelKey: 'mood.awful' },
];

const movementChoices: { value: boolean; emoji: string; labelKey: SelfcareTranslationKey }[] = [
  { value: true, emoji: '✨', labelKey: 'health.movementYes' },
  { value: false, emoji: '⏳', labelKey: 'health.movementNo' },
];

const WEEK_COLS = 7;
const WEEK_GUTTER = 4;
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

const describeMoodScore = (score: number | null) => {
  if (!score) return t('mood.noData');
  if (score >= 4.5) return t('mood.radiant');
  if (score >= 3.5) return t('mood.positive');
  if (score >= 2.5) return t('mood.mixed');
  if (score >= 1.5) return t('mood.challenging');
  return t('mood.needsCare');
};

const toNumberArray = (values: (number | null | undefined)[]) =>
  values.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

const averageNumber = (values: (number | null | undefined)[]) => {
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
  ACTIVE_SELFCARE_LOCALE = useLocale().locale;
  SELFCARE_LOCALE_TAG = getSelfcareLocaleTag(ACTIVE_SELFCARE_LOCALE);
  const { width: windowWidth } = useWindowDimensions();
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? '#E7D8FA' : PRIMARY;
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
  const pageWidth = Math.min(windowWidth, 720);
  const contentWidth = Math.max(0, pageWidth - 2 * LAYOUT_PAD);
  const weekContentWidth = Math.max(0, contentWidth - TIMELINE_INSET * 2 - 40);
  const weekColWidth = Math.floor(
    (weekContentWidth - (WEEK_COLS - 1) * WEEK_GUTTER) / WEEK_COLS,
  );
  const weekColsWidth = WEEK_COLS * weekColWidth;
  const weekLeftover = Math.max(
    0,
    weekContentWidth - (weekColsWidth + (WEEK_COLS - 1) * WEEK_GUTTER),
  );
  const weekdayLabels = useMemo(() => {
    const monday = new Date(2026, 0, 5);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      return new Intl.DateTimeFormat(SELFCARE_LOCALE_TAG, { weekday: 'short' })
        .format(day)
        .replace('.', '');
    });
  }, []);
  const selfcareActivities = useMemo(
    () => SELFCARE_ACTIVITIES.map((activity) => ({
      id: activity.id,
      title: t(activity.titleKey),
    })),
    [],
  );
  const postpartumExercises = useMemo(
    () => SELFCARE_EXERCISES.map((exercise) => ({
      title: t(exercise.titleKey),
      description: t(exercise.descriptionKey),
    })),
    [],
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
  const [dailyTip, setDailyTip] = useState(() => {
    const tipKey = SELFCARE_TIP_KEYS[Math.floor(Math.random() * SELFCARE_TIP_KEYS.length)];
    return t(tipKey);
  });
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
  const [isSaving, setIsSaving] = useState(false);
  // Animations
  const moodPulse = React.useState(() => new Animated.Value(1))[0];
  const tipOpacity = React.useState(() => new Animated.Value(1))[0];

  // Lade Benutzerdaten
  const loadUserData = useCallback(async () => {
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
  }, [user]);

  const resetEntryState = useCallback(() => {
    setCurrentMood(null);
    setJournalEntry('');
    setSleepHours(7);
    setWaterIntake(0);
    setExerciseDone(false);
    setExerciseTouched(false);
    setCheckedActivities([]);
  }, []);

  // Lade den Eintrag für ein bestimmtes Datum
  const loadEntryForDate = useCallback(async (date: Date) => {
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
  }, [resetEntryState, user]);

  const loadWeekEntries = useCallback(async () => {
    if (!user?.id) return;
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
  }, [user, weekOffset]);

  const loadMonthEntries = useCallback(async () => {
    if (!user?.id) return;
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
  }, [monthOffset, user]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => {
      void loadUserData();
      void loadEntryForDate(selectedDate);
      const tipKey = SELFCARE_TIP_KEYS[Math.floor(Math.random() * SELFCARE_TIP_KEYS.length)];
      setDailyTip(t(tipKey));
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadEntryForDate, loadUserData, selectedDate, user]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => void loadWeekEntries(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadWeekEntries, user]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => void loadMonthEntries(), 0);
    return () => clearTimeout(timeoutId);
  }, [loadMonthEntries, user]);

  // Speichere den Eintrag
  const saveEntry = async () => {
    try {
      if (!user) {
        Alert.alert(t('save.noticeTitle'), t('save.signIn'));
        return;
      }

      setIsSaving(true);

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
        Alert.alert(t('save.errorTitle'), t('save.error'));
      } else {
        Alert.alert(t('save.successTitle'), t('save.success'));
        await loadEntryForDate(targetDate); // Lade den aktualisierten Eintrag
      }
    } catch (err) {
      console.error('Failed to save entry:', err);
      Alert.alert(t('save.errorTitle'), t('save.error'));
    } finally {
      setIsSaving(false);
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
      case 'great': return t('mood.feedback.great');
      case 'good': return t('mood.feedback.good');
      case 'okay': return t('mood.feedback.okay');
      case 'bad': return t('mood.feedback.bad');
      case 'awful': return t('mood.feedback.awful');
      default: return t('mood.question');
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
      const tipKey = SELFCARE_TIP_KEYS[Math.floor(Math.random() * SELFCARE_TIP_KEYS.length)];
      setDailyTip(t(tipKey));
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
  const handleSelectTab = (tab: 'day' | 'week' | 'month') => {
    setSelectedTab(tab);
    if (tab === 'week') setWeekOffset(0);
    if (tab === 'month') setMonthOffset(0);
  };

  const TopTabs = () => (
    <GlassCard
      style={styles.topTabsContainer}
      intensity={22}
      overlayColor={glassOverlay}
      borderColor={glassBorder}
    >
      <View style={styles.topTabsInner}>
        {([
          { id: 'day', labelKey: 'tab.day', icon: 'sun.max.fill' },
          { id: 'week', labelKey: 'tab.week', icon: 'chart.bar.fill' },
          { id: 'month', labelKey: 'tab.month', icon: 'calendar' },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.topTab, selectedTab === tab.id && styles.activeTopTab]}
            onPress={() => handleSelectTab(tab.id)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedTab === tab.id }}
            accessibilityLabel={t(tab.labelKey)}
          >
            <IconSymbol
              name={tab.icon}
              size={15}
              color={selectedTab === tab.id ? textPrimary : iconSecondary}
            />
            <Text style={[styles.topTabText, selectedTab === tab.id && styles.activeTopTabText]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </GlassCard>
  );

  const WeekView = () => {
    const referenceDate = (() => {
      const base = new Date();
      base.setDate(base.getDate() + weekOffset * 7);
      return base;
    })();

    const weekStart = getWeekStart(referenceDate);
    const weekEnd = getWeekEnd(referenceDate);
    const weekDays = getWeekDays(referenceDate);

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
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => setWeekOffset((prev) => prev - 1)}
            accessibilityRole="button"
            accessibilityLabel={t('nav.previousWeek')}
          >
            <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
          </TouchableOpacity>

          <View style={styles.weekHeaderCenter}>
            <ThemedText style={styles.weekHeaderTitle}>{t('nav.weekOverview')}</ThemedText>
            <ThemedText style={styles.weekHeaderSubtitle}>
              {weekStart.toLocaleDateString(SELFCARE_LOCALE_TAG, { day: '2-digit', month: 'short' })} –{' '}
              {weekEnd.toLocaleDateString(SELFCARE_LOCALE_TAG, { day: '2-digit', month: 'short' })}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => setWeekOffset((prev) => prev + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('nav.nextWeek')}
          >
            <ThemedText style={styles.weekNavButtonText}>›</ThemedText>
          </TouchableOpacity>
        </View>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>{t('week.moodTitle')}</ThemedText>
            <ThemedText style={styles.chartSubtitle}>{t('week.averagePerDay')}</ThemedText>
            <View style={[styles.chartArea, { width: weekContentWidth, alignSelf: 'center' }]}>
              {weekDays.map((day, index) => {
                const moodAvg = getMoodAverageForDay(day);
                const height = moodAvg ? (moodAvg / 5) * MAX_BAR_HEIGHT : 0;
                const extra = index < weekLeftover ? 1 : 0;
                const isSelectedDay = isSameDay(day, selectedDate);
                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={{
                      width: weekColWidth + extra,
                      marginRight: index < WEEK_COLS - 1 ? WEEK_GUTTER : 0,
                      alignItems: 'center',
                    }}
                    activeOpacity={0.85}
                    onPress={() => handleWeekDayPress(day)}
                    accessibilityRole="button"
                    accessibilityLabel={day.toLocaleDateString(SELFCARE_LOCALE_TAG, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  >
                    <View
                      style={[
                        styles.chartBarContainer,
                        { width: weekColWidth + extra },
                        isSelectedDay && styles.selectedChartBarContainer,
                      ]}
                    >
                      {height > 0 && (
                        <View
                          style={[
                            styles.chartBar,
                            { height, width: Math.max(10, Math.round(weekColWidth * 0.6)) },
                          ]}
                        />
                      )}
                    </View>
                    <View style={[styles.chartLabelContainer, { width: weekColWidth + extra }]}>
                      <ThemedText style={[styles.chartLabel, isSelectedDay && styles.selectedChartLabel]}>
                        {weekdayLabels[index]}
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
              <ThemedText style={styles.loadingText}>{t('week.loading')}</ThemedText>
            )}
            {!isWeekLoading && weekEntries.length === 0 && (
              <ThemedText style={styles.emptyHint}>{t('week.empty')}</ThemedText>
            )}
          </View>
        </LiquidGlassCard>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>{t('week.metrics')}</ThemedText>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>😌</ThemedText>
                <ThemedText style={styles.statValue}>{describeMoodScore(weekMoodScore)}</ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.averageMood')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💤</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgSleep !== null ? `${avgSleep.toFixed(1)}h` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.sleep')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💧</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgWater !== null ? `${avgWater.toFixed(1)}` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.averageGlasses')}</ThemedText>
              </View>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>🚶‍♀️</ThemedText>
                <ThemedText style={styles.statValue}>{movementDays}</ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.movementDays')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>☑️</ThemedText>
                <ThemedText style={styles.statValue}>
                  {weekEntries.length ? `${checklistPercent}%` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.checklist')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>🗓️</ThemedText>
                <ThemedText style={styles.statValue}>{weekEntries.length}</ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.entries')}</ThemedText>
              </View>
            </View>
          </View>
        </LiquidGlassCard>
      </View>
    );
  };

  const MonthView = () => {
    const referenceMonth = (() => {
      const base = new Date();
      base.setDate(1);
      base.setMonth(base.getMonth() + monthOffset);
      return base;
    })();

    const monthStart = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1);
    const daysInMonth = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + 1, 0).getDate();

    const calendarWeeks = (() => {
      const weeks: (Date | null)[][] = [];
      const firstWeekday = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
      let currentWeek: (Date | null)[] = [];

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
    })();

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
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev) => prev - 1)}
            accessibilityRole="button"
            accessibilityLabel={t('nav.previousMonth')}
          >
            <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
          </TouchableOpacity>

          <View style={styles.monthHeaderCenter}>
            <ThemedText style={styles.monthHeaderTitle}>{t('nav.monthOverview')}</ThemedText>
            <ThemedText style={styles.monthHeaderSubtitle}>
              {referenceMonth.toLocaleDateString(SELFCARE_LOCALE_TAG, { month: 'long', year: 'numeric' })}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.monthNavButton, monthOffset >= 0 && styles.disabledNavButton]}
            disabled={monthOffset >= 0}
            onPress={() => setMonthOffset((prev) => Math.min(prev + 1, 0))}
            accessibilityRole="button"
            accessibilityLabel={t('nav.nextMonth')}
            accessibilityState={{ disabled: monthOffset >= 0 }}
          >
            <ThemedText style={styles.weekNavButtonText}>›</ThemedText>
          </TouchableOpacity>
        </View>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>{t('month.calendar')}</ThemedText>
            <View style={{ width: weekContentWidth, alignSelf: 'center', paddingVertical: 12 }}>
              <View style={styles.weekdayHeader}>
                {weekdayLabels.map((label, index) => {
                  const extra = index < weekLeftover ? 1 : 0;
                  return (
                    <View
                      key={label}
                      style={{
                        width: weekColWidth + extra,
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
                    const extra = dayIndex < weekLeftover ? 1 : 0;
                    return (
                      <View
                        key={`day-${weekIndex}-${dayIndex}`}
                        style={{
                          width: weekColWidth + extra,
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
                                accessibilityRole="button"
                                accessibilityLabel={date.toLocaleDateString(SELFCARE_LOCALE_TAG, {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                })}
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
              <ThemedText style={styles.loadingText}>{t('month.loading')}</ThemedText>
            )}
            {!isMonthLoading && monthEntries.length === 0 && (
              <ThemedText style={styles.emptyHint}>{t('month.empty')}</ThemedText>
            )}
          </View>
        </LiquidGlassCard>

        <LiquidGlassCard style={styles.analyticsCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
          <View style={styles.analyticsInner}>
            <ThemedText style={styles.chartTitle}>{t('month.metrics')}</ThemedText>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>😌</ThemedText>
                <ThemedText style={styles.statValue}>{describeMoodScore(monthMoodScore)}</ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.averageMood')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💤</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgSleep !== null ? `${avgSleep.toFixed(1)}h` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.averageSleep')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💧</ThemedText>
                <ThemedText style={styles.statValue}>
                  {avgWater !== null ? `${avgWater.toFixed(1)}` : '–'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.averageGlasses')}</ThemedText>
              </View>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>🚶‍♀️</ThemedText>
                <ThemedText style={styles.statValue}>{movementDays}</ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.movement')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>💦</ThemedText>
                <ThemedText style={styles.statValue}>{hydratedDays}</ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.hydrated')}</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statEmoji}>☑️</ThemedText>
                <ThemedText style={styles.statValue}>{focusedDays}</ThemedText>
                <ThemedText style={styles.statLabel}>{t('metric.checklistFour')}</ThemedText>
              </View>
            </View>
          </View>
        </LiquidGlassCard>
      </View>
    );
  };

  const todayNormalized = normalizeDate(new Date());
  const isNextDayDisabled = selectedDate.getTime() >= todayNormalized.getTime();
  const selectedDateLabel = selectedDate.toLocaleDateString(SELFCARE_LOCALE_TAG, {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
  const dailyExercise = postpartumExercises[
    Math.abs(Math.floor(selectedDate.getTime() / (24 * 60 * 60 * 1000))) % postpartumExercises.length
  ];

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden={true} />
        
        <Header title={t('screen.title')} subtitle={t('screen.subtitle')} showBackButton />
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {TopTabs()}

          {selectedTab === 'day' && (
            <View style={styles.dayNavigationContainer}>
              <TouchableOpacity
                style={styles.weekNavButton}
                onPress={goToPreviousDay}
                accessibilityRole="button"
                accessibilityLabel={t('nav.previousDay')}
              >
                <ThemedText style={styles.weekNavButtonText}>‹</ThemedText>
              </TouchableOpacity>

              <View style={styles.weekHeaderCenter}>
                <ThemedText style={styles.weekHeaderTitle}>{t('nav.dayOverview')}</ThemedText>
                <View style={styles.dateStatusRow}>
                  <ThemedText style={styles.weekHeaderSubtitle}>{selectedDateLabel}</ThemedText>
                  {isLoading && <ActivityIndicator size="small" color={accentColor} />}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.weekNavButton, isNextDayDisabled && styles.disabledNavButton]}
                onPress={goToNextDay}
                disabled={isNextDayDisabled}
                accessibilityRole="button"
                accessibilityLabel={t('nav.nextDay')}
                accessibilityState={{ disabled: isNextDayDisabled }}
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
                  <View style={styles.heroHeader}>
                    <View style={styles.heroIconBadge}>
                      <IconSymbol name="heart.fill" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.heroHeading}>
                      <ThemedText style={styles.heroEyebrow}>{t('hero.eyebrow')}</ThemedText>
                      <ThemedText style={[styles.cardTitle, styles.heroTitle]}>
                        {userName
                          ? t('hero.greetingName', { name: userName })
                          : t('hero.greetingFallback')}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.cardSubtitle, styles.heroSubtitle]}>
                    {t('hero.subtitle')}
                  </ThemedText>
                  <View style={styles.heroProgressRow}>
                    <View style={styles.heroProgressTrack}>
                      <View
                        style={[
                          styles.heroProgressFill,
                          { width: `${(checkedActivities.length / selfcareActivities.length) * 100}%` },
                        ]}
                      />
                    </View>
                    <ThemedText style={styles.heroProgressText}>
                      {t('hero.progress', {
                        completed: checkedActivities.length,
                        total: selfcareActivities.length,
                      })}
                    </ThemedText>
                  </View>

                  <ThemedText style={styles.moodQuestion}>{t('mood.question')}</ThemedText>

                  <View style={styles.moodContainer}>
                    {moodOptions.map((mood) => {
                      const isSelected = currentMood === mood.value;
                      const moodLabel = t(mood.labelKey);
                      return (
                        <TouchableOpacity
                          key={mood.value}
                          style={[styles.moodButton, isSelected && styles.selectedMoodButton]}
                          onPress={() => selectMood(mood.value)}
                          activeOpacity={0.85}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={t('a11y.selectMood', { mood: moodLabel })}
                        >
                          <Animated.Text
                            style={[styles.moodEmoji, isSelected && { transform: [{ scale: moodPulse }] }]}
                          >
                            {mood.emoji}
                          </Animated.Text>
                          <ThemedText
                            style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                          >
                            {moodLabel}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {currentMood && (
                    <View style={styles.moodFeedbackCard}>
                      <IconSymbol name="sparkles" size={16} color={accentColor} />
                      <ThemedText style={styles.moodFeedback}>
                        {getMoodFeedback(currentMood)}
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.sectionHeadingRow}>
                    <View style={styles.sectionIconBadge}>
                      <IconSymbol name="pencil" size={16} color={accentColor} />
                    </View>
                    <ThemedText style={styles.sectionTitle}>{t('journal.title')}</ThemedText>
                  </View>
                  <TextInput
                    style={styles.glassInput}
                    value={journalEntry}
                    onChangeText={setJournalEntry}
                    placeholder={t('journal.placeholder')}
                    placeholderTextColor={placeholderColor}
                    multiline
                    numberOfLines={4}
                  />
                </View>
              </LiquidGlassCard>

              {/* 2. Selbstfürsorge-Tipps & Anleitungen */}
              <LiquidGlassCard style={styles.glassCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
                <View style={styles.glassInner}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIcon, styles.tipHeaderIcon]}>
                      <IconSymbol name="lightbulb.fill" size={19} color="#8B6511" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.cardTitleLeft]}>{t('tip.title')}</ThemedText>
                  </View>

                  <View style={styles.tipContainer}>
                    <IconSymbol name="sparkles" size={22} color={accentColor} />
                    <Animated.View style={{ flex: 1, opacity: tipOpacity }}>
                      <ThemedText style={styles.tipText}>{dailyTip}</ThemedText>
                    </Animated.View>
                  </View>

                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={refreshTipAnimated}
                    accessibilityRole="button"
                    accessibilityLabel={t('tip.refresh')}
                  >
                    <IconSymbol name="arrow.clockwise" size={16} color={iconSecondary} />
                    <ThemedText style={styles.refreshButtonText}>{t('tip.refresh')}</ThemedText>
                  </TouchableOpacity>
                </View>
              </LiquidGlassCard>

              {/* 3. Gesundheit & Wohlbefinden */}
              <LiquidGlassCard style={styles.glassCard} intensity={26} overlayColor={glassOverlay} borderColor={glassBorder}>
                <View style={styles.glassInner}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIcon, styles.healthHeaderIcon]}>
                      <IconSymbol name="waveform.path.ecg" size={19} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.cardTitleLeft]}>{t('health.title')}</ThemedText>
                  </View>

                  <View style={styles.healthStack}>
                    <View style={styles.healthCard}>
                      <View style={styles.healthHeader}>
                        <View style={[styles.healthIcon, { backgroundColor: 'rgba(135, 206, 235, 0.55)' }]}>
                          <IconSymbol name="moon.fill" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.healthTitle}>{t('health.sleep')}</ThemedText>
                          <ThemedText style={styles.healthSubtitle}>{t('health.lastNight')}</ThemedText>
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
                          accessibilityRole="button"
                          accessibilityLabel={t('a11y.decreaseSleep')}
                        >
                          <IconSymbol name="minus" size={16} color={iconSecondary} />
                        </TouchableOpacity>
                        <ThemedText style={styles.healthControlValue}>
                          {t('health.hours', { count: sleepHours })}
                        </ThemedText>
                        <TouchableOpacity
                          style={styles.controlCircle}
                          onPress={() => setSleepHours(Math.min(24, sleepHours + 1))}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={t('a11y.increaseSleep')}
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
                          <ThemedText style={styles.healthTitle}>{t('health.water')}</ThemedText>
                          <ThemedText style={styles.healthSubtitle}>{t('health.waterGoal')}</ThemedText>
                        </View>
                        <View style={styles.healthValueBadge}>
                          <ThemedText style={styles.healthValueText}>
                            {t('health.glasses', { count: waterIntake })}
                          </ThemedText>
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
                          {waterIntake >= 8
                            ? t('health.waterComplete')
                            : t('health.waterRemaining', { count: 8 - waterIntake })}
                        </ThemedText>
                      </View>
                      <View style={styles.healthControlsRow}>
                        <TouchableOpacity
                          style={styles.controlCircle}
                          onPress={() => setWaterIntake(Math.max(0, waterIntake - 1))}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={t('a11y.decreaseWater')}
                        >
                          <IconSymbol name="minus" size={16} color={iconSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.controlPrimary}
                          onPress={() => setWaterIntake(waterIntake + 1)}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                          accessibilityLabel={t('health.addGlass')}
                        >
                          <IconSymbol name="plus.circle.fill" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.controlPrimaryText}>{t('health.addGlass')}</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.healthCard}>
                      <View style={styles.healthHeader}>
                        <View style={[styles.healthIcon, { backgroundColor: 'rgba(168, 196, 162, 0.65)' }]}>
                          <IconSymbol name="figure.walk" size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.healthTitle}>{t('health.movement')}</ThemedText>
                          <ThemedText style={styles.healthSubtitle}>{t('health.movementSubtitle')}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.segmentRow}>
                        {movementChoices.map((choice) => (
                          <TouchableOpacity
                            key={String(choice.value)}
                            style={[
                              styles.segmentButton,
                              exerciseTouched && exerciseDone === choice.value && styles.segmentButtonActive,
                            ]}
                            onPress={() => handleMovementSelect(choice.value)}
                            activeOpacity={0.9}
                            accessibilityRole="radio"
                            accessibilityState={{
                              selected: exerciseTouched && exerciseDone === choice.value,
                            }}
                            accessibilityLabel={t(choice.labelKey)}
                          >
                            <ThemedText style={styles.segmentEmoji}>{choice.emoji}</ThemedText>
                            <ThemedText
                              style={[
                                styles.segmentLabel,
                                exerciseTouched && exerciseDone === choice.value && styles.segmentLabelActive,
                              ]}
                            >
                              {t(choice.labelKey)}
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
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.cardHeaderIcon, styles.recoveryHeaderIcon]}>
                      <IconSymbol name="figure.walk" size={19} color="#FFFFFF" />
                    </View>
                    <ThemedText style={[styles.cardTitle, styles.cardTitleLeft]}>{t('recovery.title')}</ThemedText>
                  </View>

                  <View style={styles.sectionHeadingRow}>
                    <View style={styles.sectionIconBadge}>
                      <IconSymbol name="sparkles" size={16} color={accentColor} />
                    </View>
                    <ThemedText style={styles.sectionTitle}>{t('recovery.exerciseToday')}</ThemedText>
                  </View>
                  <View style={styles.exerciseCard}>
                    <ThemedText style={styles.exerciseTitle}>
                      {dailyExercise.title}
                    </ThemedText>
                    <ThemedText style={styles.exerciseDescription}>
                      {dailyExercise.description}
                    </ThemedText>
                  </View>

                  <View style={styles.sectionHeadingRow}>
                    <View style={styles.sectionIconBadge}>
                      <IconSymbol name="checklist" size={16} color={accentColor} />
                    </View>
                    <ThemedText style={styles.sectionTitle}>{t('checklist.title')}</ThemedText>
                  </View>
                  <View style={styles.checklistProgressCard}>
                    <ProgressCircle
                      progress={(checkedActivities.length / selfcareActivities.length) * 100}
                      size={62}
                      strokeWidth={6}
                      progressColor={isDark ? '#B892F5' : '#8E4EC6'}
                      backgroundColor={isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.25)'}
                      textColor={'transparent'}
                    />
                    <View style={styles.checklistProgressCopy}>
                      <ThemedText style={styles.checklistProgressValue}>
                        {t('checklist.progress', {
                          completed: checkedActivities.length,
                          total: selfcareActivities.length,
                        })}
                      </ThemedText>
                      <ThemedText style={styles.checklistProgressHint}>{t('hero.subtitle')}</ThemedText>
                    </View>
                  </View>
                  {selfcareActivities.map(activity => (
                    <TouchableOpacity
                      key={activity.id}
                      style={[
                        styles.checklistItem,
                        checkedActivities.includes(activity.id) && styles.checklistItemDone,
                      ]}
                      onPress={() => toggleActivity(activity.id)}
                      activeOpacity={0.85}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: checkedActivities.includes(activity.id) }}
                      accessibilityLabel={activity.title}
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
            WeekView()
          ) : (
            MonthView()
          )}
        </ScrollView>

        {selectedTab === 'day' && (
          <View style={styles.stickyCtaContainer}>
            <LiquidGlassCard 
              style={[styles.stickyCtaCard, isSaving && styles.stickyCtaCardDisabled]}
              onPress={isSaving ? undefined : saveEntry}
              intensity={26}
              overlayColor={actionOverlay}
              borderColor={actionBorder}
            >
              <View style={styles.saveButtonInner}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={textPrimary} />
                ) : (
                  <IconSymbol name="heart.fill" size={18} color={accentColor} />
                )}
                <ThemedText style={styles.saveButtonText}>
                  {isSaving ? t('save.saving') : t('save.action')}
                </ThemedText>
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
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: LAYOUT_PAD,
      paddingTop: 0,
      paddingBottom: 160,
    },
    topTabsContainer: {
      borderRadius: 22,
      marginTop: 6,
      marginBottom: 16,
    },
    topTabsInner: {
      flexDirection: 'row',
      padding: 4,
      gap: 4,
    },
    dayNavigationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      marginTop: 0,
    },
    topTab: {
      flex: 1,
      minHeight: 42,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1.2,
      borderColor: 'transparent',
    },
    activeTopTab: {
      borderColor: isDark ? 'rgba(193,149,247,0.68)' : 'rgba(94,61,179,0.65)',
      backgroundColor: accentSoft,
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
    dateStatusRow: {
      minHeight: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
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
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroIconBadge: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(169,122,236,0.82)' : 'rgba(142,78,198,0.78)',
      borderWidth: 1.3,
      borderColor: primaryButtonBorder,
    },
    heroHeading: {
      flex: 1,
      gap: 2,
    },
    heroEyebrow: {
      color: textAccent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    heroTitle: {
      textAlign: 'left',
      marginBottom: 0,
      fontSize: 20,
    },
    heroSubtitle: {
      textAlign: 'left',
      marginTop: 12,
      marginBottom: 12,
    },
    heroProgressRow: {
      marginBottom: 20,
      gap: 7,
    },
    heroProgressTrack: {
      height: 7,
      borderRadius: 5,
      overflow: 'hidden',
      backgroundColor: meterTrack,
    },
    heroProgressFill: {
      height: '100%',
      borderRadius: 5,
      backgroundColor: meterFill,
    },
    heroProgressText: {
      color: textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: textPrimary,
      marginBottom: 15,
      textAlign: 'center',
    },
    cardTitleLeft: {
      flex: 1,
      textAlign: 'left',
      marginBottom: 0,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    cardHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.2,
      borderColor: glassBorderStrong,
    },
    tipHeaderIcon: {
      backgroundColor: isDark ? 'rgba(250,204,21,0.72)' : 'rgba(253,224,71,0.62)',
    },
    healthHeaderIcon: {
      backgroundColor: isDark ? 'rgba(74,144,226,0.72)' : 'rgba(84,160,220,0.68)',
    },
    recoveryHeaderIcon: {
      backgroundColor: isDark ? 'rgba(91,155,102,0.78)' : 'rgba(110,164,119,0.72)',
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
      gap: 6,
      marginBottom: 15,
    },
    moodQuestion: {
      color: textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
    },
    moodButton: {
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: glassSurfaceStrong,
      borderWidth: 1,
      borderColor: glassBorder,
      gap: 3,
    },
    selectedMoodButton: {
      backgroundColor: accentSoft,
      borderWidth: 1,
      borderColor: accentBorder,
    },
    moodEmoji: {
      fontSize: 24,
    },
    moodLabel: {
      alignSelf: 'stretch',
      color: textSecondary,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    moodLabelSelected: {
      color: textPrimary,
    },
    moodFeedbackCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: accentBorder,
      backgroundColor: accentSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14,
    },
    moodFeedback: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: textSecondary,
    },
    sectionHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
      marginBottom: 10,
    },
    sectionIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: accentSoft,
      borderWidth: 1,
      borderColor: accentBorder,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: textSecondary,
      textAlign: 'left',
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
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassSurface,
    },
    checklistItemDone: {
      borderColor: isDark ? 'rgba(105,219,149,0.4)' : 'rgba(56,161,105,0.32)',
      backgroundColor: isDark ? 'rgba(56,161,105,0.14)' : 'rgba(56,161,105,0.08)',
    },
    checklistText: {
      flex: 1,
      fontSize: 15,
      marginLeft: 10,
      color: textSecondary,
    },
    checklistTextDone: {
      textDecorationLine: 'line-through',
      opacity: 0.7,
    },
    checklistProgressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 12,
      marginBottom: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassSurfaceStrong,
    },
    checklistProgressCopy: {
      flex: 1,
      gap: 3,
    },
    checklistProgressValue: {
      color: textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    checklistProgressHint: {
      color: textSecondary,
      fontSize: 12,
      lineHeight: 17,
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
      width: '100%',
      maxWidth: 680,
      alignSelf: 'stretch',
      borderRadius: 22,
      overflow: 'hidden',
    },
    stickyCtaCardDisabled: {
      opacity: 0.72,
    },
    saveButtonInner: {
      paddingVertical: 18,
      paddingHorizontal: 20,
      flexDirection: 'row',
      gap: 9,
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
