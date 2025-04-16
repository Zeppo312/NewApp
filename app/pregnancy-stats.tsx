import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, ImageBackground, SafeAreaView, StatusBar, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';

export default function PregnancyStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const { user } = useAuth();

  // Schwangerschaftsdaten
  const [dueDate, setDueDate] = useState<Date | null>(null);
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
    const weeksPregnant = Math.floor(daysPregnant / 7);
    const daysInCurrentWeek = daysPregnant % 7;

    // Berechne den Fortschritt (0-1)
    const progress = Math.min(1, Math.max(0, daysPregnant / totalDaysInPregnancy));

    // Berechne das Trimester
    let trimester = '';
    if (weeksPregnant <= 13) {
      trimester = '1. Trimester';
    } else if (weeksPregnant <= 27) {
      trimester = '2. Trimester';
    } else {
      trimester = '3. Trimester';
    }

    // Berechne den Kalendermonat
    const calendarMonth = Math.ceil(daysPregnant / 30);

    // Berechne den Schwangerschaftsmonat (jeweils 4 Wochen)
    const pregnancyMonth = Math.ceil(weeksPregnant / 4);

    setStats({
      daysLeft: daysRemaining,
      currentWeek: weeksPregnant,
      currentDay: daysInCurrentWeek,
      progress,
      trimester,
      daysPregnant,
      calendarMonth,
      pregnancyMonth
    });
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

          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>ERRECHNETER GEBURTSTERMIN</Text>
            <Text style={styles.dueDateValue}>
              {dueDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>WOCHE</Text>
              <Text style={styles.statValue}>{stats.currentWeek}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statTitle}>ICH BIN SCHWANGER SEIT</Text>
              <Text style={styles.statValue}>{stats.currentWeek} W + {stats.currentDay} T</Text>
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
    width: '100%',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7D5A50',
    marginBottom: 5,
  },
  dueDateValue: {
    fontSize: 24,
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
});
