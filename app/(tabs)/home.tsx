import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, ImageBackground, SafeAreaView, StatusBar, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getBabyInfo, getDiaryEntries, getCurrentPhase, getPhaseProgress, getMilestonesByPhase } from '@/lib/baby';

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
  const [currentPhase, setCurrentPhase] = useState<any>(null);
  const [phaseProgress, setPhaseProgress] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyTip, setDailyTip] = useState("");

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

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Baby-Informationen laden
      const { data: babyData } = await getBabyInfo();
      setBabyInfo(babyData);

      // Tagebucheinträge laden (nur die neuesten 5)
      const { data: diaryData } = await getDiaryEntries();
      if (diaryData) {
        setDiaryEntries(diaryData.slice(0, 5));
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

  // Berechne die Anzahl der heutigen Einträge
  const getTodayEntries = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return diaryEntries.filter(entry => {
      const entryDate = new Date(entry.entry_date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    }).length;
  };

  // Berechne die Anzahl der heute erreichten Meilensteine
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
    const userName = babyInfo?.name ? babyInfo.name.split(' ')[0] : 'Mama';

    return (
      <ThemedView style={styles.greetingContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
        <View style={styles.greetingHeader}>
          <View>
            <ThemedText style={styles.greeting}>
              Hallo, {userName === 'Mama' ? userName : `${userName}s Mama`}!
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
    const todayEntries = getTodayEntries();
    const todayMilestones = getTodayMilestones();

    return (
      <ThemedView style={styles.summaryContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
        <ThemedText style={styles.sectionTitle}>
          Dein Tag im Überblick
        </ThemedText>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <IconSymbol name="book.fill" size={24} color={theme.accent} />
            <ThemedText style={styles.statValue}>{todayEntries}</ThemedText>
            <ThemedText style={styles.statLabel}>Tagebucheinträge</ThemedText>
          </View>

          <View style={styles.statItem}>
            <IconSymbol name="star.fill" size={24} color={theme.accent} />
            <ThemedText style={styles.statValue}>{todayMilestones}</ThemedText>
            <ThemedText style={styles.statLabel}>Meilensteine</ThemedText>
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
    );
  };

  // Rendere die Schnellzugriff-Karten
  const renderQuickAccessCards = () => {
    return (
      <View style={styles.cardsContainer}>
        <ThemedText style={styles.sectionTitle}>
          Schnellzugriff
        </ThemedText>

        <View style={styles.cardsGrid}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(157, 190, 187, 0.7)' }]}
            onPress={() => router.push('/(tabs)/diary')}
          >
            <IconSymbol name="book.fill" size={32} color={Colors.light.success} />
            <ThemedText style={styles.cardTitle}>Tagebuch</ThemedText>
            <ThemedText style={styles.cardDescription}>Erinnere besondere Momente</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(233, 201, 182, 0.7)' }]}
            onPress={() => router.push('/(tabs)/baby')}
          >
            <IconSymbol name="person.fill" size={32} color="#E9C9B6" />
            <ThemedText style={styles.cardTitle}>Mein Baby</ThemedText>
            <ThemedText style={styles.cardDescription}>Alle Infos & Entwicklungen</ThemedText>
          </TouchableOpacity>

          {currentPhase && (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: 'rgba(125, 90, 80, 0.4)' }]}
              onPress={() => router.push('/(tabs)/diary')}
            >
              <View style={styles.progressCircle}>
                <ThemedText style={styles.progressText}>
                  {Math.round(phaseProgress?.progress || 0)}%
                </ThemedText>
              </View>
              <ThemedText style={styles.cardTitle}>Entwicklung</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Phase {currentPhase.baby_development_phases?.phase_number || 1}
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(125, 90, 80, 0.4)' }]}
            onPress={() => router.push('/(tabs)/daily_old')}
          >
            <IconSymbol name="list.bullet" size={32} color="#7D5A50" />
            <ThemedText style={styles.cardTitle}>Alltag</ThemedText>
            <ThemedText style={styles.cardDescription}>Tagesaktivitäten verwalten</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(255, 107, 107, 0.4)' }]}
            onPress={() => router.push('/(tabs)/selfcare')}
          >
            <IconSymbol name="heart.fill" size={32} color="#FF6B6B" />
            <ThemedText style={styles.cardTitle}>Mama Selfcare</ThemedText>
            <ThemedText style={styles.cardDescription}>Nimm dir Zeit für dich</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade deine persönliche Übersicht...</ThemedText>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
            {renderGreetingSection()}
            {renderDailySummary()}
            {renderQuickAccessCards()}
          </ScrollView>
        )}
      </ImageBackground>
    </SafeAreaView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
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

  // Schnellzugriff-Karten
  cardsContainer: {
    marginBottom: 20,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 140,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
  progressCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7D5A50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
