import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getBabyInfo, getDiaryEntries, getCurrentPhase, getPhaseProgress, getMilestonesByPhase, getDailyEntries } from '@/lib/baby';
import { supabase } from '@/lib/supabase';
import { BlurView } from 'expo-blur';

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
      const { data: dailyData } = await getDailyEntries(undefined, today);
      if (dailyData) {
        setDailyEntries(dailyData);
      }

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

  // Rendere den Begrüßungsbereich
  const renderGreetingSection = () => {
    // Verwende den Benutzernamen aus der profiles-Tabelle
    const displayName = userName || 'Mama';

    return (
      <View style={styles.liquidGlassWrapper}>
        <BlurView 
          intensity={80} 
          tint={colorScheme === 'dark' ? 'dark' : 'light'} 
          style={styles.liquidGlassBackground}
        >
          <ThemedView style={[styles.greetingContainer, styles.liquidGlassContainer]} 
                     lightColor="rgba(255, 255, 255, 0.25)" 
                     darkColor="rgba(0, 0, 0, 0.25)">
            <View style={styles.greetingHeader}>
              <View>
                <ThemedText style={[styles.greeting, styles.liquidGlassText, { color: colorScheme === 'dark' ? '#FFFFFF' : '#1a1a1a' }]}>
                  Hallo {displayName}!
                </ThemedText>
                <ThemedText style={[styles.dateText, styles.liquidGlassSecondaryText]}>
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
                intensity={60} 
                tint={colorScheme === 'dark' ? 'dark' : 'light'} 
                style={styles.tipContainerBlur}
              >
                <ThemedView style={[styles.tipContainer, styles.liquidGlassTipContainer]} 
                           lightColor="rgba(157, 190, 187, 0.4)" 
                           darkColor="rgba(157, 190, 187, 0.3)">
                  <IconSymbol name="lightbulb.fill" size={20} color={colorScheme === 'dark' ? '#FFD700' : Colors.light.success} />
                  <ThemedText style={[styles.tipText, styles.liquidGlassTipText]}>
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
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/daily_old')}
        activeOpacity={0.9}
        style={styles.liquidGlassWrapper}
      >
        <BlurView 
          intensity={80} 
          tint={colorScheme === 'dark' ? 'dark' : 'light'} 
          style={styles.liquidGlassBackground}
        >
          <ThemedView style={[styles.summaryContainer, styles.liquidGlassContainer]} 
                     lightColor="rgba(255, 255, 255, 0.25)" 
                     darkColor="rgba(0, 0, 0, 0.25)">
            <View style={styles.sectionTitleContainer}>
              <ThemedText style={[styles.sectionTitle, styles.liquidGlassText]}>
                Dein Tag im Überblick
              </ThemedText>
              <View style={styles.liquidGlassChevron}>
                <IconSymbol name="chevron.right" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#1a1a1a'} />
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={[styles.statItem, styles.liquidGlassStatItem]}>
                <View style={styles.liquidGlassStatIcon}>
                  <IconSymbol name="drop.fill" size={24} color="#FF9800" />
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue]}>{todayFeedings}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel]}>Essen</ThemedText>
              </View>

              <View style={[styles.statItem, styles.liquidGlassStatItem]}>
                <View style={styles.liquidGlassStatIcon}>
                  <IconSymbol name="heart.fill" size={24} color="#4CAF50" />
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue]}>{todayDiaperChanges}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel]}>Windeln</ThemedText>
              </View>

              {currentPhase && phaseProgress && (
                <View style={[styles.statItem, styles.liquidGlassStatItem]}>
                  <View style={styles.liquidGlassStatIcon}>
                    <IconSymbol name="moon.fill" size={24} color="#6366f1" />
                  </View>
                  <ThemedText style={[styles.statValue, styles.liquidGlassStatValue]}>0m</ThemedText>
                  <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel]}>Schlaf</ThemedText>
                </View>
              )}
            </View>
          </ThemedView>
        </BlurView>
      </TouchableOpacity>
    );
  };

  // Rendere die Schnellzugriff-Karten
  const renderQuickAccessCards = () => {
    return (
      <View style={styles.cardsSection}>
        <ThemedText style={[styles.cardsSectionTitle, styles.liquidGlassText]}>
          Schnellzugriff
        </ThemedText>

        <View style={styles.cardsGrid}>
          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/diary-entries')}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={70} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(157, 190, 187, 0.6)' }]}>
                <View style={[styles.iconContainer, styles.liquidGlassIconContainer]}>
                  <IconSymbol name="cup.and.saucer.fill" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle]}>Mahlzeiten</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription]}>Stillen & Füttern verwalten</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => router.push('/(tabs)/baby')}
            activeOpacity={0.9}
          >
            <BlurView 
              intensity={70} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(233, 201, 182, 0.6)' }]}>
                <View style={[styles.iconContainer, styles.liquidGlassIconContainer]}>
                  <IconSymbol name="person.fill" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle]}>Mein Baby</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription]}>Alle Infos & Entwicklungen</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          {currentPhase && (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: 'rgba(125, 90, 80, 0.7)' }]}
              onPress={() => router.push('/(tabs)/diary')}
            >
              <View style={styles.iconContainer}>
                <IconSymbol name="chart.bar.fill" size={40} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.cardTitle}>Entwicklung</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Phase {currentPhase.baby_development_phases?.phase_number || 1}
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(125, 90, 80, 0.7)' }]}
            onPress={() => router.push('/(tabs)/daily_old')}
          >
            <View style={styles.iconContainer}>
              <IconSymbol name="list.bullet" size={40} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.cardTitle}>Alltag</ThemedText>
            <ThemedText style={styles.cardDescription}>Tagesaktivitäten verwalten</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(255, 107, 107, 0.7)' }]}
            onPress={() => router.push('/(tabs)/selfcare')}
          >
            <View style={styles.iconContainer}>
              <IconSymbol name="heart.fill" size={40} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.cardTitle}>Mama Selfcare</ThemedText>
            <ThemedText style={styles.cardDescription}>Nimm dir Zeit für dich</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(100, 150, 255, 0.7)' }]}
            onPress={() => router.push('/(tabs)/babyweather')}
          >
            <View style={styles.iconContainer}>
              <IconSymbol name="cloud.sun.fill" size={40} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.cardTitle}>Babywetter</ThemedText>
            <ThemedText style={styles.cardDescription}>Aktuelle Wetterinfos</ThemedText>
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
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  liquidGlassBackground: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  liquidGlassContainer: {
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  // Begrüßungsbereich - Liquid Glass Design
  greetingContainer: {
    padding: 24,
    backgroundColor: 'transparent',
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  liquidGlassProfilePlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },

  // Tip Container - Enhanced Liquid Glass
  tipContainerWrapper: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tipContainerBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  liquidGlassTipContainer: {
    borderRadius: 16,
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
    padding: 24,
    backgroundColor: 'transparent',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
    padding: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 8,
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
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '700',
  },
  liquidGlassSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },

  // Stats with Liquid Glass Enhancement
  liquidGlassStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  liquidGlassStatIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 8,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  liquidGlassStatValue: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
  },
  liquidGlassStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
    marginBottom: 20,
  },
  cardsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.95)',
    letterSpacing: -0.3,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Liquid Glass Cards
  liquidGlassCardWrapper: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  liquidGlassCardBackground: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  liquidGlassIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  liquidGlassCardTitle: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  liquidGlassCardDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});