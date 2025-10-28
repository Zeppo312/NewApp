import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TablerIcon } from '@/components/ui/TablerIcon';
import { getBabyInfo, getDiaryEntries, getCurrentPhase, getPhaseProgress, getMilestonesByPhase, getDailyEntries } from '@/lib/baby';
import { supabase } from '@/lib/supabase';
import { BlurView } from 'expo-blur';
import ActivityInputModal from '@/components/ActivityInputModal';
import SleepQuickAddModal, { SleepQuickEntry } from '@/components/SleepQuickAddModal';

// Tägliche Tipps für Mamas
const dailyTips = [
  "Nimm dir heute 10 Minuten nur für dich – eine kleine Auszeit kann Wunder wirken!",
  "Trinke ausreichend Wasser – besonders wichtig für dich und dein Baby.",
  "Ein kurzer Spaziergang an der frischen Luft kann deine Stimmung heben.",
  "Bitte um Hilfe, wenn du sie brauchst – du musst nicht alles alleine schaffen.",
  "Genieße die kleinen Momente mit deinem Baby – sie wachsen so schnell.",
  "Schlaf, wann immer dein Baby schläft – Ruhe ist wichtig für dich.",
  "Lass die Hausarbeit auch mal liegen – dein Wohlbefinden hat Vorrang.",
  "Feiere jeden kleinen Fortschritt – sowohl deinen als auch den deines Babys.",
  "Vertraue deinem Instinkt – du kennst dein Baby am besten.",
  "Vergiss nicht zu essen – deine Energie ist wichtig für dich und dein Baby."
];

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { isBabyBorn } = useBabyStatus();
  const router = useRouter();

  const [babyInfo, setBabyInfo] = useState<any>(null);
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);
  const [dailyEntries, setDailyEntries] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<any>(null);
  const [phaseProgress, setPhaseProgress] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyTip, setDailyTip] = useState("");
  const [userName, setUserName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'diaper' | 'other'>('feeding');
  const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
  const [todaySleepMinutes, setTodaySleepMinutes] = useState(0);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepModalStart, setSleepModalStart] = useState(new Date());

  useEffect(() => {
    if (user) {
      loadData();
      // Wähle einen zufälligen Tipp für den Tag
      const randomTip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
      setDailyTip(randomTip);
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Funktion für Pull-to-Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Lade die Daten neu
      await loadData();
      // Wähle einen neuen zufälligen Tipp
      const randomTip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
      setDailyTip(randomTip);
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadData = async () => {
    try {
      if (!refreshing) {
        setIsLoading(true);
      }

      // Benutzernamen laden
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Error loading user profile:', profileError);
      } else if (profileData && profileData.first_name) {
        setUserName(profileData.first_name);
      }

      // Baby-Informationen laden
      const { data: babyData } = await getBabyInfo();
      setBabyInfo(babyData);

      // Tagebucheinträge laden (nur die neuesten 5)
      const { data: diaryData } = await getDiaryEntries();
      if (diaryData) {
        setDiaryEntries(diaryData.slice(0, 5));
      }

      // Alltags-Einträge für heute laden
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: dailyData, error: dailyError } = await supabase
        .from('baby_care_entries')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false });

      if (!dailyError && dailyData) {
        setDailyEntries(dailyData);
      }

      await fetchTodaySleepMinutes(startOfDay, endOfDay);

      // Aktuelle Entwicklungsphase laden
      const { data: phaseData } = await getCurrentPhase();
      if (phaseData) {
        setCurrentPhase(phaseData);

        // Fortschritt für die aktuelle Phase berechnen
        const { progress, completedCount, totalCount } = await getPhaseProgress(phaseData.phase_id);
        setPhaseProgress({ progress, completedCount, totalCount });

        // Meilensteine für die aktuelle Phase laden
        const { data: milestonesData } = await getMilestonesByPhase(phaseData.phase_id);
        if (milestonesData) {
          setMilestones(milestonesData);
        }
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Formatiere das aktuelle Datum
  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('de-DE', options);
  };

  // Berechne die Anzahl der heutigen Mahlzeiten
  const getTodayFeedings = () => {
    return dailyEntries.filter(entry => entry.entry_type === 'feeding').length;
  };

  // Berechne die Anzahl der heutigen Windelwechsel
  const getTodayDiaperChanges = () => {
    return dailyEntries.filter(entry => entry.entry_type === 'diaper').length;
  };

  const formatMinutes = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Berechne die Anzahl der heutigen Einträge (für Referenz, wird nicht mehr angezeigt)
  const getTodayEntries = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return diaryEntries.filter(entry => {
      const entryDate = new Date(entry.entry_date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    }).length;
  };

  // Berechne die Anzahl der heute erreichten Meilensteine (für Referenz, wird nicht mehr angezeigt)
  const getTodayMilestones = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return milestones.filter(milestone => {
      if (!milestone.completion_date) return false;
      const completionDate = new Date(milestone.completion_date);
      completionDate.setHours(0, 0, 0, 0);
      return completionDate.getTime() === today.getTime();
    }).length;
  };

  // Handle stat item press
  const handleStatPress = (type: 'feeding' | 'diaper' | 'sleep') => {
    if (type === 'sleep') {
      setSleepModalStart(new Date());
      setShowSleepModal(true);
      return;
    }
    setSelectedActivityType(type);
    setSelectedSubType(null);
    setShowInputModal(true);
  };

  // Load only daily entries (for quick refresh after adding entries)
  const loadDailyEntriesOnly = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('Loading daily entries for date:', today.toISOString());

      // Direct query to baby_care_entries table to ensure fresh data
      const { data: dailyData, error } = await supabase
        .from('baby_care_entries')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error loading daily entries:', error);
        return;
      }

      if (dailyData) {
        console.log('Loaded daily entries:', dailyData.length, 'entries');
        setDailyEntries(dailyData);
      }

      await fetchTodaySleepMinutes(startOfDay, endOfDay);
    } catch (err) {
      console.error('Failed to load daily entries:', err);
    }
  };

  const fetchTodaySleepMinutes = async (startOfDay: Date, endOfDay: Date) => {
    try {
      if (!user?.id) {
        setTodaySleepMinutes(0);
        return;
      }

      const startIso = startOfDay.toISOString();
      const endIso = endOfDay.toISOString();
      const overlapFilter = [
        `and(start_time.lte.${endIso},end_time.is.null)`,
        `and(start_time.lte.${endIso},end_time.gte.${startIso})`
      ].join(',');

      const { data, error } = await supabase
        .from('sleep_entries')
        .select('start_time,end_time')
        .eq('user_id', user.id)
        .or(overlapFilter);

      if (error || !data) {
        console.error('Error loading sleep entries for today:', error);
        setTodaySleepMinutes(0);
        return;
      }

      const totalMinutes = data.reduce((sum, entry) => {
        const entryStart = new Date(entry.start_time);
        const rawEnd = entry.end_time ? new Date(entry.end_time) : new Date();
        const clampedStart = entryStart < startOfDay ? startOfDay : entryStart;
        const clampedEnd = rawEnd > endOfDay ? endOfDay : rawEnd;
        const diff = clampedEnd.getTime() - clampedStart.getTime();
        return diff > 0 ? sum + Math.round(diff / 60000) : sum;
      }, 0);

      setTodaySleepMinutes(totalMinutes);
    } catch (error) {
      console.error('Failed to calculate today sleep minutes:', error);
      setTodaySleepMinutes(0);
    }
  };

  // Handle save entry from modal
  const handleSaveEntry = async (payload: any) => {
    console.log('handleSaveEntry - Received payload:', JSON.stringify(payload, null, 2));
    console.log('handleSaveEntry - selectedActivityType:', selectedActivityType);
    console.log('handleSaveEntry - selectedSubType:', selectedSubType);

    // Close modal
    setShowInputModal(false);
    setSelectedActivityType('feeding');
    setSelectedSubType(null);

    // Quick reload of daily entries to show the new entry immediately
    await loadDailyEntriesOnly();
  };

  const handleSaveSleepQuickEntry = async (entry: SleepQuickEntry) => {
    if (!user?.id) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um Schlaf zu speichern.');
      return;
    }
    try {
      const payload = {
        user_id: user.id,
        start_time: entry.start.toISOString(),
        end_time: entry.end ? entry.end.toISOString() : null,
        quality: entry.quality,
        notes: entry.notes || null,
        duration_minutes: entry.end ? Math.max(0, Math.round((entry.end.getTime() - entry.start.getTime()) / 60000)) : null,
      };

      const { error } = await supabase.from('sleep_entries').insert(payload);
      if (error) {
        console.error('Error saving sleep entry:', error);
        Alert.alert('Fehler', 'Schlaf konnte nicht gespeichert werden.');
        return;
      }

      setShowSleepModal(false);

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      await fetchTodaySleepMinutes(startOfDay, endOfDay);
    } catch (err) {
      console.error('Failed to save sleep entry:', err);
      Alert.alert('Fehler', 'Schlafeintrag konnte nicht gespeichert werden.');
    }
  };

  // Rendere den Begrüßungsbereich
  const renderGreetingSection = () => {
    // Verwende den Benutzernamen aus der profiles-Tabelle
    const displayName = userName || 'Mama';

    return (
      <View style={styles.liquidGlassWrapper}>
        <BlurView 
          intensity={22} 
          tint={colorScheme === 'dark' ? 'dark' : 'light'} 
          style={styles.liquidGlassBackground}
        >
          <ThemedView style={[styles.greetingContainer, styles.liquidGlassContainer]} 
                     lightColor="rgba(255, 255, 255, 0.04)" 
                     darkColor="rgba(255, 255, 255, 0.02)">
            <View style={styles.greetingHeader}>
              <View>
                <ThemedText style={[styles.greeting, styles.liquidGlassText, { color: '#6B4C3B' }]}>
                  Hallo {displayName}!
                </ThemedText>
                <ThemedText style={[styles.dateText, styles.liquidGlassSecondaryText, { color: '#6B4C3B' }]}>
                  {formatDate()}
                </ThemedText>
              </View>

              {babyInfo?.photo_url && (
                <View style={styles.profileImageWrapper}>
                                     <Image
                     source={{ uri: babyInfo.photo_url }}
                     style={styles.profileImage}
                   />
                </View>
              )}

              {!babyInfo?.photo_url && (
                <View style={[styles.profileImage, styles.profilePlaceholder, styles.liquidGlassProfilePlaceholder]}>
                  <IconSymbol name="person.fill" size={30} color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.tipContainerWrapper}>
              <BlurView 
                intensity={14} 
                tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                style={styles.tipContainerBlur}
              >
                <ThemedView style={[styles.tipContainer, styles.liquidGlassTipContainer]} 
                           lightColor="rgba(168, 196, 193, 0.45)" 
                           darkColor="rgba(168, 196, 193, 0.45)">
                  <IconSymbol name="lightbulb.fill" size={20} color={Colors.light.success} />
                  <ThemedText style={[styles.tipText, styles.liquidGlassTipText, { color: '#6B4C3B' }]}>
                    {dailyTip}
                  </ThemedText>
                </ThemedView>
              </BlurView>
            </View>
          </ThemedView>
        </BlurView>
      </View>
    );
  };

  // Rendere die Tagesübersicht
  const renderDailySummary = () => {
    const todayFeedings = getTodayFeedings();
    const todayDiaperChanges = getTodayDiaperChanges();

    return (
      <View style={styles.liquidGlassWrapper}>
        <BlurView 
          intensity={22} 
          tint={colorScheme === 'dark' ? 'dark' : 'light'} 
          style={styles.liquidGlassBackground}
        >
          <ThemedView style={[styles.summaryContainer, styles.liquidGlassContainer]} 
                      lightColor="rgba(255, 255, 255, 0.04)" 
                      darkColor="rgba(255, 255, 255, 0.02)">
            <View style={styles.sectionTitleContainer}>
              <ThemedText style={[styles.sectionTitle, styles.liquidGlassText, { color: '#6B4C3B', fontSize: 22 }]}> 
                Dein Tag im Überblick
              </ThemedText>
              <TouchableOpacity
                style={styles.liquidGlassChevron}
                onPress={() => router.push('/(tabs)/daily_old')}
                activeOpacity={0.8}
              >
                <IconSymbol name="chevron.right" size={20} color="#6B4C3B" />
              </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, {
                  backgroundColor: 'rgba(94, 61, 179, 0.13)',
                  borderColor: 'rgba(94, 61, 179, 0.35)'
                }]}
                onPress={() => handleStatPress('feeding')}
                activeOpacity={0.8}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji}>🍼</Text>
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, {
                  color: '#5E3DB3',
                  textShadowColor: 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }]}>{todayFeedings}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Essen</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, {
                  backgroundColor: 'rgba(94, 61, 179, 0.08)',
                  borderColor: 'rgba(94, 61, 179, 0.22)'
                }]}
                onPress={() => handleStatPress('diaper')}
                activeOpacity={0.8}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji}>💩</Text>
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, {
                  color: '#5E3DB3',
                  textShadowColor: 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }]}>{todayDiaperChanges}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Windeln</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, { 
                  backgroundColor: 'rgba(94, 61, 179, 0.05)', 
                  borderColor: 'rgba(94, 61, 179, 0.15)' 
                }]}
                onPress={() => handleStatPress('sleep')}
                activeOpacity={0.8}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji}>💤</Text>
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, { 
                  color: '#5E3DB3',
                  textShadowColor: 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }]}>{formatMinutes(todaySleepMinutes)}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Schlaf</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </BlurView>
      </View>
    );
  };

  // Rendere die Schnellzugriff-Karten
  const renderQuickAccessCards = () => {
    return (
      <View style={styles.cardsSection}>
           <ThemedText style={[styles.cardsSectionTitle, styles.liquidGlassText, { color: '#7D5A50', fontSize: 22 }]}> 
          Schnellzugriff
        </ThemedText>

        <View style={styles.cardsGrid}>
          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/(tabs)/feeding-stats' as any)}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="cup.and.saucer.fill" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Mahlzeiten</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Statistiken ansehen</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/(tabs)/baby')}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="person.fill" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Mein Baby</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Alle Infos & Entwicklungen</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/planner')}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(200, 130, 220, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="calendar" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Planer</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Tagesplan & To‑dos</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/(tabs)/daily_old')}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 215, 180, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 180, 130, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="list.bullet" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Unser Tag</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Tagesaktivitäten verwalten</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/(tabs)/selfcare')}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 210, 230, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 160, 180, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="heart.fill" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Mama Selfcare</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Nimm dir Zeit für dich</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/(tabs)/babyweather')}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={16} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(200, 225, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(140, 190, 255, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="cloud.sun.fill" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Babywetter</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Aktuelle Wetterinfos</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade deine persönliche Übersicht...</ThemedText>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#7D5A50']}
                tintColor={theme.text}
                title="Aktualisiere..."
                titleColor={theme.text}
              />
            }
          >
            {renderGreetingSection()}
            {renderDailySummary()}
            {renderQuickAccessCards()}
          </ScrollView>
        )}

        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          initialSubType={selectedSubType}
          date={new Date()}
          onClose={() => {
            setShowInputModal(false);
            setSelectedActivityType('feeding');
            setSelectedSubType(null);
          }}
          onSave={handleSaveEntry}
        />
        <SleepQuickAddModal
          visible={showSleepModal}
          initialStart={sleepModalStart}
          onClose={() => setShowSleepModal(false)}
          onSave={handleSaveSleepQuickEntry}
        />
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
    backgroundColor: '#f5eee0', // Beige Hintergrund wie im Bild
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },

  // Liquid Glass styles - Core Components
  liquidGlassWrapper: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassBackground: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)', // stärkerer Frostglas-Effekt
  },
  liquidGlassContainer: {
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },

  // Begrüßungsbereich - Liquid Glass Design
  greetingContainer: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 28,
    backgroundColor: 'transparent',
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 16,
    opacity: 0.8,
    fontWeight: '500',
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileImageWrapper: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  profilePlaceholder: {
    backgroundColor: 'rgba(125, 90, 80, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(125, 90, 80, 0.6)',
  },
  liquidGlassProfilePlaceholder: {
    backgroundColor: 'rgba(125, 90, 80, 0.8)',
    borderColor: 'rgba(125, 90, 80, 0.6)',
  },

  // Tip Container - Enhanced Liquid Glass
  tipContainerWrapper: {
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(168, 196, 193, 0.45)',
  },
  tipContainerBlur: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  liquidGlassTipContainer: {
    borderRadius: 18,
  },
  tipText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
  },
  liquidGlassTipText: {
    color: 'rgba(255, 255, 255, 0.95)',
  },

  // Tagesübersicht - Liquid Glass Design
  summaryContainer: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 16,

  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.9,
  },

  // Enhanced Liquid Glass Text Styles
  liquidGlassText: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
  },
  liquidGlassSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },

  // Stats with Liquid Glass Enhancement
  liquidGlassStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    minHeight: 66,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liquidGlassStatIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 32,
    padding: 14,
    marginBottom: 6,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  statEmoji: {
    fontSize: 32,
    lineHeight: 34,
    textAlign: 'center',
  },
  liquidGlassStatValue: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
    marginBottom: 2,
    lineHeight: 26,
  },
  liquidGlassStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  liquidGlassChevron: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // Quick Access Cards Section
  cardsSection: {
    marginBottom: 16,
  },
  cardsSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    color: '#6B4C3B',
    letterSpacing: -0.3,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },

  // Liquid Glass Cards
  liquidGlassCardWrapper: {
    width: '48%',
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassCardBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    height: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  liquidGlassIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '500',
  },
});
