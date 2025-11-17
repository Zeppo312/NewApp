import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { getBabyInfo, BabyInfo } from '@/lib/baby';
import { Stack } from 'expo-router';
import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LiquidGlassCard, LAYOUT_PAD, TIMELINE_INSET, TEXT_PRIMARY, GLASS_BORDER } from '@/constants/DesignGuide';
import {
  differenceInYears,
  differenceInMonths,
  differenceInDays,
  addMonths,
  addDays
} from 'date-fns';

// Initiale Stats als leere Werte definieren
const initialStats = {
  years: 0,
  months: 0,
  days: 0,
  totalDays: 0,
  totalWeeks: 0,
  totalMonths: 0,
  milestones: [] as { name: string; reached: boolean; date?: Date }[]
};

const HEADER_TEXT_COLOR = TEXT_PRIMARY;

const pastelPalette = {
  peach: 'rgba(255, 223, 209, 0.85)',
  rose: 'rgba(255, 210, 224, 0.8)',
  honey: 'rgba(255, 239, 214, 0.85)',
  sage: 'rgba(214, 236, 220, 0.78)',
  lavender: 'rgba(236, 224, 255, 0.78)',
  sky: 'rgba(222, 238, 255, 0.85)',
  blush: 'rgba(255, 218, 230, 0.8)',
};

const GlassLayer = ({
  tint = 'rgba(255,255,255,0.22)',
  sheenOpacity = 0.35,
}: {
  tint?: string;
  sheenOpacity?: number;
}) => (
  <>
    <LinearGradient
      colors={[tint, 'rgba(255,255,255,0.06)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.glassLayerGradient}
    />
    <View style={[styles.glassSheen, { opacity: sheenOpacity }]} />
  </>
);

export default function BabyStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
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
    const reached = milestone.reached;

    const tint = reached ? 'rgba(213,245,231,0.75)' : 'rgba(244,236,230,0.78)';

    return (
      <View
        style={[styles.milestoneRow, styles.glassSurface]}
      >
        <GlassLayer tint={tint} sheenOpacity={reached ? 0.22 : 0.16} />
        <View
          style={[
            styles.milestoneIcon,
            reached ? styles.milestoneIconReached : styles.milestoneIconUpcoming
          ]}
        >
          <IconSymbol
            name={reached ? 'star.fill' : 'calendar.badge.exclamationmark'}
            size={18}
            color={reached ? '#E88368' : '#9E8F86'}
          />
        </View>
        <View style={styles.milestoneInfo}>
          <ThemedText style={styles.milestoneName}>{milestone.name}</ThemedText>
          <ThemedText style={styles.milestoneDate}>
            {reached && milestone.date ? `Erreicht am ${formatDate(milestone.date)}` : 'Noch nicht erreicht'}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderInterestingFacts = () => {
    if (!babyInfo.birth_date) return null;
    
    const totalMonths = stats.years * 12 + stats.months;
    const heartbeats = Math.round(stats.totalDays * 24 * 60 * getAvgHeartRate(totalMonths));
    const breaths = Math.round(stats.totalDays * 24 * 60 * getAvgBreathRate(totalMonths));
    const diapers = Math.round(stats.totalDays * getAvgDiapers(totalMonths));
    const sleep = Math.round(stats.totalDays * getAvgSleepHours(totalMonths));

    const factItems = [
      {
        key: 'heart',
        label: 'Herzschläge',
        value: heartbeats.toLocaleString('de-DE'),
        caption: 'geschätzt',
        icon: 'heart.fill' as const,
        accent: pastelPalette.rose,
        iconColor: '#D06262',
        iconBg: 'rgba(255,255,255,0.8)',
      },
      {
        key: 'breath',
        label: 'Atemzüge',
        value: breaths.toLocaleString('de-DE'),
        caption: 'seit Geburt',
        icon: 'wind' as const,
        accent: pastelPalette.sage,
        iconColor: '#5A8F80',
        iconBg: 'rgba(255,255,255,0.8)',
      },
      {
        key: 'diapers',
        label: 'Windeln',
        value: diapers.toLocaleString('de-DE'),
        caption: 'insgesamt',
        icon: 'drop.fill' as const,
        accent: pastelPalette.honey,
        iconColor: '#B98160',
        iconBg: 'rgba(255,255,255,0.85)',
      },
      {
        key: 'sleep',
        label: 'Schlafstunden',
        value: sleep.toLocaleString('de-DE'),
        caption: 'seit Geburt',
        icon: 'moon.stars.fill' as const,
        accent: pastelPalette.sky,
        iconColor: '#7A6FD1',
        iconBg: 'rgba(255,255,255,0.85)',
      },
    ];
    
    return (
      <LiquidGlassCard style={styles.glassCard}>
        <View style={styles.glassInner}>
          <ThemedText style={styles.sectionTitle}>Interessante Fakten</ThemedText>
          <View style={styles.factGrid}>
            {factItems.map((fact) => (
              <View key={fact.key} style={[styles.factTile, styles.glassSurface]}>
                <GlassLayer tint={fact.accent} sheenOpacity={0.18} />
                <View style={[styles.factIcon, { backgroundColor: fact.iconBg }]}>
                  <IconSymbol name={fact.icon} size={18} color={fact.iconColor} />
                </View>
                <ThemedText style={styles.factLabel}>{fact.label}</ThemedText>
                <ThemedText style={styles.factValue}>{fact.value}</ThemedText>
                <ThemedText style={styles.factCaption}>{fact.caption}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </LiquidGlassCard>
    );
  };

  const ageChips = [
    { key: 'years', label: 'Jahre', value: stats.years, accent: pastelPalette.rose },
    { key: 'months', label: 'Monate', value: stats.months, accent: pastelPalette.honey },
    { key: 'days', label: 'Tage', value: stats.days, accent: pastelPalette.sky },
  ];

  const statChips = [
    { key: 'total-days', label: 'Tage gesamt', value: stats.totalDays.toLocaleString('de-DE'), icon: 'calendar' as const, accent: pastelPalette.peach, iconColor: '#C17055' },
    { key: 'total-weeks', label: 'Wochen', value: stats.totalWeeks.toLocaleString('de-DE'), icon: 'clock' as const, accent: pastelPalette.lavender, iconColor: '#7A6FD1' },
    { key: 'total-months', label: 'Monate', value: stats.totalMonths.toLocaleString('de-DE'), icon: 'moon.stars.fill' as const, accent: pastelPalette.blush, iconColor: '#CF6F8B' },
  ];

  const bodyMetrics = [
    {
      key: 'height',
      label: 'Größe',
      value: babyInfo.height ? `${babyInfo.height} cm` : 'Nicht angegeben',
      icon: 'person.fill' as const,
      accent: pastelPalette.sky,
      iconColor: '#6C87C1',
    },
    {
      key: 'weight',
      label: 'Gewicht',
      value: babyInfo.weight ? `${babyInfo.weight} kg` : 'Nicht angegeben',
      icon: 'chart.bar.fill' as const,
      accent: pastelPalette.honey,
      iconColor: '#B7745D',
    },
    {
      key: 'gender',
      label: 'Geschlecht',
      value: genderLabels[babyInfo.baby_gender as keyof typeof genderLabels] || genderLabels.unknown,
      icon: 'person.2.fill' as const,
      accent: pastelPalette.lavender,
      iconColor: '#8C6AC3',
    },
  ];

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        
        <Header title="Baby-Statistiken" subtitle="Alter, Entwicklung & Fakten" showBackButton />
        
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
                <LiquidGlassCard style={[styles.glassCard, styles.firstGlassCard]}>
                  <View style={styles.glassInner}>
                    <ThemedText style={styles.sectionTitle}>Alter</ThemedText>

                    <View style={[styles.ageHighlight, styles.glassSurface]}>
                      <GlassLayer tint="rgba(255,232,220,0.75)" sheenOpacity={0.22} />
                      <View style={styles.ageHighlightIcon}>
                        <IconSymbol name="clock" size={18} color="#E88368" />
                      </View>
                      <View style={styles.ageHighlightText}>
                        <ThemedText style={styles.ageValue}>{renderAgeDescription()}</ThemedText>
                        <ThemedText style={styles.ageSubline}>Stand heute</ThemedText>
                      </View>
                    </View>

                    <View style={styles.ageChipRow}>
                      {ageChips.map((chip) => (
                        <View key={chip.key} style={[styles.ageChip, styles.glassSurface]}>
                          <GlassLayer tint={chip.accent} sheenOpacity={0.25} />
                          <ThemedText style={styles.ageChipValue}>{chip.value}</ThemedText>
                          <ThemedText style={styles.ageChipLabel}>{chip.label}</ThemedText>
                        </View>
                      ))}
                    </View>
                  
                    <View style={styles.statRow}>
                      {statChips.map((stat) => (
                        <View key={stat.key} style={[styles.statItem, styles.glassSurface]}>
                          <GlassLayer tint={stat.accent} sheenOpacity={0.2} />
                          <View style={styles.statIcon}>
                            <IconSymbol name={stat.icon} size={16} color={stat.iconColor} />
                          </View>
                          <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
                          <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </LiquidGlassCard>
                
                <LiquidGlassCard style={styles.glassCard}>
                  <View style={styles.glassInner}>
                    <ThemedText style={styles.sectionTitle}>Körperliche Entwicklung</ThemedText>
                    <View style={styles.bodyGrid}>
                      {bodyMetrics.map((metric) => (
                        <View key={metric.key} style={[styles.bodyBadge, styles.glassSurface]}>
                          <GlassLayer tint={metric.accent} sheenOpacity={0.18} />
                          <View style={styles.bodyIcon}>
                            <IconSymbol name={metric.icon} size={18} color={metric.iconColor} />
                          </View>
                          <View style={styles.bodyCopy}>
                            <ThemedText style={styles.bodyValue}>{metric.value}</ThemedText>
                            <ThemedText style={styles.bodyLabel}>{metric.label}</ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </LiquidGlassCard>
                
                {renderInterestingFacts()}
                
                <LiquidGlassCard style={styles.glassCard}>
                  <View style={styles.glassInner}>
                    <ThemedText style={styles.sectionTitle}>Meilensteine</ThemedText>
                    <View style={styles.milestoneContainer}>
                      {stats.milestones.map((milestone, index) => (
                        <View key={index}>
                          {renderMilestoneStatus(milestone)}
                        </View>
                      ))}
                    </View>
                  </View>
                </LiquidGlassCard>
              </>
            ) : (
              <LiquidGlassCard style={styles.glassCard}>
                <View style={styles.glassInner}>
                  <ThemedText style={styles.noDataText}>
                    Kein Geburtsdatum verfügbar. Bitte füge das Geburtsdatum deines Babys hinzu, um Statistiken anzuzeigen.
                  </ThemedText>
                </View>
              </LiquidGlassCard>
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
    paddingBottom: 40,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassSurface: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  glassLayerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  glassCard: {
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
    borderRadius: 22,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  glassInner: {
    padding: 20,
  },
  firstGlassCard: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  ageHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  ageHighlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ageHighlightText: {
    flex: 1,
  },
  ageValue: {
    fontSize: 22,
    fontWeight: '800',
    color: HEADER_TEXT_COLOR,
  },
  ageSubline: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.75,
    marginTop: 2,
  },
  ageChipRow: {
    flexDirection: 'row',
    marginBottom: 6,
    marginTop: 4,
  },
  ageChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  ageChipValue: {
    fontSize: 18,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
  },
  ageChipLabel: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginHorizontal: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: HEADER_TEXT_COLOR,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
    textAlign: 'center',
  },
  bodyGrid: {
    marginTop: 4,
  },
  bodyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
  },
  bodyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bodyCopy: {
    flex: 1,
  },
  bodyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
  },
  bodyLabel: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
    marginTop: 2,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  factTile: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  factIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  factLabel: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  factValue: {
    fontSize: 18,
    fontWeight: '800',
    color: HEADER_TEXT_COLOR,
  },
  factCaption: {
    fontSize: 12,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
    marginTop: 2,
  },
  milestoneContainer: {
    marginTop: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  milestoneIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  milestoneIconReached: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  milestoneIconUpcoming: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 16,
    fontWeight: '700',
    color: HEADER_TEXT_COLOR,
  },
  milestoneDate: {
    fontSize: 12,
    marginTop: 2,
    color: HEADER_TEXT_COLOR,
    opacity: 0.8,
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
    color: HEADER_TEXT_COLOR,
  },
});
