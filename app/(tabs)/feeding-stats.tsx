import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, StyleSheet, Text, TouchableOpacity, ScrollView, Animated, StatusBar, ViewStyle, TextStyle, ImageStyle, ActivityIndicator } from 'react-native';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getBabyCareEntriesForDate, getBabyCareEntriesForDateRange, getBabyCareEntriesForMonth } from '@/lib/supabase';
import { Stack } from 'expo-router';
import { useSmartBack } from '@/contexts/NavigationContext';

type FeedType = 'BREAST' | 'BOTTLE' | 'SOLIDS';

function GlassCard({ children, style, intensity = 28, overlayColor = 'rgba(255,255,255,0.30)', borderColor = 'rgba(255,255,255,0.40)', gradientColors }: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  overlayColor?: string;
  borderColor?: string;
  gradientColors?: [string, string];
}) {
  const defaultGradient = gradientColors || [overlayColor, overlayColor];
  return (
    <View style={[s.glassCard, { borderColor }, style]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={intensity} tint="light" />
      <LinearGradient colors={defaultGradient} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

export default function FeedingStatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  // Set fallback route for smart back navigation
  useSmartBack('/(tabs)/home');

  const [selectedTab, setSelectedTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (selectedTab === 'day') {
          const { data } = await getBabyCareEntriesForDate(selectedDate);
          setEntries(data ?? []);
        } else if (selectedTab === 'week') {
          const d = new Date(selectedDate);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(d.setDate(diff));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          const { data } = await getBabyCareEntriesForDateRange(weekStart, weekEnd);
          setEntries(data ?? []);
        } else {
          const { data } = await getBabyCareEntriesForMonth(selectedDate);
          setEntries(data ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedTab, selectedDate]);

    const stats = useMemo(() => {
    // Für die Monatsansicht werden die Test-Daten in der MonthCalendarView generiert
    // Hier verwenden wir nur entries für die anderen Tabs
    const currentEntries = entries;

    if (!currentEntries || !Array.isArray(currentEntries)) {
      return {
        total: 0,
        countBreast: 0,
        countBottle: 0,
        countSolids: 0,
        volume: 0,
        first: null,
        last: null,
        byHour: new Array(24).fill(0)
      };
    }

    try {
      const onlyFeeding = currentEntries.filter((e) => e && e.entry_type === 'feeding');
      const countBreast = onlyFeeding.filter((e) => e.feeding_type === 'BREAST').length;
      const countBottle = onlyFeeding.filter((e) => e.feeding_type === 'BOTTLE').length;
      const countSolids = onlyFeeding.filter((e) => e.feeding_type === 'SOLIDS').length;
      const volume = onlyFeeding
        .filter(e => e.feeding_volume_ml != null)
        .reduce((sum, e) => sum + (Number(e.feeding_volume_ml) || 0), 0);

      let first = null;
      let last = null;

      if (onlyFeeding.length > 0) {
        try {
          first = new Date(onlyFeeding[onlyFeeding.length - 1].start_time);
          last = new Date(onlyFeeding[0].start_time);
        } catch (dateError) {
          console.warn('Error parsing dates:', dateError);
        }
      }

      // Verteilung über den Tag (0-23)
      const byHour: number[] = new Array(24).fill(0);
      onlyFeeding.forEach((e) => {
        try {
          if (e.start_time) {
            const h = new Date(e.start_time).getHours();
            if (h >= 0 && h <= 23) {
              byHour[h] += 1;
            }
          }
        } catch (hourError) {
          console.warn('Error processing hour:', hourError);
        }
      });

      return { total: onlyFeeding.length, countBreast, countBottle, countSolids, volume, first, last, byHour };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return {
        total: 0,
        countBreast: 0,
        countBottle: 0,
        countSolids: 0,
        volume: 0,
        first: null,
        last: null,
        byHour: new Array(24).fill(0)
      };
    }
  }, [entries]);

  const Tab = ({ id, label }: { id: 'day' | 'week' | 'month'; label: string }) => (
    <GlassCard
      style={[s.tabBtn, selectedTab === id && s.tabActive]}
      intensity={selectedTab === id ? 28 : 18}
      overlayColor={selectedTab === id ? 'rgba(125, 90, 80, 0.15)' : 'rgba(255,255,255,0.15)'}
      borderColor={selectedTab === id ? 'rgba(125, 90, 80, 0.4)' : 'rgba(255,255,255,0.3)'}
      gradientColors={selectedTab === id ? ['rgba(125, 90, 80, 0.2)', 'rgba(125, 90, 80, 0.1)'] : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
    >
      <TouchableOpacity style={s.tabInner} onPress={() => setSelectedTab(id)} activeOpacity={0.85}>
        <Text style={[s.tabText, selectedTab === id && s.tabTextActive]}>{label}</Text>
      </TouchableOpacity>
    </GlassCard>
  );

  const Bar = ({ value, max }: { value: number; max: number }) => {
    const h = max === 0 ? 2 : Math.max(2, Math.round((value / max) * 56));
    return (
      <View style={s.barWrap}>
        <LinearGradient
          colors={[
            value > 0 ? 'rgba(168, 196, 193, 0.4)' : 'rgba(125,90,80,0.15)',
            value > 0 ? 'rgba(168, 196, 193, 0.6)' : 'rgba(125,90,80,0.35)'
          ]}
          style={[s.bar, { height: h }]}
        />
      </View>
    );
  };

  const maxHour = Math.max(...(stats.byHour.length > 0 ? stats.byHour : [1]));

  // Monatsnavigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  // Monatskalender-Komponente
  const MonthCalendarView = () => {
    // Loading state für Monatsansicht
    if (isLoading) {
      return (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#7D5A50" />
          <Text style={s.loadingText}>Lade Monatsdaten...</Text>
        </View>
      );
    }

    const currentDate = selectedDate;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Fallback: Generiere Test-Daten wenn keine echten Daten vorhanden sind
    const testEntries = entries.length === 0 ? [
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-03T10:00:00Z`, feeding_type: 'BREAST' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-05T14:00:00Z`, feeding_type: 'BOTTLE' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-07T08:00:00Z`, feeding_type: 'BREAST' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-07T18:00:00Z`, feeding_type: 'BOTTLE' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-10T12:00:00Z`, feeding_type: 'SOLIDS' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-12T09:00:00Z`, feeding_type: 'BREAST' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-12T15:00:00Z`, feeding_type: 'BREAST' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-15T20:00:00Z`, feeding_type: 'BOTTLE' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-18T11:00:00Z`, feeding_type: 'BREAST' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-18T16:00:00Z`, feeding_type: 'BOTTLE' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-20T13:00:00Z`, feeding_type: 'BREAST' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-20T19:00:00Z`, feeding_type: 'BREAST' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-25T10:00:00Z`, feeding_type: 'SOLIDS' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-28T08:00:00Z`, feeding_type: 'BOTTLE' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-28T12:00:00Z`, feeding_type: 'BOTTLE' },
      { entry_date: `${year}-${String(month + 1).padStart(2, '0')}-28T16:00:00Z`, feeding_type: 'BOTTLE' },
    ] : entries;

    console.log('🔍 Using entries:', entries.length === 0 ? 'TEST DATA' : 'REAL DATA', testEntries.length);

    // Erste Tag des Monats
    const firstDay = new Date(year, month, 1);
    // Letzter Tag des Monats
    const lastDay = new Date(year, month + 1, 0);
    // Starttag für Kalender (Montag als erster Tag)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));

    // Kalenderwochen generieren
    const weeks = [];
    let currentWeek = [];
    let day = new Date(startDate);

    for (let i = 0; i < 42; i++) { // 6 Wochen à 7 Tage
      if (day.getDay() === 1 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      const dayStr = day.toISOString().split('T')[0];
      const dayStats = testEntries.filter(entry => {
        if (!entry || !entry.entry_date) return false;
        try {
          const entryDate = new Date(entry.entry_date).toISOString().split('T')[0];
          return entryDate === dayStr;
        } catch (error) {
          console.warn('Error processing entry date:', error);
          return false;
        }
      });

      const isCurrentMonth = day.getMonth() === month;
      const isToday = day.toDateString() === new Date().toDateString();

      // Berechne Fütterungstypen für Farbcodierung
      const breastCount = dayStats.filter(e => e.feeding_type === 'BREAST').length;
      const bottleCount = dayStats.filter(e => e.feeding_type === 'BOTTLE').length;
      const solidsCount = dayStats.filter(e => e.feeding_type === 'SOLIDS').length;
      const totalFeedings = breastCount + bottleCount + solidsCount;

      // DEBUG: Zeige Details für diesen Tag
      if (isCurrentMonth && day.getDate() <= 7) {
        console.log(`📅 Tag ${day.getDate()}: ${totalFeedings} Fütterungen (B:${breastCount}, O:${bottleCount}, S:${solidsCount})`);
      }

      // Bestimme Haupttyp für Farbcodierung
      let mainFeedingType: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'MIXED' | null = null;
      if (totalFeedings > 0) {
        if (breastCount > bottleCount && breastCount > solidsCount) {
          mainFeedingType = 'BREAST';
        } else if (bottleCount > breastCount && bottleCount > solidsCount) {
          mainFeedingType = 'BOTTLE';
        } else if (solidsCount > breastCount && solidsCount > bottleCount) {
          mainFeedingType = 'SOLIDS';
        } else {
          mainFeedingType = 'MIXED';
        }
      }

      currentWeek.push({
        date: new Date(day),
        isCurrentMonth,
        isToday,
        feedingCount: totalFeedings,
        volume: dayStats
          .filter(e => e.entry_type === 'feeding' && e.feeding_volume_ml != null)
          .reduce((sum, e) => sum + (Number(e.feeding_volume_ml) || 0), 0),
        mainFeedingType,
        breastCount,
        bottleCount,
        solidsCount
      });

      day.setDate(day.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const maxFeedings = Math.max(...weeks.flat().map(d => d.feedingCount), 1);

    // Debug: Zeige maxFeedings
    console.log('=== HEATMAP DEBUG ===');
    console.log('Max Feedings:', maxFeedings);
    console.log('All feeding counts:', weeks.flat().map(d => d.feedingCount));
    console.log('Sample day data:', weeks[0]?.slice(0, 3));

    // VOLLSTÄNDIG SICHTBARE Heatmap-Funktion - KRÄFTIGE FARBEN!
    const getHeatmapColor = (feedingCount: number, feedingType: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'MIXED' | null) => {
      console.log(`🔥 Heatmap: count=${feedingCount}, type=${feedingType}`);

      // DEUTLICH SICHTBARE Farben für verschiedene Fütterungszahlen
      const colorMap = {
        0: { r: 255, g: 255, b: 255, opacity: 0.15, borderOpacity: 0.25 },   // Leicht sichtbar weiß
        1: { r: 74, g: 144, b: 226, opacity: 0.8, borderOpacity: 0.9 },      // KRÄFTIGES Hellblau
        2: { r: 34, g: 110, b: 210, opacity: 0.85, borderOpacity: 0.95 },    // KRÄFTIGES Mittelblau  
        3: { r: 20, g: 85, b: 190, opacity: 0.9, borderOpacity: 1.0 },       // KRÄFTIGES Dunkelblau
        4: { r: 220, g: 53, b: 69, opacity: 0.9, borderOpacity: 1.0 }        // KRÄFTIGES Rot
      };

      const colorKey = Math.min(feedingCount, 4) as keyof typeof colorMap;
      const color = colorMap[colorKey];

      const result = {
        overlayColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.opacity})`,
        borderColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.borderOpacity})`,
        gradientColors: [
          `rgba(${color.r}, ${color.g}, ${color.b}, ${color.opacity})`,
          `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.max(0.4, color.opacity - 0.3)})`
        ] as [string, string]
      };

      console.log(`🎨 KRÄFTIGE Farben für ${feedingCount} feedings:`, result);
      return result;
    };

    // Funktion für Border-Farben
    const getFeedingTypeBorderColor = (type: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'MIXED' | null, isToday: boolean = false) => {
      if (isToday) return 'rgba(168, 196, 193, 0.6)';
      switch (type) {
        case 'BREAST': return 'rgba(147, 51, 234, 0.4)';
        case 'BOTTLE': return 'rgba(59, 130, 246, 0.4)';
        case 'SOLIDS': return 'rgba(251, 146, 60, 0.4)';
        case 'MIXED': return 'rgba(139, 92, 246, 0.4)';
        default: return 'rgba(255, 255, 255, 0.15)';
      }
    };

    // Funktion für Symbole
    const getFeedingTypeSymbol = (type: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'MIXED' | null) => {
      switch (type) {
        case 'BREAST': return '🤱';
        case 'BOTTLE': return '🍼';
        case 'SOLIDS': return '🥄';
        case 'MIXED': return '🍽️';
        default: return null;
      }
    };

    return (
      <View>
        {/* Monatsübersicht Header */}
        <View style={s.monthHeader}>
          <View style={s.monthNavigation}>
            <GlassCard
              style={s.monthNavButton}
              intensity={20}
              overlayColor="rgba(255, 255, 255, 0.2)"
              borderColor="rgba(255, 255, 255, 0.3)"
              gradientColors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
            >
              <TouchableOpacity
                style={s.monthNavButtonInner}
                onPress={() => navigateMonth('prev')}
                activeOpacity={0.7}
              >
                <IconSymbol name="chevron.left" size={20} color="#7D5A50" />
              </TouchableOpacity>
            </GlassCard>

            <Text style={s.monthTitle}>
              {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </Text>

            <GlassCard
              style={s.monthNavButton}
              intensity={20}
              overlayColor="rgba(255, 255, 255, 0.2)"
              borderColor="rgba(255, 255, 255, 0.3)"
              gradientColors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
            >
              <TouchableOpacity
                style={s.monthNavButtonInner}
                onPress={() => navigateMonth('next')}
                activeOpacity={0.7}
              >
                <IconSymbol name="chevron.right" size={20} color="#7D5A50" />
              </TouchableOpacity>
            </GlassCard>
          </View>

          <View style={s.monthSummary}>
            <Text style={s.monthSummaryText}>
              {testEntries.length} Fütterungen • {testEntries
                .filter(e => e && e.entry_type === 'feeding' && e.feeding_volume_ml != null)
                .reduce((sum, e) => sum + (Number(e.feeding_volume_ml) || 0), 0)} ml
            </Text>
          </View>
        </View>

        {/* Wochentage */}
        <View style={s.weekdaysRow}>
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <Text key={day} style={s.weekdayLabel}>{day}</Text>
          ))}
        </View>

        {/* Heatmap-Legende - KRÄFTIGE FARBEN */}
        <View style={s.heatmapLegendContainer}>
          <Text style={s.heatmapLegendTitle}>Fütterungs-Heatmap</Text>
          <View style={s.heatmapLegendRow}>
            <View style={s.heatmapLegendItem}>
              <GlassCard
                style={s.heatmapLegendColor}
                intensity={18}
                overlayColor="rgba(255, 255, 255, 0.15)"
                borderColor="rgba(255, 255, 255, 0.25)"
                gradientColors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.08)']}
              >
                <View />
              </GlassCard>
              <Text style={s.heatmapLegendLabel}>0</Text>
            </View>
            <View style={s.heatmapLegendItem}>
              <GlassCard
                style={s.heatmapLegendColor}
                intensity={18}
                overlayColor="rgba(74, 144, 226, 0.8)"
                borderColor="rgba(74, 144, 226, 0.9)"
                gradientColors={['rgba(74, 144, 226, 0.8)', 'rgba(74, 144, 226, 0.5)']}
              >
                <View />
              </GlassCard>
              <Text style={s.heatmapLegendLabel}>1</Text>
            </View>
            <View style={s.heatmapLegendItem}>
              <GlassCard
                style={s.heatmapLegendColor}
                intensity={18}
                overlayColor="rgba(34, 110, 210, 0.85)"
                borderColor="rgba(34, 110, 210, 0.95)"
                gradientColors={['rgba(34, 110, 210, 0.85)', 'rgba(34, 110, 210, 0.55)']}
              >
                <View />
              </GlassCard>
              <Text style={s.heatmapLegendLabel}>2</Text>
            </View>
            <View style={s.heatmapLegendItem}>
              <GlassCard
                style={s.heatmapLegendColor}
                intensity={18}
                overlayColor="rgba(20, 85, 190, 0.9)"
                borderColor="rgba(20, 85, 190, 1.0)"
                gradientColors={['rgba(20, 85, 190, 0.9)', 'rgba(20, 85, 190, 0.6)']}
              >
                <View />
              </GlassCard>
              <Text style={s.heatmapLegendLabel}>3</Text>
            </View>
            <View style={s.heatmapLegendItem}>
              <GlassCard
                style={s.heatmapLegendColor}
                intensity={18}
                overlayColor="rgba(220, 53, 69, 0.9)"
                borderColor="rgba(220, 53, 69, 1.0)"
                gradientColors={['rgba(220, 53, 69, 0.9)', 'rgba(220, 53, 69, 0.6)']}
              >
                <View />
              </GlassCard>
              <Text style={s.heatmapLegendLabel}>4+</Text>
            </View>
          </View>
        </View>

        {/* Kalender Grid */}
        <View style={s.calendarGrid}>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={s.weekRow}>
              {week.map((dayInfo, dayIndex) => {
                const feedingSymbol = getFeedingTypeSymbol(dayInfo.mainFeedingType);
                const heatmapColors = getHeatmapColor(dayInfo.feedingCount, dayInfo.mainFeedingType);

                // Debug-Ausgaben für die ersten paar Tage
                if (weekIndex === 0 && dayIndex < 3) {
                  console.log(`Day ${dayIndex}: feedingCount=${dayInfo.feedingCount}, mainFeedingType=${dayInfo.mainFeedingType}, colors=`, heatmapColors);
                }

                return (
                  <GlassCard
                    key={dayIndex}
                    style={[
                      s.dayCell,
                      !dayInfo.isCurrentMonth && s.dayOutsideMonth,
                      dayInfo.isToday && s.dayToday
                    ]}
                    intensity={dayInfo.isToday ? 30 : 18}
                    overlayColor={dayInfo.isCurrentMonth ?
                      heatmapColors.overlayColor :
                      'rgba(255, 255, 255, 0.03)'
                    }
                    borderColor={dayInfo.isToday ?
                      'rgba(168, 196, 193, 0.6)' :
                      (dayInfo.isCurrentMonth ? heatmapColors.borderColor : 'rgba(255, 255, 255, 0.1)')
                    }
                    gradientColors={dayInfo.isCurrentMonth ?
                      heatmapColors.gradientColors :
                      ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']
                    }
                  >
                    {dayInfo.isCurrentMonth ? (
                      <TouchableOpacity
                        style={s.dayCellInner}
                        onPress={() => {
                          setSelectedDate(dayInfo.date);
                          setSelectedTab('day');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          s.dayNumber,
                          dayInfo.isToday && s.dayNumberToday
                        ]}>
                          {dayInfo.date.getDate()}
                        </Text>

                        {feedingSymbol && (
                          <Text style={s.dayFeedingSymbol}>{feedingSymbol}</Text>
                        )}

                        {dayInfo.feedingCount > 1 && (
                          <View style={s.dayStats}>
                            <Text style={s.dayFeedingCount}>{dayInfo.feedingCount}</Text>
                          </View>
                        )}

                        {dayInfo.volume > 0 && dayInfo.feedingCount === 1 && (
                          <View style={s.dayStats}>
                            <Text style={s.dayVolume}>{dayInfo.volume}ml</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <Text style={[s.dayNumber, s.dayNumberOutside]}>
                        {dayInfo.date.getDate()}
                      </Text>
                    )}
                  </GlassCard>
                );
              })}
            </View>
          ))}
        </View>

        {/* Monatliche Trends */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Monatliche Trends</Text>

        {/* Zusammenfassungs-Diagramm */}
        <GlassCard
          style={s.trendsChartCard}
          intensity={22}
          overlayColor="rgba(255, 215, 180, 0.12)"
          borderColor="rgba(255, 215, 180, 0.3)"
          gradientColors={['rgba(255, 215, 180, 0.18)', 'rgba(255, 215, 180, 0.08)']}
        >
          <Text style={s.chartTitle}>Fütterungsverteilung</Text>
          <View style={s.chartLegend}>
            <View style={s.legendItem}>
              <View style={[s.legendColor, {
                backgroundColor: stats.countBreast > 0 ? 'rgba(147, 51, 234, 0.8)' : 'rgba(147, 51, 234, 0.3)',
                borderWidth: 2,
                borderColor: 'rgba(147, 51, 234, 0.6)'
              }]} />
              <Text style={s.legendText}>🤱 Stillen</Text>
              <Text style={s.legendValue}>{stats.countBreast}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendColor, {
                backgroundColor: stats.countBottle > 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)',
                borderWidth: 2,
                borderColor: 'rgba(59, 130, 246, 0.6)'
              }]} />
              <Text style={s.legendText}>🍼 Fläschchen</Text>
              <Text style={s.legendValue}>{stats.countBottle}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendColor, {
                backgroundColor: stats.countSolids > 0 ? 'rgba(251, 146, 60, 0.8)' : 'rgba(251, 146, 60, 0.3)',
                borderWidth: 2,
                borderColor: 'rgba(251, 146, 60, 0.6)'
              }]} />
              <Text style={s.legendText}>🥄 Beikost</Text>
              <Text style={s.legendValue}>{stats.countSolids}</Text>
            </View>
          </View>

          {/* Balkendiagramm */}
          <View style={s.barChartContainer}>
            {(() => {
              const total = stats.countBreast + stats.countBottle + stats.countSolids;
              if (total === 0) return null;

              return (
                <View style={s.barChart}>
                  {stats.countBreast > 0 && (
                    <View style={[s.barSegment, {
                      backgroundColor: 'rgba(147, 51, 234, 0.8)',
                      borderWidth: 1,
                      borderColor: 'rgba(147, 51, 234, 0.9)',
                      flex: stats.countBreast / total
                    }]}>
                      <Text style={s.barLabel}>{Math.round((stats.countBreast / total) * 100)}%</Text>
                    </View>
                  )}
                  {stats.countBottle > 0 && (
                    <View style={[s.barSegment, {
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      borderWidth: 1,
                      borderColor: 'rgba(59, 130, 246, 0.9)',
                      flex: stats.countBottle / total
                    }]}>
                      <Text style={s.barLabel}>{Math.round((stats.countBottle / total) * 100)}%</Text>
                    </View>
                  )}
                  {stats.countSolids > 0 && (
                    <View style={[s.barSegment, {
                      backgroundColor: 'rgba(251, 146, 60, 0.8)',
                      borderWidth: 1,
                      borderColor: 'rgba(251, 146, 60, 0.9)',
                      flex: stats.countSolids / total
                    }]}>
                      <Text style={s.barLabel}>{Math.round((stats.countSolids / total) * 100)}%</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </GlassCard>

        <View style={s.kpiRow}>
          <GlassCard
            style={s.trendCard}
            intensity={24}
            overlayColor="rgba(255, 140, 160, 0.15)"
            borderColor="rgba(255, 140, 160, 0.35)"
            gradientColors={['rgba(255, 140, 160, 0.2)', 'rgba(255, 140, 160, 0.1)']}
          >
            <Text style={s.trendEmoji}>🤱</Text>
            <Text style={s.trendValue}>{stats.countBreast}</Text>
            <Text style={s.trendLabel}>Stillen</Text>
          </GlassCard>

          <GlassCard
            style={s.trendCard}
            intensity={24}
            overlayColor="rgba(140, 190, 255, 0.15)"
            borderColor="rgba(140, 190, 255, 0.35)"
            gradientColors={['rgba(140, 190, 255, 0.2)', 'rgba(140, 190, 255, 0.1)']}
          >
            <Text style={s.trendEmoji}>🍼</Text>
            <Text style={s.trendValue}>{stats.countBottle}</Text>
            <Text style={s.trendLabel}>Fläschchen</Text>
          </GlassCard>

          <GlassCard
            style={s.trendCard}
            intensity={24}
            overlayColor="rgba(200, 130, 220, 0.15)"
            borderColor="rgba(200, 130, 220, 0.35)"
            gradientColors={['rgba(200, 130, 220, 0.2)', 'rgba(200, 130, 220, 0.1)']}
          >
            <Text style={s.trendEmoji}>🥄</Text>
            <Text style={s.trendValue}>{stats.countSolids}</Text>
            <Text style={s.trendLabel}>Beikost</Text>
          </GlassCard>
        </View>

        {/* Tägliche Durchschnittswerte */}
        <GlassCard
          style={s.averageCard}
          intensity={22}
          overlayColor="rgba(255, 215, 180, 0.12)"
          borderColor="rgba(255, 215, 180, 0.3)"
          gradientColors={['rgba(255, 215, 180, 0.18)', 'rgba(255, 215, 180, 0.08)']}
        >
          <Text style={s.averageTitle}>Durchschnittswerte</Text>
          <View style={s.averageStats}>
            <View style={s.averageItem}>
              <Text style={s.averageValue}>
                {testEntries.length > 0 ? (testEntries.length / new Date(year, month + 1, 0).getDate()).toFixed(1) : '0.0'}
              </Text>
              <Text style={s.averageLabel}>Fütterungen/Tag</Text>
            </View>
            <View style={s.averageItem}>
              <Text style={s.averageValue}>
                {testEntries.filter(e => e && e.feeding_volume_ml != null).length > 0
                  ? (stats.volume / testEntries.filter(e => e && e.feeding_volume_ml != null).length).toFixed(0)
                  : '0'}ml
              </Text>
              <Text style={s.averageLabel}>pro Fläschchen</Text>
            </View>
          </View>
        </GlassCard>
      </View>
    );
  };

  return (
    <ThemedBackground style={s.bg}>
      <SafeAreaView style={s.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <Header title="Mahlzeiten" subtitle="Statistiken & Verläufe" showBackButton />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.tabsRow}>
            <Tab id="day" label="Tag" />
            <Tab id="week" label="Woche" />
            <Tab id="month" label="Monat" />
          </View>

          {/* Bedingte Ansicht basierend auf Tab */}
          {selectedTab === 'month' ? (
            <MonthCalendarView />
          ) : (
            <>
          {/* KPI Row */}
          <View style={s.kpiRow}>
                <GlassCard
                  style={s.kpiCard}
                  intensity={24}
                  overlayColor="rgba(168, 196, 193, 0.15)"
                  borderColor="rgba(168, 196, 193, 0.35)"
                  gradientColors={['rgba(168, 196, 193, 0.2)', 'rgba(168, 196, 193, 0.1)']}
                >
              <Text style={s.kpiTitle}>Gesamt</Text>
              <Text style={s.kpiValue}>{stats.total}</Text>
              <Text style={s.kpiSub}>Fütterungen</Text>
            </GlassCard>

                <GlassCard
                  style={s.kpiCard}
                  intensity={24}
                  overlayColor="rgba(255, 180, 130, 0.15)"
                  borderColor="rgba(255, 180, 130, 0.35)"
                  gradientColors={['rgba(255, 180, 130, 0.2)', 'rgba(255, 180, 130, 0.1)']}
                >
              <Text style={s.kpiTitle}>Volumen</Text>
              <Text style={s.kpiValue}>{stats.volume} ml</Text>
              <Text style={s.kpiSub}>nur Fläschchen</Text>
            </GlassCard>
          </View>

          <View style={s.kpiRow}>
                <GlassCard
                  style={s.typeCard}
                  intensity={26}
                  overlayColor="rgba(255, 140, 160, 0.18)"
                  borderColor="rgba(255, 140, 160, 0.4)"
                  gradientColors={['rgba(255, 140, 160, 0.25)', 'rgba(255, 140, 160, 0.12)']}
                >
              <Text style={s.typeEmoji}>🤱</Text>
              <Text style={s.typeValue}>{stats.countBreast}</Text>
              <Text style={s.typeLabel}>Stillen</Text>
            </GlassCard>
                <GlassCard
                  style={s.typeCard}
                  intensity={26}
                  overlayColor="rgba(140, 190, 255, 0.18)"
                  borderColor="rgba(140, 190, 255, 0.4)"
                  gradientColors={['rgba(140, 190, 255, 0.25)', 'rgba(140, 190, 255, 0.12)']}
                >
              <Text style={s.typeEmoji}>🍼</Text>
              <Text style={s.typeValue}>{stats.countBottle}</Text>
              <Text style={s.typeLabel}>Flasche</Text>
            </GlassCard>
                <GlassCard
                  style={s.typeCard}
                  intensity={26}
                  overlayColor="rgba(200, 130, 220, 0.18)"
                  borderColor="rgba(200, 130, 220, 0.4)"
                  gradientColors={['rgba(200, 130, 220, 0.25)', 'rgba(200, 130, 220, 0.12)']}
                >
              <Text style={s.typeEmoji}>🥄</Text>
              <Text style={s.typeValue}>{stats.countSolids}</Text>
              <Text style={s.typeLabel}>Beikost</Text>
            </GlassCard>
          </View>

          {/* Verlauf */}
          <Text style={s.sectionTitle}>Verteilung über den Tag</Text>
              <GlassCard
                style={s.chartCard}
                intensity={22}
                overlayColor="rgba(255, 215, 180, 0.12)"
                borderColor="rgba(255, 215, 180, 0.3)"
                gradientColors={['rgba(255, 215, 180, 0.18)', 'rgba(255, 215, 180, 0.08)']}
              >
            <View style={s.chartRow}>
              {stats.byHour.map((v, i) => (
                <Bar key={i} value={v} max={maxHour} />
              ))}
            </View>
            <View style={s.chartLabels}>
              <Text style={s.chartLabel}>0</Text>
              <Text style={s.chartLabel}>6</Text>
              <Text style={s.chartLabel}>12</Text>
              <Text style={s.chartLabel}>18</Text>
              <Text style={s.chartLabel}>24</Text>
            </View>
          </GlassCard>

          {/* Zeitliche Eckwerte */}
          <View style={s.kpiRow}>
                <GlassCard
                  style={s.metaCard}
                  intensity={20}
                  overlayColor="rgba(168, 196, 193, 0.1)"
                  borderColor="rgba(168, 196, 193, 0.25)"
                  gradientColors={['rgba(168, 196, 193, 0.15)', 'rgba(168, 196, 193, 0.05)']}
                >
              <Text style={s.metaTitle}>Erste</Text>
              <Text style={s.metaValue}>{stats.first ? stats.first.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
            </GlassCard>
                <GlassCard
                  style={s.metaCard}
                  intensity={20}
                  overlayColor="rgba(255, 180, 130, 0.1)"
                  borderColor="rgba(255, 180, 130, 0.25)"
                  gradientColors={['rgba(255, 180, 130, 0.15)', 'rgba(255, 180, 130, 0.05)']}
                >
              <Text style={s.metaTitle}>Letzte</Text>
              <Text style={s.metaValue}>{stats.last ? stats.last.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
            </GlassCard>
          </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const s = StyleSheet.create<{
  bg: ViewStyle;
  container: ViewStyle;
  glassCard: ViewStyle;
  tabsRow: ViewStyle;
  tabBtn: ViewStyle;
  tabInner: ViewStyle;
  tabText: TextStyle;
  tabActive: ViewStyle;
  tabTextActive: TextStyle;
  sectionTitle: TextStyle;
  kpiRow: ViewStyle;
  kpiCard: ViewStyle;
  kpiTitle: TextStyle;
  kpiValue: TextStyle;
  kpiSub: TextStyle;
  typeCard: ViewStyle;
  typeEmoji: TextStyle;
  typeValue: TextStyle;
  typeLabel: TextStyle;
  chartCard: ViewStyle;
  chartRow: ViewStyle;
  barWrap: ViewStyle;
  bar: ViewStyle;
  chartLabels: ViewStyle;
  chartLabel: TextStyle;
  metaCard: ViewStyle;
  metaTitle: TextStyle;
  metaValue: TextStyle;
  // Monatskalender Styles
  monthHeader: ViewStyle;
  monthNavigation: ViewStyle;
  monthNavButton: ViewStyle;
  monthNavButtonInner: ViewStyle;
  monthTitle: TextStyle;
  monthSummary: ViewStyle;
  monthSummaryText: TextStyle;
  weekdaysRow: ViewStyle;
  weekdayLabel: TextStyle;
  calendarGrid: ViewStyle;
  weekRow: ViewStyle;
  dayCell: ViewStyle;
  dayCellInner: ViewStyle;
  dayOutsideMonth: ViewStyle;
  dayToday: ViewStyle;
  dayNumber: TextStyle;
  dayNumberOutside: TextStyle;
  dayNumberToday: TextStyle;
  dayStats: ViewStyle;
  dayFeedingCount: TextStyle;
  dayVolume: TextStyle;
  trendCard: ViewStyle;
  trendEmoji: TextStyle;
  trendValue: TextStyle;
  trendLabel: TextStyle;
  averageCard: ViewStyle;
  averageTitle: TextStyle;
  averageStats: ViewStyle;
  averageItem: ViewStyle;
  averageValue: TextStyle;
  averageLabel: TextStyle;
  // Loading und Empty States
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  emptyStateContainer: ViewStyle;
  emptyStateText: TextStyle;
  // Chart Styles für Trends
  trendsChartCard: ViewStyle;
  chartTitle: TextStyle;
  chartLegend: ViewStyle;
  legendItem: ViewStyle;
  legendColor: ViewStyle;
  legendText: TextStyle;
  legendValue: TextStyle;
  barChartContainer: ViewStyle;
  barChart: ViewStyle;
  barSegment: ViewStyle;
  barLabel: TextStyle;
  dayFeedingSymbol: TextStyle;
  // Heatmap Legend Styles
  heatmapLegendContainer: ViewStyle;
  heatmapLegendTitle: TextStyle;
  heatmapLegendRow: ViewStyle;
  heatmapLegendItem: ViewStyle;
  heatmapLegendColor: ViewStyle;
  heatmapLegendLabel: TextStyle;
}>({
  bg: { flex: 1, width: '100%' },
  container: { flex: 1 },
  glassCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  tabsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 16, marginTop: 6 },
  tabBtn: { borderRadius: 20, borderWidth: 1 },
  tabInner: { paddingHorizontal: 18, paddingVertical: 6 },
  tabText: { fontSize: 13, fontWeight: '700', color: '#7D5A50' },
  tabActive: { borderColor: 'rgba(125,90,80,0.55)' },
  tabTextActive: { color: '#7D5A50' },

  sectionTitle: { marginTop: 18, marginBottom: 8, paddingHorizontal: 16, fontSize: 14, fontWeight: '700', color: '#7D5A50', letterSpacing: -0.2 },

  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 10 },
  kpiCard: { width: '48%', paddingVertical: 18, paddingHorizontal: 14 },
  kpiTitle: { fontSize: 13, color: '#7D5A50', fontWeight: '700', letterSpacing: -0.1 },
  kpiValue: { fontSize: 28, fontWeight: '800', color: '#7D5A50', marginTop: 2, letterSpacing: -1 },
  kpiSub: { marginTop: 6, fontSize: 12, color: '#7D5A50', opacity: 0.8 },

  typeCard: { width: '31%', alignItems: 'center', paddingVertical: 14 },
  typeEmoji: { fontSize: 26 },
  typeValue: { fontSize: 20, fontWeight: '800', color: '#7D5A50', marginTop: 6, letterSpacing: -0.5 },
  typeLabel: { fontSize: 12, color: '#7D5A50', marginTop: 2, fontWeight: '600' },

  chartCard: { marginHorizontal: 16, paddingVertical: 16, paddingHorizontal: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 60 },
  barWrap: { width: '3.67%', backgroundColor: 'rgba(125,90,80,0.06)', borderRadius: 4, marginHorizontal: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 8, borderRadius: 4 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chartLabel: { fontSize: 10, color: '#7D5A50', fontWeight: '600', opacity: 0.8 },

  metaCard: { width: '48%', paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  metaTitle: { fontSize: 12, color: '#7D5A50', fontWeight: '600', opacity: 0.9 },
  metaValue: { fontSize: 18, fontWeight: '800', color: '#7D5A50', marginTop: 4, letterSpacing: -0.3 },

  // Monatskalender Styles
  monthHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  monthNavButtonInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7D5A50',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  monthSummary: {
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(125, 90, 80, 0.2)',
  },
  monthSummaryText: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '600',
    textAlign: 'center',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  weekdayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7D5A50',
    opacity: 0.8,
    width: '14.28%',
    textAlign: 'center',
  },
  calendarGrid: {
    paddingHorizontal: 16,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 4,
  },
  dayCellInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOutsideMonth: {
    opacity: 0.4,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: 'rgba(168, 196, 193, 0.6)',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
  },
  dayNumberOutside: {
    color: '#7D5A50',
    opacity: 0.4,
  },
  dayNumberToday: {
    color: '#5E3DB3',
    fontSize: 16,
  },
  dayStats: {
    alignItems: 'center',
    marginTop: 2,
  },
  dayFeedingCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5E3DB3',
    textAlign: 'center',
  },
  dayVolume: {
    fontSize: 8,
    color: '#7D5A50',
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 1,
  },
  dayFeedingSymbol: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  // Heatmap Legend Styles
  heatmapLegendContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  heatmapLegendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 8,
    textAlign: 'center',
  },
  heatmapLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heatmapLegendItem: {
    alignItems: 'center',
    flex: 1,
  },
  heatmapLegendColor: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
  },
  heatmapLegendLabel: {
    fontSize: 10,
    color: '#7D5A50',
    fontWeight: '600',
    textAlign: 'center',
  },
  trendCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  trendEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  trendValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#7D5A50',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  trendLabel: {
    fontSize: 11,
    color: '#7D5A50',
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.9,
  },
  averageCard: {
    marginHorizontal: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  averageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  averageStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  averageItem: {
    alignItems: 'center',
    flex: 1,
  },
  averageValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#7D5A50',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  averageLabel: {
    fontSize: 12,
    color: '#7D5A50',
    fontWeight: '600',
    opacity: 0.8,
    textAlign: 'center',
  },
  // Chart Styles für Trends
  trendsChartCard: {
    marginHorizontal: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7D5A50',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  chartLegend: {
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#7D5A50',
    flex: 1,
    fontWeight: '600',
  },
  legendValue: {
    fontSize: 14,
    color: '#7D5A50',
    fontWeight: '800',
  },
  barChartContainer: {
    alignItems: 'center',
  },
  barChart: {
    flexDirection: 'row',
    height: 40,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  barSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
  },
  // Loading und Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#7D5A50',
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7D5A50',
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.7,
  },
});


