import React, { useMemo, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Text, SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useUserProfile, useBabyData, useDiaryData, useDailySummary, useDailyTip, useOptimizedRefresh } from '@/hooks/useOptimizedData';

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

  // Optimierte Hooks verwenden
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { babyInfo, currentPhase, phaseProgress, milestones, loading: babyLoading, refetch: refetchBaby } = useBabyData();
  const { diaryEntries, dailyEntries, loading: diaryLoading, refetch: refetchDiary } = useDiaryData(5);
  
  // Memoized computations
  const dailyTip = useDailyTip(dailyTips);
  const dailyStats = useDailySummary(dailyEntries);
  const userName = useMemo(() => profile?.first_name || 'Mama', [profile?.first_name]);
  const isLoading = useMemo(() => profileLoading || babyLoading || diaryLoading, [profileLoading, babyLoading, diaryLoading]);
  
  // Optimized refresh
  const { refreshing, onRefresh } = useOptimizedRefresh([
    refetchProfile,
    refetchBaby,
    refetchDiary
  ]);

  // Memoized helper functions
  const formatDate = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('de-DE', options);
  }, []);

  // Memoized render functions for better performance
  const renderGreetingSection = useCallback(() => {
    return (
      <ThemedView style={styles.greetingContainer} lightColor={theme.cardLight} darkColor={theme.cardDark}>
        <View style={styles.greetingHeader}>
          <View>
            <ThemedText style={[styles.greeting, { color: colorScheme === 'dark' ? '#E9C9B6' : '#6b4c3b' }]}>
              Hallo {userName}!
            </ThemedText>
            <ThemedText style={styles.dateText}>
              {formatDate}
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
  }, [userName, formatDate, babyInfo?.photo_url, dailyTip, theme, colorScheme]);

  const renderDailySummary = useCallback(() => {
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
              <ThemedText style={styles.statValue}>{dailyStats.todayFeedings}</ThemedText>
              <ThemedText style={styles.statLabel}>Mahlzeiten</ThemedText>
            </View>

            <View style={styles.statItem}>
              <IconSymbol name="heart.fill" size={24} color="#4CAF50" />
              <ThemedText style={styles.statValue}>{dailyStats.todayDiaperChanges}</ThemedText>
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
  }, [router, theme, dailyStats, currentPhase, phaseProgress]);

  const renderQuickAccessCards = useCallback(() => {
    return (
      <View style={styles.cardsSection}>
        <ThemedText style={styles.cardsSectionTitle}>
          Schnellzugriff
        </ThemedText>

        <View style={styles.cardsGrid}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(157, 190, 187, 0.9)' }]}
            onPress={() => router.push('/diary-entries')}
          >
            <View style={styles.iconContainer}>
              <IconSymbol name="book.fill" size={40} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.cardTitle}>Tagebuch</ThemedText>
            <ThemedText style={styles.cardDescription}>Erinnere besondere Momente</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(233, 201, 182, 0.9)' }]}
            onPress={() => router.push('/(tabs)/baby')}
          >
            <View style={styles.iconContainer}>
              <IconSymbol name="person.fill" size={40} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.cardTitle}>Mein Baby</ThemedText>
            <ThemedText style={styles.cardDescription}>Alle Infos & Entwicklungen</ThemedText>
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
  }, [router, currentPhase]);

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
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
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
});