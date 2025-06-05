import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, SafeAreaView, StatusBar, Image, RefreshControl, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const skeletonAnim = useRef(new Animated.Value(0.3)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(skeletonAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } else {
      contentOpacity.setValue(0);
    }
  }, [isLoading]);

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
      <ThemedView style={styles.greetingContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
        <View style={styles.greetingHeader}>
          <View>
            <ThemedText style={[styles.greeting, { color: colorScheme === 'dark' ? '#E9C9B6' : '#6b4c3b' }]}>
              Hallo {displayName}!
            </ThemedText>
            <ThemedText style={styles.dateText}>
              {formatDate()}
            </ThemedText>
          </View>

          {babyInfo?.photo_url && (
            <Image
              source={{ uri: babyInfo.photo_url }}
              style={styles.profileImage}
            />
          )}

          {!babyInfo?.photo_url && (
            <View style={[styles.profileImage, styles.profilePlaceholder]}>
              <IconSymbol name="person.fill" size={30} color="#FFFFFF" />
            </View>
          )}
        </View>

        <ThemedView style={styles.tipContainer} lightColor="rgba(157, 190, 187, 0.3)" darkColor="rgba(157, 190, 187, 0.2)">
          <IconSymbol name="lightbulb.fill" size={20} color={Colors.light.success} />
          <ThemedText style={styles.tipText}>
            {dailyTip}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  };

  // Rendere die Tagesübersicht
  const renderDailySummary = () => {
    const todayFeedings = getTodayFeedings();
    const todayDiaperChanges = getTodayDiaperChanges();

    return (
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/daily_old')}
        activeOpacity={0.8}
      >
        <ThemedView style={styles.summaryContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
          <View style={styles.sectionTitleContainer}>
            <ThemedText style={styles.sectionTitle}>
              Dein Tag im Überblick
            </ThemedText>
            <IconSymbol name="chevron.right" size={20} color={theme.tabIconDefault} />
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <IconSymbol name="drop.fill" size={24} color="#FF9800" />
              <ThemedText style={styles.statValue}>{todayFeedings}</ThemedText>
              <ThemedText style={styles.statLabel}>Mahlzeiten</ThemedText>
            </View>

            <View style={styles.statItem}>
              <IconSymbol name="heart.fill" size={24} color="#4CAF50" />
              <ThemedText style={styles.statValue}>{todayDiaperChanges}</ThemedText>
              <ThemedText style={styles.statLabel}>Windelwechsel</ThemedText>
            </View>

            {currentPhase && phaseProgress && (
              <View style={styles.statItem}>
                <IconSymbol name="chart.bar.fill" size={24} color={theme.accent} />
                <ThemedText style={styles.statValue}>{Math.round(phaseProgress.progress)}%</ThemedText>
                <ThemedText style={styles.statLabel}>Fortschritt</ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
      </TouchableOpacity>
    );
  };

  const renderGreetingSkeleton = () => {
    const baseColor = colorScheme === 'dark' ? '#444' : '#E0E0E0';
    return (
      <View style={styles.greetingContainer}>
        <View style={styles.greetingHeader}>
          <View style={{ flex: 1 }}>
            <Animated.View style={[styles.skeletonLine, { width: 150, backgroundColor: baseColor, opacity: skeletonAnim }]} />
            <Animated.View style={[styles.skeletonLine, { width: 100, backgroundColor: baseColor, opacity: skeletonAnim }]} />
          </View>
          <Animated.View style={[styles.skeletonAvatar, { backgroundColor: baseColor, opacity: skeletonAnim }]} />
        </View>
        <Animated.View style={[styles.skeletonLine, { height: 40, borderRadius: 10, backgroundColor: baseColor, opacity: skeletonAnim }]} />
      </View>
    );
  };

  const renderSummarySkeleton = () => {
    const baseColor = colorScheme === 'dark' ? '#444' : '#E0E0E0';
    return (
      <View style={styles.summaryContainer}>
        <Animated.View style={[styles.skeletonLine, { width: 180, backgroundColor: baseColor, opacity: skeletonAnim }]} />
        <View style={[styles.statsContainer, { marginTop: 16 }]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.statItem}>
              <Animated.View style={[styles.skeletonStatCircle, { backgroundColor: baseColor, opacity: skeletonAnim }]} />
              <Animated.View style={[styles.skeletonLine, { width: 20, height: 16, backgroundColor: baseColor, opacity: skeletonAnim }]} />
              <Animated.View style={[styles.skeletonLine, { width: 60, height: 12, backgroundColor: baseColor, opacity: skeletonAnim }]} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Rendere die Schnellzugriff-Karten
  const renderQuickAccessCards = () => {
    return (
      <View style={styles.cardsSection}>
        <ThemedText style={styles.cardsSectionTitle}>
          Schnellzugriff
        </ThemedText>

        <View style={styles.cardsGrid}>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/diary-entries')}>
            <LinearGradient
              colors={['rgba(157, 190, 187, 0.9)', 'rgba(157, 190, 187, 0.7)']}
              style={styles.cardGradient}
            >
              <View style={styles.iconContainer}>
                <IconSymbol name="book.fill" size={40} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.cardTitle}>Tagebuch</ThemedText>
              <ThemedText style={styles.cardDescription}>Erinnere besondere Momente</ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/baby')}>
            <LinearGradient
              colors={['rgba(233, 201, 182, 0.9)', 'rgba(233, 201, 182, 0.7)']}
              style={styles.cardGradient}
            >
              <View style={styles.iconContainer}>
                <IconSymbol name="person.fill" size={40} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.cardTitle}>Mein Baby</ThemedText>
              <ThemedText style={styles.cardDescription}>Alle Infos & Entwicklungen</ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          {currentPhase && (
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/diary')}>
              <LinearGradient
                colors={['rgba(125, 90, 80, 0.7)', 'rgba(125, 90, 80, 0.5)']}
                style={styles.cardGradient}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="chart.bar.fill" size={40} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.cardTitle}>Entwicklung</ThemedText>
                <ThemedText style={styles.cardDescription}>
                  Phase {currentPhase.baby_development_phases?.phase_number || 1}
                </ThemedText>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/daily_old')}>
            <LinearGradient
              colors={['rgba(125, 90, 80, 0.7)', 'rgba(125, 90, 80, 0.5)']}
              style={styles.cardGradient}
            >
              <View style={styles.iconContainer}>
                <IconSymbol name="list.bullet" size={40} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.cardTitle}>Alltag</ThemedText>
              <ThemedText style={styles.cardDescription}>Tagesaktivitäten verwalten</ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/selfcare')}>
            <LinearGradient
              colors={['rgba(255, 107, 107, 0.7)', 'rgba(255, 107, 107, 0.5)']}
              style={styles.cardGradient}
            >
              <View style={styles.iconContainer}>
                <IconSymbol name="heart.fill" size={40} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.cardTitle}>Mama Selfcare</ThemedText>
              <ThemedText style={styles.cardDescription}>Nimm dir Zeit für dich</ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/babyweather')}>
            <LinearGradient
              colors={['rgba(100, 150, 255, 0.7)', 'rgba(100, 150, 255, 0.5)']}
              style={styles.cardGradient}
            >
              <View style={styles.iconContainer}>
                <IconSymbol name="cloud.sun.fill" size={40} color="#FFFFFF" />
              </View>
              <ThemedText style={styles.cardTitle}>Babywetter</ThemedText>
              <ThemedText style={styles.cardDescription}>Aktuelle Wetterinfos</ThemedText>
            </LinearGradient>
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
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
          >
            {renderGreetingSkeleton()}
            {renderSummarySkeleton()}
            {renderQuickAccessCards()}
          </ScrollView>
        ) : (
          <Animated.ScrollView
            style={[styles.scrollView, { opacity: contentOpacity }]}
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
          </Animated.ScrollView>
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

  // Begrüßungsbereich
  greetingContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 16,
    opacity: 0.8,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profilePlaceholder: {
    backgroundColor: '#7D5A50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
  },
  tipText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },

  // Tagesübersicht
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Updated styles for quick access section
  cardsSection: {
    marginBottom: 16,
  },
  cardsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardGradient: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Skeleton styles
  skeletonLine: {
    height: 16,
    borderRadius: 8,
    backgroundColor: '#CCCCCC',
    marginBottom: 8,
  },
  skeletonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#CCCCCC',
  },
  skeletonStatCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCCCCC',
    marginBottom: 6,
  },
});