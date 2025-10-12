import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { getBabyInfo, BabyInfo } from '@/lib/baby';
import { Stack, useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  differenceInYears,
  differenceInMonths,
  differenceInDays,
  addMonths,
  addDays
} from 'date-fns';
import { LAYOUT_PAD, SECTION_GAP_TOP, RADIUS } from '@/constants/DesignGuide';

const { width: screenWidth } = Dimensions.get('window');
const TIMELINE_INSET = 8;
const contentWidth = screenWidth - 2 * LAYOUT_PAD;

// Initiale Stats als leere Werte definieren
const initialStats = {
  years: 0,
  months: 0,
  days: 0,
  totalDays: 0,
  totalWeeks: 0,
  totalMonths: 0,
  milestones: [] as Array<{ name: string; reached: boolean; date?: Date }>
};

export default function BabyStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();

  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Altersabhängige Formeln für interessante Fakten
  const getAvgHeartRate = (ageMonths: number) =>
    ageMonths < 1 ? 140 : ageMonths < 6 ? 130 : 120;
    
  const getAvgBreathRate = (ageMonths: number) =>
    ageMonths < 1 ? 40 : ageMonths < 6 ? 35 : 30;
    
  const getAvgDiapers = (ageMonths: number) =>
    ageMonths < 1 ? 10 : ageMonths < 3 ? 8 : ageMonths < 12 ? 6 : 4;
    
  const getAvgSleepHours = (ageMonths: number) =>
    ageMonths < 1 ? 16 : ageMonths < 6 ? 14 : ageMonths < 12 ? 13 : 12;
  
  // Geschlechts-Labels für Lokalisierung
  const genderLabels = { 
    male: 'Männlich', 
    female: 'Weiblich',
    unknown: 'Nicht angegeben'
  };

  // Reine Berechnungsfunktion ohne setState (für useMemo)
  const computeStats = (birthDate: Date) => {
    const now = new Date();

    // 1) Jahre, Monate, Tage exakt berechnen
    const years = differenceInYears(now, birthDate);
    // Für "Rest-Monate" ziehen wir zuerst die vollen Jahre ab:
    const months = differenceInMonths(
      now,
      addMonths(birthDate, years * 12)
    );
    // Für "Rest-Tage" ziehen wir volle Jahre+Monate ab:
    const days = differenceInDays(
      now,
      addMonths(addMonths(birthDate, years * 12), months)
    );

    // 2) Gesamt-Tage und Gesamt-Wochen
    const totalDays = differenceInDays(now, birthDate);
    const totalWeeks = Math.floor(totalDays / 7);
    // 3) Gesamt-Monate als Jahre*12 + Rest-Monate
    const totalMonths = years * 12 + months;

    // 4) Meilensteine auf Kalendermonate-Basis
    const milestoneDefinitions = [
      { name: '1 Woche', addFn: () => addDays(birthDate, 7) },
      { name: '1 Monat', addFn: () => addMonths(birthDate, 1) },
      { name: '2 Monate', addFn: () => addMonths(birthDate, 2) },
      { name: '3 Monate', addFn: () => addMonths(birthDate, 3) },
      { name: '100 Tage', addFn: () => addDays(birthDate, 100) },
      { name: '6 Monate', addFn: () => addMonths(birthDate, 6) },
      { name: '1 Jahr', addFn: () => addMonths(birthDate, 12) },
      { name: '500 Tage', addFn: () => addDays(birthDate, 500) },
      { name: '1000 Tage', addFn: () => addDays(birthDate, 1000) },
      { name: '1111 Tage', addFn: () => addDays(birthDate, 1111) }
    ];

    const milestones = milestoneDefinitions.map(({ name, addFn }) => {
      const date = addFn();
      const reached = now >= date;
      return { name, reached, date: reached ? date : undefined };
    });

    return { years, months, days, totalDays, totalWeeks, totalMonths, milestones };
  };

  // Mit useMemo für Performance-Optimierung
  const stats = useMemo(() => {
    if (!babyInfo.birth_date) return initialStats;
    return computeStats(new Date(babyInfo.birth_date));
  }, [babyInfo.birth_date]);

  useEffect(() => {
    if (user) {
      loadBabyInfo();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadBabyInfo = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getBabyInfo();
      if (error) {
        console.error('Error loading baby info:', error);
      } else if (data) {
        setBabyInfo({
          id: data.id,
          name: data.name || '',
          birth_date: data.birth_date || null,
          weight: data.weight || '',
          height: data.height || '',
          photo_url: data.photo_url || null,
          baby_gender: data.baby_gender || 'unknown'
        });
      }
    } catch (err) {
      console.error('Failed to load baby info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAgeDescription = () => {
    const { years, months, days } = stats;
    
    if (years > 0) {
      return `${years} Jahr${years !== 1 ? 'e' : ''}, ${months} Monat${months !== 1 ? 'e' : ''} und ${days} Tag${days !== 1 ? 'e' : ''}`;
    } else if (months > 0) {
      return `${months} Monat${months !== 1 ? 'e' : ''} und ${days} Tag${days !== 1 ? 'e' : ''}`;
    } else {
      return `${days} Tag${days !== 1 ? 'e' : ''}`;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const renderMilestoneStatus = (milestone: { name: string; reached: boolean; date?: Date }) => {
    if (milestone.reached) {
      return (
        <View style={styles.milestoneRow}>
          <View style={styles.milestoneCheck}>
            <IconSymbol name="checkmark.circle" size={18} color="#4CAF50" />
          </View>
          <View style={styles.milestoneInfo}>
            <ThemedText style={styles.milestoneName}>{milestone.name}</ThemedText>
            {milestone.date && (
              <ThemedText style={styles.milestoneDate}>
                Erreicht am {formatDate(milestone.date)}
              </ThemedText>
            )}
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.milestoneRow}>
          <View style={styles.milestonePending}>
            <IconSymbol name="timer" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.milestoneInfo}>
            <ThemedText style={styles.milestoneName}>{milestone.name}</ThemedText>
            <ThemedText style={styles.milestoneDate}>
              Noch nicht erreicht
            </ThemedText>
          </View>
        </View>
      );
    }
  };

  const renderInterestingFacts = () => {
    if (!babyInfo.birth_date) return null;
    
    // Altersabhängige Berechnung der interessanten Fakten
    const totalMonths = stats.years * 12 + stats.months;
    
    // Calculate some interesting facts with age-adjusted rates
    const heartbeats = Math.round(stats.totalDays * 24 * 60 * getAvgHeartRate(totalMonths));
    const breaths = Math.round(stats.totalDays * 24 * 60 * getAvgBreathRate(totalMonths));
    const diapers = Math.round(stats.totalDays * getAvgDiapers(totalMonths));
    const sleep = Math.round(stats.totalDays * getAvgSleepHours(totalMonths));
    
    return (
      <ThemedView style={styles.statsCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
        <ThemedText style={styles.sectionTitle}>Interessante Fakten</ThemedText>
        
        <View style={styles.factRow}>
          <ThemedText style={styles.factLabel}>Geschätzte Herzschläge:</ThemedText>
          <ThemedText style={styles.factValue}>{heartbeats.toLocaleString('de-DE')}</ThemedText>
        </View>
        
        <View style={styles.factRow}>
          <ThemedText style={styles.factLabel}>Geschätzte Atemzüge:</ThemedText>
          <ThemedText style={styles.factValue}>{breaths.toLocaleString('de-DE')}</ThemedText>
        </View>
        
        <View style={styles.factRow}>
          <ThemedText style={styles.factLabel}>Geschätzte Windeln:</ThemedText>
          <ThemedText style={styles.factValue}>{diapers.toLocaleString('de-DE')}</ThemedText>
        </View>
        
        <View style={styles.factRow}>
          <ThemedText style={styles.factLabel}>Geschätzte Schlafstunden:</ThemedText>
          <ThemedText style={styles.factValue}>{sleep.toLocaleString('de-DE')} Stunden</ThemedText>
        </View>
      </ThemedView>
    );
  };

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        
        <Header title="Baby-Statistiken" showBackButton />
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
          >
            {babyInfo.birth_date ? (
              <>
                <ThemedView style={styles.statsCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
                  <ThemedText style={styles.sectionTitle}>Alter</ThemedText>
                  <ThemedText style={styles.ageValue}>{renderAgeDescription()}</ThemedText>
                  
                  <View style={styles.statRow}>
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{stats.totalDays}</ThemedText>
                      <ThemedText style={styles.statLabel}>Tage</ThemedText>
                    </View>
                    
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{stats.totalWeeks}</ThemedText>
                      <ThemedText style={styles.statLabel}>Wochen</ThemedText>
                    </View>
                    
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{stats.totalMonths}</ThemedText>
                      <ThemedText style={styles.statLabel}>Monate</ThemedText>
                    </View>
                  </View>
                </ThemedView>
                
                <ThemedView style={styles.statsCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
                  <ThemedText style={styles.sectionTitle}>Körperliche Entwicklung</ThemedText>
                  
                  <View style={styles.factRow}>
                    <ThemedText style={styles.factLabel}>Größe:</ThemedText>
                    <ThemedText style={styles.factValue}>
                      {babyInfo.height ? `${babyInfo.height} cm` : 'Nicht angegeben'}
                    </ThemedText>
                  </View>
                  
                  <View style={styles.factRow}>
                    <ThemedText style={styles.factLabel}>Gewicht:</ThemedText>
                    <ThemedText style={styles.factValue}>
                      {babyInfo.weight ? `${babyInfo.weight} kg` : 'Nicht angegeben'}
                    </ThemedText>
                  </View>
                  
                  <View style={styles.factRow}>
                    <ThemedText style={styles.factLabel}>Geschlecht:</ThemedText>
                    <ThemedText style={styles.factValue}>
                      {genderLabels[babyInfo.baby_gender as keyof typeof genderLabels] || genderLabels.unknown}
                    </ThemedText>
                  </View>
                </ThemedView>
                
                {renderInterestingFacts()}
                
                <ThemedView style={styles.statsCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
                  <ThemedText style={styles.sectionTitle}>Meilensteine</ThemedText>
                  <View style={styles.milestoneContainer}>
                    {stats.milestones.map((milestone, index) => (
                      <View key={index}>
                        {renderMilestoneStatus(milestone)}
                      </View>
                    ))}
                  </View>
                </ThemedView>
              </>
            ) : (
              <ThemedView style={styles.statsCard} lightColor={theme.cardLight} darkColor={theme.cardDark}>
                <ThemedText style={styles.noDataText}>
                  Kein Geburtsdatum verfügbar. Bitte füge das Geburtsdatum deines Babys hinzu, um Statistiken anzuzeigen.
                </ThemedText>
              </ThemedView>
            )}
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
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingVertical: 16,
    paddingBottom: 140,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCard: {
    width: contentWidth - 2 * TIMELINE_INSET,
    padding: 20,
    borderRadius: RADIUS,
    marginBottom: SECTION_GAP_TOP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  ageValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  factLabel: {
    fontSize: 16,
  },
  factValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  milestoneContainer: {
    marginTop: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  milestoneCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e6f7ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  milestonePending: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  milestoneDate: {
    fontSize: 14,
    marginTop: 2,
  },
  noDataText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  }
});
