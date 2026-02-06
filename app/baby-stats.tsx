import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';
import { getBabyInfo, BabyInfo } from '@/lib/baby';
import { Stack } from 'expo-router';
import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  LiquidGlassCard,
  LAYOUT_PAD,
  TIMELINE_INSET,
  GLASS_BORDER,
  GLASS_BORDER_DARK,
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK
} from '@/constants/DesignGuide';
import { useNavigation } from '@/contexts/NavigationContext';
import * as Haptics from 'expo-haptics';
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

const HEADER_TEXT_COLOR = '#7D5A50';

const pastelPaletteLight = {
  peach: 'rgba(255, 223, 209, 0.85)',
  rose: 'rgba(255, 210, 224, 0.8)',
  honey: 'rgba(255, 239, 214, 0.85)',
  sage: 'rgba(214, 236, 220, 0.78)',
  lavender: 'rgba(236, 224, 255, 0.78)',
  sky: 'rgba(222, 238, 255, 0.85)',
  blush: 'rgba(255, 218, 230, 0.8)',
};

const pastelPaletteDark = {
  peach: 'rgba(255, 177, 138, 0.25)',
  rose: 'rgba(255, 133, 170, 0.25)',
  honey: 'rgba(255, 210, 137, 0.23)',
  sage: 'rgba(150, 210, 178, 0.22)',
  lavender: 'rgba(190, 156, 255, 0.24)',
  sky: 'rgba(134, 186, 255, 0.24)',
  blush: 'rgba(255, 160, 188, 0.24)',
};

const GlassLayer = ({
  tint = 'rgba(255,255,255,0.22)',
  sheenOpacity = 0.35,
  isDark = false,
}: {
  tint?: string;
  sheenOpacity?: number;
  isDark?: boolean;
}) => (
  <>
    <LinearGradient
      colors={[tint, isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.glassLayerGradient}
    />
    <View
      style={[
        styles.glassSheen,
        {
          opacity: sheenOpacity,
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
        },
      ]}
    />
  </>
);

export default function BabyStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const glassBorderColor = isDark ? GLASS_BORDER_DARK : GLASS_BORDER;
  const glassSurfaceStyle = {
    borderColor: glassBorderColor,
    backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.15)',
    shadowOpacity: isDark ? 0.18 : 0.06,
  } as const;
  const iconBubbleBackground = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.82)';
  const pastelPalette = isDark ? pastelPaletteDark : pastelPaletteLight;
  const milestoneReachedIconColor = isDark ? '#FFB08D' : '#E88368';
  const milestoneUpcomingIconColor = isDark ? '#D8CCC2' : '#9E8F86';
  const { user } = useAuth();
  const { activeBabyId } = useActiveBaby();
  const navigation = useNavigation();
  const [babyInfo, setBabyInfo] = useState<BabyInfo>({});
  const [isLoading, setIsLoading] = useState(true);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };
  
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
  }, [user, activeBabyId]);

  const loadBabyInfo = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await getBabyInfo(activeBabyId ?? undefined);
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

    const tint = reached
      ? (isDark ? 'rgba(150,210,178,0.22)' : 'rgba(213,245,231,0.75)')
      : (isDark ? 'rgba(209,170,145,0.2)' : 'rgba(244,236,230,0.78)');

    return (
      <View
        style={[styles.milestoneRow, styles.glassSurface, glassSurfaceStyle]}
      >
        <GlassLayer tint={tint} sheenOpacity={reached ? 0.22 : 0.16} isDark={isDark} />
        <View
          style={[
            styles.milestoneIcon,
            reached ? styles.milestoneIconReached : styles.milestoneIconUpcoming,
            {
              backgroundColor: reached
                ? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.85)')
                : (isDark ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.75)'),
            },
          ]}
        >
          <IconSymbol
            name={reached ? 'star.fill' : 'calendar.badge.exclamationmark'}
            size={18}
            color={reached ? milestoneReachedIconColor : milestoneUpcomingIconColor}
          />
        </View>
        <View style={styles.milestoneInfo}>
          <ThemedText style={[styles.milestoneName, { color: textPrimary }]}>{milestone.name}</ThemedText>
          <ThemedText style={[styles.milestoneDate, { color: textSecondary }]}>
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
        iconColor: isDark ? '#FFB8C8' : '#D06262',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'breath',
        label: 'Atemzüge',
        value: breaths.toLocaleString('de-DE'),
        caption: 'seit Geburt',
        icon: 'wind' as const,
        accent: pastelPalette.sage,
        iconColor: isDark ? '#9BE0CB' : '#5A8F80',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'diapers',
        label: 'Windeln',
        value: diapers.toLocaleString('de-DE'),
        caption: 'insgesamt',
        icon: 'drop.fill' as const,
        accent: pastelPalette.honey,
        iconColor: isDark ? '#FFCA9E' : '#B98160',
        iconBg: iconBubbleBackground,
      },
      {
        key: 'sleep',
        label: 'Schlafstunden',
        value: sleep.toLocaleString('de-DE'),
        caption: 'seit Geburt',
        icon: 'moon.stars.fill' as const,
        accent: pastelPalette.sky,
        iconColor: isDark ? '#C3B8FF' : '#7A6FD1',
        iconBg: iconBubbleBackground,
      },
    ];
    
    return (
      <LiquidGlassCard
        style={styles.glassCard}
        intensity={26}
        overlayColor={glassOverlay}
        borderColor={glassBorderColor}
      >
        <View style={styles.glassInner}>
          <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>Interessante Fakten</ThemedText>
          <View style={styles.factGrid}>
            {factItems.map((fact) => (
              <View key={fact.key} style={[styles.factTile, styles.glassSurface, glassSurfaceStyle]}>
                <GlassLayer tint={fact.accent} sheenOpacity={0.18} isDark={isDark} />
                <View style={[styles.factIcon, { backgroundColor: fact.iconBg }]}>
                  <IconSymbol name={fact.icon} size={18} color={fact.iconColor} />
                </View>
                <ThemedText style={[styles.factLabel, { color: textSecondary }]}>{fact.label}</ThemedText>
                <ThemedText style={[styles.factValue, { color: textPrimary }]}>{fact.value}</ThemedText>
                <ThemedText style={[styles.factCaption, { color: textSecondary }]}>{fact.caption}</ThemedText>
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
    {
      key: 'total-days',
      label: 'Tage gesamt',
      value: stats.totalDays.toLocaleString('de-DE'),
      icon: 'calendar' as const,
      accent: pastelPalette.peach,
      iconColor: isDark ? '#FFC5A7' : '#C17055'
    },
    {
      key: 'total-weeks',
      label: 'Wochen',
      value: stats.totalWeeks.toLocaleString('de-DE'),
      icon: 'clock' as const,
      accent: pastelPalette.lavender,
      iconColor: isDark ? '#C2B7FF' : '#7A6FD1'
    },
    {
      key: 'total-months',
      label: 'Monate',
      value: stats.totalMonths.toLocaleString('de-DE'),
      icon: 'moon.stars.fill' as const,
      accent: pastelPalette.blush,
      iconColor: isDark ? '#FFB6D1' : '#CF6F8B'
    },
  ];

  const bodyMetrics = [
    {
      key: 'height',
      label: 'Größe',
      value: babyInfo.height ? `${babyInfo.height} cm` : 'Nicht angegeben',
      icon: 'person.fill' as const,
      accent: pastelPalette.sky,
      iconColor: isDark ? '#B6CEFF' : '#6C87C1',
    },
    {
      key: 'weight',
      label: 'Gewicht',
      value: babyInfo.weight ? `${babyInfo.weight} kg` : 'Nicht angegeben',
      icon: 'chart.bar.fill' as const,
      accent: pastelPalette.honey,
      iconColor: isDark ? '#FFCAA2' : '#B7745D',
    },
    {
      key: 'gender',
      label: 'Geschlecht',
      value: genderLabels[babyInfo.baby_gender as keyof typeof genderLabels] || genderLabels.unknown,
      icon: 'person.2.fill' as const,
      accent: pastelPalette.lavender,
      iconColor: isDark ? '#D1BDFF' : '#8C6AC3',
    },
  ];

  const handleBackPress = () => {
    triggerHaptic();
    navigation.goBack();
  };

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        
        <Header
          title="Baby-Statistiken"
          subtitle="Alter, Entwicklung & Fakten"
          showBackButton
          onBackPress={handleBackPress}
        />
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={isDark ? adaptiveColors.accent : theme.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
          >
            {babyInfo.birth_date ? (
              <>
                <LiquidGlassCard
                  style={[styles.glassCard, styles.firstGlassCard]}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorderColor}
                >
                  <View style={styles.glassInner}>
                    <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>Alter</ThemedText>

                    <View style={[styles.ageHighlight, styles.glassSurface, glassSurfaceStyle]}>
                      <GlassLayer
                        tint={isDark ? 'rgba(255, 177, 138, 0.24)' : 'rgba(255,232,220,0.75)'}
                        sheenOpacity={0.22}
                        isDark={isDark}
                      />
                      <View style={[styles.ageHighlightIcon, { backgroundColor: iconBubbleBackground }]}>
                        <IconSymbol name="clock" size={18} color={milestoneReachedIconColor} />
                      </View>
                      <View style={styles.ageHighlightText}>
                        <ThemedText style={[styles.ageValue, { color: textPrimary }]}>{renderAgeDescription()}</ThemedText>
                        <ThemedText style={[styles.ageSubline, { color: textSecondary }]}>Stand heute</ThemedText>
                      </View>
                    </View>

                    <View style={styles.ageChipRow}>
                      {ageChips.map((chip) => (
                        <View key={chip.key} style={[styles.ageChip, styles.glassSurface, glassSurfaceStyle]}>
                          <GlassLayer tint={chip.accent} sheenOpacity={0.25} isDark={isDark} />
                          <ThemedText style={[styles.ageChipValue, { color: textPrimary }]}>{chip.value}</ThemedText>
                          <ThemedText style={[styles.ageChipLabel, { color: textSecondary }]}>{chip.label}</ThemedText>
                        </View>
                      ))}
                    </View>
                  
                    <View style={styles.statRow}>
                      {statChips.map((stat) => (
                        <View key={stat.key} style={[styles.statItem, styles.glassSurface, glassSurfaceStyle]}>
                          <GlassLayer tint={stat.accent} sheenOpacity={0.2} isDark={isDark} />
                          <View style={[styles.statIcon, { backgroundColor: iconBubbleBackground }]}>
                            <IconSymbol name={stat.icon} size={16} color={stat.iconColor} />
                          </View>
                          <ThemedText style={[styles.statValue, { color: textPrimary }]}>{stat.value}</ThemedText>
                          <ThemedText style={[styles.statLabel, { color: textSecondary }]}>{stat.label}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </LiquidGlassCard>
                
                <LiquidGlassCard
                  style={styles.glassCard}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorderColor}
                >
                  <View style={styles.glassInner}>
                    <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>Geburtsdaten</ThemedText>
                    <View style={styles.bodyGrid}>
                      {bodyMetrics.map((metric) => (
                        <View key={metric.key} style={[styles.bodyBadge, styles.glassSurface, glassSurfaceStyle]}>
                          <GlassLayer tint={metric.accent} sheenOpacity={0.18} isDark={isDark} />
                          <View style={[styles.bodyIcon, { backgroundColor: iconBubbleBackground }]}>
                            <IconSymbol name={metric.icon} size={18} color={metric.iconColor} />
                          </View>
                          <View style={styles.bodyCopy}>
                            <ThemedText style={[styles.bodyValue, { color: textPrimary }]}>{metric.value}</ThemedText>
                            <ThemedText style={[styles.bodyLabel, { color: textSecondary }]}>{metric.label}</ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </LiquidGlassCard>
                
                {renderInterestingFacts()}
                
                <LiquidGlassCard
                  style={styles.glassCard}
                  intensity={26}
                  overlayColor={glassOverlay}
                  borderColor={glassBorderColor}
                >
                  <View style={styles.glassInner}>
                    <ThemedText style={[styles.sectionTitle, { color: textSecondary }]}>Meilensteine</ThemedText>
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
              <LiquidGlassCard
                style={styles.glassCard}
                intensity={26}
                overlayColor={glassOverlay}
                borderColor={glassBorderColor}
              >
                <View style={styles.glassInner}>
                  <ThemedText style={[styles.noDataText, { color: textSecondary }]}>
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
